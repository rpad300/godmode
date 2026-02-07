/**
 * Provider Fixtures for Preflight Testing
 * Contains mock request/response patterns for all LLM providers
 */

// OpenAI-style fixtures (used by OpenAI, Grok, DeepSeek, Genspark, Kimi)
const openaiStyleFixtures = {
    listModels: {
        match: { method: 'GET', pathPattern: /\/v1\/models/ },
        respond: {
            status: 200,
            json: {
                data: [
                    { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
                    { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
                    { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
                    { id: 'text-embedding-3-small', object: 'model', owned_by: 'openai' }
                ]
            }
        }
    },
    generateText: {
        match: { method: 'POST', pathPattern: /\/v1\/chat\/completions/ },
        respond: {
            status: 200,
            json: {
                id: 'chatcmpl-test123',
                object: 'chat.completion',
                created: Date.now(),
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: 'This is a test response from the mock LLM.' },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
            }
        }
    },
    embed: {
        match: { method: 'POST', pathPattern: /\/v1\/embeddings/ },
        respond: {
            status: 200,
            json: {
                object: 'list',
                data: [
                    { object: 'embedding', index: 0, embedding: new Array(1536).fill(0.01) }
                ],
                model: 'text-embedding-3-small',
                usage: { prompt_tokens: 10, total_tokens: 10 }
            }
        }
    }
};

// Error fixtures (shared across providers)
const errorFixtures = {
    auth401: {
        match: { pathPattern: /.*/, headerMatch: { 'authorization': /invalid_key/ } },
        respond: {
            status: 401,
            json: { error: { message: 'Invalid API key provided', type: 'invalid_request_error', code: 'invalid_api_key' } }
        }
    },
    rateLimit429: {
        match: { pathPattern: /.*/, headerMatch: { 'x-test-scenario': 'rate_limit' } },
        respond: {
            status: 429,
            json: { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } }
        }
    },
    serverError500: {
        match: { pathPattern: /.*/, headerMatch: { 'x-test-scenario': 'server_error' } },
        respond: {
            status: 500,
            json: { error: { message: 'Internal server error', type: 'server_error' } }
        }
    },
    modelNotFound404: {
        match: { pathPattern: /.*/, headerMatch: { 'x-test-scenario': 'model_not_found' } },
        respond: {
            status: 404,
            json: { error: { message: 'Model not found', type: 'invalid_request_error', code: 'model_not_found' } }
        }
    },
    timeout: {
        match: { pathPattern: /.*/, headerMatch: { 'x-test-scenario': 'timeout' } },
        respond: { timeout: true }
    }
};

// Provider-specific fixtures
const providerFixtures = {
    openai: {
        baseUrl: 'https://api.openai.com',
        ...openaiStyleFixtures
    },
    
    grok: {
        baseUrl: 'https://api.x.ai',
        listModels: {
            match: { method: 'GET', pathPattern: /\/v1\/models/ },
            respond: {
                status: 200,
                json: {
                    data: [
                        { id: 'grok-2', object: 'model' },
                        { id: 'grok-2-mini', object: 'model' }
                    ]
                }
            }
        },
        generateText: openaiStyleFixtures.generateText
    },
    
    deepseek: {
        baseUrl: 'https://api.deepseek.com',
        listModels: {
            match: { method: 'GET', pathPattern: /\/v1\/models/ },
            respond: {
                status: 200,
                json: {
                    data: [
                        { id: 'deepseek-chat', object: 'model' },
                        { id: 'deepseek-reasoner', object: 'model' }
                    ]
                }
            }
        },
        generateText: openaiStyleFixtures.generateText
    },
    
    genspark: {
        baseUrl: 'https://api.genspark.ai',
        listModels: {
            match: { method: 'GET', pathPattern: /\/v1\/models/ },
            respond: {
                status: 200,
                json: {
                    data: [
                        { id: 'genspark-v1', object: 'model' }
                    ]
                }
            }
        },
        generateText: openaiStyleFixtures.generateText
    },
    
    kimi: {
        baseUrl: 'https://api.moonshot.cn',
        listModels: {
            match: { method: 'GET', pathPattern: /\/v1\/models/ },
            respond: {
                status: 200,
                json: {
                    data: [
                        { id: 'kimi-k2', object: 'model' },
                        { id: 'kimi-k2-0905', object: 'model' }
                    ]
                }
            }
        },
        generateText: openaiStyleFixtures.generateText
    },
    
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com',
        listModels: {
            match: { method: 'GET', pathPattern: /\/v1beta\/models/ },
            respond: {
                status: 200,
                json: {
                    models: [
                        { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
                        { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', supportedGenerationMethods: ['generateContent'] },
                        { name: 'models/text-embedding-004', displayName: 'Text Embedding', supportedGenerationMethods: ['embedContent'] }
                    ]
                }
            }
        },
        generateText: {
            match: { method: 'POST', pathPattern: /\/v1beta\/models\/.*:generateContent/ },
            respond: {
                status: 200,
                json: {
                    candidates: [{
                        content: { parts: [{ text: 'This is a test response from Gemini mock.' }], role: 'model' },
                        finishReason: 'STOP'
                    }],
                    usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 }
                }
            }
        },
        embed: {
            match: { method: 'POST', pathPattern: /\/v1beta\/models\/.*:embedContent/ },
            respond: {
                status: 200,
                json: {
                    embedding: { values: new Array(768).fill(0.01) }
                }
            }
        }
    },
    
    claude: {
        baseUrl: 'https://api.anthropic.com',
        listModels: {
            // Claude doesn't have a models endpoint, return known models
            match: { method: 'GET', pathPattern: /\/v1\/models/ },
            respond: {
                status: 200,
                json: {
                    data: [
                        { id: 'claude-sonnet-4-20250514', type: 'model' },
                        { id: 'claude-3-5-sonnet-20241022', type: 'model' }
                    ]
                }
            }
        },
        generateText: {
            match: { method: 'POST', pathPattern: /\/v1\/messages/ },
            respond: {
                status: 200,
                json: {
                    id: 'msg_test123',
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'text', text: 'This is a test response from Claude mock.' }],
                    model: 'claude-sonnet-4-20250514',
                    stop_reason: 'end_turn',
                    usage: { input_tokens: 50, output_tokens: 20 }
                }
            }
        }
    },
    
    minimax: {
        baseUrl: 'https://api.minimax.chat',
        listModels: {
            match: { method: 'GET', pathPattern: /\/v1\/models/ },
            respond: {
                status: 200,
                json: {
                    data: [
                        { id: 'MiniMax-M2', object: 'model' },
                        { id: 'MiniMax-M2-Stable', object: 'model' }
                    ]
                }
            }
        },
        generateText: openaiStyleFixtures.generateText,
        embed: openaiStyleFixtures.embed
    },
    
    ollama: {
        baseUrl: 'http://127.0.0.1:11434',
        listModels: {
            match: { method: 'GET', pathPattern: /\/api\/tags/ },
            respond: {
                status: 200,
                json: {
                    models: [
                        { name: 'llama3.1:8b', size: 4000000000, digest: 'abc123' },
                        { name: 'qwen3:14b', size: 8000000000, digest: 'def456' },
                        { name: 'mxbai-embed-large', size: 500000000, digest: 'ghi789' }
                    ]
                }
            }
        },
        generateText: {
            match: { method: 'POST', pathPattern: /\/api\/generate/ },
            respond: {
                status: 200,
                json: {
                    model: 'llama3.1:8b',
                    response: 'This is a test response from Ollama mock.',
                    done: true,
                    context: [1, 2, 3],
                    total_duration: 1000000000,
                    load_duration: 100000000,
                    prompt_eval_count: 50,
                    eval_count: 20
                }
            }
        },
        embed: {
            match: { method: 'POST', pathPattern: /\/api\/embed/ },
            respond: {
                status: 200,
                json: {
                    embeddings: [new Array(1024).fill(0.01)]
                }
            }
        }
    }
};

/**
 * Get all fixtures for a provider
 */
function getProviderFixtures(providerId) {
    return providerFixtures[providerId] || null;
}

/**
 * Get all error fixtures
 */
function getErrorFixtures() {
    return errorFixtures;
}

/**
 * Get all provider IDs
 */
function getAllProviderIds() {
    return Object.keys(providerFixtures);
}

module.exports = {
    providerFixtures,
    errorFixtures,
    getProviderFixtures,
    getErrorFixtures,
    getAllProviderIds
};
