/**
 * Shared LLM constants (provider-agnostic).
 * Use these instead of hardcoding model names or capability patterns.
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
