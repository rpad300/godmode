-- ============================================================================
-- Migration 050: Action events (timeline/audit for action_items)
-- Mirrors risk_events for Actions SOTA parity
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,

    -- Event type: created, updated, deleted, restored
    event_type TEXT NOT NULL,

    -- Event-specific data (e.g. field changes)
    event_data JSONB DEFAULT '{}',

    -- Actor
    actor_user_id UUID REFERENCES auth.users(id),
    actor_name TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_events_action
    ON action_events(action_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_events_type
    ON action_events(event_type);
CREATE INDEX IF NOT EXISTS idx_action_events_actor
    ON action_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

ALTER TABLE action_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access action events" ON action_events;
CREATE POLICY "Members access action events" ON action_events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM action_items a
        WHERE a.id = action_events.action_id
        AND is_project_member(a.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM action_items a
        WHERE a.id = action_events.action_id
        AND is_project_member(a.project_id)
    )
);

COMMENT ON TABLE action_events IS 'Timeline/audit trail for action items (created, updated, deleted, restored)';
