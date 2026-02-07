/**
 * Graph Sync / Outbox routes (extracted from src/server.js)
 *
 * Non-negotiable: keep runtime behavior identical.
 */

const { parseUrl, parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleSync({ req, res, pathname, supabase }) {
    // ==================== Graph Sync API ====================

    // GET /api/projects/:id/sync/status - Get sync status
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/)[1];
        const result = await supabase.outbox.getSyncStatus(projectId);

        if (result.success) {
            jsonResponse(res, { status: result.status });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/sync/stats - Get sync statistics
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/)[1];
        const result = await supabase.outbox.getStats(projectId);

        if (result.success) {
            jsonResponse(res, { stats: result.stats });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/sync/dead-letters - Get dead letter events
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/) && req.method === 'GET') {
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

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/)[1];
        const result = await supabase.outbox.getDeadLetters(projectId);

        if (result.success) {
            jsonResponse(res, { dead_letters: result.deadLetters });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/sync/dead-letters/:id/retry - Retry a dead letter
    if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/) && req.method === 'POST') {
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

        const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/)[1];
        const result = await supabase.outbox.retryDeadLetter(deadLetterId);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/sync/dead-letters/:id/resolve - Resolve a dead letter
    if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const body = await parseBody(req);
        const result = await supabase.outbox.resolveDeadLetter(deadLetterId, userResult.user.id, body.notes);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // ==================== Graph Sync API ====================

    // GET /api/projects/:id/sync/status - Get sync status
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/)[1];
        const result = await supabase.outbox.getSyncStatus(projectId);

        if (result.success) {
            jsonResponse(res, { status: result.status });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/sync/stats - Get sync statistics
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/)[1];
        const result = await supabase.outbox.getStats(projectId);

        if (result.success) {
            jsonResponse(res, { stats: result.stats });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/sync/pending - Get pending count
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/pending$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/pending$/)[1];
        const result = await supabase.outbox.getPendingCount(projectId);

        if (result.success) {
            jsonResponse(res, { count: result.count });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/sync/dead-letters - Get dead letter events
    if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/)[1];
        const parsed = parseUrl(req.url);

        const result = await supabase.outbox.getDeadLetters(projectId, {
            unresolvedOnly: parsed.query.unresolved !== 'false',
            limit: parseInt(parsed.query.limit) || 50
        });

        if (result.success) {
            jsonResponse(res, { deadLetters: result.deadLetters });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/sync/dead-letters/:id/resolve - Resolve dead letter
    if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const body = await parseBody(req);
        const result = await supabase.outbox.resolveDeadLetter(deadLetterId, userResult.user.id, body.notes);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/sync/dead-letters/:id/retry - Retry dead letter
    if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/) && req.method === 'POST') {
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

        const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/)[1];
        const result = await supabase.outbox.retryDeadLetter(deadLetterId);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleSync,
};
