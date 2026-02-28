/**
 * Purpose:
 *   Orchestrates the full document processing pipeline: file extraction,
 *   LLM-based analysis, structured data storage, and holistic synthesis.
 *   Acts as the coordinator between Extractor, Analyzer, and Synthesizer.
 *
 * Responsibilities:
 *   - Batch-process all pending content files (processAll)
 *   - Process individual files through extract -> analyze -> store -> summarize
 *   - Poll for newly uploaded documents and auto-process them in the background
 *   - Respect per-provider concurrency limits when scheduling background jobs
 *   - Track processing state (progress, timing estimates, errors) for the UI
 *   - Provide legacy compatibility aliases for older calling code
 *
 * Key dependencies:
 *   - ./processor/extractor: reads file content (PDF, text, images via MarkItDown)
 *   - ./processor/analyzer: builds prompts, calls LLM, parses AI responses
 *   - ./processor/synthesizer: cross-document knowledge synthesis and KB generation
 *   - storage (injected): persistence layer for documents, facts, decisions, etc.
 *
 * Side effects:
 *   - Reads files from the filesystem (via extractor)
 *   - Calls external LLM APIs (via analyzer)
 *   - Writes extracted entities to storage (facts, decisions, questions, risks, actions, people)
 *   - Starts an interval timer for document polling (startPolling)
 *
 * Notes:
 *   - processFile currently does not implement idempotency via content hashing;
 *     the TODO is noted in the code. Callers should manage re-processing guards.
 *   - The polling loop uses a simple Set (filesInProgress) to avoid double-processing,
 *     but provider job counts are tracked separately in providerJobs for concurrency.
 *   - Synthesis runs after all individual files are processed (60-100% progress range).
 */

const path = require('path');
const { logger: rootLogger } = require('./logger');

const DocumentExtractor = require('./processor/extractor');
const DocumentAnalyzer = require('./processor/analyzer');
const DocumentSynthesizer = require('./processor/synthesizer');

const log = rootLogger.child({ module: 'processor' });

class DocumentProcessor {
    /**
     * @param {Object} storage - Storage backend (LegacyStorage or StorageCompat)
     * @param {Object} config  - Application config; must include dataDir and llm settings
     */
    constructor(storage, config) {
        this.storage = storage;
        this.config = config;

        // Initialize components
        this.extractor = new DocumentExtractor(config);
        this.analyzer = new DocumentAnalyzer(config);
        this.synthesizer = new DocumentSynthesizer(storage, config, this.analyzer);

        this.processingState = {
            status: 'idle',
            progress: 0,
            currentFile: null,
            message: '',
            errors: [],
            totalFiles: 0,
            processedFiles: 0,
            startTime: null,
            estimatedTimeRemaining: 0,
            currentPhase: null,
            filesTiming: []
        };

        // Track files currently being processed
        this.filesInProgress = new Set(); // Stores filenames or IDs
        this.providerJobs = {}; // Stores provider -> count mapping
        this.pollingInterval = null;
        this.isPolling = false;
    }

    /**
     * Hot-reload config without restarting the processor.
     * Propagates to sub-components so they pick up new LLM settings.
     */
    updateConfig(newConfig) {
        this.config = newConfig;
        if (this.extractor) this.extractor.config = newConfig;
        if (this.analyzer) this.analyzer.config = newConfig;
        if (this.synthesizer) this.synthesizer.config = newConfig;
    }

    /**
     * Update the data directory when the active project changes.
     * Propagates to sub-components so file path resolution stays correct.
     * @param {string} newDataDir - Absolute path to the new project data directory
     */
    updateDataDir(newDataDir) {
        this.config.dataDir = newDataDir;
        if (this.extractor) this.extractor.config.dataDir = newDataDir;
        if (this.analyzer) this.analyzer.config.dataDir = newDataDir;
        if (this.synthesizer) this.synthesizer.config.dataDir = newDataDir;
    }

    /**
     * Initialize processor (load prompts, check tools)
     */
    async initialize() {
        await this.analyzer.loadPromptsFromSupabase();
        await this.analyzer.loadContextVariables(this.config.projectId);
        this.extractor.checkMarkItDown();
    }

    /**
     * Scan for pending files
     * used by GET /api/files
     */
    async scanPendingFiles() {
        if (!this.storage.getDocuments) return [];
        const allDocs = await this.storage.getDocuments();
        return allDocs.filter(d => d.status === 'pending');
    }

    /**
     * Batch-process all content files through two phases:
     *   Phase 1 (0-60% progress): Extract and analyze each file individually
     *   Phase 2 (60-100% progress): Run holistic cross-document synthesis
     *
     * Only one processAll invocation may run at a time (guard via processingState.status).
     *
     * @param {string} textModel   - LLM model identifier for text analysis
     * @param {string} [visionModel] - LLM model for vision tasks (images/PDFs)
     * @returns {Object} { success, processed, errors, stats, synthesis } on completion,
     *                   or { success: false, message|error } on conflict/failure
     */
    async processAll(textModel, visionModel = null) {
        if (this.processingState.status === 'running') {
            log.warn({ event: 'processor_busy' }, 'Processor is already running');
            return { success: false, message: 'Processor is already running' };
        }

        // Initialize if needed
        await this.initialize();

        this.processingState = {
            status: 'running',
            progress: 0,
            currentFile: null,
            message: 'Starting processing...',
            errors: [],
            totalFiles: 0,
            processedFiles: 0,
            startTime: Date.now(),
            estimatedTimeRemaining: null,
            currentPhase: 'extraction',
            filesTiming: []
        };

        try {
            // Get files
            const contentFiles = this.synthesizer.getContentFiles();
            this.processingState.totalFiles = contentFiles.length;
            log.info({ event: 'processor_start', count: contentFiles.length }, 'Starting batch processing');

            // 1. Process each file (Extraction Phase)
            const processedIds = {};
            const stats = {
                facts: 0,
                decisions: 0,
                questions: 0,
                risks: 0,
                actions: 0,
                people: 0,
                documents: 0
            };

            for (let i = 0; i < contentFiles.length; i++) {
                const file = contentFiles[i];
                this.processingState.currentFile = file.name;
                this.processingState.message = `Processing ${file.name} (${i + 1}/${contentFiles.length})`;
                this.processingState.progress = Math.round((i / contentFiles.length) * 60); // 0-60% for extraction

                try {
                    // Check if file needs processing (hash check handled in processFile, but we can optimize here)
                    // For now, consistent with old logic, reprocess everything or logic inside processFile checks DB?
                    // The old processFile logic checked if file changed.
                    // We will implement `processFile` to handle idempotency.

                    const result = await this.processFile(file.path, textModel, visionModel);

                    if (result.success) {
                        processedIds[file.name] = result.documentId;
                        stats.documents++;
                        stats.facts += result.stats.facts || 0;
                        stats.decisions += result.stats.decisions || 0;
                        stats.questions += result.stats.questions || 0;
                        stats.risks += result.stats.risks || 0;
                        stats.actions += result.stats.actions || 0;
                        stats.people += result.stats.people || 0;
                    } else if (result.skipped) {
                        // Count as processed/skipped
                    } else {
                        this.processingState.errors.push({ file: file.name, error: result.error });
                    }
                } catch (e) {
                    this.processingState.errors.push({ file: file.name, error: e.message });
                    log.error({ event: 'processor_file_error', file: file.name, error: e.message }, 'Error processing file');
                }

                this.processingState.processedFiles++;
                this._updateEstimatedTime(i + 1);
            }

            // 2. Holistic Synthesis Phase (60-100%)
            this.processingState.currentPhase = 'synthesis';
            this.processingState.message = 'Running holistic synthesis...';

            // Delegate to Synthesizer
            // We pass processedIds (mapping filename -> docId) if needed
            const synthesisResult = await this.synthesizer.holisticSynthesis(textModel, processedIds);

            // 3. Complete
            this.processingState.status = 'complete';
            this.processingState.progress = 100;
            this.processingState.message = 'Processing complete';
            this.processingState.currentFile = null;

            return {
                success: true,
                processed: stats.documents,
                errors: this.processingState.errors,
                stats: stats,
                synthesis: synthesisResult
            };

        } catch (error) {
            this.processingState.status = 'error';
            this.processingState.message = `Error: ${error.message}`;
            log.error({ event: 'processor_fatal_error', error: error.message }, 'Fatal processing error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Process a single file through the full extraction pipeline:
     *   1. Read file content (via extractor)
     *   2. Build extraction prompt and call LLM
     *   3. Parse structured AI response into entities
     *   4. Persist entities to storage (facts, decisions, questions, risks, actions, people)
     *   5. Run post-processing: resolve answered questions, complete actions
     *   6. Generate and store an AI summary for the document
     *
     * Assumption: idempotency via content hash is not yet implemented --
     * the caller is responsible for avoiding redundant reprocessing.
     *
     * @param {string} filePath      - Absolute path to the file
     * @param {string} textModel     - LLM model for text extraction
     * @param {string} [visionModel] - LLM model for vision (unused here currently)
     * @param {boolean} [isTranscript] - If true, uses transcript-specific prompt tuning
     * @returns {Object} { success, documentId, stats, resolvedQuestions, completedActions }
     *                   or { success: false, error }
     */
    async processFile(filePath, textModel, visionModel = null, isTranscript = false, options = {}) {
        const filename = filePath ? path.basename(filePath) : (options.filename || 'inline-document');
        const MIN_CONFIDENCE = this.config.processing?.minConfidence ?? 0.4;

        // Dynamic chunk size: use model context window if known, else config/default
        let MAX_CHUNK_CHARS = this.config.processing?.maxChunkChars ?? 60000;
        try {
            const modelMeta = require('./llm/modelMetadata');
            const resolvedModel = textModel || this.config.llm?.models?.text;
            const resolvedProvider = this.config.llm?.perTask?.text?.provider || this.config.llm?.provider;
            if (resolvedModel && resolvedProvider) {
                const meta = modelMeta.getModelMetadata(resolvedProvider, resolvedModel);
                if (meta?.contextTokens) {
                    // Reserve ~4K tokens for prompt template + output, convert rest to chars
                    const availableTokens = meta.contextTokens - 4096;
                    const dynamicChars = Math.floor(availableTokens * 3.5);
                    MAX_CHUNK_CHARS = Math.max(10000, Math.min(dynamicChars, 500000));
                }
            }
        } catch (_) { /* modelMetadata not available, use default */ }

        let extractResult = null;
        try {
            // 1. Extract content (accept inline content to avoid temp file IO)
            let content;
            if (options.inlineContent) {
                content = options.inlineContent;
            } else {
                extractResult = await this.extractor.readFileContent(filePath);
                content = typeof extractResult === 'string' ? extractResult : extractResult?.content;
            }

            // 1b. Image files: delegate to vision model instead of text extraction
            if (typeof content === 'string' && content.startsWith('[IMAGE:')) {
                return this._processImageFile(filePath, textModel, visionModel, options);
            }

            if (!content || content.length < 50) {
                return { success: false, error: 'Empty or too short content' };
            }

            // 2. Content deduplication
            const contentHash = this.synthesizer._getContentHash(content);
            if (this.storage.findDocumentByHash) {
                try {
                    const existing = await this.storage.findDocumentByHash(contentHash);
                    if (existing) {
                        log.debug({ event: 'processor_dedup_skip', filename, hash: contentHash, existingDoc: existing.id }, 'Skipping duplicate content');
                        return { success: true, skipped: true, documentId: existing.id, stats: { facts: 0, decisions: 0, questions: 0, risks: 0, actions: 0, people: 0 } };
                    }
                } catch (e) {
                    log.debug({ event: 'processor_dedup_check_failed', reason: e.message }, 'Dedup check failed, continuing');
                }
            }

            // 3. Chunk large documents and process each chunk
            const chunks = this._chunkContent(content, MAX_CHUNK_CHARS);
            log.debug({ event: 'processor_chunks', filename, totalChars: content.length, chunks: chunks.length }, 'Content chunked');

            let mergedExtraction = { facts: [], decisions: [], questions: [], risks: [], action_items: [], people: [], relationships: [], key_topics: [], title: null, summary: null };

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkLabel = chunks.length > 1 ? ` (part ${i + 1}/${chunks.length})` : '';

                // 3a. Build prompt
                const extractionPrompt = this.analyzer.buildExtractionPrompt(chunk, filename + chunkLabel, isTranscript);

                // 3b. Run LLM with JSON mode
                const llmResult = await this.analyzer.llmGenerateText(textModel, extractionPrompt, { jsonMode: true });
                if (!llmResult.success) {
                    log.warn({ event: 'processor_llm_chunk_failed', filename, chunk: i, error: llmResult.error }, 'LLM failed for chunk');
                    continue;
                }

                // 3c. Parse response and validate success
                const extracted = this.analyzer.parseAIResponse(llmResult.response);
                if (extracted.success === false || extracted.error) {
                    log.warn({ event: 'processor_parse_failed', filename, chunk: i, error: extracted.error, raw: extracted.raw }, 'Extraction parse failed');
                    continue;
                }

                // 3d. Merge chunk results
                if (extracted.facts) mergedExtraction.facts.push(...extracted.facts);
                if (extracted.decisions) mergedExtraction.decisions.push(...extracted.decisions);
                if (extracted.questions) mergedExtraction.questions.push(...extracted.questions);
                if (extracted.risks) mergedExtraction.risks.push(...extracted.risks);
                if (extracted.action_items) mergedExtraction.action_items.push(...extracted.action_items);
                if (extracted.people) mergedExtraction.people.push(...extracted.people);
                if (extracted.relationships) mergedExtraction.relationships.push(...extracted.relationships);
                if (extracted.key_topics) mergedExtraction.key_topics.push(...extracted.key_topics);
                if (!mergedExtraction.title && extracted.title) mergedExtraction.title = extracted.title;
                if (!mergedExtraction.summary && extracted.summary) mergedExtraction.summary = extracted.summary;
            }

            const extracted = mergedExtraction;

            // 4. Validate we got something useful
            const totalEntities = (extracted.facts?.length || 0) + (extracted.decisions?.length || 0) +
                (extracted.questions?.length || 0) + (extracted.risks?.length || 0) +
                (extracted.action_items?.length || 0) + (extracted.people?.length || 0);

            if (totalEntities === 0 && !extracted.summary) {
                log.warn({ event: 'processor_empty_extraction', filename }, 'No entities extracted from any chunk');
                return { success: false, error: 'Extraction produced no entities' };
            }

            // 5. Filter by confidence threshold (all entity types that carry confidence)
            if (MIN_CONFIDENCE > 0) {
                const confFilter = item => (item.confidence ?? 1) >= MIN_CONFIDENCE;
                extracted.facts = (extracted.facts || []).filter(confFilter);
                extracted.decisions = (extracted.decisions || []).filter(confFilter);
                extracted.risks = (extracted.risks || []).filter(confFilter);
            }

            // 6. Deduplicate entities within this document
            extracted.facts = this._deduplicateByContent(extracted.facts, 'content');
            extracted.decisions = this._deduplicateByContent(extracted.decisions, 'content');
            extracted.risks = this._deduplicateByContent(extracted.risks, 'content');
            extracted.people = this._deduplicatePeople(extracted.people);
            extracted.key_topics = [...new Set((extracted.key_topics || []).map(t => t.toLowerCase()))];

            // 7. Store or update document record
            let docRecord = null;
            let docId = options.documentId || null;
            if (docId && this.storage.updateDocument) {
                // Document already exists (e.g. Krisp import, reprocess) — update it
                try {
                    docRecord = await this.storage.updateDocument(docId, {
                        content_hash: contentHash,
                        metadata: {
                            extracted_at: new Date().toISOString(),
                            model: textModel,
                            chunks: chunks.length,
                            key_topics: extracted.key_topics
                        }
                    });
                } catch (e) {
                    log.debug({ event: 'processor_update_existing_doc_failed', docId, reason: e.message }, 'Update failed, will create new');
                    docId = null;
                }
            }
            if (!docId && this.storage.addDocument) {
                docRecord = await this.storage.addDocument({
                    filename: filename,
                    content_hash: contentHash,
                    metadata: {
                        extracted_at: new Date().toISOString(),
                        model: textModel,
                        chunks: chunks.length,
                        key_topics: extracted.key_topics
                    }
                });
                docId = docRecord?.id || docRecord;
            } else if (!docId) {
                docId = extractResult?.id || null;
            }

            const docSprintId = docRecord?.sprint_id || null;
            const sourceFields = { source_file: filename, source_document_id: docId, sprint_id: docSprintId };

            // 7b. Persist extracted content to raw_content (enables backfill/tree index later)
            if (docId && this.storage.saveRawContent) {
                this.storage.saveRawContent(docId, filename, content, 'processor').catch(err =>
                    log.debug({ event: 'raw_content_save_failed', reason: err.message }, 'Non-blocking')
                );
            }

            const stats = { facts: 0, decisions: 0, questions: 0, risks: 0, actions: 0, people: 0, relationships: 0 };

            // 8. Batch-store all entity types
            if (extracted.facts?.length > 0 && this.storage.addFacts) {
                const facts = extracted.facts.map(f => ({ ...f, ...sourceFields }));
                const res = await this.storage.addFacts(facts);
                stats.facts = res.inserted || facts.length;
            }

            if (extracted.decisions?.length > 0) {
                const items = extracted.decisions.map(d => ({ ...d, ...sourceFields }));
                if (this.storage.addDecisions) {
                    const res = await this.storage.addDecisions(items);
                    stats.decisions = res.inserted || items.length;
                } else if (this.storage.addDecision) {
                    await Promise.all(items.map(d => this.storage.addDecision(d)));
                    stats.decisions = items.length;
                }
            }

            if (extracted.questions?.length > 0) {
                const items = extracted.questions.map(q => ({ ...q, ...sourceFields }));
                if (this.storage.addQuestions) {
                    const res = await this.storage.addQuestions(items);
                    stats.questions = res.inserted || items.length;
                } else if (this.storage.addQuestion) {
                    await Promise.all(items.map(q => this.storage.addQuestion(q)));
                    stats.questions = items.length;
                }
            }

            if (extracted.risks?.length > 0) {
                const items = extracted.risks.map(r => ({ ...r, ...sourceFields }));
                if (this.storage.addRisks) {
                    const res = await this.storage.addRisks(items);
                    stats.risks = res.inserted || items.length;
                } else if (this.storage.addRisk) {
                    await Promise.all(items.map(r => this.storage.addRisk(r)));
                    stats.risks = items.length;
                }
            }

            if (extracted.action_items?.length > 0) {
                const items = extracted.action_items.map(a => ({ ...a, ...sourceFields }));
                if (this.storage.addActionItems) {
                    const res = await this.storage.addActionItems(items);
                    stats.actions = res.inserted || items.length;
                } else if (this.storage.addActionItem) {
                    await Promise.all(items.map(a => this.storage.addActionItem(a)));
                    stats.actions = items.length;
                }
            }

            if (extracted.people?.length > 0) {
                const items = extracted.people.map(p => ({ ...p, ...sourceFields }));
                if (this.storage.addPeople) {
                    const res = await this.storage.addPeople(items);
                    stats.people = res.inserted || items.length;
                } else if (this.storage.addPerson) {
                    await Promise.all(items.map(p => this.storage.addPerson(p)));
                    stats.people = items.length;
                }
            }

            // 9. Store relationships (previously discarded)
            if (extracted.relationships?.length > 0 && this.storage.addRelationships) {
                try {
                    const rels = extracted.relationships.map(r => ({ ...r, ...sourceFields }));
                    const res = await this.storage.addRelationships(rels);
                    stats.relationships = res.inserted || rels.length;
                } catch (relErr) {
                    log.debug({ event: 'processor_relationships_store_error', reason: relErr.message }, 'Relationship storage skipped');
                }
            }

            // 10. Use extraction title/summary instead of separate LLM call
            let summaryTitle = extracted.title || null;
            let summarySummary = extracted.summary || null;

            if (!summaryTitle || !summarySummary) {
                try {
                    const fallback = await this.analyzer.generateFileSummary(
                        filename, extracted, stats.facts, stats.decisions, stats.risks, stats.people
                    );
                    if (fallback) {
                        summaryTitle = summaryTitle || fallback.title;
                        summarySummary = summarySummary || fallback.summary;
                    }
                } catch (sumErr) {
                    log.debug({ event: 'processor_summary_fallback_error', reason: sumErr.message }, 'Summary fallback failed');
                }
            }

            if ((summaryTitle || summarySummary) && docId && this.storage.updateDocument) {
                await this.storage.updateDocument(docId, {
                    ai_title: (summaryTitle || '').substring(0, 60),
                    ai_summary: (summarySummary || '').substring(0, 200)
                });
            }

            // 11. Post-processing (question resolution & action completion)
            let resolvedCount = 0;
            try {
                resolvedCount = await this.analyzer.detectAndResolveQuestionsWithAI(this.storage, this.config) || 0;
            } catch (qErr) {
                log.debug({ event: 'processor_resolve_questions_error', reason: qErr.message }, 'Question resolution skipped');
            }
            const completedActions = this.analyzer.checkAndCompleteActions(this.storage, extracted);

            // 12. Trigger GraphSync to update knowledge graph
            try {
                const { getGraphSync } = require('./sync');
                const graphSync = getGraphSync({});
                if (graphSync && typeof graphSync.onDocumentProcessed === 'function') {
                    graphSync.onDocumentProcessed({ id: docId, filename }, extracted).catch(gErr =>
                        log.debug({ event: 'processor_graph_sync_error', reason: gErr.message }, 'Graph sync after processing failed')
                    );
                }
            } catch (_) { /* GraphSync not available */ }

            // 13. Generate tree index for long documents (fire-and-forget)
            try {
                const minChars = this.config.docindex?.minChars || 20000;
                const docType = docRecord?.doc_type || options.docType || 'document';
                const isLongDoc = docType === 'document' && content.length >= minChars;

                if (isLongDoc) {
                    const { TreeIndexBuilder } = require('./docindex');
                    const builder = new TreeIndexBuilder(this.config);
                    builder.buildAndStore(docId, content, this.storage).catch(err =>
                        log.warn({ event: 'tree_index_failed', documentId: docId, reason: err.message }, 'Tree index generation failed')
                    );
                }
            } catch (_) { /* Tree index module not available */ }

            log.info({
                event: 'processor_file_done', filename, docId, stats,
                title: summaryTitle, chunks: chunks.length
            }, 'File processed');

            return {
                success: true,
                documentId: docId,
                stats,
                resolvedQuestions: resolvedCount,
                completedActions: completedActions
            };

        } catch (e) {
            log.error({ event: 'process_file_error', file: filename, error: e.message }, 'Single file processing error');
            return { success: false, error: e.message };
        }
    }

    /**
     * Split content into chunks that fit within the LLM context window.
     * Splits on paragraph boundaries to avoid cutting mid-sentence.
     */
    _chunkContent(content, maxChars) {
        if (content.length <= maxChars) return [content];

        const chunks = [];
        const paragraphs = content.split(/\n\s*\n/);
        let current = '';

        for (const para of paragraphs) {
            if (current.length + para.length + 2 > maxChars && current.length > 0) {
                chunks.push(current.trim());
                current = para;
            } else {
                current += (current ? '\n\n' : '') + para;
            }
        }
        if (current.trim()) chunks.push(current.trim());

        // If a single paragraph exceeds maxChars, split on sentence boundaries
        const result = [];
        for (const chunk of chunks) {
            if (chunk.length <= maxChars) {
                result.push(chunk);
            } else {
                const sentences = chunk.split(/(?<=[.!?])\s+/);
                let seg = '';
                for (const s of sentences) {
                    if (s.length > maxChars) {
                        // Hard-split: no sentence boundary can fit within limit
                        if (seg.trim()) { result.push(seg.trim()); seg = ''; }
                        for (let off = 0; off < s.length; off += maxChars) {
                            result.push(s.substring(off, off + maxChars));
                        }
                    } else if (seg.length + s.length + 1 > maxChars && seg.length > 0) {
                        result.push(seg.trim());
                        seg = s;
                    } else {
                        seg += (seg ? ' ' : '') + s;
                    }
                }
                if (seg.trim()) result.push(seg.trim());
            }
        }

        return result.length > 0 ? result : [content.substring(0, maxChars)];
    }

    /**
     * Process an image file using the vision model pipeline.
     * Called when the extractor returns [IMAGE:path] sentinel.
     */
    async _processImageFile(filePath, textModel, visionModel, options = {}) {
        const filename = filePath ? path.basename(filePath) : (options.filename || 'image');
        log.info({ event: 'processor_vision_start', filename }, 'Processing image via vision model');

        try {
            const visionPrompt = this.analyzer.buildVisionPrompt(filename, visionModel || textModel || '');
            const result = await this.analyzer.llmGenerateVision(visionModel || textModel, visionPrompt, filePath);

            if (!result.success) {
                log.warn({ event: 'processor_vision_failed', filename, error: result.error }, 'Vision processing failed');
                return { success: false, error: result.error || 'Vision model failed' };
            }

            const extracted = this.analyzer.parseAIResponse(result.response);
            if (extracted.success === false || extracted.error) {
                return { success: false, error: 'Vision extraction parse failed' };
            }

            // Store document record
            let docId = null;
            if (this.storage.addDocument) {
                const docRecord = await this.storage.addDocument({
                    filename,
                    metadata: { extracted_at: new Date().toISOString(), model: visionModel || textModel, type: 'image' }
                });
                docId = docRecord?.id || docRecord;
            }

            const sourceFields = { source_file: filename, source_document_id: docId };
            const stats = { facts: 0, decisions: 0, questions: 0, risks: 0, actions: 0, people: 0 };

            if (extracted.facts?.length > 0 && this.storage.addFacts) {
                const facts = extracted.facts.map(f => ({ ...f, ...sourceFields }));
                await this.storage.addFacts(facts);
                stats.facts = facts.length;
            }
            if (extracted.decisions?.length > 0 && this.storage.addDecision) {
                for (const d of extracted.decisions) { await this.storage.addDecision({ ...d, ...sourceFields }); stats.decisions++; }
            }
            if (extracted.risks?.length > 0 && this.storage.addRisk) {
                for (const r of extracted.risks) { await this.storage.addRisk({ ...r, ...sourceFields }); stats.risks++; }
            }
            if (extracted.people?.length > 0 && this.storage.addPeople) {
                await this.storage.addPeople(extracted.people.map(p => ({ ...p, ...sourceFields })));
                stats.people = extracted.people.length;
            }

            if (docId && this.storage.updateDocument) {
                await this.storage.updateDocument(docId, {
                    title: extracted.title || filename,
                    summary: extracted.summary || '',
                    status: 'completed'
                });
            }

            return { success: true, documentId: docId, stats };
        } catch (e) {
            log.error({ event: 'processor_vision_error', filename, error: e.message }, 'Vision processing error');
            return { success: false, error: e.message };
        }
    }

    /**
     * Deduplicate entities by a text field using normalized comparison.
     */
    _deduplicateByContent(items, field) {
        if (!items || items.length === 0) return items;
        const seen = new Set();
        return items.filter(item => {
            const key = (item[field] || '').toLowerCase().trim().replace(/\s+/g, ' ');
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Deduplicate people by fuzzy name matching.
     * Handles variations like "Rui Dias" vs "Rui P Dias" vs "rui.dias".
     */
    _deduplicatePeople(people) {
        if (!people || people.length === 0) return people;
        const result = [];
        const normalizePersonName = (name) => {
            return (name || '').toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();
        };

        for (const person of people) {
            const norm = normalizePersonName(person.name);
            if (!norm) continue;
            const normParts = norm.split(' ').filter(p => p.length > 1);

            const existing = result.find(p => {
                const existNorm = normalizePersonName(p.name);
                if (existNorm === norm) return true;
                const existParts = existNorm.split(' ').filter(pt => pt.length > 1);
                // Match if first and last name tokens overlap
                const overlap = normParts.filter(t => existParts.includes(t));
                return overlap.length >= 2 || (normParts.length === 1 && existParts.includes(normParts[0]));
            });

            if (existing) {
                // Merge: prefer longer name, fill in missing fields
                if ((person.name || '').length > (existing.name || '').length) existing.name = person.name;
                if (person.role && !existing.role) existing.role = person.role;
                if (person.organization && !existing.organization) existing.organization = person.organization;
            } else {
                result.push({ ...person });
            }
        }
        return result;
    }

    /**
     * Reprocess a specific document
     * Clears existing facts/metadata and re-runs extraction
     */
    async reprocessDocument(docIdOrFilename, textModel, visionModel = null) {
        log.info({ event: 'processor_reprocess_start', file: docIdOrFilename }, 'Reprocessing document');

        // Resolve document: accept either UUID or filename
        let docId = null;
        let doc = null;
        try {
            if (this.storage.getDocumentById) {
                doc = await Promise.resolve(this.storage.getDocumentById(docIdOrFilename));
            }
            if (!doc && this.storage.getDocuments) {
                const docs = await Promise.resolve(this.storage.getDocuments());
                doc = (docs || []).find(d =>
                    d.id === docIdOrFilename || d.filename === docIdOrFilename || d.name === docIdOrFilename
                );
            }
            if (doc) docId = doc.id;
        } catch (e) {
            log.debug({ event: 'processor_reprocess_lookup_failed', reason: e.message }, 'Document lookup failed');
        }

        try {
            if (docId) {
                const tasks = [];
                if (this.storage.deleteFactsByDocument) tasks.push(this.storage.deleteFactsByDocument(docId));
                if (this.storage.deleteDecisionsByDocument) tasks.push(this.storage.deleteDecisionsByDocument(docId));
                if (this.storage.deleteRisksByDocument) tasks.push(this.storage.deleteRisksByDocument(docId));
                if (this.storage.deleteQuestionsByDocument) tasks.push(this.storage.deleteQuestionsByDocument(docId));
                if (this.storage.deleteActionsByDocument) tasks.push(this.storage.deleteActionsByDocument(docId));
                await Promise.allSettled(tasks);

                if (this.storage.updateDocument) {
                    await this.storage.updateDocument(docId, { file_hash: null, status: 'pending' });
                }
                log.debug({ event: 'processor_reprocess_cleared', docId }, 'Cleared existing document data');
            }
        } catch (e) {
            log.warn({ event: 'processor_reprocess_clear_failed', reason: e.message }, 'Failed to clear document data, proceeding with reprocessing');
        }

        // Resolve file path from the document record or the input
        const resolvedModel = textModel || this.config.llm?.models?.text || 'gpt-4o';
        const filename = doc?.filename || doc?.name || docIdOrFilename;
        let filePath = doc?.filepath || doc?.path || filename;

        // Handle inline content documents (e.g. Krisp imports)
        const isInlineDoc = !filePath || filePath === 'krisp-mcp-import' || filePath === 'inline';
        let inlineContent = doc?.content;

        // If content is missing but should be inline, fetch from DB directly
        if (isInlineDoc && !inlineContent && docId && this.storage.getDocumentById) {
            try {
                const freshDoc = await Promise.resolve(this.storage.getDocumentById(docId));
                if (freshDoc?.content) {
                    inlineContent = freshDoc.content;
                    log.debug({ event: 'processor_reprocess_inline_fetched', docId }, 'Fetched inline content from DB for reprocess');
                }
            } catch (e) {
                log.debug({ event: 'processor_reprocess_inline_fetch_failed', docId, reason: e.message }, 'Inline content fetch failed');
            }
        }

        const processOpts = { documentId: docId };
        if (isInlineDoc && inlineContent) {
            return this.processFile(null, resolvedModel, visionModel, false, {
                ...processOpts,
                inlineContent: inlineContent,
                filename: filename
            });
        }

        if (isInlineDoc && !inlineContent) {
            return { success: false, error: 'Inline content document has no content stored — cannot reprocess' };
        }

        if (filePath && !path.isAbsolute(filePath)) {
            filePath = path.join(this.config.dataDir, 'content', filePath);
        }
        if (!filePath) {
            return { success: false, error: 'Could not resolve file path for document' };
        }
        return this.processFile(filePath, resolvedModel, visionModel, false, processOpts);
    }

    // Alias for backward compatibility
    async processAllContentFirst(textModel, visionModel = null) {
        return this.processAll(textModel, visionModel);
    }

    // Legacy synthesis delegations
    async synthesizeKnowledge(reasoningModel) {
        return this.synthesizer.holisticSynthesis(reasoningModel, true);
    }

    generateKnowledgeBase() { return this.synthesizer.generateKnowledgeBase(); }
    generateQuestionsMarkdown() { return this.synthesizer.generateQuestionsMarkdown(); }
    generateSourceOfTruth() { return this.synthesizer.generateSourceOfTruth(); }

    /**
     * Start polling for pending documents
     */
    startPolling(intervalMs = 5000) {
        if (this.isPolling) return;
        this.isPolling = true;
        log.info({ event: 'processor_polling_start', intervalMs }, 'Started document polling');

        this.pollingInterval = setInterval(() => this._poll(), intervalMs);
        // Run immediately
        this._poll().catch(e => log.error({ event: 'processor_poll_error' }, e.message));
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        log.info({ event: 'processor_polling_stop' }, 'Stopped document polling');
    }

    /**
     * Main polling loop invoked on each interval tick.
     * Checks for pending documents and dispatches background processing jobs
     * while respecting per-provider concurrency limits. Skips entirely if
     * autoProcess is disabled in processing settings.
     */
    async _poll() {
        try {
            // 1. Check if auto-process is enabled
            const processingSettings = await this.storage.getProcessingSettings?.() || this.config.processing || {};
            if (processingSettings.autoProcess === false) {
                return;
            }

            if (!this.storage.getDocuments) return;

            // 1b. Recover stuck documents: reset 'processing' docs older than 15 min
            const STUCK_TIMEOUT_MS = 15 * 60 * 1000;
            try {
                const processingDocs = await this.storage.getDocuments('processing');
                for (const doc of processingDocs || []) {
                    const updatedAt = doc.updated_at || doc.created_at;
                    if (updatedAt && (Date.now() - new Date(updatedAt).getTime()) > STUCK_TIMEOUT_MS) {
                        if (!this.filesInProgress.has(doc.id)) {
                            log.warn({ event: 'processor_stuck_recovery', docId: doc.id, filename: doc.filename }, 'Resetting stuck document to pending');
                            if (this.storage.updateDocumentStatus) {
                                await this.storage.updateDocumentStatus(doc.id, 'pending', null);
                            }
                        }
                    }
                }
            } catch (e) {
                log.debug({ event: 'processor_stuck_check_failed', reason: e.message }, 'Stuck doc check failed');
            }

            const pendingDocs = await this.storage.getDocuments('pending');

            if (pendingDocs.length === 0) return;

            // 3. Check concurrency limits
            const llmConfig = this.config.llm || {};
            const providers = llmConfig.providers || {};

            // Re-calculate current provider usage from filesInProgress
            // Note: This requires filesInProgress to be objects with provider info, 
            // but currently it's a Set. We'll need to upgrade filesInProgress tracking.
            // For now, let's assume we can derive it or iterate.

            for (const doc of pendingDocs) {
                if (this.filesInProgress.has(doc.filename) || this.filesInProgress.has(doc.id)) continue;

                // Determine provider for this doc
                // Use default text provider per config
                const defaultProvider = llmConfig.perTask?.text?.provider || llmConfig.provider || 'openai';
                const providerLimit = providers[defaultProvider]?.concurrency || 2; // Default to 2 if not set

                // Count active jobs for this provider
                const currentJobs = this.providerJobs[defaultProvider] || 0;

                if (currentJobs < providerLimit) {
                    // Start processing
                    this._startJob(doc, defaultProvider);
                } else {
                    // Provider saturated
                    log.debug({ event: 'processor_provider_saturated', provider: defaultProvider, limit: providerLimit }, 'Provider saturated');
                }
            }

        } catch (e) {
            log.error({ event: 'processor_poll_loop_error', error: e.message }, 'Error in polling loop');
        }
    }

    /**
     * Start a background processing job for a single document.
     * Tracks the job in filesInProgress and providerJobs, updates document
     * status to 'processing' -> 'completed'/'failed', and cleans up counters
     * in the finally block to ensure provider slots are always released.
     *
     * @param {Object} doc      - Document record with id, name, and optional path
     * @param {string} provider - LLM provider identifier (e.g. "openai", "ollama")
     */
    async _startJob(doc, provider) {
        const id = doc.id || doc.filename;
        const docName = doc.filename || doc.title || doc.name || id;
        this.filesInProgress.add(id);
        this.providerJobs[provider] = (this.providerJobs[provider] || 0) + 1;

        log.info({ event: 'processor_job_start', file: docName, provider, filepath: doc.filepath, hasContent: !!doc.content, contentLength: doc.content?.length || 0 }, 'Starting background job');

        if (this.storage.updateDocumentStatus) {
            await this.storage.updateDocumentStatus(id, 'processing');
        }

        try {
            const textModel = this.config.llm?.models?.text || 'gpt-4o';

            let filePath = doc.filepath || doc.path || doc.filename || doc.name;
            const isInlineContent = !filePath || filePath === 'krisp-mcp-import' || filePath === 'inline';

            // For inline content docs, fetch content from DB if missing in the passed object
            let inlineContent = doc.content;
            if (isInlineContent && !inlineContent && doc.id && this.storage.getDocumentById) {
                try {
                    const freshDoc = await Promise.resolve(this.storage.getDocumentById(doc.id));
                    if (freshDoc?.content) {
                        inlineContent = freshDoc.content;
                        log.debug({ event: 'processor_inline_content_fetched', docId: doc.id }, 'Fetched inline content from DB');
                    }
                } catch (e) {
                    log.debug({ event: 'processor_inline_content_fetch_failed', docId: doc.id, reason: e.message }, 'Failed to fetch inline content');
                }
            }

            let result;
            const processOpts = { documentId: doc.id };
            if (isInlineContent && inlineContent) {
                result = await this.processFile(null, textModel, null, false, {
                    ...processOpts,
                    inlineContent: inlineContent,
                    filename: docName
                });
            } else if (isInlineContent && !inlineContent) {
                throw new Error(`Inline content document ${id} has no content — cannot process without file path`);
            } else {
                if (filePath && !path.isAbsolute(filePath)) {
                    filePath = path.join(this.config.dataDir, 'content', filePath);
                }
                if (!filePath) {
                    throw new Error('No file path or inline content available for processing');
                }
                result = await this.processFile(filePath, textModel, null, false, processOpts);
            }

            const status = result.success ? 'completed' : 'failed';
            if (this.storage.updateDocumentStatus) {
                await this.storage.updateDocumentStatus(id, status, result.error);
            }

        } catch (e) {
            log.error({ event: 'processor_job_error', file: docName, error: e.message }, 'Job failed');
            if (this.storage.updateDocumentStatus) {
                await this.storage.updateDocumentStatus(id, 'failed', e.message);
            }
        } finally {
            this.filesInProgress.delete(id);
            this.providerJobs[provider] = Math.max(0, (this.providerJobs[provider] || 1) - 1);
        }
    }

    /**
     * Recalculate estimated time remaining based on average per-file duration.
     * Updates processingState.estimatedTimeRemaining (in seconds).
     * @param {number} processedCount - Number of files processed so far
     */
    _updateEstimatedTime(processedCount) {
        if (processedCount < 1) return;
        const elapsed = Date.now() - this.processingState.startTime;
        const avgTime = elapsed / processedCount;
        const remaining = this.processingState.totalFiles - processedCount;
        this.processingState.estimatedTimeRemaining = Math.ceil((remaining * avgTime) / 1000); // seconds
    }
}

module.exports = DocumentProcessor;
