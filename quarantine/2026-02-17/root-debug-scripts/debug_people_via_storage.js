
require('dotenv').config();
const { SupabaseStorage } = require('./src/supabase/storage');

async function debugPeople() {
    console.log('Initializing storage...');
    const storage = new SupabaseStorage();

    // storage constructor might not init everything, but it sets up this.supabase if env vars are there.
    // Let's check if storage.supabase exists

    if (!storage.supabase) {
        console.error('Storage did not initialize Supabase client. Check env vars.');
        // logging env vars (redacted)
        console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Unset');
        console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Unset');
        return;
    }

    try {
        const { data, error } = await storage.supabase
            .from('people')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching people:', error);
            return;
        }

        console.log('People record structure:');
        console.dir(data[0], { depth: null, colors: true });
    } catch (err) {
        console.error('Script error:', err);
    }
}

debugPeople();
