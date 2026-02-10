/**
 * SOTA Source of Truth Engine
 * Advanced knowledge management with AI-powered insights
 * 
 * Refactored to use SupabaseStorage instead of local JSON files
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'sot-engine' });

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use legacy storage passed via constructor
}

class SourceOfTruthEngine {
    constructor(storageOrOptions = null, processor = null) {
        this.processor = processor;
        // Can accept legacy storage or use Supabase
        this._legacyStorage = storageOrOptions?.getFacts ? storageOrOptions : null;
    }

    /**
     * Get storage instance
     */
    _getStorage() {
        if (this._legacyStorage) return this._legacyStorage;
        if (!getStorage) return null;
        try {
            return getStorage();
        } catch (e) {
            return null;
        }
    }

    /**
     * Calculate Project Health Score (0-100)
     */
    async calculateHealthScore() {
        const storage = this._getStorage();
        
        const [stats, risks, actions, questions] = await Promise.all([
            storage.getProjectStats(),
            storage.getRisks(),
            storage.getActions(),
            storage.getQuestions()
        ]);

        let score = 100;
        const factors = [];

        // Factor 1: Open Critical Risks (-15 each, max -30)
        const criticalRisks = risks.filter(r => r.status === 'open' && r.impact === 'critical');
        const riskPenalty = Math.min(criticalRisks.length * 15, 30);
        score -= riskPenalty;
        if (criticalRisks.length > 0) {
            factors.push({ type: 'negative', factor: 'Critical Risks', impact: -riskPenalty, detail: `${criticalRisks.length} open critical risks` });
        }

        // Factor 2: Overdue Actions (-10 each, max -25)
        const today = new Date();
        const overdueActions = actions.filter(a => {
            if (a.status !== 'pending' || !a.deadline) return false;
            return new Date(a.deadline) < today;
        });
        const overduePenalty = Math.min(overdueActions.length * 10, 25);
        score -= overduePenalty;
        if (overdueActions.length > 0) {
            factors.push({ type: 'negative', factor: 'Overdue Actions', impact: -overduePenalty, detail: `${overdueActions.length} past deadline` });
        }

        // Factor 3: Critical Questions (-8 each, max -20)
        const criticalQuestions = questions.filter(q => q.priority === 'critical' && q.status === 'open');
        const questionPenalty = Math.min(criticalQuestions.length * 8, 20);
        score -= questionPenalty;
        if (criticalQuestions.length > 0) {
            factors.push({ type: 'negative', factor: 'Critical Questions', impact: -questionPenalty, detail: `${criticalQuestions.length} unanswered` });
        }

        // Factor 4: Risks without Mitigation (-5 each, max -15)
        const unmitigatedRisks = risks.filter(r => r.status === 'open' && !r.mitigation);
        const mitigationPenalty = Math.min(unmitigatedRisks.length * 5, 15);
        score -= mitigationPenalty;
        if (unmitigatedRisks.length > 0) {
            factors.push({ type: 'negative', factor: 'Unmitigated Risks', impact: -mitigationPenalty, detail: `${unmitigatedRisks.length} without mitigation plan` });
        }

        // Positive factors
        // Factor 5: Good documentation (+5, max +10)
        if (stats.facts > 10) {
            const docBonus = Math.min(Math.floor(stats.facts / 10) * 2, 10);
            score = Math.min(100, score + docBonus);
            factors.push({ type: 'positive', factor: 'Good Documentation', impact: docBonus, detail: `${stats.facts} facts documented` });
        }

        // Factor 6: Resolved Questions (+3 each, max +10)
        const resolvedQuestions = questions.filter(q => q.status === 'answered' || q.status === 'closed');
        if (resolvedQuestions.length > 0) {
            const resolvedBonus = Math.min(resolvedQuestions.length * 3, 10);
            score = Math.min(100, score + resolvedBonus);
            factors.push({ type: 'positive', factor: 'Questions Resolved', impact: resolvedBonus, detail: `${resolvedQuestions.length} answered` });
        }

        // Factor 7: Completed Actions (+2 each, max +10)
        const completedActions = actions.filter(a => a.status === 'completed');
        if (completedActions.length > 0) {
            const completedBonus = Math.min(completedActions.length * 2, 10);
            score = Math.min(100, score + completedBonus);
            factors.push({ type: 'positive', factor: 'Actions Completed', impact: completedBonus, detail: `${completedActions.length} done` });
        }

        // Ensure score is within bounds
        score = Math.max(0, Math.min(100, score));

        // Determine status
        let status, color;
        if (score >= 80) { status = 'Healthy'; color = '#2ecc71'; }
        else if (score >= 60) { status = 'Good'; color = '#27ae60'; }
        else if (score >= 40) { status = 'Needs Attention'; color = '#f39c12'; }
        else if (score >= 20) { status = 'At Risk'; color = '#e67e22'; }
        else { status = 'Critical'; color = '#e74c3c'; }

        return {
            score: Math.round(score),
            status,
            color,
            factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
            calculatedAt: new Date().toISOString()
        };
    }

    /**
     * Generate AI-powered insights
     */
    async generateInsights() {
        const storage = this._getStorage();
        
        const [facts, decisions, risks, actions, people, questions] = await Promise.all([
            storage.getFacts(),
            storage.getDecisions(),
            storage.getRisks(),
            storage.getActions(),
            storage.getPeople(),
            storage.getQuestions()
        ]);

        const insights = [];

        // Insight 1: Person workload imbalance
        const actionsByOwner = {};
        actions.filter(a => a.status === 'pending' && a.owner).forEach(a => {
            actionsByOwner[a.owner] = (actionsByOwner[a.owner] || 0) + 1;
        });
        const owners = Object.entries(actionsByOwner).sort((a, b) => b[1] - a[1]);
        if (owners.length > 0 && owners[0][1] >= 3) {
            const total = actions.filter(a => a.status === 'pending').length;
            const percentage = Math.round((owners[0][1] / total) * 100);
            if (percentage >= 50) {
                insights.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: 'Workload Concentration',
                    message: `${owners[0][0]} has ${percentage}% of pending actions (${owners[0][1]}/${total})`,
                    suggestion: 'Consider redistributing tasks for better balance',
                    category: 'workload'
                });
            }
        }

        // Insight 2: Risks without mitigation
        const unmitigated = risks.filter(r => r.status === 'open' && (!r.mitigation || r.mitigation === 'N/A'));
        if (unmitigated.length > 0) {
            insights.push({
                type: 'alert',
                icon: '🚨',
                title: 'Risks Need Mitigation',
                message: `${unmitigated.length} open risks have no mitigation plan`,
                suggestion: 'Add mitigation strategies to reduce project risk',
                category: 'risk'
            });
        }

        // Insight 3: Upcoming deadlines
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingDeadlines = actions.filter(a => {
            if (a.status !== 'pending' || !a.deadline) return false;
            const deadline = new Date(a.deadline);
            return deadline >= today && deadline <= nextWeek;
        });
        if (upcomingDeadlines.length > 0) {
            insights.push({
                type: 'info',
                icon: '📅',
                title: 'Upcoming Deadlines',
                message: `${upcomingDeadlines.length} actions due in the next 7 days`,
                suggestion: 'Review priorities and ensure timely completion',
                category: 'timeline'
            });
        }

        // Insight 4: Knowledge gaps
        const questionsOpen = questions.filter(q => q.status === 'open').length;
        const questionsTotal = questions.length;
        if (questionsOpen > 5 || (questionsTotal > 0 && questionsOpen / questionsTotal > 0.5)) {
            insights.push({
                type: 'info',
                icon: '❓',
                title: 'Knowledge Gaps',
                message: `${questionsOpen} open questions need answers`,
                suggestion: 'Schedule knowledge sessions to address these gaps',
                category: 'knowledge'
            });
        }

        // Insight 5: Recent decisions
        const recentDecisions = decisions.filter(d => {
            const date = new Date(d.created_at);
            return (Date.now() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
        });
        if (recentDecisions.length > 0) {
            insights.push({
                type: 'positive',
                icon: '✅',
                title: 'Recent Progress',
                message: `${recentDecisions.length} decisions made this week`,
                suggestion: 'Good progress! Consider documenting the rationale',
                category: 'progress'
            });
        }

        return insights;
    }

    /**
     * Generate alerts for critical items
     */
    async generateAlerts() {
        const storage = this._getStorage();
        
        const [risks, actions, questions] = await Promise.all([
            storage.getRisks(),
            storage.getActions(),
            storage.getQuestions()
        ]);

        const alerts = [];
        const today = new Date();

        // Overdue actions
        const overdueActions = actions.filter(a => {
            if (a.status !== 'pending' || !a.deadline) return false;
            return new Date(a.deadline) < today;
        });
        overdueActions.forEach(a => {
            const daysOverdue = Math.floor((today - new Date(a.deadline)) / (24 * 60 * 60 * 1000));
            alerts.push({
                severity: daysOverdue > 7 ? 'critical' : 'high',
                type: 'action',
                title: `Action Overdue (${daysOverdue} days)`,
                message: a.task,
                owner: a.owner,
                id: a.id
            });
        });

        // Critical risks
        risks.filter(r => r.status === 'open' && r.impact === 'critical').forEach(r => {
            alerts.push({
                severity: 'critical',
                type: 'risk',
                title: 'Critical Risk Open',
                message: r.content,
                owner: r.owner,
                id: r.id
            });
        });

        // Critical questions
        questions.filter(q => q.priority === 'critical' && q.status === 'open').forEach(q => {
            alerts.push({
                severity: 'high',
                type: 'question',
                title: 'Critical Question',
                message: q.content,
                assignee: q.assigned_to,
                id: q.id
            });
        });

        return alerts.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, warning: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    /**
     * Get change delta since last view
     */
    async getChangeDelta() {
        const storage = this._getStorage();
        
        // Get last view from Supabase
        let lastView = { timestamp: null, counts: {} };
        
        try {
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            const user = await storage.getCurrentUser();
            
            if (projectId && user) {
                const { data } = await supabase
                    .from('sot_last_view')
                    .select('*')
                    .eq('project_id', projectId)
                    .eq('user_id', user.id)
                    .single();
                
                if (data) {
                    lastView = {
                        timestamp: data.viewed_at,
                        counts: {
                            facts: data.facts_snapshot?.count || 0,
                            decisions: data.decisions_snapshot?.count || 0,
                            risks: data.risks_snapshot?.count || 0
                        }
                    };
                }
            }
        } catch (e) {
            // Ignore
        }

        const stats = await storage.getProjectStats();
        const currentCounts = {
            facts: stats.facts || 0,
            decisions: stats.decisions || 0,
            risks: stats.risks || 0,
            actions: stats.actions || 0,
            people: stats.people || 0,
            questions: stats.questions || 0,
            documents: stats.documents || 0
        };

        const changes = [];
        const prev = lastView.counts || {};

        for (const [key, value] of Object.entries(currentCounts)) {
            const prevValue = prev[key] || 0;
            const diff = value - prevValue;
            if (diff !== 0) {
                changes.push({
                    metric: key,
                    previous: prevValue,
                    current: value,
                    change: diff,
                    isNew: prevValue === 0 && value > 0
                });
            }
        }

        return {
            lastViewed: lastView.timestamp,
            isFirstView: !lastView.timestamp,
            changes,
            summary: changes.length === 0 ? 'No changes since last view' : 
                     changes.map(c => `${c.change > 0 ? '+' : ''}${c.change} ${c.metric}`).join(', ')
        };
    }

    /**
     * Mark as viewed (for delta calculation)
     */
    async markAsViewed() {
        const storage = this._getStorage();
        
        try {
            const stats = await storage.getProjectStats();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            const user = await storage.getCurrentUser();
            
            if (projectId && user) {
                await supabase.from('sot_last_view').upsert({
                    project_id: projectId,
                    user_id: user.id,
                    facts_snapshot: { count: stats.facts || 0 },
                    decisions_snapshot: { count: stats.decisions || 0 },
                    risks_snapshot: { count: stats.risks || 0 },
                    viewed_at: new Date().toISOString()
                }, {
                    onConflict: 'project_id,user_id'
                });
            }
            
            return { timestamp: new Date().toISOString(), counts: stats };
        } catch (e) {
            log.warn({ event: 'sot_mark_viewed_failed', reason: e.message }, 'Could not mark as viewed');
            return null;
        }
    }

    /**
     * Generate timeline data - complete project activity
     * Includes: documents, transcripts, emails, conversations, chat sessions,
     * facts, questions, decisions, risks, actions
     */
    async generateTimeline() {
        const storage = this._getStorage();
        if (!storage) return [];

        const fetches = [
            storage.getDecisions?.() ?? Promise.resolve([]),
            storage.getRisks?.() ?? Promise.resolve([]),
            storage.getActions?.() ?? Promise.resolve([]),
            storage.getActionItems?.() ?? Promise.resolve([]),
            storage.getDocuments?.() ?? Promise.resolve([]),
            storage.getFacts?.() ?? Promise.resolve([]),
            storage.getQuestions?.() ?? Promise.resolve([])
        ];
        if (storage.getEmails) fetches.push(storage.getEmails({ limit: 100 }));
        if (storage.getConversations) fetches.push(storage.getConversations());
        if (storage.getChatSessions) fetches.push(storage.getChatSessions());

        const results = await Promise.allSettled(fetches);
        const resolve = (i) => (results[i]?.status === 'fulfilled' ? results[i].value : []);

        const decisions = resolve(0);
        const risks = resolve(1);
        const actionsRaw = resolve(2).length ? resolve(2) : resolve(3);
        const documents = resolve(4);
        const facts = resolve(5);
        const questions = resolve(6);
        let i = 7;
        const emails = storage.getEmails ? resolve(i++) : [];
        const conversations = storage.getConversations ? resolve(i++) : [];
        const chatSessions = storage.getChatSessions ? resolve(i) : [];
        const actions = actionsRaw;

        const events = [];
        const toIso = (d) => (d ? (typeof d === 'string' ? d : new Date(d).toISOString()) : null);

        // Decisions
        decisions.forEach(d => {
            const date = d.decision_date || d.decided_at || d.created_at;
            if (date) {
                events.push({
                    type: 'decision',
                    icon: '📋',
                    color: '#3498db',
                    date: toIso(date),
                    title: 'Decision Made',
                    content: d.content || d.decision,
                    owner: d.owner || d.made_by,
                    id: d.id,
                    entity_id: d.id,
                    entity_type: 'decision'
                });
            }
        });

        // Risks
        risks.forEach(r => {
            const date = r.created_at;
            events.push({
                type: 'risk',
                icon: '⚠️',
                color: r.impact === 'critical' ? '#e74c3c' : r.impact === 'high' ? '#f39c12' : '#eab308',
                date: toIso(date) || new Date().toISOString(),
                title: `Risk Identified (${r.impact || 'medium'})`,
                content: r.content || r.description,
                owner: r.owner,
                id: r.id,
                entity_id: r.id,
                entity_type: 'risk',
                metadata: { status: r.status }
            });
        });

        // Actions - deadline events
        actions.forEach(a => {
            const task = a.task || a.content;
            const deadline = a.deadline || a.due_date;
            if (deadline) {
                events.push({
                    type: a.status === 'completed' ? 'action_completed' : 'deadline',
                    icon: a.status === 'completed' ? '✅' : '📅',
                    color: a.status === 'completed' ? '#2ecc71' : '#9b59b6',
                    date: toIso(deadline),
                    title: a.status === 'completed' ? 'Action Completed' : 'Action Due',
                    content: task,
                    owner: a.owner,
                    status: a.status,
                    id: a.id,
                    entity_id: a.id,
                    entity_type: 'action',
                    metadata: { status: a.status }
                });
            }
            // Also add created event
            const created = a.created_at || a.createdAt;
            if (created && task) {
                events.push({
                    type: 'action',
                    icon: '📌',
                    color: '#9b59b6',
                    date: toIso(created),
                    title: 'Action Created',
                    content: task,
                    owner: a.owner,
                    id: a.id,
                    entity_id: a.id,
                    entity_type: 'action',
                    metadata: { status: a.status }
                });
            }
        });

        // Documents (including transcripts)
        documents.forEach(doc => {
            const date = doc.processed_at || doc.created_at;
            if (date) {
                const isTranscript = (doc.doc_type || '').toLowerCase() === 'transcript';
                events.push({
                    type: isTranscript ? 'transcript' : 'document',
                    icon: isTranscript ? '🎙️' : '📄',
                    color: isTranscript ? '#8b5cf6' : '#1abc9c',
                    date: toIso(date),
                    title: isTranscript ? 'Transcript Processed' : 'Document Processed',
                    content: doc.title || doc.filename,
                    id: doc.id,
                    entity_id: doc.id,
                    entity_type: 'document',
                    metadata: { doc_type: doc.doc_type, source_file: doc.filename }
                });
            }
        });

        // Facts
        facts.forEach(f => {
            const date = f.created_at;
            if (date) {
                events.push({
                    type: 'fact',
                    icon: '📌',
                    color: '#3b82f6',
                    date: toIso(date),
                    title: 'Fact Captured',
                    content: f.content,
                    id: f.id,
                    entity_id: f.id,
                    entity_type: 'fact',
                    metadata: { category: f.category }
                });
            }
        });

        // Questions - created and answered
        questions.forEach(q => {
            const created = q.created_at;
            if (created) {
                events.push({
                    type: 'question',
                    icon: '❓',
                    color: '#f59e0b',
                    date: toIso(created),
                    title: 'Question Raised',
                    content: q.content || q.question,
                    owner: q.assigned_to,
                    id: q.id,
                    entity_id: q.id,
                    entity_type: 'question',
                    metadata: { priority: q.priority, status: q.status }
                });
            }
            const answered = q.answered_at || q.resolved_at;
            if (answered && (q.status === 'resolved' || q.status === 'answered')) {
                events.push({
                    type: 'question_answered',
                    icon: '✅',
                    color: '#10b981',
                    date: toIso(answered),
                    title: 'Question Answered',
                    content: q.content || q.question,
                    owner: q.answered_by_name || q.assigned_to,
                    id: q.id,
                    entity_id: q.id,
                    entity_type: 'question',
                    metadata: { status: q.status }
                });
            }
        });

        // Emails
        emails.forEach(e => {
            const date = e.date_sent || e.created_at || e.processed_at;
            if (date) {
                const direction = e.direction || 'inbound';
                events.push({
                    type: 'email',
                    icon: direction === 'outbound' ? '📤' : '📥',
                    color: '#6366f1',
                    date: toIso(date),
                    title: direction === 'outbound' ? 'Email Sent' : 'Email Received',
                    content: e.subject || '(no subject)',
                    owner: e.from_name || e.from_email,
                    id: e.id,
                    entity_id: e.id,
                    entity_type: 'email',
                    metadata: { direction, subject: e.subject }
                });
            }
        });

        // Conversations (imported)
        conversations.forEach(c => {
            const date = c.conversation_date || c.created_at;
            if (date) {
                events.push({
                    type: 'conversation',
                    icon: '💬',
                    color: '#ec4899',
                    date: toIso(date),
                    title: 'Conversation Imported',
                    content: c.title || 'Conversation',
                    id: c.id,
                    entity_id: c.id,
                    entity_type: 'conversation',
                    metadata: { conversation_type: c.conversation_type }
                });
            }
        });

        // Chat sessions (RAG chat)
        chatSessions.forEach(s => {
            const date = s.created_at || s.updated_at;
            if (date) {
                events.push({
                    type: 'chat_session',
                    icon: '🤖',
                    color: '#0ea5e9',
                    date: toIso(date),
                    title: 'Chat Session',
                    content: s.title || 'Nova conversa',
                    id: s.id,
                    entity_id: s.id,
                    entity_type: 'chat_session'
                });
            }
        });

        // Sort by date descending
        return events.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * Save SOT version
     */
    async saveVersion(summary = null) {
        const storage = this._getStorage();
        
        const content = await this.generateExecutiveSummary();
        return storage.saveSOTVersion(content, summary);
    }

    /**
     * Get SOT versions
     */
    async getVersions(limit = 10) {
        const storage = this._getStorage();
        return storage.getSOTVersions(limit);
    }

    /**
     * Generate executive summary
     */
    async generateExecutiveSummary() {
        const storage = this._getStorage();
        
        const [healthScore, stats, alerts] = await Promise.all([
            this.calculateHealthScore(),
            storage.getProjectStats(),
            this.generateAlerts()
        ]);

        return `# Project Status Report

## Health Score: ${healthScore.score}/100 (${healthScore.status})

## Summary
- Facts: ${stats.facts || 0}
- Decisions: ${stats.decisions || 0}
- Risks: ${stats.risks || 0} (${alerts.filter(a => a.type === 'risk').length} critical)
- Actions: ${stats.actions || 0} (${alerts.filter(a => a.type === 'action').length} overdue)
- Questions: ${stats.questions || 0}

## Alerts
${alerts.slice(0, 5).map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join('\n')}

## Key Factors
${healthScore.factors.slice(0, 5).map(f => `- ${f.factor}: ${f.impact > 0 ? '+' : ''}${f.impact} (${f.detail})`).join('\n')}

Generated: ${new Date().toISOString()}
`;
    }

    /**
     * Get complete SOT data
     */
    async getSOTData() {
        const storage = this._getStorage();
        const [healthScore, insights, alerts, timeline, changeDelta, stats, people] = await Promise.all([
            this.calculateHealthScore(),
            this.generateInsights(),
            this.generateAlerts(),
            this.generateTimeline(),
            this.getChangeDelta(),
            storage.getProjectStats(),
            Promise.resolve(storage.getPeople ? storage.getPeople() : [])
        ]);

        return {
            healthScore,
            insights,
            alerts,
            timeline: timeline.slice(0, 20),
            changeDelta,
            stats,
            // Include data object for frontend compatibility
            data: {
                people: people || [],
                facts: storage.getFacts ? storage.getFacts() : [],
                decisions: storage.getDecisions ? storage.getDecisions() : [],
                risks: storage.getRisks ? storage.getRisks() : [],
                actions: storage.getActionItems ? storage.getActionItems() : [],
                questions: storage.getQuestions ? storage.getQuestions() : []
            },
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Generate enhanced SOT with optional AI summary and graph data
     */
    async generateEnhancedSOT(options = {}) {
        const { includeGraph = false, includeAISummary = false, llmProvider = null } = options;
        
        // Get base SOT data
        const sotData = await this.getSOTData();
        
        // Add executive summary
        const executiveSummary = await this.generateExecutiveSummary();
        
        const enhanced = {
            ...sotData,
            executiveSummary,
            includesGraph: includeGraph,
            includesAI: includeAISummary
        };
        
        // If AI summary requested and LLM provider available
        if (includeAISummary && llmProvider && typeof llmProvider.generateText === 'function') {
            try {
                const prompt = `Summarize this project status in 2-3 sentences:\n${executiveSummary}`;
                const aiSummary = await llmProvider.generateText(prompt);
                enhanced.aiSummary = aiSummary;
            } catch (e) {
                log.warn({ event: 'sot_ai_summary_failed', reason: e.message }, 'AI summary failed');
                enhanced.aiSummary = null;
            }
        }
        
        // Graph data is handled separately by the graph module
        if (includeGraph) {
            enhanced.graphData = { message: 'Graph data available via /api/graph endpoints' };
        }
        
        return enhanced;
    }
}

// Singleton
let sotInstance = null;
function getSourceOfTruthEngine(options = {}) {
    if (!sotInstance) {
        sotInstance = new SourceOfTruthEngine(options.storage, options.processor);
    }
    return sotInstance;
}

module.exports = { SourceOfTruthEngine, getSourceOfTruthEngine };
