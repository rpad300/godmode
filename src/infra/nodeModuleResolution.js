/**
 * Node module resolution helpers.
 *
 * Some GodMode installs can live in a folder structure where `node_modules` isn't
 * discovered as expected (historical packaging/layout quirks). This helper keeps
 * the behavior centralized.
 */

const path = require('path');

/**
 * Ensure a given node_modules path is present in Node's module search paths.
 *
 * Mirrors legacy behavior from src/supabase/storage.js.
 *
 * @param {object} [opts]
 * @param {string} [opts.nodeModulesPath] Absolute path to node_modules.
 */
function ensureNodeModulesPath(opts = {}) {
    const nodeModulesPath = opts.nodeModulesPath || path.join(__dirname, '..', '..', 'node_modules');

    // eslint-disable-next-line no-undef
    if (!module.paths.includes(nodeModulesPath)) {
        // eslint-disable-next-line no-undef
        module.paths.unshift(nodeModulesPath);
    }
}

module.exports = { ensureNodeModulesPath };
