/**
 * Purpose:
 *   Enables real-time, incremental delivery of LLM output to the browser via
 *   Server-Sent Events (SSE). Supports both native provider streaming and a
 *   simulated fallback for providers that only offer synchronous completions.
 *
 * Responsibilities:
 *   - generateTextStream: async generator yielding { type: 'chunk' | 'done' | 'error' }
 *     objects, abstracting over native vs. simulated streaming
 *   - createSSEWriter: sets up the HTTP response headers for SSE and returns a
 *     write/error/close helper object for structured event emission
 *   - streamGraphRAGQuery: end-to-end streaming pipeline for GraphRAG queries
 *     (classify -> search -> stream LLM answer) with per-step progress events
 *
 * Key dependencies:
 *   - ./index (llm): getClient for native streaming, generateText for fallback
 *
 * Side effects:
 *   - Writes directly to the HTTP response object (res.writeHead, res.write, res.end)
 *   - Network calls to LLM provider APIs
 *
 * Notes:
 *   - When a provider lacks a generateTextStream method, the full response is fetched
 *     synchronously and then drip-fed in 20-character chunks with a 10 ms delay to
 *     simulate a streaming UX. This is intentionally simple; the chunk size and delay
 *     are not tuned for production throughput.
 *   - Token counts in the 'done' event are rough estimates (length / 4) when the
 *     provider does not report actual usage.
 *   - The X-Accel-Buffering: no header disables nginx proxy buffering so chunks reach
 *     the client immediately.
 */

const llm = require('./index');
const llmRouter = require('./router');
const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'llm-streaming' });

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
 * @param {string} [options.taskType='processing'] - Router task type (chat, processing, embeddings)
 * @yields {object} { type: 'chunk'|'done'|'error', content?: string, usage?: object, error?: string }
 */
async function* generateTextStream(options) {
    const { provider, model, prompt, system, temperature = 0.7, maxTokens = 4096, providerConfig = {}, config, taskType = 'processing' } = options;
    
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
            // Fallback: provider does not implement generateTextStream.
            // Fetch the full response synchronously via the router, then drip-feed
            // in small chunks to give the client a streaming-like experience.
            const routerResult = await llmRouter.routeAndExecute(taskType, 'generateText', {
                prompt,
                system,
                temperature,
                maxTokens,
                context: 'streaming',
                priority: 'high'
            }, config || { llm: { provider, providers: { [provider]: providerConfig }, models: { text: model } } });
            
            const fallbackResult = routerResult.result || routerResult;
            if (!routerResult.success) {
                yield { type: 'error', error: routerResult.error?.message || fallbackResult.error };
                return;
            }
            
            // Chunk the response for simulated streaming
            const text = fallbackResult.text || '';
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
        log.debug({ event: 'llm_stream_complete', provider, totalChunks, latencyMs: latency }, 'Stream complete');
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
async function streamGraphRAGQuery(res, engine, query, options = {}, config = null) {
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
        
        // Resolve provider/model via router if config available, otherwise use engine defaults
        let streamProvider = engine.llmProvider;
        let streamModel = engine.llmModel;
        let streamProviderConfig = engine.llmConfig;
        if (config) {
            const resolved = llmRouter.routeResolve('processing', 'generateText', config);
            if (resolved) {
                streamProvider = resolved.provider;
                streamModel = resolved.model;
                streamProviderConfig = resolved.providerConfig;
            }
        }

        // Stream the LLM response
        const streamGen = generateTextStream({
            provider: streamProvider,
            model: streamModel,
            prompt: `Based on the following context, answer the question.\n\nContext:\n${context}\n\nQuestion: ${query}`,
            system: 'You are a helpful assistant that answers questions based on the provided context. Be concise and accurate.',
            temperature: 0.3,
            providerConfig: streamProviderConfig,
            config,
            taskType: 'chat'
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
        log.warn({ event: 'streaming_error', reason: error?.message }, 'Streaming error');
        writer.error(error.message);
        res.end();
    }
}

module.exports = {
    generateTextStream,
    createSSEWriter,
    streamGraphRAGQuery
};
