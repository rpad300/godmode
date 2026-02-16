const sync = require('./src/integrations/googleDrive/sync');

// Mock environment variables for testing purposes
// In production, these should be set in the system environment
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder_key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder_key';

async function testSync() {
    console.log('Starting Sync Test...');
    // Project ID from logs: 4a46377e-eff7-4206-8ff4-9e2a12e469dc
    const projectId = '4a46377e-eff7-4206-8ff4-9e2a12e469dc';

    console.log(`Syncing Project: ${projectId}`);

    try {
        const stats = await sync.syncProject(projectId);
        console.log('Sync Result:', JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error('Sync Failed:', e);
    }
}

testSync().then(() => process.exit(0));
