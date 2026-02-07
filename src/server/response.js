/**
 * Response utilities
 * Extracted from server.js for modularity
 */

const path = require('path');

/**
 * Send JSON response with CORS headers
 * @param {http.ServerResponse} res - The HTTP response
 * @param {object} data - Data to send as JSON
 * @param {number} status - HTTP status code (default: 200)
 */
function jsonResponse(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

/**
 * Get MIME type from filename
 * @param {string} filename - The filename to check
 * @returns {string} - The MIME type
 */
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.zip': 'application/zip',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.html': 'text/html',
        '.md': 'text/markdown'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
    jsonResponse,
    getMimeType
};
