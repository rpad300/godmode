/**
 * Role Export
 * Generate role-specific reports and exports
 */

const { getRoleFilters } = require('./RoleFilters');
const { getRoleDashboard } = require('./RoleDashboard');

class RoleExport {
    constructor(options = {}) {
        this.storage = options.storage;
        this.filters = options.filters || getRoleFilters();
        this.dashboard = options.dashboard || getRoleDashboard();
    }

    setStorage(storage) {
        this.storage = storage;
        this.filters.setStorage(storage);
        this.dashboard.setStorage(storage);
    }

    /**
     * Generate a role-specific report
     */
    generateReport(role, rolePrompt = '', options = {}) {
        const { format = 'markdown', includeAll = false } = options;
        
        if (!this.storage) {
            return { error: 'Storage not configured' };
        }
        
        // Get filtered knowledge
        const filtered = this.filters.getFilteredKnowledge(role, rolePrompt);
        
        // Get dashboard data
        const dashboard = this.dashboard.generateDashboard(role, rolePrompt);
        
        // Get project info
        const project = this.storage.getCurrentProject?.();
        
        const reportData = {
            generatedAt: new Date().toISOString(),
            role,
            rolePrompt,
            project: project?.name || 'Unknown',
            summary: dashboard.widgets?.summary || {},
            metrics: dashboard.widgets?.metrics || {},
            alerts: dashboard.widgets?.alerts || [],
            priorityItems: dashboard.widgets?.priorityItems || [],
            knowledge: includeAll ? this.storage.getAllKnowledge?.() : filtered
        };
        
        switch (format) {
            case 'markdown':
                return this.formatMarkdown(reportData);
            case 'json':
                return { success: true, data: reportData };
            case 'html':
                return this.formatHTML(reportData);
            case 'text':
                return this.formatText(reportData);
            default:
                return this.formatMarkdown(reportData);
        }
    }

    /**
     * Format report as Markdown
     */
    formatMarkdown(data) {
        let md = `# ${data.role || 'Role'} Report\n\n`;
        md += `**Project:** ${data.project}\n`;
        md += `**Generated:** ${new Date(data.generatedAt).toLocaleString()}\n`;
        if (data.rolePrompt) {
            md += `**Role Context:** ${data.rolePrompt.substring(0, 200)}...\n`;
        }
        md += `\n---\n\n`;
        
        // Summary
        md += `## Summary\n\n`;
        md += `| Metric | Value |\n`;
        md += `|--------|-------|\n`;
        md += `| Health Score | ${data.summary.healthScore || 'N/A'}% |\n`;
        md += `| Total Facts | ${data.summary.totalFacts || 0} |\n`;
        md += `| Pending Questions | ${data.summary.pendingQuestions || 0} |\n`;
        md += `| Open Risks | ${data.summary.openRisks || 0} |\n`;
        md += `| High Risks | ${data.summary.highRisks || 0} |\n`;
        md += `| Pending Actions | ${data.summary.pendingActions || 0} |\n`;
        md += `| Overdue Actions | ${data.summary.overdueActions || 0} |\n`;
        md += `\n`;
        
        // Alerts
        if (data.alerts && data.alerts.length > 0) {
            md += `## Alerts\n\n`;
            data.alerts.forEach(alert => {
                const icon = alert.type === 'danger' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵';
                md += `${icon} **${alert.title}**: ${alert.message}\n\n`;
            });
        }
        
        // Priority Items
        if (data.priorityItems && data.priorityItems.length > 0) {
            md += `## Priority Items\n\n`;
            data.priorityItems.forEach(item => {
                const icon = item.type === 'risk' ? '⚠️' : item.type === 'action' ? '📋' : '📌';
                md += `${icon} [${item.type.toUpperCase()}] ${item.content}\n`;
                if (item.deadline) {
                    md += `   *Deadline: ${item.deadline}*\n`;
                }
                md += `\n`;
            });
        }
        
        // High Relevance Facts
        const relevantFacts = (data.knowledge.facts || [])
            .filter(f => f.relevanceScore >= 60)
            .slice(0, 20);
        
        if (relevantFacts.length > 0) {
            md += `## Key Facts (High Relevance)\n\n`;
            relevantFacts.forEach(fact => {
                md += `- [${fact.category || 'general'}] ${fact.content}\n`;
            });
            md += `\n`;
        }
        
        // Decisions
        const decisions = (data.knowledge.decisions || []).slice(0, 10);
        if (decisions.length > 0) {
            md += `## Recent Decisions\n\n`;
            decisions.forEach(d => {
                md += `- **${d.content}**`;
                if (d.owner) md += ` *(${d.owner})*`;
                if (d.date) md += ` - ${d.date}`;
                md += `\n`;
            });
            md += `\n`;
        }
        
        // Risks
        const risks = (data.knowledge.risks || [])
            .filter(r => r.status !== 'mitigated')
            .slice(0, 10);
        
        if (risks.length > 0) {
            md += `## Open Risks\n\n`;
            risks.forEach(r => {
                const impactIcon = r.impact === 'high' ? '🔴' : r.impact === 'medium' ? '🟡' : '🟢';
                md += `${impactIcon} **[${(r.impact || 'unknown').toUpperCase()}]** ${r.content}\n`;
                if (r.mitigation) {
                    md += `   *Mitigation: ${r.mitigation}*\n`;
                }
                md += `\n`;
            });
        }
        
        // Actions
        const actions = (data.knowledge.actions || [])
            .filter(a => a.status !== 'completed')
            .slice(0, 15);
        
        if (actions.length > 0) {
            md += `## Pending Actions\n\n`;
            actions.forEach(a => {
                const overdue = a.deadline && new Date(a.deadline) < new Date() ? '⚠️ OVERDUE' : '';
                md += `- [ ] ${a.task}`;
                if (a.owner) md += ` *(${a.owner})*`;
                if (a.deadline) md += ` - Due: ${a.deadline}`;
                if (overdue) md += ` ${overdue}`;
                md += `\n`;
            });
            md += `\n`;
        }
        
        md += `\n---\n*Report generated by GodMode for ${data.role}*\n`;
        
        return { success: true, content: md, format: 'markdown' };
    }

    /**
     * Format report as HTML
     */
    formatHTML(data) {
        // First generate markdown, then convert basic elements to HTML
        const mdReport = this.formatMarkdown(data);
        
        let html = `<!DOCTYPE html>
<html>
<head>
    <title>${data.role} Report - ${data.project}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .alert { padding: 10px 15px; border-radius: 5px; margin: 10px 0; }
        .alert-danger { background: #ffe6e6; border-left: 4px solid #dc3545; }
        .alert-warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .alert-info { background: #e7f3ff; border-left: 4px solid #0d6efd; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; }
    </style>
</head>
<body>
`;

        // Convert markdown to basic HTML
        let content = mdReport.content;
        content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        content = content.replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>');
        content = content.replace(/^\- (.+)$/gm, '<li>$1</li>');
        content = content.replace(/\n\n/g, '</p><p>');
        content = content.replace(/---/g, '<hr>');
        
        html += `<p>${content}</p>`;
        html += `</body></html>`;
        
        return { success: true, content: html, format: 'html' };
    }

    /**
     * Format report as plain text
     */
    formatText(data) {
        let text = `${data.role || 'Role'} REPORT\n`;
        text += `${'='.repeat(50)}\n\n`;
        text += `Project: ${data.project}\n`;
        text += `Generated: ${new Date(data.generatedAt).toLocaleString()}\n\n`;
        
        text += `SUMMARY\n${'-'.repeat(30)}\n`;
        text += `Health Score: ${data.summary.healthScore || 'N/A'}%\n`;
        text += `Total Facts: ${data.summary.totalFacts || 0}\n`;
        text += `Pending Questions: ${data.summary.pendingQuestions || 0}\n`;
        text += `Open Risks: ${data.summary.openRisks || 0}\n`;
        text += `Pending Actions: ${data.summary.pendingActions || 0}\n\n`;
        
        if (data.alerts && data.alerts.length > 0) {
            text += `ALERTS\n${'-'.repeat(30)}\n`;
            data.alerts.forEach(alert => {
                text += `[${alert.type.toUpperCase()}] ${alert.title}: ${alert.message}\n`;
            });
            text += `\n`;
        }
        
        if (data.priorityItems && data.priorityItems.length > 0) {
            text += `PRIORITY ITEMS\n${'-'.repeat(30)}\n`;
            data.priorityItems.forEach(item => {
                text += `[${item.type.toUpperCase()}] ${item.content}\n`;
            });
            text += `\n`;
        }
        
        return { success: true, content: text, format: 'text' };
    }

    /**
     * Export executive summary
     */
    generateExecutiveSummary(role, rolePrompt = '') {
        if (!this.storage) {
            return { error: 'Storage not configured' };
        }
        
        const dashboard = this.dashboard.generateDashboard(role, rolePrompt);
        const project = this.storage.getCurrentProject?.();
        
        let summary = `# Executive Summary\n\n`;
        summary += `**Project:** ${project?.name || 'Unknown'}\n`;
        summary += `**Date:** ${new Date().toLocaleDateString()}\n`;
        summary += `**Prepared for:** ${role}\n\n`;
        
        // Health Status
        const health = dashboard.widgets?.summary?.healthScore || 0;
        const healthStatus = health >= 80 ? '🟢 Good' : health >= 50 ? '🟡 Moderate' : '🔴 Needs Attention';
        summary += `## Overall Status: ${healthStatus} (${health}%)\n\n`;
        
        // Key Metrics
        summary += `## Key Metrics\n\n`;
        const metrics = dashboard.widgets?.metrics || {};
        summary += `- **${metrics.pending_questions || 0}** pending questions\n`;
        summary += `- **${metrics.high_risks || 0}** high-priority risks\n`;
        summary += `- **${metrics.pending_actions || 0}** pending actions\n`;
        summary += `- **${metrics.pending_decisions || 0}** pending decisions\n\n`;
        
        // Critical Items
        const alerts = dashboard.widgets?.alerts || [];
        if (alerts.length > 0) {
            summary += `## Items Requiring Attention\n\n`;
            alerts.forEach(alert => {
                summary += `- **${alert.title}**: ${alert.message}\n`;
            });
            summary += `\n`;
        }
        
        // Recommendations
        summary += `## Recommended Actions\n\n`;
        if (metrics.high_risks > 0) {
            summary += `1. Review and address ${metrics.high_risks} high-priority risk(s)\n`;
        }
        if (metrics.pending_actions > 5) {
            summary += `2. Prioritize action items backlog (${metrics.pending_actions} pending)\n`;
        }
        if (metrics.pending_questions > 10) {
            summary += `3. Schedule knowledge review session for pending questions\n`;
        }
        
        return { success: true, content: summary, format: 'markdown' };
    }

    /**
     * Get available export formats
     */
    getAvailableFormats() {
        return [
            { id: 'markdown', name: 'Markdown', extension: '.md', icon: '📝' },
            { id: 'json', name: 'JSON', extension: '.json', icon: '📊' },
            { id: 'html', name: 'HTML', extension: '.html', icon: '🌐' },
            { id: 'text', name: 'Plain Text', extension: '.txt', icon: '📄' }
        ];
    }

    /**
     * Get report types
     */
    getReportTypes() {
        return [
            { 
                id: 'full', 
                name: 'Full Report', 
                description: 'Complete role-filtered knowledge export',
                icon: '📋'
            },
            { 
                id: 'executive', 
                name: 'Executive Summary', 
                description: 'High-level overview with key metrics',
                icon: '📊'
            },
            { 
                id: 'risks', 
                name: 'Risk Report', 
                description: 'Focus on risks and mitigations',
                icon: '⚠️'
            },
            { 
                id: 'actions', 
                name: 'Action Items', 
                description: 'All pending and overdue actions',
                icon: '✅'
            }
        ];
    }
}

// Singleton
let instance = null;
function getRoleExport(options) {
    if (!instance) {
        instance = new RoleExport(options);
    }
    return instance;
}

module.exports = { RoleExport, getRoleExport };
