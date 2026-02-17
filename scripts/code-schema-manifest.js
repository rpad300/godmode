#!/usr/bin/env node
/**
 * Purpose:
 *   Static-analysis tool that scans all .js/.ts files under src/ for Supabase
 *   .from('table') and .rpc('function') calls, producing a manifest of every
 *   table and RPC the application code depends on.
 *
 * Responsibilities:
 *   - Recursively walk src/ (skipping node_modules/.git)
 *   - Regex-extract table names from .from('...') calls
 *   - Regex-extract RPC names from .rpc('...') calls
 *   - Write scripts/code-schema-manifest.json with sorted, deduplicated results
 *
 * Key dependencies:
 *   - None (Node.js built-ins only)
 *
 * Side effects:
 *   - Writes scripts/code-schema-manifest.json to disk
 *
 * Notes:
 *   - No database connection required; purely file-based analysis
 *   - Compare the output with scripts/db-schema-report.json (from introspect-db.js)
 *     to find tables referenced in code but missing from the database, or vice versa
 *   - The regex approach may produce false positives if .from() / .rpc() are used
 *     by non-Supabase libraries with the same method names
 *
 * Usage:
 *   node scripts/code-schema-manifest.js
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const outPath = path.join(__dirname, 'code-schema-manifest.json');

const tables = new Set();
const rpcs = new Set();

/** Extract .from('table') and .rpc('name') references from a single file. */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fromRe = /\.from\s*\(\s*['"]([a-z_][a-z0-9_]*)['"]/g;
  const rpcRe = /\.rpc\s*\(\s*['"]([a-z0-9_]+)['"]/g;
  let m;
  while ((m = fromRe.exec(content)) !== null) tables.add(m[1]);
  while ((m = rpcRe.exec(content)) !== null) rpcs.add(m[1]);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git') walk(full);
    } else if (e.isFile() && /\.(js|ts)$/.test(e.name)) {
      scanFile(full);
    }
  }
}

walk(srcDir);

const manifest = {
  generated_at: new Date().toISOString(),
  tables: [...tables].sort(),
  rpcs: [...rpcs].sort()
};

fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('Tables:', manifest.tables.length, 'RPCs:', manifest.rpcs.length);
