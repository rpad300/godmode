/**
 * Purpose:
 *   Barrel file for the fact-check module. Re-exports runFactCheck so
 *   consumers can import from the directory without knowing the internal file name.
 *
 * Key dependencies:
 *   - ./FactCheckFlow: contains the actual LLM-driven conflict detection logic
 */

const { runFactCheck } = require('./FactCheckFlow');

module.exports = {
    runFactCheck
};
