/**
 * Purpose:
 *   Tracks cumulative LLM API spend broken down by provider, model, operation, and
 *   context (e.g. 'document', 'chat', 'email'). Provides cost summaries, daily
 *   history, and budget-awareness data for the admin dashboard and billing system.
 *
 * Responsibilities:
 *   - Maintains an in-memory pricing table (MODEL_PRICING) for per-million-token costs
 *   - Buffers incoming track() calls and flushes them to Supabase every 10 s (or
 *     immediately when the buffer reaches 10 entries)
 *   - Caches aggregated summaries (total cost, by-model, daily) with a 1-minute TTL
 *     to avoid hammering the database on every dashboard refresh
 *   - getSummaryForPeriod: returns a CostSummary-shaped object including period-over-period
 *     comparison, budget limit, and alert status for the /api/costs/summary endpoint
 *
 * Key dependencies:
 *   - ../supabase/storageHelper: Supabase storage adapter for reading/writing cost rows
 *     (loaded with try/catch because the import can fail in certain project-folder setups)
 *
 * Side effects:
 *   - Periodic writes to Supabase (llm_costs table) via the flush interval
 *   - setInterval timer created in constructor (cleared on destroy())
 *
 * Notes:
 *   - Exported as a singleton instance; the CostTracker class is also exported for testing.
 *   - Ollama models are priced at $0 (local inference). Unknown cloud models default to
 *     $1.00 / $3.00 per 1M tokens as a conservative estimate.
 *   - If Supabase is unavailable, tracking degrades to in-memory only; data is lost on restart.
 *   - setDataDir() is a no-op retained for backward compatibility with callers that
 *     previously used local-file storage.
 */

const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'cost-tracker' });

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    log.warn({ event: 'cost_tracker_supabase_unavailable', reason: e.message }, 'Supabase not available, using in-memory tracking only');
}

// Pricing per 1 million tokens (USD)
// Updated: January 2026
const MODEL_PRICING = {
    // OpenAI
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50 },
    'text-embedding-3-small': { input: 0.02, output: 0 },
    'text-embedding-3-large': { input: 0.13, output: 0 },
    'text-embedding-ada-002': { input: 0.10, output: 0 },
    
    // Anthropic Claude
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    
    // Google Gemini
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-pro': { input: 0.50, output: 1.50 },
    'text-embedding-004': { input: 0.00, output: 0 },
    
    // xAI Grok
    'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50 },
    'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50 },
    'grok-4-fast-reasoning': { input: 0.20, output: 0.50 },
    'grok-4-fast-non-reasoning': { input: 0.20, output: 0.50 },
    'grok-3-mini': { input: 0.30, output: 0.50 },
    'grok-3': { input: 3.00, output: 15.00 },
    'grok-2-vision-1212': { input: 2.00, output: 10.00 },
    
    // DeepSeek
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-coder': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    
    // Kimi K2
    'kimi-k2': { input: 0.60, output: 2.40 },
    'moonshot-v1-8k': { input: 0.60, output: 2.40 },
    
    // MiniMax
    'MiniMax-M2': { input: 0.20, output: 1.10 },
    'abab6.5s-chat': { input: 0.15, output: 0.75 },
    'embo-01': { input: 0.01, output: 0 },
    
    // Ollama (local - free)
    'ollama': { input: 0, output: 0 }
};

// Conservative fallback for models not in the table above. Deliberately higher than
// most actual prices to encourage maintaining MODEL_PRICING and to avoid under-reporting.
const DEFAULT_PRICING = { input: 1.00, output: 3.00 };

class CostTracker {
    constructor(options = {}) {
        // In-memory cache for performance
        this._cache = {
            totals: null,
            byModel: null,
            byProvider: null,
            lastRefresh: 0
        };
        this._cacheTTL = 60000; // 1 minute
        
        // Buffer for batching writes
        this._buffer = [];
        this._flushInterval = setInterval(() => this._flush(), 10000); // 10 seconds
    }

    /**
     * Get storage instance
     */
    _getStorage() {
        if (!getStorage) return null;
        try {
            return getStorage();
        } catch (e) {
            return null;
        }
    }

    /**
     * Flush buffered requests to Supabase.
     * Snapshot-and-clear pattern: the buffer is copied and emptied before the async
     * writes begin, so new track() calls during the flush go into a fresh buffer.
     * On failure the snapshot is prepended back for retry on the next flush cycle.
     */
    async _flush() {
        if (this._buffer.length === 0) return;

        const toFlush = [...this._buffer];
        this._buffer = [];

        try {
            const storage = this._getStorage();
            if (!storage) return;

            for (const request of toFlush) {
                await storage.trackLLMCost(
                    request.provider,
                    request.model,
                    request.operation,
                    request.inputTokens,
                    request.outputTokens,
                    request.cost,
                    request.latencyMs,
                    request.success,
                    request.context
                );
            }

            // Invalidate cache so next getSummary picks up the new data
            this._cache.lastRefresh = 0;
        } catch (e) {
            log.warn({ event: 'cost_tracker_flush_failed', reason: e.message }, 'Could not flush to Supabase');
            // Re-add to buffer for retry on next flush cycle
            this._buffer.unshift(...toFlush);
        }
    }

    /**
     * Get pricing for a model.
     * Resolution order: exact match -> ollama (always free) -> substring match -> default.
     * Substring matching handles versioned model names (e.g. "gpt-4o-2024-05-13" matches "gpt-4o").
     */
    getPricing(model, provider = 'unknown') {
        if (MODEL_PRICING[model]) {
            return MODEL_PRICING[model];
        }

        if (provider === 'ollama') {
            return { input: 0, output: 0 };
        }

        for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
            if (model.toLowerCase().includes(key.toLowerCase())) {
                return pricing;
            }
        }

        return DEFAULT_PRICING;
    }

    /**
     * Calculate cost for a request
     */
    calculateCost(inputTokens, outputTokens, model, provider) {
        const pricing = this.getPricing(model, provider);
        const inputCost = (inputTokens / 1_000_000) * pricing.input;
        const outputCost = (outputTokens / 1_000_000) * pricing.output;
        return {
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
            pricing
        };
    }

    /**
     * Track a request (buffered for performance)
     */
    track(data) {
        const {
            provider,
            model,
            inputTokens = 0,
            outputTokens = 0,
            operation = 'generateText',
            success = true,
            latencyMs = 0,
            context = null  // e.g., 'document', 'email', 'transcript', 'chat', 'draft', etc.
        } = data;

        const timestamp = new Date().toISOString();
        const costInfo = this.calculateCost(inputTokens, outputTokens, model, provider);
        
        const request = {
            timestamp,
            provider,
            model,
            operation,
            context,
            inputTokens,
            outputTokens,
            cost: costInfo.totalCost,
            inputCost: costInfo.inputCost,
            outputCost: costInfo.outputCost,
            latencyMs,
            success
        };

        // Add to buffer
        this._buffer.push(request);
        
        // Flush immediately if buffer is large
        if (this._buffer.length >= 10) {
            this._flush();
        }

        return request;
    }

    /**
     * Track synchronously and flush immediately
     */
    async trackAndFlush(data) {
        this.track(data);
        await this._flush();
    }

    /**
     * Refresh cache from Supabase
     */
    async _refreshCache() {
        if (Date.now() - this._cache.lastRefresh < this._cacheTTL) {
            return;
        }
        
        try {
            const storage = this._getStorage();
            if (!storage) return;
            
            const [summary, byModel, daily] = await Promise.all([
                storage.getLLMCostSummary(),
                storage.getLLMCostsByModel(),
                storage.getLLMCostsDaily(30)
            ]);
            
            this._cache = {
                summary,
                byModel,
                daily,
                lastRefresh: Date.now()
            };
        } catch (e) {
            log.warn({ event: 'cost_tracker_refresh_failed', reason: e.message }, 'Could not refresh cache');
        }
    }

    /**
     * Get summary statistics
     */
    async getSummary() {
        await this._refreshCache();
        
        const summary = this._cache.summary || {};
        const byModel = this._cache.byModel || [];
        const daily = this._cache.daily || [];
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const todayStats = daily.find(d => d.date === today) || { cost: 0, requests: 0, input_tokens: 0, output_tokens: 0 };
        
        // Calculate this month
        const thisMonth = today.substring(0, 7);
        let monthCost = 0;
        let monthRequests = 0;
        for (const day of daily) {
            if (day.date?.startsWith(thisMonth)) {
                monthCost += parseFloat(day.cost) || 0;
                monthRequests += day.requests || 0;
            }
        }
        
        // Top models
        const topModels = byModel.slice(0, 5).map(m => ({
            key: `${m.provider}/${m.model}`,
            provider: m.provider,
            model: m.model,
            cost: parseFloat(m.cost) || 0,
            inputTokens: m.input_tokens || 0,
            outputTokens: m.output_tokens || 0,
            requests: m.requests || 0,
            avgLatencyMs: parseFloat(m.avg_latency_ms) || 0
        }));
        
        // By provider
        const byProvider = {};
        for (const m of byModel) {
            if (!byProvider[m.provider]) {
                byProvider[m.provider] = { cost: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
            }
            byProvider[m.provider].cost += parseFloat(m.cost) || 0;
            byProvider[m.provider].inputTokens += m.input_tokens || 0;
            byProvider[m.provider].outputTokens += m.output_tokens || 0;
            byProvider[m.provider].requests += m.requests || 0;
        }
        
        const totalRequests = summary.total_requests || 0;
        const totalCost = parseFloat(summary.total_cost) || 0;
        
        return {
            totals: {
                totalCost,
                totalInputTokens: summary.total_tokens || 0,
                totalOutputTokens: 0,
                totalRequests,
                firstRequest: null,
                lastRequest: null
            },
            today: {
                cost: parseFloat(todayStats.cost) || 0,
                requests: todayStats.requests || 0,
                inputTokens: todayStats.input_tokens || 0,
                outputTokens: todayStats.output_tokens || 0
            },
            thisMonth: {
                cost: monthCost,
                requests: monthRequests
            },
            byProvider,
            topModels,
            recentRequests: [],
            avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
            dailyHistory: daily.map(d => ({
                date: d.date,
                cost: parseFloat(d.cost) || 0,
                requests: d.requests || 0,
                inputTokens: d.input_tokens || 0,
                outputTokens: d.output_tokens || 0
            }))
        };
    }

    /**
     * Get summary for a specific period (CostSummary shape for /api/costs/summary)
     * @param {string} period - 'day' | 'week' | 'month' | 'all'
     * @returns {Promise<object>} CostSummary-compatible object
     */
    async getSummaryForPeriod(period) {
        const storage = this._getStorage();
        if (!storage) {
            return this._emptyCostSummary(period);
        }

        const now = new Date();
        const end = new Date(now);
        let start = new Date(now);
        let days = 30;

        if (period === 'day') {
            start.setHours(0, 0, 0, 0);
            days = 1;
        } else if (period === 'week') {
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            days = 7;
        } else if (period === 'month') {
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            days = 30;
        } else {
            // all
            start.setDate(start.getDate() - 365);
            start.setHours(0, 0, 0, 0);
            days = 365;
        }

        try {
            const [breakdown, dailyRows, previousBreakdown] = await Promise.all([
                storage.getLLMCostBreakdownForPeriod(start, end),
                storage.getLLMCostsDaily(days),
                this._getPreviousPeriodBreakdown(storage, period, start, end)
            ]);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            const dailyBreakdown = (dailyRows || [])
                .filter(d => d.date >= startStr && d.date <= endStr)
                .map(d => ({
                    date: d.date,
                    cost: parseFloat(d.cost) || 0,
                    calls: d.requests || 0
                }))
                .sort((a, b) => a.date.localeCompare(b.date));

            const currentCost = breakdown.total_cost || 0;
            const previousCost = previousBreakdown;
            const percentChange =
                previousCost != null && previousCost > 0
                    ? ((currentCost - previousCost) / previousCost) * 100
                    : null;

            let budgetLimit = null;
            let budgetUsedPercent = null;
            let budgetAlertTriggered = false;
            if (period === 'week' || period === 'month') {
                try {
                    const budget = await storage.getLLMBudget(period);
                    const limit = budget?.limitUsd ?? budget?.limit_usd;
                    if (budget && limit > 0) {
                        budgetLimit = parseFloat(limit);
                        budgetUsedPercent = Math.round((currentCost / budgetLimit) * 1000) / 10;
                        const threshold = budget.alertThresholdPercent ?? budget.alert_threshold_percent ?? 80;
                        budgetAlertTriggered = budgetUsedPercent >= threshold;
                    }
                } catch (e) {
                    // ignore
                }
            }

            return {
                total: currentCost,
                byProvider: breakdown.by_provider || {},
                byModel: breakdown.by_model || {},
                byOperation: breakdown.by_operation || {},
                byContext: breakdown.by_context || {},
                period: { start: startStr, end: endStr },
                dailyBreakdown,
                totalInputTokens: breakdown.total_input_tokens || 0,
                totalOutputTokens: breakdown.total_output_tokens || 0,
                previousPeriodCost: previousCost,
                percentChange: percentChange != null ? Math.round(percentChange * 10) / 10 : null,
                budgetLimit,
                budgetUsedPercent,
                budgetAlertTriggered
            };
        } catch (e) {
            log.warn({ event: 'cost_tracker_summary_period_failed', reason: e.message }, 'getSummaryForPeriod failed');
            return this._emptyCostSummary(period);
        }
    }

    async _getPreviousPeriodBreakdown(storage, period, currentStart, currentEnd) {
        const start = new Date(currentStart);
        const end = new Date(currentEnd);
        const spanMs = end - start;
        const prevEnd = new Date(start);
        prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
        const prevStart = new Date(prevEnd.getTime() - spanMs);
        try {
            const b = await storage.getLLMCostBreakdownForPeriod(prevStart, prevEnd);
            return b.total_cost || 0;
        } catch (e) {
            return null;
        }
    }

    _emptyCostSummary(period) {
        const now = new Date();
        const endStr = now.toISOString().split('T')[0];
        let startStr = endStr;
        if (period === 'week') {
            const s = new Date(now);
            s.setDate(s.getDate() - 7);
            startStr = s.toISOString().split('T')[0];
        } else if (period === 'month' || period === 'all') {
            const s = new Date(now);
            s.setDate(s.getDate() - (period === 'all' ? 365 : 30));
            startStr = s.toISOString().split('T')[0];
        }
        return {
            total: 0,
            byProvider: {},
            byModel: {},
            byOperation: {},
            byContext: {},
            period: { start: startStr, end: endStr },
            dailyBreakdown: [],
            totalInputTokens: 0,
            totalOutputTokens: 0,
            previousPeriodCost: null,
            percentChange: null,
            budgetLimit: null,
            budgetUsedPercent: null,
            budgetAlertTriggered: false
        };
    }

    /**
     * Get daily history for charts
     */
    async getDailyHistory(days = 30) {
        await this._refreshCache();
        
        const daily = this._cache.daily || [];
        const history = [];
        const now = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const stats = daily.find(d => d.date === dateStr) || { cost: 0, requests: 0, input_tokens: 0, output_tokens: 0 };
            history.push({
                date: dateStr,
                cost: parseFloat(stats.cost) || 0,
                requests: stats.requests || 0,
                inputTokens: stats.input_tokens || 0,
                outputTokens: stats.output_tokens || 0
            });
        }
        
        return history;
    }

    /**
     * Get detailed model stats
     */
    async getModelStats() {
        await this._refreshCache();
        
        return (this._cache.byModel || []).map(m => ({
            key: `${m.provider}/${m.model}`,
            provider: m.provider,
            model: m.model,
            cost: parseFloat(m.cost) || 0,
            inputTokens: m.input_tokens || 0,
            outputTokens: m.output_tokens || 0,
            requests: m.requests || 0,
            avgLatencyMs: parseFloat(m.avg_latency_ms) || 0
        }));
    }

    /**
     * Set data directory (no-op, kept for backwards compatibility)
     */
    setDataDir(dataDir) {
        // No-op in Supabase mode - data is stored in Supabase, not local files
        log.debug({ event: 'cost_tracker_setdatadir_noop' }, 'setDataDir called (no-op in Supabase mode)');
    }

    /**
     * Reset all costs (clears cache, data remains in Supabase)
     */
    reset() {
        this._cache = {
            totals: null,
            byModel: null,
            byProvider: null,
            lastRefresh: 0
        };
        this._buffer = [];
    }

    /**
     * Destroy tracker (flush remaining data)
     */
    async destroy() {
        if (this._flushInterval) {
            clearInterval(this._flushInterval);
        }
        await this._flush();
    }

    /**
     * Get pricing table for UI
     */
    static getPricingTable() {
        return Object.entries(MODEL_PRICING).map(([model, pricing]) => ({
            model,
            inputPer1M: pricing.input,
            outputPer1M: pricing.output
        }));
    }
}

// Singleton instance
const costTracker = new CostTracker();

module.exports = costTracker;
module.exports.CostTracker = CostTracker;
module.exports.MODEL_PRICING = MODEL_PRICING;
