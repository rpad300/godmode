/**
 * Secrets (Admin) routes (extracted from src/server.js)
 *
 * Non-negotiable: keep runtime behavior identical.
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleSecrets({ req, res, pathname, supabase }) {
    // ==================== Secrets API (Admin) ====================

    // POST /api/secrets - Store a secret (API key, password, etc.)
    if (pathname === '/api/secrets' && req.method === 'POST') {
        const body = await parseBody(req);
        const { name, value, scope = 'system', projectId = null } = body;

        if (!name || !value) {
            jsonResponse(res, { error: 'Name and value are required' }, 400);
            return true;
        }

        try {
            // Verify superadmin for system scope
            if (supabase && supabase.isConfigured()) {
                const authResult = await supabase.auth.verifyRequest(req);
                if (!authResult.authenticated) {
                    jsonResponse(res, { error: 'Authentication required' }, 401);
                    return true;
                }

                if (scope === 'system') {
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                    if (!isSuperAdmin) {
                        jsonResponse(res, { error: 'Superadmin access required for system secrets' }, 403);
                        return true;
                    }
                }

                if (scope === 'project') {
                    if (!projectId) {
                        jsonResponse(res, { error: 'projectId is required for project secrets' }, 400);
                        return true;
                    }

                    const client = supabase.getAdminClient();
                    const { data: member, error: memberError } = await client
                        .from('project_members')
                        .select('role')
                        .eq('project_id', projectId)
                        .eq('user_id', authResult.user.id)
                        .single();

                    if (memberError || !member) {
                        jsonResponse(res, { error: 'Project access required' }, 403);
                        return true;
                    }

                    const role = (member.role || '').toLowerCase();
                    if (!['owner', 'admin'].includes(role)) {
                        jsonResponse(res, { error: 'Admin access required for project secrets' }, 403);
                        return true;
                    }
                }

                const secrets = require('../../supabase/secrets');
                const result = await secrets.setSecret({
                    scope,
                    projectId,
                    name,
                    value,
                    provider: secrets.detectProvider(value),
                    userId: authResult.user.id
                });

                if (!result.success) {
                    jsonResponse(res, { error: result.error }, 500);
                    return true;
                }

                console.log(`[Admin] Saved secret: ${name} (scope: ${scope})`);
                jsonResponse(res, { success: true, name, scope });
                return true;
            }

            jsonResponse(res, { error: 'Supabase not configured' }, 500);
        } catch (e) {
            console.error('[API] Error saving secret:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/secrets - List secrets (masked)
    if (pathname === '/api/secrets' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
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

                const secrets = require('../../supabase/secrets');
                const result = await secrets.listSecrets('system');

                jsonResponse(res, {
                    success: true,
                    secrets: result.secrets || []
                });
                return true;
            }

            jsonResponse(res, { error: 'Supabase not configured' }, 500);
        } catch (e) {
            console.error('[API] Error listing secrets:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleSecrets,
};
