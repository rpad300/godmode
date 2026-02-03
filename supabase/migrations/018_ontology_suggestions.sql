-- ============================================
-- GodMode: Ontology Suggestions Persistence
-- Stores ontology agent suggestions in Supabase
-- ============================================

-- Table for ontology suggestions (pending, approved, rejected)
CREATE TABLE IF NOT EXISTS ontology_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Suggestion details
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('new_entity', 'new_relation', 'missing_entity', 'missing_relation')),
    name TEXT NOT NULL,
    description TEXT,
    
    -- For relations
    from_types TEXT[],
    to_types TEXT[],
    
    -- Properties and enrichment
    properties JSONB DEFAULT '[]',
    enrichment JSONB,
    
    -- Source tracking
    source_file TEXT,
    example TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ontology_suggestions_project ON ontology_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_ontology_suggestions_status ON ontology_suggestions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_ontology_suggestions_type ON ontology_suggestions(project_id, suggestion_type);

-- RLS
ALTER TABLE ontology_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members access ontology suggestions" ON ontology_suggestions
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM project_members WHERE project_id = ontology_suggestions.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Service role full access to ontology_suggestions" ON ontology_suggestions
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS ontology_suggestions_updated_at ON ontology_suggestions;
CREATE TRIGGER ontology_suggestions_updated_at
    BEFORE UPDATE ON ontology_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ontology_suggestions IS 'Ontology agent suggestions for new entity types and relationships';
