#!/usr/bin/env node
/**
 * Purpose:
 *   Promotes an existing Supabase auth user to the superadmin role by upserting
 *   their user_profiles row with role='superadmin'.
 *
 * Responsibilities:
 *   - Look up the user by email via Supabase Auth Admin API
 *   - Display the current profile (if any) for confirmation
 *   - Upsert user_profiles with role='superadmin'
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Supabase admin client (auth.admin.listUsers, from().upsert)
 *
 * Side effects:
 *   - Modifies the user_profiles row in Supabase for the target user
 *
 * Notes:
 *   - Requires SUPABASE_PROJECT_URL and SUPABASE_PROJECT_SERVICE_ROLE_KEY in src/.env
 *   - The script lists all users if the target email is not found, for debugging
 *   - Upsert on conflict='id' ensures this works whether or not a profile exists
 *
 * Usage:
 *   node scripts/make-superadmin.js <email>
 *   node scripts/make-superadmin.js system@godmode.local
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

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2];

if (!email) {
    console.log('Usage: node scripts/make-superadmin.js <email>');
    console.log('Example: node scripts/make-superadmin.js system@godmode.local');
    process.exit(1);
}

async function main() {
    console.log('============================================================');
    console.log('Make User Superadmin');
    console.log('============================================================');
    console.log();
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('ERROR: Missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_SERVICE_ROLE_KEY');
        process.exit(1);
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    try {
        // Find user by email
        console.log(`Looking for user: ${email}`);
        
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
            console.error('Error listing users:', userError.message);
            process.exit(1);
        }
        
        const user = users.users.find(u => u.email === email);
        
        if (!user) {
            console.error(`User not found: ${email}`);
            console.log('Available users:');
            users.users.forEach(u => console.log(`  - ${u.email}`));
            process.exit(1);
        }
        
        console.log(`Found user: ${user.id}`);
        console.log();
        
        // Check current profile
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error checking profile:', profileError.message);
        }
        
        if (profile) {
            console.log('Current profile:');
            console.log(`  Role: ${profile.role || 'none'}`);
            console.log(`  Display name: ${profile.display_name || 'none'}`);
            console.log();
        } else {
            console.log('No profile exists yet, will create one.');
            console.log();
        }
        
        // Update or create profile with superadmin role
        const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .upsert({
                id: user.id,
                role: 'superadmin',
                email: user.email,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            })
            .select()
            .single();
        
        if (updateError) {
            console.error('Error updating profile:', updateError.message);
            process.exit(1);
        }
        
        console.log('✓ User is now superadmin!');
        console.log();
        console.log('Updated profile:');
        console.log(`  ID: ${updatedProfile.id}`);
        console.log(`  Role: ${updatedProfile.role}`);
        console.log(`  Email: ${updatedProfile.email}`);
        console.log();
        console.log('Please refresh the Admin Panel page.');
        
    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    }
}

main();
