-- ============================================
-- GodMode Phase 8: Optimizations Tables
-- Query history, feedback, cache, jobs, sync
-- ============================================

-- ============================================
-- QUERY HISTORY
-- Track user queries for suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    query_text TEXT NOT NULL,
    query_type TEXT CHECK (query_type IN ('search', 'chat', 'graph', 'rag', 'other')),
    
    -- Performance
    execution_time_ms INTEGER,
    result_count INTEGER,
    
    -- Context
    source TEXT,
    
    -- Audit
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_history_project ON query_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_user ON query_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_text_trgm ON query_history USING gin(query_text gin_trgm_ops);

-- ============================================
-- SAVED SEARCHES
-- User saved searches
-- ============================================
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    
    -- Filters
    type_filter TEXT,
    date_filter TEXT,
    owner_filter TEXT,
    
    -- Usage
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_project ON saved_searches(project_id);

-- ============================================
-- USER FEEDBACK
-- Feedback on AI results
-- ============================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'correction', 'suggestion')),
    feedback_text TEXT,
    
    -- For corrections
    original_value TEXT,
    corrected_value TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'applied', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    -- Audit
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_project ON user_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_entity ON user_feedback(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status) WHERE status = 'pending';

-- ============================================
-- CACHE ENTRIES
-- General purpose cache
-- ============================================
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    cache_key TEXT NOT NULL,
    cache_value JSONB NOT NULL,
    
    -- TTL
    expires_at TIMESTAMPTZ,
    
    -- Stats
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_project ON cache_entries(project_id);

-- Function to cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_entries WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED JOBS
-- Background job scheduling
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    job_type TEXT NOT NULL,
    job_name TEXT NOT NULL,
    job_config JSONB DEFAULT '{}',
    
    -- Scheduling
    schedule_cron TEXT,
    schedule_interval INTERVAL,
    
    -- Execution
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_result JSONB,
    last_error TEXT,
    
    -- Stats
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_duration_ms INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON scheduled_jobs(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_project ON scheduled_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON scheduled_jobs(job_type);

-- ============================================
-- SYNC STATES
-- Track synchronization state
-- ============================================
CREATE TABLE IF NOT EXISTS sync_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    sync_type TEXT NOT NULL,
    
    -- State
    last_sync_at TIMESTAMPTZ,
    last_sync_cursor TEXT,
    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'paused')),
    
    -- Error tracking
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    
    -- Stats
    items_synced INTEGER DEFAULT 0,
    items_pending INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, sync_type)
);

CREATE INDEX IF NOT EXISTS idx_sync_states_project ON sync_states(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_states_status ON sync_states(sync_status) WHERE sync_status != 'idle';

-- ============================================
-- USAGE ANALYTICS
-- Track feature usage
-- ============================================
CREATE TABLE IF NOT EXISTS usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Event info
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    
    -- Context
    source TEXT,
    user_agent TEXT,
    
    -- Audit
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_analytics(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_event ON usage_analytics(event_type, event_name);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_analytics(created_at DESC);

-- Partition by month for large-scale usage (optional)
-- CREATE INDEX IF NOT EXISTS idx_usage_month ON usage_analytics(date_trunc('month', created_at));

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access query_history" ON query_history FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Users access own saved_searches" ON saved_searches FOR ALL 
    USING (user_id = auth.uid() AND is_project_member(project_id));

CREATE POLICY "Members access user_feedback" ON user_feedback FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access cache_entries" ON cache_entries FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

CREATE POLICY "Admins access scheduled_jobs" ON scheduled_jobs FOR ALL 
    USING (
        project_id IS NULL 
        OR EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = scheduled_jobs.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access sync_states" ON sync_states FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = sync_states.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Members access usage_analytics" ON usage_analytics FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS cache_entries_updated_at ON cache_entries;
CREATE TRIGGER cache_entries_updated_at
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER scheduled_jobs_updated_at
    BEFORE UPDATE ON scheduled_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sync_states_updated_at ON sync_states;
CREATE TRIGGER sync_states_updated_at
    BEFORE UPDATE ON sync_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE query_history IS 'Track user queries for suggestions';
COMMENT ON TABLE saved_searches IS 'User saved searches';
COMMENT ON TABLE user_feedback IS 'Feedback on AI results';
COMMENT ON TABLE cache_entries IS 'General purpose cache with TTL';
COMMENT ON TABLE scheduled_jobs IS 'Background job scheduling';
COMMENT ON TABLE sync_states IS 'Track synchronization state';
COMMENT ON TABLE usage_analytics IS 'Track feature usage';
