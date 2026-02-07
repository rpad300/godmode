/**
 * LLM Streaming Support
 * Provides Server-Sent Events (SSE) streaming for LLM responses
 */

const llm = require('./index');

/**
 * Stream text generation via async generator
 * @param {object} options
 * @param {string} options.provider - Provider identifier
 * @param {string} options.model - Model name
 * @param {string} options.prompt - User prompt
 * @param {string} [options.system] - System prompt
 * @param {number} [options.temperature=0.7] - Temperature
 * @param {number} [options.maxTokens=4096] - Max tokens
 * @param {object} [options.providerConfig] - Provider-specific config
 * @yields {object} { type: 'chunk'|'done'|'error', content?: string, usage?: object, error?: string }
 */
async function* generateTextStream(options) {
    const { provider, model, prompt, system, temperature = 0.7, maxTokens = 4096, providerConfig = {} } = options;
    
    const startTime = Date.now();
    let fullText = '';
    let totalChunks = 0;
    
    try {
        const client = llm.getClient(provider, providerConfig);
        
        // Check if provider has native streaming
        if (typeof client.generateTextStream === 'function') {
            // Use native streaming
            const stream = client.generateTextStream({
                model,
                prompt,
                system,
                temperature,
                maxTokens
            });
            
            for await (const chunk of stream) {
                totalChunks++;
                fullText += chunk.content || '';
                yield {
                    type: 'chunk',
                    content: chunk.content,
                    index: totalChunks
                };
            }
        } else {
            // Simulate streaming with chunked response
            // Use llm.generateText to go through the queue
            const result = await llm.generateText({
                provider,
                providerConfig,
                model,
                prompt,
                system,
                temperature,
                maxTokens,
                context: 'streaming',
                priority: 'high' // Streaming is usually interactive
            });
            
            if (!result.success) {
                yield { type: 'error', error: result.error };
                return;
            }
            
            // Chunk the response for simulated streaming
            const text = result.text || '';
            const chunkSize = 20; // Characters per chunk
            
            for (let i = 0; i < text.length; i += chunkSize) {
                const chunk = text.slice(i, i + chunkSize);
                totalChunks++;
                fullText += chunk;
                
                yield {
                    type: 'chunk',
                    content: chunk,
                    index: totalChunks
                };
                
                // Small delay to simulate streaming
                await new Promise(r => setTimeout(r, 10));
            }
        }
        
        const latency = Date.now() - startTime;
        
        yield {
            type: 'done',
            fullText,
            totalChunks,
            latencyMs: latency,
            usage: {
                inputTokens: Math.ceil(prompt.length / 4),
                outputTokens: Math.ceil(fullText.length / 4)
            }
        };
        
        console.log(`[LLM] Stream complete: provider=${provider}, chunks=${totalChunks}, latency=${latency}ms`);
        
    } catch (error) {
        yield {
            type: 'error',
            error: error.message
        };
    }
}

/**
 * Create SSE response writer
 * @param {http.ServerResponse} res - HTTP response object
 * @returns {object} Writer with write(), error(), and close() methods
 */
function createSSEWriter(res) {
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
    });
    
    return {
        /**
         * Write a chunk to the stream
         * @param {string} event - Event name
         * @param {object} data - Event data
         */
        write(event, data) {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        
        /**
         * Write an error event
         * @param {string} error - Error message
         */
        error(error) {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ error })}\n\n`);
        },
        
        /**
         * Close the stream
         */
        close() {
            res.write(`event: done\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        }
    };
}

/**
 * Stream a GraphRAG query response via SSE
 * @param {http.ServerResponse} res - HTTP response
 * @param {GraphRAGEngine} engine - GraphRAG engine instance
 * @param {string} query - User query
 * @param {object} options - Query options
 */
async function streamGraphRAGQuery(res, engine, query, options = {}) {
    const writer = createSSEWriter(res);
    const startTime = Date.now();
    
    try {
        // Step 1: Classify query
        writer.write('step', { step: 'classify', message: 'Analyzing query...' });
        const queryAnalysis = await engine.classifyQuery(query);
        
        // Step 2: Search
        writer.write('step', { step: 'search', message: 'Searching knowledge base...' });
        const searchResults = await engine.hybridSearch(query, { ...options, queryAnalysis });
        writer.write('sources', { count: searchResults.length, sources: searchResults.slice(0, 5) });
        
        // Step 3: Generate response with streaming
        writer.write('step', { step: 'generate', message: 'Generating response...' });
        
        // Build context from search results
        const context = searchResults.map(r => r.content || JSON.stringify(r.data)).join('\n\n');
        
        // Stream the LLM response
        const streamGen = generateTextStream({
            provider: engine.llmProvider,
            model: engine.llmModel,
            prompt: `Based on the following context, answer the question.\n\nContext:\n${context}\n\nQuestion: ${query}`,
            system: 'You are a helpful assistant that answers questions based on the provided context. Be concise and accurate.',
            temperature: 0.3,
            providerConfig: engine.llmConfig
        });
        
        for await (const chunk of streamGen) {
            if (chunk.type === 'chunk') {
                writer.write('chunk', { content: chunk.content });
            } else if (chunk.type === 'error') {
                writer.error(chunk.error);
                return;
            } else if (chunk.type === 'done') {
                writer.write('complete', {
                    fullText: chunk.fullText,
                    latencyMs: Date.now() - startTime,
                    usage: chunk.usage,
                    sources: searchResults.length
                });
            }
        }
        
        writer.close();
        
    } catch (error) {
        console.error('[Streaming] Error:', error);
        writer.error(error.message);
        res.end();
    }
}

module.exports = {
    generateTextStream,
    createSSEWriter,
    streamGraphRAGQuery
};
