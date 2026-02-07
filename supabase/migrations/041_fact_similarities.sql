-- ============================================================================
-- Migration 041: Fact Similarities (semantic/cache for dedup and "Similar facts")
-- Mirrors question_similarities: stores fact_id, similar_fact_id, similarity_score
-- ============================================================================

CREATE TABLE IF NOT EXISTS fact_similarities (
    fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
    similar_fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    computed_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (fact_id, similar_fact_id),

    CHECK (fact_id != similar_fact_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_similarities_score
    ON fact_similarities(fact_id, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_fact_similarities_similar
    ON fact_similarities(similar_fact_id) WHERE similar_fact_id IS NOT NULL;

-- RLS: access via fact's project
ALTER TABLE fact_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access fact similarities" ON fact_similarities;
CREATE POLICY "Members access fact similarities" ON fact_similarities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM facts f
        WHERE f.id = fact_similarities.fact_id
        AND is_project_member(f.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM facts f
        WHERE f.id = fact_similarities.fact_id
        AND is_project_member(f.project_id)
    )
);

COMMENT ON TABLE fact_similarities IS 'Cached similarity pairs for facts (dedup and Similar facts UI)';
