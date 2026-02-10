/**
 * Email Parser Module
 * Handles parsing of emails from various sources:
 * - Manual paste (with multi-language header detection)
 * - .eml file uploads (RFC822 format)
 * - .msg file uploads (Outlook format)
 * 
 * @module emailParser
 */

const { logger } = require('./logger');
const { simpleParser } = require('mailparser');

const log = logger.child({ module: 'email-parser' });
const fs = require('fs').promises;
const path = require('path');

// Try to load prompts service for Supabase prompts
let promptsService = null;
try {
    promptsService = require('./supabase/prompts');
} catch (e) {
    // Supabase prompts not available, will use defaults
}

// Multi-language header patterns
const HEADER_PATTERNS = {
    from: /^(?:From|De|Van|Von|Da|Från|Od):\s*(.+)$/im,
    to: /^(?:To|Para|Aan|An|A|Till|Do):\s*(.+)$/im,
    cc: /^(?:Cc|CC|Cópia|Kopie|Copie|Kopia):\s*(.+)$/im,
    bcc: /^(?:Bcc|BCC|Cópia Oculta|Blindkopie):\s*(.+)$/im,
    subject: /^(?:Subject|Assunto|Onderwerp|Betreff|Oggetto|Ämne|Temat):\s*(.+)$/im,
    date: /^(?:Sent|Date|Enviado|Verzonden|Gesendet|Inviato|Skickat|Wysłano|Data):\s*(.+)$/im,
};

// Signature detection patterns
const SIGNATURE_PATTERNS = {
    // Common signature delimiters
    delimiters: [
        /^[-_]{2,}\s*$/m,                          // -- or ___
        /^(?:Best|Regards|Thanks|Cheers|Sincerely|Atenciosamente|Met vriendelijke groet|Mit freundlichen Grüßen)/im,
        /^(?:Kind regards|Best regards|Warm regards)/im,
    ],
    // Email in signature
    email: /[\w.-]+@[\w.-]+\.\w+/g,
    // Phone patterns
    phone: /(?:M|T|Tel|Phone|Mobile|Mob|Telefone|Telefoon):\s*([\d\s+()-]+)/gi,
    // Role/Title patterns
    role: /^([A-Z][a-zA-Z\s,]+)\s*\|/m,
    // Organization patterns
    organization: /\|\s*([A-Z][a-zA-Z\s]+)(?:\s*\||$)/m,
    // LinkedIn/Website
    website: /(?:www\.[^\s]+|https?:\/\/[^\s]+)/gi,
    // Address patterns
    address: /(?:\d+[\w\s,]+\d{4,5}\s+[A-Za-z]+)/g,
};

/**
 * Parse an .eml file buffer
 * @param {Buffer} buffer - The .eml file content
 * @returns {Promise<Object>} Parsed email object
 */
async function parseEmlFile(buffer) {
    try {
        const parsed = await simpleParser(buffer);
        
        return {
            // Headers
            subject: parsed.subject || '',
            from: extractAddress(parsed.from),
            to: extractAddresses(parsed.to),
            cc: extractAddresses(parsed.cc),
            bcc: extractAddresses(parsed.bcc),
            date: parsed.date || null,
            messageId: parsed.messageId || null,
            inReplyTo: parsed.inReplyTo || null,
            references: parsed.references || [],
            
            // Content
            text: parsed.text || '',
            html: parsed.html || '',
            
            // Attachments
            attachments: (parsed.attachments || []).map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                content: att.content, // Buffer
            })),
            
            // Metadata
            headers: Object.fromEntries(parsed.headers),
        };
    } catch (error) {
        log.warn({ event: 'email_parser_eml_failed', reason: error.message }, 'Failed to parse .eml');
        throw new Error(`Failed to parse email file: ${error.message}`);
    }
}

/**
 * Parse manually pasted email text (copy-paste from email client)
 * Supports multiple languages for headers
 * @param {string} text - The pasted email text
 * @returns {Object} Parsed email object
 */
function parseManualEmail(text) {
    const lines = text.split('\n');
    const result = {
        subject: '',
        from: { email: '', name: '' },
        to: [],
        cc: [],
        bcc: [],
        date: null,
        text: '',
        signature: null,
        extractedContacts: [],
    };
    
    let bodyStartIndex = 0;
    let inHeaders = true;
    
    // Extract headers
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Empty line typically separates headers from body
        if (inHeaders && line.trim() === '') {
            bodyStartIndex = i + 1;
            inHeaders = false;
            continue;
        }
        
        if (inHeaders) {
            // Check for From header
            const fromMatch = line.match(HEADER_PATTERNS.from);
            if (fromMatch) {
                result.from = parseEmailAddress(fromMatch[1]);
                continue;
            }
            
            // Check for To header
            const toMatch = line.match(HEADER_PATTERNS.to);
            if (toMatch) {
                result.to = parseEmailAddressList(toMatch[1]);
                continue;
            }
            
            // Check for CC header
            const ccMatch = line.match(HEADER_PATTERNS.cc);
            if (ccMatch) {
                result.cc = parseEmailAddressList(ccMatch[1]);
                continue;
            }
            
            // Check for Subject header
            const subjectMatch = line.match(HEADER_PATTERNS.subject);
            if (subjectMatch) {
                result.subject = subjectMatch[1].trim();
                continue;
            }
            
            // Check for Date header
            const dateMatch = line.match(HEADER_PATTERNS.date);
            if (dateMatch) {
                result.date = parseFlexibleDate(dateMatch[1]);
                continue;
            }
            
            // If line doesn't match any header and we haven't found body yet
            // Check if it looks like continuation of previous header or start of body
            if (!line.match(/^[\w-]+:/)) {
                // Might be body starting
                bodyStartIndex = i;
                inHeaders = false;
            }
        }
    }
    
    // Extract body (everything after headers)
    const bodyLines = lines.slice(bodyStartIndex);
    const bodyText = bodyLines.join('\n').trim();
    
    // Try to separate body from signature
    const { body, signature } = extractSignature(bodyText);
    result.text = body;
    result.signature = signature;
    
    // Extract contact info from signature
    if (signature) {
        result.extractedContacts = extractContactsFromSignature(signature, result.from);
    }
    
    return result;
}

/**
 * Parse a single email address string
 * Handles formats like: "Name <email@domain.com>", "email@domain.com", "Name, First"
 * @param {string} str - Email address string
 * @returns {Object} { email, name }
 */
function parseEmailAddress(str) {
    if (!str) return { email: '', name: '' };
    
    str = str.trim();
    
    // Format: Name <email@domain.com>
    const angleMatch = str.match(/^(.+?)\s*<([^>]+)>$/);
    if (angleMatch) {
        return {
            name: angleMatch[1].trim().replace(/^["']|["']$/g, ''),
            email: angleMatch[2].trim().toLowerCase(),
        };
    }
    
    // Format: email@domain.com (Name)
    const parenMatch = str.match(/^([^\s]+@[^\s]+)\s*\((.+)\)$/);
    if (parenMatch) {
        return {
            email: parenMatch[1].trim().toLowerCase(),
            name: parenMatch[2].trim(),
        };
    }
    
    // Format: just email
    const emailMatch = str.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
        // Check if there's a name before the email
        const beforeEmail = str.substring(0, str.indexOf(emailMatch[0])).trim();
        return {
            email: emailMatch[0].toLowerCase(),
            name: beforeEmail.replace(/[,;]$/, '').trim(),
        };
    }
    
    // Format: "Last, First" (common in corporate emails)
    if (str.includes(',') && !str.includes('@')) {
        const parts = str.split(',').map(p => p.trim());
        if (parts.length === 2) {
            return {
                name: `${parts[1]} ${parts[0]}`, // Convert "Lee, Alexander" to "Alexander Lee"
                email: '',
            };
        }
    }
    
    // Just a name
    return { name: str, email: '' };
}

/**
 * Parse a list of email addresses (semicolon or comma separated)
 * @param {string} str - Email addresses string
 * @returns {Array<Object>} Array of { email, name }
 */
function parseEmailAddressList(str) {
    if (!str) return [];
    
    // Split by semicolon or comma (but not commas inside names like "Lee, Alexander")
    const addresses = [];
    let current = '';
    let depth = 0;
    
    for (const char of str) {
        if (char === '<') depth++;
        if (char === '>') depth--;
        if ((char === ';' || char === ',') && depth === 0) {
            if (current.trim()) {
                addresses.push(parseEmailAddress(current.trim()));
            }
            current = '';
        } else {
            current += char;
        }
    }
    
    if (current.trim()) {
        addresses.push(parseEmailAddress(current.trim()));
    }
    
    return addresses;
}

/**
 * Parse flexible date formats from various locales
 * @param {string} str - Date string
 * @returns {Date|null}
 */
function parseFlexibleDate(str) {
    if (!str) return null;
    
    str = str.trim();
    
    // Try native parsing first
    let date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    // Portuguese format: "29 de janeiro de 2026 10:56"
    const ptMatch = str.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
    if (ptMatch) {
        const months = {
            janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
            julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
        };
        const month = months[ptMatch[2].toLowerCase()];
        if (month !== undefined) {
            return new Date(
                parseInt(ptMatch[3]),
                month,
                parseInt(ptMatch[1]),
                parseInt(ptMatch[4]),
                parseInt(ptMatch[5])
            );
        }
    }
    
    // Dutch format: "29 januari 2026 10:56"
    const nlMatch = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
    if (nlMatch) {
        const months = {
            januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
            juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11
        };
        const month = months[nlMatch[2].toLowerCase()];
        if (month !== undefined) {
            return new Date(
                parseInt(nlMatch[3]),
                month,
                parseInt(nlMatch[1]),
                parseInt(nlMatch[4]),
                parseInt(nlMatch[5])
            );
        }
    }
    
    // German format: "29. Januar 2026 10:56"
    const deMatch = str.match(/(\d{1,2})\.\s*(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
    if (deMatch) {
        const months = {
            januar: 0, februar: 1, märz: 2, april: 3, mai: 4, juni: 5,
            juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11
        };
        const month = months[deMatch[2].toLowerCase()];
        if (month !== undefined) {
            return new Date(
                parseInt(deMatch[3]),
                month,
                parseInt(deMatch[1]),
                parseInt(deMatch[4]),
                parseInt(deMatch[5])
            );
        }
    }
    
    return null;
}

/**
 * Extract signature from email body
 * @param {string} body - Email body text
 * @returns {Object} { body, signature }
 */
function extractSignature(body) {
    const lines = body.split('\n');
    let signatureStart = -1;
    
    // Look for signature delimiters
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        
        // Skip empty lines at the end
        if (!line) continue;
        
        // Check for common signature patterns
        for (const pattern of SIGNATURE_PATTERNS.delimiters) {
            if (pattern.test(line)) {
                signatureStart = i;
                break;
            }
        }
        
        if (signatureStart !== -1) break;
        
        // If we've gone back more than 15 lines without finding delimiter,
        // try to detect signature by content (contact info patterns)
        if (i < lines.length - 15) {
            // Look for concentration of contact info in last lines
            const lastLines = lines.slice(-12).join('\n');
            if (hasSignaturePatterns(lastLines)) {
                signatureStart = lines.length - 12;
            }
            break;
        }
    }
    
    if (signatureStart === -1) {
        return { body, signature: null };
    }
    
    return {
        body: lines.slice(0, signatureStart).join('\n').trim(),
        signature: lines.slice(signatureStart).join('\n').trim(),
    };
}

/**
 * Check if text has signature-like patterns
 * @param {string} text 
 * @returns {boolean}
 */
function hasSignaturePatterns(text) {
    let score = 0;
    
    if (SIGNATURE_PATTERNS.email.test(text)) score += 2;
    if (SIGNATURE_PATTERNS.phone.test(text)) score += 2;
    if (SIGNATURE_PATTERNS.website.test(text)) score += 1;
    if (/\|/.test(text)) score += 1; // Pipe separators common in signatures
    
    return score >= 3;
}

/**
 * Extract contact information from email signature
 * @param {string} signature - The signature text
 * @param {Object} fromContact - The from contact for context
 * @returns {Array<Object>} Extracted contacts
 */
function extractContactsFromSignature(signature, fromContact) {
    const contacts = [];
    
    // Primary contact from signature (usually the sender)
    const contact = {
        name: fromContact?.name || '',
        email: '',
        phone: '',
        role: '',
        organization: '',
        department: '',
        location: '',
        website: '',
        skills: [],
    };
    
    // Extract email
    const emails = signature.match(SIGNATURE_PATTERNS.email);
    if (emails && emails.length > 0) {
        contact.email = emails[0].toLowerCase();
        // If from contact had no email, use this one
        if (!fromContact?.email) {
            contact.email = emails[0].toLowerCase();
        }
    }
    
    // Extract phone - use regex without global flag to get capture groups
    const phoneRegex = /(?:M|T|Tel|Phone|Mobile|Mob|Telefone|Telefoon):\s*([\d\s+()-]+)/i;
    const phoneMatch = signature.match(phoneRegex);
    if (phoneMatch && phoneMatch[1]) {
        contact.phone = phoneMatch[1].replace(/\s+/g, ' ').trim();
    }
    
    // Extract role and organization from pipe-separated format
    // Example: "Alexander Lee | Data Scientist | Linked Data, RAG, Azure"
    const pipeLines = signature.split('\n').filter(l => l.includes('|'));
    for (const line of pipeLines) {
        const parts = line.split('|').map(p => p.trim());
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // First part after name is usually role
            if (i === 1 && !contact.role) {
                contact.role = part;
            }
            // Look for organization names (CGI, Microsoft, etc.)
            else if (part.match(/^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?$/) && !contact.organization) {
                // Check if it's not a skill/tech keyword
                if (!isSkillKeyword(part)) {
                    contact.organization = part;
                }
            }
            // Skills (comma-separated keywords)
            else if (part.includes(',') || isSkillKeyword(part)) {
                const skills = part.split(',').map(s => s.trim()).filter(s => s);
                contact.skills.push(...skills);
            }
        }
    }
    
    // Extract organization from lines like "Smartlab | CGI"
    const orgMatch = signature.match(/(?:^|\|)\s*([A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)?)\s*$/m);
    if (orgMatch && !contact.organization) {
        contact.organization = orgMatch[1].trim();
    }
    
    // Extract address/location
    const addressMatch = signature.match(/([A-Za-z\s]+\d+)\s*\|\s*(\d{4,5}\s+[A-Za-z]+)\s*\|\s*([A-Za-z]+)/);
    if (addressMatch) {
        contact.location = `${addressMatch[1].trim()}, ${addressMatch[2].trim()}, ${addressMatch[3].trim()}`;
    } else {
        // Try simpler location pattern
        const locationMatch = signature.match(/([A-Za-z]+),?\s+(Nederland|Netherlands|Belgium|Germany|Portugal|Spain|France|UK)/i);
        if (locationMatch) {
            contact.location = `${locationMatch[1]}, ${locationMatch[2]}`;
        }
    }
    
    // Extract website
    const websiteMatch = signature.match(SIGNATURE_PATTERNS.website);
    if (websiteMatch) {
        contact.website = websiteMatch[0];
    }
    
    if (contact.email || contact.name) {
        contacts.push(contact);
    }
    
    return contacts;
}

/**
 * Check if a string is a skill/technology keyword
 * @param {string} str 
 * @returns {boolean}
 */
function isSkillKeyword(str) {
    const keywords = [
        'data', 'scientist', 'engineer', 'developer', 'architect', 'analyst',
        'linked data', 'rag', 'azure', 'aws', 'gcp', 'python', 'javascript',
        'ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'llm',
        'graph', 'database', 'sql', 'nosql', 'api', 'rest', 'graphql',
    ];
    return keywords.some(k => str.toLowerCase().includes(k));
}

/**
 * Helper to extract single address from mailparser format
 * @param {Object} addr - Mailparser address object
 * @returns {Object}
 */
function extractAddress(addr) {
    if (!addr || !addr.value || !addr.value[0]) {
        return { email: '', name: '' };
    }
    const first = addr.value[0];
    return {
        email: (first.address || '').toLowerCase(),
        name: first.name || '',
    };
}

/**
 * Helper to extract address list from mailparser format
 * @param {Object} addrs - Mailparser addresses object
 * @returns {Array<Object>}
 */
function extractAddresses(addrs) {
    if (!addrs || !addrs.value) return [];
    return addrs.value.map(a => ({
        email: (a.address || '').toLowerCase(),
        name: a.name || '',
    }));
}

/**
 * Match email contacts with existing contacts in database
 * @param {Object} parsedEmail - Parsed email object
 * @param {Function} findContactByEmail - Function to find contact by email
 * @param {Function} findContactByName - Function to find contact by name (fuzzy)
 * @returns {Promise<Object>} Email with matched/created contact IDs
 */
async function matchContacts(parsedEmail, findContactByEmail, findContactByName) {
    const result = {
        senderContact: null,
        recipientContacts: [],
        newContactsToCreate: [],
    };
    
    // Match sender
    if (parsedEmail.from?.email) {
        const existing = await findContactByEmail(parsedEmail.from.email);
        if (existing) {
            result.senderContact = existing;
        } else {
            result.newContactsToCreate.push({
                ...parsedEmail.from,
                isNew: true,
                role: 'sender',
            });
        }
    } else if (parsedEmail.from?.name) {
        const existing = await findContactByName(parsedEmail.from.name);
        if (existing) {
            result.senderContact = existing;
        } else {
            result.newContactsToCreate.push({
                ...parsedEmail.from,
                isNew: true,
                role: 'sender',
            });
        }
    }
    
    // Match recipients (to, cc)
    const allRecipients = [
        ...(parsedEmail.to || []).map(r => ({ ...r, type: 'to' })),
        ...(parsedEmail.cc || []).map(r => ({ ...r, type: 'cc' })),
    ];
    
    for (const recipient of allRecipients) {
        if (recipient.email) {
            const existing = await findContactByEmail(recipient.email);
            if (existing) {
                result.recipientContacts.push({ contact: existing, type: recipient.type });
            } else {
                result.newContactsToCreate.push({
                    ...recipient,
                    isNew: true,
                    role: 'recipient',
                });
            }
        } else if (recipient.name) {
            const existing = await findContactByName(recipient.name);
            if (existing) {
                result.recipientContacts.push({ contact: existing, type: recipient.type });
            } else {
                result.newContactsToCreate.push({
                    ...recipient,
                    isNew: true,
                    role: 'recipient',
                });
            }
        }
    }
    
    // Add contacts extracted from signature
    if (parsedEmail.extractedContacts) {
        for (const sigContact of parsedEmail.extractedContacts) {
            if (sigContact.email) {
                const existing = await findContactByEmail(sigContact.email);
                if (!existing) {
                    // Check if not already in newContactsToCreate
                    const alreadyAdded = result.newContactsToCreate.find(
                        c => c.email === sigContact.email
                    );
                    if (!alreadyAdded) {
                        result.newContactsToCreate.push({
                            ...sigContact,
                            isNew: true,
                            role: 'signature',
                        });
                    } else {
                        // Merge additional info from signature
                        Object.assign(alreadyAdded, {
                            phone: sigContact.phone || alreadyAdded.phone,
                            organization: sigContact.organization || alreadyAdded.organization,
                            location: sigContact.location || alreadyAdded.location,
                            skills: [...(alreadyAdded.skills || []), ...(sigContact.skills || [])],
                        });
                    }
                }
            }
        }
    }
    
    return result;
}

/**
 * Build email content string for prompt injection
 * @param {Object} email - Parsed email
 * @returns {string} Formatted email content
 */
function buildEmailContent(email) {
    const parts = [];
    
    parts.push(`From: ${email.from?.name || ''} <${email.from?.email || ''}>`);
    parts.push(`To: ${(email.to || []).map(t => `${t.name || ''} <${t.email || ''}>`).join(', ')}`);
    
    if (email.cc?.length) {
        parts.push(`CC: ${email.cc.map(c => `${c.name || ''} <${c.email || ''}>`).join(', ')}`);
    }
    
    parts.push(`Subject: ${email.subject || '(no subject)'}`);
    parts.push(`Date: ${email.date || 'unknown'}`);
    parts.push('');
    parts.push(email.text || email.body_text || '');
    
    if (email.signature) {
        parts.push('');
        parts.push('--- Signature ---');
        parts.push(email.signature);
    }
    
    return parts.join('\n');
}

/**
 * Build AI prompt for email analysis - extracts all entity types
 * Uses Supabase prompts v1.6 when available
 * @param {Object} email - Parsed email
 * @param {Object} options - Options including custom prompt, projectId for context
 * @returns {string} Prompt
 */
function buildEmailAnalysisPrompt(email, options = {}) {
    const { customPrompt, ontologyMode = true, supabasePrompt, contextVariables = {} } = options;
    
    // If custom prompt provided, use it with placeholders replaced
    if (customPrompt) {
        return customPrompt
            .replace(/{from}/g, `${email.from?.name || ''} <${email.from?.email || ''}>`)
            .replace(/{to}/g, (email.to || []).map(t => `${t.name} <${t.email}>`).join(', '))
            .replace(/{subject}/g, email.subject || '(no subject)')
            .replace(/{body}/g, email.text || email.body_text || '')
            .replace(/{date}/g, email.date || 'unknown')
            .replace(/{today}/g, new Date().toISOString().split('T')[0]);
    }
    
    // Use Supabase prompt v1.6 if provided
    if (supabasePrompt && promptsService) {
        const emailContent = buildEmailContent(email);
        const contentHash = promptsService.generateContentHash(emailContent);
        
        return promptsService.renderPrompt(supabasePrompt, {
            CONTENT: emailContent,
            CONTENT_HASH: contentHash,
            CONTENT_LENGTH: String(emailContent.length),
            FILENAME: email.subject || '(no subject)',
            TODAY: new Date().toISOString().split('T')[0],
            ONTOLOGY_SECTION: '',
            ROLE_CONTEXT: '',
            PROJECT_CONTEXT: '',
            // v1.6 context variables
            CONTACTS_INDEX: contextVariables.CONTACTS_INDEX || '',
            ORG_INDEX: contextVariables.ORG_INDEX || '',
            PROJECT_INDEX: contextVariables.PROJECT_INDEX || '',
            USERNAME_MAP: contextVariables.USERNAME_MAP || '',
            DOMAIN_MAP: contextVariables.DOMAIN_MAP || ''
        });
    }
    
    // Default ontology-aware prompt for complete entity extraction
    return `/no_think
TASK: Analyze this email and extract ALL structured information for knowledge graph integration.

EMAIL HEADERS:
From: ${email.from?.name || ''} <${email.from?.email || ''}>
To: ${(email.to || []).map(t => `${t.name || ''} <${t.email || ''}>`).join(', ')}
${email.cc?.length ? `CC: ${email.cc.map(c => `${c.name || ''} <${c.email || ''}>`).join(', ')}` : ''}
Subject: ${email.subject || '(no subject)'}
Date: ${email.date || 'unknown'}

EMAIL BODY:
${email.text || email.body_text || ''}

${email.signature ? `SENDER SIGNATURE:\n${email.signature}` : ''}

CRITICAL EXTRACTION MANDATE:
- Extract ALL facts, even seemingly minor ones
- Extract ALL decisions communicated or referenced
- Extract ALL risks, concerns, issues, or blockers mentioned
- Extract ALL action items with owners and deadlines when mentioned
- Extract ALL questions raised or implied
- Identify ALL people mentioned by name
- Identify ALL technologies, tools, or systems mentioned
- Determine if this email requires a response

OUTPUT FORMAT (JSON only, no explanations):

{
    "summary": "Brief 1-2 sentence summary of the email content and purpose",
    "intent": "request|information|question|action_needed|follow_up|introduction|thank_you|complaint|update|other",
    "sentiment": "positive|neutral|negative|urgent",
    "requires_response": true or false,
    "response_urgency": "immediate|today|this_week|when_convenient|none",
    
    "facts": [
        {
            "content": "The specific fact or piece of information",
            "category": "process|policy|technical|people|timeline|general",
            "confidence": "high|medium|low"
        }
    ],
    
    "decisions": [
        {
            "content": "The decision that was made or communicated",
            "owner": "Person who made/owns the decision or null",
            "date": "Date of decision if mentioned or null",
            "status": "made|pending|proposed"
        }
    ],
    
    "risks": [
        {
            "content": "Description of the risk, concern, or issue",
            "impact": "High|Medium|Low",
            "likelihood": "High|Medium|Low",
            "mitigation": "Suggested mitigation if mentioned or null"
        }
    ],
    
    "action_items": [
        {
            "task": "The specific action or task to be done",
            "owner": "Person responsible or null",
            "deadline": "Due date if mentioned or null",
            "priority": "critical|high|medium|low",
            "status": "pending|in_progress|blocked"
        }
    ],
    
    "questions": [
        {
            "content": "The question raised or implied",
            "priority": "critical|high|medium|low",
            "context": "Brief context for the question",
            "assignee": "Who should answer if clear or null"
        }
    ],
    
    "people": [
        {
            "name": "Full name of person mentioned",
            "email": "Email if found in content",
            "role": "Role/title if mentioned",
            "organization": "Company/team if mentioned",
            "phone": "Phone if found"
        }
    ],
    
    "technologies": [
        {
            "name": "Technology, tool, or system name",
            "category": "database|framework|platform|service|language|tool|other"
        }
    ],
    
    "relationships": [
        {
            "from": "Person or entity name",
            "to": "Person or entity name", 
            "type": "WORKS_WITH|REPORTS_TO|MANAGES|COLLABORATES_WITH|KNOWS"
        }
    ],
    
    "key_topics": ["topic1", "topic2"],
    
    "follow_up_date": "Suggested follow-up date or null"
}

IMPORTANT:
- Output ONLY valid JSON
- Include empty arrays [] if no items found for a category
- Be thorough - extract everything relevant
- For facts, capture specific information that would be useful to remember
- For action items, be specific about what needs to be done`;
}

/**
 * Build AI prompt for generating email response draft
 * @param {Object} email - The email to respond to
 * @param {Object} context - Project context
 * @returns {string}
 */
function buildResponsePrompt(email, context = {}) {
    const { facts = [], questions = [], decisions = [], contacts = [] } = context;
    
    return `/no_think
TASK: Draft a professional response to this email.

ORIGINAL EMAIL:
From: ${email.from_name || ''} <${email.from_email || ''}>
Subject: ${email.subject || ''}
Date: ${email.date_sent || ''}

Body:
${email.body_text || ''}

PROJECT CONTEXT:
${facts.length > 0 ? `Recent Facts:\n${facts.slice(0, 5).map(f => `- ${f.content}`).join('\n')}` : ''}

${questions.length > 0 ? `Open Questions:\n${questions.slice(0, 3).map(q => `- ${q.content}`).join('\n')}` : ''}

${decisions.length > 0 ? `Recent Decisions:\n${decisions.slice(0, 3).map(d => `- ${d.content}`).join('\n')}` : ''}

INSTRUCTIONS:
1. Address all points raised in the email
2. Use available context to provide accurate information
3. Be professional but friendly
4. If you cannot answer something, indicate it needs follow-up
5. Keep the response concise but complete

OUTPUT: Write only the email response body (no subject line, no "Dear X" if not needed).
Start directly with the response content.`;
}

/**
 * Parse a .msg file (Outlook format)
 * Uses @pnp/msgraph-parser or falls back to basic extraction
 * @param {Buffer} buffer - The .msg file content
 * @returns {Promise<Object>} Parsed email object
 */
async function parseMsgFile(buffer) {
    try {
        // Try to use msg-parser if available
        let MsgReader;
        try {
            MsgReader = require('@pnp/msgraph-parser');
        } catch {
            try {
                MsgReader = require('msg-reader');
            } catch {
                // Fallback: try msgreader
                try {
                    const MsgReaderLib = require('msgreader');
                    const msgReader = new MsgReaderLib(buffer);
                    const data = msgReader.getFileData();
                    
                    return {
                        subject: data.subject || '',
                        from: parseEmailAddress(data.senderEmail || data.senderName || ''),
                        to: parseEmailAddressList(data.recipients?.map(r => r.email || r.name).join(', ') || ''),
                        cc: [],
                        bcc: [],
                        date: data.messageDeliveryTime ? new Date(data.messageDeliveryTime) : null,
                        messageId: null,
                        inReplyTo: null,
                        references: [],
                        text: data.body || '',
                        html: data.bodyHTML || '',
                        attachments: (data.attachments || []).map(att => ({
                            filename: att.fileName || att.name || 'attachment',
                            contentType: att.contentType || 'application/octet-stream',
                            size: att.content?.length || 0,
                            content: att.content
                        })),
                        headers: {}
                    };
                } catch (msgreaderErr) {
                    log.warn({ event: 'email_parser_msg_parser_unavailable', reason: msgreaderErr.message }, 'No MSG parser available');
                    throw new Error('MSG file parsing requires msgreader package. Install with: npm install msgreader');
                }
            }
        }

        // If we got here with MsgReader, use it
        if (MsgReader) {
            const reader = new MsgReader(buffer);
            const data = reader.getFileData();
            
            return {
                subject: data.subject || '',
                from: parseEmailAddress(data.senderEmail || data.senderName || ''),
                to: parseEmailAddressList(data.recipients?.filter(r => r.recipType === 'to').map(r => r.email || r.name).join(', ') || ''),
                cc: parseEmailAddressList(data.recipients?.filter(r => r.recipType === 'cc').map(r => r.email || r.name).join(', ') || ''),
                bcc: [],
                date: data.messageDeliveryTime ? new Date(data.messageDeliveryTime) : null,
                messageId: null,
                inReplyTo: null,
                references: [],
                text: data.body || '',
                html: data.bodyHTML || '',
                attachments: (data.attachments || []).map(att => ({
                    filename: att.fileName || att.name || 'attachment',
                    contentType: att.contentType || 'application/octet-stream',
                    size: att.content?.length || 0,
                    content: att.content
                })),
                headers: {}
            };
        }
    } catch (error) {
        log.warn({ event: 'email_parser_msg_failed', reason: error.message }, 'Failed to parse .msg');
        throw new Error(`Failed to parse MSG file: ${error.message}`);
    }
}

module.exports = {
    parseEmlFile,
    parseMsgFile,
    parseManualEmail,
    parseEmailAddress,
    parseEmailAddressList,
    parseFlexibleDate,
    extractSignature,
    extractContactsFromSignature,
    matchContacts,
    buildEmailAnalysisPrompt,
    buildResponsePrompt,
    HEADER_PATTERNS,
};
