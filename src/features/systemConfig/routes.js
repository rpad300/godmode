/**
 * System Config (Admin) routes (extracted from src/server.js)
 *
 * Non-negotiable: keep runtime behavior identical.
 */

const { parseUrl, parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleSystemConfig({ req, res, pathname, supabase, config, saveConfig }) {
    // ==================== System Config API (Admin) ====================

    // POST /api/system/config - Create/update a system configuration
    if (pathname === '/api/system/config' && req.method === 'POST') {
        const body = await parseBody(req);
        const { key, value, category } = body;

        if (!key) {
            jsonResponse(res, { error: 'Key is required' }, 400);
            return true;
        }

        try {
            // Verify superadmin
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

                // Handle LLM per-task configs (e.g., text_provider, vision_provider)
                if (key.endsWith('_provider')) {
                    const taskType = key.replace('_provider', ''); // text, vision, embeddings
                    const systemConfig = require('../../supabase/system');

                    // Get current llm_pertask config
                    const current = await systemConfig.getLLMConfig();
                    const updated = {
                        ...current,
                        [taskType]: {
                            provider: value.provider || null,
                            model: value.model || null
                        }
                    };

                    // Save to Supabase
                    const result = await systemConfig.setLLMConfig(updated, authResult.user.id);

                    if (!result.success) {
                        jsonResponse(res, { error: result.error }, 500);
                        return true;
                    }

                    // Update local config for immediate effect
                    if (!config.llm.perTask) config.llm.perTask = {};
                    config.llm.perTask[taskType] = updated[taskType];
                    saveConfig(config);

                    console.log(`[Admin] Saved LLM config for ${taskType}:`, updated[taskType]);
                    jsonResponse(res, { success: true, key, value: updated[taskType] });
                    return true;
                }

                // Generic config save
                const systemConfig = require('../../supabase/system');
                const result = await systemConfig.setSystemConfig(key, value, authResult.user.id, category);

                if (!result.success) {
                    jsonResponse(res, { error: result.error }, 500);
                    return true;
                }

                jsonResponse(res, { success: true, key, value });
                return true;
            }

            jsonResponse(res, { error: 'Supabase not configured' }, 500);
        } catch (e) {
            console.error('[API] Error saving system config:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/config - Get all system configuration
    if (pathname === '/api/system/config' && req.method === 'GET') {
        try {
            // Try to load from Supabase
            if (supabase && supabase.isConfigured()) {
                const systemConfig = require('../../supabase/system');
                const { configs } = await systemConfig.getAllSystemConfigs();
                jsonResponse(res, configs);
                return true;
            }

            // Fallback to local config
            jsonResponse(res, {
                llm_pertask: config.llm?.perTask || {},
                prompts: config.prompts || {},
                processing: {
                    chunkSize: config.chunkSize || 4000,
                    chunkOverlap: config.chunkOverlap || 200,
                    similarityThreshold: config.similarityThreshold || 0.90,
                    pdfToImages: config.pdfToImages !== false
                },
                graph: config.graph || { enabled: false, provider: 'json' },
                routing: config.llm?.routing || {},
                tokenPolicy: config.llm?.tokenPolicy || {}
            });
        } catch (e) {
            console.error('[API] Error getting system config:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/system/config/:key - Update a system configuration
    if (pathname.match(/^\/api\/system\/config\/([^/]+)$/) && req.method === 'PUT') {
        const key = pathname.match(/^\/api\/system\/config\/([^/]+)$/)[1];
        const body = await parseBody(req);

        try {
            // Verify superadmin
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

                const systemConfig = require('../../supabase/system');
                const result = await systemConfig.setSystemConfig(key, body.value, authResult.user.id);

                if (!result.success) {
                    jsonResponse(res, { error: result.error }, 500);
                    return true;
                }

                // Also update local config for immediate effect
                if (key === 'llm_pertask') config.llm.perTask = body.value;
                if (key === 'prompts') config.prompts = body.value;
                if (key === 'processing') {
                    config.chunkSize = body.value.chunkSize;
                    config.chunkOverlap = body.value.chunkOverlap;
                    config.similarityThreshold = body.value.similarityThreshold;
                    config.pdfToImages = body.value.pdfToImages;
                }
                if (key === 'graph') config.graph = body.value;
                if (key === 'routing') config.llm.routing = body.value;
                if (key === 'tokenPolicy') config.llm.tokenPolicy = body.value;

                saveConfig(config);
                jsonResponse(res, { success: true, config: result.config });
                return true;
            }

            jsonResponse(res, { error: 'Supabase not configured' }, 500);
        } catch (e) {
            console.error('[API] Error updating system config:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/system/preset - Apply a preset configuration
    if (pathname === '/api/system/preset' && req.method === 'POST') {
        const body = await parseBody(req);
        const presetId = body.preset;

        try {
            // Verify superadmin
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

                const presets = require('../../llm/presets');
                const preset = presets.getPresetConfig(presetId);

                if (!preset) {
                    jsonResponse(res, { error: `Preset '${presetId}' not found` }, 404);
                    return true;
                }

                // Apply preset to system config
                const systemConfig = require('../../supabase/system');
                const result = await systemConfig.setLLMConfig(preset, authResult.user.id);

                if (!result.success) {
                    jsonResponse(res, { error: result.error }, 500);
                    return true;
                }

                // Update local config
                config.llm.perTask = preset;
                saveConfig(config);

                jsonResponse(res, { success: true, preset: presetId, config: preset });
                return true;
            }

            // Fallback: just update local config
            const presets = require('../../llm/presets');
            const preset = presets.getPresetConfig(presetId);
            if (preset) {
                config.llm.perTask = preset;
                saveConfig(config);
                jsonResponse(res, { success: true, preset: presetId, config: preset });
            } else {
                jsonResponse(res, { error: `Preset '${presetId}' not found` }, 404);
            }
        } catch (e) {
            console.error('[API] Error applying preset:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/audit - Get configuration audit log
    if (pathname === '/api/system/audit' && req.method === 'GET') {
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

                const queryParams = new URLSearchParams(parseUrl(req.url).search);
                const limit = parseInt(queryParams.get('limit') || '20');

                const client = supabase.getAdminClient();
                const { data: logs, error } = await client
                    .from('config_audit_log')
                    .select('*')
                    .order('changed_at', { ascending: false })
                    .limit(limit);

                if (error) {
                    console.error('[API] Error fetching audit log:', error.message);
                    jsonResponse(res, { logs: [] });
                    return true;
                }

                jsonResponse(res, { logs: logs || [] });
                return true;
            }

            jsonResponse(res, { logs: [] });
        } catch (e) {
            console.error('[API] Error fetching audit log:', e.message);
            jsonResponse(res, { logs: [] });
        }
        return true;
    }

    return false;
}

module.exports = {
    handleSystemConfig,
};
