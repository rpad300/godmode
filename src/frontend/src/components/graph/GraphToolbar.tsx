/**
 * Purpose:
 *   Floating toolbar overlay for the knowledge graph viewport, providing
 *   search, entity type filtering, bookmarks, saved views, and sync controls.
 *
 * Responsibilities:
 *   - Search input that filters graph nodes by label
 *   - Entity type toggle buttons organized by tier (Core Entities vs
 *     Knowledge Details)
 *   - Semantic links toggle (show/hide vector-similarity edges)
 *   - Bookmarks dropdown: lists pinned nodes with navigation and delete
 *   - Saved Views dropdown: save/restore/delete named filter configurations
 *   - Sync button to trigger graph data re-fetch from the backend
 *
 * Key dependencies:
 *   - GraphContext (useGraphState): filters, toggles, selectedNodeId
 *   - useGraphSync: sync trigger, status, isSyncing state
 *   - useBookmarks: bookmark list and CRUD operations
 *   - useSavedViews: view persistence and CRUD operations
 *
 * Side effects:
 *   - Network: triggers graph sync via useGraphSync.sync()
 *   - State: mutates graph filter state in GraphContext
 *
 * Notes:
 *   - Positioned absolutely at top-left of the graph viewport.
 *   - View restoration only restores filters; layout restoration is a TODO.
 *   - Save View dialog uses Enter key shortcut for quick confirmation.
 */
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
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 p-4 bg-[var(--gm-bg-primary)] backdrop-blur rounded-xl border shadow-xl w-80 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Header & Sync */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h2 className="font-bold text-sm tracking-tight text-white/90">Knowledge Graph</h2>
                    <span className="text-[10px] text-slate-400 font-mono">
                        {status?.node_count || 0} nodes • {status?.edge_count || 0} edges
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Bookmarks Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-yellow-500" title="Bookmarks">
                                <Star className={cn("h-4 w-4", bookmarks.length > 0 && "fill-yellow-500 text-yellow-500")} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Bookmarked Nodes</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {bookmarks.length === 0 ? (
                                <div className="p-2 text-xs text-slate-400 text-center">No bookmarks yet</div>
                            ) : (
                                bookmarks.map(b => (
                                    <DropdownMenuItem key={b.id} onClick={() => setSelectedNodeId(b.node_id)} className="flex items-center justify-between group">
                                        <span className="truncate flex-1 font-mono text-xs">{b.node_id}</span>
                                        <Trash2
                                            className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 cursor-pointer"
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-400" title="Saved Views">
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
                                <div className="p-2 text-xs text-slate-400 text-center">No saved views</div>
                            ) : (
                                views.map(v => (
                                    <DropdownMenuItem key={v.id} onClick={() => restoreView(v)} className="flex items-center justify-between group">
                                        <span className="truncate flex-1">{v.name || '(unnamed view)'}</span>
                                        <Trash2
                                            className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 cursor-pointer"
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
                        className={isSyncing ? "animate-spin text-blue-400" : "text-slate-400 hover:text-blue-400"}
                        onClick={() => sync()}
                        title="Sync Graph"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                <Input
                    placeholder="Search entities..."
                    className="pl-9 h-9 bg-white/5 border-muted group-focus-within:bg-[var(--gm-bg-primary)] transition-all"
                    value={filters.searchQuery}
                    onChange={handleSearch}
                />
            </div>

            <Separator />

            {/* Filters */}
            <div className="space-y-3">
                {/* Tier 1: Core Entities */}
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400/70 tracking-wider ml-1">Core Entities</span>
                    <div className="flex flex-wrap gap-1.5">
                        {['Project', 'Document', 'Person', 'Team', 'Sprint'].map(type => (
                            <Button
                                key={type}
                                variant={filters.toggles[type] ? "secondary" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-6 text-[10px] px-2.5 transition-all",
                                    filters.toggles[type] ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20" : "text-slate-400 hover:text-white"
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
                    <span className="text-[10px] uppercase font-bold text-slate-400/70 tracking-wider ml-1">Knowledge Details</span>
                    <div className="flex flex-wrap gap-1.5">
                        {['Fact', 'Decision', 'Risk', 'Action', 'Question'].map(type => (
                            <Button
                                key={type}
                                variant={filters.toggles[type] ? "secondary" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-6 text-[10px] px-2.5 transition-all",
                                    filters.toggles[type] ? "bg-violet-500/10 text-violet-600 border-violet-200 hover:bg-violet-500/20" : "text-slate-400 hover:text-white"
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
                    <span className="text-xs font-medium text-slate-400 ml-1">Show Semantic Links</span>
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
