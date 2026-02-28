/**
 * Transforms raw graph data from the database into a styled, de-duplicated,
 * and display-ready format. Handles tier assignment, edge styling,
 * Person/Contact merging, and parallel-edge curvature offsets.
 *
 * Also provides `toSigmaGraph()` to convert the internal GraphNode/GraphEdge
 * arrays into a Graphology Graph for Sigma.js rendering.
 */
import { GraphNode, GraphEdge } from '@/types/graph';

// ---------------------------------------------------------------------------
// CONFIGURATION MAPS (Rule 4.1 & 4.2)
// ---------------------------------------------------------------------------

// Tier Configuration (0 = Center/Project, 1 = Entities, 2 = Details)
export const TIER_CONFIG: Record<string, number> = {
    'Project': 0,
    'Company': 0,
    // Tier 1
    'Person': 1,
    'Team': 1,
    'Sprint': 1,
    'Document': 1,
    'Email': 1,
    'CalendarEvent': 1,
    'Contact': 1,
    // Tier 2
    'Risk': 2,
    'Action': 2,
    'Fact': 2,
    'Decision': 2,
    'Question': 2,
    'UserStory': 2,
    'Task': 2
};

// Node Dimensions by Type
export const NODE_DIMENSIONS: Record<string, { w: number, h: number }> = {
    'Project': { w: 280, h: 120 },
    'Company': { w: 260, h: 100 },
    'Document': { w: 220, h: 90 },
    'Person': { w: 200, h: 80 },
    'Contact': { w: 200, h: 85 },
    'Team': { w: 220, h: 85 },
    'Sprint': { w: 200, h: 65 },
    'Email': { w: 220, h: 80 },
    'CalendarEvent': { w: 210, h: 80 },
    'Fact': { w: 200, h: 80 },
    'Decision': { w: 200, h: 80 },
    'Risk': { w: 210, h: 95 },
    'Action': { w: 220, h: 90 },
    'Question': { w: 200, h: 75 },
    'UserStory': { w: 210, h: 80 },
    'Task': { w: 220, h: 90 },
    // Default fallback
    'default': { w: 200, h: 80 }
};

// Edge Styles by Type (Rule 4)
const EDGE_STYLES: Record<string, { stroke: string, width: number, opacity: number, dash?: string }> = {
    // Structural
    'BELONGS_TO_PROJECT': { stroke: '#cbd5e1', width: 1, opacity: 0.0, dash: '5 5' },
    'BELONGS_TO_COMPANY': { stroke: '#0d9488', width: 1.5, opacity: 0.6, dash: '4 4' },
    // Extraction/Workflow
    'EXTRACTED_FROM': { stroke: '#f59e0b', width: 2, opacity: 0.8 }, // amber-500
    'IMPLEMENTS': { stroke: '#3b82f6', width: 2, opacity: 0.9 }, // blue-500
    'DEPENDS_ON': { stroke: '#3b82f6', width: 2, opacity: 0.9 },
    // Attribution
    'ASSIGNED_TO': { stroke: '#10b981', width: 1.5, opacity: 0.7 }, // emerald-500
    'OWNS': { stroke: '#22c55e', width: 2.5, opacity: 0.9 }, // green-500, prominent
    'OWNED_BY': { stroke: '#10b981', width: 1.5, opacity: 0.7 },
    'AUTHORED_BY': { stroke: '#10b981', width: 1.5, opacity: 0.7 },
    // People
    'MEMBER_OF_TEAM': { stroke: '#a855f7', width: 1.5, opacity: 0.7 }, // purple-500
    'MEMBER_OF': { stroke: '#a855f7', width: 2, opacity: 0.8 }, // purple-500
    'PART_OF': { stroke: '#8b5cf6', width: 2, opacity: 0.8 }, // violet-500
    'WORKS_WITH': { stroke: '#4ade80', width: 1, opacity: 0.4 }, // green-400, thinner, transparent
    'IS_CONTACT_OF': { stroke: '#22d3ee', width: 1.5, opacity: 0.6, dash: '4 4' }, // cyan-400
    'WORKS_AT': { stroke: '#0d9488', width: 1.5, opacity: 0.7 }, // teal-600
    // Semantic
    'SIMILAR_TO': { stroke: '#facc15', width: 1, opacity: 0.5, dash: '4 4' }, // yellow-400
    // Hierarchy
    'REPORTS_TO': { stroke: '#22c55e', width: 1.5, opacity: 0.7 }, // green-500
    'MANAGES': { stroke: '#22c55e', width: 1.5, opacity: 0.7 },
    'LEADS_TEAM': { stroke: '#a855f7', width: 2, opacity: 0.8 }, // purple-500
    'PARENT_OF': { stroke: '#3b82f6', width: 1.5, opacity: 0.7 }, // blue-500
    // Planning
    'PLANNED_IN': { stroke: '#6366f1', width: 1.5, opacity: 0.7 }, // indigo-500
    // Communication
    'SENT_BY': { stroke: '#94a3b8', width: 1.5, opacity: 0.7 }, // slate-400
    'SENT_TO': { stroke: '#94a3b8', width: 1.5, opacity: 0.7 },
    'MENTIONS': { stroke: '#f59e0b', width: 1.5, opacity: 0.8 }, // amber-500
    'INVOLVES': { stroke: '#06b6d4', width: 1.5, opacity: 0.8 }, // cyan-500
    'LINKED_TO': { stroke: '#a855f7', width: 1.5, opacity: 0.7 }, // purple-500
    'DERIVED_FROM': { stroke: '#94a3b8', width: 1.5, opacity: 0.7 }, // slate-400
    'REPLY_TO': { stroke: '#94a3b8', width: 1, opacity: 0.5, dash: '3 3' }, // slate-400
    'HAS_ATTACHMENT': { stroke: '#f59e0b', width: 1, opacity: 0.6, dash: '3 3' }, // amber-500
    // Default
    'default': { stroke: '#64748b', width: 1, opacity: 0.5 } // slate-500
};

// Canonical hex colors for each node type (used by MiniMap, legend, filter badges)
export const NODE_COLORS: Record<string, string> = {
    'Project': '#6366f1', 'Company': '#0d9488', 'Person': '#22c55e',
    'Contact': '#14b8a6', 'Team': '#a855f7', 'Sprint': '#6366f1',
    'Document': '#f59e0b', 'Email': '#64748b', 'CalendarEvent': '#06b6d4',
    'Risk': '#ef4444', 'Action': '#22c55e', 'Task': '#10b981',
    'Fact': '#0ea5e9', 'Decision': '#f97316', 'Question': '#8b5cf6',
    'UserStory': '#ec4899', 'Meeting': '#06b6d4', 'Technology': '#3b82f6',
    'Answer': '#10b981', 'Briefing': '#6366f1', 'Client': '#1abc9c',
    'Conversation': '#9c27b0', 'Organization': '#8e44ad',
    'Regulation': '#e74c3c',
};

// ---------------------------------------------------------------------------
// TRANSFORM LOGIC
// ---------------------------------------------------------------------------

// Edges that should NEVER be rendered to prevent hairball
const HIDDEN_EDGE_TYPES = new Set([
    'WORKS_WITH',
    'BELONGS_TO_PROJECT',
]);

/**
 * Transforms raw graph nodes and edges into styled, de-duplicated structures.
 * Handles Person/Contact merging, tier assignment, edge styling, and edge bundling.
 */
export function transformGraphData(rawNodes: GraphNode[], rawEdges: GraphEdge[]) {

    // ---------------------------------------------------------------------------
    // -1. PRE-PASS: De-duplicate prefixed IDs (e.g. "person_UUID" vs "UUID")
    //     Old sync runs may have created nodes with label-prefixed IDs. We keep
    //     the *canonical* plain-UUID node and redirect all edges from the
    //     prefixed duplicate to the canonical one.
    // ---------------------------------------------------------------------------
    const LABEL_PREFIXES = ['person_', 'contact_', 'document_', 'fact_', 'decision_', 'risk_', 'question_', 'team_', 'action_', 'sprint_', 'email_', 'calendarevent_', 'userstory_', 'task_', 'company_'];

    const nodeIdSet = new Set(rawNodes.map(n => n.id));
    const prefixRedirectMap = new Map<string, string>();
    const prefixedIdsToRemove = new Set<string>();

    for (const node of rawNodes) {
        const id = node.id;
        for (const prefix of LABEL_PREFIXES) {
            if (id.startsWith(prefix)) {
                const strippedId = id.slice(prefix.length);
                if (nodeIdSet.has(strippedId)) {
                    prefixRedirectMap.set(id, strippedId);
                    prefixedIdsToRemove.add(id);
                }
                break;
            }
        }
    }

    const deduplicatedNodes = rawNodes.filter(n => !prefixedIdsToRemove.has(n.id));

    // ---------------------------------------------------------------------------
    // 0. Person / Contact merging
    // ---------------------------------------------------------------------------
    const personToContactMap = new Map<string, string>();
    const contactLinkedPersonIds = new Set<string>();
    const nameToContactMap = new Map<string, string>();
    const normalize = (s: string) => s?.trim().toLowerCase() || '';

    deduplicatedNodes.forEach(node => {
        if (node.label === 'Contact') {
            const contactId = node.id;
            if (node.data.linked_person_id) {
                contactLinkedPersonIds.add(node.data.linked_person_id);
                personToContactMap.set(node.data.linked_person_id, contactId);
            }
            if (node.data.name) nameToContactMap.set(normalize(node.data.name), contactId);
            if (node.data.label) nameToContactMap.set(normalize(node.data.label), contactId);
            if (Array.isArray(node.data.aliases)) {
                node.data.aliases.forEach((alias: string) => {
                    if (alias) nameToContactMap.set(normalize(alias), contactId);
                });
            }
        }
    });

    // Also merge Person nodes that share the same normalised name (keeps first)
    const seenPersonNames = new Map<string, string>();

    // 1. Process Nodes
    const nodes: GraphNode[] = [];
    const processedPersonIds = new Set<string>();

    deduplicatedNodes.forEach(node => {
        if (node.label === 'Person') {
            let shouldMerge = false;
            let targetId = '';

            if (contactLinkedPersonIds.has(node.id)) {
                shouldMerge = true;
                targetId = personToContactMap.get(node.id)!;
            } else {
                const normalizedLabel = normalize(node.data.label || node.data.name);
                if (nameToContactMap.has(normalizedLabel)) {
                    shouldMerge = true;
                    targetId = nameToContactMap.get(normalizedLabel)!;
                    personToContactMap.set(node.id, targetId);
                } else if (normalizedLabel && seenPersonNames.has(normalizedLabel)) {
                    shouldMerge = true;
                    targetId = seenPersonNames.get(normalizedLabel)!;
                    personToContactMap.set(node.id, targetId);
                }
            }

            if (shouldMerge) {
                processedPersonIds.add(node.id);
                return;
            }

            const nn = normalize(node.data.label || node.data.name);
            if (nn) seenPersonNames.set(nn, node.id);
        }

        const type = node.label || 'default';
        const tier = TIER_CONFIG[type] ?? 2;
        const dims = NODE_DIMENSIONS[type] ?? NODE_DIMENSIONS['default'];

        nodes.push({
            ...node,
            width: dims.w,
            height: dims.h,
            data: {
                ...node.data,
                tier,
                label: node.data.label || node.label,
                _display: {
                    width: dims.w,
                    height: dims.h,
                    colorToken: getNodeColorToken(type)
                }
            }
        });
    });

    // Build a set of valid node IDs so we can drop orphan edges
    const validNodeIds = new Set(nodes.map(n => n.id));

    // Helper: resolve an edge endpoint through all redirect maps
    const resolveId = (id: string): string => {
        if (prefixRedirectMap.has(id)) id = prefixRedirectMap.get(id)!;
        if (personToContactMap.has(id)) id = personToContactMap.get(id)!;
        return id;
    };

    // 2. Filter & Process Edges
    const processedEdges: GraphEdge[] = [];

    rawEdges.forEach(edge => {
        if (HIDDEN_EDGE_TYPES.has(edge.label || '')) return;

        let source = resolveId(edge.source);
        let target = resolveId(edge.target);

        if (source === target) return;
        if (!validNodeIds.has(source) || !validNodeIds.has(target)) return;

        const styleConfig = EDGE_STYLES[edge.label || ''] || EDGE_STYLES['default'];

        processedEdges.push({
            ...edge,
            id: edge.id || `${source}-${target}-${edge.label}`,
            source,
            target,
            type: 'default',
            style: {
                stroke: styleConfig.stroke,
                strokeWidth: styleConfig.width,
                opacity: styleConfig.opacity,
                strokeDasharray: styleConfig.dash
            },
            animated: edge.label === 'SIMILAR_TO' || edge.label === 'DEPENDS_ON' || edge.label === 'INVOLVES',
            data: {
                ...edge.data,
                originalLabel: edge.label
            },
            label: undefined
        });
    });

    // 3. Enrich Team nodes with computed member counts from edges
    const MEMBERSHIP_EDGES = new Set(['MEMBER_OF_TEAM', 'MEMBER_OF', 'PART_OF', 'LEADS_TEAM']);
    const teamNodeIds = new Set(nodes.filter(n => n.label === 'Team').map(n => n.id));
    if (teamNodeIds.size > 0) {
        const teamMemberCounts = new Map<string, number>();
        for (const edge of processedEdges) {
            if (!MEMBERSHIP_EDGES.has(edge.data?.originalLabel || edge.label || '')) continue;
            if (teamNodeIds.has(edge.target)) {
                teamMemberCounts.set(edge.target, (teamMemberCounts.get(edge.target) || 0) + 1);
            }
            if (teamNodeIds.has(edge.source)) {
                teamMemberCounts.set(edge.source, (teamMemberCounts.get(edge.source) || 0) + 1);
            }
        }
        // Also count from ALL raw edges (including hidden ones) so we don't miss members
        for (const edge of rawEdges) {
            if (!MEMBERSHIP_EDGES.has(edge.label || '')) continue;
            const src = resolveId(edge.source);
            const tgt = resolveId(edge.target);
            if (teamNodeIds.has(tgt) && !teamMemberCounts.has(tgt)) {
                teamMemberCounts.set(tgt, (teamMemberCounts.get(tgt) || 0) + 1);
            }
            if (teamNodeIds.has(src) && !teamMemberCounts.has(src)) {
                teamMemberCounts.set(src, (teamMemberCounts.get(src) || 0) + 1);
            }
        }
        for (const node of nodes) {
            if (node.label === 'Team' && teamMemberCounts.has(node.id)) {
                node.data = { ...node.data, memberCount: teamMemberCounts.get(node.id)! };
            }
        }
    }

    // 4. Compute curvature offsets for parallel edges between the same node pair
    const pairCounts = new Map<string, number>();
    const pairIndex = new Map<string, number>();
    for (const edge of processedEdges) {
        const pairKey = [edge.source, edge.target].sort().join('__');
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
    }
    for (const edge of processedEdges) {
        const pairKey = [edge.source, edge.target].sort().join('__');
        const total = pairCounts.get(pairKey) || 1;
        if (total > 1) {
            const idx = pairIndex.get(pairKey) || 0;
            pairIndex.set(pairKey, idx + 1);
            const offset = (idx - (total - 1) / 2) * 0.3;
            edge.data = { ...edge.data, curvature: offset };
        }
    }

    return { nodes, edges: processedEdges };
}

/** Maps a node type to a Tailwind colour token name for consistent theming. */
export function getNodeColorToken(type: string): string {
    switch (type) {
        case 'Project': return 'blue';
        case 'Company': return 'teal';
        case 'Person': return 'green';
        case 'Contact': return 'teal';
        case 'Team': return 'purple';
        case 'Sprint': return 'indigo';
        case 'Document': return 'amber';
        case 'Risk': return 'red';
        case 'Action': return 'emerald';
        case 'Fact': return 'sky';
        case 'Decision': return 'orange';
        case 'Question': return 'violet';
        case 'UserStory': return 'pink';
        case 'Email': return 'slate';
        case 'CalendarEvent': return 'cyan';
        case 'Task': return 'emerald';
        default: return 'slate';
    }
}

// ---------------------------------------------------------------------------
// SIGMA / GRAPHOLOGY DATA CONVERSION
// ---------------------------------------------------------------------------

import Graph from 'graphology';
import pagerank from 'graphology-metrics/centrality/pagerank';

const TIER_SIZES: Record<number, number> = { 0: 18, 1: 10, 2: 6 };

/**
 * Converts internal GraphNode/GraphEdge arrays into a Graphology Graph
 * with node attributes (x, y, size, color, label) and edge attributes
 * (color, size, type) ready for Sigma.js rendering.
 *
 * When `useImportance` is true, node sizes are scaled by PageRank centrality.
 */
export function toSigmaGraph(nodes: GraphNode[], edges: GraphEdge[], useImportance = false): Graph {
    const graph = new Graph();

    for (const n of nodes) {
        const type = n.label || 'default';
        const tier = n.data.tier ?? 2;
        const isGroup = !!n.data._isGroup;
        graph.addNode(n.id, {
            label: n.data.label || n.label || n.id,
            size: isGroup ? 22 : (TIER_SIZES[tier] ?? 6),
            color: NODE_COLORS[type] || '#64748b',
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            nodeType: type,
            tier,
            isGroup,
            groupCount: n.data._groupCount || 0,
            createdAt: n.data.created_at || n.data.date || null,
        });
    }

    for (const e of edges) {
        const style = EDGE_STYLES[e.data?.originalLabel || e.label || ''] || EDGE_STYLES['default'];
        const key = e.id || `${e.source}-${e.target}-${e.data?.originalLabel || e.label || 'rel'}`;
        if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) continue;
        try {
            graph.addEdgeWithKey(key, e.source, e.target, {
                color: style.stroke,
                size: Math.max(0.5, style.width * 0.4),
                relationType: e.data?.originalLabel || e.label,
                type: 'curved',
            });
        } catch {
            // skip duplicate edges
        }
    }

    if (useImportance && graph.order > 1) {
        try {
            const scores = pagerank(graph);
            const values = Object.values(scores);
            const maxPR = Math.max(...values, 0.001);
            const minPR = Math.min(...values, 0);
            const MIN_SIZE = 4;
            const MAX_SIZE = 30;
            for (const [node, score] of Object.entries(scores)) {
                const normalized = maxPR > minPR ? (score - minPR) / (maxPR - minPR) : 0.5;
                const size = MIN_SIZE + normalized * (MAX_SIZE - MIN_SIZE);
                graph.setNodeAttribute(node, 'size', size);
            }
        } catch {
            // PageRank may fail on disconnected graphs; fall back to tier sizing
        }
    }

    return graph;
}
