/**
 * Graph Database API
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/graph/providers, config, status, bookmarks, queries, insights, list
 * - POST /api/graph/connect, test, sync, indexes, embeddings
 * - DELETE /api/graph/:graphName, /api/graph/delete/:graphName
 * - POST /api/graph/cleanup-orphans, switch, sync-multi
 * - GET /api/graph/projects, multi-stats
 * - GET /api/cross-project/people, /api/cross-project/connections
 * - GET /api/person/:name/projects
 * - GET /api/graph/falkordb-browser, sync/status, list-all
 * - POST /api/graph/sync/full, sync/cleanup, cleanup-duplicates, sync-projects, query
 * - GET /api/graph/nodes, relationships
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

function isGraphRoute(pathname) {
    return pathname.startsWith('/api/graph/') || pathname === '/api/graph' ||
           pathname.startsWith('/api/cross-project/') ||
           pathname.match(/^\/api\/person\/[^/]+\/projects$/);
}

async function handleGraph(ctx) {
    const { req, res, pathname, storage, config, supabase, saveConfig } = ctx;
    const log = getLogger().child({ module: 'graph' });
    if (!isGraphRoute(pathname)) return false;

    // GET /api/graph/providers
    if (pathname === '/api/graph/providers' && req.method === 'GET') {
        const GraphFactory = require('../../graph/GraphFactory');
        const providers = GraphFactory.getProviders();
        jsonResponse(res, { providers });
        return true;
    }

    // GET /api/graph/config
    if (pathname === '/api/graph/config' && req.method === 'GET') {
        const currentProject = storage.getCurrentProject();
        const projectId = currentProject?.id;
        let graphConfig = null;
        if (supabase && projectId) {
            try {
                const { data: projectConfig } = await supabase
                    .from('project_config')
                    .select('graph_config')
                    .eq('project_id', projectId)
                    .single();
                if (projectConfig?.graph_config) {
                    graphConfig = projectConfig.graph_config;
                }
            } catch (e) { /* fall back to local */ }
        }
        if (!graphConfig) {
            graphConfig = config.graph || { enabled: false };
        }
        const safeConfig = { ...graphConfig };
        if (safeConfig.falkordb) {
            safeConfig.falkordb = { ...safeConfig.falkordb };
            delete safeConfig.falkordb.password;
            safeConfig.falkordb.passwordSet = !!(process.env.FALKORDB_PASSWORD || process.env.FAKORDB_PASSWORD);
        }
        jsonResponse(res, {
            ok: true,
            config: safeConfig,
            source: graphConfig === config.graph ? 'local' : 'supabase'
        });
        return true;
    }

    // GET /api/graph/status
    if (pathname === '/api/graph/status' && req.method === 'GET') {
        try {
            const graphStats = await storage.getGraphStats();
            jsonResponse(res, graphStats);
        } catch (error) {
            jsonResponse(res, {
                ok: true,
                enabled: false,
                connected: false,
                nodes: 0,
                relationships: 0,
                nodeCount: 0,
                edgeCount: 0,
                stats: { nodeCount: 0, edgeCount: 0, communities: 0 },
                message: 'Graph database not connected'
            });
        }
        return true;
    }

    // GET /api/graph/bookmarks
    if (pathname === '/api/graph/bookmarks' && req.method === 'GET') {
        jsonResponse(res, { ok: true, bookmarks: [] });
        return true;
    }

    // POST /api/graph/bookmarks
    if (pathname === '/api/graph/bookmarks' && req.method === 'POST') {
        const body = await parseBody(req);
        jsonResponse(res, {
            ok: true,
            bookmark: {
                id: `bookmark_${Date.now()}`,
                ...body,
                created_at: new Date().toISOString()
            }
        });
        return true;
    }

    // GET /api/graph/queries
    if (pathname === '/api/graph/queries' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const limit = parseInt(parsedUrl.query.limit) || 20;
        jsonResponse(res, { ok: true, queries: [], total: 0 });
        return true;
    }

    // POST /api/graph/queries
    if (pathname === '/api/graph/queries' && req.method === 'POST') {
        const body = await parseBody(req);
        jsonResponse(res, {
            ok: true,
            query: {
                id: `query_${Date.now()}`,
                ...body,
                created_at: new Date().toISOString()
            }
        });
        return true;
    }

    // GET /api/graph/insights
    if (pathname === '/api/graph/insights' && req.method === 'GET') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            jsonResponse(res, {
                ok: true,
                insights: [{
                    type: 'status',
                    title: 'Graph Not Connected',
                    description: 'Connect to graph database to see insights.',
                    importance: 'medium'
                }]
            });
            return true;
        }
        try {
            const nodesResult = await graphProvider.findNodes(null, {}, { limit: 1000 });
            const relsResult = await graphProvider.findRelationships({ limit: 1000 });
            const nodes = nodesResult?.nodes || nodesResult || [];
            const relationships = relsResult?.relationships || relsResult || [];

            const nodesByType = {};
            const relationshipsByType = {};
            for (const node of nodes) {
                const type = node.type || node.labels?.[0] || 'Unknown';
                nodesByType[type] = (nodesByType[type] || 0) + 1;
            }
            for (const rel of relationships) {
                const type = rel.type || 'Unknown';
                relationshipsByType[type] = (relationshipsByType[type] || 0) + 1;
            }

            const nodeCount = nodes.length;
            const edgeCount = relationships.length;
            const maxEdges = nodeCount * (nodeCount - 1);
            const density = maxEdges > 0 ? (edgeCount / maxEdges) : 0;
            const avgDegree = nodeCount > 0 ? (edgeCount * 2 / nodeCount) : 0;

            const insights = [];
            insights.push({
                type: 'summary',
                title: 'Graph Overview',
                description: `Your knowledge graph contains ${nodeCount} nodes and ${edgeCount} relationships across ${Object.keys(nodesByType).length} entity types.`,
                importance: 'high'
            });

            const topTypes = Object.entries(nodesByType).sort((a, b) => b[1] - a[1]).slice(0, 3);
            if (topTypes.length > 0) {
                insights.push({
                    type: 'entities',
                    title: 'Most Common Entities',
                    description: topTypes.map(([t, c]) => `${t}: ${c}`).join(', '),
                    importance: 'medium'
                });
            }

            const topRels = Object.entries(relationshipsByType).sort((a, b) => b[1] - a[1]).slice(0, 3);
            if (topRels.length > 0) {
                insights.push({
                    type: 'relationships',
                    title: 'Top Relationship Types',
                    description: topRels.map(([t, c]) => `${t}: ${c}`).join(', '),
                    importance: 'medium'
                });
            }

            if (density < 0.01) {
                insights.push({
                    type: 'recommendation',
                    title: 'Low Connectivity',
                    description: `Graph density is ${(density * 100).toFixed(2)}%. Consider adding more relationships between entities to improve knowledge discovery.`,
                    importance: 'medium'
                });
            } else if (density > 0.1) {
                insights.push({
                    type: 'metric',
                    title: 'Well Connected',
                    description: `Graph density is ${(density * 100).toFixed(2)}%. Your knowledge graph has good connectivity for discovery.`,
                    importance: 'low'
                });
            }

            insights.push({
                type: 'metric',
                title: 'Average Connections',
                description: `Each node has an average of ${avgDegree.toFixed(1)} connections. ${avgDegree < 2 ? 'Consider linking more entities.' : 'Good connectivity!'}`,
                importance: avgDegree < 2 ? 'medium' : 'low'
            });

            if (nodesByType['Person'] > 0) {
                const personCount = nodesByType['Person'];
                const worksWithCount = relationshipsByType['WORKS_WITH'] || 0;
                if (personCount > 5 && worksWithCount < personCount / 2) {
                    insights.push({
                        type: 'recommendation',
                        title: 'Team Relationships',
                        description: `Found ${personCount} people but only ${worksWithCount} WORKS_WITH relationships. Run sync to auto-detect team connections.`,
                        importance: 'low'
                    });
                }
            }

            jsonResponse(res, { ok: true, insights });
        } catch (error) {
            log.warn({ event: 'graph_insights_error', reason: error?.message }, 'Error getting insights');
            jsonResponse(res, {
                ok: true,
                insights: [{
                    type: 'error',
                    title: 'Analysis Error',
                    description: error.message || 'Failed to analyze graph',
                    importance: 'high'
                }]
            });
        }
        return true;
    }

    // GET /api/graph/list
    if (pathname === '/api/graph/list' && req.method === 'GET') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            jsonResponse(res, { ok: false, error: 'Not connected to graph database', graphs: [] });
            return true;
        }
        try {
            const result = await graphProvider.listGraphs();
            const projects = storage.getProjects();
            const baseGraphName = config.graph?.baseGraphName || config.graph?.graphName?.split('_')[0] || 'godmode';
            const graphsWithProjects = (result.graphs || []).map(graphName => {
                const parts = graphName.split('_');
                const projectId = parts.length > 1 ? parts[parts.length - 1] : null;
                const project = projectId ? projects.find(p => p.id === projectId) : null;
                return {
                    graphName,
                    projectId,
                    projectName: project?.name || null,
                    isOrphan: graphName.startsWith(baseGraphName) && projectId && !project,
                    isCurrentProject: projectId === storage.getCurrentProject()?.id
                };
            });
            jsonResponse(res, {
                ok: true,
                graphs: graphsWithProjects,
                totalGraphs: graphsWithProjects.length,
                orphanGraphs: graphsWithProjects.filter(g => g.isOrphan).length,
                baseGraphName
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message, graphs: [] });
        }
        return true;
    }

    // DELETE /api/graph/:graphName
    const deleteGraphMatch = pathname.match(/^\/api\/graph\/([^/]+)$/);
    if (deleteGraphMatch && req.method === 'DELETE') {
        const graphName = decodeURIComponent(deleteGraphMatch[1]);
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            jsonResponse(res, { ok: false, error: 'Not connected to graph database' });
            return true;
        }
        const currentProject = storage.getCurrentProject();
        const currentGraphName = `${config.graph?.baseGraphName || 'godmode'}_${currentProject?.id}`;
        if (graphName === currentGraphName || graphName === config.graph?.graphName) {
            jsonResponse(res, { ok: false, error: 'Cannot delete the current project\'s graph' }, 400);
            return true;
        }
        try {
            const result = await graphProvider.deleteGraph(graphName);
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message });
        }
        return true;
    }

    // POST /api/graph/cleanup-orphans
    if (pathname === '/api/graph/cleanup-orphans' && req.method === 'POST') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            jsonResponse(res, { ok: false, error: 'Not connected to graph database' });
            return true;
        }
        try {
            const result = await graphProvider.listGraphs();
            const projects = storage.getProjects();
            const baseGraphName = config.graph?.baseGraphName || config.graph?.graphName?.split('_')[0] || 'godmode';
            const currentGraphName = config.graph?.graphName;
            const deletedGraphs = [];
            const errors = [];

            for (const graphName of (result.graphs || [])) {
                if (!graphName.startsWith(baseGraphName + '_')) continue;
                const projectId = graphName.replace(baseGraphName + '_', '');
                const project = projects.find(p => p.id === projectId);
                if (!project && graphName !== currentGraphName) {
                    try {
                        await graphProvider.deleteGraph(graphName);
                        deletedGraphs.push(graphName);
                        log.debug({ event: 'graph_orphan_deleted', graphName }, 'Deleted orphan graph');
                    } catch (e) {
                        errors.push({ graphName, error: e.message });
                    }
                }
            }
            jsonResponse(res, {
                ok: true,
                deletedGraphs,
                deletedCount: deletedGraphs.length,
                errors: errors.length > 0 ? errors : undefined
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message });
        }
        return true;
    }

    // POST /api/graph/connect
    if (pathname === '/api/graph/connect' && req.method === 'POST') {
        const body = await parseBody(req);
        const currentProject = storage.getCurrentProject();
        const projectId = currentProject?.id || 'default';
        const baseGraphName = body.graphName || 'godmode';
        const projectGraphName = body.graphName || `${baseGraphName}_${projectId}`;
        const graphConfig = {
            enabled: true,
            provider: 'supabase',
            graphName: projectGraphName,
            baseGraphName,
            autoConnect: true
        };
        const result = await storage.initGraph(graphConfig);
        if (result.ok) {
            config.graph = graphConfig;
            saveConfig(config);
            if (supabase && projectId !== 'default') {
                try {
                    const graphConfigForSupabase = {
                        enabled: true, provider: 'supabase',
                        graphName: graphConfig.graphName,
                        baseGraphName: graphConfig.baseGraphName,
                        autoConnect: true
                    };
                    await supabase.from('project_config')
                        .update({ graph_config: graphConfigForSupabase })
                        .eq('project_id', projectId);
                    log.debug({ event: 'graph_config_saved', projectId }, 'Config saved to Supabase');
                } catch (supaErr) {
                    log.warn({ event: 'graph_config_supabase_failed', reason: supaErr.message }, 'Could not save to Supabase');
                }
            }
            log.debug({ event: 'graph_connected', projectGraphName, projectName: currentProject?.name || 'default' }, 'Connected to graph');
        }
        jsonResponse(res, result);
        return true;
    }

    // POST /api/graph/test
    if (pathname === '/api/graph/test' && req.method === 'POST') {
        const body = await parseBody(req);
        const GraphFactory = require('../../graph/GraphFactory');
        let password = body.password;
        let username = body.username;
        if (supabase && supabase.isConfigured && supabase.isConfigured()) {
            const client = supabase.getAdminClient();
            if (!username) {
                try {
                    const { data: graphConfigRow } = await client.from('system_config')
                        .select('value').eq('key', 'graph').single();
                    if (graphConfigRow?.value?.falkordb?.username) {
                        username = graphConfigRow.value.falkordb.username;
                    }
                } catch (e) { /* ignore */ }
            }
            if (!password) {
                try {
                    const { data: secretRow, error } = await client.from('secrets')
                        .select('encrypted_value, masked_value')
                        .eq('scope', 'system').eq('name', 'GRAPH_PASSWORD').single();
                    if (!error && secretRow) {
                        password = secretRow.masked_value || secretRow.encrypted_value;
                    }
                } catch (e) { /* ignore */ }
            }
        }
        if (!password) password = process.env.FALKORDB_PASSWORD || process.env.FAKORDB_PASSWORD;
        const providerConfig = {
            host: body.host, port: body.port, username, password,
            tls: body.tls !== false,
            graphName: body.graphName || 'godmode'
        };
        const result = await GraphFactory.testConnection('supabase', providerConfig);
        jsonResponse(res, result);
        return true;
    }

    // POST /api/graph/sync
    if (pathname === '/api/graph/sync' && req.method === 'POST') {
        if (!storage.getGraphProvider()) {
            jsonResponse(res, { ok: false, error: 'Graph database not connected. Connect first via /api/graph/connect' });
            return true;
        }
        const result = await storage.syncToGraph();
        jsonResponse(res, result);
        return true;
    }

    // POST /api/graph/indexes
    if (pathname === '/api/graph/indexes' && req.method === 'POST') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider) {
            jsonResponse(res, { ok: false, error: 'Graph database not connected' });
            return true;
        }
        if (typeof graphProvider.createOntologyIndexes === 'function') {
            const result = await graphProvider.createOntologyIndexes();
            jsonResponse(res, result);
        } else {
            jsonResponse(res, { ok: false, error: 'Index creation not supported by this provider' });
        }
        return true;
    }

    // POST /api/graph/embeddings
    if (pathname === '/api/graph/embeddings' && req.method === 'POST') {
        try {
            const result = await storage.generateEnrichedEmbeddings();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message });
        }
        return true;
    }

    // GET /api/graph/projects
    if (pathname === '/api/graph/projects' && req.method === 'GET') {
        try {
            const multiGraphManager = storage.getMultiGraphManager();
            if (!multiGraphManager) {
                jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                return true;
            }
            const projects = await multiGraphManager.listProjectGraphs();
            jsonResponse(res, { ok: true, projects, count: projects.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/cross-project/people
    if (pathname === '/api/cross-project/people' && req.method === 'GET') {
        try {
            const multiGraphManager = storage.getMultiGraphManager();
            if (!multiGraphManager) {
                jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                return true;
            }
            const result = await multiGraphManager.findCrossProjectPeople();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/cross-project/connections
    if (pathname === '/api/cross-project/connections' && req.method === 'GET') {
        try {
            const multiGraphManager = storage.getMultiGraphManager();
            if (!multiGraphManager) {
                jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                return true;
            }
            const result = await multiGraphManager.findProjectConnections();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/person/:name/projects
    if (pathname.match(/^\/api\/person\/[^/]+\/projects$/) && req.method === 'GET') {
        try {
            const personName = decodeURIComponent(pathname.split('/')[3]);
            const multiGraphManager = storage.getMultiGraphManager();
            if (!multiGraphManager) {
                jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                return true;
            }
            const result = await multiGraphManager.findPersonProjects(personName);
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/switch
    if (pathname === '/api/graph/switch' && req.method === 'POST') {
        const body = await parseBody(req);
        const graphName = body.graphName;
        if (!graphName) {
            jsonResponse(res, { ok: false, error: 'graphName is required' }, 400);
            return true;
        }
        try {
            if (!storage.graphProvider || !storage.graphProvider.switchGraph) {
                jsonResponse(res, { ok: false, error: 'Graph provider does not support switching' });
                return true;
            }
            const result = await storage.graphProvider.switchGraph(graphName);
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/sync-multi
    if (pathname === '/api/graph/sync-multi' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body.projectId || storage.projectId;
        try {
            const result = await storage.syncToGraph({
                multiGraph: true,
                projectId,
                useOntology: body.useOntology !== false
            });
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graph/multi-stats
    if (pathname === '/api/graph/multi-stats' && req.method === 'GET') {
        try {
            const multiGraphManager = storage.getMultiGraphManager();
            if (!multiGraphManager) {
                jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                return true;
            }
            const stats = await multiGraphManager.getStats();
            jsonResponse(res, { ok: true, ...stats });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graph/falkordb-browser
    if (pathname === '/api/graph/falkordb-browser' && req.method === 'GET') {
        try {
            const graphConfig = config.graph || {};
            const falkorConfig = graphConfig.falkordb || {};
            const host = falkorConfig.host || 'localhost';
            const browserPort = falkorConfig.browserPort || 3000;
            const isCloud = host.includes('.cloud') || host.includes('falkordb.com');
            jsonResponse(res, {
                ok: true,
                browserUrl: isCloud ? 'https://browser.falkordb.cloud' : `http://${host === 'localhost' ? 'localhost' : host}:${browserPort}`,
                isCloud,
                host,
                note: isCloud ? 'Cloud FalkorDB - use FalkorDB Cloud Console' : 'Local FalkorDB Browser'
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graph/sync/status
    if (pathname === '/api/graph/sync/status' && req.method === 'GET') {
        try {
            const { getGraphSync } = require('../../sync');
            const graphSync = getGraphSync({
                graphProvider: storage.getGraphProvider(),
                storage
            });
            const status = await graphSync.getSyncStatus();
            jsonResponse(res, { ok: true, ...status });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/sync/full
    if (pathname === '/api/graph/sync/full' && req.method === 'POST') {
        try {
            const { getGraphSync } = require('../../sync');
            const graphSync = getGraphSync({
                graphProvider: storage.getGraphProvider(),
                storage
            });
            const result = await graphSync.fullSync();
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/sync/cleanup
    if (pathname === '/api/graph/sync/cleanup' && req.method === 'POST') {
        try {
            const { getGraphSync } = require('../../sync');
            const graphSync = getGraphSync({
                graphProvider: storage.getGraphProvider()
            });
            const result = await graphSync.cleanupOrphanedNodes();
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/cleanup-duplicates
    if (pathname === '/api/graph/cleanup-duplicates' && req.method === 'POST') {
        try {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider) {
                jsonResponse(res, { ok: false, error: 'Graph provider not connected' });
                return true;
            }
            const dupResult = await graphProvider.cleanupDuplicateMeetings?.() || { ok: false, error: 'Method not supported' };
            const orphanResult = await graphProvider.cleanupOrphanedRelationships?.() || { ok: true, deleted: 0 };
            jsonResponse(res, {
                ok: dupResult.ok && orphanResult.ok,
                duplicatesDeleted: dupResult.deleted || 0,
                orphanedRelationsDeleted: orphanResult.deleted || 0,
                remapped: dupResult.remapped || 0
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graph/list-all
    if (pathname === '/api/graph/list-all' && req.method === 'GET') {
        try {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || typeof graphProvider.listGraphs !== 'function') {
                jsonResponse(res, { ok: false, error: 'FalkorDB provider not available' });
                return true;
            }
            const result = await graphProvider.listGraphs();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/sync-projects
    if (pathname === '/api/graph/sync-projects' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const dryRun = body.dryRun === true;
            const result = await storage.syncFalkorDBGraphs({ dryRun });
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/graph/delete/:graphName
    if (pathname.startsWith('/api/graph/delete/') && req.method === 'DELETE') {
        try {
            const graphName = decodeURIComponent(pathname.split('/').pop());
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || typeof graphProvider.deleteGraph !== 'function') {
                jsonResponse(res, { ok: false, error: 'FalkorDB provider not available' });
                return true;
            }
            const result = await graphProvider.deleteGraph(graphName);
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graph/query
    if (pathname === '/api/graph/query' && req.method === 'POST') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider) {
            jsonResponse(res, { ok: false, error: 'Graph not connected' });
            return true;
        }
        const body = await parseBody(req);
        const cypher = body.query || body.cypher;
        if (!cypher) {
            jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
            return true;
        }
        try {
            const result = await graphProvider.query(cypher);
            if (!result.ok) {
                jsonResponse(res, { ok: false, error: result.error });
                return true;
            }
            const nodes = [];
            const edges = [];
            const nodeIds = new Set();
            const rawData = result.results || [];
            for (const row of rawData) {
                for (const key of Object.keys(row)) {
                    const val = row[key];
                    if (val && typeof val === 'object') {
                        if (val.labels || val._labels || val.label) {
                            const labels = val.labels || val._labels || [val.label];
                            const props = val.properties || val._properties || val;
                            const nodeId = props.id || val.id || val.entityId || `node_${nodes.length}`;
                            if (!nodeIds.has(nodeId)) {
                                nodeIds.add(nodeId);
                                nodes.push({
                                    id: nodeId,
                                    label: (Array.isArray(labels) ? labels[0] : labels) || 'Node',
                                    name: props.name || '',
                                    properties: props
                                });
                            }
                        } else if (val.type || val.relationshipType || val._type) {
                            edges.push({
                                from: val.srcNode || val._srcNode,
                                to: val.destNode || val._destNode,
                                type: val.type || val.relationshipType || val._type,
                                properties: val.properties || val._properties || {}
                            });
                        }
                    }
                }
            }
            jsonResponse(res, { ok: true, nodes, edges, rawData, metadata: result.metadata });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graph/nodes
    if (pathname === '/api/graph/nodes' && req.method === 'GET') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            jsonResponse(res, { ok: true, nodes: [], results: [] });
            return true;
        }
        try {
            const parsedUrl = parseUrl(req.url);
            const label = parsedUrl.query.label;
            const limit = parseInt(parsedUrl.query.limit) || 100;
            const result = await graphProvider.findNodes(label, {}, { limit });
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: true, nodes: [], results: [], error: error.message });
        }
        return true;
    }

    // GET /api/graph/relationships
    if (pathname === '/api/graph/relationships' && req.method === 'GET') {
        const graphProvider = storage.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            jsonResponse(res, { ok: true, relationships: [], results: [] });
            return true;
        }
        try {
            const parsedUrl = parseUrl(req.url);
            const type = parsedUrl.query.type;
            const limit = parseInt(parsedUrl.query.limit) || 100;
            const result = await graphProvider.findRelationships({ type }, { limit });
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: true, relationships: [], results: [], error: error.message });
        }
        return true;
    }

    return false;
}

module.exports = { handleGraph, isGraphRoute };
