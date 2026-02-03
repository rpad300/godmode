-- ============================================
-- FIX BILLING FUNCTIONS
-- Fix ambiguous column references
-- Migration 071 - 2026-02-03
-- ============================================

-- Drop and recreate functions with fixed column references
-- The issue is that RETURNS TABLE column names become implicit variables
-- in the function scope, causing ambiguity with same-named table columns

-- ============================================
-- FIX get_project_billing_summary
-- Renamed output columns to avoid conflict
-- ============================================

DROP FUNCTION IF EXISTS get_project_billing_summary(UUID);

CREATE OR REPLACE FUNCTION get_project_billing_summary(p_project_id UUID)
RETURNS TABLE (
    balance_eur DECIMAL,
    unlimited_balance BOOLEAN,
    period_key TEXT,
    tokens_this_period BIGINT,
    provider_cost_this_period DECIMAL,
    billable_cost_this_period DECIMAL,
    requests_this_period INTEGER,
    current_tier_name TEXT,
    current_markup_percent DECIMAL,
    balance_percent_used DECIMAL
) AS $$
DECLARE
    v_project RECORD;
    v_pricing RECORD;
    v_period TEXT;
    v_usage RECORD;
    v_tier RECORD;
    v_initial_balance DECIMAL;
    v_balance_eur DECIMAL;
    v_unlimited BOOLEAN;
    v_tokens BIGINT;
    v_provider_cost DECIMAL;
    v_billable_cost DECIMAL;
    v_requests INTEGER;
    v_tier_name TEXT;
    v_markup DECIMAL;
    v_balance_used DECIMAL;
BEGIN
    -- Get project data into separate variables
    SELECT proj.balance_eur, proj.unlimited_balance 
    INTO v_balance_eur, v_unlimited
    FROM projects proj 
    WHERE proj.id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Get pricing config
    SELECT * INTO v_pricing FROM get_project_pricing_config(p_project_id);
    v_period := get_current_period_key(COALESCE(v_pricing.period_type, 'monthly'));
    
    -- Get period usage (use explicit column selection)
    SELECT 
        ppu.total_tokens,
        ppu.total_provider_cost_eur,
        ppu.total_billable_cost_eur,
        ppu.total_requests
    INTO v_tokens, v_provider_cost, v_billable_cost, v_requests
    FROM project_period_usage ppu
    WHERE ppu.project_id = p_project_id 
    AND ppu.period_key = v_period;
    
    -- Set defaults if no usage found
    v_tokens := COALESCE(v_tokens, 0);
    v_provider_cost := COALESCE(v_provider_cost, 0);
    v_billable_cost := COALESCE(v_billable_cost, 0);
    v_requests := COALESCE(v_requests, 0);
    
    -- Get current tier
    SELECT tier.tier_name, tier.markup_percent 
    INTO v_tier_name, v_markup
    FROM get_applicable_tier(v_pricing.config_id, v_tokens) tier;
    
    v_markup := COALESCE(v_markup, v_pricing.fixed_markup_percent, 0);
    
    -- Calculate balance used percent (from transactions)
    SELECT COALESCE(SUM(bt.amount_eur), 0) INTO v_initial_balance
    FROM balance_transactions bt
    WHERE bt.project_id = p_project_id AND bt.transaction_type = 'credit';
    
    -- Calculate balance used percentage
    IF v_unlimited THEN
        v_balance_used := 0;
    ELSIF v_initial_balance <= 0 THEN
        v_balance_used := 100;
    ELSE
        v_balance_used := ((v_initial_balance - v_balance_eur) / v_initial_balance * 100);
    END IF;
    
    RETURN QUERY SELECT 
        v_balance_eur,
        v_unlimited,
        v_period,
        v_tokens,
        v_provider_cost,
        v_billable_cost,
        v_requests,
        v_tier_name,
        v_markup,
        v_balance_used;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_billing_summary IS 'Get comprehensive billing summary for a project (fixed column references)';

-- ============================================
-- FIX get_all_projects_billing
-- Use explicit column references throughout
-- ============================================

DROP FUNCTION IF EXISTS get_all_projects_billing();

CREATE OR REPLACE FUNCTION get_all_projects_billing()
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    balance_eur DECIMAL,
    unlimited_balance BOOLEAN,
    tokens_this_period BIGINT,
    billable_cost_this_period DECIMAL,
    is_blocked BOOLEAN,
    current_tier_name TEXT
) AS $$
DECLARE
    v_period TEXT;
    v_global_config_id UUID;
BEGIN
    v_period := get_current_period_key();
    
    -- Get global config ID once
    SELECT gpc.id INTO v_global_config_id 
    FROM pricing_configs gpc 
    WHERE gpc.scope = 'global' 
    LIMIT 1;
    
    RETURN QUERY
    SELECT 
        p.id AS project_id,
        p.name AS project_name,
        p.balance_eur AS balance_eur,
        p.unlimited_balance AS unlimited_balance,
        COALESCE(ppu.total_tokens, 0)::BIGINT AS tokens_this_period,
        COALESCE(ppu.total_billable_cost_eur, 0)::DECIMAL AS billable_cost_this_period,
        (NOT p.unlimited_balance AND p.balance_eur <= 0)::BOOLEAN AS is_blocked,
        pt.name AS current_tier_name
    FROM projects p
    LEFT JOIN project_period_usage ppu 
        ON ppu.project_id = p.id AND ppu.period_key = v_period
    LEFT JOIN pricing_configs pc 
        ON pc.project_id = p.id AND pc.scope = 'project'
    LEFT JOIN LATERAL (
        SELECT tier_sub.tier_id, tier_sub.tier_name, tier_sub.markup_percent
        FROM get_applicable_tier(
            COALESCE(pc.id, v_global_config_id),
            COALESCE(ppu.total_tokens, 0)
        ) tier_sub
    ) tier_data ON true
    LEFT JOIN pricing_tiers pt ON pt.id = tier_data.tier_id
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_all_projects_billing IS 'Get billing overview for all projects (admin only, fixed column references)';
