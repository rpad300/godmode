/**
 * Knowledge Routes - Questions, Facts, Decisions, Risks, Actions
 * Extracted from src/server.js for modularization
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Check if pathname matches any knowledge route pattern
 */
function isKnowledgeRoute(pathname) {
    return pathname.startsWith('/api/questions') ||
           pathname.startsWith('/api/facts') ||
           pathname.startsWith('/api/decisions') ||
           pathname.startsWith('/api/risks') ||
           pathname.startsWith('/api/actions') ||
           pathname.startsWith('/api/user-stories') ||
           pathname === '/api/people';
}

/**
 * Handle all knowledge-related routes
 * @param {Object} ctx - Context object with req, res, pathname, storage, config, llm, llmConfig
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleKnowledge(ctx) {
    const { req, res, pathname, storage, config, llm, llmConfig } = ctx;
    const log = getLogger().child({ module: 'knowledge' });
    // Quick check - if not a knowledge route, return false immediately
    if (!isKnowledgeRoute(pathname)) {
        return false;
    }

    // ==================== Questions Routes ====================
    
    // GET /api/questions - Get questions
    if (pathname === '/api/questions' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const filters = {
            status: parsedUrl.query.status,
            priority: parsedUrl.query.priority
        };
        const questions = storage.getQuestions(filters);
        jsonResponse(res, { questions });
        return true;
    }

    // POST /api/questions - Add a new question with duplicate detection
    if (pathname === '/api/questions' && req.method === 'POST') {
        const body = await parseBody(req);
        const { content, priority, assigned_to, skipDedup } = body;

        if (!content || content.trim().length < 5) {
            jsonResponse(res, { error: 'Content is required (min 5 chars)', success: false }, 400);
            return true;
        }

        const result = storage.addQuestion({
            content: content.trim(),
            priority: priority || 'medium',
            assigned_to: assigned_to || null,
            source_file: 'quick_capture'
        }, skipDedup === true);

        if (result.action === 'duplicate') {
            jsonResponse(res, {
                success: false,
                duplicate: true,
                existingId: result.id,
                similarity: Math.round(result.similarity * 100),
                message: `Similar question exists (${Math.round(result.similarity * 100)}% match)`
            });
            return true;
        }

        storage.recordDailyStats();
        jsonResponse(res, { success: true, id: result.id, action: result.action });
        return true;
    }

    // PUT /api/questions/:id - Update a question
    const questionUpdateMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)$/);
    if (questionUpdateMatch && req.method === 'PUT') {
        const questionId = questionUpdateMatch[1];
        const body = await parseBody(req);
        
        log.debug({ event: 'questions_update', questionId, bodyPreview: JSON.stringify(body).substring(0, 200) }, 'Updating question');
        const result = await storage.updateQuestion(questionId, body);
        log.debug({ event: 'questions_update_result', questionId, resultPreview: JSON.stringify(result).substring(0, 200) }, 'Update result');
        
        if (result.success || result.ok) {
            // Sync to FalkorDB if connected
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    const { getGraphSync } = require('../../sync');
                    const graphSync = getGraphSync({ graphProvider, storage });
                    await graphSync.syncQuestion(result.question);
                    log.debug({ event: 'knowledge_question_synced', questionId }, 'Question updated in FalkorDB');
                } catch (syncErr) {
                    log.warn({ event: 'knowledge_question_sync_error', questionId, reason: syncErr.message }, 'Question sync error');
                }
            }
            jsonResponse(res, { ok: true, success: true, question: result.question });
        } else {
            log.warn({ event: 'questions_update_failed', questionId, reason: result.error }, 'Update failed');
            jsonResponse(res, { ok: false, success: false, error: result.error || 'Question not found' }, 404);
        }
        return true;
    }

    // DELETE /api/questions/:id - Delete/dismiss a question
    const questionDeleteMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)$/);
    if (questionDeleteMatch && req.method === 'DELETE') {
        const questionId = questionDeleteMatch[1];
        const body = await parseBody(req);
        const reason = body.reason || 'deleted';
        
        try {
            const questions = storage.getQuestions();
            const question = questions.find(q => 
                q.id === questionId || String(q.id) === String(questionId)
            );
            
            if (!question) {
                jsonResponse(res, { ok: false, error: 'Question not found' }, 404);
                return true;
            }
            
            await storage.updateQuestion(questionId, {
                status: 'dismissed',
                dismissed_reason: reason,
                dismissed_at: new Date().toISOString()
            });
            
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    await graphProvider.query(
                        `MATCH (q:Question {id: $id}) DETACH DELETE q`,
                        { id: questionId }
                    );
                    log.debug({ event: 'knowledge_question_deleted', questionId }, 'Question deleted from FalkorDB');
                } catch (syncErr) {
                    log.warn({ event: 'knowledge_question_delete_sync_error', questionId, reason: syncErr.message }, 'Question delete sync error');
                }
            }
            
            jsonResponse(res, { ok: true, deleted: true, reason });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/questions/by-person
    if (pathname === '/api/questions/by-person' && req.method === 'GET') {
        const grouped = storage.getQuestionsByPerson();
        jsonResponse(res, { questionsByPerson: grouped });
        return true;
    }

    // GET /api/questions/by-team
    if (pathname === '/api/questions/by-team' && req.method === 'GET') {
        const grouped = storage.getQuestionsByTeam();
        jsonResponse(res, { questionsByTeam: grouped });
        return true;
    }

    // ==================== Facts Routes ====================
    
    // GET /api/facts/deleted
    if (pathname === '/api/facts/deleted' && req.method === 'GET') {
        try {
            const deleted = storage.getDeletedFacts ? await storage.getDeletedFacts() : [];
            jsonResponse(res, { facts: deleted || [], total: (deleted || []).length });
        } catch (e) {
            jsonResponse(res, { facts: [], total: 0, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/facts
    if (pathname === '/api/facts' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const category = parsedUrl.query.category;
        const documentId = parsedUrl.query.document_id || parsedUrl.query.documentId;
        try {
            const facts = documentId
                ? (storage.getFactsByDocument && (await storage.getFactsByDocument(documentId))) || []
                : await storage.getFacts(category);
            const total = Array.isArray(facts) ? facts.length : 0;
            jsonResponse(res, { facts: facts || [], total });
        } catch (e) {
            jsonResponse(res, { facts: [], total: 0, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/facts
    if (pathname === '/api/facts' && req.method === 'POST') {
        const body = await parseBody(req);
        const { content, category, skipDedup } = body;

        if (!content || content.trim().length < 5) {
            jsonResponse(res, { error: 'Content is required (min 5 chars)', success: false }, 400);
            return true;
        }

        const result = storage.addFact({
            content: content.trim(),
            category: category || 'General',
            source_file: 'quick_capture'
        }, skipDedup === true);

        if (result.action === 'duplicate') {
            jsonResponse(res, {
                success: false,
                duplicate: true,
                existingId: result.id,
                similarity: Math.round(result.similarity * 100),
                message: `Similar fact exists (${Math.round(result.similarity * 100)}% match)`
            });
            return true;
        }

        if (result.action === 'skipped') {
            jsonResponse(res, {
                success: false,
                error: `Fact skipped: ${result.reason}`,
                reason: result.reason
            }, 400);
            return true;
        }

        storage.recordDailyStats();
        jsonResponse(res, { success: true, id: result.id, action: result.action });
        return true;
    }

    // GET /api/facts/:id/events
    const factEventsMatch = pathname.match(/^\/api\/facts\/([^/]+)\/events$/);
    if (factEventsMatch && req.method === 'GET') {
        const factId = factEventsMatch[1];
        try {
            const events = storage.getFactEvents && (await storage.getFactEvents(factId)) || [];
            jsonResponse(res, { events });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/facts/:id/similar
    const factSimilarMatch = pathname.match(/^\/api\/facts\/([^/]+)\/similar$/);
    if (factSimilarMatch && req.method === 'GET') {
        const factId = factSimilarMatch[1];
        const parsedUrl = parseUrl(req.url);
        const limit = Math.min(parseInt(parsedUrl.query.limit, 10) || 10, 50);
        try {
            const similar = storage.getSimilarFacts ? await storage.getSimilarFacts(factId, limit) : [];
            jsonResponse(res, {
                similar: similar.map(s => ({ fact: s.fact, similarityScore: s.similarityScore }))
            });
        } catch (e) {
            jsonResponse(res, { error: e.message, similar: [] }, 500);
        }
        return true;
    }

    // GET /api/facts/:id
    const factIdMatch = pathname.match(/^\/api\/facts\/([^/]+)$/);
    if (factIdMatch && req.method === 'GET') {
        const factId = factIdMatch[1];
        try {
            const fact = storage.getFact ? await storage.getFact(factId) : null;
            if (!fact) {
                jsonResponse(res, { error: 'Fact not found' }, 404);
                return true;
            }
            jsonResponse(res, { fact });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/facts/:id
    const factPutMatch = pathname.match(/^\/api\/facts\/([^/]+)$/);
    if (factPutMatch && req.method === 'PUT') {
        const factId = factPutMatch[1];
        const body = await parseBody(req).catch(() => ({}));
        try {
            const fact = await storage.updateFact(factId, {
                content: body.content,
                category: body.category,
                confidence: body.confidence,
                verified: body.verified
            });
            jsonResponse(res, { fact });
        } catch (e) {
            jsonResponse(res, { error: e.message }, e.message === 'Fact not found' ? 404 : 500);
        }
        return true;
    }

    // POST /api/facts/:id/restore
    const factRestoreMatch = pathname.match(/^\/api\/facts\/([^/]+)\/restore$/);
    if (factRestoreMatch && req.method === 'POST') {
        const factId = factRestoreMatch[1];
        try {
            const fact = await storage.restoreFact(factId);
            jsonResponse(res, { success: true, fact });
        } catch (e) {
            jsonResponse(res, { error: e.message }, e.message === 'Fact not found' || e.message === 'Fact is not deleted' ? 404 : 500);
        }
        return true;
    }

    // DELETE /api/facts/:id
    const factDelMatch = pathname.match(/^\/api\/facts\/([^/]+)$/);
    if (factDelMatch && req.method === 'DELETE') {
        const factId = factDelMatch[1];
        try {
            await storage.deleteFact(factId, true);
            jsonResponse(res, { success: true });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // ==================== Decisions Routes ====================
    
    // GET /api/decisions/deleted
    if (pathname === '/api/decisions/deleted' && req.method === 'GET') {
        try {
            const decisions = storage.getDeletedDecisions ? await storage.getDeletedDecisions() : [];
            jsonResponse(res, { decisions });
        } catch (e) {
            jsonResponse(res, { error: e.message, decisions: [] }, 500);
        }
        return true;
    }

    // GET /api/decisions
    if (pathname === '/api/decisions' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status || null;
            const decisions = storage.getDecisions ? await storage.getDecisions(status) : [];
            jsonResponse(res, { decisions });
        } catch (e) {
            jsonResponse(res, { error: e.message, decisions: [] }, 500);
        }
        return true;
    }

    // POST /api/decisions
    if (pathname === '/api/decisions' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const content = (body.content || body.decision || '').trim();
            if (!content) {
                jsonResponse(res, { error: 'Content is required' }, 400);
                return true;
            }
            const decision = {
                content,
                owner: body.owner,
                date: body.decision_date || body.date,
                context: body.context || body.rationale,
                status: body.status || 'active',
                source_document_id: body.source_document_id,
                source_file: body.source_file,
                generation_source: body.generation_source || 'manual',
                rationale: body.rationale,
                made_by: body.made_by || body.owner,
                approved_by: body.approved_by,
                decided_at: body.decided_at,
                impact: body.impact,
                reversible: body.reversible,
                summary: body.summary
            };
            const created = storage.addDecision ? await storage.addDecision(decision) : null;
            if (!created) {
                jsonResponse(res, { error: 'Failed to create decision' }, 500);
                return true;
            }
            jsonResponse(res, { decision: created, id: created.id });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/decisions/suggest
    if (pathname === '/api/decisions/suggest' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const content = (body.content || body.decision || '').trim();
            const rationale = (body.rationale || '').trim();
            const { runDecisionSuggest } = require('../../decision-suggest/DecisionSuggestFlow');
            const result = await runDecisionSuggest(config, { content, rationale });
            if (result.error) {
                jsonResponse(res, { error: result.error }, 400);
                return true;
            }
            jsonResponse(res, {
                rationale: result.rationale || '',
                impact: result.impact || 'medium',
                impact_summary: result.impact_summary || '',
                summary: result.summary || ''
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/decisions/suggest-owner
    if (pathname === '/api/decisions/suggest-owner' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const content = (body.content || body.decision || '').trim();
            const rationale = (body.rationale || '').trim();
            const contacts = storage.getContacts ? await (Promise.resolve(storage.getContacts()).then(c => Array.isArray(c) ? c : [])) : [];
            const { runDecisionSuggestOwner } = require('../../decision-suggest/DecisionSuggestOwnerFlow');
            const result = await runDecisionSuggestOwner(config, { content, rationale, contacts });
            if (result.error) {
                jsonResponse(res, { error: result.error }, 400);
                return true;
            }
            jsonResponse(res, {
                suggested_owners: Array.isArray(result.suggested_owners) ? result.suggested_owners : []
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/decisions/:id/events
    const decisionEventsMatch = pathname.match(/^\/api\/decisions\/([^/]+)\/events$/);
    if (decisionEventsMatch && req.method === 'GET') {
        const decisionId = decisionEventsMatch[1];
        try {
            const events = storage.getDecisionEvents ? await storage.getDecisionEvents(decisionId) : [];
            jsonResponse(res, { events });
        } catch (e) {
            jsonResponse(res, { error: e.message, events: [] }, 500);
        }
        return true;
    }

    // GET /api/decisions/:id/similar
    const decisionSimilarMatch = pathname.match(/^\/api\/decisions\/([^/]+)\/similar$/);
    if (decisionSimilarMatch && req.method === 'GET') {
        const decisionId = decisionSimilarMatch[1];
        const parsedUrl = parseUrl(req.url);
        const limit = Math.min(parseInt(parsedUrl.query.limit, 10) || 10, 50);
        try {
            const similar = storage.getSimilarDecisions ? await storage.getSimilarDecisions(decisionId, limit) : [];
            jsonResponse(res, { similar: similar.map(s => ({ decision: s.decision, similarityScore: s.similarityScore })) });
        } catch (e) {
            jsonResponse(res, { error: e.message, similar: [] }, 500);
        }
        return true;
    }

    // POST /api/decisions/:id/restore
    const decisionRestoreMatch = pathname.match(/^\/api\/decisions\/([^/]+)\/restore$/);
    if (decisionRestoreMatch && req.method === 'POST') {
        const decisionId = decisionRestoreMatch[1];
        try {
            const decision = storage.restoreDecision ? await storage.restoreDecision(decisionId) : null;
            if (!decision) {
                jsonResponse(res, { error: 'Decision not found or not deleted' }, 404);
                return true;
            }
            jsonResponse(res, { decision });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/decisions/:id
    const decisionIdMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/);
    if (decisionIdMatch && req.method === 'GET') {
        const decisionId = decisionIdMatch[1];
        try {
            const decision = storage.getDecision ? await storage.getDecision(decisionId) : null;
            if (!decision) {
                jsonResponse(res, { error: 'Decision not found' }, 404);
                return true;
            }
            jsonResponse(res, { decision });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/decisions/:id
    const decisionPutMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/);
    if (decisionPutMatch && req.method === 'PUT') {
        const decisionId = decisionPutMatch[1];
        try {
            const body = await parseBody(req);
            const updates = {
                content: body.content || body.decision,
                owner: body.owner,
                date: body.decision_date || body.date,
                context: body.context,
                status: body.status,
                rationale: body.rationale,
                made_by: body.made_by,
                approved_by: body.approved_by,
                decided_at: body.decided_at,
                impact: body.impact,
                reversible: body.reversible,
                summary: body.summary
            };
            Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
            const decision = storage.updateDecision ? await storage.updateDecision(decisionId, updates) : null;
            if (!decision) {
                jsonResponse(res, { error: 'Decision not found' }, 404);
                return true;
            }
            jsonResponse(res, { decision });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/decisions/:id
    const decisionDelMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/);
    if (decisionDelMatch && req.method === 'DELETE') {
        const decisionId = decisionDelMatch[1];
        try {
            if (storage.deleteDecision) await storage.deleteDecision(decisionId, true);
            jsonResponse(res, { ok: true });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // ==================== Risks Routes ====================
    
    // GET /api/risks/deleted
    if (pathname === '/api/risks/deleted' && req.method === 'GET') {
        try {
            const risks = storage.getDeletedRisks ? await storage.getDeletedRisks() : [];
            jsonResponse(res, { risks });
        } catch (e) {
            jsonResponse(res, { error: e.message, risks: [] }, 500);
        }
        return true;
    }

    // GET /api/risks
    if (pathname === '/api/risks' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status || null;
            const risks = storage.getRisks ? await storage.getRisks(status) : [];
            jsonResponse(res, { risks });
        } catch (e) {
            jsonResponse(res, { error: e.message, risks: [] }, 500);
        }
        return true;
    }

    // GET /api/risks/by-category
    if (pathname === '/api/risks/by-category' && req.method === 'GET') {
        const grouped = storage.getRisksByCategory();
        jsonResponse(res, grouped);
        return true;
    }

    // POST /api/risks
    if (pathname === '/api/risks' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const content = (body.content ?? body.description ?? '').trim();
            if (!content) {
                jsonResponse(res, { error: 'Content is required' }, 400);
                return true;
            }
            const risk = {
                content,
                impact: body.impact || 'medium',
                likelihood: (body.likelihood ?? body.probability) || 'medium',
                mitigation: body.mitigation,
                status: body.status || 'open',
                owner: body.owner,
                source_document_id: body.source_document_id,
                source_file: body.source_file,
                generation_source: body.generation_source || 'manual'
            };
            const created = storage.addRisk ? await storage.addRisk(risk) : null;
            if (!created) {
                jsonResponse(res, { error: 'Failed to create risk' }, 500);
                return true;
            }
            jsonResponse(res, { risk: created, id: created.id });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/risks/suggest
    if (pathname === '/api/risks/suggest' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const content = (body.content ?? body.description ?? '').trim();
            const impact = body.impact || 'medium';
            const likelihood = (body.likelihood ?? body.probability) || 'medium';
            const contacts = storage.getContacts ? await (Promise.resolve(storage.getContacts()).then(c => Array.isArray(c) ? c : [])) : [];
            const { runRiskSuggest } = require('../../risk-suggest/RiskSuggestFlow');
            const result = await runRiskSuggest(config, { content, impact, likelihood, contacts });
            if (result.error) {
                jsonResponse(res, { error: result.error }, 400);
                return true;
            }
            jsonResponse(res, {
                suggested_owner: result.suggested_owner || '',
                suggested_mitigation: result.suggested_mitigation || '',
                suggested_owners: Array.isArray(result.suggested_owners) ? result.suggested_owners : []
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/risks/:id/events
    const riskEventsMatch = pathname.match(/^\/api\/risks\/([^/]+)\/events$/);
    if (riskEventsMatch && req.method === 'GET') {
        const riskId = riskEventsMatch[1];
        try {
            const events = storage.getRiskEvents ? await storage.getRiskEvents(riskId) : [];
            jsonResponse(res, { events });
        } catch (e) {
            jsonResponse(res, { error: e.message, events: [] }, 500);
        }
        return true;
    }

    // POST /api/risks/:id/restore
    const riskRestoreMatch = pathname.match(/^\/api\/risks\/([^/]+)\/restore$/);
    if (riskRestoreMatch && req.method === 'POST') {
        const riskId = riskRestoreMatch[1];
        try {
            const risk = storage.restoreRisk ? await storage.restoreRisk(riskId) : null;
            if (!risk) {
                jsonResponse(res, { error: 'Risk not found or not deleted' }, 404);
                return true;
            }
            jsonResponse(res, { risk });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/risks/:id
    const riskIdMatch = pathname.match(/^\/api\/risks\/([^/]+)$/);
    if (riskIdMatch && req.method === 'GET') {
        const riskId = riskIdMatch[1];
        try {
            const risk = storage.getRisk ? await storage.getRisk(riskId) : null;
            if (!risk) {
                jsonResponse(res, { error: 'Risk not found' }, 404);
                return true;
            }
            jsonResponse(res, { risk });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/risks/:id
    if (riskIdMatch && req.method === 'PUT') {
        const riskId = riskIdMatch[1];
        try {
            const body = await parseBody(req);
            const updates = {
                content: body.content ?? body.description,
                impact: body.impact,
                likelihood: body.likelihood ?? body.probability,
                mitigation: body.mitigation,
                status: body.status,
                owner: body.owner,
                source_file: body.source_file
            };
            Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
            const risk = storage.updateRisk ? await storage.updateRisk(riskId, updates) : null;
            if (!risk) {
                jsonResponse(res, { error: 'Risk not found' }, 404);
                return true;
            }
            jsonResponse(res, { risk });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/risks/:id
    if (riskIdMatch && req.method === 'DELETE') {
        const riskId = riskIdMatch[1];
        try {
            if (storage.deleteRisk) await storage.deleteRisk(riskId, true);
            jsonResponse(res, { ok: true, id: riskId });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // ==================== Actions Routes ====================

    // GET /api/actions/report – counts by status, by assignee, by sprint
    if (pathname === '/api/actions/report' && req.method === 'GET') {
        try {
            const actions = storage.getActions ? await storage.getActions() : (storage.getActionItems ? storage.getActionItems() : []);
            const byStatus = {};
            const byAssignee = {};
            const bySprint = {};
            (actions || []).forEach((a) => {
                const status = (a.status || 'pending').toLowerCase();
                byStatus[status] = (byStatus[status] || 0) + 1;
                const owner = (a.assignee || a.owner || '').trim() || '(unassigned)';
                byAssignee[owner] = (byAssignee[owner] || 0) + 1;
                const sprintKey = a.sprint_id || '(no sprint)';
                const sprintLabel = a.sprint_name || a.sprints?.name || sprintKey;
                if (!bySprint[sprintKey]) bySprint[sprintKey] = { count: 0, name: sprintLabel };
                bySprint[sprintKey].count += 1;
            });
            jsonResponse(res, { by_status: byStatus, by_assignee: byAssignee, by_sprint: bySprint });
        } catch (e) {
            jsonResponse(res, { error: e.message, by_status: {}, by_assignee: {}, by_sprint: {} }, 500);
        }
        return true;
    }

    // GET /api/actions
    if (pathname === '/api/actions' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const status = parsedUrl.query.status;
        const owner = parsedUrl.query.owner;
        const sprintId = parsedUrl.query.sprint_id || null;
        const decisionId = parsedUrl.query.decision_id || null;
        const actions = storage.getActions ? await storage.getActions(status, owner, sprintId, decisionId) : (storage.getActionItems ? storage.getActionItems(status) : []);
        jsonResponse(res, { actions: Array.isArray(actions) ? actions : [] });
        return true;
    }

    // GET /api/actions/deleted (soft-deleted actions for restore)
    if (pathname === '/api/actions/deleted' && req.method === 'GET') {
        try {
            const list = storage.getDeletedActions ? await storage.getDeletedActions() : [];
            jsonResponse(res, { actions: list });
        } catch (e) {
            jsonResponse(res, { error: e.message, actions: [] }, 500);
        }
        return true;
    }

    // POST /api/actions
    if (pathname === '/api/actions' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const task = (body.task || body.content || '').trim();
            if (!task) {
                jsonResponse(res, { error: 'Task/content is required' }, 400);
                return true;
            }
            const action = await storage.addActionItem({
                task,
                owner: body.owner || body.assignee || null,
                deadline: body.deadline || body.due_date || null,
                priority: body.priority || 'medium',
                status: body.status || 'pending',
                source_file: body.source_file || null,
                source_document_id: body.source_document_id || null,
                source_email_id: body.source_email_id || null,
                source_type: body.source_type || null,
                generation_source: body.generation_source || 'manual',
                requested_by: body.requested_by || null,
                requested_by_contact_id: body.requested_by_contact_id || null,
                supporting_document_ids: Array.isArray(body.supporting_document_ids) ? body.supporting_document_ids : (body.supporting_document_ids ? [body.supporting_document_ids] : []),
                parent_story_ref: body.parent_story_ref || body.parent_story || null,
                parent_story_id: body.parent_story_id || null,
                size_estimate: body.size_estimate || body.size || null,
                description: body.description || null,
                definition_of_done: body.definition_of_done || [],
                acceptance_criteria: body.acceptance_criteria || [],
                depends_on: body.depends_on || [],
                sprint_id: body.sprint_id || null,
                task_points: body.task_points != null ? body.task_points : null,
                decision_id: body.decision_id || null,
            });
            jsonResponse(res, { action, id: action.id });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/actions/suggest-task (AI expands user description into full task per Sprint Board rules; prompt in Admin)
    if (pathname === '/api/actions/suggest-task' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const userInput = (body.user_input ?? body.content ?? body.description ?? '').trim();
            if (!userInput) {
                jsonResponse(res, { error: 'user_input (or content/description) is required' }, 400);
                return true;
            }
            const promptsService = require('../../supabase/prompts');
            const llm = require('../../llm');
            const llmConfig = require('../../llm/config');
            const promptRecord = await promptsService.getPrompt('task_description_from_rules');
            const template = promptRecord?.prompt_template || null;
            if (!template) {
                jsonResponse(res, { error: 'Prompt task_description_from_rules not found. Add it in Admin > Prompts.' }, 400);
                return true;
            }
            const prompt = promptsService.renderPrompt(template, {
                USER_INPUT: userInput,
                PARENT_STORY_REF: body.parent_story_ref || body.parent_story || ''
            });
            const llmCfg = llmConfig.getTextConfigForReasoning(config);
            if (!llmCfg?.provider || !llmCfg?.model) {
                jsonResponse(res, { error: 'No AI/LLM configured' }, 400);
                return true;
            }
            const result = await llm.generateText({
                provider: llmCfg.provider,
                providerConfig: llmCfg.providerConfig,
                model: llmCfg.model,
                prompt,
                temperature: 0.3,
                maxTokens: 1024,
                context: 'task-description-from-rules'
            });
            const raw = (result.text || result.response || '').trim();
            if (!result.success) {
                jsonResponse(res, { error: result.error || 'AI request failed' }, 400);
                return true;
            }
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            const taskPayload = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            if (!taskPayload || !taskPayload.task) {
                jsonResponse(res, { error: 'AI did not return a valid task structure' }, 400);
                return true;
            }
            jsonResponse(res, {
                task: taskPayload.task,
                description: taskPayload.description || '',
                size_estimate: taskPayload.size_estimate || '1 day',
                definition_of_done: Array.isArray(taskPayload.definition_of_done) ? taskPayload.definition_of_done : [],
                acceptance_criteria: Array.isArray(taskPayload.acceptance_criteria) ? taskPayload.acceptance_criteria : []
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/actions/suggest
    if (pathname === '/api/actions/suggest' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const content = (body.content ?? body.task ?? '').trim();
            const contacts = storage.getContacts ? await (Promise.resolve(storage.getContacts()).then(c => Array.isArray(c) ? c : [])) : [];
            const { runActionSuggest } = require('../../action-suggest/ActionSuggestFlow');
            const result = await runActionSuggest(config, { content, contacts });
            if (result.error) {
                jsonResponse(res, { error: result.error }, 400);
                return true;
            }
            jsonResponse(res, {
                suggested_assignees: Array.isArray(result.suggested_assignees) ? result.suggested_assignees : []
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/actions/:id
    const putActionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
    if (putActionMatch && req.method === 'PUT') {
        try {
            const actionId = putActionMatch[1];
            const body = await parseBody(req);
            const updates = {
                task: body.task || body.content,
                owner: body.owner ?? body.assignee,
                deadline: body.deadline ?? body.due_date,
                priority: body.priority,
                status: body.status,
                parent_story_ref: body.parent_story_ref ?? body.parent_story,
                parent_story_id: body.parent_story_id,
                size_estimate: body.size_estimate ?? body.size,
                description: body.description,
                definition_of_done: body.definition_of_done,
                acceptance_criteria: body.acceptance_criteria,
                depends_on: body.depends_on,
                source_email_id: body.source_email_id,
                source_type: body.source_type,
                requested_by: body.requested_by,
                requested_by_contact_id: body.requested_by_contact_id,
                supporting_document_ids: body.supporting_document_ids,
                sprint_id: body.sprint_id,
                task_points: body.task_points,
                decision_id: body.decision_id,
            };
            if (body.refined_with_ai === true) updates.refined_with_ai = true;
            if (body.restore_snapshot != null && typeof body.restore_snapshot === 'object') updates.restore_snapshot = body.restore_snapshot;
            Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
            const action = await storage.updateAction(actionId, updates);
            jsonResponse(res, { action });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/actions/:id/restore
    const restoreActionMatch = pathname.match(/^\/api\/actions\/([^/]+)\/restore$/);
    if (restoreActionMatch && req.method === 'POST') {
        try {
            const actionId = restoreActionMatch[1];
            const action = await storage.restoreAction(actionId);
            jsonResponse(res, { action });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 400);
        }
        return true;
    }

    // PATCH /api/actions/:id
    const patchActionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
    if (patchActionMatch && req.method === 'PATCH') {
        try {
            const actionId = patchActionMatch[1];
            const body = await parseBody(req);
            const updates = {};
            if (body.refined_with_ai === true) updates.refined_with_ai = true;
            if (body.restore_snapshot != null && typeof body.restore_snapshot === 'object') updates.restore_snapshot = body.restore_snapshot;
            if (body.status !== undefined) updates.status = body.status;
            if (body.priority !== undefined) updates.priority = body.priority;
            if (body.task !== undefined) updates.task = body.task;
            if (body.content !== undefined) updates.task = body.content;
            if (body.owner !== undefined) updates.owner = body.owner;
            if (body.assignee !== undefined) updates.owner = body.assignee;
            if (body.deadline !== undefined) updates.deadline = body.deadline;
            if (body.due_date !== undefined) updates.deadline = body.due_date;
            if (body.parent_story_ref !== undefined) updates.parent_story_ref = body.parent_story_ref;
            if (body.parent_story !== undefined) updates.parent_story_ref = body.parent_story;
            if (body.size_estimate !== undefined) updates.size_estimate = body.size_estimate;
            if (body.size !== undefined) updates.size_estimate = body.size;
            if (body.description !== undefined) updates.description = body.description;
            if (body.definition_of_done !== undefined) updates.definition_of_done = body.definition_of_done;
            if (body.acceptance_criteria !== undefined) updates.acceptance_criteria = body.acceptance_criteria;
            if (body.parent_story_id !== undefined) updates.parent_story_id = body.parent_story_id;
            if (body.depends_on !== undefined) updates.depends_on = body.depends_on;
            if (body.source_email_id !== undefined) updates.source_email_id = body.source_email_id;
            if (body.source_type !== undefined) updates.source_type = body.source_type;
            if (body.requested_by !== undefined) updates.requested_by = body.requested_by;
            if (body.requested_by_contact_id !== undefined) updates.requested_by_contact_id = body.requested_by_contact_id;
            if (body.supporting_document_ids !== undefined) updates.supporting_document_ids = body.supporting_document_ids;
            if (body.sprint_id !== undefined) updates.sprint_id = body.sprint_id;
            if (body.task_points !== undefined) updates.task_points = body.task_points;
            if (body.decision_id !== undefined) updates.decision_id = body.decision_id;
            const action = await storage.updateAction(actionId, updates);
            jsonResponse(res, { action });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/actions/:id
    const deleteActionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
    if (deleteActionMatch && req.method === 'DELETE') {
        try {
            const actionId = deleteActionMatch[1];
            await storage.deleteAction(actionId, true);
            jsonResponse(res, { ok: true });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/actions/:id/similar – semantically similar actions (uses embeddings when available)
    const actionSimilarMatch = pathname.match(/^\/api\/actions\/([^/]+)\/similar$/);
    if (actionSimilarMatch && req.method === 'GET') {
        try {
            const actionId = actionSimilarMatch[1];
            const actions = storage.getActions ? await storage.getActions() : (storage.getActionItems ? storage.getActionItems() : []);
            const action = (actions || []).find((a) => String(a.id) === String(actionId));
            if (!action) {
                jsonResponse(res, { error: 'Action not found', similar: [] }, 404);
                return true;
            }
            const queryText = [(action.task || action.content || ''), (action.description || '')].filter(Boolean).join(' ').trim();
            if (!queryText) {
                jsonResponse(res, { similar: [] });
                return true;
            }
            const embedCfg = llmConfig && llmConfig.getEmbeddingsConfig ? llmConfig.getEmbeddingsConfig(config) : null;
            if (!embedCfg?.provider || !embedCfg?.model || !llm?.embed) {
                jsonResponse(res, { similar: [], hint: 'Embeddings not configured' });
                return true;
            }
            const embedResult = await llm.embed({
                provider: embedCfg.provider,
                providerConfig: embedCfg.providerConfig,
                model: embedCfg.model,
                texts: [queryText]
            });
            if (!embedResult.success || !embedResult.embeddings?.[0]) {
                jsonResponse(res, { similar: [], hint: 'Embedding failed' });
                return true;
            }
            const results = await storage.searchWithEmbedding(queryText, embedResult.embeddings[0], {
                entityTypes: ['action_item'],
                limit: 7,
                threshold: 0.25,
                useHybrid: false
            });
            const ids = (results || [])
                .map((r) => (r.id && r.id.startsWith('action_item_') ? r.id.slice('action_item_'.length) : r.id))
                .filter((id) => id && String(id) !== String(actionId));
            const order = new Map(ids.map((id, i) => [id, i]));
            const similarActions = (actions || [])
                .filter((a) => ids.includes(String(a.id)))
                .sort((a, b) => (order.get(String(a.id)) ?? 99) - (order.get(String(b.id)) ?? 99))
                .slice(0, 6);
            jsonResponse(res, { similar: similarActions });
        } catch (e) {
            jsonResponse(res, { error: e.message, similar: [] }, 500);
        }
        return true;
    }

    // GET /api/actions/:id/events
    const actionEventsMatch = pathname.match(/^\/api\/actions\/([^/]+)\/events$/);
    if (actionEventsMatch && req.method === 'GET') {
        try {
            const actionId = actionEventsMatch[1];
            const events = storage.getActionEvents ? await storage.getActionEvents(actionId) : [];
            jsonResponse(res, { events: events || [] });
        } catch (e) {
            jsonResponse(res, { error: e.message, events: [] }, 500);
        }
        return true;
    }

    // ==================== User Stories Routes ====================

    if (pathname === '/api/user-stories' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status || null;
            const list = storage.getUserStories ? await storage.getUserStories(status) : [];
            jsonResponse(res, { user_stories: list });
        } catch (e) {
            jsonResponse(res, { error: e.message, user_stories: [] }, 500);
        }
        return true;
    }

    if (pathname === '/api/user-stories/deleted' && req.method === 'GET') {
        try {
            const list = storage.getDeletedUserStories ? await storage.getDeletedUserStories() : [];
            jsonResponse(res, { user_stories: list });
        } catch (e) {
            jsonResponse(res, { error: e.message, user_stories: [] }, 500);
        }
        return true;
    }

    const userStoryRestoreMatch = pathname.match(/^\/api\/user-stories\/([^/]+)\/restore$/);
    if (userStoryRestoreMatch && req.method === 'POST') {
        try {
            const storyId = userStoryRestoreMatch[1];
            const story = await storage.restoreUserStory(storyId);
            jsonResponse(res, { user_story: story });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 400);
        }
        return true;
    }

    const userStoryIdMatch = pathname.match(/^\/api\/user-stories\/([^/]+)$/);
    if (userStoryIdMatch) {
        const storyId = userStoryIdMatch[1];
        if (req.method === 'GET') {
            try {
                const story = storage.getUserStory ? await storage.getUserStory(storyId) : null;
                if (!story) {
                    jsonResponse(res, { error: 'User story not found' }, 404);
                    return true;
                }
                jsonResponse(res, { user_story: story });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return true;
        }
        if (req.method === 'PUT') {
            try {
                const body = await parseBody(req);
                const story = storage.updateUserStory ? await storage.updateUserStory(storyId, body) : null;
                if (!story) {
                    jsonResponse(res, { error: 'User story not found' }, 404);
                    return true;
                }
                jsonResponse(res, { user_story: story });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return true;
        }
        if (req.method === 'DELETE') {
            try {
                if (storage.deleteUserStory) await storage.deleteUserStory(storyId, true);
                jsonResponse(res, { ok: true });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return true;
        }
    }

    if (pathname === '/api/user-stories' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const title = (body.title || '').trim();
            if (!title) {
                jsonResponse(res, { error: 'title is required' }, 400);
                return true;
            }
            const story = await storage.addUserStory({
                title,
                description: body.description || null,
                status: body.status || 'draft',
                acceptance_criteria: body.acceptance_criteria || [],
                source_document_id: body.source_document_id || null,
                source_file: body.source_file || null,
                source_email_id: body.source_email_id || null,
                source_type: body.source_type || 'manual',
                requested_by: body.requested_by || null,
                requested_by_contact_id: body.requested_by_contact_id || null,
                supporting_document_ids: Array.isArray(body.supporting_document_ids) ? body.supporting_document_ids : (body.supporting_document_ids ? [body.supporting_document_ids] : []),
                generation_source: body.generation_source || 'manual',
                story_points: body.story_points != null ? body.story_points : null
            });
            jsonResponse(res, { user_story: story, id: story.id });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // ==================== People Route ====================
    
    // GET /api/people
    if (pathname === '/api/people' && req.method === 'GET') {
        const people = storage.getPeople();
        jsonResponse(res, { people });
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleKnowledge, isKnowledgeRoute };
