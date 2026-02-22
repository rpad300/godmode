/**
 * Purpose:
 *   Full-featured roles management API. Powers role-based UX: template browsing,
 *   AI role suggestions, dashboards, analytics, notifications, role history,
 *   perspective switching, filtered knowledge, collaborative user management,
 *   calendar integration, onboarding, and role-scoped exports.
 *
 * Responsibilities:
 *   - Role templates: list all, get by ID (loaded from Supabase)
 *   - AI suggestions: suggest role prompt improvements, generate role from title
 *   - Dashboard: role-aware project dashboard with KPIs
 *   - Analytics: track user interactions, role-scoped analytics dashboard
 *   - Notifications: list, create, and mark-as-read role-targeted notifications
 *   - History: role change log with timeline and insights
 *   - Perspective: temporary role switching (start, get, end perspective)
 *   - Filtered knowledge: role-relevant subset of the knowledge base
 *   - Users: collaborative user management (list, add, update, delete)
 *   - Calendar: event management, iCal import, briefing context for role
 *   - Onboarding: steps, quick setup options, tips, completion processing
 *   - Export: role-scoped reports (markdown/html/json) and executive summaries
 *
 * Key dependencies:
 *   - ../../roles: all role subsystem modules (getRoleTemplates, getAIRoleSuggestions,
 *     getRoleDashboard, getRoleAnalytics, getSmartNotifications, getRoleHistory,
 *     getQuickRoleSwitch, getRoleFilters, getCollaborativeRoles, getCalendarIntegration,
 *     getRoleOnboarding, getRoleExport)
 *   - ctx.storage: project data, current project context
 *   - ctx.supabase.auth: user authentication for /api/roles/users sync
 *   - config.llm: LLM config for AI role suggestions
 *
 * Side effects:
 *   - Analytics tracking writes to local data directory
 *   - Notifications are persisted to local data directory
 *   - Perspective switch and onboarding completion update project settings via storage
 *   - Role history changes are recorded on each role/perspective change
 *   - Calendar events and iCal imports are stored locally
 *   - Authenticated user is auto-synced to collaborative roles list on /users GET
 *
 * Notes:
 *   - dataDir is resolved from config or storage for local file-based modules
 *   - The /api/roles/users GET endpoint silently adds the authenticated user if missing
 *   - Export supports markdown, html, and json formats; markdown/html are returned as downloads
 *   - All routes are wrapped in a top-level try/catch returning 500 on error
 *
 * Routes (summary -- 25+ endpoints):
 *   GET    /api/roles/templates              - All role templates with categories
 *   GET    /api/roles/templates/:id          - Single template by ID
 *   POST   /api/roles/suggest                - AI role prompt suggestion
 *   POST   /api/roles/generate               - Generate role definition from title
 *   GET    /api/roles/dashboard              - Role-aware project dashboard
 *   POST   /api/roles/analytics/track        - Track a role interaction event
 *   GET    /api/roles/analytics              - Role analytics dashboard
 *   GET    /api/roles/notifications           - Notifications for current role
 *   POST   /api/roles/notifications           - Create a notification
 *   POST   /api/roles/notifications/read      - Mark notifications as read
 *   GET    /api/roles/history                - Role change history and insights
 *   POST   /api/roles/perspective            - Switch to a temporary role perspective
 *   GET    /api/roles/perspective            - Get current effective role
 *   DELETE /api/roles/perspective            - End temporary perspective
 *   GET    /api/roles/filtered-knowledge     - Knowledge filtered by role relevance
 *   GET    /api/roles/users                  - List collaborative users
 *   POST   /api/roles/users                  - Add a collaborative user
 *   PUT    /api/roles/users/:id              - Update a user
 *   DELETE /api/roles/users/:id              - Remove a user
 *   GET    /api/roles/calendar               - Upcoming events and briefing context
 *   POST   /api/roles/calendar               - Add calendar event
 *   POST   /api/roles/calendar/import        - Import iCal data
 *   GET    /api/roles/onboarding             - Onboarding steps and status
 *   POST   /api/roles/onboarding/complete    - Complete onboarding, set role
 *   GET    /api/roles/export                 - Role-scoped report (md/html/json)
 *   GET    /api/roles/export/executive       - Executive summary for current role
 */

const { parseBody, parseUrl } = require('../../server/request');
const { jsonResponse } = require('../../server/response');

function isRolesApiRoute(pathname) {
    return pathname.startsWith('/api/roles/');
}

async function handleRolesApi(ctx) {
    const { req, res, pathname, storage, config, supabase } = ctx;

    if (!isRolesApiRoute(pathname)) return false;

    const dataDir = config?.dataDir || storage?.getProjectDataDir?.();
    const urlParsed = parseUrl(req.url);

    try {
        // GET /api/roles/templates
        if (pathname === '/api/roles/templates' && req.method === 'GET') {
            const { getRoleTemplates } = require('../../roles');
            const templates = getRoleTemplates();
            await templates.loadFromSupabase();
            jsonResponse(res, { ok: true, templates: templates.getAll(), categories: templates.getCategories() });
            return true;
        }

        // GET /api/roles/templates/:id
        const templatesIdMatch = pathname.match(/^\/api\/roles\/templates\/([^/]+)$/);
        if (templatesIdMatch && req.method === 'GET') {
            const { getRoleTemplates } = require('../../roles');
            const templates = getRoleTemplates();
            await templates.loadFromSupabase();
            const template = templates.get(templatesIdMatch[1]);
            if (template) jsonResponse(res, { ok: true, template });
            else jsonResponse(res, { ok: false, error: 'Template not found' }, 404);
            return true;
        }

        // POST /api/roles/suggest
        if (pathname === '/api/roles/suggest' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getAIRoleSuggestions } = require('../../roles');
            const suggestions = getAIRoleSuggestions({ storage, llmConfig: config?.llm, appConfig: config });
            suggestions.setStorage(storage);
            const result = await suggestions.suggestRolePrompt(body.currentRole);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/roles/generate
        if (pathname === '/api/roles/generate' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getAIRoleSuggestions } = require('../../roles');
            const suggestions = getAIRoleSuggestions({ llmConfig: config?.llm, appConfig: config });
            const result = await suggestions.generateFromTitle(body.title);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/roles/dashboard
        if (pathname === '/api/roles/dashboard' && req.method === 'GET') {
            const { getRoleDashboard } = require('../../roles');
            const dashboard = getRoleDashboard({ storage });
            dashboard.setStorage(storage);
            const project = await storage.getCurrentProject();
            const result = dashboard.generateDashboard(project?.userRole, project?.userRolePrompt);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // POST /api/roles/analytics/track
        if (pathname === '/api/roles/analytics/track' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getRoleAnalytics } = require('../../roles');
            const analytics = getRoleAnalytics({ dataDir });
            const project = await storage.getCurrentProject();
            const entry = analytics.trackInteraction({ ...body, userRole: project?.userRole || 'unknown' });
            jsonResponse(res, { ok: true, entry });
            return true;
        }

        // GET /api/roles/analytics
        if (pathname === '/api/roles/analytics' && req.method === 'GET') {
            const { getRoleAnalytics } = require('../../roles');
            const analytics = getRoleAnalytics({ dataDir });
            const project = await storage.getCurrentProject();
            const result = analytics.getDashboard(project?.userRole || 'unknown');
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/roles/notifications
        if (pathname === '/api/roles/notifications' && req.method === 'GET') {
            const { getSmartNotifications } = require('../../roles');
            const notifications = getSmartNotifications({ dataDir });
            const project = await storage.getCurrentProject();
            const unreadOnly = urlParsed.query?.unread === 'true';
            const result = notifications.getNotificationsForRole(project?.userRole, { unreadOnly });
            const stats = notifications.getStats(project?.userRole);
            jsonResponse(res, { ok: true, notifications: result, stats });
            return true;
        }

        // POST /api/roles/notifications
        if (pathname === '/api/roles/notifications' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getSmartNotifications } = require('../../roles');
            const notifications = getSmartNotifications({ dataDir });
            const result = notifications.createNotification(body);
            jsonResponse(res, { ok: true, notification: result });
            return true;
        }

        // POST /api/roles/notifications/read
        if (pathname === '/api/roles/notifications/read' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getSmartNotifications } = require('../../roles');
            const notifications = getSmartNotifications({ dataDir });
            const count = notifications.markAsRead(body.ids || []);
            jsonResponse(res, { ok: true, markedRead: count });
            return true;
        }

        // GET /api/roles/history
        if (pathname === '/api/roles/history' && req.method === 'GET') {
            const { getRoleHistory } = require('../../roles');
            const history = getRoleHistory({ dataDir });
            const changes = history.getChanges();
            const timeline = history.getTimeline();
            const insights = history.getInsights();
            jsonResponse(res, { ok: true, changes, timeline, insights });
            return true;
        }

        // POST /api/roles/perspective
        if (pathname === '/api/roles/perspective' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getQuickRoleSwitch, getRoleHistory } = require('../../roles');
            const history = getRoleHistory({ dataDir });
            const quickSwitch = getQuickRoleSwitch({ storage, history });
            quickSwitch.setStorage(storage);
            const session = quickSwitch.switchPerspective('default_user', body.role, { reason: body.reason });
            jsonResponse(res, { ok: true, session });
            return true;
        }

        // GET /api/roles/perspective
        if (pathname === '/api/roles/perspective' && req.method === 'GET') {
            const { getQuickRoleSwitch, getRoleHistory } = require('../../roles');
            const history = getRoleHistory({ dataDir });
            const quickSwitch = getQuickRoleSwitch({ storage, history });
            quickSwitch.setStorage(storage);
            const effective = quickSwitch.getEffectiveRole('default_user');
            const available = quickSwitch.getAvailablePerspectives(effective.role);
            jsonResponse(res, { ok: true, effective, availablePerspectives: available });
            return true;
        }

        // DELETE /api/roles/perspective
        if (pathname === '/api/roles/perspective' && req.method === 'DELETE') {
            const { getQuickRoleSwitch, getRoleHistory } = require('../../roles');
            const history = getRoleHistory({ dataDir });
            const quickSwitch = getQuickRoleSwitch({ storage, history });
            const result = quickSwitch.endPerspective('default_user');
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/roles/filtered-knowledge
        if (pathname === '/api/roles/filtered-knowledge' && req.method === 'GET') {
            const { getRoleFilters } = require('../../roles');
            const filters = getRoleFilters({ storage });
            filters.setStorage(storage);
            const project = await storage.getCurrentProject();
            const result = filters.getFilteredKnowledge(project?.userRole, project?.userRolePrompt);
            const summary = filters.getRelevanceSummary(project?.userRole, project?.userRolePrompt);
            jsonResponse(res, { ok: true, knowledge: result, summary });
            return true;
        }

        // GET /api/roles/users
        if (pathname === '/api/roles/users' && req.method === 'GET') {
            const { getCollaborativeRoles } = require('../../roles');
            const collaborative = getCollaborativeRoles({ dataDir });

            // Sync authenticated user if present
            if (supabase && req.headers.authorization) {
                try {
                    const token = req.headers.authorization.replace('Bearer ', '');
                    const { user, error } = await supabase.auth.getUser(token);

                    if (user && !error) {
                        const existingUser = collaborative.getUsers().find(u => u.email === user.email);
                        if (!existingUser) {
                            // Add authenticated user if missing
                            const role = user.email === 'system@godmode.local' ? 'superadmin' : 'user';
                            collaborative.addUser({
                                id: user.id,
                                email: user.email,
                                name: user.user_metadata?.username || user.user_metadata?.display_name || user.email.split('@')[0],
                                role: role,
                                rolePrompt: role === 'superadmin' ? 'You are the super admin.' : 'You are a standard user.',
                                status: 'active'
                            });
                        }
                    }
                } catch (e) {
                    // Ignore auth errors, just return public list
                }
            }

            const users = collaborative.getUsers();
            const stats = collaborative.getStats();
            jsonResponse(res, { ok: true, users, stats });
            return true;
        }

        // POST /api/roles/users
        if (pathname === '/api/roles/users' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getCollaborativeRoles } = require('../../roles');
            const collaborative = getCollaborativeRoles({ dataDir });
            const result = collaborative.addUser(body);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // PUT /api/roles/users/:id
        const userUpdateMatch = pathname.match(/^\/api\/roles\/users\/([^/]+)$/);
        if (userUpdateMatch && req.method === 'PUT') {
            const userId = userUpdateMatch[1];
            const body = await parseBody(req);
            const { getCollaborativeRoles } = require('../../roles');
            const collaborative = getCollaborativeRoles({ dataDir });
            const result = collaborative.updateUser(userId, body);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // DELETE /api/roles/users/:id
        const userDeleteMatch = pathname.match(/^\/api\/roles\/users\/([^/]+)$/);
        if (userDeleteMatch && req.method === 'DELETE') {
            const userId = userDeleteMatch[1];
            const { getCollaborativeRoles } = require('../../roles');
            const collaborative = getCollaborativeRoles({ dataDir });
            const result = collaborative.removeUser(userId);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // GET /api/roles/calendar
        if (pathname === '/api/roles/calendar' && req.method === 'GET') {
            const { getCalendarIntegration } = require('../../roles');
            const calendar = getCalendarIntegration({ dataDir });
            const days = parseInt(urlParsed.query?.days) || 7;
            const events = calendar.getUpcomingEvents(days);
            const today = calendar.getTodayEvents();
            const stats = calendar.getStats();
            const project = await storage.getCurrentProject();
            const context = calendar.getContextForBriefing(project?.userRole, project?.userRolePrompt);
            jsonResponse(res, { ok: true, events, today, stats, briefingContext: context });
            return true;
        }

        // POST /api/roles/calendar
        if (pathname === '/api/roles/calendar' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getCalendarIntegration } = require('../../roles');
            const calendar = getCalendarIntegration({ dataDir });
            const result = calendar.addEvent(body);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // POST /api/roles/calendar/import
        if (pathname === '/api/roles/calendar/import' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getCalendarIntegration } = require('../../roles');
            const calendar = getCalendarIntegration({ dataDir });
            const result = calendar.importFromICal(body.icalData);
            jsonResponse(res, { ok: result.success, ...result });
            return true;
        }

        // GET /api/roles/onboarding
        if (pathname === '/api/roles/onboarding' && req.method === 'GET') {
            const { getRoleOnboarding } = require('../../roles');
            const onboarding = getRoleOnboarding();
            const project = await storage.getCurrentProject();
            const steps = onboarding.getSteps();
            const quickSetup = onboarding.getQuickSetupOptions();
            const tips = onboarding.getRoleTips();
            const isNeeded = onboarding.isOnboardingNeeded(project);
            jsonResponse(res, { ok: true, steps, quickSetup, tips, isNeeded });
            return true;
        }

        // POST /api/roles/onboarding/complete
        if (pathname === '/api/roles/onboarding/complete' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getRoleOnboarding, getRoleHistory } = require('../../roles');
            const onboarding = getRoleOnboarding();
            const history = getRoleHistory({ dataDir });
            const result = onboarding.processOnboarding(body);
            const project = await storage.getCurrentProject();
            if (project) {
                const oldRole = project.userRole;
                await storage.updateProject(project.id, {
                    userRole: result.userRole,
                    userRolePrompt: result.userRolePrompt
                });
                history.recordChange({
                    previousRole: oldRole,
                    newRole: result.userRole,
                    newRolePrompt: result.userRolePrompt,
                    reason: 'Onboarding completed',
                    projectId: project.id
                });
            }
            jsonResponse(res, { ok: true, ...result });
            return true;
        }

        // GET /api/roles/export
        if (pathname === '/api/roles/export' && req.method === 'GET') {
            const { getRoleExport, getRoleFilters, getRoleDashboard } = require('../../roles');
            const filters = getRoleFilters({ storage });
            const dashboard = getRoleDashboard({ storage });
            const roleExport = getRoleExport({ storage, filters, dashboard });
            filters.setStorage(storage);
            dashboard.setStorage(storage);
            roleExport.setStorage(storage);
            const project = await storage.getCurrentProject();
            const format = urlParsed.query?.format || 'markdown';
            const result = roleExport.generateReport(
                project?.userRole,
                project?.userRolePrompt,
                { format, includeAll: urlParsed.query?.includeAll === 'true' }
            );
            if (format === 'json') {
                jsonResponse(res, { ok: true, ...result });
            } else {
                res.writeHead(200, {
                    'Content-Type': format === 'html' ? 'text/html' : 'text/plain',
                    'Content-Disposition': `attachment; filename="role-report.${format === 'markdown' ? 'md' : format}"`
                });
                res.end(result.content);
            }
            return true;
        }

        // GET /api/roles/export/executive
        if (pathname === '/api/roles/export/executive' && req.method === 'GET') {
            const { getRoleExport, getRoleFilters, getRoleDashboard } = require('../../roles');
            const filters = getRoleFilters({ storage });
            const dashboard = getRoleDashboard({ storage });
            const roleExport = getRoleExport({ storage, filters, dashboard });
            filters.setStorage(storage);
            dashboard.setStorage(storage);
            roleExport.setStorage(storage);
            const project = await storage.getCurrentProject();
            const result = roleExport.generateExecutiveSummary(project?.userRole, project?.userRolePrompt);
            jsonResponse(res, { ok: true, ...result });
            return true;
        }
    } catch (error) {
        jsonResponse(res, { ok: false, error: error.message }, 500);
        return true;
    }

    return false;
}

module.exports = { handleRolesApi };
