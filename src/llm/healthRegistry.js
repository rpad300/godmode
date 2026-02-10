/**
 * Provider Health Registry
 * Tracks provider failures, cooldowns, and availability for failover routing
 */

const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'health-registry' });

// In-memory health state for each provider
const healthState = new Map();

// Default health entry
function createHealthEntry() {
    return {
        lastFailureAt: null,
        lastSuccessAt: null,
        failureCount: 0,
        consecutiveFailures: 0,
        cooldownUntil: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0
    };
}

/**
 * Get health state for a provider
 * @param {string} providerId - Provider identifier
 * @returns {object} Health state
 */
function getHealth(providerId) {
    if (!healthState.has(providerId)) {
        healthState.set(providerId, createHealthEntry());
    }
    return { ...healthState.get(providerId) };
}

/**
 * Get health state for all providers
 * @returns {object} Map of providerId -> health state
 */
function getAllHealth() {
    const result = {};
    for (const [providerId, state] of healthState) {
        result[providerId] = { ...state };
    }
    return result;
}

/**
 * Check if a provider is currently in cooldown
 * @param {string} providerId - Provider identifier
 * @returns {boolean}
 */
function isInCooldown(providerId) {
    const state = healthState.get(providerId);
    if (!state || !state.cooldownUntil) return false;
    return Date.now() < state.cooldownUntil;
}

/**
 * Get remaining cooldown time in milliseconds
 * @param {string} providerId - Provider identifier
 * @returns {number} Remaining cooldown in ms, or 0 if not in cooldown
 */
function getCooldownRemaining(providerId) {
    const state = healthState.get(providerId);
    if (!state || !state.cooldownUntil) return 0;
    const remaining = state.cooldownUntil - Date.now();
    return remaining > 0 ? remaining : 0;
}

/**
 * Record a successful request
 * @param {string} providerId - Provider identifier
 */
function recordSuccess(providerId) {
    if (!healthState.has(providerId)) {
        healthState.set(providerId, createHealthEntry());
    }
    
    const state = healthState.get(providerId);
    state.lastSuccessAt = Date.now();
    state.consecutiveFailures = 0;
    state.cooldownUntil = null;
    state.lastErrorCode = null;
    state.lastErrorMessage = null;
    state.totalRequests++;
    state.totalSuccesses++;
    log.debug({ event: 'health_success', providerId }, 'Provider success recorded, cooldown cleared');
}

/**
 * Record a failed request
 * @param {string} providerId - Provider identifier
 * @param {object} error - Normalized error object
 * @param {number} cooldownMs - Cooldown duration in milliseconds
 */
function recordFailure(providerId, error, cooldownMs = 60000) {
    if (!healthState.has(providerId)) {
        healthState.set(providerId, createHealthEntry());
    }
    
    const state = healthState.get(providerId);
    const now = Date.now();
    
    state.lastFailureAt = now;
    state.failureCount++;
    state.consecutiveFailures++;
    state.lastErrorCode = error.code || 'unknown';
    state.lastErrorMessage = error.message || 'Unknown error';
    state.totalRequests++;
    state.totalFailures++;
    
    // Apply cooldown for retryable errors
    if (error.retryable && cooldownMs > 0) {
        // Exponential backoff for consecutive failures (max 5 minutes)
        const backoffMultiplier = Math.min(Math.pow(2, state.consecutiveFailures - 1), 5);
        const effectiveCooldown = Math.min(cooldownMs * backoffMultiplier, 300000);
        state.cooldownUntil = now + effectiveCooldown;
        log.debug({ event: 'health_cooldown', providerId, effectiveCooldownMs: effectiveCooldown, consecutiveFailures: state.consecutiveFailures }, 'Cooldown set');
    }
    log.debug({ event: 'health_failure', providerId, code: error.code, retryable: error.retryable }, 'Failure recorded');
}

/**
 * Reset health state for a provider
 * @param {string} providerId - Provider identifier
 */
function resetHealth(providerId) {
    healthState.set(providerId, createHealthEntry());
    log.debug({ event: 'health_reset', providerId }, 'Health state reset');
}

/**
 * Reset health state for all providers
 */
function resetAllHealth() {
    healthState.clear();
    log.info({ event: 'health_reset_all' }, 'All provider health states reset');
}

/**
 * Get providers sorted by health (healthiest first)
 * @param {Array<string>} providerIds - List of provider IDs to sort
 * @returns {Array<string>} Sorted provider IDs
 */
function sortByHealth(providerIds) {
    return [...providerIds].sort((a, b) => {
        const healthA = getHealth(a);
        const healthB = getHealth(b);
        
        // Providers in cooldown go last
        const inCooldownA = isInCooldown(a);
        const inCooldownB = isInCooldown(b);
        if (inCooldownA !== inCooldownB) {
            return inCooldownA ? 1 : -1;
        }
        
        // Lower consecutive failures is better
        if (healthA.consecutiveFailures !== healthB.consecutiveFailures) {
            return healthA.consecutiveFailures - healthB.consecutiveFailures;
        }
        
        // More recent success is better
        const successA = healthA.lastSuccessAt || 0;
        const successB = healthB.lastSuccessAt || 0;
        return successB - successA;
    });
}

/**
 * Get summary status for API response
 * @returns {Array<object>} Provider health summaries
 */
function getStatusSummary() {
    const result = [];
    for (const [providerId, state] of healthState) {
        result.push({
            id: providerId,
            cooldownUntil: state.cooldownUntil,
            cooldownRemaining: getCooldownRemaining(providerId),
            lastErrorCode: state.lastErrorCode,
            lastFailureAt: state.lastFailureAt,
            lastSuccessAt: state.lastSuccessAt,
            consecutiveFailures: state.consecutiveFailures,
            failureCount: state.failureCount,
            isHealthy: !isInCooldown(providerId) && state.consecutiveFailures < 3
        });
    }
    return result;
}

module.exports = {
    getHealth,
    getAllHealth,
    isInCooldown,
    getCooldownRemaining,
    recordSuccess,
    recordFailure,
    resetHealth,
    resetAllHealth,
    sortByHealth,
    getStatusSummary
};
