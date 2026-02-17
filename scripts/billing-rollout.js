#!/usr/bin/env node
/**
 * Purpose:
 *   One-time migration helper that sets unlimited_balance=true on every existing
 *   project so they are grandfathered in when the billing system goes live.
 *   New projects created after rollout will start with balance=0 (blocked).
 *
 * Responsibilities:
 *   - Verify that billing columns (unlimited_balance, balance_eur) exist
 *   - Identify projects that still have unlimited_balance=false
 *   - Update those projects in-place (or preview changes in --dry-run mode)
 *   - Print a summary with success/failure counts
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Supabase admin client for project queries/updates
 *
 * Side effects:
 *   - Modifies the unlimited_balance and updated_at columns on project rows
 *   - In --dry-run mode, no writes are performed
 *
 * Notes:
 *   - Must be run AFTER migrations 069 and 070 have been applied
 *   - Idempotent: already-unlimited projects are skipped
 *   - Exits with code 1 if any updates fail, so CI can gate on the result
 *
 * Usage:
 *   node scripts/billing-rollout.js            # apply changes
 *   node scripts/billing-rollout.js --dry-run  # preview only
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from src/.env
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

// Configuration
const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function main() {
    console.log('='.repeat(60));
    console.log('Billing Rollout Script');
    console.log('='.repeat(60));
    console.log();
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        console.log('Please ensure .env file has these variables set.');
        process.exit(1);
    }
    
    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
        console.log();
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    try {
        // Check if columns exist
        console.log('Checking if billing columns exist...');
        const { data: testProject, error: testError } = await supabase
            .from('projects')
            .select('id, unlimited_balance, balance_eur')
            .limit(1);
        
        if (testError) {
            if (testError.message.includes('column') || testError.code === '42703') {
                console.error('ERROR: Billing columns not found. Please run migrations 069 and 070 first.');
                process.exit(1);
            }
            throw testError;
        }
        console.log('✓ Billing columns exist');
        console.log();
        
        // Get all projects
        console.log('Fetching all projects...');
        const { data: projects, error: fetchError } = await supabase
            .from('projects')
            .select('id, name, unlimited_balance, balance_eur')
            .order('created_at', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        console.log(`Found ${projects.length} projects`);
        console.log();
        
        // Count projects to update
        const toUpdate = projects.filter(p => !p.unlimited_balance);
        const alreadyUnlimited = projects.filter(p => p.unlimited_balance);
        
        console.log(`Projects already unlimited: ${alreadyUnlimited.length}`);
        console.log(`Projects to update: ${toUpdate.length}`);
        console.log();
        
        if (toUpdate.length === 0) {
            console.log('✓ All projects are already set to unlimited. Nothing to do.');
            return;
        }
        
        // Show projects to update
        console.log('Projects to update:');
        console.log('-'.repeat(60));
        for (const project of toUpdate) {
            console.log(`  - ${project.name || 'Unnamed'} (${project.id})`);
            console.log(`    Balance: €${project.balance_eur || 0}`);
        }
        console.log('-'.repeat(60));
        console.log();
        
        if (isDryRun) {
            console.log('🔍 DRY RUN: Would update these projects to unlimited_balance=true');
            console.log();
            console.log('Run without --dry-run to apply changes.');
            return;
        }
        
        // Update projects
        console.log('Updating projects...');
        
        let updated = 0;
        let failed = 0;
        
        for (const project of toUpdate) {
            const { error: updateError } = await supabase
                .from('projects')
                .update({ 
                    unlimited_balance: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', project.id);
            
            if (updateError) {
                console.error(`  ✗ Failed to update ${project.name}: ${updateError.message}`);
                failed++;
            } else {
                console.log(`  ✓ Updated: ${project.name}`);
                updated++;
            }
        }
        
        console.log();
        console.log('='.repeat(60));
        console.log('Summary:');
        console.log(`  Updated: ${updated}`);
        console.log(`  Failed: ${failed}`);
        console.log(`  Skipped (already unlimited): ${alreadyUnlimited.length}`);
        console.log('='.repeat(60));
        
        if (failed > 0) {
            console.log();
            console.log('⚠️  Some updates failed. Please check the errors above.');
            process.exit(1);
        }
        
        console.log();
        console.log('✓ Rollout complete! All existing projects are now set to unlimited.');
        console.log();
        console.log('Next steps:');
        console.log('1. New projects will start with balance=0 (blocked) by default');
        console.log('2. Use the Admin Panel to configure balance limits per project');
        console.log('3. Set unlimited=false and add balance for projects you want to limit');
        
    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    }
}

main();
