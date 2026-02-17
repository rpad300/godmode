// Test Team Analysis
const http = require('http');

const personId = '8c055487-788f-4816-bb4e-f7d04d81ac18'; // Rui Dias - extracted from transcript

const data = JSON.stringify({
    forceReanalysis: true
});

const options = {
    hostname: 'localhost',
    port: 3005,
    path: `/api/team-analysis/profiles/${personId}/analyze`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Analyzing profile for Alexander Lee...');
console.log('URL:', `http://localhost:3005${options.path}`);

const req = http.request(options, (res) => {
    let body = '';
    
    res.on('data', (chunk) => {
        body += chunk;
    });
    
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const json = JSON.parse(body);
            console.log('Response:', JSON.stringify(json, null, 2).substring(0, 2000));
        } catch (e) {
            console.log('Raw response:', body.substring(0, 2000));
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.write(data);
req.end();
