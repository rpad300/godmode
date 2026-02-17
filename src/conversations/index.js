/**
 * Purpose:
 *   Barrel export for the conversations subsystem: multi-format chat parsing
 *   and RAG-oriented chunking.
 *
 * Responsibilities:
 *   - Re-export parser functions (detectFormat, parseWhatsApp, parseSlack,
 *     parseTeams, parseGeneric, parse, createConversation, generateId)
 *   - Re-export chunker functions (chunkConversation, chunkConversations,
 *     formatMessage, generateConversationSummary, getConversationEmbeddingItems)
 *
 * Key dependencies:
 *   - ./parser: Format detection and multi-platform message parsing
 *   - ./chunker: Overlapping chunk generation for embedding / RAG
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - parse() auto-detects format; pass an explicit hint to skip detection
 */

const parser = require('./parser');
const chunker = require('./chunker');

module.exports = {
    // Parser functions
    detectFormat: parser.detectFormat,
    parseWhatsApp: parser.parseWhatsApp,
    parseSlack: parser.parseSlack,
    parseTeams: parser.parseTeams,
    parseGeneric: parser.parseGeneric,
    parse: parser.parse,
    createConversation: parser.createConversation,
    generateId: parser.generateId,
    
    // Chunker functions
    chunkConversation: chunker.chunkConversation,
    chunkConversations: chunker.chunkConversations,
    formatMessage: chunker.formatMessage,
    generateConversationSummary: chunker.generateConversationSummary,
    getConversationEmbeddingItems: chunker.getConversationEmbeddingItems
};
