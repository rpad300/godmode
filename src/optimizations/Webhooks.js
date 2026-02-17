/**
 * Purpose:
 *   Deliver real-time HTTP webhook notifications to registered endpoints
 *   when knowledge-graph events occur (new entity, new fact, new decision,
 *   document processed, etc.).
 *
 * Responsibilities:
 *   - Persist webhook endpoint registrations in a local JSON config file
 *   - Match triggered events to registered endpoints by event type filter
 *   - Send JSON POST requests with HMAC-SHA256 signatures when a secret
 *     is configured
 *   - Retry failed deliveries up to a configurable number of attempts
 *     with linear back-off
 *   - Provide a test-endpoint utility for connectivity verification
 *   - Expose convenience methods for common domain events (onNewEntity,
 *     onNewFact, onNewDecision, onNewRisk, onDocumentProcessed,
 *     onGraphUpdated)
 *
 * Key dependencies:
 *   - https / http: outbound webhook HTTP requests
 *   - fs / path: webhook configuration persistence (webhooks.json)
 *   - crypto: HMAC-SHA256 signature generation
 *
 * Side effects:
 *   - Reads and writes webhooks.json under this.dataDir
 *   - Makes outbound HTTP POST requests to registered URLs
 *   - Creates the data directory if it does not exist
 *
 * Notes:
 *   - The event queue is processed serially within processQueue; high
 *     webhook volume with slow endpoints could cause back-pressure.
 *   - Endpoint configuration is stored in a local file, not Supabase,
 *     so it is not shared across instances.
 *   - Request timeout is hardcoded to 10 seconds.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'webhooks' });

/**
 * Manages webhook endpoint registrations and delivers event-driven HTTP
 * notifications with HMAC-SHA256 signing and retry support.
 *
 * Lifecycle: construct (loads config) -> registerEndpoint -> trigger events.
 *
 * @param {object} options
 * @param {string} [options.dataDir='./data'] - Directory for webhooks.json config file
 */
class Webhooks {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.configFile = path.join(this.dataDir, 'webhooks.json');
        this.config = this.loadConfig();
        this.eventQueue = [];
        this.isProcessing = false;
    }

    /**
     * Load webhook configuration
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                return JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
            }
        } catch (e) {
            log.warn({ event: 'webhooks_load_config_failed' }, 'Could not load config');
        }
        return {
            endpoints: [],
            enabled: true,
            retryAttempts: 3,
            retryDelay: 5000
        };
    }

    /**
     * Save webhook configuration
     */
    saveConfig() {
        try {
            const dir = path.dirname(this.configFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (e) {
            log.warn({ event: 'webhooks_save_config_failed', message: e.message }, 'Could not save config');
        }
    }

    /**
     * Register a new webhook endpoint. Persists to webhooks.json.
     * @param {object} endpoint
     * @param {string} endpoint.url - Target URL (http or https)
     * @param {string[]} [endpoint.events=['all']] - Event types to subscribe to
     * @param {string|null} [endpoint.secret] - HMAC signing secret
     * @param {boolean} [endpoint.enabled=true] - Whether the endpoint is active
     * @returns {object} The created endpoint entry with generated id
     */
    registerEndpoint(endpoint) {
        const entry = {
            id: Date.now().toString(36),
            url: endpoint.url,
            events: endpoint.events || ['all'], // 'all', 'new_entity', 'new_fact', 'new_decision', etc.
            secret: endpoint.secret || null,
            enabled: endpoint.enabled !== false,
            createdAt: new Date().toISOString()
        };

        this.config.endpoints.push(entry);
        this.saveConfig();
        return entry;
    }

    /**
     * Remove a webhook endpoint
     */
    removeEndpoint(id) {
        const index = this.config.endpoints.findIndex(e => e.id === id);
        if (index !== -1) {
            this.config.endpoints.splice(index, 1);
            this.saveConfig();
            return true;
        }
        return false;
    }

    /**
     * Get all endpoints
     */
    getEndpoints() {
        return this.config.endpoints;
    }

    /**
     * Dispatch an event to all matching registered endpoints. Events are
     * queued and processed serially to avoid overwhelming receivers.
     * @param {string} eventType - Event type identifier (e.g. 'new_entity')
     * @param {*} data - Event payload
     */
    async trigger(eventType, data) {
        if (!this.config.enabled) return;

        const event = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
            type: eventType,
            data,
            timestamp: new Date().toISOString()
        };

        // Find matching endpoints
        const matchingEndpoints = this.config.endpoints.filter(ep => 
            ep.enabled && (ep.events.includes('all') || ep.events.includes(eventType))
        );

        if (matchingEndpoints.length === 0) return;

        // Queue event for each endpoint
        for (const endpoint of matchingEndpoints) {
            this.eventQueue.push({ event, endpoint });
        }

        // Process queue
        this.processQueue();
    }

    /**
     * Process event queue
     */
    async processQueue() {
        if (this.isProcessing || this.eventQueue.length === 0) return;
        this.isProcessing = true;

        while (this.eventQueue.length > 0) {
            const { event, endpoint } = this.eventQueue.shift();
            await this.sendWebhook(endpoint, event);
        }

        this.isProcessing = false;
    }

    /**
     * Send a single webhook HTTP POST. Includes X-Webhook-Event, X-Webhook-ID,
     * and X-Webhook-Signature (HMAC-SHA256) headers. Retries on non-2xx or error.
     * @param {object} endpoint - Registered endpoint config
     * @param {object} event - Serialized event payload
     * @param {number} [attempt=1] - Current retry attempt
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async sendWebhook(endpoint, event, attempt = 1) {
        return new Promise((resolve) => {
            try {
                const url = new URL(endpoint.url);
                const isHttps = url.protocol === 'https:';
                const lib = isHttps ? https : http;

                const payload = JSON.stringify(event);
                
                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                        'X-Webhook-Event': event.type,
                        'X-Webhook-ID': event.id
                    },
                    timeout: 10000
                };

                // Add secret signature if configured
                if (endpoint.secret) {
                    const crypto = require('crypto');
                    const signature = crypto
                        .createHmac('sha256', endpoint.secret)
                        .update(payload)
                        .digest('hex');
                    options.headers['X-Webhook-Signature'] = signature;
                }

                const req = lib.request(options, (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        log.debug({ event: 'webhooks_sent', eventType: event.type, url: endpoint.url }, 'Sent');
                        resolve({ success: true });
                    } else {
                        log.warn({ event: 'webhooks_failed', statusCode: res.statusCode, url: endpoint.url }, 'Failed');
                        this.handleRetry(endpoint, event, attempt, resolve);
                    }
                });

                req.on('error', (error) => {
                    log.warn({ event: 'webhooks_error', message: error.message, url: endpoint.url }, 'Error');
                    this.handleRetry(endpoint, event, attempt, resolve);
                });

                req.on('timeout', () => {
                    req.destroy();
                    log.warn({ event: 'webhooks_timeout', url: endpoint.url }, 'Timeout');
                    this.handleRetry(endpoint, event, attempt, resolve);
                });

                req.write(payload);
                req.end();
            } catch (error) {
                log.warn({ event: 'webhooks_exception', message: error.message }, 'Exception');
                resolve({ success: false, error: error.message });
            }
        });
    }

    /**
     * Handle retry logic
     */
    handleRetry(endpoint, event, attempt, resolve) {
        if (attempt < this.config.retryAttempts) {
            setTimeout(() => {
                this.sendWebhook(endpoint, event, attempt + 1).then(resolve);
            }, this.config.retryDelay * attempt);
        } else {
            resolve({ success: false, error: 'Max retries exceeded' });
        }
    }

    /**
     * Test a webhook endpoint
     */
    async testEndpoint(endpointId) {
        const endpoint = this.config.endpoints.find(e => e.id === endpointId);
        if (!endpoint) return { error: 'Endpoint not found' };

        const testEvent = {
            id: 'test_' + Date.now(),
            type: 'test',
            data: { message: 'This is a test webhook' },
            timestamp: new Date().toISOString()
        };

        return this.sendWebhook(endpoint, testEvent);
    }

    /**
     * Common event triggers
     */
    async onNewEntity(entity) {
        await this.trigger('new_entity', entity);
    }

    async onNewFact(fact) {
        await this.trigger('new_fact', fact);
    }

    async onNewDecision(decision) {
        await this.trigger('new_decision', decision);
    }

    async onNewRisk(risk) {
        await this.trigger('new_risk', risk);
    }

    async onDocumentProcessed(doc) {
        await this.trigger('document_processed', doc);
    }

    async onGraphUpdated(stats) {
        await this.trigger('graph_updated', stats);
    }
}

// Singleton
let webhooksInstance = null;
function getWebhooks(options = {}) {
    if (!webhooksInstance) {
        webhooksInstance = new Webhooks(options);
    }
    return webhooksInstance;
}

module.exports = { Webhooks, getWebhooks };
