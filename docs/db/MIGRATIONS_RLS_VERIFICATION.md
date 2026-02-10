# Verificação de migrações e RLS (segregação por projeto)

Verificação feita sobre os ficheiros SQL em `supabase/migrations/` (não foi feita ligação ao Supabase em tempo de execução).

## Função `is_project_member`

- **Definida em:** `005_knowledge_tables.sql`
- **Comportamento:** retorna true se o utilizador (`auth.uid()`) for membro do projeto em `project_members` ou owner em `projects`.

## Tabelas com RLS e `is_project_member(project_id)` (ou equivalente)

| Migração | Tabelas |
|----------|---------|
| 005_knowledge_tables | documents, facts, decisions, risks, action_items, knowledge_questions, people, relationships, embeddings, processing_history, conversations, knowledge_change_log |
| 006_contacts_teams | contacts, teams, contact_projects (e políticas por projeto) |
| 007_system_tables | activity_log, notifications, etc. com is_project_member |
| 008_optimizations | Tabelas de optimização com project_id |
| 009_roles_ontology | Tabelas de roles/ontology por projeto |
| 010_llm_costs | llm_costs e relacionadas |
| 019_emails | emails, email_attachments, email_recipients (project_members) |
| 023_ai_analysis_log | ai_analysis_log |
| 024_document_shares | document_shares, share_access_log |
| 026_document_versions | document_versions |
| 029_system_config_secrets | secrets (project) |
| 030_config_audit_usage | config_audit_log, project_usage_limits, usage_alerts |
| 034_questions_sota_features | question_events, question_similarities, role_question_templates |
| 038_fact_events | fact_events |
| 041_fact_similarities | fact_similarities |
| 042_decisions_sota | decision_events |
| 044_decision_similarities | decision_similarities |
| 046_risks_sota | risk_events |
| 050_action_events | action_events |
| 056_graph_tables | graph_nodes, graph_relationships |
| 057_documents_rls_soft_delete | documents (is_project_member + deleted_at) |
| 058_chat_sessions | chat_sessions, chat_messages |
| 060_documents_performance | document_versions, document_shares, ai_analysis_log |
| 062_llm_cost_budgets | llm_cost_budgets |
| 064_team_analysis | team_profiles, team_analysis, team_analysis_history, behavioral_relationships |
| 066_team_analysis_evidence | profile_evidence, transcript_interventions |
| 069_project_billing | pricing (project members) |

## Tabelas de outbox/sync (004_outbox_sync)

- **graph_outbox:** RLS ativado. Política corrigida em `080_graph_outbox_rls_service_role.sql`: apenas o role `service_role` pode aceder (antes `USING (TRUE)` aplicava-se a todos os roles e quebrava segregação para anon/authenticated).
- **graph_sync_status:** apenas SELECT para membros do projeto com role owner/admin.
- **graph_dead_letter:** FOR ALL para membros do projeto com role owner/admin.

## Migração 080 e 085 (segregação outbox e políticas core)

- **080_graph_outbox_rls_service_role.sql:** política "Service manages outbox" em `graph_outbox` deve ser `FOR ALL TO service_role USING (true)`.
- **085_segregation_rls_core_and_outbox.sql:** Reaplica a restrição da outbox (TO service_role) e garante as políticas RLS das tabelas core quando faltam na base: `user_profiles`, `projects`, `project_members`, `invites`, `activity_log`. Necessário se as políticas da 001 não tiverem sido aplicadas ou tiverem sido removidas.

## Como aplicar

1. No projeto Supabase (Dashboard ou CLI): aplicar as migrações por ordem, incluindo a nova `080_graph_outbox_rls_service_role.sql`.
2. Se já tiveres 001–079 aplicadas, podes correr só a 080:
   - Supabase Dashboard → SQL Editor → colar o conteúdo de `080_graph_outbox_rls_service_role.sql` e executar.
   - Ou `supabase db push` / fluxo de migrações que uses.

## Introspeção da base de dados (alinhar migrações com o estado real)

- **Script:** `scripts/introspect-db.js`
- **Uso:** Definir `DATABASE_URL` em `src/.env` (Supabase Dashboard → Project Settings → Database → Connection string URI) e executar `node scripts/introspect-db.js --json`. O relatório é escrito em `scripts/db-schema-report.json` (tabelas, colunas, políticas RLS, funções) para comparação com as migrações.
- **Sem DATABASE_URL:** O script indica que é necessário configurar a variável; as migrações podem ser aplicadas manualmente ou via Supabase CLI.
- **Manifest do código:** `node scripts/code-schema-manifest.js` gera `scripts/code-schema-manifest.json` (tabelas e RPCs usados em `src/`) sem ligação à DB; útil para comparar com o relatório de introspeção.

## Duplicados de número e migração 081

- **Duplicados corrigidos:** `008_role_templates.sql` foi renomeado para `008a_role_templates.sql` e `009_roles_ontology.sql` para `009a_roles_ontology.sql`, para ordem de execução inequívoca.
- **081_views_for_code_compat.sql:** Cria as views `questions` (→ knowledge_questions), `question_updates` (→ question_events) e `email_contacts` (→ email_recipients) para compatibilidade com o código em `storage.js` (merge de contactos) e com a RPC `match_embeddings_with_details`.
- **082_missing_rpcs.sql:** Adiciona as RPCs usadas pela app e em falta nas migrações anteriores: `get_project_stats` (contagens do projeto), `increment_cache_hit` (cache_entries), `increment_contact_interaction` (contacts).
- **086_function_search_path_public.sql:** Define `SET search_path = public` em todas as funções da aplicação no schema `public` (corrige avisos "Function Search Path Mutable" do Security Advisor).
- **087_index_foreign_keys_performance.sql:** Cria índices em colunas de FK usadas em JOINs/filtros para melhorar desempenho (Unindexed foreign keys do Performance Advisor).

## Verificação de segregação (base real)

- **Tabelas com `project_id`:** Todas têm RLS ativado; nenhuma fica exposta sem RLS.
- **Tabelas core (001):** Se `user_profiles`, `projects`, `project_members`, `invites` ou `activity_log` tiverem RLS ativo mas 0 políticas, a migração **085** repõe as políticas (owner/members/superadmin) e corrige `graph_outbox` para `TO service_role`.
- **graph_outbox:** Deve ter uma única política `FOR ALL TO service_role USING (true)`; anon e authenticated não devem ter acesso.

## Resumo

- A segregação por projeto está coberta nas migrações: as tabelas com `project_id` que são acedidas por utilizadores têm RLS com `is_project_member(project_id)` ou restrição por `project_members`.
- A política de `graph_outbox` foi corrigida (080/085): apenas `service_role` acede; anon e authenticated ficam sem acesso.
- A migração 085 garante as políticas das tabelas core quando faltam na base.
- As views da migração 081 alinham os nomes usados no código com as tabelas reais sem alterar a aplicação.
