/**
 * Project Modal - SOTA Design
 * Create and edit projects with modern glassmorphism design
 * Includes: General settings, Members, Roles, and Configuration tabs
 */

import { createModal, openModal, closeModal, confirm } from '@components/Modal';
import { createElement, on } from '@lib/dom';
import { appStore } from '@stores/app';
import { dataStore } from '@stores/data';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { showMemberPermissionsModal } from './MemberPermissionsModal';
import { listCompanies } from '@services/companies';
import { projectSchema } from '@schemas/project';

const MODAL_ID = 'project-modal';

// ==================== Types ====================

export interface ProjectData {
  id?: string;
  name: string;
  description?: string;
  owner_id?: string;
  company_id?: string;
  company?: { id: string; name?: string; logo_url?: string; brand_assets?: Record<string, unknown> };
  settings?: ProjectSettings;
  created_at?: string;
  updated_at?: string;
}

interface ProjectSettings {
  userRole?: string;
  userRolePrompt?: string;
}

interface ProjectMember {
  user_id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'write' | 'read';
  user_role?: string;
  user_role_prompt?: string;
  linked_contact_id?: string;
  linked_contact?: {
    id: string;
    name: string;
    email?: string;
    organization?: string;
    role?: string;
  };
  joined_at: string;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  organization?: string;
  role?: string;
}

interface RoleTemplate {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  prompt_template?: string;
  focus_areas?: string[];
  category?: string;
  is_builtin: boolean;
  is_active: boolean;
}

interface ProjectConfig {
  id?: string;
  project_id: string;
  llm_config?: Record<string, unknown>;
  ollama_config?: Record<string, unknown>;
  prompts?: Record<string, string>;
  processing_settings?: Record<string, unknown>;
  ui_preferences?: Record<string, unknown>;
}

export interface ProjectModalProps {
  mode: 'create' | 'edit';
  project?: ProjectData;
  onSave?: (project: ProjectData) => void;
  onDelete?: (projectId: string) => void;
}

// ==================== State ====================

let currentProps: ProjectModalProps = { mode: 'create' };
let currentProject: ProjectData | null = null;
/** When set, form is shown inline (no modal); close/cancel/save/delete call this then clear */
let inlineOnCancel: (() => void) | null = null;
let projectMembers: ProjectMember[] = [];
let projectRoles: RoleTemplate[] = [];
let projectConfig: ProjectConfig | null = null;
let projectContacts: Contact[] = [];

// ==================== Main Functions ====================

/**
 * Show project modal (or inline when container provided)
 */
export function showProjectModal(props: ProjectModalProps & { inlineContainer?: HTMLElement; onCancel?: () => void }): void {
  currentProps = props;
  currentProject = props.project || null;
  inlineOnCancel = props.inlineContainer ? (props.onCancel ?? (() => { })) : null;

  const content = createModalContent(props.mode);

  if (props.inlineContainer) {
    props.inlineContainer.innerHTML = '';
    props.inlineContainer.appendChild(content);
    if (props.mode === 'edit' && props.project?.id) {
      loadProjectData(content, props.project.id);
    } else {
      renderCreateForm(content);
    }
    return;
  }

  const modal = createModal({
    id: MODAL_ID,
    title: '',
    size: 'lg',
    content: content,
  });

  // Remove default modal styling for custom design
  const modalContent = modal.querySelector('.modal-content') as HTMLElement;
  if (modalContent) {
    modalContent.classList.add('project-modal-content-bare');
  }
  const modalHeader = modal.querySelector('.modal-header') as HTMLElement;
  if (modalHeader) {
    modalHeader.classList.add('hidden');
  }

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  if (props.mode === 'edit' && props.project?.id) {
    loadProjectData(content, props.project.id);
  } else {
    renderCreateForm(content);
  }
}

function closeOrInlineCancel(): void {
  if (inlineOnCancel) {
    inlineOnCancel();
    inlineOnCancel = null;
  } else {
    closeModal(MODAL_ID);
  }
}

/**
 * Create modal content with SOTA styling
 */
function createModalContent(mode: 'create' | 'edit'): HTMLElement {
  const container = createElement('div', { className: 'project-modal-sota' });

  container.innerHTML = `
    <style>
      .project-modal-sota {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .project-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.8),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        overflow: hidden;
      }
      
      [data-theme="dark"] .project-card {
        background: linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%);
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }
      
      .project-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 32px;
        position: relative;
        overflow: hidden;
      }
      
      .project-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      
      .project-header-content {
        display: flex;
        align-items: center;
        gap: 20px;
        position: relative;
        z-index: 1;
      }
      
      .project-icon-large {
        width: 72px;
        height: 72px;
        border-radius: 18px;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid rgba(255,255,255,0.3);
        flex-shrink: 0;
      }
      
      .project-icon-large svg {
        width: 36px;
        height: 36px;
        color: white;
      }
      
      .project-title-info h2 {
        margin: 0 0 4px 0;
        font-size: 24px;
        font-weight: 700;
        color: white;
      }
      
      .project-title-info p {
        margin: 0;
        color: rgba(255,255,255,0.8);
        font-size: 14px;
      }
      
      .project-close-btn {
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
      
      .project-close-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: rotate(90deg);
      }
      
      .project-close-btn svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      
      .project-tabs-nav {
        display: flex;
        gap: 0;
        padding: 0 24px;
        background: rgba(0,0,0,0.02);
        border-bottom: 1px solid rgba(0,0,0,0.06);
        overflow-x: auto;
      }
      
      [data-theme="dark"] .project-tabs-nav {
        background: rgba(255,255,255,0.02);
        border-bottom-color: rgba(255,255,255,0.06);
      }
      
      .project-tab-btn {
        padding: 16px 20px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .project-tab-btn:hover {
        color: #1e293b;
      }
      
      [data-theme="dark"] .project-tab-btn:hover {
        color: #e2e8f0;
      }
      
      .project-tab-btn.active {
        color: #e11d48;
      }
      
      .project-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20px;
        right: 20px;
        height: 2px;
        background: #e11d48;
        border-radius: 2px 2px 0 0;
      }
      
      .project-tab-icon {
        width: 18px;
        height: 18px;
      }
      
      .project-body {
        padding: 32px;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .project-section {
        display: none;
      }
      
      .project-section.active {
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
      
      .form-field textarea {
        resize: vertical;
        min-height: 80px;
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
      
      .btn-sota.primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
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
      
      .btn-sota.danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      .btn-sota.danger:hover {
        background: #fef2f2;
        border-color: #dc2626;
      }
      
      .btn-sota.small {
        padding: 8px 16px;
        font-size: 13px;
      }
      
      /* Section Headers */
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      
      .section-header h3 {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      [data-theme="dark"] .section-header h3 {
        color: #f1f5f9;
      }
      
      .section-header h3 svg {
        width: 20px;
        height: 20px;
        color: #e11d48;
      }
      
      /* Members List */
      .members-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .member-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: #f8fafc;
        border-radius: 12px;
        border: 1px solid transparent;
        transition: all 0.2s;
      }
      
      [data-theme="dark"] .member-card {
        background: rgba(255,255,255,0.03);
      }
      
      .member-card:hover {
        border-color: #e2e8f0;
      }
      
      .member-card.owner {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
      }
      
      .member-info {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      
      .member-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
      }
      
      .member-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .member-details h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      
      [data-theme="dark"] .member-details h4 {
        color: #f1f5f9;
      }
      
      .member-details p {
        margin: 0;
        font-size: 12px;
        color: #64748b;
      }
      
      .member-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .role-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .role-badge.owner {
        background: #e11d48;
        color: white;
      }
      
      .role-badge.admin {
        background: #8b5cf6;
        color: white;
      }
      
      .role-badge.write {
        background: #0ea5e9;
        color: white;
      }
      
      .role-badge.read {
        background: #64748b;
        color: white;
      }
      
      .role-select {
        padding: 6px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 13px;
        background: white;
        cursor: pointer;
      }
      
      [data-theme="dark"] .role-select {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      /* Role Templates List */
      .roles-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      
      .role-card {
        padding: 20px;
        background: #f8fafc;
        border-radius: 16px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      [data-theme="dark"] .role-card {
        background: rgba(255,255,255,0.03);
      }
      
      .role-card:hover {
        border-color: #e2e8f0;
        transform: translateY(-2px);
      }
      
      .role-card.active {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
      }
      
      .role-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .role-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .role-icon svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      
      .role-card h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      
      [data-theme="dark"] .role-card h4 {
        color: #f1f5f9;
      }
      
      .role-card p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.5;
      }
      
      .role-card .toggle-active {
        margin-top: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #64748b;
      }
      
      /* Config Section */
      .config-group {
        margin-bottom: 32px;
      }
      
      .config-group h4 {
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      [data-theme="dark"] .config-group h4 {
        color: #f1f5f9;
      }
      
      .config-group h4 svg {
        width: 16px;
        height: 16px;
        color: #e11d48;
      }
      
      .api-key-field {
        display: flex;
        gap: 12px;
      }
      
      .api-key-field input {
        flex: 1;
      }
      
      .api-key-field .btn-sota {
        flex-shrink: 0;
      }
      
      /* Danger Zone */
      .danger-zone {
        background: linear-gradient(135deg, #fef2f2 0%, #fff 100%);
        border: 1px solid #fecaca;
        border-radius: 16px;
        padding: 24px;
        margin-top: 32px;
      }
      
      [data-theme="dark"] .danger-zone {
        background: linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(220,38,38,0.05) 100%);
        border-color: rgba(220,38,38,0.3);
      }
      
      .danger-zone h3 {
        color: #dc2626 !important;
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .danger-zone h3 svg {
        width: 18px;
        height: 18px;
      }
      
      .danger-zone p {
        color: #991b1b;
        font-size: 14px;
        margin: 0 0 16px 0;
      }
      
      [data-theme="dark"] .danger-zone p {
        color: #fca5a5;
      }
      
      /* Empty State */
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
      
      .empty-state p {
        margin: 0 0 16px 0;
      }
      
      /* Loading */
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
      
      /* Responsive */
      @media (max-width: 640px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
        
        .roles-grid {
          grid-template-columns: 1fr;
        }
        
        .project-tabs-nav {
          padding: 0 16px;
        }
        
        .project-tab-btn {
          padding: 14px 16px;
        }
      }
    </style>
    
    <div class="project-card">
      <div class="loading-spinner"></div>
    </div>
  `;

  return container;
}

/**
 * Load project data for editing
 */
async function loadProjectData(container: HTMLElement, projectId: string): Promise<void> {
  const card = container.querySelector('.project-card') as HTMLElement;
  if (!card) return;

  try {
    // Load project details, members, roles, config, and contacts in parallel
    const [projectRes, membersRes, rolesRes, configRes, contactsRes] = await Promise.all([
      http.get<{ project: ProjectData }>(`/api/projects/${projectId}`).catch(() => null),
      http.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`).catch(() => ({ data: { members: [] } })),
      http.get<{ roles: RoleTemplate[] }>('/api/role-templates').catch(() => ({ data: { roles: [] } })),
      http.get<{ config: ProjectConfig }>(`/api/projects/${projectId}/config`).catch(() => ({ data: { config: null } })),
      http.get<{ contacts: Contact[] }>('/api/contacts').catch(() => ({ data: { contacts: [] } })),
    ]);

    if (projectRes?.data?.project) {
      currentProject = projectRes.data.project;
    }
    projectMembers = membersRes?.data?.members || [];
    projectRoles = rolesRes?.data?.roles || [];
    projectConfig = configRes?.data?.config || null;
    // Handle different response formats for contacts
    const contactsData = contactsRes?.data;
    projectContacts = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || []);

    renderEditForm(card);
  } catch {
    // Use props project as fallback
    renderEditForm(card);
  }
}

/**
 * Render create form
 */
function renderCreateForm(container: HTMLElement): void {
  const card = container.querySelector('.project-card') as HTMLElement;
  if (!card) return;

  card.innerHTML = `
    <!-- Header -->
    <div class="project-header">
      <button class="project-close-btn" id="close-project-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="project-header-content">
        <div class="project-icon-large">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div class="project-title-info">
          <h2>New Project</h2>
          <p>Create a new project to organize your work</p>
        </div>
      </div>
    </div>
    
    <!-- Form -->
    <div class="project-body">
      <form id="project-form">
        <div class="form-grid">
          <div class="form-field full-width">
            <label>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              Project Name *
            </label>
            <input type="text" name="name" required placeholder="Enter project name">
          </div>
          
          <div class="form-field full-width">
            <label>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
              </svg>
              Description
            </label>
            <textarea name="description" placeholder="Brief description of the project"></textarea>
          </div>
          <div class="form-field full-width">
            <label>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              Company *
            </label>
            <select name="company_id" id="project-company-id">
              <option value="">Loading...</option>
            </select>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-sota secondary" id="cancel-btn">Cancel</button>
          <button type="submit" class="btn-sota primary">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Project
          </button>
        </div>
      </form>
    </div>
  `;

  bindCreateEvents(card);
}

/**
 * Render edit form with tabs
 */
function renderEditForm(container: HTMLElement): void {
  const project = currentProject || currentProps.project;
  if (!project) return;

  const settings = project.settings || {};

  container.innerHTML = `
    <!-- Header -->
    <div class="project-header">
      <button class="project-close-btn" id="close-project-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="project-header-content">
        <div class="project-icon-large">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div class="project-title-info">
          <h2>${escapeHtml(project.name)}</h2>
          <p>${project.description ? escapeHtml(project.description) : 'No description'}</p>
        </div>
      </div>
    </div>
    
    <!-- Tabs Navigation -->
    <nav class="project-tabs-nav">
      <button class="project-tab-btn active" data-tab="general">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        General
      </button>
      <button class="project-tab-btn" data-tab="members">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        Members
        <span class="badge">${projectMembers.length}</span>
      </button>
      <button class="project-tab-btn" data-tab="roles">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
        Roles
      </button>
      <button class="project-tab-btn" data-tab="config">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
        </svg>
        Config
      </button>
    </nav>
    
    <!-- Tab Content -->
    <div class="project-body">
      <!-- General Tab -->
      <div class="project-section active" id="section-general">
        <form id="project-form">
          <div class="form-grid">
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
                Project Name *
              </label>
              <input type="text" name="name" required value="${escapeHtml(project.name)}" placeholder="Enter project name">
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
                Description
              </label>
              <textarea name="description" placeholder="Brief description of the project">${escapeHtml(project.description || '')}</textarea>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Your Role
              </label>
              <input type="text" name="userRole" value="${escapeHtml(settings.userRole || '')}" placeholder="e.g., Project Manager, Tech Lead">
              <span class="form-hint">Your role in this project (used for AI context)</span>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                Role Prompt
              </label>
              <input type="text" name="userRolePrompt" value="${escapeHtml(settings.userRolePrompt || '')}" placeholder="e.g., I manage the project timeline">
              <span class="form-hint">Brief description of your responsibilities</span>
            </div>

            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                Company
              </label>
              <select name="company_id" id="project-company-id">
                <option value="">Loading...</option>
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
        
        <!-- Danger Zone -->
        <div class="danger-zone">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Danger Zone
          </h3>
          <p>Deleting a project will permanently remove all associated data including questions, decisions, risks, and contacts.</p>
          <button type="button" class="btn-sota danger" id="delete-project-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete Project
          </button>
        </div>
      </div>
      
      <!-- Members Tab -->
      <div class="project-section" id="section-members">
        <div class="section-header">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            Team Members
          </h3>
          <button class="btn-sota primary small" id="invite-member-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Invite
          </button>
        </div>
        
        <div class="members-list" id="members-list">
          ${renderMembersList()}
        </div>
      </div>
      
      <!-- Roles Tab -->
      <div class="project-section" id="section-roles">
        <div class="section-header">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            Available Roles
          </h3>
          <button class="btn-sota primary small" id="add-role-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Role
          </button>
        </div>
        <p class="section-intro">
          Select which roles are available for team members in this project.
        </p>
        
        <div class="roles-grid" id="roles-grid">
          ${renderRolesList()}
        </div>
      </div>
      
      <!-- Config Tab -->
      <div class="project-section" id="section-config">
        <div class="section-header">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
            Project Configuration
          </h3>
        </div>
        <p class="section-intro-24">
          Override system defaults with project-specific API keys. Leave empty to use system defaults.
        </p>
        
        <form id="config-form">
          <!-- LLM Per-Task Configuration -->
          <div class="config-group">
            <h4>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
              </svg>
              LLM Model Selection
            </h4>
            <p class="section-intro-sm">
              Override system defaults for each task type. Uncheck to use platform defaults.
            </p>
            
            <!-- Text -->
            <div class="llm-task-override">
              <div class="task-header-inline">
                <label class="checkbox-inline">
                  <input type="checkbox" name="use_system_text" ${getConfigValue('llm_pertask.useSystemDefaults.text') !== 'false' ? 'checked' : ''}>
                  <span class="task-icon">📝</span> Text / Chat
                </label>
                <span class="system-hint">(Use system default)</span>
              </div>
              <div class="task-override-fields ${getConfigValue('llm_pertask.useSystemDefaults.text') !== 'false' ? 'disabled' : ''}">
                <select name="text_provider" class="form-control" disabled>
                  <option value="">Loading...</option>
                </select>
                <select name="text_model" class="form-control" disabled>
                  <option value="">Select provider first</option>
                </select>
              </div>
            </div>
            
            <!-- Vision -->
            <div class="llm-task-override">
              <div class="task-header-inline">
                <label class="checkbox-inline">
                  <input type="checkbox" name="use_system_vision" ${getConfigValue('llm_pertask.useSystemDefaults.vision') !== 'false' ? 'checked' : ''}>
                  <span class="task-icon">👁️</span> Vision
                </label>
                <span class="system-hint">(Use system default)</span>
              </div>
              <div class="task-override-fields ${getConfigValue('llm_pertask.useSystemDefaults.vision') !== 'false' ? 'disabled' : ''}">
                <select name="vision_provider" class="form-control" disabled>
                  <option value="">Loading...</option>
                </select>
                <select name="vision_model" class="form-control" disabled>
                  <option value="">Select provider first</option>
                </select>
              </div>
            </div>
            
            <!-- Embeddings -->
            <div class="llm-task-override">
              <div class="task-header-inline">
                <label class="checkbox-inline">
                  <input type="checkbox" name="use_system_embeddings" ${getConfigValue('llm_pertask.useSystemDefaults.embeddings') !== 'false' ? 'checked' : ''}>
                  <span class="task-icon">🔗</span> Embeddings
                </label>
                <span class="system-hint">(Use system default)</span>
              </div>
              <div class="task-override-fields ${getConfigValue('llm_pertask.useSystemDefaults.embeddings') !== 'false' ? 'disabled' : ''}">
                <select name="embeddings_provider" class="form-control" disabled>
                  <option value="">Loading...</option>
                </select>
                <select name="embeddings_model" class="form-control" disabled>
                  <option value="">Select provider first</option>
                </select>
              </div>
            </div>
          </div>

          <div class="config-group">
            <h4>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              LLM API Keys
            </h4>
            <p class="section-intro-sm">
              Override system API keys for this project. Leave empty to use system defaults.
            </p>
            
            <div class="form-grid">
              <div class="form-field">
                <label>OpenAI API Key</label>
                <input type="password" name="openai_key" placeholder="sk-..." value="${escapeHtml(getConfigValue('llm_config.openai_key'))}">
              </div>
              
              <div class="form-field">
                <label>Anthropic API Key</label>
                <input type="password" name="anthropic_key" placeholder="sk-ant-..." value="${escapeHtml(getConfigValue('llm_config.anthropic_key'))}">
              </div>
              
              <div class="form-field">
                <label>Google AI API Key</label>
                <input type="password" name="google_key" placeholder="AI..." value="${escapeHtml(getConfigValue('llm_config.google_key'))}">
              </div>
              
              <div class="form-field">
                <label>xAI (Grok) API Key</label>
                <input type="password" name="grok_key" placeholder="xai-..." value="${escapeHtml(getConfigValue('llm_config.grok_key'))}">
              </div>
            </div>
          </div>
          
          <div class="config-group">
            <h4>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
              </svg>
              Ollama Configuration
            </h4>
            
            <div class="form-grid">
              <div class="form-field">
                <label>Ollama URL</label>
                <input type="url" name="ollama_url" placeholder="http://localhost:11434" value="${escapeHtml(getConfigValue('ollama_config.url'))}">
              </div>
              
              <div class="form-field">
                <label>Default Model</label>
                <input type="text" name="ollama_model" placeholder="llama2, mistral, etc." value="${escapeHtml(getConfigValue('ollama_config.model'))}">
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-sota primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  bindEditEvents(container);
}

// ==================== Render Helpers ====================

function renderMembersList(): string {
  if (projectMembers.length === 0) {
    return `
      <div class="empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <p>No team members yet</p>
        <button class="btn-sota primary small" id="invite-first-btn">Invite Member</button>
      </div>
    `;
  }

  return projectMembers.map(member => {
    const initials = getInitials(member.display_name || member.email || 'U');
    const isOwner = member.role === 'owner';

    return `
      <div class="member-card ${isOwner ? 'owner' : ''}" data-user-id="${member.user_id}">
        <div class="member-info">
          <div class="member-avatar">
            ${member.avatar_url
        ? `<img src="${member.avatar_url}" alt="${escapeHtml(member.display_name || '')}">`
        : initials
      }
          </div>
          <div class="member-details">
            <h4>${escapeHtml(member.display_name || member.email || 'Unknown')}</h4>
            <p>
              ${escapeHtml(member.email || '')}
              ${member.user_role ? ` • <strong>${escapeHtml(member.user_role)}</strong>` : ' • <em class="member-role-muted">No role defined</em>'}
              ${member.linked_contact ? ` • <span class="member-link" title="Linked to contact: ${escapeHtml(member.linked_contact.name)}">🔗 ${escapeHtml(member.linked_contact.name)}</span>` : ''}
            </p>
          </div>
        </div>
        <div class="member-actions">
          <button class="btn-sota secondary small edit-user-role-btn" data-user-id="${member.user_id}" title="Edit project role">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn-sota secondary small permissions-btn" data-user-id="${member.user_id}" title="Edit permissions">
            🔐
          </button>
          ${isOwner
        ? `<span class="role-badge owner">Owner</span>`
        : `
              <select class="role-select member-role-select" data-user-id="${member.user_id}" title="Access level">
                <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                <option value="write" ${member.role === 'write' ? 'selected' : ''}>Write</option>
                <option value="read" ${member.role === 'read' ? 'selected' : ''}>Read</option>
              </select>
              <button class="btn-sota danger small remove-member-btn" data-user-id="${member.user_id}" title="Remove member">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            `
      }
        </div>
      </div>
    `;
  }).join('');
}

function renderRolesList(): string {
  if (projectRoles.length === 0) {
    return `
      <div class="empty-state gm-grid-col-all">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
        <p>No role templates available</p>
      </div>
    `;
  }

  return projectRoles.map(role => `
    <div class="role-card ${role.is_active ? 'active' : ''}" data-role-id="${role.id}">
      <div class="role-card-header">
        <div class="role-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <h4>${escapeHtml(role.display_name)}</h4>
      </div>
      <p>${escapeHtml(role.description || 'No description')}</p>
      <div class="toggle-active">
        <input type="checkbox" id="role-${role.id}" ${role.is_active ? 'checked' : ''}>
        <label for="role-${role.id}">Active in this project</label>
      </div>
    </div>
  `).join('');
}

function getConfigValue(path: string): string {
  if (!projectConfig) return '';

  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = projectConfig;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return '';
    }
  }

  return typeof value === 'string' ? value : '';
}

// ==================== Event Binding ====================

function bindCreateEvents(container: HTMLElement): void {
  // Close button
  const closeBtn = container.querySelector('#close-project-btn');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', () => closeOrInlineCancel());
  }

  // Cancel button
  const cancelBtn = container.querySelector('#cancel-btn');
  if (cancelBtn) {
    on(cancelBtn as HTMLElement, 'click', () => closeOrInlineCancel());
  }

  // Load companies for dropdown
  const companySelect = container.querySelector('#project-company-id') as HTMLSelectElement;
  if (companySelect) {
    listCompanies()
      .then((companies) => {
        companySelect.innerHTML = '<option value="">Use default company</option>' +
          companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      })
      .catch(() => {
        companySelect.innerHTML = '<option value="">Use default company</option>';
      });
  }

  // Form submit
  const form = container.querySelector('#project-form') as HTMLFormElement;
  if (form) {
    on(form, 'submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const companyId = (formData.get('company_id') as string)?.trim() || undefined;
      const projectData: ProjectData & { company_id?: string } = {
        name: (formData.get('name') as string).trim(),
        description: (formData.get('description') as string).trim() || undefined,
      };
      if (companyId) projectData.company_id = companyId;

      // SOTA Validation
      const validation = projectSchema.safeParse(projectData);
      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner gm-size-4"></span> Creating...';

      try {
        const response = await http.post<{ id: string; project?: ProjectData }>('/api/projects', projectData);
        projectData.id = response.data.id;

        toast.success('Project created');

        // Set as current project
        appStore.setCurrentProject({
          id: projectData.id,
          name: projectData.name,
          description: projectData.description,
        });

        currentProps.onSave?.(projectData);
        closeOrInlineCancel();
        loadProjects();
      } catch {
        toast.error('Failed to create project');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Project
        `;
      }
    });
  }
}

function bindEditEvents(container: HTMLElement): void {
  // Close button
  const closeBtn = container.querySelector('#close-project-btn');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', () => closeOrInlineCancel());
  }

  // Tab switching
  const tabs = container.querySelectorAll('.project-tab-btn');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabId = tab.getAttribute('data-tab');
      container.querySelectorAll('.project-section').forEach(section => {
        section.classList.toggle('active', section.id === `section-${tabId}`);
      });
    });
  });

  // Load companies for edit form dropdown
  const companySelectEdit = container.querySelector('#project-company-id') as HTMLSelectElement;
  if (companySelectEdit) {
    const project = currentProject || currentProps.project;
    const currentCompanyId = project?.company_id ?? (project as ProjectData & { company?: { id: string } })?.company?.id;
    listCompanies()
      .then((companies) => {
        companySelectEdit.innerHTML = '<option value="">—</option>' +
          companies.map((c) => `<option value="${c.id}" ${c.id === currentCompanyId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
      })
      .catch(() => {
        companySelectEdit.innerHTML = '<option value="">—</option>';
      });
  }

  // General form submit
  const projectForm = container.querySelector('#project-form') as HTMLFormElement;
  if (projectForm) {
    on(projectForm, 'submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(projectForm);
      const companyId = (formData.get('company_id') as string)?.trim() || undefined;
      const projectData: Record<string, unknown> = {
        name: (formData.get('name') as string).trim(),
        description: (formData.get('description') as string).trim() || undefined,
        settings: {
          userRole: (formData.get('userRole') as string).trim() || undefined,
          userRolePrompt: (formData.get('userRolePrompt') as string).trim() || undefined,
        },
      };
      if (companyId) projectData.company_id = companyId;

      // SOTA Validation
      const validation = projectSchema.safeParse(projectData);
      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        return;
      }

      try {
        await http.put(`/api/projects/${currentProject?.id || currentProps.project?.id}`, projectData);
        toast.success('Project updated');
        currentProps.onSave?.({ ...currentProject, ...projectData } as ProjectData);
        if (inlineOnCancel) closeOrInlineCancel();

        // Update header
        const titleEl = container.querySelector('.project-title-info h2');
        const descEl = container.querySelector('.project-title-info p');
        if (titleEl) titleEl.textContent = String(projectData.name);
        if (descEl) descEl.textContent = String(projectData.description || 'No description');
      } catch {
        toast.error('Failed to update project');
      }
    });
  }

  // Delete project
  const deleteBtn = container.querySelector('#delete-project-btn');
  if (deleteBtn) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      const project = currentProject || currentProps.project;
      if (!project?.id) return;

      const confirmed = await confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
        {
          title: 'Delete Project',
          confirmText: 'Delete',
          confirmClass: 'btn-danger',
        }
      );

      if (confirmed) {
        try {
          await http.delete(`/api/projects/${project.id}`);
          toast.success('Project deleted');
          currentProps.onDelete?.(project.id);
          closeOrInlineCancel();

          if (appStore.getState().currentProjectId === project.id) {
            appStore.setCurrentProject(null);
          }

          loadProjects();
        } catch {
          toast.error('Failed to delete project');
        }
      }
    });
  }

  // Invite member buttons
  const inviteBtn = container.querySelector('#invite-member-btn');
  const inviteFirstBtn = container.querySelector('#invite-first-btn');
  [inviteBtn, inviteFirstBtn].forEach(btn => {
    if (btn) {
      on(btn as HTMLElement, 'click', () => {
        showInviteModal();
      });
    }
  });

  // Add role button
  const addRoleBtn = container.querySelector('#add-role-btn');
  if (addRoleBtn) {
    on(addRoleBtn as HTMLElement, 'click', () => {
      showAddRoleDialog(container);
    });
  }

  // Member role changes
  container.querySelectorAll('.member-role-select').forEach(select => {
    on(select as HTMLElement, 'change', async () => {
      const userId = select.getAttribute('data-user-id');
      const newRole = (select as HTMLSelectElement).value;
      const projectId = currentProject?.id || currentProps.project?.id;

      if (!userId || !projectId) return;

      try {
        await http.put(`/api/projects/${projectId}/members/${userId}`, { role: newRole });
        toast.success('Member role updated');
      } catch {
        toast.error('Failed to update role');
      }
    });
  });

  // Remove member
  container.querySelectorAll('.remove-member-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const userId = btn.getAttribute('data-user-id');
      const projectId = currentProject?.id || currentProps.project?.id;

      if (!userId || !projectId) return;

      const confirmed = await confirm('Remove this member from the project?', {
        title: 'Remove Member',
        confirmText: 'Remove',
        confirmClass: 'btn-danger',
      });

      if (confirmed) {
        try {
          await http.delete(`/api/projects/${projectId}/members/${userId}`);
          toast.success('Member removed');

          // Remove from list
          projectMembers = projectMembers.filter(m => m.user_id !== userId);
          const membersList = container.querySelector('#members-list');
          if (membersList) {
            membersList.innerHTML = renderMembersList();
            bindMemberEvents(container);
          }
        } catch {
          toast.error('Failed to remove member');
        }
      }
    });
  });

  // Config form submit
  const configForm = container.querySelector('#config-form') as HTMLFormElement;
  if (configForm) {
    on(configForm, 'submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(configForm);
      const config = {
        llm_config: {
          openai_key: formData.get('openai_key') || undefined,
          anthropic_key: formData.get('anthropic_key') || undefined,
          google_key: formData.get('google_key') || undefined,
          grok_key: formData.get('grok_key') || undefined,
        },
        ollama_config: {
          url: formData.get('ollama_url') || undefined,
          model: formData.get('ollama_model') || undefined,
        },
      };

      const projectId = currentProject?.id || currentProps.project?.id;
      if (!projectId) return;

      try {
        await http.put(`/api/projects/${projectId}/config`, config);
        toast.success('Configuration saved');
      } catch {
        toast.error('Failed to save configuration');
      }
    });
  }

  // Bind member-specific events (edit role buttons)
  bindMemberEvents(container);
}

function bindMemberEvents(container: HTMLElement): void {
  // Edit user role buttons
  container.querySelectorAll('.edit-user-role-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const userId = btn.getAttribute('data-user-id');
      if (!userId) return;

      const member = projectMembers.find(m => m.user_id === userId);
      if (member) {
        showEditUserRoleDialog(container, member);
      }
    });
  });

  // Permissions buttons
  container.querySelectorAll('.permissions-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const userId = btn.getAttribute('data-user-id');
      if (!userId) return;

      const member = projectMembers.find(m => m.user_id === userId);
      const projectId = currentProject?.id || currentProps.project?.id;
      if (!member || !projectId) return;

      showMemberPermissionsModal({
        projectId,
        userId: member.user_id,
        userName: member.display_name || '',
        userEmail: member.email || '',
        avatarUrl: member.avatar_url,
        currentRole: member.role,
        currentPermissions: (member as { permissions?: string[] }).permissions,
        onSave: async () => {
          // Reload members after permissions update
          try {
            const response = await http.get<{ members: typeof projectMembers }>(`/api/projects/${projectId}/members`);
            projectMembers = response.data.members || [];
            const membersList = container.querySelector('#members-list');
            if (membersList) {
              membersList.innerHTML = renderMembersList();
              bindMemberEvents(container);
            }
          } catch {
            // Ignore
          }
        },
      });
    });
  });

  // Re-bind member role changes and remove buttons after list update
  container.querySelectorAll('.member-role-select').forEach(select => {
    on(select as HTMLElement, 'change', async () => {
      const userId = select.getAttribute('data-user-id');
      const newRole = (select as HTMLSelectElement).value;
      const projectId = currentProject?.id || currentProps.project?.id;

      if (!userId || !projectId) return;

      try {
        await http.put(`/api/projects/${projectId}/members/${userId}`, { role: newRole });
        toast.success('Access level updated');
      } catch {
        toast.error('Failed to update access level');
      }
    });
  });

  container.querySelectorAll('.remove-member-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const userId = btn.getAttribute('data-user-id');
      const projectId = currentProject?.id || currentProps.project?.id;

      if (!userId || !projectId) return;

      const confirmed = await confirm('Remove this member from the project?', {
        title: 'Remove Member',
        confirmText: 'Remove',
        confirmClass: 'btn-danger',
      });

      if (confirmed) {
        try {
          await http.delete(`/api/projects/${projectId}/members/${userId}`);
          toast.success('Member removed');

          projectMembers = projectMembers.filter(m => m.user_id !== userId);
          const membersList = container.querySelector('#members-list');
          if (membersList) {
            membersList.innerHTML = renderMembersList();
            bindMemberEvents(container);
          }
        } catch {
          toast.error('Failed to remove member');
        }
      }
    });
  });
}

/**
 * Show dialog to add a new role
 */
function showAddRoleDialog(container: HTMLElement): void {
  // Check if dialog already exists
  const existingDialog = container.querySelector('.add-role-dialog');
  if (existingDialog) existingDialog.remove();

  const projectId = currentProject?.id || currentProps.project?.id;
  if (!projectId) return;

  // Create dialog
  const dialog = createElement('div', { className: 'add-role-dialog' });
  dialog.innerHTML = `
    <style>
      .add-role-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        backdrop-filter: blur(4px);
      }
      
      .add-role-card {
        background: white;
        border-radius: 20px;
        width: 100%;
        max-width: 500px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        overflow: hidden;
      }
      
      [data-theme="dark"] .add-role-card {
        background: #1e293b;
      }
      
      .add-role-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 20px 24px;
        color: white;
      }
      
      .add-role-header h4 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
      }
      
      .add-role-body {
        padding: 24px;
      }
      
      .add-role-field {
        margin-bottom: 20px;
      }
      
      .add-role-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 8px;
      }
      
      .add-role-field input,
      .add-role-field textarea,
      .add-role-field select {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        box-sizing: border-box;
        background: #f8fafc;
      }
      
      [data-theme="dark"] .add-role-field input,
      [data-theme="dark"] .add-role-field textarea,
      [data-theme="dark"] .add-role-field select {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .add-role-field input:focus,
      .add-role-field textarea:focus,
      .add-role-field select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
      }
      
      .add-role-field textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .add-role-ai-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
        transition: all 0.2s;
      }
      
      .add-role-ai-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139,92,246,0.3);
      }
      
      .add-role-ai-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .add-role-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      
      [data-theme="dark"] .add-role-actions {
        border-color: rgba(255,255,255,0.1);
      }
    </style>
    
    <div class="add-role-card">
      <div class="add-role-header">
        <h4>Add New Role</h4>
      </div>
      <div class="add-role-body">
        <form id="add-role-form">
          <div class="add-role-field">
            <label>Role Name *</label>
            <input type="text" id="new-role-name" required placeholder="e.g., Senior Developer, Tech Lead">
          </div>
          
          <div class="add-role-field">
            <label>Category</label>
            <select id="new-role-category">
              <option value="project">📋 Project</option>
              <option value="technical">💻 Technical</option>
              <option value="management">👔 Management</option>
              <option value="stakeholder">🤝 Stakeholder</option>
              <option value="custom">✨ Custom</option>
            </select>
          </div>
          
          <div class="add-role-field">
            <label>Description</label>
            <input type="text" id="new-role-description" placeholder="Brief description of this role">
          </div>
          
          <div class="add-role-field">
            <label>Role Context (for AI)</label>
            <textarea id="new-role-context" placeholder="Describe this role's responsibilities, priorities, and how the AI should adapt responses..."></textarea>
            <button type="button" class="add-role-ai-btn" id="enhance-role-btn">
              ⚡ Enhance with AI
            </button>
          </div>
          
          <div class="add-role-actions">
            <button type="button" class="btn-sota secondary" id="cancel-add-role">Cancel</button>
            <button type="submit" class="btn-sota primary">Create Role</button>
          </div>
        </form>
      </div>
    </div>
  `;

  container.appendChild(dialog);

  // Bind events
  const closeDialog = () => dialog.remove();

  // Cancel button
  const cancelBtn = dialog.querySelector('#cancel-add-role');
  if (cancelBtn) {
    on(cancelBtn as HTMLElement, 'click', closeDialog);
  }

  // Click outside to close
  on(dialog, 'click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  // AI enhance button
  const enhanceBtn = dialog.querySelector('#enhance-role-btn');
  if (enhanceBtn) {
    on(enhanceBtn as HTMLElement, 'click', async () => {
      const nameInput = dialog.querySelector('#new-role-name') as HTMLInputElement;
      const contextInput = dialog.querySelector('#new-role-context') as HTMLTextAreaElement;
      const descInput = dialog.querySelector('#new-role-description') as HTMLInputElement;

      const roleName = nameInput.value.trim();
      if (!roleName) {
        toast.error('Please enter a role name first');
        return;
      }

      (enhanceBtn as HTMLButtonElement).disabled = true;
      enhanceBtn.textContent = '⏳ Enhancing...';

      try {
        const response = await http.post<{ prompt: string; description?: string }>('/api/roles/generate', {
          title: roleName,
          currentContext: contextInput.value,
        });

        if (response.data.prompt) {
          contextInput.value = response.data.prompt;
        }
        if (response.data.description && !descInput.value) {
          descInput.value = response.data.description;
        }
        toast.success('Role context enhanced');
      } catch {
        toast.error('Failed to enhance with AI');
      } finally {
        (enhanceBtn as HTMLButtonElement).disabled = false;
        enhanceBtn.textContent = '⚡ Enhance with AI';
      }
    });
  }

  // Form submit
  const form = dialog.querySelector('#add-role-form') as HTMLFormElement;
  if (form) {
    on(form, 'submit', async (e) => {
      e.preventDefault();

      const name = (dialog.querySelector('#new-role-name') as HTMLInputElement).value.trim();
      const category = (dialog.querySelector('#new-role-category') as HTMLSelectElement).value;
      const description = (dialog.querySelector('#new-role-description') as HTMLInputElement).value.trim();
      const roleContext = (dialog.querySelector('#new-role-context') as HTMLTextAreaElement).value.trim();

      if (!name) {
        toast.error('Role name is required');
        return;
      }

      try {
        await http.post('/api/role-templates', {
          name: name.toLowerCase().replace(/\s+/g, '_'),
          display_name: name,
          description,
          role_context: roleContext,
          category,
          color: '#e11d48',
          is_template: true,
        });

        toast.success('Role created');
        closeDialog();

        // Reload roles
        await loadProjectRoles(projectId);
        const rolesGrid = container.querySelector('#roles-grid');
        if (rolesGrid) {
          rolesGrid.innerHTML = renderRolesList();
        }
      } catch {
        toast.error('Failed to create role');
      }
    });
  }

  // Focus on name input
  setTimeout(() => {
    const nameInput = dialog.querySelector('#new-role-name') as HTMLInputElement;
    if (nameInput) nameInput.focus();
  }, 100);
}

/**
 * Show inline edit dialog for user role
 */
function showEditUserRoleDialog(container: HTMLElement, member: ProjectMember): void {
  // Check if dialog already exists
  const existingDialog = container.querySelector('.user-role-edit-dialog');
  if (existingDialog) existingDialog.remove();

  const projectId = currentProject?.id || currentProps.project?.id;
  if (!projectId) return;

  // Create inline edit dialog
  const dialog = createElement('div', { className: 'user-role-edit-dialog' });
  dialog.innerHTML = `
    <style>
      .user-role-edit-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        padding: 24px;
        z-index: 10001;
        width: 400px;
        max-width: 90vw;
      }
      
      [data-theme="dark"] .user-role-edit-dialog {
        background: #1e293b;
      }
      
      .user-role-edit-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      [data-theme="dark"] .user-role-edit-dialog h3 {
        color: #f1f5f9;
      }
      
      .user-role-edit-dialog h3 svg {
        width: 20px;
        height: 20px;
        color: #e11d48;
      }
      
      .user-role-edit-dialog .form-field {
        margin-bottom: 16px;
      }
      
      .user-role-edit-dialog .form-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        margin-bottom: 6px;
      }
      
      [data-theme="dark"] .user-role-edit-dialog .form-field label {
        color: #94a3b8;
      }
      
      .user-role-edit-dialog .form-field input,
      .user-role-edit-dialog .form-field textarea,
      .user-role-edit-dialog .form-field select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        background: #f8fafc;
        color: #1e293b;
        box-sizing: border-box;
      }
      
      [data-theme="dark"] .user-role-edit-dialog .form-field input,
      [data-theme="dark"] .user-role-edit-dialog .form-field textarea,
      [data-theme="dark"] .user-role-edit-dialog .form-field select {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .user-role-edit-dialog .form-field input:focus,
      .user-role-edit-dialog .form-field textarea:focus,
      .user-role-edit-dialog .form-field select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }
      
      .user-role-edit-dialog .form-field textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .user-role-edit-dialog .form-hint {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 4px;
      }
      
      .user-role-edit-dialog .linked-contact-info {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
        border: 1px solid rgba(225,29,72,0.2);
        border-radius: 10px;
        margin-top: 8px;
      }
      
      .user-role-edit-dialog .linked-contact-info svg {
        width: 16px;
        height: 16px;
        color: #e11d48;
        flex-shrink: 0;
      }
      
      .user-role-edit-dialog .linked-contact-info span {
        font-size: 13px;
        color: #1e293b;
      }
      
      [data-theme="dark"] .user-role-edit-dialog .linked-contact-info span {
        color: #f1f5f9;
      }
      
      .user-role-edit-dialog .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      
      .user-role-edit-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 10000;
      }
    </style>
    
    <h3>
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
      Edit Project Role
    </h3>
    <p class="section-intro-last">
      Define <strong>${escapeHtml(member.display_name || member.email || 'this member')}</strong>'s role in the project
    </p>
    
    <div class="form-field">
      <label>Role Title</label>
      <select id="edit-user-role">
        <option value="">-- Select a role --</option>
        ${projectRoles.filter(r => r.is_active).map(r => `
          <option value="${escapeHtml(r.display_name || r.name)}" 
                  data-prompt="${escapeHtml(r.prompt_template || '')}"
                  ${member.user_role === r.display_name || member.user_role === r.name ? 'selected' : ''}>
            ${escapeHtml(r.display_name || r.name)}
          </option>
        `).join('')}
        <option value="__custom__" ${member.user_role && !projectRoles.some(r => r.display_name === member.user_role || r.name === member.user_role) ? 'selected' : ''}>Custom role...</option>
      </select>
      <div class="form-hint">Select a predefined role or choose "Custom role" for a custom title</div>
      <input type="text" id="edit-user-role-custom" 
             value="${member.user_role && !projectRoles.some(r => r.display_name === member.user_role || r.name === member.user_role) ? escapeHtml(member.user_role) : ''}" 
             placeholder="Enter custom role title"
             class="gm-mt-2 ${member.user_role && !projectRoles.some(r => r.display_name === member.user_role || r.name === member.user_role) ? '' : 'hidden'}">
    </div>
    
    <div class="form-field">
      <label>Role Description</label>
      <textarea id="edit-user-role-prompt" placeholder="e.g., I manage the technical architecture and lead the development team">${escapeHtml(member.user_role_prompt || '')}</textarea>
      <div class="form-hint">Brief description of responsibilities (used for AI context)</div>
    </div>
    
    <div class="form-field">
      <label>
        <svg class="gm-inline-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        Link to Contact
      </label>
      <select id="edit-linked-contact">
        <option value="">-- No linked contact --</option>
        ${projectContacts.map(c => `
          <option value="${c.id}" ${member.linked_contact_id === c.id ? 'selected' : ''}>
            ${escapeHtml(c.name)}${c.organization ? ` (${escapeHtml(c.organization)})` : ''}${c.email ? ` - ${escapeHtml(c.email)}` : ''}
          </option>
        `).join('')}
      </select>
      <div class="form-hint">Associate this team member with a project contact</div>
      ${member.linked_contact ? `
        <div class="linked-contact-info">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          <span>Currently linked to: <strong>${escapeHtml(member.linked_contact.name)}</strong></span>
        </div>
      ` : ''}
    </div>
    
    <div class="dialog-actions">
      <button class="btn-sota secondary" id="cancel-role-edit">Cancel</button>
      <button class="btn-sota primary" id="save-role-edit">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Save Role
      </button>
    </div>
  `;

  // Create overlay
  const overlay = createElement('div', { className: 'user-role-edit-overlay' });

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);

  // Focus first input
  const roleSelect = dialog.querySelector('#edit-user-role') as HTMLSelectElement;
  const customInput = dialog.querySelector('#edit-user-role-custom') as HTMLInputElement;
  const promptTextarea = dialog.querySelector('#edit-user-role-prompt') as HTMLTextAreaElement;
  setTimeout(() => roleSelect?.focus(), 100);

  // Handle role selection change
  on(roleSelect, 'change', () => {
    const selectedOption = roleSelect.options[roleSelect.selectedIndex];
    const isCustom = roleSelect.value === '__custom__';

    // Show/hide custom input
    customInput.classList.toggle('hidden', !isCustom);
    if (isCustom) {
      customInput.focus();
    }

    // Auto-fill prompt from role template (always when selecting a predefined role)
    if (!isCustom && selectedOption.dataset.prompt) {
      promptTextarea.value = selectedOption.dataset.prompt;
    }
  });

  // Cancel button
  const cancelBtn = dialog.querySelector('#cancel-role-edit');
  const closeDialog = () => {
    overlay.remove();
    dialog.remove();
  };

  on(cancelBtn as HTMLElement, 'click', closeDialog);
  on(overlay, 'click', closeDialog);

  // Save button
  const saveBtn = dialog.querySelector('#save-role-edit');
  on(saveBtn as HTMLElement, 'click', async () => {
    const roleSelectValue = roleSelect.value;
    const userRole = roleSelectValue === '__custom__' ? customInput.value.trim() : roleSelectValue;
    const userRolePrompt = (dialog.querySelector('#edit-user-role-prompt') as HTMLTextAreaElement).value.trim();
    const linkedContactId = (dialog.querySelector('#edit-linked-contact') as HTMLSelectElement).value || null;

    try {
      await http.put(`/api/projects/${projectId}/members/${member.user_id}`, {
        user_role: userRole,
        user_role_prompt: userRolePrompt,
        linked_contact_id: linkedContactId,
      });

      // Update local state
      const memberIndex = projectMembers.findIndex(m => m.user_id === member.user_id);
      if (memberIndex !== -1) {
        projectMembers[memberIndex].user_role = userRole;
        projectMembers[memberIndex].user_role_prompt = userRolePrompt;
        projectMembers[memberIndex].linked_contact_id = linkedContactId || undefined;
        // Find linked contact info
        if (linkedContactId) {
          const contact = projectContacts.find(c => c.id === linkedContactId);
          if (contact) {
            projectMembers[memberIndex].linked_contact = {
              id: contact.id,
              name: contact.name,
              email: contact.email,
              organization: contact.organization,
              role: contact.role,
            };
          }
        } else {
          projectMembers[memberIndex].linked_contact = undefined;
        }
      }

      // Refresh list
      const membersList = container.querySelector('#members-list');
      if (membersList) {
        membersList.innerHTML = renderMembersList();
        bindMemberEvents(container);
      }

      toast.success('Project role updated');
      closeDialog();
    } catch {
      toast.error('Failed to update role');
    }
  });

  // Close on Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// ==================== Helper Functions ====================

async function showInviteModal(): Promise<void> {
  const { showInviteModal: showInvite } = await import('./InviteModal');
  const projectId = currentProject?.id || currentProps.project?.id;
  if (projectId) {
    showInvite({
      projectId,
      onInvite: async () => {
        // Refresh members list
        try {
          const res = await http.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);
          projectMembers = res.data.members || [];
          const membersList = document.querySelector('#members-list');
          if (membersList) {
            membersList.innerHTML = renderMembersList();
            bindMemberEvents(membersList.closest('.project-card') as HTMLElement);
          }
        } catch {
          // Ignore
        }
      },
    });
  }
}

async function loadProjects(): Promise<void> {
  try {
    const response = await http.get<Array<{ id: string; name: string }>>('/api/projects');
    dataStore.setProjects(response.data);
  } catch {
    // Silent fail
  }
}

async function loadProjectRoles(projectId: string): Promise<void> {
  try {
    const response = await http.get<{ roles: RoleTemplate[] }>('/api/role-templates');
    projectRoles = response.data.roles || [];
  } catch {
    projectRoles = [];
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function closeProjectModal(): void {
  closeModal(MODAL_ID);
}

export default showProjectModal;
