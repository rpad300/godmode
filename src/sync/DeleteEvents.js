/**
 * Purpose:
 *   Real-time event bus for delete and restore operations, enabling both
 *   in-process listeners and remote WebSocket / SSE subscribers to react
 *   immediately when data is removed or restored.
 *
 * Responsibilities:
 *   - Emit typed events (`delete`, `delete:<entityType>`, `restore`, etc.)
 *     via the Node.js EventEmitter API
 *   - Maintain a bounded in-memory history of recent events
 *   - Push events to registered WebSocket connections with optional
 *     entity-type and event-type filters
 *   - Expose an SSE (Server-Sent Events) HTTP handler factory with
 *     heartbeat keep-alive
 *
 * Key dependencies:
 *   - events (Node.js built-in): base EventEmitter class
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Sends data over WebSocket connections (network I/O)
 *   - SSE handler writes to the HTTP response stream and sets an interval
 *     timer; both are cleaned up on client disconnect
 *   - Removes failed WebSocket subscribers automatically on send error
 *
 * Notes:
 *   - The `subscribers` Map holds raw WebSocket references; if the process
 *     does not call `unsubscribe` on disconnect, entries will accumulate
 *     (though failed sends trigger automatic cleanup).
 *   - Event history is capped at `maxHistory` (default 100) and ordered
 *     newest-first.
 *   - SSE heartbeat interval is 30 seconds.
 */

const EventEmitter = require('events');
const { logger } = require('../logger');

const log = logger.child({ module: 'delete-events' });

class DeleteEvents extends EventEmitter {
    constructor(options = {}) {
        super();
        this.subscribers = new Map(); // websocket connections
        this.eventHistory = [];
        this.maxHistory = options.maxHistory || 100;
    }

    /**
     * Emit a delete event
     */
    emitDelete(type, item, options = {}) {
        const event = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'DELETE',
            entityType: type,
            entityId: item.id,
            entityName: item.name || item.title,
            timestamp: new Date().toISOString(),
            deletedBy: options.deletedBy || 'system',
            cascade: options.cascade || false,
            graphSynced: options.graphSynced || false,
            softDelete: options.softDelete || false
        };

        // Store in history
        this.eventHistory.unshift(event);
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistory);
        }

        // Emit to local listeners
        this.emit('delete', event);
        this.emit(`delete:${type}`, event);

        // Notify WebSocket subscribers
        this.notifySubscribers(event);

        log.debug({ event: 'delete_events_emitted', entityType: type, entityName: item.name || item.title }, 'Emitted DELETE event');
        return event;
    }

    /**
     * Emit a restore event
     */
    emitRestore(type, item, options = {}) {
        const event = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'RESTORE',
            entityType: type,
            entityId: item.id,
            entityName: item.name || item.title,
            timestamp: new Date().toISOString(),
            restoredBy: options.restoredBy || 'system'
        };

        this.eventHistory.unshift(event);
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistory);
        }

        this.emit('restore', event);
        this.emit(`restore:${type}`, event);
        this.notifySubscribers(event);

        return event;
    }

    /**
     * Subscribe a WebSocket connection
     */
    subscribe(connectionId, ws, filters = {}) {
        this.subscribers.set(connectionId, { ws, filters });
        log.debug({ event: 'delete_events_subscriber_added', connectionId }, 'Subscriber added');
    }

    /**
     * Unsubscribe a connection
     */
    unsubscribe(connectionId) {
        this.subscribers.delete(connectionId);
        log.debug({ event: 'delete_events_subscriber_removed', connectionId }, 'Subscriber removed');
    }

    /**
     * Notify WebSocket subscribers
     */
    notifySubscribers(event) {
        for (const [id, { ws, filters }] of this.subscribers) {
            try {
                // Apply filters
                if (filters.entityType && filters.entityType !== event.entityType) {
                    continue;
                }
                if (filters.eventType && filters.eventType !== event.type) {
                    continue;
                }

                // Send event
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.send(JSON.stringify({
                        type: 'delete_event',
                        payload: event
                    }));
                }
            } catch (e) {
                log.warn({ event: 'delete_events_notify_failed', id, reason: e.message }, 'Failed to notify subscriber');
                this.subscribers.delete(id);
            }
        }
    }

    /**
     * Get recent events
     */
    getRecentEvents(options = {}) {
        let events = [...this.eventHistory];

        if (options.entityType) {
            events = events.filter(e => e.entityType === options.entityType);
        }
        if (options.eventType) {
            events = events.filter(e => e.type === options.eventType);
        }

        const limit = options.limit || 20;
        return events.slice(0, limit);
    }

    /**
     * Get subscriber count
     */
    getSubscriberCount() {
        return this.subscribers.size;
    }

    /**
     * Create SSE stream for delete events
     */
    createSSEHandler() {
        return (req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            const connectionId = `sse_${Date.now()}`;
            
            const sendEvent = (event) => {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            };

            // Send heartbeat
            const heartbeat = setInterval(() => {
                res.write(': heartbeat\n\n');
            }, 30000);

            // Listen for events
            this.on('delete', sendEvent);
            this.on('restore', sendEvent);

            // Cleanup on close
            req.on('close', () => {
                clearInterval(heartbeat);
                this.removeListener('delete', sendEvent);
                this.removeListener('restore', sendEvent);
            });

            // Send initial connection message
            res.write(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`);
        };
    }
}

// Singleton
let instance = null;
function getDeleteEvents(options = {}) {
    if (!instance) {
        instance = new DeleteEvents(options);
    }
    return instance;
}

module.exports = { DeleteEvents, getDeleteEvents };
