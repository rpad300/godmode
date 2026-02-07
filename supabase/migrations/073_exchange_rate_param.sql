-- ============================================
-- Update calculate_billable_cost to accept exchange rate parameter
-- Migration 073 - 2026-02-03
-- ============================================

-- Drop existing function
DROP FUNCTION IF EXISTS calculate_billable_cost(UUID, DECIMAL, BIGINT);

-- Recreate with optional exchange rate parameter
CREATE OR REPLACE FUNCTION calculate_billable_cost(
    p_project_id UUID,
    p_provider_cost_usd DECIMAL,
    p_total_tokens BIGINT,
    p_usd_to_eur_rate DECIMAL DEFAULT NULL
)
RETURNS TABLE (
    provider_cost_eur DECIMAL,
    billable_cost_eur DECIMAL,
    markup_percent DECIMAL,
    tier_id UUID,
    period_key TEXT,
    usd_to_eur_rate DECIMAL
) AS $$
DECLARE
    v_pricing RECORD;
    v_tokens_before BIGINT;
    v_tier RECORD;
    v_provider_eur DECIMAL;
    v_markup DECIMAL;
    v_period TEXT;
    v_rate DECIMAL;
BEGIN
    -- Get pricing config
    SELECT * INTO v_pricing FROM get_project_pricing_config(p_project_id);
    
    -- Determine exchange rate: use parameter if provided, otherwise from config, otherwise default
    v_rate := COALESCE(p_usd_to_eur_rate, v_pricing.usd_to_eur_rate, 0.92);
    
    -- Get tokens consumed before this request
    v_period := get_current_period_key(COALESCE(v_pricing.period_type, 'monthly'));
    v_tokens_before := get_project_tokens_in_period(p_project_id, v_period);
    
    -- Get applicable tier
    SELECT * INTO v_tier FROM get_applicable_tier(v_pricing.config_id, v_tokens_before);
    
    -- Determine markup (tier or fixed)
    v_markup := COALESCE(v_tier.markup_percent, v_pricing.fixed_markup_percent, 0);
    
    -- Convert USD to EUR
    v_provider_eur := p_provider_cost_usd * v_rate;
    
    RETURN QUERY SELECT 
        v_provider_eur,
        v_provider_eur * (1 + v_markup / 100),
        v_markup,
        v_tier.tier_id,
        v_period,
        v_rate;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_billable_cost IS 'Calculate billable cost with tier-based markup. Accepts optional exchange rate parameter for automatic rate support.';
