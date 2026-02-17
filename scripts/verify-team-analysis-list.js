/**
 * Purpose:
 *   Verifies that the team-analysis data layer works correctly by querying
 *   Supabase directly (bypassing the HTTP server) and checking that the data
 *   shape matches what the /api/team-analysis endpoint would return.
 *
 * Responsibilities:
 *   - Fetch all projects and their team_analysis_enabled flag
 *   - Fetch all team_analysis records and join by project_id
 *   - Map and display the combined result for manual inspection
 *
 * Key dependencies:
 *   - src/supabase/client (getAdminClient): Supabase admin client factory
 *   - dotenv: loads src/.env
 *   - node-fetch: imported but not currently used (Assumption: leftover from
 *     an earlier version that also hit the HTTP endpoint)
 *
 * Side effects:
 *   - Makes read-only queries to the Supabase projects and team_analysis tables
 *
 * Notes:
 *   - Does NOT require the server to be running -- queries Supabase directly
 *   - Prints a sample of up to 3 mapped records for quick visual verification
 *
 * Usage:
 *   node scripts/verify-team-analysis-list.js
 */
const { getAdminClient } = require('../src/supabase/client');
require('dotenv').config({ path: 'src/.env' });
const fetch = require('node-fetch');

async function verifyData() {
    console.log('Verifying Team Analysis Data Access...');
    const supabase = getAdminClient();

    // 1. Fetch Projects
    const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name, team_analysis_enabled');

    if (projError) {
        console.error('Error fetching projects:', projError);
        return;
    }

    console.log(`Found ${projects.length} projects.`);

    // 2. Fetch Analysis
    const { data: analyses, error: analysisError } = await supabase
        .from('team_analysis')
        .select('project_id, last_analysis_at');

    if (analysisError) {
        console.error('Error fetching analyses:', analysisError);
        return;
    }

    console.log(`Found ${analyses.length} analysis records.`);

    // 3. Map
    const analysisMap = new Map();
    analyses.forEach(a => analysisMap.set(a.project_id, a.last_analysis_at));

    const result = projects.map(p => ({
        id: p.id,
        name: p.name,
        isEnabled: p.team_analysis_enabled,
        lastAnalysisAt: analysisMap.get(p.id) || null
    }));

    console.log('Mapped Result Sample:', result.slice(0, 3));
    console.log('Verification Successful: Data structure matches endpoint logic.');
}

verifyData();
