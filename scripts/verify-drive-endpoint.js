/**
 * Purpose:
 *   Verifies that the Google Drive API endpoint is properly registered in the
 *   Express router and protected by authentication middleware.
 *
 * Responsibilities:
 *   - Hit /api/system/google-drive expecting a 401 or 403 (proof it exists and is guarded)
 *   - Hit a random /api/random-xxxx expecting a 404 (proof that 401/403 is not a default)
 *   - Exit 0 on success, 1 on failure
 *
 * Key dependencies:
 *   - Running GodMode server on localhost:3005
 *
 * Side effects:
 *   - Makes unauthenticated HTTP GET requests to the local server
 *
 * Notes:
 *   - Waits 2 seconds before running to allow the server to finish starting
 *     if this script is invoked immediately after a server spawn
 *   - No auth token is sent intentionally -- the test validates that the
 *     endpoint rejects unauthenticated requests
 *
 * Usage:
 *   node scripts/verify-drive-endpoint.js
 */
const http = require('http');

/**
 * Issue a GET request and resolve true if the HTTP status is in expectedStatuses.
 * Resolves (not rejects) false on connection errors so the caller can aggregate.
 */
function checkEndpoint(path, expectedStatuses) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:3005${path}`, (res) => {
            console.log(`GET ${path} -> Status: ${res.statusCode}`);
            if (expectedStatuses.includes(res.statusCode)) {
                resolve(true);
            } else {
                console.error(`Expected status ${expectedStatuses.join(' or ')}, got ${res.statusCode}`);
                resolve(false);
            }
        });
        req.on('error', (e) => {
            console.error(`Request to ${path} failed: ${e.message}`);
            resolve(false);
        });
    });
}

async function run() {
    console.log('Verifying Google Drive Endpoint...');

    // 1. Check /api/system/google-drive -> Expect 401 or 403 (Unauthorized/Forbidden)
    // If it returns 404, routing is broken.
    const driveExists = await checkEndpoint('/api/system/google-drive', [401, 403]);

    // 2. Check /api/random-endpoint -> Expect 404
    const randomExists = await checkEndpoint('/api/random-xxxx', [404]);

    if (driveExists && randomExists) {
        console.log('SUCCESS: Google Drive endpoint is registered and protected.');
        process.exit(0);
    } else {
        console.error('FAILURE: Endpoint verification failed.');
        process.exit(1);
    }
}

// Wait a bit for server to start if running immediately after spawn
setTimeout(run, 2000);
