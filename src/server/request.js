/**
 * Purpose:
 *   Utilities for parsing inbound HTTP requests: URL decomposition, JSON body
 *   reading with size limits, and raw multipart/form-data parsing for file uploads.
 *
 * Responsibilities:
 *   - parseUrl: WHATWG-compliant URL parsing with graceful fallback for malformed input
 *   - parseBody: Streaming JSON body reader with configurable max-length guard (DoS protection)
 *   - parseMultipart: Buffer-level multipart boundary parser that extracts files and form fields
 *
 * Key dependencies:
 *   - None (pure Node.js; avoids the deprecated `url.parse`)
 *
 * Side effects:
 *   - parseBody destroys the request stream on oversized payloads to free resources immediately
 *   - DEFAULT_MAX_BODY_LENGTH reads process.env.MAX_BODY_LENGTH at module load time
 *
 * Notes:
 *   - parseUrl uses a dummy base ("http://localhost") so it can handle relative paths;
 *     the base is never exposed to callers.
 *   - parseMultipart operates on a pre-buffered Buffer, not a stream. Callers must
 *     accumulate the request body before invoking it.
 *   - The multipart parser recognises a fixed set of field names (folder, documentDate,
 *     documentTime, emailId, sprintId, actionId). Unknown fields are silently ignored.
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

/** Default max JSON body size (2 MB) to prevent DoS. Override with env MAX_BODY_LENGTH (bytes). */
const DEFAULT_MAX_BODY_LENGTH = Number(process.env.MAX_BODY_LENGTH) || (2 * 1024 * 1024);

/**
 * Parse JSON body from request
 * @param {http.IncomingMessage} req - The HTTP request
 * @param {{ maxLength?: number }} [options] - Optional. maxLength in bytes. Exceeding rejects with code ENTITY_TOO_LARGE.
 * @returns {Promise<object>} - Parsed JSON body
 */
function parseBody(req, options = {}) {
    const maxLength = options.maxLength ?? DEFAULT_MAX_BODY_LENGTH;
    return new Promise((resolve, reject) => {
        let body = '';
        let length = 0;
        req.on('data', (chunk) => {
            length += chunk.length;
            if (length > maxLength) {
                req.destroy();
                const err = new Error('Request body too large');
                err.code = 'ENTITY_TOO_LARGE';
                reject(err);
                return;
            }
            body += chunk;
        });
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
 * Parse multipart/form-data from a fully-buffered request body.
 *
 * Splits the buffer on the boundary marker, then inspects each part's
 * Content-Disposition header to decide whether it is a file (has "filename")
 * or a plain form field.
 *
 * @param {Buffer} buffer - The complete raw request body
 * @param {string} boundary - The boundary string from the Content-Type header
 * @returns {{ files: Array<{filename: string, data: Buffer}>,
 *             folder: string,
 *             documentDate: string|null,
 *             documentTime: string|null,
 *             emailId: string|null,
 *             sprintId: string|null,
 *             actionId: string|null }}
 */
function parseMultipart(buffer, boundary) {
    const result = { files: [], folder: 'newinfo', documentDate: null, documentTime: null, emailId: null, sprintId: null, actionId: null };
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
            } else if (fieldName === 'sprintId') {
                result.sprintId = fieldValue || null;
            } else if (fieldName === 'actionId') {
                result.actionId = fieldValue || null;
            }
        }
    }

    return result;
}

module.exports = {
    parseUrl,
    parseBody,
    parseMultipart,
    DEFAULT_MAX_BODY_LENGTH
};
