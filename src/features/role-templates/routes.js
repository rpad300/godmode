/**
 * Role Templates feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/role-templates - List role templates
 * - POST /api/role-templates - Create role template
 * - PUT /api/role-templates/:id - Update role template
 * - DELETE /api/role-templates/:id - Delete role template
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Handle role templates routes
 * @param {object} ctx - Context with req, res, pathname, supabase
 * @returns {Promise<boolean>} - true if handled
 */
async function handleRoleTemplates(ctx) {
    const { req, res, pathname, supabase } = ctx;
    const log = getLogger().child({ module: 'role-templates' });
    if (!pathname.startsWith('/api/role-templates')) return false;

    // GET /api/role-templates - List role templates
    if (pathname === '/api/role-templates' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { data: roles, error } = await client
                    .from('role_templates')
                    .select('*')
                    .order('category', { ascending: true })
                    .order('display_name', { ascending: true });
                if (error) {
                    log.warn({ event: 'role_templates_list_error', reason: error.message }, 'Error listing role templates');
                    jsonResponse(res, { roles: [] });
                    return true;
                }
                jsonResponse(res, { roles: roles || [] });
            } else {
                jsonResponse(res, { roles: [] });
            }
        } catch (e) {
            log.warn({ event: 'role_templates_list_error', reason: e.message }, 'Error listing role templates');
            jsonResponse(res, { roles: [] });
        }
        return true;
    }

    // POST /api/role-templates - Create role template
    if (pathname === '/api/role-templates' && req.method === 'POST') {
        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }
            const body = await parseBody(req);
            const client = supabase.getAdminClient();
            const roleData = {
                name: body.name,
                display_name: body.display_name || body.name,
                description: body.description || null,
                role_context: body.role_context || null,
                category: body.category || 'custom',
                color: body.color || '#e11d48',
                permissions: body.permissions || [],
                is_template: body.is_template || false,
                is_system: false
            };
            const { data, error } = await client.from('role_templates').insert(roleData).select().single();
            if (error) {
                log.warn({ event: 'role_templates_create_error', reason: error.message }, 'Error creating role template');
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }
            jsonResponse(res, { success: true, role: data });
        } catch (e) {
            log.warn({ event: 'role_templates_create_error', reason: e.message }, 'Error creating role template');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/role-templates/:id - Update role template
    const putMatch = pathname.match(/^\/api\/role-templates\/([^/]+)$/);
    if (putMatch && req.method === 'PUT') {
        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }
            const roleId = putMatch[1];
            const body = await parseBody(req);
            const client = supabase.getAdminClient();
            const updateData = { updated_at: new Date().toISOString() };
            if (body.name !== undefined) updateData.name = body.name;
            if (body.display_name !== undefined) updateData.display_name = body.display_name;
            if (body.description !== undefined) updateData.description = body.description;
            if (body.role_context !== undefined) updateData.role_context = body.role_context;
            if (body.category !== undefined) updateData.category = body.category;
            if (body.color !== undefined) updateData.color = body.color;
            if (body.permissions !== undefined) updateData.permissions = body.permissions;
            if (body.is_template !== undefined) updateData.is_template = body.is_template;

            const { data, error } = await client.from('role_templates').update(updateData).eq('id', roleId).select().single();
            if (error) {
                log.warn({ event: 'role_templates_update_error', reason: error.message }, 'Error updating role template');
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }
            jsonResponse(res, { success: true, role: data });
        } catch (e) {
            log.warn({ event: 'role_templates_update_error', reason: e.message }, 'Error updating role template');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/role-templates/:id - Delete role template
    const deleteMatch = pathname.match(/^\/api\/role-templates\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }
            const roleId = deleteMatch[1];
            const client = supabase.getAdminClient();
            const { data: existing } = await client.from('role_templates').select('is_system').eq('id', roleId).single();
            if (existing?.is_system) {
                jsonResponse(res, { error: 'Cannot delete system role' }, 400);
                return true;
            }
            const { error } = await client.from('role_templates').delete().eq('id', roleId);
            if (error) {
                log.warn({ event: 'role_templates_delete_error', reason: error.message }, 'Error deleting role template');
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }
            jsonResponse(res, { success: true });
        } catch (e) {
            log.warn({ event: 'role_templates_delete_error', reason: e.message }, 'Error deleting role template');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleRoleTemplates };
