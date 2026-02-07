-- ============================================================================
-- Migration 052: Decision suggest owner (made_by) from project contacts only
-- Used by POST /api/decisions/suggest-owner and DecisionDetailView "AI Suggest" in Owner section
-- ============================================================================

INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'decision_suggest_owner',
    'Decision Suggest – Owner (from contacts)',
    'Suggests who made or should own the decision FROM PROJECT CONTACTS only (like risk/question). Output must be valid JSON.',
    'analysis',
    'You are a decision-documentation assistant. Given a decision, suggest who most likely made it or should own it FROM THE PROJECT CONTACTS LIST BELOW ONLY. Use the exact name as listed.

PROJECT CONTACTS (suggest owner ONLY from this list – use exact name as listed):
{{CONTACTS_LIST}}

DECISION:
{{CONTENT}}

Optional context: {{RATIONALE}}

1. suggested_owners: an array of 3 to 5 people FROM THE CONTACTS LIST ABOVE who could have made or own this decision. For each provide:
   - name: exact name from the contacts list (copy exactly).
   - reason: one sentence why they are a good fit.
   - score: number 0–100 (100 = best fit).

If the contacts list is empty, respond with suggested_owners: [].

Respond with a single JSON object in this exact format, nothing else:
{"suggested_owners": [{"name": "<exact name from list>", "reason": "...", "score": 85}, ...]}
Use double quotes. suggested_owners must only contain names that appear in the PROJECT CONTACTS list.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();
