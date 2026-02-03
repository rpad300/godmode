-- ============================================================================
-- Migration 043: Decision Check prompts (system_prompts for conflict detection)
-- Used by DecisionCheckFlow + GET/POST decision-check API
-- ============================================================================

INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'decision_check_conflicts',
    'Decision Check – Conflict Detection',
    'Analyzes project decisions to detect contradictions or overlapping decisions; used when running Check Conflicts on decisions. Output must be a JSON array of conflicts or empty array.',
    'analysis',
    'You are a decision-review assistant. Analyze these decisions from a knowledge base and identify any potential conflicts, contradictions, or overlapping decisions (same topic, incompatible outcomes). Only report genuine conflicts, not just related decisions.

DECISIONS:
{{DECISIONS_TEXT}}

If you find conflicts, respond with a JSON array in this exact format:
[{"decision1_index": N, "decision2_index": M, "conflict_reason": "brief explanation"}]

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
