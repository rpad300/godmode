import { useState, useEffect } from 'react';
import {
  FileText, Mic, Mail, MessageSquare, CheckCircle, Clock, AlertCircle,
  RotateCw, Star, Download, Trash2, Share2, Copy,
  Loader2, Eye, Braces, BarChart3, History, Activity, Link2, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useDocumentDetail, useDocumentExtraction, useDocumentSummary,
  useDocumentAnalysis, useDocumentVersions, useDocumentActivity,
  useToggleDocumentFavorite, useShareDocument, useReprocessCheck,
  useUpdateDocument, useProjects, useSprints, useActions,
  type DocumentItem,
} from '../../hooks/useGodMode';
import { CommentsPanel } from '../shared/CommentsPanel';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';

const typeIcon: Record<string, typeof FileText> = {
  documents: FileText, document: FileText,
  transcripts: Mic, transcript: Mic,
  emails: Mail, email: Mail,
  conversations: MessageSquare, conversation: MessageSquare,
};

type TabKey = 'preview' | 'entities' | 'analysis' | 'versions' | 'activity' | 'share';

function SprintProjectPanel({ doc, file, allProjects, allSprints, allActions, updateDoc }: {
  doc: Record<string, unknown> | undefined;
  file: DocumentItem;
  allProjects: any[];
  allSprints: any[];
  allActions: any[];
  updateDoc: ReturnType<typeof useUpdateDocument>;
}) {
  const currentProjectId = (doc?.project_id ?? (file as any).project_id) ? String(doc?.project_id ?? (file as any).project_id) : '';
  const currentSprintId = (doc?.sprint_id ?? (file as any).sprint_id) ? String(doc?.sprint_id ?? (file as any).sprint_id) : '';
  const currentActionId = (doc?.action_id ?? (file as any).action_id) ? String(doc?.action_id ?? (file as any).action_id) : '';

  const sprints = currentProjectId
    ? allSprints.filter((s: any) => s.project_id === currentProjectId)
    : allSprints;

  const actions = currentSprintId
    ? allActions.filter((a: any) => (a.sprintId || a.sprint_id) === currentSprintId)
    : allActions;

  const save = (field: string, value: string) => {
    const payload: Record<string, string | null> = { id: file.id, [field]: value || null };
    if (field === 'project_id') {
      payload.sprint_id = null;
      payload.action_id = null;
    } else if (field === 'sprint_id') {
      payload.action_id = null;
    }
    updateDoc.mutate(
      payload as any,
      { onSuccess: () => toast.success('Updated'), onError: () => toast.error('Update failed') },
    );
  };

  const SEL = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--gm-text-primary)]';

  return (
    <div className="bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-[var(--gm-text-tertiary)] uppercase tracking-wider">Association</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider block mb-1">Project</label>
          <select value={currentProjectId} onChange={e => save('project_id', e.target.value)} className={SEL}>
            <option value="">No project</option>
            {allProjects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider block mb-1">Sprint</label>
          <select value={currentSprintId} onChange={e => save('sprint_id', e.target.value)} className={SEL}>
            <option value="">No sprint</option>
            {sprints.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.status === 'completed' ? ' (done)' : s.status === 'active' ? ' (active)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider block mb-1">Task</label>
          <select value={currentActionId} onChange={e => save('action_id', e.target.value)} className={SEL}>
            <option value="">No task</option>
            {actions.map((a: any) => (
              <option key={a.id} value={a.id}>{a.title || a.task || '(untitled)'}</option>
            ))}
          </select>
        </div>
      </div>
      {updateDoc.isPending && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)]">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving...
        </div>
      )}
    </div>
  );
}

interface Props {
  file: DocumentItem;
  onBack: () => void;
  onReprocess: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function FileDetail({ file, onBack, onReprocess, onDelete }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('preview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = file.id;

  const detail = useDocumentDetail(id);
  const extraction = useDocumentExtraction(activeTab === 'entities' ? id : null);
  const summary = useDocumentSummary(id);
  const analysis = useDocumentAnalysis(activeTab === 'analysis' ? id : null);
  const versions = useDocumentVersions(activeTab === 'versions' ? id : null);
  const activity = useDocumentActivity(activeTab === 'activity' ? id : null);
  const reprocessCheck = useReprocessCheck(id);
  const toggleFav = useToggleDocumentFavorite();
  const shareDoc = useShareDocument();
  const updateDoc = useUpdateDocument();
  const { data: allProjects = [] } = useProjects();
  const { data: sprintsData } = useSprints();
  const { data: actionsData } = useActions();
  const allSprints: any[] = (sprintsData as any)?.sprints ?? (Array.isArray(sprintsData) ? sprintsData : []);
  const allActions: any[] = Array.isArray(actionsData) ? actionsData : [];

  useEffect(() => {
    setActiveTab('preview');
    setConfirmDelete(false);
  }, [file.id]);

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
    <div className="p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Files
      </button>

      <div className={CARD}>
        {/* Header */}
        <div className="p-5 rounded-t-xl" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.15), rgba(37,99,235,0.04))' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border border-blue-500/30 flex items-center justify-center" style={{ backgroundColor: 'rgba(37,99,235,0.15)' }}>
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-[var(--gm-text-primary)] truncate">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] capitalize">{fileType}</span>
                <span className="text-xs text-[var(--gm-text-tertiary)]">{sizeStr}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${file.status === 'processed' || file.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  file.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    file.status === 'processing' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                  {file.status === 'processed' || file.status === 'completed' ? <CheckCircle className="w-3 h-3" /> :
                    file.status === 'pending' ? <Clock className="w-3 h-3" /> :
                      file.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
                  {file.status || '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => toggleFav.mutate(file.id)} className="w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center transition-colors" title="Favorite">
                <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--gm-text-tertiary)]'}`} />
              </button>
              <a href={`/api/documents/${file.id}/download`} className="w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center transition-colors" title="Download">
                <Download className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
              </a>
              <button onClick={() => onReprocess(file.id)}
                className={cn('w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center transition-colors',
                  (reprocessCheck.data as Record<string, unknown>)?.needs_reprocess ? 'ring-2 ring-yellow-500/50' : '')}
                title={(reprocessCheck.data as Record<string, unknown>)?.needs_reprocess ? 'Reprocessing recommended' : 'Reprocess'}>
                <RotateCw className={cn('w-4 h-4', (reprocessCheck.data as Record<string, unknown>)?.needs_reprocess ? 'text-yellow-400' : 'text-[var(--gm-text-tertiary)]')} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--gm-border-primary)] px-5 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.key
                ? 'border-[var(--gm-accent-primary)] text-[var(--gm-accent-primary)]'
                : 'border-transparent text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-4">
          {activeTab === 'preview' && (
            <>
              {summaryText && (
                <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-[var(--gm-accent-primary)] uppercase tracking-wider mb-2">AI Summary</h3>
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
                  <div key={m.label} className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3">
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{m.label}</span>
                    <p className="text-sm font-medium text-[var(--gm-text-primary)] mt-0.5 truncate">{m.value}</p>
                  </div>
                ))}
              </div>

              <SprintProjectPanel
                doc={doc}
                file={file}
                allProjects={allProjects}
                allSprints={allSprints}
                allActions={allActions}
                updateDoc={updateDoc}
              />

              {entities && (
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(entities).map(([key, val]) => (
                    <div key={key} className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-[var(--gm-text-primary)]">{val ?? 0}</p>
                      <p className="text-[10px] text-[var(--gm-text-tertiary)] uppercase mt-0.5">{key}</p>
                    </div>
                  ))}
                </div>
              )}
              {file.content_preview && (
                <div>
                  <h3 className="text-xs uppercase text-[var(--gm-text-tertiary)] font-semibold mb-2">Content Preview</h3>
                  <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3 text-xs text-[var(--gm-text-secondary)] font-mono leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {file.content_preview}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'entities' && (
            <>
              {extraction.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>}
              {extraction.data && (() => {
                const ext = (extraction.data as Record<string, unknown>).extraction as Record<string, unknown> | undefined;
                if (!ext) return <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-6">No extraction data available.</p>;
                const sections = ['facts', 'decisions', 'questions', 'risks', 'actions', 'people', 'participants'] as const;
                return sections.map(section => {
                  const items = ext[section] as Array<Record<string, unknown>> | undefined;
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={section}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--gm-text-tertiary)] mb-2 capitalize">{section} ({items.length})</h3>
                      <div className="space-y-1.5">
                        {items.map((item, i) => (
                          <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3 text-sm">
                            <p className="text-[var(--gm-text-primary)]">{String(item.text || item.name || item.content || JSON.stringify(item))}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-[var(--gm-accent-primary)]">{String(item.category)}</span>}
                              {item.confidence != null && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{(Number(item.confidence) * 100).toFixed(0)}% confidence</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
              {!extraction.isLoading && !extraction.data && <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-6">No extraction data available.</p>}
            </>
          )}

          {activeTab === 'analysis' && (
            <>
              {analysis.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>}
              {(() => {
                const analyses = ((analysis.data as Record<string, unknown>)?.analyses ?? []) as Array<Record<string, unknown>>;
                if (!analysis.isLoading && analyses.length === 0) return <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-6">No analysis history yet.</p>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--gm-border-primary)] text-left">
                          <th className="pb-2 pr-3 text-[var(--gm-text-tertiary)] font-medium">Date</th>
                          <th className="pb-2 pr-3 text-[var(--gm-text-tertiary)] font-medium">Provider</th>
                          <th className="pb-2 pr-3 text-[var(--gm-text-tertiary)] font-medium">Model</th>
                          <th className="pb-2 pr-3 text-[var(--gm-text-tertiary)] font-medium">Tokens</th>
                          <th className="pb-2 pr-3 text-[var(--gm-text-tertiary)] font-medium">Cost</th>
                          <th className="pb-2 pr-3 text-[var(--gm-text-tertiary)] font-medium">Latency</th>
                          <th className="pb-2 text-[var(--gm-text-tertiary)] font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.map((a, i) => (
                          <tr key={i} className="border-b border-[var(--gm-border-primary)]">
                            <td className="py-2 pr-3 text-[var(--gm-text-primary)]">{a.created_at ? new Date(String(a.created_at)).toLocaleString() : '—'}</td>
                            <td className="py-2 pr-3 text-[var(--gm-text-primary)]">{String(a.provider || '—')}</td>
                            <td className="py-2 pr-3 text-[var(--gm-text-primary)]">{String(a.model || '—')}</td>
                            <td className="py-2 pr-3 text-[var(--gm-text-primary)]">{a.tokens != null ? Number(a.tokens).toLocaleString() : '—'}</td>
                            <td className="py-2 pr-3 text-[var(--gm-text-primary)]">{a.cost != null ? `$${Number(a.cost).toFixed(4)}` : '—'}</td>
                            <td className="py-2 pr-3 text-[var(--gm-text-primary)]">{a.latency_ms != null ? `${Number(a.latency_ms)}ms` : '—'}</td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.status === 'completed' ? 'bg-green-500/10 text-green-500' : a.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
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

          {activeTab === 'versions' && (
            <>
              {versions.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>}
              {(() => {
                const vList = ((versions.data as Record<string, unknown>)?.versions ?? []) as Array<Record<string, unknown>>;
                if (!versions.isLoading && vList.length === 0) return <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-6">No version history.</p>;
                return (
                  <div className="space-y-2">
                    {vList.map((v, i) => (
                      <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-xs font-bold text-[var(--gm-accent-primary)]">v{String(v.version ?? i + 1)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--gm-text-primary)]">{String(v.change_notes || v.summary || 'Version update')}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {v.created_at && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{new Date(String(v.created_at)).toLocaleString()}</span>}
                            {v.file_size != null && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{(Number(v.file_size) / 1024).toFixed(1)} KB</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === 'activity' && (
            <>
              {activity.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>}
              {(() => {
                const aList = ((activity.data as Record<string, unknown>)?.activities ?? []) as Array<Record<string, unknown>>;
                if (!activity.isLoading && aList.length === 0) return <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-6">No activity yet.</p>;
                return (
                  <div className="space-y-1.5">
                    {aList.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-[var(--gm-border-primary)] last:border-0">
                        <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Activity className="w-3 h-3 text-[var(--gm-accent-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--gm-text-primary)]">
                            {a.user && <span className="font-medium">{String(a.user)} </span>}
                            {String(a.action || a.type || 'activity')}
                          </p>
                          {a.created_at && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{new Date(String(a.created_at)).toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === 'share' && <ShareTabContent key={file.id} fileId={file.id} shareMutation={shareDoc} />}

          {/* Comments */}
          <div className="mt-4">
            <CommentsPanel targetType="document" targetId={file.id} />
          </div>
        </div>

        {/* Danger Zone */}
        {onDelete && (
          <div className="px-5 py-4 border-t border-[var(--gm-border-primary)]">
            <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
              <p className="text-xs font-semibold text-red-500 mb-1">Danger Zone</p>
              <p className="text-xs text-[var(--gm-text-tertiary)] mb-3">Deleting this document will permanently remove all associated data.</p>
              {!confirmDelete ? (
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete Document
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button className={BTN_DANGER} onClick={() => onDelete(file.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> Confirm Delete
                  </button>
                  <button className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShareTabContent({ fileId, shareMutation }: { fileId: string; shareMutation: ReturnType<typeof useShareDocument> }) {
  const [expires, setExpires] = useState('7d');
  const [maxViews, setMaxViews] = useState(100);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = () => {
    shareMutation.mutate({ id: fileId, expires, maxViews }, {
      onSuccess: (data) => { setShareUrl((data as Record<string, unknown>).url as string); toast.success('Share link created'); },
      onError: () => toast.error('Failed to create share link'),
    });
  };

  const copyLink = () => {
    if (shareUrl) { navigator.clipboard.writeText(shareUrl); toast.success('Link copied to clipboard'); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--gm-text-tertiary)]">Generate a shareable link for this document.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--gm-text-tertiary)] block mb-1">Expires</label>
          <select value={expires} onChange={e => setExpires(e.target.value)} className="w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--gm-text-primary)]">
            <option value="1h">1 hour</option><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="never">Never</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--gm-text-tertiary)] block mb-1">Max views</label>
          <input type="number" value={maxViews} onChange={e => setMaxViews(Number(e.target.value))} min={1} className="w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--gm-text-primary)]" />
        </div>
      </div>
      <button onClick={handleShare} disabled={shareMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-sm font-medium hover:bg-[var(--gm-interactive-primary-hover)] disabled:opacity-50 transition-colors">
        {shareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Generate Share Link
      </button>
      {shareUrl && (
        <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3 flex items-center gap-2">
          <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent text-xs text-[var(--gm-text-primary)] outline-none truncate" />
          <button onClick={copyLink} className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center">
            <Copy className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
          </button>
        </div>
      )}
    </div>
  );
}
