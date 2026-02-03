/**
 * Project Selector Component
 * Dropdown for selecting and managing projects
 */

import { createElement, on } from '../utils/dom';
import { appStore } from '../stores/app';
import { dataStore } from '../stores/data';
import { projects } from '../services/projects';
import { toast } from '../services/toast';
import { showProjectModal } from './modals/ProjectModal';

export interface ProjectSelectorOptions {
  containerId?: string;
  onProjectChange?: (projectId: string) => void;
}

/**
 * Initialize project selector
 */
export function initProjectSelector(options: ProjectSelectorOptions = {}): void {
  const container = options.containerId 
    ? document.getElementById(options.containerId)
    : document.getElementById('project-selector-container');

  if (!container) return;

  // Create selector HTML
  container.innerHTML = `
    <div class="project-selector-wrapper">
      <select id="project-selector" class="project-selector">
        <option value="">Select Project...</option>
      </select>
      <button id="new-project-btn" class="btn-icon" title="Create new project">+</button>
      <button id="edit-project-btn" class="btn-icon" title="Edit project" style="display: none;">✏️</button>
    </div>
  `;

  const selector = container.querySelector('#project-selector') as HTMLSelectElement;
  const newBtn = container.querySelector('#new-project-btn') as HTMLButtonElement;
  const editBtn = container.querySelector('#edit-project-btn') as HTMLButtonElement;

  // Load and populate projects
  loadProjectsIntoSelector(selector);

  // Handle selection change
  on(selector, 'change', async () => {
    const projectId = selector.value;
    if (projectId) {
      await selectProject(projectId, options.onProjectChange);
      editBtn.style.display = '';
    } else {
      editBtn.style.display = 'none';
    }
  });

  // New project button
  on(newBtn, 'click', () => {
    showProjectModal({
      mode: 'create',
      onSave: async (project) => {
        await loadProjectsIntoSelector(selector);
        if (project.id) {
          selector.value = project.id;
          editBtn.style.display = '';
          options.onProjectChange?.(project.id);
        }
      },
    });
  });

  // Edit project button
  on(editBtn, 'click', () => {
    const currentProject = appStore.getState().currentProject;
    if (currentProject) {
      showProjectModal({
        mode: 'edit',
        project: currentProject,
        onSave: async () => {
          await loadProjectsIntoSelector(selector);
        },
        onDelete: async () => {
          await loadProjectsIntoSelector(selector);
          editBtn.style.display = 'none';
        },
      });
    }
  });

  // Subscribe to store changes
  dataStore.subscribe((state) => {
    updateSelectorOptions(selector, state.projects);
  });

  appStore.subscribe((state) => {
    if (state.currentProjectId && selector.value !== state.currentProjectId) {
      selector.value = state.currentProjectId;
      editBtn.style.display = '';
    }
  });
}

/**
 * Load projects into selector
 */
async function loadProjectsIntoSelector(selector: HTMLSelectElement): Promise<void> {
  const projectList = await projects.getAll();
  updateSelectorOptions(selector, projectList);

  // Set current project if any
  const currentProjectId = appStore.getState().currentProjectId;
  if (currentProjectId) {
    selector.value = currentProjectId;
  }
}

/**
 * Update selector options
 */
function updateSelectorOptions(
  selector: HTMLSelectElement, 
  projectList: Array<{ id: string; name: string; isDefault?: boolean }>
): void {
  const currentValue = selector.value;
  
  selector.innerHTML = '<option value="">Select Project...</option>';
  
  projectList.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name + (project.isDefault ? ' (default)' : '');
    selector.appendChild(option);
  });

  // Restore selection if possible
  if (currentValue && projectList.some(p => p.id === currentValue)) {
    selector.value = currentValue;
  }
}

/**
 * Select a project
 */
async function selectProject(
  projectId: string, 
  onChange?: (projectId: string) => void
): Promise<void> {
  try {
    const project = await projects.activate(projectId);
    if (project) {
      toast.success(`Switched to: ${project.name}`);
      onChange?.(projectId);
    }
  } catch {
    toast.error('Failed to switch project');
  }
}

/**
 * Create standalone project selector element
 */
export function createProjectSelector(options: ProjectSelectorOptions = {}): HTMLElement {
  const wrapper = createElement('div', { className: 'project-selector-wrapper' });
  
  const selector = createElement('select', { 
    className: 'project-selector',
    id: 'project-selector',
  }) as HTMLSelectElement;
  
  const defaultOption = createElement('option', { 
    textContent: 'Select Project...',
  }) as HTMLOptionElement;
  defaultOption.value = '';
  selector.appendChild(defaultOption);

  const newBtn = createElement('button', {
    className: 'btn-icon',
    textContent: '+',
    title: 'Create new project',
  });

  wrapper.appendChild(selector);
  wrapper.appendChild(newBtn);

  // Load projects
  projects.getAll().then(projectList => {
    updateSelectorOptions(selector, projectList);
    const currentProjectId = appStore.getState().currentProjectId;
    if (currentProjectId) {
      selector.value = currentProjectId;
    }
  });

  // Bind events
  on(selector, 'change', async () => {
    const projectId = selector.value;
    if (projectId) {
      await selectProject(projectId, options.onProjectChange);
    }
  });

  on(newBtn, 'click', () => {
    showProjectModal({
      mode: 'create',
      onSave: async (project) => {
        const projectList = await projects.getAll();
        updateSelectorOptions(selector, projectList);
        if (project.id) {
          selector.value = project.id;
          options.onProjectChange?.(project.id);
        }
      },
    });
  });

  return wrapper;
}

export default initProjectSelector;
