-- Migration 092: Sprints and action_items.sprint_id
-- Enables sprint-based task grouping and AI-generated sprint task creation.

-- ============================================
-- TABLE: sprints
-- ============================================
CREATE TABLE IF NOT EXISTS sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    context TEXT,

    -- Period for AI to analyze (emails/transcripts in this range)
    analysis_start_date DATE,
    analysis_end_date DATE,

    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_dates ON sprints(project_id, start_date, end_date);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

-- Project members can manage sprints of their project
CREATE POLICY "Members access project sprints" ON sprints
FOR ALL
USING (is_project_member(project_id))
WITH CHECK (is_project_member(project_id));

COMMENT ON TABLE sprints IS 'Sprints with optional AI-generated tasks from emails/transcripts';
COMMENT ON COLUMN sprints.context IS 'Sprint goals/context for AI task generation';
COMMENT ON COLUMN sprints.analysis_start_date IS 'Start of period to analyze for task suggestions';
COMMENT ON COLUMN sprints.analysis_end_date IS 'End of period to analyze for task suggestions';

-- ============================================
-- ACTION_ITEMS: sprint_id + allow sprint_generated
-- ============================================
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_items_sprint ON action_items(project_id, sprint_id) WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;

COMMENT ON COLUMN action_items.sprint_id IS 'Sprint this task belongs to (optional)';

-- Allow generation_source 'sprint_generated' (extend existing check)
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_generation_source_check;
ALTER TABLE action_items ADD CONSTRAINT action_items_generation_source_check
  CHECK (generation_source IN ('extracted', 'quick_capture', 'manual', 'import', 'sprint_generated'));
