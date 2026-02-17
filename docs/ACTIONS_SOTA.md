# Actions SOTA (State of the Art) – Checklist

Actions (tasks) are aligned with the same SOTA patterns as Facts, Decisions, and Risks: persistence in Supabase, timeline/audit, soft delete + restore, graph sync, and admin-editable prompts.

## Implemented (complete)

| Feature | Description |
|--------|-------------|
| **Persistence** | `action_items` table (005, 088, 089, 091): task, owner, deadline, priority, status, source_document_id, source_file, created_by, deleted_at, parent_story_id, parent_story_ref, size_estimate, description, definition_of_done, acceptance_criteria, generation_source, source_email_id, source_type, requested_by, requested_by_contact_id, supporting_document_ids |
| **Timeline / audit** | `action_events` (050): created, updated, deleted, restored with actor_user_id, actor_name |
| **Soft delete + restore** | deleteAction(soft), getDeletedActions, restoreAction; outbox sync (Action node restored in graph) |
| **Graph (Supabase)** | Action node CREATE/UPDATE/DELETE via outbox; PART_OF (Task → UserStory), DEPENDS_ON (Task → Task); syncUserStory for UserStory nodes |
| **User stories** | user_stories table (089); action_items.parent_story_id; task_dependencies table for depends_on |
| **Removed actions** | Section "Removed actions" in ActionsPanel with Restore; restore syncs back to graph |
| **API** | GET/POST/PUT/PATCH/DELETE actions, GET /api/actions/deleted, POST /api/actions/:id/restore, GET events, POST suggest-task, POST suggest (assignee) |
| **Who did what** | action_events store actor_user_id / actor_name |
| **Generation source** | generation_source (091): extracted \| quick_capture \| manual \| import – set on add from source_document_id/source_email_id or manual |
| **Origin & requester** | source_type (transcript \| email \| manual), source_email_id, requested_by, requested_by_contact_id, supporting_document_ids (091) |
| **Requester contact card** | Parity with assignee: requester shown as contact card (avatar, name, role) in ActionDetailView (Source) and ActionModal; contact picker for requester in both create/edit flows |
| **Comments on task** | CommentsThread in ActionDetailView with targetType `action` and targetId; GET/POST /api/comments/:targetType/:targetId for project-scoped comments |
| **Task comments in project context** | Briefing (QUALITATIVE CONTEXT) includes recent task updates/comments: comments from in-progress actions (last 10 by updated_at, last 3 comments per task) |
| **Prompts in Supabase** | system_prompts category `sprint` (090): task_description_from_rules; editable in Admin > Prompts |
| **UI** | ActionsPanel (filter by status, Removed section with Restore), ActionModal (Parent User Story, Depends on, Generate from description, Requested by + contact picker), ActionDetailView (timeline, source, assignee/requester cards, CommentsThread) |
| **Regenerate / Refine with AI** | "Regenerate with AI" in ActionModal (edit) pre-fills draft from current task and runs suggest-task; "Refine with AI" in ActionDetailView sends current task+description to AI and PATCHes the action with the result |
| **Reporting** | GET /api/actions/report returns by_status and by_assignee counts; optional stats strip in ActionsPanel |
| **Similar actions** | GET /api/actions/:id/similar returns semantically similar actions (embeddings); "Similar actions" block in ActionDetailView |
| **Embeddings** | entity_type `action_item` in getAllItemsForEmbedding and Supabase saveEmbeddings path; actions included in RAG rebuild and similarity search |

## Migrations reference

- **005** – knowledge tables (action_items base)
- **050** – action_events
- **088** – action_items sprint board (parent_story_ref, size_estimate, description, definition_of_done, acceptance_criteria)
- **089** – user_stories, task_dependencies, action_items.parent_story_id
- **090** – task_description_from_rules prompt (system_prompts)
- **091** – action_items: generation_source, source_email_id, source_type, requested_by, requested_by_contact_id, supporting_document_ids; user_story_events; user_stories refs

## Optional (future)

| Feature | Description |
|--------|-------------|
| **Similarity cache table** | Optional action_similarities table for pre-computed pairs (current implementation uses vector similarity via embeddings). |
