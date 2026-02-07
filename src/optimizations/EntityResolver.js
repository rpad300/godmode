/**
 * Entity Resolution Module
 * Resolves duplicate entities: "João Silva" = "J. Silva" = "joao.silva@cgi.com"
 * Uses fuzzy matching and context-aware merging
 */

const llm = require('../llm');

class EntityResolver {
    constructor(options = {}) {
        this.similarityThreshold = options.similarityThreshold || 0.75;
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        
        // Cache of resolved entities
        this.resolvedCache = new Map();
        
        // Known aliases loaded from storage
        this.knownAliases = new Map();
    }

    /**
     * Find and merge duplicate entities in the graph
     * @param {object} graphProvider - Graph database provider
     * @returns {Promise<{merged: number, candidates: Array}>}
     */
    async resolveDuplicates(graphProvider) {
        if (!graphProvider || !graphProvider.connected) {
            return { merged: 0, candidates: [], error: 'Graph not connected' };
        }

        console.log('[EntityResolver] Starting duplicate resolution...');
        
        // Get all Person nodes
        const personsResult = await graphProvider.query('MATCH (p:Person) RETURN p.name as name, p.email as email, p.role as role, p.organization as org');
        if (!personsResult.ok) {
            return { merged: 0, candidates: [], error: personsResult.error };
        }

        const persons = personsResult.results || [];
        const candidates = [];
        const merged = [];

        // Find similar persons
        for (let i = 0; i < persons.length; i++) {
            for (let j = i + 1; j < persons.length; j++) {
                const p1 = persons[i];
                const p2 = persons[j];
                
                const similarity = this.calculateSimilarity(p1, p2);
                if (similarity >= this.similarityThreshold) {
                    candidates.push({
                        entity1: p1,
                        entity2: p2,
                        similarity,
                        suggestedMerge: this.suggestMerge(p1, p2)
                    });
                }
            }
        }

        console.log(`[EntityResolver] Found ${candidates.length} potential duplicates`);

        // Auto-merge high confidence matches
        for (const candidate of candidates) {
            if (candidate.similarity >= 0.9) {
                try {
                    await this.mergeEntities(graphProvider, candidate.entity1, candidate.entity2, candidate.suggestedMerge);
                    merged.push(candidate);
                } catch (err) {
                    console.log(`[EntityResolver] Merge failed: ${err.message}`);
                }
            }
        }

        return {
            merged: merged.length,
            candidates: candidates.filter(c => c.similarity < 0.9),
            autoMerged: merged
        };
    }

    /**
     * Calculate similarity between two entities
     */
    calculateSimilarity(e1, e2) {
        let score = 0;
        let factors = 0;

        // Name similarity
        if (e1.name && e2.name) {
            const nameSim = this.stringSimilarity(
                this.normalizeName(e1.name),
                this.normalizeName(e2.name)
            );
            score += nameSim * 0.5;
            factors += 0.5;
        }

        // Email match (high weight)
        if (e1.email && e2.email) {
            if (e1.email.toLowerCase() === e2.email.toLowerCase()) {
                score += 0.3;
            } else {
                // Check email prefix
                const prefix1 = e1.email.split('@')[0].toLowerCase();
                const prefix2 = e2.email.split('@')[0].toLowerCase();
                if (this.stringSimilarity(prefix1, prefix2) > 0.8) {
                    score += 0.2;
                }
            }
            factors += 0.3;
        }

        // Organization match
        if (e1.org && e2.org) {
            if (e1.org.toLowerCase() === e2.org.toLowerCase()) {
                score += 0.15;
            }
            factors += 0.15;
        }

        // Role similarity
        if (e1.role && e2.role) {
            if (this.stringSimilarity(e1.role.toLowerCase(), e2.role.toLowerCase()) > 0.7) {
                score += 0.05;
            }
            factors += 0.05;
        }

        return factors > 0 ? score / factors : 0;
    }

    /**
     * Normalize a name for comparison
     */
    normalizeName(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate string similarity (Levenshtein-based)
     */
    stringSimilarity(s1, s2) {
        if (!s1 || !s2) return 0;
        if (s1 === s2) return 1;
        
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        if (longer.length === 0) return 1;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Levenshtein distance
     */
    levenshteinDistance(s1, s2) {
        const m = s1.length;
        const n = s2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
        }

        return dp[m][n];
    }

    /**
     * Suggest merged entity properties
     */
    suggestMerge(e1, e2) {
        return {
            name: e1.name?.length > e2.name?.length ? e1.name : e2.name,
            email: e1.email || e2.email,
            role: e1.role || e2.role,
            organization: e1.org || e2.org,
            aliases: [e1.name, e2.name].filter(Boolean)
        };
    }

    /**
     * Merge two entities in the graph
     */
    async mergeEntities(graphProvider, e1, e2, merged) {
        const primaryName = merged.name;
        const secondaryName = e1.name === primaryName ? e2.name : e1.name;

        // Transfer all relationships from secondary to primary
        await graphProvider.query(`
            MATCH (secondary:Person {name: $secondaryName})-[r]->(target)
            MATCH (primary:Person {name: $primaryName})
            MERGE (primary)-[newR:RELATES_TO]->(target)
            DELETE r
        `, { primaryName, secondaryName });

        await graphProvider.query(`
            MATCH (source)-[r]->(secondary:Person {name: $secondaryName})
            MATCH (primary:Person {name: $primaryName})
            MERGE (source)-[newR:RELATES_TO]->(primary)
            DELETE r
        `, { primaryName, secondaryName });

        // Update primary with merged properties
        await graphProvider.query(`
            MATCH (p:Person {name: $name})
            SET p.email = coalesce($email, p.email),
                p.role = coalesce($role, p.role),
                p.organization = coalesce($org, p.organization),
                p.aliases = $aliases,
                p.mergedAt = datetime()
        `, {
            name: primaryName,
            email: merged.email,
            role: merged.role,
            org: merged.organization,
            aliases: merged.aliases
        });

        // Delete secondary
        await graphProvider.query('MATCH (p:Person {name: $name}) DELETE p', { name: secondaryName });

        console.log(`[EntityResolver] Merged "${secondaryName}" into "${primaryName}"`);
    }

    /**
     * Use LLM to resolve ambiguous cases
     */
    async resolveWithAI(entity1, entity2) {
        const prompt = `Determine if these two entities refer to the same person:

Entity 1:
- Name: ${entity1.name}
- Email: ${entity1.email || 'N/A'}
- Role: ${entity1.role || 'N/A'}
- Organization: ${entity1.org || 'N/A'}

Entity 2:
- Name: ${entity2.name}
- Email: ${entity2.email || 'N/A'}
- Role: ${entity2.role || 'N/A'}
- Organization: ${entity2.org || 'N/A'}

Respond with JSON: {"same_person": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

        try {
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.1,
                maxTokens: 200
            });

            if (result.success) {
                const match = result.text.match(/\{[\s\S]*\}/);
                if (match) {
                    return JSON.parse(match[0]);
                }
            }
        } catch (e) {
            console.log('[EntityResolver] AI resolution failed:', e.message);
        }

        return { same_person: false, confidence: 0, reasoning: 'AI resolution failed' };
    }
}

// Singleton
let entityResolverInstance = null;
function getEntityResolver(options = {}) {
    if (!entityResolverInstance) {
        entityResolverInstance = new EntityResolver(options);
    }
    return entityResolverInstance;
}

module.exports = { EntityResolver, getEntityResolver };
