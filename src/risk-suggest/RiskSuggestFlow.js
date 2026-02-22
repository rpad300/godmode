/**
 * Purpose:
 *   Given a risk description, its impact/likelihood, and the project's contact
 *   list, uses an LLM to suggest owners (constrained to contacts) and a
 *   mitigation strategy.
 *
 * Responsibilities:
 *   - Build a formatted contacts list for the LLM prompt (capped at 50)
 *   - Load the prompt template from Supabase (key: risk_suggest) or fall back
 *     to an inline template
 *   - Call the LLM and parse a JSON response of suggested_owners + suggested_mitigation
 *   - Validate suggested names against the project contact list (case-insensitive)
 *   - Provide fallback owners: first 5 contacts when contacts exist, or generic
 *     role titles (Project Manager, Tech Lead, Product Owner) when none exist
 *   - Maintain backward compatibility with the single suggested_owner field
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
 *   - Follows the same contact-constrained suggestion pattern as ActionSuggestFlow
 *     and DecisionSuggestOwnerFlow.
 *   - suggested_mitigation is truncated to 2 000 chars.
 *   - Temperature 0.3 for focused risk analysis.
 */

const { logger } = require('../logger');
const llmRouter = require('../llm/router');

const log = logger.child({ module: 'risk-suggest' });
const promptsService = require('../supabase/prompts');

/**
 * Build contacts list string for prompt (project contacts – suggest only from this list, like questions).
 * @param {Array<{name?: string, role?: string, organization?: string}>} contacts
 * @returns {string}
 */
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
 * Run risk suggest: given content and project contacts, return suggested_owners (from contact list only)
 * and suggested_mitigation. Same logic as question suggest-assignee – only suggest people from the project.
 *
 * @param {object} config - App config
 * @param {object} options - { content: string, impact?: string, likelihood?: string, contacts?: Array<{name,role?,organization?}> }
 * @returns {Promise<{ suggested_owners?: Array<{name,reason,score}>, suggested_owner?: string, suggested_mitigation?: string, error?: string }>}
 */
async function runRiskSuggest(config, options = {}) {
    const content = (options.content || '').trim();
    const impact = options.impact || 'medium';
    const likelihood = options.likelihood || options.probability || 'medium';
    const contacts = Array.isArray(options.contacts) ? options.contacts : [];

    if (!content) {
        return { error: 'Content is required' };
    }

    const contactsListStr = buildContactsList(contacts);
    const promptRecord = await promptsService.getPrompt('risk_suggest');
    const template = promptRecord?.prompt_template || null;
    const prompt = template
        ? promptsService.renderPrompt(template, {
            CONTENT: content,
            IMPACT: impact,
            LIKELIHOOD: likelihood,
            CONTACTS_LIST: contactsListStr
        })
        : `You are a risk-management assistant. Given this risk, suggest who should own it FROM THE PROJECT CONTACTS BELOW ONLY (use exact name as listed), and one mitigation.

PROJECT CONTACTS (suggest owners only from this list):
${contactsListStr || '(No contacts – suggest 1 role title only)'}

RISK: ${content}
Impact: ${impact}, Likelihood: ${likelihood}

Respond with JSON: {"suggested_owners": [{"name": "<exact name from list>", "reason": "...", "score": 0-100}, ...], "suggested_mitigation": "..."}
If no contacts listed, return one generic role in suggested_owners. suggested_owners: 3-5 items.`;

    let routerResult;
    try {
        routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
            prompt,
            temperature: 0.3,
            maxTokens: 512,
            context: 'risk-suggest'
        }, config);
    } catch (e) {
        log.warn({ event: 'risk_suggest_llm_error', reason: e.message }, 'LLM error');
        return { error: e.message || 'AI request failed' };
    }

    if (!routerResult.success) {
        return { error: routerResult.error?.message || routerResult.error || 'AI request failed' };
    }
    const raw = (routerResult.result?.text || '').trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return { error: 'Invalid AI response format' };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        const mitigation = typeof parsed.suggested_mitigation === 'string' ? parsed.suggested_mitigation.trim().substring(0, 2000) : '';

        // Contact names for validation (project contacts – like questions)
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

        // New format: suggested_owners array (name, reason, score)
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

        // When we have project contacts: only allow names that exist in the contact list (like questions)
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

        // Backward compat: single suggested_owner (if in contacts, use it)
        const singleOwner = typeof parsed.suggested_owner === 'string' ? parsed.suggested_owner.trim().substring(0, 120) : '';
        if (suggested_owners.length === 0 && singleOwner) {
            const canonical = contacts.length > 0 ? matchContactName(singleOwner) : singleOwner;
            if (canonical) {
                suggested_owners = [{ name: canonical, reason: '', score: 0 }];
            }
        }
        // Fallback: only generic roles when project has NO contacts; otherwise offer first contacts as assignable
        if (suggested_owners.length === 0 && content.length > 0) {
            if (contacts.length > 0) {
                suggested_owners = contacts.slice(0, 5).map((c, i) => ({
                    name: (c.name || '').trim(),
                    reason: c.role ? `Project contact – ${c.role}` : 'Project contact',
                    score: 50 + (5 - i) * 5
                })).filter(o => o.name);
            } else {
                suggested_owners = [
                    { name: 'Project Manager', reason: 'Typically owns delivery and resource risks.', score: 60 },
                    { name: 'Tech Lead', reason: 'Often owns technical and implementation risks.', score: 50 },
                    { name: 'Product Owner', reason: 'Can own scope and stakeholder-related risks.', score: 50 }
                ];
            }
        }
        const firstOwner = suggested_owners.length > 0 ? suggested_owners[0].name : singleOwner;

        return {
            suggested_owners,
            suggested_owner: firstOwner,
            suggested_mitigation: mitigation
        };
    } catch (e) {
        return { error: 'Failed to parse AI response' };
    }
}

module.exports = {
    runRiskSuggest
};
