-- Migration 103: Move inline sprint AI prompts to system_prompts
-- These 6 prompts were previously hardcoded in src/features/sprints/routes.js.
-- Now editable in Admin > Prompts (category: sprint).

-- 1) Sprint report AI analysis (Scrum Master style)
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_report_analyze',
    'Sprint report – AI Analysis',
    'Scrum Master style analysis of a sprint report. Placeholder: {{SUMMARY}} (sprint name, dates, context, task counts, points, completed task names).',
    'sprint',
    'You are a Scrum Master. Analyze this sprint report and provide a short structured analysis (what was achieved, velocity insight, any blockers or risks, recommendations). Keep it concise.

{{SUMMARY}}',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 2) Sprint report business/executive summary
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_report_business',
    'Sprint report – Business Summary',
    'Executive-facing sprint summary for stakeholders. Placeholder: {{SUMMARY}} (sprint name, dates, goals, completion rate, key deliverables).',
    'sprint',
    'You are an executive assistant. Write a very short business-facing sprint summary (2-4 sentences) for stakeholders: what was the sprint goal, what was delivered, and overall status. No technical jargon. Be positive and clear.

{{SUMMARY}}',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 3) Sprint retrospective
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_retrospective',
    'Sprint Retrospective',
    'AI-facilitated sprint retrospective. Placeholder: {{SPRINT_SUMMARY}} (sprint data, results, completed/overdue tasks, team feedback).',
    'sprint',
    'You are a Scrum Master facilitating a sprint retrospective. Based on the sprint data and team feedback, provide:
1. Key insights about what went well (2-3 points)
2. Root causes for what didn''t go well (2-3 points)
3. Specific, actionable improvement suggestions for the next sprint (3-5 points)
Keep it concise and practical.

{{SPRINT_SUMMARY}}',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 4) Sprint daily standup summary
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_standup',
    'Sprint Daily Standup',
    'AI summary of daily standup per person. Placeholders: {{SPRINT_NAME}}, {{PCT}}, {{COMPLETED}}, {{TOTAL}}, {{STANDUP_BLOB}} (per-person done/doing/blockers).',
    'sprint',
    'Daily standup summary for sprint "{{SPRINT_NAME}}" ({{PCT}}% complete, {{COMPLETED}}/{{TOTAL}} tasks done).

{{STANDUP_BLOB}}

Provide a brief 2-3 sentence summary of team progress, highlight any blockers, and suggest focus areas for today. Be concise.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 5) Sprint story point estimation
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_estimate_points',
    'Sprint Story Point Estimation',
    'AI estimation of story points for a task. Placeholders: {{TASK_DESCRIPTION}}, {{HISTORICAL_REF}} (optional calibration from sprint).',
    'sprint',
    'Estimate story points (Fibonacci: 1, 2, 3, 5, 8, 13, 21) for this task:

Task: "{{TASK_DESCRIPTION}}"

{{HISTORICAL_REF}}Output a JSON object with: { "points": <number>, "confidence": "high"|"medium"|"low", "reasoning": "<brief explanation>" }. Output only valid JSON.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 6) Sprint capacity planning
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_capacity',
    'Sprint Capacity Planning',
    'AI capacity analysis and task redistribution suggestions. Placeholders: {{SPRINT_NAME}}, {{CAPACITY_BLOB}} (per-person assigned/available), {{UNASSIGNED_COUNT}}.',
    'sprint',
    'Sprint capacity analysis for "{{SPRINT_NAME}}":
{{CAPACITY_BLOB}}
Unassigned tasks: {{UNASSIGNED_COUNT}}

Suggest task redistribution to balance the workload. Be specific about which tasks to move between people. Keep it to 3-5 actionable suggestions.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();
