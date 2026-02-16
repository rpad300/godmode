/**
 * Profile Modal - SOTA Design
 * View and edit user profile with modern glassmorphism design
 */

import { createModal, openModal, closeModal } from '@components/Modal';
import { createElement, on } from '@lib/dom';
import { profileService, UserProfile } from '@services/profile';
import { appStore } from '@stores/app';
import { toast } from '@services/toast';
import { http } from '@services/api';
import * as krispService from '@services/krisp';

const MODAL_ID = 'profile-modal';

interface Timezone {
  code: string;
  name: string;
  region?: string;
  utc_offset: string;
  abbreviation?: string;
}

export interface ProfileModalProps {
  onClose?: () => void;
  onUpdate?: (profile: UserProfile) => void;
}

let currentProps: ProfileModalProps = {};
let currentProfile: UserProfile | null = null;
let cachedTimezones: Timezone[] | null = null;

/**
 * Show profile modal
 */
export function showProfileModal(props: ProfileModalProps = {}): void {
  currentProps = props;

  const content = createModalContent();

  const modal = createModal({
    id: MODAL_ID,
    title: '',
    size: 'lg',
    content: content,
    onClose: props.onClose,
  });

  modal.classList.add('profile-modal-overlay');

  const modalContent = modal.querySelector('.modal-content') as HTMLElement;
  if (modalContent) {
    modalContent.classList.add('profile-modal-content');
  }
  const modalHeader = modal.querySelector('.modal-header') as HTMLElement;
  if (modalHeader) {
    modalHeader.classList.add('hidden');
  }

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  loadProfile(content);
}

/**
 * Create modal content
 */
function createModalContent(): HTMLElement {
  const container = createElement('div', { className: 'profile-modal-sota' });

  container.innerHTML = `
    <style>
      .profile-modal-sota {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .profile-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.8),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        overflow: hidden;
      }
      
      [data-theme="dark"] .profile-card {
        background: linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%);
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }
      
      .profile-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 32px;
        position: relative;
        overflow: hidden;
      }
      
      .profile-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      
      .profile-header-content {
        display: flex;
        align-items: center;
        gap: 24px;
        position: relative;
        z-index: 1;
      }
      
      .profile-avatar-large {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: 600;
        color: white;
        border: 4px solid rgba(255,255,255,0.3);
        overflow: hidden;
        flex-shrink: 0;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .profile-avatar-large:hover {
        border-color: rgba(255,255,255,0.5);
        transform: scale(1.05);
      }
      
      .profile-avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .avatar-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
        border-radius: 50%;
      }
      
      .profile-avatar-large:hover .avatar-overlay {
        opacity: 1;
      }
      
      .avatar-overlay svg {
        width: 28px;
        height: 28px;
        color: white;
      }
      
      .profile-user-info h2 {
        margin: 0 0 4px 0;
        font-size: 28px;
        font-weight: 700;
        color: white;
      }
      
      .profile-user-info .email {
        color: rgba(255,255,255,0.8);
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .profile-user-info .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255,255,255,0.2);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: white;
      }
      
      .profile-close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 10;
      }
      
      .profile-close-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: rotate(90deg);
      }
      
      .profile-close-btn svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      
      .profile-tabs-nav {
        display: flex;
        gap: 0;
        padding: 0 24px;
        background: rgba(0,0,0,0.02);
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      
      [data-theme="dark"] .profile-tabs-nav {
        background: rgba(255,255,255,0.02);
        border-bottom-color: rgba(255,255,255,0.06);
      }
      
      .profile-tab-btn {
        padding: 16px 24px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      }
      
      .profile-tab-btn:hover {
        color: #1e293b;
      }
      
      [data-theme="dark"] .profile-tab-btn:hover {
        color: #e2e8f0;
      }
      
      .profile-tab-btn.active {
        color: #e11d48;
      }
      
      .profile-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 24px;
        right: 24px;
        height: 2px;
        background: #e11d48;
        border-radius: 2px 2px 0 0;
      }
      
      .profile-tab-icon {
        width: 18px;
        height: 18px;
        margin-right: 8px;
        vertical-align: middle;
      }
      
      .profile-body {
        padding: 32px;
      }
      
      .profile-section {
        display: none;
      }
      
      .profile-section.active {
        display: block;
      }
      
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
      
      .form-grid .full-width {
        grid-column: 1 / -1;
      }
      
      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .form-field label {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      [data-theme="dark"] .form-field label {
        color: #94a3b8;
      }
      
      .form-field input,
      .form-field select,
      .form-field textarea {
        padding: 12px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        font-size: 14px;
        background: #f8fafc;
        color: #1e293b;
        transition: all 0.2s;
        outline: none;
      }
      
      [data-theme="dark"] .form-field input,
      [data-theme="dark"] .form-field select,
      [data-theme="dark"] .form-field textarea {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .form-field input:focus,
      .form-field select:focus,
      .form-field textarea:focus {
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }
      
      .form-field input:disabled {
        background: #f1f5f9;
        color: #94a3b8;
        cursor: not-allowed;
      }
      
      [data-theme="dark"] .form-field input:disabled {
        background: rgba(255,255,255,0.02);
        color: #64748b;
      }
      
      .form-field textarea {
        resize: vertical;
        min-height: 100px;
      }
      
      .form-hint {
        font-size: 12px;
        color: #94a3b8;
      }
      
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid rgba(0,0,0,0.06);
      }
      
      [data-theme="dark"] .form-actions {
        border-top-color: rgba(255,255,255,0.06);
      }
      
      .btn-sota {
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      
      .btn-sota.primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-sota.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
      
      .btn-sota.secondary {
        background: #f1f5f9;
        color: #475569;
      }
      
      [data-theme="dark"] .btn-sota.secondary {
        background: rgba(255,255,255,0.1);
        color: #e2e8f0;
      }
      
      .btn-sota.secondary:hover {
        background: #e2e8f0;
      }
      
      [data-theme="dark"] .btn-sota.secondary:hover {
        background: rgba(255,255,255,0.15);
      }
      
      .btn-sota.danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      .btn-sota.danger:hover {
        background: #fef2f2;
        border-color: #dc2626;
      }
      
      /* Security Section */
      .security-section {
        margin-bottom: 32px;
      }
      
      .security-section h3 {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      [data-theme="dark"] .security-section h3 {
        color: #f1f5f9;
      }
      
      .danger-zone {
        background: linear-gradient(135deg, #fef2f2 0%, #fff 100%);
        border: 1px solid #fecaca;
        border-radius: 16px;
        padding: 24px;
      }
      
      [data-theme="dark"] .danger-zone {
        background: linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(220,38,38,0.05) 100%);
        border-color: rgba(220,38,38,0.3);
      }
      
      .danger-zone h3 {
        color: #dc2626 !important;
      }
      
      .danger-zone p {
        color: #991b1b;
        font-size: 14px;
        margin: 0 0 16px 0;
      }
      
      [data-theme="dark"] .danger-zone p {
        color: #fca5a5;
      }
      
      /* Sessions */
      .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .session-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: #f8fafc;
        border-radius: 12px;
        border: 1px solid transparent;
      }
      
      [data-theme="dark"] .session-card {
        background: rgba(255,255,255,0.03);
      }
      
      .session-card.current {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
      }
      
      .session-info {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .session-icon {
        width: 44px;
        height: 44px;
        background: #e2e8f0;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      [data-theme="dark"] .session-icon {
        background: rgba(255,255,255,0.1);
      }
      
      .session-icon svg {
        width: 22px;
        height: 22px;
        color: #64748b;
      }
      
      .session-details h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      
      [data-theme="dark"] .session-details h4 {
        color: #f1f5f9;
      }
      
      .session-details p {
        margin: 0;
        font-size: 12px;
        color: #64748b;
      }
      
      .session-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
        background: #e11d48;
        color: white;
      }
      
      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: #94a3b8;
      }
      
      .empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .loading-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 48px;
      }
      
      .loading-spinner::after {
        content: '';
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #e11d48;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
    
    <div class="profile-card">
      <div class="loading-spinner"></div>
    </div>
  `;

  return container;
}

/**
 * Load profile data
 * @param bindOptions - When onBack is set (page mode), close button calls it instead of closeModal
 */
async function loadProfile(container: HTMLElement, bindOptions?: { onBack?: () => void }): Promise<void> {
  const card = container.querySelector('.profile-card') as HTMLElement;
  if (!card) return;

  try {
    // Load profile and timezones in parallel
    const [apiProfile, timezones] = await Promise.all([
      profileService.get(),
      loadTimezones()
    ]);

    if (apiProfile) {
      currentProfile = apiProfile;
      renderProfile(card, currentProfile, timezones, bindOptions);
    } else {
      // Fallback to current user from store
      const currentUser = appStore.getState().currentUser;
      if (currentUser) {
        currentProfile = {
          id: currentUser.id,
          email: currentUser.email,
          display_name: currentUser.name || currentUser.email?.split('@')[0] || 'User',
          avatar_url: currentUser.avatar,
          created_at: new Date().toISOString(),
        };
        renderProfile(card, currentProfile, timezones, bindOptions);
      } else {
        card.innerHTML = '<div class="empty-state">Please log in to view your profile</div>';
      }
    }
  } catch {
    // Fallback to current user
    const currentUser = appStore.getState().currentUser;
    if (currentUser) {
      currentProfile = {
        id: currentUser.id,
        email: currentUser.email,
        display_name: currentUser.name || 'User',
        avatar_url: currentUser.avatar,
        created_at: new Date().toISOString(),
      };
      renderProfile(card, currentProfile, undefined, bindOptions);
    } else {
      card.innerHTML = '<div class="empty-state">Failed to load profile</div>';
    }
  }
}

/**
 * Render profile
 */
function renderProfile(container: HTMLElement, profile: UserProfile, timezones?: Timezone[], bindOptions?: { onBack?: () => void }): void {
  const initials = getInitials(profile.display_name || profile.email);
  const currentUser = appStore.getState().currentUser;
  const role = currentUser?.role || profile.role || 'user';

  container.innerHTML = `
    <!-- Header -->
    <div class="profile-header">
      <button class="profile-close-btn" id="close-profile-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="profile-header-content">
        <label class="profile-avatar-large" for="avatar-input-hidden" id="profile-avatar-display">
          <img src="${profile.avatar_url || generateFallbackAvatar(profile.display_name || profile.email)}" alt="Avatar" onerror="this.src='${generateFallbackAvatar(profile.display_name || profile.email)}'">
          <div class="avatar-overlay">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <input type="file" id="avatar-input-hidden" accept="image/*" hidden>
        </label>
        
        <div class="profile-user-info">
          <h2>${escapeHtml(profile.display_name || profile.username || 'User')}</h2>
          <div class="email">
            ${escapeHtml(profile.email)}
            <span class="role-badge">
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                ${role === 'superadmin'
      ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
      : '<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>'
    }
              </svg>
              ${role === 'superadmin' ? 'Super Admin' : 'User'}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tabs Navigation -->
    <nav class="profile-tabs-nav">
      <button class="profile-tab-btn active" data-tab="general">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        General
      </button>
      <button class="profile-tab-btn" data-tab="security">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        Security
      </button>
      <button class="profile-tab-btn" data-tab="sessions">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        Sessions
      </button>
      <button class="profile-tab-btn" data-tab="integrations">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        Integrations
      </button>
    </nav>
    
    <!-- Tab Content -->
    <div class="profile-body">
      <!-- General Tab -->
      <div class="profile-section active" id="section-general">
        <form id="profile-form">
          <div class="form-grid">
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Email
              </label>
              <input type="email" value="${escapeHtml(profile.email)}" disabled>
              <span class="form-hint">Email cannot be changed</span>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                </svg>
                Username
              </label>
              <input type="text" name="username" value="${escapeHtml(profile.username || '')}" placeholder="Enter username">
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Display Name
              </label>
              <input type="text" name="display_name" value="${escapeHtml(profile.display_name || '')}" placeholder="Your display name">
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
                Bio
              </label>
              <textarea name="bio" placeholder="Tell us a bit about yourself">${escapeHtml(profile.bio || '')}</textarea>
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Avatar URL
              </label>
              <input type="url" name="avatar_url" id="avatar-url-input" value="${escapeHtml(profile.avatar_url || '')}" placeholder="https://example.com/avatar.jpg">
              <span class="form-hint">Enter an image URL or upload using the avatar above. Leave empty for auto-generated avatar.</span>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Timezone
              </label>
              <select name="timezone">
                ${generateTimezoneOptions(profile.timezone, timezones)}
              </select>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                </svg>
                Language
              </label>
              <select name="locale">
                <option value="en" ${profile.locale === 'en' ? 'selected' : ''}>English</option>
                <option value="pt" ${profile.locale === 'pt' ? 'selected' : ''}>Português</option>
                <option value="es" ${profile.locale === 'es' ? 'selected' : ''}>Español</option>
                <option value="fr" ${profile.locale === 'fr' ? 'selected' : ''}>Français</option>
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-sota primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Save Changes
            </button>
          </div>
        </form>
      </div>
      
      <!-- Security Tab -->
      <div class="profile-section" id="section-security">
        <div class="security-section">
          <h3>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
            Change Password
          </h3>
          
          <form id="password-form">
            <div class="form-grid">
              <div class="form-field full-width">
                <label>Current Password</label>
                <input type="password" name="current_password" required>
              </div>
              
              <div class="form-field">
                <label>New Password</label>
                <input type="password" name="new_password" minlength="12" required>
                <span class="form-hint">Minimum 12 characters</span>
              </div>
              
              <div class="form-field">
                <label>Confirm Password</label>
                <input type="password" name="confirm_password" required>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-sota primary">Update Password</button>
            </div>
          </form>
        </div>
        
        <div class="danger-zone">
          <h3>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Danger Zone
          </h3>
          <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button type="button" class="btn-sota danger" id="delete-account-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete Account
          </button>
        </div>
      </div>
      
      <!-- Sessions Tab -->
      <div class="profile-section" id="section-sessions">
        <div id="sessions-list" class="sessions-list">
          <div class="loading-spinner"></div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-sota secondary" id="revoke-all-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign out all other sessions
          </button>
        </div>
      </div>
      
      <!-- Integrations Tab -->
      <div class="profile-section" id="section-integrations">
        <div class="security-section">
          <h3>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
            Krisp AI Meeting Assistant
          </h3>
          <p class="form-hint form-hint-mb">
            Connect your Krisp account to automatically import meeting transcriptions into GodMode.
          </p>
          
          <div id="krisp-integration-content">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  bindEvents(container, bindOptions);
}

/**
 * Bind event handlers
 * @param container - Root profile view container
 * @param options - When onBack is set (page mode), close button calls it instead of closeModal
 */
function bindEvents(container: HTMLElement, options?: { onBack?: () => void }): void {
  // Close button
  const closeBtn = container.querySelector('#close-profile-btn');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', () => {
      if (options?.onBack) {
        options.onBack();
      } else {
        closeModal(MODAL_ID);
        currentProps.onClose?.();
      }
    });
  }

  // Tab switching
  const tabs = container.querySelectorAll('.profile-tab-btn');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabId = tab.getAttribute('data-tab');
      container.querySelectorAll('.profile-section').forEach(section => {
        section.classList.toggle('active', section.id === `section-${tabId}`);
      });

      if (tabId === 'sessions') {
        loadSessions();
      }
      if (tabId === 'integrations') {
        loadKrispIntegration(container);
      }
    });
  });

  // Avatar upload
  const avatarInput = container.querySelector('#avatar-input-hidden') as HTMLInputElement;
  if (avatarInput) {
    on(avatarInput, 'change', async () => {
      const file = avatarInput.files?.[0];
      if (file) {
        try {
          const avatarUrl = await profileService.uploadAvatar(file);
          const avatarEl = container.querySelector('.profile-avatar-large') as HTMLElement;
          if (avatarEl) {
            const img = avatarEl.querySelector('img');
            if (img) {
              img.src = avatarUrl;
            } else {
              avatarEl.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar">
                <div class="avatar-overlay">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <input type="file" id="avatar-input-hidden" accept="image/*" hidden>
              `;
            }
          }
          toast.success('Avatar updated');
        } catch {
          toast.error('Failed to upload avatar');
        }
      }
    });
  }

  // Avatar URL input - live preview
  const avatarUrlInput = container.querySelector('#avatar-url-input') as HTMLInputElement;
  const avatarDisplay = container.querySelector('#profile-avatar-display img') as HTMLImageElement;
  if (avatarUrlInput && avatarDisplay) {
    on(avatarUrlInput, 'input', () => {
      const url = avatarUrlInput.value.trim();
      if (url) {
        avatarDisplay.src = url;
      } else if (currentProfile) {
        // Use fallback if empty
        avatarDisplay.src = generateFallbackAvatar(currentProfile.display_name || currentProfile.email);
      }
    });
  }

  // Profile form submit
  const profileForm = container.querySelector('#profile-form') as HTMLFormElement;
  if (profileForm) {
    on(profileForm, 'submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(profileForm);
      const avatarUrl = (formData.get('avatar_url') as string)?.trim();
      const displayName = formData.get('display_name') as string || undefined;

      const data = {
        username: formData.get('username') as string || undefined,
        display_name: displayName,
        bio: formData.get('bio') as string || undefined,
        timezone: formData.get('timezone') as string || undefined,
        locale: formData.get('locale') as string || undefined,
        avatar_url: avatarUrl || (displayName ? generateFallbackAvatar(displayName) : undefined),
      };

      try {
        const updated = await profileService.update(data);
        currentProfile = updated;
        toast.success('Profile updated');
        currentProps.onUpdate?.(updated);

        // Update the avatar display
        if (avatarDisplay) {
          avatarDisplay.src = updated.avatar_url || generateFallbackAvatar(updated.display_name || updated.email);
        }
      } catch {
        toast.error('Failed to update profile');
      }
    });
  }

  // Password form submit
  const passwordForm = container.querySelector('#password-form') as HTMLFormElement;
  if (passwordForm) {
    on(passwordForm, 'submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(passwordForm);
      const currentPassword = formData.get('current_password') as string;
      const newPassword = formData.get('new_password') as string;
      const confirmPassword = formData.get('confirm_password') as string;

      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      try {
        await profileService.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
        toast.success('Password changed');
        passwordForm.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to change password');
      }
    });
  }

  // Delete account
  const deleteAccountBtn = container.querySelector('#delete-account-btn');
  if (deleteAccountBtn) {
    on(deleteAccountBtn as HTMLElement, 'click', async () => {
      const password = prompt('Enter your password to confirm account deletion:');
      if (!password) return;

      if (!confirm('Are you sure? This action cannot be undone.')) return;

      try {
        await profileService.deleteAccount(password);
        closeModal(MODAL_ID);
        toast.success('Account deleted');
        window.location.reload();
      } catch {
        toast.error('Failed to delete account');
      }
    });
  }

  // Revoke all sessions
  const revokeAllBtn = container.querySelector('#revoke-all-btn');
  if (revokeAllBtn) {
    on(revokeAllBtn as HTMLElement, 'click', async () => {
      if (!confirm('Sign out from all other devices?')) return;

      try {
        await profileService.revokeAllSessions();
        toast.success('All other sessions signed out');
        loadSessions();
      } catch {
        toast.error('Failed to revoke sessions');
      }
    });
  }
}

/**
 * Load sessions
 */
async function loadSessions(): Promise<void> {
  const container = document.querySelector('#sessions-list');
  if (!container) return;

  try {
    const sessions = await profileService.getSessions();

    if (!sessions || sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <p>No active sessions found</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(session => `
      <div class="session-card ${session.is_current ? 'current' : ''}">
        <div class="session-info">
          <div class="session-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              ${session.device?.toLowerCase().includes('mobile')
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'
      }
            </svg>
          </div>
          <div class="session-details">
            <h4>${escapeHtml(session.device || 'Unknown device')}</h4>
            <p>${session.location ? `${escapeHtml(session.location)} • ` : ''}${escapeHtml(session.ip_address || 'Unknown IP')} • Last active: ${formatDate(session.last_active)}</p>
          </div>
        </div>
        ${session.is_current
        ? '<span class="session-badge">Current</span>'
        : `<button class="btn-sota secondary revoke-session-btn" data-id="${session.id}">Revoke</button>`
      }
      </div>
    `).join('');

    // Bind revoke buttons
    container.querySelectorAll('.revoke-session-btn').forEach(btn => {
      on(btn as HTMLElement, 'click', async () => {
        const sessionId = btn.getAttribute('data-id');
        if (!sessionId) return;

        try {
          await profileService.revokeSession(sessionId);
          toast.success('Session revoked');
          loadSessions();
        } catch {
          toast.error('Failed to revoke session');
        }
      });
    });
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>Session management requires authentication</p>
      </div>
    `;
  }
}

/**
 * Helper functions
 */
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Generate a fallback avatar URL using UI Avatars
 */
function generateFallbackAvatar(name: string): string {
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=e11d48&color=fff&size=200&font-size=0.4&bold=true`;
}

/**
 * Load timezones from API
 */
async function loadTimezones(): Promise<Timezone[]> {
  if (cachedTimezones) {
    return cachedTimezones;
  }

  try {
    const response = await http.get<{ timezones: Timezone[] }>('/api/timezones');
    cachedTimezones = response.data.timezones;
    return cachedTimezones;
  } catch {
    // Fallback to minimal list
    return [
      { code: 'UTC', name: 'Coordinated Universal Time', utc_offset: '+00:00' },
      { code: 'Europe/Lisbon', name: 'Lisbon, Portugal', utc_offset: '+00:00' },
      { code: 'Europe/London', name: 'London, United Kingdom', utc_offset: '+00:00' },
    ];
  }
}

/**
 * Generate timezone options HTML - uses cached timezones or fallback
 */
function generateTimezoneOptions(selected?: string, timezones?: Timezone[]): string {
  const tzList = timezones || cachedTimezones || [
    { code: 'UTC', name: 'Coordinated Universal Time', utc_offset: '+00:00' },
  ];

  // Group by region for better UX
  const grouped = tzList.reduce((acc, tz) => {
    const region = tz.region || 'Other';
    if (!acc[region]) acc[region] = [];
    acc[region].push(tz);
    return acc;
  }, {} as Record<string, Timezone[]>);

  // Sort regions
  const regionOrder = ['Europe', 'Americas', 'Asia', 'Oceania', 'Africa', 'Atlantic', 'UTC', 'Other'];
  const sortedRegions = Object.keys(grouped).sort((a, b) => {
    const aIdx = regionOrder.indexOf(a);
    const bIdx = regionOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  let html = '';
  for (const region of sortedRegions) {
    html += `<optgroup label="${region}">`;
    for (const tz of grouped[region]) {
      const label = `${tz.name} (${tz.utc_offset})`;
      html += `<option value="${tz.code}" ${selected === tz.code ? 'selected' : ''}>${label}</option>`;
    }
    html += '</optgroup>';
  }

  return html;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load Krisp integration content
 */
async function loadKrispIntegration(container: HTMLElement): Promise<void> {
  const contentEl = container.querySelector('#krisp-integration-content');
  if (!contentEl) return;

  // Check if user is superadmin (has MCP access)
  const currentUser = appStore.getState().currentUser;
  const isSuperAdmin = currentUser?.role === 'superadmin';

  try {
    const webhook = await krispService.getWebhook();
    const summary = await krispService.getTranscriptsSummary();

    if (!webhook) {
      contentEl.innerHTML = `
        <div class="krisp-not-configured">
          <p>Krisp integration is not configured yet.</p>
          <button type="button" class="btn-sota primary" id="enable-krisp-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Enable Krisp Integration
          </button>
        </div>
      `;

      const enableBtn = contentEl.querySelector('#enable-krisp-btn');
      if (enableBtn) {
        on(enableBtn as HTMLElement, 'click', async () => {
          try {
            await krispService.getWebhook(); // This creates the webhook if it doesn't exist
            loadKrispIntegration(container);
            toast.success('Krisp integration enabled');
          } catch {
            toast.error('Failed to enable Krisp integration');
          }
        });
      }
      return;
    }

    // Show webhook configuration
    contentEl.innerHTML = `
      <div class="krisp-config">
        ${isSuperAdmin ? `
        <div class="krisp-mcp-banner">
          <div class="mcp-icon">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="mcp-info">
            <strong>MCP Direct Access</strong>
            <span>As a Super Admin, you can import meetings directly via MCP without webhook configuration.</span>
          </div>
          <button type="button" class="btn-sota primary" id="mcp-import-btn">
            Import via MCP
          </button>
        </div>
        ` : ''}
        
        <div class="krisp-status">
          <span class="status-indicator ${webhook.is_active ? 'active' : 'inactive'}"></span>
          <span>${webhook.is_active ? 'Active' : 'Inactive'}</span>
          <button type="button" class="btn-sota small ${webhook.is_active ? 'secondary' : 'primary'}" id="toggle-krisp-btn">
            ${webhook.is_active ? 'Disable' : 'Enable'}
          </button>
        </div>

        <div class="form-field">
          <label>Webhook URL</label>
          <div class="input-with-copy">
            <input type="text" value="${escapeHtml(webhook.webhook_url)}" readonly>
            <button type="button" class="btn-copy" data-copy="${escapeHtml(webhook.webhook_url)}" title="Copy URL">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="form-field">
          <label>Authorization Token</label>
          <div class="input-with-copy">
            <input type="password" value="${escapeHtml(webhook.webhook_secret)}" readonly id="krisp-secret-input">
            <button type="button" class="btn-toggle-visibility" id="toggle-secret-btn" title="Show/Hide">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            <button type="button" class="btn-copy" data-copy="${escapeHtml(webhook.webhook_secret)}" title="Copy Token">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
          <span class="form-hint">Use this token in the Authorization header when configuring Krisp webhook.</span>
        </div>

        <div class="krisp-stats">
          <div class="stat">
            <span class="stat-value">${summary?.total_count || 0}</span>
            <span class="stat-label">Total Transcripts</span>
          </div>
          <div class="stat">
            <span class="stat-value">${summary?.processed_count || 0}</span>
            <span class="stat-label">Processed</span>
          </div>
          <div class="stat ${(summary?.quarantine_count || 0) + (summary?.ambiguous_count || 0) > 0 ? 'warning' : ''}">
            <span class="stat-value">${(summary?.quarantine_count || 0) + (summary?.ambiguous_count || 0)}</span>
            <span class="stat-label">Need Attention</span>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-sota secondary" id="regenerate-krisp-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Regenerate Credentials
          </button>
          <a href="#" class="btn-sota primary" id="view-transcripts-btn">
            View Transcripts
          </a>
        </div>
      </div>
      
      <style>
        .krisp-config { padding: 16px 0; }
        .krisp-status { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
        .status-indicator.active { background: #22c55e; }
        .status-indicator.inactive { background: #94a3b8; }
        .input-with-copy { display: flex; gap: 8px; }
        .input-with-copy input { flex: 1; }
        .btn-copy, .btn-toggle-visibility { padding: 8px; background: var(--bg-secondary, #f1f5f9); border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; cursor: pointer; }
        .btn-copy:hover, .btn-toggle-visibility:hover { background: var(--bg-tertiary, #e2e8f0); }
        .krisp-stats { display: flex; gap: 16px; margin: 24px 0; padding: 16px; background: var(--bg-secondary, #f8fafc); border-radius: 12px; }
        .stat { flex: 1; text-align: center; }
        .stat-value { display: block; font-size: 24px; font-weight: 600; color: var(--text-primary, #1e293b); }
        .stat-label { font-size: 12px; color: var(--text-secondary, #64748b); }
        .stat.warning .stat-value { color: #f59e0b; }
        .btn-sota.small { padding: 4px 12px; font-size: 12px; }
        .krisp-not-configured { text-align: center; padding: 32px; }
        .krisp-not-configured p { margin-bottom: 16px; color: var(--text-secondary, #64748b); }
        .krisp-mcp-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
          border: 1px solid #93c5fd;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .mcp-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mcp-icon svg { color: white; }
        .mcp-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .mcp-info strong {
          font-size: 14px;
          color: #1e40af;
        }
        .mcp-info span {
          font-size: 12px;
          color: #3b82f6;
        }
        .krisp-mcp-banner .btn-sota {
          flex-shrink: 0;
        }
        [data-theme="dark"] .krisp-mcp-banner {
          background: linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(29,78,216,0.1) 100%);
          border-color: rgba(59,130,246,0.3);
        }
        [data-theme="dark"] .mcp-info strong { color: #93c5fd; }
        [data-theme="dark"] .mcp-info span { color: #60a5fa; }
        [data-theme="dark"] .krisp-stats { background: rgba(30,41,59,0.5); }
        [data-theme="dark"] .btn-copy, [data-theme="dark"] .btn-toggle-visibility { background: rgba(30,41,59,0.8); border-color: rgba(255,255,255,0.1); }
      </style>
    `;

    // Bind copy buttons
    contentEl.querySelectorAll('.btn-copy').forEach(btn => {
      on(btn as HTMLElement, 'click', () => {
        const text = btn.getAttribute('data-copy') || '';
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
      });
    });

    // Toggle secret visibility
    const toggleSecretBtn = contentEl.querySelector('#toggle-secret-btn');
    const secretInput = contentEl.querySelector('#krisp-secret-input') as HTMLInputElement;
    if (toggleSecretBtn && secretInput) {
      on(toggleSecretBtn as HTMLElement, 'click', () => {
        secretInput.type = secretInput.type === 'password' ? 'text' : 'password';
      });
    }

    // MCP Import button (superadmin only)
    const mcpImportBtn = contentEl.querySelector('#mcp-import-btn');
    if (mcpImportBtn) {
      on(mcpImportBtn as HTMLElement, 'click', async () => {
        closeModal(MODAL_ID);
        // Open KrispManager directly on the Import tab
        const { showKrispManager } = await import('./KrispManager');
        showKrispManager('import');
      });
    }

    // Toggle webhook
    const toggleBtn = contentEl.querySelector('#toggle-krisp-btn');
    if (toggleBtn) {
      on(toggleBtn as HTMLElement, 'click', async () => {
        const newState = !webhook.is_active;
        const success = await krispService.toggleWebhook(newState);
        if (success) {
          toast.success(newState ? 'Krisp integration enabled' : 'Krisp integration disabled');
          loadKrispIntegration(container);
        } else {
          toast.error('Failed to update integration');
        }
      });
    }

    // Regenerate credentials
    const regenerateBtn = contentEl.querySelector('#regenerate-krisp-btn');
    if (regenerateBtn) {
      on(regenerateBtn as HTMLElement, 'click', async () => {
        if (!confirm('Are you sure? You will need to update the webhook URL in Krisp.')) return;

        const newWebhook = await krispService.regenerateWebhook();
        if (newWebhook) {
          toast.success('Credentials regenerated');
          loadKrispIntegration(container);
        } else {
          toast.error('Failed to regenerate credentials');
        }
      });
    }

    // View transcripts link
    const viewTranscriptsBtn = contentEl.querySelector('#view-transcripts-btn');
    if (viewTranscriptsBtn) {
      on(viewTranscriptsBtn as HTMLElement, 'click', async (e) => {
        e.preventDefault();
        closeModal(MODAL_ID);
        // Open KrispManager modal
        const { showKrispManager } = await import('./KrispManager');
        showKrispManager();
      });
    }

  } catch (error) {
    console.error('[ProfileModal] Krisp integration error:', error);
    contentEl.innerHTML = `
      <div class="error-message">
        <p>Failed to load Krisp integration. Please try again.</p>
        <button type="button" class="btn-sota secondary" id="retry-krisp-btn">Retry</button>
      </div>
    `;

    const retryBtn = contentEl.querySelector('#retry-krisp-btn');
    if (retryBtn) {
      on(retryBtn as HTMLElement, 'click', () => loadKrispIntegration(container));
    }
  }
}

export function closeProfileModal(): void {
  closeModal(MODAL_ID);
}

/**
 * Create the profile view root element (same content as modal, no wrapper).
 * Used for embedding profile in a tab/page.
 */
export function createProfileView(): HTMLElement {
  return createModalContent();
}

/**
 * Initialize profile as a full page inside the given container (no modal).
 * Use when showing Profile in a tab; close button will call onBack.
 */
export function initProfilePage(container: HTMLElement, options: { onBack?: () => void } = {}): void {
  container.innerHTML = '';
  const view = createModalContent();
  container.appendChild(view);
  loadProfile(view, { onBack: options.onBack });
}
