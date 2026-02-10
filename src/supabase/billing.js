/**
 * Billing Module
 * Handles project balance, pricing configurations, and cost calculations
 * 
 * Features:
 * - Check project balance before LLM requests
 * - Calculate billable cost with tier-based markup
 * - Debit/credit project balance atomically
 * - Get billing summaries and reports
 * - Manage pricing configurations (global and per-project)
 * - Automatic USD/EUR exchange rate support
 */

const { logger } = require('../logger');
const { getClient, getAdminClient } = require('./client');
const notifications = require('./notifications');

const log = logger.child({ module: 'billing' });

// Exchange rate service (lazy loaded to avoid circular deps)
let exchangeRateService = null;
function getExchangeRateService() {
    if (!exchangeRateService) {
        try {
            exchangeRateService = require('../services/exchange-rate');
        } catch (e) {
            log.warn({ event: 'billing_exchange_rate_unavailable', reason: e.message }, 'Exchange rate service not available');
        }
    }
    return exchangeRateService;
}

// ============================================
// BALANCE OPERATIONS
// ============================================

/**
 * Check if project has sufficient balance for AI request
 * @param {string} projectId - Project ID
 * @param {number} estimatedCostEur - Estimated cost in EUR (optional)
 * @returns {Promise<{allowed: boolean, reason?: string, balance_eur: number, unlimited: boolean, tokens_in_period: number, current_tier_name?: string, current_markup_percent: number}>}
 */
async function checkProjectBalance(projectId, estimatedCostEur = 0) {
    const client = getAdminClient() || getClient();
    if (!client) {
        // No database, allow by default
        return { allowed: true, unlimited: true, balance_eur: 0, tokens_in_period: 0, current_markup_percent: 0 };
    }

    try {
        const { data, error } = await client.rpc('check_project_balance', {
            p_project_id: projectId,
            p_estimated_cost_eur: estimatedCostEur
        });

        if (error) throw error;

        if (!data || data.length === 0) {
            // Project not found, allow by default (will be logged)
            log.warn({ event: 'billing_project_not_found', projectId }, 'Project not found in balance check');
            return { allowed: true, unlimited: true, balance_eur: 0, tokens_in_period: 0, current_markup_percent: 0 };
        }

        const result = data[0];
        return {
            allowed: result.allowed,
            reason: result.reason,
            balance_eur: parseFloat(result.balance_eur) || 0,
            unlimited: result.unlimited,
            tokens_in_period: parseInt(result.tokens_in_period) || 0,
            current_tier_name: result.current_tier_name,
            current_markup_percent: parseFloat(result.current_markup_percent) || 0
        };
    } catch (error) {
        log.warn({ event: 'billing_check_balance_error', reason: error.message }, 'Error checking balance');
        // On error, allow by default to avoid blocking legitimate requests
        return { allowed: true, unlimited: true, balance_eur: 0, tokens_in_period: 0, current_markup_percent: 0, error: error.message };
    }
}

/**
 * Debit project balance atomically
 * @param {string} projectId - Project ID
 * @param {number} amountEur - Amount to debit in EUR
 * @param {string} llmRequestId - Optional LLM request ID for audit
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, new_balance?: number, reason?: string}>}
 */
async function debitProjectBalance(projectId, amountEur, llmRequestId = null, description = null) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return { success: true, new_balance: 0 };
    }

    try {
        const { data, error } = await client.rpc('debit_project_balance', {
            p_project_id: projectId,
            p_amount_eur: amountEur,
            p_llm_request_id: llmRequestId,
            p_description: description
        });

        if (error) throw error;

        const result = data?.[0] || { success: false, reason: 'No result' };
        return {
            success: result.success,
            new_balance: parseFloat(result.new_balance) || 0,
            reason: result.reason
        };
    } catch (error) {
        log.warn({ event: 'billing_debit_error', reason: error.message }, 'Error debiting balance');
        return { success: false, reason: error.message };
    }
}

/**
 * Credit project balance (add funds)
 * @param {string} projectId - Project ID
 * @param {number} amountEur - Amount to add in EUR
 * @param {string} performedBy - User ID who performed the action
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, new_balance?: number, reason?: string}>}
 */
async function creditProjectBalance(projectId, amountEur, performedBy = null, description = null) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return { success: false, reason: 'Database not configured' };
    }

    try {
        const { data, error } = await client.rpc('credit_project_balance', {
            p_project_id: projectId,
            p_amount_eur: amountEur,
            p_performed_by: performedBy,
            p_description: description
        });

        if (error) throw error;

        const result = data?.[0] || { success: false, reason: 'No result' };
        return {
            success: result.success,
            new_balance: parseFloat(result.new_balance) || 0,
            reason: result.reason
        };
    } catch (error) {
        log.warn({ event: 'billing_credit_error', reason: error.message }, 'Error crediting balance');
        return { success: false, reason: error.message };
    }
}

/**
 * Set project unlimited mode
 * @param {string} projectId - Project ID
 * @param {boolean} unlimited - Whether to enable unlimited mode
 * @param {string} performedBy - User ID who performed the action
 * @returns {Promise<boolean>}
 */
async function setProjectUnlimited(projectId, unlimited, performedBy = null) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return false;
    }

    try {
        const { data, error } = await client.rpc('set_project_unlimited', {
            p_project_id: projectId,
            p_unlimited: unlimited,
            p_performed_by: performedBy
        });

        if (error) throw error;
        return data === true;
    } catch (error) {
        log.error({ event: 'billing_set_unlimited_error', reason: error.message }, 'Error setting unlimited');
        return false;
    }
}

// ============================================
// COST CALCULATION
// ============================================

/**
 * Get current exchange rate (from service or fallback)
 * @returns {Promise<{rate: number, source: string, auto: boolean}>}
 */
async function getExchangeRate() {
    const service = getExchangeRateService();
    if (service) {
        try {
            return await service.getUsdToEurRate();
        } catch (e) {
            log.warn({ event: 'billing_exchange_rate_error', reason: e.message }, 'Exchange rate service error');
        }
    }
    // Fallback
    return { rate: 0.92, source: 'default', auto: false };
}

/**
 * Calculate billable cost with tier-based markup
 * Uses automatic exchange rate when enabled
 * @param {string} projectId - Project ID
 * @param {number} providerCostUsd - Provider cost in USD
 * @param {number} totalTokens - Total tokens used
 * @returns {Promise<{provider_cost_eur: number, billable_cost_eur: number, markup_percent: number, tier_id?: string, period_key: string, usd_to_eur_rate: number, rate_source: string}>}
 */
async function calculateBillableCost(projectId, providerCostUsd, totalTokens) {
    // Get exchange rate from service
    const exchangeRateResult = await getExchangeRate();
    const rate = exchangeRateResult.rate;
    
    const client = getAdminClient() || getClient();
    if (!client) {
        // Fallback: no markup, just use exchange rate
        const providerEur = providerCostUsd * rate;
        return {
            provider_cost_eur: providerEur,
            billable_cost_eur: providerEur,
            markup_percent: 0,
            tier_id: null,
            period_key: getCurrentPeriodKey(),
            usd_to_eur_rate: rate,
            rate_source: exchangeRateResult.source
        };
    }

    try {
        // Pass the exchange rate to the PostgreSQL function
        const { data, error } = await client.rpc('calculate_billable_cost', {
            p_project_id: projectId,
            p_provider_cost_usd: providerCostUsd,
            p_total_tokens: totalTokens,
            p_usd_to_eur_rate: rate
        });

        if (error) throw error;

        const result = data?.[0] || {};
        return {
            provider_cost_eur: parseFloat(result.provider_cost_eur) || 0,
            billable_cost_eur: parseFloat(result.billable_cost_eur) || 0,
            markup_percent: parseFloat(result.markup_percent) || 0,
            tier_id: result.tier_id,
            period_key: result.period_key || getCurrentPeriodKey(),
            usd_to_eur_rate: parseFloat(result.usd_to_eur_rate) || rate,
            rate_source: exchangeRateResult.source
        };
    } catch (error) {
        log.warn({ event: 'billing_billable_cost_error', reason: error.message }, 'Error calculating billable cost');
        const providerEur = providerCostUsd * rate;
        return {
            provider_cost_eur: providerEur,
            billable_cost_eur: providerEur,
            markup_percent: 0,
            tier_id: null,
            period_key: getCurrentPeriodKey(),
            usd_to_eur_rate: rate,
            rate_source: exchangeRateResult.source
        };
    }
}

/**
 * Calculate cost and record all billing data
 * Complete flow: calculate + debit + update period usage
 * @param {object} options
 * @returns {Promise<{billable_cost_eur: number, provider_cost_eur: number, markup_percent: number, tier_id?: string, period_key: string}>}
 */
async function calculateAndRecordCost({
    projectId,
    providerCostUsd,
    tokens,
    inputTokens,
    outputTokens,
    model,
    provider,
    context,
    requestId
}) {
    // Calculate billable cost
    const costResult = await calculateBillableCost(projectId, providerCostUsd, tokens);
    
    // Debit balance (atomic)
    const debitResult = await debitProjectBalance(
        projectId, 
        costResult.billable_cost_eur,
        requestId,
        `AI usage: ${provider}/${model} - ${context || 'request'}`
    );
    
    if (!debitResult.success && debitResult.reason !== 'Insufficient balance') {
        log.warn({ event: 'billing_debit_failed_nonblocking', reason: debitResult.reason }, 'Debit failed (non-blocking)');
    }
    
    // Update period usage
    await updatePeriodUsage(
        projectId,
        inputTokens,
        outputTokens,
        costResult.provider_cost_eur,
        costResult.billable_cost_eur,
        costResult.period_key
    );
    
    return {
        billable_cost_eur: costResult.billable_cost_eur,
        provider_cost_eur: costResult.provider_cost_eur,
        markup_percent: costResult.markup_percent,
        tier_id: costResult.tier_id,
        period_key: costResult.period_key
    };
}

/**
 * Update period usage aggregates
 * @param {string} projectId - Project ID
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @param {number} providerCostEur - Provider cost in EUR
 * @param {number} billableCostEur - Billable cost in EUR
 * @param {string} periodKey - Period key (optional)
 * @returns {Promise<boolean>}
 */
async function updatePeriodUsage(projectId, inputTokens, outputTokens, providerCostEur, billableCostEur, periodKey = null) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return false;
    }

    try {
        const { data, error } = await client.rpc('update_period_usage', {
            p_project_id: projectId,
            p_input_tokens: inputTokens,
            p_output_tokens: outputTokens,
            p_provider_cost_eur: providerCostEur,
            p_billable_cost_eur: billableCostEur,
            p_period_key: periodKey
        });

        if (error) throw error;
        return data === true;
    } catch (error) {
        log.error({ event: 'billing_update_period_usage_error', reason: error.message }, 'Error updating period usage');
        return false;
    }
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Notify when balance is insufficient
 * @param {string} projectId - Project ID
 * @param {string} reason - Rejection reason
 */
async function notifyBalanceInsufficient(projectId, reason) {
    try {
        // Get project admins
        const client = getAdminClient() || getClient();
        if (!client) return;

        const { data: members } = await client
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId)
            .in('role', ['owner', 'admin']);

        if (!members || members.length === 0) return;

        // Create notification for each admin
        for (const member of members) {
            await notifications.createNotification({
                userId: member.user_id,
                projectId,
                type: 'system',
                title: 'AI Request Blocked',
                body: `An AI request was blocked due to insufficient balance. ${reason}`,
                referenceType: 'billing',
                referenceId: projectId
            });
        }
    } catch (error) {
        log.warn({ event: 'billing_insufficient_notification_error', reason: error.message }, 'Error sending insufficient balance notification');
    }
}

/**
 * Check if low balance notification should be sent and send it
 * @param {string} projectId - Project ID
 * @param {number} thresholdPercent - Threshold percentage (default 20)
 */
async function checkAndNotifyLowBalance(projectId, thresholdPercent = 20) {
    const client = getAdminClient() || getClient();
    if (!client) return;

    try {
        // Check if should notify
        const { data: shouldNotify, error: checkError } = await client.rpc('should_notify_low_balance', {
            p_project_id: projectId,
            p_threshold_percent: thresholdPercent
        });

        if (checkError || !shouldNotify) return;

        // Get project admins
        const { data: members } = await client
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId)
            .in('role', ['owner', 'admin']);

        if (!members || members.length === 0) return;

        // Get balance info
        const { data: project } = await client
            .from('projects')
            .select('name, balance_eur')
            .eq('id', projectId)
            .single();

        // Create notification for each admin
        for (const member of members) {
            await notifications.createNotification({
                userId: member.user_id,
                projectId,
                type: 'system',
                title: 'Low Balance Warning',
                body: `Project "${project?.name}" balance is low (€${project?.balance_eur?.toFixed(2)}). Add funds to continue using AI features.`,
                referenceType: 'billing',
                referenceId: projectId
            });
        }

        // Mark as notified
        await client.rpc('mark_low_balance_notified', { p_project_id: projectId });
    } catch (error) {
        log.warn({ event: 'billing_low_balance_notification_error', reason: error.message }, 'Error checking/sending low balance notification');
    }
}

// ============================================
// BILLING SUMMARIES
// ============================================

/**
 * Get billing summary for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<object>}
 */
async function getProjectBillingSummary(projectId) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return null;
    }

    try {
        const { data, error } = await client.rpc('get_project_billing_summary', {
            p_project_id: projectId
        });

        if (error) throw error;

        const result = data?.[0];
        if (!result) return null;

        return {
            balance_eur: parseFloat(result.balance_eur) || 0,
            unlimited_balance: result.unlimited_balance,
            period_key: result.period_key,
            tokens_this_period: parseInt(result.tokens_this_period) || 0,
            provider_cost_this_period: parseFloat(result.provider_cost_this_period) || 0,
            billable_cost_this_period: parseFloat(result.billable_cost_this_period) || 0,
            requests_this_period: parseInt(result.requests_this_period) || 0,
            current_tier_name: result.current_tier_name,
            current_markup_percent: parseFloat(result.current_markup_percent) || 0,
            balance_percent_used: parseFloat(result.balance_percent_used) || 0
        };
    } catch (error) {
        log.error({ event: 'billing_summary_error', reason: error.message }, 'Error getting billing summary');
        return null;
    }
}

/**
 * Get billing overview for all projects (admin)
 * @returns {Promise<Array>}
 */
async function getAllProjectsBilling() {
    const client = getAdminClient() || getClient();
    if (!client) {
        return [];
    }

    try {
        const { data, error } = await client.rpc('get_all_projects_billing');

        if (error) throw error;

        return (data || []).map(row => ({
            project_id: row.project_id,
            project_name: row.project_name,
            balance_eur: parseFloat(row.balance_eur) || 0,
            unlimited_balance: row.unlimited_balance,
            tokens_this_period: parseInt(row.tokens_this_period) || 0,
            billable_cost_this_period: parseFloat(row.billable_cost_this_period) || 0,
            is_blocked: row.is_blocked,
            current_tier_name: row.current_tier_name
        }));
    } catch (error) {
        log.warn({ event: 'billing_all_projects_error', reason: error.message }, 'Error getting all projects billing');
        return [];
    }
}

/**
 * Get balance transactions for a project
 * @param {string} projectId - Project ID
 * @param {number} limit - Max transactions to return
 * @returns {Promise<Array>}
 */
async function getBalanceTransactions(projectId, limit = 50) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return [];
    }

    try {
        const { data, error } = await client
            .from('balance_transactions')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        log.warn({ event: 'billing_balance_transactions_error', reason: error.message }, 'Error getting balance transactions');
        return [];
    }
}

// ============================================
// PRICING CONFIGURATION
// ============================================

/**
 * Get global pricing config
 * @returns {Promise<object|null>}
 */
async function getGlobalPricingConfig() {
    const client = getAdminClient() || getClient();
    if (!client) {
        return null;
    }

    try {
        const { data: config, error } = await client
            .from('pricing_configs')
            .select('*, pricing_tiers(*)')
            .eq('scope', 'global')
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return config;
    } catch (error) {
        log.warn({ event: 'billing_global_pricing_error', reason: error.message }, 'Error getting global pricing config');
        return null;
    }
}

/**
 * Set global pricing config
 * @param {object} config - Config object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setGlobalPricingConfig({ fixedMarkupPercent, periodType, usdToEurRate, updatedBy }) {
    const client = getAdminClient();
    if (!client) {
        return { success: false, error: 'Admin client not configured' };
    }

    try {
        const { error } = await client
            .from('pricing_configs')
            .update({
                fixed_markup_percent: fixedMarkupPercent,
                period_type: periodType,
                usd_to_eur_rate: usdToEurRate,
                updated_by: updatedBy,
                updated_at: new Date().toISOString()
            })
            .eq('scope', 'global');

        if (error) throw error;
        return { success: true };
    } catch (error) {
        log.warn({ event: 'billing_set_global_pricing_error', reason: error.message }, 'Error setting global pricing config');
        return { success: false, error: error.message };
    }
}

/**
 * Get project pricing override
 * @param {string} projectId - Project ID
 * @returns {Promise<object|null>}
 */
async function getProjectPricingOverride(projectId) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return null;
    }

    try {
        const { data: config, error } = await client
            .from('pricing_configs')
            .select('*, pricing_tiers(*)')
            .eq('scope', 'project')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return config;
    } catch (error) {
        log.warn({ event: 'billing_project_pricing_error', reason: error.message }, 'Error getting project pricing override');
        return null;
    }
}

/**
 * Set project pricing override
 * @param {string} projectId - Project ID
 * @param {object} config - Config object
 * @returns {Promise<{success: boolean, config_id?: string, error?: string}>}
 */
async function setProjectPricingOverride(projectId, { fixedMarkupPercent, periodType, usdToEurRate, createdBy }) {
    const client = getAdminClient();
    if (!client) {
        return { success: false, error: 'Admin client not configured' };
    }

    try {
        const { data, error } = await client
            .from('pricing_configs')
            .upsert({
                scope: 'project',
                project_id: projectId,
                fixed_markup_percent: fixedMarkupPercent,
                period_type: periodType || 'monthly',
                usd_to_eur_rate: usdToEurRate || 0.92,
                is_active: true,
                created_by: createdBy,
                updated_by: createdBy,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id',
                ignoreDuplicates: false
            })
            .select('id')
            .single();

        if (error) throw error;
        return { success: true, config_id: data?.id };
    } catch (error) {
        log.warn({ event: 'billing_set_project_pricing_error', reason: error.message }, 'Error setting project pricing override');
        return { success: false, error: error.message };
    }
}

/**
 * Delete project pricing override (revert to global)
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>}
 */
async function deleteProjectPricingOverride(projectId) {
    const client = getAdminClient();
    if (!client) {
        return false;
    }

    try {
        const { error } = await client
            .from('pricing_configs')
            .delete()
            .eq('scope', 'project')
            .eq('project_id', projectId);

        if (error) throw error;
        return true;
    } catch (error) {
        log.warn({ event: 'billing_delete_project_pricing_error', reason: error.message }, 'Error deleting project pricing override');
        return false;
    }
}

// ============================================
// PRICING TIERS
// ============================================

/**
 * Get pricing tiers for a config
 * @param {string} configId - Pricing config ID
 * @returns {Promise<Array>}
 */
async function getPricingTiers(configId) {
    const client = getAdminClient() || getClient();
    if (!client) {
        return [];
    }

    try {
        const { data, error } = await client
            .from('pricing_tiers')
            .select('*')
            .eq('pricing_config_id', configId)
            .order('tier_order', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        log.warn({ event: 'billing_pricing_tiers_error', reason: error.message }, 'Error getting pricing tiers');
        return [];
    }
}

/**
 * Set pricing tiers for a config (replace all)
 * @param {string} configId - Pricing config ID
 * @param {Array} tiers - Array of tier objects
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setPricingTiers(configId, tiers) {
    const client = getAdminClient();
    if (!client) {
        return { success: false, error: 'Admin client not configured' };
    }

    try {
        // Delete existing tiers
        await client
            .from('pricing_tiers')
            .delete()
            .eq('pricing_config_id', configId);

        // Insert new tiers
        if (tiers && tiers.length > 0) {
            const tiersToInsert = tiers.map((tier, index) => ({
                pricing_config_id: configId,
                token_limit: tier.token_limit,
                markup_percent: tier.markup_percent,
                name: tier.name,
                tier_order: index
            }));

            const { error } = await client
                .from('pricing_tiers')
                .insert(tiersToInsert);

            if (error) throw error;
        }

        return { success: true };
    } catch (error) {
        log.warn({ event: 'billing_set_pricing_tiers_error', reason: error.message }, 'Error setting pricing tiers');
        return { success: false, error: error.message };
    }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Get current period key
 * @param {string} periodType - 'monthly' or 'weekly'
 * @returns {string}
 */
function getCurrentPeriodKey(periodType = 'monthly') {
    const now = new Date();
    if (periodType === 'weekly') {
        // ISO week format
        const year = now.getFullYear();
        const week = getISOWeek(now);
        return `${year}-${String(week).padStart(2, '0')}`;
    }
    // Monthly format
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get ISO week number
 * @param {Date} date
 * @returns {number}
 */
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
    // Balance operations
    checkProjectBalance,
    debitProjectBalance,
    creditProjectBalance,
    setProjectUnlimited,
    
    // Cost calculation
    calculateBillableCost,
    calculateAndRecordCost,
    updatePeriodUsage,
    
    // Notifications
    notifyBalanceInsufficient,
    checkAndNotifyLowBalance,
    
    // Summaries
    getProjectBillingSummary,
    getAllProjectsBilling,
    getBalanceTransactions,
    
    // Pricing configuration
    getGlobalPricingConfig,
    setGlobalPricingConfig,
    getProjectPricingOverride,
    setProjectPricingOverride,
    deleteProjectPricingOverride,
    
    // Pricing tiers
    getPricingTiers,
    setPricingTiers,
    
    // Exchange rate
    getExchangeRate,
    getExchangeRateConfig: async () => {
        const service = getExchangeRateService();
        return service ? await service.getExchangeRateConfig() : null;
    },
    setExchangeRateMode: async (auto, manualRate) => {
        const service = getExchangeRateService();
        return service ? await service.setExchangeRateMode(auto, manualRate) : { success: false, error: 'Service not available' };
    },
    refreshExchangeRate: async () => {
        const service = getExchangeRateService();
        return service ? await service.refreshExchangeRate() : null;
    },
    
    // Utilities
    getCurrentPeriodKey
};
