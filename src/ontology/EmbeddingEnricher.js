/**
 * Purpose:
 *   Enriches raw entity data into high-quality text representations suitable
 *   for vector embedding, leveraging ontology metadata (templates, type
 *   prefixes, relationship context) to improve semantic search precision.
 *
 * Responsibilities:
 *   - Generate enriched embedding text for a single entity using ontology templates
 *   - Produce multiple embedding "views" per entity (base, properties, relationships,
 *     question-style) for multi-vector search strategies
 *   - Build relationship context strings from an entity's graph neighbourhood
 *   - Generate question-phrased embeddings (e.g. "Who is X?") to better match
 *     user queries
 *   - Enrich user queries with detected entity/relation type hints
 *   - Produce combined cluster embeddings for groups of related entities
 *   - Batch-enrich arrays of entities in one pass
 *   - Calculate embedding priority scores to order batch operations
 *
 * Key dependencies:
 *   - ./OntologyManager (singleton): entity/relation type definitions, embedding
 *     templates, searchable-property metadata
 *
 * Side effects:
 *   - None -- this module is purely transformational (text in, text out) with
 *     no I/O, network, or database access.
 *
 * Notes:
 *   - maxRelationsPerEntity (default 5) caps the relationship context to keep
 *     embedding text within model token limits.
 *   - generateQuestionStyleEmbedding() has hard-coded entity-type switch cases;
 *     new entity types added to the ontology will fall through silently.
 *   - normalizeText() collapses whitespace and punctuation; ensure templates
 *     do not rely on significant whitespace.
 *   - getEmbeddingConfig() currently returns a static config; it can be extended
 *     to vary model/dimensions per entity type in the future.
 */

const { getOntologyManager } = require('./OntologyManager');

/**
 * Stateless text enrichment layer for vector embeddings.
 *
 * Transforms raw entity/relationship data into rich textual representations
 * informed by the ontology schema (templates, type prefixes, property metadata)
 * to improve downstream semantic search quality.
 *
 * No I/O or side effects -- all methods are pure transformations.
 */
class EmbeddingEnricher {
    /**
     * @param {object} options
     * @param {object} [options.ontology] - OntologyManager instance (defaults to singleton)
     * @param {boolean} [options.includeRelations=true] - Include relationship context in embeddings
     * @param {number} [options.maxRelationsPerEntity=5] - Cap relationship context to control text length
     * @param {number} [options.relationDepth=1] - Graph traversal depth for relationship context
     */
    constructor(options = {}) {
        this.ontology = options.ontology || getOntologyManager();
        this.includeRelations = options.includeRelations !== false;
        this.maxRelationsPerEntity = options.maxRelationsPerEntity || 5;
        this.relationDepth = options.relationDepth || 1;
    }

    /**
     * Enrich a single entity for embedding
     * @param {string} entityType - The ontology entity type
     * @param {object} entity - The entity data
     * @param {object} context - Additional context (relationships, related entities)
     * @returns {string} - Enriched text for embedding
     */
    enrichEntity(entityType, entity, context = {}) {
        // Get base embedding text from ontology
        let text = this.ontology.generateEmbeddingText(entityType, entity);

        // Add relationship context if available
        if (this.includeRelations && context.relationships) {
            const relationText = this.generateRelationContext(entity, context.relationships, context.relatedEntities);
            if (relationText) {
                text += ` ${relationText}`;
            }
        }

        // Add any additional context
        if (context.additionalContext) {
            text += ` ${context.additionalContext}`;
        }

        return this.normalizeText(text);
    }

    /**
     * Generate multiple embedding texts for an entity
     * This creates different "views" of the entity for better search
     * @param {string} entityType 
     * @param {object} entity 
     * @param {object} context 
     * @returns {Array<{type: string, text: string}>}
     */
    generateMultipleEmbeddings(entityType, entity, context = {}) {
        const embeddings = [];

        // 1. Basic entity embedding
        embeddings.push({
            type: 'entity',
            text: this.ontology.generateEmbeddingText(entityType, entity)
        });

        // 2. Property-focused embedding (searchable properties)
        const searchableProps = this.ontology.getSearchableProperties(entityType);
        const propTexts = searchableProps
            .map(prop => {
                const value = entity[prop];
                if (value === undefined || value === null) return null;
                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                return `${prop}: ${displayValue}`;
            })
            .filter(Boolean);
        
        if (propTexts.length > 0) {
            embeddings.push({
                type: 'properties',
                text: `[${entityType}] ${propTexts.join('. ')}`
            });
        }

        // 3. Relationship-focused embedding
        if (this.includeRelations && context.relationships?.length > 0) {
            const relationText = this.generateRelationContext(entity, context.relationships, context.relatedEntities);
            if (relationText) {
                embeddings.push({
                    type: 'relationships',
                    text: `[${entityType}:${entity.name || entity.title || entity.id}] ${relationText}`
                });
            }
        }

        // 4. Question-style embedding (helps match questions)
        const questionEmbedding = this.generateQuestionStyleEmbedding(entityType, entity);
        if (questionEmbedding) {
            embeddings.push({
                type: 'questions',
                text: questionEmbedding
            });
        }

        return embeddings;
    }

    /**
     * Generate relationship context text
     * @param {object} entity 
     * @param {Array} relationships 
     * @param {object} relatedEntities - Map of entity IDs to entities
     * @returns {string}
     */
    generateRelationContext(entity, relationships, relatedEntities = {}) {
        if (!relationships || relationships.length === 0) return '';

        const entityId = entity.id;
        const relevantRelations = relationships
            .filter(r => r.fromId === entityId || r.toId === entityId)
            .slice(0, this.maxRelationsPerEntity);

        if (relevantRelations.length === 0) return '';

        const parts = [];

        for (const rel of relevantRelations) {
            const isOutgoing = rel.fromId === entityId;
            const otherEntityId = isOutgoing ? rel.toId : rel.fromId;
            const otherEntity = relatedEntities[otherEntityId];
            const otherName = otherEntity?.name || otherEntity?.title || otherEntityId;

            // Use ontology to generate relation text
            if (otherEntity) {
                const fromEntity = isOutgoing ? entity : otherEntity;
                const toEntity = isOutgoing ? otherEntity : entity;
                const text = this.ontology.generateRelationEmbeddingText(
                    rel.type,
                    fromEntity,
                    toEntity,
                    rel.properties || {}
                );
                parts.push(text);
            } else {
                // Fallback without full entity data
                const relType = this.ontology.getRelationType(rel.type);
                const label = relType?.label || rel.type;
                parts.push(isOutgoing ? `${label} ${otherName}` : `${otherName} ${label}`);
            }
        }

        return parts.join('. ');
    }

    /**
     * Generate question-style embedding text
     * This helps match user questions to entities
     * @param {string} entityType 
     * @param {object} entity 
     * @returns {string}
     */
    generateQuestionStyleEmbedding(entityType, entity) {
        const questions = [];
        const name = entity.name || entity.title || entity.id;

        switch (entityType) {
            case 'Person':
                questions.push(`Who is ${name}?`);
                if (entity.role) questions.push(`What is ${name}'s role? ${entity.role}`);
                if (entity.skills?.length) questions.push(`What skills does ${name} have? ${entity.skills.join(', ')}`);
                if (entity.organization) questions.push(`Where does ${name} work? ${entity.organization}`);
                break;

            case 'Project':
                questions.push(`What is ${name}?`);
                questions.push(`What is the ${name} project about?`);
                if (entity.status) questions.push(`What is the status of ${name}? ${entity.status}`);
                if (entity.description) questions.push(`Describe ${name}. ${entity.description}`);
                break;

            case 'Meeting':
                questions.push(`What was the ${name} meeting about?`);
                if (entity.summary) questions.push(`What was discussed in ${name}? ${entity.summary}`);
                if (entity.date) questions.push(`When was the ${name} meeting? ${entity.date}`);
                break;

            case 'Technology':
                questions.push(`What is ${name}?`);
                if (entity.category) questions.push(`What type of technology is ${name}? ${entity.category}`);
                if (entity.description) questions.push(`${entity.description}`);
                break;

            case 'Client':
                questions.push(`Who is ${name}?`);
                if (entity.industry) questions.push(`What industry is ${name} in? ${entity.industry}`);
                break;

            case 'Decision':
                questions.push(`What was decided about ${name}?`);
                if (entity.description) questions.push(`${entity.description}`);
                if (entity.rationale) questions.push(`Why was ${name} decided? ${entity.rationale}`);
                break;

            case 'Task':
                questions.push(`What is the task ${name}?`);
                if (entity.status) questions.push(`What is the status of ${name}? ${entity.status}`);
                break;

            case 'Risk':
                questions.push(`What is the risk ${name}?`);
                if (entity.mitigation) questions.push(`How to mitigate ${name}? ${entity.mitigation}`);
                break;

            case 'Fact':
                questions.push(`What do we know about this?`);
                if (entity.content) questions.push(entity.content);
                break;

            case 'Company':
                questions.push(`What is ${name}?`);
                questions.push(`What does ${name} do?`);
                if (entity.industry) questions.push(`What industry is ${name} in? ${entity.industry}`);
                if (entity.description) questions.push(`${entity.description}`);
                if (entity.website_url) questions.push(`What is ${name}'s website? ${entity.website_url}`);
                break;

            case 'Organization':
                questions.push(`What is ${name}?`);
                if (entity.type) questions.push(`What type of organization is ${name}? ${entity.type}`);
                if (entity.industry) questions.push(`What industry is ${name} in? ${entity.industry}`);
                if (entity.description) questions.push(`${entity.description}`);
                break;

            case 'Contact':
                questions.push(`Who is ${name}?`);
                if (entity.role) questions.push(`What is ${name}'s role? ${entity.role}`);
                if (entity.company) questions.push(`Where does ${name} work? ${entity.company}`);
                if (entity.email) questions.push(`What is ${name}'s email? ${entity.email}`);
                break;

            case 'Team':
                questions.push(`What is the ${name} team?`);
                if (entity.department) questions.push(`Which department is ${name} in? ${entity.department}`);
                if (entity.description) questions.push(`${entity.description}`);
                break;

            case 'Sprint':
                questions.push(`What is sprint ${name}?`);
                if (entity.goal) questions.push(`What is the goal of sprint ${name}? ${entity.goal}`);
                if (entity.status) questions.push(`What is the status of sprint ${name}? ${entity.status}`);
                break;

            case 'UserStory':
                questions.push(`What is the user story ${name}?`);
                if (entity.description) questions.push(`${entity.description}`);
                if (entity.status) questions.push(`What is the status of ${name}? ${entity.status}`);
                break;

            default:
                if (name) questions.push(`What is ${name}?`);
                if (entity.description) questions.push(entity.description);
                break;
        }

        return questions.join(' ');
    }

    /**
     * Enrich query text for better semantic matching
     * @param {string} query - User's query
     * @param {object} queryAnalysis - Analysis from ontology (detected types, relations)
     * @returns {string}
     */
    enrichQuery(query, queryAnalysis = {}) {
        let enrichedQuery = query;

        // Add entity type hints
        if (queryAnalysis.entityHints?.length > 0) {
            const typeHints = queryAnalysis.entityHints
                .map(h => `[${h.type}]`)
                .join(' ');
            enrichedQuery = `${typeHints} ${enrichedQuery}`;
        }

        // Add relation hints
        if (queryAnalysis.relationHints?.length > 0) {
            const relationHints = queryAnalysis.relationHints
                .map(h => {
                    const relType = this.ontology.getRelationType(h.relation);
                    return relType?.label || h.relation;
                })
                .join(', ');
            enrichedQuery += ` (relations: ${relationHints})`;
        }

        return this.normalizeText(enrichedQuery);
    }

    /**
     * Generate embedding text for a relationship
     * @param {string} relationType 
     * @param {object} fromEntity 
     * @param {object} toEntity 
     * @param {object} properties 
     * @returns {string}
     */
    enrichRelationship(relationType, fromEntity, toEntity, properties = {}) {
        // Get base text from ontology
        let text = this.ontology.generateRelationEmbeddingText(relationType, fromEntity, toEntity, properties);

        // Add context about the entities
        const fromName = fromEntity.name || fromEntity.title || fromEntity.id;
        const toName = toEntity.name || toEntity.title || toEntity.id;
        const fromType = fromEntity._type || 'Entity';
        const toType = toEntity._type || 'Entity';

        // Add reverse phrasing for better bidirectional matching
        const relType = this.ontology.getRelationType(relationType);
        if (relType) {
            text += `. [${fromType}:${fromName}] [${relationType}] [${toType}:${toName}]`;
        }

        return this.normalizeText(text);
    }

    /**
     * Create a combined embedding for a cluster of related entities
     * Useful for understanding a topic/concept across multiple entities
     * @param {Array<{type: string, entity: object}>} entities 
     * @param {Array} relationships 
     * @returns {string}
     */
    enrichCluster(entities, relationships = []) {
        const parts = [];

        // Add entity summaries
        const entityTypes = {};
        for (const { type, entity } of entities) {
            if (!entityTypes[type]) entityTypes[type] = [];
            entityTypes[type].push(entity.name || entity.title || entity.id);
        }

        for (const [type, names] of Object.entries(entityTypes)) {
            parts.push(`${type}s: ${names.join(', ')}`);
        }

        // Add relationship summary
        if (relationships.length > 0) {
            const relationCounts = {};
            for (const rel of relationships) {
                relationCounts[rel.type] = (relationCounts[rel.type] || 0) + 1;
            }
            const relationSummary = Object.entries(relationCounts)
                .map(([type, count]) => `${count} ${type}`)
                .join(', ');
            parts.push(`Relationships: ${relationSummary}`);
        }

        // Add combined searchable content
        for (const { type, entity } of entities) {
            const searchable = this.ontology.getSearchableProperties(type);
            for (const prop of searchable) {
                const value = entity[prop];
                if (value) {
                    const displayValue = Array.isArray(value) ? value.join(' ') : String(value);
                    parts.push(displayValue);
                }
            }
        }

        return this.normalizeText(parts.join('. '));
    }

    /**
     * Batch enrich multiple entities
     * @param {Array<{type: string, entity: object, context?: object}>} items 
     * @returns {Array<{entity: object, embeddings: Array}>}
     */
    batchEnrich(items) {
        return items.map(item => ({
            entity: item.entity,
            type: item.type,
            embeddings: this.generateMultipleEmbeddings(item.type, item.entity, item.context || {})
        }));
    }

    /**
     * Normalize text for embedding
     * @param {string} text 
     * @returns {string}
     */
    normalizeText(text) {
        return text
            .replace(/\s+/g, ' ')           // Collapse whitespace
            .replace(/\s*\.\s*/g, '. ')     // Normalize periods
            .replace(/\s*,\s*/g, ', ')      // Normalize commas
            .replace(/\[\s+/g, '[')         // Clean bracket spacing
            .replace(/\s+\]/g, ']')
            .replace(/\.+/g, '.')           // Remove multiple periods
            .trim();
    }

    /**
     * Calculate embedding priority for an entity. Higher scores cause the
     * entity to be embedded earlier in batch operations, ensuring the most
     * important nodes are searchable first.
     *
     * Scoring factors:
     *   - Base type priority (Person=8, Project=9, Client=7, etc.)
     *   - Connection count boost (0.5 per connection, max +5)
     *   - Property completeness boost (up to +3)
     *   - Recency boost (+2 if < 7 days old, +1 if < 30 days)
     *
     * @param {string} entityType
     * @param {object} entity
     * @param {object} [stats] - { connectionCount }
     * @returns {number} - Unbounded positive score (typically 3-20)
     */
    calculateEmbeddingPriority(entityType, entity, stats = {}) {
        let priority = 0;

        // Base priority by type
        const typePriorities = {
            'Person': 8,
            'Project': 9,
            'Client': 7,
            'Meeting': 5,
            'Decision': 6,
            'Task': 4,
            'Risk': 5,
            'Technology': 6,
            'Document': 5,
            'Fact': 3
        };
        priority += typePriorities[entityType] || 5;

        // Boost for more connections
        priority += Math.min(5, (stats.connectionCount || 0) * 0.5);

        // Boost for completeness (more properties filled)
        const props = this.ontology.getEntityProperties(entityType);
        const filledProps = Object.keys(props).filter(p => entity[p] !== undefined && entity[p] !== null);
        const completeness = filledProps.length / Object.keys(props).length;
        priority += completeness * 3;

        // Boost for recent entities
        if (entity.created_at) {
            const age = Date.now() - new Date(entity.created_at).getTime();
            const daysSinceCreation = age / (1000 * 60 * 60 * 24);
            if (daysSinceCreation < 7) priority += 2;
            else if (daysSinceCreation < 30) priority += 1;
        }

        return priority;
    }

    /**
     * Get embedding configuration based on entity type.
     *
     * Resolves the active embedding model and its output dimensions from
     * the application config (LLM routing layer). Falls back to the DB
     * default (snowflake-arctic-embed @ 1024d) when no config is available.
     *
     * @param {string} entityType
     * @param {object} [appConfig] - Application config (llm + ollama). When
     *   provided the method resolves the active embedding model via the LLM
     *   config layer; otherwise falls back to the DB default.
     * @returns {{model: string, dimensions: number}}
     */
    getEmbeddingConfig(entityType, appConfig) {
        const KNOWN_DIMENSIONS = {
            'snowflake-arctic-embed':   1024,
            'snowflake-arctic-embed:l': 1024,
            'snowflake-arctic-embed:m': 768,
            'snowflake-arctic-embed:s': 384,
            'mxbai-embed-large':        1024,
            'nomic-embed-text':         768,
            'all-minilm':               384,
            'text-embedding-3-small':   1536,
            'text-embedding-3-large':   3072,
            'text-embedding-ada-002':   1536,
            'embedding-001':            768,
            'models/embedding-001':     768,
        };

        const DB_VECTOR_DIMENSIONS = 1024;

        if (appConfig) {
            try {
                const { getEmbeddingsConfig } = require('../llm/config');
                const embCfg = getEmbeddingsConfig(appConfig);

                if (embCfg?.model) {
                    const model = embCfg.model;
                    const dimensions = KNOWN_DIMENSIONS[model] || DB_VECTOR_DIMENSIONS;
                    return { model, dimensions };
                }
            } catch (_) {
                // Config resolution failed -- fall through to default
            }
        }

        return {
            model: 'snowflake-arctic-embed',
            dimensions: DB_VECTOR_DIMENSIONS
        };
    }
}

// Singleton instance
let instance = null;

/**
 * Get the EmbeddingEnricher singleton instance
 * @param {object} options 
 * @returns {EmbeddingEnricher}
 */
function getEmbeddingEnricher(options = {}) {
    if (!instance) {
        instance = new EmbeddingEnricher(options);
    }
    return instance;
}

module.exports = {
    EmbeddingEnricher,
    getEmbeddingEnricher
};
