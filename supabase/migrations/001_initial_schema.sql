-- ============================================
-- GodMode Initial Schema
-- Phase 1: User Profiles, Projects, Members
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- USER PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'superadmin')),
    preferences JSONB DEFAULT '{"theme": "system", "locale": "pt"}'::jsonb,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for username lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES user_profiles(id),
    settings JSONB DEFAULT '{}'::jsonb,
    legacy_id TEXT, -- For migration from JSON files
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_legacy_id ON projects(legacy_id);

-- ============================================
-- PROJECT MEMBERS (RBAC)
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'write', 'read')),
    invited_by UUID REFERENCES user_profiles(id),
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- Index for user's projects
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- ============================================
-- INVITES (Secure invitation system)
-- ============================================
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- SHA256 of token, NEVER store plain token
    email TEXT, -- Optional: bind to specific email
    role TEXT NOT NULL CHECK (role IN ('admin', 'write', 'read')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
    accepted_by UUID REFERENCES user_profiles(id),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for token lookup (pending only)
CREATE INDEX IF NOT EXISTS idx_invites_token_pending ON invites(token_hash) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invites_project ON invites(project_id);

-- ============================================
-- ACTIVITY LOG (Append-only audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    actor_id UUID NOT NULL REFERENCES user_profiles(id),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for project activity
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users read own profile"
    ON user_profiles FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile"
    ON user_profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Superadmin can read all profiles
CREATE POLICY "Superadmin reads all profiles"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.role = 'superadmin'
        )
    );

-- Users can read profiles of project members (for display names, avatars)
CREATE POLICY "Project members can see each other"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm1
            JOIN project_members pm2 ON pm1.project_id = pm2.project_id
            WHERE pm1.user_id = auth.uid() AND pm2.user_id = user_profiles.id
        )
    );

-- ============================================
-- PROJECTS POLICIES
-- ============================================

-- Users can see projects they own
CREATE POLICY "Owners view projects"
    ON projects FOR SELECT
    USING (owner_id = auth.uid());

-- Users can see projects they are members of
CREATE POLICY "Members view projects"
    ON projects FOR SELECT
    USING (
        id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );

-- Superadmin can see all projects
CREATE POLICY "Superadmin views all projects"
    ON projects FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.role = 'superadmin'
        )
    );

-- Users can create projects (they become owner)
CREATE POLICY "Users create projects"
    ON projects FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Only owner can update project
CREATE POLICY "Owner updates project"
    ON projects FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Only owner can delete project
CREATE POLICY "Owner deletes project"
    ON projects FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================
-- PROJECT MEMBERS POLICIES
-- ============================================

-- Members can see project membership
CREATE POLICY "Members view membership"
    ON project_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
        OR project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- Owner/Admin can add members
CREATE POLICY "Owner/Admin adds members"
    ON project_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = project_members.project_id 
            AND pm.user_id = auth.uid() 
            AND pm.role IN ('owner', 'admin')
        )
    );

-- Owner/Admin can update member roles
CREATE POLICY "Owner/Admin updates members"
    ON project_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = project_members.project_id 
            AND pm.user_id = auth.uid() 
            AND pm.role IN ('owner', 'admin')
        )
    );

-- Owner/Admin can remove members (but not owner)
CREATE POLICY "Owner/Admin removes members"
    ON project_members FOR DELETE
    USING (
        (
            EXISTS (
                SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM project_members pm 
                WHERE pm.project_id = project_members.project_id 
                AND pm.user_id = auth.uid() 
                AND pm.role IN ('owner', 'admin')
            )
        )
        AND role != 'owner' -- Cannot remove owner
    );

-- ============================================
-- INVITES POLICIES
-- ============================================

-- Owner/Admin can view invites
CREATE POLICY "Owner/Admin views invites"
    ON invites FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = invites.project_id 
            AND pm.user_id = auth.uid() 
            AND pm.role IN ('owner', 'admin')
        )
    );

-- Owner/Admin can create invites
CREATE POLICY "Owner/Admin creates invites"
    ON invites FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM project_members pm 
                WHERE pm.project_id = invites.project_id 
                AND pm.user_id = auth.uid() 
                AND pm.role IN ('owner', 'admin')
            )
        )
    );

-- Owner/Admin can update invites (revoke)
CREATE POLICY "Owner/Admin updates invites"
    ON invites FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = invites.project_id 
            AND pm.user_id = auth.uid() 
            AND pm.role IN ('owner', 'admin')
        )
    );

-- ============================================
-- ACTIVITY LOG POLICIES (Append-only)
-- ============================================

-- Anyone authenticated can insert activity
CREATE POLICY "Authenticated users insert activity"
    ON activity_log FOR INSERT
    WITH CHECK (actor_id = auth.uid());

-- Members can view project activity
CREATE POLICY "Members view project activity"
    ON activity_log FOR SELECT
    USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
        OR project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.role = 'superadmin'
        )
    );

-- NO UPDATE/DELETE policies for activity_log = immutable

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, username, display_name, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to add owner as member when project created
CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.owner_id, 'owner', now())
    ON CONFLICT (project_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new project
DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION handle_new_project();

-- ============================================
-- MAKE FIRST USER SUPERADMIN
-- Run this manually after first signup:
-- UPDATE user_profiles SET role = 'superadmin' WHERE id = '<user-id>';
-- ============================================

COMMENT ON TABLE user_profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE projects IS 'Projects owned by users';
COMMENT ON TABLE project_members IS 'Project membership with RBAC roles';
COMMENT ON TABLE invites IS 'Secure project invitations';
COMMENT ON TABLE activity_log IS 'Immutable audit trail of actions';
