-- ============================================================================
-- Migration 085: Segregation – core RLS policies and graph_outbox fix
-- ============================================================================
-- Ensures:
-- 1) graph_outbox is only accessible by service_role (no anon/authenticated).
-- 2) user_profiles, projects, project_members, invites, activity_log have
--    the RLS policies from 001 (in case they were missing or dropped).
-- ============================================================================

-- ---------- 1) graph_outbox: restrict to service_role only ----------
DROP POLICY IF EXISTS "Service manages outbox" ON graph_outbox;
CREATE POLICY "Service manages outbox" ON graph_outbox
    FOR ALL TO service_role USING (true);

-- ---------- 2) user_profiles ----------
DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Superadmin reads all profiles" ON user_profiles;
CREATE POLICY "Superadmin reads all profiles" ON user_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

DROP POLICY IF EXISTS "Project members can see each other" ON user_profiles;
CREATE POLICY "Project members can see each other" ON user_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM project_members pm1 JOIN project_members pm2 ON pm1.project_id = pm2.project_id WHERE pm1.user_id = auth.uid() AND pm2.user_id = user_profiles.id));

-- ---------- 3) projects ----------
DROP POLICY IF EXISTS "Owners view projects" ON projects;
CREATE POLICY "Owners view projects" ON projects FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members view projects" ON projects;
CREATE POLICY "Members view projects" ON projects FOR SELECT USING (id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Superadmin views all projects" ON projects;
CREATE POLICY "Superadmin views all projects" ON projects FOR SELECT
    USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));

DROP POLICY IF EXISTS "Users create projects" ON projects;
CREATE POLICY "Users create projects" ON projects FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner updates project" ON projects;
CREATE POLICY "Owner updates project" ON projects FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner deletes project" ON projects;
CREATE POLICY "Owner deletes project" ON projects FOR DELETE USING (owner_id = auth.uid());

-- ---------- 4) project_members ----------
DROP POLICY IF EXISTS "Members view membership" ON project_members;
CREATE POLICY "Members view membership" ON project_members FOR SELECT
    USING (user_id = auth.uid() OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()) OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owner/Admin adds members" ON project_members;
CREATE POLICY "Owner/Admin adds members" ON project_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Owner/Admin updates members" ON project_members;
CREATE POLICY "Owner/Admin updates members" ON project_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Owner/Admin removes members" ON project_members;
CREATE POLICY "Owner/Admin removes members" ON project_members FOR DELETE USING (
    (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
     OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')))
    AND role != 'owner');

-- ---------- 5) invites ----------
DROP POLICY IF EXISTS "Owner/Admin views invites" ON invites;
CREATE POLICY "Owner/Admin views invites" ON invites FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = invites.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Owner/Admin creates invites" ON invites;
CREATE POLICY "Owner/Admin creates invites" ON invites FOR INSERT WITH CHECK (
    created_by = auth.uid() AND (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = invites.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))));

DROP POLICY IF EXISTS "Owner/Admin updates invites" ON invites;
CREATE POLICY "Owner/Admin updates invites" ON invites FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = invites.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')));

-- ---------- 6) activity_log ----------
DROP POLICY IF EXISTS "Authenticated users insert activity" ON activity_log;
CREATE POLICY "Authenticated users insert activity" ON activity_log FOR INSERT WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "Members view project activity" ON activity_log;
CREATE POLICY "Members view project activity" ON activity_log FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'superadmin'));
