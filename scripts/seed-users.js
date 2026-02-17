/**
 * Purpose:
 *   Populates the local CollaborativeRoles data store with a predefined set of
 *   demo/test users including superadmins, admins, regular users, and edge-case
 *   statuses (inactive, suspended).
 *
 * Responsibilities:
 *   - Skip seeding if users already exist (idempotent)
 *   - Map each mock user to the CollaborativeRoles.addUser() contract
 *   - Assign permission arrays based on role (superadmin > admin > user)
 *   - Set non-active statuses (inactive, suspended) via updateUser post-creation
 *
 * Key dependencies:
 *   - src/roles/CollaborativeRoles: file-backed user/role management module
 *
 * Side effects:
 *   - Writes user records to the data/ directory (JSON files)
 *
 * Notes:
 *   - The hardcoded adminUsers array mirrors the shape of the frontend admin-data.ts
 *   - CollaborativeRoles.addUser defaults status to 'active', so non-active
 *     statuses require a separate updateUser call
 *   - Must be run from the project root (uses process.cwd() for data dir resolution)
 *
 * Usage:
 *   node scripts/seed-users.js
 */
const { getCollaborativeRoles } = require('../src/roles/CollaborativeRoles');
const path = require('path');

// Mock data from admin-data.ts
const adminUsers = [
    { id: '1', email: 'admin@godmode.ai', name: 'RPAD', role: 'superadmin', rolePrompt: 'You are the super admin.', status: 'active' },
    { id: '2', email: 'joao@techcorp.com', name: 'João Silva', role: 'admin', rolePrompt: 'You are an admin.', status: 'active' },
    { id: '3', email: 'maria@techcorp.com', name: 'Maria Costa', role: 'user', rolePrompt: 'You are a standard user.', status: 'active' },
    { id: '4', email: 'pedro@techcorp.com', name: 'Pedro Santos', role: 'user', rolePrompt: 'You are a standard user.', status: 'active' },
    { id: '5', email: 'old_user@test.com', name: 'Old User', role: 'user', rolePrompt: 'You are a standard user.', status: 'inactive' },
    { id: '6', email: 'ana@techcorp.com', name: 'Ana Rodrigues', role: 'admin', rolePrompt: 'You are an admin.', status: 'active' },
    { id: '7', email: 'carlos@techcorp.com', name: 'Carlos Mendes', role: 'user', rolePrompt: 'You are a standard user.', status: 'active' },
    { id: '8', email: 'sofia@techcorp.com', name: 'Sofia Almeida', role: 'user', rolePrompt: 'You are a standard user.', status: 'active' },
    { id: '9', email: 'test@banned.com', name: 'Banned User', role: 'user', rolePrompt: 'You are a standard user.', status: 'suspended' },
    { id: '10', email: 'miguel@techcorp.com', name: 'Miguel Ferreira', role: 'user', rolePrompt: 'You are a standard user.', status: 'active' },
];

/**
 * Seed the CollaborativeRoles data store with demo users.
 * Skips if any users already exist to avoid duplicates.
 */
async function seedUsers() {
    console.log('Seeding users...');

    // Initialize with correct data directory
    const dataDir = path.join(process.cwd(), 'data');
    const collaborative = getCollaborativeRoles({ dataDir });

    const currentUsers = collaborative.getUsers();
    console.log(`Current user count: ${currentUsers.length}`);

    if (currentUsers.length > 0) {
        console.log('Users already exist. Skipping seed.');
        return;
    }

    let addedCount = 0;
    for (const user of adminUsers) {
        // We need to map 'superadmin', 'admin', 'user' to roles that key into permissions or just strings
        // CollaborativeRoles.addUser expects { name, email, role, ... }

        // Fix for 'status' not being directly settable in addUser (it defaults to 'active')
        // We might need to update it after adding

        const result = collaborative.addUser({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            rolePrompt: user.rolePrompt,
            permissions: user.role === 'superadmin' ? ['admin', 'write', 'read'] : user.role === 'admin' ? ['write', 'read'] : ['read']
        });

        if (result.success) {
            addedCount++;
            // Update status if it's not active
            if (user.status !== 'active') {
                collaborative.updateUser(result.user.id, { status: user.status });
            }
        } else {
            console.error(`Failed to add user ${user.email}:`, result.error);
        }
    }

    console.log(`Successfully added ${addedCount} users.`);
}

seedUsers().catch(console.error);
