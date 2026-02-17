/**
 * Purpose:
 *   Platform optimization and operational tooling API. Covers graph analytics,
 *   entity deduplication, exports, auto-tagging, caching, query planning,
 *   health monitoring, webhooks, backups, NER, and context optimization.
 *
 * Responsibilities:
 *   - Graph analytics and actionable insights
 *   - Entity duplicate resolution using LLM-powered matching
 *   - Auto-generated project summaries and periodic digests
 *   - Smart deduplication across all storage entity types
 *   - Multi-format graph export (JSON, Cypher, GraphML, CSV, knowledge base)
 *   - Auto-tagging of documents via LLM
 *   - Feedback loop for correction tracking
 *   - Webhook endpoint management (register, delete, test)
 *   - Incremental sync stats, system health monitoring, memory pool stats
 *   - Semantic cache management, query planning and optimization
 *   - Graph indexing, query suggestions, usage analytics, rate limiting stats
 *   - Multi-language Named Entity Recognition (NER)
 *   - RAG context optimization (token-aware context selection)
 *   - Backup creation and restore
 *
 * Key dependencies:
 *   - ../../optimizations: all optimization modules (getGraphAnalytics, getEntityResolver,
 *     getAutoSummary, getSmartDedup, getExportGraph, getAutoTagging, getFeedbackLoop,
 *     getWebhooks, getIncrementalSync, getHealthMonitor, getMemoryPool, getSemanticCache,
 *     getQueryPlanner, getGraphIndexing, getQuerySuggestions, getUsageAnalytics,
 *     getRateLimiter, getMultiLanguageNER, getContextOptimizer, getAutoBackup)
 *   - storage.getGraphProvider(): graph database access
 *   - config.llm: LLM configuration for AI-powered features
 *
 * Side effects:
 *   - Backup creation writes to the filesystem
 *   - Export writes files to disk (POST export with filename)
 *   - Cache clear removes in-memory semantic cache entries
 *   - Index creation modifies graph database schema
 *   - Feedback corrections are persisted to local data directory
 *   - Webhook registration and removal modify persistent webhook store
 *
 * Notes:
 *   - /api/webhooks routes here serve optimizations-specific webhooks; they may overlap
 *     with a separate webhooks feature if one exists -- this handler runs as a fallback
 *   - /api/backups routes provide graph/storage-level backup, distinct from sync backups
 *   - All routes are wrapped in a try/catch returning { ok: false, error } on failure
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

function isOptimizationsRoute(pathname) {
    return pathname.startsWith('/api/optimizations/') ||
           pathname === '/api/optimizations' ||
           pathname === '/api/webhooks' ||
           pathname.match(/^\/api\/webhooks\/[^/]+(\/test)?$/) ||
           pathname === '/api/backups' ||
           pathname.match(/^\/api\/backups\/[^/]+\/restore$/);
}

/**
 * Handle optimizations routes
 * @param {object} ctx - Context with req, res, pathname, storage, config
 * @returns {Promise<boolean>} - true if handled
 */
async function handleOptimizations(ctx) {
    const { req, res, pathname, storage, config } = ctx;

    if (!isOptimizationsRoute(pathname)) return false;

    const graphProvider = storage.getGraphProvider();
    const dataDir = storage.getProjectDataDir();

    try {
        // GET /api/optimizations/analytics
        if (pathname === '/api/optimizations/analytics' && req.method === 'GET') {
            const { getGraphAnalytics } = require('../../optimizations');
            const analytics = getGraphAnalytics({ graphProvider });
            const result = await analytics.getAnalytics();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/optimizations/insights
        if (pathname === '/api/optimizations/insights' && req.method === 'GET') {
            const { getGraphAnalytics } = require('../../optimizations');
            const analytics = getGraphAnalytics({ graphProvider });
            const insights = await analytics.getInsights();
            jsonResponse(res, { ok: true, insights });
            return true;
        }

        // POST /api/optimizations/resolve-duplicates
        if (pathname === '/api/optimizations/resolve-duplicates' && req.method === 'POST') {
            const { getEntityResolver } = require('../../optimizations');
            const resolver = getEntityResolver({ llmConfig: config.llm, appConfig: config });
            const result = await resolver.resolveDuplicates(graphProvider);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/optimizations/summary
        if (pathname === '/api/optimizations/summary' && req.method === 'GET') {
            const { getAutoSummary } = require('../../optimizations');
            const summary = getAutoSummary({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config
            });
            const result = await summary.generateProjectSummary();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/optimizations/digest
        if (pathname === '/api/optimizations/digest' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const period = parsedUrl.query.period || 'daily';
            const { getAutoSummary } = require('../../optimizations');
            const summary = getAutoSummary({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config
            });
            const result = await summary.generateDigest(period);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/optimizations/dedup
        if (pathname === '/api/optimizations/dedup' && req.method === 'POST') {
            const { getSmartDedup } = require('../../optimizations');
            const dedup = getSmartDedup({ storage, appConfig: config });
            const result = await dedup.runFullDedup();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/optimizations/export
        if (pathname === '/api/optimizations/export' && req.method === 'POST') {
            const body = await parseBody(req);
            const format = body.format || 'json';
            const { getExportGraph } = require('../../optimizations');
            const exporter = getExportGraph({ graphProvider, storage });
            const result = await exporter.saveExport(format, body.filename);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/optimizations/export/:format
        const exportMatch = pathname.match(/^\/api\/optimizations\/export\/(\w+)$/);
        if (exportMatch && req.method === 'GET') {
            const format = exportMatch[1];
            const { getExportGraph } = require('../../optimizations');
            const exporter = getExportGraph({ graphProvider, storage });
            let result;
            switch (format) {
                case 'json': result = await exporter.exportToJSON(); break;
                case 'cypher': result = await exporter.exportToCypher(); break;
                case 'graphml': result = await exporter.exportToGraphML(); break;
                case 'csv': result = await exporter.exportToCSV(); break;
                case 'knowledge': result = exporter.exportKnowledgeBase(); break;
                default: result = { error: 'Unknown format' };
            }
            jsonResponse(res, { ok: !result.error, ...result });
            return true;
        }

        // POST /api/optimizations/tag
        if (pathname === '/api/optimizations/tag' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getAutoTagging } = require('../../optimizations');
            const tagger = getAutoTagging({ llmConfig: config.llm, appConfig: config });
            const result = await tagger.tagDocument(body);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/optimizations/feedback
        if (pathname === '/api/optimizations/feedback' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getFeedbackLoop } = require('../../optimizations');
            const feedback = getFeedbackLoop({ dataDir });
            const id = feedback.recordCorrection(body);
            jsonResponse(res, { ok: true, id });
            return true;
        }

        // GET /api/optimizations/feedback/stats
        if (pathname === '/api/optimizations/feedback/stats' && req.method === 'GET') {
            const { getFeedbackLoop } = require('../../optimizations');
            const feedback = getFeedbackLoop({ dataDir });
            const stats = feedback.getStats();
            jsonResponse(res, { ok: true, ...stats });
            return true;
        }

        // GET /api/webhooks - List webhook endpoints (optimizations)
        if (pathname === '/api/webhooks' && req.method === 'GET') {
            const { getWebhooks } = require('../../optimizations');
            const webhooks = getWebhooks({ dataDir });
            jsonResponse(res, { ok: true, endpoints: webhooks.getEndpoints() });
            return true;
        }

        // POST /api/webhooks - Register webhook endpoint (optimizations)
        if (pathname === '/api/webhooks' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getWebhooks } = require('../../optimizations');
            const webhooks = getWebhooks({ dataDir });
            const endpoint = webhooks.registerEndpoint(body);
            jsonResponse(res, { ok: true, endpoint });
            return true;
        }

        // DELETE /api/webhooks/:id (optimizations - runs if features/webhooks doesn't handle)
        const webhookDeleteMatch = pathname.match(/^\/api\/webhooks\/(\w+)$/);
        if (webhookDeleteMatch && req.method === 'DELETE') {
            const { getWebhooks } = require('../../optimizations');
            const webhooks = getWebhooks({ dataDir });
            const success = webhooks.removeEndpoint(webhookDeleteMatch[1]);
            jsonResponse(res, { ok: success });
            return true;
        }

        // POST /api/webhooks/:id/test (optimizations)
        const webhookTestMatch = pathname.match(/^\/api\/webhooks\/(\w+)\/test$/);
        if (webhookTestMatch && req.method === 'POST') {
            const { getWebhooks } = require('../../optimizations');
            const webhooks = getWebhooks({ dataDir });
            const result = await webhooks.testEndpoint(webhookTestMatch[1]);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // GET /api/optimizations/sync-stats
        if (pathname === '/api/optimizations/sync-stats' && req.method === 'GET') {
            const { getIncrementalSync } = require('../../optimizations');
            const sync = getIncrementalSync({ dataDir });
            jsonResponse(res, { ok: true, ...sync.getStats() });
            return true;
        }

        // GET /api/optimizations/health
        if (pathname === '/api/optimizations/health' && req.method === 'GET') {
            const { getHealthMonitor } = require('../../optimizations');
            const monitor = getHealthMonitor({ graphProvider, storage });
            const health = await monitor.getHealth();
            jsonResponse(res, { ok: true, ...health });
            return true;
        }

        // GET /api/optimizations/health/summary
        if (pathname === '/api/optimizations/health/summary' && req.method === 'GET') {
            const { getHealthMonitor } = require('../../optimizations');
            const monitor = getHealthMonitor({ graphProvider, storage });
            jsonResponse(res, { ok: true, ...monitor.getSummary() });
            return true;
        }

        // GET /api/optimizations/memory
        if (pathname === '/api/optimizations/memory' && req.method === 'GET') {
            const { getMemoryPool } = require('../../optimizations');
            const memory = getMemoryPool();
            jsonResponse(res, { ok: true, ...memory.getStats() });
            return true;
        }

        // GET /api/optimizations/cache/stats
        if (pathname === '/api/optimizations/cache/stats' && req.method === 'GET') {
            const { getSemanticCache } = require('../../optimizations');
            const cache = getSemanticCache({ llmConfig: config.llm, appConfig: config });
            jsonResponse(res, { ok: true, ...cache.getStats() });
            return true;
        }

        // POST /api/optimizations/cache/clear
        if (pathname === '/api/optimizations/cache/clear' && req.method === 'POST') {
            const { getSemanticCache } = require('../../optimizations');
            const cache = getSemanticCache({ llmConfig: config.llm, appConfig: config });
            cache.clear();
            jsonResponse(res, { ok: true, message: 'Cache cleared' });
            return true;
        }

        // POST /api/optimizations/query/analyze
        if (pathname === '/api/optimizations/query/analyze' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getQueryPlanner } = require('../../optimizations');
            const planner = getQueryPlanner({ graphProvider });
            const analysis = planner.analyze(body.query);
            const optimized = planner.optimize(body.query);
            jsonResponse(res, { ok: true, analysis, optimized });
            return true;
        }

        // GET /api/optimizations/query/slow
        if (pathname === '/api/optimizations/query/slow' && req.method === 'GET') {
            const { getQueryPlanner } = require('../../optimizations');
            const planner = getQueryPlanner();
            jsonResponse(res, { ok: true, slowQueries: planner.getSlowQueries() });
            return true;
        }

        // POST /api/optimizations/indexes/create
        if (pathname === '/api/optimizations/indexes/create' && req.method === 'POST') {
            const { getGraphIndexing } = require('../../optimizations');
            const indexing = getGraphIndexing({ graphProvider });
            const result = await indexing.createDefaultIndexes();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/optimizations/indexes
        if (pathname === '/api/optimizations/indexes' && req.method === 'GET') {
            const { getGraphIndexing } = require('../../optimizations');
            const indexing = getGraphIndexing({ graphProvider });
            const result = await indexing.listIndexes();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/optimizations/suggestions
        if (pathname === '/api/optimizations/suggestions' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const partial = parsedUrl.query.q || '';
            const { getQuerySuggestions } = require('../../optimizations');
            const suggestions = getQuerySuggestions({ dataDir });
            jsonResponse(res, { ok: true, suggestions: suggestions.getSuggestions(partial) });
            return true;
        }

        // GET /api/optimizations/suggestions/popular
        if (pathname === '/api/optimizations/suggestions/popular' && req.method === 'GET') {
            const { getQuerySuggestions } = require('../../optimizations');
            const suggestions = getQuerySuggestions({ dataDir });
            jsonResponse(res, { ok: true, ...suggestions.getInsights() });
            return true;
        }

        // GET /api/backups
        if (pathname === '/api/backups' && req.method === 'GET') {
            const { getAutoBackup } = require('../../optimizations');
            const backup = getAutoBackup({ graphProvider, storage });
            jsonResponse(res, { ok: true, backups: backup.listBackups() });
            return true;
        }

        // POST /api/backups
        if (pathname === '/api/backups' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getAutoBackup } = require('../../optimizations');
            const backup = getAutoBackup({ graphProvider, storage });
            const result = await backup.createBackup(body.name);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // POST /api/backups/:name/restore
        const backupRestoreMatch = pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
        if (backupRestoreMatch && req.method === 'POST') {
            const { getAutoBackup } = require('../../optimizations');
            const backup = getAutoBackup({ graphProvider, storage });
            const result = await backup.restore(backupRestoreMatch[1]);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // GET /api/optimizations/usage
        if (pathname === '/api/optimizations/usage' && req.method === 'GET') {
            const { getUsageAnalytics } = require('../../optimizations');
            const analytics = getUsageAnalytics({ dataDir });
            jsonResponse(res, { ok: true, ...analytics.getSummary() });
            return true;
        }

        // GET /api/optimizations/usage/export
        if (pathname === '/api/optimizations/usage/export' && req.method === 'GET') {
            const { getUsageAnalytics } = require('../../optimizations');
            const analytics = getUsageAnalytics({ dataDir });
            jsonResponse(res, { ok: true, ...analytics.exportData() });
            return true;
        }

        // GET /api/optimizations/ratelimit/stats
        if (pathname === '/api/optimizations/ratelimit/stats' && req.method === 'GET') {
            const { getRateLimiter } = require('../../optimizations');
            const limiter = getRateLimiter();
            jsonResponse(res, { ok: true, ...limiter.getStats() });
            return true;
        }

        // POST /api/optimizations/ner
        if (pathname === '/api/optimizations/ner' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getMultiLanguageNER } = require('../../optimizations');
            const ner = getMultiLanguageNER({ llmConfig: config.llm });
            const result = await ner.extract(body.text, { language: body.language });
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/optimizations/context/optimize
        if (pathname === '/api/optimizations/context/optimize' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getContextOptimizer } = require('../../optimizations');
            const optimizer = getContextOptimizer({ llmConfig: config.llm, appConfig: config });
            const result = await optimizer.optimize(body.contexts, {
                query: body.query,
                maxTokens: body.maxTokens
            });
            jsonResponse(res, { ok: true, ...result });
            return true;
        }
    } catch (error) {
        jsonResponse(res, { ok: false, error: error.message }, 500);
        return true;
    }

    return false;
}

module.exports = { handleOptimizations };
