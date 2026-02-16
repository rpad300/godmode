import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

export default function MultiEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    label,
    labelStyle,
    data
}: EdgeProps) {
    const curvature = (data?.curvature as number) ?? 0;

    // Custom Path Logic for Multi-Edges
    // We use the curvature to offset a quadratic bezier control point
    const getCustomPath = () => {
        // 1. Calculate Midpoint
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;

        // 2. Calculate Distance
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 3. Normalize Vector (Director)
        // Avoid division by zero
        const len = distance === 0 ? 1 : distance;
        const ux = dx / len;
        const uy = dy / len;

        // 4. Perpendicular Vector (-uy, ux) for 90 degree rotation
        const px = -uy;
        const py = ux;

        // 5. Calculate Control Point with Offset
        const offset = curvature * 50;

        // If curvature is 0, render it as a straight line or standard bezier
        // Standard Bezier is better for "Tier 0" edges usually, but straight is cleaner for radial
        if (Math.abs(curvature) < 0.05) {
            return [`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`, midX, midY] as const;
        }

        const controlX = midX + px * offset;
        const controlY = midY + py * offset;

        // 6. Quadratic Bezier Path
        const path = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;

        // Label position at t=0.5
        const labelX = 0.25 * sourceX + 0.5 * controlX + 0.25 * targetX;
        const labelY = 0.25 * sourceY + 0.5 * controlY + 0.25 * targetY;

        return [path, labelX, labelY] as const;
    };

    const [edgePath, labelX, labelY] = getCustomPath();

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 12,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan bg-card px-2 py-1 border rounded shadow-sm text-xs text-muted-foreground font-mono"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
