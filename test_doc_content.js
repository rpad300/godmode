// Script to test document content through the server's supabase client
const http = require('http');

// Create a simple script that the server can evaluate
const testScript = `
(async () => {
    const { data, error } = await storage._supabase.supabase
        .from('documents')
        .select('id, filename, content, doc_type, status, file_path, content_path')
        .eq('project_id', storage._supabase.projectId)
        .single();
    
    return {
        doc: data,
        error: error?.message,
        contentLength: data?.content?.length || 0
    };
})()
`;

// Alternative: Use direct API call to get document content
const options = {
    hostname: 'localhost',
    port: 3005,
    path: '/api/documents?include_content=true',
    method: 'GET'
};

console.log('Fetching documents with content...');

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
                    console.log(`\n--- Document: ${doc.filename} ---`);
                    console.log('  ID:', doc.id);
                    console.log('  Type:', doc.doc_type);
                    console.log('  Status:', doc.status);
                    console.log('  Content length:', doc.content?.length || 0);
                    console.log('  File path:', doc.file_path || 'none');
                    console.log('  Content path:', doc.content_path || 'none');
                    
                    // Show content preview if available
                    if (doc.content && doc.content.length > 0) {
                        console.log('  Content preview:', doc.content.substring(0, 300) + '...');
                    }
                });
            }
        } catch (e) {
            console.log('Error parsing:', e.message);
            console.log('Raw (first 1000):', body.substring(0, 1000));
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.end();
