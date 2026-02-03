/**
 * MiniMax Provider Adapter
 * Supports MiniMax M2 API (OpenAI-compatible)
 * https://minimax-m2.com/docs/api/
 */

const BaseLLMProvider = require('./base');

class MiniMaxProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'minimax';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://minimax-m2.com/api/v1';
        this.groupId = config.groupId; // Some MiniMax features require group ID
    }

    static get capabilities() {
        return {
            listModels: false, // MiniMax doesn't have a public models endpoint
            text: true,
            vision: true, // MiniMax M2 supports vision
            embeddings: true // MiniMax has embedding models
        };
    }

    static get info() {
        return {
            id: 'minimax',
            label: 'MiniMax',
            capabilities: this.capabilities,
            defaultModels: ['MiniMax-M2', 'MiniMax-M2-Stable']
        };
    }

    isConfigured() {
        return !!(this.apiKey);
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };
        if (this.groupId) {
            headers['X-Group-Id'] = this.groupId;
        }
        return headers;
    }

    async testConnection() {
        if (!this.apiKey) {
            return { ok: false, error: this.createError('test', 'API key not configured') };
        }

        try {
            // Test with a minimal completion request
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/chat/completions`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        model: 'MiniMax-M2',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 10
                    })
                },
                15000
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
        // MiniMax doesn't have a public models list endpoint
        // Return known models
        const defaultModels = [
            { name: 'MiniMax-M2', description: 'Primary model, 204K context' },
            { name: 'MiniMax-M2-Stable', description: 'High concurrency version' }
        ];

        return {
            textModels: defaultModels,
            visionModels: defaultModels, // M2 supports vision
            embeddingModels: [
                { name: 'embo-01', description: 'MiniMax Embedding model' }
            ]
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
                model: model || 'MiniMax-M2',
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
            // Build content array with text and images (OpenAI format)
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
                model: model || 'MiniMax-M2',
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
                600000 // 10 minute timeout
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
                model: model || 'embo-01',
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

            return {
                success: true,
                embeddings
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = MiniMaxProvider;
