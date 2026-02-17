/**
 * Purpose:
 *   Reusable visual frame wrapper for all tier-based graph node cards,
 *   providing consistent styling, handles, and a left accent bar.
 *
 * Responsibilities:
 *   - Renders a themed container with gradient background, border, and
 *     optional glow effect when selected
 *   - Places invisible React Flow handles (top target, bottom source) for
 *     edge connection detection
 *   - Draws a left-side color accent bar using the theme's accent color
 *   - Accepts children for tier-specific content rendering
 *
 * Key dependencies:
 *   - @xyflow/react (Handle, Position): connection handles
 *   - NodeTheme (node-styles): theme object with bg, border, accent, glow
 *   - cn (utils): conditional class merging
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Handles are styled as invisible full-area overlays with
 *     pointer-events-none; edges connect via the node's center.
 *   - The `width` prop sets minWidth, not fixed width, allowing content
 *     to expand naturally.
 */
import { PropsWithChildren } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeTheme } from './node-styles';

interface GraphNodeFrameProps {
    theme: NodeTheme;
    selected?: boolean;
    width?: number | string;
    className?: string;
    onClick?: () => void;
    // If specific handles are needed, we can make them optional or default
}

export const GraphNodeFrame = ({
    theme,
    selected,
    width,
    className,
    children,
    onClick
}: PropsWithChildren<GraphNodeFrameProps>) => {

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative bg-gradient-to-br border rounded-lg",
                "transition-all duration-200 cursor-pointer overflow-hidden",
                theme.bg,
                theme.border,
                selected ? cn("shadow-lg scale-105 border-opacity-100", theme.glow) : "shadow-md",
                className
            )}
            style={{ minWidth: width }}
        >
            {/* Handles - Hidden/Centered by default as used in original code, adjust if visibility needed */}
            <Handle type="target" position={Position.Top} className="opacity-0 w-full h-full absolute inset-0 pointer-events-none" />
            <Handle type="source" position={Position.Bottom} className="opacity-0 w-full h-full absolute inset-0 pointer-events-none" />

            {/* Left accent bar */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", theme.accent)} />

            {/* Content */}
            <div className="pl-3.5 pr-3 py-2.5">
                {children}
            </div>
        </div>
    );
};
