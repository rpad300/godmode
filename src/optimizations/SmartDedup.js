/**
 * Smart Deduplication Module
 * Advanced deduplication using semantic similarity and context
 */

const { logger } = require('../logger');
const llm = require('../llm');
const llmConfig = require('../llm/config');

const log = logger.child({ module: 'smart-dedup' });

class SmartDedup {
    constructor(options = {}) {
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        this.storage = options.storage;
        
        // Similarity thresholds
        this.exactMatchThreshold = 0.95;
        this.semanticMatchThreshold = 0.85;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Find and merge duplicate facts
     */
    async deduplicateFacts() {
        if (!this.storage) return { error: 'Storage not set' };

        const facts = this.storage.getFacts();
        const duplicates = [];
        const processed = new Set();

        for (let i = 0; i < facts.length; i++) {
            if (processed.has(facts[i].id)) continue;

            const group = [facts[i]];
            
            for (let j = i + 1; j < facts.length; j++) {
                if (processed.has(facts[j].id)) continue;

                const similarity = this.calculateTextSimilarity(facts[i].content, facts[j].content);
                if (similarity >= this.exactMatchThreshold) {
                    group.push(facts[j]);
                    processed.add(facts[j].id);
                }
            }

            if (group.length > 1) {
                duplicates.push({
                    primary: group[0],
                    duplicates: group.slice(1),
                    similarity: 'exact'
                });
                processed.add(facts[i].id);
            }
        }

        // Merge duplicates
        let merged = 0;
        for (const dup of duplicates) {
            for (const d of dup.duplicates) {
                this.storage.deleteFact(d.id);
                merged++;
            }
        }

        return { merged, duplicateGroups: duplicates.length };
    }

    /**
     * Find semantically similar items using embeddings
     */
    async findSemanticDuplicates(items, textField = 'content') {
        if (items.length < 2) return [];

        const duplicates = [];
        const embeddings = [];

        // Get embeddings for all items
        const texts = items.map(i => i[textField]);
        
        try {
            const embedCfg = this.appConfig ? llmConfig.getEmbeddingsConfig(this.appConfig) : null;
            const provider = embedCfg?.provider || this.llmConfig?.embeddingsProvider;
            const providerConfig = embedCfg?.providerConfig || this.llmConfig?.providers?.[provider] || {};
            const model = embedCfg?.model || this.llmConfig?.models?.embeddings;
            if (!provider || !model) {
                log.debug({ event: 'smart_dedup_no_embed_config' }, 'No embeddings config, falling back to text similarity');
                return this.findTextDuplicates(items, textField);
            }
            const embedResult = await llm.embed({
                provider,
                providerConfig,
                model,
                texts
            });

            if (!embedResult.success) {
                log.debug({ event: 'smart_dedup_embed_fallback' }, 'Embedding failed, falling back to text similarity');
                return this.findTextDuplicates(items, textField);
            }

            embeddings.push(...embedResult.embeddings);
        } catch (e) {
            return this.findTextDuplicates(items, textField);
        }

        // Find similar pairs
        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
                if (similarity >= this.semanticMatchThreshold) {
                    duplicates.push({
                        item1: items[i],
                        item2: items[j],
                        similarity,
                        type: 'semantic'
                    });
                }
            }
        }

        return duplicates;
    }

    /**
     * Find text-based duplicates
     */
    findTextDuplicates(items, textField = 'content') {
        const duplicates = [];

        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const similarity = this.calculateTextSimilarity(
                    items[i][textField],
                    items[j][textField]
                );
                if (similarity >= this.exactMatchThreshold) {
                    duplicates.push({
                        item1: items[i],
                        item2: items[j],
                        similarity,
                        type: 'text'
                    });
                }
            }
        }

        return duplicates;
    }

    /**
     * Calculate text similarity using Jaccard index on words
     */
    calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
        
        const words1 = new Set(normalize(text1));
        const words2 = new Set(normalize(text2));
        
        if (words1.size === 0 || words2.size === 0) return 0;

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * Cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Deduplicate people by merging similar names
     */
    async deduplicatePeople() {
        if (!this.storage) return { error: 'Storage not set' };

        const people = this.storage.getPeople();
        const duplicates = [];
        const processed = new Set();

        for (let i = 0; i < people.length; i++) {
            if (processed.has(people[i].id)) continue;

            const group = [people[i]];
            
            for (let j = i + 1; j < people.length; j++) {
                if (processed.has(people[j].id)) continue;

                // Check name similarity
                const nameSim = this.calculateNameSimilarity(people[i].name, people[j].name);
                
                // Check if same email
                const sameEmail = people[i].email && people[j].email && 
                    people[i].email.toLowerCase() === people[j].email.toLowerCase();

                if (nameSim >= 0.85 || sameEmail) {
                    group.push(people[j]);
                    processed.add(people[j].id);
                }
            }

            if (group.length > 1) {
                const merged = this.mergePeopleRecords(group);
                duplicates.push({
                    merged,
                    original: group
                });
                processed.add(people[i].id);
            }
        }

        return { duplicateGroups: duplicates.length, duplicates };
    }

    /**
     * Calculate name similarity accounting for variations
     */
    calculateNameSimilarity(name1, name2) {
        if (!name1 || !name2) return 0;

        const n1 = name1.toLowerCase().trim();
        const n2 = name2.toLowerCase().trim();

        // Exact match
        if (n1 === n2) return 1.0;

        // Check if one contains the other
        if (n1.includes(n2) || n2.includes(n1)) return 0.9;

        // Check initials match
        const parts1 = n1.split(/\s+/);
        const parts2 = n2.split(/\s+/);
        
        // First name + last initial vs full name
        if (parts1.length >= 2 && parts2.length >= 2) {
            if (parts1[0] === parts2[0] && 
                (parts1[parts1.length-1][0] === parts2[parts2.length-1][0])) {
                return 0.85;
            }
        }

        // Word-based similarity
        return this.calculateTextSimilarity(n1, n2);
    }

    /**
     * Merge multiple people records into one
     */
    mergePeopleRecords(people) {
        const merged = {
            name: '',
            email: null,
            role: null,
            organization: null,
            aliases: []
        };

        // Take the longest/most complete name
        let longestName = '';
        for (const p of people) {
            if (p.name && p.name.length > longestName.length) {
                longestName = p.name;
            }
            if (p.name) merged.aliases.push(p.name);
            if (p.email && !merged.email) merged.email = p.email;
            if (p.role && !merged.role) merged.role = p.role;
            if (p.organization && !merged.organization) merged.organization = p.organization;
        }

        merged.name = longestName;
        merged.aliases = [...new Set(merged.aliases)].filter(a => a !== merged.name);

        return merged;
    }

    /**
     * Run full deduplication
     */
    async runFullDedup() {
        const results = {
            facts: await this.deduplicateFacts(),
            people: await this.deduplicatePeople()
        };

        log.debug({ event: 'smart_dedup_complete', factsMerged: results.facts.merged || 0, peopleGroups: results.people.duplicateGroups || 0 }, 'Dedup complete');
        
        return results;
    }
}

// Singleton
let smartDedupInstance = null;
function getSmartDedup(options = {}) {
    if (!smartDedupInstance) {
        smartDedupInstance = new SmartDedup(options);
    }
    if (options.storage) smartDedupInstance.setStorage(options.storage);
    if (options.llmConfig) smartDedupInstance.llmConfig = options.llmConfig;
    return smartDedupInstance;
}

module.exports = { SmartDedup, getSmartDedup };
