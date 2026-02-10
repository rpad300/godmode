#!/usr/bin/env node
/**
 * Start server and open browser
 * This script starts the server and opens the browser after a short delay
 */

const { spawn } = require('child_process');

// Require Node 14+ (nullish coalescing ?? and optional chaining used in src/supabase)
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 14) {
    console.error('[Launcher] GodMode requires Node.js 14 or newer. Current:', process.version);
    console.error('[Launcher] Upgrade from https://nodejs.org/ or use nvm/fnm.');
    process.exit(1);
}
const path = require('path');

const PORT = process.env.PORT || 3005;
const URL = `http://localhost:${PORT}`;

// Start the server
console.log('[Launcher] Starting GodMode server...');
console.log('');

const serverProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, NODE_PATH: path.join(__dirname, '..', 'node_modules') }
});

// Open browser after server has time to start
setTimeout(async () => {
    try {
        // Dynamic import for ESM module
        const open = (await import('open')).default;
        console.log(`[Launcher] Opening browser at ${URL}`);
        await open(URL);
    } catch (err) {
        console.log(`[Launcher] Could not open browser automatically. Please open: ${URL}`);
    }
}, 3000);

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n[Launcher] Shutting down...');
    serverProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
    process.exit(0);
});

serverProcess.on('exit', (code) => {
    process.exit(code);
});
