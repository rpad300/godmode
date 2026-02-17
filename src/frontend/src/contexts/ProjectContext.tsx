/**
 * Purpose:
 *   Manages the list of user-accessible projects and tracks which project is
 *   currently active. Persists the selection across page reloads via localStorage.
 *
 * Responsibilities:
 *   - Fetch projects from /api/projects on mount
 *   - Auto-select a default project when the stored one no longer exists
 *   - Persist currentProjectId to localStorage under 'godmode_current_project'
 *   - Expose setCurrentProject (with toast feedback) and refreshProjects
 *
 * Key dependencies:
 *   - @/lib/api-client: authenticated HTTP requests
 *   - sonner: toast notifications on project switch
 *
 * Side effects:
 *   - Reads/writes localStorage key 'godmode_current_project'
 *   - Fetches /api/projects on mount
 *   - Shows a toast when the user switches projects
 *
 * Notes:
 *   - If the API returns no projects the user stays on 'default' pseudo-project
 *   - The context shape includes both the resolved currentProject object and the raw ID
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Project {
    id: string;
    name: string;
    description?: string;
    company_id?: string;
    role?: string; // Member role
    isDefault?: boolean;
    settings?: any;
}

interface ProjectContextType {
    projects: Project[];
    currentProject: Project | null;
    currentProjectId: string;
    isLoading: boolean;
    setCurrentProject: (projectId: string) => void;
    refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

/**
 * Provides the project list, active project selection, and refresh capability.
 * Fetches projects on mount and auto-selects a default when the stored ID
 * is stale or missing.
 */
export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
        return localStorage.getItem('godmode_current_project') || 'default';
    });
    const [isLoading, setIsLoading] = useState(true);

    const refreshProjects = async () => {
        try {
            setIsLoading(true);
            // Fetch all projects
            // We try /api/projects first (authenticated)
            // If that fails or returns empty, we might be in demo mode or initial setup
            const response = await apiClient.get('/api/projects') as { projects: Project[] };

            let fetchedProjects: Project[] = [];

            if (response && response.projects) {
                fetchedProjects = response.projects;
            } else {
                // Fallback or handle empty state
                console.warn("No projects found or API error");
            }

            setProjects(fetchedProjects);

            // Validate currentProjectId
            if (currentProjectId !== 'default') {
                const exists = fetchedProjects.find(p => p.id === currentProjectId);
                if (!exists && fetchedProjects.length > 0) {
                    // If current project doesn't exist anymore, switch to the first one or default
                    // Prefer one marked as isDefault if available
                    const defaultProj = fetchedProjects.find(p => p.isDefault) || fetchedProjects[0];
                    setCurrentProjectId(defaultProj.id);
                }
            } else if (fetchedProjects.length > 0) {
                // If we are on 'default' but we have real projects, switch to the default real project
                const defaultProj = fetchedProjects.find(p => p.isDefault) || fetchedProjects[0];
                setCurrentProjectId(defaultProj.id);
            }

        } catch (error) {
            console.error('Failed to fetch projects:', error);
            // Don't show toast on initial load to avoid annoyance if it's just auth check
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshProjects();
    }, []);

    useEffect(() => {
        if (currentProjectId) {
            localStorage.setItem('godmode_current_project', currentProjectId);
        }
    }, [currentProjectId]);

    const handleSetProject = (id: string) => {
        setCurrentProjectId(id);
        toast.success('Project switched');
        // Force a reload might be needed if components don't react to context changes effectively
        // But ideally we just let the context propagate
    };

    const currentProject = projects.find(p => p.id === currentProjectId) || null;

    return (
        <ProjectContext.Provider value={{
            projects,
            currentProject,
            currentProjectId,
            isLoading,
            setCurrentProject: handleSetProject,
            refreshProjects
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

/**
 * Convenience hook to consume ProjectContext. Throws if used outside ProjectProvider.
 */
export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
