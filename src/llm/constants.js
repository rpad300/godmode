/**
 * Purpose:
 *   Shared, provider-agnostic constants for the LLM subsystem. Centralizes magic
 *   strings and pattern lists so they can be maintained in one place.
 *
 * Responsibilities:
 *   - Defines OLLAMA_VISION_PATTERNS: substring patterns used by isVisionModel()
 *     (in index.js) to detect whether an Ollama model name implies vision support,
 *     since Ollama's API does not expose a capability flag for this.
 *
 * Key dependencies:
 *   - None
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - When Ollama adds a new vision-capable model family, add its distinguishing
 *     substring here. The match is case-insensitive (callers lowercase before comparing).
 */

/** Ollama model name substrings that indicate vision capability (used by isVisionModel) */
const OLLAMA_VISION_PATTERNS = [
    'minicpm-v', 'qwen2-vl', 'qwen3-vl', 'llava', 'bakllava',
    'moondream', 'llama-vision', 'gemma3', 'granite3.2-vision',
    'granite-vision', 'llama3.2-vision', 'qwen2.5-vl'
];

module.exports = {
    OLLAMA_VISION_PATTERNS
};
