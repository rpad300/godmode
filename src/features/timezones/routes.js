/**
 * Timezones feature routes (extracted from src/server.js)
 *
 * Non-negotiable: keep runtime behavior identical.
 */

const { jsonResponse } = require('../../server/response');

/**
 * Handle timezone-related endpoints.
 * @returns {Promise<boolean>} true if request was handled
 */
async function handleTimezones({ req, res, pathname, supabase }) {
    // GET /api/timezones - Get all timezones from database
    if (pathname === '/api/timezones' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            // Return default timezones if Supabase not configured
            jsonResponse(res, {
                timezones: [
                    { code: 'UTC', name: 'Coordinated Universal Time', utc_offset: '+00:00' },
                    { code: 'Europe/Lisbon', name: 'Lisbon, Portugal', utc_offset: '+00:00' },
                    { code: 'Europe/London', name: 'London, United Kingdom', utc_offset: '+00:00' },
                ]
            });
            return true;
        }

        try {
            const client = supabase.getAdminClient();
            const { data, error } = await client
                .from('timezones')
                .select('code, name, region, utc_offset, abbreviation')
                .order('utc_offset', { ascending: true })
                .order('name', { ascending: true });

            if (error) {
                console.error('[API] Timezones error:', error.message);
                jsonResponse(res, { error: 'Failed to load timezones' }, 500);
                return true;
            }

            jsonResponse(res, { timezones: data || [] });
        } catch (error) {
            console.error('[API] Timezones exception:', error.message);
            jsonResponse(res, { error: 'Failed to load timezones' }, 500);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleTimezones,
};
