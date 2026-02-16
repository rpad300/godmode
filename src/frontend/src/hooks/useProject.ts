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
