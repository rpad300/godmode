/**
 * Purpose:
 *   Generate LLM-powered summaries of the project by combining data from
 *   the knowledge graph and the local storage layer.
 *
 * Responsibilities:
 *   - Build a context object from storage (people, decisions, risks, facts,
 *     questions) and the graph (projects, technologies, meetings)
 *   - Produce executive project summaries, periodic digests, and per-entity
 *     summaries via the configured LLM provider
 *
 * Key dependencies:
 *   - ../llm: text generation for summaries
 *   - ../llm/config: resolve per-task LLM provider/model settings
 *   - storage (injected): local knowledge base (facts, people, decisions, etc.)
 *   - graphProvider (injected): Cypher queries against the knowledge graph
 *
 * Side effects:
 *   - Makes LLM API calls (network I/O, token consumption)
 *
 * Notes:
 *   - If neither provider nor model is configured, methods return early with
 *     an error object rather than throwing.
 *   - Context gathering is best-effort; graph query failures are silently
 *     swallowed so that storage-only summaries can still be produced.
 */

const llmRouter = require('../llm/router');

/**
 * Generates LLM-powered summaries from graph + storage context.
 *
 * @param {object} options
 * @param {string|null} options.llmProvider - LLM provider name (e.g. 'openai')
 * @param {string|null} options.llmModel - Model identifier
 * @param {object}  options.llmConfig - Full LLM configuration including providers map
 * @param {object}  options.appConfig - App-level config for per-task LLM resolution
 * @param {object}  options.graphProvider - Graph database adapter
 * @param {object}  options.storage - Local storage adapter
 */
class AutoSummary {
    constructor(options = {}) {
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Generate a structured executive summary covering overview, people,
     * topics, decisions, risks, questions, and next steps.
     * @returns {Promise<{summary?: string, context?: object, generatedAt?: string, error?: string}>}
     */
    async generateProjectSummary() {
        const context = await this.gatherContext();
        
        const prompt = `Based on the following project knowledge, generate a comprehensive executive summary.

PROJECT CONTEXT:
${JSON.stringify(context, null, 2)}

Generate a structured summary with these sections:
1. **Project Overview** (2-3 sentences)
2. **Key People** (who is involved and their roles)
3. **Main Topics** (what is being discussed/worked on)
4. **Recent Decisions** (if any)
5. **Open Risks** (if any)
6. **Pending Questions** (if any)
7. **Recommended Next Steps** (based on the context)

Keep it concise but informative. Use bullet points where appropriate.`;

        try {
            const config = this.appConfig || { llm: this.llmConfig || { provider: this.llmProvider, models: { text: this.llmModel }, providers: { [this.llmProvider]: this.llmConfig?.providers?.[this.llmProvider] || {} } } };
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.3,
                maxTokens: 1500
            }, config);

            if (routerResult.success) {
                return {
                    summary: routerResult.result?.text || routerResult.result?.response,
                    context,
                    generatedAt: new Date().toISOString()
                };
            }
            return { error: routerResult.error?.message || routerResult.error };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Gather context from graph and storage
     */
    async gatherContext() {
        const context = {
            people: [],
            topics: [],
            decisions: [],
            risks: [],
            questions: [],
            recentActivity: []
        };

        // From storage
        if (this.storage) {
            const allPeople = await this.storage.getPeople();
            context.people = (allPeople || []).slice(0, 20).map(p => ({
                name: p.name,
                role: p.role,
                organization: p.organization
            }));

            const allDecisions = await this.storage.getDecisions();
            context.decisions = (allDecisions || []).slice(0, 10).map(d => ({
                content: d.content,
                owner: d.owner,
                date: d.date
            }));

            const allRisks = await this.storage.getRisks();
            context.risks = (allRisks || []).slice(0, 10).map(r => ({
                content: r.content,
                impact: r.impact,
                status: r.status
            }));

            const allQuestions = await this.storage.getQuestions('pending');
            context.questions = (allQuestions || []).slice(0, 10).map(q => ({
                content: q.content,
                priority: q.priority
            }));

            // Extract topics from facts
            const facts = await this.storage.getFacts();
            const topicSet = new Set();
            facts.forEach(f => {
                if (f.category && f.category !== 'general') {
                    topicSet.add(f.category);
                }
            });
            context.topics = Array.from(topicSet);
        }

        // From graph
        if (this.graphProvider && this.graphProvider.connected) {
            try {
                // Get projects
                const projects = await this.graphProvider.query(
                    'MATCH (p:Project) RETURN p.name as name, p.status as status LIMIT 10'
                );
                if (projects.ok) {
                    context.projects = projects.results;
                }

                // Get technologies
                const tech = await this.graphProvider.query(
                    'MATCH (t:Technology) RETURN t.name as name LIMIT 10'
                );
                if (tech.ok) {
                    context.technologies = tech.results?.map(t => t.name) || [];
                }

                // Get recent meetings
                const meetings = await this.graphProvider.query(
                    'MATCH (m:Meeting) RETURN m.title as title, m.date as date ORDER BY m.date DESC LIMIT 5'
                );
                if (meetings.ok) {
                    context.recentMeetings = meetings.results;
                }
            } catch (e) {
                // Graph queries failed, continue with storage data
            }
        }

        return context;
    }

    /**
     * Generate a daily/weekly digest
     */
    async generateDigest(period = 'daily') {
        const context = await this.gatherContext();
        
        const prompt = `Generate a ${period} digest for this project.

CONTEXT:
${JSON.stringify(context, null, 2)}

Format as a brief ${period} update email that highlights:
- What happened
- Key updates
- Action items
- Upcoming priorities

Keep it under 300 words.`;

        try {
            const config = this.appConfig || { llm: this.llmConfig || { provider: this.llmProvider, models: { text: this.llmModel }, providers: { [this.llmProvider]: this.llmConfig?.providers?.[this.llmProvider] || {} } } };
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.4,
                maxTokens: 600
            }, config);

            return routerResult.success ? { digest: routerResult.result?.text || routerResult.result?.response, period } : { error: routerResult.error?.message || routerResult.error };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Generate a brief summary for a single entity by querying its
     * properties and relationships from the graph.
     * @param {string} entityType - Graph label (e.g. 'Person', 'Project')
     * @param {string} entityName - Entity name property value
     * @returns {Promise<{entity?: string, type?: string, summary?: string, relationships?: Array, error?: string}>}
     */
    async generateEntitySummary(entityType, entityName) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        // Get entity and its relationships
        const entityQuery = `
            MATCH (e:${entityType} {name: $name})
            OPTIONAL MATCH (e)-[r]-(related)
            RETURN e, collect({type: type(r), related: related.name, relatedType: labels(related)[0]}) as relationships
        `;

        try {
            const result = await this.graphProvider.query(entityQuery, { name: entityName });
            if (!result.ok || !result.results?.length) {
                return { error: 'Entity not found' };
            }

            const entity = result.results[0];
            
            const prompt = `Summarize this ${entityType.toLowerCase()} based on the knowledge graph data:

Entity: ${entityName}
Properties: ${JSON.stringify(entity.e?.properties || {})}
Relationships: ${JSON.stringify(entity.relationships || [])}

Provide a brief 2-3 sentence summary of who/what this is and their role in the project.`;

            const config = this.appConfig || { llm: this.llmConfig || { provider: this.llmProvider, models: { text: this.llmModel }, providers: { [this.llmProvider]: this.llmConfig?.providers?.[this.llmProvider] || {} } } };
            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.3,
                maxTokens: 300
            }, config);

            return routerResult.success ? {
                entity: entityName,
                type: entityType,
                summary: routerResult.result?.text || routerResult.result?.response,
                relationships: entity.relationships
            } : { error: routerResult.error?.message || routerResult.error };
        } catch (e) {
            return { error: e.message };
        }
    }
}

// Singleton
let autoSummaryInstance = null;
function getAutoSummary(options = {}) {
    if (!autoSummaryInstance) {
        autoSummaryInstance = new AutoSummary(options);
    }
    if (options.graphProvider) autoSummaryInstance.setGraphProvider(options.graphProvider);
    if (options.storage) autoSummaryInstance.setStorage(options.storage);
    if (options.llmConfig) autoSummaryInstance.llmConfig = options.llmConfig;
    return autoSummaryInstance;
}

module.exports = { AutoSummary, getAutoSummary };
