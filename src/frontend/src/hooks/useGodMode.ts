
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { Contact } from "../types/godmode";
import { useProject } from "@/contexts/ProjectContext";

// --- Types tailored to the API response ---

export interface DashboardStats {
    documents: { total: number; processed: number; pending: number };
    totalFacts: number;
    factsByCategory: Record<string, number>;
    factsVerifiedCount: number;
    totalQuestions: number;
    totalDecisions: number;
    totalRisks: number;
    totalActions: number;
    totalPeople: number;
    questionsByPriority: { critical: number; high: number; medium: number; resolved: number };
    risksByImpact: { high: number; medium: number; low: number };
    overdueActions: number;
    overdueItems: any[]; // Define more specifically if needed
    questionAging: { fresh: number; aging: number; stale: number; critical: number };
    oldestQuestions: any[];
    trends: any[];
    trendInsights: any[];
    actionsByStatus: { completed: number; in_progress: number; pending: number; overdue: number };
    recentActions: any[];
    recentRisks: any[];
    recentHistory: any[];
    weeklyActivity: { day: string; facts: number; actions: number; questions: number }[];
    activeSprint: any;
}

interface ContactsResponse {
    ok: boolean;
    contacts: Contact[];
    total: number;
}

// --- Hooks ---

export function useDashboardData() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["dashboard", currentProjectId],
        queryFn: () => apiClient.get<DashboardStats>("/api/dashboard", {
            headers: { 'x-project-id': currentProjectId }
        }),
        // Refresh every minute to keep stats somewhat fresh
        refetchInterval: 60000,
        enabled: !!currentProjectId,
    });
}

export function useContacts() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["contacts", currentProjectId],
        queryFn: async () => {
            const response = await apiClient.get<ContactsResponse>("/api/contacts", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.contacts || [];
        },
        enabled: !!currentProjectId,
    });
}

export function useAllContacts() {
    return useQuery({
        queryKey: ["contacts", "all"],
        queryFn: async () => {
            // No project ID header to get all contacts
            const response = await apiClient.get<ContactsResponse>("/api/contacts");
            return response.contacts || [];
        },
    });
}

export function useProjectMembers() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["project-members", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ members: any[] }>(`/api/projects/${currentProjectId}/members`);
            // Map ProjectMember to Contact for GoldenHours compatibility
            return (response.members || []).map(m => ({
                id: m.user_id,
                name: m.display_name,
                role: m.role,
                organization: m.linked_contact?.organization || 'Team',
                timezone: m.timezone || 'UTC', // Ensure backend sends this or we default
                avatarUrl: m.avatar_url,
                email: m.email,
                mentionCount: 0
            } as Contact));
        },
        enabled: !!currentProjectId
    });
}


// Example mutation for creating a contact (can extend as needed)
export function useCreateContact() {
    const queryClient = useQueryClient();
    const { currentProjectId } = useProject();
    return useMutation({
        mutationFn: (newContact: Partial<Contact>) => apiClient.post("/api/contacts", newContact, {
            headers: { 'x-project-id': currentProjectId }
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contacts", currentProjectId] });
            queryClient.invalidateQueries({ queryKey: ["dashboard", currentProjectId] }); // Update counts
        },
    });
}

export function useUpdateContact() {
    const queryClient = useQueryClient();
    const { currentProjectId } = useProject();
    return useMutation({
        mutationFn: (contact: Contact) => apiClient.put(`/api/contacts/${contact.id}`, contact, {
            headers: { 'x-project-id': currentProjectId }
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contacts", currentProjectId] });
        },
    });
}

export function useDeleteContact() {
    const queryClient = useQueryClient();
    const { currentProjectId } = useProject();
    return useMutation({
        mutationFn: (contactId: string) => apiClient.delete(`/api/contacts/${contactId}`, {
            headers: { 'x-project-id': currentProjectId }
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contacts", currentProjectId] });
            queryClient.invalidateQueries({ queryKey: ["dashboard", currentProjectId] }); // Update counts
        },
    });
}

// --- Graph & Documents Hooks ---

export interface Document {
    id: string;
    filename: string;
    status: 'processed' | 'pending' | 'processing' | 'failed' | 'completed' | 'deleted';
    created_at: string;
    file_type?: string;
    doc_type?: string;
    summary?: string;
    facts_count?: number;
    risks_count?: number;
    questions_count?: number;
    actions_count?: number;
    decisions_count?: number;
}

export interface GraphNode {
    id: string;
    label: string;
    properties?: any;
    x?: number;
    y?: number;
}

export interface GraphEdge {
    id: string;
    from: string;
    to: string;
    type: string;
    properties?: any;
}

export function useDocuments() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["documents", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ documents: Document[] }>("/api/documents?status=all", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.documents || [];
        },
        enabled: !!currentProjectId
    });
}

export function useGraphNodes() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["graph-nodes", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ ok: boolean, nodes: GraphNode[] }>("/api/graph/nodes", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.nodes || [];
        },
        enabled: !!currentProjectId
    });
}

export function useGraphEdges() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["graph-edges", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ ok: boolean, relationships: GraphEdge[] }>("/api/graph/relationships", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.relationships || [];
        },
        enabled: !!currentProjectId
    });
}

export function useGraphData() {
    const { currentProjectId } = useProject();
    const documentsQuery = useDocuments();
    const membersQuery = useProjectMembers();
    const nodesQuery = useGraphNodes();
    const edgesQuery = useGraphEdges();

    const refresh = async () => {
        if (!currentProjectId) return;
        await apiClient.post("/api/graph/sync", {}, {
            headers: { 'x-project-id': currentProjectId }
        });
        documentsQuery.refetch();
        membersQuery.refetch();
        nodesQuery.refetch();
        edgesQuery.refetch();
    };

    return {
        documents: documentsQuery.data || [],
        members: membersQuery.data || [],
        graphNodes: nodesQuery.data || [],
        graphEdges: edgesQuery.data || [],
        isLoading: documentsQuery.isLoading || membersQuery.isLoading || nodesQuery.isLoading || edgesQuery.isLoading,
        refresh
    };
}

export function useSOTData() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["sot", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return null;
            const response = await apiClient.get<any>("/api/sot/enhanced", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response || {};
        },
        enabled: !!currentProjectId
    });
}

export function useSprints() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["sprints", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ sprints: any[] }>("/api/sprints", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.sprints || [];
        },
        enabled: !!currentProjectId
    });
}

export function useEmails() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["emails", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ emails: any[] }>("/api/emails", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.emails || [];
        },
        enabled: !!currentProjectId
    });
}

export function useCosts() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["costs", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return { costs: [], summary: { total_cost: 0, budget_used: 0, projection: 0 } }; // Default structure
            const response = await apiClient.get<{ costs: any[], summary: any }>("/api/costs", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response || { costs: [], summary: { total_cost: 0, budget_used: 0, projection: 0 } };
        },
        enabled: !!currentProjectId
    });
}

export function useProjectActivity() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["activity", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ activity: any[] }>(`/api/projects/${currentProjectId}/activity`, {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.activity || [];
        },
        enabled: !!currentProjectId
    });
}

// Team Analysis Hooks
export function useTeamAnalysisProfiles() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["team-profiles", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ ok: boolean, profiles: any[] }>("/api/team-analysis/profiles", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.profiles || [];
        },
        enabled: !!currentProjectId
    });
}

export function useTeamAnalysisOverview() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["team-overview", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return null;
            const response = await apiClient.get<{ ok: boolean, analysis: any }>("/api/team-analysis/team", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.analysis || null;
        },
        enabled: !!currentProjectId
    });
}

export function useTeamAnalysisGraph() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["team-graph", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return { nodes: [], edges: [] };
            const response = await apiClient.get<{ ok: boolean, nodes: any[], edges: any[] }>("/api/team-analysis/graph", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response || { nodes: [], edges: [] };
        },
        enabled: !!currentProjectId
    });
}

// Chat Hooks
export function useChatSessions() {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["chat-sessions", currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            const response = await apiClient.get<{ ok: boolean, sessions: any[] }>("/api/chat/sessions", {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.sessions || [];
        },
        enabled: !!currentProjectId
    });
}

export function useChatMessages(sessionId: string | null) {
    const { currentProjectId } = useProject();
    return useQuery({
        queryKey: ["chat-messages", sessionId],
        queryFn: async () => {
            if (!currentProjectId || !sessionId) return [];
            const response = await apiClient.get<{ ok: boolean, messages: any[] }>(`/api/chat/sessions/${sessionId}/messages`, {
                headers: { 'x-project-id': currentProjectId }
            });
            return response.messages || [];
        },
        enabled: !!currentProjectId && !!sessionId
    });
}
