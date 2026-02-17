/**
 * Purpose:
 *   Generates role-specific dashboard payloads -- widgets, metrics, alerts,
 *   and quick-action shortcuts tailored to the user's normalised role.
 *
 * Responsibilities:
 *   - Map free-text role titles to canonical role keys via normalizeRole()
 *   - Return per-role widget/metric/focus-area configurations
 *   - Compute project health score (starts at 100, penalised by high risks,
 *     overdue actions, pending questions)
 *   - Build priority item lists sorted by the role's category preferences
 *   - Surface danger/warning/info alerts based on knowledge state
 *
 * Key dependencies:
 *   - storage: project-scoped storage for knowledge and questions (injected)
 *
 * Side effects:
 *   - None (pure computation over injected storage)
 *
 * Notes:
 *   - Widget configs are static lookup tables; no persistence layer needed.
 *   - Health score clamps to [0, 100]. The deduction weights (10 per high-risk,
 *     5 per overdue action, 2 per pending question capped at 20) are intentionally
 *     simple and may need calibration per organisation.
 */

class RoleDashboard {
    constructor(options = {}) {
        this.storage = options.storage;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Get dashboard widgets configuration for a role
     */
    getWidgetConfig(role, rolePrompt = '') {
        const normalizedRole = this.normalizeRole(role);
        
        // Default widget config
        const defaultConfig = {
            widgets: ['summary', 'recent_activity', 'quick_actions'],
            priority: ['facts', 'questions', 'actions'],
            metrics: ['total_facts', 'pending_questions', 'open_risks']
        };
        
        // Role-specific configurations
        const configs = {
            'tech_lead': {
                widgets: ['technical_health', 'architecture_decisions', 'technical_debt', 'security_alerts', 'performance_metrics'],
                priority: ['architecture', 'security', 'technical_debt', 'performance'],
                metrics: ['technical_decisions', 'code_reviews', 'security_issues', 'performance_score'],
                focusAreas: ['Technical decisions', 'Security vulnerabilities', 'Performance issues', 'Architecture changes']
            },
            'developer': {
                widgets: ['my_tasks', 'code_changes', 'blockers', 'team_updates'],
                priority: ['tasks', 'bugs', 'features', 'code_review'],
                metrics: ['assigned_tasks', 'completed_tasks', 'open_bugs', 'pr_pending'],
                focusAreas: ['Assigned tasks', 'Bug fixes', 'Feature implementations', 'Code reviews']
            },
            'project_manager': {
                widgets: ['project_health', 'timeline_risks', 'resource_allocation', 'stakeholder_updates', 'budget_status'],
                priority: ['risks', 'timeline', 'resources', 'decisions'],
                metrics: ['milestone_progress', 'risk_count', 'blocker_count', 'decision_pending'],
                focusAreas: ['Timeline risks', 'Resource conflicts', 'Key decisions', 'Stakeholder updates']
            },
            'product_owner': {
                widgets: ['backlog_health', 'user_feedback', 'feature_progress', 'metrics_dashboard'],
                priority: ['features', 'feedback', 'metrics', 'backlog'],
                metrics: ['feature_completion', 'user_satisfaction', 'backlog_size', 'sprint_velocity'],
                focusAreas: ['User feedback', 'Feature requests', 'Product metrics', 'Roadmap progress']
            },
            'qa_engineer': {
                widgets: ['test_coverage', 'bug_tracker', 'release_readiness', 'quality_metrics'],
                priority: ['bugs', 'testing', 'releases', 'quality'],
                metrics: ['open_bugs', 'test_pass_rate', 'regression_count', 'release_blocks'],
                focusAreas: ['Bug tracking', 'Test results', 'Release blockers', 'Quality trends']
            },
            'devops': {
                widgets: ['system_health', 'deployment_status', 'alerts', 'infrastructure_metrics'],
                priority: ['deployments', 'incidents', 'infrastructure', 'monitoring'],
                metrics: ['uptime', 'deploy_frequency', 'incident_count', 'alert_count'],
                focusAreas: ['System health', 'Deployment status', 'Active incidents', 'Infrastructure']
            },
            'executive': {
                widgets: ['executive_summary', 'key_metrics', 'risk_overview', 'decision_queue'],
                priority: ['strategic', 'risks', 'budget', 'milestones'],
                metrics: ['project_health', 'budget_variance', 'milestone_status', 'risk_exposure'],
                focusAreas: ['Executive summary', 'Key risks', 'Budget status', 'Strategic decisions']
            }
        };
        
        return configs[normalizedRole] || defaultConfig;
    }

    /**
     * Normalize role to config key
     */
    normalizeRole(role) {
        if (!role) return 'default';
        const lower = role.toLowerCase();
        
        const mappings = {
            'tech': 'tech_lead',
            'architect': 'tech_lead',
            'lead': 'tech_lead',
            'developer': 'developer',
            'engineer': 'developer',
            'coder': 'developer',
            'pm': 'project_manager',
            'manager': 'project_manager',
            'product': 'product_owner',
            'po': 'product_owner',
            'qa': 'qa_engineer',
            'test': 'qa_engineer',
            'quality': 'qa_engineer',
            'devops': 'devops',
            'sre': 'devops',
            'ops': 'devops',
            'executive': 'executive',
            'cto': 'executive',
            'ceo': 'executive',
            'director': 'executive'
        };
        
        for (const [key, value] of Object.entries(mappings)) {
            if (lower.includes(key)) return value;
        }
        
        return 'default';
    }

    /**
     * Generate dashboard data for a role
     */
    generateDashboard(role, rolePrompt = '') {
        if (!this.storage) {
            return { error: 'Storage not configured' };
        }
        
        const config = this.getWidgetConfig(role, rolePrompt);
        const knowledge = this.storage.getAllKnowledge?.() || {};
        const questions = this.storage.getQuestions?.() || [];
        
        // Base dashboard data
        const dashboard = {
            role,
            config,
            timestamp: new Date().toISOString(),
            widgets: {}
        };
        
        // Generate summary widget
        dashboard.widgets.summary = this.generateSummary(knowledge, questions, config);
        
        // Generate priority items
        dashboard.widgets.priorityItems = this.getPriorityItems(knowledge, questions, config);
        
        // Generate metrics
        dashboard.widgets.metrics = this.getMetrics(knowledge, questions, config);
        
        // Generate focus areas
        dashboard.widgets.focusAreas = this.getFocusAreaData(knowledge, questions, config);
        
        // Generate quick actions
        dashboard.widgets.quickActions = this.getQuickActions(role, config);
        
        // Generate alerts
        dashboard.widgets.alerts = this.getAlerts(knowledge, questions, config);
        
        return dashboard;
    }

    /**
     * Generate summary for dashboard
     */
    generateSummary(knowledge, questions, config) {
        const facts = knowledge.facts || [];
        const decisions = knowledge.decisions || [];
        const risks = knowledge.risks || [];
        const actions = knowledge.actions || [];
        
        const pendingQuestions = questions.filter(q => q.status !== 'resolved');
        const highRisks = risks.filter(r => r.impact === 'high' && r.status !== 'mitigated');
        const overdueActions = actions.filter(a => {
            if (!a.deadline || a.status === 'completed') return false;
            return new Date(a.deadline) < new Date();
        });
        
        return {
            totalFacts: facts.length,
            totalDecisions: decisions.length,
            pendingQuestions: pendingQuestions.length,
            openRisks: risks.filter(r => r.status !== 'mitigated').length,
            highRisks: highRisks.length,
            pendingActions: actions.filter(a => a.status !== 'completed').length,
            overdueActions: overdueActions.length,
            healthScore: this.calculateHealthScore(knowledge, questions)
        };
    }

    /**
     * Calculate project health score
     */
    calculateHealthScore(knowledge, questions) {
        let score = 100;
        
        const risks = knowledge.risks || [];
        const actions = knowledge.actions || [];
        
        // Reduce for high risks
        const highRisks = risks.filter(r => r.impact === 'high' && r.status !== 'mitigated').length;
        score -= highRisks * 10;
        
        // Reduce for overdue actions
        const overdueActions = actions.filter(a => {
            if (!a.deadline || a.status === 'completed') return false;
            return new Date(a.deadline) < new Date();
        }).length;
        score -= overdueActions * 5;
        
        // Reduce for unresolved questions
        const pendingQuestions = questions.filter(q => q.status !== 'resolved').length;
        score -= Math.min(pendingQuestions * 2, 20);
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get priority items based on role
     */
    getPriorityItems(knowledge, questions, config) {
        const items = [];
        const priorityCategories = config.priority || [];
        
        // Add high-priority risks
        const risks = knowledge.risks || [];
        risks.filter(r => r.impact === 'high' && r.status !== 'mitigated')
            .slice(0, 5)
            .forEach(r => items.push({
                type: 'risk',
                priority: 'high',
                content: r.content,
                category: 'risks'
            }));
        
        // Add overdue actions
        const actions = knowledge.actions || [];
        actions.filter(a => {
            if (!a.deadline || a.status === 'completed') return false;
            return new Date(a.deadline) < new Date();
        }).slice(0, 5)
            .forEach(a => items.push({
                type: 'action',
                priority: 'high',
                content: a.task,
                deadline: a.deadline,
                category: 'actions'
            }));
        
        // Add pending decisions
        const decisions = knowledge.decisions || [];
        decisions.filter(d => d.status === 'pending')
            .slice(0, 3)
            .forEach(d => items.push({
                type: 'decision',
                priority: 'medium',
                content: d.content,
                category: 'decisions'
            }));
        
        // Sort by priority matching role config
        items.sort((a, b) => {
            const aIdx = priorityCategories.indexOf(a.category);
            const bIdx = priorityCategories.indexOf(b.category);
            if (aIdx === -1 && bIdx === -1) return 0;
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
        
        return items.slice(0, 10);
    }

    /**
     * Get metrics for dashboard
     */
    getMetrics(knowledge, questions, config) {
        const facts = knowledge.facts || [];
        const decisions = knowledge.decisions || [];
        const risks = knowledge.risks || [];
        const actions = knowledge.actions || [];
        
        return {
            total_facts: facts.length,
            pending_questions: questions.filter(q => q.status !== 'resolved').length,
            resolved_questions: questions.filter(q => q.status === 'resolved').length,
            total_decisions: decisions.length,
            pending_decisions: decisions.filter(d => d.status === 'pending').length,
            open_risks: risks.filter(r => r.status !== 'mitigated').length,
            high_risks: risks.filter(r => r.impact === 'high' && r.status !== 'mitigated').length,
            pending_actions: actions.filter(a => a.status !== 'completed').length,
            completed_actions: actions.filter(a => a.status === 'completed').length
        };
    }

    /**
     * Get focus area data
     */
    getFocusAreaData(knowledge, questions, config) {
        const focusAreas = config.focusAreas || [];
        const data = {};
        
        focusAreas.forEach(area => {
            const areaKey = area.toLowerCase().replace(/\s+/g, '_');
            data[areaKey] = {
                label: area,
                count: this.countItemsForArea(area, knowledge, questions)
            };
        });
        
        return data;
    }

    /**
     * Count items relevant to a focus area
     */
    countItemsForArea(area, knowledge, questions) {
        const areaLower = area.toLowerCase();
        let count = 0;
        
        // Check facts
        const facts = knowledge.facts || [];
        count += facts.filter(f => 
            (f.category || '').toLowerCase().includes(areaLower) ||
            (f.content || '').toLowerCase().includes(areaLower)
        ).length;
        
        // Check risks
        const risks = knowledge.risks || [];
        count += risks.filter(r =>
            (r.content || '').toLowerCase().includes(areaLower)
        ).length;
        
        return count;
    }

    /**
     * Get quick actions for role
     */
    getQuickActions(role, config) {
        const normalizedRole = this.normalizeRole(role);
        
        const actions = {
            'tech_lead': [
                { id: 'review_architecture', label: 'Review Architecture Decisions', icon: '🏗️' },
                { id: 'check_security', label: 'Check Security Issues', icon: '🔒' },
                { id: 'tech_debt_review', label: 'Review Technical Debt', icon: '📋' }
            ],
            'developer': [
                { id: 'my_tasks', label: 'View My Tasks', icon: '📝' },
                { id: 'add_bug', label: 'Report Bug', icon: '🐛' },
                { id: 'code_review', label: 'Pending Reviews', icon: '👀' }
            ],
            'project_manager': [
                { id: 'risk_review', label: 'Review Risks', icon: '⚠️' },
                { id: 'timeline_check', label: 'Check Timeline', icon: '📅' },
                { id: 'status_report', label: 'Generate Report', icon: '📊' }
            ],
            'product_owner': [
                { id: 'backlog_review', label: 'Review Backlog', icon: '📋' },
                { id: 'feedback_check', label: 'User Feedback', icon: '💬' },
                { id: 'feature_status', label: 'Feature Status', icon: '✨' }
            ],
            'qa_engineer': [
                { id: 'bug_list', label: 'Open Bugs', icon: '🐛' },
                { id: 'test_status', label: 'Test Status', icon: '🧪' },
                { id: 'release_check', label: 'Release Readiness', icon: '🚀' }
            ],
            'devops': [
                { id: 'system_status', label: 'System Status', icon: '💻' },
                { id: 'recent_deploys', label: 'Recent Deploys', icon: '🚀' },
                { id: 'active_alerts', label: 'Active Alerts', icon: '🔔' }
            ],
            'executive': [
                { id: 'exec_summary', label: 'Executive Summary', icon: '📊' },
                { id: 'key_decisions', label: 'Pending Decisions', icon: '🎯' },
                { id: 'risk_overview', label: 'Risk Overview', icon: '⚠️' }
            ],
            'default': [
                { id: 'ask_question', label: 'Ask Question', icon: '❓' },
                { id: 'view_facts', label: 'Browse Facts', icon: '📚' },
                { id: 'recent_changes', label: 'Recent Changes', icon: '🔄' }
            ]
        };
        
        return actions[normalizedRole] || actions.default;
    }

    /**
     * Get alerts for dashboard
     */
    getAlerts(knowledge, questions, config) {
        const alerts = [];
        
        // High risk alert
        const risks = knowledge.risks || [];
        const highRisks = risks.filter(r => r.impact === 'high' && r.status !== 'mitigated');
        if (highRisks.length > 0) {
            alerts.push({
                type: 'danger',
                title: 'High Risk Items',
                message: `${highRisks.length} high-impact risk(s) require attention`,
                count: highRisks.length
            });
        }
        
        // Overdue actions alert
        const actions = knowledge.actions || [];
        const overdueActions = actions.filter(a => {
            if (!a.deadline || a.status === 'completed') return false;
            return new Date(a.deadline) < new Date();
        });
        if (overdueActions.length > 0) {
            alerts.push({
                type: 'warning',
                title: 'Overdue Actions',
                message: `${overdueActions.length} action(s) past deadline`,
                count: overdueActions.length
            });
        }
        
        // Pending questions alert
        const pendingQuestions = questions.filter(q => q.status !== 'resolved' && q.priority === 'high');
        if (pendingQuestions.length > 0) {
            alerts.push({
                type: 'info',
                title: 'High Priority Questions',
                message: `${pendingQuestions.length} high-priority question(s) pending`,
                count: pendingQuestions.length
            });
        }
        
        return alerts;
    }
}

// Singleton
let instance = null;
function getRoleDashboard(options) {
    if (!instance) {
        instance = new RoleDashboard(options);
    }
    return instance;
}

module.exports = { RoleDashboard, getRoleDashboard };
