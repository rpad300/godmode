-- Migration 096: Link documents and emails to sprint/task (optional)
-- Allows associating uploads (documents, emails, transcripts) with a sprint and/or task.

-- ============================================
-- DOCUMENTS: optional sprint and task
-- ============================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES action_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_sprint ON documents(project_id, sprint_id) WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_action ON documents(project_id, action_id) WHERE deleted_at IS NULL AND action_id IS NOT NULL;

COMMENT ON COLUMN documents.sprint_id IS 'Optional sprint this document relates to';
COMMENT ON COLUMN documents.action_id IS 'Optional task (action) this document relates to';

-- ============================================
-- EMAILS: optional sprint and task
-- ============================================
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES action_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emails_sprint ON emails(project_id, sprint_id) WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_action ON emails(project_id, action_id) WHERE deleted_at IS NULL AND action_id IS NOT NULL;

COMMENT ON COLUMN emails.sprint_id IS 'Optional sprint this email relates to';
COMMENT ON COLUMN emails.action_id IS 'Optional task (action) this email relates to';
