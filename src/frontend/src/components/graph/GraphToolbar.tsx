import React, { useState } from 'react';
import { useGraphState } from '@/contexts/GraphContext';
import { useGraphSync } from '@/hooks/graph/useGraphSync';
import { useBookmarks } from '@/hooks/graph/useBookmarks';
import { useSavedViews } from '@/hooks/graph/useSavedViews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RefreshCw, Search, Star, Eye, Save, Trash2, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GraphToolbar() {
    const { filters, setFilters, toggleType, setSelectedNodeId } = useGraphState();
    const { sync, isSyncing, status } = useGraphSync();
    const { bookmarks, removeBookmark } = useBookmarks();
    const { views, saveView, deleteView } = useSavedViews();
    const [saveViewOpen, setSaveViewOpen] = useState(false);
    const [viewName, setViewName] = useState('');

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
    };

    const toggleSemantic = () => {
        setFilters(prev => ({ ...prev, showSemantic: !prev.showSemantic }));
    };

    const restoreView = (view: any) => {
        // Restore configuration
        if (view.configuration.filters) {
            setFilters(prev => ({ ...prev, ...view.configuration.filters }));
        }
        // TODO: Layout restoration if we had a setGraphLayout method
    };

    const handleSaveView = () => {
        setSaveViewOpen(true);
        setViewName('');
    };

    const handleSaveViewConfirm = () => {
        if (viewName.trim()) {
            saveView({
                name: viewName.trim(),
                configuration: {
                    filters,
                }
            });
            setSaveViewOpen(false);
            setViewName('');
        }
    };

    return (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 p-4 bg-background/95 backdrop-blur rounded-xl border shadow-xl w-80 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Header & Sync */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h2 className="font-bold text-sm tracking-tight text-foreground/90">Knowledge Graph</h2>
                    <span className="text-[10px] text-muted-foreground font-mono">
                        {status?.node_count || 0} nodes • {status?.edge_count || 0} edges
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Bookmarks Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-yellow-500" title="Bookmarks">
                                <Star className={cn("h-4 w-4", bookmarks.length > 0 && "fill-yellow-500 text-yellow-500")} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Bookmarked Nodes</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {bookmarks.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">No bookmarks yet</div>
                            ) : (
                                bookmarks.map(b => (
                                    <DropdownMenuItem key={b.id} onClick={() => setSelectedNodeId(b.node_id)} className="flex items-center justify-between group">
                                        <span className="truncate flex-1 font-mono text-xs">{b.node_id}</span>
                                        <Trash2
                                            className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); removeBookmark(b.node_id); }}
                                        />
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Saved Views Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Saved Views">
                                <LayoutTemplate className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="flex items-center justify-between">
                                <span>Views</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleSaveView} title="Save Current View">
                                    <Save className="h-3 w-3" />
                                </Button>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {views.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">No saved views</div>
                            ) : (
                                views.map(v => (
                                    <DropdownMenuItem key={v.id} onClick={() => restoreView(v)} className="flex items-center justify-between group">
                                        <span className="truncate flex-1">{v.name}</span>
                                        <Trash2
                                            className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); deleteView(v.id); }}
                                        />
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="ghost"
                        size="icon"
                        className={isSyncing ? "animate-spin text-primary" : "text-muted-foreground hover:text-primary"}
                        onClick={() => sync()}
                        title="Sync Graph"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                    placeholder="Search entities..."
                    className="pl-9 h-9 bg-muted/50 border-muted group-focus-within:bg-background transition-all"
                    value={filters.searchQuery}
                    onChange={handleSearch}
                />
            </div>

            <Separator />

            {/* Filters */}
            <div className="space-y-3">
                {/* Tier 1: Core Entities */}
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider ml-1">Core Entities</span>
                    <div className="flex flex-wrap gap-1.5">
                        {['Project', 'Document', 'Person', 'Team', 'Sprint'].map(type => (
                            <Button
                                key={type}
                                variant={filters.toggles[type] ? "secondary" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-6 text-[10px] px-2.5 transition-all",
                                    filters.toggles[type] ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => toggleType(type)}
                            >
                                {type}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Tier 2: Details */}
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider ml-1">Knowledge Details</span>
                    <div className="flex flex-wrap gap-1.5">
                        {['Fact', 'Decision', 'Risk', 'Action', 'Question'].map(type => (
                            <Button
                                key={type}
                                variant={filters.toggles[type] ? "secondary" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-6 text-[10px] px-2.5 transition-all",
                                    filters.toggles[type] ? "bg-violet-500/10 text-violet-600 border-violet-200 hover:bg-violet-500/20" : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => toggleType(type)}
                            >
                                {type}
                            </Button>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Advanced Toggles */}
                <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-muted-foreground ml-1">Show Semantic Links</span>
                    <Button
                        variant={filters.showSemantic ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-12 rounded-full"
                        onClick={toggleSemantic}
                    >
                        {filters.showSemantic ? 'ON' : 'OFF'}
                    </Button>
                </div>
            </div>

            {/* Save View Dialog */}
            <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save View</DialogTitle>
                        <DialogDescription>Enter a name for this graph view configuration.</DialogDescription>
                    </DialogHeader>
                    <Input
                        value={viewName}
                        onChange={e => setViewName(e.target.value)}
                        placeholder="View name..."
                        className="mt-2"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveViewConfirm(); }}
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveViewConfirm} disabled={!viewName.trim()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
