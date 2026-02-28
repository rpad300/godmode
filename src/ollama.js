/**
 * Purpose:
 *   HTTP client wrapper for the local Ollama LLM server. Provides text generation,
 *   vision (image) inference, chat completions, embeddings, and model management
 *   (list, pull, unload) against the Ollama REST API.
 *
 * Responsibilities:
 *   - Discover and categorize available models (text vs vision vs embedding)
 *   - Select the best model for a given task type using a "largest-first" heuristic
 *   - Execute generate / chat / embed requests with configurable timeouts
 *   - Stream token-by-token output via an async generator
 *   - Pull (download) models with progress reporting
 *   - Unload models from GPU/RAM to free resources
 *   - Provide cosine-similarity search over embedding vectors (lightweight RAG helper)
 *
 * Key dependencies:
 *   - http (Node built-in): all Ollama communication is plain HTTP, no TLS
 *   - ./logger: structured logging (pino child)
 *
 * Side effects:
 *   - Network I/O to the Ollama daemon (default 127.0.0.1:11434)
 *   - generateVision reads image files from disk synchronously (fs.readFileSync)
 *   - pullModel triggers a potentially long-running download on the Ollama server
 *   - unloadModel frees GPU/RAM on the Ollama server
 *
 * Notes:
 *   - Vision model detection relies on a hardcoded name-substring list; new vision
 *     models must be added to isVisionModel() to be recognized.
 *   - "Best model" selection sorts by raw file size, which is a rough proxy for
 *     quality but not always accurate (quantization, architecture differences).
 *   - qwen3 models may return output in the `thinking` field instead of `response`;
 *     the generate() method handles this quirk.
 *   - Timeouts vary significantly by endpoint: 10 min for vision, 5 min for text
 *     generate, 2 min for chat, 1 min for embeddings, 30 s default.
 */

const http = require('http');
const { logger } = require('./logger');

const log = logger.child({ module: 'ollama' });

class OllamaClient {
    constructor(host = '127.0.0.1', port = 11434) {
        this.host = host;
        this.port = port;
        this.baseUrl = `http://${host}:${port}`;
    }

    /**
     * Update connection settings
     */
    configure(host, port) {
        this.host = host;
        this.port = port;
        this.baseUrl = `http://${host}:${port}`;
    }

    /**
     * Low-level HTTP request to the Ollama REST API.
     *
     * Parses the response body as JSON when possible; falls back to raw
     * string on parse failure so callers always get *something* back.
     * Never rejects on HTTP-level errors (4xx/5xx) -- only on transport
     * failures (ECONNREFUSED, timeout, etc.).
     *
     * @param {string} path - API endpoint path (e.g. '/api/generate')
     * @param {string} method - HTTP method
     * @param {object} body - Request body, will be JSON-stringified
     * @param {number} timeout - Socket timeout in ms (default 30 s)
     * @returns {Promise<{status: number, data: object|string|null}>}
     * @throws {Error} On connection failure or socket timeout
     */
    async request(path, method = 'GET', body = null, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: timeout
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({
                            status: res.statusCode,
                            data: data ? JSON.parse(data) : null
                        });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Connection timeout'));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    /**
     * Test connection to Ollama server
     */
    async testConnection() {
        try {
            const response = await this.request('/api/tags');
            return {
                connected: response.status === 200,
                models: response.data?.models || [],
                error: null
            };
        } catch (error) {
            return {
                connected: false,
                models: [],
                error: error.message
            };
        }
    }

    /**
     * Get list of available models
     */
    async getModels() {
        try {
            const response = await this.request('/api/tags');
            if (response.status === 200 && response.data?.models) {
                return response.data.models.map(m => ({
                    name: m.name,
                    size: m.size,
                    modified: m.modified_at,
                    digest: m.digest
                }));
            }
            return [];
        } catch (error) {
            log.warn({ event: 'ollama_models_error', reason: error.message }, 'Error fetching models');
            return [];
        }
    }

    /**
     * Determine whether a model supports image/vision input.
     *
     * Uses a hardcoded substring list -- must be updated when Ollama
     * adds new multimodal models.
     *
     * @param {string} modelName - Full model name from Ollama (e.g. 'llava:7b')
     * @returns {boolean}
     */
    isVisionModel(modelName) {
        const visionModels = [
            'minicpm-v', 'qwen2-vl', 'qwen3-vl', 'llava', 'bakllava',
            'moondream', 'llama-vision', 'gemma3', 'granite3.2-vision',
            'granite-vision', 'llama3.2-vision', 'qwen2.5-vl'
        ];
        return visionModels.some(vm => modelName.toLowerCase().includes(vm));
    }

    /**
     * Select the best locally-available model for a task type.
     *
     * Strategy: prefer models matching the requested capability (vision vs text),
     * then pick the largest by file size as a rough quality proxy.
     * Falls back across categories -- e.g. a vision task will use a text model
     * if no vision model is installed, and vice versa.
     *
     * @param {string} taskType - 'vision' for images/scanned PDFs, 'text' for text documents
     * @returns {Promise<{model: string, type: string}|null>} null when no models installed
     */
    async findBestModel(taskType = 'text') {
        const models = await this.getModels();
        if (models.length === 0) return null;

        // Separate vision and text models
        const visionModels = models.filter(m => this.isVisionModel(m.name));
        const textModels = models.filter(m => !this.isVisionModel(m.name));

        if (taskType === 'vision') {
            // Prefer vision models, fallback to text
            if (visionModels.length > 0) {
                // Sort by size (larger = better) and return the best
                visionModels.sort((a, b) => (b.size || 0) - (a.size || 0));
                return { model: visionModels[0].name, type: 'vision' };
            }
            // No vision model, return best text model
            if (textModels.length > 0) {
                textModels.sort((a, b) => (b.size || 0) - (a.size || 0));
                return { model: textModels[0].name, type: 'text' };
            }
        } else {
            // For text tasks, prefer text models
            if (textModels.length > 0) {
                textModels.sort((a, b) => (b.size || 0) - (a.size || 0));
                return { model: textModels[0].name, type: 'text' };
            }
            // Fallback to vision model for text
            if (visionModels.length > 0) {
                visionModels.sort((a, b) => (b.size || 0) - (a.size || 0));
                return { model: visionModels[0].name, type: 'vision' };
            }
        }

        return null;
    }

    /**
     * Get categorized models (vision vs text)
     */
    async getCategorizedModels() {
        const models = await this.getModels();
        return {
            vision: models.filter(m => this.isVisionModel(m.name)),
            text: models.filter(m => !this.isVisionModel(m.name)),
            all: models
        };
    }

    /**
     * Pull (download) a model from the Ollama registry.
     *
     * Streams newline-delimited JSON progress events from the server.
     * Never rejects -- always resolves with {success, error?} so callers
     * can handle failure without try/catch.
     *
     * @param {string} modelName - Model identifier (e.g. 'llava', 'llama3.2')
     * @param {function|null} onProgress - Called with {status, completed, total, percent}
     * @returns {Promise<{success: boolean, error?: string, status?: string}>}
     * @side-effect Triggers a potentially multi-GB download on the Ollama host
     */
    async pullModel(modelName, onProgress = null) {
        return new Promise((resolve) => {
            const url = new URL('/api/pull', this.baseUrl);
            const body = JSON.stringify({ name: modelName, stream: true });

            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const req = http.request(options, (res) => {
                let lastStatus = '';

                res.on('data', (chunk) => {
                    const lines = chunk.toString().split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.status) {
                                lastStatus = data.status;
                                if (onProgress) {
                                    onProgress({
                                        status: data.status,
                                        completed: data.completed || 0,
                                        total: data.total || 0,
                                        percent: data.total ? Math.round((data.completed / data.total) * 100) : 0
                                    });
                                }
                            }
                            if (data.error) {
                                resolve({ success: false, error: data.error });
                            }
                        } catch (e) { /* ignore parse errors */ }
                    }
                });

                res.on('end', () => {
                    if (lastStatus === 'success' || lastStatus.includes('success')) {
                        resolve({ success: true });
                    } else {
                        resolve({ success: true, status: lastStatus });
                    }
                });
            });

            req.on('error', (e) => {
                resolve({ success: false, error: e.message });
            });

            req.write(body);
            req.end();
        });
    }

    /**
     * Get recommended models for document processing
     */
    getRecommendedModels() {
        return {
            vision: [
                { name: 'qwen3-vl:8b', description: 'Best quality vision model (recommended)', size: '5GB' },
                { name: 'minicpm-v:latest', description: 'Efficient vision model', size: '5GB' },
                { name: 'llava:7b', description: 'Good for OCR and image analysis', size: '4.7GB' },
                { name: 'llama3.2-vision:11b', description: 'Meta vision model', size: '7GB' }
            ],
            text: [
                { name: 'qwen3:30b', description: 'Best quality (recommended)', size: '18GB' },
                { name: 'qwen3:14b', description: 'Good balance of speed/quality', size: '8GB' },
                { name: 'qwen3:8b', description: 'Fast and efficient', size: '5GB' },
                { name: 'phi3:mini', description: 'Lightweight and fast', size: '2GB' }
            ]
        };
    }

    /**
     * Generate a text completion (non-streaming).
     *
     * Handles the qwen3 quirk where output lands in the `thinking` field
     * instead of `response`. Supports optional base64-encoded images for
     * vision models.
     *
     * @param {string} model - Model name to use
     * @param {string} prompt - The prompt text
     * @param {object} options - temperature, maxTokens, images (base64[])
     * @returns {Promise<{success: boolean, response?: string, context?: any,
     *           totalDuration?: number, evalCount?: number, error?: string}>}
     */
    async generate(model, prompt, options = {}) {
        try {
            const requestBody = {
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    num_predict: options.maxTokens || 4096,
                    ...options
                }
            };

            if (options.format) {
                requestBody.format = options.format;
            }

            // Add images for vision models
            const hasImages = options.images && options.images.length > 0;
            if (hasImages) {
                requestBody.images = options.images; // Array of base64 encoded images
            }

            // Use longer timeout for processing (10 minutes for vision, 5 minutes for text)
            // Large models like qwen3:30b need more time
            const timeout = hasImages ? 600000 : 300000; // 10 min for vision, 5 min for text
            const response = await this.request('/api/generate', 'POST', requestBody, timeout);

            log.debug({ event: 'ollama_response', status: response.status, dataKeys: response.data ? Object.keys(response.data) : [] }, 'Ollama raw response');

            if (response.status === 200 && response.data) {
                // qwen3 models put output in 'thinking' field, others use 'response'
                let aiResponse = response.data.response;

                // If response is empty, check thinking field (for qwen3 models)
                if (!aiResponse && response.data.thinking) {
                    log.debug({ event: 'ollama_thinking_fallback' }, 'Using thinking field instead of response');
                    aiResponse = response.data.thinking;
                }

                log.debug({ event: 'ollama_response_preview', preview: aiResponse?.substring(0, 200) || 'STILL EMPTY' }, 'Final AI response');

                return {
                    success: true,
                    response: aiResponse,
                    context: response.data.context,
                    totalDuration: response.data.total_duration,
                    evalCount: response.data.eval_count
                };
            }
            return { success: false, error: 'Generation failed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Vision-specific generation convenience method.
     *
     * Reads image files from disk (synchronously), base64-encodes them,
     * and delegates to generate().
     *
     * @param {string} model - A vision-capable model name
     * @param {string} prompt - The prompt text
     * @param {string[]} imagePaths - Absolute paths to image files on disk
     * @param {object} options - Forwarded to generate()
     * @returns {Promise<object>} Same shape as generate() return
     * @side-effect Synchronous filesystem reads (fs.readFileSync)
     */
    async generateVision(model, prompt, imagePaths, options = {}) {
        const fs = require('fs');

        // Convert images to base64
        const images = imagePaths.map(imgPath => {
            const imageBuffer = fs.readFileSync(imgPath);
            return imageBuffer.toString('base64');
        });

        return this.generate(model, prompt, { ...options, images });
    }

    /**
     * Streaming text generation via an async generator.
     *
     * Yields one object per token: {token, done, context}. The caller
     * should iterate with `for await`. Handles newline-delimited JSON
     * chunking with a line buffer to avoid mid-JSON splits.
     *
     * @param {string} model - Model name
     * @param {string} prompt - The prompt text
     * @param {object} options - temperature, maxTokens
     * @yields {{token: string, done: boolean, context?: any}}
     */
    async *generateStream(model, prompt, options = {}) {
        const url = new URL('/api/generate', this.baseUrl);
        const body = JSON.stringify({
            model: model,
            prompt: prompt,
            stream: true,
            options: {
                temperature: options.temperature || 0.7,
                num_predict: options.maxTokens || 2048,
                ...options
            }
        });

        const requestOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const response = await new Promise((resolve, reject) => {
            const req = http.request(requestOptions, resolve);
            req.on('error', reject);
            req.write(body);
            req.end();
        });

        let buffer = '';
        for await (const chunk of response) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        yield {
                            token: data.response || '',
                            done: data.done || false,
                            context: data.context
                        };
                    } catch (e) {
                        // Skip malformed JSON
                    }
                }
            }
        }
    }

    /**
     * Chat completion (for conversation context)
     */
    async chat(model, messages, options = {}) {
        try {
            const response = await this.request('/api/chat', 'POST', {
                model: model,
                messages: messages,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    num_predict: options.maxTokens || 2048,
                    ...options
                }
            }, 120000); // 2 minute timeout for chat

            if (response.status === 200) {
                return {
                    success: true,
                    message: response.data.message,
                    totalDuration: response.data.total_duration
                };
            }
            return { success: false, error: 'Chat failed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== Embeddings for RAG ====================

    /**
     * Check if model is an embedding model
     */
    isEmbeddingModel(modelName) {
        const embedKeywords = ['nomic-embed', 'mxbai-embed', 'all-minilm', 'bge-', 'snowflake-arctic-embed'];
        return embedKeywords.some(kw => modelName.toLowerCase().includes(kw));
    }

    /**
     * Get available embedding models
     */
    async getEmbeddingModels() {
        const models = await this.getModels();
        return models.filter(m => this.isEmbeddingModel(m.name));
    }

    /**
     * Generate embedding for text
     * @param {string} model - Embedding model name (e.g., 'nomic-embed-text')
     * @param {string} text - Text to embed
     * @returns {Promise<{success: boolean, embedding?: number[], error?: string}>}
     */
    async embed(model, text) {
        try {
            const response = await this.request('/api/embeddings', 'POST', {
                model: model,
                prompt: text
            }, 60000); // 1 minute timeout

            if (response.status === 200 && response.data?.embedding) {
                return {
                    success: true,
                    embedding: response.data.embedding
                };
            }
            return { success: false, error: 'Embedding generation failed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate embeddings for multiple texts sequentially.
     *
     * Processes texts one at a time (no parallelism) to avoid overloading
     * the Ollama server. Failed embeddings are recorded as null placeholders
     * so the output array stays index-aligned with the input.
     *
     * @param {string} model - Embedding model name
     * @param {string[]} texts - Array of texts to embed
     * @param {function|null} onProgress - Called with {current, total, percent}
     * @returns {Promise<{success: boolean, embeddings: (number[]|null)[], errors?: object[]}>}
     */
    async embedBatch(model, texts, onProgress = null) {
        const embeddings = [];
        const errors = [];

        for (let i = 0; i < texts.length; i++) {
            const result = await this.embed(model, texts[i]);
            if (result.success) {
                embeddings.push(result.embedding);
            } else {
                errors.push({ index: i, error: result.error });
                embeddings.push(null); // Placeholder for failed embeddings
            }

            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: texts.length,
                    percent: Math.round(((i + 1) / texts.length) * 100)
                });
            }
        }

        return {
            success: errors.length === 0,
            embeddings,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    /**
     * Find most similar items from a list of embeddings
     * @param {number[]} queryEmbedding - The query embedding
     * @param {Array<{id: any, embedding: number[]}>} items - Items with embeddings
     * @param {number} topK - Number of results to return
     * @returns {Array<{id: any, similarity: number}>}
     */
    findSimilar(queryEmbedding, items, topK = 5) {
        const scored = items
            .filter(item => item.embedding && item.embedding.length > 0)
            .map(item => ({
                id: item.id,
                similarity: this.cosineSimilarity(queryEmbedding, item.embedding)
            }))
            .sort((a, b) => b.similarity - a.similarity);

        return scored.slice(0, topK);
    }

    /**
     * Unload a model from GPU/RAM to free memory.
     *
     * Works by sending a generate request with keep_alive: 0, which is the
     * documented Ollama mechanism for immediate eviction.
     *
     * @param {string} modelName - Name of the model to unload
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async unloadModel(modelName) {
        try {
            log.debug({ event: 'ollama_unload_start', modelName }, 'Unloading model');

            // Send a generate request with keep_alive: 0 to immediately unload
            const response = await this.request('/api/generate', 'POST', {
                model: modelName,
                prompt: '',
                keep_alive: 0
            }, 10000);

            if (response.status === 200) {
                log.debug({ event: 'ollama_unload_done', modelName }, 'Model unloaded');
                return { success: true };
            } else {
                return { success: false, error: `Status ${response.status}` };
            }
        } catch (error) {
            log.warn({ event: 'ollama_unload_error', modelName, reason: error.message }, 'Error unloading model');
            return { success: false, error: error.message };
        }
    }

    /**
     * Unload multiple models
     * @param {string[]} modelNames - Array of model names to unload
     * @returns {Promise<{success: boolean, unloaded: string[], errors: object}>}
     */
    async unloadModels(modelNames) {
        const results = {
            success: true,
            unloaded: [],
            errors: {}
        };

        for (const modelName of modelNames) {
            const result = await this.unloadModel(modelName);
            if (result.success) {
                results.unloaded.push(modelName);
            } else {
                results.errors[modelName] = result.error;
                results.success = false;
            }
        }

        return results;
    }
}

module.exports = OllamaClient;
