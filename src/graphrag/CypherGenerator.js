/**
 * Purpose:
 *   Translates natural-language questions into executable Cypher queries by
 *   combining ontology-based pattern matching with LLM-powered generation.
 *
 * Responsibilities:
 *   - Match incoming questions against pre-defined ontology query patterns
 *     (fast path, high confidence -- avoids LLM call entirely)
 *   - When no pattern matches, prompt an LLM with the graph schema and detected
 *     entity/relation hints to generate a Cypher query
 *   - Parse the structured LLM response (CYPHER / EXPLANATION / CONFIDENCE)
 *   - Provide deterministic fallback queries when LLM generation fails
 *   - Cache generated queries with a 30-minute TTL to reduce LLM traffic
 *
 * Key dependencies:
 *   - ../llm: LLM text generation (provider-agnostic)
 *   - ../ontology: OntologyManager for schema introspection and pattern matching
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Calls external LLM APIs for query generation (only when pattern matching fails)
 *   - Maintains an in-memory LRU-ish cache (Map, max 100 entries)
 *
 * Notes:
 *   - LLM provider/model are intentionally not hard-coded; they must be injected
 *     via options sourced from admin configuration.
 *   - The prompt instructs the LLM to use low temperature (0.1) for deterministic output.
 *   - Fallback queries use simple CONTAINS-based matching with low confidence scores.
 *   - Singleton instance available via getCypherGenerator(); config is hot-updated
 *     if new options are passed after initial creation.
 */

const { logger } = require('../logger');
const llm = require('../llm');
const { getOntologyManager } = require('../ontology');

const log = logger.child({ module: 'cypher-generator' });

class CypherGenerator {
    constructor(options = {}) {
        // Provider and model should come from caller's config - no hardcoded defaults
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        this.ontology = options.ontology || getOntologyManager();
        
        if (!this.llmProvider) {
            log.warn({ event: 'cypher_gen_no_llm' }, 'No LLM provider specified - should be passed from admin config');
        }
        if (!this.llmModel) {
            log.warn({ event: 'cypher_gen_no_model' }, 'No LLM model specified - should be passed from admin config');
        }
        
        // Cache for generated queries
        this.queryCache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 100;
        this.cacheTTL = options.cacheTTL || 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Generate a Cypher query from natural language
     * Uses ontology query patterns first, then falls back to LLM
     * @param {string} question - User's natural language question
     * @param {object} options - Generation options
     * @returns {Promise<{cypher: string, explanation: string, confidence: number}>}
     */
    async generate(question, options = {}) {
        const startTime = Date.now();
        
        // Check cache first
        const cacheKey = this.getCacheKey(question);
        const cached = this.queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            log.debug({ event: 'cypher_gen_cached' }, 'Using cached query');
            return { ...cached.data, cached: true };
        }

        // SOTA v2.0: Try ontology query patterns FIRST
        // This is faster and more reliable than LLM for common queries
        const patternMatch = this.tryQueryPatterns(question);
        if (patternMatch) {
            const latencyMs = Date.now() - startTime;
            log.debug({ event: 'cypher_gen_pattern', patternName: patternMatch.patternName, latencyMs }, 'Pattern match');
            
            // Cache the pattern result
            this.cacheQuery(cacheKey, patternMatch);
            
            return {
                ...patternMatch,
                latencyMs,
                cached: false,
                source: 'ontology_pattern'
            };
        }

        // Build schema context for LLM
        const schemaContext = this.buildSchemaContext();
        
        // Extract entity hints from the question
        const hints = this.ontology.extractEntityHints(question);
        
        // Build the prompt
        const prompt = this.buildPrompt(question, schemaContext, hints);
        
        try {
            const provider = options.provider || this.llmProvider;
            const providerConfig = this.llmConfig?.providers?.[provider] || {};
            
            const result = await llm.generateText({
                provider,
                providerConfig,
                model: options.model || this.llmModel,
                prompt,
                temperature: 0.1, // Low temperature for deterministic queries
                maxTokens: 500
            });

            if (!result.success) {
                log.warn({ event: 'cypher_gen_llm_failed', reason: result.error }, 'LLM generation failed');
                return this.getFallbackQuery(question, hints);
            }

            // Parse the LLM response
            const parsed = this.parseResponse(result.text);
            
            const latencyMs = Date.now() - startTime;
            log.debug({ event: 'cypher_gen_generated', latencyMs, confidence: parsed.confidence }, 'Generated query');

            // Cache the result
            if (parsed.cypher && parsed.confidence >= 0.5) {
                this.cacheQuery(cacheKey, parsed);
            }

            return {
                ...parsed,
                latencyMs,
                cached: false,
                source: 'llm'
            };
        } catch (error) {
            log.warn({ event: 'cypher_gen_error', reason: error.message }, 'Error generating query');
            return this.getFallbackQuery(question, hints);
        }
    }

    /**
     * Try to match query against ontology patterns (SOTA v2.0)
     * @param {string} question - Natural language question
     * @returns {object|null} - Match result or null
     */
    tryQueryPatterns(question) {
        try {
            const match = this.ontology.matchQueryPattern(question);
            if (match && match.cypher) {
                return {
                    cypher: match.cypher,
                    explanation: `Matched ontology pattern: ${match.patternName}`,
                    confidence: 0.95,
                    patternName: match.patternName,
                    patternDescription: match.description
                };
            }
        } catch (e) {
            // Pattern matching failed, continue to LLM
        }
        return null;
    }

    /**
     * Build schema context for the LLM
     * @returns {string}
     */
    buildSchemaContext() {
        const schema = this.ontology.getSchema();
        if (!schema) {
            return this.getDefaultSchema();
        }

        let context = 'GRAPH SCHEMA:\n\n';
        
        // Entity types (nodes)
        context += 'NODE LABELS:\n';
        for (const [name, entity] of Object.entries(schema.entities || {})) {
            const props = entity.properties ? Object.keys(entity.properties).join(', ') : 'name';
            context += `- :${name} (${props})\n`;
        }
        
        // Relationship types
        context += '\nRELATIONSHIP TYPES:\n';
        for (const [name, relation] of Object.entries(schema.relations || {})) {
            const from = relation.from || 'Node';
            const to = relation.to || 'Node';
            context += `- [:${name}] from ${from} to ${to}\n`;
        }
        
        return context;
    }

    /**
     * Get default schema when no ontology is loaded
     */
    getDefaultSchema() {
        return `GRAPH SCHEMA:

NODE LABELS:
- :Person (name, role, organization, email, department)
- :Project (name, description, status, startDate)
- :Meeting (title, date, summary, attendees)
- :Document (title, content, type, createdAt)
- :Technology (name, category, version)
- :Client (name, industry, contact)
- :Task (title, status, priority, assignee)
- :Decision (content, date, owner, status)
- :Risk (content, impact, probability, status)
- :Fact (content, category, source)

RELATIONSHIP TYPES:
- [:WORKS_ON] from Person to Project
- [:WORKS_AT] from Person to Client
- [:ATTENDS] from Person to Meeting
- [:DISCUSSED_IN] from Project to Meeting
- [:OWNS] from Person to Document
- [:ASSIGNED_TO] from Task to Person
- [:USES] from Project to Technology
- [:RELATES_TO] generic relationship
- [:MANAGES] from Person to Person
- [:REPORTS_TO] from Person to Person
- [:MENTIONED_IN] from Person to Document`;
    }

    /**
     * Build the full prompt for Cypher generation
     */
    buildPrompt(question, schemaContext, hints) {
        const entityHints = hints.entityHints?.length > 0 
            ? `\nDETECTED ENTITIES: ${hints.entityHints.join(', ')}` 
            : '';
        const relationHints = hints.relationHints?.length > 0 
            ? `\nDETECTED RELATIONSHIPS: ${hints.relationHints.join(', ')}` 
            : '';

        return `You are a Cypher query expert. Generate a Cypher query to answer the user's question.

${schemaContext}
${entityHints}
${relationHints}

RULES:
1. Use ONLY the node labels and relationship types from the schema above
2. Always use OPTIONAL MATCH when relationships might not exist
3. Use toLower() for case-insensitive string matching
4. Use CONTAINS for partial text matching
5. Always LIMIT results (max 20)
6. Return relevant properties, not just nodes
7. If unsure about the exact query, return a broader search

USER QUESTION: "${question}"

Respond in this EXACT format:
CYPHER: <your cypher query here>
EXPLANATION: <brief explanation of what the query does>
CONFIDENCE: <number 0.0 to 1.0 indicating query confidence>

Example response:
CYPHER: MATCH (p:Person)-[:WORKS_ON]->(proj:Project) WHERE toLower(proj.name) CONTAINS 'web' RETURN p.name, proj.name LIMIT 10
EXPLANATION: Finds all people working on projects with 'web' in the name
CONFIDENCE: 0.9`;
    }

    /**
     * Parse the LLM response to extract Cypher query
     */
    parseResponse(response) {
        const result = {
            cypher: null,
            explanation: '',
            confidence: 0.5
        };

        if (!response) return result;

        // Extract CYPHER
        const cypherMatch = response.match(/CYPHER:\s*(.+?)(?=\n(?:EXPLANATION|CONFIDENCE)|$)/s);
        if (cypherMatch) {
            result.cypher = cypherMatch[1].trim()
                .replace(/^```(?:cypher)?\n?/, '')
                .replace(/\n?```$/, '')
                .trim();
        }

        // Extract EXPLANATION
        const explanationMatch = response.match(/EXPLANATION:\s*(.+?)(?=\n(?:CONFIDENCE)|$)/s);
        if (explanationMatch) {
            result.explanation = explanationMatch[1].trim();
        }

        // Extract CONFIDENCE
        const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/);
        if (confidenceMatch) {
            result.confidence = parseFloat(confidenceMatch[1]);
            if (isNaN(result.confidence)) result.confidence = 0.5;
        }

        return result;
    }

    /**
     * Get a fallback query when LLM generation fails
     */
    getFallbackQuery(question, hints) {
        const q = question.toLowerCase();
        
        // Try to build a simple query based on hints
        if (hints.entityHints?.length > 0) {
            const entity = hints.entityHints[0];
            
            // Person queries
            if (q.includes('who') || q.includes('quem') || q.includes('person')) {
                return {
                    cypher: `MATCH (p:Person) WHERE toLower(p.name) CONTAINS toLower('${entity.replace(/'/g, "\\'")}') OR toLower(p.organization) CONTAINS toLower('${entity.replace(/'/g, "\\'")}') RETURN p LIMIT 15`,
                    explanation: `Search for people related to "${entity}"`,
                    confidence: 0.4,
                    fallback: true
                };
            }
            
            // Project queries
            if (q.includes('project') || q.includes('projeto')) {
                return {
                    cypher: `MATCH (proj:Project) WHERE toLower(proj.name) CONTAINS toLower('${entity.replace(/'/g, "\\'")}') RETURN proj LIMIT 15`,
                    explanation: `Search for projects related to "${entity}"`,
                    confidence: 0.4,
                    fallback: true
                };
            }
            
            // Generic entity search
            return {
                cypher: `MATCH (n) WHERE toLower(n.name) CONTAINS toLower('${entity.replace(/'/g, "\\'")}') OR toLower(n.content) CONTAINS toLower('${entity.replace(/'/g, "\\'")}') RETURN n LIMIT 15`,
                explanation: `General search for "${entity}"`,
                confidence: 0.3,
                fallback: true
            };
        }

        // Relationship queries
        if (q.includes('work') || q.includes('trabalha')) {
            return {
                cypher: 'MATCH (p:Person)-[r:WORKS_ON|WORKS_AT]->(target) RETURN p.name, type(r), target.name LIMIT 15',
                explanation: 'Find all work relationships',
                confidence: 0.3,
                fallback: true
            };
        }

        // Default: return all nodes with names
        return {
            cypher: 'MATCH (n) WHERE n.name IS NOT NULL RETURN n.name, labels(n)[0] as type LIMIT 20',
            explanation: 'List all named entities',
            confidence: 0.2,
            fallback: true
        };
    }

    /**
     * Cache management
     */
    getCacheKey(question) {
        return question.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    cacheQuery(key, data) {
        // Enforce max cache size
        if (this.queryCache.size >= this.cacheMaxSize) {
            const firstKey = this.queryCache.keys().next().value;
            this.queryCache.delete(firstKey);
        }
        
        this.queryCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.queryCache.clear();
    }
}

// Singleton instance
let cypherGeneratorInstance = null;

function getCypherGenerator(options = {}) {
    if (!cypherGeneratorInstance) {
        cypherGeneratorInstance = new CypherGenerator(options);
    } else if (options.llmConfig) {
        // Update config if provided
        cypherGeneratorInstance.llmConfig = options.llmConfig;
        cypherGeneratorInstance.llmProvider = options.llmProvider || cypherGeneratorInstance.llmProvider;
        cypherGeneratorInstance.llmModel = options.llmModel || cypherGeneratorInstance.llmModel;
    }
    return cypherGeneratorInstance;
}

module.exports = {
    CypherGenerator,
    getCypherGenerator
};
