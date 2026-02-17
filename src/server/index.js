/**
 * Purpose:
 *   Barrel export for the server utilities package. Provides a single import
 *   point so consumers can destructure any server helper without knowing which
 *   sub-module it lives in.
 *
 * Responsibilities:
 *   - Re-export every public symbol from the request, response, security,
 *     static-file, and middleware sub-modules.
 *
 * Key dependencies:
 *   - ./request: URL parsing, body/multipart parsing
 *   - ./response: JSON response helpers, MIME type lookup
 *   - ./security: UUID validation, filename sanitization, path-traversal guards
 *   - ./static: Static file serving, directory bootstrapping, SOTA document paths
 *   - ./middleware: Rate limiting, cookie security, client-IP extraction
 *
 * Side effects:
 *   - None at import time beyond loading the sub-modules (which themselves may
 *     read env vars or allocate in-memory stores).
 *
 * Notes:
 *   - requestContext and embeddingCache are intentionally NOT re-exported here;
 *     they are imported directly where needed to keep their scope explicit.
 *
 * Usage:
 *   const { parseUrl, jsonResponse, isValidUUID } = require('./server');
 */

module.exports = {
    ...require('./request'),
    ...require('./response'),
    ...require('./security'),
    ...require('./static'),
    ...require('./middleware')
};
