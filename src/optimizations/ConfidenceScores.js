/**
 * Purpose:
 *   Attach, update, and query numerical confidence scores on graph nodes
 *   and relationships to reflect extraction reliability.
 *
 * Responsibilities:
 *   - Calculate a composite confidence score from source type, AI confidence,
 *     occurrence count, context availability, and partial-match penalties
 *   - Persist confidence metadata (score, source, timestamp) on graph nodes
 *     and relationships via Cypher SET operations
 *   - Retrieve low-confidence items for human review
 *   - Incrementally boost confidence when corroborating evidence arrives
 *   - Report aggregate confidence statistics (avg, min, max)
 *
 * Key dependencies:
 *   - graphProvider (injected): Cypher read/write against the knowledge graph
 *
 * Side effects:
 *   - Mutates node and relationship properties in the graph database
 *
 * Notes:
 *   - Source weights are hardcoded (manual=1.0 down to unknown=0.5).
 *     Future extension could allow per-project overrides.
 *   - boostConfidence caps scores at 1.0 and initialises missing values
 *     to 0.5 before boosting.
 */

class ConfidenceScores {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        
        // Default confidence weights by source type
        this.sourceWeights = {
            'manual': 1.0,           // User added manually
            'document': 0.9,         // Extracted from document
            'transcript': 0.85,      // Extracted from transcript
            'conversation': 0.8,     // Extracted from chat
            'ai_inferred': 0.7,      // AI inferred relationship
            'pattern_match': 0.6,    // Pattern matching
            'unknown': 0.5
        };
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Calculate confidence score for an extraction
     */
    calculateConfidence(options = {}) {
        let score = this.sourceWeights[options.source] || 0.5;

        // Adjust based on factors
        if (options.aiConfidence) {
            score *= options.aiConfidence;
        }

        if (options.multipleOccurrences) {
            // Boost confidence if entity appears multiple times
            score = Math.min(1.0, score * (1 + 0.1 * options.multipleOccurrences));
        }

        if (options.hasContext) {
            score = Math.min(1.0, score * 1.1);
        }

        if (options.partialMatch) {
            score *= 0.8;
        }

        return Math.round(score * 100) / 100;
    }

    /**
     * Add confidence to a node
     */
    async setNodeConfidence(nodeType, nodeName, confidence, metadata = {}) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (n:${nodeType} {name: $name})
            SET n.confidence = $confidence,
                n.confidenceSource = $source,
                n.confidenceUpdatedAt = datetime()
            RETURN n
        `;

        try {
            const result = await this.graphProvider.query(query, {
                name: nodeName,
                confidence,
                source: metadata.source || 'unknown'
            });
            return { success: result.ok };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Add confidence to a relationship
     */
    async setRelationConfidence(fromNode, toNode, relationType, confidence, metadata = {}) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (a {name: $fromName})-[r:${relationType}]->(b {name: $toName})
            SET r.confidence = $confidence,
                r.confidenceSource = $source,
                r.confidenceUpdatedAt = datetime()
            RETURN r
        `;

        try {
            const result = await this.graphProvider.query(query, {
                fromName: fromNode,
                toName: toNode,
                confidence,
                source: metadata.source || 'unknown'
            });
            return { success: result.ok };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Get low confidence items that may need review
     */
    async getLowConfidenceItems(threshold = 0.6) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const nodeQuery = `
            MATCH (n)
            WHERE n.confidence IS NOT NULL AND n.confidence < $threshold
            RETURN n.name as name, labels(n)[0] as type, n.confidence as confidence
            ORDER BY n.confidence ASC
            LIMIT 50
        `;

        const relQuery = `
            MATCH (a)-[r]->(b)
            WHERE r.confidence IS NOT NULL AND r.confidence < $threshold
            RETURN a.name as from, type(r) as relation, b.name as to, r.confidence as confidence
            ORDER BY r.confidence ASC
            LIMIT 50
        `;

        try {
            const [nodes, relations] = await Promise.all([
                this.graphProvider.query(nodeQuery, { threshold }),
                this.graphProvider.query(relQuery, { threshold })
            ]);

            return {
                lowConfidenceNodes: nodes.results || [],
                lowConfidenceRelations: relations.results || []
            };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Boost confidence when evidence confirms an entity/relation
     */
    async boostConfidence(nodeType, nodeName, boostAmount = 0.1) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (n:${nodeType} {name: $name})
            SET n.confidence = CASE 
                WHEN n.confidence IS NULL THEN 0.5 + $boost
                ELSE CASE WHEN n.confidence + $boost > 1.0 THEN 1.0 ELSE n.confidence + $boost END
            END,
            n.confirmations = coalesce(n.confirmations, 0) + 1
            RETURN n.confidence as newConfidence
        `;

        try {
            const result = await this.graphProvider.query(query, {
                name: nodeName,
                boost: boostAmount
            });
            return { success: result.ok, newConfidence: result.results?.[0]?.newConfidence };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Get confidence statistics
     */
    async getConfidenceStats() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (n)
            WHERE n.confidence IS NOT NULL
            RETURN 
                avg(n.confidence) as avgConfidence,
                min(n.confidence) as minConfidence,
                max(n.confidence) as maxConfidence,
                count(n) as totalWithConfidence
        `;

        try {
            const result = await this.graphProvider.query(query);
            const stats = result.results?.[0] || {};
            return {
                average: Math.round((stats.avgConfidence || 0) * 100) / 100,
                min: stats.minConfidence,
                max: stats.maxConfidence,
                total: stats.totalWithConfidence
            };
        } catch (e) {
            return { error: e.message };
        }
    }
}

// Singleton
let confidenceScoresInstance = null;
function getConfidenceScores(options = {}) {
    if (!confidenceScoresInstance) {
        confidenceScoresInstance = new ConfidenceScores(options);
    }
    if (options.graphProvider) {
        confidenceScoresInstance.setGraphProvider(options.graphProvider);
    }
    return confidenceScoresInstance;
}

module.exports = { ConfidenceScores, getConfidenceScores };
