/**
 * Calendar Integration
 * Sync with calendar for temporal context in briefings
 */

const fs = require('fs');
const path = require('path');

class CalendarIntegration {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.calendarFile = path.join(this.dataDir, 'calendar-events.json');
        this.data = this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.calendarFile = path.join(dataDir, 'calendar-events.json');
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.calendarFile)) {
                return JSON.parse(fs.readFileSync(this.calendarFile, 'utf8'));
            }
        } catch (e) {
            console.error('[CalendarIntegration] Load error:', e.message);
        }
        return {
            events: [],
            recurringRules: [],
            settings: {
                enabled: true,
                syncInterval: 3600000, // 1 hour
                lastSync: null
            }
        };
    }

    save() {
        try {
            fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(this.calendarFile, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[CalendarIntegration] Save error:', e.message);
        }
    }

    /**
     * Add a calendar event
     */
    addEvent(event) {
        const newEvent = {
            id: event.id || `evt_${Date.now()}`,
            title: event.title,
            description: event.description || '',
            start: event.start,
            end: event.end,
            allDay: event.allDay || false,
            location: event.location || '',
            attendees: event.attendees || [],
            category: event.category || 'meeting', // meeting, deadline, reminder, milestone
            tags: event.tags || [],
            recurrence: event.recurrence || null,
            reminder: event.reminder || null,
            createdAt: new Date().toISOString(),
            source: event.source || 'manual' // manual, ical, google, outlook
        };
        
        this.data.events.push(newEvent);
        this.save();
        
        return { success: true, event: newEvent };
    }

    /**
     * Update an event
     */
    updateEvent(eventId, updates) {
        const event = this.data.events.find(e => e.id === eventId);
        if (!event) {
            return { success: false, error: 'Event not found' };
        }
        
        const allowedFields = ['title', 'description', 'start', 'end', 'allDay', 'location', 
                              'attendees', 'category', 'tags', 'recurrence', 'reminder'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                event[field] = updates[field];
            }
        });
        
        event.updatedAt = new Date().toISOString();
        this.save();
        
        return { success: true, event };
    }

    /**
     * Delete an event
     */
    deleteEvent(eventId) {
        const index = this.data.events.findIndex(e => e.id === eventId);
        if (index === -1) {
            return { success: false, error: 'Event not found' };
        }
        
        this.data.events.splice(index, 1);
        this.save();
        
        return { success: true };
    }

    /**
     * Get events for a date range
     */
    getEvents(options = {}) {
        const { 
            start = new Date(), 
            end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category = null,
            tags = null
        } = options;
        
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        let events = this.data.events.filter(e => {
            const eventStart = new Date(e.start);
            const eventEnd = new Date(e.end || e.start);
            
            return eventStart <= endDate && eventEnd >= startDate;
        });
        
        if (category) {
            events = events.filter(e => e.category === category);
        }
        
        if (tags && tags.length > 0) {
            events = events.filter(e => 
                e.tags && tags.some(t => e.tags.includes(t))
            );
        }
        
        return events.sort((a, b) => new Date(a.start) - new Date(b.start));
    }

    /**
     * Get today's events
     */
    getTodayEvents() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return this.getEvents({ start: today, end: tomorrow });
    }

    /**
     * Get upcoming events
     */
    getUpcomingEvents(days = 7) {
        const start = new Date();
        const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        
        return this.getEvents({ start, end });
    }

    /**
     * Get context for AI briefings
     */
    getContextForBriefing(role = '', rolePrompt = '') {
        const today = this.getTodayEvents();
        const upcoming = this.getUpcomingEvents(7);
        
        // Filter by role relevance if role prompt mentions certain types
        const roleContext = (role + ' ' + rolePrompt).toLowerCase();
        
        let relevantToday = today;
        let relevantUpcoming = upcoming;
        
        // Role-based filtering
        if (roleContext.includes('technical') || roleContext.includes('developer')) {
            relevantToday = today.filter(e => 
                e.category === 'deadline' || 
                e.tags?.some(t => ['sprint', 'release', 'review', 'technical'].includes(t.toLowerCase()))
            );
        } else if (roleContext.includes('manager') || roleContext.includes('project')) {
            relevantToday = today.filter(e => 
                e.category === 'meeting' || 
                e.category === 'milestone' ||
                e.tags?.some(t => ['stakeholder', 'status', 'planning'].includes(t.toLowerCase()))
            );
        }
        
        // Build context string
        let context = '';
        
        if (relevantToday.length > 0) {
            context += '\n## Today\'s Calendar\n';
            relevantToday.forEach(e => {
                const time = e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                context += `- ${time}: ${e.title}`;
                if (e.attendees && e.attendees.length > 0) {
                    context += ` (with ${e.attendees.slice(0, 3).join(', ')}${e.attendees.length > 3 ? '...' : ''})`;
                }
                context += '\n';
            });
        }
        
        // Upcoming deadlines and milestones
        const upcomingImportant = relevantUpcoming.filter(e => 
            e.category === 'deadline' || e.category === 'milestone'
        );
        
        if (upcomingImportant.length > 0) {
            context += '\n## Upcoming Deadlines/Milestones\n';
            upcomingImportant.slice(0, 5).forEach(e => {
                const date = new Date(e.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                context += `- ${date}: ${e.title}\n`;
            });
        }
        
        return context;
    }

    /**
     * Import events from iCal format
     */
    importFromICal(icalData) {
        const imported = [];
        
        // Simple iCal parser (basic implementation)
        const eventBlocks = icalData.split('BEGIN:VEVENT');
        
        eventBlocks.slice(1).forEach(block => {
            try {
                const getField = (name) => {
                    const match = block.match(new RegExp(`${name}[^:]*:([^\\r\\n]+)`));
                    return match ? match[1] : null;
                };
                
                const summary = getField('SUMMARY');
                const dtstart = getField('DTSTART');
                const dtend = getField('DTEND');
                const description = getField('DESCRIPTION');
                const location = getField('LOCATION');
                const uid = getField('UID');
                
                if (summary && dtstart) {
                    const result = this.addEvent({
                        id: uid || `ical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: summary,
                        start: this.parseICalDate(dtstart),
                        end: dtend ? this.parseICalDate(dtend) : this.parseICalDate(dtstart),
                        description: description?.replace(/\\n/g, '\n') || '',
                        location: location || '',
                        source: 'ical'
                    });
                    
                    if (result.success) {
                        imported.push(result.event);
                    }
                }
            } catch (e) {
                console.error('[CalendarIntegration] Error parsing event:', e.message);
            }
        });
        
        return { success: true, imported: imported.length, events: imported };
    }

    /**
     * Parse iCal date format
     */
    parseICalDate(icalDate) {
        // Handle basic formats: YYYYMMDD or YYYYMMDDTHHmmss
        const cleaned = icalDate.replace(/[Z]/g, '');
        
        if (cleaned.length === 8) {
            // Date only
            return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
        } else if (cleaned.length >= 15) {
            // Date and time
            return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}`;
        }
        
        return icalDate;
    }

    /**
     * Export events to iCal format
     */
    exportToICal(options = {}) {
        const events = this.getEvents(options);
        
        let ical = 'BEGIN:VCALENDAR\r\n';
        ical += 'VERSION:2.0\r\n';
        ical += 'PRODID:-//GodMode//Calendar//EN\r\n';
        
        events.forEach(event => {
            ical += 'BEGIN:VEVENT\r\n';
            ical += `UID:${event.id}\r\n`;
            ical += `DTSTART:${this.toICalDate(event.start)}\r\n`;
            if (event.end) {
                ical += `DTEND:${this.toICalDate(event.end)}\r\n`;
            }
            ical += `SUMMARY:${event.title}\r\n`;
            if (event.description) {
                ical += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\r\n`;
            }
            if (event.location) {
                ical += `LOCATION:${event.location}\r\n`;
            }
            ical += 'END:VEVENT\r\n';
        });
        
        ical += 'END:VCALENDAR\r\n';
        
        return ical;
    }

    /**
     * Convert date to iCal format
     */
    toICalDate(date) {
        const d = new Date(date);
        return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    /**
     * Get calendar stats
     */
    getStats() {
        const events = this.data.events;
        const today = new Date();
        
        const upcoming = events.filter(e => new Date(e.start) > today);
        const past = events.filter(e => new Date(e.start) <= today);
        
        const byCategory = {};
        events.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + 1;
        });
        
        return {
            totalEvents: events.length,
            upcomingEvents: upcoming.length,
            pastEvents: past.length,
            byCategory,
            todayEvents: this.getTodayEvents().length,
            nextWeekEvents: this.getUpcomingEvents(7).length
        };
    }
}

// Singleton
let instance = null;
function getCalendarIntegration(options) {
    if (!instance) {
        instance = new CalendarIntegration(options);
    }
    return instance;
}

module.exports = { CalendarIntegration, getCalendarIntegration };
