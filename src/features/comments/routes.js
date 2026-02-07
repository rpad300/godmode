/**
 * Comments feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET    /api/comments?project_id=X&target_type=Y&target_id=Z
 * - POST   /api/comments
 * - PUT    /api/comments/:id
 * - DELETE /api/comments/:id
 * - POST   /api/comments/:id/resolve
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleComments(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/comments?project_id=X&target_type=Y&target_id=Z
    if (pathname === '/api/comments' && req.method === 'GET') {
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

        const { project_id, target_type, target_id } = parsedUrl?.query || {};

        if (!project_id || !target_type || !target_id) {
            jsonResponse(res, { error: 'project_id, target_type, and target_id are required' }, 400);
            return true;
        }

        const result = await supabase.comments.getComments(project_id, target_type, target_id, {
            includeReplies: parsedUrl?.query?.include_replies !== 'false',
            limit: parseInt(parsedUrl?.query?.limit) || 50
        });

        if (result.success) {
            jsonResponse(res, { comments: result.comments, total: result.total });
        } else {
            jsonResponse(res, { error: result.error }, 400);
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
