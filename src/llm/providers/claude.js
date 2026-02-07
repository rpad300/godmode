/**
 * Claude (Anthropic) Provider Adapter
 * Supports Anthropic's Claude API
 * https://platform.claude.com/docs/en/home
 */

const BaseLLMProvider = require('./base');

class ClaudeProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'claude';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
        this.apiVersion = config.apiVersion || '2023-06-01';
    }

    static get capabilities() {
        return {
            listModels: true, // Returns known Claude models
            text: true,
            vision: true,
            embeddings: false // Anthropic doesn't offer embeddings API
        };
    }

    static get info() {
        return {
            id: 'claude',
            label: 'Claude (Anthropic)',
            capabilities: this.capabilities,
            defaultModels: [
                'claude-sonnet-4-20250514',
                'claude-3-5-sonnet-20241022',
                'claude-3-5-haiku-20241022',
                'claude-3-opus-20240229'
            ]
        };
    }

    isConfigured() {
        return !!(this.apiKey);
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': this.apiVersion
        };
    }

    async testConnection() {
        if (!this.apiKey) {
            return { ok: false, error: this.createError('test', 'API key not configured') };
        }

        try {
            // Test with a minimal message request
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/messages`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        model: 'claude-3-5-haiku-20241022',
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'Hi' }]
                    })
                },
                15000
            );

            if (response.status === 200) {
                return { ok: true };
            }

            // Check for authentication errors
            if (response.status === 401) {
                return { ok: false, error: this.createError('test', 'Invalid API key') };
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
        // Anthropic doesn't have a list models endpoint
        // Return known Claude models
        const defaultModels = [
            { name: 'claude-sonnet-4-20250514', description: 'Claude 4.5 Sonnet - Latest' },
            { name: 'claude-3-5-sonnet-20241022', description: 'Claude 3.5 Sonnet' },
            { name: 'claude-3-5-haiku-20241022', description: 'Claude 3.5 Haiku - Fast' },
            { name: 'claude-3-opus-20240229', description: 'Claude 3 Opus - Most capable' },
            { name: 'claude-3-sonnet-20240229', description: 'Claude 3 Sonnet' },
            { name: 'claude-3-haiku-20240307', description: 'Claude 3 Haiku' }
        ];

        return {
            textModels: defaultModels,
            visionModels: defaultModels, // All Claude 3+ models support vision
            embeddingModels: [] // Anthropic doesn't have embeddings
        };
    }

    async generateText(options) {
        const { model, prompt, system, temperature = 0.7, maxTokens = 4096 } = options;

        if (!this.apiKey) {
            return { success: false, error: 'API key not configured' };
        }

        try {
            const body = {
                model: model || 'claude-3-5-sonnet-20241022',
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }]
            };

            if (system) {
                body.system = system;
            }

            if (temperature !== undefined) {
                body.temperature = temperature;
            }

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/messages`,
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

            const content = response.data?.content?.[0];
            const usage = response.data?.usage;

            return {
                success: true,
                text: content?.text || '',
                usage: usage ? {
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens
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
            // Build content array with text and images
            const content = [];

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
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mediaType,
                        data: base64Data
                    }
                });
            }

            content.push({ type: 'text', text: prompt });

            const body = {
                model: model || 'claude-3-5-sonnet-20241022',
                max_tokens: maxTokens,
                messages: [{ role: 'user', content }]
            };

            if (temperature !== undefined) {
                body.temperature = temperature;
            }

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/messages`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(body)
                },
                600000 // 10 minute timeout for vision
            );

            if (response.status !== 200) {
                const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                return { success: false, error: errorMsg, statusCode: response.status };
            }

            const contentResult = response.data?.content?.[0];
            const usage = response.data?.usage;

            return {
                success: true,
                text: contentResult?.text || '',
                usage: usage ? {
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens
                } : undefined,
                raw: response.data
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async embed(options) {
        return { success: false, error: 'Claude (Anthropic) does not support embeddings' };
    }
}

module.exports = ClaudeProvider;
