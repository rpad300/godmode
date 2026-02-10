/**
 * Google Drive integration – core wrapper
 * Uses system credentials for write (upload, bootstrap), project or system for read (download).
 */

const { google } = require('googleapis');
const { logger } = require('../../logger');
const systemConfig = require('../../supabase/system');
const secrets = require('../../supabase/secrets');

const log = logger.child({ module: 'google-drive' });

const SECRET_NAME = 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON';
const CONFIG_KEY = 'google_drive';

let systemClientCache = null;

/**
 * Get Drive client for system (write: upload, bootstrap).
 * Uses system_config key 'google_drive' and system secret GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.
 */
async function getDriveClientForSystem() {
    const { value: config } = await systemConfig.getSystemConfig(CONFIG_KEY);
    const enabled = config && (config.enabled === true || config === true);
    if (!enabled) return null;
    const rootFolderId = config && config.rootFolderId;
    if (!rootFolderId) return null;

    const result = await secrets.getSecret('system', SECRET_NAME);
    if (!result.success || !result.value) {
        log.warn({ event: 'google_drive_missing_credentials' }, 'Missing system credentials (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)');
        return null;
    }

    try {
        const json = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
        const auth = new google.auth.GoogleAuth({
            credentials: json,
            scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
        });
        const drive = google.drive({ version: 'v3', auth });
        if (!systemClientCache) systemClientCache = { drive, rootFolderId };
        else {
            systemClientCache.drive = drive;
            systemClientCache.rootFolderId = rootFolderId;
        }
        return systemClientCache;
    } catch (err) {
        log.warn({ event: 'google_drive_system_client_failed', reason: err.message }, 'Failed to create system client');
        return null;
    }
}

/**
 * Get Drive client for a project (read: download).
 * Uses project secret GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON; falls back to system if not set.
 */
async function getDriveClientForProject(projectId) {
    if (!projectId) return null;
    let result = await secrets.getSecret('project', SECRET_NAME, projectId);
    if (result.success && result.value) {
        try {
            const json = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
            const auth = new google.auth.GoogleAuth({
                credentials: json,
                scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive']
            });
            const drive = google.drive({ version: 'v3', auth });
            return { drive };
        } catch (err) {
            log.warn({ event: 'google_drive_invalid_project_credentials', reason: err.message }, 'Invalid project credentials');
        }
    }
    // Fallback: use system credentials for read (so one account works for both until project key is set)
    const sys = await getDriveClientForSystem();
    if (sys) log.debug({ event: 'google_drive_system_fallback' }, 'Using system credentials for read (project has no key)');
    return sys;
}

/**
 * Single helper for read operations: project client with system fallback.
 */
async function getDriveClientForRead(projectId) {
    return getDriveClientForProject(projectId);
}

/**
 * Upload a file to Drive.
 * @param {{ drive: object, rootFolderId?: string }} client - from getDriveClientForSystem()
 * @param {Buffer} buffer - file content
 * @param {string} mimeType - e.g. 'application/pdf'
 * @param {string} parentFolderId - Drive folder ID
 * @param {string} filename - display name
 * @returns {{ id: string, webViewLink?: string }}
 */
async function uploadFile(client, buffer, mimeType, parentFolderId, filename) {
    if (!client || !client.drive) throw new Error('Invalid Drive client');
    const drive = client.drive;
    const res = await drive.files.create({
        requestBody: {
            name: filename,
            parents: [parentFolderId]
        },
        media: {
            mimeType: mimeType || 'application/octet-stream',
            body: require('stream').Readable.from(buffer)
        },
        fields: 'id, webViewLink'
    });
    const file = res.data;
    if (!file || !file.id) throw new Error('Drive upload did not return file id');
    return { id: file.id, webViewLink: file.webViewLink || null };
}

/**
 * Download file from Drive (returns buffer).
 * @param {{ drive: object }} client - from getDriveClientForProject or getDriveClientForSystem
 * @param {string} fileId - Drive file ID (without gdrive: prefix)
 */
async function downloadFile(client, fileId) {
    if (!client || !client.drive) throw new Error('Invalid Drive client');
    const res = await client.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );
    const stream = res.data;
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/**
 * Ensure a folder exists under parent; create if not. Returns folder ID.
 * @param {{ drive: object }} client
 * @param {string} parentId - parent folder ID
 * @param {string} name - folder name
 * @returns {Promise<string>} folder ID
 */
async function ensureFolder(client, parentId, name) {
    if (!client || !client.drive) throw new Error('Invalid Drive client');
    const drive = client.drive;
    const list = await drive.files.list({
        q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1
    });
    const files = list.data.files || [];
    if (files.length > 0) return files[0].id;
    const create = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        },
        fields: 'id'
    });
    if (!create.data || !create.data.id) throw new Error('Failed to create folder: ' + name);
    return create.data.id;
}

/**
 * Clear system client cache (e.g. after config change).
 */
function clearSystemClientCache() {
    systemClientCache = null;
}

module.exports = {
    getDriveClientForSystem,
    getDriveClientForProject,
    getDriveClientForRead,
    uploadFile,
    downloadFile,
    ensureFolder,
    clearSystemClientCache,
    CONFIG_KEY,
    SECRET_NAME
};
