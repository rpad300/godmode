-- ============================================================================
-- Migration 111: Document Tree Indexes
-- Hierarchical tree-based document index for reasoning-based retrieval.
-- Inspired by PageIndex: builds a "table of contents" tree with summaries
-- for long documents, enabling LLM-driven section navigation during RAG.
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_tree_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    tree_data JSONB NOT NULL,
    full_content TEXT,
    doc_description TEXT,

    total_chars INTEGER,
    node_count INTEGER,

    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    version TEXT DEFAULT '1.0',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_document_tree_index UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_tree_indexes_project ON document_tree_indexes(project_id);
CREATE INDEX IF NOT EXISTS idx_tree_indexes_document ON document_tree_indexes(document_id);

ALTER TABLE document_tree_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access document_tree_indexes"
    ON document_tree_indexes FOR ALL
    USING (is_project_member(project_id));

CREATE TRIGGER document_tree_indexes_updated_at
    BEFORE UPDATE ON document_tree_indexes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE document_tree_indexes IS
    'Hierarchical tree index for long documents. Enables reasoning-based retrieval by storing a section tree with summaries and the full document content for section extraction.';
