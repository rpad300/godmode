/**
 * Bulk and Undo API
 * Extracted from server.js
 *
 * Handles:
 * - POST /api/bulk/delete - Bulk delete items
 * - POST /api/bulk/status - Bulk update status
 * - POST /api/undo/restore - Restore a single deleted item
 * - POST /api/undo/restore-bulk - Restore multiple deleted items
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

async function handleBulk(ctx) {
    const { req, res, pathname, storage } = ctx;

    // POST /api/bulk/delete - Bulk delete items
    if (pathname === '/api/bulk/delete' && req.method === 'POST') {
        const body = await parseBody(req);
        const { type, ids } = body;

        if (!type || !ids || !Array.isArray(ids)) {
            jsonResponse(res, { error: 'Missing type or ids' }, 400);
            return true;
        }

        let deleted = 0;
        if (type === 'facts') {
            const facts = storage.knowledge.facts;
            const idsSet = new Set(ids.map(String));
            const remaining = facts.filter((f, idx) => !idsSet.has(String(f.id || idx)));
            deleted = facts.length - remaining.length;
            storage.knowledge.facts = remaining;
            storage.saveKnowledge();
        } else if (type === 'risks') {
            const risks = storage.knowledge.risks;
            const idsSet = new Set(ids.map(String));
            const remaining = risks.filter((r, idx) => !idsSet.has(String(r.id || idx)));
            deleted = risks.length - remaining.length;
            storage.knowledge.risks = remaining;
            storage.saveKnowledge();
        } else if (type === 'actions') {
            const actions = storage.knowledge.action_items;
            const idsSet = new Set(ids.map(String));
            const remaining = actions.filter((a, idx) => !idsSet.has(String(a.id || idx)));
            deleted = actions.length - remaining.length;
            storage.knowledge.action_items = remaining;
            storage.saveKnowledge();
        }

        storage.recordDailyStats();

        jsonResponse(res, { deleted, type });
        return true;
    }

    // POST /api/bulk/status - Bulk update status
    if (pathname === '/api/bulk/status' && req.method === 'POST') {
        const body = await parseBody(req);
        const { type, ids, status } = body;

        if (!type || !ids || !Array.isArray(ids) || !status) {
            jsonResponse(res, { error: 'Missing type, ids, or status' }, 400);
            return true;
        }

        let updated = 0;
        const idsSet = new Set(ids.map(String));

        if (type === 'risks') {
            storage.knowledge.risks.forEach((r, idx) => {
                if (idsSet.has(String(r.id || idx))) {
                    r.status = status;
                    updated++;
                }
            });
            storage.saveKnowledge();
        } else if (type === 'actions') {
            storage.knowledge.action_items.forEach((a, idx) => {
                if (idsSet.has(String(a.id || idx))) {
                    a.status = status;
                    updated++;
                }
            });
            storage.saveKnowledge();
        }

        storage.recordDailyStats();

        jsonResponse(res, { updated, type, status });
        return true;
    }

    // POST /api/undo/restore - Restore a single deleted item
    if (pathname === '/api/undo/restore' && req.method === 'POST') {
        const body = await parseBody(req);
        const { type, data } = body;

        if (!type || !data) {
            jsonResponse(res, { error: 'Missing type or data' }, 400);
            return true;
        }

        try {
            if (type === 'risk') {
                storage.knowledge.risks.push({
                    ...data,
                    id: data.id || Date.now(),
                    restored_at: new Date().toISOString()
                });
                storage.saveKnowledge();
            } else if (type === 'action') {
                storage.knowledge.action_items.push({
                    ...data,
                    id: data.id || Date.now(),
                    restored_at: new Date().toISOString()
                });
                storage.saveKnowledge();
            } else {
                jsonResponse(res, { error: 'Unknown type' }, 400);
                return true;
            }

            storage.recordDailyStats();
            jsonResponse(res, { success: true, type });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/undo/restore-bulk - Restore multiple deleted items
    if (pathname === '/api/undo/restore-bulk' && req.method === 'POST') {
        const body = await parseBody(req);
        const { type, items } = body;

        if (!type || !items || !Array.isArray(items)) {
            jsonResponse(res, { error: 'Missing type or items' }, 400);
            return true;
        }

        try {
            let restored = 0;
            const now = new Date().toISOString();

            if (type === 'facts') {
                for (const item of items) {
                    storage.knowledge.facts.push({
                        ...item,
                        id: item.id || Date.now() + restored,
                        restored_at: now
                    });
                    restored++;
                }
                storage.saveKnowledge();
            } else if (type === 'risks') {
                for (const item of items) {
                    storage.knowledge.risks.push({
                        ...item,
                        id: item.id || Date.now() + restored,
                        restored_at: now
                    });
                    restored++;
                }
                storage.saveKnowledge();
            } else if (type === 'actions') {
                for (const item of items) {
                    storage.knowledge.action_items.push({
                        ...item,
                        id: item.id || Date.now() + restored,
                        restored_at: now
                    });
                    restored++;
                }
                storage.saveKnowledge();
            } else {
                jsonResponse(res, { error: 'Unknown type' }, 400);
                return true;
            }

            storage.recordDailyStats();
            jsonResponse(res, { success: true, restored, type });
        } catch (e) {
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleBulk };
