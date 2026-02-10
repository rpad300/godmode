-- ============================================================================
-- Migration 083: Security advisor fixes
-- ============================================================================
-- Applies fixes recommended by Supabase Security Advisor:
-- 1) Enable RLS on timezones (reference table, read-only)
-- 2) Recreate views questions, question_updates, email_contacts with
--    security_invoker = on so they use caller permissions (fix Security Definer View lint)
-- ============================================================================

-- 1) RLS on timezones (reference table: read-only for all)
ALTER TABLE timezones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read timezones"
ON timezones FOR SELECT
TO authenticated, anon
USING (true);

-- 2) Views with security_invoker (PostgreSQL 15+)
DROP VIEW IF EXISTS email_contacts;
CREATE VIEW email_contacts WITH (security_invoker = on) AS
SELECT * FROM email_recipients;

DROP VIEW IF EXISTS question_updates;
CREATE VIEW question_updates WITH (security_invoker = on) AS
SELECT * FROM question_events;

DROP VIEW IF EXISTS questions;
CREATE VIEW questions WITH (security_invoker = on) AS
SELECT * FROM knowledge_questions;

COMMENT ON VIEW questions IS 'Alias for knowledge_questions (security_invoker)';
COMMENT ON VIEW question_updates IS 'Alias for question_events (security_invoker)';
COMMENT ON VIEW email_contacts IS 'Alias for email_recipients (security_invoker)';
