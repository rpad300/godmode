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
import { cn } from '@/lib/utils';

interface GraphSidePanelProps {
    edges: GraphEdge[];
}

export function GraphSidePanel({ edges = [] }: GraphSidePanelProps) {
    const { selectedNodeId, setSelectedNodeId } = useGraphState();
    const { node, neighbors, isLoadingNeighbors } = useGraphNodeDetail();
    const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();

    // Compute Graph Connections (Immediate neighbors)
    const graphConnections = useMemo(() => {
        if (!selectedNodeId) return [];
        return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId).map(e => {
            const isSource = e.source === selectedNodeId;
            const otherId = isSource ? e.target : e.source;
            return {
                id: e.id,
                relationship: e.label,
                direction: isSource ? 'outgoing' : 'incoming',
                targetId: otherId
            };
        });
    }, [selectedNodeId, edges]);

    if (!selectedNodeId || !node) return null;

    const props = node.data;
    const colorToken = props._display?.colorToken || 'slate';
    const borderColor = `border-${colorToken}-500`;
    const bgColor = `bg-${colorToken}-50`;

    const isPinned = selectedNodeId ? isBookmarked(selectedNodeId) : false;

    const toggleBookmark = () => {
        if (!selectedNodeId) return;
        if (isPinned) {
            removeBookmark(selectedNodeId);
        } else {
            addBookmark(selectedNodeId);
        }
    };

    return (
        <div className="absolute right-0 top-0 h-full w-[400px] bg-background/95 backdrop-blur-md border-l shadow-2xl z-20 flex flex-col transition-transform duration-300 animate-in slide-in-from-right">

            {/* Header */}
            <div className={cn("flex flex-col p-5 border-b", `bg-${colorToken}-50/50`)}>
                <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className={cn("text-xs font-bold uppercase", `text-${colorToken}-700 border-${colorToken}-200 bg-${colorToken}-100/50`)}>
                        {node.label}
                    </Badge>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8 hover:text-foreground", isPinned ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground")}
                            onClick={toggleBookmark}
                            title={isPinned ? "Remove Bookmark" : "Bookmark this node"}
                        >
                            <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Large Icon Box */}
                    <div className={cn("p-3 rounded-xl shadow-inner flex items-center justify-center shrink-0 h-16 w-16", `bg-${colorToken}-100 text-${colorToken}-600`)}>
                        <span className="[&>svg]:w-8 [&>svg]:h-8">{props.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold leading-tight line-clamp-2 tracking-tight">
                            {props.label}
                        </h2>
                        {props.project_id && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
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
                        <div className="prose prose-sm text-sm text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-lg border">
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
                                    <div key={key} className="flex flex-col p-2 rounded bg-card border shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{key.replace(/_/g, ' ')}</span>
                                        <span className="text-xs font-medium truncate" title={String(value)}>{String(value)}</span>
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
                            <p className="text-xs text-muted-foreground italic">No direct connections visualized.</p>
                        ) : (
                            <div className="grid gap-2">
                                {graphConnections.map(conn => (
                                    <div
                                        key={conn.id}
                                        className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent cursor-pointer group transition-colors"
                                        onClick={() => setSelectedNodeId(conn.targetId)}
                                    >
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="outline" className="text-[10px] px-1 h-5 text-muted-foreground font-mono">
                                                {conn.relationship}
                                            </Badge>
                                            {conn.direction === 'outgoing' ? '→' : '←'}
                                            <span className="font-medium group-hover:text-primary transition-colors">
                                                {conn.targetId} {/* Ideal: Lookup Name */}
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
                                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />)}
                            </div>
                        ) : neighbors.length === 0 ? (
                            <div className="text-xs text-muted-foreground p-2 border border-dashed rounded text-center">No similar items found in vector store.</div>
                        ) : (
                            <div className="grid gap-2">
                                {neighbors.map((neighbor: any) => (
                                    <div
                                        key={neighbor.entity_id}
                                        className="p-3 rounded-lg border bg-card hover:bg-yellow-50/50 hover:border-yellow-200 cursor-pointer transition-colors group relative overflow-hidden"
                                        onClick={() => setSelectedNodeId(neighbor.entity_id)}
                                    >
                                        <div className="absolute top-0 right-0 p-1">
                                            <div className="text-[9px] font-bold text-green-600 bg-green-50 px-1 rounded flex items-center gap-0.5">
                                                {Math.round(neighbor.similarity * 100)}%
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary" className="text-[9px] px-1 h-4">{neighbor.entity_type}</Badge>
                                        </div>
                                        <p className="text-xs font-medium text-foreground/90 line-clamp-2 group-hover:text-primary transition-colors">
                                            {neighbor.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-muted/10 flex gap-2">
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
                    @apply text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2;
                }
            `}</style>
        </div>
    );
}
