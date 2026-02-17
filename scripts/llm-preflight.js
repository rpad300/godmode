#!/usr/bin/env node
/**
 * Purpose:
 *   Interactive CLI that validates LLM provider connectivity before deployment.
 *   Runs a suite of smoke tests against every configured provider and writes
 *   a structured JSON report.
 *
 * Responsibilities:
 *   - Load API keys from .env, config.json, and interactive prompts
 *   - Detect local Ollama availability
 *   - Delegate to src/tests/llmPreflightRunner for actual test execution
 *   - Write a JSON report to disk and exit with a nonzero code on failure
 *
 * Key dependencies:
 *   - src/tests/llmPreflightRunner: the core preflight test runner
 *   - readline: interactive terminal prompts for API key entry
 *
 * Side effects:
 *   - Reads .env / data/config.json from disk
 *   - Makes live HTTP requests to LLM provider APIs when mode=live
 *   - Probes localhost:11434 to detect Ollama
 *   - Writes preflight-report.json to the working directory
 *
 * Notes:
 *   - In mock mode (default), no real API calls are made
 *   - --auto / -a skips the interactive key prompt and uses env/config keys only
 *   - Each provider entry supports multiple env var names (e.g. GROK_API_KEY, XAI_API_KEY)
 *   - Exit codes: 0 = all pass, 1 = test failures, 2 = runner crash
 *
 * Usage:
 *   node scripts/llm-preflight.js                # mock mode, interactive
 *   node scripts/llm-preflight.js --live --auto   # live mode, non-interactive
 *   LLM_PREFLIGHT_MODE=live node scripts/llm-preflight.js
 *   npm run llm:preflight
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Change to project root
process.chdir(path.join(__dirname, '..'));

/**
 * Load environment variables from .env file
 * Supports .env in project root or src/.env
 */
function loadEnvFile() {
    const possiblePaths = [
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', 'src', '.env')
    ];
    
    for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
            console.log(`✓ Loading environment from ${path.relative(process.cwd(), envPath)}`);
            const content = fs.readFileSync(envPath, 'utf-8');
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                // Skip empty lines and comments
                if (!trimmed || trimmed.startsWith('#')) continue;
                
                // Parse KEY = "value" or KEY=value format
                const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?(.+?)["']?\s*$/);
                if (match) {
                    const [, key, value] = match;
                    // Only set if not already defined in environment
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
            return true;
        }
    }
    return false;
}

// Load .env file before anything else
loadEnvFile();

const { runPreflight } = require('../src/tests/llmPreflightRunner');

// Provider info for prompts - supports multiple env var names per provider
const PROVIDERS = [
    { id: 'openai', name: 'OpenAI', envVars: ['OPENAI_API_KEY'] },
    { id: 'gemini', name: 'Google Gemini', envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GEMINI_API_KEY'] },
    { id: 'grok', name: 'Grok (xAI)', envVars: ['GROK_API_KEY', 'XAI_API_KEY', 'XAI_API'] },
    { id: 'deepseek', name: 'DeepSeek', envVars: ['DEEPSEEK_API_KEY'] },
    { id: 'claude', name: 'Claude (Anthropic)', envVars: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'] },
    { id: 'kimi', name: 'Kimi K2', envVars: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'] },
    { id: 'minimax', name: 'MiniMax', envVars: ['MINIMAX_API_KEY'] },
    { id: 'genspark', name: 'Genspark', envVars: ['GENSPARK_API_KEY'] }
];

/**
 * Get env key from multiple possible env var names
 */
function getEnvKey(envVars) {
    for (const envVar of envVars) {
        if (process.env[envVar]) {
            return { key: process.env[envVar], from: envVar };
        }
    }
    return null;
}

/**
 * Create readline interface for user input
 */
function createRL() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Prompt user for input
 */
function prompt(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

/**
 * Prompt for yes/no
 */
async function promptYesNo(rl, question) {
    const answer = await prompt(rl, `${question} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Mask API key for display
 */
function maskKey(key) {
    if (!key || key.length < 8) return key ? '****' : '';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

/**
 * Prompt user for API keys interactively
 */
async function promptForApiKeys(config) {
    const rl = createRL();
    
    console.log('\n📝 LIVE MODE - API Key Configuration\n');
    console.log('Enter API keys for the providers you want to test.');
    console.log('Press Enter to skip a provider.\n');
    console.log('Note: Keys from environment variables will be used if set.\n');
    
    if (!config.llm) config.llm = {};
    if (!config.llm.providers) config.llm.providers = {};
    
    const configuredProviders = [];
    
    for (const provider of PROVIDERS) {
        // Check environment variables first (supports multiple var names)
        const envResult = getEnvKey(provider.envVars);
        const envKey = envResult?.key;
        const envVarName = envResult?.from;
        const existingKey = config.llm.providers[provider.id]?.apiKey;
        
        let displayStatus = '';
        if (envKey) {
            displayStatus = ` [${envVarName}: ${maskKey(envKey)}]`;
        } else if (existingKey) {
            displayStatus = ` [config: ${maskKey(existingKey)}]`;
        }
        
        const answer = await prompt(rl, `${provider.name}${displayStatus}: `);
        
        // Use new key, or fall back to env, or fall back to existing config
        const finalKey = answer || envKey || existingKey || null;
        
        if (finalKey) {
            if (!config.llm.providers[provider.id]) {
                config.llm.providers[provider.id] = {};
            }
            config.llm.providers[provider.id].apiKey = finalKey;
            configuredProviders.push(provider.name);
        }
    }
    
    rl.close();
    
    console.log('\n✓ Configured providers:', configuredProviders.length > 0 ? configuredProviders.join(', ') : 'None');
    console.log('');
    
    return config;
}

/**
 * Check for Ollama availability
 */
async function checkOllama() {
    try {
        const http = require('http');
        return new Promise((resolve) => {
            const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
        });
    } catch {
        return false;
    }
}

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const hasLiveArg = args.includes('--live') || args.includes('-l');
    const hasMockArg = args.includes('--mock') || args.includes('-m');
    const hasAutoArg = args.includes('--auto') || args.includes('-a');
    
    // Mode priority: CLI arg > env var > default
    let mode = 'mock';
    if (hasLiveArg) mode = 'live';
    else if (hasMockArg) mode = 'mock';
    else if (process.env.LLM_PREFLIGHT_MODE) mode = process.env.LLM_PREFLIGHT_MODE;
    
    const outputPath = process.env.LLM_PREFLIGHT_OUTPUT || './preflight-report.json';

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           LLM PREFLIGHT TEST HARNESS                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Mode: ${mode.toUpperCase()}`);
    console.log(`Output: ${outputPath}`);

    // Load base config
    let config = { llm: { providers: {} } };
    
    try {
        const configPath = path.join(__dirname, '..', 'data', 'config.json');
        if (fs.existsSync(configPath)) {
            const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config = rawConfig;
            console.log('✓ Loaded config from data/config.json');
        }
    } catch (e) {
        console.log('⚠ No config.json found, using defaults');
    }

    // Live mode - prompt for API keys (unless --auto)
    if (mode === 'live') {
        // Check Ollama
        const ollamaAvailable = await checkOllama();
        console.log(`\n🔌 Ollama: ${ollamaAvailable ? '✓ Available at localhost:11434' : '✗ Not running'}`);
        
        // Load keys from env vars automatically
        if (!config.llm) config.llm = {};
        if (!config.llm.providers) config.llm.providers = {};
        
        // Auto-load from environment variables
        for (const provider of PROVIDERS) {
            const envResult = getEnvKey(provider.envVars);
            if (envResult && !config.llm.providers[provider.id]?.apiKey) {
                if (!config.llm.providers[provider.id]) {
                    config.llm.providers[provider.id] = {};
                }
                config.llm.providers[provider.id].apiKey = envResult.key;
            }
        }
        
        // Prompt for API keys only if not in auto mode
        if (!hasAutoArg) {
            config = await promptForApiKeys(config);
        } else {
            console.log('\n📝 AUTO MODE - Using keys from .env and config only\n');
        }
        
        // Show which providers will be tested
        console.log('─'.repeat(60));
        console.log('Providers to test:');
        
        let anyConfigured = false;
        for (const provider of PROVIDERS) {
            const hasKey = !!config.llm.providers[provider.id]?.apiKey;
            const status = hasKey ? '✓' : '✗';
            const envResult = getEnvKey(provider.envVars);
            const source = hasKey ? (envResult ? `(from ${envResult.from})` : '') : '';
            console.log(`  ${status} ${provider.name} ${source}`);
            if (hasKey) anyConfigured = true;
        }
        console.log(`  ${ollamaAvailable ? '✓' : '✗'} Ollama (local)`);
        console.log('─'.repeat(60));
        
        if (!anyConfigured && !ollamaAvailable) {
            console.log('\n⚠ No providers configured. Tests will be skipped.');
            console.log('  Run with API keys or start Ollama for live testing.\n');
        }
    }

    try {
        // Run preflight tests
        const report = await runPreflight({ mode, config });

        // Write report to file
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Report written to: ${outputPath}`);

        // Exit with appropriate code
        if (report.summary.failed > 0) {
            console.log(`\n❌ ${report.summary.failed} test(s) failed\n`);
            process.exit(1);
        } else {
            console.log(`\n✅ All tests passed (${report.summary.passed} passed, ${report.summary.skipped} skipped)\n`);
            process.exit(0);
        }
    } catch (error) {
        console.error('\n❌ Preflight runner crashed:', error);
        process.exit(2);
    }
}

// Run
main().catch(console.error);
