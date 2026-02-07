-- Migration: 017_briefings_history.sql
-- Description: Store daily briefings history for caching and tracking changes
-- Date: 2026-01-30

-- ============================================
-- BRIEFINGS TABLE
-- Stores generated briefings with data hash for change detection
-- ============================================
CREATE TABLE IF NOT EXISTS briefings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Briefing content
    content JSONB NOT NULL,  -- Full briefing object
    summary TEXT,            -- Quick summary text
    
    -- Change detection
    data_hash TEXT NOT NULL, -- Hash of project data state (facts, questions, etc.)
    
    -- Stats snapshot at time of briefing
    stats_snapshot JSONB,    -- { facts: 5, questions: 2, decisions: 3, ... }
    
    -- Metadata
    provider TEXT,           -- LLM provider used (openai, ollama, etc.)
    model TEXT,              -- Model used
    tokens_used INTEGER,     -- Total tokens consumed
    generation_time_ms INTEGER, -- Time to generate
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Allow null for manual/imported briefings
    created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookup of latest briefing per project
CREATE INDEX IF NOT EXISTS idx_briefings_project_created ON briefings(project_id, created_at DESC);

-- Index for hash lookup (cache hit check)
CREATE INDEX IF NOT EXISTS idx_briefings_hash ON briefings(project_id, data_hash);

-- RLS Policies
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view briefings for their projects" ON briefings
    FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM project_members WHERE project_id = briefings.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Service role full access to briefings" ON briefings
    FOR ALL USING (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE briefings IS 'Historical daily briefings with change detection for caching';
