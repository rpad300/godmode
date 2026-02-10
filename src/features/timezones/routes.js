/**
 * Timezones feature routes
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/timezones - Get all timezones (Supabase or defaults)
 * - GET /api/timezones/grouped - Get timezones grouped by region
 */

const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

const DEFAULT_TIMEZONES = [
    { code: 'UTC', name: 'Coordinated Universal Time', utc_offset: '+00:00' },
    { code: 'Europe/Lisbon', name: 'Lisbon, Portugal', utc_offset: '+00:00' },
    { code: 'Europe/London', name: 'London, United Kingdom', utc_offset: '+00:00' },
];

/**
 * Handle timezones routes
 * @param {object} ctx - Context object with req, res, pathname, supabase, storage
 * @returns {Promise<boolean>} - true if handled, false if not a timezones route
 */
async function handleTimezones(ctx) {
    const { req, res, pathname, supabase, storage } = ctx;
    const log = getLogger().child({ module: 'timezones' });
    // GET /api/timezones - Get all timezones from database
    if (pathname === '/api/timezones' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { timezones: DEFAULT_TIMEZONES });
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
                log.warn({ event: 'timezones_error', reason: error.message }, 'Timezones error');
                jsonResponse(res, { error: 'Failed to load timezones' }, 500);
                return true;
            }
            jsonResponse(res, { timezones: data || [] });
        } catch (error) {
            log.warn({ event: 'timezones_exception', reason: error.message }, 'Timezones exception');
            jsonResponse(res, { error: 'Failed to load timezones' }, 500);
        }
        return true;
    }

    // GET /api/timezones/grouped - Get timezones grouped by region
    if (pathname === '/api/timezones/grouped' && req.method === 'GET') {
        try {
            const grouped = await storage.getTimezonesGrouped();
            jsonResponse(res, { ok: true, timezones: grouped });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleTimezones };
