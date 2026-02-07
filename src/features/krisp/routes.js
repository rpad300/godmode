/**
 * Krisp feature routes
 * Extracted from server.js
 * 
 * Handles:
 * - POST /api/webhooks/krisp/:token (incoming webhook - no auth)
 * - GET/POST /api/krisp/webhook
 * - POST /api/krisp/webhook/regenerate
 * - PUT /api/krisp/webhook/toggle
 * - PUT /api/krisp/webhook/events
 * - GET /api/krisp/transcripts
 * - GET /api/krisp/transcripts/summary
 * - GET /api/krisp/transcripts/:id
 * - PUT /api/krisp/transcripts/:id
 * - DELETE /api/krisp/transcripts/:id
 * - POST /api/krisp/transcripts/:id/analyze
 * - POST /api/krisp/transcripts/:id/process
 * - POST /api/krisp/transcripts/:id/assign
 * - GET /api/krisp/mcp/imported
 * - POST /api/krisp/mcp/import
 * - GET /api/krisp/mcp/history
 * - POST /api/krisp/available/sync
 * - GET /api/krisp/available
 * - POST /api/krisp/available/import
 * - GET /api/krisp/available/stats
 * - GET /api/krisp/available/summary
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { parseUrl } = require('../../server/request');

/**
 * Handle Krisp webhook (public - no auth required)
 * @param {object} ctx - Context object
 * @returns {Promise<boolean>} - true if handled
 */
async function handleKrispWebhook(ctx) {
    const { req, res, pathname } = ctx;
    
    // POST /api/webhooks/krisp/:token - Receive Krisp webhook events
    const krispWebhookMatch = pathname.match(/^\/api\/webhooks\/krisp\/([a-f0-9]{64})$/);
    if (krispWebhookMatch && req.method === 'POST') {
        const webhookToken = krispWebhookMatch[1];
        const authHeader = req.headers['authorization'];
        
        try {
            const body = await parseBody(req);
            const { processWebhook } = require('../../krisp');
            
            const result = await processWebhook(webhookToken, authHeader, body);
            
            jsonResponse(res, {
                success: result.success,
                message: result.message,
                transcriptId: result.transcriptId
            }, result.status || (result.success ? 200 : 400));
        } catch (error) {
            console.error('[Krisp Webhook] Error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    return false;
}

/**
 * Handle Krisp API routes (authenticated)
 * @param {object} ctx - Context object with req, res, pathname, parsedUrl, supabase, config
 * @returns {Promise<boolean>} - true if handled
 */
async function handleKrispApi(ctx) {
    const { req, res, pathname, parsedUrl, supabase, config } = ctx;
    
    // Only handle /api/krisp/* routes
    if (!pathname.startsWith('/api/krisp/')) {
        return false;
    }

    // ==================== Krisp Integration API ====================
    
    // GET /api/krisp/webhook - Get user's Krisp webhook config
    if (pathname === '/api/krisp/webhook' && req.method === 'GET') {
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
        
        const { getOrCreateWebhook } = require('../../krisp');
        const result = await getOrCreateWebhook(userResult.user.id);
        
        if (result.success) {
            // Build full webhook URL
            const appUrl = process.env.APP_URL || `http://localhost:${config.port}`;
            const webhookUrl = `${appUrl}/api/webhooks/krisp/${result.webhook.webhook_token}`;
            
            jsonResponse(res, { 
                webhook: {
                    ...result.webhook,
                    webhook_url: webhookUrl
                }
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // POST /api/krisp/webhook - Create/get Krisp webhook
    if (pathname === '/api/krisp/webhook' && req.method === 'POST') {
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
        
        const { getOrCreateWebhook } = require('../../krisp');
        const result = await getOrCreateWebhook(userResult.user.id);
        
        if (result.success) {
            const appUrl = process.env.APP_URL || `http://localhost:${config.port}`;
            const webhookUrl = `${appUrl}/api/webhooks/krisp/${result.webhook.webhook_token}`;
            
            jsonResponse(res, { 
                webhook: {
                    ...result.webhook,
                    webhook_url: webhookUrl
                }
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // POST /api/krisp/webhook/regenerate - Regenerate webhook credentials
    if (pathname === '/api/krisp/webhook/regenerate' && req.method === 'POST') {
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
        
        const { regenerateWebhook } = require('../../krisp');
        const result = await regenerateWebhook(userResult.user.id);
        
        if (result.success) {
            const appUrl = process.env.APP_URL || `http://localhost:${config.port}`;
            const webhookUrl = `${appUrl}/api/webhooks/krisp/${result.webhook.webhook_token}`;
            
            jsonResponse(res, { 
                webhook: {
                    ...result.webhook,
                    webhook_url: webhookUrl
                }
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // PUT /api/krisp/webhook/toggle - Toggle webhook active status
    if (pathname === '/api/krisp/webhook/toggle' && req.method === 'PUT') {
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
        const { toggleWebhook } = require('../../krisp');
        const result = await toggleWebhook(userResult.user.id, body.is_active);
        
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // PUT /api/krisp/webhook/events - Update enabled events
    if (pathname === '/api/krisp/webhook/events' && req.method === 'PUT') {
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
        const { updateEnabledEvents } = require('../../krisp');
        const result = await updateEnabledEvents(userResult.user.id, body.events || []);
        
        if (result.success) {
            jsonResponse(res, { events: result.events });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // GET /api/krisp/transcripts - List user's transcripts
    if (pathname === '/api/krisp/transcripts' && req.method === 'GET') {
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
        
        const { getUserTranscripts } = require('../../krisp');
        
        const transcripts = await getUserTranscripts(userResult.user.id, {
            status: parsedUrl.query.status,
            projectId: parsedUrl.query.project_id,
            limit: parseInt(parsedUrl.query.limit) || 50,
            offset: parseInt(parsedUrl.query.offset) || 0
        });
        
        jsonResponse(res, { transcripts });
        return true;
    }
    
    // GET /api/krisp/transcripts/summary - Get transcripts summary
    if (pathname === '/api/krisp/transcripts/summary' && req.method === 'GET') {
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
        
        const { getTranscriptsSummary } = require('../../krisp');
        const summary = await getTranscriptsSummary(userResult.user.id);
        
        jsonResponse(res, summary);
        return true;
    }
    
    // GET /api/krisp/transcripts/:id - Get single transcript
    const transcriptIdMatch = pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)$/);
    if (transcriptIdMatch && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        
        const transcriptId = transcriptIdMatch[1];
        
        // Skip special routes
        if (transcriptId === 'summary') {
            return false; // Already handled above
        }
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const { getTranscript } = require('../../krisp');
        const transcript = await getTranscript(transcriptId, userResult.user.id);
        
        if (transcript) {
            jsonResponse(res, { transcript });
        } else {
            jsonResponse(res, { error: 'Transcript not found' }, 404);
        }
        return true;
    }
    
    // PUT /api/krisp/transcripts/:id - Update transcript
    if (transcriptIdMatch && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        
        const transcriptId = transcriptIdMatch[1];
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const body = await parseBody(req);
        const { updateTranscript } = require('../../krisp');
        const result = await updateTranscript(transcriptId, userResult.user.id, body);
        
        if (result.success) {
            jsonResponse(res, { success: true, transcript: result.transcript });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // DELETE /api/krisp/transcripts/:id - Delete transcript
    if (transcriptIdMatch && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        
        const transcriptId = transcriptIdMatch[1];
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const { deleteTranscript } = require('../../krisp');
        const result = await deleteTranscript(transcriptId, userResult.user.id);
        
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // POST /api/krisp/transcripts/:id/analyze - Analyze transcript
    if (pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)\/analyze$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        
        const transcriptId = pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)\/analyze$/)[1];
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        try {
            const { analyzeTranscript } = require('../../krisp');
            const result = await analyzeTranscript(transcriptId, userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, { success: true, analysis: result.analysis });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
        } catch (error) {
            console.error('[Krisp] Analyze error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/krisp/transcripts/:id/process - Process transcript for GodMode
    if (pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)\/process$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        
        const transcriptId = pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)\/process$/)[1];
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        try {
            const body = await parseBody(req);
            const { processTranscriptForGodmode } = require('../../krisp');
            const result = await processTranscriptForGodmode(transcriptId, userResult.user.id, {
                projectId: body.project_id
            });
            
            if (result.success) {
                jsonResponse(res, { success: true, documentId: result.documentId });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
        } catch (error) {
            console.error('[Krisp] Process error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/krisp/transcripts/:id/assign - Assign transcript to project
    if (pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)\/assign$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        
        const transcriptId = pathname.match(/^\/api\/krisp\/transcripts\/([^/]+)\/assign$/)[1];
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        try {
            const body = await parseBody(req);
            const { assignTranscriptToProject } = require('../../krisp');
            const result = await assignTranscriptToProject(transcriptId, userResult.user.id, body.project_id);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
        } catch (error) {
            console.error('[Krisp] Assign error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // ==================== Krisp MCP Import API ====================
    
    // GET /api/krisp/mcp/imported - Get list of already imported meeting IDs
    if (pathname === '/api/krisp/mcp/imported' && req.method === 'GET') {
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
        
        try {
            const meetingIds = parsedUrl.query.ids ? parsedUrl.query.ids.split(',') : [];
            
            const { getImportedMeetingIds } = require('../../krisp');
            const imported = await getImportedMeetingIds(userResult.user.id, meetingIds);
            
            jsonResponse(res, { imported: Array.from(imported) });
        } catch (error) {
            console.error('[Krisp MCP] Error checking imported:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/krisp/mcp/import - Import meetings from MCP data
    if (pathname === '/api/krisp/mcp/import' && req.method === 'POST') {
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
        
        try {
            const body = await parseBody(req);
            
            if (!body || !body.meetings || !Array.isArray(body.meetings)) {
                jsonResponse(res, { error: 'Missing meetings array' }, 400);
                return true;
            }
            
            const { importMeetings } = require('../../krisp');
            const result = await importMeetings(userResult.user.id, body.meetings, {
                forceReimport: body.forceReimport === true
            });
            
            jsonResponse(res, result);
        } catch (error) {
            console.error('[Krisp MCP] Import error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/krisp/mcp/history - Get import history
    if (pathname === '/api/krisp/mcp/history' && req.method === 'GET') {
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
        
        try {
            const limit = parseInt(parsedUrl.query.limit) || 50;
            const offset = parseInt(parsedUrl.query.offset) || 0;
            
            const { getImportHistory } = require('../../krisp');
            const history = await getImportHistory(userResult.user.id, { limit, offset });
            
            jsonResponse(res, { history });
        } catch (error) {
            console.error('[Krisp MCP] History error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // ==================== Krisp Available Meetings API ====================
    
    // POST /api/krisp/available/sync - Sync meetings from MCP (called by Cursor agent)
    if (pathname === '/api/krisp/available/sync' && req.method === 'POST') {
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
        
        try {
            const body = await parseBody(req);
            const { meetings } = body;
            
            if (!meetings || !Array.isArray(meetings)) {
                jsonResponse(res, { error: 'meetings array is required' }, 400);
                return true;
            }
            
            const { syncMeetingsFromMcp } = require('../../krisp');
            const result = await syncMeetingsFromMcp(userResult.user.id, meetings);
            
            jsonResponse(res, result);
        } catch (error) {
            console.error('[Krisp Available] Sync error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/krisp/available - Get available meetings
    if (pathname === '/api/krisp/available' && req.method === 'GET') {
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
        
        try {
            const options = {
                limit: parseInt(parsedUrl.query.limit) || 50,
                offset: parseInt(parsedUrl.query.offset) || 0,
                showImported: parsedUrl.query.showImported !== 'false',
                startDate: parsedUrl.query.startDate || null,
                endDate: parsedUrl.query.endDate || null,
                search: parsedUrl.query.search || null
            };
            
            const { getAvailableMeetings } = require('../../krisp');
            const result = await getAvailableMeetings(userResult.user.id, options);
            
            jsonResponse(res, result);
        } catch (error) {
            console.error('[Krisp Available] List error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/krisp/available/import - Import selected meetings
    if (pathname === '/api/krisp/available/import' && req.method === 'POST') {
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
        
        try {
            const body = await parseBody(req);
            const { meetingIds, projectId } = body;
            
            if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
                jsonResponse(res, { error: 'meetingIds array is required' }, 400);
                return true;
            }
            
            const { importFromAvailable } = require('../../krisp');
            const result = await importFromAvailable(userResult.user.id, meetingIds, { projectId });
            
            jsonResponse(res, result);
        } catch (error) {
            console.error('[Krisp Available] Import error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/krisp/available/stats - Get available meetings stats
    if (pathname === '/api/krisp/available/stats' && req.method === 'GET') {
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
        
        try {
            const { getAvailableMeetingsStats } = require('../../krisp');
            const result = await getAvailableMeetingsStats(userResult.user.id);
            
            jsonResponse(res, result);
        } catch (error) {
            console.error('[Krisp Available] Stats error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/krisp/available/summary - Get available meetings summary
    if (pathname === '/api/krisp/available/summary' && req.method === 'GET') {
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
        
        try {
            const { getAvailableMeetingsSummary } = require('../../krisp');
            const result = await getAvailableMeetingsSummary(userResult.user.id);
            
            jsonResponse(res, result);
        } catch (error) {
            console.error('[Krisp Available] Summary error:', error);
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // Not a route we handle
    return false;
}

module.exports = {
    handleKrispWebhook,
    handleKrispApi
};
