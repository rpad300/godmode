/**
 * Purpose:
 *   Barrel export for application-level services.
 *
 * Responsibilities:
 *   - Re-export the exchange-rate service
 *
 * Key dependencies:
 *   - ./exchange-rate: USD-to-EUR rate fetching with multi-source fallback
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Additional services (e.g. notification, billing) should be added here
 */

const exchangeRate = require('./exchange-rate');

module.exports = {
    exchangeRate
};
