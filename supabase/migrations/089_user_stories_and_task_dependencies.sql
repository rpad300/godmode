-- Migration 089: User Stories and Task Dependencies
-- User stories contain tasks; tasks can depend on other tasks.
-- All prompts for task/user-story flows are in system_prompts (editable in Admin).

-- ============================================
-- USER STORIES
-- ============================================
CREATE TABLE IF NOT EXISTS user_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'in_progress', 'done')),
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_stories_project ON user_stories(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_stories_status ON user_stories(project_id, status) WHERE deleted_at IS NULL;

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS parent_story_id UUID REFERENCES user_stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_items_parent_story_id ON action_items(project_id, parent_story_id) WHERE deleted_at IS NULL AND parent_story_id IS NOT NULL;

-- ============================================
-- TASK DEPENDENCIES (task A depends on task B)
-- ============================================
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id),
    CHECK (task_id != depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access user_stories" ON user_stories;
CREATE POLICY "Members access user_stories" ON user_stories FOR ALL
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Members access task_dependencies" ON task_dependencies;
CREATE POLICY "Members access task_dependencies" ON task_dependencies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM action_items a
      WHERE a.id = task_dependencies.task_id AND is_project_member(a.project_id)
    )
  );

-- ============================================
-- TRIGGERS (update_updated_at_column from 005)
-- ============================================
DROP TRIGGER IF EXISTS user_stories_updated_at ON user_stories;
CREATE TRIGGER user_stories_updated_at
  BEFORE UPDATE ON user_stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_stories IS 'User stories; each can have many tasks (action_items.parent_story_id)';
COMMENT ON TABLE task_dependencies IS 'Task A depends on task B: task_id cannot be done before depends_on_id';
