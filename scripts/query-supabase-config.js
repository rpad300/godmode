#!/usr/bin/env node
/**
 * One-off read-only script: query Supabase for config-related tables.
 * Usage: node scripts/query-supabase-config.js
 * Requires: .env with SUPABASE_PROJECT_URL and SUPABASE_PROJECT_SERVICE_ROLE_KEY
 */
const path = require('path');
const fs = require('fs');
// Load .env from src/ (project uses src/.env)
const envPath = path.join(__dirname, '..', 'src', '.env');
try {
  require('dotenv').config({ path: envPath });
} catch (_) {
  // Fallback: parse .env manually if dotenv not installed
  if (!process.env.SUPABASE_PROJECT_URL && fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const val = m[2].replace(/^["']|["']$/g, '').trim();
        process.env[m[1]] = val;
      }
    });
  }
}
if (!process.env.SUPABASE_PROJECT_URL && process.env.SUPABASE_URL) {
  process.env.SUPABASE_PROJECT_URL = process.env.SUPABASE_URL;
}
if (!process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_KEY) {
  process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;
}

const { getAdminClient } = require('../src/supabase/client');
const supabase = getAdminClient();

if (!supabase) {
  console.log('Supabase not configured (missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_SERVICE_ROLE_KEY in .env)');
  process.exit(1);
}

async function run() {
  const out = [];
  try {
    const { data: sysKeys, error: e1 } = await supabase
      .from('system_config')
      .select('key, description, updated_at')
      .order('key');
    if (e1) {
      out.push('system_config: ' + e1.message);
    } else {
      out.push('=== system_config ===');
      out.push('Rows: ' + (sysKeys && sysKeys.length));
      if (sysKeys && sysKeys.length) {
        sysKeys.forEach((r) => out.push('  - ' + r.key + (r.description ? '  // ' + r.description.substring(0, 50) + '...' : '')));
      }
    }

    const { data: secMeta, error: e2 } = await supabase
      .from('secrets')
      .select('scope, name, project_id')
      .limit(100);
    if (e2) {
      out.push('secrets: ' + e2.message);
    } else {
      out.push('\n=== secrets (metadata only) ===');
      out.push('Rows: ' + (secMeta && secMeta.length));
      if (secMeta && secMeta.length) {
        secMeta.forEach((r) => out.push('  - scope=' + r.scope + ' name=' + (r.name || '') + (r.project_id ? ' project_id=' + r.project_id : '')));
      }
    }

    const { data: auditSample, error: e3 } = await supabase
      .from('config_audit_log')
      .select('config_type, config_key, action, changed_at')
      .order('changed_at', { ascending: false })
      .limit(5);
    if (e3) {
      out.push('config_audit_log: ' + e3.message);
    } else {
      out.push('\n=== config_audit_log (last 5) ===');
      out.push('Rows: ' + (auditSample && auditSample.length));
      if (auditSample && auditSample.length) {
        auditSample.forEach((r) => out.push('  - ' + r.config_type + ' ' + r.config_key + ' ' + r.action + ' @ ' + (r.changed_at || '')));
      }
    }

    const { data: projConfig, error: e4 } = await supabase.from('project_config').select('project_id').limit(1);
    if (e4) {
      out.push('project_config: ' + e4.message);
    } else {
      out.push('\n=== project_config ===');
      out.push('Table exists. Sample count: ' + (projConfig && projConfig.length));
    }

    const { data: proj, error: e5 } = await supabase.from('projects').select('id, name, settings').limit(3);
    if (e5) {
      out.push('projects: ' + e5.message);
    } else {
      out.push('\n=== projects (sample) ===');
      out.push('Rows: ' + (proj && proj.length));
      if (proj && proj.length) {
        proj.forEach((r) => {
          const settingsKeys = r.settings && typeof r.settings === 'object' ? Object.keys(r.settings) : [];
          out.push('  - ' + r.id + ' ' + (r.name || '') + ' settings keys: [' + settingsKeys.join(', ') + ']');
        });
      }
    }
  } catch (err) {
    out.push('Error: ' + err.message);
    if (err.stack) out.push(err.stack);
  }
  console.log(out.join('\n'));
}

run();
