/**
 * Purpose:
 *   Record user corrections (renames, merges, relation-type fixes) and
 *   apply the learned rules to future extractions so that the same
 *   mistakes are not repeated.
 *
 * Responsibilities:
 *   - Persist corrections as feedback entries in Supabase
 *   - Maintain an in-memory cache of entity aliases, relation patterns,
 *     and custom extraction rules (refreshed every 5 minutes)
 *   - Translate new extractions through learned aliases (applyCorrections)
 *   - Suggest corrections for incoming extractions based on known aliases
 *   - Import/export learned rules for cross-project reuse
 *
 * Key dependencies:
 *   - ../supabase/storageHelper: feedback persistence (soft-loaded)
 *
 * Side effects:
 *   - Reads from and writes to the Supabase "feedback" table
 *   - In-memory cache is invalidated (lastRefresh=0) after each write
 *
 * Notes:
 *   - When Supabase is unavailable, the module still works using only its
 *     in-memory cache; corrections will not survive a restart.
 *   - getCanonicalNameSync is a synchronous variant for hot paths; it
 *     relies on the cache having been refreshed by a prior async call.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'feedback-loop' });

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use in-memory cache only
}

class FeedbackLoop {
    constructor(options = {}) {
        // In-memory cache for fast lookups
        this._cache = {
            entityAliases: {},
            relationPatterns: [],
            extractionRules: [],
            lastRefresh: 0
        };
        this._cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get storage instance
     */
    _getStorage() {
        if (!getStorage) return null;
        try {
            return getStorage();
        } catch (e) {
            return null;
        }
    }

    /**
     * Refresh cache from Supabase
     */
    async _refreshCache() {
        if (Date.now() - this._cache.lastRefresh > this._cacheTTL) {
            try {
                const feedback = await this._getStorage().getFeedback('applied');
                
                // Build alias map from corrections
                const aliases = {};
                const patterns = [];
                const rules = [];
                
                for (const entry of feedback) {
                    if (entry.feedback_type === 'correction') {
                        const original = entry.original_value;
                        const corrected = entry.corrected_value;
                        
                        // Entity aliases
                        if (original && corrected) {
                            aliases[original.toLowerCase().trim()] = corrected;
                        }
                    }
                }
                
                this._cache = {
                    entityAliases: aliases,
                    relationPatterns: patterns,
                    extractionRules: rules,
                    lastRefresh: Date.now()
                };
            } catch (e) {
                log.warn({ event: 'feedback_loop_refresh_failed', message: e.message }, 'Could not refresh cache');
            }
        }
    }

    /**
     * Record a user correction
     */
    async recordCorrection(correction) {
        try {
            const storage = this._getStorage();
            
            // Determine entity type from correction type
            let entityType = 'unknown';
            let entityId = null;
            
            if (correction.context?.entityType) {
                entityType = correction.context.entityType;
            }
            if (correction.context?.entityId) {
                entityId = correction.context.entityId;
            }
            
            // Add feedback to Supabase
            const result = await storage.addFeedback(
                entityType,
                entityId || '00000000-0000-0000-0000-000000000000',
                'correction',
                correction.context?.note || null,
                {
                    original: JSON.stringify(correction.original),
                    corrected: JSON.stringify(correction.corrected)
                }
            );
            
            // Invalidate cache
            this._cache.lastRefresh = 0;
            
            // Learn from correction immediately
            await this._learnFromCorrection(correction);
            
            return result.id;
        } catch (e) {
            log.warn({ event: 'feedback_loop_record_correction_failed', message: e.message }, 'Could not record correction');
            return null;
        }
    }

    /**
     * Learn patterns from corrections
     */
    async _learnFromCorrection(correction) {
        switch (correction.type) {
            case 'entity_rename':
                // Update cache immediately
                if (correction.original?.name && correction.corrected?.name) {
                    this._cache.entityAliases[correction.original.name.toLowerCase().trim()] = 
                        correction.corrected.name;
                }
                break;

            case 'entity_merge':
                // Learn aliases from merge
                if (correction.original?.names && correction.corrected?.name) {
                    const canonical = correction.corrected.name;
                    for (const name of correction.original.names) {
                        if (name !== canonical) {
                            this._cache.entityAliases[name.toLowerCase().trim()] = canonical;
                        }
                    }
                }
                break;

            case 'relation_type':
                // Learn relation type correction
                this._cache.relationPatterns.push({
                    original: correction.original,
                    corrected: correction.corrected,
                    count: 1
                });
                break;

            case 'extraction_rule':
                // User added custom rule
                this._cache.extractionRules.push(correction.corrected);
                break;
        }
    }

    /**
     * Add entity alias
     */
    async addEntityAlias(alias, canonical) {
        const normalizedAlias = alias.toLowerCase().trim();
        const normalizedCanonical = canonical.toLowerCase().trim();
        
        if (normalizedAlias !== normalizedCanonical) {
            this._cache.entityAliases[normalizedAlias] = canonical;
            
            // Persist to Supabase
            try {
                await this._getStorage().addFeedback(
                    'entity',
                    '00000000-0000-0000-0000-000000000000',
                    'correction',
                    `Alias: ${alias} -> ${canonical}`,
                    { original: alias, corrected: canonical }
                );
            } catch (e) {
                log.warn({ event: 'feedback_loop_persist_alias_failed', message: e.message }, 'Could not persist alias');
            }
        }
    }

    /**
     * Get canonical name for an entity
     */
    async getCanonicalName(name) {
        await this._refreshCache();
        const normalized = name.toLowerCase().trim();
        return this._cache.entityAliases[normalized] || name;
    }

    /**
     * Synchronous version for use in hot paths
     */
    getCanonicalNameSync(name) {
        const normalized = name.toLowerCase().trim();
        return this._cache.entityAliases[normalized] || name;
    }

    /**
     * Check if two names refer to same entity
     */
    async areSameEntity(name1, name2) {
        const canonical1 = await this.getCanonicalName(name1);
        const canonical2 = await this.getCanonicalName(name2);
        return canonical1.toLowerCase() === canonical2.toLowerCase();
    }

    /**
     * Apply learned corrections to new extractions
     */
    async applyCorrections(extractions) {
        await this._refreshCache();
        const corrected = { ...extractions };

        // Apply entity aliases
        if (corrected.entities) {
            corrected.entities = corrected.entities.map(e => ({
                ...e,
                name: this.getCanonicalNameSync(e.name)
            }));
        }

        // Apply to people
        if (corrected.people) {
            corrected.people = corrected.people.map(p => ({
                ...p,
                name: this.getCanonicalNameSync(p.name)
            }));
        }

        // Apply to relationships
        if (corrected.relationships) {
            corrected.relationships = corrected.relationships.map(r => ({
                ...r,
                from: this.getCanonicalNameSync(r.from),
                to: this.getCanonicalNameSync(r.to)
            }));
        }

        return corrected;
    }

    /**
     * Get feedback statistics
     */
    async getStats() {
        await this._refreshCache();
        
        try {
            const allFeedback = await this._getStorage().getFeedback();
            const appliedFeedback = allFeedback.filter(f => f.status === 'applied');
            
            return {
                totalFeedback: allFeedback.length,
                correctionsApplied: appliedFeedback.length,
                aliasCount: Object.keys(this._cache.entityAliases).length,
                relationPatterns: this._cache.relationPatterns.length,
                customRules: this._cache.extractionRules.length,
                recentCorrections: allFeedback.slice(-10)
            };
        } catch (e) {
            return {
                totalFeedback: 0,
                correctionsApplied: 0,
                aliasCount: Object.keys(this._cache.entityAliases).length,
                relationPatterns: this._cache.relationPatterns.length,
                customRules: this._cache.extractionRules.length,
                recentCorrections: []
            };
        }
    }

    /**
     * Export learned rules
     */
    async exportRules() {
        await this._refreshCache();
        return {
            entityAliases: this._cache.entityAliases,
            relationPatterns: this._cache.relationPatterns,
            extractionRules: this._cache.extractionRules
        };
    }

    /**
     * Import rules (e.g., from another project)
     */
    async importRules(rules) {
        // Update cache
        if (rules.entityAliases) {
            this._cache.entityAliases = {
                ...this._cache.entityAliases,
                ...rules.entityAliases
            };
            
            // Persist each alias to Supabase
            for (const [alias, canonical] of Object.entries(rules.entityAliases)) {
                try {
                    await this._getStorage().addFeedback(
                        'entity',
                        '00000000-0000-0000-0000-000000000000',
                        'correction',
                        `Imported alias: ${alias} -> ${canonical}`,
                        { original: alias, corrected: canonical }
                    );
                } catch (e) {
                    // Continue with other aliases
                }
            }
        }
        
        if (rules.relationPatterns) {
            this._cache.relationPatterns.push(...rules.relationPatterns);
        }
        
        if (rules.extractionRules) {
            this._cache.extractionRules.push(...rules.extractionRules);
        }
    }

    /**
     * Suggest corrections based on patterns
     */
    async suggestCorrections(extractions) {
        await this._refreshCache();
        const suggestions = [];

        // Check for known aliases
        for (const entity of extractions.entities || []) {
            const canonical = this.getCanonicalNameSync(entity.name);
            if (canonical !== entity.name) {
                suggestions.push({
                    type: 'entity_rename',
                    original: entity.name,
                    suggested: canonical,
                    reason: 'Known alias'
                });
            }
        }

        return suggestions;
    }
}

// Singleton
let feedbackLoopInstance = null;
function getFeedbackLoop(options = {}) {
    if (!feedbackLoopInstance) {
        feedbackLoopInstance = new FeedbackLoop(options);
    }
    return feedbackLoopInstance;
}

module.exports = { FeedbackLoop, getFeedbackLoop };
