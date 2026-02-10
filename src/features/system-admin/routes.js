/**
 * System Admin API (Config + Prompts)
 * Extracted from server.js
 *
 * Handles:
 * - POST/GET /api/system/config, PUT /api/system/config/:key
 * - POST /api/system/preset, GET /api/system/audit
 * - GET/PUT /api/system/prompts, versions, restore
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

async function requireSuperAdmin(supabase, req, res) {
    const authResult = await supabase.auth.verifyRequest(req);
    if (!authResult.authenticated) {
        jsonResponse(res, { error: 'Authentication required' }, 401);
        return null;
    }
    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
    if (!isSuperAdmin) {
        jsonResponse(res, { error: 'Superadmin access required' }, 403);
        return null;
    }
    return authResult;
}

async function handleSystemAdmin(ctx) {
    const { req, res, pathname, supabase, config, saveConfig } = ctx;
    const log = getLogger().child({ module: 'system-admin' });
    if (!pathname.startsWith('/api/system/')) return false;

    // POST /api/system/config
    if (pathname === '/api/system/config' && req.method === 'POST') {
        const body = await parseBody(req);
        const { key, value, category } = body;
        if (!key) {
            jsonResponse(res, { error: 'Key is required' }, 400);
            return true;
        }
        try {
            if (supabase && supabase.isConfigured()) {
                const authResult = await requireSuperAdmin(supabase, req, res);
                if (!authResult) return true;
                const systemConfig = require('../../supabase/system');
                if (key.endsWith('_provider')) {
                    const taskType = key.replace('_provider', '');
                    const current = await systemConfig.getLLMConfig();
                    const updated = { ...current, [taskType]: { provider: value.provider || null, model: value.model || null } };
                    const result = await systemConfig.setLLMConfig(updated, authResult.user.id);
                    if (!result.success) { jsonResponse(res, { error: result.error }, 500); return true; }
                    if (!config.llm.perTask) config.llm.perTask = {};
                    config.llm.perTask[taskType] = updated[taskType];
                    saveConfig(config);
                    log.debug({ event: 'system_admin_llm_saved', taskType, value: updated[taskType] }, 'Saved LLM config');
                    jsonResponse(res, { success: true, key, value: updated[taskType] });
                } else {
                    const result = await systemConfig.setSystemConfig(key, value, authResult.user.id, category);
                    if (!result.success) { jsonResponse(res, { error: result.error }, 500); return true; }
                    jsonResponse(res, { success: true, key, value });
                }
            } else {
                jsonResponse(res, { error: 'Supabase not configured' }, 500);
            }
        } catch (e) {
            log.warn({ event: 'system_admin_config_save_error', reason: e.message }, 'Error saving system config');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/config
    if (pathname === '/api/system/config' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                const systemConfig = require('../../supabase/system');
                const { configs } = await systemConfig.getAllSystemConfigs();
                jsonResponse(res, configs);
            } else {
                jsonResponse(res, {
                    llm_pertask: config.llm?.perTask || {},
                    prompts: config.prompts || {},
                    processing: { chunkSize: config.chunkSize || 4000, chunkOverlap: config.chunkOverlap || 200, similarityThreshold: config.similarityThreshold || 0.90, pdfToImages: config.pdfToImages !== false },
                    graph: config.graph || { enabled: false, provider: 'json' },
                    routing: config.llm?.routing || {},
                    tokenPolicy: config.llm?.tokenPolicy || {}
                });
            }
        } catch (e) {
            log.warn({ event: 'system_admin_config_get_error', reason: e.message }, 'Error getting system config');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/system/config/:key
    const configKeyMatch = pathname.match(/^\/api\/system\/config\/([^/]+)$/);
    if (configKeyMatch && req.method === 'PUT') {
        const key = configKeyMatch[1];
        const body = await parseBody(req);
        try {
            if (supabase && supabase.isConfigured()) {
                const authResult = await requireSuperAdmin(supabase, req, res);
                if (!authResult) return true;
                const systemConfig = require('../../supabase/system');
                const result = await systemConfig.setSystemConfig(key, body.value, authResult.user.id);
                if (!result.success) { jsonResponse(res, { error: result.error }, 500); return true; }
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
            } else {
                jsonResponse(res, { error: 'Supabase not configured' }, 500);
            }
        } catch (e) {
            log.warn({ event: 'system_admin_config_update_error', reason: e.message }, 'Error updating system config');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/system/preset
    if (pathname === '/api/system/preset' && req.method === 'POST') {
        const body = await parseBody(req);
        const presetId = body.preset;
        try {
            if (supabase && supabase.isConfigured()) {
                const authResult = await requireSuperAdmin(supabase, req, res);
                if (!authResult) return true;
                const presets = require('../../llm/presets');
                const preset = presets.getPresetConfig(presetId);
                if (!preset) { jsonResponse(res, { error: `Preset '${presetId}' not found` }, 404); return true; }
                const systemConfig = require('../../supabase/system');
                const result = await systemConfig.setLLMConfig(preset, authResult.user.id);
                if (!result.success) { jsonResponse(res, { error: result.error }, 500); return true; }
                config.llm.perTask = preset;
                saveConfig(config);
                jsonResponse(res, { success: true, preset: presetId, config: preset });
            } else {
                const presets = require('../../llm/presets');
                const preset = presets.getPresetConfig(presetId);
                if (preset) {
                    config.llm.perTask = preset;
                    saveConfig(config);
                    jsonResponse(res, { success: true, preset: presetId, config: preset });
                } else {
                    jsonResponse(res, { error: `Preset '${presetId}' not found` }, 404);
                }
            }
        } catch (e) {
            log.warn({ event: 'system_admin_preset_error', reason: e.message }, 'Error applying preset');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/audit
    if (pathname === '/api/system/audit' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                const authResult = await requireSuperAdmin(supabase, req, res);
                if (!authResult) return true;
                const urlParsed = parseUrl(req.url);
                const limit = parseInt(urlParsed.query?.limit || '20');
                const client = supabase.getAdminClient();
                const { data: rows, error } = await client.from('config_audit_log').select('*').order('changed_at', { ascending: false }).limit(limit);
                if (error) { log.warn({ event: 'system_admin_audit_fetch_error', reason: error.message }, 'Error fetching audit log'); jsonResponse(res, { logs: [] }); return true; }
                const logs = (rows || []).map((row) => ({
                    ...row,
                    operation: row.action || row.operation,
                    table_name: row.config_key || row.table_name,
                    new_values: row.new_value != null ? row.new_value : row.new_values
                }));
                jsonResponse(res, { logs });
            } else {
                jsonResponse(res, { logs: [] });
            }
        } catch (e) {
            log.warn({ event: 'system_admin_audit_error', reason: e.message }, 'Error fetching audit log');
            jsonResponse(res, { logs: [] });
        }
        return true;
    }

    // GET /api/system/prompts
    if (pathname === '/api/system/prompts' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                const admin = supabase.getAdminClient();
                const { data: prompts, error } = await admin.from('system_prompts').select('id, key, name, description, category, prompt_template, uses_ontology, is_active').eq('is_active', true).order('key');
                if (error) { log.warn({ event: 'system_admin_prompts_error', reason: error.message }, 'Error fetching prompts'); jsonResponse(res, { prompts: [] }); return true; }
                jsonResponse(res, { prompts: prompts || [] });
            } else {
                jsonResponse(res, { prompts: [] });
            }
        } catch (e) {
            log.warn({ event: 'system_admin_prompts_error', reason: e.message }, 'Error fetching prompts');
            jsonResponse(res, { prompts: [] });
        }
        return true;
    }

    // PUT /api/system/prompts/:key
    const promptKeyMatch = pathname.match(/^\/api\/system\/prompts\/([^/]+)$/);
    if (promptKeyMatch && req.method === 'PUT') {
        const key = promptKeyMatch[1];
        const body = await parseBody(req);
        try {
            if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
            const authResult = await requireSuperAdmin(supabase, req, res);
            if (!authResult) return true;
            const admin = supabase.getAdminClient();
            const { data, error } = await admin.from('system_prompts').update({ prompt_template: body.prompt_template, updated_at: new Date().toISOString(), updated_by: authResult.user.id }).eq('key', key).select().single();
            if (error) { log.warn({ event: 'system_admin_prompt_update_error', reason: error.message }, 'Error updating prompt'); jsonResponse(res, { error: error.message }, 400); return true; }
            try { require('../../supabase/prompts').clearCache(); } catch (_) {}
            jsonResponse(res, { success: true, prompt: data });
        } catch (e) {
            log.warn({ event: 'system_admin_prompt_update_error', reason: e.message }, 'Error updating prompt');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/prompts/:key/versions
    const versionsMatch = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions$/);
    if (versionsMatch && req.method === 'GET') {
        const key = versionsMatch[1];
        try {
            if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { versions: [] }); return true; }
            const authResult = await requireSuperAdmin(supabase, req, res);
            if (!authResult) return true;
            const admin = supabase.getAdminClient();
            const { data: currentPrompt } = await admin.from('system_prompts').select('id, version, updated_at').eq('key', key).single();
            if (!currentPrompt) { jsonResponse(res, { versions: [] }); return true; }
            const { data: versions, error } = await admin.from('prompt_versions').select('id, version, created_at, created_by, change_reason').eq('prompt_key', key).order('version', { ascending: false }).limit(20);
            if (error) { log.warn({ event: 'system_admin_versions_error', reason: error.message }, 'Error fetching versions'); jsonResponse(res, { versions: [] }); return true; }
            jsonResponse(res, { current_version: currentPrompt.version, versions: versions || [] });
        } catch (e) {
            log.warn({ event: 'system_admin_versions_error', reason: e.message }, 'Error fetching versions');
            jsonResponse(res, { versions: [] });
        }
        return true;
    }

    // POST /api/system/prompts/:key/restore
    const restoreMatch = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/restore$/);
    if (restoreMatch && req.method === 'POST') {
        const key = restoreMatch[1];
        const body = await parseBody(req);
        try {
            if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
            const authResult = await requireSuperAdmin(supabase, req, res);
            if (!authResult) return true;
            const version = parseInt(body.version, 10);
            if (isNaN(version)) { jsonResponse(res, { error: 'Invalid version number' }, 400); return true; }
            const admin = supabase.getAdminClient();
            const { data, error } = await admin.rpc('restore_prompt_version', { p_prompt_key: key, p_version: version });
            if (error) { log.warn({ event: 'system_admin_restore_error', reason: error.message }, 'Error restoring version'); jsonResponse(res, { error: error.message }, 400); return true; }
            try { require('../../supabase/prompts').clearCache(); } catch (_) {}
            jsonResponse(res, data || { success: true });
        } catch (e) {
            log.warn({ event: 'system_admin_restore_error', reason: e.message }, 'Error restoring version');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/system/prompts/:key/versions/:version
    const versionDetailMatch = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions\/(\d+)$/);
    if (versionDetailMatch && req.method === 'GET') {
        const key = versionDetailMatch[1];
        const version = parseInt(versionDetailMatch[2], 10);
        try {
            if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
            const authResult = await requireSuperAdmin(supabase, req, res);
            if (!authResult) return true;
            const admin = supabase.getAdminClient();
            const { data, error } = await admin.from('prompt_versions').select('*').eq('prompt_key', key).eq('version', version).single();
            if (error || !data) { jsonResponse(res, { error: 'Version not found' }, 404); return true; }
            jsonResponse(res, { version: data });
        } catch (e) {
            log.warn({ event: 'system_admin_version_error', reason: e.message }, 'Error fetching version');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleSystemAdmin };
