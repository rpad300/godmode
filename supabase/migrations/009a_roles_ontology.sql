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
