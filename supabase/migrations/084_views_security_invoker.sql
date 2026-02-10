-- ============================================================================
-- Migration 084: Recreate reporting views with security_invoker = on
-- ============================================================================
-- Fixes Security Definer View lint for: question_resolution_stats, llm_queue_stats,
-- llm_models_by_provider, facts_by_category_verified, llm_context_stats,
-- otp_rate_stats, questions_by_requester_role, decisions_by_status
-- ============================================================================

-- 1) questions_by_requester_role
DROP VIEW IF EXISTS questions_by_requester_role;
CREATE VIEW questions_by_requester_role WITH (security_invoker = on) AS
SELECT 
    requester_role,
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE status = 'open') as open_questions,
    COUNT(*) FILTER (WHERE status = 'answered') as answered_questions,
    COUNT(*) FILTER (WHERE assigned_to IS NULL) as unassigned_questions
FROM knowledge_questions
WHERE requester_role IS NOT NULL
GROUP BY requester_role
ORDER BY total_questions DESC;

-- 2) decisions_by_status
DROP VIEW IF EXISTS decisions_by_status;
CREATE VIEW decisions_by_status WITH (security_invoker = on) AS
SELECT
    project_id,
    status,
    COUNT(*) AS total_count,
    MAX(decided_at) AS latest_decided_at
FROM decisions
WHERE deleted_at IS NULL
GROUP BY project_id, status
ORDER BY project_id, total_count DESC;
COMMENT ON VIEW decisions_by_status IS 'Decisions aggregated by status for reporting';

-- 3) question_resolution_stats
DROP VIEW IF EXISTS question_resolution_stats;
CREATE VIEW question_resolution_stats WITH (security_invoker = on) AS
SELECT 
    project_id,
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'answered')) as answered_count,
    COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
    COUNT(*) FILTER (WHERE status = 'pending' OR status = 'open') as pending_count,
    COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
    COUNT(*) FILTER (WHERE deferred_at IS NOT NULL) as deferred_count,
    COUNT(*) FILTER (WHERE sla_breached = TRUE) as sla_breached_count,
    COUNT(*) FILTER (WHERE merged_into_id IS NOT NULL) as merged_count,
    COUNT(*) FILTER (WHERE reopen_count > 0) as reopened_count,
    COUNT(*) FILTER (WHERE resolution_type = 'answered_manual') as manual_answers,
    COUNT(*) FILTER (WHERE resolution_type = 'answered_auto') as auto_answers,
    COUNT(*) FILTER (WHERE resolution_type = 'answered_ai') as ai_answers,
    COUNT(*) FILTER (WHERE was_useful = TRUE) as useful_count,
    COUNT(*) FILTER (WHERE was_useful = FALSE) as not_useful_count,
    ROUND(AVG(
        CASE WHEN resolved_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
        END
    )::numeric, 1) as avg_resolution_hours,
    ROUND(AVG(
        CASE WHEN dismissed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (dismissed_at - created_at))/3600 
        END
    )::numeric, 1) as avg_dismissal_hours
FROM knowledge_questions
WHERE deleted_at IS NULL
GROUP BY project_id;

-- 4) llm_queue_stats
DROP VIEW IF EXISTS llm_queue_stats;
CREATE VIEW llm_queue_stats WITH (security_invoker = on) AS
SELECT 
  project_id,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'retry_pending') as retry_pending_count,
  COUNT(*) as total_count,
  AVG(processing_time_ms) FILTER (WHERE status = 'completed') as avg_processing_time_ms,
  SUM(estimated_cost_usd) FILTER (WHERE status = 'completed') as total_cost_usd,
  SUM(total_tokens) FILTER (WHERE status = 'completed') as total_tokens_used,
  MAX(created_at) as last_request_at
FROM llm_requests
GROUP BY project_id;

-- 5) llm_context_stats
DROP VIEW IF EXISTS llm_context_stats;
CREATE VIEW llm_context_stats WITH (security_invoker = on) AS
SELECT 
  project_id,
  context,
  provider,
  model,
  COUNT(*) as request_count,
  COUNT(*) FILTER (WHERE status = 'completed') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failure_count,
  AVG(processing_time_ms) FILTER (WHERE status = 'completed') as avg_processing_time_ms,
  SUM(estimated_cost_usd) FILTER (WHERE status = 'completed') as total_cost_usd,
  SUM(total_tokens) FILTER (WHERE status = 'completed') as total_tokens_used,
  MAX(created_at) as last_request_at
FROM llm_requests
GROUP BY project_id, context, provider, model;

-- 6) llm_models_by_provider
DROP VIEW IF EXISTS llm_models_by_provider;
CREATE VIEW llm_models_by_provider WITH (security_invoker = on) AS
SELECT 
    provider,
    COUNT(*) FILTER (WHERE is_active) as active_models,
    COUNT(*) FILTER (WHERE model_type = 'text' AND is_active) as text_models,
    COUNT(*) FILTER (WHERE model_type = 'embedding' AND is_active) as embedding_models,
    COUNT(*) FILTER (WHERE supports_vision AND is_active) as vision_models,
    MIN(price_input) FILTER (WHERE is_active AND price_input > 0) as min_price_input,
    MAX(price_input) FILTER (WHERE is_active) as max_price_input,
    MAX(last_synced_at) as last_synced
FROM llm_model_metadata
GROUP BY provider;

-- 7) facts_by_category_verified
DROP VIEW IF EXISTS facts_by_category_verified;
CREATE VIEW facts_by_category_verified WITH (security_invoker = on) AS
SELECT
    project_id,
    category,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE verified = TRUE) AS verified_count,
    COUNT(*) FILTER (WHERE verified = FALSE OR verified IS NULL) AS unverified_count,
    MAX(verified_at) AS latest_verified_at
FROM facts
WHERE deleted_at IS NULL
GROUP BY project_id, category
ORDER BY project_id, total_count DESC;
COMMENT ON VIEW facts_by_category_verified IS 'Facts aggregated by category and verification status for reporting';

-- 8) otp_rate_stats
DROP VIEW IF EXISTS otp_rate_stats;
CREATE VIEW otp_rate_stats WITH (security_invoker = on) AS
SELECT 
    email,
    request_ip,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute') AS codes_last_minute,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS codes_last_hour,
    MAX(created_at) AS last_request_at
FROM otp_codes
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY email, request_ip;
