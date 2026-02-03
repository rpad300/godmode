-- ============================================================================
-- Migration 038: Fact Events (Timeline/Audit for Facts)
-- Mirrors question_events for Facts SOTA: created, verified, updated, conflict_detected
-- ============================================================================

CREATE TABLE IF NOT EXISTS fact_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE,

    -- Event type: created, verified, updated, conflict_detected
    event_type TEXT NOT NULL,

    -- Event-specific data (e.g. verified_by name, conflict summary)
    event_data JSONB DEFAULT '{}',

    -- Actor
    actor_user_id UUID REFERENCES auth.users(id),
    actor_name TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fact_events_fact
    ON fact_events(fact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_events_type
    ON fact_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fact_events_actor
    ON fact_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- RLS: same project as fact
ALTER TABLE fact_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access fact events" ON fact_events;
CREATE POLICY "Members access fact events" ON fact_events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM facts f
        WHERE f.id = fact_events.fact_id
        AND is_project_member(f.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM facts f
        WHERE f.id = fact_events.fact_id
        AND is_project_member(f.project_id)
    )
);

COMMENT ON TABLE fact_events IS 'Timeline/audit trail for facts (created, verified, updated, conflict_detected)';
