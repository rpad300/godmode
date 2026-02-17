/**
 * Purpose:
 *   CRUD hook for saved graph view configurations. Users can snapshot the
 *   current filter, layout, and camera state and restore it later. Views
 *   may optionally be shared with other project members.
 *
 * Responsibilities:
 *   - Fetch saved views for the current project (own views + shared views)
 *   - Provide saveView mutation to persist a new configuration snapshot
 *   - Provide deleteView mutation to remove a saved view
 *
 * Key dependencies:
 *   - @/lib/supabase: direct Supabase client for graph_views table
 *   - ProjectContext (useProject): currentProjectId
 *   - useUser: user identity for ownership and visibility scoping
 *
 * Side effects:
 *   - Reads/writes the graph_views Supabase table
 *   - Invalidates the views query cache on save/delete
 *
 * Notes:
 *   - Shared views are visible to all project members (is_shared = true).
 *   - The configuration blob stores filters, layout, and camera as opaque JSON;
 *     consider typing it more strictly as the schema stabilises.
 *
 * @returns {{ views, isLoading, saveView, deleteView }}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/contexts/ProjectContext';
import { useUser } from '@/hooks/useUser';
    id: string;
    project_id: string;
    name: string;
    configuration: {
        filters: any;
        layout: any;
        camera: any;
    };
    is_shared: boolean;
    created_at: string;
}

export function useSavedViews() {
    const { currentProjectId } = useProject();
    const { user } = useUser();
    const queryClient = useQueryClient();

    const queryKey = ['graph', 'views', currentProjectId];

    // Fetch Views
    const { data: views = [], isLoading } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentProjectId) return [];
            // Fetch own views OR shared views
            const { data, error } = await supabase
                .from('graph_views')
                .select('*')
                .eq('project_id', currentProjectId)
                .or(`user_id.eq.${user?.id},is_shared.eq.true`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as SavedView[];
        },
        enabled: !!currentProjectId && !!user?.id
    });

    // Save View
    const saveView = useMutation({
        mutationFn: async (payload: { name: string; configuration: any; isShared?: boolean }) => {
            if (!currentProjectId || !user?.id) throw new Error("No context");
            const { error } = await supabase
                .from('graph_views')
                .insert({
                    project_id: currentProjectId,
                    user_id: user.id,
                    name: payload.name,
                    configuration: payload.configuration,
                    is_shared: payload.isShared || false
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    // Delete View
    const deleteView = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('graph_views')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    return {
        views,
        isLoading,
        saveView: saveView.mutate,
        deleteView: deleteView.mutate
    };
}
