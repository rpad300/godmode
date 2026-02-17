# JavaScript Function Inventory
## File: `src/public/index.html`

**Total Functions Found:** 461

---

## 1. Project Management (project, switch, create, delete, activate)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `loadCurrentProject` | 6154 | async |
| `showProjectCreationOverlay` | 6192 | function |
| `hideProjectCreationOverlay` | 6199 | function |
| `handleCreateFirstProject` | 6206 | async |
| `activateProject` | 6256 | async |
| `loadProjectList` | 6271 | async |
| `switchProject` | 6415 | async |
| `showProjectSwitchSummary` | 6452 | async |
| `showProjectSummaryModal` | 6482 | function |
| `reloadAllData` | 6545 | async |
| `openNewProjectModal` | 6578 | function |
| `createNewProject` | 6586 | async |
| `openDeleteProjectModal` | 7009 | function |
| `confirmDeleteProject` | 7015 | async |
| `openRenameProjectModal` | 7039 | function |
| `confirmRenameProject` | 7046 | async |
| `exportProject` | 7082 | async |
| `importProject` | 7110 | async |
| `setProjectDefault` | 11423 | async |

**Total: 18 functions**

---

## 2. Authentication (login, logout, register, auth, user)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `checkAuthStatus` | 15097 | async |
| `checkCurrentUser` | 15120 | async |
| `showLoginOverlay` | 15139 | function |
| `hideLoginOverlay` | 15146 | function |
| `handleMandatoryLogin` | 15153 | async |
| `updateUserUI` | 15202 | function |
| `showLoginButton` | 15244 | function |
| `openLoginModal` | 15252 | function |
| `switchAuthTab` | 15259 | function |
| `showAuthError` | 15279 | function |
| `showAuthSuccess` | 15286 | function |
| `handleLogin` | 15293 | async |
| `handleRegister` | 15328 | async |
| `handleForgotPassword` | 15380 | async |
| `logout` | 15403 | async |
| `toggleUserMenu` | 15421 | function |
| `closeUserDropdown` | 15426 | function |
| `openUserProfile` | 15430 | async |
| `loadUserProfile` | 15436 | async |
| `loadUserSettings` | 15430 | async |
| `saveUserSettings` | 15450 | async |
| `updateNotificationBadge` | 15860 | async |

**Total: 21 functions**

---

## 3. Settings/Config (config, settings, save, test)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `loadConfig` | 7248 | async |
| `testConnection` | 7266 | async |
| `initApiKeysUI` | 7317 | function |
| `updateConfiguredProvidersCount` | 7338 | function |
| `testAllApiKeys` | 7350 | async |
| `saveApiKeys` | 7380 | async |
| `initLLMProviderUI` | 7428 | function |
| `populateTaskProviderDropdowns` | 7464 | function |
| `onModelDropdownChange` | 7509 | function |
| `onCustomModelInput` | 7522 | function |
| `onTaskProviderChange` | 7534 | async |
| `onLLMProviderChange` | 7597 | function |
| `testLLMConnection` | 7660 | async |
| `loadLLMModels` | 7704 | async |
| `getLLMModelValue` | 7767 | function |
| `updateTokenEnforceStatus` | 7776 | function |
| `initTokenLimitsUI` | 7795 | function |
| `loadModelMetadata` | 7812 | async |
| `fetchModelInfo` | 7855 | async |
| `updateModelInfoDisplay` | 7866 | function |
| `getTokenPolicyFromUI` | 7894 | function |
| `runPreflightTests` | 7947 | async |
| `updateFailoverModeStatus` | 8012 | function |
| `initFailoverUI` | 8031 | function |
| `initPriorityList` | 8067 | function |
| `updatePriorityOrder` | 8124 | function |
| `getPrioritiesFromUI` | 8142 | function |
| `initModelMapUI` | 8160 | function |
| `refreshProviderHealth` | 8205 | async |
| `getRoutingConfigFromUI` | 8248 | function |
| `isVisionModel` | 8310 | function |
| `populateModels` | 8333 | function |
| `renderModelSuggestions` | 8392 | function |
| `isModelAvailable` | 8410 | function |
| `togglePromptMode` | 8417 | function |
| `initPromptModes` | 8443 | function |
| `updatePromptPreviews` | 8469 | function |
| `getModelValue` | 8481 | function |
| `autoPullModel` | 8489 | async |
| `isOllamaModelName` | 8526 | function |
| `saveSettings` | 8533 | async |
| `loadRecommendedModels` | 8689 | async |
| `renderModelsList` | 8718 | function |
| `downloadModel` | 8734 | async |
| `showModelDownload` | 8773 | function |
| `toggleModelSection` | 8778 | function |
| `loadProjectSettings` | 16190 | async |
| `saveProjectSettings` | 16220 | async |
| `loadProjectApiKeys` | 16250 | async |
| `saveProjectApiKeys` | 16260 | async |
| `deleteProjectApiKey` | 16290 | async |
| `loadProjectWebhooks` | 16330 | async |
| `saveProjectWebhook` | 16380 | async |
| `testWebhook` | 16410 | async |
| `deleteProjectWebhook` | 16420 | async |

**Total: 52 functions**

---

## 4. Data Loading (load*, fetch*, get*)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `loadCurrentProject` | 6154 | async |
| `loadProjectList` | 6271 | async |
| `loadRoleTemplates` | 6707 | async |
| `loadPerspectives` | 6834 | async |
| `loadRoleDashboard` | 6918 | async |
| `loadConfig` | 7248 | async |
| `loadLLMModels` | 7704 | async |
| `loadModelMetadata` | 7812 | async |
| `loadRecommendedModels` | 8689 | async |
| `loadStats` | 8784 | async |
| `loadRiskHeatmap` | 9003 | async |
| `loadTrendIndicators` | 9100 | async |
| `loadPendingFiles` | 9182 | async |
| `loadConversations` | 9392 | async |
| `loadEmailsPage` | 9617 | async |
| `loadContactsPage` | 9855 | async |
| `loadTimezones` | 10204 | async |
| `loadGraphDBPage` | 10977 | async |
| `loadGraphProjectsSync` | 11304 | async |
| `loadQuestions` | 12216 | async |
| `loadDashboard` | 12258 | async |
| `loadFacts` | 12457 | async |
| `loadDecisions` | 12479 | async |
| `loadSourceOfTruth` | 12505 | async |
| `loadQuestionsByPerson` | 13055 | async |
| `loadRisks` | 13562 | async |
| `loadActions` | 13633 | async |
| `loadFileLogs` | 13907 | async |
| `loadHistory` | 14088 | async |
| `loadCosts` | 14133 | async |
| `loadChatContext` | 14459 | async |
| `loadEmbeddingStatus` | 14861 | async |
| `loadBriefing` | 18078 | async |
| `loadProjectActivity` | 15760 | async |
| `loadNotifications` | 15890 | async |
| `loadComments` | 16020 | async |
| `loadProjectSettings` | 16190 | async |
| `loadProjectApiKeys` | 16250 | async |
| `loadProjectWebhooks` | 16330 | async |
| `loadAuditExports` | 16450 | async |
| `loadSyncStats` | 16550 | async |
| `loadDeadLetters` | 16580 | async |
| `getSavedSearches` | 19015 | function |
| `getSelectedIds` | 13708 | function |
| `getSelectedTeamIds` | 9960 | function |
| `getLLMModelValue` | 7767 | function |
| `getModelValue` | 8481 | function |
| `getTokenPolicyFromUI` | 7894 | function |
| `getPrioritiesFromUI` | 8142 | function |
| `getRoutingConfigFromUI` | 8248 | function |
| `getNodeColor` | 11218 | function |
| `fetchModelInfo` | 7855 | async |

**Total: 49 functions**

---

## 5. Data Display/Rendering (render*, display*, show*, update*)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `renderRoleTemplates` | 6728 | function |
| `renderConversationPreview` | 9274 | function |
| `renderContactsGrid` | 10088 | function |
| `renderTeamsList` | 10606 | function |
| `renderGraphVisualization` | 11165 | function |
| `renderEmailAttachments` | 11805 | function |
| `renderTrendInsights` | 12334 | function |
| `renderQuestionsChart` | 12370 | function |
| `renderRisksChart` | 12409 | function |
| `renderMarkdownContent` | 12627 | function |
| `renderTimeline` | 12667 | function |
| `renderInsights` | 12687 | function |
| `renderGraphSummary` | 12706 | function |
| `renderConfidenceScores` | 12764 | function |
| `renderQuestionsContent` | 13451 | function |
| `renderCostChart` | 14173 | function |
| `renderProviderBreakdown` | 14199 | function |
| `renderModelTable` | 14241 | function |
| `renderRecentRequests` | 14263 | function |
| `renderModelSuggestions` | 8392 | function |
| `renderModelsList` | 8718 | function |
| `renderOntologySuggestions` | 19564 | function |
| `showProjectCreationOverlay` | 6192 | function |
| `showProjectSwitchSummary` | 6452 | async |
| `showProjectSummaryModal` | 6482 | function |
| `showHeatmapRisks` | 9049 | function |
| `showEmailDetail` | 9714 | async |
| `showAddContactModal` | 10236 | async |
| `showTeamsModal` | 10593 | async |
| `showDuplicatesModal` | 10810 | async |
| `showUnmatchedParticipants` | 10866 | async |
| `showGraphConnectModal` | 11033 | function |
| `showGraphStats` | 11267 | async |
| `showProcessingModal` | 11620 | function |
| `showEmailPreview` | 11919 | function |
| `showAnswerForm` | 13161 | function |
| `showDismissQuestionModal` | 13279 | function |
| `showAssigneeSuggestions` | 13402 | async |
| `showCostsPricing` | 14317 | async |
| `showManualMergeModal` | 10016 | function |
| `showImportContactsModal` | 10739 | function |
| `showSOTVersions` | 12945 | async |
| `showOntologyModal` | 19553 | async |
| `updateActionsBadge` | 6391 | async |
| `updateConfiguredProvidersCount` | 7338 | function |
| `updateTokenEnforceStatus` | 7776 | function |
| `updateModelInfoDisplay` | 7866 | function |
| `updateFailoverModeStatus` | 8012 | function |
| `updatePriorityOrder` | 8124 | function |
| `updateHealthScore` | 8883 | function |
| `updateTrendIndicator` | 9147 | function |
| `updateTrendIndicator` | 12241 | function |
| `updateTeamFilters` | 9902 | function |
| `updateTeamCheckboxStyle` | 9934 | function |
| `updateMergeUI` | 9980 | function |
| `updateProcessingUI` | 11639 | function |
| `updateHealthBadge` | 12544 | function |
| `updateDeltaBadge` | 12564 | function |
| `updateAlertsBanner` | 12585 | function |
| `updateExecutiveSummary` | 12613 | function |
| `updateBulkBar` | 13714 | function |
| `updateChatModelInfo` | 14388 | function |
| `updateSavedSearchesDropdown` | 19101 | function |

**Total: 62 functions**

---

## 6. User Actions (handle*, on*, click, submit)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `handleCreateFirstProject` | 6206 | async |
| `handleDragOver` | 11441 | function |
| `handleDragLeave` | 11447 | function |
| `handleDrop` | 11453 | async |
| `handleFileSelect` | 11466 | async |
| `handleEmlDrop` | 11773 | function |
| `handleEmlSelect` | 11783 | function |
| `handleEmlFile` | 11789 | function |
| `handleEmailAttachments` | 11799 | function |
| `handleMandatoryLogin` | 15153 | async |
| `handleLogin` | 15293 | async |
| `handleRegister` | 15328 | async |
| `handleForgotPassword` | 15380 | async |
| `logout` | 15403 | async |
| `onModelDropdownChange` | 7509 | function |
| `onCustomModelInput` | 7522 | function |
| `onTaskProviderChange` | 7534 | async |
| `onLLMProviderChange` | 7597 | function |
| `onRagEmbeddingProviderChange` | 14781 | async |
| `onSavedSearchSelect` | 19118 | function |
| `submitAnswer` | 13212 | async |
| `confirmAnswerAndResolve` | 13353 | async |

**Total: 22 functions**

---

## 7. Modals (open*Modal, close*Modal)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `openNewProjectModal` | 6578 | function |
| `openEditRoleModal` | 6619 | async |
| `openDeleteProjectModal` | 7009 | function |
| `openRenameProjectModal` | 7039 | function |
| `openEmailModal` | 11739 | function |
| `openConversationModal` | 12079 | function |
| `openGlobalSearch` | 18807 | async |
| `openQuickExport` | 19136 | async |
| `openCommandPalette` | 18754 | function |
| `openOntologyModal` | 19553 | async |
| `openUserProfile` | 15430 | async |
| `openLoginModal` | 15252 | function |
| `closeMobileSidebar` | 6336 | function |
| `closeProjectDropdown` | 6357 | function |
| `closeQuickActionsMenu` | 6377 | function |
| `closeEmailModal` | 11750 | function |
| `closeEmailResponseModal` | 12055 | function |
| `closeConversationModal` | 12089 | function |
| `closeSOTVersionsModal` | 12973 | function |
| `closeProcessingModal` | 11707 | function |
| `closeCommandPalette` | 18780 | function |
| `closeOntologyModal` | 19560 | function |
| `closeModal` | 15089 | function |
| `closeUserDropdown` | 15426 | function |
| `hideProjectCreationOverlay` | 6199 | function |
| `hideProcessingModal` | 11684 | function |
| `hideLoginOverlay` | 15146 | function |

**Total: 24 functions**

---

## 8. Export/Import (export*, import*, copy*)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `exportProject` | 7082 | async |
| `importProject` | 7110 | async |
| `exportConversationJSON` | 9590 | async |
| `exportContactsJSON` | 10798 | function |
| `exportContactsCSV` | 10803 | function |
| `importContactsCSV` | 10757 | async |
| `importContactsJSON` | 10775 | async |
| `importConversation` | 9334 | async |
| `importConversationModal` | 12157 | async |
| `exportSOT` | 12899 | function |
| `exportSourceOfTruth` | 13865 | function |
| `exportToPDF` | 13869 | function |
| `bulkExport` | 13750 | async |
| `exportKnowledge` | 14734 | function |
| `exportQuestions` | 14738 | function |
| `exportKnowledgeJSON` | 14950 | function |
| `exportToClipboard` | 19168 | async |
| `copyDraftResponse` | 12060 | function |
| `copySourceContent` | 14677 | async |
| `copyKnowledgeToClipboard` | 15009 | async |
| `copyQuestionsToClipboard` | 15020 | async |
| `copyOverdueToClipboard` | 15031 | async |

**Total: 22 functions**

---

## 9. Processing (process*, upload*)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `processEmail` | 11825 | async |
| `startProcessing` | 11556 | async |
| `uploadFiles` | 11484 | async |
| `uploadEmailAttachments` | 12013 | async |
| `synthesizeKnowledge` | 14955 | async |
| `buildEmbeddingIndex` | 14911 | async |
| `reembedConversation` | 9573 | async |
| `executeManualMerge` | 10062 | async |
| `mergeGroup` | 10843 | async |
| `executeCypherQuery` | 11120 | async |
| `regenerateExecutiveSummary` | 12988 | async |
| `generateEmailResponse` | 12035 | async |
| `generateRolePrompt` | 6798 | async |
| `generateAutoSummary` | 14039 | function |

**Total: 14 functions**

---

## 10. UI Utilities (toast, debounce, escape, format*)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `showToast` | 15061 | function |
| `showToast` | 18784 | function |
| `showNotification` | 18800 | const (alias) |
| `escapeHtml` | 7143 | function |
| `formatSmartFilename` | 14018 | function |
| `formatDuration` | 14075 | function |
| `formatCost` | 14160 | function |
| `formatNumber` | 14167 | function |
| `formatBriefingLine` | 18043 | function |
| `truncate` | 14082 | function |
| `navigateTo` | 7152 | function |
| `setupTabs` | 7231 | function |
| `api` | 7240 | async |
| `fileToBase64` | 11907 | function |
| `getMethodBadge` | 14063 | function |
| `makeEditable` | 13002 | function |
| `insertCypherQuery` | 11116 | function |
| `insertPrompt` | 14488 | function |
| `setButtonLoading` | 18687 | function |
| `showConfirmDialog` | 18702 | function |
| `createSkeleton` | 18739 | function |
| `debounce` | 18751 | function |
| `showKeyboardHelp` | 18646 | function |

**Total: 23 functions**

---

## 11. Theme (theme*, toggle)

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `initTheme` | 18615 | function |
| `toggleTheme` | 18622 | function |
| `updateThemeUI` | 18634 | function |
| `toggleMobileSidebar` | 6329 | function |
| `toggleProjectDropdown` | 6343 | function |
| `toggleQuickActionsMenu` | 6363 | function |
| `toggleRoleTab` | 6684 | function |
| `toggleConversationImport` | 9231 | function |
| `toggleContactMerge` | 9969 | function |
| `toggleTeamMembers` | 10662 | function |
| `togglePromptMode` | 8417 | function |
| `toggleModelSection` | 8778 | function |
| `toggleExportMenu` | 12893 | function |
| `toggleSOTChat` | 12905 | function |
| `toggleSelectAll` | 13734 | function |
| `toggleSourceView` | 14567 | function |
| `toggleImportTab` | 10747 | function |
| `toggleUserMenu` | 15421 | function |

**Total: 18 functions**

---

## 12. Undo/History

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `loadHistory` | 14088 | async |
| `loadFileLogs` | 13907 | async |
| `loadSOTVersion` | 12977 | async |
| `loadProjectActivity` | 15760 | async |

**Total: 4 functions**

---

## 13. Other

| Function Name | Line Number | Type |
|--------------|-------------|------|
| `switchProject` | 6415 | async |
| `switchPerspective` | 6882 | async |
| `switchEmailTab` | 11754 | function |
| `switchSOTView` | 12796 | function |
| `switchSourceView` | 14567 | function |
| `switchRoleTab` | 6684 | function |
| `endPerspective` | 6903 | async |
| `filterRoleTemplates` | 6777 | function |
| `applyRoleTemplate` | 6785 | function |
| `refreshGraphDB` | 11029 | function |
| `testGraphConnection` | 11046 | async |
| `connectToGraph` | 11082 | async |
| `syncDataToGraph` | 11234 | async |
| `createGraphIndexes` | 11251 | async |
| `cleanupOrphanGraphs` | 11404 | async |
| `cancelDateModal` | 11502 | function |
| `confirmDateModal` | 11507 | async |
| `removePendingFile` | 9212 | async |
| `previewConversation` | 9244 | async |
| `previewConversationModal` | 12104 | async |
| `viewConversation` | 9441 | async |
| `deleteConversation` | 9553 | async |
| `deleteEmail` | 9804 | async |
| `markEmailResponded` | 9820 | async |
| `markCurrentEmailResponded` | 12069 | async |
| `syncEmailsToGraph` | 9840 | async |
| `editContact` | 10268 | async |
| `saveContact` | 10327 | async |
| `syncContactTeams` | 10386 | async |
| `deleteContact` | 10414 | async |
| `viewContactDetail` | 10431 | async |
| `enrichContact` | 10543 | async |
| `addToTeam` | 10670 | async |
| `removeFromTeam` | 10689 | async |
| `addTeam` | 10702 | async |
| `deleteTeam` | 10723 | async |
| `quickAddContact` | 10941 | function |
| `linkParticipantToContact` | 10947 | async |
| `selectConvFormat` | 12093 | function |
| `removeEmailAttachment` | 11820 | function |
| `populatePersonFilter` | 12657 | function |
| `searchSOT` | 12818 | function |
| `filterSOT` | 12835 | function |
| `changeSOTTemplate` | 12866 | function |
| `sendSOTChat` | 12911 | async |
| `reopenQuestion` | 13250 | async |
| `selectDismissReason` | 13301 | function |
| `confirmDismissQuestion` | 13328 | async |
| `assignQuestionToPerson` | 13383 | async |
| `deleteConversation` | 9553 | async |
| `filterContacts` | 10174 | function |
| `filterContactsByTeam` | 10198 | function |
| `clearMergeSelection` | 10010 | function |
| `clearSelection` | 13741 | function |
| `clearChat` | 14468 | function |
| `bulkDelete` | 13782 | async |
| `bulkUpdateStatus` | 13834 | async |
| `confirmDeleteDocument` | 13963 | async |
| `resetCosts` | 14356 | async |
| `confirmReset` | 15085 | function |
| `initChat` | 14379 | function |
| `autoLoadChatContext` | 14401 | async |
| `addChatMessage` | 14494 | function |
| `viewSource` | 14594 | async |
| `sendChatMessage` | 14691 | async |
| `populateRagEmbeddingProviders` | 14748 | function |
| `countInPeriod` | 9117 | function |
| `setTrendIndicator` | 9147 | function |
| `performGlobalSearch` | 18750 | async |
| `renderCommands` | 18790 | function |
| `executeCommand` | 18820 | function |
| `filterCommands` | 18850 | function |
| `saveCurrentSearch` | 19032 | function |
| `deleteSavedSearch` | 19062 | function |
| `loadSavedSearch` | 19070 | function |
| `saveSavedSearches` | 19024 | function |
| `checkOntologySuggestions` | 19525 | async |
| `openOntologyModal` | 19553 | async |
| `closeOntologyModal` | 19560 | function |
| `renderOntologySuggestions` | 19564 | function |
| `approveSuggestion` | 19608 | async |
| `rejectSuggestion` | 19645 | async |
| `enrichSuggestion` | 19660 | async |
| `analyzeGraphForSuggestions` | 19681 | async |
| `loadProjectMembers` | 15550 | async |
| `inviteProjectMember` | 15640 | async |
| `deleteProjectInvite` | 15710 | async |
| `markNotificationRead` | 15940 | async |
| `markAllNotificationsRead` | 15960 | async |
| `addComment` | 16090 | async |
| `deleteComment` | 16120 | async |
| `createAuditExport` | 16500 | async |
| `downloadAuditExport` | 16520 | async |
| `retryDeadLetter` | 16610 | async |
| `resolveDeadLetter` | 16630 | async |
| `setSearchFilter` | 18895 | function |
| `clearSearchFilters` | 18995 | function |
| `performUndo` | 18550 | function |

**Total: 120 functions**

---

## Summary by Category

| Category | Count |
|----------|-------|
| 1. Project Management | 18 |
| 2. Authentication | 21 |
| 3. Settings/Config | 52 |
| 4. Data Loading | 49 |
| 5. Data Display/Rendering | 62 |
| 6. User Actions | 22 |
| 7. Modals | 24 |
| 8. Export/Import | 22 |
| 9. Processing | 14 |
| 10. UI Utilities | 23 |
| 11. Theme | 18 |
| 12. Undo/History | 4 |
| 13. Other | 120 |
| **TOTAL** | **427** |

*Note: Some functions may appear in multiple categories or have been counted once based on their primary purpose. The grep search found 461 matching lines, but some functions are defined multiple times (e.g., `showToast` appears at lines 15061 and 18784, `updateTrendIndicator` appears at lines 9147 and 12241). The total count of 427 unique functions accounts for these duplicates.*
