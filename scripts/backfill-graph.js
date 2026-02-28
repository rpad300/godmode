/**
 * Backfill script: rebuilds graph nodes, relationships, and embeddings
 * from existing Supabase data for a given project.
 *
 * Usage:
 *   node scripts/backfill-graph.js [projectId]
 *
 * If no projectId is given, uses the first active project found.
 */

const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });
if (!process.env.SUPABASE_URL) dotenv.config({ path: path.join(__dirname, '..', 'src', '.env') });

const { getAdminClient } = require('../src/supabase/client');
const { SupabaseStorage } = require('../src/supabase/storage');
const SupabaseGraphProvider = require('../src/graph/providers/supabase');
const GraphRAGEngine = require('../src/graphrag/GraphRAGEngine');
const { logger } = require('../src/logger');

const log = logger.child({ module: 'backfill-graph' });

async function main() {
    const targetProjectId = process.argv[2] || null;

    console.log('=== GodMode Graph Backfill ===\n');

    const adminClient = getAdminClient();
    if (!adminClient) {
        console.error('ERROR: Supabase admin client not configured. Check .env for SUPABASE_URL and SUPABASE_SERVICE_KEY.');
        process.exit(1);
    }

    // 1. Resolve project
    let projectId = targetProjectId;
    if (!projectId) {
        const { data: projects } = await adminClient
            .from('projects')
            .select('id, name')
            .order('created_at', { ascending: true })
            .limit(5);

        if (!projects || projects.length === 0) {
            console.error('ERROR: No projects found in database.');
            process.exit(1);
        }

        console.log('Available projects:');
        projects.forEach((p, i) => console.log(`  [${i}] ${p.name} (${p.id})`));

        projectId = projects[0].id;
        console.log(`\nUsing first project: ${projects[0].name}\n`);
    }

    // 2. Initialize storage
    const storage = new SupabaseStorage(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
    storage.setProject(projectId);
    console.log(`Project set: ${projectId}`);

    // 3. Initialize graph provider
    const graphName = `godmode_${projectId}`;
    const graphProvider = new SupabaseGraphProvider({
        supabase: adminClient,
        graphName,
        projectId
    });

    await graphProvider.connect();
    console.log(`Graph provider connected: ${graphName}`);

    // 4. Fetch all entity data from Supabase
    console.log('\nFetching entity data from Supabase...');

    const fetchSafe = async (fn, label) => {
        try {
            const result = await fn();
            const items = Array.isArray(result) ? result : (result?.data || result?.items || []);
            console.log(`  ${label}: ${items.length}`);
            return items;
        } catch (e) {
            console.log(`  ${label}: 0 (error: ${e.message})`);
            return [];
        }
    };

    const facts = await fetchSafe(() => storage.getFacts(), 'facts');
    const decisions = await fetchSafe(() => storage.getDecisions(), 'decisions');
    const risks = await fetchSafe(() => storage.getRisks(), 'risks');
    const actions = await fetchSafe(() => storage.getActions(), 'actions');
    const questions = await fetchSafe(() => storage.getQuestions(), 'questions');
    const people = await fetchSafe(() => storage.getPeople(), 'people');
    const documents = await fetchSafe(() => storage.getDocuments(), 'documents');
    const contacts = await fetchSafe(() => storage.getContacts(), 'contacts');
    const teams = await fetchSafe(() => storage.getTeams(), 'teams');
    const sprints = await fetchSafe(() => storage.getSprints(projectId), 'sprints');
    const userStories = await fetchSafe(() => storage.getUserStories(), 'userStories');
    const emails = await fetchSafe(() => storage.getEmails(), 'emails');
    const conversations = await fetchSafe(() => storage.getConversations(), 'conversations');

    // Fetch project info for the Project node
    const { data: projectData } = await adminClient
        .from('projects')
        .select('*, companies(*)')
        .eq('id', projectId)
        .single();

    const project = projectData ? { ...projectData, company: projectData.companies } : null;

    const data = {
        project,
        facts,
        decisions,
        risks,
        actions,
        questions,
        people,
        documents,
        contacts,
        teams,
        sprints,
        userStories,
        emails,
        conversations,
    };

    const totalEntities = facts.length + decisions.length + risks.length + actions.length +
        questions.length + people.length + documents.length + contacts.length +
        teams.length + sprints.length + userStories.length + emails.length + conversations.length;

    console.log(`\nTotal entities to sync: ${totalEntities}`);

    if (totalEntities === 0) {
        console.log('No entities found. Nothing to sync.');
        process.exit(0);
    }

    // 5. Check for LLM/embedding config (for embedding generation)
    const { data: llmConfig } = await adminClient
        .from('project_config')
        .select('config')
        .eq('project_id', projectId)
        .eq('config_type', 'llm')
        .single();

    let embeddingProvider = null;
    let embeddingModel = null;
    if (llmConfig?.config?.embeddingProvider) {
        embeddingProvider = llmConfig.config.embeddingProvider;
        embeddingModel = llmConfig.config.embeddingModel;
        console.log(`Embedding config: ${embeddingProvider}/${embeddingModel}`);
    } else {
        console.log('No embedding provider configured - embeddings will be skipped.');
        console.log('(Configure in Admin > LLM Providers to enable embedding generation)');
    }

    // 6. Create GraphRAG engine and run sync
    console.log('\n--- Starting graph rebuild (clear + full sync) ---\n');

    const engine = new GraphRAGEngine({
        graphProvider,
        storage,
        projectId,
        embeddingProvider,
        embeddingModel,
    });

    const result = await engine.syncToGraph(data, {
        clear: true,
        generateEmbeddings: !!embeddingProvider,
        projectId,
    });

    console.log('\n=== Backfill Results ===');
    console.log(`  Nodes created/updated: ${result.nodes}`);
    console.log(`  Edges created/updated: ${result.edges}`);
    if (result.errors?.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    }

    // 7. Get final graph stats
    const stats = await graphProvider.getStats();
    if (stats.ok) {
        console.log(`\nGraph stats after backfill:`);
        console.log(`  Total nodes: ${stats.nodeCount}`);
        console.log(`  Total edges: ${stats.edgeCount}`);
        if (stats.labels) {
            console.log(`  Node types: ${Object.entries(stats.labels).map(([k, v]) => `${k}:${v}`).join(', ')}`);
        }
    }

    // 8. Check embeddings count
    const { data: embCount } = await adminClient
        .from('embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);

    console.log(`  Embeddings: ${embCount?.length ?? 'unknown'}`);

    console.log('\n=== Backfill complete ===');
    process.exit(0);
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
