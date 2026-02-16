/**
 * Settings full-page view (same content as SettingsModal, no overlay).
 * Mounted when user opens the Settings tab.
 */

import { appStore } from '@stores/app';
import { theme } from '@services/theme';
import { getSettingsMarkup, bindSettingsEvents } from '@components/modals/SettingsModal';

export interface SettingsPageOptions {
  /** Called when user clicks Back to Dashboard or Cancel */
  onBack?: () => void;
  initialTab?: 'general' | 'data';
}

/**
 * Mount settings UI into the given container (full page, no modal).
 * Idempotent: safe to call again when switching to Settings tab.
 */
export function initSettingsPage(
  container: HTMLElement,
  options: SettingsPageOptions = {}
): void {
  const state = appStore.getState();
  const currentTheme = theme.getMode();
  const initialTab = options.initialTab ?? 'general';

  container.innerHTML = getSettingsMarkup(state, currentTheme, initialTab, {
    pageMode: true,
  });

  bindSettingsEvents(container, {
    onClose: options.onBack,
    onSaveSuccess: undefined, // stay on page after save
  });
}
