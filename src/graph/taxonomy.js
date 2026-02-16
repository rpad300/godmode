/**
 * Professional Knowledge Graph View (V2) - Taxonomy Constants
 * 
 * This file acts as the single source of truth for all Node Labels and Relationship Types
 * used in the graph. It mirrors the definitions in `implementation_plan.md`.
 * 
 * Usage:
 * import { NodeLabel, RelationshipType } from './taxonomy';
 */

export const NodeLabel = {
    Project: 'Project',
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
};

export const RelationshipType = {
    // Structural
    BELONGS_TO_PROJECT: 'BELONGS_TO_PROJECT',

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

    // Semantic (Similarity)
    SIMILAR_TO: 'SIMILAR_TO',
};

// Map source tables to Node Labels
export const TableToLabel = {
    projects: NodeLabel.Project,
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
};

// Node Colors for consistent backend/frontend use (if needed by backend transformer)
export const NodeColors = {
    [NodeLabel.Project]: '#2563eb', // blue-600
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
};
