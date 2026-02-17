/**
 * Purpose:
 *   Search API routes providing user search, @mention suggestions, and cross-entity
 *   global search across the application.
 *
 * Responsibilities:
 *   - GET /api/search/users: Search users by name/email within a project context
 *   - GET /api/search/mentions: Autocomplete suggestions for @mention in comments/chat
 *   - GET /api/search: Global authenticated search across users, comments, and projects
 *
 * Key dependencies:
 *   - supabase.search: Search service with users(), mentionSuggestions(), global() methods
 *   - supabase.auth: Token extraction and user verification for authenticated search
 *
 * Side effects:
 *   - None (read-only endpoints)
 *
 * Notes:
 *   - All endpoints require Supabase to be configured (503 otherwise)
 *   - Global search (/api/search) requires authentication; user and mention searches do not
 *   - The global search allows toggling result types via query params (users, comments, projects)
 *   - Default limit is 10 for user search, 5 for global search
 */

const { parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

/**
 * Handle all search-related routes
 * @param {Object} ctx - Context object with req, res, pathname, supabase
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleSearch(ctx) {
    const { req, res, pathname, supabase } = ctx;
    
    // Quick check - if not a search route, return false immediately
    if (!pathname.startsWith('/api/search')) {
        return false;
    }

    // GET /api/search/users?q=term&project_id=X
    if (pathname === '/api/search/users' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const parsedUrl = parseUrl(req.url);
        const query = parsedUrl.query.q || '';
        
        const result = await supabase.search.users(query, {
            projectId: parsedUrl.query.project_id,
            limit: parseInt(parsedUrl.query.limit) || 10
        });
        
        if (result.success) {
            jsonResponse(res, { users: result.users });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // GET /api/search/mentions?prefix=X&project_id=Y
    if (pathname === '/api/search/mentions' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const parsedUrl = parseUrl(req.url);
        const prefix = parsedUrl.query.prefix || '';
        const projectId = parsedUrl.query.project_id;
        
        if (!projectId) {
            jsonResponse(res, { error: 'project_id is required' }, 400);
            return true;
        }
        
        const result = await supabase.search.mentionSuggestions(prefix, projectId);
        
        if (result.success) {
            jsonResponse(res, { suggestions: result.suggestions });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // GET /api/search?q=term&project_id=X
    if (pathname === '/api/search' && req.method === 'GET') {
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
        
        const parsedUrl = parseUrl(req.url);
        const query = parsedUrl.query.q || '';
        
        const result = await supabase.search.global(query, userResult.user.id, parsedUrl.query.project_id, {
            includeUsers: parsedUrl.query.users !== 'false',
            includeComments: parsedUrl.query.comments !== 'false',
            includeProjects: parsedUrl.query.projects !== 'false',
            limit: parseInt(parsedUrl.query.limit) || 5
        });
        
        if (result.success) {
            jsonResponse(res, { results: result.results });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleSearch };
