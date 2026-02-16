
const http = require('http');

async function postJson(path, body = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3005,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: 'Invalid JSON', raw: data });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('--- Ontology Migration Tool ---');
    console.log('Triggering migration from file to Supabase...');

    // exact endpoint depends on routes.js implementation
    try {
        const res = await postJson('/api/ontology/migrate', {});
        console.log('Migration Result:', JSON.stringify(res, null, 2));

        if (res.success) {
            console.log('Successfully migrated schema from file to Supabase.');
        } else {
            console.error('Migration failed.');
        }
    } catch (e) {
        console.error('Error triggering migration:', e);
    }
}

main().catch(console.error);
