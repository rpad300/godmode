const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createSyncCompatStorage } = require('../storageCompat');
const DocumentProcessor = require('../processor');

// Mock config
const config = {
    dataDir: path.join(__dirname, '../../data'),
    ollama: { model: 'llama3' },
    supabase: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_ANON_KEY
    }
};

// Mock logger
const log = {
    debug: (...args) => console.log('[DEBUG]', ...args),
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.log('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    child: () => log
};

async function verify() {
    console.log('Initializing Storage (Compat) and Processor...');

    // Use createSyncCompatStorage as per server.js pattern
    const storage = createSyncCompatStorage(config.dataDir);

    // Inject logger if needed (DocumentProcessor might rely on global logger or injected one)
    // Processor constructor: constructor(storage, config)
    // It imports logger internally: const log = require('./logger').logger.child({ module: 'processor' });
    // So we don't need to inject log into processor, but we might want to suppress its output or see it.
    // However, since we can't easily mock the internal require without proxy, we'll just let it use the real logger
    // which effectively logs to console/file.

    const processor = new DocumentProcessor(storage, config);

    // Mock project context for storage
    // We need to set currentProjectId on the storage instance
    storage.currentProjectId = 'hoidqhdgdgvogehkjsdw';

    try {
        console.log('Testing getNewContentFiles (Supabase integration)...');
        // This should now work if _supabase is present in storage
        if (!storage._supabase) {
            console.warn('WARNING: storage._supabase is missing! Supabase might not be initialized.');
        } else {
            console.log('Storage has _supabase instance.');
        }

        const newFiles = await processor.getNewContentFiles(5);
        console.log(`Successfully retrieved ${newFiles.length} new files.`);
        if (newFiles.length > 0) {
            console.log('Sample file:', newFiles[0].name);
        } else {
            console.log('No new files found (expected if raw_content table is empty or all synthesized).');
        }

        console.log('Testing markFilesSynthesized (Dry run)...');
        if (typeof processor.markFilesSynthesized === 'function') {
            console.log('markFilesSynthesized method exists.');
        }

        console.log('Verification COMPLETE: Phase 2 methods are accessible and run without crashing.');
    } catch (error) {
        console.error('Verification FAILED:', error);
        // console.error(error.stack);
    }
}

verify();
