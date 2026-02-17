
const http = require('http');

const PORT = 3005;
const PROJECT_ID = '4a4245b5-7084-4c14-a0a5-d9c8561404f9';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: json });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

(async () => {
    try {
        console.log('1. Fetching categories for project...');
        let res = await request('GET', `/api/projects/${PROJECT_ID}/categories`);
        console.log('Status:', res.statusCode);
        console.log('Categories count:', res.data.length);

        console.log('\n2. Creating new category...');
        const newCat = {
            name: 'test_cat_' + Date.now(),
            display_name: 'Test Category',
            description: 'Created by test script',
            color: 'green'
        };
        res = await request('POST', `/api/projects/${PROJECT_ID}/categories`, newCat);
        console.log('Status:', res.statusCode);
        console.log('Created:', res.data);
        const newId = res.data.id;

        if (!newId) throw new Error('Failed to create category');

        console.log('\n3. Verifying category exists in project list...');
        res = await request('GET', `/api/projects/${PROJECT_ID}/categories`);
        const created = res.data.find(c => c.id === newId);
        console.log('Found created category:', !!created);

        console.log('\n4. Updating category...');
        res = await request('PUT', `/api/projects/${PROJECT_ID}/categories/${newId}`, {
            display_name: 'Updated Test Category'
        });
        console.log('Status:', res.statusCode);
        console.log('Updated:', res.data);

        console.log('\n5. Deleting category...');
        res = await request('DELETE', `/api/projects/${PROJECT_ID}/categories/${newId}`);
        console.log('Status:', res.statusCode);
        console.log('Result:', res.data);

        console.log('\n6. Verifying deletion...');
        res = await request('GET', `/api/projects/${PROJECT_ID}/categories`);
        const found = res.data.find(c => c.id === newId);
        console.log('Category still exists:', !!found);

    } catch (err) {
        console.error('Test failed:', err);
    }
})();
