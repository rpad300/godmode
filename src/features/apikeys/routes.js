/**
 * API Keys feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET    /api/projects/:id/api-keys
 * - POST   /api/projects/:id/api-keys
 * - DELETE /api/api-keys/:id
 * - GET    /api/api-keys/:id/stats?days=N
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleApiKeys(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/projects/:id/api-keys - List API keys
    if (pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/)[1];
        const result = await supabase.apikeys.list(projectId);

        if (result.success) {
            jsonResponse(res, { keys: result.keys });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/projects/:id/api-keys - Create API key
    if (pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/)[1];
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
    if (pathname.match(/^\/api\/api-keys\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const keyId = pathname.match(/^\/api\/api-keys\/([^/]+)$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const result = await supabase.apikeys.revoke(keyId, userResult.user.id);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/api-keys/:id/stats - Get API key usage stats
    if (pathname.match(/^\/api\/api-keys\/([^/]+)\/stats$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const keyId = pathname.match(/^\/api\/api-keys\/([^/]+)\/stats$/)[1];
        const days = parseInt(parsedUrl?.query?.days) || 7;

        const result = await supabase.apikeys.getUsageStats(keyId, days);

        if (result.success) {
            jsonResponse(res, { stats: result.stats });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = { handleApiKeys };
