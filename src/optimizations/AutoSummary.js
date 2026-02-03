/**
 * Auto-Summary Module
 * Generates automatic project summaries based on the knowledge graph
 */

const llm = require('../llm');

class AutoSummary {
    constructor(options = {}) {
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
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
     * Generate a comprehensive project summary
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
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.3,
                maxTokens: 1500
            });

            if (result.success) {
                return {
                    summary: result.text,
                    context,
                    generatedAt: new Date().toISOString()
                };
            }
            return { error: result.error };
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
            context.people = this.storage.getPeople().slice(0, 20).map(p => ({
                name: p.name,
                role: p.role,
                organization: p.organization
            }));

            context.decisions = this.storage.getDecisions({ limit: 10 }).map(d => ({
                content: d.content,
                owner: d.owner,
                date: d.date
            }));

            context.risks = this.storage.getRisks({ limit: 10 }).map(r => ({
                content: r.content,
                impact: r.impact,
                status: r.status
            }));

            context.questions = this.storage.getQuestions({ status: 'pending', limit: 10 }).map(q => ({
                content: q.content,
                priority: q.priority
            }));

            // Extract topics from facts
            const facts = this.storage.getFacts({ limit: 30 });
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
            const result = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.4,
                maxTokens: 600
            });

            return result.success ? { digest: result.text, period } : { error: result.error };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Generate summary for a specific entity
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

            const llmResult = await llm.generateText({
                provider: this.llmProvider,
                providerConfig: this.llmConfig?.providers?.[this.llmProvider] || {},
                model: this.llmModel,
                prompt,
                temperature: 0.3,
                maxTokens: 300
            });

            return llmResult.success ? {
                entity: entityName,
                type: entityType,
                summary: llmResult.text,
                relationships: entity.relationships
            } : { error: llmResult.error };
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
