/**
 * Auto-Tagging Module
 * Automatically classify and tag documents based on content
 */

const llm = require('../llm');

class AutoTagging {
    constructor(options = {}) {
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        
        // Predefined tag categories
        this.categories = options.categories || [
            'technical',
            'business',
            'meeting',
            'requirements',
            'architecture',
            'design',
            'testing',
            'deployment',
            'security',
            'legal',
            'financial',
            'hr',
            'marketing',
            'support'
        ];

        // Predefined importance levels
        this.importanceLevels = ['critical', 'high', 'medium', 'low'];
    }

    /**
     * Auto-tag a document
     */
    async tagDocument(document) {
        const content = document.content || document.text || '';
        const title = document.title || document.name || '';

        if (content.length < 50) {
            return { tags: [], category: 'unknown', importance: 'low' };
        }

        const prompt = `Analyze this document and provide classification.

DOCUMENT TITLE: ${title}

CONTENT (first 3000 chars):
${content.substring(0, 3000)}

Classify this document and respond in JSON format:
{
  "category": "one of: ${this.categories.join(', ')}",
  "subcategory": "more specific type",
  "tags": ["tag1", "tag2", "tag3"],
  "importance": "one of: critical, high, medium, low",
  "summary": "one sentence summary",
  "keyTopics": ["topic1", "topic2"],
  "relatedTo": ["project/person/technology names if mentioned"]
}

Be concise and accurate.`;

        try {
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.2,
                maxTokens: 500
            });

            if (result.success) {
                return this.parseTagResponse(result.text);
            }
            return this.fallbackTagging(content, title);
        } catch (e) {
            console.log('[AutoTagging] LLM error:', e.message);
            return this.fallbackTagging(content, title);
        }
    }

    /**
     * Parse LLM tag response
     */
    parseTagResponse(response) {
        try {
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    category: parsed.category || 'general',
                    subcategory: parsed.subcategory || null,
                    tags: parsed.tags || [],
                    importance: parsed.importance || 'medium',
                    summary: parsed.summary || '',
                    keyTopics: parsed.keyTopics || [],
                    relatedTo: parsed.relatedTo || []
                };
            }
        } catch (e) {
            console.log('[AutoTagging] Parse error');
        }
        return { category: 'general', tags: [], importance: 'medium' };
    }

    /**
     * Fallback keyword-based tagging
     */
    fallbackTagging(content, title) {
        const text = (content + ' ' + title).toLowerCase();
        const tags = [];
        let category = 'general';
        let importance = 'medium';

        // Category detection
        const categoryPatterns = {
            technical: ['api', 'database', 'code', 'function', 'algorithm', 'implementation'],
            meeting: ['meeting', 'agenda', 'minutes', 'attendees', 'action items'],
            requirements: ['requirement', 'must', 'shall', 'user story', 'acceptance criteria'],
            architecture: ['architecture', 'design', 'system', 'component', 'diagram'],
            security: ['security', 'authentication', 'authorization', 'encryption', 'vulnerability'],
            legal: ['contract', 'agreement', 'terms', 'legal', 'compliance'],
            financial: ['budget', 'cost', 'revenue', 'financial', 'invoice']
        };

        for (const [cat, keywords] of Object.entries(categoryPatterns)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    category = cat;
                    tags.push(keyword);
                }
            }
        }

        // Importance detection
        if (text.includes('critical') || text.includes('urgent') || text.includes('asap')) {
            importance = 'critical';
        } else if (text.includes('important') || text.includes('priority')) {
            importance = 'high';
        }

        return {
            category,
            tags: [...new Set(tags)].slice(0, 5),
            importance,
            method: 'fallback'
        };
    }

    /**
     * Batch tag multiple documents
     */
    async tagDocuments(documents) {
        const results = [];
        
        for (const doc of documents) {
            const tags = await this.tagDocument(doc);
            results.push({
                document: doc.id || doc.name,
                ...tags
            });
        }

        return results;
    }

    /**
     * Suggest related documents based on tags
     */
    findRelatedDocuments(targetTags, allDocuments) {
        const related = [];

        for (const doc of allDocuments) {
            if (!doc.tags) continue;

            const commonTags = doc.tags.filter(t => targetTags.includes(t));
            if (commonTags.length > 0) {
                related.push({
                    document: doc.id || doc.name,
                    commonTags,
                    similarity: commonTags.length / Math.max(targetTags.length, doc.tags.length)
                });
            }
        }

        return related.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Get tag statistics
     */
    getTagStats(documents) {
        const tagCounts = {};
        const categoryCounts = {};

        for (const doc of documents) {
            if (doc.category) {
                categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
            }
            for (const tag of doc.tags || []) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }

        return {
            topTags: Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([tag, count]) => ({ tag, count })),
            categories: Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => ({ category, count }))
        };
    }
}

// Singleton
let autoTaggingInstance = null;
function getAutoTagging(options = {}) {
    if (!autoTaggingInstance) {
        autoTaggingInstance = new AutoTagging(options);
    }
    if (options.llmConfig) autoTaggingInstance.llmConfig = options.llmConfig;
    return autoTaggingInstance;
}

module.exports = { AutoTagging, getAutoTagging };
