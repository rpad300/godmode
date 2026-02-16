import React, { useMemo } from 'react';
import { Clock, Users, Sun, Star, Info } from 'lucide-react';
import { Contact } from '@/types/godmode';
import { cn } from '@/lib/utils';
import { format, addHours, startOfDay, isSameDay } from 'date-fns';

interface GoldenHoursProps {
    className?: string;
    contacts: Contact[];
}

export const GoldenHours: React.FC<GoldenHoursProps & { allContacts?: Contact[] }> = ({ className, contacts: teamContacts, allContacts = [] }) => {
    const [mode, setMode] = React.useState<'team' | 'all'>('team');
    const currentTime = new Date();

    // Use the appropriate list based on mode
    const displayContacts = mode === 'team' ? teamContacts : allContacts;

    // De-duplicate contacts by ID just in case
    const uniqueContacts = useMemo(() => {
        const seen = new Set();
        return displayContacts.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }, [displayContacts]);

    // Group contacts by timezone to avoid duplicate rows
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
            // Simple offset calculation (approximate for MVP)
            offset: getTimezoneOffset(tz)
        }));
    }, [uniqueContacts]);

    // Calculate generic "Golden Hours" (overlap)
    // For MVP, we'll hardcode a logic or use a simple intersection of 9-18
    // This is a visualization component, so we calculate "work hours" bars relative to UTC/Local

    return (
        <div className={cn("space-y-4", className)}>
            <div className="golden-hours-header flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                    <div className="p-1.5 bg-yellow-500/10 rounded-lg">
                        <Sun className="w-5 h-5 text-yellow-500" />
                    </div>
                    <h3 className="font-semibold text-lg">Golden Hours</h3>
                </div>
                <span className="text-sm text-muted-foreground font-medium">
                    {format(currentTime, 'HH:mm')} your time
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="golden-card bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 space-y-6 shadow-sm">

                    {/* Contacts Header & Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setMode('team')}
                                className={cn(
                                    "flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg",
                                    mode === 'team'
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                )}
                            >
                                <Users className="w-4 h-4" />
                                <span>Team Availability</span>
                                <span className="bg-background/50 text-foreground px-1.5 py-0.5 rounded text-xs ml-1 border border-border/50">
                                    {teamContacts.length}
                                </span>
                            </button>

                            <div className="h-4 w-px bg-border/50" />

                            <button
                                onClick={() => setMode('all')}
                                className={cn(
                                    "flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg",
                                    mode === 'all'
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                )}
                            >
                                <Users className="w-4 h-4" />
                                <span>All Contacts</span>
                                <span className="bg-background/50 text-foreground px-1.5 py-0.5 rounded text-xs ml-1 border border-border/50">
                                    {allContacts.length}
                                </span>
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs text-muted-foreground">Live</span>
                        </div>
                    </div>

                    {/* People List */}
                    <div className="people-list flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                        {uniqueContacts.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-4 px-2 italic">No contacts found in this view.</div>
                        ) : (
                            uniqueContacts.map(contact => (
                                <div key={contact.id} className="flex flex-col items-center min-w-[70px] space-y-1 group cursor-pointer">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-br from-border to-transparent group-hover:from-yellow-500/50 transition-all">
                                            <img
                                                src={contact.avatar || contact.avatarUrl || `https://i.pravatar.cc/150?u=${contact.id}`}
                                                alt={contact.name}
                                                className="w-full h-full rounded-full object-cover border-2 border-background"
                                                onError={(e) => {
                                                    // Fallback if image fails
                                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`;
                                                }}
                                            />
                                        </div>
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full"></div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium truncate w-[70px] leading-tight">{contact.name.split(' ')[0]}</p>
                                        <p className="text-[10px] text-muted-foreground">{getLocalDate(contact.timezone)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Timezone Visualization */}
                    <div className="timezone-viz space-y-3 relative py-4">
                        {/* Axis Lines */}
                        <div className="absolute inset-0 flex justify-between px-[10%] pointer-events-none h-full w-full">
                            {[0, 6, 12, 18, 24].map((bucket) => (
                                <div key={bucket} className="h-full border-r border-dashed border-border/30 first:border-l relative w-px">
                                    <span className="absolute -top-4 -translate-x-1/2 text-[10px] text-muted-foreground/50">{bucket}:00</span>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3 relative z-10 pt-2">
                            {/* Only show distinct timezones from the current list */}
                            {timezones.slice(0, 5).map((tz, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-24 text-xs font-medium text-muted-foreground truncate text-right">
                                        {tz.tz.split('/')[1]?.replace('_', ' ') || tz.tz}
                                    </div>
                                    <div className="flex-1 h-8 bg-secondary/30 rounded-md relative overflow-hidden">
                                        {renderWorkHoursBar(tz.offset)}
                                    </div>
                                </div>
                            ))}
                            {timezones.length === 0 && (
                                <div className="text-center text-xs text-muted-foreground py-4">
                                    Add contacts with timezones to see availability overlap.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Box */}
                    <div className="golden-summary p-4 rounded-xl bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-transparent border border-yellow-500/10 flex items-start gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg shrink-0 mt-0.5">
                            <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">Golden Hours: 14:00 - 17:00</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                                Checking <strong>4+ hours</strong> of overlap for the {mode === 'team' ? 'team' : 'contacts'}.
                                Best time to schedule mostly synchronous meetings.
                            </p>
                        </div>
                    </div>

                    {/* Meeting Suggestions */}
                    <div className="space-y-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Suggested Slots</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {['Today, 14:30', 'Today, 16:00', 'Tomorrow, 10:00', 'Tomorrow, 15:00'].map((time, i) => (
                                <button key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary/70 border border-transparent hover:border-border transition-all text-xs group cursor-pointer text-left">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                                        <span className="font-medium">{time}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-background/50 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                                        <Users className="w-3 h-3" />
                                        <span>{uniqueContacts.length}/{uniqueContacts.length}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helpers
function getTimezoneOffset(timeZone: string): number {
    try {
        const date = new Date();
        const str = date.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
        // str "2/11/2025, 12:00:00 PM GMT+1"
        const parts = str.split('GMT');
        if (parts.length > 1) {
            const offsetStr = parts[1].trim();
            // +1, -5:30
            const sign = offsetStr.startsWith('-') ? -1 : 1;
            const [h, m] = offsetStr.replace('+', '').replace('-', '').split(':').map(Number);
            return sign * (h + (m || 0) / 60);
        }
    } catch (e) { }
    return 0;
}

function getLocalDate(timeZone: string) {
    try {
        return new Date().toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return "12:00";
    }
}

function renderWorkHoursBar(offset: number) {
    // Assume chart is 0-24 UTC.
    // Work hours 9-18 Local.
    // UTC start = 9 - offset.
    // UTC end = 18 - offset.

    // Normalize to 0-24
    let start = 9 - offset;
    let end = 18 - offset;

    // Handle wrap around roughly? Simplification: just clamp or shift
    // Ideally we render multiple bars if it wraps, but for MVP simplified

    const width = ((end - start) / 24) * 100;
    const left = (start / 24) * 100;

    return (
        <>
            {/* Work hours gray */}
            <div
                className="absolute h-full bg-slate-400/20 top-0 rounded-sm"
                style={{
                    left: `${Math.max(0, left)}%`,
                    width: `${width}%`
                }}
            />
            {/* Golden hours - illustrative overlap (e.g. 14-17 UTC) */}
            <div
                className="absolute h-1/2 top-1/4 bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full opacity-80 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                style={{
                    left: `${(14 / 24) * 100}%`,
                    width: `${(3 / 24) * 100}%`
                }}
            />
        </>
    )
}
