/**
 * Audit feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/projects/:id/audit/summary - Get audit summary
 * - GET /api/projects/:id/audit/exports - List export jobs
 * - POST /api/projects/:id/audit/exports - Create export job
 * - GET /api/audit/exports/:id - Get export job status
 * - GET /api/audit/exports/:id/download - Download export
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

/**
 * Handle audit routes
 * @param {object} ctx - Context with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled
 */
async function handleAudit(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    if (!supabase || !supabase.isConfigured()) {
        if (pathname.includes('/audit/') || pathname.startsWith('/api/audit/')) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        return false;
    }

    // GET /api/projects/:id/audit/summary - Get audit summary
    const summaryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/summary$/);
    if (summaryMatch && req.method === 'GET') {
        const projectId = summaryMatch[1];
        const urlParsed = parsedUrl || parseUrl(req.url);
        const days = parseInt(urlParsed.query?.days) || 30;
        const result = await supabase.audit.getSummary(projectId, days);
        if (result.success) jsonResponse(res, { summary: result.summary });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/projects/:id/audit/exports - List export jobs
    const listExportsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/);
    if (listExportsMatch && req.method === 'GET') {
        const projectId = listExportsMatch[1];
        const result = await supabase.audit.listExports(projectId);
        if (result.success) jsonResponse(res, { exports: result.jobs });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/projects/:id/audit/exports - Create export job
    const createExportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/);
    if (createExportMatch && req.method === 'POST') {
        const projectId = createExportMatch[1];
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
        if (result.success) jsonResponse(res, { success: true, job: result.job });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/audit/exports/:id - Get export job status
    const getExportMatch = pathname.match(/^\/api\/audit\/exports\/([^/]+)$/);
    if (getExportMatch && req.method === 'GET') {
        const jobId = getExportMatch[1];
        const result = await supabase.audit.getExport(jobId);
        if (result.success) jsonResponse(res, { job: result.job });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/audit/exports/:id/download - Download export
    const downloadMatch = pathname.match(/^\/api\/audit\/exports\/([^/]+)\/download$/);
    if (downloadMatch && req.method === 'GET') {
        const jobId = downloadMatch[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const result = await supabase.audit.download(jobId, userResult.user.id);
        if (result.success) jsonResponse(res, result);
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/admin/audit/logs - List audit logs (superadmin)
    if (pathname === '/api/admin/audit/logs' && req.method === 'GET') {
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(userResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const urlParsed = parsedUrl || parseUrl(req.url);
        const result = await supabase.audit.listAuditLogs({
            page: parseInt(urlParsed.query?.page) || 1,
            limit: parseInt(urlParsed.query?.limit) || 50,
            search: urlParsed.query?.search || '',
            filter: urlParsed.query?.filter || 'all'
        });

        if (result.success) jsonResponse(res, result);
        else jsonResponse(res, { error: result.error }, 500);
        return true;
    }

    return false;
}

module.exports = { handleAudit };
