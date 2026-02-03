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
