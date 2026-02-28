-- ============================================================================
-- Migration 110: Add sprint_id FK to knowledge entities (facts, decisions,
-- risks, knowledge_questions) for full sprint traceability.
--
-- Currently only action_items and documents have sprint_id. Entities
-- extracted from a meeting transcript assigned to a sprint can only be
-- traced via source_document_id -> document.sprint_id, which is indirect.
-- This migration adds a direct sprint_id FK to the four remaining
-- knowledge entity tables.
--
-- Also adds a trigger function that auto-propagates sprint_id from a
-- document to all entities that reference it via source_document_id.
-- ============================================================================

-- 1. ADD sprint_id COLUMN TO KNOWLEDGE ENTITY TABLES
-- ---------------------------------------------------

ALTER TABLE facts
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

ALTER TABLE knowledge_questions
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

-- 2. INDEXES (partial: only non-deleted rows with sprint_id set)
-- --------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_facts_sprint
  ON facts(project_id, sprint_id)
  WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decisions_sprint
  ON decisions(project_id, sprint_id)
  WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_risks_sprint
  ON risks(project_id, sprint_id)
  WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_sprint
  ON knowledge_questions(project_id, sprint_id)
  WHERE deleted_at IS NULL AND sprint_id IS NOT NULL;

-- 3. BACK-FILL: propagate existing document.sprint_id to linked entities
-- -----------------------------------------------------------------------

UPDATE facts f
   SET sprint_id = d.sprint_id
  FROM documents d
 WHERE f.source_document_id = d.id
   AND d.sprint_id IS NOT NULL
   AND f.sprint_id IS NULL
   AND f.deleted_at IS NULL;

UPDATE decisions dec
   SET sprint_id = d.sprint_id
  FROM documents d
 WHERE dec.source_document_id = d.id
   AND d.sprint_id IS NOT NULL
   AND dec.sprint_id IS NULL
   AND dec.deleted_at IS NULL;

UPDATE risks r
   SET sprint_id = d.sprint_id
  FROM documents d
 WHERE r.source_document_id = d.id
   AND d.sprint_id IS NOT NULL
   AND r.sprint_id IS NULL
   AND r.deleted_at IS NULL;

UPDATE knowledge_questions q
   SET sprint_id = d.sprint_id
  FROM documents d
 WHERE q.source_document_id = d.id
   AND d.sprint_id IS NOT NULL
   AND q.sprint_id IS NULL
   AND q.deleted_at IS NULL;

-- Also propagate to action_items that were extracted from sprint-linked docs
-- but never got sprint_id set directly
UPDATE action_items a
   SET sprint_id = d.sprint_id
  FROM documents d
 WHERE a.source_document_id = d.id
   AND d.sprint_id IS NOT NULL
   AND a.sprint_id IS NULL
   AND a.deleted_at IS NULL;

-- 4. TRIGGER: auto-propagate sprint_id when document.sprint_id changes
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION propagate_document_sprint_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sprint_id IS DISTINCT FROM OLD.sprint_id AND NEW.sprint_id IS NOT NULL THEN
        UPDATE facts SET sprint_id = NEW.sprint_id
         WHERE source_document_id = NEW.id AND (sprint_id IS NULL OR sprint_id = OLD.sprint_id);

        UPDATE decisions SET sprint_id = NEW.sprint_id
         WHERE source_document_id = NEW.id AND (sprint_id IS NULL OR sprint_id = OLD.sprint_id);

        UPDATE risks SET sprint_id = NEW.sprint_id
         WHERE source_document_id = NEW.id AND (sprint_id IS NULL OR sprint_id = OLD.sprint_id);

        UPDATE knowledge_questions SET sprint_id = NEW.sprint_id
         WHERE source_document_id = NEW.id AND (sprint_id IS NULL OR sprint_id = OLD.sprint_id);

        UPDATE action_items SET sprint_id = NEW.sprint_id
         WHERE source_document_id = NEW.id AND (sprint_id IS NULL OR sprint_id = OLD.sprint_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS propagate_sprint_id_on_document_update ON documents;
CREATE TRIGGER propagate_sprint_id_on_document_update
    AFTER UPDATE OF sprint_id ON documents
    FOR EACH ROW
    EXECUTE FUNCTION propagate_document_sprint_id();

-- 5. COMMENTS
-- -----------

COMMENT ON COLUMN facts.sprint_id IS 'Sprint this fact belongs to (auto-propagated from source document or set manually)';
COMMENT ON COLUMN decisions.sprint_id IS 'Sprint this decision belongs to (auto-propagated from source document or set manually)';
COMMENT ON COLUMN risks.sprint_id IS 'Sprint this risk belongs to (auto-propagated from source document or set manually)';
COMMENT ON COLUMN knowledge_questions.sprint_id IS 'Sprint this question belongs to (auto-propagated from source document or set manually)';
COMMENT ON FUNCTION propagate_document_sprint_id IS 'Auto-propagates sprint_id from document to linked facts, decisions, risks, questions, and action_items';
