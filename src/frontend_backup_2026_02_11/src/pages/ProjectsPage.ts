/**
 * Projects full-page view: list of projects + inline create/edit form (no modal).
 * Mounted when user opens the Projects tab.
 */

import { projects } from '@services';
import { showProjectModal, type ProjectData } from '@components/modals/ProjectModal';
import { appStore } from '@stores/app';

export interface ProjectsPageOptions {
  onBack?: () => void;
}

/**
 * Mount projects list and inline form into the given container.
 */
export function initProjectsPage(container: HTMLElement, options: ProjectsPageOptions = {}): void {
  container.innerHTML = '';
  const listEl = document.createElement('div');
  listEl.className = 'projects-page-list';
  const formContainer = document.createElement('div');
  formContainer.className = 'projects-page-form-container hidden';
  formContainer.setAttribute('aria-hidden', 'true');

  function showList(): void {
    formContainer.classList.add('hidden');
    formContainer.setAttribute('aria-hidden', 'true');
    formContainer.innerHTML = '';
    listEl.classList.remove('hidden');
    listEl.removeAttribute('aria-hidden');
    renderList();
  }

  function showForm(mode: 'create' | 'edit', project?: ProjectData): void {
    listEl.classList.add('hidden');
    listEl.setAttribute('aria-hidden', 'true');
    formContainer.classList.remove('hidden');
    formContainer.setAttribute('aria-hidden', 'false');
    showProjectModal({
      mode,
      project,
      inlineContainer: formContainer,
      onCancel: showList,
      onSave: () => {
        renderList();
        showList();
        window.dispatchEvent(new CustomEvent('godmode:projects-changed'));
      },
      onDelete: () => {
        renderList();
        showList();
        window.dispatchEvent(new CustomEvent('godmode:projects-changed'));
      },
    });
  }

  function renderList(): void {
    projects.getAll().then((projectList) => {
      const currentId = appStore.getState().currentProjectId;
      listEl.innerHTML = `
        <div class="tab-header" style="margin-bottom: 1.5rem;">
          <h1>Projects</h1>
          <div class="tab-actions">
            <button type="button" class="btn btn-primary" id="projects-new-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Project
            </button>
            ${options.onBack ? `<button type="button" class="btn btn-secondary" id="projects-back-btn">Back to Dashboard</button>` : ''}
          </div>
        </div>
        <div class="projects-list" role="list">
          ${projectList.length === 0
          ? '<div class="gm-empty-state gm-p-6"><p class="gm-empty-state-desc">No projects yet. Create one to get started.</p></div>'
          : projectList
            .map(
              (p) => `
            <div class="project-list-item card" data-project-id="${p.id}" role="listitem">
              <div class="project-list-item-main">
                <div class="project-list-item-info">
                  <h3 class="project-list-item-name">${escapeHtml(p.name)}${p.isDefault ? ' <span class="project-badge-default">default</span>' : ''}</h3>
                  <p class="project-list-item-meta">${p.id}</p>
                </div>
                <div class="project-list-item-actions">
                  ${currentId === p.id ? '<span class="project-current-badge">Current</span>' : ''}
                  <button type="button" class="btn btn-secondary btn-sm project-edit-btn" data-project-id="${p.id}" aria-label="Edit project">Edit</button>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;

      const newBtn = listEl.querySelector('#projects-new-btn');
      if (newBtn) {
        newBtn.addEventListener('click', () => showForm('create'));
      }
      const backBtn = listEl.querySelector('#projects-back-btn');
      if (backBtn && options.onBack) {
        backBtn.addEventListener('click', options.onBack);
      }
      listEl.querySelectorAll('.project-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.projectId;
          const project = projectList.find((p) => p.id === id);
          if (project) {
            showForm('edit', { id: project.id, name: project.name } as ProjectData);
          }
        });
      });
    });
  }

  container.appendChild(listEl);
  container.appendChild(formContainer);

  const win = window as unknown as { __godmodeProjectsOpen?: string };
  const openAction = win.__godmodeProjectsOpen;
  if (openAction) {
    delete win.__godmodeProjectsOpen;
    if (openAction === 'create') {
      showForm('create');
      return;
    }
    if (openAction.startsWith('edit:')) {
      const id = openAction.slice(5);
      projects.getAll().then((projectList) => {
        const project = projectList.find((p) => p.id === id);
        if (project) showForm('edit', { id: project.id, name: project.name } as ProjectData);
        else renderList();
      });
      return;
    }
  }

  renderList();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
