/**
 * Purpose:
 *   Barrel export for the AI content processing subsystem, providing
 *   LLM-powered extraction of entities, relationships, and insights from
 *   documents, transcripts, and conversations.
 *
 * Responsibilities:
 *   - Re-export AIContentProcessor class and its singleton accessor
 *
 * Key dependencies:
 *   - ./ContentProcessor: Core LLM orchestration for extraction and graph enrichment
 *
 * Side effects:
 *   - None at import time; the singleton is lazily created on first call
 *
 * Notes:
 *   - getAIContentProcessor() updates provider/model on subsequent calls if
 *     new options are supplied, so config hot-reload is supported
 */

const { AIContentProcessor, getAIContentProcessor } = require('./ContentProcessor');

module.exports = {
    AIContentProcessor,
    getAIContentProcessor
};
