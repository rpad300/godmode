/**
 * Purpose:
 *   Manages the synchronisation lifecycle between the application's relational
 *   data and the graph database. Provides sync status polling, incremental
 *   sync triggers, and full resync (rebuild) operations.
 *
 * Responsibilities:
 *   - Poll /api/graphrag/sync-status (fast 2s when syncing, slow 30s otherwise)
 *   - Provide sync() mutation for incremental sync
 *   - Provide resync() mutation for full graph rebuild
 *   - Invalidate graph node/edge caches on successful sync
 *   - Surface toast notifications for success/failure
 *
 * Key dependencies:
 *   - ProjectContext (useProject): currentProjectId
 *   - lib/graph-api: triggerSync, triggerResync, getSyncStatus
 *   - sonner: toast notifications
 *
 * Side effects:
 *   - Network requests to /api/graphrag/* endpoints
 *   - Displays toast messages on sync start and on errors
 *   - Adaptive polling interval (2s during sync, 30s idle)
 *
 * Notes:
 *   - isSyncing combines the server status with client-side pending states to avoid
 *     UI flicker between mutation fire and the next status poll.
 *   - Derived field is_connected is inferred from last_synced_at presence.
 *
 * @returns {{ status, isLoadingStatus, isSyncing, sync, resync, error }}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProject } from '@/contexts/ProjectContext';
import { graphApi } from '@/lib/graph-api';
import { GraphSyncStatus } from '@/types/graph';
import { toast } from 'sonner';

export function useGraphSync() {
    const { currentProjectId } = useProject();
    const queryClient = useQueryClient();

    // 1. Fetch Sync Status
    const statusQuery = useQuery<GraphSyncStatus>({
        queryKey: ['graph', 'sync', 'status', currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return null;
            const data = await graphApi.getSyncStatus(currentProjectId);

            // Derive computed fields that might be missing from backend
            return {
                ...data,
                is_connected: !!data?.last_synced_at,
                // Default counts if missing
                node_count: data?.node_count || 0,
                edge_count: data?.edge_count || 0,
                pending_count: data?.pending_count || 0
            };
        },
        enabled: !!currentProjectId,
        refetchInterval: (data) => {
            return data?.sync_status === 'syncing' ? 2000 : 30000;
        }
    });

    // 2. Mutation: Trigger Sync
    const syncMutation = useMutation({
        mutationFn: async () => {
            if (!currentProjectId) throw new Error('No project selected');
            return await graphApi.triggerSync(currentProjectId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['graph', 'sync', 'status'] });
            queryClient.invalidateQueries({ queryKey: ['graph', 'nodes'] });
            queryClient.invalidateQueries({ queryKey: ['graph', 'edges'] });
            toast.success('Graph sync started');
        },
        onError: (error) => {
            toast.error(`Sync failed: ${error.message}`);
        }
    });

    // 3. Mutation: Trigger Resync (Full rebuild)
    const resyncMutation = useMutation({
        mutationFn: async () => {
            if (!currentProjectId) throw new Error('No project selected');
            return await graphApi.triggerResync(currentProjectId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['graph', 'sync', 'status'] });
            queryClient.invalidateQueries({ queryKey: ['graph', 'nodes'] });
            queryClient.invalidateQueries({ queryKey: ['graph', 'edges'] });
            toast.success('Full graph resync started');
        },
        onError: (error) => {
            toast.error(`Resync failed: ${error.message}`);
        }
    });

    return {
        status: statusQuery.data,
        isLoadingStatus: statusQuery.isLoading,
        isSyncing: statusQuery.data?.sync_status === 'syncing' || syncMutation.isPending || resyncMutation.isPending,
        sync: syncMutation.mutate,
        resync: resyncMutation.mutate,
        error: statusQuery.error || syncMutation.error || resyncMutation.error
    };
}
