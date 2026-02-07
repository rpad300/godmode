-- ============================================
-- GodMode Phase 10: LLM Cost Tracking
-- Track LLM API usage and costs
-- ============================================

-- ============================================
-- LLM COST REQUESTS
-- Individual LLM request records
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Request details
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT CHECK (operation IN ('generateText', 'generateVision', 'embed', 'chat', 'completion', 'other')),
    
    -- Tokens
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- Cost (in USD with high precision)
    cost DECIMAL(12,8) DEFAULT 0,
    input_cost DECIMAL(12,8) DEFAULT 0,
    output_cost DECIMAL(12,8) DEFAULT 0,
    
    -- Performance
    latency_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_code TEXT,
    error_message TEXT,
    
    -- Context
    request_type TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID REFERENCES auth.users(id)
);

-- Partition-ready indexes
CREATE INDEX IF NOT EXISTS idx_llm_requests_project ON llm_cost_requests(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_provider ON llm_cost_requests(provider, model);
CREATE INDEX IF NOT EXISTS idx_llm_requests_date ON llm_cost_requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_operation ON llm_cost_requests(operation);

-- ============================================
-- LLM COST TOTALS
-- Aggregate totals per project
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_totals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    
    -- Totals
    total_cost DECIMAL(14,6) DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    
    -- Timestamps
    first_request TIMESTAMPTZ,
    last_request TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_totals_project ON llm_cost_totals(project_id);

-- ============================================
-- LLM COST DAILY
-- Daily aggregates for charting
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    
    -- Totals for the day
    cost DECIMAL(12,6) DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    
    -- Breakdowns
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_llm_daily_project ON llm_cost_daily(project_id, date DESC);

-- ============================================
-- LLM COST BY MODEL
-- Aggregates per provider/model
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_by_model (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    
    -- Totals
    cost DECIMAL(12,6) DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    
    -- Performance
    avg_latency_ms DECIMAL(10,2),
    success_rate DECIMAL(5,2),
    
    -- Timestamps
    first_use TIMESTAMPTZ,
    last_use TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_llm_model_project ON llm_cost_by_model(project_id);
CREATE INDEX IF NOT EXISTS idx_llm_model_provider ON llm_cost_by_model(provider, model);

-- ============================================
-- LLM COST BY PROVIDER
-- Aggregates per provider
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_by_provider (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    provider TEXT NOT NULL,
    
    -- Totals
    cost DECIMAL(12,6) DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    
    -- Model count
    models_used INTEGER DEFAULT 0,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_llm_provider_project ON llm_cost_by_provider(project_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to track LLM cost
CREATE OR REPLACE FUNCTION track_llm_cost(
    p_project_id UUID,
    p_provider TEXT,
    p_model TEXT,
    p_operation TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_cost DECIMAL,
    p_latency_ms INTEGER,
    p_success BOOLEAN,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Insert request record
    INSERT INTO llm_cost_requests (
        project_id, provider, model, operation,
        input_tokens, output_tokens, cost,
        latency_ms, success, created_by
    ) VALUES (
        p_project_id, p_provider, p_model, p_operation,
        p_input_tokens, p_output_tokens, p_cost,
        p_latency_ms, p_success, p_user_id
    ) RETURNING id INTO v_request_id;
    
    -- Update totals
    INSERT INTO llm_cost_totals (project_id, total_cost, total_input_tokens, total_output_tokens, total_requests, first_request, last_request)
    VALUES (p_project_id, p_cost, p_input_tokens, p_output_tokens, 1, now(), now())
    ON CONFLICT (project_id) DO UPDATE SET
        total_cost = llm_cost_totals.total_cost + p_cost,
        total_input_tokens = llm_cost_totals.total_input_tokens + p_input_tokens,
        total_output_tokens = llm_cost_totals.total_output_tokens + p_output_tokens,
        total_requests = llm_cost_totals.total_requests + 1,
        last_request = now(),
        updated_at = now();
    
    -- Update daily
    INSERT INTO llm_cost_daily (project_id, date, cost, input_tokens, output_tokens, requests, successful_requests, failed_requests)
    VALUES (
        p_project_id, v_today, p_cost, p_input_tokens, p_output_tokens, 1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END
    )
    ON CONFLICT (project_id, date) DO UPDATE SET
        cost = llm_cost_daily.cost + p_cost,
        input_tokens = llm_cost_daily.input_tokens + p_input_tokens,
        output_tokens = llm_cost_daily.output_tokens + p_output_tokens,
        requests = llm_cost_daily.requests + 1,
        successful_requests = llm_cost_daily.successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_requests = llm_cost_daily.failed_requests + CASE WHEN p_success THEN 0 ELSE 1 END,
        updated_at = now();
    
    -- Update by model
    INSERT INTO llm_cost_by_model (project_id, provider, model, cost, input_tokens, output_tokens, requests, avg_latency_ms, first_use, last_use)
    VALUES (p_project_id, p_provider, p_model, p_cost, p_input_tokens, p_output_tokens, 1, p_latency_ms, now(), now())
    ON CONFLICT (project_id, provider, model) DO UPDATE SET
        cost = llm_cost_by_model.cost + p_cost,
        input_tokens = llm_cost_by_model.input_tokens + p_input_tokens,
        output_tokens = llm_cost_by_model.output_tokens + p_output_tokens,
        requests = llm_cost_by_model.requests + 1,
        avg_latency_ms = (llm_cost_by_model.avg_latency_ms * (llm_cost_by_model.requests - 1) + p_latency_ms) / llm_cost_by_model.requests,
        last_use = now(),
        updated_at = now();
    
    -- Update by provider
    INSERT INTO llm_cost_by_provider (project_id, provider, cost, input_tokens, output_tokens, requests, models_used)
    VALUES (p_project_id, p_provider, p_cost, p_input_tokens, p_output_tokens, 1, 1)
    ON CONFLICT (project_id, provider) DO UPDATE SET
        cost = llm_cost_by_provider.cost + p_cost,
        input_tokens = llm_cost_by_provider.input_tokens + p_input_tokens,
        output_tokens = llm_cost_by_provider.output_tokens + p_output_tokens,
        requests = llm_cost_by_provider.requests + 1,
        models_used = (SELECT COUNT(DISTINCT model) FROM llm_cost_by_model WHERE project_id = p_project_id AND provider = p_provider),
        updated_at = now();
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cost summary
CREATE OR REPLACE FUNCTION get_llm_cost_summary(p_project_id UUID)
RETURNS TABLE (
    total_cost DECIMAL,
    total_tokens BIGINT,
    total_requests INTEGER,
    cost_today DECIMAL,
    cost_this_month DECIMAL,
    top_model TEXT,
    top_provider TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(t.total_cost, 0) as total_cost,
        COALESCE(t.total_input_tokens + t.total_output_tokens, 0) as total_tokens,
        COALESCE(t.total_requests, 0) as total_requests,
        COALESCE(d.cost, 0) as cost_today,
        COALESCE(m.cost, 0) as cost_this_month,
        (SELECT model FROM llm_cost_by_model WHERE project_id = p_project_id ORDER BY requests DESC LIMIT 1) as top_model,
        (SELECT provider FROM llm_cost_by_provider WHERE project_id = p_project_id ORDER BY requests DESC LIMIT 1) as top_provider
    FROM llm_cost_totals t
    LEFT JOIN llm_cost_daily d ON d.project_id = p_project_id AND d.date = CURRENT_DATE
    LEFT JOIN (
        SELECT project_id, SUM(cost) as cost 
        FROM llm_cost_daily 
        WHERE project_id = p_project_id 
        AND date >= date_trunc('month', CURRENT_DATE)
        GROUP BY project_id
    ) m ON m.project_id = p_project_id
    WHERE t.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE llm_cost_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_by_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_by_provider ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access llm_cost_requests" ON llm_cost_requests FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

CREATE POLICY "Members access llm_cost_totals" ON llm_cost_totals FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access llm_cost_daily" ON llm_cost_daily FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access llm_cost_by_model" ON llm_cost_by_model FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access llm_cost_by_provider" ON llm_cost_by_provider FOR ALL 
    USING (is_project_member(project_id));

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE llm_cost_requests IS 'Individual LLM request records';
COMMENT ON TABLE llm_cost_totals IS 'Aggregate totals per project';
COMMENT ON TABLE llm_cost_daily IS 'Daily aggregates for charting';
COMMENT ON TABLE llm_cost_by_model IS 'Aggregates per provider/model';
COMMENT ON TABLE llm_cost_by_provider IS 'Aggregates per provider';
COMMENT ON FUNCTION track_llm_cost IS 'Track LLM cost and update all aggregates';
COMMENT ON FUNCTION get_llm_cost_summary IS 'Get cost summary for a project';
