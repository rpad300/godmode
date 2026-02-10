#!/usr/bin/env node
/**
 * Extract table and RPC names used in the codebase (no DB connection).
 * Output: scripts/code-schema-manifest.json
 * Use with db-schema-report.json (from introspect-db.js) to ensure migrations cover the app.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const outPath = path.join(__dirname, 'code-schema-manifest.json');

const tables = new Set();
const rpcs = new Set();

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
