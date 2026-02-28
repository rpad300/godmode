/**
 * Purpose:
 *   Provider adapter for Moonshot's Kimi K2 models via their OpenAI-compatible API.
 *   Text-only provider with dynamic model listing and hardcoded fallback.
 *
 * Responsibilities:
 *   - Text generation via chat/completions endpoint
 *   - Dynamic model discovery from /models, with graceful fallback to known defaults
 *
 * Key dependencies:
 *   - ./base (BaseLLMProvider): shared retry, error classification, HTTP helpers
 *
 * Side effects:
 *   - Network I/O to kimi-k2.ai (or custom baseUrl)
 *
 * Notes:
 *   - Vision and embeddings are NOT supported by Kimi K2.
 *   - Three model variants: kimi-k2 (128K context), kimi-k2-0905 (256K context,
 *     used as default), and kimi-k2-thinking (deep reasoning mode).
 *   - listModels has an identical hardcoded fallback in both the error branch and
 *     the non-200 branch; this duplication is intentional for resilience.
 *   - testConnection uses the /models GET endpoint rather than a chat completion,
 *     which is cheaper but means it only validates the API key, not model access.
 */

const BaseLLMProvider = require('./base');

class KimiProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'kimi';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://kimi-k2.ai/api/v1';
    }

    static get capabilities() {
        return {
            listModels: true,
            text: true,
            vision: false, // Kimi K2 doesn't mention vision support
            embeddings: false // No embeddings endpoint documented
        };
    }

    static get info() {
        return {
            id: 'kimi',
            label: 'Kimi K2',
            capabilities: this.capabilities,
            defaultModels: ['kimi-k2', 'kimi-k2-0905', 'kimi-k2-thinking']
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
                {
                    method: 'GET',
                    headers: this.getHeaders()
                },
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
                {
                    method: 'GET',
                    headers: this.getHeaders()
                }
            );

            if (response.status !== 200) {
                this.log('listModels', { error: response.data?.error?.message });
                // Return default models on failure
                return {
                    textModels: [
                        { name: 'kimi-k2', description: '128K context' },
                        { name: 'kimi-k2-0905', description: '256K context' },
                        { name: 'kimi-k2-thinking', description: 'Deep reasoning' }
                    ],
                    visionModels: [],
                    embeddingModels: []
                };
            }

            const models = response.data?.data || [];
            const textModels = models.map(m => ({
                name: m.id,
                owned_by: m.owned_by,
                created: m.created
            }));

            return {
                textModels,
                visionModels: [],
                embeddingModels: []
            };
        } catch (error) {
            this.log('listModels', { error: error.message });
            return {
                textModels: [
                    { name: 'kimi-k2', description: '128K context' },
                    { name: 'kimi-k2-0905', description: '256K context' },
                    { name: 'kimi-k2-thinking', description: 'Deep reasoning' }
                ],
                visionModels: [],
                embeddingModels: []
            };
        }
    }

    async generateText(options) {
        const { model, prompt, system, temperature = 0.7, maxTokens = 4096, jsonMode = false } = options;

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
                model: model || 'kimi-k2-0905',
                messages,
                temperature,
                max_tokens: maxTokens
            };

            if (jsonMode) {
                body.response_format = { type: 'json_object' };
            }

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
        return { success: false, error: 'Kimi K2 does not support vision' };
    }

    async embed(options) {
        return { success: false, error: 'Kimi K2 does not support embeddings' };
    }
}

module.exports = KimiProvider;
