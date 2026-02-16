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
