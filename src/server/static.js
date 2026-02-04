/**
 * Static file serving utilities
 * Extracted from server.js for modularity
 */

const fs = require('fs');
const path = require('path');

/**
 * MIME types for static file serving
 */
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

/**
 * Serve static file
 * @param {http.ServerResponse} res - The HTTP response
 * @param {string} filePath - Path to the file to serve
 */
function serveStatic(res, filePath) {
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

/**
 * Ensure data directories exist (SOTA structure)
 * @param {string} dataDir - The base data directory
 */
function ensureDirectories(dataDir) {
    const dirs = [
        dataDir,
        // Legacy folders (for backward compatibility)
        path.join(dataDir, 'newinfo'),
        path.join(dataDir, 'newtranscripts'),
        path.join(dataDir, 'archived', 'documents'),
        path.join(dataDir, 'archived', 'meetings'),
        path.join(dataDir, 'content'),
        // SOTA structure
        path.join(dataDir, 'documents', 'inbox', 'documents'),
        path.join(dataDir, 'documents', 'inbox', 'transcripts'),
        path.join(dataDir, 'documents', 'library'),
        path.join(dataDir, 'documents', 'cache', 'thumbnails'),
        path.join(dataDir, 'documents', 'trash'),
        path.join(dataDir, 'exports'),
        path.join(dataDir, 'temp', 'processing')
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

/**
 * Generate SVG icon for file type (used as thumbnail placeholder)
 * @param {string} fileType - The file type/extension
 * @returns {string} - SVG markup
 */
function generateFileIconSVG(fileType) {
    const colors = {
        pdf: '#e74c3c',
        doc: '#3498db',
        docx: '#3498db',
        xls: '#27ae60',
        xlsx: '#27ae60',
        ppt: '#e67e22',
        pptx: '#e67e22',
        txt: '#95a5a6',
        md: '#9b59b6',
        jpg: '#1abc9c',
        jpeg: '#1abc9c',
        png: '#1abc9c',
        gif: '#1abc9c',
        default: '#7f8c8d'
    };
    
    const color = colors[fileType] || colors.default;
    const ext = (fileType || '?').toUpperCase().slice(0, 4);
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f5f5f5" rx="8"/>
        <rect x="50" y="30" width="100" height="130" fill="white" stroke="#ddd" stroke-width="2" rx="4"/>
        <polygon points="120,30 150,60 120,60" fill="#ddd"/>
        <rect x="60" y="80" width="80" height="8" fill="#eee" rx="2"/>
        <rect x="60" y="95" width="60" height="8" fill="#eee" rx="2"/>
        <rect x="60" y="110" width="70" height="8" fill="#eee" rx="2"/>
        <rect x="50" y="135" width="100" height="25" fill="${color}" rx="4"/>
        <text x="100" y="153" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${ext}</text>
    </svg>`;
}

/**
 * Get SOTA document path based on date
 * Returns: documents/library/{year}/{month}/{doc_id}/
 * @param {string} docId - The document ID
 * @param {string} dataDir - The base data directory
 * @param {Date|string} createdAt - Creation date (default: now)
 * @returns {string} - Full path to document SOTA directory
 */
function getDocumentSOTAPath(docId, dataDir, createdAt = new Date()) {
    const date = new Date(createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return path.join(dataDir, 'documents', 'library', String(year), month, docId);
}

/**
 * Ensure document SOTA directory exists with subdirs
 * @param {string} docId - The document ID
 * @param {string} dataDir - The base data directory
 * @param {Date|string} createdAt - Creation date (default: now)
 * @returns {string} - Full path to document SOTA directory
 */
function ensureDocumentSOTADir(docId, dataDir, createdAt = new Date()) {
    const docPath = getDocumentSOTAPath(docId, dataDir, createdAt);
    const subdirs = ['original', 'versions', 'content', 'media'];
    
    subdirs.forEach(subdir => {
        const fullPath = path.join(docPath, subdir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
    
    return docPath;
}

module.exports = {
    MIME_TYPES,
    serveStatic,
    ensureDirectories,
    generateFileIconSVG,
    getDocumentSOTAPath,
    ensureDocumentSOTADir
};
