'use strict';

/**
 * TreeGraphSync: syncs document tree sections into the knowledge graph.
 *
 * Level 2 integration:
 *   - Creates DocumentSection nodes for each tree section
 *   - Creates HAS_SECTION edges (Document -> DocumentSection)
 *   - Creates CONTAINS edges (parent section -> child section)
 *   - Maps existing knowledge entities (facts, decisions, etc.) to sections
 *     via text search, creating EXTRACTED_FROM edges
 */

const { logger: rootLogger } = require('../logger');

const log = rootLogger.child({ module: 'tree-graph-sync' });

class TreeGraphSync {
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * Sync tree sections into the graph as first-class nodes.
     * @param {Object} treeIndex - The tree index record from the database
     * @param {Object} graphProvider - The graph provider instance (neo4j/memory)
     * @param {Array} entities - Existing knowledge entities (facts, decisions, etc.)
     */
    async syncToGraph(treeIndex, graphProvider, entities = []) {
        if (!treeIndex || !graphProvider) return { sections: 0, edges: 0 };

        const tree = typeof treeIndex.tree_data === 'string'
            ? JSON.parse(treeIndex.tree_data)
            : treeIndex.tree_data;

        if (!tree || !tree.children || tree.children.length === 0) {
            return { sections: 0, edges: 0 };
        }

        const documentId = treeIndex.document_id;
        const fullContent = treeIndex.full_content || '';

        log.info({ event: 'graph_sync_start', documentId, nodeCount: treeIndex.node_count });

        let sectionCount = 0;
        let edgeCount = 0;

        const flatSections = this._flattenWithParent(tree, null);

        for (const { node, parentId } of flatSections) {
            if (node === tree) continue; // skip root

            const sectionId = `docsec_${documentId}_${node.charStart || 0}`;
            const sectionNode = {
                id: sectionId,
                type: 'DocumentSection',
                title: node.title || 'Untitled Section',
                summary: node.summary || '',
                charStart: node.charStart || 0,
                charEnd: node.charEnd || 0,
                documentId,
                depth: node._depth || 0
            };

            try {
                await graphProvider.addNode(sectionNode);
                sectionCount++;

                if (parentId) {
                    await graphProvider.addEdge({
                        source: parentId,
                        target: sectionId,
                        type: 'CONTAINS',
                        weight: 1.0
                    });
                    edgeCount++;
                } else {
                    await graphProvider.addEdge({
                        source: `doc_${documentId}`,
                        target: sectionId,
                        type: 'HAS_SECTION',
                        weight: 1.0
                    });
                    edgeCount++;
                }
            } catch (err) {
                log.warn({ event: 'graph_sync_node_error', sectionId, err: err.message });
            }
        }

        if (entities.length > 0 && fullContent) {
            const entityEdges = this._mapEntitiesToSections(
                entities, flatSections, fullContent, documentId
            );
            for (const edge of entityEdges) {
                try {
                    await graphProvider.addEdge(edge);
                    edgeCount++;
                } catch (err) {
                    log.warn({ event: 'graph_sync_edge_error', err: err.message });
                }
            }
        }

        log.info({ event: 'graph_sync_complete', documentId, sectionCount, edgeCount });
        return { sections: sectionCount, edges: edgeCount };
    }

    /**
     * Flatten the tree into an array with parent references for edge creation.
     */
    _flattenWithParent(node, parentId, depth = 0) {
        node._depth = depth;
        const sectionId = parentId === null
            ? null  // root node, will be skipped
            : `docsec_${node._documentId || ''}_${node.charStart || 0}`;

        const result = [{ node, parentId }];

        if (node.children) {
            const myId = parentId === null
                ? null  // children of root get HAS_SECTION from doc
                : sectionId;
            for (const child of node.children) {
                child._documentId = node._documentId;
                result.push(...this._flattenWithParent(child, myId, depth + 1));
            }
        }

        return result;
    }

    /**
     * Map knowledge entities to sections by searching for entity content
     * within the full document text, then checking which section's char range
     * contains the match position.
     */
    _mapEntitiesToSections(entities, flatSections, fullContent, documentId) {
        const edges = [];
        const sections = flatSections
            .filter(f => f.node.charStart !== undefined && f.node !== flatSections[0]?.node)
            .map(f => ({
                id: `docsec_${documentId}_${f.node.charStart || 0}`,
                charStart: f.node.charStart || 0,
                charEnd: f.node.charEnd || 0
            }));

        if (sections.length === 0) return edges;

        const contentLower = fullContent.toLowerCase();
        const seenPairs = new Set();

        for (const entity of entities) {
            const searchText = this._getEntitySearchText(entity);
            if (!searchText || searchText.length < 10) continue;

            const pos = contentLower.indexOf(searchText.toLowerCase().slice(0, 200));
            if (pos === -1) continue;

            for (const sec of sections) {
                if (pos >= sec.charStart && pos < sec.charEnd) {
                    const pairKey = `${entity.id}:${sec.id}`;
                    if (!seenPairs.has(pairKey)) {
                        seenPairs.add(pairKey);
                        edges.push({
                            source: entity.id || `entity_${entity.type}_${entity.content?.slice(0, 20)}`,
                            target: sec.id,
                            type: 'EXTRACTED_FROM',
                            weight: 0.8
                        });
                    }
                    break; // first matching section
                }
            }
        }

        return edges;
    }

    _getEntitySearchText(entity) {
        if (entity.content) return entity.content;
        if (entity.text) return entity.text;
        if (entity.title) return entity.title;
        if (entity.name) return entity.name;
        return '';
    }
}

module.exports = { TreeGraphSync };
