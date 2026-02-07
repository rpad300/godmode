/**
 * Projects management routes
 * Extracted from server.js
 *
 * Handles:
 * - GET  /api/user/projects
 * - POST /api/supabase-projects
 * - GET  /api/projects/:id/stats
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleProjectsManagement(ctx) {
    const { req, res, pathname, supabase } = ctx;

    // GET /api/user/projects - List user's projects
    if (pathname === '/api/user/projects' && req.method === 'GET') {
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

        const result = await supabase.projects.listForUser(userResult.user.id);

        if (result.success) {
            jsonResponse(res, { projects: result.projects });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/supabase-projects - Create project in Supabase
    if (pathname === '/api/supabase-projects' && req.method === 'POST') {
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

        const result = await supabase.projects.create({
            name: body.name,
            description: body.description,
            ownerId: userResult.user.id,
            settings: body.settings
        });

        if (result.success) {
            jsonResponse(res, { success: true, project: result.project });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/stats - Get project stats
    if (pathname.match(/^\/api\/projects\/([^/]+)\/stats$/) && req.method === 'GET') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/stats$/)[1];
        const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        if (!isUuid(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID' }, 400);
            return true;
        }
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const result = await supabase.projects.getStats(projectId);

        if (result.success) {
            jsonResponse(res, { stats: result.stats });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleProjectsManagement
};
