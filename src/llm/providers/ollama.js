/**
 * Purpose:
 *   Provider adapter for locally-running Ollama instances. Unlike all other
 *   providers, this does NOT make direct HTTP calls -- it delegates to the
 *   existing OllamaClient class which handles the Ollama-specific REST API.
 *
 * Responsibilities:
 *   - Adapt OllamaClient's interface to the BaseLLMProvider contract
 *   - Full feature coverage: text, vision, embeddings, model listing
 *   - Expose Ollama-specific operations (unloadModels, pullModel,
 *     getCategorizedModels, getRecommendedModels) not available on cloud providers
 *
 * Key dependencies:
 *   - ./base (BaseLLMProvider): base class (though most HTTP helpers are unused here)
 *   - ../../ollama (OllamaClient): actual Ollama REST API client
 *
 * Side effects:
 *   - Network I/O to local Ollama server (default 127.0.0.1:11434)
 *   - Filesystem reads when images are passed as file paths in generateVision
 *   - pullModel triggers model downloads that consume disk space and bandwidth
 *   - unloadModels frees GPU/RAM on the local machine
 *
 * Notes:
 *   - No API key required; isConfigured() only checks host + port.
 *   - System prompts are concatenated into the user prompt (no separate system
 *     field in Ollama's generate API), which is a lossy approximation.
 *   - Ollama does not report input token counts, so usage.inputTokens is always 0.
 *   - The extra methods (pullModel, unloadModels, etc.) go beyond the base class
 *     contract and are used by Ollama-specific API routes.
 */

const BaseLLMProvider = require('./base');
const OllamaClient = require('../../ollama');

class OllamaProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'ollama';
        this.host = config.host || '127.0.0.1';
        this.port = config.port || 11434;
        this.client = new OllamaClient(this.host, this.port);
    }

    static get capabilities() {
        return {
            listModels: true,
            text: true,
            vision: true,
            embeddings: true
        };
    }

    static get info() {
        return {
            id: 'ollama',
            label: 'Ollama (Local)',
            capabilities: this.capabilities
        };
    }

    isConfigured() {
        return !!(this.host && this.port);
    }

    async testConnection() {
        try {
            const result = await this.client.testConnection();
            if (result.connected) {
                return { ok: true, models: result.models?.length || 0 };
            }
            return {
                ok: false,
                error: this.createError('test', result.error || 'Connection failed')
            };
        } catch (error) {
            return {
                ok: false,
                error: this.createError('test', error.message, null, true)
            };
        }
    }

    async listModels() {
        try {
            const categorized = await this.client.getCategorizedModels();
            const embeddingModels = await this.client.getEmbeddingModels();

            return {
                textModels: categorized.text.map(m => ({
                    name: m.name,
                    size: m.size,
                    modified: m.modified
                })),
                visionModels: categorized.vision.map(m => ({
                    name: m.name,
                    size: m.size,
                    modified: m.modified
                })),
                embeddingModels: embeddingModels.map(m => ({
                    name: m.name,
                    size: m.size,
                    modified: m.modified
                }))
            };
        } catch (error) {
            this.log('listModels', { error: error.message });
            return { textModels: [], visionModels: [], embeddingModels: [] };
        }
    }

    async generateText(options) {
        const { model, prompt, system, temperature = 0.7, maxTokens = 4096 } = options;

        try {
            // Ollama's generate API has no dedicated system-prompt field, so we
            // concatenate system + user prompt. This loses the semantic distinction
            // but is the best available approximation for single-turn generation.
            let fullPrompt = prompt;
            if (system) {
                fullPrompt = `${system}\n\n${prompt}`;
            }

            const result = await this.client.generate(model, fullPrompt, {
                temperature,
                maxTokens
            });

            if (result.success) {
                return {
                    success: true,
                    text: result.response,
                    usage: result.evalCount ? {
                        inputTokens: 0, // Ollama doesn't provide input tokens
                        outputTokens: result.evalCount
                    } : undefined,
                    raw: result
                };
            }

            return {
                success: false,
                error: result.error || 'Generation failed'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateVision(options) {
        const { model, prompt, images, temperature = 0.7, maxTokens = 4096 } = options;
        const fs = require('fs');

        try {
            // Convert file paths to base64 if needed
            const base64Images = images.map(img => {
                if (fs.existsSync(img)) {
                    return fs.readFileSync(img).toString('base64');
                }
                // Assume already base64
                return img;
            });

            const result = await this.client.generate(model, prompt, {
                temperature,
                maxTokens,
                images: base64Images
            });

            if (result.success) {
                return {
                    success: true,
                    text: result.response,
                    usage: result.evalCount ? {
                        inputTokens: 0,
                        outputTokens: result.evalCount
                    } : undefined,
                    raw: result
                };
            }

            return {
                success: false,
                error: result.error || 'Vision generation failed'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async embed(options) {
        const { model, texts } = options;

        try {
            const result = await this.client.embedBatch(model, texts);

            if (result.success) {
                return {
                    success: true,
                    embeddings: result.embeddings
                };
            }

            return {
                success: false,
                error: result.errors?.[0]?.error || 'Embedding failed'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Unload models from GPU/RAM (Ollama-specific)
     * @param {string[]} modelNames - Model names to unload
     * @returns {Promise<{success: boolean, unloaded: string[], errors: object}>}
     */
    async unloadModels(modelNames) {
        return this.client.unloadModels(modelNames);
    }

    /**
     * Pull/download a model from Ollama registry (Ollama-specific)
     * @param {string} modelName - Model name to pull
     * @param {function} onProgress - Optional progress callback
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async pullModel(modelName, onProgress = null) {
        return this.client.pullModel(modelName, onProgress);
    }

    /**
     * Get categorized models (vision vs text) for /api/ollama/models compatibility
     * @returns {Promise<{vision: Array, text: Array, all: Array}>}
     */
    async getCategorizedModels() {
        return this.client.getCategorizedModels();
    }

    /**
     * Get recommended models for download (static list)
     * @returns {{vision: Array, text: Array}>}
     */
    getRecommendedModels() {
        return this.client.getRecommendedModels();
    }
}

module.exports = OllamaProvider;
