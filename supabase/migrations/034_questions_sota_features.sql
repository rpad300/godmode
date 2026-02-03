-- ============================================================================
-- Migration 034: Questions SOTA Features
-- Advanced question management with Graph integration, entity linking,
-- timeline tracking, SLA, and role-based question generation
-- ============================================================================

-- ============================================================================
-- SECTION 1: QUESTION EVENTS (Timeline/Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES knowledge_questions(id) ON DELETE CASCADE,
    
    -- Event type: created, assigned, priority_changed, status_changed, answered, 
    --             reopened, dismissed, entity_extracted, similar_linked, sla_breached
    event_type TEXT NOT NULL,
    
    -- Event-specific data
    event_data JSONB DEFAULT '{}',
    -- Examples:
    -- assigned: {"to": "John Smith", "to_contact_id": "uuid", "by": "Sarah"}
    -- priority_changed: {"from": "medium", "to": "critical"}
    -- answered: {"source": "manual", "by_contact_id": "uuid"}
    -- entity_extracted: {"entities": [{"type": "person", "name": "John"}]}
    
    -- Actor information
    actor_user_id UUID REFERENCES auth.users(id),
    actor_contact_id UUID REFERENCES contacts(id),
    actor_name TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for question events
CREATE INDEX IF NOT EXISTS idx_question_events_question 
    ON question_events(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_events_type 
    ON question_events(event_type);
CREATE INDEX IF NOT EXISTS idx_question_events_actor 
    ON question_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- ============================================================================
-- SECTION 2: QUESTION SIMILARITIES (Semantic Search Cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_similarities (
    question_id UUID NOT NULL REFERENCES knowledge_questions(id) ON DELETE CASCADE,
    similar_question_id UUID NOT NULL REFERENCES knowledge_questions(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    computed_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (question_id, similar_question_id),
    
    -- Prevent self-references
    CHECK (question_id != similar_question_id)
);

-- Index for similarity lookups
CREATE INDEX IF NOT EXISTS idx_question_similarities_score 
    ON question_similarities(question_id, similarity_score DESC);

-- ============================================================================
-- SECTION 3: ROLE QUESTION TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_question_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Project-specific or global (NULL = global template available to all)
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Role matching (regex pattern)
    role_pattern TEXT NOT NULL,
    -- Examples: 'devops|sre|infrastructure', 'legal|compliance', 'product|owner'
    
    -- Question details
    category TEXT NOT NULL,
    question_template TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    context_template TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_templates_project 
    ON role_question_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_role_templates_active 
    ON role_question_templates(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SECTION 4: EXTEND knowledge_questions TABLE
-- ============================================================================

-- Answered by contact (for manual answers)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answered_by_contact_id UUID REFERENCES contacts(id);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answered_by_name TEXT;

-- Assignment tracking
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES auth.users(id);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Entity extraction
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS extracted_entities JSONB DEFAULT '[]';
-- Format: [{"type": "person", "name": "John", "entity_id": "uuid", "confidence": 0.92}]

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS extracted_topics JSONB DEFAULT '[]';
-- Format: [{"name": "backup", "type": "technology", "confidence": 0.85}]

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS entities_extracted_at TIMESTAMPTZ;

-- Answer provenance (source tracking)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answer_provenance JSONB;
-- Format: {
--   "sources": [{"type": "fact", "id": "uuid", "content": "...", "confidence": 0.85}],
--   "synthesis_method": "manual"|"auto-detected"|"ai"
-- }

-- SLA tracking
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 168; -- 7 days default

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT FALSE;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS sla_breached_at TIMESTAMPTZ;

-- Question generation source
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS generation_source TEXT;
-- Values: 'manual', 'extracted', 'template', 'ai_generated'

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES role_question_templates(id);

-- ============================================================================
-- SECTION 4.5: DISMISSED & DEFERRED TRACKING
-- ============================================================================

-- Dismissed tracking (permanently closed without answer)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS dismissed_by UUID REFERENCES auth.users(id);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS dismissed_reason TEXT;
-- Reasons: 'duplicate', 'not_relevant', 'out_of_scope', 'answered_elsewhere', 'no_longer_needed', 'other'

-- Deferred tracking (postponed for later - not ignored permanently)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS deferred_at TIMESTAMPTZ;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS deferred_by UUID REFERENCES auth.users(id);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS deferred_until TIMESTAMPTZ;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS deferred_reason TEXT;

-- Reopened tracking (when a resolved/dismissed question is reopened)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS reopened_reason TEXT;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0;

-- Resolution type (how was the question resolved)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS resolution_type TEXT;
-- Values: 'answered_manual', 'answered_auto', 'answered_ai', 'dismissed', 'merged', 'superseded'

-- Merged/Superseded tracking
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES knowledge_questions(id);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS superseded_by_id UUID REFERENCES knowledge_questions(id);

-- Quality/Usefulness feedback
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS was_useful BOOLEAN;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS usefulness_feedback TEXT;

-- Cluster assignment (for topic grouping)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS cluster_id INTEGER;

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS cluster_label TEXT;

-- Answer feedback
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answer_quality_score DECIMAL(3,2);

ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answer_feedback JSONB;
-- Format: {"helpful": true, "complete": false, "rating": 4, "feedback_text": "...", "user_id": "..."}

-- ============================================================================
-- SECTION 5: INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_questions_sla_breached 
    ON knowledge_questions(sla_breached, created_at) 
    WHERE sla_breached = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_entities 
    ON knowledge_questions USING GIN (extracted_entities) 
    WHERE extracted_entities != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_topics 
    ON knowledge_questions USING GIN (extracted_topics) 
    WHERE extracted_topics != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_answered_by_contact 
    ON knowledge_questions(answered_by_contact_id) 
    WHERE answered_by_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_cluster 
    ON knowledge_questions(cluster_id) 
    WHERE cluster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_generation_source 
    ON knowledge_questions(generation_source) 
    WHERE generation_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_dismissed 
    ON knowledge_questions(dismissed_at DESC) 
    WHERE dismissed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_deferred 
    ON knowledge_questions(deferred_until) 
    WHERE deferred_at IS NOT NULL AND deferred_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_merged 
    ON knowledge_questions(merged_into_id) 
    WHERE merged_into_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_resolution_type 
    ON knowledge_questions(resolution_type) 
    WHERE resolution_type IS NOT NULL;

-- ============================================================================
-- SECTION 6: KNOWLEDGE GAPS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS knowledge_gaps AS
SELECT 
    project_id,
    category,
    COUNT(*) FILTER (WHERE status = 'pending' OR status = 'open') as pending_count,
    COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
    COUNT(*) FILTER (WHERE status = 'resolved' OR status = 'answered') as resolved_count,
    COUNT(*) as total_count,
    ROUND(
        AVG(
            CASE WHEN resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
            END
        )::numeric, 1
    ) as avg_hours_to_resolve,
    MAX(created_at) as latest_question_at
FROM knowledge_questions
WHERE deleted_at IS NULL
GROUP BY project_id, category;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_gaps_pk 
    ON knowledge_gaps(project_id, category);

-- Function to refresh knowledge gaps
CREATE OR REPLACE FUNCTION refresh_knowledge_gaps() 
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY knowledge_gaps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 7: SLA CHECK TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION check_question_sla() 
RETURNS TRIGGER AS $$
BEGIN
    -- Check if SLA is breached
    IF NEW.status IN ('pending', 'open', 'assigned') AND 
       NEW.created_at + (COALESCE(NEW.sla_hours, 168) || ' hours')::interval < NOW() AND
       NOT COALESCE(OLD.sla_breached, FALSE) THEN
        NEW.sla_breached := TRUE;
        NEW.sla_breached_at := NOW();
    END IF;
    
    -- Reset breach if resolved
    IF NEW.status IN ('resolved', 'answered', 'dismissed', 'closed') THEN
        -- Keep sla_breached TRUE for historical record, but don't update sla_breached_at
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_question_sla ON knowledge_questions;
CREATE TRIGGER trg_question_sla 
    BEFORE UPDATE ON knowledge_questions
    FOR EACH ROW 
    EXECUTE FUNCTION check_question_sla();

-- ============================================================================
-- SECTION 8: AUTO-CREATE EVENT ON QUESTION CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION create_question_event() 
RETURNS TRIGGER AS $$
DECLARE
    event_type_val TEXT;
    event_data_val JSONB;
BEGIN
    -- Determine event type based on changes
    IF TG_OP = 'INSERT' THEN
        event_type_val := 'created';
        event_data_val := jsonb_build_object(
            'priority', NEW.priority,
            'status', NEW.status,
            'assigned_to', NEW.assigned_to
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Priority changed
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id, 
                'priority_changed',
                jsonb_build_object('from', OLD.priority, 'to', NEW.priority),
                NEW.created_by
            );
        END IF;
        
        -- Status changed
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'status_changed',
                jsonb_build_object('from', OLD.status, 'to', NEW.status),
                NEW.created_by
            );
        END IF;
        
        -- Assigned
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id, actor_name)
            VALUES (
                NEW.id,
                'assigned',
                jsonb_build_object('to', NEW.assigned_to, 'from', OLD.assigned_to),
                NEW.assigned_by_user_id,
                NEW.assigned_to
            );
        END IF;
        
        -- Answered
        IF OLD.answer IS DISTINCT FROM NEW.answer AND NEW.answer IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id, actor_contact_id, actor_name)
            VALUES (
                NEW.id,
                'answered',
                jsonb_build_object(
                    'source', COALESCE(NEW.answer_source, 'manual'),
                    'answer_preview', LEFT(NEW.answer, 100)
                ),
                NEW.answered_by,
                NEW.answered_by_contact_id,
                NEW.answered_by_name
            );
        END IF;
        
        -- SLA breached
        IF OLD.sla_breached IS DISTINCT FROM NEW.sla_breached AND NEW.sla_breached = TRUE THEN
            INSERT INTO question_events (question_id, event_type, event_data)
            VALUES (
                NEW.id,
                'sla_breached',
                jsonb_build_object('sla_hours', NEW.sla_hours, 'created_at', NEW.created_at)
            );
        END IF;
        
        -- Dismissed
        IF OLD.dismissed_at IS NULL AND NEW.dismissed_at IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'dismissed',
                jsonb_build_object(
                    'reason', NEW.dismissed_reason,
                    'resolution_type', NEW.resolution_type
                ),
                NEW.dismissed_by
            );
        END IF;
        
        -- Deferred (postponed)
        IF OLD.deferred_at IS NULL AND NEW.deferred_at IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'deferred',
                jsonb_build_object(
                    'reason', NEW.deferred_reason,
                    'until', NEW.deferred_until
                ),
                NEW.deferred_by
            );
        END IF;
        
        -- Reopened
        IF OLD.reopened_at IS DISTINCT FROM NEW.reopened_at AND NEW.reopened_at IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'reopened',
                jsonb_build_object(
                    'reason', NEW.reopened_reason,
                    'reopen_count', NEW.reopen_count
                ),
                NEW.reopened_by
            );
        END IF;
        
        -- Merged into another question
        IF OLD.merged_into_id IS DISTINCT FROM NEW.merged_into_id AND NEW.merged_into_id IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'merged',
                jsonb_build_object('merged_into', NEW.merged_into_id),
                NEW.created_by
            );
        END IF;
        
        -- Superseded by another question
        IF OLD.superseded_by_id IS DISTINCT FROM NEW.superseded_by_id AND NEW.superseded_by_id IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'superseded',
                jsonb_build_object('superseded_by', NEW.superseded_by_id),
                NEW.created_by
            );
        END IF;
        
        -- Usefulness feedback
        IF OLD.was_useful IS DISTINCT FROM NEW.was_useful AND NEW.was_useful IS NOT NULL THEN
            INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
            VALUES (
                NEW.id,
                'feedback_received',
                jsonb_build_object(
                    'was_useful', NEW.was_useful,
                    'feedback', NEW.usefulness_feedback
                ),
                NEW.created_by
            );
        END IF;
        
        -- Don't insert generic update event, specific events above are enough
        RETURN NEW;
    END IF;
    
    -- Insert create event
    IF TG_OP = 'INSERT' THEN
        INSERT INTO question_events (question_id, event_type, event_data, actor_user_id)
        VALUES (NEW.id, event_type_val, event_data_val, NEW.created_by);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_question_event ON knowledge_questions;
CREATE TRIGGER trg_question_event 
    AFTER INSERT OR UPDATE ON knowledge_questions
    FOR EACH ROW 
    EXECUTE FUNCTION create_question_event();

-- ============================================================================
-- SECTION 9: RLS POLICIES
-- ============================================================================

-- Question events: access via question's project
ALTER TABLE question_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access question events" ON question_events;
CREATE POLICY "Members access question events" ON question_events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM knowledge_questions q
        WHERE q.id = question_events.question_id
        AND is_project_member(q.project_id)
    )
);

-- Question similarities: access via question's project
ALTER TABLE question_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access question similarities" ON question_similarities;
CREATE POLICY "Members access question similarities" ON question_similarities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM knowledge_questions q
        WHERE q.id = question_similarities.question_id
        AND is_project_member(q.project_id)
    )
);

-- Role templates: global (project_id NULL) or project-specific
ALTER TABLE role_question_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read role templates" ON role_question_templates;
CREATE POLICY "Read role templates" ON role_question_templates FOR SELECT
USING (
    project_id IS NULL  -- Global templates readable by all
    OR is_project_member(project_id)
);

DROP POLICY IF EXISTS "Manage project templates" ON role_question_templates;
CREATE POLICY "Manage project templates" ON role_question_templates 
FOR INSERT WITH CHECK (
    project_id IS NOT NULL AND is_project_member(project_id)
);

DROP POLICY IF EXISTS "Update project templates" ON role_question_templates;
CREATE POLICY "Update project templates" ON role_question_templates 
FOR UPDATE USING (
    project_id IS NOT NULL AND is_project_member(project_id)
);

DROP POLICY IF EXISTS "Delete project templates" ON role_question_templates;
CREATE POLICY "Delete project templates" ON role_question_templates 
FOR DELETE USING (
    project_id IS NOT NULL AND is_project_member(project_id)
);

-- ============================================================================
-- SECTION 10: DEFAULT GLOBAL ROLE TEMPLATES
-- ============================================================================

INSERT INTO role_question_templates (project_id, role_pattern, category, question_template, priority, context_template) VALUES
-- DevOps/Infrastructure
(NULL, 'devops|sre|infrastructure|platform|cloud', 'Technical', 'What is the deployment strategy for this project?', 'high', 'Understanding deployment approach for infrastructure planning'),
(NULL, 'devops|sre|infrastructure|backup', 'Technical', 'What are the backup and disaster recovery procedures?', 'high', 'Critical for business continuity'),
(NULL, 'devops|sre|infrastructure|monitoring', 'Technical', 'What monitoring and alerting is in place?', 'medium', 'Observability requirements'),
(NULL, 'devops|sre|cloud|aws|azure|gcp', 'Technical', 'What cloud resources and services are required?', 'medium', 'Cloud architecture planning'),

-- Security
(NULL, 'security|infosec|ciso|cybersecurity', 'Technical', 'What are the security requirements and controls?', 'critical', 'Security compliance and risk management'),
(NULL, 'security|infosec|penetration|vulnerability', 'Technical', 'Has a security assessment been performed?', 'high', 'Security validation'),

-- Legal/Compliance
(NULL, 'legal|compliance|counsel|attorney|lawyer', 'Legal', 'Are there any regulatory compliance requirements (GDPR, SOC2, HIPAA)?', 'high', 'Regulatory compliance check'),
(NULL, 'legal|compliance|privacy|dpo|data protection', 'Legal', 'What are the data privacy obligations?', 'high', 'Privacy requirements'),
(NULL, 'legal|contract|procurement', 'Legal', 'Are there contractual constraints or vendor agreements to consider?', 'medium', 'Contract review'),

-- Product/Business
(NULL, 'product|owner|manager|business|stakeholder', 'Business', 'What are the key business requirements and success criteria?', 'high', 'Business alignment'),
(NULL, 'product|owner|manager|project', 'Business', 'What is the expected timeline and key milestones?', 'high', 'Project planning'),
(NULL, 'product|stakeholder|sponsor', 'Business', 'Who are the key stakeholders and decision makers?', 'medium', 'Stakeholder mapping'),
(NULL, 'product|owner|priorit', 'Business', 'What is the priority order of features/requirements?', 'medium', 'Backlog prioritization'),

-- Architecture/Technical Lead
(NULL, 'architect|technical lead|tech lead|principal|staff', 'Technical', 'What is the high-level architecture and key design decisions?', 'high', 'Architecture overview'),
(NULL, 'architect|data|database', 'Technical', 'What is the data model and storage strategy?', 'high', 'Data architecture'),
(NULL, 'architect|integration|api', 'Technical', 'What external integrations and APIs are required?', 'medium', 'Integration planning'),

-- QA/Testing
(NULL, 'qa|test|quality|automation', 'Technical', 'What is the testing strategy (unit, integration, E2E)?', 'high', 'Quality assurance planning'),
(NULL, 'qa|test|acceptance', 'Technical', 'What are the acceptance criteria for key features?', 'medium', 'Acceptance validation'),

-- Finance/Procurement
(NULL, 'finance|procurement|budget|cost|cfo', 'Business', 'What is the budget allocated for this project?', 'high', 'Budget planning'),
(NULL, 'finance|procurement|vendor', 'Business', 'Are there procurement or vendor dependencies?', 'medium', 'Vendor management'),

-- HR/People
(NULL, 'hr|people|talent|hiring|recruitment', 'Business', 'Are there staffing or skill gaps that need to be addressed?', 'medium', 'Resource planning'),

-- Design/UX
(NULL, 'design|ux|ui|product design', 'Business', 'What are the user experience requirements?', 'medium', 'UX planning'),
(NULL, 'design|brand|visual', 'Business', 'Are there branding or design guidelines to follow?', 'low', 'Brand consistency')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 11: HELPER FUNCTIONS
-- ============================================================================

-- Function to get question timeline
CREATE OR REPLACE FUNCTION get_question_timeline(p_question_id UUID)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    event_data JSONB,
    actor_name TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qe.id,
        qe.event_type,
        qe.event_data,
        COALESCE(qe.actor_name, u.raw_user_meta_data->>'full_name', c.name) as actor_name,
        qe.created_at
    FROM question_events qe
    LEFT JOIN auth.users u ON u.id = qe.actor_user_id
    LEFT JOIN contacts c ON c.id = qe.actor_contact_id
    WHERE qe.question_id = p_question_id
    ORDER BY qe.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get similar questions
CREATE OR REPLACE FUNCTION get_similar_questions(p_question_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    status TEXT,
    similarity_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        q.status,
        qs.similarity_score
    FROM question_similarities qs
    JOIN knowledge_questions q ON q.id = qs.similar_question_id
    WHERE qs.question_id = p_question_id
    AND q.deleted_at IS NULL
    ORDER BY qs.similarity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get question chain (parent + children)
CREATE OR REPLACE FUNCTION get_question_chain(p_question_id UUID)
RETURNS TABLE (
    relation_type TEXT,
    question_id UUID,
    content TEXT,
    status TEXT,
    priority TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Get parent
    RETURN QUERY
    SELECT 
        'parent'::TEXT,
        parent.id,
        parent.content,
        parent.status,
        parent.priority,
        parent.created_at
    FROM knowledge_questions q
    JOIN knowledge_questions parent ON parent.id = q.follow_up_to
    WHERE q.id = p_question_id
    AND parent.deleted_at IS NULL;
    
    -- Get children
    RETURN QUERY
    SELECT 
        'child'::TEXT,
        child.id,
        child.content,
        child.status,
        child.priority,
        child.created_at
    FROM knowledge_questions child
    WHERE child.follow_up_to = p_question_id
    AND child.deleted_at IS NULL
    ORDER BY child.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get matching role templates
CREATE OR REPLACE FUNCTION get_role_templates(p_project_id UUID, p_role TEXT)
RETURNS TABLE (
    template_id UUID,
    category TEXT,
    question_template TEXT,
    priority TEXT,
    context_template TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id,
        rt.category,
        rt.question_template,
        rt.priority,
        rt.context_template
    FROM role_question_templates rt
    WHERE rt.is_active = TRUE
    AND (rt.project_id IS NULL OR rt.project_id = p_project_id)
    AND p_role ~* rt.role_pattern
    ORDER BY 
        CASE WHEN rt.project_id IS NOT NULL THEN 0 ELSE 1 END,  -- Project-specific first
        rt.priority DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 12: QUESTION LIFECYCLE ANALYTICS
-- ============================================================================

-- View for question resolution stats by project
CREATE OR REPLACE VIEW question_resolution_stats AS
SELECT 
    project_id,
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'answered')) as answered_count,
    COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
    COUNT(*) FILTER (WHERE status = 'pending' OR status = 'open') as pending_count,
    COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
    COUNT(*) FILTER (WHERE deferred_at IS NOT NULL) as deferred_count,
    COUNT(*) FILTER (WHERE sla_breached = TRUE) as sla_breached_count,
    COUNT(*) FILTER (WHERE merged_into_id IS NOT NULL) as merged_count,
    COUNT(*) FILTER (WHERE reopen_count > 0) as reopened_count,
    
    -- Resolution type breakdown
    COUNT(*) FILTER (WHERE resolution_type = 'answered_manual') as manual_answers,
    COUNT(*) FILTER (WHERE resolution_type = 'answered_auto') as auto_answers,
    COUNT(*) FILTER (WHERE resolution_type = 'answered_ai') as ai_answers,
    
    -- Usefulness stats
    COUNT(*) FILTER (WHERE was_useful = TRUE) as useful_count,
    COUNT(*) FILTER (WHERE was_useful = FALSE) as not_useful_count,
    
    -- Time metrics (averages in hours)
    ROUND(AVG(
        CASE WHEN resolved_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
        END
    )::numeric, 1) as avg_resolution_hours,
    
    ROUND(AVG(
        CASE WHEN dismissed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (dismissed_at - created_at))/3600 
        END
    )::numeric, 1) as avg_dismissal_hours
    
FROM knowledge_questions
WHERE deleted_at IS NULL
GROUP BY project_id;

-- Function to get deferred questions that are due
CREATE OR REPLACE FUNCTION get_due_deferred_questions(p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    priority TEXT,
    deferred_until TIMESTAMPTZ,
    deferred_reason TEXT,
    assigned_to TEXT,
    hours_overdue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        q.priority,
        q.deferred_until,
        q.deferred_reason,
        q.assigned_to,
        ROUND(EXTRACT(EPOCH FROM (NOW() - q.deferred_until))/3600, 1) as hours_overdue
    FROM knowledge_questions q
    WHERE q.deferred_at IS NOT NULL
    AND q.deferred_until IS NOT NULL
    AND q.deferred_until <= NOW()
    AND q.status NOT IN ('resolved', 'answered', 'dismissed', 'closed')
    AND q.deleted_at IS NULL
    AND (p_project_id IS NULL OR q.project_id = p_project_id)
    ORDER BY q.deferred_until ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to dismiss a question with proper tracking
CREATE OR REPLACE FUNCTION dismiss_question(
    p_question_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT 'other',
    p_resolution_type TEXT DEFAULT 'dismissed'
)
RETURNS void AS $$
BEGIN
    UPDATE knowledge_questions
    SET 
        status = 'dismissed',
        dismissed_at = NOW(),
        dismissed_by = p_user_id,
        dismissed_reason = p_reason,
        resolution_type = p_resolution_type,
        updated_at = NOW()
    WHERE id = p_question_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to defer a question
CREATE OR REPLACE FUNCTION defer_question(
    p_question_id UUID,
    p_user_id UUID,
    p_until TIMESTAMPTZ,
    p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE knowledge_questions
    SET 
        status = 'deferred',
        deferred_at = NOW(),
        deferred_by = p_user_id,
        deferred_until = p_until,
        deferred_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_question_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reopen a question with tracking
CREATE OR REPLACE FUNCTION reopen_question(
    p_question_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE knowledge_questions
    SET 
        status = 'pending',
        reopened_at = NOW(),
        reopened_by = p_user_id,
        reopened_reason = p_reason,
        reopen_count = COALESCE(reopen_count, 0) + 1,
        -- Clear resolution fields
        resolved_at = NULL,
        dismissed_at = NULL,
        dismissed_by = NULL,
        dismissed_reason = NULL,
        resolution_type = NULL,
        -- Clear deferred fields
        deferred_at = NULL,
        deferred_by = NULL,
        deferred_until = NULL,
        deferred_reason = NULL,
        updated_at = NOW()
    WHERE id = p_question_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to merge questions
CREATE OR REPLACE FUNCTION merge_questions(
    p_source_question_id UUID,
    p_target_question_id UUID,
    p_user_id UUID
)
RETURNS void AS $$
BEGIN
    -- Mark source as merged
    UPDATE knowledge_questions
    SET 
        status = 'dismissed',
        merged_into_id = p_target_question_id,
        resolution_type = 'merged',
        dismissed_at = NOW(),
        dismissed_by = p_user_id,
        dismissed_reason = 'Merged into another question',
        updated_at = NOW()
    WHERE id = p_source_question_id
    AND deleted_at IS NULL;
    
    -- Copy any follow-ups to target
    UPDATE knowledge_questions
    SET follow_up_to = p_target_question_id
    WHERE follow_up_to = p_source_question_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get question lifecycle stats for a project
CREATE OR REPLACE FUNCTION get_question_lifecycle_stats(p_project_id UUID)
RETURNS TABLE (
    metric TEXT,
    value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_questions'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND deleted_at IS NULL
    UNION ALL
    SELECT 'answered'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND status IN ('resolved', 'answered') AND deleted_at IS NULL
    UNION ALL
    SELECT 'pending'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND status IN ('pending', 'open') AND deleted_at IS NULL
    UNION ALL
    SELECT 'assigned'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND status = 'assigned' AND deleted_at IS NULL
    UNION ALL
    SELECT 'dismissed'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND status = 'dismissed' AND deleted_at IS NULL
    UNION ALL
    SELECT 'deferred'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND deferred_at IS NOT NULL AND status NOT IN ('resolved', 'dismissed') AND deleted_at IS NULL
    UNION ALL
    SELECT 'sla_breached'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND sla_breached = TRUE AND deleted_at IS NULL
    UNION ALL
    SELECT 'reopened'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND reopen_count > 0 AND deleted_at IS NULL
    UNION ALL
    SELECT 'avg_resolution_hours'::TEXT, 
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::NUMERIC, 1)
    FROM knowledge_questions WHERE project_id = p_project_id AND resolved_at IS NOT NULL AND deleted_at IS NULL
    UNION ALL
    SELECT 'useful_answers'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND was_useful = TRUE AND deleted_at IS NULL
    UNION ALL
    SELECT 'auto_answered'::TEXT, COUNT(*)::NUMERIC
    FROM knowledge_questions WHERE project_id = p_project_id AND resolution_type = 'answered_auto' AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add status 'deferred' to the allowed values (requires recreating check constraint)
-- Note: This needs to be done if there's an existing CHECK constraint on status

-- ============================================================================
-- End of Migration 034
-- ============================================================================
