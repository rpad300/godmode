'use strict';

/**
 * TreeIndexBuilder: builds a hierarchical table-of-contents tree index
 * for long documents.
 *
 * Two-strategy approach:
 *   1. Fast path (markdown-native): detects # headers, builds tree from
 *      the heading structure, then uses a single LLM call to generate
 *      one-line summaries for each section.
 *   2. LLM fallback: for headerless documents, sends the first/last
 *      chunks to the LLM and asks it to produce the tree structure.
 */

const { logger: rootLogger } = require('../logger');
const llmRouter = require('../llm/router');

const log = rootLogger.child({ module: 'tree-index-builder' });

const HEADER_RE = /^(#{1,6})\s+(.+)$/;

const DEFAULT_CONFIG = {
    minChars: 20000,
    maxTreeDepth: 5,
    maxSectionsPerLevel: 25,
    summaryBatchSize: 30,
    headerlessPreviewChars: 12000,
};

class TreeIndexBuilder {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config.docindex };
        this.llmConfig = config;
    }

    /**
     * Build tree and persist it.
     * Designed to be called fire-and-forget (errors are caught).
     */
    async buildAndStore(documentId, content, storage, options = {}) {
        const startMs = Date.now();
        log.info({ event: 'tree_build_start', documentId, chars: content.length });

        try {
            const tree = await this.buildTree(content, options);
            if (!tree || !tree.children || tree.children.length === 0) {
                log.warn({ event: 'tree_build_empty', documentId }, 'No tree structure found');
                return null;
            }

            const nodeCount = this._countNodes(tree);
            const routing = tree._routing || {};
            delete tree._routing;

            const saved = await storage.saveTreeIndex(documentId, tree, content, {
                description: tree.title || null,
                totalChars: content.length,
                nodeCount,
                model: routing.model || 'unknown',
                provider: routing.provider || 'unknown',
                version: '1.0'
            });

            const elapsed = Date.now() - startMs;
            log.info({ event: 'tree_build_complete', documentId, nodeCount, elapsed });
            return saved;
        } catch (err) {
            log.error({ event: 'tree_build_error', documentId, err: err.message }, 'Tree build failed');
            throw err;
        }
    }

    /**
     * Build the tree structure from document content.
     */
    async buildTree(content, options = {}) {
        const lines = content.split('\n');
        const headers = this._extractHeaders(lines);

        if (headers.length >= 3) {
            return this._buildFromHeaders(lines, headers, content, options);
        }

        return this._buildFromLLM(content, options);
    }

    // ==================== Fast Path: Markdown Headers ====================

    _extractHeaders(lines) {
        const headers = [];
        let charPos = 0;

        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(HEADER_RE);
            if (match) {
                headers.push({
                    level: match[1].length,
                    title: match[2].trim(),
                    lineIndex: i,
                    charStart: charPos
                });
            }
            charPos += lines[i].length + 1; // +1 for \n
        }

        return headers;
    }

    _buildFromHeaders(lines, headers, fullContent, options) {
        const totalChars = fullContent.length;

        for (let i = 0; i < headers.length; i++) {
            const next = headers[i + 1];
            headers[i].charEnd = next ? next.charStart - 1 : totalChars;
        }

        const root = {
            title: 'Document',
            summary: '',
            charStart: 0,
            charEnd: totalChars,
            children: []
        };

        const stack = [{ node: root, level: 0 }];

        for (const h of headers) {
            if (h.level > this.config.maxTreeDepth) continue;

            const node = {
                title: h.title,
                summary: '',
                charStart: h.charStart,
                charEnd: h.charEnd,
                children: []
            };

            while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
                stack.pop();
            }

            const parent = stack[stack.length - 1].node;
            if (parent.children.length < this.config.maxSectionsPerLevel) {
                parent.children.push(node);
            }

            stack.push({ node, level: h.level });
        }

        return this._enrichWithSummaries(root, fullContent, options);
    }

    async _enrichWithSummaries(root, fullContent, options) {
        const flatNodes = this._flattenTree(root).filter(n => n !== root);
        if (flatNodes.length === 0) return root;

        const sections = flatNodes.map(n => ({
            title: n.title,
            preview: fullContent.slice(n.charStart, Math.min(n.charStart + 500, n.charEnd)).trim()
        }));

        const batches = [];
        for (let i = 0; i < sections.length; i += this.config.summaryBatchSize) {
            batches.push(sections.slice(i, i + this.config.summaryBatchSize));
        }

        let routing = {};
        for (const batch of batches) {
            const prompt = this._buildSummaryPrompt(batch);
            const result = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                options: { jsonMode: true }
            }, this.llmConfig);

            if (result?.success && result.result) {
                routing = { model: result.model, provider: result.provider };
                const summaries = this._parseSummaries(result.result, batch.length);
                const offset = sections.indexOf(batch[0]);
                for (let j = 0; j < summaries.length && j < batch.length; j++) {
                    if (flatNodes[offset + j]) {
                        flatNodes[offset + j].summary = summaries[j];
                    }
                }
            }
        }

        root.summary = `Document with ${flatNodes.length} sections, ${fullContent.length} characters`;
        root._routing = routing;
        return root;
    }

    _buildSummaryPrompt(sections) {
        const sectionList = sections.map((s, i) =>
            `[${i}] "${s.title}"\n${s.preview}`
        ).join('\n\n');

        return `You are a document indexing assistant. For each section below, write a brief 1-2 sentence summary that captures its key content. Return a JSON array of strings, one summary per section.

Sections:
${sectionList}

Return JSON: ["summary for section 0", "summary for section 1", ...]`;
    }

    _parseSummaries(result, expectedCount) {
        try {
            const text = typeof result === 'string' ? result : result.text || result.content || JSON.stringify(result);
            const match = text.match(/\[[\s\S]*\]/);
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch (e) {
            log.warn({ event: 'summary_parse_error', err: e.message });
        }
        return new Array(expectedCount).fill('');
    }

    // ==================== LLM Fallback: Headerless Documents ====================

    async _buildFromLLM(content, options) {
        const previewChars = this.config.headerlessPreviewChars;
        const head = content.slice(0, previewChars);
        const tail = content.length > previewChars * 2
            ? content.slice(-previewChars)
            : '';

        const prompt = `You are a document structure analyzer. Given the beginning and end of a long document, produce a hierarchical table of contents.

DOCUMENT START (first ${previewChars} chars):
${head}

${tail ? `DOCUMENT END (last ${previewChars} chars):\n${tail}` : ''}

Total document length: ${content.length} characters.

Return a JSON object with this structure:
{
  "title": "Document title or topic",
  "summary": "Brief overall summary",
  "children": [
    {
      "title": "Section title",
      "summary": "Brief section summary",
      "charStart": <approximate start character position>,
      "charEnd": <approximate end character position>,
      "children": []
    }
  ]
}

Rules:
- Estimate charStart/charEnd positions based on where content appears
- Maximum depth: ${this.config.maxTreeDepth} levels
- Maximum sections per level: ${this.config.maxSectionsPerLevel}
- Include children arrays (can be empty) for all nodes
- Return ONLY valid JSON`;

        const result = await llmRouter.routeAndExecute('processing', 'generateText', {
            prompt,
            options: { jsonMode: true }
        }, this.llmConfig);

        if (!result?.success || !result.result) {
            log.warn({ event: 'llm_tree_build_failed' }, 'LLM tree generation failed');
            return null;
        }

        try {
            const text = typeof result.result === 'string'
                ? result.result
                : result.result.text || result.result.content || JSON.stringify(result.result);
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) return null;

            const tree = JSON.parse(match[0]);
            tree.charStart = 0;
            tree.charEnd = content.length;
            tree._routing = { model: result.model, provider: result.provider };

            this._clampCharRanges(tree, content.length);
            return tree;
        } catch (e) {
            log.error({ event: 'llm_tree_parse_error', err: e.message });
            return null;
        }
    }

    // ==================== Helpers ====================

    _flattenTree(node) {
        const result = [node];
        if (node.children) {
            for (const child of node.children) {
                result.push(...this._flattenTree(child));
            }
        }
        return result;
    }

    _countNodes(node) {
        let count = 1;
        if (node.children) {
            for (const child of node.children) {
                count += this._countNodes(child);
            }
        }
        return count;
    }

    _clampCharRanges(node, totalChars) {
        node.charStart = Math.max(0, Math.min(node.charStart || 0, totalChars));
        node.charEnd = Math.max(node.charStart, Math.min(node.charEnd || totalChars, totalChars));
        if (node.children) {
            for (const child of node.children) {
                this._clampCharRanges(child, totalChars);
            }
        }
    }
}

module.exports = { TreeIndexBuilder };
