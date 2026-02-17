
const Storage = require('./src/storage');
const path = require('path');

// Initialize storage
const storage = new Storage(path.join(__dirname, 'data'));
storage.init();

// Set current project (using the ID from previous context: 3ab44397)
const projectId = '3ab44397';
try {
    storage.switchProject(projectId);
    console.log(`Switched to project: ${projectId}`);
} catch (e) {
    console.error(`Could not switch to project ${projectId}:`, e.message);
    // Fallback to default
    const defaultId = storage.getDefaultProjectId();
    if (defaultId) {
        storage.switchProject(defaultId);
        console.log(`Switched to default project: ${defaultId}`);
    }
}

// Test getWeeklyActivity
console.log('--- Weekly Activity ---');
const weekly = storage.getWeeklyActivity();
console.log(JSON.stringify(weekly, null, 2));

// Test getRecentActivity
console.log('--- Recent Activity ---');
const recent = storage.getRecentActivity(5);
console.log(JSON.stringify(recent, null, 2));

// Test getStats
console.log('--- Stats ---');
const stats = storage.getStats();
console.log(JSON.stringify(stats, null, 2));
