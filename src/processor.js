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
    async processFile(filePath, textModel, visionModel = null, isTranscript = false) {
        const filename = path.basename(filePath);

        try {
            // 1. Extract content (readFileContent returns a raw string)
            const extractResult = await this.extractor.readFileContent(filePath);
            const content = typeof extractResult === 'string' ? extractResult : extractResult?.content;

            if (!content || content.length < 50) {
                return { success: false, error: 'Empty or too short content' };
            }

            // 2. Content deduplication: skip if identical content already processed
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

            // 3. Build prompts
            const extractionPrompt = this.analyzer.buildExtractionPrompt(content, filename, isTranscript);

            // 4. Run LLM
            const llmResult = await this.analyzer.llmGenerateText(textModel, extractionPrompt);
            if (!llmResult.success) {
                return { success: false, error: `LLM failed: ${llmResult.error}` };
            }

            // 5. Parse response
            const extracted = this.analyzer.parseAIResponse(llmResult.response);

            // 6. Store extracted data
            let docId = null;
            if (this.storage.addDocument) {
                docId = await this.storage.addDocument({
                    filename: filename,
                    content_hash: contentHash,
                    metadata: {
                        extracted_at: new Date().toISOString(),
                        model: textModel
                    }
                });
            } else {
                // Fallback or assume storage handles it via addFact with 'source_file'
                docId = extractResult.id || null; // Mock
            }

            const stats = {
                facts: 0, decisions: 0, questions: 0, risks: 0, actions: 0, people: 0
            };

            // Store Facts
            if (extracted.facts && extracted.facts.length > 0 && this.storage.addFacts) {
                const facts = extracted.facts.map(f => ({
                    ...f,
                    source_file: filename,
                    source_document_id: docId
                }));
                const res = await this.storage.addFacts(facts);
                stats.facts = res.inserted || facts.length;
            }

            // Store Decisions
            if (extracted.decisions && extracted.decisions.length > 0 && this.storage.addDecision) {
                for (const d of extracted.decisions) {
                    await this.storage.addDecision({
                        ...d,
                        source_file: filename,
                        source_document_id: docId
                    });
                    stats.decisions++;
                }
            }

            // Store Questions
            if (extracted.questions && extracted.questions.length > 0 && this.storage.addQuestion) {
                for (const q of extracted.questions) {
                    await this.storage.addQuestion({
                        ...q,
                        source_file: filename,
                        source_document_id: docId
                    });
                    stats.questions++;
                }
            }

            // Store Risks
            if (extracted.risks && extracted.risks.length > 0 && this.storage.addRisk) {
                for (const r of extracted.risks) {
                    await this.storage.addRisk({
                        ...r,
                        source_file: filename,
                        source_document_id: docId
                    });
                    stats.risks++;
                }
            }

            // Store Action Items
            if (extracted.action_items && extracted.action_items.length > 0 && this.storage.addActionItem) {
                for (const a of extracted.action_items) {
                    await this.storage.addActionItem({
                        ...a,
                        source_file: filename,
                        source_document_id: docId
                    });
                    stats.actions++;
                }
            }

            // Store People
            if (extracted.people && extracted.people.length > 0 && this.storage.addPerson) {
                for (const p of extracted.people) {
                    await this.storage.addPerson({
                        ...p,
                        source_file: filename,
                        source_document_id: docId
                    });
                    stats.people++;
                }
            }

            // 7. Post-processing (Resolution & Completion)
            let resolvedCount = 0;
            try {
                resolvedCount = await this.analyzer.detectAndResolveQuestionsWithAI(this.storage, this.config) || 0;
            } catch (qErr) {
                log.debug({ event: 'processor_resolve_questions_error', reason: qErr.message }, 'Question resolution skipped');
            }
            const completedActions = this.analyzer.checkAndCompleteActions(this.storage, extracted);

            // 8. Generate Summary
            const summary = await this.analyzer.generateFileSummary(
                filename, extracted, stats.facts, stats.decisions, stats.risks, stats.people
            );

            if (summary && docId && this.storage.updateDocument) {
                await this.storage.updateDocument(docId, {
                    ai_title: summary.title,
                    ai_summary: summary.summary
                });
            }

            return {
                success: true,
                documentId: docId,
                stats: stats,
                resolvedQuestions: resolvedCount,
                completedActions: completedActions
            };

        } catch (e) {
            log.error({ event: 'process_file_error', file: filename, error: e.message }, 'Single file processing error');
            return { success: false, error: e.message };
        }
    }

    /**
     * Reprocess a specific document
     * Clears existing facts/metadata and re-runs extraction
     */
    async reprocessDocument(filename, textModel, visionModel = null) {
        log.info({ event: 'processor_reprocess_start', file: filename }, 'Reprocessing document');

        try {
            // Find document ID by filename to clear data
            // We need a storage method for this, or simple getDocuments
            let docId = null;
            if (this.storage.getDocuments) {
                const docs = await Promise.resolve(this.storage.getDocuments());
                const doc = (docs || []).find(d => d.filename === filename || d.name === filename);
                if (doc) docId = doc.id;
            }

            if (docId) {
                // Clear existing data
                // This assumes storage has methods to delete by source_document_id or source_file
                const tasks = [];
                if (this.storage.deleteFactsByDocument) tasks.push(this.storage.deleteFactsByDocument(docId));
                if (this.storage.deleteRisksByDocument) tasks.push(this.storage.deleteRisksByDocument(docId));
                // Add more deletions as needed
                await Promise.allSettled(tasks);
                log.debug({ event: 'processor_reprocess_cleared', docId }, 'Cleared existing document data');
            }
        } catch (e) {
            log.warn({ event: 'processor_reprocess_clear_failed', reason: e.message }, 'Failed to clear document data, proceeding with reprocessing');
        }

        // 2. Process file again
        // We use absolute path if filename is relative
        let filePath = filename;
        if (!path.isAbsolute(filename)) {
            filePath = path.join(this.config.dataDir, 'content', filename);
        }
        return this.processFile(filePath, textModel, visionModel);
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

            // 2. Get pending documents
            // We need a method to get pending docs from storage
            if (!this.storage.getDocuments) return;

            // Get all documents and filter for pending
            // In a real DB we would use a specialized query
            const allDocs = await this.storage.getDocuments();
            const pendingDocs = allDocs.filter(d => d.status === 'pending');

            if (pendingDocs.length === 0) return;

            // 3. Check concurrency limits
            const llmConfig = this.config.llm || {};
            const providers = llmConfig.providers || {};

            // Re-calculate current provider usage from filesInProgress
            // Note: This requires filesInProgress to be objects with provider info, 
            // but currently it's a Set. We'll need to upgrade filesInProgress tracking.
            // For now, let's assume we can derive it or iterate.

            for (const doc of pendingDocs) {
                if (this.filesInProgress.has(doc.name) || this.filesInProgress.has(doc.id)) continue;

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
        const id = doc.id || doc.name;
        this.filesInProgress.add(id);
        this.providerJobs[provider] = (this.providerJobs[provider] || 0) + 1;

        log.info({ event: 'processor_job_start', file: doc.name, provider }, 'Starting background job');

        // Update status to processing
        if (this.storage.updateDocumentStatus) {
            await this.storage.updateDocumentStatus(id, 'processing');
        }

        try {
            // Determine models
            const textModel = this.config.llm?.models?.text || 'gpt-4o';

            // Process
            // Resolving path - assumes doc.name is relative to content dir or is absolute
            let filePath = doc.path || doc.name;
            if (!path.isAbsolute(filePath)) {
                filePath = path.join(this.config.dataDir, 'content', filePath);
            }

            const result = await this.processFile(filePath, textModel);

            // Update status
            const status = result.success ? 'completed' : 'failed';
            if (this.storage.updateDocumentStatus) {
                await this.storage.updateDocumentStatus(id, status, result.error);
            }

        } catch (e) {
            log.error({ event: 'processor_job_error', file: doc.name, error: e.message }, 'Job failed');
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
