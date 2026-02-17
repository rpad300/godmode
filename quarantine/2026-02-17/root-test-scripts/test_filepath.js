// Test document filepath
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3005,
    path: '/api/documents/195edbf1-5d3e-4cf0-a031-c090e4906d53',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const doc = JSON.parse(body);
            console.log('Document:', JSON.stringify(doc, null, 2));
        } catch (e) {
            console.log('Raw:', body.substring(0, 1000));
        }
    });
});

req.on('error', (error) => console.error('Error:', error.message));
req.end();
