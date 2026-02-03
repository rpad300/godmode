/**
 * Delete Events Module
 * Emits real-time events when items are deleted
 */

const EventEmitter = require('events');

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

        console.log(`[DeleteEvents] Emitted DELETE event for ${type} "${item.name || item.title}"`);
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
        console.log(`[DeleteEvents] Subscriber ${connectionId} added`);
    }

    /**
     * Unsubscribe a connection
     */
    unsubscribe(connectionId) {
        this.subscribers.delete(connectionId);
        console.log(`[DeleteEvents] Subscriber ${connectionId} removed`);
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
                console.log(`[DeleteEvents] Failed to notify ${id}: ${e.message}`);
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
