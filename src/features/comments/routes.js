/**
 * Purpose:
 *   Comment system API routes. Supports threaded comments on any target entity
 *   (documents, contacts, etc.) with project scoping, reply chains, and thread resolution.
 *
 * Responsibilities:
 *   - List comments for a target entity (two access patterns: path-style and query-string)
 *   - Create comments with optional parent_id for threaded replies
 *   - Update comment content (author-only enforcement in supabase layer)
 *   - Delete comments (author-only enforcement in supabase layer)
 *   - Resolve/unresolve comment threads (toggles resolved state)
 *
 * Key dependencies:
 *   - supabase.comments: Data access for getComments, createComment, updateComment,
 *     deleteComment, resolveComment
 *   - supabase.auth: Token-based user identification for write operations
 *   - storage: Project context resolution via getCurrentProject / getProjectId
 *
 * Side effects:
 *   - Database: creates, updates, and deletes rows in the comments table
 *
 * Notes:
 *   - Two URL patterns for GET and POST: path-style /api/comments/:targetType/:targetId
 *     (project inferred from context) and query-string /api/comments?project_id=...&target_type=...
 *   - Read operations (GET) do not require user auth; write operations do
 *   - On error, GET endpoints return empty arrays ({ comments: [], total: 0 }) rather
 *     than error responses, so the UI always gets a valid shape
 *   - The resolve endpoint defaults to resolved=true; pass { resolved: false } to unresolve
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

/**
 * Resolve project_id from storage (X-Project-Id is applied before handlers run).
 */
function getProjectIdFromCtx(ctx) {
    const { storage } = ctx;
    if (!storage) return null;
    const proj = storage.getCurrentProject?.();
    if (proj?.id) return proj.id;
    if (storage.getProjectId && typeof storage.getProjectId === 'function') return storage.getProjectId();
    if (storage.currentProjectId) return storage.currentProjectId;
    return null;
}

/**
 * Handle comments routes
 * @param {object} ctx - Context object with req, res, pathname, parsedUrl, supabase, storage
 * @returns {Promise<boolean>} - true if handled, false if not a handled route
 */
async function handleComments(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/comments/:targetType/:targetId (path style; project_id from context)
    const pathStyleMatch = pathname.match(/^\/api\/comments\/([^/]+)\/([^/]+)$/);
    if (pathStyleMatch && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        if (!supabase.comments || typeof supabase.comments.getComments !== 'function') {
            jsonResponse(res, { comments: [], total: 0 });
            return true;
        }
        const targetType = pathStyleMatch[1];
        const targetId = pathStyleMatch[2];
        const projectId = getProjectIdFromCtx(ctx);
        if (!projectId) {
            jsonResponse(res, { error: 'Project context required (X-Project-Id)' }, 400);
            return true;
        }
        try {
            const q = (parsedUrl && parsedUrl.query) || {};
            const result = await supabase.comments.getComments(projectId, targetType, targetId, {
                includeReplies: q.include_replies !== 'false',
                limit: parseInt(q.limit, 10) || 50
            });
            if (result.success) {
                jsonResponse(res, { comments: result.comments || [], total: result.total || 0 });
            } else {
                jsonResponse(res, { comments: [], total: 0 });
            }
        } catch (err) {
            jsonResponse(res, { comments: [], total: 0 });
        }
        return true;
    }

    // POST /api/comments/:targetType/:targetId (path style; project_id from context)
    if (pathStyleMatch && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        if (!supabase.comments || typeof supabase.comments.createComment !== 'function') {
            jsonResponse(res, { error: 'Comments not available' }, 503);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const targetType = pathStyleMatch[1];
        const targetId = pathStyleMatch[2];
        const projectId = getProjectIdFromCtx(ctx);
        if (!projectId) {
            jsonResponse(res, { error: 'Project context required (X-Project-Id)' }, 400);
            return true;
        }
        try {
            const body = await parseBody(req);
            const result = await supabase.comments.createComment({
            projectId,
            authorId: userResult.user.id,
            targetType,
            targetId,
            content: body.content || '',
            parentId: body.parent_id || null
        });
            if (result.success) {
                jsonResponse(res, { success: true, comment: result.comment });
            } else {
                jsonResponse(res, { error: result.error || 'Failed to create comment' }, 400);
            }
        } catch (err) {
            jsonResponse(res, { error: 'Failed to create comment' }, 500);
        }
        return true;
    }

    // GET /api/comments?project_id=X&target_type=Y&target_id=Z
    if (pathname === '/api/comments' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        if (!supabase.comments || typeof supabase.comments.getComments !== 'function') {
            jsonResponse(res, { comments: [], total: 0 });
            return true;
        }
        const query = (parsedUrl || parseUrl(req.url)).query;
        const { project_id, target_type, target_id } = query;
        if (!project_id || !target_type || !target_id) {
            jsonResponse(res, { error: 'project_id, target_type, and target_id are required' }, 400);
            return true;
        }
        try {
            const result = await supabase.comments.getComments(project_id, target_type, target_id, {
                includeReplies: query.include_replies !== 'false',
                limit: parseInt(query.limit) || 50
            });
            if (result.success) {
                jsonResponse(res, { comments: result.comments || [], total: result.total || 0 });
            } else {
                jsonResponse(res, { comments: [], total: 0 });
            }
        } catch (err) {
            jsonResponse(res, { comments: [], total: 0 });
        }
        return true;
    }

    // POST /api/comments - Create comment
    if (pathname === '/api/comments' && req.method === 'POST') {
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

        const body = await parseBody(req);

        const result = await supabase.comments.createComment({
            projectId: body.project_id,
            authorId: userResult.user.id,
            targetType: body.target_type,
            targetId: body.target_id,
            content: body.content,
            parentId: body.parent_id
        });

        if (result.success) {
            jsonResponse(res, { success: true, comment: result.comment });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // PUT /api/comments/:id - Update comment
    if (pathname.match(/^\/api\/comments\/([^/]+)$/) && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const commentId = pathname.match(/^\/api\/comments\/([^/]+)$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const body = await parseBody(req);
        const result = await supabase.comments.updateComment(commentId, userResult.user.id, body.content);

        if (result.success) {
            jsonResponse(res, { success: true, comment: result.comment });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // DELETE /api/comments/:id - Delete comment
    if (pathname.match(/^\/api\/comments\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const commentId = pathname.match(/^\/api\/comments\/([^/]+)$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const result = await supabase.comments.deleteComment(commentId, userResult.user.id);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/comments/:id/resolve - Resolve comment thread
    if (pathname.match(/^\/api\/comments\/([^/]+)\/resolve$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const commentId = pathname.match(/^\/api\/comments\/([^/]+)\/resolve$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const body = await parseBody(req);
        const result = await supabase.comments.resolveComment(commentId, userResult.user.id, body.resolved !== false);

        if (result.success) {
            jsonResponse(res, { success: true, comment: result.comment });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = { handleComments };
