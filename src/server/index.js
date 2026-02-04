/**
 * Server utilities - re-exports all modules
 * 
 * Usage:
 *   const { parseUrl, jsonResponse, isValidUUID } = require('./server');
 */

module.exports = {
    ...require('./request'),
    ...require('./response'),
    ...require('./security'),
    ...require('./static'),
    ...require('./middleware')
};
