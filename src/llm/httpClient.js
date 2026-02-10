/**
 * HTTP Client Wrapper with Injectable Transport
 * Provides a centralized HTTP layer for LLM providers that can be mocked for testing.
 * Includes optional circuit breaker: after N consecutive failures, reject fast for cooldown.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { logger: rootLogger } = require('../logger');

const log = rootLogger.child({ module: 'llm-http' });

const LLM_CIRCUIT_THRESHOLD = Number(process.env.LLM_CIRCUIT_THRESHOLD) || 5;
const LLM_CIRCUIT_COOLDOWN_MS = Number(process.env.LLM_CIRCUIT_COOLDOWN_MS) || 60000;
const circuitState = { failures: 0, lastFailureAt: 0, state: 'closed' };

// Transport layer - can be swapped for testing
let transport = null;

/**
 * Set a custom transport for testing
 * @param {function} customTransport - Function with signature (options) => Promise<{status, data, headers}>
 */
function setTransport(customTransport) {
    transport = customTransport;
}

/**
 * Reset to default HTTP transport
 */
function resetTransport() {
    transport = null;
}

/**
 * Get current transport (for inspection in tests)
 */
function getTransport() {
    return transport;
}

/**
 * Default HTTP transport using Node.js http/https
 */
async function defaultTransport(options) {
    const { method, url, headers, body, timeoutMs = 120000 } = options;
    
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: method || 'GET',
            headers: headers || {},
            timeout: timeoutMs
        };

        const req = protocol.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: json, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data, headers: res.headers });
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Request failed: ${e.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (body) {
            const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
            req.write(bodyStr);
        }
        req.end();
    });
}

/**
 * Make an HTTP request (with optional circuit breaker when transport is default)
 * @param {object} options
 * @param {string} options.method - HTTP method
 * @param {string} options.url - Full URL
 * @param {object} [options.headers] - Request headers
 * @param {object|string} [options.body] - Request body
 * @param {number} [options.timeoutMs] - Timeout in milliseconds
 * @returns {Promise<{status: number, data: any, headers: object}>}
 */
async function request(options) {
    const activeTransport = transport || defaultTransport;
    const useCircuit = !transport;
    if (useCircuit) {
        const now = Date.now();
        if (circuitState.state === 'open') {
            if (now - circuitState.lastFailureAt < LLM_CIRCUIT_COOLDOWN_MS) {
                throw new Error('LLM circuit open (service temporarily unavailable)');
            }
            circuitState.state = 'half-open';
        }
        try {
            const result = await activeTransport(options);
            if (result.status >= 200 && result.status < 400) {
                circuitState.failures = 0;
                circuitState.state = 'closed';
            } else {
                circuitState.failures += 1;
                circuitState.lastFailureAt = now;
                if (circuitState.failures >= LLM_CIRCUIT_THRESHOLD) {
                    circuitState.state = 'open';
                    log.warn({ event: 'llm_circuit_open', failures: circuitState.failures, cooldownMs: LLM_CIRCUIT_COOLDOWN_MS }, 'LLM circuit open');
                }
            }
            return result;
        } catch (e) {
            circuitState.failures += 1;
            circuitState.lastFailureAt = now;
            if (circuitState.failures >= LLM_CIRCUIT_THRESHOLD) {
                circuitState.state = 'open';
                log.warn({ event: 'llm_circuit_open', failures: circuitState.failures, cooldownMs: LLM_CIRCUIT_COOLDOWN_MS }, 'LLM circuit open');
            }
            throw e;
        }
    }
    return activeTransport(options);
}

/**
 * Convenience method for GET requests
 */
async function get(url, headers = {}, timeoutMs = 120000) {
    return request({ method: 'GET', url, headers, timeoutMs });
}

/**
 * Convenience method for POST requests
 */
async function post(url, body, headers = {}, timeoutMs = 120000) {
    return request({ method: 'POST', url, headers, body, timeoutMs });
}

/**
 * Create request metadata for logging/testing (without sensitive data)
 */
function createRequestMeta(options) {
    const meta = {
        method: options.method,
        url: options.url,
        hasBody: !!options.body
    };
    
    // Don't include headers (may contain API keys)
    return meta;
}

module.exports = {
    request,
    get,
    post,
    setTransport,
    resetTransport,
    getTransport,
    createRequestMeta
};
