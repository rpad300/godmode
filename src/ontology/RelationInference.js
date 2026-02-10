/**
 * RelationInference - Automatic entity and relationship extraction
 * 
 * Uses LLM to:
 * - Extract entities from unstructured text
 * - Infer relationships between entities
 * - Calculate relationship strength
 * - Map extracted data to ontology types
 * 
 * SOTA v3.0 - Native Supabase graph support (no Cypher dependency)
 */

const { logger } = require('../logger');
const { getOntologyManager } = require('./OntologyManager');
const llm = require('../llm');

const log = logger.child({ module: 'relation-inference' });

class RelationInference {
    constructor(options = {}) {
        this.ontology = options.ontology || getOntologyManager();
        this.llmProvider = options.llmProvider; // Legacy - kept for compatibility
        this.llmConfig = options.llmConfig || {};
        this.minConfidence = options.minConfidence || 0.5;
        this.enableLLMExtraction = options.enableLLMExtraction !== false;
    }

    /**
     * Set the LLM provider for extraction
     * @param {object} provider 
     */
    setLLMProvider(provider) {
        this.llmProvider = provider;
    }

    /**
     * Extract entities and relationships from text using LLM
     * @param {string} text - The text to analyze
     * @param {object} context - Additional context (existing entities, etc.)
     * @returns {Promise<{entities: Array, relationships: Array}>}
     */
    async extractFromText(text, context = {}) {
        if (!text || text.trim().length === 0) {
            return { entities: [], relationships: [] };
        }

        // First, try heuristic extraction
        const heuristicResults = this.extractWithHeuristics(text, context);

        // If LLM is available and enabled, enhance with LLM extraction
        if (this.enableLLMExtraction && this.llmProvider) {
            try {
                const llmResults = await this.extractWithLLM(text, context);
                return this.mergeResults(heuristicResults, llmResults);
            } catch (error) {
                log.error({ event: 'relation_inference_llm_extraction_failed', reason: error.message }, 'LLM extraction failed');
                return heuristicResults;
            }
        }

        return heuristicResults;
    }

    /**
     * Extract entities using heuristic rules (no LLM needed)
     * @param {string} text 
     * @param {object} context 
     * @returns {{entities: Array, relationships: Array}}
     */
    extractWithHeuristics(text, context = {}) {
        const entities = [];
        const relationships = [];
        const existingEntities = context.existingEntities || [];

        // Pattern-based entity extraction
        const patterns = {
            // Email pattern -> Person
            email: {
                regex: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
                type: 'Person',
                extractor: (match) => ({ email: match[1], confidence: 0.9 })
            },
            // @mention pattern -> Person
            mention: {
                regex: /@([a-zA-Z][a-zA-Z0-9_]+)/g,
                type: 'Person',
                extractor: (match) => ({ name: match[1], confidence: 0.7 })
            },
            // Date pattern -> could be Meeting date
            date: {
                regex: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g,
                type: null, // Just extraction, not entity
                extractor: (match) => ({ date: match[1], confidence: 0.8 })
            },
            // Project code pattern (e.g., PRJ-123, PROJ123)
            projectCode: {
                regex: /\b([A-Z]{2,5}[-_]?\d{2,6})\b/g,
                type: 'Project',
                extractor: (match) => ({ code: match[1], confidence: 0.6 })
            },
            // Technology names (common ones)
            technology: {
                regex: /\b(JavaScript|TypeScript|Python|Java|Node\.?js|React|Angular|Vue|Docker|Kubernetes|AWS|Azure|GCP|PostgreSQL|MongoDB|Redis|GraphQL|REST|API)\b/gi,
                type: 'Technology',
                extractor: (match) => ({ name: match[1], confidence: 0.85 })
            }
        };

        // Apply patterns
        for (const [patternName, pattern] of Object.entries(patterns)) {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                if (pattern.type) {
                    const extracted = pattern.extractor(match);
                    entities.push({
                        type: pattern.type,
                        ...extracted,
                        source: 'heuristic',
                        pattern: patternName
                    });
                }
            }
        }

        // Match against existing entities
        for (const existing of existingEntities) {
            const name = existing.name || existing.title || '';
            if (name && text.toLowerCase().includes(name.toLowerCase())) {
                entities.push({
                    type: existing._type || 'Unknown',
                    id: existing.id,
                    name: name,
                    confidence: 0.95,
                    source: 'existing_match'
                });
            }
        }

        // Infer relationships based on co-occurrence
        const uniqueEntities = this.deduplicateEntities(entities);
        const inferredRelations = this.inferRelationsFromCooccurrence(uniqueEntities, text);
        relationships.push(...inferredRelations);

        return { entities: uniqueEntities, relationships };
    }

    /**
     * Extract entities using LLM
     * @param {string} text 
     * @param {object} context 
     * @returns {Promise<{entities: Array, relationships: Array}>}
     */
    async extractWithLLM(text, context = {}) {
        const ontologySummary = this.ontology.getSummary();
        
        const systemPrompt = `You are an entity and relationship extractor. Extract structured information from text and map it to the following ontology:

Entity Types: ${ontologySummary.entityTypes.join(', ')}
Relation Types: ${ontologySummary.relationTypes.join(', ')}

Rules:
1. Only extract entities that are explicitly mentioned or strongly implied
2. Assign confidence scores (0-1) based on how certain you are
3. For relationships, only create them if there's clear evidence
4. Map extracted data to the correct ontology types
5. Include all relevant properties you can extract

Respond with JSON only, no other text.`;

        const userPrompt = `Extract all entities and relationships from this text:

"${text}"

${context.existingEntities?.length ? `Known entities that may be referenced: ${JSON.stringify(context.existingEntities.slice(0, 10))}` : ''}

Respond with this JSON structure:
{
  "entities": [
    {"type": "EntityType", "properties": {...}, "confidence": 0.0-1.0}
  ],
  "relationships": [
    {"from": "entity_identifier", "to": "entity_identifier", "type": "RELATION_TYPE", "properties": {...}, "confidence": 0.0-1.0}
  ]
}`;

        try {
            // Use LLM module to go through the global queue
            // Provider and model should come from admin config
            const provider = this.llmConfig.perTask?.text?.provider || this.llmConfig.provider;
            const providerConfig = this.llmConfig.providers?.[provider] || {};
            const model = this.llmConfig.perTask?.text?.model || this.llmConfig.models?.text || this.llmConfig.model;
            
            if (!provider || !model) {
                log.warn({ event: 'relation_inference_no_llm' }, 'No LLM provider/model configured');
                return { entities: [], relationships: [] };
            }
            
            const response = await llm.generateText({
                provider,
                providerConfig,
                model,
                system: systemPrompt,
                prompt: userPrompt,
                temperature: 0.1,
                jsonMode: true,
                context: 'relation_inference',
                priority: 'low' // Background extraction
            });

            if (!response.success) {
                log.error({ event: 'relation_inference_llm_call_failed', reason: response.error }, 'LLM call failed');
                return { entities: [], relationships: [] };
            }

            const result = JSON.parse(response.text || '{}');
            
            // Add source marker
            const entities = (result.entities || []).map(e => ({ ...e, source: 'llm' }));
            const relationships = (result.relationships || []).map(r => ({ ...r, source: 'llm' }));

            return { entities, relationships };
        } catch (error) {
            log.error({ event: 'relation_inference_llm_extraction_error', reason: error.message }, 'LLM extraction error');
            return { entities: [], relationships: [] };
        }
    }

    /**
     * Infer relationships based on entity co-occurrence in text
     * @param {Array} entities 
     * @param {string} text 
     * @returns {Array}
     */
    inferRelationsFromCooccurrence(entities, text) {
        const relationships = [];
        const sentences = text.split(/[.!?]+/).map(s => s.trim().toLowerCase());

        // Group entities by sentence
        for (const sentence of sentences) {
            const entitiesInSentence = entities.filter(e => {
                const name = (e.name || e.title || e.code || '').toLowerCase();
                return name && sentence.includes(name);
            });

            if (entitiesInSentence.length >= 2) {
                // Check for relationship keywords in the sentence
                for (let i = 0; i < entitiesInSentence.length; i++) {
                    for (let j = i + 1; j < entitiesInSentence.length; j++) {
                        const e1 = entitiesInSentence[i];
                        const e2 = entitiesInSentence[j];
                        
                        const inferredRelation = this.inferRelationFromSentence(e1, e2, sentence);
                        if (inferredRelation) {
                            relationships.push(inferredRelation);
                        }
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Infer a specific relationship between two entities based on sentence context
     * @param {object} entity1 
     * @param {object} entity2 
     * @param {string} sentence 
     * @returns {object|null}
     */
    inferRelationFromSentence(entity1, entity2, sentence) {
        const relationPatterns = [
            // Person works on Project
            {
                pattern: /(works|working|assigned|joined|part of|member of)/i,
                fromType: 'Person',
                toType: 'Project',
                relation: 'WORKS_ON',
                confidence: 0.7
            },
            // Person knows Technology
            {
                pattern: /(knows|skilled|expert|experienced|uses)/i,
                fromType: 'Person',
                toType: 'Technology',
                relation: 'HAS_SKILL',
                confidence: 0.6
            },
            // Project uses Technology
            {
                pattern: /(uses|built with|developed with|powered by|based on)/i,
                fromType: 'Project',
                toType: 'Technology',
                relation: 'USES_TECH',
                confidence: 0.7
            },
            // Person authored Document
            {
                pattern: /(wrote|authored|created|prepared|drafted)/i,
                fromType: 'Person',
                toType: 'Document',
                relation: 'AUTHORED',
                confidence: 0.75
            },
            // Meeting about Project
            {
                pattern: /(about|regarding|concerning|discussed|for)/i,
                fromType: 'Meeting',
                toType: 'Project',
                relation: 'ABOUT_PROJECT',
                confidence: 0.6
            },
            // Task assigned to Person
            {
                pattern: /(assigned|responsible|owns|handles)/i,
                fromType: 'Task',
                toType: 'Person',
                relation: 'ASSIGNED_TO',
                confidence: 0.7
            }
        ];

        for (const rp of relationPatterns) {
            if (!rp.pattern.test(sentence)) continue;
            
            // Check if entity types match
            const e1IsFrom = entity1.type === rp.fromType;
            const e1IsTo = entity1.type === rp.toType;
            const e2IsFrom = entity2.type === rp.fromType;
            const e2IsTo = entity2.type === rp.toType;

            if (e1IsFrom && e2IsTo) {
                return {
                    from: entity1.id || entity1.name || entity1.title,
                    fromType: entity1.type,
                    to: entity2.id || entity2.name || entity2.title,
                    toType: entity2.type,
                    type: rp.relation,
                    confidence: rp.confidence,
                    source: 'cooccurrence',
                    context: sentence.substring(0, 100)
                };
            }
            
            if (e2IsFrom && e1IsTo) {
                return {
                    from: entity2.id || entity2.name || entity2.title,
                    fromType: entity2.type,
                    to: entity1.id || entity1.name || entity1.title,
                    toType: entity1.type,
                    type: rp.relation,
                    confidence: rp.confidence,
                    source: 'cooccurrence',
                    context: sentence.substring(0, 100)
                };
            }
        }

        // Default: RELATED_TO relationship for co-occurrence
        if (this.ontology.isValidRelation('RELATED_TO', entity1.type, entity2.type)) {
            return {
                from: entity1.id || entity1.name || entity1.title,
                fromType: entity1.type,
                to: entity2.id || entity2.name || entity2.title,
                toType: entity2.type,
                type: 'RELATED_TO',
                confidence: 0.4,
                source: 'cooccurrence',
                properties: { type: 'co-mentioned' }
            };
        }

        return null;
    }

    /**
     * Merge results from heuristic and LLM extraction
     * @param {object} heuristicResults 
     * @param {object} llmResults 
     * @returns {{entities: Array, relationships: Array}}
     */
    mergeResults(heuristicResults, llmResults) {
        const entities = [];
        const relationships = [];

        // Add all heuristic entities
        for (const entity of heuristicResults.entities) {
            entities.push(entity);
        }

        // Add LLM entities, boosting confidence if they match heuristic ones
        for (const llmEntity of llmResults.entities) {
            const existing = entities.find(e => 
                e.type === llmEntity.type && 
                (e.name === llmEntity.properties?.name || e.id === llmEntity.properties?.id)
            );

            if (existing) {
                // Boost confidence
                existing.confidence = Math.min(1, (existing.confidence + llmEntity.confidence) / 2 + 0.1);
                existing.properties = { ...existing.properties, ...llmEntity.properties };
            } else {
                entities.push({
                    ...llmEntity.properties,
                    type: llmEntity.type,
                    confidence: llmEntity.confidence,
                    source: 'llm'
                });
            }
        }

        // Merge relationships similarly
        for (const rel of heuristicResults.relationships) {
            relationships.push(rel);
        }

        for (const llmRel of llmResults.relationships) {
            const existing = relationships.find(r =>
                r.from === llmRel.from && r.to === llmRel.to && r.type === llmRel.type
            );

            if (existing) {
                existing.confidence = Math.min(1, (existing.confidence + llmRel.confidence) / 2 + 0.1);
            } else {
                relationships.push(llmRel);
            }
        }

        // Filter by minimum confidence
        return {
            entities: entities.filter(e => e.confidence >= this.minConfidence),
            relationships: relationships.filter(r => r.confidence >= this.minConfidence)
        };
    }

    /**
     * Deduplicate entities based on identifying properties
     * @param {Array} entities 
     * @returns {Array}
     */
    deduplicateEntities(entities) {
        const unique = new Map();

        for (const entity of entities) {
            const key = `${entity.type}:${entity.id || entity.name || entity.email || entity.code || JSON.stringify(entity)}`;
            
            if (unique.has(key)) {
                const existing = unique.get(key);
                // Keep the one with higher confidence
                if (entity.confidence > existing.confidence) {
                    unique.set(key, { ...existing, ...entity });
                }
            } else {
                unique.set(key, entity);
            }
        }

        return Array.from(unique.values());
    }

    /**
     * Check if provider is Supabase (SOTA v3.0)
     * @param {object} graphProvider
     * @returns {boolean}
     */
    _isSupabaseProvider(graphProvider) {
        return graphProvider?.constructor?.name === 'SupabaseGraphProvider' ||
               typeof graphProvider?.supabase !== 'undefined' ||
               typeof graphProvider?.getStats === 'function';
    }

    /**
     * Run ontology inference rules on the graph
     * SOTA v3.0 - Delegates to InferenceEngine for Supabase
     * @param {object} graphProvider - The graph database provider
     * @returns {Promise<{rulesApplied: number, relationshipsCreated: number}>}
     */
    async runInferenceRules(graphProvider) {
        if (!graphProvider) {
            return { rulesApplied: 0, relationshipsCreated: 0 };
        }

        // For Supabase provider, delegate to InferenceEngine which has native support
        if (this._isSupabaseProvider(graphProvider)) {
            try {
                const { getInferenceEngine } = require('./InferenceEngine');
                const engine = getInferenceEngine({ graphProvider });
                const result = await engine.runAllRules();
                
                if (result.ok && result.results) {
                    return {
                        rulesApplied: result.results.applied || 0,
                        relationshipsCreated: result.results.relationships || 0
                    };
                }
                return { rulesApplied: 0, relationshipsCreated: 0 };
            } catch (e) {
                log.error({ event: 'relation_inference_native_inference_failed', reason: e.message }, 'Native inference failed');
                return { rulesApplied: 0, relationshipsCreated: 0 };
            }
        }

        // Cypher-based providers
        const rules = this.ontology.getInferenceCyphers();
        let rulesApplied = 0;
        let relationshipsCreated = 0;

        for (const rule of rules) {
            try {
                log.debug({ event: 'relation_inference_rule_run', ruleName: rule.name }, 'Running rule');
                const result = await graphProvider.query(rule.cypher);
                
                if (result.ok) {
                    rulesApplied++;
                    relationshipsCreated += result.stats?.relationshipsCreated || 0;
                }
            } catch (error) {
                log.error({ event: 'relation_inference_rule_failed', ruleName: rule.name, reason: error.message }, 'Rule failed');
            }
        }

        return { rulesApplied, relationshipsCreated };
    }

    /**
     * Calculate relationship strength between entities
     * @param {object} entity1 
     * @param {object} entity2 
     * @param {Array} sharedContext - Things they have in common
     * @returns {number} - Strength from 0 to 1
     */
    calculateRelationStrength(entity1, entity2, sharedContext = []) {
        let strength = 0;

        // Base strength for being related at all
        strength += 0.1;

        // Boost for each shared context item
        strength += Math.min(0.4, sharedContext.length * 0.1);

        // Boost for same organization
        if (entity1.organization && entity1.organization === entity2.organization) {
            strength += 0.2;
        }

        // Boost for working on same project
        const sharedProjects = sharedContext.filter(c => c.type === 'Project');
        strength += Math.min(0.2, sharedProjects.length * 0.1);

        // Boost for attending same meetings
        const sharedMeetings = sharedContext.filter(c => c.type === 'Meeting');
        strength += Math.min(0.1, sharedMeetings.length * 0.05);

        return Math.min(1, strength);
    }
}

// Singleton instance
let instance = null;

/**
 * Get the RelationInference singleton instance
 * @param {object} options 
 * @returns {RelationInference}
 */
function getRelationInference(options = {}) {
    if (!instance) {
        instance = new RelationInference(options);
    }
    return instance;
}

module.exports = {
    RelationInference,
    getRelationInference
};
