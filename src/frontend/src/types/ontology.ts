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
