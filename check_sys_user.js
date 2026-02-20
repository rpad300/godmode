
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSystemUser() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log('Checking for system user...');

    // Check if system user exists in auth.users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    const systemUser = users.find(u => u.email === 'system@godmode.local');

    if (systemUser) {
        console.log('System user found:');
        console.log('ID:', systemUser.id);
        console.log('Email:', systemUser.email);
        console.log('Confirmed:', systemUser.email_confirmed_at ? 'Yes' : 'No');
        console.log('Last Sign In:', systemUser.last_sign_in_at);
    } else {
        console.log('System user NOT found.');
        console.log('Found users:', users.map(u => u.email));
    }
}

checkSystemUser().catch(console.error);
