-- ============================================================================
-- Migration 045: Decision AI suggest (rationale, impact, summary) + summary column
-- Used by POST /api/decisions/suggest and DecisionModal "AI suggest"
-- ============================================================================

-- Add one-line summary for lists/reports
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS summary TEXT;
COMMENT ON COLUMN decisions.summary IS 'One-line AI-generated or manual summary for lists and reports';

-- Combined prompt: suggest rationale, impact, impact_summary, and one-line summary from decision content
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'decision_suggest',
    'Decision Suggest – Rationale, Impact & Summary',
    'Suggests rationale, impact level, impact summary, and one-line summary from decision content; used when user clicks AI suggest in create/edit decision. Output must be valid JSON.',
    'analysis',
    'You are a decision-documentation assistant. Given a decision statement, suggest:
1. A brief rationale (why this decision was or should be made; 1-3 sentences).
2. Impact level: one of "high", "medium", "low" based on scope and consequences.
3. A short impact_summary (1-2 sentences describing expected impact).
4. A one-line summary (max 80 characters) suitable for lists and reports.

DECISION CONTENT:
{{CONTENT}}

If the user provided existing rationale below, you may refine it; otherwise suggest from content only.
{{RATIONALE}}

Respond with a single JSON object in this exact format, nothing else:
{"rationale": "...", "impact": "high|medium|low", "impact_summary": "...", "summary": "..."}
Use double quotes for strings. If you cannot determine something, use empty string "" or for impact use "medium".',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();
