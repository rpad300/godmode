# Verificação de segurança e performance (Supabase Advisors)

Relatório gerado a partir dos advisors do projeto GODMODE (Supabase). Recomenda-se correr periodicamente **Security** e **Performance** no dashboard (Project → Reports → Advisors) ou via API.

---

## Correções já aplicadas (migração 083)

- **RLS em `timezones`:** Ativado RLS e criada política "Anyone can read timezones" (SELECT para `authenticated` e `anon`). Resolve o aviso *RLS Disabled in Public*.
- **Views com security_invoker:** As views `questions`, `question_updates` e `email_contacts` foram recriadas com `WITH (security_invoker = on)` para usarem as permissões do utilizador que consulta, em vez do definer. Resolve os *Security Definer View* para estas três views.

---

## Security Advisor – Resumo

### INFO (RLS ativado sem políticas)

Tabelas com RLS ativo mas sem políticas detetadas pelo linter (podem ter políticas aplicadas por outras migrações ou em roles diferentes):

- `activity_log`, `invites`, `project_members`, `projects`, `user_profiles`

**Ação:** Se o acesso a estas tabelas for apenas via backend (service_role), pode ser intencional. Caso contrário, adicionar políticas adequadas (ex.: `is_project_member(project_id)` para tabelas por projeto). As migrações 001 e outras já definem políticas; verificar no SQL Editor se existem com os nomes esperados.

### ERROR (já tratados ou conhecidos)

- **Security Definer View:** As views `questions`, `question_updates`, `email_contacts` foram corrigidas em 083. As restantes 8 views de reporting foram recriadas com `security_invoker = on` na migração **084_views_security_invoker.sql**: `question_resolution_stats`, `llm_queue_stats`, `llm_models_by_provider`, `facts_by_category_verified`, `llm_context_stats`, `otp_rate_stats`, `questions_by_requester_role`, `decisions_by_status`.
- **RLS Disabled in Public:** `timezones` – corrigido em 083.

### WARN (corrigido onde aplicável)

- **Function search_path mutable:** A migração **086_function_search_path_public.sql** define `SET search_path = public` em todas as funções do schema `public` que ainda não tinham (excluindo funções de extensões como pg_trgm e vector). Os avisos do advisor para estas funções devem desaparecer após aplicar a 086.
- **Extension in public:** Extensões `pg_trgm` e `vector` estão em `public`. Mover para outro schema pode quebrar referências; documentar como decisão consciente ou planear migração.
- **Materialized view in API:** `knowledge_gaps` é selecionável por anon/authenticated. Restringir por RLS ou revogar acesso se for apenas para uso interno.
- **RLS policy always true:** Várias tabelas têm políticas com `USING (true)` ou `WITH CHECK (true)` para roles de sistema/service (ex.: `config_audit_log`, `graph_outbox`, `llm_requests`, `notifications`, `project_period_usage`, `prompt_versions`). Quando restritas a `service_role` ou a um role específico, podem ser intencionais. Revisar cada uma; `graph_outbox` foi restrita a `service_role` na migração 080.
- **Leaked password protection disabled:** Configuração do Auth no dashboard (Auth → Settings). Ativar em https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection se desejado.

---

## Performance Advisor

- **Índices em FKs:** A migração **087_index_foreign_keys_performance.sql** adiciona índices em colunas de chave estrangeira frequentemente usadas em JOINs/filtros: `action_items(created_by)`, `documents(uploaded_by)`, `decisions/facts/risks(created_by)`, `knowledge_questions(created_by)`, `contacts(created_by, linked_person_id)`, `document_versions(uploaded_by)`, `balance_transactions(llm_request_id)`, `ai_analysis_log(created_by, parent_analysis_id)`, `comments(resolved_by)`, `calendar_events(created_by, linked_document_id, linked_action_id)`. Outros FKs sem índice podem ser tratados em migrações futuras conforme o advisor.
- O relatório de performance completo (queries lentas, etc.) deve ser consultado no dashboard; correr o advisor após alterações de schema.

---

## Referências

- [Database Linter (Supabase)](https://supabase.com/docs/guides/database/database-linter)
- [RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [View security_invoker (PostgreSQL 15+)](https://www.postgresql.org/docs/15/sql-createview.html#SQL-CREATEVIEW-SECURITY)
