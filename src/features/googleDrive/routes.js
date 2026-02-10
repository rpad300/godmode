/**
 * Google Drive system API (superadmin)
 * GET/POST /api/system/google-drive, POST /api/system/google-drive/bootstrap-all
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const drive = require('../../integrations/googleDrive/drive');
const systemConfig = require('../../supabase/system');
const secrets = require('../../supabase/secrets');
const projectsSupabase = require('../../supabase/projects');
const { getAdminClient } = require('../../supabase/client');

async function requireSuperAdmin(supabase, req, res) {
    const authResult = await supabase.auth.verifyRequest(req);
    if (!authResult.authenticated) {
        jsonResponse(res, { error: 'Authentication required' }, 401);
        return null;
    }
    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
    if (!isSuperAdmin) {
        jsonResponse(res, { error: 'Superadmin access required' }, 403);
        return null;
    }
    return authResult;
}

function sanitizeFolderName(s) {
    if (!s || typeof s !== 'string') return 'project';
    return s.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

async function handleGoogleDrive(ctx) {
    const { req, res, pathname, supabase } = ctx;
    const log = getLogger().child({ module: 'google-drive' });
    if (!pathname.startsWith('/api/system/google-drive')) return false;

    if (!supabase || !supabase.isConfigured()) {
        jsonResponse(res, { error: 'Supabase not configured' }, 503);
        return true;
    }

    const authResult = await requireSuperAdmin(supabase, req, res);
    if (!authResult) return true;

    // GET /api/system/google-drive – state for Admin UI (no raw JSON)
    if (pathname === '/api/system/google-drive' && req.method === 'GET') {
        try {
            const { value: config } = await systemConfig.getSystemConfig(drive.CONFIG_KEY);
            const hasSystemCredentials = await (async () => {
                const r = await secrets.getSecret('system', drive.SECRET_NAME);
                return r.success && !!r.value;
            })();
            const bootstrappedAt = config && config.bootstrappedAt ? config.bootstrappedAt : null;
            jsonResponse(res, {
                enabled: !!(config && (config.enabled === true || config === true)),
                rootFolderId: (config && config.rootFolderId) || '',
                hasSystemCredentials: !!hasSystemCredentials,
                bootstrappedAt: bootstrappedAt || null
            });
        } catch (e) {
            log.warn({ event: 'google_drive_config_get_error', reason: e?.message }, 'GET config error');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/system/google-drive – save config and optional service account JSON
    if (pathname === '/api/system/google-drive' && req.method === 'POST') {
        const body = await parseBody(req);
        const { enabled, rootFolderId, serviceAccountJson } = body || {};
        try {
            const value = {
                enabled: enabled === true || enabled === 'true',
                rootFolderId: (rootFolderId && String(rootFolderId).trim()) || ''
            };
            await systemConfig.setSystemConfig(drive.CONFIG_KEY, value, authResult.user.id, 'Google Drive integration');
            if (serviceAccountJson != null && serviceAccountJson !== '') {
                const jsonStr = typeof serviceAccountJson === 'string' ? serviceAccountJson : JSON.stringify(serviceAccountJson);
                const setResult = await secrets.setSecret({
                    scope: 'system',
                    name: drive.SECRET_NAME,
                    value: jsonStr,
                    userId: authResult.user.id
                });
                if (!setResult.success) {
                    jsonResponse(res, { error: setResult.error || 'Failed to save service account' }, 500);
                    return true;
                }
            }
            drive.clearSystemClientCache();
            jsonResponse(res, { success: true, enabled: value.enabled, rootFolderId: value.rootFolderId });
        } catch (e) {
            log.warn({ event: 'google_drive_config_post_error', reason: e?.message }, 'POST config error');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/system/google-drive/bootstrap-all – create folder structure for all projects
    if (pathname === '/api/system/google-drive/bootstrap-all' && req.method === 'POST') {
        try {
            const client = await drive.getDriveClientForSystem();
            if (!client || !client.drive || !client.rootFolderId) {
                jsonResponse(res, {
                    error: 'Google Drive not configured or disabled. Set enabled, rootFolderId and system service account first.'
                }, 400);
                return true;
            }
            const admin = getAdminClient();
            const { data: projects, error: listError } = await admin
                .from('projects')
                .select('id, name, owner_id')
                .order('name');

            if (listError) throw new Error(listError.message);
            if (!projects || projects.length === 0) {
                jsonResponse(res, { success: true, message: 'No projects to bootstrap', projectsCount: 0 });
                return true;
            }

            const ownerIds = [...new Set(projects.map((p) => p.owner_id))];
            const { data: profiles } = await admin
                .from('user_profiles')
                .select('id, username')
                .in('id', ownerIds);
            const ownerUsername = {};
            if (profiles) profiles.forEach((p) => { ownerUsername[p.id] = p.username || 'user'; });

            let done = 0;
            let failed = 0;
            for (const project of projects) {
                try {
                    const ownerName = sanitizeFolderName(ownerUsername[project.owner_id] || 'user');
                    const projectName = sanitizeFolderName(project.name || 'project');
                    const projectIdShort = (project.id || '').replace(/-/g, '').substring(0, 8);
                    const mainFolderName = `${ownerName}-${projectName}-${projectIdShort}`;
                    const mainFolderId = await drive.ensureFolder(client, client.rootFolderId, mainFolderName);
                    const uploadsId = await drive.ensureFolder(client, mainFolderId, 'uploads');
                    const newtranscriptsId = await drive.ensureFolder(client, mainFolderId, 'newtranscripts');
                    const archivedId = await drive.ensureFolder(client, mainFolderId, 'archived');
                    const exportsId = await drive.ensureFolder(client, mainFolderId, 'exports');
                    const googleDriveSettings = {
                        projectFolderId: mainFolderId,
                        folders: {
                            uploads: uploadsId,
                            newtranscripts: newtranscriptsId,
                            archived: archivedId,
                            exports: exportsId
                        },
                        bootstrappedAt: new Date().toISOString()
                    };
                    await projectsSupabase.updateSettings(project.id, { googleDrive: googleDriveSettings });
                    done++;
                } catch (err) {
                    log.warn({ event: 'google_drive_bootstrap_failed', projectId: project.id, reason: err.message }, 'Bootstrap failed for project');
                    failed++;
                }
            }

            const bootstrappedAt = new Date().toISOString();
            await systemConfig.setSystemConfig('google_drive_last_bootstrap', { bootstrappedAt, projectsCount: done }, authResult.user.id);

            // Audit: log bootstrap action so it appears in system audit
            try {
                await admin.from('config_audit_log').insert({
                    config_type: 'system',
                    config_key: 'google_drive_bootstrap',
                    project_id: null,
                    action: 'update',
                    old_value: null,
                    new_value: { bootstrappedAt, projectsCount: done, failedCount: failed },
                    change_summary: `Google Drive bootstrap all projects: ${done} done, ${failed} failed`,
                    changed_by: authResult.user.id,
                    changed_by_email: authResult.user.email || null
                });
            } catch (auditErr) {
                log.warn({ event: 'google_drive_audit_insert_failed', reason: auditErr.message }, 'Audit log insert failed (non-fatal)');
            }

            jsonResponse(res, {
                success: true,
                message: `Bootstrap complete: ${done} projects, ${failed} failed`,
                projectsCount: done,
                failedCount: failed,
                bootstrappedAt
            });
        } catch (e) {
            log.warn({ event: 'google_drive_bootstrap_all_error', reason: e?.message }, 'bootstrap-all error');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleGoogleDrive };
