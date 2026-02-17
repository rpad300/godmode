
const path = require('path');
const fs = require('fs');

(function loadEnvFirst() {
    const envPaths = [
        path.join(__dirname, '.env'),
        path.join(__dirname, '..', '.env')
    ];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf-8');
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1); // strip BOM
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const eq = trimmed.indexOf('=');
                if (eq <= 0) return;
                const key = trimmed.slice(0, eq).trim();
                let value = trimmed.slice(eq + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                    value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value;
            });
        }
    }
})();

const { SupabaseStorage } = require('./src/supabase/storage');

async function debug() {
    console.log('Connecting to Supabase:', process.env.SUPABASE_URL);
    const storage = new SupabaseStorage(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Login as system user to bypass RLS if needed, or find a user
    const { data: { users } } = await storage.supabase.auth.admin.listUsers();
    if (users && users.length > 0) {
        await storage.setUser(users[0]);
        console.log('Logged in as:', users[0].email);
    }

    // 1. Get Project ID (assuming default or first one)
    const projects = await storage.listProjects();
    const projectId = projects[0].id;
    storage.setProject(projectId);
    console.log('Project ID:', projectId);

    // 2. Find Afonso Mendes contact
    const { data: contacts, error: contactError } = await storage.supabase
        .from('contacts')
        .select('*')
        .ilike('name', '%Afonso Mendes%')
        .eq('project_id', projectId);

    if (contactError) {
        console.error('Error finding contact:', contactError);
        return;
    }

    if (!contacts || contacts.length === 0) {
        console.log('Afonso not found in contacts');
        return;
    }

    const afonso = contacts[0];
    console.log('Afonso ID:', afonso.id);

    // 3. Call getContactMentions
    console.log('Calling getContactMentions...');
    const mentions = await storage.getContactMentions(afonso.id);
    console.log('Mentions found via getContactMentions:', mentions.length);
    // console.log(JSON.stringify(mentions, null, 2));

    // 4. Debug People Query specifically
    console.log('Debugging People Query...');
    const { data: people, error: peopleError } = await storage.supabase
        .from('people')
        .select('id, name, context_snippets')
        .eq('project_id', projectId)
        .ilike('name', 'Afonso Mendes');

    if (peopleError) {
        console.error('Error querying people:', peopleError);
    } else {
        console.log('People found matching "Afonso Mendes":', people.length);
        if (people.length > 0) {
            console.log('First person context_snippets length:', people[0].context_snippets?.length);
            console.log('First snippet:', people[0].context_snippets?.[0]);
        }
    }
}

debug().catch(console.error);
