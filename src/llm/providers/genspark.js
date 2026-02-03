/**
 * Genspark Provider Adapter
 * Supports Genspark API
 */

const BaseLLMProvider = require('./base');

class GenSparkProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'genspark';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.genspark.ai/v1';
    }

    static get capabilities() {
        return {
            listModels: false, // Genspark may not have a public models endpoint
            text: true,
            vision: false,
            embeddings: false
        };
    }

    static get info() {
        return {
            id: 'genspark',
            label: 'Genspark',
            capabilities: this.capabilities,
            defaultModels: ['genspark-default'] // Placeholder
        };
    }

    isConfigured() {
        return !!(this.apiKey);
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };
    }

    async testConnection() {
        if (!this.apiKey) {
            return { ok: false, error: this.createError('test', 'API key not configured') };
        }

        try {
            // Try to make a minimal request to test connection
            // Adjust endpoint based on actual Genspark API documentation
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/chat/completions`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        model: 'genspark-default',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1
                    })
                },
                15000
            );

            if (response.status === 200) {
                return { ok: true };
            }

            // Check if it's just an invalid model but connection works
            if (response.status === 400) {
                return { ok: true }; // Connection works, model might need adjustment
            }

            const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
            return {
                ok: false,
                error: this.createError('test', errorMsg, response.status, response.status >= 500)
            };
        } catch (error) {
            return {
                ok: false,
                error: this.createError('test', error.message, null, true)
            };
        }
    }

    async listModels() {
        // Genspark doesn't have a public models endpoint
        // Return empty or use manual models from config
        if (this.config.manualModels) {
            const models = this.config.manualModels.split(',').map(m => m.trim()).filter(m => m);
            return {
                textModels: models.map(name => ({ name, manual: true })),
                visionModels: [],
                embeddingModels: []
            };
        }

        return {
            textModels: [{ name: 'genspark-default', manual: true }],
            visionModels: [],
            embeddingModels: []
        };
    }

    async generateText(options) {
        const { model, prompt, system, temperature = 0.7, maxTokens = 4096 } = options;

        if (!this.apiKey) {
            return { success: false, error: 'API key not configured' };
        }

        try {
            const messages = [];
            if (system) {
                messages.push({ role: 'system', content: system });
            }
            messages.push({ role: 'user', content: prompt });

            const body = {
                model: model || 'genspark-default',
                messages,
                temperature,
                max_tokens: maxTokens
            };

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/chat/completions`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(body)
                },
                this.timeout
            );

            if (response.status !== 200) {
                const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                return { success: false, error: errorMsg, statusCode: response.status };
            }

            // Assume OpenAI-compatible response format
            const choice = response.data?.choices?.[0];
            const usage = response.data?.usage;

            return {
                success: true,
                text: choice?.message?.content || '',
                usage: usage ? {
                    inputTokens: usage.prompt_tokens,
                    outputTokens: usage.completion_tokens
                } : undefined,
                raw: response.data
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async generateVision(options) {
        return { success: false, error: 'Genspark does not support vision' };
    }

    async embed(options) {
        return { success: false, error: 'Genspark does not support embeddings' };
    }
}

module.exports = GenSparkProvider;
