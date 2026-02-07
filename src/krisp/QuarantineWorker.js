/**
 * Krisp Quarantine Worker
 * Periodically reprocesses quarantined transcripts to check if speakers can now be identified
 */

const { getAdminClient } = require('../supabase/client');
const { processTranscript } = require('./TranscriptProcessor');
const { SpeakerMatcher, hasUnidentifiedSpeakers } = require('./SpeakerMatcher');

// Default configuration
const DEFAULT_CONFIG = {
    retryIntervalHours: 1,      // Check every hour
    maxRetries: 10,              // Maximum retry attempts
    batchSize: 50,               // Process up to 50 at a time
    enabled: true
};

let isRunning = false;
let intervalId = null;

/**
 * Get quarantined transcripts ready for retry
 */
async function getQuarantinedTranscripts(options = {}) {
    const supabase = getAdminClient();
    if (!supabase) return [];

    const {
        batchSize = DEFAULT_CONFIG.batchSize,
        maxRetries = DEFAULT_CONFIG.maxRetries,
        retryIntervalHours = DEFAULT_CONFIG.retryIntervalHours
    } = options;

    // Calculate retry cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - retryIntervalHours);

    const { data, error } = await supabase
        .from('krisp_transcripts')
        .select('*')
        .in('status', ['quarantine', 'ambiguous'])
        .lt('retry_count', maxRetries)
        .or(`last_retry_at.is.null,last_retry_at.lt.${cutoffTime.toISOString()}`)
        .order('last_retry_at', { ascending: true, nullsFirst: true })
        .limit(batchSize);

    if (error) {
        console.error('[QuarantineWorker] Error fetching:', error);
        return [];
    }

    return data || [];
}

/**
 * Check if a quarantined transcript can now be processed
 * (e.g., new speaker mappings were added)
 */
async function canProcessNow(transcript) {
    const supabase = getAdminClient();
    const matcher = new SpeakerMatcher();

    // If quarantined due to unidentified speakers, check if mappings exist now
    if (transcript.status === 'quarantine' && transcript.has_unidentified_speakers) {
        const speakers = transcript.speakers || [];
        
        for (const speaker of speakers) {
            if (hasUnidentifiedSpeakers([speaker])) {
                // Check if a mapping was created for this generic speaker
                const mapping = await matcher.findKrispMapping(speaker, transcript.matched_project_id);
                const globalMapping = await matcher.findGlobalKrispMapping(speaker);
                
                if (!mapping && !globalMapping) {
                    // Still no mapping for this unidentified speaker
                    return false;
                }
            }
        }
        
        // All unidentified speakers now have mappings
        return true;
    }

    // If ambiguous, check if user manually resolved it
    if (transcript.status === 'ambiguous') {
        // Check if project was manually assigned
        const { data } = await supabase
            .from('krisp_transcripts')
            .select('matched_project_id, status')
            .eq('id', transcript.id)
            .single();

        return data?.matched_project_id && data?.status === 'matched';
    }

    return false;
}

/**
 * Process a single quarantined transcript
 */
async function processQuarantinedTranscript(transcript) {
    const supabase = getAdminClient();
    
    console.log(`[QuarantineWorker] Processing: ${transcript.id}`);

    try {
        // Update last retry timestamp
        await supabase
            .from('krisp_transcripts')
            .update({
                last_retry_at: new Date().toISOString(),
                retry_count: transcript.retry_count + 1
            })
            .eq('id', transcript.id);

        // Check if we can process now
        const canProcess = await canProcessNow(transcript);

        if (!canProcess) {
            console.log(`[QuarantineWorker] Still cannot process: ${transcript.id}`);
            return { success: false, reason: 'Still cannot process' };
        }

        // Try to process
        const result = await processTranscript(transcript.id, { forceReprocess: true });

        if (result.success) {
            console.log(`[QuarantineWorker] Successfully processed: ${transcript.id}`);
            return { success: true, documentId: result.documentId };
        } else {
            console.log(`[QuarantineWorker] Failed to process: ${transcript.id} - ${result.error}`);
            return { success: false, reason: result.error };
        }

    } catch (error) {
        console.error(`[QuarantineWorker] Error processing ${transcript.id}:`, error);
        return { success: false, reason: error.message };
    }
}

/**
 * Run quarantine processing cycle
 */
async function runCycle(options = {}) {
    if (isRunning) {
        console.log('[QuarantineWorker] Already running, skipping cycle');
        return { skipped: true };
    }

    isRunning = true;
    const startTime = Date.now();
    const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0
    };

    try {
        console.log('[QuarantineWorker] Starting cycle...');

        const transcripts = await getQuarantinedTranscripts(options);
        console.log(`[QuarantineWorker] Found ${transcripts.length} transcripts to retry`);

        for (const transcript of transcripts) {
            results.processed++;

            const result = await processQuarantinedTranscript(transcript);

            if (result.success) {
                results.succeeded++;
            } else if (result.reason === 'Still cannot process') {
                results.skipped++;
            } else {
                results.failed++;
            }

            // Small delay between processing to avoid overload
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const duration = Date.now() - startTime;
        console.log(`[QuarantineWorker] Cycle complete in ${duration}ms:`, results);

        return results;

    } catch (error) {
        console.error('[QuarantineWorker] Cycle error:', error);
        return { error: error.message };
    } finally {
        isRunning = false;
    }
}

/**
 * Start the quarantine worker
 */
function start(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    if (!config.enabled) {
        console.log('[QuarantineWorker] Disabled, not starting');
        return;
    }

    if (intervalId) {
        console.log('[QuarantineWorker] Already started');
        return;
    }

    const intervalMs = config.retryIntervalHours * 60 * 60 * 1000;

    console.log(`[QuarantineWorker] Starting with interval: ${config.retryIntervalHours}h`);

    // Run immediately on start
    runCycle(config);

    // Then run periodically
    intervalId = setInterval(() => runCycle(config), intervalMs);
}

/**
 * Stop the quarantine worker
 */
function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[QuarantineWorker] Stopped');
    }
}

/**
 * Check if worker is running
 */
function isWorkerRunning() {
    return intervalId !== null;
}

/**
 * Force a manual retry of a specific transcript
 */
async function forceRetry(transcriptId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }

    const { data: transcript, error } = await supabase
        .from('krisp_transcripts')
        .select('*')
        .eq('id', transcriptId)
        .single();

    if (error || !transcript) {
        return { success: false, error: 'Transcript not found' };
    }

    return await processQuarantinedTranscript(transcript);
}

/**
 * Get quarantine statistics
 */
async function getStats() {
    const supabase = getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('krisp_transcripts')
        .select('status, retry_count')
        .in('status', ['quarantine', 'ambiguous']);

    if (error) return null;

    const stats = {
        total: data.length,
        quarantine: data.filter(t => t.status === 'quarantine').length,
        ambiguous: data.filter(t => t.status === 'ambiguous').length,
        maxedOut: data.filter(t => t.retry_count >= DEFAULT_CONFIG.maxRetries).length,
        readyForRetry: 0
    };

    // Count ready for retry
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - DEFAULT_CONFIG.retryIntervalHours);

    const ready = await getQuarantinedTranscripts({ batchSize: 1000 });
    stats.readyForRetry = ready.length;

    return stats;
}

module.exports = {
    start,
    stop,
    runCycle,
    forceRetry,
    getStats,
    isWorkerRunning,
    getQuarantinedTranscripts,
    DEFAULT_CONFIG
};
