/**
 * Purpose:
 *   Routes LLM requests to the appropriate provider and, in failover mode,
 *   automatically retries against alternative providers when the primary one
 *   fails with a retryable error (timeout, rate limit, 5xx, overloaded).
 *
 * Responsibilities:
 *   - Two routing modes: "single" (use configured provider only) and "failover"
 *     (walk a priority-ordered provider list until one succeeds or all fail)
 *   - Normalizes heterogeneous provider errors into a standard { code, retryable }
 *     taxonomy so that retry/skip decisions are consistent
 *   - Checks provider eligibility (API key present, capability match, cooldown status)
 *   - Resolves which model to use per provider via modelMap or default models
 *   - Records success/failure in the healthRegistry for circuit-breaker-like cooldowns
 *
 * Key dependencies:
 *   - ./index (llm): delegates actual execution to generateText / generateVision / embed
 *   - ./healthRegistry: reads and writes per-provider health state (cooldowns, failure counts)
 *   - ./config: resolves text config in single-provider mode
 *
 * Side effects:
 *   - Network calls (via llm.*) to one or more provider APIs per routeAndExecute call
 *   - Mutates healthRegistry state on success / failure
 *
 * Notes:
 *   - DEFAULT_ROUTING_POLICY defines sensible timeouts and retry counts per task type.
 *     These defaults are used when the user has not configured llm.routing in the admin panel.
 *   - In "single" mode, the router still wraps the call to capture timing and error metadata
 *     in the returned routing object, making diagnostics uniform regardless of mode.
 *   - Non-retryable errors (auth, invalid_request, quota_exceeded) cause an immediate skip
 *     to the next provider rather than consuming a retry slot.
 */

const llm = require('./index');
const healthRegistry = require('./healthRegistry');
const configModule = require('./config');
const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'llm-router' });

// Default routing policy per task
const DEFAULT_ROUTING_POLICY = {
    mode: 'single', // 'single' | 'failover'
    perTask: {
        chat: {
            priorities: ['ollama'],
            maxAttempts: 3,
            timeoutMs: 45000,
            retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
            nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded'],
            cooldownMs: 60000
        },
        processing: {
            priorities: ['ollama'],
            maxAttempts: 2,
            timeoutMs: 90000,
            retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
            nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded'],
            cooldownMs: 120000
        },
        embeddings: {
            priorities: ['ollama'],
            maxAttempts: 2,
            timeoutMs: 60000,
            retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
            nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded'],
            cooldownMs: 120000
        }
    },
    modelMap: {
        chat: {},
        processing: {},
        embeddings: {}
    }
};

/**
 * Normalize error to standard format
 * @param {Error|object} error - Raw error
 * @param {string} provider - Provider that generated the error
 * @returns {object} Normalized error
 */
function normalizeError(error, provider) {
    const statusCode = error.statusCode || error.status || error.response?.status;
    const message = error.message || error.error?.message || String(error);
    
    // Determine error code based on status and message
    let code = 'unknown';
    let retryable = false;
    
    if (statusCode === 401 || statusCode === 403 || message.includes('unauthorized') || message.includes('invalid_api_key')) {
        code = 'auth';
        retryable = false;
    } else if (statusCode === 404 || message.includes('model_not_found') || message.includes('does not exist')) {
        code = 'model_not_found';
        retryable = false;
    } else if (statusCode === 429 || message.includes('rate_limit') || message.includes('too many requests')) {
        code = 'rate_limit';
        retryable = true;
    } else if (statusCode === 408 || message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('ECONNRESET')) {
        code = 'timeout';
        retryable = true;
    } else if (statusCode >= 500 || message.includes('internal') || message.includes('server error')) {
        code = 'server_error';
        retryable = true;
    } else if (message.includes('overloaded') || message.includes('capacity') || message.includes('busy')) {
        code = 'overloaded';
        retryable = true;
    } else if (message.includes('insufficient_quota') || message.includes('quota') || message.includes('billing')) {
        code = 'quota_exceeded';
        retryable = false;
    } else if (message.includes('invalid') || message.includes('malformed') || statusCode === 400) {
        code = 'invalid_request';
        retryable = false;
    }
    
    return {
        provider,
        code,
        message,
        statusCode,
        retryable,
        raw: error
    };
}

/**
 * Check if a provider is eligible for a task
 * @param {string} providerId - Provider ID
 * @param {string} operation - Operation type
 * @param {object} providerConfig - Provider configuration
 * @returns {object} { eligible: boolean, reason?: string }
 */
function checkProviderEligibility(providerId, operation, providerConfig) {
    // Check if provider is configured
    if (providerId !== 'ollama') {
        if (!providerConfig?.apiKey) {
            return { eligible: false, reason: 'not_configured' };
        }
    }
    
    // Check if provider supports the operation
    const capabilities = llm.getProviderCapabilities(providerId);
    
    if (operation === 'generateVision' && !capabilities.vision) {
        return { eligible: false, reason: 'no_vision_support' };
    }
    
    if (operation === 'embed' && !capabilities.embeddings) {
        return { eligible: false, reason: 'no_embeddings_support' };
    }
    
    // Check cooldown
    if (healthRegistry.isInCooldown(providerId)) {
        const remaining = healthRegistry.getCooldownRemaining(providerId);
        return { eligible: false, reason: 'in_cooldown', cooldownRemaining: remaining };
    }
    
    return { eligible: true };
}

/**
 * Get model for a provider and task
 * @param {string} taskType - Task type (chat, processing, embeddings)
 * @param {string} operation - Operation type
 * @param {string} providerId - Provider ID
 * @param {object} routing - Routing config
 * @param {object} defaultModels - Default models from llm.models
 * @returns {string|null} Model ID or null
 */
function getModelForProvider(taskType, operation, providerId, routing, defaultModels) {
    // Check model map first
    const modelMap = routing?.modelMap?.[taskType]?.[providerId];
    
    if (operation === 'embed') {
        return modelMap?.embeddings || defaultModels?.embeddings || null;
    }
    
    if (operation === 'generateVision') {
        return modelMap?.vision || defaultModels?.vision || null;
    }
    
    // Default to text model
    return modelMap?.text || defaultModels?.text || null;
}

/**
 * Build ordered list of eligible providers for a request
 * @param {string} taskType - Task type
 * @param {string} operation - Operation type
 * @param {object} routing - Routing configuration
 * @param {object} providers - Provider configurations
 * @returns {Array<object>} List of { providerId, model, eligibility }
 */
function buildCandidateList(taskType, operation, routing, providers, defaultModels) {
    const taskConfig = routing?.perTask?.[taskType] || DEFAULT_ROUTING_POLICY.perTask[taskType];
    const priorities = taskConfig?.priorities || ['ollama'];
    
    const candidates = [];
    
    for (const providerId of priorities) {
        const providerConfig = providers?.[providerId] || {};
        const eligibility = checkProviderEligibility(providerId, operation, providerConfig);
        const model = getModelForProvider(taskType, operation, providerId, routing, defaultModels);
        
        candidates.push({
            providerId,
            model,
            eligible: eligibility.eligible,
            reason: eligibility.reason,
            cooldownRemaining: eligibility.cooldownRemaining
        });
    }
    
    return candidates;
}

/**
 * Execute operation on a specific provider
 * @param {string} operation - Operation type
 * @param {object} payload - Request payload
 * @param {string} providerId - Provider ID
 * @param {string} model - Model to use
 * @param {object} providerConfig - Provider configuration
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<object>} Result with success flag
 */
async function executeOnProvider(operation, payload, providerId, model, providerConfig, timeoutMs) {
    const startTime = Date.now();
    
    try {
        let result;
        
        const options = {
            provider: providerId,
            model,
            providerConfig,
            timeout: timeoutMs,
            ...payload
        };
        
        switch (operation) {
            case 'generateText':
                result = await llm.generateText(options);
                break;
            case 'generateVision':
                result = await llm.generateVision(options);
                break;
            case 'embed':
                result = await llm.embed(options);
                break;
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
        
        const latency = Date.now() - startTime;
        
        if (result.success) {
            return {
                success: true,
                result,
                latency,
                provider: providerId,
                model
            };
        } else {
            // LLM module returned error in result - preserve statusCode
            const err = new Error(result.error || 'Operation failed');
            err.statusCode = result.statusCode;
            throw err;
        }
    } catch (error) {
        const latency = Date.now() - startTime;
        const normalizedError = normalizeError(error, providerId);
        
        return {
            success: false,
            error: normalizedError,
            latency,
            provider: providerId,
            model
        };
    }
}

/**
 * Route and execute a request with failover
 * @param {string} taskType - Task type: 'chat' | 'processing' | 'embeddings'
 * @param {string} operation - Operation: 'generateText' | 'generateVision' | 'embed'
 * @param {object} payload - Request payload
 * @param {object} config - Application config
 * @returns {Promise<object>} Result with routing metadata
 */
async function routeAndExecute(taskType, operation, payload, config) {
    const routing = config.llm?.routing || DEFAULT_ROUTING_POLICY;
    const providers = config.llm?.providers || {};
    const defaultModels = config.llm?.models || {};
    
    // Single provider mode: no failover. The central config determines exactly one
    // provider+model pair. Routing metadata is still returned for uniform diagnostics.
    if (routing.mode !== 'failover') {
        let cfgFn = configModule.getTextConfig;
        if (operation === 'generateVision') cfgFn = configModule.getVisionConfig;
        else if (operation === 'embed') cfgFn = configModule.getEmbeddingsConfig;
        const taskCfg = cfgFn(config);
        const providerId = taskCfg?.provider ?? config.llm?.provider ?? null;
        if (!providerId) {
            return {
                success: false,
                error: { code: 'no_provider', message: 'No LLM provider configured. Set in Settings > LLM.' },
                routing: { mode: 'single', usedProvider: null, model: null, attempts: [] }
            };
        }
        const providerConfig = taskCfg?.providerConfig ?? providers[providerId] ?? {};
        const model = payload.model || taskCfg?.model || getModelForProvider(taskType, operation, providerId, routing, defaultModels);
        
        const result = await executeOnProvider(operation, payload, providerId, model, providerConfig, 120000);
        
        return {
            ...result,
            routing: {
                mode: 'single',
                usedProvider: providerId,
                model,
                attempts: [{
                    provider: providerId,
                    model,
                    ok: result.success,
                    code: result.error?.code,
                    latency: result.latency
                }]
            }
        };
    }
    
    // Failover mode
    const taskConfig = routing.perTask?.[taskType] || DEFAULT_ROUTING_POLICY.perTask[taskType];
    const maxAttempts = taskConfig.maxAttempts || 3;
    const timeoutMs = taskConfig.timeoutMs || 60000;
    const cooldownMs = taskConfig.cooldownMs || 60000;
    const retryableErrors = taskConfig.retryableErrors || ['timeout', 'rate_limit', 'overloaded', 'server_error'];
    const nonRetryableErrors = taskConfig.nonRetryableErrors || ['auth', 'invalid_request', 'quota_exceeded'];
    
    // Build candidate list
    const candidates = buildCandidateList(taskType, operation, routing, providers, defaultModels);
    const eligibleCandidates = candidates.filter(c => c.eligible && c.model);
    
    if (eligibleCandidates.length === 0) {
        const reasons = candidates.map(c => `${c.providerId}: ${c.reason || 'no_model'}`).join(', ');
        return {
            success: false,
            error: {
                code: 'no_providers_available',
                message: `No eligible providers available for ${taskType}/${operation}. Reasons: ${reasons}`,
                retryable: false
            },
            routing: {
                mode: 'failover',
                usedProvider: null,
                attempts: [],
                candidates
            }
        };
    }
    
    const attempts = [];
    let lastResult = null;
    
    for (let attemptNum = 0; attemptNum < maxAttempts && attemptNum < eligibleCandidates.length; attemptNum++) {
        const candidate = eligibleCandidates[attemptNum];
        const { providerId, model } = candidate;
        const providerConfig = providers[providerId] || {};
        log.debug({ event: 'router_attempt', attempt: attemptNum + 1, maxAttempts, providerId, model }, 'Attempt');
        const result = await executeOnProvider(operation, payload, providerId, model, providerConfig, timeoutMs);
        
        attempts.push({
            provider: providerId,
            model,
            ok: result.success,
            code: result.error?.code,
            message: result.error?.message,
            latency: result.latency
        });
        
        if (result.success) {
            // Record success
            healthRegistry.recordSuccess(providerId);
            
            return {
                ...result,
                routing: {
                    mode: 'failover',
                    usedProvider: providerId,
                    model,
                    attempts,
                    candidates
                }
            };
        }
        
        // Record failure
        healthRegistry.recordFailure(providerId, result.error, cooldownMs);
        lastResult = result;
        
        // Both retryable and non-retryable errors advance to the next provider in the
        // priority list. The distinction matters for health tracking (non-retryable errors
        // like auth failures do not trigger exponential cooldown in healthRegistry).
        const errorCode = result.error?.code;

        if (nonRetryableErrors.includes(errorCode)) {
            log.debug({ event: 'router_non_retryable', providerId, errorCode }, 'Non-retryable error, trying next provider');
            continue;
        }
        if (retryableErrors.includes(errorCode)) {
            log.debug({ event: 'router_retryable', providerId, errorCode }, 'Retryable error, trying next provider');
            continue;
        }
        log.debug({ event: 'router_unknown_error', providerId }, 'Unknown error, trying next provider');
    }
    
    // All attempts failed
    return {
        success: false,
        error: lastResult?.error || {
            code: 'all_providers_failed',
            message: `All ${attempts.length} provider attempts failed for ${taskType}/${operation}`,
            retryable: false
        },
        routing: {
            mode: 'failover',
            usedProvider: null,
            attempts,
            candidates
        }
    };
}

/**
 * Resolve the provider/model/config that would be used for a given task,
 * without actually executing the operation. Useful for streaming callers
 * that need the routing decision but perform execution themselves.
 * @param {string} taskType - Task type: 'chat' | 'processing' | 'embeddings'
 * @param {string} operation - Operation: 'generateText' | 'generateVision' | 'embed'
 * @param {object} config - Application config
 * @returns {{ provider: string, model: string, providerConfig: object } | null}
 */
function routeResolve(taskType, operation, config) {
    const routing = config?.llm?.routing || DEFAULT_ROUTING_POLICY;
    const providers = config?.llm?.providers || {};
    const defaultModels = config?.llm?.models || {};

    if (routing.mode !== 'failover') {
        let cfgFn;
        if (operation === 'generateVision') cfgFn = configModule.getVisionConfig;
        else if (operation === 'embed') cfgFn = configModule.getEmbeddingsConfig;
        else cfgFn = configModule.getTextConfig;
        const resolved = cfgFn(config);
        if (!resolved?.provider) return null;
        return { provider: resolved.provider, model: resolved.model, providerConfig: resolved.providerConfig || {} };
    }

    const candidates = buildCandidateList(taskType, operation, routing, providers, defaultModels);
    const first = candidates.find(c => c.eligible && c.model);
    if (!first) return null;
    return { provider: first.providerId, model: first.model, providerConfig: providers[first.providerId] || {} };
}

/**
 * Get routing status for diagnostics
 * @param {object} config - Application config
 * @returns {object} Routing status
 */
function getRoutingStatus(config) {
    const routing = config.llm?.routing || DEFAULT_ROUTING_POLICY;
    
    return {
        mode: routing.mode || 'single',
        providerHealth: healthRegistry.getStatusSummary(),
        taskConfigs: {
            chat: routing.perTask?.chat || DEFAULT_ROUTING_POLICY.perTask.chat,
            processing: routing.perTask?.processing || DEFAULT_ROUTING_POLICY.perTask.processing,
            embeddings: routing.perTask?.embeddings || DEFAULT_ROUTING_POLICY.perTask.embeddings
        }
    };
}

/**
 * Reset routing state (for testing)
 */
function resetRoutingState() {
    healthRegistry.resetAllHealth();
}

module.exports = {
    routeAndExecute,
    routeResolve,
    normalizeError,
    checkProviderEligibility,
    buildCandidateList,
    getModelForProvider,
    getRoutingStatus,
    resetRoutingState,
    DEFAULT_ROUTING_POLICY
};
