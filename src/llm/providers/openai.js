/**
 * OpenAI Provider Adapter
 * Supports OpenAI API and compatible endpoints (Azure, etc.)
 */

const BaseLLMProvider = require('./base');
const { logger: rootLogger } = require('../../logger');
const log = rootLogger.child({ module: 'llm-provider', provider: 'openai' });

class OpenAIProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'openai';
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        this.organization = config.organization;
        this.project = config.project;
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
            id: 'openai',
            label: 'OpenAI',
            capabilities: this.capabilities
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
        if (this.organization) {
            headers['OpenAI-Organization'] = this.organization;
        }
        if (this.project) {
            headers['OpenAI-Project'] = this.project;
        }
        return headers;
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
                10000 // 10 second timeout for test
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
                return { textModels: [], visionModels: [], embeddingModels: [] };
            }

            const models = response.data?.data || [];
            
            // Categorize models based on naming conventions
            const textModels = [];
            const visionModels = [];
            const embeddingModels = [];

            for (const model of models) {
                const id = model.id;
                const modelInfo = { name: id, created: model.created, owned_by: model.owned_by };

                if (id.includes('embedding')) {
                    embeddingModels.push(modelInfo);
                } else if (id.includes('gpt-4o') || id.includes('gpt-4-vision') || id.includes('vision')) {
                    visionModels.push(modelInfo);
                    textModels.push(modelInfo); // Vision models also support text
                } else if (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.includes('turbo')) {
                    textModels.push(modelInfo);
                }
            }

            // Sort by name
            textModels.sort((a, b) => a.name.localeCompare(b.name));
            visionModels.sort((a, b) => a.name.localeCompare(b.name));
            embeddingModels.sort((a, b) => a.name.localeCompare(b.name));

            return { textModels, visionModels, embeddingModels };
        } catch (error) {
            this.log('listModels', { error: error.message });
            return { textModels: [], visionModels: [], embeddingModels: [] };
        }
    }

    async generateText(options) {
        const { model, prompt, system, temperature = 0.7, maxTokens = 4096, jsonMode = false } = options;

        if (!this.apiKey) {
            return { success: false, error: 'API key not configured' };
        }

        const messages = [];
        if (system) {
            messages.push({ role: 'system', content: system });
        }
        messages.push({ role: 'user', content: prompt });

        // Newer models (gpt-4.1+, gpt-5, o1, o3, o4) use max_completion_tokens instead of max_tokens
        const useNewTokenParam = model && (
            model.startsWith('gpt-4.1') || 
            model.startsWith('gpt-4.5') || 
            model.startsWith('gpt-5') || 
            model.startsWith('o1') || 
            model.startsWith('o3') || 
            model.startsWith('o4')
        );
        
        const body = {
            model,
            messages,
            temperature
        };
        
        if (useNewTokenParam) {
            body.max_completion_tokens = maxTokens;
        } else {
            body.max_tokens = maxTokens;
        }

        if (jsonMode) {
            body.response_format = { type: 'json_object' };
        }

        const promptSize = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
        log.debug({ event: 'openai_request', model, promptSize, maxTokens, timeout: this.timeout }, 'Sending request');
        try {
            return await this.withRetry(async () => {
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
                    // Throw for retryable errors
                    if (this.isRetryableError(response.status)) {
                        const err = new Error(errorMsg);
                        err.statusCode = response.status;
                        throw err;
                    }
                    return { success: false, error: errorMsg, statusCode: response.status };
                }

                const choice = response.data?.choices?.[0];
                const usage = response.data?.usage;
                log.debug({ event: 'openai_response', status: response.status, finishReason: choice?.finish_reason }, 'Response received');
                let textContent = '';
                if (choice?.message?.content !== null && choice?.message?.content !== undefined) {
                    textContent = String(choice.message.content);
                }
                if (!textContent && choice?.message?.reasoning_content) {
                    textContent = String(choice.message.reasoning_content);
                }
                if (!textContent && choice?.message?.output) {
                    textContent = String(choice.message.output);
                }
                if (!textContent && choice?.text) {
                    textContent = String(choice.text);
                }
                if (!textContent && choice?.delta?.content) {
                    textContent = String(choice.delta.content);
                }
                if (!textContent && usage?.completion_tokens > 0) {
                    log.warn({ event: 'openai_empty_text', completionTokens: usage.completion_tokens }, 'Empty text but completion tokens used');
                }
                return {
                    success: true,
                    text: textContent,
                    usage: usage ? {
                        inputTokens: usage.prompt_tokens,
                        outputTokens: usage.completion_tokens
                    } : undefined,
                    finishReason: choice?.finish_reason,
                    raw: response.data
                };
            });
        } catch (error) {
            this.log('generateText', { error: error.message, model });
            return {
                success: false,
                error: error.message
            };
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
            const content = [{ type: 'text', text: prompt }];

            for (const img of images) {
                let base64Data;
                let mediaType = 'image/png';

                if (fs.existsSync(img)) {
                    base64Data = fs.readFileSync(img).toString('base64');
                    // Detect media type from extension
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

            // Newer models (gpt-4.1+, gpt-5, o1, o3, o4) use max_completion_tokens instead of max_tokens
            const useNewTokenParam = model && (
                model.startsWith('gpt-4.1') || 
                model.startsWith('gpt-4.5') || 
                model.startsWith('gpt-5') || 
                model.startsWith('o1') || 
                model.startsWith('o3') || 
                model.startsWith('o4')
            );
            
            const body = {
                model,
                messages: [{ role: 'user', content }],
                temperature
            };
            
            if (useNewTokenParam) {
                body.max_completion_tokens = maxTokens;
            } else {
                body.max_tokens = maxTokens;
            }

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/chat/completions`,
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
                model: model || 'text-embedding-3-small',
                input: texts
            };

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/embeddings`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(body)
                },
                60000 // 1 minute timeout
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

module.exports = OpenAIProvider;
