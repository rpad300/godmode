-- Migration 098: Companies (perfil de empresa) and project-company association
-- Enables company profiles with logo, website, LinkedIn, brand_assets, and A4/PPT templates.
-- Projects must belong to a company (company_id NOT NULL).

-- ============================================
-- COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    linkedin_url TEXT,
    owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    brand_assets JSONB DEFAULT '{}'::jsonb,
    a4_template_html TEXT,
    ppt_template_html TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);
COMMENT ON TABLE companies IS 'User-created company profiles for branding and document templates';

-- ============================================
-- PROJECTS: add company_id (nullable first for backfill)
-- ============================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

-- ============================================
-- BACKFILL: one default company per project owner, assign to their projects
-- ============================================
DO $$
DECLARE
  r RECORD;
  new_company_id UUID;
  owner_display TEXT;
BEGIN
  FOR r IN SELECT DISTINCT owner_id FROM projects WHERE company_id IS NULL
  LOOP
    SELECT COALESCE(display_name, username, 'Utilizador') INTO owner_display
      FROM user_profiles WHERE id = r.owner_id LIMIT 1;
    INSERT INTO companies (id, name, owner_id)
    VALUES (uuid_generate_v4(), 'Empresa de ' || COALESCE(owner_display, 'Utilizador'), r.owner_id)
    RETURNING id INTO new_company_id;
    UPDATE projects SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
  END LOOP;
END $$;

-- Now enforce NOT NULL
ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);

-- ============================================
-- RLS: COMPANIES
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Owners can do everything on their companies
CREATE POLICY "Owners manage own companies"
  ON companies FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Project members can read company of projects they belong to (for documents/listings)
CREATE POLICY "Project members read project company"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM projects p
      WHERE EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  );

-- Superadmin can read all
CREATE POLICY "Superadmin reads companies"
  ON companies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ============================================
-- UPDATED_AT TRIGGER FOR COMPANIES
-- ============================================
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_companies_updated_at ON companies;
CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();
