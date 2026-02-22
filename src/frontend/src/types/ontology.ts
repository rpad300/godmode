/**
 * Purpose:
 *   Type definitions for the ontology management subsystem. Covers entity types,
 *   relationship types, the overall schema, AI-generated suggestions for schema
 *   evolution, and analysis results from the graph intelligence worker.
 *
 * Responsibilities:
 *   - EntityProperty / EntityType / RelationshipType: schema building blocks
 *   - OntologySchema: versioned snapshot of all entity and relation types
 *   - OntologySuggestion: AI-proposed additions (new entity, relation, or property)
 *     with confidence scores, enrichment data, and approval workflow states
 *   - OntologyStats: aggregate counts for the suggestion pipeline
 *   - GraphAnalysisResult: output of a full graph analysis run
 *
 * Key dependencies:
 *   - None (pure type declarations)
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - RelationshipType.from/to accept '*' as a wildcard for any entity type.
 *   - OntologySuggestion.enrichment is populated by an LLM enrichment step
 *     (description, properties, use cases, related types).
 */
export interface EntityProperty {
    type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
    required?: boolean;
    description?: string;
    enum?: string[];
}

export interface EntityType {
    name: string;
    description?: string;
    properties: Record<string, EntityProperty>;
    color?: string;
    count?: number;
    relationships?: RelationshipType[];
}

export interface RelationshipType {
    name: string;
    from: string | string[]; // '*' or specific types
    to: string | string[];   // '*' or specific types
    description?: string;
    properties?: Record<string, EntityProperty>;
}

export interface OntologySchema {
    version: string;
    entityTypes: Record<string, EntityType>;
    relationTypes: Record<string, RelationshipType>;
}

export interface OntologySuggestion {
    id: string;
    type: 'new_entity' | 'new_relation' | 'new_property';
    name: string;
    description?: string;
    confidence: number;
    source: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    example?: string;
    properties?: string[]; // For new_entity
    from?: string; // For new_relation
    to?: string;   // For new_relation
    entityType?: string; // For new_property
    enrichment?: {
        description?: string;
        properties?: string[];
        useCases?: string[];
        relatedTypes?: string[];
    };
    rejectionReason?: string;
}

export interface OntologyStats {
    suggestionsGenerated: number;
    approved: number;
    rejected: number;
    pendingCount: number;
    historyCount: number;
}

export interface GraphAnalysisResult {
    suggestions: OntologySuggestion[];
    graphLabels: { label: string; count: number }[];
    graphRels: { type: string; count: number }[];
    summary?: string;
}

export interface OntologyJob {
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    interval?: string;
    cron?: string;
    lastRun?: string;
    nextRun?: string;
    status?: 'idle' | 'running' | 'completed' | 'failed';
    stats?: {
        totalRuns?: number;
        completedRuns?: number;
        failedRuns?: number;
        avgDuration?: number;
    };
}

export interface OntologyWorkerLogEntry {
    id?: string;
    jobType: string;
    status: 'started' | 'completed' | 'failed';
    startedAt: string;
    completedAt?: string;
    duration?: number;
    result?: Record<string, unknown>;
    error?: string;
}

export interface OntologyChangeEntry {
    id: string;
    change_type: string;
    target_type?: string;
    target_name?: string;
    old_definition?: Record<string, unknown>;
    new_definition?: Record<string, unknown>;
    diff?: Record<string, unknown>;
    reason?: string;
    source?: string;
    changed_by?: string;
    changed_at: string;
}

export interface ComplianceResult {
    score: number;
    totalNodes: number;
    validNodes: number;
    invalidNodes: number;
    uncheckedNodes: number;
    issues: Array<{
        type: string;
        entity?: string;
        message: string;
        severity?: 'error' | 'warning' | 'info';
    }>;
}

export interface ExtractedOntology {
    entities: Array<{ name: string; count: number; properties: string[] }>;
    relations: Array<{ name: string; count: number; from: string; to: string }>;
    notInSchema: string[];
    unusedInSchema: string[];
}

export interface OntologyDiff {
    added: { entities: string[]; relations: string[] };
    removed: { entities: string[]; relations: string[] };
    modified: { entities: string[]; relations: string[] };
}
