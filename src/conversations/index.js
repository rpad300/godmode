/**
 * Conversations Module
 * 
 * Exports conversation parsing, chunking, and utility functions
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
