-- ============================================================================
-- Migration 032: LLM Request Queue
-- Persistent queue for LLM requests with retry, audit, and project segregation
-- ============================================================================

-- ============================================================================
-- 1. LLM Requests Table (Main Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Request classification
  request_type TEXT NOT NULL CHECK (request_type IN ('text', 'vision', 'embeddings')),
  context TEXT NOT NULL, -- What is this request for? e.g., 'extract_facts', 'generate_briefing', 'vision_analysis'
  
  -- LLM Configuration
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- Input (stored for retry capability)
  input_hash TEXT, -- Hash of input for deduplication
  input_data JSONB NOT NULL, -- Full input: { messages, prompt, images, options }
  
  -- Output
  output_data JSONB, -- Full response from LLM
  output_text TEXT, -- Extracted text response for quick access
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting in queue
    'processing',   -- Currently being processed
    'completed',    -- Successfully completed
    'failed',       -- Failed (may be retried)
    'cancelled',    -- Manually cancelled
    'retry_pending' -- Waiting for retry
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  
  -- Retry logic
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Error tracking
  last_error TEXT,
  error_code TEXT,
  error_details JSONB,
  
  -- Timing
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  -- Token usage and cost
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd DECIMAL(12, 8),
  
  -- Related entities (for context)
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  related_entity_type TEXT, -- 'document', 'contact', 'conversation', etc.
  related_entity_id UUID,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes for Performance
-- ============================================================================

-- Query pending items by project
CREATE INDEX idx_llm_requests_pending 
  ON llm_requests(project_id, queued_at) 
  WHERE status = 'pending';

-- Query items needing retry
CREATE INDEX idx_llm_requests_retry 
  ON llm_requests(next_retry_at) 
  WHERE status = 'retry_pending';

-- Query by status and project
CREATE INDEX idx_llm_requests_status 
  ON llm_requests(project_id, status);

-- Query by context (for analytics)
CREATE INDEX idx_llm_requests_context 
  ON llm_requests(project_id, context, created_at);

-- Query by document
CREATE INDEX idx_llm_requests_document 
  ON llm_requests(document_id) 
  WHERE document_id IS NOT NULL;

-- Deduplication lookup
CREATE INDEX idx_llm_requests_hash 
  ON llm_requests(project_id, input_hash) 
  WHERE input_hash IS NOT NULL;

-- Recent requests for monitoring
CREATE INDEX idx_llm_requests_recent 
  ON llm_requests(created_at DESC);

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================

ALTER TABLE llm_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to INSERT (server needs to log requests)
CREATE POLICY "Allow insert for authenticated users"
  ON llm_requests FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to UPDATE (server needs to update status)
CREATE POLICY "Allow update for authenticated users"
  ON llm_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Project members can view their project's requests
CREATE POLICY "Project members can view LLM requests"
  ON llm_requests FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IS NULL
  );

-- Superadmins can view and delete all requests
CREATE POLICY "Superadmins can manage all LLM requests"
  ON llm_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Service role bypass (for server-side operations)
CREATE POLICY "Service role full access"
  ON llm_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. LLM Queue Statistics View
-- ============================================================================

CREATE OR REPLACE VIEW llm_queue_stats AS
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

-- ============================================================================
-- 5. LLM Queue Statistics by Context View
-- ============================================================================

CREATE OR REPLACE VIEW llm_context_stats AS
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

-- ============================================================================
-- 6. Updated at Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_llm_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_llm_requests_updated_at
  BEFORE UPDATE ON llm_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_llm_requests_updated_at();

-- ============================================================================
-- 7. Function to Claim Next Request (Atomic)
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
  attempt_count INTEGER
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
      v_request.attempt_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Function to Complete Request
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_llm_request(
  p_request_id UUID,
  p_output_data JSONB,
  p_output_text TEXT DEFAULT NULL,
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL,
  p_estimated_cost DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
BEGIN
  SELECT started_at INTO v_started_at FROM llm_requests WHERE id = p_request_id;
  
  UPDATE llm_requests
  SET 
    status = 'completed',
    completed_at = NOW(),
    processing_time_ms = EXTRACT(MILLISECONDS FROM (NOW() - v_started_at))::INTEGER,
    output_data = p_output_data,
    output_text = p_output_text,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    total_tokens = COALESCE(p_input_tokens, 0) + COALESCE(p_output_tokens, 0),
    estimated_cost_usd = p_estimated_cost,
    last_error = NULL,
    error_code = NULL,
    error_details = NULL,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. Function to Fail Request (with retry logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION fail_llm_request(
  p_request_id UUID,
  p_error TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL,
  p_retry BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_request llm_requests%ROWTYPE;
  v_next_status TEXT;
  v_retry_delay INTERVAL;
BEGIN
  SELECT * INTO v_request FROM llm_requests WHERE id = p_request_id;
  
  IF v_request.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Determine if we should retry
  IF p_retry AND v_request.attempt_count < v_request.max_attempts THEN
    v_next_status := 'retry_pending';
    -- Exponential backoff: 30s, 60s, 120s, 240s...
    v_retry_delay := (30 * POWER(2, v_request.attempt_count - 1)) * INTERVAL '1 second';
  ELSE
    v_next_status := 'failed';
    v_retry_delay := NULL;
  END IF;
  
  UPDATE llm_requests
  SET 
    status = v_next_status,
    completed_at = CASE WHEN v_next_status = 'failed' THEN NOW() ELSE NULL END,
    processing_time_ms = CASE 
      WHEN v_request.started_at IS NOT NULL 
      THEN EXTRACT(MILLISECONDS FROM (NOW() - v_request.started_at))::INTEGER 
      ELSE NULL 
    END,
    next_retry_at = CASE WHEN v_next_status = 'retry_pending' THEN NOW() + v_retry_delay ELSE NULL END,
    last_error = p_error,
    error_code = p_error_code,
    error_details = p_error_details,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. Function to Cancel Request
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_llm_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE llm_requests
  SET 
    status = 'cancelled',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id
    AND status IN ('pending', 'retry_pending');
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. Function to Retry Failed Request
-- ============================================================================

CREATE OR REPLACE FUNCTION retry_llm_request(p_request_id UUID, p_reset_attempts BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE llm_requests
  SET 
    status = 'retry_pending',
    next_retry_at = NOW(),
    attempt_count = CASE WHEN p_reset_attempts THEN 0 ELSE attempt_count END,
    last_error = NULL,
    error_code = NULL,
    error_details = NULL,
    updated_at = NOW()
  WHERE id = p_request_id
    AND status IN ('failed', 'cancelled');
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. Function to Clear Project Queue
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_llm_queue(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE llm_requests
  SET 
    status = 'cancelled',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE project_id = p_project_id
    AND status IN ('pending', 'retry_pending');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 13. Function to Get Queue Status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_llm_queue_status(p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
  pending_count BIGINT,
  processing_count BIGINT,
  retry_pending_count BIGINT,
  completed_today BIGINT,
  failed_today BIGINT,
  avg_processing_time_ms NUMERIC,
  total_cost_today_usd NUMERIC,
  oldest_pending_at TIMESTAMPTZ,
  current_processing JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'processing'),
    COUNT(*) FILTER (WHERE status = 'retry_pending'),
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= CURRENT_DATE),
    AVG(llm_requests.processing_time_ms) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    SUM(estimated_cost_usd) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    MIN(queued_at) FILTER (WHERE status = 'pending'),
    (SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'context', context,
      'provider', provider,
      'model', model,
      'started_at', started_at,
      'attempt', attempt_count
    )) FROM llm_requests r 
    WHERE r.status = 'processing' 
      AND (p_project_id IS NULL OR r.project_id = p_project_id))
  FROM llm_requests
  WHERE (p_project_id IS NULL OR project_id = p_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. Cleanup Old Completed Requests (optional scheduled job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_llm_requests(p_days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM llm_requests
  WHERE status IN ('completed', 'cancelled')
    AND completed_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 15. Comments
-- ============================================================================

COMMENT ON TABLE llm_requests IS 'Persistent queue for LLM requests with retry, audit, and cost tracking';
COMMENT ON COLUMN llm_requests.context IS 'What this request is for, e.g., extract_facts, generate_briefing';
COMMENT ON COLUMN llm_requests.input_hash IS 'Hash of input for deduplication';
COMMENT ON COLUMN llm_requests.priority IS 'Request priority: critical > high > normal > low';
COMMENT ON COLUMN llm_requests.next_retry_at IS 'When to retry failed request (exponential backoff)';
COMMENT ON FUNCTION claim_next_llm_request IS 'Atomically claim the next pending request (prevents race conditions)';
COMMENT ON FUNCTION complete_llm_request IS 'Mark request as completed with output data';
COMMENT ON FUNCTION fail_llm_request IS 'Mark request as failed, optionally schedule retry';
COMMENT ON FUNCTION retry_llm_request IS 'Manually retry a failed/cancelled request';

-- ============================================================================
-- Done
-- ============================================================================
