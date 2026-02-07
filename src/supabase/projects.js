/**
 * Projects Module
 * Full project lifecycle management in Supabase
 */

const { getAdminClient } = require('./client');

/**
 * Create a new project
 */
async function createProject({
    name,
    description = null,
    ownerId,
    settings = {}
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Create project
        const { data: project, error } = await supabase
            .from('projects')
            .insert({
                name,
                description,
                owner_id: ownerId,
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

        return { success: true, project };
    } catch (error) {
        console.error('[Projects] Create error:', error);
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
                owner:user_profiles!owner_id(id, username, display_name, avatar_url)
            `)
            .eq('id', projectId)
            .single();

        if (error) throw error;

        return { success: true, project };
    } catch (error) {
        console.error('[Projects] Get error:', error);
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
        console.error('[Projects] Update error:', error);
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
        console.error('[Projects] Delete error:', error);
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
        console.error('[Projects] List error:', error);
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
        console.error('[Projects] Stats error:', error);
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
        console.error('[Projects] Update settings error:', error);
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
        return await createProject({
            name: newName,
            description: source.description,
            ownerId,
            settings: source.settings
        });
    } catch (error) {
        console.error('[Projects] Clone error:', error);
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
    cloneProject
};
