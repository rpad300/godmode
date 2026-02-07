/**
 * Webhooks feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET    /api/projects/:id/webhooks
 * - POST   /api/projects/:id/webhooks
 * - PUT    /api/webhooks/:id
 * - DELETE /api/webhooks/:id
 * - POST   /api/webhooks/:id/test
 * - GET    /api/webhooks/:id/deliveries?limit=N
 * - POST   /api/webhooks/:id/regenerate-secret
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleWebhooks(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;

    // GET /api/projects/:id/webhooks - List webhooks
    if (pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/)[1];
        const result = await supabase.webhooks.list(projectId);

        if (result.success) {
            jsonResponse(res, { webhooks: result.webhooks });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/projects/:id/webhooks - Create webhook
    if (pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/)[1];
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
    if (pathname.match(/^\/api\/webhooks\/([^/]+)$/) && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)$/)[1];
        const body = await parseBody(req);

        const result = await supabase.webhooks.update(webhookId, body);

        if (result.success) {
            jsonResponse(res, { success: true, webhook: result.webhook });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // DELETE /api/webhooks/:id - Delete webhook
    if (pathname.match(/^\/api\/webhooks\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)$/)[1];
        const result = await supabase.webhooks.delete(webhookId);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/webhooks/:id/test - Test webhook
    if (pathname.match(/^\/api\/webhooks\/([^/]+)\/test$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)\/test$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);

        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const result = await supabase.webhooks.test(webhookId);

        if (result.success) {
            jsonResponse(res, { success: true, message: result.message });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // GET /api/webhooks/:id/deliveries - Get delivery history
    if (pathname.match(/^\/api\/webhooks\/([^/]+)\/deliveries$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)\/deliveries$/)[1];
        const limit = parseInt(parsedUrl?.query?.limit) || 20;

        const result = await supabase.webhooks.getDeliveryHistory(webhookId, limit);

        if (result.success) {
            jsonResponse(res, { deliveries: result.deliveries });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
    if (pathname.match(/^\/api\/webhooks\/([^/]+)\/regenerate-secret$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }

        const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)\/regenerate-secret$/)[1];
        const result = await supabase.webhooks.regenerateSecret(webhookId);

        if (result.success) {
            jsonResponse(res, { success: true, secret: result.secret });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    return false;
}

module.exports = { handleWebhooks };
