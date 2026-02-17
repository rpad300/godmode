/**
 * Purpose:
 *   One-off database migration script that adds `requester_role` and
 *   `requester_role_prompt` columns to the `knowledge_questions` table
 *   in Supabase PostgreSQL.
 *
 * Responsibilities:
 *   - Connect to Supabase using the service role key (full admin access)
 *   - Execute ALTER TABLE via the `exec_sql` RPC function
 *   - Verify the columns exist by issuing a test SELECT query
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Supabase client for RPC and query access
 *   - dotenv: loads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
 *   - ./logger: structured logging
 *
 * Side effects:
 *   - Modifies the `knowledge_questions` table schema in Supabase (DDL)
 *   - Requires the `exec_sql` RPC function to exist in the database
 *
 * Notes:
 *   - Uses IF NOT EXISTS so the migration is safe to run multiple times.
 *   - Errors from ALTER are logged at debug level because they are expected
 *     when the columns already exist.
 *   - If exec_sql is not available, the script will fail; in that case run
 *     migration 036 manually via the Supabase dashboard (see log message).
 *   - This script is meant to be run directly: `node src/run-migration.js`
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const { logger } = require('./logger');
const log = logger.child({ module: 'run-migration' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Execute the migration: add two columns to knowledge_questions, then verify.
 * Logs results at appropriate levels; does not throw on partial failure so
 * the verification query always runs.
 * @throws {Error} Only if the Supabase client itself is misconfigured
 */
async function runMigration() {
  log.info({ event: 'run_migration_start' }, 'Adding requester_role columns...');

  // Run ALTER TABLE statements
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS requester_role TEXT'
  });

  if (error1) {
    log.debug({ event: 'run_migration_alter_1', message: error1.message }, 'Error 1 (may be expected if column exists)');
  }

  const { error: error2 } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS requester_role_prompt TEXT'
  });

  if (error2) {
    log.debug({ event: 'run_migration_alter_2', message: error2.message }, 'Error 2 (may be expected if column exists)');
  }

  // Test if columns exist by querying
  const { data, error: testError } = await supabase
    .from('knowledge_questions')
    .select('id, requester_role, requester_role_prompt')
    .limit(1);

  if (testError) {
    log.warn({ event: 'run_migration_columns_missing', message: testError.message }, 'Columns may not exist yet - run migration 036 manually in Supabase dashboard');
  } else {
    log.info({ event: 'run_migration_columns_ok', sample: data }, 'Columns exist');
  }
}

runMigration().catch(err => log.error({ event: 'run_migration_error', err }, 'Migration failed'));
