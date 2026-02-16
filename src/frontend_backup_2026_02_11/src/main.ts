/**
 * GodMode Frontend - Main Entry Point
 * 
 * This file initializes the application and loads all necessary modules.
 * Currently in transition phase - gradually migrating from monolithic
 * index.html to modular TypeScript structure.
 */

// Import styles
import './styles/main.css';
import './styles/graph.css';

// Import services
import {
  theme, toast, shortcuts, undoManager, storage, http, api, configureApi, auth, projects,
  addRequestInterceptor, setProjectIdGetter,
  dashboardService, questionsService, risksService, actionsService, decisionsService,
  chatService, contactsService, teamsService, documentsService, knowledgeService,
  emailsService, graphService, timelineService, costsService, notificationsService,
  commentsService, membersService, profileService, userSettingsService, projectSettingsService,
  apiKeysService, webhooksService, auditService, factsService
} from './services';

// Import components
import { initGlobalSearch, initNotificationsDropdown, initCommandPalette } from './components';

import * as components from './components';
import { createQuestionDetailView } from './components/questions/QuestionDetailView';
import { createQuestionsPanel, createFactsPanel, createDecisionsPanel, createRisksPanel, createActionsPanel } from './components/sot';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize Global Error Boundary ASAP
ErrorBoundary.init();

// Import stores
import { appStore, uiStore, dataStore, chartsStore, teamAnalysisStore } from './stores';
import type { Question } from './stores/data';

// Import legacy bridge for backwards compatibility
import { initLegacyBridge } from './lib/legacy-bridge';

// SOTA View Transitions
import { startViewTransition } from './lib/transitions';

// Make services and stores available globally for gradual migration
declare global {
  interface Window {
    godmode: {
      // Core Services
      theme: typeof theme;
      toast: typeof toast;
      shortcuts: typeof shortcuts;
      undo: typeof undoManager;
      storage: typeof storage;
      http: typeof http;
      api: typeof api;
      configureApi: typeof configureApi;
      auth: typeof auth;
      projects: typeof projects;
      // Domain Services
      dashboard: typeof dashboardService;
      questions: typeof questionsService;
      risks: typeof risksService;
      actions: typeof actionsService;
      decisions: typeof decisionsService;
      chat: typeof chatService;
      contacts: typeof contactsService;
      teams: typeof teamsService;
      documents: typeof documentsService;
      knowledge: typeof knowledgeService;
      emails: typeof emailsService;
      graph: typeof graphService;
      timeline: typeof timelineService;
      costs: typeof costsService;
      notifications: typeof notificationsService;
      comments: typeof commentsService;
      members: typeof membersService;
      profile: typeof profileService;
      userSettings: typeof userSettingsService;
      projectSettings: typeof projectSettingsService;
      apiKeys: typeof apiKeysService;
      webhooks: typeof webhooksService;
      audit: typeof auditService;
      facts: typeof factsService;
      // Stores
      appStore: typeof appStore;
      uiStore: typeof uiStore;
      dataStore: typeof dataStore;
      chartsStore: typeof chartsStore;
      // Version
      version: string;
    };
  }
}

window.godmode = {
  // Core Services
  theme,
  toast,
  shortcuts,
  undo: undoManager,
  storage,
  http,
  api,
  configureApi,
  auth,
  projects,
  // Domain Services
  dashboard: dashboardService,
  questions: questionsService,
  risks: risksService,
  actions: actionsService,
  decisions: decisionsService,
  chat: chatService,
  contacts: contactsService,
  teams: teamsService,
  documents: documentsService,
  knowledge: knowledgeService,
  emails: emailsService,
  graph: graphService,
  timeline: timelineService,
  costs: costsService,
  notifications: notificationsService,
  comments: commentsService,
  members: membersService,
  profile: profileService,
  userSettings: userSettingsService,
  projectSettings: projectSettingsService,
  apiKeys: apiKeysService,
  webhooks: webhooksService,
  audit: auditService,
  facts: factsService,
  // Stores
  appStore,
  uiStore,
  dataStore,
  chartsStore,
  // Version
  version: '2.0.0',
};

// Ensure API requests include current project ID for project-scoped endpoints
setProjectIdGetter(() => appStore.getState().currentProjectId);
addRequestInterceptor((opts) => {
  const projectId = appStore.getState().currentProjectId;
  if (projectId && opts.headers) {
    (opts.headers as Record<string, string>)['X-Project-Id'] = projectId;
  }
  return opts;
});

/**
 * Register default keyboard shortcuts
 */
function registerShortcuts(): void {
  // Undo: Ctrl+Z
  shortcuts.register({
    key: 'z',
    ctrl: true,
    description: 'Undo last action',
    handler: async () => {
      if (undoManager.canUndo()) {
        await undoManager.undo();
        toast.info('Undo: ' + (undoManager.getRedoDescription() || 'Action undone'));
      }
    },
  });

  // Redo: Ctrl+Shift+Z or Ctrl+Y
  shortcuts.register({
    key: 'z',
    ctrl: true,
    shift: true,
    description: 'Redo last action',
    handler: async () => {
      if (undoManager.canRedo()) {
        await undoManager.redo();
        toast.info('Redo: ' + (undoManager.getUndoDescription() || 'Action redone'));
      }
    },
  });

  // Theme toggle: Ctrl+Shift+T
  shortcuts.register({
    key: 't',
    ctrl: true,
    shift: true,
    description: 'Cycle theme (light/dark/system)',
    handler: () => {
      const newMode = theme.cycle();
      toast.info(`Theme: ${theme.getLabel()}`);
    },
  });

  // Help: ?
  shortcuts.register({
    key: '?',
    description: 'Show keyboard shortcuts',
    handler: () => {
      shortcuts.showHelp();
    },
  });
}

/**
 * Configure API client
 */
function configureApiClient(): void {
  // Setup 401 handler for auth redirect
  configureApi({
    onUnauthorized: () => {
      appStore.setCurrentUser(null);
      toast.error('Session expired. Please log in again.');
      // Trigger auth modal via event
      window.dispatchEvent(new CustomEvent('godmode:auth-required'));
    },
    onForbidden: () => {
      toast.error('You do not have permission to perform this action.');
    },
  });
}

/**
 * Initialize UI event handlers
 */
function initializeUI(): void {
  // Theme toggle button
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      theme.cycle();
      updateThemeButton();
      toast.info(`Theme: ${theme.getLabel()}`);
    });

    updateThemeButton();
  }

  // Initialize Command Palette (SOTA Feature)
  initCommandPalette();

  // User menu dropdown
  const userAvatar = document.getElementById('user-avatar');
  const userDropdown = document.getElementById('user-dropdown');
  if (userAvatar && userDropdown) {
    userAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
    });
  }

  // Login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      components.showAuthModal({
        onSuccess: () => {
          updateAuthUI();
          refreshData();
        }
      });
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await auth.logout();

      // Clear all project-scoped data and project list
      clearProjectScopedState();
      dataStore.setProjects([]);
      appStore.setCurrentProject(null);
      appStore.setCurrentProjectId(null);

      // Update UI
      updateAuthUI();
      updateDashboard();

      // Redirect to landing page if auth is configured
      if (appStore.getState().authConfigured) {
        toast.info('Signed out successfully');
        window.location.href = '/';
      } else {
        toast.info('Signed out');
      }
    });
  }

  // Settings button — open Settings tab (content area), never modal
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      switchTab('settings');
    });
  }

  // Shortcuts button
  const shortcutsBtn = document.getElementById('shortcuts-btn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      components.showShortcutsModal();
    });
  }

  // Dev tools button
  const devToolsBtn = document.getElementById('dev-tools-btn');
  if (devToolsBtn) {
    devToolsBtn.addEventListener('click', () => {
      components.showDeveloperModal();
    });
  }

  // Profile button — open Profile tab (direct view, no modal)
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      userDropdown?.classList.add('hidden');
      switchTab('profile');
    });
  }

  // Initialize notifications dropdown in header
  const notificationsContainer = document.getElementById('notifications-container');
  if (notificationsContainer) {
    initNotificationsDropdown(notificationsContainer, {
      onNotificationClick: (notification) => {
        console.log('Notification clicked:', notification);
        // Navigate based on notification type
        if (notification.entity_type && notification.entity_id) {
          window.dispatchEvent(new CustomEvent('godmode:navigate', {
            detail: { type: notification.entity_type, id: notification.entity_id }
          }));
        }
      }
    });
  }

  // Sidebar navigation
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (tab) {
        switchTab(tab);
      }
    });
  });

  // SOT tabs
  const sotTabs = document.querySelectorAll('.sot-tab');
  sotTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      if (view) {
        sotTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        uiStore.setSotView(view as 'questions' | 'facts' | 'risks' | 'actions' | 'decisions');
        loadSotContent(view);
      }
    });
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('app-sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Chat panel is mounted in initializePanels

  // New contact button
  const newContactBtn = document.getElementById('new-contact-btn');
  if (newContactBtn) {
    newContactBtn.addEventListener('click', () => {
      components.showContactModal({ mode: 'create' });
    });
  }

  // Upload buttons
  const uploadBtns = document.querySelectorAll('#new-upload-btn, #upload-files-btn');
  uploadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      components.showFileUploadModal();
    });
  });

  // Initialize sidebar action buttons
  initializeSidebarActions();

  // Project selector
  const projectSelector = document.getElementById('project-selector') as HTMLSelectElement;
  const newProjectBtn = document.getElementById('new-project-btn');
  const editProjectBtn = document.getElementById('edit-project-btn');

  if (projectSelector) {
    projectSelector.addEventListener('change', async () => {
      const projectId = projectSelector.value;
      console.log('🔄 Project selector changed, value:', projectId);

      if (projectId) {
        await selectProject(projectId);
        if (editProjectBtn) editProjectBtn.classList.remove('hidden');
      } else {
        console.log('📭 Clearing project - starting...');

        // No project selected - clear everything IMMEDIATELY
        if (editProjectBtn) editProjectBtn.classList.add('hidden');

        // Clear current project in store
        appStore.setCurrentProject(null);
        appStore.setCurrentProjectId(null);
        console.log('📭 Store cleared');

        // Clear all project-scoped data (no reference to previous project)
        clearProjectScopedState();
        console.log('📭 Data store cleared');

        // IMMEDIATELY show empty state (no async import needed)
        console.log('📭 Calling showNoProjectState...');
        showNoProjectState();
        console.log('📭 showNoProjectState called');

        // Switch to Dashboard tab so user sees the empty state
        switchTab('dashboard');

        loadSotContent(uiStore.getState().sotCurrentView);

        // Also deactivate on server side (fire and forget)
        http.post('/api/projects/deactivate').catch(() => { });

        console.log('📭 Project deselected - ALL DONE');
      }
    });
    loadProjects();
  }

  // New project button — open Projects tab and show create form inline
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
      (window as unknown as { __godmodeProjectsOpen?: string })['__godmodeProjectsOpen'] = 'create';
      switchTab('projects');
    });
  }

  // Edit project button — open Projects tab and show edit form inline
  if (editProjectBtn) {
    editProjectBtn.addEventListener('click', () => {
      const currentProject = appStore.getState().currentProject;
      if (currentProject) {
        (window as unknown as { __godmodeProjectsOpen?: string })['__godmodeProjectsOpen'] = 'edit:' + currentProject.id;
        switchTab('projects');
      }
    });
  }

  // Contacts subtabs
  const contactsSubtabs = document.querySelectorAll('#contacts-subtabs .subtab');
  contactsSubtabs.forEach(tab => {
    tab.addEventListener('click', () => {
      contactsSubtabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const subtab = tab.getAttribute('data-subtab');
      document.querySelectorAll('[id^="contacts-subtab-"]').forEach(content => {
        content.classList.toggle('hidden', content.id !== `contacts-subtab-${subtab}`);
      });
    });
  });

  // Refresh dashboard button
  const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');
  if (refreshDashboardBtn) {
    refreshDashboardBtn.addEventListener('click', () => {
      initializePanels();
      toast.info('Dashboard refreshed');
    });
  }

  // Mount panels on tab switch
  initializePanels();

  // Initialize drop zones
  initializeDropZones();
}

/**
 * Show "No Project Selected" state immediately (sync, no imports)
 */
function showNoProjectState(): void {
  console.log('📭 showNoProjectState() called');
  const dashboardContainer = document.getElementById('dashboard-container');
  console.log('📭 dashboardContainer:', dashboardContainer ? 'FOUND' : 'NOT FOUND');
  if (!dashboardContainer) return;

  console.log('📭 Setting innerHTML NOW...');

  dashboardContainer.innerHTML = `
    <div class="dashboard gm-p-5">
      <div class="no-project-state gm-empty-state">
        <svg class="gm-empty-state-icon" width="96" height="96" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <h2 class="gm-empty-state-title">No Project Selected</h2>
        <p class="gm-empty-state-desc">
          Select a project from the dropdown above, or create a new one to get started with your data management.
        </p>
        <button id="create-project-empty-cta" class="btn btn-primary gm-empty-state-cta">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create New Project
        </button>
      </div>
    </div>
  `;

  console.log('📭 innerHTML SET! Container visible:', dashboardContainer.offsetParent !== null);
  console.log('📭 Container display:', window.getComputedStyle(dashboardContainer).display);

  // Bind create project button — open Projects tab with create form inline
  const createBtn = document.getElementById('create-project-empty-cta');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      (window as unknown as { __godmodeProjectsOpen?: string })['__godmodeProjectsOpen'] = 'create';
      switchTab('projects');
    });
  }
}

/**
 * Refresh/recreate the dashboard
 */
async function refreshDashboardPanel(): Promise<void> {
  const dashboardContainer = document.getElementById('dashboard-container');
  if (!dashboardContainer) return;

  // Check if project is selected - if not, show empty state immediately
  const currentProject = appStore.getState().currentProject;
  const currentProjectId = appStore.getState().currentProjectId;

  if (!currentProject && !currentProjectId) {
    showNoProjectState();
    return;
  }

  // Clear and recreate with loading state
  dashboardContainer.innerHTML = '<div class="gm-loading-placeholder">Loading dashboard...</div>';

  try {
    const { createDashboard } = await import('./pages/Dashboard');
    dashboardContainer.innerHTML = '';
    const dashboard = createDashboard({
      onStatClick: (statId) => {
        console.log('Stat clicked:', statId);
        // Navigate to appropriate view
        if (statId === 'questions') switchTab('sot');
        else if (statId === 'facts') {
          switchTab('sot');
          uiStore.setSotView('facts');
          document.querySelectorAll('.sot-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-view') === 'facts');
          });
          loadSotContent('facts');
        }
        else if (statId === 'risks') { switchTab('sot'); uiStore.setSotView('risks'); document.querySelectorAll('.sot-tab').forEach(t => { t.classList.toggle('active', t.getAttribute('data-view') === 'risks'); }); loadSotContent('risks'); }
        else if (statId === 'actions') { switchTab('sot'); uiStore.setSotView('actions'); document.querySelectorAll('.sot-tab').forEach(t => { t.classList.toggle('active', t.getAttribute('data-view') === 'actions'); }); loadSotContent('actions'); }
        else if (statId === 'decisions') { switchTab('sot'); uiStore.setSotView('decisions'); document.querySelectorAll('.sot-tab').forEach(t => { t.classList.toggle('active', t.getAttribute('data-view') === 'decisions'); }); loadSotContent('decisions'); }
        else if (statId === 'contacts') switchTab('contacts');
      }
    });
    dashboardContainer.appendChild(dashboard);
  } catch (err) {
    console.error('Failed to load Dashboard:', err);
    dashboardContainer.innerHTML = '<div class="gm-error-placeholder">Failed to load dashboard</div>';
  }
}

/**
 * Initialize and mount panels
 */
function initializePanels(): void {
  // Dashboard - Main dashboard with all widgets
  refreshDashboardPanel();

  // Chat panel (sessions, contact pills, RAG)
  const chatContainer = document.getElementById('chat-panel-container');
  if (chatContainer && chatContainer.children.length === 0) {
    import('./pages/ChatPage').then(({ createChat }) => {
      const panel = createChat({ showSources: true, showSessions: true });
      chatContainer.appendChild(panel);
    }).catch((err) => {
      console.error('[Chat] Failed to load Chat:', err);
      chatContainer.innerHTML = '<div class="gm-loading-placeholder gm-text-secondary">Failed to load chat</div>';
    });
  }

  // EmailsPanel
  const emailsContainer = document.getElementById('emails-panel-container');
  if (emailsContainer && emailsContainer.children.length === 0) {
    import('./pages/EmailsPage').then(({ createEmailsPanel }) => {
      const panel = createEmailsPanel();
      emailsContainer.appendChild(panel);
    });
  }

  // ContactsPanel
  const contactsContainer = document.getElementById('contacts-panel-container');
  if (contactsContainer && contactsContainer.querySelectorAll('.contacts-panel-sota').length === 0) {
    import('./pages/ContactsPage').then(({ createContactsPanel }) => {
      contactsContainer.innerHTML = ''; // Clear comments and whitespace
      const panel = createContactsPanel();
      contactsContainer.appendChild(panel);
    });
  }

  // TeamsPanel
  const teamsContainer = document.getElementById('teams-panel-container');
  if (teamsContainer && teamsContainer.children.length === 0) {
    import('./pages/TeamsPage').then(({ createTeamsPanel }) => {
      const panel = createTeamsPanel();
      teamsContainer.appendChild(panel);
    });
  }

  // RolesPanel
  const rolesContainer = document.getElementById('roles-panel-container');
  if (rolesContainer && rolesContainer.children.length === 0) {
    import('./pages/RolesPage').then(({ renderRolesPanel }) => {
      renderRolesPanel(rolesContainer);
    });
  }

  // FilesPanel (DocumentsPanel)
  const filesContainer = document.getElementById('files-panel-container');
  if (filesContainer && filesContainer.querySelectorAll('.documents-panel-minimal').length === 0) {
    filesContainer.innerHTML = ''; // Clear comments and whitespace
    import('./pages/DocumentsPage').then(({ default: createDocumentsPanel }) => {
      const panel = createDocumentsPanel({
        onDocumentClick: async (doc) => {
          // Open document preview modal
          const { showDocumentPreviewModal } = await import('./components/modals/DocumentPreviewModal');
          showDocumentPreviewModal({ document: doc });
        }
      });
      filesContainer.appendChild(panel);
    }).catch(err => {
      console.error('[FilesPanel] Failed to load DocumentsPanel:', err);
      filesContainer.innerHTML = '<div class="gm-loading-placeholder gm-text-secondary">Failed to load files panel</div>';
    });
  }

  // OrgChart
  const orgChartContainer = document.getElementById('org-chart-container');
  if (orgChartContainer && orgChartContainer.children.length === 0) {
    import('./pages/OrgChartPage').then(({ createOrgChart }) => {
      const panel = createOrgChart();
      orgChartContainer.appendChild(panel);
    });
  }

  // CostsDashboard (mount if no element children; container may have comment nodes)
  const costsContainer = document.getElementById('costs-container');
  if (costsContainer && costsContainer.children.length === 0) {
    import('./pages/CostsPage').then(({ createCostsDashboard }) => {
      const panel = createCostsDashboard();
      costsContainer.appendChild(panel);
    });
  }

  // HistoryPanel
  const historyContainer = document.getElementById('history-container');
  if (historyContainer && historyContainer.children.length === 0) {
    import('./pages/HistoryPage').then(({ createHistoryPanel, exportHistory }) => {
      const panel = createHistoryPanel({
        onRestore: (entry) => {
          toast.info(`Restoring ${entry.entityType} "${entry.entityName || entry.entityId}"`);
          // Trigger restore via API
        }
      });
      historyContainer.appendChild(panel);

      // Bind export button
      const exportBtn = document.getElementById('export-history-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => exportHistory('json'));
      }
    });
  }
}


/**
 * Initialize sidebar drop zones
 */
function initializeDropZones(): void {
  const dropzones = document.querySelectorAll('.dropzone-card[data-type]');
  console.log('[DropZones] Found', dropzones.length, 'dropzones');

  dropzones.forEach(zone => {
    const type = zone.getAttribute('data-type');
    console.log('[DropZones] Adding click handler for:', type);

    // Click handler - open appropriate modal or file picker
    zone.addEventListener('click', async (e) => {
      console.log('[DropZones] Click on:', type);
      e.preventDefault();
      e.stopPropagation();

      try {
        switch (type) {
          case 'emails':
            // Open EmailComposer modal
            console.log('[DropZones] Opening EmailComposer...');
            const { showEmailComposer } = await import('./components/EmailComposer');
            showEmailComposer({
              onSave: () => {
                toast.success('Email imported');
              }
            });
            return;

          case 'conversations':
            // Open ConversationComposer modal
            console.log('[DropZones] Opening ConversationComposer...');
            const { showConversationComposer } = await import('./components/ConversationComposer');
            showConversationComposer({
              onImport: () => {
                toast.success('Conversation imported');
              }
            });
            return;

          case 'transcripts':
            // Open TranscriptComposer modal
            console.log('[DropZones] Opening TranscriptComposer...');
            const { showTranscriptComposer } = await import('./components/TranscriptComposer');
            showTranscriptComposer({
              onImport: () => {
                toast.success('Transcript imported');
              }
            });
            return;

          case 'documents':
          default:
            // Open file picker for documents
            console.log('[DropZones] Opening file picker for documents...');
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.pdf,.doc,.docx,.txt,.md,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.json';

            input.onchange = () => {
              if (input.files && input.files.length > 0) {
                handleDroppedFiles(Array.from(input.files), 'documents');
              }
            };

            input.click();
            return;
        }
      } catch (err) {
        console.error('[DropZones] Error:', err);
        toast.error('Failed to open import dialog');
      }
    });

    // Drag and drop handlers
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      const dataTransfer = (e as DragEvent).dataTransfer;
      if (dataTransfer?.files && dataTransfer.files.length > 0) {
        handleDroppedFiles(Array.from(dataTransfer.files), type || 'documents');
      }
    });
  });
}

/**
 * Handle dropped or selected files
 */
async function handleDroppedFiles(files: File[], type: string): Promise<void> {
  // Add files to pending list
  addPendingFiles(files);

  const fileNames = files.map(f => f.name).join(', ');
  toast.info(`Added ${files.length} ${type} to queue: ${fileNames.substring(0, 50)}${fileNames.length > 50 ? '...' : ''}`);
}

/**
 * Update theme button icon
 */
function updateThemeButton(): void {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.textContent = theme.getIcon();
    themeToggle.title = `Theme: ${theme.getLabel()}`;
  }
}

// ==================== CLIENT-SIDE ROUTING ====================

/** Valid tab names for routing */
const VALID_TABS = ['dashboard', 'chat', 'sot', 'timeline', 'contacts', 'team-analysis', 'files', 'graph', 'emails', 'costs', 'history', 'roles', 'profile', 'settings', 'admin', 'org', 'projects'];

/**
 * Get current tab from URL pathname
 */
function getTabFromUrl(): string {
  const pathname = window.location.pathname;
  // Match /app/tabname or /app/tabname/
  const match = pathname.match(/^\/app\/([^/]+)/);
  if (match && VALID_TABS.includes(match[1])) {
    return match[1];
  }
  // Default to dashboard for /app or /app/
  return 'dashboard';
}

/**
 * Update browser URL for current tab (without page reload)
 */
function updateUrlForTab(tabName: string, replace = false): void {
  const newPath = tabName === 'dashboard' ? '/app' : `/app/${tabName}`;
  const currentPath = window.location.pathname;

  // Only update if path is different
  if (currentPath !== newPath) {
    if (replace) {
      window.history.replaceState({ tab: tabName }, '', newPath);
    } else {
      window.history.pushState({ tab: tabName }, '', newPath);
    }
  }
}

/**
 * Initialize URL-based routing
 */
function initRouting(): void {
  // Handle browser back/forward buttons
  window.addEventListener('popstate', (event) => {
    const tab = event.state?.tab || getTabFromUrl();
    switchTab(tab, false); // false = don't update URL again
  });

  // On initial load, read tab from URL
  const initialTab = getTabFromUrl();
  if (initialTab !== 'dashboard') {
    // If URL has a specific tab, switch to it (will happen after UI init)
    setTimeout(() => switchTab(initialTab, true), 0); // true = replace URL state
  }
}

/**
 * Switch to a tab
 * @param tabName - The tab to switch to
 * @param updateUrl - Whether to update the browser URL (default: true)
 */
function switchTab(tabName: string, updateUrl = true): void {
  // Use SOTA View Transitions API
  startViewTransition(() => {
    // Update sidebar nav items
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.toggle('active', tab.id === `tab-${tabName}`);
      tab.classList.toggle('hidden', tab.id !== `tab-${tabName}`);
    });

    // Close mobile sidebar
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
    }

    // Update browser URL (client-side routing)
    if (updateUrl) {
      updateUrlForTab(tabName);
    }

    // Update store
    uiStore.setTab(tabName as 'dashboard' | 'chat' | 'sot' | 'timeline' | 'contacts' | 'team-analysis' | 'files' | 'graph' | 'emails' | 'costs' | 'history' | 'roles' | 'profile' | 'settings' | 'admin' | 'org' | 'projects');

    // Load profile page when switching to profile tab (direct view, no modal)
    if (tabName === 'profile') {
      const profileContainer = document.getElementById('profile-page-container');
      if (profileContainer) {
        import('./components/modals/ProfileModal').then(({ initProfilePage }) => {
          initProfilePage(profileContainer, {
            onBack: () => switchTab('dashboard'),
          });
        });
      }
    }

    // Load projects page when switching to projects tab (list + inline form, no modal)
    if (tabName === 'projects') {
      const projectsContainer = document.getElementById('projects-page-container');
      if (projectsContainer) {
        import('./pages/ProjectsPage').then(({ initProjectsPage }) => {
          initProjectsPage(projectsContainer, {
            onBack: () => switchTab('dashboard'),
          });
        });
      }
    }

    // Load settings page when switching to settings tab
    if (tabName === 'settings') {
      const settingsContainer = document.getElementById('settings-page-container');
      if (settingsContainer) {
        import('./pages/SettingsPage').then(({ initSettingsPage }) => {
          initSettingsPage(settingsContainer, {
            onBack: () => switchTab('dashboard'),
          });
        });
      }
    }

    // Load admin panel when switching to admin tab
    if (tabName === 'admin') {
      const adminContainer = document.getElementById('tab-admin');
      if (adminContainer) {
        import('./pages/AdminPage').then(({ initAdminPanel }) => {
          initAdminPanel(adminContainer);
        });
      }
    }

    // Load Graph Explorer when switching to graph tab
    if (tabName === 'graph') {
      const graphContainer = document.getElementById('graph-container');
      // Check for actual element children, not just comments or text nodes
      const hasContent = graphContainer?.querySelector('.graph-explorer');
      if (graphContainer && !hasContent) {
        console.log('[Graph] Loading GraphExplorer...');
        import('./components/graph/GraphExplorer').then(({ createGraphExplorer }) => {
          graphContainer.innerHTML = ''; // Clear any placeholder
          const explorer = createGraphExplorer({
            onNodeSelect: (node) => {
              console.log('Graph node selected:', node);
            },
            onQueryExecute: (cypher) => {
              console.log('Query executed:', cypher);
            },
          });
          graphContainer.appendChild(explorer);
          console.log('[Graph] GraphExplorer loaded successfully');
        }).catch(err => {
          console.error('[Graph] Failed to load GraphExplorer:', err);
          graphContainer.innerHTML = '<div class="gm-loading-placeholder gm-text-center">Failed to load Graph Explorer</div>';
        });
      }
    }

    // Load Timeline Panel when switching to timeline tab
    if (tabName === 'timeline') {
      const timelineContainer = document.getElementById('timeline-content');
      const hasContent = timelineContainer?.querySelector('.timeline-panel');
      if (timelineContainer && !hasContent) {
        console.log('[Timeline] Loading TimelinePanel...');
        import('./pages/TimelinePage').then(({ createTimelinePanel }) => {
          timelineContainer.innerHTML = ''; // Clear any placeholder
          const panel = createTimelinePanel({
            onEventClick: (event) => {
              console.log('Timeline event clicked:', event);
              // Navigate to entity if possible
              if (event.entity_type && event.entity_id) {
                const entityType = event.entity_type;
                if (entityType === 'question') {
                  if (entityType === 'question') {
                    import('./components/questions/QuestionDetailView').then(async ({ createQuestionDetailView }) => {
                      const container = document.getElementById('timeline-content');
                      if (container && event.entity_id) {
                        try {
                          // Fetch question data first to satisfy props interface
                          const question = await window.godmode.questions.get(event.entity_id);
                          if (!question) throw new Error('Question not found');

                          container.innerHTML = '';
                          const detailView = createQuestionDetailView({
                            question: question,
                            onClose: () => switchTab('timeline'), // Map onBack to onClose
                          });
                          container.appendChild(detailView);
                        } catch (err) {
                          console.error('Failed to load question details:', err);
                          toast.error('Failed to load question details');
                        }
                      }
                    });
                  } else if (entityType === 'decision') {
                    import('./components/decisions/DecisionDetailView').then(async ({ createDecisionDetailView }) => {
                      const container = document.getElementById('timeline-content');
                      if (container && event.entity_id) {
                        try {
                          const decision = await window.godmode.decisions.get(event.entity_id);
                          if (!decision) throw new Error('Decision not found');

                          container.innerHTML = '';
                          const detailView = createDecisionDetailView({
                            decision: decision,
                            onClose: () => switchTab('timeline'),
                          });
                          container.appendChild(detailView);
                        } catch (err) {
                          console.error('Failed to load decision details:', err);
                          toast.error('Failed to load decision details');
                        }
                      }
                    });
                  } else if (entityType === 'fact') {
                    import('./components/facts/FactDetailView').then(async ({ createFactDetailView }) => {
                      const container = document.getElementById('timeline-content');
                      if (container && event.entity_id) {
                        try {
                          const fact = await window.godmode.facts.get(event.entity_id);
                          if (!fact) throw new Error('Fact not found');

                          container.innerHTML = '';
                          const detailView = createFactDetailView({
                            fact: fact,
                            onClose: () => switchTab('timeline'),
                          });
                          container.appendChild(detailView);
                        } catch (err) {
                          console.error('Failed to load fact details:', err);
                          toast.error('Failed to load fact details');
                        }
                      }
                    });
                  } else if (entityType === 'risk') {
                    import('./components/risks/RiskDetailView').then(async ({ createRiskDetailView }) => {
                      const container = document.getElementById('timeline-content');
                      if (container && event.entity_id) {
                        try {
                          const risk = await window.godmode.risks.get(event.entity_id);
                          if (!risk) throw new Error('Risk not found');

                          container.innerHTML = '';
                          const detailView = createRiskDetailView({
                            risk: risk,
                            onClose: () => switchTab('timeline'),
                          });
                          container.appendChild(detailView);
                        } catch (err) {
                          console.error('Failed to load risk details:', err);
                          toast.error('Failed to load risk details');
                        }
                      }
                    });
                  } else if (entityType === 'action') {
                    import('./components/actions/ActionDetailView').then(async ({ createActionDetailView }) => {
                      const container = document.getElementById('timeline-content');
                      if (container && event.entity_id) {
                        try {
                          // SOTA: Fetch action data first to satisfy strict props
                          const action = await window.godmode.actions.get(event.entity_id);
                          if (!action) throw new Error('Action not found');

                          container.innerHTML = '';
                          const detailView = createActionDetailView({
                            action: action,
                            onClose: () => switchTab('timeline'),
                          });
                          container.appendChild(detailView);
                        } catch (err) {
                          console.error('Failed to load action details:', err);
                          toast.error('Failed to load action details');
                        }
                      }
                    });
                  }
                } else {
                  toast.info(`Event: ${event.title}`);
                }
              }
            },
          });
          timelineContainer.appendChild(panel);
          console.log('[Timeline] TimelinePanel loaded successfully');
        }).catch(err => {
          console.error('[Timeline] Failed to load TimelinePanel:', err);
          timelineContainer.innerHTML = '<div class="gm-loading-placeholder gm-text-center">Failed to load Timeline</div>';
        });
      }
    }

    // Load Team Analysis when switching to team-analysis tab
    if (tabName === 'team-analysis') {
      const teamAnalysisContainer = document.getElementById('team-analysis-container');
      const hasContent = teamAnalysisContainer?.querySelector('.team-analysis-panel');
      if (teamAnalysisContainer && !hasContent) {
        console.log('[TeamAnalysis] Loading TeamAnalysis component...');
        import('./pages/TeamAnalysisPage').then(({ createTeamAnalysis }) => {
          teamAnalysisContainer.innerHTML = ''; // Clear any placeholder
          const panel = createTeamAnalysis();
          teamAnalysisContainer.appendChild(panel);
          console.log('[TeamAnalysis] TeamAnalysis loaded successfully');

          // Setup subtab switching after component is loaded
          setupTeamAnalysisSubtabs();
        }).catch(err => {
          console.error('[TeamAnalysis] Failed to load TeamAnalysis:', err);
          teamAnalysisContainer.innerHTML = '<div class="gm-loading-placeholder gm-text-center">Failed to load Team Analysis</div>';
        });
      } else {
        // Component already loaded, just setup subtabs
        setupTeamAnalysisSubtabs();
      }
    }
  });
}

/**
 * Setup Team Analysis subtab switching
 */
function setupTeamAnalysisSubtabs(): void {
  // Import the store to control subtab switching
  import('./stores/teamAnalysis').then(({ teamAnalysisStore }) => {
    document.querySelectorAll('#team-analysis-subtabs .subtab').forEach(btn => {
      // Remove existing listeners to prevent duplicates
      const newBtn = btn.cloneNode(true);
      btn.parentNode?.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', (e) => {
        const subtab = (e.target as HTMLElement).dataset.subtab as 'profiles' | 'team' | 'graph';
        if (subtab) {
          console.log('[TeamAnalysis] Switching to subtab:', subtab);
          // Update active state in UI
          document.querySelectorAll('#team-analysis-subtabs .subtab').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-subtab') === subtab);
          });
          // Update the store which triggers re-render
          teamAnalysisStore.setSubtab(subtab);
        }
      });
    });
  });
}

/**
 * Load projects
 */
async function loadProjects(): Promise<void> {
  const selector = document.getElementById('project-selector') as HTMLSelectElement;
  if (!selector) return;

  try {
    const projectList = await projects.getAll();

    selector.innerHTML = '<option value="">Select Project...</option>';
    projectList.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name + (project.isDefault ? ' (default)' : '');
      selector.appendChild(option);
    });

    // Select current project if any; when none persisted (e.g. storage blocked), auto-select first or default
    const currentProjectId = appStore.getState().currentProjectId;
    const editProjectBtn = document.getElementById('edit-project-btn');

    if (currentProjectId) {
      selector.value = currentProjectId;
      if (editProjectBtn) editProjectBtn.classList.remove('hidden');
    } else if (projectList.length > 0) {
      const firstOrDefault = projectList.find((p: { isDefault?: boolean }) => p.isDefault) || projectList[0];
      selector.value = firstOrDefault.id;
      appStore.setCurrentProject(firstOrDefault);
      appStore.setCurrentProjectId(firstOrDefault.id);
      if (editProjectBtn) editProjectBtn.classList.remove('hidden');
    } else {
      if (editProjectBtn) editProjectBtn.classList.add('hidden');
    }
  } catch (error) {
    // Projects API may not be available yet
    console.warn('Projects not available:', error);
  }
}

/**
 * Clear all project-scoped state so no data from another project can leak into the UI.
 */
function clearProjectScopedState(): void {
  dataStore.setQuestions([]);
  dataStore.setRisks([]);
  dataStore.setActions([]);
  dataStore.setDecisions([]);
  dataStore.setFacts([]);
  dataStore.setContacts([]);
  dataStore.clearChatHistory();
  teamAnalysisStore.reset();
  chartsStore.destroyAll();
  try {
    localStorage.removeItem('copilot_session');
  } catch {
    // ignore if localStorage unavailable
  }
  // Clear URL hash and project-scoped query params so no ID from previous project remains
  if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
    const base = window.location.pathname || '/app';
    window.history.replaceState(null, '', base);
  }
}

/**
 * Select a project
 */
async function selectProject(projectId: string): Promise<void> {
  try {
    clearProjectScopedState();
    const project = await projects.activate(projectId);

    if (project) {
      toast.success(`Switched to: ${project.name}`);
      await refreshData();
    }
  } catch {
    toast.error('Failed to load project');
  }
}

/**
 * Refresh all data for current project
 */
async function refreshData(): Promise<void> {
  try {
    // First, reload projects list (may auto-select first/default if store was empty)
    await loadProjects();

    let currentProject = appStore.getState().currentProject;
    let currentProjectId = appStore.getState().currentProjectId;

    // If store still empty but selector has a value (e.g. user picked one), sync store from selector
    if (!currentProject && !currentProjectId) {
      const selector = document.getElementById('project-selector') as HTMLSelectElement;
      if (selector?.value) {
        try {
          const project = await projects.activate(selector.value);
          if (project) {
            appStore.setCurrentProject(project);
            appStore.setCurrentProjectId(project.id);
            currentProject = project;
            currentProjectId = project.id;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!currentProject && !currentProjectId) {
      // No project selected - show empty state and ensure dashboard tab is visible
      console.log('📭 No project selected - showing empty state');
      switchTab('dashboard');
      clearProjectScopedState();
      await refreshDashboardPanel();
      loadSotContent(uiStore.getState().sotCurrentView);
      return;
    }

    // API endpoints don't use projectId in path - project context is server-side
    const [questionsRes, risksRes, actionsRes, decisionsRes, contactsRes] = await Promise.all([
      http.get<{ questions: unknown[] }>('/api/questions').catch(() => ({ data: { questions: [] } })),
      http.get<{ risks: unknown[] }>('/api/risks').catch(() => ({ data: { risks: [] } })),
      http.get<{ actions: unknown[] }>('/api/actions').catch(() => ({ data: { actions: [] } })),
      http.get<{ decisions: unknown[] }>('/api/decisions').catch(() => ({ data: { decisions: [] } })),
      http.get<{ contacts: unknown[] }>('/api/contacts').catch(() => ({ data: { contacts: [] } })),
    ]);

    dataStore.setQuestions((questionsRes.data.questions || []) as []);
    dataStore.setRisks((risksRes.data.risks || []) as []);
    dataStore.setActions((actionsRes.data.actions || []) as []);
    dataStore.setDecisions((decisionsRes.data.decisions || []) as []);
    dataStore.setContacts((contactsRes.data.contacts || []) as []);

    // Re-render dashboard with new data
    await refreshDashboardPanel();
    loadSotContent(uiStore.getState().sotCurrentView);
  } catch {
    console.error('Failed to refresh data');
  }
}

/**
 * Update dashboard stats
 */
function updateDashboard(): void {
  const statsGrid = document.getElementById('dashboard-stats');
  const dashboardContent = document.getElementById('dashboard-content');
  if (!statsGrid) return;

  // Check if project is selected
  const currentProject = appStore.getState().currentProject;
  const currentProjectId = appStore.getState().currentProjectId;

  if (!currentProject && !currentProjectId) {
    // No project selected - show empty state
    statsGrid.innerHTML = `
      <div class="no-project-message gm-grid-col-all gm-empty-state gm-p-6">
        <svg class="gm-empty-state-icon" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <h3 class="gm-empty-state-title gm-text-lg">No Project Selected</h3>
        <p class="gm-empty-state-desc">
          Select an existing project from the dropdown above or create a new one to start managing your data.
        </p>
        <button id="create-project-cta" class="btn btn-primary gm-empty-state-cta">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create New Project
        </button>
      </div>
    `;

    if (dashboardContent) {
      dashboardContent.classList.add('gm-none');
    }

    // Bind create project button — open Projects tab with create form inline
    const createBtn = document.getElementById('create-project-cta');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        (window as unknown as { __godmodeProjectsOpen?: string })['__godmodeProjectsOpen'] = 'create';
        switchTab('projects');
      });
    }

    return;
  }

  if (dashboardContent) {
    dashboardContent.classList.remove('gm-none');
  }

  const state = dataStore.getState();

  // Count only active questions (exclude dismissed/resolved/answered)
  const activeQuestions = state.questions.filter(q =>
    q.status !== 'dismissed' && q.status !== 'resolved' && q.status !== 'answered'
  );

  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${activeQuestions.length}</div>
      <div class="stat-label">Questions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${state.risks.length}</div>
      <div class="stat-label">Risks</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${state.actions.length}</div>
      <div class="stat-label">Actions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${state.decisions.length}</div>
      <div class="stat-label">Decisions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${state.contacts.length}</div>
      <div class="stat-label">Contacts</div>
    </div>
  `;
}

/**
 * Load SOT content
 */
function loadSotContent(view: string): void {
  const container = document.getElementById('sot-content');
  if (!container) return;

  const state = dataStore.getState();
  let items: Array<{ id: string;[key: string]: unknown }> = [];
  let template: (item: { id: string;[key: string]: unknown }) => string;

  switch (view) {
    case 'questions':
      // Use the full QuestionsPanel with Generate button, filters and detail view
      container.innerHTML = '';
      const questionsPanel = createQuestionsPanel({
        useDetailView: true,
        containerElement: container
      });
      container.appendChild(questionsPanel);
      return; // Exit early since we're using the full component
    case 'facts':
      container.innerHTML = '';
      const factsPanel = createFactsPanel({
        useDetailView: true,
        containerElement: container
      });
      container.appendChild(factsPanel);
      return;
    case 'decisions':
      container.innerHTML = '';
      const decisionsPanel = createDecisionsPanel({
        useDetailView: true,
        containerElement: container
      });
      container.appendChild(decisionsPanel);
      return;
    case 'risks':
      container.innerHTML = '';
      const risksPanel = createRisksPanel({
        useDetailView: true,
        containerElement: container
      });
      container.appendChild(risksPanel);
      return;
    case 'actions':
      container.innerHTML = '';
      const actionsPanel = createActionsPanel({
        useDetailView: true,
        containerElement: container
      });
      container.appendChild(actionsPanel);
      return;
    default:
      container.innerHTML = '<p class="text-muted">Select a view</p>';
      return;
  }
}

/**
 * Show question detail view
 */
function showQuestionDetail(question: Question, container: HTMLElement): void {
  // Store original content for restoration
  const originalContent = container.innerHTML;

  // Transform question to match the expected interface
  const questionData = {
    id: question.id,
    content: String(question.content || question.question || ''),
    context: question.context as string | undefined,
    priority: (question.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
    status: (question.status || 'pending') as 'pending' | 'assigned' | 'resolved' | 'reopened' | 'dismissed',
    assigned_to: question.assigned_to as string | undefined,
    answer: question.answer as string | undefined,
    answer_source: question.answer_source as 'manual' | 'manual-edit' | 'auto-detected' | 'document' | 'ai' | undefined,
    category: question.category as string | undefined,
    source_file: question.source_file as string | undefined,
    created_at: String(question.created_at || question.createdAt || new Date().toISOString()),
    updated_at: question.updated_at as string | undefined,
    follow_up_to: question.follow_up_to as string | undefined,
    answered_by_contact_id: question.answered_by_contact_id as string | undefined,
    answered_by_name: question.answered_by_name as string | undefined,
    sla_hours: question.sla_hours as number | undefined,
    sla_breached: question.sla_breached as boolean | undefined,
    extracted_entities: question.extracted_entities as Array<{ type: string; name: string }> | undefined,
    extracted_topics: question.extracted_topics as Array<{ name: string }> | undefined,
  };

  // Create detail view
  const detailView = createQuestionDetailView({
    question: questionData,
    onClose: () => {
      // Restore original content
      container.innerHTML = originalContent;
      // Re-bind click handlers
      loadSotContent('questions');
    },
    onUpdate: (updatedQuestion) => {
      // Update question in data store
      const state = dataStore.getState();
      const updatedQuestions = state.questions.map((q) =>
        q.id === updatedQuestion.id ? { ...q, ...updatedQuestion } as Question : q
      );
      dataStore.setQuestions(updatedQuestions);
    },
    onNavigateToQuestion: (questionId) => {
      // Find and show the target question
      const state = dataStore.getState();
      const targetQuestion = state.questions.find((q) => q.id === questionId);
      if (targetQuestion) {
        showQuestionDetail(targetQuestion, container);
      }
    }
  });

  // Replace content with detail view
  container.innerHTML = '';
  container.appendChild(detailView);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format markdown (basic)
 */
function formatMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/**
 * Pending files manager
 */
const pendingFiles: File[] = [];

function updatePendingFilesUI(): void {
  const countEl = document.getElementById('pending-count');
  const listEl = document.getElementById('pending-files-list');

  if (countEl) {
    countEl.textContent = `${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`;
  }

  if (listEl) {
    if (pendingFiles.length === 0) {
      listEl.innerHTML = '<div class="empty-hint">No files pending</div>';
    } else {
      listEl.innerHTML = pendingFiles.map((file, index) => `
        <div class="pending-file-item" data-index="${index}">
          <div class="pending-file-info">
            <div class="pending-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="pending-file-size">${formatFileSize(file.size)}</div>
          </div>
          <button class="pending-file-remove" data-index="${index}" title="Remove">×</button>
        </div>
      `).join('');

      // Bind remove buttons
      listEl.querySelectorAll('.pending-file-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((btn as HTMLElement).dataset.index || '0');
          pendingFiles.splice(idx, 1);
          updatePendingFilesUI();
        });
      });
    }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function addPendingFiles(files: FileList | File[]): void {
  Array.from(files).forEach(file => {
    if (!pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
      pendingFiles.push(file);
    }
  });
  updatePendingFilesUI();
}

/**
 * Initialize sidebar action buttons
 */
function initializeSidebarActions(): void {
  // Process Files button
  const processBtn = document.getElementById('process-files-btn');
  if (processBtn) {
    processBtn.addEventListener('click', async () => {
      if (pendingFiles.length === 0) {
        toast.warning('No files to process. Add files first.');
        return;
      }

      processBtn.setAttribute('disabled', 'true');
      processBtn.innerHTML = '<span class="btn-icon">⏳</span> Processing...';

      try {
        const result = await documentsService.upload(pendingFiles);
        if (result.success) {
          toast.success(`Processed ${result.files.length} files successfully`);
          pendingFiles.length = 0; // Clear array
          updatePendingFilesUI();
          refreshData();
        }
      } catch (error) {
        toast.error('Failed to process files');
        console.error('Process error:', error);
      } finally {
        processBtn.removeAttribute('disabled');
        processBtn.innerHTML = '<span class="btn-icon">⚡</span> Process Files';
      }
    });
  }

  // Export Knowledge button
  const exportKnowledgeBtn = document.getElementById('export-knowledge-btn');
  if (exportKnowledgeBtn) {
    exportKnowledgeBtn.addEventListener('click', async () => {
      try {
        const data = dataStore.getState();
        const knowledge = {
          facts: data.facts || [],
          decisions: data.decisions || [],
          exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(knowledge, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'godmode-knowledge-export.json';
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Knowledge exported');
      } catch (error) {
        toast.error('Export failed');
      }
    });
  }

  // Export Knowledge to clipboard
  const exportKnowledgeClipboard = document.getElementById('export-knowledge-clipboard');
  if (exportKnowledgeClipboard) {
    exportKnowledgeClipboard.addEventListener('click', async () => {
      try {
        const data = dataStore.getState();
        const knowledge = {
          facts: data.facts || [],
          decisions: data.decisions || []
        };
        await navigator.clipboard.writeText(JSON.stringify(knowledge, null, 2));
        toast.success('Copied to clipboard');
      } catch (error) {
        toast.error('Copy failed');
      }
    });
  }

  // Export Questions button
  const exportQuestionsBtn = document.getElementById('export-questions-btn');
  if (exportQuestionsBtn) {
    exportQuestionsBtn.addEventListener('click', async () => {
      try {
        const data = dataStore.getState();
        const questions = data.questions || [];

        const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'godmode-questions-export.json';
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Questions exported');
      } catch (error) {
        toast.error('Export failed');
      }
    });
  }

  // Export Questions to clipboard
  const exportQuestionsClipboard = document.getElementById('export-questions-clipboard');
  if (exportQuestionsClipboard) {
    exportQuestionsClipboard.addEventListener('click', async () => {
      try {
        const data = dataStore.getState();
        const questions = data.questions || [];
        await navigator.clipboard.writeText(JSON.stringify(questions, null, 2));
        toast.success('Copied to clipboard');
      } catch (error) {
        toast.error('Copy failed');
      }
    });
  }

  // Copy Overdue Items button
  const copyOverdueBtn = document.getElementById('copy-overdue-btn');
  if (copyOverdueBtn) {
    copyOverdueBtn.addEventListener('click', async () => {
      try {
        const data = dataStore.getState();
        const now = new Date();

        const overdueActions = (data.actions || []).filter(a => {
          if (a.status === 'completed') return false;
          const dueDate = a.dueDate;
          if (!dueDate) return false;
          return new Date(dueDate) < now;
        });

        const overdueQuestions = (data.questions || []).filter(q => {
          if (q.status === 'resolved') return false;
          const createdAt = q.created_at || q.createdAt;
          if (!createdAt) return false;
          const created = new Date(createdAt);
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return created < sevenDaysAgo;
        });

        const overdue = {
          actions: overdueActions,
          questions: overdueQuestions,
          exportedAt: now.toISOString()
        };

        await navigator.clipboard.writeText(JSON.stringify(overdue, null, 2));
        toast.success(`Copied ${overdueActions.length} actions and ${overdueQuestions.length} questions`);
      } catch (error) {
        toast.error('Copy failed');
      }
    });
  }

  // Clean Orphan Data button
  const cleanOrphanBtn = document.getElementById('clean-orphan-btn');
  if (cleanOrphanBtn) {
    cleanOrphanBtn.addEventListener('click', async () => {
      const confirmed = await components.confirm(
        'This will remove orphaned data entries that are not linked to any documents. Continue?',
        { title: 'Clean Orphan Data', confirmText: 'Clean', confirmClass: 'btn-warning' }
      );

      if (confirmed) {
        try {
          const response = await http.post('/api/cleanup/orphans');
          toast.success('Orphan data cleaned');
          refreshData();
        } catch (error) {
          toast.error('Cleanup failed');
        }
      }
    });
  }

  // Reset Data button (clears knowledge; keeps team, contacts, cost)
  const resetDataBtn = document.getElementById('reset-data-btn');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', async () => {
      const confirmed = await components.confirm(
        'This will clear all knowledge data (facts, decisions, questions, risks, actions, documents, etc.) for the current project. Team, contacts, and cost data will be kept. Continue?',
        { title: 'Reset Project Data', confirmText: 'Reset Knowledge Data', confirmClass: 'btn-danger' }
      );

      if (confirmed) {
        try {
          await http.post('/api/reset');
          toast.success('Project data reset; team, contacts and cost preserved.');
          refreshData();
        } catch (error) {
          toast.error('Reset failed');
        }
      }
    });
  }

  // Initialize pending files UI
  updatePendingFilesUI();
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  console.log('🚀 GodMode Frontend initializing...');

  // Initialize legacy bridge for backwards compatibility
  initLegacyBridge();
  console.log('🔗 Legacy bridge initialized');

  // Configure API client
  configureApiClient();
  console.log('📡 API client configured');

  // Initialize authentication
  await initAuth();
  console.log('🔐 Auth initialized');

  // Theme is already initialized via its constructor
  console.log(`📎 Theme: ${theme.getMode()} (effective: ${theme.getEffective()})`);

  // Register keyboard shortcuts
  registerShortcuts();
  console.log('⌨️ Keyboard shortcuts registered');

  // Initialize global search (Cmd+K / Ctrl+K)
  initGlobalSearch({
    onResultClick: (result) => {
      console.log('Search result clicked:', result);
      // Navigate to the result based on type
      window.dispatchEvent(new CustomEvent('godmode:navigate', { detail: result }));
    }
  });
  console.log('🔍 Global search initialized');

  // Listen for projects list changed (e.g. from Projects tab create/edit/delete)
  window.addEventListener('godmode:projects-changed', () => {
    loadProjects();
  });

  // Listen for godmode:navigate (e.g. "View source document" from Fact/Decision/Risk detail)
  window.addEventListener('godmode:navigate', async (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (!d || d.tab !== 'files' || !d.documentId) return;
    switchTab('files');
    await new Promise(r => setTimeout(r, 400)); // allow Files panel to mount
    const doc = await documentsService.get(d.documentId);
    if (doc) {
      const { showDocumentPreviewModal } = await import('./components/modals/DocumentPreviewModal');
      showDocumentPreviewModal({ document: doc });
    }
  });

  // Initialize UI
  initializeUI();
  console.log('🎨 UI initialized');

  // Initialize client-side routing (reads URL and activates correct tab)
  initRouting();
  console.log('🔀 Client-side routing initialized');

  // Load initial data (only if authenticated or auth not required)
  if (auth.isAuthenticated()) {
    refreshData();
    console.log('📊 Data loading started');
  } else if (appStore.getState().authConfigured) {
    // Auth required but not logged in - redirect to landing page
    console.log('🔐 Authentication required - redirecting to landing page');
    window.location.href = '/';
    return;
  } else {
    // Auth not configured - guest mode
    console.log('📊 Guest mode - loading data');
    refreshData();
  }

  const loading = document.getElementById('app-loading');
  if (loading) {
    loading.classList.add('fade-out');
    setTimeout(() => loading.classList.add('hidden'), 300);
  }

  // Log successful initialization
  console.log('✅ GodMode Frontend ready');
  console.log(`📦 Version: ${window.godmode.version}`);
  console.log('💡 Press ? for keyboard shortcuts');
}

/**
 * Initialize authentication
 */
async function initAuth(): Promise<void> {
  // Check auth status and session
  const isAuthenticated = await auth.init();

  // Update UI based on auth state
  updateAuthUI();

  // Listen for auth required events (e.g., 401 from API)
  auth.onAuthRequired(() => {
    components.showAuthModal({
      required: true, // Session expired, must re-authenticate
      onSuccess: () => {
        updateAuthUI();
        refreshData();
        toast.success('Session restored! Refreshing data...');
      }
    });
  });

  // Listen for auth success to refresh data
  window.addEventListener('godmode:auth-success', () => {
    updateAuthUI();
    refreshData();
  });
}

/**
 * Show full-screen authentication blocker with integrated login form
 * Completely blocks access to the app until login
 */
function showAuthRequiredMessage(): void {
  // Remove any existing overlay
  const existing = document.getElementById('auth-blocker-overlay');
  if (existing) existing.remove();

  // Create full-screen blocker overlay
  const authBlocker = document.createElement('div');
  authBlocker.id = 'auth-blocker-overlay';
  authBlocker.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h1 class="auth-title">Welcome to GodMode</h1>
      <p class="auth-subtitle">Your AI-powered knowledge management platform</p>
      
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Sign In</button>
        <button class="auth-tab" data-tab="register">Create Account</button>
      </div>
      
      <!-- Login Form -->
      <form id="login-form" class="auth-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="login-email" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div class="input-wrapper">
            <input type="password" class="form-input" id="login-password" placeholder="Enter your password" required autocomplete="current-password">
          </div>
        </div>
        <div class="form-error" id="login-error"></div>
        <button type="submit" class="auth-submit" id="login-submit">Sign In</button>
        <div class="auth-footer">
          <button type="button" class="auth-link" id="forgot-link">Forgot your password?</button>
        </div>
      </form>
      
      <!-- Register Form -->
      <form id="register-form" class="auth-form hidden">
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" class="form-input" id="register-email" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input type="text" class="form-input" id="register-name" placeholder="Your name (optional)" autocomplete="name">
        </div>
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input type="password" class="form-input" id="register-password" placeholder="Min. 12 characters" required minlength="12" autocomplete="new-password">
          <span class="form-hint">Use at least 12 characters with mixed case, numbers, and symbols</span>
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password *</label>
          <input type="password" class="form-input" id="register-confirm" placeholder="Confirm your password" required autocomplete="new-password">
        </div>
        <div class="form-error" id="register-error"></div>
        <button type="submit" class="auth-submit" id="register-submit">Create Account</button>
      </form>
      
      <!-- Forgot Password Form -->
      <form id="forgot-form" class="auth-form hidden">
        <p class="auth-forgot-intro">
          Enter your email and we'll send you a link to reset your password.
        </p>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="forgot-email" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div class="form-error" id="forgot-error"></div>
        <button type="submit" class="auth-submit">Send Reset Link</button>
        <div class="auth-footer">
          <button type="button" class="auth-link" id="back-to-login">Back to Sign In</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(authBlocker);

  // Tab switching
  const tabs = authBlocker.querySelectorAll('.auth-tab');
  const loginForm = authBlocker.querySelector('#login-form') as HTMLFormElement;
  const registerForm = authBlocker.querySelector('#register-form') as HTMLFormElement;
  const forgotForm = authBlocker.querySelector('#forgot-form') as HTMLFormElement;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabId = tab.getAttribute('data-tab');
      loginForm.classList.toggle('hidden', tabId !== 'login');
      registerForm.classList.toggle('hidden', tabId !== 'register');
      forgotForm.classList.add('hidden');
    });
  });

  // Forgot password link
  const forgotLink = authBlocker.querySelector('#forgot-link');
  forgotLink?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.remove('hidden');
    tabs.forEach(t => t.classList.remove('active'));
  });

  // Back to login
  const backToLogin = authBlocker.querySelector('#back-to-login');
  backToLogin?.addEventListener('click', () => {
    forgotForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    tabs[0].classList.add('active');
  });

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (authBlocker.querySelector('#login-email') as HTMLInputElement).value;
    const password = (authBlocker.querySelector('#login-password') as HTMLInputElement).value;
    const errorEl = authBlocker.querySelector('#login-error') as HTMLElement;
    const submitBtn = authBlocker.querySelector('#login-submit') as HTMLButtonElement;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorEl.classList.remove('visible');

    try {
      await auth.login({ email, password });
      authBlocker.remove();
      updateAuthUI();
      refreshData();
      toast.success('Welcome back!');
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Login failed. Please try again.';
      errorEl.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  // Handle Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (authBlocker.querySelector('#register-email') as HTMLInputElement).value;
    const name = (authBlocker.querySelector('#register-name') as HTMLInputElement).value;
    const password = (authBlocker.querySelector('#register-password') as HTMLInputElement).value;
    const confirm = (authBlocker.querySelector('#register-confirm') as HTMLInputElement).value;
    const errorEl = authBlocker.querySelector('#register-error') as HTMLElement;
    const submitBtn = authBlocker.querySelector('#register-submit') as HTMLButtonElement;

    if (password !== confirm) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.classList.add('visible');
      return;
    }

    if (password.length < 12) {
      errorEl.textContent = 'Password must be at least 12 characters';
      errorEl.classList.add('visible');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    errorEl.classList.remove('visible');

    try {
      const result = await auth.register({ email, password, display_name: name || undefined });

      if (result.needsEmailVerification) {
        toast.success('Account created! Check your email to verify.');
        // Switch to login tab
        tabs.forEach(t => t.classList.remove('active'));
        tabs[0].classList.add('active');
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        authBlocker.remove();
        updateAuthUI();
        refreshData();
        toast.success('Account created! Welcome to GodMode.');
      }
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      errorEl.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  // Handle Forgot Password
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (authBlocker.querySelector('#forgot-email') as HTMLInputElement).value;
    const submitBtn = forgotForm.querySelector('.auth-submit') as HTMLButtonElement;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      await auth.forgotPassword(email);
      toast.success('If an account exists, you will receive a reset link.');
      // Go back to login
      forgotForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      tabs[0].classList.add('active');
    } catch {
      toast.success('If an account exists, you will receive a reset link.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
    }
  });

  // Focus email input
  setTimeout(() => {
    const emailInput = authBlocker.querySelector('#login-email') as HTMLInputElement;
    emailInput?.focus();
  }, 100);
}

/**
 * Update UI based on auth state
 */
function updateAuthUI(): void {
  const user = auth.getCurrentUser();
  const userAvatar = document.getElementById('user-avatar');
  const userDropdown = document.getElementById('user-dropdown');
  const loginBtn = document.getElementById('login-btn');

  // Remove auth blocker if it exists
  const authBlocker = document.getElementById('auth-blocker-overlay');
  if (authBlocker && user) {
    authBlocker.remove();
  }

  // Admin nav button - only visible for superadmin
  const adminNavBtn = document.getElementById('nav-admin-btn');

  if (user) {
    // Show user info
    if (userAvatar) {
      const displayName = user.name || user.email.split('@')[0] || 'User';
      const initials = (user.name?.[0] || user.email[0]).toUpperCase();

      // Generate fallback avatar URL using UI Avatars
      const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=e11d48&color=fff&size=80&font-size=0.4&bold=true`;
      const avatarUrl = user.avatar || fallbackAvatar;

      // Use image for avatar
      userAvatar.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(initials)}" class="gm-avatar-img" onerror="this.classList.add('gm-none');this.parentElement.textContent=this.alt">`;
      userAvatar.title = user.name || user.email;
      userAvatar.classList.remove('hidden');
    }
    if (loginBtn) {
      loginBtn.classList.add('hidden');
    }
    // Update dropdown content
    if (userDropdown) {
      const userName = userDropdown.querySelector('.user-name');
      const userEmail = userDropdown.querySelector('.user-email');
      if (userName) userName.textContent = user.name || 'User';
      if (userEmail) userEmail.textContent = user.email;
    }

    // Show/hide Admin nav based on role
    if (adminNavBtn) {
      if (user.role === 'superadmin') {
        adminNavBtn.classList.remove('hidden');
        console.log('🔑 Admin nav enabled for superadmin:', user.email);
      } else {
        adminNavBtn.classList.add('hidden');
      }
    }
  } else {
    // Show login button
    if (userAvatar) {
      userAvatar.classList.add('hidden');
    }
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
    }
    // Hide admin nav when logged out
    if (adminNavBtn) {
      adminNavBtn.classList.add('hidden');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Add components to global
Object.assign(window.godmode, { components });

// Export for potential use in other modules
export {
  theme, toast, shortcuts, undoManager, storage, http, api, configureApi, auth, projects,
  dashboardService, questionsService, risksService, actionsService, decisionsService,
  chatService, contactsService, teamsService, documentsService, knowledgeService,
  emailsService, graphService, timelineService, costsService, notificationsService,
  commentsService, membersService, profileService, userSettingsService, projectSettingsService,
  apiKeysService, webhooksService, auditService
};
export { appStore, uiStore, dataStore, chartsStore };
export { components };
