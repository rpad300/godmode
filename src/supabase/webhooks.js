/**
 * Webhooks Module
 * Manages webhooks for event notifications
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { getAdminClient } = require('./client');

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
        console.error('[Webhooks] Create error:', error);
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
        console.error('[Webhooks] List error:', error);
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
        console.error('[Webhooks] Update error:', error);
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
        console.error('[Webhooks] Delete error:', error);
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
        console.error('[Webhooks] Regenerate secret error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Trigger webhooks for an event
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
        console.error('[Webhooks] Trigger error:', error);
    }
}

/**
 * Deliver a webhook
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
        console.error('[Webhooks] Get history error:', error);
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
        console.error('[Webhooks] Test error:', error);
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
