
const https = require('https');
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
            console.log('Loaded env from:', envPath);
            for (const k in envConfig) {
                process.env[k] = envConfig[k];
            }
        }
    }
})();

const PROJECT_REF = process.env.SUPABASE_PROJECT_ID;
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN;

if (!PROJECT_REF || !SUPABASE_TOKEN) {
    console.error('Missing SUPABASE_PROJECT_ID or SUPABASE_TOKEN');
    process.exit(1);
}

const query = "ALTER TABLE categories ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);";

const data = JSON.stringify({
    query: query
});

const options = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Length': data.length
    }
};

console.log(`Executing SQL on project ${PROJECT_REF}...`);

const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Success:', responseBody);
        } else {
            console.error(`Error ${res.statusCode}:`, responseBody);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error);
    process.exit(1);
});

req.write(data);
req.end();
