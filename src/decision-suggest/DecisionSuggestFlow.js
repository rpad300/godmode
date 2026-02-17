/**
 * Purpose:
 *   Given a decision's content (and optional existing rationale), uses an LLM to
 *   suggest supporting metadata: rationale, impact level, impact summary, and a
 *   one-line summary -- reducing manual documentation effort for decision records.
 *
 * Responsibilities:
 *   - Load the prompt template from Supabase (key: decision_suggest) or fall back
 *     to an inline template
 *   - Call the LLM and parse a JSON response with rationale, impact, impact_summary, summary
 *   - Normalise the impact level to one of "high", "medium", "low"
 *   - Return structured suggestion fields with safe string trimming/truncation
 *
 * Key dependencies:
 *   - ../llm: centralised LLM text generation
 *   - ../llm/config: resolves provider/model from app config (reasoning tier)
 *   - ../supabase/prompts: loads admin-editable prompt templates
 *
 * Side effects:
 *   - Network call to configured LLM provider
 *   - Network call to Supabase for prompt template
 *
 * Notes:
 *   - Temperature 0.3 for consistent, focused suggestions.
 *   - Summary is truncated to 500 chars to fit UI constraints.
 */

const { logger } = require('../logger');
const llm = require('../llm');

const log = logger.child({ module: 'decision-suggest' });
const llmConfig = require('../llm/config');
const promptsService = require('../supabase/prompts');

/**
 * Run decision suggest: given content (and optional existing rationale), return
 * { rationale?, impact?, impact_summary?, summary? } from LLM.
 *
 * @param {object} config - App config
 * @param {object} options - { content: string, rationale?: string }
 * @returns {Promise<{ rationale?: string, impact?: string, impact_summary?: string, summary?: string, error?: string }>}
 */
async function runDecisionSuggest(config, options = {}) {
    const content = (options.content || '').trim();
    const rationale = (options.rationale || '').trim();

    if (!content) {
        return { error: 'Content is required' };
    }

    const llmCfg = llmConfig.getTextConfigForReasoning(config);
    if (!llmCfg?.provider || !llmCfg?.model) {
        return { error: 'No AI/LLM configured' };
    }

    const promptRecord = await promptsService.getPrompt('decision_suggest');
    const template = promptRecord?.prompt_template || null;
    const prompt = template
        ? promptsService.renderPrompt(template, {
            CONTENT: content,
            RATIONALE: rationale
        })
        : `You are a decision-documentation assistant. Given this decision, suggest: 1) a brief rationale (1-3 sentences), 2) impact level (high/medium/low), 3) short impact_summary (1-2 sentences), 4) one-line summary (max 80 chars). Decision: ${content}\n\nRespond with a single JSON object: {"rationale": "...", "impact": "high|medium|low", "impact_summary": "...", "summary": "..."}`;

    let result;
    try {
        result = await llm.generateText({
            provider: llmCfg.provider,
            providerConfig: llmCfg.providerConfig,
            model: llmCfg.model,
            prompt,
            temperature: 0.3,
            maxTokens: 1024,
            context: 'decision-suggest'
        });
    } catch (e) {
        log.warn({ event: 'decision_suggest_llm_error', reason: e.message }, 'LLM error');
        return { error: e.message || 'AI request failed' };
    }

    const raw = (result.text || result.response || '').trim();
    if (!result.success) {
        return { error: result.error || 'AI request failed' };
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return { error: 'Invalid AI response format' };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        const impact = (parsed.impact || '').toLowerCase();
        const normalizedImpact = ['high', 'medium', 'low'].includes(impact) ? impact : (parsed.impact || 'medium');
        return {
            rationale: typeof parsed.rationale === 'string' ? parsed.rationale.trim() : '',
            impact: normalizedImpact,
            impact_summary: typeof parsed.impact_summary === 'string' ? parsed.impact_summary.trim() : '',
            summary: typeof parsed.summary === 'string' ? parsed.summary.trim().substring(0, 500) : ''
        };
    } catch (e) {
        return { error: 'Failed to parse AI response' };
    }
}

module.exports = {
    runDecisionSuggest
};
