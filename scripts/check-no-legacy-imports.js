#!/usr/bin/env node

/**
 * Purpose:
 *   CI guardrail that ensures src/frontend/ contains no stale references to the
 *   legacy frontend backup directory (frontend_backup_2026_02_11, etc.).
 *
 * Responsibilities:
 *   - Recursively scan src/frontend/ for files matching common web extensions
 *   - Check each file against a set of forbidden legacy path patterns
 *   - Report violations with file, line number, and matched pattern
 *   - Exit 1 on any violation, 0 if clean
 *
 * Key dependencies:
 *   - None (uses only Node.js built-ins: fs, path)
 *
 * Side effects:
 *   - Reads files under src/frontend/ (read-only)
 *
 * Notes:
 *   - EXCLUDED_FILES list allows guardrail configs (e.g. eslint.config.js) that
 *     legitimately mention legacy patterns
 *   - Designed to run in CI pipelines; a non-zero exit blocks the build
 *   - Only scans .ts, .tsx, .js, .jsx, .json, .css, .html files
 *
 * Usage:
 *   node scripts/check-no-legacy-imports.js
 *   npm run check:legacy
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'src', 'frontend');
const LEGACY_PATTERNS = [
  'frontend_backup_2026_02_11',
  'frontend-legacy',
  'frontend_backup',
];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html'];

// Files that legitimately reference legacy patterns (guardrail configs)
const EXCLUDED_FILES = [
  'eslint.config.js',
  'README.md',
  'DO_NOT_EDIT.md',
];

let violations = [];

function scanDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      scanDir(fullPath);
    } else if (entry.isFile() && EXTENSIONS.some(ext => entry.name.endsWith(ext)) && !EXCLUDED_FILES.includes(entry.name)) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of LEGACY_PATTERNS) {
      if (line.includes(pattern)) {
        violations.push({
          file: path.relative(process.cwd(), filePath),
          line: i + 1,
          pattern,
          text: line.trim(),
        });
      }
    }
  }
}

console.log('Checking for legacy frontend imports in src/frontend/ ...\n');

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error('ERROR: src/frontend/ directory not found.');
  process.exit(1);
}

scanDir(FRONTEND_DIR);

if (violations.length > 0) {
  console.error(`FAILED: Found ${violations.length} reference(s) to legacy frontend:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Pattern: "${v.pattern}"`);
    console.error(`    Line:    ${v.text}\n`);
  }
  console.error('The active frontend (src/frontend/) must NOT reference the legacy backup.');
  console.error('Remove these references before proceeding.\n');
  process.exit(1);
} else {
  console.log('PASSED: No legacy frontend references found in src/frontend/.');
  process.exit(0);
}
