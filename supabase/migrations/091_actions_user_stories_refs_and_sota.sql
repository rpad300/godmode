-- Migration 091: Actions and User Stories SOTA – refs, generation_source, user_story_events
-- Adds: origin (email/transcript), requester, supporting documents; generation_source; timeline for user stories.

-- ============================================
-- ACTION_ITEMS: generation_source + refs
-- ============================================
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS generation_source TEXT CHECK (generation_source IN ('extracted', 'quick_capture', 'manual', 'import')),
  ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('transcript', 'email', 'manual')),
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS requested_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supporting_document_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN action_items.generation_source IS 'How the action was created: extracted, quick_capture, manual, import';
COMMENT ON COLUMN action_items.source_email_id IS 'Email from which the task originated (if any)';
COMMENT ON COLUMN action_items.source_type IS 'Origin: transcript, email, or manual';
COMMENT ON COLUMN action_items.requested_by IS 'Name or identifier of who requested the task';
COMMENT ON COLUMN action_items.requested_by_contact_id IS 'Contact who requested (optional)';
COMMENT ON COLUMN action_items.supporting_document_ids IS 'Array of document UUIDs for reference';

-- ============================================
-- USER_STORIES: source + requester + supporting docs
-- ============================================
ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_file TEXT,
  ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('transcript', 'email', 'manual')),
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS requested_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supporting_document_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS generation_source TEXT CHECK (generation_source IN ('extracted', 'quick_capture', 'manual', 'import'));

COMMENT ON COLUMN user_stories.source_document_id IS 'Document/transcript from which the user story originated';
COMMENT ON COLUMN user_stories.source_file IS 'Source file name';
COMMENT ON COLUMN user_stories.source_email_id IS 'Email from which the user story originated (if any)';
COMMENT ON COLUMN user_stories.source_type IS 'Origin: transcript, email, or manual';
COMMENT ON COLUMN user_stories.requested_by IS 'Who requested the user story';
COMMENT ON COLUMN user_stories.supporting_document_ids IS 'Array of document UUIDs for reference';

-- ============================================
-- USER_STORY_EVENTS (timeline/audit for user_stories)
-- ============================================
CREATE TABLE IF NOT EXISTS user_story_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_story_id UUID NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',

    actor_user_id UUID REFERENCES auth.users(id),
    actor_name TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_story_events_story ON user_story_events(user_story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_story_events_type ON user_story_events(event_type);

ALTER TABLE user_story_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access user_story_events" ON user_story_events;
CREATE POLICY "Members access user_story_events" ON user_story_events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_stories us
        WHERE us.id = user_story_events.user_story_id
        AND is_project_member(us.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_stories us
        WHERE us.id = user_story_events.user_story_id
        AND is_project_member(us.project_id)
    )
);

COMMENT ON TABLE user_story_events IS 'Timeline/audit for user stories (created, updated, deleted, restored)';
