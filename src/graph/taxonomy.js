/**
 * Purpose:
 *   Single source of truth for the knowledge graph schema: node labels,
 *   relationship types, source-table-to-label mappings, and presentation
 *   colours. All graph producers and consumers should reference these
 *   constants rather than using string literals.
 *
 * Responsibilities:
 *   - Define every allowed NodeLabel (Project, Document, Person, etc.)
 *   - Define every allowed RelationshipType grouped by domain layer
 *     (structural, extraction, people, interpersonal, cross-entity, semantic)
 *   - Map Supabase source table names to their corresponding NodeLabel
 *   - Provide consistent colour tokens for graph visualisation
 *
 * Key dependencies:
 *   - None (pure constants, no runtime imports)
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - This file uses ES module `export` syntax. Consumers using CommonJS will
 *     need a compatible bundler or transpiler.
 *   - The definitions mirror `implementation_plan.md`; keep both in sync when
 *     adding new entity types or relationship kinds.
 *   - NodeColors map labels to Tailwind-style hex values for frontend rendering.
 *   - Action (not Task) is used as the node label for action items, matching
 *     the underlying `action_items` source table.
 */

export const NodeLabel = {
    Project: 'Project',
    Company: 'Company',
    Document: 'Document',
    Person: 'Person',
    Contact: 'Contact',
    Team: 'Team',
    Fact: 'Fact',
    Decision: 'Decision',
    Risk: 'Risk',
    Action: 'Action',
    Question: 'Question',
    Email: 'Email',
    Sprint: 'Sprint',
    CalendarEvent: 'CalendarEvent',
    UserStory: 'UserStory',
    Task: 'Task',
};

export const RelationshipType = {
    // Structural
    BELONGS_TO_PROJECT: 'BELONGS_TO_PROJECT',
    BELONGS_TO_COMPANY: 'BELONGS_TO_COMPANY',

    // Extraction
    EXTRACTED_FROM: 'EXTRACTED_FROM',
    MENTIONED_IN: 'MENTIONED_IN',

    // People & Teams
    MEMBER_OF_TEAM: 'MEMBER_OF_TEAM',
    LEADS_TEAM: 'LEADS_TEAM',
    PARTICIPATES_IN: 'PARTICIPATES_IN',
    LINKED_TO: 'LINKED_TO',

    // Interpersonal (from relationships table)
    REPORTS_TO: 'REPORTS_TO',
    MANAGES: 'MANAGES',
    LEADS: 'LEADS',
    WORKS_WITH: 'WORKS_WITH',
    COLLABORATES: 'COLLABORATES',
    ADVISES: 'ADVISES',
    STAKEHOLDER: 'STAKEHOLDER',

    // Cross-entity
    IMPLEMENTS: 'IMPLEMENTS',
    CHILD_OF: 'CHILD_OF',
    PLANNED_IN: 'PLANNED_IN',
    SENT_BY: 'SENT_BY',
    SENT_TO: 'SENT_TO',
    HAS_ATTACHMENT: 'HAS_ATTACHMENT',
    DEPENDS_ON: 'DEPENDS_ON',

    // Attribution
    AUTHORED_BY: 'AUTHORED_BY',
    ASSIGNED_TO: 'ASSIGNED_TO',
    PARENT_OF: 'PARENT_OF',

    // Communication
    MENTIONS: 'MENTIONS',
    INVOLVES: 'INVOLVES',
    DERIVED_FROM: 'DERIVED_FROM',
    REPLY_TO: 'REPLY_TO',
    REQUESTED_BY: 'REQUESTED_BY',

    // Semantic (Similarity)
    SIMILAR_TO: 'SIMILAR_TO',
};

// Map source tables to Node Labels
export const TableToLabel = {
    projects: NodeLabel.Project,
    companies: NodeLabel.Company,
    documents: NodeLabel.Document,
    people: NodeLabel.Person,
    contacts: NodeLabel.Contact,
    teams: NodeLabel.Team,
    facts: NodeLabel.Fact,
    decisions: NodeLabel.Decision,
    risks: NodeLabel.Risk,
    action_items: NodeLabel.Action,
    knowledge_questions: NodeLabel.Question,
    emails: NodeLabel.Email,
    sprints: NodeLabel.Sprint,
    calendar_events: NodeLabel.CalendarEvent,
    user_stories: NodeLabel.UserStory,
};

// Node Colors for consistent backend/frontend use (if needed by backend transformer)
export const NodeColors = {
    [NodeLabel.Project]: '#2563eb', // blue-600
    [NodeLabel.Company]: '#0d9488', // teal-600
    [NodeLabel.Document]: '#f59e0b', // amber-500
    [NodeLabel.Person]: '#22c55e', // green-500
    [NodeLabel.Contact]: '#14b8a6', // teal-500
    [NodeLabel.Team]: '#a855f7', // purple-500
    [NodeLabel.Fact]: '#38bdf8', // sky-400
    [NodeLabel.Decision]: '#f97316', // orange-500
    [NodeLabel.Risk]: '#ef4444', // red-500
    [NodeLabel.Action]: '#10b981', // emerald-500
    [NodeLabel.Question]: '#a78bfa', // violet-400
    [NodeLabel.Email]: '#94a3b8', // slate-400
    [NodeLabel.Sprint]: '#6366f1', // indigo-500
    [NodeLabel.CalendarEvent]: '#06b6d4', // cyan-500
    [NodeLabel.UserStory]: '#ec4899', // pink-500
    [NodeLabel.Task]: '#10b981', // emerald-500 (same as Action)
};
