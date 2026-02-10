-- ============================================================================
-- Migration 087: Indexes on foreign keys (performance advisor)
-- ============================================================================
-- Adds indexes on FK columns that are often used in JOINs/filters to improve
-- query performance. Covers a subset of unindexed FKs from advisor report.
-- ============================================================================

-- action_items
CREATE INDEX IF NOT EXISTS idx_action_items_created_by ON action_items(created_by) WHERE created_by IS NOT NULL;

-- documents (uploaded_by used in filters)
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by) WHERE uploaded_by IS NOT NULL;

-- decisions, facts, risks (created_by)
CREATE INDEX IF NOT EXISTS idx_decisions_created_by ON decisions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facts_created_by ON facts(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risks_created_by ON risks(created_by) WHERE created_by IS NOT NULL;

-- knowledge_questions (assigned_to, created_by often filtered)
CREATE INDEX IF NOT EXISTS idx_knowledge_questions_created_by ON knowledge_questions(created_by) WHERE created_by IS NOT NULL;

-- contacts (created_by, linked_person_id)
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_linked_person ON contacts(linked_person_id) WHERE linked_person_id IS NOT NULL;

-- document_versions (uploaded_by)
CREATE INDEX IF NOT EXISTS idx_document_versions_uploaded_by ON document_versions(uploaded_by) WHERE uploaded_by IS NOT NULL;

-- balance_transactions (llm_request_id for lookups)
CREATE INDEX IF NOT EXISTS idx_balance_transactions_llm_request ON balance_transactions(llm_request_id) WHERE llm_request_id IS NOT NULL;

-- ai_analysis_log (created_by, parent_analysis_id)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_log_created_by ON ai_analysis_log(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_analysis_log_parent ON ai_analysis_log(parent_analysis_id) WHERE parent_analysis_id IS NOT NULL;

-- comments (resolved_by)
CREATE INDEX IF NOT EXISTS idx_comments_resolved_by ON comments(resolved_by) WHERE resolved_by IS NOT NULL;

-- calendar_events (created_by, linked_document_id, linked_action_id)
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_document ON calendar_events(linked_document_id) WHERE linked_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_action ON calendar_events(linked_action_id) WHERE linked_action_id IS NOT NULL;
