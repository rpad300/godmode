-- ============================================
-- Migration 059: Chat Context Contact
-- Add context_contact_id to chat_sessions for per-conversation role context
-- ============================================

-- Add context_contact_id to chat_sessions
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS context_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_context_contact ON chat_sessions(context_contact_id)
WHERE context_contact_id IS NOT NULL;

COMMENT ON COLUMN chat_sessions.context_contact_id IS 'Contact whose role/org provides context for this chat session';
