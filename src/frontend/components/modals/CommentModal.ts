/**
 * Comment Modal Component
 * Add and view comments on entities
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { appStore } from '../../stores/app';
import { http } from '../../services/api';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

const MODAL_ID = 'comment-modal';

export interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt?: string;
  edited?: boolean;
  replies?: Comment[];
}

export interface CommentModalProps {
  entityType: string;
  entityId: string;
  entityName?: string;
  onCommentAdded?: (comment: Comment) => void;
}

let comments: Comment[] = [];

/**
 * Show comment modal
 */
export async function showCommentModal(props: CommentModalProps): Promise<void> {
  const { entityType, entityId, entityName, onCommentAdded } = props;

  comments = [];

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'comment-modal-content' });
  content.innerHTML = '<div class="loading">Loading comments...</div>';

  // Footer with comment input
  const footer = createElement('div', { className: 'modal-footer comment-footer' });
  footer.innerHTML = `
    <div class="comment-input-wrapper">
      <textarea id="comment-input" placeholder="Write a comment..." rows="2"></textarea>
      <button id="submit-comment" class="btn btn-primary">Post</button>
    </div>
  `;

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: entityName ? `Comments on "${entityName}"` : 'Comments',
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Bind submit
  const submitBtn = footer.querySelector('#submit-comment') as HTMLButtonElement;
  const input = footer.querySelector('#comment-input') as HTMLTextAreaElement;

  on(submitBtn, 'click', async () => {
    const text = input.value.trim();
    if (!text) {
      toast.warning('Please write a comment');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
      const response = await http.post<Comment>(`/api/${entityType}/${entityId}/comments`, {
        content: text,
      });

      comments.unshift(response.data);
      input.value = '';
      render(content, props);
      onCommentAdded?.(response.data);
      toast.success('Comment added');
    } catch {
      // Error shown by API service
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post';
    }
  });

  // Ctrl+Enter to submit
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitBtn.click();
    }
  });

  // Load comments
  try {
    const response = await http.get<Comment[]>(`/api/${entityType}/${entityId}/comments`);
    comments = response.data;
    render(content, props);
  } catch {
    content.innerHTML = '<div class="error">Failed to load comments</div>';
  }
}

/**
 * Render comments
 */
function render(container: HTMLElement, props: CommentModalProps): void {
  if (comments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">💬</span>
        <p>No comments yet</p>
        <p class="text-muted">Be the first to comment!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="comments-list">
      ${comments.map(c => renderComment(c, props)).join('')}
    </div>
  `;

  // Bind actions
  bindCommentActions(container, props);
}

/**
 * Render single comment
 */
function renderComment(comment: Comment, props: CommentModalProps, depth = 0): string {
  const currentUser = appStore.getState().currentUser;
  const isAuthor = currentUser?.id === comment.author.id;
  const initials = comment.author.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return `
    <div class="comment ${depth > 0 ? 'reply' : ''}" data-comment-id="${comment.id}" style="margin-left: ${depth * 20}px">
      <div class="comment-avatar">
        ${comment.author.avatar 
          ? `<img src="${comment.author.avatar}" alt="${escapeHtml(comment.author.name)}">`
          : initials
        }
      </div>
      <div class="comment-body">
        <div class="comment-header">
          <strong class="comment-author">${escapeHtml(comment.author.name)}</strong>
          <span class="comment-time">${formatRelativeTime(comment.createdAt)}</span>
          ${comment.edited ? '<span class="comment-edited">(edited)</span>' : ''}
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
        <div class="comment-actions">
          <button class="btn-link" data-action="reply" data-comment-id="${comment.id}">Reply</button>
          ${isAuthor ? `
            <button class="btn-link" data-action="edit" data-comment-id="${comment.id}">Edit</button>
            <button class="btn-link text-danger" data-action="delete" data-comment-id="${comment.id}">Delete</button>
          ` : ''}
        </div>
      </div>
    </div>
    ${comment.replies?.map(r => renderComment(r, props, depth + 1)).join('') || ''}
  `;
}

/**
 * Bind comment action handlers
 */
function bindCommentActions(container: HTMLElement, props: CommentModalProps): void {
  container.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.getAttribute('data-action');
    const commentId = btn.getAttribute('data-comment-id');

    on(btn as HTMLElement, 'click', async () => {
      const comment = findComment(comments, commentId!);
      if (!comment) return;

      switch (action) {
        case 'reply':
          // Show reply input
          const replyContainer = btn.closest('.comment')?.querySelector('.comment-body');
          if (replyContainer && !replyContainer.querySelector('.reply-input')) {
            const replyInput = createElement('div', { className: 'reply-input' });
            replyInput.innerHTML = `
              <textarea placeholder="Write a reply..." rows="2"></textarea>
              <div class="reply-actions">
                <button class="btn btn-sm btn-secondary cancel-reply">Cancel</button>
                <button class="btn btn-sm btn-primary submit-reply">Reply</button>
              </div>
            `;

            replyContainer.appendChild(replyInput);

            const cancelBtn = replyInput.querySelector('.cancel-reply');
            const submitBtn = replyInput.querySelector('.submit-reply');
            const textarea = replyInput.querySelector('textarea') as HTMLTextAreaElement;

            on(cancelBtn as HTMLElement, 'click', () => replyInput.remove());
            on(submitBtn as HTMLElement, 'click', async () => {
              const text = textarea.value.trim();
              if (!text) return;

              try {
                const response = await http.post<Comment>(
                  `/api/${props.entityType}/${props.entityId}/comments/${commentId}/replies`,
                  { content: text }
                );

                if (!comment.replies) comment.replies = [];
                comment.replies.push(response.data);
                render(container, props);
              } catch {
                // Error shown by API service
              }
            });

            textarea.focus();
          }
          break;

        case 'edit':
          // Inline edit
          const contentEl = btn.closest('.comment')?.querySelector('.comment-content');
          if (contentEl) {
            const originalText = comment.content;
            contentEl.innerHTML = `
              <textarea class="edit-textarea">${escapeHtml(originalText)}</textarea>
              <div class="edit-actions">
                <button class="btn btn-sm btn-secondary cancel-edit">Cancel</button>
                <button class="btn btn-sm btn-primary save-edit">Save</button>
              </div>
            `;

            const textarea = contentEl.querySelector('textarea') as HTMLTextAreaElement;
            const cancelBtn = contentEl.querySelector('.cancel-edit');
            const saveBtn = contentEl.querySelector('.save-edit');

            on(cancelBtn as HTMLElement, 'click', () => {
              contentEl.textContent = originalText;
            });

            on(saveBtn as HTMLElement, 'click', async () => {
              const newText = textarea.value.trim();
              if (!newText) return;

              try {
                await http.patch(
                  `/api/${props.entityType}/${props.entityId}/comments/${commentId}`,
                  { content: newText }
                );
                comment.content = newText;
                comment.edited = true;
                render(container, props);
              } catch {
                // Error shown by API service
              }
            });

            textarea.focus();
          }
          break;

        case 'delete':
          const { confirm } = await import('../Modal');
          const confirmed = await confirm('Delete this comment?', {
            title: 'Delete Comment',
            confirmText: 'Delete',
            confirmClass: 'btn-danger',
          });

          if (confirmed) {
            try {
              await http.delete(
                `/api/${props.entityType}/${props.entityId}/comments/${commentId}`
              );
              removeComment(comments, commentId!);
              render(container, props);
              toast.success('Comment deleted');
            } catch {
              // Error shown by API service
            }
          }
          break;
      }
    });
  });
}

/**
 * Find comment by ID (recursive)
 */
function findComment(list: Comment[], id: string): Comment | undefined {
  for (const comment of list) {
    if (comment.id === id) return comment;
    if (comment.replies) {
      const found = findComment(comment.replies, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Remove comment by ID (recursive)
 */
function removeComment(list: Comment[], id: string): boolean {
  const index = list.findIndex(c => c.id === id);
  if (index !== -1) {
    list.splice(index, 1);
    return true;
  }

  for (const comment of list) {
    if (comment.replies && removeComment(comment.replies, id)) {
      return true;
    }
  }
  return false;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showCommentModal;
