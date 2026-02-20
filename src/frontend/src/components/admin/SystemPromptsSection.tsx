/**
 * Purpose:
 *   Admin section for viewing and editing system prompt templates used by
 *   the LLM pipeline, organized into category-based tabs.
 *
 * Responsibilities:
 *   - Fetches all prompt templates from GET /api/system/prompts on mount
 *   - Groups prompts by category and renders a tab per category
 *   - Displays prompt cards with name, description, active status badge,
 *     variable badges, and last-modified date
 *   - Opens a full-screen-ish editor dialog for modifying prompt text
 *   - Clickable variable badges in the editor insert template variables
 *     at the cursor position
 *   - Saves edits via PUT /api/system/prompts/:id
 *
 * Key dependencies:
 *   - apiClient: REST calls for prompt CRUD
 *   - sonner (toast): success/error notifications
 *   - PromptTemplate (admin-data): prompt data shape
 *
 * Side effects:
 *   - Network: fetches and updates prompt templates
 *   - DOM: directly queries #prompt-editor-textarea for cursor position
 *     when inserting variables
 *
 * Notes:
 *   - The variable insertion uses getElementById which bypasses React's
 *     controlled component model; a ref would be more idiomatic.
 *   - After saving, the local state is optimistically updated rather than
 *     re-fetching from the server.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, MessageSquare, RefreshCw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PromptTemplate } from '@/data/admin-data';

export function SystemPromptsSection() {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
    const [editText, setEditText] = useState('');

    // Group prompts by category
    const groupedPrompts = useMemo(() => {
        const groups: Record<string, PromptTemplate[]> = {};
        prompts.forEach(p => {
            const cat = p.category || 'General';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        });
        return groups;
    }, [prompts]);

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<any>('/api/system/prompts');
            if (res.templates) {
                setPrompts(res.templates);
            }
        } catch (e) {
            console.error('Error fetching prompts', e);
            toast.error('Failed to load prompts');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (p: PromptTemplate) => {
        setEditingPrompt(p);
        setEditText(p.prompt);
    };

    const saveEdit = async () => {
        if (!editingPrompt) return;
        try {
            const res = await apiClient.put<any>(`/api/system/prompts/${editingPrompt.id}`, { prompt: editText });
            if (res.success) {
                toast.success('Prompt saved');
                setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? { ...p, prompt: editText, lastModified: new Date().toISOString().split('T')[0] } : p));
                setEditingPrompt(null);
            } else {
                toast.error('Failed to save: ' + (res.error || 'Unknown error'));
            }
        } catch (e: any) {
            toast.error('Error saving: ' + e.message);
        }
    };

    const categories = Object.keys(groupedPrompts).sort();

    if (loading && prompts.length === 0) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">System Prompts</h2>
                    <p className="text-sm text-muted-foreground">Manage system prompts and behavior instructions.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchPrompts} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {prompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl text-muted-foreground min-h-[200px]">
                    <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-sm">No system prompts found</p>
                </div>
            ) : (
                <Tabs defaultValue={categories[0] || 'General'} className="w-full">
                    <TabsList className="mb-4">
                        {categories.map(cat => (
                            <TabsTrigger key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {categories.map(cat => (
                        <TabsContent key={cat} value={cat} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {groupedPrompts[cat].map(p => (
                                    <div key={p.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium text-base">{p.name || p.id}</h3>
                                                    <Badge variant={p.isActive ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                                                        {p.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || 'No description'}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => startEdit(p)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <div className="flex flex-wrap gap-1 mt-auto pt-2">
                                            {p.variables?.map(v => (
                                                <Badge key={v} variant="outline" className="text-[10px] font-mono text-muted-foreground bg-muted/50 border-border/50">
                                                    {`{{${v}}}`}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground text-right border-t pt-2 mt-1">
                                            Modified: {p.lastModified ? new Date(p.lastModified).toLocaleDateString() : '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && setEditingPrompt(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Prompt: {editingPrompt?.name || '(unnamed)'}</DialogTitle>
                        <DialogDescription>
                            Variables detected. Click to insert:
                        </DialogDescription>
                        <div className="flex flex-wrap gap-2 my-2">
                            {editingPrompt?.variables?.map(v => (
                                <Badge
                                    key={v}
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-primary/20 transition-colors font-mono text-xs border border-transparent hover:border-primary/50"
                                    onClick={() => {
                                        const textarea = document.getElementById('prompt-editor-textarea') as HTMLTextAreaElement;
                                        if (textarea) {
                                            const start = textarea.selectionStart;
                                            const end = textarea.selectionEnd;
                                            const text = editText;
                                            const newText = text.substring(0, start) + `{{${v}}}` + text.substring(end);
                                            setEditText(newText);
                                            setTimeout(() => {
                                                textarea.focus();
                                                textarea.setSelectionRange(start + v.length + 4, start + v.length + 4);
                                            }, 0);
                                        } else {
                                            setEditText(prev => prev + `{{${v}}}`);
                                        }
                                    }}
                                >
                                    + {`{{${v}}}`}
                                </Badge>
                            ))}
                        </div>
                    </DialogHeader>
                    <div className="flex-1 min-h-[400px] border rounded-md overflow-hidden relative">
                        <Textarea
                            id="prompt-editor-textarea"
                            className="w-full h-full p-4 font-mono text-sm bg-background resize-none focus:outline-none border-0 box-border"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPrompt(null)}>Cancel</Button>
                        <Button onClick={saveEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
