-- Migration 093: Prompt for sprint task generation (Create Sprint > Generate tasks)
-- Used when generating new tasks and linking existing actions to a sprint from emails/transcripts.
-- Editable in Admin > Prompts (category: sprint).

INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_task_generation',
    'Sprint task generation',
    'Given sprint context, emails and transcripts in the analysis period, and existing actions, outputs JSON with new_tasks (array of tasks to create) and existing_action_ids (UUIDs of actions to link to this sprint). Used in Create Sprint > Generate Tasks.',
    'sprint',
    'You are helping plan a sprint. Given the following, output a JSON object with exactly two keys: "new_tasks" and "existing_action_ids".

## Sprint
- Name: {{SPRINT_NAME}}
- Period: {{SPRINT_START}} to {{SPRINT_END}}
- Context / goals: {{SPRINT_CONTEXT}}

## Emails in the analysis period
{{EMAILS}}

## Meeting transcripts in the analysis period
{{TRANSCRIPTS}}

## Existing action items (id, task, status)
{{EXISTING_ACTIONS}}

## Output format
Output ONLY a valid JSON object, no markdown or extra text:
1. "new_tasks": array of new tasks to create. Each object must have: task (string), description (string), size_estimate (string e.g. "2h" or "1 day"), definition_of_done (array of strings), acceptance_criteria (array of strings). Optionally: priority ("low"|"medium"|"high"|"urgent").
2. "existing_action_ids": array of UUID strings – ids of existing actions that should belong to this sprint.

Rules: Only suggest tasks that fit the sprint context. Keep new_tasks concise and actionable. Use existing_action_ids to link already-existing work to this sprint. Output only valid JSON.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();
