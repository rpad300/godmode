/**
 * Contact Modal Component - SOTA Design
 * Create and edit contacts with tabs for Info, Projects, Relations, Activity
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal, confirm } from '../Modal';
import { Contact } from '../../stores/data';
import { http } from '../../services/api';
import { toast } from '../../services/toast';

const MODAL_ID = 'contact-modal';

// Types
interface RoleTemplate {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  prompt_template?: string;
  is_active: boolean;
}

interface ContactRelation {
  id: string;
  from_contact_id: string;
  to_contact_id: string;
  relationship_type: string;
  to_contact?: {
    id: string;
    name: string;
    role?: string;
    organization?: string;
    avatar_url?: string;
  };
}

interface ContactActivity {
  id: string;
  activity_type: string;
  description: string;
  occurred_at: string;
  source_type?: string;
}

interface ContactProject {
  id: string;
  name: string;
  role?: string;
  is_primary?: boolean;
}

export interface ContactModalProps {
  mode: 'create' | 'edit' | 'view';
  contact?: Contact;
  onSave?: (contact: Contact) => void;
  onDelete?: (contactId: string) => void;
}

// State
let currentContact: Contact | null = null;
let contactProjects: ContactProject[] = [];
let contactRelations: ContactRelation[] = [];
let contactActivity: ContactActivity[] = [];
let allProjects: { id: string; name: string }[] = [];
let roleTemplates: RoleTemplate[] = [];

/**
 * Show contact modal
 */
export function showContactModal(props: ContactModalProps): void {
  const { mode, contact } = props;
  currentContact = contact || null;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createModalContent(mode, contact);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: '',
    content,
    size: 'lg',
  });

  // Remove default modal styling for custom design
  const modalContent = modal.querySelector('.modal-content') as HTMLElement;
  if (modalContent) {
    modalContent.style.cssText = 'background: transparent; box-shadow: none; padding: 0; max-width: 900px;';
  }
  const modalHeader = modal.querySelector('.modal-header') as HTMLElement;
  if (modalHeader) {
    modalHeader.style.display = 'none';
  }

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Load data for edit mode
  if (mode === 'edit' && contact?.id) {
    loadContactData(content, contact.id);
  } else {
    loadRoleTemplates(content);
    loadAllProjects(content);
    loadTimezones(content);
  }

  // Bind events
  bindEvents(content, props);
}

/**
 * Create modal content
 */
function createModalContent(mode: 'create' | 'edit' | 'view', contact?: Contact): HTMLElement {
  const container = createElement('div', { className: 'contact-modal-sota' });
  const isEdit = mode === 'edit';
  const initials = contact ? getInitials(contact.name) : '?';
  const hasPhoto = !!(contact?.photoUrl || contact?.avatarUrl);
  const photoUrl = contact?.photoUrl || contact?.avatarUrl;

  container.innerHTML = `
    <style>
      .contact-modal-sota {
        background: var(--bg-primary);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3);
      }

      /* Header */
      .contact-modal-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%);
        padding: 32px 32px 24px;
        position: relative;
      }

      .contact-modal-close {
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
        color: white;
        transition: all 0.2s;
      }

      .contact-modal-close:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
      }

      .contact-modal-close svg {
        width: 20px;
        height: 20px;
      }

      .contact-header-content {
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .contact-avatar-large {
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 700;
        color: white;
        border: 4px solid rgba(255,255,255,0.3);
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .contact-avatar-large:hover {
        border-color: rgba(255,255,255,0.5);
      }

      .contact-avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .contact-avatar-large .avatar-upload-hint {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .contact-avatar-large:hover .avatar-upload-hint {
        opacity: 1;
      }

      .contact-avatar-large .avatar-upload-hint svg {
        width: 28px;
        height: 28px;
        color: white;
      }

      .contact-header-info {
        flex: 1;
        color: white;
      }

      .contact-header-info h2 {
        margin: 0 0 4px 0;
        font-size: 26px;
        font-weight: 700;
      }

      .contact-header-info p {
        margin: 0;
        font-size: 15px;
        opacity: 0.85;
      }

      .contact-header-actions {
        display: flex;
        gap: 10px;
      }

      .header-action-btn {
        padding: 10px 16px;
        border-radius: 10px;
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.2);
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .header-action-btn:hover {
        background: rgba(255,255,255,0.25);
      }

      .header-action-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Tabs */
      .contact-tabs {
        display: flex;
        border-bottom: 1px solid var(--border-color);
        padding: 0 32px;
        background: var(--bg-secondary);
      }

      .contact-tab-btn {
        padding: 14px 20px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
        transition: color 0.2s;
      }

      .contact-tab-btn:hover {
        color: var(--text-primary);
      }

      .contact-tab-btn.active {
        color: #e11d48;
      }

      .contact-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #e11d48, #f59e0b);
        border-radius: 3px 3px 0 0;
      }

      .contact-tab-btn svg {
        width: 16px;
        height: 16px;
      }

      .contact-tab-btn .tab-count {
        background: rgba(225,29,72,0.1);
        color: #e11d48;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
      }

      /* Tab Content */
      .contact-tab-content {
        padding: 28px 32px;
        min-height: 400px;
        max-height: 500px;
        overflow-y: auto;
      }

      .contact-section {
        display: none;
      }

      .contact-section.active {
        display: block;
      }

      /* Form Styles */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .form-grid.full {
        grid-template-columns: 1fr;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-field.full-width {
        grid-column: 1 / -1;
      }

      .form-field label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .form-field label svg {
        width: 14px;
        height: 14px;
        color: #e11d48;
      }

      .form-field input,
      .form-field textarea,
      .form-field select {
        padding: 12px 14px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.2s;
      }

      .form-field input:focus,
      .form-field textarea:focus,
      .form-field select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
      }

      .form-field textarea {
        resize: vertical;
        min-height: 100px;
      }

      .form-hint {
        font-size: 12px;
        color: var(--text-tertiary);
      }

      /* Projects Section */
      .projects-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .project-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        transition: all 0.2s;
      }

      .project-item:hover {
        border-color: rgba(225,29,72,0.3);
      }

      .project-checkbox {
        width: 20px;
        height: 20px;
        accent-color: #e11d48;
      }

      .project-item label {
        flex: 1;
        font-size: 14px;
        color: var(--text-primary);
        cursor: pointer;
      }

      .project-item .primary-badge {
        padding: 3px 8px;
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
      }

      /* Relations Section */
      .relations-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .relation-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        transition: all 0.2s;
      }

      .relation-card:hover {
        border-color: rgba(225,29,72,0.3);
        transform: translateX(4px);
      }

      .relation-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: white;
        overflow: hidden;
      }

      .relation-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .relation-info {
        flex: 1;
      }

      .relation-info h4 {
        margin: 0 0 2px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .relation-info p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
      }

      .relation-type {
        padding: 4px 10px;
        background: rgba(99,102,241,0.1);
        color: #6366f1;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      .add-relation-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px;
        background: var(--bg-secondary);
        border: 2px dashed var(--border-color);
        border-radius: 12px;
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .add-relation-btn:hover {
        border-color: #e11d48;
        color: #e11d48;
      }

      .add-relation-btn svg {
        width: 18px;
        height: 18px;
      }

      /* Activity Section */
      .activity-timeline {
        position: relative;
        padding-left: 28px;
      }

      .activity-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border-color);
      }

      .activity-item {
        position: relative;
        padding-bottom: 20px;
      }

      .activity-item::before {
        content: '';
        position: absolute;
        left: -24px;
        top: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #e11d48;
        border: 2px solid var(--bg-primary);
      }

      .activity-item.email::before { background: #3b82f6; }
      .activity-item.meeting::before { background: #10b981; }
      .activity-item.note::before { background: #f59e0b; }

      .activity-time {
        font-size: 11px;
        color: var(--text-tertiary);
        margin-bottom: 4px;
      }

      .activity-content {
        font-size: 14px;
        color: var(--text-primary);
        line-height: 1.5;
      }

      .activity-empty {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
      }

      .activity-empty svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
        margin-bottom: 12px;
      }

      /* Footer */
      .contact-modal-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 32px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }

      .footer-left {
        display: flex;
        gap: 10px;
      }

      .footer-right {
        display: flex;
        gap: 10px;
      }

      .btn-sota {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }

      .btn-sota.primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }

      .btn-sota.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(225,29,72,0.4);
      }

      .btn-sota.secondary {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }

      .btn-sota.secondary:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
      }

      .btn-sota.danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #dc2626;
      }

      .btn-sota.danger:hover {
        background: #dc2626;
        color: white;
      }

      .btn-sota svg {
        width: 16px;
        height: 16px;
      }

      .btn-sota:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Loading */
      .loading-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--text-secondary);
      }

      .loading-spinner::after {
        content: '';
        width: 24px;
        height: 24px;
        border: 3px solid var(--border-color);
        border-top-color: #e11d48;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-left: 12px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>

    <!-- Header -->
    <div class="contact-modal-header">
      <button class="contact-modal-close" id="close-contact-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div class="contact-header-content">
        <div class="contact-avatar-large" id="contact-avatar-upload">
          ${hasPhoto 
            ? `<img src="${photoUrl}" alt="">`
            : `<span>${initials}</span>`
          }
          <div class="avatar-upload-hint">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        </div>

        <div class="contact-header-info">
          <h2 id="header-contact-name">${isEdit ? escapeHtml(contact?.name || '') : 'New Contact'}</h2>
          <p id="header-contact-org">${isEdit && contact?.organization ? escapeHtml(contact.organization) : 'Add organization'}</p>
        </div>

        ${isEdit ? `
          <div class="contact-header-actions">
            <button class="header-action-btn" id="enrich-ai-btn" title="Enrich with AI">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Enrich with AI
            </button>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Tabs -->
    <div class="contact-tabs">
      <button class="contact-tab-btn active" data-tab="info">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        Info
      </button>
      <button class="contact-tab-btn" data-tab="projects">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        Projects
        <span class="tab-count" id="projects-count">0</span>
      </button>
      <button class="contact-tab-btn" data-tab="relations">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        Relations
        <span class="tab-count" id="relations-count">0</span>
      </button>
      <button class="contact-tab-btn" data-tab="activity">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Activity
      </button>
    </div>

    <!-- Tab Content -->
    <div class="contact-tab-content">
      <!-- Info Section -->
      <div class="contact-section active" id="section-info">
        <form id="contact-form">
          <div class="form-grid">
            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Name *
              </label>
              <input type="text" id="contact-name" required value="${escapeHtml(contact?.name || '')}" placeholder="Full name">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Role
              </label>
              <select id="contact-role">
                <option value="">-- Select role --</option>
                <option value="__custom__">Custom role...</option>
              </select>
              <input type="text" id="contact-role-custom" placeholder="Enter custom role" style="display: none; margin-top: 8px;" value="${contact?.role && !roleTemplates.some(r => r.display_name === contact.role) ? escapeHtml(contact.role) : ''}">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Email
              </label>
              <input type="email" id="contact-email" value="${escapeHtml(contact?.email || '')}" placeholder="email@example.com">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                Phone
              </label>
              <input type="tel" id="contact-phone" value="${escapeHtml(contact?.phone || '')}" placeholder="+1 234 567 890">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                Organization
              </label>
              <input type="text" id="contact-organization" value="${escapeHtml(contact?.organization || contact?.company || '')}" placeholder="Company name">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                LinkedIn
              </label>
              <input type="url" id="contact-linkedin" value="${escapeHtml(contact?.linkedin || '')}" placeholder="https://linkedin.com/in/...">
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Avatar URL
              </label>
              <input type="url" id="contact-avatar-url" value="${escapeHtml(contact?.photoUrl || contact?.avatarUrl || contact?.photo_url || contact?.avatar_url || '')}" placeholder="https://example.com/photo.jpg">
              <div class="form-hint">Enter a URL to set the contact's profile picture</div>
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                Department
              </label>
              <input type="text" id="contact-department" value="${escapeHtml(contact?.department || '')}" placeholder="Engineering, Sales, etc.">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Location
              </label>
              <input type="text" id="contact-location" value="${escapeHtml(contact?.location || '')}" placeholder="City, Country">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Timezone
              </label>
              <select id="contact-timezone" data-current="${escapeHtml(contact?.timezone || '')}">
                <option value="">Select timezone...</option>
              </select>
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Aliases
              </label>
              <input type="text" id="contact-aliases" value="${contact?.aliases?.join(', ') || ''}" placeholder="Alternative names (comma separated)">
              <div class="form-hint">Names used to identify this person in documents (e.g., "Luuc" for "Luuk")</div>
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Notes
              </label>
              <textarea id="contact-notes" placeholder="Additional notes about this contact...">${escapeHtml(contact?.notes || '')}</textarea>
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                Tags
              </label>
              <input type="text" id="contact-tags" value="${contact?.tags?.join(', ') || ''}" placeholder="client, vip, technical (comma separated)">
              <div class="form-hint">Separate tags with commas</div>
            </div>
          </div>
        </form>
      </div>

      <!-- Projects Section -->
      <div class="contact-section" id="section-projects">
        <div class="projects-list" id="projects-list">
          <div class="loading-spinner">Loading projects</div>
        </div>
      </div>

      <!-- Relations Section -->
      <div class="contact-section" id="section-relations">
        <div class="relations-list" id="relations-list">
          <div class="loading-spinner">Loading relations</div>
        </div>
        <button class="add-relation-btn" id="add-relation-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Relationship
        </button>
      </div>

      <!-- Activity Section -->
      <div class="contact-section" id="section-activity">
        <div class="activity-timeline" id="activity-timeline">
          <div class="loading-spinner">Loading activity</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="contact-modal-footer">
      <div class="footer-left">
        ${isEdit ? `
          <button class="btn-sota danger" id="delete-contact-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
        ` : ''}
      </div>
      <div class="footer-right">
        <button class="btn-sota secondary" id="cancel-contact-btn">Cancel</button>
        <button class="btn-sota primary" id="save-contact-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          ${isEdit ? 'Save Changes' : 'Create Contact'}
        </button>
      </div>
    </div>
  `;

  return container;
}

/**
 * Load contact data for edit mode
 */
async function loadContactData(container: HTMLElement, contactId: string): Promise<void> {
  try {
    const [projectsRes, relationsRes, activityRes, rolesRes, allProjectsRes, timezonesRes] = await Promise.all([
      http.get<{ projects: ContactProject[] }>(`/api/contacts/${contactId}/projects`).catch(() => ({ data: { projects: [] } })),
      http.get<{ relationships: ContactRelation[] }>(`/api/contacts/${contactId}/relationships`).catch(() => ({ data: { relationships: [] } })),
      http.get<{ activities: ContactActivity[] }>(`/api/contacts/${contactId}/activity`).catch(() => ({ data: { activities: [] } })),
      http.get<{ roles: RoleTemplate[] }>('/api/role-templates').catch(() => ({ data: { roles: [] } })),
      http.get<{ projects: { id: string; name: string }[] }>('/api/projects').catch(() => ({ data: { projects: [] } })),
      http.get<{ timezones: { code: string; name: string; utc_offset: string }[] }>('/api/timezones').catch(() => ({ data: { timezones: [] } })),
    ]);

    contactProjects = projectsRes.data?.projects || [];
    contactRelations = relationsRes.data?.relationships || [];
    contactActivity = activityRes.data?.activities || [];
    roleTemplates = rolesRes.data?.roles || [];
    allProjects = allProjectsRes.data?.projects || [];
    const timezones = timezonesRes.data?.timezones || [];

    // Render timezone dropdown
    renderTimezoneDropdown(container, timezones);

    // Render sections
    renderRoleDropdown(container);
    renderProjectsList(container);
    renderRelationsList(container);
    renderActivityTimeline(container);
    
    // Update counts
    updateTabCounts(container);
  } catch (error) {
    console.error('Failed to load contact data:', error);
  }
}

/**
 * Load role templates
 */
async function loadRoleTemplates(container: HTMLElement): Promise<void> {
  try {
    const response = await http.get<{ roles: RoleTemplate[] }>('/api/role-templates');
    roleTemplates = response.data?.roles || [];
    renderRoleDropdown(container);
  } catch {
    roleTemplates = [];
  }
}

/**
 * Load timezones for new contact
 */
async function loadTimezones(container: HTMLElement): Promise<void> {
  try {
    const response = await http.get<{ timezones: { code: string; name: string; utc_offset: string }[] }>('/api/timezones');
    const timezones = response.data?.timezones || [];
    renderTimezoneDropdown(container, timezones);
  } catch {
    // Leave empty
  }
}

/**
 * Load all projects
 */
async function loadAllProjects(container: HTMLElement): Promise<void> {
  try {
    const response = await http.get<{ projects: { id: string; name: string }[] }>('/api/projects');
    allProjects = response.data?.projects || [];
    renderProjectsList(container);
  } catch {
    allProjects = [];
  }
}

/**
 * Render timezone dropdown
 */
function renderTimezoneDropdown(container: HTMLElement, timezones: { code: string; name: string; utc_offset: string }[]): void {
  const tzSelect = container.querySelector('#contact-timezone') as HTMLSelectElement;
  if (!tzSelect) return;

  const currentTz = tzSelect.dataset.current || '';
  
  // Group timezones by region
  const grouped: Record<string, typeof timezones> = {};
  for (const tz of timezones) {
    const region = tz.code.includes('/') ? tz.code.split('/')[0] : 'Other';
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push(tz);
  }

  // Sort regions
  const sortedRegions = Object.keys(grouped).sort();

  tzSelect.innerHTML = `
    <option value="">Select timezone...</option>
    ${sortedRegions.map(region => `
      <optgroup label="${region}">
        ${grouped[region].map(tz => `
          <option value="${escapeHtml(tz.code)}" ${currentTz === tz.code ? 'selected' : ''}>
            ${escapeHtml(tz.name || tz.code)} (${tz.utc_offset})
          </option>
        `).join('')}
      </optgroup>
    `).join('')}
  `;
}

/**
 * Render role dropdown
 */
function renderRoleDropdown(container: HTMLElement): void {
  const roleSelect = container.querySelector('#contact-role') as HTMLSelectElement;
  const customInput = container.querySelector('#contact-role-custom') as HTMLInputElement;
  if (!roleSelect) return;

  const currentRole = currentContact?.role;
  const isCustomRole = currentRole && !roleTemplates.some(r => r.display_name === currentRole || r.name === currentRole);

  roleSelect.innerHTML = `
    <option value="">-- Select role --</option>
    ${roleTemplates.filter(r => r.is_active).map(r => `
      <option value="${escapeHtml(r.display_name || r.name)}" ${currentRole === r.display_name || currentRole === r.name ? 'selected' : ''}>
        ${escapeHtml(r.display_name || r.name)}
      </option>
    `).join('')}
    <option value="__custom__" ${isCustomRole ? 'selected' : ''}>Custom role...</option>
  `;

  // Show custom input if custom is selected
  if (isCustomRole && customInput) {
    customInput.style.display = 'block';
    customInput.value = currentRole;
  }

  // Handle role change
  on(roleSelect, 'change', () => {
    const isCustom = roleSelect.value === '__custom__';
    customInput.style.display = isCustom ? 'block' : 'none';
    if (isCustom) {
      customInput.focus();
    }
  });
}

/**
 * Render projects list
 */
function renderProjectsList(container: HTMLElement): void {
  const listContainer = container.querySelector('#projects-list') as HTMLElement;
  if (!listContainer) return;

  if (allProjects.length === 0) {
    listContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No projects available</p>';
    return;
  }

  const associatedIds = new Set(contactProjects.map(p => p.id));

  listContainer.innerHTML = allProjects.map(project => `
    <div class="project-item">
      <input type="checkbox" class="project-checkbox" name="contact-project" value="${project.id}" 
             ${associatedIds.has(project.id) ? 'checked' : ''}>
      <label>${escapeHtml(project.name)}</label>
      ${contactProjects.find(p => p.id === project.id)?.is_primary ? '<span class="primary-badge">Primary</span>' : ''}
    </div>
  `).join('');

  container.querySelector('#projects-count')!.textContent = String(associatedIds.size);
}

/**
 * Render relations list
 */
function renderRelationsList(container: HTMLElement): void {
  const listContainer = container.querySelector('#relations-list') as HTMLElement;
  if (!listContainer) return;

  if (contactRelations.length === 0) {
    listContainer.innerHTML = `
      <div class="activity-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <p>No relationships yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = contactRelations.map(relation => {
    const contact = relation.to_contact;
    const initials = contact ? getInitials(contact.name) : '?';

    return `
      <div class="relation-card" data-id="${relation.id}">
        <div class="relation-avatar">
          ${contact?.avatar_url 
            ? `<img src="${contact.avatar_url}" alt="">`
            : initials
          }
        </div>
        <div class="relation-info">
          <h4>${escapeHtml(contact?.name || 'Unknown')}</h4>
          <p>${escapeHtml(contact?.organization || contact?.role || '')}</p>
        </div>
        <span class="relation-type">${formatRelationType(relation.relationship_type)}</span>
      </div>
    `;
  }).join('');

  container.querySelector('#relations-count')!.textContent = String(contactRelations.length);
}

/**
 * Render activity timeline
 */
function renderActivityTimeline(container: HTMLElement): void {
  const timeline = container.querySelector('#activity-timeline') as HTMLElement;
  if (!timeline) return;

  if (contactActivity.length === 0) {
    timeline.innerHTML = `
      <div class="activity-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No activity recorded yet</p>
      </div>
    `;
    return;
  }

  timeline.innerHTML = contactActivity.map(activity => `
    <div class="activity-item ${activity.activity_type}">
      <div class="activity-time">${formatDate(activity.occurred_at)}</div>
      <div class="activity-content">${escapeHtml(activity.description)}</div>
    </div>
  `).join('');
}

/**
 * Update tab counts
 */
function updateTabCounts(container: HTMLElement): void {
  const projectsCount = container.querySelector('#projects-count');
  const relationsCount = container.querySelector('#relations-count');

  if (projectsCount) projectsCount.textContent = String(contactProjects.length);
  if (relationsCount) relationsCount.textContent = String(contactRelations.length);
}

/**
 * Bind events
 */
function bindEvents(container: HTMLElement, props: ContactModalProps): void {
  const { mode, contact, onSave, onDelete } = props;
  const isEdit = mode === 'edit';

  // Close button
  const closeBtn = container.querySelector('#close-contact-btn');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', () => closeModal(MODAL_ID));
  }

  // Cancel button
  const cancelBtn = container.querySelector('#cancel-contact-btn');
  if (cancelBtn) {
    on(cancelBtn as HTMLElement, 'click', () => closeModal(MODAL_ID));
  }

  // Tab switching
  const tabs = container.querySelectorAll('.contact-tab-btn');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabId = tab.getAttribute('data-tab');
      container.querySelectorAll('.contact-section').forEach(section => {
        section.classList.toggle('active', section.id === `section-${tabId}`);
      });
    });
  });

  // Save button
  const saveBtn = container.querySelector('#save-contact-btn') as HTMLButtonElement;
  if (saveBtn) {
    on(saveBtn, 'click', async () => {
      const form = container.querySelector('#contact-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const getValue = (id: string) => (container.querySelector(`#${id}`) as HTMLInputElement)?.value.trim() || '';
      
      // Get role value
      const roleSelect = container.querySelector('#contact-role') as HTMLSelectElement;
      const customRoleInput = container.querySelector('#contact-role-custom') as HTMLInputElement;
      const role = roleSelect.value === '__custom__' ? customRoleInput.value.trim() : roleSelect.value;

      const tagsInput = getValue('contact-tags');
      const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

      // Get aliases
      const aliasesInput = getValue('contact-aliases');
      const aliases = aliasesInput ? aliasesInput.split(',').map(a => a.trim()).filter(Boolean) : [];

      const contactData: Contact = {
        id: contact?.id || `contact-${Date.now()}`,
        name: getValue('contact-name'),
        email: getValue('contact-email') || undefined,
        phone: getValue('contact-phone') || undefined,
        organization: getValue('contact-organization') || undefined,
        company: getValue('contact-organization') || undefined,
        role: role || undefined,
        department: getValue('contact-department') || undefined,
        linkedin: getValue('contact-linkedin') || undefined,
        location: getValue('contact-location') || undefined,
        timezone: getValue('contact-timezone') || undefined,
        photoUrl: getValue('contact-avatar-url') || undefined,
        avatarUrl: getValue('contact-avatar-url') || undefined,
        aliases: aliases.length > 0 ? aliases : undefined,
        notes: getValue('contact-notes') || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };

      // Get selected projects
      const selectedProjects: string[] = [];
      container.querySelectorAll('input[name="contact-project"]:checked').forEach(input => {
        selectedProjects.push((input as HTMLInputElement).value);
      });

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        let savedContactId = contact?.id;
        
        if (isEdit) {
          await http.put(`/api/contacts/${contact!.id}`, contactData);
          toast.success('Contact updated');
        } else {
          const response = await http.post<{ id: string }>('/api/contacts', contactData);
          contactData.id = response.data.id;
          savedContactId = response.data.id;
          toast.success('Contact created');
        }

        // Save project associations
        if (savedContactId && selectedProjects.length >= 0) {
          try {
            await http.post(`/api/contacts/${savedContactId}/projects/sync`, {
              projectIds: selectedProjects
            });
          } catch (err) {
            console.warn('Failed to sync project associations:', err);
          }
        }

        onSave?.(contactData);
        closeModal(MODAL_ID);
      } catch {
        toast.error('Failed to save contact');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          ${isEdit ? 'Save Changes' : 'Create Contact'}
        `;
      }
    });
  }

  // Delete button
  const deleteBtn = container.querySelector('#delete-contact-btn');
  if (deleteBtn && isEdit) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      const confirmed = await confirm(
        `Are you sure you want to delete "${contact!.name}"?`,
        {
          title: 'Delete Contact',
          confirmText: 'Delete',
          confirmClass: 'btn-danger',
        }
      );

      if (confirmed) {
        try {
          await http.delete(`/api/contacts/${contact!.id}`);
          toast.success('Contact deleted');
          onDelete?.(contact!.id);
          closeModal(MODAL_ID);
        } catch {
          toast.error('Failed to delete contact');
        }
      }
    });
  }

  // AI Enrich button
  const enrichBtn = container.querySelector('#enrich-ai-btn');
  if (enrichBtn && isEdit) {
    on(enrichBtn as HTMLElement, 'click', async () => {
      toast.info('AI enrichment is processing...');
      try {
        await http.post(`/api/contacts/${contact!.id}/enrich`);
        toast.success('Contact enriched! Refreshing...');
        // Reload modal with updated data
        closeModal(MODAL_ID);
        const response = await http.get<{ contact: Contact }>(`/api/contacts/${contact!.id}`);
        showContactModal({ ...props, contact: response.data.contact });
      } catch {
        toast.error('AI enrichment failed');
      }
    });
  }

  // Add relation button
  const addRelationBtn = container.querySelector('#add-relation-btn');
  if (addRelationBtn && contact?.id) {
    on(addRelationBtn as HTMLElement, 'click', () => {
      showAddRelationDialog(container, contact.id, props);
    });
  }

  // Update header on name/org input change
  const nameInput = container.querySelector('#contact-name') as HTMLInputElement;
  const orgInput = container.querySelector('#contact-organization') as HTMLInputElement;
  const headerName = container.querySelector('#header-contact-name');
  const headerOrg = container.querySelector('#header-contact-org');

  if (nameInput && headerName) {
    on(nameInput, 'input', () => {
      headerName.textContent = nameInput.value || 'New Contact';
      // Update avatar initials
      const avatar = container.querySelector('.contact-avatar-large');
      if (avatar && !avatar.querySelector('img')) {
        const span = avatar.querySelector('span');
        if (span) span.textContent = getInitials(nameInput.value || '?');
      }
    });
  }

  if (orgInput && headerOrg) {
    on(orgInput, 'input', () => {
      headerOrg.textContent = orgInput.value || 'Add organization';
    });
  }

  // Update avatar preview on URL input change
  const avatarUrlInput = container.querySelector('#contact-avatar-url') as HTMLInputElement;
  const avatarContainer = container.querySelector('.contact-avatar-large');
  
  if (avatarUrlInput && avatarContainer) {
    on(avatarUrlInput, 'input', () => {
      const url = avatarUrlInput.value.trim();
      if (url) {
        // Test if image loads
        const img = new Image();
        img.onload = () => {
          avatarContainer.innerHTML = `
            <img src="${url}" alt="">
            <div class="avatar-upload-hint">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
          `;
        };
        img.onerror = () => {
          // Keep initials if image fails
          const currentName = (container.querySelector('#contact-name') as HTMLInputElement)?.value || '?';
          avatarContainer.innerHTML = `
            <span>${getInitials(currentName)}</span>
            <div class="avatar-upload-hint">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
          `;
        };
        img.src = url;
      } else {
        // No URL - show initials
        const currentName = (container.querySelector('#contact-name') as HTMLInputElement)?.value || '?';
        avatarContainer.innerHTML = `
          <span>${getInitials(currentName)}</span>
          <div class="avatar-upload-hint">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        `;
      }
    });
  }
}

/**
 * Show dialog to add a relationship to another contact
 */
async function showAddRelationDialog(parentContainer: HTMLElement, contactId: string, props: ContactModalProps): Promise<void> {
  // Fetch all contacts for selection
  let availableContacts: { id: string; name: string; organization?: string }[] = [];
  try {
    const response = await http.get<{ contacts: { id: string; name: string; organization?: string }[] }>('/api/contacts');
    availableContacts = (response.data?.contacts || []).filter(c => c.id !== contactId);
  } catch {
    toast.error('Failed to load contacts');
    return;
  }

  if (availableContacts.length === 0) {
    toast.info('No other contacts available to create a relationship');
    return;
  }

  // Create overlay dialog
  const overlay = createElement('div', { className: 'relation-dialog-overlay' });
  overlay.innerHTML = `
    <style>
      .relation-dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .relation-dialog {
        background: var(--bg-primary);
        border-radius: 16px;
        padding: 24px;
        width: 400px;
        max-width: 90vw;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        animation: slideUp 0.2s ease;
      }
      
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .relation-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .relation-dialog h3 svg {
        width: 22px;
        height: 22px;
        color: #e11d48;
      }
      
      .relation-dialog-field {
        margin-bottom: 16px;
      }
      
      .relation-dialog-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }
      
      .relation-dialog-field select {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 14px;
      }
      
      .relation-dialog-field select:focus {
        outline: none;
        border-color: #e11d48;
      }
      
      .relation-dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 24px;
      }
      
      .relation-dialog-actions button {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .relation-dialog-actions .cancel-btn {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
      }
      
      .relation-dialog-actions .cancel-btn:hover {
        background: var(--bg-tertiary);
      }
      
      .relation-dialog-actions .save-btn {
        background: linear-gradient(135deg, #e11d48, #be123c);
        border: none;
        color: white;
      }
      
      .relation-dialog-actions .save-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }
      
      .relation-dialog-actions .save-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
    </style>
    
    <div class="relation-dialog">
      <h3>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        Add Relationship
      </h3>
      
      <div class="relation-dialog-field">
        <label>Related Contact</label>
        <select id="rel-contact-select">
          <option value="">-- Select contact --</option>
          ${availableContacts.map(c => `
            <option value="${c.id}">${escapeHtml(c.name)}${c.organization ? ` (${escapeHtml(c.organization)})` : ''}</option>
          `).join('')}
        </select>
      </div>
      
      <div class="relation-dialog-field">
        <label>Relationship Type</label>
        <select id="rel-type-select">
          <option value="">-- Select type --</option>
          <option value="reports_to">Reports to</option>
          <option value="manages">Manages</option>
          <option value="works_with">Works with</option>
          <option value="knows">Knows</option>
          <option value="referred_by">Referred by</option>
        </select>
      </div>
      
      <div class="relation-dialog-actions">
        <button class="cancel-btn" id="rel-cancel-btn">Cancel</button>
        <button class="save-btn" id="rel-save-btn">Add Relationship</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Bind events
  const cancelBtn = overlay.querySelector('#rel-cancel-btn');
  const saveBtn = overlay.querySelector('#rel-save-btn') as HTMLButtonElement;
  const contactSelect = overlay.querySelector('#rel-contact-select') as HTMLSelectElement;
  const typeSelect = overlay.querySelector('#rel-type-select') as HTMLSelectElement;

  // Close on cancel or overlay click
  const closeDialog = () => overlay.remove();
  
  on(cancelBtn as HTMLElement, 'click', closeDialog);
  on(overlay, 'click', (e: Event) => {
    if (e.target === overlay) closeDialog();
  });

  // Save relationship
  on(saveBtn, 'click', async () => {
    const toContactId = contactSelect.value;
    const relationType = typeSelect.value;

    if (!toContactId || !relationType) {
      toast.error('Please select both a contact and relationship type');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await http.post(`/api/contacts/${contactId}/relationships`, {
        toContactId,
        type: relationType
      });

      toast.success('Relationship added');
      closeDialog();

      // Reload contact data to show new relationship
      const relationsRes = await http.get<{ relationships: ContactRelation[] }>(`/api/contacts/${contactId}/relationships`);
      contactRelations = relationsRes.data?.relationships || [];
      renderRelationsList(parentContainer);
      updateTabCounts(parentContainer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add relationship';
      toast.error(message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Relationship';
    }
  });
}

// Helpers
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRelationType(type: string): string {
  const types: Record<string, string> = {
    reports_to: 'Reports to',
    manages: 'Manages',
    works_with: 'Works with',
    knows: 'Knows',
    referred_by: 'Referred by',
  };
  return types[type] || type.replace(/_/g, ' ');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default showContactModal;
