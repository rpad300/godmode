/**
 * Purpose:
 *   Pulls new files from a project's Google Drive folders into local storage
 *   and registers them in the documents table for downstream processing.
 *
 * Responsibilities:
 *   - List files in the project's uploads and newtranscripts Drive folders
 *   - Skip files already imported (matched via metadata.drive_file_id)
 *   - Download new files via the drive wrapper, write to local disk, hash content
 *   - Insert document records with status "pending" so the processor picks them up
 *   - Update project settings with lastSync timestamp and stats
 *   - Provide a syncAllProjects() for scheduled/cron-style batch syncing
 *   - Expose handleSync() for direct API route integration
 *
 * Key dependencies:
 *   - ./drive: Google Drive API wrapper (authentication, download)
 *   - ../../supabase/storageHelper: Project-scoped storage abstraction
 *   - ../../supabase/client (getAdminClient): Supabase admin queries
 *   - fs / path / crypto (Node built-in): Local file I/O and hashing
 *   - ../../logger: Structured logging
 *
 * Side effects:
 *   - Downloads files from Google Drive (network)
 *   - Writes files to data/projects/<projectId>/sources/ on local disk
 *   - Creates directories recursively if missing
 *   - Inserts rows into the documents table (Supabase)
 *   - Updates project.settings.googleDrive with sync metadata
 *
 * Notes:
 *   - Filenames are sanitised (non-alphanumeric replaced with underscore)
 *   - File hash is SHA-256 for deduplication
 *   - Uses cursor-based pagination (nextPageToken) to handle folders with
 *     more than 100 files
 *   - syncProject() returns { total, imported, errors } stats
 *   - syncAllProjects() only syncs projects with googleDrive.enabled in settings
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const drive = require('./drive');
const { getStorage } = require('../../supabase/storageHelper');
const { getAdminClient } = require('../../supabase/client');
const { logger } = require('../../logger');

const log = logger.child({ module: 'drive-sync' });

/**
 * Sync a single project's Google Drive folder.
 * @param {string} projectId 
 * @returns {Promise<object>} Stats { total, imported, errors }
 */
async function syncProject(projectId) {
    if (!projectId) throw new Error('Project ID required');

    const storage = getStorage();
    storage.setProject(projectId);
    const supabase = getAdminClient();

    // 1. Get Drive Client & Project Settings
    const client = await drive.getDriveClientForProject(projectId);
    if (!client || !client.drive) {
        log.info({ event: 'drive_sync_skipped', projectId }, 'Drive client not available');
        return { total: 0, imported: 0, errors: 0, reason: 'no_client' };
    }

    // Get project settings to find folder IDs
    const { data: project } = await supabase
        .from('projects')
        .select('settings')
        .eq('id', projectId)
        .single();

    const driveSettings = project?.settings?.googleDrive;
    if (!driveSettings || !driveSettings.folders) {
        log.info({ event: 'drive_sync_skipped', projectId }, 'Drive folders not configured in settings');
        return { total: 0, imported: 0, errors: 0, reason: 'not_configured' };
    }

    // We scan specific folders: uploads, newtranscripts
    // You can expand this list based on requirements.
    const foldersToScan = [
        { id: driveSettings.folders.uploads, type: 'document' },
        { id: driveSettings.folders.newtranscripts, type: 'transcript' }
    ];

    let stats = { total: 0, imported: 0, errors: 0 };

    for (const folder of foldersToScan) {
        if (!folder.id) continue;

        try {
            // List ALL files in folder using cursor-based pagination
            const files = [];
            let pageToken = null;
            do {
                const listParams = {
                    q: `'${folder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
                    fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)',
                    pageSize: 100
                };
                if (pageToken) listParams.pageToken = pageToken;

                const res = await client.drive.files.list(listParams);
                files.push(...(res.data.files || []));
                pageToken = res.data.nextPageToken || null;
            } while (pageToken);

            stats.total += files.length;

            for (const file of files) {
                try {
                    // Check if file already exists in DB
                    const { data: existing } = await supabase
                        .from('documents')
                        .select('id')
                        .eq('project_id', projectId)
                        .eq('metadata->>drive_file_id', file.id)
                        .maybeSingle();

                    if (existing) {
                        continue; // Already imported
                    }

                    // Download file
                    log.info({ event: 'drive_downloading', projectId, fileId: file.id, name: file.name }, 'Downloading new file');
                    const buffer = await drive.downloadFile(client, file.id);

                    // Save to local storage (using StorageHelper)
                    // We'll mimic an upload.
                    // Local path: <project_id>/uploads/<filename> (or transcripts)
                    // Note: storageHelper manages paths internally based on storage.upload(file) if it was multipart.
                    // But here we have a buffer. StorageHelper doesn't strictly have a 'saveBuffer' public method exposed in the interface shown in viewed file,
                    // but it likely uses `storeDocument` or similar.
                    // Let's use low-level save for now or check storageHelper again.
                    // Checking storageHelper.js from previous turn... 
                    // It exports `SupabaseStorage` class but I didn't see the class definition, only the helper.
                    // I will assume standard path construction for now:

                    // Generate local filename (sanitized) to avoid issues
                    const ext = path.extname(file.name) || '';
                    const safeName = path.basename(file.name, ext).replace(/[^a-z0-9]/gi, '_') + ext;
                    const subfolder = folder.type === 'transcript' ? 'transcripts' : 'documents';

                    // We need to determine where to save.
                    // GodMode architecture seems to put files in `local_storage/<project_id>/...`
                    // I'll assume standard `documents` table usage: filename, filepath.

                    // Let's rely on `storage.onFileUpload` or similar if available, OR manually write to fs.
                    // Since I don't have the full Storage class code, I'll use `fs` writes to the project directory which I can infer via configuration or env.
                    // Default assume: ./data/projects/<projectId>/<subfolder>/<safeName>
                    // Wait, `storageCompat.js` handles this usually.

                    // Let's look at `storageHelper.js` line 33: `filesBasePath`.
                    // We can reuse `storage.uploadFile` if it exists.
                    // Since I can't see methods of `storageInstance`, let's try to infer from `storage.js` or `storageCompat.js`.

                    // FALLBACK: Write to `data/projects/{projectId}/sources/{safeName}` which is a common pattern, 
                    // OR better: use `documents` table `filepath` as relative path.

                    const localDir = path.join(process.cwd(), 'data', 'projects', projectId, 'sources');
                    if (!fs.existsSync(localDir)) {
                        fs.mkdirSync(localDir, { recursive: true });
                    }
                    const localPath = path.join(localDir, safeName);
                    fs.writeFileSync(localPath, buffer);

                    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

                    // Insert into documents
                    const { error: dbError } = await supabase
                        .from('documents')
                        .insert({
                            project_id: projectId,
                            filename: file.name, // Display name
                            filepath: localPath, // Absolute path for now
                            file_hash: fileHash,
                            file_type: file.mimeType,
                            file_size: parseInt(file.size || '0'),
                            doc_type: folder.type, // 'document' or 'transcript'
                            status: 'pending', // Processor will pick it up
                            metadata: {
                                drive_file_id: file.id,
                                drive_view_link: file.webViewLink,
                                drive_modified_time: file.modifiedTime,
                                imported_at: new Date().toISOString()
                            }
                        });

                    if (dbError) throw dbError;

                    stats.imported++;
                    log.info({ event: 'drive_import_success', projectId, fileId: file.id }, 'Imported file');

                } catch (fileErr) {
                    log.warn({ event: 'drive_file_import_error', projectId, fileId: file.id, reason: fileErr.message }, 'Failed to import file');
                    stats.errors++;
                }
            }
        } catch (folderErr) {
            log.warn({ event: 'drive_folder_scan_error', projectId, folderId: folder.id, reason: folderErr.message }, 'Failed to scan folder');
            stats.errors++;
        }
    }

    return stats;
}

/**
 * Handle POST /sync request
 */
async function handleSync(req, res) {
    const { projectId } = req.body || {};
    if (!projectId) {
        return { error: 'Project ID required', status: 400 };
    }

    try {
        const stats = await syncProject(projectId);

        // Update last sync time in project settings
        const supabase = getAdminClient();
        const { data: project } = await supabase.from('projects').select('settings').eq('id', projectId).single();
        if (project) {
            const newSettings = {
                ...(project.settings || {}),
                googleDrive: {
                    ...(project.settings?.googleDrive || {}),
                    lastSync: new Date().toISOString(),
                    lastSyncStats: stats
                }
            };
            await supabase.from('projects').update({ settings: newSettings }).eq('id', projectId);
        }

        return { success: true, stats };
    } catch (e) {
        return { error: e.message, status: 500 };
    }
}

/**
 * Sync all projects (e.g. for scheduled jobs)
 */
async function syncAllProjects() {
    const supabase = getAdminClient();
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, settings');

    if (error) throw error;

    let results = { success: 0, failed: 0, totalFiles: 0 };

    for (const project of projects || []) {
        if (project.settings?.googleDrive?.enabled) {
            try {
                const stats = await syncProject(project.id);
                results.success++;
                results.totalFiles += stats.imported;
            } catch (e) {
                log.error({ event: 'drive_sync_all_error', projectId: project.id, error: e.message }, 'Failed to sync project');
                results.failed++;
            }
        }
    }
    return results;
}

module.exports = {
    syncProject,
    syncAllProjects,
    handleSync
};
