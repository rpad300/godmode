/**
 * Purpose:
 *   Ontology-aware prompt preview and context API. Allows the frontend to
 *   inspect the prompts that will be sent to the LLM during document processing,
 *   including the ontology entity/relation context injected into each prompt.
 *
 * Responsibilities:
 *   - Preview prompts for different content types (document, transcript, conversation, vision)
 *   - Expose raw ontology context used for prompt construction
 *
 * Key dependencies:
 *   - ../../prompts (getOntologyAwarePrompts): prompt builder with ontology injection
 *   - config.userRole, config.projectContext: role/project context for prompt customization
 *
 * Side effects:
 *   - None (read-only preview endpoints)
 *
 * Notes:
 *   - Previews use a hardcoded sample string ("Sample content for preview...")
 *   - Useful for debugging prompt engineering without triggering actual LLM calls
 *
 * Routes:
 *   GET /api/prompts/preview   - Preview a prompt by type (query: ?type=document|transcript|conversation|vision)
 *   GET /api/prompts/ontology  - Raw ontology context used in prompt construction
 */

const { parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handlePrompts(ctx) {
    const { req, res, pathname, config } = ctx;

    // GET /api/prompts/preview
    if (pathname === '/api/prompts/preview' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const type = parsedUrl.query.type || 'document';
            const { getOntologyAwarePrompts } = require('../../prompts');
            const prompts = getOntologyAwarePrompts({
                userRole: config?.userRole,
                projectContext: config?.projectContext
            });
            const sampleContent = 'Sample content for preview...';
            let preview;
            switch (type) {
                case 'transcript':
                    preview = prompts.buildTranscriptPrompt(sampleContent, 'sample-meeting.txt');
                    break;
                case 'conversation':
                    preview = prompts.buildConversationPrompt(sampleContent, 'Sample Conversation');
                    break;
                case 'vision':
                    preview = prompts.buildVisionPrompt('sample-image.png');
                    break;
                default:
                    preview = prompts.buildDocumentPrompt(sampleContent, 'sample-document.pdf');
            }
            jsonResponse(res, {
                ok: true,
                type,
                prompt: preview,
                ontologyContext: prompts.getOntologyContext()
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/prompts/ontology
    if (pathname === '/api/prompts/ontology' && req.method === 'GET') {
        try {
            const { getOntologyAwarePrompts } = require('../../prompts');
            const prompts = getOntologyAwarePrompts();
            jsonResponse(res, { ok: true, ...prompts.getOntologyContext() });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handlePrompts };
