# User Stories SOTA (State of the Art) – Checklist

User stories contain tasks (action_items.parent_story_id) and follow SOTA patterns: persistence, timeline/audit, soft delete + restore, graph sync.

## Implemented (complete)

| Feature | Description |
|--------|-------------|
| **Persistence** | `user_stories` table (089, 091): title, description, status, acceptance_criteria, created_by, deleted_at, source_document_id, source_file, source_email_id, source_type, requested_by, requested_by_contact_id, supporting_document_ids, generation_source |
| **Timeline / audit** | `user_story_events` (091): created, updated, deleted, restored with actor_user_id, actor_name |
| **Soft delete + restore** | deleteUserStory(soft), getDeletedUserStories, restoreUserStory |
| **Graph** | UserStory node via syncUserStory; PART_OF from Action to UserStory (incremental sync) |
| **API** | GET/POST/PUT/DELETE user-stories, GET /api/user-stories/deleted, POST /api/user-stories/:id/restore |
| **UI** | Parent User Story dropdown in ActionModal (create/edit task); New story button; user stories list for selection |

## Migrations reference

- **089** – user_stories table, RLS, triggers
- **091** – user_stories: source_*, requested_by, supporting_document_ids, generation_source; user_story_events table

## Optional (future)

| Feature | Description |
|--------|-------------|
| **Dedicated panel** | User Stories panel with list, detail view, timeline, "Removed user stories" section with Restore |
| **Embeddings** | entity_type `user_story` in embeddings pipeline |
