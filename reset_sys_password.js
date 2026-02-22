
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function resetSystemPassword() {
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

    const email = 'system@godmode.local';
    const newPassword = 'GodMode2026!SystemUser';

    console.log(`Resetting password for ${email}...`);

    // 1. Get User ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log('Found user ID:', user.id);

    // 2. Update Password
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    );

    if (updateError) {
        console.error('Error updating password:', updateError);
        return;
    }

    console.log('Success! Password has been reset.');
    console.log('Email:', email);
    console.log('New Password:', newPassword);
}

resetSystemPassword().catch(console.error);
