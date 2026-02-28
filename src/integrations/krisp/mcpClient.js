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
 * Collects all JSON-RPC events and extracts the best tool result —
 * preferring the event whose content carries actual data (array/object)
 * over one that only carries a human-readable summary string.
 */
async function parseSSEResponse(response) {
    const text = await response.text();
    const lines = text.split('\n');
    const events = [];

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data && data !== '[DONE]') {
                try {
                    events.push(JSON.parse(data));
                } catch {
                    // Non-JSON event data, skip
                }
            }
        }
    }

    log.debug({ event: 'krisp_mcp_sse_events', count: events.length }, 'SSE events collected');

    if (events.length === 0) {
        throw new Error('No valid data received from SSE stream');
    }

    // Try each event (last first, since JSON-RPC response is usually last),
    // but prefer the one whose extracted result is a real data structure
    let bestResult = null;

    for (let i = events.length - 1; i >= 0; i--) {
        const extracted = extractToolResult(events[i]);
        if (Array.isArray(extracted) || (typeof extracted === 'object' && extracted !== null)) {
            return extracted;
        }
        if (bestResult === null) bestResult = extracted;
    }

    return bestResult;
}

/**
 * Extract the tool result content from a JSON-RPC response.
 * Strategy:
 *   1. If any single text part is a complete JSON array/object, return it.
 *   2. Scan text parts for embedded JSON objects.
 *   3. If no JSON found, parse Krisp's markdown-formatted meeting text.
 */
function extractToolResult(rpcResponse) {
    log.debug({ event: 'krisp_mcp_extract', hasResult: !!rpcResponse.result, keys: Object.keys(rpcResponse) }, 'Extracting tool result');

    if (rpcResponse.result) {
        const content = rpcResponse.result.content;
        if (Array.isArray(content) && content.length > 0) {
            const textParts = content.filter(c => c.type === 'text' && c.text);
            log.debug({ event: 'krisp_mcp_text_parts', count: textParts.length, lengths: textParts.map(p => p.text.length) }, 'Text content parts');

            // Pass 1: look for a text part that IS a complete JSON structure
            for (const part of textParts) {
                try {
                    const parsed = JSON.parse(part.text);
                    if (isNonEmpty(parsed)) {
                        log.debug({ event: 'krisp_mcp_json_found', length: part.text.length, isArray: Array.isArray(parsed) }, 'Found complete JSON in content part');
                        return parsed;
                    }
                } catch { /* not pure JSON, continue */ }
            }

            // Pass 2: look for embedded JSON in text parts
            const jsonCollected = [];
            for (const part of textParts) {
                const extracted = extractJsonFromText(part.text);
                if (extracted !== null && isNonEmpty(extracted)) {
                    if (Array.isArray(extracted)) jsonCollected.push(...extracted);
                    else if (typeof extracted === 'object') jsonCollected.push(extracted);
                }
            }
            if (jsonCollected.length > 0) {
                log.debug({ event: 'krisp_mcp_json_collected', count: jsonCollected.length }, 'Collected JSON objects from text parts');
                return jsonCollected;
            }

            // Pass 3: Krisp MCP returns meetings as markdown text, one per content part.
            // Parse the structured markdown into meeting objects.
            const meetings = [];
            for (const part of textParts) {
                const meeting = parseMeetingMarkdown(part.text);
                if (meeting) meetings.push(meeting);
            }
            if (meetings.length > 0) {
                log.debug({ event: 'krisp_mcp_markdown_parsed', count: meetings.length }, 'Parsed meetings from markdown text parts');
                return meetings;
            }

            // Fallback: return longest text
            const sorted = [...textParts].sort((a, b) => b.text.length - a.text.length);
            if (sorted.length > 0) return sorted[0].text;
        }
        log.debug({ event: 'krisp_mcp_fallback_result', resultKeys: Object.keys(rpcResponse.result) }, 'Using result directly');
        return rpcResponse.result;
    }
    log.debug({ event: 'krisp_mcp_no_result' }, 'No result field, returning raw');
    return rpcResponse;
}

/** Check that a parsed value is not an empty array/object */
function isNonEmpty(val) {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
}

/**
 * Parse a Krisp MCP markdown text part into a structured meeting object.
 * Format:
 *   ## Meeting Name (ISO-Date)
 *   meeting_id: 32-char-hex
 *   speakers: Name1, Name2
 *   attendees: Name1, Name2
 *
 *   ### Key Points
 *   - point 1
 *
 *   ### Action Items
 *   - [ ] task (assignee)
 *   - [x] completed task
 *
 *   ### Detailed Summary
 *   #### Section Title
 *   Description text
 */
function parseMeetingMarkdown(text) {
    if (!text || text.length < 30) return null;

    // Extract meeting_id — required to be a valid meeting
    const idMatch = text.match(/meeting_id:\s*([a-f0-9]{32})/);
    if (!idMatch) return null;

    const meetingId = idMatch[1];

    // Extract name and date from the ## header
    // Format: ## Name (ISO-Date) or ## HH:MM AM/PM - source meeting Month Day (ISO-Date)
    const headerMatch = text.match(/^##\s+(.+?)\s*\((\d{4}-\d{2}-\d{2}T[^)]+)\)/m);
    let name = 'Untitled Meeting';
    let date = null;

    if (headerMatch) {
        name = headerMatch[1].trim();
        date = headerMatch[2];
    } else {
        // Try simpler header
        const simpleHeader = text.match(/^##\s+(.+)/m);
        if (simpleHeader) name = simpleHeader[1].trim();
        // Try date from meeting_id line context
        const dateMatch = text.match(/\((\d{4}-\d{2}-\d{2}T[\d:.Z]+)\)/);
        if (dateMatch) date = dateMatch[1];
    }

    // Extract speakers
    const speakersMatch = text.match(/^speakers?:\s*(.+)/mi);
    const speakers = speakersMatch
        ? speakersMatch[1].split(',').map(s => s.trim()).filter(Boolean)
        : [];

    // Extract attendees
    const attendeesMatch = text.match(/^attendees?:\s*(.+)/mi);
    const attendees = attendeesMatch
        ? attendeesMatch[1].split(',').map(s => s.trim()).filter(Boolean)
        : [];

    // Extract key points
    const keyPoints = extractMarkdownList(text, 'Key Points');

    // Extract action items
    const actionItemsRaw = extractMarkdownList(text, 'Action Items');
    const action_items = actionItemsRaw.map(item => {
        const completed = item.startsWith('[x]') || item.startsWith('[X]');
        const title = item.replace(/^\[[ xX]\]\s*/, '');
        const assigneeMatch = title.match(/\(([^)]+)\)\s*$/);
        return {
            title: assigneeMatch ? title.replace(assigneeMatch[0], '').trim() : title,
            completed,
            assignee: assigneeMatch ? assigneeMatch[1] : undefined
        };
    });

    // Extract detailed summary sections
    const detailed_summary = extractDetailedSummary(text);

    return {
        meeting_id: meetingId,
        name,
        date,
        speakers,
        attendees,
        meeting_notes: {
            key_points: keyPoints,
            action_items,
            detailed_summary
        }
    };
}

/** Extract a bulleted list under a ### heading */
function extractMarkdownList(text, heading) {
    const regex = new RegExp(`###\\s+${heading}[\\s\\S]*?(?=###|$)`, 'i');
    const section = text.match(regex);
    if (!section) return [];

    const items = [];
    const lines = section[0].split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            items.push(trimmed.substring(2).trim());
        }
    }
    return items;
}

/** Extract #### sub-sections from a ### Detailed Summary section */
function extractDetailedSummary(text) {
    const sectionMatch = text.match(/###\s+Detailed Summary([\s\S]*?)(?=###\s+[^#]|$)/i);
    if (!sectionMatch) return [];

    const sections = [];
    const parts = sectionMatch[1].split(/####\s+/);
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const nlIdx = trimmed.indexOf('\n');
        if (nlIdx === -1) {
            sections.push({ title: trimmed, description: '' });
        } else {
            sections.push({
                title: trimmed.substring(0, nlIdx).trim(),
                description: trimmed.substring(nlIdx + 1).trim()
            });
        }
    }
    return sections;
}

/**
 * Extract JSON array or object embedded in human-readable MCP text.
 * Krisp MCP responses often look like: "Found 5 meeting(s)...\n\nResults:\n[{...}]"
 * Handles trailing text after the JSON by finding matched brackets.
 */
function extractJsonFromText(text) {
    // Try to find a JSON array
    const arrStart = text.indexOf('[');
    if (arrStart !== -1) {
        const extracted = extractBalancedJson(text, arrStart, '[', ']');
        if (extracted) return extracted;
    }
    // Try to find a JSON object
    const objStart = text.indexOf('{');
    if (objStart !== -1) {
        const extracted = extractBalancedJson(text, objStart, '{', '}');
        if (extracted) return extracted;
    }
    log.debug({ event: 'krisp_mcp_no_json_in_text', preview: text.substring(0, 200) }, 'No JSON found in text');
    return null;
}

/**
 * Find balanced brackets from startIdx and try to parse as JSON.
 * Falls back to parsing from startIdx to end if bracket counting fails.
 */
function extractBalancedJson(text, startIdx, openChar, closeChar) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        if (ch === closeChar) {
            depth--;
            if (depth === 0) {
                const candidate = text.substring(startIdx, i + 1);
                try {
                    return JSON.parse(candidate);
                } catch {
                    return null;
                }
            }
        }
    }

    // Fallback: try from startIdx to end
    try {
        return JSON.parse(text.substring(startIdx));
    } catch {
        return null;
    }
}

/**
 * List available MCP tools from the Krisp server.
 * Uses the JSON-RPC `tools/list` method (not a tool call).
 */
async function listTools(userId) {
    const token = await oauth.getAccessToken(userId);
    if (!token) throw new Error('Krisp not connected');

    const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: crypto.randomUUID()
    });

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${token}`
        },
        body
    });

    if (!response.ok) {
        throw new Error(`Krisp MCP error (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    let rawText;

    if (contentType.includes('text/event-stream')) {
        const text = await response.text();
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6).trim();
                if (data && data !== '[DONE]') {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.result?.tools) return parsed.result.tools;
                    } catch {}
                }
            }
        }
        return [];
    }

    rawText = await response.text();
    const result = JSON.parse(rawText);
    return result?.result?.tools || [];
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
    listTools,
    searchMeetings,
    getDocument,
    getMultipleDocuments,
    listActionItems,
    listUpcomingMeetings,
    listActivities
};
