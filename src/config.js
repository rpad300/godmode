const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const loadConfig = () => {

const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

 function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            const merged = { ...DEFAULT_CONFIG, ...saved, ollama: { ...DEFAULT_CONFIG.ollama, ...saved.ollama } };

            // Merge LLM config with defaults (preserve saved provider configs)
            if (saved.llm) {
                merged.llm = {
                    ...DEFAULT_CONFIG.llm,
                    ...saved.llm,
                    models: { ...DEFAULT_CONFIG.llm.models, ...saved.llm.models },
                    providers: { ...DEFAULT_CONFIG.llm.providers }
                };
                // Deep merge each provider's config
                for (const pid of Object.keys(DEFAULT_CONFIG.llm.providers)) {
                    if (saved.llm.providers?.[pid]) {
                        merged.llm.providers[pid] = { ...DEFAULT_CONFIG.llm.providers[pid], ...saved.llm.providers[pid] };
                    }
                }
            }
            
            // Merge API keys from environment variables (ONLY in dev mode)
            // ENV VARS TAKE PRIORITY - this ensures .env file is always respected
            if (!IS_PACKAGED) {
                for (const [envVar, providerId] of Object.entries(ENV_TO_PROVIDER)) {
                    if (process.env[envVar]) {
                        if (!merged.llm.providers[providerId]) {
                            merged.llm.providers[providerId] = {};
                        }
                        // ENV vars ALWAYS override config - this is the expected behavior
                        merged.llm.providers[providerId].apiKey = process.env[envVar];
                        console.log(`[DEV] Using ${providerId} API key from ${envVar}`);
                    }
                }
            }
            
            // Mark providers as configured based on having an API key
            for (const [pid, pconfig] of Object.entries(merged.llm.providers)) {
                if (pid !== 'ollama' && pconfig.apiKey) {
                    merged.llm.providers[pid].isConfigured = true;
                    // Mask API key for frontend
                    if (pconfig.apiKey.length > 8) {
                        merged.llm.providers[pid].apiKeyMasked = pconfig.apiKey.substring(0, 4) + '••••' + pconfig.apiKey.substring(pconfig.apiKey.length - 4);
                    }
                }
            }

            // IMPORTANT: Always recalculate dataDir based on current exe location
            // This ensures portability - the app works even if moved to a different location
            // We preserve the project ID from projects.json, but recalculate the path
            const projectsPath = path.join(DATA_DIR, 'projects.json');
            if (fs.existsSync(projectsPath)) {
                try {
                    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
                    const currentProjectId = projects.current || 'default';
                    merged.dataDir = path.join(DATA_DIR, 'projects', currentProjectId);
                    console.log(`Data directory set to: ${merged.dataDir} (project: ${currentProjectId})`);
                } catch (e) {
                    merged.dataDir = path.join(DATA_DIR, 'projects', 'default');
                }
            } else {
                merged.dataDir = path.join(DATA_DIR, 'projects', 'default');
            }

            // Migrate legacy config to llm format
            return migrateLLMConfig(merged);
        }
    } catch (e) {
        console.error('Error loading config:', e.message);
    }
    return migrateLLMConfig({ ...DEFAULT_CONFIG, dataDir: path.join(DATA_DIR, 'projects', 'default') });
}

const saveConfig = (config) =>{
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

module.exports = {
  loadConfig, saveConfig

}