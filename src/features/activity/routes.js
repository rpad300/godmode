/**
 * Purpose:
 *   Retrieves the paginated activity feed for a project, supporting
 *   filtering by action type and date.
 *
 * Responsibilities:
 *   - Return project activity entries with pagination (limit/offset)
 *   - Support filtering by action type and "since" timestamp
 *
 * Key dependencies:
 *   - supabase.activity: data-access for project activity log
 *   - ../../server/security.isValidUUID: validates project ID format
 *
 * Side effects:
 *   - None (read-only)
 *
 * Notes:
 *   - Returns 503 if Supabase/auth is not configured
 *   - Project ID must be a valid UUID (400 otherwise)
 *   - Default limit is 50, offset 0
 *
 * Routes:
 *   GET /api/projects/:id/activity - Paginated activity feed
 *       Query: ?limit=&offset=&action=&since=
 *       Response: { activities[], total }
 */

const { parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { isValidUUID } = require('../../server/security');

/**
 * Handle activity routes
 * @param {object} ctx - Context with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled
 */
async function handleActivity(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/projects/:id/activity
    const match = pathname.match(/^\/api\/projects\/([^/]+)\/activity$/);
    if (match && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        const projectId = match[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const urlParsed = parsedUrl || parseUrl(req.url);
        const result = await supabase.activity.getProjectActivity(projectId, {
            limit: parseInt(urlParsed.query?.limit) || 50,
            offset: parseInt(urlParsed.query?.offset) || 0,
            action: urlParsed.query?.action,
            since: urlParsed.query?.since
        });
        if (result.success) {
            jsonResponse(res, { activities: result.activities, total: result.total });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = { handleActivity };
