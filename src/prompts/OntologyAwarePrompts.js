/**
 * Ontology-Aware Prompts Module
 * Generates extraction prompts that use ontology context for consistent entity/relation extraction
 * 
 * PROMPTS ARE NOW STORED IN SUPABASE (system_prompts table)
 * This module loads templates from DB and renders them with context
 */

const { getOntologyManager } = require('../ontology');

// Try to load from Supabase, fallback to hardcoded if not available
let promptsService = null;
try {
    promptsService = require('../supabase/prompts');
} catch (e) {
    console.log('[OntologyAwarePrompts] Supabase prompts not available, using defaults');
}

class OntologyAwarePrompts {
    constructor(options = {}) {
        this.ontology = options.ontology || getOntologyManager();
        this.config = options.config || {};
        this.userRole = options.userRole || null;
        this.projectContext = options.projectContext || null;
        this.promptsLoaded = false;
        this.dbPrompts = {};
    }

    /**
     * Load prompts from database
     */
    async loadPromptsFromDB() {
        if (this.promptsLoaded) return;
        
        try {
            if (promptsService) {
                this.dbPrompts = await promptsService.getAllPrompts() || {};
                this.promptsLoaded = true;
                console.log(`[OntologyAwarePrompts] Loaded ${Object.keys(this.dbPrompts).length} prompts from DB`);
            }
        } catch (e) {
            console.log('[OntologyAwarePrompts] Could not load from DB:', e.message);
        }
    }

    /**
     * Render a prompt template from DB with variables
     */
    async renderDBPrompt(key, variables = {}) {
        await this.loadPromptsFromDB();
        
        const prompt = this.dbPrompts[key];
        if (!prompt) return null;

        let template = prompt.prompt_template;
        
        // Inject ontology section if needed
        if (prompt.uses_ontology) {
            const ontology = this.getOntologyContext();
            const ontologySectionTemplate = this.dbPrompts['ontology_section']?.prompt_template || 
                `## ONTOLOGY CONTEXT\nEntity types:\n{{ENTITY_TYPES}}\n\nRelation types:\n{{RELATION_TYPES}}`;
            
            const ontologySection = ontologySectionTemplate
                .replace('{{ENTITY_TYPES}}', ontology.entityTypes)
                .replace('{{RELATION_TYPES}}', ontology.relationTypes);
            
            variables.ONTOLOGY_SECTION = ontologySection;
        }

        // Render all variables
        if (promptsService) {
            return promptsService.renderPrompt(template, variables);
        }
        
        // Manual rendering fallback
        for (const [k, v] of Object.entries(variables)) {
            template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
        }
        return template.replace(/\{\{[A-Z_]+\}\}/g, '');
    }

    /**
     * Get ontology context for prompts
     */
    getOntologyContext() {
        try {
            const schema = this.ontology.getSchema();
            if (!schema) return this.getDefaultOntologyContext();

            const entityTypes = schema.entities || {};
            const relations = schema.relations || {};

            // Build entity types description
            const entityList = Object.entries(entityTypes).map(([type, def]) => {
                const props = def.properties ? Object.keys(def.properties).join(', ') : '';
                return `- ${type}: ${def.description || 'Entity'} [Properties: ${props || 'name'}]`;
            }).join('\n');

            // Build relation types description
            const relationList = Object.entries(relations).map(([type, def]) => {
                return `- ${type}: ${def.from || '*'} → ${def.to || '*'} (${def.description || 'relationship'})`;
            }).join('\n');

            return {
                entityTypes: entityList,
                relationTypes: relationList,
                entityNames: Object.keys(entityTypes),
                relationNames: Object.keys(relations)
            };
        } catch (e) {
            console.log('[OntologyAwarePrompts] Could not load ontology:', e.message);
            return this.getDefaultOntologyContext();
        }
    }

    /**
     * Default ontology context if no ontology loaded
     */
    getDefaultOntologyContext() {
        return {
            entityTypes: `- Person: People mentioned (name, role, organization, email)
- Project: Projects discussed (name, status, description)
- Meeting: Meetings referenced (title, date, attendees)
- Document: Documents mentioned (title, type)
- Technology: Technologies/tools (name, category)
- Organization: Companies/teams (name, type)
- Decision: Decisions made (content, owner, date)
- Risk: Risks identified (content, impact, likelihood)
- Task: Action items (task, owner, deadline)
- Topic: Discussion topics (name, category)`,
            relationTypes: `- WORKS_ON: Person → Project
- ATTENDS: Person → Meeting
- WORKS_AT: Person → Organization
- USES: Project → Technology
- MADE_DECISION: Person → Decision
- OWNS: Person → Task
- REPORTS_TO: Person → Person
- MANAGES: Person → Person/Team
- MENTIONED_IN: Entity → Document/Meeting
- RELATED_TO: Entity → Entity`,
            entityNames: ['Person', 'Project', 'Meeting', 'Document', 'Technology', 'Organization', 'Decision', 'Risk', 'Task', 'Topic'],
            relationNames: ['WORKS_ON', 'ATTENDS', 'WORKS_AT', 'USES', 'MADE_DECISION', 'OWNS', 'REPORTS_TO', 'MANAGES', 'MENTIONED_IN', 'RELATED_TO']
        };
    }

    /**
     * Build document extraction prompt with ontology context
     * Tries to load from DB first, falls back to hardcoded
     */
    async buildDocumentPromptAsync(content, filename, options = {}) {
        const today = new Date().toISOString().split('T')[0];
        const roleContext = this.userRole ? `- User Role: ${this.userRole} (prioritize information relevant to this role)\n` : '';
        const projectCtx = this.projectContext ? `- Project Context: ${this.projectContext}\n` : '';

        // Try DB prompt first
        const dbPrompt = await this.renderDBPrompt('document', {
            TODAY: today,
            FILENAME: filename,
            CONTENT_LENGTH: String(content.length),
            ROLE_CONTEXT: roleContext,
            PROJECT_CONTEXT: projectCtx,
            CONTENT: content
        });

        if (dbPrompt) return dbPrompt;

        // Fallback to hardcoded
        return this.buildDocumentPrompt(content, filename, options);
    }

    /**
     * Build document extraction prompt with ontology context (sync version, hardcoded fallback)
     */
    buildDocumentPrompt(content, filename, options = {}) {
        const today = new Date().toISOString().split('T')[0];
        const ontology = this.getOntologyContext();
        const roleContext = this.userRole ? `- User Role: ${this.userRole} (prioritize information relevant to this role)\n` : '';
        const projectCtx = this.projectContext ? `- Project Context: ${this.projectContext}\n` : '';

        return `/no_think
You are an expert knowledge extraction assistant with deep understanding of knowledge graphs.
Your task is to extract structured information that will populate a knowledge graph.

## ONTOLOGY CONTEXT
The knowledge graph uses these entity types:
${ontology.entityTypes}

And these relationship types:
${ontology.relationTypes}

## DOCUMENT CONTEXT
- Current date: ${today}
- Document: ${filename}
- Content Length: ${content.length} characters
${roleContext}${projectCtx}

## CONTENT:
${content}

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
This ensures consistency across the knowledge graph.`;
    }

    /**
     * Build transcript extraction prompt - async version (loads from DB)
     */
    async buildTranscriptPromptAsync(content, filename, options = {}) {
        const today = new Date().toISOString().split('T')[0];
        const roleContext = this.userRole ? `- User Role: ${this.userRole}\n` : '';
        const projectCtx = this.projectContext ? `- Project Context: ${this.projectContext}\n` : '';

        const dbPrompt = await this.renderDBPrompt('transcript', {
            TODAY: today,
            FILENAME: filename,
            CONTENT_LENGTH: String(content.length),
            ROLE_CONTEXT: roleContext,
            PROJECT_CONTEXT: projectCtx,
            CONTENT: content
        });

        if (dbPrompt) return dbPrompt;
        return this.buildTranscriptPrompt(content, filename, options);
    }

    /**
     * Build transcript extraction prompt with ontology context (sync fallback)
     */
    buildTranscriptPrompt(content, filename, options = {}) {
        const today = new Date().toISOString().split('T')[0];
        const ontology = this.getOntologyContext();
        const roleContext = this.userRole ? `- User Role: ${this.userRole}\n` : '';
        const projectCtx = this.projectContext ? `- Project Context: ${this.projectContext}\n` : '';

        return `/no_think
You are an expert meeting analyst extracting knowledge graph data from transcripts.

## ONTOLOGY CONTEXT
The knowledge graph uses these entity types:
${ontology.entityTypes}

And these relationship types:
${ontology.relationTypes}

## MEETING CONTEXT
- Current date: ${today}
- Meeting: ${filename}
- Content Length: ${content.length} characters
${roleContext}${projectCtx}

## TRANSCRIPT:
${content}

## EXTRACTION MANDATE
Extract ALL meeting information following the ontology schema.
Meetings are rich sources of relationships - extract who works with whom, who decided what, etc.

### MEETING-SPECIFIC EXTRACTION:

**PARTICIPANTS (Person entities):**
- Extract ALL people who spoke or were mentioned
- Include their role and organization if stated
- Create ATTENDS relationships: Person ATTENDS this Meeting

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
        "date": "${today}",
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
        {"from": "Person", "fromType": "Person", "relation": "ATTENDS", "to": "Meeting Title", "toType": "Meeting"},
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

CRITICAL: Map all extracted information to ontology types for graph consistency.`;
    }

    /**
     * Build conversation extraction prompt - async version (loads from DB)
     */
    async buildConversationPromptAsync(content, conversationTitle, options = {}) {
        const today = new Date().toISOString().split('T')[0];

        const dbPrompt = await this.renderDBPrompt('conversation', {
            TODAY: today,
            FILENAME: conversationTitle,
            CONTENT: content
        });

        if (dbPrompt) return dbPrompt;
        return this.buildConversationPrompt(content, conversationTitle, options);
    }

    /**
     * Build conversation extraction prompt with ontology context (sync fallback)
     */
    buildConversationPrompt(content, conversationTitle, options = {}) {
        const today = new Date().toISOString().split('T')[0];
        const ontology = this.getOntologyContext();

        return `/no_think
You are an expert at extracting knowledge from chat conversations.

## ONTOLOGY CONTEXT
The knowledge graph uses these entity types:
${ontology.entityTypes}

And these relationship types:
${ontology.relationTypes}

## CONVERSATION CONTEXT
- Date: ${today}
- Conversation: ${conversationTitle}

## MESSAGES:
${content}

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
}`;
    }

    /**
     * Build vision/image extraction prompt - async version (loads from DB)
     */
    async buildVisionPromptAsync(filename, options = {}) {
        const dbPrompt = await this.renderDBPrompt('vision', {
            FILENAME: filename
        });

        if (dbPrompt) return dbPrompt;
        return this.buildVisionPrompt(filename, options);
    }

    /**
     * Build vision/image extraction prompt with ontology context (sync fallback)
     */
    buildVisionPrompt(filename, options = {}) {
        const ontology = this.getOntologyContext();

        return `Analyze this image/document for knowledge extraction.

## ONTOLOGY CONTEXT
Extract entities of these types if visible:
${ontology.entityTypes}

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

Map all extracted information to the ontology types for graph consistency.`;
    }

    /**
     * Generate Cypher queries from extracted data
     */
    generateCypherFromExtraction(extraction) {
        const queries = [];

        // Create entity nodes
        for (const entity of extraction.entities || []) {
            const props = entity.properties || {};
            props.name = entity.name;
            const propsStr = Object.entries(props)
                .filter(([k, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${k}: $${k}`)
                .join(', ');

            queries.push({
                query: `MERGE (n:${entity.type} {name: $name}) SET n += {${propsStr}}`,
                params: props
            });
        }

        // Create relationships
        for (const rel of extraction.relationships || []) {
            queries.push({
                query: `MATCH (a:${rel.fromType} {name: $fromName}), (b:${rel.toType} {name: $toName}) MERGE (a)-[:${rel.relation}]->(b)`,
                params: { fromName: rel.from, toName: rel.to }
            });
        }

        return queries;
    }
}

// Singleton
let ontologyAwarePromptsInstance = null;
function getOntologyAwarePrompts(options = {}) {
    if (!ontologyAwarePromptsInstance) {
        ontologyAwarePromptsInstance = new OntologyAwarePrompts(options);
    }
    if (options.ontology) ontologyAwarePromptsInstance.ontology = options.ontology;
    if (options.userRole) ontologyAwarePromptsInstance.userRole = options.userRole;
    if (options.projectContext) ontologyAwarePromptsInstance.projectContext = options.projectContext;
    return ontologyAwarePromptsInstance;
}

module.exports = { OntologyAwarePrompts, getOntologyAwarePrompts };
