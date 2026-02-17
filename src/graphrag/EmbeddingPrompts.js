/**
 * Purpose:
 *   Provides instruction-tuned prompt templates and text preparation utilities for
 *   generating high-quality embeddings. Implements asymmetric query-document prompting
 *   and bilingual (PT/EN) support compatible with modern embedding models (e.g.
 *   text-embedding-3, E5, BGE).
 *
 * Responsibilities:
 *   - Supply task-specific instruction prefixes for both document and query embeddings
 *   - Maintain structured templates (primary, semantic, searchable, questionBased) for
 *     each entity type (Person, Project, Meeting, etc.)
 *   - Enhance queries with synonym expansion, keyword extraction, and variation generation
 *   - Prepare entity data for embedding via template filling and text cleaning
 *   - Chunk long texts using sentence-boundary-aware splitting with configurable overlap
 *   - Prepare batch embedding payloads with metadata for downstream indexing
 *
 * Key dependencies:
 *   - None (pure logic, no external imports)
 *
 * Side effects:
 *   - None (stateless beyond configuration)
 *
 * Notes:
 *   - Modern instruction-tuned embedding models yield measurably better retrieval
 *     accuracy when the embedding input is prefixed with a task description.
 *     The prefixes here are designed for the retrieval use-case.
 *   - The "auto" language mode defaults to English. Portuguese is detected via regex.
 *   - Chunking splits on sentence boundaries (.!?) and re-includes `chunkOverlap`
 *     trailing characters from the previous chunk to preserve cross-sentence context.
 *   - Singleton instance available via getEmbeddingPrompts().
 */

class EmbeddingPrompts {
    constructor(options = {}) {
        this.language = options.language || 'auto'; // 'pt', 'en', 'auto'
        this.useInstructions = options.useInstructions !== false;
        this.chunkSize = options.chunkSize || 512;
        this.chunkOverlap = options.chunkOverlap || 50;
    }

    // ==================== Instruction Prefixes ====================
    // Modern embedding models (e.g., text-embedding-3, E5, BGE) benefit from task instructions

    /**
     * Get instruction prefix for document embedding
     * @param {string} docType - Type of document
     * @param {string} language - Language code
     * @returns {string}
     */
    getDocumentInstruction(docType, language = this.language) {
        const instructions = {
            en: {
                default: 'Represent this document for retrieval:',
                person: 'Represent this person profile for finding relevant people:',
                project: 'Represent this project description for project search:',
                meeting: 'Represent this meeting summary for finding relevant meetings:',
                fact: 'Represent this knowledge fact for semantic search:',
                technology: 'Represent this technology description for technical queries:',
                decision: 'Represent this decision record for finding related decisions:',
                task: 'Represent this task for task search and assignment:'
            },
            pt: {
                default: 'Representa este documento para pesquisa:',
                person: 'Representa este perfil de pessoa para encontrar pessoas relevantes:',
                project: 'Representa esta descrição de projeto para pesquisa:',
                meeting: 'Representa este resumo de reunião para encontrar reuniões relevantes:',
                fact: 'Representa este facto de conhecimento para pesquisa semântica:',
                technology: 'Representa esta descrição de tecnologia para queries técnicas:',
                decision: 'Representa este registo de decisão para encontrar decisões relacionadas:',
                task: 'Representa esta tarefa para pesquisa e atribuição:'
            }
        };

        const lang = this.detectLanguage(language);
        return instructions[lang]?.[docType.toLowerCase()] || instructions[lang]?.default || '';
    }

    /**
     * Get instruction prefix for query embedding
     * @param {string} queryType - Type of query
     * @param {string} language - Language code
     * @returns {string}
     */
    getQueryInstruction(queryType, language = this.language) {
        const instructions = {
            en: {
                default: 'Represent this question for retrieving relevant documents:',
                who: 'Represent this question about people for finding relevant person profiles:',
                what: 'Represent this question for finding relevant information:',
                when: 'Represent this question about timing for finding relevant events:',
                where: 'Represent this question about location for finding relevant places:',
                how: 'Represent this question about process for finding relevant guides:',
                why: 'Represent this question about reasoning for finding explanations:'
            },
            pt: {
                default: 'Representa esta pergunta para encontrar documentos relevantes:',
                who: 'Representa esta pergunta sobre pessoas para encontrar perfis relevantes:',
                what: 'Representa esta pergunta para encontrar informação relevante:',
                when: 'Representa esta pergunta sobre tempo para encontrar eventos relevantes:',
                where: 'Representa esta pergunta sobre localização para encontrar locais relevantes:',
                how: 'Representa esta pergunta sobre processo para encontrar guias relevantes:',
                why: 'Representa esta pergunta sobre razão para encontrar explicações:'
            }
        };

        const lang = this.detectLanguage(language);
        return instructions[lang]?.[queryType] || instructions[lang]?.default || '';
    }

    // ==================== Enhanced Templates ====================

    /**
     * Get enhanced embedding template for entity types
     * These are more semantic and include context
     * @param {string} entityType 
     * @returns {object} Template with multiple views
     */
    getEnhancedTemplate(entityType) {
        const templates = {
            Person: {
                primary: '[PERSON] {name} works as {role} at {organization}. Expertise: {skills}. Contact: {email}. Background: {bio}',
                semantic: 'Professional named {name} with role {role} in {organization}. Has skills in {skills}. {bio}',
                searchable: '{name} {role} {organization} {skills} {department} {location}',
                questionBased: 'Who is {name}? A {role} at {organization} skilled in {skills}.'
            },
            Project: {
                primary: '[PROJECT] {name} (Code: {code}) - Status: {status}, Phase: {phase}. Description: {description}. Goals: {objectives}',
                semantic: 'Project called {name} currently in {status} status and {phase} phase. It aims to {objectives}. {description}',
                searchable: '{name} {code} {status} {phase} {tags} {objectives}',
                questionBased: 'What is {name} project? A {status} project that {description}.'
            },
            Meeting: {
                primary: '[MEETING] {title} held on {date} ({duration}min). Type: {type}. Summary: {summary}. Key points: {notes}',
                semantic: 'Meeting titled {title} that occurred on {date}. The discussion covered: {summary}. Notes: {notes}',
                searchable: '{title} {date} {type} {summary} {notes} {agenda}',
                questionBased: 'What was discussed in {title}? On {date}: {summary}'
            },
            Technology: {
                primary: '[TECHNOLOGY] {name} is a {category} (v{version}). {description}. Maturity: {maturity}. Tags: {tags}',
                semantic: 'Technology {name} categorized as {category}. {description}. Current version {version} with {maturity} maturity.',
                searchable: '{name} {category} {version} {tags} {description}',
                questionBased: 'What is {name}? A {category} technology that {description}.'
            },
            Client: {
                primary: '[CLIENT] {name} in {industry} industry ({size} company). Contract: {contractType}. {description}',
                semantic: 'Client organization {name} operating in {industry}. Company size: {size}. {description}',
                searchable: '{name} {industry} {size} {contractType} {status}',
                questionBased: 'Who is client {name}? A {size} {industry} company. {description}'
            },
            Decision: {
                primary: '[DECISION] {title} - Status: {status}, Impact: {impact}. {description}. Rationale: {rationale}',
                semantic: 'Decision about {title} with {status} status and {impact} impact. Reasoning: {rationale}. {description}',
                searchable: '{title} {status} {impact} {category} {description}',
                questionBased: 'What was decided about {title}? {description} because {rationale}.'
            },
            Task: {
                primary: '[TASK] {title} - Status: {status}, Priority: {priority}. Due: {dueDate}. {description}',
                semantic: 'Task {title} with {priority} priority, currently {status}. Due by {dueDate}. Details: {description}',
                searchable: '{title} {status} {priority} {dueDate} {tags}',
                questionBased: 'What is task {title}? A {priority} priority task that is {status}. {description}'
            },
            Risk: {
                primary: '[RISK] {title} - Severity: {severity}, Probability: {probability}. Status: {status}. Mitigation: {mitigation}',
                semantic: 'Risk identified: {title}. Severity level {severity} with {probability} probability. Mitigation strategy: {mitigation}',
                searchable: '{title} {severity} {probability} {status} {category}',
                questionBased: 'What is the risk {title}? A {severity} severity risk. How to mitigate: {mitigation}'
            },
            Fact: {
                primary: '[FACT] {content}. Source: {source}. Category: {category}. Confidence: {confidence}',
                semantic: 'Known fact: {content}. This information comes from {source} with {confidence} confidence.',
                searchable: '{content} {source} {category} {tags}',
                questionBased: '{content}'
            },
            Organization: {
                primary: '[ORGANIZATION] {name} - Type: {type}, Industry: {industry}, Size: {size}. {description}',
                semantic: 'Organization {name} is a {type} in {industry}. Company size: {size}. {description}',
                searchable: '{name} {type} {industry} {size} {country}',
                questionBased: 'What is {name}? A {size} {type} in {industry}. {description}'
            }
        };

        return templates[entityType] || {
            primary: '[{type}] {name}: {description}',
            semantic: '{name} - {description}',
            searchable: '{name} {description}',
            questionBased: 'What is {name}? {description}'
        };
    }

    // ==================== Query Enhancement ====================

    /**
     * Enhance a query for better embedding matching
     * @param {string} query - Original query
     * @param {object} options - Enhancement options
     * @returns {object} Enhanced query variations
     */
    enhanceQuery(query, options = {}) {
        const lang = this.detectQueryLanguage(query);
        const queryType = this.classifyQueryType(query);
        
        const enhanced = {
            original: query,
            language: lang,
            queryType,
            variations: []
        };

        // 1. Instructed version
        if (this.useInstructions) {
            enhanced.instructed = `${this.getQueryInstruction(queryType, lang)} ${query}`;
        }

        // 2. Expanded with synonyms/context
        enhanced.expanded = this.expandQuery(query, lang);

        // 3. Keyword extraction for sparse matching
        enhanced.keywords = this.extractKeywords(query);

        // 4. Generate question variations
        enhanced.variations = this.generateQueryVariations(query, lang);

        return enhanced;
    }

    /**
     * Classify query type (who, what, when, etc.)
     * @param {string} query 
     * @returns {string}
     */
    classifyQueryType(query) {
        const q = query.toLowerCase();
        
        // Portuguese patterns
        if (/^quem|pessoa|colaborador|equipa|team|membro/i.test(q)) return 'who';
        if (/^o que|qual|que tipo|what|which/i.test(q)) return 'what';
        if (/^quando|data|prazo|when|date|deadline/i.test(q)) return 'when';
        if (/^onde|local|where|location/i.test(q)) return 'where';
        if (/^como|processo|how|process/i.test(q)) return 'how';
        if (/^porqu[êe]|razão|why|reason/i.test(q)) return 'why';
        
        return 'default';
    }

    /**
     * Detect language from query
     * @param {string} query 
     * @returns {string} 'pt' or 'en'
     */
    detectQueryLanguage(query) {
        // Portuguese indicators
        const ptPatterns = /\b(quem|qual|quando|onde|como|porquê|são|está|pessoas|projeto|reunião|decisão|risco|tarefa)\b/i;
        if (ptPatterns.test(query)) return 'pt';
        
        // Default to English
        return 'en';
    }

    /**
     * Detect language (general)
     * @param {string} lang 
     * @returns {string}
     */
    detectLanguage(lang) {
        if (lang === 'auto') return 'en'; // Default
        return lang === 'pt' ? 'pt' : 'en';
    }

    /**
     * Expand query with context
     * @param {string} query 
     * @param {string} lang 
     * @returns {string}
     */
    expandQuery(query, lang) {
        const expansions = {
            pt: {
                'pessoas': 'pessoas colaboradores membros equipa',
                'projeto': 'projeto iniciativa trabalho',
                'reunião': 'reunião meeting encontro discussão',
                'tecnologia': 'tecnologia ferramenta framework biblioteca',
                'cliente': 'cliente organização empresa',
                'decisão': 'decisão resolução acordo',
                'risco': 'risco problema perigo ameaça',
                'tarefa': 'tarefa atividade trabalho ação'
            },
            en: {
                'people': 'people person team members collaborators',
                'project': 'project initiative work program',
                'meeting': 'meeting discussion session call',
                'technology': 'technology tool framework library stack',
                'client': 'client customer organization company',
                'decision': 'decision resolution agreement choice',
                'risk': 'risk issue threat problem danger',
                'task': 'task activity work action item'
            }
        };

        let expanded = query;
        const langExpansions = expansions[lang] || expansions.en;
        
        for (const [term, expansion] of Object.entries(langExpansions)) {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            if (regex.test(query)) {
                expanded = expanded.replace(regex, expansion);
                break; // Only expand first match
            }
        }

        return expanded;
    }

    /**
     * Extract keywords from query
     * @param {string} query 
     * @returns {Array<string>}
     */
    extractKeywords(query) {
        // Remove stop words
        const stopWords = new Set([
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no',
            'que', 'qual', 'quem', 'como', 'onde', 'quando', 'porquê', 'porque',
            'é', 'são', 'está', 'estão', 'foi', 'foram', 'ser', 'estar', 'ter', 'haver'
        ]);

        return query
            .toLowerCase()
            .replace(/[^\wÀ-ÿ\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }

    /**
     * Generate query variations for better recall
     * @param {string} query 
     * @param {string} lang 
     * @returns {Array<string>}
     */
    generateQueryVariations(query, lang) {
        const variations = [query];
        
        // Add statement form
        if (query.endsWith('?')) {
            variations.push(query.slice(0, -1));
        }

        // Add keyword form
        variations.push(this.extractKeywords(query).join(' '));

        return variations.filter((v, i, arr) => arr.indexOf(v) === i && v.length > 0);
    }

    // ==================== Document Preparation ====================

    /**
     * Prepare document text for embedding with optimal structure
     * @param {string} entityType 
     * @param {object} entity 
     * @param {object} options 
     * @returns {object} Prepared embeddings
     */
    prepareForEmbedding(entityType, entity, options = {}) {
        const { includeInstruction = this.useInstructions, views = ['primary', 'semantic'] } = options;
        const templates = this.getEnhancedTemplate(entityType);
        const lang = options.language || 'en';

        const prepared = {
            entityType,
            entityId: entity.id,
            views: {}
        };

        for (const view of views) {
            const template = templates[view];
            if (!template) continue;

            let text = this.fillTemplate(template, entity);
            
            if (includeInstruction) {
                const instruction = this.getDocumentInstruction(entityType, lang);
                text = `${instruction} ${text}`;
            }

            prepared.views[view] = this.cleanText(text);
        }

        return prepared;
    }

    /**
     * Fill template with entity values
     * @param {string} template 
     * @param {object} entity 
     * @returns {string}
     */
    fillTemplate(template, entity) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            const value = entity[key];
            if (value === undefined || value === null) return '';
            if (Array.isArray(value)) return value.join(', ');
            return String(value);
        });
    }

    /**
     * Clean text for embedding
     * @param {string} text 
     * @returns {string}
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\s*[,.:]\s*/g, match => match.trim() + ' ')
            .replace(/\[\w+\]\s*$/g, '') // Remove empty type tags
            .replace(/:\s*\./g, '.') // Fix empty values
            .replace(/\.\s*\./g, '.')
            .trim();
    }

    // ==================== Chunking ====================

    /**
     * Smart chunk text with semantic boundaries
     * @param {string} text 
     * @param {object} options 
     * @returns {Array<{text: string, index: number, isStart: boolean, isEnd: boolean}>}
     */
    chunkText(text, options = {}) {
        const { chunkSize = this.chunkSize, overlap = this.chunkOverlap } = options;
        
        if (text.length <= chunkSize) {
            return [{ text, index: 0, isStart: true, isEnd: true }];
        }

        const chunks = [];
        const sentences = text.split(/(?<=[.!?])\s+/);
        let currentChunk = '';
        let chunkIndex = 0;

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    index: chunkIndex++,
                    isStart: chunkIndex === 1,
                    isEnd: false
                });
                
                // Start new chunk with overlap (last sentence)
                currentChunk = currentChunk.slice(-overlap) + ' ' + sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }

        if (currentChunk.trim()) {
            chunks.push({
                text: currentChunk.trim(),
                index: chunkIndex,
                isStart: chunkIndex === 0,
                isEnd: true
            });
        }

        return chunks;
    }

    // ==================== Batch Preparation ====================

    /**
     * Prepare multiple entities for batch embedding
     * @param {Array<{type: string, entity: object}>} items 
     * @param {object} options 
     * @returns {Array<{id: string, text: string, metadata: object}>}
     */
    prepareBatch(items, options = {}) {
        const { views = ['primary'], language = 'auto' } = options;
        const batch = [];

        for (const item of items) {
            const prepared = this.prepareForEmbedding(item.type, item.entity, {
                ...options,
                views,
                language: language === 'auto' ? this.detectLanguage(item.entity.name || '') : language
            });

            for (const [view, text] of Object.entries(prepared.views)) {
                batch.push({
                    id: `${item.entity.id}_${view}`,
                    text,
                    metadata: {
                        entityId: item.entity.id,
                        entityType: item.type,
                        view,
                        name: item.entity.name || item.entity.title
                    }
                });
            }
        }

        return batch;
    }
}

// Singleton instance
let instance = null;

function getEmbeddingPrompts(options = {}) {
    if (!instance) {
        instance = new EmbeddingPrompts(options);
    }
    return instance;
}

module.exports = {
    EmbeddingPrompts,
    getEmbeddingPrompts
};
