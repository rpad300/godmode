-- ============================================================================
-- Verificação: tabelas Facts SOTA (037 + 038) no Supabase
-- Executa no SQL Editor do Supabase para confirmar que as migrations foram aplicadas.
-- ============================================================================

-- 1) Colunas verified em facts (037)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'facts'
  AND column_name IN ('verified', 'verified_by', 'verified_at')
ORDER BY ordinal_position;

-- Esperado: 3 linhas (verified boolean, verified_by uuid, verified_at timestamptz)

-- 2) Índice idx_facts_verified
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'facts'
  AND indexname = 'idx_facts_verified';

-- 3) Tabela fact_events (038)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fact_events'
ORDER BY ordinal_position;

-- Esperado: id, fact_id, event_type, event_data, actor_user_id, actor_name, created_at

-- 4) Índices em fact_events
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'fact_events';

-- Esperado: fact_events_pkey, idx_fact_events_fact, idx_fact_events_type, idx_fact_events_actor

-- 5) RLS em fact_events
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.fact_events'::regclass;

-- Esperado: "Members access fact events" com FOR ALL
