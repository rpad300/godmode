/**
 * Conflicts, Fact-check and Decision-check API
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/conflicts - Detect conflicting facts (no events)
 * - POST /api/fact-check/run - Trigger fact-check flow (records events)
 * - GET /api/conflicts/decisions - Detect conflicting decisions (no events)
 * - POST /api/decision-check/run - Trigger decision-check flow (records events)
 */

const { jsonResponse } = require('../../server/response');

async function handleConflicts(ctx) {
    const { req, res, pathname, storage, config } = ctx;

    // GET /api/conflicts - Detect conflicting facts using AI (no events recorded)
    if (pathname === '/api/conflicts' && req.method === 'GET') {
        try {
            const { runFactCheck } = require('../../fact-check');
            const result = await runFactCheck(storage, config, { recordEvents: false });
            const payload = {
                conflicts: result.conflicts || [],
                analyzed_facts: result.analyzed_facts ?? 0
            };
            if (result.error) payload.error = result.error;
            if (result.analyzed_facts < 2) payload.message = 'Not enough facts to compare';
            jsonResponse(res, payload);
        } catch (e) {
            jsonResponse(res, { error: e.message, conflicts: [] });
        }
        return true;
    }

    // POST /api/fact-check/run - Manually trigger fact-check flow (records conflict_detected events)
    if (pathname === '/api/fact-check/run' && req.method === 'POST') {
        try {
            const { runFactCheck } = require('../../fact-check');
            const result = await runFactCheck(storage, config, { recordEvents: true });
            jsonResponse(res, {
                ok: true,
                conflicts: result.conflicts || [],
                analyzed_facts: result.analyzed_facts ?? 0,
                events_recorded: result.events_recorded ?? 0,
                error: result.error || null
            });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message, conflicts: [] }, 500);
        }
        return true;
    }

    // GET /api/conflicts/decisions - Detect conflicting decisions using AI (no events recorded)
    if (pathname === '/api/conflicts/decisions' && req.method === 'GET') {
        try {
            const { runDecisionCheck } = require('../../decision-check/DecisionCheckFlow');
            const result = await runDecisionCheck(storage, config, { recordEvents: false });
            jsonResponse(res, {
                conflicts: result.conflicts || [],
                analyzed_decisions: result.analyzed_decisions ?? 0,
                error: result.error || null
            });
        } catch (e) {
            jsonResponse(res, { error: e.message, conflicts: [] });
        }
        return true;
    }

    // POST /api/decision-check/run - Manually trigger decision-check flow (records conflict_detected events)
    if (pathname === '/api/decision-check/run' && req.method === 'POST') {
        try {
            const { runDecisionCheck } = require('../../decision-check/DecisionCheckFlow');
            const result = await runDecisionCheck(storage, config, { recordEvents: true });
            jsonResponse(res, {
                ok: true,
                conflicts: result.conflicts || [],
                analyzed_decisions: result.analyzed_decisions ?? 0,
                events_recorded: result.events_recorded ?? 0,
                error: result.error || null
            });
        } catch (e) {
            jsonResponse(res, { ok: false, error: e.message, conflicts: [] }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleConflicts };
