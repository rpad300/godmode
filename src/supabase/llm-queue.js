/**
 * LLM Queue Database Operations
 * Persistent queue for LLM requests with retry, audit, and project segregation
 * 
 * NOTE: Uses admin client (service_role) because the server processes LLM requests
 * without an authenticated user context. The RLS policies for llm_requests require
 * either an authenticated user or service_role access.
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');
const crypto = require('crypto');

const log = logger.child({ module: 'llm-queue' });

/**
 * Generate hash for input data (for deduplication)
 */
function hashInput(inputData) {
  const str = JSON.stringify(inputData);
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 32);
}

/**
 * Enqueue a new LLM request
 */
async function enqueueRequest({
  projectId,
  userId = null,
  requestType,
  context,
  provider,
  model,
  inputData,
  priority = 'normal',
  maxAttempts = 3,
  documentId = null,
  relatedEntityType = null,
  relatedEntityId = null,
  metadata = {},
  deduplicate = false
}) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const inputHash = deduplicate ? hashInput(inputData) : null;

    // Check for duplicate if deduplication enabled
    if (deduplicate && inputHash) {
      const { data: existing } = await client
        .from('llm_requests')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('input_hash', inputHash)
        .in('status', ['pending', 'processing', 'retry_pending'])
        .limit(1)
        .single();

      if (existing) {
        return { 
          success: true, 
          id: existing.id, 
          deduplicated: true,
          message: 'Request already in queue' 
        };
      }
    }

    const { data, error } = await client
      .from('llm_requests')
      .insert({
        project_id: projectId,
        user_id: userId,
        request_type: requestType,
        context,
        provider,
        model,
        input_data: inputData,
        input_hash: inputHash,
        priority,
        max_attempts: maxAttempts,
        document_id: documentId,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        metadata,
        status: 'pending',
        queued_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, id: data.id, deduplicated: false };
  } catch (error) {
    log.warn({ event: 'llm_queue_enqueue_error', reason: error?.message }, 'Failed to enqueue request');
    return { success: false, error: error.message };
  }
}

/**
 * Claim the next pending request (atomic operation)
 */
async function claimNextRequest(projectId = null) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client.rpc('claim_next_llm_request', {
      p_project_id: projectId
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return { success: true, request: null, message: 'No pending requests' };
    }

    const row = data[0];
    return {
      success: true,
      request: {
        id: row.request_id,
        requestType: row.request_type,
        context: row.context,
        provider: row.provider,
        model: row.model,
        inputData: row.input_data,
        priority: row.req_priority,
        attemptCount: row.attempt_count,
        projectId: row.req_project_id || null
      }
    };
  } catch (error) {
    log.warn({ event: 'llm_queue_claim_error', reason: error?.message }, 'Failed to claim request');
    return { success: false, error: error.message };
  }
}

/**
 * Complete a request successfully
 */
async function completeRequest({
  requestId,
  outputData,
  outputText = null,
  inputTokens = null,
  outputTokens = null,
  estimatedCost = null
}) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client.rpc('complete_llm_request', {
      p_request_id: requestId,
      p_output_data: outputData,
      p_output_text: outputText,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_estimated_cost: estimatedCost
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    log.warn({ event: 'llm_queue_complete_error', reason: error?.message }, 'Failed to complete request');
    return { success: false, error: error.message };
  }
}

/**
 * Fail a request (with optional retry)
 */
async function failRequest({
  requestId,
  error,
  errorCode = null,
  errorDetails = null,
  retry = true
}) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, err } = await client.rpc('fail_llm_request', {
      p_request_id: requestId,
      p_error: error,
      p_error_code: errorCode,
      p_error_details: errorDetails,
      p_retry: retry
    });

    if (err) throw err;

    return { success: true };
  } catch (err) {
    log.warn({ event: 'llm_queue_mark_failed_error', reason: err?.message }, 'Failed to mark request as failed');
    return { success: false, error: err.message };
  }
}

/**
 * Cancel a pending request
 */
async function cancelRequest(requestId) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client.rpc('cancel_llm_request', {
      p_request_id: requestId
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    log.warn({ event: 'llm_queue_cancel_error', reason: error?.message }, 'Failed to cancel request');
    return { success: false, error: error.message };
  }
}

/**
 * Retry a failed request
 */
async function retryRequest(requestId, resetAttempts = false) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client.rpc('retry_llm_request', {
      p_request_id: requestId,
      p_reset_attempts: resetAttempts
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    log.warn({ event: 'llm_queue_retry_error', reason: error?.message }, 'Failed to retry request');
    return { success: false, error: error.message };
  }
}

/**
 * Clear all pending requests for a project
 */
async function clearQueue(projectId) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client.rpc('clear_llm_queue', {
      p_project_id: projectId
    });

    if (error) throw error;

    return { success: true, cleared: data };
  } catch (error) {
    log.warn({ event: 'llm_queue_clear_error', reason: error?.message }, 'Failed to clear queue');
    return { success: false, error: error.message };
  }
}

/**
 * Get queue status
 */
async function getQueueStatus(projectId = null) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client.rpc('get_llm_queue_status', {
      p_project_id: projectId
    });

    if (error) throw error;

    const row = data && data[0] ? data[0] : {};
    return {
      success: true,
      status: {
        pendingCount: parseInt(row.pending_count) || 0,
        processingCount: parseInt(row.processing_count) || 0,
        retryPendingCount: parseInt(row.retry_pending_count) || 0,
        completedToday: parseInt(row.completed_today) || 0,
        failedToday: parseInt(row.failed_today) || 0,
        avgProcessingTimeMs: parseFloat(row.avg_processing_time_ms) || 0,
        totalCostTodayUsd: parseFloat(row.total_cost_today_usd) || 0,
        oldestPendingAt: row.oldest_pending_at,
        currentProcessing: row.current_processing || []
      }
    };
  } catch (error) {
    log.warn({ event: 'llm_queue_status_error', reason: error?.message }, 'Failed to get queue status');
    return { success: false, error: error.message };
  }
}

/**
 * Get pending requests
 */
async function getPendingRequests(projectId, limit = 50) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    let query = client
      .from('llm_requests')
      .select('id, context, priority, queued_at, attempt_count, request_type, provider, model')
      .in('status', ['pending', 'retry_pending'])
      .order('queued_at', { ascending: true })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      items: (data || []).map(r => ({
        id: r.id,
        context: r.context,
        priority: r.priority,
        queuedAt: r.queued_at,
        attemptCount: r.attempt_count,
        requestType: r.request_type,
        provider: r.provider,
        model: r.model
      }))
    };
  } catch (error) {
    log.warn({ event: 'llm_queue_pending_error', reason: error?.message }, 'Failed to get pending requests');
    return { success: false, error: error.message };
  }
}

/**
 * Get request history
 */
async function getHistory(projectId = null, limit = 100, offset = 0) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    let query = client
      .from('llm_requests')
      .select(`
        id, context, priority, status, 
        queued_at, started_at, completed_at, processing_time_ms,
        request_type, provider, model,
        input_tokens, output_tokens, total_tokens, estimated_cost_usd,
        attempt_count, last_error, error_code
      `)
      .in('status', ['completed', 'failed', 'cancelled'])
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      history: (data || []).map(r => ({
        id: r.id,
        context: r.context,
        priority: r.priority,
        status: r.status,
        queuedAt: r.queued_at,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        processingTime: r.processing_time_ms,
        requestType: r.request_type,
        provider: r.provider,
        model: r.model,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        totalTokens: r.total_tokens,
        estimatedCost: r.estimated_cost_usd,
        attemptCount: r.attempt_count,
        error: r.last_error,
        errorCode: r.error_code
      }))
    };
  } catch (error) {
    log.warn({ event: 'llm_queue_history_error', reason: error?.message }, 'Failed to get history');
    return { success: false, error: error.message };
  }
}

/**
 * Get statistics by context
 */
async function getStatsByContext(projectId = null) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    let query = client
      .from('llm_context_stats')
      .select('*');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      stats: data || []
    };
  } catch (error) {
    log.warn({ event: 'llm_queue_stats_error', reason: error?.message }, 'Failed to get stats by context');
    return { success: false, error: error.message };
  }
}

/**
 * Get failed requests that can be retried
 */
async function getRetryableRequests(projectId = null, limit = 50) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    let query = client
      .from('llm_requests')
      .select(`
        id, context, priority, status, 
        queued_at, completed_at, processing_time_ms,
        request_type, provider, model,
        attempt_count, max_attempts, last_error, error_code
      `)
      .eq('status', 'failed')
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      items: (data || []).map(r => ({
        id: r.id,
        context: r.context,
        priority: r.priority,
        status: r.status,
        queuedAt: r.queued_at,
        completedAt: r.completed_at,
        processingTime: r.processing_time_ms,
        requestType: r.request_type,
        provider: r.provider,
        model: r.model,
        attemptCount: r.attempt_count,
        maxAttempts: r.max_attempts,
        canRetry: r.attempt_count < r.max_attempts,
        error: r.last_error,
        errorCode: r.error_code
      }))
    };
  } catch (error) {
    log.warn({ event: 'llm_queue_get_retryable_error', reason: error?.message }, 'Failed to get retryable requests');
    return { success: false, error: error.message };
  }
}

/**
 * Get a specific request with full details
 */
async function getRequest(requestId) {
  const client = getAdminClient();
  if (!client) {
    return { success: false, error: 'Database not configured (missing service_role key)' };
  }

  try {
    const { data, error } = await client
      .from('llm_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) throw error;

    return { success: true, request: data };
  } catch (error) {
    log.warn({ event: 'llm_queue_get_request_error', reason: error?.message }, 'Failed to get request');
    return { success: false, error: error.message };
  }
}

module.exports = {
  enqueueRequest,
  claimNextRequest,
  completeRequest,
  failRequest,
  cancelRequest,
  retryRequest,
  clearQueue,
  getQueueStatus,
  getPendingRequests,
  getHistory,
  getStatsByContext,
  getRetryableRequests,
  getRequest
};
