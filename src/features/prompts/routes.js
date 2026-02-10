/**
 * Prompts API - ontology-aware prompt preview and context
 * Extracted from server.js
 *
 * Handles:
 * - GET /api/prompts/preview - Preview ontology-aware prompts
 * - GET /api/prompts/ontology - Get ontology context for prompts
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
