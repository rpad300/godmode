/**
 * Role Onboarding
 * Wizard to help users define their role when starting
 */

const { getRoleTemplates } = require('./RoleTemplates');

class RoleOnboarding {
    constructor(options = {}) {
        this.templates = options.templates || getRoleTemplates();
    }

    /**
     * Get onboarding steps
     */
    getSteps() {
        return [
            {
                id: 'welcome',
                title: 'Welcome to Role Setup',
                description: 'Let\'s personalize your experience by understanding your role in this project.',
                type: 'intro'
            },
            {
                id: 'select_category',
                title: 'What\'s your primary focus?',
                description: 'Select the category that best describes your work.',
                type: 'single_choice',
                options: this.templates.getCategories().map(cat => ({
                    id: cat.id,
                    label: cat.name,
                    icon: cat.icon,
                    description: `${cat.templateCount} role templates available`
                }))
            },
            {
                id: 'select_template',
                title: 'Choose a Role Template',
                description: 'Select a pre-defined role or customize your own.',
                type: 'template_select',
                dynamic: true // Options depend on previous step
            },
            {
                id: 'customize',
                title: 'Customize Your Role',
                description: 'Adjust the role prompt to match your specific responsibilities.',
                type: 'form',
                fields: [
                    {
                        id: 'role_title',
                        label: 'Your Role Title',
                        type: 'text',
                        placeholder: 'e.g., Senior Tech Lead',
                        required: true
                    },
                    {
                        id: 'role_prompt',
                        label: 'Role Context',
                        type: 'textarea',
                        placeholder: 'Describe your responsibilities...',
                        required: false
                    }
                ]
            },
            {
                id: 'preferences',
                title: 'Notification Preferences',
                description: 'What would you like to be notified about?',
                type: 'multi_choice',
                options: [
                    { id: 'high_risks', label: 'High-priority risks', default: true },
                    { id: 'overdue_actions', label: 'Overdue action items', default: true },
                    { id: 'new_decisions', label: 'New decisions', default: false },
                    { id: 'team_updates', label: 'Team activity updates', default: false },
                    { id: 'daily_briefing', label: 'Daily briefing summary', default: true }
                ]
            },
            {
                id: 'complete',
                title: 'Setup Complete!',
                description: 'Your personalized dashboard is ready.',
                type: 'complete'
            }
        ];
    }

    /**
     * Get templates for selected category
     */
    getTemplatesForCategory(categoryId) {
        return this.templates.getByCategory(categoryId);
    }

    /**
     * Process onboarding data and return final configuration
     */
    processOnboarding(data) {
        const result = {
            userRole: data.role_title || '',
            userRolePrompt: data.role_prompt || '',
            notificationPreferences: data.preferences || [],
            selectedTemplate: data.template_id || null,
            completedAt: new Date().toISOString()
        };
        
        // If template was selected but no custom prompt, use template prompt
        if (data.template_id && !data.role_prompt) {
            const template = this.templates.get(data.template_id);
            if (template) {
                result.userRolePrompt = template.prompt;
                if (!result.userRole) {
                    result.userRole = template.title;
                }
            }
        }
        
        return result;
    }

    /**
     * Get quick setup option (skip wizard)
     */
    getQuickSetupOptions() {
        const popular = [
            'project_manager',
            'developer', 
            'tech_lead',
            'product_owner',
            'qa_engineer'
        ];
        
        return popular.map(id => {
            const template = this.templates.get(id);
            return template ? { id, ...template } : null;
        }).filter(Boolean);
    }

    /**
     * Generate role suggestions based on questions asked
     */
    suggestRoleFromActivity(activityData) {
        const suggestions = [];
        
        // Analyze question patterns
        const questionKeywords = {
            'technical': ['code', 'api', 'bug', 'implementation', 'architecture'],
            'management': ['timeline', 'deadline', 'resource', 'budget', 'milestone'],
            'product': ['feature', 'user', 'feedback', 'requirement', 'backlog'],
            'quality': ['test', 'bug', 'quality', 'regression', 'release']
        };
        
        const scores = {};
        
        (activityData.questions || []).forEach(q => {
            const text = (q.question || q.content || '').toLowerCase();
            
            Object.entries(questionKeywords).forEach(([category, keywords]) => {
                keywords.forEach(keyword => {
                    if (text.includes(keyword)) {
                        scores[category] = (scores[category] || 0) + 1;
                    }
                });
            });
        });
        
        // Map categories to templates
        const categoryToTemplate = {
            'technical': 'developer',
            'management': 'project_manager',
            'product': 'product_owner',
            'quality': 'qa_engineer'
        };
        
        // Get top suggestions
        const sorted = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        
        sorted.forEach(([category, score]) => {
            const templateId = categoryToTemplate[category];
            const template = this.templates.get(templateId);
            if (template) {
                suggestions.push({
                    ...template,
                    id: templateId,
                    confidence: Math.min(100, score * 20),
                    reason: `Based on your ${score} questions about ${category} topics`
                });
            }
        });
        
        return suggestions;
    }

    /**
     * Validate onboarding data
     */
    validateStep(stepId, data) {
        const errors = [];
        
        switch (stepId) {
            case 'select_category':
                if (!data.category) {
                    errors.push('Please select a category');
                }
                break;
                
            case 'customize':
                if (!data.role_title && !data.role_prompt) {
                    errors.push('Please enter at least a role title or description');
                }
                break;
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get progress percentage
     */
    getProgress(currentStepId) {
        const steps = this.getSteps();
        const currentIndex = steps.findIndex(s => s.id === currentStepId);
        
        if (currentIndex === -1) return 0;
        
        return Math.round(((currentIndex + 1) / steps.length) * 100);
    }

    /**
     * Check if onboarding is needed
     */
    isOnboardingNeeded(project) {
        // Onboarding needed if no role is set
        return !project?.userRole && !project?.userRolePrompt;
    }

    /**
     * Get tips for role setup
     */
    getRoleTips() {
        return [
            {
                icon: '💡',
                title: 'Be Specific',
                tip: 'Instead of "Developer", try "Backend Developer focused on API design"'
            },
            {
                icon: '🎯',
                title: 'Include Focus Areas',
                tip: 'Mention what you need to track: risks, deadlines, technical decisions'
            },
            {
                icon: '📊',
                title: 'Define Priorities',
                tip: 'What information is most critical for your daily work?'
            },
            {
                icon: '🔔',
                title: 'Set Notification Preferences',
                tip: 'Choose what alerts are important to avoid notification fatigue'
            }
        ];
    }
}

// Singleton
let instance = null;
function getRoleOnboarding(options) {
    if (!instance) {
        instance = new RoleOnboarding(options);
    }
    return instance;
}

module.exports = { RoleOnboarding, getRoleOnboarding };
