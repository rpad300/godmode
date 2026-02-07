-- ============================================================================
-- Migration 055: Ontology Audit Trail
-- ============================================================================
-- Creates table for tracking all ontology schema changes
-- Enables full history and rollback capabilities
-- ============================================================================

-- Ontology change history table
CREATE TABLE IF NOT EXISTS ontology_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN (
        'entity_added', 'entity_modified', 'entity_removed',
        'relation_added', 'relation_modified', 'relation_removed',
        'pattern_added', 'pattern_modified', 'pattern_removed',
        'rule_added', 'rule_modified', 'rule_removed',
        'version_bump', 'schema_import', 'schema_export', 'schema_sync'
    )),
    target_type TEXT CHECK (target_type IN ('entity', 'relation', 'query_pattern', 'inference_rule', 'schema')),
    target_name TEXT,
    old_definition JSONB,
    new_definition JSONB,
    diff JSONB, -- Field-level changes
    reason TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto_approve', 'llm_suggestion', 'migration', 'api', 'sync')),
    suggestion_id UUID REFERENCES ontology_suggestions(id) ON DELETE SET NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ontology_changes_project ON ontology_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_ontology_changes_target ON ontology_changes(target_type, target_name);
CREATE INDEX IF NOT EXISTS idx_ontology_changes_date ON ontology_changes(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ontology_changes_type ON ontology_changes(change_type);

-- Enable RLS
ALTER TABLE ontology_changes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-runnable migration)
DROP POLICY IF EXISTS ontology_changes_read ON ontology_changes;
DROP POLICY IF EXISTS ontology_changes_service ON ontology_changes;

-- Policy: Users can read changes for their projects or global changes
CREATE POLICY ontology_changes_read ON ontology_changes
    FOR SELECT USING (
        project_id IS NULL 
        OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );

-- Policy: Service role can do everything
CREATE POLICY ontology_changes_service ON ontology_changes
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Function to log ontology changes with automatic diff calculation
CREATE OR REPLACE FUNCTION log_ontology_change(
    p_project_id UUID,
    p_change_type TEXT,
    p_target_type TEXT,
    p_target_name TEXT,
    p_old_definition JSONB,
    p_new_definition JSONB,
    p_reason TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'manual',
    p_suggestion_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_diff JSONB;
    v_added JSONB;
    v_removed JSONB;
    v_modified JSONB;
BEGIN
    -- Calculate diff if both old and new definitions exist
    IF p_old_definition IS NOT NULL AND p_new_definition IS NOT NULL THEN
        -- Find added keys
        SELECT jsonb_object_agg(key, value) INTO v_added
        FROM jsonb_each(p_new_definition) 
        WHERE NOT p_old_definition ? key;
        
        -- Find removed keys
        SELECT jsonb_object_agg(key, value) INTO v_removed
        FROM jsonb_each(p_old_definition) 
        WHERE NOT p_new_definition ? key;
        
        -- Find modified keys
        SELECT jsonb_object_agg(
            key, 
            jsonb_build_object('old', p_old_definition->key, 'new', value)
        ) INTO v_modified
        FROM jsonb_each(p_new_definition)
        WHERE p_old_definition ? key 
          AND p_old_definition->key IS DISTINCT FROM value;
        
        v_diff = jsonb_build_object(
            'added', COALESCE(v_added, '{}'::jsonb),
            'removed', COALESCE(v_removed, '{}'::jsonb),
            'modified', COALESCE(v_modified, '{}'::jsonb)
        );
    ELSIF p_new_definition IS NOT NULL THEN
        -- New item - all fields are "added"
        v_diff = jsonb_build_object('added', p_new_definition, 'removed', '{}'::jsonb, 'modified', '{}'::jsonb);
    ELSIF p_old_definition IS NOT NULL THEN
        -- Deleted item - all fields are "removed"
        v_diff = jsonb_build_object('added', '{}'::jsonb, 'removed', p_old_definition, 'modified', '{}'::jsonb);
    END IF;
    
    INSERT INTO ontology_changes (
        project_id, change_type, target_type, target_name,
        old_definition, new_definition, diff, reason, source, suggestion_id, changed_by
    )
    VALUES (
        p_project_id, p_change_type, p_target_type, p_target_name,
        p_old_definition, p_new_definition, v_diff, p_reason, p_source, p_suggestion_id, auth.uid()
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Function to get ontology change summary
CREATE OR REPLACE FUNCTION get_ontology_change_summary(
    p_project_id UUID DEFAULT NULL,
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    change_type TEXT,
    target_type TEXT,
    change_count BIGINT,
    last_change TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oc.change_type,
        oc.target_type,
        count(*) as change_count,
        max(oc.changed_at) as last_change
    FROM ontology_changes oc
    WHERE 
        (p_project_id IS NULL OR oc.project_id IS NULL OR oc.project_id = p_project_id)
        AND oc.changed_at > now() - (p_days || ' days')::interval
    GROUP BY oc.change_type, oc.target_type
    ORDER BY change_count DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION log_ontology_change TO authenticated;
GRANT EXECUTE ON FUNCTION log_ontology_change TO service_role;
GRANT EXECUTE ON FUNCTION get_ontology_change_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_ontology_change_summary TO service_role;

-- Add comments
COMMENT ON TABLE ontology_changes IS 'Audit trail for all ontology schema changes';
COMMENT ON FUNCTION log_ontology_change IS 'Logs an ontology change with automatic diff calculation';
COMMENT ON FUNCTION get_ontology_change_summary IS 'Returns summary of ontology changes over time';
