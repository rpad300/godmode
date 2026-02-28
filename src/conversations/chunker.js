/**
 * Purpose:
 *   Splits parsed conversations into overlapping message chunks suitable for
 *   embedding and RAG retrieval, preserving cross-boundary context.
 *
 * Responsibilities:
 *   - Chunk a conversation into groups of N messages with configurable overlap
 *   - Enforce a per-chunk character limit (graceful truncation)
 *   - Generate a compact conversation summary for single-vector retrieval
 *   - Produce embedding items (summary + chunks) ready for the RAG pipeline
 *
 * Key dependencies:
 *   - None (pure logic; works on in-memory conversation objects)
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Overlap defaults to 3 messages so that entity references near chunk
 *     boundaries appear in both neighbouring chunks
 *   - totalChunks metadata is back-filled after all chunks are created
 *   - getConversationEmbeddingItems() emits both a summary item (isSummary: true)
 *     and per-chunk items so the retriever can match at different granularities
 */

/**
 * Format a single message for embedding
 * @param {object} message - Message object
 * @returns {string}
 */
function formatMessage(message) {
    const timestamp = message.ts 
        ? `[${message.ts.substring(0, 16).replace('T', ' ')}]` 
        : '';
    
    return `${timestamp} ${message.speaker}: ${message.text}`.trim();
}

/**
 * Chunk a conversation into overlapping groups for RAG embedding
 * @param {object} conversation - Conversation object with messages array
 * @param {object} options - Chunking options
 * @param {number} options.messagesPerChunk - Messages per chunk (default: 15)
 * @param {number} options.overlap - Messages to overlap between chunks (default: 3)
 * @param {number} options.maxChunkLength - Max character length per chunk (default: 2000)
 * @returns {Array<{id: string, text: string, metadata: object}>}
 */
function chunkConversation(conversation, options = {}) {
    const {
        messagesPerChunk = 15,
        overlap = 3,
        maxChunkLength = 2000
    } = options;

    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
        return [];
    }

    const messages = conversation.messages;
    const chunks = [];
    let chunkIndex = 0;
    let i = 0;

    while (i < messages.length) {
        // Get chunk messages
        const chunkMessages = messages.slice(i, i + messagesPerChunk);
        
        // Format chunk text
        let chunkText = chunkMessages.map(formatMessage).join('\n');
        
        // If chunk is too long, reduce messages
        if (chunkText.length > maxChunkLength && chunkMessages.length > overlap + 1) {
            const reducedMessages = [];
            let currentLength = 0;
            
            for (const msg of chunkMessages) {
                const formatted = formatMessage(msg);
                if (currentLength + formatted.length + 1 > maxChunkLength && reducedMessages.length > overlap) {
                    break;
                }
                reducedMessages.push(msg);
                currentLength += formatted.length + 1;
            }
            
            chunkText = reducedMessages.map(formatMessage).join('\n');
        }

        // Extract chunk metadata
        const chunkMsgTimestamps = chunkMessages.map(m => m.ts).filter(Boolean);
        const chunkSpeakers = [...new Set(chunkMessages.map(m => m.speaker))];

        chunks.push({
            id: `conv_${conversation.id}_chunk_${chunkIndex}`,
            text: chunkText,
            metadata: {
                conversationId: conversation.id,
                conversationTitle: conversation.title,
                sourceApp: conversation.sourceApp,
                participants: conversation.participants,
                chunkSpeakers,
                chunkIndex,
                messageRange: {
                    start: i,
                    end: Math.min(i + messagesPerChunk, messages.length) - 1
                },
                chunkDateRange: chunkMsgTimestamps.length > 0 ? {
                    start: chunkMsgTimestamps[0],
                    end: chunkMsgTimestamps[chunkMsgTimestamps.length - 1]
                } : null,
                totalChunks: null, // Will be set after all chunks are created
                channelName: conversation.channelName,
                workspaceName: conversation.workspaceName
            }
        });

        chunkIndex++;
        
        // Move forward, accounting for overlap
        const step = Math.max(1, messagesPerChunk - overlap);
        i += step;
        
        // If remaining messages are less than overlap, include them in last chunk
        if (i < messages.length && messages.length - i <= overlap) {
            break;
        }
    }

    // Set total chunks
    chunks.forEach(chunk => {
        chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
}

/**
 * Generate summary text for a conversation (for single-chunk embedding)
 * @param {object} conversation - Conversation object
 * @param {number} maxLength - Maximum length of summary
 * @returns {string}
 */
function generateConversationSummary(conversation, maxLength = 500) {
    const parts = [];
    
    // Add metadata
    parts.push(`[Conversation] ${conversation.title}`);
    parts.push(`Source: ${conversation.sourceApp}`);
    
    if (conversation.channelName) {
        parts.push(`Channel: ${conversation.channelName}`);
    }
    
    if (conversation.participants.length > 0) {
        parts.push(`Participants: ${conversation.participants.slice(0, 5).join(', ')}${conversation.participants.length > 5 ? '...' : ''}`);
    }
    
    if (conversation.dateRange) {
        const start = (conversation.dateRange.first || conversation.dateRange.start || '').substring(0, 10);
        const end = (conversation.dateRange.last || conversation.dateRange.end || '').substring(0, 10);
        if (start && end) {
            parts.push(`Date range: ${start} to ${end}`);
        }
    }
    
    parts.push(`Messages: ${conversation.messageCount}`);
    
    // Add sample messages
    const sampleMessages = conversation.messages.slice(0, 5);
    if (sampleMessages.length > 0) {
        parts.push('');
        parts.push('Sample:');
        for (const msg of sampleMessages) {
            const formatted = formatMessage(msg);
            if (parts.join('\n').length + formatted.length < maxLength) {
                parts.push(formatted);
            } else {
                parts.push('...');
                break;
            }
        }
    }
    
    return parts.join('\n').substring(0, maxLength);
}

/**
 * Chunk multiple conversations
 * @param {Array} conversations - Array of conversation objects
 * @param {object} options - Chunking options
 * @returns {Array<{id: string, text: string, metadata: object}>}
 */
function chunkConversations(conversations, options = {}) {
    const allChunks = [];
    
    for (const conversation of conversations) {
        const chunks = chunkConversation(conversation, options);
        allChunks.push(...chunks);
    }
    
    return allChunks;
}

/**
 * Get embedding items from conversations (for RAG integration)
 * @param {Array} conversations - Array of conversation objects
 * @param {object} options - Options
 * @returns {Array<{id: string, type: string, text: string, data: object}>}
 */
function getConversationEmbeddingItems(conversations, options = {}) {
    const { includeFullConversation = true, chunkOptions = {} } = options;
    const items = [];
    
    for (const conversation of conversations) {
        // Add conversation summary as one item
        if (includeFullConversation) {
            items.push({
                id: `conv_${conversation.id}_summary`,
                type: 'conversation',
                text: generateConversationSummary(conversation),
                data: {
                    conversationId: conversation.id,
                    title: conversation.title,
                    sourceApp: conversation.sourceApp,
                    participants: conversation.participants,
                    messageCount: conversation.messageCount,
                    dateRange: conversation.dateRange,
                    isSummary: true
                }
            });
        }
        
        // Add chunked messages
        const chunks = chunkConversation(conversation, chunkOptions);
        for (const chunk of chunks) {
            items.push({
                id: chunk.id,
                type: 'conversation',
                text: chunk.text,
                data: {
                    ...chunk.metadata,
                    isSummary: false
                }
            });
        }
    }
    
    return items;
}

module.exports = {
    chunkConversation,
    chunkConversations,
    formatMessage,
    generateConversationSummary,
    getConversationEmbeddingItems
};
