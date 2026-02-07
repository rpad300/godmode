-- ============================================
-- GodMode Migration 060: Documents Performance & Security
-- Performance indexes and RLS improvements for documents
-- ============================================

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Index for listing documents sorted by created_at (most common query)
CREATE INDEX IF NOT EXISTS idx_documents_created_at 
ON documents(project_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for listing documents sorted by updated_at
CREATE INDEX IF NOT EXISTS idx_documents_updated_at 
ON documents(project_id, updated_at DESC) 
WHERE deleted_at IS NULL;

-- Index for status filtering (common filter)
CREATE INDEX IF NOT EXISTS idx_documents_status 
ON documents(project_id, status) 
WHERE deleted_at IS NULL;

-- Composite index for common query pattern (status + created_at)
CREATE INDEX IF NOT EXISTS idx_documents_status_created 
ON documents(project_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for doc_type filtering
CREATE INDEX IF NOT EXISTS idx_documents_doc_type 
ON documents(project_id, doc_type) 
WHERE deleted_at IS NULL;

-- Index for filename search (trigram for ILIKE)
CREATE INDEX IF NOT EXISTS idx_documents_filename_trgm 
ON documents USING gin (filename gin_trgm_ops);

-- ============================================
-- DOCUMENT VERSIONS RLS
-- ============================================

-- Enable RLS on document_versions if not already enabled
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Members access document_versions" ON document_versions;

-- Create policy for document versions access
CREATE POLICY "Members access document_versions" ON document_versions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN project_members pm ON pm.project_id = d.project_id
            WHERE d.id = document_versions.document_id
            AND pm.user_id = auth.uid()
        )
    );

-- ============================================
-- DOCUMENT SHARES RLS
-- ============================================

-- Enable RLS on document_shares if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_shares') THEN
        ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policy if exists
        DROP POLICY IF EXISTS "Members manage document_shares" ON document_shares;
        
        -- Create policy for document shares
        CREATE POLICY "Members manage document_shares" ON document_shares FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM documents d
                    JOIN project_members pm ON pm.project_id = d.project_id
                    WHERE d.id = document_shares.document_id
                    AND pm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================
-- AI ANALYSIS LOG RLS FIX
-- ============================================

-- Drop existing policy if the USING clause is wrong
DROP POLICY IF EXISTS "Members access ai_analysis_log" ON ai_analysis_log;

-- Recreate with proper is_project_member check
CREATE POLICY "Members access ai_analysis_log" ON ai_analysis_log FOR ALL
    USING (is_project_member(project_id));

-- ============================================
-- DOCUMENT ACTIVITY INDEX
-- ============================================

-- Index for activity by document
CREATE INDEX IF NOT EXISTS idx_document_activity_doc_created 
ON document_activity(document_id, created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON INDEX idx_documents_created_at IS 'Optimizes listing documents sorted by creation date';
COMMENT ON INDEX idx_documents_updated_at IS 'Optimizes listing documents sorted by update date';
COMMENT ON INDEX idx_documents_status IS 'Optimizes filtering by status';
COMMENT ON INDEX idx_documents_status_created IS 'Optimizes combined status filter + date sort';
COMMENT ON INDEX idx_documents_doc_type IS 'Optimizes filtering by document type';
