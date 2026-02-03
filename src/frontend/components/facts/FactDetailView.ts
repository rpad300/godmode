/**
 * Fact Detail View
 * Full-page view for fact details: content, category, confidence, source, verified, document link
 */

import { createElement, on } from '../../utils/dom';
import { Fact, factsService } from '../../services/facts';
import { toast } from '../../services/toast';
import { formatRelativeTime, formatDateTime } from '../../utils/format';

export interface FactDetailViewProps {
  fact: Fact;
  onClose: () => void;
  onUpdate?: (fact: Fact) => void;
  /** When user clicks a similar fact, open that fact (e.g. replace view) */
  onFactClick?: (fact: Fact) => void;
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

/**
 * Create and show the fact detail view
 */
export function createFactDetailView(props: FactDetailViewProps): HTMLElement {
  const { fact, onClose, onUpdate, onFactClick } = props;

  const container = createElement('div', { className: 'fact-detail-view question-detail-view' });

  container.innerHTML = `
    <div class="question-detail-header fact-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Facts</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Fact #${String(fact.id).substring(0, 8)}</span>
      </div>
      <div class="header-actions">
        ${fact.verified ? '<span class="verified-badge detail sla-badge" style="background:var(--success);color:white">✓ Verified</span>' : ''}
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content fact-detail-content">
      <section class="detail-section question-main fact-main">
        <div class="question-badges fact-badges">
          ${fact.category ? `<span class="priority-pill category-${(fact.category || 'general').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(fact.category)}</span>` : ''}
          ${fact.confidence != null ? `<span class="status-pill status-pending">${Math.round((fact.confidence ?? 0) * 100)}%</span>` : ''}
          ${fact.verified ? '<span class="auto-pill">✓ Verified</span>' : ''}
          <span class="question-date fact-date">Created ${formatRelativeTime(fact.created_at)}</span>
        </div>
        <h2 class="question-text fact-content-text">${escapeHtml(fact.content)}</h2>
      </section>

      <div class="detail-columns">
        <div class="detail-column-left">
          <section class="detail-section">
            <div class="section-header">
              <h3>Source</h3>
            </div>
            ${fact.source_file ? `<p class="source-file">${escapeHtml(fact.source_file)}</p>` : ''}
            ${fact.source ? `<p class="source-ref">${escapeHtml(fact.source)}</p>` : ''}
            ${fact.source_document_id ? `
              <p class="source-doc">
                <a href="#" class="doc-link" data-document-id="${escapeHtml(String(fact.source_document_id))}">View source document</a>
              </p>
            ` : ''}
            ${!fact.source && !fact.source_file && !fact.source_document_id ? '<p class="text-muted">No source recorded</p>' : ''}
          </section>

          <section class="detail-section verification-section">
            <div class="section-header">
              <h3>Verification</h3>
            </div>
            ${fact.verified
              ? `
              <div class="verified-info">
                <span class="verified-badge auto-pill">✓ Verified</span>
                ${fact.verified_at ? `<span class="text-muted">on ${formatDate(fact.verified_at)}</span>` : ''}
              </div>
            `
              : `
              <div class="unverified-info">
                <p class="text-muted">This fact has not been verified.</p>
                <button type="button" class="btn btn-success btn-sm" id="verify-fact-btn">Verify</button>
              </div>
            `}
          </section>
        </div>

        <div class="detail-column-right">
          <section class="detail-section metadata-section">
            <div class="section-header">
              <h3>Metadata</h3>
            </div>
            <dl class="metadata-list">
              <dt>Created</dt>
              <dd>${formatDate(fact.created_at)}</dd>
              ${fact.updated_at ? `<dt>Updated</dt><dd>${formatDate(fact.updated_at)}</dd>` : ''}
            </dl>
          </section>

          <section class="detail-section fact-timeline-section">
            <div class="section-header">
              <h3>Timeline</h3>
            </div>
            <div id="fact-timeline-list" class="fact-timeline-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>

          <section class="detail-section fact-similar-section">
            <div class="section-header">
              <h3>Similar facts</h3>
            </div>
            <div id="fact-similar-list" class="fact-similar-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-secondary" id="edit-fact-btn">Edit</button>
        ${!fact.verified ? '<button type="button" class="btn btn-success" id="verify-btn">Verify</button>' : ''}
        <button type="button" class="btn btn-danger" id="delete-fact-btn">Delete</button>
      </div>
    </div>
  `;

  // Back / Close
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

  // Verify (header or section)
  const verifyFactBtn = container.querySelector('#verify-fact-btn');
  if (verifyFactBtn) {
    on(verifyFactBtn as HTMLElement, 'click', async () => {
      try {
        const updated = await factsService.verify(fact.id);
        toast.success('Fact verified');
        if (onUpdate) onUpdate(updated);
        onClose();
      } catch {
        toast.error('Failed to verify fact');
      }
    });
  }
  const verifyBtn = container.querySelector('#verify-btn');
  if (verifyBtn) {
    on(verifyBtn as HTMLElement, 'click', async () => {
      try {
        const updated = await factsService.verify(fact.id);
        toast.success('Fact verified');
        if (onUpdate) onUpdate(updated);
        onClose();
      } catch {
        toast.error('Failed to verify fact');
      }
    });
  }

  // Edit
  const editBtn = container.querySelector('#edit-fact-btn');
  if (editBtn) {
    on(editBtn as HTMLElement, 'click', () => {
      import('../modals/FactModal').then(({ showFactModal }) => {
        showFactModal({
          mode: 'edit',
          fact,
          onSave: (updated) => {
            if (onUpdate) onUpdate(updated);
            onClose();
          },
        });
      });
    });
  }

  // Delete
  const deleteBtn = container.querySelector('#delete-fact-btn');
  if (deleteBtn) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      if (!confirm('Are you sure you want to delete this fact?')) return;
      try {
        await factsService.delete(fact.id);
        toast.success('Fact deleted');
        onClose();
      } catch {
        toast.error('Failed to delete fact');
      }
    });
  }

  // Document link (navigate to files / document preview if implemented)
  const docLink = container.querySelector('.doc-link');
  if (docLink && fact.source_document_id) {
    on(docLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('godmode:navigate', {
        detail: { tab: 'files', documentId: fact.source_document_id }
      }));
    });
  }

  // Load timeline (fact events)
  const timelineEl = container.querySelector('#fact-timeline-list');
  if (timelineEl) {
    factsService.getEvents(fact.id).then((events) => {
      const labels: Record<string, string> = {
        created: 'Created',
        verified: 'Verified',
        updated: 'Updated',
        conflict_detected: 'Conflict detected',
        deleted: 'Deleted',
        restored: 'Restored',
      };
      const actorLabel = (ev: { actor_name?: string; event_data?: { trigger?: string } }) =>
        ev.actor_name || (ev.event_data?.trigger === 'fact_check_flow' ? 'System' : null);
      if (events.length === 0) {
        (timelineEl as HTMLElement).innerHTML = '<span class="text-muted">No events yet</span>';
        return;
      }
      (timelineEl as HTMLElement).innerHTML = events
        .map(
          (ev) => {
            const actor = actorLabel(ev);
            return `<div class="fact-timeline-item fact-event-${escapeHtml(ev.event_type)}">
              <span class="fact-event-type">${escapeHtml(labels[ev.event_type] || ev.event_type)}</span>
              ${actor ? `<span class="fact-event-actor">${escapeHtml(actor)}</span>` : ''}
              <span class="fact-event-date">${formatRelativeTime(ev.created_at)}</span>
            </div>`;
          }
        )
        .join('');
    }).catch(() => {
      (timelineEl as HTMLElement).innerHTML = '<span class="text-muted">Could not load timeline</span>';
    });
  }

  // Load similar facts
  const similarEl = container.querySelector('#fact-similar-list');
  if (similarEl) {
    factsService.getSimilarFacts(fact.id, 10).then((similar) => {
      if (similar.length === 0) {
        (similarEl as HTMLElement).innerHTML = '<span class="text-muted">No similar facts</span>';
        return;
      }
      (similarEl as HTMLElement).innerHTML = similar
        .map(
          (s) => `
            <div class="fact-similar-item" data-fact-id="${s.fact.id}" role="${onFactClick ? 'button' : 'none'}">
              <span class="fact-similar-score">${Math.round(s.similarityScore * 100)}%</span>
              <span class="fact-similar-content">${escapeHtml((s.fact.content || '').substring(0, 80))}${(s.fact.content || '').length > 80 ? '…' : ''}</span>
            </div>
          `
        )
        .join('');
      if (onFactClick) {
        (similarEl as HTMLElement).querySelectorAll('.fact-similar-item').forEach((el) => {
          on(el as HTMLElement, 'click', () => {
            const item = similar.find((s) => String(s.fact.id) === (el as HTMLElement).getAttribute('data-fact-id'));
            if (item) onFactClick(item.fact);
          });
        });
      }
    }).catch(() => {
      (similarEl as HTMLElement).innerHTML = '<span class="text-muted">Could not load similar facts</span>';
    });
  }

  return container;
}
