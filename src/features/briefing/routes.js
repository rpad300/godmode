/**
 * Purpose:
 *   AI-generated daily project briefing with multi-layer caching (Supabase,
 *   in-memory) and a history endpoint for past briefings.
 *
 * Responsibilities:
 *   - Generate a structured daily briefing with project health, critical items,
 *     trend analysis, and an executive summary paragraph
 *   - Three-tier cache: Supabase (persistent), memory (fast), force-refresh bypass
 *   - Parse LLM response to separate bullet-point briefing from analysis section
 *   - Save generated briefings to Supabase and optionally sync to knowledge graph
 *   - Retrieve paginated briefing history
 *
 * Key dependencies:
 *   - storage (ctx): stats, questions, risks, actions, facts, project, briefing persistence
 *   - llm (ctx): text generation for briefing content
 *   - ../../llm/config: LLM provider/model resolution
 *   - ../../supabase/comments: fetches recent task comments for briefing context
 *   - ../../sync.getGraphSync: optional graph sync for generated briefings
 *   - briefingCache / isBriefingCacheValid (ctx): in-memory cache management
 *
 * Side effects:
 *   - GET /api/briefing may call the LLM (incurs cost) when cache is stale
 *   - Writes briefing to Supabase and updates in-memory cache
 *   - Syncs briefing node to knowledge graph if connected
 *
 * Notes:
 *   - Cache hierarchy: Supabase first, then memory, then regenerate
 *   - Force refresh via ?refresh=true bypasses all caches
 *   - The prompt uses /no_think prefix to suppress LLM chain-of-thought
 *   - Post-processing strips LLM preamble (e.g., "Okay, let me...") before the bullets
 *   - Analysis is separated from the briefing by "---ANALYSIS---" or heuristic detection
 *   - User role and role prompt from project settings tailor the briefing perspective
 *   - Recent task comments (up to 10 in-progress actions, 3 comments each) provide
 *     qualitative context capped at 1500 characters
 *
 * Routes:
 *   GET /api/briefing/history  - Paginated history (?limit=N, default 30)
 *   GET /api/briefing          - Daily briefing (cached, ?refresh=true to force)
 *       Response: { briefing, analysis, generated_at, stats, cached?, cacheSource? }
 */

const { parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const llmConfig = require('../../llm/config');
const comments = require('../../supabase/comments');

async function handleBriefing(ctx) {
    const { req, res, pathname, storage, config, llm, briefingCache, isBriefingCacheValid } = ctx;
    const log = getLogger().child({ module: 'briefing' });

    // GET /api/briefing/history - Must match before /api/briefing
    if (pathname === '/api/briefing/history' && req.method === 'GET') {
        try {
            const briefingUrl = parseUrl(req.url);
            const limit = parseInt(briefingUrl.query?.limit) || 30;
            const history = await storage.getBriefingHistory(limit);
            jsonResponse(res, {
                ok: true,
                history,
                total: history.length
            });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message, history: [] });
        }
        return true;
    }

    // GET /api/briefing - AI-generated daily briefing (cached with change detection)
    if (pathname === '/api/briefing' && req.method === 'GET') {
        const briefingUrl = parseUrl(req.url);
        const forceRefresh = briefingUrl.query?.refresh === 'true';

        if (!forceRefresh) {
            try {
                const cacheResult = await storage.getCachedBriefing();
                if (cacheResult.cached) {
                    log.debug({ event: 'briefing_cache_supabase' }, 'Using Supabase cached briefing');
                    const cachedContent = cacheResult.briefing || {};
                    jsonResponse(res, {
                        briefing: cachedContent.briefing || cacheResult.summary,
                        analysis: cachedContent.analysis || null,
                        generated_at: cachedContent.generated_at || cacheResult.createdAt,
                        stats: cachedContent.stats || cacheResult.stats,
                        cached: true,
                        cacheSource: 'supabase'
                    });
                    return true;
                }
            } catch (cacheErr) {
                log.debug({ event: 'briefing_cache_check_error', reason: cacheErr.message }, 'Cache check error');
            }
        }
        if (!forceRefresh && isBriefingCacheValid()) {
            log.debug({ event: 'briefing_cache_memory' }, 'Returning memory cached briefing');
            jsonResponse(res, {
                ...briefingCache.data,
                cached: true,
                cacheSource: 'memory'
            });
            return true;
        }

        const briefingTextCfg = llmConfig.getTextConfig(config);
        const llmProvider = briefingTextCfg.provider;
        const model = briefingTextCfg.model;

        if (!model) {
            jsonResponse(res, { error: 'No model configured. Please configure a text model in Settings.', briefing: null });
            return true;
        }

        log.debug({ event: 'briefing_provider', llmProvider, model }, 'Using provider and model');

        const stats = storage.getStats();
        const allQuestions = storage.getQuestions({});
        const allRisks = storage.getRisks ? await storage.getRisks() : [];
        const allActions = storage.getActionItems();
        const currentProject = storage.getCurrentProject();

        const criticalQuestions = allQuestions.filter(q => q.priority === 'critical' && q.status !== 'resolved');
        const highRisks = allRisks.filter(r => (r.impact || '').toLowerCase() === 'high' && r.status !== 'mitigated');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueActions = allActions.filter(a => {
            if (a.status === 'completed') return false;
            if (!a.deadline) return false;
            return new Date(a.deadline) < today;
        });

        const oldQuestions = allQuestions.filter(q => {
            if (q.status === 'resolved') return false;
            const created = q.created_at ? new Date(q.created_at) : null;
            if (!created) return false;
            const ageDays = Math.floor((today - created) / (1000 * 60 * 60 * 24));
            return ageDays > 7;
        });

        const userRole = currentProject?.userRole || '';
        const userRolePrompt = currentProject?.userRolePrompt || '';
        let roleContext = userRole ? `\nYour briefing is for: ${userRole}` : '';
        if (userRolePrompt) {
            roleContext += `\nRole Context: ${userRolePrompt}`;
        }

        const recentFacts = storage.getFacts().slice(0, 5).map(f => f.content?.substring(0, 100)).join('; ');
        const openRisksList = allRisks.filter(r => r.status !== 'mitigated').slice(0, 3).map(r => r.content?.substring(0, 80)).join('; ');
        const pendingQuestionsList = allQuestions.filter(q => q.status !== 'resolved').slice(0, 3).map(q => q.content?.substring(0, 80)).join('; ');

        let taskCommentsLine = '';
        const projectId = currentProject?.id;
        if (projectId) {
            const inProgressActions = allActions
                .filter(a => a.status !== 'completed')
                .sort((a, b) => {
                    const au = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                    const bu = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    return bu - au;
                })
                .slice(0, 10);
            const flattenComments = (arr) => {
                const out = [];
                for (const c of arr || []) {
                    out.push(c);
                    if (c.replies?.length) out.push(...flattenComments(c.replies));
                }
                return out;
            };
            const results = await Promise.allSettled(
                inProgressActions.map((action) =>
                    comments.getComments(projectId, 'action', String(action.id), { limit: 20, includeReplies: true })
                )
            );
            const parts = [];
            for (let i = 0; i < results.length; i++) {
                const settled = results[i];
                const action = inProgressActions[i];
                if (settled.status !== 'fulfilled' || !settled.value?.success || !settled.value.comments?.length) continue;
                const all = flattenComments(settled.value.comments);
                const recent = all
                    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
                    .slice(-3)
                    .map(c => (c.content || '').replace(/\s+/g, ' ').trim().substring(0, 120));
                if (recent.length === 0) continue;
                const taskTitle = (action.content || action.task || `Task ${action.id}`).toString().replace(/\s+/g, ' ').trim().substring(0, 50);
                parts.push(`${taskTitle}: ${recent.join('; ')}`);
            }
            if (parts.length > 0) {
                const raw = parts.join(' | ');
                taskCommentsLine = raw.length > 1500 ? raw.substring(0, 1497) + '…' : raw;
            }
        }

        const briefingPrompt = `/no_think
TASK: Generate a comprehensive daily project briefing with analysis.
OUTPUT: A structured briefing followed by a written executive summary.${roleContext}

PROJECT: ${currentProject?.name || 'GodMode'}

QUANTITATIVE DATA:
- Total Facts Captured: ${stats.facts || 0}
- Decisions Made: ${stats.decisions || 0}
- Pending Questions: ${allQuestions.filter(q => q.status !== 'resolved').length}
- Open Risks: ${allRisks.filter(r => r.status !== 'mitigated').length}
- Pending Actions: ${allActions.filter(a => a.status !== 'completed').length}
${criticalQuestions.length > 0 ? `- Critical Questions: ${criticalQuestions.length}` : ''}
${highRisks.length > 0 ? `- High-Impact Risks: ${highRisks.length}` : ''}
${overdueActions.length > 0 ? `- Overdue Actions: ${overdueActions.length}` : ''}
${oldQuestions.length > 0 ? `- Aging Questions (>7 days): ${oldQuestions.length}` : ''}

QUALITATIVE CONTEXT:
${recentFacts ? `Recent insights: ${recentFacts}` : 'No recent facts captured.'}
${openRisksList ? `Active risks: ${openRisksList}` : ''}
${pendingQuestionsList ? `Open questions: ${pendingQuestionsList}` : ''}
${taskCommentsLine ? `Recent task updates/comments: ${taskCommentsLine}` : ''}

RESPOND WITH THIS EXACT FORMAT:

• **Project Health**: [Good/Needs Attention/Urgent] - [one sentence reason]
• **Critical Today**: [most important item to address today]
• **Trend**: [observation about project trajectory]
• **Next Step**: [one specific recommended action]

---ANALYSIS---
[Write 2-3 paragraphs providing an executive summary analysis. Include: 
1) Current project state and what the data reveals
2) Key concerns or opportunities identified
3) Strategic recommendations for the coming period]

START YOUR RESPONSE WITH THE FIRST BULLET POINT.`;

        try {
            const providerConfig = config.llm?.providers?.[llmProvider] || {};
            const result = await llm.generateText({
                provider: llmProvider,
                model: model,
                prompt: briefingPrompt,
                temperature: 0.6,
                maxTokens: 1000,
                providerConfig: providerConfig,
                context: 'briefing'
            });
            if (result.success) {
                let fullResponse = result.text || result.response || '';

                fullResponse = fullResponse
                    .replace(/^.*?(Okay|Let me|I need to|First|The user|Looking at|Based on).*?\n/gim, '')
                    .replace(/^.*?(I should|I'll|I think|I notice|I see|I can see|So |Hmm|Wait).*?\n/gim, '')
                    .replace(/^[📊🚨⚠️✅📈💡🎯]+(Okay|Let me|I need|First|The user|Looking|Based).*?\n/gim, '')
                    .replace(/^[\s\S]*?(?=•|\*\*|\-\s\*\*)/m, '')
                    .trim();

                if (!fullResponse || fullResponse.length < 20) {
                    fullResponse = result.text || result.response || '';
                }

                let cleanBriefing = fullResponse;
                let analysis = '';

                const separators = ['---ANALYSIS---', '---Analysis---', '**Analysis**', '## Analysis', '### Analysis', 'Executive Analysis:', 'Analysis:'];
                let separatorFound = false;

                for (const sep of separators) {
                    const sepIndex = fullResponse.indexOf(sep);
                    if (sepIndex !== -1) {
                        cleanBriefing = fullResponse.substring(0, sepIndex).trim();
                        analysis = fullResponse.substring(sepIndex + sep.length).trim();
                        separatorFound = true;
                        break;
                    }
                }

                if (!separatorFound) {
                    const lines = fullResponse.split('\n');
                    let lastBulletIndex = -1;

                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (line.startsWith('•') || (line.startsWith('**') && line.includes(':'))) {
                            lastBulletIndex = i;
                            break;
                        }
                    }

                    if (lastBulletIndex !== -1 && lastBulletIndex < lines.length - 1) {
                        const afterBullets = lines.slice(lastBulletIndex + 1).join('\n').trim();
                        if (afterBullets.length > 100) {
                            cleanBriefing = lines.slice(0, lastBulletIndex + 1).join('\n').trim();
                            analysis = afterBullets
                                .replace(/^[-─—=]+\s*/gm, '')
                                .replace(/^(Analysis|Summary|Executive Summary):?\s*/im, '')
                                .trim();
                        }
                    }
                }

                if (analysis) {
                    analysis = analysis
                        .replace(/^[-─—=]+\s*/gm, '')
                        .replace(/^\*\*.*?\*\*\s*/m, '')
                        .trim();
                }

                const responseData = {
                    briefing: cleanBriefing,
                    analysis: analysis || null,
                    generated_at: new Date().toISOString(),
                    stats: {
                        criticalQuestions: criticalQuestions.length,
                        highRisks: highRisks.length,
                        overdueActions: overdueActions.length,
                        agingQuestions: oldQuestions.length
                    }
                };

                briefingCache.data = responseData;
                briefingCache.generatedAt = responseData.generated_at;
                briefingCache.projectId = currentProject?.id;

                try {
                    const savedBriefing = await storage.saveBriefing(responseData, {
                        summary: cleanBriefing.substring(0, 500),
                        provider: llmProvider,
                        model: model,
                        tokensUsed: result.usage?.total || null,
                        generationTime: result.latency || null
                    });

                    if (savedBriefing) {
                        try {
                            const graphProvider = storage.getGraphProvider();
                            if (graphProvider && graphProvider.connected) {
                                const { getGraphSync } = require('../../sync');
                                const briefingGraphSync = getGraphSync({ graphProvider, storage });
                                await briefingGraphSync.syncBriefing(
                                    savedBriefing,
                                    currentProject?.id,
                                    currentProject?.name
                                );
                            }
                        } catch (graphErr) {
                            log.warn({ event: 'briefing_graph_sync_failed', reason: graphErr.message }, 'Graph sync failed');
                        }
                    }
                } catch (saveErr) {
                    log.warn({ event: 'briefing_supabase_save_failed', reason: saveErr.message }, 'Failed to save to Supabase');
                }
                log.debug({ event: 'briefing_generated_cached' }, 'Generated and cached (memory + Supabase + Graph)');

                jsonResponse(res, responseData);
            } else {
                jsonResponse(res, { error: result.error, briefing: null });
            }
        } catch (e) {
            jsonResponse(res, { error: e.message, briefing: null });
        }
        return true;
    }

    return false;
}

module.exports = { handleBriefing };
