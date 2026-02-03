-- ============================================
-- GodMode Phase 26: Document Versioning
-- Track document versions with diff and AI change summary
-- ============================================

-- ============================================
-- DOCUMENT VERSIONS
-- Store version history for documents
-- ============================================
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Version info
    version_number INTEGER NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    
    -- File info
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_hash TEXT,
    file_size BIGINT,
    mime_type TEXT,
    
    -- Content
    content TEXT,
    summary TEXT,
    extraction_result JSONB,
    
    -- User notes
    change_notes TEXT,
    
    -- Diff with previous version
    diff_stats JSONB,            -- {added_lines, removed_lines, changed_sections}
    content_diff TEXT,           -- Unified diff format
    
    -- AI-generated change summary
    ai_change_summary TEXT,
    entities_added JSONB,        -- New facts/decisions/etc
    entities_removed JSONB,      -- Removed entities
    entities_modified JSONB,     -- Modified entities
    
    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    
    -- Audit
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(document_id, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_project ON document_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_current ON document_versions(document_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_doc_versions_hash ON document_versions(file_hash);

-- ============================================
-- FUNCTION: Create New Version
-- ============================================
CREATE OR REPLACE FUNCTION create_document_version(
    p_document_id UUID,
    p_project_id UUID,
    p_filename TEXT,
    p_filepath TEXT,
    p_file_hash TEXT,
    p_file_size BIGINT,
    p_mime_type TEXT,
    p_change_notes TEXT,
    p_uploaded_by UUID
) RETURNS UUID AS $$
DECLARE
    v_version_number INTEGER;
    v_new_id UUID;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM document_versions
    WHERE document_id = p_document_id;
    
    -- Mark all other versions as not current
    UPDATE document_versions
    SET is_current = FALSE
    WHERE document_id = p_document_id;
    
    -- Create new version
    INSERT INTO document_versions (
        document_id, project_id, version_number, is_current,
        filename, filepath, file_hash, file_size, mime_type,
        change_notes, uploaded_by
    ) VALUES (
        p_document_id, p_project_id, v_version_number, TRUE,
        p_filename, p_filepath, p_file_hash, p_file_size, p_mime_type,
        p_change_notes, p_uploaded_by
    ) RETURNING id INTO v_new_id;
    
    -- Log activity
    INSERT INTO document_activity (document_id, project_id, user_id, action, details)
    VALUES (p_document_id, p_project_id, p_uploaded_by, 'version_uploaded', 
            jsonb_build_object('version', v_version_number, 'notes', p_change_notes));
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Restore Version
-- ============================================
CREATE OR REPLACE FUNCTION restore_document_version(
    p_version_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_doc_id UUID;
    v_project_id UUID;
    v_version_number INTEGER;
BEGIN
    -- Get version info
    SELECT document_id, project_id, version_number 
    INTO v_doc_id, v_project_id, v_version_number
    FROM document_versions
    WHERE id = p_version_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Mark all versions as not current
    UPDATE document_versions
    SET is_current = FALSE
    WHERE document_id = v_doc_id;
    
    -- Mark this version as current
    UPDATE document_versions
    SET is_current = TRUE
    WHERE id = p_version_id;
    
    -- Update main document with this version's content
    UPDATE documents
    SET 
        content = (SELECT content FROM document_versions WHERE id = p_version_id),
        summary = (SELECT summary FROM document_versions WHERE id = p_version_id),
        extraction_result = (SELECT extraction_result FROM document_versions WHERE id = p_version_id),
        updated_at = now()
    WHERE id = v_doc_id;
    
    -- Log activity
    INSERT INTO document_activity (document_id, project_id, user_id, action, details)
    VALUES (v_doc_id, v_project_id, p_user_id, 'restored', 
            jsonb_build_object('restored_version', v_version_number));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get Version Diff
-- ============================================
CREATE OR REPLACE FUNCTION get_version_diff(
    p_version_id UUID,
    p_compare_with_version_id UUID DEFAULT NULL
) RETURNS TABLE (
    version_a INTEGER,
    version_b INTEGER,
    diff_stats JSONB,
    content_diff TEXT,
    entities_diff JSONB
) AS $$
DECLARE
    v_doc_id UUID;
    v_version_a INTEGER;
    v_version_b INTEGER;
    v_compare_id UUID;
BEGIN
    -- Get version info
    SELECT document_id, version_number INTO v_doc_id, v_version_a
    FROM document_versions WHERE id = p_version_id;
    
    -- If no compare version specified, use previous
    IF p_compare_with_version_id IS NULL THEN
        SELECT id, version_number INTO v_compare_id, v_version_b
        FROM document_versions
        WHERE document_id = v_doc_id AND version_number < v_version_a
        ORDER BY version_number DESC
        LIMIT 1;
    ELSE
        SELECT id, version_number INTO v_compare_id, v_version_b
        FROM document_versions WHERE id = p_compare_with_version_id;
    END IF;
    
    -- Return diff data
    RETURN QUERY
    SELECT 
        v_version_a,
        v_version_b,
        dv.diff_stats,
        dv.content_diff,
        jsonb_build_object(
            'added', dv.entities_added,
            'removed', dv.entities_removed,
            'modified', dv.entities_modified
        ) AS entities_diff
    FROM document_versions dv
    WHERE dv.id = p_version_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access document_versions" ON document_versions FOR ALL
    USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE document_versions IS 'Version history for documents with diff tracking';
COMMENT ON COLUMN document_versions.version_number IS 'Sequential version number starting from 1';
COMMENT ON COLUMN document_versions.is_current IS 'Flag indicating the active version';
COMMENT ON COLUMN document_versions.diff_stats IS 'Statistics: lines added/removed/changed';
COMMENT ON COLUMN document_versions.content_diff IS 'Unified diff format content';
COMMENT ON COLUMN document_versions.ai_change_summary IS 'AI-generated summary of changes';
COMMENT ON COLUMN document_versions.entities_added IS 'New entities extracted in this version';
COMMENT ON COLUMN document_versions.entities_removed IS 'Entities no longer present';
COMMENT ON COLUMN document_versions.entities_modified IS 'Entities that changed between versions';
COMMENT ON FUNCTION create_document_version IS 'Create a new version of a document';
COMMENT ON FUNCTION restore_document_version IS 'Restore a previous version as current';
COMMENT ON FUNCTION get_version_diff IS 'Get diff between two versions';
