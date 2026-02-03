-- ============================================
-- Migration 069: Project Billing & Cost Control
-- Balance per project, tiered pricing, markup
-- ============================================

-- ============================================
-- ALTER PROJECTS TABLE
-- Add balance and billing fields
-- ============================================

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS balance_eur DECIMAL(12,4) DEFAULT 0;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS unlimited_balance BOOLEAN DEFAULT false;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS pricing_config_id UUID;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS balance_low_notified_at TIMESTAMPTZ;

-- Index for billing queries
CREATE INDEX IF NOT EXISTS idx_projects_balance ON projects(balance_eur) WHERE unlimited_balance = false;

COMMENT ON COLUMN projects.balance_eur IS 'Available balance in EUR for AI usage';
COMMENT ON COLUMN projects.unlimited_balance IS 'If true, bypass balance checks (still track costs)';
COMMENT ON COLUMN projects.pricing_config_id IS 'Optional override pricing config (null = use global)';
COMMENT ON COLUMN projects.balance_low_notified_at IS 'Last time low balance notification was sent';

-- ============================================
-- PRICING CONFIGURATIONS TABLE
-- Global and per-project pricing configs
-- ============================================

CREATE TABLE IF NOT EXISTS pricing_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope: 'global' (one per system) or 'project' (override)
    scope TEXT NOT NULL CHECK (scope IN ('global', 'project')),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Fixed markup (fallback when no tiers match or tiers empty)
    fixed_markup_percent DECIMAL(5,2) DEFAULT 0 CHECK (fixed_markup_percent >= 0),
    
    -- Period type for tier resets
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'weekly')),
    
    -- EUR per USD conversion rate (for provider costs in USD)
    usd_to_eur_rate DECIMAL(8,4) DEFAULT 0.92,
    
    -- Active flag
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique indexes (enforce only one global config, and one config per project)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_global_unique ON pricing_configs(scope) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_project_unique ON pricing_configs(project_id) WHERE scope = 'project' AND project_id IS NOT NULL;

-- Regular indexes
CREATE INDEX IF NOT EXISTS idx_pricing_configs_scope ON pricing_configs(scope);
CREATE INDEX IF NOT EXISTS idx_pricing_configs_project ON pricing_configs(project_id) WHERE project_id IS NOT NULL;

-- RLS
ALTER TABLE pricing_configs ENABLE ROW LEVEL SECURITY;

-- Superadmin can manage all pricing configs
CREATE POLICY "Superadmin manages pricing configs" ON pricing_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Project admins can view their project's pricing
CREATE POLICY "Project admins view project pricing" ON pricing_configs
    FOR SELECT USING (
        scope = 'global' OR (
            scope = 'project' AND 
            project_id IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM project_members 
                WHERE project_id = pricing_configs.project_id 
                AND user_id = auth.uid() 
                AND role IN ('owner', 'admin')
            )
        )
    );

COMMENT ON TABLE pricing_configs IS 'Pricing configurations with markup for billing';

-- ============================================
-- PRICING TIERS TABLE
-- Tiered markup based on token usage
-- ============================================

CREATE TABLE IF NOT EXISTS pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_config_id UUID NOT NULL REFERENCES pricing_configs(id) ON DELETE CASCADE,
    
    -- Tier limit (tokens consumed in period)
    -- NULL means unlimited (final tier)
    token_limit BIGINT CHECK (token_limit IS NULL OR token_limit > 0),
    
    -- Markup percentage for this tier
    markup_percent DECIMAL(5,2) NOT NULL CHECK (markup_percent >= 0),
    
    -- Display name (optional)
    name TEXT,
    
    -- Sort order (lower = earlier tier)
    tier_order INTEGER NOT NULL DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_config ON pricing_tiers(pricing_config_id, tier_order);

-- RLS (inherits from pricing_configs via FK)
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin manages pricing tiers" ON pricing_tiers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

CREATE POLICY "Users view pricing tiers" ON pricing_tiers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pricing_configs pc
            WHERE pc.id = pricing_tiers.pricing_config_id
            AND (
                pc.scope = 'global' OR (
                    pc.scope = 'project' AND
                    EXISTS (
                        SELECT 1 FROM project_members 
                        WHERE project_id = pc.project_id 
                        AND user_id = auth.uid()
                    )
                )
            )
        )
    );

COMMENT ON TABLE pricing_tiers IS 'Tiered pricing levels based on token consumption';

-- ============================================
-- PROJECT PERIOD USAGE TABLE
-- Aggregated usage per project per period
-- ============================================

CREATE TABLE IF NOT EXISTS project_period_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Period identifier (e.g., '2026-02' for monthly)
    period_key TEXT NOT NULL,
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'weekly')),
    
    -- Token totals
    total_tokens BIGINT DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    
    -- Cost totals (in EUR)
    total_provider_cost_eur DECIMAL(14,6) DEFAULT 0,
    total_billable_cost_eur DECIMAL(14,6) DEFAULT 0,
    
    -- Request count
    total_requests INTEGER DEFAULT 0,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, period_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_period_usage_project ON project_period_usage(project_id, period_key DESC);

-- RLS
ALTER TABLE project_period_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view period usage" ON project_period_usage
    FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "Service inserts period usage" ON project_period_usage
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service updates period usage" ON project_period_usage
    FOR UPDATE USING (true);

COMMENT ON TABLE project_period_usage IS 'Aggregated token and cost usage per project per billing period';

-- ============================================
-- ALTER LLM_COST_REQUESTS TABLE
-- Add billing fields
-- ============================================

ALTER TABLE llm_cost_requests 
ADD COLUMN IF NOT EXISTS provider_cost_eur DECIMAL(12,8);

ALTER TABLE llm_cost_requests 
ADD COLUMN IF NOT EXISTS billable_cost_eur DECIMAL(12,8);

ALTER TABLE llm_cost_requests 
ADD COLUMN IF NOT EXISTS markup_percent_applied DECIMAL(5,2);

ALTER TABLE llm_cost_requests 
ADD COLUMN IF NOT EXISTS tier_applied_id UUID REFERENCES pricing_tiers(id) ON DELETE SET NULL;

ALTER TABLE llm_cost_requests 
ADD COLUMN IF NOT EXISTS period_key TEXT;

-- Index for period queries
CREATE INDEX IF NOT EXISTS idx_llm_requests_period ON llm_cost_requests(project_id, period_key);

COMMENT ON COLUMN llm_cost_requests.provider_cost_eur IS 'Actual provider cost converted to EUR';
COMMENT ON COLUMN llm_cost_requests.billable_cost_eur IS 'Cost charged to project (with markup)';
COMMENT ON COLUMN llm_cost_requests.markup_percent_applied IS 'Markup percentage that was applied';
COMMENT ON COLUMN llm_cost_requests.tier_applied_id IS 'Pricing tier used for markup calculation';
COMMENT ON COLUMN llm_cost_requests.period_key IS 'Billing period (e.g., 2026-02)';

-- ============================================
-- BALANCE TRANSACTIONS TABLE (AUDIT)
-- Track all balance changes
-- ============================================

CREATE TABLE IF NOT EXISTS balance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Transaction type
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'credit',           -- Admin added balance
        'debit',            -- AI usage deducted
        'adjustment',       -- Manual adjustment
        'refund'            -- Cost refund
    )),
    
    -- Amounts
    amount_eur DECIMAL(12,4) NOT NULL,
    balance_before DECIMAL(12,4),
    balance_after DECIMAL(12,4),
    
    -- Reference to LLM request (for debits)
    llm_request_id UUID REFERENCES llm_cost_requests(id) ON DELETE SET NULL,
    
    -- Description
    description TEXT,
    
    -- Who made the change (null for system/AI usage)
    performed_by UUID REFERENCES auth.users(id),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_balance_tx_project ON balance_transactions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_tx_type ON balance_transactions(transaction_type);

-- RLS
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project admins view balance transactions" ON balance_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = balance_transactions.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Superadmin manages balance transactions" ON balance_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

COMMENT ON TABLE balance_transactions IS 'Audit trail for all balance changes';

-- ============================================
-- INSERT DEFAULT GLOBAL PRICING CONFIG
-- ============================================

INSERT INTO pricing_configs (scope, fixed_markup_percent, period_type, is_active)
VALUES ('global', 0, 'monthly', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE pricing_configs IS 'Global and project-specific pricing configurations';
COMMENT ON TABLE pricing_tiers IS 'Tiered markup levels based on token consumption per period';
COMMENT ON TABLE project_period_usage IS 'Aggregated usage statistics per project per billing period';
COMMENT ON TABLE balance_transactions IS 'Complete audit trail of all balance changes';
