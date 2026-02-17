#!/usr/bin/env node
/**
 * Purpose:
 *   Launches the GodMode backend server and opens the default browser
 *   after a short delay. Acts as the primary developer entry point.
 *
 * Responsibilities:
 *   - Enforce minimum Node.js version (14+) before spawning the server
 *   - Spawn src/server.js as a child process with inherited stdio
 *   - Open the browser at http://localhost:<PORT> after a 3-second warm-up
 *   - Forward SIGINT/SIGTERM to the child process for clean shutdown
 *
 * Key dependencies:
 *   - open (npm): cross-platform browser launcher (ESM dynamic import)
 *   - src/server.js: the actual Express/backend server
 *
 * Side effects:
 *   - Spawns a long-running child process (the server)
 *   - Opens an OS browser window
 *
 * Notes:
 *   - PORT defaults to 3005 if not set in the environment
 *   - The 3-second delay before opening the browser is a rough heuristic;
 *     if the server takes longer to bind, the browser may show an error page
 *   - The `open` package is imported dynamically because it is ESM-only
 *
 * Usage:
 *   node scripts/start-and-open.js
 *   npm start
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
