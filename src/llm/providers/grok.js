/**
 * Grok (xAI) Provider Adapter
 * Supports xAI's Grok API (OpenAI-compatible)
 */

const BaseLLMProvider = require('./base');

class GrokProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'grok';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.x.ai/v1';
    }

    static get capabilities() {
        return {
            listModels: true,
            text: true,
            vision: true, // Grok 2 supports vision
            embeddings: true // Grok has embedding models
        };
    }

    static get info() {
        return {
            id: 'grok',
            label: 'Grok (xAI)',
            capabilities: this.capabilities
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
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/models`,
                { method: 'GET', headers: this.getHeaders() },
                10000
            );

            if (response.status === 200) {
                return { ok: true };
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
        if (!this.apiKey) {
            return { textModels: [], visionModels: [], embeddingModels: [] };
        }

        try {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/models`,
                { method: 'GET', headers: this.getHeaders() }
            );

            if (response.status !== 200) {
                this.log('listModels', { error: response.data?.error?.message });
                return { textModels: [], visionModels: [], embeddingModels: [] };
            }

            const models = response.data?.data || [];
            const textModels = [];
            const visionModels = [];
            const embeddingModels = [];

            for (const model of models) {
                const id = model.id;
                const modelInfo = { name: id, created: model.created, owned_by: model.owned_by };

                if (id.includes('embedding')) {
                    embeddingModels.push(modelInfo);
                } else if (id.includes('vision') || id.includes('grok-2')) {
                    // Grok 2 models support vision
                    visionModels.push(modelInfo);
                    textModels.push(modelInfo);
                } else if (id.includes('grok')) {
                    textModels.push(modelInfo);
                }
            }

            return { textModels, visionModels, embeddingModels };
        } catch (error) {
            this.log('listModels', { error: error.message });
            return { textModels: [], visionModels: [], embeddingModels: [] };
        }
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
                model,
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
        const { model, prompt, images, temperature = 0.7, maxTokens = 4096 } = options;
        const fs = require('fs');

        if (!this.apiKey) {
            return { success: false, error: 'API key not configured' };
        }

        try {
            const content = [{ type: 'text', text: prompt }];

            for (const img of images) {
                let base64Data;
                let mediaType = 'image/png';

                if (fs.existsSync(img)) {
                    base64Data = fs.readFileSync(img).toString('base64');
                    if (img.endsWith('.jpg') || img.endsWith('.jpeg')) {
                        mediaType = 'image/jpeg';
                    } else if (img.endsWith('.gif')) {
                        mediaType = 'image/gif';
                    } else if (img.endsWith('.webp')) {
                        mediaType = 'image/webp';
                    }
                } else {
                    base64Data = img;
                }

                content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${mediaType};base64,${base64Data}`
                    }
                });
            }

            const body = {
                model,
                messages: [{ role: 'user', content }],
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
                600000
            );

            if (response.status !== 200) {
                const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                return { success: false, error: errorMsg, statusCode: response.status };
            }

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

    async embed(options) {
        const { model, texts } = options;

        if (!this.apiKey) {
            return { success: false, error: 'API key not configured' };
        }

        try {
            const body = {
                model: model || 'grok-embedding',
                input: texts
            };

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/embeddings`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(body)
                },
                60000
            );

            if (response.status !== 200) {
                const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                return { success: false, error: errorMsg, statusCode: response.status };
            }

            const embeddings = response.data?.data?.map(d => d.embedding) || [];

            return { success: true, embeddings };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = GrokProvider;
