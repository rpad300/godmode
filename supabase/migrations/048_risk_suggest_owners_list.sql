-- ============================================================================
-- Migration 048: Risk suggest – multiple owner suggestions (like question assignment)
-- UI shows list of suggested owners with reason + score and "Assign" per card.
-- ============================================================================

UPDATE system_prompts
SET
  name = 'Risk Suggest – Owners & Mitigation',
  description = 'Suggests 3–5 possible owners with reasons and one mitigation; used in risk detail "AI suggest" and modal. Output must be valid JSON.',
  prompt_template = 'You are a risk-management assistant. Given a risk description, suggest:

1. suggested_owners: an array of 3 to 5 possible owners (people or roles) who could own/monitor this risk. For each owner provide:
   - name: short name or role (e.g. "Project Manager", "Tech Lead", "Security Team", or a person name). Max 40 chars.
   - reason: one sentence explaining why they are a good fit. Be specific.
   - score: number 0–100 indicating how well they match (100 = best fit).

2. suggested_mitigation: one concise mitigation strategy (1–4 sentences), practical and actionable.

RISK CONTENT:
{{CONTENT}}

Optional context: impact={{IMPACT}}, likelihood={{LIKELIHOOD}}

Respond with a single JSON object in this exact format, nothing else:
{"suggested_owners": [{"name": "...", "reason": "...", "score": 85}, ...], "suggested_mitigation": "..."}
Use double quotes. suggested_owners must be an array with 3–5 items. Each score 0–100.',
  updated_at = now()
WHERE key = 'risk_suggest';
