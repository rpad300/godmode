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
