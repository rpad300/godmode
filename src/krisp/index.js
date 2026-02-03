/**
 * Krisp AI Meeting Assistant Integration
 * Main module exports
 */

const WebhookHandler = require('./WebhookHandler');
const { SpeakerMatcher, isUnidentifiedSpeaker, hasUnidentifiedSpeakers, PROJECT_CONFIDENCE_THRESHOLD } = require('./SpeakerMatcher');
const TranscriptProcessor = require('./TranscriptProcessor');
const QuarantineWorker = require('./QuarantineWorker');

module.exports = {
    // Webhook handling
    ...WebhookHandler,
    
    // Speaker matching
    SpeakerMatcher,
    isUnidentifiedSpeaker,
    hasUnidentifiedSpeakers,
    PROJECT_CONFIDENCE_THRESHOLD,
    
    // Transcript processing
    ...TranscriptProcessor,
    
    // Quarantine worker
    QuarantineWorker,
    startQuarantineWorker: QuarantineWorker.start,
    stopQuarantineWorker: QuarantineWorker.stop
};
