/**
 * Contacts Panel Component - SOTA Design
 * Contact list with search, filters, favorites, and management
 */

import { createElement, on } from '../utils/dom';
import { contactsService, Contact } from '../services/contacts';
import { showContactModal } from './modals/ContactModal';
import { toast } from '../services/toast';
import { http } from '../services/api';

export interface ContactsPanelProps {
  onContactClick?: (contact: Contact) => void;
}

let currentSearch = '';
let currentFilter: { organization?: string; tag?: string; favorites?: boolean } = {};
let allContacts: Contact[] = [];
let selectedContactIds: Set<string> = new Set();

/**
 * Create contacts panel
 */
export function createContactsPanel(props: ContactsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'contacts-panel-sota' });

  panel.innerHTML = `
    <style>
      .contacts-panel-sota {
        padding: 24px;
        min-height: 100%;
      }

      /* Header */
      .contacts-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .contacts-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .contacts-title-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
      }

      .contacts-title-icon svg {
        width: 26px;
        height: 26px;
        color: white;
      }

      .contacts-title h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .contacts-count {
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
      }

      .contacts-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      /* Search Bar */
      .contacts-search-wrapper {
        position: relative;
        flex: 1;
        max-width: 400px;
        min-width: 200px;
      }

      .contacts-search-wrapper svg {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        color: var(--text-tertiary);
        pointer-events: none;
        transition: color 0.2s;
      }

      .contacts-search {
        width: 100%;
        padding: 12px 14px 12px 44px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.2s;
      }

      .contacts-search:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }

      .contacts-search:focus + svg {
        color: #e11d48;
      }

      /* SOTA Buttons */
      .btn-sota {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
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
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
      }

      .btn-sota.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(225, 29, 72, 0.4);
      }

      .btn-sota.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }

      .btn-sota.secondary:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
      }

      .btn-sota svg {
        width: 16px;
        height: 16px;
      }

      /* Filters */
      .contacts-filters {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }

      .filter-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-chip:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
        color: #e11d48;
      }

      .filter-chip.active {
        background: linear-gradient(135deg, rgba(225,29,72,0.1) 0%, rgba(225,29,72,0.05) 100%);
        border-color: #e11d48;
        color: #e11d48;
      }

      .filter-chip svg {
        width: 14px;
        height: 14px;
      }

      .filter-select {
        padding: 8px 32px 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 20px;
        font-size: 13px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
      }

      .filter-select:focus {
        outline: none;
        border-color: #e11d48;
      }

      /* Alerts */
      .contacts-alerts {
        margin-bottom: 20px;
      }

      .alert-sota {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.05) 100%);
        border: 1px solid rgba(245,158,11,0.3);
        border-radius: 12px;
        color: #d97706;
      }

      .alert-sota svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .alert-sota span {
        flex: 1;
        font-size: 14px;
      }

      .alert-sota .btn-sota {
        padding: 6px 12px;
        font-size: 12px;
      }

      /* Favorites Section */
      .favorites-section {
        margin-bottom: 28px;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
        color: var(--text-secondary);
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .section-header svg {
        width: 16px;
        height: 16px;
        color: #f59e0b;
      }

      .favorites-grid {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 8px;
      }

      .favorite-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%);
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .favorite-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(245,158,11,0.15);
        border-color: #f59e0b;
      }

      .favorite-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
      }

      .favorite-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .favorite-info h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .favorite-info p {
        margin: 2px 0 0 0;
        font-size: 12px;
        color: var(--text-secondary);
      }

      /* Contacts Grid */
      .contacts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }

      .contact-card-sota {
        background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 100%);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.25s ease;
        position: relative;
        overflow: hidden;
      }

      [data-theme="dark"] .contact-card-sota {
        background: linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(30,41,59,0.5) 100%);
      }

      .contact-card-sota:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        border-color: rgba(225,29,72,0.3);
      }

      .contact-card-sota::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #e11d48, #f59e0b);
        opacity: 0;
        transition: opacity 0.2s;
      }

      .contact-card-sota:hover::before {
        opacity: 1;
      }

      .contact-card-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 14px;
      }

      .contact-avatar-sota {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(225,29,72,0.25);
      }

      .contact-avatar-sota img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .contact-main-info {
        flex: 1;
        min-width: 0;
      }

      .contact-name-sota {
        margin: 0 0 4px 0;
        font-size: 17px;
        font-weight: 700;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .contact-role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: linear-gradient(135deg, rgba(225,29,72,0.1) 0%, rgba(225,29,72,0.05) 100%);
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #e11d48;
        margin-bottom: 4px;
      }

      .contact-org-sota {
        font-size: 13px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .contact-org-sota svg {
        width: 14px;
        height: 14px;
        opacity: 0.6;
      }

      .contact-details-sota {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 12px;
        border-top: 1px solid var(--border-color);
      }

      .contact-detail-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-secondary);
      }

      .contact-detail-item svg {
        width: 14px;
        height: 14px;
        color: #e11d48;
        flex-shrink: 0;
      }

      .contact-detail-item span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .contact-tags-sota {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
      }

      .contact-tag {
        padding: 3px 8px;
        background: var(--bg-tertiary);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
      }

      .contact-quick-actions {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .contact-card-sota:hover .contact-quick-actions {
        opacity: 1;
      }

      .quick-action-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .quick-action-btn:hover {
        background: #e11d48;
        border-color: #e11d48;
        color: white;
      }

      .quick-action-btn.favorite {
        color: #f59e0b;
      }

      .quick-action-btn.favorite.active {
        background: #f59e0b;
        border-color: #f59e0b;
        color: white;
      }

      .quick-action-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Selection Checkbox */
      .contact-select-checkbox {
        position: absolute;
        top: 12px;
        left: 12px;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid var(--border-color);
        background: var(--bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        z-index: 5;
        opacity: 0;
      }

      .contact-card-sota:hover .contact-select-checkbox,
      .contact-card-sota.selected .contact-select-checkbox {
        opacity: 1;
      }

      .contact-select-checkbox:hover {
        border-color: #e11d48;
      }

      .contact-select-checkbox.checked {
        background: linear-gradient(135deg, #e11d48, #be123c);
        border-color: #e11d48;
      }

      .contact-select-checkbox svg {
        width: 14px;
        height: 14px;
        color: white;
        display: none;
      }

      .contact-select-checkbox.checked svg {
        display: block;
      }

      .contact-card-sota.selected {
        border-color: #e11d48;
        box-shadow: 0 0 0 2px rgba(225,29,72,0.2);
      }

      /* Selection Bar */
      .selection-bar {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1e293b, #0f172a);
        padding: 12px 24px;
        border-radius: 50px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }

      .selection-bar-count {
        color: white;
        font-size: 14px;
        font-weight: 600;
      }

      .selection-bar-count span {
        color: #f59e0b;
      }

      .selection-bar-btn {
        padding: 10px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
        border: none;
      }

      .selection-bar-btn.merge {
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
      }

      .selection-bar-btn.merge:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(225,29,72,0.4);
      }

      .selection-bar-btn.cancel {
        background: rgba(255,255,255,0.1);
        color: white;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .selection-bar-btn.cancel:hover {
        background: rgba(255,255,255,0.2);
      }

      .selection-bar-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Empty State */
      .contacts-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        text-align: center;
      }

      .contacts-empty-state svg {
        width: 80px;
        height: 80px;
        color: #e11d48;
        opacity: 0.4;
        margin-bottom: 24px;
      }

      .contacts-empty-state h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .contacts-empty-state p {
        margin: 0 0 24px 0;
        font-size: 14px;
        color: var(--text-secondary);
      }

      /* Loading */
      .contacts-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        color: var(--text-secondary);
      }

      .contacts-loading::after {
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

      /* Projects indicator */
      .contact-projects-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        font-size: 12px;
        color: var(--text-tertiary);
      }

      .contact-projects-indicator svg {
        width: 14px;
        height: 14px;
      }

      .project-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e11d48;
      }
    </style>

    <!-- Header -->
    <div class="contacts-header">
      <div class="contacts-title">
        <div class="contacts-title-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <h1>Contacts</h1>
        <span class="contacts-count" id="contacts-count">0</span>
      </div>

      <div class="contacts-actions">
        <div class="contacts-search-wrapper">
          <input type="search" class="contacts-search" id="contacts-search" placeholder="Search contacts...">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <button class="btn-sota secondary" id="import-contacts-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Import
        </button>
        <button class="btn-sota secondary" id="export-contacts-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export
        </button>
        <button class="btn-sota primary" id="add-contact-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Contact
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="contacts-filters">
      <div class="filter-chip" id="filter-favorites" data-filter="favorites">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>
        Favorites
      </div>
      <select class="filter-select" id="org-filter">
        <option value="">All Organizations</option>
      </select>
      <select class="filter-select" id="tag-filter">
        <option value="">All Tags</option>
      </select>
    </div>

    <!-- Alerts -->
    <div class="contacts-alerts" id="contacts-alerts"></div>

    <!-- Favorites Section -->
    <div class="favorites-section hidden" id="favorites-section">
      <div class="section-header">
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>
        Favorites
      </div>
      <div class="favorites-grid" id="favorites-grid"></div>
    </div>

    <!-- Main Content -->
    <div id="contacts-content">
      <div class="contacts-loading">Loading contacts</div>
    </div>
  `;

  // Bind events
  bindEvents(panel, props);

  // Initial load
  loadContacts(panel, props);
  checkDuplicates(panel);

  return panel;
}

/**
 * Bind panel events
 */
function bindEvents(panel: HTMLElement, props: ContactsPanelProps): void {
  // Search
  const searchInput = panel.querySelector('#contacts-search') as HTMLInputElement;
  let searchTimeout: number;
  on(searchInput, 'input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      currentSearch = searchInput.value;
      loadContacts(panel, props);
    }, 300);
  });

  // Organization filter
  const orgFilter = panel.querySelector('#org-filter') as HTMLSelectElement;
  on(orgFilter, 'change', () => {
    currentFilter.organization = orgFilter.value || undefined;
    loadContacts(panel, props);
  });

  // Tag filter
  const tagFilter = panel.querySelector('#tag-filter') as HTMLSelectElement;
  on(tagFilter, 'change', () => {
    currentFilter.tag = tagFilter.value || undefined;
    loadContacts(panel, props);
  });

  // Favorites filter
  const favoritesChip = panel.querySelector('#filter-favorites');
  if (favoritesChip) {
    on(favoritesChip as HTMLElement, 'click', () => {
      favoritesChip.classList.toggle('active');
      currentFilter.favorites = favoritesChip.classList.contains('active');
      loadContacts(panel, props);
    });
  }

  // Add contact
  const addBtn = panel.querySelector('#add-contact-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showContactModal({
        mode: 'create',
        onSave: () => loadContacts(panel, props),
      });
    });
  }

  // Export
  const exportBtn = panel.querySelector('#export-contacts-btn');
  if (exportBtn) {
    on(exportBtn as HTMLElement, 'click', () => exportContacts());
  }

  // Import
  const importBtn = panel.querySelector('#import-contacts-btn');
  if (importBtn) {
    on(importBtn as HTMLElement, 'click', () => {
      toast.info('Import functionality coming soon');
    });
  }
}

/**
 * Load contacts
 */
async function loadContacts(panel: HTMLElement, props?: ContactsPanelProps): Promise<void> {
  const content = panel.querySelector('#contacts-content') as HTMLElement;
  content.innerHTML = '<div class="contacts-loading">Loading contacts</div>';

  try {
    const { contacts, total } = await contactsService.getAll({
      search: currentSearch || undefined,
      organization: currentFilter.organization,
      tag: currentFilter.tag,
    });

    // Filter favorites if needed
    let filteredContacts = contacts;
    if (currentFilter.favorites) {
      filteredContacts = contacts.filter(c => c.isFavorite);
    }

    allContacts = contacts;

    renderContacts(content, filteredContacts, props);
    renderFavorites(panel, contacts.filter(c => c.isFavorite), props);
    updateCount(panel, total);
    updateFilters(panel, contacts);
  } catch {
    content.innerHTML = `
      <div class="contacts-empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <h3>Failed to load contacts</h3>
        <p>Please try again later</p>
      </div>
    `;
  }
}

/**
 * Render contacts grid
 */
function renderContacts(container: HTMLElement, contacts: Contact[], props?: ContactsPanelProps): void {
  if (contacts.length === 0) {
    container.innerHTML = `
      <div class="contacts-empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <h3>${currentSearch ? 'No contacts match your search' : 'No contacts yet'}</h3>
        <p>${currentSearch ? 'Try a different search term' : 'Add your first contact to get started'}</p>
        <button class="btn-sota primary" id="empty-add-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Contact
        </button>
      </div>
    `;
    
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showContactModal({ mode: 'create' });
      });
    }
    return;
  }

  container.innerHTML = `
    <div class="contacts-grid">
      ${contacts.map(contact => createContactCard(contact)).join('')}
    </div>
  `;

  bindContactCardEvents(container, contacts, props);
}

/**
 * Create contact card HTML
 */
function createContactCard(contact: Contact): string {
  const initials = getInitials(contact.name);
  const hasPhoto = !!(contact.photoUrl || contact.avatarUrl);
  const photoUrl = contact.photoUrl || contact.avatarUrl;
  const isSelected = selectedContactIds.has(contact.id);

  return `
    <div class="contact-card-sota ${isSelected ? 'selected' : ''}" data-id="${contact.id}">
      <div class="contact-select-checkbox ${isSelected ? 'checked' : ''}" data-action="select" data-id="${contact.id}">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div class="contact-quick-actions">
        <button class="quick-action-btn favorite ${contact.isFavorite ? 'active' : ''}" data-action="favorite" data-id="${contact.id}" title="Toggle favorite">
          <svg fill="${contact.isFavorite ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>
        <button class="quick-action-btn" data-action="edit" data-id="${contact.id}" title="Edit contact">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>

      <div class="contact-card-header">
        <div class="contact-avatar-sota">
          ${hasPhoto 
            ? `<img src="${photoUrl}" alt="${escapeHtml(contact.name)}">`
            : initials
          }
        </div>
        <div class="contact-main-info">
          <h3 class="contact-name-sota">${escapeHtml(contact.name)}</h3>
          ${contact.role ? `<span class="contact-role-badge">${escapeHtml(contact.role)}</span>` : ''}
          ${contact.organization ? `
            <div class="contact-org-sota">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              ${escapeHtml(contact.organization)}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="contact-details-sota">
        ${contact.email ? `
          <div class="contact-detail-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span>${escapeHtml(contact.email)}</span>
          </div>
        ` : ''}
        ${contact.phone ? `
          <div class="contact-detail-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            <span>${escapeHtml(contact.phone)}</span>
          </div>
        ` : ''}
      </div>

      ${contact.tags && contact.tags.length > 0 ? `
        <div class="contact-tags-sota">
          ${contact.tags.slice(0, 4).map(tag => `<span class="contact-tag">${escapeHtml(tag)}</span>`).join('')}
          ${contact.tags.length > 4 ? `<span class="contact-tag">+${contact.tags.length - 4}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Bind contact card events
 */
function bindContactCardEvents(container: HTMLElement, contacts: Contact[], props?: ContactsPanelProps): void {
  const panel = container.closest('.contacts-panel-sota') as HTMLElement;

  // Selection checkbox click
  container.querySelectorAll('.contact-select-checkbox').forEach(checkbox => {
    on(checkbox as HTMLElement, 'click', (e) => {
      e.stopPropagation();
      const id = checkbox.getAttribute('data-id');
      if (!id) return;

      const card = checkbox.closest('.contact-card-sota') as HTMLElement;
      
      if (selectedContactIds.has(id)) {
        selectedContactIds.delete(id);
        checkbox.classList.remove('checked');
        card.classList.remove('selected');
      } else {
        selectedContactIds.add(id);
        checkbox.classList.add('checked');
        card.classList.add('selected');
      }

      if (props) updateSelectionBar(panel, contacts, props);
    });
  });

  // Card click (open modal)
  container.querySelectorAll('.contact-card-sota').forEach(card => {
    on(card as HTMLElement, 'click', (e) => {
      // Ignore if clicking quick action buttons or checkbox
      if ((e.target as HTMLElement).closest('.quick-action-btn')) return;
      if ((e.target as HTMLElement).closest('.contact-select-checkbox')) return;

      const id = card.getAttribute('data-id');
      const contact = contacts.find(c => String(c.id) === id);
      if (contact) {
        if (props?.onContactClick) {
          props.onContactClick(contact);
        } else {
          showContactModal({
            mode: 'edit',
            contact,
            onSave: () => loadContacts(panel, props),
          });
        }
      }
    });
  });

  // Quick action buttons
  container.querySelectorAll('.quick-action-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const contact = contacts.find(c => String(c.id) === id);

      if (!contact) return;

      if (action === 'favorite') {
        if (props) await toggleFavorite(contact, btn as HTMLElement, panel, props);
      } else if (action === 'edit') {
        showContactModal({
          mode: 'edit',
          contact,
          onSave: () => loadContacts(panel, props),
        });
      }
    });
  });
}

/**
 * Update selection bar visibility and content
 */
function updateSelectionBar(panel: HTMLElement, contacts: Contact[], props: ContactsPanelProps): void {
  // Remove existing selection bar
  const existingBar = document.querySelector('.selection-bar');
  if (existingBar) existingBar.remove();

  if (selectedContactIds.size < 2) return;

  // Create selection bar
  const bar = createElement('div', { className: 'selection-bar' });
  bar.innerHTML = `
    <span class="selection-bar-count"><span>${selectedContactIds.size}</span> contacts selected</span>
    <button class="selection-bar-btn merge" id="merge-selected-btn">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
      </svg>
      Merge Selected
    </button>
    <button class="selection-bar-btn cancel" id="cancel-selection-btn">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      Cancel
    </button>
  `;

  document.body.appendChild(bar);

  // Bind events
  const mergeBtn = bar.querySelector('#merge-selected-btn');
  const cancelBtn = bar.querySelector('#cancel-selection-btn');

  on(cancelBtn as HTMLElement, 'click', () => {
    clearSelection(panel);
  });

  on(mergeBtn as HTMLElement, 'click', async () => {
    const ids = Array.from(selectedContactIds);
    
    // Get selected contacts for confirmation
    const selectedContacts = contacts.filter(c => selectedContactIds.has(c.id));

    const confirmed = await showMergeConfirmModal(selectedContacts);
    if (!confirmed) {
      return;
    }

    (mergeBtn as HTMLButtonElement).disabled = true;
    (mergeBtn as HTMLButtonElement).textContent = 'Merging...';

    try {
      await contactsService.mergeContacts(ids);
      toast.success(`Merged ${ids.length} contacts successfully`);
      clearSelection(panel);
      await loadContacts(panel, props);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to merge contacts';
      toast.error(message);
      (mergeBtn as HTMLButtonElement).disabled = false;
      (mergeBtn as HTMLButtonElement).innerHTML = `
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>
        Merge Selected
      `;
    }
  });
}

/**
 * Show styled merge confirmation modal
 */
function showMergeConfirmModal(contacts: Contact[]): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = createElement('div', { className: 'merge-confirm-overlay' });
    
    const primaryContact = contacts[0];
    const otherContacts = contacts.slice(1);
    
    overlay.innerHTML = `
      <style>
        .merge-confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
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
        
        .merge-confirm-modal {
          background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          max-width: 480px;
          width: 90%;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .merge-confirm-header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .merge-confirm-header svg {
          width: 24px;
          height: 24px;
        }
        
        .merge-confirm-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .merge-confirm-body {
          padding: 24px;
        }
        
        .merge-confirm-body p {
          margin: 0 0 16px 0;
          color: #64748b;
          font-size: 14px;
        }
        
        .merge-contact-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .merge-contact-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        
        .merge-contact-item.primary {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #f59e0b;
        }
        
        .merge-contact-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 14px;
          flex-shrink: 0;
        }
        
        .merge-contact-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .merge-contact-info {
          flex: 1;
          min-width: 0;
        }
        
        .merge-contact-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
          margin-bottom: 2px;
        }
        
        .merge-contact-details {
          font-size: 12px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .merge-contact-badge {
          background: #f59e0b;
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        
        .merge-warning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: #fef3c7;
          border-radius: 10px;
          margin-top: 16px;
        }
        
        .merge-warning svg {
          width: 18px;
          height: 18px;
          color: #d97706;
          flex-shrink: 0;
          margin-top: 1px;
        }
        
        .merge-warning p {
          margin: 0;
          color: #92400e;
          font-size: 13px;
          line-height: 1.5;
        }
        
        .merge-confirm-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px;
          justify-content: flex-end;
        }
        
        .merge-confirm-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .merge-confirm-btn.cancel {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #64748b;
        }
        
        .merge-confirm-btn.cancel:hover {
          background: #e2e8f0;
        }
        
        .merge-confirm-btn.confirm {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: none;
          color: white;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
        }
        
        .merge-confirm-btn.confirm:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
        }
        
        .merge-confirm-btn svg {
          width: 16px;
          height: 16px;
        }
      </style>
      
      <div class="merge-confirm-modal">
        <div class="merge-confirm-header">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
          </svg>
          <h3>Merge Contacts</h3>
        </div>
        
        <div class="merge-confirm-body">
          <p>The following contacts will be merged into one:</p>
          
          <div class="merge-contact-list">
            ${contacts.map((c, i) => {
              const avatar = c.photoUrl || c.avatarUrl || c.photo_url || c.avatar_url;
              const initials = (c.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              const detail = c.email || c.organization || c.company || '';
              
              return `
                <div class="merge-contact-item ${i === 0 ? 'primary' : ''}">
                  <div class="merge-contact-avatar">
                    ${avatar ? `<img src="${avatar}" alt="${c.name}">` : initials}
                  </div>
                  <div class="merge-contact-info">
                    <div class="merge-contact-name">${c.name || 'Unknown'}</div>
                    <div class="merge-contact-details">${detail}</div>
                  </div>
                  ${i === 0 ? '<span class="merge-contact-badge">Primary</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          
          <div class="merge-warning">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>All information will be combined into the primary contact. Other contacts will be archived. This action cannot be undone.</p>
          </div>
        </div>
        
        <div class="merge-confirm-footer">
          <button class="merge-confirm-btn cancel" id="merge-cancel-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Cancel
          </button>
          <button class="merge-confirm-btn confirm" id="merge-confirm-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Merge Contacts
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const cancelBtn = overlay.querySelector('#merge-cancel-btn');
    const confirmBtn = overlay.querySelector('#merge-confirm-btn');
    
    const close = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };
    
    on(cancelBtn as HTMLElement, 'click', () => close(false));
    on(confirmBtn as HTMLElement, 'click', () => close(true));
    on(overlay, 'click', (e) => {
      if (e.target === overlay) close(false);
    });
    
    // ESC to close
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleEsc);
        close(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Clear selection
 */
function clearSelection(panel: HTMLElement): void {
  selectedContactIds.clear();
  
  // Remove selected class from cards
  panel.querySelectorAll('.contact-card-sota.selected').forEach(card => {
    card.classList.remove('selected');
  });
  panel.querySelectorAll('.contact-select-checkbox.checked').forEach(checkbox => {
    checkbox.classList.remove('checked');
  });

  // Remove selection bar
  const bar = document.querySelector('.selection-bar');
  if (bar) bar.remove();
}

/**
 * Toggle favorite
 */
async function toggleFavorite(contact: Contact, btn: HTMLElement, panel: HTMLElement, props: ContactsPanelProps): Promise<void> {
  const newValue = !contact.isFavorite;
  
  try {
    await http.put(`/api/contacts/${contact.id}`, { is_favorite: newValue });
    contact.isFavorite = newValue;
    
    // Update button visually
    btn.classList.toggle('active', newValue);
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', newValue ? 'currentColor' : 'none');
    }

    // Refresh favorites section
    renderFavorites(panel, allContacts.filter(c => c.isFavorite || (c.id === contact.id && newValue)), props);
    
    toast.success(newValue ? 'Added to favorites' : 'Removed from favorites');
  } catch {
    toast.error('Failed to update favorite');
  }
}

/**
 * Render favorites section
 */
function renderFavorites(panel: HTMLElement, favorites: Contact[], props?: ContactsPanelProps): void {
  const section = panel.querySelector('#favorites-section') as HTMLElement;
  const grid = panel.querySelector('#favorites-grid') as HTMLElement;

  if (favorites.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  grid.innerHTML = favorites.map(contact => {
    const initials = getInitials(contact.name);
    const hasPhoto = !!(contact.photoUrl || contact.avatarUrl);
    const photoUrl = contact.photoUrl || contact.avatarUrl;

    return `
      <div class="favorite-card" data-id="${contact.id}">
        <div class="favorite-avatar">
          ${hasPhoto 
            ? `<img src="${photoUrl}" alt="${escapeHtml(contact.name)}">`
            : initials
          }
        </div>
        <div class="favorite-info">
          <h4>${escapeHtml(contact.name)}</h4>
          ${contact.organization ? `<p>${escapeHtml(contact.organization)}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Bind click events
  grid.querySelectorAll('.favorite-card').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const contact = favorites.find(c => String(c.id) === id);
      if (contact) {
        showContactModal({
          mode: 'edit',
          contact,
          onSave: () => loadContacts(panel, props),
        });
      }
    });
  });
}

/**
 * Check for duplicates
 */
async function checkDuplicates(panel: HTMLElement): Promise<void> {
  const alertsContainer = panel.querySelector('#contacts-alerts') as HTMLElement;

  try {
    const { duplicates } = await contactsService.getDuplicates();
    
    if (duplicates.length > 0) {
      alertsContainer.innerHTML = `
        <div class="alert-sota">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span><strong>${duplicates.length}</strong> potential duplicate contacts found</span>
          <button class="btn-sota secondary" id="review-duplicates-btn">Review Duplicates</button>
        </div>
      `;

      const reviewBtn = alertsContainer.querySelector('#review-duplicates-btn');
      if (reviewBtn) {
        on(reviewBtn as HTMLElement, 'click', () => {
          showDuplicatesReviewModal(duplicates, panel);
        });
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Show duplicates review modal
 */
function showDuplicatesReviewModal(duplicateGroups: Contact[][], panel: HTMLElement): void {
  // Create overlay
  const overlay = createElement('div', { className: 'duplicates-review-overlay' });
  
  overlay.innerHTML = `
    <style>
      .duplicates-review-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
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
      
      .duplicates-modal {
        background: var(--bg-primary);
        border-radius: 16px;
        width: 700px;
        max-width: 95vw;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.2s ease;
      }
      
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .duplicates-header {
        padding: 24px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .duplicates-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .duplicates-header h2 svg {
        width: 24px;
        height: 24px;
        color: #f59e0b;
      }
      
      .duplicates-header .close-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .duplicates-header .close-btn:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
      }
      
      .duplicates-header .close-btn svg {
        width: 18px;
        height: 18px;
        color: var(--text-secondary);
      }
      
      .duplicates-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      
      .duplicate-group {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      
      .duplicate-group:last-child {
        margin-bottom: 0;
      }
      
      .duplicate-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
      }
      
      .duplicate-group-header h4 {
        margin: 0;
        font-size: 14px;
        color: var(--text-secondary);
      }
      
      .merge-group-btn {
        padding: 8px 16px;
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      
      .merge-group-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }
      
      .merge-group-btn svg {
        width: 16px;
        height: 16px;
      }
      
      .duplicate-contacts {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .duplicate-contact-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--bg-primary);
        border-radius: 8px;
        border: 1px solid var(--border-color);
      }
      
      .duplicate-contact-row input[type="radio"] {
        width: 18px;
        height: 18px;
        accent-color: #e11d48;
      }
      
      .duplicate-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48, #be123c);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
      }
      
      .duplicate-info {
        flex: 1;
        min-width: 0;
      }
      
      .duplicate-info h5 {
        margin: 0 0 2px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .duplicate-info p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      .duplicate-aliases {
        margin-top: 4px;
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      
      .alias-tag {
        padding: 2px 6px;
        background: rgba(99,102,241,0.1);
        color: #6366f1;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
      }
      
      .duplicates-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .duplicates-footer button {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .duplicates-footer .close-review-btn {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
      }
      
      .duplicates-footer .close-review-btn:hover {
        background: var(--bg-tertiary);
      }
      
      .no-duplicates-msg {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
      }
      
      .no-duplicates-msg svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
        margin-bottom: 12px;
      }
    </style>
    
    <div class="duplicates-modal">
      <div class="duplicates-header">
        <h2>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Review Duplicate Contacts
        </h2>
        <button class="close-btn" id="close-duplicates-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="duplicates-content" id="duplicates-content">
        ${duplicateGroups.length === 0 ? `
          <div class="no-duplicates-msg">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>No duplicate contacts found</p>
          </div>
        ` : duplicateGroups.map((group, groupIndex) => `
          <div class="duplicate-group" data-group-index="${groupIndex}">
            <div class="duplicate-group-header">
              <h4>Potential duplicates (${group.length} contacts)</h4>
              <button class="merge-group-btn" data-group-index="${groupIndex}">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
                Merge All
              </button>
            </div>
            <div class="duplicate-contacts">
              ${group.map((contact, idx) => `
                <div class="duplicate-contact-row">
                  <input type="radio" name="primary-${groupIndex}" value="${contact.id}" ${idx === 0 ? 'checked' : ''}>
                  <div class="duplicate-avatar">${getInitials(contact.name)}</div>
                  <div class="duplicate-info">
                    <h5>${escapeHtml(contact.name)}${idx === 0 ? ' (Primary)' : ''}</h5>
                    <p>${escapeHtml(contact.email || '')}${contact.organization ? ` • ${escapeHtml(contact.organization)}` : ''}</p>
                    ${(contact.aliases && contact.aliases.length > 0) ? `
                      <div class="duplicate-aliases">
                        ${contact.aliases.map(alias => `<span class="alias-tag">${escapeHtml(alias)}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="duplicates-footer">
        <button class="close-review-btn" id="close-review-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const closeOverlay = () => overlay.remove();
  
  const closeBtn = overlay.querySelector('#close-duplicates-btn');
  const closeReviewBtn = overlay.querySelector('#close-review-btn');
  
  if (closeBtn) on(closeBtn as HTMLElement, 'click', closeOverlay);
  if (closeReviewBtn) on(closeReviewBtn as HTMLElement, 'click', closeOverlay);
  on(overlay, 'click', (e: Event) => {
    if (e.target === overlay) closeOverlay();
  });

  // Merge handlers
  overlay.querySelectorAll('.merge-group-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const groupIndex = parseInt(btn.getAttribute('data-group-index') || '0');
      const group = duplicateGroups[groupIndex];
      
      if (!group || group.length < 2) return;

      // Get selected primary contact
      const selectedRadio = overlay.querySelector(`input[name="primary-${groupIndex}"]:checked`) as HTMLInputElement;
      const primaryId = selectedRadio?.value || group[0].id;
      
      // Reorder so primary is first
      const orderedIds = [primaryId, ...group.filter(c => c.id !== primaryId).map(c => c.id)];
      
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).textContent = 'Merging...';
      
      try {
        await contactsService.mergeContacts(orderedIds);
        toast.success(`Merged ${group.length} contacts successfully`);
        
        // Remove this group from the UI
        const groupEl = overlay.querySelector(`.duplicate-group[data-group-index="${groupIndex}"]`);
        if (groupEl) groupEl.remove();
        
        // Check if no more groups
        const remainingGroups = overlay.querySelectorAll('.duplicate-group');
        if (remainingGroups.length === 0) {
          const content = overlay.querySelector('#duplicates-content');
          if (content) {
            content.innerHTML = `
              <div class="no-duplicates-msg">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p>All duplicates have been merged!</p>
              </div>
            `;
          }
        }
        
        // Refresh contacts list
        await loadContacts(panel);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to merge contacts';
        toast.error(message);
        (btn as HTMLButtonElement).disabled = false;
        (btn as HTMLButtonElement).innerHTML = `
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
          </svg>
          Merge All
        `;
      }
    });
  });
}

/**
 * Update filters
 */
function updateFilters(panel: HTMLElement, contacts: Contact[]): void {
  // Organizations
  const orgFilter = panel.querySelector('#org-filter') as HTMLSelectElement;
  const orgs = [...new Set(contacts.map(c => c.organization).filter(Boolean))].sort();
  
  const currentOrg = orgFilter.value;
  orgFilter.innerHTML = `
    <option value="">All Organizations</option>
    ${orgs.map(org => `<option value="${escapeHtml(org!)}" ${currentOrg === org ? 'selected' : ''}>${escapeHtml(org!)}</option>`).join('')}
  `;

  // Tags
  const tagFilter = panel.querySelector('#tag-filter') as HTMLSelectElement;
  const allTags = contacts.flatMap(c => c.tags || []);
  const uniqueTags = [...new Set(allTags)].sort();
  
  const currentTag = tagFilter.value;
  tagFilter.innerHTML = `
    <option value="">All Tags</option>
    ${uniqueTags.map(tag => `<option value="${escapeHtml(tag)}" ${currentTag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
  `;
}

/**
 * Export contacts
 */
async function exportContacts(): Promise<void> {
  try {
    await contactsService.export('json');
    toast.success('Contacts exported');
  } catch {
    toast.error('Failed to export contacts');
  }
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#contacts-count');
  if (countEl) countEl.textContent = String(count);
}

/**
 * Get initials
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createContactsPanel;
