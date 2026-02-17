#!/usr/bin/env node
/**
 * Purpose:
 *   Reads SQL migration files from supabase/migrations/ and attempts to apply
 *   them against a remote Supabase instance. In practice, the actual SQL
 *   execution is stubbed out and the script prints manual-application instructions.
 *
 * Responsibilities:
 *   - Load Supabase credentials from src/.env
 *   - Test the Supabase connection via auth.getSession()
 *   - Enumerate and sort .sql files from supabase/migrations/
 *   - Split each file into individual SQL statements (basic semicolon split)
 *   - Print step-by-step instructions for manual application via Dashboard or CLI
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Supabase client (used for connection test only)
 *
 * Side effects:
 *   - Makes an auth request to the Supabase API to verify connectivity
 *   - Reads .env and migration SQL files from disk
 *
 * Notes:
 *   - The actual SQL execution loop is a no-op (increments successCount but does
 *     not call any RPC). This is intentional -- see the manual instructions printed
 *     at the end. For automated execution, use supabase/run-migrations.js instead.
 *   - Requires SUPABASE_PROJECT_URL and SUPABASE_PROJECT_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/apply-migrations.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', 'src', '.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?(.+?)["']?\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2];
        }
    });
}

const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

/**
 * Enumerates migration files, splits them into statements, and logs the count.
 * Actual execution is a no-op; see the manual instructions printed afterward.
 */
async function applyMigrations() {
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
        console.error('Migrations directory not found:', migrationsDir);
        process.exit(1);
    }
    
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    
    console.log(`Found ${files.length} migration file(s)`);
    console.log('');
    
    for (const file of files) {
        console.log(`Applying: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        // Split SQL into statements (basic split, handles most cases)
        const statements = sql
            .split(/;\s*$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`  ${statements.length} statements to execute`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const statement of statements) {
            if (!statement.trim()) continue;
            
            try {
                // Use rpc to execute raw SQL (requires pg_execute_sql function or direct connection)
                // For now, we'll log instructions for manual execution
                // In production, use supabase CLI or direct pg connection
                successCount++;
            } catch (err) {
                console.error(`  Error: ${err.message}`);
                errorCount++;
            }
        }
        
        console.log(`  Completed: ${successCount} statements`);
        if (errorCount > 0) {
            console.log(`  Errors: ${errorCount}`);
        }
        console.log('');
    }
    
    console.log('---------------------------------------------------');
    console.log('IMPORTANT: The migrations need to be applied manually');
    console.log('');
    console.log('Option 1: Supabase Dashboard');
    console.log('  1. Go to https://supabase.com/dashboard');
    console.log('  2. Select your project: ' + SUPABASE_URL);
    console.log('  3. Go to SQL Editor');
    console.log('  4. Paste the contents of:');
    console.log('     supabase/migrations/001_initial_schema.sql');
    console.log('  5. Run the query');
    console.log('');
    console.log('Option 2: Supabase CLI');
    console.log('  npm install -g supabase');
    console.log('  supabase link --project-ref hoidqhdgdgvogehkjsdw');
    console.log('  supabase db push');
    console.log('');
    console.log('---------------------------------------------------');
}

/** Verify Supabase reachability by calling auth.getSession(). */
async function testConnection() {
    console.log('Testing Supabase connection...');
    console.log('URL:', SUPABASE_URL);
    console.log('');
    
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.log('Auth check:', error.message);
        } else {
            console.log('Connection successful!');
        }
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

async function main() {
    await testConnection();
    console.log('');
    await applyMigrations();
}

main().catch(console.error);
