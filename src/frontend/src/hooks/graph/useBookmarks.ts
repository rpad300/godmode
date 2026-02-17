/**
 * Purpose:
 *   CRUD hook for per-user graph node bookmarks, persisted in Supabase.
 *   Allows users to pin important nodes for quick access.
 *
 * Responsibilities:
 *   - Fetch bookmarks scoped to (project_id, user_id)
 *   - Provide addBookmark and removeBookmark mutations
 *   - Expose isBookmarked(nodeId) helper for UI toggle state
 *
 * Key dependencies:
 *   - @/lib/supabase: direct Supabase client for graph_bookmarks table
 *   - ProjectContext (useProject): currentProjectId
 *   - useUser: current user identity for row-level scoping
 *
 * Side effects:
 *   - Reads/writes the graph_bookmarks Supabase table
 *   - Invalidates the bookmarks query cache on add/remove
 *
 * Notes:
 *   - Query is disabled until both project and user are available.
 *   - Bookmark uniqueness is enforced by (project_id, user_id, node_id).
 *
 * @returns {{ bookmarks, isLoading, addBookmark, removeBookmark, isBookmarked }}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/contexts/ProjectContext';
import { useUser } from '@/hooks/useUser';

export interface Bookmark {
    id: string;
    project_id: string;
    user_id: string;
    node_id: string;
    created_at: string;
}

export function useBookmarks() {
    const { currentProjectId } = useProject();
    const { user } = useUser(); // Assuming this hook exists
    const queryClient = useQueryClient();

    const queryKey = ['graph', 'bookmarks', currentProjectId];

    // Fetch Bookmarks
    const { data: bookmarks = [], isLoading } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentProjectId || !user?.id) return [];
            const { data, error } = await supabase
                .from('graph_bookmarks')
                .select('*')
                .eq('project_id', currentProjectId)
                .eq('user_id', user.id);

            if (error) throw error;
            return data as Bookmark[];
        },
        enabled: !!currentProjectId && !!user?.id
    });

    // Add Bookmark
    const addBookmark = useMutation({
        mutationFn: async (nodeId: string) => {
            if (!currentProjectId || !user?.id) throw new Error("No context");
            const { error } = await supabase
                .from('graph_bookmarks')
                .insert({
                    project_id: currentProjectId,
                    user_id: user.id,
                    node_id: nodeId
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    // Remove Bookmark
    const removeBookmark = useMutation({
        mutationFn: async (nodeId: string) => {
            if (!currentProjectId || !user?.id) throw new Error("No context");
            const { error } = await supabase
                .from('graph_bookmarks')
                .delete()
                .eq('project_id', currentProjectId)
                .eq('user_id', user.id)
                .eq('node_id', nodeId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const isBookmarked = (nodeId: string) => bookmarks.some(b => b.node_id === nodeId);

    return {
        bookmarks,
        isLoading,
        addBookmark: addBookmark.mutate,
        removeBookmark: removeBookmark.mutate,
        isBookmarked
    };
}
