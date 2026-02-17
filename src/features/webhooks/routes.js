/**
 * Purpose:
 *   Full CRUD for project webhooks, plus test-fire, delivery history,
 *   and secret regeneration endpoints.
 *
 * Responsibilities:
 *   - List, create, update, and delete webhooks for a project
 *   - Trigger a test delivery to verify webhook endpoint connectivity
 *   - Retrieve paginated delivery history for debugging
 *   - Regenerate the signing secret (shown once on regeneration)
 *
 * Key dependencies:
 *   - supabase.webhooks: data-access layer for webhook CRUD, test, deliveries
 *   - supabase.auth: token extraction and user verification (create only)
 *   - ../../server/security.isValidUUID: validates project IDs
 *
 * Side effects:
 *   - POST /webhooks creates a row and returns the signing secret once only
 *   - POST /test fires an HTTP request to the webhook URL
 *   - POST /regenerate-secret replaces the signing secret
 *   - DELETE removes the webhook record
 *
 * Notes:
 *   - Returns 503 if Supabase is not configured
 *   - Only webhook creation requires authentication; other mutations are unguarded
 *     at the route level (Assumption: middleware or RLS handles authorization)
 *   - The signing secret is displayed only on creation and regeneration
 *
 * Routes:
 *   GET    /api/projects/:id/webhooks              - List webhooks for project
 *   POST   /api/projects/:id/webhooks              - Create webhook (auth required)
 *          Body: { name, description, url, events[], custom_headers, max_retries, retry_delay_seconds }
 *   PUT    /api/webhooks/:id                       - Update webhook
 *   DELETE /api/webhooks/:id                       - Delete webhook
 *   POST   /api/webhooks/:id/test                  - Send test delivery
 *   GET    /api/webhooks/:id/deliveries            - Delivery history (?limit=N, default 20)
 *   POST   /api/webhooks/:id/regenerate-secret     - Regenerate signing secret
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { isValidUUID } = require('../../server/security');

/**
 * Handle webhooks routes
 * @param {object} ctx - Context with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled
 */
async function handleWebhooks(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    if (!supabase || !supabase.isConfigured()) {
        if (pathname.startsWith('/api/projects/') && pathname.includes('/webhooks') ||
            pathname.startsWith('/api/webhooks/')) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        return false;
    }

    // GET /api/projects/:id/webhooks - List webhooks
    const listMatch = pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/);
    if (listMatch && req.method === 'GET') {
        const projectId = listMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.webhooks.list(projectId);
        if (result.success) jsonResponse(res, { webhooks: result.webhooks });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/projects/:id/webhooks - Create webhook
    const createMatch = pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/);
    if (createMatch && req.method === 'POST') {
        const projectId = createMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const body = await parseBody(req);
        const result = await supabase.webhooks.create({
            projectId,
            createdBy: userResult.user.id,
            name: body.name,
            description: body.description,
            url: body.url,
            events: body.events || [],
            customHeaders: body.custom_headers,
            maxRetries: body.max_retries,
            retryDelaySeconds: body.retry_delay_seconds
        });
        if (result.success) {
            jsonResponse(res, {
                success: true,
                webhook: result.webhook,
                message: 'Save the secret - it will only be shown once!'
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // PUT /api/webhooks/:id - Update webhook
    const webhookIdMatch = pathname.match(/^\/api\/webhooks\/([^/]+)$/);
    if (webhookIdMatch && req.method === 'PUT') {
        const webhookId = webhookIdMatch[1];
        const body = await parseBody(req);
        const result = await supabase.webhooks.update(webhookId, body);
        if (result.success) jsonResponse(res, { success: true, webhook: result.webhook });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // DELETE /api/webhooks/:id - Delete webhook
    if (webhookIdMatch && req.method === 'DELETE') {
        const webhookId = webhookIdMatch[1];
        const result = await supabase.webhooks.delete(webhookId);
        if (result.success) jsonResponse(res, { success: true });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/webhooks/:id/test - Test webhook
    const testMatch = pathname.match(/^\/api\/webhooks\/([^/]+)\/test$/);
    if (testMatch && req.method === 'POST') {
        const webhookId = testMatch[1];
        const result = await supabase.webhooks.test(webhookId);
        if (result.success) jsonResponse(res, { success: true, message: result.message });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/webhooks/:id/deliveries - Get delivery history
    const deliveriesMatch = pathname.match(/^\/api\/webhooks\/([^/]+)\/deliveries$/);
    if (deliveriesMatch && req.method === 'GET') {
        const webhookId = deliveriesMatch[1];
        const urlParsed = parsedUrl || parseUrl(req.url);
        const limit = parseInt(urlParsed.query?.limit) || 20;
        const result = await supabase.webhooks.getDeliveryHistory(webhookId, limit);
        if (result.success) jsonResponse(res, { deliveries: result.deliveries });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
    const regenerateMatch = pathname.match(/^\/api\/webhooks\/([^/]+)\/regenerate-secret$/);
    if (regenerateMatch && req.method === 'POST') {
        const webhookId = regenerateMatch[1];
        const result = await supabase.webhooks.regenerateSecret(webhookId);
        if (result.success) jsonResponse(res, { success: true, secret: result.secret });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    return false;
}

module.exports = { handleWebhooks };
