-- Migration 088: DevOps Sprint Board task structure for action_items
-- Adds: parent story ref, size estimate, description, definition of done, acceptance criteria.
-- Rule "only one Active (in_progress) per assignee" is enforced in application logic.

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS parent_story_ref TEXT,
  ADD COLUMN IF NOT EXISTS size_estimate TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS definition_of_done JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acceptance_criteria JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN action_items.parent_story_ref IS 'Parent User Story reference e.g. US-102, User Story #102';
COMMENT ON COLUMN action_items.size_estimate IS 'Estimate e.g. 1 day, 8h (max 8h per task; split if larger)';
COMMENT ON COLUMN action_items.description IS 'Technical description / implementation notes';
COMMENT ON COLUMN action_items.definition_of_done IS 'DoD checklist: array of strings';
COMMENT ON COLUMN action_items.acceptance_criteria IS 'Acceptance criteria: array of strings';

CREATE INDEX IF NOT EXISTS idx_action_items_parent_story ON action_items(project_id, parent_story_ref) WHERE deleted_at IS NULL AND parent_story_ref IS NOT NULL;
