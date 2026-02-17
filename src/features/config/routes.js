/**
 * Purpose:
 *   Application configuration API routes. Exposes the current runtime configuration
 *   for the frontend settings page and accepts configuration updates that are
 *   persisted to disk and propagated to all subsystems.
 *
 * Responsibilities:
 *   - GET /api/config: Return sanitized current configuration (project name, LLM settings,
 *     prompts, PDF processing flag); API keys are masked via getLLMConfigForFrontend
 *   - POST /api/config: Accept partial configuration updates and merge them into the
 *     running config. Handles nested updates for:
 *     - Project name, custom prompts, PDF-to-images toggle
 *     - Ollama host/port (with LLM cache invalidation)
 *     - LLM provider selection, model selections, embeddings provider
 *     - Per-task provider/model overrides
 *     - Provider-specific API keys, base URLs, organization IDs, manual model lists
 *
 * Key dependencies:
 *   - ../../middleware/cache: invalidateConfigCache to bust config cache on updates
 *   - saveConfig: Callback to persist config to disk (typically JSON file)
 *   - processor: Document processor that needs config refresh on changes
 *   - llm: LLM module with clearCache() to invalidate provider connections
 *   - getLLMConfigForFrontend: Sanitizer that masks sensitive fields (API keys) before
 *     returning config to the client
 *
 * Side effects:
 *   - Filesystem: persists updated config to the config file via saveConfig
 *   - Global state: mutates the shared config object in-place; clears LLM provider cache;
 *     invalidates middleware config cache; updates processor config
 *
 * Notes:
 *   - API keys are only updated if a non-empty value is provided (empty string is ignored
 *     to prevent accidental key deletion)
 *   - Ollama config changes are mirrored to both config.ollama and config.llm.providers.ollama
 *     for backward compatibility
 *   - No authentication is enforced at this route level; the caller is expected to be
 *     pre-authenticated. TODO: confirm middleware auth coverage for /api/config
 *   - The POST endpoint returns the full sanitized config in the response for immediate
 *     UI refresh without a separate GET
 */
const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const { invalidateConfigCache } = require('../../middleware/cache');

async function handleConfig(ctx) {
    const { req, res, pathname, config, saveConfig, processor, llm, getLLMConfigForFrontend } = ctx;
    
    // Check if this is a config route
    const log = getLogger().child({ module: 'config' });
    if (pathname !== '/api/config') {
        return false;
    }
    // GET /api/config - Get current configuration
    if (req.method === 'GET') {
        jsonResponse(res, {
            projectName: config.projectName,
            ollama: config.ollama,
            llm: getLLMConfigForFrontend(config.llm),
            prompts: config.prompts || {},
            pdfToImages: config.pdfToImages !== false
        });
        return true;
    }

    // POST /api/config - Update configuration
    if (req.method === 'POST') {
        const body = await parseBody(req);
        if (body.projectName !== undefined) config.projectName = body.projectName;
        if (body.prompts !== undefined) config.prompts = body.prompts;
        if (body.pdfToImages !== undefined) config.pdfToImages = body.pdfToImages;
        if (body.ollama) {
            config.ollama = { ...config.ollama, ...body.ollama };
            config.llm.providers = config.llm.providers || {};
            config.llm.providers.ollama = {
                ...config.llm.providers.ollama,
                host: config.ollama.host,
                port: config.ollama.port
            };
            llm.clearCache();
        }
        
        // Handle LLM config updates
        if (body.llm) {
            // Update provider selection
            if (body.llm.provider !== undefined) {
                config.llm.provider = body.llm.provider;
            }
            // Update model selections
            if (body.llm.models) {
                config.llm.models = { ...config.llm.models, ...body.llm.models };
            }
            // Update embeddings provider
            if (body.llm.embeddingsProvider !== undefined) {
                config.llm.embeddingsProvider = body.llm.embeddingsProvider;
            }
            // Update per-task provider/model config
            if (body.llm.perTask) {
                config.llm.perTask = { ...config.llm.perTask, ...body.llm.perTask };
                log.debug({ event: 'config_saved_per_task', perTask: config.llm.perTask }, 'Saved perTask');
            }
            // Update provider-specific configs (API keys, base URLs, etc.)
            if (body.llm.providers) {
                for (const [pid, providerConfig] of Object.entries(body.llm.providers)) {
                    if (config.llm.providers[pid]) {
                        // Only update apiKey if a new one is provided (non-empty)
                        if (providerConfig.apiKey !== undefined && providerConfig.apiKey !== '') {
                            config.llm.providers[pid].apiKey = providerConfig.apiKey;
                        }
                        // Update other fields
                        if (providerConfig.baseUrl !== undefined) {
                            config.llm.providers[pid].baseUrl = providerConfig.baseUrl;
                        }
                        if (providerConfig.organization !== undefined) {
                            config.llm.providers[pid].organization = providerConfig.organization;
                        }
                        if (providerConfig.manualModels !== undefined) {
                            config.llm.providers[pid].manualModels = providerConfig.manualModels;
                        }
                        // For ollama, update host/port and clear LLM cache
                        if (pid === 'ollama') {
                            if (providerConfig.host !== undefined) {
                                config.llm.providers.ollama.host = providerConfig.host;
                                config.ollama.host = providerConfig.host;
                            }
                            if (providerConfig.port !== undefined) {
                                config.llm.providers.ollama.port = providerConfig.port;
                                config.ollama.port = providerConfig.port;
                            }
                            llm.clearCache();
                        }
                    }
                }
            }
            // Clear LLM provider cache when config changes
            llm.clearCache();
        }
        
        // Update processor config
        processor.updateConfig(config);
        saveConfig(config);
        invalidateConfigCache();
        jsonResponse(res, { success: true, config: {
            ...config,
            llm: getLLMConfigForFrontend(config.llm)
        }});
        return true;
    }

    // Not handled
    return false;
}

module.exports = { handleConfig };
