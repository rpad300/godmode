/**
 * Risk Modal Component
 * Create, view and edit risks
 */

import { createElement, on } from '@lib/dom';
import { createModal, openModal, closeModal } from '@components/Modal';
import { Risk } from '@stores/data';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';
import { risksService } from '@services/risks';

const MODAL_ID = 'risk-modal';

export interface RiskModalProps {
  mode: 'view' | 'edit' | 'create';
  risk?: Risk;
  onSave?: (risk: Risk) => void;
  onDelete?: (riskId: string) => void;
}

/**
 * Show risk modal
 */
export function showRiskModal(props: RiskModalProps): void {
  const { mode, risk, onSave, onDelete } = props;
  const isEdit = mode === 'edit' && risk?.id;
  const isView = mode === 'view';

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'risk-modal-content' });

  const riskDesc = risk?.description ?? (risk as { content?: string })?.content ?? '';
  const riskProb = risk?.probability ?? (risk as { likelihood?: string })?.likelihood ?? 'medium';
  const riskCreated = risk?.createdAt ?? (risk as { created_at?: string })?.created_at ?? '';

  if (isView && risk) {
    content.innerHTML = `
      <div class="risk-view">
        <div class="risk-meta">
          <span class="impact-badge impact-${risk.impact}">${risk.impact} impact</span>
          <span class="probability-badge">${riskProb} probability</span>
          <span class="status-badge ${risk.status}">${risk.status}</span>
        </div>
        
        <div class="risk-description-large">
          ${escapeHtml(riskDesc)}
        </div>
        
        ${risk.mitigation ? `
          <div class="risk-mitigation-section">
            <h4>Mitigation Strategy</h4>
            <p>${escapeHtml(risk.mitigation)}</p>
          </div>
        ` : ''}
        
        <div class="risk-date">Created ${formatRelativeTime(riskCreated)}</div>
      </div>
    `;
  } else {
    const riskOwner = risk?.owner ?? '';
    content.innerHTML = `
      <form id="risk-form" class="risk-form">
        <div class="form-group gm-flex gm-flex-center gm-gap-3 gm-flex-wrap">
          <label for="risk-description" class="gm-mb-0">Risk Description *</label>
          <button type="button" class="btn btn-secondary btn-sm" id="risk-ai-suggest-btn" title="Suggest owner and mitigation from description">✨ AI suggest</button>
        </div>
        <div class="form-group">
          <textarea id="risk-description" rows="3" required 
                    placeholder="Describe the risk...">${riskDesc}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="risk-impact">Impact</label>
            <select id="risk-impact">
              <option value="low" ${risk?.impact === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${risk?.impact === 'medium' || !risk ? 'selected' : ''}>Medium</option>
              <option value="high" ${risk?.impact === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="risk-probability">Probability</label>
            <select id="risk-probability">
              <option value="low" ${riskProb === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${riskProb === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${riskProb === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="risk-status">Status</label>
          <select id="risk-status">
            <option value="open" ${risk?.status === 'open' || !risk ? 'selected' : ''}>Open</option>
            <option value="mitigating" ${risk?.status === 'mitigating' ? 'selected' : ''}>Mitigating</option>
            <option value="mitigated" ${risk?.status === 'mitigated' ? 'selected' : ''}>Mitigated</option>
            <option value="accepted" ${risk?.status === 'accepted' ? 'selected' : ''}>Accepted</option>
            <option value="closed" ${risk?.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="risk-owner">Owner</label>
          <input type="text" id="risk-owner" class="form-input" placeholder="Who owns this risk?" value="${escapeHtml(riskOwner)}">
        </div>
        
        <div class="form-group">
          <label for="risk-mitigation">Mitigation Strategy</label>
          <textarea id="risk-mitigation" rows="3" 
                    placeholder="How will this risk be mitigated?">${risk?.mitigation || ''}</textarea>
        </div>
      </form>
    `;

    const suggestBtn = content.querySelector('#risk-ai-suggest-btn');
    if (suggestBtn) {
      on(suggestBtn as HTMLElement, 'click', async () => {
        const descEl = content.querySelector('#risk-description') as HTMLTextAreaElement;
        const impactEl = content.querySelector('#risk-impact') as HTMLSelectElement;
        const probEl = content.querySelector('#risk-probability') as HTMLSelectElement;
        const contentText = descEl?.value?.trim() || '';
        if (!contentText) {
          toast.error('Enter a risk description first');
          return;
        }
        (suggestBtn as HTMLButtonElement).disabled = true;
        (suggestBtn as HTMLButtonElement).textContent = '…';
        try {
          const result = await risksService.suggest({
            content: contentText,
            impact: impactEl?.value || 'medium',
            likelihood: probEl?.value || 'medium',
          });
          const ownerEl = content.querySelector('#risk-owner') as HTMLInputElement;
          const mitigationEl = content.querySelector('#risk-mitigation') as HTMLTextAreaElement;
          if (ownerEl && result.suggested_owner) ownerEl.value = result.suggested_owner;
          if (mitigationEl && result.suggested_mitigation) mitigationEl.value = result.suggested_mitigation;
          toast.success('Owner and mitigation suggested');
        } catch (e) {
          toast.error((e as Error).message || 'AI suggest failed');
        } finally {
          (suggestBtn as HTMLButtonElement).disabled = false;
          (suggestBtn as HTMLButtonElement).textContent = '✨ AI suggest';
        }
      });
    }
  }

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  if (isView) {
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
      showRiskModal({ ...props, mode: 'edit' });
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
      textContent: isEdit ? 'Save Changes' : 'Create Risk',
    });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));

    on(saveBtn, 'click', async () => {
      const form = content.querySelector('#risk-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const getValue = (id: string) => (content.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value.trim() || '';

      const desc = getValue('risk-description');
      const owner = getValue('risk-owner') || undefined;
      const riskData: Risk & { content?: string; likelihood?: string; owner?: string } = {
        id: risk?.id || `risk-${Date.now()}`,
        description: desc,
        content: desc,
        impact: getValue('risk-impact') as Risk['impact'],
        probability: getValue('risk-probability') as Risk['probability'],
        likelihood: getValue('risk-probability') as 'low' | 'medium' | 'high',
        status: getValue('risk-status') as Risk['status'],
        mitigation: getValue('risk-mitigation') || undefined,
        owner,
        createdAt: risk?.createdAt ?? (risk as { created_at?: string })?.created_at ?? new Date().toISOString(),
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        if (isEdit) {
          await http.put(`/api/risks/${risk!.id}`, { content: riskData.content ?? riskData.description, impact: riskData.impact, likelihood: riskData.likelihood ?? riskData.probability, mitigation: riskData.mitigation, status: riskData.status, owner: riskData.owner });
          toast.success('Risk updated');
        } else {
          const response = await http.post<{ id: string; risk: Risk }>('/api/risks', { content: riskData.content ?? riskData.description, impact: riskData.impact, likelihood: riskData.likelihood ?? riskData.probability, mitigation: riskData.mitigation, status: riskData.status, owner: riskData.owner });
          const created = response.data.risk;
          if (created) riskData.id = created.id as string;
          else riskData.id = response.data.id as string;
          toast.success('Risk created');
        }

        onSave?.({ ...riskData, description: riskData.description ?? riskData.content, content: riskData.content ?? riskData.description } as Risk);
        closeModal(MODAL_ID);
      } catch {
        // Error shown by API service
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Risk';
      }
    });

    if (isEdit) {
      const deleteBtn = createElement('button', {
        className: 'btn btn-danger',
        textContent: 'Delete',
      });

      on(deleteBtn, 'click', async () => {
        const { confirm } = await import('@components/Modal');
        const confirmed = await confirm(
          'Are you sure you want to delete this risk?',
          {
            title: 'Delete Risk',
            confirmText: 'Delete',
            confirmClass: 'btn-danger',
          }
        );

        if (confirmed) {
          try {
            await http.delete(`/api/risks/${risk!.id}`);
            toast.success('Risk deleted');
            onDelete?.(String(risk!.id));
            closeModal(MODAL_ID);
          } catch {
            // Error shown by API service
          }
        }
      });

      footer.appendChild(saveBtn);
      footer.appendChild(cancelBtn);
      footer.appendChild(deleteBtn);
    } else {
      footer.appendChild(saveBtn);
      footer.appendChild(cancelBtn);
    }
  }

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: isView ? 'Risk Details' : (isEdit ? 'Edit Risk' : 'New Risk'),
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showRiskModal;
