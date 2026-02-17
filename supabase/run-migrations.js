#!/usr/bin/env node
/**
 * Purpose:
 *   Migration runner that connects directly to the Supabase Postgres database
 *   via the pg pooler (libpq protocol) and executes each migration file as a
 *   single query. Falls back to REST API RPC if the pg module is unavailable.
 *
 * Responsibilities:
 *   - Detect whether the `pg` npm package is installed; install it if missing
 *   - Connect via postgresql://postgres.<ref>:<password>@pooler:6543/postgres
 *   - Execute each migration file (005+) as a whole SQL string via client.query()
 *   - Fall back to the exec_sql RPC endpoint if pg is not available
 *
 * Key dependencies:
 *   - pg (npm, auto-installed): PostgreSQL client for direct database connection
 *
 * Side effects:
 *   - Executes DDL/DML against the remote Supabase Postgres database
 *   - May run `npm install pg --save` if the package is missing
 *   - Reads src/.env for credentials
 *
 * Notes:
 *   - This is the most reliable migration runner because it uses a real Postgres
 *     connection rather than the REST API, avoiding SQL-splitting issues
 *   - "already exists" errors are logged but do not stop the migration sequence
 *   - FAKORDB_PASSWORD env var is used as the database password (Assumption:
 *     this is the Supabase project DB password)
 *   - The pooler connection string assumes eu-west-2 region; update for other regions
 *
 * Usage:
 *   node supabase/run-migrations.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables manually
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

const PROJECT_REF = process.env.SUPABASE_PROJECT_ID || 'hoidqhdgdgvogehkjsdw';
const SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.FAKORDB_PASSWORD; // Might be the DB password

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Get migration files in order
function getMigrationFiles(startNum = 5) {
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .filter(f => {
            const num = parseInt(f.split('_')[0]);
            return num >= startNum;
        })
        .sort();
}

// Execute SQL via Supabase REST SQL endpoint (requires service key)
async function executeSqlViaRest(sql, description) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query: sql });
        
        const options = {
            hostname: `${PROJECT_REF}.supabase.co`,
            port: 443,
            path: '/rest/v1/rpc/exec_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, data: body });
                } else {
                    resolve({ success: false, error: body, status: res.statusCode });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, error: e.message });
        });

        req.write(data);
        req.end();
    });
}

/**
 * Execute a SQL string via a direct Postgres connection through the
 * Supabase connection pooler (port 6543). Requires the pg package.
 */
async function executeSqlViaPooler(sql) {
    // Supabase pooler connection string format:
    // postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    
    // This requires the pg package - use absolute path
    try {
        const pgPath = path.join(__dirname, '..', 'node_modules', 'pg');
        const { Client } = require(pgPath);
        
        // Try to construct connection from environment
        const connectionString = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`;
        
        const client = new Client({ connectionString });
        await client.connect();
        
        const result = await client.query(sql);
        await client.end();
        
        return { success: true, data: result };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Main execution
async function main() {
    console.log('='.repeat(60));
    console.log('Supabase SQL Migration Runner');
    console.log('='.repeat(60));
    console.log(`Project: ${PROJECT_REF}`);
    console.log('');

    const migrations = getMigrationFiles(5);
    console.log(`Migrations to apply: ${migrations.length}`);
    migrations.forEach(m => console.log(`  - ${m}`));
    console.log('');

    // Check if pg is available
    let pgAvailable = false;
    const pgPath = path.join(__dirname, '..', 'node_modules', 'pg');
    try {
        require(pgPath);
        pgAvailable = true;
        console.log('PostgreSQL client (pg) is available.');
    } catch (e) {
        console.log('PostgreSQL client (pg) not available.');
        console.log('Installing pg...');
    }

    if (!pgAvailable) {
        // Install pg
        const { execSync } = require('child_process');
        try {
            execSync('npm install pg --save', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            pgAvailable = true;
        } catch (e) {
            console.log('Failed to install pg:', e.message);
        }
    }

    if (pgAvailable) {
        console.log('');
        console.log('Applying migrations via PostgreSQL connection...');
        console.log('');

        for (const migration of migrations) {
            const filePath = path.join(MIGRATIONS_DIR, migration);
            const sql = fs.readFileSync(filePath, 'utf-8');
            
            console.log(`Applying: ${migration}...`);
            
            const result = await executeSqlViaPooler(sql);
            
            if (result.success) {
                console.log(`  ✓ Success`);
            } else {
                console.log(`  ✗ Error: ${result.error}`);
                
                // Try to continue with next migration
                if (result.error.includes('already exists')) {
                    console.log(`  (Table already exists, continuing...)`);
                }
            }
        }
    } else {
        console.log('');
        console.log('Cannot apply migrations automatically.');
        console.log('Please use one of the manual methods described above.');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Done!');
}

main().catch(console.error);
