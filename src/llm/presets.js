/**
 * LLM Configuration Presets
 * Pre-defined configurations for different use cases
 */

// Preset definitions
const PRESETS = {
    economy: {
        id: 'economy',
        name: 'Economy',
        description: 'Use local Ollama models for zero cost. Best for development and testing.',
        icon: '💰',
        costTier: 'free',
        config: {
            text: { provider: 'ollama', model: 'llama3' },
            vision: { provider: 'ollama', model: 'llava' },
            embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        requirements: {
            ollama: true,
            apiKeys: []
        },
        pros: ['Zero cost', 'Privacy (local)', 'No rate limits'],
        cons: ['Requires local GPU', 'Slower than cloud', 'Limited context windows']
    },
    
    balanced: {
        id: 'balanced',
        name: 'Balanced',
        description: 'Mix of cloud and local for cost-effective quality. Good for production.',
        icon: '⚖️',
        costTier: 'low',
        config: {
            text: { provider: 'openai', model: 'gpt-4o-mini' },
            vision: { provider: 'google', model: 'gemini-1.5-flash' },
            embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        requirements: {
            ollama: true,
            apiKeys: ['openai', 'google']
        },
        estimatedCostPerDoc: 0.01, // $0.01 per document
        pros: ['Good quality', 'Low cost', 'Fast responses'],
        cons: ['Requires API keys', 'Rate limits apply']
    },
    
    quality: {
        id: 'quality',
        name: 'Quality',
        description: 'Best models for maximum accuracy. Recommended for critical tasks.',
        icon: '🏆',
        costTier: 'medium',
        config: {
            text: { provider: 'openai', model: 'gpt-4o' },
            vision: { provider: 'google', model: 'gemini-1.5-pro' },
            embeddings: { provider: 'openai', model: 'text-embedding-3-large' }
        },
        requirements: {
            ollama: false,
            apiKeys: ['openai', 'google']
        },
        estimatedCostPerDoc: 0.05, // $0.05 per document
        pros: ['Best accuracy', 'Large context windows', 'Best reasoning'],
        cons: ['Higher cost', 'Rate limits']
    },
    
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic Focus',
        description: 'Use Claude for text tasks. Great for analysis and summarization.',
        icon: '🧠',
        costTier: 'medium',
        config: {
            text: { provider: 'claude', model: 'claude-sonnet-4-20250514' },
            vision: { provider: 'claude', model: 'claude-sonnet-4-20250514' },
            embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        requirements: {
            ollama: true,
            apiKeys: ['anthropic']
        },
        estimatedCostPerDoc: 0.03,
        pros: ['Excellent reasoning', 'Long context', 'Good at following instructions'],
        cons: ['No embeddings API', 'Requires Ollama for embeddings']
    },
    
    google: {
        id: 'google',
        name: 'Google Focus',
        description: 'Use Gemini for all tasks. Largest context window available.',
        icon: '🌐',
        costTier: 'low',
        config: {
            text: { provider: 'google', model: 'gemini-1.5-pro' },
            vision: { provider: 'google', model: 'gemini-1.5-pro' },
            embeddings: { provider: 'google', model: 'text-embedding-004' }
        },
        requirements: {
            ollama: false,
            apiKeys: ['google']
        },
        estimatedCostPerDoc: 0.02,
        pros: ['2M token context', 'Good multimodal', 'Single API key'],
        cons: ['Variable quality', 'Safety filters can be restrictive']
    },
    
    xai: {
        id: 'xai',
        name: 'xAI / Grok',
        description: 'Use Grok models for text and vision. Latest AI technology.',
        icon: '🚀',
        costTier: 'medium',
        config: {
            text: { provider: 'grok', model: 'grok-3-fast' },
            vision: { provider: 'grok', model: 'grok-2-vision-1212' },
            embeddings: { provider: 'grok', model: 'grok-embedding-v1' }
        },
        requirements: {
            ollama: false,
            apiKeys: ['grok']
        },
        estimatedCostPerDoc: 0.04,
        pros: ['2M token context', 'Latest technology', 'Good embeddings'],
        cons: ['Newer service', 'Less documentation']
    },
    
    privacy: {
        id: 'privacy',
        name: 'Privacy First',
        description: 'All processing done locally. No data leaves your machine.',
        icon: '🔒',
        costTier: 'free',
        config: {
            text: { provider: 'ollama', model: 'qwen3:30b' },
            vision: { provider: 'ollama', model: 'qwen3-vl:8b' },
            embeddings: { provider: 'ollama', model: 'mxbai-embed-large' }
        },
        requirements: {
            ollama: true,
            apiKeys: []
        },
        pros: ['Complete privacy', 'No data sharing', 'GDPR compliant'],
        cons: ['Requires powerful hardware', 'Slower processing']
    },
    
    fast: {
        id: 'fast',
        name: 'Speed Optimized',
        description: 'Fastest models for high throughput. Trade accuracy for speed.',
        icon: '⚡',
        costTier: 'low',
        config: {
            text: { provider: 'openai', model: 'gpt-4o-mini' },
            vision: { provider: 'google', model: 'gemini-1.5-flash-8b' },
            embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        requirements: {
            ollama: true,
            apiKeys: ['openai', 'google']
        },
        estimatedCostPerDoc: 0.005,
        pros: ['Very fast', 'Low cost', 'Good for bulk processing'],
        cons: ['Lower accuracy', 'Smaller context windows']
    }
};

// Cost tiers for UI display
const COST_TIERS = {
    free: { label: 'Free', color: '#10b981', icon: '💰' },
    low: { label: 'Low Cost', color: '#3b82f6', icon: '💵' },
    medium: { label: 'Medium Cost', color: '#f59e0b', icon: '💳' },
    high: { label: 'High Cost', color: '#ef4444', icon: '💎' }
};

/**
 * Get all preset definitions
 */
function getAllPresets() {
    return Object.values(PRESETS);
}

/**
 * Get a specific preset by ID
 */
function getPreset(presetId) {
    return PRESETS[presetId] || null;
}

/**
 * Get preset configuration only
 */
function getPresetConfig(presetId) {
    const preset = PRESETS[presetId];
    return preset ? preset.config : null;
}

/**
 * Check if a preset's requirements are met
 */
function checkPresetRequirements(presetId, availableProviders) {
    const preset = PRESETS[presetId];
    if (!preset) return { met: false, missing: ['Preset not found'] };
    
    const missing = [];
    
    // Check Ollama requirement
    if (preset.requirements.ollama && !availableProviders.ollama) {
        missing.push('Ollama');
    }
    
    // Check API key requirements
    for (const provider of preset.requirements.apiKeys) {
        if (!availableProviders[provider]?.isConfigured) {
            missing.push(`${provider} API key`);
        }
    }
    
    return {
        met: missing.length === 0,
        missing
    };
}

/**
 * Get recommended presets based on available providers
 */
function getRecommendedPresets(availableProviders) {
    const recommendations = [];
    
    for (const preset of Object.values(PRESETS)) {
        const { met } = checkPresetRequirements(preset.id, availableProviders);
        if (met) {
            recommendations.push(preset);
        }
    }
    
    // Sort by cost tier (free first)
    const tierOrder = { free: 0, low: 1, medium: 2, high: 3 };
    recommendations.sort((a, b) => tierOrder[a.costTier] - tierOrder[b.costTier]);
    
    return recommendations;
}

/**
 * Create a custom preset
 */
function createCustomPreset(name, description, config) {
    return {
        id: 'custom',
        name,
        description,
        icon: '🔧',
        costTier: 'custom',
        config,
        requirements: {
            ollama: config.text?.provider === 'ollama' || 
                    config.vision?.provider === 'ollama' || 
                    config.embeddings?.provider === 'ollama',
            apiKeys: [
                ...new Set([
                    config.text?.provider,
                    config.vision?.provider,
                    config.embeddings?.provider
                ].filter(p => p && p !== 'ollama'))
            ]
        }
    };
}

module.exports = {
    PRESETS,
    COST_TIERS,
    getAllPresets,
    getPreset,
    getPresetConfig,
    checkPresetRequirements,
    getRecommendedPresets,
    createCustomPreset
};
