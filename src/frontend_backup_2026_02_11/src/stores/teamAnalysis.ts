/**
 * Team Analysis Store
 * State management for behavioral profiles and team dynamics
 */

import { fetchWithProject } from '../services/api';

// Types
export interface BehavioralProfile {
    id: string;
    person_id: string;
    person?: {
        id: string;
        name: string;
        role?: string;
        organization?: string;
        email?: string;
    };
    profile_data: ProfileData;
    confidence_level: 'low' | 'medium' | 'high' | 'very_high';
    communication_style?: string;
    dominant_motivation?: string;
    risk_tolerance?: 'low' | 'medium' | 'high';
    influence_score: number;
    transcripts_analyzed: string[];
    transcript_count: number;
    total_speaking_time_seconds: number;
    limitations: string[];
    recommended_update_after?: string;
    last_analysis_at: string;
    created_at: string;
    updated_at: string;
}

export interface ProfileData {
    target_name?: string;
    analysis_date?: string;
    confidence_level?: string;
    communication_identity?: {
        dominant_style?: string;
        intervention_rhythm?: string;
        textual_body_language?: string;
        evidence?: Evidence[];
    };
    motivations_and_priorities?: {
        values_most?: string[];
        avoids?: string[];
        based_on?: string;
        confidence?: string;
        evidence?: Evidence[];
    };
    behavior_under_pressure?: PressureBehavior[];
    influence_tactics?: InfluenceTactic[];
    vulnerabilities?: {
        discourse_action_inconsistencies?: { description: string; evidence: string }[];
        defense_triggers?: { trigger: string; evidence: string }[];
        blind_spots?: { description: string; evidence: string }[];
        risk_patterns?: { pattern: string; evidence: string }[];
    };
    interaction_strategy?: {
        ideal_format?: {
            channel?: string;
            structure?: string;
            timing?: string;
        };
        framing_that_works?: string[];
        what_to_avoid?: string[];
        cooperation_triggers?: string[];
    };
    early_warning_signs?: EarlyWarningSign[];
    power_analysis?: PowerAnalysis[];
    limitations?: string[];
    recommended_update_after?: string;
}

export interface Evidence {
    timestamp?: string;
    quote?: string;
    observation?: string;
}

export interface PressureBehavior {
    situation: string;
    observed_behavior: string;
    timestamp?: string;
    quote?: string;
}

export interface InfluenceTactic {
    objective: string;
    tactic: string;
    timestamp?: string;
    example?: string;
}

export interface EarlyWarningSign {
    signal: string;
    indicates: string;
    comparison_evidence?: string;
}

export interface PowerAnalysis {
    factor: string;
    assessment: string;
    strategic_implication?: string;
}

export interface TeamAnalysis {
    id: string;
    project_id: string;
    analysis_data: TeamAnalysisData;
    team_size: number;
    cohesion_score: number;
    tension_level: 'low' | 'medium' | 'high';
    dominant_communication_pattern?: string;
    influence_map: InfluenceRelation[];
    alliances: Alliance[];
    tensions: Tension[];
    members_included: string[];
    transcripts_analyzed: string[];
    last_analysis_at: string;
}

export interface TeamAnalysisData {
    analysis_date?: string;
    team_size?: number;
    cohesion_score?: number;
    tension_level?: string;
    dominant_communication_pattern?: string;
    power_centers?: PowerCenter[];
    communication_flow?: {
        central_nodes?: string[];
        bottlenecks?: string[];
        isolated_members?: string[];
        information_brokers?: string[];
    };
    recommendations?: string[];
    risk_factors?: string[];
}

export interface InfluenceRelation {
    from_person?: string;
    to_person?: string;
    influence_type?: string;
    strength?: number;
    evidence?: string;
}

export interface Alliance {
    members?: string[];
    alliance_type?: string;
    shared_values?: string[];
    strength?: number;
    evidence?: string;
}

export interface Tension {
    between?: string[];
    tension_type?: string;
    level?: string;
    triggers?: string[];
    evidence?: string;
}

export interface PowerCenter {
    person?: string;
    power_type?: string;
    influence_reach?: number;
    dependencies?: string[];
}

export interface BehavioralRelationship {
    id: string;
    from_person_id: string;
    to_person_id: string;
    from_person?: { id: string; name: string };
    to_person?: { id: string; name: string };
    relationship_type: string;
    strength: number;
    confidence: string;
    evidence: any[];
    evidence_count: number;
}

export interface GraphNode {
    id: string;
    label: string;
    group: string;
    size: number;
    title?: string;
    color?: string;
    properties?: Record<string, any>;
}

export interface GraphEdge {
    from: string;
    to: string;
    type: string;
    label?: string;
    width?: number;
    dashes?: boolean;
    color?: string;
    arrows?: string;
    title?: string;
    properties?: Record<string, any>;
}

export interface TeamAnalysisState {
    profiles: BehavioralProfile[];
    selectedProfile: BehavioralProfile | null;
    teamAnalysis: TeamAnalysis | null;
    relationships: BehavioralRelationship[];
    graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
    loading: boolean;
    analyzing: boolean;
    error: string | null;
    currentSubtab: 'profiles' | 'team' | 'graph';
}

// Initial state
const initialState: TeamAnalysisState = {
    profiles: [],
    selectedProfile: null,
    teamAnalysis: null,
    relationships: [],
    graphData: null,
    loading: false,
    analyzing: false,
    error: null,
    currentSubtab: 'profiles',
};

// State
let state: TeamAnalysisState = { ...initialState };

// Listeners
const listeners: Set<(state: TeamAnalysisState) => void> = new Set();

/**
 * Notify all listeners
 */
function notify(): void {
    listeners.forEach(fn => fn(state));
}

/**
 * Get current state
 */
export function getState(): TeamAnalysisState {
    return state;
}

/**
 * Subscribe to state changes
 */
export function subscribe(callback: (state: TeamAnalysisState) => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

/**
 * Set loading state
 */
export function setLoading(loading: boolean): void {
    state = { ...state, loading };
    notify();
}

/**
 * Set analyzing state
 */
export function setAnalyzing(analyzing: boolean): void {
    state = { ...state, analyzing };
    notify();
}

/**
 * Set error
 */
export function setError(error: string | null): void {
    state = { ...state, error };
    notify();
}

/**
 * Set profiles
 */
export function setProfiles(profiles: BehavioralProfile[]): void {
    state = { ...state, profiles };
    notify();
}

/**
 * Set selected profile
 */
export function setSelectedProfile(profile: BehavioralProfile | null): void {
    state = { ...state, selectedProfile: profile };
    notify();
}

/**
 * Set team analysis
 */
export function setTeamAnalysis(analysis: TeamAnalysis | null): void {
    state = { ...state, teamAnalysis: analysis };
    notify();
}

/**
 * Set relationships
 */
export function setRelationships(relationships: BehavioralRelationship[]): void {
    state = { ...state, relationships };
    notify();
}

/**
 * Set graph data
 */
export function setGraphData(data: { nodes: GraphNode[]; edges: GraphEdge[] } | null): void {
    state = { ...state, graphData: data };
    notify();
}

/**
 * Set current subtab
 */
export function setSubtab(subtab: 'profiles' | 'team' | 'graph'): void {
    state = { ...state, currentSubtab: subtab };
    notify();
}

/**
 * Load profiles from API
 */
export async function loadProfiles(): Promise<void> {
    setLoading(true);
    setError(null);
    
    try {
        const response = await fetchWithProject('/api/team-analysis/profiles');
        const data = await response.json();
        
        if (data.ok) {
            setProfiles(data.profiles || []);
        } else {
            setError(data.error || 'Failed to load profiles');
        }
    } catch (error: any) {
        setError(error.message || 'Failed to load profiles');
    } finally {
        setLoading(false);
    }
}

/**
 * Load a specific profile
 */
export async function loadProfile(personId: string): Promise<BehavioralProfile | null> {
    setLoading(true);
    setError(null);
    
    try {
        const response = await fetchWithProject(`/api/team-analysis/profiles/${personId}`);
        const data = await response.json();
        
        if (data.ok && data.profile) {
            setSelectedProfile(data.profile);
            return data.profile;
        } else {
            setError(data.error || 'Profile not found');
            return null;
        }
    } catch (error: any) {
        setError(error.message || 'Failed to load profile');
        return null;
    } finally {
        setLoading(false);
    }
}

/**
 * Analyze a person's profile
 */
export async function analyzeProfile(personId: string, options: {
    relationshipContext?: string;
    objective?: string;
    forceReanalysis?: boolean;
} = {}): Promise<BehavioralProfile | null> {
    setAnalyzing(true);
    setError(null);
    
    try {
        const response = await fetchWithProject(`/api/team-analysis/profiles/${personId}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options)
        });
        const data = await response.json();
        
        if (data.ok && data.profile) {
            // Update profiles list
            const updatedProfiles = state.profiles.map(p => 
                p.person_id === personId ? data.profile : p
            );
            if (!updatedProfiles.find(p => p.person_id === personId)) {
                updatedProfiles.push(data.profile);
            }
            setProfiles(updatedProfiles);
            setSelectedProfile(data.profile);
            return data.profile;
        } else {
            setError(data.error || 'Failed to analyze profile');
            return null;
        }
    } catch (error: any) {
        setError(error.message || 'Failed to analyze profile');
        return null;
    } finally {
        setAnalyzing(false);
    }
}

/**
 * Load team analysis
 */
export async function loadTeamAnalysis(): Promise<void> {
    setLoading(true);
    setError(null);
    
    try {
        console.log('[TeamAnalysisStore] Loading team analysis...');
        const response = await fetchWithProject('/api/team-analysis/team');
        const data = await response.json();
        console.log('[TeamAnalysisStore] Team analysis response:', data);
        
        if (data.ok) {
            console.log('[TeamAnalysisStore] Setting team analysis:', data.analysis);
            setTeamAnalysis(data.analysis);
        } else {
            console.error('[TeamAnalysisStore] Error:', data.error);
            setError(data.error || 'Failed to load team analysis');
        }
    } catch (error: any) {
        console.error('[TeamAnalysisStore] Exception:', error);
        setError(error.message || 'Failed to load team analysis');
    } finally {
        setLoading(false);
    }
}

/**
 * Analyze team dynamics
 */
export async function analyzeTeam(forceReanalysis: boolean = false): Promise<TeamAnalysis | null> {
    setAnalyzing(true);
    setError(null);
    
    try {
        const response = await fetchWithProject('/api/team-analysis/team/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceReanalysis })
        });
        const data = await response.json();
        
        if (data.ok && data.analysis) {
            setTeamAnalysis(data.analysis);
            return data.analysis;
        } else {
            setError(data.error || 'Failed to analyze team');
            return null;
        }
    } catch (error: any) {
        setError(error.message || 'Failed to analyze team');
        return null;
    } finally {
        setAnalyzing(false);
    }
}

/**
 * Load relationships
 */
export async function loadRelationships(): Promise<void> {
    try {
        const response = await fetchWithProject('/api/team-analysis/relationships');
        const data = await response.json();
        
        if (data.ok) {
            setRelationships(data.relationships || []);
        }
    } catch (error) {
        console.error('Failed to load relationships:', error);
    }
}

/**
 * Load graph visualization data
 */
export async function loadGraphData(): Promise<void> {
    try {
        console.log('[TeamAnalysisStore] Loading graph data...');
        const response = await fetchWithProject('/api/team-analysis/graph');
        const data = await response.json();
        console.log('[TeamAnalysisStore] Graph data response:', data);
        
        if (data.ok) {
            console.log('[TeamAnalysisStore] Setting graph data:', data.nodes?.length, 'nodes,', data.edges?.length, 'edges');
            setGraphData({ nodes: data.nodes || [], edges: data.edges || [] });
        }
    } catch (error) {
        console.error('[TeamAnalysisStore] Failed to load graph data:', error);
    }
}

/**
 * Load all data
 */
export async function loadAll(): Promise<void> {
    await Promise.all([
        loadProfiles(),
        loadTeamAnalysis(),
        loadRelationships(),
        loadGraphData()
    ]);
}

/**
 * Reset to initial state
 */
export function reset(): void {
    state = { ...initialState };
    notify();
}

// Export as namespace
export const teamAnalysisStore = {
    getState,
    subscribe,
    setLoading,
    setAnalyzing,
    setError,
    setProfiles,
    setSelectedProfile,
    setTeamAnalysis,
    setRelationships,
    setGraphData,
    setSubtab,
    loadProfiles,
    loadProfile,
    analyzeProfile,
    loadTeamAnalysis,
    analyzeTeam,
    loadRelationships,
    loadGraphData,
    loadAll,
    reset,
};
