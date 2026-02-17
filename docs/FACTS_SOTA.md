# Facts SOTA (State of the Art) – Checklist

Facts are aligned with the same SOTA patterns as Questions: persistence in Supabase, timeline/audit, verification, graph sync, dashboard, and admin-editable prompts.

## Implemented (complete)

| Feature | Description |
|--------|-------------|
| **Persistence** | `facts` table (005), `verified` / `verified_by` / `verified_at` (037), `deleted_at` (soft delete), `created_by`, `source_document_id`, `source_file`, `category`, `confidence` |
| **Timeline / audit** | `fact_events` (038): `created`, `verified`, `updated`, `conflict_detected`, `deleted`, `restored` with `actor_user_id`, `actor_name` |
| **Verification** | User verifies fact → `verified_by`, `verified_at` and `verified` event; UI Verify button and badge |
| **Soft delete + restore** | `deleteFact` (soft), `getDeletedFacts`, `restoreFact`; outbox sync (Fact node removed/restored in graph) |
| **Graph (Supabase)** | Fact node CREATE/UPDATE/DELETE via outbox; project graph `project_${projectId}` |
| **Dashboard** | `totalFacts`, `factsByCategory`, `factsVerifiedCount`; Facts chart by category; stat card "X verified" |
| **UI** | FactsPanel (list by category/source), FactDetailView (timeline, verify, edit, delete), SOTA-style cards |
| **Conflict detection** | FactCheckFlow (LLM): detect contradictions; record `conflict_detected` events; resolve (keep one, delete other); re-run fact-check and verify kept fact |
| **Removed facts** | Section "Removed facts" with Restore; restore syncs back to graph |
| **Prompts in Supabase** | `system_prompts.key = 'fact_check_conflicts'` (039); editable in Admin > Prompts > Analysis |
| **API** | GET/POST/PUT/DELETE facts, GET/POST restore, GET conflicts, POST fact-check/run, GET fact events |
| **Who did what** | All fact_events store `actor_user_id` / `actor_name`; `conflict_detected` has `trigger: 'fact_check_flow'` (shown as "System") |
| **Generation source** | `generation_source` (040): `extracted` \| `quick_capture` \| `manual` \| `import` – set on addFact |
| **View for reporting** | `facts_by_category_verified` (040): total/verified/unverified per category per project |
| **Similarity cache + UI** | `fact_similarities` (041): cache of similarity scores; GET /api/facts/:id/similar; "Similar facts" in FactDetailView with click-to-open |

## Optional (parity with Questions)

| Feature | Questions | Facts | Notes |
|--------|-----------|-------|-------|
| Similarity table | `question_similarities` | `fact_similarities` (041) | Implemented: cache + "Similar facts" in UI. |
| Role/templates | `requester_role`, `role_question_templates` | — | Not applicable (facts are asserted, not "asked by a role"). |
| SLA | `sla_hours`, `sla_breached` | — | Not applicable (no "answer by when" for facts). |

## Migrations reference

- **005** – facts table
- **037** – verified, verified_by, verified_at
- **038** – fact_events
- **039** – fact_check_conflicts prompt (system_prompts)
- **040** – generation_source, view facts_by_category_verified
- **041** – fact_similarities table (cache), RLS
