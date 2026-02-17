/**
 * Purpose:
 *   Extracts a single person's speaking turns ("interventions") from meeting
 *   transcripts, preserving surrounding context, so the TeamAnalyzer can
 *   send only relevant content to the LLM instead of entire transcripts.
 *
 * Responsibilities:
 *   - Parse transcript lines to detect speaker changes across multiple formats
 *     (Krisp "**Name | HH:MM**", "Name: text", "[timestamp] Name:", Markdown, etc.)
 *   - Match speakers to the target person using fuzzy name variants and aliases
 *   - Capture preceding context (last 2 non-target statements) for each intervention
 *   - Format interventions for LLM prompts with token-budget awareness
 *   - Cache extraction results to `transcript_interventions` table in Supabase
 *   - Batch-extract across all transcripts for a person with cache-first strategy
 *
 * Key dependencies:
 *   - Supabase client (injected): Caching extracted interventions per person/document
 *
 * Side effects:
 *   - Reads/writes `transcript_interventions` table for caching
 *
 * Notes:
 *   - Minimum meaningful intervention is 10 characters; shorter turns are dropped
 *   - formatForPrompt() sorts by word count (longest first) then re-sorts by
 *     timeline order to maximise information within the token budget while
 *     maintaining chronological coherence
 *   - Token estimation uses 1 token ~= 4 characters (rough heuristic)
 *   - generateNameVariants() produces lowercase full name, first name, last name,
 *     and concatenated-no-space variants for matching
 */

class InterventionExtractor {
    constructor(options = {}) {
        this.supabase = options.supabase;
    }

    /**
     * Extract interventions for a specific person from a transcript
     * @param {string} content - Transcript content
     * @param {string} personName - Name of the person to extract
     * @param {string} filename - Source filename
     * @param {string[]} aliases - Alternative names/aliases for the person
     * @returns {Object} Extracted interventions
     */
    extractInterventions(content, personName, filename, aliases = []) {
        const interventions = [];
        // Generate variants from main name and all aliases
        let nameVariants = this.generateNameVariants(personName);
        for (const alias of aliases) {
            if (alias && alias.trim()) {
                nameVariants = [...nameVariants, ...this.generateNameVariants(alias.trim())];
            }
        }
        // Remove duplicates
        nameVariants = [...new Set(nameVariants)];
        
        // Split transcript into lines
        const lines = content.split('\n');
        let currentSpeaker = null;
        let currentText = [];
        let currentTimestamp = null;
        let previousContext = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Detect speaker change patterns
            const speakerMatch = this.detectSpeaker(line);
            
            if (speakerMatch) {
                // Save previous intervention if it was from our target person
                if (currentSpeaker && this.isTargetPerson(currentSpeaker, nameVariants) && currentText.length > 0) {
                    const text = currentText.join(' ').trim();
                    if (text.length > 10) { // Minimum meaningful intervention
                        interventions.push({
                            timestamp: currentTimestamp,
                            speaker: currentSpeaker,
                            text: text,
                            context: previousContext.slice(-2).join(' '), // Last 2 statements as context
                            wordCount: text.split(/\s+/).length,
                            lineNumber: i - currentText.length
                        });
                    }
                }
                
                // Update context with previous speaker's content
                if (currentSpeaker && currentText.length > 0 && !this.isTargetPerson(currentSpeaker, nameVariants)) {
                    previousContext.push(`${currentSpeaker}: ${currentText.join(' ').substring(0, 200)}`);
                    if (previousContext.length > 3) previousContext.shift();
                }
                
                // Start new speaker
                currentSpeaker = speakerMatch.speaker;
                currentTimestamp = speakerMatch.timestamp || currentTimestamp;
                currentText = [];
                
                // If there's text on the same line as speaker
                if (speakerMatch.text) {
                    currentText.push(speakerMatch.text);
                }
            } else if (currentSpeaker) {
                // Continue current speaker's text
                currentText.push(line);
            }
        }
        
        // Don't forget the last intervention
        if (currentSpeaker && this.isTargetPerson(currentSpeaker, nameVariants) && currentText.length > 0) {
            const text = currentText.join(' ').trim();
            if (text.length > 10) {
                interventions.push({
                    timestamp: currentTimestamp,
                    speaker: currentSpeaker,
                    text: text,
                    context: previousContext.slice(-2).join(' '),
                    wordCount: text.split(/\s+/).length,
                    lineNumber: lines.length - currentText.length
                });
            }
        }
        
        // Calculate stats
        const totalWordCount = interventions.reduce((sum, i) => sum + i.wordCount, 0);
        
        return {
            personName,
            filename,
            interventions,
            totalWordCount,
            interventionCount: interventions.length,
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Detect speaker from a line
     * Supports various transcript formats
     */
    detectSpeaker(line) {
        // Format: "**Speaker Name | HH:MM**" or "**Speaker Name | HH:MM:SS**" (Krisp format)
        const krispMatch = line.match(/^\*\*(.+?)\s*\|\s*(\d{1,2}:\d{2}(?::\d{2})?)\*\*\s*$/);
        if (krispMatch) {
            return {
                speaker: krispMatch[1].trim(),
                text: null, // Text is on the next line
                timestamp: krispMatch[2]
            };
        }
        
        // Format: "Speaker Name | HH:MM" without asterisks
        const pipeMatch = line.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\.]+?)\s*\|\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*$/);
        if (pipeMatch) {
            return {
                speaker: pipeMatch[1].trim(),
                text: null,
                timestamp: pipeMatch[2]
            };
        }
        
        // Format: "Speaker Name: text" or "Speaker Name - text"
        const colonMatch = line.match(/^([A-Z][a-zA-Z\s\.]+?):\s*(.*)$/);
        if (colonMatch) {
            return {
                speaker: colonMatch[1].trim(),
                text: colonMatch[2].trim() || null,
                timestamp: null
            };
        }
        
        // Format: "[00:00:00] Speaker Name: text"
        const timestampMatch = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([A-Z][a-zA-Z\s\.]+?):\s*(.*)$/);
        if (timestampMatch) {
            return {
                speaker: timestampMatch[2].trim(),
                text: timestampMatch[3].trim() || null,
                timestamp: timestampMatch[1]
            };
        }
        
        // Format: "00:00:00 Speaker Name: text"
        const timestampMatch2 = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+([A-Z][a-zA-Z\s\.]+?):\s*(.*)$/);
        if (timestampMatch2) {
            return {
                speaker: timestampMatch2[2].trim(),
                text: timestampMatch2[3].trim() || null,
                timestamp: timestampMatch2[1]
            };
        }
        
        // Format: "Speaker Name (timestamp): text"
        const parenMatch = line.match(/^([A-Z][a-zA-Z\s\.]+?)\s*\(([^)]+)\):\s*(.*)$/);
        if (parenMatch) {
            return {
                speaker: parenMatch[1].trim(),
                text: parenMatch[3].trim() || null,
                timestamp: parenMatch[2]
            };
        }
        
        // Format: "**Speaker Name**: text" (Markdown)
        const mdMatch = line.match(/^\*\*([A-Z][a-zA-Z\s\.]+?)\*\*:\s*(.*)$/);
        if (mdMatch) {
            return {
                speaker: mdMatch[1].trim(),
                text: mdMatch[2].trim() || null,
                timestamp: null
            };
        }
        
        return null;
    }

    /**
     * Check if speaker matches target person
     */
    isTargetPerson(speaker, nameVariants) {
        const speakerLower = speaker.toLowerCase();
        return nameVariants.some(variant => {
            if (speakerLower === variant) return true;
            if (speakerLower.includes(variant)) return true;
            if (variant.includes(speakerLower) && speakerLower.length >= 3) return true;
            return false;
        });
    }

    /**
     * Generate name variants for matching
     */
    generateNameVariants(name) {
        const parts = name.toLowerCase().split(/\s+/);
        const variants = [name.toLowerCase()];
        
        // First name only
        if (parts.length > 0) {
            variants.push(parts[0]);
        }
        
        // Last name only
        if (parts.length > 1) {
            variants.push(parts[parts.length - 1]);
        }
        
        // Combined without space
        if (parts.length > 1) {
            variants.push(parts.join(''));
        }

        return variants;
    }

    /**
     * Format interventions for LLM prompt
     * Optimized for token efficiency
     */
    formatForPrompt(interventions, options = {}) {
        const { maxTokens = 6000, includeContext = true } = options;
        
        // Estimate tokens (rough: 1 token ≈ 4 chars)
        const estimateTokens = (text) => Math.ceil(text.length / 4);
        
        let output = [];
        let tokenCount = 0;
        const targetTokens = maxTokens * 0.9; // Leave buffer
        
        // Sort by importance (longer interventions often more informative)
        const sorted = [...interventions].sort((a, b) => b.wordCount - a.wordCount);
        
        // First pass: include most important interventions
        for (const intervention of sorted) {
            const formatted = this.formatIntervention(intervention, includeContext);
            const tokens = estimateTokens(formatted);
            
            if (tokenCount + tokens <= targetTokens) {
                output.push({ ...intervention, formatted });
                tokenCount += tokens;
            }
        }
        
        // Re-sort by timeline for coherent reading
        output.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
        
        return {
            formattedText: output.map(i => i.formatted).join('\n\n'),
            includedCount: output.length,
            totalCount: interventions.length,
            estimatedTokens: tokenCount
        };
    }

    /**
     * Format a single intervention
     */
    formatIntervention(intervention, includeContext) {
        let result = '';
        
        if (intervention.timestamp) {
            result += `[${intervention.timestamp}] `;
        }
        
        if (includeContext && intervention.context) {
            result += `(Context: ${intervention.context.substring(0, 150)}...)\n`;
        }
        
        result += `${intervention.speaker}: "${intervention.text}"`;
        
        return result;
    }

    /**
     * Cache interventions to database
     */
    async cacheInterventions(projectId, documentId, personId, extractionResult) {
        if (!this.supabase) return;
        
        try {
            await this.supabase
                .from('transcript_interventions')
                .upsert({
                    project_id: projectId,
                    document_id: documentId,
                    contact_id: personId,
                    interventions: extractionResult.interventions,
                    total_word_count: extractionResult.totalWordCount,
                    intervention_count: extractionResult.interventionCount,
                    extracted_at: extractionResult.extractedAt
                }, {
                    onConflict: 'project_id,document_id,contact_id'
                });
        } catch (error) {
            log.warn({ event: 'intervention_extractor_cache_failed', reason: error.message }, 'Failed to cache interventions');
        }
    }

    /**
     * Get cached interventions
     */
    async getCachedInterventions(projectId, documentId, personId) {
        if (!this.supabase) return null;
        
        try {
            const { data, error } = await this.supabase
                .from('transcript_interventions')
                .select('*')
                .eq('project_id', projectId)
                .eq('document_id', documentId)
                .eq('contact_id', personId)
                .single();
            
            if (error || !data) return null;
            return data;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract and cache interventions for a person from all their transcripts
     * @param {string[]} aliases - Alternative names/aliases for the person
     */
    async extractAllForPerson(projectId, personId, personName, transcripts, aliases = []) {
        const allInterventions = [];
        
        for (const transcript of transcripts) {
            // Check cache first
            let cached = await this.getCachedInterventions(projectId, transcript.id, personId);
            
            if (cached) {
                allInterventions.push({
                    documentId: transcript.id,
                    filename: transcript.filename,
                    ...cached
                });
            } else {
                // Extract and cache (pass aliases for better matching)
                const extracted = this.extractInterventions(
                    transcript.content,
                    personName,
                    transcript.filename,
                    aliases
                );
                
                await this.cacheInterventions(projectId, transcript.id, personId, extracted);
                
                allInterventions.push({
                    documentId: transcript.id,
                    filename: transcript.filename,
                    ...extracted
                });
            }
        }
        
        return allInterventions;
    }
}

module.exports = InterventionExtractor;
