/**
 * Purpose:
 *   Google Drive integration routes for system-level admin configuration
 *   and per-project Drive sync management.
 *
 * Responsibilities:
 *   - Superadmin: configure Drive integration (root folder, service account credentials)
 *   - Superadmin: bootstrap Google Drive folder structure for all projects
 *   - Per-project: trigger manual sync, retrieve sync stats, update sync settings
 *
 * Key dependencies:
 *   - ../../integrations/googleDrive/drive: Drive client factory and folder init
 *   - ../../integrations/googleDrive/sync: per-project file sync logic
 *   - ../../supabase/system: system-level config persistence
 *   - ../../supabase/secrets: encrypted service account JSON storage
 *   - ../../supabase/projects: project settings read/write
 *
 * Side effects:
 *   - Writes system config and secrets to Supabase
 *   - Creates Google Drive folders via the Drive API
 *   - Inserts audit log rows on bootstrap
 *   - Clears cached Drive client after credential updates
 *
 * Notes:
 *   - All /api/system/google-drive routes require superadmin; returns 403 otherwise
 *   - /api/google-drive/* routes check project membership but still go through
 *     requireSuperAdmin (inherited from the shared auth guard at the top of handleGoogleDrive)
 *   - The `sync` module is required a second time inline (line 223) -- likely a leftover
 *     from incremental extraction; the top-level import already covers it.
 *
 * Routes:
 *   GET  /api/system/google-drive             - Admin UI state (config, pending/configured projects)
 *     Auth: superadmin | Resp: { enabled, rootFolderId, hasSystemCredentials, ... }
 *
 *   POST /api/system/google-drive             - Save config + optional service account JSON
 *     Auth: superadmin | Body: { enabled, rootFolderId, serviceAccountJson? }
 *
 *   POST /api/system/google-drive/bootstrap-all - Create Drive folder tree for every project
 *     Auth: superadmin | Resp: { projectsCount, failedCount, bootstrappedAt }
 *
 *   POST /api/google-drive/sync               - Manual per-project sync trigger
 *     Auth: project member | Body: { projectId }
 *
 *   GET  /api/google-drive/stats              - Per-project sync statistics
 *     Auth: project member | Query: projectId
 *
 *   POST /api/google-drive/config             - Update per-project sync settings
 *     Auth: project owner/admin | Body: { projectId, syncFrequency?, autoSync? }
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const drive = require('../../integrations/googleDrive/drive');
const systemConfig = require('../../supabase/system');
const secrets = require('../../supabase/secrets');
const projectsSupabase = require('../../supabase/projects');
const { getAdminClient } = require('../../supabase/client');
const sync = require('../../integrations/googleDrive/sync');

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
            const admin = getAdminClient();

            // Get projects missing configuration
            const { data: pendingProjects } = await admin
                .from('projects')
                .select('id, name')
                .or('settings.is.null,settings->googleDrive->projectFolderId.is.null')
                .order('name');

            // Get configured projects
            const { data: configuredRaw } = await admin
                .from('projects')
                .select('id, name, settings')
                .not('settings->googleDrive->projectFolderId', 'is', null)
                .order('name');

            const configuredProjects = (configuredRaw || []).map(p => ({
                id: p.id,
                name: p.name,
                folderId: p.settings?.googleDrive?.projectFolderId
            }));

            jsonResponse(res, {
                enabled: !!(config && (config.enabled === true || config === true)),
                rootFolderId: (config && config.rootFolderId) || '',
                hasSystemCredentials: !!hasSystemCredentials,
                bootstrappedAt: bootstrappedAt || null,
                pendingProjects: pendingProjects || [],
                configuredProjects
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
                    const ownerUsernameStr = ownerUsername[project.owner_id];
                    const result = await drive.initializeProjectFolder(project, ownerUsernameStr);

                    if (result) {
                        try {
                            const newSettings = {
                                ...(project.settings || {}), // Assuming we had fetched settings, but we didn't in line 114. We should probably fetch it or just merge what we have.
                                // Actually, projects.updateSettings does a merge.
                                googleDrive: result
                            };
                            await projectsSupabase.updateSettings(project.id, { googleDrive: result });
                            done++;
                        } catch (updateErr) {
                            // If update fails
                            log.warn({ event: 'google_drive_bootstrap_update_failed', projectId: project.id, reason: updateErr.message }, 'Failed to update project settings');
                            failed++;
                        }
                    } else {
                        // drive.initializeProjectFolder returned null (e.g. not enabled)
                        // In this context (bootstrap-all), it might mean system config is wrong, but client check at top should catch that.
                        // It also logs its own errors.
                        failed++;
                    }
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

    // POST /api/google-drive/sync – Manual sync trigger
    if (pathname === '/api/google-drive/sync' && req.method === 'POST') {
        const body = await parseBody(req);
        const { projectId } = body;

        if (!projectId) {
            jsonResponse(res, { error: 'Project ID required' }, 400);
            return true;
        }

        try {
            // Check permissions (must be member)
            const { data: member } = await supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', authResult.user.id)
                .single();

            if (!member) {
                jsonResponse(res, { error: 'Access denied' }, 403);
                return true;
            }

            const stats = await sync.syncProject(projectId);

            // Update last sync in settings
            const { data: project } = await projectsSupabase.getProject(projectId);
            if (project) {
                const newSettings = {
                    ...(project.settings || {}),
                    googleDrive: {
                        ...(project.settings?.googleDrive || {}),
                        lastSync: new Date().toISOString(),
                        lastSyncStats: stats
                    }
                };
                await projectsSupabase.updateSettings(projectId, { googleDrive: newSettings.googleDrive });
            }

            jsonResponse(res, { success: true, stats });
        } catch (e) {
            log.error({ event: 'drive_manual_sync_error', projectId, error: e.message }, 'Manual sync failed');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/google-drive/stats – Sync stats
    if (pathname === '/api/google-drive/stats' && req.method === 'GET') {
        const projectId = req.searchParams.get('projectId');
        if (!projectId) {
            jsonResponse(res, { error: 'Project ID required' }, 400);
            return true;
        }

        try {
            // Check permissions
            const { data: member } = await supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', authResult.user.id)
                .single();

            if (!member) {
                jsonResponse(res, { error: 'Access denied' }, 403);
                return true;
            }

            const { data: project } = await projectsSupabase.getProject(projectId);
            const driveSettings = project?.settings?.googleDrive || {};

            // Get total imported documents count from DB
            const { count, error } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId)
                .not('metadata->>drive_file_id', 'is', null);

            jsonResponse(res, {
                connected: !!driveSettings.projectFolderId,
                lastSync: driveSettings.lastSync || null,
                importedCount: count || 0,
                folders: driveSettings.folders || {}
            });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/google-drive/config – Update sync settings (frequency, monitored folders)
    if (pathname === '/api/google-drive/config' && req.method === 'POST') {
        const body = await parseBody(req);
        const { projectId, syncFrequency, autoSync } = body;

        if (!projectId) {
            jsonResponse(res, { error: 'Project ID required' }, 400);
            return true;
        }

        try {
            // Check permissions
            const { data: member } = await supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', authResult.user.id)
                .single();

            if (!member || !['owner', 'admin'].includes(member.role)) {
                jsonResponse(res, { error: 'Access denied' }, 403);
                return true;
            }

            const { data: project } = await projectsSupabase.getProject(projectId);
            const newSettings = {
                ...(project.settings || {}),
                googleDrive: {
                    ...(project.settings?.googleDrive || {}),
                    syncFrequency: syncFrequency || 'hourly',
                    autoSync: autoSync !== undefined ? autoSync : true
                }
            };

            await projectsSupabase.updateSettings(projectId, { googleDrive: newSettings.googleDrive });
            jsonResponse(res, { success: true, settings: newSettings.googleDrive });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleGoogleDrive };
