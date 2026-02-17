/**
 * Purpose:
 *   Quick diagnostic that retrieves OS-level system stats (CPU load, disk space)
 *   using platform-specific shell commands. Currently Windows-only (PowerShell).
 *
 * Responsibilities:
 *   - Read CPU load via Win32_Processor WMI class
 *   - Read disk info (size, free space) via Win32_LogicalDisk WMI class
 *   - Print parsed results to stdout
 *
 * Key dependencies:
 *   - PowerShell (Windows only): used for WMI/CIM queries
 *
 * Side effects:
 *   - Spawns PowerShell child processes to query system metrics
 *
 * Notes:
 *   - On non-Windows platforms, both tests are skipped with a log message
 *   - Assumption: this was written for a Windows dev environment; consider
 *     adding Linux/macOS support if cross-platform stats are needed
 *
 * Usage:
 *   node scripts/test-system-stats.js
 */
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const os = require('os');

async function testStats() {
    console.log('Testing System Stats Retrieval...');

    // CPU
    try {
        console.log('Fetching CPU...');
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('powershell -Command "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage"');
            const load = parseInt(stdout.trim(), 10);
            console.log('CPU Load:', load, '%');
        } else {
            console.log('Not Windows, skipping CPU PowerShell test');
        }
    } catch (e) {
        console.error('CPU Error:', e.message);
    }

    // Disk
    try {
        console.log('Fetching Disk...');
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('powershell -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace, VolumeName | ConvertTo-Json"');
            console.log('Raw Disk Output:', stdout.substring(0, 100) + '...');
            const parsed = JSON.parse(stdout);
            const disks = Array.isArray(parsed) ? parsed : [parsed];
            console.log('Disks found:', disks.length);
            disks.forEach(d => console.log(`- ${d.DeviceID}: ${Math.round(d.FreeSpace / 1024 / 1024 / 1024)}GB free of ${Math.round(d.Size / 1024 / 1024 / 1024)}GB`));
        } else {
            console.log('Not Windows, skipping Disk PowerShell test');
        }
    } catch (e) {
        console.error('Disk Error:', e.message);
    }
}

testStats();
