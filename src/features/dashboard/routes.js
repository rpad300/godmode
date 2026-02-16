/**
 * Dashboard and Trends API
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/dashboard - Get enhanced dashboard stats
 * - GET /api/trends - Get trend data for metrics
 */

const { parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleDashboard(ctx) {
    const { req, res, pathname, storage } = ctx;

    // GET /api/dashboard - Get enhanced dashboard stats
    if (pathname === '/api/dashboard' && req.method === 'GET') {
        const [allRisks, allFacts] = await Promise.all([
            storage.getRisks ? storage.getRisks() : Promise.resolve([]),
            storage.getFacts ? storage.getFacts() : Promise.resolve([])
        ]);

        const stats = storage.getStats();
        const allQuestions = storage.getQuestions({});
        const questionsByPriority = {
            critical: allQuestions.filter(q => q.priority === 'critical' && q.status === 'pending').length,
            high: allQuestions.filter(q => q.priority === 'high' && q.status === 'pending').length,
            medium: allQuestions.filter(q => q.priority === 'medium' && q.status === 'pending').length,
            resolved: allQuestions.filter(q => q.status === 'resolved').length
        };

        const risksByImpact = {
            high: allRisks.filter(r => (r.impact || '').toLowerCase() === 'high' && r.status === 'open').length,
            medium: allRisks.filter(r => (r.impact || '').toLowerCase() === 'medium' && r.status === 'open').length,
            low: allRisks.filter(r => (r.impact || '').toLowerCase() === 'low' && r.status === 'open').length
        };

        const allActions = storage.getActionItems();
        const allPeople = storage.getPeople ? storage.getPeople() : [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueActions = allActions.filter(a => {
            if (a.status === 'completed') return false;
            if (!a.deadline) return false;
            const deadline = new Date(a.deadline);
            return deadline < today;
        });

        const actionsByStatus = {
            completed: allActions.filter(a => a.status === 'completed').length,
            in_progress: allActions.filter(a => a.status === 'in_progress').length,
            pending: allActions.filter(a => a.status === 'pending').length,
            overdue: overdueActions.length
        };

        const activeQuestions = allQuestions.filter(q =>
            q.status !== 'resolved' &&
            q.status !== 'dismissed' &&
            q.status !== 'closed' &&
            q.status !== 'answered'
        );
        const pendingQuestions = activeQuestions.length;
        const pendingActions = allActions.filter(a => a.status !== 'completed').length;
        const openRisks = allRisks.filter(r => r.status === 'open' || !r.status).length;

        const now = new Date();
        const questionsWithAge = activeQuestions.map(q => {
            const created = q.created_at ? new Date(q.created_at) : new Date(q.date || now);
            const ageMs = now - created;
            const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
            return { ...q, ageDays };
        });

        const questionAging = {
            fresh: questionsWithAge.filter(q => q.ageDays <= 3).length,
            aging: questionsWithAge.filter(q => q.ageDays > 3 && q.ageDays <= 7).length,
            stale: questionsWithAge.filter(q => q.ageDays > 7 && q.ageDays <= 14).length,
            critical: questionsWithAge.filter(q => q.ageDays > 14).length
        };

        const oldestQuestions = questionsWithAge
            .sort((a, b) => b.ageDays - a.ageDays)
            .slice(0, 5);

        const factsByCategory = {
            technical: allFacts.filter(f => (f.category || '').toLowerCase() === 'technical').length,
            process: allFacts.filter(f => (f.category || '').toLowerCase() === 'process').length,
            policy: allFacts.filter(f => (f.category || '').toLowerCase() === 'policy').length,
            people: allFacts.filter(f => (f.category || '').toLowerCase() === 'people').length,
            timeline: allFacts.filter(f => (f.category || '').toLowerCase() === 'timeline').length,
            general: allFacts.filter(f => (f.category || '').toLowerCase() === 'general' || !f.category).length
        };
        const factsVerifiedCount = allFacts.filter(f => f.verified === true).length;

        const trends = storage.getTrends ? storage.getTrends(7) : [];
        const trendInsights = storage.getTrendInsights ? storage.getTrendInsights() : [];

        // New Aggregations
        const weeklyActivity = storage.getWeeklyActivity ? storage.getWeeklyActivity() : [];
        const recentHistory = storage.getRecentActivity ? storage.getRecentActivity(10) : [];

        // Sprint Placeholder (until Sprints are fully implemented)
        const sprints = storage.getSprints ? storage.getSprints() : [];
        const activeSprint = sprints.find(s => s.status === 'active') || null;

        jsonResponse(res, {
            documents: stats.documents || { total: 0, processed: 0, pending: 0 },
            totalFacts: stats.facts || 0,
            factsByCategory,
            factsVerifiedCount,
            totalQuestions: pendingQuestions,
            totalDecisions: stats.decisions || 0,
            totalRisks: openRisks,
            totalActions: pendingActions,
            totalPeople: allPeople.length,
            questionsByPriority,
            risksByImpact,
            actionsByStatus,
            overdueActions: overdueActions.length,
            overdueItems: overdueActions.slice(0, 5),
            questionAging,
            oldestQuestions,
            trends,
            trendInsights,
            recentRisks: allRisks.slice(0, 5),
            recentActions: allActions.slice(0, 5),
            recentHistory,
            weeklyActivity,
            activeSprint
        });
        return true;
    }

    // GET /api/trends - Get trend data for metrics
    if (pathname === '/api/trends' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const days = parseInt(parsedUrl.query.days) || 7;
        const trends = storage.getTrends(days);
        const history = storage.getStatsHistory(30);
        jsonResponse(res, { trends, history });
        return true;
    }

    return false;
}

module.exports = { handleDashboard };
