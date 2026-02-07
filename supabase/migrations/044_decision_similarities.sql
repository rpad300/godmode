-- ============================================================================
-- Migration 044: Decision Similarities (cache for dedup and "Similar decisions")
-- Mirrors fact_similarities: decision_id, similar_decision_id, similarity_score
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_similarities (
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    similar_decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    computed_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (decision_id, similar_decision_id),

    CHECK (decision_id != similar_decision_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_similarities_score
    ON decision_similarities(decision_id, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_decision_similarities_similar
    ON decision_similarities(similar_decision_id) WHERE similar_decision_id IS NOT NULL;

ALTER TABLE decision_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access decision similarities" ON decision_similarities;
CREATE POLICY "Members access decision similarities" ON decision_similarities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM decisions d
        WHERE d.id = decision_similarities.decision_id
        AND is_project_member(d.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM decisions d
        WHERE d.id = decision_similarities.decision_id
        AND is_project_member(d.project_id)
    )
);

COMMENT ON TABLE decision_similarities IS 'Cached similarity pairs for decisions (dedup and Similar decisions UI)';
