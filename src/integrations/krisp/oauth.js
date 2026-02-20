/**
 * Purpose:
 *   OAuth2 PKCE flow for Krisp MCP integration with Dynamic Client
 *   Registration (RFC 7591). Per-user token storage in Supabase vault.
 *
 * Responsibilities:
 *   - Dynamic Client Registration via Krisp's registration endpoint
 *   - Generate PKCE code_verifier + code_challenge (S256)
 *   - Build authorization URL for Krisp OAuth (includes client_id)
 *   - Exchange authorization code for access/refresh tokens (includes client credentials)
 *   - Auto-refresh expired tokens
 *   - Store/retrieve/delete tokens and client credentials in Supabase secrets
 *   - Report connection status per user
 *
 * Key dependencies:
 *   - ../../supabase/secrets: encrypted secret storage
 *   - ../../logger: structured logging
 *   - crypto (Node built-in): PKCE challenge generation
 *
 * Side effects:
 *   - Reads/writes secrets table via secrets module
 *   - Network calls to Krisp OAuth endpoints (registration, token)
 *
 * Notes:
 *   - OAuth discovery from https://mcp.krisp.ai/.well-known/oauth-authorization-server
 *   - Client registration is per-app (shared across users), cached in memory + secrets
 *   - Tokens scoped per user: secret name includes userId
 *   - PKCE state stored temporarily during auth flow, deleted after callback
 */

const crypto = require('crypto');
const { logger } = require('../../logger');
const secrets = require('../../supabase/secrets');

const log = logger.child({ module: 'krisp-oauth' });

const KRISP_AUTH_URL = 'https://app.krisp.ai/oauth2/authorize';
const KRISP_TOKEN_URL = 'https://api.krisp.ai/platform/v1/oauth2/token';
const KRISP_REGISTRATION_URL = 'https://mcp.krisp.ai/.well-known/oauth-registration';
const KRISP_SCOPES = [
    'user::me::read',
    'user::meetings::read',
    'user::meetings:notes::read',
    'user::meetings:transcripts::read',
    'user::meetings::list',
    'user::meetings:metadata::read',
    'user::activities::list'
].join(' ');

const SECRET_TOKENS = (userId) => `krisp_oauth_tokens_${userId}`;
const SECRET_PKCE = (state) => `krisp_pkce_${state}`;
const SECRET_CLIENT = 'krisp_oauth_client';

// In-memory cache for client credentials (shared across users, survives until restart)
let _clientCache = null;

function base64url(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function generateCodeVerifier() {
    return base64url(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return base64url(hash);
}

// ── Dynamic Client Registration (RFC 7591) ──────────────────────────────────

/**
 * Register this application with the Krisp MCP authorization server.
 * @param {string} redirectUri - The callback URL to register
 * @returns {Promise<{ client_id: string, client_secret?: string }>}
 */
async function registerClient(redirectUri) {
    const registrationBody = {
        client_name: 'GodMode',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post'
    };

    log.info({ event: 'krisp_dcr_register', redirect_uri: redirectUri }, 'Registering OAuth client with Krisp');

    const response = await fetch(KRISP_REGISTRATION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(registrationBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        log.warn({ event: 'krisp_dcr_error', status: response.status, body: errText.substring(0, 500) }, 'Client registration failed');
        throw new Error(`Krisp client registration failed (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    log.debug({ event: 'krisp_dcr_response', keys: Object.keys(data), scope: data.scope }, 'DCR response received');

    if (!data.client_id) {
        throw new Error('Krisp client registration returned no client_id');
    }

    const clientData = {
        client_id: data.client_id,
        client_secret: data.client_secret || null,
        scope: data.scope || null,
        redirect_uri: redirectUri,
        registered_at: Date.now()
    };

    // Persist in Supabase secrets for survival across restarts
    await secrets.setSecret({
        scope: 'system',
        name: SECRET_CLIENT,
        value: JSON.stringify(clientData),
        provider: 'krisp'
    });

    _clientCache = clientData;
    log.info({ event: 'krisp_dcr_success', client_id: data.client_id }, 'OAuth client registered');
    return clientData;
}

/**
 * Get existing client credentials from cache/secrets, or register a new client.
 * Re-registers if the stored redirect_uri doesn't match the current one.
 * @param {string} redirectUri
 * @returns {Promise<{ client_id: string, client_secret?: string }>}
 */
async function getOrRegisterClient(redirectUri) {
    // 1. Check in-memory cache (must have scope field from current DCR format)
    if (_clientCache && _clientCache.client_id && _clientCache.redirect_uri === redirectUri && 'scope' in _clientCache) {
        return _clientCache;
    }

    // 2. Check persisted secret
    const stored = await secrets.getSecret('system', SECRET_CLIENT);
    if (stored.success && stored.value) {
        try {
            const data = JSON.parse(stored.value);
            if (data.client_id && data.redirect_uri === redirectUri && 'scope' in data) {
                _clientCache = data;
                return data;
            }
            // redirect_uri changed or old format without scope – re-register
            log.info({ event: 'krisp_dcr_reregister', reason: data.redirect_uri !== redirectUri ? 'redirect_changed' : 'missing_scope' }, 'Re-registering client');
        } catch {
            // Corrupted – fall through to registration
        }
    }

    // 3. Register new client
    return registerClient(redirectUri);
}

// ── Authorization Flow ──────────────────────────────────────────────────────

/**
 * Build the Krisp OAuth authorization URL and persist PKCE verifier.
 * Performs Dynamic Client Registration if no client_id exists yet.
 * @param {string} userId
 * @param {string} callbackUrl - Full callback URL (e.g. https://app.com/api/krisp/oauth/callback)
 * @returns {Promise<{ url: string, state: string }>}
 */
async function getAuthorizationUrl(userId, callbackUrl) {
    const client = await getOrRegisterClient(callbackUrl);

    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    await secrets.setSecret({
        scope: 'system',
        name: SECRET_PKCE(state),
        value: JSON.stringify({ userId, codeVerifier, callbackUrl, createdAt: Date.now() }),
        provider: 'krisp',
        userId
    });

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        redirect_uri: callbackUrl
    });
    // Use the scope granted during DCR if available; otherwise omit to let the server decide
    if (client.scope) {
        params.set('scope', client.scope);
    }

    const url = `${KRISP_AUTH_URL}?${params.toString()}`;
    log.info({ event: 'krisp_oauth_authorize', userId, client_id: client.client_id }, 'Generated authorization URL');
    return { url, state };
}

/**
 * Exchange authorization code for tokens and store them encrypted.
 * Includes client_id + client_secret per client_secret_post auth method.
 * @param {string} code - Authorization code from callback
 * @param {string} state - State parameter from callback
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function handleCallback(code, state) {
    const pkceResult = await secrets.getSecret('system', SECRET_PKCE(state));
    if (!pkceResult.success || !pkceResult.value) {
        return { success: false, error: 'Invalid or expired OAuth state' };
    }

    let pkceData;
    try {
        pkceData = JSON.parse(pkceResult.value);
    } catch {
        return { success: false, error: 'Corrupted PKCE state' };
    }

    const { userId, codeVerifier, callbackUrl } = pkceData;

    try {
        const client = await getOrRegisterClient(callbackUrl);

        const bodyParams = {
            grant_type: 'authorization_code',
            code,
            code_verifier: codeVerifier,
            redirect_uri: callbackUrl,
            client_id: client.client_id
        };
        if (client.client_secret) {
            bodyParams.client_secret = client.client_secret;
        }
        const body = new URLSearchParams(bodyParams);

        const response = await fetch(KRISP_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!response.ok) {
            const errText = await response.text();
            log.warn({ event: 'krisp_oauth_token_error', status: response.status, body: errText }, 'Token exchange failed');
            return { success: false, error: `Token exchange failed: ${response.status}` };
        }

        const tokens = await response.json();

        const tokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
            token_type: tokens.token_type || 'Bearer',
            scope: tokens.scope || KRISP_SCOPES
        };

        await secrets.setSecret({
            scope: 'system',
            name: SECRET_TOKENS(userId),
            value: JSON.stringify(tokenData),
            provider: 'krisp',
            userId
        });

        // Clean up PKCE state
        await secrets.deleteSecret('system', SECRET_PKCE(state));

        log.info({ event: 'krisp_oauth_connected', userId }, 'Krisp OAuth connected');
        return { success: true, userId };

    } catch (err) {
        log.warn({ event: 'krisp_oauth_callback_error', reason: err.message }, 'Callback error');
        return { success: false, error: err.message };
    }
}

/**
 * Get a valid access token for a user, refreshing if expired.
 * @param {string} userId
 * @returns {Promise<string|null>} Access token or null if not connected
 */
async function getAccessToken(userId) {
    const result = await secrets.getSecret('system', SECRET_TOKENS(userId));
    if (!result.success || !result.value) return null;

    let tokenData;
    try {
        tokenData = JSON.parse(result.value);
    } catch {
        return null;
    }

    // Check expiry with 60s buffer
    if (tokenData.expires_at && Date.now() > tokenData.expires_at - 60000) {
        if (tokenData.refresh_token) {
            const refreshed = await refreshAccessToken(userId, tokenData.refresh_token);
            if (refreshed) return refreshed;
        }
        return null;
    }

    return tokenData.access_token;
}

/**
 * Refresh an expired access token.
 * Includes client_id + client_secret per client_secret_post auth method.
 */
async function refreshAccessToken(userId, refreshToken) {
    try {
        const client = await getOrRegisterClient(
            _clientCache?.redirect_uri || 'https://placeholder'
        );

        const bodyParams = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: client.client_id
        };
        if (client.client_secret) {
            bodyParams.client_secret = client.client_secret;
        }
        const body = new URLSearchParams(bodyParams);

        const response = await fetch(KRISP_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!response.ok) {
            log.warn({ event: 'krisp_oauth_refresh_failed', status: response.status }, 'Token refresh failed');
            return null;
        }

        const tokens = await response.json();

        const tokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || refreshToken,
            expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
            token_type: tokens.token_type || 'Bearer',
            scope: tokens.scope || KRISP_SCOPES
        };

        await secrets.setSecret({
            scope: 'system',
            name: SECRET_TOKENS(userId),
            value: JSON.stringify(tokenData),
            provider: 'krisp',
            userId
        });

        log.debug({ event: 'krisp_oauth_refreshed', userId }, 'Token refreshed');
        return tokenData.access_token;

    } catch (err) {
        log.warn({ event: 'krisp_oauth_refresh_error', reason: err.message }, 'Refresh error');
        return null;
    }
}

/**
 * Disconnect a user's Krisp integration.
 */
async function disconnect(userId) {
    await secrets.deleteSecret('system', SECRET_TOKENS(userId));
    log.info({ event: 'krisp_oauth_disconnected', userId }, 'Krisp disconnected');
    return { success: true };
}

/**
 * Get connection status for a user.
 * @returns {Promise<{ connected: boolean, expiresAt?: number }>}
 */
async function getConnectionStatus(userId) {
    const result = await secrets.getSecret('system', SECRET_TOKENS(userId));
    if (!result.success || !result.value) {
        return { connected: false };
    }

    try {
        const tokenData = JSON.parse(result.value);
        const isExpired = tokenData.expires_at && Date.now() > tokenData.expires_at;
        const hasRefresh = !!tokenData.refresh_token;

        return {
            connected: !isExpired || hasRefresh,
            expiresAt: tokenData.expires_at || null,
            hasRefreshToken: hasRefresh
        };
    } catch {
        return { connected: false };
    }
}

module.exports = {
    getAuthorizationUrl,
    handleCallback,
    getAccessToken,
    refreshAccessToken,
    disconnect,
    getConnectionStatus
};
