const path = require('path');
const fs = require('fs');

// Load environment variables (copied from server.js pattern)
(function loadEnvFirst() {
    const envPaths = [
        path.join(__dirname, '../../.env'),
        path.join(__dirname, '../.env')
    ];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf-8');
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const eq = trimmed.indexOf('=');
                if (eq <= 0) return;
                const key = trimmed.slice(0, eq).trim();
                let value = trimmed.slice(eq + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                    value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value;
            });
        }
    }
})();

console.log('Environment loaded');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Unset');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Unset');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Unset');

const { createSyncCompatStorage } = require('../storageCompat');
const { GraphRAGEngine } = require('../graphrag');

// Mock DATA_DIR
const DATA_DIR = path.join(__dirname, '../../data');

async function runTest() {
    console.log('Initializing storage...');

    // DEBUG: Try to init supabase helper directly to see error
    try {
        const supabaseHelper = require('../supabase/storageHelper');
        console.log('SupabaseHelper loaded');
        if (!supabaseHelper.isStorageInitialized()) {
            console.log('Initializing SupabaseHelper storage...');
            supabaseHelper.initStorage({
                filesBasePath: path.join(DATA_DIR, 'projects')
            });
            console.log('SupabaseHelper storage initialized');
        } else {
            console.log('SupabaseHelper already initialized');
        }
    } catch (e) {
        console.error('FAILED to init SupabaseHelper:', e);
    }

    const storage = await createSyncCompatStorage(DATA_DIR);
    console.log('Storage wrapper created');

    // Initialize Supabase connection
    // await storage.init();
    console.log('Storage initialization skipped (manual context setting)');

    // Check if it's using supabase or local
    console.log('Is Supabase Mode:', storage._isSupabaseMode);
    console.log('Has Supabase Instance:', !!storage._supabase);

    console.log('Storage Class:', storage.constructor.name);
    console.log('Storage Prototype has getGraphProvider:', typeof Object.getPrototypeOf(storage).getGraphProvider);
    console.log('Storage Instance has getGraphProvider:', typeof storage.getGraphProvider);

    console.log('Getting GraphProvider...');
    const graphProvider = storage.getGraphProvider();
    if (!graphProvider) {
        console.error('No graph provider available! Check Supabase config and connection.');
        return;
    }

    console.log('Connecting GraphProvider...');
    const connectionResult = await graphProvider.connect();
    console.log('GraphProvider connection result:', connectionResult);

    if (!connectionResult.ok) {
        console.error('Failed to connect to graph provider:', connectionResult.error);
        return;
    }
    console.log('Initializing GraphRAGEngine...');
    const engine = new GraphRAGEngine({
        graphProvider,
        storage,
        enableCache: false,
        // Mock config for embedding if needed
        llmConfig: {},
        embeddingProvider: 'ollama', // or null if we rely on SQL similarity
        embeddingModel: 'nomic-embed-text'
    });

    // Mock config global if needed by engine
    global.config = { llm: {} };

    // Get Project ID
    // We need to fetch projects first or set one
    // StorageCompat might not have current project set
    // We need to set it.

    // List projects?
    // storage.listProjects() (if available) or check db

    // Hardcode a project ID if known, or fetch first one
    // But `storageCompat` doesn't expose `listProjects` directly mostly.
    // Try to get active project from `graph_sync_status` or similar if possible.

    // We can use graphProvider query to list projects if we have connection
    // Or just pick one from folder structure

    // Let's assume user wants to test with a specific project id or use `godmode` default?
    // I'll try to list projects via storage.getProjectStats() maybe?

    // Let's rely on standard logic
    // We need to set a project ID.
    // I will pick a known project ID from previous logs if possible, or list them.

    // For now, let's try to get projects.
    if (storage._supabase) {
        const { data: projects } = await storage._supabase.supabase.from('projects').select('id').limit(1);
        if (projects && projects.length > 0) {
            const pid = projects[0].id;
            console.log('Found project:', pid);
            storage.currentProjectId = pid;
            if (storage._supabase) {
                storage._supabase.setProject(pid); // Use setProject to propagate
                console.log('Propagated project ID to SupabaseStorage and GraphProvider');
            }
            if (graphProvider && typeof graphProvider.setProjectContext === 'function') {
                graphProvider.setProjectContext(pid);
                console.log('Explicitly set project context on graphProvider');
            }
        } else {
            console.error('No projects found in DB');
            return;
        }
    } else {
        console.error('Cannot list projects without Supabase');
        return;
    }

    const projectId = storage.getCurrentProject()?.id;
    console.log(`Current project: ${projectId}`);

    if (!projectId) {
        throw new Error('No current project set in storage');
    }

    engine.setProjectContext(projectId);

    console.log('Fetching data from storage...');
    const [docs, people, teams, sprints, actions, facts, decisions, questions] = await Promise.all([
        storage.getDocuments(),
        storage.getPeople(),
        storage.getTeams ? storage.getTeams() : [],
        storage.getSprints ? storage.getSprints(projectId) : [],
        storage.getActions(),
        storage.getFacts(),
        storage.getDecisions(),
        storage.getQuestions()
    ]);

    // Mock data for new v3 entities if storage doesn't provide them yet
    const userStories = [
        { id: 'us-1', title: 'As a user I want to sync graphs', status: 'active', storyPoints: 5, sprintId: sprints[0]?.id },
        { id: 'us-2', title: 'As a dev I want deterministic IDs', status: 'completed', storyPoints: 3, sprintId: sprints[0]?.id }
    ];

    const risks = [
        { id: 'risk-1', title: 'Data loss during sync', status: 'mitigating', severity: 'high', probability: 'low', mitigation: 'Backup first' }
    ];

    const emails = [
        { id: 'email-1', subject: 'Project Update', fromName: 'John Doe', fromEmail: 'john@example.com', dateSent: new Date().toISOString() }
    ];

    const events = [
        {
            id: 'evt-1',
            title: 'Daily Standup',
            start: new Date().toISOString(),
            end: new Date().toISOString(),
            type: 'standup',
            attendees: [people[0]?.id],
            calendar_event_contacts: [
                { contact_id: people[0]?.id, role: 'organizer' }
            ]
        }
    ];

    const entityLinks = [
        { from_entity_id: 'risk-1', to_entity_id: 'evt-1', link_type: 'discussed_in', source: 'manual', confidence: 1.0 }
    ];

    // Update mocks with FKs
    if (risks.length > 0) risks[0].reported_by_contact_id = people[0]?.id;
    if (docs.length > 0) docs[0].author_contact_id = people[0]?.id;

    console.log(`Data fetched (including mocks):
        Docs: ${docs.length}
        People: ${people.length}
        Teams: ${teams.length}
        Sprints: ${sprints.length}
        Actions: ${actions.length}
        Facts: ${facts.length}
        Decisions: ${decisions.length}
        Questions: ${questions.length}
        UserStories: ${userStories.length}
        Risks: ${risks.length}
        Emails: ${emails.length}
        Events: ${events.length}
        EntityLinks: ${entityLinks.length}
    `);

    console.log('Syncing to graph (incremental)...');

    try {
        const result = await engine.syncToGraph({
            documents: docs,
            people,
            teams,
            sprints,
            actions,
            facts,
            decisions,
            questions,
            userStories,
            risks,
            emails,
            events,
            entityLinks,
            project: { id: projectId, name: 'Test Project', status: 'active' } // Ensure project node exists
        }, { clear: false });

        console.log('Sync SUCCESS!');
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Sync FAILED:', err);
    }
}

runTest().catch(console.error);
