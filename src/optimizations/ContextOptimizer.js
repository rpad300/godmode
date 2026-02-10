/**
 * Context Optimizer Module
 * Reduces tokens sent to LLM while maintaining quality
 * Uses compression, summarization, and smart selection
 */

const { logger } = require('../logger');
const llm = require('../llm');
const llmConfig = require('../llm/config');

const log = logger.child({ module: 'context-optimizer' });

class ContextOptimizer {
    constructor(options = {}) {
        this.maxTokens = options.maxTokens || 4000;
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        
        // Approximate tokens per character (for estimation)
        this.tokensPerChar = 0.25;
        
        // Priority weights for different context types
        this.priorities = {
            user_query: 10,
            direct_answer: 9,
            relevant_fact: 8,
            related_entity: 7,
            graph_context: 6,
            background: 5,
            metadata: 3
        };
    }

    /**
     * Optimize context for LLM call
     */
    async optimize(contexts, options = {}) {
        const maxTokens = options.maxTokens || this.maxTokens;
        
        // Score and sort contexts by relevance
        const scored = contexts.map(ctx => ({
            ...ctx,
            score: this.scoreContext(ctx, options.query),
            tokens: this.estimateTokens(ctx.content)
        })).sort((a, b) => b.score - a.score);

        // Select contexts within token budget
        const selected = [];
        let totalTokens = 0;
        const reservedTokens = maxTokens * 0.2; // Reserve 20% for response

        for (const ctx of scored) {
            if (totalTokens + ctx.tokens <= maxTokens - reservedTokens) {
                selected.push(ctx);
                totalTokens += ctx.tokens;
            } else if (ctx.score > 7) {
                // High priority - try to compress and include
                const compressed = await this.compress(ctx.content, 
                    Math.floor((maxTokens - reservedTokens - totalTokens) / this.tokensPerChar));
                if (compressed) {
                    selected.push({ ...ctx, content: compressed, compressed: true });
                    totalTokens += this.estimateTokens(compressed);
                }
            }
        }

        return {
            contexts: selected,
            totalTokens,
            originalCount: contexts.length,
            selectedCount: selected.length,
            compressionRatio: totalTokens / this.estimateTokens(contexts.map(c => c.content).join('\n'))
        };
    }

    /**
     * Score context relevance
     */
    scoreContext(ctx, query) {
        let score = this.priorities[ctx.type] || 5;

        // Boost if content contains query terms
        if (query && ctx.content) {
            const queryTerms = query.toLowerCase().split(/\s+/);
            const contentLower = ctx.content.toLowerCase();
            const matchCount = queryTerms.filter(t => contentLower.includes(t)).length;
            score += matchCount * 0.5;
        }

        // Boost recent content
        if (ctx.timestamp) {
            const age = Date.now() - new Date(ctx.timestamp).getTime();
            const hoursSinceCreation = age / (1000 * 60 * 60);
            if (hoursSinceCreation < 24) score += 1;
            if (hoursSinceCreation < 1) score += 2;
        }

        // Boost if marked as important
        if (ctx.importance === 'high' || ctx.importance === 'critical') {
            score += 2;
        }

        return score;
    }

    /**
     * Estimate tokens for text
     */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length * this.tokensPerChar);
    }

    /**
     * Compress text to fit within character limit
     */
    async compress(text, maxChars) {
        if (!text || text.length <= maxChars) return text;

        // Try extractive summarization first (fast)
        const extractive = this.extractiveSummarize(text, maxChars);
        if (extractive.length <= maxChars) return extractive;

        try {
            const textCfg = this.appConfig ? llmConfig.getTextConfig(this.appConfig) : null;
            const provider = textCfg?.provider ?? this.llmConfig?.perTask?.text?.provider ?? this.llmConfig?.provider;
            const model = textCfg?.model ?? this.llmConfig?.perTask?.text?.model ?? this.llmConfig?.models?.text;
            const providerConfig = textCfg?.providerConfig ?? this.llmConfig?.providers?.[provider] ?? {};
            if (!provider || !model) return text.substring(0, maxChars - 3) + '...';
            const result = await llm.generateText({
                provider,
                providerConfig,
                model,
                prompt: `Summarize the following text in under ${Math.floor(maxChars * 0.8)} characters, preserving key facts:\n\n${text.substring(0, 3000)}`,
                temperature: 0.3,
                maxTokens: Math.ceil(maxChars * this.tokensPerChar)
            });

            if (result.success && result.text.length <= maxChars) {
                return result.text;
            }
        } catch (e) {
            log.warn({ event: 'context_optimizer_compression_failed', reason: e.message }, 'LLM compression failed');
        }

        // Fallback to truncation
        return text.substring(0, maxChars - 3) + '...';
    }

    /**
     * Extractive summarization (select key sentences)
     */
    extractiveSummarize(text, maxChars) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        // Score sentences by importance
        const scored = sentences.map(s => ({
            text: s.trim(),
            score: this.scoreSentence(s)
        })).sort((a, b) => b.score - a.score);

        // Select top sentences within limit
        let result = '';
        for (const { text: sentence } of scored) {
            if (result.length + sentence.length + 2 <= maxChars) {
                result += sentence + '. ';
            }
        }

        return result.trim();
    }

    /**
     * Score sentence importance
     */
    scoreSentence(sentence) {
        let score = 0;
        const lower = sentence.toLowerCase();

        // Important keywords
        const importantWords = ['decided', 'concluded', 'agreed', 'must', 'should', 
            'critical', 'important', 'key', 'main', 'primary', 'essential'];
        for (const word of importantWords) {
            if (lower.includes(word)) score += 2;
        }

        // Named entities (capitalized words)
        const capitalWords = sentence.match(/[A-Z][a-z]+/g) || [];
        score += capitalWords.length * 0.5;

        // Numbers (often important)
        const numbers = sentence.match(/\d+/g) || [];
        score += numbers.length * 0.3;

        // Penalize very short or very long sentences
        if (sentence.length < 20) score -= 1;
        if (sentence.length > 200) score -= 0.5;

        return score;
    }

    /**
     * Build optimized prompt from contexts
     */
    async buildPrompt(query, contexts, options = {}) {
        const optimized = await this.optimize(contexts, { ...options, query });

        let prompt = '';
        
        // Group by type
        const grouped = {};
        for (const ctx of optimized.contexts) {
            const type = ctx.type || 'general';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(ctx);
        }

        // Build prompt sections
        for (const [type, items] of Object.entries(grouped)) {
            const header = this.getTypeHeader(type);
            prompt += `\n## ${header}\n`;
            for (const item of items) {
                prompt += `- ${item.content}\n`;
            }
        }

        return {
            prompt: prompt.trim(),
            ...optimized
        };
    }

    /**
     * Get header for context type
     */
    getTypeHeader(type) {
        const headers = {
            user_query: 'User Question',
            direct_answer: 'Direct Information',
            relevant_fact: 'Relevant Facts',
            related_entity: 'Related Entities',
            graph_context: 'Knowledge Graph Context',
            background: 'Background Information',
            metadata: 'Additional Context'
        };
        return headers[type] || 'Information';
    }

    /**
     * Deduplicate similar contexts
     */
    deduplicateContexts(contexts) {
        const unique = [];
        const seen = new Set();

        for (const ctx of contexts) {
            const normalized = ctx.content.toLowerCase().replace(/\s+/g, ' ').trim();
            const hash = normalized.substring(0, 100);
            
            if (!seen.has(hash)) {
                seen.add(hash);
                unique.push(ctx);
            }
        }

        return unique;
    }
}

// Singleton
let contextOptimizerInstance = null;
function getContextOptimizer(options = {}) {
    if (!contextOptimizerInstance) {
        contextOptimizerInstance = new ContextOptimizer(options);
    }
    if (options.llmConfig) contextOptimizerInstance.llmConfig = options.llmConfig;
    return contextOptimizerInstance;
}

module.exports = { ContextOptimizer, getContextOptimizer };
