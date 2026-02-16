
const path = require('path');
const fs = require('fs');

// Load .env first
(function loadEnvFirst() {
    const envPaths = [
        path.join(__dirname, 'src', '.env'),
    ];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
            for (const k in envConfig) {
                process.env[k] = envConfig[k];
            }
        }
    }
})();

const { getClient } = require('./src/supabase/client');

(async () => {
    const supabase = getClient();
    if (!supabase) {
        console.error('Supabase client failed to initialize');
        return;
    }
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data && data.length > 0) {
            console.log('Sample row:', data[0]);
            console.log('Keys:', Object.keys(data[0]));
        } else {
            console.log('Table is empty or no data returned');
            // Check columns via information schema if empty (requires different query but simple select usually enough to see keys if row exists)
            // But we know row exists from curl.
        }
    }
})();
