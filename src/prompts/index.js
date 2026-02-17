/**
 * Purpose:
 *   Barrel export for the prompts subsystem, exposing ontology-aware
 *   prompt builders used by the extraction pipeline and AI processors.
 *
 * Responsibilities:
 *   - Re-export OntologyAwarePrompts class and its singleton accessor
 *
 * Key dependencies:
 *   - ./OntologyAwarePrompts: Template rendering with ontology context
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Prompt templates may come from Supabase (system_prompts table) or
 *     fall back to hard-coded defaults; see OntologyAwarePrompts for details
 */

const { OntologyAwarePrompts, getOntologyAwarePrompts } = require('./OntologyAwarePrompts');

module.exports = {
    OntologyAwarePrompts,
    getOntologyAwarePrompts
};
