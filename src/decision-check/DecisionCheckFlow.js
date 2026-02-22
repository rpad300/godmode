/**
 * Purpose:
 *   Analyses all project decisions to detect conflicts or contradictions
 *   between them, using an LLM to identify semantically incompatible outcomes.
 *
 * Responsibilities:
 *   - Retrieve all decisions from project-scoped storage
 *   - Format decisions into a numbered list for the LLM prompt
 *   - Load the prompt template from Supabase (key: decision_check_conflicts)
 *     or fall back to an inline template
 *   - Parse the LLM's JSON array response into structured conflict objects
 *   - Optionally record conflict_detected events on both decisions via storage._addDecisionEvent
 *
 * Key dependencies:
 *   - ../llm: centralised LLM text generation
 *   - ../llm/config: resolves provider/model from app config (reasoning tier)
 *   - ../supabase/prompts: loads admin-editable prompt templates
 *   - storage (passed in): project-scoped storage with getDecisions / _addDecisionEvent
 *
 * Side effects:
 *   - Network call to configured LLM provider
 *   - Network call to Supabase for prompt template
 *   - Writes conflict_detected events to decision_events when recordEvents is true
 *
 * Notes:
 *   - Requires at least 2 decisions to perform analysis; returns empty otherwise.
 *   - Temperature is 0.1 for high-consistency conflict detection.
 *   - Conflict confidence is hardcoded at 0.8; a future improvement could let the
 *     LLM return its own confidence score.
 */

const { logger } = require('../logger');
const llmRouter = require('../llm/router');

const log = logger.child({ module: 'decision-check' });
const promptsService = require('../supabase/prompts');

/**
 * Run decision-check analysis: get decisions, call LLM for conflict detection,
 * record conflict_detected in decision_events when recordEvents is true.
 *
 * @param {object} storage - Project-scoped storage (getDecisions, _addDecisionEvent)
 * @param {object} config - App config
 * @param {object} options - { recordEvents: boolean } (default true)
 * @returns {Promise<{ conflicts: array, analyzed_decisions: number, events_recorded: number, error?: string }>}
 */
async function runDecisionCheck(storage, config, options = {}) {
    const recordEvents = options.recordEvents !== false;
    if (!storage) {
        return { conflicts: [], analyzed_decisions: 0, events_recorded: 0, error: 'No storage' };
    }

    let allDecisions = [];
    try {
        const decisionsResult = storage.getDecisions ? await storage.getDecisions() : [];
        allDecisions = Array.isArray(decisionsResult) ? decisionsResult : (decisionsResult?.decisions || []);
    } catch (e) {
        log.warn({ event: 'decision_check_get_decisions_failed', reason: e.message }, 'getDecisions failed');
        return { conflicts: [], analyzed_decisions: 0, events_recorded: 0, error: e.message };
    }

    if (allDecisions.length < 2) {
        return { conflicts: [], analyzed_decisions: allDecisions.length, events_recorded: 0 };
    }

    const decisionsText = allDecisions.map((d, i) =>
        `[${i + 1}] ${d.content}${d.status ? ` (Status: ${d.status})` : ''}${d.owner ? ` (Owner: ${d.owner})` : ''}`
    ).join('\n');

    const promptRecord = await promptsService.getPrompt('decision_check_conflicts');
    const template = promptRecord?.prompt_template || null;
    const prompt = template
        ? promptsService.renderPrompt(template, { DECISIONS_TEXT: decisionsText })
        : `You are a decision-review assistant. Analyze these decisions and identify any potential conflicts or contradictions (same topic, incompatible outcomes). Only report genuine conflicts.

DECISIONS:
${decisionsText}

If you find conflicts, respond with a JSON array in this exact format:
[{"decision1_index": N, "decision2_index": M, "conflict_reason": "brief explanation"}]

If no conflicts are found, respond with an empty array: []

IMPORTANT: Only output the JSON array, nothing else.`;

    let rawConflicts = [];
    try {
        const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
            prompt,
            temperature: 0.1,
            maxTokens: 2048,
            context: 'decision-check'
        }, config);
        if (!routerResult.success) {
            const errMsg = routerResult.error?.message || routerResult.error || 'AI request failed';
            log.warn({ event: 'decision_check_ai_failed', reason: errMsg }, 'AI request failed');
            return { conflicts: [], analyzed_decisions: allDecisions.length, events_recorded: 0, error: errMsg };
        }
        const raw = (routerResult.result?.text || '').trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            rawConflicts = Array.isArray(parsed) ? parsed : [];
        }
    } catch (e) {
        log.warn({ event: 'decision_check_ai_failed', reason: e.message }, 'AI request failed');
        return { conflicts: [], analyzed_decisions: allDecisions.length, events_recorded: 0, error: e.message };
    }

    const conflicts = [];
    let eventsRecorded = 0;
    const addEvent = recordEvents && typeof storage._addDecisionEvent === 'function' ? storage._addDecisionEvent.bind(storage) : null;

    for (const c of rawConflicts) {
        const idx1 = (c.decision1_index != null ? c.decision1_index : 1) - 1;
        const idx2 = (c.decision2_index != null ? c.decision2_index : 1) - 1;
        const decision1 = allDecisions[idx1];
        const decision2 = allDecisions[idx2];
        const reason = c.conflict_reason || c.reason || 'Conflict detected';
        if (!decision1 || !decision2) continue;

        conflicts.push({
            decisionId1: decision1.id,
            decisionId2: decision2.id,
            decision1,
            decision2,
            conflictType: 'contradiction',
            description: reason,
            confidence: 0.8,
            reason
        });

        if (addEvent) {
            try {
                const eventData1 = { decision2_id: decision2.id, reason, trigger: 'decision_check_flow' };
                const eventData2 = { decision1_id: decision1.id, reason, trigger: 'decision_check_flow' };
                await addEvent(decision1.id, 'conflict_detected', eventData1);
                await addEvent(decision2.id, 'conflict_detected', eventData2);
                eventsRecorded += 2;
            } catch (e) {
                log.warn({ event: 'decision_check_add_event_failed', reason: e.message }, '_addDecisionEvent failed');
            }
        }
    }

    if (conflicts.length > 0) {
        log.info({ event: 'decision_check_conflicts_found', conflicts: conflicts.length, eventsRecorded }, 'Conflicts found');
    }

    return {
        conflicts,
        analyzed_decisions: allDecisions.length,
        events_recorded: eventsRecorded
    };
}

module.exports = {
    runDecisionCheck
};
