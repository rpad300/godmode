/**
 * Purpose:
 *   User notification management API routes. Provides listing, unread count,
 *   mark-as-read (single and bulk), and deletion of notifications.
 *
 * Responsibilities:
 *   - GET /api/notifications: List notifications with pagination, unread filter, and project scope
 *   - GET /api/notifications/count: Get unread notification count (graceful degradation: returns 0
 *     if auth missing, module unavailable, or any error occurs)
 *   - POST /api/notifications/:id/read: Mark a single notification as read
 *   - POST /api/notifications/read-all: Mark all notifications as read (optionally per project)
 *   - DELETE /api/notifications/:id: Delete a notification
 *
 * Key dependencies:
 *   - supabase.notifications: Data access with getForUser, getUnreadCount, markAsRead,
 *     markAllAsRead, delete methods
 *   - supabase.auth: Token extraction and user verification
 *
 * Side effects:
 *   - Database: updates read status, deletes notifications
 *
 * Notes:
 *   - The /count endpoint is designed to never fail from the client's perspective;
 *     it returns { count: 0 } for all error paths, including missing auth, to avoid
 *     UI error states for a non-critical feature
 *   - All write endpoints require authentication (401 on failure)
 *   - Project-scoped filtering is optional via project_id query param or body field
 */

const { parseUrl, parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

/**
 * Handle all notifications-related routes
 * @param {Object} ctx - Context object with req, res, pathname, supabase
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleNotifications(ctx) {
    const { req, res, pathname, supabase } = ctx;
    
    // Quick check - if not a notifications route, return false immediately
    if (!pathname.startsWith('/api/notifications')) {
        return false;
    }

    // GET /api/notifications - Get user notifications
    if (pathname === '/api/notifications' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const parsedUrl = parseUrl(req.url);
        
        const result = await supabase.notifications.getForUser(userResult.user.id, {
            limit: parseInt(parsedUrl.query.limit) || 20,
            offset: parseInt(parsedUrl.query.offset) || 0,
            unreadOnly: parsedUrl.query.unread_only === 'true',
            projectId: parsedUrl.query.project_id
        });
        
        if (result.success) {
            jsonResponse(res, { 
                notifications: result.notifications,
                total: result.total
            });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // GET /api/notifications/count - Get unread count
    if (pathname === '/api/notifications/count' && req.method === 'GET') {
        // Return 0 if not configured, no notifications API, or not authenticated (graceful fallback)
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { count: 0 });
            return true;
        }
        if (!supabase.notifications || typeof supabase.notifications.getUnreadCount !== 'function') {
            jsonResponse(res, { count: 0 });
            return true;
        }
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            // No auth - just return 0 count instead of 401
            jsonResponse(res, { count: 0 });
            return true;
        }
        
        try {
            const parsedUrl = parseUrl(req.url);
            const result = await supabase.notifications.getUnreadCount(userResult.user.id, parsedUrl.query.project_id);
            if (result.success) {
                jsonResponse(res, { count: result.count });
            } else {
                jsonResponse(res, { count: 0 });
            }
        } catch (err) {
            jsonResponse(res, { count: 0 });
        }
        return true;
    }
    
    // POST /api/notifications/:id/read - Mark as read
    if (pathname.match(/^\/api\/notifications\/([^/]+)\/read$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const notificationId = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const result = await supabase.notifications.markAsRead(notificationId, userResult.user.id);
        
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // POST /api/notifications/read-all - Mark all as read
    if (pathname === '/api/notifications/read-all' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const body = await parseBody(req);
        const result = await supabase.notifications.markAllAsRead(userResult.user.id, body.project_id);
        
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // DELETE /api/notifications/:id - Delete notification
    if (pathname.match(/^\/api\/notifications\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const notificationId = pathname.match(/^\/api\/notifications\/([^/]+)$/)[1];
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        
        const result = await supabase.notifications.delete(notificationId, userResult.user.id);
        
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleNotifications };
