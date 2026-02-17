/**
 * Purpose:
 *   Provides unified search across users, comments, and projects for
 *   use in the global search bar, @mention autocomplete, and filtered
 *   searches within a project context.
 *
 * Responsibilities:
 *   - Search users by username or display_name (optionally scoped to a
 *     project's members)
 *   - Full-text-like search on comment content within a project
 *   - Search projects the current user has access to
 *   - Aggregate all search types into a single globalSearch response
 *   - Provide fast @mention suggestions filtered by prefix and project
 *     membership
 *
 * Key dependencies:
 *   - ./client (getAdminClient): all searches use the service-role client
 *     so results are not filtered by RLS; authorization must be enforced
 *     by the caller
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Read-only queries; no writes
 *
 * Notes:
 *   - All text matching uses Postgres `ilike` (case-insensitive), not
 *     full-text search (tsvector). For large datasets a dedicated search
 *     index would improve performance.
 *   - globalSearch runs individual searches in parallel via Promise.all
 *     and gracefully drops any subset that fails.
 *   - getMentionSuggestions does an in-memory filter after loading all
 *     project members, capped at 8 results.
 *
 * Supabase tables accessed:
 *   - user_profiles: { id, username, display_name, avatar_url }
 *   - project_members: { project_id, user_id } (for scoping)
 *   - comments: { project_id, content, created_at, author_id }
 *     + joined user_profiles for author info
 *   - projects: { id, name, description, created_at }
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'search' });

/**
 * Search users by username or display_name using case-insensitive ilike.
 * Optionally scoped to members of a specific project.
 *
 * @param {string} query - Search term
 * @param {object} [options]
 * @param {string} [options.projectId] - If set, restrict to project members
 * @param {number} [options.limit=10]
 * @returns {Promise<{success: boolean, users?: object[], error?: string}>}
 *   Each user: { id, username, display_name, avatar_url }
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
 * Aggregate search across users, comments, and projects. Runs individual
 * searches in parallel. Any failing sub-search is silently dropped from
 * the result (partial success).
 *
 * @param {string} query - Search term
 * @param {string} userId - Calling user (used to scope project results)
 * @param {string} [projectId] - Optional project scope for comments/users
 * @param {object} [options]
 * @param {boolean} [options.includeUsers=true]
 * @param {boolean} [options.includeComments=true]
 * @param {boolean} [options.includeProjects=true]
 * @param {number} [options.limit=5] - Per-type limit
 * @returns {Promise<{success: boolean, results?: {users, comments, projects}}>}
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
 * Fast @mention autocomplete for a project. Loads all project members
 * then filters in-memory by prefix match on username (startsWith) or
 * display_name (includes). Returns at most 8 suggestions.
 *
 * @param {string} prefix - Characters typed after '@'
 * @param {string} projectId
 * @returns {Promise<{success: boolean, suggestions?: object[]}>}
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
