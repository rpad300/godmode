/**
 * Advanced features routes (from ./advanced module)
 * Extracted from server.js
 *
 * Handles:
 * - POST /api/search, search/index - Full-text search (getSearchIndex)
 * - GET /api/search/suggest, search/stats
 * - POST /api/export, import - Export/import (getDataExportImport)
 * - GET /api/export/list
 * - GET /api/cache/stats, POST /api/cache/clear (getAdvancedCache)
 * - POST /api/compress, GET /api/compression/stats
 * - GET /api/docs, /api/docs/openapi.json
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

function isAdvancedRoute(pathname) {
    return pathname === '/api/search' || pathname.startsWith('/api/search/') ||
           pathname === '/api/export' || pathname === '/api/export/list' || pathname === '/api/import' ||
           pathname === '/api/cache/stats' || pathname === '/api/cache/clear' ||
           pathname === '/api/compress' || pathname === '/api/compression/stats' ||
           pathname === '/api/docs' || pathname === '/api-docs' || pathname === '/api/docs/openapi.json';
}

async function handleAdvanced(ctx) {
    const { req, res, pathname, storage } = ctx;

    if (!storage) return false;

    const dataDir = storage.getProjectDataDir();
    const urlParsed = parseUrl(req.url);

    // POST /api/search
    if (pathname === '/api/search' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { getSearchIndex } = require('../../advanced');
            const searchIndex = getSearchIndex({ dataDir });
            const results = searchIndex.search(body.query, { type: body.type, limit: body.limit });
            jsonResponse(res, { ok: true, ...results });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/search/index
    if (pathname === '/api/search/index' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { getSearchIndex } = require('../../advanced');
            const searchIndex = getSearchIndex({ dataDir });
            const result = searchIndex.indexDocument(body.docId, body.docType, body.fields, body.metadata);
            searchIndex.save();
            jsonResponse(res, { ok: true, ...result });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/search/suggest
    if (pathname === '/api/search/suggest' && req.method === 'GET') {
        try {
            const prefix = urlParsed.query?.q || '';
            const { getSearchIndex } = require('../../advanced');
            const searchIndex = getSearchIndex({ dataDir });
            const suggestions = searchIndex.suggest(prefix);
            jsonResponse(res, { ok: true, suggestions });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/search/stats
    if (pathname === '/api/search/stats' && req.method === 'GET') {
        try {
            const { getSearchIndex } = require('../../advanced');
            const searchIndex = getSearchIndex({ dataDir });
            const stats = searchIndex.getStats();
            jsonResponse(res, { ok: true, stats });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/export
    if (pathname === '/api/export' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { getDataExportImport } = require('../../advanced');
            const exportImport = getDataExportImport({ dataDir, storage });
            const result = await exportImport.exportProject({ includeEmbeddings: body.includeEmbeddings });
            jsonResponse(res, { ok: true, ...result });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/import
    if (pathname === '/api/import' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { getDataExportImport } = require('../../advanced');
            const exportImport = getDataExportImport({ dataDir, storage });
            const result = await exportImport.importProject(body.data || body.file, {
                merge: body.merge,
                importOntology: body.importOntology
            });
            jsonResponse(res, { ok: true, ...result });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/export/list
    if (pathname === '/api/export/list' && req.method === 'GET') {
        try {
            const { getDataExportImport } = require('../../advanced');
            const exportImport = getDataExportImport({ dataDir });
            const exports = exportImport.listExports();
            jsonResponse(res, { ok: true, exports });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/cache/stats (advanced cache)
    if (pathname === '/api/cache/stats' && req.method === 'GET') {
        try {
            const { getAdvancedCache } = require('../../advanced');
            const cache = getAdvancedCache({ dataDir });
            const stats = cache.getStats();
            jsonResponse(res, { ok: true, stats });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/cache/clear (advanced cache)
    if (pathname === '/api/cache/clear' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { getAdvancedCache } = require('../../advanced');
            const cache = getAdvancedCache({ dataDir });
            let cleared;
            if (body.pattern) cleared = cache.invalidateByPattern(body.pattern);
            else if (body.tag) cleared = cache.invalidateByTag(body.tag);
            else cleared = cache.clear();
            jsonResponse(res, { ok: true, cleared });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/compress
    if (pathname === '/api/compress' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { getDataCompression } = require('../../advanced');
            const compression = getDataCompression();
            const result = compression.compress(body.data);
            jsonResponse(res, { ok: true, ...result });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/compression/stats
    if (pathname === '/api/compression/stats' && req.method === 'GET') {
        try {
            const { getDataCompression } = require('../../advanced');
            const compression = getDataCompression();
            const stats = compression.getStats();
            jsonResponse(res, { ok: true, stats });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/docs, /api-docs
    if ((pathname === '/api/docs' || pathname === '/api-docs') && req.method === 'GET') {
        try {
            const { getAPIDocumentation } = require('../../advanced');
            const apiDocs = getAPIDocumentation({ baseUrl: `http://${req.headers.host}` });
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(apiDocs.generateHTML());
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/docs/openapi.json
    if (pathname === '/api/docs/openapi.json' && req.method === 'GET') {
        try {
            const { getAPIDocumentation } = require('../../advanced');
            const apiDocs = getAPIDocumentation({ baseUrl: `http://${req.headers.host}` });
            jsonResponse(res, apiDocs.generateOpenAPI());
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleAdvanced, isAdvancedRoute };
