/**
 * Action Suggest Flow
 * Suggests assignees from action/task content using project contacts.
 * Prompt is loaded from Supabase (system_prompts key: action_suggest_assignee).
 */

const llm = require('../llm');
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
 * Run action suggest: given content and project contacts, return suggested_assignees (from contact list only).
 *
 * @param {object} config - App config
 * @param {object} options - { content: string, contacts?: Array<{name,role?,organization?}> }
 * @returns {Promise<{ suggested_assignees?: Array<{name,reason,score}>, error?: string }>}
 */
async function runActionSuggest(config, options = {}) {
    const content = (options.content || '').trim();
    const contacts = Array.isArray(options.contacts) ? options.contacts : [];

    if (!content) {
        return { error: 'Content is required' };
    }

    const llmCfg = llmConfig.getTextConfigForReasoning(config);
    if (!llmCfg?.provider || !llmCfg?.model) {
        return { error: 'No AI/LLM configured' };
    }

    const contactsListStr = buildContactsList(contacts);
    const promptRecord = await promptsService.getPrompt('action_suggest_assignee');
    const template = promptRecord?.prompt_template || null;
    const prompt = template
        ? promptsService.renderPrompt(template, {
            CONTENT: content,
            CONTACTS_LIST: contactsListStr
        })
        : `You are a task-management assistant. Given an action/task, suggest who should be assigned FROM THE PROJECT CONTACTS BELOW ONLY (use exact name as listed).

PROJECT CONTACTS (suggest assignees only from this list):
${contactsListStr || '(No contacts)'}

ACTION: ${content}

Respond with JSON: {"suggested_assignees": [{"name": "<exact name from list>", "reason": "...", "score": 0-100}, ...]}
suggested_assignees: 3-5 items.`;

    let result;
    try {
        result = await llm.generateText({
            provider: llmCfg.provider,
            providerConfig: llmCfg.providerConfig,
            model: llmCfg.model,
            prompt,
            temperature: 0.3,
            maxTokens: 512,
            context: 'action-suggest'
        });
    } catch (e) {
        log.warn({ event: 'action_suggest_llm_error', reason: e.message }, 'LLM error');
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
        const contactNames = contacts.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean);
        const contactNamesSet = new Set(contactNames);
        function matchContactName(suggestedName) {
            const s = (suggestedName || '').trim();
            if (!s) return null;
            const lower = s.toLowerCase();
            if (contactNamesSet.has(lower)) return s;
            const found = contacts.find(c => (c.name || '').trim().toLowerCase() === lower);
            return found ? (found.name || '').trim() : null;
        }

        let suggested_assignees = [];
        if (Array.isArray(parsed.suggested_assignees) && parsed.suggested_assignees.length > 0) {
            suggested_assignees = parsed.suggested_assignees
                .filter(o => o && (o.name || o.person))
                .map(o => ({
                    name: String(o.name || o.person || '').trim().substring(0, 120),
                    reason: String(o.reason || '').trim().substring(0, 500),
                    score: typeof o.score === 'number' ? Math.min(100, Math.max(0, o.score)) : (typeof o.score === 'string' ? parseInt(o.score, 10) : 0) || 0
                }))
                .filter(o => o.name);
        }

        if (contacts.length > 0 && suggested_assignees.length > 0) {
            const matched = [];
            for (const o of suggested_assignees) {
                const canonicalName = matchContactName(o.name);
                if (canonicalName) {
                    matched.push({ name: canonicalName, reason: o.reason, score: o.score });
                }
            }
            suggested_assignees = matched;
        }

        if (suggested_assignees.length === 0 && contacts.length > 0) {
            suggested_assignees = contacts.slice(0, 5).map((c, i) => ({
                name: (c.name || '').trim(),
                reason: c.role ? `Project contact – ${c.role}` : 'Project contact',
                score: 50 + (5 - i) * 5
            })).filter(o => o.name);
        } else if (suggested_assignees.length === 0) {
            suggested_assignees = [
                { name: 'Project Manager', reason: 'Typically owns delivery tasks.', score: 60 },
                { name: 'Tech Lead', reason: 'Often owns technical tasks.', score: 50 },
                { name: 'Product Owner', reason: 'Can own scope-related tasks.', score: 50 }
            ];
        }

        return { suggested_assignees };
    } catch (e) {
        return { error: 'Failed to parse AI response' };
    }
}

module.exports = {
    runActionSuggest
};
