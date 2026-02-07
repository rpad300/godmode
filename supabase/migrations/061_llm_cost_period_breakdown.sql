-- ============================================
-- LLM Cost: period-filtered breakdown for summary API
-- Returns aggregated by provider, model, operation, context for a date range
-- ============================================

CREATE OR REPLACE FUNCTION get_llm_cost_breakdown_for_period(
    p_project_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS TABLE (
    total_cost DECIMAL,
    total_requests BIGINT,
    total_input_tokens BIGINT,
    total_output_tokens BIGINT,
    by_provider JSONB,
    by_model JSONB,
    by_operation JSONB,
    by_context JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH requests AS (
        SELECT
            provider,
            model,
            operation,
            COALESCE(request_type, 'unknown') AS ctx,
            COALESCE(cost, 0)::numeric AS cost,
            COALESCE(input_tokens, 0)::BIGINT AS input_tokens,
            COALESCE(output_tokens, 0)::BIGINT AS output_tokens
        FROM llm_cost_requests
        WHERE project_id = p_project_id
          AND timestamp >= p_start
          AND timestamp <= p_end
    ),
    provider_agg AS (
        SELECT COALESCE(
            (SELECT jsonb_object_agg(provider, ROUND(cost::numeric, 8))
             FROM (SELECT provider, SUM(cost) AS cost FROM requests GROUP BY provider) t),
            '{}'::jsonb
        ) AS j
    ),
    model_agg AS (
        SELECT COALESCE(
            (SELECT jsonb_object_agg(key, ROUND(cost::numeric, 8))
             FROM (SELECT provider || '/' || model AS key, SUM(cost) AS cost FROM requests GROUP BY provider, model) t),
            '{}'::jsonb
        ) AS j
    ),
    operation_agg AS (
        SELECT COALESCE(
            (SELECT jsonb_object_agg(operation, ROUND(cost::numeric, 8))
             FROM (SELECT operation, SUM(cost) AS cost FROM requests GROUP BY operation) t),
            '{}'::jsonb
        ) AS j
    ),
    context_agg AS (
        SELECT COALESCE(
            (SELECT jsonb_object_agg(ctx, ROUND(cost::numeric, 8))
             FROM (SELECT ctx, SUM(cost) AS cost FROM requests GROUP BY ctx) t),
            '{}'::jsonb
        ) AS j
    )
    SELECT
        COALESCE((SELECT SUM(cost)::DECIMAL FROM requests), 0),
        COALESCE((SELECT COUNT(*)::BIGINT FROM requests), 0),
        COALESCE((SELECT SUM(input_tokens)::BIGINT FROM requests), 0),
        COALESCE((SELECT SUM(output_tokens)::BIGINT FROM requests), 0),
        (SELECT j FROM provider_agg),
        (SELECT j FROM model_agg),
        (SELECT j FROM operation_agg),
        (SELECT j FROM context_agg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_llm_cost_breakdown_for_period IS 'Aggregated LLM cost breakdown for a date range (provider, model, operation, context)';
