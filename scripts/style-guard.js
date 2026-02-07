#!/usr/bin/env node
/*
  style-guard.js

  Lightweight guardrails to prevent style regressions during the styling refactor.
  - Flags inline styles in frontend components
  - Flags hardcoded hex colors in CSS outside of approved token files

  Intended to be run in CI / locally:
    node scripts/style-guard.js
*/

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip build output + dependencies
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function findMatches(filePath, text, regex) {
  const lines = text.split(/\r?\n/);
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0;
    if (regex.test(lines[i])) {
      matches.push({ line: i + 1, preview: lines[i].trim().slice(0, 200) });
    }
  }
  return matches;
}

function stripLineCommentsTs(line) {
  // Remove inline // comments (good enough heuristic for TS)
  const idx = line.indexOf('//');
  if (idx === -1) return line;
  return line.slice(0, idx);
}

function rel(p) {
  return path.relative(repoRoot, p);
}

const strict = process.argv.includes('--strict');
let ok = true;

// 1) Inline style attributes in TS components
const componentsDir = path.join(repoRoot, 'src', 'frontend', 'components');
if (fs.existsSync(componentsDir)) {
  const files = walk(componentsDir).filter(f => f.endsWith('.ts'));
  const inlineStyleRegex = /\bstyle\s*=\s*(["'])/;
  const inlineStyleTokenRegex = /style\s*=\s*(["'])/;
  const htmlLikeContextsRegex = /<\w[\s\S]*\bstyle\s*=\s*(["'])/;

  const allowList = new Set([
    // If we must keep some inline styles temporarily, add exact relative paths here.
  ]);

  for (const f of files) {
    const r = rel(f);
    if (allowList.has(r)) continue;

    const text = readText(f);
    const lines = text.split(/\r?\n/);
    const hits = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const noComment = stripLineCommentsTs(raw);

      // Only flag likely HTML/template contexts.
      // This avoids false positives in comments like: // avoid style="..." in templates
      const hasStyleToken = inlineStyleTokenRegex.test(noComment);
      if (!hasStyleToken) continue;

      const looksLikeHtml = /<\w/.test(noComment) && htmlLikeContextsRegex.test(noComment);
      if (!looksLikeHtml) continue;

      hits.push({ line: i + 1, preview: raw.trim().slice(0, 200) });
    }

    if (hits.length) {
      ok = false;
      console.error(`\n[style-guard] Inline style attribute found in ${r}`);
      for (const h of hits.slice(0, 10)) {
        console.error(`  ${h.line}: ${h.preview}`);
      }
      if (hits.length > 10) console.error(`  … +${hits.length - 10} more`);
    }
  }
}

// 2) Hardcoded hex colors in CSS outside token files
const stylesDir = path.join(repoRoot, 'src', 'frontend', 'styles');
if (fs.existsSync(stylesDir)) {
  const files = walk(stylesDir).filter(f => f.endsWith('.css'));

  // We want to push hex usage into tokens, so keep it tight.
  const cssHexRegex = /#[0-9a-fA-F]{3,8}\b/;

  const hexAllowList = new Set([
    'src/frontend/styles/system/tokens.css',
    'src/frontend/styles/variables.css'
  ]);

  for (const f of files) {
    const r = rel(f);
    if (hexAllowList.has(r)) continue;

    const text = readText(f);
    const hits = findMatches(f, text, cssHexRegex);
    if (hits.length) {
      ok = false;
      console.error(`\n[style-guard] Hardcoded hex color(s) found in ${r}`);
      for (const h of hits.slice(0, 10)) {
        console.error(`  ${h.line}: ${h.preview}`);
      }
      if (hits.length > 10) console.error(`  … +${hits.length - 10} more`);
    }
  }
}

if (!ok) {
  const msg = '\n[style-guard] FOUND issues — migrate inline styles / hex colors to tokens + primitives.';
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  console.warn('[style-guard] Non-strict mode: not failing the build. (Run with --strict to enforce)');
  process.exit(0);
}

console.log('[style-guard] OK');
