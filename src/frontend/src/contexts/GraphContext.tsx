/**
 * Purpose:
 *   Holds shared UI state for the knowledge graph view: filter toggles,
 *   search query, tier visibility, layout mode, and node selection/hover.
 *
 * Responsibilities:
 *   - Store and expose GraphFilterState (type toggles, search, tier, semantic, layout)
 *   - Track which node is currently selected or hovered
 *   - Provide a toggleType helper for checkbox-style entity filtering
 *
 * Key dependencies:
 *   - @/types/graph: GraphFilterState type definition
 *
 * Side effects:
 *   - None (pure in-memory state)
 *
 * Notes:
 *   - Email and Contact types are hidden by default (toggled off in DEFAULT_FILTERS)
 *   - minTier defaults to 2, meaning all tiers are visible initially
 *   - Context value updates whenever filters, selectedNodeId, or hoveredNodeId change
 */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GraphFilterState } from '@/types/graph';

interface GraphContextType {
    filters: GraphFilterState;
    setFilters: React.Dispatch<React.SetStateAction<GraphFilterState>>;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;
    hoveredNodeId: string | null;
    setHoveredNodeId: (id: string | null) => void;
    // Helper to toggle specific type
    toggleType: (type: string) => void;
}

const DEFAULT_FILTERS: GraphFilterState = {
    toggles: {
        'Project': true,
        'Person': true,
        'Team': true,
        'Sprint': true,
        'Risk': true,
        'Document': true,
        'Action': true,
        'Fact': true,
        'Decision': true,
        'Question': true,
        'Email': false, // Hidden by default
        'Contact': false // Hidden by default
    },
    searchQuery: '',
    minTier: 2, // Show all tiers by default
    showSemantic: false,
    layout: 'concentric'
};

const GraphContext = createContext<GraphContextType | undefined>(undefined);

export function GraphProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<GraphFilterState>(DEFAULT_FILTERS);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const toggleType = (type: string) => {
        setFilters(prev => ({
            ...prev,
            toggles: {
                ...prev.toggles,
                [type]: !prev.toggles[type]
            }
        }));
    };

    return (
        <GraphContext.Provider value={{
            filters,
            setFilters,
            selectedNodeId,
            setSelectedNodeId,
            hoveredNodeId,
            setHoveredNodeId,
            toggleType
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
