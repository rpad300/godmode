#!/usr/bin/env node
/**
 * Delete all projects from Supabase for testing
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

async function main() {
    console.log('='.repeat(60));
    console.log('Deleting all Supabase projects for testing');
    console.log('='.repeat(60));

    // List all projects
    const { data: projects, error: listError } = await supabase
        .from('projects')
        .select('id, name, legacy_id');

    if (listError) {
        console.error('Error listing projects:', listError.message);
        process.exit(1);
    }

    console.log(`Found ${projects.length} project(s)`);

    for (const project of projects) {
        console.log(`\nDeleting project: ${project.name} (${project.id})`);

        // Delete project_members first (foreign key)
        const { error: memberError } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', project.id);

        if (memberError) {
            console.warn(`  Warning deleting members: ${memberError.message}`);
        } else {
            console.log('  ✓ Deleted project members');
        }

        // Delete the project
        const { error: projectError } = await supabase
            .from('projects')
            .delete()
            .eq('id', project.id);

        if (projectError) {
            console.error(`  ✗ Error deleting project: ${projectError.message}`);
        } else {
            console.log('  ✓ Deleted project');
        }
    }

    // Also clear local projects.json
    const projectsJsonPath = path.join(__dirname, '..', 'data', 'projects.json');
    if (fs.existsSync(projectsJsonPath)) {
        fs.writeFileSync(projectsJsonPath, JSON.stringify({
            projects: [],
            currentProjectId: null
        }, null, 2));
        console.log('\n✓ Cleared local projects.json');
    }

    console.log('\n' + '='.repeat(60));
    console.log('All projects deleted. Restart the server to test.');
    console.log('='.repeat(60));
}

main().catch(console.error);
