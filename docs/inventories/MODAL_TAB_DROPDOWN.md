# Complete Inventory: Modals, Tabs, and Dropdowns

## 1. ALL MODALS

### 1.1 `processingModal`
- **ID**: `processingModal`
- **Purpose**: Shows file processing progress with progress bar, current file name, elapsed/remaining time
- **Open Function**: `showProcessingModal()`
- **Close Function**: `closeProcessingModal()`
- **Hide Function**: `hideProcessingModal(status)`
- **Key Elements**:
  - `processingModalTitle` - Title text
  - `processingModalPhase` - Phase description
  - `modalProgressFill` - Progress bar fill
  - `modalProgressPercent` - Percentage display
  - `modalProgressFiles` - File count display
  - `modalFileName` - Current file name
  - `modalElapsed` - Elapsed time
  - `modalRemaining` - Estimated remaining time
  - `processingCloseBtn` / `processingCloseBtnBottom` - Close buttons

### 1.2 `emailModal`
- **ID**: `emailModal`
- **Purpose**: Email processing interface with paste/upload tabs
- **Open Function**: `openEmailModal()`
- **Close Function**: `closeEmailModal()`
- **Tabs**: Uses `switchEmailTab()` function
  - `emailTabPaste` / `emailPasteTab` - Paste email content
  - `emailTabUpload` / `emailUploadTab` - Upload .eml file

### 1.3 `emailResponseModal`
- **ID**: `emailResponseModal`
- **Purpose**: Displays generated email response
- **Open Function**: Dynamically opened via `generateEmailResponse()`
- **Close Function**: `closeEmailResponseModal()`

### 1.4 `emailDetailModal`
- **ID**: `emailDetailModal`
- **Purpose**: Shows email details (dynamically created)
- **Open Function**: Created dynamically in code
- **Close Function**: `closeModal('emailDetailModal')`

### 1.5 `conversationModal`
- **ID**: `conversationModal`
- **Purpose**: Import/manage conversations
- **Open Function**: `openConversationModal()`
- **Close Function**: `closeConversationModal()`
- **Related**: `importConversationModal()` function

### 1.6 `addRelationshipModal`
- **ID**: `addRelationshipModal`
- **Purpose**: Add relationships between contacts in graph
- **Open Function**: `openAddRelationshipModal(preselectedFromId)` / `showAddRelationshipModal(contactId, contactName)`
- **Close Function**: `closeAddRelationshipModal()`

### 1.7 `resetModal`
- **ID**: `resetModal`
- **Purpose**: Reset/clear data confirmation
- **Open Function**: `document.getElementById('resetModal').classList.add('open')`
- **Close Function**: `closeModal('resetModal')`

### 1.8 `dismissQuestionModal`
- **ID**: `dismissQuestionModal`
- **Purpose**: Dismiss/archive questions
- **Open Function**: `showDismissQuestionModal(questionId, questionPreview)`
- **Close Function**: `closeModal('dismissQuestionModal')`

### 1.9 `newProjectModal`
- **ID**: `newProjectModal`
- **Purpose**: Create new project
- **Open Function**: `openNewProjectModal()`
- **Close Function**: `closeModal('newProjectModal')`

### 1.10 `deleteProjectModal`
- **ID**: `deleteProjectModal`
- **Purpose**: Delete project confirmation
- **Open Function**: `openDeleteProjectModal(projectId, projectName)`
- **Close Function**: `closeModal('deleteProjectModal')`

### 1.11 `renameProjectModal`
- **ID**: `renameProjectModal`
- **Purpose**: Rename project
- **Open Function**: `openRenameProjectModal(projectId, projectName)`
- **Close Function**: `closeModal('renameProjectModal')`

### 1.12 `editRoleModal`
- **ID**: `editRoleModal`
- **Purpose**: Edit user role with multiple tabs (Edit, Templates, Perspectives, Dashboard)
- **Open Function**: `openEditRoleModal()`
- **Close Function**: `closeModal('editRoleModal')`
- **Tabs**: Uses `switchRoleTab()` function (see Tabs section)

### 1.13 `genericModal`
- **ID**: `genericModal`
- **Purpose**: Generic reusable modal for various content
- **Open Function**: `showModal(title, content)`
- **Close Function**: `closeModal('genericModal')`
- **Elements**: `genericModalTitle`, `genericModalContent`

### 1.14 `contactModal`
- **ID**: `contactModal`
- **Purpose**: Add/edit contacts
- **Open Function**: `showAddContactModal(prefillName)`
- **Close Function**: `closeModal('contactModal')`
- **Elements**: `contactModalTitle` (changes between "Add Contact" and "Edit Contact")

### 1.15 `contactDetailModal`
- **ID**: `contactDetailModal`
- **Purpose**: View contact details
- **Open Function**: Dynamically opened
- **Close Function**: `closeModal('contactDetailModal')`

### 1.16 `teamsModal`
- **ID**: `teamsModal`
- **Purpose**: Manage teams
- **Open Function**: `showTeamsModal()`
- **Close Function**: `closeModal('teamsModal')`

### 1.17 `importContactsModal`
- **ID**: `importContactsModal`
- **Purpose**: Import contacts from CSV/JSON
- **Open Function**: `showImportContactsModal()`
- **Close Function**: `closeModal('importContactsModal')`
- **Tabs**: Uses `showImportTab()` function
  - `importTabCSV` / CSV tab
  - `importTabJSON` / JSON tab

### 1.18 `duplicatesModal`
- **ID**: `duplicatesModal`
- **Purpose**: Show duplicate contacts for merging
- **Open Function**: `showDuplicatesModal()`
- **Close Function**: `closeModal('duplicatesModal')`

### 1.19 `unmatchedModal`
- **ID**: `unmatchedModal`
- **Purpose**: Show unmatched contacts
- **Open Function**: Dynamically opened
- **Close Function**: `closeModal('unmatchedModal')`

### 1.20 `graphConnectModal`
- **ID**: `graphConnectModal`
- **Purpose**: Connect contacts in graph database
- **Open Function**: `showGraphConnectModal()`
- **Close Function**: `closeModal('graphConnectModal')`

### 1.21 `authModal`
- **ID**: `authModal`
- **Purpose**: Login/Register authentication
- **Open Function**: `openLoginModal()`
- **Close Function**: `closeModal('authModal')`
- **Tabs**: Uses `switchAuthTab()` function
  - Login tab
  - Register tab
  - Forgot password tab

### 1.22 `teamModal`
- **ID**: `teamModal`
- **Purpose**: Team management (members and invites)
- **Open Function**: `openTeamModal()`
- **Close Function**: `closeModal('teamModal')`
- **Tabs**: Uses `switchTeamTab()` function (see Tabs section)

### 1.23 `notificationsModal`
- **ID**: `notificationsModal`
- **Purpose**: View notifications
- **Open Function**: `openNotificationsModal()`
- **Close Function**: `closeModal('notificationsModal')`

### 1.24 `activityModal`
- **ID**: `activityModal`
- **Purpose**: View activity log
- **Open Function**: `openActivityModal()`
- **Close Function**: `closeModal('activityModal')`

### 1.25 `profileModal`
- **ID**: `profileModal`
- **Purpose**: User profile settings
- **Open Function**: `openUserProfile()` / `document.getElementById('profileModal').style.display = 'flex'`
- **Close Function**: `closeModal('profileModal')`

### 1.26 `developerModal`
- **ID**: `developerModal`
- **Purpose**: Developer settings (API keys, webhooks, audit, sync)
- **Open Function**: `openDeveloperModal()`
- **Close Function**: `closeModal('developerModal')`
- **Tabs**: Uses `switchDevTab()` function (see Tabs section)

### 1.27 `settingsModal`
- **ID**: `settingsModal`
- **Purpose**: Application settings
- **Open Function**: `document.getElementById('settingsModal').classList.add('open')`
- **Close Function**: `closeModal('settingsModal')`

### 1.28 `documentDateModal`
- **ID**: `documentDateModal`
- **Purpose**: Set document dates
- **Open Function**: Dynamically opened
- **Close Function**: `cancelDateModal()`
- **Elements**: `dateModalFilesList`

### 1.29 `sourceViewerModal`
- **ID**: `sourceViewerModal`
- **Purpose**: View source documents (original/processed)
- **Open Function**: Dynamically opened
- **Close Function**: `closeModal('sourceViewerModal')`
- **Tabs**: Uses `switchSourceView()` function
  - `both` - Both views
  - `raw` - Original view
  - `processed` - Processed view

### 1.30 `sotVersionsModal`
- **ID**: `sotVersionsModal`
- **Purpose**: Source of Truth version history
- **Open Function**: `showSOTVersions()`
- **Close Function**: `closeSOTVersionsModal()`
- **Elements**: `sotVersionsList`

### 1.31 `projectSummaryModal`
- **ID**: `projectSummaryModal`
- **Purpose**: Project summary popup (dynamically created)
- **Open Function**: `showProjectSummaryModal(projectName, data)`
- **Close Function**: Dynamically removed

### 1.32 `heatmapRiskModal`
- **ID**: `heatmapRiskModal`
- **Purpose**: Risk heatmap visualization (dynamically created)
- **Open Function**: Dynamically created
- **Close Function**: Dynamically removed

### 1.33 `weeklyReportModal`
- **ID**: `weeklyReportModal`
- **Purpose**: Weekly report display (dynamically created)
- **Open Function**: `showWeeklyReportModal(reportHtml, projectName)`
- **Close Function**: Dynamically removed

### 1.34 `quickCaptureModal`
- **ID**: `quickCaptureModal`
- **Purpose**: Quick capture input (dynamically created)
- **Open Function**: `openQuickCapture()`
- **Close Function**: Dynamically removed

### 1.35 `keyboardHelpModal`
- **ID**: `keyboardHelpModal`
- **Purpose**: Keyboard shortcuts help (dynamically created)
- **Open Function**: `showKeyboardHelp()`
- **Close Function**: Dynamically removed

### 1.36 `globalSearchModal`
- **ID**: `globalSearchModal`
- **Purpose**: Global search interface (dynamically created)
- **Open Function**: `openGlobalSearch()`
- **Close Function**: Dynamically removed

### 1.37 `quickExportModal`
- **ID**: `quickExportModal`
- **Purpose**: Quick export options (dynamically created)
- **Open Function**: `openQuickExport()`
- **Close Function**: Dynamically removed

### 1.38 `focusModeModal`
- **ID**: `focusModeModal`
- **Purpose**: Focus mode interface (dynamically created)
- **Open Function**: `openFocusMode()`
- **Close Function**: Dynamically removed

### 1.39 `ontologySuggestionsModal`
- **ID**: `ontologySuggestionsModal`
- **Purpose**: Ontology suggestions display
- **Open Function**: `openOntologyModal()`
- **Close Function**: `closeOntologyModal()`
- **Related**: `ontologySuggestionBadge` - Badge that opens modal

### 1.40 Generic Modal Close Function
- **Function**: `closeModal(modalId)` - Generic function to close any modal by ID

---

## 2. ALL TABS

### 2.1 Main Navigation Tabs
- **Container ID**: `quickTabs`
- **Container Class**: `tabs`
- **Function**: `setupTabs()` / `navigateTo(tabId)`
- **Tabs**:
  1. **Dashboard** - `data-tab="dashboard"` → Content panel: `panel-dashboard`
  2. **Chat/Q&A** - `data-tab="chat"` → Content panel: `panel-chat`
  3. **Source of Truth** - `data-tab="source-of-truth"` → Content panel: `panel-source-of-truth`
  4. **Timeline** - `data-tab="timeline"` → Content panel: `panel-timeline`
  5. **Org Chart** - `data-tab="org-chart"` → Content panel: `panel-org-chart`
  6. **File Logs** - `data-tab="file-logs"` → Content panel: `panel-file-logs`
  7. **Emails** - `data-tab="emails"` → Content panel: `panel-emails`
  8. **Contacts** - `data-tab="contacts"` → Content panel: `panel-contacts`
  9. **Graph DB** - `data-tab="graph-db"` → Content panel: `panel-graph-db`
  10. **Costs** - `data-tab="costs"` → Content panel: `panel-costs`
  11. **History** - `data-tab="history"` → Content panel: `panel-history`

### 2.2 Source of Truth View Tabs
- **Container**: Within `panel-source-of-truth`
- **Function**: `switchSOTView(view)`
- **Tabs**:
  1. **Document** - `data-view="document"` → Document view
  2. **Timeline** - `data-view="timeline"` → Timeline view
  3. **Insights** - `data-view="insights"` → Insights view
  4. **Graph** - `data-view="graph"` → Graph view
  5. **Confidence** - `data-view="confidence"` → Confidence view

### 2.3 Edit Role Modal Tabs
- **Container**: Within `editRoleModal`
- **Function**: `switchRoleTab(tabId)`
- **Tabs**:
  1. **Edit Role** - `data-tab="edit"` → Content: `roleTabEdit`
  2. **Templates** - `data-tab="templates"` → Content: `roleTabTemplates`
  3. **Perspectives** - `data-tab="perspective"` → Content: `roleTabPerspective`
  4. **Dashboard** - `data-tab="dashboard"` → Content: `roleTabDashboard`

### 2.4 Email Modal Tabs
- **Container**: Within `emailModal`
- **Function**: `switchEmailTab(tab)`
- **Tabs**:
  1. **Paste** - Button: `emailTabPaste` → Content: `emailPasteTab`
  2. **Upload** - Button: `emailTabUpload` → Content: `emailUploadTab`

### 2.5 Import Contacts Modal Tabs
- **Container**: Within `importContactsModal`
- **Function**: `showImportTab(tab)`
- **Tabs**:
  1. **CSV** - Button: `importTabCSV`
  2. **JSON** - Button: `importTabJSON`

### 2.6 Auth Modal Tabs
- **Container**: Within `authModal`
- **Function**: `switchAuthTab(tab)`
- **Tabs**:
  1. **Login** - Form: `loginForm`
  2. **Register** - Form: `registerForm`
  3. **Forgot Password** - Form: `forgotForm`

### 2.7 Team Modal Tabs
- **Container**: Within `teamModal`
- **Function**: `switchTeamTab(tab)`
- **Tabs**:
  1. **Members** - Button: `tabMembers` → Content: `membersTab`
  2. **Invites** - Button: `tabInvites` → Content: `invitesTab`

### 2.8 Developer Modal Tabs
- **Container**: Within `developerModal`
- **Function**: `switchDevTab(tab)`
- **Tabs**:
  1. **API Keys** - Button: `tabApiKeys` → Content: `apiKeysTab`
  2. **Webhooks** - Button: `tabWebhooks` → Content: `webhooksTab`
  3. **Audit Export** - Button: `tabAudit` → Content: `auditTab`
  4. **Graph Sync** - Button: `tabSync` → Content: `syncTab`

### 2.9 Source Viewer Modal Tabs
- **Container**: Within `sourceViewerModal`
- **Function**: `switchSourceView(view)`
- **Tabs**:
  1. **Both** - `data-view="both"` → Shows both views
  2. **Original** - `data-view="raw"` → Original view
  3. **Processed** - `data-view="processed"` → Processed view

---

## 3. ALL DROPDOWN MENUS

### 3.1 Project Dropdown
- **ID**: `projectDropdown`
- **Toggle Function**: `toggleProjectDropdown()`
- **Close Function**: `closeProjectDropdown()`
- **Trigger Button**: `projectSelectorBtn` (`project-selector-btn` class)
- **Items**:
  - Header: "Switch Project"
  - Project list: `projectList` (dynamically populated)
  - Footer buttons:
    - Edit My Role (opens `editRoleModal`)
    - New Project (opens `newProjectModal`)
    - Import Project (calls `importProject()`)

### 3.2 User Dropdown
- **ID**: `userDropdown`
- **Toggle Function**: `toggleUserMenu()`
- **Close Function**: `closeUserDropdown()`
- **Trigger Button**: User menu button in header
- **Items**:
  - Header section:
    - `userDropdownName` - User display name
    - `userDropdownEmail` - User email
    - `userRoleBadge` - Role badge (optional)
  - Menu items:
    - Profile (calls `openUserProfile()`)
    - Team & Invites (calls `openTeamModal()`)
    - Activity (calls `openActivityModal()`)
    - Notifications (calls `openNotificationsModal()`)
    - Developer (calls `openDeveloperModal()`)
    - Settings (opens `settingsModal`)
    - Logout (calls logout function)

### 3.3 Quick Actions Dropdown
- **ID**: `quickActionsMenu`
- **Toggle Function**: `toggleQuickActionsMenu()`
- **Close Function**: `closeQuickActionsMenu()`
- **Trigger Button**: `quickActionsBtn`
- **Sections**:
  1. **Create**:
     - Quick Capture (calls `openQuickCapture()`)
  2. **View**:
     - Focus Mode (calls `openFocusMode()`)
     - Global Search (calls `openGlobalSearch()`)
  3. **Generate**:
     - Weekly Report (calls `generateWeeklyReport()`)
     - Detect Conflicts (calls `detectConflicts()`)
     - Daily Briefing (calls `loadBriefing()`)
  4. **Export**:
     - Quick Export (calls `openQuickExport()`)
  5. **Preferences**:
     - Toggle Theme (calls `toggleTheme()`)
     - Keyboard Help (calls `showKeyboardHelp()`)

### 3.4 Source of Truth Export Dropdown
- **ID**: `sotExportMenu`
- **Toggle Function**: `toggleExportMenu()`
- **Container**: `.dropdown` wrapper
- **Trigger Button**: "Export ▾" button
- **Items**:
  - Markdown (calls `exportSOT('markdown')`)
  - HTML (calls `exportSOT('html')`)
  - JSON (calls `exportSOT('json')`)
  - PDF (calls `exportToPDF()`)

### 3.5 Model Selection Dropdowns (Settings)
- **IDs**: 
  - `llmTextModel` - Text model dropdown
  - `llmVisionModel` - Vision model dropdown
  - `llmEmbeddingsModel` - Embeddings model dropdown
- **Change Function**: `onModelDropdownChange(task)` where task is 'text', 'vision', or 'embeddings'
- **Purpose**: Select LLM models for different tasks
- **Populate Function**: `populateTaskProviderDropdowns()`

### 3.6 Saved Searches Dropdown (Global Search)
- **ID**: `savedSearchesDropdown`
- **Change Function**: `onSavedSearchSelect(this)`
- **Update Function**: `updateSavedSearchesDropdown()`
- **Purpose**: Load saved search queries
- **Location**: Within `globalSearchModal`

### 3.7 Date Filter Dropdown (Global Search)
- **ID**: `globalSearchDateFilter`
- **Purpose**: Filter searches by date range
- **Location**: Within `globalSearchModal`

### 3.8 Owner Filter Dropdown (Global Search)
- **ID**: `globalSearchOwnerFilter`
- **Purpose**: Filter searches by owner
- **Location**: Within `globalSearchModal`

### 3.9 Source of Truth Category Filter
- **ID**: `sotCategoryFilter`
- **Change Function**: `filterSOT()`
- **Options**:
  - All Categories
  - Technical
  - Business
  - Process
  - Requirement
  - (and more categories)

### 3.10 RAG Embedding Provider Dropdown
- **ID**: (Referenced in code for RAG settings)
- **Populate Function**: Populated dynamically for embedding provider selection
- **Purpose**: Select embedding provider for RAG

---

## Summary Statistics

- **Total Modals**: 39 modals (including dynamically created ones)
- **Total Tab Systems**: 9 tab systems
- **Total Dropdown Menus**: 10 dropdown menus

---

## Notes

- Many modals use the generic `closeModal(modalId)` function
- Some modals are dynamically created and removed (not in static HTML)
- Tab systems use various functions: `navigateTo()`, `switchRoleTab()`, `switchEmailTab()`, `switchAuthTab()`, `switchTeamTab()`, `switchDevTab()`, `switchSOTView()`, `switchSourceView()`, `showImportTab()`
- Dropdowns typically use `toggle` and `close` function pairs
- Most dropdowns close when clicking outside (event listeners attached)
