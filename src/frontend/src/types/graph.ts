/**
 * Type definitions for the knowledge graph visualisation layer.
 * Independent types (no external graph library dependency) used across
 * the data pipeline, transformer, hooks, and G6-based rendering.
 */

export interface GraphNodeData {
    label?: string;
    type?: string;
    tier?: number;
    image?: string;
    color?: string;
    icon?: string;
    metadata?: any;
    project_id?: string;
    _display?: {
        width: number;
        height: number;
        colorToken: string;
    };
    [key: string]: any;
}

export interface GraphNode {
    id: string;
    label?: string;
    width?: number;
    height?: number;
    data: GraphNodeData;
    position?: { x: number; y: number };
    style?: Record<string, any>;
    combo?: string;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    animated?: boolean;
    style?: Record<string, any>;
    data?: {
        weight?: number;
        curvature?: number;
        originalLabel?: string;
        [key: string]: any;
    };
}

export interface GraphSyncStatus {
    project_id: string;
    graph_name: string;
    last_synced_at: string;
    last_connected_at?: string;
    sync_status: 'idle' | 'syncing' | 'failed';
    health_status: 'healthy' | 'degraded' | 'error';
    is_connected?: boolean;
    avg_sync_time_ms?: number;
    node_count: number;
    edge_count: number;
    pending_count?: number;
    error?: string;
}

export type GraphLayoutType = 'force' | 'forceAtlas2' | 'concentric' | 'dagre' | 'radial';

export interface GraphFilterState {
    toggles: {
        [key: string]: boolean;
    };
    searchQuery: string;
    minTier: number;
    showSemantic: boolean;
    layout: GraphLayoutType;
    collapsedTypes: Set<string>;
    timeRange: [number, number] | null;
}
