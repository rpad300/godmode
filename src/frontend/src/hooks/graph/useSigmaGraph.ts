/**
 * Manages the Sigma.js + Graphology graph lifecycle within React.
 * Handles renderer creation, graph data binding, ForceAtlas2 layout,
 * node/edge visual reducers for selection/search/path/community highlighting,
 * drag, edge labels, animated layout transitions, export PNG, minimap,
 * and event wiring including right-click.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import EdgeCurveProgram from '@sigma/edge-curve';

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 100, g: 100, b: 100 };
};

const rgbToHex = (r: number, g: number, b: number): string =>
    '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

const dimColor = (hex: string, amount: number): string => {
    const rgb = hexToRgb(hex);
    const bg = { r: 15, g: 23, b: 42 };
    return rgbToHex(
        bg.r + (rgb.r - bg.r) * amount,
        bg.g + (rgb.g - bg.g) * amount,
        bg.b + (rgb.b - bg.b) * amount,
    );
};

const brightenColor = (hex: string, factor: number): string => {
    const rgb = hexToRgb(hex);
    return rgbToHex(
        rgb.r + (255 - rgb.r) * (factor - 1) / factor,
        rgb.g + (255 - rgb.g) * (factor - 1) / factor,
        rgb.b + (255 - rgb.b) * (factor - 1) / factor,
    );
};

const COMMUNITY_PALETTE = [
    '#f43f5e', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981',
    '#ec4899', '#6366f1', '#14b8a6', '#ef4444', '#84cc16',
    '#a855f7', '#0ea5e9', '#f97316', '#22c55e', '#e879f9',
];

function communityColor(communityId: number): string {
    return COMMUNITY_PALETTE[communityId % COMMUNITY_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSigmaGraphOptions {
    onNodeClick?: (nodeId: string) => void;
    onNodeRightClick?: (nodeId: string, screenX: number, screenY: number) => void;
    onStageClick?: () => void;
    onNodeHover?: (nodeId: string | null) => void;
    selectedNodeId?: string | null;
    selectedNodeIds?: Set<string>;
    searchHighlightIds?: Set<string>;
    pathNodeIds?: string[];
    communityMode?: boolean;
}

export type SigmaGraphStatus = 'idle' | 'waiting-data' | 'initializing' | 'ready' | 'error';
export type LayoutType = 'forceAtlas2' | 'force' | 'concentric' | 'radial' | 'dagre';

// ---------------------------------------------------------------------------
// Layout config
// ---------------------------------------------------------------------------

const NOVERLAP_SETTINGS = { maxIterations: 20, ratio: 1.1, margin: 10, expansion: 1.05 };

const getFA2Settings = (nodeCount: number) => {
    const isSmall = nodeCount < 100;
    const isMedium = nodeCount >= 100 && nodeCount < 500;
    return {
        gravity: isSmall ? 1.0 : isMedium ? 0.6 : 0.3,
        scalingRatio: isSmall ? 12 : isMedium ? 25 : 50,
        slowDown: isSmall ? 1 : isMedium ? 2 : 4,
        barnesHutOptimize: nodeCount > 100,
        barnesHutTheta: 0.6,
        strongGravityMode: false,
        outboundAttractionDistribution: true,
        linLogMode: false,
        adjustSizes: true,
        edgeWeightInfluence: 1,
    };
};

const getLayoutDuration = (nodeCount: number): number => {
    if (nodeCount > 2000) return 30000;
    if (nodeCount > 500) return 20000;
    if (nodeCount > 100) return 15000;
    return 10000;
};

// ---------------------------------------------------------------------------
// Static layout functions (compute target positions without applying)
// ---------------------------------------------------------------------------

function computeConcentricPositions(graph: Graph): Map<string, { x: number; y: number }> {
    const tiers: Record<number, string[]> = { 0: [], 1: [], 2: [] };
    graph.forEachNode((node, attrs) => {
        const tier = (attrs.tier as number) ?? 2;
        (tiers[tier] ??= []).push(node);
    });
    const positions = new Map<string, { x: number; y: number }>();
    const RING_RADII = [0, 300, 600];
    for (const [tierStr, nodes] of Object.entries(tiers)) {
        const tier = Number(tierStr);
        const radius = RING_RADII[tier] ?? 600;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
            positions.set(node, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        });
    }
    return positions;
}

function computeRadialPositions(graph: Graph): Map<string, { x: number; y: number }> {
    let rootNode: string | null = null;
    let maxDegree = -1;
    graph.forEachNode((node) => {
        const degree = graph.degree(node);
        if (degree > maxDegree) { maxDegree = degree; rootNode = node; }
    });
    const positions = new Map<string, { x: number; y: number }>();
    if (!rootNode) return positions;

    const visited = new Set<string>();
    const queue: { node: string; depth: number }[] = [{ node: rootNode, depth: 0 }];
    visited.add(rootNode);
    const depthMap = new Map<number, string[]>();

    while (queue.length > 0) {
        const { node, depth } = queue.shift()!;
        if (!depthMap.has(depth)) depthMap.set(depth, []);
        depthMap.get(depth)!.push(node);
        graph.forEachNeighbor(node, (neighbor) => {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ node: neighbor, depth: depth + 1 });
            }
        });
    }

    for (const [depth, nodes] of depthMap.entries()) {
        const radius = depth * 250;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
            positions.set(node, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        });
    }
    return positions;
}

function computeDagrePositions(graph: Graph): Map<string, { x: number; y: number }> {
    const tiers: Record<number, string[]> = { 0: [], 1: [], 2: [] };
    graph.forEachNode((node, attrs) => {
        const tier = (attrs.tier as number) ?? 2;
        (tiers[tier] ??= []).push(node);
    });
    const positions = new Map<string, { x: number; y: number }>();
    const TIER_Y = [0, 400, 800];
    for (const [tierStr, nodes] of Object.entries(tiers)) {
        const tier = Number(tierStr);
        const y = TIER_Y[tier] ?? 800;
        const totalWidth = nodes.length * 200;
        nodes.forEach((node, i) => {
            positions.set(node, { x: -totalWidth / 2 + i * 200, y });
        });
    }
    return positions;
}

// ---------------------------------------------------------------------------
// Animated position transition
// ---------------------------------------------------------------------------

function animatePositions(
    graph: Graph,
    targets: Map<string, { x: number; y: number }>,
    duration: number,
    onDone?: () => void,
): () => void {
    const starts = new Map<string, { x: number; y: number }>();
    graph.forEachNode((node, attrs) => {
        starts.set(node, { x: attrs.x as number, y: attrs.y as number });
    });

    const t0 = performance.now();
    let cancelled = false;

    function step() {
        if (cancelled) return;
        const elapsed = performance.now() - t0;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        graph.forEachNode((node) => {
            const start = starts.get(node);
            const target = targets.get(node);
            if (start && target) {
                graph.setNodeAttribute(node, 'x', start.x + (target.x - start.x) * ease);
                graph.setNodeAttribute(node, 'y', start.y + (target.y - start.y) * ease);
            }
        });

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            onDone?.();
        }
    }

    requestAnimationFrame(step);
    return () => { cancelled = true; };
}

// ---------------------------------------------------------------------------
// Minimap renderer
// ---------------------------------------------------------------------------

function renderMinimap(
    canvas: HTMLCanvasElement,
    graph: Graph,
    sigma: Sigma,
) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    if (graph.order === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    graph.forEachNode((_node, attrs) => {
        const x = attrs.x as number;
        const y = attrs.y as number;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 8;
    const scaleX = (w - padding * 2) / rangeX;
    const scaleY = (h - padding * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (w - rangeX * scale) / 2;
    const offsetY = (h - rangeY * scale) / 2;

    graph.forEachNode((_node, attrs) => {
        const px = offsetX + (attrs.x as number - minX) * scale;
        const py = offsetY + (attrs.y as number - minY) * scale;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, ((attrs.size as number) || 6) * scale * 0.02), 0, Math.PI * 2);
        ctx.fillStyle = (attrs.color as string) || '#64748b';
        ctx.fill();
    });

    // Viewport rectangle
    const camera = sigma.getCamera();
    const state = camera.getState();
    const dims = sigma.getDimensions();
    const viewW = dims.width * state.ratio;
    const viewH = dims.height * state.ratio;

    const vpLeft = state.x - viewW / 2;
    const vpTop = state.y - viewH / 2;

    // Convert graph coords to minimap coords (approximate)
    const rLeft = offsetX + (vpLeft * rangeX - minX) * scale;
    const rTop = offsetY + (vpTop * rangeY - minY) * scale;
    const rWidth = viewW * scale;
    const rHeight = viewH * scale;

    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rLeft, rTop, rWidth, rHeight);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSigmaGraph(
    data: Graph | null,
    options: UseSigmaGraphOptions,
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const minimapRef = useRef<HTMLCanvasElement>(null);
    const sigmaRef = useRef<Sigma | null>(null);
    const graphRef = useRef<Graph | null>(null);
    const layoutRef = useRef<FA2Layout | null>(null);
    const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animCancelRef = useRef<(() => void) | null>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const selectedNodeRef = useRef<string | null>(null);
    const selectedIdsRef = useRef<Set<string>>(new Set());
    const searchIdsRef = useRef<Set<string>>(new Set());
    const pathIdsRef = useRef<Set<string>>(new Set());
    const communityModeRef = useRef(false);
    const dragStateRef = useRef<{ node: string; startX: number; startY: number } | null>(null);
    const hoveredEdgeRef = useRef<string | null>(null);

    const [status, setStatus] = useState<SigmaGraphStatus>('idle');
    const [isLayoutRunning, setIsLayoutRunning] = useState(false);
    const [hoveredNode, setHoveredNode] = useState<{
        id: string; label: string; type: string; screenX: number; screenY: number;
    } | null>(null);

    // Keep refs in sync
    useEffect(() => {
        selectedNodeRef.current = options.selectedNodeId ?? null;
        sigmaRef.current?.refresh();
    }, [options.selectedNodeId]);

    useEffect(() => {
        selectedIdsRef.current = options.selectedNodeIds ?? new Set();
        sigmaRef.current?.refresh();
    }, [options.selectedNodeIds]);

    useEffect(() => {
        searchIdsRef.current = options.searchHighlightIds ?? new Set();
        sigmaRef.current?.refresh();
    }, [options.searchHighlightIds]);

    useEffect(() => {
        pathIdsRef.current = new Set(options.pathNodeIds ?? []);
        sigmaRef.current?.refresh();
    }, [options.pathNodeIds]);

    useEffect(() => {
        communityModeRef.current = options.communityMode ?? false;
        sigmaRef.current?.refresh();
    }, [options.communityMode]);

    // Initialize Sigma ONCE
    useEffect(() => {
        if (!containerRef.current) return;

        const graph = new Graph();
        graphRef.current = graph;

        const sigma = new Sigma(graph, containerRef.current, {
            renderLabels: true,
            labelFont: 'Inter, system-ui, sans-serif',
            labelSize: 11,
            labelWeight: '500',
            labelColor: { color: '#e2e8f0' },
            labelRenderedSizeThreshold: 6,
            labelDensity: 0.15,
            labelGridCellSize: 80,

            defaultNodeColor: '#64748b',
            defaultEdgeColor: '#1e293b',

            defaultEdgeType: 'curved',
            edgeProgramClasses: { curved: EdgeCurveProgram },

            defaultDrawNodeHover: (context, data, settings) => {
                const label = data.label;
                if (!label) return;

                const size = settings.labelSize || 11;
                const font = settings.labelFont || 'Inter, system-ui, sans-serif';
                const weight = settings.labelWeight || '500';

                context.font = `${weight} ${size}px ${font}`;
                const textWidth = context.measureText(label).width;

                const nodeSize = data.size || 8;
                const x = data.x;
                const y = data.y - nodeSize - 12;
                const paddingX = 10;
                const paddingY = 6;
                const height = size + paddingY * 2;
                const width = textWidth + paddingX * 2;
                const radius = 6;

                context.fillStyle = '#0f172a';
                context.beginPath();
                context.roundRect(x - width / 2, y - height / 2, width, height, radius);
                context.fill();

                context.strokeStyle = data.color || '#6366f1';
                context.lineWidth = 1.5;
                context.stroke();

                context.fillStyle = '#f1f5f9';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(label, x, y);

                context.beginPath();
                context.arc(data.x, data.y, nodeSize + 3, 0, Math.PI * 2);
                context.strokeStyle = data.color || '#6366f1';
                context.lineWidth = 2;
                context.globalAlpha = 0.6;
                context.stroke();
                context.globalAlpha = 1;
            },

            minCameraRatio: 0.005,
            maxCameraRatio: 30,
            hideEdgesOnMove: true,
            zIndex: true,

            // ---------------------------------------------------------------
            // NODE REDUCER: handles selection, multi-select, search, path,
            // and community coloring
            // ---------------------------------------------------------------
            nodeReducer: (node, data) => {
                const res = { ...data };
                const g = graphRef.current;
                const currentSelected = selectedNodeRef.current;
                const multiIds = selectedIdsRef.current;
                const searchIds = searchIdsRef.current;
                const pathIds = pathIdsRef.current;
                const isCommunity = communityModeRef.current;

                // Community coloring overrides base color
                if (isCommunity && data.community !== undefined) {
                    res.color = communityColor(data.community as number);
                }

                // Path highlighting (highest priority visual)
                if (pathIds.size > 0) {
                    if (pathIds.has(node)) {
                        res.color = '#22c55e';
                        res.size = (data.size || 8) * 1.6;
                        res.zIndex = 3;
                        res.highlighted = true;
                    } else if (!currentSelected && multiIds.size === 0) {
                        res.color = dimColor(res.color, 0.3);
                        res.size = (data.size || 8) * 0.7;
                        res.zIndex = 0;
                    }
                    if (pathIds.size > 0 && !currentSelected && multiIds.size === 0) return res;
                }

                // Search highlighting (when no selection)
                const hasSearch = searchIds.size > 0;
                if (hasSearch && !currentSelected && multiIds.size === 0) {
                    if (searchIds.has(node)) {
                        res.color = '#06b6d4';
                        res.size = (data.size || 8) * 1.5;
                        res.zIndex = 2;
                        res.highlighted = true;
                    } else {
                        res.color = dimColor(res.color, 0.3);
                        res.size = (data.size || 8) * 0.7;
                        res.zIndex = 0;
                    }
                    return res;
                }

                // Multi-select highlighting
                if (multiIds.size > 1 && !currentSelected && g) {
                    if (multiIds.has(node)) {
                        res.size = (data.size || 8) * 1.5;
                        res.zIndex = 2;
                        res.highlighted = true;
                    } else {
                        const isNeighborOfAny = Array.from(multiIds).some(
                            id => g.hasEdge(node, id) || g.hasEdge(id, node)
                        );
                        if (isNeighborOfAny) {
                            res.size = (data.size || 8) * 1.1;
                            res.zIndex = 1;
                        } else {
                            res.color = dimColor(res.color, 0.3);
                            res.size = (data.size || 8) * 0.7;
                            res.zIndex = 0;
                        }
                    }
                    return res;
                }

                // Single selection: highlight selected + neighbors; keep others visible
                if (!currentSelected || !g) return res;

                const isSelected = node === currentSelected;
                const isNeighbor = g.hasEdge(node, currentSelected) || g.hasEdge(currentSelected, node);

                if (isSelected) {
                    res.size = (data.size || 8) * 1.5;
                    res.zIndex = 2;
                    res.highlighted = true;
                } else if (isNeighbor) {
                    res.color = brightenColor(res.color, 1.3);
                    res.size = (data.size || 8) * 1.15;
                    res.zIndex = 1;
                }
                // Non-neighbor nodes stay at their default size and color

                return res;
            },

            // ---------------------------------------------------------------
            // EDGE REDUCER: handles selection, search, path, hover labels
            // ---------------------------------------------------------------
            edgeReducer: (edge, data) => {
                const res = { ...data };
                const currentSelected = selectedNodeRef.current;
                const multiIds = selectedIdsRef.current;
                const searchIds = searchIdsRef.current;
                const pathIds = pathIdsRef.current;
                const hoveredEdge = hoveredEdgeRef.current;
                const g = graphRef.current;

                if (hoveredEdge === edge && data.relationType) {
                    res.label = data.relationType;
                }

                // Path highlighting
                if (pathIds.size > 0 && g) {
                    const [source, target] = g.extremities(edge);
                    if (pathIds.has(source) && pathIds.has(target)) {
                        res.color = '#22c55e';
                        res.size = Math.max(3, (data.size || 1) * 3);
                        res.zIndex = 3;
                        if (data.relationType) res.label = data.relationType;
                    } else if (!currentSelected && multiIds.size === 0) {
                        res.color = dimColor(data.color, 0.15);
                        res.size = 0.4;
                    }
                    if (!currentSelected && multiIds.size === 0) return res;
                }

                // Search mode
                if (searchIds.size > 0 && !currentSelected && multiIds.size === 0 && g) {
                    const [source, target] = g.extremities(edge);
                    if (searchIds.has(source) && searchIds.has(target)) {
                        res.color = '#06b6d4';
                        res.size = Math.max(2, (data.size || 1) * 2);
                    } else {
                        res.color = dimColor(data.color, 0.15);
                        res.size = 0.4;
                    }
                    return res;
                }

                // Multi-select: highlight edges between selected nodes
                if (multiIds.size > 1 && !currentSelected && g) {
                    const [source, target] = g.extremities(edge);
                    const bothSelected = multiIds.has(source) && multiIds.has(target);
                    const oneSelected = multiIds.has(source) || multiIds.has(target);
                    if (bothSelected) {
                        res.color = brightenColor(data.color, 1.5);
                        res.size = Math.max(2.5, (data.size || 1) * 3);
                        res.zIndex = 2;
                        if (data.relationType) res.label = data.relationType;
                    } else if (oneSelected) {
                        res.color = dimColor(data.color, 0.35);
                        res.size = (data.size || 1) * 0.7;
                    } else {
                        res.color = dimColor(data.color, 0.15);
                        res.size = 0.5;
                        res.zIndex = 0;
                    }
                    return res;
                }

                if (!currentSelected || !g) return res;

                const [source, target] = g.extremities(edge);
                const isConnected = source === currentSelected || target === currentSelected;

                if (isConnected) {
                    res.color = brightenColor(data.color, 1.5);
                    res.size = Math.max(2, (data.size || 1) * 2.5);
                    res.zIndex = 2;
                    if (data.relationType) res.label = data.relationType;
                }
                // Non-connected edges stay at their default appearance

                return res;
            },
        });

        sigmaRef.current = sigma;

        // --- Events ---
        sigma.on('clickNode', ({ node }) => {
            optionsRef.current.onNodeClick?.(node);
        });

        sigma.on('clickStage', () => {
            optionsRef.current.onStageClick?.();
        });

        sigma.on('rightClickNode', (payload) => {
            payload.event.original.preventDefault();
            const node = payload.node;
            const g = graphRef.current;
            if (g && g.hasNode(node)) {
                const attrs = g.getNodeAttributes(node);
                const viewportPos = sigma.graphToViewport({ x: attrs.x, y: attrs.y });
                optionsRef.current.onNodeRightClick?.(node, viewportPos.x, viewportPos.y);
            }
        });

        sigma.on('enterNode', ({ node }) => {
            optionsRef.current.onNodeHover?.(node);
            if (containerRef.current) containerRef.current.style.cursor = 'pointer';
            const g = graphRef.current;
            if (g && g.hasNode(node)) {
                const attrs = g.getNodeAttributes(node);
                const viewportPos = sigma.graphToViewport({ x: attrs.x, y: attrs.y });
                setHoveredNode({
                    id: node,
                    label: (attrs.label as string) || node,
                    type: (attrs.nodeType as string) || '',
                    screenX: viewportPos.x,
                    screenY: viewportPos.y,
                });
            }
        });

        sigma.on('leaveNode', () => {
            optionsRef.current.onNodeHover?.(null);
            if (containerRef.current) containerRef.current.style.cursor = 'grab';
            setHoveredNode(null);
        });

        sigma.on('enterEdge', ({ edge }) => {
            hoveredEdgeRef.current = edge;
            sigma.refresh();
        });

        sigma.on('leaveEdge', () => {
            hoveredEdgeRef.current = null;
            sigma.refresh();
        });

        // --- Node Drag ---
        sigma.on('downNode', ({ node, event }) => {
            const g = graphRef.current;
            if (!g || !g.hasNode(node)) return;
            dragStateRef.current = { node, startX: event.x, startY: event.y };
            sigma.getCamera().disable();
        });

        sigma.getMouseCaptor().on('mousemovebody', (e: any) => {
            if (!dragStateRef.current) return;
            const pos = sigma.viewportToGraph({ x: e.x, y: e.y });
            const g = graphRef.current;
            if (g && g.hasNode(dragStateRef.current.node)) {
                g.setNodeAttribute(dragStateRef.current.node, 'x', pos.x);
                g.setNodeAttribute(dragStateRef.current.node, 'y', pos.y);
            }
        });

        sigma.getMouseCaptor().on('mouseup', () => {
            if (dragStateRef.current) {
                dragStateRef.current = null;
                sigma.getCamera().enable();
            }
        });

        // --- Minimap rendering on afterRender ---
        sigma.on('afterRender', () => {
            const minimapCanvas = minimapRef.current;
            const g = graphRef.current;
            if (minimapCanvas && g) {
                renderMinimap(minimapCanvas, g, sigma);
            }
        });

        setStatus('idle');

        return () => {
            if (layoutTimeoutRef.current) clearTimeout(layoutTimeoutRef.current);
            if (animCancelRef.current) animCancelRef.current();
            layoutRef.current?.kill();
            sigma.kill();
            sigmaRef.current = null;
            graphRef.current = null;
        };
    }, []);

    // --- Layout helpers ---

    const killLayout = useCallback(() => {
        if (layoutRef.current) {
            layoutRef.current.kill();
            layoutRef.current = null;
        }
        if (layoutTimeoutRef.current) {
            clearTimeout(layoutTimeoutRef.current);
            layoutTimeoutRef.current = null;
        }
        if (animCancelRef.current) {
            animCancelRef.current();
            animCancelRef.current = null;
        }
        setIsLayoutRunning(false);
    }, []);

    const runLayout = useCallback((graph: Graph) => {
        const nodeCount = graph.order;
        if (nodeCount === 0) return;

        killLayout();

        const inferredSettings = forceAtlas2.inferSettings(graph);
        const customSettings = getFA2Settings(nodeCount);
        const settings = { ...inferredSettings, ...customSettings };

        const layout = new FA2Layout(graph, { settings });
        layoutRef.current = layout;
        layout.start();
        setIsLayoutRunning(true);

        const duration = getLayoutDuration(nodeCount);

        layoutTimeoutRef.current = setTimeout(() => {
            if (layoutRef.current) {
                layoutRef.current.stop();
                layoutRef.current = null;
                noverlap.assign(graph, NOVERLAP_SETTINGS);
                sigmaRef.current?.refresh();
                setIsLayoutRunning(false);
            }
        }, duration);
    }, [killLayout]);

    // Update graph data when source data changes
    useEffect(() => {
        const sigma = sigmaRef.current;
        if (!sigma) {
            setStatus(data ? 'initializing' : 'idle');
            return;
        }
        if (!data || data.order === 0) {
            setStatus('waiting-data');
            return;
        }

        killLayout();
        graphRef.current = data;
        sigma.setGraph(data);
        sigma.getCamera().animatedReset({ duration: 300 });
        runLayout(data);
        setStatus('ready');
    }, [data, runLayout, killLayout]);

    // --- Public API ---

    const fitView = useCallback(() => {
        sigmaRef.current?.getCamera().animatedReset({ duration: 300 });
    }, []);

    const zoomIn = useCallback(() => {
        sigmaRef.current?.getCamera().animatedZoom({ duration: 200 });
    }, []);

    const zoomOut = useCallback(() => {
        sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 });
    }, []);

    const focusNode = useCallback((nodeId: string) => {
        const sigma = sigmaRef.current;
        const graph = graphRef.current;
        if (!sigma || !graph || !graph.hasNode(nodeId)) return;
        const attrs = graph.getNodeAttributes(nodeId);
        sigma.getCamera().animate({ x: attrs.x, y: attrs.y, ratio: 0.4 }, { duration: 400 });
    }, []);

    const startLayout = useCallback(() => {
        const graph = graphRef.current;
        if (graph && graph.order > 0) runLayout(graph);
    }, [runLayout]);

    const stopLayout = useCallback(() => {
        killLayout();
        const graph = graphRef.current;
        if (graph) {
            noverlap.assign(graph, NOVERLAP_SETTINGS);
            sigmaRef.current?.refresh();
        }
    }, [killLayout]);

    const applyLayout = useCallback((layoutType: LayoutType) => {
        const graph = graphRef.current;
        if (!graph || graph.order === 0) return;

        killLayout();

        if (layoutType === 'forceAtlas2' || layoutType === 'force') {
            runLayout(graph);
            return;
        }

        let targets: Map<string, { x: number; y: number }>;
        switch (layoutType) {
            case 'concentric':
                targets = computeConcentricPositions(graph);
                break;
            case 'radial':
                targets = computeRadialPositions(graph);
                break;
            case 'dagre':
                targets = computeDagrePositions(graph);
                break;
            default:
                runLayout(graph);
                return;
        }

        animCancelRef.current = animatePositions(graph, targets, 600, () => {
            noverlap.assign(graph, NOVERLAP_SETTINGS);
            sigmaRef.current?.refresh();
            animCancelRef.current = null;
        });
    }, [killLayout, runLayout]);

    const exportPNG = useCallback(() => {
        const sigma = sigmaRef.current;
        if (!sigma) return;

        const layers = (sigma as any).getCanvases?.();
        if (!layers) return;

        const keys = Object.keys(layers);
        if (keys.length === 0) return;

        const firstCanvas = layers[keys[0]] as HTMLCanvasElement;
        const w = firstCanvas.width;
        const h = firstCanvas.height;

        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d')!;

        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, w, h);

        for (const key of keys) {
            const layerCanvas = layers[key] as HTMLCanvasElement;
            ctx.drawImage(layerCanvas, 0, 0);
        }

        offscreen.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `graph-${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }, []);

    const getNeighborIds = useCallback((nodeId: string): string[] => {
        const graph = graphRef.current;
        if (!graph || !graph.hasNode(nodeId)) return [];
        return graph.neighbors(nodeId);
    }, []);

    const getNodeLabel = useCallback((nodeId: string): string => {
        const graph = graphRef.current;
        if (!graph || !graph.hasNode(nodeId)) return nodeId;
        return (graph.getNodeAttribute(nodeId, 'label') as string) || nodeId;
    }, []);

    const refreshSize = useCallback(() => {
        sigmaRef.current?.refresh();
    }, []);

    return {
        containerRef,
        minimapRef,
        fitView,
        zoomIn,
        zoomOut,
        focusNode,
        startLayout,
        stopLayout,
        applyLayout,
        exportPNG,
        getNeighborIds,
        getNodeLabel,
        refreshSize,
        isLayoutRunning,
        status,
        hoveredNode,
    };
}
