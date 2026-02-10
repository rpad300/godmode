# QA: Project segregation

Manual checklist to verify that no reference to another project appears when switching or clearing the selected project.

## Before running QA

- Run automated tests: `npm test` (no `--forceExit` needed; all suites should pass).
- Segregation API tests: `tests/integration/api-project-segregation.test.js` (X-Project-Id header, project-scoped endpoints, independence of project IDs).

## Environment

- [ ] Two projects (A and B) with different data (e.g. different questions, risks, documents).
- [ ] User has access to both projects.

## Switch project (A → B)

1. Select project A. Open Dashboard, SOTA (Questions, Facts, Risks, Actions, Decisions), Documents, Graph, Team Analysis, Chat.
2. Note or screenshot some visible data (e.g. question titles, document names).
3. Switch to project B via the project selector.
4. **Verify**:
   - [ ] Dashboard shows only data for B (counts and content).
   - [ ] SOTA panels show only B’s questions, facts, risks, actions, decisions.
   - [ ] Documents list shows only B’s documents.
   - [ ] Graph shows only B’s graph (no nodes/edges from A).
   - [ ] Team Analysis shows only B’s profiles/team (or empty).
   - [ ] Chat does not show A’s conversation; new or B’s context only.
   - [ ] URL has no hash or query params pointing to A (e.g. no `?document=...` or `#fact/...` from A).
5. Switch back to A.
6. **Verify**: All data shown is again A’s only (no B data).

## Clear project (deselect)

1. Select project A. Open several tabs/panels so that A’s data is visible.
2. In the project selector, choose “Select Project...” (empty option) to clear the selection.
3. **Verify**:
   - [ ] “No Project Selected” (or equivalent) is shown.
   - [ ] No SOTA data, documents, or graph from A remains on screen.
   - [ ] URL has no project-specific hash or query.
4. Select project A again.
5. **Verify**: Data loads again for A only.

## Export / upload (project-scoped)

1. Select project A.
2. Export history, audit logs, contacts, or costs.
3. **Verify**: Export content belongs to A only (e.g. open CSV/JSON and check IDs or names).
4. Switch to B and export the same type.
5. **Verify**: Export content belongs to B only.

## Multi-tab (if applicable)

1. Open app in two browser tabs. Tab 1: project A. Tab 2: project B.
2. In each tab, open the same view (e.g. Questions).
3. **Verify**: Tab 1 shows only A’s questions; Tab 2 shows only B’s questions.
4. Refresh Tab 1.
5. **Verify**: Tab 1 still shows only A’s data (no B leakage).

## Sign out

1. Select project A and load some views.
2. Sign out.
3. **Verify**: Project-scoped data is cleared; no A (or B) data visible after logout.

---

**Pass criteria**: No visible data, labels, or URLs from the “other” project in any of the steps above.

## After QA

- If any step fails, note the view and data that leaked (e.g. “Questions panel showed project A’s question after switching to B”) and open a bug or fix in the relevant store/API.
- Reference: implementation and rules in `docs/PROJECT_SEGREGATION.md`.
