/**
 * Project Members Module
 * Handles project membership and permissions
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'members' });

/**
 * Get all members of a project
 * @param {string} projectId 
 * @returns {Promise<{success: boolean, members?: object[], error?: string}>}
 */
async function getProjectMembers(projectId) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    try {
        // First try with linked_contact_id (if migration was run)
        let data, error;

        const fullQuery = await admin
            .from('project_members')
            .select(`
                user_id,
                role,
                user_role,
                user_role_prompt,
                linked_contact_id,
                joined_at,
                invited_by,
                user_profiles!project_members_user_id_fkey (
                    username,
                    display_name,
                    avatar_url,
                    role
                ),
                contacts:linked_contact_id (
                    id,
                    name,
                    email,
                    organization,
                    role,
                    timezone,
                    avatar_url,
                    photo_url
                )
            `)
            .eq('project_id', projectId)
            .order('joined_at', { ascending: true });

        if (fullQuery.error && fullQuery.error.message.includes('linked_contact_id')) {
            // Fallback: query without linked_contact_id (migration not run yet)
            log.debug({ event: 'members_fallback_query' }, 'Fallback query without linked_contact_id');
            const basicQuery = await admin
                .from('project_members')
                .select(`
                    user_id,
                    role,
                    user_role,
                    user_role_prompt,
                    joined_at,
                    invited_by,
                    user_profiles!project_members_user_id_fkey (
                        username,
                        display_name,
                        avatar_url,
                        role
                    )
                `)
                .eq('project_id', projectId)
                .order('joined_at', { ascending: true });

            data = basicQuery.data;
            error = basicQuery.error;
        } else {
            data = fullQuery.data;
            error = fullQuery.error;
        }

        if (error) {
            log.warn({ event: 'members_query_error', reason: error.message }, 'Query error');
            return { success: false, error: error.message };
        }

        const members = (data || []).map(m => ({
            user_id: m.user_id,
            role: m.role,
            user_role: m.user_role,
            user_role_prompt: m.user_role_prompt,
            linked_contact_id: m.linked_contact_id || null,
            linked_contact: m.contacts ? {
                id: m.contacts.id,
                name: m.contacts.name,
                email: m.contacts.email,
                organization: m.contacts.organization,
                role: m.contacts.role,
                timezone: m.contacts.timezone,
                avatar_url: m.contacts.avatar_url,
                photo_url: m.contacts.photo_url
            } : null,
            joined_at: m.joined_at,
            invited_by: m.invited_by,
            username: m.user_profiles?.username,
            display_name: m.user_profiles?.display_name,
            avatar_url: m.user_profiles?.avatar_url,
            is_superadmin: m.user_profiles?.role === 'superadmin'
        }));

        // Fetch team_profiles (contacts added to team without user account)
        const { data: teamProfiles, error: tpError } = await admin
            .from('team_profiles')
            .select(`
                contact_id,
                profile_data,
                created_at,
                contacts (
                    id,
                    name,
                    email,
                    organization,
                    role,
                    timezone,
                    avatar_url,
                    photo_url
                )
            `)
            .eq('project_id', projectId);

        if (tpError) {
            log.warn({ event: 'team_profiles_query_error', reason: tpError.message }, 'Team profiles query error');
        } else if (teamProfiles && teamProfiles.length > 0) {
            const contactMembers = teamProfiles.map(tp => {
                // Check if this contact is already linked to a real user member
                const isLinked = members.some(m => m.linked_contact_id === tp.contact_id);
                if (isLinked) return null;

                const contact = tp.contacts;
                const roleData = tp.profile_data || {};

                return {
                    user_id: `contact:${tp.contact_id}`, // Placeholder ID
                    role: 'read', // Default role for contacts
                    user_role: roleData.role || contact?.role || 'Member',
                    user_role_prompt: roleData.responsibilities || '',
                    linked_contact_id: tp.contact_id,
                    linked_contact: contact ? {
                        id: contact.id,
                        name: contact.name,
                        email: contact.email,
                        organization: contact.organization,
                        role: contact.role,
                        timezone: contact.timezone,
                        avatar_url: contact.avatar_url,
                        photo_url: contact.photo_url
                    } : null,
                    joined_at: tp.created_at || new Date().toISOString(),
                    invited_by: null,
                    username: contact?.email || null,
                    display_name: contact?.name || 'Unknown Contact',
                    avatar_url: contact?.avatar_url || contact?.photo_url,
                    is_superadmin: false,
                    is_contact_only: true // Flag to identify these members
                };
            }).filter(Boolean);

            members.push(...contactMembers);
        }

        return { success: true, members };

    } catch (err) {
        log.warn({ event: 'members_query_exception', reason: err.message }, 'Query exception');
        return { success: false, error: err.message };
    }
}

/**
 * Get a user's role in a project
 * @param {string} projectId 
 * @param {string} userId 
 * @returns {Promise<{success: boolean, role?: string, error?: string}>}
 */
async function getMemberRole(projectId, userId) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    try {
        // First check if user is project owner
        const { data: project } = await admin
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .single();

        if (project?.owner_id === userId) {
            return { success: true, role: 'owner' };
        }

        // Check membership
        const { data: member, error } = await admin
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            return { success: false, error: error.message };
        }

        // Check if user is superadmin
        const { data: profile } = await admin
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profile?.role === 'superadmin') {
            return { success: true, role: 'superadmin', isSuperAdmin: true };
        }

        return {
            success: true,
            role: member?.role || 'none'
        };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Add a member to a project
 * @param {object} params
 * @param {string} params.projectId
 * @param {string} params.userId - User to add
 * @param {string} params.role - Role to assign
 * @param {string} params.invitedBy - User who added them
 * @returns {Promise<{success: boolean, member?: object, error?: string}>}
 */
async function addMember({ projectId, userId, role, invitedBy }) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    if (!['admin', 'write', 'read'].includes(role)) {
        return { success: false, error: 'Invalid role' };
    }

    try {
        const { data, error } = await admin
            .from('project_members')
            .insert({
                project_id: projectId,
                user_id: userId,
                role: role,
                invited_by: invitedBy
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return { success: false, error: 'User is already a member' };
            }
            return { success: false, error: error.message };
        }

        return { success: true, member: data };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Update a member's role
 * @param {string} projectId 
 * @param {string} userId 
 * @param {string} newRole 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateMemberRole(projectId, userId, newRole) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    if (!['admin', 'write', 'read'].includes(newRole)) {
        return { success: false, error: 'Invalid role' };
    }

    try {
        // Check if trying to change owner
        const { data: project } = await admin
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .single();

        if (project?.owner_id === userId) {
            return { success: false, error: 'Cannot change owner role. Use transfer ownership instead.' };
        }

        const { error } = await admin
            .from('project_members')
            .update({ role: newRole })
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Remove a member from a project
 * @param {string} projectId 
 * @param {string} userId 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function removeMember(projectId, userId) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    try {
        // Check if trying to remove owner
        const { data: project } = await admin
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .single();

        if (project?.owner_id === userId) {
            return { success: false, error: 'Cannot remove project owner' };
        }

        // Check if it's a contact-only member
        if (userId.startsWith('contact:')) {
            const contactId = userId.replace('contact:', '');
            const { error } = await admin
                .from('team_profiles')
                .delete()
                .eq('project_id', projectId)
                .eq('contact_id', contactId);

            if (error) return { success: false, error: error.message };
            return { success: true };
        }

        // Regular member (user) - Try removing from project_members
        const { error: memberError } = await admin
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (memberError) {
            return { success: false, error: memberError.message };
        }

        // Also try removing from team_profiles (if it was a contact)
        // We do this regardless of memberError because the user might be in one or the other
        // and we want to ensure they are gone.
        const { error: profileError } = await admin
            .from('team_profiles')
            .delete()
            .eq('project_id', projectId)
            .eq('contact_id', userId); // userId passed from frontend is contact_id for contacts

        if (profileError) {
            // log warning but don't fail if they were removed from project_members
            // However, if they weren't in project_members, this might be the only error.
            // But usually deleting non-existent rows isn't an error.
            if (!memberError) {
                // If we successfully checked project_members (even if 0 rows), 
                // and team_profiles failed, it might be a DB issue.
                // But strictly speaking, if we want to return success if *something* was removed...
                // Actually, delete returns success even if 0 rows.
            }
            return { success: false, error: profileError.message };
        }

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Transfer project ownership
 * @param {string} projectId 
 * @param {string} currentOwnerId 
 * @param {string} newOwnerId 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function transferOwnership(projectId, currentOwnerId, newOwnerId) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    try {
        // Verify current owner
        const { data: project } = await admin
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .single();

        if (project?.owner_id !== currentOwnerId) {
            return { success: false, error: 'Only the owner can transfer ownership' };
        }

        // Check if new owner is a member
        const { data: newOwnerMember } = await admin
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', newOwnerId)
            .single();

        if (!newOwnerMember) {
            return { success: false, error: 'New owner must be a project member' };
        }

        // Update project owner
        await admin
            .from('projects')
            .update({ owner_id: newOwnerId })
            .eq('id', projectId);

        // Update member roles
        await admin
            .from('project_members')
            .update({ role: 'owner' })
            .eq('project_id', projectId)
            .eq('user_id', newOwnerId);

        await admin
            .from('project_members')
            .update({ role: 'admin' })
            .eq('project_id', projectId)
            .eq('user_id', currentOwnerId);

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get all projects a user is a member of
 * @param {string} userId 
 * @returns {Promise<{success: boolean, projects?: object[], error?: string}>}
 */
async function getUserProjects(userId) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };

    try {
        const { data, error } = await admin
            .from('project_members')
            .select(`
                role,
                joined_at,
                projects (
                    id,
                    name,
                    description,
                    owner_id,
                    created_at
                )
            `)
            .eq('user_id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        const projects = (data || []).map(m => ({
            id: m.projects.id,
            name: m.projects.name,
            description: m.projects.description,
            owner_id: m.projects.owner_id,
            created_at: m.projects.created_at,
            my_role: m.role,
            joined_at: m.joined_at,
            is_owner: m.projects.owner_id === userId
        }));

        return { success: true, projects };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    getProjectMembers,
    getMemberRole,
    addMember,
    updateMemberRole,
    removeMember,
    transferOwnership,
    getUserProjects
};
