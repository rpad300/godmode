-- Migration 094: Optional story points (user_stories) and task points (action_items)
-- For velocity and breakdown reporting.

ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS story_points INTEGER CHECK (story_points IS NULL OR story_points >= 0);

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS task_points INTEGER CHECK (task_points IS NULL OR task_points >= 0);

COMMENT ON COLUMN user_stories.story_points IS 'Optional story points for velocity (e.g. Fibonacci)';
COMMENT ON COLUMN action_items.task_points IS 'Optional task points for breakdown and velocity';

CREATE INDEX IF NOT EXISTS idx_user_stories_story_points ON user_stories(project_id, story_points) WHERE story_points IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_task_points ON action_items(project_id, task_points) WHERE deleted_at IS NULL AND task_points IS NOT NULL;
