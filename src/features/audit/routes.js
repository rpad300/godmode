/**
 * Audit feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET  /api/projects/:id/audit/summary
 * - GET  /api/projects/:id/audit/exports
 * - POST /api/projects/:id/audit/exports
 * - GET  /api/audit/exports/:id
 * - GET  /api/audit/exports/:id/download
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleAudit(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/projects/:id/audit/summary - Get audit summary
    if (pathname.match(/^\/api\/projects\/([^/]+)\/audit\/summary$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/summary$/)[1];
        const days = parseInt(parsedUrl.query.days) || 30;

        const result = await supabase.audit.getSummary(projectId, days);

        if (result.success) {
            jsonResponse(res, { summary: result.summary });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/audit-exports - Legacy alias
    if (pathname.match(/^\/api\/projects\/([^/]+)\/audit-exports$/) && req.method === 'GET') {
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

        // Delegate to canonical handler
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit-exports$/)[1];
        const result = await supabase.audit.listExports(projectId);

        if (result.success) {
            jsonResponse(res, { exports: result.jobs });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/projects/:id/audit-exports - Legacy alias
    if (pathname.match(/^\/api\/projects\/([^/]+)\/audit-exports$/) && req.method === 'POST') {
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

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit-exports$/)[1];
        const body = await parseBody(req);

        const result = await supabase.audit.createExport({
            projectId,
            requestedBy: userResult.user.id,
            dateFrom: body.date_from,
            dateTo: body.date_to,
            filters: body.filters,
            format: body.format || 'json'
        });

        if (result.success) {
            jsonResponse(res, { success: true, job: result.job });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/projects/:id/audit/exports - List export jobs
    if (pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/) && req.method === 'GET') {
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

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/)[1];
        const result = await supabase.audit.listExports(projectId);

        if (result.success) {
            jsonResponse(res, { exports: result.jobs });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/projects/:id/audit/exports - Create export job
    if (pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const body = await parseBody(req);

        const result = await supabase.audit.createExport({
            projectId,
            requestedBy: userResult.user.id,
            dateFrom: body.date_from,
            dateTo: body.date_to,
            filters: body.filters,
            format: body.format || 'json'
        });

        if (result.success) {
            jsonResponse(res, { success: true, job: result.job });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/audit/exports/:id - Get export job status
    if (pathname.match(/^\/api\/audit\/exports\/([^/]+)$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const jobId = pathname.match(/^\/api\/audit\/exports\/([^/]+)$/)[1];
        const result = await supabase.audit.getExport(jobId);

        if (result.success) {
            jsonResponse(res, { job: result.job });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/audit/exports/:id/download - Download export
    if (pathname.match(/^\/api\/audit\/exports\/([^/]+)\/download$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const jobId = pathname.match(/^\/api\/audit\/exports\/([^/]+)\/download$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const result = await supabase.audit.download(jobId, userResult.user.id);

        if (result.success) {
            jsonResponse(res, result);
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleAudit
};
