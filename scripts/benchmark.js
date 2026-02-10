#!/usr/bin/env node
/**
 * Performance benchmark script (requires server running on PORT).
 * Uses autocannon for load testing. Run: npm run benchmark
 * Or: node scripts/benchmark.js [health|config|dashboard|all]
 *
 * Baseline metrics: p50/p95/p99 latency, RPS, error rate.
 * Start server first: npm run start (or dev:backend).
 */

const { execSync } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3005;
const BASE = `http://localhost:${PORT}`;
const DEFAULT_DURATION = 30;
const DEFAULT_CONNECTIONS = 10;

const endpoints = {
    health: { url: `${BASE}/health`, name: 'GET /health' },
    config: { url: `${BASE}/api/config`, name: 'GET /api/config' },
    dashboard: { url: `${BASE}/api/dashboard`, name: 'GET /api/dashboard', headers: ['Content-Type: application/json'] }
};

function runAutocannon(url, name, duration = DEFAULT_DURATION, connections = DEFAULT_CONNECTIONS) {
    const args = ['-c', String(connections), '-d', String(duration), '-m', 'GET', url];
    console.log(`\n--- ${name} ---`);
    console.log(`  npx autocannon ${args.join(' ')}\n`);
    try {
        execSync('npx autocannon ' + args.join(' '), {
            stdio: 'inherit',
            shell: true,
            cwd: path.join(__dirname, '..')
        });
    } catch (e) {
        if (e.status !== 0) console.error('Autocannon exited with code', e.status);
        throw e;
    }
}

const which = (process.argv[2] || 'health').toLowerCase();
const duration = parseInt(process.env.BENCH_DURATION, 10) || DEFAULT_DURATION;
const connections = parseInt(process.env.BENCH_CONNECTIONS, 10) || DEFAULT_CONNECTIONS;

if (which === 'all') {
    runAutocannon(endpoints.health.url, endpoints.health.name, duration, connections);
    runAutocannon(endpoints.config.url, endpoints.config.name, duration, connections);
    runAutocannon(endpoints.dashboard.url, endpoints.dashboard.name, duration, connections);
} else if (endpoints[which]) {
    runAutocannon(endpoints[which].url, endpoints[which].name, duration, connections);
} else {
    console.log('Usage: node scripts/benchmark.js [health|config|dashboard|all]');
    console.log('  Server must be running. Example: npm run start (then npm run benchmark)');
    process.exit(1);
}
