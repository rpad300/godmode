/**
 * Settings Modal Component - User Preferences
 * Simplified modal for user settings (Theme, Language, Data & Privacy)
 * Admin/LLM settings are now in the Admin panel (sidebar)
 */

import { createElement, on } from '../../utils/dom';
import { appStore } from '../../stores/app';
import { theme } from '../../services/theme';
import { toast } from '../../services/toast';
import { showCompaniesModal } from './CompaniesModal';

const MODAL_ID = 'settings-modal';

export interface SettingsModalProps {
  onSave?: (settings: Record<string, unknown>) => void;
  initialTab?: 'general' | 'data';
}

export interface SettingsBindOptions {
  onClose?: () => void;
  onManageCompanies?: () => void;
  onSaveSuccess?: () => void;
  onSave?: (settings: Record<string, unknown>) => void;
}

/**
 * Get settings card + styles HTML (shared by modal and full page).
 * When pageMode is true, header shows "Back to Dashboard" instead of close X.
 */
export function getSettingsMarkup(
  state: ReturnType<typeof appStore.getState>,
  currentTheme: string,
  initialTab: 'general' | 'data',
  options?: { pageMode?: boolean }
): string {
  const pageMode = options?.pageMode ?? false;
  const closeButtonHtml = pageMode
    ? `<button class="settings-close settings-back" id="close-settings-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:6px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to Dashboard
      </button>`
    : `<button class="settings-close" id="close-settings-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>`;

  return `
    <style>
      .settings-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
      }
      
      .settings-modal-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        width: 100%;
        max-width: 520px;
      }
      
      .settings-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.8);
        overflow: hidden;
      }
      
      [data-theme="dark"] .settings-card {
        background: linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%);
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1);
      }
      
      .settings-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 24px 28px;
        position: relative;
        overflow: hidden;
      }
      
      .settings-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      
      .settings-header-content {
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
        z-index: 1;
      }
      
      .settings-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255,255,255,0.3);
      }
      
      .settings-icon svg {
        width: 28px;
        height: 28px;
        stroke: white;
        fill: none;
      }
      
      .settings-title {
        flex: 1;
      }
      
      .settings-title h2 {
        color: white;
        font-size: 1.4rem;
        font-weight: 600;
        margin: 0;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      
      .settings-title p {
        color: rgba(255,255,255,0.85);
        font-size: 0.85rem;
        margin: 4px 0 0;
      }
      
      .settings-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        z-index: 2;
      }
      
      .settings-close:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .settings-close svg {
        width: 18px;
        height: 18px;
        stroke: white;
      }
      
      .settings-tabs {
        display: flex;
        gap: 8px;
        padding: 16px 24px;
        background: var(--bg-secondary, #f8fafc);
        border-bottom: 1px solid var(--border-color, #e2e8f0);
      }
      
      [data-theme="dark"] .settings-tabs {
        background: rgba(30,41,59,0.5);
        border-bottom-color: rgba(255,255,255,0.1);
      }
      
      .settings-tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: var(--text-secondary, #64748b);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        border-radius: 10px;
        transition: all 0.2s;
      }
      
      .settings-tab:hover {
        background: var(--bg-hover, rgba(0,0,0,0.05));
        color: var(--text-primary, #1e293b);
      }
      
      .settings-tab.active {
        background: white;
        color: #e11d48;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }
      
      [data-theme="dark"] .settings-tab.active {
        background: rgba(225,29,72,0.15);
        color: #fb7185;
      }
      
      .settings-tab svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        fill: none;
      }
      
      .settings-body {
        padding: 24px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .settings-section {
        display: none;
      }
      
      .settings-section.active {
        display: block;
      }
      
      .settings-section h3 {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .settings-section h3 svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
      }
      
      .form-group {
        margin-bottom: 20px;
      }
      
      .form-group:last-child {
        margin-bottom: 0;
      }
      
      .form-group label {
        display: block;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        margin-bottom: 8px;
      }
      
      .form-group p.hint {
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
        margin: 6px 0 0;
      }
      
      .form-select {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 10px;
        background: var(--bg-primary, white);
        color: var(--text-primary, #1e293b);
        font-size: 0.9rem;
        transition: border-color 0.2s, box-shadow 0.2s;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2.5 4.5L6 8l3.5-3.5'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        cursor: pointer;
      }
      
      .form-select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
      }
      
      [data-theme="dark"] .form-select {
        background-color: rgba(30,41,59,0.8);
        border-color: rgba(255,255,255,0.1);
      }
      
      .toggle-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 10px;
        margin-bottom: 12px;
      }
      
      [data-theme="dark"] .toggle-group {
        background: rgba(30,41,59,0.5);
      }
      
      .toggle-group:last-child {
        margin-bottom: 0;
      }
      
      .toggle-info {
        flex: 1;
      }
      
      .toggle-info strong {
        display: block;
        font-size: 0.9rem;
        color: var(--text-primary, #1e293b);
        margin-bottom: 2px;
      }
      
      .toggle-info span {
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
      }
      
      .toggle-switch {
        position: relative;
        width: 48px;
        height: 26px;
        flex-shrink: 0;
      }
      
      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .toggle-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: var(--bg-tertiary, #cbd5e1);
        border-radius: 26px;
        transition: 0.3s;
      }
      
      .toggle-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.3s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .toggle-switch input:checked + .toggle-slider {
        background: #e11d48;
      }
      
      .toggle-switch input:checked + .toggle-slider::before {
        transform: translateX(22px);
      }
      
      .settings-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 24px;
        background: var(--bg-secondary, #f8fafc);
        border-top: 1px solid var(--border-color, #e2e8f0);
      }
      
      [data-theme="dark"] .settings-footer {
        background: rgba(30,41,59,0.5);
        border-top-color: rgba(255,255,255,0.1);
      }
      
      .btn-cancel {
        padding: 10px 20px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 10px;
        background: var(--bg-primary, white);
        color: var(--text-primary, #1e293b);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .btn-cancel:hover {
        background: var(--bg-hover, #f1f5f9);
      }
      
      .btn-save {
        padding: 10px 24px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .btn-save:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }
      
      .btn-save svg {
        width: 18px;
        height: 18px;
        stroke: white;
      }
      
      .admin-notice {
        background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.1) 100%);
        border: 1px solid rgba(59,130,246,0.3);
        border-radius: 10px;
        padding: 14px 16px;
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .admin-notice svg {
        width: 20px;
        height: 20px;
        stroke: #3b82f6;
        flex-shrink: 0;
      }
      
      .admin-notice p {
        font-size: 0.85rem;
        color: var(--text-secondary, #64748b);
        margin: 0;
      }
      
      .admin-notice strong {
        color: #3b82f6;
      }
      .settings-back {
        position: static;
        display: inline-flex;
        align-items: center;
        padding: 8px 14px;
        font-size: 0.9rem;
        font-weight: 500;
        color: rgba(255,255,255,0.95);
      }
      .settings-back:hover {
        background: rgba(255,255,255,0.15);
      }
      .settings-page-card .settings-body {
        max-height: none;
      }
    </style>
    
    <div class="settings-card ${pageMode ? 'settings-page-card' : ''}">
      <!-- Header -->
      <div class="settings-header">
        ${closeButtonHtml}
        <div class="settings-header-content">
          <div class="settings-icon">
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </div>
          <div class="settings-title">
            <h2>Settings</h2>
            <p>Your personal preferences</p>
          </div>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="settings-tabs">
        <button class="settings-tab ${initialTab === 'general' ? 'active' : ''}" data-tab="general">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          General
        </button>
        <button class="settings-tab ${initialTab === 'data' ? 'active' : ''}" data-tab="data">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Data & Privacy
        </button>
      </div>
      
      <!-- Body -->
      <div class="settings-body">
        <!-- General Section -->
        <div class="settings-section ${initialTab === 'general' ? 'active' : ''}" id="section-general">
          <h3>
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
            </svg>
            Appearance
          </h3>
          
          <div class="form-group">
            <label>Theme</label>
            <select class="form-select" id="setting-theme">
              <option value="system" ${currentTheme === 'system' ? 'selected' : ''}>System (Auto)</option>
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
            </select>
            <p class="hint">Choose your preferred color scheme</p>
          </div>
          
          <div class="form-group">
            <label>Language</label>
            <select class="form-select" id="setting-language">
              <option value="en" ${state.config.language === 'en' ? 'selected' : ''}>English</option>
              <option value="pt" ${state.config.language === 'pt' ? 'selected' : ''}>Portugues</option>
              <option value="es" ${state.config.language === 'es' ? 'selected' : ''}>Espanol</option>
            </select>
            <p class="hint">Interface language preference</p>
          </div>
          
          <h3 style="margin-top: 20px;">
            <svg viewBox="0 0 24 24" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            Companies
          </h3>
          <p class="hint" style="margin-bottom: 10px;">Manage company profiles for branding and document templates.</p>
          <button type="button" class="btn-save" id="settings-manage-companies-btn" style="margin-top: 0;">
            <svg viewBox="0 0 24 24" stroke-width="2" style="width: 18px; height: 18px;"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            Manage companies
          </button>
          
          ${state.currentUser?.role === 'superadmin' ? `
            <div class="admin-notice">
              <svg viewBox="0 0 24 24" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <p>For <strong>LLM configuration</strong>, <strong>Graph</strong>, and other platform settings, use the <strong>Admin</strong> section in the sidebar menu.</p>
            </div>
          ` : ''}
        </div>
        
        <!-- Data & Privacy Section -->
        <div class="settings-section ${initialTab === 'data' ? 'active' : ''}" id="section-data">
          <h3>
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Privacy Settings
          </h3>
          
          <div class="toggle-group">
            <div class="toggle-info">
              <strong>Analytics</strong>
              <span>Help improve GodMode with anonymous usage data</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-analytics" ${state.config.analyticsEnabled !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="toggle-group">
            <div class="toggle-info">
              <strong>Error Reporting</strong>
              <span>Automatically report errors to help fix bugs</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-error-reporting" ${state.config.errorReportingEnabled !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="toggle-group">
            <div class="toggle-info">
              <strong>AI Data Improvement</strong>
              <span>Allow anonymized data to improve AI responses</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-ai-improvement" ${state.config.aiImprovementEnabled === true ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="settings-footer">
        <button class="btn-cancel" id="cancel-settings-btn">Cancel</button>
        <button class="btn-save" id="save-settings-btn">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Save Settings
        </button>
      </div>
    </div>
  `;
}

/**
 * Create and show settings modal
 */
export function showSettingsModal(props: SettingsModalProps = {}): void {
  // Remove existing modal if any
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const state = appStore.getState();
  const currentTheme = theme.getMode();
  const initialTab = props.initialTab || 'general';

  const modalOverlay = createElement('div', { className: 'settings-modal-overlay' });
  modalOverlay.setAttribute('data-modal-id', MODAL_ID);
  const container = createElement('div', { className: 'settings-modal-container' });
  container.innerHTML = getSettingsMarkup(state, currentTheme, initialTab, { pageMode: false });
  modalOverlay.appendChild(container);
  document.body.appendChild(modalOverlay);

  const closeModal = () => modalOverlay.remove();
  bindSettingsEvents(modalOverlay, {
    ...props,
    onClose: closeModal,
    onSaveSuccess: closeModal,
    onManageCompanies: () => {
      closeModal();
      showCompaniesModal();
    },
  });
}

/**
 * Bind event handlers (shared by modal and full page).
 */
export function bindSettingsEvents(
  root: HTMLElement,
  props: SettingsModalProps & SettingsBindOptions
): void {
  const closeBtn = root.querySelector('#close-settings-btn');
  const cancelBtn = root.querySelector('#cancel-settings-btn');
  const isOverlay = root.classList.contains('settings-modal-overlay');

  const closeAction = () => {
    if (props.onClose) props.onClose();
    else if (isOverlay) root.remove();
  };

  if (closeBtn) on(closeBtn as HTMLElement, 'click', closeAction);
  if (cancelBtn) on(cancelBtn as HTMLElement, 'click', closeAction);

  if (isOverlay) {
    on(root, 'click', (e) => {
      if (e.target === root) closeAction();
    });
  }

  const manageCompaniesBtn = root.querySelector('#settings-manage-companies-btn');
  if (manageCompaniesBtn) {
    on(manageCompaniesBtn as HTMLElement, 'click', () => {
      if (props.onManageCompanies) props.onManageCompanies();
      else {
        closeAction();
        showCompaniesModal();
      }
    });
  }

  // Tab switching
  const tabs = root.querySelectorAll('.settings-tab');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      const tabId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      root.querySelectorAll('.settings-section').forEach(section => {
        section.classList.remove('active');
      });
      const targetSection = root.querySelector(`#section-${tabId}`);
      if (targetSection) targetSection.classList.add('active');
    });
  });

  const themeSelect = root.querySelector('#setting-theme') as HTMLSelectElement;
  if (themeSelect) {
    on(themeSelect, 'change', () => {
      theme.set(themeSelect.value as 'light' | 'dark' | 'system');
    });
  }

  const saveBtn = root.querySelector('#save-settings-btn');
  if (saveBtn) {
    on(saveBtn as HTMLElement, 'click', () => {
      const settings = {
        theme: (root.querySelector('#setting-theme') as HTMLSelectElement)?.value,
        language: (root.querySelector('#setting-language') as HTMLSelectElement)?.value,
        analyticsEnabled: (root.querySelector('#setting-analytics') as HTMLInputElement)?.checked,
        errorReportingEnabled: (root.querySelector('#setting-error-reporting') as HTMLInputElement)?.checked,
        aiImprovementEnabled: (root.querySelector('#setting-ai-improvement') as HTMLInputElement)?.checked,
      };
      appStore.setConfig({
        ...appStore.getState().config,
        ...settings,
      });
      props.onSave?.(settings);
      toast.success('Settings saved');
      props.onSaveSuccess?.();
    });
  }
}

/**
 * Close settings modal
 */
export function closeSettingsModal(): void {
  const modal = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (modal) modal.remove();
}

export default showSettingsModal;
