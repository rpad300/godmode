-- Migration: Add user_role to project_members
-- This allows each member to have their own functional role per project
-- (distinct from access role which is owner/admin/write/read)

-- Add user_role columns to project_members
ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS user_role_prompt TEXT,
ADD COLUMN IF NOT EXISTS role_template_id TEXT REFERENCES role_templates(id);

-- Add index for filtering by user role
CREATE INDEX IF NOT EXISTS idx_project_members_user_role ON project_members(user_role);

-- Comments
COMMENT ON COLUMN project_members.user_role IS 'Functional role of the member (e.g., Project Manager, Developer)';
COMMENT ON COLUMN project_members.user_role_prompt IS 'Custom prompt for AI interactions based on role';
COMMENT ON COLUMN project_members.role_template_id IS 'Reference to a role template if using predefined role';
