-- ============================================
-- GodMode Phase 11: Sync and Delete Tables
-- Delete tracking, audit, backups, retention
-- ============================================

-- ============================================
-- DELETE STATS
-- Track deletion statistics
-- ============================================
CREATE TABLE IF NOT EXISTS delete_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    
    -- Counts
    total_deleted INTEGER DEFAULT 0,
    total_restored INTEGER DEFAULT 0,
    total_purged INTEGER DEFAULT 0,
    
    -- Timestamps
    last_delete_at TIMESTAMPTZ,
    last_restore_at TIMESTAMPTZ,
    last_purge_at TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_delete_stats_project ON delete_stats(project_id);

-- ============================================
-- DELETE AUDIT LOG
-- Audit trail for delete operations
-- ============================================
CREATE TABLE IF NOT EXISTS delete_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    action TEXT NOT NULL CHECK (action IN ('delete', 'soft_delete', 'restore', 'purge', 'cascade_delete')),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Snapshot of deleted data
    entity_snapshot JSONB,
    
    -- Cascade info
    cascade_count INTEGER DEFAULT 0,
    cascaded_entities JSONB,
    
    -- Context
    reason TEXT,
    
    -- Audit
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT now(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_delete_audit_project ON delete_audit_log(project_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_delete_audit_entity ON delete_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_delete_audit_action ON delete_audit_log(action);

-- ============================================
-- DELETE BACKUPS
-- Backups before deletion for recovery
-- ============================================
CREATE TABLE IF NOT EXISTS delete_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    backup_data JSONB NOT NULL,
    
    -- Related entities backup
    related_data JSONB,
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Restoration
    restored BOOLEAN DEFAULT FALSE,
    restored_at TIMESTAMPTZ,
    restored_by UUID REFERENCES auth.users(id),
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delete_backups_project ON delete_backups(project_id);
CREATE INDEX IF NOT EXISTS idx_delete_backups_entity ON delete_backups(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_delete_backups_expires ON delete_backups(expires_at) WHERE restored = FALSE;
CREATE INDEX IF NOT EXISTS idx_delete_backups_unrestored ON delete_backups(project_id, created_at DESC) WHERE restored = FALSE;

-- ============================================
-- RETENTION POLICIES
-- Define data retention rules
-- ============================================
CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    policy_name TEXT NOT NULL,
    policy_description TEXT,
    
    -- Target
    entity_type TEXT NOT NULL,
    
    -- Retention rules
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    
    -- Conditions (JSONB for flexibility)
    conditions JSONB DEFAULT '{}',
    
    -- Actions
    action_on_expire TEXT DEFAULT 'soft_delete' CHECK (action_on_expire IN ('soft_delete', 'purge', 'archive', 'notify')),
    
    -- Execution
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    items_affected INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, policy_name)
);

CREATE INDEX IF NOT EXISTS idx_retention_project ON retention_policies(project_id);
CREATE INDEX IF NOT EXISTS idx_retention_active ON retention_policies(next_run_at) WHERE is_active = TRUE;

-- ============================================
-- SOFT DELETES
-- Track soft-deleted items
-- ============================================
CREATE TABLE IF NOT EXISTS soft_deletes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_data JSONB NOT NULL,
    
    -- Deletion info
    deleted_by UUID REFERENCES auth.users(id),
    deleted_at TIMESTAMPTZ DEFAULT now(),
    delete_reason TEXT,
    
    -- Restoration deadline
    restore_deadline TIMESTAMPTZ,
    
    -- Purge tracking
    purged BOOLEAN DEFAULT FALSE,
    purged_at TIMESTAMPTZ,
    purged_by UUID REFERENCES auth.users(id),
    
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_soft_deletes_project ON soft_deletes(project_id);
CREATE INDEX IF NOT EXISTS idx_soft_deletes_entity ON soft_deletes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_soft_deletes_deadline ON soft_deletes(restore_deadline) WHERE purged = FALSE;
CREATE INDEX IF NOT EXISTS idx_soft_deletes_unpurged ON soft_deletes(project_id, deleted_at DESC) WHERE purged = FALSE;

-- ============================================
-- ARCHIVE
-- Long-term archive of deleted data
-- ============================================
CREATE TABLE IF NOT EXISTS archive (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_data JSONB NOT NULL,
    
    -- Archive info
    archived_from TEXT,
    archived_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    archived_by UUID REFERENCES auth.users(id),
    archived_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_project ON archive(project_id);
CREATE INDEX IF NOT EXISTS idx_archive_entity ON archive(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_archive_date ON archive(archived_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to record delete stats
CREATE OR REPLACE FUNCTION update_delete_stats(
    p_project_id UUID,
    p_entity_type TEXT,
    p_action TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO delete_stats (project_id, entity_type)
    VALUES (p_project_id, p_entity_type)
    ON CONFLICT (project_id, entity_type) DO NOTHING;
    
    IF p_action = 'delete' OR p_action = 'soft_delete' THEN
        UPDATE delete_stats 
        SET total_deleted = total_deleted + 1, last_delete_at = now(), updated_at = now()
        WHERE project_id = p_project_id AND entity_type = p_entity_type;
    ELSIF p_action = 'restore' THEN
        UPDATE delete_stats 
        SET total_restored = total_restored + 1, last_restore_at = now(), updated_at = now()
        WHERE project_id = p_project_id AND entity_type = p_entity_type;
    ELSIF p_action = 'purge' THEN
        UPDATE delete_stats 
        SET total_purged = total_purged + 1, last_purge_at = now(), updated_at = now()
        WHERE project_id = p_project_id AND entity_type = p_entity_type;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired backups
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM delete_backups 
    WHERE expires_at < now() AND restored = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired soft deletes
CREATE OR REPLACE FUNCTION cleanup_expired_soft_deletes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE soft_deletes 
    SET purged = TRUE, purged_at = now()
    WHERE restore_deadline < now() AND purged = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE delete_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE delete_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE delete_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE soft_deletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins access delete_stats" ON delete_stats FOR ALL 
    USING (
        project_id IS NULL
        OR EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = delete_stats.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access delete_audit_log" ON delete_audit_log FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = delete_audit_log.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access delete_backups" ON delete_backups FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = delete_backups.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access retention_policies" ON retention_policies FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = retention_policies.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access soft_deletes" ON soft_deletes FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = soft_deletes.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access archive" ON archive FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = archive.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS retention_policies_updated_at ON retention_policies;
CREATE TRIGGER retention_policies_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE delete_stats IS 'Track deletion statistics';
COMMENT ON TABLE delete_audit_log IS 'Audit trail for delete operations';
COMMENT ON TABLE delete_backups IS 'Backups before deletion for recovery';
COMMENT ON TABLE retention_policies IS 'Define data retention rules';
COMMENT ON TABLE soft_deletes IS 'Track soft-deleted items';
COMMENT ON TABLE archive IS 'Long-term archive of deleted data';
COMMENT ON FUNCTION update_delete_stats IS 'Record delete stats updates';
COMMENT ON FUNCTION cleanup_expired_backups IS 'Cleanup expired backup records';
COMMENT ON FUNCTION cleanup_expired_soft_deletes IS 'Purge expired soft deletes';
