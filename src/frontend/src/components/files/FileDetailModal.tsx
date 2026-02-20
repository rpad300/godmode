import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import {
  FileText, Mic, Mail, MessageSquare, CheckCircle, Clock, AlertCircle,
  RotateCw, Star, Download, Trash2, Share2, Copy,
  Loader2, Eye, Braces, BarChart3, History, Activity, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useDocumentDetail, useDocumentExtraction, useDocumentSummary,
  useDocumentAnalysis, useDocumentVersions, useDocumentActivity,
  useToggleDocumentFavorite, useShareDocument, useReprocessCheck,
  type DocumentItem,
} from '../../hooks/useGodMode';
import { CommentsPanel } from '../shared/CommentsPanel';

const typeIcon: Record<string, typeof FileText> = {
  documents: FileText, document: FileText,
  transcripts: Mic, transcript: Mic,
  emails: Mail, email: Mail,
  conversations: MessageSquare, conversation: MessageSquare,
};

type TabKey = 'preview' | 'entities' | 'analysis' | 'versions' | 'activity' | 'share';

interface Props {
  file: DocumentItem | null;
  open: boolean;
  onClose: () => void;
  onReprocess: (id: string) => void;
  onDelete?: (id: string) => void;
}

const FileDetailModal = ({ file, open, onClose, onReprocess, onDelete }: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>('preview');
  const id = file?.id ?? null;

  const detail = useDocumentDetail(id);
  const extraction = useDocumentExtraction(activeTab === 'entities' ? id : null);
  const summary = useDocumentSummary(id);
  const analysis = useDocumentAnalysis(activeTab === 'analysis' ? id : null);
  const versions = useDocumentVersions(activeTab === 'versions' ? id : null);
  const activity = useDocumentActivity(activeTab === 'activity' ? id : null);
  const reprocessCheck = useReprocessCheck(id);
  const toggleFav = useToggleDocumentFavorite();
  const shareDoc = useShareDocument();

  if (!file) return null;

  const doc = (detail.data as Record<string, unknown>)?.document as Record<string, unknown> | undefined;
  const displayName = file.original_filename || file.filename || '(unnamed)';
  const fileType = (file.type || 'document') as string;
  const Icon = typeIcon[fileType] || FileText;
  const meta = (doc?.metadata ?? file.metadata ?? {}) as Record<string, unknown>;
  const sizeStr = file.size ? `${(Number(file.size) / 1024).toFixed(1)} KB` : '—';
  const isFav = !!(doc?.is_favorite ?? (file as Record<string, unknown>).is_favorite);
  const entities = file.entity_counts;
  const summaryText = (summary.data as Record<string, unknown>)?.summary as string | undefined;

  const tabs: { key: TabKey; label: string; icon: typeof Eye }[] = [
    { key: 'preview', label: 'Preview', icon: Eye },
    { key: 'entities', label: 'Entities', icon: Braces },
    { key: 'analysis', label: 'Analysis', icon: BarChart3 },
    { key: 'versions', label: 'Versions', icon: History },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'share', label: 'Share', icon: Link2 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">File Details: {displayName}</DialogTitle>

        {/* Header */}
        <div className="p-5" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.25), rgba(37,99,235,0.08))' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border border-blue-500/30 flex items-center justify-center" style={{ backgroundColor: 'rgba(37,99,235,0.15)' }}>
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full text-blue-200 capitalize" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>{fileType}</span>
                <span className="text-xs text-slate-300">{sizeStr}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${file.status === 'processed' || file.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  file.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    file.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                  }`}>
                  {file.status === 'processed' || file.status === 'completed' ? <CheckCircle className="w-3 h-3" /> :
                    file.status === 'pending' ? <Clock className="w-3 h-3" /> :
                      file.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                        <AlertCircle className="w-3 h-3" />}
                  {file.status || '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => toggleFav.mutate(file.id)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors" title="Favorite">
                <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
              </button>
              <a href={`/api/documents/${file.id}/download`} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors" title="Download">
                <Download className="w-4 h-4 text-slate-400" />
              </a>
              <button onClick={() => onReprocess(file.id)}
                className={cn('w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors',
                  (reprocessCheck.data as Record<string, unknown>)?.needs_reprocess ? 'ring-2 ring-yellow-500/50' : '')}
                title={(reprocessCheck.data as Record<string, unknown>)?.needs_reprocess ? 'Reprocessing recommended' : 'Reprocess'}>
                <RotateCw className={cn('w-4 h-4', (reprocessCheck.data as Record<string, unknown>)?.needs_reprocess ? 'text-yellow-400' : 'text-slate-400')} />
              </button>
              {onDelete && (
                <button onClick={() => onDelete(file.id)} className="w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--gm-border-primary)] px-5 gap-1 overflow-x-auto" style={{ borderColor: 'var(--gm-border-primary)' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 max-h-[55vh] overflow-y-auto space-y-4 bg-[var(--gm-surface-primary)]">
          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <>
              {summaryText && (
                <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-[var(--gm-interactive-primary)] uppercase tracking-wider mb-2">AI Summary</h3>
                  <p className="text-sm text-[var(--gm-text-primary)] leading-relaxed">{summaryText}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: 'Type', value: fileType },
                  { label: 'Size', value: sizeStr },
                  { label: 'Created', value: file.created_at ? new Date(file.created_at).toLocaleDateString() : '—' },
                  { label: 'Updated', value: file.updated_at ? new Date(file.updated_at).toLocaleDateString() : '—' },
                  ...(meta.pages ? [{ label: 'Pages', value: String(meta.pages) }] : []),
                  ...(meta.language ? [{ label: 'Language', value: String(meta.language) }] : []),
                  ...(meta.author ? [{ label: 'Author', value: String(meta.author) }] : []),
                  ...(meta.word_count ? [{ label: 'Words', value: Number(meta.word_count).toLocaleString() }] : []),
                  ...(meta.source ? [{ label: 'Source', value: String(meta.source) }] : []),
                  ...(meta.speakers ? [{ label: 'Speakers', value: (meta.speakers as string[]).join(', ') }] : []),
                ].map(m => (
                  <div key={m.label} className="bg-[var(--gm-surface-secondary)] rounded-lg p-3">
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{m.label}</span>
                    <p className="text-sm font-medium text-[var(--gm-text-primary)] mt-0.5 truncate">{m.value}</p>
                  </div>
                ))}
              </div>

              {entities && (
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(entities).map(([key, val]) => (
                    <div key={key} className="bg-[var(--gm-surface-secondary)] rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-[var(--gm-text-primary)]">{val ?? 0}</p>
                      <p className="text-[10px] text-[var(--gm-text-tertiary)] uppercase mt-0.5">{key}</p>
                    </div>
                  ))}
                </div>
              )}

              {file.content_preview && (
                <div>
                  <h3 className="text-xs uppercase text-[var(--gm-text-tertiary)] font-semibold mb-2">Content Preview</h3>
                  <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3 text-xs text-[var(--gm-text-secondary)] font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {file.content_preview}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Entities Tab */}
          {activeTab === 'entities' && (
            <>
              {extraction.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gm-interactive-primary" /></div>}
              {extraction.data && (() => {
                const ext = (extraction.data as Record<string, unknown>).extraction as Record<string, unknown> | undefined;
                if (!ext) return <p className="text-sm text-gm-text-tertiary text-center py-6">No extraction data available.</p>;
                const sections = ['facts', 'decisions', 'questions', 'risks', 'actions', 'people', 'participants'] as const;
                return sections.map(section => {
                  const items = ext[section] as Array<Record<string, unknown>> | undefined;
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={section}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-2 capitalize">{section} ({items.length})</h3>
                      <div className="space-y-1.5">
                        {items.map((item, i) => (
                          <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3 text-sm">
                            <p className="text-gm-text-primary">{String(item.text || item.name || item.content || JSON.stringify(item))}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary">{String(item.category)}</span>}
                              {item.confidence != null && <span className="text-[10px] text-gm-text-tertiary">{(Number(item.confidence) * 100).toFixed(0)}% confidence</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
              {!extraction.isLoading && !extraction.data && (
                <p className="text-sm text-gm-text-tertiary text-center py-6">No extraction data available.</p>
              )}
            </>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <>
              {analysis.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gm-interactive-primary" /></div>}
              {(() => {
                const analyses = ((analysis.data as Record<string, unknown>)?.analyses ?? []) as Array<Record<string, unknown>>;
                if (!analysis.isLoading && analyses.length === 0) return <p className="text-sm text-gm-text-tertiary text-center py-6">No analysis history yet.</p>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gm-border-primary text-left">
                          <th className="pb-2 pr-3 text-gm-text-tertiary font-medium">Date</th>
                          <th className="pb-2 pr-3 text-gm-text-tertiary font-medium">Provider</th>
                          <th className="pb-2 pr-3 text-gm-text-tertiary font-medium">Model</th>
                          <th className="pb-2 pr-3 text-gm-text-tertiary font-medium">Tokens</th>
                          <th className="pb-2 pr-3 text-gm-text-tertiary font-medium">Cost</th>
                          <th className="pb-2 pr-3 text-gm-text-tertiary font-medium">Latency</th>
                          <th className="pb-2 text-gm-text-tertiary font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.map((a, i) => (
                          <tr key={i} className="border-b border-[var(--gm-border-primary)]">
                            <td className="py-2 pr-3 text-gm-text-primary">{a.created_at ? new Date(String(a.created_at)).toLocaleString() : '—'}</td>
                            <td className="py-2 pr-3 text-gm-text-primary">{String(a.provider || '—')}</td>
                            <td className="py-2 pr-3 text-gm-text-primary">{String(a.model || '—')}</td>
                            <td className="py-2 pr-3 text-gm-text-primary">{a.tokens != null ? Number(a.tokens).toLocaleString() : '—'}</td>
                            <td className="py-2 pr-3 text-gm-text-primary">{a.cost != null ? `$${Number(a.cost).toFixed(4)}` : '—'}</td>
                            <td className="py-2 pr-3 text-gm-text-primary">{a.latency_ms != null ? `${Number(a.latency_ms)}ms` : '—'}</td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.status === 'completed' ? 'bg-gm-status-success-bg text-gm-status-success' : a.status === 'failed' ? 'bg-gm-status-danger-bg text-gm-status-danger' : 'bg-gm-status-warning-bg text-gm-status-warning'}`}>
                                {String(a.status || '—')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}

          {/* Versions Tab */}
          {activeTab === 'versions' && (
            <>
              {versions.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gm-interactive-primary" /></div>}
              {(() => {
                const vList = ((versions.data as Record<string, unknown>)?.versions ?? []) as Array<Record<string, unknown>>;
                if (!versions.isLoading && vList.length === 0) return <p className="text-sm text-gm-text-tertiary text-center py-6">No version history.</p>;
                return (
                  <div className="space-y-2">
                    {vList.map((v, i) => (
                      <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-xs font-bold text-gm-interactive-primary">
                          v{String(v.version ?? i + 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gm-text-primary">{String(v.change_notes || v.summary || 'Version update')}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {v.created_at && <span className="text-[10px] text-gm-text-tertiary">{new Date(String(v.created_at)).toLocaleString()}</span>}
                            {v.file_size != null && <span className="text-[10px] text-gm-text-tertiary">{(Number(v.file_size) / 1024).toFixed(1)} KB</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <>
              {activity.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gm-interactive-primary" /></div>}
              {(() => {
                const aList = ((activity.data as Record<string, unknown>)?.activities ?? []) as Array<Record<string, unknown>>;
                if (!activity.isLoading && aList.length === 0) return <p className="text-sm text-gm-text-tertiary text-center py-6">No activity yet.</p>;
                return (
                  <div className="space-y-1.5">
                    {aList.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-[var(--gm-border-primary)] last:border-0">
                        <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Activity className="w-3 h-3 text-gm-interactive-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gm-text-primary">
                            {a.user && <span className="font-medium">{String(a.user)} </span>}
                            {String(a.action || a.type || 'activity')}
                          </p>
                          {a.created_at && <span className="text-[10px] text-gm-text-tertiary">{new Date(String(a.created_at)).toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {/* Share Tab */}
          {activeTab === 'share' && (
            <ShareTabContent fileId={file.id} shareMutation={shareDoc} />
          )}

          {/* Comments */}
          <div className="mt-4">
            <CommentsPanel targetType="document" targetId={file.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function ShareTabContent({ fileId, shareMutation }: { fileId: string; shareMutation: ReturnType<typeof useShareDocument> }) {
  const [expires, setExpires] = useState('7d');
  const [maxViews, setMaxViews] = useState(100);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = () => {
    shareMutation.mutate({ id: fileId, expires, maxViews }, {
      onSuccess: (data) => {
        const url = (data as Record<string, unknown>).url as string;
        setShareUrl(url);
        toast.success('Share link created');
      },
      onError: () => toast.error('Failed to create share link'),
    });
  };

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--gm-text-tertiary)]">Generate a shareable link for this document.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--gm-text-tertiary)] block mb-1">Expires</label>
          <select value={expires} onChange={e => setExpires(e.target.value)} className="w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--gm-text-primary)]">
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="never">Never</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--gm-text-tertiary)] block mb-1">Max views</label>
          <input type="number" value={maxViews} onChange={e => setMaxViews(Number(e.target.value))} min={1} className="w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--gm-text-primary)]" />
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={shareMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-sm font-medium hover:bg-[var(--gm-interactive-primary-hover)] disabled:opacity-50 transition-colors"
      >
        {shareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        Generate Share Link
      </button>

      {shareUrl && (
        <div className="bg-[var(--gm-surface-secondary)] rounded-lg p-3 flex items-center gap-2">
          <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent text-xs text-[var(--gm-text-primary)] outline-none truncate" />
          <button onClick={copyLink} className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center">
            <Copy className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
          </button>
        </div>
      )}
    </div>
  );
}

export default FileDetailModal;
