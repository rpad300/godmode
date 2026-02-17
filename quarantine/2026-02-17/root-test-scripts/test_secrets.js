const secrets = require('./src/supabase/secrets');
const { getAdminClient } = require('./src/supabase/client');

// Mock env
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder';

async function checkSecrets() {
    console.log('Checking System Credentials...');
    const result = await secrets.getSecret('system', 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    if (result.success) {
        console.log('Secret Found:', result.value ? 'YES (Length: ' + result.value.length + ')' : 'NO (Empty)');
    } else {
        console.log('Secret Lookup Failed:', result.error);
    }

    console.log('Checking System Config...');
    const systemConfig = require('./src/supabase/system');
    const config = await systemConfig.getSystemConfig('google_drive');
    console.log('System Config:', JSON.stringify(config, null, 2));
}

checkSecrets().then(() => process.exit(0));
