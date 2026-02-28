import { useState, useMemo } from 'react';
import {
  MessageSquare, Loader2, Search, Upload, RotateCw,
  Users, Hash, Clock, CheckCircle, AlertCircle,
  Sparkles, BarChart3, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useConversations, useConversationsStats, useDeleteConversation,
  useReembedConversation,
} from '../hooks/useGodMode';
import { cn } from '../lib/utils';
import ConversationDetail from '../components/conversations/ConversationDetail';
import ConversationImportModal from '../components/conversations/ConversationImportModal';
import { ErrorState } from '../components/shared/ErrorState';

const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp', slack: 'Slack', teams: 'Teams',
  discord: 'Discord', zoom: 'Zoom', telegram: 'Telegram',
};

const sourceColors: Record<string, string> = {
  whatsapp: 'bg-green-500/10 text-green-500',
  slack: 'bg-purple-500/10 text-purple-500',
  teams: 'bg-blue-500/10 text-blue-500',
  discord: 'bg-indigo-500/10 text-indigo-500',
  zoom: 'bg-sky-500/10 text-sky-500',
  telegram: 'bg-cyan-500/10 text-cyan-500',
};

export default function ConversationsPage() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'embedded' | 'not_embedded' | 'ai_processed'>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const conversations = useConversations({ search: search || undefined, sourceApp: sourceFilter || undefined });
  const statsQuery = useConversationsStats();
  const deleteConversation = useDeleteConversation();
  const reembed = useReembedConversation();

  const convList = useMemo(() => {
    const raw = (conversations.data as Record<string, unknown>)?.conversations ?? [];
    return (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
  }, [conversations.data]);

  const filtered = useMemo(() => {
    return convList.filter(c => {
      if (statusFilter === 'embedded' && !c.is_embedded && !c.isEmbedded) return false;
      if (statusFilter === 'not_embedded' && (c.is_embedded || c.isEmbedded)) return false;
      if (statusFilter === 'ai_processed' && !c.aiProcessedAt) return false;
      return true;
    });
  }, [convList, statusFilter]);

  const stats = statsQuery.data as Record<string, unknown> | undefined;
  const bySource = (stats?.bySource || {}) as Record<string, number>;

  // Detail view (replaces list)
  if (selectedId) {
    return (
      <>
        <ConversationDetail
          conversationId={selectedId}
          onBack={() => setSelectedId(null)}
        />
        <ConversationImportModal open={showImport} onClose={() => setShowImport(false)} />
      </>
    );
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    deleteConversation.mutate(id, {
      onSuccess: () => toast.success('Conversation deleted'),
      onError: () => toast.error('Failed to delete'),
    });
  };

  const handleReembed = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    reembed.mutate(id, {
      onSuccess: () => toast.success('Re-embedding started'),
      onError: () => toast.error('Failed to re-embed'),
    });
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? convList.length, color: 'text-gm-text-primary', icon: MessageSquare },
    { label: 'Messages', value: stats?.totalMessages ?? 0, color: 'text-gm-interactive-primary', icon: Hash },
    { label: 'Sources', value: Object.keys(bySource).length, color: 'text-purple-500', icon: BarChart3 },
    { label: 'Embedded', value: filtered.filter(c => c.is_embedded || c.isEmbedded).length, color: 'text-gm-status-success', icon: CheckCircle },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gm-text-primary">Conversations</h1>
          <p className="text-xs text-gm-text-tertiary mt-0.5">{filtered.length} conversation{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowImport(true)}
          className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-sm font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-2 transition-colors">
          <Upload className="w-4 h-4" /> Import Conversation
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {statCards.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-600/20 transition-colors">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center',
                  s.label === 'Total' ? 'bg-gm-surface-secondary' :
                  s.label === 'Messages' ? 'bg-blue-600/10' :
                  s.label === 'Sources' ? 'bg-purple-500/10' : 'bg-green-500/10')}>
                  <Icon className={cn('w-4.5 h-4.5', s.color)} />
                </div>
                <div>
                  <span className={cn('text-xl font-bold', s.color)}>{String(s.value)}</span>
                  <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Source breakdown */}
      {Object.keys(bySource).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(bySource).map(([source, count]) => (
            <button key={source} onClick={() => setSourceFilter(sourceFilter === source ? '' : source)}
              className={cn('text-[10px] px-3 py-1.5 rounded-lg font-medium border transition-colors flex items-center gap-1.5',
                sourceFilter === source
                  ? (sourceColors[source] || 'bg-blue-600/10 text-gm-interactive-primary') + ' border-current/20'
                  : 'bg-gm-surface-secondary text-gm-text-tertiary border-gm-border-primary hover:text-gm-text-primary')}>
              {sourceLabels[source] || source} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
        </div>

        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
          <option value="">All sources</option>
          {Object.entries(sourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {[
          { key: 'embedded', label: 'Embedded', icon: CheckCircle, activeColor: 'bg-gm-status-success-bg border-green-500/30 text-gm-status-success' },
          { key: 'not_embedded', label: 'Not Embedded', icon: AlertCircle, activeColor: 'bg-gm-status-warning-bg border-yellow-500/30 text-gm-status-warning' },
          { key: 'ai_processed', label: 'AI Processed', icon: Sparkles, activeColor: 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' },
        ].map(f => {
          const FIcon = f.icon;
          const isActive = statusFilter === f.key;
          return (
            <button key={f.key} onClick={() => setStatusFilter(isActive ? '' : f.key as typeof statusFilter)}
              className={cn('px-2.5 py-2 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5',
                isActive ? f.activeColor : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
              <FIcon className="w-3.5 h-3.5" /> {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {conversations.error ? (
        <ErrorState message="Failed to load conversations." onRetry={() => conversations.refetch()} />
      ) : conversations.isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-8 text-center text-gm-text-tertiary">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-500" />
          {convList.length === 0 ? "No conversations imported yet. Click 'Import Conversation' to get started." : 'No conversations match your filters.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((conv) => {
            const participantCount = (conv.participants as unknown[])?.length ?? conv.participant_count ?? 0;
            const messageCount = conv.messageCount ?? conv.message_count ?? conv.messages_count ?? 0;
            const isEmbedded = !!(conv.is_embedded || conv.isEmbedded);
            const hasAi = !!conv.aiProcessedAt;
            const sourceApp = String(conv.sourceApp || conv.source_app || '');
            const summary = String(conv.summary || '');
            const dateRange = conv.dateRange as Record<string, unknown> | undefined;

            return (
              <div key={String(conv.id)}
                className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-3.5 hover:border-blue-600/30 transition-all cursor-pointer group"
                onClick={() => setSelectedId(String(conv.id))}>
                <div className="flex items-center gap-3">
                  {/* Source icon */}
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    sourceColors[sourceApp] || 'bg-blue-600/10 text-gm-interactive-primary')}>
                    <MessageSquare className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gm-text-primary truncate group-hover:text-gm-interactive-primary transition-colors">
                      {String(conv.title || conv.name || 'Untitled Conversation')}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {sourceApp && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                          sourceColors[sourceApp] || 'bg-gm-surface-secondary text-gm-text-tertiary')}>
                          {sourceLabels[sourceApp] || sourceApp}
                        </span>
                      )}
                      <span className="text-[10px] text-gm-text-tertiary flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {String(participantCount)}
                      </span>
                      <span className="text-[10px] text-gm-text-tertiary flex items-center gap-0.5">
                        <Hash className="w-3 h-3" /> {String(messageCount)} msgs
                      </span>
                      {dateRange?.first && (
                        <span className="text-[10px] text-gm-text-tertiary flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> {String(dateRange.first).split('T')[0]}
                        </span>
                      )}
                    </div>
                    {summary && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{summary.substring(0, 120)}</p>
                    )}
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEmbedded ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-success-bg text-gm-status-success font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Embedded
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Not embedded
                      </span>
                    )}
                    {hasAi && (
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <button onClick={(e) => handleReembed(e, String(conv.id))}
                      className="w-7 h-7 rounded-lg hover:bg-gm-surface-hover flex items-center justify-center text-gm-text-tertiary hover:text-gm-interactive-primary transition-colors opacity-0 group-hover:opacity-100"
                      title="Re-embed">
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => handleDelete(e, String(conv.id))}
                      className="w-7 h-7 rounded-lg hover:bg-gm-status-danger-bg flex items-center justify-center text-gm-text-tertiary hover:text-gm-status-danger transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      <ConversationImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  );
}
