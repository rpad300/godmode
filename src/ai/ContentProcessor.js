/**
 * AI Content Processor
 * Uses LLM to intelligently extract entities, relationships, and insights
 * from documents, transcripts, and conversations
 * 
 * SOTA v2.0 - Now includes EntityResolver integration for deduplication
 */

const llm = require('../llm');
const { getOntologyManager } = require('../ontology');

// Try to load prompts service for Supabase prompts
let promptsService = null;
try {
    promptsService = require('../supabase/prompts');
} catch (e) {
    console.log('[ContentProcessor] Supabase prompts service not available');
}

// Try to load transcript validator
let transcriptValidator = null;
try {
    transcriptValidator = require('../validators');
} catch (e) {
    console.log('[ContentProcessor] Validators not available');
}

// Try to load EntityResolver for deduplication (SOTA v2.0)
let EntityResolver = null;
try {
    const resolverModule = require('../optimizations/EntityResolver');
    EntityResolver = resolverModule.EntityResolver || resolverModule.getEntityResolver;
} catch (e) {
    console.log('[ContentProcessor] EntityResolver not available');
}

// Try to load OrganizationResolver for company dedup (SOTA v2.0)
let OrganizationResolver = null;
try {
    const orgModule = require('../optimizations/OrganizationResolver');
    OrganizationResolver = orgModule.OrganizationResolver || orgModule.getOrganizationResolver;
} catch (e) {
    console.log('[ContentProcessor] OrganizationResolver not available');
}

class AIContentProcessor {
    constructor(options = {}) {
        // IMPORTANT: Provider and model should come from config, not defaults
        // If not provided, caller must ensure config is passed properly
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        this.ontology = options.ontology || getOntologyManager();
        this.storage = options.storage || null; // For contacts context
        
        if (!this.llmProvider) {
            console.warn('[AIContentProcessor] No LLM provider specified - caller should pass from admin config');
        }
        if (!this.llmModel) {
            console.warn('[AIContentProcessor] No LLM model specified - caller should pass from admin config');
        }
        
        // Processing options
        this.extractEntities = options.extractEntities !== false;
        this.extractRelationships = options.extractRelationships !== false;
        this.generateInsights = options.generateInsights !== false;
        this.enrichForGraph = options.enrichForGraph !== false;
        
        // Batch processing
        this.maxChunkSize = options.maxChunkSize || 4000; // tokens approx
        this.maxEntitiesPerChunk = options.maxEntitiesPerChunk || 20;
        
        // Validation options (v1.6)
        this.strictValidation = options.strictValidation || false;
        
        // Contacts context cache
        this.contactsContext = '';

        // Supabase prompts cache
        this.supabasePrompts = {};
        this.promptsLoaded = false;
    }

    /**
     * Load prompts from Supabase
     */
    async loadPromptsFromSupabase() {
        if (this.promptsLoaded || !promptsService) return;

        try {
            this.supabasePrompts = await promptsService.getAllPrompts() || {};
            this.promptsLoaded = true;
            console.log(`[ContentProcessor] Loaded ${Object.keys(this.supabasePrompts).length} prompts from Supabase`);
        } catch (e) {
            console.log('[ContentProcessor] Could not load prompts:', e.message);
        }
    }

    /**
     * Get a prompt template from Supabase
     */
    getSupabasePrompt(key) {
        return this.supabasePrompts[key]?.prompt_template || null;
    }

    /**
     * Generate a short hash from content for deterministic IDs
     */
    generateContentHash(content) {
        if (!content) return 'unknown';
        
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
    }

    /**
     * Process and save Person entities to contacts directory
     * Called after extraction to sync extracted people to contacts
     * SOTA v2.0 - Now uses EntityResolver for intelligent deduplication
     * @param {Object} result - Extraction result with entities array
     * @param {string} projectId - Project ID
     * @param {string} documentId - Source document ID (optional)
     * @returns {Promise<{created: number, matched: number, merged: number, errors: number}>}
     */
    async processAndSaveEntities(result, projectId, documentId = null) {
        if (!result?.entities?.length || !this.storage) {
            return { created: 0, matched: 0, merged: 0, errors: 0 };
        }

        const personEntities = result.entities.filter(e => 
            e.type === 'Person' || e.type === 'person'
        );

        if (!personEntities.length) {
            return { created: 0, matched: 0, merged: 0, errors: 0 };
        }

        console.log(`[ContentProcessor] Processing ${personEntities.length} Person entities to contacts`);

        let created = 0, matched = 0, merged = 0, errors = 0;
        
        // Initialize EntityResolver if available (SOTA v2.0)
        let resolver = null;
        if (EntityResolver && this.graphProvider) {
            try {
                resolver = typeof EntityResolver === 'function' 
                    ? EntityResolver({ graphProvider: this.graphProvider, llmConfig: this.llmConfig })
                    : new EntityResolver({ graphProvider: this.graphProvider, llmConfig: this.llmConfig });
            } catch (e) {
                console.log('[ContentProcessor] Could not initialize EntityResolver:', e.message);
            }
        }
        
        // Initialize OrganizationResolver for company dedup (SOTA v2.0)
        let orgResolver = null;
        if (OrganizationResolver && this.storage) {
            try {
                orgResolver = typeof OrganizationResolver === 'function'
                    ? OrganizationResolver({ storage: this.storage, llmConfig: this.llmConfig })
                    : new OrganizationResolver({ storage: this.storage, llmConfig: this.llmConfig });
            } catch (e) {
                // Organization resolver not critical
            }
        }

        for (const person of personEntities) {
            try {
                // Extract person data from entity
                const personData = {
                    name: person.name || person.properties?.name,
                    email: person.properties?.email || person.email,
                    organization: person.properties?.organization || person.organization,
                    role: person.properties?.role || person.role,
                    aliases: person.aliases || person.properties?.aliases || [],
                    sourceDocumentId: documentId
                };

                if (!personData.name) {
                    continue;
                }
                
                // SOTA v2.0: Check for duplicates using EntityResolver before storage
                if (resolver) {
                    try {
                        const duplicates = await resolver.findDuplicates({
                            type: 'Person',
                            name: personData.name,
                            email: personData.email,
                            organization: personData.organization
                        });
                        
                        if (duplicates.length > 0) {
                            const best = duplicates[0];
                            if (best.similarity >= 0.9) {
                                // High confidence - auto-merge
                                console.log(`[ContentProcessor] Auto-matched "${personData.name}" to "${best.name}" (${(best.similarity * 100).toFixed(0)}%)`);
                                merged++;
                                continue;
                            } else if (best.similarity >= 0.75) {
                                // Medium confidence - log but still create (will show in review)
                                console.log(`[ContentProcessor] Potential duplicate: "${personData.name}" ~ "${best.name}" (${(best.similarity * 100).toFixed(0)}%)`);
                            }
                        }
                    } catch (e) {
                        // Continue with normal processing if resolver fails
                    }
                }
                
                // SOTA v2.0: Normalize organization name if resolver available
                if (orgResolver && personData.organization) {
                    try {
                        const orgResult = await orgResolver.findOrCreate(personData.organization, {
                            autoMerge: true
                        });
                        if (!orgResult.isNew && orgResult.name) {
                            personData.organization = orgResult.name; // Use canonical name
                        }
                    } catch (e) {
                        // Continue with original org name
                    }
                }

                // Use findOrCreateContact for deduplication
                const { contact, action } = await this.storage.findOrCreateContact(personData);
                
                if (action === 'created') {
                    created++;
                } else if (action.startsWith('matched')) {
                    matched++;
                } else if (action === 'error') {
                    errors++;
                }
            } catch (err) {
                console.error(`[ContentProcessor] Failed to save entity ${person.name}:`, err.message);
                errors++;
            }
        }

        console.log(`[ContentProcessor] Entity sync: ${created} created, ${matched} matched, ${merged} auto-merged, ${errors} errors`);
        return { created, matched, merged, errors };
    }

    /**
     * Enrich extraction result with runtime metadata
     */
    enrichExtractionMetadata(result) {
        if (!result) return result;
        
        const now = new Date().toISOString();
        
        if (result.extraction_metadata) {
            result.extraction_metadata.extracted_at = now;
        }
        
        return result;
    }

    /**
     * Render a prompt template with variables
     */
    renderPromptTemplate(template, variables = {}) {
        if (!template) return null;
        
        // Auto-generate CONTENT_HASH if CONTENT is provided but CONTENT_HASH is not
        if (variables.CONTENT && !variables.CONTENT_HASH) {
            variables.CONTENT_HASH = this.generateContentHash(variables.CONTENT);
        }

        let rendered = template;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            rendered = rendered.replace(placeholder, value || '');
        }
        
        return rendered.replace(/\{\{[A-Z_]+\}\}/g, '');
    }

    /**
     * Set storage for contacts context
     */
    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Build contacts context with role prompts for AI understanding
     */
    buildContactsContext(participantNames = []) {
        if (!this.storage) return '';
        
        try {
            // Get contacts context from storage (now includes rolePrompt)
            const context = this.storage.getContactsContextForAI?.(participantNames);
            return context || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * Get context variables for v1.6 prompts (async)
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Context variable strings
     */
    async getContextVariables(projectId) {
        if (!promptsService || !projectId) {
            return {
                CONTACTS_INDEX: '',
                ORG_INDEX: '',
                PROJECT_INDEX: '',
                USERNAME_MAP: '',
                DOMAIN_MAP: ''
            };
        }

        try {
            return await promptsService.buildContextVariables(projectId);
        } catch (e) {
            console.log('[ContentProcessor] Failed to get context variables:', e.message);
            return {
                CONTACTS_INDEX: '',
                ORG_INDEX: '',
                PROJECT_INDEX: '',
                USERNAME_MAP: '',
                DOMAIN_MAP: ''
            };
        }
    }

    /**
     * Process a document and extract structured data
     * @param {object} document - Document with content, title, type
     * @returns {Promise<object>} - Extracted entities, relationships, insights
     */
    async processDocument(document) {
        const startTime = Date.now();
        console.log(`[AIProcessor] Processing document: ${document.title || 'Untitled'}`);
        
        const content = document.content || document.text || '';
        if (!content || content.length < 50) {
            return { entities: [], relationships: [], insights: [], cypherQueries: [] };
        }

        // Split into chunks if needed
        const chunks = this.chunkContent(content);
        
        let allEntities = [];
        let allRelationships = [];
        let allInsights = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`[AIProcessor] Processing chunk ${i + 1}/${chunks.length}`);
            
            const result = await this.extractFromChunk(chunk, {
                documentTitle: document.title,
                documentType: document.type,
                chunkIndex: i,
                totalChunks: chunks.length
            });
            
            allEntities = allEntities.concat(result.entities || []);
            allRelationships = allRelationships.concat(result.relationships || []);
            allInsights = allInsights.concat(result.insights || []);
        }
        
        // Deduplicate entities
        const uniqueEntities = this.deduplicateEntities(allEntities);
        const uniqueRelationships = this.deduplicateRelationships(allRelationships);
        
        // Generate Cypher queries for graph population
        let cypherQueries = [];
        if (this.enrichForGraph) {
            cypherQueries = this.generateCypherQueries(uniqueEntities, uniqueRelationships, document);
        }
        
        const latencyMs = Date.now() - startTime;
        console.log(`[AIProcessor] Extracted ${uniqueEntities.length} entities, ${uniqueRelationships.length} relationships in ${latencyMs}ms`);
        
        // Sync extracted Person entities to contacts (v1.6)
        let entitySync = { created: 0, matched: 0, errors: 0 };
        if (this.storage && document.projectId) {
            entitySync = await this.processAndSaveEntities(
                { entities: uniqueEntities },
                document.projectId,
                document.id
            );
        }
        
        return {
            entities: uniqueEntities,
            relationships: uniqueRelationships,
            insights: allInsights,
            cypherQueries,
            latencyMs,
            entitySync
        };
    }

    /**
     * Process a transcript and extract meeting insights
     * @param {object} transcript - Transcript with speakers, content
     * @returns {Promise<object>}
     */
    async processTranscript(transcript) {
        // Load prompts from Supabase before processing
        await this.loadPromptsFromSupabase();

        const startTime = Date.now();
        console.log(`[AIProcessor] Processing transcript: ${transcript.title || 'Untitled Meeting'}`);
        
        const content = transcript.content || transcript.text || '';
        const speakers = transcript.speakers || [];
        
        // Get context variables for v1.6 (entity resolution)
        this._contextVariables = await this.getContextVariables(transcript.projectId);
        
        // Build context for transcript processing
        const prompt = this.buildTranscriptPrompt(content, speakers, transcript);
        
        try {
            // Determine maxTokens based on model - newer models support higher limits
            let maxTokens = 16000;
            if (this.llmModel?.includes('gpt-5') || this.llmModel?.includes('gpt-4.5')) {
                maxTokens = 32000; // gpt-5.x and gpt-4.5 support higher output
            } else if (this.llmModel?.includes('o1') || this.llmModel?.includes('o3')) {
                maxTokens = 65536; // Reasoning models have much higher limits
            }
            
            console.log(`[AIProcessor] Using maxTokens=${maxTokens} for model=${this.llmModel}`);
            
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.2,
                maxTokens
            });

            if (!result.success) {
                console.log('[AIProcessor] LLM call failed:', result.error);
                return this.fallbackTranscriptExtraction(transcript);
            }

            // Debug: log response length and first 500 chars
            console.log(`[AIProcessor] LLM response length: ${result.text?.length || 0} chars`);
            if (result.text && result.text.length < 500) {
                console.log(`[AIProcessor] Full response (short): ${result.text}`);
            } else if (result.text) {
                console.log(`[AIProcessor] Response preview: ${result.text.substring(0, 500)}...`);
            }

            const parsed = this.parseTranscriptResponse(result.text);
            
            // Generate Cypher queries
            let cypherQueries = [];
            if (this.enrichForGraph) {
                cypherQueries = this.generateMeetingCypher(parsed, transcript);
            }
            
            const latencyMs = Date.now() - startTime;
            console.log(`[AIProcessor] Transcript processed in ${latencyMs}ms`);
            
            // Sync extracted Person entities to contacts (v1.6)
            let entitySync = { created: 0, matched: 0, errors: 0 };
            if (this.storage && transcript.projectId) {
                entitySync = await this.processAndSaveEntities(
                    parsed,
                    transcript.projectId,
                    transcript.documentId || transcript.id
                );
            }
            
            return {
                ...parsed,
                cypherQueries,
                latencyMs,
                entitySync,
                usage: result.usage // Pass LLM token usage for logging
            };
        } catch (error) {
            console.error('[AIProcessor] Error processing transcript:', error.message);
            return this.fallbackTranscriptExtraction(transcript);
        }
    }

    /**
     * Process a conversation and extract participants and topics
     * @param {object} conversation - Conversation with messages
     * @returns {Promise<object>}
     */
    async processConversation(conversation) {
        // Load prompts from Supabase before processing
        await this.loadPromptsFromSupabase();

        const startTime = Date.now();
        console.log(`[AIProcessor] Processing conversation: ${conversation.title || 'Untitled'}`);
        
        const messages = conversation.messages || [];
        if (messages.length === 0) {
            return { participants: [], topics: [], entities: [], relationships: [], cypherQueries: [] };
        }

        // Get context variables for v1.6 (entity resolution)
        this._contextVariables = await this.getContextVariables(conversation.projectId);

        // Build conversation text for analysis
        const conversationText = messages.map(m => 
            `[${m.speaker || 'Unknown'}]: ${m.text}`
        ).join('\n');

        const prompt = this.buildConversationPrompt(conversationText, conversation);
        
        try {
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.2,
                maxTokens: 1500
            });

            if (!result.success) {
                console.log('[AIProcessor] LLM call failed:', result.error);
                return this.fallbackConversationExtraction(conversation);
            }

            const parsed = this.parseConversationResponse(result.text);
            
            // Generate Cypher queries
            let cypherQueries = [];
            if (this.enrichForGraph) {
                cypherQueries = this.generateConversationCypher(parsed, conversation);
            }
            
            const latencyMs = Date.now() - startTime;
            console.log(`[AIProcessor] Conversation processed in ${latencyMs}ms`);
            
            // Sync extracted Person entities to contacts (v1.6)
            let entitySync = { created: 0, matched: 0, errors: 0 };
            if (this.storage && conversation.projectId) {
                entitySync = await this.processAndSaveEntities(
                    parsed,
                    conversation.projectId,
                    conversation.documentId || conversation.id
                );
            }
            
            return {
                ...parsed,
                cypherQueries,
                latencyMs,
                entitySync,
                usage: result.usage // Pass LLM token usage for logging
            };
        } catch (error) {
            console.error('[AIProcessor] Error processing conversation:', error.message);
            return this.fallbackConversationExtraction(conversation);
        }
    }

    /**
     * Extract entities and relationships from a text chunk
     */
    async extractFromChunk(chunk, context = {}) {
        const schema = this.ontology.getSchema();
        const entityTypes = schema?.entities ? Object.keys(schema.entities) : [
            'Person', 'Project', 'Technology', 'Client', 'Meeting', 'Document', 'Task', 'Decision', 'Risk'
        ];
        const relationTypes = schema?.relations ? Object.keys(schema.relations) : [
            'WORKS_ON', 'WORKS_AT', 'MANAGES', 'USES', 'RELATES_TO', 'MENTIONS', 'DECIDED_BY', 'ASSIGNED_TO'
        ];

        const prompt = `You are an expert at extracting structured information from text.
Analyze the following text and extract:
1. ENTITIES: Named things with their type
2. RELATIONSHIPS: Connections between entities
3. INSIGHTS: Key facts or observations

AVAILABLE ENTITY TYPES: ${entityTypes.join(', ')}
AVAILABLE RELATIONSHIP TYPES: ${relationTypes.join(', ')}

CONTEXT:
- Document: ${context.documentTitle || 'Unknown'}
- Type: ${context.documentType || 'general'}
- Chunk: ${context.chunkIndex + 1}/${context.totalChunks}

TEXT TO ANALYZE:
"""
${chunk}
"""

Respond in this EXACT JSON format:
{
  "entities": [
    {"name": "Entity Name", "type": "Person|Project|Technology|etc", "properties": {"role": "optional", "description": "optional"}}
  ],
  "relationships": [
    {"from": "Entity1 Name", "to": "Entity2 Name", "type": "WORKS_ON|MANAGES|etc", "properties": {"context": "optional"}}
  ],
  "insights": [
    "Key insight or fact extracted from the text"
  ]
}

IMPORTANT:
- Extract ONLY entities and relationships clearly mentioned in the text
- Use the entity types provided above
- Include at least name and type for each entity
- Be precise with entity names (use full names when available)`;

        try {
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.1,
                maxTokens: 1500
            });

            if (!result.success) {
                return { entities: [], relationships: [], insights: [] };
            }

            return this.parseExtractionResponse(result.text);
        } catch (error) {
            console.error('[AIProcessor] Chunk extraction error:', error.message);
            return { entities: [], relationships: [], insights: [] };
        }
    }

    /**
     * Build prompt for transcript processing
     * 
     * PRIORITY: Supabase prompt > Hardcoded fallback
     */
    buildTranscriptPrompt(content, speakers, transcript) {
        const speakerList = speakers.length > 0 
            ? `Known speakers: ${speakers.join(', ')}`
            : 'Speakers will be identified from the transcript';

        // Get contacts context with role prompts
        const contactsContext = this.buildContactsContext(speakers);
        const today = new Date().toISOString().split('T')[0];

        // TRY SUPABASE PROMPT FIRST
        const supabaseTemplate = this.getSupabasePrompt('transcript');
        
        if (supabaseTemplate) {
            console.log('[ContentProcessor] Using Supabase prompt for: transcript');
            
            // Get ontology context
            let ontologyContext = '';
            try {
                const schema = this.ontology.getSchema();
                if (schema) {
                    const entityTypes = Object.entries(schema.entities || {}).map(([type, def]) => 
                        `- ${type}: ${def.description || 'Entity'}`).join('\n');
                    const relationTypes = Object.entries(schema.relations || {}).map(([type, def]) => 
                        `- ${type}: ${def.from || '*'} → ${def.to || '*'}`).join('\n');
                    ontologyContext = `## ONTOLOGY CONTEXT\nEntity types:\n${entityTypes}\n\nRelation types:\n${relationTypes}`;
                }
            } catch (e) {}

            // Get context variables for v1.6 entity resolution
            const ctx = this._contextVariables || {};
            
            return this.renderPromptTemplate(supabaseTemplate, {
                TODAY: today,
                FILENAME: transcript.title || 'Unknown Meeting',
                CONTENT: content,
                CONTENT_LENGTH: String(content.length),
                ROLE_CONTEXT: contactsContext ? `## KNOWN PARTICIPANTS\n${contactsContext}` : '',
                PROJECT_CONTEXT: '',
                ONTOLOGY_SECTION: ontologyContext,
                // v1.6 context variables
                CONTACTS_INDEX: ctx.CONTACTS_INDEX || '',
                ORG_INDEX: ctx.ORG_INDEX || '',
                PROJECT_INDEX: ctx.PROJECT_INDEX || '',
                USERNAME_MAP: ctx.USERNAME_MAP || '',
                DOMAIN_MAP: ctx.DOMAIN_MAP || ''
            });
        }

        // FALLBACK: Hardcoded prompt
        return `You are an expert meeting analyst. Analyze this meeting transcript and extract structured information.

TRANSCRIPT METADATA:
- Title: ${transcript.title || 'Unknown Meeting'}
- Date: ${transcript.date || 'Unknown'}
${speakerList}

${contactsContext ? `
## KNOWN PARTICIPANTS CONTEXT
Use this context to better understand who these people are, their roles, and their responsibilities.
This helps you correctly attribute decisions and actions to the right people.

${contactsContext}
` : ''}

TRANSCRIPT:
"""
${content.substring(0, 8000)}
"""

Extract and respond in this EXACT JSON format:
{
  "participants": [
    {"name": "Full Name", "role": "Role if mentioned", "organization": "Org if mentioned"}
  ],
  "topics": ["Main topic 1", "Main topic 2"],
  "decisions": [
    {"content": "Decision made", "owner": "Person responsible", "date": "${transcript.date || 'Unknown'}"}
  ],
  "actionItems": [
    {"task": "Action to take", "assignee": "Person name", "deadline": "if mentioned"}
  ],
  "keyPoints": ["Important point 1", "Important point 2"],
  "entities": [
    {"name": "Entity Name", "type": "Project|Technology|Client|etc"}
  ],
  "relationships": [
    {"from": "Person/Entity", "to": "Person/Entity", "type": "WORKS_ON|MANAGES|DISCUSSED"}
  ],
  "summary": "2-3 sentence summary of the meeting"
}

IMPORTANT:
- Extract real names, not placeholders
- Use the participant context above to understand their roles and responsibilities
- Assign decisions and actions to the correct person based on their role
- Identify actual decisions made (not just discussions)
- List concrete action items with assignees
- Be accurate with relationships`;
    }

    /**
     * Build prompt for conversation processing
     * Enhanced to extract Facts, Decisions, Risks, Questions, Actions for knowledge base
     * 
     * PRIORITY: Supabase prompt > Hardcoded fallback
     */
    buildConversationPrompt(conversationText, conversation) {
        // Get participants from conversation
        const participants = conversation.participants || [];
        const contactsContext = this.buildContactsContext(participants);
        const today = new Date().toISOString().split('T')[0];

        // TRY SUPABASE PROMPT FIRST
        const supabaseTemplate = this.getSupabasePrompt('conversation');
        
        if (supabaseTemplate) {
            console.log('[ContentProcessor] Using Supabase prompt for: conversation');
            
            // Get ontology context
            let ontologyContext = '';
            try {
                const schema = this.ontology.getSchema();
                if (schema) {
                    const entityTypes = Object.entries(schema.entities || {}).map(([type, def]) => 
                        `- ${type}: ${def.description || 'Entity'}`).join('\n');
                    const relationTypes = Object.entries(schema.relations || {}).map(([type, def]) => 
                        `- ${type}: ${def.from || '*'} → ${def.to || '*'}`).join('\n');
                    ontologyContext = `## ONTOLOGY CONTEXT\nEntity types:\n${entityTypes}\n\nRelation types:\n${relationTypes}`;
                }
            } catch (e) {}

            // Get context variables for v1.6 entity resolution
            const ctx = this._contextVariables || {};
            
            return this.renderPromptTemplate(supabaseTemplate, {
                TODAY: today,
                FILENAME: conversation.title || conversation.channelName || 'Conversation',
                CONTENT: conversationText,
                ONTOLOGY_SECTION: ontologyContext,
                // v1.6 context variables
                CONTACTS_INDEX: ctx.CONTACTS_INDEX || '',
                ORG_INDEX: ctx.ORG_INDEX || '',
                PROJECT_INDEX: ctx.PROJECT_INDEX || '',
                USERNAME_MAP: ctx.USERNAME_MAP || '',
                DOMAIN_MAP: ctx.DOMAIN_MAP || ''
            });
        }

        // FALLBACK: Hardcoded prompt
        return `You are an expert at analyzing chat conversations and extracting knowledge. Extract ALL structured information from this conversation.

CONVERSATION METADATA:
- Title: ${conversation.title || 'Untitled'}
- Source: ${conversation.sourceApp || 'Unknown'}
- Channel: ${conversation.channelName || 'Unknown'}

${contactsContext ? `
## KNOWN PARTICIPANTS CONTEXT
Use this context to better understand who these people are, their roles, responsibilities, and decision-making authority.

${contactsContext}
` : ''}

CONVERSATION:
"""
${conversationText.substring(0, 8000)}
"""

Extract and respond in this EXACT JSON format:
{
  "participants": [
    {"name": "Full Name", "role": "Role if mentioned", "organization": "Organization if mentioned"}
  ],
  "topics": ["Main topic 1", "Main topic 2"],
  "entities": [
    {"name": "Entity Name", "type": "Person|Project|Technology|Client|Organization"}
  ],
  "relationships": [
    {"from": "Entity1", "to": "Entity2", "type": "WORKS_ON|WORKS_AT|MANAGES|KNOWS|DISCUSSED"}
  ],
  "facts": [
    {"content": "Factual statement extracted", "category": "technical|process|people|timeline|general", "confidence": 0.9}
  ],
  "decisions": [
    {"content": "Decision that was made", "owner": "Person who decided", "date": null}
  ],
  "risks": [
    {"content": "Risk or concern mentioned", "impact": "high|medium|low", "mitigation": "How to mitigate if mentioned"}
  ],
  "questions": [
    {"content": "Open question raised", "context": "Why it matters", "priority": "high|medium|low", "assigned_to": "Person if assigned"}
  ],
  "actionItems": [
    {"task": "Action to be done", "owner": "Person responsible", "deadline": null, "status": "pending"}
  ],
  "sentiment": "positive|neutral|negative|mixed",
  "summary": "2-3 sentence summary of the conversation"
}

EXTRACTION RULES:
1. FACTS: Extract confirmed statements, technical details, timelines, project info
2. DECISIONS: Only actual decisions made (not suggestions or discussions)
3. RISKS: Concerns, blockers, problems mentioned
4. QUESTIONS: Open items that need follow-up
5. ACTION ITEMS: Tasks with owners mentioned - use participant context to correctly assign
6. PARTICIPANTS: Real names, not generic labels
7. Use the participant context above to understand their roles and responsibilities
8. Be thorough - extract ALL relevant information`;
    }

    /**
     * Parse extraction response from LLM
     */
    parseExtractionResponse(response) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const cleanedJson = this.cleanJsonString(jsonMatch[0]);
                const parsed = this.enrichExtractionMetadata(JSON.parse(cleanedJson));
                return {
                    entities: parsed.entities || [],
                    relationships: parsed.relationships || [],
                    insights: parsed.insights || [],
                    extraction_metadata: parsed.extraction_metadata || null
                };
            }
        } catch (e) {
            console.log('[AIProcessor] Failed to parse extraction response');
        }
        return { entities: [], relationships: [], insights: [] };
    }

    /**
     * Clean JSON string by removing/escaping control characters
     * LLMs sometimes return control characters inside JSON strings that break parsing
     */
    cleanJsonString(jsonStr) {
        // Replace unescaped control characters inside strings
        // This regex finds strings and cleans control chars within them
        return jsonStr.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
            // Inside a string, replace control characters with escaped versions or remove them
            return match.replace(/[\x00-\x1F\x7F]/g, (char) => {
                switch (char) {
                    case '\n': return '\\n';
                    case '\r': return '\\r';
                    case '\t': return '\\t';
                    case '\b': return '\\b';
                    case '\f': return '\\f';
                    default: return ''; // Remove other control chars
                }
            });
        });
    }

    /**
     * Parse transcript response from LLM (v1.5 with Meeting Notes Pack)
     */
    parseTranscriptResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                // Clean control characters before parsing
                const cleanedJson = this.cleanJsonString(jsonMatch[0]);
                const parsed = this.enrichExtractionMetadata(JSON.parse(cleanedJson));
                
                const result = {
                    // Standard extraction fields
                    extraction_metadata: parsed.extraction_metadata || null,
                    meeting: parsed.meeting || null,
                    turns: parsed.turns || [],
                    entities: parsed.entities || [],
                    relationships: parsed.relationships || [],
                    facts: parsed.facts || [],
                    decisions: parsed.decisions || [],
                    risks: parsed.risks || [],
                    action_items: parsed.action_items || parsed.actionItems || [],
                    questions: parsed.questions || [],
                    summary: parsed.summary || '',
                    key_topics: parsed.key_topics || parsed.keyPoints || [],
                    next_steps: parsed.next_steps || [],
                    
                    // Meeting Notes Pack (v1.5)
                    notes_metadata: parsed.notes_metadata || null,
                    notes: parsed.notes || null,
                    notes_rendered_text: parsed.notes_rendered_text || null,
                    
                    // Coverage
                    extraction_coverage: parsed.extraction_coverage || null,
                    
                    // Legacy compatibility
                    participants: parsed.participants || [],
                    topics: parsed.topics || [],
                    actionItems: parsed.action_items || parsed.actionItems || [],
                    keyPoints: parsed.key_topics || parsed.keyPoints || []
                };

                // Validate if validator is available
                if (transcriptValidator) {
                    const validation = transcriptValidator.validateTranscriptOutput(result);
                    if (!validation.valid) {
                        console.log('[AIProcessor] Transcript validation errors:', validation.errors.slice(0, 5));
                        
                        // In strict mode, throw error to block processing
                        if (this.strictValidation) {
                            const errorMsg = validation.errors.slice(0, 3).map(e => `${e.path}: ${e.message}`).join('; ');
                            throw new Error(`Validation failed: ${errorMsg}`);
                        }
                    }
                    if (validation.warnings.length > 0) {
                        console.log('[AIProcessor] Transcript validation warnings:', validation.warnings.slice(0, 3));
                    }
                    result._validation = validation;
                }

                return result;
            }
        } catch (e) {
            console.log('[AIProcessor] Failed to parse transcript response:', e.message);
        }
        return { 
            participants: [], topics: [], decisions: [], actionItems: [], 
            keyPoints: [], entities: [], relationships: [], summary: '',
            facts: [], risks: [], action_items: [], questions: [],
            notes_metadata: null, notes: null, notes_rendered_text: null
        };
    }

    /**
     * Parse conversation response from LLM
     * Enhanced to include Facts, Decisions, Risks, Questions
     */
    parseConversationResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const cleanedJson = this.cleanJsonString(jsonMatch[0]);
                const parsed = this.enrichExtractionMetadata(JSON.parse(cleanedJson));
                return {
                    participants: parsed.participants || [],
                    topics: parsed.topics || [],
                    entities: parsed.entities || [],
                    relationships: parsed.relationships || [],
                    extraction_metadata: parsed.extraction_metadata || null,
                    // Knowledge base items
                    facts: parsed.facts || [],
                    decisions: parsed.decisions || [],
                    risks: parsed.risks || [],
                    questions: parsed.questions || [],
                    actionItems: parsed.actionItems || [],
                    // Metadata
                    sentiment: parsed.sentiment || 'neutral',
                    summary: parsed.summary || ''
                };
            }
        } catch (e) {
            console.log('[AIProcessor] Failed to parse conversation response');
        }
        return { 
            participants: [], 
            topics: [], 
            entities: [], 
            relationships: [], 
            facts: [],
            decisions: [],
            risks: [],
            questions: [],
            actionItems: [], 
            sentiment: 'neutral', 
            summary: '' 
        };
    }

    /**
     * Generate Cypher queries to populate graph
     */
    generateCypherQueries(entities, relationships, document) {
        const queries = [];
        
        // Create document node
        if (document.id) {
            queries.push({
                query: `MERGE (d:Document {id: $id}) SET d.title = $title, d.type = $type, d.createdAt = datetime()`,
                params: { id: document.id, title: document.title || 'Untitled', type: document.type || 'document' },
                description: 'Create document node'
            });
        }

        // Create entity nodes
        for (const entity of entities) {
            const type = entity.type || 'Entity';
            const props = entity.properties || {};
            
            queries.push({
                query: `MERGE (n:${type} {name: $name}) SET n += $props`,
                params: { 
                    name: entity.name, 
                    props: { ...props, updatedAt: new Date().toISOString() }
                },
                description: `Create/update ${type}: ${entity.name}`
            });
            
            // Link entity to document
            if (document.id) {
                queries.push({
                    query: `MATCH (n:${type} {name: $name}), (d:Document {id: $docId}) MERGE (n)-[:MENTIONED_IN]->(d)`,
                    params: { name: entity.name, docId: document.id },
                    description: `Link ${entity.name} to document`
                });
            }
        }

        // Create relationships
        for (const rel of relationships) {
            queries.push({
                query: `MATCH (a {name: $from}), (b {name: $to}) MERGE (a)-[:${rel.type || 'RELATES_TO'}]->(b)`,
                params: { from: rel.from, to: rel.to },
                description: `Create relationship: ${rel.from} -[${rel.type}]-> ${rel.to}`
            });
        }

        return queries;
    }

    /**
     * Generate Cypher queries for meeting data
     */
    generateMeetingCypher(parsed, transcript) {
        const queries = [];
        const meetingId = transcript.id || `meeting_${Date.now()}`;

        // Create meeting node
        queries.push({
            query: `MERGE (m:Meeting {id: $id}) SET m.title = $title, m.date = $date, m.summary = $summary`,
            params: { 
                id: meetingId, 
                title: transcript.title || 'Untitled Meeting',
                date: transcript.date || new Date().toISOString(),
                summary: parsed.summary || ''
            },
            description: 'Create meeting node'
        });

        // Add participants
        for (const participant of parsed.participants || []) {
            queries.push({
                query: `MERGE (p:Person {name: $name}) SET p.role = coalesce($role, p.role), p.organization = coalesce($org, p.organization)`,
                params: { name: participant.name, role: participant.role, org: participant.organization },
                description: `Create/update person: ${participant.name}`
            });
            
            queries.push({
                query: `MATCH (p:Person {name: $name}), (m:Meeting {id: $meetingId}) MERGE (p)-[:ATTENDS]->(m)`,
                params: { name: participant.name, meetingId },
                description: `${participant.name} attends meeting`
            });
        }

        // Add decisions
        for (const decision of parsed.decisions || []) {
            const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            queries.push({
                query: `CREATE (d:Decision {id: $id, content: $content, owner: $owner, date: $date})`,
                params: { id: decisionId, content: decision.content, owner: decision.owner, date: decision.date },
                description: `Create decision: ${(decision.content || '').substring(0, 50)}...`
            });
            
            queries.push({
                query: `MATCH (d:Decision {id: $id}), (m:Meeting {id: $meetingId}) MERGE (d)-[:MADE_IN]->(m)`,
                params: { id: decisionId, meetingId },
                description: 'Link decision to meeting'
            });
        }

        // Add entities mentioned
        for (const entity of parsed.entities || []) {
            queries.push({
                query: `MERGE (n:${entity.type || 'Entity'} {name: $name})`,
                params: { name: entity.name },
                description: `Create ${entity.type}: ${entity.name}`
            });
            
            queries.push({
                query: `MATCH (n {name: $name}), (m:Meeting {id: $meetingId}) MERGE (n)-[:DISCUSSED_IN]->(m)`,
                params: { name: entity.name, meetingId },
                description: `${entity.name} discussed in meeting`
            });
        }

        return queries;
    }

    /**
     * Generate Cypher queries for conversation data
     */
    generateConversationCypher(parsed, conversation) {
        const queries = [];
        const convId = conversation.id || `conv_${Date.now()}`;

        // Create conversation node
        queries.push({
            query: `MERGE (c:Conversation {id: $id}) SET c.title = $title, c.sourceApp = $source, c.summary = $summary, c.sentiment = $sentiment`,
            params: { 
                id: convId, 
                title: conversation.title || 'Untitled',
                source: conversation.sourceApp || 'unknown',
                summary: parsed.summary || '',
                sentiment: parsed.sentiment || 'neutral'
            },
            description: 'Create conversation node'
        });

        // Add participants
        for (const participant of parsed.participants || []) {
            queries.push({
                query: `MERGE (p:Person {name: $name}) SET p.role = coalesce($role, p.role)`,
                params: { name: participant.name, role: participant.role },
                description: `Create/update person: ${participant.name}`
            });
            
            queries.push({
                query: `MATCH (p:Person {name: $name}), (c:Conversation {id: $convId}) MERGE (p)-[:PARTICIPATED_IN]->(c)`,
                params: { name: participant.name, convId },
                description: `${participant.name} participated in conversation`
            });
        }

        // Add entities
        for (const entity of parsed.entities || []) {
            queries.push({
                query: `MERGE (n:${entity.type || 'Entity'} {name: $name})`,
                params: { name: entity.name },
                description: `Create ${entity.type}: ${entity.name}`
            });
            
            queries.push({
                query: `MATCH (n {name: $name}), (c:Conversation {id: $convId}) MERGE (n)-[:MENTIONED_IN]->(c)`,
                params: { name: entity.name, convId },
                description: `${entity.name} mentioned in conversation`
            });
        }

        // Add questions extracted from conversation
        for (const question of parsed.questions || []) {
            const qId = `question_conv_${convId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            queries.push({
                query: `MERGE (q:Question {content: $content})
                        ON CREATE SET q.id = $id, q.context = $context, q.priority = $priority, q.status = 'pending', q.created_at = datetime()
                        ON MATCH SET q.context = coalesce($context, q.context)`,
                params: { 
                    id: qId,
                    content: question.content, 
                    context: question.context || '',
                    priority: question.priority || 'medium'
                },
                description: `Create question: ${(question.content || '').substring(0, 40)}...`
            });
            
            // Link question to conversation
            queries.push({
                query: `MATCH (q:Question {content: $content}), (c:Conversation {id: $convId}) MERGE (q)-[:QUESTION_FROM_DOCUMENT]->(c)`,
                params: { content: question.content, convId },
                description: `Question extracted from conversation`
            });
            
            // Link to assignee if specified
            if (question.assigned_to) {
                queries.push({
                    query: `MATCH (q:Question {content: $content}), (p:Person {name: $assignee}) MERGE (q)-[:QUESTION_ASSIGNED_TO]->(p)`,
                    params: { content: question.content, assignee: question.assigned_to },
                    description: `Question assigned to ${question.assigned_to}`
                });
            }
        }

        // Add decisions extracted from conversation
        for (const decision of parsed.decisions || []) {
            queries.push({
                query: `MERGE (d:Decision {content: $content})
                        ON CREATE SET d.id = $id, d.owner = $owner, d.created_at = datetime()`,
                params: { 
                    id: `decision_conv_${convId}_${Date.now()}`,
                    content: decision.content, 
                    owner: decision.owner || 'Unknown'
                },
                description: `Create decision: ${(decision.content || '').substring(0, 40)}...`
            });
            
            // Link decision to conversation
            queries.push({
                query: `MATCH (d:Decision {content: $content}), (c:Conversation {id: $convId}) MERGE (d)-[:MENTIONED_IN]->(c)`,
                params: { content: decision.content, convId },
                description: `Decision from conversation`
            });
        }

        return queries;
    }

    /**
     * Chunk content into smaller pieces
     */
    chunkContent(content, maxSize = this.maxChunkSize) {
        const words = content.split(/\s+/);
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;

        for (const word of words) {
            if (currentSize + word.length > maxSize * 4) { // Approx 4 chars per token
                chunks.push(currentChunk.join(' '));
                currentChunk = [word];
                currentSize = word.length;
            } else {
                currentChunk.push(word);
                currentSize += word.length + 1;
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
        }

        return chunks;
    }

    /**
     * Deduplicate entities by name
     */
    deduplicateEntities(entities) {
        const seen = new Map();
        for (const entity of entities) {
            const key = entity.name?.toLowerCase();
            if (key && !seen.has(key)) {
                seen.set(key, entity);
            } else if (key && seen.has(key)) {
                // Merge properties
                const existing = seen.get(key);
                existing.properties = { ...existing.properties, ...entity.properties };
            }
        }
        return Array.from(seen.values());
    }

    /**
     * Deduplicate relationships
     */
    deduplicateRelationships(relationships) {
        const seen = new Set();
        return relationships.filter(rel => {
            const key = `${rel.from?.toLowerCase()}-${rel.type}-${rel.to?.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Fallback extraction for transcripts
     */
    fallbackTranscriptExtraction(transcript) {
        // Basic regex-based extraction
        const content = transcript.content || '';
        const speakerPattern = /^([A-Z][a-z]+ [A-Z][a-z]+|\w+):/gm;
        const participants = [];
        let match;
        while ((match = speakerPattern.exec(content)) !== null) {
            const name = match[1];
            if (!participants.find(p => p.name === name)) {
                participants.push({ name, role: '', organization: '' });
            }
        }
        
        return {
            participants,
            topics: [],
            decisions: [],
            actionItems: [],
            keyPoints: [],
            entities: [],
            relationships: [],
            summary: '',
            cypherQueries: []
        };
    }

    /**
     * Fallback extraction for conversations
     */
    fallbackConversationExtraction(conversation) {
        const messages = conversation.messages || [];
        const participants = [];
        const speakers = new Set();
        
        for (const msg of messages) {
            if (msg.speaker && !speakers.has(msg.speaker)) {
                speakers.add(msg.speaker);
                participants.push({ name: msg.speaker, role: '', organization: '' });
            }
        }
        
        return {
            participants,
            topics: [],
            entities: [],
            relationships: [],
            actionItems: [],
            sentiment: 'neutral',
            summary: '',
            cypherQueries: []
        };
    }
}

// Singleton instance
let aiProcessorInstance = null;

function getAIContentProcessor(options = {}) {
    if (!aiProcessorInstance) {
        aiProcessorInstance = new AIContentProcessor(options);
    } else if (options.llmConfig) {
        aiProcessorInstance.llmConfig = options.llmConfig;
        aiProcessorInstance.llmProvider = options.llmProvider || aiProcessorInstance.llmProvider;
        aiProcessorInstance.llmModel = options.llmModel || aiProcessorInstance.llmModel;
    }
    return aiProcessorInstance;
}

module.exports = {
    AIContentProcessor,
    getAIContentProcessor
};
