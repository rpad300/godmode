-- ============================================
-- Migration 021: Link project members to contacts
-- ============================================
-- Adds linked_contact_id to project_members table
-- to associate team members with project contacts

-- Add linked_contact_id field to project_members
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS linked_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_members_linked_contact 
ON project_members(linked_contact_id) 
WHERE linked_contact_id IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN project_members.linked_contact_id IS 'Links team member to a contact record in the same project';
