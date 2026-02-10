/**
 * Cost Tracking Routes
 * Extracted from src/server.js for modularization
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Handle all cost tracking routes
 * @param {Object} ctx - Context object with req, res, pathname, storage, llm
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleCosts(ctx) {
    const { req, res, pathname, storage, llm } = ctx;
    const log = getLogger().child({ module: 'costs' });
    // Quick check - if not a costs route, return false immediately
    if (!pathname.startsWith('/api/costs')) {
        return false;
    }

    // GET /api/costs/summary?period=day|week|month|all
    if (pathname === '/api/costs/summary' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url || '');
            const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            const period = (parsedUrl.query?.period || 'month').toLowerCase();
            const validPeriod = ['day', 'week', 'month', 'all'].includes(period) ? period : 'month';
            const summary = await llm.costTracker.getSummaryForPeriod(validPeriod);
            jsonResponse(res, summary);
        } catch (e) {
            log.warn({ event: 'costs_summary_period_error', reason: e?.message }, 'Error getting summary for period');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }
    
    // GET /api/costs - Get cost summary
    if (pathname === '/api/costs' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url || '');
            const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            const summary = await llm.costTracker.getSummary();
            
            // Also get recent requests from storage
            if (storage._supabase) {
                try {
                    const recentRequests = await storage._supabase.getRecentLLMRequests(20);
                    summary.recentRequests = recentRequests || [];
                } catch (e) {
                    log.warn({ event: 'costs_recent_requests_error', reason: e.message }, 'Could not get recent requests');
                    summary.recentRequests = [];
                }
            }
            
            jsonResponse(res, summary);
        } catch (e) {
            log.warn({ event: 'costs_summary_error', reason: e?.message }, 'Error getting summary');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }
    
    // GET /api/costs/recent - Get recent LLM requests
    if (pathname === '/api/costs/recent' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url || '');
            const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            const limit = Math.min(parseInt(parsedUrl.query?.limit || '20', 10) || 20, 100);
            const requests = storage._supabase
                ? await storage._supabase.getRecentLLMRequests(limit)
                : [];
            jsonResponse(res, { requests });
        } catch (e) {
            log.warn({ event: 'costs_recent_requests_error', reason: e?.message }, 'Error getting recent requests');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/costs/models - Get detailed model stats
    if (pathname === '/api/costs/models' && req.method === 'GET') {
        try {
            const modelStats = await llm.costTracker.getModelStats();
            jsonResponse(res, { models: modelStats });
        } catch (e) {
            log.warn({ event: 'costs_model_stats_error', reason: e?.message }, 'Error getting model stats');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }
    
    // GET /api/costs/pricing - Get pricing table
    if (pathname === '/api/costs/pricing' && req.method === 'GET') {
        const { MODEL_PRICING } = require('../../llm/costTracker');
        const pricing = Object.entries(MODEL_PRICING).map(([model, prices]) => ({
            model,
            inputPer1M: prices.input,
            outputPer1M: prices.output
        }));
        jsonResponse(res, { pricing });
        return true;
    }
    
    // GET /api/costs/export?period=month&format=csv|json
    if (pathname === '/api/costs/export' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url || '');
            const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            const period = (parsedUrl.query?.period || 'month').toLowerCase();
            const format = (parsedUrl.query?.format || 'json').toLowerCase();
            const validPeriod = ['day', 'week', 'month', 'all'].includes(period) ? period : 'month';
            const validFormat = ['csv', 'json'].includes(format) ? format : 'json';
            const summary = await llm.costTracker.getSummaryForPeriod(validPeriod);
            const filename = `llm-costs-${validPeriod}-${new Date().toISOString().split('T')[0]}`;
            if (validFormat === 'csv') {
                const rows = [
                    ['Period', summary.period.start, summary.period.end],
                    ['Total Cost (USD)', String(summary.total)],
                    ['Total Input Tokens', String(summary.totalInputTokens || 0)],
                    ['Total Output Tokens', String(summary.totalOutputTokens || 0)],
                    [],
                    ['Daily Breakdown', 'Date', 'Cost', 'Calls'],
                    ...(summary.dailyBreakdown || []).map(d => ['', d.date, String(d.cost), String(d.calls)]),
                    [],
                    ['By Provider', 'Provider', 'Cost'],
                    ...Object.entries(summary.byProvider || {}).map(([k, v]) => ['', k, String(v)]),
                    [],
                    ['By Model', 'Model', 'Cost'],
                    ...Object.entries(summary.byModel || {}).map(([k, v]) => ['', k, String(v)]),
                    [],
                    ['By Context', 'Context', 'Cost'],
                    ...Object.entries(summary.byContext || {}).map(([k, v]) => ['', k, String(v)])
                ];
                const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                res.writeHead(200, {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}.csv"`
                });
                res.end('\uFEFF' + csv);
            } else {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}.json"`
                });
                res.end(JSON.stringify(summary, null, 2));
            }
        } catch (e) {
            log.warn({ event: 'costs_export_error', reason: e?.message }, 'Export error');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/costs/budget - Get budget config for period
    if (pathname === '/api/costs/budget' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url || '');
            const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            const period = (parsedUrl.query?.period || 'month').toLowerCase();
            const validPeriod = ['week', 'month'].includes(period) ? period : 'month';
            const budget = storage._supabase
                ? await storage._supabase.getLLMBudget(validPeriod)
                : null;
            jsonResponse(res, { budget });
        } catch (e) {
            log.warn({ event: 'costs_budget_get_error', reason: e?.message }, 'Error getting budget');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/costs/budget - Set budget for period
    if (pathname === '/api/costs/budget' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            const period = (body?.period || 'month').toLowerCase();
            const validPeriod = ['week', 'month'].includes(period) ? period : 'month';
            const limitUsd = parseFloat(body?.limit_usd ?? body?.limitUsd);
            const alertThreshold = (body?.alert_threshold_percent ?? body?.alertThresholdPercent) != null
                ? Math.min(100, Math.max(0, parseInt(String(body.alert_threshold_percent ?? body.alertThresholdPercent), 10)))
                : 80;
            if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
                jsonResponse(res, { error: 'Invalid limit_usd' }, 400);
                return true;
            }
            const budget = storage._supabase
                ? await storage._supabase.setLLMBudget(validPeriod, limitUsd, alertThreshold)
                : null;
            jsonResponse(res, { success: true, budget });
        } catch (e) {
            log.warn({ event: 'costs_budget_set_error', reason: e?.message }, 'Error setting budget');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/costs/reset - Reset cost tracking
    if (pathname === '/api/costs/reset' && req.method === 'POST') {
        llm.costTracker.reset();
        jsonResponse(res, { success: true, message: 'Cost tracking reset' });
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleCosts };
