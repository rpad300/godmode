/**
 * Projects feature routes
 * Extracted from server.js
 *
 * Handles:
 * - handleProjectMembers: /api/projects/:id/members
 * - handleProjects: CRUD, activate, config, stats, export, import
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { parseBody, parseMultipart } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');

async function pathExists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
}
const { jsonResponse } = require('../../server/response');
const { isValidUUID } = require('../../server/security');

/**
 * Handle project member routes
 * @param {object} ctx - Context object with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled, false if not a handled route
 */
async function handleProjectMembers(ctx) {
    const { req, res, pathname, supabase } = ctx;
    const log = getLogger().child({ module: 'projects-members' });
    // GET /api/projects/:id/members - Get project members
    if (pathname.match(/^\/api\/projects\/([^/]+)\/members$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        if (!supabase.members || typeof supabase.members.getProjectMembers !== 'function') {
            jsonResponse(res, { members: [] });
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/members$/)[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        try {
            const result = await supabase.members.getProjectMembers(projectId);
            if (result.success) {
                jsonResponse(res, { members: result.members });
            } else {
                jsonResponse(res, { members: [], error: result.error });
            }
        } catch (err) {
            log.warn({ event: 'members_fetch_error', projectId, err: err.message }, 'getProjectMembers failed');
            jsonResponse(res, { members: [] });
        }
        return true;
    }

    // GET /api/projects/:id/roles - Get project roles
    if (pathname.match(/^\/api\/projects\/([^/]+)\/roles$/) && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/roles$/)[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }

        try {
            const client = supabase.getAdminClient();
            // Get roles from settings
            const { data: project, error } = await client
                .from('projects')
                .select('settings')
                .eq('id', projectId)
                .single();

            if (error) {
                log.warn({ event: 'roles_fetch_error', projectId, err: error.message }, 'Error fetching roles');
                jsonResponse(res, { roles: [] });
            } else {
                const roles = project?.settings?.roles || [];
                jsonResponse(res, { roles });
            }
        } catch (err) {
            log.warn({ event: 'roles_fetch_error', projectId, err: err.message }, 'Error fetching roles');
            jsonResponse(res, { roles: [] });
        }
        return true;
    }

    // POST /api/projects/:id/roles - Add new role
    if (pathname.match(/^\/api\/projects\/([^/]+)\/roles$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/roles$/)[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }

        const body = await parseBody(req);
        if (!body.name) {
            jsonResponse(res, { error: 'Role name is required' }, 400);
            return true;
        }

        try {
            // Use supabase.projects.addProjectRole which we added
            if (supabase.projects && typeof supabase.projects.addProjectRole === 'function') {
                const result = await supabase.projects.addProjectRole(projectId, body);
                if (result.success) {
                    jsonResponse(res, { success: true, roles: result.roles });
                } else {
                    jsonResponse(res, { error: result.error }, 400);
                }
            } else {
                // Fallback if function not exposed on supabase object (should be if we required it in server.js/client.js correctly)
                // But wait, supabase object in ctx is constructed in server.js.
                // We need to ensuring projects module is attached to supabase object in server.js
                jsonResponse(res, { error: 'addProjectRole not implemented' }, 501);
            }
        } catch (err) {
            log.warn({ event: 'roles_add_error', projectId, err: err.message }, 'Error adding role');
            jsonResponse(res, { error: err.message }, 500);
        }
        return true;
    }

    // PUT /api/projects/:id/roles/:roleId - Update role
    if (pathname.match(/^\/api\/projects\/([^/]+)\/roles\/([^/]+)$/) && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const match = pathname.match(/^\/api\/projects\/([^/]+)\/roles\/([^/]+)$/);
        const projectId = match[1];
        const roleId = match[2];

        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }

        const body = await parseBody(req);

        try {
            if (supabase.projects && typeof supabase.projects.updateProjectRole === 'function') {
                const result = await supabase.projects.updateProjectRole(projectId, roleId, body);
                if (result.success) {
                    jsonResponse(res, { success: true, roles: result.roles });
                } else {
                    jsonResponse(res, { error: result.error }, 400);
                }
            } else {
                jsonResponse(res, { error: 'updateProjectRole not implemented' }, 501);
            }
        } catch (err) {
            log.warn({ event: 'roles_update_error', projectId, roleId, err: err.message }, 'Error updating role');
            jsonResponse(res, { error: err.message }, 500);
        }
        return true;
    }

    // PUT /api/projects/:id/members/:userId - Update member role and/or user_role
    if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/) && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const match = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
        const projectId = match[1];
        const userId = match[2];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }

        // userId can be a UUID or "contact:<UUID>"
        const isContactId = userId.startsWith('contact:');
        const cleanUserId = isContactId ? userId.replace('contact:', '') : userId;

        if (!isValidUUID(cleanUserId)) {
            jsonResponse(res, { error: 'Invalid user ID or contact ID' }, 400);
            return true;
        }
        const body = await parseBody(req);

        try {
            const client = supabase.getAdminClient();

            // Build update object
            const updates = {};
            if (body.role !== undefined) {
                updates.role = body.role;
            }
            if (body.user_role !== undefined) {
                updates.user_role = body.user_role || null;
            }
            if (body.user_role_prompt !== undefined) {
                updates.user_role_prompt = body.user_role_prompt || null;
            }
            if (body.linked_contact_id !== undefined) {
                updates.linked_contact_id = body.linked_contact_id || null;
            }
            if (body.permissions !== undefined) {
                updates.permissions = body.permissions || [];
            }

            if (Object.keys(updates).length === 0) {
                jsonResponse(res, { success: true, message: 'No changes' });
                return true;
            }

            if (userId.startsWith('contact:')) {
                const contactId = userId.replace('contact:', '');

                // For contacts, we update the role in profile_data
                // First get existing profile data
                const { data: profile } = await client
                    .from('team_profiles')
                    .select('profile_data')
                    .eq('project_id', projectId)
                    .eq('contact_id', contactId)
                    .single();

                if (profile) {
                    const newProfileData = {
                        ...(profile.profile_data || {}),
                        role: updates.user_role || updates.role || profile.profile_data?.role
                    };

                    const { error } = await client
                        .from('team_profiles')
                        .update({ profile_data: newProfileData })
                        .eq('project_id', projectId)
                        .eq('contact_id', contactId);

                    if (error) throw error;
                }
            } else {
                // Regular user update
                const { error } = await client
                    .from('project_members')
                    .update(updates)
                    .eq('project_id', projectId)
                    .eq('user_id', userId);

                if (error) throw error;
            }



            jsonResponse(res, { success: true });
        } catch (e) {
            log.warn({ event: 'projects_member_update_error', reason: e.message }, 'Error updating member');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/projects/:id/members/:userId/permissions - Update member permissions
    if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)\/permissions$/) && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const match = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)\/permissions$/);
        const projectId = match[1];
        const userId = match[2];
        if (!isValidUUID(projectId) || !isValidUUID(userId)) {
            jsonResponse(res, { error: 'Invalid project ID or user ID: must be UUIDs' }, 400);
            return true;
        }
        const body = await parseBody(req);

        try {
            const client = supabase.getAdminClient();

            const updates = {};

            if (body.role !== undefined) {
                updates.role = body.role;
            }
            if (body.user_role !== undefined) {
                updates.user_role = body.user_role;
            }
            if (body.permissions !== undefined) {
                updates.permissions = body.permissions || [];
            }

            if (Object.keys(updates).length === 0) {
                jsonResponse(res, { success: true, message: 'No changes' });
                return true;
            }

            const { error } = await client
                .from('project_members')
                .update(updates)
                .eq('project_id', projectId)
                .eq('user_id', userId);

            if (error) {
                log.warn({ event: 'projects_member_permissions_error', reason: error.message }, 'Error updating member permissions');
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }

            jsonResponse(res, { success: true });
        } catch (e) {
            log.warn({ event: 'projects_member_permissions_error', reason: e.message }, 'Error updating member permissions');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/projects/:id/members/add-contact - Add contact as team member (for analysis)
    if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/add-contact$/) && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/members\/add-contact$/)[1];
        const body = await parseBody(req);

        if (!body.contact_id) {
            jsonResponse(res, { error: 'contact_id is required' }, 400);
            return true;
        }

        try {
            const client = supabase.getAdminClient();

            // Verify contact exists
            const { data: contact, error: contactError } = await client
                .from('contacts')
                .select('id, name, role, organization, email')
                .eq('id', body.contact_id)
                .single();

            if (contactError || !contact) {
                jsonResponse(res, { error: 'Contact not found' }, 404);
                return true;
            }

            // Link contact to project if not already linked
            const { error: linkError } = await client
                .from('contact_projects')
                .upsert({
                    contact_id: body.contact_id,
                    project_id: projectId
                }, {
                    onConflict: 'contact_id,project_id',
                    ignoreDuplicates: true
                });

            if (linkError) {
                log.debug({ event: 'projects_contact_link_note', reason: linkError.message }, 'contact_projects link (may already exist)');
            }

            // Check if team_profile already exists
            const { data: existingProfile } = await client
                .from('team_profiles')
                .select('id')
                .eq('project_id', projectId)
                .eq('contact_id', body.contact_id)
                .single();

            if (!existingProfile) {
                // Create team_profile for this contact (ready for analysis)
                const { error: profileError } = await client
                    .from('team_profiles')
                    .insert({
                        project_id: projectId,
                        contact_id: body.contact_id,
                        person_name: contact.name,
                        profile_data: {
                            role: contact.role || 'Unknown',
                            organization: contact.organization,
                            added_manually: true,
                            pending_analysis: true
                        },
                        influence_score: 50,
                        risk_level: 'medium',
                        transcripts_analyzed: [],
                        last_analyzed_at: null
                    });

                if (profileError) {
                    log.warn({ event: 'projects_team_profile_create_error', reason: profileError.message }, 'Error creating team profile');
                    jsonResponse(res, { error: profileError.message }, 400);
                    return true;
                }

                log.debug({ event: 'projects_team_profile_created', contactName: contact.name, projectId }, 'Created team profile');
            } else {
                log.debug({ event: 'projects_team_profile_exists', contactName: contact.name }, 'Team profile already exists');
            }

            jsonResponse(res, {
                success: true,
                message: `${contact.name} added to team`,
                contact: contact
            });
        } catch (e) {
            log.warn({ event: 'projects_contact_add_error', reason: e.message }, 'Error adding contact to team');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/projects/:id/members/:userId - Remove member
    if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }

        const match = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
        const projectId = match[1];
        const userId = match[2];

        const result = await supabase.members.removeMember(projectId, userId);

        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }

    // Not a route we handle
    return false;
}

/**
 * Handle project core routes (CRUD, activate, config, stats, export, import)
 * @param {object} ctx - Context with req, res, pathname, supabase, storage, config, saveConfig, processor, invalidateBriefingCache
 * @returns {Promise<boolean>} - true if handled
 */
async function handleProjects({ req, res, pathname, supabase, storage, config, saveConfig, processor, invalidateBriefingCache }) {
    const log = require('../../logger').logger.child({ module: 'projects' });
    // GET /api/user/projects - List user's projects (Supabase)
    if (pathname === '/api/user/projects' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const result = await supabase.projects.listForUser(userResult.user.id);
        if (result.success) jsonResponse(res, { projects: result.projects });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/supabase-projects - Create project in Supabase
    if (pathname === '/api/supabase-projects' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const body = await parseBody(req);
        const companyId = body.company_id || body.companyId;
        if (!companyId) {
            jsonResponse(res, { error: 'Company is required (company_id)' }, 400);
            return true;
        }
        const result = await supabase.projects.create({
            name: body.name,
            description: body.description,
            ownerId: userResult.user.id,
            companyId,
            settings: body.settings
        });
        if (result.success) jsonResponse(res, { success: true, project: result.project });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/projects - List projects
    if (pathname === '/api/projects' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                console.log('DEBUG: Supabase is configured, verifying request...');
                const authResult = await supabase.auth.verifyRequest(req);
                console.log('DEBUG: Verify result:', { authenticated: authResult.authenticated, user: authResult.user?.id, error: authResult.error });

                if (authResult.authenticated) {
                    const userId = authResult.user.id;
                    const client = supabase.getAdminClient();
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(userId);
                    if (isSuperAdmin) {
                        console.log('DEBUG: Handling GET /api/projects for SUPERADMIN');
                        const { data: allProjects, error } = await client.from('projects').select('*').order('name', { ascending: true });
                        if (error) {
                            console.error('DEBUG: Error listing all projects', error);
                            jsonResponse(res, { projects: [] });
                            return true;
                        }

                        // DEBUG LOGGING SUPER ADMIN
                        if (allProjects && allProjects.length > 0) {
                            const debugProj = allProjects.find(p => p.id === '0c82618c-7e1a-4e41-87cf-22643e148715'); // specific project
                            if (debugProj) {
                                console.log('DEBUG: Found specific project', {
                                    id: debugProj.id,
                                    hasSettings: !!debugProj.settings,
                                    rolesCount: debugProj.settings?.roles?.length
                                });
                            } else {
                                console.log('DEBUG: Specific project NOT FOUND in list', allProjects.map(p => p.id));
                            }
                        } else {
                            console.log('DEBUG: No projects found for SuperAdmin');
                        }

                        jsonResponse(res, { projects: allProjects || [] });
                        return true;
                    }

                    console.log('DEBUG: Handling GET /api/projects for Regular Member');
                    const { data: memberProjects, error } = await client
                        .from('project_members')
                        .select('project_id, role, user_role, projects:project_id (id, name, description, status, created_at, updated_at, company_id, settings, company:companies(id, name, logo_url, brand_assets))')
                        .eq('user_id', userId);
                    if (error) {
                        log.warn({ event: 'projects_list_user_error', reason: error.message }, 'Error listing user projects');
                        jsonResponse(res, { projects: [] });
                        return true;
                    }
                    const projects = (memberProjects || [])
                        .filter(m => m.projects)
                        .map(m => ({ ...m.projects, member_role: m.role, user_role: m.user_role }))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    // DEBUG LOGGING
                    if (projects.length > 0) {
                        const debugProj = projects.find(p => p.id === '0c82618c-7e1a-4e41-87cf-22643e148715'); // specific project
                        if (debugProj) {
                            log.info({
                                event: 'debug_projects_get',
                                projectId: debugProj.id,
                                hasSettings: !!debugProj.settings,
                                rolesCount: debugProj.settings?.roles?.length,
                                roles: debugProj.settings?.roles
                            }, 'DEBUG: GET /api/projects response for specific project');
                        }
                    }

                    jsonResponse(res, { projects });
                    return true;
                }
            }
            console.log('DEBUG: Falling back to storage.listProjects() (Not authenticated or not configured)');
            const projects = await storage.listProjects();
            console.log('DEBUG: storage.listProjects returned count:', projects?.length);
            jsonResponse(res, { projects: projects || [] });
        } catch (e) {
            log.warn({ event: 'projects_list_error', reason: e.message }, 'Error listing projects');
            jsonResponse(res, { projects: [] });
        }
        return true;
    }

    // POST /api/projects - Create project
    if (pathname === '/api/projects' && req.method === 'POST') {
        // Authenticate user
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success || !userResult.user) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }

        const body = await parseBody(req);
        const name = body.name;
        const userRole = body.userRole || '';
        const companyId = body.company_id || body.companyId || null;
        if (!name || name.trim().length === 0) {
            jsonResponse(res, { error: 'Project name is required' }, 400);
            return true;
        }
        try {
            const project = await storage.createProject(name.trim(), userRole.trim(), companyId, userResult.user.id, token);
            jsonResponse(res, { success: true, project });
        } catch (e) {
            log.warn({ event: 'projects_create_error', reason: e.message }, 'Error creating project');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/projects/current - Current project
    if (pathname === '/api/projects/current' && req.method === 'GET') {
        try {
            const project = await storage.getCurrentProjectWithRole();
            jsonResponse(res, { project });
        } catch (e) {
            const project = storage.getCurrentProject();
            jsonResponse(res, { project });
        }
        return true;
    }

    // POST /api/projects/deactivate - Deactivate
    if (pathname === '/api/projects/deactivate' && req.method === 'POST') {
        try {
            await storage.switchProject(null, null);
            jsonResponse(res, { success: true });
        } catch (e) {
            log.warn({ event: 'projects_deactivate_error', reason: e.message }, 'Error deactivating project');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/projects/current/role - Update current user role
    if (pathname === '/api/projects/current/role' && req.method === 'PUT') {
        try {
            const body = await parseBody(req);
            const project = storage.getCurrentProject();
            if (!project) {
                jsonResponse(res, { error: 'No current project' }, 400);
                return true;
            }
            const result = await storage.updateMemberRole(project.id, {
                userRole: body.userRole,
                userRolePrompt: body.userRolePrompt,
                roleTemplateId: body.roleTemplateId
            });
            invalidateBriefingCache();
            jsonResponse(res, { success: true, userRole: result.userRole, userRolePrompt: result.userRolePrompt, roleTemplateId: result.roleTemplateId });
        } catch (e) {
            log.warn({ event: 'projects_member_role_error', reason: e.message }, 'Error updating member role');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/projects/:id - Get project (exclude "current" and sub-routes)
    const projectIdMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectIdMatch && req.method === 'GET') {
        const projectId = projectIdMatch[1];
        if (projectId === 'current') return false; // Handled above
        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { data: project, error } = await client.from('projects').select('*').eq('id', projectId).single();
                if (error) {
                    jsonResponse(res, { error: 'Project not found' }, 404);
                    return true;
                }
                jsonResponse(res, { project });
                return true;
            }
            const projects = await storage.listProjects();
            const project = projects.find(p => p.id === projectId);
            if (project) jsonResponse(res, { project });
            else jsonResponse(res, { error: 'Project not found' }, 404);
        } catch (e) {
            log.warn({ event: 'projects_get_error', reason: e.message }, 'Error getting project');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/projects/:id/config
    const configGetMatch = pathname.match(/^\/api\/projects\/([^/]+)\/config$/);
    if (configGetMatch && req.method === 'GET') {
        const projectId = configGetMatch[1];
        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { data: cfg, error } = await client.from('project_config').select('*').eq('project_id', projectId).single();
                if (error && error.code !== 'PGRST116') log.warn({ event: 'projects_config_get_error', reason: error.message }, 'Error getting project config');
                jsonResponse(res, { config: cfg || { project_id: projectId } });
                return true;
            }
            jsonResponse(res, { config: { project_id: projectId } });
        } catch (e) {
            log.warn({ event: 'projects_config_get_error', reason: e.message }, 'Error getting project config');
            jsonResponse(res, { config: { project_id: projectId } });
        }
        return true;
    }

    // PUT /api/projects/:id/config
    const configPutMatch = pathname.match(/^\/api\/projects\/([^/]+)\/config$/);
    if (configPutMatch && req.method === 'PUT') {
        const projectId = configPutMatch[1];
        const body = await parseBody(req);
        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { error } = await client.from('project_config').upsert({
                    project_id: projectId,
                    llm_config: body.llm_config || {},
                    ollama_config: body.ollama_config || {},
                    prompts: body.prompts || {},
                    processing_settings: body.processing_settings || {},
                    ui_preferences: body.ui_preferences || {},
                    updated_at: new Date().toISOString()
                }, { onConflict: 'project_id' });
                if (error) {
                    log.warn({ event: 'projects_config_save_error', reason: error.message }, 'Error saving project config');
                    jsonResponse(res, { error: error.message }, 500);
                    return true;
                }
                jsonResponse(res, { success: true });
                return true;
            }
            jsonResponse(res, { success: true });
        } catch (e) {
            log.warn({ event: 'projects_config_save_error', reason: e.message }, 'Error saving project config');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/projects/:id/stats
    const statsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/stats$/);
    if (statsMatch && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        const projectId = statsMatch[1];
        const result = await supabase.projects.getStats(projectId);
        if (result.success) jsonResponse(res, { stats: result.stats });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // PUT /api/projects/:id/activate
    const activateMatch = pathname.match(/^\/api\/projects\/([^/]+)\/activate$/);
    if (activateMatch && req.method === 'PUT') {
        const projectId = activateMatch[1];
        const success = storage.switchProject(projectId);
        if (success) {
            const project = storage.getCurrentProject();
            const newDataDir = storage.getProjectDataDir();
            processor.updateDataDir(newDataDir);
            config.dataDir = newDataDir;
            saveConfig(config);
            storage.recordDailyStats();
            let projectGraphConfig = null;
            if (supabase) {
                try {
                    const client = supabase.getAdminClient();
                    const { data: projectConfig } = await client.from('project_config').select('graph_config').eq('project_id', projectId).single();
                    if (projectConfig?.graph_config?.enabled) {
                        projectGraphConfig = projectConfig.graph_config;
                        // Graph password resolved by provider layer
                    }
                } catch (_) { }
            }
            const effectiveGraphConfig = projectGraphConfig || config.graph;
            if (effectiveGraphConfig && effectiveGraphConfig.enabled && effectiveGraphConfig.autoConnect !== false) {
                try {
                    const baseGraphName = effectiveGraphConfig.baseGraphName || effectiveGraphConfig.graphName?.split('_')[0] || 'godmode';
                    const projectGraphName = `${baseGraphName}_${projectId}`;
                    const graphConfig = { ...effectiveGraphConfig, graphName: projectGraphName };
                    const graphResult = await storage.initGraph(graphConfig);
                    if (graphResult.ok) log.debug({ event: 'projects_graph_switched', projectGraphName }, 'Switched to graph');
                } catch (e) { log.warn({ event: 'projects_graph_switch_error', reason: e.message }, 'Error switching graph'); }
            }
            jsonResponse(res, { success: true, project });
        } else {
            jsonResponse(res, { error: 'Project not found' }, 404);
        }
        return true;
    }

    // PUT /api/projects/:id - Update project
    const updateMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (updateMatch && req.method === 'PUT') {
        const projectId = updateMatch[1];
        const body = await parseBody(req);
        const updates = {};
        if (body.name !== undefined) {
            if (!body.name || body.name.trim().length === 0) {
                jsonResponse(res, { error: 'Project name cannot be empty' }, 400);
                return true;
            }
            updates.name = body.name.trim();
        }
        if (body.description !== undefined) updates.description = body.description?.trim() || null;
        if (body.company_id !== undefined) updates.company_id = body.company_id && body.company_id.trim() ? body.company_id.trim() : null;
        if (body.settings !== undefined) updates.settings = body.settings;
        if (body.userRole !== undefined) updates.userRole = body.userRole.trim();
        if (body.userRolePrompt !== undefined) updates.userRolePrompt = body.userRolePrompt.trim();
        if (body.isDefault === true) storage.setDefaultProject(projectId);
        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const supabaseUpdates = { updated_at: new Date().toISOString() };
                if (updates.name) supabaseUpdates.name = updates.name;
                if (updates.description !== undefined) supabaseUpdates.description = updates.description;
                if (updates.company_id !== undefined) supabaseUpdates.company_id = updates.company_id;
                if (updates.settings) {
                    const { data: existing } = await client.from('projects').select('settings').eq('id', projectId).single();
                    supabaseUpdates.settings = { ...(existing?.settings || {}), ...updates.settings };
                }
                const { data: project, error } = await client.from('projects').update(supabaseUpdates).eq('id', projectId).select().single();
                if (error) {
                    log.warn({ event: 'projects_update_error', reason: error.message }, 'Error updating project');
                    jsonResponse(res, { error: error.message }, 500);
                    return true;
                }
                jsonResponse(res, { success: true, project });
                return true;
            }
            const project = await storage.updateProject(projectId, updates);
            if (project) {
                const isDefault = storage.getDefaultProjectId() === projectId;
                jsonResponse(res, { success: true, project: { ...project, isDefault } });
            } else {
                jsonResponse(res, { error: 'Project not found' }, 404);
            }
        } catch (e) {
            log.warn({ event: 'projects_update_error', reason: e.message }, 'Error updating project');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/projects/:id/set-default
    const setDefaultMatch = pathname.match(/^\/api\/projects\/([^/]+)\/set-default$/);
    if (setDefaultMatch && req.method === 'POST') {
        const projectId = setDefaultMatch[1];
        const project = await storage.getProject(projectId);
        if (!project) {
            jsonResponse(res, { error: 'Project not found' }, 404);
            return true;
        }
        storage.setDefaultProject(projectId);
        jsonResponse(res, { success: true, defaultProjectId: projectId, project });
        return true;
    }

    // DELETE /api/projects/:id
    const deleteMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
        const projectId = deleteMatch[1];
        const projects = await storage.listProjects();
        if (projects.length <= 1) {
            jsonResponse(res, { error: 'Cannot delete the last remaining project' }, 400);
            return true;
        }
        const project = await storage.getProject(projectId);
        const success = await storage.deleteProject(projectId);
        if (success) {
            try {
                const { getGraphSync } = require('../../sync');
                const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                await graphSync.onProjectDeleted(projectId, project?.name);
            } catch (syncErr) { log.warn({ event: 'projects_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning'); }
            processor.updateDataDir(storage.getProjectDataDir());
            jsonResponse(res, { success: true, graphSynced: true });
        } else {
            jsonResponse(res, { error: 'Project not found' }, 404);
        }
        return true;
    }

    // GET /api/projects/:id/export
    const exportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
    if (exportMatch && req.method === 'GET') {
        const projectId = exportMatch[1];
        const project = storage.listProjects().find(p => p.id === projectId);
        if (!project) {
            jsonResponse(res, { error: 'Project not found' }, 404);
            return true;
        }
        try {
            const projectDir = storage.getProjectDir(projectId);
            const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                project: { name: project.name, userRole: project.userRole || '' },
                data: {}
            };
            const jsonFiles = ['knowledge.json', 'questions.json', 'documents.json', 'history.json'];
            for (const file of jsonFiles) {
                const filePath = path.join(projectDir, file);
                if (await pathExists(filePath)) {
                    const raw = await fsp.readFile(filePath, 'utf8');
                    exportData.data[file.replace('.json', '')] = JSON.parse(raw);
                }
            }
            const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`;
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(exportData, null, 2));
        } catch (e) {
            logError(e, { event: 'projects_export_error' });
            jsonResponse(res, { error: 'Export failed: ' + e.message }, 500);
        }
        return true;
    }

    // POST /api/projects/import
    if (pathname === '/api/projects/import' && req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            jsonResponse(res, { error: 'Content-Type must be multipart/form-data' }, 400);
            return true;
        }
        try {
            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
            if (!boundaryMatch) {
                jsonResponse(res, { error: 'No boundary found' }, 400);
                return true;
            }
            const boundary = boundaryMatch[1] || boundaryMatch[2];
            const MAX_MULTIPART_BODY = 100 * 1024 * 1024; // 100MB for import file
            const chunks = [];
            let totalBody = 0;
            for await (const chunk of req) {
                totalBody += chunk.length;
                if (totalBody > MAX_MULTIPART_BODY) {
                    jsonResponse(res, { error: 'Request body too large' }, 413);
                    return true;
                }
                chunks.push(chunk);
            }
            const body = Buffer.concat(chunks);
            const parts = parseMultipart(body, boundary);
            if (parts.files.length === 0) {
                jsonResponse(res, { error: 'No file provided' }, 400);
                return true;
            }
            const fileContent = parts.files[0].data.toString('utf8');
            const importData = JSON.parse(fileContent);
            if (!importData.project || !importData.project.name) {
                jsonResponse(res, { error: 'Invalid import file: missing project name' }, 400);
                return true;
            }
            const projectName = importData.project.name + ' (Imported)';
            const newProject = storage.createProject(projectName, importData.project.userRole || '');
            const projectDir = storage.getProjectDir(newProject.id);
            if (importData.data) {
                for (const [key, value] of Object.entries(importData.data)) {
                    await fsp.writeFile(path.join(projectDir, `${key}.json`), JSON.stringify(value, null, 2));
                }
            }
            storage.switchProject(newProject.id);
            jsonResponse(res, { success: true, project: newProject });
        } catch (e) {
            logError(e, { event: 'projects_import_error' });
            jsonResponse(res, { error: 'Import failed: ' + e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleProjectMembers,
    handleProjects
};
