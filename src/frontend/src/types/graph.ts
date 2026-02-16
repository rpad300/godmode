import { Node, Edge } from '@xyflow/react';

// Extend React Flow types directly to ensure compatibility
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

export interface GraphNode extends Node {
    id: string;
    label?: string; // Optional because we use type 'card' usually
    width?: number;
    height?: number;
    data: GraphNodeData;
    // Position is required in React Flow Node, but might be missing before layout
    position: { x: number; y: number };
}

export interface GraphEdge extends Edge {
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    animated?: boolean;
    style?: any;
    data?: {
        weight?: number;
        curvature?: number;
        [key: string]: any;
    };
}

export interface GraphSyncStatus {
    project_id: string;
    graph_name: string;
    last_synced_at: string;
    last_connected_at?: string; // Added
    sync_status: 'idle' | 'syncing' | 'failed';
    health_status: 'healthy' | 'degraded' | 'error';
    is_connected?: boolean; // Added
    avg_sync_time_ms?: number; // Added
    node_count: number;
    edge_count: number;
    pending_count?: number; // Added
    error?: string;
}

export interface GraphFilterState {
    toggles: {
        [key: string]: boolean; // 'Person': true, 'Document': false
    };
    searchQuery: string;
    minTier: number;
    showSemantic: boolean;
    layout: 'concentric' | 'force' | 'hierarchical';
}
