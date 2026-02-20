/**
 * Purpose:
 *   Low-level Google Drive API wrapper providing authenticated upload, download,
 *   and folder management using service-account credentials.
 *
 * Responsibilities:
 *   - Authenticate via system-level or project-level service-account JSON
 *   - Provide separate clients for write operations (system) and read operations
 *     (project, with system fallback)
 *   - Upload files to a specified Drive folder with retry
 *   - Download files to in-memory Buffers with size limits (50 MB) and retry
 *   - Create/ensure folder hierarchy under the configured root folder
 *   - Bootstrap per-project folder structures (uploads, newtranscripts, archived, exports)
 *   - Invalidate the cached system client when the admin config changes
 *
 * Key dependencies:
 *   - googleapis: Official Google API client
 *   - ../../supabase/system (systemConfig): System-level config + change subscription
 *   - ../../supabase/secrets: Encrypted credential retrieval
 *   - ../../logger: Structured logging
 *
 * Side effects:
 *   - Network calls to the Google Drive v3 API
 *   - Subscribes to systemConfig changes (lazy, once) to clear the cached client
 *   - Maintains a module-level systemClientCache singleton
 *
 * Notes:
 *   - System credentials have drive.file + drive scopes (read/write); project
 *     credentials start with drive.readonly and fall back to drive scope
 *   - withRetry() retries 429 and 5xx errors with exponential back-off (3 attempts)
 *   - ensureFolder() sanitises parentId/name to prevent Drive query injection
 *   - initializeProjectFolder() never throws; returns null on failure so that
 *     project creation is not blocked by Drive misconfiguration
 */

const { google } = require('googleapis');
const { logger } = require('../../logger');
const systemConfig = require('../../supabase/system');
const secrets = require('../../supabase/secrets');

const log = logger.child({ module: 'google-drive' });

const SECRET_NAME = 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON';
const CONFIG_KEY = 'google_drive';
const MAX_DOWNLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit for in-memory buffers
const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 1000 };

/**
 * Simple retry wrapper
 */
async function withRetry(fn, operationName = 'drive_operation') {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_OPTIONS.retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const isRetryable = err.code === 429 || err.code >= 500 || err.message.includes('network') || err.message.includes('socket');

            if (!isRetryable) throw err;
            if (attempt === RETRY_OPTIONS.retries) throw err;

            const delay = RETRY_OPTIONS.minTimeout * Math.pow(RETRY_OPTIONS.factor, attempt - 1);
            log.warn({ event: 'drive_retry', operation: operationName, attempt, delay, error: err.message }, 'Retrying Drive operation');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

let systemClientCache = null;

/**
 * Get Drive client for system (write: upload, bootstrap).
 * Uses system_config key 'google_drive' and system secret GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.
 */
async function getDriveClientForSystem() {
    // Ensure subscription (lazy init)
    ensureConfigSubscription();

    // Cache Check
    if (systemClientCache) return systemClientCache;

    try {
        let config = null;
        try {
            const configResult = await systemConfig.getSystemConfig(CONFIG_KEY);
            config = configResult ? configResult.value : null;
        } catch (e) {
            log.warn({ event: 'drive_config_load_failed', error: e.message }, 'Failed to load system config');
            return null;
        }

        const enabled = config && (config.enabled === true || config === true);
        if (!enabled) return null;
        const rootFolderId = config && config.rootFolderId;
        if (!rootFolderId) return null;

        const result = await secrets.getSecret('system', SECRET_NAME);
        if (!result.success || !result.value) {
            log.warn({ event: 'google_drive_missing_credentials' }, 'Missing system credentials (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)');
            return null;
        }

        const json = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
        const auth = new google.auth.GoogleAuth({
            credentials: json,
            scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
        });
        const drive = google.drive({ version: 'v3', auth });

        systemClientCache = { drive, rootFolderId };
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

    return withRetry(async () => {
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
    }, 'uploadFile');
}

/**
 * Download file from Drive (returns buffer).
 * @param {{ drive: object }} client - from getDriveClientForProject or getDriveClientForSystem
 * @param {string} fileId - Drive file ID (without gdrive: prefix)
 */
async function downloadFile(client, fileId) {
    if (!client || !client.drive) throw new Error('Invalid Drive client');

    return withRetry(async () => {
        // 1. Check file size
        try {
            const meta = await client.drive.files.get({
                fileId,
                fields: 'size, name'
            });
            const size = parseInt(meta.data.size || '0', 10);
            if (size > MAX_DOWNLOAD_SIZE_BYTES) {
                throw new Error(`File too large (${(size / 1024 / 1024).toFixed(2)}MB). Max allowed: ${(MAX_DOWNLOAD_SIZE_BYTES / 1024 / 1024)}MB`);
            }
        } catch (err) {
            if (err.message.includes('File too large')) throw err;
            log.warn({ event: 'drive_metadata_check_failed', fileId, err: err.message }, 'Skipping size check due to error');
        }

        const res = await client.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        const stream = res.data;
        const chunks = [];
        let downloadedBytes = 0;

        for await (const chunk of stream) {
            downloadedBytes += chunk.length;
            if (downloadedBytes > MAX_DOWNLOAD_SIZE_BYTES) {
                stream.destroy();
                throw new Error(`Stream download exceeded size limit (${(MAX_DOWNLOAD_SIZE_BYTES / 1024 / 1024)}MB)`);
            }
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }, 'downloadFile');
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

    return withRetry(async () => {
        const drive = client.drive;
        // Fix: Sanitize parentId to prevent injection
        const safeParentId = parentId.replace(/'/g, "\\'");
        const safeName = name.replace(/'/g, "\\'");

        const list = await drive.files.list({
            q: `'${safeParentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
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
    }, 'ensureFolder');
}

/**
 * Clear system client cache (e.g. after config change).
 */
function clearSystemClientCache() {
    systemClientCache = null;
    log.info({ event: 'drive_cache_cleared' }, 'System client cache cleared');
}

// Config subscription state
let isConfigSubscribed = false;

/**
 * Ensure we are subscribed to config changes.
 * Lazy init to avoid module load ordering issues.
 */
function ensureConfigSubscription() {
    if (isConfigSubscribed) return;

    try {
        if (systemConfig && systemConfig.onConfigChange) {
            systemConfig.onConfigChange((key) => {
                if (key === CONFIG_KEY) {
                    clearSystemClientCache();
                }
            });
            isConfigSubscribed = true;
            log.debug({ event: 'drive_config_subscribed' }, 'Subscribed to system config changes');
        }
    } catch (e) {
        log.warn({ event: 'drive_config_subscribe_failed', error: e.message }, 'Failed to subscribe to config changes');
    }
}

// Helper to sanitize folder names
function sanitizeFolderName(s) {
    if (!s || typeof s !== 'string') return 'project';
    return s.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

/**
 * Initialize project folder structure in Google Drive.
 * @param {object} project - Project object { id, name, owner_id }
 * @param {string} ownerUsername - Username of the project owner
 * @returns {Promise<object|null>} Settings object with Google Drive IDs, or null if failed/disabled
 */
async function initializeProjectFolder(project, ownerUsername) {
    try {
        const client = await getDriveClientForSystem();
        if (!client || !client.drive || !client.rootFolderId) {
            log.info({ event: 'drive_init_skipped', projectId: project.id }, 'Google Drive not enabled or configured');
            return null;
        }

        const ownerName = sanitizeFolderName(ownerUsername || 'user');
        const projectName = sanitizeFolderName(project.name || 'project');
        const projectIdShort = (project.id || '').replace(/-/g, '').substring(0, 8);

        const mainFolderName = `${ownerName}-${projectName}-${projectIdShort}`;

        log.info({ event: 'drive_init_start', projectId: project.id, folderName: mainFolderName }, 'Creating project folders in Drive');

        const mainFolderId = await ensureFolder(client, client.rootFolderId, mainFolderName);
        const uploadsId = await ensureFolder(client, mainFolderId, 'uploads');
        const newtranscriptsId = await ensureFolder(client, mainFolderId, 'newtranscripts');
        const archivedId = await ensureFolder(client, mainFolderId, 'archived');
        const exportsId = await ensureFolder(client, mainFolderId, 'exports');

        return {
            projectFolderId: mainFolderId,
            folders: {
                uploads: uploadsId,
                newtranscripts: newtranscriptsId,
                archived: archivedId,
                exports: exportsId
            },
            bootstrappedAt: new Date().toISOString()
        };
    } catch (err) {
        log.warn({ event: 'drive_init_failed', projectId: project.id, reason: err.message }, 'Failed to initialize project folders');
        return null; // Don't throw, just return null so project creation doesn't fail
    }
}

/**
 * Upload an avatar image to Google Drive, make it publicly accessible, and return a direct thumbnail URL.
 * Stores avatars in a dedicated "avatars" folder under the root.
 * @param {Buffer} buffer - Image file content
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @param {string} entityId - User or contact ID (used as filename)
 * @param {string} ext - File extension (jpg, png, etc.)
 * @returns {{ fileId: string, url: string }} - The Drive file ID and a publicly-accessible thumbnail URL
 */
async function uploadAvatar(buffer, mimeType, entityId, ext = 'jpg') {
    const client = await getDriveClientForSystem();
    if (!client || !client.drive || !client.rootFolderId) {
        throw new Error('Google Drive not configured');
    }

    const avatarsFolderId = await ensureFolder(client, client.rootFolderId, 'avatars');
    const filename = `${entityId}.${ext}`;

    // Check if file already exists and delete it (to avoid duplicates with different extensions)
    try {
        const safeParentId = avatarsFolderId.replace(/'/g, "\\'");
        const list = await client.drive.files.list({
            q: `'${safeParentId}' in parents and name contains '${entityId}' and trashed = false`,
            fields: 'files(id)',
            pageSize: 10
        });
        const existing = list.data.files || [];
        for (const f of existing) {
            try { await client.drive.files.delete({ fileId: f.id }); } catch {}
        }
    } catch {}

    const result = await uploadFile(client, buffer, mimeType, avatarsFolderId, filename);

    // Make file publicly accessible
    await withRetry(async () => {
        await client.drive.permissions.create({
            fileId: result.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });
    }, 'setAvatarPublic');

    const url = `https://drive.google.com/thumbnail?id=${result.id}&sz=w400`;

    return { fileId: result.id, url };
}

/**
 * Delete an avatar from Google Drive by entity ID.
 * Searches the avatars folder for files matching the entity ID.
 */
async function deleteAvatar(entityId) {
    const client = await getDriveClientForSystem();
    if (!client || !client.drive || !client.rootFolderId) return;

    try {
        const avatarsFolderId = await ensureFolder(client, client.rootFolderId, 'avatars');
        const safeParentId = avatarsFolderId.replace(/'/g, "\\'");
        const list = await client.drive.files.list({
            q: `'${safeParentId}' in parents and name contains '${entityId}' and trashed = false`,
            fields: 'files(id)',
            pageSize: 10
        });
        for (const f of (list.data.files || [])) {
            try { await client.drive.files.delete({ fileId: f.id }); } catch {}
        }
    } catch (err) {
        log.warn({ event: 'drive_delete_avatar_error', entityId, reason: err.message });
    }
}

/**
 * Check if Google Drive is configured and available for avatar storage.
 */
async function isDriveAvailable() {
    try {
        const client = await getDriveClientForSystem();
        return !!(client && client.drive && client.rootFolderId);
    } catch {
        return false;
    }
}

module.exports = {
    getDriveClientForSystem,
    getDriveClientForProject,
    getDriveClientForRead,
    uploadFile,
    downloadFile,
    ensureFolder,
    initializeProjectFolder,
    clearSystemClientCache,
    uploadAvatar,
    deleteAvatar,
    isDriveAvailable,
    CONFIG_KEY,
    SECRET_NAME
};
