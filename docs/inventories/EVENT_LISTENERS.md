# Event Listeners and Handlers Inventory
## File: `src/public/index.html`

**Analysis Date:** January 31, 2026  
**Total Event Handlers Found:** 500+ (380 onclick, 43 onchange, 2 onsubmit, 9 drag/drop, 24 addEventListener, 1 onkeypress, 1 onkeyup, 15+ mouse events)

---

## Summary by Category

| Category | Count | Details |
|----------|-------|---------|
| **Keyboard Shortcuts** | 8 | keydown listeners on document |
| **Form Events** | 45 | onsubmit (2), onchange (43) |
| **Mouse Events** | 395+ | onclick (380), onmouseover/onmouseout (15+) |
| **Drag and Drop** | 13 | 5 addEventListener + 8 inline handlers |
| **Window/Document Events** | 6 | DOMContentLoaded (2), click (4) |
| **Other** | 1 | onkeypress, onkeyup |

---

## 1. Keyboard Shortcuts (keydown, keyup, keypress)

### Document-Level Keyboard Listeners (addEventListener)

#### Line 17993: Command Palette & Navigation
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function handling multiple shortcuts:
  - `Ctrl+K` / `Cmd+K`: Toggle command palette
  - `Escape`: Close modals/palette
  - `ArrowDown/ArrowUp`: Navigate command palette
  - `Enter`: Execute selected command
  - `Ctrl+1-6`: Quick navigation to sections (dashboard, chat, facts, questions-by-person, risks, actions)

#### Line 18451: Quick Capture & Help
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function:
  - `Ctrl+N` / `Cmd+N`: Open quick capture
  - `Ctrl+?` / `Ctrl+/`: Show keyboard shortcuts help

#### Line 18602: Undo Functionality
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function:
  - `Ctrl+Z` / `Cmd+Z`: Perform undo (skips if in input/textarea)

#### Line 18764: Modal & Save Shortcuts
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function:
  - `Escape`: Close all visible modals
  - `Ctrl+S` / `Cmd+S`: Prevent default save (could trigger save action)

#### Line 19127: Global Search
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function:
  - `Ctrl+F` / `Cmd+F`: Open global search

#### Line 19241: Quick Export
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function:
  - `Ctrl+E` / `Cmd+E`: Open quick export modal

#### Line 19391: Focus Mode
- **Event:** `keydown`
- **Target:** `document`
- **Handler:** Anonymous function:
  - `Ctrl+Shift+F` / `Cmd+Shift+F`: Open focus mode

### Modal-Level Keyboard Listeners

#### Line 18346: Quick Capture Modal
- **Event:** `keydown`
- **Target:** `modal` (dynamically created)
- **Handler:** Anonymous function:
  - `Escape`: Remove modal
  - `Ctrl+Enter`: Submit quick capture

### Inline Keyboard Handlers

#### Line 3001: SOT Search Input
- **Event:** `onkeyup`
- **Target:** `#sotSearchInput`
- **Handler:** `searchSOT()`
- **Purpose:** Search Source of Truth as user types

#### Line 3090: SOT Chat Input
- **Event:** `onkeypress`
- **Target:** `#sotChatInput`
- **Handler:** `if(event.key==='Enter')sendSOTChat()`
- **Purpose:** Send chat message on Enter key

---

## 2. Form Events (submit, change, input)

### Form Submit Handlers (onsubmit)

#### Line 2388: Mandatory Login Form
- **Event:** `onsubmit`
- **Target:** `.login-form` (mandatory login)
- **Handler:** `handleMandatoryLogin(event)`
- **Purpose:** Handle mandatory login submission

#### Line 2420: Create First Project Form
- **Event:** `onsubmit`
- **Target:** `.login-form` (create project)
- **Handler:** `handleCreateFirstProject(event)`
- **Purpose:** Handle first project creation

### Change Handlers (onchange) - 43 instances

#### Select Dropdowns (Filter & Navigation)
- **Line 2974:** `#sotTemplateSelect` → `changeSOTTemplate()`
- **Line 3004:** `#sotCategoryFilter` → `filterSOT()`
- **Line 3011:** `#sotPersonFilter` → `filterSOT()`
- **Line 3014:** `#sotDateFilter` → `filterSOT()`
- **Line 3337:** `#questionsFilter` → `loadQuestionsByPerson()`
- **Line 3416:** `#risksFilter` → `loadRisks()`
- **Line 3456:** `#actionsFilter` → `loadActions()`

#### Bulk Selection Checkboxes
- **Line 3372:** `.bulk-select-all` (facts) → `toggleSelectAll('facts', this.checked)`
- **Line 3427:** `.bulk-select-all` (risks) → `toggleSelectAll('risks', this.checked)`
- **Line 3467:** `.bulk-select-all` (actions) → `toggleSelectAll('actions', this.checked)`

#### File Input Handlers
- **Line 2703:** `#fileInputDocuments` → `handleFileSelect(event, 'newinfo')`
- **Line 2720:** `#fileInputTranscripts` → `handleFileSelect(event, 'newtranscripts')`

#### Relationship Modal Dropdowns (addEventListener)
- **Line 17721:** `#relFromContact` → `updateRelationshipPreview`
- **Line 17722:** `#relToContact` → `updateRelationshipPreview`

#### Org Chart Layout Select (addEventListener)
- **Line 17613:** `layoutSelect` → `loadOrgChart()`

*(Note: Many more onchange handlers exist throughout the file - 43 total instances found)*

---

## 3. Mouse Events (click, mouseover, mouseout)

### Click Handlers (onclick) - 380 instances

#### Navigation & UI Controls
- **Line 2441:** `.mobile-menu-btn` → `toggleMobileSidebar()`
- **Line 2451:** `#projectSelectorBtn` → `toggleProjectDropdown()`
- **Line 2506:** `#quickActionsBtn` → `toggleQuickActionsMenu()`
- **Line 2563:** Settings button → `openSettings()`
- **Line 2567:** Notifications button → `openNotificationsModal()`
- **Line 2578:** `#userMenuBtn` → `toggleUserMenu()`
- **Line 2639:** `#loginBtn` → `openLoginModal()`
- **Line 2653:** `.sidebar-close-btn` → `closeMobileSidebar()`

#### Quick Actions Menu Items
- **Line 2519:** Quick Capture → `openQuickCapture(); closeQuickActionsMenu();`
- **Line 2525:** Focus Mode → `openFocusMode(); closeQuickActionsMenu();`
- **Line 2529:** Global Search → `openGlobalSearch(); closeQuickActionsMenu();`
- **Line 2535:** Weekly Report → `generateWeeklyReport(); closeQuickActionsMenu();`
- **Line 2538:** Detect Conflicts → `detectConflicts(); closeQuickActionsMenu();`
- **Line 2541:** Load Briefing → `loadBriefing(); closeQuickActionsMenu();`
- **Line 2547:** Quick Export → `openQuickExport(); closeQuickActionsMenu();`
- **Line 2553:** Toggle Theme → `toggleTheme(); closeQuickActionsMenu();`
- **Line 2556:** Keyboard Help → `showKeyboardHelp(); closeQuickActionsMenu();`

#### User Menu Items
- **Line 2597:** User Profile → `openUserProfile()`
- **Line 2604:** Team Modal → `openTeamModal()`
- **Line 2613:** Activity Modal → `openActivityModal()`
- **Line 2619:** Developer Modal → `openDeveloperModal()`
- **Line 2626:** Logout → `logout()`

#### Project Management
- **Line 2472:** Edit Role → `openEditRoleModal()`
- **Line 2479:** New Project → `openNewProjectModal()`
- **Line 2486:** Import Project → `importProject()`

#### Processing & Export
- **Line 2659:** `#processBtn` → `startProcessing()`
- **Line 2663:** Export Knowledge → `exportKnowledge()`
- **Line 2666:** Copy Knowledge → `copyKnowledgeToClipboard()`
- **Line 2671:** Export Questions → `exportQuestions()`
- **Line 2674:** Copy Questions → `copyQuestionsToClipboard()`
- **Line 2678:** Copy Overdue → `copyOverdueToClipboard()`
- **Line 2681:** Clean Orphan Data → `cleanOrphanData()`
- **Line 2684:** Reset → `confirmReset()`

#### File Upload Drop Zones
- **Line 2701:** `#dropZoneDocuments` → `document.getElementById('fileInputDocuments').click()`
- **Line 2718:** `#dropZoneTranscripts` → `document.getElementById('fileInputTranscripts').click()`

#### Dashboard Navigation Cards
- **Line 2780:** Dashboard link → `navigateTo('dashboard')`
- **Line 2803:** Facts card → `navigateTo('facts')`
- **Line 2807:** Questions card → `navigateTo('questions-by-person')`
- **Line 2811:** Decisions card → `navigateTo('decisions')`
- **Line 2815:** Risks card → `navigateTo('risks')`
- **Line 2819:** Actions card → `navigateTo('actions')`

#### Briefing & Heatmap
- **Line 2832:** Refresh Briefing → `loadBriefing(true)`
- **Line 2930-2940:** Heatmap cells (9 cells) → `showHeatmapRisks(impact, likelihood)`
  - `hm-high-low`, `hm-high-medium`, `hm-high-high`
  - `hm-medium-low`, `hm-medium-medium`, `hm-medium-high`
  - `hm-low-low`, `hm-low-medium`, `hm-low-high`

#### Source of Truth (SOT) Controls
- **Line 2980:** SOT Chat toggle → `toggleSOTChat()`
- **Line 2981:** SOT Versions → `showSOTVersions()`
- **Line 2983:** Export Menu toggle → `toggleExportMenu()`
- **Line 2985:** Export Markdown → `exportSOT('markdown')`
- **Line 2986:** Export HTML → `exportSOT('html')`
- **Line 2987:** Export JSON → `exportSOT('json')`
- **Line 2988:** Export PDF → `exportToPDF()`
- **Line 3019-3023:** SOT View tabs (5 tabs) → `switchSOTView(view)`
  - `'document'`, `'timeline'`, `'insights'`, `'graph'`, `'confidence'`
- **Line 3034:** Regenerate Summary → `regenerateExecutiveSummary()`
- **Line 3080:** Close SOT Chat → `toggleSOTChat()`
- **Line 3091:** Send SOT Chat → `sendSOTChat()`
- **Line 3100:** Close Versions Modal → `closeSOTVersionsModal()`

#### Bulk Operations
- **Line 3364:** Export Facts → `bulkExport('facts')`
- **Line 3365:** Delete Facts → `bulkDelete('facts')`
- **Line 3366:** Clear Facts Selection → `clearSelection('facts')`
- **Line 3407:** Mark Risks Mitigated → `bulkUpdateStatus('risks', 'mitigated')`
- **Line 3408:** Export Risks → `bulkExport('risks')`
- **Line 3409:** Delete Risks → `bulkDelete('risks')`
- **Line 3410:** Clear Risks Selection → `clearSelection('risks')`
- **Line 3447:** Mark Actions Completed → `bulkUpdateStatus('actions', 'completed')`
- **Line 3448:** Export Actions → `bulkExport('actions')`
- **Line 3449:** Delete Actions → `bulkDelete('actions')`
- **Line 3450:** Clear Actions Selection → `clearSelection('actions')`

#### Email & Conversation Modals
- **Line 2732:** Email Modal → `openEmailModal()`
- **Line 2744:** Conversation Modal → `openConversationModal()`

*(Note: Hundreds more onclick handlers exist throughout the file - 380 total instances found)*

### Mouse Hover Handlers (onmouseover/onmouseout)

#### Dashboard Stat Cards (5 cards with hover effects)
- **Line 2803:** Facts card
  - `onmouseover`: `this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 15px rgba(233,69,96,0.3)'`
  - `onmouseout`: `this.style.transform='scale(1)'; this.style.boxShadow='none'`
- **Line 2807:** Questions card
  - `onmouseover`: `this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 15px rgba(255,230,109,0.3)'`
  - `onmouseout`: `this.style.transform='scale(1)'; this.style.boxShadow='none'`
- **Line 2811:** Decisions card
  - `onmouseover`: `this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 15px rgba(78,205,196,0.3)'`
  - `onmouseout`: `this.style.transform='scale(1)'; this.style.boxShadow='none'`
- **Line 2815:** Risks card
  - `onmouseover`: `this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 15px rgba(255,107,107,0.3)'`
  - `onmouseout`: `this.style.transform='scale(1)'; this.style.boxShadow='none'`
- **Line 2819:** Actions card
  - `onmouseover`: `this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 15px rgba(155,89,182,0.3)'`
  - `onmouseout`: `this.style.transform='scale(1)'; this.style.boxShadow='none'`

### Document-Level Click Listeners (addEventListener)

#### Line 6144: Project Dropdown Close
- **Event:** `click`
- **Target:** `document`
- **Handler:** Anonymous function that closes project dropdown when clicking outside
- **Purpose:** Close `.project-selector` dropdown when clicking outside

#### Line 6382: Quick Actions Menu Close
- **Event:** `click`
- **Target:** `document`
- **Handler:** Anonymous function that closes quick actions menu when clicking outside
- **Purpose:** Close `#quickActionsMenu` when clicking outside menu and button

#### Line 13040: SOT Export Menu Close
- **Event:** `click`
- **Target:** `document`
- **Handler:** Anonymous function that closes SOT export menu when clicking outside
- **Purpose:** Close `#sotExportMenu` when clicking outside dropdown

#### Line 16663: User Menu Close
- **Event:** `click`
- **Target:** `document`
- **Handler:** Anonymous function that closes user menu when clicking outside
- **Purpose:** Close `#userMenuContainer` when clicking outside

### Element-Level Click Listeners (addEventListener)

#### Line 7233: Tab Navigation
- **Event:** `click`
- **Target:** All `.tab` elements
- **Handler:** Anonymous function calling `navigateTo(tab.dataset.tab)`
- **Purpose:** Switch between application tabs

#### Line 13150: Person Selection (Questions by Person)
- **Event:** `click`
- **Target:** All `.person-item` elements
- **Handler:** Anonymous function that sets `selectedPerson` and reloads questions
- **Purpose:** Filter questions by selected person

---

## 4. Drag and Drop Events

### Inline Drag Handlers (8 instances)

#### Document Drop Zones
- **Line 2698:** `#dropZoneDocuments`
  - `ondrop`: `handleDrop(event, 'newinfo')`
  - `ondragover`: `handleDragOver(event)`
  - `ondragleave`: `handleDragLeave(event)`

- **Line 2715:** `#dropZoneTranscripts`
  - `ondrop`: `handleDrop(event, 'newtranscripts')`
  - `ondragover`: `handleDragOver(event)`
  - `ondragleave`: `handleDragLeave(event)`

### Dynamic Drag Handlers (addEventListener) - LLM Provider Priority

#### Line 8094-8117: Provider List Items (5 handlers per item)
- **Event:** `dragstart`
- **Target:** Provider list items (dynamically created)
- **Handler:** Sets `dataTransfer` data and reduces opacity
- **Purpose:** Start dragging LLM provider to reorder priority

- **Event:** `dragend`
- **Target:** Provider list items
- **Handler:** Restores opacity
- **Purpose:** End drag operation

- **Event:** `dragover`
- **Target:** Provider list items
- **Handler:** Prevents default and shows visual indicator (border)
- **Purpose:** Allow drop and show drop target

- **Event:** `dragleave`
- **Target:** Provider list items
- **Handler:** Removes visual indicator
- **Purpose:** Clean up when leaving drop target

- **Event:** `drop`
- **Target:** Provider list items
- **Handler:** Prevents default, reorders items, updates priority
- **Purpose:** Complete drag-and-drop reordering

---

## 5. Window/Document Events

### DOMContentLoaded Listeners

#### Line 6120: Main Application Initialization
- **Event:** `DOMContentLoaded`
- **Target:** `document`
- **Handler:** Anonymous function that initializes the entire application:
  - `checkAuthStatus()`
  - `loadCurrentProject()`
  - `loadConfig()`
  - `loadStats()`
  - `loadDashboard()`
  - `loadPendingFiles()`
  - `loadConversations()`
  - `loadSourceOfTruth()`
  - `loadQuestionsByPerson()`
  - `loadFacts()`
  - `loadDecisions()`
  - `loadRisks()`
  - `loadRiskHeatmap()`
  - `loadTrendIndicators()`
  - `loadActions()`
  - `loadTimeline()`
  - `loadPeople()`
  - `loadOrgChart()`
  - `loadFileLogs()`
  - `loadHistory()`
  - `setupTabs()`
  - Sets up project dropdown close handler

#### Line 17718: Relationship Modal Initialization
- **Event:** `DOMContentLoaded`
- **Target:** `document`
- **Handler:** Anonymous function that sets up relationship modal dropdown handlers:
  - `#relFromContact` change handler
  - `#relToContact` change handler

---

## 6. Other Events

### Modal Click Handlers (onclick on modal backdrop)
- Multiple dynamically created modals use: `modal.onclick = (e) => { if (e.target === modal) modal.remove(); }`
- Examples:
  - Quick Export Modal (Line 19144)
  - Focus Mode Modal (Line 19258)

---

## Statistics Summary

### Total Event Handlers by Type

| Event Type | Count | Method |
|------------|-------|--------|
| `click` | 380+ | Inline (onclick) |
| `change` | 43 | Inline (onchange) |
| `keydown` | 8 | addEventListener |
| `keyup` | 1 | Inline (onkeyup) |
| `keypress` | 1 | Inline (onkeypress) |
| `submit` | 2 | Inline (onsubmit) |
| `dragstart` | Multiple | addEventListener (dynamic) |
| `dragend` | Multiple | addEventListener (dynamic) |
| `dragover` | Multiple | addEventListener + inline |
| `dragleave` | Multiple | addEventListener + inline |
| `drop` | Multiple | addEventListener + inline |
| `mouseover` | 5 | Inline (onmouseover) |
| `mouseout` | 5 | Inline (onmouseout) |
| `DOMContentLoaded` | 2 | addEventListener |

### Handler Distribution

- **Inline Handlers:** ~440+ instances
- **addEventListener:** 24 instances
- **Dynamic Handlers:** Multiple (created at runtime for drag-and-drop)

### Most Common Patterns

1. **Navigation:** `onclick="navigateTo('section')"` - Used extensively for tab/section switching
2. **Modal Management:** Multiple `onclick` handlers for opening/closing modals
3. **Bulk Operations:** `onclick` handlers for bulk export/delete/update operations
4. **Filtering:** `onchange` handlers on select dropdowns for filtering content
5. **Keyboard Shortcuts:** `keydown` listeners on document for global shortcuts
6. **Click Outside:** `click` listeners on document to close dropdowns/modals

---

## Recommendations

1. **Consider Event Delegation:** Many click handlers could be consolidated using event delegation
2. **Extract Inline Handlers:** Move inline handlers to JavaScript for better maintainability
3. **Consolidate Keyboard Shortcuts:** Multiple `keydown` listeners could be unified into one handler
4. **Document Handler Dependencies:** Some handlers depend on specific DOM structure - document these dependencies
5. **Consider Framework:** With 500+ event handlers, consider using a framework (React, Vue, etc.) for better state and event management

---

## Notes

- This inventory was generated by analyzing the HTML file structure
- Some handlers may be dynamically created at runtime and not visible in static analysis
- Handler counts are approximate based on grep pattern matching
- Line numbers are approximate and may shift with file edits
- Some handlers may be conditionally attached based on application state
