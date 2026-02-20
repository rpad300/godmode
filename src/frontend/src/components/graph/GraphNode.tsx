/**
 * Purpose:
 *   Legacy React Flow custom node renderer that displays entities as
 *   compact cards with category-specific icons, avatars, and status
 *   indicators. This is the original node component before the tier-based
 *   card system was introduced.
 *
 * Responsibilities:
 *   - Renders a node card with a colored left border based on entity category
 *   - Maps entity categories to Lucide icons via iconMap
 *   - Provides special rendering for "person" nodes (avatar with fallback)
 *   - Shows status dots with color-coded semantics (green/yellow/red/blue)
 *   - Supports highlighted and dimmed visual states for graph filtering
 *   - Exposes top/bottom React Flow handles for edge connections
 *
 * Key dependencies:
 *   - @xyflow/react (Handle, Position, NodeProps): edge connection handles
 *   - entityTypes (graph-data): category-to-color mapping
 *   - Avatar (shadcn/ui): person node avatar rendering
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - The GraphNodeData interface is exported and used elsewhere.
 *   - Contains a typo in "Helpert" (should be "Helper") at getStatusColor.
 *   - This component coexists with GraphCardNode; Assumption: GraphCardNode
 *     is the newer replacement and this may be deprecated.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { entityTypes } from '@/data/graph-data';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  FileText, User, Building, Layers, CheckSquare, AlertTriangle,
  File, MessageSquare, Briefcase, Calendar, Shield, HelpCircle,
  Lightbulb, Mail, Target
} from 'lucide-react';
import { cn, getInitials } from "@/lib/utils";

// Mapping icons for lucide
const iconMap: Record<string, any> = {
  document: FileText,
  person: User,
  project: Layers,
  task: CheckSquare,
  risk: AlertTriangle,
  conversation: MessageSquare,
  meeting: Calendar,
  organization: Building,
  client: Briefcase,
  regulation: Shield,
  question: HelpCircle,
  decision: Lightbulb,
  email: Mail,
  goal: Target,
  // Fallback
  default: File
};

export interface GraphNodeData {
  label: string;
  category: string;
  subtitle?: string; // Role or extra info
  detail?: string;   // Status or count
  highlighted?: boolean;
  dimmed?: boolean;
  avatarUrl?: string; // specific for Person
  fileType?: string;  // specific for Document
  status?: string;    // specific for Document/Task/Project
  [key: string]: unknown;
}

const GraphNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as GraphNodeData;
  const category = (nodeData.category || 'project').toLowerCase();
  const et = entityTypes.find(e => e.key === category);
  const color = et?.color || '#6b7280';
  const highlighted = nodeData.highlighted;
  const dimmed = nodeData.dimmed;

  const Icon = iconMap[category] || iconMap.default;

  // Helpert to get status color
  function getStatusColor(status?: string) {
    if (!status) return 'bg-gray-400';
    const s = status.toLowerCase();
    if (['completed', 'processed', 'approved', 'active', 'done'].includes(s)) return 'bg-green-500';
    if (['pending', 'in_progress', 'processing', 'planning'].includes(s)) return 'bg-yellow-500';
    if (['failed', 'rejected', 'risk', 'blocked', 'overdue'].includes(s)) return 'bg-red-500';
    return 'bg-blue-500';
  }

  // Render content based on type
  const renderContent = () => {
    // Person (Avatar)
    if (category === 'person') {
      return (
        <>
          <Avatar className="h-9 w-9 border-2 border-background shadow-sm shrink-0">
            <AvatarImage src={nodeData.avatarUrl} alt={nodeData.label} />
            <AvatarFallback className="text-[10px] bg-white/5 text-slate-400 font-bold">
              {getInitials(nodeData.label)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] font-bold text-white truncate w-full" title={nodeData.label}>
              {nodeData.label || '(unnamed)'}
            </span>
            {nodeData.subtitle && (
              <span className="text-[9px] text-slate-400 truncate w-full">
                {nodeData.subtitle}
              </span>
            )}
          </div>
        </>
      );
    }

    // Default (Icon) - Document, Project, etc.
    return (
      <>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-colors"
          style={{ backgroundColor: color + '15', color: color }}
        >
          <Icon size={16} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-semibold text-white truncate w-full" title={nodeData.label}>
            {nodeData.label || '(unnamed)'}
          </span>
          {(nodeData.subtitle || nodeData.detail || nodeData.status) && (
            <span className="text-[9px] text-slate-400 truncate w-full flex items-center gap-1.5 mt-0.5">
              {nodeData.status && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusColor(nodeData.status)}`} />
              )}
              {nodeData.subtitle || nodeData.detail || (nodeData.status ? nodeData.status.replace('_', ' ') : '')}
            </span>
          )}
        </div>
      </>
    );
  };

  return (
    <div className={cn(
      "relative transition-all duration-300 group",
      dimmed ? 'opacity-30 blur-[0.5px] grayscale' : 'opacity-100',
      highlighted ? 'z-50' : 'z-10'
    )}>
      <Handle type="target" position={Position.Top} className="!w-0 !h-0 !border-0 !bg-transparent" />

      <div
        className={cn(
          "flex items-center gap-3 px-2.5 py-2 rounded-xl border bg-[var(--gm-surface-primary)] backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-w-[170px] max-w-[240px]",
          selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary' : 'border-white/10 hover:border-white/10',
          highlighted ? 'scale-105 shadow-xl ring-1 ring-primary/30 border-primary/50' : 'hover:scale-[1.02]'
        )}
        style={{
          borderLeftWidth: '3px',
          borderLeftColor: color
        }}
      >
        {renderContent()}
      </div>

      {/* Connector dot visual fix */}
      {!dimmed && (
        <>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !border-0 !bg-transparent" />
    </div>
  );
};

export default memo(GraphNode);
