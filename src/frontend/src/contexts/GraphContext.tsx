/**
 * Holds shared UI state for the knowledge graph view: filter toggles,
 * search query, tier visibility, layout mode, node selection/hover,
 * multi-select, path finder, and community mode.
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GraphFilterState } from '@/types/graph';

interface GraphContextType {
    filters: GraphFilterState;
    setFilters: React.Dispatch<React.SetStateAction<GraphFilterState>>;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null | ((prev: string | null) => string | null)) => void;
    hoveredNodeId: string | null;
    setHoveredNodeId: (id: string | null) => void;
    toggleType: (type: string) => void;

    // Multi-select
    selectedNodeIds: Set<string>;
    toggleNodeInSelection: (id: string) => void;
    clearSelection: () => void;

    // Path finder
    pathStartId: string | null;
    setPathStartId: (id: string | null) => void;
    pathEndId: string | null;
    setPathEndId: (id: string | null) => void;
    pathNodeIds: string[];
    setPathNodeIds: (ids: string[]) => void;

    // Community mode
    communityMode: boolean;
    setCommunityMode: (v: boolean) => void;

    // Node importance mode (PageRank sizing)
    importanceMode: boolean;
    setImportanceMode: (v: boolean) => void;

    // Collapsed types (grouping)
    toggleCollapsedType: (type: string) => void;
}

const DEFAULT_FILTERS: GraphFilterState = {
    toggles: {
        'Project': true,
        'Company': true,
        'Person': true,
        'Team': true,
        'Sprint': true,
        'Risk': true,
        'Document': true,
        'Action': true,
        'Fact': true,
        'Decision': true,
        'Question': true,
        'UserStory': true,
        'Task': true,
        'CalendarEvent': true,
        'Email': false,
        'Contact': true,
    },
    searchQuery: '',
    minTier: 2,
    showSemantic: false,
    layout: 'force',
    collapsedTypes: new Set<string>(),
    timeRange: null,
};

const GraphContext = createContext<GraphContextType | undefined>(undefined);

export function GraphProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<GraphFilterState>(DEFAULT_FILTERS);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [pathStartId, setPathStartId] = useState<string | null>(null);
    const [pathEndId, setPathEndId] = useState<string | null>(null);
    const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
    const [communityMode, setCommunityMode] = useState(false);
    const [importanceMode, setImportanceMode] = useState(false);

    const toggleType = useCallback((type: string) => {
        setFilters(prev => ({
            ...prev,
            toggles: { ...prev.toggles, [type]: !prev.toggles[type] }
        }));
    }, []);

    const toggleNodeInSelection = useCallback((id: string) => {
        setSelectedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedNodeIds(new Set());
    }, []);

    const toggleCollapsedType = useCallback((type: string) => {
        setFilters(prev => {
            const next = new Set(prev.collapsedTypes);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return { ...prev, collapsedTypes: next };
        });
    }, []);

    return (
        <GraphContext.Provider value={{
            filters, setFilters,
            selectedNodeId, setSelectedNodeId: setSelectedNodeId as GraphContextType['setSelectedNodeId'],
            hoveredNodeId, setHoveredNodeId,
            toggleType,
            selectedNodeIds, toggleNodeInSelection, clearSelection,
            pathStartId, setPathStartId, pathEndId, setPathEndId,
            pathNodeIds, setPathNodeIds,
            communityMode, setCommunityMode,
            importanceMode, setImportanceMode,
            toggleCollapsedType,
        }}>
            {children}
        </GraphContext.Provider>
    );
}

export function useGraphState() {
    const context = useContext(GraphContext);
    if (context === undefined) {
        throw new Error('useGraphState must be used within a GraphProvider');
    }
    return context;
}
