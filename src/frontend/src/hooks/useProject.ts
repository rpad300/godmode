/**
 * Purpose:
 *   Lightweight hook for selecting and persisting the active project.
 *   Synchronises the selection with both localStorage and the api-client
 *   module-level header so all subsequent API calls include the project context.
 *
 * Responsibilities:
 *   - Read initial projectId from localStorage ('godmode-project-id')
 *   - Expose setProjectId to change selection (updates localStorage + api-client)
 *   - Derive currentProject from the projects list fetched via useProjects
 *
 * Key dependencies:
 *   - lib/api-client (setCurrentProjectId): sets X-Project-Id header
 *   - useProjects (useGodMode): fetches the project list from the server
 *
 * Side effects:
 *   - Reads/writes localStorage key 'godmode-project-id'
 *   - Calls setCurrentProjectId on mount and on every change
 *
 * Notes:
 *   - This hook duplicates some responsibility with ProjectContext. Assumption:
 *     it is used in contexts where the full ProjectProvider is not available
 *     or where a simpler API is preferred.
 *
 * @returns {{ projectId, setProjectId, projects, currentProject }}
 */
import { useState, useCallback, useEffect } from 'react';
import { setCurrentProjectId } from '../lib/api-client';
import { useProjects } from './useGodMode';

export function useProject() {
  const [projectId, setProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('godmode-project-id');
    } catch {
      return null;
    }
  });

  const { data: projects = [] } = useProjects();

  const setProjectId = useCallback((id: string | null) => {
    setProjectIdState(id);
    setCurrentProjectId(id);
    try {
      if (id) {
        localStorage.setItem('godmode-project-id', id);
      } else {
        localStorage.removeItem('godmode-project-id');
      }
    } catch {}
  }, []);

  // Sync API client on mount
  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId]);

  const currentProject = projects.find((p) => p.id === projectId) ?? null;

  return { projectId, setProjectId, projects, currentProject };
}
