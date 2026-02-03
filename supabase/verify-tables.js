#!/usr/bin/env node
/**
 * Verify Supabase Tables
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
const SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY;

// Expected tables from migrations 005-011
const EXPECTED_TABLES = [
    // 005_knowledge_tables
    'documents', 'facts', 'decisions', 'risks', 'action_items', 
    'knowledge_questions', 'people', 'relationships', 'embeddings',
    'processing_history', 'conversations', 'knowledge_change_log',
    // 006_contacts_teams
    'contacts', 'teams', 'team_members', 'contact_relationships', 'contact_activity',
    // 007_system_tables
    'project_config', 'stats_history', 'sot_versions', 'sot_last_view',
    'synthesized_files', 'raw_content', 'document_metadata',
    // 008_optimizations
    'query_history', 'saved_searches', 'user_feedback', 'cache_entries',
    'scheduled_jobs', 'sync_states', 'usage_analytics',
    // 009_roles_ontology
    'role_analytics', 'role_history', 'ontology_suggestions', 'ontology_schema',
    'calendar_events', 'role_templates',
    // 010_llm_costs
    'llm_cost_requests', 'llm_cost_totals', 'llm_cost_daily',
    'llm_cost_by_model', 'llm_cost_by_provider',
    // 011_sync_tables
    'delete_stats', 'delete_audit_log', 'delete_backups',
    'retention_policies', 'soft_deletes', 'archive'
];

// Check if a table exists via REST API
async function checkTable(tableName) {
    return new Promise((resolve) => {
        const options = {
            hostname: `${PROJECT_REF}.supabase.co`,
            port: 443,
            path: `/rest/v1/${tableName}?limit=0`,
            method: 'GET',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                // 200 = table exists, 404 or other = doesn't exist
                resolve({
                    table: tableName,
                    exists: res.statusCode === 200,
                    status: res.statusCode
                });
            });
        });

        req.on('error', () => resolve({ table: tableName, exists: false, error: true }));
        req.end();
    });
}

// Main
async function main() {
    console.log('='.repeat(60));
    console.log('Supabase Table Verification');
    console.log('='.repeat(60));
    console.log(`Project: ${PROJECT_REF}`);
    console.log(`Expected tables: ${EXPECTED_TABLES.length}`);
    console.log('');
    console.log('Checking tables...');
    console.log('');

    const results = await Promise.all(EXPECTED_TABLES.map(checkTable));
    
    const existing = results.filter(r => r.exists);
    const missing = results.filter(r => !r.exists);

    console.log(`✓ Tables found: ${existing.length}/${EXPECTED_TABLES.length}`);
    console.log('');

    if (existing.length > 0) {
        console.log('Existing tables:');
        existing.forEach(r => console.log(`  ✓ ${r.table}`));
        console.log('');
    }

    if (missing.length > 0) {
        console.log('Missing tables:');
        missing.forEach(r => console.log(`  ✗ ${r.table} (status: ${r.status})`));
        console.log('');
    }

    if (missing.length === 0) {
        console.log('='.repeat(60));
        console.log('SUCCESS! All tables were created correctly.');
        console.log('='.repeat(60));
    } else {
        console.log('='.repeat(60));
        console.log(`WARNING: ${missing.length} tables are missing.`);
        console.log('Please check the SQL execution for errors.');
        console.log('='.repeat(60));
    }
}

main().catch(console.error);
