/**
 * Fact Check Flow
 * Runs analysis on project facts using the app's configured AI (LLM): detects
 * conflicts/contradictions via LLM, records conflict_detected in fact_events.
 * Prompt is loaded from Supabase (system_prompts key: fact_check_conflicts) and editable in Admin.
 */

const llm = require('../llm');
const llmConfig = require('../llm/config');
const promptsService = require('../supabase/prompts');

/**
 * Resolve text generation config: use LLM panel config, with fallback to Ollama when only ollama is set.
 * @param {object} config - App config
 * @returns {{ provider: string, providerConfig: object, model: string } | null}
 */
function getFactCheckLLMConfig(config) {
    const overrides = { model: config?.ollama?.reasoningModel || config?.llm?.models?.reasoning };
    let textCfg = llmConfig.getTextConfig(config, overrides);
    if (textCfg.provider && textCfg.model) {
        textCfg.providerConfig = textCfg.providerConfig || config?.llm?.providers?.[textCfg.provider] || {};
        return textCfg;
    }
    if (config?.ollama?.model || config?.ollama?.reasoningModel) {
        return {
            provider: 'ollama',
            model: config.ollama.reasoningModel || config.ollama.model,
            providerConfig: {
                host: config.ollama.host || '127.0.0.1',
                port: config.ollama.port || 11434,
                ...(config.llm?.providers?.ollama || {})
            }
        };
    }
    return null;
}

/**
 * Run fact-check analysis: get facts, call app's AI (LLM) for conflict detection,
 * record conflict_detected events for each pair, return summary.
 *
 * @param {object} storage - Project-scoped storage (getFacts, _addFactEvent)
 * @param {object} config - App config (ollama, llm)
 * @param {object} options - { recordEvents: boolean } - if true, record conflict_detected in fact_events (default true)
 * @returns {Promise<{ conflicts: array, analyzed_facts: number, events_recorded: number, error?: string }>}
 */
async function runFactCheck(storage, config, options = {}) {
    const recordEvents = options.recordEvents !== false;
    if (!storage) {
        return { conflicts: [], analyzed_facts: 0, events_recorded: 0, error: 'No storage' };
    }

    let allFacts = [];
    try {
        const factsResult = storage.getFacts ? await storage.getFacts() : [];
        allFacts = Array.isArray(factsResult) ? factsResult : (factsResult?.facts || []);
    } catch (e) {
        console.warn('[FactCheckFlow] getFacts failed:', e.message);
        return { conflicts: [], analyzed_facts: 0, events_recorded: 0, error: e.message };
    }

    if (allFacts.length < 2) {
        return { conflicts: [], analyzed_facts: allFacts.length, events_recorded: 0 };
    }

    const llmCfg = getFactCheckLLMConfig(config);
    if (!llmCfg?.provider || !llmCfg?.model) {
        console.log('[FactCheckFlow] No AI/LLM configured, skipping analysis');
        return { conflicts: [], analyzed_facts: allFacts.length, events_recorded: 0 };
    }

    const factsText = allFacts.map((f, i) =>
        `[${i + 1}] ${f.content}${f.category ? ` (Category: ${f.category})` : ''}`
    ).join('\n');

    const promptRecord = await promptsService.getPrompt('fact_check_conflicts');
    const template = promptRecord?.prompt_template || null;
    const prompt = template
        ? promptsService.renderPrompt(template, { FACTS_TEXT: factsText })
        : `You are a fact-checking assistant. Analyze these facts from a knowledge base and identify any potential conflicts or contradictions. Only report genuine contradictions (same topic, incompatible claims), not just different information about different topics.

FACTS:
${factsText}

If you find conflicts, respond with a JSON array in this exact format:
[{"fact1_index": N, "fact2_index": M, "conflict_reason": "brief explanation"}]

If no conflicts are found, respond with an empty array: []

IMPORTANT: Only output the JSON array, nothing else.`;

    let rawConflicts = [];
    try {
        const result = await llm.generateText({
            provider: llmCfg.provider,
            providerConfig: llmCfg.providerConfig,
            model: llmCfg.model,
            prompt,
            temperature: 0.1,
            maxTokens: 2048,
            context: 'fact-check'
        });
        const raw = (result.text || result.response || '').trim();
        if (!result.success) {
            console.warn('[FactCheckFlow] AI request failed:', result.error);
            return { conflicts: [], analyzed_facts: allFacts.length, events_recorded: 0, error: result.error || 'AI request failed' };
        }
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            rawConflicts = Array.isArray(parsed) ? parsed : [];
        }
    } catch (e) {
        console.warn('[FactCheckFlow] AI request failed:', e.message);
        return { conflicts: [], analyzed_facts: allFacts.length, events_recorded: 0, error: e.message };
    }

    const conflicts = [];
    let eventsRecorded = 0;
    const addEvent = recordEvents && typeof storage._addFactEvent === 'function' ? storage._addFactEvent.bind(storage) : null;

    for (const c of rawConflicts) {
        const idx1 = (c.fact1_index != null ? c.fact1_index : 1) - 1;
        const idx2 = (c.fact2_index != null ? c.fact2_index : 1) - 1;
        const fact1 = allFacts[idx1];
        const fact2 = allFacts[idx2];
        const reason = c.conflict_reason || c.reason || 'Conflict detected';
        if (!fact1 || !fact2) continue;

        conflicts.push({
            factId1: fact1.id,
            factId2: fact2.id,
            fact1,
            fact2,
            conflictType: 'contradiction',
            description: reason,
            confidence: 0.8,
            reason
        });

        if (addEvent) {
            try {
                const eventData1 = { fact2_id: fact2.id, reason, trigger: 'fact_check_flow' };
                const eventData2 = { fact1_id: fact1.id, reason, trigger: 'fact_check_flow' };
                await addEvent(fact1.id, 'conflict_detected', eventData1);
                await addEvent(fact2.id, 'conflict_detected', eventData2);
                eventsRecorded += 2;
            } catch (e) {
                console.warn('[FactCheckFlow] _addFactEvent failed:', e.message);
            }
        }
    }

    if (conflicts.length > 0) {
        console.log(`[FactCheckFlow] Found ${conflicts.length} conflict(s), recorded ${eventsRecorded} events`);
    }

    return {
        conflicts,
        analyzed_facts: allFacts.length,
        events_recorded: eventsRecorded
    };
}

module.exports = {
    runFactCheck
};
