/**
 * Purpose:
 *   Given a decision's content and the project's contact list, uses an LLM to
 *   suggest who most likely made or should own the decision -- constrained to
 *   project contacts only (same pattern as risk/question owner suggestion).
 *
 * Responsibilities:
 *   - Build a formatted contacts list for the LLM prompt (capped at 50)
 *   - Load the prompt template from Supabase (key: decision_suggest_owner) or
 *     fall back to an inline template
 *   - Call the LLM and parse a JSON response of suggested owners with scores
 *   - Validate suggested names against the contact list (case-insensitive)
 *   - Return an empty suggested_owners array when no contacts are provided
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
 *   - Unlike ActionSuggestFlow, this does NOT provide generic fallback owners when
 *     no contacts exist -- it returns an empty array to signal that the project
 *     has no contacts to choose from.
 *   - buildContactsList is duplicated across several *Flow files; consider
 *     extracting into a shared utility. TODO: confirm deduplication plan.
 */

const { logger } = require('../logger');
const llm = require('../llm');

const log = logger.child({ module: 'decision-suggest-owner' });
const llmConfig = require('../llm/config');
const promptsService = require('../supabase/prompts');

function buildContactsList(contacts) {
    if (!Array.isArray(contacts) || contacts.length === 0) return '';
    const lines = contacts.slice(0, 50).map(c => {
        const name = (c.name || '').trim();
        if (!name) return null;
        const role = (c.role || '').trim();
        const org = (c.organization || '').trim();
        return `- ${name}${role ? ` | Role: ${role}` : ''}${org ? ` | ${org}` : ''}`;
    }).filter(Boolean);
    return lines.join('\n');
}

/**
 * Run decision suggest owner: given content (and optional rationale) and project contacts,
 * return suggested_owners (from contact list only). Same logic as risk/question – only suggest people from the project.
 *
 * @param {object} config - App config
 * @param {object} options - { content: string, rationale?: string, contacts?: Array<{name,role?,organization?}> }
 * @returns {Promise<{ suggested_owners?: Array<{name,reason,score}>, error?: string }>}
 */
async function runDecisionSuggestOwner(config, options = {}) {
    const content = (options.content || '').trim();
    const rationale = (options.rationale || '').trim();
    const contacts = Array.isArray(options.contacts) ? options.contacts : [];

    if (!content) {
        return { error: 'Content is required' };
    }

    const llmCfg = llmConfig.getTextConfigForReasoning(config);
    if (!llmCfg?.provider || !llmCfg?.model) {
        return { error: 'No AI/LLM configured' };
    }

    const contactsListStr = buildContactsList(contacts);
    let promptRecord;
    try {
        promptRecord = await promptsService.getPrompt('decision_suggest_owner');
    } catch {
        promptRecord = null;
    }
    const template = promptRecord?.prompt_template || null;
    const prompt = template
        ? promptsService.renderPrompt(template, {
            CONTENT: content,
            RATIONALE: rationale,
            CONTACTS_LIST: contactsListStr
        })
        : `You are a decision-documentation assistant. Given this decision, suggest who most likely made it or should own it FROM THE PROJECT CONTACTS BELOW ONLY. Use the exact name as listed.

PROJECT CONTACTS (suggest owner ONLY from this list – use exact name as listed):
${contactsListStr || '(No contacts – return suggested_owners: [])'}

DECISION: ${content}
${rationale ? `Rationale/context: ${rationale}` : ''}

Respond with a single JSON object: {"suggested_owners": [{"name": "<exact name from list>", "reason": "...", "score": 0-100}, ...]}
suggested_owners: 3-5 people from the CONTACTS list only. If no contacts listed, return suggested_owners: [].`;

    let result;
    try {
        result = await llm.generateText({
            provider: llmCfg.provider,
            providerConfig: llmCfg.providerConfig,
            model: llmCfg.model,
            prompt,
            temperature: 0.3,
            maxTokens: 512,
            context: 'decision-suggest-owner'
        });
    } catch (e) {
        log.warn({ event: 'decision_suggest_owner_llm_error', reason: e.message }, 'LLM error');
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
        let suggested_owners = [];
        if (Array.isArray(parsed.suggested_owners) && parsed.suggested_owners.length > 0) {
            suggested_owners = parsed.suggested_owners
                .filter(o => o && (o.name || o.person))
                .map(o => ({
                    name: String(o.name || o.person || '').trim().substring(0, 120),
                    reason: String(o.reason || '').trim().substring(0, 500),
                    score: typeof o.score === 'number' ? Math.min(100, Math.max(0, o.score)) : (typeof o.score === 'string' ? parseInt(o.score, 10) : 0) || 0
                }))
                .filter(o => o.name);
        }

        const contactNames = contacts.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean);
        const contactNamesSet = new Set(contactNames);
        function matchContactName(suggestedName) {
            const s = suggestedName.trim();
            if (!s) return null;
            const lower = s.toLowerCase();
            if (contactNamesSet.has(lower)) return s;
            const found = contacts.find(c => (c.name || '').trim().toLowerCase() === lower);
            return found ? (found.name || '').trim() : null;
        }

        if (contacts.length > 0 && suggested_owners.length > 0) {
            const matched = [];
            for (const o of suggested_owners) {
                const canonicalName = matchContactName(o.name);
                if (canonicalName) {
                    matched.push({ name: canonicalName, reason: o.reason, score: o.score });
                }
            }
            suggested_owners = matched;
        }

        return { suggested_owners };
    } catch (e) {
        return { error: 'Failed to parse AI response' };
    }
}

module.exports = {
    runDecisionSuggestOwner
};
