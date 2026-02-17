#!/usr/bin/env node
/**
 * Purpose:
 *   One-time bootstrap script that creates the default Supabase project, system
 *   user, user profile, and project membership needed for local development.
 *
 * Responsibilities:
 *   - Check if a project with LEGACY_PROJECT_ID already exists (idempotent)
 *   - Create a system auth user (system@godmode.local) via Supabase Admin API
 *   - Upsert a user_profiles row with role=superadmin
 *   - Insert a projects row with the legacy_id for backward compatibility
 *   - Add the owner as a project_member with role=owner
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Supabase admin client for auth and table operations
 *
 * Side effects:
 *   - Creates rows in auth.users, user_profiles, projects, and project_members
 *   - Reads src/.env for Supabase credentials
 *
 * Notes:
 *   - Idempotent: re-running when the project already exists is safe (early return)
 *   - The hardcoded SYSTEM_PASSWORD is for local/dev only; rotate for any shared env
 *   - LEGACY_PROJECT_ID ('3ab44397') ties the new UUID-based project to the legacy
 *     local-file-based project ID
 *
 * Usage:
 *   node scripts/setup-supabase-project.js
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

const LEGACY_PROJECT_ID = '3ab44397';
const PROJECT_NAME = 'Default Project';
const SYSTEM_EMAIL = 'system@godmode.local';
const SYSTEM_PASSWORD = 'GodMode2026!SystemUser';

async function main() {
    console.log('='.repeat(60));
    console.log('Supabase Project Setup');
    console.log('='.repeat(60));
    console.log(`URL: ${SUPABASE_URL}`);
    console.log(`Legacy Project ID: ${LEGACY_PROJECT_ID}`);
    console.log('');

    // Step 1: Check if project already exists
    console.log('Step 1: Checking for existing project...');
    const { data: existingProject } = await supabase
        .from('projects')
        .select('*')
        .eq('legacy_id', LEGACY_PROJECT_ID)
        .single();

    if (existingProject) {
        console.log(`  ✓ Project already exists: ${existingProject.name} (${existingProject.id})`);
        console.log('');
        console.log('='.repeat(60));
        console.log('Setup complete! No changes needed.');
        console.log('='.repeat(60));
        return;
    }

    // Step 2: Create or find system user
    console.log('Step 2: Creating system user...');
    
    // Try to create user via admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: SYSTEM_EMAIL,
        password: SYSTEM_PASSWORD,
        email_confirm: true,
        user_metadata: {
            username: 'system',
            display_name: 'System User'
        }
    });

    let userId;
    
    if (authError) {
        if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
            console.log('  User already exists, fetching...');
            
            // Find existing user
            const { data: users } = await supabase.auth.admin.listUsers();
            const systemUser = users?.users?.find(u => u.email === SYSTEM_EMAIL);
            
            if (systemUser) {
                userId = systemUser.id;
                console.log(`  ✓ Found existing user: ${userId}`);
            } else {
                console.error('  ✗ Could not find system user');
                process.exit(1);
            }
        } else {
            console.error(`  ✗ Error creating user: ${authError.message}`);
            process.exit(1);
        }
    } else {
        userId = authData.user.id;
        console.log(`  ✓ Created user: ${userId}`);
    }

    // Step 3: Ensure user profile exists
    console.log('Step 3: Ensuring user profile...');
    
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
            id: userId,
            username: 'system',
            display_name: 'System User',
            role: 'superadmin'
        }, { onConflict: 'id' })
        .select()
        .single();

    if (profileError) {
        console.error(`  ✗ Error creating profile: ${profileError.message}`);
    } else {
        console.log(`  ✓ User profile ready: ${profile.username}`);
    }

    // Step 4: Create project
    console.log('Step 4: Creating project...');
    
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
            name: PROJECT_NAME,
            owner_id: userId,
            legacy_id: LEGACY_PROJECT_ID,
            settings: {
                migratedFrom: 'local',
                originalId: LEGACY_PROJECT_ID,
                createdAt: new Date().toISOString()
            }
        })
        .select()
        .single();

    if (projectError) {
        console.error(`  ✗ Error creating project: ${projectError.message}`);
        process.exit(1);
    }

    console.log(`  ✓ Created project: ${project.name} (${project.id})`);

    // Step 5: Add owner as project member
    console.log('Step 5: Adding owner as project member...');
    
    const { error: memberError } = await supabase
        .from('project_members')
        .upsert({
            project_id: project.id,
            user_id: userId,
            role: 'owner'
        }, { onConflict: 'project_id,user_id' });

    if (memberError) {
        console.warn(`  ⚠ Warning: ${memberError.message}`);
    } else {
        console.log('  ✓ Owner added as project member');
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Setup Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Project Details:');
    console.log(`  Name: ${project.name}`);
    console.log(`  UUID: ${project.id}`);
    console.log(`  Legacy ID: ${project.legacy_id}`);
    console.log(`  Owner: ${SYSTEM_EMAIL}`);
    console.log('');
    console.log('You can now restart the server with: npm run restart');
}

main().catch(console.error);
