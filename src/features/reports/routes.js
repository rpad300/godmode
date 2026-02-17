/**
 * Purpose:
 *   Weekly status report generator. Aggregates project facts, questions, decisions,
 *   risks, and action items into a structured Markdown report suitable for stakeholder
 *   distribution.
 *
 * Responsibilities:
 *   - Gather all entity counts (facts, questions, decisions, risks, actions, people)
 *   - Highlight items requiring attention: critical questions, high-impact risks, overdue actions
 *   - Format an executive summary with metrics table
 *   - Include recent decisions and question breakdown by priority
 *   - Personalize report header with the user's project role
 *
 * Key dependencies:
 *   - ctx.storage: provides getFacts, getQuestions, getDecisions, getRisks, getActionItems,
 *     getPeople, getStats, getCurrentProject
 *
 * Side effects:
 *   - None (pure read-only report generation)
 *
 * Notes:
 *   - The report is returned as a Markdown string inside a JSON envelope, not as a
 *     downloadable file; the frontend renders it
 *   - Only the most recent 5 decisions are included to keep the report concise
 *   - Overdue actions are identified by comparing deadline dates to the current date
 *
 * Routes:
 *   GET /api/reports/weekly  - Generate weekly status report
 *     Resp: { report: <markdown string>, generated_at, project }
 */

const { jsonResponse } = require('../../server/response');

async function handleReports(ctx) {
    const { req, res, pathname, storage } = ctx;

    // GET /api/reports/weekly - Generate weekly status report
    if (pathname === '/api/reports/weekly' && req.method === 'GET') {
        const currentProject = storage.getCurrentProject();

        const stats = storage.getStats();
        const allFacts = storage.getFacts();
        const allQuestions = storage.getQuestions({});
        const allDecisions = storage.getDecisions();
        const allRisks = storage.getRisks ? await storage.getRisks() : [];
        const allActions = storage.getActionItems();
        const allPeople = storage.getPeople ? storage.getPeople() : [];

        const pendingQuestions = allQuestions.filter(q => q.status !== 'resolved');
        const resolvedQuestions = allQuestions.filter(q => q.status === 'resolved');
        const openRisks = allRisks.filter(r => r.status !== 'mitigated');
        const completedActions = allActions.filter(a => a.status === 'completed');
        const pendingActions = allActions.filter(a => a.status !== 'completed');

        const today = new Date();
        const overdueActions = pendingActions.filter(a => a.deadline && new Date(a.deadline) < today);

        const userRole = currentProject?.userRole || '';
        const userRolePrompt = currentProject?.userRolePrompt || '';
        let report = `# Weekly Status Report: ${currentProject?.name || 'Project'}\n\n`;
        report += `**Generated:** ${today.toISOString().split('T')[0]}\n`;
        if (userRole) {
            report += `**Prepared for:** ${userRole}\n`;
        }
        if (userRolePrompt) {
            report += `**Role Focus:** ${userRolePrompt}\n`;
        }
        report += `\n---\n\n`;

        report += `## Executive Summary\n\n`;
        report += `| Metric | Count |\n|--------|-------|\n`;
        report += `| Total Facts | ${allFacts.length} |\n`;
        report += `| Pending Questions | ${pendingQuestions.length} |\n`;
        report += `| Resolved Questions | ${resolvedQuestions.length} |\n`;
        report += `| Open Risks | ${openRisks.length} |\n`;
        report += `| Pending Actions | ${pendingActions.length} |\n`;
        report += `| Overdue Actions | ${overdueActions.length} |\n`;
        report += `| Key People | ${allPeople.length} |\n\n`;

        const criticalQuestions = pendingQuestions.filter(q => q.priority === 'critical');
        const highRisks = openRisks.filter(r => (r.impact || '').toLowerCase() === 'high');

        if (criticalQuestions.length > 0 || highRisks.length > 0 || overdueActions.length > 0) {
            report += `## Requires Attention\n\n`;

            if (criticalQuestions.length > 0) {
                report += `### Critical Questions (${criticalQuestions.length})\n`;
                criticalQuestions.forEach(q => {
                    report += `- ${q.content}`;
                    if (q.assignee) report += ` *(Ask: ${q.assignee})*`;
                    report += `\n`;
                });
                report += `\n`;
            }

            if (highRisks.length > 0) {
                report += `### High-Impact Risks (${highRisks.length})\n`;
                highRisks.forEach(r => {
                    report += `- ${r.content}`;
                    if (r.mitigation) report += ` | Mitigation: ${r.mitigation}`;
                    report += `\n`;
                });
                report += `\n`;
            }

            if (overdueActions.length > 0) {
                report += `### Overdue Actions (${overdueActions.length})\n`;
                overdueActions.forEach(a => {
                    report += `- ${a.task}`;
                    if (a.assignee) report += ` *(Owner: ${a.assignee})*`;
                    report += ` - Due: ${a.deadline}\n`;
                });
                report += `\n`;
            }
        }

        if (allDecisions.length > 0) {
            report += `## Recent Decisions\n\n`;
            allDecisions.slice(0, 5).forEach(d => {
                report += `- ${d.content}`;
                if (d.date) report += ` *(${d.date})*`;
                if (d.owner) report += ` - ${d.owner}`;
                report += `\n`;
            });
            report += `\n`;
        }

        report += `## Questions by Priority\n\n`;
        report += `| Priority | Count |\n|----------|-------|\n`;
        report += `| Critical | ${pendingQuestions.filter(q => q.priority === 'critical').length} |\n`;
        report += `| High | ${pendingQuestions.filter(q => q.priority === 'high').length} |\n`;
        report += `| Medium | ${pendingQuestions.filter(q => q.priority === 'medium').length} |\n\n`;

        report += `---\n\n*Report generated automatically by GodMode*\n`;

        jsonResponse(res, {
            report,
            generated_at: new Date().toISOString(),
            project: currentProject?.name
        });
        return true;
    }

    return false;
}

module.exports = { handleReports };
