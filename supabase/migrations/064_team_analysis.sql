-- ============================================
-- Team Analysis Tables
-- Behavioral profiling and team dynamics analysis
-- ============================================

-- ============================================
-- TEAM PROFILES
-- Individual behavioral profiles based on transcript analysis
-- ============================================
CREATE TABLE IF NOT EXISTS team_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    
    -- Profile data (structured JSON matching the analysis prompt output)
    profile_data JSONB NOT NULL DEFAULT '{}',
    
    -- Summary fields for quick access
    confidence_level TEXT DEFAULT 'low' CHECK (confidence_level IN ('low', 'medium', 'high', 'very_high')),
    communication_style TEXT,
    dominant_motivation TEXT,
    risk_tolerance TEXT CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    influence_score INTEGER DEFAULT 0 CHECK (influence_score >= 0 AND influence_score <= 100),
    
    -- Analysis metadata
    transcripts_analyzed UUID[] DEFAULT '{}',
    transcript_count INTEGER DEFAULT 0,
    total_speaking_time_seconds INTEGER DEFAULT 0,
    
    -- Limitations and recommendations
    limitations TEXT[],
    recommended_update_after TEXT,
    
    -- Timestamps
    last_analysis_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one profile per person per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_profiles_unique ON team_profiles(project_id, person_id);
CREATE INDEX IF NOT EXISTS idx_team_profiles_project ON team_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_team_profiles_person ON team_profiles(person_id);
CREATE INDEX IF NOT EXISTS idx_team_profiles_confidence ON team_profiles(project_id, confidence_level);
CREATE INDEX IF NOT EXISTS idx_team_profiles_influence ON team_profiles(project_id, influence_score DESC);
CREATE INDEX IF NOT EXISTS idx_team_profiles_data ON team_profiles USING GIN(profile_data);

-- ============================================
-- TEAM ANALYSIS
-- Team-level dynamics analysis
-- ============================================
CREATE TABLE IF NOT EXISTS team_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Analysis data
    analysis_data JSONB NOT NULL DEFAULT '{}',
    
    -- Summary metrics
    team_size INTEGER DEFAULT 0,
    cohesion_score INTEGER CHECK (cohesion_score >= 0 AND cohesion_score <= 100),
    tension_level TEXT CHECK (tension_level IN ('low', 'medium', 'high')),
    dominant_communication_pattern TEXT,
    
    -- Influence map (who influences whom)
    influence_map JSONB DEFAULT '[]',
    
    -- Alliances and tensions
    alliances JSONB DEFAULT '[]',
    tensions JSONB DEFAULT '[]',
    
    -- Members included in analysis
    members_included UUID[] DEFAULT '{}',
    transcripts_analyzed UUID[] DEFAULT '{}',
    
    -- Timestamps
    last_analysis_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- One active analysis per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_analysis_project ON team_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_team_analysis_cohesion ON team_analysis(cohesion_score DESC);
CREATE INDEX IF NOT EXISTS idx_team_analysis_data ON team_analysis USING GIN(analysis_data);

-- ============================================
-- TEAM ANALYSIS HISTORY
-- Track evolution of profiles over time
-- ============================================
CREATE TABLE IF NOT EXISTS team_analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- What changed
    entity_type TEXT NOT NULL CHECK (entity_type IN ('profile', 'team_analysis')),
    entity_id UUID NOT NULL,
    
    -- Snapshot of the analysis at this point
    snapshot_data JSONB NOT NULL,
    
    -- What triggered the update
    trigger_type TEXT CHECK (trigger_type IN ('auto', 'manual', 'new_transcript')),
    trigger_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Diff from previous version (optional)
    changes_summary TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_history_project ON team_analysis_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_history_entity ON team_analysis_history(entity_type, entity_id);

-- ============================================
-- BEHAVIORAL RELATIONSHIPS
-- Detected interpersonal dynamics
-- ============================================
CREATE TABLE IF NOT EXISTS behavioral_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- People involved
    from_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    to_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    
    -- Relationship type
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'influences', 'aligned_with', 'tension_with', 
        'defers_to', 'competes_with', 'mentors', 'supports'
    )),
    
    -- Strength and confidence
    strength REAL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
    
    -- Evidence
    evidence JSONB DEFAULT '[]',
    evidence_count INTEGER DEFAULT 0,
    
    -- Metadata
    first_observed_at TIMESTAMPTZ DEFAULT now(),
    last_observed_at TIMESTAMPTZ DEFAULT now(),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one relationship type per pair per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_behavioral_rel_unique 
    ON behavioral_relationships(project_id, from_person_id, to_person_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_behavioral_rel_project ON behavioral_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_rel_from ON behavioral_relationships(from_person_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_rel_to ON behavioral_relationships(to_person_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_rel_type ON behavioral_relationships(project_id, relationship_type);

-- ============================================
-- PROJECT CONFIG EXTENSION
-- Add team analysis access configuration
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_analysis_access TEXT DEFAULT 'admin_only';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_analysis_enabled BOOLEAN DEFAULT true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE team_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_relationships ENABLE ROW LEVEL SECURITY;

-- Team Profiles policies
CREATE POLICY "Members access team_profiles" ON team_profiles FOR ALL 
    USING (is_project_member(project_id));

-- Team Analysis policies
CREATE POLICY "Members access team_analysis" ON team_analysis FOR ALL 
    USING (is_project_member(project_id));

-- Team Analysis History policies
CREATE POLICY "Members access team_analysis_history" ON team_analysis_history FOR ALL 
    USING (is_project_member(project_id));

-- Behavioral Relationships policies
CREATE POLICY "Members access behavioral_relationships" ON behavioral_relationships FOR ALL 
    USING (is_project_member(project_id));

-- Service role full access
CREATE POLICY "Service role team_profiles" ON team_profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role team_analysis" ON team_analysis
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role team_analysis_history" ON team_analysis_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role behavioral_relationships" ON behavioral_relationships
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at on team_profiles
DROP TRIGGER IF EXISTS team_profiles_updated_at ON team_profiles;
CREATE TRIGGER team_profiles_updated_at
    BEFORE UPDATE ON team_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on team_analysis
DROP TRIGGER IF EXISTS team_analysis_updated_at ON team_analysis;
CREATE TRIGGER team_analysis_updated_at
    BEFORE UPDATE ON team_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on behavioral_relationships
DROP TRIGGER IF EXISTS behavioral_rel_updated_at ON behavioral_relationships;
CREATE TRIGGER behavioral_rel_updated_at
    BEFORE UPDATE ON behavioral_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get team influence network for a project
CREATE OR REPLACE FUNCTION get_influence_network(p_project_id UUID)
RETURNS TABLE (
    from_person_id UUID,
    from_person_name TEXT,
    to_person_id UUID,
    to_person_name TEXT,
    relationship_type TEXT,
    strength REAL,
    confidence TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.from_person_id,
        pf.name as from_person_name,
        br.to_person_id,
        pt.name as to_person_name,
        br.relationship_type,
        br.strength,
        br.confidence
    FROM behavioral_relationships br
    JOIN people pf ON br.from_person_id = pf.id
    JOIN people pt ON br.to_person_id = pt.id
    WHERE br.project_id = p_project_id
    ORDER BY br.strength DESC;
END;
$$ LANGUAGE plpgsql;

-- Get person's influence score (how many people they influence)
CREATE OR REPLACE FUNCTION get_person_influence_score(p_person_id UUID)
RETURNS TABLE (
    influences_count INTEGER,
    influenced_by_count INTEGER,
    allies_count INTEGER,
    tensions_count INTEGER,
    net_influence_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE from_person_id = p_person_id AND relationship_type = 'influences'),
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE to_person_id = p_person_id AND relationship_type = 'influences'),
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE (from_person_id = p_person_id OR to_person_id = p_person_id) 
         AND relationship_type = 'aligned_with'),
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE (from_person_id = p_person_id OR to_person_id = p_person_id) 
         AND relationship_type = 'tension_with'),
        (
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE from_person_id = p_person_id AND relationship_type = 'influences')
            -
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE to_person_id = p_person_id AND relationship_type = 'influences')
            +
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE (from_person_id = p_person_id OR to_person_id = p_person_id) 
             AND relationship_type = 'aligned_with')
            -
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE (from_person_id = p_person_id OR to_person_id = p_person_id) 
             AND relationship_type = 'tension_with')
        )::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE team_profiles IS 'Individual behavioral profiles based on transcript analysis';
COMMENT ON TABLE team_analysis IS 'Team-level dynamics analysis aggregated from individual profiles';
COMMENT ON TABLE team_analysis_history IS 'Historical snapshots of team analysis for tracking evolution';
COMMENT ON TABLE behavioral_relationships IS 'Detected interpersonal dynamics (influence, alliances, tensions)';
COMMENT ON FUNCTION get_influence_network IS 'Get the influence network graph for a project';
COMMENT ON FUNCTION get_person_influence_score IS 'Calculate influence metrics for a specific person';
