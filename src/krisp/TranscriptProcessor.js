/**
 * Purpose:
 *   Core processing pipeline for Krisp transcripts. Takes a raw transcript record
 *   through speaker matching, project identification, display title generation,
 *   document creation, and status management -- the main path from "received" to
 *   "processed" in the krisp_transcripts lifecycle.
 *
 * Responsibilities:
 *   - Load a transcript by ID and guard against re-processing
 *   - Quarantine transcripts with unidentified speakers
 *   - Match speakers to contacts across all user projects via SpeakerMatcher
 *   - Identify the target project using majority voting on matched contacts
 *   - Handle ambiguous/low-confidence matches (set status, return candidates)
 *   - Generate a display title in "{project_name} - {meeting_title}" format
 *   - Create a document record in the documents table with krisp metadata
 *   - Queue the created document for further processing (entity extraction, embeddings)
 *   - Manually assign a project, skip/discard a transcript, or fetch transcripts
 *   - Generate and cache AI summaries (from structured Krisp data or via LLM fallback)
 *
 * Key dependencies:
 *   - ../supabase/client (getAdminClient): Supabase admin client for DB operations
 *   - ./SpeakerMatcher: speaker-to-contact resolution and project identification
 *   - ../llm (optional, lazy): LLM for AI-generated transcript summaries
 *   - ../supabase/llm-queue (optional, lazy): queues documents for embedding/extraction
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Reads/writes krisp_transcripts, documents, project_members, user_profiles in Supabase
 *   - May queue async document processing jobs
 *
 * Notes:
 *   - Status flow: pending -> matched -> processed (happy path), or
 *     pending -> quarantine/ambiguous/failed (error paths).
 *   - Superadmin check is performed for assignProject and getUserTranscripts.
 *   - generateTranscriptSummary caches results in ai_summary column to avoid
 *     redundant LLM calls; use forceRegenerate to refresh.
 *   - file_hash for the document is a non-deduplicating hash (title + timestamp)
 *     since Krisp transcripts are inherently unique.
 */

const { logger } = require('../logger');
const { getAdminClient } = require('../supabase/client');
const { SpeakerMatcher } = require('./SpeakerMatcher');

const log = logger.child({ module: 'transcript-processor' });

/**
 * Generate formatted display title
 * Format: "{project_name} - {meeting_title}"
 */
function generateDisplayTitle(projectName, krispTitle) {
    if (!krispTitle) {
        krispTitle = 'Meeting Transcript';
    }

    if (projectName) {
        return `${projectName} - ${krispTitle}`;
    }

    return krispTitle;
}

/**
 * Process a single transcript
 * Main entry point for transcript processing
 */
async function processTranscript(transcriptId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { storage = null, forceReprocess = false, sprint_id = null } = options;

    try {
        // 1. Load transcript
        const { data: transcript, error: fetchError } = await supabase
            .from('krisp_transcripts')
            .select('*')
            .eq('id', transcriptId)
            .single();

        if (fetchError || !transcript) {
            return { success: false, error: 'Transcript not found' };
        }

        // 2. Check if already processed
        if (transcript.status === 'processed' && !forceReprocess) {
            return { success: true, message: 'Already processed', transcript };
        }

        // 3. Check for unidentified speakers
        if (transcript.has_unidentified_speakers) {
            await updateTranscriptStatus(supabase, transcriptId, 'quarantine', {
                status_reason: 'Has unidentified speakers'
            });
            return { success: false, error: 'Has unidentified speakers', status: 'quarantine' };
        }

        // 4. Get user's projects for scope
        const matcher = new SpeakerMatcher(storage);
        const userProjects = await matcher.getUserProjects(transcript.user_id);

        if (userProjects.length === 0) {
            await updateTranscriptStatus(supabase, transcriptId, 'failed', {
                status_reason: 'User has no projects'
            });
            return { success: false, error: 'User has no projects' };
        }

        // 5. If no matched project yet, try to identify one
        let projectId = transcript.matched_project_id;
        let projectResult = null;

        if (!projectId && transcript.speakers?.length > 0) {
            // Match speakers to contacts (try each user project)
            let bestMatch = null;

            for (const project of userProjects) {
                const matchResult = await matcher.matchAllSpeakers(transcript.speakers, project.id);
                
                if (matchResult.matchedCount > 0) {
                    const projectIdent = await matcher.identifyProjectFromSpeakers(
                        matchResult.results,
                        transcript.user_id
                    );

                    if (projectIdent.status === 'matched') {
                        bestMatch = {
                            matchResult,
                            projectIdent,
                            projectId: project.id
                        };
                        break;
                    } else if (!bestMatch && projectIdent.status !== 'no_project') {
                        bestMatch = {
                            matchResult,
                            projectIdent,
                            projectId: project.id
                        };
                    }
                }
            }

            if (bestMatch) {
                projectResult = bestMatch.projectIdent;
                
                if (projectResult.status === 'matched') {
                    projectId = projectResult.projectId;
                    
                    // Update transcript with match info
                    await supabase
                        .from('krisp_transcripts')
                        .update({
                            matched_project_id: projectId,
                            project_confidence: projectResult.confidence,
                            matched_contacts: bestMatch.matchResult.results,
                            status: 'matched',
                            status_reason: null
                        })
                        .eq('id', transcriptId);

                } else if (projectResult.status === 'ambiguous' || projectResult.status === 'low_confidence') {
                    // Needs manual intervention
                    await supabase
                        .from('krisp_transcripts')
                        .update({
                            project_candidates: projectResult.candidates,
                            project_confidence: projectResult.candidates?.[0]?.percentage || null,
                            matched_contacts: bestMatch.matchResult.results,
                            status: 'ambiguous',
                            status_reason: projectResult.reason
                        })
                        .eq('id', transcriptId);

                    return {
                        success: false,
                        error: projectResult.reason,
                        status: 'ambiguous',
                        candidates: projectResult.candidates
                    };
                }
            }
        }

        // 6. If still no project, cannot proceed
        if (!projectId) {
            await updateTranscriptStatus(supabase, transcriptId, 'ambiguous', {
                status_reason: 'Could not identify project from speakers'
            });
            return { success: false, error: 'Could not identify project', status: 'ambiguous' };
        }

        // 7. Get project details for title
        const { data: project } = await supabase
            .from('projects')
            .select('id, name')
            .eq('id', projectId)
            .single();

        // 8. Generate display title (use project name since project_number doesn't exist)
        const displayTitle = generateDisplayTitle(
            project?.name,
            transcript.krisp_title
        );

        // 9. Create document in GodMode
        const documentId = await createDocument(supabase, {
            projectId,
            userId: transcript.user_id,
            title: displayTitle,
            content: transcript.transcript_text,
            sprint_id,
            metadata: {
                source: 'krisp',
                krisp_meeting_id: transcript.krisp_meeting_id,
                meeting_date: transcript.meeting_date,
                duration_minutes: transcript.duration_minutes,
                speakers: transcript.speakers,
                action_items: transcript.action_items,
                key_points: transcript.key_points,
                notes: transcript.notes
            }
        });

        if (!documentId) {
            await updateTranscriptStatus(supabase, transcriptId, 'failed', {
                status_reason: 'Failed to create document'
            });
            return { success: false, error: 'Failed to create document' };
        }

        // 10. Update transcript as processed
        await supabase
            .from('krisp_transcripts')
            .update({
                display_title: displayTitle,
                matched_project_id: projectId,
                processed_document_id: documentId,
                processed_at: new Date().toISOString(),
                status: 'processed',
                status_reason: null
            })
            .eq('id', transcriptId);

        log.debug({ event: 'transcript_processed', transcriptId, documentId }, 'Processed');

        return {
            success: true,
            documentId,
            displayTitle,
            projectId
        };

    } catch (error) {
        log.warn({ event: 'transcript_process_error', reason: error?.message }, 'Error');
        await updateTranscriptStatus(supabase, transcriptId, 'failed', {
            status_reason: error.message
        });

        return { success: false, error: error.message };
    }
}

/**
 * Update transcript status
 */
async function updateTranscriptStatus(supabase, transcriptId, status, extra = {}) {
    const update = {
        status,
        ...extra
    };

    if (status === 'quarantine' || status === 'failed') {
        // Increment retry count
        const { data } = await supabase
            .from('krisp_transcripts')
            .select('retry_count')
            .eq('id', transcriptId)
            .single();

        update.retry_count = (data?.retry_count || 0) + 1;
        update.last_retry_at = new Date().toISOString();
    }

    await supabase
        .from('krisp_transcripts')
        .update(update)
        .eq('id', transcriptId);
}

/**
 * Create document in GodMode
 * Uses existing document creation logic
 */
async function createDocument(supabase, { projectId, userId, title, content, metadata, sprint_id }) {
    try {
        // Check if content exists
        if (!content) {
            log.warn({ event: 'transcript_no_content' }, 'No content to create document');
            // Still create document with metadata
            content = '';
        }

        // Generate a file hash for duplicate detection
        const crypto = require('crypto');
        const fileHash = crypto.createHash('md5').update(title + Date.now()).digest('hex');

        // Create document record as transcript type
        // Using columns that exist in the documents table (based on storage.js)
        const { data: document, error } = await supabase
            .from('documents')
            .insert({
                project_id: projectId,
                uploaded_by: userId,
                title: title,
                filename: `${title}.txt`,
                filepath: 'krisp-import',
                file_hash: fileHash,
                file_type: 'transcript',
                file_size: content.length,
                content: content,
                summary: metadata?.key_points?.join('; ') || null,
                doc_type: 'transcript',
                status: 'processed',
                processed_at: new Date().toISOString(),
                sprint_id: sprint_id || null
            })
            .select('id')
            .single();

        if (error) {
            log.warn({ event: 'transcript_document_creation_error', reason: error?.message }, 'Document creation error');
            return null;
        }

        // Queue for further processing (entity extraction, embeddings, etc.)
        try {
            const { queueDocumentProcessing } = require('../supabase/llm-queue');
            if (typeof queueDocumentProcessing === 'function') {
                await queueDocumentProcessing(document.id, projectId, userId);
            }
        } catch (e) {
            log.warn({ event: 'transcript_queue_failed', reason: e.message }, 'Could not queue for processing');
        }

        return document.id;

    } catch (error) {
        log.warn({ event: 'transcript_create_document_error', reason: error?.message }, 'Create document error');
        return null;
    }
}

/**
 * Manually assign a project to a transcript
 */
async function assignProject(transcriptId, projectId, userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    try {
        // Check if user is superadmin
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        const isSuperadmin = userProfile?.role === 'superadmin';

        // Verify user has access to the project (superadmins can access any project)
        if (!isSuperadmin) {
            const { data: membership } = await supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .single();

            if (!membership) {
                return { success: false, error: 'User does not have access to this project' };
            }
        }

        // Update transcript with project assignment - set status to 'matched' first
        // processTranscript will update to 'processed' after creating the document
        let query = supabase
            .from('krisp_transcripts')
            .update({
                matched_project_id: projectId,
                project_candidates: null,
                status: 'matched',
                status_reason: 'Manually assigned by user'
            })
            .eq('id', transcriptId);
        
        if (!isSuperadmin) {
            query = query.eq('user_id', userId);
        }
        
        await query;

        // Process the transcript now - this will create the document and set status to 'processed'
        const result = await processTranscript(transcriptId, { forceReprocess: true });
        
        return result;

    } catch (error) {
        log.warn({ event: 'transcript_assign_project_error', reason: error?.message }, 'Assign project error');
        return { success: false, error: error.message };
    }
}

/**
 * Skip/discard a transcript
 */
async function skipTranscript(transcriptId, userId, reason = 'Manually discarded') {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
        .from('krisp_transcripts')
        .update({
            status: 'skipped',
            status_reason: reason
        })
        .eq('id', transcriptId)
        .eq('user_id', userId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Get transcript by ID
 */
async function getTranscript(transcriptId, userId = null) {
    const supabase = getAdminClient();
    if (!supabase) return null;

    let query = supabase
        .from('krisp_transcripts')
        .select(`
            *,
            projects:matched_project_id (id, name)
        `)
        .eq('id', transcriptId);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data } = await query.single();
    return data;
}

/**
 * Get transcripts for a user with filtering
 * Superadmins can see all transcripts
 */
async function getUserTranscripts(userId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) return [];

    const {
        status = null,
        projectId = null,
        limit = 50,
        offset = 0,
        orderBy = 'received_at',
        orderDir = 'desc',
        sinceDate = null,
        untilDate = null
    } = options;

    // Check if user is superadmin
    const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    const isSuperadmin = userProfile?.role === 'superadmin';

    let query = supabase
        .from('krisp_transcripts')
        .select(`
            *,
            projects:matched_project_id (id, name)
        `);
    
    // Only filter by user_id if not superadmin
    if (!isSuperadmin) {
        query = query.eq('user_id', userId);
    }

    if (status) {
        if (Array.isArray(status)) {
            query = query.in('status', status);
        } else {
            query = query.eq('status', status);
        }
    }

    if (projectId) {
        query = query.eq('matched_project_id', projectId);
    }

    if (sinceDate) {
        query = query.gte('received_at', sinceDate);
    }
    if (untilDate) {
        query = query.lte('received_at', untilDate);
    }

    query = query
        .order(orderBy, { ascending: orderDir === 'asc' })
        .range(offset, offset + limit - 1);

    const { data } = await query;
    return data || [];
}

/**
 * Get transcripts for a project within a date range (server-side, e.g. for sprint task generation).
 * Uses admin client; filters by matched_project_id and received_at.
 */
async function getTranscriptsForProject(projectId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) return [];
    const { sinceDate = null, untilDate = null, limit = 100 } = options;
    let query = supabase
        .from('krisp_transcripts')
        .select('id, display_title, meeting_date, transcript_text, ai_summary, key_points, status, received_at')
        .eq('matched_project_id', projectId)
        .order('received_at', { ascending: false })
        .limit(limit);
    if (sinceDate) query = query.gte('received_at', sinceDate);
    if (untilDate) query = query.lte('received_at', untilDate);
    const { data } = await query;
    return data || [];
}

/**
 * Get transcript summary for a user
 */
async function getTranscriptsSummary(userId) {
    const supabase = getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .rpc('get_krisp_transcripts_summary', { p_user_id: userId });

    if (error) {
        log.warn({ event: 'transcript_summary_error', reason: error?.message }, 'Summary error');
        return null;
    }

    return data;
}

/**
 * Generate AI summary of a transcript
 * Uses LLM to create a concise summary of the meeting content
 * Caches the result in the database to avoid regenerating
 */
async function generateTranscriptSummary(transcriptId, userId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { forceRegenerate = false } = options;

    try {
        // 1. Get transcript
        const { data: transcript, error } = await supabase
            .from('krisp_transcripts')
            .select('*')
            .eq('id', transcriptId)
            .eq('user_id', userId)
            .single();

        if (error || !transcript) {
            return { success: false, error: 'Transcript not found' };
        }

        // 2. Check if we have a cached summary
        if (!forceRegenerate && transcript.ai_summary) {
            log.debug({ event: 'transcript_cached_summary', transcriptId }, 'Using cached summary');
            return { success: true, summary: transcript.ai_summary, cached: true };
        }

        // 3. Check if we have content to summarize
        const content = transcript.transcript_text;
        const keyPoints = transcript.key_points;
        const actionItems = transcript.action_items;
        const notes = transcript.notes;

        // If we have structured data from Krisp, use it and cache
        if (keyPoints?.length || actionItems?.length || notes) {
            const summary = {
                title: transcript.krisp_title || 'Meeting',
                date: transcript.meeting_date,
                duration: transcript.duration_minutes,
                speakers: transcript.speakers || [],
                keyPoints: keyPoints || [],
                actionItems: actionItems || [],
                notes: typeof notes === 'string' ? notes : notes?.summary || null,
                source: 'krisp_metadata'
            };
            
            // Cache the summary
            await cacheSummary(supabase, transcriptId, summary);
            
            return { success: true, summary, cached: false };
        }

        // 4. If no structured data, generate summary with LLM
        if (!content || content.length < 50) {
            return { 
                success: true, 
                summary: {
                    title: transcript.krisp_title || 'Meeting',
                    date: transcript.meeting_date,
                    speakers: transcript.speakers || [],
                    keyPoints: [],
                    actionItems: [],
                    notes: 'No transcript content available.',
                    source: 'no_content'
                }
            };
        }

        // 4. Use LLM to generate summary
        try {
            const { queryLLM } = require('../llm');
            
            // Truncate content if too long (max ~4000 chars for summary)
            const truncatedContent = content.length > 4000 
                ? content.substring(0, 4000) + '...[truncated]'
                : content;

            const prompt = `Analyze this meeting transcript and provide a structured summary.

Meeting Title: ${transcript.krisp_title || 'Unknown'}
Speakers: ${(transcript.speakers || []).join(', ') || 'Unknown'}

Transcript:
${truncatedContent}

Provide your response in the following JSON format:
{
  "topic": "Main topic or purpose of the meeting (1 sentence)",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "actionItems": ["Action item 1 (with owner if mentioned)", "Action item 2"],
  "decisions": ["Any decisions made during the meeting"],
  "nextSteps": "Brief description of next steps if any"
}

Respond ONLY with the JSON, no additional text.`;

            const response = await queryLLM(prompt, {
                temperature: 0.3,
                maxTokens: 1000,
                purpose: 'transcript_summary'
            });

            // Parse LLM response
            let parsedSummary;
            try {
                // Try to extract JSON from response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedSummary = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                log.warn({ event: 'transcript_parse_llm_failed', reason: parseError?.message }, 'Failed to parse LLM response');
                parsedSummary = {
                    topic: 'Meeting summary',
                    keyPoints: ['Unable to extract structured summary'],
                    actionItems: [],
                    decisions: [],
                    nextSteps: null
                };
            }

            const summary = {
                title: transcript.krisp_title || 'Meeting',
                date: transcript.meeting_date,
                duration: transcript.duration_minutes,
                speakers: transcript.speakers || [],
                topic: parsedSummary.topic,
                keyPoints: parsedSummary.keyPoints || [],
                actionItems: parsedSummary.actionItems || [],
                decisions: parsedSummary.decisions || [],
                nextSteps: parsedSummary.nextSteps,
                source: 'ai_generated'
            };

            // Cache the AI-generated summary
            await cacheSummary(supabase, transcriptId, summary);

            return { success: true, summary, cached: false };

        } catch (llmError) {
            log.warn({ event: 'transcript_llm_error', reason: llmError?.message }, 'LLM error');
            
            // Fallback: extract first few sentences as summary
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const excerpt = sentences.slice(0, 3).join('. ').trim() + '.';
            
            const fallbackSummary = {
                title: transcript.krisp_title || 'Meeting',
                date: transcript.meeting_date,
                speakers: transcript.speakers || [],
                keyPoints: [],
                actionItems: [],
                notes: excerpt,
                source: 'excerpt_fallback'
            };
            
            // Cache even the fallback (can be regenerated later with forceRegenerate)
            await cacheSummary(supabase, transcriptId, fallbackSummary);
            
            return {
                success: true,
                summary: fallbackSummary,
                cached: false
            };
        }

    } catch (error) {
        log.warn({ event: 'transcript_summary_generation_error', reason: error?.message }, 'Summary generation error');
        return { success: false, error: error.message };
    }
}

/**
 * Cache a summary in the database
 */
async function cacheSummary(supabase, transcriptId, summary) {
    try {
        const { error } = await supabase
            .from('krisp_transcripts')
            .update({
                ai_summary: summary,
                summary_generated_at: new Date().toISOString()
            })
            .eq('id', transcriptId);

        if (error) {
            log.warn({ event: 'transcript_cache_summary_failed', reason: error?.message }, 'Failed to cache summary');
        } else {
            log.debug({ event: 'transcript_summary_cached', transcriptId }, 'Summary cached');
        }
    } catch (err) {
        log.warn({ event: 'transcript_cache_error', reason: err?.message }, 'Cache error');
    }
}

module.exports = {
    processTranscript,
    assignProject,
    skipTranscript,
    getTranscript,
    getUserTranscripts,
    getTranscriptsForProject,
    getTranscriptsSummary,
    generateDisplayTitle,
    createDocument,
    generateTranscriptSummary
};
