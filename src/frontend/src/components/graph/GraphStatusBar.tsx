/**
 * Purpose:
 *   Floating status card overlay in the graph viewport that displays
 *   real-time synchronization state, graph metrics, and error information.
 *
 * Responsibilities:
 *   - Shows connection state (Connected / Syncing / Error / Disconnected)
 *     with animated icon and color coding
 *   - Displays an indeterminate progress bar during sync operations
 *   - Renders a metrics grid: node count, edge count, pending count
 *   - Shows last sync timestamp and error tooltip on failure
 *
 * Key dependencies:
 *   - useGraphSync: provides sync status, isSyncing flag, error, and
 *     sync trigger function
 *   - Progress (shadcn/ui): indeterminate progress bar
 *   - Tooltip (shadcn/ui): error detail tooltip
 *
 * Side effects:
 *   - None directly; reads sync state from the hook
 *
 * Notes:
 *   - Positioned absolutely at bottom-left of the graph viewport container.
 *   - The sync trigger button is not rendered here; it lives in GraphToolbar.
 */
import React, { useMemo } from 'react';
import { useGraphSync } from '@/hooks/graph/useGraphSync';
import { Activity, AlertCircle, Calendar, CheckCircle, Clock, Database, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function GraphStatusBar() {
    const { status, isSyncing, error, sync } = useGraphSync();

    const connectionState = useMemo(() => {
        if (isSyncing) return { label: 'Syncing', color: 'text-blue-500', icon: RefreshCw, animate: true };
        if (error) return { label: 'Error', color: 'text-red-500', icon: AlertCircle, animate: false };
        if (status?.is_connected) return { label: 'Connected', color: 'text-green-500', icon: Wifi, animate: false };
        return { label: 'Disconnected', color: 'text-muted-foreground', icon: WifiOff, animate: false };
    }, [isSyncing, error, status]);

    const lastSyncTime = useMemo(() => {
        if (!status?.last_connected_at) return 'Never';
        return new Date(status.last_connected_at).toLocaleTimeString();
    }, [status]);

    return (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 w-[340px]">
            {/* Main Status Card */}
            <div className="bg-background/90 backdrop-blur-sm border rounded-lg shadow-sm p-3 text-xs flex flex-col gap-3">

                {/* Header: Connection Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <connectionState.icon
                            className={cn("h-4 w-4", connectionState.color, connectionState.animate && "animate-spin")}
                        />
                        <span className={cn("font-medium", connectionState.color)}>
                            {connectionState.label}
                        </span>
                    </div>
                    {status?.avg_sync_time_ms && (
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {status.avg_sync_time_ms}ms
                        </span>
                    )}
                </div>

                {/* Progress Bar (if syncing) */}
                {isSyncing && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                            <span>Synchronizing...</span>
                        </div>
                        <Progress value={undefined} className="h-1" />
                    </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-1">
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded border border-border/50">
                        <Database className="h-3 w-3 text-muted-foreground mb-1" />
                        <span className="text-lg font-bold text-foreground">{status?.node_count || 0}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Nodes</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded border border-border/50">
                        <Activity className="h-3 w-3 text-muted-foreground mb-1" />
                        <span className="text-lg font-bold text-foreground">{status?.edge_count || 0}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Edges</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded border border-border/50">
                        <Server className="h-3 w-3 text-muted-foreground mb-1" />
                        <span className="text-lg font-bold text-foreground">{status?.pending_count || 0}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Pending</span>
                    </div>
                </div>

                {/* Footer: Last Sync + Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Last Synced: {lastSyncTime}
                    </span>

                    {error && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                                        <AlertCircle className="h-3 w-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[300px] border-red-200 bg-red-50 text-red-900">
                                    <p>{String(error)}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>
        </div>
    );
}
