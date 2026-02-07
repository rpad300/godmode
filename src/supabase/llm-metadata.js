/**
 * LLM Model Metadata - Supabase Integration
 * Dynamic storage and retrieval of LLM model information
 * 
 * NOTE: Uses admin client (service_role) because this module handles server-side
 * operations for LLM model metadata sync and cost calculations without user context.
 */

const { getAdminClient } = require('./client');

/**
 * Get model metadata from database
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
        console.warn('[LLMMetadata] Error getting model metadata:', error.message);
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
        console.warn('[LLMMetadata] Error getting models for provider:', error.message);
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
 * Calculate cost from database pricing
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
        console.warn('[LLMMetadata] Error calculating cost:', error.message);
        return 0;
    }
}

/**
 * Upsert model metadata (for sync)
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
        console.warn('[LLMMetadata] Error upserting metadata:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Bulk upsert models
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
        console.warn('[LLMMetadata] Error getting sync status:', error.message);
        return [];
    }
}

/**
 * Mark models as inactive for a provider (before sync)
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
        console.warn('[LLMMetadata] Error marking models inactive:', error.message);
    }
}

/**
 * Get all pricing data (for cost calculation fallback)
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
        console.warn('[LLMMetadata] Error getting pricing:', error.message);
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
