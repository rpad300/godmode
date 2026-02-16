-- ============================================
-- GodMode Phase 1 & 2: Schema Alignment
-- Adds missing columns for AI processing and soft deletes
-- ============================================

-- 1. Add AI metadata columns to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_path TEXT;

-- 2. Ensure soft delete consistency (already in 005 but ensuring for legacy)
-- (No action needed if tables defined in 005 are active)

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_documents_ai_title_trgm ON documents USING gin(ai_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_content_path ON documents(content_path);

-- 4. Sync Status Table (if not exists)
CREATE TABLE IF NOT EXISTS graph_sync_status (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    graph_name TEXT NOT NULL,
    
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    pending_count INTEGER DEFAULT 0,
    
    last_synced_at TIMESTAMPTZ,
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    health_status TEXT DEFAULT 'unknown',
    
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (project_id, graph_name)
);

-- 5. Raw Content Table (Phase 2.3)
CREATE TABLE IF NOT EXISTS raw_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    content TEXT,
    content_hash TEXT,
    chunk_index INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_content_doc ON raw_content(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_content_doc_chunk ON raw_content(document_id, chunk_index);

-- 6. Synthesized Files Tracking (Phase 2.2)
CREATE TABLE IF NOT EXISTS synthesized_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_hash TEXT,
    synthesized_at TIMESTAMPTZ,
    
    facts_extracted INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(project_id, filename)
);
