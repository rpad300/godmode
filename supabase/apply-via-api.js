#!/usr/bin/env node
/**
 * Purpose:
 *   Migration runner that uses the exec_raw_sql RPC function to apply SQL
 *   migrations over HTTPS. Includes a proper dollar-quote-aware SQL statement
 *   splitter for PL/pgSQL function bodies.
 *
 * Responsibilities:
 *   - Test whether exec_raw_sql RPC exists on the target Supabase project
 *   - If missing, print the CREATE FUNCTION DDL and exit with setup instructions
 *   - Split each migration file into individual statements (dollar-quote aware)
 *   - Execute each statement via HTTPS POST to the RPC endpoint
 *
 * Key dependencies:
 *   - Node.js https module: direct HTTPS requests to Supabase REST API
 *
 * Side effects:
 *   - Executes DDL/DML statements against the remote Supabase Postgres database
 *   - Reads src/.env for credentials
 *
 * Notes:
 *   - PROJECT_REF is hardcoded to 'hoidqhdgdgvogehkjsdw'; update for other projects
 *   - The splitSqlStatements function correctly handles $$ and $tag$ dollar quoting,
 *     making it safer for PL/pgSQL than the simpler splitter in apply-migrations.js
 *   - "already exists" errors are silently counted as failures but do not abort
 *   - Requires the exec_raw_sql SECURITY DEFINER function to be created first
 *     (see SETUP_SQL constant or the printed instructions)
 *
 * Usage:
 *   node supabase/apply-via-api.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const envPath = path.join(__dirname, '..', 'src', '.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.+?)"?\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    });
}

const PROJECT_REF = 'hoidqhdgdgvogehkjsdw';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.FAKORDB_PASSWORD;

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Get migration files
function getMigrationFiles(startNum = 5) {
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .filter(f => {
            const num = parseInt(f.split('_')[0]);
            return num >= startNum;
        })
        .sort();
}

/**
 * POST a SQL query to the exec_raw_sql RPC endpoint over HTTPS.
 * Returns { success: true } on 2xx, or { success: false, needsSetup: true }
 * on 404 (function not found), or { success: false, error } otherwise.
 */
async function executeSql(sql) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ query: sql });

        const options = {
            hostname: `${PROJECT_REF}.supabase.co`,
            port: 443,
            path: '/rest/v1/rpc/exec_raw_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Length': Buffer.byteLength(postData),
                'Prefer': 'return=minimal'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true });
                } else if (res.statusCode === 404) {
                    // Function doesn't exist, need to create it first
                    resolve({ success: false, needsSetup: true, error: body });
                } else {
                    resolve({ success: false, error: body, status: res.statusCode });
                }
            });
        });

        req.on('error', e => resolve({ success: false, error: e.message }));
        req.write(postData);
        req.end();
    });
}

// Create the exec_raw_sql function (needs to be done via dashboard first)
const SETUP_SQL = `
-- This function needs to be created via Supabase Dashboard SQL Editor first
CREATE OR REPLACE FUNCTION exec_raw_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;
`;

/**
 * Split a SQL string into individual statements, correctly handling
 * dollar-quoted blocks ($$ ... $$ or $tag$ ... $tag$) so PL/pgSQL
 * function bodies are not broken at internal semicolons.
 */
function splitSqlStatements(sql) {
    // Remove comments
    let cleaned = sql.replace(/--[^\n]*/g, '');
    
    // Split on semicolons that are followed by newline and uppercase word (statement start)
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';
    
    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        
        // Check for dollar quoting
        if (char === '$' && !inDollarQuote) {
            // Look for dollar quote start
            const match = cleaned.slice(i).match(/^\$([a-zA-Z_]*)\$/);
            if (match) {
                inDollarQuote = true;
                dollarTag = match[0];
                current += dollarTag;
                i += dollarTag.length - 1;
                continue;
            }
        } else if (inDollarQuote && cleaned.slice(i).startsWith(dollarTag)) {
            current += dollarTag;
            i += dollarTag.length - 1;
            inDollarQuote = false;
            dollarTag = '';
            continue;
        }
        
        if (char === ';' && !inDollarQuote) {
            current += char;
            const trimmed = current.trim();
            if (trimmed && trimmed !== ';') {
                statements.push(trimmed);
            }
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add any remaining content
    const trimmed = current.trim();
    if (trimmed && trimmed !== ';') {
        statements.push(trimmed + ';');
    }
    
    return statements.filter(s => s.length > 5); // Filter out tiny fragments
}

// Main
async function main() {
    console.log('='.repeat(60));
    console.log('Supabase Migration Applicator');
    console.log('='.repeat(60));
    console.log(`Project: ${PROJECT_REF}`);
    console.log('');

    const migrations = getMigrationFiles(5);
    console.log(`Migrations to apply: ${migrations.length}`);
    migrations.forEach(m => console.log(`  - ${m}`));
    console.log('');

    // Test if exec_raw_sql exists
    console.log('Testing SQL execution capability...');
    const testResult = await executeSql('SELECT 1;');
    
    if (testResult.needsSetup) {
        console.log('');
        console.log('='.repeat(60));
        console.log('SETUP REQUIRED');
        console.log('='.repeat(60));
        console.log('');
        console.log('The exec_raw_sql function needs to be created first.');
        console.log('Please run this SQL in Supabase Dashboard SQL Editor:');
        console.log('');
        console.log(SETUP_SQL);
        console.log('');
        console.log('After creating the function, run this script again.');
        console.log('');
        console.log('Alternatively, copy the content of:');
        console.log(`  ${path.join(__dirname, 'combined_migrations_005_011.sql')}`);
        console.log('');
        console.log('And paste it directly in the SQL Editor.');
        return;
    }

    if (!testResult.success) {
        console.log(`Connection test failed: ${testResult.error}`);
        console.log('');
        console.log('Please apply migrations manually via Supabase Dashboard.');
        console.log(`SQL file: ${path.join(__dirname, 'combined_migrations_005_011.sql')}`);
        return;
    }

    console.log('SQL execution available!');
    console.log('');

    // Apply each migration
    for (const migration of migrations) {
        console.log(`Applying: ${migration}...`);
        
        const filePath = path.join(MIGRATIONS_DIR, migration);
        const sql = fs.readFileSync(filePath, 'utf-8');
        const statements = splitSqlStatements(sql);
        
        console.log(`  Found ${statements.length} statements`);
        
        let success = 0;
        let failed = 0;
        
        for (const stmt of statements) {
            const result = await executeSql(stmt);
            if (result.success) {
                success++;
            } else {
                failed++;
                // Only log if not "already exists" error
                if (!result.error?.includes('already exists')) {
                    console.log(`  Error: ${result.error?.substring(0, 80)}...`);
                }
            }
        }
        
        console.log(`  ✓ ${success} succeeded, ${failed} failed/skipped`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Migration complete!');
}

main().catch(console.error);
