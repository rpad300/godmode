# Linking Decisions to Actions (Tasks, Stories, Sprints) – Analysis

## Current state

| Entity      | Linked to                          | Not linked to   |
|------------|-------------------------------------|-----------------|
| **Actions (tasks)** | User Story (`parent_story_id`), Sprint (`sprint_id`), other tasks (`depends_on`) | Decisions       |
| **User stories**    | Tasks (via `action_items.parent_story_id`) | Decisions       |
| **Sprints**        | Tasks (via `action_items.sprint_id`)       | Decisions       |
| **Decisions**      | Documents (source), events, similarities   | Actions, Stories, Sprints |

In the **graph**: Action has PART_OF (→ UserStory), IN_SPRINT (→ Sprint), DEPENDS_ON (→ Action), ASSIGNED_TO (← Person). There is **no** relation type between Decision and Task/Action in the ontology.

---

## Does it make sense to link them?

### Yes – especially **Tasks ↔ Decisions**

**Why:**

1. **Traceability**  
   Many tasks exist because of a decision: e.g. “We will use API X” → tasks “Integrate API X”, “Document API X”. A `decision_id` on the task answers “Why does this task exist?” and “Which decision does this implement?”.

2. **Reporting and context**  
   - From a decision: “Which tasks implement this decision?” (and their status).  
   - From a task: “Which decision drove this?” (rationale, impact, status).

3. **Same source, different artefacts**  
   Decisions and action items are often extracted from the same meeting or document. Linking them keeps the “decision → follow-up work” chain explicit instead of only implicit (same source).

4. **Graph and ontology**  
   A relation like **IMPLEMENTS** (Task → Decision) or **DRIVEN_BY** (Task → Decision) fits the ontology and supports queries such as “tasks that implement decision D” or “decisions that have no implementing tasks yet”.

So linking **actions (tasks)** to **decisions** is justified and useful.

### User stories ↔ Decisions (optional)

A user story can be the outcome of a decision (“We decided to build feature Y” → story “As a user I want Y”). So an optional `decision_id` on `user_stories` is consistent and useful for traceability, but less critical than task→decision.

### Sprints ↔ Decisions (optional, low priority)

Sprints are already linked to tasks; decisions are linked to tasks. The path **Decision → Task → Sprint** is enough for “which sprint is implementing this decision?”. A direct Sprint↔Decision link is not necessary unless you have a strong product need (e.g. “sprint was decided in meeting X”).

---

## Recommendation

| Link                    | Priority | Rationale |
|-------------------------|----------|-----------|
| **Action (task) → Decision** | High     | Core traceability: “this task implements / is driven by this decision”. |
| **User story → Decision**   | Optional | “This story was agreed in decision D”. |
| **Sprint → Decision**       | Skip     | Decision → Task → Sprint is sufficient. |

---

## Proposed design (minimal)

### 1. Schema

- **`action_items`**  
  - Add optional `decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL`.  
  - Index e.g. `(project_id, decision_id)` for “tasks by decision”.

- **`user_stories`** (optional)  
  - Add optional `decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL` if you want story-level traceability.

### 2. API

- **Actions:**  
  - PATCH/PUT accept `decision_id` (or `null` to unlink).  
  - GET list: optional filter `?decision_id=...`.  
  - GET single action: include `decision_id` and optionally decision summary (e.g. `decision_summary`, `decision_content`).

- **Decisions:**  
  - GET single decision: optional embed or endpoint for “implementing tasks” (e.g. `GET /api/decisions/:id/actions` or `actions` in payload).

### 3. UI

- **Action detail / Action modal:**  
  - Field “Driven by decision” / “Implementing decision”: picker or link to a decision (show title + status). Allow clear.

- **Decision detail:**  
  - Section “Implementing tasks” (list of actions with `decision_id = this decision`), with links to task detail.

### 4. Graph / ontology

- Add relation type, e.g. **IMPLEMENTS** (Task → Decision) or **DRIVEN_BY** (Task → Decision), in the ontology.
- When syncing an action to the graph, if `action.decision_id` is set, create the edge Action → Decision (and in outbox payload include `decision_id` so the worker can create/update the relationship).

---

## Summary

- **Faz sentido** ligar **actions (tasks)** a **decisions**: melhora rastreabilidade, contexto e reporting; encaixa no grafo e na ontologia.
- **Stories** podem ter um link opcional a decisões; **sprints** não precisam de link direto a decisões.
- Implementação mínima recomendada: `action_items.decision_id`, API e UI para associar/desassociar, e relação no grafo (e.g. IMPLEMENTS).
