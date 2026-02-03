/**
 * Krisp Webhook Handler
 * Processes incoming webhook events from Krisp AI Meeting Assistant
 */

const { getAdminClient } = require('../supabase/client');

// Krisp event types
const KRISP_EVENTS = {
    TRANSCRIPT_CREATED: 'transcript_created',
    NOTES_GENERATED: 'notes_generated',
    TRANSCRIPT_SHARED: 'transcript_shared'
};

/**
 * Validate webhook request
 * Checks token in URL and Authorization header
 */
async function validateWebhook(webhookToken, authHeader) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { valid: false, error: 'Database not configured' };
    }

    // Find webhook config by token
    const { data: webhook, error } = await supabase
        .from('krisp_user_webhooks')
        .select('*')
        .eq('webhook_token', webhookToken)
        .eq('is_active', true)
        .single();

    if (error || !webhook) {
        return { valid: false, error: 'Invalid webhook token' };
    }

    // Validate Authorization header if secret is configured
    if (webhook.webhook_secret) {
        if (!authHeader || authHeader !== webhook.webhook_secret) {
            return { valid: false, error: 'Invalid authorization' };
        }
    }

    return { valid: true, webhook };
}

/**
 * Check if transcript already exists (prevent duplicates)
 */
async function checkDuplicate(userId, krispMeetingId, eventType) {
    const supabase = getAdminClient();
    
    const { data: existing } = await supabase
        .from('krisp_transcripts')
        .select('id, status')
        .eq('user_id', userId)
        .eq('krisp_meeting_id', krispMeetingId)
        .eq('event_type', eventType)
        .maybeSingle();

    return existing;
}

/**
 * Parse Krisp webhook payload
 * Extracts relevant fields based on event type
 */
function parsePayload(eventType, payload) {
    // Common fields
    const parsed = {
        krisp_meeting_id: payload.meeting_id || payload.id || payload.transcript_id,
        krisp_title: payload.title || payload.meeting_title || payload.name,
        meeting_date: payload.meeting_date || payload.date || payload.created_at,
        duration_minutes: payload.duration_minutes || payload.duration,
        speakers: [],
        transcript_text: null,
        action_items: null,
        key_points: null,
        notes: null,
        recording_url: payload.recording_url || payload.audio_url
    };

    // Extract speakers from various possible fields
    if (payload.speakers) {
        parsed.speakers = Array.isArray(payload.speakers) 
            ? payload.speakers 
            : [payload.speakers];
    } else if (payload.participants) {
        parsed.speakers = Array.isArray(payload.participants)
            ? payload.participants.map(p => typeof p === 'string' ? p : p.name)
            : [];
    }

    // Extract content based on event type
    switch (eventType) {
        case KRISP_EVENTS.TRANSCRIPT_CREATED:
            parsed.transcript_text = payload.transcript || payload.text || payload.content;
            parsed.action_items = payload.action_items;
            parsed.key_points = payload.key_points || payload.highlights;
            break;

        case KRISP_EVENTS.NOTES_GENERATED:
            parsed.notes = payload.notes || payload.meeting_notes;
            parsed.action_items = payload.action_items;
            parsed.key_points = payload.key_points || payload.highlights;
            break;

        case KRISP_EVENTS.TRANSCRIPT_SHARED:
            // Shared transcripts might have all content
            parsed.transcript_text = payload.transcript || payload.text;
            parsed.notes = payload.notes;
            break;
    }

    return parsed;
}

/**
 * Check for unidentified speakers (Speaker 1, Speaker 2, etc.)
 */
function hasUnidentifiedSpeakers(speakers) {
    if (!speakers || !Array.isArray(speakers)) return false;
    
    const unidentifiedPattern = /^(Speaker\s*\d+|Unknown|Guest|Participant)$/i;
    return speakers.some(s => unidentifiedPattern.test(s));
}

/**
 * Process incoming Krisp webhook
 * Main entry point for webhook handling
 */
async function processWebhook(webhookToken, authHeader, payload) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured', status: 500 };
    }

    try {
        // 1. Validate webhook
        const validation = await validateWebhook(webhookToken, authHeader);
        if (!validation.valid) {
            console.warn(`[Krisp Webhook] Validation failed: ${validation.error}`);
            return { success: false, error: validation.error, status: 401 };
        }

        const { webhook } = validation;
        const userId = webhook.user_id;

        // 2. Extract event type
        const eventType = payload.event || payload.event_type || payload.type;
        if (!eventType) {
            return { success: false, error: 'Missing event type', status: 400 };
        }

        // 3. Check if event is enabled
        const enabledEvents = webhook.events_enabled || [];
        if (!enabledEvents.includes(eventType)) {
            console.log(`[Krisp Webhook] Event ${eventType} not enabled for user ${userId}`);
            return { success: true, message: 'Event ignored (not enabled)', status: 200 };
        }

        // 4. Parse payload
        const parsed = parsePayload(eventType, payload);
        
        if (!parsed.krisp_meeting_id) {
            return { success: false, error: 'Missing meeting ID', status: 400 };
        }

        // 5. Check for duplicates
        const existing = await checkDuplicate(userId, parsed.krisp_meeting_id, eventType);
        if (existing) {
            console.log(`[Krisp Webhook] Duplicate detected: ${parsed.krisp_meeting_id}`);
            return { 
                success: true, 
                message: 'Already processed', 
                transcriptId: existing.id,
                status: 200 
            };
        }

        // 6. Check for unidentified speakers
        const hasUnidentified = hasUnidentifiedSpeakers(parsed.speakers);

        // 7. Determine initial status
        let status = 'pending';
        let statusReason = null;

        if (hasUnidentified) {
            status = 'quarantine';
            statusReason = 'Has unidentified speakers (Speaker 1, Speaker 2, etc.)';
        }

        // 8. Insert transcript record
        const { data: transcript, error: insertError } = await supabase
            .from('krisp_transcripts')
            .insert({
                user_id: userId,
                krisp_meeting_id: parsed.krisp_meeting_id,
                source: 'webhook',
                event_type: eventType,
                krisp_title: parsed.krisp_title,
                meeting_date: parsed.meeting_date,
                duration_minutes: parsed.duration_minutes,
                speakers: parsed.speakers,
                has_unidentified_speakers: hasUnidentified,
                transcript_text: parsed.transcript_text,
                action_items: parsed.action_items,
                key_points: parsed.key_points,
                notes: parsed.notes,
                recording_url: parsed.recording_url,
                status: status,
                status_reason: statusReason,
                raw_payload: payload,
                received_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Krisp Webhook] Insert error:', insertError);
            return { success: false, error: insertError.message, status: 500 };
        }

        // 9. Update webhook stats
        await supabase
            .from('krisp_user_webhooks')
            .update({
                last_event_at: new Date().toISOString(),
                total_events_received: webhook.total_events_received + 1
            })
            .eq('id', webhook.id);

        console.log(`[Krisp Webhook] Processed: ${transcript.id} (${status})`);

        // 10. If not quarantined, queue for speaker matching
        if (status === 'pending') {
            // Trigger async processing (speaker matching, project identification)
            // This will be handled by SpeakerMatcher and TranscriptProcessor
            setImmediate(async () => {
                try {
                    const { processTranscript } = require('./TranscriptProcessor');
                    await processTranscript(transcript.id);
                } catch (err) {
                    console.error('[Krisp Webhook] Async processing error:', err);
                }
            });
        }

        return {
            success: true,
            message: `Transcript ${status === 'quarantine' ? 'quarantined' : 'queued for processing'}`,
            transcriptId: transcript.id,
            status: 201
        };

    } catch (error) {
        console.error('[Krisp Webhook] Processing error:', error);
        return { success: false, error: error.message, status: 500 };
    }
}

/**
 * Get webhook configuration for a user
 */
async function getWebhookConfig(userId) {
    const supabase = getAdminClient();
    if (!supabase) return null;

    const { data } = await supabase
        .from('krisp_user_webhooks')
        .select('*')
        .eq('user_id', userId)
        .single();

    return data;
}

/**
 * Create or get webhook configuration for a user
 */
async function getOrCreateWebhook(userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { data, error } = await supabase
        .rpc('get_or_create_krisp_webhook', { p_user_id: userId });

    if (error) {
        console.error('[Krisp Webhook] Error creating webhook:', error);
        return { success: false, error: error.message };
    }

    return { success: true, webhook: data };
}

/**
 * Regenerate webhook credentials
 */
async function regenerateWebhook(userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { data, error } = await supabase
        .rpc('regenerate_krisp_webhook', { p_user_id: userId });

    if (error) {
        console.error('[Krisp Webhook] Error regenerating webhook:', error);
        return { success: false, error: error.message };
    }

    return { success: true, webhook: data };
}

/**
 * Toggle webhook active status
 */
async function toggleWebhook(userId, isActive) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
        .from('krisp_user_webhooks')
        .update({ is_active: isActive })
        .eq('user_id', userId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Update enabled events
 */
async function updateEnabledEvents(userId, events) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    // Validate events
    const validEvents = Object.values(KRISP_EVENTS);
    const filteredEvents = events.filter(e => validEvents.includes(e));

    const { error } = await supabase
        .from('krisp_user_webhooks')
        .update({ events_enabled: filteredEvents })
        .eq('user_id', userId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, events: filteredEvents };
}

module.exports = {
    KRISP_EVENTS,
    validateWebhook,
    processWebhook,
    getWebhookConfig,
    getOrCreateWebhook,
    regenerateWebhook,
    toggleWebhook,
    updateEnabledEvents,
    hasUnidentifiedSpeakers
};
