/**
 * Search Module
 * Unified search across projects, users, comments
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'search' });

/**
 * Search users (for mentions autocomplete)
 */
async function searchUsers(query, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { projectId = null, limit = 10 } = options;

    try {
        const searchTerm = query.toLowerCase();
        
        let userQuery = supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
            .limit(limit);

        // If projectId provided, only search project members
        if (projectId) {
            const { data: memberIds } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', projectId);

            if (memberIds && memberIds.length > 0) {
                const ids = memberIds.map(m => m.user_id);
                userQuery = userQuery.in('id', ids);
            }
        }

        const { data: users, error } = await userQuery;

        if (error) throw error;

        return { success: true, users: users || [] };
    } catch (error) {
        log.error({ event: 'search_users_error', reason: error?.message }, 'Users error');
        return { success: false, error: error.message };
    }
}

/**
 * Search comments
 */
async function searchComments(query, projectId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { limit = 20, offset = 0 } = options;

    try {
        const { data: comments, error, count } = await supabase
            .from('comments')
            .select(`
                *,
                author:user_profiles!author_id(id, username, display_name, avatar_url)
            `, { count: 'exact' })
            .eq('project_id', projectId)
            .ilike('content', `%${query}%`)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return { 
            success: true, 
            comments: comments || [],
            total: count
        };
    } catch (error) {
        log.error({ event: 'search_comments_error', reason: error?.message }, 'Comments error');
        return { success: false, error: error.message };
    }
}

/**
 * Search projects (for user's accessible projects)
 */
async function searchProjects(query, userId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { limit = 10 } = options;

    try {
        // Get user's project IDs
        const { data: memberships } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', userId);

        if (!memberships || memberships.length === 0) {
            return { success: true, projects: [] };
        }

        const projectIds = memberships.map(m => m.project_id);

        const { data: projects, error } = await supabase
            .from('projects')
            .select('id, name, description, created_at')
            .in('id', projectIds)
            .ilike('name', `%${query}%`)
            .limit(limit);

        if (error) throw error;

        return { success: true, projects: projects || [] };
    } catch (error) {
        log.error({ event: 'search_projects_error', reason: error?.message }, 'Projects error');
        return { success: false, error: error.message };
    }
}

/**
 * Global search across multiple types
 */
async function globalSearch(query, userId, projectId = null, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { 
        includeUsers = true,
        includeComments = true,
        includeProjects = true,
        limit = 5 
    } = options;

    try {
        const results = {
            users: [],
            comments: [],
            projects: []
        };

        // Parallel searches
        const promises = [];

        if (includeUsers) {
            promises.push(
                searchUsers(query, { projectId, limit }).then(r => {
                    if (r.success) results.users = r.users;
                })
            );
        }

        if (includeComments && projectId) {
            promises.push(
                searchComments(query, projectId, { limit }).then(r => {
                    if (r.success) results.comments = r.comments;
                })
            );
        }

        if (includeProjects) {
            promises.push(
                searchProjects(query, userId, { limit }).then(r => {
                    if (r.success) results.projects = r.projects;
                })
            );
        }

        await Promise.all(promises);

        return { success: true, results };
    } catch (error) {
        log.error({ event: 'search_global_error', reason: error?.message }, 'Global error');
        return { success: false, error: error.message };
    }
}

/**
 * Get mention suggestions (optimized for typing)
 */
async function getMentionSuggestions(prefix, projectId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get project members
        const { data: members, error } = await supabase
            .from('project_members')
            .select(`
                user:user_profiles!user_id(id, username, display_name, avatar_url)
            `)
            .eq('project_id', projectId);

        if (error) throw error;

        // Filter by prefix
        const searchTerm = prefix.toLowerCase();
        const suggestions = (members || [])
            .map(m => m.user)
            .filter(u => u && (
                u.username?.toLowerCase().startsWith(searchTerm) ||
                u.display_name?.toLowerCase().includes(searchTerm)
            ))
            .slice(0, 8);

        return { success: true, suggestions };
    } catch (error) {
        log.error({ event: 'search_mention_suggestions_error', reason: error?.message }, 'Mention suggestions error');
        return { success: false, error: error.message };
    }
}

module.exports = {
    searchUsers,
    searchComments,
    searchProjects,
    globalSearch,
    getMentionSuggestions
};
