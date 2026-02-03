# Risks SOTA (State of the Art) – Checklist

Risks are aligned with the same SOTA patterns as Facts and Decisions: persistence in Supabase, timeline/audit, soft delete + restore, generation_source, graph sync, and detail view in the SOT panel.

## Implemented (complete)

| Feature | Description |
|--------|-------------|
| **Persistence** | `risks` table (005): content, impact, likelihood, mitigation, status, owner, source_document_id, source_file, created_by, deleted_at; **046**: `generation_source` (extracted \| quick_capture \| manual \| import) |
| **Timeline / audit** | `risk_events` (046): created, updated, deleted, restored with actor_user_id, actor_name |
| **Soft delete + restore** | deleteRisk (soft), getDeletedRisks, restoreRisk; outbox sync (Risk node removed/restored in FalkorDB) |
| **Graph / FalkorDB** | Risk node CREATE/UPDATE/DELETE via outbox; project graph `project_${projectId}` |
| **UI** | RisksPanel SOTA: header (title + count), filter select, **By Status** / **By Source** view tabs, **Search risks…**, Show Matrix, + Add; grouping by status or by source; SOTA cards (impact bar, badges, content, mitigation, source chip, owner, View); RiskDetailView (timeline, edit, delete) |
| **Removed risks** | Section "Removed risks" with Restore; restore syncs back to graph |
| **API** | GET/POST/PUT/DELETE risks, GET /api/risks/deleted, POST /api/risks/:id/restore, GET /api/risks/:id, GET /api/risks/:id/events; GET /api/risks fixed (await storage.getRisks()) |
| **Who did what** | risk_events store actor_user_id / actor_name |
| **Generation source** | generation_source (046): extracted \| quick_capture \| manual \| import – set on addRisk |

## AI suggest (owner + mitigation)

| Feature | Description |
|--------|-------------|
| **Risk suggest** | Prompt `risk_suggest` (047): suggests **suggested_owner** (who should own the risk) and **suggested_mitigation** (1–4 sentences). Used by "✨ AI suggest" in RiskModal (create/edit). POST /api/risks/suggest with `{ content, impact?, likelihood? }` returns `{ suggested_owner, suggested_mitigation }`. |

## Not in scope (Phase 2)

| Feature | Description |
|--------|-------------|
| **Conflict detection** | Optional: risk_check prompt, GET /api/conflicts/risks, POST /api/risk-check/run (mirror decision-check) |
| **Similar risks** | Optional: risk_similarities table, GET /api/risks/:id/similar, "Similar risks" in RiskDetailView |

## Migrations reference

- **005** – risks table
- **046** – risk_events table, risks.generation_source column, RLS for risk_events
- **047** – risk_suggest prompt (owner + mitigation); editable in Admin > Prompts

## Frontend

- **Service** (`src/frontend/services/risks.ts`): get(id), getDeleted(), restore(id), getEvents(id); create/update/delete use new API.
- **RiskDetailView** (`src/frontend/components/risks/RiskDetailView.ts`): content, impact, likelihood, mitigation, owner, source, timeline (risk_events), Edit (RiskModal), Delete.
- **RisksPanel** (`src/frontend/components/sot/RisksPanel.ts`): useDetailView, containerElement; By Status / By Source; search; SOTA cards; Removed risks + Restore; click card → RiskDetailView when useDetailView.
- **main.ts** (`loadSotContent('risks')`): uses createRisksPanel({ useDetailView: true, containerElement }) instead of legacy template.
- **Styles**: `risk-detail.css` (risk-detail-view, risk-timeline-item, risk-card-sota, removed-risks-section).
