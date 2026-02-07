/**
 * System Prompts routes (extracted from src/server.js)
 *
 * Non-negotiable: keep runtime behavior identical.
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleSystemPrompts({ req, res, pathname, supabase }) {
    // ==================== System Prompts API ====================

    // GET /api/system/prompts - Get all system prompts
    if (pathname === '/api/system/prompts' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                const admin = supabase.getAdminClient();
                const { data: prompts, error } = await admin
                    .from('system_prompts')
                    .select('id, key, name, description, category, prompt_template, uses_ontology, is_active')
                    .eq('is_active', true)
                    .order('key');

                if (error) {
                    console.error('[API] Error fetching prompts:', error.message);
                    jsonResponse(res, { prompts: [] });
                    return true;
                }

                jsonResponse(res, { prompts: prompts || [] });
                return true;
            }

            jsonResponse(res, { prompts: [] });
        } catch (e) {
            console.error('[API] Error fetching prompts:', e.message);
            jsonResponse(res, { prompts: [] });
        }
        return true;
    }

    // PUT /api/system/prompts/:key - Update a system prompt
    if (pathname.match(/^\/api\/system\/prompts\/([^/]+)$/) && req.method === 'PUT') {
        const key = pathname.match(/^\/api\/system\/prompts\/([^/]+)$/)[1];
        const body = await parseBody(req);

        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }

            // Verify superadmin
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

            const admin = supabase.getAdminClient();
            const { data, error } = await admin
                .from('system_prompts')
                .update({
                    prompt_template: body.prompt_template,
                    updated_at: new Date().toISOString(),
                    updated_by: authResult.user.id
                })
                .eq('key', key)
                .select()
                .single();

            if (error) {
                console.error('[API] Error updating prompt:', error.message);
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }

            // Clear prompts cache
            try {
                const promptsService = require('../../supabase/prompts');
                promptsService.clearCache();
            } catch (e) {
                // Ignore if not available
            }

            jsonResponse(res, { success: true, prompt: data });
        } catch (e) {
            console.error('[API] Error updating prompt:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/prompts/:key/versions - Get version history for a prompt
    if (pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions$/) && req.method === 'GET') {
        const key = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions$/)[1];

        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { versions: [] });
                return true;
            }

            // Verify superadmin
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

            const admin = supabase.getAdminClient();

            // Get current version info
            const { data: currentPrompt } = await admin
                .from('system_prompts')
                .select('id, version, updated_at')
                .eq('key', key)
                .single();

            if (!currentPrompt) {
                jsonResponse(res, { versions: [] });
                return true;
            }

            // Get version history
            const { data: versions, error } = await admin
                .from('prompt_versions')
                .select('id, version, created_at, created_by, change_reason')
                .eq('prompt_key', key)
                .order('version', { ascending: false })
                .limit(20);

            if (error) {
                console.error('[API] Error fetching versions:', error.message);
                jsonResponse(res, { versions: [] });
                return true;
            }

            jsonResponse(res, {
                current_version: currentPrompt.version,
                versions: versions || []
            });
        } catch (e) {
            console.error('[API] Error fetching versions:', e.message);
            jsonResponse(res, { versions: [] });
        }
        return true;
    }

    // POST /api/system/prompts/:key/restore - Restore a prompt to a previous version
    if (pathname.match(/^\/api\/system\/prompts\/([^/]+)\/restore$/) && req.method === 'POST') {
        const key = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/restore$/)[1];
        const body = await parseBody(req);

        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }

            // Verify superadmin
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

            const version = parseInt(body.version, 10);
            if (isNaN(version)) {
                jsonResponse(res, { error: 'Invalid version number' }, 400);
                return true;
            }

            const admin = supabase.getAdminClient();

            // Call the restore function
            const { data, error } = await admin.rpc('restore_prompt_version', {
                p_prompt_key: key,
                p_version: version
            });

            if (error) {
                console.error('[API] Error restoring version:', error.message);
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }

            // Clear prompts cache
            try {
                const promptsService = require('../../supabase/prompts');
                promptsService.clearCache();
            } catch (e) {
                // Ignore
            }

            jsonResponse(res, data || { success: true });
        } catch (e) {
            console.error('[API] Error restoring version:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/prompts/:key/versions/:version - Get a specific version content
    if (pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions\/(\d+)$/) && req.method === 'GET') {
        const match = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions\/(\d+)$/);
        const key = match[1];
        const version = parseInt(match[2], 10);

        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }

            // Verify superadmin
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

            const admin = supabase.getAdminClient();
            const { data, error } = await admin
                .from('prompt_versions')
                .select('*')
                .eq('prompt_key', key)
                .eq('version', version)
                .single();

            if (error || !data) {
                jsonResponse(res, { error: 'Version not found' }, 404);
                return true;
            }

            jsonResponse(res, { version: data });
        } catch (e) {
            console.error('[API] Error fetching version:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleSystemPrompts,
};
