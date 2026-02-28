/**
 * Purpose:
 *   API routes for the Document Tree Index system. Enables generation,
 *   retrieval, deletion, search, and status of hierarchical document indexes.
 *
 * Routes:
 *   POST   /api/docindex/generate       - Generate tree index for a document
 *   GET    /api/docindex/:documentId     - Get tree index for a specific document
 *   DELETE /api/docindex/:documentId     - Delete tree index for a document
 *   POST   /api/docindex/search          - Search tree indexes for relevant sections
 *   GET    /api/docindex/status          - Get tree index coverage status
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const { TreeIndexBuilder, TreeSearcher } = require('../../docindex');

function isDocindexRoute(pathname) {
    return pathname.startsWith('/api/docindex');
}

/**
 * Handle all docindex-related routes.
 * @param {Object} ctx - Context object with req, res, pathname, storage, config
 * @returns {Promise<boolean>} true if route was handled
 */
async function handleDocindex(ctx) {
    const { req, res, pathname, storage, config } = ctx;
    const log = getLogger().child({ module: 'docindex' });

    if (!isDocindexRoute(pathname)) {
        return false;
    }

    // POST /api/docindex/generate - Build tree index for a document
    if (pathname === '/api/docindex/generate' && req.method === 'POST') {
        const body = await parseBody(req);
        const { documentId } = body;

        if (!documentId) {
            jsonResponse(res, { error: 'documentId is required', success: false }, 400);
            return true;
        }

        const existing = await storage.getTreeIndex(documentId);
        if (existing && !body.force) {
            jsonResponse(res, {
                success: true,
                message: 'Tree index already exists. Use force:true to rebuild.',
                treeIndex: {
                    id: existing.id,
                    nodeCount: existing.node_count,
                    totalChars: existing.total_chars,
                    createdAt: existing.created_at
                }
            });
            return true;
        }

        const doc = await storage.getDocumentById(documentId);
        if (!doc) {
            jsonResponse(res, { error: 'Document not found', success: false }, 404);
            return true;
        }

        let content = null;
        if (existing?.full_content) {
            content = existing.full_content;
        } else {
            content = await storage.getDocumentFullContent(documentId);
        }

        if (!content || content.length < 100) {
            jsonResponse(res, { error: 'Document has no extractable content', success: false }, 400);
            return true;
        }

        const builder = new TreeIndexBuilder(config);
        builder.buildAndStore(documentId, content, storage).catch(err => {
            log.error({ event: 'tree_generate_bg_error', documentId, err: err.message });
        });

        jsonResponse(res, {
            success: true,
            message: 'Tree index generation started',
            documentId,
            contentLength: content.length
        }, 202);
        return true;
    }

    // GET /api/docindex/status - Get tree index coverage
    if (pathname === '/api/docindex/status' && req.method === 'GET') {
        const status = await storage.getTreeIndexStatus();
        jsonResponse(res, { success: true, ...status });
        return true;
    }

    // POST /api/docindex/search - Search tree indexes
    if (pathname === '/api/docindex/search' && req.method === 'POST') {
        const body = await parseBody(req);
        const { query, documentIds, maxSections } = body;

        if (!query) {
            jsonResponse(res, { error: 'query is required', success: false }, 400);
            return true;
        }

        let treeIndexes;
        if (documentIds && documentIds.length > 0) {
            treeIndexes = await storage.getTreeIndexesByDocumentIds(documentIds);
        } else {
            const status = await storage.getTreeIndexStatus();
            const allDocIds = status.documents.map(d => d.document_id);
            treeIndexes = allDocIds.length > 0
                ? await storage.getTreeIndexesByDocumentIds(allDocIds)
                : [];
        }

        if (treeIndexes.length === 0) {
            jsonResponse(res, { success: true, results: [], message: 'No tree indexes found' });
            return true;
        }

        const searcher = new TreeSearcher(config);
        const results = await searcher.search(query, treeIndexes, { maxSections });

        jsonResponse(res, { success: true, results, count: results.length });
        return true;
    }

    // GET /api/docindex/:documentId - Get tree index for a document
    const getMatch = pathname.match(/^\/api\/docindex\/([a-f0-9-]+)$/);
    if (getMatch && req.method === 'GET') {
        const documentId = getMatch[1];
        const treeIndex = await storage.getTreeIndex(documentId);

        if (!treeIndex) {
            jsonResponse(res, { error: 'No tree index for this document', success: false }, 404);
            return true;
        }

        jsonResponse(res, {
            success: true,
            treeIndex: {
                id: treeIndex.id,
                documentId: treeIndex.document_id,
                treeData: treeIndex.tree_data,
                description: treeIndex.doc_description,
                totalChars: treeIndex.total_chars,
                nodeCount: treeIndex.node_count,
                model: treeIndex.model,
                provider: treeIndex.provider,
                version: treeIndex.version,
                createdAt: treeIndex.created_at,
                updatedAt: treeIndex.updated_at
            }
        });
        return true;
    }

    // POST /api/docindex/backfill - Generate tree indexes for all eligible existing docs
    if (pathname === '/api/docindex/backfill' && req.method === 'POST') {
        const body = await parseBody(req);
        const minChars = body.minChars || config.docindex?.minChars || 20000;
        const force = body.force || false;

        const docs = await storage.getDocuments();
        const eligible = (docs || []).filter(d =>
            (!d.doc_type || d.doc_type === 'document') && d.id
        );

        if (eligible.length === 0) {
            jsonResponse(res, { success: true, message: 'No eligible documents found', queued: 0 });
            return true;
        }

        const existing = await storage.getTreeIndexStatus();
        const existingDocIds = new Set(existing.documents.map(d => d.document_id));

        let queued = 0;
        let skipped = 0;

        const builder = new TreeIndexBuilder(config);

        for (const doc of eligible) {
            if (!force && existingDocIds.has(doc.id)) {
                skipped++;
                continue;
            }

            const content = await storage.getDocumentFullContent(doc.id);
            if (!content || content.length < minChars) {
                skipped++;
                continue;
            }

            builder.buildAndStore(doc.id, content, storage).catch(err => {
                log.warn({ event: 'backfill_doc_failed', documentId: doc.id, err: err.message });
            });
            queued++;
        }

        jsonResponse(res, {
            success: true,
            message: `Backfill started: ${queued} documents queued, ${skipped} skipped`,
            queued,
            skipped,
            totalEligible: eligible.length
        }, 202);
        return true;
    }

    // DELETE /api/docindex/:documentId - Delete tree index
    const delMatch = pathname.match(/^\/api\/docindex\/([a-f0-9-]+)$/);
    if (delMatch && req.method === 'DELETE') {
        const documentId = delMatch[1];
        await storage.deleteTreeIndex(documentId);
        jsonResponse(res, { success: true, message: 'Tree index deleted' });
        return true;
    }

    return false;
}

module.exports = { handleDocindex, isDocindexRoute };
