/**
 * Purpose:
 *   Weekly status report generator. Aggregates project facts, questions, decisions,
 *   risks, and action items into a structured Markdown report suitable for stakeholder
 *   distribution. Reports are persisted in the weekly_reports table.
 *
 * Routes:
 *   GET  /api/reports/weekly?week=2026-W08  - Get saved report (or generate fresh)
 *   POST /api/reports/weekly                - Generate (or regenerate) and persist
 */

const { jsonResponse } = require('../../server/response');
const { parseBody } = require('../../server/request');

function getISOWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function buildReport(storage) {
    const [currentProject, allFacts, allQuestions, allDecisions, allRisks, allActions, allPeople] =
        await Promise.all([
            storage.getCurrentProject(),
            storage.getFacts(),
            storage.getQuestions(),
            storage.getDecisions(),
            storage.getRisks(),
            storage.getActions(),
            storage.getPeople(),
        ]);

    const pendingQuestions = (allQuestions || []).filter(q => q.status !== 'resolved');
    const resolvedQuestions = (allQuestions || []).filter(q => q.status === 'resolved');
    const openRisks = (allRisks || []).filter(r => r.status !== 'mitigated');
    const completedActions = (allActions || []).filter(a => a.status === 'completed');
    const pendingActions = (allActions || []).filter(a => a.status !== 'completed');

    const today = new Date();
    const overdueActions = pendingActions.filter(a => a.deadline && new Date(a.deadline) < today);
    const criticalQuestions = pendingQuestions.filter(q => q.priority === 'critical');
    const highRisks = openRisks.filter(r => (r.impact || '').toLowerCase() === 'high');

    const userRole = currentProject?.userRole || '';
    const userRolePrompt = currentProject?.userRolePrompt || '';

    let report = `# Weekly Status Report: ${currentProject?.name || 'Project'}\n\n`;
    report += `**Generated:** ${today.toISOString().split('T')[0]}\n`;
    if (userRole) report += `**Prepared for:** ${userRole}\n`;
    if (userRolePrompt) report += `**Role Focus:** ${userRolePrompt}\n`;
    report += `\n---\n\n`;

    report += `## Executive Summary\n\n`;
    report += `| Metric | Count |\n|--------|-------|\n`;
    report += `| Total Facts | ${(allFacts || []).length} |\n`;
    report += `| Pending Questions | ${pendingQuestions.length} |\n`;
    report += `| Resolved Questions | ${resolvedQuestions.length} |\n`;
    report += `| Open Risks | ${openRisks.length} |\n`;
    report += `| Pending Actions | ${pendingActions.length} |\n`;
    report += `| Overdue Actions | ${overdueActions.length} |\n`;
    report += `| Key People | ${(allPeople || []).length} |\n\n`;

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

    if ((allDecisions || []).length > 0) {
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

    return {
        report_markdown: report,
        summary: `${(allFacts || []).length} facts, ${pendingQuestions.length} pending questions, ${openRisks.length} open risks, ${overdueActions.length} overdue actions`,
        highlights: [
            ...(criticalQuestions.length ? [`${criticalQuestions.length} critical questions`] : []),
            ...(highRisks.length ? [`${highRisks.length} high-impact risks`] : []),
            ...(overdueActions.length ? [`${overdueActions.length} overdue actions`] : []),
        ],
        risks: highRisks.slice(0, 5).map(r => ({ content: r.content, mitigation: r.mitigation })),
        kpis: {
            total_facts: (allFacts || []).length,
            pending_questions: pendingQuestions.length,
            resolved_questions: resolvedQuestions.length,
            open_risks: openRisks.length,
            pending_actions: pendingActions.length,
            overdue_actions: overdueActions.length,
            completed_actions: completedActions.length,
            people_count: (allPeople || []).length,
        },
        project_name: currentProject?.name || 'Project',
    };
}

async function handleReports(ctx) {
    const { req, res, pathname, storage } = ctx;

    if (pathname !== '/api/reports/weekly') return false;

    // GET /api/reports/weekly?week=2026-W08 — load saved or generate fresh
    if (req.method === 'GET') {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const weekKey = url.searchParams.get('week') || getISOWeekKey(new Date());

            let existing = null;
            try {
                existing = await storage.getWeeklyReport(weekKey);
            } catch (_) {
                // Table may not exist yet or schema cache stale — fall through to live generation
            }

            if (existing) {
                jsonResponse(res, {
                    report: existing.report_markdown,
                    generated_at: existing.generated_at,
                    project: existing.sections?.project_name || null,
                    ...existing,
                });
                return true;
            }

            const result = await buildReport(storage);
            jsonResponse(res, {
                report: result.report_markdown,
                generated_at: new Date().toISOString(),
                project: result.project_name,
                summary: result.summary,
                highlights: result.highlights,
                risks: result.risks,
                kpis: result.kpis,
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/reports/weekly — generate (or regenerate) and persist
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req).catch(() => ({}));
            const weekKey = body.week || getISOWeekKey(new Date());

            const result = await buildReport(storage);

            let saved = null;
            try {
                saved = await storage.saveWeeklyReport({
                    week_key: weekKey,
                    report_markdown: result.report_markdown,
                    summary: result.summary,
                    highlights: result.highlights,
                    risks: result.risks,
                    kpis: result.kpis,
                    sections: { project_name: result.project_name },
                });
            } catch (_) {
                // Persist failed (table missing / schema cache stale) — return unsaved report
            }

            jsonResponse(res, {
                ok: true,
                report: (saved || result).report_markdown,
                generated_at: saved?.generated_at || new Date().toISOString(),
                project: result.project_name,
                ...(saved || {}),
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleReports };
