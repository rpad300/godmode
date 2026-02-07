#!/usr/bin/env node
/**
 * Apply Supabase Migrations Script
 * Executes SQL migration files directly against Supabase
 */

const fs = require('fs');
const path = require('path');

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

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_PROJECT_URL and SUPABASE_PROJECT_SERVICE_ROLE_KEY must be set');
    process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Get migration files in order
function getMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
    return files;
}

// Execute SQL via Supabase REST API
async function executeSql(sql, migrationName) {
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);
    
    // Try using the pg extension directly via REST
    // Actually, we need to use the management API or SQL directly
    
    // Alternative: Use the Supabase JS client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        db: {
            schema: 'public'
        },
        auth: {
            persistSession: false
        }
    });

    // Split SQL into statements (basic split by semicolon)
    // This is a simplified approach - production should use proper SQL parsing
    const statements = sql
        .split(/;(?=(?:[^']*'[^']*')*[^']*$)/) // Split on ; not inside quotes
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`  Found ${statements.length} SQL statements`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        // Skip empty statements and comments
        if (!stmt || stmt.startsWith('--')) continue;

        try {
            // Use rpc to execute raw SQL
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
            
            if (error) {
                // Try alternative: direct query via pg_dump style
                // Some statements might fail if exec_sql doesn't exist
                console.log(`  Statement ${i + 1}: Error - ${error.message}`);
                errorCount++;
            } else {
                successCount++;
            }
        } catch (e) {
            // Ignore individual statement errors (some might already exist)
            if (!e.message.includes('already exists')) {
                console.log(`  Statement ${i + 1}: ${e.message.substring(0, 50)}...`);
            }
            errorCount++;
        }
    }

    return { successCount, errorCount };
}

// Apply migrations using direct SQL execution via REST
async function applyMigrationViaRest(migrationFile, sql) {
    const url = `${SUPABASE_URL}/rest/v1/`;
    
    // For direct SQL execution, we need to use the SQL Editor API
    // or the Management API. The REST API doesn't support raw SQL.
    
    // Alternative approach: Use @supabase/supabase-js with rpc
    console.log(`  Attempting to apply via Supabase client...`);
    
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // Try to create a helper function first
        const createHelperSql = `
            CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
            RETURNS VOID AS $$
            BEGIN
                EXECUTE sql_query;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;
        
        // This won't work directly - we need Management API
        // Let's output the SQL to be run manually
        console.log(`  NOTE: Direct SQL execution requires Management API access.`);
        console.log(`  Please run the migration manually in Supabase Dashboard > SQL Editor.`);
        
        return { success: false, manual: true };
    } catch (e) {
        console.log(`  Error: ${e.message}`);
        return { success: false, error: e.message };
    }
}

// Main
async function main() {
    console.log('='.repeat(60));
    console.log('Supabase Migration Runner');
    console.log('='.repeat(60));
    console.log(`URL: ${SUPABASE_URL}`);
    console.log(`Migrations: ${MIGRATIONS_DIR}`);
    console.log('');

    const migrations = getMigrationFiles();
    console.log(`Found ${migrations.length} migration files:`);
    migrations.forEach(m => console.log(`  - ${m}`));
    console.log('');

    // Check which migrations to apply (005 onwards are the new ones)
    const newMigrations = migrations.filter(m => {
        const num = parseInt(m.split('_')[0]);
        return num >= 5; // Only apply 005 onwards (the new ones)
    });

    console.log(`New migrations to apply (005+): ${newMigrations.length}`);
    console.log('');

    // Since direct SQL execution via REST API requires special setup,
    // we'll output instructions for manual application
    console.log('='.repeat(60));
    console.log('MANUAL APPLICATION REQUIRED');
    console.log('='.repeat(60));
    console.log('');
    console.log('The Supabase REST API does not support direct SQL execution.');
    console.log('Please apply migrations manually using one of these methods:');
    console.log('');
    console.log('Option 1: Supabase Dashboard (Recommended)');
    console.log('  1. Go to: https://supabase.com/dashboard/project/hoidqhdgdgvogehkjsdw/sql');
    console.log('  2. Copy/paste each migration file and run');
    console.log('');
    console.log('Option 2: Supabase CLI (requires login)');
    console.log('  1. Run: npx supabase login');
    console.log('  2. Run: npx supabase db push');
    console.log('');
    console.log('Option 3: Direct psql connection');
    console.log('  1. Get connection string from Supabase Dashboard > Settings > Database');
    console.log('  2. Run: psql "postgresql://..." -f migrations/005_knowledge_tables.sql');
    console.log('');

    // Output combined SQL for easy copy/paste
    console.log('='.repeat(60));
    console.log('COMBINED SQL OUTPUT');
    console.log('='.repeat(60));
    console.log('');
    
    const outputFile = path.join(__dirname, 'combined_migrations_005_011.sql');
    let combinedSql = '-- Combined Supabase Migrations (005-011)\n';
    combinedSql += '-- Generated: ' + new Date().toISOString() + '\n\n';

    for (const migration of newMigrations) {
        const filePath = path.join(MIGRATIONS_DIR, migration);
        const sql = fs.readFileSync(filePath, 'utf-8');
        
        combinedSql += `-- ============================================\n`;
        combinedSql += `-- Migration: ${migration}\n`;
        combinedSql += `-- ============================================\n\n`;
        combinedSql += sql;
        combinedSql += '\n\n';
    }

    fs.writeFileSync(outputFile, combinedSql);
    console.log(`Combined SQL written to: ${outputFile}`);
    console.log(`Total size: ${Math.round(combinedSql.length / 1024)} KB`);
    console.log('');
    console.log('Copy this file content to Supabase SQL Editor to apply all migrations.');
}

main().catch(console.error);
