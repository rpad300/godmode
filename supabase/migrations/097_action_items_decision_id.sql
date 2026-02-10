-- Migration 097: Link action_items (tasks) to decisions
-- Enables traceability: "this task implements / is driven by this decision"

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_items_decision_id
  ON action_items(project_id, decision_id) WHERE deleted_at IS NULL AND decision_id IS NOT NULL;

COMMENT ON COLUMN action_items.decision_id IS 'Optional decision this task implements or is driven by';
