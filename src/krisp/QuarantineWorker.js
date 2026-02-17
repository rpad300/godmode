/**
 * Purpose:
 *   Background worker that periodically retries quarantined and ambiguous
 *   transcripts, checking whether new speaker mappings or manual project
 *   assignments now allow them to be fully processed.
 *
 * Responsibilities:
 *   - Query krisp_transcripts in quarantine/ambiguous status that are eligible for retry
 *   - For each, check if new speaker mappings or manual assignments make processing possible
 *   - Re-invoke TranscriptProcessor.processTranscript with forceReprocess
 *   - Track retry counts and timestamps; respect maxRetries and retryIntervalHours
 *   - Provide start/stop lifecycle for the periodic interval
 *   - Expose forceRetry for on-demand manual retries and getStats for monitoring
 *
 * Key dependencies:
 *   - ../supabase/client (getAdminClient): Supabase admin client for DB queries
 *   - ./TranscriptProcessor: the actual transcript processing pipeline
 *   - ./SpeakerMatcher: checks for new Krisp speaker mappings
 *
 * Side effects:
 *   - Reads/writes krisp_transcripts (status, retry_count, last_retry_at)
 *   - Creates documents and updates transcript status via processTranscript
 *   - Runs a setInterval timer when started; must be stopped to avoid leaks
 *
 * Notes:
 *   - Default config: retry every 1 hour, max 10 retries, batch of 50.
 *   - isRunning guard prevents overlapping cycles.
 *   - A 100ms delay between items avoids overwhelming the database.
 *   - Module-level state (isRunning, intervalId) means this is a singleton worker.
 */

const { logger } = require('../logger');
const { getAdminClient } = require('../supabase/client');
const { processTranscript } = require('./TranscriptProcessor');
const { SpeakerMatcher, hasUnidentifiedSpeakers } = require('./SpeakerMatcher');

const log = logger.child({ module: 'quarantine-worker' });

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
        log.error({ event: 'quarantine_worker_fetch_failed', err: error }, 'Error fetching');
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
    
    log.debug({ event: 'quarantine_worker_processing', transcriptId: transcript.id }, 'Processing');

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
            log.debug({ event: 'quarantine_worker_skip', transcriptId: transcript.id }, 'Still cannot process');
            return { success: false, reason: 'Still cannot process' };
        }

        // Try to process
        const result = await processTranscript(transcript.id, { forceReprocess: true });

        if (result.success) {
            log.info({ event: 'quarantine_worker_processed', transcriptId: transcript.id }, 'Successfully processed');
            return { success: true, documentId: result.documentId };
        } else {
            log.warn({ event: 'quarantine_worker_failed', transcriptId: transcript.id, error: result.error }, 'Failed to process');
            return { success: false, reason: result.error };
        }

    } catch (error) {
        log.error({ event: 'quarantine_worker_error', transcriptId: transcript.id, err: error }, 'Error processing');
        return { success: false, reason: error.message };
    }
}

/**
 * Run quarantine processing cycle
 */
async function runCycle(options = {}) {
    if (isRunning) {
        log.debug({ event: 'quarantine_worker_skip_cycle' }, 'Already running, skipping cycle');
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
        log.info({ event: 'quarantine_worker_cycle_start' }, 'Starting cycle');

        const transcripts = await getQuarantinedTranscripts(options);
        log.debug({ event: 'quarantine_worker_found', count: transcripts.length }, 'Found transcripts to retry');

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
        log.info({ event: 'quarantine_worker_cycle_complete', durationMs: duration, ...results }, 'Cycle complete');

        return results;

    } catch (error) {
        log.error({ event: 'quarantine_worker_cycle_error', err: error }, 'Cycle error');
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
        log.debug({ event: 'quarantine_worker_disabled' }, 'Disabled, not starting');
        return;
    }

    if (intervalId) {
        log.debug({ event: 'quarantine_worker_already_started' }, 'Already started');
        return;
    }

    const intervalMs = config.retryIntervalHours * 60 * 60 * 1000;

    log.info({ event: 'quarantine_worker_started', intervalHours: config.retryIntervalHours }, 'Starting with interval');

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
        log.info({ event: 'quarantine_worker_stopped' }, 'Stopped');
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
