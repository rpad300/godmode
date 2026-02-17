-- ============================================================================
-- Migration 102: BYOK - Add project_id to claim_next_llm_request return
-- ============================================================================
-- This allows the queue retry processor to resolve project-specific API keys
-- when retrying requests (BYOK - Bring Your Own Key support).
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_next_llm_request(p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
  request_id UUID,
  request_type TEXT,
  context TEXT,
  provider TEXT,
  model TEXT,
  input_data JSONB,
  req_priority TEXT,
  attempt_count INTEGER,
  req_project_id UUID
) AS $$
DECLARE
  v_request llm_requests%ROWTYPE;
BEGIN
  -- Atomically claim the next pending request
  UPDATE llm_requests lr
  SET
    status = 'processing',
    started_at = NOW(),
    attempt_count = lr.attempt_count + 1,
    updated_at = NOW()
  WHERE lr.id = (
    SELECT lrsub.id FROM llm_requests lrsub
    WHERE lrsub.status IN ('pending', 'retry_pending')
      AND (p_project_id IS NULL OR lrsub.project_id = p_project_id)
      AND (lrsub.next_retry_at IS NULL OR lrsub.next_retry_at <= NOW())
    ORDER BY
      CASE lrsub.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      lrsub.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_request;

  IF v_request.id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_request.id,
      v_request.request_type,
      v_request.context,
      v_request.provider,
      v_request.model,
      v_request.input_data,
      v_request.priority,
      v_request.attempt_count,
      v_request.project_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION claim_next_llm_request IS 'Atomically claim the next pending request (with project_id for BYOK support)';
