/**
 * Google Drive routes
 *
 * Platform-level storage:
 * - Credentials are stored as a SYSTEM secret in Supabase (encrypted)
 * - Root folder is stored in system_config (key: google_drive)
 *
 * Project-level:
 * - Each project stores only the derived folder structure ids under projects.settings.googleDrive
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

const driveIntegration = require('../../integrations/googleDrive/drive');

async function requireProjectAdmin({ supabase, req, projectId }) {
    const authResult = await supabase.auth.verifyRequest(req);
    if (!authResult.authenticated) {
        return { ok: false, status: 401, error: 'Authentication required' };
    }

    const client = supabase.getAdminClient();
    const { data: member, error: memberError } = await client
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', authResult.user.id)
        .single();

    if (memberError || !member) {
        return { ok: false, status: 403, error: 'Project access required' };
    }

    const role = (member.role || '').toLowerCase();
    if (!['owner', 'admin'].includes(role)) {
        return { ok: false, status: 403, error: 'Admin access required' };
    }

    return { ok: true, userId: authResult.user.id };
}

async function handleGoogleDrive(ctx) {
    const { req, res, pathname, supabase } = ctx;

    if (!supabase || !supabase.isConfigured()) {
        return false;
    }

    // ==================== System Google Drive (Admin) ====================
    // GET /api/system/google-drive - Get platform Drive settings (non-secret)
    if (pathname === '/api/system/google-drive' && req.method === 'GET') {
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const system = require('../../supabase/system');
        const secrets = require('../../supabase/secrets');

        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};

        const secretList = await secrets.listSecrets('system');
        const hasCredential = !!(secretList?.secrets || []).find(s => s.name === driveIntegration.SECRET_NAME);

        jsonResponse(res, {
            success: true,
            googleDrive: {
                enabled: !!cfg.enabled,
                rootFolderId: cfg.rootFolderId || null,
                hasCredential
            }
        });
        return true;
    }

    // POST /api/system/google-drive - Set platform Drive settings (and optionally credential)
    if (pathname === '/api/system/google-drive' && req.method === 'POST') {
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const body = await parseBody(req);
        const { enabled, rootFolderId, serviceAccountJson } = body || {};

        if (enabled && !rootFolderId) {
            jsonResponse(res, { error: 'rootFolderId is required when enabled' }, 400);
            return true;
        }

        const secrets = require('../../supabase/secrets');
        if (serviceAccountJson) {
            const set = await secrets.setSecret({
                scope: 'system',
                name: driveIntegration.SECRET_NAME,
                value: serviceAccountJson,
                provider: 'google',
                userId: authResult.user.id
            });
            if (!set.success) {
                jsonResponse(res, { error: set.error }, 500);
                return true;
            }
        }

        const system = require('../../supabase/system');
        const cfg = {
            enabled: !!enabled,
            rootFolderId: enabled ? rootFolderId : null,
            updatedAt: new Date().toISOString()
        };

        const saved = await system.setSystemConfig('google_drive', cfg, authResult.user.id, 'Google Drive platform storage config');
        if (!saved.success) {
            jsonResponse(res, { error: saved.error }, 500);
            return true;
        }

        jsonResponse(res, { success: true, googleDrive: cfg });
        return true;
    }

    // GET /api/system/google-drive/status - Platform Drive status + bootstrap coverage
    if (pathname === '/api/system/google-drive/status' && req.method === 'GET') {
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const system = require('../../supabase/system');
        const secrets = require('../../supabase/secrets');

        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};
        const secretList = await secrets.listSecrets('system');
        const hasCredential = !!(secretList?.secrets || []).find(s => s.name === driveIntegration.SECRET_NAME);

        const client = supabase.getAdminClient();
        const { data: projects, error } = await client
            .from('projects')
            .select('id, settings');

        if (error) {
            jsonResponse(res, { error: error.message }, 500);
            return true;
        }

        const total = (projects || []).length;
        const bootstrapped = (projects || []).filter(p => p.settings?.googleDrive?.projectFolderId).length;
        const missing = total - bootstrapped;

        // last bootstrap run
        const lastRes = await system.getSystemConfig('google_drive_last_bootstrap');
        const last = lastRes?.value || null;

        jsonResponse(res, {
            success: true,
            googleDrive: {
                enabled: !!cfg.enabled,
                rootFolderId: cfg.rootFolderId || null,
                hasCredential,
            },
            projects: {
                total,
                bootstrapped,
                missing,
                upToDate: missing === 0
            },
            lastBootstrap: last
        });
        return true;
    }

    // GET /api/system/google-drive/projects - List per-project folder ids
    if (pathname === '/api/system/google-drive/projects' && req.method === 'GET') {
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const client = supabase.getAdminClient();
        const { data: projects, error } = await client
            .from('projects')
            .select('id, name, owner_id, settings, updated_at')
            .order('updated_at', { ascending: false });

        if (error) {
            jsonResponse(res, { error: error.message }, 500);
            return true;
        }

        // Load usernames
        const ownerIds = Array.from(new Set((projects || []).map(p => p.owner_id).filter(Boolean)));
        let userMap = {};
        if (ownerIds.length > 0) {
            const { data: profiles } = await client
                .from('user_profiles')
                .select('id, username, display_name')
                .in('id', ownerIds);
            if (profiles) {
                userMap = Object.fromEntries(profiles.map(p => [p.id, p]));
            }
        }

        const rows = (projects || []).map(p => {
            const owner = userMap[p.owner_id] || null;
            const g = p.settings?.googleDrive || {};
            return {
                id: p.id,
                name: p.name,
                owner_id: p.owner_id,
                owner_username: owner?.username || owner?.display_name || null,
                projectFolderId: g.projectFolderId || null,
                folders: g.folders || null,
                bootstrappedAt: g.bootstrappedAt || null,
            };
        });

        jsonResponse(res, { success: true, projects: rows });
        return true;
    }

    // POST /api/system/google-drive/bootstrap-all - Ensure folder structure for all projects
    if (pathname === '/api/system/google-drive/bootstrap-all' && req.method === 'POST') {
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const system = require('../../supabase/system');
        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};

        if (!cfg.enabled || !cfg.rootFolderId) {
            jsonResponse(res, { error: 'Google Drive is not enabled on this platform' }, 400);
            return true;
        }

        const driveClient = await driveIntegration.getDriveClientForSystem();
        if (!driveClient.success) {
            jsonResponse(res, { error: driveClient.error }, 400);
            return true;
        }

        const client = supabase.getAdminClient();
        const { data: projects, error } = await client
            .from('projects')
            .select('id, name, owner_id, settings')
            .order('updated_at', { ascending: false });

        if (error) {
            jsonResponse(res, { error: error.message }, 500);
            return true;
        }

        const ownerIds = Array.from(new Set((projects || []).map(p => p.owner_id).filter(Boolean)));
        let userMap = {};
        if (ownerIds.length > 0) {
            const { data: profiles } = await client
                .from('user_profiles')
                .select('id, username, display_name')
                .in('id', ownerIds);
            if (profiles) {
                userMap = Object.fromEntries(profiles.map(p => [p.id, p]));
            }
        }

        const results = {
            total: (projects || []).length,
            created: 0,
            repaired: 0,
            skipped: 0,
            errors: []
        };

        for (const p of (projects || [])) {
            try {
                const existing = p.settings?.googleDrive;
                const hasProjectFolder = !!existing?.projectFolderId;

                const owner = userMap[p.owner_id] || null;
                const ownerUsername = (owner?.username || owner?.display_name || 'user');
                const safeOwner = String(ownerUsername).replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
                const safeProjectName = String(p.name || 'project').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
                const folderName = `${safeOwner}-${safeProjectName}-${p.id}`;

                // Ensure project folder
                const projectFolder = hasProjectFolder
                    ? { success: true, id: existing.projectFolderId }
                    : await driveIntegration.ensureFolder({ drive: driveClient.drive, name: folderName, parentId: cfg.rootFolderId });

                const uploads = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'uploads', parentId: projectFolder.id });
                const transcripts = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'newtranscripts', parentId: projectFolder.id });
                const archived = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'archived', parentId: projectFolder.id });
                const exports = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'exports', parentId: projectFolder.id });

                const merged = {
                    ...(p.settings || {}),
                    googleDrive: {
                        enabled: true,
                        projectFolderId: projectFolder.id,
                        folders: {
                            uploads: uploads.id,
                            newtranscripts: transcripts.id,
                            archived: archived.id,
                            exports: exports.id
                        },
                        bootstrappedAt: existing?.bootstrappedAt || new Date().toISOString()
                    }
                };

                const { error: upErr } = await client
                    .from('projects')
                    .update({ settings: merged, updated_at: new Date().toISOString() })
                    .eq('id', p.id);

                if (upErr) throw upErr;

                if (!hasProjectFolder) results.created += 1;
                else results.repaired += 1;
            } catch (e) {
                results.errors.push({ projectId: p.id, error: e.message });
            }
        }

        results.skipped = results.total - results.created - results.repaired - results.errors.length;

        await system.setSystemConfig(
            'google_drive_last_bootstrap',
            { at: new Date().toISOString(), results },
            authResult.user.id,
            'Last Google Drive bootstrap-all run'
        );

        jsonResponse(res, { success: true, results });
        return true;
    }

    // POST /api/system/google-drive/test - Test platform Drive credentials
    if (pathname === '/api/system/google-drive/test' && req.method === 'POST') {
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
        if (!isSuperAdmin) {
            jsonResponse(res, { error: 'Superadmin access required' }, 403);
            return true;
        }

        const system = require('../../supabase/system');
        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};

        if (!cfg.enabled || !cfg.rootFolderId) {
            jsonResponse(res, { error: 'Google Drive is not enabled on this platform' }, 400);
            return true;
        }

        const driveClient = await driveIntegration.getDriveClientForSystem();
        if (!driveClient.success) {
            jsonResponse(res, { error: driveClient.error }, 400);
            return true;
        }

        try {
            // Verify the root folder is accessible
            const rootMeta = await driveClient.drive.files.get({ fileId: cfg.rootFolderId, fields: 'id,name,mimeType' });
            jsonResponse(res, { success: true, root: rootMeta.data });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // ==================== Project-scoped routes ====================
    if (!pathname.startsWith('/api/projects/')) {
        return false;
    }

    const match = pathname.match(/^\/api\/projects\/([^/]+)\/google-drive(?:\/(bootstrap|test))?$/);
    if (!match) return false;

    const projectId = match[1];
    const action = match[2] || null;

    // GET /api/projects/:id/google-drive
    // Now returns effective per-project state derived from platform config + stored per-project folders.
    if (!action && req.method === 'GET') {
        const admin = await requireProjectAdmin({ supabase, req, projectId });
        if (!admin.ok) {
            jsonResponse(res, { error: admin.error }, admin.status);
            return true;
        }

        const client = supabase.getAdminClient();
        const { data: project, error } = await client
            .from('projects')
            .select('id, settings')
            .eq('id', projectId)
            .single();

        if (error || !project) {
            jsonResponse(res, { error: 'Project not found' }, 404);
            return true;
        }

        const system = require('../../supabase/system');
        const secrets = require('../../supabase/secrets');
        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};
        const secretList = await secrets.listSecrets('system');
        const hasCredential = !!(secretList?.secrets || []).find(s => s.name === driveIntegration.SECRET_NAME);

        const gdrive = project.settings?.googleDrive || {};

        jsonResponse(res, {
            success: true,
            googleDrive: {
                platformEnabled: !!cfg.enabled,
                hasCredential,
                rootFolderId: cfg.rootFolderId || null,
                projectFolderId: gdrive.projectFolderId || null,
                folders: gdrive.folders || null,
                bootstrappedAt: gdrive.bootstrappedAt || null
            }
        });
        return true;
    }

    // POST /api/projects/:id/google-drive
    // Deprecated: Google Drive is now configured at platform level (Admin).
    if (!action && req.method === 'POST') {
        jsonResponse(res, { error: 'Google Drive is configured at platform level. Use /api/system/google-drive.' }, 410);
        return true;
    }

    // POST /api/projects/:id/google-drive/bootstrap (create folder structure)
    if (action === 'bootstrap' && req.method === 'POST') {
        const admin = await requireProjectAdmin({ supabase, req, projectId });
        if (!admin.ok) {
            jsonResponse(res, { error: admin.error }, admin.status);
            return true;
        }

        const client = supabase.getAdminClient();
        const { data: project, error } = await client
            .from('projects')
            .select('id, name, settings')
            .eq('id', projectId)
            .single();

        if (error || !project) {
            jsonResponse(res, { error: 'Project not found' }, 404);
            return true;
        }

        const system = require('../../supabase/system');
        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};

        if (!cfg.enabled || !cfg.rootFolderId) {
            jsonResponse(res, { error: 'Google Drive is not enabled on this platform' }, 400);
            return true;
        }

        const driveClient = await driveIntegration.getDriveClientForSystem();
        if (!driveClient.success) {
            jsonResponse(res, { error: driveClient.error }, 400);
            return true;
        }

        try {
            // Platform rootFolderId is set in Admin. We create a per-project subtree.
            // Folder naming: <ownerUsername>-<projectName>-<projectId> (sanitized)
            // Derive owner username for folder naming
            let ownerUsername = '';
            try {
                const authResult = await supabase.auth.verifyRequest(req);
                const uid = authResult?.user?.id;
                if (uid) {
                    const { data: profile } = await client
                        .from('user_profiles')
                        .select('username')
                        .eq('id', uid)
                        .single();
                    ownerUsername = profile?.username || '';
                }
            } catch (e) {
                // ignore
            }

            const safeOwner = (ownerUsername || 'user').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
            const safeProjectName = (project.name || 'project').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
            const folderName = `${safeOwner}-${safeProjectName}-${projectId}`;

            const projectFolder = await driveIntegration.ensureFolder({
                drive: driveClient.drive,
                name: folderName,
                parentId: cfg.rootFolderId
            });

            const uploads = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'uploads', parentId: projectFolder.id });
            const transcripts = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'newtranscripts', parentId: projectFolder.id });
            const archived = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'archived', parentId: projectFolder.id });
            const exports = await driveIntegration.ensureFolder({ drive: driveClient.drive, name: 'exports', parentId: projectFolder.id });

            const merged = {
                ...(project.settings || {}),
                googleDrive: {
                    enabled: true,
                    projectFolderId: projectFolder.id,
                    folders: {
                        uploads: uploads.id,
                        newtranscripts: transcripts.id,
                        archived: archived.id,
                        exports: exports.id
                    },
                    bootstrappedAt: new Date().toISOString()
                }
            };

            const { data: updated, error: upErr } = await client
                .from('projects')
                .update({ settings: merged, updated_at: new Date().toISOString() })
                .eq('id', projectId)
                .select('settings')
                .single();

            if (upErr) {
                jsonResponse(res, { error: upErr.message }, 500);
                return true;
            }

            jsonResponse(res, { success: true, googleDrive: updated.settings.googleDrive });
            return true;
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
            return true;
        }
    }

    // POST /api/projects/:id/google-drive/test
    if (action === 'test' && req.method === 'POST') {
        const admin = await requireProjectAdmin({ supabase, req, projectId });
        if (!admin.ok) {
            jsonResponse(res, { error: admin.error }, admin.status);
            return true;
        }

        const system = require('../../supabase/system');
        const cfgRes = await system.getSystemConfig('google_drive');
        const cfg = (cfgRes?.value && typeof cfgRes.value === 'object') ? cfgRes.value : {};

        if (!cfg.enabled) {
            jsonResponse(res, { error: 'Google Drive is not enabled on this platform' }, 400);
            return true;
        }

        const driveClient = await driveIntegration.getDriveClientForSystem();
        if (!driveClient.success) {
            jsonResponse(res, { error: driveClient.error }, 400);
            return true;
        }

        try {
            const about = await driveClient.drive.about.get({ fields: 'user,storageQuota' });
            jsonResponse(res, { success: true, about: about.data });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleGoogleDrive
};
