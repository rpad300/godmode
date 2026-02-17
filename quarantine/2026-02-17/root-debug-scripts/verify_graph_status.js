
const path = require('path');
// Try loading from src/.env
const envPath = path.join(__dirname, 'src', '.env');
console.log('Loading env from:', envPath);
require('dotenv').config({ path: envPath });

const { SupabaseStorage } = require('./src/supabase/storage');
const { logger } = require('./src/logger');

async function main() {
    console.log('Verifying graph sync status...');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL); // Don't log key fully
    console.log('SUPABASE_SERVICE_KEY length:', process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0);

    if (!process.env.SUPABASE_URL) {
        console.error('SUPABASE_URL is missing!');
        process.exit(1);
    }

    // Manual init of SupabaseStorage
    const storage = new SupabaseStorage(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    // await storage.connect(); // Not needed/not exists

    const projectId = '4a4245b5-7084-4c14-a0a5-d9c8561404f9';

    const { data, error } = await storage.supabase
        .from('graph_sync_status')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching status:', error);
    } else {
        console.log('Status record:', JSON.stringify(data, null, 2));
    }
}

main().catch(console.error);
