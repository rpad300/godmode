/**
 * Request parsing utilities
 * Extracted from server.js for modularity
 */

/**
 * WHATWG URL parser (replaces deprecated url.parse)
 * @param {string} reqUrl - The request URL to parse
 * @returns {{ pathname: string, query: object, search: string, href: string }}
 */
function parseUrl(reqUrl) {
    try {
        const parsed = new URL(reqUrl, 'http://localhost');
        return {
            pathname: parsed.pathname,
            query: Object.fromEntries(parsed.searchParams),
            search: parsed.search,
            href: parsed.href
        };
    } catch (e) {
        // Fallback for malformed URLs
        const qIdx = reqUrl.indexOf('?');
        return {
            pathname: qIdx >= 0 ? reqUrl.substring(0, qIdx) : reqUrl,
            query: {},
            search: qIdx >= 0 ? reqUrl.substring(qIdx) : '',
            href: reqUrl
        };
    }
}

/**
 * Parse JSON body from request
 * @param {http.IncomingMessage} req - The HTTP request
 * @returns {Promise<object>} - Parsed JSON body
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

/**
 * Parse multipart form data
 * @param {Buffer} buffer - The raw request body buffer
 * @param {string} boundary - The multipart boundary string
 * @returns {{ files: Array, folder: string, documentDate: string|null, documentTime: string|null, emailId: string|null }}
 */
function parseMultipart(buffer, boundary) {
    const result = { files: [], folder: 'newinfo', documentDate: null, documentTime: null, emailId: null };
    const boundaryBuffer = Buffer.from('--' + boundary);
    const parts = [];

    let start = 0;
    let pos = buffer.indexOf(boundaryBuffer, start);

    while (pos !== -1) {
        if (start > 0) {
            // Remove trailing CRLF from previous part
            let end = pos - 2;
            if (end > start) {
                parts.push(buffer.slice(start, end));
            }
        }
        start = pos + boundaryBuffer.length + 2; // Skip boundary and CRLF
        pos = buffer.indexOf(boundaryBuffer, start);
    }

    // Parse each part
    for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headerStr = part.slice(0, headerEnd).toString('utf8');
        const data = part.slice(headerEnd + 4);

        // Check if it's a file
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        const nameMatch = headerStr.match(/name="([^"]+)"/);

        if (filenameMatch && data.length > 0) {
            result.files.push({
                filename: filenameMatch[1],
                data: data
            });
        } else if (nameMatch) {
            const fieldName = nameMatch[1];
            const fieldValue = data.toString('utf8').trim();
            if (fieldName === 'folder') {
                result.folder = fieldValue;
            } else if (fieldName === 'documentDate') {
                result.documentDate = fieldValue;
            } else if (fieldName === 'documentTime') {
                result.documentTime = fieldValue;
            } else if (fieldName === 'emailId') {
                result.emailId = fieldValue;
            }
        }
    }

    return result;
}

module.exports = {
    parseUrl,
    parseBody,
    parseMultipart
};
