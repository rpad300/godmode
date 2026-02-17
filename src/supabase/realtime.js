/**
 * Purpose:
 *   Manages Supabase Realtime channel subscriptions for live, push-based
 *   updates to connected clients. Provides a unified event bus for project
 *   activity, comments, member changes, sync status, notifications,
 *   presence tracking, and arbitrary broadcast messages.
 *
 * Responsibilities:
 *   - Subscribe to postgres_changes on `activity_log`, `comments`,
 *     `project_members`, and `graph_outbox` per project
 *   - Subscribe to INSERT events on `notifications` per user
 *   - Manage presence channels (join/leave/sync) for online-user tracking
 *   - Maintain a module-level Map of active channel subscriptions (deduplicated)
 *   - Provide a simple pub/sub event handler registry (on/emitEvent)
 *   - Broadcast arbitrary messages to named channels
 *   - Expose helpers for cleanup (unsubscribe, unsubscribeAll)
 *
 * Key dependencies:
 *   - ./client (getClient): Supabase anon/user client (not admin) for Realtime
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Opens persistent WebSocket connections to Supabase Realtime
 *   - Module-level `subscriptions` Map holds active channel references (stateful)
 *   - Module-level `handlers` Map holds registered event callbacks (stateful)
 *
 * Notes:
 *   - Uses the anon/user client (not admin) because Realtime subscriptions
 *     typically run in the context of an authenticated user session.
 *   - Subscriptions are deduplicated by channel name; calling subscribe twice
 *     for the same channel returns the existing subscription.
 *   - Presence is keyed by `user_id`; metadata is extensible via trackPresence.
 *   - `broadcast` creates a new channel if one is not already subscribed,
 *     which may leave orphan channels if not cleaned up.
 */

const { logger } = require('../logger');
const { getClient } = require('./client');

const log = logger.child({ module: 'realtime' });

// Active subscriptions
const subscriptions = new Map();

// Event handlers registry
const handlers = new Map();

/**
 * Subscribe to all project-scoped table changes on a single Supabase Realtime channel.
 * Listens to postgres_changes on: activity_log, comments, project_members, graph_outbox.
 * Returns the existing channel if already subscribed (deduplicated by channel name).
 * @param {string} projectId - Project UUID (used in filter: `project_id=eq.{projectId}`)
 * @param {object} [callbacks] - Optional per-table callbacks: { onActivity, onComment, onMember, onSync, onStatus }
 * @returns {object|null} Supabase channel object, or null if client unavailable
 */
function subscribeToProject(projectId, callbacks = {}) {
    const supabase = getClient();
    if (!supabase) {
        log.warn({ event: 'realtime_not_configured' }, 'Supabase not configured');
        return null;
    }

    const channelName = `project:${projectId}`;
    
    // Check if already subscribed
    if (subscriptions.has(channelName)) {
        return subscriptions.get(channelName);
    }

    const channel = supabase.channel(channelName);

    // Subscribe to activity_log changes
    channel.on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'activity_log',
            filter: `project_id=eq.${projectId}`
        },
        (payload) => {
            log.debug({ event: 'realtime_activity', eventType: payload.eventType }, 'Activity');
            if (callbacks.onActivity) callbacks.onActivity(payload);
            emitEvent('activity', { projectId, payload });
        }
    );

    // Subscribe to comments
    channel.on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `project_id=eq.${projectId}`
        },
        (payload) => {
            log.debug({ event: 'realtime_comment', eventType: payload.eventType }, 'Comment');
            if (callbacks.onComment) callbacks.onComment(payload);
            emitEvent('comment', { projectId, payload });
        }
    );

    // Subscribe to project_members changes
    channel.on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'project_members',
            filter: `project_id=eq.${projectId}`
        },
        (payload) => {
            log.debug({ event: 'realtime_member', eventType: payload.eventType }, 'Member');
            if (callbacks.onMember) callbacks.onMember(payload);
            emitEvent('member', { projectId, payload });
        }
    );

    // Subscribe to outbox changes (sync status)
    channel.on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'graph_outbox',
            filter: `project_id=eq.${projectId}`
        },
        (payload) => {
            if (callbacks.onSync) callbacks.onSync(payload);
            emitEvent('sync', { projectId, payload });
        }
    );

    // Subscribe
    channel.subscribe((status) => {
        log.debug({ event: 'realtime_channel_status', channelName, status }, 'Channel status');
        if (callbacks.onStatus) callbacks.onStatus(status);
    });

    subscriptions.set(channelName, channel);
    return channel;
}

/**
 * Subscribe to user notifications
 */
function subscribeToNotifications(userId, callback) {
    const supabase = getClient();
    if (!supabase) return null;

    const channelName = `notifications:${userId}`;
    
    if (subscriptions.has(channelName)) {
        return subscriptions.get(channelName);
    }

    const channel = supabase.channel(channelName);

    channel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
        },
        (payload) => {
            log.debug({ event: 'realtime_notification' }, 'New notification');
            if (callback) callback(payload.new);
            emitEvent('notification', { userId, notification: payload.new });
        }
    );

    channel.subscribe();
    subscriptions.set(channelName, channel);
    return channel;
}

/**
 * Subscribe to presence events for tracking online users in a project.
 * Uses Supabase Realtime presence with user_id as the presence key.
 * @param {string} projectId
 * @param {object} [callbacks] - { onSync, onJoin, onLeave }
 */
function subscribeToPresence(projectId, callbacks = {}) {
    const supabase = getClient();
    if (!supabase) return null;

    const channelName = `presence:${projectId}`;
    
    if (subscriptions.has(channelName)) {
        return subscriptions.get(channelName);
    }

    const channel = supabase.channel(channelName, {
        config: {
            presence: {
                key: 'user_id'
            }
        }
    });

    channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        log.debug({ event: 'realtime_presence_sync', userCount: Object.keys(state).length }, 'Presence sync');
        if (callbacks.onSync) callbacks.onSync(state);
        emitEvent('presence_sync', { projectId, state });
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        log.debug({ event: 'realtime_presence_join', userId: key }, 'User joined');
        if (callbacks.onJoin) callbacks.onJoin(key, newPresences);
        emitEvent('presence_join', { projectId, userId: key, presences: newPresences });
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        log.debug({ event: 'realtime_presence_leave', userId: key }, 'User left');
        if (callbacks.onLeave) callbacks.onLeave(key, leftPresences);
        emitEvent('presence_leave', { projectId, userId: key, presences: leftPresences });
    });

    channel.subscribe();
    subscriptions.set(channelName, channel);
    return channel;
}

/**
 * Track user presence
 */
async function trackPresence(projectId, userId, metadata = {}) {
    const channelName = `presence:${projectId}`;
    const channel = subscriptions.get(channelName);
    
    if (!channel) {
        log.warn({ event: 'realtime_no_presence_channel', projectId }, 'No presence channel for project');
        return false;
    }

    try {
        await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            ...metadata
        });
        return true;
    } catch (error) {
        log.error({ event: 'realtime_track_presence_error', reason: error?.message }, 'Track presence error');
        return false;
    }
}

/**
 * Untrack user presence
 */
async function untrackPresence(projectId) {
    const channelName = `presence:${projectId}`;
    const channel = subscriptions.get(channelName);
    
    if (channel) {
        await channel.untrack();
    }
}

/**
 * Unsubscribe from a channel
 */
function unsubscribe(channelName) {
    const channel = subscriptions.get(channelName);
    if (channel) {
        channel.unsubscribe();
        subscriptions.delete(channelName);
    }
}

/**
 * Unsubscribe from all channels
 */
function unsubscribeAll() {
    for (const [name, channel] of subscriptions) {
        channel.unsubscribe();
    }
    subscriptions.clear();
}

/**
 * Register a handler for a named event on the internal event bus.
 * @param {string} event - Event name (e.g., 'activity', 'notification', 'presence_sync')
 * @param {Function} handler - Callback receiving the event data
 * @returns {Function} Unsubscribe function to remove this handler
 */
function on(event, handler) {
    if (!handlers.has(event)) {
        handlers.set(event, []);
    }
    handlers.get(event).push(handler);
    
    // Return unsubscribe function
    return () => {
        const eventHandlers = handlers.get(event);
        const index = eventHandlers.indexOf(handler);
        if (index > -1) {
            eventHandlers.splice(index, 1);
        }
    };
}

/**
 * Emit event to handlers
 */
function emitEvent(event, data) {
    const eventHandlers = handlers.get(event) || [];
    for (const handler of eventHandlers) {
        try {
            handler(data);
        } catch (error) {
            log.error({ event: 'realtime_handler_error', eventName: event, reason: error?.message }, 'Handler error');
        }
    }
}

/**
 * Broadcast an arbitrary message to a named Realtime channel.
 * Creates a new channel if one with the given name is not already subscribed.
 * Note: the new channel is NOT tracked in the subscriptions Map, which may
 * cause a leak if called repeatedly with different channel names.
 */
async function broadcast(channelName, event, payload) {
    const supabase = getClient();
    if (!supabase) return false;

    try {
        const channel = subscriptions.get(channelName) || supabase.channel(channelName);
        await channel.send({
            type: 'broadcast',
            event,
            payload
        });
        return true;
    } catch (error) {
        log.error({ event: 'realtime_broadcast_error', reason: error?.message }, 'Broadcast error');
        return false;
    }
}

/**
 * Get active subscriptions
 */
function getActiveSubscriptions() {
    return Array.from(subscriptions.keys());
}

/**
 * Get presence state for a project
 */
function getPresenceState(projectId) {
    const channelName = `presence:${projectId}`;
    const channel = subscriptions.get(channelName);
    
    if (channel) {
        return channel.presenceState();
    }
    return {};
}

module.exports = {
    subscribeToProject,
    subscribeToNotifications,
    subscribeToPresence,
    trackPresence,
    untrackPresence,
    unsubscribe,
    unsubscribeAll,
    on,
    broadcast,
    getActiveSubscriptions,
    getPresenceState
};
