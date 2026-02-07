-- ============================================
-- LLM Cost: Budget and alerts per project
-- ============================================

CREATE TABLE IF NOT EXISTS llm_cost_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    period TEXT NOT NULL CHECK (period IN ('week', 'month')),
    limit_usd DECIMAL(12,6) NOT NULL CHECK (limit_usd > 0),
    alert_threshold_percent INTEGER DEFAULT 80 CHECK (alert_threshold_percent >= 0 AND alert_threshold_percent <= 100),
    notified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, period)
);

CREATE INDEX IF NOT EXISTS idx_llm_budgets_project ON llm_cost_budgets(project_id);

ALTER TABLE llm_cost_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access llm_cost_budgets" ON llm_cost_budgets FOR ALL
    USING (is_project_member(project_id));

COMMENT ON TABLE llm_cost_budgets IS 'LLM cost budget limits and alert thresholds per project';
