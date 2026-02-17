/**
 * Purpose:
 *   Deduplicate organization/company entities by normalizing names,
 *   matching domains, and optionally using LLM disambiguation for
 *   ambiguous cases.
 *
 * Responsibilities:
 *   - Normalize organization names by stripping common suffixes (Inc, Ltd,
 *     Corp, GmbH, etc.), parenthetical remarks, and "The" prefixes
 *   - Extract base domain names from emails and URLs for cross-referencing
 *   - Calculate multi-signal similarity (Levenshtein, Jaccard on words,
 *     containment, acronym matching)
 *   - Search graph and storage for potential duplicates of a given org name
 *   - Resolve ambiguous matches via LLM when confidence is moderate
 *   - Provide a findOrCreate flow that returns an existing match or flags
 *     the organization as new
 *
 * Key dependencies:
 *   - ../llm: optional LLM-based disambiguation
 *   - ../llm/config: per-task provider/model resolution
 *   - graphProvider (injected): Cypher search for existing organizations
 *   - storage (injected): alternative organization search
 *
 * Side effects:
 *   - Makes LLM API calls in resolveWithLLM
 *   - Caches duplicate-search results in memory (10-minute TTL)
 *
 * Notes:
 *   - The suffix list is extensive but not exhaustive; uncommon legal
 *     forms may slip through normalization.
 *   - Acronym matching only checks names up to 5 characters long.
 *   - Domain matching treats a shared domain as a 0.95+ similarity signal,
 *     which may over-match when multiple companies share a domain (e.g.,
 *     gmail.com).
 */

const { logger } = require('../logger');
const llm = require('../llm');

const log = logger.child({ module: 'organization-resolver' });

class OrganizationResolver {
    constructor(options = {}) {
        this.storage = options.storage;
        this.graphProvider = options.graphProvider;
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        
        // Cache for resolved organizations
        this.cache = new Map();
        this.cacheTTL = options.cacheTTL || 10 * 60 * 1000; // 10 minutes
        
        // Statistics
        this.stats = {
            resolved: 0,
            merged: 0,
            aiAssisted: 0
        };
    }

    /**
     * Common company suffixes to normalize
     */
    static SUFFIXES = [
        'Inc', 'Inc.', 'Incorporated',
        'Ltd', 'Ltd.', 'Limited',
        'Corp', 'Corp.', 'Corporation',
        'LLC', 'L.L.C.', 'L.L.C',
        'LLP', 'L.L.P.',
        'PLC', 'P.L.C.',
        'Group', 'Holdings', 'Holding',
        'SA', 'S.A.', 'Lda', 'Lda.',
        'GmbH', 'AG', 'BV', 'NV',
        'Co', 'Co.', 'Company',
        'International', 'Intl', 'Intl.',
        'Technologies', 'Technology', 'Tech',
        'Solutions', 'Services', 'Consulting',
        'Partners', 'Associates'
    ];

    /**
     * Common TLDs to strip from domain names
     */
    static TLDS = ['.com', '.org', '.net', '.io', '.co', '.ai', '.tech', '.dev', '.app'];

    /**
     * Normalize an organization name
     * @param {string} name - Original organization name
     * @returns {string} - Normalized name
     */
    normalizeName(name) {
        if (!name) return '';
        
        let normalized = name.trim();
        
        // Remove common suffixes (case-insensitive)
        for (const suffix of OrganizationResolver.SUFFIXES) {
            const regex = new RegExp(`\\s*,?\\s*${suffix}\\s*$`, 'i');
            normalized = normalized.replace(regex, '');
        }
        
        // Remove parenthetical content like "(USA)" or "(formerly XYZ)"
        normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ');
        
        // Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        // Remove leading "The"
        normalized = normalized.replace(/^The\s+/i, '');
        
        return normalized.toLowerCase();
    }

    /**
     * Extract domain from email or URL
     * @param {string} input - Email address or URL
     * @returns {string|null} - Domain without TLD
     */
    extractDomain(input) {
        if (!input) return null;
        
        let domain = input.toLowerCase();
        
        // Extract domain from email
        if (domain.includes('@')) {
            domain = domain.split('@')[1];
        }
        
        // Extract domain from URL
        if (domain.includes('://')) {
            domain = domain.split('://')[1];
        }
        
        // Remove www
        domain = domain.replace(/^www\./, '');
        
        // Remove path
        domain = domain.split('/')[0];
        
        // Remove TLD
        for (const tld of OrganizationResolver.TLDS) {
            if (domain.endsWith(tld)) {
                domain = domain.slice(0, -tld.length);
                break;
            }
        }
        
        return domain || null;
    }

    /**
     * Calculate similarity between two organization names
     * @param {string} name1 
     * @param {string} name2 
     * @returns {number} - Similarity score 0-1
     */
    calculateSimilarity(name1, name2) {
        const n1 = this.normalizeName(name1);
        const n2 = this.normalizeName(name2);
        
        if (!n1 || !n2) return 0;
        
        // Exact match after normalization
        if (n1 === n2) return 1.0;
        
        // One contains the other
        if (n1.includes(n2) || n2.includes(n1)) {
            // Longer name containing shorter gets high score
            const ratio = Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
            return Math.max(0.85, ratio);
        }
        
        // Check for acronym match (e.g., "IBM" matches "International Business Machines")
        const acronymScore = this.checkAcronymMatch(n1, n2);
        if (acronymScore > 0.7) return acronymScore;
        
        // Levenshtein distance-based similarity
        const distance = this.levenshteinDistance(n1, n2);
        const maxLen = Math.max(n1.length, n2.length);
        const levenshteinSim = 1 - (distance / maxLen);
        
        // Jaccard similarity on words
        const jaccardSim = this.jaccardSimilarity(n1.split(/\s+/), n2.split(/\s+/));
        
        // Weighted combination
        return (levenshteinSim * 0.6) + (jaccardSim * 0.4);
    }

    /**
     * Check if one name is an acronym of another
     * @param {string} name1 
     * @param {string} name2 
     * @returns {number} - Match score
     */
    checkAcronymMatch(name1, name2) {
        const words1 = name1.split(/\s+/);
        const words2 = name2.split(/\s+/);
        
        // Try name1 as acronym
        if (words1.length === 1 && name1.length <= 5) {
            const acronym = words2.map(w => w[0]).join('');
            if (acronym === name1) return 0.9;
        }
        
        // Try name2 as acronym
        if (words2.length === 1 && name2.length <= 5) {
            const acronym = words1.map(w => w[0]).join('');
            if (acronym === name2) return 0.9;
        }
        
        return 0;
    }

    /**
     * Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
        }
        
        return dp[m][n];
    }

    /**
     * Jaccard similarity between two arrays
     */
    jaccardSimilarity(arr1, arr2) {
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Find potential duplicate organizations
     * @param {string} orgName - Organization name to check
     * @param {string} domain - Optional domain/email to help matching
     * @returns {Promise<Array>} - Array of potential matches with scores
     */
    async findDuplicates(orgName, domain = null) {
        const normalized = this.normalizeName(orgName);
        const domainKey = domain ? this.extractDomain(domain) : null;
        
        // Check cache
        const cacheKey = `${normalized}:${domainKey || ''}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.matches;
        }
        
        const matches = [];
        
        // Search in graph if available
        if (this.graphProvider?.connected) {
            try {
                const query = `
                    MATCH (o:Organization)
                    WHERE toLower(o.name) CONTAINS $search
                       OR o.domain CONTAINS $domain
                    RETURN o.id as id, o.name as name, o.domain as domain
                    LIMIT 20
                `;
                const result = await this.graphProvider.query(query, {
                    search: normalized.substring(0, 10),
                    domain: domainKey || ''
                });
                
                for (const row of result.results || []) {
                    const similarity = this.calculateSimilarity(orgName, row.name);
                    const domainMatch = domainKey && row.domain && 
                        this.extractDomain(row.domain) === domainKey;
                    
                    if (similarity >= 0.7 || domainMatch) {
                        matches.push({
                            id: row.id,
                            name: row.name,
                            domain: row.domain,
                            similarity: domainMatch ? Math.max(similarity, 0.95) : similarity,
                            matchType: domainMatch ? 'domain' : 'name'
                        });
                    }
                }
            } catch (e) {
                log.error({ event: 'organization_resolver_graph_search_failed', message: e.message }, 'Graph search failed');
            }
        }
        
        // Search in storage if available
        if (this.storage?.searchOrganizations) {
            try {
                const storageResults = await this.storage.searchOrganizations(normalized);
                for (const org of storageResults || []) {
                    const similarity = this.calculateSimilarity(orgName, org.name);
                    if (similarity >= 0.7 && !matches.find(m => m.id === org.id)) {
                        matches.push({
                            id: org.id,
                            name: org.name,
                            domain: org.domain,
                            similarity,
                            matchType: 'name'
                        });
                    }
                }
            } catch (e) {
                // Storage search not available
            }
        }
        
        // Sort by similarity
        matches.sort((a, b) => b.similarity - a.similarity);
        
        // Cache results
        this.cache.set(cacheKey, { matches, timestamp: Date.now() });
        this.stats.resolved++;
        
        return matches;
    }

    /**
     * Resolve organization using LLM for ambiguous cases
     * @param {object} org1 - First organization
     * @param {object} org2 - Second organization
     * @returns {Promise<{same: boolean, confidence: number, reason: string}>}
     */
    async resolveWithLLM(org1, org2) {
        const llmConfig = require('../llm/config');
        const textCfg = this.appConfig ? llmConfig.getTextConfig(this.appConfig) : null;
        const provider = textCfg?.provider ?? this.llmConfig?.perTask?.text?.provider ?? this.llmConfig?.provider;
        const model = textCfg?.model ?? this.llmConfig?.perTask?.text?.model ?? this.llmConfig?.models?.text;
        const providerConfig = textCfg?.providerConfig ?? this.llmConfig?.providers?.[provider] ?? {};
        if (!provider || !model) {
            return { same: false, confidence: 0, reason: 'No LLM configured' };
        }

        const prompt = `Determine if these two organizations are the same company:

Organization 1:
- Name: ${org1.name}
- Domain: ${org1.domain || 'unknown'}
- Industry: ${org1.industry || 'unknown'}

Organization 2:
- Name: ${org2.name}
- Domain: ${org2.domain || 'unknown'}
- Industry: ${org2.industry || 'unknown'}

Consider:
- Name variations (Inc, Corp, Ltd are often omitted)
- Rebranding or acquisitions
- Parent/subsidiary relationships
- Regional variations

Respond with JSON only:
{"same": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`;

        try {
            const result = await llm.generateText({
                provider,
                providerConfig,
                model,
                prompt,
                temperature: 0.1,
                maxTokens: 150,
                jsonMode: true,
                context: 'organization_resolution'
            });

            if (!result.success) {
                return { same: false, confidence: 0, reason: 'LLM call failed' };
            }

            const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{}');
            this.stats.aiAssisted++;
            
            return {
                same: parsed.same || false,
                confidence: parsed.confidence || 0.5,
                reason: parsed.reason || 'Unknown'
            };
        } catch (e) {
            log.error({ event: 'organization_resolver_llm_failed', message: e.message }, 'LLM resolution failed');
            return { same: false, confidence: 0, reason: e.message };
        }
    }

    /**
     * Auto-resolve organization (find or create)
     * @param {string} name - Organization name
     * @param {object} metadata - Additional info (domain, industry, etc.)
     * @returns {Promise<{id: string, name: string, isNew: boolean, mergedFrom?: string}>}
     */
    async findOrCreate(name, metadata = {}) {
        // Find duplicates
        const duplicates = await this.findDuplicates(name, metadata.domain);
        
        if (duplicates.length > 0) {
            const best = duplicates[0];
            
            if (best.similarity >= 0.9) {
                // High confidence match - use existing
                return {
                    id: best.id,
                    name: best.name,
                    isNew: false,
                    matchedFrom: name,
                    similarity: best.similarity
                };
            }
            
            if (best.similarity >= 0.75 && metadata.autoMerge) {
                // Medium confidence - use LLM if available
                const llmResult = await this.resolveWithLLM(
                    { name, ...metadata },
                    { name: best.name, domain: best.domain }
                );
                
                if (llmResult.same && llmResult.confidence >= 0.8) {
                    return {
                        id: best.id,
                        name: best.name,
                        isNew: false,
                        matchedFrom: name,
                        similarity: best.similarity,
                        aiConfirmed: true
                    };
                }
            }
        }
        
        // No good match found - would create new
        // (Actual creation depends on storage implementation)
        return {
            id: null,
            name: name,
            isNew: true,
            suggestedMerges: duplicates.filter(d => d.similarity >= 0.6)
        };
    }

    /**
     * Get resolution statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Singleton
let instance = null;

function getOrganizationResolver(options = {}) {
    if (!instance) {
        instance = new OrganizationResolver(options);
    }
    return instance;
}

module.exports = {
    OrganizationResolver,
    getOrganizationResolver
};
