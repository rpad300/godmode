# API Endpoints Inventory

Complete inventory of all API endpoints used in `src/public/index.html`

Generated: 2026-01-31

---

## Authentication (`/api/auth/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/auth/status` | `checkAuthStatus()` | Check current authentication status |
| GET | `/api/auth/me` | `checkAuthStatus()` | Get current user information |
| POST | `/api/auth/login` | `handleLogin()`, `handleLoginSubmit()` | User login |
| POST | `/api/auth/register` | `handleRegister()` | User registration |
| POST | `/api/auth/forgot-password` | `handleForgotPassword()` | Request password reset |
| POST | `/api/auth/logout` | `handleLogout()` | User logout |

---

## Projects (`/api/projects/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/projects` | `loadCurrentProject()`, `loadProjectList()`, `reloadAllData()`, `loadGraphProjectsSync()` | List all projects |
| POST | `/api/projects` | `handleCreateFirstProject()`, `createNewProject()` | Create new project |
| GET | `/api/projects/current` | `loadCurrentProject()`, `loadProjectSettings()` | Get current active project |
| GET | `/api/projects/{projectId}` | `createNewProject()` | Get project by ID |
| PUT | `/api/projects/{projectId}` | `confirmRenameProject()` | Update project (rename) |
| DELETE | `/api/projects/{projectId}` | `confirmDeleteProject()` | Delete project |
| POST | `/api/projects/{projectId}/activate` | `activateProject()` | Activate a project |
| PUT | `/api/projects/{projectId}/activate` | `switchProject()` | Activate a project (alternative) |
| GET | `/api/projects/{projectId}/export` | `exportProject()` | Export project data |
| POST | `/api/projects/import` | `importProject()` | Import project data |
| POST | `/api/projects/{projectId}/set-default` | `setProjectDefault()` | Set project as default |
| GET | `/api/projects/{projectId}/stats` | `loadProjectSettings()` | Get project statistics |
| GET | `/api/projects/{projectId}/members` | `loadProjectSettings()` | List project members |
| PUT | `/api/projects/{projectId}/members/{userId}` | `updateMemberRole()` | Update member role |
| DELETE | `/api/projects/{projectId}/members/{userId}` | `removeMember()` | Remove project member |
| GET | `/api/projects/{projectId}/invites` | `loadProjectSettings()` | List project invitations |
| POST | `/api/projects/{projectId}/invites` | `sendInvite()` | Send project invitation |
| GET | `/api/projects/{projectId}/activity` | `loadProjectActivity()` | Get project activity log |
| GET | `/api/projects/{projectId}/api-keys` | `loadProjectSettings()` | List project API keys |
| POST | `/api/projects/{projectId}/api-keys` | `createApiKey()` | Create project API key |
| GET | `/api/projects/{projectId}/webhooks` | `loadProjectSettings()` | List project webhooks |
| POST | `/api/projects/{projectId}/webhooks` | `createWebhook()` | Create project webhook |
| GET | `/api/projects/{projectId}/audit/exports` | `loadProjectSettings()` | List audit export logs |
| POST | `/api/projects/{projectId}/audit/exports` | `createAuditExport()` | Create audit export |
| GET | `/api/projects/{projectId}/sync/stats` | `loadProjectSettings()` | Get sync statistics |
| GET | `/api/projects/{projectId}/sync/dead-letters` | `loadProjectSettings()` | List sync dead letters |

---

## Roles (`/api/roles/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/roles/templates` | `loadRoleTemplates()` | Get role templates |
| POST | `/api/roles/generate` | `generateRolePrompt()` | Generate role prompt |
| GET | `/api/roles/perspective` | `loadPerspectives()` | Get active perspectives |
| POST | `/api/roles/perspective` | `switchPerspective()` | Switch to a perspective |
| DELETE | `/api/roles/perspective` | `endPerspective()` | End current perspective |
| GET | `/api/roles/dashboard` | `loadRoleDashboard()` | Get role dashboard data |

---

## User Profile (`/api/user/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/user/profile` | `loadUserProfile()` | Get user profile |
| PUT | `/api/user/profile` | `saveUserProfile()` | Update user profile |

---

## Invites (`/api/invites/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| DELETE | `/api/invites/{inviteId}` | `cancelInvite()` | Cancel project invitation |

---

## Notifications (`/api/notifications/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/notifications/count` | `loadNotifications()` | Get notification count |
| GET | `/api/notifications` | `loadNotifications()` | List notifications with pagination |
| POST | `/api/notifications/{notificationId}/read` | `markNotificationRead()` | Mark notification as read |
| POST | `/api/notifications/read-all` | `markAllNotificationsRead()` | Mark all notifications as read |

---

## Comments (`/api/comments`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/comments` | `loadComments()` | List comments for a target |
| POST | `/api/comments` | `submitComment()` | Create a comment |
| DELETE | `/api/comments/{commentId}` | `deleteComment()` | Delete a comment |

---

## API Keys (`/api/api-keys/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| DELETE | `/api/api-keys/{keyId}` | `deleteApiKey()` | Delete API key |

---

## Webhooks (`/api/webhooks/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/webhooks/{webhookId}/test` | `testWebhook()` | Test webhook endpoint |
| DELETE | `/api/webhooks/{webhookId}` | `deleteWebhook()` | Delete webhook |

---

## Audit (`/api/audit/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/audit/exports/{exportId}/download` | `downloadAuditExport()` | Download audit export file |

---

## Sync (`/api/sync/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/sync/dead-letters/{deadLetterId}/retry` | `retryDeadLetter()` | Retry failed sync operation |
| POST | `/api/sync/dead-letters/{deadLetterId}/resolve` | `resolveDeadLetter()` | Resolve dead letter (mark as resolved) |

---

## Knowledge (`/api/knowledge/*`, `/api/facts`, `/api/questions`, `/api/risks`, `/api/decisions`, `/api/actions`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/facts` | `loadFacts()`, `loadDashboard()`, `loadConflictDetection()`, `loadQuickCapture()` | List all facts |
| POST | `/api/facts` | `submitQuickCapture()`, `performUndo()` | Create new fact |
| GET | `/api/questions` | `loadQuestions()`, `loadDashboard()`, `loadConflictDetection()`, `loadQuickCapture()` | List all questions |
| POST | `/api/questions` | `submitQuickCapture()`, `performUndo()` | Create new question |
| PUT | `/api/questions/{questionId}` | `reopenQuestion()`, `updateQuestionStatus()` | Update question (status, assignment) |
| POST | `/api/questions/{questionId}/answer` | `submitAnswer()` | Answer a question |
| GET | `/api/questions/by-person` | `loadQuestionsByPerson()` | Get questions grouped by assignee |
| GET | `/api/risks` | `loadRiskHeatmap()`, `loadTrendIndicators()`, `loadDashboard()`, `loadConflictDetection()` | List all risks |
| GET | `/api/risks/by-category` | `loadRisks()` | Get risks grouped by category |
| PUT | `/api/risks/{id}` | `updateRiskStatus()` | Update risk status |
| GET | `/api/decisions` | `loadDecisions()`, `loadDashboard()`, `loadConflictDetection()` | List all decisions |
| GET | `/api/actions` | `loadActions()`, `loadTrendIndicators()`, `loadDashboard()`, `loadConflictDetection()` | List all actions |
| PUT | `/api/actions/{id}` | `updateActionStatus()` | Update action status |
| GET | `/api/knowledge/status` | `loadKnowledgeStatus()` | Get knowledge processing status |
| POST | `/api/knowledge/embed` | `embedKnowledge()` | Trigger knowledge embedding |
| POST | `/api/knowledge/synthesize` | `synthesizeKnowledge()` | Synthesize knowledge base |
| GET | `/api/knowledge/json` | `exportKnowledgeJSON()` | Export knowledge as JSON (opens in new window) |
| GET | `/api/source-of-truth` | `copyKnowledgeToClipboard()`, `loadSourceOfTruth()` | Get source of truth document |
| GET | `/api/sot/enhanced` | `loadSourceOfTruth()` | Get enhanced source of truth with graph data |
| GET | `/api/sot/versions` | `showSOTVersions()` | List source of truth versions |
| POST | `/api/sot/chat` | `sendSOTChat()` | Chat with source of truth |
| POST | `/api/sot/executive-summary` | `generateExecutiveSummary()` | Generate executive summary |
| GET | `/api/sot/export/{format}` | `exportSOT()` | Export source of truth in specified format |

---

## People (`/api/people`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/people` | `loadQuestionsByPerson()`, `loadOrgChart()` | List all people |

---

## Processing (`/api/process/*`, `/api/upload`, `/api/bulk/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/process` | `startProcessing()` | Start processing documents |
| GET | `/api/process/status` | `startProcessing()` | Get processing status |
| POST | `/api/upload` | `confirmDateModal()`, `uploadFiles()` | Upload files for processing |
| POST | `/api/bulk/delete` | `performBulkDelete()` | Bulk delete items |
| POST | `/api/bulk/status` | `performBulkDelete()` | Get bulk operation status |

---

## Files (`/api/files/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/files` | `loadPendingFiles()` | List pending files |
| DELETE | `/api/files/{folder}/{filename}` | `removePendingFile()` | Delete a file |

---

## Conversations (`/api/conversations/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/conversations` | `loadConversations()` | List all conversations |
| POST | `/api/conversations` | `importConversation()` | Import conversation |
| POST | `/api/conversations/parse` | `previewConversation()` | Parse conversation preview |
| POST | `/api/conversations/preview` | `previewEmailConversation()` | Preview email conversation |
| POST | `/api/conversations/{id}/reembed` | `reembedConversation()` | Re-embed conversation |

---

## Emails (`/api/emails/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/emails` | `importEmail()` | Import email |
| POST | `/api/emails/{emailId}/mark-responded` | `markEmailResponded()` | Mark email as responded |
| POST | `/api/emails/{emailId}/response` | `generateEmailResponse()` | Generate email response |
| POST | `/api/emails/sync-graph` | `syncEmailsToGraph()` | Sync emails to graph database |

---

## Contacts (`/api/contacts/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/contacts` | `loadContactsPage()`, `loadContactsGrid()` | List all contacts |
| POST | `/api/contacts` | `saveContact()` | Create new contact |
| GET | `/api/contacts/{id}` | `editContact()` | Get contact by ID |
| PUT | `/api/contacts/{id}` | `saveContact()` | Update contact |
| POST | `/api/contacts/{id}/enrich` | `enrichContact()` | Enrich contact data |
| POST | `/api/contacts/{id}/teams` | `addToTeam()`, `syncContactTeams()` | Add contact to team |
| POST | `/api/contacts/{id}/relationships` | `addRelationship()` | Add relationship between contacts |
| GET | `/api/contacts/stats` | `loadContactsPage()` | Get contact statistics |
| GET | `/api/contacts/unmatched` | `showUnmatchedParticipants()` | List unmatched participants |
| GET | `/api/contacts/duplicates` | `showDuplicatesModal()` | List duplicate contacts |
| POST | `/api/contacts/merge` | `executeManualMerge()`, `mergeGroup()` | Merge contacts |
| POST | `/api/contacts/match` | `previewConversation()` | Match contacts to participants |
| POST | `/api/contacts/link-participant` | `linkParticipantToContact()` | Link participant to contact |
| POST | `/api/contacts/import/csv` | `importContactsCSV()` | Import contacts from CSV |
| POST | `/api/contacts/import/json` | `importContactsJSON()` | Import contacts from JSON |
| GET | `/api/contacts/export/json` | `exportContactsJSON()` | Export contacts as JSON (opens in new window) |
| GET | `/api/contacts/export/csv` | `exportContactsCSV()` | Export contacts as CSV (opens in new window) |

---

## Teams (`/api/teams`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/teams` | `showTeamsModal()`, `loadContactsPage()` | List all teams |
| POST | `/api/teams` | `addTeam()` | Create new team |
| DELETE | `/api/teams/{id}` | `deleteTeam()` | Delete team |

---

## Graph Database (`/api/graph/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/graph/status` | `loadGraphDBPage()`, `refreshGraphDB()`, `showGraphStats()` | Get graph database connection status |
| POST | `/api/graph/test` | `testGraphConnection()` | Test graph database connection |
| POST | `/api/graph/connect` | `connectToGraph()` | Connect to graph database |
| POST | `/api/graph/query` | `executeCypherQuery()` | Execute Cypher query |
| POST | `/api/graph/sync` | `syncDataToGraph()` | Sync data to graph database |
| POST | `/api/graph/indexes` | `createGraphIndexes()` | Create graph indexes |
| GET | `/api/graph/list` | `loadGraphProjectsSync()` | List graph projects |
| POST | `/api/graph/cleanup-orphans` | `cleanupOrphanGraphs()` | Clean up orphaned graph nodes |

---

## Configuration (`/api/config`, `/api/ollama/*`, `/api/llm/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/config` | `loadConfig()`, `saveSettings()` | Get application configuration |
| POST | `/api/config` | `saveApiKeys()`, `saveSettings()` | Update application configuration |
| GET | `/api/ollama/test` | `testConnection()` | Test Ollama connection |
| POST | `/api/ollama/pull` | `downloadModel()`, `autoPullModel()` | Pull/download Ollama model |
| GET | `/api/ollama/recommended` | `loadRecommendedModels()` | Get recommended Ollama models |
| POST | `/api/llm/test` | `testLLMConnection()` | Test LLM provider connection |
| POST | `/api/llm/preflight` | `runPreflightTests()` | Run LLM preflight tests |

---

## Dashboard (`/api/dashboard`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/dashboard` | `loadDashboard()`, `updateActionsBadge()`, `copyOverdueToClipboard()`, `loadStats()` | Get dashboard data and statistics |

---

## Search (`/api/search`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/search` | `performSearch()` | Search across knowledge base |

---

## Content (`/api/content/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/content/{sourceName}` | `showSourceDetail()` | Get content by source name |

---

## Export (`/api/export/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/export/questions` | `copyQuestionsToClipboard()` | Export questions as text |
| GET | `/api/export/knowledge` | `exportKnowledge()` | Export knowledge base (redirects) |

---

## Source of Truth (`/api/source-of-truth`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/source-of-truth` | `copyKnowledgeToClipboard()`, `loadSourceOfTruth()` | Get source of truth document (redirects) |

---

## Chat (`/api/chat`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/chat` | `sendChatMessage()` | Send chat message |

---

## Timezones (`/api/timezones/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/timezones/grouped` | `loadTimezones()` | Get timezones grouped by region |

---

## File Logs (`/api/file-logs`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/file-logs` | `loadFileLogs()` | Get file processing logs |

---

## History (`/api/history`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/history` | `loadHistory()` | Get processing history |

---

## Costs (`/api/costs/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/costs` | `loadCosts()` | Get cost tracking data |
| GET | `/api/costs/pricing` | `loadCosts()` | Get pricing information |
| POST | `/api/costs/reset` | `resetCosts()` | Reset cost tracking |

---

## Stats (`/api/stats`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/stats` | `loadStats()`, `updateStats()` | Get application statistics |

---

## Reports (`/api/reports/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/reports/weekly` | `loadWeeklyReport()` | Get weekly report |

---

## Conflicts (`/api/conflicts`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/conflicts` | `loadConflictDetection()` | Detect conflicts in knowledge base |

---

## Org Chart (`/api/org-chart`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/org-chart` | `loadOrgChart()` | Get organizational chart data |

---

## Undo (`/api/undo/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/undo/restore` | `performUndo()` | Restore deleted item |
| POST | `/api/undo/restore-bulk` | `performUndo()` | Restore multiple deleted items |

---

## Ontology (`/api/ontology/*`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| GET | `/api/ontology/suggestions` | `loadOntologySuggestions()` | Get ontology suggestions |
| POST | `/api/ontology/suggestions/{id}/approve` | `approveOntologySuggestion()` | Approve ontology suggestion |
| POST | `/api/ontology/suggestions/{id}/reject` | `rejectOntologySuggestion()` | Reject ontology suggestion |
| POST | `/api/ontology/suggestions/{id}/enrich` | `enrichOntologySuggestion()` | Enrich ontology suggestion |
| POST | `/api/ontology/analyze-graph` | `analyzeOntologyGraph()` | Analyze ontology graph |
| GET | `/api/ontology` | `loadOntology()` | Get ontology data |

---

## Cleanup (`/api/cleanup-orphans`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/cleanup-orphans` | `cleanupOrphans()` | Clean up orphaned data |

---

## Reset (`/api/reset`)

| Method | Endpoint | Function | Purpose |
|--------|----------|----------|---------|
| POST | `/api/reset` | `confirmReset()` | Reset application data |

---

## Summary Statistics

- **Total Endpoints**: ~150+
- **Authentication**: 6 endpoints
- **Projects**: 25+ endpoints
- **Knowledge Base** (facts/questions/risks/decisions/actions): 20+ endpoints
- **Processing & Upload**: 5 endpoints
- **Contacts & Teams**: 20+ endpoints
- **Graph Database**: 8 endpoints
- **Configuration**: 6 endpoints
- **Other**: 40+ endpoints

---

## Notes

1. **Helper Function**: Most endpoints use the `api(path, method, body)` helper function which prepends `/api` to the path and defaults to GET method if not specified.

2. **Window Navigation**: Some endpoints use `window.location.href` or `window.open()` for direct navigation/downloads:
   - `/api/source-of-truth`
   - `/api/export/knowledge`
   - `/api/export/questions`
   - `/api/contacts/export/json`
   - `/api/contacts/export/csv`
   - `/api/knowledge/json`
   - `/api/sot/export/{format}`

3. **Dynamic Paths**: Several endpoints use dynamic path parameters (e.g., `{projectId}`, `{id}`, `{emailId}`, `{contactId}`).

4. **Pagination**: Some endpoints support pagination via query parameters (`limit`, `offset`):
   - `/api/notifications?limit={limit}&offset={offset}`
   - `/api/projects/{projectId}/activity?limit={limit}&offset={offset}`

5. **Query Parameters**: Some endpoints use query parameters:
   - `/api/search?q={query}`
   - `/api/knowledge/json?refresh=true`
   - `/api/sot/enhanced?graph=true`
   - `/api/comments?project_id={id}&target_type={type}&target_id={id}`
