# Decisions SOTA (State of the Art) – Checklist

Decisions are aligned with the same SOTA patterns as Facts: persistence in Supabase, timeline/audit, soft delete + restore, conflict detection with AI, prompts in Supabase, graph sync, and detail view with similar decisions.

## Implemented (complete)

| Feature | Description |
|--------|-------------|
| **Persistence** | `decisions` table (005), extended with rationale, made_by, approved_by, decided_at, impact, reversible (042); `deleted_at` (soft delete), `created_by`, `source_document_id`, `source_file`, `generation_source` |
| **Timeline / audit** | `decision_events` (042): created, updated, conflict_detected, deleted, restored with actor_user_id, actor_name |
| **Soft delete + restore** | deleteDecision (soft), getDeletedDecisions, restoreDecision; outbox sync (Decision node removed/restored in graph) |
| **Graph (Supabase)** | Decision node CREATE/UPDATE/DELETE via outbox; project graph `project_${projectId}` |
| **UI** | DecisionsPanel aligned with Facts: header (title + count), filter select, **By Status** / **By Source** view tabs, **Search decisions…**, Check Conflicts, + Add; grouping by status or by source; SOTA cards (status bar, badges, content, source chip, timestamp, View / Approve / Reject); DecisionDetailView (timeline, similar decisions, edit, delete) |
| **Conflict detection** | DecisionCheckFlow (LLM): detect contradictions; record conflict_detected in decision_events; resolve (keep one, delete other); re-run decision-check and approve kept decision |
| **Removed decisions** | Section "Removed decisions" with Restore; restore syncs back to graph |
| **Prompts in Supabase** | `system_prompts.key = 'decision_check_conflicts'` (043); editable in Admin > Prompts > Analysis |
| **API** | GET/POST/PUT/DELETE decisions, GET deleted, POST restore, GET /api/decisions/:id/events, GET /api/decisions/:id/similar, GET /api/conflicts/decisions, POST /api/decision-check/run |
| **Who did what** | decision_events store actor_user_id / actor_name; conflict_detected has trigger: 'decision_check_flow' (shown as "System") |
| **Generation source** | generation_source (042): extracted \| quick_capture \| manual \| import – set on addDecision |
| **View for reporting** | decisions_by_status (042): total per status per project |
| **Similarity cache + UI** | decision_similarities (044): cache of similarity scores; GET /api/decisions/:id/similar; "Similar decisions" in DecisionDetailView with click-to-open |
| **Processor** | Phase 6.6: Decision-check runs after document processing when LLM is configured |

## SOTA AI features (Decisions)

| Feature | Status | Description |
|--------|--------|-------------|
| **Check Conflicts** | ✅ Implemented | LLM-based conflict detection (`decision_check_conflicts` prompt); run via "Check Conflicts" or POST `/api/decision-check/run`; conflicts shown in panel with "Keep this" to resolve. |
| **Similar decisions** | ✅ Implemented | Cached semantic similarity (`decision_similarities`); shown in DecisionDetailView; click opens that decision. |
| **Rationale generation / refinement** | ✅ Implemented | AI suggests or refines `rationale` from decision content; prompt `decision_suggest`; "✨ AI suggest" in DecisionModal (create/edit). |
| **Impact analysis** | ✅ Implemented | AI suggests `impact` (high/medium/low) and optional `impact_summary`; same prompt; "✨ AI suggest" fills Impact and shows impact summary hint. |
| **Decision summarization** | ✅ Implemented | AI generates one-line `summary` for lists/reports; `decisions.summary` column (045); "✨ AI suggest" fills Summary; cards show summary when present. |

## Migrations reference

- **005** – decisions table
- **042** – decision_events, schema extensions (rationale, made_by, approved_by, decided_at, impact, reversible), generation_source, view decisions_by_status
- **043** – decision_check_conflicts prompt (system_prompts)
- **044** – decision_similarities table (cache), RLS
- **045** – decisions.summary column, decision_suggest prompt (rationale, impact, impact_summary, summary)
