-- ============================================================================
-- Migration 033: LLM Model Metadata
-- Dynamic storage for LLM model information (context, pricing, capabilities)
-- ============================================================================

-- Table to store model metadata dynamically
CREATE TABLE IF NOT EXISTS llm_model_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Model identification
    provider TEXT NOT NULL,                    -- openai, anthropic, google, grok, deepseek, etc.
    model_id TEXT NOT NULL,                    -- gpt-4.1, claude-3-5-sonnet, etc.
    display_name TEXT,                         -- Human-friendly name
    
    -- Capabilities
    context_tokens INTEGER,                    -- Max context window
    max_output_tokens INTEGER,                 -- Max output tokens
    supports_vision BOOLEAN DEFAULT false,
    supports_json_mode BOOLEAN DEFAULT false,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_streaming BOOLEAN DEFAULT true,
    supports_embeddings BOOLEAN DEFAULT false,
    
    -- Pricing (per 1M tokens in USD)
    price_input NUMERIC(10, 6) DEFAULT 0,      -- Input/prompt tokens
    price_output NUMERIC(10, 6) DEFAULT 0,     -- Output/completion tokens
    price_cached_input NUMERIC(10, 6),         -- Cached input (if supported)
    
    -- Categorization
    model_type TEXT DEFAULT 'text',            -- text, vision, embedding, image, audio
    tier TEXT DEFAULT 'standard',              -- free, standard, premium, enterprise
    
    -- Status
    is_active BOOLEAN DEFAULT true,            -- Available for use
    is_deprecated BOOLEAN DEFAULT false,       -- Marked for removal
    deprecation_date TIMESTAMPTZ,
    
    -- Metadata
    description TEXT,
    release_date DATE,
    source TEXT DEFAULT 'api',                 -- api, manual, web_scrape
    raw_metadata JSONB,                        -- Full API response for reference
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_synced_at TIMESTAMPTZ,                -- Last API sync
    
    -- Unique constraint
    UNIQUE(provider, model_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_model_metadata_provider ON llm_model_metadata(provider);
CREATE INDEX IF NOT EXISTS idx_llm_model_metadata_type ON llm_model_metadata(model_type);
CREATE INDEX IF NOT EXISTS idx_llm_model_metadata_active ON llm_model_metadata(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_llm_model_metadata_lookup ON llm_model_metadata(provider, model_id, is_active);

-- Enable RLS
ALTER TABLE llm_model_metadata ENABLE ROW LEVEL SECURITY;

-- Everyone can read model metadata
CREATE POLICY "Anyone can read model metadata" ON llm_model_metadata
    FOR SELECT USING (true);

-- Only superadmins can modify
CREATE POLICY "Superadmins can manage model metadata" ON llm_model_metadata
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- Service role full access
CREATE POLICY "Service role full access on model metadata" ON llm_model_metadata
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_llm_model_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_llm_model_metadata_updated_at
    BEFORE UPDATE ON llm_model_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_model_metadata_updated_at();

-- ============================================================================
-- Function to upsert model metadata (for sync operations)
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_llm_model_metadata(
    p_provider TEXT,
    p_model_id TEXT,
    p_display_name TEXT DEFAULT NULL,
    p_context_tokens INTEGER DEFAULT NULL,
    p_max_output_tokens INTEGER DEFAULT NULL,
    p_supports_vision BOOLEAN DEFAULT false,
    p_supports_json_mode BOOLEAN DEFAULT false,
    p_supports_function_calling BOOLEAN DEFAULT false,
    p_supports_embeddings BOOLEAN DEFAULT false,
    p_price_input NUMERIC DEFAULT 0,
    p_price_output NUMERIC DEFAULT 0,
    p_model_type TEXT DEFAULT 'text',
    p_tier TEXT DEFAULT 'standard',
    p_description TEXT DEFAULT NULL,
    p_raw_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO llm_model_metadata (
        provider, model_id, display_name,
        context_tokens, max_output_tokens,
        supports_vision, supports_json_mode, supports_function_calling, supports_embeddings,
        price_input, price_output,
        model_type, tier, description, raw_metadata,
        last_synced_at, source
    ) VALUES (
        p_provider, p_model_id, COALESCE(p_display_name, p_model_id),
        p_context_tokens, p_max_output_tokens,
        p_supports_vision, p_supports_json_mode, p_supports_function_calling, p_supports_embeddings,
        p_price_input, p_price_output,
        p_model_type, p_tier, p_description, p_raw_metadata,
        now(), 'api'
    )
    ON CONFLICT (provider, model_id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, llm_model_metadata.display_name),
        context_tokens = COALESCE(EXCLUDED.context_tokens, llm_model_metadata.context_tokens),
        max_output_tokens = COALESCE(EXCLUDED.max_output_tokens, llm_model_metadata.max_output_tokens),
        supports_vision = EXCLUDED.supports_vision,
        supports_json_mode = EXCLUDED.supports_json_mode,
        supports_function_calling = EXCLUDED.supports_function_calling,
        supports_embeddings = EXCLUDED.supports_embeddings,
        price_input = CASE WHEN EXCLUDED.price_input > 0 THEN EXCLUDED.price_input ELSE llm_model_metadata.price_input END,
        price_output = CASE WHEN EXCLUDED.price_output > 0 THEN EXCLUDED.price_output ELSE llm_model_metadata.price_output END,
        model_type = EXCLUDED.model_type,
        tier = EXCLUDED.tier,
        description = COALESCE(EXCLUDED.description, llm_model_metadata.description),
        raw_metadata = COALESCE(EXCLUDED.raw_metadata, llm_model_metadata.raw_metadata),
        last_synced_at = now(),
        updated_at = now(),
        is_active = true
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- ============================================================================
-- Function to get model metadata with fallback
-- ============================================================================
CREATE OR REPLACE FUNCTION get_llm_model_metadata(
    p_provider TEXT,
    p_model_id TEXT
)
RETURNS TABLE (
    model_id TEXT,
    display_name TEXT,
    context_tokens INTEGER,
    max_output_tokens INTEGER,
    supports_vision BOOLEAN,
    supports_json_mode BOOLEAN,
    price_input NUMERIC,
    price_output NUMERIC,
    model_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.model_id,
        m.display_name,
        m.context_tokens,
        m.max_output_tokens,
        m.supports_vision,
        m.supports_json_mode,
        m.price_input,
        m.price_output,
        m.model_type
    FROM llm_model_metadata m
    WHERE m.provider = p_provider 
      AND m.model_id = p_model_id
      AND m.is_active = true
    LIMIT 1;
END;
$$;

-- ============================================================================
-- Function to calculate cost
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_llm_cost(
    p_provider TEXT,
    p_model_id TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_price_input NUMERIC;
    v_price_output NUMERIC;
    v_cost NUMERIC;
BEGIN
    SELECT price_input, price_output 
    INTO v_price_input, v_price_output
    FROM llm_model_metadata
    WHERE provider = p_provider AND model_id = p_model_id AND is_active = true
    LIMIT 1;
    
    IF v_price_input IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Prices are per 1M tokens
    v_cost := (p_input_tokens::NUMERIC / 1000000) * v_price_input +
              (p_output_tokens::NUMERIC / 1000000) * v_price_output;
    
    RETURN ROUND(v_cost, 8);
END;
$$;

-- ============================================================================
-- View for model summary by provider
-- ============================================================================
CREATE OR REPLACE VIEW llm_models_by_provider AS
SELECT 
    provider,
    COUNT(*) FILTER (WHERE is_active) as active_models,
    COUNT(*) FILTER (WHERE model_type = 'text' AND is_active) as text_models,
    COUNT(*) FILTER (WHERE model_type = 'embedding' AND is_active) as embedding_models,
    COUNT(*) FILTER (WHERE supports_vision AND is_active) as vision_models,
    MIN(price_input) FILTER (WHERE is_active AND price_input > 0) as min_price_input,
    MAX(price_input) FILTER (WHERE is_active) as max_price_input,
    MAX(last_synced_at) as last_synced
FROM llm_model_metadata
GROUP BY provider;

-- ============================================================================
-- Insert default/fallback models (from hardcoded list)
-- These will be updated when sync is run
-- ============================================================================
INSERT INTO llm_model_metadata (provider, model_id, display_name, context_tokens, max_output_tokens, supports_vision, supports_json_mode, price_input, price_output, model_type, source) VALUES
-- OpenAI GPT-5 series
('openai', 'gpt-5.2', 'GPT-5.2', 1000000, 65536, true, true, 2.50, 10.00, 'text', 'manual'),
('openai', 'gpt-5.1', 'GPT-5.1', 1000000, 65536, true, true, 2.50, 10.00, 'text', 'manual'),
('openai', 'gpt-5', 'GPT-5', 1000000, 65536, true, true, 3.00, 12.00, 'text', 'manual'),
-- OpenAI GPT-4.1 series
('openai', 'gpt-4.1', 'GPT-4.1', 1047576, 32768, true, true, 2.00, 8.00, 'text', 'manual'),
('openai', 'gpt-4.1-mini', 'GPT-4.1 Mini', 1047576, 32768, true, true, 0.40, 1.60, 'text', 'manual'),
('openai', 'gpt-4.1-nano', 'GPT-4.1 Nano', 1047576, 32768, true, true, 0.10, 0.40, 'text', 'manual'),
-- OpenAI GPT-4o series
('openai', 'gpt-4o', 'GPT-4o', 128000, 16384, true, true, 2.50, 10.00, 'text', 'manual'),
('openai', 'gpt-4o-mini', 'GPT-4o Mini', 128000, 16384, true, true, 0.15, 0.60, 'text', 'manual'),
-- OpenAI o-series
('openai', 'o1', 'O1', 200000, 100000, true, false, 15.00, 60.00, 'text', 'manual'),
('openai', 'o1-mini', 'O1 Mini', 128000, 65536, false, false, 3.00, 12.00, 'text', 'manual'),
('openai', 'o3-mini', 'O3 Mini', 200000, 100000, false, true, 1.10, 4.40, 'text', 'manual'),
('openai', 'o4-mini', 'O4 Mini', 200000, 100000, true, true, 1.10, 4.40, 'text', 'manual'),
-- OpenAI Embeddings
('openai', 'text-embedding-3-small', 'Embedding 3 Small', 8191, NULL, false, false, 0.02, 0, 'embedding', 'manual'),
('openai', 'text-embedding-3-large', 'Embedding 3 Large', 8191, NULL, false, false, 0.13, 0, 'embedding', 'manual'),

-- Google Gemini
('google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 1048576, 8192, true, true, 0.10, 0.40, 'text', 'manual'),
('google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 2097152, 8192, true, true, 1.25, 5.00, 'text', 'manual'),
('google', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 1048576, 8192, true, true, 0.075, 0.30, 'text', 'manual'),
('google', 'text-embedding-004', 'Text Embedding 004', 2048, NULL, false, false, 0.025, 0, 'embedding', 'manual'),

-- Anthropic Claude
('anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 200000, 16000, true, false, 3.00, 15.00, 'text', 'manual'),
('anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 200000, 8192, true, false, 3.00, 15.00, 'text', 'manual'),
('anthropic', 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 200000, 8192, true, false, 0.80, 4.00, 'text', 'manual'),
('anthropic', 'claude-3-opus-20240229', 'Claude 3 Opus', 200000, 4096, true, false, 15.00, 75.00, 'text', 'manual'),

-- xAI Grok
('grok', 'grok-3', 'Grok 3', 131072, 32768, false, true, 3.00, 15.00, 'text', 'manual'),
('grok', 'grok-3-mini', 'Grok 3 Mini', 131072, 32768, false, true, 0.30, 0.50, 'text', 'manual'),
('grok', 'grok-2-vision-1212', 'Grok 2 Vision', 32768, 8192, true, true, 2.00, 10.00, 'vision', 'manual'),
('grok', 'grok-embedding-v1', 'Grok Embedding', 8192, NULL, false, false, 0.02, 0, 'embedding', 'manual'),

-- DeepSeek
('deepseek', 'deepseek-chat', 'DeepSeek Chat', 64000, 8192, false, true, 0.14, 0.28, 'text', 'manual'),
('deepseek', 'deepseek-reasoner', 'DeepSeek Reasoner', 64000, 8192, false, true, 0.55, 2.19, 'text', 'manual')

ON CONFLICT (provider, model_id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE llm_model_metadata IS 'Dynamic storage for LLM model metadata including pricing and capabilities';
COMMENT ON FUNCTION upsert_llm_model_metadata IS 'Upsert model metadata, used during API sync';
COMMENT ON FUNCTION calculate_llm_cost IS 'Calculate cost for LLM request based on stored pricing';
