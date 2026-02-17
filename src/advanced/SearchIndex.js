/**
 * Purpose:
 *   Full-text search engine backed by an in-memory inverted index with
 *   TF-IDF scoring, configurable field boosts, and basic stemming.
 *
 * Responsibilities:
 *   - Index documents by extracting, tokenizing, stemming, and recording
 *     term positions per field
 *   - Score search queries using TF-IDF with per-field boost multipliers
 *   - Provide prefix-based term suggestions (autocomplete)
 *   - Persist the inverted index and document metadata to disk as JSON
 *   - Rebuild the entire index from a document array
 *
 * Key dependencies:
 *   - fs / path: loading/saving inverted-index.json and documents.json
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Constructor creates <dataDir>/search-index/ if it does not exist
 *   - save() writes two JSON files to that directory
 *
 * Notes:
 *   - Stop-word list includes both English and Portuguese terms to support
 *     bilingual knowledge bases.
 *   - The stemmer is a naive suffix-removal heuristic (not Snowball/Porter);
 *     adequate for search recall but may over-stem in some cases.
 *   - The index is fully in-memory; rebuild() is required after external data
 *     changes that bypass indexDocument().
 *   - IDF formula uses log(N / df + 1) to avoid division by zero.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'search-index' });

/**
 * In-memory inverted index with TF-IDF ranking and field-level boosting.
 *
 * Invariants:
 *   - invertedIndex: Map<term, Array<{ docId, field, positions, frequency, boost }>>
 *   - documents: Map<docId, metadata> -- every indexed docId has an entry here
 *   - Field boosts are applied multiplicatively to the TF-IDF score
 *
 * Lifecycle: construct (auto-loads from disk) -> indexDocument() ->
 *   search() / suggest() -> save() to persist.
 */
class SearchIndex {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.indexDir = path.join(this.dataDir, 'search-index');
        this.invertedIndex = new Map(); // term -> [{docId, field, positions, score}]
        this.documents = new Map(); // docId -> metadata
        this.fieldBoosts = options.fieldBoosts || {
            title: 3.0,
            name: 2.5,
            summary: 2.0,
            content: 1.0,
            text: 1.0
        };
        this.stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 
            'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
            'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
            'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
            'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
            'de', 'da', 'do', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', // Portuguese
            'um', 'uma', 'uns', 'umas', 'o', 'os', 'as', 'e', 'ou', 'que', 'para', 'com']);
        this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.indexDir = path.join(this.dataDir, 'search-index');
        this.load();
    }

    load() {
        try {
            if (!fs.existsSync(this.indexDir)) {
                fs.mkdirSync(this.indexDir, { recursive: true });
            }
            
            const indexFile = path.join(this.indexDir, 'inverted-index.json');
            const docsFile = path.join(this.indexDir, 'documents.json');
            
            if (fs.existsSync(indexFile)) {
                const data = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
                this.invertedIndex = new Map(Object.entries(data || {}));
            }
            if (fs.existsSync(docsFile)) {
                const data = JSON.parse(fs.readFileSync(docsFile, 'utf8'));
                this.documents = new Map(Object.entries(data || {}));
            }
        } catch (e) {
            this.invertedIndex = new Map();
            this.documents = new Map();
        }
    }

    save() {
        try {
            if (!fs.existsSync(this.indexDir)) {
                fs.mkdirSync(this.indexDir, { recursive: true });
            }
            
            const indexFile = path.join(this.indexDir, 'inverted-index.json');
            const docsFile = path.join(this.indexDir, 'documents.json');
            
            fs.writeFileSync(indexFile, JSON.stringify(Object.fromEntries(this.invertedIndex)));
            fs.writeFileSync(docsFile, JSON.stringify(Object.fromEntries(this.documents)));
        } catch (e) {
            log.warn({ event: 'search_index_save_warning', reason: e.message }, 'Save warning');
        }
    }

    /**
     * Split text into lowercase tokens, removing punctuation, short words (<= 2 chars),
     * and stop words. Preserves accented characters for Portuguese support.
     *
     * @param {string} text
     * @returns {string[]} Filtered token array
     */
    tokenize(text) {
        if (!text || typeof text !== 'string') return [];
        
        return text
            .toLowerCase()
            .replace(/[^\w\sàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !this.stopWords.has(t));
    }

    /**
     * Reduce a word to an approximate root by stripping known suffixes.
     * Requires that the remaining stem is at least 4 characters to avoid
     * over-stemming short words.
     *
     * @param {string} word - Lowercase token
     * @returns {string} Stemmed form (or original if no suffix matched)
     */
    stem(word) {
        // Simple Portuguese/English stemming
        const suffixes = ['mente', 'ção', 'ões', 'ando', 'endo', 'indo', 'ado', 'ido',
            'ing', 'tion', 'sion', 'ness', 'ment', 'able', 'ible', 'ful', 'less', 'ly'];
        
        for (const suffix of suffixes) {
            if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
                return word.slice(0, -suffix.length);
            }
        }
        return word;
    }

    /**
     * Add or update a document in the index. Each field's text is tokenized,
     * stemmed, and recorded in the inverted index with position data and the
     * field's configured boost factor.
     *
     * @param {string} docId - Unique document identifier
     * @param {string} docType - Category for filtering (e.g. 'fact', 'contact')
     * @param {Object} fields - Map of fieldName -> text content to index
     * @param {Object} [metadata={}] - Arbitrary metadata stored alongside the doc
     * @returns {{ indexed: boolean, docId: string, fields: number }}
     */
    indexDocument(docId, docType, fields, metadata = {}) {
        // Store document metadata
        this.documents.set(docId, {
            id: docId,
            type: docType,
            indexedAt: new Date().toISOString(),
            ...metadata
        });

        // Index each field
        for (const [fieldName, fieldValue] of Object.entries(fields)) {
            if (!fieldValue) continue;
            
            const text = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
            const tokens = this.tokenize(text);
            const boost = this.fieldBoosts[fieldName] || 1.0;

            // Track positions
            const positions = {};
            tokens.forEach((token, pos) => {
                const stemmed = this.stem(token);
                if (!positions[stemmed]) positions[stemmed] = [];
                positions[stemmed].push(pos);
            });

            // Add to inverted index
            for (const [term, posArray] of Object.entries(positions)) {
                if (!this.invertedIndex.has(term)) {
                    this.invertedIndex.set(term, []);
                }
                
                const termDocs = this.invertedIndex.get(term);
                
                // Remove existing entry for this doc/field
                const existingIdx = termDocs.findIndex(e => e.docId === docId && e.field === fieldName);
                if (existingIdx >= 0) {
                    termDocs.splice(existingIdx, 1);
                }

                // Add new entry
                termDocs.push({
                    docId,
                    field: fieldName,
                    positions: posArray,
                    frequency: posArray.length,
                    boost
                });
            }
        }

        return { indexed: true, docId, fields: Object.keys(fields).length };
    }

    /**
     * Remove document from index
     */
    removeDocument(docId) {
        this.documents.delete(docId);
        
        for (const [term, docs] of this.invertedIndex) {
            const filtered = docs.filter(d => d.docId !== docId);
            if (filtered.length === 0) {
                this.invertedIndex.delete(term);
            } else {
                this.invertedIndex.set(term, filtered);
            }
        }

        return { removed: true, docId };
    }

    /**
     * Execute a full-text search query. Tokens are stemmed and scored via TF-IDF
     * with field boost multipliers. Results are sorted by descending score.
     *
     * @param {string} query - Free-text search query
     * @param {Object} [options]
     * @param {string} [options.type] - Filter results to a specific docType
     * @param {number} [options.limit=20]
     * @param {number} [options.offset=0]
     * @returns {{ results: Object[], total: number, query: string, tokens: string[] }}
     */
    search(query, options = {}) {
        const tokens = this.tokenize(query);
        if (tokens.length === 0) return { results: [], total: 0 };

        const scores = new Map(); // docId -> score
        const matches = new Map(); // docId -> matched terms

        // Calculate IDF for each term
        const totalDocs = this.documents.size || 1;

        for (const token of tokens) {
            const stemmed = this.stem(token);
            const termDocs = this.invertedIndex.get(stemmed) || [];
            
            // IDF = log(totalDocs / docsWithTerm)
            const idf = Math.log(totalDocs / (termDocs.length || 1) + 1);

            for (const entry of termDocs) {
                const { docId, frequency, boost, field } = entry;
                
                // TF-IDF score with field boost
                const tf = Math.log(1 + frequency);
                const score = tf * idf * boost;

                scores.set(docId, (scores.get(docId) || 0) + score);
                
                if (!matches.has(docId)) matches.set(docId, new Set());
                matches.get(docId).add(stemmed);
            }
        }

        // Build results
        let results = [];
        for (const [docId, score] of scores) {
            const doc = this.documents.get(docId);
            if (!doc) continue;

            // Filter by type if specified
            if (options.type && doc.type !== options.type) continue;

            results.push({
                docId,
                type: doc.type,
                score,
                matchedTerms: Array.from(matches.get(docId) || []),
                metadata: doc
            });
        }

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        // Apply limit
        const limit = options.limit || 20;
        const offset = options.offset || 0;

        return {
            results: results.slice(offset, offset + limit),
            total: results.length,
            query,
            tokens
        };
    }

    /**
     * Return indexed terms that start with the given prefix, sorted by document
     * frequency (most common first). Useful for autocomplete UIs.
     *
     * @param {string} prefix
     * @param {number} [limit=10]
     * @returns {Array<{ term: string, frequency: number }>}
     */
    suggest(prefix, limit = 10) {
        const prefixLower = prefix.toLowerCase();
        const suggestions = [];

        for (const term of this.invertedIndex.keys()) {
            if (term.startsWith(prefixLower)) {
                const docs = this.invertedIndex.get(term);
                suggestions.push({
                    term,
                    frequency: docs.length
                });
            }
        }

        suggestions.sort((a, b) => b.frequency - a.frequency);
        return suggestions.slice(0, limit);
    }

    /**
     * Get index stats
     */
    getStats() {
        let totalPostings = 0;
        for (const docs of this.invertedIndex.values()) {
            totalPostings += docs.length;
        }

        const byType = {};
        for (const doc of this.documents.values()) {
            byType[doc.type] = (byType[doc.type] || 0) + 1;
        }

        return {
            totalDocuments: this.documents.size,
            totalTerms: this.invertedIndex.size,
            totalPostings,
            avgPostingsPerTerm: this.invertedIndex.size > 0 
                ? (totalPostings / this.invertedIndex.size).toFixed(2) 
                : 0,
            byType
        };
    }

    /**
     * Drop the entire index and re-index from a provided document array.
     * Automatically persists to disk when complete.
     *
     * @param {Array<{ id: string, type: string, fields: Object, metadata?: Object }>} documents
     * @returns {{ rebuilt: boolean, documents: number }}
     */
    rebuild(documents) {
        this.invertedIndex.clear();
        this.documents.clear();

        for (const doc of documents) {
            this.indexDocument(doc.id, doc.type, doc.fields, doc.metadata);
        }

        this.save();
        return { rebuilt: true, documents: documents.length };
    }
}

// Singleton
let instance = null;
function getSearchIndex(options = {}) {
    if (!instance) {
        instance = new SearchIndex(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { SearchIndex, getSearchIndex };
