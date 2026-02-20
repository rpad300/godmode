/**
 * Purpose:
 *   Krisp meeting transcription integration. Receives Krisp webhook events,
 *   manages user transcripts, and provides MCP-based meeting import/sync pipelines.
 *
 * Responsibilities:
 *   - Receive and process incoming Krisp webhook payloads (public, token-authenticated)
 *   - CRUD operations on per-user webhook configuration (create, regenerate, toggle, events)
 *   - CRUD on transcripts (list, get, update, delete, analyze, process, assign)
 *   - MCP import pipeline: check already-imported IDs, bulk import, import history
 *   - Available meetings: sync from MCP, list, selective import, stats, AI summaries
 *
 * Key dependencies:
 *   - ../../krisp: all business logic (processWebhook, getOrCreateWebhook, getUserTranscripts,
 *     analyzeTranscript, processTranscriptForGodmode, syncMeetingsFromMcp, etc.)
 *   - supabase.auth: bearer-token user authentication for all /api/krisp/* routes
 *
 * Side effects:
 *   - Writes transcript and webhook rows to Supabase via the krisp module
 *   - Webhook endpoint (POST /api/webhooks/krisp/:token) is publicly accessible --
 *     validated by 64-char hex token and optional Authorization header
 *   - AI summary generation (POST /api/krisp/available/summary) invokes LLM via config
 *
 * Notes:
 *   - Two exported handlers: handleKrispWebhook (public) and handleKrispApi (authenticated)
 *   - The webhook URL is constructed from APP_URL env or config.port fallback
 *   - Transcript routes use a single regex match for :id; the "summary" sub-path is
 *     handled by an explicit earlier check that returns false to fall through
 *
 * Routes:
 *   POST /api/webhooks/krisp/:token            - Inbound Krisp webhook (no auth, token in URL)
 *
 *   GET  /api/krisp/webhook                    - Get user's webhook config + URL
 *   POST /api/krisp/webhook                    - Create/get webhook
 *   POST /api/krisp/webhook/regenerate         - Regenerate webhook token
 *   PUT  /api/krisp/webhook/toggle             - Toggle webhook active state
 *   PUT  /api/krisp/webhook/events             - Update which events are enabled
 *
 *   GET  /api/krisp/transcripts                - List transcripts (with filters)
 *   GET  /api/krisp/transcripts/summary        - Aggregate transcript summary
 *   GET  /api/krisp/transcripts/:id            - Single transcript detail
 *   PUT  /api/krisp/transcripts/:id            - Update transcript metadata
 *   DELETE /api/krisp/transcripts/:id          - Delete transcript
 *   POST /api/krisp/transcripts/:id/analyze    - Run AI analysis on transcript
 *   POST /api/krisp/transcripts/:id/process    - Process transcript into GodMode document
 *   POST /api/krisp/transcripts/:id/assign     - Assign transcript to a project
 *
 *   GET  /api/krisp/mcp/imported               - Check which meeting IDs are already imported
 *   POST /api/krisp/mcp/import                 - Bulk import meetings from MCP data
 *   GET  /api/krisp/mcp/history                - Import history log
 *
 *   POST /api/krisp/available/sync             - Sync meetings from MCP into available pool
 *   GET  /api/krisp/available                  - List available meetings
 *   POST /api/krisp/available/import           - Import selected available meetings
 *   GET  /api/krisp/available/stats            - Available meetings statistics
 *   POST /api/krisp/available/summary          - Generate AI summary for a meeting
 *   GET  /api/krisp/available/summary          - Available meetings summary stats
 *
 *   GET  /api/krisp/oauth/status               - OAuth connection status
 *   GET  /api/krisp/oauth/authorize            - Start PKCE OAuth flow (returns redirect URL)
 *   GET  /api/krisp/oauth/callback             - OAuth callback (browser redirect, no auth)
 *   POST /api/krisp/oauth/disconnect           - Disconnect OAuth
 *   GET  /api/krisp/oauth/meetings             - List available meetings via MCP OAuth
 *   POST /api/krisp/oauth/meetings/import      - Import meetings via MCP OAuth
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Handle Krisp webhook (public - no auth required)
 * @param {object} ctx - Context object
 * @returns {Promise<boolean>} - true if handled
 */
async function handleKrispWebhook(ctx) {
    const { req, res, pathname } = ctx;
    const log = getLogger().child({ module: 'krisp-webhook' });
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
            log.warn({ event: 'krisp_webhook_error', reason: error?.message }, 'Krisp webhook error');
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
    const log = getLogger().child({ module: 'krisp' });
    
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
            log.warn({ event: 'krisp_analyze_error', reason: error?.message }, 'Analyze error');
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
            log.warn({ event: 'krisp_process_error', reason: error?.message }, 'Process error');
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
            log.warn({ event: 'krisp_assign_error', reason: error?.message }, 'Assign error');
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
            log.warn({ event: 'krisp_mcp_imported_error', reason: error?.message }, 'Error checking imported');
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
            log.warn({ event: 'krisp_mcp_import_error', reason: error?.message }, 'Import error');
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
            log.warn({ event: 'krisp_mcp_history_error', reason: error?.message }, 'History error');
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
            log.warn({ event: 'krisp_available_sync_error', reason: error?.message }, 'Sync error');
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
            log.warn({ event: 'krisp_available_list_error', reason: error?.message }, 'List error');
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
            log.warn({ event: 'krisp_available_import_error', reason: error?.message }, 'Import error');
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
            log.warn({ event: 'krisp_available_stats_error', reason: error?.message }, 'Stats error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/krisp/available/summary - Generate AI summary for one meeting (uses centralized LLM)
    if (pathname === '/api/krisp/available/summary' && req.method === 'POST') {
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
            const meetingId = body.meetingId;
            if (!meetingId) {
                jsonResponse(res, { error: 'meetingId required' }, 400);
                return true;
            }
            const { generateMeetingSummary } = require('../../krisp');
            const result = await generateMeetingSummary(meetingId, config);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'krisp_available_summary_error', reason: error?.message }, 'Summary error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/krisp/available/summary - Get available meetings summary (stats)
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
            log.warn({ event: 'krisp_available_summary_error', reason: error?.message }, 'Summary error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // ==================== Krisp OAuth / MCP Routes ====================

    // GET /api/krisp/oauth/status - Check OAuth connection status
    if (pathname === '/api/krisp/oauth/status' && req.method === 'GET') {
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
            const oauthModule = require('../../integrations/krisp/oauth');
            const status = await oauthModule.getConnectionStatus(userResult.user.id);
            jsonResponse(res, status);
        } catch (error) {
            log.warn({ event: 'krisp_oauth_status_error', reason: error?.message }, 'OAuth status error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/krisp/oauth/authorize - Start OAuth PKCE flow
    if (pathname === '/api/krisp/oauth/authorize' && req.method === 'GET') {
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
            const oauthModule = require('../../integrations/krisp/oauth');
            const appUrl = process.env.APP_URL || `http://localhost:${config.port}`;
            const callbackUrl = `${appUrl}/api/krisp/oauth/callback`;

            const { url, state } = await oauthModule.getAuthorizationUrl(
                userResult.user.id, callbackUrl
            );

            jsonResponse(res, { url, state });
        } catch (error) {
            log.warn({ event: 'krisp_oauth_authorize_error', reason: error?.message }, 'OAuth authorize error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/krisp/oauth/callback - OAuth callback (browser redirect, userId from PKCE state)
    if (pathname === '/api/krisp/oauth/callback' && req.method === 'GET') {
        try {
            const code = parsedUrl.query.code;
            const state = parsedUrl.query.state;
            const errorParam = parsedUrl.query.error;

            const appUrl = process.env.APP_URL || `http://localhost:${config.port}`;

            if (errorParam) {
                const errDesc = parsedUrl.query.error_description || errorParam;
                res.writeHead(302, { 'Location': `${appUrl}/profile?krisp_error=${encodeURIComponent(errDesc)}` });
                res.end();
                return true;
            }

            if (!code || !state) {
                res.writeHead(302, { 'Location': `${appUrl}/profile?krisp_error=missing_params` });
                res.end();
                return true;
            }

            const oauthModule = require('../../integrations/krisp/oauth');
            const result = await oauthModule.handleCallback(code, state);

            if (result.success) {
                res.writeHead(302, { 'Location': `${appUrl}/profile?krisp_connected=true` });
            } else {
                res.writeHead(302, { 'Location': `${appUrl}/profile?krisp_error=${encodeURIComponent(result.error)}` });
            }
            res.end();
        } catch (error) {
            log.warn({ event: 'krisp_oauth_callback_error', reason: error?.message }, 'OAuth callback error');
            const appUrl = process.env.APP_URL || `http://localhost:${config.port}`;
            res.writeHead(302, { 'Location': `${appUrl}/profile?krisp_error=${encodeURIComponent(error.message)}` });
            res.end();
        }
        return true;
    }

    // POST /api/krisp/oauth/disconnect - Disconnect OAuth
    if (pathname === '/api/krisp/oauth/disconnect' && req.method === 'POST') {
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
            const oauthModule = require('../../integrations/krisp/oauth');
            await oauthModule.disconnect(userResult.user.id);
            jsonResponse(res, { success: true });
        } catch (error) {
            log.warn({ event: 'krisp_oauth_disconnect_error', reason: error?.message }, 'OAuth disconnect error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // GET /api/krisp/oauth/meetings - List available meetings via MCP OAuth
    if (pathname === '/api/krisp/oauth/meetings' && req.method === 'GET') {
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
            const meetingImport = require('../../integrations/krisp/meetingImport');
            const result = await meetingImport.getAvailableMeetings(userResult.user.id, {
                search: parsedUrl.query.search || null,
                after: parsedUrl.query.after || null,
                before: parsedUrl.query.before || null,
                limit: parseInt(parsedUrl.query.limit) || 20,
                offset: parseInt(parsedUrl.query.offset) || 0
            });
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'krisp_oauth_meetings_error', reason: error?.message }, 'OAuth meetings list error');
            const status = error.message?.includes('not connected') ? 401 : 500;
            jsonResponse(res, { error: error.message }, status);
        }
        return true;
    }

    // GET /api/krisp/oauth/meetings/:id/preview - Fetch transcript + audio preview
    const meetingPreviewMatch = pathname.match(/^\/api\/krisp\/oauth\/meetings\/([a-f0-9]{32})\/preview$/);
    if (meetingPreviewMatch && req.method === 'GET') {
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
            const meetingImport = require('../../integrations/krisp/meetingImport');
            const preview = await meetingImport.getMeetingPreview(
                userResult.user.id, meetingPreviewMatch[1]
            );
            jsonResponse(res, preview);
        } catch (error) {
            log.warn({ event: 'krisp_oauth_preview_error', reason: error?.message }, 'Preview error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }

    // POST /api/krisp/oauth/meetings/import - Import meetings via MCP OAuth
    if (pathname === '/api/krisp/oauth/meetings/import' && req.method === 'POST') {
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
            const { meetingIds, projectId, importOptions } = body;

            if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
                jsonResponse(res, { error: 'meetingIds array required' }, 400);
                return true;
            }
            if (!projectId) {
                jsonResponse(res, { error: 'projectId required' }, 400);
                return true;
            }

            const meetingImport = require('../../integrations/krisp/meetingImport');
            const result = await meetingImport.importMeetingsBatch(
                userResult.user.id, meetingIds, projectId, importOptions || {}
            );
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'krisp_oauth_import_error', reason: error?.message }, 'OAuth import error');
            const status = error.message?.includes('not connected') ? 401 : 500;
            jsonResponse(res, { error: error.message }, status);
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
