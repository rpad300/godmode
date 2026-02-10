/**
 * Request context via AsyncLocalStorage for tracing and logging.
 * Use getRequestId() / getLogger() anywhere in the request pipeline.
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
