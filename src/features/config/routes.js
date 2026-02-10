/**
 * Config Routes
 * Extracted from src/server.js for modularization
 * 
 * Handles:
 * - GET /api/config - Get current configuration
 * - POST /api/config - Update configuration
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
