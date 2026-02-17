/**
 * Purpose:
 *   Barrel export for extraction output validators, currently focused on
 *   transcript schema validation (v1.5+).
 *
 * Responsibilities:
 *   - Re-export validateTranscriptOutput, isValidTranscriptOutput, ENUMS,
 *     and ValidationResult from transcriptSchema
 *
 * Key dependencies:
 *   - ./transcriptSchema: Full transcript output validator with notes-pack support
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Additional validators (document, conversation) can be added alongside
 *     transcriptSchema and re-exported here
 */

const transcriptSchema = require('./transcriptSchema');

module.exports = {
    // Transcript validation
    validateTranscriptOutput: transcriptSchema.validateTranscriptOutput,
    isValidTranscriptOutput: transcriptSchema.isValidTranscriptOutput,
    
    // Enums for reference
    ENUMS: transcriptSchema.ENUMS,
    
    // Validation result class
    ValidationResult: transcriptSchema.ValidationResult
};
