/**
 * Document Processor Module
 * Handles document processing with AI extraction
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const llm = require('./llm');
const { getOntologyAwarePrompts } = require('./prompts');

// Try to load prompts service for Supabase prompts
let promptsService = null;
try {
    promptsService = require('./supabase/prompts');
} catch (e) {
    console.log('[Processor] Supabase prompts service not available, using defaults');
}

// Try to load validators
let validators = null;
try {
    validators = require('./validators');
} catch (e) {
    console.log('[Processor] Validators not available');
}

class DocumentProcessor {
    constructor(storage, ollama, config) {
        this.storage = storage;
        this.ollama = ollama; // Keep for backward compatibility
        this.config = config;
        this.processingState = {
            status: 'idle',
            progress: 0,
            currentFile: null,
            message: '',
            errors: [],
            // Enhanced tracking
            totalFiles: 0,
            processedFiles: 0,
            startTime: null,
            estimatedTimeRemaining: null,
            currentPhase: null, // 'extraction', 'synthesis', etc.
            filesTiming: [] // Track how long each file takes for better estimates
        };
        // Track files currently being processed to prevent race conditions
        this.filesInProgress = new Set();
        
        // Initialize ontology-aware prompts
        this.ontologyPrompts = getOntologyAwarePrompts({
            userRole: config.userRole,
            projectContext: config.projectContext
        });

        // Cache for Supabase prompts
        this.supabasePrompts = {};
        this.promptsLoaded = false;
    }

    /**
     * Load prompts from Supabase (async)
     * Call this before processing to ensure prompts are loaded
     */
    async loadPromptsFromSupabase() {
        if (this.promptsLoaded || !promptsService) return;

        try {
            this.supabasePrompts = await promptsService.getAllPrompts() || {};
            this.promptsLoaded = true;
            console.log(`[Processor] Loaded ${Object.keys(this.supabasePrompts).length} prompts from Supabase`);
        } catch (e) {
            console.log('[Processor] Could not load prompts from Supabase:', e.message);
        }
    }

    /**
     * Load v1.6 context variables for entity resolution
     * These include CONTACTS_INDEX, ORG_INDEX, PROJECT_INDEX, USERNAME_MAP, DOMAIN_MAP
     */
    async loadContextVariables() {
        if (this._contextVariables || !promptsService?.buildContextVariables) return;
        
        try {
            const projectId = this.config.projectId || null;
            this._contextVariables = await promptsService.buildContextVariables(projectId);
            console.log('[Processor] Context variables loaded for entity resolution');
        } catch (e) {
            console.log('[Processor] Could not load context variables:', e.message);
            this._contextVariables = {};
        }
    }

    /**
     * Get a prompt template from Supabase
     * @param {string} key - Prompt key (document, transcript, vision, etc.)
     * @returns {string|null} - Prompt template or null if not found
     */
    getSupabasePrompt(key) {
        return this.supabasePrompts[key]?.prompt_template || null;
    }

    /**
     * Generate a short hash from content for deterministic IDs
     */
    generateContentHash(content) {
        if (!content) return 'unknown';
        
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
    }

    /**
     * Enrich extraction result with runtime metadata
     * Sets extracted_at to current ISO timestamp
     */
    enrichExtractionMetadata(result) {
        if (!result) return result;
        
        const now = new Date().toISOString();
        
        // Set extracted_at in extraction_metadata if present
        if (result.extraction_metadata) {
            result.extraction_metadata.extracted_at = now;
        }
        
        return result;
    }

    /**
     * Validate extraction result (v1.6)
     * @param {object} result - Extraction result
     * @param {boolean} validate - Whether to validate
     * @param {string} sourceType - Source type (transcript, document, etc.)
     * @returns {object} Result with _validation property if validated
     */
    validateExtractionResult(result, validate = false, sourceType = 'document') {
        if (!result || !validate || !validators) {
            return result;
        }

        // Only transcript validation is currently implemented
        if (sourceType === 'transcript' && validators.validateTranscriptOutput) {
            const validation = validators.validateTranscriptOutput(result);
            result._validation = validation;
            
            if (!validation.valid) {
                console.log('[Processor] Extraction validation errors:', validation.errors.slice(0, 3));
            }
            if (validation.warnings.length > 0) {
                console.log('[Processor] Extraction validation warnings:', validation.warnings.slice(0, 2));
            }
        }
        
        return result;
    }

    /**
     * Render a Supabase prompt template with variables
     */
    renderPromptTemplate(template, variables = {}) {
        if (!template) return null;
        
        // Auto-generate CONTENT_HASH if CONTENT is provided but CONTENT_HASH is not
        if (variables.CONTENT && !variables.CONTENT_HASH) {
            variables.CONTENT_HASH = this.generateContentHash(variables.CONTENT);
        }

        let rendered = template;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            rendered = rendered.replace(placeholder, value || '');
        }
        
        // Remove any unmatched placeholders
        rendered = rendered.replace(/\{\{[A-Z_]+\}\}/g, '');
        
        return rendered;
    }

    // ==================== LLM Abstraction Helpers ====================

    /**
     * Get the current LLM provider ID (perTask preferred)
     */
    getLLMProvider() {
        const provider = this.config.llm?.perTask?.text?.provider || 
               this.config.llm?.provider || 
               null;
        if (!provider) {
            console.warn('[Processor] No LLM provider configured in admin settings');
        }
        return provider;
    }

    /**
     * Get provider config for current provider
     */
    getProviderConfig() {
        const provider = this.getLLMProvider();
        return this.config.llm?.providers?.[provider] || {};
    }

    /**
     * Get text model for current provider (perTask preferred)
     */
    getTextModel() {
        return this.config.llm?.perTask?.text?.model ||
               this.config.llm?.models?.text || 
               this.config.ollama?.model || 
               this.config.ollama?.reasoningModel;
    }

    /**
     * Get vision model for current provider (perTask preferred)
     */
    getVisionModel() {
        return this.config.llm?.perTask?.vision?.model ||
               this.config.llm?.models?.vision || 
               this.config.ollama?.visionModel;
    }
    
    /**
     * Get vision provider (may differ from text provider)
     */
    getVisionProvider() {
        const provider = this.config.llm?.perTask?.vision?.provider || 
               this.config.llm?.provider || 
               null;
        if (!provider) {
            console.warn('[Processor] No vision provider configured in admin settings');
        }
        return provider;
    }

    /**
     * Check if current provider supports vision
     */
    supportsVision() {
        const provider = this.getLLMProvider();
        const capabilities = llm.getProviderCapabilities(provider);
        return capabilities.vision;
    }

    /**
     * Generate AI title and summary for a processed file
     * Uses Supabase prompts v1.6 when available
     */
    async generateFileSummary(filename, extracted, factsCount, decisionsCount, risksCount, peopleCount) {
        try {
            const provider = this.getLLMProvider();
            const model = this.getTextModel();
            const providerConfig = this.config.llm?.providers?.[provider] || {};
            
            // Build context from extracted data
            const factsSample = (extracted.facts || []).slice(0, 3).map(f => f.content).join('; ');
            const decisionsSample = (extracted.decisions || []).slice(0, 2).map(d => d.content).join('; ');
            const peopleSample = (extracted.people || []).slice(0, 5).map(p => p.name).join(', ');
            
            // Build content for Supabase prompt
            const content = `Filename: ${filename}
Facts extracted: ${factsSample || 'None'}
Decisions: ${decisionsSample || 'None'}
People mentioned: ${peopleSample || 'None'}
Stats: ${factsCount} facts, ${decisionsCount} decisions, ${risksCount} risks, ${peopleCount} people`;
            
            // Try to use Supabase summary prompt (v1.6)
            let prompt;
            const supabaseTemplate = this.supabasePrompts?.summary?.prompt_template;
            
            if (supabaseTemplate && promptsService) {
                prompt = promptsService.renderPrompt(supabaseTemplate, {
                    CONTENT: content,
                    CONTENT_HASH: promptsService.generateContentHash(content),
                    FILENAME: filename
                });
            } else {
                // Fallback to hardcoded prompt
                prompt = `Based on the following extracted information from a document, generate:
1. A short, descriptive title (max 50 chars) that captures what the document is about
2. A brief summary (max 100 chars) of the document's main topic or purpose

${content}

Respond ONLY in this JSON format:
{"title": "Short Title Here", "summary": "Brief summary here"}`;
            }

            const result = await llm.generateText({
                provider,
                model,
                prompt,
                providerConfig,
                temperature: 0.3,
                maxTokens: 150,
                context: 'document'
            });

            if (result.success && result.text) {
                // Parse JSON response - handle various LLM output formats
                let jsonMatch = result.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    let jsonStr = jsonMatch[0];
                    
                    // Clean common JSON issues from LLM output
                    jsonStr = jsonStr
                        .replace(/,\s*}/g, '}')  // Remove trailing commas
                        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                        .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
                        .replace(/\s+/g, ' ')     // Normalize whitespace
                        .replace(/"\s*:\s*"/g, '":"') // Normalize key-value spacing
                        .trim();
                    
                    try {
                        const parsed = JSON.parse(jsonStr);
                        return {
                            title: (parsed.title || '').substring(0, 60),
                            summary: (parsed.summary || '').substring(0, 120)
                        };
                    } catch (parseErr) {
                        // Try to extract title and summary with regex as fallback
                        const titleMatch = result.text.match(/["']?title["']?\s*[:=]\s*["']([^"']+)["']/i);
                        const summaryMatch = result.text.match(/["']?summary["']?\s*[:=]\s*["']([^"']+)["']/i);
                        if (titleMatch || summaryMatch) {
                            return {
                                title: (titleMatch?.[1] || '').substring(0, 60),
                                summary: (summaryMatch?.[1] || '').substring(0, 120)
                            };
                        }
                        console.warn('Failed to parse summary JSON:', parseErr.message, 'Raw:', jsonStr.substring(0, 100));
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to generate file summary:', e.message);
        }
        return null;
    }

    /**
     * Generate text using the configured LLM provider
     * @param {string} model - Model name
     * @param {string} prompt - The prompt
     * @param {object} options - Options like temperature, maxTokens
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async llmGenerateText(model, prompt, options = {}) {
        const provider = this.getLLMProvider();
        const providerConfig = this.getProviderConfig();

        const result = await llm.generateText({
            provider,
            providerConfig,
            model,
            prompt,
            temperature: options.temperature || 0.7,
            maxTokens: options.maxTokens || 4096,
            context: options.context || 'document'
        });

        // Normalize response to match old ollama format
        return {
            success: result.success,
            response: result.text,
            error: result.error,
            evalCount: result.usage?.outputTokens,
            raw: result.raw
        };
    }

    /**
     * Generate vision output using the configured LLM provider
     * @param {string} model - Model name
     * @param {string} prompt - The prompt
     * @param {Array<string>} images - Image paths or base64 strings
     * @param {object} options - Options like temperature, maxTokens
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async llmGenerateVision(model, prompt, images, options = {}) {
        const provider = this.getLLMProvider();
        const providerConfig = this.getProviderConfig();

        // Check if provider supports vision
        if (!this.supportsVision()) {
            // Fall back to Ollama for vision if current provider doesn't support it
            console.log(`Provider ${provider} doesn't support vision, falling back to Ollama`);
            const ollamaConfig = this.config.llm?.providers?.ollama || {
                host: this.config.ollama?.host || '127.0.0.1',
                port: this.config.ollama?.port || 11434
            };
            
            const visionProvider = this.getVisionProvider();
            const result = await llm.generateVision({
                provider: visionProvider,
                providerConfig: this.getProviderConfig(visionProvider) || ollamaConfig,
                model: this.config.llm?.perTask?.vision?.model || this.config.llm?.models?.vision || model,
                prompt,
                images,
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 4096
            });

            return {
                success: result.success,
                response: result.text,
                error: result.error,
                evalCount: result.usage?.outputTokens,
                raw: result.raw
            };
        }

        const result = await llm.generateVision({
            provider,
            providerConfig,
            model,
            prompt,
            images,
            temperature: options.temperature || 0.7,
            maxTokens: options.maxTokens || 4096
        });

        return {
            success: result.success,
            response: result.text,
            error: result.error,
            evalCount: result.usage?.outputTokens,
            raw: result.raw
        };
    }

    /**
     * Check if a model name is a vision model (for Ollama)
     */
    isVisionModel(modelName) {
        // Use ollama's check for backward compatibility
        return this.ollama.isVisionModel(modelName);
    }

    /**
     * Find the best model for a task (for Ollama)
     */
    async findBestModel(taskType) {
        // Use ollama for model discovery in Ollama mode
        if (this.getLLMProvider() === 'ollama') {
            return this.ollama.findBestModel(taskType);
        }
        // For other providers, return the configured model
        if (taskType === 'vision') {
            return { model: this.getVisionModel(), type: 'vision' };
        }
        return { model: this.getTextModel(), type: 'text' };
    }

    // ==================== End LLM Abstraction Helpers ====================

    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = config;
    }

    /**
     * Update data directory (used when switching projects)
     */
    updateDataDir(dataDir) {
        this.config.dataDir = dataDir;
    }

    /**
     * Get current processing state
     */
    getState() {
        // Calculate elapsed time
        const state = { ...this.processingState };
        if (state.startTime) {
            state.elapsedTime = Date.now() - state.startTime;
            state.elapsedFormatted = this.formatDuration(state.elapsedTime);
        }
        if (state.estimatedTimeRemaining) {
            state.estimatedFormatted = this.formatDuration(state.estimatedTimeRemaining);
        }
        return state;
    }

    /**
     * Update time estimate based on progress
     */
    updateTimeEstimate(processed, total) {
        if (processed === 0 || !this.processingState.startTime) {
            this.processingState.estimatedTimeRemaining = null;
            return;
        }

        const elapsed = Date.now() - this.processingState.startTime;
        const avgTimePerFile = elapsed / processed;
        const remaining = total - processed;
        this.processingState.estimatedTimeRemaining = Math.round(avgTimePerFile * remaining);
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        if (!ms || ms < 1000) return 'less than a second';
        
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes < 60) {
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * Scan input folders for pending files
     */
    scanPendingFiles() {
        const result = { newinfo: [], newtranscripts: [] };
        const newinfoDir = path.join(this.config.dataDir, 'newinfo');
        const transcriptsDir = path.join(this.config.dataDir, 'newtranscripts');

        try {
            if (fs.existsSync(newinfoDir)) {
                result.newinfo = fs.readdirSync(newinfoDir)
                    .filter(f => !f.startsWith('.') && !f.endsWith('.meta.json'))
                    .map(f => this.getFileInfo(path.join(newinfoDir, f)))
                    .filter(f => f !== null); // Filter out null results (metadata files)
            }
        } catch (e) { /* ignore */ }

        try {
            if (fs.existsSync(transcriptsDir)) {
                result.newtranscripts = fs.readdirSync(transcriptsDir)
                    .filter(f => !f.startsWith('.') && !f.endsWith('.meta.json'))
                    .map(f => this.getFileInfo(path.join(transcriptsDir, f)))
                    .filter(f => f !== null); // Filter out null results (metadata files)
            }
        } catch (e) { /* ignore */ }

        return result;
    }

    /**
     * Get file information including document date from metadata
     */
    getFileInfo(filePath) {
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);
        
        // Skip metadata files
        if (filename.endsWith('.meta.json')) {
            return null;
        }
        
        const info = {
            name: filename,
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
            type: path.extname(filePath).toLowerCase(),
            documentDate: null,
            documentTime: null
        };
        
        // Check for metadata file with document date
        const metaPath = filePath + '.meta.json';
        if (fs.existsSync(metaPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                info.documentDate = metadata.documentDate || null;
                info.documentTime = metadata.documentTime || null;
                console.log(`[Processor] Found metadata for ${filename}: date=${info.documentDate}`);
            } catch (e) {
                // Ignore metadata read errors
            }
        }
        
        return info;
    }

    /**
     * Check if MarkItDown CLI is available
     */
    checkMarkItDown() {
        if (this._markitdownAvailable !== undefined) {
            return this._markitdownAvailable;
        }
        try {
            execSync('markitdown --version', { encoding: 'utf8', stdio: 'pipe' });
            this._markitdownAvailable = true;
            console.log('MarkItDown: Available for document extraction');
        } catch (e) {
            this._markitdownAvailable = false;
            console.log('MarkItDown: Not installed. Install with: pip install markitdown');
            console.log('Falling back to pdf-parse for PDFs');
        }
        return this._markitdownAvailable;
    }

    /**
     * Extract content using MarkItDown CLI (Microsoft's document converter)
     * Supports: PDF, DOCX, XLSX, PPTX, HTML, images, and more
     * Install: pip install markitdown
     */
    extractWithMarkItDown(filePath) {
        // Check if markitdown is available
        if (!this.checkMarkItDown()) {
            return { success: false, error: 'MarkItDown not installed' };
        }

        try {
            const filename = path.basename(filePath);
            console.log(`MarkItDown: Extracting ${filename}...`);

            // Run markitdown CLI
            const result = execSync(`markitdown "${filePath}"`, {
                encoding: 'utf8',
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                timeout: 120000 // 2 minute timeout
            });

            console.log(`MarkItDown: Extracted ${result.length} characters from ${filename}`);
            return { success: true, content: result, method: 'markitdown' };
        } catch (e) {
            console.log(`MarkItDown failed for ${path.basename(filePath)}: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Read file content based on type
     * Priority: MarkItDown > pdf-parse > raw text
     */
    async readFileContent(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const filename = path.basename(filePath);

        // Text-based files - read directly
        if (['.txt', '.md', '.json', '.csv', '.log'].includes(ext)) {
            return fs.readFileSync(filePath, 'utf8');
        }

        // For PDFs, DOCX, XLSX, PPTX, HTML - try MarkItDown first
        if (['.pdf', '.docx', '.xlsx', '.pptx', '.html', '.htm'].includes(ext)) {
            const markitResult = this.extractWithMarkItDown(filePath);
            if (markitResult.success && markitResult.content.length > 100) {
                return markitResult.content;
            }

            // Fallback to pdf-parse for PDFs
            if (ext === '.pdf') {
                try {
                    const pdfParse = require('pdf-parse');
                    const dataBuffer = fs.readFileSync(filePath);
                    const data = await pdfParse(dataBuffer);
                    console.log(`pdf-parse fallback: ${data.numpages} pages, ${data.text.length} chars from ${filename}`);
                    return data.text;
                } catch (e) {
                    console.log(`pdf-parse also failed: ${e.message}`);
                }
            }

            return `[Could not extract content from ${filename}]`;
        }

        // For images - always use vision model, skip MarkItDown
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) {
            // Return indicator for vision model processing (skip MarkItDown - use LLM directly)
            return `[IMAGE:${filePath}]`;
        }

        // Default: try to read as text
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            return `[Binary file: ${filename} - Could not read as text]`;
        }
    }

    /**
     * Split content into chunks for processing large documents
     */
    splitIntoChunks(content, chunkSize = 10000, overlap = 500) {
        const chunks = [];
        let start = 0;

        while (start < content.length) {
            let end = start + chunkSize;

            // Try to break at a paragraph or sentence boundary
            if (end < content.length) {
                const breakPoints = ['\n\n', '.\n', '. ', '\n'];
                for (const bp of breakPoints) {
                    const lastBreak = content.lastIndexOf(bp, end);
                    if (lastBreak > start + chunkSize * 0.7) {
                        end = lastBreak + bp.length;
                        break;
                    }
                }
            }

            chunks.push({
                content: content.substring(start, Math.min(end, content.length)),
                start: start,
                end: Math.min(end, content.length),
                index: chunks.length + 1
            });

            start = end - overlap; // Overlap for context continuity
            if (start >= content.length) break;
        }

        return chunks;
    }

    /**
     * Merge extracted data from multiple chunks
     */
    mergeExtractedData(results) {
        const merged = {
            facts: [],
            decisions: [],
            questions: [],
            risks: [],
            action_items: [],
            people: [],
            relationships: [],
            summary: '',
            key_topics: [],
            extraction_coverage: {
                items_found: 0,
                estimated_total: 0,
                confidence: 0,
                chunks_processed: results.length
            }
        };

        const seenFacts = new Set();
        const seenQuestions = new Set();
        const seenPeople = new Set();
        const seenRelationships = new Set();

        let totalItemsFound = 0;
        let totalEstimated = 0;
        let totalConfidence = 0;
        let coverageCount = 0;

        for (const result of results) {
            // Deduplicate facts
            for (const fact of result.facts || []) {
                const key = fact.content?.toLowerCase().trim();
                if (key && !seenFacts.has(key)) {
                    seenFacts.add(key);
                    merged.facts.push(fact);
                }
            }

            // Deduplicate questions
            for (const q of result.questions || []) {
                const key = q.content?.toLowerCase().trim();
                if (key && !seenQuestions.has(key)) {
                    seenQuestions.add(key);
                    merged.questions.push(q);
                }
            }

            // Collect decisions (allow duplicates - might be different dates)
            merged.decisions.push(...(result.decisions || []));

            // Collect risks
            merged.risks.push(...(result.risks || []));

            // Collect action items
            merged.action_items.push(...(result.action_items || []));

            // Deduplicate people
            for (const p of result.people || []) {
                const key = p.name?.toLowerCase().trim();
                if (key && !seenPeople.has(key)) {
                    seenPeople.add(key);
                    merged.people.push(p);
                }
            }

            // Deduplicate relationships
            for (const rel of result.relationships || []) {
                const key = `${rel.from?.toLowerCase()}-${rel.to?.toLowerCase()}-${rel.type}`;
                if (rel.from && rel.to && !seenRelationships.has(key)) {
                    seenRelationships.add(key);
                    merged.relationships.push(rel);
                }
            }

            // Collect summaries
            if (result.summary) {
                merged.summary += (merged.summary ? ' ' : '') + result.summary;
            }

            // Collect topics
            merged.key_topics.push(...(result.key_topics || []));

            // Aggregate extraction coverage from chunks
            if (result.extraction_coverage) {
                totalItemsFound += result.extraction_coverage.items_found || 0;
                totalEstimated += result.extraction_coverage.estimated_total || 0;
                totalConfidence += result.extraction_coverage.confidence || 0;
                coverageCount++;
            }
        }

        // Deduplicate topics
        merged.key_topics = [...new Set(merged.key_topics)];

        // Calculate total items actually extracted
        const actualItemsFound = merged.facts.length + merged.decisions.length +
            merged.questions.length + merged.risks.length +
            merged.action_items.length + merged.people.length;

        // Update coverage with actual counts
        merged.extraction_coverage = {
            items_found: actualItemsFound,
            estimated_total: totalEstimated > 0 ? totalEstimated : actualItemsFound,
            confidence: coverageCount > 0 ? (totalConfidence / coverageCount) : 0.9,
            chunks_processed: results.length,
            coverage_percent: totalEstimated > 0
                ? Math.round((actualItemsFound / totalEstimated) * 100)
                : 100
        };

        return merged;
    }

    /**
     * Process content in chunks for large documents
     */
    async processInChunks(content, filename, model, isTranscript = false) {
        const chunks = this.splitIntoChunks(content);

        if (chunks.length === 1) {
            // Small document - process normally
            const prompt = this.buildExtractionPrompt(content, filename, isTranscript);
            const result = await this.llmGenerateText(model, prompt, {
                temperature: 0.3,
                maxTokens: 4096
            });
            return result;
        }

        // Large document - process in chunks
        console.log(`Processing ${filename} in ${chunks.length} chunks...`);
        const chunkResults = [];

        for (const chunk of chunks) {
            this.processingState.message = `Processing ${filename} (chunk ${chunk.index}/${chunks.length})...`;
            this.processingState.chunkProgress = Math.round((chunk.index / chunks.length) * 100);

            const prompt = this.buildExtractionPrompt(
                chunk.content,
                `${filename} (Part ${chunk.index}/${chunks.length})`,
                isTranscript
            );

            const result = await this.llmGenerateText(model, prompt, {
                temperature: 0.3,
                maxTokens: 4096
            });

            if (result.success) {
                // Debug: Log raw response
                console.log(`Chunk ${chunk.index} response (first 500 chars):`, result.response?.substring(0, 500));
                const parsed = this.parseAIResponse(result.response);
                console.log(`Chunk ${chunk.index} parsed: facts=${parsed.facts?.length || 0}, decisions=${parsed.decisions?.length || 0}`);
                chunkResults.push(parsed);
            } else {
                console.log(`Chunk ${chunk.index} failed:`, result.error);
            }
        }

        // Merge results from all chunks
        const merged = this.mergeExtractedData(chunkResults);

        return {
            success: true,
            response: JSON.stringify(merged)
        };
    }

    /**
     * Build extraction prompt for AI (based on Information Processing Protocol)
     * Ontology context is ALWAYS injected for consistent entity/relation extraction
     * 
     * PRIORITY ORDER:
     * 1. Supabase prompts (if loaded)
     * 2. Config custom prompts
     * 3. Hardcoded fallback
     */
    buildExtractionPrompt(content, filename, isTranscript = false) {
        const docType = isTranscript ? 'meeting transcript' : 'document';
        const prompts = this.config.prompts || {};
        const roleContext = this.userRole ? `- User Role: ${this.userRole} (prioritize information relevant to this role)\n` : '';
        const projectCtx = this.config.projectContext ? `- Project Context: ${this.config.projectContext}\n` : '';
        const today = new Date().toISOString().split('T')[0];

        // Get ontology context - ALWAYS inject for consistency
        let ontologyContext = '';
        try {
            if (this.ontologyPrompts) {
                const ontology = this.ontologyPrompts.getOntologyContext();
                ontologyContext = `
## ONTOLOGY CONTEXT (use these types for consistency)
### Entity Types:
${ontology.entityTypes}

### Relationship Types:
${ontology.relationTypes}

IMPORTANT: Extract entities using the types above. Map relationships to the relation types listed.
`;
            }
        } catch (e) {
            console.log('[Processor] Could not load ontology context:', e.message);
        }

        // TRY SUPABASE PROMPTS FIRST
        const promptKey = isTranscript ? 'transcript' : 'document';
        const supabaseTemplate = this.getSupabasePrompt(promptKey);
        
        if (supabaseTemplate) {
            console.log(`[Processor] Using Supabase prompt for: ${promptKey}`);
            
            // Get v1.6 context variables if available
            const ctx = this._contextVariables || {};
            
            return this.renderPromptTemplate(supabaseTemplate, {
                TODAY: today,
                FILENAME: filename,
                CONTENT_LENGTH: String(content.length),
                CONTENT: content,
                ROLE_CONTEXT: roleContext,
                PROJECT_CONTEXT: projectCtx,
                ONTOLOGY_SECTION: ontologyContext,
                // v1.6 context variables for entity resolution
                CONTACTS_INDEX: ctx.CONTACTS_INDEX || '',
                ORG_INDEX: ctx.ORG_INDEX || '',
                PROJECT_INDEX: ctx.PROJECT_INDEX || '',
                USERNAME_MAP: ctx.USERNAME_MAP || '',
                DOMAIN_MAP: ctx.DOMAIN_MAP || ''
            });
        }

        // Use config custom prompt if provided - but ALWAYS include ontology
        const customPrompt = isTranscript ? prompts.transcript : prompts.document;
        
        if (customPrompt && customPrompt.trim()) {
            return `/no_think
${customPrompt}
${ontologyContext}
## Document: ${filename}
## Content Length: ${content.length} characters

## Content:
${content}

CRITICAL EXTRACTION RULES:
1. Extract EVERY fact, decision, risk, and action item - completeness is mandatory
2. Do NOT summarize or combine items - each distinct piece of information gets its own entry
3. Missing information is WORSE than duplicates - when in doubt, include it
4. Read the ENTIRE content above - do not skip any section
5. Use the ONTOLOGY entity types and relation types above for consistency

IMPORTANT: Output ONLY the JSON. No explanations.
Return ONLY valid JSON with the structure: {entities: [], relationships: [], facts: [], decisions: [], questions: [], risks: [], action_items: [], people: [], summary: "", key_topics: [], extraction_coverage: {items_found: N, confidence: 0.0-1.0}}`;
        }

        // Default prompts - /no_think disables thinking mode on qwen3 models
        // Ontology is ALWAYS injected for consistency
        // (today already declared above)

        if (isTranscript) {
            return `/no_think
You are an expert information extraction assistant. Analyze this meeting transcript with COMPLETE extraction - every piece of information matters.

## Context
- Current date: ${today}
- Meeting: ${filename}
- Content Length: ${content.length} characters
${roleContext}
${ontologyContext}
## Transcript:
${content}

## CRITICAL EXTRACTION MANDATE:
You MUST extract EVERY distinct piece of information. Missing items is unacceptable.
- Extract ALL facts mentioned, even if they seem minor
- Extract ALL decisions, even tentative ones (mark confidence accordingly)
- Extract ALL risks, concerns, and blockers - every single one
- Extract ALL action items and tasks mentioned
- Extract ALL questions raised, even rhetorical ones
- Identify ALL people mentioned by name

## REASONING FRAMEWORK (follow these steps internally before outputting JSON):

**Step 1 - COMPLETE SCAN:**
- Read the ENTIRE transcript from start to finish
- What type of meeting is this? (planning, status, technical, decision-making)
- Who are ALL the participants mentioned?
- What topics are discussed? List EVERY topic.
- Handle transcription noise (typos, fragmented sentences)

**Step 2 - EXHAUSTIVE EXTRACTION:**
Go through the transcript again and extract EVERY item:

- DECISIONS: ACTUAL choices made (someone CHOSE or AGREED)
  ✓ "We decided to use AWS" = decision
  ✗ "Let's discuss this later" = NOT a decision
- FACTS: Confirmed statements (NOT opinions/suggestions) - extract ALL of them
- RISKS: Problems, concerns, blockers - include ALL, even subtle hints
- ACTION ITEMS: Tasks with owners - every single one mentioned
- QUESTIONS: Open items needing follow-up - all of them
- PEOPLE: Extract ALL people AND roles:
  * Named person: {"name": "John Smith", "role": "Tech Lead", "organization": "Acme"}
  * Role only (no name): {"name": "[Role] - TBD", "role": "Azure Developer", "organization": null}
  * IMPORTANT: Extract roles even without specific names
- RELATIONSHIPS: Org structure (reports_to, manages, leads, member_of, works_with)

**Step 3 - COMPLETENESS VERIFICATION:**
Before outputting, ask yourself:
- Did I read the ENTIRE transcript?
- Did I extract EVERY fact, not just the main ones?
- Did I capture EVERY risk, even minor concerns?
- Does EVERY risk have a mitigation strategy? (REQUIRED - suggest one based on context if not mentioned)
- Are there ANY items I skipped? If so, go back and add them.
- Estimate: How many items exist vs how many I extracted?

**Step 4 - FINAL OUTPUT:**
Output ALL extractions. Include a coverage estimate.
If uncertain about an item, include it with lower confidence (0.7-0.8).
If no real decisions were made, use empty array: []

## OUTPUT (JSON only - no explanation):
{
    "facts": [{"content": "fact", "category": "process|policy|technical|people|timeline|general", "confidence": 0.9}],
    "decisions": [{"content": "what was decided", "owner": "who decided", "date": null}],
    "questions": [{"content": "question", "context": "Why needed: [reason]. Blocked: [impact]", "priority": "critical|high|medium", "assigned_to": "person"}],
    "risks": [{"content": "risk", "impact": "high|medium|low", "likelihood": "high|medium|low", "mitigation": "REQUIRED: how to prevent/reduce this risk"}],
    "action_items": [{"task": "task", "owner": "person", "deadline": null, "status": "pending"}],
    "people": [{"name": "full name", "role": "role", "organization": "company"}],
    "relationships": [{"from": "person", "to": "person/team", "type": "reports_to|manages|leads|member_of|works_with"}],
    "summary": "2-3 sentence summary",
    "key_topics": ["topic1", "topic2"],
    "extraction_coverage": {"items_found": 0, "estimated_total": 0, "confidence": 0.95}
}`;
        }

        return `/no_think
You are an expert information extraction assistant. Extract ALL structured information from this ${docType} - completeness is critical.

## Context
- Current date: ${today}
- Document: ${filename}
- Content Length: ${content.length} characters
${roleContext}
${ontologyContext}
## Content:
${content}

## CRITICAL EXTRACTION MANDATE:
You MUST extract EVERY distinct piece of information from this document.
- Extract ALL facts, even seemingly minor ones
- Extract ALL decisions made or referenced
- Extract ALL risks, concerns, and potential issues
- Extract ALL action items and tasks
- Extract ALL questions and open items
- Identify ALL people mentioned
Missing information is WORSE than including duplicates.

## REASONING FRAMEWORK (follow these steps internally before outputting JSON):

**Step 1 - COMPLETE DOCUMENT SCAN:**
- Read the ENTIRE document from start to finish
- What type of document is this? (technical spec, meeting notes, policy, report, email)
- What is the document's purpose and audience?
- List ALL topics and entities discussed

**Step 2 - EXHAUSTIVE EXTRACTION:**
Go through the document SECTION BY SECTION and extract EVERY item:

**FACTS** - ALL verified statements (NOT instructions/how-to)
Categories: process, policy, technical, people, timeline, general
✓ "The system uses PostgreSQL" = fact
✗ "Click the button to save" = instruction (NOT a fact)
Extract EVERY fact, not just the main ones.

**DECISIONS** - ALL actual choices made by someone
✓ "Management approved the budget" = decision
✗ "We should consider option A" = NOT a decision
If no real decisions, use empty array: []

**RISKS** - ALL problems, concerns, potential issues
- What could go wrong? Include EVERY risk mentioned.
- Impact (high/medium/low) and likelihood
- Mitigations (REQUIRED for each risk)

**QUESTIONS** - ALL open items, unknowns, gaps
- content: The question
- context: WHY needed? WHAT is blocked?
- priority: critical (blocks work), high (needed soon), medium (nice to know)

**ACTION ITEMS** - ALL tasks to be done with owners

**PEOPLE** - Extract ALL people AND roles mentioned:
- If a specific person is named: {"name": "John Smith", "role": "Tech Lead", "organization": "Acme"}
- If only a role is mentioned (no name): {"name": "[Role] - TBD", "role": "Azure Developer", "organization": null}
- Examples: "Senior Azure Tech Lead" → {"name": "Senior Azure Tech Lead - TBD", "role": "Senior Azure Tech Lead", "organization": null}
- IMPORTANT: Extract roles even without specific names - they are needed for question assignment

**RELATIONSHIPS** - ALL org structure connections (reports_to, manages, leads, member_of, works_with)

**Step 3 - COMPLETENESS VERIFICATION:**
Before outputting, verify:
- Did I read the ENTIRE document?
- Did I extract from EVERY section?
- Are there ANY facts I missed? Go back and add them.
- Did I capture ALL risks, even subtle ones?
- Does EVERY risk have a mitigation strategy? (REQUIRED - suggest one based on context if not mentioned)
- How many items exist vs how many I extracted? (include in coverage)

**Step 4 - FINAL OUTPUT:**
Output ALL validated extractions with coverage estimate.
Use lower confidence (0.7-0.8) for inferred information.
Include items even if uncertain - missing info is worse than duplicates.

## OUTPUT (JSON only - no explanation):
{
    "facts": [{"content": "...", "category": "process|policy|technical|people|timeline|general", "confidence": 0.9}],
    "decisions": [],
    "questions": [{"content": "...", "context": "Why needed: [...]. Blocked: [...]", "priority": "critical|high|medium", "assigned_to": "..."}],
    "risks": [{"content": "...", "impact": "high|medium|low", "likelihood": "high|medium|low", "mitigation": "REQUIRED: how to prevent/reduce this risk"}],
    "action_items": [{"task": "...", "owner": "...", "deadline": null, "status": "pending"}],
    "people": [{"name": "...", "role": "...", "organization": "..."}],
    "relationships": [{"from": "Person A", "to": "Person B", "type": "reports_to|manages|leads|member_of|works_with"}],
    "summary": "...",
    "key_topics": [],
    "extraction_coverage": {"items_found": 0, "estimated_total": 0, "confidence": 0.95}
}`;
    }

    /**
     * Build vision prompt for multimodal models (images/screenshots)
     * 
     * PRIORITY ORDER:
     * 1. Supabase prompts (if loaded)
     * 2. Config custom prompts  
     * 3. Hardcoded fallback
     */
    buildVisionPrompt(filename, modelName = '') {
        const prompts = this.config.prompts || {};
        const roleContext = this.userRole ? `User Role: ${this.userRole} (prioritize information relevant to this role)\n` : '';

        // Only add /no_think prefix for qwen models (disables thinking mode)
        const isQwenModel = modelName.toLowerCase().includes('qwen');
        const thinkPrefix = isQwenModel ? '/no_think\n' : '';

        // Get ontology context for vision prompts
        let ontologyContext = '';
        try {
            if (this.ontologyPrompts) {
                const ontology = this.ontologyPrompts.getOntologyContext();
                ontologyContext = `## ONTOLOGY CONTEXT
Entity types: ${ontology.entityNames.join(', ')}
Relation types: ${ontology.relationNames.join(', ')}`;
            }
        } catch (e) {
            // Ignore
        }

        // TRY SUPABASE PROMPT FIRST
        const supabaseTemplate = this.getSupabasePrompt('vision');
        
        if (supabaseTemplate) {
            console.log('[Processor] Using Supabase prompt for: vision');
            const rendered = this.renderPromptTemplate(supabaseTemplate, {
                FILENAME: filename,
                ONTOLOGY_SECTION: ontologyContext
            });
            return thinkPrefix + rendered;
        }

        // Use config custom vision prompt if provided
        if (prompts.vision && prompts.vision.trim()) {
            return `${thinkPrefix}${prompts.vision}
${roleContext}
## Document: ${filename}

CRITICAL: Extract information FROM THE IMAGE ONLY. Do not add meta-questions about dates or the document itself.
Output ONLY valid JSON. No explanation.`;
        }

        // Vision prompt optimized for slide/diagram analysis
        // Focus on DETAILED DESCRIPTIONS for knowledge extraction
        return `${thinkPrefix}Analyze this slide/image in detail: ${filename}
${roleContext}
YOUR TASK: Create a detailed knowledge base entry from this image.
This will be used as a SOURCE OF TRUTH, so be thorough and extract EVERY piece of data.

CRITICAL RULE: Extract ALL data visible in the image. Do not summarize or skip items.

ANALYSIS APPROACH:
1. IDENTIFY the type: table, diagram, chart, matrix, text, or mixed
2. EXTRACT every piece of data systematically (row by row, cell by cell for tables)
3. PRESERVE exact values, numbers, names, and labels
4. EXPLAIN relationships and context

FOR TABLES AND MATRICES (EXTRACT EVERYTHING):
- Read EVERY row and EVERY column
- For each cell, extract: [Column Header] - [Row Label]: [Value]
- Include ALL numeric values exactly as shown
- Preserve the structure: if it has 50 items, extract 50 facts
- Example: "Contract Creation - Convert opportunity to contract: 1.1 story points"

FOR COMPLEXITY/STORY POINT TABLES:
- Extract each process name with its story point value
- Group by category/column if categories exist
- Format: "[Category] - [Process Name]: [Story Points] SP"
- Include complexity levels, color coding meaning, or legends if shown

FOR DIAGRAMS/CHARTS:
- Describe the structure (what connects to what)
- Explain relationships between elements
- Note cardinality (1:1, 1:N, etc.) if shown
- Identify source systems and target systems
- Capture data flow direction

FOR DATA MODELS:
- List ALL entities/objects and their purpose
- Describe ALL relationships between entities
- Note ALL key attributes if visible
- Explain the business context

FOR LISTS AND BULLET POINTS:
- Extract EVERY bullet point as a separate fact
- Preserve hierarchy (main point vs sub-points)
- Do not combine or summarize multiple items

WHAT TO EXTRACT AS FACTS (one fact per data item):
- Each row/cell from tables → one fact per value
- Each entity or component → one fact
- Each relationship → one fact
- Each metric or number → one fact with its context
- Each process step → one fact
- Each configuration or setting → one fact

SUMMARY REQUIREMENTS:
- Write 2-4 sentences describing what this slide teaches us
- Include total counts: "This table shows X processes across Y categories"
- Mention the overall purpose and business context

OUTPUT FORMAT (JSON only):
{
    "facts": [{"content": "specific data item with full context", "category": "technical|business|process|data", "confidence": 0.9}],
    "decisions": [{"content": "architectural or business decision shown", "owner": null, "date": null}],
    "risks": [{"content": "risk or constraint mentioned", "impact": "medium", "likelihood": "medium", "mitigation": "suggested approach"}],
    "questions": [{"content": "open question explicitly shown", "context": "why it matters", "priority": "medium"}],
    "people": [{"name": "Person Name", "role": "their role"}],
    "summary": "DETAILED description: What type of content is this? How many items does it contain? What is its purpose?",
    "key_topics": ["specific_topic1", "specific_topic2"],
    "extraction_coverage": {"items_found": 0, "confidence": 0.9}
}

IMPORTANT: If the image contains a table with 30+ rows, you MUST extract all 30+ rows as separate facts.
Output ONLY valid JSON.`;
    }

    /**
     * Build a stricter vision prompt for retry when first attempt fails
     * More explicit JSON formatting requirements
     */
    buildStrictVisionPrompt(filename, modelName = '') {
        // Only add /no_think prefix for qwen models
        const isQwenModel = modelName.toLowerCase().includes('qwen');
        const thinkPrefix = isQwenModel ? '/no_think\n' : '';

        return `${thinkPrefix}Extract ALL data from this slide: ${filename}

CRITICAL: This is a DATA EXTRACTION task. Extract EVERY item visible.

FOR TABLES/MATRICES:
- Extract EACH row as a separate fact
- Format: "[Column] - [Row Label]: [Value]"
- Do NOT summarize - extract every single cell
- If 30 rows exist, output 30 facts

FOR COMPLEXITY/STORY POINT TABLES:
- Format: "[Category] - [Process Name]: [Number] SP"
- Include the legend/color coding explanation

FOR DIAGRAMS:
- Extract each component and relationship as separate facts

OUTPUT REQUIREMENTS:
- Response MUST be valid JSON starting with { and ending with }
- Extract MAXIMUM data, not summaries
- One fact per data item

JSON format:
{
  "facts": [{"content": "[Category] - [Item Name]: [Value]", "category": "data", "confidence": 0.9}],
  "decisions": [],
  "risks": [],
  "questions": [],
  "people": [],
  "summary": "This [table/diagram] contains X items across Y categories showing [purpose]",
  "key_topics": [],
  "extraction_coverage": {"items_found": 0, "confidence": 0.9}
}

Output ONLY valid JSON:`;
    }

    /**
     * Build a simple OCR prompt for vision models
     * Focus on EXACT transcription - no interpretation
     * /no_think disables reasoning mode for qwen models
     */
    /**
     * Clean OCR output by removing model reasoning artifacts
     * Vision models sometimes include "thinking" phrases even when asked not to
     */
    cleanOCROutput(text) {
        if (!text) return '';

        // Reasoning indicators to filter out
        const reasoningIndicators = [
            'got it', 'let me', 'let\'s', 'okay', 'alright', 'sure',
            'first,', 'now,', 'looking at', 'wait,', 'wait no',
            'the user', 'the slide has', 'the image shows', 'the image has',
            'based on', 'according to', 'i need to', 'i\'ll',
            'let\'s check', 'let\'s list', 'let\'s go', 'let\'s see',
            'checking', 'parsing', 'analyzing', 'extracting'
        ];

        // Split into lines
        let lines = text.split('\n');
        const cleanedLines = [];

        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();

            // Skip empty lines
            if (!trimmed) {
                cleanedLines.push(line);
                continue;
            }

            // Check if line is reasoning
            let isReasoning = false;
            for (const indicator of reasoningIndicators) {
                if (trimmed.startsWith(indicator) || trimmed.includes('wait,')) {
                    isReasoning = true;
                    break;
                }
            }

            // Skip lines that are meta-commentary
            if (trimmed.match(/^(then |next |also |wait |no,|so |but )/)) {
                isReasoning = true;
            }

            // Skip lines describing the slide structure rather than content
            if (trimmed.match(/^(the slide|this slide|looking at the|i see|there is|there are)/)) {
                isReasoning = true;
            }

            // Skip lines with parenthetical self-corrections
            if (trimmed.match(/\(wait|wait\)|wait no|\(no,/)) {
                isReasoning = true;
            }

            if (!isReasoning) {
                cleanedLines.push(line);
            }
        }

        // Remove leading empty lines
        while (cleanedLines.length > 0 && !cleanedLines[0].trim()) {
            cleanedLines.shift();
        }

        return cleanedLines.join('\n').trim();
    }

    buildVisionProsePrompt(filename) {
        return `/no_think
TASK: OCR the slide image. Extract ALL visible text exactly as shown.

FILE: ${filename}

STRICT RULES:
1. Output ONLY the text you see on the slide
2. For tables use: | Col1 | Col2 | format
3. Keep original language
4. DO NOT explain what you are doing
5. DO NOT describe the slide
6. DO NOT include phrases like "Got it" or "Let me"
7. Start directly with the slide content

BEGIN OCR OUTPUT:`;
    }

    /**
     * Build prompt to convert prose description to structured JSON facts (Pass 2 of two-pass extraction)
     * Text models are better at following JSON output instructions
     */
    buildProseToFactsPrompt(proseDescription, filename) {
        return `/no_think
Convert this slide description into structured facts. Extract EVERY piece of information.

SOURCE: ${filename}
"""
${proseDescription}
"""

EXTRACTION RULES:
1. Each distinct piece of information becomes ONE fact
2. For labeled sections: "[Label]: [content]"
3. For table rows: "[Row Label]: [value or description]"
4. For process steps: "[Process Name]: [step description]"
5. For metrics: "[Metric Name] = [value]"
6. Keep facts concise but complete
7. Preserve original labels/names exactly as transcribed

GOOD FACTS (from slide content):
- "Contract Creation: No manual entry across systems"
- "Account Management: Approval process for bank changes"
- "L3 Process: Contract creation has story points 1.1"
- "Strategic Pillar: Net Zero Carbon"
- "Enabler: Automate where possible"
- "Slide Title: OneCRM Blueprint - Deliverables"

DO NOT CREATE FACTS FROM:
- Meta descriptions ("The slide shows...", "This is a table...")
- Generic steps ("Step 1: Analyze", "Step 2: Process")
- Repeated content (each fact appears ONCE)
- Speculation or assumptions

Output ONLY valid JSON:
{"facts":[{"content":"Label: specific content","category":"general","confidence":0.9}],"decisions":[],"risks":[],"questions":[],"people":[],"summary":"brief"}`;
    }

    /**
     * Sanitize malformed JSON from AI responses
     * Fixes common AI mistakes: leading zeros, trailing commas, unescaped characters, etc.
     */
    sanitizeJSON(jsonStr) {
        let sanitized = jsonStr;

        // Remove any BOM or invisible characters at start
        sanitized = sanitized.replace(/^\uFEFF/, '');

        // Remove control characters (except newlines/tabs inside strings - handled later)
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // Fix leading zeros in decimal numbers (00.95 → 0.95)
        sanitized = sanitized.replace(/:\s*0+(\d*\.\d+)/g, ': 0$1');

        // Fix leading zeros in integers (007 → 7, but 0 stays 0)
        sanitized = sanitized.replace(/:\s*0+([1-9]\d*)/g, ': $1');

        // Fix trailing commas before } or ]
        sanitized = sanitized.replace(/,\s*([\}\]])/g, '$1');

        // Fix unquoted keys (common AI mistake)
        sanitized = sanitized.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

        // Fix NaN and Infinity values
        sanitized = sanitized.replace(/:\s*NaN/gi, ': null');
        sanitized = sanitized.replace(/:\s*Infinity/gi, ': null');

        // Fix missing commas between objects in arrays
        sanitized = sanitized.replace(/\}\s*\{/g, '},{');

        // Fix newlines inside string values (common LLM issue)
        // This is tricky - we need to escape unescaped newlines inside strings
        sanitized = this.fixStringsInJSON(sanitized);

        // Fix truncated JSON by closing open brackets
        const openBraces = (sanitized.match(/\{/g) || []).length;
        const closeBraces = (sanitized.match(/\}/g) || []).length;
        const openBrackets = (sanitized.match(/\[/g) || []).length;
        const closeBrackets = (sanitized.match(/\]/g) || []).length;

        // Close any unclosed structures
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
            sanitized += ']';
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
            sanitized += '}';
        }

        return sanitized;
    }

    /**
     * Fix string values in JSON that may have unescaped characters
     * Handles newlines, tabs, and quotes inside strings
     */
    fixStringsInJSON(jsonStr) {
        let result = '';
        let inString = false;
        let escaped = false;

        for (let i = 0; i < jsonStr.length; i++) {
            const char = jsonStr[i];

            if (escaped) {
                // Previous char was a backslash, this is an escaped character
                result += char;
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                result += char;
                continue;
            }

            if (char === '"' && !escaped) {
                inString = !inString;
                result += char;
                continue;
            }

            if (inString) {
                // Inside a string - escape problematic characters
                if (char === '\n') {
                    result += '\\n';
                } else if (char === '\r') {
                    result += '\\r';
                } else if (char === '\t') {
                    result += '\\t';
                } else {
                    result += char;
                }
            } else {
                result += char;
            }
        }

        // If we ended inside a string, close it
        if (inString) {
            result += '"';
        }

        return result;
    }

    /**
     * Parse AI response to structured data
     * Uses multiple strategies to extract valid JSON from LLM responses
     * @param {string} response - Raw LLM response
     * @param {object} options - Options { validate: boolean, sourceType: string }
     */
    parseAIResponse(response, options = {}) {
        const { validate = false, sourceType = 'document' } = options;
        // Strategy 1: Clean and parse full JSON
        try {
            let cleaned = response;

            // Remove <think>...</think> blocks (including partial/unclosed)
            cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
            cleaned = cleaned.replace(/<think>[\s\S]*/gi, '');

            // Remove common thinking prefixes
            cleaned = cleaned.replace(/^(Got it|Let me|Let's|We are|The user|So,|I'll|Here)[\s\S]*?(?=\{)/i, '');

            // Extract JSON block
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                let jsonStr = jsonMatch[0];
                try {
                    const parsed = JSON.parse(jsonStr);
                    const enriched = this.enrichExtractionMetadata(parsed);
                    return this.validateExtractionResult(enriched, validate, sourceType);
                } catch (e) {
                    console.log('Initial JSON parse failed, attempting sanitization...');
                    try {
                        jsonStr = this.sanitizeJSON(jsonStr);
                        const parsed = JSON.parse(jsonStr);
                        const enriched = this.enrichExtractionMetadata(parsed);
                        return this.validateExtractionResult(enriched, validate, sourceType);
                    } catch (e2) {
                        console.log('Sanitization failed:', e2.message.substring(0, 100));
                    }
                }
            }
        } catch (e) {
            console.error('Strategy 1 failed:', e.message);
        }

        // Strategy 2: Extract individual arrays using regex
        console.log('Attempting array extraction strategy...');
        const result = {
            facts: [],
            questions: [],
            decisions: [],
            risks: [],
            action_items: [],
            people: [],
            summary: '',
            key_topics: []
        };

        try {
            // Extract facts array
            const factsMatch = response.match(/"facts"\s*:\s*\[([\s\S]*?)\](?=\s*,|\s*\})/);
            if (factsMatch) {
                result.facts = this.parseArrayContent(factsMatch[1], 'content');
                console.log(`Extracted ${result.facts.length} facts via regex`);
            }

            // Extract questions array
            const questionsMatch = response.match(/"questions"\s*:\s*\[([\s\S]*?)\](?=\s*,|\s*\})/);
            if (questionsMatch) {
                result.questions = this.parseArrayContent(questionsMatch[1], 'content');
                console.log(`Extracted ${result.questions.length} questions via regex`);
            }

            // Extract decisions array
            const decisionsMatch = response.match(/"decisions"\s*:\s*\[([\s\S]*?)\](?=\s*,|\s*\})/);
            if (decisionsMatch) {
                result.decisions = this.parseArrayContent(decisionsMatch[1], 'content');
                console.log(`Extracted ${result.decisions.length} decisions via regex`);
            }

            // Extract risks array
            const risksMatch = response.match(/"risks"\s*:\s*\[([\s\S]*?)\](?=\s*,|\s*\})/);
            if (risksMatch) {
                result.risks = this.parseArrayContent(risksMatch[1], 'content');
            }

            // Extract people array
            const peopleMatch = response.match(/"people"\s*:\s*\[([\s\S]*?)\](?=\s*,|\s*\})/);
            if (peopleMatch) {
                result.people = this.parseArrayContent(peopleMatch[1], 'name');
            }

            // Extract summary
            const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/);
            if (summaryMatch) {
                result.summary = summaryMatch[1];
            }

            // If we got anything, return it
            if (result.facts.length > 0 || result.questions.length > 0 || result.decisions.length > 0) {
                console.log(`Array extraction succeeded: ${result.facts.length} facts, ${result.questions.length} questions, ${result.decisions.length} decisions`);
                return result;
            }
        } catch (e) {
            console.error('Strategy 2 failed:', e.message);
        }

        // Strategy 3: Try to parse each object individually
        console.log('Attempting individual object parsing...');
        try {
            const objectMatches = response.match(/\{[^{}]*\}/g);
            if (objectMatches) {
                for (const objStr of objectMatches) {
                    try {
                        const obj = JSON.parse(objStr);
                        if (obj.content && obj.category) {
                            result.facts.push(obj);
                        } else if (obj.content && (obj.priority || obj.context)) {
                            result.questions.push(obj);
                        } else if (obj.name && (obj.role || obj.organization)) {
                            result.people.push(obj);
                        }
                    } catch (e) { /* skip malformed objects */ }
                }

                if (result.facts.length > 0 || result.questions.length > 0) {
                    console.log(`Individual object parsing succeeded: ${result.facts.length} facts, ${result.questions.length} questions`);
                    return result;
                }
            }
        } catch (e) {
            console.error('Strategy 3 failed:', e.message);
        }

        // Strategy 4: Extract facts from natural language (when vision model returns thinking text)
        console.log('Attempting natural language extraction (thinking text fallback)...');
        try {
            const nlpFacts = this.extractFactsFromNaturalLanguage(response);
            if (nlpFacts.length > 0) {
                console.log(`Natural language extraction succeeded: ${nlpFacts.length} facts`);
                result.facts = nlpFacts;
                result.summary = 'Extracted from thinking text (non-JSON response)';
                return result;
            }
        } catch (e) {
            console.error('Strategy 4 (NLP) failed:', e.message);
        }

        console.error('All parsing strategies failed');
        return {
            facts: [],
            questions: [],
            decisions: [],
            summary: 'Failed to parse extraction - all strategies exhausted',
            key_entities: []
        };
    }

    /**
     * Extract facts from natural language thinking text
     * Used when vision model returns descriptive text instead of JSON
     */
    extractFactsFromNaturalLanguage(text) {
        const facts = [];

        // Patterns that indicate factual information in thinking text
        const factPatterns = [
            // "The slide title is X" or "title: X"
            /(?:title|heading|header)\s*(?:is|says|reads|:)\s*["']?([^"'\n.]+)/gi,
            // "The main text says: X"
            /(?:main\s+)?text\s*(?:says|reads|is|:)\s*["']?([^"'\n]+)/gi,
            // Bullet points or numbered items
            /(?:^|\n)\s*[-•*]\s*([A-Z][^.\n]{10,}[.\n])/gm,
            /(?:^|\n)\s*\d+[.)]\s*([A-Z][^.\n]{10,}[.\n])/gm,
            // Table content: "row/column X: Y"
            /(?:row|column)\s*(?:\d+)?[:\s]+([^,.\n]{10,})/gi,
            // Content between quotes that's substantial
            /"([A-Z][^"]{15,})"/g,
            // Sentences starting with technical terms (from descriptions)
            /(?:^|\n)([A-Z][A-Za-z\s]{2,}(?:is|are|has|have|can|will|should|must)[^.\n]{15,}\.)/gm,
        ];

        const seenFacts = new Set();

        for (const pattern of factPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                let content = match[1]?.trim();
                if (!content || content.length < 10) continue;

                // Clean up the content
                content = content.replace(/^["'\s]+|["'\s]+$/g, '');
                content = content.replace(/\s+/g, ' ');

                // Skip if too short, too long, or already seen
                if (content.length < 10 || content.length > 500) continue;

                const normalized = content.toLowerCase();
                if (seenFacts.has(normalized)) continue;

                // Skip meta-content about the extraction process
                if (normalized.includes('let me') ||
                    normalized.includes('i need to') ||
                    normalized.includes('let\'s') ||
                    normalized.includes('got it') ||
                    normalized.includes('extraction')) continue;

                seenFacts.add(normalized);
                facts.push({
                    content: content,
                    category: 'extracted',
                    confidence: 0.7 // Lower confidence for NLP-extracted facts
                });
            }
        }

        // Also extract any substantial sentences that describe facts
        const sentences = text.match(/[^.!?\n]{30,}[.!?]/g) || [];
        for (const sentence of sentences) {
            const cleaned = sentence.trim();
            const normalized = cleaned.toLowerCase();

            // Skip meta-sentences
            if (normalized.includes('let me') ||
                normalized.includes('i need to') ||
                normalized.includes('let\'s') ||
                normalized.includes('got it') ||
                normalized.includes('tackle this') ||
                normalized.includes('extraction')) continue;

            // Look for informative content
            if (normalized.includes('the slide') ||
                normalized.includes('the diagram') ||
                normalized.includes('shows that') ||
                normalized.includes('indicates') ||
                normalized.includes('requirement') ||
                normalized.includes('entity') ||
                normalized.includes('relationship')) {

                if (!seenFacts.has(normalized)) {
                    seenFacts.add(normalized);
                    facts.push({
                        content: cleaned,
                        category: 'extracted',
                        confidence: 0.6
                    });
                }
            }
        }

        return facts;
    }

    /**
     * Parse array content from a regex match
     * Handles both object arrays and mixed content
     */
    parseArrayContent(arrayContent, primaryField = 'content') {
        const items = [];

        // Try to find individual objects within the array
        // Match objects with content/name field
        const objectPattern = new RegExp(`\\{[^{}]*"${primaryField}"\\s*:\\s*"([^"]*)"[^{}]*\\}`, 'g');
        let match;

        while ((match = objectPattern.exec(arrayContent)) !== null) {
            try {
                // Try to parse the full object
                const objStr = match[0];
                const sanitized = this.fixStringsInJSON(objStr);
                try {
                    const obj = JSON.parse(sanitized);
                    items.push(obj);
                } catch (e) {
                    // If parsing fails, at least extract the primary field
                    items.push({ [primaryField]: match[1] });
                }
            } catch (e) { /* skip */ }
        }

        // If no objects found, try to extract quoted strings
        if (items.length === 0) {
            const stringPattern = /"([^"]{10,})"/g;
            while ((match = stringPattern.exec(arrayContent)) !== null) {
                // Skip field names and short strings
                if (!match[1].includes(':') && match[1].length > 10) {
                    items.push({ [primaryField]: match[1] });
                }
            }
        }

        return items;
    }

    /**
     * Convert PDF to images (one per page)
     * Uses pdf-to-img (pure JavaScript, no external dependencies)
     */
    async convertPdfToImages(pdfPath) {
        const tempDir = path.join(this.config.dataDir, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            // Dynamic import for ESM module
            const { pdf } = await import('pdf-to-img');

            const pdfBuffer = fs.readFileSync(pdfPath);
            const baseName = path.basename(pdfPath, '.pdf');
            const files = [];
            let pageNum = 1;

            // pdf-to-img returns an async generator
            for await (const page of await pdf(pdfBuffer, { scale: 2.0 })) {
                const imagePath = path.join(tempDir, `${baseName}-page${pageNum}.png`);
                fs.writeFileSync(imagePath, page);
                files.push(imagePath);
                pageNum++;
            }

            console.log(`PDF converted: ${files.length} pages from ${path.basename(pdfPath)}`);
            return files;
        } catch (e) {
            console.log('PDF to image conversion failed, falling back to text extraction:', e.message);
            return null;
        }
    }

    /**
     * Clean up temporary files
     */
    cleanupTempFiles(files) {
        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (e) { /* ignore */ }
        }
    }

    /**
     * Check if PDF is scanned (has very little extractable text)
     * @returns {Promise<{isScanned: boolean, textLength: number, pageCount: number}>}
     */
    async isPdfScanned(filePath) {
        try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            const avgCharsPerPage = data.text.length / Math.max(data.numpages, 1);
            // If less than 100 chars per page on average, it's likely scanned
            const isScanned = avgCharsPerPage < 100;
            return { isScanned, textLength: data.text.length, pageCount: data.numpages, text: data.text };
        } catch (e) {
            return { isScanned: true, textLength: 0, pageCount: 0, text: '' };
        }
    }

    /**
     * Process a single file
     */
    async processFile(filePath, textModel, visionModel = null, isTranscript = false) {
        // Load prompts from Supabase before processing
        await this.loadPromptsFromSupabase();
        
        // Load v1.6 context variables for entity resolution
        await this.loadContextVariables();

        const filename = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        this.processingState.currentFile = filename;
        this.processingState.message = `Processing ${filename}...`;

        // Prevent race conditions: check if file is already being processed
        if (this.filesInProgress.has(filePath)) {
            console.log(`File already being processed (skipping duplicate): ${filename}`);
            return {
                success: true,
                facts: 0,
                questions: 0,
                decisions: 0,
                skipped: true,
                reason: 'already_in_progress'
            };
        }

        // Check if file still exists (may have been archived by another process)
        if (!fs.existsSync(filePath)) {
            console.log(`File no longer exists (already processed): ${filename}`);
            return {
                success: true,
                facts: 0,
                questions: 0,
                decisions: 0,
                skipped: true,
                reason: 'file_not_found'
            };
        }

        // Lock the file
        this.filesInProgress.add(filePath);

        try {
            // Check if document was already processed (by MD5 hash, or filename + size)
            const fileSize = fs.statSync(filePath).size;
            const existingDoc = this.storage.checkDocumentExists(filename, fileSize, filePath);

            if (existingDoc.exists) {
                const method = existingDoc.method === 'hash' ? 'content hash' : 'name+size';
                console.log(`Document already processed (${method}): ${filename} - Skipping`);
                // Move file to archived if it exists
                const archiveDir = isTranscript
                    ? path.join(this.config.dataDir, 'archived', 'meetings')
                    : path.join(this.config.dataDir, 'archived', 'documents');
                const archivePath = path.join(archiveDir, `${new Date().toISOString().split('T')[0]}_${filename}`);

                if (fs.existsSync(filePath)) {
                    fs.renameSync(filePath, archivePath);
                }

                return {
                    success: true,
                    facts: 0,
                    questions: 0,
                    decisions: 0,
                    risks: 0,
                    actions: 0,
                    people: 0,
                    skipped: true,
                    reason: 'duplicate_document'
                };
            }

            // Check if this is an image file
            const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
            const isPdf = ext === '.pdf';
            const pdfToImages = this.config.pdfToImages !== false;

            // Smart model selection
            let selectedModel = textModel;
            let modelType = 'text';
            let pdfInfo = null;

            // For PDFs, always check if scanned (regardless of model selection)
            if (isPdf) {
                pdfInfo = await this.isPdfScanned(filePath);
                console.log(`PDF analysis: ${filename} | Pages: ${pdfInfo.pageCount} | Text: ${pdfInfo.textLength} chars | Scanned: ${pdfInfo.isScanned}`);
            }

            // Determine which model to use based on content type
            const needsVision = isImage || (isPdf && pdfInfo?.isScanned);
            console.log(`Model selection for ${filename}: needsVision=${needsVision}, visionModel="${visionModel}", textModel="${textModel}"`);

            if (needsVision) {
                // Use configured vision model, or fall back to auto-detection
                if (visionModel) {
                    selectedModel = visionModel;
                    modelType = 'vision';
                    console.log(`Using configured vision model: ${visionModel} for ${filename}`);
                } else {
                    // Try to find a vision model automatically
                    const best = await this.findBestModel('vision');
                    if (best && best.type === 'vision') {
                        selectedModel = best.model;
                        modelType = 'vision';
                        console.log(`Auto-selected vision model: ${selectedModel} for ${filename}`);
                    } else {
                        console.log(`WARNING: ${filename} needs vision but no vision model available. Using text model.`);
                    }
                }
            } else {
                // Use configured text model, or fall back to auto-detection
                if (textModel && textModel !== 'auto') {
                    selectedModel = textModel;
                    modelType = this.isVisionModel(textModel) ? 'vision' : 'text';
                    console.log(`Using configured text model: ${textModel} for ${filename}`);
                } else {
                    const best = await this.findBestModel('text');
                    if (best) {
                        selectedModel = best.model;
                        modelType = best.type;
                        console.log(`Auto-selected text model: ${selectedModel} for ${filename}`);
                    }
                }
            }

            if (!selectedModel) {
                throw new Error('No LLM models available. Please configure a model in Settings.');
            }

            const isVisionModel = this.isVisionModel(selectedModel);

            // Check for document date from metadata
            const metaPath = filePath + '.meta.json';
            let documentDate = null;
            let documentTime = null;
            if (fs.existsSync(metaPath)) {
                try {
                    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    documentDate = metadata.documentDate || null;
                    documentTime = metadata.documentTime || null;
                } catch (e) { /* ignore */ }
            }
            
            // Add document record (await is needed as addDocument is async in Supabase mode)
            const docRecord = await this.storage.addDocument({
                filename: filename,
                original_path: filePath,
                file_type: ext,
                file_size: fs.statSync(filePath).size,
                file_date: fs.statSync(filePath).mtime.toISOString(),
                document_date: documentDate,  // User-provided date for timeline
                document_time: documentTime,
                status: 'processing'
            });
            const docId = docRecord?.id || null;
            console.log(`[Processor] Document registered with ID: ${docId}`);

            let result;
            let tempFiles = [];

            // Detailed processing log
            const processingLog = {
                filename,
                startTime: new Date().toISOString(),
                method: 'text',
                chunks: 0,
                pages: 0
            };

            if (isPdf && isVisionModel && pdfToImages) {
                // Convert PDF to images and process with vision model
                processingLog.method = 'vision-pdf';
                this.processingState.message = `Converting ${filename} to images...`;
                const pdfImages = await this.convertPdfToImages(filePath);

                if (pdfImages && pdfImages.length > 0) {
                    tempFiles = pdfImages;
                    processingLog.pages = pdfImages.length;

                    // Process pages one at a time to preserve page order
                    // (previously batched 3 pages which mixed facts from different pages)
                    const batchSize = 1;
                    const pageResults = [];

                    for (let i = 0; i < pdfImages.length; i += batchSize) {
                        const batch = pdfImages.slice(i, Math.min(i + batchSize, pdfImages.length));
                        const pageStart = i + 1;
                        const pageEnd = Math.min(i + batchSize, pdfImages.length);

                        this.processingState.message = `Processing ${filename} (pages ${pageStart}-${pageEnd} of ${pdfImages.length})...`;
                        this.processingState.pageProgress = Math.round(((i + batch.length) / pdfImages.length) * 100);

                        const prompt = this.buildVisionPrompt(`${filename} (pages ${pageStart}-${pageEnd})`, selectedModel);
                        let batchResult = await this.llmGenerateVision(selectedModel, prompt, batch, {
                            temperature: 0.3,
                            maxTokens: 8192
                        });

                        if (batchResult.success) {
                            // Debug: Log raw response
                            console.log(`Vision response (pages ${pageStart}-${pageEnd}):`, batchResult.response?.substring(0, 500));
                            let parsed = this.parseAIResponse(batchResult.response);

                            // If parsing failed (0 facts and no JSON detected), retry with strict prompt
                            if (parsed.facts.length === 0 && !batchResult.response.includes('"facts"')) {
                                console.log(`Page ${pageStart} returned non-JSON, retrying with strict prompt...`);
                                const strictPrompt = this.buildStrictVisionPrompt(`${filename} (page ${pageStart})`, selectedModel);
                                const retryResult = await this.llmGenerateVision(selectedModel, strictPrompt, batch, {
                                    temperature: 0.1,
                                    maxTokens: 8192
                                });
                                if (retryResult.success && retryResult.response.includes('"facts"')) {
                                    batchResult = retryResult;
                                    parsed = this.parseAIResponse(retryResult.response);
                                    console.log(`Retry succeeded: facts=${parsed.facts?.length || 0}`);
                                }
                            }

                            console.log(`Parsed result: facts=${parsed.facts?.length || 0}, decisions=${parsed.decisions?.length || 0}`);
                            pageResults.push(parsed);
                        } else {
                            console.log(`Vision batch failed: ${batchResult.error}`);
                        }
                    }

                    // Merge results from all page batches
                    const merged = this.mergeExtractedData(pageResults);
                    result = {
                        success: true,
                        response: JSON.stringify(merged)
                    };
                } else {
                    // Fallback to text extraction with chunking
                    processingLog.method = 'text-chunked';
                    const content = await this.readFileContent(filePath);
                    result = await this.processInChunks(content, filename, selectedModel, isTranscript);
                    processingLog.chunks = this.splitIntoChunks(content).length;
                }
            } else if (isImage) {
                // TWO-PASS VISION EXTRACTION:
                // Pass 1: Vision model describes the image in prose (what it's good at)
                // Pass 2: Text model converts prose to structured JSON facts (better at following instructions)
                processingLog.method = 'vision-two-pass';

                // Ensure we have a vision model for images
                let imageModel = selectedModel;
                if (!this.isVisionModel(selectedModel)) {
                    if (visionModel) {
                        imageModel = visionModel;
                        console.log(`Using vision model ${visionModel} for image ${filename}`);
                    } else {
                        throw new Error(`Image ${filename} requires a vision model but none is configured`);
                    }
                }

                // PASS 1: Get detailed prose description from vision model
                const prosePrompt = this.buildVisionProsePrompt(filename);
                console.log(`Pass 1: Vision model extracting prose from ${filename}...`);
                const visionResult = await this.llmGenerateVision(imageModel, prosePrompt, [filePath], {
                    temperature: 0.3,
                    maxTokens: 8192  // Allow longer responses for detailed extraction
                });

                if (!visionResult.success) {
                    throw new Error(`Vision extraction failed: ${visionResult.error}`);
                }

                const proseDescription = visionResult.response;
                console.log(`Pass 1 complete: ${proseDescription.length} chars extracted`);

                // PASS 2: Convert prose to structured JSON using text model
                const textModel = this.config.ollama?.model || this.textModel || 'qwen3:30b';
                const structurePrompt = this.buildProseToFactsPrompt(proseDescription, filename);
                console.log(`Pass 2: Text model (${textModel}) converting prose to JSON...`);

                result = await this.llmGenerateText(textModel, structurePrompt, {
                    temperature: 0.1,  // Low temperature for consistent JSON output
                    maxTokens: 4096
                });

                if (result.success) {
                    console.log(`Pass 2 complete: JSON extraction done`);
                }
            } else if (!isImage) {
                // Text processing for non-image files only (documents, transcripts, etc.)
                const content = await this.readFileContent(filePath);
                const chunks = this.splitIntoChunks(content);
                processingLog.chunks = chunks.length;

                if (chunks.length > 1) {
                    processingLog.method = 'text-chunked';
                    result = await this.processInChunks(content, filename, selectedModel, isTranscript);
                } else {
                    processingLog.method = 'text';
                    const prompt = this.buildExtractionPrompt(content, filename, isTranscript);
                    result = await this.llmGenerateText(selectedModel, prompt, {
                        temperature: 0.3,
                        maxTokens: 4096
                    });
                }
            }

            processingLog.endTime = new Date().toISOString();
            processingLog.processingTimeMs = new Date(processingLog.endTime) - new Date(processingLog.startTime);

            // Cleanup temp files
            if (tempFiles.length > 0) {
                this.cleanupTempFiles(tempFiles);
            }

            if (!result.success) {
                throw new Error(result.error || 'AI generation failed');
            }

            // Debug: Log raw AI response (first 500 chars)
            console.log(`AI Response (${filename}): ${result.response?.substring(0, 500) || 'EMPTY'}...`);

            // Parse response
            const extracted = this.parseAIResponse(result.response);
            console.log(`Parsed: facts=${extracted.facts?.length || 0}, decisions=${extracted.decisions?.length || 0}, summary=${extracted.summary ? 'yes' : 'no'}`);

            // Store extracted data
            let factsAdded = 0;
            let questionsAdded = 0;
            let decisionsAdded = 0;
            let risksAdded = 0;
            let actionsAdded = 0;
            let peopleAdded = 0;

            // Facts (may be strings or objects) - with garbage filtering
            for (const fact of extracted.facts || []) {
                const content = typeof fact === 'string' ? fact : (fact.content || fact.fact || fact.text || fact.description);
                if (!content) continue;

                // Filter out garbage/low-value facts from vision models
                if (this.isGarbageFact(content)) {
                    console.log(`Filtered garbage fact: "${content.substring(0, 50)}..."`);
                    continue;
                }

                this.storage.addFact({
                    document_id: docId,
                    content: content,
                    category: typeof fact === 'object' ? (fact.category || fact.type) : 'general',
                    confidence: typeof fact === 'object' ? (fact.confidence || 1.0) : 1.0
                });
                factsAdded++;
            }

            // Questions (may be strings or objects) - with auto-assignment
            const knownPeople = this.storage.getPeople();
            const knownPeopleNames = new Set(knownPeople.map(p => p.name?.toLowerCase().trim()));
            const assigneesToAdd = new Set(); // Track new assignees to add to People

            for (const question of extracted.questions || []) {
                const content = typeof question === 'string' ? question : (question.content || question.question || question.text);
                if (!content || content.trim().length < 10) continue;

                // Filter out garbage questions from vision models
                if (this.isGarbageQuestion(content, typeof question === 'object' ? question.context : null)) {
                    console.log(`Filtered garbage question: "${content.substring(0, 50)}..."`);
                    continue;
                }

                // Try to auto-assign based on topic/role matching
                let assignee = typeof question === 'object' ? (question.assigned_to || question.owner) : null;
                if (!assignee && knownPeople.length > 0) {
                    assignee = this.suggestQuestionAssignee({ content }, knownPeople);
                }

                // Track assignees that don't exist in People list
                if (assignee && !knownPeopleNames.has(assignee.toLowerCase().trim())) {
                    assigneesToAdd.add(assignee.trim());
                }

                this.storage.addQuestion({
                    document_id: docId,
                    content: content.trim(),
                    context: typeof question === 'object' ? question.context : null,
                    priority: typeof question === 'object' ? (question.priority || 'medium') : 'medium',
                    assigned_to: assignee
                });
                questionsAdded++;
            }

            // Auto-add question assignees to People list if they don't exist
            for (const assigneeName of assigneesToAdd) {
                this.storage.addPerson({
                    document_id: docId,
                    name: assigneeName,
                    role: null,
                    organization: null,
                    source: 'question_assignee' // Mark source for tracking
                });
                peopleAdded++;
                console.log(`Auto-added person from question assignee: ${assigneeName}`);
            }

            // Decisions (validate content exists)
            for (const decision of extracted.decisions || []) {
                // Normalize content field (model may use different names)
                let content = typeof decision === 'string' ? decision :
                    (decision.content || decision.decision || decision.text || decision.description);

                // Skip if no valid content
                if (!content || typeof content !== 'string' || content.trim().length < 5) continue;
                content = content.trim();

                // Skip if content looks like stringified null object
                if (content.includes('"content":null') || content === '{}') continue;

                this.storage.addDecision({
                    document_id: docId,
                    content: content,
                    decision_date: decision.date || decision.decision_date,
                    owner: decision.owner || decision.made_by,
                    category: decision.category || decision.type
                });
                decisionsAdded++;
            }

            // Risks (may be strings or objects)
            for (const risk of extracted.risks || []) {
                const content = typeof risk === 'string' ? risk : (risk.content || risk.risk || risk.text || risk.description);
                if (!content) continue;

                this.storage.addRisk({
                    document_id: docId,
                    content: content,
                    impact: typeof risk === 'object' ? risk.impact : null,
                    likelihood: typeof risk === 'object' ? risk.likelihood : null,
                    mitigation: typeof risk === 'object' ? risk.mitigation : null
                });
                risksAdded++;
            }

            // Action Items (may be strings or objects)
            for (const action of extracted.action_items || extracted.actions || []) {
                const task = typeof action === 'string' ? action : (action.task || action.action || action.content || action.text);
                if (!task) continue;

                this.storage.addActionItem({
                    document_id: docId,
                    task: task,
                    owner: typeof action === 'object' ? action.owner : null,
                    deadline: typeof action === 'object' ? action.deadline : null
                });
                actionsAdded++;
            }

            // People (validate name exists)
            for (const person of extracted.people || []) {
                const name = typeof person === 'string' ? person : (person.name || person.person);
                if (!name || typeof name !== 'string' || name.trim().length < 2) continue;

                // Extract context snippet from the person object or nearby content
                const contextSnippet = typeof person === 'object' ? (person.context || person.snippet || person.mention || '') : '';
                const roleContext = typeof person === 'object' ? (person.role_context || person.roleContext || '') : '';

                this.storage.addPerson({
                    document_id: docId,
                    name: name.trim(),
                    role: typeof person === 'object' ? person.role : null,
                    organization: typeof person === 'object' ? person.organization : null,
                    source_file: filename,
                    first_seen_in: filename,
                    role_context: roleContext,
                    context_snippet: contextSnippet || `Mentioned in ${filename}`
                });
                peopleAdded++;
            }

            // POST-PROCESSING: Extract roles from facts with category "people"
            // This catches roles mentioned without specific names (e.g., "Azure Tech Lead")
            const peopleFacts = (extracted.facts || []).filter(f => {
                const category = typeof f === 'object' ? (f.category || f.type) : null;
                return category === 'people';
            });

            for (const fact of peopleFacts) {
                const content = typeof fact === 'string' ? fact : (fact.content || '');
                const roles = this.extractRolesFromText(content);

                for (const role of roles) {
                    // Check if this role already exists in people
                    const existingPeople = this.storage.getPeople();
                    const roleExists = existingPeople.some(p =>
                        p.role && p.role.toLowerCase() === role.toLowerCase()
                    );

                    if (!roleExists) {
                        this.storage.addPerson({
                            document_id: docId,
                            name: `${role} - TBD`,
                            role: role,
                            organization: null,
                            source: 'extracted_from_fact'
                        });
                        peopleAdded++;
                        console.log(`Extracted role from fact: ${role}`);
                    }
                }
            }

            // Relationships (org chart connections)
            let relationshipsAdded = 0;
            for (const rel of extracted.relationships || []) {
                if (!rel.from || !rel.to) continue;

                this.storage.addRelationship({
                    from: rel.from,
                    to: rel.to,
                    type: rel.type || 'works_with',
                    context: rel.context || null,
                    source_file: filename
                });
                relationshipsAdded++;
            }

            if (relationshipsAdded > 0) {
                console.log(`Extracted ${relationshipsAdded} relationships for org chart`);
            }

            // Archive the file
            const archiveDir = path.join(this.config.dataDir, 'archived', 'documents');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }

            const datePrefix = new Date().toISOString().split('T')[0];
            const archivedPath = path.join(archiveDir, `${datePrefix}_${filename}`);
            fs.renameSync(filePath, archivedPath);

            // Update document status
            this.storage.updateDocumentStatus(docId, 'processed', archivedPath);

            // Persist extraction_result to database for later retrieval
            try {
                if (this.storage.updateDocument) {
                    await this.storage.updateDocument(docId, {
                        extraction_result: extracted
                    });
                    console.log(`[Processor] Persisted extraction_result for document ${docId}`);
                }
            } catch (persistErr) {
                console.warn(`[Processor] Failed to persist extraction_result: ${persistErr.message}`);
            }

            // Extract coverage data
            const coverage = extracted.extraction_coverage || {
                items_found: factsAdded + decisionsAdded + questionsAdded + risksAdded + actionsAdded + peopleAdded,
                estimated_total: null,
                confidence: 0.9
            };

            // Generate AI title and summary for the file
            let aiTitle = null;
            let aiSummary = null;
            try {
                const summaryResult = await this.generateFileSummary(filename, extracted, factsAdded, decisionsAdded, risksAdded, peopleAdded);
                if (summaryResult) {
                    aiTitle = summaryResult.title;
                    aiSummary = summaryResult.summary;
                }
            } catch (e) {
                console.warn('Failed to generate AI summary:', e.message);
            }

            // Log detailed file processing
            this.storage.logFileProcessing({
                document_id: docId,
                filename: filename,
                method: processingLog.method,
                chunks_processed: processingLog.chunks,
                pages_processed: processingLog.pages,
                facts_extracted: factsAdded,
                questions_extracted: questionsAdded,
                decisions_extracted: decisionsAdded,
                risks_extracted: risksAdded,
                actions_extracted: actionsAdded,
                people_extracted: peopleAdded,
                processing_time_ms: processingLog.processingTimeMs,
                status: 'success',
                started_at: processingLog.startTime,
                completed_at: new Date().toISOString(),
                extraction_coverage: coverage,
                ai_title: aiTitle,
                ai_summary: aiSummary
            });

            // Log with coverage info
            const coverageInfo = coverage.coverage_percent
                ? ` | Coverage: ${coverage.coverage_percent}%`
                : ` | Items: ${coverage.items_found}`;
            console.log(`File processed: ${filename} | Method: ${processingLog.method} | Facts: ${factsAdded} | Questions: ${questionsAdded}${coverageInfo} | Time: ${processingLog.processingTimeMs}ms`);

            // TEAM ANALYSIS HOOK: Queue profile updates for participants in transcripts
            if (isTranscript && peopleAdded > 0) {
                try {
                    const { getTeamAnalyzer } = require('./team-analysis');
                    const teamAnalyzer = getTeamAnalyzer({ supabase: this.storage.supabase, config: this.config });
                    const projectId = this.storage.currentProjectId || this.storage.getCurrentProject()?.id;
                    
                    if (projectId) {
                        const participantNames = (extracted.people || [])
                            .map(p => typeof p === 'string' ? p : (p.name || p.person))
                            .filter(n => n && typeof n === 'string' && n.trim().length >= 2);
                        
                        if (participantNames.length > 0) {
                            console.log(`[TeamAnalysis] Queuing profile updates for ${participantNames.length} participants from ${filename}`);
                            // Queue for async processing (don't block main processing)
                            setImmediate(async () => {
                                try {
                                    await teamAnalyzer.updateProfilesFromTranscript(projectId, docId, participantNames);
                                } catch (teamErr) {
                                    console.warn(`[TeamAnalysis] Auto-update failed: ${teamErr.message}`);
                                }
                            });
                        }
                    }
                } catch (teamAnalysisErr) {
                    // Team analysis module not available or error - don't block main processing
                    console.warn(`[TeamAnalysis] Module not available: ${teamAnalysisErr.message}`);
                }
            }

            // Flag low-coverage extractions for review
            if (coverage.coverage_percent && coverage.coverage_percent < 80) {
                console.warn(`⚠️ LOW COVERAGE WARNING: ${filename} - Only ${coverage.coverage_percent}% coverage detected. Consider re-processing.`);
            }

            // Check if new facts answer any pending questions
            const questionsResolved = await this.checkAndResolveQuestions(extracted);
            if (questionsResolved > 0) {
                console.log(`Auto-resolved ${questionsResolved} pending questions based on new information`);
            }

            // Check if new facts indicate action items are complete
            const actionsCompleted = this.checkAndCompleteActions(extracted);
            if (actionsCompleted > 0) {
                console.log(`Auto-completed ${actionsCompleted} pending action items based on new information`);
            }

            return {
                success: true,
                docId: docId,
                facts: factsAdded,
                questions: questionsAdded,
                questionsResolved: questionsResolved,
                actionsCompleted: actionsCompleted,
                decisions: decisionsAdded,
                risks: risksAdded,
                actions: actionsAdded,
                people: peopleAdded,
                summary: extracted.summary,
                extraction_coverage: coverage
            };

        } catch (error) {
            this.processingState.errors.push({
                file: filename,
                error: error.message
            });

            // Update document status to 'error' if it was registered
            if (typeof docId !== 'undefined') {
                this.storage.updateDocumentStatus(docId, 'error');
            }

            // Log failed processing
            this.storage.logFileProcessing({
                document_id: typeof docId !== 'undefined' ? docId : null,
                filename: filename,
                method: 'failed',
                chunks_processed: 0,
                pages_processed: 0,
                facts_extracted: 0,
                questions_extracted: 0,
                decisions_extracted: 0,
                risks_extracted: 0,
                actions_extracted: 0,
                people_extracted: 0,
                processing_time_ms: 0,
                status: 'error',
                error_message: error.message,
                started_at: new Date().toISOString()
            });

            console.error(`File processing failed: ${filename} | Error: ${error.message}`);

            // File stays in newinfo/ for retry
            return {
                success: false,
                error: error.message
            };
        } finally {
            // Always unlock the file when done (success or error)
            this.filesInProgress.delete(filePath);
        }
    }

    // =====================================================
    // CONTENT-FIRST ARCHITECTURE
    // Phase 1: Extract raw content → save to content/
    // Phase 2: Holistic synthesis with full context
    // =====================================================

    /**
     * Save raw content to content/ folder for later holistic synthesis
     * @param {string} filename - Original filename
     * @param {string} content - Raw extracted content (OCR text, document text, etc.)
     * @param {object} metadata - Additional metadata (source, method, date)
     * @returns {string} - Path to saved content file
     */
    saveRawContent(filename, content, metadata = {}) {
        const contentDir = path.join(this.config.dataDir, 'content');
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir, { recursive: true });
        }

        // Create markdown file with metadata header
        const baseName = path.basename(filename, path.extname(filename));
        const contentPath = path.join(contentDir, `${baseName}.md`);

        const header = `---
source: ${filename}
extracted: ${new Date().toISOString()}
method: ${metadata.method || 'unknown'}
---

`;
        fs.writeFileSync(contentPath, header + content, 'utf8');
        console.log(`Saved raw content: ${contentPath} (${content.length} chars)`);
        return contentPath;
    }

    /**
     * Process file to extract raw content only (no fact extraction)
     * Content is saved to content/ folder for later holistic synthesis
     */
    async processFileContentOnly(filePath, textModel, visionModel = null, isTranscript = false) {
        // Load prompts from Supabase before processing
        await this.loadPromptsFromSupabase();

        const filename = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        this.processingState.currentFile = filename;
        this.processingState.message = `Extracting content from ${filename}...`;

        // Prevent race conditions
        if (this.filesInProgress.has(filePath)) {
            console.log(`File already being processed (skipping): ${filename}`);
            return { success: true, skipped: true, reason: 'already_in_progress' };
        }

        if (!fs.existsSync(filePath)) {
            console.log(`File no longer exists: ${filename}`);
            return { success: true, skipped: true, reason: 'file_not_found' };
        }

        // Calculate MD5 hash for duplicate detection and storage
        const fileSize = fs.statSync(filePath).size;
        const contentHash = await this.storage.calculateFileHash(filePath);
        
        // Check for duplicates using MD5 hash
        const duplicateCheck = this.storage.checkDocumentExists(filename, fileSize, filePath);
        
        if (duplicateCheck.exists) {
            const method = duplicateCheck.method === 'hash' ? 'content hash' : 'name+size';
            const existingName = duplicateCheck.document?.name || duplicateCheck.document?.filename || 'unknown';
            console.log(`[Duplicate] Skipping ${filename} - matches "${existingName}" (${method})`);
            
            // Archive the duplicate file
            const archiveDir = path.join(this.config.dataDir, 'archived', 'duplicates');
            
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }
            
            const archivePath = path.join(archiveDir, `${new Date().toISOString().split('T')[0]}_${filename}`);
            try {
                fs.renameSync(filePath, archivePath);
                console.log(`[Duplicate] Moved to: ${archivePath}`);
            } catch (e) {
                console.log(`[Duplicate] Could not archive: ${e.message}`);
            }
            
            return { 
                success: true, 
                skipped: true, 
                reason: 'duplicate',
                duplicateOf: existingName,
                method: method
            };
        }

        this.filesInProgress.add(filePath);
        
        // Store content hash for later use in addDocument
        const fileHash = contentHash;

        try {
            const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
            const isPdf = ext === '.pdf';

            let rawContent = '';
            let method = 'text';

            if (isImage) {
                // Use vision model to OCR the image
                method = 'vision-ocr';
                const imageModel = visionModel || (await this.findBestModel('vision'))?.model;

                if (!imageModel) {
                    throw new Error(`Image ${filename} requires a vision model but none is configured`);
                }

                const prosePrompt = this.buildVisionProsePrompt(filename);
                console.log(`OCR extracting: ${filename} with ${imageModel}...`);

                const visionResult = await this.llmGenerateVision(imageModel, prosePrompt, [filePath], {
                    temperature: 0.3,
                    maxTokens: 8192
                });

                if (!visionResult.success) {
                    throw new Error(`Vision extraction failed: ${visionResult.error}`);
                }

                rawContent = this.cleanOCROutput(visionResult.response);
                console.log(`OCR complete: ${rawContent.length} chars from ${filename}`);

            } else if (isPdf) {
                // Handle PDF - check if scanned
                const pdfInfo = await this.isPdfScanned(filePath);

                if (pdfInfo.isScanned && visionModel) {
                    // Scanned PDF - use vision model on converted images
                    method = 'vision-pdf-ocr';
                    const pdfImages = await this.convertPdfToImages(filePath);

                    if (pdfImages && pdfImages.length > 0) {
                        const pageContents = [];

                        for (let i = 0; i < pdfImages.length; i++) {
                            this.processingState.message = `OCR page ${i + 1}/${pdfImages.length} of ${filename}...`;

                            const prosePrompt = this.buildVisionProsePrompt(`${filename} (page ${i + 1})`);
                            const pageResult = await this.llmGenerateVision(visionModel, prosePrompt, [pdfImages[i]], {
                                temperature: 0.3,
                                maxTokens: 8192
                            });

                            if (pageResult.success) {
                                const cleanedPage = this.cleanOCROutput(pageResult.response);
                                pageContents.push(`## Page ${i + 1}\n\n${cleanedPage}`);
                            }
                        }

                        rawContent = pageContents.join('\n\n---\n\n');
                        this.cleanupTempFiles(pdfImages);
                    }
                } else {
                    // Text PDF - extract text directly
                    method = 'text-pdf';
                    rawContent = await this.readFileContent(filePath);
                }

            } else {
                // Text files - read directly
                method = isTranscript ? 'transcript' : 'text';
                rawContent = await this.readFileContent(filePath);
            }

            // Save raw content to content/ folder
            const contentPath = this.saveRawContent(filename, rawContent, { method });

            // Archive original file
            const archiveDir = path.join(this.config.dataDir, 'archived', isTranscript ? 'meetings' : 'documents');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }

            const datePrefix = new Date().toISOString().split('T')[0];
            const archivedPath = path.join(archiveDir, `${datePrefix}_${filename}`);
            fs.renameSync(filePath, archivedPath);

            console.log(`Content extracted: ${filename} → ${contentPath} [hash: ${fileHash ? String(fileHash).substring(0, 8) : 'none'}...]`);

            return {
                success: true,
                filename,
                contentPath,
                method,
                contentLength: rawContent.length,
                contentHash: fileHash,  // Include hash for document storage
                content: rawContent  // Include actual content for database storage
            };

        } catch (error) {
            console.error(`Content extraction failed: ${filename} | ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.filesInProgress.delete(filePath);
        }
    }

    /**
     * Get path to synthesized files tracking file
     */
    getSynthesizedFilesPath() {
        return path.join(this.config.dataDir, 'synthesized_files.json');
    }

    /**
     * Load synthesized files tracking data
     */
    loadSynthesizedFiles() {
        const trackingPath = this.getSynthesizedFilesPath();
        if (fs.existsSync(trackingPath)) {
            try {
                return JSON.parse(fs.readFileSync(trackingPath, 'utf8'));
            } catch (e) {
                console.error('Error loading synthesized files tracking:', e.message);
            }
        }
        return {
            version: '1.0',
            files: {},  // { filename: { hash, synthesized_at, facts_extracted, ... } }
            last_synthesis: null
        };
    }

    /**
     * Save synthesized files tracking data
     */
    saveSynthesizedFiles(data) {
        const trackingPath = this.getSynthesizedFilesPath();
        data.last_synthesis = new Date().toISOString();
        fs.writeFileSync(trackingPath, JSON.stringify(data, null, 2));
    }

    /**
     * Calculate hash of file content for change detection
     */
    getContentHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Mark files as synthesized
     */
    markFilesSynthesized(files, stats = {}) {
        const tracking = this.loadSynthesizedFiles();

        for (const file of files) {
            tracking.files[file.name] = {
                hash: this.getContentHash(file.content),
                synthesized_at: new Date().toISOString(),
                size: file.content.length,
                facts_extracted: stats.factsFromFile?.[file.name] || 0
            };
        }

        this.saveSynthesizedFiles(tracking);
    }

    /**
     * Get all raw content files for synthesis
     */
    getContentFiles() {
        const contentDir = path.join(this.config.dataDir, 'content');
        if (!fs.existsSync(contentDir)) {
            return [];
        }

        return fs.readdirSync(contentDir)
            .filter(f => f.endsWith('.md'))
            .map(f => ({
                name: f,
                path: path.join(contentDir, f),
                content: fs.readFileSync(path.join(contentDir, f), 'utf8')
            }));
    }

    /**
     * Get only NEW content files that haven't been synthesized yet
     * or files that have changed since last synthesis
     */
    getNewContentFiles() {
        const allFiles = this.getContentFiles();
        const tracking = this.loadSynthesizedFiles();

        const newFiles = allFiles.filter(file => {
            const tracked = tracking.files[file.name];
            if (!tracked) {
                // Never synthesized
                return true;
            }

            // Check if content has changed (hash mismatch)
            const currentHash = this.getContentHash(file.content);
            if (tracked.hash !== currentHash) {
                console.log(`File ${file.name} has changed since last synthesis`);
                return true;
            }

            return false;
        });

        console.log(`Content files: ${allFiles.length} total, ${newFiles.length} new/changed`);
        return newFiles;
    }

    /**
     * Clear synthesis tracking (force full reprocessing)
     */
    clearSynthesisTracking() {
        const trackingPath = this.getSynthesizedFilesPath();
        if (fs.existsSync(trackingPath)) {
            fs.unlinkSync(trackingPath);
            console.log('Synthesis tracking cleared - next synthesis will process all files');
        }
    }

    /**
     * Build holistic synthesis prompt with full context
     * Designed to produce structured PROJECT KNOWLEDGE BASE output
     */
    buildHolisticSynthesisPrompt(allContent, existingFacts, pendingQuestions) {
        return `/no_think
You are a BUSINESS ANALYST building a PROJECT KNOWLEDGE BASE from document content.
This is for a DATA MIGRATION / CRM TRANSFORMATION project.

## PROJECT CONTEXT
This appears to be project documentation (slides, process diagrams, architecture docs).
Your goal: Extract STRUCTURED KNOWLEDGE that helps understand:
- What systems/processes are involved
- What entities/data objects exist
- What decisions have been made
- What steps/phases are defined
- Who is responsible for what
- What risks or blockers exist

## EXISTING KNOWLEDGE (avoid duplicates)
${existingFacts.length > 0 ? existingFacts.slice(0, 50).map(f => `- [${f.category || 'general'}] ${f.content}`).join('\n') : '(building from scratch)'}

## PENDING QUESTIONS (check if content answers any)
${pendingQuestions.length > 0 ? pendingQuestions.map(q => `- Q${q.id}: ${q.content}`).join('\n') : '(none yet)'}

## CONTENT TO ANALYZE
${allContent}

## EXTRACTION RULES
1. **PROCESSES**: Look for numbered steps, phases, workflows (e.g., "1.1 Convert opportunity to contract")
2. **ENTITIES**: Data objects, systems, applications mentioned (e.g., "ESA", "Contract", "Billing Account")
3. **ARCHITECTURE**: Systems, integrations, data flows (e.g., "SAP CRM", "Salesforce", "Azure")
4. **PEOPLE/TEAMS**: Roles, responsibilities, team names
5. **DECISIONS**: Confirmed choices, agreements, resolutions
6. **TIMELINES**: Dates, phases, milestones, deadlines
7. **RISKS**: Blockers, concerns, dependencies, issues

## OUTPUT FORMAT (strict JSON)
{
  "facts": [
    {"content": "L3 Process 1.1: Convert CPQ opportunity to contract", "category": "process", "confidence": 0.95},
    {"content": "ESA (Energy Service Agreement) links to Contract via ContractId field", "category": "technical", "confidence": 0.9},
    {"content": "Increment 0 focuses on Environment Setup and Q2C base SF", "category": "timeline", "confidence": 0.9}
  ],
  "people": [
    {"name": "Paulo", "role": "Data Migration Lead", "organization": "CGI"},
    {"name": "Daan", "role": "Product Owner", "organization": "ENGIE"},
    {"name": "Martijn", "role": "Analyst", "organization": "ENGIE"}
  ],
  "resolved_questions": [
    {"question_id": 123, "answer": "The answer found in content"}
  ],
  "new_questions": [
    {"content": "What is the exact mapping between SAP price keys and Salesforce fields?", "context": "Price key mapping mentioned as complex but details not provided", "priority": "high"}
  ],
  "decisions": [
    {"content": "Big Bang migration approach confirmed (not phased)", "date": "2026-01", "owner": "Architecture team"}
  ],
  "risks": [
    {"content": "60-hour migration estimate exceeds 48-hour weekend cutover window", "impact": "high"}
  ]
}

## PEOPLE EXTRACTION RULES
- Extract EVERY person mentioned by name
- Include their role/title if mentioned
- Include their organization (ENGIE, CGI, etc.) if mentioned
- Even partial info is valuable - "Mathijs (ENGIE)" = {"name": "Mathijs", "organization": "ENGIE"}

## QUALITY RULES
- Extract SPECIFIC information (names, numbers, dates) not generic statements
- Each fact should be ACTIONABLE for a migration analyst
- Prefer "Entity X has relationship Y to Entity Z" over "Data model is complex"
- Include IDs, codes, field names when visible in content
- If a table has data, extract the key rows/columns as facts
- Skip meta-commentary (slide headers like "Questions?" or "Thank you")`;
    }

    /**
     * Holistic synthesis - analyze all content with full context
     * Uses BATCH PROCESSING to handle large numbers of files
     * Processes 5 files at a time, accumulating facts between batches
     *
     * INCREMENTAL MODE (default): Only processes NEW or CHANGED content files
     * FULL MODE: Set forceResynthesis=true to reprocess everything
     */
    async holisticSynthesis(reasoningModel, documentIdsOrForce = false) {
        // Handle both old signature (forceResynthesis) and new (documentIds object)
        let forceResynthesis = false;
        let documentIds = {};
        if (typeof documentIdsOrForce === 'boolean') {
            forceResynthesis = documentIdsOrForce;
        } else if (typeof documentIdsOrForce === 'object') {
            documentIds = documentIdsOrForce || {};
        }
        
        // Store for use in synthesis
        this._currentDocumentIds = documentIds;
        
        this.processingState.message = 'Running holistic synthesis...';
        console.log('Starting BATCHED holistic synthesis...');
        console.log(`Document IDs available: ${Object.keys(documentIds).length}`);

        // Get content files - incremental or full
        const allContentFiles = this.getContentFiles();
        let contentFiles;

        if (forceResynthesis) {
            console.log('FULL RESYNTHESIS MODE - processing all content files');
            this.clearSynthesisTracking();
            contentFiles = allContentFiles;
        } else {
            // Incremental mode - only new/changed files
            contentFiles = this.getNewContentFiles();
        }

        if (contentFiles.length === 0) {
            console.log('No new content files to synthesize (all already processed)');
            return {
                success: true,
                message: 'No new content to synthesize - all files already processed',
                skipped: true,
                stats: {
                    totalFiles: allContentFiles.length,
                    newFiles: 0
                }
            };
        }

        console.log(`Found ${contentFiles.length} content files to synthesize (${allContentFiles.length - contentFiles.length} already processed)`);

        // Batch size - process N files at a time
        const BATCH_SIZE = 5;
        const totalBatches = Math.ceil(contentFiles.length / BATCH_SIZE);

        // Track cumulative results
        let totalFactsAdded = 0;
        let totalQuestionsResolved = 0;
        let totalQuestionsAdded = 0;
        let totalDecisionsAdded = 0;
        let totalRisksAdded = 0;
        let totalPeopleAdded = 0;

        // Get initial context
        const pendingQuestions = this.storage.getQuestions({ status: 'pending' });
        console.log(`Context: ${pendingQuestions.length} pending questions`);

        // Process in batches
        for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
          try {
            const startIdx = batchNum * BATCH_SIZE;
            const endIdx = Math.min(startIdx + BATCH_SIZE, contentFiles.length);
            const batchFiles = contentFiles.slice(startIdx, endIdx);

            // Update progress (60-95% range for synthesis)
            const batchProgress = 60 + Math.round((batchNum / totalBatches) * 35);
            this.processingState.progress = batchProgress;
            this.processingState.message = `Synthesizing batch ${batchNum + 1}/${totalBatches} (${batchFiles.map(f => f.name.replace('.md', '')).join(', ')})`;

            console.log(`\n--- Batch ${batchNum + 1}/${totalBatches}: ${batchFiles.map(f => f.name).join(', ')} ---`);

            // Get CURRENT facts (including ones added in previous batches)
            const existingFacts = this.storage.getFacts();
            console.log(`Current context: ${existingFacts.length} facts`);

            // Combine batch content
            const batchContent = batchFiles.map(f => {
                const name = f.name.replace('.md', '');
                // Truncate very long content to prevent overwhelming
                const content = f.content.length > 15000 ? f.content.substring(0, 15000) + '\n...[truncated]' : f.content;
                return `### ${name}\n${content}`;
            }).join('\n\n---\n\n');

            // Build synthesis prompt for this batch
            const prompt = this.buildHolisticSynthesisPrompt(batchContent, existingFacts, pendingQuestions);

            // Call reasoning model
            const result = await this.llmGenerateText(reasoningModel, prompt, {
                temperature: 0.2,
                maxTokens: 8192
            });

            if (!result.success) {
                console.error(`Batch ${batchNum + 1} synthesis failed:`, result.error);
                continue; // Try next batch
            }

            // Parse synthesis results
            const synthesized = this.parseAIResponse(result.response);
            console.log(`Batch ${batchNum + 1} results: ${synthesized.facts?.length || 0} facts, ${synthesized.resolved_questions?.length || 0} resolved`);

            // Store results (facts are persisted, so next batch sees them)
            const existingFactSet = new Set(existingFacts.map(f => f.content?.toLowerCase().trim()));
            const batchSourceFiles = batchFiles.map(f => f.name.replace('.md', '')).join(', ');

            // Find document ID for this batch (use first file's document ID)
            let batchDocumentId = null;
            for (const f of batchFiles) {
                const baseName = f.name.replace('.md', '');
                batchDocumentId = this._currentDocumentIds?.[baseName] || 
                                  this._currentDocumentIds?.[f.name] ||
                                  this._currentDocumentIds?.[baseName + '.txt'] || null;
                if (batchDocumentId) break;
            }
            console.log(`[Synthesis] Batch document ID: ${batchDocumentId || 'none'}`);
            
            for (const fact of synthesized.facts || []) {
                const content = typeof fact === 'string' ? fact : fact.content;
                if (!content) continue;

                const key = content.toLowerCase().trim();
                if (existingFactSet.has(key)) continue;
                if (this.isGarbageFact(content)) continue;

                try {
                    await this.storage.addFact({
                        content: content,
                        category: fact.category || 'general',
                        confidence: fact.confidence || 0.9,
                        source_file: batchSourceFiles,
                        source_document_id: batchDocumentId
                    });
                    existingFactSet.add(key);
                    totalFactsAdded++;
                } catch (e) {
                    console.warn(`[Synthesis] Failed to add fact: ${e.message}`);
                }
            }

            // Resolve questions
            for (const resolved of synthesized.resolved_questions || []) {
                if (resolved.question_id && resolved.answer) {
                    try {
                        await this.storage.resolveQuestion(resolved.question_id, resolved.answer);
                        totalQuestionsResolved++;
                    } catch (e) {
                        console.warn(`[Synthesis] Failed to resolve question: ${e.message}`);
                    }
                }
            }

            // Add new questions
            for (const q of synthesized.new_questions || []) {
                if (!q.content || q.content.length < 10) continue;

                try {
                    await this.storage.addQuestion({
                        content: q.content,
                        context: q.context,
                        priority: q.priority || 'medium',
                        source_file: batchSourceFiles,
                        source_document_id: batchDocumentId
                    });
                    totalQuestionsAdded++;
                } catch (e) {
                    console.warn(`[Synthesis] Failed to add question: ${e.message}`);
                }
            }

            // Add decisions
            for (const decision of synthesized.decisions || []) {
                const content = typeof decision === 'string' ? decision : decision.content;
                if (!content) continue;

                try {
                    await this.storage.addDecision({
                        content: content,
                        decision_date: decision.date,
                        owner: decision.owner,
                        source_file: batchSourceFiles
                    });
                    totalDecisionsAdded++;
                } catch (e) {
                    console.warn(`[Synthesis] Failed to add decision: ${e.message}`);
                }
            }

            // Add risks
            for (const risk of synthesized.risks || []) {
                const content = typeof risk === 'string' ? risk : risk.content;
                if (!content) continue;

                try {
                    await this.storage.addRisk({
                        content: content,
                        impact: risk.impact,
                        source_file: batchSourceFiles,
                        source_document_id: batchDocumentId
                    });
                    totalRisksAdded++;
                } catch (e) {
                    console.warn(`[Synthesis] Failed to add risk: ${e.message}`);
                }
            }

            // Add people (org chart)
            for (const person of synthesized.people || []) {
                const name = typeof person === 'string' ? person : person.name;
                if (!name || name.length < 2) continue;

                // Check for duplicates
                const existingPeople = this.storage.getPeople();
                const exists = existingPeople.some(p =>
                    p.name?.toLowerCase().trim() === name.toLowerCase().trim()
                );
                if (exists) continue;

                try {
                    const contextSnippet = person.context || person.snippet || 
                        (person.role ? `${name} - ${person.role}` : `Mentioned in batch: ${batchSourceFiles}`);
                    
                    await this.storage.addPerson({
                        name: name,
                        role: person.role || null,
                        organization: person.organization || null,
                        source_file: batchSourceFiles,
                        first_seen_in: batchSourceFiles,
                        role_context: person.role_context || '',
                        context_snippet: contextSnippet,
                        source_document_id: batchDocumentId
                    });
                    totalPeopleAdded++;
                } catch (e) {
                    console.warn(`[Synthesis] Failed to add person: ${e.message}`);
                }
            }

            console.log(`Running totals: ${totalFactsAdded} facts, ${totalQuestionsResolved} resolved, ${totalQuestionsAdded} new questions, ${totalPeopleAdded} people`);

            // Mark batch files as synthesized (incremental tracking)
            this.markFilesSynthesized(batchFiles);
          } catch (batchError) {
            console.error(`[Synthesis] Batch ${batchNum + 1} error:`, batchError.message || batchError);
            // Continue with next batch instead of crashing
          }
        }

        // After synthesis, enrich questions with new person attributions
        await this.enrichQuestionsWithPeople();
        
        // Generate AI titles and summaries for documents that don't have them
        const summaryStats = await this.generateMissingDocumentSummaries();

        console.log(`\nHolistic synthesis complete: +${totalFactsAdded} facts, ${totalQuestionsResolved} resolved, +${totalQuestionsAdded} new questions, +${totalDecisionsAdded} decisions, +${totalRisksAdded} risks, +${totalPeopleAdded} people, ${summaryStats.generated} summaries`);

        return {
            success: true,
            stats: {
                contentFiles: contentFiles.length,
                batches: totalBatches,
                factsAdded: totalFactsAdded,
                questionsResolved: totalQuestionsResolved,
                questionsAdded: totalQuestionsAdded,
                decisionsAdded: totalDecisionsAdded,
                risksAdded: totalRisksAdded,
                peopleAdded: totalPeopleAdded,
                summariesGenerated: summaryStats.generated
            }
        };
    }
    
    /**
     * Generate AI titles and summaries for documents that don't have them
     */
    async generateMissingDocumentSummaries() {
        const stats = { generated: 0, skipped: 0, errors: 0 };
        
        try {
            // Get all processed documents
            const allDocs = this.storage.getDocuments('processed') || [];
            const docsNeedingSummary = allDocs.filter(d => {
                const hasAITitle = d.ai_title && d.ai_title !== d.filename && d.ai_title !== d.name;
                const hasAISummary = d.ai_summary || (d.summary && d.summary.length > 50);
                return !hasAITitle || !hasAISummary;
            });
            
            if (docsNeedingSummary.length === 0) {
                console.log('[Summaries] All documents already have AI summaries');
                return stats;
            }
            
            console.log(`[Summaries] Generating AI summaries for ${docsNeedingSummary.length} documents...`);
            
            for (const doc of docsNeedingSummary) {
                try {
                    // Build extraction stats from source_file references
                    const docBaseName = (doc.name || doc.filename || '').replace(/\.[^/.]+$/, '').toLowerCase();
                    const facts = this.storage.getFacts().filter(f => 
                        (f.source_file || '').toLowerCase().includes(docBaseName)
                    );
                    const decisions = this.storage.getDecisions().filter(d => 
                        (d.source_file || d.source || '').toLowerCase().includes(docBaseName)
                    );
                    const risks = this.storage.getRisks().filter(r => 
                        (r.source_file || '').toLowerCase().includes(docBaseName)
                    );
                    const people = this.storage.getPeople().filter(p => 
                        (p.source_file || '').toLowerCase().includes(docBaseName)
                    );
                    
                    // Generate AI summary
                    const summaryResult = await this.generateFileSummary(
                        doc.name || doc.filename,
                        { 
                            facts: facts.map(f => ({ content: f.fact || f.content })),
                            decisions: decisions.map(d => ({ content: d.content })),
                            people: people.map(p => ({ name: p.name }))
                        },
                        facts.length,
                        decisions.length,
                        risks.length,
                        people.length
                    );
                    
                    if (summaryResult && (summaryResult.title || summaryResult.summary)) {
                        // Update document with AI metadata
                        doc.ai_title = summaryResult.title;
                        doc.ai_summary = summaryResult.summary;
                        this.storage.saveDocuments();
                        
                        // Also update file_log
                        this.storage.updateFileLog(doc.id, {
                            ai_title: summaryResult.title,
                            ai_summary: summaryResult.summary,
                            facts: facts.length,
                            decisions: decisions.length,
                            risks: risks.length,
                            people: people.length
                        });
                        
                        stats.generated++;
                        console.log(`[Summaries] Generated: ${doc.name} - "${summaryResult.title}"`);
                    } else {
                        stats.skipped++;
                    }
                } catch (err) {
                    console.log(`[Summaries] Error for ${doc.name}: ${err.message}`);
                    stats.errors++;
                }
            }
            
            console.log(`[Summaries] Complete: ${stats.generated} generated, ${stats.skipped} skipped, ${stats.errors} errors`);
        } catch (e) {
            console.error('[Summaries] Failed:', e.message);
        }
        
        return stats;
    }

    /**
     * Enrich existing questions with person attributions based on extracted people/roles
     * When new people are discovered, update questions that match their role/expertise
     * NAME mentions take PRIORITY over role-based assignments
     */
    async enrichQuestionsWithPeople() {
        const people = this.storage.getPeople();
        const questions = this.storage.getQuestions({ status: 'pending' });

        if (people.length === 0 || questions.length === 0) {
            return;
        }

        console.log(`Enriching ${questions.length} questions with ${people.length} people...`);
        let enrichedCount = 0;
        let nameUpgradeCount = 0;

        // Separate people with actual names from role-only entries
        const namedPeople = people.filter(p => {
            const name = (p.name || '').toLowerCase();
            return name && !name.includes('lead') && !name.includes('developer') &&
                   !name.includes('analyst') && !name.includes('manager') &&
                   !name.includes('tester') && !name.includes('steward') &&
                   !name.includes('architect');
        });

        for (const question of questions) {
            const currentAssignee = question.assigned_to;
            const hasRoleAssignee = currentAssignee && currentAssignee.length > 2;

            // PRIORITY 1: Check for direct NAME mention (even if already has role assignee)
            const questionText = (question.content || '').toLowerCase();
            const questionContext = (question.context || '').toLowerCase();
            const fullText = questionText + ' ' + questionContext;

            let nameMatch = null;
            for (const person of namedPeople) {
                const name = (person.name || '').toLowerCase().trim();
                if (!name) continue;

                const namePattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                if (namePattern.test(fullText)) {
                    nameMatch = person.name;
                    console.log(`Direct name match: ${person.name} found in question ${question.id}`);
                    break;
                }
            }

            // If we found a name and it's different from current assignee, update
            if (nameMatch && nameMatch !== currentAssignee) {
                this.storage.updateQuestion(question.id, { assigned_to: nameMatch });
                if (hasRoleAssignee) {
                    console.log(`Upgraded question ${question.id}: ${currentAssignee} -> ${nameMatch} (name takes priority)`);
                    nameUpgradeCount++;
                } else {
                    console.log(`Enriched question ${question.id}: assigned to ${nameMatch}`);
                    enrichedCount++;
                }
                continue;
            }

            // PRIORITY 2: Role-based assignment (only if no assignee yet)
            if (!hasRoleAssignee) {
                const suggestedAssignee = this.suggestQuestionAssignee(question, people);
                if (suggestedAssignee) {
                    this.storage.updateQuestion(question.id, { assigned_to: suggestedAssignee });
                    console.log(`Enriched question ${question.id}: assigned to ${suggestedAssignee}`);
                    enrichedCount++;
                }
            }
        }

        if (enrichedCount > 0 || nameUpgradeCount > 0) {
            console.log(`Enriched ${enrichedCount} questions, upgraded ${nameUpgradeCount} from role to name`);
        }
    }

    /**
     * Process all files using Content-First Architecture
     * Phase 1: Extract raw content from all files
     * Phase 2: Holistic synthesis with full context
     * @param {string} userRole - Optional user role for contextual extraction
     */
    async processAllContentFirst(textModel, visionModel = null, userRole = '') {
        this.processingState = {
            status: 'processing',
            progress: 0,
            currentFile: null,
            message: 'Starting content-first processing...',
            errors: [],
            totalFiles: 0,
            processedFiles: 0,
            startTime: Date.now(),
            estimatedTimeRemaining: null,
            currentPhase: 'extraction',
            filesTiming: []
        };

        // Store models and user context
        this.textModel = textModel;
        this.visionModel = visionModel;
        this.userRole = userRole;

        const pending = this.scanPendingFiles();
        const allFiles = [
            ...pending.newinfo.map(f => ({ ...f, type: 'document' })),
            ...pending.newtranscripts.map(f => ({ ...f, type: 'transcript' }))
        ];

        if (allFiles.length === 0) {
            this.processingState.status = 'idle';
            this.processingState.message = 'No files to process';
            return { processed: 0, errors: [] };
        }

        const results = {
            phase1: { processed: 0, errors: [] },
            phase2: null
        };

        // Initialize enhanced tracking
        this.processingState.totalFiles = allFiles.length;
        this.processingState.processedFiles = 0;
        this.processingState.startTime = Date.now();
        this.processingState.currentPhase = 'extraction';

        // PHASE 1: Extract raw content from all files
        console.log(`\n=== PHASE 1: Content Extraction (${allFiles.length} files) ===`);

        for (let i = 0; i < allFiles.length; i++) {
            const file = allFiles[i];
            const fileStartTime = Date.now();
            
            this.processingState.progress = Math.round((i / allFiles.length) * 50); // 0-50%
            this.processingState.processedFiles = i;
            this.processingState.message = `Extracting content from ${file.name} (${i + 1}/${allFiles.length})`;
            this.updateTimeEstimate(i, allFiles.length);

            const isTranscript = file.type === 'transcript';
            const result = await this.processFileContentOnly(file.path, textModel, visionModel, isTranscript);
            
            // Track timing for better estimates
            this.processingState.filesTiming.push(Date.now() - fileStartTime);

            if (result.success && !result.skipped) {
                results.phase1.processed++;

                // Track document in Supabase with content hash and document date
                const docRecord = await this.storage.addDocument({
                    name: file.name,
                    filename: file.name,
                    path: file.path,
                    type: isTranscript ? 'transcript' : 'document',
                    doc_type: isTranscript ? 'transcript' : 'document',
                    content_path: result.contentPath,
                    content: result.content,  // Store actual content in database
                    extraction_method: result.method,
                    content_length: result.contentLength,
                    content_hash: result.contentHash,  // MD5 hash for duplicate detection
                    document_date: file.documentDate || null,  // User-provided date for timeline
                    document_time: file.documentTime || null,
                    status: 'completed'
                });
                
                // Store document ID for linking in Phase 2
                if (docRecord?.id) {
                    if (!results.documentIds) results.documentIds = {};
                    results.documentIds[file.name] = docRecord.id;
                    // Also store by content file name (without extension)
                    const baseName = file.name.replace(/\.[^/.]+$/, '');
                    results.documentIds[baseName] = docRecord.id;
                    results.documentIds[baseName + '.md'] = docRecord.id;
                    console.log(`[Phase1] Document ${file.name} registered with ID: ${docRecord.id}`);
                }
            } else if (result.skipped && result.reason === 'duplicate') {
                console.log(`[Phase1] Skipped duplicate: ${file.name} (matches ${result.duplicateOf})`);
            } else if (!result.success) {
                results.phase1.errors.push({ file: file.name, error: result.error });
            }
        }

        console.log(`Phase 1 complete: ${results.phase1.processed} files extracted`);

        // PHASE 2: Holistic synthesis with full context
        if (results.phase1.processed > 0) {
            console.log(`\n=== PHASE 2: Holistic Synthesis ===`);
            this.processingState.progress = 60;
            this.processingState.message = 'Running holistic synthesis...';

            const reasoningModel = this.config.ollama?.reasoningModel || this.config.ollama?.model || textModel;
            // Pass document IDs to synthesis for linking
            results.phase2 = await this.holisticSynthesis(reasoningModel, results.documentIds || {});
        }

        // PHASE 3: AI Content Processing - Extract entities, relationships, and populate graph
        const graphProvider = this.storage.getGraphProvider();
        if (results.phase1.processed > 0) {
            console.log(`\n=== PHASE 3: AI Content Processing ===`);
            this.processingState.progress = 85;
            this.processingState.message = 'Running AI content analysis...';

            try {
                const { getAIContentProcessor } = require('./ai');
                const aiProcessor = getAIContentProcessor({
                    llmProvider: this.getLLMProvider(),
                    llmModel: this.config.llm?.perTask?.text?.model || this.config.llm?.models?.text,
                    llmConfig: this.config.llm,
                    enrichForGraph: graphProvider && graphProvider.connected
                });

                // Get content files to process
                const contentFiles = this.getContentFiles();
                let totalEntities = 0;
                let totalRelationships = 0;
                let totalCypherQueries = 0;
                let filesProcessed = 0;

                // Process each content file with AIContentProcessor
                for (const file of contentFiles.slice(0, 10)) { // Limit to 10 files per run
                    try {
                        const content = fs.readFileSync(file.path, 'utf-8');
                        const isTranscript = file.name.includes('transcript') || file.name.includes('meeting');
                        
                        this.processingState.message = `AI analyzing: ${file.name}...`;
                        console.log(`[AIProcessor] Processing: ${file.name}`);

                        let aiResult;
                        if (isTranscript) {
                            aiResult = await aiProcessor.processTranscript({
                                title: file.name.replace('.md', ''),
                                content: content,
                                date: file.modified?.toISOString() || new Date().toISOString()
                            });
                        } else {
                            aiResult = await aiProcessor.processDocument({
                                id: file.name,
                                title: file.name.replace('.md', ''),
                                content: content,
                                type: 'document'
                            });
                        }

                        totalEntities += aiResult.entities?.length || 0;
                        totalRelationships += aiResult.relationships?.length || 0;

                        // Analyze extraction for ontology suggestions
                        try {
                            const { getOntologyAgent } = require('./ontology');
                            const ontologyAgent = getOntologyAgent({
                                dataDir: this.storage.getProjectDataDir ? this.storage.getProjectDataDir() : './data'
                            });
                            await ontologyAgent.analyzeExtraction(aiResult, file.name);
                        } catch (ontologyErr) {
                            // Ontology agent is optional
                        }

                        // Execute Cypher queries to populate graph
                        if (graphProvider && graphProvider.connected && aiResult.cypherQueries?.length > 0) {
                            for (const cq of aiResult.cypherQueries) {
                                try {
                                    await graphProvider.query(cq.query, cq.params);
                                    totalCypherQueries++;
                                } catch (cypherErr) {
                                    // Silently skip failed queries
                                }
                            }
                        }

                        // Add extracted people to storage
                        for (const participant of aiResult.participants || []) {
                            if (participant.name && participant.name.length > 2) {
                                // Extract context: find a line where they spoke or were mentioned
                                const contextSnippet = participant.context || participant.snippet || 
                                    (participant.role ? `${participant.name} (${participant.role})` : `Participant in ${file.name}`);
                                
                                this.storage.addPerson({
                                    name: participant.name,
                                    role: participant.role || null,
                                    organization: participant.organization || null,
                                    source_file: file.name,
                                    first_seen_in: file.name,
                                    role_context: participant.role_context || participant.roleContext || '',
                                    context_snippet: contextSnippet
                                });
                            }
                        }

                        // Add decisions from transcripts
                        for (const decision of aiResult.decisions || []) {
                            if (decision.content && decision.content.length > 10) {
                                this.storage.addDecision({
                                    content: decision.content,
                                    owner: decision.owner || null,
                                    date: decision.date || new Date().toISOString().split('T')[0],
                                    status: 'active',
                                    source: `document:${file.name}`
                                });
                            }
                        }

                        // Add action items
                        for (const action of aiResult.actionItems || []) {
                            if (action.task && action.task.length > 5) {
                                this.storage.addActionItem({
                                    task: action.task,
                                    owner: action.owner || action.assignee || null,
                                    deadline: action.deadline || null,
                                    status: 'pending',
                                    source: `document:${file.name}`
                                });
                            }
                        }

                        // Update document with extraction_result and log to ai_analysis_log
                        const baseName = file.name.replace('.md', '');
                        const docId = results.documentIds?.[file.name] || results.documentIds?.[baseName];
                        if (docId && this.storage._supabase?.supabase) {
                            const factsCount = aiResult.facts?.length || 0;
                            const decisionsCount = aiResult.decisions?.length || 0;
                            const risksCount = (aiResult.risks?.length || 0);
                            const actionsCount = aiResult.actionItems?.length || 0;
                            const questionsCount = aiResult.questions?.length || 0;
                            const totalEntitiesForDoc = factsCount + decisionsCount + risksCount + actionsCount + questionsCount;
                            
                            try {
                                // Update document with extraction_result
                                await this.storage._supabase.supabase
                                    .from('documents')
                                    .update({
                                        extraction_result: aiResult,
                                        summary: aiResult.summary || null,
                                        facts_count: factsCount,
                                        decisions_count: decisionsCount,
                                        risks_count: risksCount,
                                        actions_count: actionsCount,
                                        questions_count: questionsCount,
                                        status: 'processed'
                                    })
                                    .eq('id', docId);
                                
                                // Get project ID for the document
                                const { data: docData } = await this.storage._supabase.supabase
                                    .from('documents')
                                    .select('project_id')
                                    .eq('id', docId)
                                    .single();
                                
                                // Log to ai_analysis_log (use only columns that exist)
                                if (docData?.project_id) {
                                    const { error: logError } = await this.storage._supabase.supabase
                                        .from('ai_analysis_log')
                                        .insert({
                                            project_id: docData.project_id,
                                            document_id: docId,
                                            analysis_type: 'extraction',
                                            provider: aiProcessor.llmProvider || 'unknown',
                                            model: aiProcessor.llmModel || 'unknown',
                                            input_tokens: aiResult.usage?.inputTokens || 0,
                                            output_tokens: aiResult.usage?.outputTokens || 0,
                                            entities_extracted: totalEntitiesForDoc
                                        });
                                    if (logError) {
                                        console.warn(`[Phase3] ai_analysis_log error:`, logError.message);
                                    }
                                }
                                console.log(`[Phase3] Updated document ${docId} with extraction_result (${totalEntitiesForDoc} entities)`);
                            } catch (updateErr) {
                                console.warn(`[Phase3] Failed to update document ${docId}:`, updateErr.message);
                            }
                        }

                        filesProcessed++;
                    } catch (fileErr) {
                        console.log(`[AIProcessor] Error processing ${file.name}: ${fileErr.message}`);
                    }
                }

                // Also create graph nodes for existing knowledge base items
                if (graphProvider && graphProvider.connected) {
                    const recentPeople = this.storage.getPeople();
                    const recentFacts = this.storage.getFacts({ limit: 30 });
                    const recentDecisions = this.storage.getDecisions({ limit: 20 });
                    const recentRisks = this.storage.getRisks({ limit: 20 });

                    // Create Person nodes
                    for (const person of recentPeople) {
                        try {
                            await graphProvider.query(
                                `MERGE (p:Person {name: $name}) SET p.role = coalesce($role, p.role), p.organization = coalesce($org, p.organization)`,
                                { name: person.name, role: person.role, org: person.organization }
                            );
                            totalCypherQueries++;
                        } catch (e) {}
                    }

                    // Create Decision nodes with owner links
                    for (const decision of recentDecisions) {
                        try {
                            await graphProvider.query(
                                `MERGE (d:Decision {content: $content}) SET d.owner = $owner, d.status = $status`,
                                { content: decision.content.substring(0, 500), owner: decision.owner, status: decision.status }
                            );
                            totalCypherQueries++;
                            
                            if (decision.owner) {
                                await graphProvider.query(
                                    `MATCH (d:Decision {content: $content}), (p:Person) WHERE toLower(p.name) CONTAINS toLower($owner) MERGE (p)-[:MADE]->(d)`,
                                    { content: decision.content.substring(0, 500), owner: decision.owner }
                                );
                                totalCypherQueries++;
                            }
                        } catch (e) {}
                    }

                    // Create Risk nodes
                    for (const risk of recentRisks) {
                        try {
                            await graphProvider.query(
                                `MERGE (r:Risk {content: $content}) SET r.impact = $impact, r.status = $status`,
                                { content: risk.content.substring(0, 500), impact: risk.impact, status: risk.status }
                            );
                            totalCypherQueries++;
                        } catch (e) {}
                    }
                }

                console.log(`[Phase3] AI processed ${filesProcessed} files: ${totalEntities} entities, ${totalRelationships} relationships, ${totalCypherQueries} graph queries`);
                results.phase3 = { 
                    success: true, 
                    filesProcessed,
                    entities: totalEntities,
                    relationships: totalRelationships,
                    graphQueries: totalCypherQueries
                };
            } catch (phase3Error) {
                console.error('[Phase3] AI Content Processing error:', phase3Error.message);
                results.phase3 = { success: false, error: phase3Error.message };
            }
        }

        // PHASE 4: Generate AI titles and summaries for processed documents
        if (results.phase1.processed > 0) {
            console.log(`\n=== PHASE 4: Generating AI Titles & Summaries ===`);
            this.processingState.progress = 92;
            this.processingState.message = 'Generating document summaries...';
            this.processingState.currentPhase = 'summaries';
            
            try {
                // Get all recently processed documents
                // Refresh cache first to get newly added documents
                if (this.storage.refreshCache) {
                    await this.storage.refreshCache();
                }
                const allDocs = this.storage.getDocuments('processed') || [];
                const recentDocs = allDocs.slice(0, Math.max(results.phase1.processed, 1));
                console.log(`[Phase4] Found ${recentDocs.length} documents to check for AI summaries`);
                let summariesGenerated = 0;
                
                for (const doc of recentDocs) {
                    // Skip if already has AI-generated summary (not just filename)
                    const hasAITitle = doc.ai_title && doc.ai_title !== doc.filename && doc.ai_title !== doc.name;
                    const hasAISummary = doc.ai_summary || (doc.summary && doc.summary.length > 50);
                    if (hasAITitle && hasAISummary) {
                        console.log(`[Phase4] Skipping ${doc.filename || doc.name} - already has AI summary`);
                        continue;
                    }
                    
                    try {
                        // Read the content file to get extracted data
                        const contentPath = doc.content_path;
                        let extractedContent = '';
                        if (contentPath && fs.existsSync(contentPath)) {
                            extractedContent = fs.readFileSync(contentPath, 'utf-8').substring(0, 2000);
                        }
                        
                        // Build extraction stats from source_file references
                        const docBaseName = (doc.name || doc.filename || '').replace(/\.[^/.]+$/, '').toLowerCase();
                        const facts = this.storage.getFacts().filter(f => 
                            (f.source_file || '').toLowerCase().includes(docBaseName)
                        );
                        const decisions = this.storage.getDecisions().filter(d => 
                            (d.source_file || d.source || '').toLowerCase().includes(docBaseName)
                        );
                        const risks = this.storage.getRisks().filter(r => 
                            (r.source_file || '').toLowerCase().includes(docBaseName)
                        );
                        const people = this.storage.getPeople().filter(p => 
                            (p.source_file || '').toLowerCase().includes(docBaseName)
                        );
                        
                        // Generate AI summary using existing method
                        const summaryResult = await this.generateFileSummary(
                            doc.name || doc.filename,
                            { 
                                facts: facts.map(f => ({ content: f.fact || f.content })),
                                decisions: decisions.map(d => ({ content: d.content })),
                                people: people.map(p => ({ name: p.name }))
                            },
                            facts.length,
                            decisions.length,
                            risks.length,
                            people.length
                        );
                        
                        if (summaryResult && (summaryResult.title || summaryResult.summary)) {
                            // Update document with AI metadata in Supabase
                            try {
                                if (this.storage.updateDocument) {
                                    await this.storage.updateDocument(doc.id, {
                                        ai_title: summaryResult.title,
                                        ai_summary: summaryResult.summary
                                    });
                                }
                            } catch (updateErr) {
                                console.log(`[Phase4] Failed to persist summary: ${updateErr.message}`);
                            }
                            
                            // Update local cache
                            doc.ai_title = summaryResult.title;
                            doc.ai_summary = summaryResult.summary;
                            doc.title = summaryResult.title; // Also update title for display
                            doc.summary = summaryResult.summary;
                            
                            // Also update file_log if exists
                            if (this.storage.updateFileLog) {
                                this.storage.updateFileLog(doc.id, {
                                    ai_title: summaryResult.title,
                                    ai_summary: summaryResult.summary,
                                    facts: facts.length,
                                    decisions: decisions.length,
                                    risks: risks.length,
                                    people: people.length
                                });
                            }
                            
                            summariesGenerated++;
                            console.log(`[Phase4] Generated summary for: ${doc.name || doc.filename} - "${summaryResult.title}"`);
                        }
                    } catch (sumErr) {
                        console.log(`[Phase4] Failed to generate summary for ${doc.name}: ${sumErr.message}`);
                    }
                }
                
                console.log(`[Phase4] Generated ${summariesGenerated} AI summaries`);
                results.phase4 = { success: true, summariesGenerated };
            } catch (phase4Error) {
                console.error('[Phase4] AI Summary generation error:', phase4Error.message);
                results.phase4 = { success: false, error: phase4Error.message };
            }
        }

        // Unload models
        this.processingState.message = 'Unloading models...';
        try {
            const modelsToUnload = new Set([textModel, visionModel].filter(Boolean));
            const reasoningModel = this.config.ollama?.reasoningModel;
            if (reasoningModel && reasoningModel !== textModel) {
                modelsToUnload.add(reasoningModel);
            }

            if (modelsToUnload.size > 0) {
                await this.ollama.unloadModels([...modelsToUnload]);
            }
        } catch (e) {
            console.error('Model unload failed:', e.message);
        }

        this.processingState = {
            status: 'complete',
            progress: 100,
            currentFile: null,
            message: `Processed ${results.phase1.processed} files with holistic synthesis`,
            errors: results.phase1.errors,
            totalFiles: this.processingState.totalFiles,
            processedFiles: this.processingState.totalFiles,
            startTime: this.processingState.startTime,
            estimatedTimeRemaining: 0,
            currentPhase: 'complete',
            filesTiming: this.processingState.filesTiming || []
        };

        // PHASE 5: Auto-sync to FalkorDB Graph Database
        if (results.phase1.processed > 0) {
            try {
                const graphProvider = this.storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    console.log(`\n=== PHASE 5: Auto-syncing to FalkorDB ===`);
                    const projectId = this.storage.getProjectId?.();
                    if (projectId && typeof graphProvider.switchGraph === 'function') {
                        await graphProvider.switchGraph(`project_${projectId}`);
                    }
                    const { getGraphSync } = require('./sync');
                    const graphSync = getGraphSync({ graphProvider, storage: this.storage });
                    
                    const syncResult = await graphSync.incrementalSync(this.storage);
                    results.graphSync = syncResult;
                    
                    console.log(`[GraphSync] Auto-sync completed:`, {
                        facts: syncResult.facts,
                        decisions: syncResult.decisions,
                        people: syncResult.people,
                        risks: syncResult.risks,
                        actions: syncResult.actions,
                        documents: syncResult.documents
                    });
                } else {
                    console.log('[GraphSync] Skipping auto-sync - FalkorDB not connected');
                }
            } catch (syncError) {
                console.log('[GraphSync] Auto-sync error:', syncError.message);
                results.graphSyncError = syncError.message;
            }
        }

        // PHASE 6: Auto-sync extracted people to Contacts Directory
        if (results.phase1.processed > 0) {
            try {
                const contactsSync = this.storage.syncPeopleToContacts();
                results.contactsSync = contactsSync;
                if (contactsSync.added > 0) {
                    console.log(`[Contacts] Auto-synced ${contactsSync.added} people to Contacts Directory`);
                }
            } catch (contactsError) {
                console.log('[Contacts] Auto-sync error:', contactsError.message);
            }
        }

        // PHASE 6.5: Fact-check – analyze facts for conflicts as project content grows
        if (results.phase1.processed > 0 && this.config?.factCheck?.runAfterDocumentProcessing !== false) {
            try {
                const { runFactCheck } = require('./fact-check');
                const factCheckResult = await runFactCheck(this.storage, this.config, { recordEvents: true });
                results.factCheck = factCheckResult;
                if (factCheckResult.conflicts?.length > 0) {
                    console.log(`[FactCheck] Found ${factCheckResult.conflicts.length} conflict(s) among ${factCheckResult.analyzed_facts} facts`);
                } else if (factCheckResult.analyzed_facts >= 2) {
                    console.log(`[FactCheck] No conflicts among ${factCheckResult.analyzed_facts} facts`);
                }
            } catch (factCheckError) {
                console.log('[FactCheck] Error:', factCheckError.message);
                results.factCheckError = factCheckError.message;
            }
        }

        // PHASE 6.6: Decision-check – analyze decisions for conflicts (like fact-check)
        if (results.phase1.processed > 0 && this.config?.decisionCheck?.runAfterDocumentProcessing !== false) {
            try {
                const { runDecisionCheck } = require('./decision-check/DecisionCheckFlow');
                const decisionCheckResult = await runDecisionCheck(this.storage, this.config, { recordEvents: true });
                results.decisionCheck = decisionCheckResult;
                if (decisionCheckResult.conflicts?.length > 0) {
                    console.log(`[DecisionCheck] Found ${decisionCheckResult.conflicts.length} conflict(s) among ${decisionCheckResult.analyzed_decisions} decisions`);
                } else if (decisionCheckResult.analyzed_decisions >= 2) {
                    console.log(`[DecisionCheck] No conflicts among ${decisionCheckResult.analyzed_decisions} decisions`);
                }
            } catch (decisionCheckError) {
                console.log('[DecisionCheck] Error:', decisionCheckError.message);
                results.decisionCheckError = decisionCheckError.message;
            }
        }

        // PHASE 7: AI-powered question answering detection
        if (results.phase1.processed > 0 && this.config?.llm?.provider) {
            try {
                const answersFound = await this.detectAndResolveQuestionsWithAI();
                results.questionsAutoAnswered = answersFound;
                if (answersFound > 0) {
                    console.log(`[AI] Auto-answered ${answersFound} pending questions from processed documents`);
                }
            } catch (aiError) {
                console.log('[AI] Question detection error:', aiError.message);
            }
        }

        return results;
    }

    /**
     * AI-powered detection of answers to pending questions
     * Analyzes recent facts and decisions against pending questions using LLM
     * @returns {number} - Number of questions resolved
     */
    async detectAndResolveQuestionsWithAI() {
        let resolved = 0;

        try {
            const pendingQuestions = this.storage.getQuestions({ status: 'pending' });
            if (pendingQuestions.length === 0) return 0;

            // Get recent facts and decisions (last 50)
            const facts = this.storage.getFacts().slice(-50);
            const decisions = this.storage.knowledge?.decisions?.slice(-20) || [];
            
            if (facts.length === 0 && decisions.length === 0) return 0;

            // Build context from recent information
            let infoContext = 'RECENT INFORMATION FROM DOCUMENTS:\n\n';
            
            for (const fact of facts.slice(-30)) {
                infoContext += `- [FACT] ${fact.content}\n`;
            }
            
            for (const dec of decisions) {
                const content = typeof dec === 'string' ? dec : dec.content;
                infoContext += `- [DECISION] ${content}\n`;
            }

            // Check each pending question
            for (const question of pendingQuestions.slice(0, 10)) { // Limit to 10 at a time
                const prompt = `Analyze if the following question has been answered in the provided information.

QUESTION: "${question.content}"
${question.context ? `CONTEXT: ${question.context}` : ''}

${infoContext}

Instructions:
1. If the information contains a clear answer to the question, extract and provide that answer.
2. If the information partially answers or is related but doesn't fully answer, respond with NO_ANSWER.
3. Be conservative - only mark as answered if the information clearly addresses the question.

Respond in this exact format:
ANSWERED: yes|no
ANSWER: <the answer extracted from the information, or "N/A" if not answered>
SOURCE: <which fact/decision provided the answer, or "N/A">
CONFIDENCE: <high|medium|low>`;

                try {
                    const llmResult = await this.llm.generateText({
                        provider: this.getLLMProvider(),
                        providerConfig: this.getProviderConfig(),
                        model: this.config.llm?.perTask?.text?.model || this.config.llm?.models?.text,
                        prompt: prompt,
                        maxTokens: 500,
                        temperature: 0.2,
                        providerConfig: this.config.llm?.providers?.[this.config.llm?.provider] || {}
                    });

                    const response = llmResult.success ? llmResult.text : '';
                    
                    const answeredMatch = response.match(/ANSWERED:\s*(yes|no)/i);
                    const answerMatch = response.match(/ANSWER:\s*(.+?)(?=SOURCE:|CONFIDENCE:|$)/is);
                    const confidenceMatch = response.match(/CONFIDENCE:\s*(high|medium|low)/i);
                    
                    if (answeredMatch && answeredMatch[1].toLowerCase() === 'yes' && answerMatch) {
                        const answer = answerMatch[1].trim();
                        const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';
                        
                        // Only auto-resolve with high confidence
                        if (confidence === 'high' && answer && answer !== 'N/A' && answer.length > 10) {
                            // Use resolveQuestion with source - persists to Supabase
                            await this.storage.resolveQuestion(question.id, answer, 'auto-detected');
                            
                            resolved++;
                            console.log(`[AI] Auto-answered question: "${question.content.substring(0, 40)}..."`);
                        }
                    }
                } catch (llmError) {
                    console.log(`[AI] Error checking question ${question.id}:`, llmError.message);
                }
            }
        } catch (error) {
            console.error('[AI] detectAndResolveQuestionsWithAI error:', error.message);
        }

        return resolved;
    }

    /**
     * Check if new extracted information answers any pending questions
     * Uses text similarity to match facts/decisions with questions
     * @param {object} extracted - Extracted data from document
     * @returns {Promise<number>} - Number of questions resolved
     */
    async checkAndResolveQuestions(extracted) {
        let resolved = 0;

        try {
            // Get all pending questions
            const pendingQuestions = this.storage.getQuestions({ status: 'pending' });
            if (pendingQuestions.length === 0) return 0;

            // Combine all new information for matching
            const newInfo = [];

            // Add facts
            for (const fact of extracted.facts || []) {
                const content = typeof fact === 'string' ? fact : (fact.content || fact.text);
                if (content) newInfo.push({ type: 'fact', content });
            }

            // Add decisions
            for (const decision of extracted.decisions || []) {
                const content = typeof decision === 'string' ? decision : (decision.content || decision.decision);
                if (content) newInfo.push({ type: 'decision', content });
            }

            // Add summary
            if (extracted.summary) {
                newInfo.push({ type: 'summary', content: extracted.summary });
            }

            if (newInfo.length === 0) return 0;

            // Check each pending question against new information
            for (const question of pendingQuestions) {
                const questionText = question.content?.toLowerCase() || '';
                if (questionText.length < 10) continue;

                // Extract key terms from question (words > 3 chars)
                const questionTerms = new Set(
                    questionText
                        .replace(/[^\w\s]/g, ' ')
                        .split(/\s+/)
                        .filter(w => w.length > 3)
                );

                // Look for matches in new information
                for (const info of newInfo) {
                    const infoText = info.content?.toLowerCase() || '';

                    // Count matching terms
                    const infoTerms = new Set(
                        infoText
                            .replace(/[^\w\s]/g, ' ')
                            .split(/\s+/)
                            .filter(w => w.length > 3)
                    );

                    const matchingTerms = [...questionTerms].filter(t => infoTerms.has(t));
                    const matchRatio = matchingTerms.length / Math.max(questionTerms.size, 1);

                    // If >50% of question terms found in new info, consider it answered
                    if (matchRatio >= 0.5 && matchingTerms.length >= 3) {
                        // Resolve the question with the matching info as answer - persists to Supabase
                        await this.storage.resolveQuestion(
                            question.id, 
                            `[Auto-resolved from ${info.type}] ${info.content.substring(0, 500)}`,
                            'auto-detected'
                        );
                        resolved++;
                        console.log(`Question resolved: "${question.content.substring(0, 50)}..." matched with ${info.type}`);
                        break; // Move to next question
                    }
                }
            }
        } catch (error) {
            console.error('Error checking questions:', error.message);
        }

        return resolved;
    }

    /**
     * Check if new information indicates action items are complete
     * Looks for keywords like "finished", "completed", "done" in facts/summaries
     * @param {object} extracted - Extracted data from processing
     * @returns {number} - Number of action items completed
     */
    checkAndCompleteActions(extracted) {
        let completed = 0;

        try {
            const pendingActions = this.storage.getActionItems('pending');
            if (pendingActions.length === 0) return 0;

            // Collect all text that might indicate completion
            const completionTexts = [];

            // Add facts
            for (const fact of extracted.facts || []) {
                const content = typeof fact === 'string' ? fact : (fact.content || fact.text);
                if (content) completionTexts.push(content);
            }

            // Add summary
            if (extracted.summary) {
                completionTexts.push(extracted.summary);
            }

            if (completionTexts.length === 0) return 0;

            // Completion keywords
            const completionKeywords = ['finished', 'completed', 'done', 'complete', 'finalizado', 'concluído', 'terminado', 'resolved', 'fixed'];

            // Check each pending action against completion texts
            for (const action of pendingActions) {
                const taskText = action.task?.toLowerCase() || '';
                if (taskText.length < 10) continue;

                // Extract key terms from task (words > 3 chars)
                const taskTerms = new Set(
                    taskText
                        .replace(/[^\w\s]/g, ' ')
                        .split(/\s+/)
                        .filter(w => w.length > 3)
                );

                // Look for matches in completion texts
                for (const text of completionTexts) {
                    const textLower = text.toLowerCase();

                    // Check if text contains completion keyword
                    const hasCompletionKeyword = completionKeywords.some(kw => textLower.includes(kw));
                    if (!hasCompletionKeyword) continue;

                    // Extract terms from text
                    const textTerms = new Set(
                        textLower
                            .replace(/[^\w\s]/g, ' ')
                            .split(/\s+/)
                            .filter(w => w.length > 3)
                    );

                    // Count matching terms
                    const matchingTerms = [...taskTerms].filter(t => textTerms.has(t));
                    const matchRatio = matchingTerms.length / Math.max(taskTerms.size, 1);

                    // If >40% of task terms found and completion keyword present, mark complete
                    if (matchRatio >= 0.4 && matchingTerms.length >= 2) {
                        this.storage.updateActionItem(action.id, {
                            status: 'completed',
                            completion_note: `[Auto-completed] ${text.substring(0, 200)}`
                        });
                        completed++;
                        console.log(`Action completed: "${action.task.substring(0, 50)}..." matched completion text`);
                        break; // Move to next action
                    }
                }
            }
        } catch (error) {
            console.error('Error checking action completions:', error.message);
        }

        return completed;
    }

    /**
     * Extract role names from text content
     * @param {string} text - Text to extract roles from
     * @returns {Array<string>} - Extracted role names
     */
    extractRolesFromText(text) {
        if (!text) return [];

        const roles = [];
        const textLower = text.toLowerCase();

        // Common role patterns to look for
        const rolePatterns = [
            // Technical roles
            /\b(senior\s+)?azure\s+(tech\s+)?lead\b/gi,
            /\b(senior\s+)?azure\s+developer\b/gi,
            /\b(senior\s+)?azure\s+architect\b/gi,
            /\bazure\s+tester\b/gi,
            /\b(senior\s+)?salesforce\s+(enterprise\s+)?lead\b/gi,
            /\b(senior\s+)?sf\s+(enterprise\s+)?lead\b/gi,
            /\bsalesforce\s+developer\b/gi,
            /\bsalesforce\s+architect\b/gi,
            /\bsap\s+(isu\s+)?developer\b/gi,
            /\bsap\s+(isu\s+)?consultant\b/gi,
            /\bsap\s+architect\b/gi,
            // Data roles
            /\bdata\s+migration\s+lead\b/gi,
            /\bdata\s+architect\b/gi,
            /\bdata\s+analyst\b/gi,
            /\bdata\s+steward\b/gi,
            /\bdata\s+engineer\b/gi,
            // Management roles
            /\bproject\s+manager\b/gi,
            /\bprogram\s+manager\b/gi,
            /\btech(nical)?\s+lead\b/gi,
            /\bteam\s+lead\b/gi,
            /\bscrum\s+master\b/gi,
            /\bproduct\s+owner\b/gi,
            // QA roles
            /\bqa\s+manager\b/gi,
            /\bq&a\s+test\s+manager\b/gi,
            /\btest\s+(manager|lead|engineer)\b/gi,
            // Integration roles
            /\bintegration\s+(architect|lead|developer)\b/gi,
            /\bapi\s+(architect|developer)\b/gi,
            // Business roles
            /\bbusiness\s+analyst\b/gi,
            /\bprocess\s+owner\b/gi,
            /\bstakeholder\b/gi,
        ];

        for (const pattern of rolePatterns) {
            const matches = text.match(pattern);
            if (matches) {
                for (const match of matches) {
                    // Normalize role name (title case)
                    const normalized = match.trim()
                        .split(/\s+/)
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .join(' ');
                    if (!roles.includes(normalized)) {
                        roles.push(normalized);
                    }
                }
            }
        }

        return roles;
    }

    /**
     * Assign questions to people based on topic matching
     * Uses improved role-to-topic mapping
     * @param {object} question - Question to assign
     * @param {Array} people - Available people from knowledge base
     * @returns {string|null} - Suggested assignee
     */
    suggestQuestionAssignee(question, people) {
        if (!question.content || people.length === 0) return null;

        const questionText = question.content.toLowerCase();
        const questionContext = (question.context || '').toLowerCase();
        const fullText = questionText + ' ' + questionContext;

        // PRIORITY 1: Check if a person's NAME is directly mentioned in the question
        // This is the strongest signal - if someone is mentioned by name, assign to them
        for (const person of people) {
            const name = (person.name || '').toLowerCase().trim();
            // Skip role-only entries (like "Data Migration Lead")
            if (!name || name.includes('lead') || name.includes('developer') ||
                name.includes('analyst') || name.includes('manager') || name.includes('tester')) {
                continue;
            }

            // Check for name mention (with word boundaries to avoid partial matches)
            const namePattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (namePattern.test(fullText)) {
                console.log(`Direct name match: ${person.name} found in question`);
                return person.name; // Return immediately - direct name mention is highest priority
            }
        }

        // PRIORITY 2: Role-to-keywords matching for role-based assignment
        const roleKeywords = {
            // SAP related
            'sap': ['sap', 'isu', 'is-u', 'billing', 'metering', 'idoc', 'bapi', 'abap'],
            // Salesforce related
            'salesforce': ['salesforce', 'sf', 'cpq', 'crm', 'apex', 'lightning', 'vlocity', 'e&u'],
            // Azure/Data related
            'azure': ['azure', 'adf', 'data factory', 'data lake', 'adls', 'blob', 'synapse'],
            'data': ['data', 'migration', 'etl', 'mapping', 'transformation', 'staging', 'extract'],
            // Architecture
            'architect': ['architecture', 'design', 'integration', 'api', 'interface', 'pattern'],
            // Testing
            'test': ['test', 'qa', 'quality', 'validation', 'verification', 'bug', 'defect'],
            // Management
            'manager': ['decision', 'budget', 'timeline', 'scope', 'priority', 'resource', 'approval'],
            'lead': ['lead', 'coordinate', 'team', 'delivery', 'sprint', 'planning'],
            // Business
            'analyst': ['requirement', 'process', 'business', 'user story', 'acceptance'],
            'steward': ['quality', 'governance', 'standards', 'compliance', 'audit']
        };

        // Score each person based on role-keyword match
        let bestMatch = null;
        let bestScore = 0;

        for (const person of people) {
            const role = (person.role || '').toLowerCase();
            const name = (person.name || '').toLowerCase();
            let score = 0;

            // Check each role category
            for (const [roleCategory, keywords] of Object.entries(roleKeywords)) {
                // Check if person's role matches this category
                if (role.includes(roleCategory) || name.includes(roleCategory)) {
                    // Count how many keywords from this category appear in the question
                    for (const keyword of keywords) {
                        if (fullText.includes(keyword)) {
                            score += 2; // Base score for keyword match
                            // Bonus if keyword is prominent (appears multiple times or in both content and context)
                            const count = (fullText.match(new RegExp(keyword, 'g')) || []).length;
                            if (count > 1) score += 1;
                        }
                    }
                }
            }

            // Direct role mention in question (strongest signal)
            if (role && fullText.includes(role)) {
                score += 10;
            }

            // Update best match
            if (score > bestScore) {
                bestScore = score;
                bestMatch = person.name;
            }
        }

        // Only return if we have a reasonable match (score >= 2)
        return bestScore >= 2 ? bestMatch : null;
    }

    /**
     * Check if a question is garbage/placeholder output from vision models
     * @param {string} content - Question content
     * @param {string} context - Question context
     * @returns {boolean} - True if garbage, should be filtered
     */
    isGarbageQuestion(content, context) {
        const contentLower = content.toLowerCase().trim();
        const contextLower = (context || '').toLowerCase().trim();

        // Garbage patterns in content - meta-questions about the document/image itself
        const garbageContentPatterns = [
            // Date/time meta-questions
            /^what is the current date/,
            /^what is today/,
            /^what date is/,
            /^when was this document/,
            /^when was this created/,
            // Document meta-questions
            /^what is the document/,
            /^what is this document/,
            /^who created this/,
            /^who wrote this/,
            /^what format is/,
            /^what type of file/,
            /^is this a pdf/,
            /^is this a slide/,
            /^what slide number/,
            /^which page/,
            // Purpose/understanding meta-questions (AI asking about the image)
            /^what is the purpose of this/,
            /^what is the purpose of the/,
            /^what does this (diagram|image|slide|chart|figure|table) (show|represent|mean)/,
            /^what is shown in/,
            /^what are the (main|key) (points|topics|elements)/,
            /^is there any additional (information|context|detail)/,
            /^are there any (other|additional|more)/,
            /^how does .* differ from/,
            /^how does .* compare to/,
            /^what is the (difference|relationship) between/,
            /^can you (explain|describe|clarify)/,
            /^why it needs answering$/,
            // Architecture/diagram meta-questions
            /architecture diagram/,
            /this scenario/,
            /this diagram/,
            /this image/,
            /this slide/,
            // Placeholder patterns
            /^question$/,
            /^actual question/,
            /^your question here/,
            /^insert question/,
            /^example question/,
            /^placeholder/,
            /^\?+$/  // Just question marks
        ];

        // Garbage patterns in context - generic AI-generated contexts
        const garbageContextPatterns = [
            /^why this matters$/,
            /^why needed$/,
            /^why it needs answering$/,
            /^context here$/,
            /^add context$/,
            /^placeholder$/,
            /^your context$/,
            /^why:?\s*$/,
            /^blocked:?\s*$/,
            /^reason:?\s*$/,
            // Generic understanding contexts
            /^to understand/,
            /^for understanding/,
            /^to clarify/,
            /^for clarification/,
            /^to (know|see|determine) (its|the|their)/,
            /^(comparison|compare) between/,
            /scope and structure/,
            /old and new/,
            /current (solutions?|systems?|situation)/,
            /^only a header/,
            /^no,? only/
        ];

        // Check content patterns
        for (const pattern of garbageContentPatterns) {
            if (pattern.test(contentLower)) {
                return true;
            }
        }

        // Check context patterns
        for (const pattern of garbageContextPatterns) {
            if (pattern.test(contextLower)) {
                return true;
            }
        }

        // Check if content is too generic (less than 15 chars or just a few words)
        if (contentLower.length < 15) {
            return true;
        }

        // Check if content is just repeating the schema example
        if (contentLower.includes('specific fact') ||
            contentLower.includes('actual question from image') ||
            contentLower.includes('factual statement')) {
            return true;
        }

        return false;
    }

    /**
     * Remove garbage questions from storage using the garbage filter
     * @returns {number} - Count of questions removed
     */
    cleanupGarbageQuestions() {
        const allQuestions = this.storage.getQuestions({});
        const garbageIds = [];

        for (const q of allQuestions) {
            if (this.isGarbageQuestion(q.content, q.context)) {
                console.log(`Garbage question found: "${q.content?.substring(0, 50)}..."`);
                garbageIds.push(q.id);
            }
        }

        if (garbageIds.length > 0) {
            const removed = this.storage.removeQuestions(garbageIds);
            console.log(`Removed ${removed} garbage questions`);
            return removed;
        }

        return 0;
    }

    /**
     * Check if a fact is garbage/low-value output from vision models
     * MINIMAL filtering - only remove AI thinking artifacts
     * Let the prompt produce quality facts directly
     * @param {string} content - Fact content
     * @returns {boolean} - True if garbage, should be filtered
     */
    isGarbageFact(content) {
        const contentLower = content.toLowerCase().trim();
        const contentClean = content.trim();

        // Empty or whitespace only
        if (contentClean.length < 3) {
            return true;
        }

        // AI thinking steps - qwen3 outputs these despite /no_think
        if (/^step\s*\d+/i.test(contentClean)) {
            return true;
        }
        if (/the problem involves/i.test(contentLower)) {
            return true;
        }
        if (/break down the text/i.test(contentLower)) {
            return true;
        }
        if (/constituent parts/i.test(contentLower)) {
            return true;
        }
        if (/the final answer is/i.test(contentLower)) {
            return true;
        }
        if (/analyze the structure/i.test(contentLower)) {
            return true;
        }

        // Table formatting artifacts
        if (/^[-|]+$/.test(contentClean.replace(/\s/g, ''))) {
            return true;
        }

        return false;
    }

    /**
     * Synthesize and consolidate knowledge base
     * Groups facts by category, uses reasoning model to merge/deduplicate
     * @param {string} reasoningModel - Model to use for synthesis
     * @param {function} progressCallback - Progress callback (progress, message)
     * @returns {object} - Synthesis results
     */
    async synthesizeKnowledge(reasoningModel, progressCallback = null) {
        const updateProgress = (progress, message) => {
            if (progressCallback) progressCallback(progress, message);
            console.log(`Synthesis ${progress}%: ${message}`);
        };

        updateProgress(0, 'Starting knowledge synthesis...');

        // Get all facts grouped by category
        const allFacts = this.storage.getFacts();
        if (allFacts.length === 0) {
            return { success: true, message: 'No facts to synthesize', stats: { before: 0, after: 0 } };
        }

        // Group facts by category
        const factsByCategory = {};
        for (const fact of allFacts) {
            const cat = fact.category || 'general';
            if (!factsByCategory[cat]) factsByCategory[cat] = [];
            factsByCategory[cat].push(fact);
        }

        const categories = Object.keys(factsByCategory);
        updateProgress(5, `Found ${allFacts.length} facts in ${categories.length} categories`);

        const synthesizedFacts = [];
        const removedCount = { garbage: 0, duplicates: 0, merged: 0 };
        let processedCategories = 0;

        for (const category of categories) {
            const categoryFacts = factsByCategory[category];
            const progress = 5 + Math.round((processedCategories / categories.length) * 85);
            updateProgress(progress, `Processing ${category} (${categoryFacts.length} facts)...`);

            // First pass: filter garbage using existing filter
            const cleanedFacts = categoryFacts.filter(f => {
                if (this.isGarbageFact(f.content)) {
                    removedCount.garbage++;
                    return false;
                }
                return true;
            });

            if (cleanedFacts.length === 0) {
                processedCategories++;
                continue;
            }

            // If category has few facts, keep them without model processing
            if (cleanedFacts.length <= 3) {
                synthesizedFacts.push(...cleanedFacts);
                processedCategories++;
                continue;
            }

            // Use reasoning model to consolidate larger categories
            try {
                const consolidated = await this.consolidateFactsWithModel(
                    reasoningModel,
                    category,
                    cleanedFacts
                );

                if (consolidated.success && consolidated.facts) {
                    // Track what was merged
                    const originalCount = cleanedFacts.length;
                    const newCount = consolidated.facts.length;
                    if (newCount < originalCount) {
                        removedCount.merged += (originalCount - newCount);
                    }
                    synthesizedFacts.push(...consolidated.facts);
                } else {
                    // Fallback: keep original cleaned facts
                    synthesizedFacts.push(...cleanedFacts);
                }
            } catch (err) {
                console.error(`Error consolidating ${category}:`, err);
                // Fallback: keep original cleaned facts
                synthesizedFacts.push(...cleanedFacts);
            }

            processedCategories++;
        }

        updateProgress(90, 'Cleaning up garbage questions...');

        // Also clean up garbage questions
        const questionsRemoved = this.cleanupGarbageQuestions();

        updateProgress(92, 'Updating knowledge base...');

        // Replace facts in storage
        const beforeCount = allFacts.length;
        this.storage.replaceFacts(synthesizedFacts);

        // Regenerate markdown and JSON files
        updateProgress(95, 'Regenerating documentation...');
        this.storage.regenerateMarkdown();
        this.storage.saveKnowledgeJSON();
        this.storage.invalidateRAGCache();

        updateProgress(100, 'Synthesis complete');

        return {
            success: true,
            stats: {
                before: beforeCount,
                after: synthesizedFacts.length,
                removed: {
                    garbage: removedCount.garbage,
                    merged: removedCount.merged,
                    total: beforeCount - synthesizedFacts.length,
                    questions: questionsRemoved
                },
                categories: categories.length
            }
        };
    }

    /**
     * Use reasoning model to consolidate facts within a category
     * @param {string} model - Reasoning model
     * @param {string} category - Category name
     * @param {array} facts - Array of fact objects
     * @returns {object} - { success, facts }
     */
    async consolidateFactsWithModel(model, category, facts) {
        // Prepare facts list for prompt
        const factsList = facts.map((f, i) => `${i + 1}. ${f.content}`).join('\n');

        // Limit to avoid context overflow - process in chunks if needed
        const MAX_FACTS = 50;
        if (facts.length > MAX_FACTS) {
            // Process in chunks and combine
            const chunks = [];
            for (let i = 0; i < facts.length; i += MAX_FACTS) {
                chunks.push(facts.slice(i, i + MAX_FACTS));
            }

            const allConsolidated = [];
            for (const chunk of chunks) {
                const result = await this.consolidateFactsWithModel(model, category, chunk);
                if (result.success && result.facts) {
                    allConsolidated.push(...result.facts);
                } else {
                    allConsolidated.push(...chunk);
                }
            }

            // If we still have many, do a final pass
            if (allConsolidated.length > MAX_FACTS) {
                return this.consolidateFactsWithModel(model, category, allConsolidated.slice(0, MAX_FACTS));
            }

            return { success: true, facts: allConsolidated };
        }

        const prompt = `You are a knowledge preservation assistant. Review these facts from the "${category}" category.

CRITICAL: Your job is to PRESERVE detail, NOT summarize. Only remove EXACT duplicates (95%+ identical).

Rules:
1. KEEP all facts that contain unique data (numbers, names, specific details)
2. KEEP all facts from tables - each row/value should remain separate
3. ONLY remove if two facts say EXACTLY the same thing with different words
4. DO NOT merge facts - if fact A has detail X and fact B has detail Y, keep BOTH
5. DO NOT remove facts just because they seem "low value" - all extracted data matters

Facts to review:
${factsList}

Return ONLY a JSON array. Each fact should be an object with:
- "content": the fact text (PRESERVE original wording)
- "confidence": "high", "medium", or "low"

IMPORTANT: When in doubt, KEEP the fact. Return ONLY valid JSON array.`;

        const response = await this.llmGenerateText(model, prompt, { temperature: 0.1 });

        if (!response.success) {
            return { success: false, error: response.error };
        }

        try {
            // Extract JSON from response
            const text = response.response.trim();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }

            // Convert to fact format with original metadata
            // Map string confidence to numeric (0.0-1.0)
            const confidenceMap = { 'high': 0.9, 'medium': 0.7, 'low': 0.5 };

            const consolidatedFacts = parsed.map((item, idx) => {
                // Handle both string and numeric confidence values
                let numericConfidence = 0.7; // default medium
                if (typeof item.confidence === 'string') {
                    numericConfidence = confidenceMap[item.confidence.toLowerCase()] || 0.7;
                } else if (typeof item.confidence === 'number') {
                    numericConfidence = item.confidence;
                }

                return {
                    id: `synth_${category}_${Date.now()}_${idx}`,
                    content: item.content,
                    category: category,
                    confidence: numericConfidence,
                    source_file: 'synthesized',
                    extracted_at: new Date().toISOString()
                };
            });

            return { success: true, facts: consolidatedFacts };
        } catch (parseErr) {
            console.error(`Failed to parse synthesis response for ${category}:`, parseErr);
            return { success: false, error: parseErr.message };
        }
    }

    /**
     * Process all pending files
     */
    async processAll(textModel, visionModel = null) {
        this.processingState = {
            status: 'processing',
            progress: 0,
            currentFile: null,
            message: 'Starting processing...',
            errors: [],
            totalFiles: 0,
            processedFiles: 0,
            startTime: Date.now(),
            estimatedTimeRemaining: null,
            currentPhase: 'processing',
            filesTiming: []
        };

        // Store models for use in processFile
        this.textModel = textModel;
        this.visionModel = visionModel;

        const pending = this.scanPendingFiles();
        const allFiles = [
            ...pending.newinfo.map(f => ({ ...f, type: 'document' })),
            ...pending.newtranscripts.map(f => ({ ...f, type: 'transcript' }))
        ];

        if (allFiles.length === 0) {
            this.processingState.status = 'idle';
            this.processingState.message = 'No files to process';
            return { processed: 0, errors: [] };
        }

        const results = {
            processed: 0,
            totalFacts: 0,
            totalQuestions: 0,
            totalDecisions: 0,
            errors: []
        };

        // Initialize enhanced tracking
        this.processingState.totalFiles = allFiles.length;
        this.processingState.processedFiles = 0;
        this.processingState.startTime = Date.now();
        this.processingState.currentPhase = 'processing';

        for (let i = 0; i < allFiles.length; i++) {
            const file = allFiles[i];
            const fileStartTime = Date.now();
            
            this.processingState.progress = Math.round((i / allFiles.length) * 100);
            this.processingState.processedFiles = i;
            this.processingState.message = `Processing ${file.name} (${i + 1}/${allFiles.length})`;
            this.updateTimeEstimate(i, allFiles.length);

            const isTranscript = file.type === 'transcript';
            const result = await this.processFile(file.path, textModel, visionModel, isTranscript);
            
            // Track timing for better estimates
            this.processingState.filesTiming.push(Date.now() - fileStartTime);

            const fileDuration = Date.now() - fileStartTime;
            
            if (result.success) {
                results.processed++;
                results.totalFacts += result.facts;
                results.totalQuestions += result.questions;
                results.totalDecisions += result.decisions;
                
                // Log individual file processing to history
                if (this.storage.logFileProcessing) {
                    this.storage.logFileProcessing(result, {
                        filename: file.name,
                        title: result.title || file.name,
                        model: textModel,
                        duration_ms: fileDuration,
                        document_id: result.document_id || null
                    });
                }
            } else {
                results.errors.push({ file: file.name, error: result.error });
            }
        }

        // Log batch processing session
        if (this.storage.logProcessing) {
            this.storage.logProcessing('batch_process', {
                files_processed: results.processed,
                questions_added: results.totalQuestions,
                facts_extracted: results.totalFacts,
                decisions_extracted: results.totalDecisions || 0,
                model: textModel,
                extra: { errors: results.errors.length }
            });
        }

        // Auto-synthesize knowledge after processing (consolidate and clean up facts)
        if (results.totalFacts > 0) {
            this.processingState.message = 'Synthesizing knowledge...';
            this.processingState.progress = 95;

            try {
                const reasoningModel = this.config.ollama?.reasoningModel || this.config.ollama?.model || textModel;
                console.log(`Auto-synthesizing knowledge with ${reasoningModel}...`);

                const synthResult = await this.synthesizeKnowledge(reasoningModel);

                if (synthResult.success && synthResult.stats) {
                    const removed = synthResult.stats.removed || {};
                    console.log(`Synthesis complete: ${synthResult.stats.before} -> ${synthResult.stats.after} facts (removed ${removed.total || 0})`);
                    results.synthesis = synthResult.stats;
                }
            } catch (synthError) {
                console.error('Auto-synthesis failed:', synthError.message);
                // Don't fail the whole processing if synthesis fails
            }
        }

        // Unload models from GPU/RAM to free memory after processing
        this.processingState.message = 'Unloading models...';
        try {
            const modelsToUnload = new Set();
            if (textModel) modelsToUnload.add(textModel);
            if (visionModel) modelsToUnload.add(visionModel);

            // Also unload reasoning model if different
            const reasoningModel = this.config.ollama?.reasoningModel;
            if (reasoningModel && reasoningModel !== textModel) {
                modelsToUnload.add(reasoningModel);
            }

            if (modelsToUnload.size > 0) {
                const unloadResult = await this.ollama.unloadModels([...modelsToUnload]);
                if (unloadResult.unloaded.length > 0) {
                    console.log(`Models unloaded: ${unloadResult.unloaded.join(', ')}`);
                }
                results.modelsUnloaded = unloadResult.unloaded;
            }
        } catch (unloadError) {
            console.error('Model unload failed:', unloadError.message);
            // Don't fail processing if unload fails
        }

        this.processingState = {
            status: 'complete',
            progress: 100,
            currentFile: null,
            message: `Processed ${results.processed} files`,
            errors: results.errors,
            totalFiles: this.processingState.totalFiles,
            processedFiles: this.processingState.totalFiles,
            startTime: this.processingState.startTime,
            estimatedTimeRemaining: 0,
            currentPhase: 'complete',
            filesTiming: this.processingState.filesTiming || []
        };

        return results;
    }

    /**
     * Generate knowledge base markdown from stored data
     */
    generateKnowledgeBase() {
        const facts = this.storage.getFacts();
        const decisions = this.storage.getDecisions();
        const stats = this.storage.getStats();

        const categories = {};
        for (const fact of facts) {
            const cat = fact.category || 'general';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(fact);
        }

        let md = `# Knowledge Base\n\n`;
        md += `**Last Updated:** ${new Date().toISOString().split('T')[0]}\n\n`;
        md += `## Statistics\n\n`;
        md += `- Documents Processed: ${stats.documents.processed}\n`;
        md += `- Facts Extracted: ${stats.facts}\n`;
        md += `- Pending Questions: ${stats.questions.pending}\n`;
        md += `- Decisions Logged: ${stats.decisions}\n\n`;

        md += `---\n\n## Facts by Category\n\n`;
        for (const [category, items] of Object.entries(categories)) {
            md += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
            for (const fact of items) {
                md += `- ${fact.content}\n`;
            }
            md += '\n';
        }

        md += `---\n\n## Decisions Log\n\n`;
        md += `| Date | Decision | Owner | Category |\n`;
        md += `|------|----------|-------|----------|\n`;
        for (const decision of decisions) {
            md += `| ${decision.decision_date || 'N/A'} | ${decision.content} | ${decision.owner || 'N/A'} | ${decision.category || 'N/A'} |\n`;
        }

        return md;
    }

    /**
     * Generate pending questions markdown
     */
    generateQuestionsMarkdown() {
        const questions = this.storage.getQuestions({ status: 'pending' });

        const byPriority = {
            critical: questions.filter(q => q.priority === 'critical'),
            high: questions.filter(q => q.priority === 'high'),
            medium: questions.filter(q => q.priority === 'medium')
        };

        let md = `# Pending Questions\n\n`;
        md += `**Last Updated:** ${new Date().toISOString().split('T')[0]}\n\n`;

        for (const [priority, items] of Object.entries(byPriority)) {
            if (items.length === 0) continue;
            md += `## ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`;
            for (const q of items) {
                md += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                if (q.context) md += `  - Context: ${q.context}\n`;
                if (q.assigned_to) md += `  - Assigned: ${q.assigned_to}\n`;
            }
            md += '\n';
        }

        return md;
    }

    /**
     * Generate SOURCE_OF_TRUTH formatted markdown (comprehensive knowledge base)
     */
    async generateSourceOfTruth() {
        const facts = this.storage.getFacts();
        const decisions = this.storage.getDecisions();
        const risks = this.storage.getRisks();
        const actions = this.storage.getActionItems();
        const people = this.storage.getPeople();
        const questionsByPerson = this.storage.getQuestionsByPerson();
        const stats = this.storage.getStats();

        const today = new Date().toISOString().split('T')[0];

        let md = `# SOURCE OF TRUTH\n\n`;
        md += `**Last Updated:** ${today}\n\n`;
        md += `---\n\n`;

        // Section 1: Overview / Statistics
        md += `## 1. Overview\n\n`;
        
        // Get additional stats
        let emailCount = 0;
        let emailsNeedingResponse = 0;
        let conversationCount = 0;
        let contactCount = 0;
        let allEmails = [];
        let allConversations = [];
        let allContacts = [];
        
        try {
            allEmails = this.storage.getEmails ? await this.storage.getEmails({ limit: 1000 }) : [];
            emailCount = allEmails.length;
            emailsNeedingResponse = allEmails.filter(e => e.requires_response && !e.response_sent).length;
        } catch (e) { console.warn('[SOT] Could not get emails:', e.message); }
        
        try {
            allConversations = this.storage.getConversations ? await this.storage.getConversations() : [];
            conversationCount = allConversations.length;
        } catch (e) { console.warn('[SOT] Could not get conversations:', e.message); }
        
        try {
            allContacts = this.storage.getContacts ? await this.storage.getContacts() : [];
            contactCount = allContacts.length;
        } catch (e) { console.warn('[SOT] Could not get contacts:', e.message); }
        
        // Get proper counts with fallbacks
        const docCount = stats.documents || stats.documentsProcessed || 0;
        const factCount = stats.facts || 0;
        const questionCount = stats.questions || 0;
        const openQuestionCount = stats.openQuestions || 0;
        const decisionCount = stats.decisions || 0;
        const openRiskCount = stats.openRisks || risks.filter(r => r.status === 'open').length;
        const pendingActionCount = stats.pendingActions || actions.filter(a => a.status === 'pending').length;
        const peopleCount = stats.people || people.length || 0;
        
        md += `| Metric | Count |\n`;
        md += `|--------|-------|\n`;
        md += `| 📄 Documents Processed | ${docCount} |\n`;
        md += `| 💡 Facts Extracted | ${factCount} |\n`;
        md += `| ❓ Open Questions | ${openQuestionCount} |\n`;
        md += `| 📋 Decisions Logged | ${decisionCount} |\n`;
        md += `| ⚠️ Open Risks | ${openRiskCount} |\n`;
        md += `| ✅ Pending Actions | ${pendingActionCount} |\n`;
        md += `| 👤 People Identified | ${peopleCount} |\n`;
        md += `| 📧 Emails | ${emailCount} |\n`;
        md += `| 🔔 Emails Needing Response | ${emailsNeedingResponse} |\n`;
        md += `| 💬 Conversations | ${conversationCount} |\n`;
        md += `| 👥 Contacts | ${contactCount} |\n\n`;

        // Section 2: Facts by Category
        md += `---\n\n## 2. Knowledge Base (Facts)\n\n`;
        const categories = {};
        for (const fact of facts) {
            const cat = fact.category || 'general';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(fact);
        }

        for (const [category, items] of Object.entries(categories)) {
            md += `### 2.${Object.keys(categories).indexOf(category) + 1} ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
            for (const fact of items) {
                md += `- ${fact.content}\n`;
            }
            md += '\n';
        }

        // Section 3: Decisions Log
        md += `---\n\n## 3. Decisions Log\n\n`;
        if (decisions && decisions.length > 0) {
            md += `| Date | Decision | Owner | Category |\n`;
            md += `|------|----------|-------|----------|\n`;
            for (const decision of decisions) {
                const decDate = decision.decision_date || decision.created_at;
                const dateStr = decDate ? new Date(decDate).toLocaleDateString() : '-';
                const ownerStr = decision.owner || decision.decided_by || '-';
                const catStr = decision.category || '-';
                md += `| ${dateStr} | ${decision.content || decision.description || '-'} | ${ownerStr} | ${catStr} |\n`;
            }
        } else {
            md += `*No decisions logged yet.*\n`;
        }
        md += '\n';

        // Section 4: Pending Questions by Person
        md += `---\n\n## 4. Pending Questions (by Person)\n\n`;
        for (const [person, questions] of Object.entries(questionsByPerson)) {
            md += `### ${person}\n\n`;
            const critical = questions.filter(q => q.priority === 'critical');
            const high = questions.filter(q => q.priority === 'high');
            const medium = questions.filter(q => q.priority === 'medium');

            if (critical.length > 0) {
                md += `**Critical:**\n`;
                for (const q of critical) {
                    md += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                    if (q.context) md += `  - Context: ${q.context}\n`;
                }
                md += '\n';
            }

            if (high.length > 0) {
                md += `**High:**\n`;
                for (const q of high) {
                    md += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                    if (q.context) md += `  - Context: ${q.context}\n`;
                }
                md += '\n';
            }

            if (medium.length > 0) {
                md += `**Medium:**\n`;
                for (const q of medium) {
                    md += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                    if (q.context) md += `  - Context: ${q.context}\n`;
                }
                md += '\n';
            }
        }

        // Section 5: Risk Register
        md += `---\n\n## 5. Risk Register\n\n`;
        if (risks && risks.length > 0) {
            md += `| Risk | Impact | Likelihood | Mitigation | Status |\n`;
            md += `|------|--------|------------|------------|--------|\n`;
            for (const risk of risks) {
                const impactStr = risk.impact || '-';
                const likelihoodStr = risk.likelihood || '-';
                const mitigationStr = risk.mitigation || '-';
                const statusStr = risk.status || 'open';
                md += `| ${risk.content || risk.description || '-'} | ${impactStr} | ${likelihoodStr} | ${mitigationStr} | ${statusStr} |\n`;
            }
        } else {
            md += `*No risks identified yet.*\n`;
        }
        md += '\n';

        // Section 6: Action Items
        md += `---\n\n## 6. Action Items\n\n`;
        if (actions && actions.length > 0) {
            md += `| Task | Owner | Deadline | Status |\n`;
            md += `|------|-------|----------|--------|\n`;
            for (const action of actions) {
                const taskStr = action.task || action.content || action.description || '-';
                const ownerStr = action.owner || action.assignee || '-';
                const deadlineDate = action.deadline || action.due_date;
                const deadlineStr = deadlineDate ? new Date(deadlineDate).toLocaleDateString() : '-';
                const statusStr = action.status || 'pending';
                md += `| ${taskStr} | ${ownerStr} | ${deadlineStr} | ${statusStr} |\n`;
            }
        } else {
            md += `*No action items yet.*\n`;
        }
        md += '\n';

        // Section 7: Key People (from Knowledge Base)
        md += `---\n\n## 7. Key People\n\n`;
        if (people && people.length > 0) {
            md += `| Name | Role | Organization |\n`;
            md += `|------|------|-------------|\n`;
            for (const person of people) {
                const nameStr = person.name || 'Unknown';
                const roleStr = person.role || person.title || person.position || '-';
                const orgStr = person.organization || person.company || person.org || '-';
                md += `| ${nameStr} | ${roleStr} | ${orgStr} |\n`;
            }
        } else {
            md += `*No key people identified yet.*\n`;
        }
        md += '\n';

        // Section 8: Email Communications
        if (allEmails && allEmails.length > 0) {
            md += `---\n\n## 8. Email Communications\n\n`;
            
            const needsResponse = allEmails.filter(e => e.requires_response && !e.response_sent);
            const inbound = allEmails.filter(e => e.direction === 'inbound');
            const outbound = allEmails.filter(e => e.direction === 'outbound');
            
            md += `| Metric | Count |\n`;
            md += `|--------|-------|\n`;
            md += `| Total Emails | ${allEmails.length} |\n`;
            md += `| Inbound | ${inbound.length} |\n`;
            md += `| Outbound | ${outbound.length} |\n`;
            md += `| Needs Response | ${needsResponse.length} |\n\n`;
            
            if (needsResponse.length > 0) {
                md += `### 8.1 Emails Requiring Response\n\n`;
                md += `| Date | From | Subject | Intent |\n`;
                md += `|------|------|---------|--------|\n`;
                for (const email of needsResponse.slice(0, 10)) {
                    const emailDate = email.received_at || email.created_at || email.email_date;
                    const dateStr = emailDate ? new Date(emailDate).toLocaleDateString() : '-';
                    const fromStr = email.from_name || email.from_email || 'Unknown sender';
                    const subjectStr = (email.subject || '(no subject)').substring(0, 50);
                    const intentStr = email.intent || email.ai_intent || '-';
                    md += `| ${dateStr} | ${fromStr} | ${subjectStr} | ${intentStr} |\n`;
                }
                md += '\n';
            }
            
            // Recent emails summary
            md += `### 8.2 Recent Communications\n\n`;
            for (const email of allEmails.slice(0, 5)) {
                const emailDate = email.received_at || email.created_at || email.email_date;
                const dateStr = emailDate ? new Date(emailDate).toLocaleDateString() : '';
                const direction = email.direction === 'inbound' ? '📥' : '📤';
                const fromStr = email.from_name || email.from_email || 'Unknown';
                const subjectStr = email.subject || '(no subject)';
                md += `- ${direction} **${subjectStr}** - ${fromStr}${dateStr ? ` (${dateStr})` : ''}\n`;
                if (email.ai_summary) {
                    const summary = email.ai_summary.length > 150 ? email.ai_summary.substring(0, 150) + '...' : email.ai_summary;
                    md += `  - ${summary}\n`;
                }
            }
            md += '\n';
        }

        // Section 9: Conversations
        if (allConversations && allConversations.length > 0) {
            md += `---\n\n## 9. Conversations\n\n`;
            md += `| Platform | Title | Participants | Date |\n`;
            md += `|----------|-------|--------------|------|\n`;
            for (const conv of allConversations.slice(0, 10)) {
                const convDate = conv.created_at || conv.conversation_date;
                const dateStr = convDate ? new Date(convDate).toLocaleDateString() : '-';
                const titleStr = (conv.title || conv.ai_title || 'Untitled conversation').substring(0, 40);
                const platformStr = conv.platform || conv.source || '-';
                const participantCount = conv.participants?.length || conv.participant_count || 0;
                md += `| ${platformStr} | ${titleStr} | ${participantCount} | ${dateStr} |\n`;
            }
            md += '\n';
        }

        // Section 10: Contact Directory (merge with knowledge base for roles)
        if (allContacts && allContacts.length > 0) {
            md += `---\n\n## 10. Contact Directory\n\n`;
            md += `| Name | Role | Organization | Email |\n`;
            md += `|------|------|--------------|-------|\n`;
            
            // Build lookup from people by name (case insensitive)
            const peopleByName = {};
            for (const person of people) {
                if (person.name) {
                    peopleByName[person.name.toLowerCase()] = person;
                    // Also map first name only
                    const firstName = person.name.split(' ')[0].toLowerCase();
                    if (!peopleByName[firstName]) {
                        peopleByName[firstName] = person;
                    }
                }
            }
            
            for (const contact of allContacts.slice(0, 20)) {
                const nameStr = contact.name || contact.full_name || 'Unknown';
                
                // Try to find matching person from knowledge base
                const matchedPerson = peopleByName[nameStr.toLowerCase()] || 
                                      peopleByName[nameStr.split(' ')[0].toLowerCase()];
                
                // Merge data: prefer contact data, fall back to person data
                const roleStr = contact.role || contact.job_title || contact.title || 
                               matchedPerson?.role || matchedPerson?.title || '-';
                const orgStr = contact.organization || contact.company || contact.org ||
                              matchedPerson?.organization || matchedPerson?.company || '-';
                const emailStr = contact.email || contact.primary_email || '-';
                
                md += `| ${nameStr} | ${roleStr} | ${orgStr} | ${emailStr} |\n`;
            }
            md += '\n';
        }

        md += `---\n\n*Generated: ${new Date().toISOString()}*\n`;

        return md;
    }

    /**
     * Reprocess a single document using the same AI processing as upload
     * This is the unified method that should be called by the reprocess endpoint
     * @param {string} docId - Document ID to reprocess
     * @returns {Promise<object>} - Processing result
     */
    async reprocessDocument(docId) {
        console.log(`[Processor] Starting reprocess for document: ${docId}`);
        
        try {
            // 1. Get document from database
            const { data: doc, error: fetchError } = await this.storage._supabase.supabase
                .from('documents')
                .select('*')
                .eq('id', docId)
                .single();
            
            if (fetchError || !doc) {
                throw new Error(`Document not found: ${docId}`);
            }
            
            // 2. Update status to processing
            await this.storage._supabase.supabase
                .from('documents')
                .update({ status: 'processing' })
                .eq('id', docId);
            
            // 3. Read content from file
            let content = doc.content;
            if (!content && doc.content_path) {
                const fs = require('fs');
                if (fs.existsSync(doc.content_path)) {
                    content = fs.readFileSync(doc.content_path, 'utf-8');
                }
            }
            
            // Try content folder as fallback
            if (!content) {
                const fs = require('fs');
                const path = require('path');
                const baseName = doc.filename.replace(/\.[^/.]+$/, '');
                const possiblePaths = [
                    path.join(this.config.dataDir, 'content', `${baseName}.md`),
                    path.join(this.config.dataDir, 'content', doc.filename.replace(/\.[^/.]+$/, '.md'))
                ];
                
                for (const p of possiblePaths) {
                    if (fs.existsSync(p)) {
                        content = fs.readFileSync(p, 'utf-8');
                        console.log(`[Processor] Read content from: ${p}`);
                        break;
                    }
                }
            }
            
            if (!content || content.length < 50) {
                throw new Error('No content available for reprocessing');
            }
            
            // 4. Deactivate existing entities for this document
            await this.storage._supabase.supabase
                .from('facts')
                .update({ is_active: false })
                .eq('source_document_id', docId);
            await this.storage._supabase.supabase
                .from('decisions')
                .update({ is_active: false })
                .eq('source_document_id', docId);
            await this.storage._supabase.supabase
                .from('risks')
                .update({ is_active: false })
                .eq('source_document_id', docId);
            await this.storage._supabase.supabase
                .from('action_items')
                .update({ is_active: false })
                .eq('source_document_id', docId);
            
            // 5. Create AI processor with same config as upload
            const { getAIContentProcessor } = require('./ai');
            const graphProvider = this.storage.getGraphProvider();
            const aiProcessor = getAIContentProcessor({
                llmProvider: this.getLLMProvider(),
                llmModel: this.config.llm?.perTask?.text?.model || this.config.llm?.models?.text,
                llmConfig: this.config.llm,
                enrichForGraph: graphProvider && graphProvider.connected,
                storage: this.storage
            });
            
            // 6. Process with AI (same as upload flow)
            const isTranscript = doc.doc_type === 'transcript' || doc.filename?.includes('transcript');
            console.log(`[Processor] AI analyzing: ${doc.filename} (${isTranscript ? 'transcript' : 'document'})`);
            
            let aiResult;
            if (isTranscript) {
                aiResult = await aiProcessor.processTranscript({
                    title: doc.filename,
                    content: content,
                    date: doc.document_date || new Date().toISOString(),
                    projectId: doc.project_id,
                    documentId: docId
                });
            } else {
                aiResult = await aiProcessor.processDocument({
                    id: docId,
                    title: doc.filename,
                    content: content,
                    type: doc.doc_type || 'document',
                    projectId: doc.project_id
                });
            }
            
            // 7. Save extracted entities (same as upload flow)
            for (const participant of aiResult.participants || []) {
                if (participant.name && participant.name.length > 2) {
                    this.storage.addPerson({
                        name: participant.name,
                        role: participant.role || null,
                        organization: participant.organization || null,
                        source_file: doc.filename,
                        first_seen_in: doc.filename
                    });
                }
            }
            
            for (const decision of aiResult.decisions || []) {
                if (decision.content && decision.content.length > 10) {
                    this.storage.addDecision({
                        content: decision.content,
                        owner: decision.owner || null,
                        date: decision.date || new Date().toISOString().split('T')[0],
                        status: 'active',
                        source: `document:${doc.filename}`,
                        source_document_id: docId
                    });
                }
            }
            
            for (const action of aiResult.actionItems || []) {
                if (action.task && action.task.length > 5) {
                    this.storage.addActionItem({
                        task: action.task,
                        owner: action.owner || action.assignee || null,
                        deadline: action.deadline || null,
                        status: 'pending',
                        source: `document:${doc.filename}`,
                        source_document_id: docId
                    });
                }
            }
            
            // 8. Update document with results
            const factsCount = aiResult.facts?.length || 0;
            const decisionsCount = aiResult.decisions?.length || 0;
            const risksCount = aiResult.risks?.length || 0;
            const actionsCount = aiResult.actionItems?.length || 0;
            const questionsCount = aiResult.questions?.length || 0;
            const totalEntities = factsCount + decisionsCount + risksCount + actionsCount + questionsCount;
            
            const contentHash = require('crypto').createHash('md5').update(content).digest('hex');
            
            await this.storage._supabase.supabase
                .from('documents')
                .update({
                    status: 'processed',
                    processed_at: new Date().toISOString(),
                    content: content,
                    content_hash: contentHash,
                    summary: aiResult.summary || doc.summary,
                    extraction_result: aiResult,
                    facts_count: factsCount,
                    decisions_count: decisionsCount,
                    risks_count: risksCount,
                    actions_count: actionsCount,
                    questions_count: questionsCount
                })
                .eq('id', docId);
            
            // 9. Log to ai_analysis_log (use only columns that exist in the table)
            // The extraction_result is already saved in the documents table
            const { error: logError } = await this.storage._supabase.supabase
                .from('ai_analysis_log')
                .insert({
                    project_id: doc.project_id,
                    document_id: docId,
                    analysis_type: 'extraction',
                    provider: aiProcessor.llmProvider || 'unknown',
                    model: aiProcessor.llmModel || 'unknown',
                    input_tokens: aiResult.usage?.inputTokens || 0,
                    output_tokens: aiResult.usage?.outputTokens || 0,
                    entities_extracted: totalEntities
                    // Note: result and latency_ms columns don't exist in the table
                    // The full extraction_result is stored in documents.extraction_result
                });
            
            if (logError) {
                console.error(`[Processor] ai_analysis_log insert failed:`, logError.message);
            } else {
                console.log(`[Processor] ai_analysis_log saved (${totalEntities} entities, ${aiResult.usage?.inputTokens || 0}/${aiResult.usage?.outputTokens || 0} tokens)`);
            }
            
            console.log(`[Processor] Reprocess complete for ${doc.filename}: ${totalEntities} entities extracted`);
            
            return {
                success: true,
                document_id: docId,
                filename: doc.filename,
                entities: totalEntities,
                facts: factsCount,
                decisions: decisionsCount,
                risks: risksCount,
                actions: actionsCount,
                questions: questionsCount
            };
            
        } catch (error) {
            console.error(`[Processor] Reprocess error for ${docId}:`, error.message);
            
            // Update status to failed
            await this.storage._supabase.supabase
                .from('documents')
                .update({ 
                    status: 'failed',
                    error_message: error.message
                })
                .eq('id', docId);
            
            return {
                success: false,
                document_id: docId,
                error: error.message
            };
        }
    }
}

module.exports = DocumentProcessor;
