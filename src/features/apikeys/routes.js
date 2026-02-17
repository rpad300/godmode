/**
 * Purpose:
 *   CRUD and usage-stats API for project-scoped API keys. Keys enable
 *   programmatic access to project resources with configurable permissions
 *   and rate limits.
 *
 * Responsibilities:
 *   - List all API keys for a project
 *   - Create new API keys with permissions, rate limits, and expiry
 *   - Revoke (soft-delete) an existing API key
 *   - Retrieve usage statistics for a specific key
 *
 * Key dependencies:
 *   - supabase.apikeys: data-access layer for API key CRUD and stats
 *   - supabase.auth: token extraction and user verification for create/revoke
 *   - ../../server/security.isValidUUID: input validation for project IDs
 *
 * Side effects:
 *   - POST creates a key row in Supabase; the raw key is returned once only
 *   - DELETE marks the key as revoked (soft delete with user attribution)
 *
 * Notes:
 *   - Returns 503 early if Supabase is not configured
 *   - Project ID is validated as UUID; invalid IDs yield 400
 *   - The plaintext API key is shown exactly once on creation
 *
 * Routes:
 *   GET    /api/projects/:id/api-keys   - List keys for project (auth: none at route level)
 *   POST   /api/projects/:id/api-keys   - Create key (auth: Bearer token required)
 *   DELETE /api/api-keys/:id            - Revoke key (auth: Bearer token required)
 *   GET    /api/api-keys/:id/stats      - Usage stats (?days=N, default 7)
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { isValidUUID } = require('../../server/security');

/**
 * Handle API keys routes
 * @param {object} ctx - Context with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled
 */
async function handleApikeys(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    if (!supabase || !supabase.isConfigured()) {
        if (pathname.startsWith('/api/projects/') && pathname.includes('/api-keys') ||
            pathname.startsWith('/api/api-keys/')) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        return false;
    }

    // GET /api/projects/:id/api-keys - List API keys
    const listMatch = pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/);
    if (listMatch && req.method === 'GET') {
        const projectId = listMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.apikeys.list(projectId);
        if (result.success) jsonResponse(res, { keys: result.keys });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/projects/:id/api-keys - Create API key
    const createMatch = pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/);
    if (createMatch && req.method === 'POST') {
        const projectId = createMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const body = await parseBody(req);
        const result = await supabase.apikeys.create({
            projectId,
            createdBy: userResult.user.id,
            name: body.name,
            description: body.description,
            permissions: body.permissions || ['read'],
            rateLimitPerMinute: body.rate_limit_per_minute,
            rateLimitPerDay: body.rate_limit_per_day,
            expiresAt: body.expires_at
        });
        if (result.success) {
            jsonResponse(res, {
                success: true,
                api_key: result.apiKey,
                message: 'Save this key - it will only be shown once!'
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // DELETE /api/api-keys/:id - Revoke API key
    const revokeMatch = pathname.match(/^\/api\/api-keys\/([^/]+)$/);
    if (revokeMatch && req.method === 'DELETE') {
        const keyId = revokeMatch[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const result = await supabase.apikeys.revoke(keyId, userResult.user.id);
        if (result.success) jsonResponse(res, { success: true });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/api-keys/:id/stats - Get API key usage stats
    const statsMatch = pathname.match(/^\/api\/api-keys\/([^/]+)\/stats$/);
    if (statsMatch && req.method === 'GET') {
        const keyId = statsMatch[1];
        const urlParsed = parsedUrl || parseUrl(req.url);
        const days = parseInt(urlParsed.query?.days) || 7;
        const result = await supabase.apikeys.getUsageStats(keyId, days);
        if (result.success) jsonResponse(res, { stats: result.stats });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    return false;
}

module.exports = { handleApikeys };
