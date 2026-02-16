/**
 * Secrets Module
 * Manages encrypted API keys and sensitive credentials
 * Uses pgcrypto for encryption at rest
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'secrets' });

// Encryption key from environment
const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_KEY || 'default-dev-key';

// Known providers and their key patterns
const PROVIDERS = {
    openai: { prefix: 'sk-', name: 'OpenAI' },
    anthropic: { prefix: 'sk-ant-', name: 'Anthropic' },
    google: { prefix: 'AIza', name: 'Google AI' },
    grok: { prefix: 'xai-', name: 'Grok/xAI' },
    deepseek: { prefix: 'sk-', name: 'DeepSeek' },
    genspark: { prefix: '', name: 'Genspark' },
    kimi: { prefix: '', name: 'Kimi' },
    minimax: { prefix: '', name: 'MiniMax' },
    graph: { prefix: '', name: 'Graph' },
    google_drive: { prefix: '{', name: 'Google Drive (JSON)' }
};

/**
 * Mask an API key for display
 * Shows first 4 and last 4 characters
 */
function maskApiKey(key) {
    if (!key || key.length < 8) {
        return '••••••••';
    }
    return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
}

/**
 * Detect provider from key pattern
 */
function detectProvider(key) {
    if (!key) return null;

    for (const [providerId, config] of Object.entries(PROVIDERS)) {
        if (config.prefix && key.startsWith(config.prefix)) {
            return providerId;
        }
    }
    return null;
}

/**
 * Create or update a secret
 * Encrypts the value before storing
 */
async function setSecret({
    scope,
    projectId = null,
    name,
    value,
    provider = null,
    userId = null
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    // Validate scope
    if (scope === 'project' && !projectId) {
        return { success: false, error: 'Project ID required for project-scoped secrets' };
    }

    if (scope === 'system' && projectId) {
        return { success: false, error: 'System secrets cannot have a project ID' };
    }

    try {
        // Auto-detect provider if not specified
        const detectedProvider = provider || detectProvider(value);

        // Encrypt the value using pgcrypto function
        const { data: encrypted, error: encryptError } = await supabase
            .rpc('encrypt_secret', { p_value: value, p_key: ENCRYPTION_KEY });

        if (encryptError) {
            log.warn({ event: 'secrets_encryption_error', reason: encryptError?.message }, 'Encryption error');
            return { success: false, error: encryptError?.message || 'Failed to encrypt secret' };
        }

        // Generate masked value
        const masked = maskApiKey(value);

        // Check if secret already exists
        let existingId = null;
        let query = supabase
            .from('secrets')
            .select('id')
            .eq('scope', scope)
            .eq('name', name);

        if (scope === 'project') {
            query = query.eq('project_id', projectId);
        } else {
            query = query.is('project_id', null);
        }

        const { data: existing } = await query.maybeSingle();
        if (existing?.id) {
            existingId = existing.id;
        }

        let secret;
        let error;

        if (existingId) {
            // Update existing secret
            const result = await supabase
                .from('secrets')
                .update({
                    provider: detectedProvider,
                    encrypted_value: encrypted,
                    masked_value: masked,
                    is_valid: true,
                    updated_by: userId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingId)
                .select('id, scope, project_id, name, provider, masked_value, is_valid, created_at, updated_at')
                .single();
            secret = result.data;
            error = result.error;
        } else {
            // Insert new secret
            const result = await supabase
                .from('secrets')
                .insert({
                    scope,
                    project_id: projectId,
                    name,
                    provider: detectedProvider,
                    encrypted_value: encrypted,
                    masked_value: masked,
                    is_valid: true,
                    created_by: userId,
                    updated_by: userId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select('id, scope, project_id, name, provider, masked_value, is_valid, created_at, updated_at')
                .single();
            secret = result.data;
            error = result.error;
        }

        if (error) {
            log.warn({ event: 'secrets_set_error', reason: error?.message, code: error?.code }, 'Set error');
            return { success: false, error: error?.message || 'Database error' };
        }

        return { success: true, secret };
    } catch (error) {
        log.warn({ event: 'secrets_set_error', reason: error?.message }, 'Set error');
        return { success: false, error: error?.message || 'Unexpected error' };
    }
}

/**
 * Get a secret (decrypted)
 * Only use this when you need the actual value for API calls
 */
async function getSecret(scope, name, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Build query
        let query = supabase
            .from('secrets')
            .select('id, encrypted_value, provider, is_valid')
            .eq('scope', scope)
            .eq('name', name);

        if (scope === 'project') {
            query = query.eq('project_id', projectId);
        } else {
            query = query.is('project_id', null);
        }

        const { data: secret, error } = await query.single();

        if (error || !secret) {
            return { success: false, error: 'Secret not found' };
        }

        if (!secret.is_valid) {
            return { success: false, error: 'Secret is marked as invalid' };
        }

        // Decrypt the value
        const { data: decrypted, error: decryptError } = await supabase
            .rpc('decrypt_secret', { p_encrypted: secret.encrypted_value, p_key: ENCRYPTION_KEY });

        if (decryptError) {
            log.warn({ event: 'secrets_decryption_error', reason: decryptError?.message }, 'Decryption error');
            return { success: false, error: 'Failed to decrypt secret' };
        }

        // Update last used
        await supabase
            .from('secrets')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', secret.id);

        return {
            success: true,
            value: decrypted,
            provider: secret.provider
        };
    } catch (error) {
        log.warn({ event: 'secrets_get_error', reason: error?.message }, 'Get error');
        return { success: false, error: error.message };
    }
}

/**
 * Get secret metadata (without decrypting)
 * Safe to return to frontend
 */
async function getSecretInfo(scope, name, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('secrets')
            .select('id, scope, project_id, name, provider, masked_value, is_valid, last_used_at, created_at, updated_at')
            .eq('scope', scope)
            .eq('name', name);

        if (scope === 'project') {
            query = query.eq('project_id', projectId);
        } else {
            query = query.is('project_id', null);
        }

        const { data: secret, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { success: true, secret: null };
            }
            throw error;
        }

        return { success: true, secret };
    } catch (error) {
        log.warn({ event: 'secrets_get_info_error', reason: error?.message }, 'Get info error');
        return { success: false, error: error.message };
    }
}

/**
 * List all secrets for a scope (metadata only, never decrypted values)
 */
async function listSecrets(scope, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('secrets')
            .select('id, scope, project_id, name, provider, masked_value, is_valid, last_used_at, created_at, updated_at')
            .eq('scope', scope)
            .order('name');

        if (scope === 'project' && projectId) {
            query = query.eq('project_id', projectId);
        } else if (scope === 'system') {
            query = query.is('project_id', null);
        }

        const { data: secrets, error } = await query;

        if (error) throw error;

        return { success: true, secrets: secrets || [] };
    } catch (error) {
        log.error({ event: 'secrets_list_error', reason: error?.message }, 'List error');
        return { success: false, error: error.message };
    }
}

/**
 * Delete a secret
 */
async function deleteSecret(scope, name, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('secrets')
            .delete()
            .eq('scope', scope)
            .eq('name', name);

        if (scope === 'project') {
            query = query.eq('project_id', projectId);
        } else {
            query = query.is('project_id', null);
        }

        const { error } = await query;

        if (error) throw error;

        return { success: true };
    } catch (error) {
        log.warn({ event: 'secrets_delete_error', reason: error?.message }, 'Delete error');
        return { success: false, error: error.message };
    }
}

/**
 * Mark a secret as invalid (e.g., after failed API call)
 */
async function markSecretInvalid(scope, name, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('secrets')
            .update({ is_valid: false, updated_at: new Date().toISOString() })
            .eq('scope', scope)
            .eq('name', name);

        if (scope === 'project') {
            query = query.eq('project_id', projectId);
        } else {
            query = query.is('project_id', null);
        }

        const { error } = await query;

        if (error) throw error;

        return { success: true };
    } catch (error) {
        log.warn({ event: 'secrets_mark_invalid_error', reason: error?.message }, 'Mark invalid error');
        return { success: false, error: error.message };
    }
}

/**
 * Validate a secret by testing the API
 * Updates is_valid based on result
 */
async function validateSecret(scope, name, projectId = null) {
    const result = await getSecret(scope, name, projectId);

    if (!result.success) {
        return result;
    }

    // TODO: Implement actual API validation per provider
    // For now, just check if value exists and is non-empty
    const isValid = result.value && result.value.length > 0;

    if (!isValid) {
        await markSecretInvalid(scope, name, projectId);
    }

    return { success: true, isValid };
}

/**
 * Get API key for a provider with fallback logic
 * First checks project secrets, then falls back to system secrets
 */
async function getProviderApiKey(provider, projectId = null) {
    const name = `${provider}_api_key`;

    // Try project secret first
    if (projectId) {
        const projectResult = await getSecret('project', name, projectId);
        if (projectResult.success && projectResult.value) {
            return {
                success: true,
                value: projectResult.value,
                source: 'project',
                provider
            };
        }
    }

    // Fall back to system secret
    const systemResult = await getSecret('system', name);
    if (systemResult.success && systemResult.value) {
        return {
            success: true,
            value: systemResult.value,
            source: 'system',
            provider
        };
    }

    return { success: false, error: `No API key found for ${provider}` };
}

/**
 * Set API key for a provider
 */
async function setProviderApiKey(provider, value, scope = 'system', projectId = null, userId = null) {
    const name = `${provider}_api_key`;

    return setSecret({
        scope,
        projectId,
        name,
        value,
        provider,
        userId
    });
}

/**
 * Get all configured providers with their status
 * Returns masked keys and validity status
 */
async function getConfiguredProviders(projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get system secrets
        const { success: sysSuccess, secrets: systemSecrets } = await listSecrets('system');

        // Get project secrets if projectId provided
        let projectSecrets = [];
        if (projectId) {
            const { success: projSuccess, secrets } = await listSecrets('project', projectId);
            if (projSuccess) {
                projectSecrets = secrets;
            }
        }

        // Build providers status
        const providers = {};

        for (const [providerId, config] of Object.entries(PROVIDERS)) {
            const keyName = `${providerId}_api_key`;

            // Check project first, then system
            const projectKey = projectSecrets.find(s => s.name === keyName);
            const systemKey = systemSecrets.find(s => s.name === keyName);

            const activeKey = projectKey || systemKey;

            providers[providerId] = {
                name: config.name,
                isConfigured: !!activeKey,
                source: projectKey ? 'project' : (systemKey ? 'system' : null),
                maskedKey: activeKey?.masked_value || null,
                isValid: activeKey?.is_valid ?? null,
                lastUsed: activeKey?.last_used_at || null
            };
        }

        return { success: true, providers };
    } catch (error) {
        log.warn({ event: 'secrets_get_providers_error', reason: error?.message }, 'Get providers error');
        return { success: false, error: error.message };
    }
}

module.exports = {
    PROVIDERS,
    maskApiKey,
    detectProvider,
    setSecret,
    getSecret,
    getSecretInfo,
    listSecrets,
    deleteSecret,
    markSecretInvalid,
    validateSecret,
    getProviderApiKey,
    setProviderApiKey,
    getConfiguredProviders
};
