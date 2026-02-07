-- ============================================================================
-- Migration 046: Risks SOTA (Timeline/audit + generation_source)
-- Mirrors fact_events / decision_events for Risks SOTA parity
-- ============================================================================

-- risk_events: timeline/audit for risks (created, updated, deleted, restored)
CREATE TABLE IF NOT EXISTS risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,

    -- Event type: created, updated, deleted, restored
    event_type TEXT NOT NULL,

    -- Event-specific data (e.g. field changes)
    event_data JSONB DEFAULT '{}',

    -- Actor
    actor_user_id UUID REFERENCES auth.users(id),
    actor_name TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_risk
    ON risk_events(risk_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_type
    ON risk_events(event_type);
CREATE INDEX IF NOT EXISTS idx_risk_events_actor
    ON risk_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- RLS: same project as risk
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access risk events" ON risk_events;
CREATE POLICY "Members access risk events" ON risk_events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM risks r
        WHERE r.id = risk_events.risk_id
        AND is_project_member(r.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM risks r
        WHERE r.id = risk_events.risk_id
        AND is_project_member(r.project_id)
    )
);

COMMENT ON TABLE risk_events IS 'Timeline/audit trail for risks (created, updated, deleted, restored)';

-- Add generation_source to risks (extracted | quick_capture | manual | import)
ALTER TABLE risks
    ADD COLUMN IF NOT EXISTS generation_source TEXT
    CHECK (generation_source IS NULL OR generation_source IN ('extracted', 'quick_capture', 'manual', 'import'));

COMMENT ON COLUMN risks.generation_source IS 'How the risk was created: extracted, quick_capture, manual, import';
