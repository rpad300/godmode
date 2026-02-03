-- ============================================
-- GodMode Phase 23: AI Analysis Log
-- Track detailed AI analysis history per document
-- ============================================

-- ============================================
-- AI ANALYSIS LOG
-- Stores prompt, response, and results for each AI analysis
-- ============================================
CREATE TABLE IF NOT EXISTS ai_analysis_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Type of analysis
    analysis_type TEXT NOT NULL CHECK (analysis_type IN (
        'extraction',      -- Entity extraction (facts, decisions, etc)
        'summary',         -- Document summarization
        'classification',  -- Tagging/classification
        'embedding',       -- Vector embedding generation
        'vision',          -- OCR/image analysis
        'chat',            -- Q&A about document
        'custom'           -- Custom analysis
    )),
    
    -- Input
    prompt_template TEXT,          -- Template name used
    prompt_text TEXT,              -- Full prompt sent to LLM
    input_content TEXT,            -- Document content (may be truncated)
    input_tokens INTEGER,
    
    -- Output
    response_raw TEXT,             -- Raw LLM response
    response_parsed JSONB,         -- Parsed/structured response
    output_tokens INTEGER,
    
    -- Model and performance
    provider TEXT NOT NULL,        -- openai, anthropic, ollama, etc
    model TEXT NOT NULL,           -- gpt-4, claude-3, etc
    temperature DECIMAL(3,2),
    latency_ms INTEGER,
    cost DECIMAL(12,8),
    
    -- Result
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
    error_message TEXT,
    entities_extracted INTEGER,    -- Count of extracted entities
    
    -- Versioning for comparison
    version INTEGER DEFAULT 1,
    parent_analysis_id UUID REFERENCES ai_analysis_log(id),
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ai_log_document ON ai_analysis_log(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_project ON ai_analysis_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_type ON ai_analysis_log(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_log_model ON ai_analysis_log(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_log_status ON ai_analysis_log(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE ai_analysis_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access ai_analysis_log" ON ai_analysis_log FOR ALL 
    USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE ai_analysis_log IS 'Detailed log of AI analyses performed on documents';
COMMENT ON COLUMN ai_analysis_log.analysis_type IS 'Type of AI analysis performed';
COMMENT ON COLUMN ai_analysis_log.prompt_text IS 'Full prompt sent to the LLM';
COMMENT ON COLUMN ai_analysis_log.response_raw IS 'Raw response from the LLM';
COMMENT ON COLUMN ai_analysis_log.response_parsed IS 'Parsed/structured response data';
COMMENT ON COLUMN ai_analysis_log.version IS 'Version number for comparing multiple runs';
COMMENT ON COLUMN ai_analysis_log.parent_analysis_id IS 'Reference to previous analysis for re-runs';
