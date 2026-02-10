-- ============================================================================
-- Migration 081: Views for code compatibility
-- ============================================================================
-- The app uses table names that map to underlying tables/views.
-- This migration adds views so existing code (storage.js merge, vector RPC)
-- works without code changes.
-- ============================================================================

-- 1) questions: code and match_embeddings_with_details RPC use "questions"
--    The real table is knowledge_questions.
CREATE OR REPLACE VIEW questions AS
SELECT * FROM knowledge_questions;

COMMENT ON VIEW questions IS 'Alias for knowledge_questions used by merge contacts and vector search RPC';

-- 2) question_updates: merge contacts updates actor_contact_id
--    The real table is question_events.
CREATE OR REPLACE VIEW question_updates AS
SELECT * FROM question_events;

COMMENT ON VIEW question_updates IS 'Alias for question_events used by merge contacts';

-- 3) email_contacts: merge contacts updates contact_id on email–contact link
--    The real table is email_recipients (email_id, contact_id, recipient_type, ...).
CREATE OR REPLACE VIEW email_contacts AS
SELECT * FROM email_recipients;

COMMENT ON VIEW email_contacts IS 'Alias for email_recipients used by merge contacts';
