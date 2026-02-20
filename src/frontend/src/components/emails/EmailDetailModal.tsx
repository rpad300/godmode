import { useState } from 'react';
import {
  X, ArrowLeft, Star, Eye, EyeOff, Archive, Trash2, CheckCircle,
  Clock, Sparkles, Loader2, Reply, Forward, ArrowUpRight, ArrowDownLeft,
  ArrowLeftRight, Users, FileText, Brain, Contact, Paperclip,
  AlertTriangle, HelpCircle, Lightbulb, Cpu, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/Dialog';
import { cn, getInitials, resolveAvatarUrl, isValidAvatarUrl } from '../../lib/utils';
import {
  useDeleteEmail, useMarkEmailResponded, useGenerateEmailResponse,
  useStarEmail, useArchiveEmail, useMarkEmailRead, useEmailThread,
  useCategorizeEmail, useGenerateEmailSummary,
} from '../../hooks/useGodMode';
import { CommentsPanel } from '../shared/CommentsPanel';

type Tab = 'content' | 'analysis' | 'entities' | 'contacts';

const directionIcon: Record<string, typeof ArrowUpRight> = {
  inbound: ArrowDownLeft,
  outbound: ArrowUpRight,
  internal: ArrowLeftRight,
};

const sentimentConfig: Record<string, { color: string; emoji: string }> = {
  positive: { color: 'bg-green-500/20 text-green-400', emoji: '😊' },
  neutral: { color: 'bg-white/10 text-slate-300', emoji: '😐' },
  negative: { color: 'bg-red-500/20 text-red-400', emoji: '😟' },
  urgent: { color: 'bg-red-500/20 text-red-400', emoji: '🔥' },
};

interface Props {
  email: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onReply?: (email: Record<string, unknown>) => void;
  onForward?: (email: Record<string, unknown>) => void;
}

export default function EmailDetailModal({ email, open, onClose, onReply, onForward }: Props) {
  const [tab, setTab] = useState<Tab>('content');
  const [draftResponse, setDraftResponse] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);

  const deleteEmail = useDeleteEmail();
  const markResponded = useMarkEmailResponded();
  const generateResponse = useGenerateEmailResponse();
  const starEmail = useStarEmail();
  const archiveEmail = useArchiveEmail();
  const markRead = useMarkEmailRead();
  const categorizeEmail = useCategorizeEmail();
  const summarizeEmail = useGenerateEmailSummary();

  if (!email) return null;

  const threadId = email.thread_id ? String(email.thread_id) : null;
  const threadQuery = useEmailThread(showThread ? threadId : null);
  const threadEmails = (threadQuery.data as Record<string, unknown>)?.emails as Array<Record<string, unknown>> | undefined;

  const subject = String(email.subject || 'No subject');
  const from = String(email.from || email.from_name || email.sender || '—');
  const fromEmail = String(email.from_email || '');
  const to = String(email.to || '');
  const cc = String(email.cc || '');
  const date = email.date ? new Date(String(email.date)).toLocaleString() : '';
  const body = String(email.body || email.body_text || '');
  const isRead = !!email.is_read;
  const isStarred = !!email.is_starred;
  const direction = String(email.direction || '');
  const sentiment = String(email.sentiment || '');
  const intent = String(email.detected_intent || email.ai_category || '');
  const aiSummary = String(email.ai_summary || '');
  const requiresResponse = !!email.requires_response;

  const extracted = (email.extracted_entities || {}) as Record<string, unknown>;
  const facts = (extracted.facts || []) as Array<Record<string, unknown>>;
  const decisions = (extracted.decisions || []) as Array<Record<string, unknown>>;
  const risks = (extracted.risks || []) as Array<Record<string, unknown>>;
  const actionItems = (extracted.action_items || []) as Array<Record<string, unknown>>;
  const questions = (extracted.questions || []) as Array<Record<string, unknown>>;
  const people = (extracted.people || []) as Array<Record<string, unknown>>;
  const technologies = (extracted.technologies || []) as Array<Record<string, unknown>>;
  const relationships = (extracted.relationships || []) as Array<Record<string, unknown>>;
  const keyTopics = (extracted.key_topics || []) as string[];
  const attachments = (email.attachments || []) as Array<Record<string, unknown>>;

  const hasAnalysis = facts.length > 0 || decisions.length > 0 || risks.length > 0 || actionItems.length > 0 || questions.length > 0;
  const hasEntities = technologies.length > 0 || relationships.length > 0 || keyTopics.length > 0;
  const hasPeople = people.length > 0;

  const DirIcon = directionIcon[direction] || null;
  const sentCfg = sentimentConfig[sentiment] || sentimentConfig.neutral;

  const handleDelete = () => {
    deleteEmail.mutate(String(email.id), {
      onSuccess: () => { toast.success('Email deleted'); onClose(); },
    });
  };

  const handleGenerateResponse = () => {
    setDraftResponse(null);
    generateResponse.mutate(String(email.id), {
      onSuccess: (data) => { setDraftResponse(data.response || data.draft || 'No response generated.'); toast.success('AI response generated'); },
      onError: () => toast.error('Failed to generate response'),
    });
  };

  const tabs: { key: Tab; label: string; icon: typeof FileText; count?: number; hidden?: boolean }[] = [
    { key: 'content', label: 'Content', icon: FileText },
    { key: 'analysis', label: 'Analysis', icon: Brain, count: facts.length + actionItems.length + decisions.length + risks.length + questions.length, hidden: !hasAnalysis },
    { key: 'entities', label: 'Entities', icon: Cpu, count: technologies.length + relationships.length + keyTopics.length, hidden: !hasEntities },
    { key: 'contacts', label: 'Contacts', icon: Contact, count: people.length, hidden: !hasPeople },
  ];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">{subject}</DialogTitle>

        {/* Header */}
        <div className="p-5 shrink-0" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.25), rgba(37,99,235,0.08))' }}>
          <div className="flex items-start gap-3">
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors mt-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(37,99,235,0.15)' }}>
              {DirIcon ? <DirIcon className="w-6 h-6 text-blue-400" /> : <FileText className="w-6 h-6 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white leading-tight">{subject}</h2>
              <div className="mt-1.5 space-y-0.5 text-xs text-slate-300">
                <div className="flex gap-2">
                  <span className="text-slate-400 w-8">From</span>
                  <span><strong className="text-white">{from}</strong>{fromEmail && ` <${fromEmail}>`}</span>
                </div>
                {to && <div className="flex gap-2"><span className="text-slate-400 w-8">To</span><span>{to}</span></div>}
                {cc && <div className="flex gap-2"><span className="text-slate-400 w-8">CC</span><span>{cc}</span></div>}
                {date && <div className="flex gap-2"><span className="text-slate-400 w-8">Date</span><span>{date}</span></div>}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {intent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium capitalize">{intent.replace(/_/g, ' ')}</span>}
                {sentiment && <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', sentCfg.color)}>{sentCfg.emoji} {sentiment}</span>}
                {requiresResponse && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Needs Response</span>}
                {direction && DirIcon && <span className="text-[10px] px-2 py-0.5 rounded-full text-slate-300 capitalize flex items-center gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}><DirIcon className="w-3 h-3" /> {direction}</span>}
                {attachments.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full text-slate-300 flex items-center gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}><Paperclip className="w-3 h-3" /> {attachments.length}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); starEmail.mutate({ id: String(email.id), starred: !isStarred }); }} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title={isStarred ? 'Unstar' : 'Star'}>
                <Star className={cn('w-4 h-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400 hover:text-yellow-400')} />
              </button>
              <button onClick={() => markRead.mutate({ id: String(email.id), read: !isRead })} className="p-2 rounded-lg text-slate-400 hover:bg-white/10 transition-colors" title={isRead ? 'Mark unread' : 'Mark read'}>
                {isRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => archiveEmail.mutate(String(email.id), { onSuccess: () => { toast.success('Archived'); onClose(); } })} className="p-2 rounded-lg text-slate-400 hover:bg-white/10 transition-colors" title="Archive">
                <Archive className="w-4 h-4" />
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
          {tab === 'content' && (
            <>
              {aiSummary && (
                <div className="bg-blue-600/5 border-l-[3px] border-gm-interactive-primary rounded-r-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-gm-interactive-primary font-semibold mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> AI Summary
                  </div>
                  <p className="text-sm text-gm-text-primary leading-relaxed">{aiSummary}</p>
                </div>
              )}

              <div className="bg-gm-surface-secondary rounded-xl p-5">
                <pre className="text-sm text-gm-text-primary whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
              </div>

              {attachments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gm-surface-secondary rounded-lg px-3 py-2 border border-gm-border-primary">
                        <Paperclip className="w-4 h-4 text-gm-interactive-primary" />
                        <span className="text-xs text-gm-text-primary">{String(att.filename || att.name || `Attachment ${i + 1}`)}</span>
                        {att.size && <span className="text-[10px] text-gm-text-tertiary">{formatBytes(Number(att.size))}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {threadId && (
                <div className="border-t border-gm-border-primary pt-4">
                  <button onClick={() => setShowThread(!showThread)} className="text-xs text-gm-interactive-primary hover:underline font-medium">
                    {showThread ? 'Hide thread' : 'Show thread'}
                  </button>
                  {showThread && threadQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin text-gm-interactive-primary mt-2" />}
                  {showThread && threadEmails && threadEmails.length > 0 && (
                    <div className="space-y-2 mt-3 ml-4 border-l-2 border-blue-600/20 pl-4">
                      {threadEmails.filter(te => String(te.id) !== String(email.id)).map((te, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gm-text-primary">{String(te.from || te.from_name || te.sender || '—')}</span>
                            {te.date && <span className="text-[10px] text-gm-text-tertiary">{new Date(String(te.date)).toLocaleString()}</span>}
                          </div>
                          <p className="text-xs text-gm-text-tertiary line-clamp-3">{String(te.body || te.body_text || te.ai_summary || '')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gm-border-primary pt-4 flex flex-wrap gap-2">
                {onReply && (
                  <button onClick={() => onReply(email)} className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 transition-colors">
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                )}
                {onForward && (
                  <button onClick={() => onForward(email)} className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover flex items-center gap-1.5 transition-colors border border-gm-border-primary">
                    <Forward className="w-3.5 h-3.5" /> Forward
                  </button>
                )}
                {requiresResponse && (
                  <button onClick={() => markResponded.mutate(String(email.id), { onSuccess: () => toast.success('Marked as responded') })} disabled={markResponded.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-status-success-bg text-gm-status-success text-xs font-medium hover:bg-green-500/20 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Responded
                  </button>
                )}
                <button onClick={handleGenerateResponse} disabled={generateResponse.isPending}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-gm-interactive-primary text-xs font-medium hover:bg-blue-600/20 flex items-center gap-1.5 transition-colors">
                  {generateResponse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generate AI Response
                </button>
                <button
                  onClick={() => categorizeEmail.mutate(String(email.id), { onSuccess: (r) => toast.success(`Categorized: ${r?.category ?? 'done'}`) })}
                  disabled={categorizeEmail.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover flex items-center gap-1.5 transition-colors border border-gm-border-primary"
                >
                  {categorizeEmail.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                  AI Categorize
                </button>
                <button
                  onClick={() => summarizeEmail.mutate(String(email.id), { onSuccess: () => toast.success('Summary generated') })}
                  disabled={summarizeEmail.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover flex items-center gap-1.5 transition-colors border border-gm-border-primary"
                >
                  {summarizeEmail.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                  AI Summarize
                </button>
              </div>

              {draftResponse && (
                <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-2">Draft Response</h4>
                  <pre className="text-sm text-gm-text-primary whitespace-pre-wrap font-sans leading-relaxed">{draftResponse}</pre>
                </div>
              )}
            </>
          )}

          {tab === 'analysis' && (
            <div className="space-y-5">
              {facts.length > 0 && (
                <AnalysisSection title="Facts" icon={Lightbulb} color="text-gm-interactive-primary" count={facts.length}>
                  {facts.map((f, i) => (
                    <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                      <p className="text-xs text-gm-text-primary">{String(f.content)}</p>
                      <div className="flex gap-2 mt-1.5">
                        {f.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary capitalize">{String(f.category)}</span>}
                        {f.confidence && <span className="text-[10px] text-gm-text-tertiary capitalize">{String(f.confidence)} confidence</span>}
                      </div>
                    </div>
                  ))}
                </AnalysisSection>
              )}

              {actionItems.length > 0 && (
                <AnalysisSection title="Action Items" icon={CheckCircle} color="text-gm-status-success" count={actionItems.length}>
                  {actionItems.map((a, i) => (
                    <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                      <p className="text-xs text-gm-text-primary flex items-start gap-1.5">
                        <span className="text-gm-status-success mt-0.5">☐</span> {String(a.task)}
                      </p>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {a.owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">Owner: {String(a.owner)}</span>}
                        {a.deadline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">Due: {String(a.deadline)}</span>}
                        {a.priority && <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize',
                          a.priority === 'critical' || a.priority === 'high' ? 'bg-gm-status-danger-bg text-gm-status-danger' :
                          a.priority === 'medium' ? 'bg-gm-status-warning-bg text-gm-status-warning' : 'bg-gm-surface-secondary text-gm-text-tertiary'
                        )}>{String(a.priority)}</span>}
                      </div>
                    </div>
                  ))}
                </AnalysisSection>
              )}

              {decisions.length > 0 && (
                <AnalysisSection title="Decisions" icon={Lightbulb} color="text-gm-interactive-primary" count={decisions.length}>
                  {decisions.map((d, i) => (
                    <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                      <p className="text-xs text-gm-text-primary">{String(d.content)}</p>
                      <div className="flex gap-2 mt-1.5">
                        {d.owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">By: {String(d.owner)}</span>}
                        {d.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary capitalize">{String(d.status)}</span>}
                      </div>
                    </div>
                  ))}
                </AnalysisSection>
              )}

              {risks.length > 0 && (
                <AnalysisSection title="Risks" icon={AlertTriangle} color="text-gm-status-danger" count={risks.length}>
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
                </AnalysisSection>
              )}

              {questions.length > 0 && (
                <AnalysisSection title="Questions" icon={HelpCircle} color="text-gm-status-warning" count={questions.length}>
                  {questions.map((q, i) => (
                    <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                      <p className="text-xs text-gm-text-primary flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-gm-status-warning shrink-0 mt-0.5" /> {String(q.content)}
                      </p>
                      {q.assignee && <span className="text-[10px] text-gm-text-tertiary ml-5">Assigned to: {String(q.assignee)}</span>}
                    </div>
                  ))}
                </AnalysisSection>
              )}
            </div>
          )}

          {tab === 'entities' && (
            <div className="space-y-5">
              {technologies.length > 0 && (
                <AnalysisSection title="Technologies" icon={Cpu} color="text-gm-interactive-primary" count={technologies.length}>
                  <div className="flex flex-wrap gap-2">
                    {technologies.map((t, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 text-gm-interactive-primary font-medium">
                        {String(t.name)}
                        {t.category && <span className="text-[10px] text-blue-500 ml-1.5 capitalize">({String(t.category)})</span>}
                      </span>
                    ))}
                  </div>
                </AnalysisSection>
              )}

              {keyTopics.length > 0 && (
                <AnalysisSection title="Key Topics" icon={FileText} color="text-gm-text-primary" count={keyTopics.length}>
                  <div className="flex flex-wrap gap-2">
                    {keyTopics.map((t, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary border border-gm-border-primary">{t}</span>
                    ))}
                  </div>
                </AnalysisSection>
              )}

              {relationships.length > 0 && (
                <AnalysisSection title="Relationships" icon={Link2} color="text-gm-interactive-primary" count={relationships.length}>
                  {relationships.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-3">
                      <span className="text-xs font-medium text-gm-text-primary">{String(r.from)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary">{String(r.type || '').replace(/_/g, ' ')}</span>
                      <span className="text-xs font-medium text-gm-text-primary">{String(r.to)}</span>
                    </div>
                  ))}
                </AnalysisSection>
              )}
            </div>
          )}

          {tab === 'contacts' && (
            <div className="space-y-3">
              {people.map((p, i) => {
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
                      {p.email && <p className="text-[10px] text-gm-text-tertiary mt-0.5">{String(p.email)}</p>}
                      {p.phone && <p className="text-[10px] text-gm-text-tertiary">{String(p.phone)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comments */}
          {email?.id && (
            <div className="mt-4">
              <CommentsPanel targetType="email" targetId={email.id} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisSection({ title, icon: Icon, color, count, children }: {
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
