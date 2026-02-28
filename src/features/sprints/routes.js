/**
 * Purpose:
 *   Sprint management API with AI-powered task generation from emails and
 *   meeting transcripts, plus report generation (data, analysis, document, presentation).
 *
 * Responsibilities:
 *   - Create and list sprints for a project
 *   - AI task generation: analyzes emails and transcripts in the sprint analysis
 *     period, proposes new tasks and links existing actions to the sprint
 *   - Apply generated tasks: creates action items and links existing ones
 *   - Sprint report data: task breakdown by status/assignee, points tracking
 *   - AI sprint analysis (Scrum Master style) and executive business summary
 *   - AI-generated A4 document and presentation (HTML) from sprint report data,
 *     with optional company branding and configurable style variants
 *
 * Key dependencies:
 *   - storage (ctx): sprint CRUD, action items, user stories, project/graph access
 *   - ../../llm/router: LLM routing for all AI operations (task generation, analysis, reports)
 *   - ../../supabase/prompts: managed prompt templates for sprint task generation and reports
 *   - ../../krisp.getTranscriptsForProject: meeting transcript retrieval
 *
 * Side effects:
 *   - POST /sprints creates a sprint row
 *   - POST /sprints/:id/apply creates action items and updates existing ones
 *   - POST /generate, /report/analyze, /report/business, /report/document,
 *     /report/presentation all call the LLM (incur cost)
 *   - Document/presentation generation may read company brand assets from project
 *
 * Notes:
 *   - All sprint routes require a project context (projectId from storage)
 *   - The DEFAULT_SPRINT_PROMPT is used as fallback if no DB prompt exists
 *   - Report text includes Portuguese labels (Resumo, Tarefas, etc.) -- bilingual by design
 *   - Graph context (Supabase Graph) is optionally enriched into report data
 *   - HTML extraction from LLM response strips markdown code fences
 *   - escapeHtml/safeUrl helpers prevent XSS in generated HTML
 *
 * Routes:
 *   POST /api/sprints                          - Create sprint
 *        Body: { name, start_date, end_date, context, analysis_start_date, analysis_end_date }
 *   GET  /api/sprints                          - List sprints for project
 *   GET  /api/sprints/:id                      - Get single sprint
 *   POST /api/sprints/:id/generate             - AI task generation from emails/transcripts
 *   POST /api/sprints/:id/apply                - Apply generated tasks
 *        Body: { new_tasks[], existing_action_ids[] }
 *   GET  /api/sprints/:id/report               - Sprint report data (tasks, breakdown, points)
 *   POST /api/sprints/:id/report/analyze       - AI Scrum Master analysis
 *   POST /api/sprints/:id/report/business      - AI executive summary
 *   POST /api/sprints/:id/report/document      - AI-generated A4 HTML document
 *        Body: { include_analysis, include_business, style }
 *   POST /api/sprints/:id/report/presentation  - AI-generated presentation HTML
 *        Body: { include_analysis, include_business }
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const llmRouter = require('../../llm/router');
const promptsService = require('../../supabase/prompts');
const { getTranscriptsForProject } = require('../../krisp');

const DEFAULT_SPRINT_PROMPT = `You are helping plan a sprint. Given:
- Sprint context and goals
- Emails in the analysis period (subject, snippet, date)
- Meeting transcripts in the analysis period (title, summary/snippet, date)
- Existing action items (id, task, status)
- Known facts, decisions, open risks and unresolved questions from the knowledge base

Output a JSON object with exactly two keys:
1. "new_tasks": array of new tasks to create. Each object must have: task (string), description (string), size_estimate (string e.g. "2h"), definition_of_done (array of strings), acceptance_criteria (array of strings). Optionally: priority ("low"|"medium"|"high"|"urgent").
2. "existing_action_ids": array of UUID strings – ids of existing actions that should belong to this sprint.

Rules: Only suggest tasks that fit the sprint context. Keep new_tasks concise. Use existing_action_ids to link already-existing work to this sprint. Create tasks to mitigate open risks, resolve pending decisions, and answer unresolved questions when relevant. Output only valid JSON, no markdown.`;

/** Fast prefix check to short-circuit non-sprint paths. */
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

function extractRouterText(routerResult) {
    if (!routerResult?.success) return null;
    const r = routerResult.result || routerResult;
    return (r.text || r.response || '').trim() || null;
}

async function loadPromptTemplate(key, fallback) {
    try {
        const record = await promptsService.getPrompt(key);
        return record?.prompt_template || fallback;
    } catch { return fallback; }
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
            const { name, start_date, end_date, context, analysis_start_date, analysis_end_date, goals } = body;
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
                analysis_end_date: analysis_end_date || null,
                goals: Array.isArray(goals) ? goals : (goals ? [goals] : null)
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

    // PUT /api/sprints/:id – update sprint
    const putSprintMatch = pathname.match(/^\/api\/sprints\/([^/]+)$/);
    if (putSprintMatch && req.method === 'PUT') {
        try {
            const id = putSprintMatch[1];
            const existing = await storage.getSprint(id, projectId);
            if (!existing) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req);
            const updates = {};
            if (body.name !== undefined) updates.name = body.name;
            if (body.start_date !== undefined) updates.start_date = body.start_date;
            if (body.end_date !== undefined) updates.end_date = body.end_date;
            if (body.context !== undefined) updates.context = body.context;
            if (body.goals !== undefined) updates.goals = body.goals;
            if (body.status !== undefined) updates.status = body.status;
            if (body.analysis_start_date !== undefined) updates.analysis_start_date = body.analysis_start_date;
            if (body.analysis_end_date !== undefined) updates.analysis_end_date = body.analysis_end_date;
            const sprint = await storage.updateSprint(id, updates);
            jsonResponse(res, { ok: true, sprint: sprint || { ...existing, ...updates } });
        } catch (e) {
            log.warn({ event: 'sprint_update_error', reason: e.message }, 'Update sprint failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/sprints/:id – delete sprint and unlink actions
    const deleteSprintMatch = pathname.match(/^\/api\/sprints\/([^/]+)$/);
    if (deleteSprintMatch && req.method === 'DELETE') {
        try {
            const id = deleteSprintMatch[1];
            const existing = await storage.getSprint(id, projectId);
            if (!existing) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const actions = await storage.getActions(null, null, id);
            for (const a of (actions || [])) {
                await storage.updateAction?.(a.id, { sprint_id: null });
            }
            await storage.deleteSprint(id);
            jsonResponse(res, { ok: true });
        } catch (e) {
            log.warn({ event: 'sprint_delete_error', reason: e.message }, 'Delete sprint failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PATCH /api/sprints/:id/status – transition sprint status
    const statusMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/status$/);
    if (statusMatch && req.method === 'PATCH') {
        try {
            const id = statusMatch[1];
            const existing = await storage.getSprint(id, projectId);
            if (!existing) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req);
            const validStatuses = ['planning', 'active', 'completed'];
            if (!body.status || !validStatuses.includes(body.status)) {
                jsonResponse(res, { error: `status must be one of: ${validStatuses.join(', ')}` }, 400);
                return true;
            }
            const sprint = await storage.updateSprint(id, { status: body.status });
            jsonResponse(res, { ok: true, sprint: sprint || { ...existing, status: body.status } });
        } catch (e) {
            log.warn({ event: 'sprint_status_error', reason: e.message }, 'Status transition failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/sprints/:id
    const getSprintMatch = pathname.match(/^\/api\/sprints\/([^/]+)$/);
    if (getSprintMatch && req.method === 'GET') {
        try {
            const id = getSprintMatch[1];
            const sprint = await storage.getSprint(id, projectId);
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
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const body = await parseBody(req).catch(() => ({}));
            const analysisStart = body.analysis_start_date || sprint.analysis_start_date || sprint.start_date;
            const analysisEnd = body.analysis_end_date || sprint.analysis_end_date || sprint.end_date;
            const sinceDate = new Date(analysisStart).toISOString().slice(0, 10);
            const untilDate = new Date(analysisEnd).toISOString().slice(0, 10);

            const [emails, transcripts, existingActions, sprintFacts, sprintDecisions, sprintRisks, sprintQuestions] = await Promise.all([
                storage.getEmails?.({ sinceDate, untilDate, limit: 200 }) ?? [],
                getTranscriptsForProject(projectId, { sinceDate, untilDate, limit: 100 }),
                storage.getActions?.() ?? [],
                storage.getFacts?.(null, sprintId) ?? [],
                storage.getDecisions?.(null, sprintId) ?? [],
                storage.getRisks?.(null, sprintId) ?? [],
                storage.getQuestions?.(null, null, sprintId) ?? []
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
            const factsBlob = sprintFacts.length
                ? sprintFacts.slice(0, 30).map(f => `[${f.category || 'general'}] ${(f.content || '').slice(0, 200)}`).join('\n')
                : '(No facts)';
            const decisionsBlob = sprintDecisions.length
                ? sprintDecisions.slice(0, 20).map(d => `[${d.status || 'active'}] ${(d.content || '').slice(0, 200)}${d.owner ? ' (owner: ' + d.owner + ')' : ''}`).join('\n')
                : '(No decisions)';
            const risksBlob = sprintRisks.length
                ? sprintRisks.filter(r => r.status === 'open').slice(0, 20).map(r => `[${r.impact}/${r.likelihood}] ${(r.content || '').slice(0, 200)}${r.mitigation ? ' | mitigation: ' + r.mitigation.slice(0, 100) : ''}`).join('\n')
                : '(No open risks)';
            const questionsBlob = sprintQuestions.length
                ? sprintQuestions.filter(q => q.status !== 'answered' && q.status !== 'closed').slice(0, 20).map(q => `[${q.priority || 'medium'}] ${(q.content || '').slice(0, 200)}`).join('\n')
                : '(No unresolved questions)';

            let docContext = '';
            try {
                const { DocumentContextBuilder } = require('../../docindex');
                docContext = await DocumentContextBuilder.build(storage, { maxChars: 1500 });
            } catch (_) {}

            const promptRecord = await promptsService.getPrompt('sprint_task_generation');
            const template = promptRecord?.prompt_template || DEFAULT_SPRINT_PROMPT;
            const prompt = promptsService.renderPrompt?.(template, {
                SPRINT_NAME: sprint.name,
                SPRINT_START: sprint.start_date,
                SPRINT_END: sprint.end_date,
                SPRINT_CONTEXT: sprint.context || '',
                EMAILS: emailBlob,
                TRANSCRIPTS: transcriptBlob,
                EXISTING_ACTIONS: actionsBlob,
                FACTS: factsBlob,
                DECISIONS: decisionsBlob,
                RISKS: risksBlob,
                QUESTIONS: questionsBlob,
                DOCUMENT_CONTEXT: docContext
            }) || (DEFAULT_SPRINT_PROMPT + `\n\nSprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Context: ${sprint.context || 'None'}\n\nEmails:\n${emailBlob}\n\nTranscripts:\n${transcriptBlob}\n\nExisting actions:\n${actionsBlob}\n\nKnown facts:\n${factsBlob}\n\nDecisions:\n${decisionsBlob}\n\nOpen risks:\n${risksBlob}\n\nUnresolved questions:\n${questionsBlob}${docContext ? '\n\n' + docContext : ''}\n\nOutput JSON with new_tasks and existing_action_ids:`);

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId,
                prompt,
                temperature: 0.3,
                maxTokens: 4096,
                context: 'sprint-task-generation'
            }, config);
            if (!routerResult.success) {
                jsonResponse(res, { error: routerResult.error?.message || 'AI request failed' }, 400);
                return true;
            }
            const raw = extractRouterText(routerResult) || '';
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
            const sprint = await storage.getSprint(sprintId, projectId);
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

    // GET /api/sprints/:id/report – full report data (sprint, actions, knowledge, breakdown for chart)
    const reportMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/report$/);
    if (reportMatch && req.method === 'GET') {
        try {
            const sprintId = reportMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) {
                jsonResponse(res, { error: 'Sprint not found' }, 404);
                return true;
            }
            const [actions, facts, decisions, risks, questions] = await Promise.all([
                storage.getActions(null, null, sprintId),
                storage.getFacts ? storage.getFacts(null, sprintId) : [],
                storage.getDecisions ? storage.getDecisions(null, sprintId) : [],
                storage.getRisks ? storage.getRisks(null, sprintId) : [],
                storage.getQuestions ? storage.getQuestions(null, null, sprintId) : [],
            ]);
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
            let graph_context = null;
            const graphProvider = storage.getGraphProvider?.();
            if (graphProvider && graphProvider.connected && typeof graphProvider.getSprintReportContext === 'function') {
                try {
                    const gRes = await graphProvider.getSprintReportContext(sprintId);
                    if (gRes?.ok) {
                        graph_context = {
                            sprint_name: gRes.sprint?.name || null,
                            sprint_context: gRes.sprint?.context || null,
                            assignees: gRes.assignees || [],
                        };
                    }
                } catch (_) { /* graph context is optional */ }
            }
            jsonResponse(res, {
                sprint,
                actions: actions || [],
                facts: facts || [],
                decisions: decisions || [],
                risks: risks || [],
                questions: questions || [],
                breakdown: { by_status: byStatus, by_assignee: byAssignee },
                total_task_points: totalPoints,
                completed_task_points: completedPoints,
                total_tasks: (actions || []).length,
                completed_tasks: (actions || []).filter(a => a.status === 'completed').length,
                knowledge_counts: {
                    facts: (facts || []).length,
                    decisions: (decisions || []).length,
                    risks: (risks || []).length,
                    questions: (questions || []).length,
                },
                graph_context,
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
            const sprint = await storage.getSprint(sprintId, projectId);
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
            const analyzeTemplate = await loadPromptTemplate(
                'sprint_report_analyze',
                'You are a Scrum Master. Analyze this sprint report and provide a short structured analysis (what was achieved, velocity insight, any blockers or risks, recommendations). Keep it concise.\n\n{{SUMMARY}}'
            );
            const prompt = promptsService.renderPrompt(analyzeTemplate, { SUMMARY: summary });
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId,
                prompt,
                temperature: 0.3,
                maxTokens: 1024,
                context: 'sprint-report-analyze',
            }, config);
            const aiAnalysis = extractRouterText(routerResult);
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
            const sprint = await storage.getSprint(sprintId, projectId);
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
            const businessTemplate = await loadPromptTemplate(
                'sprint_report_business',
                'You are an executive assistant. Write a very short business-facing sprint summary (2-4 sentences) for stakeholders: what was the sprint goal, what was delivered, and overall status. No technical jargon. Be positive and clear.\n\n{{SUMMARY}}'
            );
            const prompt = promptsService.renderPrompt(businessTemplate, { SUMMARY: summary });
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId,
                prompt,
                temperature: 0.3,
                maxTokens: 512,
                context: 'sprint-report-business',
            }, config);
            const businessReport = extractRouterText(routerResult);
            jsonResponse(res, { summary, business_report: businessReport });
        } catch (e) {
            log.warn({ event: 'sprint_business_report_error', reason: e.message }, 'Business report failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    /**
     * Build a structured text representation of the sprint report for LLM consumption.
     * Enriches with user stories, ontology terminology, graph context, and
     * optional AI analysis/business summary sections.
     * @param {string} sprintId
     * @param {object} options - { include_analysis, include_business }
     * @returns {string|null} Markdown-like report text, or null if sprint not found.
     */
    async function buildReportData(sprintId, options = {}) {
        const { include_analysis = false, include_business = false } = options;
        const sprint = await storage.getSprint(sprintId, projectId);
        if (!sprint) return null;
        const [actions, sprintFacts, sprintDecisions, sprintRisks, sprintQuestions] = await Promise.all([
            storage.getActions(null, null, sprintId),
            storage.getFacts ? storage.getFacts(null, sprintId) : [],
            storage.getDecisions ? storage.getDecisions(null, sprintId) : [],
            storage.getRisks ? storage.getRisks(null, sprintId) : [],
            storage.getQuestions ? storage.getQuestions(null, null, sprintId) : [],
        ]);
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
            `Conhecimento: ${(sprintFacts || []).length} factos, ${(sprintDecisions || []).length} decisões, ${(sprintRisks || []).length} riscos, ${(sprintQuestions || []).length} perguntas`,
            '',
            '## Ontologia (modelo do grafo)',
            'Entidades: Sprint, Action/Task, Person, UserStory, Fact, Decision, Risk, Question. Relações: PART_OF_SPRINT (Entity→Sprint), ASSIGNED_TO (Task→Person), IMPLEMENTS (Task→UserStory), DEPENDS_ON (Task→Task), EXTRACTED_FROM (Entity→Document). Use esta terminologia quando relevante.',
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
            (sprintFacts || []).length > 0 ? '' : null,
            (sprintFacts || []).length > 0 ? '## Factos extraídos neste sprint' : null,
            ...((sprintFacts || []).slice(0, 30).map(f => `- [${f.category || 'general'}] ${(f.content || '').substring(0, 150)}`)),
            (sprintFacts || []).length > 30 ? `... e mais ${(sprintFacts || []).length - 30} factos` : null,
            (sprintDecisions || []).length > 0 ? '' : null,
            (sprintDecisions || []).length > 0 ? '## Decisões deste sprint' : null,
            ...((sprintDecisions || []).slice(0, 20).map(d => `- [${d.status || 'active'}] ${(d.content || '').substring(0, 150)}${d.owner ? ` (por: ${d.owner})` : ''}`)),
            (sprintRisks || []).length > 0 ? '' : null,
            (sprintRisks || []).length > 0 ? '## Riscos identificados neste sprint' : null,
            ...((sprintRisks || []).slice(0, 20).map(r => `- [${r.impact || 'medium'}/${r.status || 'open'}] ${(r.content || '').substring(0, 150)}`)),
            (sprintQuestions || []).length > 0 ? '' : null,
            (sprintQuestions || []).length > 0 ? '## Perguntas em aberto neste sprint' : null,
            ...((sprintQuestions || []).slice(0, 20).map(q => `- [${q.status || 'open'}] ${(q.content || '').substring(0, 150)}`)),
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
                const completed = (actions || []).filter(a => a.status === 'completed');
                const pending = (actions || []).filter(a => a.status !== 'completed' && a.status !== 'cancelled');
                const total = (actions || []).length;
                const tp = (actions || []).reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);
                const dp = completed.reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);

                const inlineSummary = [
                    `Sprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Context: ${sprint.context || 'None'}. Tasks: ${total} total, ${completed.length} completed, ${pending.length} pending.`,
                    tp > 0 ? `Points: ${dp}/${tp} completed.` : '',
                ].filter(Boolean).join(' ');

                const runAnalysis = include_analysis ? (async () => {
                    const tpl = await loadPromptTemplate('sprint_report_analyze',
                        'You are a Scrum Master. Analyze this sprint and provide a short structured analysis (what was achieved, velocity, blockers, recommendations). Keep it concise.\n\n{{SUMMARY}}');
                    const p = promptsService.renderPrompt(tpl, { SUMMARY: inlineSummary });
                    const r = await llmRouter.routeAndExecute('processing', 'generateText', {
                        projectId, prompt: p, temperature: 0.3, maxTokens: 1024, context: 'sprint-report-analyze-inline',
                    }, config);
                    return extractRouterText(r) || '';
                })() : Promise.resolve('');

                const businessSummary = `Sprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Goals: ${sprint.context || 'N/A'}. Delivery: ${completed.length}/${total} tasks completed (${total ? Math.round((completed.length / total) * 100) : 0}%).`;
                const runBusiness = include_business ? (async () => {
                    const tpl = await loadPromptTemplate('sprint_report_business',
                        'You are an executive assistant. Write a very short business-facing sprint summary (2-4 sentences) for stakeholders. No technical jargon.\n\n{{SUMMARY}}');
                    const p = promptsService.renderPrompt(tpl, { SUMMARY: businessSummary });
                    const r = await llmRouter.routeAndExecute('processing', 'generateText', {
                        projectId, prompt: p, temperature: 0.3, maxTokens: 512, context: 'sprint-report-business-inline',
                    }, config);
                    return extractRouterText(r) || '';
                })() : Promise.resolve('');

                const [aiAnalysis, businessReport] = await Promise.all([runAnalysis, runBusiness]);
                if (aiAnalysis) text += '\n\n## Análise IA\n' + aiAnalysis;
                if (businessReport) text += '\n\n## Relatório executivo (Business)\n' + businessReport;
            } catch (e) {
                log.warn({ event: 'report_data_analysis_error', reason: e.message }, 'Optional analysis failed');
            }
        }
        return text;
    }

    /** Strip markdown code fences and extract the HTML document from LLM output. */
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
            const sprint = await storage.getSprint(sprintId, projectId);
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
                    .replace(/\{\{LOGO_URL\}\}/g, safeUrl(companyVars.COMPANY_LOGO_URL))
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

            const docResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId,
                prompt,
                temperature: 0.3,
                maxTokens: 16384,
                context: 'sprint-report-document',
            }, config);

            const raw = extractRouterText(docResult) || '';
            const html = extractHtmlFromResponse(raw);
            if (!html) {
                jsonResponse(res, { error: docResult.error?.message || 'Model did not return valid HTML' }, 500);
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
            const sprint = await storage.getSprint(sprintId, projectId);
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
                    .replace(/\{\{LOGO_URL\}\}/g, safeUrl(companyVars.COMPANY_LOGO_URL))
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

            const presResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId,
                prompt,
                temperature: 0.3,
                maxTokens: 16384,
                context: 'sprint-report-presentation',
            }, config);

            const raw = extractRouterText(presResult) || '';
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

    // GET /api/sprints/:id/velocity — velocity data with daily burndown
    const velocityMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/velocity$/);
    if (velocityMatch && req.method === 'GET') {
        try {
            const sprintId = velocityMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const [actions, vFacts, vDecisions, vRisks, vQuestions] = await Promise.all([
                storage.getActions(null, null, sprintId),
                storage.getFacts?.(null, sprintId) ?? [],
                storage.getDecisions?.(null, sprintId) ?? [],
                storage.getRisks?.(null, sprintId) ?? [],
                storage.getQuestions?.(null, null, sprintId) ?? []
            ]);
            const startDate = new Date(sprint.start_date);
            const endDate = new Date(sprint.end_date);
            const totalTasks = (actions || []).length;
            const totalPoints = (actions || []).reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);

            const dailyProgress = [];
            const current = new Date(startDate);
            while (current <= endDate) {
                const dateStr = current.toISOString().slice(0, 10);
                const completedByDate = (actions || []).filter(a =>
                    a.status === 'completed' && a.updated_at && new Date(a.updated_at).toISOString().slice(0, 10) <= dateStr
                );
                const doneT = completedByDate.length;
                const donePts = completedByDate.reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0);
                dailyProgress.push({
                    date: dateStr,
                    completed_tasks: doneT,
                    completed_points: donePts,
                    remaining_tasks: totalTasks - doneT,
                    remaining_points: totalPoints - donePts,
                });
                current.setDate(current.getDate() + 1);
            }

            const allSprints = await storage.getSprints(projectId);
            const velocityHistory = [];
            for (const sp of (allSprints || [])) {
                if (sp.status !== 'completed' && sp.id !== sprintId) continue;
                const spActions = await storage.getActions(null, null, sp.id);
                const spCompleted = (spActions || []).filter(a => a.status === 'completed');
                velocityHistory.push({
                    sprint_id: sp.id,
                    sprint_name: sp.name,
                    start_date: sp.start_date,
                    end_date: sp.end_date,
                    total_points: (spActions || []).reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0),
                    completed_points: spCompleted.reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0),
                    total_tasks: (spActions || []).length,
                    completed_tasks: spCompleted.length,
                });
            }

            jsonResponse(res, {
                sprint_id: sprintId,
                sprint_name: sprint.name,
                start_date: sprint.start_date,
                end_date: sprint.end_date,
                total_points: totalPoints,
                completed_points: (actions || []).filter(a => a.status === 'completed').reduce((s, a) => s + (a.task_points != null ? Number(a.task_points) : 0), 0),
                total_tasks: totalTasks,
                completed_tasks: (actions || []).filter(a => a.status === 'completed').length,
                daily_progress: dailyProgress,
                velocity_history: velocityHistory,
                knowledge_counts: {
                    facts: (vFacts || []).length,
                    decisions: (vDecisions || []).length,
                    risks: (vRisks || []).length,
                    questions: (vQuestions || []).length,
                },
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/sprints/:id/health — health score
    const healthMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/health$/);
    if (healthMatch && req.method === 'GET') {
        try {
            const sprintId = healthMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const [actions, sprintRisks, sprintQuestions] = await Promise.all([
                storage.getActions(null, null, sprintId),
                storage.getRisks?.(null, sprintId) ?? [],
                storage.getQuestions?.(null, null, sprintId) ?? []
            ]);
            const total = (actions || []).length;
            const completed = (actions || []).filter(a => a.status === 'completed').length;
            const overdue = (actions || []).filter(a => a.status === 'overdue').length;
            const inProgress = (actions || []).filter(a => a.status === 'in_progress').length;
            const now = new Date();
            const start = new Date(sprint.start_date);
            const end = new Date(sprint.end_date);
            const totalDays = Math.max(1, (end - start) / 86400000);
            const elapsedDays = Math.max(0, Math.min(totalDays, (now - start) / 86400000));
            const timeProgress = elapsedDays / totalDays;
            const completionRate = total > 0 ? completed / total : 0;
            const overdueRatio = total > 0 ? overdue / total : 0;

            const assignees = {};
            (actions || []).forEach(a => {
                const owner = (a.owner || '').trim() || '(unassigned)';
                assignees[owner] = (assignees[owner] || 0) + 1;
            });
            const counts = Object.values(assignees);
            const avgPerPerson = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
            const distributionVariance = counts.length > 1
                ? counts.reduce((s, c) => s + Math.pow(c - avgPerPerson, 2), 0) / counts.length
                : 0;
            const maxVariance = Math.pow(total, 2);
            const distributionBalance = maxVariance > 0 ? 1 - Math.min(1, distributionVariance / maxVariance) : 1;

            const expectedCompletion = timeProgress;
            const velocityTrend = expectedCompletion > 0 ? Math.min(1.5, completionRate / expectedCompletion) : (completionRate > 0 ? 1.5 : 0.5);

            const openRisks = (sprintRisks || []).filter(r => r.status === 'open');
            const highImpactRisks = openRisks.filter(r => r.impact === 'high' || r.impact === 'critical');
            const unresolvedQuestions = (sprintQuestions || []).filter(q => q.status !== 'answered' && q.status !== 'closed');

            const riskPenalty = Math.min(1, highImpactRisks.length * 0.15 + Math.max(0, openRisks.length - 2) * 0.05);
            const questionPenalty = Math.min(0.5, unresolvedQuestions.length * 0.03);
            const knowledgeHealthFactor = Math.max(0, 1 - riskPenalty - questionPenalty);

            const score = Math.round(
                (completionRate * 25) +
                (Math.min(1, velocityTrend) * 20) +
                ((1 - overdueRatio) * 20) +
                (distributionBalance * 10) +
                ((total > 0 ? 1 : 0) * 10) +
                (knowledgeHealthFactor * 15)
            );
            const clampedScore = Math.max(0, Math.min(100, score));

            const alerts = [];
            if (overdueRatio > 0.3) alerts.push(`${overdue} tasks are overdue (${Math.round(overdueRatio * 100)}%)`);
            if (timeProgress > 0.7 && completionRate < 0.3) alerts.push('Sprint is 70%+ through timeline but less than 30% complete');
            if (timeProgress > 0.9 && completionRate < 0.5) alerts.push('Sprint ending soon with less than 50% completion');
            if (counts.length > 1 && distributionBalance < 0.5) alerts.push('Task distribution is uneven across team members');
            if (inProgress === 0 && completed < total && sprint.status === 'active') alerts.push('No tasks currently in progress');
            if (highImpactRisks.length > 0) alerts.push(`${highImpactRisks.length} high-impact risk${highImpactRisks.length > 1 ? 's' : ''} unresolved`);
            if (unresolvedQuestions.length >= 5) alerts.push(`${unresolvedQuestions.length} questions remain unanswered`);

            const riskLevel = clampedScore >= 75 ? 'low' : clampedScore >= 50 ? 'medium' : clampedScore >= 25 ? 'high' : 'critical';

            jsonResponse(res, {
                score: clampedScore,
                factors: {
                    completion_rate: Math.round(completionRate * 100),
                    time_progress: Math.round(timeProgress * 100),
                    velocity_trend: Math.round(Math.min(1, velocityTrend) * 100),
                    overdue_ratio: Math.round(overdueRatio * 100),
                    distribution_balance: Math.round(distributionBalance * 100),
                    knowledge_health: Math.round(knowledgeHealthFactor * 100),
                    open_risks: openRisks.length,
                    high_impact_risks: highImpactRisks.length,
                    unresolved_questions: unresolvedQuestions.length,
                },
                risk_level: riskLevel,
                alerts,
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/sprints/:id/retrospective — load saved retrospective
    const retroGetMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/retrospective$/);
    if (retroGetMatch && req.method === 'GET') {
        try {
            const sprintId = retroGetMatch[1];
            const retro = await storage.getRetrospective(sprintId);
            jsonResponse(res, retro || { sprint_id: sprintId, went_well: [], went_wrong: [], action_items: [], ai_suggestions: null });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/retrospective — AI-generated retrospective
    const retroMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/retrospective$/);
    if (retroMatch && req.method === 'POST') {
        try {
            const sprintId = retroMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const [actions, sprintFacts, sprintDecisions, sprintRisks, sprintQuestions] = await Promise.all([
                storage.getActions(null, null, sprintId),
                storage.getFacts?.(null, sprintId) ?? [],
                storage.getDecisions?.(null, sprintId) ?? [],
                storage.getRisks?.(null, sprintId) ?? [],
                storage.getQuestions?.(null, null, sprintId) ?? []
            ]);
            const completed = (actions || []).filter(a => a.status === 'completed');
            const overdue = (actions || []).filter(a => a.status === 'overdue');
            const pending = (actions || []).filter(a => a.status === 'pending');
            const total = (actions || []).length;

            const body = await parseBody(req).catch(() => ({}));
            const wentWell = Array.isArray(body.went_well) ? body.went_well : [];
            const wentWrong = Array.isArray(body.went_wrong) ? body.went_wrong : [];
            const actionItemsInput = Array.isArray(body.action_items) ? body.action_items : [];

            const resolvedRisks = (sprintRisks || []).filter(r => r.status === 'mitigated' || r.status === 'resolved' || r.status === 'closed');
            const openRisks = (sprintRisks || []).filter(r => r.status === 'open');
            const answeredQuestions = (sprintQuestions || []).filter(q => q.status === 'answered' || q.status === 'closed');
            const pendingQuestions = (sprintQuestions || []).filter(q => q.status !== 'answered' && q.status !== 'closed');

            const sprintSummary = [
                `Sprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date}). Context: ${sprint.context || 'N/A'}.`,
                `Results: ${completed.length}/${total} completed, ${overdue.length} overdue, ${pending.length} pending.`,
                `Knowledge: ${(sprintFacts || []).length} facts, ${(sprintDecisions || []).length} decisions, ${(sprintRisks || []).length} risks, ${(sprintQuestions || []).length} questions.`,
                completed.length ? `Completed: ${completed.map(a => a.task || a.content).slice(0, 10).join('; ')}` : '',
                overdue.length ? `Overdue: ${overdue.map(a => a.task || a.content).slice(0, 5).join('; ')}` : '',
                wentWell.length ? `Team says went well: ${wentWell.join('; ')}` : '',
                wentWrong.length ? `Team says needs improvement: ${wentWrong.join('; ')}` : '',
                (sprintDecisions || []).length ? `Key decisions made: ${sprintDecisions.slice(0, 8).map(d => (d.content || '').slice(0, 100)).join('; ')}` : '',
                resolvedRisks.length ? `Risks mitigated: ${resolvedRisks.slice(0, 5).map(r => (r.content || '').slice(0, 80)).join('; ')}` : '',
                openRisks.length ? `Risks still open: ${openRisks.slice(0, 5).map(r => `[${r.impact}] ${(r.content || '').slice(0, 80)}`).join('; ')}` : '',
                answeredQuestions.length ? `Questions answered: ${answeredQuestions.length}` : '',
                pendingQuestions.length ? `Questions still open: ${pendingQuestions.slice(0, 5).map(q => (q.content || '').slice(0, 80)).join('; ')}` : '',
            ].filter(Boolean).join('\n');

            let aiSuggestions = null;
            const retroTemplate = await loadPromptTemplate(
                'sprint_retrospective',
                'You are a Scrum Master facilitating a sprint retrospective. Based on the sprint data, knowledge base insights, and team feedback, provide:\n1. Key insights about what went well (2-3 points)\n2. Root causes for what didn\'t go well (2-3 points)\n3. Knowledge management assessment: decisions made, risks handled, questions resolved (1-2 points)\n4. Specific, actionable improvement suggestions for the next sprint (3-5 points)\nKeep it concise and practical.\n\n{{SPRINT_SUMMARY}}'
            );
            const retroPrompt = promptsService.renderPrompt(retroTemplate, { SPRINT_SUMMARY: sprintSummary });
            const retroResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId, prompt: retroPrompt, temperature: 0.3, maxTokens: 1024, context: 'sprint-retrospective',
            }, config);
            aiSuggestions = extractRouterText(retroResult);

            const saved = await storage.saveRetrospective(sprintId, {
                went_well: wentWell,
                went_wrong: wentWrong,
                action_items: actionItemsInput,
                ai_suggestions: aiSuggestions,
            });

            jsonResponse(res, saved);
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/clone — clone sprint (structure + optionally tasks)
    const cloneMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/clone$/);
    if (cloneMatch && req.method === 'POST') {
        try {
            const sourceId = cloneMatch[1];
            const source = await storage.getSprint(sourceId, projectId);
            if (!source) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const body = await parseBody(req).catch(() => ({}));
            const name = body.name || `${source.name} (Copy)`;
            const offsetDays = body.offset_days || 14;
            const cloneTasks = body.clone_tasks !== false;
            const sStart = new Date(source.start_date);
            const sEnd = new Date(source.end_date);
            const duration = (sEnd - sStart) / 86400000;
            const newStart = new Date(sEnd.getTime() + offsetDays * 86400000);
            const newEnd = new Date(newStart.getTime() + duration * 86400000);

            const newSprint = await storage.createSprint(projectId, {
                name,
                start_date: newStart.toISOString().slice(0, 10),
                end_date: newEnd.toISOString().slice(0, 10),
                context: body.context || source.context || null,
                analysis_start_date: null,
                analysis_end_date: null,
            });

            let tasksCloned = 0;
            if (cloneTasks && newSprint?.id) {
                const sourceActions = await storage.getActions(null, null, sourceId);
                for (const a of (sourceActions || [])) {
                    await storage.addActionItem?.({
                        task: a.task || a.content,
                        description: a.description ?? null,
                        size_estimate: a.size_estimate ?? null,
                        definition_of_done: a.definition_of_done || [],
                        acceptance_criteria: a.acceptance_criteria || [],
                        priority: a.priority || 'medium',
                        status: 'pending',
                        deadline: newEnd.toISOString().slice(0, 10),
                        task_points: a.task_points ?? null,
                        generation_source: 'sprint_cloned',
                        source_type: 'manual',
                        sprint_id: newSprint.id,
                    });
                    tasksCloned++;
                }
            }

            let knowledgeLinked = { facts: 0, decisions: 0, risks: 0, questions: 0 };
            if (body.clone_knowledge && newSprint?.id) {
                const entityTable = { facts: 'facts', decisions: 'decisions', risks: 'risks', questions: 'knowledge_questions' };
                for (const [key, table] of Object.entries(entityTable)) {
                    const { data, error: err } = await storage.supabase
                        .from(table)
                        .update({ sprint_id: newSprint.id })
                        .eq('sprint_id', sourceId)
                        .eq('project_id', projectId)
                        .select('id');
                    if (!err && data) knowledgeLinked[key] = data.length;
                }
            }

            jsonResponse(res, { ok: true, sprint: newSprint, tasks_cloned: tasksCloned, knowledge_linked: knowledgeLinked });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/bulk-assign — assign multiple entities to a sprint at once
    const bulkAssignMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/bulk-assign$/);
    if (bulkAssignMatch && req.method === 'POST') {
        try {
            const sprintId = bulkAssignMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const body = await parseBody(req);
            const entityType = body.entity_type;
            const entityIds = body.entity_ids;
            if (!entityType || !Array.isArray(entityIds) || entityIds.length === 0) {
                jsonResponse(res, { error: 'entity_type and entity_ids[] are required' }, 400);
                return true;
            }
            const tableMap = { fact: 'facts', decision: 'decisions', risk: 'risks', question: 'knowledge_questions', action: 'action_items' };
            const table = tableMap[entityType];
            if (!table) {
                jsonResponse(res, { error: `Invalid entity_type "${entityType}". Must be one of: ${Object.keys(tableMap).join(', ')}` }, 400);
                return true;
            }
            const { data, error: err } = await storage.supabase
                .from(table)
                .update({ sprint_id: sprintId })
                .eq('project_id', projectId)
                .in('id', entityIds)
                .select('id');
            if (err) throw err;
            jsonResponse(res, { ok: true, entity_type: entityType, assigned: (data || []).length, sprint_id: sprintId });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/standup — AI daily standup summary
    const standupMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/standup$/);
    if (standupMatch && req.method === 'POST') {
        try {
            const sprintId = standupMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const [actions, openRisks, openQuestions] = await Promise.all([
                storage.getActions(null, null, sprintId),
                storage.getRisks?.(null, sprintId) ?? [],
                storage.getQuestions?.(null, null, sprintId) ?? []
            ]);
            const today = new Date().toISOString().slice(0, 10);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

            const byOwner = {};
            (actions || []).forEach(a => {
                const owner = (a.owner || '').trim() || '(unassigned)';
                if (!byOwner[owner]) byOwner[owner] = { done: [], doing: [], blockers: [] };
                if (a.status === 'completed' && a.updated_at && a.updated_at.slice(0, 10) >= yesterday) {
                    byOwner[owner].done.push(a.task || a.content);
                }
                if (a.status === 'in_progress') {
                    byOwner[owner].doing.push(a.task || a.content);
                }
                if (a.status === 'overdue') {
                    byOwner[owner].blockers.push(a.task || a.content);
                }
            });

            const entries = Object.entries(byOwner).map(([person, data]) => ({ person, ...data }));
            const completed = (actions || []).filter(a => a.status === 'completed');
            const total = (actions || []).length;
            const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

            const activeRisks = (openRisks || []).filter(r => r.status === 'open');
            const pendingQuestions = (openQuestions || []).filter(q => q.status !== 'answered' && q.status !== 'closed');

            const standupBlob = entries.map(e =>
                `${e.person}:\n  Done: ${e.done.join(', ') || 'None'}\n  Doing: ${e.doing.join(', ') || 'None'}\n  Blockers: ${e.blockers.join(', ') || 'None'}`
            ).join('\n');
            const knowledgeBlob = [
                activeRisks.length > 0 ? `\nOpen risks (${activeRisks.length}):\n${activeRisks.slice(0, 10).map(r => `- [${r.impact}] ${(r.content || '').slice(0, 120)}`).join('\n')}` : '',
                pendingQuestions.length > 0 ? `\nUnresolved questions (${pendingQuestions.length}):\n${pendingQuestions.slice(0, 10).map(q => `- [${q.priority || 'medium'}] ${(q.content || '').slice(0, 120)}`).join('\n')}` : ''
            ].filter(Boolean).join('\n');
            const standupTemplate = await loadPromptTemplate(
                'sprint_standup',
                'Daily standup summary for sprint "{{SPRINT_NAME}}" ({{PCT}}% complete, {{COMPLETED}}/{{TOTAL}} tasks done).\n\n{{STANDUP_BLOB}}{{KNOWLEDGE_BLOB}}\n\nProvide a brief 2-3 sentence summary of team progress, highlight any blockers (including open risks and unresolved questions), and suggest focus areas for today. Be concise.'
            );
            const standupPrompt = promptsService.renderPrompt(standupTemplate, {
                SPRINT_NAME: sprint.name, PCT: String(pct), COMPLETED: String(completed.length), TOTAL: String(total), STANDUP_BLOB: standupBlob, KNOWLEDGE_BLOB: knowledgeBlob,
            });
            const standupResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId, prompt: standupPrompt, temperature: 0.3, maxTokens: 512, context: 'sprint-standup',
            }, config);
            const aiSummary = extractRouterText(standupResult);

            jsonResponse(res, { sprint_id: sprintId, date: today, entries, ai_summary: aiSummary });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/estimate-points — AI story point estimation
    const estimateMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/estimate-points$/);
    if (estimateMatch && req.method === 'POST') {
        try {
            const sprintId = estimateMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const body = await parseBody(req);
            const taskDescription = body.task || body.description || '';
            if (!taskDescription) { jsonResponse(res, { error: 'task or description required' }, 400); return true; }

            const actions = await storage.getActions(null, null, sprintId);
            const historicalRef = (actions || []).filter(a => a.task_points != null).slice(0, 10)
                .map(a => `"${(a.task || '').slice(0, 80)}" = ${a.task_points} pts`).join('\n');

            const estimateTemplate = await loadPromptTemplate(
                'sprint_estimate_points',
                'Estimate story points (Fibonacci: 1, 2, 3, 5, 8, 13, 21) for this task:\n\nTask: "{{TASK_DESCRIPTION}}"\n\n{{HISTORICAL_REF}}Output a JSON object with: { "points": <number>, "confidence": "high"|"medium"|"low", "reasoning": "<brief explanation>" }. Output only valid JSON.'
            );
            const estimatePrompt = promptsService.renderPrompt(estimateTemplate, {
                TASK_DESCRIPTION: taskDescription,
                HISTORICAL_REF: historicalRef ? `Historical reference from this sprint:\n${historicalRef}\n\n` : '',
            });
            const estimateResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                projectId, prompt: estimatePrompt, temperature: 0.2, maxTokens: 256, context: 'sprint-estimate-points',
            }, config);
            const raw = extractRouterText(estimateResult) || '';
            const cleaned = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
            let parsed;
            try { parsed = JSON.parse(cleaned); } catch (_) { parsed = { points: 3, confidence: 'low', reasoning: 'Could not parse AI response' }; }
            jsonResponse(res, parsed);
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/sprints/:id/capacity — capacity planning analysis
    const capacityMatch = pathname.match(/^\/api\/sprints\/([^/]+)\/capacity$/);
    if (capacityMatch && req.method === 'POST') {
        try {
            const sprintId = capacityMatch[1];
            const sprint = await storage.getSprint(sprintId, projectId);
            if (!sprint) { jsonResponse(res, { error: 'Sprint not found' }, 404); return true; }
            const body = await parseBody(req).catch(() => ({}));
            const capacities = body.capacities || {};
            const actions = await storage.getActions(null, null, sprintId);

            const byOwner = {};
            (actions || []).forEach(a => {
                const owner = (a.owner || '').trim() || '(unassigned)';
                if (!byOwner[owner]) byOwner[owner] = { assigned_points: 0, tasks: 0 };
                byOwner[owner].assigned_points += (a.task_points != null ? Number(a.task_points) : 0);
                byOwner[owner].tasks++;
            });

            const people = [...new Set([...Object.keys(byOwner), ...Object.keys(capacities)])];
            const result = people.map(person => {
                const available = capacities[person] || 0;
                const assigned = byOwner[person]?.assigned_points || 0;
                return {
                    person,
                    available_points: available,
                    assigned_points: assigned,
                    tasks: byOwner[person]?.tasks || 0,
                    utilization: available > 0 ? Math.round((assigned / available) * 100) : (assigned > 0 ? 999 : 0),
                    over_allocated: available > 0 && assigned > available,
                };
            });

            let aiRecommendation = null;
            if (Object.keys(capacities).length > 0) {
                const blob = result.map(r => `${r.person}: ${r.assigned_points}/${r.available_points} pts (${r.utilization}%)${r.over_allocated ? ' OVER-ALLOCATED' : ''}`).join('\n');
                const unassigned = (actions || []).filter(a => !(a.owner || '').trim());
                const capTemplate = await loadPromptTemplate(
                    'sprint_capacity',
                    'Sprint capacity analysis for "{{SPRINT_NAME}}":\n{{CAPACITY_BLOB}}\nUnassigned tasks: {{UNASSIGNED_COUNT}}\n\nSuggest task redistribution to balance the workload. Be specific about which tasks to move between people. Keep it to 3-5 actionable suggestions.'
                );
                const capPrompt = promptsService.renderPrompt(capTemplate, {
                    SPRINT_NAME: sprint.name, CAPACITY_BLOB: blob, UNASSIGNED_COUNT: String(unassigned.length),
                });
                const capResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                    projectId, prompt: capPrompt, temperature: 0.3, maxTokens: 512, context: 'sprint-capacity',
                }, config);
                aiRecommendation = extractRouterText(capResult);
            }

            jsonResponse(res, { capacity: result, ai_recommendation: aiRecommendation });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleSprints, isSprintsRoute };
