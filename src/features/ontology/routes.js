/**
 * Ontology API
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/ontology - Summary
 * - GET /api/ontology/entities, relations, schema, stats, sync/status
 * - POST /api/ontology/validate, extract, enrich, entity-type, relation-type
 * - Ontology Agent: suggestions, analyze-graph, approve/reject/enrich, auto-approve
 * - Sync: force
 * - Worker: status, trigger, log
 * - Jobs: list, toggle
 * - Extractor: extract-from-graph, validate-compliance, merge, unused-types, cleanup, diff
 * - infer-relationships
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

function isOntologyRoute(pathname) {
    return pathname === '/api/ontology' || pathname.startsWith('/api/ontology/');
}

async function handleOntology(ctx) {
    const { req, res, pathname, storage, config, supabase } = ctx;
    const log = getLogger().child({ module: 'ontology' });
    if (!isOntologyRoute(pathname)) return false;

    const graphProvider = storage?.getGraphProvider?.();
    if (graphProvider && typeof graphProvider.ensureConnected === 'function') {
        const connected = await graphProvider.ensureConnected();
        if (!connected) {
            const log = getLogger().child({ module: 'ontology' });
            log.debug({ event: 'graph_auto_connect_failed' }, 'Could not auto-connect graph at start of ontology request');
        }
    }
    const dataDir = storage?.getProjectDataDir?.();

    // GET /api/ontology
    if (pathname === '/api/ontology' && req.method === 'GET') {
        const { getOntologyManager } = require('../../ontology');
        const ontology = getOntologyManager();
        jsonResponse(res, { ok: true, ...ontology.export() });
        return true;
    }

    // GET /api/ontology/entities
    if (pathname === '/api/ontology/entities' && req.method === 'GET') {
        const { getOntologyManager } = require('../../ontology');
        const ontology = getOntologyManager();
        const entityTypes = ontology.getEntityTypes().map(name => ({
            name,
            ...ontology.getEntityVisualInfo(name),
            properties: Object.keys(ontology.getEntityProperties(name)),
            searchable: ontology.getSearchableProperties(name),
            required: ontology.getRequiredProperties(name),
            sharedEntity: ontology.isSharedEntity(name)
        }));
        const sharedTypes = ontology.getSharedEntityTypes();
        const projectTypes = ontology.getProjectEntityTypes();
        jsonResponse(res, {
            ok: true,
            entityTypes,
            summary: {
                total: entityTypes.length,
                sharedCount: sharedTypes.length,
                projectCount: projectTypes.length,
                sharedTypes,
                projectTypes
            }
        });
        return true;
    }

    // GET /api/ontology/relations
    if (pathname === '/api/ontology/relations' && req.method === 'GET') {
        const { getOntologyManager } = require('../../ontology');
        const ontology = getOntologyManager();
        const relationTypes = ontology.getRelationTypes().map(name => ({
            name,
            ...ontology.getRelationType(name)
        }));
        jsonResponse(res, { ok: true, relationTypes });
        return true;
    }

    // POST /api/ontology/validate
    if (pathname === '/api/ontology/validate' && req.method === 'POST') {
        const body = await parseBody(req);
        const { getOntologyManager } = require('../../ontology');
        const ontology = getOntologyManager();
        if (!body.type || !body.entity) {
            jsonResponse(res, { ok: false, error: 'type and entity are required' }, 400);
            return true;
        }
        const validation = ontology.validateEntity(body.type, body.entity);
        jsonResponse(res, { ok: validation.valid, ...validation });
        return true;
    }

    // POST /api/ontology/extract
    if (pathname === '/api/ontology/extract' && req.method === 'POST') {
        const body = await parseBody(req);
        const { getRelationInference } = require('../../ontology');
        const inference = getRelationInference();
        if (!body.text) {
            jsonResponse(res, { ok: false, error: 'text is required' }, 400);
            return true;
        }
        const results = await inference.extractFromText(body.text, {
            existingEntities: body.existingEntities || []
        });
        jsonResponse(res, { ok: true, ...results });
        return true;
    }

    // POST /api/ontology/enrich
    if (pathname === '/api/ontology/enrich' && req.method === 'POST') {
        const body = await parseBody(req);
        const { getEmbeddingEnricher } = require('../../ontology');
        const enricher = getEmbeddingEnricher();
        if (!body.type || !body.entity) {
            jsonResponse(res, { ok: false, error: 'type and entity are required' }, 400);
            return true;
        }
        const enrichedText = enricher.enrichEntity(body.type, body.entity, body.context || {});
        jsonResponse(res, { ok: true, enrichedText });
        return true;
    }

    // === Ontology Agent & Extended routes (require storage, config) ===
    if (!storage || !config) {
        return false;
    }

    try {
        // GET /api/ontology/suggestions
        if (pathname === '/api/ontology/suggestions' && req.method === 'GET') {
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            await agent.loadSuggestionsFromSupabase();
            const suggestions = agent.getPendingSuggestions();
            jsonResponse(res, { ok: true, suggestions, stats: agent.getStats() });
            return true;
        }

        // POST /api/ontology/analyze-graph
        if (pathname === '/api/ontology/analyze-graph' && req.method === 'POST') {
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            const result = await agent.analyzeGraphForSuggestions();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/ontology/suggestions/:id/approve
        const approveMatch = pathname.match(/^\/api\/ontology\/suggestions\/([^/]+)\/approve$/);
        if (approveMatch && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            await agent.loadSuggestionsFromSupabase();
            const result = await agent.approveSuggestion(approveMatch[1], body);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // POST /api/ontology/suggestions/:id/reject
        const rejectMatch = pathname.match(/^\/api\/ontology\/suggestions\/([^/]+)\/reject$/);
        if (rejectMatch && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            await agent.loadSuggestionsFromSupabase();
            const result = await agent.rejectSuggestion(rejectMatch[1], body.reason);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // POST /api/ontology/suggestions/:id/enrich
        const enrichMatch = pathname.match(/^\/api\/ontology\/suggestions\/([^/]+)\/enrich$/);
        if (enrichMatch && req.method === 'POST') {
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            await agent.loadSuggestionsFromSupabase();
            const result = await agent.enrichSuggestionWithAI(enrichMatch[1]);
            jsonResponse(res, { ok: result.success || !result.error, ...result });
            return true;
        }

        // GET /api/ontology/schema
        if (pathname === '/api/ontology/schema' && req.method === 'GET') {
            const { getOntologyManager } = require('../../ontology');
            const manager = getOntologyManager();
            const schema = manager.getSchema();
            jsonResponse(res, { ok: true, schema });
            return true;
        }

        // POST /api/ontology/entity-type
        if (pathname === '/api/ontology/entity-type' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyManager } = require('../../ontology');
            const manager = getOntologyManager();
            const result = await manager.addEntityType(body.name, {
                description: body.description,
                properties: body.properties || { name: { type: 'string', required: true } }
            });
            jsonResponse(res, { ok: result, message: result ? 'Entity type added' : 'Failed' });
            return true;
        }

        // POST /api/ontology/relation-type
        if (pathname === '/api/ontology/relation-type' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyManager } = require('../../ontology');
            const manager = getOntologyManager();
            const result = await manager.addRelationType(body.name, {
                from: body.from || '*',
                to: body.to || '*',
                description: body.description
            });
            jsonResponse(res, { ok: result, message: result ? 'Relation type added' : 'Failed' });
            return true;
        }

        // GET /api/ontology/stats
        if (pathname === '/api/ontology/stats' && req.method === 'GET') {
            try {
                if (!graphProvider?.connected) {
                    jsonResponse(res, { ok: true, stats: null, message: 'Graph not connected' });
                    return true;
                }
                const { getOntologyAgent } = require('../../ontology');
                const agent = getOntologyAgent({
                    graphProvider,
                    storage,
                    llmConfig: config.llm,
                    appConfig: config,
                    dataDir
                });
                const stats = await agent.getTypeUsageStats();
                jsonResponse(res, { ok: true, stats });
            } catch (e) {
                log.warn({ event: 'ontology_stats_warning', reason: e.message }, 'Stats warning');
                jsonResponse(res, { ok: true, stats: null, error: e.message });
            }
            return true;
        }

        // GET /api/ontology/sync/status
        if (pathname === '/api/ontology/sync/status' && req.method === 'GET') {
            try {
                const { getOntologySync } = require('../../ontology');
                const sync = getOntologySync({
                    supabase: supabase?.getAdminClient?.(),
                    graphProvider,
                    storage
                });
                const status = sync.getStatus ? sync.getStatus() : {
                    isListening: false,
                    syncInProgress: false,
                    lastSyncAt: null,
                    pendingChanges: 0,
                    ontologySource: null,
                    graphConnected: !!graphProvider?.connected
                };
                jsonResponse(res, { ok: true, status });
            } catch (e) {
                log.warn({ event: 'ontology_sync_status_warning', reason: e.message }, 'Sync status warning');
                jsonResponse(res, {
                    ok: true, status: {
                        isListening: false,
                        syncInProgress: false,
                        lastSyncAt: null,
                        pendingChanges: 0,
                        ontologySource: null,
                        graphConnected: false
                    }
                });
            }
            return true;
        }

        // POST /api/ontology/sync/force
        if (pathname === '/api/ontology/sync/force' && req.method === 'POST') {
            const { getOntologySync } = require('../../ontology');
            const sync = getOntologySync({
                supabase: supabase?.getAdminClient?.(),
                graphProvider,
                storage
            });
            const result = await sync.forceSync();
            jsonResponse(res, result);
            return true;
        }

        // POST /api/ontology/analyze
        if (pathname === '/api/ontology/analyze' && req.method === 'POST') {
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            const result = await agent.analyzeWithLLM();
            jsonResponse(res, { ok: !result.error, ...result });
            return true;
        }

        // POST /api/ontology/suggestions/auto-approve
        if (pathname === '/api/ontology/suggestions/auto-approve' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyAgent } = require('../../ontology');
            const agent = getOntologyAgent({
                graphProvider,
                storage,
                llmConfig: config.llm,
                appConfig: config,
                dataDir
            });
            const result = await agent.autoApproveHighConfidence(body.threshold || 0.85);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/ontology/changes
        if (pathname === '/api/ontology/changes' && req.method === 'GET') {
            try {
                if (!storage.getOntologyChanges) {
                    jsonResponse(res, { ok: true, changes: [], message: 'Feature not available' });
                    return true;
                }
                const parsed = parseUrl(req.url);
                const limitParam = parseInt(parsed.query.limit);
                const changes = await storage.getOntologyChanges({
                    targetType: parsed.query.targetType,
                    targetName: parsed.query.targetName,
                    limit: isNaN(limitParam) ? 50 : limitParam
                });
                jsonResponse(res, { ok: true, changes: changes || [] });
            } catch (e) {
                log.warn({ event: 'ontology_changes_warning', reason: e.message }, 'Changes warning');
                jsonResponse(res, { ok: true, changes: [], error: e.message });
            }
            return true;
        }

        // POST /api/ontology/migrate
        if (pathname === '/api/ontology/migrate' && req.method === 'POST') {
            const { getOntologyManager } = require('../../ontology');
            const manager = getOntologyManager();
            manager.setStorage(storage);
            const result = await manager.migrateToSupabase();
            jsonResponse(res, result);
            return true;
        }

        // GET /api/ontology/worker/status
        if (pathname === '/api/ontology/worker/status' && req.method === 'GET') {
            try {
                const { getOntologyBackgroundWorker } = require('../../ontology');
                const worker = getOntologyBackgroundWorker({
                    graphProvider,
                    storage,
                    llmConfig: config.llm,
                    appConfig: config,
                    dataDir
                });
                const status = worker.getStatus();
                const stats = worker.getStats();
                jsonResponse(res, { ok: true, status, stats });
            } catch (e) {
                log.warn({ event: 'ontology_worker_status_warning', reason: e.message }, 'Worker status warning');
                jsonResponse(res, {
                    ok: true,
                    status: {
                        isRunning: false,
                        hasPendingAnalysis: false,
                        lastRun: {},
                        graphConnected: false,
                        llmConfigured: false,
                        thresholds: {}
                    },
                    stats: {
                        totalExecutions: 0,
                        byType: {},
                        byStatus: { completed: 0, failed: 0 },
                        avgDuration: 0
                    }
                });
            }
            return true;
        }

        // POST /api/ontology/worker/trigger
        if (pathname === '/api/ontology/worker/trigger' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyBackgroundWorker } = require('../../ontology');
            const worker = getOntologyBackgroundWorker({
                graphProvider,
                storage,
                llmConfig: config.llm,
                dataDir
            });
            const type = body.type || 'full';
            let result;
            switch (type) {
                case 'full': result = await worker.runFullAnalysis(body.config || {}); break;
                case 'inference': result = await worker.runInferenceRules(body.config || {}); break;
                case 'dedup': result = await worker.checkDuplicates(body.config || {}); break;
                case 'auto_approve': result = await worker.autoApprove(body.config || {}); break;
                case 'gaps': result = await worker.checkForGaps(); break;
                default: result = { error: `Unknown analysis type: ${type}` };
            }
            jsonResponse(res, { ok: !result.error, ...result });
            return true;
        }

        // GET /api/ontology/worker/log
        if (pathname === '/api/ontology/worker/log' && req.method === 'GET') {
            try {
                const { getOntologyBackgroundWorker } = require('../../ontology');
                const worker = getOntologyBackgroundWorker({
                    graphProvider,
                    storage,
                    llmConfig: config.llm,
                    appConfig: config,
                    dataDir
                });
                const parsed = parseUrl(req.url);
                const limitParam = parseInt(parsed.query.limit);
                const log = worker.getExecutionLog({
                    type: parsed.query.type,
                    status: parsed.query.status,
                    limit: isNaN(limitParam) ? 20 : limitParam
                });
                jsonResponse(res, { ok: true, log: log || [] });
            } catch (e) {
                log.warn({ event: 'ontology_worker_log_warning', reason: e.message }, 'Worker log warning');
                jsonResponse(res, { ok: true, log: [] });
            }
            return true;
        }

        // GET /api/ontology/jobs
        if (pathname === '/api/ontology/jobs' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('../../advanced');
                const scheduler = getScheduledJobs({ dataDir });
                const allJobs = scheduler.getJobs() || [];
                const ontologyJobs = allJobs.filter(j => j.type?.startsWith('ontology_'));
                jsonResponse(res, { ok: true, jobs: ontologyJobs });
            } catch (e) {
                log.warn({ event: 'ontology_jobs_warning', reason: e.message }, 'Jobs warning');
                jsonResponse(res, { ok: true, jobs: [] });
            }
            return true;
        }

        // POST /api/ontology/jobs/:id/toggle
        const jobToggleMatch = pathname.match(/^\/api\/ontology\/jobs\/([^/]+)\/toggle$/);
        if (jobToggleMatch && req.method === 'POST') {
            const jobId = jobToggleMatch[1];
            const body = await parseBody(req);
            const { getScheduledJobs } = require('../../advanced');
            const scheduler = getScheduledJobs({ dataDir });
            const job = scheduler.getJob(jobId);
            if (!job) {
                jsonResponse(res, { ok: false, error: 'Job not found' }, 404);
                return true;
            }
            const enabled = body.enabled !== undefined ? body.enabled : !job.enabled;
            const updated = scheduler.updateJob(jobId, { enabled });
            jsonResponse(res, { ok: true, job: updated });
            return true;
        }

        // GET /api/ontology/extract-from-graph
        if (pathname === '/api/ontology/extract-from-graph' && req.method === 'GET') {
            if (!graphProvider?.connected) {
                const result = await graphProvider?.connect?.() || { error: 'No graph provider' };
                jsonResponse(res, { ok: false, error: `Graph not connected: ${result.error || 'Unknown error'}` });
                return true;
            }
            const { getOntologyExtractor } = require('../../ontology');
            const extractor = getOntologyExtractor({ graphProvider });
            const result = await extractor.extractFromGraph();
            jsonResponse(res, result);
            return true;
        }

        // GET /api/ontology/validate-compliance
        if (pathname === '/api/ontology/validate-compliance' && req.method === 'GET') {
            if (!graphProvider?.connected) {
                jsonResponse(res, { ok: false, valid: false, score: 0, issues: [{ type: 'error', message: 'Graph not connected' }], stats: {} });
                return true;
            }
            const { getOntologyExtractor } = require('../../ontology');
            const extractor = getOntologyExtractor({ graphProvider });
            const result = await extractor.validateCompliance();
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/ontology/merge
        if (pathname === '/api/ontology/merge' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyExtractor, getOntologyManager } = require('../../ontology');
            const extractor = getOntologyExtractor({ graphProvider });
            const manager = getOntologyManager();
            let ontologyToMerge = body.ontology;
            if (!ontologyToMerge) {
                const extracted = await extractor.extractFromGraph();
                if (!extracted.ok) {
                    jsonResponse(res, { ok: false, error: 'Failed to extract ontology' }, 400);
                    return true;
                }
                ontologyToMerge = extracted.ontology;
            }
            const { merged, changes } = extractor.mergeOntologies(ontologyToMerge, {
                mergeProperties: body.mergeProperties !== false,
                mergeEndpoints: body.mergeEndpoints !== false
            });
            if (body.save) {
                await manager.updateSchema(merged, null, 'Merged with extracted ontology');
            }
            jsonResponse(res, { ok: true, merged, changes, saved: !!body.save });
            return true;
        }

        // GET /api/ontology/unused-types
        if (pathname === '/api/ontology/unused-types' && req.method === 'GET') {
            if (!graphProvider?.connected) {
                jsonResponse(res, { ok: true, entities: [], relations: [], message: 'Graph not connected' });
                return true;
            }
            const { getOntologyExtractor } = require('../../ontology');
            const extractor = getOntologyExtractor({ graphProvider });
            const unused = await extractor.findUnusedTypes();
            jsonResponse(res, { ok: true, unused });
            return true;
        }

        // POST /api/ontology/cleanup
        if (pathname === '/api/ontology/cleanup' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyExtractor, getOntologyManager } = require('../../ontology');
            const extractor = getOntologyExtractor();
            const manager = getOntologyManager();
            const schema = manager.getSchema();
            let result = { discardedEntities: [], discardedRelations: [] };
            if (body.discardEntitiesWithoutRelations) {
                const { cleaned, discarded } = extractor.discardEntitiesWithoutRelations(schema);
                result.discardedEntities = discarded;
                if (body.save) {
                    await manager.updateSchema(cleaned, null, 'Discarded entities without relations');
                }
            }
            if (body.discardRelationsWithoutEntities) {
                const currentSchema = manager.getSchema();
                const { cleaned, discarded } = extractor.discardRelationsWithoutEntities(currentSchema);
                result.discardedRelations = discarded;
                if (body.save) {
                    await manager.updateSchema(cleaned, null, 'Discarded relations without entities');
                }
            }
            jsonResponse(res, { ok: true, ...result, saved: !!body.save });
            return true;
        }

        // GET /api/ontology/diff
        if (pathname === '/api/ontology/diff' && req.method === 'GET') {
            if (!graphProvider?.connected) {
                jsonResponse(res, { ok: false, error: 'Graph not connected' });
                return true;
            }
            const { getOntologyExtractor, getOntologyManager } = require('../../ontology');
            const extractor = getOntologyExtractor({ graphProvider });
            const manager = getOntologyManager();
            const extracted = await extractor.extractFromGraph();
            if (!extracted.ok) {
                jsonResponse(res, { ok: false, error: 'Failed to extract ontology' });
                return true;
            }
            const currentSchema = manager.getSchema();
            const diff = extractor.diffOntologies(currentSchema, extracted.ontology);
            jsonResponse(res, { ok: true, diff, extractedOntology: extracted.ontology });
            return true;
        }

        // POST /api/ontology/infer-relationships
        if (pathname === '/api/ontology/infer-relationships' && req.method === 'POST') {
            const { getRelationshipInferrer } = require('../../ontology');
            const inferrer = getRelationshipInferrer({ storage });
            log.debug({ event: 'ontology_infer_start' }, 'Starting AI relationship inference');
            const result = await inferrer.inferAllRelationships();
            if (result.ok && result.results?.inferred?.total > 0) {
                log.debug({ event: 'ontology_infer_sync' }, 'Syncing new relationships to graph');
                await storage.syncToGraph();
            }
            jsonResponse(res, result);
            return true;
        }
    } catch (error) {
        jsonResponse(res, { ok: false, error: error.message }, 500);
        return true;
    }

    return false;
}

module.exports = { handleOntology, isOntologyRoute };
