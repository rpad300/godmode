/**
 * Purpose:
 *   Centralised HTTP client that wraps the Fetch API with Supabase auth
 *   token injection, project context headers, error handling, and toast
 *   notifications. All backend API calls flow through this module.
 *
 * Responsibilities:
 *   - Attach Authorization (Bearer) and X-Project-Id headers automatically
 *   - Parse JSON responses and handle 204 No Content gracefully
 *   - Surface server (5xx) and network errors as toast notifications
 *   - Expose typed convenience methods: get, post, put, delete, patch, upload
 *   - Provide specialised methods for Ontology, LLM Queue, System, and User APIs
 *
 * Key dependencies:
 *   - lib/supabase: session token retrieval (supabase.auth.getSession)
 *   - sonner: toast for user-facing error alerts
 *   - types/ontology: OntologySchema, OntologySuggestion, OntologyStats
 *
 * Side effects:
 *   - All methods perform network requests
 *   - Global toast on 5xx and network errors
 *   - Module-level mutable state: currentProjectId (set via setCurrentProjectId)
 *
 * Notes:
 *   - BASE_URL is empty string so requests go to the same origin (Vite proxy or prod reverse proxy).
 *   - The upload method intentionally omits Content-Type so the browser can set
 *     the multipart boundary automatically.
 *   - ApiError extends Error with status and details for granular catch handling.
 */
import { toast } from "sonner";
import { supabase } from "./supabase";

import { OntologySchema, OntologySuggestion, OntologyStats } from "../types/ontology";

const BASE_URL = "";

interface RequestOptions extends RequestInit {
    params?: Record<string, string | number | undefined>;
    responseType?: 'json' | 'blob';
}

/** Typed HTTP error with status code and optional structured details. */
class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

// Project Context Management (from Remote)
let currentProjectId: string | null = null;

export function setCurrentProjectId(id: string | null) {
    currentProjectId = id;
}

export function getCurrentProjectId(): string | null {
    return currentProjectId;
}

/**
 * Core request function. Attaches auth token and project ID headers,
 * handles error parsing, and surfaces global toast for 5xx/network errors.
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...init } = options;

    let url = `${BASE_URL}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                searchParams.append(key, String(value));
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = { ...init.headers };

        if (session?.access_token) {
            (headers as any)['Authorization'] = `Bearer ${session.access_token}`;
        }

        // Add Project ID header if available
        if (currentProjectId) {
            (headers as any)['X-Project-Id'] = currentProjectId;
        }

        const response = await fetch(url, { ...init, headers, credentials: 'include' });

        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData?.error) {
                    errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
                }
            } catch (e) {
                // Could not parse error JSON, fall back to status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new ApiError(errorMessage, response.status);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        if (options.responseType === 'blob') {
            const data = await response.blob();
            return data as unknown as T;
        }

        const data = await response.json();
        return data as T;
    } catch (error) {
        console.error("API Request Error:", error);
        if (error instanceof ApiError) {
            // Optional: global error toast for specific status codes
            if (error.status >= 500) {
                toast.error("Server error. Please try again later.");
            }
        } else {
            toast.error("Network error. Please check your connection.");
        }
        throw error;
    }
}

export const apiClient = {
    get: async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
        return request<T>(endpoint, { ...options, method: "GET" });
    },
    post: async <T>(endpoint: string, body: any, options: RequestOptions = {}): Promise<T> => {
        return request<T>(endpoint, {
            ...options,
            method: "POST",
            headers: { ...options.headers, "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    },
    put: async <T>(endpoint: string, body: any, options: RequestOptions = {}): Promise<T> => {
        return request<T>(endpoint, {
            ...options,
            method: "PUT",
            headers: { ...options.headers, "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    },
    delete: async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
        return request<T>(endpoint, { ...options, method: "DELETE" });
    },
    patch: async <T>(endpoint: string, body: any, options: RequestOptions = {}): Promise<T> => {
        return request<T>(endpoint, {
            ...options,
            method: "PATCH",
            headers: { ...options.headers, "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    },
    upload: async <T>(endpoint: string, formData: FormData, options: RequestOptions = {}): Promise<T> => {
        // Upload doesn't need Content-Type header (browser sets it with boundary)
        return request<T>(endpoint, {
            ...options,
            method: "POST",
            body: formData,
        });
    },

    // Ontology API
    getOntologySchema: async (): Promise<{ ok: boolean; schema: OntologySchema }> => {
        return request<{ ok: boolean; schema: OntologySchema }>("/api/ontology/schema");
    },
    getOntologySuggestions: async (): Promise<{ ok: boolean; suggestions: OntologySuggestion[]; stats: OntologyStats }> => {
        return request<{ ok: boolean; suggestions: OntologySuggestion[]; stats: OntologyStats }>("/api/ontology/suggestions");
    },
    getOntologyStats: async (): Promise<{ ok: boolean; stats: any }> => {
        return request<{ ok: boolean; stats: any }>("/api/ontology/stats");
    },
    approveSuggestion: async (id: string, modifications: any = {}): Promise<{ ok: boolean; message?: string; error?: string }> => {
        return request<{ ok: boolean; message?: string; error?: string }>(`/api/ontology/suggestions/${id}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(modifications)
        });
    },
    rejectSuggestion: async (id: string, reason: string): Promise<{ ok: boolean; error?: string }> => {
        return request<{ ok: boolean; error?: string }>(`/api/ontology/suggestions/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason })
        });
    },
    enrichSuggestion: async (id: string): Promise<{ ok: boolean; enrichment?: any; error?: string }> => {
        return request<{ ok: boolean; enrichment?: any; error?: string }>(`/api/ontology/suggestions/${id}/enrich`, {
            method: "POST"
        });
    },
    analyzeGraph: async (): Promise<{ ok: boolean; analysis: any; suggestions: OntologySuggestion[]; summary?: string }> => {
        return request<{ ok: boolean; analysis: any; suggestions: OntologySuggestion[]; summary?: string }>("/api/ontology/analyze", {
            method: "POST"
        });
    },
    setAutoApprove: async (threshold: number): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>("/api/ontology/suggestions/auto-approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threshold })
        });
    },
    triggerWorker: async (type: string, config: any = {}): Promise<{ ok: boolean; message?: string }> => {
        return request<{ ok: boolean; message?: string }>("/api/ontology/worker/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, config })
        });
    },
    getOntologyWorkerStatus: async (): Promise<{ ok: boolean; status: any; stats: any }> => {
        return request<{ ok: boolean; status: any; stats: any }>("/api/ontology/worker/status");
    },

    // LLM Queue
    getLLMQueueStatus: async (): Promise<any> => {
        return request<any>("/api/llm/queue/status");
    },

    getLLMQueueHistory: async (limit: number = 50): Promise<any> => {
        return request<any>(`/api/llm/queue/history?limit=${limit}`);
    },

    getLLMQueuePending: async (limit: number = 50): Promise<any> => {
        return request<any>(`/api/llm/queue/pending?limit=${limit}`);
    },

    getLLMQueueRetryable: async (limit: number = 50): Promise<any> => {
        return request<any>(`/api/llm/queue/retryable?limit=${limit}`);
    },

    retryLLMQueueItem: async (id: string): Promise<any> => {
        return request<any>(`/api/llm/queue/retry/${id}`, { method: 'POST' });
    },

    cancelLLMQueueItem: async (id: string): Promise<any> => {
        return request<any>(`/api/llm/queue/cancel/${id}`, { method: 'POST' });
    },

    pauseLLMQueue: async (): Promise<any> => {
        return request<any>("/api/llm/queue/pause", { method: 'POST' });
    },

    resumeLLMQueue: async (): Promise<any> => {
        return request<any>("/api/llm/queue/resume", { method: 'POST' });
    },

    clearLLMQueue: async (status: string = 'all'): Promise<any> => {
        return request<any>("/api/llm/queue/clear", { method: 'POST', body: JSON.stringify({ status }) });
    },
    addEntityType: async (name: string, description: string, properties: any = null): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>("/api/ontology/entity-type", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description, properties })
        });
    },
    addRelationType: async (data: { name: string; description?: string; from?: string; to?: string }): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>("/api/ontology/relation-type", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: data.name,
                description: data.description,
                from: data.from || "*",
                to: data.to || "*"
            })
        });
    },
    getOntologyJobs: async (): Promise<{ ok: boolean; jobs: any[] }> => {
        return request<{ ok: boolean; jobs: any[] }>("/api/ontology/jobs");
    },
    toggleOntologyJob: async (id: string): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>(`/api/ontology/jobs/${id}/toggle`, { method: "POST" });
    },
    extractOntologyFromGraph: async (): Promise<{ ok: boolean; extracted: any }> => {
        return request<{ ok: boolean; extracted: any }>("/api/ontology/extract-from-graph");
    },
    mergeOntology: async (data: { source: any; strategy?: string }): Promise<{ ok: boolean; result: any }> => {
        return request<{ ok: boolean; result: any }>("/api/ontology/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    },
    getOntologyWorkerLog: async (): Promise<{ ok: boolean; log: any[] }> => {
        return request<{ ok: boolean; log: any[] }>("/api/ontology/worker/log");
    },
    getInferenceRules: async (): Promise<{ ok: boolean; rules: any[]; cyphers: any[] }> => {
        return request<{ ok: boolean; rules: any[]; cyphers: any[] }>("/api/ontology/inference/rules");
    },
    getInferenceStats: async (): Promise<{ ok: boolean; stats: any; availableRules: any[] }> => {
        return request<{ ok: boolean; stats: any; availableRules: any[] }>("/api/ontology/inference/stats");
    },
    runInferenceRule: async (ruleName?: string): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>("/api/ontology/inference/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ruleName })
        });
    },
    getEmbeddingsDashboard: async (): Promise<{ ok: boolean; summary: any; coverageByType: any }> => {
        return request<{ ok: boolean; summary: any; coverageByType: any }>("/api/ontology/embeddings/dashboard");
    },
    regenerateEmbeddings: async (entityType?: string): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>("/api/ontology/embeddings/regenerate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType })
        });
    },
    getSharedOntology: async (): Promise<{ ok: boolean; sharedEntities: any[]; crossGraphRelations: any[]; crossProjectPatterns: any[] }> => {
        return request<{ ok: boolean; sharedEntities: any[]; crossGraphRelations: any[]; crossProjectPatterns: any[] }>("/api/ontology/shared");
    },
    toggleEntityShared: async (name: string, shared: boolean): Promise<{ ok: boolean }> => {
        return request<{ ok: boolean }>(`/api/ontology/entity-type/${encodeURIComponent(name)}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shared })
        });
    },
    getOntologyVersions: async (): Promise<{ ok: boolean; currentVersion: string; history: any[]; totalChanges: number }> => {
        return request<{ ok: boolean; currentVersion: string; history: any[]; totalChanges: number }>("/api/ontology/versions");
    },
    validateEntity: async (type: string, entity: Record<string, unknown>): Promise<{ ok: boolean; valid: boolean; errors?: string[] }> => {
        return request<{ ok: boolean; valid: boolean; errors?: string[] }>("/api/ontology/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, entity })
        });
    },
    extractFromText: async (text: string, existingEntities?: string[]): Promise<{ ok: boolean; entities?: any[]; relationships?: any[] }> => {
        return request<{ ok: boolean; entities?: any[]; relationships?: any[] }>("/api/ontology/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, existingEntities })
        });
    },
    enrichEntity: async (type: string, entity: Record<string, unknown>, context?: Record<string, unknown>): Promise<{ ok: boolean; enrichedText?: string }> => {
        return request<{ ok: boolean; enrichedText?: string }>("/api/ontology/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, entity, context })
        });
    },

    // System Stats
    getSystemStats: async (): Promise<any> => {
        return request<any>("/api/system/stats");
    },

    // User Management (Project Context)
    getUsers: async (): Promise<{ ok: boolean; users: any[]; stats: any }> => {
        return request<{ ok: boolean; users: any[]; stats: any }>("/api/roles/users");
    },
    // User Management (System Context - DB)
    getSystemUsers: async (): Promise<{ ok: boolean; users: any[]; stats: any }> => {
        return request<{ ok: boolean; users: any[]; stats: any }>("/api/system/users");
    },
    addSystemUser: async (user: any): Promise<{ ok: boolean; user?: any; error?: string }> => {
        return request<{ ok: boolean; user?: any; error?: string }>("/api/system/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });
    },
    updateSystemUser: async (id: string, updates: any): Promise<{ ok: boolean; user?: any; error?: string }> => {
        return request<{ ok: boolean; user?: any; error?: string }>(`/api/system/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates)
        });
    },
    deleteSystemUser: async (id: string): Promise<{ ok: boolean; error?: string }> => {
        return request<{ ok: boolean; error?: string }>(`/api/system/users/${id}`, {
            method: "DELETE"
        });
    },
    // Legacy / Project-Specific Methods (Deprecated)
    addUser: async (user: any): Promise<{ ok: boolean; user?: any; error?: string }> => {
        return request<{ ok: boolean; user?: any; error?: string }>("/api/roles/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });
    },
    updateUser: async (id: string, updates: any): Promise<{ ok: boolean; user?: any; error?: string }> => {
        return request<{ ok: boolean; user?: any; error?: string }>(`/api/roles/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates)
        });
    },
    deleteUser: async (id: string): Promise<{ ok: boolean; error?: string }> => {
        return request<{ ok: boolean; error?: string }>(`/api/roles/users/${id}`, {
            method: "DELETE"
        });
    }
};
