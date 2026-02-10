/**
 * OntologyExtractor - Extract and manage ontology from graph database
 * 
 * Inspired by FalkorDB's GraphRAG-SDK Ontology class
 * Provides functionality to:
 * - Extract ontology from existing graph data
 * - Validate compliance rigorously
 * - Merge ontologies
 * - Discard orphan types
 * 
 * SOTA v2.1 - Advanced Ontology Management
 * SOTA v3.0 - Native Supabase graph support (no Cypher dependency)
 */

const { logger } = require('../logger');
const { getOntologyManager } = require('./OntologyManager');

const log = logger.child({ module: 'ontology-extractor' });

// Attribute type mapping (similar to GraphRAG-SDK)
const ATTRIBUTE_TYPES = {
    'STRING': 'string',
    'INTEGER': 'number',
    'FLOAT': 'number',
    'BOOLEAN': 'boolean',
    'LIST': 'array',
    'MAP': 'object',
    'POINT': 'geo',
    'DATE': 'date',
    'DATETIME': 'datetime',
    'DURATION': 'duration',
    'NULL': 'null'
};

class OntologyExtractor {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider || null;
        this.ontologyManager = options.ontologyManager || getOntologyManager();
        this.sampleSize = options.sampleSize || 100; // Max samples per type
    }

    /**
     * Set the graph provider
     * @param {object} graphProvider 
     */
    setGraphProvider(graphProvider) {
        this.graphProvider = graphProvider;
    }

    /**
     * Check if provider is Supabase (SOTA v3.0)
     * @returns {boolean}
     */
    _isSupabaseProvider() {
        return this.graphProvider?.constructor?.name === 'SupabaseGraphProvider' ||
               typeof this.graphProvider?.supabase !== 'undefined' ||
               typeof this.graphProvider?.getStats === 'function';
    }

    /**
     * Extract ontology from existing knowledge graph
     * SOTA v3.0 - Uses native methods for Supabase
     * Similar to GraphRAG-SDK's Ontology.from_kg_graph()
     * 
     * @param {object} options - Extraction options
     * @returns {Promise<{ok: boolean, ontology?: object, stats?: object, error?: string}>}
     */
    async extractFromGraph(options = {}) {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph provider not connected' };
        }

        const sampleSize = options.sampleSize || this.sampleSize;
        const includeMetaNodes = options.includeMetaNodes || false;

        const extractedOntology = {
            version: '1.0-extracted',
            extractedAt: new Date().toISOString(),
            entityTypes: {},
            relationTypes: {},
            queryPatterns: {},
            inferenceRules: []
        };

        const stats = {
            entityTypesFound: 0,
            relationTypesFound: 0,
            totalNodes: 0,
            totalRelationships: 0,
            attributesExtracted: 0
        };

        try {
            let labels = [];
            let relTypes = [];

            // Use native getStats() for Supabase provider
            if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
                const graphStats = await this.graphProvider.getStats();
                const labelStats = graphStats?.stats?.labels || {};
                const relStats = graphStats?.stats?.relationshipTypes || {};
                
                labels = Object.keys(labelStats).filter(l => includeMetaNodes || !l.startsWith('__'));
                relTypes = Object.keys(relStats).filter(r => r !== 'CAN_RELATE');
                
                // Process entity types
                for (const label of labels) {
                    const nodeCount = labelStats[label] || 0;
                    stats.totalNodes += nodeCount;
                    
                    // Sample nodes to extract properties
                    const sampleResult = await this.graphProvider.findNodes(label, {}, { limit: sampleSize });
                    const properties = {};
                    
                    for (const node of sampleResult.nodes || []) {
                        const nodeProps = node.properties || node;
                        for (const attrName of Object.keys(nodeProps)) {
                            if (!attrName.startsWith('_') && !properties[attrName]) {
                                properties[attrName] = {
                                    type: 'string',
                                    required: false,
                                    searchable: ['name', 'title', 'content', 'description'].includes(attrName)
                                };
                                stats.attributesExtracted++;
                            }
                        }
                    }

                    extractedOntology.entityTypes[label] = {
                        label: label,
                        description: `Auto-extracted entity type from graph (${nodeCount} nodes)`,
                        properties: properties,
                        nodeCount: nodeCount,
                        extractedFrom: 'graph'
                    };
                    stats.entityTypesFound++;
                }

                // Process relation types
                for (const relType of relTypes) {
                    const edgeCount = relStats[relType] || 0;
                    stats.totalRelationships += edgeCount;
                    
                    // Get sample relationships to find source/target types
                    const relResult = await this.graphProvider.findRelationships({ type: relType, limit: sampleSize });
                    const fromTypes = new Set();
                    const toTypes = new Set();

                    for (const rel of relResult.relationships || []) {
                        // Get source and target node labels
                        if (rel.fromLabel) fromTypes.add(rel.fromLabel);
                        if (rel.toLabel) toTypes.add(rel.toLabel);
                    }

                    if (fromTypes.size > 0 || toTypes.size > 0) {
                        extractedOntology.relationTypes[relType] = {
                            label: relType,
                            description: `Auto-extracted relation from graph (${edgeCount} edges)`,
                            fromTypes: fromTypes.size > 0 ? Array.from(fromTypes) : ['*'],
                            toTypes: toTypes.size > 0 ? Array.from(toTypes) : ['*'],
                            properties: {},
                            edgeCount: edgeCount,
                            extractedFrom: 'graph'
                        };
                        stats.relationTypesFound++;
                    }
                }
            } else {
                // Cypher fallback for other providers
                const labelsResult = await this.graphProvider.query(`CALL db.labels()`);
                labels = (labelsResult.results || [])
                    .map(r => r[0] || r.label)
                    .filter(l => includeMetaNodes || !l.startsWith('__'));

                // Extract attributes for each label
                for (const label of labels) {
                    const attributesQuery = `
                        MATCH (a:${label})
                        WITH a LIMIT ${sampleSize}
                        WITH [k IN keys(a) | [k, toStringOrNull(a[k])]] AS types
                        UNWIND types AS kt
                        RETURN kt[0] AS attrName, count(*) AS count
                        ORDER BY count DESC
                    `;

                    try {
                        const attrResult = await this.graphProvider.query(attributesQuery);
                        const properties = {};
                        
                        for (const row of attrResult.results || []) {
                            const attrName = row.attrName || row[0];
                            if (attrName && !attrName.startsWith('_')) {
                                properties[attrName] = {
                                    type: 'string',
                                    required: false,
                                    searchable: ['name', 'title', 'content', 'description'].includes(attrName)
                                };
                                stats.attributesExtracted++;
                            }
                        }

                        const countResult = await this.graphProvider.query(`MATCH (n:${label}) RETURN count(n) as count`);
                        const nodeCount = countResult.results?.[0]?.count || 0;
                        stats.totalNodes += nodeCount;

                        extractedOntology.entityTypes[label] = {
                            label: label,
                            description: `Auto-extracted entity type from graph (${nodeCount} nodes)`,
                            properties: properties,
                            nodeCount: nodeCount,
                            extractedFrom: 'graph'
                        };
                        stats.entityTypesFound++;
                    } catch (e) {
                        log.warn({ event: 'ontology_extractor_attributes_failed', label, reason: e.message }, 'Failed to extract attributes');
                    }
                }

                // Get relationship types
                const relTypesResult = await this.graphProvider.query(`CALL db.relationshipTypes()`);
                relTypes = (relTypesResult.results || [])
                    .map(r => r[0] || r.relationshipType)
                    .filter(r => r !== 'CAN_RELATE');

                for (const relType of relTypes) {
                    try {
                        const relQuery = `
                            MATCH (s)-[r:${relType}]->(t)
                            WITH labels(s)[0] AS sourceLabel, labels(t)[0] AS targetLabel, count(r) AS count
                            RETURN sourceLabel, targetLabel, count
                            ORDER BY count DESC
                            LIMIT ${sampleSize}
                        `;
                        
                        const relResult = await this.graphProvider.query(relQuery);
                        
                        const fromTypes = new Set();
                        const toTypes = new Set();
                        let totalCount = 0;

                        for (const row of relResult.results || []) {
                            const sourceLabel = row.sourceLabel || row[0];
                            const targetLabel = row.targetLabel || row[1];
                            const count = row.count || row[2] || 0;
                            
                            if (sourceLabel && !sourceLabel.startsWith('__')) {
                                fromTypes.add(sourceLabel);
                            }
                            if (targetLabel && !targetLabel.startsWith('__')) {
                                toTypes.add(targetLabel);
                            }
                            totalCount += count;
                        }

                        stats.totalRelationships += totalCount;

                        if (fromTypes.size > 0 && toTypes.size > 0) {
                            extractedOntology.relationTypes[relType] = {
                                label: relType,
                                description: `Auto-extracted relation from graph (${totalCount} edges)`,
                                fromTypes: Array.from(fromTypes),
                                toTypes: Array.from(toTypes),
                                properties: {},
                                edgeCount: totalCount,
                                extractedFrom: 'graph'
                            };
                            stats.relationTypesFound++;
                        }
                    } catch (e) {
                        log.warn({ event: 'ontology_extractor_relation_failed', relType, reason: e.message }, 'Failed to extract relation');
                    }
                }
            }

            log.info({ event: 'ontology_extractor_done', entityTypes: stats.entityTypesFound, relationTypes: stats.relationTypesFound }, 'Extracted');

            return {
                ok: true,
                ontology: extractedOntology,
                stats
            };

        } catch (error) {
            log.error({ event: 'ontology_extractor_failed', reason: error.message }, 'Extraction failed');
            return { ok: false, error: error.message };
        }
    }

    /**
     * Rigorous validation of graph data against ontology
     * SOTA v3.0 - Uses native methods for Supabase
     * Similar to GraphRAG-SDK's validate_entities()
     * 
     * @param {object} options - Validation options
     * @returns {Promise<{valid: boolean, score: number, issues: Array, stats: object}>}
     */
    async validateCompliance(options = {}) {
        if (!this.graphProvider?.connected) {
            return { valid: false, score: 0, issues: [{ type: 'error', message: 'Not connected' }], stats: {} };
        }

        const schema = this.ontologyManager.getSchema();
        if (!schema) {
            return { valid: false, score: 0, issues: [{ type: 'error', message: 'No ontology loaded' }], stats: {} };
        }

        const issues = [];
        const stats = {
            totalNodes: 0,
            validNodes: 0,
            invalidNodes: 0,
            unknownTypeNodes: 0,
            totalRelationships: 0,
            validRelationships: 0,
            invalidRelationships: 0,
            unknownTypeRelationships: 0,
            missingRequiredProperties: 0,
            invalidPropertyTypes: 0
        };

        // Use native methods for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const graphStats = await this.graphProvider.getStats();
            const labelStats = graphStats?.stats?.labels || {};
            const relStats = graphStats?.stats?.relationshipTypes || {};

            // 1. Validate node labels against ontology
            for (const [label, count] of Object.entries(labelStats)) {
                if (label.startsWith('__')) continue;
                
                stats.totalNodes += count;

                if (!schema.entityTypes[label]) {
                    issues.push({
                        type: 'unknown_entity_type',
                        severity: 'error',
                        label: label,
                        count: count,
                        message: `Entity type "${label}" not defined in ontology (${count} nodes)`,
                        suggestion: `Add "${label}" to ontology or migrate nodes to existing type`
                    });
                    stats.unknownTypeNodes += count;
                } else {
                    stats.validNodes += count;
                }
            }

            // 2. Validate relationship types
            for (const [relType, count] of Object.entries(relStats)) {
                if (relType === 'CAN_RELATE') continue;
                
                stats.totalRelationships += count;

                if (!schema.relationTypes[relType]) {
                    issues.push({
                        type: 'unknown_relation_type',
                        severity: 'error',
                        relationType: relType,
                        count: count,
                        message: `Relation type "${relType}" not defined in ontology (${count} edges)`,
                        suggestion: `Add "${relType}" to ontology or migrate relationships`
                    });
                    stats.unknownTypeRelationships += count;
                } else {
                    stats.validRelationships += count;
                }
            }
        } else {
            // Cypher fallback for other providers
            const labelsQuery = `
                MATCH (n)
                WHERE NOT labels(n)[0] STARTS WITH '__'
                RETURN labels(n)[0] AS label, count(n) AS count, 
                       collect(DISTINCT keys(n)) AS sampleKeys
            `;
            
            const labelsResult = await this.graphProvider.query(labelsQuery);
            
            for (const row of labelsResult.results || []) {
                const label = row.label;
                const count = row.count || 0;
                stats.totalNodes += count;

                if (!schema.entityTypes[label]) {
                    issues.push({
                        type: 'unknown_entity_type',
                        severity: 'error',
                        label: label,
                        count: count,
                        message: `Entity type "${label}" not defined in ontology (${count} nodes)`,
                        suggestion: `Add "${label}" to ontology or migrate nodes to existing type`
                    });
                    stats.unknownTypeNodes += count;
                } else {
                    stats.validNodes += count;

                    // Check for required properties
                    const entityDef = schema.entityTypes[label];
                    const requiredProps = Object.entries(entityDef.properties || {})
                        .filter(([_, def]) => def.required)
                        .map(([name]) => name);

                    if (requiredProps.length > 0) {
                        const missingCheck = await this.graphProvider.query(`
                            MATCH (n:${label})
                            WHERE ${requiredProps.map(p => `n.${p} IS NULL`).join(' OR ')}
                            RETURN count(n) AS missingCount
                        `);
                        
                        const missingCount = missingCheck.results?.[0]?.missingCount || 0;
                        if (missingCount > 0) {
                            issues.push({
                                type: 'missing_required_property',
                                severity: 'warning',
                                label: label,
                                count: missingCount,
                                properties: requiredProps,
                                message: `${missingCount} "${label}" nodes missing required properties: ${requiredProps.join(', ')}`
                            });
                            stats.missingRequiredProperties += missingCount;
                        }
                    }
                }
            }

            // 2. Validate relationship types
            const relsQuery = `
                MATCH (s)-[r]->(t)
                WHERE NOT type(r) = 'CAN_RELATE'
                RETURN type(r) AS relType, labels(s)[0] AS sourceLabel, labels(t)[0] AS targetLabel, count(r) AS count
            `;
            
            const relsResult = await this.graphProvider.query(relsQuery);
            
            for (const row of relsResult.results || []) {
                const relType = row.relType;
                const sourceLabel = row.sourceLabel;
                const targetLabel = row.targetLabel;
                const count = row.count || 0;
                stats.totalRelationships += count;

                if (!schema.relationTypes[relType]) {
                    issues.push({
                        type: 'unknown_relation_type',
                        severity: 'error',
                        relationType: relType,
                        count: count,
                        message: `Relation type "${relType}" not defined in ontology (${count} edges)`,
                        suggestion: `Add "${relType}" to ontology or migrate relationships`
                    });
                    stats.unknownTypeRelationships += count;
                } else {
                    const relDef = schema.relationTypes[relType];
                    const fromValid = relDef.fromTypes.includes('*') || relDef.fromTypes.includes(sourceLabel);
                    const toValid = relDef.toTypes.includes('*') || relDef.toTypes.includes(targetLabel);

                    if (!fromValid || !toValid) {
                        issues.push({
                            type: 'invalid_relation_endpoints',
                            severity: 'warning',
                            relationType: relType,
                            sourceLabel,
                            targetLabel,
                            count: count,
                            message: `Relation "${relType}" from "${sourceLabel}" to "${targetLabel}" not allowed by ontology (${count} edges)`,
                            expected: {
                                fromTypes: relDef.fromTypes,
                                toTypes: relDef.toTypes
                            }
                        });
                        stats.invalidRelationships += count;
                    } else {
                        stats.validRelationships += count;
                    }
                }
            }

            // 3. Check for nodes with _ontology_valid = false
            const invalidNodesCheck = await this.graphProvider.query(`
                MATCH (n)
                WHERE n._ontology_valid = false
                RETURN labels(n)[0] AS label, count(n) AS count
            `);
            
            for (const row of invalidNodesCheck.results || []) {
                issues.push({
                    type: 'marked_invalid',
                    severity: 'info',
                    label: row.label,
                    count: row.count,
                    message: `${row.count} "${row.label}" nodes marked as _ontology_valid=false`
                });
            }
        }

        // 4. Check for entities without unique identifiers (both providers)
        for (const [typeName, typeDef] of Object.entries(schema.entityTypes || {})) {
            const uniqueProps = Object.entries(typeDef.properties || {})
                .filter(([_, def]) => def.unique || def.required)
                .map(([name]) => name);
            
            if (uniqueProps.length === 0) {
                issues.push({
                    type: 'no_unique_attribute',
                    severity: 'warning',
                    label: typeName,
                    message: `Entity type "${typeName}" has no unique or required attributes - may cause deduplication issues`
                });
            }
        }

        // Calculate compliance score
        const totalItems = stats.totalNodes + stats.totalRelationships;
        const validItems = stats.validNodes + stats.validRelationships;
        const score = totalItems > 0 ? Math.round((validItems / totalItems) * 100) : 100;

        return {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            score,
            issues,
            stats
        };
    }

    /**
     * Merge extracted ontology with existing ontology
     * Similar to GraphRAG-SDK's merge_with()
     * 
     * @param {object} newOntology - Ontology to merge
     * @param {object} options - Merge options
     * @returns {{merged: object, changes: Array}}
     */
    mergeOntologies(newOntology, options = {}) {
        const currentSchema = this.ontologyManager.getSchema();
        const changes = [];
        
        const merged = {
            version: currentSchema?.version || '1.0',
            entityTypes: { ...(currentSchema?.entityTypes || {}) },
            relationTypes: { ...(currentSchema?.relationTypes || {}) },
            queryPatterns: { ...(currentSchema?.queryPatterns || {}) },
            inferenceRules: [...(currentSchema?.inferenceRules || [])]
        };

        // Merge entity types
        for (const [name, def] of Object.entries(newOntology.entityTypes || {})) {
            if (!merged.entityTypes[name]) {
                // New entity type
                merged.entityTypes[name] = {
                    ...def,
                    addedFrom: 'merge'
                };
                changes.push({
                    type: 'entity_added',
                    name,
                    source: def.extractedFrom || 'merge'
                });
            } else if (options.mergeProperties) {
                // Merge properties
                const existingProps = merged.entityTypes[name].properties || {};
                const newProps = def.properties || {};
                
                for (const [propName, propDef] of Object.entries(newProps)) {
                    if (!existingProps[propName]) {
                        existingProps[propName] = propDef;
                        changes.push({
                            type: 'property_added',
                            entityType: name,
                            property: propName
                        });
                    }
                }
                merged.entityTypes[name].properties = existingProps;
            }
        }

        // Merge relation types
        for (const [name, def] of Object.entries(newOntology.relationTypes || {})) {
            if (!merged.relationTypes[name]) {
                // New relation type
                merged.relationTypes[name] = {
                    ...def,
                    addedFrom: 'merge'
                };
                changes.push({
                    type: 'relation_added',
                    name,
                    source: def.extractedFrom || 'merge'
                });
            } else if (options.mergeEndpoints) {
                // Merge fromTypes and toTypes
                const existing = merged.relationTypes[name];
                const newFromTypes = new Set([...existing.fromTypes, ...def.fromTypes]);
                const newToTypes = new Set([...existing.toTypes, ...def.toTypes]);
                
                if (newFromTypes.size > existing.fromTypes.length || newToTypes.size > existing.toTypes.length) {
                    merged.relationTypes[name].fromTypes = Array.from(newFromTypes);
                    merged.relationTypes[name].toTypes = Array.from(newToTypes);
                    changes.push({
                        type: 'relation_endpoints_extended',
                        name,
                        fromTypes: Array.from(newFromTypes),
                        toTypes: Array.from(newToTypes)
                    });
                }
            }
        }

        log.debug({ event: 'ontology_extractor_merged', changes: changes.length }, 'Merged');

        return { merged, changes };
    }

    /**
     * Discard entity types that have no relationships
     * Similar to GraphRAG-SDK's discard_entities_without_relations()
     * 
     * @param {object} ontology - Ontology to clean
     * @returns {{cleaned: object, discarded: Array}}
     */
    discardEntitiesWithoutRelations(ontology) {
        const discarded = [];
        const cleaned = { ...ontology };
        
        const relatedEntities = new Set();
        
        // Collect all entities that appear in relations
        for (const [_, relDef] of Object.entries(ontology.relationTypes || {})) {
            for (const fromType of relDef.fromTypes || []) {
                if (fromType !== '*') relatedEntities.add(fromType);
            }
            for (const toType of relDef.toTypes || []) {
                if (toType !== '*') relatedEntities.add(toType);
            }
        }

        // Remove entities not in any relation
        for (const entityName of Object.keys(ontology.entityTypes || {})) {
            if (!relatedEntities.has(entityName)) {
                discarded.push({
                    type: 'entity',
                    name: entityName,
                    reason: 'No relations defined'
                });
                delete cleaned.entityTypes[entityName];
            }
        }

        log.debug({ event: 'ontology_extractor_discarded_entities', discarded: discarded.length }, 'Discarded entities without relations');

        return { cleaned, discarded };
    }

    /**
     * Discard relation types that reference non-existent entities
     * Similar to GraphRAG-SDK's discard_relations_without_entities()
     * 
     * @param {object} ontology - Ontology to clean
     * @returns {{cleaned: object, discarded: Array}}
     */
    discardRelationsWithoutEntities(ontology) {
        const discarded = [];
        const cleaned = { ...ontology };
        const entityNames = new Set(Object.keys(ontology.entityTypes || {}));

        for (const [relName, relDef] of Object.entries(ontology.relationTypes || {})) {
            const fromTypesValid = relDef.fromTypes.some(t => t === '*' || entityNames.has(t));
            const toTypesValid = relDef.toTypes.some(t => t === '*' || entityNames.has(t));

            if (!fromTypesValid || !toTypesValid) {
                discarded.push({
                    type: 'relation',
                    name: relName,
                    reason: 'References non-existent entity types',
                    fromTypes: relDef.fromTypes,
                    toTypes: relDef.toTypes
                });
                delete cleaned.relationTypes[relName];
            }
        }

        log.debug({ event: 'ontology_extractor_discarded_relations', discarded: discarded.length }, 'Discarded relations without valid entities');

        return { cleaned, discarded };
    }

    /**
     * Find unused types in ontology (defined but not in graph)
     * SOTA v3.0 - Uses native methods for Supabase
     * @returns {Promise<{entities: string[], relations: string[]}>}
     */
    async findUnusedTypes() {
        if (!this.graphProvider?.connected) {
            return { entities: [], relations: [] };
        }

        const schema = this.ontologyManager.getSchema();
        const unused = { entities: [], relations: [] };

        let usedLabels = new Set();
        let usedRels = new Set();

        // Use native getStats() for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const graphStats = await this.graphProvider.getStats();
            const labelStats = graphStats?.stats?.labels || {};
            const relStats = graphStats?.stats?.relationshipTypes || {};
            
            usedLabels = new Set(Object.keys(labelStats).filter(l => !l.startsWith('__')));
            usedRels = new Set(Object.keys(relStats));
        } else {
            // Cypher fallback for other providers
            const labelsResult = await this.graphProvider.query(`
                MATCH (n)
                WHERE NOT labels(n)[0] STARTS WITH '__'
                RETURN DISTINCT labels(n)[0] AS label
            `);
            usedLabels = new Set((labelsResult.results || []).map(r => r.label));

            const relsResult = await this.graphProvider.query(`
                MATCH ()-[r]->()
                RETURN DISTINCT type(r) AS relType
            `);
            usedRels = new Set((relsResult.results || []).map(r => r.relType));
        }

        // Find unused entity types
        for (const entityName of Object.keys(schema?.entityTypes || {})) {
            if (!usedLabels.has(entityName)) {
                unused.entities.push(entityName);
            }
        }

        // Find unused relation types
        for (const relName of Object.keys(schema?.relationTypes || {})) {
            if (!usedRels.has(relName)) {
                unused.relations.push(relName);
            }
        }

        return unused;
    }

    /**
     * Generate a diff between two ontologies
     * @param {object} ontologyA 
     * @param {object} ontologyB 
     * @returns {object}
     */
    diffOntologies(ontologyA, ontologyB) {
        const diff = {
            entitiesOnlyInA: [],
            entitiesOnlyInB: [],
            entitiesInBoth: [],
            relationsOnlyInA: [],
            relationsOnlyInB: [],
            relationsInBoth: [],
            propertyDifferences: []
        };

        const entitiesA = new Set(Object.keys(ontologyA?.entityTypes || {}));
        const entitiesB = new Set(Object.keys(ontologyB?.entityTypes || {}));
        const relationsA = new Set(Object.keys(ontologyA?.relationTypes || {}));
        const relationsB = new Set(Object.keys(ontologyB?.relationTypes || {}));

        for (const e of entitiesA) {
            if (entitiesB.has(e)) {
                diff.entitiesInBoth.push(e);
            } else {
                diff.entitiesOnlyInA.push(e);
            }
        }
        for (const e of entitiesB) {
            if (!entitiesA.has(e)) {
                diff.entitiesOnlyInB.push(e);
            }
        }

        for (const r of relationsA) {
            if (relationsB.has(r)) {
                diff.relationsInBoth.push(r);
            } else {
                diff.relationsOnlyInA.push(r);
            }
        }
        for (const r of relationsB) {
            if (!relationsA.has(r)) {
                diff.relationsOnlyInB.push(r);
            }
        }

        return diff;
    }
}

// Singleton
let extractorInstance = null;

function getOntologyExtractor(options = {}) {
    if (!extractorInstance) {
        extractorInstance = new OntologyExtractor(options);
    }
    if (options.graphProvider) {
        extractorInstance.setGraphProvider(options.graphProvider);
    }
    return extractorInstance;
}

module.exports = {
    OntologyExtractor,
    getOntologyExtractor
};
