#!/usr/bin/env node
/**
 * Create role templates tables in Supabase
 */

const fs = require('fs');
const path = require('path');

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

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const CREATE_TABLES_SQL = `
-- Role categories
CREATE TABLE IF NOT EXISTS role_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role templates
CREATE TABLE IF NOT EXISTS role_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category_id TEXT REFERENCES role_categories(id),
    icon TEXT,
    prompt TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_templates_category ON role_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_role_templates_active ON role_templates(is_active);
`;

async function main() {
    console.log('='.repeat(60));
    console.log('Creating Role Templates Tables');
    console.log('='.repeat(60));
    console.log(`URL: ${SUPABASE_URL}`);

    // Execute SQL using RPC or direct query
    // Since Supabase JS client doesn't support direct SQL execution,
    // we need to use the REST API or the dashboard
    
    console.log('\n⚠️  The Supabase JS client cannot execute raw SQL.');
    console.log('\nPlease execute this SQL in the Supabase SQL Editor:');
    console.log('\n' + '-'.repeat(60));
    console.log(CREATE_TABLES_SQL);
    console.log('-'.repeat(60));
    console.log('\nAfter running the SQL, run:');
    console.log('  node scripts/apply-role-templates-migration.js');
    
    // Alternative: Try using fetch to the Supabase REST API
    console.log('\nAttempting to create tables via REST API...');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: CREATE_TABLES_SQL })
        });
        
        if (response.ok) {
            console.log('✓ Tables created successfully!');
        } else {
            const error = await response.text();
            console.log('REST API not available:', error.substring(0, 200));
        }
    } catch (e) {
        console.log('REST API error:', e.message);
    }
}

main().catch(console.error);
