/**
 * Purpose:
 *   Outbound webhook management and delivery system. Allows projects to register
 *   HTTP endpoints that receive signed JSON payloads when specified events occur
 *   (content changes, document processing, member updates, etc.).
 *
 * Responsibilities:
 *   - CRUD operations on `webhooks` table (create, list, update, delete)
 *   - Generate and regenerate per-webhook HMAC signing secrets
 *   - Sign payloads with HMAC-SHA256 and verify incoming signatures
 *   - Trigger all matching webhooks for a given project + event type
 *   - Deliver payloads via HTTP/HTTPS with configurable retry (exponential backoff)
 *   - Record every delivery attempt in `webhook_deliveries` with timing and status
 *   - Track per-webhook stats (consecutive failures, total deliveries/failures)
 *   - Send test events for debugging integrations
 *
 * Key dependencies:
 *   - crypto: HMAC-SHA256 signing, randomUUID for delivery IDs, secret generation
 *   - http/https: native Node outbound HTTP requests (no external HTTP library)
 *   - ./client (getAdminClient): Supabase admin client
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - `deliverWebhook` makes outbound HTTP POST requests to user-configured URLs
 *   - `deliverWebhook` writes to both `webhook_deliveries` and `webhooks` (stats)
 *   - Failed deliveries schedule retries via setTimeout (in-process, not durable)
 *   - `createWebhook` stores the signing secret in plaintext in the DB
 *
 * Notes:
 *   - Retry is currently in-process via setTimeout; if the server restarts,
 *     pending retries are lost. Production should use a durable job queue.
 *   - Response bodies stored in `webhook_deliveries` are truncated to 10 KB.
 *   - `verifySignature` uses crypto.timingSafeEqual to prevent timing attacks.
 *   - The signing secret is returned only once at creation time and on
 *     explicit regeneration; `listWebhooks` omits it.
 *   - Retry delay uses linear backoff: delay * attemptNumber.
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'webhooks' });

// Available webhook events
const WEBHOOK_EVENTS = {
    // Content events
    CONTENT_CREATED: 'content.created',
    CONTENT_UPDATED: 'content.updated',
    CONTENT_DELETED: 'content.deleted',
    
    // Document events
    DOCUMENT_UPLOADED: 'document.uploaded',
    DOCUMENT_PROCESSED: 'document.processed',
    
    // Member events
    MEMBER_ADDED: 'member.added',
    MEMBER_REMOVED: 'member.removed',
    MEMBER_ROLE_CHANGED: 'member.role_changed',
    
    // Comment events
    COMMENT_CREATED: 'comment.created',
    COMMENT_RESOLVED: 'comment.resolved',
    
    // Project events
    PROJECT_UPDATED: 'project.updated'
};

/**
 * Generate a webhook secret
 */
function generateSecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Create HMAC signature for payload
 */
function signPayload(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
function verifySignature(payload, signature, secret) {
    const expected = signPayload(payload, secret);
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}

/**
 * Create a new webhook
 */
async function createWebhook({
    projectId,
    createdBy,
    name,
    description = null,
    url,
    events,
    customHeaders = {},
    maxRetries = 3,
    retryDelaySeconds = 60
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Validate URL
        try {
            new URL(url);
        } catch {
            return { success: false, error: 'Invalid URL' };
        }

        // Generate secret
        const secret = generateSecret();

        const { data: webhook, error } = await supabase
            .from('webhooks')
            .insert({
                project_id: projectId,
                created_by: createdBy,
                name,
                description,
                url,
                secret,
                events,
                custom_headers: customHeaders,
                max_retries: maxRetries,
                retry_delay_seconds: retryDelaySeconds
            })
            .select()
            .single();

        if (error) throw error;

        // Return webhook with secret (only time it's visible)
        return {
            success: true,
            webhook: {
                ...webhook,
                secret  // Show once
            }
        };
    } catch (error) {
        log.error({ event: 'webhooks_create_error', reason: error?.message }, 'Create error');
        return { success: false, error: error.message };
    }
}

/**
 * List webhooks for a project
 */
async function listWebhooks(projectId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: webhooks, error } = await supabase
            .from('webhooks')
            .select(`
                id, name, description, url, events, is_active,
                max_retries, retry_delay_seconds,
                last_triggered_at, last_success_at, last_failure_at,
                consecutive_failures, total_deliveries, total_failures,
                created_at, updated_at
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, webhooks: webhooks || [] };
    } catch (error) {
        log.error({ event: 'webhooks_list_error', reason: error?.message }, 'List error');
        return { success: false, error: error.message };
    }
}

/**
 * Update webhook
 */
async function updateWebhook(webhookId, updates) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const allowedFields = ['name', 'description', 'url', 'events', 'custom_headers', 'max_retries', 'retry_delay_seconds', 'is_active'];
    const filteredUpdates = {};
    
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    try {
        const { data: webhook, error } = await supabase
            .from('webhooks')
            .update(filteredUpdates)
            .eq('id', webhookId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, webhook };
    } catch (error) {
        log.error({ event: 'webhooks_update_error', reason: error?.message }, 'Update error');
        return { success: false, error: error.message };
    }
}

/**
 * Delete webhook
 */
async function deleteWebhook(webhookId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('webhooks')
            .delete()
            .eq('id', webhookId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        log.error({ event: 'webhooks_delete_error', reason: error?.message }, 'Delete error');
        return { success: false, error: error.message };
    }
}

/**
 * Regenerate webhook secret
 */
async function regenerateSecret(webhookId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const secret = generateSecret();

        const { data: webhook, error } = await supabase
            .from('webhooks')
            .update({ secret })
            .eq('id', webhookId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, secret };
    } catch (error) {
        log.error({ event: 'webhooks_regenerate_secret_error', reason: error?.message }, 'Regenerate secret error');
        return { success: false, error: error.message };
    }
}

/**
 * Trigger all active webhooks subscribed to the given event type for a project.
 * Uses Supabase `contains` filter to match webhooks whose `events` array
 * includes the given event type. Delivers each webhook sequentially.
 * @param {string} projectId
 * @param {string} eventType - One of WEBHOOK_EVENTS values
 * @param {object} payload - Event data to send
 */
async function triggerWebhooks(projectId, eventType, payload) {
    const supabase = getAdminClient();
    if (!supabase) return;

    try {
        // Get active webhooks subscribed to this event
        const { data: webhooks } = await supabase
            .from('webhooks')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .contains('events', [eventType]);

        if (!webhooks || webhooks.length === 0) return;

        // Trigger each webhook
        for (const webhook of webhooks) {
            await deliverWebhook(webhook, eventType, payload);
        }
    } catch (error) {
        log.error({ event: 'webhooks_trigger_error', reason: error?.message }, 'Trigger error');
    }
}

/**
 * Deliver a single webhook payload via HTTP POST.
 * Creates a delivery record in `webhook_deliveries` before the request,
 * updates it with the response (or error), and updates webhook-level stats.
 * On failure, schedules a retry via setTimeout with linear backoff
 * (delay * attemptNumber). Note: retries are in-process and not durable.
 * @param {object} webhook - Full webhook row from DB (including secret)
 * @param {string} eventType - Event being delivered
 * @param {object} payload - Event data
 * @param {number} [attemptNumber=1] - Current attempt (1-indexed)
 */
async function deliverWebhook(webhook, eventType, payload, attemptNumber = 1) {
    const supabase = getAdminClient();
    if (!supabase) return;

    const deliveryId = crypto.randomUUID();
    const startTime = Date.now();

    // Prepare request body
    const body = {
        event: eventType,
        timestamp: new Date().toISOString(),
        delivery_id: deliveryId,
        webhook_id: webhook.id,
        data: payload
    };

    const bodyString = JSON.stringify(body);
    const signature = signPayload(bodyString, webhook.secret);

    // Prepare headers
    const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Delivery': deliveryId,
        ...(webhook.custom_headers || {})
    };

    // Create delivery record
    await supabase.from('webhook_deliveries').insert({
        id: deliveryId,
        webhook_id: webhook.id,
        event_type: eventType,
        request_url: webhook.url,
        request_headers: headers,
        request_body: body,
        status: 'pending',
        attempt_number: attemptNumber
    });

    // Make request
    try {
        const response = await makeHttpRequest(webhook.url, {
            method: 'POST',
            headers,
            body: bodyString,
            timeout: 30000
        });

        const responseTime = Date.now() - startTime;
        const success = response.statusCode >= 200 && response.statusCode < 300;

        // Update delivery record
        await supabase.from('webhook_deliveries')
            .update({
                response_status: response.statusCode,
                response_headers: response.headers,
                response_body: response.body?.substring(0, 10000),  // Limit stored response
                response_time_ms: responseTime,
                status: success ? 'success' : 'failed',
                completed_at: new Date().toISOString(),
                error_message: success ? null : `HTTP ${response.statusCode}`
            })
            .eq('id', deliveryId);

        // Update webhook stats
        await supabase.from('webhooks')
            .update({
                last_triggered_at: new Date().toISOString(),
                ...(success ? {
                    last_success_at: new Date().toISOString(),
                    consecutive_failures: 0
                } : {
                    last_failure_at: new Date().toISOString(),
                    consecutive_failures: webhook.consecutive_failures + 1
                }),
                total_deliveries: webhook.total_deliveries + 1,
                total_failures: webhook.total_failures + (success ? 0 : 1)
            })
            .eq('id', webhook.id);

        // Schedule retry if failed and attempts remaining
        if (!success && attemptNumber < webhook.max_retries) {
            const nextRetry = new Date();
            nextRetry.setSeconds(nextRetry.getSeconds() + webhook.retry_delay_seconds * attemptNumber);
            
            await supabase.from('webhook_deliveries')
                .update({
                    status: 'retrying',
                    next_retry_at: nextRetry.toISOString()
                })
                .eq('id', deliveryId);

            // In production, use a job queue. For now, setTimeout
            setTimeout(() => {
                deliverWebhook(webhook, eventType, payload, attemptNumber + 1);
            }, webhook.retry_delay_seconds * attemptNumber * 1000);
        }

    } catch (error) {
        const responseTime = Date.now() - startTime;

        await supabase.from('webhook_deliveries')
            .update({
                response_time_ms: responseTime,
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error.message
            })
            .eq('id', deliveryId);

        // Update webhook failure stats
        await supabase.from('webhooks')
            .update({
                last_triggered_at: new Date().toISOString(),
                last_failure_at: new Date().toISOString(),
                consecutive_failures: webhook.consecutive_failures + 1,
                total_deliveries: webhook.total_deliveries + 1,
                total_failures: webhook.total_failures + 1
            })
            .eq('id', webhook.id);
    }
}

/**
 * Make HTTP request (helper)
 */
function makeHttpRequest(urlString, options) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const protocol = url.protocol === 'https:' ? https : http;

        const req = protocol.request(url, {
            method: options.method,
            headers: options.headers,
            timeout: options.timeout
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

/**
 * Get webhook delivery history
 */
async function getDeliveryHistory(webhookId, limit = 20) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: deliveries, error } = await supabase
            .from('webhook_deliveries')
            .select('*')
            .eq('webhook_id', webhookId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return { success: true, deliveries: deliveries || [] };
    } catch (error) {
        log.error({ event: 'webhooks_get_history_error', reason: error?.message }, 'Get history error');
        return { success: false, error: error.message };
    }
}

/**
 * Test webhook (send test event)
 */
async function testWebhook(webhookId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: webhook, error } = await supabase
            .from('webhooks')
            .select('*')
            .eq('id', webhookId)
            .single();

        if (error || !webhook) {
            return { success: false, error: 'Webhook not found' };
        }

        // Send test event
        await deliverWebhook(webhook, 'test', {
            message: 'This is a test webhook delivery',
            timestamp: new Date().toISOString()
        });

        return { success: true, message: 'Test webhook sent' };
    } catch (error) {
        log.error({ event: 'webhooks_test_error', reason: error?.message }, 'Test error');
        return { success: false, error: error.message };
    }
}

module.exports = {
    WEBHOOK_EVENTS,
    generateSecret,
    signPayload,
    verifySignature,
    createWebhook,
    listWebhooks,
    updateWebhook,
    deleteWebhook,
    regenerateSecret,
    triggerWebhooks,
    deliverWebhook,
    getDeliveryHistory,
    testWebhook
};
