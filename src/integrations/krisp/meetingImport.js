/**
 * Purpose:
 *   Imports Krisp meetings as transcript documents. Handles fetching
 *   meeting data from MCP, converting to text, creating document entries,
 *   downloading audio, uploading to Google Drive, and queuing for
 *   AI processing.
 *
 * Responsibilities:
 *   - List available meetings from Krisp MCP with per-project import tracking
 *   - Convert MCP meeting data to transcript text (speaker-attributed)
 *   - Create transcript documents (doc_type='transcript') in the documents table
 *   - Download audio from Krisp S3, upload to Google Drive, create audio document
 *   - Cross-link transcript and audio documents via metadata
 *   - Support multi-project import (same meeting to different projects)
 *
 * Key dependencies:
 *   - ./mcpClient: Krisp MCP API calls
 *   - ../../integrations/googleDrive/drive: Google Drive upload
 *   - ../../supabase/client: Supabase admin client
 *   - ../../supabase/projects: project settings
 *   - ../../logger: structured logging
 *
 * Side effects:
 *   - Creates documents rows in Supabase
 *   - Uploads files to Google Drive
 *   - Downloads audio to local filesystem (fallback)
 *   - Queues documents for AI processing via llm-queue
 *
 * Notes:
 *   - Audio S3 URLs expire after ~7 days; must download during import
 *   - Each project gets independent copies of transcript + audio
 *   - Dedup within a project via documents.metadata->>'krisp_meeting_id' + project_id
 */

const crypto = require('crypto');
const path = require('path');
const { logger } = require('../../logger');
const mcpClient = require('./mcpClient');
const { getAdminClient } = require('../../supabase/client');

const log = logger.child({ module: 'krisp-meeting-import' });

/**
 * Get available meetings from Krisp MCP with per-project import status.
 * @param {string} userId
 * @param {object} params - { after?, before?, search?, limit? }
 * @returns {Promise<{ meetings: Array, total: number }>}
 */
async function getAvailableMeetings(userId, params = {}) {
    const fields = ['name', 'date', 'speakers', 'attendees', 'meeting_notes', 'action_items'];
    const searchParams = {
        limit: params.limit || 20,
        offset: params.offset || 0,
        fields
    };
    if (params.search) searchParams.search = params.search;
    if (params.after) {
        searchParams.after = params.after;
    } else if (!params.search) {
        // Krisp MCP requires at least one filter; default to last 90 days
        const d = new Date();
        d.setDate(d.getDate() - 90);
        searchParams.after = d.toISOString().split('T')[0];
    }
    if (params.before) searchParams.before = params.before;

    log.info({ event: 'krisp_meetings_fetch', userId, params: searchParams }, 'Fetching meetings from MCP');

    const result = await mcpClient.searchMeetings(userId, searchParams);

    log.debug({ event: 'krisp_meetings_result', resultType: typeof result, isArray: Array.isArray(result), keys: result ? Object.keys(result) : [] }, 'MCP search result');

    const meetings = Array.isArray(result) ? result : (result?.meetings || result?.results || []);
    if (meetings.length === 0) return { meetings: [], total: 0 };

    // Check import status per project
    const supabase = getAdminClient();
    const meetingIds = meetings.map(m => m.meeting_id);

    const { data: existing } = await supabase
        .from('documents')
        .select('metadata, project_id, projects(name)')
        .eq('doc_type', 'transcript')
        .not('metadata', 'is', null)
        .filter('metadata->>krisp_meeting_id', 'in', `(${meetingIds.join(',')})`)
        .filter('metadata->>is_audio', 'is', null);

    const importMap = {};
    for (const row of existing || []) {
        const mid = row.metadata?.krisp_meeting_id;
        if (!mid) continue;
        if (!importMap[mid]) importMap[mid] = [];
        if (!importMap[mid].find(p => p.projectId === row.project_id)) {
            importMap[mid].push({
                projectId: row.project_id,
                projectName: row.projects?.name || 'Unknown'
            });
        }
    }

    const enriched = meetings.map(m => {
        const notes = m.meeting_notes || {};

        return {
            meeting_id: m.meeting_id,
            name: m.name || 'Untitled Meeting',
            date: m.date,
            speakers: m.speakers || [],
            attendees: m.attendees || [],
            detailed_summary: notes.detailed_summary || [],
            key_points: notes.key_points || [],
            action_items: notes.action_items || [],
            importedTo: importMap[m.meeting_id] || [],
            isImported: !!(importMap[m.meeting_id]?.length)
        };
    });

    return { meetings: enriched, total: enriched.length };
}

/**
 * Import a single meeting as a transcript document.
 * Creates transcript doc + optional audio doc, both under projectId.
 * @param {string} userId
 * @param {string} meetingId - 32-char Krisp meeting ID
 * @param {string} projectId - Target project UUID
 * @param {object} [options] - { transcript, keyPoints, actionItems, outline, audio } — all default true
 * @returns {Promise<{ success: boolean, transcriptDocId?: string, audioDocId?: string, error?: string }>}
 */
async function importMeeting(userId, meetingId, projectId, options = {}) {
    const opts = {
        transcript: options.transcript !== false,
        keyPoints: options.keyPoints !== false,
        actionItems: options.actionItems !== false,
        outline: options.outline !== false,
        audio: options.audio !== false
    };

    const supabase = getAdminClient();

    // Check if already imported to this project
    const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('project_id', projectId)
        .eq('doc_type', 'transcript')
        .not('metadata', 'is', null)
        .filter('metadata->>krisp_meeting_id', 'eq', meetingId)
        .filter('metadata->>is_audio', 'is', null)
        .limit(1);

    if (existing && existing.length > 0) {
        return { success: false, error: 'Meeting already imported to this project' };
    }

    // Fetch full document from Krisp MCP
    let fullDoc;
    try {
        fullDoc = await mcpClient.getDocument(userId, meetingId);
    } catch (err) {
        log.warn({ event: 'krisp_import_fetch_failed', meetingId, reason: err.message }, 'Failed to fetch from MCP');
        return { success: false, error: `Failed to fetch meeting: ${err.message}` };
    }

    // Also get meeting metadata for title/speakers/notes
    let meetingMeta;
    try {
        const searchResult = await mcpClient.searchMeetings(userId, {
            id: meetingId,
            fields: ['name', 'date', 'speakers', 'attendees', 'meeting_notes', 'action_items']
        });
        meetingMeta = Array.isArray(searchResult) ? searchResult[0] : searchResult;
    } catch {
        meetingMeta = {};
    }

    const meetingName = meetingMeta?.name || 'Krisp Meeting';
    const meetingDate = meetingMeta?.date || new Date().toISOString();
    const speakers = meetingMeta?.speakers || [];
    const notes = meetingMeta?.meeting_notes || {};

    // Build content based on import options
    const sections = [];

    if (opts.transcript) {
        const transcriptText = convertDocumentToText(fullDoc, meetingName, speakers);
        if (transcriptText && transcriptText.length > 10) {
            sections.push(transcriptText);
        }
    }

    if (opts.outline && notes.detailed_summary?.length) {
        sections.push('\n\n## Meeting Outline\n');
        for (const s of notes.detailed_summary) {
            sections.push(`### ${s.title}\n${s.description}\n`);
        }
    }

    if (opts.keyPoints && notes.key_points?.length) {
        sections.push('\n\n## Key Points\n');
        for (const kp of notes.key_points) {
            sections.push(`- ${kp}`);
        }
    }

    if (opts.actionItems && notes.action_items?.length) {
        sections.push('\n\n## Action Items\n');
        for (const ai of notes.action_items) {
            const check = ai.completed ? '[x]' : '[ ]';
            const assignee = ai.assignee ? ` (${ai.assignee})` : '';
            sections.push(`- ${check} ${ai.title}${assignee}`);
        }
    }

    const content = sections.join('\n');
    if (!content || content.length < 10) {
        return { success: false, error: 'No content selected or available for import' };
    }

    const summary = extractSummary(fullDoc, meetingMeta);

    const fileHash = crypto.createHash('md5').update(content + meetingId + projectId).digest('hex');
    const safeTitle = sanitizeFilename(meetingName);

    const { data: transcriptDoc, error: insertErr } = await supabase
        .from('documents')
        .insert({
            project_id: projectId,
            uploaded_by: userId,
            title: meetingName,
            filename: `${safeTitle}.txt`,
            filepath: 'krisp-mcp-import',
            file_hash: fileHash,
            file_type: 'transcript',
            file_size: content.length,
            content,
            summary,
            doc_type: 'transcript',
            status: 'pending',
            document_date: meetingDate.split('T')[0] || null,
            metadata: {
                krisp_meeting_id: meetingId,
                source: 'krisp-mcp',
                speakers,
                import_options: opts,
                imported_at: new Date().toISOString(),
                imported_by: userId
            }
        })
        .select('id')
        .single();

    if (insertErr) {
        log.warn({ event: 'krisp_import_insert_failed', reason: insertErr.message }, 'Document insert failed');
        return { success: false, error: insertErr.message };
    }

    // Queue for AI processing
    try {
        const { queueDocumentProcessing } = require('../../supabase/llm-queue');
        if (typeof queueDocumentProcessing === 'function') {
            await queueDocumentProcessing(transcriptDoc.id, projectId, userId);
        }
    } catch (e) {
        log.warn({ event: 'krisp_import_queue_failed', reason: e.message }, 'Could not queue for processing');
    }

    // Import audio
    let audioDocId = null;
    if (opts.audio) {
        const audioUrl = extractAudioUrl(typeof fullDoc === 'string' ? fullDoc : JSON.stringify(fullDoc));
        if (audioUrl) {
            try {
                audioDocId = await importAudio(userId, meetingId, audioUrl, meetingName, projectId);
                if (audioDocId) {
                    await supabase.from('documents')
                        .update({
                            metadata: {
                                ...((await supabase.from('documents').select('metadata').eq('id', transcriptDoc.id).single()).data?.metadata || {}),
                                audio_document_id: audioDocId
                            }
                        })
                        .eq('id', transcriptDoc.id);
                }
            } catch (audioErr) {
                log.warn({ event: 'krisp_import_audio_failed', reason: audioErr.message }, 'Audio import failed (non-fatal)');
            }
        }
    }

    log.info({
        event: 'krisp_import_success',
        meetingId,
        projectId,
        transcriptDocId: transcriptDoc.id,
        audioDocId,
        importOptions: opts,
        contentLength: content.length
    }, 'Meeting imported');

    return {
        success: true,
        transcriptDocId: transcriptDoc.id,
        audioDocId,
        title: meetingName
    };
}

/**
 * Import multiple meetings to a project.
 * @param {object} [importOptions] - { transcript, keyPoints, actionItems, outline, audio }
 */
async function importMeetingsBatch(userId, meetingIds, projectId, importOptions = {}) {
    const results = [];
    for (const meetingId of meetingIds) {
        try {
            const result = await importMeeting(userId, meetingId, projectId, importOptions);
            results.push({ meetingId, ...result });
        } catch (err) {
            results.push({ meetingId, success: false, error: err.message });
        }
    }
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    return { results, succeeded, failed, total: meetingIds.length };
}

// ── Audio Import ────────────────────────────────────────────────────────────

/**
 * Download audio from Krisp S3 and upload to Google Drive (or local fallback).
 * Creates a documents entry for the audio file.
 * @returns {Promise<string|null>} Audio document ID or null
 */
async function importAudio(userId, meetingId, audioUrl, meetingTitle, projectId) {
    const supabase = getAdminClient();

    // Download audio to buffer
    const audioBuffer = await downloadToBuffer(audioUrl);
    if (!audioBuffer || audioBuffer.length === 0) {
        log.warn({ event: 'krisp_audio_empty', meetingId }, 'Audio download returned empty');
        return null;
    }

    const filename = `krisp-${meetingId.substring(0, 8)}-recording.mp3`;
    let filepath;
    let webViewLink = null;

    // Try Google Drive upload
    try {
        const drive = require('../googleDrive/drive');
        const projectsSupabase = require('../../supabase/projects');

        const driveClient = await drive.getDriveClientForSystem();
        if (driveClient && driveClient.drive) {
            const { data: project } = await projectsSupabase.getProject(projectId);
            const uploadsFolderId = project?.settings?.googleDrive?.folders?.uploads;

            if (uploadsFolderId) {
                const result = await drive.uploadFile(
                    driveClient, audioBuffer, 'audio/mpeg', uploadsFolderId, filename
                );
                filepath = `gdrive:${result.id}`;
                webViewLink = result.webViewLink;
                log.debug({ event: 'krisp_audio_drive_uploaded', fileId: result.id }, 'Audio uploaded to Drive');
            }
        }
    } catch (driveErr) {
        log.warn({ event: 'krisp_audio_drive_failed', reason: driveErr.message }, 'Drive upload failed, using local');
    }

    // Fallback to local storage
    if (!filepath) {
        const fs = require('fs').promises;
        const audioDir = path.join(process.cwd(), 'data', 'krisp-audio');
        await fs.mkdir(audioDir, { recursive: true });
        const localPath = path.join(audioDir, filename);
        await fs.writeFile(localPath, audioBuffer);
        filepath = localPath;
    }

    const hash = crypto.createHash('md5').update(audioBuffer).digest('hex');

    const { data: audioDoc, error } = await supabase
        .from('documents')
        .insert({
            project_id: projectId,
            uploaded_by: userId,
            title: `Recording: ${meetingTitle}`,
            filename,
            filepath,
            file_hash: hash,
            file_type: 'mp3',
            file_size: audioBuffer.length,
            doc_type: 'transcript',
            status: 'completed',
            metadata: {
                krisp_meeting_id: meetingId,
                source: 'krisp-mcp',
                is_audio: true,
                drive_web_link: webViewLink,
                imported_at: new Date().toISOString()
            }
        })
        .select('id')
        .single();

    if (error) {
        log.warn({ event: 'krisp_audio_doc_failed', reason: error.message }, 'Audio document insert failed');
        return null;
    }

    return audioDoc.id;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a Krisp MCP get_document response into speaker-attributed text.
 */
function convertDocumentToText(doc, meetingName, speakers) {
    const content = typeof doc === 'string' ? doc : (doc?.document || doc?.content || '');
    if (!content) return '';

    // The content from get_document is usually already formatted as:
    //   Speaker Name: message text
    // We just clean it up and return
    const lines = content.split('\n');
    const outputLines = [];
    let inTranscript = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (inTranscript) outputLines.push('');
            continue;
        }

        // Skip headers/metadata lines
        if (trimmed.startsWith('[Transcript of') || trimmed.startsWith('Speakers:') || trimmed.startsWith('---')) {
            inTranscript = true;
            continue;
        }

        // Speaker-attributed line: "Name: text" or "Name (HH:MM): text"
        if (/^[A-Za-z\s]+(\s\(\d{2}:\d{2}\))?:\s/.test(trimmed)) {
            inTranscript = true;
            outputLines.push(trimmed);
            continue;
        }

        // Continuation lines
        if (inTranscript) {
            outputLines.push(trimmed);
        }
    }

    // If we didn't find structured transcript, use full content
    if (outputLines.filter(l => l.length > 0).length < 3) {
        return content;
    }

    return outputLines.join('\n').trim();
}

/**
 * Extract summary from meeting data.
 */
function extractSummary(doc, meta) {
    if (meta?.meeting_notes?.detailed_summary) return meta.meeting_notes.detailed_summary;

    const keyPoints = meta?.meeting_notes?.key_points;
    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
        return keyPoints.slice(0, 3).join(' ').substring(0, 500);
    }

    const content = typeof doc === 'string' ? doc : '';
    if (content.length > 100) {
        return content.substring(0, 300) + '...';
    }

    return null;
}

/**
 * Extract audio URL from transcript content.
 * Reuses patterns from AvailableMeetings.extractAudioUrl.
 */
function extractAudioUrl(content) {
    if (!content) return null;

    const urlMatch = content.match(/\[Download Recording\]\(<([^>]+)>\)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];

    const directMatch = content.match(/(https:\/\/kr-files-cdn\.s3\.amazonaws\.com\/recording\/[^\s\)]+)/);
    if (directMatch && directMatch[1]) return directMatch[1];

    return null;
}

/**
 * Download a URL to a buffer.
 */
async function downloadToBuffer(url) {
    const https = require('https');
    const http = require('http');
    const mod = url.startsWith('https') ? https : http;

    return new Promise((resolve) => {
        mod.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadToBuffer(response.headers.location).then(resolve);
                return;
            }
            if (response.statusCode !== 200) {
                resolve(null);
                return;
            }
            const chunks = [];
            let size = 0;
            const maxSize = 100 * 1024 * 1024; // 100MB limit
            response.on('data', (chunk) => {
                size += chunk.length;
                if (size > maxSize) {
                    response.destroy();
                    resolve(null);
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    });
}

function sanitizeFilename(name) {
    if (!name) return 'krisp-meeting';
    return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-').substring(0, 80) || 'krisp-meeting';
}

/**
 * Fetch a meeting's full transcript preview and audio URL without importing.
 * Used for the expanded preview in the UI.
 */
async function getMeetingPreview(userId, meetingId) {
    let fullDoc;
    try {
        fullDoc = await mcpClient.getDocument(userId, meetingId);
    } catch (err) {
        log.warn({ event: 'krisp_preview_fetch_failed', meetingId, reason: err.message }, 'Preview fetch failed');
        return { transcript: null, audioUrl: null, error: err.message };
    }

    const content = typeof fullDoc === 'string' ? fullDoc : (fullDoc?.document || fullDoc?.content || '');
    const transcript = convertDocumentToText(fullDoc, '', []) || content;
    const audioUrl = extractAudioUrl(content);

    return {
        transcript: transcript || null,
        audioUrl: audioUrl || null
    };
}

module.exports = {
    getAvailableMeetings,
    getMeetingPreview,
    importMeeting,
    importMeetingsBatch,
    importAudio,
    convertDocumentToText,
    extractAudioUrl,
    extractSummary
};
