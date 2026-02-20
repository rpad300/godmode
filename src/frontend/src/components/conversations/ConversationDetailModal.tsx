import { useState, useMemo } from 'react';
import {
  MessageSquare, Users, Hash, Clock, RotateCw, Trash2, Loader2,
  ArrowLeft, Brain, Sparkles, FileText, Contact, Lightbulb,
  AlertTriangle, HelpCircle, CheckCircle, Cpu, Link2, BookOpen,
  Edit3, Save, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/Dialog';
import { cn, getInitials, resolveAvatarUrl, isValidAvatarUrl } from '../../lib/utils';
import {
  useConversationDetail, useReembedConversation, useDeleteConversation,
  useUpdateConversation, useSummarizeConversation,
} from '../../hooks/useGodMode';
import { CommentsPanel } from '../shared/CommentsPanel';

type Tab = 'messages' | 'summary' | 'knowledge' | 'entities' | 'people';

const sourceColors: Record<string, string> = {
  whatsapp: 'bg-green-500/10 text-green-500 border-green-500/20',
  slack: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  teams: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  discord: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  zoom: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  telegram: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp', slack: 'Slack', teams: 'Teams',
  discord: 'Discord', zoom: 'Zoom', telegram: 'Telegram',
};

interface Props {
  conversationId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ConversationDetailModal({ conversationId, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('messages');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [messageSearch, setMessageSearch] = useState('');

  const detail = useConversationDetail(open ? conversationId : null);
  const deleteConv = useDeleteConversation();
  const reembed = useReembedConversation();
  const updateConv = useUpdateConversation();
  const summarize = useSummarizeConversation();

  const conversation = (detail.data as Record<string, unknown>)?.conversation as Record<string, unknown> | undefined;

  const title = String(conversation?.title || conversation?.name || 'Untitled Conversation');
  const summary = String(conversation?.summary || '');
  const sourceApp = String(conversation?.sourceApp || conversation?.source_app || '');
  const channelName = String(conversation?.channelName || conversation?.channel_name || '');
  const workspaceName = String(conversation?.workspaceName || conversation?.workspace_name || '');
  const participants = (conversation?.participants || []) as string[];
  const messageCount = Number(conversation?.messageCount || conversation?.message_count || 0);
  const messages = (conversation?.messages || []) as Array<Record<string, unknown>>;
  const dateRange = conversation?.dateRange as Record<string, unknown> | undefined;
  const importedAt = conversation?.importedAt ? new Date(String(conversation.importedAt)).toLocaleString() : '';
  const isEmbedded = !!(conversation?.is_embedded || conversation?.isEmbedded);
  const aiProcessedAt = conversation?.aiProcessedAt ? new Date(String(conversation.aiProcessedAt)).toLocaleString() : '';

  const extraction = (conversation?.extraction_result || conversation?.extractedEntities || {}) as Record<string, unknown>;
  const facts = (extraction.facts || []) as Array<Record<string, unknown>>;
  const decisions = (extraction.decisions || []) as Array<Record<string, unknown>>;
  const risks = (extraction.risks || []) as Array<Record<string, unknown>>;
  const actionItems = (extraction.actionItems || []) as Array<Record<string, unknown>>;
  const questions = (extraction.questions || []) as Array<Record<string, unknown>>;
  const entities = (extraction.entities || conversation?.extractedEntities || []) as Array<Record<string, unknown>>;
  const relationships = (extraction.relationships || conversation?.extractedRelationships || []) as Array<Record<string, unknown>>;
  const extractedParticipants = (extraction.participants || []) as Array<Record<string, unknown>>;

  const hasKnowledge = facts.length + decisions.length + risks.length + actionItems.length + questions.length > 0;
  const hasEntities = entities.length + relationships.length > 0;
  const hasPeople = extractedParticipants.length > 0 || participants.length > 0;

  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages;
    const q = messageSearch.toLowerCase();
    return messages.filter(m =>
      String(m.text || m.content || m.body || '').toLowerCase().includes(q) ||
      String(m.sender || m.author || '').toLowerCase().includes(q)
    );
  }, [messages, messageSearch]);

  const participantColors = useMemo(() => {
    const colors = [
      'bg-blue-500/20 text-blue-500', 'bg-green-500/20 text-green-500', 'bg-purple-500/20 text-purple-500',
      'bg-orange-500/20 text-orange-500', 'bg-pink-500/20 text-pink-500', 'bg-cyan-500/20 text-cyan-500',
      'bg-yellow-500/20 text-yellow-500', 'bg-red-500/20 text-red-500',
    ];
    const map: Record<string, string> = {};
    const uniqueNames = [...new Set(messages.map(m => String(m.sender || m.author || 'Unknown')))];
    uniqueNames.forEach((name, i) => { map[name] = colors[i % colors.length]; });
    return map;
  }, [messages]);

  const handleDelete = () => {
    if (!conversationId || !confirm('Delete this conversation?')) return;
    deleteConv.mutate(conversationId, {
      onSuccess: () => { toast.success('Conversation deleted'); onClose(); },
      onError: () => toast.error('Failed to delete'),
    });
  };

  const handleReembed = () => {
    if (!conversationId) return;
    reembed.mutate(conversationId, {
      onSuccess: () => toast.success('Re-embedding started'),
      onError: () => toast.error('Failed to re-embed'),
    });
  };

  const handleSaveTitle = () => {
    if (!conversationId || !titleDraft.trim()) return;
    updateConv.mutate({ id: conversationId, data: { title: titleDraft.trim() } }, {
      onSuccess: () => { toast.success('Title updated'); setEditingTitle(false); },
      onError: () => toast.error('Failed to update title'),
    });
  };

  const handleSummarize = () => {
    if (!conversationId) return;
    summarize.mutate(conversationId, {
      onSuccess: () => toast.success('Summary generated'),
      onError: () => toast.error('Failed to generate summary'),
    });
  };

  const tabs: { key: Tab; label: string; icon: typeof FileText; count?: number; hidden?: boolean }[] = [
    { key: 'messages', label: 'Messages', icon: MessageSquare, count: messageCount },
    { key: 'summary', label: 'Summary', icon: Brain },
    { key: 'knowledge', label: 'Knowledge', icon: BookOpen, count: facts.length + decisions.length + actionItems.length + risks.length + questions.length, hidden: !hasKnowledge },
    { key: 'entities', label: 'Entities', icon: Cpu, count: entities.length + relationships.length, hidden: !hasEntities },
    { key: 'people', label: 'People', icon: Contact, count: hasPeople ? (extractedParticipants.length || participants.length) : 0, hidden: !hasPeople },
  ];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {detail.isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        )}

        {!detail.isLoading && !conversation && (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Conversation not found.</div>
        )}

        {!detail.isLoading && conversation && (
          <>
            {/* Header */}
            <div className="p-5 shrink-0" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.25), rgba(37,99,235,0.08))' }}>
              <div className="flex items-start gap-3">
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors mt-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border',
                  sourceColors[sourceApp] || 'border-blue-500/30')} style={{ backgroundColor: sourceColors[sourceApp] ? undefined : 'rgba(37,99,235,0.15)' }}>
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveTitle()} />
                      <button onClick={handleSaveTitle} className="text-green-400 hover:text-green-300"><Save className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTitle(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white leading-tight truncate">{title}</h2>
                      <button onClick={() => { setTitleDraft(title); setEditingTitle(true); }} className="text-slate-400 hover:text-slate-200 transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {sourceApp && (
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border',
                        sourceColors[sourceApp] || 'bg-white/10 text-slate-300 border-white/20')}>
                        {sourceLabels[sourceApp] || sourceApp}
                      </span>
                    )}
                    {channelName && <span className="text-[10px] px-2 py-0.5 rounded-full text-slate-300" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>#{channelName}</span>}
                    {workspaceName && <span className="text-[10px] text-slate-300">{workspaceName}</span>}
                    <span className="text-[10px] text-slate-300 flex items-center gap-0.5"><Users className="w-3 h-3" /> {participants.length}</span>
                    <span className="text-[10px] text-slate-300 flex items-center gap-0.5"><Hash className="w-3 h-3" /> {messageCount} msgs</span>
                    {dateRange?.first && <span className="text-[10px] text-slate-300 flex items-center gap-0.5"><Clock className="w-3 h-3" /> {String(dateRange.first).split('T')[0]}</span>}
                    {isEmbedded ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Embedded</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">Not embedded</span>
                    )}
                    {aiProcessedAt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> AI processed</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={handleReembed} disabled={reembed.isPending} className="p-2 rounded-lg text-slate-400 hover:bg-white/10 transition-colors" title="Re-embed">
                    {reembed.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                  </button>
                  <button onClick={handleDelete} className="p-2 rounded-lg text-slate-400 hover:bg-red-500/20 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 border-b border-[var(--gm-border-primary)] shrink-0" style={{ borderColor: 'var(--gm-border-primary)' }}>
              {tabs.filter(t => !t.hidden).map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                      tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200')}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                    {t.count !== undefined && t.count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{t.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[var(--gm-surface-primary)]" style={{ backgroundColor: 'var(--gm-surface-primary)' }}>
              {tab === 'messages' && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <input value={messageSearch} onChange={e => setMessageSearch(e.target.value)} placeholder="Search messages..."
                      className="flex-1 bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                    <span className="text-[10px] text-gm-text-tertiary">{filteredMessages.length}/{messages.length}</span>
                  </div>
                  {filteredMessages.length === 0 ? (
                    <p className="text-sm text-gm-text-tertiary text-center py-8">No messages {messageSearch ? 'matching your search' : 'available'}.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredMessages.map((msg, i) => {
                        const sender = String(msg.sender || msg.author || 'Unknown');
                        const initial = sender.charAt(0).toUpperCase();
                        const text = String(msg.text || msg.content || msg.body || '');
                        const time = msg.timestamp ? new Date(String(msg.timestamp)).toLocaleString() : '';
                        const colorClass = participantColors[sender] || 'bg-blue-600/20 text-gm-interactive-primary';

                        return (
                          <div key={i} className="flex gap-3 group">
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold', colorClass)}>
                              {initial}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gm-text-primary">{sender}</span>
                                {time && <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>}
                              </div>
                              <p className="text-xs text-gm-text-secondary mt-0.5 whitespace-pre-wrap leading-relaxed">{text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {tab === 'summary' && (
                <div className="space-y-4">
                  {summary ? (
                    <div className="bg-blue-600/5 border-l-[3px] border-gm-interactive-primary rounded-r-lg p-4">
                      <div className="text-[10px] uppercase tracking-wider text-gm-interactive-primary font-semibold mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> AI Summary
                      </div>
                      <p className="text-sm text-gm-text-primary leading-relaxed">{summary}</p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                      <p className="text-sm text-gm-text-tertiary mb-3">No AI summary generated yet.</p>
                      <button onClick={handleSummarize} disabled={summarize.isPending}
                        className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 mx-auto disabled:opacity-50 transition-colors">
                        {summarize.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Generate Summary
                      </button>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3">
                    <MetadataCard label="Participants" icon={Users}>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {participants.map((p, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-primary border border-gm-border-primary">{p}</span>
                        ))}
                      </div>
                    </MetadataCard>
                    <MetadataCard label="Statistics" icon={Hash}>
                      <div className="space-y-1 mt-1 text-xs text-gm-text-secondary">
                        <p>{messageCount} messages</p>
                        <p>{participants.length} participants</p>
                        {dateRange?.first && <p>From: {String(dateRange.first).split('T')[0]}</p>}
                        {dateRange?.last && <p>To: {String(dateRange.last).split('T')[0]}</p>}
                      </div>
                    </MetadataCard>
                    <MetadataCard label="Source" icon={MessageSquare}>
                      <div className="space-y-1 mt-1 text-xs text-gm-text-secondary">
                        {sourceApp && <p>Platform: {sourceLabels[sourceApp] || sourceApp}</p>}
                        {channelName && <p>Channel: #{channelName}</p>}
                        {workspaceName && <p>Workspace: {workspaceName}</p>}
                        {importedAt && <p>Imported: {importedAt}</p>}
                      </div>
                    </MetadataCard>
                    <MetadataCard label="AI Processing" icon={Sparkles}>
                      <div className="space-y-1 mt-1 text-xs text-gm-text-secondary">
                        <p>Status: {aiProcessedAt ? 'Processed' : 'Not processed'}</p>
                        {aiProcessedAt && <p>At: {aiProcessedAt}</p>}
                        <p>Embedded: {isEmbedded ? 'Yes' : 'No'}</p>
                      </div>
                    </MetadataCard>
                  </div>
                </div>
              )}

              {tab === 'knowledge' && (
                <div className="space-y-5">
                  {facts.length > 0 && (
                    <KnowledgeSection title="Facts" icon={Lightbulb} color="text-gm-interactive-primary" count={facts.length}>
                      {facts.map((f, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <p className="text-xs text-gm-text-primary">{String(f.content)}</p>
                          <div className="flex gap-2 mt-1.5">
                            {f.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary capitalize">{String(f.category)}</span>}
                            {f.confidence && <span className="text-[10px] text-gm-text-tertiary">{Math.round(Number(f.confidence) * 100)}% confidence</span>}
                          </div>
                        </div>
                      ))}
                    </KnowledgeSection>
                  )}

                  {actionItems.length > 0 && (
                    <KnowledgeSection title="Action Items" icon={CheckCircle} color="text-gm-status-success" count={actionItems.length}>
                      {actionItems.map((a, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <p className="text-xs text-gm-text-primary flex items-start gap-1.5">
                            <span className="text-gm-status-success mt-0.5">☐</span> {String(a.task)}
                          </p>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {a.owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">Owner: {String(a.owner)}</span>}
                            {a.deadline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">Due: {String(a.deadline)}</span>}
                            {a.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary capitalize">{String(a.status)}</span>}
                          </div>
                        </div>
                      ))}
                    </KnowledgeSection>
                  )}

                  {decisions.length > 0 && (
                    <KnowledgeSection title="Decisions" icon={Lightbulb} color="text-blue-500" count={decisions.length}>
                      {decisions.map((d, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <p className="text-xs text-gm-text-primary">{String(d.content)}</p>
                          <div className="flex gap-2 mt-1.5">
                            {d.owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">By: {String(d.owner)}</span>}
                            {d.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 capitalize">{String(d.status)}</span>}
                          </div>
                        </div>
                      ))}
                    </KnowledgeSection>
                  )}

                  {risks.length > 0 && (
                    <KnowledgeSection title="Risks" icon={AlertTriangle} color="text-gm-status-danger" count={risks.length}>
                      {risks.map((r, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <p className="text-xs text-gm-text-primary">{String(r.content)}</p>
                          <div className="flex gap-2 mt-1.5">
                            {r.impact && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-status-danger-bg text-gm-status-danger">Impact: {String(r.impact)}</span>}
                            {r.likelihood && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-status-warning-bg text-gm-status-warning">Likelihood: {String(r.likelihood)}</span>}
                          </div>
                          {r.mitigation && <p className="text-[10px] text-gm-text-tertiary mt-1.5 italic">Mitigation: {String(r.mitigation)}</p>}
                        </div>
                      ))}
                    </KnowledgeSection>
                  )}

                  {questions.length > 0 && (
                    <KnowledgeSection title="Questions" icon={HelpCircle} color="text-gm-status-warning" count={questions.length}>
                      {questions.map((q, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <p className="text-xs text-gm-text-primary flex items-start gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-gm-status-warning shrink-0 mt-0.5" /> {String(q.content)}
                          </p>
                          <div className="flex gap-2 mt-1.5">
                            {q.assigned_to && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">Assigned: {String(q.assigned_to)}</span>}
                            {q.priority && <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize',
                              q.priority === 'high' ? 'bg-gm-status-danger-bg text-gm-status-danger' :
                              q.priority === 'medium' ? 'bg-gm-status-warning-bg text-gm-status-warning' :
                              'bg-gm-surface-secondary text-gm-text-tertiary'
                            )}>{String(q.priority)}</span>}
                            {q.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary capitalize">{String(q.status)}</span>}
                          </div>
                        </div>
                      ))}
                    </KnowledgeSection>
                  )}
                </div>
              )}

              {tab === 'entities' && (
                <div className="space-y-5">
                  {entities.length > 0 && (
                    <KnowledgeSection title="Entities" icon={Cpu} color="text-gm-interactive-primary" count={entities.length}>
                      <div className="flex flex-wrap gap-2">
                        {entities.map((e, i) => (
                          <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 text-gm-interactive-primary font-medium border border-blue-600/20">
                            {String(e.name || e.text || e.label || JSON.stringify(e))}
                            {e.type && <span className="text-[10px] text-blue-500 ml-1.5 capitalize">({String(e.type)})</span>}
                          </span>
                        ))}
                      </div>
                    </KnowledgeSection>
                  )}

                  {relationships.length > 0 && (
                    <KnowledgeSection title="Relationships" icon={Link2} color="text-purple-500" count={relationships.length}>
                      {relationships.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <span className="text-xs font-medium text-gm-text-primary">{String(r.from || r.source)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-500">{String(r.type || r.label || '').replace(/_/g, ' ')}</span>
                          <span className="text-xs font-medium text-gm-text-primary">{String(r.to || r.target)}</span>
                        </div>
                      ))}
                    </KnowledgeSection>
                  )}
                </div>
              )}

              {tab === 'people' && (
                <div className="space-y-3">
                  {extractedParticipants.length > 0 ? (
                    extractedParticipants.map((p, i) => {
                      const name = String(p.name || 'Unknown');
                      const avatarSrc = resolveAvatarUrl(p as any);
                      return (
                        <div key={i} className="flex items-center gap-3 bg-[var(--gm-surface-hover)] rounded-xl p-4">
                          <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-sm font-bold text-gm-interactive-primary shrink-0 overflow-hidden">
                            {isValidAvatarUrl(avatarSrc) ? (
                              <img src={avatarSrc} alt={name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); }} />
                            ) : null}
                            <span className={isValidAvatarUrl(avatarSrc) ? 'hidden' : ''}>{getInitials(name)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gm-text-primary">{name}</p>
                            <div className="flex flex-wrap gap-2 mt-0.5">
                              {p.role && <span className="text-[10px] text-gm-text-tertiary">{String(p.role)}</span>}
                              {p.organization && <span className="text-[10px] text-gm-text-tertiary">at {String(p.organization)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    participants.map((name, i) => {
                      const msgCount = messages.filter(m => String(m.sender || m.author) === name).length;
                      return (
                        <div key={i} className="flex items-center gap-3 bg-[var(--gm-surface-hover)] rounded-xl p-4">
                          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                            participantColors[name] || 'bg-blue-600/20 text-gm-interactive-primary')}>
                            {getInitials(name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gm-text-primary">{name}</p>
                            <p className="text-[10px] text-gm-text-tertiary">{msgCount} message{msgCount !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Comments */}
        {conversationId && (
          <div className="mt-4">
            <CommentsPanel targetType="conversation" targetId={conversationId} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetadataCard({ label, icon: Icon, children }: { label: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="bg-gm-surface-secondary rounded-xl p-4 border border-gm-border-primary">
      <h4 className="text-[10px] uppercase tracking-wider text-gm-text-tertiary font-semibold flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </h4>
      {children}
    </div>
  );
}

function KnowledgeSection({ title, icon: Icon, color, count, children }: {
  title: string; icon: typeof FileText; color: string; count: number; children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className={cn('text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2', color)}>
        <Icon className="w-4 h-4" /> {title}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary ml-auto">{count}</span>
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
