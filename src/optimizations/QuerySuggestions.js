/**
 * Purpose:
 *   Provide typeahead-style query suggestions by combining user history
 *   from Supabase, popularity rankings, and predefined query templates.
 *
 * Responsibilities:
 *   - Record executed queries to Supabase for history tracking
 *   - Build and cache popularity and pattern statistics from query history
 *   - Return ranked suggestions for a partial query string (autocomplete
 *     from DB, popular from cache, templates by pattern)
 *   - Find related queries by shared topic/question-type patterns
 *   - Provide insight summaries (top patterns, popular queries, totals)
 *
 * Key dependencies:
 *   - ../supabase/storageHelper: query history reads/writes (soft-loaded)
 *   - graphProvider (injected): reserved for future graph-aware suggestions
 *
 * Side effects:
 *   - Reads from and writes to the Supabase query history tables
 *   - In-memory cache refreshes every 5 minutes
 *
 * Notes:
 *   - Template suggestions are statically defined and not personalized;
 *     they use placeholder brackets like [project] or [date].
 *   - clearHistory only clears the in-memory cache; Supabase data persists
 *     and will be reloaded on the next cache refresh.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'query-suggestions' });

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use in-memory suggestions only
}

/**
 * Provides typeahead query suggestions from history, popularity, and templates.
 *
 * @param {object} options
 * @param {object} options.graphProvider - Graph database adapter (reserved for future use)
 * @param {number} [options.maxHistory=500] - Maximum history entries to load from Supabase
 */
class QuerySuggestions {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.maxHistory = options.maxHistory || 500;
        
        // In-memory cache for performance
        this._cache = {
            popular: null,
            patterns: null,
            lastRefresh: 0
        };
        this._cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
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
     * Refresh cache if needed
     */
    async _refreshCache() {
        if (Date.now() - this._cache.lastRefresh > this._cacheTTL) {
            try {
                const history = await this._getStorage().getQueryHistory(this.maxHistory);
                
                // Calculate popular queries
                const popular = {};
                const patterns = {};
                
                for (const entry of history) {
                    const normalized = entry.query_text.toLowerCase().trim();
                    popular[normalized] = (popular[normalized] || 0) + 1;
                    
                    const queryPatterns = this.extractPatterns(entry.query_text);
                    for (const pattern of queryPatterns) {
                        patterns[pattern] = (patterns[pattern] || 0) + 1;
                    }
                }
                
                this._cache = {
                    popular,
                    patterns,
                    recentQueries: history,
                    lastRefresh: Date.now()
                };
            } catch (e) {
                log.warn({ event: 'query_suggestions_refresh_cache_failed', message: e.message }, 'Could not refresh cache');
            }
        }
    }

    /**
     * Record a query
     */
    async recordQuery(query, result = null) {
        try {
            const storage = this._getStorage();
            
            await storage.addQueryHistory(
                query,
                'search',
                result?.duration || null,
                result?.results?.length || 0
            );
            
            // Invalidate cache
            this._cache.lastRefresh = 0;
        } catch (e) {
            log.warn({ event: 'query_suggestions_record_query_failed', message: e.message }, 'Could not record query');
        }
    }

    /**
     * Extract query patterns
     */
    extractPatterns(query) {
        const patterns = [];
        const lower = query.toLowerCase();

        // Question patterns
        if (lower.startsWith('who ')) patterns.push('who_questions');
        if (lower.startsWith('what ')) patterns.push('what_questions');
        if (lower.startsWith('when ')) patterns.push('when_questions');
        if (lower.startsWith('where ')) patterns.push('where_questions');
        if (lower.startsWith('how ')) patterns.push('how_questions');
        if (lower.startsWith('why ')) patterns.push('why_questions');

        // Topic patterns
        if (lower.includes('meeting')) patterns.push('meetings');
        if (lower.includes('project')) patterns.push('projects');
        if (lower.includes('decision')) patterns.push('decisions');
        if (lower.includes('person') || lower.includes('who')) patterns.push('people');
        if (lower.includes('technology') || lower.includes('tech')) patterns.push('technology');

        return patterns;
    }

    /**
     * Return ranked suggestions for a partial query string, combining
     * autocomplete from Supabase, popular queries from cache, and
     * static templates matched by question pattern.
     * @param {string} partial - User's partial query input
     * @param {number} [limit=10] - Max suggestions to return
     * @returns {Promise<Array<{type: string, query: string, count?: number}>>}
     */
    async getSuggestions(partial, limit = 10) {
        await this._refreshCache();
        
        const lower = partial.toLowerCase().trim();
        const suggestions = [];

        // 1. Autocomplete from Supabase
        try {
            const dbSuggestions = await this._getStorage().getQuerySuggestions(partial, 5);
            for (const query of dbSuggestions) {
                suggestions.push({ type: 'history', query });
            }
        } catch (e) {
            // Fallback to cache
            if (this._cache.recentQueries) {
                const fromHistory = this._cache.recentQueries
                    .filter(h => h.query_text.toLowerCase().includes(lower))
                    .slice(0, 5)
                    .map(h => ({ type: 'history', query: h.query_text }));
                suggestions.push(...fromHistory);
            }
        }

        // 2. Popular queries from cache
        if (this._cache.popular) {
            const popular = Object.entries(this._cache.popular)
                .filter(([q]) => q.includes(lower))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([q, count]) => ({ type: 'popular', query: q, count }));
            suggestions.push(...popular);
        }

        // 3. Template suggestions based on pattern
        const templates = this.getTemplates(lower);
        suggestions.push(...templates);

        // Deduplicate and limit
        const seen = new Set();
        return suggestions
            .filter(s => {
                const key = s.query.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, limit);
    }

    /**
     * Get query templates based on input
     */
    getTemplates(input) {
        const templates = [];
        const lower = input.toLowerCase();

        if (lower.startsWith('who')) {
            templates.push({ type: 'template', query: 'Who works on [project]?' });
            templates.push({ type: 'template', query: 'Who attended the last meeting?' });
            templates.push({ type: 'template', query: 'Who made decisions about [topic]?' });
        }

        if (lower.startsWith('what')) {
            templates.push({ type: 'template', query: 'What decisions were made in [meeting]?' });
            templates.push({ type: 'template', query: 'What are the open risks?' });
            templates.push({ type: 'template', query: 'What technologies are we using?' });
        }

        if (lower.includes('meeting')) {
            templates.push({ type: 'template', query: 'What was discussed in the meeting on [date]?' });
            templates.push({ type: 'template', query: 'Who attended the [topic] meeting?' });
        }

        if (lower.includes('project')) {
            templates.push({ type: 'template', query: 'Who is working on [project]?' });
            templates.push({ type: 'template', query: 'What is the status of [project]?' });
        }

        return templates;
    }

    /**
     * Get related queries
     */
    async getRelatedQueries(query) {
        await this._refreshCache();
        
        const patterns = this.extractPatterns(query);
        const related = [];

        if (this._cache.recentQueries) {
            for (const entry of this._cache.recentQueries) {
                const entryPatterns = this.extractPatterns(entry.query_text);
                const commonPatterns = patterns.filter(p => entryPatterns.includes(p));
                
                if (commonPatterns.length > 0 && entry.query_text !== query) {
                    related.push({
                        query: entry.query_text,
                        similarity: commonPatterns.length / Math.max(patterns.length, entryPatterns.length)
                    });
                }
            }
        }

        return related
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);
    }

    /**
     * Get popular queries
     */
    async getPopularQueries(limit = 10) {
        await this._refreshCache();
        
        if (!this._cache.popular) return [];
        
        return Object.entries(this._cache.popular)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([query, count]) => ({ query, count }));
    }

    /**
     * Get query insights
     */
    async getInsights() {
        await this._refreshCache();
        
        const patternStats = this._cache.patterns 
            ? Object.entries(this._cache.patterns)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
            : [];

        return {
            totalQueries: this._cache.recentQueries?.length || 0,
            uniqueQueries: Object.keys(this._cache.popular || {}).length,
            topPatterns: patternStats,
            popularQueries: await this.getPopularQueries(5),
            recentQueries: (this._cache.recentQueries || []).slice(0, 10).map(q => q.query_text)
        };
    }

    /**
     * Clear history (not typically used with Supabase as data persists)
     */
    async clearHistory() {
        // Clear in-memory cache
        this._cache = {
            popular: null,
            patterns: null,
            lastRefresh: 0
        };
        log.debug({ event: 'query_suggestions_cache_cleared' }, 'Cache cleared');
    }
}

// Singleton
let querySuggestionsInstance = null;
function getQuerySuggestions(options = {}) {
    if (!querySuggestionsInstance) {
        querySuggestionsInstance = new QuerySuggestions(options);
    }
    if (options.graphProvider) {
        querySuggestionsInstance.setGraphProvider(options.graphProvider);
    }
    return querySuggestionsInstance;
}

module.exports = { QuerySuggestions, getQuerySuggestions };
