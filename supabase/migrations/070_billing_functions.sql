-- ============================================
-- Migration 070: Billing Functions
-- Atomic balance operations and cost calculation
-- ============================================

-- ============================================
-- HELPER: Get current period key
-- ============================================

CREATE OR REPLACE FUNCTION get_current_period_key(p_period_type TEXT DEFAULT 'monthly')
RETURNS TEXT AS $$
BEGIN
    IF p_period_type = 'weekly' THEN
        RETURN to_char(CURRENT_DATE, 'IYYY-IW');
    ELSE
        RETURN to_char(CURRENT_DATE, 'YYYY-MM');
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_current_period_key IS 'Get the current billing period key (YYYY-MM for monthly, IYYY-IW for weekly)';

-- ============================================
-- GET PROJECT PRICING CONFIG
-- Returns applicable pricing config with fallback
-- ============================================

CREATE OR REPLACE FUNCTION get_project_pricing_config(p_project_id UUID)
RETURNS TABLE (
    config_id UUID,
    scope TEXT,
    fixed_markup_percent DECIMAL,
    period_type TEXT,
    usd_to_eur_rate DECIMAL
) AS $$
BEGIN
    -- First try project-specific config
    RETURN QUERY
    SELECT 
        pc.id,
        pc.scope,
        pc.fixed_markup_percent,
        pc.period_type,
        pc.usd_to_eur_rate
    FROM pricing_configs pc
    WHERE pc.project_id = p_project_id 
    AND pc.scope = 'project'
    AND pc.is_active = true
    LIMIT 1;
    
    -- If no project config found, fall back to global
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            pc.id,
            pc.scope,
            pc.fixed_markup_percent,
            pc.period_type,
            pc.usd_to_eur_rate
        FROM pricing_configs pc
        WHERE pc.scope = 'global'
        AND pc.is_active = true
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_pricing_config IS 'Get applicable pricing config for a project (project-specific or global fallback)';

-- ============================================
-- GET APPLICABLE TIER
-- Returns tier based on tokens consumed in period
-- ============================================

CREATE OR REPLACE FUNCTION get_applicable_tier(
    p_pricing_config_id UUID,
    p_tokens_consumed BIGINT
)
RETURNS TABLE (
    tier_id UUID,
    tier_name TEXT,
    markup_percent DECIMAL,
    token_limit BIGINT
) AS $$
BEGIN
    -- Find the tier where tokens_consumed < token_limit (or unlimited tier)
    RETURN QUERY
    SELECT 
        pt.id,
        pt.name,
        pt.markup_percent,
        pt.token_limit
    FROM pricing_tiers pt
    WHERE pt.pricing_config_id = p_pricing_config_id
    AND (pt.token_limit IS NULL OR pt.token_limit > p_tokens_consumed)
    ORDER BY pt.tier_order ASC
    LIMIT 1;
    
    -- If no tier found, return NULL (will use fixed_markup)
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_applicable_tier IS 'Get the applicable pricing tier based on tokens consumed in the period';

-- ============================================
-- GET PROJECT TOKENS IN PERIOD
-- Returns total tokens consumed in current period
-- ============================================

CREATE OR REPLACE FUNCTION get_project_tokens_in_period(
    p_project_id UUID,
    p_period_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_period_key TEXT;
    v_tokens BIGINT;
BEGIN
    -- Use provided period or current period
    v_period_key := COALESCE(p_period_key, get_current_period_key());
    
    SELECT total_tokens INTO v_tokens
    FROM project_period_usage
    WHERE project_id = p_project_id AND period_key = v_period_key;
    
    RETURN COALESCE(v_tokens, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_tokens_in_period IS 'Get total tokens consumed by a project in a billing period';

-- ============================================
-- CHECK PROJECT BALANCE
-- Returns whether project can proceed with AI request
-- ============================================

CREATE OR REPLACE FUNCTION check_project_balance(
    p_project_id UUID,
    p_estimated_cost_eur DECIMAL DEFAULT 0
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    balance_eur DECIMAL,
    unlimited BOOLEAN,
    tokens_in_period BIGINT,
    current_tier_name TEXT,
    current_markup_percent DECIMAL
) AS $$
DECLARE
    v_project projects%ROWTYPE;
    v_pricing RECORD;
    v_tokens_consumed BIGINT;
    v_tier RECORD;
BEGIN
    -- Get project (no lock needed for check)
    SELECT * INTO v_project FROM projects WHERE id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Project not found'::TEXT, 0::DECIMAL, false, 0::BIGINT, NULL::TEXT, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- If unlimited, always allow
    IF v_project.unlimited_balance THEN
        -- Get tokens for reporting
        v_tokens_consumed := get_project_tokens_in_period(p_project_id);
        
        -- Get pricing config for tier info
        SELECT * INTO v_pricing FROM get_project_pricing_config(p_project_id);
        SELECT * INTO v_tier FROM get_applicable_tier(v_pricing.config_id, v_tokens_consumed);
        
        RETURN QUERY SELECT 
            true, 
            NULL::TEXT, 
            v_project.balance_eur,
            true,
            v_tokens_consumed,
            v_tier.tier_name,
            COALESCE(v_tier.markup_percent, v_pricing.fixed_markup_percent);
        RETURN;
    END IF;
    
    -- Check if balance is sufficient
    IF v_project.balance_eur <= 0 THEN
        RETURN QUERY SELECT 
            false, 
            'No balance available. Contact admin to add funds.'::TEXT, 
            v_project.balance_eur,
            false,
            get_project_tokens_in_period(p_project_id),
            NULL::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;
    
    IF v_project.balance_eur < p_estimated_cost_eur THEN
        RETURN QUERY SELECT 
            false, 
            format('Insufficient balance. Available: €%.2f, Required: €%.2f', v_project.balance_eur, p_estimated_cost_eur)::TEXT, 
            v_project.balance_eur,
            false,
            get_project_tokens_in_period(p_project_id),
            NULL::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;
    
    -- All checks passed
    v_tokens_consumed := get_project_tokens_in_period(p_project_id);
    SELECT * INTO v_pricing FROM get_project_pricing_config(p_project_id);
    SELECT * INTO v_tier FROM get_applicable_tier(v_pricing.config_id, v_tokens_consumed);
    
    RETURN QUERY SELECT 
        true, 
        NULL::TEXT, 
        v_project.balance_eur,
        false,
        v_tokens_consumed,
        v_tier.tier_name,
        COALESCE(v_tier.markup_percent, v_pricing.fixed_markup_percent);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_project_balance IS 'Check if project has sufficient balance for AI request';

-- ============================================
-- DEBIT PROJECT BALANCE (ATOMIC)
-- Deducts from balance with row-level lock
-- ============================================

CREATE OR REPLACE FUNCTION debit_project_balance(
    p_project_id UUID,
    p_amount_eur DECIMAL,
    p_llm_request_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance DECIMAL,
    reason TEXT
) AS $$
DECLARE
    v_project projects%ROWTYPE;
    v_balance_before DECIMAL;
    v_balance_after DECIMAL;
BEGIN
    -- Lock the row for atomic operation
    SELECT * INTO v_project FROM projects 
    WHERE id = p_project_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 'Project not found'::TEXT;
        RETURN;
    END IF;
    
    -- If unlimited, don't deduct but still record transaction
    IF v_project.unlimited_balance THEN
        -- Record transaction for audit (amount deducted is 0 for unlimited)
        INSERT INTO balance_transactions (
            project_id, transaction_type, amount_eur,
            balance_before, balance_after,
            llm_request_id, description
        ) VALUES (
            p_project_id, 'debit', p_amount_eur,
            v_project.balance_eur, v_project.balance_eur,
            p_llm_request_id, COALESCE(p_description, 'AI usage (unlimited mode)')
        );
        
        RETURN QUERY SELECT true, v_project.balance_eur, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Check sufficient balance
    IF v_project.balance_eur < p_amount_eur THEN
        RETURN QUERY SELECT false, v_project.balance_eur, 'Insufficient balance'::TEXT;
        RETURN;
    END IF;
    
    v_balance_before := v_project.balance_eur;
    v_balance_after := v_project.balance_eur - p_amount_eur;
    
    -- Deduct balance
    UPDATE projects 
    SET balance_eur = v_balance_after,
        updated_at = now()
    WHERE id = p_project_id;
    
    -- Record transaction
    INSERT INTO balance_transactions (
        project_id, transaction_type, amount_eur,
        balance_before, balance_after,
        llm_request_id, description
    ) VALUES (
        p_project_id, 'debit', p_amount_eur,
        v_balance_before, v_balance_after,
        p_llm_request_id, COALESCE(p_description, 'AI usage')
    );
    
    RETURN QUERY SELECT true, v_balance_after, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION debit_project_balance IS 'Atomically deduct from project balance with audit trail';

-- ============================================
-- CREDIT PROJECT BALANCE
-- Add funds to project balance
-- ============================================

CREATE OR REPLACE FUNCTION credit_project_balance(
    p_project_id UUID,
    p_amount_eur DECIMAL,
    p_performed_by UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance DECIMAL,
    reason TEXT
) AS $$
DECLARE
    v_balance_before DECIMAL;
    v_balance_after DECIMAL;
BEGIN
    -- Lock and get current balance
    SELECT balance_eur INTO v_balance_before 
    FROM projects WHERE id = p_project_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 'Project not found'::TEXT;
        RETURN;
    END IF;
    
    v_balance_after := v_balance_before + p_amount_eur;
    
    -- Add balance
    UPDATE projects 
    SET balance_eur = v_balance_after,
        updated_at = now()
    WHERE id = p_project_id;
    
    -- Clear low balance notification flag
    UPDATE projects 
    SET balance_low_notified_at = NULL
    WHERE id = p_project_id AND balance_low_notified_at IS NOT NULL;
    
    -- Record transaction
    INSERT INTO balance_transactions (
        project_id, transaction_type, amount_eur,
        balance_before, balance_after,
        performed_by, description
    ) VALUES (
        p_project_id, 'credit', p_amount_eur,
        v_balance_before, v_balance_after,
        p_performed_by, COALESCE(p_description, 'Balance added by admin')
    );
    
    RETURN QUERY SELECT true, v_balance_after, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION credit_project_balance IS 'Add funds to project balance with audit trail';

-- ============================================
-- SET PROJECT UNLIMITED
-- Toggle unlimited mode
-- ============================================

CREATE OR REPLACE FUNCTION set_project_unlimited(
    p_project_id UUID,
    p_unlimited BOOLEAN,
    p_performed_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_unlimited BOOLEAN;
BEGIN
    SELECT unlimited_balance INTO v_old_unlimited 
    FROM projects WHERE id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    IF v_old_unlimited = p_unlimited THEN
        RETURN true; -- No change needed
    END IF;
    
    UPDATE projects 
    SET unlimited_balance = p_unlimited,
        updated_at = now()
    WHERE id = p_project_id;
    
    -- Record in balance transactions as adjustment
    INSERT INTO balance_transactions (
        project_id, transaction_type, amount_eur,
        performed_by, description
    ) VALUES (
        p_project_id, 'adjustment', 0,
        p_performed_by, 
        CASE WHEN p_unlimited 
            THEN 'Enabled unlimited balance mode' 
            ELSE 'Disabled unlimited balance mode' 
        END
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_project_unlimited IS 'Toggle unlimited balance mode for a project';

-- ============================================
-- CALCULATE BILLABLE COST
-- Apply markup to provider cost
-- ============================================

CREATE OR REPLACE FUNCTION calculate_billable_cost(
    p_project_id UUID,
    p_provider_cost_usd DECIMAL,
    p_total_tokens BIGINT
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
BEGIN
    -- Get pricing config
    SELECT * INTO v_pricing FROM get_project_pricing_config(p_project_id);
    
    -- Get tokens consumed before this request
    v_period := get_current_period_key(COALESCE(v_pricing.period_type, 'monthly'));
    v_tokens_before := get_project_tokens_in_period(p_project_id, v_period);
    
    -- Get applicable tier
    SELECT * INTO v_tier FROM get_applicable_tier(v_pricing.config_id, v_tokens_before);
    
    -- Determine markup (tier or fixed)
    v_markup := COALESCE(v_tier.markup_percent, v_pricing.fixed_markup_percent, 0);
    
    -- Convert USD to EUR
    v_provider_eur := p_provider_cost_usd * COALESCE(v_pricing.usd_to_eur_rate, 0.92);
    
    RETURN QUERY SELECT 
        v_provider_eur,
        v_provider_eur * (1 + v_markup / 100),
        v_markup,
        v_tier.tier_id,
        v_period,
        COALESCE(v_pricing.usd_to_eur_rate, 0.92);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_billable_cost IS 'Calculate billable cost with tier-based markup';

-- ============================================
-- UPDATE PERIOD USAGE (ATOMIC)
-- Increment period aggregates
-- ============================================

CREATE OR REPLACE FUNCTION update_period_usage(
    p_project_id UUID,
    p_input_tokens BIGINT,
    p_output_tokens BIGINT,
    p_provider_cost_eur DECIMAL,
    p_billable_cost_eur DECIMAL,
    p_period_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_period TEXT;
BEGIN
    v_period := COALESCE(p_period_key, get_current_period_key());
    
    INSERT INTO project_period_usage (
        project_id, period_key,
        total_tokens, total_input_tokens, total_output_tokens,
        total_provider_cost_eur, total_billable_cost_eur,
        total_requests, updated_at
    ) VALUES (
        p_project_id, v_period,
        p_input_tokens + p_output_tokens, p_input_tokens, p_output_tokens,
        p_provider_cost_eur, p_billable_cost_eur,
        1, now()
    )
    ON CONFLICT (project_id, period_key) DO UPDATE SET
        total_tokens = project_period_usage.total_tokens + (p_input_tokens + p_output_tokens),
        total_input_tokens = project_period_usage.total_input_tokens + p_input_tokens,
        total_output_tokens = project_period_usage.total_output_tokens + p_output_tokens,
        total_provider_cost_eur = project_period_usage.total_provider_cost_eur + p_provider_cost_eur,
        total_billable_cost_eur = project_period_usage.total_billable_cost_eur + p_billable_cost_eur,
        total_requests = project_period_usage.total_requests + 1,
        updated_at = now();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_period_usage IS 'Atomically update period aggregates for a project';

-- ============================================
-- GET BILLING SUMMARY FOR PROJECT
-- Returns billing overview
-- ============================================

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
    v_project projects%ROWTYPE;
    v_pricing RECORD;
    v_period TEXT;
    v_usage project_period_usage%ROWTYPE;
    v_tier RECORD;
    v_initial_balance DECIMAL;
BEGIN
    SELECT * INTO v_project FROM projects WHERE id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Get pricing config
    SELECT * INTO v_pricing FROM get_project_pricing_config(p_project_id);
    v_period := get_current_period_key(COALESCE(v_pricing.period_type, 'monthly'));
    
    -- Get period usage
    SELECT * INTO v_usage FROM project_period_usage 
    WHERE project_id = p_project_id AND period_key = v_period;
    
    -- Get current tier
    SELECT * INTO v_tier FROM get_applicable_tier(
        v_pricing.config_id, 
        COALESCE(v_usage.total_tokens, 0)
    );
    
    -- Calculate balance used percent (from transactions)
    SELECT COALESCE(SUM(amount_eur), 0) INTO v_initial_balance
    FROM balance_transactions
    WHERE project_id = p_project_id AND transaction_type = 'credit';
    
    RETURN QUERY SELECT 
        v_project.balance_eur,
        v_project.unlimited_balance,
        v_period,
        COALESCE(v_usage.total_tokens, 0),
        COALESCE(v_usage.total_provider_cost_eur, 0),
        COALESCE(v_usage.total_billable_cost_eur, 0),
        COALESCE(v_usage.total_requests, 0),
        v_tier.tier_name,
        COALESCE(v_tier.markup_percent, v_pricing.fixed_markup_percent, 0),
        CASE 
            WHEN v_project.unlimited_balance THEN 0
            WHEN v_initial_balance <= 0 THEN 100
            ELSE ((v_initial_balance - v_project.balance_eur) / v_initial_balance * 100)
        END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_billing_summary IS 'Get comprehensive billing summary for a project';

-- ============================================
-- GET ALL PROJECTS BILLING (ADMIN)
-- Returns billing info for all projects
-- ============================================

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
BEGIN
    v_period := get_current_period_key();
    
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.balance_eur,
        p.unlimited_balance,
        COALESCE(ppu.total_tokens, 0),
        COALESCE(ppu.total_billable_cost_eur, 0),
        (NOT p.unlimited_balance AND p.balance_eur <= 0),
        pt.name
    FROM projects p
    LEFT JOIN project_period_usage ppu 
        ON ppu.project_id = p.id AND ppu.period_key = v_period
    LEFT JOIN pricing_configs pc 
        ON pc.project_id = p.id AND pc.scope = 'project'
    LEFT JOIN LATERAL (
        SELECT * FROM get_applicable_tier(
            COALESCE(pc.id, (SELECT id FROM pricing_configs WHERE scope = 'global' LIMIT 1)),
            COALESCE(ppu.total_tokens, 0)
        )
    ) tier ON true
    LEFT JOIN pricing_tiers pt ON pt.id = tier.tier_id
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_all_projects_billing IS 'Get billing overview for all projects (admin only)';

-- ============================================
-- MARK LOW BALANCE NOTIFIED
-- Prevents duplicate notifications
-- ============================================

CREATE OR REPLACE FUNCTION mark_low_balance_notified(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE projects 
    SET balance_low_notified_at = now()
    WHERE id = p_project_id 
    AND balance_low_notified_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_low_balance_notified IS 'Mark that low balance notification was sent';

-- ============================================
-- CHECK IF SHOULD NOTIFY LOW BALANCE
-- Returns true if notification should be sent
-- ============================================

CREATE OR REPLACE FUNCTION should_notify_low_balance(
    p_project_id UUID,
    p_threshold_percent DECIMAL DEFAULT 20
)
RETURNS BOOLEAN AS $$
DECLARE
    v_project projects%ROWTYPE;
    v_total_credited DECIMAL;
    v_percent_remaining DECIMAL;
BEGIN
    SELECT * INTO v_project FROM projects WHERE id = p_project_id;
    
    -- Don't notify for unlimited
    IF v_project.unlimited_balance THEN
        RETURN false;
    END IF;
    
    -- Already notified
    IF v_project.balance_low_notified_at IS NOT NULL THEN
        RETURN false;
    END IF;
    
    -- Calculate percent remaining
    SELECT COALESCE(SUM(amount_eur), 0) INTO v_total_credited
    FROM balance_transactions
    WHERE project_id = p_project_id AND transaction_type = 'credit';
    
    IF v_total_credited <= 0 THEN
        RETURN false;
    END IF;
    
    v_percent_remaining := (v_project.balance_eur / v_total_credited) * 100;
    
    RETURN v_percent_remaining <= p_threshold_percent;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION should_notify_low_balance IS 'Check if low balance notification should be sent';
