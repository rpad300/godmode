/**
 * Purpose:
 *   Parses raw pasted or exported chat text from WhatsApp, Slack, Microsoft
 *   Teams, or generic "Speaker: message" formats into a normalised message
 *   array with deterministic IDs, timestamps, and speaker attribution.
 *
 * Responsibilities:
 *   - Auto-detect conversation format via heuristic line-pattern scoring
 *   - Parse WhatsApp (multiple date/time patterns, system messages, multiline)
 *   - Parse Slack (JSON export and copy-paste patterns)
 *   - Parse Teams (header-then-body, multiple timestamp styles)
 *   - Parse generic conversations (colon, bracket, angle-bracket, @-mention)
 *   - Generate deterministic message IDs from content hashes
 *   - Produce a normalised Conversation object with stats (participants, dateRange)
 *
 * Key dependencies:
 *   - crypto (Node built-in): UUID generation for conversation-level IDs
 *
 * Side effects:
 *   - None (pure parsing)
 *
 * Notes:
 *   - detectFormat() samples the first 50 lines; confidence is never 1.0
 *   - WhatsApp year normalisation: two-digit years > 50 map to 19xx, else 20xx
 *   - Message IDs are deterministic (content-hash) so re-importing the same
 *     conversation produces identical IDs, enabling deduplication downstream
 *   - Continuation lines (multiline messages) are appended to the current
 *     message's text with a newline separator
 */

const crypto = require('crypto');

/**
 * Generate a deterministic message ID based on content
 * Format: msg-{8-char-hash}
 * @param {string} speaker - Speaker name
 * @param {string} text - Message text
 * @param {string} timestamp - Timestamp or index
 * @returns {string}
 */
function generateMessageId(speaker, text, timestamp) {
    const content = `${speaker || 'unknown'}:${text || ''}:${timestamp || ''}`;
    
    // Simple hash function for deterministic IDs
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to base36 and format as msg-{hash}
    const hashStr = Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
    return `msg-${hashStr}`;
}

/**
 * Generate a UUID for conversation-level IDs
 * (Conversations need unique IDs per import, not content-based)
 * @returns {string}
 */
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

/**
 * Detect the format of pasted conversation text
 * @param {string} text - Raw pasted text
 * @returns {{format: string, confidence: number, hints: string[]}}
 */
function detectFormat(text) {
    if (!text || typeof text !== 'string') {
        return { format: 'generic', confidence: 0, hints: ['Empty or invalid input'] };
    }

    const lines = text.trim().split('\n').slice(0, 50); // Sample first 50 lines
    const hints = [];
    let scores = {
        whatsapp: 0,
        slack: 0,
        teams: 0,
        generic: 0
    };

    // WhatsApp patterns
    // Format: "dd/mm/yyyy, hh:mm - Name: message" or "mm/dd/yy, h:mm AM/PM - Name: message"
    const whatsappPatterns = [
        /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\s*-\s*.+:/,
        /^\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]\s*.+:/,
        /^\d{1,2}\.\d{1,2}\.\d{2,4},?\s+\d{1,2}:\d{2}\s*-\s*.+:/
    ];

    // Slack patterns
    // Format: "Name  HH:MM" or JSON export
    const slackPatterns = [
        /^[A-Za-z0-9_\-\s]+\s{2,}\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/,
        /^\d{1,2}:\d{2}\s+[A-Za-z0-9_\-]+:/,
        /"type"\s*:\s*"message"/  // JSON export
    ];

    // Teams patterns
    // Format: "Name  Date  Time" followed by message on next line
    const teamsPatterns = [
        /^[A-Za-z\s\-']+\s{2,}\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}/,
        /^[A-Za-z\s\-']+\s+\d{1,2}:\d{2}\s*(?:AM|PM)/i,
        /^\([^)]+\)\s+\d{1,2}\/\d{1,2}\/\d{2,4}/  // (Name) Date format
    ];

    // Check for JSON (Slack export)
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed[0]?.type === 'message') {
            return { format: 'slack', confidence: 0.95, hints: ['Detected Slack JSON export'] };
        }
    } catch (e) {
        // Not JSON, continue with pattern matching
    }

    // Score each line
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // WhatsApp scoring
        for (const pattern of whatsappPatterns) {
            if (pattern.test(trimmed)) {
                scores.whatsapp += 3;
                break;
            }
        }

        // Slack scoring
        for (const pattern of slackPatterns) {
            if (pattern.test(trimmed)) {
                scores.slack += 3;
                break;
            }
        }

        // Teams scoring
        for (const pattern of teamsPatterns) {
            if (pattern.test(trimmed)) {
                scores.teams += 3;
                break;
            }
        }

        // Generic patterns (Speaker: message)
        if (/^[A-Za-z0-9_\-\s]+:\s+.+/.test(trimmed)) {
            scores.generic += 1;
        }
    }

    // Determine winner
    const maxScore = Math.max(...Object.values(scores));
    let format = 'generic';
    let confidence = 0.3;

    if (maxScore > 0) {
        if (scores.whatsapp === maxScore && scores.whatsapp >= 3) {
            format = 'whatsapp';
            confidence = Math.min(0.95, 0.5 + (scores.whatsapp / lines.length) * 0.5);
            hints.push('Detected WhatsApp date/time patterns');
        } else if (scores.slack === maxScore && scores.slack >= 3) {
            format = 'slack';
            confidence = Math.min(0.9, 0.5 + (scores.slack / lines.length) * 0.4);
            hints.push('Detected Slack formatting patterns');
        } else if (scores.teams === maxScore && scores.teams >= 3) {
            format = 'teams';
            confidence = Math.min(0.85, 0.5 + (scores.teams / lines.length) * 0.35);
            hints.push('Detected Teams formatting patterns');
        } else if (scores.generic > 0) {
            format = 'generic';
            confidence = Math.min(0.7, 0.3 + (scores.generic / lines.length) * 0.4);
            hints.push('Using generic Speaker: message pattern');
        }
    }

    if (hints.length === 0) {
        hints.push('No specific format detected, using line-based parsing');
    }

    return { format, confidence, hints };
}

/**
 * Parse WhatsApp conversation
 * @param {string} text - Raw WhatsApp conversation text
 * @returns {{messages: Array, warnings: string[]}}
 */
function parseWhatsApp(text) {
    const messages = [];
    const warnings = [];
    const lines = text.split('\n');

    // WhatsApp message start patterns
    const patterns = [
        // dd/mm/yyyy, hh:mm - Name: message
        /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:(AM|PM|am|pm))?\s*-\s*([^:]+):\s*(.*)/,
        // [dd/mm/yyyy, hh:mm] Name: message
        /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:(AM|PM|am|pm))?\]\s*([^:]+):\s*(.*)/,
        // dd.mm.yyyy, hh:mm - Name: message
        /^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s*-\s*([^:]+):\s*(.*)/
    ];

    let currentMessage = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let matched = false;

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                // Save previous message
                if (currentMessage) {
                    messages.push(currentMessage);
                }

                // Parse date/time
                let [_, day, month, year, hour, minute, second, ampm, speaker, text] = match;
                
                // Handle dd.mm.yyyy format (no ampm group)
                if (pattern === patterns[2]) {
                    [_, day, month, year, hour, minute, speaker, text] = match;
                    second = '00';
                    ampm = null;
                }

                // Normalize year
                if (year.length === 2) {
                    year = parseInt(year) > 50 ? '19' + year : '20' + year;
                }

                // Handle AM/PM
                hour = parseInt(hour);
                if (ampm) {
                    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
                    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
                }

                // Build ISO timestamp
                const ts = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute.padStart(2, '0')}:${(second || '00').padStart(2, '0')}`;

                currentMessage = {
                    id: generateMessageId(speaker.trim(), text || '', ts),
                    ts,
                    speaker: speaker.trim(),
                    text: text || '',
                    attachments: [],
                    meta: { originalLine: i + 1 }
                };

                matched = true;
                break;
            }
        }

        // Handle system messages (no speaker)
        if (!matched && currentMessage === null) {
            const systemMatch = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s*-\s*(.+)/);
            if (systemMatch) {
                const [_, day, month, year, hour, minute, text] = systemMatch;
                const normalizedYear = year.length === 2 ? (parseInt(year) > 50 ? '19' + year : '20' + year) : year;
                const ts = `${normalizedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
                
                currentMessage = {
                    id: generateMessageId('System', text, ts),
                    ts,
                    speaker: 'System',
                    text: text,
                    attachments: [],
                    meta: { originalLine: i + 1, isSystem: true }
                };
                messages.push(currentMessage);
                currentMessage = null;
                matched = true;
            }
        }

        // Continuation of previous message (multiline)
        if (!matched && currentMessage && line.trim()) {
            currentMessage.text += '\n' + line;
        }
    }

    // Don't forget the last message
    if (currentMessage) {
        messages.push(currentMessage);
    }

    // Detect media attachments
    messages.forEach(msg => {
        if (msg.text.includes('<Media omitted>') || msg.text.includes('<attached:')) {
            msg.attachments.push({ type: 'media', note: 'attachment reference' });
        }
    });

    if (messages.length === 0) {
        warnings.push('No messages could be parsed from WhatsApp format');
    }

    return { messages, warnings };
}

/**
 * Parse Slack conversation
 * @param {string} text - Raw Slack conversation text or JSON
 * @returns {{messages: Array, warnings: string[]}}
 */
function parseSlack(text) {
    const messages = [];
    const warnings = [];

    // Try JSON first
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (item.type === 'message' && item.text) {
                    const ts = item.ts ? new Date(parseFloat(item.ts) * 1000).toISOString() : null;
                    const speaker = item.user || item.username || 'Unknown';
                    messages.push({
                        id: generateMessageId(speaker, item.text, ts || item.ts),
                        ts,
                        speaker,
                        text: item.text,
                        attachments: item.attachments || [],
                        meta: { slackTs: item.ts }
                    });
                }
            }
            return { messages, warnings };
        }
    } catch (e) {
        // Not JSON, continue with pattern matching
    }

    // Pattern-based parsing
    const lines = text.split('\n');
    const patterns = [
        // Name  HH:MM (two or more spaces before time)
        /^([A-Za-z0-9_\-\s]+?)\s{2,}(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i,
        // HH:MM Name: message
        /^(\d{1,2}):(\d{2})\s+([A-Za-z0-9_\-]+):\s*(.*)$/,
        // Name: message (simple)
        /^([A-Za-z0-9_\-]+):\s+(.+)$/
    ];

    let currentMessage = null;
    let currentSpeaker = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        let matched = false;

        // Pattern 1: Name  HH:MM (header line, message follows)
        const headerMatch = trimmed.match(patterns[0]);
        if (headerMatch) {
            if (currentMessage) {
                messages.push(currentMessage);
            }
            
            const [_, speaker, hour, minute, ampm] = headerMatch;
            let h = parseInt(hour);
            if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
            
            currentSpeaker = speaker.trim();
            currentMessage = {
                id: generateMessageId(currentSpeaker, '', `line-${i + 1}`),
                ts: null, // Will need date context
                speaker: currentSpeaker,
                text: '',
                attachments: [],
                meta: { originalLine: i + 1, timeOnly: `${String(h).padStart(2, '0')}:${minute}` }
            };
            matched = true;
            continue;
        }

        // Pattern 2: HH:MM Name: message
        const timeNameMatch = trimmed.match(patterns[1]);
        if (timeNameMatch) {
            if (currentMessage) {
                messages.push(currentMessage);
            }
            
            const [_, hour, minute, speaker, text] = timeNameMatch;
            currentMessage = {
                id: generateMessageId(speaker.trim(), text || '', `line-${i + 1}`),
                ts: null,
                speaker: speaker.trim(),
                text: text || '',
                attachments: [],
                meta: { originalLine: i + 1, timeOnly: `${hour.padStart(2, '0')}:${minute}` }
            };
            matched = true;
            continue;
        }

        // Pattern 3: Name: message
        const simpleMatch = trimmed.match(patterns[2]);
        if (simpleMatch && !currentMessage) {
            const [_, speaker, text] = simpleMatch;
            currentMessage = {
                id: generateMessageId(speaker.trim(), text, `line-${i + 1}`),
                ts: null,
                speaker: speaker.trim(),
                text: text,
                attachments: [],
                meta: { originalLine: i + 1 }
            };
            matched = true;
            continue;
        }

        // Message content (continuation or content after header)
        if (currentMessage) {
            if (currentMessage.text) {
                currentMessage.text += '\n' + trimmed;
            } else {
                currentMessage.text = trimmed;
            }
        }
    }

    // Don't forget the last message
    if (currentMessage) {
        messages.push(currentMessage);
    }

    if (messages.length === 0) {
        warnings.push('No messages could be parsed from Slack format');
    } else if (messages.every(m => !m.ts)) {
        warnings.push('No timestamps could be extracted - times may be partial');
    }

    return { messages, warnings };
}

/**
 * Parse Teams conversation
 * @param {string} text - Raw Teams conversation text
 * @returns {{messages: Array, warnings: string[]}}
 */
function parseTeams(text) {
    const messages = [];
    const warnings = [];
    const lines = text.split('\n');

    // Teams patterns
    const patterns = [
        // Name  dd/mm/yyyy  HH:MM
        /^([A-Za-z\s\-']+?)\s{2,}(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i,
        // Name  HH:MM AM/PM
        /^([A-Za-z\s\-']+?)\s{2,}(\d{1,2}):(\d{2})\s*(AM|PM)/i,
        // (Name)  Date
        /^\(([^)]+)\)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/
    ];

    let currentMessage = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (!trimmed) continue;

        let matched = false;

        // Pattern 1: Name  dd/mm/yyyy  HH:MM
        const fullMatch = trimmed.match(patterns[0]);
        if (fullMatch) {
            if (currentMessage && currentMessage.text) {
                messages.push(currentMessage);
            }

            let [_, speaker, day, month, year, hour, minute, ampm] = fullMatch;
            
            if (year.length === 2) {
                year = parseInt(year) > 50 ? '19' + year : '20' + year;
            }

            let h = parseInt(hour);
            if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;

            const ts = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(h).padStart(2, '0')}:${minute.padStart(2, '0')}:00`;

            currentMessage = {
                id: generateMessageId(speaker.trim(), '', ts),
                ts,
                speaker: speaker.trim(),
                text: '',
                attachments: [],
                meta: { originalLine: i + 1 }
            };
            matched = true;
            continue;
        }

        // Pattern 2: Name  HH:MM AM/PM
        const timeMatch = trimmed.match(patterns[1]);
        if (timeMatch) {
            if (currentMessage && currentMessage.text) {
                messages.push(currentMessage);
            }

            const [_, speaker, hour, minute, ampm] = timeMatch;
            let h = parseInt(hour);
            if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;

            currentMessage = {
                id: generateMessageId(speaker.trim(), '', `line-${i + 1}`),
                ts: null,
                speaker: speaker.trim(),
                text: '',
                attachments: [],
                meta: { originalLine: i + 1, timeOnly: `${String(h).padStart(2, '0')}:${minute}` }
            };
            matched = true;
            continue;
        }

        // Message content
        if (!matched && currentMessage) {
            if (currentMessage.text) {
                currentMessage.text += '\n' + trimmed;
            } else {
                currentMessage.text = trimmed;
            }
        } else if (!matched && !currentMessage) {
            // Orphan line, create generic message
            currentMessage = {
                id: generateMessageId('Unknown', trimmed, `line-${i + 1}`),
                ts: null,
                speaker: 'Unknown',
                text: trimmed,
                attachments: [],
                meta: { originalLine: i + 1 }
            };
        }
    }

    // Don't forget the last message
    if (currentMessage && currentMessage.text) {
        messages.push(currentMessage);
    }

    if (messages.length === 0) {
        warnings.push('No messages could be parsed from Teams format');
    }

    return { messages, warnings };
}

/**
 * Parse generic conversation
 * @param {string} text - Raw conversation text
 * @returns {{messages: Array, warnings: string[]}}
 */
function parseGeneric(text) {
    const messages = [];
    const warnings = [];
    const lines = text.split('\n');

    // Generic patterns
    const patterns = [
        // Name: message (colon after name)
        /^([A-Za-z0-9_\-\s]+?):\s+(.+)/,
        // [Name] message (brackets)
        /^\[([A-Za-z0-9_\-\s]+)\]\s*(.+)/,
        // <Name> message (angle brackets)
        /^<([A-Za-z0-9_\-\s]+)>\s*(.+)/,
        // @Name message (at mention style)
        /^@([A-Za-z0-9_\-]+)\s+(.+)/
    ];

    let currentMessage = null;
    let lastSpeaker = 'Unknown';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (!trimmed) continue;

        let matched = false;

        for (const pattern of patterns) {
            const match = trimmed.match(pattern);
            if (match) {
                // Save previous message
                if (currentMessage) {
                    messages.push(currentMessage);
                }

                const [_, speaker, text] = match;
                lastSpeaker = speaker.trim();

                currentMessage = {
                    id: generateMessageId(lastSpeaker, text, `line-${i + 1}`),
                    ts: null,
                    speaker: lastSpeaker,
                    text: text,
                    attachments: [],
                    meta: { originalLine: i + 1 }
                };
                matched = true;
                break;
            }
        }

        // Continuation of previous message or new unattributed message
        if (!matched) {
            if (currentMessage) {
                // Check if this looks like a continuation (indented or short)
                if (line.startsWith(' ') || line.startsWith('\t') || trimmed.length < 50) {
                    currentMessage.text += '\n' + trimmed;
                } else {
                    // Might be a new message from same speaker
                    messages.push(currentMessage);
                    currentMessage = {
                        id: generateMessageId(lastSpeaker, trimmed, `line-${i + 1}`),
                        ts: null,
                        speaker: lastSpeaker,
                        text: trimmed,
                        attachments: [],
                        meta: { originalLine: i + 1 }
                    };
                }
            } else {
                // First message without pattern
                currentMessage = {
                    id: generateMessageId('Unknown', trimmed, `line-${i + 1}`),
                    ts: null,
                    speaker: 'Unknown',
                    text: trimmed,
                    attachments: [],
                    meta: { originalLine: i + 1 }
                };
            }
        }
    }

    // Don't forget the last message
    if (currentMessage) {
        messages.push(currentMessage);
    }

    // Add warnings
    if (messages.length === 0) {
        warnings.push('No messages could be parsed');
    }
    if (messages.every(m => m.ts === null)) {
        warnings.push('No timestamps detected in conversation');
    }
    if (messages.filter(m => m.speaker === 'Unknown').length > messages.length * 0.5) {
        warnings.push('Many messages have unknown speakers');
    }

    return { messages, warnings };
}

/**
 * Parse conversation with auto-detection or specified format
 * @param {string} text - Raw conversation text
 * @param {string} formatHint - Optional format hint ('auto', 'whatsapp', 'slack', 'teams', 'generic')
 * @returns {{format: string, confidence: number, messages: Array, warnings: string[], stats: object}}
 */
function parse(text, formatHint = 'auto') {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
            format: 'unknown',
            confidence: 0,
            messages: [],
            warnings: ['Empty or invalid input'],
            stats: { messageCount: 0, participants: [], dateRange: null }
        };
    }

    // Detect or use hint
    let format, confidence, hints;
    if (formatHint === 'auto' || !formatHint) {
        ({ format, confidence, hints } = detectFormat(text));
    } else {
        format = formatHint;
        confidence = 0.9; // User specified
        hints = [`Using specified format: ${formatHint}`];
    }

    // Parse based on format
    let result;
    switch (format) {
        case 'whatsapp':
            result = parseWhatsApp(text);
            break;
        case 'slack':
            result = parseSlack(text);
            break;
        case 'teams':
            result = parseTeams(text);
            break;
        default:
            result = parseGeneric(text);
    }

    // Calculate stats
    const participants = [...new Set(result.messages.map(m => m.speaker))];
    const timestamps = result.messages.map(m => m.ts).filter(Boolean);
    const dateRange = timestamps.length > 0 ? {
        first: timestamps.sort()[0],
        last: timestamps.sort()[timestamps.length - 1]
    } : null;

    return {
        format,
        confidence,
        messages: result.messages,
        warnings: [...(hints || []), ...result.warnings],
        stats: {
            messageCount: result.messages.length,
            participants,
            dateRange
        }
    };
}

/**
 * Create a normalized conversation object
 * @param {object} parseResult - Result from parse()
 * @param {object} meta - User-provided metadata
 * @returns {object} - Normalized conversation
 */
function createConversation(parseResult, meta = {}) {
    const now = new Date().toISOString();
    
    return {
        id: generateId(),
        projectId: meta.projectId || null,
        title: meta.title || `Conversation ${new Date().toLocaleDateString()}`,
        sourceApp: parseResult.format,
        channelName: meta.channelName || null,
        workspaceName: meta.workspaceName || null,
        participants: parseResult.stats.participants,
        createdAt: parseResult.stats.dateRange?.first || now,
        importedAt: now,
        messageCount: parseResult.stats.messageCount,
        dateRange: parseResult.stats.dateRange,
        messages: parseResult.messages
    };
}

module.exports = {
    detectFormat,
    parseWhatsApp,
    parseSlack,
    parseTeams,
    parseGeneric,
    parse,
    createConversation,
    generateId
};
