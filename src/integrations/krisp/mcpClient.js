/**
 * Purpose:
 *   Krisp MCP client using Streamable HTTP transport. Sends JSON-RPC
 *   tool calls to the Krisp MCP server on behalf of authenticated users.
 *
 * Responsibilities:
 *   - Send JSON-RPC 2.0 requests to https://mcp.krisp.ai/mcp
 *   - Authenticate via per-user OAuth Bearer tokens (from oauth.js)
 *   - Retry on 401 with token refresh
 *   - Parse JSON responses and SSE streams
 *   - Provide typed wrappers for each MCP tool
 *
 * Key dependencies:
 *   - ./oauth: per-user access token retrieval and refresh
 *   - ../../logger: structured logging
 *
 * Side effects:
 *   - Network calls to Krisp MCP server
 *   - May trigger token refresh in oauth module
 *
 * Notes:
 *   - Streamable HTTP: POST with JSON body, response is either JSON or SSE
 *   - MCP JSON-RPC uses method "tools/call" with { name, arguments } params
 */

const crypto = require('crypto');
const { logger } = require('../../logger');
const oauth = require('./oauth');

const log = logger.child({ module: 'krisp-mcp-client' });

const MCP_URL = 'https://mcp.krisp.ai/mcp';

/**
 * Send a JSON-RPC tool call to the Krisp MCP server.
 * @param {string} userId - User whose OAuth token to use
 * @param {string} toolName - MCP tool name
 * @param {object} args - Tool arguments
 * @param {object} [options] - { retry: boolean }
 * @returns {Promise<any>} Tool result content
 */
async function callTool(userId, toolName, args = {}, options = { retry: true }) {
    const token = await oauth.getAccessToken(userId);
    if (!token) {
        throw new Error('Krisp not connected. Please authorize first.');
    }

    const requestId = crypto.randomUUID();

    const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: args },
        id: requestId
    });

    log.debug({ event: 'krisp_mcp_call', tool: toolName, userId, requestId }, 'Calling MCP tool');

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${token}`
        },
        body
    });

    if (response.status === 401 && options.retry) {
        log.debug({ event: 'krisp_mcp_401_retry', userId }, 'Token expired, refreshing');
        const newToken = await oauth.getAccessToken(userId);
        if (newToken && newToken !== token) {
            return callTool(userId, toolName, args, { retry: false });
        }
        throw new Error('Krisp authentication expired. Please reconnect.');
    }

    if (!response.ok) {
        const errText = await response.text();
        log.warn({ event: 'krisp_mcp_error', status: response.status, body: errText.substring(0, 500) }, 'MCP call failed');
        throw new Error(`Krisp MCP error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const contentType = response.headers.get('content-type') || '';

    log.debug({ event: 'krisp_mcp_response', tool: toolName, status: response.status, contentType }, 'MCP response received');

    if (contentType.includes('text/event-stream')) {
        return parseSSEResponse(response);
    }

    const rawText = await response.text();
    log.debug({ event: 'krisp_mcp_raw', tool: toolName, bodyLength: rawText.length, bodyPreview: rawText.substring(0, 300) }, 'MCP raw response');

    let result;
    try {
        result = JSON.parse(rawText);
    } catch {
        log.warn({ event: 'krisp_mcp_parse_error', tool: toolName, body: rawText.substring(0, 500) }, 'Failed to parse MCP response as JSON');
        throw new Error('Krisp MCP returned non-JSON response');
    }

    if (result.error) {
        throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`);
    }

    return extractToolResult(result);
}

/**
 * Parse an SSE (Server-Sent Events) response stream.
 * Collects all events and returns the final tool result.
 */
async function parseSSEResponse(response) {
    const text = await response.text();
    const lines = text.split('\n');
    let lastData = null;

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data && data !== '[DONE]') {
                try {
                    lastData = JSON.parse(data);
                } catch {
                    // Non-JSON event data, skip
                }
            }
        }
    }

    if (lastData) {
        return extractToolResult(lastData);
    }

    throw new Error('No valid data received from SSE stream');
}

/**
 * Extract the tool result content from a JSON-RPC response.
 */
function extractToolResult(rpcResponse) {
    log.debug({ event: 'krisp_mcp_extract', hasResult: !!rpcResponse.result, keys: Object.keys(rpcResponse) }, 'Extracting tool result');

    if (rpcResponse.result) {
        const content = rpcResponse.result.content;
        if (Array.isArray(content) && content.length > 0) {
            const textPart = content.find(c => c.type === 'text');
            if (textPart && textPart.text) {
                log.debug({ event: 'krisp_mcp_text_content', textLength: textPart.text.length, preview: textPart.text.substring(0, 200) }, 'Found text content');
                try {
                    return JSON.parse(textPart.text);
                } catch {
                    // MCP often returns human-readable text with embedded JSON
                    return extractJsonFromText(textPart.text);
                }
            }
        }
        log.debug({ event: 'krisp_mcp_fallback_result', resultKeys: Object.keys(rpcResponse.result) }, 'Using result directly');
        return rpcResponse.result;
    }
    log.debug({ event: 'krisp_mcp_no_result' }, 'No result field, returning raw');
    return rpcResponse;
}

/**
 * Extract JSON array or object embedded in human-readable MCP text.
 * Krisp MCP responses often look like: "Found 5 meeting(s)...\n\nResults:\n[{...}]"
 */
function extractJsonFromText(text) {
    // Try to find a JSON array
    const arrStart = text.indexOf('[');
    if (arrStart !== -1) {
        const candidate = text.substring(arrStart);
        try {
            return JSON.parse(candidate);
        } catch { /* try object next */ }
    }
    // Try to find a JSON object
    const objStart = text.indexOf('{');
    if (objStart !== -1) {
        const candidate = text.substring(objStart);
        try {
            return JSON.parse(candidate);
        } catch { /* fall through */ }
    }
    log.debug({ event: 'krisp_mcp_no_json_in_text', preview: text.substring(0, 200) }, 'No JSON found in text');
    return text;
}

// ── Typed MCP Tool Wrappers ─────────────────────────────────────────────────

/**
 * Search meetings.
 * @param {string} userId
 * @param {object} params - { search?, after?, before?, limit?, offset?, fields? }
 * @returns {Promise<Array>} meetings
 */
async function searchMeetings(userId, params = {}) {
    const args = {};
    if (params.search) args.search = params.search;
    if (params.after) args.after = params.after;
    if (params.before) args.before = params.before;
    if (params.limit) args.limit = params.limit;
    if (params.offset) args.offset = params.offset;
    if (params.fields) args.fields = params.fields;
    return callTool(userId, 'search_meetings', args);
}

/**
 * Get a full document (meeting transcript, agenda, etc.).
 * @param {string} userId
 * @param {string} documentId - 32-char hex ID
 * @returns {Promise<string>} Document content
 */
async function getDocument(userId, documentId) {
    return callTool(userId, 'get_document', { documentId });
}

/**
 * Get multiple documents at once.
 * @param {string} userId
 * @param {string[]} ids - Array of 32-char hex IDs (max 10)
 * @returns {Promise<Array>} Array of { id, document }
 */
async function getMultipleDocuments(userId, ids) {
    return callTool(userId, 'get_multiple_documents', { ids });
}

/**
 * List action items from meetings.
 * @param {string} userId
 * @param {object} params - { completed?, assigned_to_me?, limit?, offset? }
 */
async function listActionItems(userId, params = {}) {
    return callTool(userId, 'list_action_items', params);
}

/**
 * List upcoming calendar meetings.
 * @param {string} userId
 * @param {number} [days=7]
 */
async function listUpcomingMeetings(userId, days = 7) {
    return callTool(userId, 'list_upcoming_meetings', { days });
}

/**
 * List Activity Center notifications.
 * @param {string} userId
 * @param {object} params - { limit?, timestamp? }
 */
async function listActivities(userId, params = {}) {
    return callTool(userId, 'list_activities', params);
}

module.exports = {
    callTool,
    searchMeetings,
    getDocument,
    getMultipleDocuments,
    listActionItems,
    listUpcomingMeetings,
    listActivities
};
