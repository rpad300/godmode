'use strict';

/**
 * TreeSearcher: navigates a document tree index using a single LLM call
 * to find the most relevant sections for a given query.
 *
 * The LLM receives the tree (titles + summaries) and the user query,
 * then selects the most relevant section paths. The searcher extracts
 * the actual content using the character ranges from the tree.
 *
 * Output is formatted for direct injection into RRF fusion alongside
 * vector and graph search results.
 */

const { logger: rootLogger } = require('../logger');
const llmRouter = require('../llm/router');

const log = rootLogger.child({ module: 'tree-searcher' });

const DEFAULT_CONFIG = {
    maxSectionsPerQuery: 5,
    maxContentPerSection: 4000,
    minRelevanceScore: 0.3,
};

class TreeSearcher {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config.docindex };
        this.llmConfig = config;
    }

    /**
     * Search multiple tree indexes for sections relevant to the query.
     * Returns RRF-compatible result objects.
     */
    async search(query, treeIndexes, options = {}) {
        if (!treeIndexes || treeIndexes.length === 0) return [];

        const maxSections = options.maxSections || this.config.maxSectionsPerQuery;
        const treeDescriptions = treeIndexes.map((ti, idx) => {
            const tree = typeof ti.tree_data === 'string' ? JSON.parse(ti.tree_data) : ti.tree_data;
            return {
                index: idx,
                documentId: ti.document_id,
                treeOutline: this._buildOutline(tree, 0),
                tree,
                fullContent: ti.full_content
            };
        });

        const prompt = this._buildNavigationPrompt(query, treeDescriptions, maxSections);

        const result = await llmRouter.routeAndExecute('chat', 'generateText', {
            prompt,
            options: { jsonMode: true }
        }, this.llmConfig);

        if (!result?.success || !result.result) {
            log.warn({ event: 'tree_search_llm_failed' }, 'LLM navigation failed');
            return [];
        }

        const selections = this._parseSelections(result.result);
        return this._extractSections(selections, treeDescriptions, maxSections);
    }

    _buildOutline(node, depth) {
        const indent = '  '.repeat(depth);
        let line = `${indent}- "${node.title}"`;
        if (node.summary) line += `: ${node.summary}`;
        line += ` [chars ${node.charStart || 0}-${node.charEnd || 0}]`;

        const lines = [line];
        if (node.children) {
            for (const child of node.children) {
                lines.push(this._buildOutline(child, depth + 1));
            }
        }
        return lines.join('\n');
    }

    _buildNavigationPrompt(query, treeDescriptions, maxSections) {
        const docs = treeDescriptions.map(td =>
            `=== Document ${td.index} (ID: ${td.documentId}) ===\n${td.treeOutline}`
        ).join('\n\n');

        return `You are a document retrieval specialist. Given a user query and document table-of-contents structures, identify the most relevant sections that would answer the query.

USER QUERY: "${query}"

DOCUMENT STRUCTURES:
${docs}

Select up to ${maxSections} most relevant sections. For each, provide:
- docIndex: which document (number)
- sectionTitle: exact title of the section
- charStart: start character position from the outline
- charEnd: end character position from the outline
- relevance: score from 0.0 to 1.0
- reason: brief explanation of why this section is relevant

Return JSON array:
[{"docIndex": 0, "sectionTitle": "...", "charStart": 0, "charEnd": 1000, "relevance": 0.9, "reason": "..."}]

If no sections are relevant, return an empty array [].`;
    }

    _parseSelections(result) {
        try {
            const text = typeof result === 'string' ? result : result.text || result.content || JSON.stringify(result);
            const match = text.match(/\[[\s\S]*\]/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            log.warn({ event: 'tree_search_parse_error', err: e.message });
        }
        return [];
    }

    _extractSections(selections, treeDescriptions, maxSections) {
        const results = [];

        for (const sel of selections) {
            if (results.length >= maxSections) break;
            if ((sel.relevance || 0) < this.config.minRelevanceScore) continue;

            const td = treeDescriptions[sel.docIndex];
            if (!td || !td.fullContent) continue;

            const charStart = Math.max(0, sel.charStart || 0);
            const charEnd = Math.min(
                td.fullContent.length,
                sel.charEnd || (charStart + this.config.maxContentPerSection)
            );

            let content = td.fullContent.slice(charStart, charEnd);
            if (content.length > this.config.maxContentPerSection) {
                content = content.slice(0, this.config.maxContentPerSection) + '\n[...truncated]';
            }

            results.push({
                id: `tree_${td.documentId}_${charStart}`,
                type: 'tree_section',
                text: content,
                score: sel.relevance || 0.5,
                data: {
                    source_document_id: td.documentId,
                    section_title: sel.sectionTitle || 'Unknown Section',
                    char_range: { start: charStart, end: charEnd },
                    reason: sel.reason || ''
                },
                source: 'tree'
            });
        }

        return results;
    }
}

module.exports = { TreeSearcher };
