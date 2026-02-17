/**
 * Purpose:
 *   Provides implicit, per-request context propagation using Node.js
 *   AsyncLocalStorage. Any code running inside a request handler can retrieve
 *   the current request ID or a request-scoped logger without explicit parameter
 *   threading.
 *
 * Responsibilities:
 *   - runWithContext: Establish a new async-local scope for a request
 *   - getRequestId / getLogger / getContext: Read context from any depth in the
 *     call stack within the same async continuation
 *
 * Key dependencies:
 *   - async_hooks (Node.js built-in): AsyncLocalStorage
 *   - ../logger: Root pino logger used as fallback when outside a request scope
 *
 * Side effects:
 *   - Creates one module-level AsyncLocalStorage instance; negligible overhead
 *     when no context is active.
 *
 * Notes:
 *   - getLogger() always returns a usable logger -- a request-scoped child if
 *     available, otherwise a generic 'api'-module child of the root logger.
 *   - The context object is intentionally kept small ({ requestId, logger }) but
 *     can be extended for distributed tracing (traceId, spanId) in the future.
 *   - This module is NOT re-exported via the barrel index.js to keep its usage
 *     explicit and avoid accidental coupling.
 */
const { AsyncLocalStorage } = require('async_hooks');
const { logger } = require('../logger');

const storage = new AsyncLocalStorage();

/**
 * Run fn with request context { requestId, logger? }. Call from the top-level request handler only.
 * @param {{ requestId: string, logger?: import('pino').Logger }} context
 * @param {() => Promise<any> | any} fn
 * @returns {Promise<any>}
 */
function runWithContext(context, fn) {
    return storage.run(context, fn);
}

/**
 * Get the current request id (or null if not in a request context).
 * @returns {string|null}
 */
function getRequestId() {
    const ctx = storage.getStore();
    return ctx && ctx.requestId ? ctx.requestId : null;
}

/**
 * Get the request-scoped logger (child with requestId and module), or root logger if not in request context.
 * Use this in route handlers and downstream code so all logs carry requestId.
 * @returns {import('pino').Logger}
 */
function getLogger() {
    const ctx = storage.getStore();
    if (ctx && ctx.logger) return ctx.logger;
    return logger.child({ module: 'api' });
}

/**
 * Get the full context object (for future extensions: traceId, spanId, etc.).
 * @returns {{ requestId?: string, logger?: import('pino').Logger }|undefined}
 */
function getContext() {
    return storage.getStore();
}

module.exports = {
    runWithContext,
    getRequestId,
    getLogger,
    getContext
};
