
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeTheme } from './node-styles';
import { cn } from '@/lib/utils';

// --- ICONS MAPPING ---
// Using strings as placeholders if actual Lucide icons aren't passed, 
// but since the original file imported Lucide icons, we should try to use them or match the user's emojis if preferred.
// The user used Emojis. For a "premium" feel (as per system instructions), Lucide icons are usually better, 
// BUT the request explicitly said "aparencia com isto" (appearance like this) and provided emojis.
// I will stick to Emojis as requested for exact visual match, OR use Lucide icons if I can match the style. 
// Given "premium" requirement, I'll mix: use emojis where they look good (text context) or Lucide where standardized.
// actually, let's stick to the prompt's emojis to ensure "appearance with this" is satisfied accurately.

export const NodeContentRenderer = ({ type, data, theme }: { type: string, data: any, theme: NodeTheme }) => {
    const t = type?.toLowerCase() || 'default';

    switch (t) {
        case 'project': return <ProjectBody data={data} theme={theme} />;
        case 'document': return <DocumentBody data={data} theme={theme} />;
        case 'person': return <PersonBody data={data} theme={theme} />;
        case 'contact': return <PersonBody data={data} theme={theme} />;
        case 'team': return <TeamBody data={data} theme={theme} />;
        case 'sprint': return <SprintBody data={data} theme={theme} />;
        case 'email': return <EmailBody data={data} theme={theme} />;
        case 'calendarevent': return <EventBody data={data} theme={theme} />;
        case 'fact': return <FactBody data={data} theme={theme} />;
        case 'decision': return <DecisionBody data={data} theme={theme} />;
        case 'risk': return <RiskBody data={data} theme={theme} />;
        case 'action': return <ActionBody data={data} theme={theme} />;
        case 'question': return <QuestionBody data={data} theme={theme} />;
        case 'userstory': return <UserStoryBody data={data} theme={theme} />;
        default: return <DefaultBody data={data} type={type} theme={theme} />;
    }
};

// --- HELPERS ---

const StatusDot = ({ status }: { status: string }) => {
    const s = status?.toLowerCase() || '';
    let color = "bg-slate-500";

    if (['processed', 'completed', 'approved', 'active', 'ready'].includes(s)) color = "bg-green-400";
    else if (['processing', 'proposed'].includes(s)) color = "bg-yellow-400";
    else if (s === 'in_progress') color = "bg-blue-400";
    else if (['failed', 'rejected'].includes(s)) color = "bg-red-400";
    else if (s === 'open') color = "bg-amber-400";

    return <div className={cn("w-2 h-2 rounded-full", color, s === "open" && "animate-pulse")} />;
};

const ConfidenceBar = ({ value }: { value: number }) => {
    const v = value || 0;
    const color = v >= 0.8 ? "bg-green-400" : v >= 0.5 ? "bg-amber-400" : "bg-red-400";
    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v * 100}%` }} />
            </div>
            <span className="text-[10px] text-slate-400">{v.toFixed(2)}</span>
        </div>
    );
};

// --- BODIES ---

const ProjectBody = ({ data, theme }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-start gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0", theme.accent)}>
                📋
            </div>
            <div className="min-w-0">
                <div className="text-base font-semibold text-white truncate">{data.name || data.label}</div>
                <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">{data.description || 'No description'}</div>
            </div>
        </div>
        <div className="flex gap-2 mt-2.5">
            {/* Use safe access checks */}
            {data.stats && (
                <>
                    <div className="flex items-center gap-1 bg-blue-900/50 px-2 py-0.5 rounded text-[10px] text-blue-300">
                        <span>📄</span><span className="font-semibold">{data.stats.docs || 0}</span><span className="text-blue-400">docs</span>
                    </div>
                    <div className="flex items-center gap-1 bg-blue-900/50 px-2 py-0.5 rounded text-[10px] text-blue-300">
                        <span>👥</span><span className="font-semibold">{data.stats.people || 0}</span><span className="text-blue-400">people</span>
                    </div>
                    <div className="flex items-center gap-1 bg-blue-900/50 px-2 py-0.5 rounded text-[10px] text-blue-300">
                        <span>⚠️</span><span className="font-semibold">{data.stats.risks || 0}</span><span className="text-blue-400">risks</span>
                    </div>
                </>
            )}
        </div>
    </>
);

const DocumentBody = ({ data }: { data: any, theme: NodeTheme }) => {
    // Map backend fields to UI fields if necessary
    const stats = {
        facts: data.facts_count || data.facts || 0,
        decisions: data.decisions_count || data.decisions || 0,
        risks: data.risks_count || data.risks || 0,
        actions: data.actions_count || data.actions || 0
    };

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm">{data.file_type === 'transcript' ? '🎙️' : '📄'}</span>
                    <span className="text-sm font-medium text-white truncate max-w-40">{data.name}</span>
                </div>
                <StatusDot status={data.status} />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{data.file_type || 'doc'} · {data.file_size || '0 KB'}</div>
            <div className="flex gap-1.5 mt-2">
                {stats.facts > 0 && <span className="bg-sky-900/60 text-sky-300 text-[10px] px-1.5 py-0.5 rounded font-medium">F {stats.facts}</span>}
                {stats.decisions > 0 && <span className="bg-orange-900/60 text-orange-300 text-[10px] px-1.5 py-0.5 rounded font-medium">D {stats.decisions}</span>}
                {stats.risks > 0 && <span className="bg-red-900/60 text-red-300 text-[10px] px-1.5 py-0.5 rounded font-medium">R {stats.risks}</span>}
                {stats.actions > 0 && <span className="bg-emerald-900/60 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-medium">A {stats.actions}</span>}
            </div>
        </>
    );
};

const PersonBody = ({ data, theme }: { data: any, theme: NodeTheme }) => (
    <div className="flex items-center gap-2.5">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden", theme.avatar)}>
            {(data.avatar_url || data.avatar || data.image) ? (
                <img src={data.avatar_url || data.avatar || data.image} alt="" className="w-full h-full object-cover" />
            ) : (
                <span className="text-xs font-bold text-white">{data.initials || (data.name ? data.name.substring(0, 2).toUpperCase() : '??')}</span>
            )}
        </div>
        <div className="min-w-0">
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-white truncate">{data.name}</span>
                {data.isFavorite && <span className="text-yellow-400 text-xs">★</span>}
            </div>
            {data.role && <div className={cn("text-xs", theme.text)}>{data.role}</div>}
            {data.org && <div className="text-[10px] text-slate-500">{data.org}</div>}
            {data.email && <div className="text-[10px] text-slate-600 font-mono truncate">{data.email}</div>}
            {!data.role && !data.org && data.mentionCount && (
                <div className="text-[10px] text-slate-500">mentioned in {data.mentionCount} docs</div>
            )}
            {data.department && <span className={cn("inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded", theme.badge)}>🏷️ {data.department}</span>}
        </div>
    </div>
);

const TeamBody = ({ data, theme }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-center gap-1.5">
            <span className="text-sm">👥</span>
            <span className="text-sm font-medium text-white">{data.name}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{data.teamType || 'Team'} · {data.memberCount || 0} members</div>
        {/* Member avatars would require member list in data */}
        {data.members && (
            <div className="flex items-center mt-2 -space-x-1.5">
                {data.members.slice(0, 4).map((m: any, i: number) => (
                    <div key={i} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold border-2 border-purple-950", theme.avatar)}>
                        {typeof m === 'string' ? m : m.initials || '?'}
                    </div>
                ))}
                {(data.memberCount || data.members.length) > 4 && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-[8px] font-bold border-2 border-purple-950">
                        +{(data.memberCount || data.members.length) - 4}
                    </div>
                )}
            </div>
        )}
    </>
);

const SprintBody = ({ data }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                <span className="text-sm">⚡</span>
                <span className="text-sm font-medium text-white">{data.name}</span>
            </div>
            <div className={cn("w-2 h-2 rounded-full", data.active ? "bg-green-400 animate-pulse" : "bg-slate-500")} />
        </div>
        <div className="text-[10px] text-slate-500 mt-1">{data.start_date || data.start} — {data.end_date || data.end}</div>
        <div className="mt-2">
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${data.progress || 0}%` }} />
            </div>
            <div className="text-[10px] text-indigo-300 mt-0.5 text-right">{data.progress || 0}%</div>
        </div>
    </>
);

const EmailBody = ({ data }: { data: any, theme: NodeTheme }) => {
    const isInbound = data.direction === 'inbound';
    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">📧</span>
                    <span className="text-sm font-medium text-white truncate">{data.name || data.subject}</span>
                </div>
                <span className={cn("text-xs", isInbound ? "text-blue-400" : "text-green-400")}>
                    {isInbound ? "←" : "→"}
                </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">from: {data.from || data.from_email}</div>
            <div className="text-[10px] text-slate-500">to: {data.to || data.to_email} {data.extraTo > 0 && `+${data.extraTo}`}</div>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-600">{data.date || new Date().toLocaleDateString()}</span>
                {data.attachments > 0 && <span className="text-[10px] text-slate-500">📎 {data.attachments}</span>}
            </div>
        </>
    );
};

const EventBody = ({ data, theme }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                <span className="text-sm">📅</span>
                <span className="text-sm font-medium text-white truncate">{data.name || data.title}</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-blue-400" />
        </div>
        <div className="text-[10px] text-slate-500 mt-1">{data.date || (data.start ? new Date(data.start).toLocaleDateString() : '')}</div>
        {data.location && <div className="text-[10px] text-slate-500">📍 {data.location}</div>}
        <div className="text-[10px] text-cyan-400 mt-0.5">👥 {data.participants || '?'} participants</div>
    </>
);

const FactBody = ({ data, theme }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                <span className="text-sm">💡</span>
                <span className="text-xs font-medium text-slate-400">Fact</span>
            </div>
            <span className="text-[9px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded">{data.category || 'general'}</span>
        </div>
        <div className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">"{data.name || data.content}"</div>
        <div className="flex items-center gap-2 mt-2">
            <ConfidenceBar value={data.confidence || 0.8} />
            {data.verified && <span className="text-green-400 text-xs">✅</span>}
        </div>
    </>
);

const DecisionBody = ({ data, theme }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                <span className="text-sm">⚖️</span>
                <span className="text-xs font-medium text-slate-400">Decision</span>
            </div>
            <StatusDot status={data.status} />
        </div>
        <div className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">"{data.name || data.content}"</div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
            <span>👤 {data.owner || 'Board'}</span>
            <span>·</span>
            <span>{data.date || (data.decision_date ? new Date(data.decision_date).toLocaleDateString() : '')}</span>
        </div>
    </>
);

const RiskBody = ({ data, theme }: { data: any, theme: NodeTheme }) => {
    const impact = (data.impact || 'medium').toLowerCase();
    const likelihood = (data.likelihood || 'medium').toLowerCase();

    // Helper for badge styles
    const getBadgeStyle = (level: string) => {
        if (level === 'high') return "bg-red-900/80 text-red-300";
        if (level === 'medium') return "bg-orange-900/80 text-orange-300";
        return "bg-green-900/80 text-green-300";
    }

    return (
        <>
            <div className="flex items-center gap-1.5">
                <span className="text-sm">⚠️</span>
                <span className="text-xs font-medium text-slate-400">Risk</span>
            </div>
            <div className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">"{data.name || data.content}"</div>
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold", getBadgeStyle(impact))}>
                        {impact.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-slate-600">×</span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded", getBadgeStyle(likelihood))}>
                        {likelihood.toUpperCase()}
                    </span>
                </div>
                <span className="text-[10px] text-slate-500">{data.status}</span>
            </div>
        </>
    );
};

const ActionBody = ({ data }: { data: any, theme: NodeTheme }) => {
    const priority = (data.priority || 'medium').toLowerCase();

    // Priority Colors
    const priorityColors: Record<string, string> = {
        critical: "bg-red-900/80 text-red-300 ring-1 ring-red-500/50",
        high: "bg-orange-900/80 text-orange-300",
        medium: "bg-yellow-900/80 text-yellow-300",
        low: "bg-slate-800/80 text-slate-400"
    };

    const isCritical = priority === 'critical';

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm">☑️</span>
                    <span className="text-xs font-medium text-slate-400">Action</span>
                </div>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold", priorityColors[priority] || priorityColors.low)}>
                    {priority}
                </span>
            </div>
            <div className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">"{data.name || data.content}"</div>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 flex-wrap">
                <span>👤 {data.owner || 'Me'}</span>
                {data.deadline && (
                    <>
                        <span>·</span>
                        <span className={isCritical ? "text-red-400 font-semibold" : ""}>⏰ {data.deadline}</span>
                    </>
                )}
            </div>
            <div className="mt-1.5">
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", data.status === "completed" ? "bg-green-400 w-full" : data.status === "in_progress" ? "bg-blue-400 w-3/5" : "bg-slate-600 w-0")} />
                </div>
            </div>
        </>
    );
};

const QuestionBody = ({ data }: { data: any, theme: NodeTheme }) => {
    const priority = (data.priority || 'medium').toLowerCase();
    const priorityColors: Record<string, string> = {
        critical: "bg-red-900/80 text-red-300 ring-1 ring-red-500/50",
        high: "bg-orange-900/80 text-orange-300",
        medium: "bg-yellow-900/80 text-yellow-300",
        low: "bg-slate-800/80 text-slate-400"
    };

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm">❓</span>
                    <span className="text-xs font-medium text-slate-400">Question</span>
                </div>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold", priorityColors[priority] || priorityColors.low)}>
                    {priority}
                </span>
            </div>
            <div className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">"{data.name || data.content}"</div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                <div className="flex items-center gap-1">
                    <StatusDot status={data.status} />
                    <span>{data.status}</span>
                </div>
                {data.category && (
                    <>
                        <span>·</span>
                        <span>{data.category}</span>
                    </>
                )}
            </div>
        </>
    );
};

const UserStoryBody = ({ data }: { data: any, theme: NodeTheme }) => (
    <>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                <span className="text-sm">📖</span>
                <span className="text-xs font-medium text-slate-400">User Story</span>
            </div>
            <StatusDot status={data.status} />
        </div>
        <div className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">"{data.name || data.content}"</div>
        <div className="flex items-center gap-2 mt-2 text-[10px]">
            <span className="bg-pink-900/60 text-pink-300 px-1.5 py-0.5 rounded font-semibold">📊 {data.story_points || data.points || 0} pts</span>
            <span className="text-slate-500">{data.done_count || data.done || 0}/{data.tasks_count || data.tasks || 0} tasks</span>
        </div>
    </>
);

const DefaultBody = ({ data, type }: { data: any, type: string, theme: NodeTheme }) => (
    <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold uppercase text-slate-400">{type}</span>
        </div>
        <p className="text-xs font-medium text-white line-clamp-2">
            {data.name || data.content || 'Entity'}
        </p>
    </div>
);
