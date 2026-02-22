/**
 * Purpose:
 *   Slide-in detail panel for a selected graph node, showing its properties,
 *   direct graph connections, and semantically related entities from the
 *   vector store.
 *
 * Responsibilities:
 *   - Displays node header with type badge, label, and project reference
 *   - Renders a dynamic properties grid from all non-reserved node data keys
 *   - Lists direct graph connections (edges) with clickable navigation
 *   - Shows semantic neighbors fetched via useGraphNodeDetail with similarity
 *     scores and loading skeleton
 *   - Supports bookmarking/pinning nodes via useBookmarks
 *   - Provides "Open Source" and "Expand" action buttons in the footer
 *
 * Key dependencies:
 *   - GraphContext (useGraphState): selected node ID and setter
 *   - useGraphNodeDetail: fetches node data and semantic neighbors
 *   - useBookmarks: node bookmark CRUD
 *   - GraphEdge (graph types): edge shape for connection computation
 *
 * Side effects:
 *   - Network: fetches semantic neighbors when a node is selected
 *
 * Notes:
 *   - Connection target names are displayed as raw IDs with a comment
 *     "Ideal: Lookup Name" indicating future improvement.
 *   - Dynamic Tailwind classes like `bg-${colorToken}-100` may not be
 *     purged correctly; these rely on safelist or JIT always-on mode.
 *   - Uses an inline <style> tag for the `.section-header` utility class.
 */
import React, { useMemo } from 'react';
import { useGraphState } from '@/contexts/GraphContext';
import { useGraphNodeDetail } from '@/hooks/graph/useGraphNodeDetail';
import { useBookmarks } from '@/hooks/graph/useBookmarks';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ExternalLink, Link as LinkIcon, Share2, Pin, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GraphEdge } from '@/types/graph';
import { useGraphNodes } from '@/hooks/graph/useGraphNodes';
import { cn } from '@/lib/utils';

interface GraphSidePanelProps {
    edges: GraphEdge[];
}

export function GraphSidePanel({ edges = [] }: GraphSidePanelProps) {
    const { selectedNodeId, setSelectedNodeId } = useGraphState();
    const { node, neighbors, isLoadingNeighbors } = useGraphNodeDetail();
    const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
    const { data: allNodes } = useGraphNodes();

    const nodeNameMap = useMemo(() => {
        const map = new Map<string, string>();
        if (allNodes) {
            for (const n of allNodes) {
                map.set(n.id, n.data?.label || n.label || n.id);
            }
        }
        return map;
    }, [allNodes]);

    const graphConnections = useMemo(() => {
        if (!selectedNodeId) return [];
        return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId).map(e => {
            const isSource = e.source === selectedNodeId;
            const otherId = isSource ? e.target : e.source;
            return {
                id: e.id,
                relationship: e.data?.originalLabel || e.label || 'related',
                direction: isSource ? 'outgoing' : 'incoming',
                targetId: otherId,
                targetName: nodeNameMap.get(otherId) || otherId.substring(0, 12) + '...',
            };
        });
    }, [selectedNodeId, edges, nodeNameMap]);

    if (!selectedNodeId || !node) return null;

    const props = node.data;

    const isPinned = selectedNodeId ? isBookmarked(selectedNodeId) : false;

    const toggleBookmark = () => {
        if (!selectedNodeId) return;
        if (isPinned) {
            removeBookmark(selectedNodeId);
        } else {
            addBookmark({
                nodeId: selectedNodeId,
                nodeType: node.label || props.type || 'unknown',
                nodeLabel: props.label || '(unnamed)',
            });
        }
    };

    return (
        <div className="w-[400px] shrink-0 bg-slate-950 border-l border-slate-800 shadow-2xl z-20 flex flex-col overflow-hidden">

            {/* Header */}
            <div className={cn("flex flex-col p-5 border-b border-slate-800 bg-slate-900/50")}>
                <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className={cn("text-xs font-bold uppercase text-slate-200 border-slate-600 bg-slate-800/50")}>
                        {node.label || '—'}
                    </Badge>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8 hover:text-white", isPinned ? "text-yellow-500 hover:text-yellow-600" : "text-slate-400")}
                            onClick={toggleBookmark}
                            title={isPinned ? "Remove Bookmark" : "Bookmark this node"}
                        >
                            <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-8 w-8 text-slate-400 hover:bg-red-500/10 hover:text-red-400">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Large Icon Box */}
                    <div className={cn("p-3 rounded-xl shadow-inner flex items-center justify-center shrink-0 h-16 w-16 bg-slate-800 text-slate-300")}>
                        <span className="[&>svg]:w-8 [&>svg]:h-8">{props.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold leading-tight line-clamp-2 tracking-tight text-slate-100">
                            {props.label || '(unnamed)'}
                        </h2>
                        {props.project_id && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                <Share2 className="w-3 h-3" />
                                <span className="truncate">Project {props.project_id.substring(0, 8)}...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-5 space-y-6">

                    {/* Main Content / Summary */}
                    {(props.content || props.description) && (
                        <div className="prose prose-sm text-sm text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            {props.content || props.description}
                        </div>
                    )}

                    {/* Properties Grid */}
                    <div className="space-y-3">
                        <h3 className="section-header">Properties</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(props).map(([key, value]) => {
                                if (['label', 'type', 'tier', 'color', 'icon', 'project_id', 'metadata', '_display', 'content', 'description'].includes(key)) return null;
                                if (!value) return null;
                                return (
                                    <div key={key} className="flex flex-col p-2 rounded bg-slate-800/50 border border-slate-700 shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">{key.replace(/_/g, ' ')}</span>
                                        <span className="text-xs font-medium text-slate-200 truncate" title={String(value)}>{String(value)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* Graph Connections */}
                    <div className="space-y-3">
                        <h3 className="section-header flex items-center justify-between">
                            <span>Direct Connections</span>
                            <Badge variant="secondary" className="text-[10px] h-5">{graphConnections.length}</Badge>
                        </h3>
                        {graphConnections.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No direct connections visualized.</p>
                        ) : (
                            <div className="grid gap-2">
                                {graphConnections.map(conn => (
                                    <div
                                        key={conn.id}
                                        className="flex items-center justify-between p-2 rounded-md border border-slate-700 bg-slate-800/50 hover:bg-purple-500/10 cursor-pointer group transition-colors"
                                        onClick={() => setSelectedNodeId(conn.targetId)}
                                    >
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="outline" className="text-[10px] px-1 h-5 text-slate-400 font-mono">
                                                {conn.relationship}
                                            </Badge>
                                            {conn.direction === 'outgoing' ? '→' : '←'}
                                            <span className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                                                {conn.targetName}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Semantic Neighbors */}
                    <div className="space-y-3">
                        <h3 className="section-header flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <LinkIcon className="h-3.5 w-3.5 text-yellow-500" />
                                <span>Semantic Related</span>
                            </div>
                        </h3>

                        {isLoadingNeighbors ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800 animate-pulse rounded-md" />)}
                            </div>
                        ) : neighbors.length === 0 ? (
                            <div className="text-xs text-slate-400 p-2 border border-dashed rounded text-center">No similar items found in vector store.</div>
                        ) : (
                            <div className="grid gap-2">
                                {neighbors.map((neighbor: any) => (
                                    <div
                                        key={neighbor.entity_id}
                                        className="p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-yellow-500/10 hover:border-yellow-500/30 cursor-pointer transition-colors group relative overflow-hidden"
                                        onClick={() => setSelectedNodeId(neighbor.entity_id)}
                                    >
                                        <div className="absolute top-0 right-0 p-1">
                                            <div className="text-[9px] font-bold text-green-400 bg-green-900/60 px-1 rounded flex items-center gap-0.5">
                                                {Math.round(neighbor.similarity * 100)}%
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary" className="text-[9px] px-1 h-4">{neighbor.entity_type}</Badge>
                                        </div>
                                        <p className="text-xs font-medium text-slate-200 line-clamp-2 group-hover:text-blue-400 transition-colors">
                                            {neighbor.content || '(no content)'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2">
                <Button className="flex-1" variant="outline" size="sm">
                    Open Source
                    <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
                <Button className="flex-1" size="sm">
                    Expand
                    <Share2 className="ml-2 h-3 w-3" />
                </Button>
            </div>

            <style>{`
                .section-header {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: rgb(148 163 184);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.5rem;
                }
            `}</style>
        </div>
    );
}
