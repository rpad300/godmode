/**
 * Knowledge Routes - Questions, Facts, Decisions, Risks, Actions
 * Extracted from src/server.js for modularization
 */

const { parseUrl, parseBody } = require('../../server/request');
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
           pathname === '/api/people';
}

/**
 * Handle all knowledge-related routes
 * @param {Object} ctx - Context object with req, res, pathname, storage, config, llm, llmConfig
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleKnowledge(ctx) {
    const { req, res, pathname, storage, config, llm, llmConfig } = ctx;
    
    // Quick check - if not a knowledge route, return false immediately
    if (!isKnowledgeRoute(pathname)) {
        return false;
    }

    // ==================== Questions Routes ====================
    
    function isValidUUID(str) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ''));
    }

    function getRequestProjectId() {
        const headerProjectId = req.headers['x-project-id'];
        if (typeof headerProjectId === 'string' && isValidUUID(headerProjectId)) return headerProjectId;
        const current = storage.getCurrentProject?.();
        if (current?.id && isValidUUID(current.id)) return current.id;
        return null;
    }

    // GET /api/questions - Get questions (request-scoped project)
    if (pathname === '/api/questions' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const projectId = getRequestProjectId();

        // In Supabase mode, avoid StorageCompat cache (it is global mutable state)
        if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
            const sb = storage._supabase.forProject(projectId);
            const questions = await sb.getQuestions({
                status: parsedUrl.query.status,
                priority: parsedUrl.query.priority
            });
            jsonResponse(res, { questions: questions || [] });
            return true;
        }

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
        
        console.log(`[Questions] Updating question ${questionId}:`, JSON.stringify(body).substring(0, 200));
        
        const result = await storage.updateQuestion(questionId, body);
        console.log(`[Questions] Update result:`, JSON.stringify(result).substring(0, 200));
        
        if (result.success || result.ok) {
            // Sync to FalkorDB if connected
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    const { getGraphSync } = require('../../sync');
                    const graphSync = getGraphSync({ graphProvider, storage });
                    await graphSync.syncQuestion(result.question);
                    console.log(`[Graph] Question ${questionId} updated in FalkorDB`);
                } catch (syncErr) {
                    console.log('[Graph] Question sync error:', syncErr.message);
                }
            }
            jsonResponse(res, { ok: true, success: true, question: result.question });
        } else {
            console.log(`[Questions] Update failed for ${questionId}: ${result.error}`);
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
                    console.log(`[Graph] Question ${questionId} deleted from FalkorDB`);
                } catch (syncErr) {
                    console.log('[Graph] Question delete sync error:', syncErr.message);
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

    // GET /api/facts (request-scoped project)
    if (pathname === '/api/facts' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const category = parsedUrl.query.category;
        const documentId = parsedUrl.query.document_id || parsedUrl.query.documentId;
        const projectId = getRequestProjectId();

        try {
            // In Supabase mode, avoid StorageCompat cache (it is global mutable state)
            if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
                const sb = storage._supabase.forProject(projectId);
                const facts = documentId
                    ? (sb.getFactsByDocument ? await sb.getFactsByDocument(documentId) : [])
                    : await sb.getFacts(category);
                const total = Array.isArray(facts) ? facts.length : 0;
                jsonResponse(res, { facts: facts || [], total });
                return true;
            }

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

    // GET /api/decisions (request-scoped project)
    if (pathname === '/api/decisions' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status || null;
            const projectId = getRequestProjectId();

            if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
                const sb = storage._supabase.forProject(projectId);
                const decisions = sb.getDecisions ? await sb.getDecisions(status) : [];
                jsonResponse(res, { decisions: decisions || [] });
                return true;
            }

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

    // GET /api/risks (request-scoped project)
    if (pathname === '/api/risks' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status || null;
            const projectId = getRequestProjectId();

            if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
                const sb = storage._supabase.forProject(projectId);
                const risks = sb.getRisks ? await sb.getRisks(status) : [];
                jsonResponse(res, { risks: risks || [] });
                return true;
            }

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
    
    // GET /api/actions (request-scoped project)
    if (pathname === '/api/actions' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const status = parsedUrl.query.status;
        const projectId = getRequestProjectId();

        if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
            const sb = storage._supabase.forProject(projectId);
            const actions = sb.getActions ? await sb.getActions(status) : (sb.getActionItems ? sb.getActionItems(status) : []);
            jsonResponse(res, { actions: Array.isArray(actions) ? actions : [] });
            return true;
        }

        const actions = storage.getActions ? await storage.getActions(status) : (storage.getActionItems ? storage.getActionItems(status) : []);
        jsonResponse(res, { actions: Array.isArray(actions) ? actions : [] });
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
            });
            jsonResponse(res, { action, id: action.id });
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
            };
            Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
            const action = await storage.updateAction(actionId, updates);
            jsonResponse(res, { action });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
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
            if (body.status !== undefined) updates.status = body.status;
            if (body.priority !== undefined) updates.priority = body.priority;
            if (body.task !== undefined) updates.task = body.task;
            if (body.content !== undefined) updates.task = body.content;
            if (body.owner !== undefined) updates.owner = body.owner;
            if (body.assignee !== undefined) updates.owner = body.assignee;
            if (body.deadline !== undefined) updates.deadline = body.deadline;
            if (body.due_date !== undefined) updates.deadline = body.due_date;
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

    // ==================== People Route ====================
    
    // GET /api/people (request-scoped project)
    if (pathname === '/api/people' && req.method === 'GET') {
        const projectId = getRequestProjectId();

        if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
            const sb = storage._supabase.forProject(projectId);
            const people = sb.getPeople ? await sb.getPeople() : [];
            jsonResponse(res, { people: people || [] });
            return true;
        }

        const people = storage.getPeople();
        jsonResponse(res, { people });
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleKnowledge, isKnowledgeRoute };
