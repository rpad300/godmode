/**
 * Purpose:
 *   Centralized theme definitions and lookup function for graph node cards.
 *   Maps entity types and tiers to Tailwind CSS class sets for consistent
 *   visual styling across the knowledge graph.
 *
 * Responsibilities:
 *   - Defines the NodeTheme type (bg, border, accent, glow, text, badge,
 *     optional avatar)
 *   - getNodeTheme(): returns the appropriate color theme based on entity
 *     type string and tier number, with a slate fallback for unknown types
 *
 * Key dependencies:
 *   - None (pure data module)
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Uses Tailwind's dark palette (e.g., from-blue-950/80) designed for
 *     the graph's dark-themed viewport.
 *   - Person vs Contact distinction uses green vs teal palettes.
 *   - Dynamic class strings like `from-${base}-950/80` require Tailwind
 *     JIT or safelist configuration to generate correctly.
 */
export type NodeTheme = {
    bg: string;
    border: string;
    accent: string;
    glow: string;
    text: string;
    badge: string;
    avatar?: string;
};

export const getNodeTheme = (type: string, tier: number): NodeTheme => {
    // Normalize type
    const t = type?.toLowerCase() || '';

    // Tier 0
    if (t === 'project' || tier === 0) {
        return {
            bg: "from-blue-950/80 to-blue-900/60",
            border: "border-blue-500/50",
            accent: "bg-blue-500",
            glow: "shadow-blue-500/20",
            text: "text-blue-300",
            badge: "bg-blue-900/80 text-blue-300"
        };
    }

    // Tier 1
    if (t === 'document') {
        return {
            bg: "from-amber-950/80 to-amber-900/60",
            border: "border-amber-500/50",
            accent: "bg-amber-500",
            glow: "shadow-amber-500/20",
            text: "text-amber-300",
            badge: "bg-amber-900/80 text-amber-300"
        };
    }
    if (t === 'person' || t === 'contact') {
        const isContact = t === 'contact';
        const base = isContact ? 'teal' : 'green';
        return {
            bg: `from-${base}-950/80 to-${base}-900/60`,
            border: `border-${base}-500/50`,
            accent: `bg-${base}-500`,
            glow: `shadow-${base}-500/20`,
            text: `text-${base}-300`,
            badge: `bg-${base}-900/80 text-${base}-300`,
            avatar: `bg-${base}-700`
        };
    }
    if (t === 'team') {
        return {
            bg: "from-purple-950/80 to-purple-900/60",
            border: "border-purple-500/50",
            accent: "bg-purple-500",
            glow: "shadow-purple-500/20",
            text: "text-purple-300",
            badge: "bg-purple-900/80 text-purple-300",
            avatar: "bg-purple-700"
        };
    }
    if (t === 'sprint') {
        return {
            bg: "from-indigo-950/80 to-indigo-900/60",
            border: "border-indigo-500/50",
            accent: "bg-indigo-500",
            glow: "shadow-indigo-500/20",
            text: "text-indigo-300",
            badge: "bg-indigo-900/80 text-indigo-300"
        };
    }
    if (t === 'email') {
        return {
            bg: "from-slate-900/80 to-slate-800/60",
            border: "border-slate-400/50",
            accent: "bg-slate-400",
            glow: "shadow-slate-400/20",
            text: "text-slate-300",
            badge: "bg-slate-800/80 text-slate-300"
        };
    }
    if (t === 'calendarevent' || t === 'event') {
        return {
            bg: "from-cyan-950/80 to-cyan-900/60",
            border: "border-cyan-500/50",
            accent: "bg-cyan-500",
            glow: "shadow-cyan-500/20",
            text: "text-cyan-300",
            badge: "bg-cyan-900/80 text-cyan-300"
        };
    }

    // Tier 2
    if (t === 'fact') {
        return {
            bg: "from-sky-950/80 to-sky-900/60",
            border: "border-sky-400/50",
            accent: "bg-sky-400",
            glow: "shadow-sky-400/20",
            text: "text-sky-300",
            badge: "bg-sky-900/80 text-sky-300"
        };
    }
    if (t === 'decision') {
        return {
            bg: "from-orange-950/80 to-orange-900/60",
            border: "border-orange-500/50",
            accent: "bg-orange-500",
            glow: "shadow-orange-500/20",
            text: "text-orange-300",
            badge: "bg-orange-900/80 text-orange-300"
        };
    }
    if (t === 'risk') {
        return {
            bg: "from-red-950/80 to-red-900/60",
            border: "border-red-500/50",
            accent: "bg-red-500",
            glow: "shadow-red-500/20",
            text: "text-red-300",
            badge: "bg-red-900/80 text-red-300"
        };
    }
    if (t === 'action') {
        return {
            bg: "from-emerald-950/80 to-emerald-900/60",
            border: "border-emerald-500/50",
            accent: "bg-emerald-500",
            glow: "shadow-emerald-500/20",
            text: "text-emerald-300",
            badge: "bg-emerald-900/80 text-emerald-300"
        };
    }
    if (t === 'question') {
        return {
            bg: "from-violet-950/80 to-violet-900/60",
            border: "border-violet-400/50",
            accent: "bg-violet-400",
            glow: "shadow-violet-400/20",
            text: "text-violet-300",
            badge: "bg-violet-900/80 text-violet-300"
        };
    }
    if (t === 'userstory') {
        return {
            bg: "from-pink-950/80 to-pink-900/60",
            border: "border-pink-500/50",
            accent: "bg-pink-500",
            glow: "shadow-pink-500/20",
            text: "text-pink-300",
            badge: "bg-pink-900/80 text-pink-300"
        };
    }

    // Default fallback
    return {
        bg: "from-slate-950/80 to-slate-900/60",
        border: "border-slate-500/50",
        accent: "bg-slate-500",
        glow: "shadow-slate-500/20",
        text: "text-slate-300",
        badge: "bg-slate-900/80 text-slate-300"
    };
};
