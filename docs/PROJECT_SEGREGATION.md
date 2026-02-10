# Project segregation

This document describes how project isolation is enforced so that **no reference to another project** appears when switching or clearing the selected project.

## Overview

- **Backend**: Each API request gets a project context from the `X-Project-Id` header. Storage and Supabase queries are scoped to that project for the duration of the request.
- **Frontend**: All project-scoped API calls send `X-Project-Id`. When the user switches or clears the project, all project-scoped state is cleared (stores, cache, URL, localStorage).
- **Database**: Row Level Security (RLS) policies restrict access by project membership so that even user-scoped clients cannot see other projects’ data.

## Backend

### Request-scoped project context

- In `src/server.js`, before running feature handlers, the API:
  1. Reads `X-Project-Id` from the request header.
  2. If present, sets the current project on `storage` (e.g. `storage.switchProject(projectId)`).
  3. In a `finally` block, restores the previous project so concurrent requests do not leak context.

- **CORS**: `Access-Control-Allow-Headers` includes `X-Project-Id` so the browser can send it.

### Queries must filter by project

- In `src/supabase/storage.js`, all project-scoped operations use the current project (from the request context above).
- Single-row operations (e.g. get/update/delete by id) **always** add `.eq('project_id', projectId)` so rows from other projects are never returned or updated.
- Affected areas: facts, decisions, risks (including restore), people (in `addRelationship`), and document-dependency queries in `_getDocumentFullData`.

### Rotas que não usam contexto de projeto

- Auth, profile, listagem de projetos, webhooks públicos (e.g. Krisp), health.
- Para essas rotas o header `X-Project-Id` é ignorado para efeitos de contexto.

## Frontend

### Enviar sempre `X-Project-Id` em rotas project-scoped

- O cliente HTTP central (`src/frontend/services/api.ts`) usa um request interceptor que adiciona `X-Project-Id` a partir de `appStore.getState().currentProjectId`.
- Chamadas que não passam por esse cliente (e.g. `fetch` para blob/stream) devem usar **`fetchWithProject(url, options)`** do mesmo módulo, que adiciona o header e `credentials: 'include'`.
- **Regra**: Qualquer chamada a uma rota que dependa do projeto actual deve usar `http.*` ou `fetchWithProject`. Não usar `fetch` directo para essas rotas.

### Limpar estado ao trocar ou desmarcar projeto

- A função **`clearProjectScopedState()`** em `src/frontend/main.ts`:
  - Limpa no `dataStore`: questions, risks, actions, decisions, facts, contacts, chat history.
  - Chama `teamAnalysisStore.reset()` e `chartsStore.destroyAll()`.
  - Remove a chave `copilot_session` do `localStorage`.
  - Limpa URL: remove hash e query params (`history.replaceState` com só o pathname).

- É chamada:
  - Ao seleccionar outro projeto (antes de `activate` e `refreshData`).
  - Ao desmarcar projeto (selector vazio).
  - No ramo “no project” de `refreshData()`.
  - No logout e no `onDelete` do projeto em edição.

### URL e localStorage

- Ao trocar ou desmarcar projeto, a URL é normalizada (sem hash nem query) para evitar que IDs de documento/fact de outro projeto permaneçam na barra de endereço.
- Dados por projeto em `localStorage` (ex.: sessão do copilot) são limpos ou devem usar chaves namespaced por `projectId` (ex.: `copilot_session_${projectId}`).

## Base de dados (Supabase)

- As tabelas com `project_id` têm **RLS** activado e políticas que usam `is_project_member(project_id)` (definido em `005_knowledge_tables.sql`).
- Isto garante que, para clientes que usem JWT de utilizador (e não service role), só são visíveis linhas de projetos em que o utilizador é membro.
- O backend usa tipicamente service role; o RLS serve como defesa em profundidade e para qualquer acesso futuro com user role.
- **Verificação das migrações:** ver [docs/db/MIGRATIONS_RLS_VERIFICATION.md](db/MIGRATIONS_RLS_VERIFICATION.md). A migração `080_graph_outbox_rls_service_role.sql` restringe o acesso a `graph_outbox` ao role `service_role`. A migração **085_segregation_rls_core_and_outbox.sql** reaplica essa restrição e garante as políticas RLS em `user_profiles`, `projects`, `project_members`, `invites` e `activity_log` quando faltam na base (segurança da segregação).

## Checklist para novas funcionalidades

- [ ] Novas rotas project-scoped: o handler usa `storage.getCurrentProject()` ou equivalente; não manter estado global de projeto entre pedidos.
- [ ] Novas queries Supabase com `project_id`: incluir sempre `.eq('project_id', projectId)` em selects/updates/deletes por id.
- [ ] Novo código no frontend que chama a API: usar `http.*` ou `fetchWithProject`; não usar `fetch` directo para rotas project-scoped.
- [ ] Novo estado no frontend que seja por projeto: incluí-lo em `clearProjectScopedState()` e limpar ao trocar/desmarcar projeto.
- [ ] Novas tabelas com `project_id`: adicionar RLS com política baseada em `is_project_member(project_id)`.

## Testes

- **Integração**: `tests/integration/api-project-segregation.test.js` – verifica que os endpoints project-scoped aceitam `X-Project-Id`, devolvem a estrutura esperada (e.g. `questions`, `risks`) e que pedidos sequenciais com diferentes project IDs são independentes.
- **Manuais**: Ver checklist em [docs/qa/project-segregation-qa.md](qa/project-segregation-qa.md).
