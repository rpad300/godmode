/**
 * DeepSeek Provider Adapter
 * Supports DeepSeek API (OpenAI-compatible)
 */

const BaseLLMProvider = require('./base');
const { logger: rootLogger } = require('../../logger');
const log = rootLogger.child({ module: 'llm-provider', provider: 'deepseek' });

class DeepSeekProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'deepseek';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.deepseek.com';
    }

    static get capabilities() {
        return {
            listModels: true, // DeepSeek has GET /models endpoint
            text: true,
            vision: false, // DeepSeek doesn't support vision
            embeddings: false // DeepSeek doesn't have embedding models
        };
    }

    static get info() {
        return {
            id: 'deepseek',
            label: 'DeepSeek',
            capabilities: this.capabilities,
            defaultModels: ['deepseek-chat', 'deepseek-reasoner'] // Manual model list
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
            // Test with a minimal completion request
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/chat/completions`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1
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
        try {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/models`,
                {
                    method: 'GET',
                    headers: this.getHeaders()
                },
                15000
            );

            if (response.status !== 200) {
                // Fallback to default models
                return this.getDefaultModels();
            }

            const models = response.data?.data || [];
            const textModels = models.map(m => ({
                id: m.id,
                name: m.id,
                description: m.id === 'deepseek-chat' ? 'DeepSeek V3.2 non-thinking mode' : 
                             m.id === 'deepseek-reasoner' ? 'DeepSeek V3.2 thinking mode (R1)' : m.id,
                contextWindow: 64000,
                maxOutputTokens: 8192,
                priceInput: m.id === 'deepseek-reasoner' ? 0.55 : 0.14,
                priceOutput: m.id === 'deepseek-reasoner' ? 2.19 : 0.28
            }));

            return {
                textModels,
                visionModels: [],
                embeddingModels: []
            };
        } catch (error) {
            log.warn({ event: 'deepseek_list_models_failed', reason: error.message }, 'Failed to list models');
            return this.getDefaultModels();
        }
    }

    getDefaultModels() {
        return {
            textModels: [
                { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, maxOutputTokens: 8192, priceInput: 0.14, priceOutput: 0.28 },
                { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000, maxOutputTokens: 8192, priceInput: 0.55, priceOutput: 2.19 }
            ],
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
                model: model || 'deepseek-chat',
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: false
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

            // DeepSeek reasoner may return thinking content
            let text = choice?.message?.content || '';
            
            // If using reasoner model, content might be in reasoning_content
            if (choice?.message?.reasoning_content) {
                this.log('generateText', { hasThinkingContent: true });
            }

            return {
                success: true,
                text,
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
        return { success: false, error: 'DeepSeek does not support vision' };
    }

    async embed(options) {
        return { success: false, error: 'DeepSeek does not support embeddings' };
    }
}

module.exports = DeepSeekProvider;
