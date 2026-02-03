/**
 * Mock Transport for Preflight Testing
 * Intercepts HTTP calls and returns fixture-based responses
 */

const { providerFixtures, errorFixtures } = require('./fixtures/providers');

// Request log for assertions
let requestLog = [];

// Custom scenario overrides
let scenarioOverrides = new Map();

/**
 * Clear request log
 */
function clearRequestLog() {
    requestLog = [];
}

/**
 * Get request log
 */
function getRequestLog() {
    return [...requestLog];
}

/**
 * Set a scenario override for testing specific error cases
 * @param {string} scenario - Scenario name (e.g., 'rate_limit', 'timeout', 'auth')
 * @param {string} providerId - Provider to apply scenario to
 */
function setScenario(scenario, providerId) {
    scenarioOverrides.set(providerId, scenario);
}

/**
 * Clear all scenario overrides
 */
function clearScenarios() {
    scenarioOverrides.clear();
}

/**
 * Detect provider from URL
 */
function detectProvider(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('api.openai.com')) return 'openai';
    if (urlLower.includes('api.x.ai')) return 'grok';
    if (urlLower.includes('api.deepseek.com')) return 'deepseek';
    if (urlLower.includes('api.genspark.ai')) return 'genspark';
    if (urlLower.includes('api.moonshot.cn')) return 'kimi';
    if (urlLower.includes('generativelanguage.googleapis.com')) return 'gemini';
    if (urlLower.includes('api.anthropic.com')) return 'claude';
    if (urlLower.includes('api.minimax.chat')) return 'minimax';
    if (urlLower.includes('127.0.0.1:11434') || urlLower.includes('localhost:11434')) return 'ollama';
    
    return 'unknown';
}

/**
 * Match a request against a fixture
 */
function matchFixture(request, fixture) {
    if (!fixture || !fixture.match) return false;
    
    const { method, pathPattern, headerMatch } = fixture.match;
    
    // Check method
    if (method && request.method !== method) return false;
    
    // Check path pattern
    if (pathPattern) {
        try {
            const url = new URL(request.url);
            if (!pathPattern.test(url.pathname)) return false;
        } catch (e) {
            return false;
        }
    }
    
    // Check header match
    if (headerMatch) {
        for (const [key, pattern] of Object.entries(headerMatch)) {
            const headerValue = request.headers?.[key] || request.headers?.[key.toLowerCase()];
            if (!headerValue) return false;
            if (pattern instanceof RegExp) {
                if (!pattern.test(headerValue)) return false;
            } else if (headerValue !== pattern) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Find matching fixture for a request
 */
function findMatchingFixture(request, providerId) {
    const providerFix = providerFixtures[providerId];
    if (!providerFix) return null;
    
    // Check each fixture type
    const fixtureTypes = ['listModels', 'generateText', 'generateVision', 'embed'];
    
    for (const type of fixtureTypes) {
        const fixture = providerFix[type];
        if (fixture && matchFixture(request, fixture)) {
            return fixture;
        }
    }
    
    return null;
}

/**
 * Create error response based on scenario
 */
function createErrorResponse(scenario) {
    const errorFix = errorFixtures[scenario] || errorFixtures[`${scenario}401`];
    
    switch (scenario) {
        case 'auth':
            return { status: 401, data: { error: { message: 'Invalid API key', code: 'invalid_api_key' } } };
        case 'rate_limit':
            return { status: 429, data: { error: { message: 'Rate limit exceeded' } } };
        case 'server_error':
            return { status: 500, data: { error: { message: 'Internal server error' } } };
        case 'model_not_found':
            return { status: 404, data: { error: { message: 'Model not found', code: 'model_not_found' } } };
        case 'timeout':
            throw new Error('Request timeout');
        case 'overloaded':
            return { status: 503, data: { error: { message: 'Service temporarily overloaded' } } };
        default:
            return null;
    }
}

/**
 * Mock transport function
 * @param {object} options - Request options
 * @returns {Promise<{status: number, data: any, headers: object}>}
 */
async function mockTransport(options) {
    const { method, url, headers, body, timeoutMs } = options;
    
    // Log the request (sanitize headers to remove API keys)
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders.authorization) sanitizedHeaders.authorization = '[REDACTED]';
    if (sanitizedHeaders['x-api-key']) sanitizedHeaders['x-api-key'] = '[REDACTED]';
    if (sanitizedHeaders.Authorization) sanitizedHeaders.Authorization = '[REDACTED]';
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        method,
        url,
        headers: sanitizedHeaders,
        hasBody: !!body,
        bodyPreview: body ? JSON.stringify(body).substring(0, 200) : null
    };
    requestLog.push(logEntry);
    
    // Detect provider
    const providerId = detectProvider(url);
    
    // Check for scenario override
    const scenario = scenarioOverrides.get(providerId);
    if (scenario) {
        const errorResponse = createErrorResponse(scenario);
        if (errorResponse) {
            return errorResponse;
        }
    }
    
    // Check for test scenario header
    const testScenario = headers?.['x-test-scenario'] || headers?.['X-Test-Scenario'];
    if (testScenario) {
        const errorResponse = createErrorResponse(testScenario);
        if (errorResponse) {
            return errorResponse;
        }
    }
    
    // Find matching fixture
    const request = { method, url, headers, body };
    const fixture = findMatchingFixture(request, providerId);
    
    if (fixture && fixture.respond) {
        // Check for timeout simulation
        if (fixture.respond.timeout) {
            throw new Error('Request timeout');
        }
        
        // Return fixture response
        return {
            status: fixture.respond.status || 200,
            data: fixture.respond.json || fixture.respond.data || null,
            headers: fixture.respond.headers || {}
        };
    }
    
    // Default: return 404 for unknown endpoints
    console.warn(`[MockTransport] No fixture matched for ${method} ${url} (provider: ${providerId})`);
    return {
        status: 404,
        data: { error: { message: 'No fixture matched for this request' } },
        headers: {}
    };
}

/**
 * Create a mock transport with custom behavior
 * @param {object} customFixtures - Additional fixtures to merge
 */
function createMockTransport(customFixtures = {}) {
    return async (options) => {
        // Allow custom fixtures to override
        const providerId = detectProvider(options.url);
        const customFix = customFixtures[providerId];
        
        if (customFix) {
            const request = { method: options.method, url: options.url, headers: options.headers };
            for (const fixture of Object.values(customFix)) {
                if (matchFixture(request, fixture)) {
                    return {
                        status: fixture.respond.status || 200,
                        data: fixture.respond.json || null,
                        headers: fixture.respond.headers || {}
                    };
                }
            }
        }
        
        return mockTransport(options);
    };
}

module.exports = {
    mockTransport,
    createMockTransport,
    clearRequestLog,
    getRequestLog,
    setScenario,
    clearScenarios,
    detectProvider
};
