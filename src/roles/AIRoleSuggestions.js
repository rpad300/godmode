/**
 * AI Role Suggestions
 * Uses LLM to suggest role prompts based on user activity
 */

const llm = require('../llm');
const { getRoleTemplates } = require('./RoleTemplates');

class AIRoleSuggestions {
    constructor(options = {}) {
        this.storage = options.storage;
        this.llmConfig = options.llmConfig || {};
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Analyze user activity and suggest a role prompt
     */
    async suggestRolePrompt(currentRole = '', options = {}) {
        if (!this.storage) {
            return { suggestions: [], error: 'Storage not configured' };
        }

        try {
            // Gather activity data
            const activityData = this.gatherActivityData();
            
            // Get relevant templates
            const templates = getRoleTemplates();
            const suggestedTemplates = templates.suggestFromTitle(currentRole);
            
            // If we have enough context, use AI to generate custom suggestion
            if (activityData.hasEnoughData) {
                const aiSuggestion = await this.generateAISuggestion(currentRole, activityData);
                
                return {
                    success: true,
                    aiSuggestion,
                    templateSuggestions: suggestedTemplates,
                    activityInsights: activityData.insights
                };
            }
            
            // Otherwise, just return template suggestions
            return {
                success: true,
                aiSuggestion: null,
                templateSuggestions: suggestedTemplates,
                activityInsights: activityData.insights,
                needsMoreData: true
            };
        } catch (error) {
            console.error('[AIRoleSuggestions] Error:', error.message);
            return {
                success: false,
                error: error.message,
                templateSuggestions: getRoleTemplates().suggestFromTitle(currentRole)
            };
        }
    }

    /**
     * Gather activity data from storage
     */
    gatherActivityData() {
        const insights = [];
        let hasEnoughData = false;
        
        // Get questions asked
        const questions = this.storage.getQuestions?.() || [];
        const recentQuestions = questions.slice(-20);
        
        // Get facts by category
        const knowledge = this.storage.getAllKnowledge?.() || {};
        const facts = knowledge.facts || [];
        const factCategories = {};
        facts.forEach(f => {
            const cat = f.category || 'general';
            factCategories[cat] = (factCategories[cat] || 0) + 1;
        });
        
        // Get decisions and actions
        const decisions = knowledge.decisions || [];
        const actions = knowledge.actions || [];
        const risks = knowledge.risks || [];
        
        // Analyze patterns
        if (recentQuestions.length > 5) {
            hasEnoughData = true;
            
            // Find common themes in questions
            const questionThemes = this.analyzeThemes(recentQuestions.map(q => q.question || q.content));
            if (questionThemes.length > 0) {
                insights.push({
                    type: 'questions',
                    message: `You frequently ask about: ${questionThemes.join(', ')}`,
                    themes: questionThemes
                });
            }
        }
        
        // Analyze fact categories
        const topCategories = Object.entries(factCategories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat]) => cat);
            
        if (topCategories.length > 0) {
            insights.push({
                type: 'facts',
                message: `Your knowledge focuses on: ${topCategories.join(', ')}`,
                categories: topCategories
            });
        }
        
        // Check for management vs technical focus
        const hasMgmtFocus = decisions.length > 5 || actions.length > 10;
        const hasTechFocus = factCategories.technical > 5 || factCategories.architecture > 3;
        const hasRiskFocus = risks.length > 3;
        
        if (hasMgmtFocus) {
            insights.push({
                type: 'focus',
                message: 'Your activity suggests a management/coordination role',
                indicator: 'management'
            });
        }
        
        if (hasTechFocus) {
            insights.push({
                type: 'focus', 
                message: 'Your activity suggests a technical focus',
                indicator: 'technical'
            });
        }
        
        if (hasRiskFocus) {
            insights.push({
                type: 'focus',
                message: 'You track risks actively',
                indicator: 'risk_aware'
            });
        }
        
        return {
            hasEnoughData,
            insights,
            data: {
                questionCount: recentQuestions.length,
                factCategories,
                decisionCount: decisions.length,
                actionCount: actions.length,
                riskCount: risks.length,
                recentQuestions: recentQuestions.slice(-5).map(q => q.question || q.content)
            }
        };
    }

    /**
     * Analyze themes from text array
     */
    analyzeThemes(texts) {
        const themes = {};
        const keywords = {
            'timeline': ['deadline', 'when', 'date', 'schedule', 'timeline', 'milestone'],
            'technical': ['code', 'api', 'bug', 'error', 'implementation', 'architecture'],
            'resources': ['team', 'capacity', 'resource', 'availability', 'assign'],
            'risks': ['risk', 'blocker', 'issue', 'problem', 'concern'],
            'decisions': ['decision', 'approve', 'choose', 'option', 'recommendation'],
            'status': ['status', 'progress', 'update', 'state', 'current'],
            'budget': ['budget', 'cost', 'expense', 'price', 'money']
        };
        
        texts.forEach(text => {
            const lower = (text || '').toLowerCase();
            Object.entries(keywords).forEach(([theme, words]) => {
                if (words.some(w => lower.includes(w))) {
                    themes[theme] = (themes[theme] || 0) + 1;
                }
            });
        });
        
        return Object.entries(themes)
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([theme]) => theme);
    }

    /**
     * Generate AI-powered role suggestion
     */
    async generateAISuggestion(currentRole, activityData) {
        const prompt = `Based on a user's activity in a project management system, suggest a personalized role context prompt.

CURRENT ROLE TITLE: ${currentRole || 'Not specified'}

USER ACTIVITY:
- Questions asked: ${activityData.data.questionCount}
- Recent questions: ${activityData.data.recentQuestions.join('; ')}
- Fact categories tracked: ${JSON.stringify(activityData.data.factCategories)}
- Decisions recorded: ${activityData.data.decisionCount}
- Actions tracked: ${activityData.data.actionCount}
- Risks monitored: ${activityData.data.riskCount}

ACTIVITY INSIGHTS:
${activityData.insights.map(i => `- ${i.message}`).join('\n')}

Generate a role context prompt that:
1. Reflects their actual focus areas based on activity
2. Specifies what information is most relevant to them
3. Is written in first person ("I am responsible for...", "I need to know about...")
4. Is 100-200 words

Respond with ONLY the role prompt text, no explanations.`;

        try {
            const result = await llm.generateText({
                provider: this.llmConfig?.provider || 'ollama',
                providerConfig: this.llmConfig?.providers?.[this.llmConfig?.provider || 'ollama'] || {},
                model: this.llmConfig?.models?.text || 'llama3.2',
                prompt,
                temperature: 0.7,
                maxTokens: 500
            });

            if (result.success) {
                return {
                    prompt: result.text.trim(),
                    basedOn: activityData.insights
                };
            }
        } catch (error) {
            console.error('[AIRoleSuggestions] LLM error:', error.message);
        }
        
        return null;
    }

    /**
     * Generate role prompt from job title using AI
     */
    async generateFromTitle(jobTitle) {
        const prompt = `Generate a role context prompt for someone with the job title: "${jobTitle}"

The prompt should:
1. Be written in first person
2. Describe key responsibilities and focus areas
3. Specify what information is most important for this role
4. Be 100-150 words

Respond with ONLY the prompt text.`;

        try {
            const result = await llm.generateText({
                provider: this.llmConfig?.provider || 'ollama',
                providerConfig: this.llmConfig?.providers?.[this.llmConfig?.provider || 'ollama'] || {},
                model: this.llmConfig?.models?.text || 'llama3.2',
                prompt,
                temperature: 0.7,
                maxTokens: 400
            });

            if (result.success) {
                return {
                    success: true,
                    prompt: result.text.trim()
                };
            }
        } catch (error) {
            console.error('[AIRoleSuggestions] Generate error:', error.message);
        }
        
        // Fallback to templates
        const templates = getRoleTemplates();
        const suggestions = templates.suggestFromTitle(jobTitle);
        if (suggestions.length > 0) {
            return {
                success: true,
                prompt: suggestions[0].prompt,
                source: 'template',
                template: suggestions[0]
            };
        }
        
        return {
            success: false,
            error: 'Could not generate prompt'
        };
    }
}

// Singleton
let instance = null;
function getAIRoleSuggestions(options) {
    if (!instance) {
        instance = new AIRoleSuggestions(options);
    }
    return instance;
}

module.exports = { AIRoleSuggestions, getAIRoleSuggestions };
