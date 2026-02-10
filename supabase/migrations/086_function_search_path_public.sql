-- ============================================================================
-- Migration 086: Set search_path = public on all application functions
-- ============================================================================
-- Fixes "Function Search Path Mutable" security advisor warnings.
-- Only alters functions in public schema that are not from extensions
-- (pg_trgm, vector, etc.).
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  alter_sql text;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'))
      AND p.proname NOT LIKE 'gin\_%'
      AND p.proname NOT LIKE 'gtrgm\_%'
      AND p.proname NOT LIKE 'halfvec%'
      AND p.proname NOT LIKE 'array_to_%'
      AND p.proname NOT LIKE 'binary_%'
      AND p.proname NOT LIKE 'cosine_%'
      AND p.proname NOT LIKE 'sparsevec%'
      AND p.proname NOT LIKE 'vector%'
      AND p.proname NOT LIKE 'l2_%'
      AND p.proname NOT LIKE 'negative_%'
      AND p.proname NOT LIKE '%\_recv'
      AND p.proname NOT LIKE '%\_send'
      AND p.proname NOT LIKE '%\_in'
      AND p.proname NOT LIKE '%\_out'
  LOOP
    alter_sql := format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
    BEGIN
      EXECUTE alter_sql;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not alter %: %', r.proname, SQLERRM;
    END;
  END LOOP;
END $$;
