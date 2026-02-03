/**
 * Krisp MCP Bridge
 * Handles communication with Krisp MCP and imports meetings into GodMode
 * 
 * Note: The MCP requires OAuth2 authentication which is handled by Cursor.
 * This bridge provides utilities to process meeting data received from the frontend.
 */

const { getAdminClient } = require('../supabase/client');
const { processTranscript } = require('./TranscriptProcessor');

/**
 * Check which meetings have already been imported
 * @param {string} userId - User ID
 * @param {string[]} meetingIds - Array of Krisp meeting IDs (32-char hex)
 * @returns {Promise<Set<string>>} Set of already imported meeting IDs
 */
async function getImportedMeetingIds(userId, meetingIds) {
    const supabase = getAdminClient();
    if (!supabase || !meetingIds.length) return new Set();

    try {
        const { data } = await supabase
            .from('krisp_transcripts')
            .select('krisp_meeting_id')
            .eq('user_id', userId)
            .in('krisp_meeting_id', meetingIds);

        return new Set((data || []).map(t => t.krisp_meeting_id));
    } catch (error) {
        console.error('[McpBridge] Error checking imported meetings:', error);
        return new Set();
    }
}

/**
 * Check if a meeting has already been imported
 * @param {string} userId - User ID
 * @param {string} meetingId - Krisp meeting ID
 * @returns {Promise<boolean>}
 */
async function isMeetingImported(userId, meetingId) {
    const imported = await getImportedMeetingIds(userId, [meetingId]);
    return imported.has(meetingId);
}

/**
 * Import a meeting from Krisp MCP data
 * @param {string} userId - User ID
 * @param {Object} meetingData - Meeting data from MCP get_document
 * @param {Object} options - Import options
 * @returns {Promise<{success: boolean, transcriptId?: string, error?: string}>}
 */
async function importMeeting(userId, meetingData, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { skipDuplicateCheck = false, forceReimport = false } = options;

    try {
        const meetingId = meetingData.meeting_id || meetingData.id;
        
        if (!meetingId) {
            return { success: false, error: 'Missing meeting ID' };
        }

        // Check for duplicate unless skipped
        if (!skipDuplicateCheck && !forceReimport) {
            const alreadyImported = await isMeetingImported(userId, meetingId);
            if (alreadyImported) {
                return { success: false, error: 'Meeting already imported', duplicate: true };
            }
        }

        // If force reimport, delete existing record first
        if (forceReimport) {
            await supabase
                .from('krisp_transcripts')
                .delete()
                .eq('user_id', userId)
                .eq('krisp_meeting_id', meetingId);
        }

        // Extract meeting data
        const transcript = extractTranscriptData(meetingData);

        // Create transcript record
        const { data: created, error: createError } = await supabase
            .from('krisp_transcripts')
            .insert({
                user_id: userId,
                krisp_meeting_id: meetingId,
                event_type: 'mcp_import',
                krisp_title: transcript.title,
                meeting_date: transcript.date,
                duration_minutes: transcript.duration,
                speakers: transcript.speakers,
                transcript_text: transcript.text,
                key_points: transcript.keyPoints,
                action_items: transcript.actionItems,
                notes: transcript.notes,
                status: 'pending',
                raw_payload: meetingData
            })
            .select()
            .single();

        if (createError) {
            console.error('[McpBridge] Error creating transcript:', createError);
            return { success: false, error: createError.message };
        }

        // Process the transcript (speaker matching, project identification)
        const processResult = await processTranscript(created.id);

        return {
            success: true,
            transcriptId: created.id,
            status: processResult.success ? 'processed' : 'pending',
            processResult
        };

    } catch (error) {
        console.error('[McpBridge] Import error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Import multiple meetings
 * @param {string} userId - User ID
 * @param {Object[]} meetingsData - Array of meeting data from MCP
 * @param {Object} options - Import options
 * @returns {Promise<{success: boolean, results: Object[], imported: number, skipped: number, failed: number}>}
 */
async function importMeetings(userId, meetingsData, options = {}) {
    const results = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const meeting of meetingsData) {
        const result = await importMeeting(userId, meeting, options);
        results.push({
            meetingId: meeting.meeting_id || meeting.id,
            title: meeting.name || meeting.title,
            ...result
        });

        if (result.success) {
            imported++;
        } else if (result.duplicate) {
            skipped++;
        } else {
            failed++;
        }
    }

    return {
        success: failed === 0,
        results,
        imported,
        skipped,
        failed
    };
}

/**
 * Extract transcript data from MCP document response
 * @param {Object} doc - Document from get_document
 * @returns {Object} Normalized transcript data
 */
function extractTranscriptData(doc) {
    // Handle different response formats from Krisp MCP
    const meetingNotes = doc.meeting_notes || {};
    
    return {
        title: doc.name || doc.title || 'Untitled Meeting',
        date: doc.date || doc.meeting_date || new Date().toISOString(),
        duration: parseDuration(doc.duration),
        speakers: extractSpeakers(doc),
        text: extractTranscriptText(doc),
        keyPoints: meetingNotes.key_points || doc.key_points || [],
        actionItems: extractActionItems(doc),
        notes: meetingNotes.detailed_summary || doc.summary || null
    };
}

/**
 * Extract speakers from document
 */
function extractSpeakers(doc) {
    if (Array.isArray(doc.speakers)) {
        return doc.speakers.map(s => typeof s === 'string' ? s : s.name || s.speaker_name);
    }
    if (Array.isArray(doc.attendees)) {
        return doc.attendees.map(a => typeof a === 'string' ? a : a.name || a.attendee_name);
    }
    return [];
}

/**
 * Extract transcript text from document
 */
function extractTranscriptText(doc) {
    // Try different possible locations for transcript
    if (typeof doc.transcript === 'string') {
        return doc.transcript;
    }
    if (doc.transcript?.text) {
        return doc.transcript.text;
    }
    if (doc.transcript?.content) {
        return doc.transcript.content;
    }
    if (Array.isArray(doc.transcript?.segments)) {
        return doc.transcript.segments
            .map(s => `${s.speaker || 'Speaker'}: ${s.text}`)
            .join('\n');
    }
    return null;
}

/**
 * Extract action items from document
 */
function extractActionItems(doc) {
    const items = doc.action_items || doc.meeting_notes?.action_items || [];
    
    return items.map(item => {
        if (typeof item === 'string') return item;
        return item.text || item.description || item.content || JSON.stringify(item);
    });
}

/**
 * Parse duration to minutes
 */
function parseDuration(duration) {
    if (!duration) return null;
    if (typeof duration === 'number') return duration;
    
    // Parse string formats like "1h 30m", "90 minutes", etc.
    const str = String(duration).toLowerCase();
    let minutes = 0;
    
    const hoursMatch = str.match(/(\d+)\s*h/);
    const minutesMatch = str.match(/(\d+)\s*m/);
    
    if (hoursMatch) minutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) minutes += parseInt(minutesMatch[1]);
    
    return minutes || null;
}

/**
 * Get import history for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>}
 */
async function getImportHistory(userId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) return [];

    const { limit = 50, offset = 0 } = options;

    const { data } = await supabase
        .from('krisp_transcripts')
        .select('id, krisp_meeting_id, krisp_title, meeting_date, status, created_at')
        .eq('user_id', userId)
        .eq('event_type', 'mcp_import')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    return data || [];
}

module.exports = {
    getImportedMeetingIds,
    isMeetingImported,
    importMeeting,
    importMeetings,
    extractTranscriptData,
    getImportHistory
};
