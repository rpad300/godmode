/**
 * Sprints API – create sprint, generate tasks from emails/transcripts, apply
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const llm = require('../../llm');
const llmConfig = require('../../llm/config');
const promptsService = require('../../supabase/prompts');
const { getTranscriptsForProject } = require('../../krisp');

const DEFAULT_SPRINT_PROMPT = `You are helping plan a sprint. Given:
- Sprint context and goals
- Emails in the analysis period (subject, snippet, date)
- Meeting transcripts in the analysis period (title, summary/snippet, date)
- Existing action items (id, task, status)

Output a JSON object with exactly two keys:
1. "new_tasks": array of new tasks to create. Each object must have: task (string), description (string), size_estimate (string e.g. "2h"), definition_of_done (array of strings), acceptance_criteria (array of strings). Optionally: priority ("low"|"medium"|"high"|"urgent").
2. "existing_action_ids": array of UUID strings – ids of existing actions that should belong to this sprint.

Rules: Only suggest tasks that fit the sprint context. Keep new_tasks concise. Use existing_action_ids to link already-existing work to this sprint. Output only valid JSON, no markdown.`;

function isSprintsRoute(pathname) {
    return pathname === '/api/sprints' ||
           pathname.startsWith('/api/sprints/');
}

function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return '';
    const u = url.trim().toLowerCase();
    if (u.startsWith('javascript:') || u.startsWith('data:')) return '';
    return escapeHtml(url.trim());
}

async function handleSprints(ctx) {
    const { req, res, pathname, storage, config } = ctx;
    const log = getLogger().child({ module: 'sprints' });
    if (!isSprintsRoute(pathname)) return false;

    const projectId = storage.getProjectId?.() || storage.currentProjectId;
    if (!projectId) {
        jsonResponse(res, { error: 'Project context required' }, 400);
        return true;
    }

    // POST /api/sprints – create sprint
    if (pathname === '/api/sprints' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { name, start_date, end_date, context, analysis_start_date, analysis_end_date } = body;
            if (!name || !start_date || !end_date) {
                jsonResponse(res, { error: 'name, start_date and end_date are required' }, 400);
                return true;
            }
            if (new Date(end_date) < new Date(start_date)) {
                jsonResponse(res, { error: 'end_date must be >= start_date' }, 400);
                return true;
            }
            const sprint = await storage.createSprint(projectId, {
                name,
                start_date,
                end_date,
                context: context || null,
                analysis_start_date: analysis_start_date || null,
                analysis_end_date: analysis_end_date || null
            });
            jsonResponse(res, { sprint });
        } catch (e) {
            log.warn({ event: 'sprint_create_error', reason: e.message }, 'Create sprint failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/sprints – list sprints
    if (pathname === '/api/sprints' && req.method === 'GET') {
        try {
            const sprints = await storage.getSprints(projectId);
            jsonResponse(res, { sprints });
        } catch (e) {
            jsonResponse(res, { error: e.message, sprints: [] }, 500);
        }
        return true;
    }

    // GET /api/sprints/:id
    const getSprintMatch = pathname.match(/^\/api\/sprints\/([^/]+)$/);
    if (getSprintMatch && req.method === 'GET') {
        try {
            const id = getSprintMatch[1];
            const sprint = await storage.getSprint(id);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            jsonResponse(res, { sprint });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/generate
    const generateMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/generate$/);
    if (generateMatch && req.method === 'POST') {
        try {
            const sprintId = generateMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req).catch(() => ({}));
            const analysisStart = body.analysis_start_date || sprint.analysis_start_date || sprint.start_date;
            const analysisEnd = body.analysis_end_date || sprint.analysis_end_date || sprint.end_date;
            const sinceDate = new Date(analysisStart).toISOString().slice(0, 10);
            const untilDate = new Date(analysisEnd).toISOString().slice(0, 10);

            const [emails, transcripts, existingActions] = await Promise.all([
                storage.getEmails?.({ sinceDate, untilDate, limit: 200 }) ?? [],
                getTranscriptsForProject(projectId, { sinceDate, untilDate, limit: 100 }),
                storage.getActions?.() ?? []
            ]);

            const emailBlob = emails.length
                ? emails.map(e => `[${e.date_sent || e.created_at}] ${e.subject || 'No subject'}\n${(e.body_text || e.body || '').slice(0, 500)}`).join('\n---\n')
                : '(No emails in period)';
            const transcriptBlob = transcripts.length
                ? transcripts.map(t => `[${t.received_at || t.meeting_date}] ${t.display_title || 'Meeting'}\n${(t.ai_summary || t.transcript_text || '').slice(0, 800)}`).join('\n---\n')
                : '(No transcripts in period)';
            const actionsBlob = existingActions.length
                ? existingActions.map(a => `id: ${a.id}\ntask: ${a.task}\nstatus: ${a.status}`).join('\n---\n')
                : '(No existing actions)';

            const promptRecord = await promptsService.getPrompt('sprint_task_generation');
            const template = promptRecord?.prompt_template || DEFAULT_SPRINT_PROMPT;
            const prompt = promptsService.renderPrompt?.(template, {
                SPRINT_NAME: sprint.name,
                SPRINT_START: sprint.start_date,
                SPRINT_END: sprint.end_date,
                SPRINT_CONTEXT: sprint.context || '',
                EMAILS: emailBlob,
                TRANSCRIPTS: transcriptBlob,
                EXISTING_ACTIONS: actionsBlob
            }) || (DEFAULT_SPRINT_PROMPT + `\n\nSprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Context: ${sprint.context || 'None'}\n\nEmails:\n${emailBlob}\n\nTranscripts:\n${transcriptBlob}\n\nExisting actions:\n${actionsBlob}\n\nOutput JSON with new_tasks and existing_action_ids:`);

            const llmCfg = llmConfig.getTextConfigForReasoning?.(config) || llmConfig.getTextConfig?.(config);
            if (!llmCfg?.provider || !llmCfg?.model) {
                jsonResponse(res, { error: 'No AI model configured for reasoning' }, 400);
                return true;
            }
            const result = await llm.generateText({
                provider: llmCfg.provider,
                providerConfig: llmCfg.providerConfig,
                model: llmCfg.model,
                prompt,
                temperature: 0.3,
                maxTokens: 4096,
                context: 'sprint-task-generation'
            });
            const raw = (result.text || result.response || '').trim();
            if (!result.success) {
                jsonResponse(res, { error: result.error || 'AI request failed' }, 400);
                return true;
            }
            const cleaned = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
            let parsed;
            try {
                parsed = JSON.parse(cleaned);
            } catch (err) {
                log.warn({ event: 'sprint_generate_parse_error', raw: raw.slice(0, 200) }, 'Failed to parse LLM JSON');
                jsonResponse(res, { error: 'AI did not return valid JSON', raw: raw.slice(0, 500) }, 400);
                return true;
            }
            const proposed_new_tasks = Array.isArray(parsed.new_tasks) ? parsed.new_tasks : [];
            const existing_action_ids = Array.isArray(parsed.existing_action_ids) ? parsed.existing_action_ids : [];
            const existingDetails = existingActions.filter(a => existing_action_ids.includes(a.id)).map(a => ({ id: a.id, task: a.task, status: a.status }));
            jsonResponse(res, {
                proposed_new_tasks,
                existing_action_ids,
                existing_details: existingDetails
            });
        } catch (e) {
            log.warn({ event: 'sprint_generate_error', reason: e.message }, 'Generate failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/apply
    const applyMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/apply$/);
    if (applyMatch && req.method === 'POST') {
        try {
            const sprintId = applyMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req);
            const newTasks = Array.isArray(body.new_tasks) ? body.new_tasks : [];
            const existingActionIds = Array.isArray(body.existing_action_ids) ? body.existing_action_ids : [];
            const sprintStart = sprint.start_date;
            const sprintEnd = sprint.end_date;

            let created = 0;
            for (const t of newTasks) {
                const taskText = (t.task || t.content || '').trim();
                if (!taskText) continue;
                const dueDate = t.due_date || sprintEnd;
                await storage.addActionItem?.({
                    task: taskText,
                    description: t.description ?? null,
                    size_estimate: t.size_estimate ?? null,
                    definition_of_done: Array.isArray(t.definition_of_done) ? t.definition_of_done : [],
                    acceptance_criteria: Array.isArray(t.acceptance_criteria) ? t.acceptance_criteria : [],
                    priority: t.priority || 'medium',
                    status: 'pending',
                    deadline: dueDate,
                    generation_source: 'sprint_generated',
                    source_type: 'manual',
                    sprint_id: sprintId
                });
                created++;
            }
            let linked = 0;
            for (const id of existingActionIds) {
                if (!id) continue;
                await storage.updateAction?.(id, { sprint_id: sprintId });
                linked++;
            }
            jsonResponse(res, { ok: true, created, linked, sprint });
        } catch (e) {
            log.warn({ event: 'sprint_apply_error', reason: e.message }, 'Apply failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/sprints/:id/report – full report data (sprint, actions, breakdown for chart)
    const reportMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/report$/);
    if (reportMatch && req.method === 'GET') {
        try {
            const sprintId = reportMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const actions = await storage.getActions(null, null, sprintId);
            const byStatus = {};
            const byAssignee = {};
            let totalPoints = 0;
            let completedPoints = 0;
            (actions || []).forEach((a) => {
                const status = (a.status || 'pending').toLowerCase();
                byStatus[status] = (byStatus[status] || 0) + 1;
                const owner = (a.owner || a.assignee || '').trim() || '(unassigned)';
                byAssignee[owner] = (byAssignee[owner] || 0) + 1;
                const pts = a.task_points != null ? Number(a.task_points) : 0;
                totalPoints += pts;
                if (a.status === 'completed') completedPoints += pts;
            });
            jsonResponse(res, {
                sprint,
                actions: actions || [],
                breakdown: { by_status: byStatus, by_assignee: byAssignee },
                total_task_points: totalPoints,
                completed_task_points: completedPoints,
                total_tasks: (actions || []).length,
                completed_tasks: (actions || []).filter(a => a.status === 'completed').length,
            });
        } catch (e) {
            log.warn({ event: 'sprint_report_error', reason: e.message }, 'Report failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/report/analyze – AI analysis of sprint (what was done, velocity, blockers)
    const analyzeMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/report\/analyze$/);
    if (analyzeMatch && req.method === 'POST') {
        try {
            const sprintId = analyzeMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const actions = await storage.getActions(null, null, sprintId);
            const completed = (actions || []).filter(a => a.status === 'completed');
            const pending = (actions || []).filter(a => a.status !== 'completed' && a.status !== 'cancelled');
            const totalPoints = (actions || []).reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);
            const donePoints = completed.reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);
            const summary = [
                `Sprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}).`,
                `Context: ${sprint.context || 'None'}.`,
                `Tasks: ${(actions || []).length} total, ${completed.length} completed, ${pending.length} pending.`,
                totalPoints > 0 ? `Points: ${donePoints}/${totalPoints} completed.` : '',
                completed.length ? `Completed: ${completed.map(a => a.task || a.content).slice(0, 15).join('; ')}${completed.length > 15 ? '...' : ''}` : '',
            ].filter(Boolean).join('\n');
            const llmCfg = llmConfig.getTextConfigForReasoning?.(config) || llmConfig.getTextConfig?.(config);
            if (!llmCfg?.provider || !llmCfg?.model) {
                jsonResponse(res, { analysis: summary, ai_analysis: null, error: 'No AI model configured' });
                return true;
            }
            const prompt = `You are a Scrum Master. Analyze this sprint report and provide a short structured analysis (what was achieved, velocity insight, any blockers or risks, recommendations). Keep it concise.\n\n${summary}`;
            const result = await llm.generateText({
                provider: llmCfg.provider,
                providerConfig: llmCfg.providerConfig,
                model: llmCfg.model,
                prompt,
                temperature: 0.3,
                maxTokens: 1024,
                context: 'sprint-report-analyze',
            });
            const aiAnalysis = (result.text || result.response || '').trim() || null;
            jsonResponse(res, { analysis: summary, ai_analysis: aiAnalysis });
        } catch (e) {
            log.warn({ event: 'sprint_analyze_error', reason: e.message }, 'Analyze failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/report/business – AI business/executive summary
    const businessMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/report\/business$/);
    if (businessMatch && req.method === 'POST') {
        try {
            const sprintId = businessMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const actions = await storage.getActions(null, null, sprintId);
            const completed = (actions || []).filter(a => a.status === 'completed');
            const total = (actions || []).length;
            const completionRate = total ? Math.round((completed.length / total) * 100) : 0;
            const summary = [
                `Sprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Goals: ${sprint.context || 'N/A'}.`,
                `Delivery: ${completed.length}/${total} tasks completed (${completionRate}%).`,
                completed.length ? `Key deliverables: ${completed.map(a => a.task || a.content).slice(0, 10).join('; ')}${completed.length > 10 ? '...' : ''}` : 'No completed tasks.',
            ].filter(Boolean).join('\n');
            const llmCfg = llmConfig.getTextConfigForReasoning?.(config) || llmConfig.getTextConfig?.(config);
            if (!llmCfg?.provider || !llmCfg?.model) {
                jsonResponse(res, { summary, business_report: null, error: 'No AI model configured' });
                return true;
            }
            const prompt = `You are an executive assistant. Write a very short business-facing sprint summary (2-4 sentences) for stakeholders: what was the sprint goal, what was delivered, and overall status. No technical jargon. Be positive and clear.\n\n${summary}`;
            const result = await llm.generateText({
                provider: llmCfg.provider,
                providerConfig: llmCfg.providerConfig,
                model: llmCfg.model,
                prompt,
                temperature: 0.3,
                maxTokens: 512,
                context: 'sprint-report-business',
            });
            const businessReport = (result.text || result.response || '').trim() || null;
            jsonResponse(res, { summary, business_report: businessReport });
        } catch (e) {
            log.warn({ event: 'sprint_business_report_error', reason: e.message }, 'Business report failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // Build report data text for LLM (document/presentation generation)
    // Enriches with: user stories (parent story), ontology snippet, and optional graph context
    async function buildReportData(sprintId, options = {}) {
        const { include_analysis = false, include_business = false } = options;
        const sprint = await storage.getSprint(sprintId);
        if (!sprint) return null;
        const actions = await storage.getActions(null, null, sprintId);
        const byStatus = {};
        const byAssignee = {};
        let totalPoints = 0;
        let completedPoints = 0;
        (actions || []).forEach((a) => {
            const status = (a.status || 'pending').toLowerCase();
            byStatus[status] = (byStatus[status] || 0) + 1;
            const owner = (a.owner || a.assignee || '').trim() || '(unassigned)';
            byAssignee[owner] = (byAssignee[owner] || 0) + 1;
            const pts = a.task_points != null ? Number(a.task_points) : 0;
            totalPoints += pts;
            if (a.status === 'completed') completedPoints += pts;
        });
        const completedCount = (actions || []).filter(a => a.status === 'completed').length;
        const totalCount = (actions || []).length;

        // Resolve parent user stories for actions (ontology: PART_OF Task->UserStory)
        const storyIds = [...new Set((actions || []).map(a => a.parent_story_id).filter(Boolean))];
        const storyMap = {};
        if (storage.getUserStory && storyIds.length > 0) {
            await Promise.all(storyIds.map(async (id) => {
                try {
                    const story = await storage.getUserStory(id);
                    if (story) storyMap[id] = story;
                } catch (_) { /* ignore */ }
            }));
        }

        const taskLines = (actions || []).slice(0, 50).map((a) => {
            const story = a.parent_story_id ? storyMap[a.parent_story_id] : null;
            const storyLabel = story ? ` [User story: ${(story.title || '').substring(0, 50)}${story.story_points != null ? `, ${story.story_points} pt` : ''}]` : '';
            return `- [${a.status || 'pending'}] ${(a.task || a.content || '').substring(0, 120)}${a.task_points != null ? ` (${a.task_points} pt)` : ''}${storyLabel}`;
        });

        let text = [
            `# Sprint: ${sprint.name}`,
            `Período: ${sprint.start_date} a ${sprint.end_date}`,
            sprint.context ? `Contexto / objetivos: ${sprint.context}` : '',
            '',
            `## Resumo`,
            `Tarefas: ${completedCount}/${totalCount} concluídas${totalPoints > 0 ? ` | Pontos: ${completedPoints}/${totalPoints}` : ''}`,
            '',
            '## Ontologia (modelo do grafo)',
            'Entidades: Sprint, Action/Task, Person, UserStory. Relações: IN_SPRINT (Task→Sprint), ASSIGNED_TO (Person→Task), PART_OF (Task→UserStory), DEPENDS_ON (Task→Task). Use esta terminologia quando relevante.',
            '',
            '## Breakdown por estado',
            ...Object.entries(byStatus).map(([k, v]) => `- ${k}: ${v}`),
            '',
            '## Breakdown por responsável',
            ...Object.entries(byAssignee).map(([k, v]) => `- ${k}: ${v}`),
            Object.keys(storyMap).length > 0 ? '' : null,
            Object.keys(storyMap).length > 0 ? '## User stories (referenciadas pelas tarefas)' : null,
            ...(Object.keys(storyMap).length > 0 ? Object.values(storyMap).map(s => `- ${s.title || ''}${s.story_points != null ? ` (${s.story_points} pt)` : ''}`) : []),
            '',
            '## Tarefas do sprint',
            ...taskLines,
            (actions || []).length > 50 ? `... e mais ${(actions || []).length - 50} tarefas` : '',
        ].filter(Boolean).join('\n');

        // Graph context (Supabase-native): sprint node and assignees from graph_relationships
        const graphProvider = storage.getGraphProvider?.();
        if (graphProvider && graphProvider.connected && typeof graphProvider.getSprintReportContext === 'function') {
            try {
                const res = await graphProvider.getSprintReportContext(sprintId);
                if (res?.ok && (res.assignees?.length > 0 || (res.sprint && (res.sprint.name || res.sprint.context)))) {
                    text += '\n\n## Contexto do grafo (Supabase Graph)\n';
                    if (res.sprint && (res.sprint.name || res.sprint.context)) {
                        text += `Sprint no grafo: ${res.sprint.name || sprintId}${res.sprint.context ? ` – ${res.sprint.context}` : ''}\n`;
                    }
                    if (res.assignees && res.assignees.length > 0) {
                        text += `Responsáveis ligados no grafo (ASSIGNED_TO): ${res.assignees.join(', ')}\n`;
                    }
                }
            } catch (e) {
                log.debug({ event: 'sprint_report_graph_context_skip', reason: e.message }, 'Graph context skipped');
            }
        }

        if (include_analysis || include_business) {
            try {
                const llmCfg = llmConfig.getTextConfigForReasoning?.(config) || llmConfig.getTextConfig?.(config);
                const completed = (actions || []).filter(a => a.status === 'completed');
                const pending = (actions || []).filter(a => a.status !== 'completed' && a.status !== 'cancelled');
                const total = (actions || []).length;
                const tp = (actions || []).reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);
                const dp = completed.reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);

                const runAnalysis = include_analysis && llmCfg?.provider && llmCfg?.model ? llm.generateText({
                    provider: llmCfg.provider,
                    providerConfig: llmCfg.providerConfig,
                    model: llmCfg.model,
                    prompt: `You are a Scrum Master. Analyze this sprint and provide a short structured analysis (what was achieved, velocity, blockers, recommendations). Keep it concise.\n\nSprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Context: ${sprint.context || 'None'}. Tasks: ${total} total, ${completed.length} completed, ${pending.length} pending.${tp > 0 ? ` Points: ${dp}/${tp} completed.` : ''}`,
                    temperature: 0.3,
                    maxTokens: 1024,
                    context: 'sprint-report-analyze-inline',
                }).then(r => (r.text || r.response || '').trim()) : Promise.resolve('');

                const runBusiness = include_business && llmCfg?.provider && llmCfg?.model ? llm.generateText({
                    provider: llmCfg.provider,
                    providerConfig: llmCfg.providerConfig,
                    model: llmCfg.model,
                    prompt: `You are an executive assistant. Write a very short business-facing sprint summary (2-4 sentences) for stakeholders. No technical jargon.\n\nSprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Goals: ${sprint.context || 'N/A'}. Delivery: ${completed.length}/${total} tasks completed (${total ? Math.round((completed.length / total) * 100) : 0}%).`,
                    temperature: 0.3,
                    maxTokens: 512,
                    context: 'sprint-report-business-inline',
                }).then(r => (r.text || r.response || '').trim()) : Promise.resolve('');

                const [aiAnalysis, businessReport] = await Promise.all([runAnalysis, runBusiness]);
                if (aiAnalysis) text += '\n\n## Análise IA\n' + aiAnalysis;
                if (businessReport) text += '\n\n## Relatório executivo (Business)\n' + businessReport;
            } catch (e) {
                log.warn({ event: 'report_data_analysis_error', reason: e.message }, 'Optional analysis failed');
            }
        }
        return text;
    }

    function extractHtmlFromResponse(raw) {
        if (!raw || typeof raw !== 'string') return '';
        let s = raw.trim();
        const markdownBlock = /^```(?:html)?\s*([\s\S]*?)```$/m;
        const m = s.match(markdownBlock);
        if (m) s = m[1].trim();
        else {
            const start = s.indexOf('<!DOCTYPE');
            if (start === -1) return s;
            const end = s.indexOf('</html>');
            s = end !== -1 ? s.slice(start, end + 7) : s.slice(start);
        }
        return s;
    }

    // POST /api/sprints/:id/report/document – generate A4 document HTML from report (template or prompt)
    const documentMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/report\/document$/);
    if (documentMatch && req.method === 'POST') {
        try {
            const sprintId = documentMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req).catch(() => ({}));
            const include_analysis = !!body.include_analysis;
            const include_business = !!body.include_business;
            const styleKey = body.style || '';

            const reportData = await buildReportData(sprintId, { include_analysis, include_business });
            if (!reportData) {
                jsonResponse(res, { error: 'Failed to build report data' }, 500);
                return true;
            }

            const project = sprint.project_id && storage.getProject ? await storage.getProject(sprint.project_id) : null;
            const company = project?.company || null;
            const brand = company?.brand_assets || {};
            const companyVars = {
                COMPANY_NAME: company?.name || '',
                COMPANY_LOGO_URL: company?.logo_url || '',
                PRIMARY_COLOR: brand.primary_color || '',
                SECONDARY_COLOR: brand.secondary_color || ''
            };

            if (company?.a4_template_html) {
                let html = company.a4_template_html
                    .replace(/\{\{COMPANY_NAME\}\}/g, escapeHtml(companyVars.COMPANY_NAME))
                    .replace(/\{\{COMPANY_LOGO_URL\}\}/g, safeUrl(companyVars.COMPANY_LOGO_URL))
                    .replace(/\{\{PRIMARY_COLOR\}\}/g, escapeHtml(companyVars.PRIMARY_COLOR))
                    .replace(/\{\{SECONDARY_COLOR\}\}/g, escapeHtml(companyVars.SECONDARY_COLOR))
                    .replace(/\{\{REPORT_DATA\}\}/g, reportData);
                jsonResponse(res, { html });
                return true;
            }

            const promptRecord = await promptsService.getPrompt('sprint_report_document_a4');
            const template = promptRecord?.prompt_template || '';
            if (!template) {
                jsonResponse(res, { error: 'Prompt sprint_report_document_a4 not found. Run migration 095.' }, 400);
                return true;
            }

            let styleVariant = '';
            if (styleKey && ['sprint_report_style_corporate_classic', 'sprint_report_style_modern_minimal', 'sprint_report_style_startup_tech', 'sprint_report_style_consultancy'].includes(styleKey)) {
                const styleRecord = await promptsService.getPrompt(styleKey);
                if (styleRecord?.prompt_template) styleVariant = styleRecord.prompt_template;
            }

            const prompt = promptsService.renderPrompt(template, { REPORT_DATA: reportData, STYLE_VARIANT: styleVariant, ...companyVars });

            const llmCfg = llmConfig.getTextConfigForReasoning?.(config) || llmConfig.getTextConfig?.(config);
            if (!llmCfg?.provider || !llmCfg?.model) {
                jsonResponse(res, { error: 'No AI model configured' }, 400);
                return true;
            }

            const result = await llm.generateText({
                provider: llmCfg.provider,
                providerConfig: llmCfg.providerConfig,
                model: llmCfg.model,
                prompt,
                temperature: 0.3,
                maxTokens: 16384,
                context: 'sprint-report-document',
            });

            const raw = (result.text || result.response || '').trim();
            const html = extractHtmlFromResponse(raw);
            if (!html) {
                jsonResponse(res, { error: 'Model did not return valid HTML' }, 500);
                return true;
            }
            jsonResponse(res, { html });
        } catch (e) {
            log.warn({ event: 'sprint_report_document_error', reason: e.message }, 'Document generation failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/report/presentation – generate PPT-style presentation HTML (template or prompt)
    const presentationMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/report\/presentation$/);
    if (presentationMatch && req.method === 'POST') {
        try {
            const sprintId = presentationMatch[1];
            const sprint = await storage.getSprint(sprintId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req).catch(() => ({}));
            const include_analysis = !!body.include_analysis;
            const include_business = !!body.include_business;

            const reportData = await buildReportData(sprintId, { include_analysis, include_business });
            if (!reportData) {
                jsonResponse(res, { error: 'Failed to build report data' }, 500);
                return true;
            }

            const project = sprint.project_id && storage.getProject ? await storage.getProject(sprint.project_id) : null;
            const company = project?.company || null;
            const brand = company?.brand_assets || {};
            const companyVars = {
                COMPANY_NAME: company?.name || '',
                COMPANY_LOGO_URL: company?.logo_url || '',
                PRIMARY_COLOR: brand.primary_color || '',
                SECONDARY_COLOR: brand.secondary_color || ''
            };

            if (company?.ppt_template_html) {
                let html = company.ppt_template_html
                    .replace(/\{\{COMPANY_NAME\}\}/g, escapeHtml(companyVars.COMPANY_NAME))
                    .replace(/\{\{COMPANY_LOGO_URL\}\}/g, safeUrl(companyVars.COMPANY_LOGO_URL))
                    .replace(/\{\{PRIMARY_COLOR\}\}/g, escapeHtml(companyVars.PRIMARY_COLOR))
                    .replace(/\{\{SECONDARY_COLOR\}\}/g, escapeHtml(companyVars.SECONDARY_COLOR))
                    .replace(/\{\{REPORT_DATA\}\}/g, reportData);
                jsonResponse(res, { html });
                return true;
            }

            const promptRecord = await promptsService.getPrompt('sprint_report_presentation');
            const template = promptRecord?.prompt_template || '';
            if (!template) {
                jsonResponse(res, { error: 'Prompt sprint_report_presentation not found. Run migration 095.' }, 400);
                return true;
            }

            const prompt = promptsService.renderPrompt(template, { REPORT_DATA: reportData, ...companyVars });

            const llmCfg = llmConfig.getTextConfigForReasoning?.(config) || llmConfig.getTextConfig?.(config);
            if (!llmCfg?.provider || !llmCfg?.model) {
                jsonResponse(res, { error: 'No AI model configured' }, 400);
                return true;
            }

            const result = await llm.generateText({
                provider: llmCfg.provider,
                providerConfig: llmCfg.providerConfig,
                model: llmCfg.model,
                prompt,
                temperature: 0.3,
                maxTokens: 16384,
                context: 'sprint-report-presentation',
            });

            const raw = (result.text || result.response || '').trim();
            const html = extractHtmlFromResponse(raw);
            if (!html) {
                jsonResponse(res, { error: 'Model did not return valid HTML' }, 500);
                return true;
            }
            jsonResponse(res, { html });
        } catch (e) {
            log.warn({ event: 'sprint_report_presentation_error', reason: e.message }, 'Presentation generation failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleSprints, isSprintsRoute };
