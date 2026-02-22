-- ============================================================================
-- Migration 105: Risk Similarities (cache for dedup and "Similar risks")
-- Mirrors fact_similarities pattern: risk_id, similar_risk_id, similarity_score
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_similarities (
    risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    similar_risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    computed_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (risk_id, similar_risk_id),

    CHECK (risk_id != similar_risk_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_similarities_score
    ON risk_similarities(risk_id, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_similarities_similar
    ON risk_similarities(similar_risk_id) WHERE similar_risk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_similarities_project
    ON risk_similarities(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE risk_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access risk similarities" ON risk_similarities;
CREATE POLICY "Members access risk similarities" ON risk_similarities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM risks r
        WHERE r.id = risk_similarities.risk_id
        AND is_project_member(r.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM risks r
        WHERE r.id = risk_similarities.risk_id
        AND is_project_member(r.project_id)
    )
);

COMMENT ON TABLE risk_similarities IS 'Cached similarity pairs for risks (dedup and Similar risks UI, used by graph SIMILAR_TO edges)';
