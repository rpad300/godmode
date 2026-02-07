-- Migration 031: System Prompts Configuration
-- ============================================
-- Stores all AI prompts that were previously hardcoded
-- Allows superadmins to customize prompts via the Admin panel

-- ============================================
-- SYSTEM PROMPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Prompt identification
    key TEXT NOT NULL UNIQUE,  -- e.g., 'document', 'transcript', 'vision', 'conversation'
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'extraction',  -- extraction, analysis, summary, etc.
    
    -- Prompt content
    prompt_template TEXT NOT NULL,  -- The actual prompt with {{placeholders}}
    
    -- Ontology integration
    uses_ontology BOOLEAN DEFAULT TRUE,  -- Whether to inject ontology context
    ontology_section TEXT,  -- Optional: custom ontology section template
    
    -- Output format
    output_format TEXT DEFAULT 'json',  -- json, markdown, text
    output_schema JSONB,  -- JSON schema for validation
    
    -- Versioning
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT TRUE,  -- System prompts can't be deleted
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(key);
CREATE INDEX IF NOT EXISTS idx_system_prompts_category ON system_prompts(category);

-- ============================================
-- INSERT DEFAULT PROMPTS
-- ============================================

-- Document Extraction Prompt
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'document',
    'Document Extraction',
    'Extract structured information from documents (PDFs, text files)',
    'extraction',
    '/no_think
You are an expert knowledge extraction assistant with deep understanding of knowledge graphs.
Your task is to extract structured information that will populate a knowledge graph.

{{ONTOLOGY_SECTION}}

## DOCUMENT CONTEXT
- Current date: {{TODAY}}
- Document: {{FILENAME}}
- Content Length: {{CONTENT_LENGTH}} characters
{{ROLE_CONTEXT}}{{PROJECT_CONTEXT}}

## CONTENT:
{{CONTENT}}

## EXTRACTION MANDATE
Extract ALL information following the ontology schema above.
For each entity extracted, identify its TYPE from the ontology.
For each relationship, use the correct RELATION TYPE from the ontology.

### ENTITY EXTRACTION (use ontology types):
1. **People (Person)**: Extract name, role, organization, email if mentioned
2. **Projects (Project)**: Extract name, status, description
3. **Technologies (Technology)**: Extract all tech/tools mentioned with category
4. **Organizations (Organization)**: Extract companies, teams, departments
5. **Decisions (Decision)**: Extract choices made, who made them, when
6. **Risks (Risk)**: Extract concerns, blockers, issues with impact/likelihood/mitigation
7. **Tasks (Task)**: Extract action items with owner and deadline

### RELATIONSHIP EXTRACTION (use ontology relation types):
For each entity, identify how it connects to other entities:
- Person WORKS_ON Project
- Person WORKS_AT Organization
- Person REPORTS_TO Person
- Project USES Technology
- Person MADE_DECISION on Decision
- Person OWNS Task
- etc.

### OUTPUT FORMAT (JSON only):
{
    "entities": [
        {"type": "Person", "name": "...", "properties": {"role": "...", "organization": "...", "email": "..."}},
        {"type": "Project", "name": "...", "properties": {"status": "...", "description": "..."}},
        {"type": "Technology", "name": "...", "properties": {"category": "..."}},
        {"type": "Organization", "name": "...", "properties": {"type": "..."}}
    ],
    "relationships": [
        {"from": "Person Name", "fromType": "Person", "relation": "WORKS_ON", "to": "Project Name", "toType": "Project"},
        {"from": "Person Name", "fromType": "Person", "relation": "WORKS_AT", "to": "Org Name", "toType": "Organization"}
    ],
    "facts": [{"content": "...", "category": "process|policy|technical|people|timeline|general", "confidence": 0.9}],
    "decisions": [{"content": "...", "owner": "...", "date": null}],
    "risks": [{"content": "...", "impact": "high|medium|low", "likelihood": "high|medium|low", "mitigation": "..."}],
    "action_items": [{"task": "...", "owner": "...", "deadline": null, "status": "pending"}],
    "questions": [{"content": "...", "context": "...", "priority": "critical|high|medium", "assigned_to": "..."}],
    "summary": "2-3 sentence summary",
    "key_topics": ["topic1", "topic2"],
    "extraction_coverage": {"entities_found": 0, "relationships_found": 0, "confidence": 0.95}
}

CRITICAL: Use the exact entity types and relation types from the ontology above.
This ensures consistency across the knowledge graph.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- Transcript Extraction Prompt
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'transcript',
    'Transcript Extraction',
    'Extract structured information from meeting transcripts',
    'extraction',
    '/no_think
You are an expert meeting analyst extracting knowledge graph data from transcripts.

{{ONTOLOGY_SECTION}}

## MEETING CONTEXT
- Current date: {{TODAY}}
- Meeting: {{FILENAME}}
- Content Length: {{CONTENT_LENGTH}} characters
{{ROLE_CONTEXT}}{{PROJECT_CONTEXT}}

## TRANSCRIPT:
{{CONTENT}}

## EXTRACTION MANDATE
Extract ALL meeting information following the ontology schema.
Meetings are rich sources of relationships - extract who works with whom, who decided what, etc.

### MEETING-SPECIFIC EXTRACTION:

**PARTICIPANTS (Person entities):**
- Extract ALL people who spoke or were mentioned
- Include their role and organization if stated
- Create ATTENDED relationships: Person ATTENDED this Meeting

**DECISIONS (Decision entities):**
- Extract ALL decisions made during the meeting
- Create MADE_DECISION relationships: Person MADE_DECISION Decision

**ACTION ITEMS (Task entities):**
- Extract ALL tasks assigned
- Create OWNS relationships: Person OWNS Task

**PROJECTS DISCUSSED (Project entities):**
- Extract all projects mentioned
- Create WORKS_ON relationships: Person WORKS_ON Project

**TECHNOLOGIES MENTIONED (Technology entities):**
- Extract all tech/tools discussed
- Create USES relationships: Project USES Technology

**ORGANIZATIONAL RELATIONSHIPS:**
- Who reports to whom? (REPORTS_TO)
- Who manages what? (MANAGES)
- Who works with whom? (WORKS_WITH)

### OUTPUT FORMAT (JSON only):
{
    "meeting": {
        "title": "inferred meeting title",
        "date": "{{TODAY}}",
        "type": "planning|status|technical|decision|review|other"
    },
    "entities": [
        {"type": "Person", "name": "...", "properties": {"role": "...", "organization": "..."}, "spoke": true},
        {"type": "Project", "name": "...", "properties": {"status": "..."}},
        {"type": "Decision", "name": "...", "properties": {"content": "...", "owner": "..."}},
        {"type": "Task", "name": "...", "properties": {"description": "...", "owner": "...", "deadline": null}},
        {"type": "Technology", "name": "...", "properties": {"category": "..."}}
    ],
    "relationships": [
        {"from": "Person", "fromType": "Person", "relation": "ATTENDED", "to": "Meeting Title", "toType": "Meeting"},
        {"from": "Person", "fromType": "Person", "relation": "MADE_DECISION", "to": "Decision", "toType": "Decision"},
        {"from": "Person", "fromType": "Person", "relation": "OWNS", "to": "Task", "toType": "Task"},
        {"from": "Person", "fromType": "Person", "relation": "WORKS_ON", "to": "Project", "toType": "Project"},
        {"from": "Person", "fromType": "Person", "relation": "REPORTS_TO", "to": "Manager", "toType": "Person"}
    ],
    "facts": [{"content": "...", "category": "...", "confidence": 0.9}],
    "decisions": [{"content": "...", "owner": "...", "date": null}],
    "risks": [{"content": "...", "impact": "...", "likelihood": "...", "mitigation": "..."}],
    "action_items": [{"task": "...", "owner": "...", "deadline": null}],
    "questions": [{"content": "...", "priority": "...", "assigned_to": "..."}],
    "summary": "2-3 sentence summary of the meeting",
    "key_topics": ["topic1", "topic2"],
    "extraction_coverage": {"participants": 0, "decisions": 0, "actions": 0, "confidence": 0.95}
}

CRITICAL: Map all extracted information to ontology types for graph consistency.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- Vision/Image Extraction Prompt
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'vision',
    'Vision/Image Extraction',
    'Extract information from images, diagrams, org charts, and scanned documents',
    'extraction',
    'Analyze this image/document for knowledge extraction.

{{ONTOLOGY_SECTION}}

## ANALYSIS APPROACH:
1. **IDENTIFY** the type: table, diagram, chart, org chart, architecture, text, form, or mixed
2. **EXTRACT** all data systematically:
   - If org chart: extract Person entities and REPORTS_TO/MANAGES relationships
   - If architecture diagram: extract Technology entities and CONNECTS_TO relationships
   - If table: extract all rows as structured entities
   - If chart: extract data points and trends

## OUTPUT FORMAT (JSON only):
{
    "image_type": "org_chart|architecture|table|chart|diagram|text|form|other",
    "entities": [
        {"type": "...", "name": "...", "properties": {...}}
    ],
    "relationships": [
        {"from": "...", "fromType": "...", "relation": "...", "to": "...", "toType": "..."}
    ],
    "data_extracted": [...],
    "summary": "What this image shows"
}

Map all extracted information to the ontology types for graph consistency.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- Conversation Extraction Prompt
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'conversation',
    'Conversation Extraction',
    'Extract information from chat conversations and messages',
    'extraction',
    '/no_think
You are an expert at extracting knowledge from chat conversations.

{{ONTOLOGY_SECTION}}

## CONVERSATION CONTEXT
- Date: {{TODAY}}
- Conversation: {{FILENAME}}

## MESSAGES:
{{CONTENT}}

## EXTRACTION MANDATE
Extract entities and relationships from this conversation.
Chat conversations often reveal working relationships and informal decisions.

### EXTRACT:
1. **Participants** → Person entities
2. **Topics discussed** → Topic/Project entities
3. **Decisions made** → Decision entities (even informal ones)
4. **Tasks mentioned** → Task entities
5. **Technologies/tools** → Technology entities
6. **Working relationships** → WORKS_WITH, COLLABORATES relationships

### OUTPUT FORMAT (JSON only):
{
    "entities": [
        {"type": "Person", "name": "...", "properties": {"role": "...", "organization": "..."}},
        {"type": "Topic", "name": "...", "properties": {"category": "..."}},
        {"type": "Decision", "name": "...", "properties": {"content": "...", "informal": true}}
    ],
    "relationships": [
        {"from": "Person1", "fromType": "Person", "relation": "WORKS_WITH", "to": "Person2", "toType": "Person"},
        {"from": "Person", "fromType": "Person", "relation": "DISCUSSED", "to": "Topic", "toType": "Topic"}
    ],
    "facts": [{"content": "...", "confidence": 0.8}],
    "decisions": [{"content": "...", "owner": "...", "informal": true}],
    "action_items": [{"task": "...", "owner": "..."}],
    "questions": [{"content": "...", "priority": "..."}],
    "sentiment": "positive|neutral|negative|mixed",
    "summary": "Brief summary of the conversation",
    "key_topics": ["topic1", "topic2"]
}',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- Email Extraction Prompt
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'email',
    'Email Extraction',
    'Extract information from email threads and messages',
    'extraction',
    '/no_think
You are an expert at extracting knowledge from email communications.

{{ONTOLOGY_SECTION}}

## EMAIL CONTEXT
- Date: {{TODAY}}
- Subject: {{FILENAME}}

## EMAIL CONTENT:
{{CONTENT}}

## EXTRACTION MANDATE
Extract entities and relationships from this email/thread.
Emails often contain important decisions, action items, and organizational information.

### EXTRACT:
1. **Sender/Recipients** → Person entities
2. **Topics discussed** → Topic/Project entities  
3. **Decisions communicated** → Decision entities
4. **Action items** → Task entities with owners/deadlines
5. **Attachments mentioned** → Document entities
6. **Organizations/teams** → Organization entities

### OUTPUT FORMAT (JSON only):
{
    "email_metadata": {
        "subject": "...",
        "thread_summary": "...",
        "urgency": "high|normal|low"
    },
    "entities": [
        {"type": "Person", "name": "...", "properties": {"email": "...", "role": "..."}}
    ],
    "relationships": [
        {"from": "Sender", "fromType": "Person", "relation": "SENT_TO", "to": "Recipient", "toType": "Person"}
    ],
    "facts": [{"content": "...", "confidence": 0.8}],
    "decisions": [{"content": "...", "owner": "..."}],
    "action_items": [{"task": "...", "owner": "...", "deadline": null}],
    "questions": [{"content": "...", "priority": "..."}],
    "summary": "Brief summary of the email",
    "key_topics": ["topic1", "topic2"]
}',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- Summary Prompt
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'summary',
    'Content Summary',
    'Generate concise summaries of content',
    'analysis',
    'Summarize the following content in 2-3 concise paragraphs.
Focus on:
1. Main points and key takeaways
2. Important decisions or conclusions
3. Action items or next steps

## CONTENT:
{{CONTENT}}

Provide a clear, professional summary.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- Ontology Section Template (used when uses_ontology = true)
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'ontology_section',
    'Ontology Context Section',
    'Template for injecting ontology context into prompts',
    'template',
    '## ONTOLOGY CONTEXT
The knowledge graph uses these entity types:
{{ENTITY_TYPES}}

And these relationship types:
{{RELATION_TYPES}}',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();

-- ============================================
-- PROMPT VERSION HISTORY TABLE
-- ============================================
-- Stores complete versions of prompts for rollback capability

CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to the prompt
    prompt_id UUID NOT NULL REFERENCES system_prompts(id) ON DELETE CASCADE,
    prompt_key TEXT NOT NULL,  -- Denormalized for easier querying
    
    -- Version info
    version INTEGER NOT NULL,
    
    -- Complete prompt content at this version
    prompt_template TEXT NOT NULL,
    uses_ontology BOOLEAN DEFAULT TRUE,
    
    -- Change metadata
    change_reason TEXT,  -- Optional: why this version was created
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_key ON prompt_versions(prompt_key);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_created ON prompt_versions(created_at DESC);

-- Unique constraint: one entry per prompt + version
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_unique 
    ON prompt_versions(prompt_id, version);

-- ============================================
-- AUTO-VERSION TRIGGER
-- ============================================
-- Automatically saves a version before each update

CREATE OR REPLACE FUNCTION save_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only save version if prompt_template changed
    IF OLD.prompt_template IS DISTINCT FROM NEW.prompt_template THEN
        -- Insert the OLD version into history
        INSERT INTO prompt_versions (
            prompt_id,
            prompt_key,
            version,
            prompt_template,
            uses_ontology,
            created_by
        ) VALUES (
            OLD.id,
            OLD.key,
            OLD.version,
            OLD.prompt_template,
            OLD.uses_ontology,
            auth.uid()
        );
        
        -- Increment version on the new record
        NEW.version := OLD.version + 1;
        NEW.updated_at := now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS prompt_version_trigger ON system_prompts;
CREATE TRIGGER prompt_version_trigger
    BEFORE UPDATE ON system_prompts
    FOR EACH ROW EXECUTE FUNCTION save_prompt_version();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotent migration)
DROP POLICY IF EXISTS "Anyone can read active prompts" ON system_prompts;
DROP POLICY IF EXISTS "Superadmins can modify prompts" ON system_prompts;
DROP POLICY IF EXISTS "Superadmins can read prompt versions" ON prompt_versions;
DROP POLICY IF EXISTS "System can insert prompt versions" ON prompt_versions;

-- Anyone can read active prompts
CREATE POLICY "Anyone can read active prompts"
    ON system_prompts FOR SELECT
    USING (is_active = TRUE);

-- Only superadmins can modify prompts
CREATE POLICY "Superadmins can modify prompts"
    ON system_prompts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Prompt versions: only superadmins can read
CREATE POLICY "Superadmins can read prompt versions"
    ON prompt_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Prompt versions: insert handled by trigger (SECURITY DEFINER)
CREATE POLICY "System can insert prompt versions"
    ON prompt_versions FOR INSERT
    WITH CHECK (TRUE);

-- ============================================
-- AUDIT TRIGGER
-- ============================================
-- Uses the existing config_audit_log table structure from migration 030

CREATE OR REPLACE FUNCTION log_prompt_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO config_audit_log (
        config_type,
        config_key,
        action,
        old_value,
        new_value,
        changed_by,
        changed_at
    ) VALUES (
        'system',  -- config_type
        COALESCE(NEW.key, OLD.key),  -- config_key (the prompt key like 'document', 'transcript')
        CASE TG_OP 
            WHEN 'INSERT' THEN 'create'
            WHEN 'UPDATE' THEN 'update'
            WHEN 'DELETE' THEN 'delete'
        END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        auth.uid(),
        now()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if config_audit_log exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_audit_log') THEN
        DROP TRIGGER IF EXISTS system_prompts_audit ON system_prompts;
        CREATE TRIGGER system_prompts_audit
            AFTER INSERT OR UPDATE OR DELETE ON system_prompts
            FOR EACH ROW EXECUTE FUNCTION log_prompt_changes();
    END IF;
END $$;

-- ============================================
-- RESTORE VERSION FUNCTION
-- ============================================
-- Function to restore a prompt to a previous version

CREATE OR REPLACE FUNCTION restore_prompt_version(
    p_prompt_key TEXT,
    p_version INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_prompt_id UUID;
    v_old_template TEXT;
    v_result JSONB;
BEGIN
    -- Get the prompt ID
    SELECT id INTO v_prompt_id
    FROM system_prompts
    WHERE key = p_prompt_key;
    
    IF v_prompt_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Prompt not found');
    END IF;
    
    -- Get the version to restore
    SELECT prompt_template INTO v_old_template
    FROM prompt_versions
    WHERE prompt_id = v_prompt_id AND version = p_version;
    
    IF v_old_template IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Version not found');
    END IF;
    
    -- Update the prompt (this will trigger version save automatically)
    UPDATE system_prompts
    SET prompt_template = v_old_template
    WHERE id = v_prompt_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'restored_version', p_version,
        'prompt_key', p_prompt_key
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE system_prompts IS 'Stores AI prompts for document/transcript/image extraction';
COMMENT ON COLUMN system_prompts.key IS 'Unique identifier: document, transcript, vision, conversation, email, summary';
COMMENT ON COLUMN system_prompts.prompt_template IS 'Prompt with placeholders: {{CONTENT}}, {{FILENAME}}, {{TODAY}}, {{ONTOLOGY_SECTION}}, etc.';
COMMENT ON COLUMN system_prompts.uses_ontology IS 'Whether to inject ontology entity/relation types into the prompt';

COMMENT ON TABLE prompt_versions IS 'Historical versions of prompts for rollback capability';
COMMENT ON COLUMN prompt_versions.version IS 'Version number at time of save (before update)';
COMMENT ON COLUMN prompt_versions.change_reason IS 'Optional description of why this change was made';
