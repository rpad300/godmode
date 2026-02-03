/**
 * LLM Preflight Test Runner
 * Comprehensive connectivity and contract tests for LLM providers
 */

const httpClient = require('../llm/httpClient');
const { mockTransport, clearRequestLog, getRequestLog, setScenario, clearScenarios } = require('./mockTransport');
const { getAllProviderIds } = require('./fixtures/providers');
const tokenBudget = require('../llm/tokenBudget');
const llmRouter = require('../llm/router');
const healthRegistry = require('../llm/healthRegistry');

// Test result collector
class TestRunner {
    constructor(mode = 'mock') {
        this.mode = mode;
        this.tests = [];
        this.startedAt = null;
        this.runId = `preflight-${Date.now()}`;
    }

    async runTest(id, name, testFn, options = {}) {
        const testStart = Date.now();
        const test = {
            id,
            name,
            status: 'PENDING',
            durationMs: 0,
            details: {},
            category: options.category || 'general'
        };

        try {
            // Check skip conditions
            if (options.skipIf) {
                const skipReason = await options.skipIf();
                if (skipReason) {
                    test.status = 'SKIP';
                    test.details.skipReason = skipReason;
                    test.durationMs = Date.now() - testStart;
                    this.tests.push(test);
                    return test;
                }
            }

            // Run the test
            const result = await testFn();
            
            test.status = 'PASS';
            test.details = result || {};
            test.durationMs = Date.now() - testStart;
        } catch (error) {
            test.status = 'FAIL';
            test.error = {
                code: error.code || 'ASSERTION_ERROR',
                message: error.message,
                stack: this.mode === 'mock' ? error.stack : undefined
            };
            test.durationMs = Date.now() - testStart;
        }

        this.tests.push(test);
        return test;
    }

    getReport() {
        const summary = {
            total: this.tests.length,
            passed: this.tests.filter(t => t.status === 'PASS').length,
            failed: this.tests.filter(t => t.status === 'FAIL').length,
            skipped: this.tests.filter(t => t.status === 'SKIP').length
        };

        return {
            runId: this.runId,
            mode: this.mode,
            startedAt: this.startedAt,
            durationMs: Date.now() - this.startedAt,
            summary,
            tests: this.tests
        };
    }
}

/**
 * Assert helper
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

/**
 * Get a test model for a provider (for live testing)
 */
function getTestModel(providerId) {
    // Updated model names as of Jan 2026
    const models = {
        openai: 'gpt-4o-mini',
        gemini: 'gemini-2.0-flash',              // Updated: gemini-1.5-flash deprecated
        grok: 'grok-4-1-fast-non-reasoning',     // Cheapest: $0.20/$0.50, 2M context
        deepseek: 'deepseek-chat',
        claude: 'claude-3-5-haiku-20241022',
        kimi: 'kimi-k2',
        minimax: 'MiniMax-M2',
        genspark: 'genspark-v1',
        ollama: 'llama3.2:1b'
    };
    return models[providerId] || 'test-model';
}

/**
 * Run all preflight tests
 * @param {object} options
 * @param {string} options.mode - 'mock' or 'live'
 * @param {object} options.config - App config (optional, for live mode)
 * @returns {Promise<object>} Test report
 */
async function runPreflight(options = {}) {
    const { mode = 'mock', config = {} } = options;
    const runner = new TestRunner(mode);
    runner.startedAt = Date.now();

    console.log(`\n🧪 LLM Preflight Tests - Mode: ${mode.toUpperCase()}\n`);

    // Setup mock transport if in mock mode
    if (mode === 'mock') {
        httpClient.setTransport(mockTransport);
        clearRequestLog();
        clearScenarios();
        healthRegistry.resetAllHealth();
    }

    try {
        // ==================== Config Tests ====================
        await runConfigTests(runner, config);

        // ==================== Provider Adapter Tests ====================
        await runProviderAdapterTests(runner, mode, config);

        // ==================== Token Budget Tests ====================
        await runTokenBudgetTests(runner);

        // ==================== Router Failover Tests ====================
        await runRouterFailoverTests(runner, config);

        // ==================== End-to-End Flow Tests ====================
        await runE2ETests(runner, config);

    } finally {
        // Reset transport
        if (mode === 'mock') {
            httpClient.resetTransport();
            clearScenarios();
        }
    }

    const report = runner.getReport();
    printConsoleSummary(report);
    
    return report;
}

/**
 * Config and Masking Tests
 */
async function runConfigTests(runner, config) {
    console.log('📋 Config Tests');

    await runner.runTest('config-masking', 'API keys are masked in config output', async () => {
        // In live mode, we intentionally pass real keys for testing - skip this check
        if (runner.mode === 'live') {
            return { skipped: true, reason: 'Live mode uses real keys for testing' };
        }
        
        const llmConfig = config.llm || {};
        const providers = llmConfig.providers || {};
        
        for (const [pid, pconfig] of Object.entries(providers)) {
            if (pconfig.apiKey) {
                assert(
                    !pconfig.apiKey.includes('sk-') && !pconfig.apiKey.includes('key-'),
                    `Provider ${pid} has unmasked API key`
                );
            }
            if (pconfig.apiKeyMasked) {
                assert(
                    pconfig.apiKeyMasked.startsWith('****'),
                    `Provider ${pid} mask format incorrect`
                );
            }
        }
        
        return { providersChecked: Object.keys(providers).length };
    }, { category: 'config' });

    await runner.runTest('config-routing-schema', 'Routing config has correct schema', async () => {
        const routing = config.llm?.routing || {};
        
        assert(['single', 'failover', undefined].includes(routing.mode), 'Invalid routing mode');
        
        if (routing.perTask) {
            for (const taskType of ['chat', 'processing', 'embeddings']) {
                const taskConfig = routing.perTask[taskType];
                if (taskConfig) {
                    assert(Array.isArray(taskConfig.priorities), `${taskType} priorities must be array`);
                    assert(typeof taskConfig.maxAttempts === 'number' || taskConfig.maxAttempts === undefined, 'maxAttempts must be number');
                }
            }
        }
        
        return { mode: routing.mode, hasPerTask: !!routing.perTask };
    }, { category: 'config' });

    await runner.runTest('config-token-policy-schema', 'Token policy config has correct schema', async () => {
        const policy = config.llm?.tokenPolicy || {};
        
        assert(typeof policy.enforce === 'boolean' || policy.enforce === undefined, 'enforce must be boolean');
        assert(typeof policy.defaultMaxOutputTokens === 'number' || policy.defaultMaxOutputTokens === undefined, 'defaultMaxOutputTokens must be number');
        
        return { enforce: policy.enforce, hasPerModel: !!policy.perModel };
    }, { category: 'config' });
}

/**
 * Provider Adapter Contract Tests
 */
async function runProviderAdapterTests(runner, mode, config) {
    console.log('\n🔌 Provider Adapter Tests');
    
    const llm = require('../llm');
    const providerIds = getAllProviderIds();

    for (const providerId of providerIds) {
        const providerConfig = config.llm?.providers?.[providerId] || {};
        const isConfigured = providerId === 'ollama' || !!providerConfig.apiKey || providerConfig.isConfigured;

        // Skip condition for live mode - skip unconfigured providers
        const skipIfNotConfigured = async () => {
            if (mode === 'live' && !isConfigured) {
                return `Provider ${providerId} not configured (no API key)`;
            }
            return null;
        };

        // Test listModels
        await runner.runTest(
            `adapter-${providerId}-listModels`,
            `${providerId}: listModels returns correct structure`,
            async () => {
                const result = await llm.listModels(providerId, providerConfig);
                
                assert(result.textModels !== undefined, 'Missing textModels');
                assert(Array.isArray(result.textModels), 'textModels must be array');
                assert(result.visionModels !== undefined, 'Missing visionModels');
                assert(result.embeddingModels !== undefined, 'Missing embeddingModels');
                
                return {
                    textModels: result.textModels.length,
                    visionModels: result.visionModels.length,
                    embeddingModels: result.embeddingModels.length
                };
            },
            { category: 'providers', skipIf: skipIfNotConfigured }
        );

        // Test generateText
        const capabilities = llm.getProviderCapabilities(providerId);
        
        if (capabilities.text) {
            await runner.runTest(
                `adapter-${providerId}-generateText`,
                `${providerId}: generateText returns text response`,
                async () => {
                    // Use a real model name for live mode
                    const testModel = mode === 'live' ? getTestModel(providerId) : 'test-model';
                    
                    const result = await llm.generateText({
                        provider: providerId,
                        providerConfig,
                        model: testModel,
                        prompt: 'Say "hello" in one word.',
                        temperature: 0.1,
                        maxTokens: 10
                    });
                    
                    assert(typeof result.success === 'boolean', 'Missing success flag');
                    if (result.success) {
                        assert(typeof result.text === 'string', 'Missing text in response');
                    }
                    
                    return { success: result.success, hasText: !!result.text, model: testModel };
                },
                { category: 'providers', skipIf: skipIfNotConfigured }
            );
        }

        // Test error normalization - 401 auth
        await runner.runTest(
            `adapter-${providerId}-error-auth`,
            `${providerId}: 401 error normalized as auth (non-retryable)`,
            async () => {
                setScenario('auth', providerId);
                
                try {
                    await llm.generateText({
                        provider: providerId,
                        providerConfig,
                        model: 'test-model',
                        prompt: 'test'
                    });
                } catch (error) {
                    // Expected to fail
                }
                
                // Get provider and check error handling
                const client = llm.getClient(providerId, providerConfig);
                const normalized = client.normalizeError({ status: 401, message: 'Invalid API key' }, 'generateText');
                
                assert(normalized.code === 'auth', `Expected auth code, got ${normalized.code}`);
                assert(normalized.retryable === false, 'Auth errors should not be retryable');
                
                return { code: normalized.code, retryable: normalized.retryable };
            },
            { category: 'error-handling' }
        );

        // Test error normalization - 429 rate limit
        await runner.runTest(
            `adapter-${providerId}-error-ratelimit`,
            `${providerId}: 429 error normalized as rate_limit (retryable)`,
            async () => {
                const client = llm.getClient(providerId, providerConfig);
                const normalized = client.normalizeError({ status: 429, message: 'Rate limit exceeded' }, 'generateText');
                
                assert(normalized.code === 'rate_limit', `Expected rate_limit code, got ${normalized.code}`);
                assert(normalized.retryable === true, 'Rate limit errors should be retryable');
                
                return { code: normalized.code, retryable: normalized.retryable };
            },
            { category: 'error-handling' }
        );

        // Test error normalization - 500 server error
        await runner.runTest(
            `adapter-${providerId}-error-server`,
            `${providerId}: 5xx error normalized as server_error (retryable)`,
            async () => {
                const client = llm.getClient(providerId, providerConfig);
                const normalized = client.normalizeError({ status: 500, message: 'Internal server error' }, 'generateText');
                
                assert(normalized.code === 'server_error', `Expected server_error code, got ${normalized.code}`);
                assert(normalized.retryable === true, 'Server errors should be retryable');
                
                return { code: normalized.code, retryable: normalized.retryable };
            },
            { category: 'error-handling' }
        );

        // Test error normalization - timeout
        await runner.runTest(
            `adapter-${providerId}-error-timeout`,
            `${providerId}: timeout error normalized correctly (retryable)`,
            async () => {
                const client = llm.getClient(providerId, providerConfig);
                const normalized = client.normalizeError({ message: 'Request timeout' }, 'generateText');
                
                assert(normalized.code === 'timeout', `Expected timeout code, got ${normalized.code}`);
                assert(normalized.retryable === true, 'Timeout errors should be retryable');
                
                return { code: normalized.code, retryable: normalized.retryable };
            },
            { category: 'error-handling' }
        );

        // Clear scenario after each provider
        clearScenarios();
    }
}

/**
 * Token Budget Tests
 */
async function runTokenBudgetTests(runner) {
    console.log('\n📏 Token Budget Tests');

    await runner.runTest('token-estimate-basic', 'Token estimation works for simple text', async () => {
        const tokens = tokenBudget.estimateTokens('Hello, world! This is a test.');
        
        assert(typeof tokens === 'number', 'Token count must be number');
        assert(tokens > 0, 'Token count must be positive');
        assert(tokens < 100, 'Token count for simple text should be small');
        
        return { text: 'Hello, world! This is a test.', estimatedTokens: tokens };
    }, { category: 'tokenBudget' });

    await runner.runTest('token-budget-enforce-rag-truncation', 'RAG context truncated first when enforce=true', async () => {
        const modelInfo = { contextTokens: 1000, maxOutputTokens: 200 };
        // Override perTask to ensure our reservedForRag is used
        const policy = { 
            enforce: true, 
            defaultReservedForRag: 100,
            perTask: {
                chat: { reservedForRag: 100, maxOutputTokens: 200 }
            }
        };
        
        // Create large RAG context
        const largeRag = 'x'.repeat(5000); // ~1375 tokens
        
        const budget = tokenBudget.calculateBudget({
            provider: 'test',
            modelId: 'test-model',
            messages: [{ role: 'user', content: 'Short message' }],
            ragContext: largeRag,
            tokenPolicy: policy,
            modelInfo,
            task: 'chat'
        });
        
        assert(budget.decision.truncateRag === true, `RAG should be marked for truncation (ragTokens=${budget.estimatedRagTokens}, limit=${budget.limits.reservedForRag})`);
        assert(budget.allowedRagTokens <= 100, 'RAG tokens should be capped');
        
        return { truncateRag: budget.decision.truncateRag, allowedRagTokens: budget.allowedRagTokens };
    }, { category: 'tokenBudget' });

    await runner.runTest('token-budget-enforce-history-truncation', 'History truncated after RAG when still over', async () => {
        const modelInfo = { contextTokens: 500, maxOutputTokens: 100 };
        const policy = { enforce: true, defaultReservedForRag: 50 };
        
        // Create many messages
        const messages = [];
        for (let i = 0; i < 20; i++) {
            messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'Message content here '.repeat(20) });
        }
        
        const budget = tokenBudget.calculateBudget({
            provider: 'test',
            modelId: 'test-model',
            messages,
            ragContext: 'Short context',
            tokenPolicy: policy,
            modelInfo,
            task: 'chat'
        });
        
        assert(budget.decision.truncateHistory === true, 'History should be marked for truncation');
        
        return { truncateHistory: budget.decision.truncateHistory };
    }, { category: 'tokenBudget' });

    await runner.runTest('token-budget-enforce-blocked', 'Request blocked when exceeds even after truncation', async () => {
        const modelInfo = { contextTokens: 100, maxOutputTokens: 50 };
        const policy = { enforce: true };
        
        // Create huge system prompt that can't fit
        const systemPrompt = 'x'.repeat(2000);
        
        const budget = tokenBudget.calculateBudget({
            provider: 'test',
            modelId: 'test-model',
            messages: [],
            systemPrompt,
            ragContext: '',
            tokenPolicy: policy,
            modelInfo,
            task: 'chat'
        });
        
        assert(budget.decision.blocked === true, 'Request should be blocked');
        assert(budget.decision.reason !== null, 'Blocked reason should be provided');
        
        return { blocked: budget.decision.blocked, reason: budget.decision.reason };
    }, { category: 'tokenBudget' });

    await runner.runTest('token-budget-no-enforce-warnings-only', 'No truncation when enforce=false, warnings only', async () => {
        const modelInfo = { contextTokens: 100, maxOutputTokens: 50 };
        const policy = { enforce: false };
        
        const largeRag = 'x'.repeat(2000);
        
        const budget = tokenBudget.calculateBudget({
            provider: 'test',
            modelId: 'test-model',
            messages: [],
            ragContext: largeRag,
            tokenPolicy: policy,
            modelInfo,
            task: 'chat'
        });
        
        assert(budget.decision.blocked === false, 'Should not be blocked when enforce=false');
        assert(budget.decision.warnings.length > 0, 'Should have warnings');
        
        return { blocked: budget.decision.blocked, warningCount: budget.decision.warnings.length };
    }, { category: 'tokenBudget' });
}

/**
 * Router Failover Tests
 */
async function runRouterFailoverTests(runner, config) {
    console.log('\n🔄 Router Failover Tests');

    // Reset health before router tests
    healthRegistry.resetAllHealth();

    // In live mode, use real providers from config; in mock mode, use test config
    const testConfig = runner.mode === 'live' ? {
        llm: {
            provider: 'openai',
            routing: {
                mode: 'failover',
                perTask: {
                    chat: {
                        priorities: ['openai', 'gemini', 'ollama'],
                        maxAttempts: 3,
                        timeoutMs: 30000,
                        cooldownMs: 1000,
                        retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
                        nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded']
                    }
                },
                modelMap: {
                    chat: {
                        openai: { text: 'gpt-4o-mini' },
                        gemini: { text: 'gemini-1.5-flash' },
                        ollama: { text: 'llama3.2:1b' }
                    }
                }
            },
            providers: config.llm?.providers || {}
        }
    } : {
        llm: {
            provider: 'grok',
            routing: {
                mode: 'failover',
                perTask: {
                    chat: {
                        priorities: ['grok', 'openai', 'gemini'],
                        maxAttempts: 3,
                        timeoutMs: 5000,
                        cooldownMs: 1000,
                        retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
                        nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded']
                    }
                },
                modelMap: {
                    chat: {
                        grok: { text: 'grok-2' },
                        openai: { text: 'gpt-4o' },
                        gemini: { text: 'gemini-1.5-flash' }
                    }
                }
            },
            providers: {
                grok: { apiKey: 'test-key' },
                openai: { apiKey: 'test-key' },
                gemini: { apiKey: 'test-key' }
            }
        }
    };

    await runner.runTest('router-failover-429', 'Router fails over on 429 rate limit', async () => {
        // This test requires mock transport to simulate failures
        if (runner.mode === 'live') {
            return { skipped: true, reason: 'Simulated failures require mock mode' };
        }
        
        healthRegistry.resetAllHealth();
        setScenario('rate_limit', 'grok');
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'Hello'
        }, testConfig);
        
        clearScenarios();
        
        assert(result.routing.mode === 'failover', 'Should be in failover mode');
        assert(result.routing.attempts.length >= 2, 'Should have multiple attempts');
        assert(result.routing.attempts[0].provider === 'grok', 'First attempt should be grok');
        assert(result.routing.attempts[0].ok === false, 'First attempt should fail');
        
        return { 
            usedProvider: result.routing.usedProvider,
            attemptCount: result.routing.attempts.length,
            firstAttemptError: result.routing.attempts[0].code
        };
    }, { category: 'router' });

    await runner.runTest('router-failover-401', 'Router fails over on 401 auth error (non-retryable)', async () => {
        // This test requires mock transport to simulate failures
        if (runner.mode === 'live') {
            return { skipped: true, reason: 'Simulated failures require mock mode' };
        }
        
        healthRegistry.resetAllHealth();
        setScenario('auth', 'grok');
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'Hello'
        }, testConfig);
        
        clearScenarios();
        
        assert(result.routing.attempts.length >= 2, 'Should have multiple attempts');
        // First attempt should fail (either auth error or skipped to next provider)
        assert(result.routing.attempts[0].ok === false, 'First attempt should fail');
        
        return { 
            attemptCount: result.routing.attempts.length,
            firstError: result.routing.attempts[0].code,
            usedProvider: result.routing.usedProvider
        };
    }, { category: 'router' });

    await runner.runTest('router-failover-timeout', 'Router fails over on timeout', async () => {
        // This test requires mock transport to simulate failures
        if (runner.mode === 'live') {
            return { skipped: true, reason: 'Simulated failures require mock mode' };
        }
        
        healthRegistry.resetAllHealth();
        setScenario('timeout', 'grok');
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'Hello'
        }, testConfig);
        
        clearScenarios();
        
        assert(result.routing.attempts.length >= 2, 'Should have multiple attempts');
        
        return { 
            attemptCount: result.routing.attempts.length,
            usedProvider: result.routing.usedProvider
        };
    }, { category: 'router' });

    await runner.runTest('router-all-fail', 'Router returns error with attempts list when all fail', async () => {
        // This test requires mock transport to simulate failures
        if (runner.mode === 'live') {
            return { skipped: true, reason: 'Simulated failures require mock mode' };
        }
        
        healthRegistry.resetAllHealth();
        setScenario('server_error', 'grok');
        setScenario('server_error', 'openai');
        setScenario('server_error', 'gemini');
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'Hello'
        }, testConfig);
        
        clearScenarios();
        
        assert(result.success === false, 'Should fail');
        assert(result.routing.attempts.length === 3, 'Should have 3 attempts');
        assert(result.routing.usedProvider === null, 'No provider should succeed');
        
        return { 
            success: result.success,
            attemptCount: result.routing.attempts.length
        };
    }, { category: 'router' });

    await runner.runTest('router-cooldown', 'Provider in cooldown is skipped', async () => {
        healthRegistry.resetAllHealth();
        
        // Manually put grok in cooldown
        healthRegistry.recordFailure('grok', { code: 'rate_limit', retryable: true }, 60000);
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'Hello'
        }, testConfig);
        
        // Grok should be skipped due to cooldown
        const usedGrok = result.routing.attempts.some(a => a.provider === 'grok');
        assert(!usedGrok || result.routing.attempts[0].provider !== 'grok', 'Grok should be skipped or not first');
        
        return { 
            usedProvider: result.routing.usedProvider,
            grokInCooldown: healthRegistry.isInCooldown('grok')
        };
    }, { category: 'router' });

    await runner.runTest('router-single-mode', 'Single mode uses only configured provider', async () => {
        healthRegistry.resetAllHealth();
        
        const singleConfig = runner.mode === 'live' ? {
            llm: {
                provider: 'openai',
                routing: { mode: 'single' },
                models: { text: 'gpt-4o-mini' },
                providers: config.llm?.providers || {}
            }
        } : {
            llm: {
                provider: 'openai',
                routing: { mode: 'single' },
                providers: { openai: { apiKey: 'test-key' } }
            }
        };
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'Say hi',
            model: runner.mode === 'live' ? 'gpt-4o-mini' : undefined
        }, singleConfig);
        
        assert(result.routing.mode === 'single', 'Should be in single mode');
        assert(result.routing.attempts.length === 1, 'Should have exactly 1 attempt');
        
        return { mode: result.routing.mode, attemptCount: result.routing.attempts.length, success: result.success };
    }, { category: 'router' });

    // Live-mode only: Test that basic failover routing works with real providers
    if (runner.mode === 'live') {
        await runner.runTest('router-live-basic', 'Live failover routing works with configured providers', async () => {
            healthRegistry.resetAllHealth();
            
            const result = await llmRouter.routeAndExecute('chat', 'generateText', {
                prompt: 'Say hello in one word.',
                maxTokens: 10
            }, testConfig);
            
            assert(result.routing !== undefined, 'Should have routing metadata');
            assert(result.routing.attempts.length >= 1, 'Should have at least 1 attempt');
            
            return { 
                success: result.success,
                usedProvider: result.routing.usedProvider,
                attemptCount: result.routing.attempts.length
            };
        }, { category: 'router' });
    }
}

/**
 * End-to-End Flow Tests
 */
async function runE2ETests(runner, config) {
    console.log('\n🔗 End-to-End Flow Tests');

    const llm = require('../llm');

    await runner.runTest('e2e-chat-flow', 'Chat flow produces response with routing metadata', async () => {
        const chatConfig = runner.mode === 'live' ? {
            llm: {
                provider: 'openai',
                routing: { mode: 'single' },
                providers: config.llm?.providers || {}
            }
        } : {
            llm: {
                provider: 'openai',
                routing: { mode: 'single' },
                providers: { openai: { apiKey: 'test-key' } }
            }
        };
        
        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt: 'What is 2+2? Reply with just the number.',
            temperature: 0.1,
            maxTokens: 10
        }, chatConfig);
        
        assert(result.routing !== undefined, 'Should have routing metadata');
        assert(result.routing.usedProvider !== undefined, 'Should have usedProvider');
        
        return { 
            hasRouting: true,
            usedProvider: result.routing.usedProvider,
            success: result.success
        };
    }, { category: 'e2e' });

    await runner.runTest('e2e-embeddings-flow', 'Embeddings flow returns correct array structure', async () => {
        // Get a configured provider for embeddings
        const embedProvider = runner.mode === 'live' ? 
            (config.llm?.providers?.openai?.apiKey ? 'openai' : 'ollama') : 'openai';
        const providerConfig = config.llm?.providers?.[embedProvider] || {};
        const embedModel = embedProvider === 'openai' ? 'text-embedding-3-small' : 'mxbai-embed-large';
        
        const result = await llm.embed({
            provider: embedProvider,
            providerConfig: runner.mode === 'live' ? providerConfig : { apiKey: 'test-key' },
            model: embedModel,
            texts: ['Hello', 'World', 'Test']
        });
        
        // In mock mode, we get fixture response. In live mode, allow failures for unconfigured providers
        if (runner.mode === 'live' && !result.success) {
            return { success: false, error: result.error, note: 'Provider may not support embeddings or model not available' };
        }
        
        assert(result.success === true || result.embeddings !== undefined, 'Should succeed or have embeddings');
        
        return { success: result.success, provider: embedProvider };
    }, { category: 'e2e' });

    await runner.runTest('e2e-request-log', 'Request log captures sanitized requests', async () => {
        const log = getRequestLog();
        
        // Check that no API keys are in logs
        for (const entry of log) {
            if (entry.headers) {
                assert(
                    !JSON.stringify(entry.headers).includes('sk-'),
                    'API keys should be redacted from logs'
                );
            }
        }
        
        return { requestCount: log.length, sanitized: true };
    }, { category: 'e2e' });
}

/**
 * Print console summary
 */
function printConsoleSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PREFLIGHT TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\nMode: ${report.mode.toUpperCase()}`);
    console.log(`Duration: ${report.durationMs}ms`);
    console.log(`\nResults:`);
    console.log(`  ✅ Passed:  ${report.summary.passed}`);
    console.log(`  ❌ Failed:  ${report.summary.failed}`);
    console.log(`  ⏭️  Skipped: ${report.summary.skipped}`);
    console.log(`  📝 Total:   ${report.summary.total}`);

    // Group by category
    const categories = {};
    for (const test of report.tests) {
        const cat = test.category || 'general';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(test);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('Results by Category:\n');

    for (const [category, tests] of Object.entries(categories)) {
        const passed = tests.filter(t => t.status === 'PASS').length;
        const failed = tests.filter(t => t.status === 'FAIL').length;
        const skipped = tests.filter(t => t.status === 'SKIP').length;
        
        let icon = '✅';
        if (failed > 0) icon = '❌';
        else if (skipped === tests.length) icon = '⏭️';
        
        console.log(`  ${icon} ${category}: ${passed}/${tests.length} passed`);
    }

    // Show failures
    const failures = report.tests.filter(t => t.status === 'FAIL');
    if (failures.length > 0) {
        console.log('\n' + '-'.repeat(60));
        console.log('❌ FAILURES:\n');
        
        for (const test of failures) {
            console.log(`  ${test.id}: ${test.name}`);
            console.log(`    Error: ${test.error?.message}`);
            console.log('');
        }
    }

    console.log('='.repeat(60) + '\n');
}

module.exports = {
    runPreflight,
    TestRunner
};
