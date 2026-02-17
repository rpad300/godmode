# Global Variables and Shared State Inventory
## File: `src/public/index.html`

Complete inventory of all global variables and shared state declared at script top level.

---

## 1. Application State (Project, User, Auth)

### `currentProjectId`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores the ID of the currently active project
- **Read by:** `loadCurrentProject()`, `activateProject()`, `loadProjectList()`, `switchProject()`, `reloadAllData()`, `getUndoStackKey()`, `pushUndo()`, `getSavedSearches()`, `saveSavedSearches()`, and many other functions that need project context
- **Modified by:** `loadCurrentProject()`, `activateProject()`, `switchProject()`

### `projectToDelete`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Temporarily stores project ID pending deletion confirmation
- **Read by:** `confirmDeleteProject()`
- **Modified by:** `openDeleteProjectModal()`, `confirmDeleteProject()`

### `currentUser`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores authenticated user information
- **Read by:** `checkAuthStatus()`, `loadUserProfile()`, `updateUserProfile()`, `displayUserInfo()`
- **Modified by:** `checkAuthStatus()`, `handleLogin()`, `handleSignup()`, `handleLogout()`

### `authConfigured`
- **Type:** `let`
- **Initial Value:** `false`
- **Purpose:** Tracks whether authentication is configured/enabled
- **Read by:** `checkAuthStatus()`, `initAuthUI()`
- **Modified by:** `checkAuthStatus()`, `loadConfig()`

### `config`
- **Type:** `let`
- **Initial Value:** `{ ollama: {} }`
- **Purpose:** Stores application configuration (LLM providers, prompts, settings, etc.)
- **Read by:** `loadConfig()`, `initApiKeysUI()`, `updateConfiguredProvidersCount()`, `initLLMProviderUI()`, `loadLLMProviderUI()`, `initPromptModes()`, `testConnection()`, `loadRecommendedModels()`, and many configuration-related functions
- **Modified by:** `loadConfig()`, `saveLLMConfig()`, `saveOllamaConfig()`, `savePrompts()`, `saveSettings()`

---

## 2. UI State (Current Tab, Modals, Views)

### `currentDevTab`
- **Type:** `let`
- **Initial Value:** `'apikeys'`
- **Purpose:** Tracks active tab in developer modal (apikeys, webhooks, audit, sync)
- **Read by:** `switchDevTab()`
- **Modified by:** `switchDevTab()`, `openDeveloperModal()`

### `sotCurrentView`
- **Type:** `let`
- **Initial Value:** `'document'`
- **Purpose:** Tracks current Source of Truth view (document, timeline, insights, graph, confidence)
- **Read by:** `switchSOTView()`, `renderSOTContent()`
- **Modified by:** `switchSOTView()`

### `sotCurrentTemplate`
- **Type:** `let`
- **Initial Value:** `'full'`
- **Purpose:** Tracks current Source of Truth template selection
- **Read by:** `changeSOTTemplate()`, `renderSOTContent()`
- **Modified by:** `changeSOTTemplate()`

### `selectedPerson`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores currently selected person in Questions by Person view
- **Read by:** `loadQuestionsByPerson()`, `filterQuestionsByPerson()`, `renderQuestionsByPerson()`, `selectPerson()`
- **Modified by:** `selectPerson()`, `clearPersonFilter()`

### `selectedEmlFile`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores selected .eml file for email processing
- **Read by:** `processEmlFile()`, `handleEmlFileSelect()`
- **Modified by:** `handleEmlFileSelect()`, `openEmailModal()`

### `currentEmailForResponse`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores email data for generating AI responses
- **Read by:** `generateEmailResponse()`, `markCurrentEmailResponded()`
- **Modified by:** `generateEmailResponse()`, `openEmailResponseModal()`

### `dismissSelectedReason`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores reason for dismissing a question
- **Read by:** `confirmDismissQuestion()`
- **Modified by:** `showDismissQuestionModal()`, `confirmDismissQuestion()`

---

## 3. Data Caches (Facts, Questions, Risks, etc.)

### `questionsData`
- **Type:** `let`
- **Initial Value:** `{}`
- **Purpose:** Caches questions data organized by person/assignee for filtering
- **Read by:** `loadQuestionsByPerson()`, `filterQuestionsByPerson()`, `renderQuestionsByPerson()`, `getTotalQuestionsCount()`
- **Modified by:** `loadQuestionsByPerson()`, `reloadAllData()`

### `questionsDataAll`
- **Type:** `let`
- **Initial Value:** `{}`
- **Purpose:** Stores unfiltered questions data (backup for filtering operations)
- **Read by:** `loadQuestionsByPerson()`, `filterQuestionsByPerson()`
- **Modified by:** `loadQuestionsByPerson()`, `reloadAllData()`

### `allPeopleData`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches all people/contacts data for questions assignment
- **Read by:** `loadQuestionsByPerson()`, `renderQuestionsByPerson()`, `renderPersonSidebar()`, `selectPerson()`
- **Modified by:** `loadQuestionsByPerson()`, `reloadAllData()`

### `cachedRisks`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches filtered risks (excluding closed) for heatmap rendering
- **Read by:** `loadRiskHeatmap()`, `renderRiskHeatmap()`, `filterRiskHeatmap()`
- **Modified by:** `loadRiskHeatmap()`

### `sotEnhancedData`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Caches enhanced Source of Truth data with graph relationships
- **Read by:** `loadSourceOfTruth()`, `renderSOTContent()`, `switchSOTView()`, `changeSOTTemplate()`
- **Modified by:** `loadSourceOfTruth()`

### `sotOriginalMarkdown`
- **Type:** `let`
- **Initial Value:** `''`
- **Purpose:** Stores original markdown content for Source of Truth
- **Read by:** `loadSourceOfTruth()`, `switchSOTView()`, `renderMarkdownContent()`
- **Modified by:** `loadSourceOfTruth()`

### `globalSearchData`
- **Type:** `let`
- **Initial Value:** `{ facts: [], questions: [], risks: [], decisions: [], actions: [] }`
- **Purpose:** Caches all searchable data for global search functionality
- **Read by:** `openGlobalSearch()`, `performGlobalSearch()`, `renderGlobalSearchResults()`
- **Modified by:** `openGlobalSearch()`, `reloadAllData()`

### `globalSearchFilter`
- **Type:** `let`
- **Initial Value:** `'all'`
- **Purpose:** Tracks current filter type in global search (all, facts, questions, risks, decisions, actions)
- **Read by:** `performGlobalSearch()`, `filterGlobalSearch()`, `saveCurrentSearch()`
- **Modified by:** `filterGlobalSearch()`, `clearSearchFilters()`, `openGlobalSearch()`

### `roleTemplatesCache`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Caches role templates data to avoid repeated API calls
- **Read by:** `loadRoleTemplates()`, `filterRoleTemplates()`, `applyRoleTemplate()`
- **Modified by:** `loadRoleTemplates()`

### `allContacts`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches all contacts for quick lookup and filtering
- **Read by:** `loadContacts()`, `renderContactsGrid()`, `filterContacts()`, `openContactModal()`, `saveContact()`, `deleteContact()`, `renderOrgChart()`
- **Modified by:** `loadContacts()`, `saveContact()`, `deleteContact()`, `importContactsJSON()`

### `allTeams`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches all teams for quick lookup and filtering
- **Read by:** `loadContacts()`, `loadTeams()`, `renderTeamsDropdown()`, `saveContact()`, `renderContactModal()`, `renderOrgChart()`, `loadTeamMembers()`
- **Modified by:** `loadTeams()`, `saveTeam()`, `deleteTeam()`, `importContactsJSON()`

### `allTimezones`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches timezone data for contact forms
- **Read by:** `loadTimezones()`, `renderTimezoneSelect()`
- **Modified by:** `loadTimezones()`

### `emailAttachments`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Stores email attachments for current email being processed
- **Read by:** `openEmailModal()`, `handleEmailAttachments()`, `renderEmailAttachments()`, `removeEmailAttachment()`, `processEmail()`
- **Modified by:** `openEmailModal()`, `handleEmailAttachments()`, `removeEmailAttachment()`

### `chatHistory`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Stores chat conversation history
- **Read by:** `initChat()`, `sendChatMessage()`, `renderChatHistory()`
- **Modified by:** `initChat()`, `sendChatMessage()`, `clearChat()`

### `chatContext`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores loaded chat context for AI responses
- **Read by:** `loadChatContext()`, `sendChatMessage()`
- **Modified by:** `loadChatContext()`, `clearChat()`

### `chatContextLoaded`
- **Type:** `let`
- **Initial Value:** `false`
- **Purpose:** Tracks whether chat context has been loaded
- **Read by:** `initChat()`, `sendChatMessage()`, `loadChatContext()`, `clearChat()`
- **Modified by:** `initChat()`, `loadChatContext()`, `clearChat()`, `reloadAllData()`

### `availableModels`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches list of available Ollama models
- **Read by:** `loadAvailableModels()`, `isModelAvailable()`, `loadRecommendedModels()`
- **Modified by:** `loadAvailableModels()`

### `orgChartData`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Caches organization chart data (nodes, edges, stats)
- **Read by:** `loadOrgChart()`, `filterOrgChartByTeam()`, `renderOrgChart()`
- **Modified by:** `loadOrgChart()`

### `ontologySuggestions`
- **Type:** `let`
- **Initial Value:** `[]`
- **Purpose:** Caches ontology suggestions for graph database
- **Read by:** `checkOntologySuggestions()`, `renderOntologySuggestions()`
- **Modified by:** `checkOntologySuggestions()`

---

## 4. Chart/Visualization Instances

### `questionsChart`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Chart.js instance for questions priority chart
- **Read by:** `renderQuestionsChart()`, `loadDashboard()`
- **Modified by:** `renderQuestionsChart()`

### `risksChart`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Chart.js instance for risks impact chart
- **Read by:** `renderRisksChart()`, `loadDashboard()`
- **Modified by:** `renderRisksChart()`

### `graphDbNetwork`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** vis.js network instance for graph database visualization
- **Read by:** `loadGraphDBPage()`, `runCypherQuery()`, `renderGraphDB()`
- **Modified by:** `loadGraphDBPage()`, `runCypherQuery()`, `renderGraphDB()`

### `orgChartNetwork`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** vis.js network instance for organization chart visualization
- **Read by:** `loadOrgChart()`, `filterOrgChartByTeam()`, `fitOrgChart()`
- **Modified by:** `loadOrgChart()`, `filterOrgChartByTeam()`

---

## 5. Processing/Timing State

### `processingInterval`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores interval ID for periodic data processing/refresh
- **Read by:** `startProcessingInterval()`, `stopProcessingInterval()`
- **Modified by:** `startProcessingInterval()`, `stopProcessingInterval()`

### `lastKnownStats`
- **Type:** `let`
- **Initial Value:** `null`
- **Purpose:** Stores last known statistics for change detection
- **Read by:** `checkAndRefresh()`
- **Modified by:** `checkAndRefresh()`

---

## 6. Configuration Constants

### `PROVIDER_LABELS`
- **Type:** `const`
- **Initial Value:** Object mapping provider IDs to display names
- **Purpose:** Human-readable labels for LLM providers
- **Read by:** `initApiKeysUI()`, `loadLLMProviderUI()`, `initLLMProviderUI()`
- **Modified by:** None (constant)

### `API_PROVIDERS`
- **Type:** `const`
- **Initial Value:** `['openai', 'gemini', 'grok', 'deepseek', 'claude', 'kimi', 'minimax', 'genspark']`
- **Purpose:** List of API-based LLM providers (excludes Ollama)
- **Read by:** `initApiKeysUI()`, `updateConfiguredProvidersCount()`, `testAllApiKeys()`, `saveAllApiKeys()`, `loadLLMProviderUI()`, `initLLMProviderUI()`
- **Modified by:** None (constant)

### `PROVIDER_CAPABILITIES`
- **Type:** `const`
- **Initial Value:** Object mapping provider IDs to capability flags (text, vision, embeddings)
- **Purpose:** Defines which capabilities each provider supports
- **Read by:** `loadLLMProviderUI()`, `initLLMProviderUI()`, `renderLLMProviderSettings()`
- **Modified by:** None (constant)

### `colorPalette`
- **Type:** `const`
- **Initial Value:** `['#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#e74c3c', '#2ecc71', '#f39c12', '#16a085']`
- **Purpose:** Color palette for person/assignee visualization
- **Read by:** `renderQuestionsByPerson()`, `renderPersonSidebar()`, `selectPerson()`
- **Modified by:** None (constant)

### `UNDO_STACK_KEY_PREFIX`
- **Type:** `const`
- **Initial Value:** `'godmode_undo_stack_'`
- **Purpose:** Prefix for localStorage undo stack keys
- **Read by:** `getUndoStackKey()`
- **Modified by:** None (constant)

### `UNDO_MAX_SIZE`
- **Type:** `const`
- **Initial Value:** `20`
- **Purpose:** Maximum number of undo actions to store
- **Read by:** `saveUndoStack()`
- **Modified by:** None (constant)

---

## 7. Window Object Properties (Global State)

### `window.previousStats`
- **Type:** Property on `window` object
- **Initial Value:** `undefined` (set to stats object after first load)
- **Purpose:** Stores previous statistics for trend comparison
- **Read by:** `loadTrendIndicators()`
- **Modified by:** `loadTrendIndicators()`

### `window.weeklyReportMarkdown`
- **Type:** Property on `window` object
- **Initial Value:** `undefined` (set when report is generated)
- **Purpose:** Stores generated weekly report markdown for clipboard access
- **Read by:** `copyWeeklyReport()`, `printWeeklyReport()`
- **Modified by:** `generateWeeklyReport()`

---

## Summary Statistics

- **Total Global Variables:** 42
- **Application State:** 5 variables
- **UI State:** 7 variables
- **Data Caches:** 18 variables
- **Chart/Visualization Instances:** 4 variables
- **Processing/Timing State:** 2 variables
- **Configuration Constants:** 6 constants
- **Window Properties:** 2 properties

---

## Notes

1. **Variable Scope:** All variables listed are declared at the top level of the `<script>` tag, making them globally accessible throughout the application.

2. **State Management:** The application uses a mix of:
   - Direct global variables for core state
   - Cached data structures for performance
   - Window object properties for cross-function state
   - LocalStorage for persistent state (undo stack, saved searches)

3. **Data Flow:** Most data flows from API calls → cache variables → rendering functions. Cache variables are cleared in `reloadAllData()` when switching projects.

4. **Potential Issues:**
   - **BUG:** `currentProject` is referenced in `getSavedSearches()` (line 19017) and `saveSavedSearches()` (line 19026) but is never declared as a global variable. This will cause a ReferenceError. Should likely use `currentProjectId` or `String(currentProjectId)` instead.
   - Multiple cache variables could benefit from a unified cache management system
   - Some UI state variables (like `selectedPerson`, `currentEmailForResponse`) could be consolidated into a single UI state object

5. **Memory Considerations:**
   - Large data caches (`questionsData`, `globalSearchData`, `allContacts`, `allTeams`) could consume significant memory
   - Chart/network instances should be properly destroyed when switching views to prevent memory leaks
