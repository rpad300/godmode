/**
 * Purpose:
 *   Superadmin system administration API for global configuration, LLM presets,
 *   prompt template management (with versioning and restore), system health stats,
 *   configuration audit log, and user management (list, create, update, delete).
 *
 * Responsibilities:
 *   - Get/set system configuration keys (LLM per-task, processing, graph, routing, etc.)
 *   - Apply LLM preset configurations
 *   - Configuration audit log retrieval
 *   - System health stats (CPU, RAM, disk usage) with platform-specific collection
 *   - Prompt template CRUD with version history and rollback
 *   - User management: list, invite/create, update (role, ban, password), delete
 *
 * Key dependencies:
 *   - ../../supabase/system: system config and LLM config persistence
 *   - ../../supabase/prompts: prompt template CRUD and cache
 *   - ../../llm/presets: predefined LLM configuration presets
 *   - supabase (ctx): admin client for auth user management, profile CRUD, audit log
 *   - os, child_process: system resource stats (CPU via PowerShell on Windows, loadavg on Linux)
 *
 * Side effects:
 *   - Config writes update both Supabase and in-memory config, then call saveConfig()
 *   - Prompt saves create a new version row in prompt_versions
 *   - Prompt restore calls the restore_prompt_version RPC and clears cache
 *   - User create/update/delete mutate Supabase Auth and user_profiles
 *   - System stats may execute shell commands (PowerShell on Windows)
 *
 * Notes:
 *   - All routes require superadmin access except GET /api/system/config (read-only)
 *   - Config PUT deep-merges LLM settings to avoid losing runtime state
 *   - System stats include a hardcoded latency value (12ms) as a placeholder
 *   - Windows and Linux have different CPU/disk collection strategies
 *   - Falls back to in-memory config when Supabase is not configured
 *
 * Routes:
 *   POST /api/system/config                        - Set config key (superadmin)
 *        Body: { key, value, category }
 *   GET  /api/system/config                        - Get all system configs
 *   GET  /api/system/config/:key                   - Get single config value
 *   PUT  /api/system/config/:key                   - Update config key (superadmin)
 *        Body: { value }
 *   GET  /api/system/stats                         - System health (CPU/RAM/disk, superadmin)
 *   POST /api/system/preset                        - Apply LLM preset (superadmin)
 *        Body: { preset }
 *   GET  /api/system/audit                         - Config audit log (superadmin, ?limit=N)
 *   GET  /api/system/prompts                       - List all prompt templates
 *   PUT  /api/system/prompts/:key                  - Save prompt template (superadmin)
 *        Body: { prompt }
 *   GET  /api/system/prompts/:key/versions         - Prompt version history (superadmin)
 *   GET  /api/system/prompts/:key/versions/:ver    - Single version detail (superadmin)
 *   POST /api/system/prompts/:key/restore          - Restore prompt version (superadmin)
 *        Body: { version }
 *   GET  /api/system/users                         - List users (superadmin)
 *   POST /api/system/users                         - Create/invite user (superadmin)
 *        Body: { email, password?, name, role }
 *   PUT  /api/system/users/:id                     - Update user (superadmin)
 *        Body: { name, role, status, email, password }
 *   DELETE /api/system/users/:id                   - Delete user (superadmin)
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Verify superadmin access. Sends 401/403 and returns null if denied.
 * @returns {object|null} The authResult if authorized, or null.
 */
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

    // GET /api/system/stats
    if (pathname === '/api/system/stats' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        try {
            // Memory Usage
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memUsage = Math.round((usedMem / totalMem) * 100);

            // CPU Usage (Windows specific method via PowerShell, fallback to os.loadavg)
            let cpuUsage = 0;
            try {
                if (process.platform === 'win32') {
                    const { stdout } = await execAsync('powershell -Command "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage"');
                    const load = parseInt(stdout.trim(), 10);
                    if (!isNaN(load)) {
                        cpuUsage = load;
                    }
                } else {
                    const cpus = os.cpus();
                    const load = os.loadavg()[0];
                    cpuUsage = Math.min(Math.round((load / cpus.length) * 100), 100);
                }
            } catch (e) {
                log.warn({ event: 'system_stats_cpu_error', error: e.message }, 'Failed to get CPU usage');
            }

            // Disk Usage (Windows specific method via PowerShell)
            let diskUsage = 0;
            let totalDisk = 0;
            let freeDisk = 0;
            const storageBreakdown = [];

            try {
                if (process.platform === 'win32') {
                    // Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace, VolumeName | ConvertTo-Json
                    const { stdout } = await execAsync('powershell -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace, VolumeName | ConvertTo-Json"');

                    let disks = [];
                    try {
                        const parsed = JSON.parse(stdout);
                        disks = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (parseError) {
                        log.warn({ event: 'system_stats_disk_parse_error', error: parseError.message, stdout }, 'Failed to parse disk JSON');
                    }

                    for (const disk of disks) {
                        if (disk.Size > 0) {
                            totalDisk += disk.Size;
                            freeDisk += disk.FreeSpace;
                            storageBreakdown.push({
                                category: disk.DeviceID || disk.VolumeName || 'Unknown',
                                sizeMB: Math.round(disk.Size / (1024 * 1024)),
                                freeMB: Math.round(disk.FreeSpace / (1024 * 1024)),
                                color: 'hsl(200 100% 55%)'
                            });
                        }
                    }
                }
            } catch (e) {
                log.warn({ event: 'system_stats_disk_error', error: e.message }, 'Failed to get Disk usage');
            }

            const diskColors = ['hsl(200 100% 55%)', 'hsl(260 80% 60%)', 'hsl(150 70% 50%)', 'hsl(30 90% 55%)'];
            const finalStorage = storageBreakdown.map((d, i) => ({
                category: d.category,
                size: d.sizeMB,
                free: d.freeMB,
                used: d.sizeMB - d.freeMB,
                color: diskColors[i % diskColors.length]
            }));

            if (totalDisk > 0) {
                diskUsage = Math.round(((totalDisk - freeDisk) / totalDisk) * 100);
            }

            if (finalStorage.length === 0) {
                finalStorage.push({ category: 'System', size: 1000, free: 500, used: 500, color: diskColors[0] });
            }

            const totalStorageMB = Math.round(totalDisk / (1024 * 1024)) || 1000;

            // Event loop lag
            const eventLoopLagMs = await new Promise((resolve) => {
                const start = Date.now();
                setImmediate(() => resolve(Date.now() - start));
            });

            // Process info
            const memUsageProcess = process.memoryUsage();
            const heapUsedMB = Math.round(memUsageProcess.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsageProcess.heapTotal / 1024 / 1024);
            const rssMB = Math.round(memUsageProcess.rss / 1024 / 1024);
            const externalMB = Math.round(memUsageProcess.external / 1024 / 1024);

            // DB connectivity
            let dbStatus = 'not configured';
            try {
                if (supabase && supabase.testConnection) {
                    const conn = await supabase.testConnection();
                    dbStatus = conn && conn.success ? 'connected' : (conn && conn.error) || 'error';
                }
            } catch (_) { dbStatus = 'error'; }

            jsonResponse(res, {
                cpu: cpuUsage,
                ram: memUsage,
                disk: diskUsage,
                latency: eventLoopLagMs,
                storageBreakdown: finalStorage,
                totalStorage: totalStorageMB,
                timestamp: new Date().toISOString(),
                server: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    uptime: Math.round(process.uptime()),
                    pid: process.pid,
                },
                memory: {
                    totalMB: Math.round(totalMem / 1024 / 1024),
                    freeMB: Math.round(freeMem / 1024 / 1024),
                    usedMB: Math.round(usedMem / 1024 / 1024),
                },
                process: {
                    heapUsedMB,
                    heapTotalMB,
                    rssMB,
                    externalMB,
                    heapPercent: heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0,
                },
                database: dbStatus,
                cpuCores: os.cpus().length,
                hostname: os.hostname(),
            });

        } catch (e) {
            log.warn({ event: 'system_stats_error', reason: e.message }, 'Error fetching system stats');
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

    // GET /api/system/config/:key
    const configKeyMatch = pathname.match(/^\/api\/system\/config\/([^/]+)$/);
    if (configKeyMatch && req.method === 'GET') {
        const key = configKeyMatch[1];
        try {
            if (supabase && supabase.isConfigured()) {
                const systemConfig = require('../../supabase/system');
                const result = await systemConfig.getSystemConfig(key);
                // Return just the value property as requested by frontend
                jsonResponse(res, { success: true, value: result.value });
            } else {
                // Fallback to in-memory config if not configured
                let value = null;
                if (key === 'llm') value = config.llm || {};
                else if (key === 'processing') value = config.processing || {};
                else if (key === 'prompts') value = config.prompts || {};
                else if (key === 'llm_pertask') value = config.llm?.perTask || {};
                else value = config[key];

                jsonResponse(res, { success: true, value });
            }
        } catch (e) {
            log.warn({ event: 'system_admin_config_get_key_error', key, reason: e.message }, 'Error getting config key');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/system/config/:key
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
                if (key === 'llm') {
                    // Deep merge or replace to ensure we don't lose runtime state
                    // The body.value should be the source of truth for persisted settings
                    if (body.value) {
                        // If body.value has providers, update them
                        if (body.value.providers) {
                            config.llm.providers = body.value.providers;
                        }
                        // If body.value has other props, update them
                        // We avoid replacing config.llm entirely because it might have other internal props
                        Object.assign(config.llm, body.value);
                    }
                }
                if (key === 'prompts') config.prompts = body.value;
                if (key === 'processing') {
                    config.chunkSize = body.value.chunkSize;
                    config.chunkOverlap = body.value.chunkOverlap;
                    config.similarityThreshold = body.value.similarityThreshold;
                    config.pdfToImages = body.value.pdfToImages;
                    config.processing = body.value; // Update the whole object reference too
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
                const promptsService = require('../../supabase/prompts');
                const prompts = await promptsService.getAllPrompts();

                if (!prompts) {
                    jsonResponse(res, { templates: [] });
                    return true;
                }

                // Map to frontend structure
                const templates = Object.values(prompts).map(p => {
                    // Extract variables from template {{VAR}}
                    const variables = [...new Set((p.prompt_template.match(/\{\{([A-Z_]+)\}\}/g) || []).map(v => v.replace(/\{\{|\}\}/g, '')))];

                    return {
                        id: p.key,
                        name: p.name || p.key,
                        category: p.category || 'System',
                        prompt: p.prompt_template,
                        variables: variables,
                        lastModified: p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        isActive: p.is_active !== false,
                        description: p.description
                    };
                });

                jsonResponse(res, { templates });
            } else {
                // Fallback to defaults from system.js if no DB
                const config = require('../../server').config || {};
                const systemConfig = config.prompts || {};
                const templates = Object.entries(systemConfig).map(([key, value]) => ({
                    id: key,
                    name: key.charAt(0).toUpperCase() + key.slice(1),
                    category: 'System',
                    prompt: value,
                    variables: [],
                    lastModified: new Date().toISOString().split('T')[0],
                    isActive: true
                }));
                jsonResponse(res, { templates });
            }
        } catch (e) {
            log.warn({ event: 'system_admin_prompts_error', reason: e.message }, 'Error fetching prompts');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/system/prompts/:key
    const promptKeyMatch = pathname.match(/^\/api\/system\/prompts\/([^/]+)$/);
    if (promptKeyMatch && req.method === 'PUT') {
        const key = promptKeyMatch[1];
        const body = await parseBody(req);

        try {
            if (supabase && supabase.isConfigured()) {
                const authResult = await requireSuperAdmin(supabase, req, res);
                if (!authResult) return true;

                const admin = supabase.getAdminClient();

                // Toggle active or update description (no template change = no version bump)
                if (body.is_active !== undefined || body.description !== undefined) {
                    const updates = {};
                    if (body.is_active !== undefined) updates.is_active = !!body.is_active;
                    if (body.description !== undefined) updates.description = body.description;
                    updates.updated_at = new Date().toISOString();
                    updates.updated_by = authResult.user.id;
                    const { error } = await admin.from('system_prompts').update(updates).eq('key', key);
                    if (error) { jsonResponse(res, { error: error.message }, 500); return true; }
                }

                // Update prompt template (triggers auto-versioning via DB trigger)
                if (body.prompt !== undefined) {
                    const promptsService = require('../../supabase/prompts');
                    const result = await promptsService.savePrompt(key, body.prompt, authResult.user.id);
                    if (!result.success) { jsonResponse(res, { error: result.error }, 500); return true; }
                }

                // If change_reason was provided, update the latest version row
                if (body.change_reason) {
                    const { data: latest } = await admin.from('prompt_versions').select('id').eq('prompt_key', key).order('version', { ascending: false }).limit(1).single();
                    if (latest) {
                        await admin.from('prompt_versions').update({ change_reason: body.change_reason }).eq('id', latest.id);
                    }
                }

                jsonResponse(res, { success: true });
            } else {
                const config = require('../../server').config || {};
                if (!config.prompts) config.prompts = {};
                if (body.prompt) config.prompts[key] = body.prompt;
                jsonResponse(res, { success: true });
            }
        } catch (e) {
            log.warn({ event: 'system_admin_prompt_save_error', key, reason: e.message }, 'Error saving prompt');
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
            try { require('../../supabase/prompts').clearCache(); } catch (_) { }
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

    // ==================== User Management API ====================

    // GET /api/system/users
    if (pathname === '/api/system/users' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        try {
            const admin = supabase.getAdminClient();

            // Fetch users from auth.users (pagination support can be added later)
            const { data: { users }, error: authError } = await admin.auth.admin.listUsers();
            if (authError) throw authError;

            // Fetch profiles
            const { data: profiles, error: profileError } = await admin.from('user_profiles').select('*');
            if (profileError) throw profileError;

            // Merge data
            const systemUsers = users.map(u => {
                const profile = profiles.find(p => p.id === u.id);
                return {
                    id: u.id,
                    email: u.email,
                    name: profile?.display_name || profile?.username || u.user_metadata?.username || u.email?.split('@')[0],
                    role: profile?.role || 'user',
                    status: u.banned_until ? 'banned' : (u.email_confirmed_at ? 'active' : 'pending'),
                    lastActive: u.last_sign_in_at,
                    joinedAt: u.created_at,
                    avatar: profile?.avatar_url
                };
            });

            jsonResponse(res, {
                ok: true,
                users: systemUsers,
                stats: {
                    totalUsers: systemUsers.length,
                    activeUsers: systemUsers.filter(u => u.status === 'active').length,
                    pendingInvitations: systemUsers.filter(u => u.status === 'pending').length
                }
            });
        } catch (e) {
            log.warn({ event: 'system_admin_users_error', reason: e.message }, 'Error fetching users');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/system/users (Invite/Create)
    if (pathname === '/api/system/users' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        const body = await parseBody(req);
        try {
            const admin = supabase.getAdminClient();

            // Create user in Supabase Auth
            const { data: { user }, error: createError } = await admin.auth.admin.createUser({
                email: body.email,
                password: body.password || undefined, // Optional if email confirm enabled
                email_confirm: true, // Auto-confirm if admin creates
                user_metadata: {
                    username: body.name,
                    display_name: body.name
                }
            });

            if (createError) throw createError;

            // Create profile
            if (user) {
                await admin.from('user_profiles').upsert({
                    id: user.id,
                    username: body.name,
                    display_name: body.name,
                    role: body.role || 'user'
                });
            }

            jsonResponse(res, { ok: true, user });
        } catch (e) {
            log.warn({ event: 'system_admin_user_create_error', reason: e.message }, 'Error creating user');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/system/users/:id (Update)
    const userUpdateMatch = pathname.match(/^\/api\/system\/users\/([^/]+)$/);
    if (userUpdateMatch && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        const userId = userUpdateMatch[1];
        const body = await parseBody(req);

        try {
            const admin = supabase.getAdminClient();

            // Update Auth Data (if needed)
            if (body.password || body.email || body.status) {
                const updates = {};
                if (body.password) updates.password = body.password;
                if (body.email) updates.email = body.email;
                if (body.status === 'banned') updates.ban_duration = '876000h'; // 100 years
                if (body.status === 'active') updates.ban_duration = 'none';

                if (Object.keys(updates).length > 0) {
                    const { error: authError } = await admin.auth.admin.updateUserById(userId, updates);
                    if (authError) throw authError;
                }
            }

            // Update Profile Data
            const profileUpdates = {};
            if (body.role) profileUpdates.role = body.role;
            if (body.name) {
                profileUpdates.display_name = body.name;
                profileUpdates.username = body.name;
            }

            if (Object.keys(profileUpdates).length > 0) {
                const { error: profileError } = await admin.from('user_profiles').update(profileUpdates).eq('id', userId);
                if (profileError) throw profileError;
            }

            jsonResponse(res, { ok: true });
        } catch (e) {
            log.warn({ event: 'system_admin_user_update_error', reason: e.message }, 'Error updating user');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/system/users/:id
    const userDeleteMatch = pathname.match(/^\/api\/system\/users\/([^/]+)$/);
    if (userDeleteMatch && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) { jsonResponse(res, { error: 'Database not configured' }, 503); return true; }
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        const userId = userDeleteMatch[1];
        try {
            const admin = supabase.getAdminClient();
            const { error } = await admin.auth.admin.deleteUser(userId);
            if (error) throw error;
            jsonResponse(res, { ok: true });
        } catch (e) {
            log.warn({ event: 'system_admin_user_delete_error', reason: e.message }, 'Error deleting user');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // ── GET /api/system/providers — Provider key status for admin ────────────
    if (pathname === '/api/system/providers' && req.method === 'GET') {
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        try {
            const secrets = require('../../supabase/secrets');
            // Use canonical IDs that match what the queue and billing system use
            // claude→anthropic, gemini→google, xai→grok are aliases handled by secrets module
            const providers = ['openai', 'anthropic', 'google', 'grok', 'deepseek', 'kimi', 'minimax'];
            // Also include frontend-friendly aliases
            const displayNames = { openai: 'OpenAI', anthropic: 'Claude / Anthropic', google: 'Google / Gemini', grok: 'Grok / xAI', deepseek: 'DeepSeek', kimi: 'Kimi', minimax: 'MiniMax' };
            const aliases = { anthropic: ['claude', 'anthropic'], google: ['gemini', 'google'], grok: ['xai', 'grok'] };
            const providerStatus = [];
            for (const p of providers) {
                const result = await secrets.getProviderApiKey(p, null);
                providerStatus.push({
                    id: p,
                    aliases: aliases[p] || [p],
                    name: displayNames[p] || p,
                    configured: result.success,
                    source: result.source || null,
                    masked: result.success ? (result.value ? result.value.substring(0, 4) + '****' + result.value.slice(-4) : null) : null,
                });
            }
            // Also check service API keys (Resend, Brave, etc.)
            const serviceKeys = [
                { id: 'resend', name: 'Resend (Email Service)', secretName: 'resend_api_key', legacyName: 'RESEND_API_KEY' },
                { id: 'brave', name: 'Brave Search (Company Analysis)', secretName: 'brave_api_key', legacyName: 'BRAVE_API_KEY' },
            ];
            const serviceStatus = [];
            for (const svc of serviceKeys) {
                let found = null;
                let r = await secrets.getSecret('system', svc.secretName);
                if (!r.success || !r.value) {
                    r = await secrets.getSecret('system', svc.legacyName);
                }
                if (r.success && r.value) {
                    found = r.value;
                }
                serviceStatus.push({
                    id: svc.id,
                    name: svc.name,
                    configured: !!found,
                    masked: found ? found.substring(0, 4) + '****' + found.slice(-4) : null,
                });
            }

            jsonResponse(res, { ok: true, providers: providerStatus, services: serviceStatus });
        } catch (e) {
            log.warn({ event: 'system_providers_error', reason: e.message }, 'Error checking provider status');
            jsonResponse(res, { ok: true, providers: [], services: [], error: e.message });
        }
        return true;
    }

    // ── POST /api/system/providers — Save API key to Supabase secrets (LLM providers + service keys) ──
    if (pathname === '/api/system/providers' && req.method === 'POST') {
        const authResult = await requireSuperAdmin(supabase, req, res);
        if (!authResult) return true;

        try {
            const body = await parseBody(req);
            const { provider, apiKey } = body;
            if (!provider || !apiKey) {
                jsonResponse(res, { error: 'provider and apiKey are required' }, 400);
                return true;
            }
            const secrets = require('../../supabase/secrets');
            const userId = authResult.user?.id || null;

            // Service keys (resend, brave) use simple secret names, not the LLM provider convention
            const serviceKeyNames = { resend: 'resend_api_key', brave: 'brave_api_key' };
            let result;
            if (serviceKeyNames[provider]) {
                result = await secrets.setSecret({ scope: 'system', name: serviceKeyNames[provider], value: apiKey, provider, userId });
            } else {
                result = await secrets.setProviderApiKey(provider, apiKey, 'system', null, userId);
            }
            if (result.success) {
                // Keys live ONLY in Supabase secrets — never in config.json
                // Invalidate BYOK cache so the queue picks up the new key immediately
                try {
                    const { getQueueManager } = require('../../llm/queue');
                    const queue = getQueueManager();
                    if (queue) queue.invalidateByokCache(null);
                } catch (_) { /* queue not initialized yet */ }
                log.info({ event: 'system_provider_key_saved', provider }, 'Provider API key saved to Supabase secrets (encrypted)');
                jsonResponse(res, { ok: true, provider });
            } else {
                jsonResponse(res, { error: result.error || 'Failed to save' }, 500);
            }
        } catch (e) {
            log.warn({ event: 'system_provider_key_error', reason: e.message }, 'Error saving provider key');
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleSystemAdmin };
