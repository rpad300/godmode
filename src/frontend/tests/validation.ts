/**
 * Frontend Validation Tests
 * Basic structural and functional validation
 */

// Import all modules to ensure they load correctly
import * as services from '../services';
import * as stores from '../stores';
import * as components from '../components';
import * as utils from '../utils';

interface ValidationResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: ValidationResult[] = [];

function test(name: string, fn: () => void | boolean): void {
  try {
    const result = fn();
    results.push({
      name,
      passed: result !== false,
    });
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Services Validation
// ============================================================================

test('Services: theme exists and has methods', () => {
  return typeof services.theme === 'object' &&
    typeof services.theme.getMode === 'function' &&
    typeof services.theme.set === 'function' &&
    typeof services.theme.toggle === 'function';
});

test('Services: toast exists and has methods', () => {
  return typeof services.toast === 'object' &&
    typeof services.toast.success === 'function' &&
    typeof services.toast.error === 'function';
});

test('Services: http client exists and has methods', () => {
  return typeof services.http === 'object' &&
    typeof services.http.get === 'function' &&
    typeof services.http.post === 'function';
});

test('Services: storage exists and has methods', () => {
  return typeof services.storage === 'object' &&
    typeof services.storage.get === 'function' &&
    typeof services.storage.set === 'function';
});

test('Services: shortcuts exists and has methods', () => {
  return typeof services.shortcuts === 'object' &&
    typeof services.shortcuts.register === 'function';
});

test('Services: undoManager exists and has methods', () => {
  return typeof services.undoManager === 'object' &&
    typeof services.undoManager.push === 'function' &&
    typeof services.undoManager.undo === 'function';
});

// ============================================================================
// Stores Validation
// ============================================================================

test('Stores: appStore exists and has methods', () => {
  return typeof stores.appStore === 'object' &&
    typeof stores.appStore.getState === 'function' &&
    typeof stores.appStore.subscribe === 'function';
});

test('Stores: appStore state has required properties', () => {
  const state = stores.appStore.getState();
  return 'currentProjectId' in state &&
    'currentUser' in state &&
    'authConfigured' in state;
});

test('Stores: uiStore exists and has methods', () => {
  return typeof stores.uiStore === 'object' &&
    typeof stores.uiStore.getState === 'function';
});

test('Stores: dataStore exists and has methods', () => {
  return typeof stores.dataStore === 'object' &&
    typeof stores.dataStore.getState === 'function';
});

test('Stores: dataStore state has required properties', () => {
  const state = stores.dataStore.getState();
  return 'questions' in state &&
    'risks' in state &&
    'actions' in state;
});

test('Stores: chartsStore exists and has methods', () => {
  return typeof stores.chartsStore === 'object' &&
    typeof stores.chartsStore.registerChart === 'function';
});

// ============================================================================
// Components Validation
// ============================================================================

test('Components: createModal exists', () => {
  return typeof components.createModal === 'function';
});

test('Components: openModal exists', () => {
  return typeof components.openModal === 'function';
});

test('Components: closeModal exists', () => {
  return typeof components.closeModal === 'function';
});

test('Components: createHeader exists', () => {
  return typeof components.createHeader === 'function';
});

test('Components: createSidebar exists', () => {
  return typeof components.createSidebar === 'function';
});

test('Components: createDashboard exists', () => {
  return typeof components.createDashboard === 'function';
});

test('Components: createChat exists', () => {
  return typeof components.createChat === 'function';
});

// ============================================================================
// Modal Components Validation
// ============================================================================

test('Modals: showSettingsModal exists', () => {
  return typeof components.showSettingsModal === 'function';
});

test('Modals: showProcessingModal exists', () => {
  return typeof components.showProcessingModal === 'function';
});

test('Modals: showAuthModal exists', () => {
  return typeof components.showAuthModal === 'function';
});

test('Modals: showProjectModal exists', () => {
  return typeof components.showProjectModal === 'function';
});

test('Modals: showContactModal exists', () => {
  return typeof components.showContactModal === 'function';
});

test('Modals: showQuestionModal exists', () => {
  return typeof components.showQuestionModal === 'function';
});

test('Modals: showRiskModal exists', () => {
  return typeof components.showRiskModal === 'function';
});

test('Modals: showActionModal exists', () => {
  return typeof components.showActionModal === 'function';
});

test('Modals: showDecisionModal exists', () => {
  return typeof components.showDecisionModal === 'function';
});

test('Modals: showTeamModal exists', () => {
  return typeof components.showTeamModal === 'function';
});

test('Modals: showInviteModal exists', () => {
  return typeof components.showInviteModal === 'function';
});

test('Modals: showRoleModal exists', () => {
  return typeof components.showRoleModal === 'function';
});

test('Modals: showExportModal exists', () => {
  return typeof components.showExportModal === 'function';
});

test('Modals: showFileUploadModal exists', () => {
  return typeof components.showFileUploadModal === 'function';
});

test('Modals: showDeveloperModal exists', () => {
  return typeof components.showDeveloperModal === 'function';
});

test('Modals: showShortcutsModal exists', () => {
  return typeof components.showShortcutsModal === 'function';
});

test('Modals: showNotificationsModal exists', () => {
  return typeof components.showNotificationsModal === 'function';
});

test('Modals: showEmailModal exists', () => {
  return typeof components.showEmailModal === 'function';
});

test('Modals: showGraphModal exists', () => {
  return typeof components.showGraphModal === 'function';
});

test('Modals: showHistoryModal exists', () => {
  return typeof components.showHistoryModal === 'function';
});

test('Modals: showCommentModal exists', () => {
  return typeof components.showCommentModal === 'function';
});

// ============================================================================
// Utils Validation
// ============================================================================

test('Utils: createElement exists', () => {
  return typeof utils.createElement === 'function';
});

test('Utils: formatNumber exists', () => {
  return typeof utils.formatNumber === 'function';
});

test('Utils: formatDate exists', () => {
  return typeof utils.formatDate === 'function';
});

test('Utils: formatRelativeTime exists', () => {
  return typeof utils.formatRelativeTime === 'function';
});

// ============================================================================
// Run and Report
// ============================================================================

export function runValidation(): { passed: number; failed: number; results: ValidationResult[] } {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('='.repeat(60));
  console.log('FRONTEND VALIDATION RESULTS');
  console.log('='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(60));

  results.forEach(r => {
    const status = r.passed ? '✓' : '✗';
    console.log(`${status} ${r.name}${r.error ? ` - ${r.error}` : ''}`);
  });

  console.log('='.repeat(60));

  return { passed, failed, results };
}

// Run immediately if this is the entry point
if (import.meta.url === new URL(import.meta.url).href) {
  runValidation();
}

export default runValidation;
