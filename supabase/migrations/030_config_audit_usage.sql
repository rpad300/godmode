-- ============================================
-- Migration 030: Config Audit Log & Usage Limits
-- Enterprise features for tracking and cost control
-- ============================================

-- ============================================
-- CONFIG AUDIT LOG
-- Track all configuration changes (who, when, what)
-- ============================================
CREATE TABLE IF NOT EXISTS config_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What was changed
    config_type TEXT NOT NULL CHECK (config_type IN ('system', 'project', 'secret')),
    config_key TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Change details
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    old_value JSONB,
    new_value JSONB,
    
    -- Diff summary (human-readable)
    change_summary TEXT,
    
    -- Who made the change
    changed_by UUID REFERENCES auth.users(id),
    changed_by_email TEXT,
    
    -- When
    changed_at TIMESTAMPTZ DEFAULT now(),
    
    -- Client info
    ip_address INET,
    user_agent TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_config_type ON config_audit_log(config_type);
CREATE INDEX IF NOT EXISTS idx_audit_project ON config_audit_log(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON config_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON config_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_key ON config_audit_log(config_key);

-- ============================================
-- PROJECT USAGE LIMITS
-- Cost control and usage management per project
-- ============================================
CREATE TABLE IF NOT EXISTS project_usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    
    -- Monthly budget
    monthly_budget_usd DECIMAL(10, 2) DEFAULT 50.00,
    monthly_used_usd DECIMAL(10, 4) DEFAULT 0,
    budget_reset_day INTEGER DEFAULT 1 CHECK (budget_reset_day >= 1 AND budget_reset_day <= 28),
    
    -- Daily limit (optional)
    daily_limit_usd DECIMAL(10, 2),
    daily_used_usd DECIMAL(10, 4) DEFAULT 0,
    last_daily_reset DATE DEFAULT CURRENT_DATE,
    
    -- Alert thresholds
    alert_at_percent INTEGER DEFAULT 80 CHECK (alert_at_percent >= 0 AND alert_at_percent <= 100),
    alert_sent_at TIMESTAMPTZ,
    
    -- Actions when limit reached
    block_at_limit BOOLEAN DEFAULT true,
    fallback_to_free BOOLEAN DEFAULT false,  -- Fallback to Ollama when limit reached
    fallback_at_percent INTEGER DEFAULT 90,
    
    -- Request limits (optional)
    max_requests_per_day INTEGER,
    requests_today INTEGER DEFAULT 0,
    
    -- Status
    is_blocked BOOLEAN DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_reason TEXT,
    
    -- Audit
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- USAGE ALERTS
-- Track sent alerts to avoid duplicates
-- ============================================
CREATE TABLE IF NOT EXISTS usage_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'limit_reached', 'blocked', 'unblocked')),
    threshold_percent INTEGER,
    
    -- Alert details
    current_usage_usd DECIMAL(10, 4),
    limit_usd DECIMAL(10, 2),
    message TEXT,
    
    -- Recipients
    notified_users UUID[],
    notified_emails TEXT[],
    
    -- Delivery status
    sent_at TIMESTAMPTZ DEFAULT now(),
    delivery_status TEXT DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS idx_alerts_project ON usage_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent_at ON usage_alerts(sent_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;

-- Config Audit: Superadmin sees all, project members see project logs
CREATE POLICY "Superadmin reads all audit logs" ON config_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

CREATE POLICY "Project members read project audit logs" ON config_audit_log
    FOR SELECT USING (
        project_id IS NOT NULL AND is_project_member(project_id)
    );

-- Only backend can insert audit logs (via service role)
CREATE POLICY "Service role inserts audit logs" ON config_audit_log
    FOR INSERT WITH CHECK (true);  -- Controlled by service role key

-- Usage Limits: Project owner/admin can manage
CREATE POLICY "Project admin manages usage limits" ON project_usage_limits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = project_usage_limits.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Project members read usage limits" ON project_usage_limits
    FOR SELECT USING (is_project_member(project_id));

-- Usage Alerts: Project members can view
CREATE POLICY "Project members read usage alerts" ON usage_alerts
    FOR SELECT USING (is_project_member(project_id));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to log a config change
CREATE OR REPLACE FUNCTION log_config_change(
    p_config_type TEXT,
    p_config_key TEXT,
    p_project_id UUID,
    p_action TEXT,
    p_old_value JSONB,
    p_new_value JSONB,
    p_user_id UUID,
    p_user_email TEXT DEFAULT NULL,
    p_change_summary TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO config_audit_log (
        config_type, config_key, project_id,
        action, old_value, new_value, change_summary,
        changed_by, changed_by_email
    ) VALUES (
        p_config_type, p_config_key, p_project_id,
        p_action, p_old_value, p_new_value, p_change_summary,
        p_user_id, p_user_email
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update daily usage
CREATE OR REPLACE FUNCTION check_usage_limit(
    p_project_id UUID,
    p_cost_usd DECIMAL
) RETURNS TABLE(
    allowed BOOLEAN,
    reason TEXT,
    current_monthly DECIMAL,
    monthly_limit DECIMAL,
    current_daily DECIMAL,
    daily_limit DECIMAL
) AS $$
DECLARE
    v_limits project_usage_limits%ROWTYPE;
BEGIN
    -- Get or create limits record
    SELECT * INTO v_limits FROM project_usage_limits WHERE project_id = p_project_id;
    
    IF NOT FOUND THEN
        INSERT INTO project_usage_limits (project_id) VALUES (p_project_id)
        RETURNING * INTO v_limits;
    END IF;
    
    -- Reset daily counter if new day
    IF v_limits.last_daily_reset < CURRENT_DATE THEN
        UPDATE project_usage_limits 
        SET daily_used_usd = 0, last_daily_reset = CURRENT_DATE, requests_today = 0
        WHERE project_id = p_project_id
        RETURNING * INTO v_limits;
    END IF;
    
    -- Check if blocked
    IF v_limits.is_blocked THEN
        RETURN QUERY SELECT false, 'Project is blocked due to usage limits'::TEXT,
            v_limits.monthly_used_usd, v_limits.monthly_budget_usd,
            v_limits.daily_used_usd, v_limits.daily_limit_usd;
        RETURN;
    END IF;
    
    -- Check monthly limit
    IF v_limits.block_at_limit AND 
       v_limits.monthly_used_usd + p_cost_usd > v_limits.monthly_budget_usd THEN
        RETURN QUERY SELECT false, 'Monthly budget exceeded'::TEXT,
            v_limits.monthly_used_usd, v_limits.monthly_budget_usd,
            v_limits.daily_used_usd, v_limits.daily_limit_usd;
        RETURN;
    END IF;
    
    -- Check daily limit
    IF v_limits.daily_limit_usd IS NOT NULL AND 
       v_limits.daily_used_usd + p_cost_usd > v_limits.daily_limit_usd THEN
        RETURN QUERY SELECT false, 'Daily limit exceeded'::TEXT,
            v_limits.monthly_used_usd, v_limits.monthly_budget_usd,
            v_limits.daily_used_usd, v_limits.daily_limit_usd;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT true, NULL::TEXT,
        v_limits.monthly_used_usd, v_limits.monthly_budget_usd,
        v_limits.daily_used_usd, v_limits.daily_limit_usd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage
CREATE OR REPLACE FUNCTION record_usage(
    p_project_id UUID,
    p_cost_usd DECIMAL
) RETURNS void AS $$
BEGIN
    -- Ensure limits record exists
    INSERT INTO project_usage_limits (project_id)
    VALUES (p_project_id)
    ON CONFLICT (project_id) DO NOTHING;
    
    -- Reset daily counter if new day
    UPDATE project_usage_limits 
    SET daily_used_usd = 0, last_daily_reset = CURRENT_DATE, requests_today = 0
    WHERE project_id = p_project_id AND last_daily_reset < CURRENT_DATE;
    
    -- Update usage
    UPDATE project_usage_limits 
    SET 
        monthly_used_usd = monthly_used_usd + p_cost_usd,
        daily_used_usd = daily_used_usd + p_cost_usd,
        requests_today = requests_today + 1,
        updated_at = now()
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage summary
CREATE OR REPLACE FUNCTION get_usage_summary(p_project_id UUID)
RETURNS TABLE(
    monthly_used DECIMAL,
    monthly_budget DECIMAL,
    monthly_percent INTEGER,
    daily_used DECIMAL,
    daily_limit DECIMAL,
    requests_today INTEGER,
    is_blocked BOOLEAN,
    days_until_reset INTEGER
) AS $$
DECLARE
    v_limits project_usage_limits%ROWTYPE;
    v_next_reset DATE;
BEGIN
    SELECT * INTO v_limits FROM project_usage_limits WHERE project_id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            0::DECIMAL, 50.00::DECIMAL, 0, 
            0::DECIMAL, NULL::DECIMAL, 0, 
            false, 0;
        RETURN;
    END IF;
    
    -- Calculate days until reset
    v_next_reset := date_trunc('month', CURRENT_DATE) + 
        (v_limits.budget_reset_day - 1 || ' days')::interval;
    IF v_next_reset <= CURRENT_DATE THEN
        v_next_reset := v_next_reset + '1 month'::interval;
    END IF;
    
    RETURN QUERY SELECT 
        v_limits.monthly_used_usd,
        v_limits.monthly_budget_usd,
        CASE 
            WHEN v_limits.monthly_budget_usd > 0 
            THEN (v_limits.monthly_used_usd / v_limits.monthly_budget_usd * 100)::INTEGER
            ELSE 0
        END,
        v_limits.daily_used_usd,
        v_limits.daily_limit_usd,
        v_limits.requests_today,
        v_limits.is_blocked,
        (v_next_reset - CURRENT_DATE)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-log system_config changes (only if table exists)
CREATE OR REPLACE FUNCTION trigger_log_system_config_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_config_change(
            'system', NEW.key, NULL,
            'create', NULL, NEW.value,
            NEW.updated_by, NULL,
            'Created system config: ' || NEW.key
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.value IS DISTINCT FROM NEW.value THEN
            PERFORM log_config_change(
                'system', NEW.key, NULL,
                'update', OLD.value, NEW.value,
                NEW.updated_by, NULL,
                'Updated system config: ' || NEW.key
            );
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_config_change(
            'system', OLD.key, NULL,
            'delete', OLD.value, NULL,
            auth.uid(), NULL,
            'Deleted system config: ' || OLD.key
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger only if system_config table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_config') THEN
        DROP TRIGGER IF EXISTS trg_system_config_audit ON system_config;
        CREATE TRIGGER trg_system_config_audit
            AFTER INSERT OR UPDATE OR DELETE ON system_config
            FOR EACH ROW EXECUTE FUNCTION trigger_log_system_config_change();
    END IF;
END $$;

-- Auto-log project_config changes
CREATE OR REPLACE FUNCTION trigger_log_project_config_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Log LLM config changes
        IF OLD.llm_config IS DISTINCT FROM NEW.llm_config THEN
            PERFORM log_config_change(
                'project', 'llm_config', NEW.project_id,
                'update', OLD.llm_config, NEW.llm_config,
                NEW.updated_by, NULL,
                'Updated LLM configuration'
            );
        END IF;
        
        -- Log LLM per-task changes
        IF OLD.llm_pertask IS DISTINCT FROM NEW.llm_pertask THEN
            PERFORM log_config_change(
                'project', 'llm_pertask', NEW.project_id,
                'update', OLD.llm_pertask, NEW.llm_pertask,
                NEW.updated_by, NULL,
                'Updated LLM per-task configuration'
            );
        END IF;
        
        -- Log graph config changes
        IF OLD.graph_config IS DISTINCT FROM NEW.graph_config THEN
            PERFORM log_config_change(
                'project', 'graph_config', NEW.project_id,
                'update', OLD.graph_config, NEW.graph_config,
                NEW.updated_by, NULL,
                'Updated graph database configuration'
            );
        END IF;
        
        -- Log processing settings changes
        IF OLD.processing_settings IS DISTINCT FROM NEW.processing_settings THEN
            PERFORM log_config_change(
                'project', 'processing_settings', NEW.project_id,
                'update', OLD.processing_settings, NEW.processing_settings,
                NEW.updated_by, NULL,
                'Updated processing settings'
            );
        END IF;
        
        -- Log prompts changes
        IF OLD.prompts IS DISTINCT FROM NEW.prompts THEN
            PERFORM log_config_change(
                'project', 'prompts', NEW.project_id,
                'update', OLD.prompts, NEW.prompts,
                NEW.updated_by, NULL,
                'Updated extraction prompts'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_project_config_audit
    AFTER UPDATE ON project_config
    FOR EACH ROW EXECUTE FUNCTION trigger_log_project_config_change();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE config_audit_log IS 'Audit trail for all configuration changes';
COMMENT ON TABLE project_usage_limits IS 'Usage limits and cost control per project';
COMMENT ON TABLE usage_alerts IS 'Track sent usage alert notifications';
COMMENT ON FUNCTION log_config_change IS 'Log a configuration change to the audit trail';
COMMENT ON FUNCTION check_usage_limit IS 'Check if a request is allowed based on usage limits';
COMMENT ON FUNCTION record_usage IS 'Record LLM usage cost for a project';
COMMENT ON FUNCTION get_usage_summary IS 'Get usage summary for a project';
