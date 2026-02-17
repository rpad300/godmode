#!/usr/bin/env node
/**
 * Purpose:
 *   End-to-end smoke test for the company analysis API. Lists companies, finds
 *   one by name or UUID, triggers POST /api/companies/:id/analyze, and prints
 *   the resulting brand-asset report summary.
 *
 * Responsibilities:
 *   - Authenticate against the running server using a Supabase JWT
 *   - Fetch the company list and locate the target by name or UUID
 *   - POST to /api/companies/:id/analyze and display key result fields
 *
 * Key dependencies:
 *   - Running GodMode server on localhost:<PORT> (default 3005)
 *   - A valid Supabase access_token (JWT) for authentication
 *
 * Side effects:
 *   - Makes authenticated HTTP requests to the local server
 *   - The /analyze endpoint may trigger LLM calls and write results to the DB
 *
 * Notes:
 *   - The auth token can be passed as CLI arg #2 or via TEST_AUTH_TOKEN env var
 *   - To obtain a token: log in at the app, open DevTools > Application >
 *     Local Storage, find sb-<project>-auth-token, copy access_token
 *   - Defaults to searching for company name "CGI" if no arg is provided
 *
 * Usage:
 *   node scripts/test-company-analyze.js [companyNameOrId] [accessToken]
 *   TEST_AUTH_TOKEN=<jwt> node scripts/test-company-analyze.js CGI
 */

const path = require('path');
const fs = require('fs');

// Load .env from project root or src/
const envPaths = [
  path.join(__dirname, '..', 'src', '.env'),
  path.join(__dirname, '..', '.env'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    });
    break;
  }
}

const PORT = process.env.PORT || 3005;
const BASE = `http://localhost:${PORT}`;
const companyArg = process.argv[2] || 'CGI';
const token = process.argv[3] || process.env.TEST_AUTH_TOKEN;

async function main() {
  if (!token) {
    console.error('Missing auth token.');
    console.error('  Get it: log in at http://localhost:3005, then DevTools > Application > Local Storage');
    console.error('  Find key like sb-<project>-auth-token, copy the access_token value.');
    console.error('  Usage: node scripts/test-company-analyze.js [CGI] <access_token>');
    console.error('  Or:    set TEST_AUTH_TOKEN=<token> then run with company name.');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('Fetching companies...');
  const listRes = await fetch(`${BASE}/api/companies`, { headers });
  if (!listRes.ok) {
    console.error('List companies failed:', listRes.status, await listRes.text());
    process.exit(1);
  }
  const listData = await listRes.json();
  const companies = listData.companies || [];
  if (companies.length === 0) {
    console.error('No companies found. Create one in the app first (e.g. CGI with website/LinkedIn).');
    process.exit(1);
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyArg);
  const company = isUuid
    ? companies.find((c) => c.id === companyArg)
    : companies.find((c) => c.name && c.name.toLowerCase().includes(companyArg.toLowerCase()));

  if (!company) {
    console.error('Company not found:', companyArg);
    console.error('Available:', companies.map((c) => c.name).join(', '));
    process.exit(1);
  }

  console.log('Analyzing company:', company.name, '(' + company.id + ')');
  const analyzeRes = await fetch(`${BASE}/api/companies/${company.id}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const analyzeBody = await analyzeRes.json().catch(() => ({}));

  if (!analyzeRes.ok) {
    console.error('Analyze failed:', analyzeRes.status, analyzeBody.error || analyzeBody);
    process.exit(1);
  }

  console.log('Analysis complete.');
  if (analyzeBody.company) {
    const c = analyzeBody.company;
    const ba = c.brand_assets || {};
    console.log('  Analyzed at:', ba.analyzed_at);
    console.log('  AI context:', (ba.ai_context || '').slice(0, 120) + '...');
    if (ba.analysis_report) {
      console.log('  Report sections:', Object.keys(ba.analysis_report).length);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
