/**
 * Krisp Available Meetings Service
 * Manages the catalog of meetings fetched from Krisp MCP
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Sync meetings from MCP to the available_meetings catalog
 * Called by Cursor agent after fetching from Krisp MCP
 * 
 * Now supports full_transcript - if provided, stores it directly.
 * The sync will UPDATE existing meetings if data changed in Krisp.
 * 
 * @param {string} userId - The user ID
 * @param {Array} meetings - Array of meeting objects from Krisp MCP
 * @returns {Promise<{success: boolean, synced: number, updated: number, errors: number}>}
 */
async function syncMeetingsFromMcp(userId, meetings) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const meeting of meetings) {
        try {
            // Check if meeting already exists
            const { data: existing } = await supabase
                .from('krisp_available_meetings')
                .select('id, meeting_name, full_transcript')
                .eq('krisp_meeting_id', meeting.meeting_id)
                .maybeSingle();

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
                p_raw_data: JSON.stringify(meeting),
                // Include full_transcript if provided (from get_document MCP call)
                p_full_transcript: meeting.full_transcript || null
            };

            const { data, error } = await supabase.rpc('upsert_krisp_available_meeting', meetingData);

            if (error) {
                console.error(`[AvailableMeetings] Error syncing meeting ${meeting.meeting_id}:`, error);
                errors++;
            } else {
                if (existing) {
                    updated++;
                    console.log(`[AvailableMeetings] Updated existing meeting: ${meeting.name}`);
                } else {
                    synced++;
                }
            }
        } catch (err) {
            console.error(`[AvailableMeetings] Exception syncing meeting:`, err);
            errors++;
        }
    }

    console.log(`[AvailableMeetings] Sync complete: ${synced} new, ${updated} updated, ${errors} errors`);

    return { success: errors === 0, synced, updated, errors };
}

/**
 * Get meetings that need full transcript fetch
 * These are meetings synced via search_meetings but missing the full transcript
 * 
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of meetings to return
 * @returns {Promise<Array>} - Meetings needing transcript
 */
async function getMeetingsNeedingTranscript(userId, limit = 10) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    // Check if user is superadmin
    const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    const isSuperadmin = userProfile?.role === 'superadmin';

    let query = supabase
        .from('krisp_available_meetings')
        .select('id, krisp_meeting_id, meeting_name, meeting_date')
        .eq('needs_full_transcript', true)
        .eq('is_imported', false)
        .order('meeting_date', { ascending: false })
        .limit(limit);
    
    // Only filter by user_id if not superadmin
    if (!isSuperadmin) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[AvailableMeetings] Error fetching meetings needing transcript:', error);
        return [];
    }

    return data || [];
}

/**
 * Get available meetings for a user
 * Superadmins can see all meetings
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

    // Check if user is superadmin
    const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    const isSuperadmin = userProfile?.role === 'superadmin';

    // Build query
    let query = supabase
        .from('krisp_available_meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

    // Only filter by user_id if not superadmin
    if (!isSuperadmin) {
        query = query.eq('user_id', userId);
    }

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

    // Get stats - for superadmin, get global stats
    let statsData;
    if (isSuperadmin) {
        // Get global stats for superadmin
        const { data: totalData } = await supabase
            .from('krisp_available_meetings')
            .select('id, is_imported, last_synced_at', { count: 'exact' });
        
        const totalAvailable = totalData?.length || 0;
        const totalImported = totalData?.filter(m => m.is_imported).length || 0;
        const lastSync = totalData?.reduce((max, m) => {
            if (!m.last_synced_at) return max;
            return !max || new Date(m.last_synced_at) > new Date(max) ? m.last_synced_at : max;
        }, null);
        
        statsData = {
            total_available: totalAvailable,
            total_imported: totalImported,
            total_pending: totalAvailable - totalImported,
            last_sync: lastSync
        };
    } else {
        const { data } = await supabase.rpc('get_krisp_import_stats', { p_user_id: userId });
        statsData = data;
    }
    
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
 * @param {string} projectId - Optional project ID to assign meetings to
 * @returns {Promise<{success: boolean, imported: number, errors: Array}>}
 */
async function importSelectedMeetings(userId, meetingIds, projectId = null) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const TranscriptProcessor = require('./TranscriptProcessor');
    
    // Check if user is superadmin
    const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    const isSuperadmin = userProfile?.role === 'superadmin';
    
    let imported = 0;
    const errors = [];

    for (const krispMeetingId of meetingIds) {
        try {
            // Get the available meeting data
            // Superadmins can import any meeting
            let query = supabase
                .from('krisp_available_meetings')
                .select('*')
                .eq('krisp_meeting_id', krispMeetingId);
            
            if (!isSuperadmin) {
                query = query.eq('user_id', userId);
            }
            
            const { data: meeting, error: fetchError } = await query.single();

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
                // Already imported, just mark it using the meeting's user_id
                await supabase.rpc('mark_krisp_meeting_imported', {
                    p_user_id: meeting.user_id,
                    p_krisp_meeting_id: krispMeetingId,
                    p_transcript_id: existing.id
                });
                imported++;
                continue;
            }

            // Create transcript from available meeting data
            // Parse JSON fields if they're strings
            const speakersData = parseJsonField(meeting.speakers);
            const keyPointsData = parseJsonField(meeting.key_points);
            const actionItemsData = parseJsonField(meeting.action_items);
            
            // Use full_transcript from get_document if available, otherwise build from key_points
            let transcriptText;
            if (meeting.full_transcript && meeting.full_transcript.length > 0) {
                // Full transcript from MCP get_document call
                transcriptText = meeting.full_transcript;
                console.log(`[AvailableMeetings] Using full transcript (${transcriptText.length} chars) for ${krispMeetingId}`);
            } else {
                // Fallback: build from key_points and action_items
                transcriptText = buildTranscriptText({
                    title: meeting.meeting_name,
                    date: meeting.meeting_date,
                    speakers: speakersData,
                    keyPoints: keyPointsData,
                    actionItems: actionItemsData,
                    summary: meeting.summary,
                    rawData: meeting.raw_data
                });
                console.log(`[AvailableMeetings] Built transcript from key_points (${transcriptText.length} chars) for ${krispMeetingId}`);
            }
            
            const transcriptData = {
                user_id: userId,
                krisp_meeting_id: krispMeetingId,
                krisp_title: meeting.meeting_name,
                display_title: meeting.meeting_name,
                meeting_date: meeting.meeting_date,
                speakers: speakersData,
                has_unidentified_speakers: speakersData.some(s => /^Speaker\s*\d+$/i.test(s)),
                transcript_text: transcriptText,
                key_points: keyPointsData,
                action_items: actionItemsData,
                raw_payload: meeting.raw_data || {},
                // Don't set 'processed' directly - processTranscript will do that after creating doc
                status: projectId ? 'matched' : 'pending',
                source: 'mcp_sync',
                matched_project_id: projectId || null
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

            // Mark as imported - use the meeting's user_id, not the logged-in user's
            await supabase.rpc('mark_krisp_meeting_imported', {
                p_user_id: meeting.user_id,
                p_krisp_meeting_id: krispMeetingId,
                p_transcript_id: transcript.id
            });

            // Process the transcript (speaker matching, project assignment, document creation)
            // If projectId was provided, force processing to create the document
            try {
                const processOptions = projectId ? { forceReprocess: true } : {};
                await TranscriptProcessor.processTranscript(transcript.id, processOptions);
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

/**
 * Helper to parse JSON fields that may be strings
 */
function parseJsonField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

/**
 * Build full transcript text from meeting data
 * This creates a readable transcript from key_points and action_items
 */
function buildTranscriptText({ title, date, speakers, keyPoints, actionItems, summary, rawData }) {
    const parts = [];
    
    // Header
    parts.push(`# ${title || 'Meeting Transcript'}`);
    if (date) {
        parts.push(`Date: ${new Date(date).toLocaleString('pt-PT')}`);
    }
    if (speakers && speakers.length > 0) {
        parts.push(`Participants: ${speakers.join(', ')}`);
    }
    parts.push('');
    
    // Key Points (main content)
    if (keyPoints && keyPoints.length > 0) {
        parts.push('## Key Points');
        parts.push('');
        keyPoints.forEach((point, index) => {
            // Clean up the point - remove excessive formatting
            const cleanPoint = typeof point === 'string' ? point : JSON.stringify(point);
            parts.push(`${index + 1}. ${cleanPoint}`);
            parts.push('');
        });
    }
    
    // Action Items
    if (actionItems && actionItems.length > 0) {
        parts.push('## Action Items');
        parts.push('');
        actionItems.forEach((item, index) => {
            if (typeof item === 'object') {
                const assignee = item.assignee ? ` (${item.assignee})` : '';
                const status = item.completed ? ' ✓' : '';
                parts.push(`${index + 1}. ${item.title || item.description || JSON.stringify(item)}${assignee}${status}`);
            } else {
                parts.push(`${index + 1}. ${item}`);
            }
        });
        parts.push('');
    }
    
    // Summary (if available)
    if (summary) {
        parts.push('## Summary');
        parts.push('');
        parts.push(summary);
    }
    
    return parts.join('\n');
}

/**
 * Generate AI summary for a specific available meeting
 * 
 * @param {string} meetingId - The krisp_meeting_id
 * @returns {Promise<{success: boolean, summary: Object}>}
 */
async function generateMeetingSummary(meetingId) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    // Get meeting data
    const { data: meeting, error } = await supabase
        .from('krisp_available_meetings')
        .select('*')
        .eq('krisp_meeting_id', meetingId)
        .single();

    if (error || !meeting) {
        console.error('[AvailableMeetings] Meeting not found:', meetingId);
        return { success: false, error: 'Meeting not found' };
    }

    // Check if we have raw_data with transcript content
    const rawData = meeting.raw_data || {};
    const keyPoints = parseJsonField(meeting.key_points) || parseJsonField(rawData.meeting_notes?.key_points) || [];
    const actionItems = parseJsonField(meeting.action_items) || parseJsonField(rawData.meeting_notes?.action_items) || [];
    const existingSummary = meeting.summary || rawData.meeting_notes?.detailed_summary;
    const speakers = parseJsonField(meeting.speakers);
    const attendees = parseJsonField(meeting.attendees);

    // Build context for AI
    const context = [];
    if (meeting.meeting_name) context.push(`Meeting: ${meeting.meeting_name}`);
    if (meeting.meeting_date) context.push(`Date: ${new Date(meeting.meeting_date).toLocaleString()}`);
    if (speakers.length) context.push(`Speakers: ${speakers.join(', ')}`);
    if (attendees.length) context.push(`Attendees: ${attendees.join(', ')}`);
    if (keyPoints.length) context.push(`Key Points:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    if (actionItems.length) context.push(`Action Items:\n${actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
    if (existingSummary) context.push(`Summary: ${existingSummary}`);

    if (context.length < 3) {
        // Not enough data to generate a meaningful summary
        return {
            success: true,
            summary: {
                key_points: keyPoints,
                action_items: actionItems,
                excerpt: existingSummary || 'No summary available - insufficient meeting data',
                speakers: speakers,
                attendees: attendees,
                meeting_date: meeting.meeting_date
            }
        };
    }

    // Try to generate AI summary using OpenAI if available
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a helpful assistant that summarizes meeting information. Provide a concise summary in JSON format with:
- key_points (array of strings): Main discussion points
- action_items (array of strings): Tasks or follow-ups mentioned
- excerpt (string): A 2-3 sentence summary
- mentioned_people (array of strings): Names of people mentioned in the discussion who may be relevant stakeholders, even if not present in the meeting

Respond ONLY with valid JSON.`
                        },
                        {
                            role: 'user',
                            content: `Summarize this meeting:\n\n${context.join('\n\n')}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 600
                })
            });

            if (response.ok) {
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content;
                
                if (content) {
                    try {
                        const summary = JSON.parse(content);
                        
                        // Update the meeting with the AI summary
                        await supabase
                            .from('krisp_available_meetings')
                            .update({
                                key_points: summary.key_points || keyPoints,
                                action_items: summary.action_items || actionItems,
                                summary: summary.excerpt || existingSummary,
                                updated_at: new Date().toISOString()
                            })
                            .eq('krisp_meeting_id', meetingId);
                        
                        return { 
                            success: true, 
                            summary: {
                                ...summary,
                                speakers: speakers,
                                attendees: attendees,
                                meeting_date: meeting.meeting_date
                            }
                        };
                    } catch (parseError) {
                        console.error('[AvailableMeetings] AI response parse error:', parseError);
                    }
                }
            }
        } catch (aiError) {
            console.error('[AvailableMeetings] AI summary error:', aiError);
        }
    }

    // Fallback: return existing data
    return {
        success: true,
        summary: {
            key_points: keyPoints,
            action_items: actionItems,
            excerpt: existingSummary || 'AI summary not available',
            speakers: speakers,
            attendees: attendees,
            meeting_date: meeting.meeting_date
        }
    };
}

/**
 * Update meeting with full transcript from get_document MCP call
 */
async function updateMeetingTranscript(userId, krispMeetingId, fullTranscript) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Check if user is superadmin
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        const isSuperadmin = userProfile?.role === 'superadmin';

        // Update the meeting with full transcript
        let query = supabase
            .from('krisp_available_meetings')
            .update({
                full_transcript: fullTranscript,
                updated_at: new Date().toISOString()
            })
            .eq('krisp_meeting_id', krispMeetingId);
        
        // Non-superadmins can only update their own meetings
        if (!isSuperadmin) {
            query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query.select('id, meeting_name, krisp_meeting_id').single();

        if (error) {
            console.error('[AvailableMeetings] Transcript update error:', error);
            return { success: false, error: error.message };
        }

        console.log(`[AvailableMeetings] Updated transcript for ${krispMeetingId}: ${fullTranscript.length} chars`);
        
        return {
            success: true,
            meeting: data,
            transcriptLength: fullTranscript.length
        };

    } catch (error) {
        console.error('[AvailableMeetings] Update transcript error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Extract audio download URL from get_document transcript content
 * The URL is temporary (valid ~7 days) and looks like:
 * [Download Recording](<https://kr-files-cdn.s3.amazonaws.com/recording/...>)
 */
function extractAudioUrl(transcriptContent) {
    if (!transcriptContent) return null;
    
    // Match the markdown link format for recording download
    const urlMatch = transcriptContent.match(/\[Download Recording\]\(<([^>]+)>\)/);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }
    
    // Also try direct URL pattern
    const directMatch = transcriptContent.match(/(https:\/\/kr-files-cdn\.s3\.amazonaws\.com\/recording\/[^\s\)]+)/);
    if (directMatch && directMatch[1]) {
        return directMatch[1];
    }
    
    return null;
}

/**
 * Download audio file from Krisp URL to local folder
 * @param {string} audioUrl - The S3 URL for the audio
 * @param {string} meetingId - Krisp meeting ID (used for filename)
 * @param {string} meetingName - Meeting name for readable filename
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function downloadAudioFile(audioUrl, meetingId, meetingName) {
    const fs = require('fs');
    const path = require('path');
    const https = require('https');
    
    try {
        // Create audio directory if it doesn't exist
        const audioDir = path.join(process.cwd(), 'data', 'krisp-audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
            console.log(`[AvailableMeetings] Created audio directory: ${audioDir}`);
        }
        
        // Generate safe filename
        const safeName = meetingName
            .replace(/[^a-zA-Z0-9\s\-_]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
        const filename = `${meetingId.substring(0, 8)}_${safeName}.mp3`;
        const filePath = path.join(audioDir, filename);
        
        // Check if already downloaded
        if (fs.existsSync(filePath)) {
            console.log(`[AvailableMeetings] Audio already exists: ${filePath}`);
            return { success: true, filePath, alreadyExists: true };
        }
        
        // Download the file
        console.log(`[AvailableMeetings] Downloading audio: ${filename}`);
        
        return new Promise((resolve) => {
            const file = fs.createWriteStream(filePath);
            
            https.get(audioUrl, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`[AvailableMeetings] Audio downloaded: ${filePath}`);
                        resolve({ success: true, filePath });
                    });
                } else if (response.statusCode === 403 || response.statusCode === 404) {
                    file.close();
                    fs.unlinkSync(filePath);
                    resolve({ success: false, error: `Audio URL expired or not found (${response.statusCode})` });
                } else {
                    file.close();
                    fs.unlinkSync(filePath);
                    resolve({ success: false, error: `Download failed with status ${response.statusCode}` });
                }
            }).on('error', (err) => {
                file.close();
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                resolve({ success: false, error: err.message });
            });
        });
        
    } catch (error) {
        console.error('[AvailableMeetings] Audio download error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Calculate a hash of meeting data to detect changes
 */
function calculateDataHash(meeting) {
    const crypto = require('crypto');
    const relevantData = {
        name: meeting.meeting_name || meeting.name,
        speakers: meeting.speakers,
        key_points: meeting.key_points,
        action_items: meeting.action_items,
        summary: meeting.summary,
        transcript_length: meeting.full_transcript?.length || 0
    };
    return crypto.createHash('md5').update(JSON.stringify(relevantData)).digest('hex');
}

/**
 * Update meeting with full transcript AND extract/download audio
 * Enhanced version that handles both transcript and audio
 */
async function updateMeetingWithContent(userId, krispMeetingId, fullTranscript, options = {}) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        const { downloadAudio = true } = options;
        
        // Check if user is superadmin
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        const isSuperadmin = userProfile?.role === 'superadmin';

        // Get meeting info for filename
        const { data: meeting } = await supabase
            .from('krisp_available_meetings')
            .select('id, meeting_name')
            .eq('krisp_meeting_id', krispMeetingId)
            .single();
        
        const meetingName = meeting?.meeting_name || 'Meeting';

        // Extract audio URL from transcript
        const audioUrl = extractAudioUrl(fullTranscript);
        let audioFilePath = null;
        
        if (audioUrl && downloadAudio) {
            const audioResult = await downloadAudioFile(audioUrl, krispMeetingId, meetingName);
            if (audioResult.success) {
                audioFilePath = audioResult.filePath;
            } else {
                console.warn(`[AvailableMeetings] Audio download failed: ${audioResult.error}`);
            }
        }

        // Calculate data hash
        const dataHash = calculateDataHash({ 
            meeting_name: meetingName, 
            full_transcript: fullTranscript 
        });

        // Update the meeting with full transcript and audio info
        let query = supabase
            .from('krisp_available_meetings')
            .update({
                full_transcript: fullTranscript,
                needs_full_transcript: false,
                audio_download_url: audioUrl,
                audio_file_path: audioFilePath,
                audio_url_expires_at: audioUrl ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
                krisp_data_hash: dataHash,
                updated_at: new Date().toISOString()
            })
            .eq('krisp_meeting_id', krispMeetingId);
        
        if (!isSuperadmin) {
            query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query.select('id, meeting_name, krisp_meeting_id').single();

        if (error) {
            console.error('[AvailableMeetings] Content update error:', error);
            return { success: false, error: error.message };
        }

        console.log(`[AvailableMeetings] Updated content for ${krispMeetingId}: transcript=${fullTranscript.length} chars, audio=${audioFilePath || 'none'}`);
        
        return {
            success: true,
            meeting: data,
            transcriptLength: fullTranscript.length,
            audioFilePath,
            audioUrl: audioUrl ? 'extracted' : null,
            dataHash
        };

    } catch (error) {
        console.error('[AvailableMeetings] Update content error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sync changes from krisp_available_meetings to imported krisp_transcripts
 * Call this after updating a meeting to propagate changes to imported transcripts
 */
async function syncImportedTranscript(krispMeetingId) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Get the source meeting
        const { data: meeting, error: meetingError } = await supabase
            .from('krisp_available_meetings')
            .select('*')
            .eq('krisp_meeting_id', krispMeetingId)
            .single();
        
        if (meetingError || !meeting) {
            return { success: false, error: 'Meeting not found' };
        }

        // Get the imported transcript
        const { data: transcript, error: transcriptError } = await supabase
            .from('krisp_transcripts')
            .select('*')
            .eq('krisp_meeting_id', krispMeetingId)
            .single();
        
        if (transcriptError || !transcript) {
            return { success: false, error: 'Transcript not imported yet', notImported: true };
        }

        // Calculate new hash
        const newHash = calculateDataHash(meeting);
        
        // Check if data changed
        if (transcript.krisp_data_hash === newHash) {
            return { success: true, message: 'No changes detected', unchanged: true };
        }

        // Determine what changed
        const changes = [];
        
        if (meeting.meeting_name !== transcript.krisp_title) {
            changes.push('title');
        }
        if (JSON.stringify(meeting.speakers) !== JSON.stringify(transcript.speakers)) {
            changes.push('speakers');
        }
        if (JSON.stringify(meeting.key_points) !== JSON.stringify(transcript.key_points)) {
            changes.push('key_points');
        }
        if (JSON.stringify(meeting.action_items) !== JSON.stringify(transcript.action_items)) {
            changes.push('action_items');
        }
        if (meeting.full_transcript && 
            (!transcript.transcript_text || meeting.full_transcript.length > transcript.transcript_text.length)) {
            changes.push('transcript');
        }
        if (meeting.audio_file_path && meeting.audio_file_path !== transcript.audio_file_path) {
            changes.push('audio');
        }

        // Update the transcript
        const updateData = {
            krisp_title: meeting.meeting_name,
            speakers: meeting.speakers,
            key_points: meeting.key_points,
            action_items: meeting.action_items,
            krisp_data_hash: newHash,
            updated_at: new Date().toISOString()
        };
        
        // Only update transcript if we have a better one
        if (meeting.full_transcript && 
            (!transcript.transcript_text || meeting.full_transcript.length > transcript.transcript_text.length)) {
            updateData.transcript_text = meeting.full_transcript;
        }
        
        if (meeting.audio_file_path) {
            updateData.audio_file_path = meeting.audio_file_path;
        }

        const { error: updateError } = await supabase
            .from('krisp_transcripts')
            .update(updateData)
            .eq('krisp_meeting_id', krispMeetingId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Also update the document if exists
        if (transcript.processed_document_id && changes.includes('transcript')) {
            await supabase
                .from('documents')
                .update({
                    content: meeting.full_transcript,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transcript.processed_document_id);
        }

        console.log(`[AvailableMeetings] Synced transcript ${krispMeetingId}: ${changes.join(', ')}`);

        return {
            success: true,
            changes,
            transcriptId: transcript.id,
            documentId: transcript.processed_document_id
        };

    } catch (error) {
        console.error('[AvailableMeetings] Sync transcript error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get list of imported transcripts that have stale data
 * (data in krisp_available_meetings is newer than in krisp_transcripts)
 */
async function getStaleTranscripts(userId) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Check if user is superadmin
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        const isSuperadmin = userProfile?.role === 'superadmin';

        // Get transcripts where hash differs or is null
        let query = supabase
            .from('krisp_transcripts')
            .select(`
                id,
                krisp_meeting_id,
                krisp_title,
                krisp_data_hash,
                status,
                krisp_available_meetings!inner (
                    id,
                    meeting_name,
                    krisp_data_hash,
                    full_transcript
                )
            `)
            .not('krisp_available_meetings.krisp_data_hash', 'is', null);

        if (!isSuperadmin) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[AvailableMeetings] Get stale transcripts error:', error);
            return [];
        }

        // Filter to only stale ones
        const stale = (data || []).filter(t => {
            const meeting = t.krisp_available_meetings;
            return !t.krisp_data_hash || t.krisp_data_hash !== meeting.krisp_data_hash;
        }).map(t => ({
            transcriptId: t.id,
            krispMeetingId: t.krisp_meeting_id,
            title: t.krisp_title,
            status: t.status,
            meetingName: t.krisp_available_meetings.meeting_name,
            hasNewTranscript: !!t.krisp_available_meetings.full_transcript
        }));

        return stale;

    } catch (error) {
        console.error('[AvailableMeetings] Get stale transcripts error:', error);
        return [];
    }
}

/**
 * Sync all stale transcripts for a user
 */
async function syncAllStaleTranscripts(userId) {
    const stale = await getStaleTranscripts(userId);
    
    if (stale.length === 0) {
        return { success: true, synced: 0, message: 'No stale transcripts found' };
    }

    let synced = 0;
    const errors = [];

    for (const item of stale) {
        const result = await syncImportedTranscript(item.krispMeetingId);
        if (result.success && !result.unchanged) {
            synced++;
        } else if (!result.success) {
            errors.push({ id: item.krispMeetingId, error: result.error });
        }
    }

    return {
        success: errors.length === 0,
        synced,
        total: stale.length,
        errors: errors.length > 0 ? errors : undefined
    };
}

module.exports = {
    syncMeetingsFromMcp,
    getAvailableMeetings,
    importSelectedMeetings,
    getImportedMeetingIds,
    getSyncStats,
    updateMeetingTranscript,
    generateMeetingSummary,
    getMeetingsNeedingTranscript,
    // New exports for audio and updates
    extractAudioUrl,
    downloadAudioFile,
    updateMeetingWithContent,
    syncImportedTranscript,
    getStaleTranscripts,
    syncAllStaleTranscripts
};
