/**
 * Notifications Module
 * Handles user notifications, read status, and preferences
 */

const { getAdminClient } = require('./client');

// Notification types
const NOTIFICATION_TYPES = {
    MENTION: 'mention',
    REPLY: 'reply',
    COMMENT: 'comment',
    INVITE: 'invite',
    INVITE_ACCEPTED: 'invite_accepted',
    ROLE_CHANGED: 'role_changed',
    CONTENT_UPDATED: 'content_updated',
    SYSTEM: 'system'
};

/**
 * Create a notification
 */
async function createNotification({
    userId,
    projectId = null,
    type,
    title,
    body = null,
    referenceType = null,
    referenceId = null,
    actorId = null
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: notification, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                project_id: projectId,
                type,
                title,
                body,
                reference_type: referenceType,
                reference_id: referenceId,
                actor_id: actorId
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, notification };
    } catch (error) {
        console.error('[Notifications] Create error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get notifications for a user
 */
async function getUserNotifications(userId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const {
        limit = 20,
        offset = 0,
        unreadOnly = false,
        projectId = null
    } = options;

    try {
        let query = supabase
            .from('notifications')
            .select(`
                *,
                actor:user_profiles!actor_id(id, username, display_name, avatar_url),
                project:projects!project_id(id, name)
            `, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (unreadOnly) {
            query = query.eq('is_read', false);
        }

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data: notifications, error, count } = await query;

        if (error) throw error;

        return { 
            success: true, 
            notifications,
            total: count,
            unreadCount: unreadOnly ? count : null
        };
    } catch (error) {
        console.error('[Notifications] Get error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { count, error } = await query;

        if (error) throw error;

        return { success: true, count };
    } catch (error) {
        console.error('[Notifications] Count error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('id', notificationId)
            .eq('user_id', userId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Notifications] Mark read error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { error } = await query;

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Notifications] Mark all read error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a notification
 */
async function deleteNotification(notificationId, userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', userId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Notifications] Delete error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete old notifications (cleanup)
 */
async function deleteOldNotifications(daysOld = 30) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const { error, count } = await supabase
            .from('notifications')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .eq('is_read', true);

        if (error) throw error;

        return { success: true, deleted: count };
    } catch (error) {
        console.error('[Notifications] Cleanup error:', error);
        return { success: false, error: error.message };
    }
}

// ==================== Watched Items ====================

/**
 * Watch an item for notifications
 */
async function watchItem({
    userId,
    projectId,
    targetType,
    targetId,
    notifyComments = true,
    notifyUpdates = true,
    notifyMentions = true
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: watch, error } = await supabase
            .from('watched_items')
            .upsert({
                user_id: userId,
                project_id: projectId,
                target_type: targetType,
                target_id: targetId,
                notify_comments: notifyComments,
                notify_updates: notifyUpdates,
                notify_mentions: notifyMentions
            }, {
                onConflict: 'user_id,project_id,target_type,target_id'
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, watch };
    } catch (error) {
        console.error('[Notifications] Watch error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unwatch an item
 */
async function unwatchItem(userId, projectId, targetType, targetId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('watched_items')
            .delete()
            .eq('user_id', userId)
            .eq('project_id', projectId)
            .eq('target_type', targetType)
            .eq('target_id', targetId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Notifications] Unwatch error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get watchers of an item (for sending notifications)
 */
async function getWatchers(projectId, targetType, targetId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: watchers, error } = await supabase
            .from('watched_items')
            .select('user_id, notify_comments, notify_updates, notify_mentions')
            .eq('project_id', projectId)
            .eq('target_type', targetType)
            .eq('target_id', targetId);

        if (error) throw error;

        return { success: true, watchers: watchers || [] };
    } catch (error) {
        console.error('[Notifications] Get watchers error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's watched items
 */
async function getUserWatchedItems(userId, projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('watched_items')
            .select('*')
            .eq('user_id', userId);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data: items, error } = await query;

        if (error) throw error;

        return { success: true, items: items || [] };
    } catch (error) {
        console.error('[Notifications] Get watched error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Notify watchers of an item (except the actor)
 */
async function notifyWatchers({
    projectId,
    targetType,
    targetId,
    type,
    title,
    body = null,
    actorId,
    referenceType = null,
    referenceId = null,
    checkPreference = 'notify_updates'
}) {
    const result = await getWatchers(projectId, targetType, targetId);
    if (!result.success) return result;

    const notifications = [];
    
    for (const watcher of result.watchers) {
        // Skip the actor
        if (watcher.user_id === actorId) continue;
        
        // Check preference
        if (checkPreference && !watcher[checkPreference]) continue;

        const notifResult = await createNotification({
            userId: watcher.user_id,
            projectId,
            type,
            title,
            body,
            referenceType,
            referenceId,
            actorId
        });

        if (notifResult.success) {
            notifications.push(notifResult.notification);
        }
    }

    return { success: true, notified: notifications.length };
}

module.exports = {
    NOTIFICATION_TYPES,
    createNotification,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteOldNotifications,
    watchItem,
    unwatchItem,
    getWatchers,
    getUserWatchedItems,
    notifyWatchers
};
