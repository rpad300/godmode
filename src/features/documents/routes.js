/**
 * Purpose:
 *   Document management API routes. Full lifecycle for documents including listing,
 *   retrieval, deletion (soft/hard), reprocessing, version control, comparison,
 *   activity tracking, favorites, sharing, download, thumbnail generation, and bulk ops.
 *
 * Responsibilities:
 *   - List documents with server-side pagination, filtering (status, type, search), and sorting
 *   - Single document CRUD with Supabase primary, local cache fallback
 *   - Soft delete with cascade deactivation of extracted entities (facts, decisions, etc.)
 *   - Document reprocessing (single + bulk) with rate limiting, delegated to processor
 *   - Version history retrieval and line-by-line diff comparison between versions
 *   - Extraction data enrichment (matching participants to contacts by name/alias)
 *   - AI analysis history from ai_analysis_log table
 *   - Activity log per document with user profile enrichment
 *   - Favorite toggle and count per user
 *   - Recent document view count (last 7 days)
 *   - Share link creation with token, expiration, and max view limits
 *   - File download with Google Drive and local filesystem support
 *   - Thumbnail generation with sharp (images) and pdf2pic (PDFs), cached to disk
 *   - SSE streaming for real-time reprocess status updates (2s polling interval)
 *   - Bulk delete, bulk reprocess (async background), and bulk export as ZIP
 *   - Reset stuck documents from "processing" to "completed"
 *
 * Key dependencies:
 *   - storage._supabase.supabase: Supabase client for all DB queries
 *   - processor: Document reprocessing engine
 *   - ../../integrations/googleDrive/drive: Google Drive download for gdrive:-prefixed filepaths
 *   - sharp (optional): Image thumbnail resizing
 *   - pdf2pic (optional): PDF first-page thumbnail rendering
 *   - archiver: ZIP archive creation for bulk export
 *   - ../../server/middleware: Rate limiting (checkRateLimit, getRateLimitKey)
 *
 * Side effects:
 *   - Database: updates documents, document_activity, document_favorites, document_shares,
 *     document_views; deactivates entities in facts/decisions/risks/action_items/knowledge_questions
 *   - Graph DB: deletes Document node on document deletion
 *   - Filesystem: reads/writes thumbnail cache, reads document files for download/reprocess
 *   - Network: streams SSE events, downloads from Google Drive
 *   - Background: bulk reprocess runs asynchronously after initial response
 *
 * Notes:
 *   - The SSE stream polls Supabase every 2 seconds; consider websockets for scale
 *   - Bulk reprocess responds immediately with 200, then processes in background
 *   - The diff algorithm is a simple line-by-line comparison, not a proper diff (no LCS)
 *   - Thumbnail generation depends on optional native deps (sharp, pdf2pic);
 *     falls back to an SVG file-type icon if unavailable
 *   - Google Drive files use the "gdrive:<fileId>" filepath convention
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

async function pathExists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
}
const { parseUrl, parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { checkRateLimit, getRateLimitKey, rateLimitResponse } = require('../../server/middleware');
const { isValidUUID } = require('../../server/security');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');
const drive = require('../../integrations/googleDrive/drive');

// Documents-specific 48x48 icon (different from server/static 200x200)
function generateFileIconSVG(fileType) {
    const colors = {
        pdf: '#e53935',
        doc: '#1976d2',
        docx: '#1976d2',
        xls: '#388e3c',
        xlsx: '#388e3c',
        ppt: '#f57c00',
        pptx: '#f57c00',
        txt: '#546e7a',
        md: '#546e7a',
        default: '#78909c'
    };
    const color = colors[fileType] || colors.default;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
        <rect x="8" y="4" width="32" height="40" rx="2" fill="${color}" opacity="0.1"/>
        <rect x="8" y="4" width="32" height="40" rx="2" stroke="${color}" stroke-width="2" fill="none"/>
        <text x="24" y="30" text-anchor="middle" fill="${color}" font-size="10" font-family="sans-serif">${(fileType || '?').toUpperCase()}</text>
    </svg>`;
}

async function handleDocuments(ctx) {
    const { req, res, pathname, storage, processor, invalidateBriefingCache, getCurrentUserId, PORT } = ctx;
    const log = getLogger().child({ module: 'documents' });

    if (!pathname.startsWith('/api/documents')) {
        return false;
    }
    
    // GET /api/documents/:id/processing/stream - SSE stream for single document reprocess
    const docProcessStreamMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/processing\/stream$/i);
    if (docProcessStreamMatch && req.method === 'GET') {
        const docId = docProcessStreamMatch[1];
        
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send document status updates
        const sendDocStatus = async () => {
            try {
                const { data: doc } = await storage._supabase.supabase
                    .from('documents')
                    .select('id, status, summary, facts_count, decisions_count, risks_count, actions_count, questions_count, processed_at, error_message')
                    .eq('id', docId)
                    .single();
                
                if (doc) {
                    res.write(`data: ${JSON.stringify(doc)}\n\n`);
                    
                    // Stop streaming if processed or failed
                    if (doc.status === 'processed' || doc.status === 'completed' || doc.status === 'failed') {
                        res.write(`event: complete\ndata: ${JSON.stringify(doc)}\n\n`);
                        res.end();
                        return true; // Signal to stop
                    }
                }
                return false;
            } catch (err) {
                logError(err, { module: 'documents', event: 'doc_sse_status_error', docId });
                return false;
            }
        };

        // Send immediately
        sendDocStatus();

        // Set up interval
        const intervalId = setInterval(async () => {
            try {
                const shouldStop = await sendDocStatus();
                if (shouldStop) {
                    clearInterval(intervalId);
                }
            } catch (err) {
                clearInterval(intervalId);
            }
        }, 2000); // Update every 2 seconds

        // Clean up on connection close
        req.on('close', () => {
            clearInterval(intervalId);
        });

        return true;
    }

    // GET /api/documents - List documents with pagination and filtering
    if (pathname === '/api/documents' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const status = parsedUrl.query.status || null;
        const limit = Math.min(parseInt(parsedUrl.query.limit) || 50, 200); // Max 200
        const offset = parseInt(parsedUrl.query.offset) || 0;
        const sortBy = ['created_at', 'updated_at', 'filename'].includes(parsedUrl.query.sort) 
            ? parsedUrl.query.sort : 'created_at';
        const order = parsedUrl.query.order === 'asc' ? true : false;
        const docType = parsedUrl.query.type || null;
        const search = parsedUrl.query.search || null;
        const sprintId = parsedUrl.query.sprint_id || null;
        
        try {
            const projectId = storage._supabase.getProjectId();
            
            // Build query with server-side filtering
            let query = storage._supabase.supabase
                .from('documents')
                .select('id, filename, filepath, file_type, doc_type, status, created_at, updated_at, processed_at, summary, facts_count, decisions_count, risks_count, actions_count, questions_count, file_size, deleted_at, sprint_id, action_id, project_id', { count: 'exact' })
                .eq('project_id', projectId);
            
            // Apply status filter
            if (status === 'deleted') {
                query = query.not('deleted_at', 'is', null);
            } else {
                query = query.is('deleted_at', null);
                
                if (status && status !== 'all') {
                    if (status === 'processed') {
                        query = query.in('status', ['processed', 'completed']);
                    } else if (status === 'pending') {
                        query = query.in('status', ['pending', 'processing']);
                    } else {
                        query = query.eq('status', status);
                    }
                }
            }
            
            // Apply doc_type filter
            if (docType && docType !== 'all') {
                if (docType === 'transcripts') {
                    query = query.eq('doc_type', 'transcript');
                } else if (docType === 'emails') {
                    query = query.eq('doc_type', 'email');
                } else if (docType === 'images') {
                    query = query.in('file_type', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
                } else if (docType === 'documents') {
                    query = query.not('doc_type', 'in', '(transcript,email)')
                        .not('file_type', 'in', '(png,jpg,jpeg,gif,webp,svg)');
                }
            }
            
            // Apply search filter
            if (search && search.length >= 2) {
                query = query.ilike('filename', `%${search}%`);
            }

            // Apply sprint filter
            if (sprintId) {
                if (sprintId === '_none') {
                    query = query.is('sprint_id', null);
                } else {
                    query = query.eq('sprint_id', sprintId);
                }
            }
            
            // Apply sorting and pagination
            query = query
                .order(sortBy, { ascending: order })
                .range(offset, offset + limit - 1);
            
            const { data: documents, error, count } = await query;
            
            log.debug({ event: 'documents_query', count, docsLength: documents?.length || 0, status, projectId, error: error?.message }, 'Documents query');

            if (error) throw error;
            
            // Get status counts for the filter bar
            const { data: statusCounts } = await storage._supabase.supabase
                .from('documents')
                .select('status, deleted_at')
                .eq('project_id', projectId);
            
            const activeItems = (statusCounts || []).filter(d => !d.deleted_at);
            const deletedItems = (statusCounts || []).filter(d => d.deleted_at);
            
            const statuses = {
                processed: activeItems.filter(d => d.status === 'processed' || d.status === 'completed').length,
                pending: activeItems.filter(d => d.status === 'pending').length,
                processing: activeItems.filter(d => d.status === 'processing').length,
                failed: activeItems.filter(d => d.status === 'failed').length,
                deleted: deletedItems.length
            };
            
            jsonResponse(res, { 
                documents: documents || [],
                total: count || 0,
                limit,
                offset,
                hasMore: offset + limit < (count || 0),
                statuses
            });
        } catch (err) {
            log.warn({ event: 'documents_list_error', reason: err.message }, 'Documents list error');
            // Fallback to cache
            const documents = await storage.getDocuments(status);
            jsonResponse(res, { 
                documents,
                total: documents.length,
                limit,
                offset: 0,
                hasMore: false,
                statuses: {
                    processed: documents.filter(d => d.status === 'processed').length,
                    pending: documents.filter(d => d.status === 'pending').length,
                    failed: documents.filter(d => d.status === 'failed').length
                }
            });
        }
        return true;
    }

    // GET /api/documents/:id - Get a specific document with full content
    const docGetMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+|\d+)$/i);
    if (docGetMatch && req.method === 'GET') {
        const docId = docGetMatch[1];
        try {
            const { data: doc, error } = await storage._supabase.supabase
                .from('documents')
                .select('*')
                .eq('id', docId)
                .single();
            
            if (error || !doc) {
                const cachedDoc = await storage.getDocumentById(docId);
                if (cachedDoc) {
                    jsonResponse(res, { document: cachedDoc });
                } else {
                    jsonResponse(res, { error: 'Document not found' }, 404);
                }
            } else {
                jsonResponse(res, { document: doc });
            }
        } catch (err) {
            const cachedDoc = await storage.getDocumentById(docId);
            if (cachedDoc) {
                jsonResponse(res, { document: cachedDoc });
            } else {
                jsonResponse(res, { error: 'Document not found' }, 404);
            }
        }
        return true;
    }

    // PATCH /api/documents/:id - Update document metadata (sprint, action, project)
    const docPatchMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+|\d+)$/i);
    if (docPatchMatch && req.method === 'PATCH') {
        const docId = docPatchMatch[1];
        try {
            const body = await parseBody(req);
            const allowed = ['sprint_id', 'action_id', 'project_id', 'title'];
            const updates = {};
            for (const key of allowed) {
                if (key in body) updates[key] = body[key] === '' ? null : body[key];
            }
            if (Object.keys(updates).length === 0) {
                jsonResponse(res, { error: 'No valid fields to update' }, 400);
                return true;
            }
            const result = await storage._supabase.updateDocument(docId, updates);
            if (!result) {
                jsonResponse(res, { error: 'Update failed or no changes' }, 400);
                return true;
            }

            const userId = await getCurrentUserId(req, storage);
            if (userId) {
                const changedFields = Object.keys(updates);
                try {
                    await storage._supabase.supabase
                        .from('document_activity')
                        .insert({
                            document_id: docId,
                            project_id: result.project_id,
                            user_id: userId,
                            action: 'metadata_updated',
                            metadata: { fields: changedFields, updates }
                        });
                } catch (actErr) {
                    log.warn({ event: 'doc_patch_activity_log_failed', reason: actErr?.message }, 'PATCH: failed to log activity');
                }
            }

            jsonResponse(res, { document: result, updated: true });
        } catch (err) {
            jsonResponse(res, { error: 'Failed to update document' }, 500);
        }
        return true;
    }

    // DELETE /api/documents/:id - Delete a document with cascade
    const docDeleteMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+|\d+)$/i);
    if (docDeleteMatch && req.method === 'DELETE') {
        const docId = docDeleteMatch[1];
        const body = await parseBody(req);
        const options = {
            softDelete: body.softDelete !== false,
            deletePhysicalFile: body.deletePhysicalFile || false,
            backupData: body.backupData !== false
        };
        
        try {
            const result = await storage.deleteDocument(docId, options);
            
            // Invalidate caches
            if (invalidateBriefingCache) invalidateBriefingCache();
            
            // Delete document and all linked entity nodes from graph
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    await graphProvider.query(
                        `MATCH (d:Document {id: $id})
                         OPTIONAL MATCH (d)-[:HAS_FACT|HAS_DECISION|HAS_RISK|HAS_ACTION|HAS_QUESTION|HAS_STORY]->(entity)
                         DETACH DELETE d, entity`,
                        { id: docId }
                    );
                    log.debug({ event: 'doc_graph_deleted', docId }, 'Document and linked entities deleted from graph');
                } catch (graphErr) {
                    log.warn({ event: 'doc_graph_delete_error', docId, reason: graphErr.message }, 'Graph document delete error');
                }
            }
            
            jsonResponse(res, {
                success: true,
                ok: true,
                message: `Document and related data deleted`,
                deleted: result.deleted
            });
        } catch (error) {
            log.warn({ event: 'doc_delete_error', docId, reason: error.message }, 'deleteDocument error');
            jsonResponse(res, { success: false, ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/documents/:id/restore - Restore a soft-deleted document
    const restoreMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/restore$/i);
    if (restoreMatch && req.method === 'POST') {
        const docId = restoreMatch[1];
        try {
            const { data: doc, error: fetchErr } = await storage._supabase.supabase
                .from('documents')
                .select('id, filename, deleted_at')
                .eq('id', docId)
                .single();

            if (fetchErr || !doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return true;
            }

            if (!doc.deleted_at) {
                jsonResponse(res, { error: 'Document is not deleted' }, 400);
                return true;
            }

            const { data: restored, error: restoreErr } = await storage._supabase.supabase
                .from('documents')
                .update({ deleted_at: null, status: 'completed' })
                .eq('id', docId)
                .select()
                .single();

            if (restoreErr) throw restoreErr;

            jsonResponse(res, {
                success: true,
                message: `Document "${restored.filename || docId}" restored`,
                document: restored
            });
        } catch (err) {
            jsonResponse(res, { error: err.message || 'Failed to restore document' }, 500);
        }
        return true;
    }

    // GET /api/documents/:id/analysis - Get AI analysis history
    const analysisMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/analysis$/i);
    if (analysisMatch && req.method === 'GET') {
        const docId = analysisMatch[1];
        try {
            const { data, error } = await storage._supabase.supabase
                .from('ai_analysis_log')
                .select('*')
                .eq('document_id', docId)
                .order('created_at', { ascending: false });
            
            if (error) {
                log.warn({ event: 'doc_analysis_query_error', reason: error.message }, 'Analysis query error');
                throw error;
            }
            jsonResponse(res, { analyses: data || [] });
        } catch (err) {
            log.warn({ event: 'doc_analysis_history_error', reason: err.message }, 'Failed to load analysis history');
            jsonResponse(res, { analyses: [] });
        }
        return true;
    }

    // GET /api/documents/:id/summary - Get AI summary for a document
    const summaryMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/summary$/i);
    if (summaryMatch && req.method === 'GET') {
        const docId = summaryMatch[1];
        try {
            const { data, error } = await storage._supabase.supabase
                .from('documents')
                .select('ai_summary, content_preview')
                .eq('id', docId)
                .single();

            if (error) throw error;
            jsonResponse(res, { summary: data?.ai_summary || data?.content_preview || null });
        } catch (err) {
            log.warn({ event: 'doc_summary_error', reason: err.message }, 'Failed to load document summary');
            jsonResponse(res, { summary: null });
        }
        return true;
    }

    // GET /api/documents/:id/extraction - Get extraction data with notes
    const extractionMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/extraction$/i);
    if (extractionMatch && req.method === 'GET') {
        const docId = extractionMatch[1];
        try {
            const { data, error } = await storage._supabase.supabase
                .from('documents')
                .select('extraction_result, project_id')
                .eq('id', docId)
                .single();
            
            if (error) throw error;
            
            let extraction = data?.extraction_result || null;
            
            // Enrich participants with contact linking info
            if (extraction && data?.project_id) {
                const participants = extraction.participants || [];
                const entities = extraction.entities || [];
                const personEntities = entities.filter(e => e.type?.toLowerCase() === 'person');
                
                const allPeopleNames = new Set();
                const allPeople = [];
                
                for (const p of participants) {
                    if (p.name && !allPeopleNames.has(p.name.toLowerCase())) {
                        allPeopleNames.add(p.name.toLowerCase());
                        allPeople.push(p);
                    }
                }
                
                for (const pe of personEntities) {
                    if (pe.name && !allPeopleNames.has(pe.name.toLowerCase())) {
                        allPeopleNames.add(pe.name.toLowerCase());
                        allPeople.push({ name: pe.name });
                    }
                }
                
                if (allPeople.length > 0) {
                    const { data: contacts } = await storage._supabase.supabase
                        .from('contacts')
                        .select('id, name, aliases, email, organization, role, avatar_url, photo_url')
                        .eq('project_id', data.project_id)
                        .is('deleted_at', null);
                    
                    log.debug({ event: 'doc_extraction_enrich', participants: allPeople.length, contacts: contacts?.length || 0 }, 'Enriching participants');
                    
                    const enrichedParticipants = allPeople.map(p => {
                        const personNameLower = (p.name || '').toLowerCase().trim();
                        
                        const matchedContact = (contacts || []).find(c => {
                            if (c.name?.toLowerCase().trim() === personNameLower) return true;
                            if (c.aliases?.some(a => a?.toLowerCase().trim() === personNameLower)) return true;
                            return false;
                        });
                        
                        if (matchedContact) {
                            log.debug({ event: 'doc_extraction_matched', participantName: p.name, contactName: matchedContact.name, contactId: matchedContact.id }, 'Matched participant to contact');
                        }
                        
                        return {
                            ...p,
                            contact_id: matchedContact?.id || null,
                            contact_name: matchedContact?.name || null,
                            contact_email: matchedContact?.email || null,
                            contact_avatar: matchedContact?.avatar_url || matchedContact?.photo_url || null,
                            contact_role: matchedContact?.role || null,
                            contact_organization: matchedContact?.organization || null
                        };
                    });
                    
                    extraction = {
                        ...extraction,
                        participants: enrichedParticipants
                    };
                }
            }
            
            jsonResponse(res, { extraction });
        } catch (err) {
            log.warn({ event: 'doc_extraction_error', reason: err.message }, 'Extraction error');
            jsonResponse(res, { extraction: null });
        }
        return true;
    }

    // GET /api/documents/:id/versions - Get version history
    const versionsGetMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/versions$/i);
    if (versionsGetMatch && req.method === 'GET') {
        const docId = versionsGetMatch[1];
        try {
            const { data, error } = await storage._supabase.supabase
                .from('document_versions')
                .select('*')
                .eq('document_id', docId)
                .order('version_number', { ascending: false });
            
            if (error) throw error;
            jsonResponse(res, { versions: data || [] });
        } catch (err) {
            jsonResponse(res, { versions: [] });
        }
        return true;
    }

    // GET /api/documents/:id/compare/:versionId - Compare document versions
    const compareMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/compare\/([a-f0-9\-]+)$/i);
    if (compareMatch && req.method === 'GET') {
        const docId = compareMatch[1];
        const compareVersionId = compareMatch[2];
        
        try {
            const { data: doc } = await storage._supabase.supabase
                .from('documents')
                .select('content, summary, filename')
                .eq('id', docId)
                .single();

            const { data: version } = await storage._supabase.supabase
                .from('document_versions')
                .select('content, summary, version_number, filename')
                .eq('id', compareVersionId)
                .single();

            if (!doc || !version) {
                jsonResponse(res, { error: 'Document or version not found' }, 404);
                return true;
            }

            const currentContent = doc.content || '';
            const versionContent = version.content || '';
            
            const currentLines = currentContent.split('\n');
            const versionLines = versionContent.split('\n');
            
            const diff = {
                additions: 0,
                deletions: 0,
                changes: []
            };
            
            const maxLines = Math.max(currentLines.length, versionLines.length);
            for (let i = 0; i < maxLines; i++) {
                const currentLine = currentLines[i] || '';
                const versionLine = versionLines[i] || '';
                
                if (currentLine !== versionLine) {
                    if (currentLine && !versionLine) {
                        diff.additions++;
                        diff.changes.push({ type: 'add', line: i + 1, content: currentLine });
                    } else if (!currentLine && versionLine) {
                        diff.deletions++;
                        diff.changes.push({ type: 'delete', line: i + 1, content: versionLine });
                    } else {
                        diff.deletions++;
                        diff.additions++;
                        diff.changes.push({ type: 'change', line: i + 1, old: versionLine, new: currentLine });
                    }
                }
            }

            const entityTypes = ['facts', 'decisions', 'risks', 'action_items', 'knowledge_questions'];
            const entityDiff = {};
            
            for (const table of entityTypes) {
                const { count: currentCount } = await storage._supabase.supabase
                    .from(table)
                    .select('id', { count: 'exact', head: true })
                    .eq('source_document_id', docId);
                
                entityDiff[table.replace('action_items', 'actions').replace('knowledge_questions', 'questions')] = {
                    current: currentCount || 0
                };
            }

            jsonResponse(res, {
                current: {
                    filename: doc.filename,
                    summary: doc.summary,
                    content_preview: currentContent.substring(0, 500)
                },
                version: {
                    version_number: version.version_number,
                    filename: version.filename,
                    summary: version.summary,
                    content_preview: versionContent.substring(0, 500)
                },
                diff: {
                    stats: {
                        additions: diff.additions,
                        deletions: diff.deletions,
                        total_changes: diff.changes.length
                    },
                    changes: diff.changes.slice(0, 100),
                    entities: entityDiff
                }
            });
        } catch (err) {
            log.warn({ event: 'doc_compare_error', err: err?.message }, 'Compare error');
            jsonResponse(res, { error: 'Failed to compare versions' }, 500);
        }
        return true;
    }

    // POST /api/documents/:id/versions - Upload new version (not yet implemented)
    const versionsPostMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/versions$/i);
    if (versionsPostMatch && req.method === 'POST') {
        jsonResponse(res, { 
            success: false, 
            error: 'Version upload is not yet implemented'
        }, 501);
        return true;
    }

    // GET /api/documents/:id/activity - Get activity log
    const activityMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/activity$/i);
    if (activityMatch && req.method === 'GET') {
        const docId = activityMatch[1];
        try {
            const { data: activities, error } = await storage._supabase.supabase
                .from('document_activity')
                .select('*')
                .eq('document_id', docId)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) {
                log.warn({ event: 'doc_activity_query_error', reason: error.message }, 'Activity query error');
                throw error;
            }
            
            const userIds = [...new Set((activities || []).map(a => a.user_id).filter(Boolean))];
            let userMap = {};
            
            if (userIds.length > 0) {
                const { data: profiles } = await storage._supabase.supabase
                    .from('user_profiles')
                    .select('id, display_name, avatar_url')
                    .in('id', userIds);
                
                if (profiles) {
                    userMap = Object.fromEntries(profiles.map(p => [p.id, p]));
                }
            }
            
            const result = (activities || []).map(a => ({
                ...a,
                user_name: userMap[a.user_id]?.display_name || a.user_name || 'System',
                user_avatar: userMap[a.user_id]?.avatar_url || a.user_avatar
            }));
            
            jsonResponse(res, { activities: result });
        } catch (err) {
            log.warn({ event: 'doc_activity_load_error', reason: err.message }, 'Failed to load activity');
            jsonResponse(res, { activities: [] });
        }
        return true;
    }

    // GET /api/documents/:id/favorite - Check if document is favorite
    const favoriteGetMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/favorite$/i);
    if (favoriteGetMatch && req.method === 'GET') {
        const docId = favoriteGetMatch[1];
        const userId = await getCurrentUserId(req, storage);
        
        if (!userId) {
            jsonResponse(res, { is_favorite: false });
            return true;
        }
        
        try {
            const { data, error } = await storage._supabase.supabase
                .from('document_favorites')
                .select('id')
                .eq('document_id', docId)
                .eq('user_id', userId)
                .single();
            
            jsonResponse(res, { is_favorite: !!data && !error });
        } catch (err) {
            jsonResponse(res, { is_favorite: false });
        }
        return true;
    }

    // POST /api/documents/:id/favorite - Toggle favorite
    const favoritePostMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/favorite$/i);
    if (favoritePostMatch && req.method === 'POST') {
        const docId = favoritePostMatch[1];
        const userId = await getCurrentUserId(req, storage);
        
        if (!userId) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        try {
            const { data: existing } = await storage._supabase.supabase
                .from('document_favorites')
                .select('id')
                .eq('document_id', docId)
                .eq('user_id', userId)
                .single();
            
            if (existing) {
                await storage._supabase.supabase
                    .from('document_favorites')
                    .delete()
                    .eq('document_id', docId)
                    .eq('user_id', userId);
                
                jsonResponse(res, { is_favorite: false, message: 'Removed from favorites' });
            } else {
                await storage._supabase.supabase
                    .from('document_favorites')
                    .insert({ document_id: docId, user_id: userId });
                
                jsonResponse(res, { is_favorite: true, message: 'Added to favorites' });
            }
        } catch (err) {
            jsonResponse(res, { error: 'Failed to update favorite' }, 500);
        }
        return true;
    }

    // GET /api/documents/:id/reprocess/check - Check if reprocess will have same content
    const reprocessCheckMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/reprocess\/check$/i);
    if (reprocessCheckMatch && req.method === 'GET') {
        const docId = reprocessCheckMatch[1];
        
        try {
            const { data: doc, error: docError } = await storage._supabase.supabase
                .from('documents')
                .select('*')
                .eq('id', docId)
                .single();
            
            if (docError || !doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return true;
            }
            
            let filePath = doc.filepath || doc.path;
            const projectDataDir = storage.getProjectDataDir();
            const contentDir = path.join(projectDataDir, 'content');
            const baseName = path.basename(doc.filename || '', path.extname(doc.filename || ''));
            const contentFilePath = path.join(contentDir, `${baseName}.md`);
            
            if ((!filePath || !(await pathExists(filePath))) && (await pathExists(contentFilePath))) {
                filePath = contentFilePath;
            }
            
            let currentHash = null;
            let hasContent = false;
            
            if (filePath && (await pathExists(filePath))) {
                const content = await fsp.readFile(filePath, 'utf-8');
                currentHash = require('crypto').createHash('md5').update(content).digest('hex');
                hasContent = true;
            } else if (doc.content) {
                currentHash = require('crypto').createHash('md5').update(doc.content).digest('hex');
                hasContent = true;
            }
            
            const previousHash = doc.content_hash || doc.file_hash;
            const hashMatch = previousHash && currentHash && previousHash === currentHash;
            
            const entityCounts = {};
            for (const type of ['facts', 'decisions', 'risks', 'action_items', 'knowledge_questions']) {
                try {
                    const { count } = await storage._supabase.supabase
                        .from(type)
                        .select('id', { count: 'exact', head: true })
                        .eq('source_document_id', docId);
                    entityCounts[type] = count || 0;
                } catch {
                    entityCounts[type] = 0;
                }
            }
            
            jsonResponse(res, {
                document_id: docId,
                has_content: hasContent,
                current_hash: currentHash,
                previous_hash: previousHash,
                hash_match: hashMatch,
                existing_entities: entityCounts,
                total_entities: Object.values(entityCounts).reduce((a, b) => a + b, 0),
                status: doc.status
            });
        } catch (err) {
            log.warn({ event: 'doc_reprocess_check_error', reason: err?.message }, 'Reprocess check error');
            jsonResponse(res, { error: 'Failed to check document' }, 500);
        }
        return true;
    }

    // POST /api/documents/:id/reset-status - Reset a stuck document's status
    const resetStatusMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/reset-status$/i);
    if (resetStatusMatch && req.method === 'POST') {
        const docId = resetStatusMatch[1];
        
        try {
            const { data: doc, error: fetchError } = await storage._supabase.supabase
                .from('documents')
                .select('id, status, filename')
                .eq('id', docId)
                .single();
            
            if (fetchError || !doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return true;
            }
            
            if (doc.status !== 'processing') {
                jsonResponse(res, { error: `Document is not stuck (status: ${doc.status})` }, 400);
                return true;
            }
            
            const { error: updateError } = await storage._supabase.supabase
                .from('documents')
                .update({ 
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', docId);
            
            if (updateError) throw updateError;
            
            log.info({ event: 'doc_reset_status', docId, filename: doc.filename }, 'Reset status to completed');
            
            jsonResponse(res, { 
                success: true, 
                message: `Document status reset to 'completed'`,
                document: { id: docId, filename: doc.filename, status: 'completed' }
            });
        } catch (err) {
            log.warn({ event: 'doc_reset_status_error', docId, reason: err.message }, 'Reset status error');
            jsonResponse(res, { error: 'Failed to reset document status' }, 500);
        }
        return true;
    }

    // POST /api/documents/:id/reprocess - Reprocess a document
    const reprocessMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/reprocess$/i);
    if (reprocessMatch && req.method === 'POST') {
        const docId = reprocessMatch[1];
        
        const rateLimitKey = getRateLimitKey(req, 'reprocess');
        if (!checkRateLimit(rateLimitKey, 5, 60000)) {
            rateLimitResponse(res);
            return true;
        }
        
        if (!isValidUUID(docId)) {
            jsonResponse(res, { error: 'Invalid document ID' }, 400);
            return true;
        }
        
        try {
            const { data: doc, error: docError } = await storage._supabase.supabase
                .from('documents')
                .select('id, filename, status, project_id')
                .eq('id', docId)
                .single();
            
            if (docError || !doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return true;
            }
            
            if (doc.status === 'processing') {
                jsonResponse(res, { 
                    error: 'Document is already being reprocessed',
                    status: 'processing'
                }, 409);
                return true;
            }
            
            const userId = await getCurrentUserId(req, storage);
            if (userId) {
                try {
                    await storage._supabase.supabase
                        .from('document_activity')
                        .insert({
                            document_id: docId,
                            project_id: doc.project_id,
                            user_id: userId,
                            action: 'reprocess_started',
                            metadata: { triggered_by: 'user' }
                        });
                } catch (activityErr) {
                    log.warn({ event: 'doc_reprocess_activity_log_failed', reason: activityErr.message }, 'Reprocess: failed to log activity');
                }
            }
            
            jsonResponse(res, { 
                success: true, 
                message: 'Document reprocessing started',
                document_id: docId
            });
            
            processor.reprocessDocument(docId).then(result => {
                if (result.success) {
                    log.info({ event: 'doc_reprocess_complete', filename: doc.filename, entities: result.entities }, 'Reprocess complete');
                } else {
                    log.warn({ event: 'doc_reprocess_failed', filename: doc.filename, reason: result.error }, 'Reprocess failed');
                }
            }).catch(err => {
                log.warn({ event: 'doc_reprocess_unexpected_error', reason: err.message }, 'Reprocess unexpected error');
            });
            
        } catch (err) {
            log.warn({ event: 'doc_reprocess_error', reason: err?.message }, 'Reprocess error');
            jsonResponse(res, { error: 'Failed to reprocess document' }, 500);
        }
        return true;
    }

    // POST /api/documents/bulk/update - Bulk update metadata (sprint, action, project)
    if (pathname === '/api/documents/bulk/update' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { ids, updates: rawUpdates } = body;
            if (!Array.isArray(ids) || ids.length === 0) {
                jsonResponse(res, { error: 'ids array required' }, 400);
                return true;
            }
            const allowed = ['sprint_id', 'action_id', 'project_id'];
            const updates = {};
            for (const key of allowed) {
                if (key in (rawUpdates || {})) updates[key] = rawUpdates[key] === '' ? null : rawUpdates[key];
            }
            if (Object.keys(updates).length === 0) {
                jsonResponse(res, { error: 'No valid fields to update' }, 400);
                return true;
            }
            updates.updated_at = new Date().toISOString();

            const { data, error } = await storage._supabase.supabase
                .from('documents')
                .update(updates)
                .in('id', ids)
                .select('id');

            if (error) throw error;

            const userId = await getCurrentUserId(req, storage);
            if (userId) {
                const activityRows = ids.map(docId => ({
                    document_id: docId,
                    project_id: storage._supabase.getProjectId(),
                    user_id: userId,
                    action: 'metadata_updated',
                    metadata: { fields: Object.keys(updates).filter(k => k !== 'updated_at'), updates, bulk: true }
                }));
                try {
                    await storage._supabase.supabase.from('document_activity').insert(activityRows);
                } catch (_) { /* best effort */ }
            }

            jsonResponse(res, { updated: data?.length || 0, total: ids.length });
        } catch (err) {
            jsonResponse(res, { error: 'Bulk update failed' }, 500);
        }
        return true;
    }

    // POST /api/documents/bulk/delete - Bulk delete documents with cascade
    if (pathname === '/api/documents/bulk/delete' && req.method === 'POST') {
        const rateLimitKey = getRateLimitKey(req, 'bulk-delete');
        if (!checkRateLimit(rateLimitKey, 10, 60000)) {
            rateLimitResponse(res);
            return true;
        }
        
        const body = await parseBody(req);
        const ids = body.ids;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            jsonResponse(res, { error: 'ids array is required' }, 400);
            return true;
        }
        
        const invalidIds = ids.filter(id => !isValidUUID(id));
        if (invalidIds.length > 0) {
            jsonResponse(res, { 
                error: 'Invalid document IDs', 
                invalid: invalidIds 
            }, 400);
            return true;
        }

        try {
            const results = { 
                success: [], 
                failed: [], 
                deleted: 0, 
                entitiesDeactivated: 0 
            };
            
            for (const id of ids) {
                try {
                    const result = await storage.deleteDocument(id, { softDelete: true, backupData: true });
                    const entitiesCount = Object.values(result.deleted || {}).reduce((a, b) => a + b, 0);

                    // Also clean graph if connected
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        try {
                            await graphProvider.query(
                                `MATCH (d:Document {id: $id}) DETACH DELETE d`,
                                { id }
                            );
                        } catch (_) { /* best effort */ }
                    }
                    
                    results.success.push({ id, entitiesDeactivated: entitiesCount, deleted: result.deleted });
                    results.deleted++;
                    results.entitiesDeactivated += entitiesCount;
                } catch (err) {
                    results.failed.push({ id, error: err.message });
                }
            }
            
            if (invalidateBriefingCache) invalidateBriefingCache();

            jsonResponse(res, { 
                success: results.failed.length === 0, 
                deleted: results.deleted,
                entitiesDeactivated: results.entitiesDeactivated,
                results: results.success,
                errors: results.failed
            });
        } catch (err) {
            log.warn({ event: 'doc_bulk_delete_error', reason: err?.message }, 'BulkDelete error');
            jsonResponse(res, { error: 'Failed to delete documents' }, 500);
        }
        return true;
    }

    // POST /api/documents/bulk/reprocess - Bulk reprocess documents
    if (pathname === '/api/documents/bulk/reprocess' && req.method === 'POST') {
        const rateLimitKey = getRateLimitKey(req, 'bulk-reprocess');
        if (!checkRateLimit(rateLimitKey, 3, 60000)) {
            rateLimitResponse(res);
            return true;
        }
        
        const body = await parseBody(req);
        const ids = body.ids;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            jsonResponse(res, { error: 'ids array is required' }, 400);
            return true;
        }
        
        const invalidIds = ids.filter(id => !isValidUUID(id));
        if (invalidIds.length > 0) {
            jsonResponse(res, { 
                error: 'Invalid document IDs', 
                invalid: invalidIds 
            }, 400);
            return true;
        }

        jsonResponse(res, { 
            success: true, 
            message: `${ids.length} documents queued for reprocessing`,
            queued: ids,
            failed: []
        });

        (async () => {
            log.info({ event: 'doc_bulk_reprocess_start', count: ids.length }, 'BulkReprocess starting');
            let completed = 0;
            let failed = 0;
            
            for (const docId of ids) {
                try {
                    const result = await processor.reprocessDocument(docId);
                    if (result.success) {
                        completed++;
                        log.debug({ event: 'doc_bulk_reprocess_item', completed, total: ids.length, docId, entities: result.entities }, 'BulkReprocess item');
                    } else {
                        failed++;
                        log.warn({ event: 'doc_bulk_reprocess_item_failed', completed, total: ids.length, docId, reason: result.error }, 'BulkReprocess item failed');
                    }
                } catch (err) {
                    failed++;
                    log.warn({ event: 'doc_bulk_reprocess_error', docId, reason: err.message }, 'BulkReprocess processing error');
                }
            }
            
            log.info({ event: 'doc_bulk_reprocess_done', completed, failed, total: ids.length }, 'BulkReprocess completed');
        })();

        return true;
    }

    // POST /api/documents/bulk/export - Bulk export as ZIP
    if (pathname === '/api/documents/bulk/export' && req.method === 'POST') {
        const body = await parseBody(req);
        const ids = body.ids;
        const format = body.format || 'original';
        
        if (!Array.isArray(ids) || ids.length === 0) {
            jsonResponse(res, { error: 'ids array is required' }, 400);
            return true;
        }

        try {
            const archiver = require('archiver');
            const archive = archiver('zip', { zlib: { level: 9 } });

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="documents_export_${Date.now()}.zip"`);

            archive.pipe(res);

            for (const id of ids) {
                try {
                    const { data: doc } = await storage._supabase.supabase
                        .from('documents')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (!doc) continue;

                    if (format === 'markdown' && doc.content) {
                        const mdContent = `# ${doc.title || doc.filename}\n\n${doc.summary ? `## Summary\n${doc.summary}\n\n` : ''}## Content\n\n${doc.content}`;
                        archive.append(mdContent, { name: `${doc.filename.replace(/\.[^.]+$/, '')}.md` });
                    } else {
                        let filePath = doc.filepath;
                        if (!filePath || !(await pathExists(filePath))) {
                            const contentDir = path.join(storage.getProjectDataDir(), 'content');
                            const baseName = doc.filename.replace(/\.[^.]+$/, '.md');
                            filePath = path.join(contentDir, baseName);
                        }

                        if (filePath && (await pathExists(filePath))) {
                            archive.file(filePath, { name: doc.filename });
                        } else if (doc.content) {
                            archive.append(doc.content, { name: doc.filename });
                        }
                    }
                } catch (err) {
                    log.warn({ event: 'doc_bulk_export_item_error', id, reason: err?.message }, 'BulkExport error adding');
                }
            }

            await archive.finalize();
        } catch (err) {
            log.warn({ event: 'doc_bulk_export_error', reason: err?.message }, 'BulkExport error');
            jsonResponse(res, { error: 'Failed to export documents' }, 500);
        }
        return true;
    }

    // POST /api/documents/:id/share - Create share link
    const sharePostMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/share$/i);
    if (sharePostMatch && req.method === 'POST') {
        const docId = sharePostMatch[1];
        const body = await parseBody(req);
        const userId = await getCurrentUserId(req, storage);
        
        try {
            const crypto = require('crypto');
            const token = crypto.randomBytes(24).toString('base64url');
            
            let expiresAt = null;
            if (body.expires && body.expires !== 'never') {
                const days = parseInt(body.expires) || 7;
                expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
            }
            
            const { data: doc } = await storage._supabase.supabase
                .from('documents')
                .select('project_id')
                .eq('id', docId)
                .single();
            
            const { data, error } = await storage._supabase.supabase
                .from('document_shares')
                .insert({
                    document_id: docId,
                    project_id: doc?.project_id || storage.currentProjectId,
                    token,
                    expires_at: expiresAt,
                    max_views: body.max_views || null,
                    permissions: body.permissions || ['view'],
                    created_by: userId
                })
                .select()
                .single();
            
            if (error) throw error;
            
            const baseUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
            jsonResponse(res, {
                success: true,
                url: `${baseUrl}/share/${token}`,
                token,
                share: data
            });
        } catch (err) {
            log.warn({ event: 'doc_share_error', reason: err?.message }, 'Share error');
            jsonResponse(res, { error: 'Failed to create share link' }, 500);
        }
        return true;
    }

    // GET /api/documents/favorites/count - Count user's favorites
    if (pathname === '/api/documents/favorites/count' && req.method === 'GET') {
        const userId = await getCurrentUserId(req, storage);
        
        if (!userId) {
            jsonResponse(res, { count: 0 });
            return true;
        }
        
        try {
            const { count, error } = await storage._supabase.supabase
                .from('document_favorites')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            
            jsonResponse(res, { count: count || 0 });
        } catch (err) {
            jsonResponse(res, { count: 0 });
        }
        return true;
    }

    // GET /api/documents/recent/count - Count user's recent views
    if (pathname === '/api/documents/recent/count' && req.method === 'GET') {
        const userId = await getCurrentUserId(req, storage);
        
        if (!userId) {
            jsonResponse(res, { count: 0 });
            return true;
        }
        
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { count, error } = await storage._supabase.supabase
                .from('document_views')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('last_viewed_at', sevenDaysAgo);
            
            jsonResponse(res, { count: count || 0 });
        } catch (err) {
            jsonResponse(res, { count: 0 });
        }
        return true;
    }

    // GET /api/documents/:id/download - Download document
    const downloadMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/download$/i);
    if (downloadMatch && req.method === 'GET') {
        const docId = downloadMatch[1];
        
        try {
            const { data: doc } = await storage._supabase.supabase
                .from('documents')
                .select('filepath, filename, file_type, content, project_id')
                .eq('id', docId)
                .single();

            if (!doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return true;
            }

            if (doc.filepath && doc.filepath.startsWith('gdrive:')) {
                const fileId = doc.filepath.replace(/^gdrive:/, '').trim();
                const projectId = doc.project_id;
                const client = await drive.getDriveClientForRead(projectId);
                if (!client || !client.drive) {
                    jsonResponse(res, { error: 'Google Drive credentials not configured for this project' }, 503);
                    return true;
                }
                const buffer = await drive.downloadFile(client, fileId);
                const mimeTypes = {
                    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    txt: 'text/plain', md: 'text/markdown', json: 'application/json',
                    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp'
                };
                const ext = (doc.file_type || path.extname(doc.filename || '').slice(1)).toLowerCase();
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                const safeFilename = (doc.filename || 'document').replace(/[^\w\-. ]/g, '_');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Content-Security-Policy', "default-src 'none'");
                res.end(buffer);
                return true;
            }

            let filePath = doc.filepath;
            if (!filePath || !(await pathExists(filePath))) {
                const contentDir = path.join(storage.getProjectDataDir(), 'content');
                const baseName = path.basename(doc.filename || '', path.extname(doc.filename || ''));
                filePath = path.join(contentDir, `${baseName}.md`);
            }

            if (!filePath || !(await pathExists(filePath))) {
                if (doc.content) {
                    const contentType = doc.file_type === 'md' ? 'text/markdown' : 'text/plain';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename || 'document.txt'}"`);
                    res.end(doc.content);
                    return true;
                }
                jsonResponse(res, { error: 'File not found' }, 404);
                return true;
            }

            const mimeTypes = {
                pdf: 'application/pdf',
                doc: 'application/msword',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xls: 'application/vnd.ms-excel',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ppt: 'application/vnd.ms-powerpoint',
                pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                txt: 'text/plain',
                md: 'text/markdown',
                json: 'application/json',
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                gif: 'image/gif',
                webp: 'image/webp'
            };
            const ext = (doc.file_type || path.extname(doc.filename || '').slice(1)).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            
            const safeFilename = (doc.filename || 'document').replace(/[^\w\-. ]/g, '_');
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Security-Policy', "default-src 'none'");
            
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        } catch (err) {
            log.warn({ event: 'doc_download_error', reason: err.message }, 'Download error');
            jsonResponse(res, { error: 'Download failed' }, 500);
        }
        return true;
    }

    // GET /api/documents/:id/thumbnail - Get document thumbnail
    const thumbnailMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/thumbnail$/i);
    if (thumbnailMatch && req.method === 'GET') {
        const docId = thumbnailMatch[1];
        
        try {
            const { data: doc } = await storage._supabase.supabase
                .from('documents')
                .select('filepath, filename, file_type, created_at, project_id')
                .eq('id', docId)
                .single();

            if (!doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return true;
            }

            const cacheDir = path.join(storage.getProjectDataDir(), 'documents', 'cache', 'thumbnails');
            const cachePath = path.join(cacheDir, `${docId}.png`);
            
            if (await pathExists(cachePath)) {
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                fs.createReadStream(cachePath).pipe(res);
                return true;
            }

            const fileType = doc.file_type?.toLowerCase() || path.extname(doc.filename || '').slice(1).toLowerCase();
            let thumbnailGenerated = false;
            let localPathForThumb = doc.filepath;

            if (doc.filepath && doc.filepath.startsWith('gdrive:')) {
                const fileId = doc.filepath.replace(/^gdrive:/, '').trim();
                const client = await drive.getDriveClientForRead(doc.project_id);
                if (client && client.drive) {
                    try {
                        const buffer = await drive.downloadFile(client, fileId);
                        const tmpPath = path.join(os.tmpdir(), `gdrive-${docId}-${path.basename(doc.filename || 'file')}`);
                        await fsp.writeFile(tmpPath, buffer);
                        localPathForThumb = tmpPath;
                        try {
                            if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType)) {
                                const sharp = require('sharp');
                                await fsp.mkdir(cacheDir, { recursive: true });
                                await sharp(buffer).resize(200, 200, { fit: 'cover' }).png().toFile(cachePath);
                                thumbnailGenerated = true;
                            } else if (fileType === 'pdf') {
                                const { fromPath } = require('pdf2pic');
                                await fsp.mkdir(cacheDir, { recursive: true });
                                const convert = fromPath(tmpPath, { density: 100, saveFilename: docId, savePath: cacheDir, format: 'png', width: 200, height: 280 });
                                await convert(1);
                                const generatedPath = path.join(cacheDir, `${docId}.1.png`);
                                if (await pathExists(generatedPath)) {
                                    await fsp.rename(generatedPath, cachePath);
                                    thumbnailGenerated = true;
                                }
                            }
                        } finally {
                            try { await fsp.unlink(tmpPath); } catch (_) {}
                        }
                    } catch (e) {
                        log.warn({ event: 'doc_thumbnail_gdrive_failed', reason: e.message }, 'Thumbnail: Google Drive download failed');
                    }
                }
            }

            if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType) && localPathForThumb && (await pathExists(localPathForThumb))) {
                try {
                    const sharp = require('sharp');
                    await fsp.mkdir(cacheDir, { recursive: true });
                    await sharp(localPathForThumb)
                        .resize(200, 200, { fit: 'cover' })
                        .png()
                        .toFile(cachePath);
                    thumbnailGenerated = true;
                } catch (sharpErr) {
                    log.warn({ event: 'doc_thumbnail_sharp_failed', reason: sharpErr.message }, 'Thumbnail: Sharp not available or failed');
                }
            }

            if (fileType === 'pdf' && localPathForThumb && (await pathExists(localPathForThumb))) {
                try {
                    const { fromPath } = require('pdf2pic');
                    await fsp.mkdir(cacheDir, { recursive: true });
                    const convert = fromPath(localPathForThumb, {
                        density: 100,
                        saveFilename: docId,
                        savePath: cacheDir,
                        format: 'png',
                        width: 200,
                        height: 280
                    });
                    await convert(1);
                    const generatedPath = path.join(cacheDir, `${docId}.1.png`);
                    if (await pathExists(generatedPath)) {
                        await fsp.rename(generatedPath, cachePath);
                        thumbnailGenerated = true;
                    }
                } catch (pdfErr) {
                    log.warn({ event: 'doc_thumbnail_pdf2pic_failed', reason: pdfErr.message }, 'Thumbnail: pdf2pic not available or failed');
                }
            }

            if (thumbnailGenerated && (await pathExists(cachePath))) {
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                fs.createReadStream(cachePath).pipe(res);
            } else {
                const iconSvg = generateFileIconSVG(fileType);
                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.end(iconSvg);
            }
        } catch (err) {
            log.warn({ event: 'doc_thumbnail_error', reason: err?.message }, 'Thumbnail error');
            jsonResponse(res, { error: 'Failed to generate thumbnail' }, 500);
        }
        return true;
    }

    // Not handled by this module
    return false;
}

module.exports = { handleDocuments };
