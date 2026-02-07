/**
 * Legacy project-scoped routes kept for integration test compatibility.
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleProjectLegacy(ctx) {
  const { req, res, pathname, supabase } = ctx;

  // GET /api/projects/:id/comments?targetType=&targetId=
  if (pathname.match(/^\/api\/projects\/([^/]+)\/comments$/) && req.method === 'GET') {
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

    const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/comments$/)[1];
    const parsedUrl = parseUrl(req.url);
    const targetType = parsedUrl.query.targetType || parsedUrl.query.target_type;
    const targetId = parsedUrl.query.targetId || parsedUrl.query.target_id;

    if (!targetType || !targetId) {
      jsonResponse(res, { error: 'targetType and targetId are required' }, 400);
      return true;
    }

    const result = await supabase.comments.getComments(projectId, targetType, targetId, {
      includeReplies: parsedUrl.query.include_replies !== 'false',
      limit: parseInt(parsedUrl.query.limit) || 50
    });

    if (result.success) jsonResponse(res, { comments: result.comments, total: result.total });
    else jsonResponse(res, { error: result.error }, 400);
    return true;
  }

  // POST /api/projects/:id/comments
  if (pathname.match(/^\/api\/projects\/([^/]+)\/comments$/) && req.method === 'POST') {
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

    const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/comments$/)[1];
    const body = await parseBody(req);

    const result = await supabase.comments.createComment({
      projectId,
      authorId: userResult.user.id,
      targetType: body.targetType || body.target_type,
      targetId: body.targetId || body.target_id,
      content: body.content,
      parentId: body.parentId || body.parent_id
    });

    if (result.success) jsonResponse(res, { success: true, comment: result.comment });
    else jsonResponse(res, { error: result.error }, 400);
    return true;
  }

  // GET /api/projects/:id/mentions?prefix=
  if (pathname.match(/^\/api\/projects\/([^/]+)\/mentions$/) && req.method === 'GET') {
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

    const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/mentions$/)[1];
    const parsedUrl = parseUrl(req.url);
    const prefix = parsedUrl.query.prefix || '';

    const result = await supabase.search.mentionSuggestions(prefix, projectId);
    if (result.success) jsonResponse(res, { suggestions: result.suggestions });
    else jsonResponse(res, { error: result.error }, 400);
    return true;
  }

  return false;
}

module.exports = { handleProjectLegacy };
