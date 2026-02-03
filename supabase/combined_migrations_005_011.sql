-- Combined Supabase Migrations (005-011)
-- Generated: 2026-01-29T23:49:31.667Z

-- ============================================
-- Migration: 005_knowledge_tables.sql
-- ============================================

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


-- ============================================
-- Migration: 006_contacts_teams.sql
-- ============================================

-- ============================================
-- GodMode Phase 6: Contacts and Teams
-- Contact directory and team management
-- ============================================

-- ============================================
-- CONTACTS
-- Contact directory with enriched information
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    organization TEXT,
    role TEXT,
    department TEXT,
    
    -- Extended info
    aliases TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    avatar_url TEXT,
    
    -- Link to extracted person
    linked_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    
    -- Activity tracking
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    
    -- Flags
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_project ON contacts(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(project_id, organization) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(project_id, email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING gin(tags) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(project_id, is_favorite) WHERE deleted_at IS NULL AND is_favorite = TRUE;

-- ============================================
-- TEAMS
-- Team/group definitions
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    
    -- Team type
    team_type TEXT DEFAULT 'team' CHECK (team_type IN ('team', 'department', 'organization', 'group')),
    
    -- Parent team for hierarchy
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Unique team name per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_unique_name ON teams(project_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teams_project ON teams(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teams_parent ON teams(parent_team_id) WHERE deleted_at IS NULL;

-- ============================================
-- TEAM MEMBERS
-- Link contacts to teams
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    
    role TEXT,
    is_lead BOOLEAN DEFAULT FALSE,
    
    joined_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (team_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_contact ON team_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_team_members_lead ON team_members(team_id) WHERE is_lead = TRUE;

-- ============================================
-- CONTACT RELATIONSHIPS
-- Relationships between contacts
-- ============================================
CREATE TABLE IF NOT EXISTS contact_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    from_contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    to_contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    
    relationship_type TEXT NOT NULL,
    strength INTEGER DEFAULT 1 CHECK (strength >= 1 AND strength <= 5),
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    
    -- Prevent duplicate relationships
    UNIQUE(from_contact_id, to_contact_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_contact_rel_from ON contact_relationships(from_contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contact_rel_to ON contact_relationships(to_contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contact_rel_project ON contact_relationships(project_id) WHERE deleted_at IS NULL;

-- ============================================
-- CONTACT ACTIVITY
-- Track interactions with contacts
-- ============================================
CREATE TABLE IF NOT EXISTS contact_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'mentioned', 'meeting', 'email', 'call', 'message', 'document', 'other'
    )),
    description TEXT,
    
    -- Reference to source
    source_type TEXT,
    source_id UUID,
    source_name TEXT,
    
    occurred_at TIMESTAMPTZ DEFAULT now(),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_activity_contact ON contact_activity(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_activity_project ON contact_activity(project_id, occurred_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity ENABLE ROW LEVEL SECURITY;

-- Contacts policies
CREATE POLICY "Members access contacts" ON contacts FOR ALL 
    USING (is_project_member(project_id));

-- Teams policies
CREATE POLICY "Members access teams" ON teams FOR ALL 
    USING (is_project_member(project_id));

-- Team members policies (via team's project)
CREATE POLICY "Members access team_members" ON team_members FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = team_id AND is_project_member(t.project_id)
        )
    );

-- Contact relationships policies
CREATE POLICY "Members access contact_relationships" ON contact_relationships FOR ALL 
    USING (is_project_member(project_id));

-- Contact activity policies
CREATE POLICY "Members access contact_activity" ON contact_activity FOR ALL 
    USING (is_project_member(project_id));

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update contact interaction count and last_seen
CREATE OR REPLACE FUNCTION update_contact_activity_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contacts 
    SET 
        interaction_count = interaction_count + 1,
        last_seen_at = NEW.occurred_at,
        first_seen_at = COALESCE(first_seen_at, NEW.occurred_at)
    WHERE id = NEW.contact_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_activity_stats ON contact_activity;
CREATE TRIGGER contact_activity_stats
    AFTER INSERT ON contact_activity
    FOR EACH ROW EXECUTE FUNCTION update_contact_activity_stats();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE contacts IS 'Contact directory with enriched information';
COMMENT ON TABLE teams IS 'Team/group definitions';
COMMENT ON TABLE team_members IS 'Link contacts to teams';
COMMENT ON TABLE contact_relationships IS 'Relationships between contacts';
COMMENT ON TABLE contact_activity IS 'Track interactions with contacts';


-- ============================================
-- Migration: 007_system_tables.sql
-- ============================================

-- ============================================
-- GodMode Phase 7: System Tables
-- Configuration, stats, and system-level data
-- ============================================

-- ============================================
-- PROJECT CONFIG
-- Project-specific configuration
-- ============================================
CREATE TABLE IF NOT EXISTS project_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    
    -- User role context
    user_role TEXT,
    user_role_prompt TEXT,
    
    -- LLM configuration
    llm_config JSONB DEFAULT '{}'::jsonb,
    ollama_config JSONB DEFAULT '{
        "host": "127.0.0.1",
        "port": "11434",
        "model": "qwen3:14b",
        "visionModel": "qwen3-vl:8b",
        "reasoningModel": "qwen3:14b"
    }'::jsonb,
    
    -- Custom prompts
    prompts JSONB DEFAULT '{
        "document": "",
        "vision": "",
        "transcript": ""
    }'::jsonb,
    
    -- Processing settings
    processing_settings JSONB DEFAULT '{
        "pdfToImages": true,
        "chunkSize": 4000,
        "chunkOverlap": 200,
        "similarityThreshold": 0.90
    }'::jsonb,
    
    -- UI preferences
    ui_preferences JSONB DEFAULT '{
        "theme": "system",
        "locale": "pt"
    }'::jsonb,
    
    -- Audit
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_project ON project_config(project_id);

-- ============================================
-- STATS HISTORY
-- Daily statistics snapshots for trends
-- ============================================
CREATE TABLE IF NOT EXISTS stats_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Snapshot date
    snapshot_date DATE NOT NULL,
    
    -- Counts
    facts_count INTEGER DEFAULT 0,
    questions_count INTEGER DEFAULT 0,
    questions_open INTEGER DEFAULT 0,
    decisions_count INTEGER DEFAULT 0,
    risks_count INTEGER DEFAULT 0,
    risks_open INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    actions_pending INTEGER DEFAULT 0,
    people_count INTEGER DEFAULT 0,
    documents_count INTEGER DEFAULT 0,
    contacts_count INTEGER DEFAULT 0,
    
    -- Derived metrics
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_stats_project ON stats_history(project_id, snapshot_date DESC);

-- ============================================
-- SOT VERSIONS
-- Source of Truth version history
-- ============================================
CREATE TABLE IF NOT EXISTS sot_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    
    -- Summary
    executive_summary TEXT,
    
    -- Change info
    changes_summary JSONB DEFAULT '{}'::jsonb,
    facts_count INTEGER DEFAULT 0,
    decisions_count INTEGER DEFAULT 0,
    risks_count INTEGER DEFAULT 0,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_sot_project ON sot_versions(project_id, version_number DESC);

-- ============================================
-- SOT LAST VIEW
-- Track last viewed SOT state per user
-- ============================================
CREATE TABLE IF NOT EXISTS sot_last_view (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    last_version_id UUID REFERENCES sot_versions(id) ON DELETE SET NULL,
    facts_snapshot JSONB,
    decisions_snapshot JSONB,
    risks_snapshot JSONB,
    
    viewed_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sot_view_user ON sot_last_view(user_id);

-- ============================================
-- SYNTHESIZED FILES
-- Track which files have been synthesized
-- ============================================
CREATE TABLE IF NOT EXISTS synthesized_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    
    synthesized_at TIMESTAMPTZ DEFAULT now(),
    facts_extracted INTEGER DEFAULT 0,
    
    UNIQUE(project_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_synth_project ON synthesized_files(project_id);
CREATE INDEX IF NOT EXISTS idx_synth_hash ON synthesized_files(file_hash);

-- ============================================
-- RAW CONTENT
-- Extracted raw content from documents
-- ============================================
CREATE TABLE IF NOT EXISTS raw_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- YAML frontmatter as JSONB
    frontmatter JSONB DEFAULT '{}',
    
    -- Processing info
    extracted_at TIMESTAMPTZ DEFAULT now(),
    extraction_method TEXT,
    
    UNIQUE(project_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_content_project ON raw_content(project_id);
CREATE INDEX IF NOT EXISTS idx_content_document ON raw_content(document_id);

-- ============================================
-- DOCUMENT METADATA
-- Metadata for uploaded files
-- ============================================
CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Original file info
    original_filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    
    -- User-provided metadata
    document_date DATE,
    document_time TIME,
    
    -- Upload info
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, filepath)
);

CREATE INDEX IF NOT EXISTS idx_docmeta_project ON document_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_docmeta_document ON document_metadata(document_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sot_last_view ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesized_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access project_config" ON project_config FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access stats_history" ON stats_history FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access sot_versions" ON sot_versions FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Users access own sot_last_view" ON sot_last_view FOR ALL 
    USING (user_id = auth.uid() AND is_project_member(project_id));

CREATE POLICY "Members access synthesized_files" ON synthesized_files FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access raw_content" ON raw_content FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access document_metadata" ON document_metadata FOR ALL 
    USING (is_project_member(project_id));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to record daily stats
CREATE OR REPLACE FUNCTION record_daily_stats(p_project_id UUID)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    INSERT INTO stats_history (
        project_id, snapshot_date,
        facts_count, questions_count, questions_open,
        decisions_count, risks_count, risks_open,
        actions_count, actions_pending, people_count,
        documents_count, contacts_count
    )
    SELECT 
        p_project_id,
        v_today,
        (SELECT COUNT(*) FROM facts WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM knowledge_questions WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM knowledge_questions WHERE project_id = p_project_id AND deleted_at IS NULL AND status = 'open'),
        (SELECT COUNT(*) FROM decisions WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM risks WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM risks WHERE project_id = p_project_id AND deleted_at IS NULL AND status = 'open'),
        (SELECT COUNT(*) FROM action_items WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM action_items WHERE project_id = p_project_id AND deleted_at IS NULL AND status = 'pending'),
        (SELECT COUNT(*) FROM people WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM documents WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM contacts WHERE project_id = p_project_id AND deleted_at IS NULL)
    ON CONFLICT (project_id, snapshot_date) DO UPDATE SET
        facts_count = EXCLUDED.facts_count,
        questions_count = EXCLUDED.questions_count,
        questions_open = EXCLUDED.questions_open,
        decisions_count = EXCLUDED.decisions_count,
        risks_count = EXCLUDED.risks_count,
        risks_open = EXCLUDED.risks_open,
        actions_count = EXCLUDED.actions_count,
        actions_pending = EXCLUDED.actions_pending,
        people_count = EXCLUDED.people_count,
        documents_count = EXCLUDED.documents_count,
        contacts_count = EXCLUDED.contacts_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE project_config IS 'Project-specific configuration';
COMMENT ON TABLE stats_history IS 'Daily statistics snapshots for trends';
COMMENT ON TABLE sot_versions IS 'Source of Truth version history';
COMMENT ON TABLE sot_last_view IS 'Track last viewed SOT state per user';
COMMENT ON TABLE synthesized_files IS 'Track which files have been synthesized';
COMMENT ON TABLE raw_content IS 'Extracted raw content from documents';
COMMENT ON TABLE document_metadata IS 'Metadata for uploaded files';


-- ============================================
-- Migration: 008_optimizations.sql
-- ============================================

-- ============================================
-- GodMode Phase 8: Optimizations Tables
-- Query history, feedback, cache, jobs, sync
-- ============================================

-- ============================================
-- QUERY HISTORY
-- Track user queries for suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    query_text TEXT NOT NULL,
    query_type TEXT CHECK (query_type IN ('search', 'chat', 'graph', 'rag', 'other')),
    
    -- Performance
    execution_time_ms INTEGER,
    result_count INTEGER,
    
    -- Context
    source TEXT,
    
    -- Audit
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_history_project ON query_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_user ON query_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_text_trgm ON query_history USING gin(query_text gin_trgm_ops);

-- ============================================
-- SAVED SEARCHES
-- User saved searches
-- ============================================
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    
    -- Filters
    type_filter TEXT,
    date_filter TEXT,
    owner_filter TEXT,
    
    -- Usage
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_project ON saved_searches(project_id);

-- ============================================
-- USER FEEDBACK
-- Feedback on AI results
-- ============================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'correction', 'suggestion')),
    feedback_text TEXT,
    
    -- For corrections
    original_value TEXT,
    corrected_value TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'applied', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    -- Audit
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_project ON user_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_entity ON user_feedback(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status) WHERE status = 'pending';

-- ============================================
-- CACHE ENTRIES
-- General purpose cache
-- ============================================
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    cache_key TEXT NOT NULL,
    cache_value JSONB NOT NULL,
    
    -- TTL
    expires_at TIMESTAMPTZ,
    
    -- Stats
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_project ON cache_entries(project_id);

-- Function to cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_entries WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED JOBS
-- Background job scheduling
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    job_type TEXT NOT NULL,
    job_name TEXT NOT NULL,
    job_config JSONB DEFAULT '{}',
    
    -- Scheduling
    schedule_cron TEXT,
    schedule_interval INTERVAL,
    
    -- Execution
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_result JSONB,
    last_error TEXT,
    
    -- Stats
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_duration_ms INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON scheduled_jobs(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_project ON scheduled_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON scheduled_jobs(job_type);

-- ============================================
-- SYNC STATES
-- Track synchronization state
-- ============================================
CREATE TABLE IF NOT EXISTS sync_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    sync_type TEXT NOT NULL,
    
    -- State
    last_sync_at TIMESTAMPTZ,
    last_sync_cursor TEXT,
    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'paused')),
    
    -- Error tracking
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    
    -- Stats
    items_synced INTEGER DEFAULT 0,
    items_pending INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, sync_type)
);

CREATE INDEX IF NOT EXISTS idx_sync_states_project ON sync_states(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_states_status ON sync_states(sync_status) WHERE sync_status != 'idle';

-- ============================================
-- USAGE ANALYTICS
-- Track feature usage
-- ============================================
CREATE TABLE IF NOT EXISTS usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Event info
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    
    -- Context
    source TEXT,
    user_agent TEXT,
    
    -- Audit
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_analytics(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_event ON usage_analytics(event_type, event_name);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_analytics(created_at DESC);

-- Partition by month for large-scale usage (optional)
-- CREATE INDEX IF NOT EXISTS idx_usage_month ON usage_analytics(date_trunc('month', created_at));

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access query_history" ON query_history FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Users access own saved_searches" ON saved_searches FOR ALL 
    USING (user_id = auth.uid() AND is_project_member(project_id));

CREATE POLICY "Members access user_feedback" ON user_feedback FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access cache_entries" ON cache_entries FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

CREATE POLICY "Admins access scheduled_jobs" ON scheduled_jobs FOR ALL 
    USING (
        project_id IS NULL 
        OR EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = scheduled_jobs.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access sync_states" ON sync_states FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = sync_states.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Members access usage_analytics" ON usage_analytics FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS cache_entries_updated_at ON cache_entries;
CREATE TRIGGER cache_entries_updated_at
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER scheduled_jobs_updated_at
    BEFORE UPDATE ON scheduled_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sync_states_updated_at ON sync_states;
CREATE TRIGGER sync_states_updated_at
    BEFORE UPDATE ON sync_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE query_history IS 'Track user queries for suggestions';
COMMENT ON TABLE saved_searches IS 'User saved searches';
COMMENT ON TABLE user_feedback IS 'Feedback on AI results';
COMMENT ON TABLE cache_entries IS 'General purpose cache with TTL';
COMMENT ON TABLE scheduled_jobs IS 'Background job scheduling';
COMMENT ON TABLE sync_states IS 'Track synchronization state';
COMMENT ON TABLE usage_analytics IS 'Track feature usage';


-- ============================================
-- Migration: 009_roles_ontology.sql
-- ============================================

-- ============================================
-- GodMode Phase 9: Roles and Ontology Tables
-- Role analytics, history, ontology management
-- ============================================

-- ============================================
-- ROLE ANALYTICS
-- Track role usage analytics
-- ============================================
CREATE TABLE IF NOT EXISTS role_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    role_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_count INTEGER DEFAULT 1,
    
    -- Aggregation date
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(project_id, user_id, role_name, action_type, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_role_analytics_project ON role_analytics(project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_analytics_user ON role_analytics(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_analytics_role ON role_analytics(role_name);

-- ============================================
-- ROLE HISTORY
-- Track role changes over time
-- ============================================
CREATE TABLE IF NOT EXISTS role_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    previous_role TEXT,
    new_role TEXT NOT NULL,
    reason TEXT,
    
    -- Context
    context JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_history_project ON role_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_history_user ON role_history(user_id, created_at DESC);

-- ============================================
-- ONTOLOGY SUGGESTIONS
-- AI-generated ontology suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS ontology_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('entity', 'relation', 'pattern', 'rule')),
    suggestion_data JSONB NOT NULL,
    
    -- Source
    source_type TEXT,
    source_id UUID,
    source_text TEXT,
    
    -- Confidence and review
    confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
    
    -- Review
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ontology_suggestions_project ON ontology_suggestions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_ontology_suggestions_type ON ontology_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ontology_suggestions_pending ON ontology_suggestions(project_id) WHERE status = 'pending';

-- ============================================
-- ONTOLOGY SCHEMA
-- Store ontology schema definitions
-- ============================================
CREATE TABLE IF NOT EXISTS ontology_schema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Schema can be global (project_id = NULL) or project-specific
    schema_type TEXT NOT NULL CHECK (schema_type IN ('entity', 'relation', 'query_pattern', 'inference_rule')),
    schema_name TEXT NOT NULL,
    schema_definition JSONB NOT NULL,
    
    -- Version
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, schema_type, schema_name)
);

CREATE INDEX IF NOT EXISTS idx_ontology_schema_project ON ontology_schema(project_id);
CREATE INDEX IF NOT EXISTS idx_ontology_schema_type ON ontology_schema(schema_type);
CREATE INDEX IF NOT EXISTS idx_ontology_schema_active ON ontology_schema(is_active) WHERE is_active = TRUE;

-- ============================================
-- CALENDAR EVENTS
-- Calendar integration data
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('meeting', 'deadline', 'milestone', 'reminder', 'other')),
    
    -- Timing
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT FALSE,
    timezone TEXT DEFAULT 'UTC',
    
    -- Recurrence
    recurrence_rule TEXT,
    recurrence_end DATE,
    
    -- Location
    location TEXT,
    meeting_url TEXT,
    
    -- Linked entities
    linked_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    linked_action_id UUID REFERENCES action_items(id) ON DELETE SET NULL,
    linked_contact_ids UUID[] DEFAULT '{}',
    
    -- External calendar
    external_id TEXT,
    external_source TEXT,
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_project ON calendar_events(project_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_external ON calendar_events(external_id, external_source) WHERE external_id IS NOT NULL;

-- ============================================
-- ROLE TEMPLATES
-- Predefined role templates
-- ============================================
CREATE TABLE IF NOT EXISTS role_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    
    -- Template configuration
    prompt_template TEXT,
    focus_areas TEXT[],
    dashboard_config JSONB DEFAULT '{}',
    filter_config JSONB DEFAULT '{}',
    
    -- Category
    category TEXT CHECK (category IN ('technical', 'management', 'executive', 'operations', 'custom')),
    
    -- Flags
    is_builtin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_templates_category ON role_templates(category);
CREATE INDEX IF NOT EXISTS idx_role_templates_active ON role_templates(is_active) WHERE is_active = TRUE;

-- Insert default role templates
INSERT INTO role_templates (name, display_name, description, category, is_builtin, focus_areas, prompt_template) VALUES
    ('project_manager', 'Project Manager', 'Focus on timelines, risks, and deliverables', 'management', TRUE, 
     ARRAY['risks', 'actions', 'timeline', 'decisions'], 
     'You are a Project Manager focused on delivery timelines, risk mitigation, and team coordination.'),
    ('tech_lead', 'Technical Lead', 'Focus on technical decisions and architecture', 'technical', TRUE,
     ARRAY['technical', 'decisions', 'architecture', 'risks'],
     'You are a Technical Lead focused on architecture decisions, technical risks, and implementation details.'),
    ('executive', 'Executive', 'High-level overview and strategic decisions', 'executive', TRUE,
     ARRAY['decisions', 'risks', 'summary', 'metrics'],
     'You are an Executive focused on strategic decisions, key metrics, and high-level project status.'),
    ('analyst', 'Business Analyst', 'Requirements and stakeholder management', 'operations', TRUE,
     ARRAY['requirements', 'questions', 'stakeholders', 'processes'],
     'You are a Business Analyst focused on requirements clarity, stakeholder alignment, and process improvement.')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE role_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology_schema ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access role_analytics" ON role_analytics FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access role_history" ON role_history FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access ontology_suggestions" ON ontology_suggestions FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access ontology_schema" ON ontology_schema FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

CREATE POLICY "Members access calendar_events" ON calendar_events FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Anyone can read role_templates" ON role_templates FOR SELECT 
    USING (TRUE);

CREATE POLICY "Admins manage role_templates" ON role_templates FOR ALL 
    USING (
        is_builtin = FALSE 
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS ontology_schema_updated_at ON ontology_schema;
CREATE TRIGGER ontology_schema_updated_at
    BEFORE UPDATE ON ontology_schema
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS calendar_events_updated_at ON calendar_events;
CREATE TRIGGER calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS role_templates_updated_at ON role_templates;
CREATE TRIGGER role_templates_updated_at
    BEFORE UPDATE ON role_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE role_analytics IS 'Track role usage analytics';
COMMENT ON TABLE role_history IS 'Track role changes over time';
COMMENT ON TABLE ontology_suggestions IS 'AI-generated ontology suggestions';
COMMENT ON TABLE ontology_schema IS 'Store ontology schema definitions';
COMMENT ON TABLE calendar_events IS 'Calendar integration data';
COMMENT ON TABLE role_templates IS 'Predefined role templates';


-- ============================================
-- Migration: 010_llm_costs.sql
-- ============================================

-- ============================================
-- GodMode Phase 10: LLM Cost Tracking
-- Track LLM API usage and costs
-- ============================================

-- ============================================
-- LLM COST REQUESTS
-- Individual LLM request records
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Request details
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT CHECK (operation IN ('generateText', 'generateVision', 'embed', 'chat', 'completion', 'other')),
    
    -- Tokens
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- Cost (in USD with high precision)
    cost DECIMAL(12,8) DEFAULT 0,
    input_cost DECIMAL(12,8) DEFAULT 0,
    output_cost DECIMAL(12,8) DEFAULT 0,
    
    -- Performance
    latency_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_code TEXT,
    error_message TEXT,
    
    -- Context
    request_type TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID REFERENCES auth.users(id)
);

-- Partition-ready indexes
CREATE INDEX IF NOT EXISTS idx_llm_requests_project ON llm_cost_requests(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_provider ON llm_cost_requests(provider, model);
CREATE INDEX IF NOT EXISTS idx_llm_requests_date ON llm_cost_requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_operation ON llm_cost_requests(operation);

-- ============================================
-- LLM COST TOTALS
-- Aggregate totals per project
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_totals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    
    -- Totals
    total_cost DECIMAL(14,6) DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    
    -- Timestamps
    first_request TIMESTAMPTZ,
    last_request TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_totals_project ON llm_cost_totals(project_id);

-- ============================================
-- LLM COST DAILY
-- Daily aggregates for charting
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    
    -- Totals for the day
    cost DECIMAL(12,6) DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    
    -- Breakdowns
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_llm_daily_project ON llm_cost_daily(project_id, date DESC);

-- ============================================
-- LLM COST BY MODEL
-- Aggregates per provider/model
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_by_model (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    
    -- Totals
    cost DECIMAL(12,6) DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    
    -- Performance
    avg_latency_ms DECIMAL(10,2),
    success_rate DECIMAL(5,2),
    
    -- Timestamps
    first_use TIMESTAMPTZ,
    last_use TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_llm_model_project ON llm_cost_by_model(project_id);
CREATE INDEX IF NOT EXISTS idx_llm_model_provider ON llm_cost_by_model(provider, model);

-- ============================================
-- LLM COST BY PROVIDER
-- Aggregates per provider
-- ============================================
CREATE TABLE IF NOT EXISTS llm_cost_by_provider (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    provider TEXT NOT NULL,
    
    -- Totals
    cost DECIMAL(12,6) DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    
    -- Model count
    models_used INTEGER DEFAULT 0,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_llm_provider_project ON llm_cost_by_provider(project_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to track LLM cost
CREATE OR REPLACE FUNCTION track_llm_cost(
    p_project_id UUID,
    p_provider TEXT,
    p_model TEXT,
    p_operation TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_cost DECIMAL,
    p_latency_ms INTEGER,
    p_success BOOLEAN,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Insert request record
    INSERT INTO llm_cost_requests (
        project_id, provider, model, operation,
        input_tokens, output_tokens, cost,
        latency_ms, success, created_by
    ) VALUES (
        p_project_id, p_provider, p_model, p_operation,
        p_input_tokens, p_output_tokens, p_cost,
        p_latency_ms, p_success, p_user_id
    ) RETURNING id INTO v_request_id;
    
    -- Update totals
    INSERT INTO llm_cost_totals (project_id, total_cost, total_input_tokens, total_output_tokens, total_requests, first_request, last_request)
    VALUES (p_project_id, p_cost, p_input_tokens, p_output_tokens, 1, now(), now())
    ON CONFLICT (project_id) DO UPDATE SET
        total_cost = llm_cost_totals.total_cost + p_cost,
        total_input_tokens = llm_cost_totals.total_input_tokens + p_input_tokens,
        total_output_tokens = llm_cost_totals.total_output_tokens + p_output_tokens,
        total_requests = llm_cost_totals.total_requests + 1,
        last_request = now(),
        updated_at = now();
    
    -- Update daily
    INSERT INTO llm_cost_daily (project_id, date, cost, input_tokens, output_tokens, requests, successful_requests, failed_requests)
    VALUES (
        p_project_id, v_today, p_cost, p_input_tokens, p_output_tokens, 1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END
    )
    ON CONFLICT (project_id, date) DO UPDATE SET
        cost = llm_cost_daily.cost + p_cost,
        input_tokens = llm_cost_daily.input_tokens + p_input_tokens,
        output_tokens = llm_cost_daily.output_tokens + p_output_tokens,
        requests = llm_cost_daily.requests + 1,
        successful_requests = llm_cost_daily.successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_requests = llm_cost_daily.failed_requests + CASE WHEN p_success THEN 0 ELSE 1 END,
        updated_at = now();
    
    -- Update by model
    INSERT INTO llm_cost_by_model (project_id, provider, model, cost, input_tokens, output_tokens, requests, avg_latency_ms, first_use, last_use)
    VALUES (p_project_id, p_provider, p_model, p_cost, p_input_tokens, p_output_tokens, 1, p_latency_ms, now(), now())
    ON CONFLICT (project_id, provider, model) DO UPDATE SET
        cost = llm_cost_by_model.cost + p_cost,
        input_tokens = llm_cost_by_model.input_tokens + p_input_tokens,
        output_tokens = llm_cost_by_model.output_tokens + p_output_tokens,
        requests = llm_cost_by_model.requests + 1,
        avg_latency_ms = (llm_cost_by_model.avg_latency_ms * (llm_cost_by_model.requests - 1) + p_latency_ms) / llm_cost_by_model.requests,
        last_use = now(),
        updated_at = now();
    
    -- Update by provider
    INSERT INTO llm_cost_by_provider (project_id, provider, cost, input_tokens, output_tokens, requests, models_used)
    VALUES (p_project_id, p_provider, p_cost, p_input_tokens, p_output_tokens, 1, 1)
    ON CONFLICT (project_id, provider) DO UPDATE SET
        cost = llm_cost_by_provider.cost + p_cost,
        input_tokens = llm_cost_by_provider.input_tokens + p_input_tokens,
        output_tokens = llm_cost_by_provider.output_tokens + p_output_tokens,
        requests = llm_cost_by_provider.requests + 1,
        models_used = (SELECT COUNT(DISTINCT model) FROM llm_cost_by_model WHERE project_id = p_project_id AND provider = p_provider),
        updated_at = now();
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cost summary
CREATE OR REPLACE FUNCTION get_llm_cost_summary(p_project_id UUID)
RETURNS TABLE (
    total_cost DECIMAL,
    total_tokens BIGINT,
    total_requests INTEGER,
    cost_today DECIMAL,
    cost_this_month DECIMAL,
    top_model TEXT,
    top_provider TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(t.total_cost, 0) as total_cost,
        COALESCE(t.total_input_tokens + t.total_output_tokens, 0) as total_tokens,
        COALESCE(t.total_requests, 0) as total_requests,
        COALESCE(d.cost, 0) as cost_today,
        COALESCE(m.cost, 0) as cost_this_month,
        (SELECT model FROM llm_cost_by_model WHERE project_id = p_project_id ORDER BY requests DESC LIMIT 1) as top_model,
        (SELECT provider FROM llm_cost_by_provider WHERE project_id = p_project_id ORDER BY requests DESC LIMIT 1) as top_provider
    FROM llm_cost_totals t
    LEFT JOIN llm_cost_daily d ON d.project_id = p_project_id AND d.date = CURRENT_DATE
    LEFT JOIN (
        SELECT project_id, SUM(cost) as cost 
        FROM llm_cost_daily 
        WHERE project_id = p_project_id 
        AND date >= date_trunc('month', CURRENT_DATE)
        GROUP BY project_id
    ) m ON m.project_id = p_project_id
    WHERE t.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE llm_cost_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_by_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cost_by_provider ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access llm_cost_requests" ON llm_cost_requests FOR ALL 
    USING (project_id IS NULL OR is_project_member(project_id));

CREATE POLICY "Members access llm_cost_totals" ON llm_cost_totals FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access llm_cost_daily" ON llm_cost_daily FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access llm_cost_by_model" ON llm_cost_by_model FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Members access llm_cost_by_provider" ON llm_cost_by_provider FOR ALL 
    USING (is_project_member(project_id));

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE llm_cost_requests IS 'Individual LLM request records';
COMMENT ON TABLE llm_cost_totals IS 'Aggregate totals per project';
COMMENT ON TABLE llm_cost_daily IS 'Daily aggregates for charting';
COMMENT ON TABLE llm_cost_by_model IS 'Aggregates per provider/model';
COMMENT ON TABLE llm_cost_by_provider IS 'Aggregates per provider';
COMMENT ON FUNCTION track_llm_cost IS 'Track LLM cost and update all aggregates';
COMMENT ON FUNCTION get_llm_cost_summary IS 'Get cost summary for a project';


-- ============================================
-- Migration: 011_sync_tables.sql
-- ============================================

-- ============================================
-- GodMode Phase 11: Sync and Delete Tables
-- Delete tracking, audit, backups, retention
-- ============================================

-- ============================================
-- DELETE STATS
-- Track deletion statistics
-- ============================================
CREATE TABLE IF NOT EXISTS delete_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    
    -- Counts
    total_deleted INTEGER DEFAULT 0,
    total_restored INTEGER DEFAULT 0,
    total_purged INTEGER DEFAULT 0,
    
    -- Timestamps
    last_delete_at TIMESTAMPTZ,
    last_restore_at TIMESTAMPTZ,
    last_purge_at TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_delete_stats_project ON delete_stats(project_id);

-- ============================================
-- DELETE AUDIT LOG
-- Audit trail for delete operations
-- ============================================
CREATE TABLE IF NOT EXISTS delete_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    action TEXT NOT NULL CHECK (action IN ('delete', 'soft_delete', 'restore', 'purge', 'cascade_delete')),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Snapshot of deleted data
    entity_snapshot JSONB,
    
    -- Cascade info
    cascade_count INTEGER DEFAULT 0,
    cascaded_entities JSONB,
    
    -- Context
    reason TEXT,
    
    -- Audit
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT now(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_delete_audit_project ON delete_audit_log(project_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_delete_audit_entity ON delete_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_delete_audit_action ON delete_audit_log(action);

-- ============================================
-- DELETE BACKUPS
-- Backups before deletion for recovery
-- ============================================
CREATE TABLE IF NOT EXISTS delete_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    backup_data JSONB NOT NULL,
    
    -- Related entities backup
    related_data JSONB,
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Restoration
    restored BOOLEAN DEFAULT FALSE,
    restored_at TIMESTAMPTZ,
    restored_by UUID REFERENCES auth.users(id),
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delete_backups_project ON delete_backups(project_id);
CREATE INDEX IF NOT EXISTS idx_delete_backups_entity ON delete_backups(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_delete_backups_expires ON delete_backups(expires_at) WHERE restored = FALSE;
CREATE INDEX IF NOT EXISTS idx_delete_backups_unrestored ON delete_backups(project_id, created_at DESC) WHERE restored = FALSE;

-- ============================================
-- RETENTION POLICIES
-- Define data retention rules
-- ============================================
CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    policy_name TEXT NOT NULL,
    policy_description TEXT,
    
    -- Target
    entity_type TEXT NOT NULL,
    
    -- Retention rules
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    
    -- Conditions (JSONB for flexibility)
    conditions JSONB DEFAULT '{}',
    
    -- Actions
    action_on_expire TEXT DEFAULT 'soft_delete' CHECK (action_on_expire IN ('soft_delete', 'purge', 'archive', 'notify')),
    
    -- Execution
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    items_affected INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, policy_name)
);

CREATE INDEX IF NOT EXISTS idx_retention_project ON retention_policies(project_id);
CREATE INDEX IF NOT EXISTS idx_retention_active ON retention_policies(next_run_at) WHERE is_active = TRUE;

-- ============================================
-- SOFT DELETES
-- Track soft-deleted items
-- ============================================
CREATE TABLE IF NOT EXISTS soft_deletes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_data JSONB NOT NULL,
    
    -- Deletion info
    deleted_by UUID REFERENCES auth.users(id),
    deleted_at TIMESTAMPTZ DEFAULT now(),
    delete_reason TEXT,
    
    -- Restoration deadline
    restore_deadline TIMESTAMPTZ,
    
    -- Purge tracking
    purged BOOLEAN DEFAULT FALSE,
    purged_at TIMESTAMPTZ,
    purged_by UUID REFERENCES auth.users(id),
    
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_soft_deletes_project ON soft_deletes(project_id);
CREATE INDEX IF NOT EXISTS idx_soft_deletes_entity ON soft_deletes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_soft_deletes_deadline ON soft_deletes(restore_deadline) WHERE purged = FALSE;
CREATE INDEX IF NOT EXISTS idx_soft_deletes_unpurged ON soft_deletes(project_id, deleted_at DESC) WHERE purged = FALSE;

-- ============================================
-- ARCHIVE
-- Long-term archive of deleted data
-- ============================================
CREATE TABLE IF NOT EXISTS archive (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_data JSONB NOT NULL,
    
    -- Archive info
    archived_from TEXT,
    archived_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    archived_by UUID REFERENCES auth.users(id),
    archived_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_project ON archive(project_id);
CREATE INDEX IF NOT EXISTS idx_archive_entity ON archive(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_archive_date ON archive(archived_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to record delete stats
CREATE OR REPLACE FUNCTION update_delete_stats(
    p_project_id UUID,
    p_entity_type TEXT,
    p_action TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO delete_stats (project_id, entity_type)
    VALUES (p_project_id, p_entity_type)
    ON CONFLICT (project_id, entity_type) DO NOTHING;
    
    IF p_action = 'delete' OR p_action = 'soft_delete' THEN
        UPDATE delete_stats 
        SET total_deleted = total_deleted + 1, last_delete_at = now(), updated_at = now()
        WHERE project_id = p_project_id AND entity_type = p_entity_type;
    ELSIF p_action = 'restore' THEN
        UPDATE delete_stats 
        SET total_restored = total_restored + 1, last_restore_at = now(), updated_at = now()
        WHERE project_id = p_project_id AND entity_type = p_entity_type;
    ELSIF p_action = 'purge' THEN
        UPDATE delete_stats 
        SET total_purged = total_purged + 1, last_purge_at = now(), updated_at = now()
        WHERE project_id = p_project_id AND entity_type = p_entity_type;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired backups
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM delete_backups 
    WHERE expires_at < now() AND restored = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired soft deletes
CREATE OR REPLACE FUNCTION cleanup_expired_soft_deletes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE soft_deletes 
    SET purged = TRUE, purged_at = now()
    WHERE restore_deadline < now() AND purged = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE delete_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE delete_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE delete_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE soft_deletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins access delete_stats" ON delete_stats FOR ALL 
    USING (
        project_id IS NULL
        OR EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = delete_stats.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access delete_audit_log" ON delete_audit_log FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = delete_audit_log.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access delete_backups" ON delete_backups FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = delete_backups.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access retention_policies" ON retention_policies FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = retention_policies.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access soft_deletes" ON soft_deletes FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = soft_deletes.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins access archive" ON archive FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = archive.project_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS retention_policies_updated_at ON retention_policies;
CREATE TRIGGER retention_policies_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE delete_stats IS 'Track deletion statistics';
COMMENT ON TABLE delete_audit_log IS 'Audit trail for delete operations';
COMMENT ON TABLE delete_backups IS 'Backups before deletion for recovery';
COMMENT ON TABLE retention_policies IS 'Define data retention rules';
COMMENT ON TABLE soft_deletes IS 'Track soft-deleted items';
COMMENT ON TABLE archive IS 'Long-term archive of deleted data';
COMMENT ON FUNCTION update_delete_stats IS 'Record delete stats updates';
COMMENT ON FUNCTION cleanup_expired_backups IS 'Cleanup expired backup records';
COMMENT ON FUNCTION cleanup_expired_soft_deletes IS 'Purge expired soft deletes';


