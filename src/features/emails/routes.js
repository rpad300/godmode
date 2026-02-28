/**
 * Purpose:
 *   Email ingestion, AI analysis, and response drafting API. Accepts emails from
 *   multiple sources (paste, .eml upload, .msg upload, structured API), performs
 *   LLM-powered extraction of facts/decisions/risks/actions/questions/people,
 *   manages contact matching and creation, and provides AI-drafted responses.
 *
 * Responsibilities:
 *   - List emails with optional filters (requires_response, direction, limit)
 *   - Retrieve single email with recipient details
 *   - Ingest new emails from four input methods: .eml base64, .msg base64, pasted text,
 *     or structured JSON fields
 *   - Deduplication via MD5 content hash (from + subject + body[0:1000] + date)
 *   - Automatic contact matching: lookup sender/recipients by email or name, auto-create
 *     contacts from email metadata and signature extraction
 *   - LLM analysis pipeline: configurable prompt with ontology mode, custom prompts,
 *     Supabase prompt templates, and context variables; extracts structured entities
 *   - Entity extraction: persists facts, decisions, risks, action items, questions, and
 *     people entities from AI analysis into their respective storage tables
 *   - Graph database sync: creates email nodes and links to extracted entities
 *   - Draft response generation: builds a context-aware prompt from project facts, decisions,
 *     and open questions, then generates a response via LLM
 *   - Mark email as responded (clears requires_response flag)
 *   - Bulk re-sync all emails to graph database
 *   - List emails needing response
 *   - Delete emails
 *
 * Key dependencies:
 *   - ../../emailParser: .eml/.msg parsing, manual email parsing, analysis prompt building,
 *     response prompt building
 *   - ../../llm/config: LLM provider and model resolution
 *   - ../../sync (getGraphSync): Graph sync for email nodes and entity relationships
 *   - ../../supabase/prompts: Custom prompt templates and context variable building
 *   - storage: Email persistence, contact lookup/creation, entity persistence
 *
 * Side effects:
 *   - Database: creates emails, email_recipients, contacts, facts, decisions, risks,
 *     action_items, knowledge_questions, and people records
 *   - Graph DB: syncs email nodes and links to extracted entities
 *   - LLM API: calls text generation for analysis and response drafting
 *
 * Notes:
 *   - The content hash deduplication prevents the same email from being processed twice
 *     but uses a simple MD5 of limited fields, so nearly identical emails could slip through
 *   - Entity extraction is done in serial per entity type; for large AI outputs this could
 *     be slow. Consider batching storage operations for performance
 *   - The /sync-graph and /needing-response routes must be matched before the :id routes
 *     to avoid "sync-graph" being captured as an email ID
 *   - Sprint and action IDs can be associated with emails during ingestion for traceability
 */

const crypto = require('crypto');
const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');
const { jsonResponse } = require('../../server/response');
const emailParser = require('../../emailParser');
const llmRouter = require('../../llm/router');

async function handleEmails(ctx) {
    const { req, res, pathname, storage, config } = ctx;
    const log = getLogger().child({ module: 'emails' });

    // GET /api/emails - List emails for current project
    if (pathname === '/api/emails' && req.method === 'GET') {
        try {
            const emailUrl = new URL(req.url, `http://${req.headers.host}`);
            const requiresResponse = emailUrl.searchParams.get('requires_response');
            const direction = emailUrl.searchParams.get('direction');
            const limit = parseInt(emailUrl.searchParams.get('limit') || '50');

            const emails = await storage.getEmails({
                requiresResponse: requiresResponse === 'true' ? true : (requiresResponse === 'false' ? false : undefined),
                direction: direction || undefined,
                limit
            });

            jsonResponse(res, { ok: true, emails, count: emails.length });
        } catch (error) {
            log.warn({ event: 'emails_fetch_error', reason: error?.message }, 'Error fetching emails');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/sync-graph - Must match before :id routes
    if (pathname === '/api/emails/sync-graph' && req.method === 'POST') {
        try {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                jsonResponse(res, { ok: false, error: 'Graph database not connected' }, 400);
                return true;
            }

            const { getGraphSync } = require('../../sync');
            const graphSync = getGraphSync({ graphProvider, storage });

            const projectInfo = storage.getCurrentProject ? storage.getCurrentProject() : null;
            const projectId = projectInfo?.id || storage.getProjectId?.() || null;
            const projectName = projectInfo?.name || config.projectName || 'Default';

            const emails = await storage.getEmails({ limit: 100 });
            let synced = 0;
            let errors = 0;

            for (const email of emails) {
                try {
                    await graphSync.syncEmail(email, projectId, projectName);
                    synced++;
                } catch (e) {
                    log.warn({ event: 'emails_sync_email_failed', emailId: email.id, reason: e.message }, 'Failed to sync email');
                    errors++;
                }
            }
            log.debug({ event: 'emails_sync_completed', synced, errors, total: emails.length }, 'Email sync completed');
            jsonResponse(res, { ok: true, synced, errors, total: emails.length });
        } catch (error) {
            log.warn({ event: 'emails_sync_error', reason: error?.message }, 'Email sync error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/emails/needing-response - Must match before :id routes
    if (pathname === '/api/emails/needing-response' && req.method === 'GET') {
        try {
            const emails = await storage.getEmailsNeedingResponse();
            jsonResponse(res, { ok: true, emails, count: emails.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/emails/:id - Get single email
    const emailGetMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)$/);
    if (emailGetMatch && req.method === 'GET') {
        const emailId = emailGetMatch[1];
        try {
            const email = await storage.getEmail(emailId);
            if (!email) {
                jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                return true;
            }
            const recipients = await storage.getEmailRecipients(emailId);
            jsonResponse(res, { ok: true, email, recipients });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails - Process a new email (paste or .eml upload)
    if (pathname === '/api/emails' && req.method === 'POST') {
        log.debug({ event: 'emails_post_received' }, 'POST /api/emails received');
        try {
            const body = await parseBody(req);
            log.debug({ event: 'emails_body_parsed', keys: Object.keys(body) }, 'Body parsed');

            let parsedEmail;

            if (body.emlBase64) {
                const buffer = Buffer.from(body.emlBase64, 'base64');
                parsedEmail = await emailParser.parseEmlFile(buffer);
                parsedEmail.source_type = 'eml_upload';
                parsedEmail.original_filename = body.filename || 'email.eml';
            } else if (body.msgBase64) {
                const buffer = Buffer.from(body.msgBase64, 'base64');
                parsedEmail = await emailParser.parseMsgFile(buffer);
                parsedEmail.source_type = 'msg_upload';
                parsedEmail.original_filename = body.filename || 'email.msg';
            } else if (body.emailText) {
                parsedEmail = emailParser.parseManualEmail(body.emailText);
                parsedEmail.source_type = 'paste';
            } else if (body.from || body.from_email) {
                parsedEmail = {
                    from: body.from || { email: body.from_email, name: body.from_name },
                    to: body.to || [],
                    cc: body.cc || [],
                    subject: body.subject || '',
                    date: body.date || body.date_sent || null,
                    text: body.body || body.body_text || '',
                    source_type: 'api'
                };
            } else {
                jsonResponse(res, { ok: false, error: 'Either emlBase64, msgBase64, emailText, or structured fields required' }, 400);
                return true;
            }

            parsedEmail.sprint_id = body.sprint_id || body.sprintId || null;
            parsedEmail.action_id = body.action_id || body.actionId || null;

            const hashContent = [
                parsedEmail.from?.email || '',
                parsedEmail.subject || '',
                (parsedEmail.text || '').substring(0, 1000),
                parsedEmail.date || ''
            ].join('|');
            const contentHash = crypto.createHash('md5').update(hashContent).digest('hex');
            parsedEmail.content_hash = contentHash;

            const existingEmail = await storage.findEmailByHash(contentHash);
            if (existingEmail) {
                log.debug({ event: 'emails_duplicate', contentHash }, 'Duplicate email detected');
                jsonResponse(res, {
                    ok: false,
                    error: 'This email has already been processed',
                    duplicate: true,
                    existingId: existingEmail.id
                }, 409);
                return true;
            }

            // Auto-detect thread from In-Reply-To / References headers
            if (!parsedEmail.thread_id && (parsedEmail.inReplyTo || parsedEmail.references)) {
                try {
                    const refMessageId = parsedEmail.inReplyTo || (parsedEmail.references || '').split(/\s+/)[0];
                    if (refMessageId) {
                        const parentEmail = await storage.findEmailByMessageId?.(refMessageId);
                        if (parentEmail) {
                            parsedEmail.thread_id = parentEmail.thread_id || parentEmail.id;
                        }
                    }
                } catch (threadErr) {
                    log.debug({ event: 'emails_thread_detect_failed', reason: threadErr.message }, 'Thread detection failed');
                }
            }

            log.debug({ event: 'emails_save_start' }, 'Saving email to database');
            const savedEmail = await storage.saveEmail(parsedEmail);
            log.debug({ event: 'emails_saved', emailId: savedEmail?.id }, 'Email saved');

            const contactMatches = {
                sender: null,
                recipients: [],
                newContacts: []
            };

            if (parsedEmail.from?.email) {
                let senderContact = await storage.findContactByEmail(parsedEmail.from.email);
                if (!senderContact && parsedEmail.from?.name) {
                    senderContact = await storage.findContactByName(parsedEmail.from.name);
                }

                if (senderContact) {
                    contactMatches.sender = { contact: senderContact, isNew: false };
                    await storage.updateEmail(savedEmail.id, { sender_contact_id: senderContact.id });
                } else {
                    const sigContact = parsedEmail.extractedContacts?.[0] || {};
                    const newContact = await storage.createContactFromEmail({
                        name: parsedEmail.from.name || parsedEmail.from.email,
                        email: parsedEmail.from.email,
                        phone: sigContact.phone || null,
                        role: sigContact.role || null,
                        organization: sigContact.organization || null,
                        location: sigContact.location || null,
                        source: `Email: ${parsedEmail.subject}`
                    });
                    contactMatches.sender = { contact: newContact, isNew: true };
                    contactMatches.newContacts.push(newContact);
                    await storage.updateEmail(savedEmail.id, { sender_contact_id: newContact.id });
                }
            }

            const allRecipients = [
                ...(parsedEmail.to || []).map(r => ({ ...r, type: 'to' })),
                ...(parsedEmail.cc || []).map(r => ({ ...r, type: 'cc' }))
            ];

            for (const recipient of allRecipients) {
                let recipientContact = null;

                if (recipient.email) {
                    recipientContact = await storage.findContactByEmail(recipient.email);
                }
                if (!recipientContact && recipient.name) {
                    recipientContact = await storage.findContactByName(recipient.name);
                }

                if (recipientContact) {
                    contactMatches.recipients.push({ contact: recipientContact, type: recipient.type, isNew: false });
                    await storage.addEmailRecipient(savedEmail.id, {
                        contact_id: recipientContact.id,
                        email: recipient.email,
                        name: recipient.name,
                        type: recipient.type
                    });
                } else if (recipient.email || recipient.name) {
                    const newContact = await storage.createContactFromEmail({
                        name: recipient.name || recipient.email || 'Unknown',
                        email: recipient.email || null,
                        source: `Email recipient: ${parsedEmail.subject}`
                    });
                    contactMatches.recipients.push({ contact: newContact, type: recipient.type, isNew: true });
                    contactMatches.newContacts.push(newContact);
                    await storage.addEmailRecipient(savedEmail.id, {
                        contact_id: newContact.id,
                        email: recipient.email,
                        name: recipient.name,
                        type: recipient.type
                    });
                }
            }

            let aiAnalysis = null;
            let extractedEntities = { facts: 0, decisions: 0, risks: 0, actions: 0, questions: 0, people: 0 };

            try {
                    const promptsService = require('../../supabase/prompts');
                    const supabasePromptObj = await promptsService.getPrompt('email');
                    const supabasePrompt = supabasePromptObj?.prompt_template || null;
                    const contextVariables = savedEmail.project_id
                        ? await promptsService.buildContextVariables(savedEmail.project_id, 4000)
                        : {};

                    try {
                        const { DocumentContextBuilder } = require('../../docindex');
                        contextVariables.DOCUMENT_CONTEXT = await DocumentContextBuilder.build(storage, { maxChars: 1200 });
                    } catch (_) {}

                    const customEmailPrompt = config.prompts?.email || null;
                    const analysisPrompt = emailParser.buildEmailAnalysisPrompt(parsedEmail, {
                        customPrompt: customEmailPrompt,
                        ontologyMode: !customEmailPrompt,
                        supabasePrompt: supabasePrompt,
                        contextVariables: contextVariables
                    });
                    const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                        prompt: analysisPrompt,
                        temperature: 0.3,
                        maxTokens: 2500,
                        context: 'email-analyze'
                    }, config);

                    if (routerResult.success) {
                        try {
                            const result = routerResult.result || {};
                            let jsonText = result.text || result.response || '';
                            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                aiAnalysis = JSON.parse(jsonMatch[0]);

                                await storage.updateEmail(savedEmail.id, {
                                    extracted_entities: aiAnalysis,
                                    ai_summary: aiAnalysis.summary,
                                    detected_intent: aiAnalysis.intent,
                                    sentiment: aiAnalysis.sentiment,
                                    requires_response: aiAnalysis.requires_response || false,
                                    processed_at: new Date().toISOString()
                                });

                                const sourceRef = `Email: ${parsedEmail.subject || savedEmail.id}`;
                                const emailSprintId = savedEmail.sprint_id || parsedEmail.sprint_id || null;

                                if (aiAnalysis.facts && Array.isArray(aiAnalysis.facts)) {
                                    for (const fact of aiAnalysis.facts) {
                                        try {
                                            const confMap = { high: 0.9, medium: 0.7, low: 0.4 };
                                            const confValue = typeof fact.confidence === 'number' ? fact.confidence : (confMap[String(fact.confidence).toLowerCase()] ?? 0.7);
                                            await storage.addFact({
                                                content: fact.content,
                                                category: fact.category || 'general',
                                                source: sourceRef,
                                                source_document_id: null,
                                                source_email_id: savedEmail.id,
                                                confidence: confValue,
                                                sprint_id: emailSprintId
                                            });
                                            extractedEntities.facts++;
                                        } catch (e) {
                                            log.warn({ event: 'emails_save_fact_failed', reason: e.message }, 'Failed to save fact');
                                        }
                                    }
                                }

                                if (aiAnalysis.decisions && Array.isArray(aiAnalysis.decisions)) {
                                    for (const decision of aiAnalysis.decisions) {
                                        try {
                                            await storage.addDecision({
                                                content: decision.content,
                                                owner: decision.owner || null,
                                                date: decision.date || new Date().toISOString().split('T')[0],
                                                status: decision.status || 'made',
                                                source: sourceRef,
                                                source_email_id: savedEmail.id,
                                                sprint_id: emailSprintId
                                            });
                                            extractedEntities.decisions++;
                                        } catch (e) {
                                            log.warn({ event: 'emails_save_decision_failed', reason: e.message }, 'Failed to save decision');
                                        }
                                    }
                                }

                                if (aiAnalysis.risks && Array.isArray(aiAnalysis.risks)) {
                                    for (const risk of aiAnalysis.risks) {
                                        try {
                                            await storage.addRisk({
                                                content: risk.content,
                                                impact: risk.impact || 'Medium',
                                                likelihood: risk.likelihood || 'Medium',
                                                mitigation: risk.mitigation || null,
                                                status: 'open',
                                                source: sourceRef,
                                                source_email_id: savedEmail.id,
                                                sprint_id: emailSprintId
                                            });
                                            extractedEntities.risks++;
                                        } catch (e) {
                                            log.warn({ event: 'emails_save_risk_failed', reason: e.message }, 'Failed to save risk');
                                        }
                                    }
                                }

                                if (aiAnalysis.action_items && Array.isArray(aiAnalysis.action_items)) {
                                    for (const action of aiAnalysis.action_items) {
                                        try {
                                            await storage.addActionItem({
                                                content: action.task,
                                                task: action.task,
                                                owner: action.owner || null,
                                                deadline: action.deadline || null,
                                                priority: action.priority || 'medium',
                                                status: action.status || 'pending',
                                                source: sourceRef,
                                                source_email_id: savedEmail.id,
                                                sprint_id: emailSprintId
                                            });
                                            extractedEntities.actions++;
                                        } catch (e) {
                                            log.warn({ event: 'emails_save_action_failed', reason: e.message }, 'Failed to save action item');
                                        }
                                    }
                                }

                                if (aiAnalysis.questions && Array.isArray(aiAnalysis.questions)) {
                                    for (const question of aiAnalysis.questions) {
                                        try {
                                            await storage.addKnowledgeQuestion({
                                                content: question.content,
                                                context: question.context || sourceRef,
                                                priority: question.priority || 'medium',
                                                status: 'open',
                                                assignee: question.assignee || null,
                                                source: sourceRef,
                                                source_email_id: savedEmail.id,
                                                sprint_id: emailSprintId
                                            });
                                            extractedEntities.questions++;
                                        } catch (e) {
                                            log.warn({ event: 'emails_save_question_failed', reason: e.message }, 'Failed to save question');
                                        }
                                    }
                                }

                                if (aiAnalysis.people && Array.isArray(aiAnalysis.people)) {
                                    for (const person of aiAnalysis.people) {
                                        try {
                                            let existingContact = null;
                                            if (person.email) {
                                                existingContact = await storage.findContactByEmail(person.email);
                                            }
                                            if (!existingContact && person.name) {
                                                existingContact = await storage.findContactByName(person.name);
                                            }

                                            if (!existingContact && person.name) {
                                                await storage.createContactFromEmail({
                                                    name: person.name,
                                                    email: person.email || null,
                                                    role: person.role || null,
                                                    organization: person.organization || null,
                                                    phone: person.phone || null,
                                                    source: sourceRef
                                                });
                                                extractedEntities.people++;
                                            }
                                        } catch (e) {
                                            log.warn({ event: 'emails_save_person_failed', reason: e.message }, 'Failed to save person');
                                        }
                                    }
                                }

                                log.debug({ event: 'emails_extracted_entities', extractedEntities }, 'Extracted entities');
                            }
                        } catch (parseError) {
                            log.warn({ event: 'emails_parse_analysis_failed', reason: parseError.message }, 'Failed to parse AI analysis');
                        }
                    }
            } catch (aiError) {
                log.warn({ event: 'emails_ai_analysis_failed', reason: aiError.message }, 'AI analysis failed');
                // Mark as processed even on failure so it's not stuck in limbo
                try { await storage.updateEmail(savedEmail.id, { processed_at: new Date().toISOString(), processing_error: aiError.message }); } catch (_) {}
            }

            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    const { getGraphSync } = require('../../sync');
                    const graphSync = getGraphSync({ graphProvider, storage });

                    const projectInfo = storage.getCurrentProject ? storage.getCurrentProject() : null;
                    const projectId = projectInfo?.id || storage.getProjectId?.() || null;
                    const projectName = projectInfo?.name || config.projectName || 'Default';

                    const updatedEmail = await storage.getEmail(savedEmail.id);
                    await graphSync.syncEmail(updatedEmail, projectId, projectName);

                    if (aiAnalysis) {
                        await graphSync.linkEmailToEntities(savedEmail.id, aiAnalysis);
                    }

                    log.debug({ event: 'emails_graph_synced' }, 'Synced to graph successfully');
                }
            } catch (graphError) {
                log.warn({ event: 'emails_graph_sync_failed', reason: graphError.message }, 'Graph sync failed');
            }

            const finalEmail = await storage.getEmail(savedEmail.id);

            jsonResponse(res, {
                ok: true,
                email: finalEmail,
                contacts: contactMatches,
                analysis: aiAnalysis,
                extractedEntities: extractedEntities,
                parsed: {
                    from: parsedEmail.from,
                    to: parsedEmail.to,
                    cc: parsedEmail.cc,
                    subject: parsedEmail.subject,
                    hasSignature: !!parsedEmail.signature
                }
            });
        } catch (error) {
            logError(error, { event: 'emails_processing_error' });
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/emails/:id - Delete an email
    const emailDeleteMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)$/);
    if (emailDeleteMatch && req.method === 'DELETE') {
        const emailId = emailDeleteMatch[1];
        try {
            const success = await storage.deleteEmail(emailId);
            jsonResponse(res, { ok: success });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/:id/response - Generate draft response
    const emailResponseMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/response$/);
    if (emailResponseMatch && req.method === 'POST') {
        const emailId = emailResponseMatch[1];

        try {
            const email = await storage.getEmail(emailId);
            if (!email) {
                jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                return true;
            }

            const facts = (await storage.getFacts()).slice(0, 10);
            const questions = (await storage.getQuestions()).filter(q => q.status !== 'resolved').slice(0, 5);
            const decisions = (await storage.getDecisions()).slice(0, 5);

            let docContext = '';
            try {
                const { DocumentContextBuilder } = require('../../docindex');
                docContext = await DocumentContextBuilder.build(storage, { maxChars: 1500 });
            } catch (_) {}

            const responsePrompt = emailParser.buildResponsePrompt(email, { facts, questions, decisions, docContext });

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt: responsePrompt,
                temperature: 0.7,
                maxTokens: 1000,
                context: 'email-draft'
            }, config);

            if (routerResult.success) {
                const result = routerResult.result || {};
                const draftResponse = result.text || result.response || '';

                await storage.updateEmail(emailId, {
                    draft_response: draftResponse,
                    draft_generated_at: new Date().toISOString(),
                    response_drafted: true
                });

                jsonResponse(res, {
                    ok: true,
                    draft: draftResponse,
                    email: await storage.getEmail(emailId)
                });
            } else {
                jsonResponse(res, { ok: false, error: routerResult.error || 'Failed to generate response' }, 500);
            }
        } catch (error) {
            log.warn({ event: 'emails_response_generation_error', reason: error?.message }, 'Response generation error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/:id/reprocess - Re-run AI analysis on an email
    const emailReprocessMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/reprocess$/);
    if (emailReprocessMatch && req.method === 'POST') {
        const emailId = emailReprocessMatch[1];
        try {
            const email = await storage.getEmail(emailId);
            if (!email) { jsonResponse(res, { ok: false, error: 'Email not found' }, 404); return true; }

            const parsedEmail = {
                from: { email: email.from_email, name: email.from_name },
                to: (email.to_emails || []).map((e, i) => ({ email: e, name: email.to_names?.[i] || '' })),
                cc: (email.cc_emails || []).map((e, i) => ({ email: e, name: email.cc_names?.[i] || '' })),
                subject: email.subject,
                date: email.date_sent,
                text: email.body_text,
                html: email.body_html,
                signature: email.signature
            };

            let reprocessDocCtx = '';
            try {
                const { DocumentContextBuilder } = require('../../docindex');
                reprocessDocCtx = await DocumentContextBuilder.build(storage, { maxChars: 1200 });
            } catch (_) {}

            const customEmailPrompt = config.prompts?.email || null;
            const analysisPrompt = emailParser.buildEmailAnalysisPrompt(parsedEmail, {
                customPrompt: customEmailPrompt,
                ontologyMode: !customEmailPrompt,
                contextVariables: { DOCUMENT_CONTEXT: reprocessDocCtx }
            });
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt: analysisPrompt, temperature: 0.3, maxTokens: 2500, context: 'email-reprocess'
            }, config);

            if (routerResult.success) {
                const result = routerResult.result || {};
                let jsonText = result.text || result.response || '';
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const aiAnalysis = JSON.parse(jsonMatch[0]);
                    await storage.updateEmail(emailId, {
                        extracted_entities: aiAnalysis,
                        ai_summary: aiAnalysis.summary,
                        detected_intent: aiAnalysis.intent,
                        sentiment: aiAnalysis.sentiment,
                        requires_response: aiAnalysis.requires_response || false,
                        processed_at: new Date().toISOString(),
                        processing_error: null
                    });
                    jsonResponse(res, { ok: true, message: 'Email reprocessed', analysis: aiAnalysis });
                } else {
                    jsonResponse(res, { ok: false, error: 'Could not parse AI response' }, 500);
                }
            } else {
                jsonResponse(res, { ok: false, error: routerResult.error || 'LLM failed' }, 500);
            }
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/:id/mark-responded - Mark email as responded
    const emailMarkRespondedMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/mark-responded$/);
    if (emailMarkRespondedMatch && req.method === 'POST') {
        const emailId = emailMarkRespondedMatch[1];

        try {
            await storage.updateEmail(emailId, {
                response_sent: true,
                requires_response: false
            });

            jsonResponse(res, { ok: true, message: 'Email marked as responded' });
        } catch (error) {
            log.warn({ event: 'emails_mark_responded_error', reason: error?.message }, 'Mark responded error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/emails/stats - Email statistics summary (server-side counts)
    if (pathname === '/api/emails/stats' && req.method === 'GET') {
        try {
            if (storage.getEmailStats) {
                const stats = await storage.getEmailStats();
                jsonResponse(res, { ok: true, ...stats });
            } else {
                const allEmails = await storage.getEmails({ limit: 10000 });
                jsonResponse(res, { ok: true, total: allEmails.length, unread: allEmails.filter(e => !e.is_read).length, starred: allEmails.filter(e => e.is_starred).length, needing_response: allEmails.filter(e => e.requires_response).length });
            }
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/emails/:id/star - Star an email
    const emailStarMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/star$/);
    if (emailStarMatch && req.method === 'PUT') {
        try {
            const updated = await storage.updateEmail(emailStarMatch[1], { is_starred: true });
            jsonResponse(res, { ok: !!updated, email: updated });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/emails/:id/unstar - Unstar an email
    const emailUnstarMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/unstar$/);
    if (emailUnstarMatch && req.method === 'PUT') {
        try {
            const updated = await storage.updateEmail(emailUnstarMatch[1], { is_starred: false });
            jsonResponse(res, { ok: !!updated, email: updated });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/emails/:id/archive - Archive an email
    const emailArchiveMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/archive$/);
    if (emailArchiveMatch && req.method === 'PUT') {
        try {
            const updated = await storage.updateEmail(emailArchiveMatch[1], { is_archived: true });
            jsonResponse(res, { ok: !!updated, email: updated });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/emails/:id/read - Mark as read
    const emailReadMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/read$/);
    if (emailReadMatch && req.method === 'PUT') {
        try {
            const updated = await storage.updateEmail(emailReadMatch[1], { is_read: true });
            jsonResponse(res, { ok: !!updated, email: updated });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/emails/:id/unread - Mark as unread
    const emailUnreadMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/unread$/);
    if (emailUnreadMatch && req.method === 'PUT') {
        try {
            const updated = await storage.updateEmail(emailUnreadMatch[1], { is_read: false });
            jsonResponse(res, { ok: !!updated, email: updated });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/emails/thread/:threadId - Get emails in a thread
    const threadMatch = pathname.match(/^\/api\/emails\/thread\/([a-f0-9\-]+)$/);
    if (threadMatch && req.method === 'GET') {
        try {
            const threadId = threadMatch[1];
            const threadEmails = storage.getEmailsByThread
                ? await storage.getEmailsByThread(threadId)
                : (await storage.getEmails({ limit: 10000 })).filter(e => e.thread_id === threadId).sort((a, b) => new Date(a.date || a.created_at || 0).getTime() - new Date(b.date || b.created_at || 0).getTime());
            jsonResponse(res, { ok: true, emails: threadEmails, count: threadEmails.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/send - Send/store an outbound email
    if (pathname === '/api/emails/send' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { to, cc, subject, body: emailBody, replyToId } = body;

            if (!to || !Array.isArray(to) || to.length === 0) {
                jsonResponse(res, { ok: false, error: 'Recipients (to) required' }, 400);
                return true;
            }

            const savedEmail = await storage.saveEmail({
                from: { email: 'me@godmode.local', name: 'Me' },
                to: to.map(e => ({ email: e, name: '' })),
                cc: (cc || []).map(e => ({ email: e, name: '' })),
                subject: subject || '',
                text: emailBody || '',
                date: new Date().toISOString(),
                source_type: 'outbound',
                direction: 'outbound',
                is_read: true,
                response_sent: true,
                in_reply_to: replyToId || null,
            });

            if (replyToId) {
                await storage.updateEmail(replyToId, {
                    response_sent: true,
                    requires_response: false,
                });
            }

            jsonResponse(res, { ok: true, email: savedEmail });
        } catch (error) {
            log.warn({ event: 'emails_send_error', reason: error?.message }, 'Send error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/:id/categorize - AI categorize an email
    const emailCategorizeMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/categorize$/);
    if (emailCategorizeMatch && req.method === 'POST') {
        const emailId = emailCategorizeMatch[1];
        try {
            const email = await storage.getEmail(emailId);
            if (!email) {
                jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                return true;
            }

            const prompt = `/no_think
Categorize this email. Return JSON only.

Subject: ${email.subject || ''}
From: ${email.from_name || email.from_email || ''}
Body: ${(email.body_text || '').substring(0, 2000)}

Output format:
{"category": "meeting|project|sales|support|personal|newsletter|other", "priority": "urgent|high|medium|low", "sentiment": "positive|neutral|negative"}`;

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt, temperature: 0.2, maxTokens: 200, context: 'email-categorize',
            }, config);

            if (routerResult.success) {
                const result = routerResult.result || {};
                const jsonMatch = (result.text || '').match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    await storage.updateEmail(emailId, {
                        ai_category: parsed.category,
                        ai_priority: parsed.priority,
                        sentiment: parsed.sentiment,
                    });
                    jsonResponse(res, { ok: true, ...parsed });
                    return true;
                }
            }
            jsonResponse(res, { ok: false, error: 'Failed to categorize' }, 500);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/emails/:id/summarize - AI summarize an email
    const emailSummarizeMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/summarize$/);
    if (emailSummarizeMatch && req.method === 'POST') {
        const emailId = emailSummarizeMatch[1];
        try {
            const email = await storage.getEmail(emailId);
            if (!email) {
                jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                return true;
            }

            const prompt = `/no_think
Summarize this email in 2-3 sentences. Output only the summary text, no JSON.

Subject: ${email.subject || ''}
From: ${email.from_name || email.from_email || ''}
Body: ${(email.body_text || '').substring(0, 3000)}`;

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt, temperature: 0.3, maxTokens: 300, context: 'email-summarize',
            }, config);

            if (routerResult.success) {
                const result = routerResult.result || {};
                const summary = (result.text || '').trim();
                await storage.updateEmail(emailId, { ai_summary: summary });
                jsonResponse(res, { ok: true, summary });
            } else {
                jsonResponse(res, { ok: false, error: routerResult.error || 'Failed to summarize' }, 500);
            }
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleEmails };
