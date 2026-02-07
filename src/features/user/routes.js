/**
 * User routes
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/user/profile
 * - PUT /api/user/profile
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleUser(ctx) {
    const { req, res, pathname, supabase } = ctx;

    // GET /api/user/profile - Get current user profile
    if (pathname === '/api/user/profile' && req.method === 'GET') {
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

        const profileResult = await supabase.auth.getUserProfile(userResult.user.id);

        jsonResponse(res, {
            user: userResult.user,
            profile: profileResult.success ? profileResult.profile : null
        });
        return true;
    }

    // PUT /api/user/profile - Update current user profile
    if (pathname === '/api/user/profile' && req.method === 'PUT') {
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

        const body = await parseBody(req);

        const result = await supabase.auth.upsertUserProfile(userResult.user.id, {
            username: body.username,
            display_name: body.display_name,
            avatar_url: body.avatar_url
        });

        if (result.success) {
            jsonResponse(res, { success: true, profile: result.profile });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleUser
};
