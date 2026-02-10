-- ============================================================================
-- Migration 082: RPCs used by app but missing from prior migrations
-- ============================================================================
-- get_project_stats: storage.js getProjectStats()
-- increment_cache_hit: storage.js getCache() when cache hit
-- increment_contact_interaction: storage.js recordContactInteraction()
-- ============================================================================

-- Current project counts (same shape as fallback in storage.js: single object)
CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_facts BIGINT;
    v_questions BIGINT;
    v_documents BIGINT;
    v_decisions BIGINT;
    v_risks BIGINT;
    v_actions BIGINT;
    v_people BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_facts FROM public.facts WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_questions FROM public.knowledge_questions WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_documents FROM public.documents WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_decisions FROM public.decisions WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_risks FROM public.risks WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_actions FROM public.action_items WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_people FROM public.people WHERE project_id = p_project_id AND deleted_at IS NULL;
    RETURN json_build_object(
        'facts', v_facts,
        'questions', v_questions,
        'documents', v_documents,
        'decisions', v_decisions,
        'risks', v_risks,
        'actions', v_actions,
        'people', v_people
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_project_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_stats(UUID) TO service_role;
COMMENT ON FUNCTION get_project_stats(UUID) IS 'Returns current entity counts for a project (used by dashboard/storage)';

-- Increment cache hit counter and last_hit_at
CREATE OR REPLACE FUNCTION increment_cache_hit(p_key TEXT, p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE cache_entries
    SET hit_count = hit_count + 1,
        last_hit_at = now()
    WHERE project_id = p_project_id AND cache_key = p_key;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_cache_hit(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_cache_hit(TEXT, UUID) TO service_role;
COMMENT ON FUNCTION increment_cache_hit(TEXT, UUID) IS 'Increments hit_count for a cache entry (used by storage getCache)';

-- Increment contact interaction_count
CREATE OR REPLACE FUNCTION increment_contact_interaction(contact_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE contacts
    SET interaction_count = COALESCE(interaction_count, 0) + 1,
        last_seen_at = now(),
        first_seen_at = COALESCE(first_seen_at, now())
    WHERE id = contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_contact_interaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_contact_interaction(UUID) TO service_role;
COMMENT ON FUNCTION increment_contact_interaction(UUID) IS 'Increments interaction_count and last_seen_at for a contact (used by storage recordContactInteraction)';
