-- Add permissions column to project_members for granular access control
-- Permissions are stored as a JSONB array of permission strings

ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::JSONB;

-- Add index for querying permissions
CREATE INDEX IF NOT EXISTS idx_project_members_permissions 
ON project_members USING GIN (permissions);

-- Comment for documentation
COMMENT ON COLUMN project_members.permissions IS 'Array of permission strings for granular access control. Example: ["view:dashboard", "edit:contacts", "manage:team"]';

-- Update existing members with default permissions based on their role
UPDATE project_members 
SET permissions = CASE role
    WHEN 'viewer' THEN '["view:dashboard", "view:chat", "view:sot", "view:contacts", "view:documents", "view:emails", "view:team"]'::JSONB
    WHEN 'editor' THEN '["view:dashboard", "view:chat", "view:sot", "view:contacts", "view:documents", "view:emails", "view:team", "comment:sot", "comment:documents", "edit:questions", "edit:risks", "edit:actions", "edit:decisions", "edit:contacts", "edit:documents"]'::JSONB
    WHEN 'admin' THEN '["view:dashboard", "view:chat", "view:sot", "view:contacts", "view:documents", "view:emails", "view:team", "comment:sot", "comment:documents", "edit:questions", "edit:risks", "edit:actions", "edit:decisions", "edit:contacts", "edit:documents", "manage:team", "manage:roles", "manage:settings", "manage:integrations", "delete:data", "export:data"]'::JSONB
    WHEN 'owner' THEN '["view:dashboard", "view:chat", "view:sot", "view:contacts", "view:documents", "view:emails", "view:team", "comment:sot", "comment:documents", "edit:questions", "edit:risks", "edit:actions", "edit:decisions", "edit:contacts", "edit:documents", "manage:team", "manage:roles", "manage:settings", "manage:integrations", "delete:data", "export:data"]'::JSONB
    ELSE '["view:dashboard", "view:chat", "view:sot", "view:contacts", "view:documents", "view:emails", "view:team"]'::JSONB
END
WHERE permissions IS NULL OR permissions = '[]'::JSONB;
