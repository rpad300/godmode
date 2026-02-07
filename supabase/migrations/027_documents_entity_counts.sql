-- ============================================
-- Migration 027: Add entity counts and content fields to documents
-- Required for document reprocessing and modal display
-- ============================================

-- Add entity count columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS facts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS decisions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS risks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS questions_count INTEGER DEFAULT 0;

-- Add content storage for extracted text
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add error message field
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create index for content hash (for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(project_id, content_hash);

-- Add missing indexes for source_document_id on entity tables (for fast count queries)
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source_document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_source ON risks(source_document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_source ON action_items(source_document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_source ON knowledge_questions(source_document_id) WHERE deleted_at IS NULL;

-- Function to update entity counts for a document
CREATE OR REPLACE FUNCTION update_document_entity_counts(p_document_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE documents
    SET 
        facts_count = (SELECT COUNT(*) FROM facts WHERE source_document_id = p_document_id AND deleted_at IS NULL),
        decisions_count = (SELECT COUNT(*) FROM decisions WHERE source_document_id = p_document_id AND deleted_at IS NULL),
        risks_count = (SELECT COUNT(*) FROM risks WHERE source_document_id = p_document_id AND deleted_at IS NULL),
        actions_count = (SELECT COUNT(*) FROM action_items WHERE source_document_id = p_document_id AND deleted_at IS NULL),
        questions_count = (SELECT COUNT(*) FROM knowledge_questions WHERE source_document_id = p_document_id AND deleted_at IS NULL),
        updated_at = now()
    WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update counts when entities are modified
CREATE OR REPLACE FUNCTION trigger_update_document_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.source_document_id IS NOT NULL THEN
            PERFORM update_document_entity_counts(NEW.source_document_id);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.source_document_id IS NOT NULL THEN
            PERFORM update_document_entity_counts(OLD.source_document_id);
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each entity table
DROP TRIGGER IF EXISTS trg_facts_update_doc_counts ON facts;
CREATE TRIGGER trg_facts_update_doc_counts
    AFTER INSERT OR UPDATE OR DELETE ON facts
    FOR EACH ROW EXECUTE FUNCTION trigger_update_document_counts();

DROP TRIGGER IF EXISTS trg_decisions_update_doc_counts ON decisions;
CREATE TRIGGER trg_decisions_update_doc_counts
    AFTER INSERT OR UPDATE OR DELETE ON decisions
    FOR EACH ROW EXECUTE FUNCTION trigger_update_document_counts();

DROP TRIGGER IF EXISTS trg_risks_update_doc_counts ON risks;
CREATE TRIGGER trg_risks_update_doc_counts
    AFTER INSERT OR UPDATE OR DELETE ON risks
    FOR EACH ROW EXECUTE FUNCTION trigger_update_document_counts();

DROP TRIGGER IF EXISTS trg_actions_update_doc_counts ON action_items;
CREATE TRIGGER trg_actions_update_doc_counts
    AFTER INSERT OR UPDATE OR DELETE ON action_items
    FOR EACH ROW EXECUTE FUNCTION trigger_update_document_counts();

DROP TRIGGER IF EXISTS trg_questions_update_doc_counts ON knowledge_questions;
CREATE TRIGGER trg_questions_update_doc_counts
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_questions
    FOR EACH ROW EXECUTE FUNCTION trigger_update_document_counts();

-- Update existing documents with current counts
DO $$
DECLARE
    doc RECORD;
BEGIN
    FOR doc IN SELECT id FROM documents LOOP
        PERFORM update_document_entity_counts(doc.id);
    END LOOP;
END $$;

-- Comments
COMMENT ON COLUMN documents.facts_count IS 'Number of facts extracted from this document';
COMMENT ON COLUMN documents.decisions_count IS 'Number of decisions extracted from this document';
COMMENT ON COLUMN documents.risks_count IS 'Number of risks extracted from this document';
COMMENT ON COLUMN documents.actions_count IS 'Number of action items extracted from this document';
COMMENT ON COLUMN documents.questions_count IS 'Number of questions extracted from this document';
COMMENT ON COLUMN documents.content IS 'Extracted text content from the document';
COMMENT ON COLUMN documents.content_hash IS 'MD5 hash of content for change detection';
COMMENT ON COLUMN documents.error_message IS 'Error message if processing failed';
