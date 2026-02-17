/**
 * Purpose:
 *   Barrel file for the Krisp AI Meeting Assistant integration. Aggregates and
 *   re-exports all Krisp sub-modules so consumers can import from a single path.
 *
 * Responsibilities:
 *   - Re-export WebhookHandler (webhook processing and config)
 *   - Re-export SpeakerMatcher (speaker-to-contact matching, project identification)
 *   - Re-export TranscriptProcessor (processing pipeline, project assignment, document creation)
 *   - Re-export QuarantineWorker (periodic retry of unresolved transcripts)
 *   - Re-export McpBridge (MCP-based meeting import utilities)
 *   - Re-export AvailableMeetings (meeting catalog synced from Krisp MCP)
 *
 * Key dependencies:
 *   - All sibling modules in ./krisp/
 *
 * Notes:
 *   - TranscriptProcessor is exported both as-is (for .processTranscript access)
 *     and spread (for destructured imports). This allows both usage patterns.
 *   - QuarantineWorker.start/stop are also re-exported as top-level functions
 *     for convenient lifecycle management.
 */

const WebhookHandler = require('./WebhookHandler');
const { SpeakerMatcher, isUnidentifiedSpeaker, hasUnidentifiedSpeakers, PROJECT_CONFIDENCE_THRESHOLD } = require('./SpeakerMatcher');
const TranscriptProcessor = require('./TranscriptProcessor');
const QuarantineWorker = require('./QuarantineWorker');
const McpBridge = require('./McpBridge');
const AvailableMeetings = require('./AvailableMeetings');

module.exports = {
    // Webhook handling
    ...WebhookHandler,
    
    // Speaker matching
    SpeakerMatcher,
    isUnidentifiedSpeaker,
    hasUnidentifiedSpeakers,
    PROJECT_CONFIDENCE_THRESHOLD,
    
    // Transcript processing
    TranscriptProcessor,  // Export as object for .processTranscript access
    ...TranscriptProcessor,  // Also spread individual functions
    
    // Quarantine worker
    QuarantineWorker,
    startQuarantineWorker: QuarantineWorker.start,
    stopQuarantineWorker: QuarantineWorker.stop,
    
    // MCP Bridge for imports
    ...McpBridge,
    
    // Available meetings catalog (MCP sync)
    ...AvailableMeetings
};
