-- Migration: Restructure contacts for global access and N:N relationships
-- A contact can belong to multiple projects and multiple teams

-- ============================================================
-- 1. Create contact_projects table (N:N relationship)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(100),                    -- Role in this specific project
    is_primary BOOLEAN DEFAULT false,     -- Primary project for this contact
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID REFERENCES auth.users(id),
    notes TEXT,
    UNIQUE(contact_id, project_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_contact_projects_contact ON contact_projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_projects_project ON contact_projects(project_id);

-- ============================================================
-- 2. Make contacts.project_id nullable (global contacts)
-- ============================================================
ALTER TABLE contacts ALTER COLUMN project_id DROP NOT NULL;

-- ============================================================
-- 3. Migrate existing contacts to contact_projects
-- ============================================================
INSERT INTO contact_projects (contact_id, project_id, is_primary, added_at)
SELECT id, project_id, true, created_at
FROM contacts
WHERE project_id IS NOT NULL
ON CONFLICT (contact_id, project_id) DO NOTHING;

-- ============================================================
-- 4. Add role field to team_members if not exists
-- ============================================================
-- Already exists from schema check

-- ============================================================
-- 5. Enable RLS on contact_projects
-- ============================================================
ALTER TABLE contact_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see contact_projects for projects they have access to
CREATE POLICY "Users can view contact_projects for their projects"
ON contact_projects FOR SELECT
USING (
    project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM projects WHERE id = contact_projects.project_id AND owner_id = auth.uid()
    )
);

-- Policy: Users can manage contact_projects for projects they own or are members of
CREATE POLICY "Users can manage contact_projects"
ON contact_projects FOR ALL
USING (
    project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM projects WHERE id = contact_projects.project_id AND owner_id = auth.uid()
    )
);

-- ============================================================
-- 6. Comments
-- ============================================================
COMMENT ON TABLE contact_projects IS 'Many-to-many relationship between contacts and projects';
COMMENT ON COLUMN contact_projects.is_primary IS 'If true, this is the main project for this contact';
COMMENT ON COLUMN contact_projects.role IS 'Role of the contact in this specific project (can differ from global role)';

-- ============================================================
-- 7. Grant access to service role
-- ============================================================
GRANT ALL ON contact_projects TO service_role;
GRANT ALL ON contact_projects TO authenticated;
