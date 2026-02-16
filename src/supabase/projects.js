/**
 * Projects Module
 * Full project lifecycle management in Supabase
 */

const drive = require('../integrations/googleDrive/drive');
const { logger } = require('../logger');
const { getAdminClient } = require('./client');
const crypto = require('crypto');

const log = logger.child({ module: 'projects' });

/**
 * Create a new project
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
 * Delete project
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
 * Get project statistics
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
 * Clone a project (copy settings, not content)
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
 * Add a role to project settings
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
