/**
 * Activity feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/projects/:id/activity
 */

const { jsonResponse } = require('../../server/response');

async function handleActivity(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/projects/:id/activity - Get project activity
    if (pathname.match(/^\/api\/projects\/([^/]+)\/activity$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/activity$/)[1];

        const result = await supabase.activity.getProjectActivity(projectId, {
            limit: parseInt(parsedUrl?.query?.limit) || 50,
            offset: parseInt(parsedUrl?.query?.offset) || 0,
            action: parsedUrl?.query?.action,
            since: parsedUrl?.query?.since
        });

        if (result.success) {
            jsonResponse(res, {
                activities: result.activities,
                total: result.total
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = { handleActivity };
