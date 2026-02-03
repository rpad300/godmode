-- ============================================
-- Team Analysis Evidence Bank
-- Stores important quotes and evidence supporting behavioral analysis
-- ============================================

-- ============================================
-- EVIDENCE SNIPPETS
-- Stores key quotes that support profile conclusions
-- ============================================
CREATE TABLE IF NOT EXISTS profile_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES team_profiles(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    
    -- Evidence content
    quote TEXT NOT NULL,
    context TEXT, -- What prompted this statement
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_filename TEXT,
    timestamp_in_transcript TEXT,
    
    -- Categorization
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'communication_style',
        'motivation',
        'pressure_response',
        'influence_tactic',
        'vulnerability',
        'defense_trigger',
        'cooperation_signal',
        'power_indicator',
        'warning_sign',
        'relationship_dynamic'
    )),
    
    -- What this evidence supports
    supports_trait TEXT, -- e.g., "direct communication", "avoids conflict"
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
    
    -- Metadata
    extracted_at TIMESTAMPTZ DEFAULT now(),
    is_primary BOOLEAN DEFAULT false, -- Primary evidence for this trait
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_evidence_profile ON profile_evidence(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_evidence_person ON profile_evidence(person_id);
CREATE INDEX IF NOT EXISTS idx_profile_evidence_type ON profile_evidence(project_id, evidence_type);
CREATE INDEX IF NOT EXISTS idx_profile_evidence_document ON profile_evidence(source_document_id);

-- ============================================
-- EXTRACTED INTERVENTIONS CACHE
-- Caches extracted interventions per person per document
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    
    -- Extracted content
    interventions JSONB NOT NULL DEFAULT '[]', -- Array of {timestamp, text, context, word_count}
    total_word_count INTEGER DEFAULT 0,
    intervention_count INTEGER DEFAULT 0,
    
    -- Processing metadata
    extracted_at TIMESTAMPTZ DEFAULT now(),
    extraction_version TEXT DEFAULT '1.0'
);

-- Unique constraint: one cache per person per document
CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_unique ON transcript_interventions(project_id, document_id, person_id);
CREATE INDEX IF NOT EXISTS idx_interventions_person ON transcript_interventions(person_id);
CREATE INDEX IF NOT EXISTS idx_interventions_document ON transcript_interventions(document_id);

-- ============================================
-- ADD COLUMNS TO TEAM_PROFILES
-- ============================================
ALTER TABLE team_profiles ADD COLUMN IF NOT EXISTS evidence_count INTEGER DEFAULT 0;
ALTER TABLE team_profiles ADD COLUMN IF NOT EXISTS last_incremental_analysis_at TIMESTAMPTZ;
ALTER TABLE team_profiles ADD COLUMN IF NOT EXISTS analysis_version TEXT DEFAULT '1.0';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profile_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_interventions ENABLE ROW LEVEL SECURITY;

-- Profile Evidence policies
CREATE POLICY "Members access profile_evidence" ON profile_evidence FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Service role profile_evidence" ON profile_evidence
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Transcript Interventions policies
CREATE POLICY "Members access transcript_interventions" ON transcript_interventions FOR ALL 
    USING (is_project_member(project_id));

CREATE POLICY "Service role transcript_interventions" ON transcript_interventions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get evidence summary for a profile
CREATE OR REPLACE FUNCTION get_profile_evidence_summary(p_profile_id UUID)
RETURNS TABLE (
    evidence_type TEXT,
    count BIGINT,
    primary_count BIGINT,
    traits TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.evidence_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE pe.is_primary) as primary_count,
        ARRAY_AGG(DISTINCT pe.supports_trait) FILTER (WHERE pe.supports_trait IS NOT NULL) as traits
    FROM profile_evidence pe
    WHERE pe.profile_id = p_profile_id
    GROUP BY pe.evidence_type
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get total intervention stats for a person
CREATE OR REPLACE FUNCTION get_person_intervention_stats(p_project_id UUID, p_person_id UUID)
RETURNS TABLE (
    total_documents INTEGER,
    total_interventions INTEGER,
    total_word_count INTEGER,
    avg_intervention_length NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ti.document_id)::INTEGER as total_documents,
        SUM(ti.intervention_count)::INTEGER as total_interventions,
        SUM(ti.total_word_count)::INTEGER as total_word_count,
        ROUND(AVG(ti.total_word_count::NUMERIC / NULLIF(ti.intervention_count, 0)), 2) as avg_intervention_length
    FROM transcript_interventions ti
    WHERE ti.project_id = p_project_id AND ti.person_id = p_person_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE profile_evidence IS 'Stores key quotes and evidence supporting behavioral profile conclusions';
COMMENT ON TABLE transcript_interventions IS 'Caches extracted interventions per person per document for efficient re-analysis';
