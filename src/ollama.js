/**
 * Ollama API Client
 * Handles communication with Ollama server for AI processing
 */

const http = require('http');

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
     * Make HTTP request to Ollama API
     * @param {string} path - API endpoint path
     * @param {string} method - HTTP method
     * @param {object} body - Request body
     * @param {number} timeout - Timeout in ms (default 30s, vision uses 600s)
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
            console.error('Error fetching models:', error.message);
            return [];
        }
    }

    /**
     * Check if model is multimodal (vision capable)
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
     * Find the best available model for a task
     * @param {string} taskType - 'vision' for images/scanned PDFs, 'text' for text documents
     * @returns {Promise<{model: string, type: string}|null>}
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
     * Pull/download a model from Ollama registry
     * @param {string} modelName - Name of model to pull (e.g., 'llava', 'llama3.2')
     * @param {function} onProgress - Callback for progress updates
     * @returns {Promise<{success: boolean, error?: string}>}
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
     * Generate completion (non-streaming)
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

            // Add images for vision models
            const hasImages = options.images && options.images.length > 0;
            if (hasImages) {
                requestBody.images = options.images; // Array of base64 encoded images
            }

            // Use longer timeout for processing (10 minutes for vision, 5 minutes for text)
            // Large models like qwen3:30b need more time
            const timeout = hasImages ? 600000 : 300000; // 10 min for vision, 5 min for text
            const response = await this.request('/api/generate', 'POST', requestBody, timeout);

            // Debug: Log raw Ollama response
            console.log(`Ollama raw response status: ${response.status}`);
            console.log(`Ollama raw data keys: ${response.data ? Object.keys(response.data).join(', ') : 'NO DATA'}`);

            if (response.status === 200 && response.data) {
                // qwen3 models put output in 'thinking' field, others use 'response'
                let aiResponse = response.data.response;

                // If response is empty, check thinking field (for qwen3 models)
                if (!aiResponse && response.data.thinking) {
                    console.log('Using thinking field instead of response');
                    aiResponse = response.data.thinking;
                }

                console.log(`Final AI response (first 200 chars): ${aiResponse?.substring(0, 200) || 'STILL EMPTY'}`);

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
     * Generate with vision (for image analysis)
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
     * Generate completion with streaming (returns async generator)
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
     * Generate embeddings for multiple texts (batch)
     * @param {string} model - Embedding model name
     * @param {string[]} texts - Array of texts to embed
     * @param {function} onProgress - Progress callback
     * @returns {Promise<{success: boolean, embeddings?: number[][], error?: string}>}
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
     * Unload a model from GPU/RAM to free memory
     * @param {string} modelName - Name of the model to unload
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async unloadModel(modelName) {
        try {
            console.log(`Unloading model: ${modelName}...`);

            // Send a generate request with keep_alive: 0 to immediately unload
            const response = await this.request('/api/generate', 'POST', {
                model: modelName,
                prompt: '',
                keep_alive: 0
            }, 10000);

            if (response.status === 200) {
                console.log(`Model unloaded: ${modelName}`);
                return { success: true };
            } else {
                return { success: false, error: `Status ${response.status}` };
            }
        } catch (error) {
            console.error(`Error unloading model ${modelName}:`, error.message);
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
