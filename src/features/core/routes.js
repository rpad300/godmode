/**
 * Purpose:
 *   Core platform API providing project stats, data reset, orphan cleanup,
 *   relationship/org-chart views, processing history, and AI-powered Q&A
 *   over the full knowledge base with optional GraphRAG augmentation.
 *
 * Responsibilities:
 *   - Project statistics aggregation
 *   - Full project data reset (preserves team, contacts, cost data)
 *   - Orphan data cleanup in storage and knowledge graph
 *   - Relationships and org-chart data retrieval
 *   - Processing history log
 *   - AI Q&A: builds a rich context from facts, decisions, risks, people,
 *     questions, search results, and optional graph data, then calls the LLM
 *
 * Key dependencies:
 *   - storage (ctx): all knowledge data access, search, graph provider, project info
 *   - llm (ctx): text generation for the /ask endpoint
 *   - ../../llm/config: LLM provider/model resolution
 *   - ../../graphrag.GraphRAGEngine: hybrid graph+vector search for enhanced Q&A context
 *   - fs/path: filesystem cleanup during reset (newinfo, newtranscripts, archived)
 *
 * Side effects:
 *   - POST /api/reset: clears storage, deletes files in newinfo/newtranscripts,
 *     optionally clears archived docs, and runs MATCH (n) DETACH DELETE n on graph
 *   - POST /api/cleanup-orphans: removes orphan nodes from the graph
 *   - POST /api/ask: calls LLM (incurs cost); may initialize global.graphRAGEngine
 *
 * Notes:
 *   - /api/reset requires a project ID (X-Project-Id header or body)
 *   - /api/ask responds in the same language as the question
 *   - GraphRAG is only used when a graph provider is connected and entities are detected
 *   - The GraphRAGEngine singleton is cached on global for reuse across requests
 *   - User role and role prompt from project settings tailor Q&A responses
 *
 * Routes:
 *   GET  /api/stats              - Project knowledge statistics
 *   POST /api/reset              - Reset project data (requires project ID)
 *        Body: { project_id, clearArchived? }
 *   POST /api/cleanup-orphans    - Clean orphan data from storage and graph
 *   GET  /api/relationships      - Entity relationships
 *   GET  /api/org-chart          - Org chart data
 *   GET  /api/history            - Processing history
 *   POST /api/ask                - AI Q&A over knowledge base
 *        Body: { question, model? }
 *        Response: { question, answer, sources }
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');

/** Check whether a filesystem path exists (swallows ENOENT). */
async function pathExists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
}
const { jsonResponse } = require('../../server/response');
const llmRouter = require('../../llm/router');

async function handleCore(ctx) {
    const { req, res, pathname, storage, config, dataDir } = ctx;
    const log = getLogger().child({ module: 'core' });

    // GET /api/stats
    if (pathname === '/api/stats' && req.method === 'GET') {
        const stats = await storage.getProjectStats();
        jsonResponse(res, stats);
        return true;
    }

    // POST /api/reset - Reset project knowledge data (keeps team, contacts, cost)
    if (pathname === '/api/reset' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (!projectId) {
            jsonResponse(res, { success: false, error: 'Project ID required. Send X-Project-Id header or project_id in body.' }, 400);
            return true;
        }
        try {
            if (typeof storage.switchProject === 'function') {
                await Promise.resolve(storage.switchProject(projectId));
            } else {
                storage.currentProjectId = projectId;
                if (storage._supabase) storage._supabase.setProject(projectId);
            }
        } catch (e) {
            log.warn({ event: 'core_reset_project_failed', reason: e.message }, 'Could not set project');
        }
        try {
            await storage.reset();
        } catch (err) {
            logError(err, { event: 'core_reset_error' });
            jsonResponse(res, { success: false, error: err.message }, 500);
            return true;
        }
        if (dataDir) {
            const newinfoDir = path.join(dataDir, 'newinfo');
            const transcriptsDir = path.join(dataDir, 'newtranscripts');
            const clearDir = async (dir) => {
                if (!(await pathExists(dir))) return;
                const names = await fsp.readdir(dir);
                await Promise.all(names.map(async (f) => {
                    const filePath = path.join(dir, f);
                    try {
                        const stat = await fsp.stat(filePath);
                        if (stat.isFile()) await fsp.unlink(filePath);
                    } catch (_) { /* ignore */ }
                }));
            };
            await clearDir(newinfoDir);
            await clearDir(transcriptsDir);
            if (body && body.clearArchived) {
                await clearDir(path.join(dataDir, 'archived', 'documents'));
                await clearDir(path.join(dataDir, 'archived', 'meetings'));
            }
        }
        let graphCleared = false;
        try {
            const graphProvider = storage.getGraphProvider?.();
            if (graphProvider && graphProvider.connected) {
                await graphProvider.query('MATCH (n) DETACH DELETE n');
                graphCleared = true;
                log.debug({ event: 'core_reset_graph_cleared' }, 'Graph database cleared');
            }
        } catch (graphErr) {
            log.warn({ event: 'core_reset_graph_warning', reason: graphErr.message }, 'Graph clear warning');
        }
        jsonResponse(res, { success: true, message: 'Project data reset; team, contacts and cost preserved.', graphCleared });
        return true;
    }

    // POST /api/cleanup-orphans - Clean orphan data
    if (pathname === '/api/cleanup-orphans' && req.method === 'POST') {
        try {
            const stats = await storage.cleanOrphanData();
            let graphCleaned = false;
            try {
                const graphProvider = storage.getGraphProvider?.();
                if (graphProvider && graphProvider.connected) {
                    await graphProvider.query(`
                        MATCH (n)
                        WHERE NOT (n)-[:EXTRACTED_FROM]->(:Document)
                        AND NOT (n)-[:EXTRACTED_FROM]->(:Conversation)
                        AND NOT (n)-[:MENTIONED_IN]->()
                        AND NOT n:Document AND NOT n:Conversation AND NOT n:Contact
                        DETACH DELETE n
                    `);
                    graphCleaned = true;
                }
            } catch (graphErr) {
                log.warn({ event: 'core_cleanup_graph_warning', reason: graphErr.message }, 'Graph cleanup warning');
            }
            const total = Object.values(stats).reduce((a, b) => a + b, 0);
            jsonResponse(res, { ok: true, message: `Cleaned ${total} orphan items`, stats, graphCleaned });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/relationships
    if (pathname === '/api/relationships' && req.method === 'GET') {
        const relationships = await storage.getRelationships();
        jsonResponse(res, { relationships });
        return true;
    }

    // GET /api/org-chart
    if (pathname === '/api/org-chart' && req.method === 'GET') {
        const chartData = await storage.getOrgChartData();
        jsonResponse(res, chartData);
        return true;
    }

    // GET /api/history
    if (pathname === '/api/history' && req.method === 'GET') {
        const history = await storage.getHistory();
        jsonResponse(res, { history });
        return true;
    }

    // POST /api/ask - AI-powered Q&A over knowledge base
    if (pathname === '/api/ask' && req.method === 'POST') {
        const body = await parseBody(req);
        const question = body.question;

        const llmConfig = require('../../llm/config');
        const textCfg = llmConfig.getTextConfig(config, body.model ? { model: body.model } : {});
        const askProvider = textCfg?.provider;
        const askProviderConfig = textCfg?.providerConfig || {};
        const model = textCfg?.model;

        if (!question) {
            jsonResponse(res, { error: 'Question is required' }, 400);
            return true;
        }

        if (!askProvider || !model) {
            jsonResponse(res, { error: 'No LLM configured. Set Text provider and model in Settings > LLM.' }, 400);
            return true;
        }

        log.debug({ event: 'core_ask_provider', askProvider, model }, 'Using provider and model');

        const knowledge = await storage.getAllKnowledge();
        const currentProject = await storage.getCurrentProject();
        const userRole = currentProject?.userRole || '';
        const userRolePrompt = currentProject?.userRolePrompt || '';

        let context = `You are a helpful assistant answering questions based on a project knowledge base.
PROJECT: ${currentProject?.name || 'GodMode'}${userRole ? `\nUSER ROLE: ${userRole}` : ''}${userRolePrompt ? `\nROLE CONTEXT: ${userRolePrompt}` : ''}

IMPORTANT RULES:
- Respond in the SAME LANGUAGE as the question (if Portuguese, respond in Portuguese)
- If asked about "state", "status", or "estado", summarize what is currently known
- Be specific and cite the facts you're using
- If information is limited, say what IS available rather than just saying you can't help
${userRole ? `- Tailor responses to be relevant for a ${userRole}` : ''}
${userRolePrompt ? `- Consider the user's specific responsibilities: ${userRolePrompt}` : ''}

`;
        context += "KNOWLEDGE BASE:\n\n";

        if (knowledge.facts && knowledge.facts.length > 0) {
            context += "FACTS:\n";
            knowledge.facts.forEach(f => {
                context += `- [${f.category || 'general'}] ${f.content}\n`;
            });
            context += "\n";
        }

        if (knowledge.decisions && knowledge.decisions.length > 0) {
            context += "DECISIONS:\n";
            knowledge.decisions.forEach(d => {
                context += `- ${d.content}`;
                if (d.date) context += ` (${d.date})`;
                if (d.owner) context += ` - ${d.owner}`;
                context += "\n";
            });
            context += "\n";
        }

        const answeredList = (knowledge.questions || []).filter(q => q.status === 'resolved' && q.answer);
        if (answeredList.length > 0) {
            context += "PREVIOUSLY ANSWERED QUESTIONS:\n";
            answeredList.forEach(q => {
                context += `Q: ${q.content}\nA: ${q.answer}\n\n`;
            });
        }

        if (knowledge.people && knowledge.people.length > 0) {
            context += "PEOPLE:\n";
            knowledge.people.forEach(p => {
                context += `- ${p.name}`;
                if (p.role) context += ` (${p.role})`;
                if (p.organization) context += ` - ${p.organization}`;
                context += "\n";
            });
            context += "\n";
        }

        if (knowledge.risks && knowledge.risks.length > 0) {
            context += "RISKS:\n";
            knowledge.risks.forEach(r => {
                context += `- ${r.content}`;
                if (r.impact) context += ` (Impact: ${r.impact})`;
                if (r.status) context += ` [${r.status}]`;
                context += "\n";
            });
            context += "\n";
        }

        const searchResults = storage.search(question, { limit: 10 });
        if (searchResults.total > 0) {
            context += "RELEVANT ITEMS FROM SEARCH:\n";
            searchResults.facts?.forEach(f => context += `- Fact: ${f.content}\n`);
            searchResults.questions?.forEach(q => context += `- Question: ${q.content}${q.answer ? ' | Answer: ' + q.answer : ''}\n`);
            searchResults.decisions?.forEach(d => context += `- Decision: ${d.content}\n`);
            searchResults.risks?.forEach(r => context += `- Risk: ${r.content}\n`);
            context += "\n";
        }

        const graphProvider = storage.getGraphProvider();
        if (graphProvider && graphProvider.connected) {
            try {
                const { GraphRAGEngine } = require('../../graphrag');

                if (!global.graphRAGEngine) {
                    global.graphRAGEngine = new GraphRAGEngine({
                        graphProvider: graphProvider,
                        storage: storage,
                        llmProvider: askProvider,
                        llmModel: model,
                        llmConfig: config.llm,
                        enableCache: true,
                        useOntology: true
                    });
                }

                log.debug({ event: 'core_ask_graphrag' }, 'Using GraphRAG for enhanced context');
                const queryAnalysis = global.graphRAGEngine.classifyQuery(question);

                if (queryAnalysis.entityHints?.length > 0) {
                    const graphResults = await global.graphRAGEngine.hybridSearch(question, { queryAnalysis });

                    if (graphResults.length > 0) {
                        context += "\nKNOWLEDGE GRAPH RESULTS:\n";
                        for (const result of graphResults.slice(0, 5)) {
                            context += `- [${result.type || 'Entity'}] ${result.content || result.name || JSON.stringify(result.data?.properties || {})}\n`;
                        }
                        context += "\n";
                        log.debug({ event: 'core_ask_graph_results', count: graphResults.length }, 'Added graph results');
                    }
                }
            } catch (graphError) {
                log.warn({ event: 'core_ask_graphrag_error', reason: graphError.message }, 'GraphRAG error');
            }
        }

        context += `Based on this knowledge base, please answer the following question. If you cannot find relevant information, say so.\n\nQuestion: ${question}`;

        const totalKnowledgeItems = (knowledge.facts?.length || 0) +
            (knowledge.decisions?.length || 0) +
            (knowledge.people?.length || 0) +
            (knowledge.risks?.length || 0) +
            (knowledge.questions?.length || 0);

        try {
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt: context,
                temperature: 0.7,
                maxTokens: 2048,
                context: 'core-ask'
            }, config);

            if (routerResult.success) {
                jsonResponse(res, {
                    question,
                    answer: routerResult.result?.text || routerResult.result?.response,
                    sources: {
                        facts: searchResults.facts?.length || 0,
                        questions: searchResults.questions?.length || 0,
                        decisions: searchResults.decisions?.length || 0,
                        knowledgeItems: totalKnowledgeItems
                    }
                });
            } else {
                jsonResponse(res, { error: routerResult.error || 'Failed to generate answer' }, 500);
            }
        } catch (error) {
            jsonResponse(res, { error: 'Failed to generate answer: ' + error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleCore };
