/**
 * Decision Suggest Flow
 * Suggests rationale, impact, impact_summary, and one-line summary from decision content
 * using the app's configured AI. Prompt is loaded from Supabase (system_prompts key: decision_suggest).
 */

const llm = require('../llm');
const llmConfig = require('../llm/config');
const promptsService = require('../supabase/prompts');

function getSuggestLLMConfig(config) {
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

    const llmCfg = getSuggestLLMConfig(config);
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
        console.warn('[DecisionSuggestFlow] LLM error:', e.message);
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
