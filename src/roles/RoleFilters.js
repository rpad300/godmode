/**
 * Role-based Filters
 * Filter and prioritize content based on role relevance
 */

const { getRoleTemplates } = require('./RoleTemplates');

class RoleFilters {
    constructor(options = {}) {
        this.storage = options.storage;
        this.templates = options.templates || getRoleTemplates();
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Get relevance keywords for a role
     */
    getRelevanceKeywords(role, rolePrompt = '') {
        // Get from template
        const template = this.templates.suggestFromTitle(role)[0];
        const templateKeywords = template?.keywords || [];
        
        // Extract from rolePrompt
        const promptKeywords = this.extractKeywords(rolePrompt);
        
        // Combine and dedupe
        return [...new Set([...templateKeywords, ...promptKeywords])];
    }

    /**
     * Extract keywords from text
     */
    extractKeywords(text) {
        if (!text) return [];
        
        const keywords = [];
        const lower = text.toLowerCase();
        
        // Common focus area keywords
        const focusAreas = [
            'security', 'performance', 'architecture', 'design', 'testing',
            'deployment', 'infrastructure', 'budget', 'timeline', 'risk',
            'quality', 'user', 'feature', 'bug', 'code', 'api', 'database',
            'frontend', 'backend', 'mobile', 'cloud', 'devops', 'analytics',
            'compliance', 'legal', 'privacy', 'accessibility', 'scalability'
        ];
        
        focusAreas.forEach(area => {
            if (lower.includes(area)) {
                keywords.push(area);
            }
        });
        
        return keywords;
    }

    /**
     * Score content relevance for a role
     */
    scoreRelevance(content, role, rolePrompt = '') {
        const keywords = this.getRelevanceKeywords(role, rolePrompt);
        if (keywords.length === 0) return 50; // Neutral score
        
        const contentText = typeof content === 'string' 
            ? content.toLowerCase()
            : JSON.stringify(content).toLowerCase();
        
        let score = 30; // Base score
        let matches = 0;
        
        keywords.forEach(keyword => {
            if (contentText.includes(keyword)) {
                matches++;
                score += 10;
            }
        });
        
        // Boost for multiple matches
        if (matches > 3) score += 15;
        
        return Math.min(100, score);
    }

    /**
     * Filter facts by role relevance
     */
    filterFacts(facts, role, rolePrompt = '', options = {}) {
        const { threshold = 40, limit = 100 } = options;
        
        const scored = facts.map(fact => ({
            ...fact,
            relevanceScore: this.scoreRelevance(fact.content, role, rolePrompt)
        }));
        
        return scored
            .filter(f => f.relevanceScore >= threshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    /**
     * Filter decisions by role relevance
     */
    filterDecisions(decisions, role, rolePrompt = '', options = {}) {
        const { threshold = 30, limit = 50 } = options;
        
        const scored = decisions.map(decision => ({
            ...decision,
            relevanceScore: this.scoreRelevance(decision.content, role, rolePrompt)
        }));
        
        return scored
            .filter(d => d.relevanceScore >= threshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    /**
     * Filter risks by role relevance
     */
    filterRisks(risks, role, rolePrompt = '', options = {}) {
        const { threshold = 30, limit = 50 } = options;
        
        const scored = risks.map(risk => {
            let score = this.scoreRelevance(risk.content, role, rolePrompt);
            
            // Boost high-impact risks
            if (risk.impact === 'high') score += 20;
            else if (risk.impact === 'medium') score += 10;
            
            // Boost unmitigated risks
            if (risk.status !== 'mitigated') score += 10;
            
            return { ...risk, relevanceScore: Math.min(100, score) };
        });
        
        return scored
            .filter(r => r.relevanceScore >= threshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    /**
     * Filter actions by role relevance
     */
    filterActions(actions, role, rolePrompt = '', options = {}) {
        const { threshold = 30, limit = 50 } = options;
        
        const scored = actions.map(action => {
            let score = this.scoreRelevance(action.task, role, rolePrompt);
            
            // Boost overdue
            if (action.deadline && new Date(action.deadline) < new Date() && action.status !== 'completed') {
                score += 25;
            }
            
            // Boost pending
            if (action.status !== 'completed') score += 10;
            
            return { ...action, relevanceScore: Math.min(100, score) };
        });
        
        return scored
            .filter(a => a.relevanceScore >= threshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    /**
     * Filter questions by role relevance
     */
    filterQuestions(questions, role, rolePrompt = '', options = {}) {
        const { threshold = 30, limit = 50 } = options;
        
        const scored = questions.map(question => {
            let score = this.scoreRelevance(question.question || question.content, role, rolePrompt);
            
            // Boost high priority
            if (question.priority === 'high') score += 20;
            
            // Boost pending
            if (question.status !== 'resolved') score += 10;
            
            return { ...question, relevanceScore: Math.min(100, score) };
        });
        
        return scored
            .filter(q => q.relevanceScore >= threshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    /**
     * Get filtered knowledge for a role
     */
    getFilteredKnowledge(role, rolePrompt = '', options = {}) {
        if (!this.storage) {
            return { error: 'Storage not configured' };
        }
        
        const knowledge = this.storage.getAllKnowledge?.() || {};
        const questions = this.storage.getQuestions?.() || [];
        
        return {
            facts: this.filterFacts(knowledge.facts || [], role, rolePrompt, options),
            decisions: this.filterDecisions(knowledge.decisions || [], role, rolePrompt, options),
            risks: this.filterRisks(knowledge.risks || [], role, rolePrompt, options),
            actions: this.filterActions(knowledge.actions || [], role, rolePrompt, options),
            questions: this.filterQuestions(questions, role, rolePrompt, options),
            role,
            filterApplied: true
        };
    }

    /**
     * Get relevance summary for a role
     */
    getRelevanceSummary(role, rolePrompt = '') {
        if (!this.storage) {
            return { error: 'Storage not configured' };
        }
        
        const knowledge = this.storage.getAllKnowledge?.() || {};
        const questions = this.storage.getQuestions?.() || [];
        
        const facts = knowledge.facts || [];
        const decisions = knowledge.decisions || [];
        const risks = knowledge.risks || [];
        const actions = knowledge.actions || [];
        
        const highRelevanceThreshold = 60;
        
        return {
            role,
            keywords: this.getRelevanceKeywords(role, rolePrompt),
            stats: {
                facts: {
                    total: facts.length,
                    highRelevance: this.filterFacts(facts, role, rolePrompt, { threshold: highRelevanceThreshold }).length
                },
                decisions: {
                    total: decisions.length,
                    highRelevance: this.filterDecisions(decisions, role, rolePrompt, { threshold: highRelevanceThreshold }).length
                },
                risks: {
                    total: risks.length,
                    highRelevance: this.filterRisks(risks, role, rolePrompt, { threshold: highRelevanceThreshold }).length
                },
                actions: {
                    total: actions.length,
                    highRelevance: this.filterActions(actions, role, rolePrompt, { threshold: highRelevanceThreshold }).length
                },
                questions: {
                    total: questions.length,
                    highRelevance: this.filterQuestions(questions, role, rolePrompt, { threshold: highRelevanceThreshold }).length
                }
            }
        };
    }
}

// Singleton
let instance = null;
function getRoleFilters(options) {
    if (!instance) {
        instance = new RoleFilters(options);
    }
    return instance;
}

module.exports = { RoleFilters, getRoleFilters };
