/**
 * Risk Detail View
 * Full-page view for risk details: content, impact, likelihood, mitigation, status, owner, source, timeline
 */

import { createElement, on } from '../../utils/dom';
import { Risk, RiskEvent, RiskOwnerSuggestion, risksService } from '../../services/risks';
import { contactsService, Contact } from '../../services/contacts';
import { toast } from '../../services/toast';
import { formatRelativeTime, formatDateTime } from '../../utils/format';

export interface RiskDetailViewProps {
  risk: Risk;
  onClose: () => void;
  onUpdate?: (risk: Risk) => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--success, #4ecdc4)';
  if (score >= 50) return 'var(--warning, #ffe66d)';
  return 'var(--text-muted, #6a6a8a)';
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function getRiskEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    created: '📝',
    updated: '✏️',
    deleted: '🗑️',
    restored: '↩️',
  };
  return icons[eventType] || '•';
}

function getRiskEventDescription(ev: RiskEvent): string {
  const data = ev.event_data || {};
  const actor = ev.actor_name ? ` by ${ev.actor_name}` : '';

  switch (ev.event_type) {
    case 'created':
      return `Created${actor}`;
    case 'updated': {
      const changes = (data.changes as Array<{ field: string; from: string; to: string }>) || [];
      if (changes.length === 0) return `Updated${actor}`;
      if (changes.length === 1) {
        const c = changes[0];
        const toStr = String(c.to).trim() ? c.to : '—';
        const fromStr = String(c.from).trim() ? c.from : '—';
        return `${c.field} changed: ${fromStr} → ${toStr}${actor}`;
      }
      return `${changes.map((c) => `${c.field}: ${c.from || '—'} → ${c.to || '—'}`).join('; ')}${actor}`;
    }
    case 'deleted':
      return `Deleted${data.reason ? ` (${data.reason})` : ''}${actor}`;
    case 'restored':
      return `Restored${actor}`;
    default:
      return ev.event_type;
  }
}

export function createRiskDetailView(props: RiskDetailViewProps): HTMLElement {
  const { risk, onClose, onUpdate } = props;

  const container = createElement('div', { className: 'risk-detail-view question-detail-view' });

  container.innerHTML = `
    <div class="question-detail-header risk-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Risks</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Risk #${String(risk.id).substring(0, 8)}</span>
      </div>
      <div class="header-actions">
        <span class="status-badge status-${(risk.status || 'open').toLowerCase()}">${escapeHtml(String(risk.status))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content risk-detail-content">
      <div id="risk-view-content">
      <section class="detail-section risk-main">
        <div class="question-badges risk-badges">
          ${risk.impact ? `<span class="priority-pill impact-${risk.impact}">${escapeHtml(risk.impact)} impact</span>` : ''}
          ${risk.likelihood ? `<span class="priority-pill likelihood-${risk.likelihood}">${escapeHtml(risk.likelihood)} likelihood</span>` : ''}
          ${risk.generation_source ? `<span class="status-pill">${escapeHtml(risk.generation_source)}</span>` : ''}
          <span class="question-date risk-date">Created ${formatRelativeTime(risk.created_at)}</span>
        </div>
        <h2 class="question-text risk-content-text">${escapeHtml(risk.content)}</h2>
      </section>

      <div class="detail-columns">
        <div class="detail-column-left">
          <!-- Assignment (Owner) Section - SOTA (aligned with Questions) -->
          <section class="detail-section" id="risk-assignment-section">
            <div class="section-header-sota">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Assignment
                <span class="section-subtitle">Who should own this risk?</span>
              </h3>
              <button type="button" class="btn-ai-suggest" id="risk-ai-suggest-btn" title="Suggest owner and mitigation from risk content">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Suggest
              </button>
            </div>

            <!-- Current Assignment (Owner) Display -->
            <div id="risk-current-assignment" class="current-assignment-card">
              ${risk.owner ? `
                <div class="assigned-contact-display">
                  <div class="contact-avatar-lg" id="risk-assigned-avatar">${getInitials(risk.owner)}</div>
                  <div class="contact-details">
                    <div class="contact-name-lg">${escapeHtml(risk.owner)}</div>
                    <div class="contact-role-sm" id="risk-assigned-role">—</div>
                  </div>
                  <button class="btn-change-assignment" id="risk-change-owner-btn" type="button">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    Change
                  </button>
                </div>
              ` : `
                <div class="no-assignment">
                  <div class="no-assignment-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                  </div>
                  <span>No one assigned</span>
                  <p class="no-assignment-hint">Use AI Suggest or choose manually</p>
                  <button class="btn-assign-now" id="risk-show-picker-btn" type="button">Choose Manually</button>
                </div>
              `}
            </div>

            <!-- Contact Picker (hidden by default) -->
            <div id="risk-contact-picker" class="contact-picker-sota" style="display: none;">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="risk-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="risk-contact-list" class="contact-list-grid">Loading...</div>
            </div>

            <!-- AI Suggestions Panel -->
            <div id="risk-suggestions-panel" class="suggestions-panel-sota risk-suggestions-panel" style="display: none;"></div>

            <!-- Mitigation (below assignment) -->
            <div class="risk-mitigation-block">
              <strong>Mitigation</strong>
              <p id="risk-detail-mitigation" class="risk-mitigation">${risk.mitigation ? escapeHtml(risk.mitigation) : '<span class="text-muted">No mitigation recorded</span>'}</p>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-header">
              <h3>Source</h3>
            </div>
            ${risk.source_file ? `<p class="source-file">${escapeHtml(risk.source_file)}</p>` : ''}
            ${risk.source_document_id ? `
              <p class="source-doc">
                <a href="#" class="doc-link" data-document-id="${escapeHtml(String(risk.source_document_id))}">View source document</a>
              </p>
            ` : ''}
            ${!risk.source_file && !risk.source_document_id ? '<p class="text-muted">No source recorded</p>' : ''}
          </section>
        </div>

        <div class="detail-column-right">
          <section class="detail-section metadata-section">
            <h3>Metadata</h3>
            <dl class="metadata-list">
              <dt>Created</dt>
              <dd>${formatDate(risk.created_at)}</dd>
              ${risk.updated_at ? `<dt>Updated</dt><dd>${formatDate(risk.updated_at)}</dd>` : ''}
            </dl>
          </section>

          <section class="detail-section" id="risk-timeline-section">
            <h3>Timeline</h3>
            <div id="timeline-content" class="timeline-content">
              <span class="text-muted">Loading…</span>
            </div>
          </section>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-secondary" id="edit-risk-btn">Edit</button>
        <button type="button" class="btn btn-danger" id="delete-risk-btn">Delete</button>
      </div>
      </div>

      <div id="risk-edit-form" class="risk-detail-edit-form" style="display: none;">
        <form id="risk-inline-form" class="risk-form">
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
              <label for="risk-edit-content" style="margin-bottom: 0;">Risk description *</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="risk-edit-ai-suggest-btn" title="Suggest owner and mitigation from description">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="risk-edit-content" rows="3" required placeholder="Describe the risk...">${escapeHtml(risk.content || '')}</textarea>
          </div>
          <div id="risk-edit-suggestions-panel" class="suggestions-panel-sota risk-suggestions-panel" style="display: none; margin-bottom: 16px;"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="risk-edit-impact">Impact</label>
              <select id="risk-edit-impact">
                <option value="low" ${risk.impact === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${risk.impact === 'medium' || !risk.impact ? 'selected' : ''}>Medium</option>
                <option value="high" ${risk.impact === 'high' ? 'selected' : ''}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="risk-edit-likelihood">Likelihood</label>
              <select id="risk-edit-likelihood">
                <option value="low" ${risk.likelihood === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${risk.likelihood === 'medium' || !risk.likelihood ? 'selected' : ''}>Medium</option>
                <option value="high" ${risk.likelihood === 'high' ? 'selected' : ''}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="risk-edit-status">Status</label>
              <select id="risk-edit-status">
                <option value="open" ${risk.status === 'open' || !risk.status ? 'selected' : ''}>Open</option>
                <option value="mitigating" ${risk.status === 'mitigating' ? 'selected' : ''}>Mitigating</option>
                <option value="mitigated" ${risk.status === 'mitigated' ? 'selected' : ''}>Mitigated</option>
                <option value="accepted" ${risk.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                <option value="closed" ${risk.status === 'closed' ? 'selected' : ''}>Closed</option>
              </select>
            </div>
          </div>
          <div class="form-group risk-owner-picker-wrap">
            <label>Owner</label>
            <input type="hidden" id="risk-edit-owner" value="${escapeHtml(risk.owner || '')}">
            <div class="risk-owner-picker-trigger" id="risk-owner-picker-trigger" title="Click to select from project contacts">
              <span class="risk-owner-picker-value" id="risk-owner-picker-value">${risk.owner ? escapeHtml(risk.owner) : '<span class="text-muted">Select owner...</span>'}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div id="risk-owner-picker-dropdown" class="risk-owner-picker-dropdown" style="display: none;">
              <div class="risk-owner-picker-search">
                <input type="text" id="risk-owner-picker-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="risk-owner-picker-list" class="risk-owner-picker-list">Loading...</div>
            </div>
          </div>
          <div class="form-group">
            <label for="risk-edit-mitigation">Mitigation strategy</label>
            <textarea id="risk-edit-mitigation" rows="3" placeholder="How will this risk be mitigated?">${escapeHtml(risk.mitigation || '')}</textarea>
          </div>
        </form>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="risk-save-btn">Save</button>
          <button type="button" class="btn btn-secondary" id="risk-cancel-edit-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="risk-delete-in-edit-btn">Delete</button>
        </div>
      </div>
    </div>
  `;

  const backLink = container.querySelector('#back-to-list');
  if (backLink) {
    on(backLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      onClose();
    });
  }
  const closeBtn = container.querySelector('#close-detail');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', onClose);
  }

  const viewContent = container.querySelector('#risk-view-content') as HTMLElement;
  const editForm = container.querySelector('#risk-edit-form') as HTMLElement;

  const editBtn = container.querySelector('#edit-risk-btn');
  if (editBtn && viewContent && editForm) {
    on(editBtn as HTMLElement, 'click', () => {
      viewContent.style.display = 'none';
      editForm.style.display = 'block';
    });
  }

  const cancelEditBtn = container.querySelector('#risk-cancel-edit-btn');
  if (cancelEditBtn && viewContent && editForm) {
    on(cancelEditBtn as HTMLElement, 'click', () => {
      editForm.style.display = 'none';
      viewContent.style.display = '';
    });
  }

  const saveBtn = container.querySelector('#risk-save-btn');
  if (saveBtn && editForm && onUpdate) {
    on(saveBtn as HTMLElement, 'click', async () => {
      const form = container.querySelector('#risk-inline-form') as HTMLFormElement;
      if (!form?.checkValidity()) {
        form.reportValidity();
        return;
      }
      const contentEl = container.querySelector('#risk-edit-content') as HTMLTextAreaElement;
      const impactEl = container.querySelector('#risk-edit-impact') as HTMLSelectElement;
      const likelihoodEl = container.querySelector('#risk-edit-likelihood') as HTMLSelectElement;
      const statusEl = container.querySelector('#risk-edit-status') as HTMLSelectElement;
      const ownerEl = container.querySelector('#risk-edit-owner') as HTMLInputElement;
      const mitigationEl = container.querySelector('#risk-edit-mitigation') as HTMLTextAreaElement;
      const content = contentEl?.value?.trim() || '';
      if (!content) {
        toast.error('Risk description is required');
        return;
      }
      (saveBtn as HTMLButtonElement).disabled = true;
      (saveBtn as HTMLButtonElement).textContent = 'Saving...';
      try {
        const updated = await risksService.update(risk.id, {
          content,
          impact: (impactEl?.value || 'medium') as Risk['impact'],
          likelihood: (likelihoodEl?.value || 'medium') as Risk['likelihood'],
          status: (statusEl?.value || 'open') as Risk['status'],
          owner: ownerEl?.value?.trim() || undefined,
          mitigation: mitigationEl?.value?.trim() || undefined,
        });
        toast.success('Risk updated');
        onUpdate(updated);
      } catch {
        toast.error('Failed to save');
      } finally {
        (saveBtn as HTMLButtonElement).disabled = false;
        (saveBtn as HTMLButtonElement).textContent = 'Save';
      }
    });
  }

  const deleteInEditBtn = container.querySelector('#risk-delete-in-edit-btn');
  if (deleteInEditBtn) {
    on(deleteInEditBtn as HTMLElement, 'click', async () => {
      if (!confirm('Are you sure you want to delete this risk?')) return;
      try {
        await risksService.delete(risk.id);
        toast.success('Risk deleted');
        onClose();
      } catch {
        toast.error('Failed to delete');
      }
    });
  }

  // Owner contact picker in edit form (project contacts with cards)
  const ownerPickerTrigger = container.querySelector('#risk-owner-picker-trigger');
  const ownerPickerDropdown = container.querySelector('#risk-owner-picker-dropdown') as HTMLElement;
  const ownerPickerValue = container.querySelector('#risk-owner-picker-value');
  const ownerHiddenInput = container.querySelector('#risk-edit-owner') as HTMLInputElement;
  const ownerPickerList = container.querySelector('#risk-owner-picker-list') as HTMLElement;
  const ownerPickerSearch = container.querySelector('#risk-owner-picker-search') as HTMLInputElement;

  if (ownerPickerTrigger && ownerPickerDropdown && ownerPickerList && ownerHiddenInput) {
    let editFormContacts: Contact[] = [];
    const renderOwnerPickerList = (filter = '') => {
      const filtered = filter
        ? editFormContacts.filter(
            (c) =>
              (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
              (c.role || '').toLowerCase().includes(filter.toLowerCase())
          )
        : editFormContacts;
      if (editFormContacts.length === 0) {
        ownerPickerList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
        return;
      }
      if (filtered.length === 0) {
        ownerPickerList.innerHTML = '<div class="empty-state">No contacts match</div>';
        return;
      }
      ownerPickerList.innerHTML = filtered
        .map((c) => {
          const photoUrl = c.photoUrl || c.avatarUrl;
          const selected = (ownerHiddenInput?.value || '').trim() === (c.name || '').trim();
          return `
            <div class="risk-owner-card-picker ${selected ? 'selected' : ''}" data-contact-name="${escapeHtml(c.name || '')}">
              <div class="risk-owner-card-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(c.name || '')}'">` : getInitials(c.name || '')}</div>
              <div class="risk-owner-card-info">
                <div class="risk-owner-card-name">${escapeHtml(c.name || '')}</div>
                ${c.role ? `<div class="risk-owner-card-role">${escapeHtml(c.role)}</div>` : ''}
              </div>
            </div>
          `;
        })
        .join('');
      ownerPickerList.querySelectorAll('.risk-owner-card-picker').forEach((card) => {
        on(card as HTMLElement, 'click', () => {
          const name = card.getAttribute('data-contact-name') || '';
          ownerHiddenInput.value = name;
          if (ownerPickerValue) ownerPickerValue.innerHTML = name ? escapeHtml(name) : '<span class="text-muted">Select owner...</span>';
          ownerPickerDropdown.style.display = 'none';
        });
      });
    };
    on(ownerPickerTrigger as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const isOpen = ownerPickerDropdown.style.display === 'block';
      ownerPickerDropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen && editFormContacts.length === 0) {
        ownerPickerList.innerHTML = '<div class="empty-state">Loading...</div>';
        try {
          const res = await contactsService.getAll();
          editFormContacts = res?.contacts || [];
          renderOwnerPickerList(ownerPickerSearch?.value || '');
        } catch {
          ownerPickerList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
        }
      } else if (!isOpen) renderOwnerPickerList(ownerPickerSearch?.value || '');
    });
    if (ownerPickerSearch) {
      ownerPickerSearch.addEventListener('input', () => renderOwnerPickerList(ownerPickerSearch.value));
    }
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.risk-owner-picker-wrap') && ownerPickerDropdown?.style.display === 'block') {
        ownerPickerDropdown.style.display = 'none';
      }
    });
  }

  // AI suggest in edit form (fill owner + mitigation)
  const editAiSuggestBtn = container.querySelector('#risk-edit-ai-suggest-btn');
  const editSuggestionsPanel = container.querySelector('#risk-edit-suggestions-panel') as HTMLElement;
  if (editAiSuggestBtn && editSuggestionsPanel) {
    on(editAiSuggestBtn as HTMLElement, 'click', async () => {
      const contentEl = container.querySelector('#risk-edit-content') as HTMLTextAreaElement;
      const content = contentEl?.value?.trim() || '';
      if (!content) {
        toast.error('Enter a risk description first');
        return;
      }
      const btn = editAiSuggestBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = '<span class="spin">⋯</span> Analyzing...';
      editSuggestionsPanel.style.display = 'block';
      editSuggestionsPanel.innerHTML = '<div class="suggestions-loading"><div class="loading-text">AI is suggesting owners and mitigation...</div></div>';
      try {
        const [result, contactsRes] = await Promise.all([
          risksService.suggest({ content, impact: (container.querySelector('#risk-edit-impact') as HTMLSelectElement)?.value || 'medium', likelihood: (container.querySelector('#risk-edit-likelihood') as HTMLSelectElement)?.value || 'medium' }),
          contactsService.getAll(),
        ]);
        const contacts: Contact[] = contactsRes?.contacts || [];
        const owners: RiskOwnerSuggestion[] = result.suggested_owners?.length ? result.suggested_owners : result.suggested_owner ? [{ name: result.suggested_owner, reason: '', score: 0 }] : [];
        const mitigation = result.suggested_mitigation || '';
        if (owners.length === 0 && !mitigation) {
          editSuggestionsPanel.innerHTML = '<div class="no-suggestions"><div class="no-suggestions-text">No suggestions</div><button type="button" class="btn-link" id="risk-edit-hide-suggest-btn">Close</button></div>';
        } else {
          editSuggestionsPanel.innerHTML = `
            <div class="suggestions-header-sota"><div class="ai-badge">✨ AI Recommended</div></div>
            ${owners.length > 0 ? `<div class="suggestions-list-sota">${owners.map((s, i) => {
              const contact = contacts.find((c) => (c.name || '').trim().toLowerCase() === (s.name || '').trim().toLowerCase());
              const photoUrl = contact?.photoUrl || contact?.avatarUrl || (contact as { photo_url?: string })?.photo_url || (contact as { avatar_url?: string })?.avatar_url;
              const roleOrReason = contact?.role ?? s.reason ?? '';
              const score = s.score ?? 0;
              const scoreColor = getScoreColor(score);
              return `<div class="suggestion-card-sota risk-owner-card" data-owner-name="${escapeHtml(s.name || '')}">
                <div class="suggestion-rank">#${i + 1}</div>
                <div class="suggestion-avatar-sota">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(s.name)}'">` : getInitials(s.name)}</div>
                <div class="suggestion-info-sota"><div class="suggestion-name-sota">${escapeHtml(s.name || '')}</div>${roleOrReason ? `<div class="suggestion-reason-sota">${escapeHtml(roleOrReason)}</div>` : ''}</div>
                ${score > 0 ? `<div class="suggestion-score-sota" style="--score-color: ${scoreColor}"><div class="score-value">${score}%</div></div>` : ''}
                <button type="button" class="btn-select-suggestion">Assign</button>
              </div>`;
            }).join('')}</div>` : ''}
            ${mitigation ? `<div class="risk-suggestion-card risk-mitigation-suggestion"><strong>Suggested mitigation</strong><p class="risk-suggestion-mitigation">${escapeHtml(mitigation)}</p><button type="button" class="btn btn-secondary btn-sm" id="risk-edit-apply-mitigation-btn">Apply mitigation</button></div>` : ''}
            <div class="suggestions-footer"><button type="button" class="btn-link" id="risk-edit-hide-suggest-btn">Close suggestions</button></div>
          `;
          editSuggestionsPanel.querySelectorAll('.risk-owner-card .btn-select-suggestion').forEach((assignBtn) => {
            const card = (assignBtn as HTMLElement).closest('.risk-owner-card');
            const name = card?.getAttribute('data-owner-name') || '';
            if (!name) return;
            on(assignBtn as HTMLElement, 'click', () => {
              if (ownerHiddenInput) ownerHiddenInput.value = name;
              if (ownerPickerValue) ownerPickerValue.innerHTML = escapeHtml(name);
              editSuggestionsPanel.style.display = 'none';
              toast.success(`Owner set to ${name}`);
            });
          });
          const applyMitigationBtn = editSuggestionsPanel.querySelector('#risk-edit-apply-mitigation-btn');
          if (applyMitigationBtn && mitigation) {
            on(applyMitigationBtn as HTMLElement, 'click', () => {
              const mitigationEl = container.querySelector('#risk-edit-mitigation') as HTMLTextAreaElement;
              if (mitigationEl) mitigationEl.value = mitigation;
              toast.success('Mitigation applied');
            });
          }
        }
        const hideBtn = editSuggestionsPanel.querySelector('#risk-edit-hide-suggest-btn');
        if (hideBtn) on(hideBtn as HTMLElement, 'click', () => { editSuggestionsPanel.style.display = 'none'; });
      } catch {
        editSuggestionsPanel.innerHTML = '<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="risk-edit-hide-suggest-btn">Close</button></div>';
        const h = editSuggestionsPanel.querySelector('#risk-edit-hide-suggest-btn');
        if (h) on(h as HTMLElement, 'click', () => { editSuggestionsPanel.style.display = 'none'; });
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> AI suggest';
      }
    });
  }

  const deleteBtn = container.querySelector('#delete-risk-btn');
  if (deleteBtn) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      if (!confirm('Are you sure you want to delete this risk?')) return;
      try {
        await risksService.delete(risk.id);
        toast.success('Risk deleted');
        onClose();
      } catch {
        toast.error('Failed to delete risk');
      }
    });
  }

  // AI suggest owner & mitigation (same UX as Question Assignment: list of owner cards with Assign each)
  let lastMitigation = '';
  const aiSuggestBtn = container.querySelector('#risk-ai-suggest-btn');
  const suggestionsPanel = container.querySelector('#risk-suggestions-panel') as HTMLElement;
  if (aiSuggestBtn && suggestionsPanel) {
    on(aiSuggestBtn as HTMLElement, 'click', async () => {
      const btn = aiSuggestBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="spin" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Analyzing...
      `;
      suggestionsPanel.style.display = 'block';
      suggestionsPanel.innerHTML = `
        <div class="suggestions-loading">
          <div class="ai-thinking-animation"><span></span><span></span><span></span></div>
          <div class="loading-text">AI is suggesting owners and mitigation...</div>
        </div>
      `;
      try {
        const [result, contactsRes] = await Promise.all([
          risksService.suggest({
            content: risk.content || '',
            impact: risk.impact || 'medium',
            likelihood: risk.likelihood || 'medium',
          }),
          contactsService.getAll(),
        ]);
        const contacts: Contact[] = contactsRes?.contacts || [];
        lastMitigation = result.suggested_mitigation || '';
        const owners: RiskOwnerSuggestion[] = result.suggested_owners?.length ? result.suggested_owners : (result.suggested_owner ? [{ name: result.suggested_owner, reason: '', score: 0 }] : []);

        if (owners.length === 0 && !lastMitigation) {
          suggestionsPanel.innerHTML = `
            <div class="no-suggestions">
              <div class="no-suggestions-text">No owner or mitigation suggestions</div>
              <button type="button" class="btn-link" id="risk-hide-suggestions-btn">Close</button>
            </div>
          `;
        } else {
          suggestionsPanel.innerHTML = `
            <div class="suggestions-header-sota">
              <div class="ai-badge">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                AI Recommended
              </div>
            </div>
            ${owners.length > 0 ? `
            <div class="suggestions-list-sota">
              ${owners.map((s, i) => {
                const score = s.score ?? 0;
                const scoreColor = getScoreColor(score);
                const contact = contacts.find((c) => (c.name || '').trim().toLowerCase() === (s.name || '').trim().toLowerCase());
                const photoUrl = contact?.photoUrl || contact?.avatarUrl || (contact as { photo_url?: string })?.photo_url || (contact as { avatar_url?: string })?.avatar_url;
                const roleOrReason = contact?.role ?? s.reason ?? '';
                return `
                  <div class="suggestion-card-sota risk-owner-card" data-index="${i}">
                    <div class="suggestion-rank">#${i + 1}</div>
                    <div class="suggestion-avatar-sota">${photoUrl
                      ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(s.name)}" onerror="this.parentElement.innerHTML='${getInitials(s.name)}'">`
                      : getInitials(s.name)}</div>
                    <div class="suggestion-info-sota">
                      <div class="suggestion-name-sota">${escapeHtml(s.name)}</div>
                      ${roleOrReason ? `<div class="suggestion-reason-sota">${escapeHtml(roleOrReason)}</div>` : ''}
                    </div>
                    ${score > 0 ? `
                    <div class="suggestion-score-sota" style="--score-color: ${scoreColor}">
                      <div class="score-ring">
                        <svg viewBox="0 0 36 36">
                          <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                          <path class="score-fill" stroke-dasharray="${score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                        </svg>
                        <div class="score-value">${score}%</div>
                      </div>
                      <div class="score-label">Match</div>
                    </div>
                    ` : ''}
                    <button type="button" class="btn-select-suggestion">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Assign
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
            ` : ''}
            ${lastMitigation ? `
            <div class="risk-suggestion-card risk-mitigation-suggestion">
              <strong>Suggested mitigation</strong>
              <p class="risk-suggestion-mitigation">${escapeHtml(lastMitigation)}</p>
              <button type="button" class="btn btn-secondary btn-sm" id="risk-apply-mitigation-btn">Apply mitigation</button>
            </div>
            ` : ''}
            <div class="suggestions-footer">
              <button type="button" class="btn-link" id="risk-hide-suggestions-btn">Close suggestions</button>
            </div>
          `;

          // Bind Assign per owner card
          suggestionsPanel.querySelectorAll('.risk-owner-card').forEach((item) => {
            const selectBtn = item.querySelector('.btn-select-suggestion');
            if (!selectBtn) return;
            const idx = parseInt(item.getAttribute('data-index') || '0');
            const suggestion = owners[idx];
            if (!suggestion || !onUpdate) return;
            on(selectBtn as HTMLElement, 'click', async (e) => {
              e.stopPropagation();
              try {
                const updated = await risksService.update(risk.id, { owner: suggestion.name });
                suggestionsPanel.style.display = 'none';
                onUpdate(updated);
                toast.success(`Assigned to ${suggestion.name}`);
              } catch {
                toast.error('Failed to save');
              }
            });
          });

          // Bind Apply mitigation
          const applyMitigationBtn = suggestionsPanel.querySelector('#risk-apply-mitigation-btn');
          if (applyMitigationBtn && lastMitigation && onUpdate) {
            on(applyMitigationBtn as HTMLElement, 'click', async () => {
              try {
                const updated = await risksService.update(risk.id, { mitigation: lastMitigation });
                const mitigationEl = container.querySelector('#risk-detail-mitigation');
                if (mitigationEl) mitigationEl.innerHTML = escapeHtml(lastMitigation);
                onUpdate(updated);
                toast.success('Mitigation updated');
              } catch {
                toast.error('Failed to save');
              }
            });
          }
        }

        const hideBtn = suggestionsPanel.querySelector('#risk-hide-suggestions-btn');
        if (hideBtn) {
          on(hideBtn as HTMLElement, 'click', () => {
            suggestionsPanel.style.display = 'none';
          });
        }
      } catch {
        suggestionsPanel.innerHTML = `
          <div class="suggestions-error">
            <div>Failed to get AI suggestions</div>
            <button type="button" class="btn-retry" id="risk-retry-suggest-btn">Try again</button>
          </div>
        `;
        const retryBtn = suggestionsPanel.querySelector('#risk-retry-suggest-btn');
        if (retryBtn) {
          on(retryBtn as HTMLElement, 'click', () => (aiSuggestBtn as HTMLElement).click());
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          AI suggest
        `;
      }
    });
  }

  const docLink = container.querySelector('.doc-link');
  if (docLink && risk.source_document_id) {
    on(docLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('godmode:navigate', {
        detail: { tab: 'files', documentId: risk.source_document_id }
      }));
    });
  }

  const timelineEl = container.querySelector('#timeline-content');
  if (timelineEl) {
    risksService.getEvents(risk.id).then((events: RiskEvent[]) => {
      if (events.length === 0) {
        (timelineEl as HTMLElement).innerHTML = '<p class="empty-state">No events recorded</p>';
        return;
      }
      const html = events.map((ev) => {
        const icon = getRiskEventIcon(ev.event_type);
        const description = getRiskEventDescription(ev);
        return `
          <div class="timeline-item risk-event-${escapeHtml(ev.event_type)}">
            <div class="timeline-icon">${icon}</div>
            <div class="timeline-content">
              <div class="timeline-title">${escapeHtml(description)}</div>
              <div class="timeline-date">${formatDateTime(ev.created_at)}</div>
            </div>
          </div>`;
      }).join('');
      (timelineEl as HTMLElement).innerHTML = `<div class="timeline-list">${html}</div>`;
    }).catch(() => {
      (timelineEl as HTMLElement).innerHTML = '<p class="error">Failed to load timeline</p>';
    });
  }

  // Contact picker in view: show on Change/Choose Manually, on select update owner via API
  let viewContacts: Contact[] = [];
  const owner = risk.owner || '';
  const riskContactPicker = container.querySelector('#risk-contact-picker') as HTMLElement;
  const riskContactList = container.querySelector('#risk-contact-list') as HTMLElement;
  const riskContactSearch = container.querySelector('#risk-contact-search') as HTMLInputElement;

  const renderRiskContactGrid = (filter = '') => {
    if (!riskContactList) return;
    const list = filter
      ? viewContacts.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
            (c.role || '').toLowerCase().includes(filter.toLowerCase()) ||
            ((c as { organization?: string }).organization || '').toLowerCase().includes(filter.toLowerCase())
        )
      : viewContacts;
    if (viewContacts.length === 0) {
      riskContactList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
      return;
    }
    if (list.length === 0) {
      riskContactList.innerHTML = '<div class="empty-state">No contacts match</div>';
      return;
    }
    riskContactList.innerHTML = list
      .map((c) => {
        const photoUrl = getContactPhotoUrl(c);
        const isCurrent = (owner || '').trim() === (c.name || '').trim();
        return `
          <div class="contact-card-picker ${isCurrent ? 'selected' : ''}" data-contact-name="${escapeHtml(c.name || '')}">
            <div class="contact-avatar-picker">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(c.name || '')}'">` : getInitials(c.name || '')}</div>
            <div class="contact-info-picker">
              <div class="contact-name-picker">${escapeHtml(c.name || '')}</div>
              ${c.role ? `<div class="contact-role-picker">${escapeHtml(c.role)}</div>` : ''}
            </div>
          </div>`;
      })
      .join('');
    riskContactList.querySelectorAll('.contact-card-picker').forEach((card) => {
      on(card as HTMLElement, 'click', async () => {
        const name = card.getAttribute('data-contact-name') || '';
        if (!name) return;
        try {
          const updated = await risksService.update(risk.id, { owner: name });
          toast.success(`Owner set to ${name}`);
          if (riskContactPicker) riskContactPicker.style.display = 'none';
          onUpdate?.(updated);
        } catch {
          toast.error('Failed to save');
        }
      });
    });
  };

  const showRiskPicker = () => {
    if (!riskContactPicker) return;
    riskContactPicker.style.display = riskContactPicker.style.display === 'none' ? 'block' : 'none';
    if (riskContactPicker.style.display === 'block' && viewContacts.length === 0) {
      contactsService.getAll().then((res) => {
        viewContacts = res?.contacts || [];
        renderRiskContactGrid(riskContactSearch?.value || '');
      }).catch(() => {
        if (riskContactList) riskContactList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
      });
    } else if (riskContactPicker.style.display === 'block') {
      renderRiskContactGrid(riskContactSearch?.value || '');
    }
    if (riskContactSearch) riskContactSearch.focus();
  };

  const changeOwnerBtn = container.querySelector('#risk-change-owner-btn');
  const showPickerBtn = container.querySelector('#risk-show-picker-btn');
  if (changeOwnerBtn && riskContactPicker) on(changeOwnerBtn as HTMLElement, 'click', showRiskPicker);
  if (showPickerBtn && riskContactPicker) on(showPickerBtn as HTMLElement, 'click', showRiskPicker);
  if (riskContactSearch) {
    riskContactSearch.addEventListener('input', () => renderRiskContactGrid(riskContactSearch.value));
  }

  function findContactByOwner(name: string): Contact | undefined {
    if (!name || !viewContacts.length) return undefined;
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    const byExact = viewContacts.find((c) => (c.name || '').trim().toLowerCase() === n);
    if (byExact) return byExact;
    const byPartial = viewContacts.find(
      (c) =>
        (c.name || '').trim().toLowerCase().includes(n) ||
        n.includes((c.name || '').trim().toLowerCase())
    );
    if (byPartial) return byPartial;
    const byAlias = viewContacts.find((c) =>
      (c.aliases || []).some((a) => String(a).trim().toLowerCase() === n)
    );
    if (byAlias) return byAlias;
    return viewContacts.find((c) =>
      (c.aliases || []).some((a) => {
        const aLower = String(a).trim().toLowerCase();
        return aLower.includes(n) || n.includes(aLower);
      })
    );
  }

  function getContactPhotoUrl(c: Contact | undefined): string | null {
    if (!c) return null;
    const u = c as { photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string };
    return u.photoUrl || u.avatarUrl || u.photo_url || u.avatar_url || null;
  }

  contactsService.getAll().then((res) => {
    viewContacts = res?.contacts || [];
    const contact = findContactByOwner(owner);
    const roleEl = container.querySelector('#risk-assigned-role');
    if (roleEl) roleEl.textContent = contact?.role ?? '—';
    const avatarEl = container.querySelector('#risk-assigned-avatar');
    if (avatarEl && owner) {
      const photoUrl = getContactPhotoUrl(contact);
      if (photoUrl) {
        avatarEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = photoUrl;
        img.alt = '';
        img.onerror = () => { avatarEl.textContent = getInitials(owner); };
        avatarEl.appendChild(img);
      }
    }
  }).catch(() => {});

  return container;
}
