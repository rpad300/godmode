const { google } = require('googleapis');
const stream = require('stream');

const secrets = require('../../supabase/secrets');

const SECRET_NAME = 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON';

function isDrivePath(filepath) {
    return typeof filepath === 'string' && filepath.startsWith('gdrive:');
}

function parseDriveFileId(filepath) {
    if (!isDrivePath(filepath)) return null;
    return filepath.slice('gdrive:'.length);
}

async function getDriveClientForProject(projectId) {
    const secret = await secrets.getSecret('project', SECRET_NAME, projectId);
    if (!secret.success || !secret.value) {
        return { success: false, error: secret.error || 'Missing Google Drive credentials' };
    }

    let creds;
    try {
        creds = JSON.parse(secret.value);
    } catch {
        return { success: false, error: 'Invalid Google Drive service account JSON' };
    }

    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });
    return { success: true, drive };
}

async function ensureFolder({ drive, name, parentId }) {
    // Try find existing
    const q = [
        `mimeType='application/vnd.google-apps.folder'`,
        `name='${name.replace(/'/g, "\\'")}'`,
        parentId ? `'${parentId}' in parents` : null,
        'trashed=false'
    ].filter(Boolean).join(' and ');

    const list = await drive.files.list({
        q,
        fields: 'files(id,name)',
        spaces: 'drive',
        pageSize: 1
    });

    if (list.data.files && list.data.files.length > 0) {
        return { success: true, id: list.data.files[0].id };
    }

    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : undefined
        },
        fields: 'id,name'
    });

    return { success: true, id: created.data.id };
}

async function uploadFile({ drive, name, parentId, buffer, mimeType = 'application/octet-stream' }) {
    const bodyStream = new stream.PassThrough();
    bodyStream.end(buffer);

    const created = await drive.files.create({
        requestBody: {
            name,
            parents: parentId ? [parentId] : undefined
        },
        media: {
            mimeType,
            body: bodyStream
        },
        fields: 'id,name,size'
    });

    return { success: true, file: created.data };
}

async function downloadFile({ drive, fileId }) {
    const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    return { success: true, stream: res.data };
}

async function getDriveClientForSystem() {
    const secret = await secrets.getSecret('system', SECRET_NAME);
    if (!secret.success || !secret.value) {
        return { success: false, error: secret.error || 'Missing Google Drive credentials' };
    }

    let creds;
    try {
        creds = JSON.parse(secret.value);
    } catch {
        return { success: false, error: 'Invalid Google Drive service account JSON' };
    }

    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });
    return { success: true, drive };
}

module.exports = {
    SECRET_NAME,
    isDrivePath,
    parseDriveFileId,
    getDriveClientForProject,
    getDriveClientForSystem,
    ensureFolder,
    uploadFile,
    downloadFile
};
