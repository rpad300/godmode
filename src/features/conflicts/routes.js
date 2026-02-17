/**
 * Purpose:
 *   AI-powered conflict detection for facts and decisions. Provides both
 *   read-only detection (no side effects) and trigger endpoints that
 *   record conflict_detected events into the event log.
 *
 * Responsibilities:
 *   - Detect contradictory or conflicting facts via LLM analysis
 *   - Detect conflicting decisions via LLM analysis
 *   - Optionally record conflict events for audit/timeline purposes
 *
 * Key dependencies:
 *   - ../../fact-check.runFactCheck: AI fact-conflict detection pipeline
 *   - ../../decision-check/DecisionCheckFlow.runDecisionCheck: AI decision-conflict pipeline
 *   - storage, config (ctx): knowledge store and LLM configuration
 *
 * Side effects:
 *   - GET routes: none (recordEvents: false)
 *   - POST routes: write conflict_detected events to the event log
 *
 * Notes:
 *   - Fact-check requires at least 2 facts to compare; returns a message otherwise
 *   - Both modules are lazy-required to avoid loading AI deps at startup
 *   - Error responses still include an empty conflicts array for UI stability
 *
 * Routes:
 *   GET  /api/conflicts            - Detect fact conflicts (read-only)
 *   POST /api/fact-check/run       - Run fact-check and record events
 *   GET  /api/conflicts/decisions  - Detect decision conflicts (read-only)
 *   POST /api/decision-check/run   - Run decision-check and record events
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
