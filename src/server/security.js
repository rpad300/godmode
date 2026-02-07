/**
 * Security helpers
 * Extracted from server.js for modularity
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
