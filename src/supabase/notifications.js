/**
 * Notifications Module
 * Handles user notifications, read status, and preferences
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'notifications' });

// Notification types
const NOTIFICATION_TYPES = {
    MENTION: 'mention',
    REPLY: 'reply',
    COMMENT: 'comment',
    INVITE: 'invite',
    INVITE_ACCEPTED: 'invite_accepted',
    ROLE_CHANGED: 'role_changed',
    CONTENT_UPDATED: 'content_updated',
    SYSTEM: 'system',
    // Billing notifications
    BALANCE_LOW: 'balance_low',
    REQUEST_BLOCKED: 'request_blocked',
    BALANCE_ADDED: 'balance_added'
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
        log.warn({ event: 'notifications_create_error', reason: error?.message }, 'Create error');
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
        log.warn({ event: 'notifications_get_error', reason: error?.message }, 'Get error');
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
        log.warn({ event: 'notifications_count_error', reason: error?.message }, 'Count error');
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
        log.warn({ event: 'notifications_mark_read_error', reason: error?.message }, 'Mark read error');
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
        log.warn({ event: 'notifications_mark_all_read_error', reason: error?.message }, 'Mark all read error');
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
        log.warn({ event: 'notifications_delete_error', reason: error?.message }, 'Delete error');
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
        log.warn({ event: 'notifications_cleanup_error', reason: error?.message }, 'Cleanup error');
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
        log.warn({ event: 'notifications_watch_error', reason: error?.message }, 'Watch error');
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
        log.warn({ event: 'notifications_unwatch_error', reason: error?.message }, 'Unwatch error');
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
        log.warn({ event: 'notifications_get_watchers_error', reason: error?.message }, 'Get watchers error');
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
        log.warn({ event: 'notifications_get_watched_error', reason: error?.message }, 'Get watched error');
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

// ============================================
// BILLING NOTIFICATIONS
// ============================================

/**
 * Create a low balance notification for project admins
 * @param {string} projectId - Project ID
 * @param {number} currentBalance - Current balance in EUR
 * @param {string} projectName - Project name
 * @returns {Promise<{success: boolean, notified: number}>}
 */
async function createBalanceLowNotification(projectId, currentBalance, projectName) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, notified: 0 };
    }

    try {
        // Get project admins
        const { data: members } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId)
            .in('role', ['owner', 'admin']);

        if (!members || members.length === 0) {
            return { success: true, notified: 0 };
        }

        let notified = 0;
        for (const member of members) {
            const result = await createNotification({
                userId: member.user_id,
                projectId,
                type: NOTIFICATION_TYPES.BALANCE_LOW,
                title: 'Low Balance Warning',
                body: `Project "${projectName || 'Unknown'}" has a low balance (€${currentBalance?.toFixed(2) || '0.00'}). Add funds to continue using AI features.`,
                referenceType: 'billing',
                referenceId: projectId
            });
            if (result.success) notified++;
        }

        return { success: true, notified };
    } catch (error) {
        log.warn({ event: 'notifications_balance_low_error', reason: error?.message }, 'Error creating balance low notification');
        return { success: false, notified: 0 };
    }
}

/**
 * Create a request blocked notification
 * @param {string} projectId - Project ID
 * @param {string} userId - User who made the request
 * @param {string} reason - Blocking reason
 * @returns {Promise<{success: boolean}>}
 */
async function createRequestBlockedNotification(projectId, userId, reason) {
    if (!userId) {
        return { success: false };
    }

    return createNotification({
        userId,
        projectId,
        type: NOTIFICATION_TYPES.REQUEST_BLOCKED,
        title: 'AI Request Blocked',
        body: `Your AI request was blocked. ${reason}`,
        referenceType: 'billing',
        referenceId: projectId
    });
}

/**
 * Create a balance added notification for project admins
 * @param {string} projectId - Project ID
 * @param {number} amount - Amount added in EUR
 * @param {number} newBalance - New balance in EUR
 * @param {string} projectName - Project name
 * @param {string} addedBy - User ID who added the balance
 * @returns {Promise<{success: boolean, notified: number}>}
 */
async function createBalanceAddedNotification(projectId, amount, newBalance, projectName, addedBy = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, notified: 0 };
    }

    try {
        // Get project admins
        const { data: members } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId)
            .in('role', ['owner', 'admin']);

        if (!members || members.length === 0) {
            return { success: true, notified: 0 };
        }

        let notified = 0;
        for (const member of members) {
            // Skip the person who added the balance
            if (member.user_id === addedBy) continue;

            const result = await createNotification({
                userId: member.user_id,
                projectId,
                type: NOTIFICATION_TYPES.BALANCE_ADDED,
                title: 'Balance Added',
                body: `€${amount?.toFixed(2) || '0.00'} was added to project "${projectName || 'Unknown'}". New balance: €${newBalance?.toFixed(2) || '0.00'}`,
                referenceType: 'billing',
                referenceId: projectId,
                actorId: addedBy
            });
            if (result.success) notified++;
        }

        return { success: true, notified };
    } catch (error) {
        log.warn({ event: 'notifications_balance_added_error', reason: error?.message }, 'Error creating balance added notification');
        return { success: false, notified: 0 };
    }
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
    notifyWatchers,
    // Billing notifications
    createBalanceLowNotification,
    createRequestBlockedNotification,
    createBalanceAddedNotification
};
