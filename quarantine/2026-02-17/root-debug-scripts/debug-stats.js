
require('dotenv').config({ path: 'src/.env' });
const { createSyncCompatStorage } = require('./src/storageCompat');
const path = require('path');
const fs = require('fs');

async function main() {
    console.log('--- Debug Storage Stats ---');
    console.log('Current Work Directory:', process.cwd());

    // Setup paths similar to server.js
    const BASE_DIR = __dirname; // godmode directory (assuming script runs from root)
    const DATA_DIR = path.join(BASE_DIR, 'data');
    console.log('DATA_DIR:', DATA_DIR);

    // Ensure environment is loaded
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY missing in env');
        // Try loading from src/.env manually if dotenv failed
        try {
            const envConfig = require('dotenv').parse(fs.readFileSync(path.join(BASE_DIR, 'src', '.env')));
            for (const k in envConfig) {
                process.env[k] = envConfig[k];
            }
            console.log('Loaded env from src/.env');
        } catch (e) {
            console.error('Failed to load src/.env:', e.message);
        }
    }

    console.log('Supabase URL:', process.env.SUPABASE_URL);

    try {
        const storage = createSyncCompatStorage(DATA_DIR);

        console.log('Storage Initializing...');
        await storage.init();
        console.log('Storage Initialized.');

        console.log('--- Listing All Projects ---');
        // We need to access the underlying SupabaseStorage instance if possible, 
        // or use the compat methods if they expose project listing.
        // StorageCompat has `getProjects()` which returns local cache projects?
        // Let's try to access the `_supabase` instance directly if available.

        if (storage._supabase) {
            console.log('Using SupabaseStorage directly...');
            const projects = await storage._supabase.listProjects();
            console.log(`Found ${projects.length} projects.`);

            for (const p of projects) {
                console.log(`Project: ${p.name} (${p.id})`);
                try {
                    // Switch to project to get stats
                    // storage._supabase.setProject(p.id); // This might affect the compat layer state
                    // Better to use getProjectStats(id) if available
                    // SupabaseStorage has getProjectStats(projectId)

                    const stats = await storage._supabase.getProjectStats(p.id);
                    console.log(`  Stats: Facts=${stats?.facts || 0}, Decisions=${stats?.decisions || 0}, Actions=${stats?.actions || 0}`);

                    if (stats && stats.facts === 312) {
                        console.log('  *** MATCH FOUND! This is the project the user is seeing. ***');
                    }
                } catch (e) {
                    console.error(`  Error getting stats for ${p.name}:`, e.message);
                }
            }
        } else {
            console.log('SupabaseStorage instance not available in Compat layer.');
            // Fallback to compat methods
            const projects = storage.getProjects();
            console.log(`Found ${projects.length} projects (Compat).`);
            console.log(projects);
        }

    } catch (err) {
        console.error('Error during execution:', err);
    }
}

main();
