/**
 * Purpose:
 *   Full lifecycle management for projects: creation (with automatic Google
 *   Drive folder provisioning), retrieval, update, deletion, listing,
 *   statistics, settings, cloning, and role configuration.
 *
 * Responsibilities:
 *   - CRUD on the `projects` table
 *   - Auto-provision Google Drive folder hierarchy on project creation
 *   - Initialize `graph_sync_status` row for each new project
 *   - Ensure the project creator is added as owner in `project_members`
 *   - Provide project-level statistics (member count, comment count,
 *     recent activity, sync status)
 *   - Manage project-level custom roles stored in the JSONB `settings` column
 *   - Clone projects (copies settings/description, not content)
 *
 * Key dependencies:
 *   - ./client (getAdminClient): all queries bypass RLS; caller is
 *     responsible for authorization checks
 *   - ../integrations/googleDrive/drive: automatic Drive folder creation
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Creates rows in `projects`, `project_members`, `graph_sync_status`
 *   - May create Google Drive folders via the Drive API
 *   - Deleting a project cascades to members, invites, and related rows
 *
 * Notes:
 *   - Drive folder creation failures are logged but do not fail project
 *     creation (fire-and-forget with warning).
 *   - updateProject() whitelists allowed fields (name, description, settings)
 *     to prevent accidental overwrites of owner_id or company_id.
 *   - updateSettings() performs a shallow merge of the existing settings
 *     JSONB with the new payload.
 *   - deleteProject() enforces ownership: only the project owner may delete.
 *   - Roles in settings are identified by a UUID `id` field and carry an
 *     `active` boolean flag.
 *
 * Supabase tables accessed:
 *   - projects: { id, name, description, owner_id, company_id, settings,
 *     created_at, updated_at }
 *   - project_members: { project_id, user_id, role }
 *   - graph_sync_status: { project_id, graph_name }
 *   - user_profiles: joined for owner display info
 *   - companies: joined for company name/logo
 *   - activity_log: queried for recent activity count (stats)
 *   - comments: queried for comment count (stats)
 */

const drive = require('../integrations/googleDrive/drive');
const { logger } = require('../logger');
const { getAdminClient } = require('./client');
const crypto = require('crypto');

const log = logger.child({ module: 'projects' });

/**
 * Create a new project with full side-effect orchestration.
 *
 * Steps performed:
 *   1. Insert into `projects` table
 *   2. Upsert owner as member in `project_members` (defensive; a DB
 *      trigger may also do this)
 *   3. Initialize a `graph_sync_status` row
 *   4. Attempt to create Google Drive folders via the Drive integration;
 *      on success, store Drive metadata in project settings
 *
 * @param {object} params
 * @param {string} params.name - Required project name
 * @param {string} [params.description]
 * @param {string} params.ownerId - UUID of the creating user
 * @param {string} params.companyId - Required company UUID
 * @param {object} [params.settings] - Initial settings JSONB
 * @returns {Promise<{success: boolean, project?: object, error?: string}>}
 */
async function createProject({
    name,
    description = null,
    ownerId,
    companyId,
    settings = {}
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }
    if (!companyId) {
        return { success: false, error: 'Company is required' };
    }

    try {
        // Create project
        const { data: project, error } = await supabase
            .from('projects')
            .insert({
                name,
                description,
                owner_id: ownerId,
                company_id: companyId,
                settings
            })
            .select()
            .single();

        if (error) throw error;

        // The trigger should auto-add owner as member
        // But let's ensure it explicitly
        await supabase
            .from('project_members')
            .upsert({
                project_id: project.id,
                user_id: ownerId,
                role: 'owner'
            }, {
                onConflict: 'project_id,user_id'
            });

        // Initialize sync status
        await supabase
            .from('graph_sync_status')
            .insert({
                project_id: project.id,
                graph_name: `project_${project.id}`
            })
            .select()
            .maybeSingle();

        // AUTOMATIC DRIVE FOLDER CREATION
        try {
            // Get owner username for folder naming
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('id', ownerId)
                .single();

            const ownerUsername = profile?.username;

            // Initialize Drive folder
            const driveSettings = await drive.initializeProjectFolder(project, ownerUsername);

            if (driveSettings) {
                // Update project settings with Drive info
                const newSettings = {
                    ...(project.settings || {}),
                    googleDrive: driveSettings
                };

                await supabase
                    .from('projects')
                    .update({ settings: newSettings })
                    .eq('id', project.id);

                project.settings = newSettings; // Update local object
                log.info({ event: 'project_drive_initialized', projectId: project.id }, 'Initialized Drive folders');
            }
        } catch (driveErr) {
            log.warn({ event: 'project_drive_init_error', projectId: project.id, reason: driveErr.message }, 'Failed to auto-create Drive folders');
            // Do not fail the project creation
        }

        return { success: true, project };
    } catch (error) {
        log.warn({ event: 'projects_create_error', reason: error?.message }, 'Create error');
        return { success: false, error: error.message };
    }
}

/**
 * Get project by ID
 */
async function getProject(projectId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: project, error } = await supabase
            .from('projects')
            .select(`
                *,
                owner:user_profiles!owner_id(id, username, display_name, avatar_url),
                company:companies(id, name, logo_url, brand_assets)
            `)
            .eq('id', projectId)
            .single();

        if (error) throw error;

        return { success: true, project };
    } catch (error) {
        log.warn({ event: 'projects_get_error', reason: error?.message }, 'Get error');
        return { success: false, error: error.message };
    }
}

/**
 * Update project
 */
async function updateProject(projectId, updates) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const allowedFields = ['name', 'description', 'settings'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    try {
        const { data: project, error } = await supabase
            .from('projects')
            .update(filteredUpdates)
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, project };
    } catch (error) {
        log.warn({ event: 'projects_update_error', reason: error?.message }, 'Update error');
        return { success: false, error: error.message };
    }
}

/**
 * Delete a project. Only the owner may delete.
 * Relies on Postgres CASCADE constraints to clean up project_members,
 * invites, comments, and other child rows.
 *
 * @param {string} projectId
 * @param {string} userId - Must match projects.owner_id
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteProject(projectId, userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Verify ownership
        const { data: project } = await supabase
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .single();

        if (!project) {
            return { success: false, error: 'Project not found' };
        }

        if (project.owner_id !== userId) {
            return { success: false, error: 'Only the owner can delete a project' };
        }

        // Delete (cascades to members, invites, etc.)
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        log.warn({ event: 'projects_delete_error', reason: error?.message }, 'Delete error');
        return { success: false, error: error.message };
    }
}

/**
 * List projects for a user
 */
async function listUserProjects(userId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { limit = 50, offset = 0, includeRole = true } = options;

    try {
        // Get project IDs where user is a member
        const { data: memberships, error: memberError } = await supabase
            .from('project_members')
            .select('project_id, role')
            .eq('user_id', userId);

        if (memberError) throw memberError;

        if (!memberships || memberships.length === 0) {
            return { success: true, projects: [] };
        }

        const projectIds = memberships.map(m => m.project_id);
        const roleMap = {};
        memberships.forEach(m => { roleMap[m.project_id] = m.role; });

        // Get projects
        const { data: projects, error } = await supabase
            .from('projects')
            .select(`
                *,
                owner:user_profiles!owner_id(id, username, display_name)
            `)
            .in('id', projectIds)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        // Add role to each project
        const projectsWithRole = (projects || []).map(p => ({
            ...p,
            user_role: roleMap[p.id]
        }));

        return { success: true, projects: projectsWithRole };
    } catch (error) {
        log.warn({ event: 'projects_list_error', reason: error?.message }, 'List error');
        return { success: false, error: error.message };
    }
}

/**
 * Aggregate statistics for a project dashboard.
 *
 * Returns counts of members, comments, recent activity (last 7 days),
 * and the current graph_sync_status row.
 *
 * @param {string} projectId
 * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
 *   stats shape: { members: number, comments: number,
 *                   recentActivity: number, sync: object|null }
 */
async function getProjectStats(projectId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get member count
        const { count: memberCount } = await supabase
            .from('project_members')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId);

        // Get comment count
        const { count: commentCount } = await supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId);

        // Get activity count (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count: activityCount } = await supabase
            .from('activity_log')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('created_at', sevenDaysAgo.toISOString());

        // Get sync status
        const { data: syncStatus } = await supabase
            .from('graph_sync_status')
            .select('*')
            .eq('project_id', projectId)
            .maybeSingle();

        return {
            success: true,
            stats: {
                members: memberCount || 0,
                comments: commentCount || 0,
                recentActivity: activityCount || 0,
                sync: syncStatus
            }
        };
    } catch (error) {
        log.warn({ event: 'projects_stats_error', reason: error?.message }, 'Stats error');
        return { success: false, error: error.message };
    }
}

/**
 * Update project settings
 */
async function updateSettings(projectId, settings) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get current settings
        const { data: current } = await supabase
            .from('projects')
            .select('settings')
            .eq('id', projectId)
            .single();

        // Merge settings
        const mergedSettings = {
            ...(current?.settings || {}),
            ...settings
        };

        const { data: project, error } = await supabase
            .from('projects')
            .update({ settings: mergedSettings })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, project };
    } catch (error) {
        log.warn({ event: 'projects_update_settings_error', reason: error?.message }, 'Update settings error');
        return { success: false, error: error.message };
    }
}

/**
 * Clone a project by copying its description and settings into a new
 * project under the given owner. Does NOT clone content (facts, documents,
 * comments, etc.) -- only structural configuration.
 *
 * @param {string} sourceProjectId
 * @param {string} newName - Name for the cloned project
 * @param {string} ownerId - Owner of the new project
 * @returns {Promise<{success: boolean, project?: object, error?: string}>}
 */
async function cloneProject(sourceProjectId, newName, ownerId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get source project
        const { data: source } = await supabase
            .from('projects')
            .select('description, settings')
            .eq('id', sourceProjectId)
            .single();

        if (!source) {
            return { success: false, error: 'Source project not found' };
        }

        // Create new project
        const { data: srcProject } = await supabase
            .from('projects')
            .select('company_id')
            .eq('id', sourceProjectId)
            .single();
        return await createProject({
            name: newName,
            description: source.description,
            ownerId,
            companyId: srcProject?.company_id,
            settings: source.settings
        });
    } catch (error) {
        log.warn({ event: 'projects_clone_error', reason: error?.message }, 'Clone error');
        return { success: false, error: error.message };
    }
}

/**
 * Add or reactivate a custom role in the project's settings.roles array.
 *
 * If a role with the same `name` already exists, it is updated in place
 * and set to `active: true`. Otherwise a new entry is appended with a
 * generated UUID if one is not provided.
 *
 * Roles are stored in the JSONB `settings` column, not in a separate table.
 *
 * @param {string} projectId
 * @param {object} role - { name, [id], ...other fields }
 * @returns {Promise<{success: boolean, roles?: object[], error?: string}>}
 */
async function addProjectRole(projectId, role) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get current settings
        const { data: project } = await supabase
            .from('projects')
            .select('settings')
            .eq('id', projectId)
            .single();

        const currentSettings = project?.settings || {};
        const currentRoles = currentSettings.roles || [];

        // Add new role
        const existingRoleIndex = currentRoles.findIndex(r => r.name === role.name);
        let newRoles;

        if (existingRoleIndex >= 0) {
            // Role exists, update it to be active
            newRoles = [...currentRoles];
            newRoles[existingRoleIndex] = { ...newRoles[existingRoleIndex], ...role, active: true };
        } else {
            newRoles = [...currentRoles, { ...role, id: role.id || crypto.randomUUID(), active: true }];
        }

        // Update settings
        const { error } = await supabase
            .from('projects')
            .update({ settings: { ...currentSettings, roles: newRoles } })
            .eq('id', projectId);

        if (error) throw error;

        log.info({
            event: 'debug_add_role',
            projectId,
            roleName: role.name,
            newRolesCount: newRoles.length,
            wasDuplicate: existingRoleIndex >= 0
        }, 'DEBUG: Role added/updated in DB');

        return { success: true, roles: newRoles };
    } catch (error) {
        log.warn({ event: 'projects_add_role_error', reason: error?.message }, 'Add role error');
        return { success: false, error: error.message };
    }
}

/**
 * Update a role in project settings
 */
async function updateProjectRole(projectId, roleId, updates) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: project } = await supabase
            .from('projects')
            .select('settings')
            .eq('id', projectId)
            .single();

        const currentSettings = project?.settings || {};
        const currentRoles = currentSettings.roles || [];

        const roleIndex = currentRoles.findIndex(r => r.id === roleId);
        if (roleIndex === -1) {
            return { success: false, error: 'Role not found' };
        }

        const updatedRoles = [...currentRoles];
        updatedRoles[roleIndex] = { ...updatedRoles[roleIndex], ...updates };

        const { error } = await supabase
            .from('projects')
            .update({ settings: { ...currentSettings, roles: updatedRoles } })
            .eq('id', projectId);

        if (error) throw error;

        return { success: true, roles: updatedRoles };
    } catch (error) {
        log.warn({ event: 'projects_update_role_error', projectId, roleId, reason: error?.message }, 'Error updating project role');
        return { success: false, error: error.message };
    }
}

module.exports = {
    createProject,
    getProject,
    updateProject,
    deleteProject,
    listUserProjects,
    getProjectStats,
    updateSettings,
    cloneProject,
    addProjectRole,
    updateProjectRole
};
