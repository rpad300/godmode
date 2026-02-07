/**
 * Google Gemini Provider Adapter
 * Supports Google's Generative AI API
 */

const BaseLLMProvider = require('./base');

class GeminiProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'gemini';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
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
            id: 'gemini',
            label: 'Google Gemini',
            capabilities: this.capabilities
        };
    }

    isConfigured() {
        return !!(this.apiKey);
    }

    async testConnection() {
        if (!this.apiKey) {
            return { ok: false, error: this.createError('test', 'API key not configured') };
        }

        try {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/models?key=${this.apiKey}`,
                { method: 'GET', headers: { 'Content-Type': 'application/json' } },
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
                `${this.baseUrl}/models?key=${this.apiKey}`,
                { method: 'GET', headers: { 'Content-Type': 'application/json' } }
            );

            if (response.status !== 200) {
                this.log('listModels', { error: response.data?.error?.message });
                return { textModels: [], visionModels: [], embeddingModels: [] };
            }

            const models = response.data?.models || [];
            const textModels = [];
            const visionModels = [];
            const embeddingModels = [];

            for (const model of models) {
                const name = model.name.replace('models/', '');
                const modelInfo = {
                    name,
                    displayName: model.displayName,
                    description: model.description
                };

                const methods = model.supportedGenerationMethods || [];

                if (name.includes('embedding')) {
                    embeddingModels.push(modelInfo);
                } else if (methods.includes('generateContent')) {
                    textModels.push(modelInfo);
                    // Gemini 1.5 and later support vision natively
                    if (name.includes('gemini-1.5') || name.includes('gemini-2') || name.includes('gemini-pro-vision')) {
                        visionModels.push(modelInfo);
                    }
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
            const contents = [];
            
            // Add system instruction if provided
            if (system) {
                contents.push({
                    role: 'user',
                    parts: [{ text: system }]
                });
                contents.push({
                    role: 'model',
                    parts: [{ text: 'Understood. I will follow these instructions.' }]
                });
            }

            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });

            const body = {
                contents,
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens
                }
            };

            const modelPath = model.startsWith('models/') ? model : `models/${model}`;
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/${modelPath}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                },
                this.timeout
            );

            if (response.status !== 200) {
                const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                return { success: false, error: errorMsg, statusCode: response.status };
            }

            const candidate = response.data?.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text || '';
            const usage = response.data?.usageMetadata;

            return {
                success: true,
                text,
                usage: usage ? {
                    inputTokens: usage.promptTokenCount,
                    outputTokens: usage.candidatesTokenCount
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
            const parts = [{ text: prompt }];

            for (const img of images) {
                let base64Data;
                let mimeType = 'image/png';

                if (fs.existsSync(img)) {
                    base64Data = fs.readFileSync(img).toString('base64');
                    if (img.endsWith('.jpg') || img.endsWith('.jpeg')) {
                        mimeType = 'image/jpeg';
                    } else if (img.endsWith('.gif')) {
                        mimeType = 'image/gif';
                    } else if (img.endsWith('.webp')) {
                        mimeType = 'image/webp';
                    }
                } else {
                    base64Data = img;
                }

                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
            }

            const body = {
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens
                }
            };

            const modelPath = model.startsWith('models/') ? model : `models/${model}`;
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/${modelPath}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                },
                600000 // 10 minute timeout
            );

            if (response.status !== 200) {
                const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                return { success: false, error: errorMsg, statusCode: response.status };
            }

            const candidate = response.data?.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text || '';
            const usage = response.data?.usageMetadata;

            return {
                success: true,
                text,
                usage: usage ? {
                    inputTokens: usage.promptTokenCount,
                    outputTokens: usage.candidatesTokenCount
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
            const embeddingModel = model || 'text-embedding-004';
            const modelPath = embeddingModel.startsWith('models/') ? embeddingModel : `models/${embeddingModel}`;
            
            // Gemini embedding API processes one text at a time, so batch them
            const embeddings = [];

            for (const text of texts) {
                const body = {
                    content: {
                        parts: [{ text }]
                    }
                };

                const response = await this.fetchWithTimeout(
                    `${this.baseUrl}/${modelPath}:embedContent?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    },
                    60000
                );

                if (response.status !== 200) {
                    const errorMsg = response.data?.error?.message || `HTTP ${response.status}`;
                    return { success: false, error: errorMsg, statusCode: response.status };
                }

                embeddings.push(response.data?.embedding?.values || []);
            }

            return { success: true, embeddings };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = GeminiProvider;
