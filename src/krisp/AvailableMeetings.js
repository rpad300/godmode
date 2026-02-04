/**
 * Krisp Available Meetings Service
 * Manages the catalog of meetings fetched from Krisp MCP
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Sync meetings from MCP to the available_meetings catalog
 * Called by Cursor agent after fetching from Krisp MCP
 * 
 * @param {string} userId - The user ID
 * @param {Array} meetings - Array of meeting objects from Krisp MCP
 * @returns {Promise<{success: boolean, synced: number, errors: number}>}
 */
async function syncMeetingsFromMcp(userId, meetings) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    let synced = 0;
    let errors = 0;

    for (const meeting of meetings) {
        try {
            // Extract data from Krisp MCP format
            const meetingData = {
                p_user_id: userId,
                p_krisp_meeting_id: meeting.meeting_id,
                p_meeting_name: meeting.name || 'Untitled Meeting',
                p_meeting_date: meeting.date,
                p_meeting_url: meeting.url || null,
                p_is_recurring: meeting.is_recurring || false,
                p_attendees: JSON.stringify(meeting.attendees || []),
                p_speakers: JSON.stringify(meeting.speakers || []),
                p_key_points: JSON.stringify(extractKeyPoints(meeting)),
                p_action_items: JSON.stringify(extractActionItems(meeting)),
                p_summary: extractSummary(meeting),
                p_raw_data: JSON.stringify(meeting)
            };

            const { data, error } = await supabase.rpc('upsert_krisp_available_meeting', meetingData);

            if (error) {
                console.error(`[AvailableMeetings] Error syncing meeting ${meeting.meeting_id}:`, error);
                errors++;
            } else {
                synced++;
            }
        } catch (err) {
            console.error(`[AvailableMeetings] Exception syncing meeting:`, err);
            errors++;
        }
    }

    console.log(`[AvailableMeetings] Sync complete: ${synced} synced, ${errors} errors`);

    return { success: errors === 0, synced, errors };
}

/**
 * Get available meetings for a user
 * 
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @returns {Promise<{meetings: Array, stats: Object}>}
 */
async function getAvailableMeetings(userId, options = {}) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const {
        limit = 50,
        offset = 0,
        showImported = true,
        startDate = null,
        endDate = null,
        search = null
    } = options;

    // Build query
    let query = supabase
        .from('krisp_available_meetings')
        .select('*')
        .eq('user_id', userId)
        .order('meeting_date', { ascending: false });

    // Filter by import status
    if (!showImported) {
        query = query.eq('is_imported', false);
    }

    // Filter by date range
    if (startDate) {
        query = query.gte('meeting_date', startDate);
    }
    if (endDate) {
        query = query.lte('meeting_date', endDate);
    }

    // Search filter
    if (search) {
        query = query.or(`meeting_name.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: meetings, error } = await query;

    if (error) {
        console.error('[AvailableMeetings] Error fetching meetings:', error);
        throw error;
    }

    // Get stats
    const { data: statsData } = await supabase.rpc('get_krisp_import_stats', { p_user_id: userId });
    const stats = statsData || {
        total_available: 0,
        total_imported: 0,
        total_pending: 0,
        oldest_meeting: null,
        newest_meeting: null,
        last_sync: null
    };

    return { meetings: meetings || [], stats };
}

/**
 * Import selected meetings to krisp_transcripts
 * 
 * @param {string} userId - The user ID
 * @param {Array<string>} meetingIds - Array of krisp_meeting_ids to import
 * @returns {Promise<{success: boolean, imported: number, errors: Array}>}
 */
async function importSelectedMeetings(userId, meetingIds) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const TranscriptProcessor = require('./TranscriptProcessor');
    
    let imported = 0;
    const errors = [];

    for (const krispMeetingId of meetingIds) {
        try {
            // Get the available meeting data
            const { data: meeting, error: fetchError } = await supabase
                .from('krisp_available_meetings')
                .select('*')
                .eq('user_id', userId)
                .eq('krisp_meeting_id', krispMeetingId)
                .single();

            if (fetchError || !meeting) {
                errors.push({ meetingId: krispMeetingId, error: 'Meeting not found' });
                continue;
            }

            if (meeting.is_imported) {
                errors.push({ meetingId: krispMeetingId, error: 'Already imported' });
                continue;
            }

            // Check if already exists in krisp_transcripts
            const { data: existing } = await supabase
                .from('krisp_transcripts')
                .select('id')
                .eq('user_id', userId)
                .eq('krisp_meeting_id', krispMeetingId)
                .single();

            if (existing) {
                // Already imported, just mark it
                await supabase.rpc('mark_krisp_meeting_imported', {
                    p_user_id: userId,
                    p_krisp_meeting_id: krispMeetingId,
                    p_transcript_id: existing.id
                });
                imported++;
                continue;
            }

            // Create transcript from available meeting data
            const transcriptData = {
                user_id: userId,
                krisp_meeting_id: krispMeetingId,
                meeting_title: meeting.meeting_name,
                meeting_date: meeting.meeting_date,
                speakers: meeting.speakers || [],
                transcript_text: meeting.summary || '',
                key_points: meeting.key_points || [],
                action_items: meeting.action_items || [],
                raw_payload: meeting.raw_data,
                status: 'pending',
                source: 'mcp_import'
            };

            const { data: transcript, error: insertError } = await supabase
                .from('krisp_transcripts')
                .insert(transcriptData)
                .select()
                .single();

            if (insertError) {
                errors.push({ meetingId: krispMeetingId, error: insertError.message });
                continue;
            }

            // Mark as imported
            await supabase.rpc('mark_krisp_meeting_imported', {
                p_user_id: userId,
                p_krisp_meeting_id: krispMeetingId,
                p_transcript_id: transcript.id
            });

            // Process the transcript (speaker matching, project assignment, etc.)
            try {
                await TranscriptProcessor.processTranscript(transcript.id, userId);
            } catch (processError) {
                console.error(`[AvailableMeetings] Processing error for ${krispMeetingId}:`, processError);
                // Don't fail the import, just log
            }

            imported++;
            console.log(`[AvailableMeetings] Imported meeting: ${krispMeetingId}`);

        } catch (err) {
            console.error(`[AvailableMeetings] Exception importing meeting ${krispMeetingId}:`, err);
            errors.push({ meetingId: krispMeetingId, error: err.message });
        }
    }

    return { success: errors.length === 0, imported, errors };
}

/**
 * Check which meetings are already imported
 * 
 * @param {string} userId - The user ID
 * @param {Array<string>} meetingIds - Array of krisp_meeting_ids to check
 * @returns {Promise<Array<string>>} - Array of already imported meeting IDs
 */
async function getImportedMeetingIds(userId, meetingIds) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
        .from('krisp_available_meetings')
        .select('krisp_meeting_id')
        .eq('user_id', userId)
        .eq('is_imported', true)
        .in('krisp_meeting_id', meetingIds);

    if (error) {
        console.error('[AvailableMeetings] Error checking imported:', error);
        return [];
    }

    return (data || []).map(m => m.krisp_meeting_id);
}

/**
 * Get sync statistics
 */
async function getSyncStats(userId) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase.rpc('get_krisp_import_stats', { p_user_id: userId });

    if (error) {
        console.error('[AvailableMeetings] Error getting stats:', error);
        return null;
    }

    return data;
}

// ============================================================================
// Helper functions to extract data from Krisp MCP format
// ============================================================================

function extractKeyPoints(meeting) {
    if (meeting.meeting_notes?.key_points) {
        return meeting.meeting_notes.key_points;
    }
    if (meeting.key_points) {
        return meeting.key_points;
    }
    return [];
}

function extractActionItems(meeting) {
    if (meeting.meeting_notes?.action_items) {
        return meeting.meeting_notes.action_items;
    }
    if (meeting.action_items) {
        return meeting.action_items;
    }
    return [];
}

function extractSummary(meeting) {
    if (meeting.meeting_notes?.detailed_summary) {
        return meeting.meeting_notes.detailed_summary;
    }
    if (meeting.detailed_summary) {
        return meeting.detailed_summary;
    }
    // Create summary from key points if no detailed summary
    const keyPoints = extractKeyPoints(meeting);
    if (keyPoints.length > 0) {
        return keyPoints.slice(0, 3).join('\n\n');
    }
    return null;
}

module.exports = {
    syncMeetingsFromMcp,
    getAvailableMeetings,
    importSelectedMeetings,
    getImportedMeetingIds,
    getSyncStats
};
