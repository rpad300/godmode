/**
 * Purpose:
 *   Conversation import, management, and AI-enrichment pipeline. Handles
 *   parsing multi-format chat transcripts, AI-powered title/summary generation,
 *   entity extraction, knowledge-base population, and vector re-embedding.
 *
 * Responsibilities:
 *   - Parse conversations from various formats (Slack, WhatsApp, Teams, etc.)
 *   - Import conversations with optional AI processing (title, summary, entity extraction)
 *   - Populate knowledge base with extracted facts, decisions, risks, questions, actions, people
 *   - Auto-detect answers to pending questions from imported conversation content
 *   - Sync extracted entities and questions to the knowledge graph
 *   - CRUD operations on stored conversations
 *   - Re-embed conversation chunks via the configured embeddings provider
 *   - Aggregate conversation statistics
 *
 * Key dependencies:
 *   - ../../conversations: parser and chunk builder for embedding
 *   - ../../ai.getAIContentProcessor: entity/relationship extraction from conversations
 *   - ../../ontology.getOntologyAgent: optional ontology analysis of extracted data
 *   - ../../sync.getGraphSync: graph database synchronization for questions and entities
 *   - ../../llm/config: LLM provider/model resolution for text and embeddings
 *   - llm (ctx): text generation and embedding APIs
 *   - storage (ctx): conversation, knowledge, embedding, and contact persistence
 *
 * Side effects:
 *   - POST /api/conversations writes conversation, knowledge items, embeddings, and graph nodes
 *   - DELETE removes conversation, its embeddings, and graph references
 *   - POST /reembed replaces all embedding vectors for a conversation
 *   - Import triggers multiple LLM calls (title, extraction, answer detection)
 *   - Contacts are tracked from conversation participants
 *
 * Notes:
 *   - Parse preview is limited to 20 messages for performance
 *   - AI processing can be skipped via { skipAI: true } in the import body
 *   - Graph population is best-effort; individual Cypher failures are logged and skipped
 *   - Answer auto-detection uses keyword overlap heuristic + LLM confirmation
 *   - Conversation IDs match [a-f0-9-] (UUID format)
 *
 * Routes:
 *   POST   /api/conversations/parse         - Parse preview (no save)
 *          Body: { text, formatHint, meta }
 *   POST   /api/conversations               - Import conversation
 *          Body: { text, formatHint, meta, skipAI }
 *   GET    /api/conversations               - List (?sourceApp=&participant=)
 *   GET    /api/conversations/stats         - Aggregated statistics
 *   GET    /api/conversations/:id           - Single conversation
 *   PUT    /api/conversations/:id           - Update metadata
 *   DELETE /api/conversations/:id           - Delete conversation + embeddings + graph
 *   POST   /api/conversations/:id/reembed   - Re-generate embedding vectors
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');
const { jsonResponse } = require('../../server/response');
const llmRouter = require('../../llm/router');

async function handleConversations(ctx) {
    const { req, res, pathname, storage, config } = ctx;
    const log = getLogger().child({ module: 'conversations' });
    const llmConfig = require('../../llm/config');

    // POST /api/conversations/parse - Preview parse conversation without saving
    if (pathname === '/api/conversations/parse' && req.method === 'POST') {
        const body = await parseBody(req);
        const { text, formatHint, meta } = body;

        if (!text || typeof text !== 'string') {
            jsonResponse(res, { ok: false, error: 'text is required' }, 400);
            return true;
        }

        try {
            const conversations = require('../../conversations');
            const result = conversations.parse(text, formatHint || 'auto');

            // Limit preview to first 20 messages
            const messagesPreview = result.messages.slice(0, 20);

            jsonResponse(res, {
                ok: true,
                format: result.format,
                confidence: result.confidence,
                messagesPreview,
                stats: result.stats,
                warnings: result.warnings,
                hasMore: result.messages.length > 20
            });
        } catch (error) {
            log.warn({ event: 'conversations_parse_error', reason: error.message }, 'Parse error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/conversations - Import conversation
    if (pathname === '/api/conversations' && req.method === 'POST') {
        const body = await parseBody(req);
        const { text, formatHint, meta, skipAI } = body;

        if (!text || typeof text !== 'string') {
            jsonResponse(res, { ok: false, error: 'text is required' }, 400);
            return true;
        }

        try {
            const conversations = require('../../conversations');
            const parseResult = conversations.parse(text, formatHint || 'auto');

            if (parseResult.messages.length === 0) {
                jsonResponse(res, { ok: false, error: 'No messages could be parsed', warnings: parseResult.warnings }, 400);
                return true;
            }

            // Create normalized conversation
            const conversation = conversations.createConversation(parseResult, {
                projectId: storage.currentProjectId,
                title: meta?.title,
                channelName: meta?.channelName,
                workspaceName: meta?.workspaceName
            });

            // Store raw text for potential re-parsing (but not logged)
            conversation.rawText = text;

            // Apply user-provided document date for timeline
            if (meta?.documentDate) {
                conversation.documentDate = meta.documentDate;
                conversation.dateRange = {
                    first: meta.documentDate,
                    last: meta.documentDate
                };
                log.debug({ event: 'conversations_user_date', documentDate: meta.documentDate }, 'Using user-provided date');
            }

            // AI Processing: Generate title and summary if not skipped
            if (!skipAI && parseResult.messages.length > 0) {
                try {
                    const maxMessages = Math.min(30, parseResult.messages.length);
                    const excerpt = parseResult.messages.slice(0, maxMessages).map(m => {
                        const speaker = m.speaker || 'Unknown';
                        const text = m.text.substring(0, 200);
                        return `${speaker}: ${text}`;
                    }).join('\n');

                    const contactsContext = storage.getContactsContextForAI(parseResult.stats.participants);

                    const aiPrompt = `Analyze this conversation and provide:
1. A short descriptive title (max 60 chars, no quotes)
2. A brief summary (2-3 sentences describing the main topics discussed)

Participants: ${parseResult.stats.participants.join(', ')}
Messages: ${parseResult.messages.length}
Source: ${parseResult.format}
${contactsContext ? `\n${contactsContext}\n` : ''}
Conversation excerpt:
${excerpt}
${parseResult.messages.length > maxMessages ? `\n... (${parseResult.messages.length - maxMessages} more messages)` : ''}

Respond in this exact format:
TITLE: <title here>
SUMMARY: <summary here>`;

                    log.debug({ event: 'conversations_ai_title_start' }, 'Generating AI title and summary');

                    const aiRouterResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                        prompt: aiPrompt,
                        temperature: 0.3,
                        context: 'conversation-title',
                        maxTokens: 300
                    }, config);

                    if (aiRouterResult.success && aiRouterResult.result?.text) {
                        const titleMatch = aiRouterResult.result.text.match(/TITLE:\s*(.+?)(?:\n|SUMMARY:|$)/i);
                        const summaryMatch = aiRouterResult.result.text.match(/SUMMARY:\s*(.+?)$/is);

                        if (titleMatch && !meta?.title) {
                            conversation.title = titleMatch[1].trim().replace(/^["']|["']$/g, '').substring(0, 100);
                        }
                        if (summaryMatch) {
                            conversation.summary = summaryMatch[1].trim().substring(0, 500);
                        }

                        log.debug({ event: 'conversations_ai_generated', title: conversation.title }, 'AI generated title/summary');
                    }
                } catch (aiError) {
                    log.warn({ event: 'conversations_ai_failed', reason: aiError.message }, 'AI processing failed');
                }
            }

            // Save to storage
            const id = storage.addConversation(conversation);

            // AI Content Processor - Extract entities, relationships and populate graph
            const graphProvider = storage.getGraphProvider();
            if (!skipAI && graphProvider && graphProvider.connected) {
                try {
                    const { getAIContentProcessor } = require('../../ai');
                    const aiTextCfg = llmConfig.getTextConfig(config);
                    const aiProcessor = getAIContentProcessor({
                        config,
                        llmProvider: aiTextCfg.provider,
                        llmModel: aiTextCfg.model,
                        llmConfig: config.llm
                    });

                    log.debug({ event: 'conversations_entity_extraction_start' }, 'Running AI entity extraction');
                    const aiResult = await aiProcessor.processConversation({
                        ...conversation,
                        id
                    });

                    try {
                        const { getOntologyAgent } = require('../../ontology');
                        const ontologyAgent = getOntologyAgent({
                            graphProvider: storage.getGraphProvider(),
                            storage: storage,
                            llmConfig: config.llm,
                            appConfig: config,
                            dataDir: storage.getProjectDataDir ? storage.getProjectDataDir() : './data'
                        });
                        await ontologyAgent.analyzeExtraction(aiResult, conversation.title || 'conversation');
                    } catch (ontologyErr) {
                        // Ontology agent is optional
                    }

                    if (aiResult.cypherQueries && aiResult.cypherQueries.length > 0) {
                        log.debug({ event: 'conversations_graph_populate', queryCount: aiResult.cypherQueries.length }, 'Populating graph');
                        for (const cq of aiResult.cypherQueries) {
                            try {
                                await graphProvider.query(cq.query, cq.params);
                            } catch (cypherErr) {
                                log.warn({ event: 'conversations_cypher_error', reason: cypherErr.message }, 'Cypher error');
                            }
                        }
                    }

                    storage.updateConversation(id, {
                        extractedEntities: aiResult.entities || [],
                        extractedRelationships: aiResult.relationships || [],
                        extraction_result: aiResult,
                        aiProcessedAt: new Date().toISOString()
                    });

                    // Populate knowledge base
                    let factsAdded = 0, decisionsAdded = 0, risksAdded = 0, questionsAdded = 0, actionsAdded = 0, peopleAdded = 0;

                    for (const fact of aiResult.facts || []) {
                        if (fact.content && fact.content.length > 10) {
                            storage.addFact({
                                content: fact.content,
                                category: fact.category || 'general',
                                confidence: fact.confidence || 0.8,
                                source: `conversation:${id}`
                            });
                            factsAdded++;
                        }
                    }

                    for (const decision of aiResult.decisions || []) {
                        if (decision.content && decision.content.length > 10) {
                            storage.addDecision({
                                content: decision.content,
                                owner: decision.owner || null,
                                date: decision.date || new Date().toISOString().split('T')[0],
                                status: 'active',
                                source: `conversation:${id}`
                            });
                            decisionsAdded++;
                        }
                    }

                    for (const risk of aiResult.risks || []) {
                        if (risk.content && risk.content.length > 10) {
                            storage.addRisk({
                                content: risk.content,
                                impact: risk.impact || 'medium',
                                likelihood: 'medium',
                                mitigation: risk.mitigation || 'To be defined',
                                status: 'open',
                                source: `conversation:${id}`
                            });
                            risksAdded++;
                        }
                    }

                    for (const question of aiResult.questions || []) {
                        if (question.content && question.content.length > 10) {
                            storage.addQuestion({
                                content: question.content,
                                context: question.context || '',
                                priority: question.priority || 'medium',
                                assigned_to: question.assigned_to || null,
                                status: 'pending',
                                source_file: conversation.title || `conversation:${id}`
                            });
                            questionsAdded++;
                        }
                    }

                    for (const action of aiResult.actionItems || []) {
                        if (action.task && action.task.length > 5) {
                            await storage.addActionItem({
                                task: action.task,
                                owner: action.owner || action.assignee || null,
                                deadline: action.deadline || null,
                                status: action.status || 'pending',
                                source: `conversation:${id}`
                            });
                            actionsAdded++;
                        }
                    }

                    for (const participant of aiResult.participants || []) {
                        if (participant.name && participant.name.length > 2) {
                            storage.addPerson({
                                name: participant.name,
                                role: participant.role || null,
                                organization: participant.organization || null,
                                source: `conversation:${id}`
                            });
                            peopleAdded++;
                        }
                    }

                    log.debug({ event: 'conversations_knowledge_extracted', factsAdded, decisionsAdded, risksAdded, questionsAdded, actionsAdded, peopleAdded }, 'Knowledge extracted');
                    log.debug({ event: 'conversations_entities', entities: aiResult.entities?.length || 0, relationships: aiResult.relationships?.length || 0 }, 'Entities');

                    // Sync questions to graph
                    if (questionsAdded > 0 && graphProvider && graphProvider.connected) {
                        try {
                            const { getGraphSync } = require('../../sync');
                            const graphSync = getGraphSync({ graphProvider, storage });

                            const allQs = await storage.getQuestions();
                            const recentQuestions = (allQs || []).slice(-questionsAdded);
                            for (const q of recentQuestions) {
                                await graphSync.syncQuestion(q);
                            }
                            log.debug({ event: 'conversations_questions_synced', count: questionsAdded }, 'Synced questions to graph');
                        } catch (syncErr) {
                            log.warn({ event: 'conversations_question_sync_error', reason: syncErr.message }, 'Question sync error');
                        }
                    }

                    // Auto-detect answers in conversation
                    try {
                        const pendingQuestions = await storage.getQuestions('pending');
                        const conversationContent = conversation.messages?.map(m => m.text).join(' ') || '';
                        let answersFound = 0;

                        for (const pq of pendingQuestions.slice(0, 10)) {
                            const qWords = pq.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
                            const matchCount = qWords.filter(w => conversationContent.toLowerCase().includes(w)).length;
                            const matchRatio = matchCount / Math.max(qWords.length, 1);

                            if (matchRatio >= 0.5) {
                                const checkPrompt = `Does this conversation answer the following question?

QUESTION: "${pq.content}"
${pq.context ? `CONTEXT: ${pq.context}` : ''}

CONVERSATION EXCERPT:
"${conversationContent.substring(0, 2000)}"

If the conversation contains an answer to the question, respond:
ANSWERED: yes
ANSWER: <the answer found>
CONFIDENCE: high|medium|low

If not answered, respond:
ANSWERED: no`;

                                const checkRouterResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                                    prompt: checkPrompt,
                                    maxTokens: 400,
                                    temperature: 0.2,
                                    context: 'conversation-answer-check',
                                }, config);

                                if (checkRouterResult.success) {
                                    const checkResponse = checkRouterResult.result?.text || '';
                                    const isAnswered = checkResponse.match(/ANSWERED:\s*yes/i);
                                    const answerMatch = checkResponse.match(/ANSWER:\s*(.+?)(?=CONFIDENCE:|$)/is);
                                    const confidenceMatch = checkResponse.match(/CONFIDENCE:\s*(high|medium|low)/i);

                                    if (isAnswered && answerMatch && confidenceMatch?.[1]?.toLowerCase() === 'high') {
                                        const answer = answerMatch[1].trim();
                                        if (answer.length > 10) {
                                            const result = await storage.resolveQuestion(pq.id, answer, `conversation:${id}`);

                                            if (result?.question && graphProvider && graphProvider.connected) {
                                                try {
                                                    const { getGraphSync } = require('../../sync');
                                                    const graphSync = getGraphSync({ graphProvider, storage });
                                                    await graphSync.syncQuestion(result.question);
                                                } catch (syncErr) {
                                                    log.warn({ event: 'conversations_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
                                                }
                                            }

                                            answersFound++;
                                            log.debug({ event: 'conversations_auto_answered', contentPreview: pq.content.substring(0, 40) }, 'Auto-answered question');
                                        }
                                    }
                                }
                            }
                        }

                        if (answersFound > 0) {
                            log.debug({ event: 'conversations_auto_resolved', answersFound }, 'Auto-resolved pending questions');
                        }
                    } catch (answerErr) {
                        log.warn({ event: 'conversations_answer_detection_error', reason: answerErr.message }, 'Answer detection error');
                    }
                } catch (aiProcessError) {
                    log.warn({ event: 'conversations_ai_processor_error', reason: aiProcessError.message }, 'AI Content Processor error');
                }
            }

            storage.trackContactsFromConversation(conversation);

            log.debug({ event: 'conversations_imported', id, format: parseResult.format, messageCount: parseResult.messages.length }, 'Imported conversation');

            jsonResponse(res, {
                ok: true,
                id,
                title: conversation.title,
                summary: conversation.summary,
                stats: {
                    messageCount: conversation.messageCount,
                    dateRange: conversation.dateRange,
                    participants: conversation.participants,
                    sourceApp: conversation.sourceApp
                }
            });
        } catch (error) {
            log.warn({ event: 'conversations_import_error', reason: error.message }, 'Import error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/conversations - List conversations
    if (pathname === '/api/conversations' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const filter = {};
            if (parsedUrl.query.sourceApp) filter.sourceApp = parsedUrl.query.sourceApp;
            if (parsedUrl.query.participant) filter.participant = parsedUrl.query.participant;

            const conversations = storage.getConversations(filter);

            const list = conversations.map(c => ({
                id: c.id,
                title: c.title,
                summary: c.summary,
                sourceApp: c.sourceApp,
                channelName: c.channelName,
                workspaceName: c.workspaceName,
                participants: c.participants,
                messageCount: c.messageCount,
                dateRange: c.dateRange,
                importedAt: c.importedAt
            }));

            jsonResponse(res, { ok: true, conversations: list, total: list.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/conversations/:id - Get single conversation
    const convGetMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)$/);
    if (convGetMatch && req.method === 'GET') {
        const convId = convGetMatch[1];
        try {
            const conversation = storage.getConversationById(convId);
            if (!conversation) {
                jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                return true;
            }
            jsonResponse(res, { ok: true, conversation });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/conversations/:id - Update conversation metadata
    const convPutMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)$/);
    if (convPutMatch && req.method === 'PUT') {
        const convId = convPutMatch[1];
        const body = await parseBody(req);

        try {
            const success = storage.updateConversation(convId, body);
            if (!success) {
                jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                return true;
            }
            jsonResponse(res, { ok: true, message: 'Conversation updated' });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/conversations/:id - Delete conversation
    const convDeleteMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)$/);
    if (convDeleteMatch && req.method === 'DELETE') {
        const convId = convDeleteMatch[1];

        try {
            const conversation = storage.getConversationById(convId);

            const success = storage.deleteConversation(convId);
            if (!success) {
                jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                return true;
            }

            const embeddings = storage.loadEmbeddings();
            if (embeddings && embeddings.embeddings) {
                const filtered = embeddings.embeddings.filter(e => !e.id.startsWith(`conv_${convId}_`));
                if (filtered.length < embeddings.embeddings.length) {
                    embeddings.embeddings = filtered;
                    storage.saveEmbeddings(embeddings.embeddings);
                    log.debug({ event: 'conversations_embeddings_removed', convId }, 'Removed embeddings');
                }
            }

            try {
                const { getGraphSync } = require('../../sync');
                const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                await graphSync.onConversationDeleted(convId, conversation?.title);
            } catch (syncErr) {
                log.warn({ event: 'conversations_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }

            log.debug({ event: 'conversations_deleted', convId }, 'Deleted conversation');
            jsonResponse(res, { ok: true, message: 'Conversation deleted', graphSynced: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/conversations/:id/reembed - Re-index conversation
    const convReembedMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)\/reembed$/);
    if (convReembedMatch && req.method === 'POST') {
        const convId = convReembedMatch[1];

        try {
            const conversation = storage.getConversationById(convId);
            if (!conversation) {
                jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                return true;
            }

            const conversations = require('../../conversations');
            const chunks = conversations.getConversationEmbeddingItems([conversation]);

            if (chunks.length === 0) {
                jsonResponse(res, { ok: false, error: 'No chunks to embed' }, 400);
                return true;
            }

            const texts = chunks.map(c => c.text);
            const embedRouterResult = await llmRouter.routeAndExecute('embeddings', 'embed', {
                texts,
                context: 'conversation-reembed'
            }, config);

            if (!embedRouterResult.success) {
                jsonResponse(res, { ok: false, error: embedRouterResult.error || 'Embedding failed' }, 500);
                return true;
            }

            const embedResult = embedRouterResult.result;
            const existingEmbeddings = storage.loadEmbeddings();
            const allEmbeddings = existingEmbeddings?.embeddings || [];

            const filtered = allEmbeddings.filter(e => !e.id.startsWith(`conv_${convId}_`));

            for (let i = 0; i < chunks.length; i++) {
                filtered.push({
                    id: chunks[i].id,
                    type: 'conversation',
                    text: chunks[i].text,
                    embedding: embedResult.embeddings[i],
                    data: chunks[i].data
                });
            }

            storage.saveEmbeddings(filtered);
            log.debug({ event: 'conversations_reembedded', convId, chunks: chunks.length }, 'Re-embedded conversation');

            jsonResponse(res, { ok: true, chunksEmbedded: chunks.length });
        } catch (error) {
            log.warn({ event: 'conversations_reembed_error', reason: error.message }, 'Reembed error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/conversations/:id/summarize - AI summarize a conversation
    const convSummarizeMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)\/summarize$/);
    if (convSummarizeMatch && req.method === 'POST') {
        const convId = convSummarizeMatch[1];
        try {
            const conversation = storage.getConversationById(convId);
            if (!conversation) {
                jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                return true;
            }

            const messages = (conversation.messages || []).slice(0, 40);
            const excerpt = messages.map(m => {
                const speaker = m.speaker || m.sender || 'Unknown';
                const text = (m.text || '').substring(0, 200);
                return `${speaker}: ${text}`;
            }).join('\n');

            const prompt = `/no_think
Summarize this conversation in 3-5 sentences. Output only the summary text, no JSON.

Title: ${conversation.title || 'Untitled'}
Participants: ${(conversation.participants || []).join(', ')}
Messages (${conversation.messageCount || messages.length} total):
${excerpt}`;

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.3, maxTokens: 400, context: 'conversation-summarize',
            }, config);

            if (routerResult.success) {
                const summary = (routerResult.result?.text || '').trim();
                storage.updateConversation(convId, { summary });
                jsonResponse(res, { ok: true, summary });
            } else {
                jsonResponse(res, { ok: false, error: routerResult.error || 'Failed to summarize' }, 500);
            }
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/conversations/stats - Get conversation statistics
    if (pathname === '/api/conversations/stats' && req.method === 'GET') {
        try {
            const stats = await storage.getConversationStats();
            jsonResponse(res, { ok: true, ...stats });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleConversations };
