-- ============================================================================
-- Migration 042: Decisions SOTA (events, schema extensions, generation_source, view)
-- Parity with Facts: decision_events, rationale/made_by/approved_by, generation_source, view
-- ============================================================================

-- ============================================================================
-- SECTION 1: DECISION EVENTS (Timeline/Audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',

    actor_user_id UUID REFERENCES auth.users(id),
    actor_name TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_events_decision
    ON decision_events(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_events_type
    ON decision_events(event_type);

ALTER TABLE decision_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access decision events" ON decision_events;
CREATE POLICY "Members access decision events" ON decision_events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM decisions d
        WHERE d.id = decision_events.decision_id
        AND is_project_member(d.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM decisions d
        WHERE d.id = decision_events.decision_id
        AND is_project_member(d.project_id)
    )
);

COMMENT ON TABLE decision_events IS 'Timeline/audit for decisions (created, updated, conflict_detected, deleted, restored)';

-- ============================================================================
-- SECTION 2: EXTEND decisions TABLE (rationale, made_by, approved_by, impact, etc.)
-- ============================================================================

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS rationale TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS made_by TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS impact TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS reversible BOOLEAN;

ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_status_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_status_check
CHECK (status IS NULL OR status IN (
    'active', 'superseded', 'revoked',
    'proposed', 'approved', 'rejected', 'deferred'
));

COMMENT ON COLUMN decisions.rationale IS 'Why the decision was made (context remains for legacy)';
COMMENT ON COLUMN decisions.made_by IS 'Who made the decision';
COMMENT ON COLUMN decisions.approved_by IS 'Who approved (if applicable)';
COMMENT ON COLUMN decisions.decided_at IS 'When the decision was made/approved';
COMMENT ON COLUMN decisions.impact IS 'low, medium, high';
COMMENT ON COLUMN decisions.reversible IS 'Whether the decision can be reversed';

-- ============================================================================
-- SECTION 3: GENERATION SOURCE
-- ============================================================================

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS generation_source TEXT;

COMMENT ON COLUMN decisions.generation_source IS 'How the decision was created: extracted, quick_capture, manual, import';

ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_generation_source_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_generation_source_check
CHECK (generation_source IS NULL OR generation_source IN ('extracted', 'quick_capture', 'manual', 'import'));

CREATE INDEX IF NOT EXISTS idx_decisions_generation_source
ON decisions(project_id, generation_source) WHERE deleted_at IS NULL AND generation_source IS NOT NULL;

-- ============================================================================
-- SECTION 4: VIEW decisions_by_status (reporting)
-- ============================================================================

CREATE OR REPLACE VIEW decisions_by_status AS
SELECT
    project_id,
    status,
    COUNT(*) AS total_count,
    MAX(decided_at) AS latest_decided_at
FROM decisions
WHERE deleted_at IS NULL
GROUP BY project_id, status
ORDER BY project_id, total_count DESC;

COMMENT ON VIEW decisions_by_status IS 'Decisions aggregated by status for reporting';
