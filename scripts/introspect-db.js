#!/usr/bin/env node
/**
 * Purpose:
 *   Connects directly to the Supabase Postgres database and extracts a full
 *   schema snapshot (tables, columns, RLS policies, functions) from the public
 *   schema. Useful for auditing drift between migrations and the live database.
 *
 * Responsibilities:
 *   - Parse DATABASE_URL from src/.env
 *   - Query information_schema and pg_catalog for schema metadata
 *   - Print the report as JSON to stdout, or write to scripts/db-schema-report.json
 *
 * Key dependencies:
 *   - pg (npm): PostgreSQL client for direct database connection
 *
 * Side effects:
 *   - Opens a TCP connection to the Supabase Postgres instance (read-only queries)
 *   - Optionally writes db-schema-report.json to disk (--json flag)
 *
 * Notes:
 *   - Requires DATABASE_URL in src/.env (connection string URI from Supabase Dashboard)
 *   - SSL is used with rejectUnauthorized=false for Supabase pooler compatibility
 *   - Pair the output with code-schema-manifest.js to detect tables referenced in
 *     code but missing from the database, or vice versa
 *
 * Usage:
 *   node scripts/introspect-db.js            # prints JSON to stdout
 *   node scripts/introspect-db.js --json     # writes scripts/db-schema-report.json
 */

const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'src', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !m[1].startsWith('#')) {
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      if (val && !process.env[m[1]]) process.env[m[1]] = val;
    }
  });
}
if (process.env.SUPABASE_PROJECT_URL && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = process.env.SUPABASE_PROJECT_URL;

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Connect to Postgres, query information_schema and pg_catalog, and return
 * a structured report of tables, columns, RLS policies, and functions.
 */
async function introspect() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set in src/.env');
    console.error('Add it from Supabase Dashboard → Project Settings → Database → Connection string (URI)');
    console.error('Example: DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"');
    process.exit(1);
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const out = { tables: [], columns: [], policies: [], functions: [], at: new Date().toISOString() };

  try {
    await client.connect();
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }

  try {
    const tablesRes = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);
    out.tables = tablesRes.rows.map((r) => ({ schema: r.table_schema, name: r.table_name }));

    const colsRes = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_schema, table_name, ordinal_position
    `);
    out.columns = colsRes.rows.map((r) => ({
      schema: r.table_schema,
      table: r.table_name,
      column: r.column_name,
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      default: r.column_default
    }));

    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    out.policies = policiesRes.rows.map((r) => ({
      schema: r.schemaname,
      table: r.tablename,
      policy: r.policyname,
      permissive: r.permissive,
      roles: r.roles,
      cmd: r.cmd,
      qual: r.qual,
      with_check: r.with_check
    }));

    const funcsRes = await client.query(`
      SELECT n.nspname AS schema, p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY p.proname
    `);
    out.functions = funcsRes.rows.map((r) => ({ schema: r.schema, name: r.name }));
  } catch (err) {
    console.error('Introspection error:', err.message);
    await client.end();
    process.exit(1);
  }

  await client.end();

  const jsonOut = process.argv.includes('--json');
  if (jsonOut) {
    const reportPath = path.join(__dirname, 'db-schema-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(out, null, 2), 'utf8');
    console.log('Report written to', reportPath);
  } else {
    console.log(JSON.stringify(out, null, 2));
  }
  return out;
}

introspect().catch((err) => {
  console.error(err);
  process.exit(1);
});
