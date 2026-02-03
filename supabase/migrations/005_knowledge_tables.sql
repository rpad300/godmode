-- ============================================
-- GodMode Phase 5: Knowledge Tables
-- Core knowledge base tables for facts, decisions, risks, etc.
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- DOCUMENTS
-- Processed documents with file references
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- File info (reference to local filesystem, not stored in Supabase)
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    
    -- Document metadata
    document_date DATE,
    document_time TIME,
    title TEXT,
    summary TEXT,
    
    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processed_at TIMESTAMPTZ,
    chunk_count INTEGER DEFAULT 0,
    extraction_result JSONB,
    processing_error TEXT,
    
    -- Document type
    doc_type TEXT DEFAULT 'document' CHECK (doc_type IN ('document', 'transcript', 'image')),
    
    -- Audit
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_filename_trgm ON documents USING gin(filename gin_trgm_ops);

-- ============================================
-- FACTS
-- Extracted facts from documents
-- ============================================
CREATE TABLE IF NOT EXISTS facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    category TEXT CHECK (category IN ('technical', 'process', 'policy', 'people', 'timeline', 'general')),
    confidence REAL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    source_chunk INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_facts_project ON facts(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(project_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source_document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facts_content_trgm ON facts USING gin(content gin_trgm_ops);

-- ============================================
-- DECISIONS
-- Extracted decisions from documents
-- ============================================
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    owner TEXT,
    decision_date DATE,
    context TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'revoked')),
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_content_trgm ON decisions USING gin(content gin_trgm_ops);

-- ============================================
-- RISKS
-- Extracted risks from documents
-- ============================================
CREATE TABLE IF NOT EXISTS risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    impact TEXT CHECK (impact IN ('low', 'medium', 'high', 'critical')),
    likelihood TEXT CHECK (likelihood IN ('low', 'medium', 'high')),
    mitigation TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'mitigated', 'accepted', 'closed')),
    owner TEXT,
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_risks_project ON risks(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_impact ON risks(project_id, impact) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_content_trgm ON risks USING gin(content gin_trgm_ops);

-- ============================================
-- ACTION ITEMS
-- Extracted action items from documents
-- ============================================
CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    task TEXT NOT NULL,
    owner TEXT,
    deadline DATE,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_actions_project ON action_items(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_status ON action_items(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_deadline ON action_items(project_id, deadline) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_actions_owner ON action_items(project_id, owner) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_task_trgm ON action_items USING gin(task gin_trgm_ops);

-- ============================================
-- KNOWLEDGE QUESTIONS
-- Extracted questions from documents
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'answered', 'closed')),
    category TEXT,
    context TEXT,
    
    -- Assignment
    assigned_to TEXT,
    
    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_questions_project ON knowledge_questions(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_status ON knowledge_questions(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_priority ON knowledge_questions(project_id, priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_assigned ON knowledge_questions(project_id, assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_content_trgm ON knowledge_questions USING gin(content gin_trgm_ops);

-- ============================================
-- PEOPLE
-- Extracted people from documents
-- ============================================
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    role TEXT,
    organization TEXT,
    email TEXT,
    notes TEXT,
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Unique constraint on name per project (only for non-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_unique_name ON people(project_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_people_project ON people(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_people_name_trgm ON people USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_people_org ON people(project_id, organization) WHERE deleted_at IS NULL;

-- ============================================
-- RELATIONSHIPS
-- Relationships between people (org chart)
-- ============================================
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Can reference people table or use names directly
    from_person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    to_person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    from_name TEXT NOT NULL,
    to_name TEXT NOT NULL,
    
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'reports_to', 'manages', 'leads', 'member_of', 'works_with',
        'collaborates', 'advises', 'stakeholder'
    )),
    
    context TEXT,
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_file TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_relationships_project ON relationships(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(project_id, relationship_type) WHERE deleted_at IS NULL;

-- ============================================
-- EMBEDDINGS (pgvector)
-- Vector embeddings for semantic search
-- ============================================
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Entity reference
    entity_type TEXT NOT NULL CHECK (entity_type IN ('fact', 'decision', 'risk', 'action', 'question', 'document', 'chunk', 'person')),
    entity_id UUID NOT NULL,
    
    -- Content and embedding
    content TEXT NOT NULL,
    embedding vector(1024),
    model TEXT DEFAULT 'snowflake-arctic-embed',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings(project_id, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);

-- ============================================
-- PROCESSING HISTORY
-- Track document processing sessions
-- ============================================
CREATE TABLE IF NOT EXISTS processing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    duration_ms INTEGER,
    
    -- AI metadata
    model_used TEXT,
    tokens_used INTEGER,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_project ON processing_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_document ON processing_history(document_id);

-- ============================================
-- CONVERSATIONS (Chat history)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    title TEXT,
    conversation_type TEXT DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'meeting', 'interview', 'discussion')),
    
    -- For imported conversations
    source TEXT,
    participants TEXT[],
    conversation_date TIMESTAMPTZ,
    
    -- Messages stored as JSONB array
    messages JSONB DEFAULT '[]',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(project_id, conversation_type) WHERE deleted_at IS NULL;

-- ============================================
-- CHANGE LOG
-- Track changes to knowledge base
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    action TEXT NOT NULL CHECK (action IN ('add', 'update', 'delete', 'replace', 'restore')),
    entity_type TEXT NOT NULL,
    entity_id UUID,
    summary TEXT,
    source_file TEXT,
    
    -- Snapshot for undo
    previous_data JSONB,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_changelog_project ON knowledge_change_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_entity ON knowledge_change_log(entity_type, entity_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_change_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: Project member access
-- ============================================

-- Helper function to check project membership
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = p_project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM projects 
        WHERE id = p_project_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Documents policies
CREATE POLICY "Members access documents" ON documents FOR ALL 
    USING (is_project_member(project_id));

-- Facts policies
CREATE POLICY "Members access facts" ON facts FOR ALL 
    USING (is_project_member(project_id));

-- Decisions policies
CREATE POLICY "Members access decisions" ON decisions FOR ALL 
    USING (is_project_member(project_id));

-- Risks policies
CREATE POLICY "Members access risks" ON risks FOR ALL 
    USING (is_project_member(project_id));

-- Action items policies
CREATE POLICY "Members access action_items" ON action_items FOR ALL 
    USING (is_project_member(project_id));

-- Questions policies
CREATE POLICY "Members access questions" ON knowledge_questions FOR ALL 
    USING (is_project_member(project_id));

-- People policies
CREATE POLICY "Members access people" ON people FOR ALL 
    USING (is_project_member(project_id));

-- Relationships policies
CREATE POLICY "Members access relationships" ON relationships FOR ALL 
    USING (is_project_member(project_id));

-- Embeddings policies
CREATE POLICY "Members access embeddings" ON embeddings FOR ALL 
    USING (is_project_member(project_id));

-- Processing history policies
CREATE POLICY "Members access processing_history" ON processing_history FOR ALL 
    USING (is_project_member(project_id));

-- Conversations policies
CREATE POLICY "Members access conversations" ON conversations FOR ALL 
    USING (is_project_member(project_id));

-- Change log policies
CREATE POLICY "Members access knowledge_change_log" ON knowledge_change_log FOR ALL 
    USING (is_project_member(project_id));

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at on all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS facts_updated_at ON facts;
CREATE TRIGGER facts_updated_at
    BEFORE UPDATE ON facts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS decisions_updated_at ON decisions;
CREATE TRIGGER decisions_updated_at
    BEFORE UPDATE ON decisions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS risks_updated_at ON risks;
CREATE TRIGGER risks_updated_at
    BEFORE UPDATE ON risks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS action_items_updated_at ON action_items;
CREATE TRIGGER action_items_updated_at
    BEFORE UPDATE ON action_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS knowledge_questions_updated_at ON knowledge_questions;
CREATE TRIGGER knowledge_questions_updated_at
    BEFORE UPDATE ON knowledge_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS people_updated_at ON people;
CREATE TRIGGER people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE documents IS 'Processed documents with file references (files stored locally)';
COMMENT ON TABLE facts IS 'Extracted facts from documents';
COMMENT ON TABLE decisions IS 'Extracted decisions from documents';
COMMENT ON TABLE risks IS 'Extracted risks from documents';
COMMENT ON TABLE action_items IS 'Extracted action items from documents';
COMMENT ON TABLE knowledge_questions IS 'Extracted questions from documents';
COMMENT ON TABLE people IS 'Extracted people from documents';
COMMENT ON TABLE relationships IS 'Relationships between people (org chart)';
COMMENT ON TABLE embeddings IS 'Vector embeddings for semantic search (pgvector)';
COMMENT ON TABLE processing_history IS 'Document processing session history';
COMMENT ON TABLE conversations IS 'Chat and conversation history';
COMMENT ON TABLE knowledge_change_log IS 'Audit trail of knowledge base changes';
