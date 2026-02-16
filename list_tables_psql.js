
const { getAdminClient } = require('./src/supabase/client');

async function listTables() {
    const supabase = getAdminClient();
    const { data, error } = await supabase.rpc('get_tables');

    // Fallback if RPC doesn't exist, try querying information_schema
    // Actually, we can't query information_schema directly with supabase-js unless we have a view or RPC
    // Let's try listing from a known table to verify connectivity at least

    // Instead, let's just inspect known tables related to categories
    const potentialTables = ['categories', 'role_categories', 'project_categories'];

    for (const table of potentialTables) {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error && error.code === '42P01') { // undefined_table
            console.log(`Table '${table}' does NOT exist.`);
        } else if (!error) {
            console.log(`Table '${table}' EXISTS.`);
        } else {
            console.log(`Error checking '${table}':`, error.message);
        }
    }
}

// Load .env first
const path = require('path');
const fs = require('fs');
(function loadEnvFirst() {
    const envPaths = [path.join(__dirname, 'src', '.env')];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf-8');
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
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

listTables();
