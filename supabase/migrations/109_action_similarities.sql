-- ============================================================================
-- Migration 109: Action Similarities (cache for dedup and "Similar actions")
-- Mirrors risk_similarities / fact_similarities pattern
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_similarities (
    action_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    similar_action_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    computed_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (action_id, similar_action_id),

    CHECK (action_id != similar_action_id)
);

CREATE INDEX IF NOT EXISTS idx_action_similarities_score
    ON action_similarities(action_id, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_action_similarities_similar
    ON action_similarities(similar_action_id) WHERE similar_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_similarities_project
    ON action_similarities(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE action_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access action similarities" ON action_similarities;
CREATE POLICY "Members access action similarities" ON action_similarities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM action_items a
        WHERE a.id = action_similarities.action_id
        AND is_project_member(a.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM action_items a
        WHERE a.id = action_similarities.action_id
        AND is_project_member(a.project_id)
    )
);

COMMENT ON TABLE action_similarities IS 'Cached similarity pairs for action items (dedup and Similar actions UI, used by graph SIMILAR_TO edges)';
