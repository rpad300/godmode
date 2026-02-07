/**
 * Notification System Module
 * Alerts via email, webhook, and in-app notifications
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class NotificationSystem {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.configFile = path.join(this.dataDir, 'notification-config.json');
        this.historyFile = path.join(this.dataDir, 'notification-history.json');
        this.config = this.loadConfig();
        this.history = [];
        this.subscribers = new Map(); // channelId -> callback
        this.loadHistory();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.configFile = path.join(this.dataDir, 'notification-config.json');
        this.historyFile = path.join(this.dataDir, 'notification-history.json');
        this.config = this.loadConfig();
        this.loadHistory();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            }
        } catch (e) {}
        
        return {
            enabled: true,
            channels: {
                inApp: { enabled: true },
                webhook: { enabled: false, url: null },
                email: { enabled: false, smtp: null, to: null }
            },
            rules: [
                { event: 'new_insight', channels: ['inApp', 'webhook'], priority: 'high' },
                { event: 'graph_updated', channels: ['inApp'], priority: 'low' },
                { event: 'backup_completed', channels: ['inApp'], priority: 'info' },
                { event: 'error', channels: ['inApp', 'webhook', 'email'], priority: 'critical' },
                { event: 'integrity_issue', channels: ['inApp', 'webhook'], priority: 'high' }
            ],
            quietHours: null // { start: '22:00', end: '08:00' }
        };
    }

    saveConfig() {
        try {
            const dir = path.dirname(this.configFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (e) {
            console.log(`[Notifications] Save config warning: ${e.message}`);
        }
    }

    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                this.history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8')) || [];
            }
        } catch (e) {
            this.history = [];
        }
    }

    saveHistory() {
        try {
            const dir = path.dirname(this.historyFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(0, 500), null, 2));
        } catch (e) {}
    }

    /**
     * Send a notification
     */
    async notify(event, data, options = {}) {
        if (!this.config.enabled) {
            return { skipped: true, reason: 'Notifications disabled' };
        }

        // Check quiet hours
        if (this.isQuietHours() && options.priority !== 'critical') {
            return { skipped: true, reason: 'Quiet hours' };
        }

        // Find matching rule
        const rule = this.config.rules.find(r => r.event === event);
        const channels = options.channels || rule?.channels || ['inApp'];
        const priority = options.priority || rule?.priority || 'info';

        const notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            event,
            title: options.title || this.generateTitle(event),
            message: options.message || data.message || JSON.stringify(data),
            priority,
            data,
            createdAt: new Date().toISOString(),
            read: false,
            channels: [],
            deliveryStatus: {}
        };

        // Send to each channel
        for (const channel of channels) {
            try {
                const result = await this.sendToChannel(channel, notification);
                notification.channels.push(channel);
                notification.deliveryStatus[channel] = result;
            } catch (e) {
                notification.deliveryStatus[channel] = { error: e.message };
            }
        }

        // Store in history
        this.history.unshift(notification);
        if (this.history.length > 500) {
            this.history = this.history.slice(0, 500);
        }
        this.saveHistory();

        console.log(`[Notifications] Sent: ${event} (${priority}) -> ${channels.join(', ')}`);
        return notification;
    }

    /**
     * Send to a specific channel
     */
    async sendToChannel(channel, notification) {
        switch (channel) {
            case 'inApp':
                return this.sendInApp(notification);
            case 'webhook':
                return await this.sendWebhook(notification);
            case 'email':
                return await this.sendEmail(notification);
            default:
                return { error: 'Unknown channel' };
        }
    }

    /**
     * In-app notification (for SSE/WebSocket clients)
     */
    sendInApp(notification) {
        for (const [id, callback] of this.subscribers) {
            try {
                callback(notification);
            } catch (e) {}
        }
        return { sent: true, subscribers: this.subscribers.size };
    }

    /**
     * Webhook notification
     */
    async sendWebhook(notification) {
        const webhookUrl = this.config.channels.webhook?.url;
        if (!webhookUrl) {
            return { skipped: true, reason: 'No webhook URL configured' };
        }

        return new Promise((resolve) => {
            try {
                const url = new URL(webhookUrl);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                const payload = JSON.stringify({
                    type: 'notification',
                    notification: {
                        id: notification.id,
                        event: notification.event,
                        title: notification.title,
                        message: notification.message,
                        priority: notification.priority,
                        timestamp: notification.createdAt
                    }
                });

                const req = client.request({
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    },
                    timeout: 10000
                }, (res) => {
                    resolve({ sent: true, statusCode: res.statusCode });
                });

                req.on('error', (e) => {
                    resolve({ sent: false, error: e.message });
                });

                req.write(payload);
                req.end();
            } catch (e) {
                resolve({ sent: false, error: e.message });
            }
        });
    }

    /**
     * Email notification (stub - would need SMTP config)
     */
    async sendEmail(notification) {
        const emailConfig = this.config.channels.email;
        if (!emailConfig?.enabled || !emailConfig?.smtp) {
            return { skipped: true, reason: 'Email not configured' };
        }

        // Email sending would require nodemailer or similar
        // For now, just log
        console.log(`[Notifications] Would send email: ${notification.title}`);
        return { sent: false, reason: 'Email not implemented - use webhook instead' };
    }

    /**
     * Generate title from event name
     */
    generateTitle(event) {
        const titles = {
            new_insight: '🔍 New Insight Discovered',
            graph_updated: '📊 Graph Database Updated',
            backup_completed: '💾 Backup Completed',
            error: '❌ Error Occurred',
            integrity_issue: '⚠️ Integrity Issue Detected',
            new_entity: '🆕 New Entity Found',
            processing_complete: '✅ Processing Complete',
            sync_complete: '🔄 Sync Complete'
        };
        return titles[event] || `📢 ${event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    }

    /**
     * Check if currently in quiet hours
     */
    isQuietHours() {
        if (!this.config.quietHours) return false;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startH, startM] = this.config.quietHours.start.split(':').map(Number);
        const [endH, endM] = this.config.quietHours.end.split(':').map(Number);
        
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        if (startTime < endTime) {
            return currentTime >= startTime && currentTime < endTime;
        } else {
            return currentTime >= startTime || currentTime < endTime;
        }
    }

    /**
     * Subscribe to notifications (for in-app)
     */
    subscribe(id, callback) {
        this.subscribers.set(id, callback);
        return { subscribed: true, id };
    }

    /**
     * Unsubscribe
     */
    unsubscribe(id) {
        return this.subscribers.delete(id);
    }

    /**
     * Get notification history
     */
    getHistory(options = {}) {
        let notifications = [...this.history];
        
        if (options.event) {
            notifications = notifications.filter(n => n.event === options.event);
        }
        if (options.priority) {
            notifications = notifications.filter(n => n.priority === options.priority);
        }
        if (options.unreadOnly) {
            notifications = notifications.filter(n => !n.read);
        }

        const limit = options.limit || 50;
        return notifications.slice(0, limit);
    }

    /**
     * Mark notification as read
     */
    markRead(notificationId) {
        const notif = this.history.find(n => n.id === notificationId);
        if (notif) {
            notif.read = true;
            this.saveHistory();
            return true;
        }
        return false;
    }

    /**
     * Mark all as read
     */
    markAllRead() {
        let count = 0;
        for (const notif of this.history) {
            if (!notif.read) {
                notif.read = true;
                count++;
            }
        }
        this.saveHistory();
        return { marked: count };
    }

    /**
     * Get unread count
     */
    getUnreadCount() {
        return this.history.filter(n => !n.read).length;
    }

    /**
     * Update configuration
     */
    updateConfig(updates) {
        Object.assign(this.config, updates);
        this.saveConfig();
        return this.config;
    }

    /**
     * Get configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Create SSE handler for real-time notifications
     */
    createSSEHandler() {
        return (req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            const subscriberId = `sse_${Date.now()}`;
            
            this.subscribe(subscriberId, (notification) => {
                res.write(`data: ${JSON.stringify(notification)}\n\n`);
            });

            // Heartbeat
            const heartbeat = setInterval(() => {
                res.write(': heartbeat\n\n');
            }, 30000);

            // Send initial unread notifications
            const unread = this.getHistory({ unreadOnly: true, limit: 10 });
            if (unread.length > 0) {
                res.write(`data: ${JSON.stringify({ type: 'initial', notifications: unread })}\n\n`);
            }

            req.on('close', () => {
                clearInterval(heartbeat);
                this.unsubscribe(subscriberId);
            });
        };
    }
}

// Singleton
let instance = null;
function getNotificationSystem(options = {}) {
    if (!instance) {
        instance = new NotificationSystem(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { NotificationSystem, getNotificationSystem };
