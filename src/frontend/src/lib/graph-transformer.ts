import { GraphNode, GraphEdge } from '@/types/graph';

// ---------------------------------------------------------------------------
// CONFIGURATION MAPS (Rule 4.1 & 4.2)
// ---------------------------------------------------------------------------

// Tier Configuration (0 = Center/Project, 1 = Entities, 2 = Details)
export const TIER_CONFIG: Record<string, number> = {
    'Project': 0,
    // Tier 1
    'Person': 1,
    'Team': 1,
    'Sprint': 1,
    'Document': 1, // Promoted to Tier 1 per spec
    'Email': 1,
    'CalendarEvent': 1,
    'Contact': 1,
    // Tier 2
    'Risk': 2,
    'Action': 2,
    'Fact': 2,
    'Decision': 2,
    'Question': 2,
    'UserStory': 2
};

// Node Dimensions by Type
const NODE_DIMENSIONS: Record<string, { w: number, h: number }> = {
    'Project': { w: 280, h: 120 },
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
    // Default fallback
    'default': { w: 200, h: 80 }
};

// Edge Styles by Type (Rule 4)
const EDGE_STYLES: Record<string, { stroke: string, width: number, opacity: number, dash?: string }> = {
    // Structural
    'BELONGS_TO_PROJECT': { stroke: '#cbd5e1', width: 1, opacity: 0.0, dash: '5 5' }, // Hidden by default (Rule 3)
    // Extraction/Workflow
    'EXTRACTED_FROM': { stroke: '#f59e0b', width: 2, opacity: 0.8 }, // amber-500
    'IMPLEMENTS': { stroke: '#3b82f6', width: 2, opacity: 0.9 }, // blue-500
    'DEPENDS_ON': { stroke: '#3b82f6', width: 2, opacity: 0.9 },
    // Attribution
    'ASSIGNED_TO': { stroke: '#10b981', width: 1.5, opacity: 0.7 }, // emerald-500
    'OWNED_BY': { stroke: '#10b981', width: 1.5, opacity: 0.7 },
    'AUTHORED_BY': { stroke: '#10b981', width: 1.5, opacity: 0.7 },
    // People
    'MEMBER_OF_TEAM': { stroke: '#a855f7', width: 1.5, opacity: 0.7 }, // purple-500
    'WORKS_WITH': { stroke: '#4ade80', width: 1, opacity: 0.4 }, // green-400, thinner, transparent
    // Semantic
    'SIMILAR_TO': { stroke: '#facc15', width: 1, opacity: 0.5, dash: '4 4' }, // yellow-400
    // V3 New Types
    'MENTIONS': { stroke: '#f59e0b', width: 1.5, opacity: 0.8 }, // amber-500
    'INVOLVES': { stroke: '#06b6d4', width: 1.5, opacity: 0.8 }, // cyan-500
    'LINKED_TO': { stroke: '#a855f7', width: 1.5, opacity: 0.7 }, // purple-500 (Person link)
    'DERIVED_FROM': { stroke: '#94a3b8', width: 1.5, opacity: 0.7 }, // slate-400
    // Default
    'default': { stroke: '#64748b', width: 1, opacity: 0.5 } // slate-500
};

// ---------------------------------------------------------------------------
// TRANSFORM LOGIC
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TRANSFORM LOGIC
// ---------------------------------------------------------------------------

// Edges that should NEVER be rendered to prevent hairball
const HIDDEN_EDGE_TYPES = new Set([
    'WORKS_WITH',
    'BELONGS_TO_PROJECT',
]);

export function transformGraphData(rawNodes: GraphNode[], rawEdges: GraphEdge[]) {

    // 0. Pre-process: Identify Person nodes that are already represented by a Contact
    // Map: PersonID -> ContactID
    const personToContactMap = new Map<string, string>();
    const contactLinkedPersonIds = new Set<string>();

    // Map: NormalizedName -> ContactID (for alias/name matching if ID link is missing)
    const nameToContactMap = new Map<string, string>();

    // Helper to normalize strings for comparison
    const normalize = (s: string) => s?.trim().toLowerCase() || '';

    // First pass to find Contacts and build maps
    rawNodes.forEach(node => {
        if (node.label === 'Contact') {
            const contactId = node.id;

            // 1. Link by ID (Strongest)
            if (node.data.linked_person_id) {
                contactLinkedPersonIds.add(node.data.linked_person_id);
                personToContactMap.set(node.data.linked_person_id, contactId);
            }

            // 2. Link by Name
            if (node.data.name) {
                nameToContactMap.set(normalize(node.data.name), contactId);
            }
            if (node.data.label) { // Fallback if name is in label
                nameToContactMap.set(normalize(node.data.label), contactId);
            }

            // 3. Link by Aliases
            if (Array.isArray(node.data.aliases)) {
                node.data.aliases.forEach((alias: string) => {
                    if (alias) nameToContactMap.set(normalize(alias), contactId);
                });
            }
        }
    });

    // 1. Process Nodes
    const nodes: GraphNode[] = [];

    // Set to track processed person IDs to prevent double-processing if matched by both ID and Name
    const processedPersonIds = new Set<string>();

    rawNodes.forEach(node => {
        // If it's a Person node...
        if (node.label === 'Person') {
            let shouldMerge = false;
            let targetContactId = '';

            // Check ID Match
            if (contactLinkedPersonIds.has(node.id)) {
                shouldMerge = true;
                targetContactId = personToContactMap.get(node.data.linked_person_id || node.id)!;
            }
            // Check Name/Alias Match (if not already matched by ID)
            else {
                const normalizedLabel = normalize(node.data.label || node.data.name);
                if (nameToContactMap.has(normalizedLabel)) {
                    shouldMerge = true;
                    targetContactId = nameToContactMap.get(normalizedLabel)!;
                    // Store the mapping so edges can be redirected
                    personToContactMap.set(node.id, targetContactId);
                }
            }

            if (shouldMerge) {
                processedPersonIds.add(node.id);
                return; // Skip rendering this node
            }
        }

        const type = node.label || 'default';
        const tier = TIER_CONFIG[type] ?? 2;
        const dims = NODE_DIMENSIONS[type] ?? NODE_DIMENSIONS['default'];

        nodes.push({
            ...node,
            // Enforce explicit dimensions for React Flow layout code
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

    // 2. Filter & Process Edges
    const processedEdges: GraphEdge[] = [];
    const edgeGroups: Record<string, GraphEdge[]> = {};

    rawEdges.forEach(edge => {
        // RULE: Strict Blacklist
        if (HIDDEN_EDGE_TYPES.has(edge.label || '')) return;

        // REMAP: Redirect edges from merged Person nodes to their Contact nodes
        let source = edge.source;
        let target = edge.target;

        if (personToContactMap.has(source)) source = personToContactMap.get(source)!;
        if (personToContactMap.has(target)) target = personToContactMap.get(target)!;

        // Self-loop check after merge (if Person was linked to their own Contact? unlikely but possible)
        if (source === target) return;

        // Apply Styling
        const styleConfig = EDGE_STYLES[edge.label || ''] || EDGE_STYLES['default'];

        const styledEdge = {
            ...edge,
            id: edge.id || `${source}-${target}-${edge.label}`,
            source,
            target,
            type: 'default', // Using standard bezier for now, or 'smoothstep'
            style: {
                stroke: styleConfig.stroke,
                strokeWidth: styleConfig.width,
                opacity: styleConfig.opacity,
                strokeDasharray: styleConfig.dash
            },
            animated: edge.label === 'SIMILAR_TO' || edge.label === 'DEPENDS_ON' || edge.label === 'INVOLVES',
            // We store the real label in data, but don't set the top-level 'label' prop to hide it visually by default
            data: {
                ...edge.data,
                originalLabel: edge.label
            },
            label: undefined // Hide label text on the edge path
        };

        // Rule 2: Grouping Works With (though it's hidden now, keeping logic in case removed from blacklist)
        if (edge.label === 'WORKS_WITH') {
            // Canonical key for bundling: distinct pairs sorted
            const sortedIds = [source, target].sort().join('__');
            if (!edgeGroups[sortedIds]) {
                edgeGroups[sortedIds] = [];
            }
            edgeGroups[sortedIds].push(styledEdge);
        } else {
            // Add non-bundled edges directly
            processedEdges.push(styledEdge);
        }
    });

    // 3. Process Bundled Edges (WORKS_WITH)
    Object.entries(edgeGroups).forEach(([key, group]) => {
        // If we have multiple edges between same people, bundle them
        if (group.length > 0) {
            // Just take the first one and add a 'bundleCount' to it
            // Or if we want to follow "Regra 2", we just show one edge.
            const representative = { ...group[0] };
            if (group.length > 1) {
                representative.label = `${group.length}`;
                // Cap width at 3px to prevent massive edges
                const baseWidth = representative.style?.strokeWidth || 1;
                const extraWidth = Math.min((group.length * 0.2), 3);

                representative.style = {
                    ...representative.style,
                    strokeWidth: baseWidth + extraWidth,
                    opacity: 0.6 // Slightly more visible if bundled
                };
            }
            processedEdges.push(representative);
        }
    });

    // 4. Compute Curvature for remaining multi-edges (if any distinct types exist between same nodes)
    // (Skipping complex curvature logic for now to keep it clean as requested)

    return { nodes, edges: processedEdges };
}

// Helper: Get color token string for Tailwind (used in styles)
function getNodeColorToken(type: string): string {
    switch (type) {
        case 'Project': return 'blue';
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
        default: return 'slate';
    }
}
