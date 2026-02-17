
const { getAdminClient } = require('./src/supabase/client');

async function checkColumns() {
    const supabase = getAdminClient();

    // Check role_templates columns by selecting one row
    const { data, error } = await supabase
        .from('role_templates')
        .select('*')
        .limit(1);

    if (error) {
        console.log('Error querying role_templates:', error.message);
    } else if (data && data.length > 0) {
        console.log('role_templates columns:', Object.keys(data[0]).join(', '));
    } else {
        console.log('role_templates table exists but is empty.');
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

checkColumns();
