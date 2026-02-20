/**
 * Purpose:
 *   Dynamic storage, retrieval, and synchronization of LLM model metadata
 *   (capabilities, pricing, context limits) used for cost calculation and
 *   model selection across the platform.
 *
 * Responsibilities:
 *   - Read model metadata from `llm_model_metadata` by provider + model ID
 *   - Group models by type (text, vision, embedding) for UI selectors
 *   - Calculate per-request cost via the `calculate_llm_cost` RPC
 *   - Upsert model metadata (single and bulk) for provider sync pipelines
 *   - Track sync status per provider via the `llm_models_by_provider` view
 *   - Mark API-synced models inactive before re-sync to detect removals
 *   - Expose all pricing data as a flat lookup for local cost fallback
 *
 * Key dependencies:
 *   - ./client (getAdminClient): Supabase admin client (service_role)
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - `upsertModelMetadata` / `bulkUpsertModels` write to `llm_model_metadata`
 *   - `markProviderModelsInactive` sets `is_active = false` for API-sourced models
 *
 * Notes:
 *   - Uses admin client (service_role) because model metadata sync runs
 *     server-side without an authenticated user context.
 *   - `getModelMetadata` falls back to a prefix ilike match for versioned
 *     model IDs (e.g., "gpt-4o-2024-05-13" matching "gpt-4o").
 *   - `bulkUpsertModels` processes models sequentially (not in parallel)
 *     to avoid overwhelming the DB during large syncs.
 *   - `getAllPricing` returns a model_id-keyed lookup; if two providers share
 *     the same model_id, only the last one survives. Assumption: model IDs
 *     are unique across providers in practice.
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'llm-metadata' });

/**
 * Get model metadata from the `llm_model_metadata` table.
 * First attempts an exact match on (provider, model_id); on failure, falls
 * back to a prefix ilike match to handle versioned model IDs (e.g.,
 * "gpt-4o-2024-05-13" matching a row for "gpt-4o").
 * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
 * @param {string} modelId - Model identifier
 * @returns {Promise<object|null>} Full metadata row or null
 */
async function getModelMetadata(provider, modelId) {
    const supabase = getAdminClient();
    if (!supabase) return null;
    
    try {
        const { data, error } = await supabase
            .from('llm_model_metadata')
            .select('*')
            .eq('provider', provider)
            .eq('model_id', modelId)
            .eq('is_active', true)
            .single();
        
        if (error) {
            // Try partial match (for versioned models)
            const { data: partialData } = await supabase
                .from('llm_model_metadata')
                .select('*')
                .eq('provider', provider)
                .ilike('model_id', `${modelId}%`)
                .eq('is_active', true)
                .limit(1)
                .single();
            
            return partialData || null;
        }
        
        return data;
    } catch (error) {
        log.warn({ event: 'llm_metadata_get_error', reason: error.message }, 'Error getting model metadata');
        return null;
    }
}

/**
 * Get all models for a provider
 */
async function getModelsForProvider(provider) {
    const supabase = getAdminClient();
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
            .from('llm_model_metadata')
            .select('*')
            .eq('provider', provider)
            .eq('is_active', true)
            .order('model_id');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        log.warn({ event: 'llm_metadata_models_error', reason: error.message }, 'Error getting models for provider');
        return [];
    }
}

/**
 * Get all models grouped by type
 */
async function getModelsGroupedByType(provider) {
    const models = await getModelsForProvider(provider);
    
    return {
        textModels: models.filter(m => m.model_type === 'text' && !m.supports_embeddings),
        visionModels: models.filter(m => m.supports_vision),
        embeddingModels: models.filter(m => m.model_type === 'embedding' || m.supports_embeddings)
    };
}

/**
 * Calculate the USD cost for a request using DB-stored per-model pricing.
 * Delegates to the `calculate_llm_cost` RPC which looks up the model's
 * price_input/price_output rates and multiplies by token counts.
 * Returns 0 on any error (fail-safe for cost tracking, not billing).
 * @param {string} provider
 * @param {string} modelId
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {Promise<number>} Cost in USD
 */
async function calculateCost(provider, modelId, inputTokens, outputTokens) {
    const supabase = getAdminClient();
    if (!supabase) return 0;
    
    try {
        const { data, error } = await supabase
            .rpc('calculate_llm_cost', {
                p_provider: provider,
                p_model_id: modelId,
                p_input_tokens: inputTokens || 0,
                p_output_tokens: outputTokens || 0
            });
        
        if (error) throw error;
        return data || 0;
    } catch (error) {
        log.warn({ event: 'llm_metadata_cost_error', reason: error.message }, 'Error calculating cost');
        return 0;
    }
}

/**
 * Upsert a single model's metadata via the `upsert_llm_model_metadata` RPC.
 * Used by provider sync pipelines to keep the metadata table current.
 * @param {object} metadata - Model metadata fields (provider, modelId, displayName, pricing, capabilities, etc.)
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function upsertModelMetadata(metadata) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    try {
        const { data, error } = await supabase
            .rpc('upsert_llm_model_metadata', {
                p_provider: metadata.provider,
                p_model_id: metadata.modelId,
                p_display_name: metadata.displayName,
                p_context_tokens: metadata.contextTokens,
                p_max_output_tokens: metadata.maxOutputTokens,
                p_supports_vision: metadata.supportsVision || false,
                p_supports_json_mode: metadata.supportsJsonMode || false,
                p_supports_function_calling: metadata.supportsFunctionCalling || false,
                p_supports_embeddings: metadata.supportsEmbeddings || false,
                p_price_input: metadata.priceInput || 0,
                p_price_output: metadata.priceOutput || 0,
                p_model_type: metadata.modelType || 'text',
                p_tier: metadata.tier || 'standard',
                p_description: metadata.description,
                p_raw_metadata: metadata.rawMetadata
            });
        
        if (error) throw error;
        return { success: true, id: data };
    } catch (error) {
        log.warn({ event: 'llm_metadata_upsert_error', reason: error.message }, 'Error upserting metadata');
        return { success: false, error: error.message };
    }
}

/**
 * Bulk upsert models sequentially (not parallel) to avoid overwhelming the DB.
 * Returns aggregate success/failure counts and per-model error details.
 */
async function bulkUpsertModels(models) {
    const results = { success: 0, failed: 0, errors: [] };
    
    for (const model of models) {
        const result = await upsertModelMetadata(model);
        if (result.success) {
            results.success++;
        } else {
            results.failed++;
            results.errors.push({ modelId: model.modelId, error: result.error });
        }
    }
    
    return results;
}

/**
 * Get sync status for all providers
 */
async function getSyncStatus() {
    const supabase = getAdminClient();
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
            .from('llm_models_by_provider')
            .select('*');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        log.warn({ event: 'llm_metadata_sync_status_error', reason: error.message }, 'Error getting sync status');
        return [];
    }
}

/**
 * Mark all API-synced models as inactive for a provider before re-sync.
 * Only affects rows with source='api'; manually-added models are preserved.
 * Called at the start of a sync cycle so that models removed by the provider
 * end up with is_active=false after the upsert pass.
 */
async function markProviderModelsInactive(provider) {
    const supabase = getAdminClient();
    if (!supabase) return;
    
    try {
        await supabase
            .from('llm_model_metadata')
            .update({ is_active: false })
            .eq('provider', provider)
            .eq('source', 'api'); // Only mark API-synced models
    } catch (error) {
        log.warn({ event: 'llm_metadata_mark_inactive_error', reason: error.message }, 'Error marking models inactive');
    }
}

/**
 * Get all active model pricing as a flat lookup object keyed by model_id.
 * Used as a local fallback when the `calculate_llm_cost` RPC is unavailable.
 * Caveat: if two providers share the same model_id, only the last one wins.
 * @returns {Promise<Object<string, {priceInput: number, priceOutput: number, contextTokens: number, maxOutputTokens: number, supportsVision: boolean, supportsJsonMode: boolean}>>}
 */
async function getAllPricing() {
    const supabase = getAdminClient();
    if (!supabase) return {};
    
    try {
        const { data, error } = await supabase
            .from('llm_model_metadata')
            .select('provider, model_id, price_input, price_output, context_tokens, max_output_tokens, supports_vision, supports_json_mode')
            .eq('is_active', true);
        
        if (error) throw error;
        
        // Convert to lookup object
        const pricing = {};
        for (const model of data || []) {
            const key = model.model_id;
            pricing[key] = {
                priceInput: parseFloat(model.price_input) || 0,
                priceOutput: parseFloat(model.price_output) || 0,
                contextTokens: model.context_tokens,
                maxOutputTokens: model.max_output_tokens,
                supportsVision: model.supports_vision,
                supportsJsonMode: model.supports_json_mode
            };
        }
        
        return pricing;
    } catch (error) {
        log.warn({ event: 'llm_metadata_pricing_error', reason: error.message }, 'Error getting pricing');
        return {};
    }
}

module.exports = {
    getModelMetadata,
    getModelsForProvider,
    getModelsGroupedByType,
    calculateCost,
    upsertModelMetadata,
    bulkUpsertModels,
    getSyncStatus,
    markProviderModelsInactive,
    getAllPricing
};
