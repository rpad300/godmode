/**
 * Purpose:
 *   Admin panel for managing the knowledge graph ontology schema. Provides
 *   three sub-views: AI-generated suggestions, schema browsing/editing,
 *   and background graph analysis.
 *
 * Responsibilities:
 *   - OntologyManagerSection (main): tabbed container for the three views
 *   - SuggestionsView: fetches pending ontology suggestions via TanStack
 *     Query; supports approve, reject, and AI-enrich mutations
 *   - SchemaView: displays entity types and relationship types in list or
 *     interactive graph view (OntologyVisualizer); opens RelationBuilder
 *     dialog for creating new relationships
 *   - GraphAnalysisView: polls background worker status; triggers full
 *     ontology analysis; displays latest AI summary and gap statistics
 *
 * Key dependencies:
 *   - @tanstack/react-query: data fetching, caching, and mutations
 *   - apiClient: typed API helper for all ontology endpoints
 *   - OntologyVisualizer: React Flow-based schema graph view
 *   - RelationBuilder: form for creating new relationship types
 *   - sonner (toast): user feedback
 *
 * Side effects:
 *   - Network: fetches suggestions, schema, worker status; mutates
 *     suggestions (approve/reject/enrich); triggers background analysis;
 *     creates new relationship types
 *   - Worker polling: refetchInterval is 2s when analysis is running,
 *     5s when idle
 *
 * Notes:
 *   - OntologyVisualizer and RelationBuilder are imported mid-file (after
 *     SuggestionsView) rather than at the top; this is intentional to
 *     keep them co-located with SchemaView but could be refactored.
 *   - The "Add Entity" button in SchemaView is rendered but not wired up.
 */
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { OntologySchema, OntologySuggestion, OntologyStats, GraphAnalysisResult } from "../../types/ontology";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Check, X, Sparkles, Plus, Trash2, BrainCircuit, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function OntologyManagerSection() {
    const [activeTab, setActiveTab] = useState("suggestions");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Ontology Management</h2>
                    <p className="text-muted-foreground">Manage the knowledge graph schema and review AI suggestions.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="suggestions" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Suggestions
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4" />
                        Schema
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Analysis
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="suggestions" className="space-y-4">
                    <SuggestionsView />
                </TabsContent>
                <TabsContent value="schema" className="space-y-4">
                    <SchemaView />
                </TabsContent>
                <TabsContent value="analysis" className="space-y-4">
                    <GraphAnalysisView />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SuggestionsView() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["ontology", "suggestions"],
        queryFn: apiClient.getOntologySuggestions
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, modifications }: { id: string; modifications?: any }) =>
            apiClient.approveSuggestion(id, modifications),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ontology", "suggestions"] });
            queryClient.invalidateQueries({ queryKey: ["ontology", "schema"] });
            toast.success("Suggestion approved");
        },
        onError: () => toast.error("Failed to approve suggestion")
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            apiClient.rejectSuggestion(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ontology", "suggestions"] });
            toast.success("Suggestion rejected");
        },
        onError: () => toast.error("Failed to reject suggestion")
    });

    const enrichMutation = useMutation({
        mutationFn: (id: string) => apiClient.enrichSuggestion(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ontology", "suggestions"] });
            toast.success("Suggestion enriched with AI");
        },
        onError: () => toast.error("Failed to enrich suggestion")
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const suggestions = data?.suggestions || [];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.length === 0 ? (
                <div className="col-span-full text-center p-8 text-muted-foreground">
                    No pending suggestions. Run an analysis to generate new ones.
                </div>
            ) : (
                suggestions.map(suggestion => (
                    <Card key={suggestion.id} className="flex flex-col">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <Badge variant={suggestion.type === 'new_entity' ? 'default' : suggestion.type === 'new_relation' ? 'secondary' : 'outline'}>
                                    {suggestion.type.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline" className={suggestion.confidence > 0.8 ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}>
                                    {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                            </div>
                            <CardTitle className="text-lg mt-2">{suggestion.name}</CardTitle>
                            <CardDescription>{suggestion.description || "No description provided."}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 text-sm">
                            {suggestion.type === 'new_relation' && (
                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                    <span>{suggestion.from}</span>
                                    <span>→</span>
                                    <span>{suggestion.to}</span>
                                </div>
                            )}
                            {suggestion.enrichment && (
                                <div className="mt-2 bg-muted/50 p-2 rounded text-xs space-y-1">
                                    <p className="font-semibold text-primary">AI Insights:</p>
                                    <p>{suggestion.enrichment.description}</p>
                                    {suggestion.enrichment.useCases && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {suggestion.enrichment.useCases.map((uc, i) => (
                                                <span key={i} className="px-1 bg-background rounded border">{uc}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <div className="p-4 pt-0 mt-auto flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => rejectMutation.mutate({ id: suggestion.id, reason: "User rejected" })}
                                disabled={rejectMutation.isPending}
                            >
                                <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                            {!suggestion.enrichment && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => enrichMutation.mutate(suggestion.id)}
                                    disabled={enrichMutation.isPending}
                                ><Sparkles className="h-4 w-4" /></Button>
                            )}
                            <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={() => approveMutation.mutate({ id: suggestion.id })}
                                disabled={approveMutation.isPending}
                            >
                                <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}


import { OntologyVisualizer } from "./OntologyVisualizer";
import { RelationBuilder } from "./RelationBuilder";

function SchemaView() {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'list' | 'graph'>('graph');
    const [isRelationBuilderOpen, setIsRelationBuilderOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["ontology", "schema"],
        queryFn: apiClient.getOntologySchema
    });

    const addRelationMutation = useMutation({
        mutationFn: (data: any) => apiClient.addRelationType(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ontology", "schema"] });
            toast.success("Relationship type created");
            setIsRelationBuilderOpen(false);
        },
        onError: () => toast.error("Failed to create relationship")
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const schema = data?.schema;
    if (!schema) return <div>No schema loaded</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 bg-muted p-1 rounded-md">
                    <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                    >
                        List View
                    </Button>
                    <Button
                        variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('graph')}
                    >
                        Graph View
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Entity</Button>
                    <Button size="sm" variant="default" onClick={() => setIsRelationBuilderOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Relation
                    </Button>
                </div>
            </div>

            {viewMode === 'graph' ? (
                <OntologyVisualizer schema={schema} />
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Entity Types</CardTitle>
                            <CardDescription>Defined node types in the graph.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-4">
                                    {Object.entries(schema.entityTypes).map(([name, type]) => (
                                        <div key={name} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                                            <div>
                                                <h4 className="font-semibold flex items-center gap-2">
                                                    {name}
                                                    {type.description && <span className="text-xs font-normal text-muted-foreground">- {type.description}</span>}
                                                </h4>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {Object.keys(type.properties).map(prop => (
                                                        <Badge key={prop} variant="secondary" className="text-[10px]">{prop}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Relationship Types</CardTitle>
                            <CardDescription>Defined edge types between nodes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-4">
                                    {Object.entries(schema.relationTypes).map(([name, type]) => (
                                        <div key={name} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                                            <div>
                                                <h4 className="font-semibold">{name}</h4>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {Array.isArray(type.from) ? type.from.join(', ') : type.from}
                                                    {' → '}
                                                    {Array.isArray(type.to) ? type.to.join(', ') : type.to}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Dialog open={isRelationBuilderOpen} onOpenChange={setIsRelationBuilderOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        {/* Header handled inside component or hidden */}
                    </DialogHeader>
                    <RelationBuilder
                        entityTypes={schema.entityTypes}
                        onSave={(relation) => addRelationMutation.mutate(relation)}
                        onCancel={() => setIsRelationBuilderOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}



function GraphAnalysisView() {
    const queryClient = useQueryClient();
    const [lastResult, setLastResult] = useState<any>(null);

    // Poll for worker status
    const { data: workerStatus } = useQuery({
        queryKey: ["ontology", "worker", "status"],
        queryFn: async () => {
            const res = await apiClient.getOntologyWorkerStatus();
            return res.status;
        },
        refetchInterval: (query) => {
            return query.state.data?.isRunning ? 2000 : 5000;
        }
    });

    const isRunning = workerStatus?.isRunning;

    const analyzeMutation = useMutation({
        mutationFn: () => apiClient.triggerWorker('full', { useLLM: true }),
        onSuccess: () => {
            toast.success("Analysis started in background");
            queryClient.invalidateQueries({ queryKey: ["ontology", "worker", "status"] });
        },
        onError: () => toast.error("Failed to start analysis")
    });

    // Fetch latest result when not running
    useEffect(() => {
        if (!isRunning && !lastResult) {
            // Fetch latest log to get result
            apiClient.get<any>('/api/ontology/worker/log?limit=1&type=full_analysis').then(res => {
                if (res.log && res.log.length > 0) {
                    const latest = res.log[0];
                    if (latest.status === 'completed' && latest.results) {
                        setLastResult({
                            suggestions: [], // Suggestions are separate now
                            analysis: {
                                graphLabels: [],
                                graphRels: []
                            },
                            summary: latest.results.llmAnalysis?.summary || "Analysis completed.",
                            stats: latest.results
                        });
                        // Invalidate suggestions to refresh the other tab
                        queryClient.invalidateQueries({ queryKey: ["ontology", "suggestions"] });
                    }
                }
            });
        }
    }, [isRunning, lastResult, queryClient]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Ontology Analysis</CardTitle>
                    <CardDescription>
                        Analyze the current graph data to discover missing entity types, relationships, and inconsistencies.
                        This runs in the background.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={() => analyzeMutation.mutate()}
                        disabled={isRunning || analyzeMutation.isPending}
                        className="w-full sm:w-auto"
                    >
                        {isRunning || analyzeMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isRunning ? "Analysis in Progress..." : "Starting..."}
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Start Analysis
                            </>
                        )}
                    </Button>
                    {workerStatus?.lastRun?.fullAnalysis && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Last run: {new Date(workerStatus.lastRun.fullAnalysis).toLocaleString()}
                        </p>
                    )}
                </CardContent>
            </Card>

            {(lastResult || isRunning) && (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Analysis Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge variant={isRunning ? "default" : "outline"}>
                                        {isRunning ? "Running" : "Idle"}
                                    </Badge>
                                </div>
                                {lastResult?.stats && (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Gaps Found:</span>
                                            <span className="font-bold">
                                                {(lastResult.stats.gaps?.totalSuggestions || 0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">New Entities:</span>
                                            <span className="font-bold">
                                                {(lastResult.stats.gaps?.newEntityTypes || 0)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    {lastResult?.summary && (
                        <Card className="col-span-full">
                            <CardHeader>
                                <CardTitle>Latest AI Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{lastResult.summary}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
