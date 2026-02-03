-- ============================================================================
-- Migration 039: Fact Check prompts (persisted in system_prompts, editable in Admin)
-- Prompts used by FactCheckFlow for conflict detection; visible in Admin > Prompts
-- ============================================================================

-- Fact Check: Conflict detection between facts (used by FactCheckFlow + GET/POST fact-check API)
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'fact_check_conflicts',
    'Fact Check – Conflict Detection',
    'Analyzes project facts to detect contradictions; used when running Check Conflicts or after resolving a conflict. Output must be a JSON array of conflicts or empty array.',
    'analysis',
    'You are a fact-checking assistant. Analyze these facts from a knowledge base and identify any potential conflicts or contradictions. Only report genuine contradictions (same topic, incompatible claims), not just different information about different topics.

FACTS:
{{FACTS_TEXT}}

If you find conflicts, respond with a JSON array in this exact format:
[{"fact1_index": N, "fact2_index": M, "conflict_reason": "brief explanation"}]

If no conflicts are found, respond with an empty array: []

IMPORTANT: Only output the JSON array, nothing else.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

