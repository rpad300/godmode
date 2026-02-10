/**
 * Central structured logger (SOTA observability).
 * - JSON output in production; optional pretty in development.
 * - Levels: trace, debug, info, warn, error, fatal.
 * - Mandatory fields: timestamp, level, service, env, module, event.
 * - Use logger.child({ module, requestId, ... }) for request/job scope.
 * - Use logError(err, context) for normalized error logging (Supabase/Postgres code, hint, details).
 */

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
const serviceName = process.env.SERVICE_NAME || 'godmode';

const baseOptions = {
    level: logLevel,
    base: {
        service: serviceName,
        env: process.env.NODE_ENV || 'development'
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label };
        }
    }
};

// Development: pretty print if pino-pretty is available (optional dependency)
let dest = pino.destination({ dest: 1, sync: false, minLength: 4096 });
if (isDev && process.stdout.isTTY) {
    try {
        const pinoPretty = require('pino-pretty');
        dest = pinoPretty({
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        });
    } catch (_) {
        // pino-pretty not installed, use JSON
    }
}

const rootLogger = pino(baseOptions, dest);

/**
 * Create a child logger with bound context (module, requestId, jobId, userId, projectId).
 * Every log from the child will include these fields.
 * @param {object} bindings - { module, requestId?, jobId?, userId?, projectId? }
 * @returns {pino.Logger}
 */
function child(bindings) {
    return rootLogger.child(bindings);
}

/**
 * Normalize Supabase/PostgREST error for structured logging.
 * Extracts code, hint, details; avoids logging full request/response.
 * @param {Error & { code?: string, hint?: string, details?: string }} err
 * @returns {{ name: string, message: string, code?: string, hint?: string, details?: string, stack?: string }}
 */
function normalizeError(err) {
    if (!err || typeof err !== 'object') {
        return { name: 'Unknown', message: String(err) };
    }
    const out = {
        name: err.name || 'Error',
        message: err.message || 'Unknown error'
    };
    if (err.code) out.code = err.code;
    if (err.hint) out.hint = err.hint;
    if (err.details) out.details = err.details;
    // Stack only in development or when explicitly needed (caller can add via context)
    if (isDev && err.stack) out.stack = err.stack;
    return out;
}

/**
 * Log an error with normalized fields and optional context.
 * Use at error boundaries; avoid logging the same error in multiple layers.
 * @param {Error} err - Error object (Supabase/Postgres errors have code, hint, details)
 * @param {object} context - { module, event, requestId?, jobId?, projectId?, table?, operation? }
 */
function logError(err, context = {}) {
    const payload = {
        ...context,
        event: context.event || 'error',
        err: normalizeError(err)
    };
    // Include stack in payload for error level in production (for debugging)
    if (err && err.stack && !isDev) payload.err.stack = err.stack;
    const log = context.requestId ? rootLogger.child({ requestId: context.requestId }) : rootLogger;
    const childLog = context.module ? log.child({ module: context.module }) : log;
    childLog.error(payload, err && err.message ? err.message : 'Error');
}

module.exports = {
    logger: rootLogger,
    child,
    logError,
    normalizeError
};
