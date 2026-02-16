
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Try loading from src/.env
const envPath = path.resolve(__dirname, '../src/.env');
console.log('Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
    console.log('Could not load .env from ../src/.env, trying current directory');
    dotenv.config();
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('Available keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedAuditLogs() {
    console.log('Seeding audit logs...');

    // Action types that map to severity in our new logic:
    // error/failed -> error
    // delete/remove/revoke -> warning
    // others -> info
    const actions = [
        { action: 'user.login', details: { message: 'Successful login via SSO', method: 'google' } },
        { action: 'project.created', details: { message: 'New project "Alpha" created', id: 'prj_123' } },
        { action: 'billing.updated', details: { message: 'Updated credit card information' } },
        { action: 'api_key.revoked', details: { message: 'Revoked key for project Beta' } },
        { action: 'user.login.failed', details: { message: 'Invalid password attempt', reason: 'bad_credentials' } },
        { action: 'system.backup', details: { message: 'Daily backup completed' } },
        { action: 'role.promoted', details: { message: 'User promoted to Admin' } },
        { action: 'db.migration', details: { message: 'Applied migration v2.1' } },
        { action: 'rate_limit.exceeded', details: { message: 'Project Gamma hit rate limit' } },
        { action: 'audit.export', details: { message: 'Audit log export downloaded' } },
        { action: 'project.deleted', details: { message: 'Project "Old Beta" deleted permanently' } }
    ];

    // Get a valid user ID for the actor
    const { data: users } = await supabase.from('user_profiles').select('id').limit(1);
    const userId = users && users.length > 0 ? users[0].id : null;

    if (!userId) {
        console.log('No users found to assign as actor. Using null (system).');
    }

    const logs = [];
    for (let i = 0; i < 20; i++) {
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        const date = new Date();
        date.setHours(date.getHours() - Math.floor(Math.random() * 48)); // Last 48 hours

        // Add some minutes variance
        date.setMinutes(date.getMinutes() - Math.floor(Math.random() * 60));

        logs.push({
            created_at: date.toISOString(),
            actor_id: userId,
            action: randomAction.action,
            metadata: randomAction.details,
            ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`
        });
    }

    const { error } = await supabase.from('activity_log').insert(logs);

    if (error) {
        console.error('Error seeding logs:', error);
    } else {
        console.log('Successfully seeded 20 audit logs.');
    }
}

seedAuditLogs();
