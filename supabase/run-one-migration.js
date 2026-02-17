#!/usr/bin/env node
/**
 * Purpose:
 *   Applies a single SQL migration file identified by its numeric prefix
 *   (e.g. 097) via a direct Postgres connection. Useful for re-running or
 *   cherry-picking individual migrations without applying the full sequence.
 *
 * Responsibilities:
 *   - Locate the migration file matching the given prefix in supabase/migrations/
 *   - Connect to the Supabase pooler via pg.Client
 *   - Execute the entire file as one query
 *   - Gracefully handle "already exists" / "duplicate key" errors
 *
 * Key dependencies:
 *   - pg (npm): PostgreSQL client for direct database connection
 *
 * Side effects:
 *   - Executes DDL/DML against the remote Supabase Postgres database
 *   - Reads .env or src/.env for credentials
 *
 * Notes:
 *   - Defaults to migration 097 if no argument is provided
 *   - Falls back through multiple env vars for the DB password:
 *     SUPABASE_DB_PASSWORD > FAKORDB_PASSWORD > PGPASSWORD
 *   - Uses DATABASE_URL if set, otherwise constructs the pooler connection string
 *   - If no password is available, prints the SQL to stderr for manual execution
 *
 * Usage:
 *   node supabase/run-one-migration.js 097
 *   node supabase/run-one-migration.js 042
 */

const fs = require('fs');
const path = require('path');

// Load .env from project root or src/.env
for (const envFile of [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', 'src', '.env')]) {
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf-8');
    content.split('\n').forEach((line) => {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.+?)"?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    });
    break;
  }
}

const migrationNum = process.argv[2] || '097';
const PROJECT_REF = process.env.SUPABASE_PROJECT_ID || process.env.SUPABASE_REF || 'hoidqhdgdgvogehkjsdw';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.FAKORDB_PASSWORD || process.env.PGPASSWORD;
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const pattern = new RegExp(`^${migrationNum}_`);
const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && pattern.test(f));
if (files.length === 0) {
  console.error(`No migration file matching ${migrationNum}_*.sql found in supabase/migrations`);
  process.exit(1);
}
const filePath = path.join(MIGRATIONS_DIR, files[0]);
const sql = fs.readFileSync(filePath, 'utf-8');

async function run() {
  if (!DB_PASSWORD) {
    console.error('Set SUPABASE_DB_PASSWORD (or PGPASSWORD / FAKORDB_PASSWORD) to run migrations.');
    console.error('Or run this SQL manually in Supabase Dashboard > SQL Editor:');
    console.error('---');
    console.error(sql);
    process.exit(1);
  }
  const { Client } = require('pg');
  const connectionString = process.env.DATABASE_URL || `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`OK: ${files[0]} applied.`);
  } catch (e) {
    if (e.message && (e.message.includes('already exists') || e.message.includes('duplicate key'))) {
      console.log(`OK (no change): ${files[0]} - ${e.message.split('\n')[0]}`);
    } else {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
