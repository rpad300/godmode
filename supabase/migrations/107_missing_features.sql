-- Migration 107: Missing features and infrastructure fixes
-- Addresses: sprint retrospectives persistence, weekly reports table,
-- updated_at triggers, user_stories columns, audit FK cascade fixes.

-- ============================================================================
-- 1. SPRINT RETROSPECTIVES TABLE
-- The POST /api/sprints/:id/retrospective endpoint was not persisting data.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sprint_retrospectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    went_well JSONB DEFAULT '[]'::jsonb,
    went_wrong JSONB DEFAULT '[]'::jsonb,
    action_items JSONB DEFAULT '[]'::jsonb,
    ai_suggestions TEXT,

    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sprint_retro_sprint
    ON sprint_retrospectives(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_retro_project
    ON sprint_retrospectives(project_id);

ALTER TABLE sprint_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage retrospectives" ON sprint_retrospectives
    FOR ALL
    USING (is_project_member(project_id))
    WITH CHECK (is_project_member(project_id));

DROP TRIGGER IF EXISTS sprint_retrospectives_updated_at ON sprint_retrospectives;
CREATE TRIGGER sprint_retrospectives_updated_at
    BEFORE UPDATE ON sprint_retrospectives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE sprint_retrospectives IS 'Persisted sprint retrospective data (team feedback + AI suggestions)';

-- ============================================================================
-- 2. WEEKLY REPORTS TABLE
-- Reports were ephemeral (generated on the fly, never saved).
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    week_key TEXT NOT NULL,
    report_markdown TEXT NOT NULL,
    summary TEXT,
    highlights JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    kpis JSONB DEFAULT '{}'::jsonb,
    sections JSONB DEFAULT '{}'::jsonb,
    report_html TEXT,

    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_project_week
    ON weekly_reports(project_id, week_key);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_project
    ON weekly_reports(project_id, generated_at DESC);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage weekly reports" ON weekly_reports
    FOR ALL
    USING (is_project_member(project_id))
    WITH CHECK (is_project_member(project_id));

DROP TRIGGER IF EXISTS weekly_reports_updated_at ON weekly_reports;
CREATE TRIGGER weekly_reports_updated_at
    BEFORE UPDATE ON weekly_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE weekly_reports IS 'Persisted weekly status reports with structured sections';
COMMENT ON COLUMN weekly_reports.week_key IS 'ISO week identifier, e.g. 2026-W08';

-- ============================================================================
-- 3. USER_STORIES: add priority, sprint_id, owner columns
-- Brings feature parity with action_items for sprint board views.
-- ============================================================================
ALTER TABLE user_stories
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low'));

ALTER TABLE user_stories
    ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

ALTER TABLE user_stories
    ADD COLUMN IF NOT EXISTS owner TEXT;

CREATE INDEX IF NOT EXISTS idx_user_stories_sprint
    ON user_stories(project_id, sprint_id) WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_stories_priority
    ON user_stories(project_id, priority) WHERE deleted_at IS NULL;

COMMENT ON COLUMN user_stories.priority IS 'Story priority: critical, high, medium, low';
COMMENT ON COLUMN user_stories.sprint_id IS 'Sprint this story belongs to (optional)';
COMMENT ON COLUMN user_stories.owner IS 'Person responsible for the story';

-- ============================================================================
-- 4. MISSING updated_at TRIGGERS
-- These tables have updated_at columns but no auto-update trigger.
-- Uses update_updated_at_column() defined in migration 005.
-- ============================================================================

-- sprints (092)
DROP TRIGGER IF EXISTS sprints_updated_at ON sprints;
CREATE TRIGGER sprints_updated_at
    BEFORE UPDATE ON sprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- categories (106)
DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- graph_views (106)
DROP TRIGGER IF EXISTS graph_views_updated_at ON graph_views;
CREATE TRIGGER graph_views_updated_at
    BEFORE UPDATE ON graph_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- relationships (005)
DROP TRIGGER IF EXISTS relationships_updated_at ON relationships;
CREATE TRIGGER relationships_updated_at
    BEFORE UPDATE ON relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- project_config (007)
DROP TRIGGER IF EXISTS project_config_updated_at ON project_config;
CREATE TRIGGER project_config_updated_at
    BEFORE UPDATE ON project_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- system_config (029)
DROP TRIGGER IF EXISTS system_config_updated_at ON system_config;
CREATE TRIGGER system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- secrets (029)
DROP TRIGGER IF EXISTS secrets_updated_at ON secrets;
CREATE TRIGGER secrets_updated_at
    BEFORE UPDATE ON secrets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- llm_cost_budgets (062)
DROP TRIGGER IF EXISTS llm_cost_budgets_updated_at ON llm_cost_budgets;
CREATE TRIGGER llm_cost_budgets_updated_at
    BEFORE UPDATE ON llm_cost_budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pricing_configs (069)
DROP TRIGGER IF EXISTS pricing_configs_updated_at ON pricing_configs;
CREATE TRIGGER pricing_configs_updated_at
    BEFORE UPDATE ON pricing_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pricing_tiers (069)
DROP TRIGGER IF EXISTS pricing_tiers_updated_at ON pricing_tiers;
CREATE TRIGGER pricing_tiers_updated_at
    BEFORE UPDATE ON pricing_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- project_period_usage (069)
DROP TRIGGER IF EXISTS project_period_usage_updated_at ON project_period_usage;
CREATE TRIGGER project_period_usage_updated_at
    BEFORE UPDATE ON project_period_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- project_usage_limits (030)
DROP TRIGGER IF EXISTS project_usage_limits_updated_at ON project_usage_limits;
CREATE TRIGGER project_usage_limits_updated_at
    BEFORE UPDATE ON project_usage_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- raw_content (101)
DROP TRIGGER IF EXISTS raw_content_updated_at ON raw_content;
CREATE TRIGGER raw_content_updated_at
    BEFORE UPDATE ON raw_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- synthesized_files (101)
DROP TRIGGER IF EXISTS synthesized_files_updated_at ON synthesized_files;
CREATE TRIGGER synthesized_files_updated_at
    BEFORE UPDATE ON synthesized_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. AUDIT/LOG TABLE FK CASCADE FIXES
-- Change from ON DELETE CASCADE to ON DELETE SET NULL so audit history
-- is preserved when the parent entity is deleted.
-- ============================================================================

-- ai_analysis_log.document_id: preserve analysis history when doc is deleted
ALTER TABLE ai_analysis_log
    DROP CONSTRAINT IF EXISTS ai_analysis_log_document_id_fkey;
ALTER TABLE ai_analysis_log
    ADD CONSTRAINT ai_analysis_log_document_id_fkey
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- config_audit_log.project_id: preserve audit trail when project is deleted
ALTER TABLE config_audit_log
    DROP CONSTRAINT IF EXISTS config_audit_log_project_id_fkey;
ALTER TABLE config_audit_log
    ADD CONSTRAINT config_audit_log_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- api_key_usage.api_key_id: preserve usage stats when key is revoked
ALTER TABLE api_key_usage
    DROP CONSTRAINT IF EXISTS api_key_usage_api_key_id_fkey;
ALTER TABLE api_key_usage
    ADD CONSTRAINT api_key_usage_api_key_id_fkey
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;

-- webhook_deliveries.webhook_id: preserve delivery history when webhook is deleted
ALTER TABLE webhook_deliveries
    DROP CONSTRAINT IF EXISTS webhook_deliveries_webhook_id_fkey;
ALTER TABLE webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_id_fkey
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. MISSING INDEXES for common query patterns
-- ============================================================================

-- Graph UI tables: user_id indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_graph_query_history_user_project
    ON graph_query_history(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_graph_bookmarks_user
    ON graph_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_chat_history_user
    ON graph_chat_history(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_user
    ON graph_snapshots(user_id, project_id);

-- sprints.created_by
CREATE INDEX IF NOT EXISTS idx_sprints_created_by
    ON sprints(created_by) WHERE created_by IS NOT NULL;

-- user_stories.created_by
CREATE INDEX IF NOT EXISTS idx_user_stories_created_by
    ON user_stories(created_by) WHERE created_by IS NOT NULL;
