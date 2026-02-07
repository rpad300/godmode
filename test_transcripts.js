// Test to check transcripts in the project
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3005,
    path: '/api/documents',
    method: 'GET'
};

console.log('Fetching documents...');

const req = http.request(options, (res) => {
    let body = '';
    
    res.on('data', (chunk) => {
        body += chunk;
    });
    
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const json = JSON.parse(body);
            console.log('Total documents:', json.documents?.length || 0);
            
            if (json.documents) {
                json.documents.forEach(doc => {
                    console.log(`\n--- Document: ${doc.filename || doc.id} ---`);
                    console.log('  ID:', doc.id);
                    console.log('  Type:', doc.doc_type);
                    console.log('  Status:', doc.status);
                    console.log('  Content length:', doc.content?.length || 0);
                    
                    // Check extraction result
                    if (doc.extraction_result) {
                        const ext = doc.extraction_result;
                        console.log('  Extracted people:', ext.people?.map(p => p.name).join(', ') || 'none');
                    }
                    
                    // Check if content mentions names
                    if (doc.content) {
                        const names = ['Rui', 'Kishor', 'Rubin', 'Paula', 'Alexander', 'Luuk', 'Afonso'];
                        const found = names.filter(n => doc.content.includes(n));
                        console.log('  Names in content:', found.join(', ') || 'none');
                    }
                });
            }
        } catch (e) {
            console.log('Error parsing:', e.message);
            console.log('Raw response (first 500):', body.substring(0, 500));
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.end();
