/**
 * Realtime Module
 * Handles Supabase Realtime subscriptions for live updates
 */

const { getClient } = require('./client');

// Active subscriptions
const subscriptions = new Map();

// Event handlers registry
const handlers = new Map();

/**
 * Subscribe to project changes
 */
function subscribeToProject(projectId, callbacks = {}) {
    const supabase = getClient();
    if (!supabase) {
        console.warn('[Realtime] Supabase not configured');
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
            console.log('[Realtime] Activity:', payload.eventType);
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
            console.log('[Realtime] Comment:', payload.eventType);
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
            console.log('[Realtime] Member:', payload.eventType);
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
        console.log(`[Realtime] Channel ${channelName}: ${status}`);
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
            console.log('[Realtime] New notification');
            if (callback) callback(payload.new);
            emitEvent('notification', { userId, notification: payload.new });
        }
    );

    channel.subscribe();
    subscriptions.set(channelName, channel);
    return channel;
}

/**
 * Subscribe to presence (online users)
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
        console.log('[Realtime] Presence sync:', Object.keys(state).length, 'users');
        if (callbacks.onSync) callbacks.onSync(state);
        emitEvent('presence_sync', { projectId, state });
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Realtime] User joined:', key);
        if (callbacks.onJoin) callbacks.onJoin(key, newPresences);
        emitEvent('presence_join', { projectId, userId: key, presences: newPresences });
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Realtime] User left:', key);
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
        console.warn('[Realtime] No presence channel for project');
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
        console.error('[Realtime] Track presence error:', error);
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
 * Register event handler
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
            console.error(`[Realtime] Handler error for ${event}:`, error);
        }
    }
}

/**
 * Broadcast a message to channel
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
        console.error('[Realtime] Broadcast error:', error);
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
