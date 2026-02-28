'use strict';

/**
 * DocumentContextBuilder: generates a compact text block summarizing
 * the project's document landscape (titles, sections, summaries)
 * for injection into any LLM prompt.
 *
 * Token-efficient: produces a structured outline rather than full content.
 * Cached per project to avoid repeated DB hits within the same request cycle.
 */

const { logger: rootLogger } = require('../logger');

const log = rootLogger.child({ module: 'doc-context-builder' });

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class DocumentContextBuilder {

    /**
     * Build a compact document context string for prompt injection.
     *
     * @param {Object} storage - Storage instance (compat or supabase)
     * @param {Object} options
     * @param {number} options.maxDocs - Max documents to include (default 15)
     * @param {number} options.maxSectionsPerDoc - Max sections per doc (default 8)
     * @param {number} options.maxChars - Hard char limit for the output (default 3000)
     * @param {boolean} options.skipCache - Bypass cache
     * @returns {Promise<string>} Document context block (empty string if no indexes)
     */
    static async build(storage, options = {}) {
        const {
            maxDocs = 15,
            maxSectionsPerDoc = 8,
            maxChars = 3000,
            skipCache = false
        } = options;

        const cacheKey = storage?.getCurrentProject?.()?.id || storage?.getProjectId?.() || 'default';

        if (!skipCache) {
            const cached = _cache.get(cacheKey);
            if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
                return cached.text;
            }
        }

        try {
            const status = await storage.getTreeIndexStatus();
            if (!status || status.total === 0) {
                _cache.set(cacheKey, { text: '', ts: Date.now() });
                return '';
            }

            const docIds = status.documents.slice(0, maxDocs).map(d => d.document_id);
            const treeIndexes = await storage.getTreeIndexesByDocumentIds(docIds);

            if (treeIndexes.length === 0) {
                _cache.set(cacheKey, { text: '', ts: Date.now() });
                return '';
            }

            const lines = ['PROJECT DOCUMENTS OVERVIEW:'];

            for (const ti of treeIndexes) {
                const tree = typeof ti.tree_data === 'string' ? JSON.parse(ti.tree_data) : ti.tree_data;
                if (!tree) continue;

                const docTitle = tree.title || ti.doc_description || 'Untitled Document';
                const docSummary = tree.summary || '';
                lines.push(`\n- ${docTitle}${docSummary ? ': ' + docSummary : ''}`);

                if (tree.children && tree.children.length > 0) {
                    const sections = tree.children.slice(0, maxSectionsPerDoc);
                    for (const sec of sections) {
                        const secLine = `  * ${sec.title}${sec.summary ? ' -- ' + sec.summary : ''}`;
                        lines.push(secLine);

                        if (sec.children && sec.children.length > 0) {
                            const subsections = sec.children.slice(0, 3);
                            for (const sub of subsections) {
                                lines.push(`    - ${sub.title}`);
                            }
                            if (sec.children.length > 3) {
                                lines.push(`    - ... and ${sec.children.length - 3} more subsections`);
                            }
                        }
                    }
                    if (tree.children.length > maxSectionsPerDoc) {
                        lines.push(`  * ... and ${tree.children.length - maxSectionsPerDoc} more sections`);
                    }
                }
            }

            let text = lines.join('\n');
            if (text.length > maxChars) {
                text = text.slice(0, maxChars - 20) + '\n[...truncated]';
            }

            _cache.set(cacheKey, { text, ts: Date.now() });
            return text;

        } catch (err) {
            log.warn({ event: 'doc_context_build_error', err: err.message }, 'Failed to build document context');
            return '';
        }
    }

    /**
     * Invalidate the cache for a project.
     */
    static invalidateCache(projectId) {
        if (projectId) {
            _cache.delete(projectId);
        } else {
            _cache.clear();
        }
    }
}

module.exports = { DocumentContextBuilder };
