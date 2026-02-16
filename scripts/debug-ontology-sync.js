const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../src/.env') });

async function fetchJson(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3005,
            path: path,
            method: method,
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

async function testDirectConnection() {
    console.log('\n3. Testing Direct Graph Connection...');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
        return;
    }

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

        // Dynamic import based on project structure
        const providerPath = path.join(__dirname, '../src/graph/providers/supabase.js');
        const SupabaseGraphProvider = require(providerPath).SupabaseGraphProvider || require(providerPath);

        const provider = new SupabaseGraphProvider({
            supabase,
            graphName: 'default'
        });

        console.log('Provider initialized. Connecting...');
        const result = await provider.connect();
        console.log('Connection Result:', JSON.stringify(result, null, 2));

        if (!result.ok) {
            console.error('Connection failed details:', result.error);
        } else {
            console.log('Direct connection successful!');

            // Try statistics
            const stats = await provider.getStats();
            console.log('Graph Stats:', JSON.stringify(stats, null, 2));

            // Manual Extraction Test
            console.log('\n--- Manual Extraction Test ---');
            try {
                const extractorPath = path.join(__dirname, '../src/ontology/OntologyExtractor.js');
                const { OntologyExtractor } = require(extractorPath);
                const extractor = new OntologyExtractor({ graphProvider: provider });
                console.log('Extractor created. Extracting...');
                const extracted = await extractor.extractFromGraph();
                console.log('Manual Extraction Result:', JSON.stringify({
                    ok: extracted.ok,
                    stats: extracted.stats,
                    entityTypes: Object.keys(extracted.ontology?.entityTypes || {}).length,
                    relationTypes: Object.keys(extracted.ontology?.relationTypes || {}).length
                }, null, 2));

                if (extracted.ok) {
                    // We can print some details if needed
                    const types = Object.keys(extracted.ontology.entityTypes);
                    console.log('Extracted Types:', types.slice(0, 10).join(', ') + (types.length > 10 ? '...' : ''));
                }
            } catch (e) {
                console.error('Manual extraction failed:', e);
            }
        }

    } catch (error) {
        console.error('Direct connection crashed:', error);
    }
}

async function main() {
    console.log('--- Ontology Debug Tool ---');

    console.log('1. Fetching Defined Schema...');
    const schemaRes = await fetchJson('/api/ontology/schema');
    if (!schemaRes.ok) {
        console.error('Failed to fetch schema:', schemaRes);
        return;
    }
    const definedEntities = Object.keys(schemaRes.schema.entityTypes);
    const definedRelations = Object.keys(schemaRes.schema.relationTypes);
    console.log(`Defined: ${definedEntities.length} Entities, ${definedRelations.length} Relations`);


    await testDirectConnection(); // Verified working


    console.log('\n2. Extracting Schema from Graph (Live)...');
    // Note: this endpoint requires a graph connection. 
    // If the graph isn't connected, it might fail or return empty.
    const extractedRes = await fetchJson('/api/ontology/extract-from-graph');

    if (!extractedRes.ok) {
        console.error('Failed to extract from graph:', extractedRes);
        console.log('Is the Supabase/Graph connection active?');
        return;
    }

    const foundEntities = Object.keys(extractedRes.ontology.entityTypes);
    const foundRelations = Object.keys(extractedRes.ontology.relationTypes);
    console.log(`Found: ${foundEntities.length} Entities, ${foundRelations.length} Relations`);

    console.log('\n3. Comparison:');

    const missingEntities = foundEntities.filter(e => !definedEntities.includes(e));
    const missingRelations = foundRelations.filter(r => !definedRelations.includes(r));

    if (missingEntities.length > 0) {
        console.log('Entities in Graph but NOT in Schema:');
        missingEntities.forEach(e => console.log(` - ${e} (${extractedRes.ontology.entityTypes[e].nodeCount} nodes)`));
    } else {
        console.log('All graph entities are defined in schema.');
    }

    if (missingRelations.length > 0) {
        console.log('\nRelations in Graph but NOT in Schema:');
        missingRelations.forEach(r => console.log(` - ${r} (${extractedRes.ontology.relationTypes[r].edgeCount} edges)`));
    } else {
        console.log('\nAll graph relations are defined in schema.');
    }
}

main().catch(console.error);
