/**
 * Purpose:
 *   Abstract base class that defines the contract for all LLM provider adapters.
 *   Concrete providers (OpenAI, Claude, Gemini, etc.) extend this and override
 *   the stubbed methods to integrate with their respective APIs.
 *
 * Responsibilities:
 *   - Declare the provider interface: generateText, generateVision, embed, listModels, testConnection
 *   - Provide shared infrastructure: HTTP with timeout, retry with exponential backoff, error classification
 *   - Normalize heterogeneous API errors into a uniform {provider, step, code, message, retryable} shape
 *
 * Key dependencies:
 *   - ../httpClient: injectable HTTP client (makes providers testable without real network calls)
 *   - ../../logger: structured pino logger for observability
 *
 * Side effects:
 *   - Network I/O via fetchWithTimeout (delegated to httpClient)
 *   - Logging via pino child logger
 *
 * Notes:
 *   - Default timeout is 5 minutes (300 000 ms) to accommodate large-context completions.
 *   - withRetry uses a gentler 1.5x exponential backoff with a longer base delay (10 s)
 *     for rate-limit errors, to avoid compounding 429s.
 *   - classifyErrorCode is intentionally broad and string-match-based because different
 *     providers return errors in inconsistent formats.
 *   - Subclasses MUST set this.name in their constructor for log/error attribution.
 */

const httpClient = require('../httpClient');
const { logger: rootLogger } = require('../../logger');

class BaseLLMProvider {
    constructor(config = {}) {
        this.config = config;
        this.name = 'base';
        this.timeout = config.timeout || 300000; // 5 minutes default for large prompts
    }

    /**
     * Provider capabilities - override in subclasses
     */
    static get capabilities() {
        return {
            listModels: false,
            text: false,
            vision: false,
            embeddings: false
        };
    }

    /**
     * Provider display information
     */
    static get info() {
        return {
            id: 'base',
            label: 'Base Provider',
            capabilities: this.capabilities
        };
    }

    /**
     * Check if provider is configured (has required credentials)
     * @returns {boolean}
     */
    isConfigured() {
        return false;
    }

    /**
     * Test connection to the provider
     * @returns {Promise<{ok: boolean, error?: {message: string, code?: string}}>}
     */
    async testConnection() {
        return { ok: false, error: { message: 'Not implemented' } };
    }

    /**
     * List available models from the provider
     * @returns {Promise<{textModels: Array, visionModels: Array, embeddingModels: Array}>}
     */
    async listModels() {
        return { textModels: [], visionModels: [], embeddingModels: [] };
    }

    /**
     * Generate text completion
     * @param {object} options
     * @param {string} options.model - Model name
     * @param {string} options.prompt - User prompt
     * @param {string} [options.system] - System prompt
     * @param {number} [options.temperature=0.7] - Temperature
     * @param {number} [options.maxTokens=4096] - Max tokens
     * @param {boolean} [options.jsonMode=false] - Request JSON output
     * @returns {Promise<{success: boolean, text?: string, usage?: {inputTokens: number, outputTokens: number}, error?: string, raw?: any}>}
     */
    async generateText(options) {
        return { success: false, error: 'Not implemented' };
    }

    /**
     * Generate text with vision (image input)
     * @param {object} options
     * @param {string} options.model - Model name
     * @param {string} options.prompt - User prompt
     * @param {Array<string>} options.images - Array of base64 encoded images or file paths
     * @param {number} [options.temperature=0.7] - Temperature
     * @param {number} [options.maxTokens=4096] - Max tokens
     * @returns {Promise<{success: boolean, text?: string, usage?: {inputTokens: number, outputTokens: number}, error?: string, raw?: any}>}
     */
    async generateVision(options) {
        return { success: false, error: 'Vision not supported by this provider' };
    }

    /**
     * Generate embeddings for texts
     * @param {object} options
     * @param {string} options.model - Embedding model name
     * @param {Array<string>} options.texts - Array of texts to embed
     * @returns {Promise<{success: boolean, embeddings?: Array<Array<number>>, error?: string}>}
     */
    async embed(options) {
        return { success: false, error: 'Embeddings not supported by this provider' };
    }

    /**
     * Create a standardized error object
     * @param {string} step - The operation that failed
     * @param {string} message - Error message
     * @param {number} [statusCode] - HTTP status code if applicable
     * @param {boolean} [retryable=false] - Whether the operation can be retried
     */
    createError(step, message, statusCode = null, retryable = false) {
        return {
            provider: this.name,
            step,
            message,
            statusCode,
            retryable,
            code: this.classifyErrorCode(statusCode, message)
        };
    }

    /**
     * Map a raw HTTP status + message into a canonical error code string.
     *
     * Order matters: earlier checks take priority (e.g. 401 is 'auth' even
     * if the body also says "invalid"). The codes are consumed by the router
     * to decide whether to failover to another provider.
     *
     * @param {number} statusCode - HTTP status code (may be null for network errors)
     * @param {string} message - Error message body from the provider
     * @returns {string} One of: auth, model_not_found, rate_limit, timeout,
     *   server_error, overloaded, quota_exceeded, invalid_request, unknown
     */
    classifyErrorCode(statusCode, message = '') {
        const msg = message.toLowerCase();
        
        if (statusCode === 401 || statusCode === 403 || msg.includes('unauthorized') || msg.includes('invalid_api_key') || msg.includes('invalid api key')) {
            return 'auth';
        }
        if (statusCode === 404 || msg.includes('model_not_found') || msg.includes('does not exist') || msg.includes('not found')) {
            return 'model_not_found';
        }
        if (statusCode === 429 || msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many requests')) {
            return 'rate_limit';
        }
        if (statusCode === 408 || msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')) {
            return 'timeout';
        }
        if (statusCode >= 500 || msg.includes('internal') || msg.includes('server error')) {
            return 'server_error';
        }
        if (msg.includes('overloaded') || msg.includes('capacity') || msg.includes('busy') || msg.includes('temporarily unavailable')) {
            return 'overloaded';
        }
        if (msg.includes('insufficient_quota') || msg.includes('quota') || msg.includes('billing') || msg.includes('exceeded')) {
            return 'quota_exceeded';
        }
        if (statusCode === 400 || msg.includes('invalid') || msg.includes('malformed')) {
            return 'invalid_request';
        }
        
        return 'unknown';
    }

    /**
     * Determine if an error code is retryable
     * @param {string} code - Error code
     * @returns {boolean}
     */
    isRetryableCode(code) {
        return ['timeout', 'rate_limit', 'overloaded', 'server_error'].includes(code);
    }

    /**
     * Normalize an error for the router
     * @param {Error|object} error - Raw error
     * @param {string} step - Operation step
     * @returns {object} Normalized error
     */
    normalizeError(error, step = 'unknown') {
        const statusCode = error.statusCode || error.status || error.response?.status;
        const message = error.message || error.error?.message || String(error);
        const code = this.classifyErrorCode(statusCode, message);
        
        return {
            provider: this.name,
            step,
            code,
            message,
            statusCode,
            retryable: this.isRetryableCode(code)
        };
    }

    /**
     * Make HTTP request with timeout (uses injectable httpClient)
     * @param {string} url - Full URL
     * @param {object} options - Fetch options
     * @param {number} [timeout] - Timeout in ms
     */
    async fetchWithTimeout(url, options = {}, timeout = this.timeout) {
        return httpClient.request({
            method: options.method || 'GET',
            url,
            headers: options.headers || {},
            body: options.body,
            timeoutMs: timeout
        });
    }

    /**
     * Log LLM operation for observability
     */
    log(operation, details = {}) {
        const log = rootLogger.child({ module: 'llm-provider', provider: this.name });
        log.debug({ event: 'llm_operation', operation, ...details }, `${this.name}: ${operation}`);
    }

    /**
     * Check if an error is retryable based on status code
     * @param {number} statusCode - HTTP status code
     * @returns {boolean}
     */
    isRetryableError(statusCode) {
        // Retry on server errors and rate limiting
        return statusCode >= 500 || statusCode === 429 || statusCode === 408;
    }

    /**
     * Execute a function with retry logic and exponential backoff.
     *
     * Retries on: 5xx server errors, 429 rate limits, 408 timeouts, and
     * transient connection errors (ECONNRESET). Non-retryable failures
     * (4xx auth/validation) propagate immediately.
     *
     * Backoff strategy: base * 1.5^attempt. Rate-limit errors use a 10 s
     * base (vs 5 s default) to give the provider quota time to recover.
     *
     * @param {function} fn - Async function to execute (called with no args)
     * @param {number} [maxRetries=4] - Maximum retry attempts after the initial call
     * @param {number} [delayMs=5000] - Initial delay between retries in ms
     * @returns {Promise<any>} Resolved value from fn
     * @throws Last error if all attempts exhausted
     */
    async withRetry(fn, maxRetries = 4, delayMs = 5000) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Check if we should retry
                const statusCode = error.statusCode || error.status;
                const isRateLimit = error.message?.includes('Rate limit') || statusCode === 429;
                const isRetryable = this.isRetryableError(statusCode) || 
                                    error.message?.includes('timeout') ||
                                    error.message?.includes('ECONNRESET') ||
                                    isRateLimit;
                
                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }
                
                // Exponential backoff - longer for rate limits
                const baseDelay = isRateLimit ? 10000 : delayMs; // 10s for rate limits
                const delay = baseDelay * Math.pow(1.5, attempt); // Gentler exponential
                this.log('retry', { 
                    attempt: attempt + 1, 
                    maxRetries, 
                    delay,
                    isRateLimit,
                    error: error.message 
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    /**
     * Sleep helper
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BaseLLMProvider;
