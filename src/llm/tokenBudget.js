/**
 * Purpose:
 *   Prevents context-window overflows by estimating token usage, computing budgets,
 *   and (when enforcement is enabled) automatically truncating RAG context and
 *   conversation history so that the request fits within the model's limits.
 *
 * Responsibilities:
 *   - Token estimation: character-based heuristic (chars/4 * 1.1 safety margin) for
 *     plain text and multi-part messages (text + images)
 *   - Limit resolution: merges model metadata, task-level policy, and per-model
 *     overrides into a single set of effective limits
 *   - Budget calculation: given system prompt, RAG context, and message history,
 *     determines whether truncation or blocking is needed
 *   - Truncation strategies: trim RAG context first (to reservedForRag), then trim
 *     oldest conversation turns, keeping system messages
 *   - applyBudget: one-call convenience that calculates + truncates + returns modified inputs
 *   - getTokenEstimate: lightweight estimation for UI previews (no mutation)
 *
 * Key dependencies:
 *   - ./modelMetadata: provides contextTokens and maxOutputTokens for limit clamping
 *
 * Side effects:
 *   - None (pure computation; inputs are not mutated, copies are returned)
 *
 * Notes:
 *   - The 1-token ~ 4-char heuristic is tuned for English prose; CJK or code-heavy
 *     content may be under-estimated. A 10 % safety margin partially compensates.
 *   - Image tokens are estimated at 170 per image (OpenAI "high detail" ballpark).
 *   - When enforce is false, calculateBudget still populates warnings but never sets
 *     truncateRag / truncateHistory / blocked, allowing callers to make their own decisions.
 *   - DEFAULT_POLICY is exported for reference but is always overridden by the user's
 *     tokenPolicy from config when present.
 */

const modelMetadata = require('./modelMetadata');

/**
 * Approximate token count from text.
 * Uses a 1-token ~ 4-character heuristic with a 10% safety margin.
 * This tends to over-estimate for English prose and under-estimate for CJK or code,
 * but is fast and sufficient for budget gating (exact counts come from the provider
 * in the response).
 * @param {string} text - Text to count tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil((text.length / 4) * 1.1);
}

/**
 * Estimate tokens for a messages array
 * @param {Array} messages - Array of {role, content} objects
 * @returns {number} Estimated token count
 */
function estimateMessagesTokens(messages) {
    if (!messages || !Array.isArray(messages)) return 0;
    
    let total = 0;
    for (const msg of messages) {
        // Role overhead (~4 tokens per message for formatting)
        total += 4;
        
        if (typeof msg.content === 'string') {
            total += estimateTokens(msg.content);
        } else if (Array.isArray(msg.content)) {
            // Multi-part content (text + images)
            for (const part of msg.content) {
                if (part.type === 'text') {
                    total += estimateTokens(part.text);
                } else if (part.type === 'image_url' || part.type === 'image') {
                    // Images typically use ~85-170 tokens depending on detail
                    total += 170;
                }
            }
        }
    }
    
    return total;
}

/**
 * Default token policy values
 */
const DEFAULT_POLICY = {
    enforce: true,
    defaultMaxOutputTokens: 4096,
    defaultReservedForSystem: 500,
    defaultReservedForRag: 2000,
    perModel: {},
    perTask: {
        chat: { reservedForRag: 3000, maxOutputTokens: 2048 },
        processing: { maxOutputTokens: 4096, reservedForRag: 1000 },
        embeddings: { maxOutputTokens: null }
    }
};

/**
 * Get effective limits for a model and task
 * @param {object} params
 * @param {string} params.provider - Provider ID
 * @param {string} params.modelId - Model ID
 * @param {string} params.task - Task type: 'chat', 'processing', 'embeddings'
 * @param {object} params.tokenPolicy - User's token policy from config
 * @param {object} params.modelInfo - Model metadata (contextTokens, maxOutputTokens)
 * @returns {object} Effective limits
 */
function getEffectiveLimits({ provider, modelId, task = 'chat', tokenPolicy = {}, modelInfo = {} }) {
    const policy = { ...DEFAULT_POLICY, ...tokenPolicy };
    const modelKey = `${provider}:${modelId}`;
    
    // Start with defaults
    let limits = {
        contextTokens: modelInfo.contextTokens || null,
        maxInputTokens: modelInfo.contextTokens || null,
        maxOutputTokens: policy.defaultMaxOutputTokens,
        reservedForSystem: policy.defaultReservedForSystem,
        reservedForRag: policy.defaultReservedForRag,
        enforce: policy.enforce !== false
    };
    
    // Apply task-specific overrides
    if (policy.perTask && policy.perTask[task]) {
        const taskPolicy = policy.perTask[task];
        if (taskPolicy.maxOutputTokens !== undefined) limits.maxOutputTokens = taskPolicy.maxOutputTokens;
        if (taskPolicy.reservedForRag !== undefined) limits.reservedForRag = taskPolicy.reservedForRag;
        if (taskPolicy.reservedForSystem !== undefined) limits.reservedForSystem = taskPolicy.reservedForSystem;
        if (taskPolicy.maxInputTokens !== undefined) limits.maxInputTokens = taskPolicy.maxInputTokens;
    }
    
    // Apply model-specific overrides (highest priority)
    if (policy.perModel && policy.perModel[modelKey]) {
        const modelPolicy = policy.perModel[modelKey];
        if (modelPolicy.maxOutputTokens !== undefined) limits.maxOutputTokens = modelPolicy.maxOutputTokens;
        if (modelPolicy.reservedForRag !== undefined) limits.reservedForRag = modelPolicy.reservedForRag;
        if (modelPolicy.reservedForSystem !== undefined) limits.reservedForSystem = modelPolicy.reservedForSystem;
        if (modelPolicy.maxInputTokens !== undefined) limits.maxInputTokens = modelPolicy.maxInputTokens;
    }
    
    // Clamp to model limits if enforcing
    if (limits.enforce && limits.contextTokens) {
        if (limits.maxInputTokens === null || limits.maxInputTokens > limits.contextTokens) {
            limits.maxInputTokens = limits.contextTokens;
        }
    }
    
    // Clamp output tokens to provider max if known
    if (limits.enforce && modelInfo.maxOutputTokens) {
        if (limits.maxOutputTokens > modelInfo.maxOutputTokens) {
            limits.maxOutputTokens = modelInfo.maxOutputTokens;
        }
    }
    
    return limits;
}

/**
 * Calculate token budget for a request
 * @param {object} params
 * @param {string} params.provider - Provider ID
 * @param {string} params.modelId - Model ID
 * @param {Array} params.messages - Messages array (system + user + assistant)
 * @param {string} params.ragContext - RAG context string
 * @param {string} params.systemPrompt - System prompt
 * @param {object} params.tokenPolicy - User's token policy
 * @param {object} params.modelInfo - Model metadata
 * @param {string} params.task - Task type
 * @returns {object} Budget calculation result
 */
function calculateBudget({
    provider,
    modelId,
    messages = [],
    ragContext = '',
    systemPrompt = '',
    tokenPolicy = {},
    modelInfo = {},
    task = 'chat'
}) {
    const limits = getEffectiveLimits({ provider, modelId, task, tokenPolicy, modelInfo });
    
    // Estimate current token usage
    const systemTokens = estimateTokens(systemPrompt);
    const ragTokens = estimateTokens(ragContext);
    const messagesTokens = estimateMessagesTokens(messages);
    const totalInputTokens = systemTokens + ragTokens + messagesTokens;
    
    const result = {
        // Estimated usage
        estimatedSystemTokens: systemTokens,
        estimatedRagTokens: ragTokens,
        estimatedMessagesTokens: messagesTokens,
        estimatedInputTokens: totalInputTokens,
        
        // Limits
        limits,
        modelContextTokens: limits.contextTokens,
        
        // Budget allocation
        budgetForOutput: limits.maxOutputTokens,
        budgetForRag: limits.reservedForRag,
        budgetForSystem: limits.reservedForSystem,
        
        // Decisions
        decision: {
            withinBudget: true,
            truncateRag: false,
            truncateHistory: false,
            blocked: false,
            reason: null,
            warnings: []
        }
    };
    
    // Enforcement logic: when the model's context window is known and enforcement is on,
    // verify that estimated input + reserved output fits. If not, apply a two-stage
    // truncation strategy:
    //   1. Trim RAG context down to reservedForRag (least disruptive -- RAG can be re-fetched)
    //   2. Trim conversation history from oldest to newest (more disruptive but necessary)
    // If even the system prompt alone exceeds the window, block the request entirely.
    if (limits.contextTokens && limits.enforce) {
        const availableForInput = limits.contextTokens - limits.maxOutputTokens;

        if (totalInputTokens > availableForInput) {
            result.decision.withinBudget = false;

            const excess = totalInputTokens - availableForInput;

            // Strategy 1: Trim RAG context first
            if (ragTokens > limits.reservedForRag) {
                result.decision.truncateRag = true;
                const ragExcess = ragTokens - limits.reservedForRag;
                result.allowedRagTokens = limits.reservedForRag;
                result.decision.warnings.push(`RAG context will be truncated by ~${ragExcess} tokens`);
            } else {
                result.allowedRagTokens = ragTokens;
            }
            
            // Recalculate after RAG truncation
            const afterRagTrunc = systemTokens + result.allowedRagTokens + messagesTokens;
            
            // Strategy 2: Trim conversation history if still over
            if (afterRagTrunc > availableForInput) {
                result.decision.truncateHistory = true;
                const historyExcess = afterRagTrunc - availableForInput;
                result.decision.warnings.push(`Conversation history may be truncated by ~${historyExcess} tokens`);
                
                // If even after trimming we can't fit, block
                const minRequired = systemTokens + (limits.reservedForSystem || 0);
                if (minRequired > availableForInput) {
                    result.decision.blocked = true;
                    result.decision.reason = 'Request exceeds model context window. Reduce input size or raise caps.';
                }
            }
        }
    } else if (limits.contextTokens && !limits.enforce) {
        // Informational mode - just warn
        const availableForInput = limits.contextTokens - limits.maxOutputTokens;
        if (totalInputTokens > availableForInput) {
            result.decision.warnings.push(`Input (~${totalInputTokens} tokens) exceeds model context (${limits.contextTokens} tokens). Enforcement is disabled.`);
        }
    }
    
    return result;
}

/**
 * Truncate RAG context to fit within token budget
 * @param {string} ragContext - Original RAG context
 * @param {number} maxTokens - Maximum tokens allowed
 * @returns {string} Truncated context
 */
function truncateRagContext(ragContext, maxTokens) {
    if (!ragContext || maxTokens <= 0) return '';
    
    const currentTokens = estimateTokens(ragContext);
    if (currentTokens <= maxTokens) return ragContext;
    
    // Truncate by character estimate
    const ratio = maxTokens / currentTokens;
    const targetChars = Math.floor(ragContext.length * ratio * 0.95); // 5% safety margin
    
    // Try to truncate at a natural break point
    let truncated = ragContext.substring(0, targetChars);
    const lastNewline = truncated.lastIndexOf('\n');
    if (lastNewline > targetChars * 0.8) {
        truncated = truncated.substring(0, lastNewline);
    }
    
    return truncated + '\n[... context truncated ...]';
}

/**
 * Truncate conversation history to fit within token budget
 * @param {Array} messages - Messages array
 * @param {number} maxTokens - Maximum tokens allowed for history
 * @param {boolean} keepSystem - Whether to preserve system messages
 * @returns {Array} Truncated messages
 */
function truncateHistory(messages, maxTokens, keepSystem = true) {
    if (!messages || messages.length === 0) return [];
    
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    // Calculate system token cost if keeping
    const systemTokens = keepSystem ? estimateMessagesTokens(systemMessages) : 0;
    const availableForHistory = maxTokens - systemTokens;
    
    if (availableForHistory <= 0) {
        return keepSystem ? systemMessages : [];
    }
    
    // Keep most recent messages first
    const result = [...nonSystemMessages].reverse();
    let totalTokens = 0;
    const kept = [];
    
    for (const msg of result) {
        const msgTokens = estimateMessagesTokens([msg]);
        if (totalTokens + msgTokens <= availableForHistory) {
            kept.unshift(msg);
            totalTokens += msgTokens;
        } else {
            break;
        }
    }
    
    return keepSystem ? [...systemMessages, ...kept] : kept;
}

/**
 * Apply token budget to a request, performing necessary truncation
 * @param {object} params - Same as calculateBudget
 * @returns {object} Modified request with truncated content and budget info
 */
function applyBudget(params) {
    const budget = calculateBudget(params);
    
    if (budget.decision.blocked) {
        return {
            success: false,
            error: budget.decision.reason,
            budget
        };
    }
    
    let { messages, ragContext, systemPrompt } = params;
    
    // Apply truncations if needed and enforcing
    if (budget.limits.enforce) {
        if (budget.decision.truncateRag && ragContext) {
            ragContext = truncateRagContext(ragContext, budget.allowedRagTokens || budget.budgetForRag);
        }
        
        if (budget.decision.truncateHistory && messages) {
            const availableForMessages = (budget.limits.maxInputTokens || budget.modelContextTokens) 
                - budget.estimatedSystemTokens 
                - estimateTokens(ragContext)
                - budget.budgetForOutput;
            messages = truncateHistory(messages, availableForMessages);
        }
    }
    
    return {
        success: true,
        messages,
        ragContext,
        systemPrompt,
        maxOutputTokens: budget.budgetForOutput,
        budget
    };
}

/**
 * Get token estimate for UI preview
 * @param {object} params
 * @returns {object} Estimation result for display
 */
function getTokenEstimate(params) {
    const budget = calculateBudget(params);
    
    return {
        estimatedInputTokens: budget.estimatedInputTokens,
        estimatedSystemTokens: budget.estimatedSystemTokens,
        estimatedRagTokens: budget.estimatedRagTokens,
        estimatedMessagesTokens: budget.estimatedMessagesTokens,
        modelContextTokens: budget.modelContextTokens,
        limits: {
            maxInputTokens: budget.limits.maxInputTokens,
            maxOutputTokens: budget.limits.maxOutputTokens,
            reservedForRag: budget.limits.reservedForRag,
            reservedForSystem: budget.limits.reservedForSystem,
            enforce: budget.limits.enforce
        },
        decision: budget.decision,
        utilizationPercent: budget.modelContextTokens 
            ? Math.round((budget.estimatedInputTokens / budget.modelContextTokens) * 100)
            : null
    };
}

module.exports = {
    estimateTokens,
    estimateMessagesTokens,
    getEffectiveLimits,
    calculateBudget,
    truncateRagContext,
    truncateHistory,
    applyBudget,
    getTokenEstimate,
    DEFAULT_POLICY
};
