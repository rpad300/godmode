/**
 * Projects Service
 * Handles project CRUD operations and state
 */

import { http, fetchWithProject } from './api';
import { appStore, Project } from '../stores/app';
import { dataStore } from '../stores/data';
import { toast } from './toast';

// Types
export interface ProjectListItem {
  id: string;
  name: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  userRole?: string;
  userRolePrompt?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  userRole?: string;
  userRolePrompt?: string;
  isDefault?: boolean;
}

export interface ProjectStats {
  members?: number;
  comments?: number;
  recentActivity?: number;
  facts?: number;
  questions?: number;
  documents?: number;
  decisions?: number;
  risks?: number;
  actions?: number;
  people?: number;
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<ProjectListItem[]> {
  try {
    const response = await http.get<{ projects: ProjectListItem[] }>('/api/projects');
    const projects = response.data.projects || [];
    dataStore.setProjects(projects);
    return projects;
  } catch {
    return [];
  }
}

/**
 * Get current/active project
 */
export async function getCurrentProject(): Promise<Project | null> {
  try {
    const response = await http.get<{ project: Project }>('/api/projects/current');
    const project = response.data.project;
    if (project) {
      appStore.setCurrentProject(project);
      return project;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a new project
 */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await http.post<{ id: string; name?: string }>('/api/projects', data);
  
  const project: Project = {
    id: response.data.id,
    name: data.name,
    description: data.description,
  };

  // Refresh projects list
  await getProjects();
  
  return project;
}

/**
 * Update a project
 */
export async function updateProject(id: string, data: UpdateProjectRequest): Promise<void> {
  await http.put(`/api/projects/${id}`, data);

  // Update local state if it's the current project
  const currentProject = appStore.getState().currentProject;
  if (currentProject?.id === id) {
    appStore.setCurrentProject({
      ...currentProject,
      ...data,
    });
  }

  // Refresh projects list
  await getProjects();
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  await http.delete(`/api/projects/${id}`);

  // Clear current project if it was deleted
  if (appStore.getState().currentProjectId === id) {
    appStore.setCurrentProject(null);
  }

  // Refresh projects list
  await getProjects();
}

/**
 * Activate/switch to a project
 */
export async function activateProject(id: string): Promise<Project | null> {
  try {
    await http.put(`/api/projects/${id}/activate`);
    
    // Get the full project info
    const project = await getCurrentProject();
    return project;
  } catch {
    return null;
  }
}

/**
 * Set a project as default
 */
export async function setDefaultProject(id: string): Promise<void> {
  await http.post(`/api/projects/${id}/set-default`);
  await getProjects();
}

/**
 * Get project statistics
 */
export async function getProjectStats(id: string): Promise<ProjectStats> {
  try {
    const response = await http.get<{ stats: ProjectStats }>(`/api/projects/${id}/stats`);
    return response.data.stats || {};
  } catch {
    return {};
  }
}

/**
 * Export project data
 */
export async function exportProject(id: string): Promise<Blob> {
  const response = await fetchWithProject(`/api/projects/${id}/export`);
  if (!response.ok) {
    throw new Error('Failed to export project');
  }
  return response.blob();
}

/**
 * Import project data
 */
export async function importProject(file: File): Promise<Project> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchWithProject('/api/projects/import', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(error.error || 'Import failed');
  }

  const data = await response.json();
  await getProjects();
  
  return data.project;
}

/**
 * Initialize projects - load list and set current
 */
export async function initProjects(): Promise<void> {
  // Load all projects
  await getProjects();

  // Try to get current project from server
  const current = await getCurrentProject();
  
  // If no current project, try to find default or first project
  if (!current) {
    const projects = dataStore.getState().projects;
    if (projects.length > 0) {
      const defaultProject = projects.find(p => (p as { isDefault?: boolean }).isDefault) || projects[0];
      await activateProject(defaultProject.id);
    }
  }
}

// Export as namespace
export const projects = {
  getAll: getProjects,
  getCurrent: getCurrentProject,
  create: createProject,
  update: updateProject,
  delete: deleteProject,
  activate: activateProject,
  setDefault: setDefaultProject,
  getStats: getProjectStats,
  export: exportProject,
  import: importProject,
  init: initProjects,
};
