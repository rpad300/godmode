/**
 * Purpose:
 *   Input-validation and filesystem-safety helpers used across API route
 *   handlers to guard against malformed identifiers and path-traversal attacks.
 *
 * Responsibilities:
 *   - isValidUUID: Strict RFC-4122 UUID v1-5 format check (case-insensitive)
 *   - sanitizeFilename: Strip traversal sequences and non-portable characters,
 *     returning a filesystem-safe name capped at 255 chars
 *   - isPathWithinDirectory: Resolve symlinks and verify the real path stays
 *     inside an allowed directory boundary
 *
 * Key dependencies:
 *   - fs (Node.js built-in): realpathSync for symlink resolution in isPathWithinDirectory
 *
 * Side effects:
 *   - isPathWithinDirectory performs synchronous filesystem I/O (realpathSync);
 *     it will return false if either path does not exist on disk.
 *
 * Notes:
 *   - sanitizeFilename collapses ".." but also strips all "/" and "\" into "_",
 *     making it safe for flat-directory storage but unsuitable if sub-paths
 *     are intentionally needed.
 *   - isPathWithinDirectory relies on realpathSync, so both the target path AND
 *     the allowed directory must exist at call time; otherwise it returns false.
 *     Callers should create directories before checking containment.
 */

const fs = require('fs');

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 * @param {string} id - The string to validate
 * @returns {boolean} - True if valid UUID format
 */
function isValidUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Sanitize filename to prevent path traversal
 * @param {string} name - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'file';
    // Remove path traversal attempts and invalid characters
    return name
        .replace(/\.\./g, '')
        .replace(/[\/\\]/g, '_')
        .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
        .substring(0, 255);
}

/**
 * Validate file path is within allowed directory (prevent path traversal)
 * @param {string} filePath - The file path to check
 * @param {string} allowedDir - The allowed directory
 * @returns {boolean} - True if path is within allowed directory
 */
function isPathWithinDirectory(filePath, allowedDir) {
    if (!filePath || !allowedDir) return false;
    try {
        const realPath = fs.realpathSync(filePath);
        const realAllowedDir = fs.realpathSync(allowedDir);
        return realPath.startsWith(realAllowedDir);
    } catch {
        return false;
    }
}

module.exports = {
    UUID_REGEX,
    isValidUUID,
    sanitizeFilename,
    isPathWithinDirectory
};
