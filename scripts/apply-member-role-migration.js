#!/usr/bin/env node
/**
 * Apply member user_role migration
 * Adds user_role column to project_members table
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    console.log('='.repeat(60));
    console.log('Member User Role Migration');
    console.log('='.repeat(60));

    // Check if column already exists by trying to select it
    console.log('\nStep 1: Checking if user_role column exists...');
    
    const { data, error } = await supabase
        .from('project_members')
        .select('user_role')
        .limit(1);
    
    if (error && error.message.includes('user_role')) {
        console.log('  Column does not exist. Please run this SQL in Supabase Dashboard:');
        console.log('\n' + '-'.repeat(60));
        console.log(`
ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS user_role_prompt TEXT,
ADD COLUMN IF NOT EXISTS role_template_id TEXT;

CREATE INDEX IF NOT EXISTS idx_project_members_user_role ON project_members(user_role);
`);
        console.log('-'.repeat(60));
        return;
    }
    
    console.log('  ✓ Column exists or was added');

    // Step 2: Migrate existing project roles to members
    console.log('\nStep 2: Migrating existing project roles to members...');
    
    // Get all projects with userRole in settings
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, settings');
    
    if (projectsError) {
        console.log('  Error fetching projects:', projectsError.message);
        return;
    }

    let migrated = 0;
    for (const project of projects || []) {
        const userRole = project.settings?.userRole;
        const userRolePrompt = project.settings?.userRolePrompt;
        
        if (userRole) {
            // Update all members of this project with the role
            // (Since we only have one member per project typically, this is fine)
            const { error: updateError } = await supabase
                .from('project_members')
                .update({ 
                    user_role: userRole,
                    user_role_prompt: userRolePrompt || null
                })
                .eq('project_id', project.id);
            
            if (updateError) {
                console.log(`  ⚠ Error migrating project ${project.id}: ${updateError.message}`);
            } else {
                migrated++;
            }
        }
    }
    
    console.log(`  ✓ Migrated ${migrated} project(s)`);

    // Verify
    console.log('\nStep 3: Verifying...');
    const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select('project_id, user_id, role, user_role');
    
    if (membersError) {
        console.log('  Error:', membersError.message);
    } else {
        console.log(`  ✓ ${members.length} member(s) in database`);
        members.forEach(m => {
            console.log(`    - Project ${m.project_id.substring(0, 8)}... : ${m.user_role || '(no role)'} [access: ${m.role}]`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration complete!');
    console.log('='.repeat(60));
}

main().catch(console.error);
