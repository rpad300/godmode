-- ============================================
-- Migration 058: Chat Sessions and Messages
-- Main chat persistence - multiple conversations per project
-- ============================================

-- ============================================
-- 1. CHAT SESSIONS
-- One row per conversation/chat
-- ============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    title TEXT DEFAULT 'Nova conversa', -- First message truncated or "Nova conversa"
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);

-- RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access chat sessions" ON chat_sessions
    FOR ALL USING (is_project_member(project_id));

-- ============================================
-- 2. CHAT MESSAGES
-- Messages within a session
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- RAG metadata
    sources JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- metadata: { queryType, confidence, contextQuality, rag: {...} }
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(session_id, created_at);

-- RLS via session -> project
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access chat messages" ON chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM chat_sessions cs
            WHERE cs.id = chat_messages.session_id
            AND is_project_member(cs.project_id)
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update session updated_at when new message is added
CREATE OR REPLACE FUNCTION chat_message_update_session()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET updated_at = now()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_messages_update_session ON chat_messages;
CREATE TRIGGER chat_messages_update_session
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION chat_message_update_session();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE chat_sessions IS 'Main chat conversations - one per chat thread';
COMMENT ON TABLE chat_messages IS 'Chat messages within a session';
COMMENT ON COLUMN chat_messages.sources IS 'RAG sources array with type, score, contactName, avatarUrl etc.';
COMMENT ON COLUMN chat_messages.metadata IS 'queryType, confidence, contextQuality, rag method info';
