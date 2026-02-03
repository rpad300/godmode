-- ============================================
-- Team Profiles: Change FK from people to contacts
-- The team_profiles table should reference contacts (business stakeholders)
-- rather than people (document-extracted mentions)
-- ============================================

-- Drop the existing foreign key constraint
ALTER TABLE team_profiles 
DROP CONSTRAINT IF EXISTS team_profiles_person_id_fkey;

-- Rename column for clarity (person_id -> contact_id)
ALTER TABLE team_profiles 
RENAME COLUMN person_id TO contact_id;

-- Add new foreign key referencing contacts
ALTER TABLE team_profiles
ADD CONSTRAINT team_profiles_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_team_profiles_person;
CREATE INDEX IF NOT EXISTS idx_team_profiles_contact ON team_profiles(contact_id);

-- Update unique constraint
DROP INDEX IF EXISTS idx_team_profiles_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_profiles_unique ON team_profiles(project_id, contact_id);

-- ============================================
-- Also update behavioral_relationships table
-- ============================================

-- Drop existing constraints
ALTER TABLE behavioral_relationships
DROP CONSTRAINT IF EXISTS behavioral_relationships_from_person_id_fkey;

ALTER TABLE behavioral_relationships
DROP CONSTRAINT IF EXISTS behavioral_relationships_to_person_id_fkey;

-- Rename columns
ALTER TABLE behavioral_relationships
RENAME COLUMN from_person_id TO from_contact_id;

ALTER TABLE behavioral_relationships
RENAME COLUMN to_person_id TO to_contact_id;

-- Add new foreign keys
ALTER TABLE behavioral_relationships
ADD CONSTRAINT behavioral_relationships_from_contact_id_fkey 
FOREIGN KEY (from_contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

ALTER TABLE behavioral_relationships
ADD CONSTRAINT behavioral_relationships_to_contact_id_fkey 
FOREIGN KEY (to_contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_behavioral_rel_from;
DROP INDEX IF EXISTS idx_behavioral_rel_to;
DROP INDEX IF EXISTS idx_behavioral_rel_unique;

CREATE INDEX IF NOT EXISTS idx_behavioral_rel_from_contact ON behavioral_relationships(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_rel_to_contact ON behavioral_relationships(to_contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_behavioral_rel_unique 
    ON behavioral_relationships(project_id, from_contact_id, to_contact_id, relationship_type);

-- ============================================
-- Also update profile_evidence table
-- ============================================

ALTER TABLE profile_evidence
DROP CONSTRAINT IF EXISTS profile_evidence_person_id_fkey;

ALTER TABLE profile_evidence
RENAME COLUMN person_id TO contact_id;

ALTER TABLE profile_evidence
ADD CONSTRAINT profile_evidence_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_profile_evidence_person;
CREATE INDEX IF NOT EXISTS idx_profile_evidence_contact ON profile_evidence(contact_id);

COMMENT ON TABLE team_profiles IS 'Behavioral profiles for contacts (stakeholders/team members) based on transcript analysis';
COMMENT ON COLUMN team_profiles.contact_id IS 'Reference to the contact being profiled';

-- ============================================
-- Update helper functions to use new column names
-- ============================================

-- Drop existing functions first (return type changed)
DROP FUNCTION IF EXISTS get_influence_network(UUID);

-- Update get_influence_network function
CREATE OR REPLACE FUNCTION get_influence_network(p_project_id UUID)
RETURNS TABLE (
    from_contact_id UUID,
    from_contact_name TEXT,
    to_contact_id UUID,
    to_contact_name TEXT,
    relationship_type TEXT,
    strength REAL,
    confidence TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.from_contact_id,
        cf.name as from_contact_name,
        br.to_contact_id,
        ct.name as to_contact_name,
        br.relationship_type,
        br.strength,
        br.confidence
    FROM behavioral_relationships br
    JOIN contacts cf ON br.from_contact_id = cf.id
    JOIN contacts ct ON br.to_contact_id = ct.id
    WHERE br.project_id = p_project_id
    ORDER BY br.strength DESC;
END;
$$ LANGUAGE plpgsql;

-- Update get_person_influence_score function (renamed to get_contact_influence_score)
DROP FUNCTION IF EXISTS get_person_influence_score(UUID);

CREATE OR REPLACE FUNCTION get_contact_influence_score(p_contact_id UUID)
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
         WHERE from_contact_id = p_contact_id AND relationship_type = 'influences'),
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE to_contact_id = p_contact_id AND relationship_type = 'influences'),
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE (from_contact_id = p_contact_id OR to_contact_id = p_contact_id) 
         AND relationship_type = 'aligned_with'),
        (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
         WHERE (from_contact_id = p_contact_id OR to_contact_id = p_contact_id) 
         AND relationship_type = 'tension_with'),
        (
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE from_contact_id = p_contact_id AND relationship_type = 'influences')
            -
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE to_contact_id = p_contact_id AND relationship_type = 'influences')
            +
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE (from_contact_id = p_contact_id OR to_contact_id = p_contact_id) 
             AND relationship_type = 'aligned_with')
            -
            (SELECT COUNT(*)::INTEGER FROM behavioral_relationships 
             WHERE (from_contact_id = p_contact_id OR to_contact_id = p_contact_id) 
             AND relationship_type = 'tension_with')
        )::INTEGER;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_influence_network IS 'Get the influence network graph for a project (using contacts)';
COMMENT ON FUNCTION get_contact_influence_score IS 'Calculate influence metrics for a specific contact';
