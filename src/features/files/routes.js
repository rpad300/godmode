/**
 * Files API (pending files, upload, file-logs, folders)
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/files - List pending files
 * - DELETE /api/files/:folder/:filename - Remove from pending queue
 * - POST /api/upload - Upload files (drag-and-drop)
 * - GET /api/file-logs - Get file processing logs
 * - GET /api/folders - Get folder paths (project-specific)
 * - POST /api/folders/open - Open folder in file explorer
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');

async function pathExists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
}
const { execFile, exec } = require('child_process');
const { parseMultipart, parseBody, parseUrl } = require('../../server/request');
const { jsonResponse, getMimeType } = require('../../server/response');
const drive = require('../../integrations/googleDrive/drive');
const systemConfig = require('../../supabase/system');

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total
const MAX_MULTIPART_BODY = 512 * 1024 * 1024; // 512MB raw body (reject before buffering to prevent DoS)
const ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff',
    'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'mov',
    'zip', 'tar', 'gz',
    'json', 'csv', 'xml', 'yaml', 'yml',
    'eml', 'msg'
];
const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'js', 'vbs', 'ps1', 'sh'];

async function handleFiles(ctx) {
    const { req, res, pathname, processor, storage, config, invalidateBriefingCache } = ctx;
    const log = getLogger().child({ module: 'files' });

    // GET /api/file-logs - Get detailed file processing logs
    if (pathname === '/api/file-logs' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const limit = parseInt(parsedUrl.query.limit) || 50;
        const logs = storage.getFileLogs(limit);
        jsonResponse(res, { logs });
        return true;
    }

    // GET /api/folders - Get folder paths (project-specific)
    if (pathname === '/api/folders' && req.method === 'GET') {
        const projectDataDir = storage.getProjectDataDir();
        jsonResponse(res, {
            newinfo: path.join(projectDataDir, 'newinfo'),
            newtranscripts: path.join(projectDataDir, 'newtranscripts'),
            archived: path.join(projectDataDir, 'archived')
        });
        return true;
    }

    // POST /api/folders/open - Open folder in file explorer (project-specific)
    if (pathname === '/api/folders/open' && req.method === 'POST') {
        const body = await parseBody(req);
        const folderType = body.folder || 'newinfo';
        const projectDataDir = storage.getProjectDataDir();
        let folderPath;

        switch (folderType) {
            case 'newinfo':
                folderPath = path.join(projectDataDir, 'newinfo');
                break;
            case 'newtranscripts':
                folderPath = path.join(projectDataDir, 'newtranscripts');
                break;
            case 'archived':
                folderPath = path.join(projectDataDir, 'archived');
                break;
            default:
                folderPath = projectDataDir;
        }

        if (!(await pathExists(folderPath))) {
            await fsp.mkdir(folderPath, { recursive: true });
        }

        if (process.platform === 'win32') {
            execFile('explorer.exe', [folderPath], (error) => {
                if (error) log.warn({ event: 'files_explorer_error', reason: error?.message }, 'Explorer execFile error');
            });
        } else if (process.platform === 'darwin') {
            exec(`open "${folderPath}"`);
        } else {
            exec(`xdg-open "${folderPath}"`);
        }

        log.debug({ event: 'files_folder_open', folderPath }, 'Opening folder');
        jsonResponse(res, { success: true, path: folderPath });
        return true;
    }

    // GET /api/files - Get pending files
    if (pathname === '/api/files' && req.method === 'GET') {
        const files = await processor.scanPendingFiles();
        jsonResponse(res, files);
        return true;
    }

    // DELETE /api/files/:folder/:filename - Remove file from pending queue
    const deleteMatch = pathname.match(/^\/api\/files\/(newinfo|newtranscripts)\/(.+)$/);
    if (deleteMatch && req.method === 'DELETE') {
        const folder = deleteMatch[1];
        const filename = decodeURIComponent(deleteMatch[2]);
        const filePath = path.join(processor.config.dataDir, folder, filename);
        try {
            if (await pathExists(filePath)) {
                await fsp.unlink(filePath);
                log.debug({ event: 'files_pending_deleted', folder, filename }, 'Deleted pending file');
                jsonResponse(res, { success: true, message: `File ${filename} removed` });
            } else {
                jsonResponse(res, { success: false, error: 'File not found' }, 404);
            }
        } catch (err) {
            log.warn({ event: 'files_delete_error', reason: err.message }, 'Error deleting file');
            jsonResponse(res, { success: false, error: err.message }, 500);
        }
        return true;
    }

    // POST /api/upload - Upload files via drag-and-drop
    if (pathname === '/api/upload' && req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            jsonResponse(res, { error: 'Content-Type must be multipart/form-data' }, 400);
            return true;
        }
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
        if (!boundaryMatch) {
            jsonResponse(res, { error: 'No boundary found' }, 400);
            return true;
        }
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const chunks = [];
        let totalBody = 0;
        for await (const chunk of req) {
            totalBody += chunk.length;
            if (totalBody > MAX_MULTIPART_BODY) {
                jsonResponse(res, { error: 'Request body too large' }, 413);
                return true;
            }
            chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        const parts = parseMultipart(body, boundary);

        const validationErrors = [];
        let totalSize = 0;
        for (const file of parts.files) {
            const ext = (file.filename.split('.').pop() || '').toLowerCase();
            if (DANGEROUS_EXTENSIONS.includes(ext)) {
                validationErrors.push(`File "${file.filename}" has a potentially dangerous extension`);
                continue;
            }
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                validationErrors.push(`File "${file.filename}" has unsupported extension .${ext}`);
                continue;
            }
            if (file.data.length > MAX_FILE_SIZE) {
                validationErrors.push(`File "${file.filename}" exceeds maximum size of 100MB`);
                continue;
            }
            totalSize += file.data.length;
        }
        if (totalSize > MAX_TOTAL_SIZE) {
            validationErrors.push(`Total upload size exceeds maximum of 500MB`);
        }
        if (validationErrors.length > 0) {
            jsonResponse(res, { error: 'File validation failed', details: validationErrors }, 400);
            return true;
        }

        const folderType = parts.folder || 'newinfo';
        const emailId = parts.emailId;
        const sprintId = parts.sprintId || null;
        const actionId = parts.actionId || null;
        const projectDataDir = storage.getProjectDataDir();
        const projectId = storage.getCurrentProject?.()?.id || storage.currentProjectId;
        const targetDir = folderType === 'newtranscripts'
            ? path.join(projectDataDir, 'newtranscripts')
            : path.join(projectDataDir, 'newinfo');
        if (!(await pathExists(targetDir))) await fsp.mkdir(targetDir, { recursive: true });

        const savedFiles = [];
        const documentDate = parts.documentDate;
        const documentTime = parts.documentTime;

        let useDrive = false;
        let driveClient = null;
        let driveFolderId = null;
        if (projectId && storage._supabase && storage._supabase.supabase) {
            const { value: gdConfig } = await systemConfig.getSystemConfig(drive.CONFIG_KEY);
            const enabled = gdConfig && (gdConfig.enabled === true || gdConfig === true);
            if (enabled) {
                const { data: proj } = await storage._supabase.supabase
                    .from('projects')
                    .select('settings')
                    .eq('id', projectId)
                    .single();
                const folders = proj?.settings?.googleDrive?.folders;
                driveFolderId = folderType === 'newtranscripts' ? (folders?.newtranscripts) : (folders?.uploads);
                if (driveFolderId) {
                    driveClient = await drive.getDriveClientForSystem();
                    useDrive = !!(driveClient && driveClient.drive);
                }
            }
        }

        for (const file of parts.files) {
            const safeName = file.filename.replace(/[<>:"/\\|?*]/g, '_');
            const ext = path.extname(safeName).toLowerCase().replace('.', '');
            const fileType = ext || 'bin';
            const mimeType = getMimeType(safeName) || 'application/octet-stream';

            if (useDrive && driveClient && driveFolderId) {
                try {
                    const { id: fileId } = await drive.uploadFile(driveClient, file.data, mimeType, driveFolderId, safeName);
                    const filepath = 'gdrive:' + fileId;
                    const hash = crypto.createHash('md5').update(file.data).digest('hex');
                    const docResult = await storage._supabase.addDocument({
                        filename: safeName,
                        filepath,
                        path: filepath,
                        type: fileType,
                        size: file.data.length,
                        status: 'pending',
                        doc_type: folderType === 'newtranscripts' ? 'transcript' : (emailId ? 'email_attachment' : 'document'),
                        hash,
                        sprint_id: sprintId,
                        action_id: actionId
                    });
                    if (emailId && docResult && docResult.id) {
                        await storage._supabase.addEmailAttachment(emailId, docResult.id, {
                            filename: safeName,
                            size: file.data.length,
                            content_type: mimeType
                        });
                    }
                    savedFiles.push({ name: safeName, size: file.data.length, documentDate, emailId, driveId: fileId });
                } catch (e) {
                    log.warn({ event: 'files_upload_drive_failed', reason: e.message }, 'Google Drive upload failed');
                    useDrive = false;
                    const filePath = path.join(targetDir, safeName);
                    await fsp.writeFile(filePath, file.data);
                    const metaPath = filePath + '.meta.json';
                    await fsp.writeFile(metaPath, JSON.stringify({
                        documentDate: documentDate || null,
                        documentTime: documentTime || null,
                        uploadedAt: new Date().toISOString(),
                        originalFilename: file.filename,
                        emailId: emailId || null,
                        sprintId: sprintId || null,
                        actionId: actionId || null
                    }, null, 2));
                    if (emailId && storage._supabase) {
                        try {
                            const docResult = await storage._supabase.addDocument({
                                filename: safeName,
                                path: filePath,
                                type: fileType,
                                size: file.data.length,
                                status: 'pending',
                                doc_type: 'email_attachment',
                                sprint_id: sprintId,
                                action_id: actionId
                            });
                            if (docResult && docResult.id) {
                                await storage._supabase.addEmailAttachment(emailId, docResult.id, {
                                    filename: safeName,
                                    size: file.data.length,
                                    content_type: mimeType
                                });
                            }
                        } catch (e2) {
                            log.warn({ event: 'files_upload_email_attachment_failed', reason: e2.message }, 'Failed to save email attachment');
                        }
                    }
                    savedFiles.push({ name: safeName, size: file.data.length, documentDate, emailId });
                }
            } else {
                const filePath = path.join(targetDir, safeName);
                await fsp.writeFile(filePath, file.data);
                const metaPath = filePath + '.meta.json';
                const metadata = {
                    documentDate: documentDate || null,
                    documentTime: documentTime || null,
                    uploadedAt: new Date().toISOString(),
                    originalFilename: file.filename,
                    emailId: emailId || null,
                    sprintId: sprintId || null,
                    actionId: actionId || null
                };
                await fsp.writeFile(metaPath, JSON.stringify(metadata, null, 2));
                if (emailId && storage._supabase) {
                    try {
                        const docResult = await storage._supabase.addDocument({
                            filename: safeName,
                            path: filePath,
                            type: fileType,
                            size: file.data.length,
                            status: 'pending',
                            doc_type: 'email_attachment',
                            sprint_id: sprintId,
                            action_id: actionId
                        });
                        if (docResult && docResult.id) {
                            await storage._supabase.addEmailAttachment(emailId, docResult.id, {
                                filename: safeName,
                                size: file.data.length,
                                content_type: mimeType
                            });
                        }
                    } catch (e) {
                        log.warn({ event: 'files_upload_email_attachment_failed', reason: e.message }, 'Failed to save email attachment');
                    }
                }
                savedFiles.push({ name: safeName, size: file.data.length, documentDate, emailId });
            }
        }

        jsonResponse(res, {
            success: true,
            files: savedFiles,
            folder: folderType,
            documentDate,
            emailId,
            storage: useDrive ? 'google_drive' : 'local',
            message: `${savedFiles.length} file(s) uploaded to ${folderType}${useDrive ? ' (Google Drive)' : ''}${emailId ? ' (attached to email)' : ''}`,
            processing: folderType === 'newtranscripts' ? 'started' : 'pending'
        });

        if (folderType === 'newtranscripts' && savedFiles.length > 0) {
            const llmConfig = require('../../llm/config');
            const textCfg = llmConfig.getTextConfig(config);
            const visionCfg = llmConfig.getVisionConfig(config);
            processor.processAllContentFirst(textCfg.model, visionCfg.model, '').then(async (result) => {
                const stats = result.stats || {};
                log.debug({ event: 'files_upload_transcript_done', success: result.success, ...stats }, 'Transcript processing complete');
                invalidateBriefingCache();
            }).catch(err => log.warn({ event: 'files_upload_auto_process_error', reason: err?.message }, 'Auto-processing error'));
        }
        return true;
    }

    return false;
}

module.exports = { handleFiles };
