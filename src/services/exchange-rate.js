/**
 * Purpose:
 *   Provides the current USD-to-EUR exchange rate through a layered
 *   resolution strategy: manual override, in-memory cache, free REST APIs,
 *   database fallback, and a hard-coded default.
 *
 * Responsibilities:
 *   - Fetch live rates from Frankfurter and Open ER-API (no API key needed)
 *   - Cache the rate in-memory for 24 hours
 *   - Persist / retrieve rates via the Supabase `system_config` table
 *   - Allow admin toggle between auto (API) and manual rate modes
 *   - Expose config inspection and force-refresh endpoints
 *
 * Key dependencies:
 *   - https / http (Node built-in): Direct HTTP calls (no axios)
 *   - ../logger: Structured logging
 *   - ../supabase: Supabase client for DB persistence (lazily loaded)
 *
 * Side effects:
 *   - Network calls to external exchange-rate APIs
 *   - Writes to `system_config` table (storeRateInDatabase is fire-and-forget)
 *
 * Notes:
 *   - DEFAULT_RATE (0.92) is only used when all other sources fail
 *   - storeRateInDatabase is intentionally not awaited in the hot path to keep
 *     latency low; a failure there is logged but non-fatal
 *   - The 10-second request timeout guards against slow upstream APIs
 */

const https = require('https');
const http = require('http');
const { logger } = require('../logger');

const log = logger.child({ module: 'exchange-rate' });

// In-memory cache
let cachedRate = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Default fallback rate
const DEFAULT_RATE = 0.92;

// API endpoints (free, no key required)
const APIS = [
    {
        name: 'frankfurter',
        url: 'https://api.frankfurter.app/latest?from=USD&to=EUR',
        parseResponse: (data) => data.rates?.EUR
    },
    {
        name: 'exchangerate-api',
        url: 'https://open.er-api.com/v6/latest/USD',
        parseResponse: (data) => data.rates?.EUR
    }
];

/**
 * Fetch data from URL
 * @param {string} url - URL to fetch
 * @returns {Promise<object>}
 */
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = 10000; // 10 seconds

        const req = protocol.get(url, { timeout }, (res) => {
            let data = '';

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Fetch exchange rate from API
 * @returns {Promise<number|null>}
 */
async function fetchRateFromAPI() {
    for (const api of APIS) {
        try {
            log.debug({ event: 'exchange_rate_fetch', api: api.name }, 'Fetching from API');
            const data = await fetchJson(api.url);
            const rate = api.parseResponse(data);

            if (rate && typeof rate === 'number' && rate > 0) {
                log.debug({ event: 'exchange_rate_got', api: api.name, rate }, 'Got rate from API');
                return rate;
            }
        } catch (error) {
            log.warn({ event: 'exchange_rate_fetch_failed', api: api.name, reason: error.message }, 'Failed to fetch');
        }
    }

    log.warn({ event: 'exchange_rate_all_apis_failed' }, 'All APIs failed');
    return null;
}

/**
 * Get Supabase client for database operations
 */
function getSupabaseClient() {
    try {
        const supabase = require('../supabase');
        return supabase.getAdminClient() || supabase.getClient();
    } catch (e) {
        return null;
    }
}

/**
 * Store rate in database
 * @param {number} rate - Exchange rate
 */
async function storeRateInDatabase(rate) {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        // Upsert exchange rate settings
        await client.from('system_config').upsert([
            { key: 'exchange_rate_last_value', value: rate },
            { key: 'exchange_rate_last_updated', value: new Date().toISOString() }
        ], { onConflict: 'key' });

        log.debug({ event: 'exchange_rate_stored', rate }, 'Stored rate in database');
    } catch (error) {
        log.warn({ event: 'exchange_rate_store_failed', reason: error.message }, 'Failed to store rate in database');
    }
}

/**
 * Get rate from database
 * @returns {Promise<{rate: number|null, auto: boolean}>}
 */
async function getRateFromDatabase() {
    const client = getSupabaseClient();
    if (!client) return { rate: null, auto: true };

    try {
        const { data, error } = await client
            .from('system_config')
            .select('key, value')
            .in('key', ['exchange_rate_auto', 'exchange_rate_last_value', 'exchange_rate_manual']);

        if (error) throw error;

        const config = {};
        (data || []).forEach(row => {
            config[row.key] = row.value;
        });

        return {
            rate: config.exchange_rate_last_value ? parseFloat(config.exchange_rate_last_value) : null,
            manual: config.exchange_rate_manual ? parseFloat(config.exchange_rate_manual) : null,
            auto: config.exchange_rate_auto !== false && config.exchange_rate_auto !== 'false'
        };
    } catch (error) {
        log.warn({ event: 'exchange_rate_db_get_failed', reason: error.message }, 'Failed to get rate from database');
        return { rate: null, auto: true };
    }
}

/**
 * Get USD to EUR exchange rate
 * Uses cache, then API, then database fallback, then default
 * 
 * @param {boolean} forceRefresh - Force refresh from API
 * @returns {Promise<{rate: number, source: string, auto: boolean}>}
 */
async function getUsdToEurRate(forceRefresh = false) {
    // Check database settings
    const dbConfig = await getRateFromDatabase();

    // If auto mode is disabled, use manual rate
    if (!dbConfig.auto) {
        const manualRate = dbConfig.manual || DEFAULT_RATE;
        log.debug({ event: 'exchange_rate_manual', manualRate }, 'Using manual rate');
        return {
            rate: manualRate,
            source: 'manual',
            auto: false,
            lastUpdated: null
        };
    }

    // Check cache (if not forcing refresh)
    if (!forceRefresh && cachedRate && cacheTimestamp) {
        const cacheAge = Date.now() - cacheTimestamp;
        if (cacheAge < CACHE_TTL_MS) {
            log.debug({ event: 'exchange_rate_cached', rate: cachedRate }, 'Using cached rate');
            return {
                rate: cachedRate,
                source: 'cache',
                auto: true,
                lastUpdated: new Date(cacheTimestamp).toISOString()
            };
        }
    }

    // Try to fetch from API
    const apiRate = await fetchRateFromAPI();

    if (apiRate) {
        // Update cache
        cachedRate = apiRate;
        cacheTimestamp = Date.now();

        // Store in database (async, don't wait)
        storeRateInDatabase(apiRate);

        return {
            rate: apiRate,
            source: 'api',
            auto: true,
            lastUpdated: new Date().toISOString()
        };
    }

    // Fallback to database stored rate
    if (dbConfig.rate) {
        log.debug({ event: 'exchange_rate_db_fallback', rate: dbConfig.rate }, 'Using database fallback rate');
        return {
            rate: dbConfig.rate,
            source: 'database',
            auto: true,
            lastUpdated: null
        };
    }

    // Ultimate fallback
    log.debug({ event: 'exchange_rate_default', rate: DEFAULT_RATE }, 'Using default rate');
    return {
        rate: DEFAULT_RATE,
        source: 'default',
        auto: true,
        lastUpdated: null
    };
}

/**
 * Set exchange rate mode (auto or manual)
 * @param {boolean} auto - Enable auto mode
 * @param {number|null} manualRate - Manual rate (if auto=false)
 */
async function setExchangeRateMode(auto, manualRate = null) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Database not available');
    }

    const updates = [
        { key: 'exchange_rate_auto', value: auto }
    ];

    if (!auto && manualRate !== null) {
        updates.push({ key: 'exchange_rate_manual', value: manualRate });
    }

    const { error } = await client
        .from('system_config')
        .upsert(updates, { onConflict: 'key' });

    if (error) throw error;

    log.debug({ event: 'exchange_rate_mode', auto, manualRate }, 'Mode set');
    return { success: true };
}

/**
 * Get exchange rate configuration
 * @returns {Promise<object>}
 */
async function getExchangeRateConfig() {
    const dbConfig = await getRateFromDatabase();
    const currentRate = await getUsdToEurRate();

    return {
        auto: dbConfig.auto,
        manualRate: dbConfig.manual || DEFAULT_RATE,
        currentRate: currentRate.rate,
        source: currentRate.source,
        lastUpdated: currentRate.lastUpdated,
        defaultRate: DEFAULT_RATE
    };
}

/**
 * Refresh exchange rate from API
 * @returns {Promise<object>}
 */
async function refreshExchangeRate() {
    return await getUsdToEurRate(true);
}

module.exports = {
    getUsdToEurRate,
    setExchangeRateMode,
    getExchangeRateConfig,
    refreshExchangeRate,
    DEFAULT_RATE
};
