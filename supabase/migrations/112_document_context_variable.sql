-- ============================================================================
-- Migration 112: Add DOCUMENT_CONTEXT variable documentation to prompts
-- Informs admins that {{DOCUMENT_CONTEXT}} is available in prompt templates.
-- The variable injects a compact overview of project documents and their
-- hierarchical section structure (from Document Tree Index).
-- ============================================================================

-- Update descriptions of prompts that now support {{DOCUMENT_CONTEXT}}
UPDATE system_prompts SET
    description = description || E'\n\nAvailable variable: {{DOCUMENT_CONTEXT}} — Injects a compact overview of project documents and their section structure (from Document Tree Index).'
WHERE key IN (
    'email',
    'conversation',
    'decision_suggest',
    'risk_suggest',
    'sprint_task_generation',
    'task_description_from_rules'
)
AND description NOT LIKE '%DOCUMENT_CONTEXT%';
