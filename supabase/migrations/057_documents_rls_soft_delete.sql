-- ============================================
-- Migration 057: Fix Documents RLS Policy for Soft Delete
-- Ensures soft-deleted documents are not accessible via RLS
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Members access documents" ON documents;

-- Create new policy that excludes soft-deleted documents
CREATE POLICY "Members access documents" ON documents FOR ALL 
    USING (is_project_member(project_id) AND deleted_at IS NULL);

-- Also add policy for admins to see deleted documents (for recovery)
DROP POLICY IF EXISTS "Admins access all documents" ON documents;
CREATE POLICY "Admins access all documents" ON documents FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = documents.project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'admin')
        )
    );

-- Add index to improve soft-delete query performance
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at 
    ON documents(project_id, deleted_at) 
    WHERE deleted_at IS NOT NULL;

-- Add comment
COMMENT ON POLICY "Members access documents" ON documents IS 
    'Members can access non-deleted documents in their projects';
COMMENT ON POLICY "Admins access all documents" ON documents IS 
    'Admins can access all documents including soft-deleted ones for recovery';
