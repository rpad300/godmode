# Error Handling & UI States Inventory
## Analysis of `src/public/index.html`

Generated: 2026-01-31

---

## 1. Try/Catch Blocks

### Project Management Functions

| Function | Location | Error Caught | Handling | User Feedback |
|----------|----------|--------------|----------|---------------|
| `loadCurrentProject()` | ~6155 | General errors | `console.error()` | Sets project name to "Error" |
| `handleCreateFirstProject()` | ~6224 | Connection errors | Sets error element text | Shows inline error message |
| `activateProject()` | ~6257 | General errors | `console.error()` | None (silent failure) |
| `loadProjectList()` | ~6272 | General errors | `console.error()` | None (silent failure) |
| `switchProject()` | ~6415 | General errors | `console.error()` | None (silent failure) |
| `createNewProject()` | ~6598 | General errors | `console.error()` | None (silent failure) |
| `saveUserRole()` | ~6647 | General errors | `console.error()` | None (silent failure) |
| `loadRoleTemplates()` | ~6707 | General errors | Sets innerHTML error | Shows error in container |
| `generateRolePrompt()` | ~6807 | API errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `loadPerspectives()` | ~6839 | General errors | Sets innerHTML error | Shows error in container |
| `switchPerspective()` | ~6883 | API errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `endPerspective()` | ~6904 | API errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `loadRoleDashboard()` | ~6921 | General errors | Sets innerHTML error | Shows error in container |
| `confirmDeleteProject()` | ~7018 | General errors | `console.error()` | None (silent failure) |
| `confirmRenameProject()` | ~7055 | General errors | `console.error()` | None (silent failure) |
| `exportProject()` | ~7083 | General errors | `console.error()` | None (silent failure) |
| `importProject()` | ~7110 | Import errors | `console.error()` | None (silent failure) |

### Settings & Configuration Functions

| Function | Location | Error Caught | Handling | User Feedback |
|----------|----------|--------------|----------|---------------|
| `testAllApiKeys()` | ~7350 | API test errors | Sets status element | Shows "Failed" status |
| `saveApiKeys()` | ~7380 | Save errors | `showToast('Failed to save API keys: ' + e.message, 'error')` | Error toast |
| `loadLLMModels()` | ~7704 | Model loading errors | Sets innerHTML error | Shows error in select |
| `fetchModelInfo()` | ~7855 | Model info errors | `console.error()` | None (silent failure) |
| `refreshProviderHealth()` | ~8205 | Health check errors | `console.error()` | None (silent failure) |
| `autoPullModel()` | ~8489 | Pull errors | `showToast('Failed to pull ${model}: ${result.error}', 'error')` | Error toast |
| `loadRecommendedModels()` | ~8689 | Model loading errors | `console.error()` | None (silent failure) |
| `downloadModel()` | ~8734 | Download errors | Sets status text | Shows error in status |

### Dashboard & Data Loading Functions

| Function | Location | Error Caught | Handling | User Feedback |
|----------|----------|--------------|----------|---------------|
| `loadStats()` | ~8784 | Stats loading errors | None (no try/catch) | N/A |
| `loadRiskHeatmap()` | ~9003 | Heatmap errors | `console.error()` | None (silent failure) |
| `loadTrendIndicators()` | ~9100 | Trend errors | `console.error()` | None (silent failure) |
| `loadPendingFiles()` | ~9182 | File loading errors | None (no try/catch) | N/A |
| `removePendingFile()` | ~9212 | Remove errors | `showToast(result.error \|\| 'Delete failed', 'error')` | Error toast |
| `importConversation()` | ~9334 | Import errors | `showToast(result.error \|\| 'Import failed', 'error')` | Error toast |
| `loadConversations()` | ~9392 | Loading errors | `console.error()` | None (silent failure) |
| `viewConversation()` | ~9441 | Load errors | `showToast(result.error \|\| 'Failed to load conversation', 'error')` | Error toast |
| `deleteConversation()` | ~9553 | Delete errors | `showToast(result.error \|\| 'Delete failed', 'error')` | Error toast |
| `reembedConversation()` | ~9573 | Re-embed errors | `showToast(result.error \|\| 'Re-embed failed', 'error')` | Error toast |
| `exportConversationJSON()` | ~9591 | Export errors | `showToast(result.error \|\| 'Export failed', 'error')` | Error toast |
| `showEmailDetail()` | ~9714 | Load errors | `showToast(result.error \|\| 'Failed to load email', 'error')` | Error toast |
| `deleteEmail()` | ~9804 | Delete errors | `showToast(result.error \|\| 'Failed to delete email', 'error')` | Error toast |
| `markEmailResponded()` | ~9820 | Mark errors | `showToast(result.error \|\| 'Failed to mark as responded', 'error')` | Error toast |
| `syncEmailsToGraph()` | ~9840 | Sync errors | `showToast(result.error \|\| 'Failed to sync', 'error')` | Error toast |
| `loadContactsPage()` | ~9855 | Load errors | `console.error()` | None (silent failure) |
| `executeManualMerge()` | ~10062 | Merge errors | `showToast(result.error \|\| 'Merge failed', 'error')` | Error toast |
| `editContact()` | ~10268 | Load errors | `showToast(result.error \|\| 'Failed to load contact', 'error')` | Error toast |
| `saveContact()` | ~10327 | Save errors | `showToast(result.error \|\| 'Failed to save contact', 'error')` | Error toast |
| `deleteContact()` | ~10414 | Delete errors | `showToast(result.error \|\| 'Failed to delete contact', 'error')` | Error toast |
| `viewContactDetail()` | ~10431 | Load errors | `showToast('Failed to load contact', 'error')` | Error toast |
| `enrichContact()` | ~10543 | Enrich errors | `showToast(result.error \|\| 'Failed to enrich', 'error')` | Error toast |
| `addToTeam()` | ~10670 | Add errors | `showToast(result.error \|\| 'Failed to add member', 'error')` | Error toast |
| `removeFromTeam()` | ~10689 | Remove errors | `showToast(result.error \|\| 'Failed to remove member', 'error')` | Error toast |
| `addTeam()` | ~10702 | Create errors | `showToast(result.error \|\| 'Failed to create team', 'error')` | Error toast |
| `deleteTeam()` | ~10723 | Delete errors | `showToast(result.error \|\| 'Failed to delete team', 'error')` | Error toast |
| `importContactsCSV()` | ~10757 | Import errors | `showToast(result.error \|\| 'Import failed', 'error')` | Error toast |
| `importContactsJSON()` | ~10775 | Import errors | `showToast('Invalid JSON format', 'error')` | Error toast |
| `mergeGroup()` | ~10843 | Merge errors | `showToast(result.error \|\| 'Merge failed', 'error')` | Error toast |
| `linkParticipantToContact()` | ~10947 | Link errors | `showToast(result.error \|\| 'Failed to link', 'error')` | Error toast |
| `testGraphConnection()` | ~11046 | Test errors | Sets status text | Shows error in status |
| `connectToGraph()` | ~11082 | Connection errors | Sets status text | Shows error in status |
| `executeCypherQuery()` | ~11120 | Query errors | `showToast('Error: ' + err.message, 'error')` | Error toast |
| `syncDataToGraph()` | ~11234 | Sync errors | `showToast(result.error \|\| 'Sync failed', 'error')` | Error toast |
| `createGraphIndexes()` | ~11251 | Index errors | `showToast(result.error \|\| 'Failed', 'error')` | Error toast |
| `showGraphStats()` | ~11267 | Stats errors | `showToast('Error: ' + err.message, 'error')` | Error toast |
| `loadGraphProjectsSync()` | ~11304 | Load errors | `showToast('Error: ' + result.error, 'error')` | Error toast |
| `cleanupOrphanGraphs()` | ~11404 | Cleanup errors | `showToast('Error: ' + result.error, 'error')` | Error toast |
| `setProjectDefault()` | ~11423 | Set errors | `showToast('Error: ' + result.error, 'error')` | Error toast |
| `uploadFiles()` | ~11484 | Upload errors | `showToast('Upload failed: ' + (result.error \|\| 'Unknown error'), 'error')` | Error toast |
| `processEmail()` | ~11825 | Process errors | `showToast(result.error \|\| 'Failed to process email', 'error')` | Error toast |
| `uploadEmailAttachments()` | ~12013 | Upload errors | `console.error()` | None (silent failure) |
| `generateEmailResponse()` | ~12035 | Generate errors | `showToast('Error: ' + error.message, 'error')` | Error toast |
| `previewConversationModal()` | ~12104 | Parse errors | `showToast(result.error \|\| 'Failed to parse conversation', 'error')` | Error toast |
| `importConversationModal()` | ~12157 | Import errors | `showToast(result.error \|\| 'Failed to import conversation', 'error')` | Error toast |
| `loadQuestions()` | ~12216 | Load errors | None (no try/catch) | N/A |
| `loadDashboard()` | ~12258 | Load errors | `console.error()` | None (silent failure) |
| `loadFacts()` | ~12457 | Load errors | None (no try/catch) | N/A |
| `loadDecisions()` | ~12479 | Load errors | None (no try/catch) | N/A |
| `loadSourceOfTruth()` | ~12505 | Load errors | Sets innerHTML error | Shows error in container |
| `sendSOTChat()` | ~12911 | Send errors | None (no try/catch) | N/A |
| `showSOTVersions()` | ~12945 | Load errors | `showToast('Error loading version: ' + e.message, 'error')` | Error toast |
| `loadSOTVersion()` | ~12977 | Load errors | Sets innerHTML error | Shows error in container |
| `regenerateExecutiveSummary()` | ~12988 | Regenerate errors | Sets innerHTML error | Shows error in container |
| `submitAnswer()` | ~13212 | Submit errors | `showToast('Failed to submit answer', 'error')` | Error toast |
| `reopenQuestion()` | ~13250 | Reopen errors | `showToast('Failed to reopen question', 'error')` | Error toast |
| `confirmDismissQuestion()` | ~13328 | Dismiss errors | `showToast(result.error \|\| 'Failed to dismiss question', 'error')` | Error toast |
| `confirmAnswerAndResolve()` | ~13353 | Save errors | `showToast(result.error \|\| 'Failed to save answer', 'error')` | Error toast |
| `assignQuestionToPerson()` | ~13383 | Assign errors | `showToast('Failed to assign question: ' + e.message, 'error')` | Error toast |
| `loadRisks()` | ~13562 | Load errors | None (no try/catch) | N/A |
| `loadActions()` | ~13633 | Load errors | None (no try/catch) | N/A |
| `bulkExport()` | ~13750 | Export errors | `console.error()` | None (silent failure) |
| `bulkDelete()` | ~13782 | Delete errors | `console.error()` | None (silent failure) |
| `bulkUpdateStatus()` | ~13834 | Update errors | `console.error()` | None (silent failure) |
| `loadFileLogs()` | ~13907 | Load errors | None (no try/catch) | N/A |
| `confirmDeleteDocument()` | ~13963 | Delete errors | `showToast('Failed to delete: ' + (result.error \|\| 'Unknown error'), 'error')` | Error toast |
| `loadHistory()` | ~14088 | Load errors | None (no try/catch) | N/A |
| `loadCosts()` | ~14133 | Load errors | `console.error()` | None (silent failure) |
| `showCostsPricing()` | ~14317 | Load errors | `showToast('Failed to load pricing: ' + e.message, 'error')` | Error toast |
| `resetCosts()` | ~14356 | Reset errors | `showToast('Failed to reset costs: ' + e.message, 'error')` | Error toast |
| `autoLoadChatContext()` | ~14401 | Load errors | `console.error()` | None (silent failure) |
| `loadChatContext()` | ~14459 | Load errors | None (no try/catch) | N/A |
| `viewSource()` | ~14594 | Load errors | Sets innerHTML error | Shows error in container |
| `copySourceContent()` | ~14677 | Copy errors | `showToast('Failed to copy: ' + err.message, 'error')` | Error toast |
| `sendChatMessage()` | ~14691 | Send errors | None (no try/catch) | N/A |
| `loadEmbeddingStatus()` | ~14861 | Load errors | None (no try/catch) | N/A |
| `buildEmbeddingIndex()` | ~14911 | Build errors | `showToast('Error building index: ' + err.message, 'error')` | Error toast |
| `synthesizeKnowledge()` | ~14955 | Synthesis errors | `showToast('Synthesis error: ' + e.message, 'error')` | Error toast |
| `copyKnowledgeToClipboard()` | ~15009 | Copy errors | `showToast('Failed to copy: ' + e.message, 'error')` | Error toast |
| `copyQuestionsToClipboard()` | ~15020 | Copy errors | `showToast('Failed to copy: ' + e.message, 'error')` | Error toast |
| `copyOverdueToClipboard()` | ~15031 | Copy errors | `showToast('Failed to copy: ' + e.message, 'error')` | Error toast |
| `checkAuthStatus()` | ~15097 | Auth errors | None (no try/catch) | N/A |
| `checkCurrentUser()` | ~15120 | User errors | None (no try/catch) | N/A |
| `handleLogin()` | ~15293 | Login errors | Sets error element | Shows inline error |
| `handleRegister()` | ~15328 | Register errors | Sets error element | Shows inline error |
| `handleForgotPassword()` | ~15380 | Forgot password errors | Sets error element | Shows inline error |
| `logout()` | ~15403 | Logout errors | `console.error()` | None (silent failure) |
| `loadUserProfile()` | ~15436 | Load errors | `showToast('Failed to load profile', 'error')` | Error toast |
| `saveUserProfile()` | ~15456 | Save errors | `showToast('Failed to save profile', 'error')` | Error toast |
| `loadDashboard()` (user) | ~15489 | Load errors | `console.error()` | None (silent failure) |
| `loadMembers()` | ~15550 | Load errors | `console.error()` | None (silent failure) |
| `updateMemberRole()` | ~15596 | Update errors | `showToast('Failed to update role', 'error')` | Error toast |
| `removeMember()` | ~15617 | Remove errors | `showToast('Failed to remove member', 'error')` | Error toast |
| `loadInvites()` | ~15638 | Load errors | `console.error()` | None (silent failure) |
| `createInvite()` | ~15689 | Create errors | `showToast('Failed to create invite', 'error')` | Error toast |
| `revokeInvite()` | ~15716 | Revoke errors | `showToast('Failed to revoke invite', 'error')` | Error toast |
| `loadActivity()` | ~15761 | Load errors | `console.error()` | None (silent failure) |
| `updateNotificationBadge()` | ~15872 | Update errors | `console.error()` | None (silent failure) |
| `loadNotifications()` | ~15897 | Load errors | `console.error()` | None (silent failure) |
| `handleNotificationClick()` | ~15949 | Click errors | None (no try/catch) | N/A |
| `markAllNotificationsRead()` | ~15974 | Mark errors | `showToast('Failed to mark notifications as read', 'error')` | Error toast |
| `loadComments()` | ~16015 | Load errors | `console.error()` | None (silent failure) |
| `submitComment()` | ~16092 | Submit errors | `showToast('Failed to post comment', 'error')` | Error toast |
| `deleteCommentById()` | ~16130 | Delete errors | `showToast('Failed to delete comment', 'error')` | Error toast |
| `loadApiKeys()` | ~16207 | Load errors | `console.error()` | None (silent failure) |
| `createApiKey()` | ~16253 | Create errors | `showToast('Failed to create API key', 'error')` | Error toast |
| `revokeApiKey()` | ~16300 | Revoke errors | `showToast('Failed to revoke API key', 'error')` | Error toast |
| `loadWebhooks()` | ~16328 | Load errors | None (no try/catch) | N/A |
| `createWebhook()` | ~16376 | Create errors | `showToast('Failed to create webhook', 'error')` | Error toast |
| `testWebhook()` | ~16415 | Test errors | `showToast('Failed to test webhook', 'error')` | Error toast |
| `deleteWebhook()` | ~16430 | Delete errors | `showToast('Failed to delete webhook', 'error')` | Error toast |
| `loadAuditExports()` | ~16450 | Load errors | None (no try/catch) | N/A |
| `createAuditExport()` | ~16499 | Create errors | `showToast('Failed to create export', 'error')` | Error toast |
| `downloadAuditExport()` | ~16534 | Download errors | `showToast('Failed to download export', 'error')` | Error toast |
| `loadSyncStatus()` | ~16559 | Load errors | None (no try/catch) | N/A |
| `loadDeadLetters()` | ~16581 | Load errors | None (no try/catch) | N/A |
| `retryDeadLetter()` | ~16624 | Retry errors | `showToast('Failed to retry', 'error')` | Error toast |
| `resolveDeadLetter()` | ~16640 | Resolve errors | `showToast('Failed to resolve', 'error')` | Error toast |
| `cleanOrphanData()` | ~16683 | Cleanup errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `loadGraphStatus()` | ~16820 | Load errors | `console.error()` | None (silent failure) |
| `testGraphConnection()` | ~16848 | Test errors | Sets status text | Shows error in status |
| `syncToGraph()` | ~16886 | Sync errors | Sets status text | Shows error in status |
| `loadOntology()` | ~16941 | Load errors | Sets innerHTML error | Shows error in container |
| `performSearch()` | ~17026 | Search errors | None (no try/catch) | N/A |
| `askQuestion()` | ~17160 | Question errors | None (no try/catch) | N/A |
| `loadTimeline()` | ~17234 | Load errors | None (no try/catch) | N/A |
| `loadPeople()` | ~17373 | Load errors | None (no try/catch) | N/A |
| `loadOrgChart()` | ~17445 | Load errors | Sets innerHTML error | Shows error in container |
| `saveNewRelationship()` | ~17725 | Save errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `saveOrgChartRelationship()` | ~17846 | Save errors | `showToast('Error: ' + err.message, 'error')` | Error toast |
| `checkAndRefresh()` | ~17877 | Check errors | `console.error()` | None (silent failure) |
| `loadBriefing()` | ~18078 | Load errors | Sets innerHTML error | Shows error in container |
| `generateWeeklyReport()` | ~18130 | Generate errors | `showToast('Failed to generate weekly report: ' + e.message, 'error')` | Error toast |
| `detectConflicts()` | ~18240 | Detect errors | None (no try/catch) | N/A |
| `submitQuickCapture()` | ~18385 | Submit errors | `showToast(response.error \|\| 'Failed to add item', 'error')` | Error toast |
| `performUndo()` | ~18510 | Undo errors | `showToast('Undo failed: ' + e.message, 'error')` | Error toast |
| `openGlobalSearch()` | ~18807 | Load errors | `showToast('Failed to load data', 'error')` | Error toast |
| `exportToClipboard()` | ~19168 | Export errors | `showToast('Export failed: ' + e.message, 'error')` | Error toast |
| `resolveQuestionFromFocus()` | ~19399 | Resolve errors | `showToast('Failed to resolve question: ' + e.message, 'error')` | Error toast |
| `closeRiskFromFocus()` | ~19410 | Close errors | `showToast('Failed to close risk: ' + e.message, 'error')` | Error toast |
| `completeActionFromFocus()` | ~19421 | Complete errors | `showToast('Failed to complete action: ' + e.message, 'error')` | Error toast |
| `checkOntologySuggestions()` | ~19525 | Check errors | None (no try/catch) | N/A |
| `approveSuggestion()` | ~19608 | Approve errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `rejectSuggestion()` | ~19645 | Reject errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `enrichSuggestion()` | ~19660 | Enrich errors | `showToast('Error: ' + e.message, 'error')` | Error toast |
| `analyzeGraphForSuggestions()` | ~19681 | Analyze errors | `showToast('Error: ' + e.message, 'error')` | Error toast |

---

## 2. Promise .catch() Handlers

| Location | Function | Promise | Error Handling | User Feedback |
|----------|----------|---------|----------------|---------------|
| ~12064 | `copyDraftResponse()` | `navigator.clipboard.writeText()` | `showToast('Failed to copy', 'error')` | Error toast |
| ~16321 | `copyApiKey()` | `navigator.clipboard.writeText()` | `showToast('Failed to copy', 'error')` | Error toast |

**Note:** Only 2 promise `.catch()` handlers found. Most async operations use try/catch instead.

---

## 3. Error Messages (showToast with 'error', alert, etc.)

### Error Toast Messages (159 instances)

**Common Error Patterns:**
- `showToast('Error: ' + e.message, 'error')` - Generic error with message (50+ instances)
- `showToast(result.error \|\| 'Failed to [action]', 'error')` - API error with fallback (40+ instances)
- `showToast('Failed to [action]', 'error')` - Simple failure message (30+ instances)
- `showToast('Failed to [action]: ' + e.message, 'error')` - Failure with message (20+ instances)
- `showToast('Failed to [action]: ' + (result.error \|\| 'Unknown error'), 'error')` - With unknown fallback (5+ instances)

**Specific Error Messages:**

| Message | Location | Context |
|---------|----------|---------|
| "Could not generate prompt" | ~6826 | Role prompt generation |
| "Failed to switch perspective" | ~6895 | Perspective switching |
| "Failed to save API keys: " + e.message | ~7423 | API key saving |
| "Failed to pull ${model}: ${result.error}" | ~8560 | Model pulling |
| "Import failed" | ~9384, ~10770, ~10790 | Conversation/contact import |
| "Failed to load conversation" | ~9446 | Conversation loading |
| "Delete failed" | ~9565 | Conversation deletion |
| "Re-embed failed" | ~9582 | Conversation re-embedding |
| "Export failed" | ~9603 | Conversation export |
| "Failed to load email" | ~9718 | Email loading |
| "Error loading email: " + error.message | ~9800 | Email loading |
| "Failed to delete email" | ~9813 | Email deletion |
| "Failed to mark as responded" | ~9833 | Email status update |
| "Failed to sync" | ~9847 | Email sync |
| "Merge failed" | ~10080, ~10859 | Contact merging |
| "Failed to load contact" | ~10278, ~10435 | Contact loading |
| "Failed to save contact" | ~10378 | Contact saving |
| "Failed to delete contact" | ~10423 | Contact deletion |
| "Failed to enrich" | ~10550 | Contact enrichment |
| "Failed to add member" | ~10684 | Team member addition |
| "Failed to remove member" | ~10697 | Team member removal |
| "Failed to create team" | ~10718 | Team creation |
| "Failed to delete team" | ~10732 | Team deletion |
| "Invalid JSON format" | ~10793 | JSON import validation |
| "Failed to link" | ~10966 | Participant linking |
| "Sync failed" | ~11244 | Graph sync |
| "Upload failed: " + (result.error \|\| 'Unknown error') | ~11545 | File upload |
| "Please select a .eml or .msg file" | ~11791 | File type validation |
| "Please paste email content or upload a .eml file" | ~11844 | Email content validation |
| "Failed to process email" | ~11896 | Email processing |
| "Failed to generate response" | ~12048 | Email response generation |
| "Failed to copy" | ~12065, ~16322 | Clipboard copy |
| "Failed to parse conversation" | ~12150 | Conversation parsing |
| "Failed to import conversation" | ~12205 | Conversation import |
| "Error loading version: " + e.message | ~12983 | Version loading |
| "Please provide an answer (min 3 characters)" | ~13219 | Answer validation |
| "Failed: ${data.error}" | ~13243, ~13268 | Answer submission/reopen |
| "Failed to submit answer" | ~13246 | Answer submission |
| "Failed to reopen question" | ~13271 | Question reopening |
| "Failed to dismiss question" | ~13346 | Question dismissal |
| "Failed to save answer" | ~13374 | Answer saving |
| "Failed to assign: ${result.error}" | ~13395 | Question assignment |
| "Failed to assign question: " + e.message | ~13398 | Question assignment |
| "Failed to delete: " + (result.error \|\| 'Unknown error') | ~14007 | Document deletion |
| "Error deleting document: " + e.message | ~14011 | Document deletion |
| "Failed to load pricing: " + e.message | ~14352 | Pricing loading |
| "Failed to reset costs: " + e.message | ~14366 | Cost reset |
| "No content to copy" | ~14679 | Copy validation |
| "Failed to copy: " + err.message | ~14686, ~15016, ~15027, ~15056 | Content copying |
| "Failed to build index: " + result.error | ~14936 | Index building |
| "Error building index: " + err.message | ~14942 | Index building |
| "Synthesis failed: " + (data.error \|\| 'Unknown error') | ~14992 | Knowledge synthesis |
| "Synthesis error: " + e.message | ~14998 | Knowledge synthesis |
| "Failed to load profile" | ~15452 | Profile loading |
| "Failed to update" | ~15480 | Profile update |
| "Failed to save profile" | ~15483 | Profile saving |
| "Failed to update role" | ~15609, ~15613 | Member role update |
| "Failed to remove member" | ~15631, ~15634 | Member removal |
| "Failed to create invite" | ~15709, ~15712 | Invite creation |
| "Failed to revoke invite" | ~15727, ~15730 | Invite revocation |
| "Failed to mark notifications as read" | ~15981 | Notification update |
| "Please write a comment" | ~16097 | Comment validation |
| "Failed to post comment" | ~16123, ~16126 | Comment posting |
| "Failed to delete" | ~16141 | Comment deletion |
| "Failed to delete comment" | ~16144 | Comment deletion |
| "Please enter a key name" | ~16258 | API key validation |
| "Failed to create API key" | ~16293, ~16296 | API key creation |
| "Failed to revoke" | ~16311 | API key revocation |
| "Failed to revoke API key" | ~16314 | API key revocation |
| "Please enter name and URL" | ~16382 | Webhook validation |
| "Please select at least one event" | ~16387 | Webhook validation |
| "Failed to create webhook" | ~16408, ~16411 | Webhook creation |
| "Test failed" | ~16423 | Webhook testing |
| "Failed to test webhook" | ~16426 | Webhook testing |
| "Failed to delete" | ~16441 | Webhook deletion |
| "Failed to delete webhook" | ~16444 | Webhook deletion |
| "Please select date range" | ~16505 | Export validation |
| "Failed to create export" | ~16527, ~16530 | Export creation |
| "Download failed" | ~16550 | Export download |
| "Failed to download export" | ~16553 | Export download |
| "Retry failed" | ~16633 | Dead letter retry |
| "Failed to retry" | ~16636 | Dead letter retry |
| "Failed to resolve" | ~16655, ~16658 | Dead letter resolution |
| "Cleanup failed: " + result.error | ~16719 | Data cleanup |
| "Please select both people and a relationship type" | ~17731 | Relationship validation |
| "Cannot create a relationship with the same person" | ~17736 | Relationship validation |
| "Failed to create relationship" | ~17751 | Relationship creation |
| "Failed to add relationship" | ~17866 | Relationship addition |
| "Error: " + data.error | ~18171 | Weekly report generation |
| "Failed to generate weekly report: " + e.message | ~18174 | Weekly report generation |
| "Failed to add item" | ~18417 | Quick capture |
| "Undo failed: " + e.message | ~18579 | Undo operation |
| "Failed to load data" | ~18822 | Global search |
| "Export failed: " + e.message | ~19236 | Export operation |
| "Failed to resolve question: " + e.message | ~19406 | Question resolution |
| "Failed to close risk: " + e.message | ~19417 | Risk closure |
| "Failed to complete action: " + e.message | ~19428 | Action completion |
| "Failed to approve: " + (data.error \|\| 'Unknown error') | ~19629 | Suggestion approval |
| "Could not enrich: " + (data.error \|\| 'Unknown error') | ~19674 | Suggestion enrichment |
| "Analysis failed: " + data.error | ~19692 | Graph analysis |

### Alert Messages (2 instances)

| Location | Message | Context |
|----------|---------|---------|
| ~7051 | "Project name cannot be empty" | Project creation validation |
| ~11575 | "Please select a model in Settings first.\n\nGo to Settings → Model Selection → Text Model" | Model selection validation |

---

## 4. Loading States

### CSS Classes for Loading States

| Class | Location | Purpose |
|-------|----------|---------|
| `.btn.loading` | ~89 | Button loading spinner |
| `.btn-primary.loading::after` | ~108 | Primary button loading animation |
| `.skeleton` | ~117 | Skeleton loader base |
| `.skeleton-text` | ~124 | Text skeleton loader |
| `.skeleton-circle` | ~137 | Circle skeleton loader |
| `.skeleton-card` | ~143 | Card skeleton loader |
| `.drop-zone.uploading` | ~616 | File upload indicator |
| `.project-loading` | ~855 | Project switching indicator |
| `.briefing-loading` | ~1089 | Briefing generation indicator |

### Loading State Implementations

| Location | Function/Element | Loading Indicator | Type |
|---------|------------------|-------------------|------|
| ~2457 | `currentProjectName` | "Loading..." text | Text |
| ~2464 | `projectLoading` | "Switching..." text | Text |
| ~2835 | Briefing section | "Loading briefing..." div | Text |
| ~2969 | Health status | "Loading..." text | Text |
| ~3037 | Executive summary | "Loading executive summary..." text | Text |
| ~3043-3071 | Dashboard sections | "Loading [section]..." empty-state divs | Text |
| ~3103 | Versions | "Loading versions..." text | Text |
| ~3853 | Content area | "Loading..." paragraph | Text |
| ~3891 | Knowledge context | "Loading knowledge context..." text | Text |
| ~4417 | Templates | "Loading templates..." div | Text |
| ~4425 | Current perspective | "Loading..." text | Text |
| ~4434 | Dashboard content | "Loading..." div | Text |
| ~4451 | Dashboard | "Loading dashboard..." div | Text |
| ~4709 | Teams | "Loading teams..." span | Text |
| ~4976 | Members | "Loading members..." div | Text |
| ~4998 | Invites | "Loading invites..." div | Text |
| ~5016 | Activity | "Loading..." div | Text |
| ~5034 | Activity feed | "Loading activity..." div | Text |
| ~5115 | API keys | "Loading API keys..." div | Text |
| ~5140 | Webhooks | "Loading webhooks..." div | Text |
| ~5163 | Exports | "Loading exports..." div | Text |
| ~5195 | General | "Loading..." div | Text |
| ~5879 | Embedding status | "Loading status..." text | Text |
| ~6001 | Ontology | "Loading ontology..." text | Text |
| ~6418-6419 | `switchProject()` | Adds 'visible' class to loading element | Class toggle |
| ~6555 | Briefing content | Loading dots animation | Animation |
| ~7552 | Model select | "Loading models..." option | Text |
| ~7710 | Model status | "Loading models from ${provider}..." text | Text |
| ~8742 | Model download | "Downloading ${modelName}..." text | Text |
| ~11522 | File upload | Adds 'uploading' class to drop zone | Class toggle |
| ~11550 | File upload | Removes 'uploading' class | Class toggle |
| ~13412 | Suggestions | "Loading suggestions..." span | Text |
| ~14405 | Button | "Loading..." span | Text |
| ~14478 | Knowledge context | "Loading knowledge context..." text | Text |
| ~14607-14608 | Content loading | "Loading..." divs | Text |
| ~14785 | Model select | "Loading models..." option | Text |
| ~15552 | Members list | "Loading..." div | Text |
| ~15640 | Invites list | "Loading..." div | Text |
| ~15765 | Activity list | "Loading..." div | Text |
| ~15901 | Notifications | "Loading..." div | Text |
| ~16019 | Comments | "Loading comments..." div | Text |
| ~16209 | API keys list | "Loading..." div | Text |
| ~16330 | Webhooks list | "Loading..." div | Text |
| ~16452 | Exports list | "Loading..." div | Text |
| ~16583 | Dead letters | "Loading..." div | Text |
| ~16942-16947 | Ontology | Shows loading element | Element display |
| ~18082 | Briefing | "Generating briefing..." span | Text |
| ~18249 | Content area | Loading div | Div |
| ~18687-18698 | `setButtonLoading()` | Adds 'loading' class, disables button | Function |
| ~19267 | Critical items | "Loading critical items..." div | Text |

### Button Loading States (via `setButtonLoading()`)

| Location | Function | Button Element | Loading State |
|---------|----------|----------------|---------------|
| ~18687 | `setButtonLoading()` | Generic button | Adds 'loading' class, disables, stores original text |

---

## 5. Empty States

### Empty State CSS

| Class | Location | Purpose |
|-------|----------|---------|
| `.empty-state` | ~1474 | Base empty state styling |
| `.heatmap-cell.empty` | ~1339 | Empty heatmap cell |

### Empty State Messages

| Location | Message | Context |
|----------|---------|---------|
| ~2761 | Empty briefing section | Briefing display |
| ~3043-3071 | "Loading [section]..." (shown as empty-state) | Dashboard sections |
| ~3353 | "Select a person to view their questions" | Questions view |
| ~3379 | "No facts extracted yet" | Facts table |
| ~3396 | "No decisions logged yet" | Decisions table |
| ~3436 | "No risks identified yet" | Risks table |
| ~3475 | "No action items yet" | Action items table |
| ~3529 | "No timeline events yet" | Timeline display |
| ~3529 | `orgChartEmpty` element | Org chart |
| ~3556 | "No file processing logs yet" | File logs table |
| ~3576 | "No processing history" | Processing history table |
| ~3626 | "No data yet" | General data display |
| ~3646 | "No usage data yet" | Usage table |
| ~3666 | "No requests yet" | Requests table |
| ~3704 | Empty state div | General display |
| ~3776 | Empty state div | General display |
| ~4757 | "No teams created yet" | Teams list |
| ~9038-9040 | Heatmap cell empty class | Risk heatmap |
| ~9196 | "No files pending. Drag & drop files above." | Pending files |
| ~9403 | "No conversations imported" | Conversations list |
| ~9631 | Empty state div | General display |
| ~9707 | "Error loading emails: ${error.message}" | Email list error |
| ~10093 | Empty state div | General display |
| ~10610 | "No teams created yet" | Teams list |
| ~11003 | Auto-run sample query if empty | Graph query |
| ~12221 | "No questions yet" | Questions table |
| ~12462 | "No facts extracted yet" | Facts table |
| ~12484 | "No decisions logged yet" | Decisions table |
| ~12540 | "Error loading Source of Truth: " + e.message | Source of Truth error |
| ~12616 | "No summary available" | Summary display |
| ~12631 | "No data yet. Process some files to generate Source of Truth." | Source of Truth empty |
| ~12670 | "No timeline events yet" | Timeline display |
| ~12690 | "No insights available. Add more data to generate insights." | Insights display |
| ~12711 | Empty state div | General display |
| ~12767 | "No confidence data available" | Confidence scores |
| ~12953 | "No version history yet" | Version history |
| ~12969 | "Error loading versions: ${e.message}" | Version loading error |
| ~12997 | "Error: ${e.message}" | General error |
| ~13466 | Empty state div | Questions display |
| ~13475 | "No questions yet" | Questions list |
| ~13570 | "No risks identified yet" | Risks table |
| ~13624 | "No ${filter} risks found" | Filtered risks |
| ~13641 | "No action items yet" | Action items table |
| ~13663 | "No ${filter} action items" | Filtered action items |
| ~13753 | Alert: "No items selected" | Bulk operations |
| ~13785 | Alert: "No items selected" | Bulk operations |
| ~13837 | Alert: "No items selected" | Bulk operations |
| ~13872 | Check for "No data yet" content | Data validation |
| ~13912 | "No file processing logs yet" | File logs table |
| ~14093 | "No processing history" | Processing history table |
| ~14176 | "No data yet" | General display |
| ~14204 | "No data yet" | General display |
| ~14245 | "No usage data yet" | Usage table |
| ~14267 | "No requests yet" | Requests table |
| ~17045 | "Searching..." | Search results |
| ~17055 | "No results found for '" + query + '"' | Search results |
| ~17295 | "No timeline events found. Process documents with dates, decisions, or scheduled actions." | Timeline empty |
| ~17387 | "No people identified yet. Process documents to extract people information." | People list |
| ~17448 | `orgChartEmpty` element | Org chart |
| ~17468 | Shows empty element | Org chart |
| ~17476 | Hides empty element | Org chart |
| ~17487 | "No data" fallback | Stats display |
| ~17619 | "Error loading org chart" | Org chart error |
| ~18973 | "No results found" | Search results |
| ~19227 | "No data to export for: " + type | Export empty |

---

## 6. Disabled States

### CSS for Disabled States

| Class/Selector | Location | Purpose |
|---------------|----------|---------|
| `.btn:disabled` | ~84 | Disabled button styling |
| `.btn:disabled` | ~300 | Disabled button styling (duplicate) |
| `.login-btn:disabled` | ~2004 | Disabled login button |

### Disabled State Implementations

| Location | Function | Element | Disabled Condition | Re-enabled Condition |
|---------|----------|---------|-------------------|----------------------|
| ~6220 | `handleCreateFirstProject()` | Create button | During project creation | After completion/error |
| ~6251 | `handleCreateFirstProject()` | Create button | Re-enabled after error | N/A |
| ~7951 | `runPreflightTests()` | Test button | During tests | After completion |
| ~7988 | `runPreflightTests()` | Test button | Re-enabled after error | N/A |
| ~11582 | `startProcessing()` | Process button | During processing | After completion |
| ~11597 | `startProcessing()` | Process button | Re-enabled after completion | N/A |
| ~11827 | `processEmail()` | Process button | During email processing | After completion/error |
| ~11845 | `processEmail()` | Process button | Re-enabled after error | N/A |
| ~11903 | `processEmail()` | Process button | Re-enabled after success | N/A |
| ~12175 | `importConversationModal()` | Import button | During import | After completion |
| ~12211 | `importConversationModal()` | Import button | Re-enabled after completion | N/A |
| ~14404 | `autoLoadChatContext()` | Button | During loading | After completion/error |
| ~14447 | `autoLoadChatContext()` | Button | Re-enabled after error | N/A |
| ~14453 | `autoLoadChatContext()` | Button | Re-enabled after success | N/A |
| ~14708 | `viewSource()` | Input field | During loading | After completion |
| ~14728 | `viewSource()` | Input field | Re-enabled after completion | N/A |
| ~14918 | `buildEmbeddingIndex()` | Build button | During build | After completion/error |
| ~14945 | `buildEmbeddingIndex()` | Build button | Re-enabled after completion | N/A |
| ~14962 | `synthesizeKnowledge()` | Synthesize button | During synthesis | After completion/error |
| ~15003 | `synthesizeKnowledge()` | Synthesize button | Re-enabled after completion | N/A |
| ~15168 | `handleLogin()` | Login button | During login | After completion/error |
| ~15197 | `handleLogin()` | Login button | Re-enabled after error | N/A |
| ~16890 | `syncToGraph()` | Sync button | During sync | After completion/error |
| ~16912 | `syncToGraph()` | Sync button | Re-enabled after completion | N/A |
| ~17667 | `saveNewRelationship()` | Save button | During save | After completion/error |
| ~17710 | `saveNewRelationship()` | Save button | Re-enabled after success | N/A |
| ~17713 | `saveNewRelationship()` | Save button | Disabled after success | N/A |
| ~18690 | `setButtonLoading()` | Generic button | When loading=true | When loading=false |
| ~18694 | `setButtonLoading()` | Generic button | Re-enabled when loading=false | N/A |
| ~19108 | `openQuickExport()` | Dropdown | During export | After completion |
| ~19114 | `openQuickExport()` | Dropdown | Re-enabled after completion | N/A |

---

## 7. Functions WITHOUT Error Handling

### Async Functions Missing Try/Catch

| Function | Location | Risk Level | Recommendation |
|----------|----------|------------|-----------------|
| `loadConfig()` | ~7248 | **HIGH** | Wraps `api()` calls without error handling. If API fails, config may be undefined. |
| `testConnection()` | ~7266 | **MEDIUM** | Calls `api()` without try/catch. Errors will propagate unhandled. |
| `loadStats()` | ~8784 | **MEDIUM** | No error handling. Stats loading failures are silent. |
| `loadPendingFiles()` | ~9182 | **MEDIUM** | No error handling. File list failures are silent. |
| `loadQuestions()` | ~12216 | **MEDIUM** | No error handling. Questions loading failures are silent. |
| `loadFacts()` | ~12457 | **MEDIUM** | No error handling. Facts loading failures are silent. |
| `loadDecisions()` | ~12479 | **MEDIUM** | No error handling. Decisions loading failures are silent. |
| `sendSOTChat()` | ~12911 | **MEDIUM** | No error handling. Chat send failures are silent. |
| `loadChatContext()` | ~14459 | **MEDIUM** | No error handling. Context loading failures are silent. |
| `sendChatMessage()` | ~14691 | **HIGH** | No error handling. Chat message failures are silent. |
| `loadEmbeddingStatus()` | ~14861 | **MEDIUM** | No error handling. Status loading failures are silent. |
| `checkAuthStatus()` | ~15097 | **HIGH** | No error handling. Auth check failures could break app. |
| `checkCurrentUser()` | ~15120 | **HIGH** | No error handling. User check failures could break app. |
| `handleNotificationClick()` | ~15949 | **MEDIUM** | No error handling. Notification click failures are silent. |
| `loadWebhooks()` | ~16328 | **MEDIUM** | No error handling. Webhook loading failures are silent. |
| `loadAuditExports()` | ~16450 | **MEDIUM** | No error handling. Export loading failures are silent. |
| `loadSyncStatus()` | ~16559 | **MEDIUM** | No error handling. Sync status loading failures are silent. |
| `loadDeadLetters()` | ~16581 | **MEDIUM** | No error handling. Dead letter loading failures are silent. |
| `performSearch()` | ~17026 | **MEDIUM** | No error handling. Search failures are silent. |
| `askQuestion()` | ~17160 | **MEDIUM** | No error handling. Question submission failures are silent. |
| `loadTimeline()` | ~17234 | **MEDIUM** | No error handling. Timeline loading failures are silent. |
| `loadPeople()` | ~17373 | **MEDIUM** | No error handling. People loading failures are silent. |
| `detectConflicts()` | ~18240 | **MEDIUM** | No error handling. Conflict detection failures are silent. |
| `checkOntologySuggestions()` | ~19525 | **MEDIUM** | No error handling. Suggestion checking failures are silent. |

### Functions with Silent Errors (console.error only)

| Function | Location | Issue | Recommendation |
|----------|----------|-------|---------------|
| `activateProject()` | ~6257 | Only logs to console | Add user-facing error feedback |
| `loadProjectList()` | ~6272 | Only logs to console | Add user-facing error feedback |
| `switchProject()` | ~6415 | Only logs to console | Add user-facing error feedback |
| `createNewProject()` | ~6598 | Only logs to console | Add user-facing error feedback |
| `saveUserRole()` | ~6647 | Only logs to console | Add user-facing error feedback |
| `confirmDeleteProject()` | ~7018 | Only logs to console | Add user-facing error feedback |
| `confirmRenameProject()` | ~7055 | Only logs to console | Add user-facing error feedback |
| `exportProject()` | ~7083 | Only logs to console | Add user-facing error feedback |
| `fetchModelInfo()` | ~7855 | Only logs to console | Add user-facing error feedback |
| `refreshProviderHealth()` | ~8205 | Only logs to console | Add user-facing error feedback |
| `loadRecommendedModels()` | ~8689 | Only logs to console | Add user-facing error feedback |
| `loadRiskHeatmap()` | ~9003 | Only logs to console | Add user-facing error feedback |
| `loadTrendIndicators()` | ~9100 | Only logs to console | Add user-facing error feedback |
| `loadConversations()` | ~9392 | Only logs to console | Add user-facing error feedback |
| `uploadEmailAttachments()` | ~12013 | Only logs to console | Add user-facing error feedback |
| `loadDashboard()` | ~12258 | Only logs to console | Add user-facing error feedback |
| `bulkExport()` | ~13750 | Only logs to console | Add user-facing error feedback |
| `bulkDelete()` | ~13782 | Only logs to console | Add user-facing error feedback |
| `bulkUpdateStatus()` | ~13834 | Only logs to console | Add user-facing error feedback |
| `loadFileLogs()` | ~13907 | No error handling | Add try/catch with user feedback |
| `loadHistory()` | ~14088 | No error handling | Add try/catch with user feedback |
| `loadCosts()` | ~14133 | Only logs to console | Add user-facing error feedback |
| `autoLoadChatContext()` | ~14401 | Only logs to console | Add user-facing error feedback |
| `logout()` | ~15403 | Only logs to console | Add user-facing error feedback |
| `loadDashboard()` (user) | ~15489 | Only logs to console | Add user-facing error feedback |
| `loadMembers()` | ~15550 | Only logs to console | Add user-facing error feedback |
| `loadInvites()` | ~15638 | Only logs to console | Add user-facing error feedback |
| `loadActivity()` | ~15761 | Only logs to console | Add user-facing error feedback |
| `updateNotificationBadge()` | ~15872 | Only logs to console | Add user-facing error feedback |
| `loadNotifications()` | ~15897 | Only logs to console | Add user-facing error feedback |
| `loadComments()` | ~16015 | Only logs to console | Add user-facing error feedback |
| `loadApiKeys()` | ~16207 | Only logs to console | Add user-facing error feedback |
| `loadGraphStatus()` | ~16820 | Only logs to console | Add user-facing error feedback |
| `checkAndRefresh()` | ~17877 | Only logs to console | Add user-facing error feedback |

---

## 8. API Calls Without Error Handling

### Direct fetch() Calls Without Try/Catch

| Location | Function | API Call | Issue |
|---------|----------|---------|------|
| ~7243 | `api()` helper | `fetch('/api' + path)` | **CRITICAL**: No error handling. All API calls using this helper are vulnerable. |
| ~11587 | `startProcessing()` | `api('/process', 'POST')` | No try/catch around API call |
| ~11591 | `startProcessing()` | `api('/process/status')` | No try/catch around polling API call |
| ~7281 | `testConnection()` | `api('/config', 'POST')` | No try/catch |
| ~7283 | `testConnection()` | `api('/ollama/test')` | No try/catch |
| ~7249 | `loadConfig()` | `api('/config')` | No try/catch |

### Functions Using `api()` Helper Without Error Handling

All functions listed in Section 7 that use the `api()` helper function are vulnerable because:
1. The `api()` helper itself has no error handling
2. It doesn't check response status codes
3. It doesn't handle network errors
4. Functions calling `api()` often don't wrap it in try/catch

---

## 9. Recommendations

### Critical Issues

1. **`api()` Helper Function (~7240)**
   - **Issue**: No error handling, no status code checking
   - **Impact**: All API calls are vulnerable to unhandled errors
   - **Fix**: Add try/catch, check `res.ok`, handle network errors

2. **Silent Failures**
   - **Issue**: 30+ functions only log to console without user feedback
   - **Impact**: Users don't know when operations fail
   - **Fix**: Replace `console.error()` with `showToast()` or inline error messages

3. **Missing Try/Catch Blocks**
   - **Issue**: 25+ async functions have no error handling
   - **Impact**: Unhandled promise rejections, app crashes
   - **Fix**: Wrap all async operations in try/catch

### High Priority

4. **Inconsistent Error Messages**
   - **Issue**: Error messages vary in format and detail
   - **Fix**: Standardize error message format (e.g., "Failed to [action]: [details]")

5. **Missing Loading States**
   - **Issue**: Some async operations don't show loading indicators
   - **Fix**: Add loading states for all async operations

6. **Missing Empty States**
   - **Issue**: Some lists don't show empty state messages
   - **Fix**: Add empty state messages for all data lists

### Medium Priority

7. **Promise .catch() Usage**
   - **Issue**: Only 2 promise `.catch()` handlers found
   - **Fix**: Consider using `.catch()` for promise chains instead of try/catch

8. **Disabled State Management**
   - **Issue**: Some buttons don't re-enable after errors
   - **Fix**: Ensure all disabled buttons are re-enabled in finally blocks

9. **Error Recovery**
   - **Issue**: No retry mechanisms for failed operations
   - **Fix**: Add retry logic for critical operations

### Best Practices

10. **Error Boundaries**
    - Add error boundaries for major UI sections
    - Prevent entire app crashes from single component errors

11. **Error Logging**
    - Consider adding error tracking service integration
    - Log errors with context for debugging

12. **User-Friendly Messages**
    - Replace technical error messages with user-friendly ones
    - Provide actionable guidance when errors occur

---

## Summary Statistics

- **Total Try/Catch Blocks**: 172
- **Total Promise .catch() Handlers**: 2
- **Total Error Toast Messages**: 159
- **Total Alert Messages**: 2
- **Total Loading States**: 60+
- **Total Empty States**: 75+
- **Total Disabled State Implementations**: 25+
- **Functions Without Error Handling**: 25+
- **Functions with Silent Errors**: 30+
- **Critical API Helper Issues**: 1 (`api()` function)

---

*End of Inventory*
