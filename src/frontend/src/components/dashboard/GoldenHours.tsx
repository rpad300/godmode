/**
 * Purpose:
 *   Dashboard widget that visualizes timezone overlap ("golden hours")
 *   across team members and contacts, helping users find optimal meeting
 *   windows.
 *
 * Responsibilities:
 *   - Toggles between "Team Availability" and "All Contacts" views
 *   - Renders a horizontal scrollable contact strip with avatars and
 *     local time labels
 *   - Groups contacts by timezone and draws work-hour bars (9:00-18:00
 *     local mapped to UTC 0-24 axis) for up to 5 timezones
 *   - Dynamically computes the overlap zone across all displayed timezones
 *   - Shows a summary card with overlap duration and scheduling advice
 *   - Renders four suggested meeting slot buttons
 *
 * Key dependencies:
 *   - date-fns (format): current time display
 *   - Contact (godmode types): contact shape with timezone field
 *   - cn (utils): conditional class merging
 */
import React, { useMemo } from 'react';
import { Clock, Users, Sun, Star, AlertTriangle, Globe } from 'lucide-react';
import { Contact } from '@/types/godmode';
import { cn, resolveAvatarUrl, getInitials } from '@/lib/utils';

interface GoldenHoursProps {
    className?: string;
    contacts: Contact[];
}

export const GoldenHours: React.FC<GoldenHoursProps & { allContacts?: Contact[] }> = ({ className, contacts: teamContacts, allContacts = [] }) => {
    const [mode, setMode] = React.useState<'team' | 'all'>('team');
    const currentTime = new Date();

    const displayContacts = mode === 'team' ? teamContacts : allContacts;

    const uniqueContacts = useMemo(() => {
        const seen = new Set();
        return displayContacts.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }, [displayContacts]);

    const timezones = useMemo(() => {
        const tzMap = new Map<string, Contact[]>();
        uniqueContacts.forEach(contact => {
            const tz = contact.timezone || 'UTC';
            if (!tzMap.has(tz)) tzMap.set(tz, []);
            tzMap.get(tz)?.push(contact);
        });
        return Array.from(tzMap.entries()).map(([tz, contacts]) => ({
            tz,
            contacts,
            offset: getTimezoneOffset(tz)
        }));
    }, [uniqueContacts]);

    const goldenWindow = useMemo(() => computeGoldenHours(timezones.map(t => t.offset)), [timezones]);

    const currentHourUTC = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60;

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gm-text-primary">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <Sun className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className="font-semibold text-lg">Golden Hours</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-gm-text-tertiary" />
                    <span className="text-sm text-gm-text-secondary font-medium">
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} your time
                    </span>
                </div>
            </div>

            <div className="golden-card bg-gm-surface-secondary backdrop-blur-sm border border-gm-border-primary rounded-xl p-5 space-y-6">
                {/* Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMode('team')}
                            className={cn(
                                "flex items-center gap-2 text-sm font-medium transition-all px-3 py-1.5 rounded-lg",
                                mode === 'team'
                                    ? "bg-blue-600/10 text-gm-interactive-primary"
                                    : "text-gm-text-tertiary hover:bg-gm-surface-hover hover:text-gm-text-primary"
                            )}
                        >
                            <Users className="w-4 h-4" />
                            <span>Team</span>
                            <span className="bg-gm-bg-secondary text-gm-text-primary px-1.5 py-0.5 rounded text-xs ml-1 border border-gm-border-primary">
                                {teamContacts.length}
                            </span>
                        </button>

                        <div className="h-4 w-px bg-gm-border-primary" />

                        <button
                            onClick={() => setMode('all')}
                            className={cn(
                                "flex items-center gap-2 text-sm font-medium transition-all px-3 py-1.5 rounded-lg",
                                mode === 'all'
                                    ? "bg-blue-600/10 text-gm-interactive-primary"
                                    : "text-gm-text-tertiary hover:bg-gm-surface-hover hover:text-gm-text-primary"
                            )}
                        >
                            <Users className="w-4 h-4" />
                            <span>All Contacts</span>
                            <span className="bg-gm-bg-secondary text-gm-text-primary px-1.5 py-0.5 rounded text-xs ml-1 border border-gm-border-primary">
                                {allContacts.length}
                            </span>
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-gm-text-tertiary">Live</span>
                    </div>
                </div>

                {/* People Strip */}
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                    {uniqueContacts.length === 0 ? (
                        <div className="text-sm text-gm-text-tertiary py-4 px-2 italic">
                            No contacts with timezones found. Add timezones to your contacts to see availability.
                        </div>
                    ) : (
                        uniqueContacts.map(contact => (
                            <div key={contact.id} className="flex flex-col items-center min-w-[70px] space-y-1 group cursor-pointer">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-br from-gm-border-primary to-transparent group-hover:from-amber-500/50 transition-all">
                                        {resolveAvatarUrl(contact as any) ? (
                                            <img
                                                src={resolveAvatarUrl(contact as any)!}
                                                alt={contact.name}
                                                className="w-full h-full rounded-full object-cover border-2 border-gm-bg-primary"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); }}
                                            />
                                        ) : null}
                                        <div className={cn(
                                            'w-full h-full rounded-full border-2 border-gm-bg-primary bg-blue-600/20 flex items-center justify-center text-xs font-bold text-gm-interactive-primary',
                                            resolveAvatarUrl(contact as any) ? 'hidden' : ''
                                        )}>
                                            {getInitials(contact.name)}
                                        </div>
                                    </div>
                                    {isInWorkHours(contact.timezone) && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-gm-bg-primary rounded-full" />
                                    )}
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-medium text-gm-text-primary truncate w-[70px] leading-tight">
                                        {contact.name.split(' ')[0]}
                                    </p>
                                    <p className="text-[10px] text-gm-text-tertiary">{getLocalTime(contact.timezone)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Timezone Bars */}
                {timezones.length > 0 && (
                    <div className="space-y-3 relative py-4">
                        {/* UTC axis labels */}
                        <div className="absolute inset-0 flex justify-between px-[calc(96px+12px)] pointer-events-none h-full w-full">
                            {[0, 6, 12, 18, 24].map((h) => (
                                <div key={h} className="h-full border-r border-dashed border-[var(--gm-border-primary)] first:border-l relative w-px">
                                    <span className="absolute -top-4 -translate-x-1/2 text-[10px] text-gray-500">{h}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* "Now" indicator */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-blue-600/60 z-20 pointer-events-none"
                            style={{ left: `calc(108px + ${(currentHourUTC / 24) * 100}% * (1 - 108px / 100%))` }}
                        >
                            <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-semibold text-gm-interactive-primary bg-gm-bg-primary px-1 rounded">
                                NOW
                            </span>
                        </div>

                        <div className="space-y-3 relative z-10 pt-2">
                            {timezones.slice(0, 6).map((tz, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-24 text-xs font-medium text-gm-text-tertiary truncate text-right" title={tz.tz}>
                                        {formatTzLabel(tz.tz)}
                                        <span className="block text-[10px] text-gm-text-placeholder">
                                            UTC{tz.offset >= 0 ? '+' : ''}{tz.offset}
                                        </span>
                                    </div>
                                    <div className="flex-1 h-8 bg-[var(--gm-surface-hover)] rounded-md relative overflow-hidden">
                                        {renderWorkHoursBar(tz.offset)}
                                        {goldenWindow && renderGoldenOverlay(goldenWindow)}
                                    </div>
                                    <div className="w-8 text-[10px] text-gm-text-tertiary text-center">
                                        {tz.contacts.length}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 pt-2 text-[10px] text-gm-text-tertiary">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-2 rounded-sm bg-blue-600/20" />
                                Work hours (9-18 local)
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
                                Golden overlap
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {goldenWindow ? (
                    <div className="golden-summary p-4 rounded-xl bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent border border-amber-500/10 flex items-start gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg shrink-0 mt-0.5">
                            <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                                Golden Hours: {formatHour(goldenWindow.start)} – {formatHour(goldenWindow.end)} UTC
                            </h4>
                            <p className="text-xs text-gm-text-secondary mt-1">
                                <strong>{goldenWindow.duration}h</strong> of overlap across {timezones.length} timezone{timezones.length > 1 ? 's' : ''}.
                                {goldenWindow.duration >= 3
                                    ? ' Great window for synchronous meetings.'
                                    : goldenWindow.duration >= 1
                                        ? ' Tight — prioritize short standups.'
                                        : ' Very limited overlap — consider async.'}
                            </p>
                        </div>
                    </div>
                ) : timezones.length > 0 ? (
                    <div className="golden-summary golden-summary-warning p-4 rounded-xl bg-gradient-to-r from-red-500/5 via-red-500/3 to-transparent border border-red-500/15 flex items-start gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg shrink-0 mt-0.5">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-red-600 dark:text-red-400">No Overlap Found</h4>
                            <p className="text-xs text-gm-text-secondary mt-1">
                                There are no common work hours across these timezones. Consider async communication or rotating meeting times.
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* Suggested Slots */}
                {goldenWindow && (
                    <div className="space-y-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Suggested Slots</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {getSuggestedSlots(goldenWindow).map((slot, i) => (
                                <button
                                    key={i}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--gm-surface-hover)] hover:bg-gm-surface-hover border border-transparent hover:border-gm-border-primary transition-all text-xs group cursor-pointer text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-gm-text-tertiary group-hover:text-gm-text-primary transition-colors" />
                                        <span className="font-medium text-gm-text-primary">{slot}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-gm-bg-secondary px-1.5 py-0.5 rounded text-[10px] text-gm-text-tertiary">
                                        <Users className="w-3 h-3" />
                                        <span>{uniqueContacts.length}/{uniqueContacts.length}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTimezoneOffset(timeZone: string): number {
    try {
        const date = new Date();
        const str = date.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
        const parts = str.split('GMT');
        if (parts.length > 1) {
            const offsetStr = parts[1].trim();
            const sign = offsetStr.startsWith('-') ? -1 : 1;
            const [h, m] = offsetStr.replace('+', '').replace('-', '').split(':').map(Number);
            return sign * (h + (m || 0) / 60);
        }
    } catch { /* fallback */ }
    return 0;
}

function getLocalTime(timeZone?: string) {
    try {
        if (!timeZone) return '—';
        return new Date().toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return '—';
    }
}

function isInWorkHours(timeZone?: string): boolean {
    try {
        if (!timeZone) return false;
        const h = Number(new Date().toLocaleString('en-US', { timeZone, hour: 'numeric', hour12: false }));
        return h >= 9 && h < 18;
    } catch {
        return false;
    }
}

function formatTzLabel(tz: string): string {
    const city = tz.split('/').pop()?.replace(/_/g, ' ');
    return city || tz;
}

function formatHour(h: number): string {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

interface GoldenWindow {
    start: number;
    end: number;
    duration: number;
}

function computeGoldenHours(offsets: number[]): GoldenWindow | null {
    if (offsets.length === 0) return null;

    let overlapStart = 0;
    let overlapEnd = 24;

    for (const offset of offsets) {
        const workStart = 9 - offset;
        const workEnd = 18 - offset;
        overlapStart = Math.max(overlapStart, workStart);
        overlapEnd = Math.min(overlapEnd, workEnd);
    }

    const duration = overlapEnd - overlapStart;
    if (duration <= 0) return null;

    return { start: overlapStart, end: overlapEnd, duration: Math.round(duration * 10) / 10 };
}

function getSuggestedSlots(gw: GoldenWindow): string[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLabel = 'Today';
    const tomorrowLabel = 'Tomorrow';
    const mid = (gw.start + gw.end) / 2;

    const slot1 = Math.max(gw.start, Math.floor(gw.start) + 0.5);
    const slot2 = Math.min(gw.end - 0.5, Math.ceil(mid));

    return [
        `${todayLabel}, ${formatHour(slot1)} UTC`,
        `${todayLabel}, ${formatHour(slot2)} UTC`,
        `${tomorrowLabel}, ${formatHour(slot1)} UTC`,
        `${tomorrowLabel}, ${formatHour(slot2)} UTC`,
    ];
}

function renderWorkHoursBar(offset: number) {
    const start = 9 - offset;
    const end = 18 - offset;
    const width = ((end - start) / 24) * 100;
    const left = (start / 24) * 100;

    return (
        <div
            className="absolute h-full bg-blue-600/15 top-0 rounded-sm"
            style={{
                left: `${Math.max(0, left)}%`,
                width: `${Math.min(100 - Math.max(0, left), width)}%`
            }}
        />
    );
}

function renderGoldenOverlay(gw: GoldenWindow) {
    const left = (gw.start / 24) * 100;
    const width = (gw.duration / 24) * 100;
    return (
        <div
            className="absolute h-1/2 top-1/4 bg-gradient-to-r from-amber-500 to-amber-400 rounded-full opacity-80 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
            style={{ left: `${left}%`, width: `${width}%` }}
        />
    );
}
