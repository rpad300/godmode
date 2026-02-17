// Direct Supabase query to check transcript content
const { getClient } = require('./src/supabase/client');
const supabase = getClient();


async function checkTranscripts() {
    const projectId = '0c82618c-7e1a-4e41-87cf-22643e148715';
    
    console.log('Querying transcripts from Supabase...');
    
    // Query documents
    const { data: docs, error } = await supabase
        .from('documents')
        .select('id, filename, content, doc_type, status, extraction_result')
        .eq('project_id', projectId)
        .in('status', ['completed', 'processed']);
    
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    
    console.log(`Found ${docs.length} documents`);
    
    for (const doc of docs) {
        console.log(`\n--- Document: ${doc.filename} ---`);
        console.log('  ID:', doc.id);
        console.log('  Type:', doc.doc_type);
        console.log('  Status:', doc.status);
        console.log('  Content length:', doc.content?.length || 0);
        
        if (doc.content) {
            console.log('  Content preview:', doc.content.substring(0, 500));
            
            // Check for names
            const names = ['Rui', 'Kishor', 'Rubin', 'Paula', 'Alexander', 'Luuk', 'Afonso'];
            const found = names.filter(n => doc.content.includes(n));
            console.log('  Names found in content:', found.join(', ') || 'none');
        } else {
            console.log('  NO CONTENT!');
        }
        
        if (doc.extraction_result?.people) {
            console.log('  Extracted people:', doc.extraction_result.people.map(p => p.name).join(', '));
        }
    }
}

checkTranscripts().catch(console.error);
