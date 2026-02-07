/**
 * GodMode Extraction Validators
 * 
 * Schema validation for extraction outputs
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
