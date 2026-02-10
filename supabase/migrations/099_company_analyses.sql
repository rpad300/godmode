-- Migration 099: Company analyses table (structured report for ontology/graph)
-- One row per company with full analysis report; replaces storing report in companies.brand_assets JSONB.

-- ============================================
-- COMPANY_ANALYSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    primary_color TEXT,
    secondary_color TEXT,
    ai_context TEXT,
    ficha_identidade TEXT,
    visao_geral TEXT,
    produtos_servicos TEXT,
    publico_alvo TEXT,
    equipa_lideranca TEXT,
    presenca_digital TEXT,
    analise_competitiva TEXT,
    indicadores_crescimento TEXT,
    swot TEXT,
    conclusoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_analyses_company ON company_analyses(company_id);
COMMENT ON TABLE company_analyses IS 'Structured company analysis reports (for ontology/graph sync); one row per company, latest only';

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_company_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_analyses_updated_at ON company_analyses;
CREATE TRIGGER trigger_company_analyses_updated_at
  BEFORE UPDATE ON company_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_company_analyses_updated_at();

-- ============================================
-- RLS: COMPANY_ANALYSES (same visibility as companies)
-- ============================================
ALTER TABLE company_analyses ENABLE ROW LEVEL SECURITY;

-- Owners can do everything on their company's analysis
CREATE POLICY "Owners manage own company analyses"
  ON company_analyses FOR ALL
  USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- Project members can read analysis of their project's company
CREATE POLICY "Project members read project company analysis"
  ON company_analyses FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM projects p
      WHERE EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  );

-- Superadmin can read all
CREATE POLICY "Superadmin reads company analyses"
  ON company_analyses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );
