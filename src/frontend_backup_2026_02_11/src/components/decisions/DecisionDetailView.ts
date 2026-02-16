/**
 * Decision Detail View
 * Full-page view for decision details: content, status, rationale, owner, source, timeline, similar decisions
 */

import { createElement, on } from '@lib/dom';
import { Decision, decisionsService } from '@services/decisions';
import { Action, actionsService } from '@services/actions';
import { contactsService, Contact } from '@services/contacts';
import { toast } from '@services/toast';
import { formatRelativeTime, formatDateTime } from '@lib/format';

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join('').toUpperCase().substring(0, 2);
}

export interface DecisionDetailViewProps {
  decision: Decision;
  onClose: () => void;
  onUpdate?: (decision: Decision) => void;
  onDecisionClick?: (decision: Decision) => void;
  /** When user clicks an implementing action (optional, e.g. open action detail) */
  onActionClick?: (action: { id: string | number; task?: string; content?: string; status?: string }) => void;
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

export function createDecisionDetailView(props: DecisionDetailViewProps): HTMLElement {
  const { decision, onClose, onUpdate, onDecisionClick, onActionClick } = props;

  const container = createElement('div', { className: 'decision-detail-view question-detail-view' });

  container.innerHTML = `
    <div class="question-detail-header decision-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Decisions</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Decision #${String(decision.id).substring(0, 8)}</span>
      </div>
      <div class="header-actions">
        <span class="status-badge status-${(decision.status || 'active').toLowerCase()}">${escapeHtml(String(decision.status))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content decision-detail-content">
      <div id="decision-view-content">
      <section class="detail-section decision-main">
        <div class="question-badges decision-badges">
          ${decision.impact ? `<span class="priority-pill impact-${decision.impact}">${escapeHtml(decision.impact)} impact</span>` : ''}
          ${decision.generation_source ? `<span class="status-pill">${escapeHtml(decision.generation_source)}</span>` : ''}
          <span class="question-date decision-date">Created ${formatRelativeTime(decision.created_at)}</span>
        </div>
        <h2 class="question-text decision-content-text" id="decision-view-content-text">${escapeHtml(decision.content)}</h2>
      </section>

      <div class="detail-columns">
        <div class="detail-column-left">
          <section class="detail-section">
            <div class="section-header-sota">
              <h3>Rationale / Context</h3>
              <span class="section-subtitle">Why was this decision made?</span>
              <button type="button" class="btn-ai-suggest" id="decision-rationale-ai-suggest-btn" title="Suggest rationale, impact and summary from decision text">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Suggest
              </button>
            </div>
            <div id="decision-view-rationale">${(decision.rationale || decision.context) ? `<p class="decision-rationale">${escapeHtml(decision.rationale || decision.context || '')}</p>` : '<p class="text-muted">No rationale recorded</p>'}</div>
            <div id="decision-suggestions-panel" class="suggestions-panel-sota decision-suggestions-panel hidden gm-mt-2"></div>
          </section>

          <section class="detail-section" id="decision-owner-section">
            <div class="section-header-sota">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Owner / Made by
                <span class="section-subtitle">Who made this decision?</span>
              </h3>
              <button type="button" class="btn-ai-suggest" id="decision-owner-ai-suggest-btn" title="Suggest owner from decision content">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Suggest
              </button>
            </div>

            <div id="decision-current-owner" class="current-assignment-card">
              ${(decision.made_by || decision.owner) ? `
                <div class="assigned-contact-display">
                  <div class="contact-avatar-lg" id="decision-owner-avatar">${getInitials(decision.made_by || decision.owner || '')}</div>
                  <div class="contact-details">
                    <div class="contact-name-lg">${escapeHtml(decision.made_by || decision.owner || '')}</div>
                    <div class="contact-role-sm" id="decision-owner-role">—</div>
                  </div>
                  <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    Change
                  </button>
                </div>
              ` : `
                <div class="no-assignment">
                  <div class="no-assignment-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                  </div>
                  <span>No owner</span>
                  <p class="no-assignment-hint">Choose from contacts</p>
                  <button class="btn-assign-now" id="decision-show-owner-picker-btn" type="button">Choose</button>
                </div>
              `}
            </div>

            <div id="decision-contact-picker" class="contact-picker-sota hidden">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="decision-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="decision-contact-list" class="contact-list-grid">Loading...</div>
            </div>

            <div id="decision-owner-suggestions-panel" class="suggestions-panel-sota decision-owner-suggestions-panel hidden gm-mt-2"></div>

            ${decision.approved_by ? `<p class="text-muted gm-mt-2">Approved by: ${escapeHtml(decision.approved_by)}</p>` : ''}
            ${decision.decided_at ? `<p class="text-muted">Decided: ${formatDate(decision.decided_at)}</p>` : ''}
          </section>

          <section class="detail-section">
            <div class="section-header">
              <h3>Source</h3>
            </div>
            ${decision.source_file ? `<p class="source-file">${escapeHtml(decision.source_file)}</p>` : ''}
            ${decision.source_document_id ? `
              <p class="source-doc">
                <a href="#" class="doc-link" data-document-id="${escapeHtml(String(decision.source_document_id))}">View source document</a>
              </p>
            ` : ''}
            ${!decision.source_file && !decision.source_document_id ? '<p class="text-muted">No source recorded</p>' : ''}
          </section>
        </div>

        <div class="detail-column-right">
          <section class="detail-section metadata-section">
            <div class="section-header">
              <h3>Metadata</h3>
            </div>
            <dl class="metadata-list">
              <dt>Created</dt>
              <dd>${formatDate(decision.created_at)}</dd>
              ${decision.updated_at ? `<dt>Updated</dt><dd>${formatDate(decision.updated_at)}</dd>` : ''}
            </dl>
          </section>

          <section class="detail-section" id="decision-implementing-tasks-section">
            <div class="section-header">
              <h3>Implementing tasks</h3>
            </div>
            <div id="decision-implementing-tasks-list" class="decision-implementing-tasks-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>

          <section class="detail-section decision-timeline-section">
            <div class="section-header">
              <h3>Timeline</h3>
            </div>
            <div id="decision-timeline-list" class="decision-timeline-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>

          <section class="detail-section decision-similar-section">
            <div class="section-header">
              <h3>Similar decisions</h3>
            </div>
            <div id="decision-similar-list" class="decision-similar-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-secondary" id="edit-decision-btn">Edit</button>
        <button type="button" class="btn btn-danger" id="delete-decision-btn">Delete</button>
      </div>
      </div>

      <div id="decision-edit-form" class="decision-detail-edit-form hidden">
        <form id="decision-inline-form" class="decision-form">
          <div class="form-group">
            <label for="decision-edit-content">Decision *</label>
            <textarea id="decision-edit-content" rows="3" required placeholder="What was decided?">${escapeHtml(decision.content || '')}</textarea>
          </div>
          <div class="form-group">
            <div class="gm-flex gm-flex-center gm-justify-between gm-flex-wrap gm-gap-2 gm-mb-2">
              <label for="decision-edit-rationale" class="gm-mb-0">Rationale</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="decision-edit-ai-suggest-btn" title="Suggest rationale, impact and summary from decision text">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="decision-edit-rationale" rows="2" placeholder="Why was this decision made?">${escapeHtml(decision.rationale || decision.context || '')}</textarea>
          </div>
          <div id="decision-edit-suggestions-panel" class="suggestions-panel-sota hidden gm-mb-3"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="decision-edit-impact">Impact</label>
              <select id="decision-edit-impact">
                <option value="low" ${decision.impact === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${decision.impact === 'medium' || !decision.impact ? 'selected' : ''}>Medium</option>
                <option value="high" ${decision.impact === 'high' ? 'selected' : ''}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="decision-edit-summary">Summary (one line)</label>
              <input type="text" id="decision-edit-summary" value="${escapeHtml((decision as { summary?: string }).summary || '')}" placeholder="One-line summary for lists/reports">
            </div>
            <div class="form-group">
              <label for="decision-edit-status">Status</label>
              <select id="decision-edit-status">
                <option value="proposed" ${decision.status === 'proposed' || !decision.status ? 'selected' : ''}>Proposed</option>
                <option value="approved" ${decision.status === 'approved' ? 'selected' : ''}>Approved</option>
                <option value="rejected" ${decision.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                <option value="deferred" ${decision.status === 'deferred' ? 'selected' : ''}>Deferred</option>
                <option value="active" ${decision.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="superseded" ${decision.status === 'superseded' ? 'selected' : ''}>Superseded</option>
                <option value="revoked" ${decision.status === 'revoked' ? 'selected' : ''}>Revoked</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Made by</label>
            <input type="hidden" id="decision-edit-made-by" value="${escapeHtml(decision.made_by || (decision as { owner?: string }).owner || '')}">
            <div id="decision-edit-owner-display" class="current-assignment-card decision-edit-owner-card"></div>
            <div id="decision-edit-contact-picker" class="contact-picker-sota hidden gm-mt-2">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="decision-edit-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="decision-edit-contact-list" class="contact-list-grid">Loading...</div>
            </div>
          </div>
        </form>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="decision-save-btn">Save</button>
          <button type="button" class="btn btn-secondary" id="decision-cancel-edit-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="decision-delete-in-edit-btn">Delete</button>
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

  const viewContent = container.querySelector('#decision-view-content') as HTMLElement;
  const editForm = container.querySelector('#decision-edit-form') as HTMLElement;

  const editBtn = container.querySelector('#edit-decision-btn');
  if (editBtn && viewContent && editForm) {
    on(editBtn as HTMLElement, 'click', () => {
      viewContent.classList.add('hidden');
      editForm.classList.remove('hidden');
      // Sync edit form owner (in case owner was changed in view)
      renderEditFormOwnerDisplay(currentOwnerName);
    });
  }

  const cancelEditBtn = container.querySelector('#decision-cancel-edit-btn');
  if (cancelEditBtn && viewContent && editForm) {
    on(cancelEditBtn as HTMLElement, 'click', () => {
      editForm.classList.add('hidden');
      viewContent.classList.remove('hidden');
    });
  }

  const saveBtn = container.querySelector('#decision-save-btn');
  if (saveBtn && editForm && onUpdate) {
    on(saveBtn as HTMLElement, 'click', async () => {
      const form = container.querySelector('#decision-inline-form') as HTMLFormElement;
      if (!form?.checkValidity()) {
        form.reportValidity();
        return;
      }
      const contentEl = container.querySelector('#decision-edit-content') as HTMLTextAreaElement;
      const rationaleEl = container.querySelector('#decision-edit-rationale') as HTMLTextAreaElement;
      const impactEl = container.querySelector('#decision-edit-impact') as HTMLSelectElement;
      const summaryEl = container.querySelector('#decision-edit-summary') as HTMLInputElement;
      const statusEl = container.querySelector('#decision-edit-status') as HTMLSelectElement;
      const madeByEl = container.querySelector('#decision-edit-made-by') as HTMLInputElement;
      const content = contentEl?.value?.trim() || '';
      if (!content) {
        toast.error('Decision text is required');
        return;
      }
      (saveBtn as HTMLButtonElement).disabled = true;
      (saveBtn as HTMLButtonElement).textContent = 'Saving...';
      try {
        const updated = await decisionsService.update(decision.id, {
          content,
          rationale: rationaleEl?.value?.trim() || undefined,
          impact: (impactEl?.value || undefined) as Decision['impact'],
          summary: (summaryEl?.value?.trim() || undefined) as string | undefined,
          status: (statusEl?.value || 'active') as Decision['status'],
          made_by: madeByEl?.value?.trim() || undefined,
        });
        toast.success('Decision updated');
        // Update view DOM from response
        const viewContentText = container.querySelector('#decision-view-content-text');
        if (viewContentText) viewContentText.textContent = updated.content || content;
        const viewRationale = container.querySelector('#decision-view-rationale');
        if (viewRationale) {
          viewRationale.innerHTML = (updated.rationale || updated.context)
            ? `<p class="decision-rationale">${escapeHtml(updated.rationale || updated.context || '')}</p>`
            : '<p class="text-muted">No rationale recorded</p>';
        }
        const statusBadge = container.querySelector('.decision-detail-header .status-badge');
        if (statusBadge) {
          statusBadge.textContent = String(updated.status || 'active');
          statusBadge.className = `status-badge status-${(updated.status || 'active').toLowerCase()}`;
        }
        const badges = container.querySelector('.decision-badges');
        if (badges) {
          const impactPill = (updated as Decision).impact
            ? `<span class="priority-pill impact-${(updated as Decision).impact}">${escapeHtml((updated as Decision).impact || '')} impact</span>`
            : '';
          const existing = badges.innerHTML;
          if (impactPill && !existing.includes('impact-')) {
            badges.insertAdjacentHTML('afterbegin', impactPill + ' ');
          } else if (impactPill) {
            const oldPill = badges.querySelector('.priority-pill.impact-');
            if (oldPill) oldPill.outerHTML = impactPill;
          }
        }
        currentOwnerName = updated.made_by || (updated as { owner?: string }).owner || '';
        // Refresh owner display in view
        const currentOwnerEl = container.querySelector('#decision-current-owner');
        if (currentOwnerEl && currentOwnerName) {
          const contact = findContactByOwner(currentOwnerName);
          const photoUrl = getContactPhotoUrl(contact);
          currentOwnerEl.innerHTML = `
            <div class="assigned-contact-display">
              <div class="contact-avatar-lg" id="decision-owner-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(currentOwnerName)}'">` : getInitials(currentOwnerName)}</div>
              <div class="contact-details">
                <div class="contact-name-lg">${escapeHtml(currentOwnerName)}</div>
                <div class="contact-role-sm" id="decision-owner-role">${escapeHtml(contact?.role ?? '—')}</div>
              </div>
              <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                Change
              </button>
            </div>`;
          const chBtn = currentOwnerEl.querySelector('#decision-change-owner-btn');
          if (chBtn) on(chBtn as HTMLElement, 'click', showOwnerPicker);
        } else if (currentOwnerEl && !currentOwnerName) {
          currentOwnerEl.innerHTML = `
            <div class="no-assignment">
              <div class="no-assignment-icon">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              </div>
              <span>No owner</span>
              <p class="no-assignment-hint">Choose from contacts</p>
              <button class="btn-assign-now" id="decision-show-owner-picker-btn" type="button">Choose</button>
            </div>`;
          const showBtn = currentOwnerEl.querySelector('#decision-show-owner-picker-btn');
          if (showBtn) on(showBtn as HTMLElement, 'click', showOwnerPicker);
        }
        onUpdate(updated);
        editForm.classList.add('hidden');
        viewContent.classList.remove('hidden');
      } catch {
        toast.error('Failed to save decision');
      } finally {
        (saveBtn as HTMLButtonElement).disabled = false;
        (saveBtn as HTMLButtonElement).textContent = 'Save';
      }
    });
  }

  const deleteInEditBtn = container.querySelector('#decision-delete-in-edit-btn');
  if (deleteInEditBtn) {
    on(deleteInEditBtn as HTMLElement, 'click', async () => {
      if (!confirm('Are you sure you want to delete this decision?')) return;
      try {
        await decisionsService.delete(decision.id);
        toast.success('Decision deleted');
        onClose();
      } catch {
        toast.error('Failed to delete decision');
      }
    });
  }

  const deleteBtn = container.querySelector('#delete-decision-btn');
  if (deleteBtn) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      if (!confirm('Are you sure you want to delete this decision?')) return;
      try {
        await decisionsService.delete(decision.id);
        toast.success('Decision deleted');
        onClose();
      } catch {
        toast.error('Failed to delete decision');
      }
    });
  }

  const docLink = container.querySelector('.doc-link');
  if (docLink && decision.source_document_id) {
    on(docLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('godmode:navigate', {
        detail: { tab: 'files', documentId: decision.source_document_id }
      }));
    });
  }

  // Owner section: load contacts, show avatar/role, contact picker
  let viewContacts: Contact[] = [];
  let currentOwnerName = decision.made_by || (decision as { owner?: string }).owner || '';
  const ownerPicker = container.querySelector('#decision-contact-picker') as HTMLElement;
  const ownerList = container.querySelector('#decision-contact-list') as HTMLElement;
  const ownerSearch = container.querySelector('#decision-contact-search') as HTMLInputElement;

  function getContactPhotoUrl(c: Contact | undefined): string | null {
    if (!c) return null;
    const u = c as { photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string };
    return u.photoUrl || u.avatarUrl || u.photo_url || u.avatar_url || null;
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
    return byAlias || viewContacts.find((c) =>
      (c.aliases || []).some((a) => {
        const aLower = String(a).trim().toLowerCase();
        return aLower.includes(n) || n.includes(aLower);
      })
    );
  }

  const renderOwnerContactGrid = (filter = '') => {
    if (!ownerList) return;
    const list = filter
      ? viewContacts.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
          (c.role || '').toLowerCase().includes(filter.toLowerCase()) ||
          ((c as { organization?: string }).organization || '').toLowerCase().includes(filter.toLowerCase())
      )
      : viewContacts;
    if (viewContacts.length === 0) {
      ownerList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
      return;
    }
    if (list.length === 0) {
      ownerList.innerHTML = '<div class="empty-state">No contacts match</div>';
      return;
    }
    ownerList.innerHTML = list
      .map((c) => {
        const photoUrl = getContactPhotoUrl(c);
        const isCurrent = (currentOwnerName || '').trim() === (c.name || '').trim();
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
    ownerList.querySelectorAll('.contact-card-picker').forEach((card) => {
      on(card as HTMLElement, 'click', async () => {
        const name = card.getAttribute('data-contact-name') || '';
        if (!name) return;
        try {
          const updated = await decisionsService.update(decision.id, { made_by: name });
          currentOwnerName = name;
          toast.success(`Owner set to ${name}`);
          if (ownerPicker) ownerPicker.classList.add('hidden');
          if (onUpdate) onUpdate({ ...decision, made_by: name, ...updated });
          // Refresh displayed owner in current-assignment card
          const currentEl = container.querySelector('#decision-current-owner');
          if (currentEl) {
            const contact = findContactByOwner(name);
            const photoUrl = getContactPhotoUrl(contact);
            currentEl.innerHTML = `
              <div class="assigned-contact-display">
                <div class="contact-avatar-lg" id="decision-owner-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(name)}'">` : getInitials(name)}</div>
                <div class="contact-details">
                  <div class="contact-name-lg">${escapeHtml(name)}</div>
                  <div class="contact-role-sm" id="decision-owner-role">${escapeHtml(contact?.role ?? '—')}</div>
                </div>
                <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  Change
                </button>
              </div>`;
            const changeBtn = currentEl.querySelector('#decision-change-owner-btn');
            if (changeBtn) on(changeBtn as HTMLElement, 'click', showOwnerPicker);
          }
        } catch {
          toast.error('Failed to save owner');
        }
      });
    });
  };

  const showOwnerPicker = () => {
    if (!ownerPicker) return;
    ownerPicker.classList.toggle('hidden');
    if (!ownerPicker.classList.contains('hidden') && viewContacts.length === 0) {
      contactsService.getAll().then((res) => {
        viewContacts = res?.contacts || [];
        renderOwnerContactGrid(ownerSearch?.value || '');
      }).catch(() => {
        if (ownerList) ownerList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
      });
    } else if (!ownerPicker.classList.contains('hidden')) {
      renderOwnerContactGrid(ownerSearch?.value || '');
    }
    if (ownerSearch) ownerSearch.focus();
  };

  const changeOwnerBtn = container.querySelector('#decision-change-owner-btn');
  const showOwnerPickerBtn = container.querySelector('#decision-show-owner-picker-btn');
  if (changeOwnerBtn && ownerPicker) on(changeOwnerBtn as HTMLElement, 'click', showOwnerPicker);
  if (showOwnerPickerBtn && ownerPicker) on(showOwnerPickerBtn as HTMLElement, 'click', showOwnerPicker);
  if (ownerSearch) {
    ownerSearch.addEventListener('input', () => renderOwnerContactGrid(ownerSearch.value));
  }

  contactsService.getAll().then((res) => {
    viewContacts = res?.contacts || [];
    const contact = findContactByOwner(currentOwnerName);
    const roleEl = container.querySelector('#decision-owner-role');
    if (roleEl) roleEl.textContent = contact?.role ?? '—';
    const avatarEl = container.querySelector('#decision-owner-avatar');
    if (avatarEl && currentOwnerName) {
      const photoUrl = getContactPhotoUrl(contact);
      if (photoUrl) {
        avatarEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = photoUrl;
        img.alt = '';
        img.onerror = () => { avatarEl.textContent = getInitials(currentOwnerName); };
        avatarEl.appendChild(img);
      }
    }
  }).catch(() => { });

  // Edit form: owner display and contact picker (reuse viewContacts)
  const editOwnerDisplay = container.querySelector('#decision-edit-owner-display') as HTMLElement;
  const editMadeByInput = container.querySelector('#decision-edit-made-by') as HTMLInputElement;
  const editContactPicker = container.querySelector('#decision-edit-contact-picker') as HTMLElement;
  const editContactList = container.querySelector('#decision-edit-contact-list') as HTMLElement;
  const editContactSearch = container.querySelector('#decision-edit-contact-search') as HTMLInputElement;

  function renderEditFormOwnerDisplay(madeBy: string) {
    if (!editOwnerDisplay || !editMadeByInput) return;
    editMadeByInput.value = madeBy;
    if (madeBy) {
      const contact = findContactByOwner(madeBy);
      const photoUrl = getContactPhotoUrl(contact);
      editOwnerDisplay.innerHTML = `
        <div class="assigned-contact-display">
          <div class="contact-avatar-lg">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(madeBy)}'">` : getInitials(madeBy)}</div>
          <div class="contact-details">
            <div class="contact-name-lg">${escapeHtml(madeBy)}</div>
            ${contact?.role ? `<div class="contact-role-sm">${escapeHtml(contact.role)}</div>` : ''}
          </div>
          <button type="button" class="btn-change-assignment" id="decision-edit-change-owner-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            Change
          </button>
        </div>`;
    } else {
      editOwnerDisplay.innerHTML = `
        <div class="no-assignment">
          <span>No owner</span>
          <button type="button" class="btn-assign-now" id="decision-edit-choose-owner-btn">Choose</button>
        </div>`;
    }
    const chBtn = editOwnerDisplay.querySelector('#decision-edit-change-owner-btn');
    const chooseBtn = editOwnerDisplay.querySelector('#decision-edit-choose-owner-btn');
    if (chBtn) on(chBtn as HTMLElement, 'click', showEditOwnerPicker);
    if (chooseBtn) on(chooseBtn as HTMLElement, 'click', showEditOwnerPicker);
  }

  function renderEditFormContactGrid(filter = '') {
    if (!editContactList) return;
    const list = filter
      ? viewContacts.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
          (c.role || '').toLowerCase().includes(filter.toLowerCase())
      )
      : viewContacts;
    if (viewContacts.length === 0) {
      editContactList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
      return;
    }
    if (list.length === 0) {
      editContactList.innerHTML = '<div class="empty-state">No contacts match</div>';
      return;
    }
    const currentMadeBy = (editMadeByInput?.value || '').trim();
    editContactList.innerHTML = list
      .map((c) => {
        const photoUrl = getContactPhotoUrl(c);
        const isCurrent = currentMadeBy === (c.name || '').trim();
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
    editContactList.querySelectorAll('.contact-card-picker').forEach((card) => {
      on(card as HTMLElement, 'click', () => {
        const name = card.getAttribute('data-contact-name') || '';
        if (name) {
          renderEditFormOwnerDisplay(name);
          if (editContactPicker) editContactPicker.classList.add('hidden');
        }
      });
    });
  }

  function showEditOwnerPicker() {
    if (!editContactPicker) return;
    editContactPicker.classList.toggle('hidden');
    if (!editContactPicker.classList.contains('hidden')) {
      if (viewContacts.length === 0) {
        contactsService.getAll().then((res) => {
          viewContacts = res?.contacts || [];
          renderEditFormContactGrid(editContactSearch?.value || '');
        }).catch(() => {
          if (editContactList) editContactList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
        });
      } else {
        renderEditFormContactGrid(editContactSearch?.value || '');
      }
    }
    if (editContactSearch) editContactSearch.focus();
  }

  if (editContactSearch) {
    editContactSearch.addEventListener('input', () => renderEditFormContactGrid(editContactSearch.value));
  }

  // Initial edit form owner display (when user opens edit, we call renderEditFormOwnerDisplay in edit button handler)
  renderEditFormOwnerDisplay(decision.made_by || (decision as { owner?: string }).owner || '');

  // AI Suggest (view mode): Owner section – suggest owner from decision content (project contacts only)
  const ownerAiSuggestBtn = container.querySelector('#decision-owner-ai-suggest-btn');
  const ownerSuggestionsPanel = container.querySelector('#decision-owner-suggestions-panel') as HTMLElement;
  if (ownerAiSuggestBtn && ownerSuggestionsPanel) {
    on(ownerAiSuggestBtn as HTMLElement, 'click', async () => {
      (ownerAiSuggestBtn as HTMLButtonElement).disabled = true;
      ownerSuggestionsPanel.classList.remove('hidden');
      ownerSuggestionsPanel.innerHTML = '<div class="loading">Asking AI…</div>';
      try {
        if (viewContacts.length === 0) {
          const res = await contactsService.getAll();
          viewContacts = res?.contacts || [];
        }
        const { suggested_owners } = await decisionsService.suggestOwner(decision.content || '', decision.rationale || decision.context || '');
        if (!suggested_owners?.length) {
          ownerSuggestionsPanel.innerHTML = '<div class="no-suggestions">No owner suggestions. <button type="button" class="btn-link" id="decision-owner-hide-suggest-btn">Close</button></div>';
        } else {
          ownerSuggestionsPanel.innerHTML = `
            <div class="suggestions-header-sota">
              <div class="ai-badge">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Recommended
              </div>
            </div>
            <div class="suggestions-list-sota">
              ${suggested_owners.map((s, i) => {
            const contact = findContactByOwner(s.name);
            const photoUrl = getContactPhotoUrl(contact);
            const roleOrReason = contact?.role ?? s.reason ?? '';
            const score = s.score ?? 0;
            const scoreColor = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--text-muted)';
            return `
                <div class="suggestion-card-sota decision-owner-card" data-owner-name="${escapeHtml(s.name)}">
                  <div class="suggestion-rank">#${i + 1}</div>
                  <div class="suggestion-avatar-sota">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(s.name)}'">` : getInitials(s.name)}</div>
                  <div class="suggestion-info-sota">
                    <div class="suggestion-name-sota">${escapeHtml(s.name)}</div>
                    ${roleOrReason ? `<div class="suggestion-reason-sota">${escapeHtml(roleOrReason)}</div>` : ''}
                  </div>
                  ${score > 0 ? `<div class="suggestion-score-sota" style="--score-color: ${scoreColor}"><div class="score-value">${score}%</div><div class="score-label">Match</div></div>` : ''}
                  <button type="button" class="btn-select-suggestion">Assign</button>
                </div>`;
          }).join('')}
            </div>
            <div class="suggestions-footer"><button type="button" class="btn-link" id="decision-owner-hide-suggest-btn">Close</button></div>
          `;
          ownerSuggestionsPanel.querySelectorAll('.decision-owner-card .btn-select-suggestion').forEach((btn) => {
            const card = (btn as HTMLElement).closest('.decision-owner-card');
            const name = card?.getAttribute('data-owner-name') || '';
            if (!name) return;
            on(btn as HTMLElement, 'click', async () => {
              try {
                const updated = await decisionsService.update(decision.id, { made_by: name });
                currentOwnerName = name;
                toast.success(`Owner set to ${name}`);
                ownerSuggestionsPanel.classList.add('hidden');
                const currentOwnerEl = container.querySelector('#decision-current-owner');
                if (currentOwnerEl) {
                  const contact = findContactByOwner(name);
                  const photoUrl = getContactPhotoUrl(contact);
                  currentOwnerEl.innerHTML = `
                    <div class="assigned-contact-display">
                      <div class="contact-avatar-lg" id="decision-owner-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(name)}'">` : getInitials(name)}</div>
                      <div class="contact-details">
                        <div class="contact-name-lg">${escapeHtml(name)}</div>
                        <div class="contact-role-sm" id="decision-owner-role">${escapeHtml(contact?.role ?? '—')}</div>
                      </div>
                      <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        Change
                      </button>
                    </div>`;
                  const chBtn = currentOwnerEl.querySelector('#decision-change-owner-btn');
                  if (chBtn) on(chBtn as HTMLElement, 'click', showOwnerPicker);
                }
                if (onUpdate) onUpdate(updated);
              } catch {
                toast.error('Failed to save owner');
              }
            });
          });
        }
        const hideBtn = ownerSuggestionsPanel.querySelector('#decision-owner-hide-suggest-btn');
        if (hideBtn) on(hideBtn as HTMLElement, 'click', () => { ownerSuggestionsPanel.classList.add('hidden'); });
      } catch {
        ownerSuggestionsPanel.innerHTML = '<div class="error">AI suggest failed. <button type="button" class="btn-link" id="decision-owner-hide-suggest-btn">Close</button></div>';
        const h = ownerSuggestionsPanel.querySelector('#decision-owner-hide-suggest-btn');
        if (h) on(h as HTMLElement, 'click', () => { ownerSuggestionsPanel.classList.add('hidden'); });
        toast.error('AI suggest failed');
      } finally {
        (ownerAiSuggestBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  // AI Suggest (view mode): Rationale section – fetch suggestion, show panel, Apply updates decision
  const rationaleAiSuggestBtn = container.querySelector('#decision-rationale-ai-suggest-btn');
  const suggestionsPanel = container.querySelector('#decision-suggestions-panel') as HTMLElement;
  if (rationaleAiSuggestBtn && suggestionsPanel) {
    on(rationaleAiSuggestBtn as HTMLElement, 'click', async () => {
      (rationaleAiSuggestBtn as HTMLButtonElement).disabled = true;
      suggestionsPanel.classList.remove('hidden');
      suggestionsPanel.innerHTML = '<div class="loading">Asking AI…</div>';
      try {
        const result = await decisionsService.suggest(decision.content || '', decision.rationale || decision.context || '');
        suggestionsPanel.innerHTML = `
          <div class="suggestion-card">
            <p><strong>Rationale:</strong> ${escapeHtml((result.rationale || '').substring(0, 300))}${(result.rationale || '').length > 300 ? '…' : ''}</p>
            <p><strong>Impact:</strong> ${escapeHtml(result.impact || '')} ${result.impact_summary ? `– ${escapeHtml(result.impact_summary)}` : ''}</p>
            <p><strong>Summary:</strong> ${escapeHtml(result.summary || '')}</p>
            <button type="button" class="btn btn-primary btn-sm" id="decision-apply-suggestion-btn">Apply</button>
          </div>`;
        const applyBtn = suggestionsPanel.querySelector('#decision-apply-suggestion-btn');
        if (applyBtn) {
          on(applyBtn as HTMLElement, 'click', async () => {
            try {
              const updated = await decisionsService.update(decision.id, {
                rationale: result.rationale,
                impact: result.impact,
                summary: result.summary,
              });
              toast.success('Suggestion applied');
              const viewRationale = container.querySelector('#decision-view-rationale');
              if (viewRationale) {
                viewRationale.innerHTML = (updated.rationale || updated.context)
                  ? `<p class="decision-rationale">${escapeHtml(updated.rationale || updated.context || '')}</p>`
                  : '<p class="text-muted">No rationale recorded</p>';
              }
              const badges = container.querySelector('.decision-badges');
              if (badges && (updated as Decision).impact) {
                const impactPill = badges.querySelector('.priority-pill.impact-low, .priority-pill.impact-medium, .priority-pill.impact-high');
                if (impactPill) impactPill.outerHTML = `<span class="priority-pill impact-${(updated as Decision).impact}">${escapeHtml((updated as Decision).impact || '')} impact</span>`;
                else badges.insertAdjacentHTML('afterbegin', `<span class="priority-pill impact-${(updated as Decision).impact}">${escapeHtml((updated as Decision).impact || '')} impact</span> `);
              }
              if (onUpdate) onUpdate(updated);
              suggestionsPanel.classList.add('hidden');
            } catch {
              toast.error('Failed to apply');
            }
          });
        }
      } catch {
        suggestionsPanel.innerHTML = '<div class="error">AI suggest failed</div>';
        toast.error('AI suggest failed');
      } finally {
        (rationaleAiSuggestBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  // AI Suggest (edit form): fill rationale, impact, summary
  const editAiSuggestBtn = container.querySelector('#decision-edit-ai-suggest-btn');
  const editSuggestionsPanel = container.querySelector('#decision-edit-suggestions-panel') as HTMLElement;
  if (editAiSuggestBtn) {
    on(editAiSuggestBtn as HTMLElement, 'click', async () => {
      const contentEl = container.querySelector('#decision-edit-content') as HTMLTextAreaElement;
      const rationaleEl = container.querySelector('#decision-edit-rationale') as HTMLTextAreaElement;
      const impactEl = container.querySelector('#decision-edit-impact') as HTMLSelectElement;
      const summaryEl = container.querySelector('#decision-edit-summary') as HTMLInputElement;
      const content = contentEl?.value?.trim() || '';
      if (!content) {
        toast.warning('Enter decision text first');
        return;
      }
      (editAiSuggestBtn as HTMLButtonElement).disabled = true;
      if (editSuggestionsPanel) {
        editSuggestionsPanel.classList.remove('hidden');
        editSuggestionsPanel.innerHTML = '<span class="text-muted">Asking AI…</span>';
      }
      try {
        const result = await decisionsService.suggest(content, rationaleEl?.value?.trim() || '');
        if (rationaleEl) rationaleEl.value = result.rationale || '';
        if (impactEl) impactEl.value = result.impact || 'medium';
        if (summaryEl) summaryEl.value = result.summary || '';
        if (editSuggestionsPanel) {
          editSuggestionsPanel.classList.add('hidden');
          editSuggestionsPanel.innerHTML = '';
        }
        toast.success('Suggestion applied');
      } catch {
        if (editSuggestionsPanel) {
          editSuggestionsPanel.innerHTML = '<span class="error">AI suggest failed</span>';
        }
        toast.error('AI suggest failed');
      } finally {
        (editAiSuggestBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  const timelineEl = container.querySelector('#decision-timeline-list');
  if (timelineEl) {
    decisionsService.getEvents(decision.id).then((events) => {
      const labels: Record<string, string> = {
        created: 'Created',
        updated: 'Updated',
        conflict_detected: 'Conflict detected',
        deleted: 'Deleted',
        restored: 'Restored',
      };
      const actorLabel = (ev: { actor_name?: string; event_data?: { trigger?: string } }) =>
        ev.actor_name || (ev.event_data?.trigger === 'decision_check_flow' ? 'System' : null);
      if (events.length === 0) {
        (timelineEl as HTMLElement).innerHTML = '<span class="text-muted">No events yet</span>';
        return;
      }
      (timelineEl as HTMLElement).innerHTML = events
        .map((ev) => {
          const actor = actorLabel(ev);
          return `<div class="decision-timeline-item decision-event-${escapeHtml(ev.event_type)}">
            <span class="decision-event-type">${escapeHtml(labels[ev.event_type] || ev.event_type)}</span>
            ${actor ? `<span class="decision-event-actor">${escapeHtml(actor)}</span>` : ''}
            <span class="decision-event-date">${formatRelativeTime(ev.created_at)}</span>
          </div>`;
        })
        .join('');
    }).catch(() => {
      (timelineEl as HTMLElement).innerHTML = '<span class="text-muted">Could not load timeline</span>';
    });
  }

  const similarEl = container.querySelector('#decision-similar-list');
  if (similarEl) {
    decisionsService.getSimilarDecisions(decision.id, 10).then((similar) => {
      if (similar.length === 0) {
        (similarEl as HTMLElement).innerHTML = '<span class="text-muted">No similar decisions</span>';
        return;
      }
      (similarEl as HTMLElement).innerHTML = similar
        .map((s) => `
          <div class="decision-similar-item" data-decision-id="${s.decision.id}" role="${onDecisionClick ? 'button' : 'none'}">
            <span class="decision-similar-score">${Math.round(s.similarityScore * 100)}%</span>
            <span class="decision-similar-content">${escapeHtml((s.decision.content || '').substring(0, 80))}${(s.decision.content || '').length > 80 ? '…' : ''}</span>
          </div>
        `)
        .join('');
      if (onDecisionClick) {
        (similarEl as HTMLElement).querySelectorAll('.decision-similar-item').forEach((el) => {
          on(el as HTMLElement, 'click', () => {
            const item = similar.find((s) => String(s.decision.id) === (el as HTMLElement).getAttribute('data-decision-id'));
            if (item) onDecisionClick(item.decision);
          });
        });
      }
    }).catch(() => {
      (similarEl as HTMLElement).innerHTML = '<span class="text-muted">Could not load similar decisions</span>';
    });
  }

  const implementingTasksEl = container.querySelector('#decision-implementing-tasks-list');
  if (implementingTasksEl) {
    actionsService.getAll(undefined, undefined, String(decision.id)).then((actions: Action[]) => {
      if (actions.length === 0) {
        (implementingTasksEl as HTMLElement).innerHTML = '<span class="text-muted">No tasks linked to this decision</span>';
        return;
      }
      (implementingTasksEl as HTMLElement).innerHTML = actions
        .map((a: Action) => {
          const title = ((a.content || a.task) || '').toString().trim().substring(0, 60) + (((a.content || a.task) || '').toString().length > 60 ? '…' : '');
          const status = (a.status || 'pending').toLowerCase();
          return `<div class="decision-implementing-task-item" data-action-id="${escapeHtml(String(a.id))}" role="${onActionClick ? 'button' : 'none'}">
            <span class="status-pill status-${status}">${escapeHtml(String(a.status || 'pending').replace('_', ' '))}</span>
            <span class="decision-implementing-task-title">${escapeHtml(title)}</span>
          </div>`;
        })
        .join('');
      if (onActionClick) {
        (implementingTasksEl as HTMLElement).querySelectorAll('.decision-implementing-task-item').forEach((el) => {
          on(el as HTMLElement, 'click', () => {
            const actionId = (el as HTMLElement).getAttribute('data-action-id');
            const action = actions.find((a) => String(a.id) === actionId);
            if (action) onActionClick(action);
          });
        });
      }
    }).catch(() => {
      (implementingTasksEl as HTMLElement).innerHTML = '<span class="text-muted">Could not load tasks</span>';
    });
  }

  return container;
}
