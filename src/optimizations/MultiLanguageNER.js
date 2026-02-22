/**
 * Purpose:
 *   Extract named entities from text in both Portuguese and English using
 *   a combination of rule-based regex patterns and LLM-powered extraction.
 *
 * Responsibilities:
 *   - Auto-detect language (Portuguese vs English) via stop-word scoring
 *     and presence of Portuguese-specific diacritics
 *   - Extract structured entities (emails, URLs, dates, money, phone
 *     numbers, roles) using locale-specific regex patterns
 *   - Extract semantic entities (people, organizations, projects,
 *     technologies, events) via LLM prompts
 *   - Merge and deduplicate results from both extraction strategies
 *   - Infer person-to-organization relationships by text proximity
 *
 * Key dependencies:
 *   - ../llm: LLM text generation for semantic NER
 *
 * Side effects:
 *   - Makes LLM API calls when extractWithLLM is invoked
 *
 * Notes:
 *   - Rule-based extraction is fully synchronous and does not require
 *     an LLM provider. LLM extraction gracefully falls back to an empty
 *     result set on failure.
 *   - Language detection is simplistic (stop-word counting); for mixed-
 *     language documents the caller should pass options.language explicitly.
 *   - Proximity-based relation inference (extractWithRelations) uses a
 *     100-character window, which is a rough heuristic.
 */

const { logger } = require('../logger');
const llmRouter = require('../llm/router');

const log = logger.child({ module: 'multi-language-ner' });

/**
 * Bilingual (Portuguese + English) Named Entity Recognition using regex
 * patterns and LLM extraction.
 *
 * @param {object} options
 * @param {string|null} options.llmProvider - LLM provider for semantic extraction
 * @param {string|null} options.llmModel - Model identifier
 * @param {object}  options.llmConfig - Full LLM configuration
 */
class MultiLanguageNER {
    constructor(options = {}) {
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        this._resolvedConfig = options.appConfig || options.config || { llm: this.llmConfig };

        // Entity types to extract
        this.entityTypes = [
            'PERSON',       // People names
            'ORGANIZATION', // Companies, institutions
            'LOCATION',     // Places, addresses
            'DATE',         // Dates, time periods
            'MONEY',        // Monetary values
            'PROJECT',      // Project names
            'TECHNOLOGY',   // Tech, tools, languages
            'PRODUCT',      // Products, services
            'EVENT',        // Meetings, events
            'ROLE'          // Job titles, roles
        ];

        // Common patterns for rule-based extraction
        this.patterns = {
            // Portuguese patterns
            pt: {
                email: /[\w.-]+@[\w.-]+\.\w+/gi,
                phone: /(\+351|00351)?[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}/g,
                date: /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi,
                money: /€\s?\d+([.,]\d+)?|\d+([.,]\d+)?\s?€|EUR\s?\d+/gi,
                url: /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi
            },
            // English patterns
            en: {
                email: /[\w.-]+@[\w.-]+\.\w+/gi,
                phone: /(\+1|001)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
                date: /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}/gi,
                money: /\$\s?\d+([.,]\d+)?|\d+([.,]\d+)?\s?USD|€\s?\d+/gi,
                url: /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi
            }
        };

        // Portuguese role indicators
        this.ptRoles = [
            'diretor', 'gerente', 'coordenador', 'analista', 'desenvolvedor',
            'engenheiro', 'arquiteto', 'consultor', 'especialista', 'gestor',
            'presidente', 'CEO', 'CTO', 'CFO', 'líder', 'responsável'
        ];

        // English role indicators
        this.enRoles = [
            'director', 'manager', 'coordinator', 'analyst', 'developer',
            'engineer', 'architect', 'consultant', 'specialist', 'lead',
            'president', 'CEO', 'CTO', 'CFO', 'head', 'chief'
        ];
    }

    /**
     * Detect language of text
     */
    detectLanguage(text) {
        const ptIndicators = ['de', 'do', 'da', 'que', 'para', 'com', 'não', 'uma', 'são', 'foi'];
        const enIndicators = ['the', 'and', 'that', 'for', 'with', 'was', 'are', 'been', 'have', 'this'];
        
        const lower = text.toLowerCase();
        const words = lower.split(/\s+/);
        
        let ptScore = 0;
        let enScore = 0;

        for (const word of words) {
            if (ptIndicators.includes(word)) ptScore++;
            if (enIndicators.includes(word)) enScore++;
        }

        // Check for Portuguese-specific characters
        if (/[ãõçáéíóúâêîôû]/.test(lower)) ptScore += 3;

        return ptScore > enScore ? 'pt' : 'en';
    }

    /**
     * Run both rule-based and LLM extraction in parallel, merge, dedup,
     * and return sorted entities.
     * @param {string} text - Input text (minimum 10 chars)
     * @param {object} [options]
     * @param {string} [options.language] - 'pt' | 'en'; auto-detected if omitted
     * @returns {Promise<{entities: Array<{type: string, value: string, confidence: number}>, language: string, counts: object}>}
     */
    async extract(text, options = {}) {
        if (!text || text.length < 10) {
            return { entities: [], language: 'unknown' };
        }

        const language = options.language || this.detectLanguage(text);
        
        // Combine rule-based and LLM extraction
        const [ruleBasedEntities, llmEntities] = await Promise.all([
            this.extractRuleBased(text, language),
            this.extractWithLLM(text, language)
        ]);

        // Merge and deduplicate
        const merged = this.mergeEntities(ruleBasedEntities, llmEntities);

        return {
            entities: merged,
            language,
            counts: this.countByType(merged)
        };
    }

    /**
     * Rule-based extraction (fast)
     */
    extractRuleBased(text, language) {
        const entities = [];
        const patterns = this.patterns[language] || this.patterns.en;

        // Extract emails
        const emails = text.match(patterns.email) || [];
        for (const email of emails) {
            entities.push({ type: 'EMAIL', value: email, confidence: 0.95 });
        }

        // Extract URLs
        const urls = text.match(patterns.url) || [];
        for (const url of urls) {
            entities.push({ type: 'URL', value: url, confidence: 0.95 });
        }

        // Extract dates
        const dates = text.match(patterns.date) || [];
        for (const date of dates) {
            entities.push({ type: 'DATE', value: date, confidence: 0.85 });
        }

        // Extract money
        const money = text.match(patterns.money) || [];
        for (const m of money) {
            entities.push({ type: 'MONEY', value: m, confidence: 0.9 });
        }

        // Extract phone numbers
        const phones = text.match(patterns.phone) || [];
        for (const phone of phones) {
            entities.push({ type: 'PHONE', value: phone, confidence: 0.85 });
        }

        // Extract roles (based on keywords)
        const roles = language === 'pt' ? this.ptRoles : this.enRoles;
        for (const role of roles) {
            const regex = new RegExp(`\\b${role}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) {
                for (const match of matches) {
                    entities.push({ type: 'ROLE', value: match, confidence: 0.7 });
                }
            }
        }

        return entities;
    }

    /**
     * LLM-based extraction (more accurate)
     */
    async extractWithLLM(text, language) {
        const langInstructions = language === 'pt' 
            ? 'O texto está em Português. Extraia entidades nomeadas.'
            : 'The text is in English. Extract named entities.';

        const prompt = `${langInstructions}

TEXT:
${text.substring(0, 3000)}

Extract entities and respond in JSON format:
{
  "entities": [
    {"type": "PERSON", "value": "name", "role": "optional role"},
    {"type": "ORGANIZATION", "value": "company name"},
    {"type": "PROJECT", "value": "project name"},
    {"type": "TECHNOLOGY", "value": "tech name"},
    {"type": "DATE", "value": "date"},
    {"type": "LOCATION", "value": "place"},
    {"type": "EVENT", "value": "meeting/event name"}
  ]
}

Entity types: PERSON, ORGANIZATION, LOCATION, DATE, PROJECT, TECHNOLOGY, PRODUCT, EVENT, ROLE

Be precise and extract only clearly mentioned entities.`;

        try {
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.1,
                maxTokens: 1000,
                context: 'multi-language-ner'
            }, this._resolvedConfig);

            if (routerResult.success) {
                const rText = routerResult.result?.text || routerResult.result?.response || '';
                return this.parseLLMResponse(rText);
            }
        } catch (e) {
            log.warn({ event: 'multi_language_ner_llm_failed', message: e.message }, 'LLM extraction failed');
        }

        return [];
    }

    /**
     * Parse LLM response
     */
    parseLLMResponse(response) {
        try {
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return (parsed.entities || []).map(e => ({
                    ...e,
                    confidence: 0.8 // LLM entities have base confidence of 0.8
                }));
            }
        } catch (e) {
            log.warn({ event: 'multi_language_ner_parse_error' }, 'Parse error');
        }
        return [];
    }

    /**
     * Merge entities from different sources
     */
    mergeEntities(ruleBased, llmBased) {
        const merged = [];
        const seen = new Set();

        // Add rule-based first (higher confidence for specific patterns)
        for (const entity of ruleBased) {
            const key = `${entity.type}:${entity.value.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(entity);
            }
        }

        // Add LLM-based
        for (const entity of llmBased) {
            const key = `${entity.type}:${entity.value.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(entity);
            }
        }

        return merged.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Count entities by type
     */
    countByType(entities) {
        const counts = {};
        for (const entity of entities) {
            counts[entity.type] = (counts[entity.type] || 0) + 1;
        }
        return counts;
    }

    /**
     * Extract people with roles
     */
    async extractPeople(text) {
        const result = await this.extract(text);
        
        const people = result.entities
            .filter(e => e.type === 'PERSON')
            .map(e => ({
                name: e.value,
                role: e.role || null,
                confidence: e.confidence
            }));

        return people;
    }

    /**
     * Extract organizations
     */
    async extractOrganizations(text) {
        const result = await this.extract(text);
        
        return result.entities
            .filter(e => e.type === 'ORGANIZATION')
            .map(e => ({
                name: e.value,
                confidence: e.confidence
            }));
    }

    /**
     * Extract entities and infer person-to-organization relationships by
     * text proximity (within 100 characters). Relationships are returned
     * with confidence 0.6 as they are heuristic.
     * @param {string} text - Input text
     * @returns {Promise<{entities: Array, language: string, counts: object, relations: Array}>}
     */
    async extractWithRelations(text) {
        const result = await this.extract(text);
        
        // Try to infer relations (person works at organization, etc.)
        const people = result.entities.filter(e => e.type === 'PERSON');
        const orgs = result.entities.filter(e => e.type === 'ORGANIZATION');
        
        const relations = [];
        
        // Simple heuristic: if person and org appear close together, they might be related
        for (const person of people) {
            const personIndex = text.indexOf(person.value);
            for (const org of orgs) {
                const orgIndex = text.indexOf(org.value);
                if (Math.abs(personIndex - orgIndex) < 100) {
                    relations.push({
                        from: person.value,
                        to: org.value,
                        type: 'WORKS_AT',
                        confidence: 0.6
                    });
                }
            }
        }

        return {
            ...result,
            relations
        };
    }
}

// Singleton
let multiLanguageNERInstance = null;
function getMultiLanguageNER(options = {}) {
    if (!multiLanguageNERInstance) {
        multiLanguageNERInstance = new MultiLanguageNER(options);
    }
    if (options.llmConfig) multiLanguageNERInstance.llmConfig = options.llmConfig;
    return multiLanguageNERInstance;
}

module.exports = { MultiLanguageNER, getMultiLanguageNER };
