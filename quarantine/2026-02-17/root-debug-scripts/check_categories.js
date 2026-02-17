
const { getAdminClient } = require('./src/supabase/client');

async function checkCategories() {
    const supabase = getAdminClient();

    const { data, error } = await supabase
        .from('role_templates')
        .select('category');

    if (error) {
        console.log('Error:', error.message);
        return;
    }

    const categories = [...new Set(data.map(r => r.category))].filter(Boolean);
    console.log('Distinct categories in role_templates:', categories.join(', '));
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

checkCategories();
