/**
 * Decision Modal Component
 * Create, view and edit decisions
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { Decision } from '../../stores/data';
import { http } from '../../services/api';
import { decisionsService } from '../../services/decisions';
import { contactsService, Contact } from '../../services/contacts';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].substring(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getContactPhotoUrl(c: Contact | undefined): string | null {
  if (!c) return null;
  const u = c as { photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string };
  return u.photoUrl || u.avatarUrl || u.photo_url || u.avatar_url || null;
}

const MODAL_ID = 'decision-modal';

export interface DecisionModalProps {
  mode: 'view' | 'edit' | 'create';
  decision?: Decision;
  onSave?: (decision: Decision) => void;
  onDelete?: (decisionId: string) => void;
}

/**
 * Show decision modal
 */
export function showDecisionModal(props: DecisionModalProps): void {
  const { mode, decision, onSave, onDelete } = props;
  const isEdit = mode === 'edit' && decision?.id;
  const isView = mode === 'view';

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'decision-modal-content' });

  if (isView && decision) {
    const viewContent = (decision as any).content ?? decision.decision;
    const viewImpact = (decision as any).impact;
    const viewSummary = (decision as any).summary;
    content.innerHTML = `
      <div class="decision-view">
        <div class="decision-meta">
          <span class="status-badge ${decision.status}">${decision.status}</span>
          ${viewImpact ? `<span class="impact-badge impact-${viewImpact}">${escapeHtml(viewImpact)} impact</span>` : ''}
          <span class="decision-date">${formatRelativeTime(decision.madeAt)}</span>
        </div>
        
        <div class="decision-text-large">
          ${escapeHtml(viewContent)}
        </div>
        
        ${viewSummary ? `
          <div class="decision-section decision-summary">
            <h4>Summary</h4>
            <p>${escapeHtml(viewSummary)}</p>
          </div>
        ` : ''}
        
        ${decision.rationale ? `
          <div class="decision-section">
            <h4>Rationale</h4>
            <p>${escapeHtml(decision.rationale)}</p>
          </div>
        ` : ''}
        
        ${decision.madeBy ? `
          <div class="decision-made-by">
            <strong>Decision made by:</strong> ${escapeHtml(decision.madeBy)}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    const decisionContent = (decision as any)?.content ?? decision?.decision ?? '';
    const decisionImpact = (decision as any)?.impact ?? '';
    const decisionSummary = (decision as any)?.summary ?? '';
    content.innerHTML = `
      <form id="decision-form" class="decision-form">
        <div class="form-group">
          <label for="decision-text">Decision *</label>
          <textarea id="decision-text" rows="3" required 
                    placeholder="What was decided?">${escapeHtml(decisionContent)}</textarea>
        </div>
        
        <div class="form-group">
          <label for="decision-rationale">Rationale</label>
          <div class="form-group-with-action">
            <textarea id="decision-rationale" rows="2" 
                      placeholder="Why was this decision made?">${escapeHtml(decision?.rationale || '')}</textarea>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="decision-impact">Impact</label>
            <select id="decision-impact">
              <option value="">—</option>
              <option value="low" ${decisionImpact === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${decisionImpact === 'medium' || !decisionImpact ? 'selected' : ''}>Medium</option>
              <option value="high" ${decisionImpact === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
          <div class="form-group">
            <label for="decision-summary">Summary (one line)</label>
            <input type="text" id="decision-summary" 
                   value="${escapeHtml(decisionSummary)}" 
                   placeholder="One-line summary for lists/reports">
          </div>
        </div>
        
        <div class="form-row form-row-actions">
          <button type="button" class="btn-ai-suggest btn-sm" id="decision-ai-suggest-btn" title="Suggest rationale, impact and summary from decision text">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            AI suggest
          </button>
          <span class="form-hint" id="decision-suggest-hint"></span>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="decision-status">Status</label>
            <select id="decision-status">
              <option value="proposed" ${decision?.status === 'proposed' || !decision ? 'selected' : ''}>Proposed</option>
              <option value="approved" ${decision?.status === 'approved' ? 'selected' : ''}>Approved</option>
              <option value="rejected" ${decision?.status === 'rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Made By</label>
            <input type="hidden" id="decision-by" value="${escapeHtml(decision?.madeBy || '')}">
            <div id="decision-made-by-display" class="current-assignment-card decision-modal-owner-card"></div>
            <div id="decision-modal-contact-picker" class="contact-picker-sota" style="display: none; margin-top: 8px;">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="decision-modal-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="decision-modal-contact-list" class="contact-list-grid">Loading...</div>
            </div>
          </div>
        </div>
      </form>
    `;

    const suggestBtn = content.querySelector('#decision-ai-suggest-btn');
    const hintEl = content.querySelector('#decision-suggest-hint');
    if (suggestBtn) {
      on(suggestBtn as HTMLElement, 'click', async () => {
        const getVal = (id: string) => (content.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value?.trim() || '';
        const text = getVal('decision-text');
        if (!text) {
          toast.warning('Enter decision text first');
          return;
        }
        (suggestBtn as HTMLButtonElement).disabled = true;
        if (hintEl) hintEl.textContent = 'Asking AI…';
        try {
          const result = await decisionsService.suggest(text, getVal('decision-rationale'));
          (content.querySelector('#decision-rationale') as HTMLTextAreaElement).value = result.rationale || '';
          (content.querySelector('#decision-impact') as HTMLSelectElement).value = result.impact || 'medium';
          (content.querySelector('#decision-summary') as HTMLInputElement).value = result.summary || '';
          if (hintEl) hintEl.textContent = result.impact_summary ? `Impact: ${result.impact_summary}` : 'Done';
        } catch {
          if (hintEl) hintEl.textContent = '';
          toast.error('AI suggest failed');
        } finally {
          (suggestBtn as HTMLButtonElement).disabled = false;
        }
      });
    }

    // Made By: contact picker + current-assignment display
    let modalContacts: Contact[] = [];
    const madeByDisplay = content.querySelector('#decision-made-by-display') as HTMLElement;
    const madeByInput = content.querySelector('#decision-by') as HTMLInputElement;
    const modalPicker = content.querySelector('#decision-modal-contact-picker') as HTMLElement;
    const modalContactList = content.querySelector('#decision-modal-contact-list') as HTMLElement;
    const modalContactSearch = content.querySelector('#decision-modal-contact-search') as HTMLInputElement;

    function findContactByName(name: string): Contact | undefined {
      if (!name || !modalContacts.length) return undefined;
      const n = name.trim().toLowerCase();
      if (!n) return undefined;
      const byExact = modalContacts.find((c) => (c.name || '').trim().toLowerCase() === n);
      if (byExact) return byExact;
      const byAlias = modalContacts.find((c) =>
        (c.aliases || []).some((a) => String(a).trim().toLowerCase() === n)
      );
      return byAlias;
    }

    function renderMadeByDisplay(madeBy: string) {
      if (!madeByDisplay || !madeByInput) return;
      madeByInput.value = madeBy;
      if (madeBy) {
        const contact = findContactByName(madeBy);
        const photoUrl = getContactPhotoUrl(contact);
        madeByDisplay.innerHTML = `
          <div class="assigned-contact-display">
            <div class="contact-avatar-lg">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(madeBy)}'">` : getInitials(madeBy)}</div>
            <div class="contact-details">
              <div class="contact-name-lg">${escapeHtml(madeBy)}</div>
              ${contact?.role ? `<div class="contact-role-sm">${escapeHtml(contact.role)}</div>` : ''}
            </div>
            <button type="button" class="btn-change-assignment" id="decision-modal-change-owner-btn">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Change
            </button>
          </div>`;
      } else {
        madeByDisplay.innerHTML = `
          <div class="no-assignment">
            <span>No owner</span>
            <button type="button" class="btn-assign-now" id="decision-modal-choose-owner-btn">Choose</button>
          </div>`;
      }
      const changeBtn = madeByDisplay.querySelector('#decision-modal-change-owner-btn');
      const chooseBtn = madeByDisplay.querySelector('#decision-modal-choose-owner-btn');
      if (changeBtn) on(changeBtn as HTMLElement, 'click', showModalPicker);
      if (chooseBtn) on(chooseBtn as HTMLElement, 'click', showModalPicker);
    }

    function showModalPicker() {
      if (!modalPicker) return;
      modalPicker.style.display = modalPicker.style.display === 'none' ? 'block' : 'none';
      if (modalPicker.style.display === 'block' && modalContacts.length === 0) {
        contactsService.getAll().then((res) => {
          modalContacts = res?.contacts || [];
          renderModalContactGrid(modalContactSearch?.value || '');
        }).catch(() => {
          if (modalContactList) modalContactList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
        });
      } else if (modalPicker.style.display === 'block') {
        renderModalContactGrid(modalContactSearch?.value || '');
      }
      if (modalContactSearch) modalContactSearch.focus();
    }

    function renderModalContactGrid(filter: string) {
      if (!modalContactList) return;
      const list = filter
        ? modalContacts.filter(
            (c) =>
              (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
              (c.role || '').toLowerCase().includes(filter.toLowerCase())
          )
        : modalContacts;
      if (modalContacts.length === 0) {
        modalContactList.innerHTML = '<div class="empty-state">Loading...</div>';
        return;
      }
      if (list.length === 0) {
        modalContactList.innerHTML = '<div class="empty-state">No contacts match</div>';
        return;
      }
      const currentMadeBy = (madeByInput?.value || '').trim();
      modalContactList.innerHTML = list
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
      modalContactList.querySelectorAll('.contact-card-picker').forEach((card) => {
        on(card as HTMLElement, 'click', () => {
          const name = card.getAttribute('data-contact-name') || '';
          if (name) {
            renderMadeByDisplay(name);
            if (modalPicker) modalPicker.style.display = 'none';
          }
        });
      });
    }

    contactsService.getAll().then((res) => {
      modalContacts = res?.contacts || [];
      renderMadeByDisplay(decision?.madeBy || '');
    }).catch(() => {
      renderMadeByDisplay(decision?.madeBy || '');
    });

    if (modalContactSearch) {
      modalContactSearch.addEventListener('input', () => renderModalContactGrid(modalContactSearch.value));
    }
  }

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  if (isView && decision) {
    // Quick status change buttons for proposed decisions
    if (decision.status === 'proposed') {
      const approveBtn = createElement('button', {
        className: 'btn btn-success',
        textContent: 'Approve',
      });

      const rejectBtn = createElement('button', {
        className: 'btn btn-danger',
        textContent: 'Reject',
      });

      on(approveBtn, 'click', () => updateStatus(String(decision.id), 'approved', onSave));
      on(rejectBtn, 'click', () => updateStatus(String(decision.id), 'rejected', onSave));

      footer.appendChild(rejectBtn);
      footer.appendChild(approveBtn);
    }

    const editBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Edit',
    });

    const closeBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Close',
    });

    on(closeBtn, 'click', () => closeModal(MODAL_ID));
    on(editBtn, 'click', () => {
      closeModal(MODAL_ID);
      showDecisionModal({ ...props, mode: 'edit' });
    });

    footer.appendChild(closeBtn);
    footer.appendChild(editBtn);
  } else {
    const cancelBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Cancel',
    });

    const saveBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: isEdit ? 'Save Changes' : 'Create Decision',
    });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));

    on(saveBtn, 'click', async () => {
      const form = content.querySelector('#decision-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const getValue = (id: string) => (content.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value.trim() || '';

      const decisionData: Decision & { impact?: string; summary?: string } = {
        id: decision?.id || `dec-${Date.now()}`,
        decision: getValue('decision-text'),
        rationale: getValue('decision-rationale') || undefined,
        status: getValue('decision-status') as Decision['status'],
        madeBy: getValue('decision-by') || undefined,
        madeAt: decision?.madeAt || new Date().toISOString(),
        impact: getValue('decision-impact') as 'low' | 'medium' | 'high' || undefined,
        summary: getValue('decision-summary') || undefined,
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const apiPayload = {
        content: decisionData.decision,
        decision: decisionData.decision,
        rationale: decisionData.rationale,
        status: decisionData.status,
        made_by: decisionData.madeBy,
        impact: decisionData.impact,
        summary: decisionData.summary,
      };
      try {
        if (isEdit) {
          await http.put(`/api/decisions/${decision!.id}`, apiPayload);
          toast.success('Decision updated');
        } else {
          const response = await http.post<{ id: string }>('/api/decisions', apiPayload);
          decisionData.id = response.data.id;
          toast.success('Decision recorded');
        }

        onSave?.(decisionData);
        closeModal(MODAL_ID);
      } catch {
        // Error shown by API service
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Decision';
      }
    });

    if (isEdit) {
      const deleteBtn = createElement('button', {
        className: 'btn btn-danger',
        textContent: 'Delete',
      });

      on(deleteBtn, 'click', async () => {
        const { confirm } = await import('../Modal');
        const confirmed = await confirm(
          'Are you sure you want to delete this decision?',
          {
            title: 'Delete Decision',
            confirmText: 'Delete',
            confirmClass: 'btn-danger',
          }
        );

        if (confirmed) {
          try {
            await http.delete(`/api/decisions/${decision!.id}`);
            toast.success('Decision deleted');
            onDelete?.(String(decision!.id));
            closeModal(MODAL_ID);
          } catch {
            // Error shown by API service
          }
        }
      });

      footer.appendChild(deleteBtn);
    }

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
  }

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: isView ? 'Decision Details' : (isEdit ? 'Edit Decision' : 'Record Decision'),
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Update decision status
 */
async function updateStatus(
  decisionId: string,
  status: Decision['status'],
  onSave?: (decision: Decision) => void
): Promise<void> {
  try {
    await http.patch(`/api/decisions/${decisionId}`, { status });
    toast.success(`Decision ${status}`);
    closeModal(MODAL_ID);
    // Note: In a real app, we'd update the local state here
  } catch {
    // Error shown by API service
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showDecisionModal;
