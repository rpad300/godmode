/**
 * Role Management System
 * Comprehensive role-based features for personalized project management
 */

const { RoleTemplates, getRoleTemplates } = require('./RoleTemplates');
const { AIRoleSuggestions, getAIRoleSuggestions } = require('./AIRoleSuggestions');
const { RoleAnalytics, getRoleAnalytics } = require('./RoleAnalytics');
const { SmartNotifications, getSmartNotifications } = require('./SmartNotifications');
const { RoleHistory, getRoleHistory } = require('./RoleHistory');
const { RoleDashboard, getRoleDashboard } = require('./RoleDashboard');
const { QuickRoleSwitch, getQuickRoleSwitch } = require('./QuickRoleSwitch');
const { RoleFilters, getRoleFilters } = require('./RoleFilters');
const { CollaborativeRoles, getCollaborativeRoles } = require('./CollaborativeRoles');
const { CalendarIntegration, getCalendarIntegration } = require('./CalendarIntegration');
const { RoleOnboarding, getRoleOnboarding } = require('./RoleOnboarding');
const { RoleExport, getRoleExport } = require('./RoleExport');

/**
 * Initialize all role modules with shared dependencies
 */
function initRoleModules(options = {}) {
    const { storage, dataDir, llmConfig } = options;
    
    // Initialize all singletons
    const templates = getRoleTemplates();
    const suggestions = getAIRoleSuggestions({ storage, llmConfig });
    const analytics = getRoleAnalytics({ dataDir });
    const notifications = getSmartNotifications({ dataDir });
    const history = getRoleHistory({ dataDir });
    const dashboard = getRoleDashboard({ storage });
    const quickSwitch = getQuickRoleSwitch({ storage, history });
    const filters = getRoleFilters({ storage, templates });
    const collaborative = getCollaborativeRoles({ dataDir });
    const calendar = getCalendarIntegration({ dataDir });
    const onboarding = getRoleOnboarding({ templates });
    const roleExport = getRoleExport({ storage, filters, dashboard });
    
    // Set storage on modules that need it
    if (storage) {
        suggestions.setStorage(storage);
        dashboard.setStorage(storage);
        quickSwitch.setStorage(storage);
        filters.setStorage(storage);
        roleExport.setStorage(storage);
    }
    
    // Set data directory on modules that need it
    if (dataDir) {
        analytics.setDataDir(dataDir);
        notifications.setDataDir(dataDir);
        history.setDataDir(dataDir);
        collaborative.setDataDir(dataDir);
        calendar.setDataDir(dataDir);
    }
    
    return {
        templates,
        suggestions,
        analytics,
        notifications,
        history,
        dashboard,
        quickSwitch,
        filters,
        collaborative,
        calendar,
        onboarding,
        roleExport
    };
}

/**
 * Role Manager - Unified interface for all role features
 */
class RoleManager {
    constructor(options = {}) {
        this.modules = initRoleModules(options);
    }
    
    // Templates
    getTemplates() { return this.modules.templates.getAll(); }
    getTemplate(id) { return this.modules.templates.get(id); }
    searchTemplates(query) { return this.modules.templates.search(query); }
    
    // AI Suggestions
    async suggestRole(currentRole) { return this.modules.suggestions.suggestRolePrompt(currentRole); }
    async generateFromTitle(title) { return this.modules.suggestions.generateFromTitle(title); }
    
    // Analytics
    trackInteraction(data) { return this.modules.analytics.trackInteraction(data); }
    getAnalytics(role) { return this.modules.analytics.getRoleAnalytics(role); }
    getAnalyticsDashboard(role) { return this.modules.analytics.getDashboard(role); }
    
    // Notifications
    createNotification(data) { return this.modules.notifications.createNotification(data); }
    getNotifications(role, options) { return this.modules.notifications.getNotificationsForRole(role, options); }
    markRead(ids) { return this.modules.notifications.markAsRead(ids); }
    getNotificationStats(role) { return this.modules.notifications.getStats(role); }
    
    // History
    recordRoleChange(data) { return this.modules.history.recordChange(data); }
    getRoleHistory(options) { return this.modules.history.getChanges(options); }
    getRoleTimeline(projectId) { return this.modules.history.getTimeline(projectId); }
    getHistoryInsights() { return this.modules.history.getInsights(); }
    
    // Dashboard
    getDashboard(role, rolePrompt) { return this.modules.dashboard.generateDashboard(role, rolePrompt); }
    getWidgetConfig(role) { return this.modules.dashboard.getWidgetConfig(role); }
    
    // Quick Switch
    switchPerspective(userId, role, options) { return this.modules.quickSwitch.switchPerspective(userId, role, options); }
    getCurrentPerspective(userId) { return this.modules.quickSwitch.getCurrentPerspective(userId); }
    getEffectiveRole(userId) { return this.modules.quickSwitch.getEffectiveRole(userId); }
    endPerspective(userId) { return this.modules.quickSwitch.endPerspective(userId); }
    getAvailablePerspectives(role) { return this.modules.quickSwitch.getAvailablePerspectives(role); }
    
    // Filters
    filterKnowledge(role, rolePrompt, options) { return this.modules.filters.getFilteredKnowledge(role, rolePrompt, options); }
    getRelevanceSummary(role, rolePrompt) { return this.modules.filters.getRelevanceSummary(role, rolePrompt); }
    
    // Collaborative
    addUser(user) { return this.modules.collaborative.addUser(user); }
    updateUser(userId, updates) { return this.modules.collaborative.updateUser(userId, updates); }
    removeUser(userId) { return this.modules.collaborative.removeUser(userId); }
    getUsers(options) { return this.modules.collaborative.getUsers(options); }
    getCollaborationStats() { return this.modules.collaborative.getStats(); }
    createInvitation(data) { return this.modules.collaborative.createInvitation(data); }
    
    // Calendar
    addEvent(event) { return this.modules.calendar.addEvent(event); }
    getEvents(options) { return this.modules.calendar.getEvents(options); }
    getTodayEvents() { return this.modules.calendar.getTodayEvents(); }
    getCalendarContext(role, rolePrompt) { return this.modules.calendar.getContextForBriefing(role, rolePrompt); }
    importICal(data) { return this.modules.calendar.importFromICal(data); }
    exportICal(options) { return this.modules.calendar.exportToICal(options); }
    
    // Onboarding
    getOnboardingSteps() { return this.modules.onboarding.getSteps(); }
    processOnboarding(data) { return this.modules.onboarding.processOnboarding(data); }
    getQuickSetup() { return this.modules.onboarding.getQuickSetupOptions(); }
    isOnboardingNeeded(project) { return this.modules.onboarding.isOnboardingNeeded(project); }
    
    // Export
    generateReport(role, rolePrompt, options) { return this.modules.roleExport.generateReport(role, rolePrompt, options); }
    generateExecutiveSummary(role, rolePrompt) { return this.modules.roleExport.generateExecutiveSummary(role, rolePrompt); }
    getExportFormats() { return this.modules.roleExport.getAvailableFormats(); }
    getReportTypes() { return this.modules.roleExport.getReportTypes(); }
}

// Singleton manager
let managerInstance = null;
function getRoleManager(options) {
    if (!managerInstance) {
        managerInstance = new RoleManager(options);
    }
    return managerInstance;
}

module.exports = {
    // Individual modules
    RoleTemplates, getRoleTemplates,
    AIRoleSuggestions, getAIRoleSuggestions,
    RoleAnalytics, getRoleAnalytics,
    SmartNotifications, getSmartNotifications,
    RoleHistory, getRoleHistory,
    RoleDashboard, getRoleDashboard,
    QuickRoleSwitch, getQuickRoleSwitch,
    RoleFilters, getRoleFilters,
    CollaborativeRoles, getCollaborativeRoles,
    CalendarIntegration, getCalendarIntegration,
    RoleOnboarding, getRoleOnboarding,
    RoleExport, getRoleExport,
    
    // Unified manager
    RoleManager, getRoleManager,
    
    // Initialization helper
    initRoleModules
};
