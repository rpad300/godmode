-- ============================================================================
-- Migration 047: Risk AI suggest (owner + mitigation)
-- Used by POST /api/risks/suggest and RiskModal "AI suggest"
-- ============================================================================

INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'risk_suggest',
    'Risk Suggest – Owner & Mitigation',
    'Suggests a responsible owner and mitigation strategy from risk content; used when user clicks AI suggest in create/edit risk. Output must be valid JSON.',
    'analysis',
    'You are a risk-management assistant. Given a risk description, suggest:
1. suggested_owner: a short name or role for who should own/monitor this risk (e.g. "Project Manager", "Tech Lead", "Security Team"). Use 1-4 words. If unclear, use empty string "".
2. suggested_mitigation: a concise mitigation strategy (1-4 sentences) describing how to reduce or manage the risk. Be practical and actionable.

RISK CONTENT:
{{CONTENT}}

Optional context: impact={{IMPACT}}, likelihood={{LIKELIHOOD}}

Respond with a single JSON object in this exact format, nothing else:
{"suggested_owner": "...", "suggested_mitigation": "..."}
Use double quotes for strings. If you cannot determine something, use empty string "".',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();
