import { useState, useEffect } from 'react';
import {
  Star, Eye, EyeOff, Archive, Trash2, CheckCircle,
  Clock, Sparkles, Loader2, Reply, Forward, ArrowUpRight, ArrowDownLeft,
  ArrowLeftRight, Users, FileText, Brain, Contact, Paperclip,
  AlertTriangle, HelpCircle, Lightbulb, Cpu, Link2, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, getInitials, resolveAvatarUrl, isValidAvatarUrl } from '../../lib/utils';
import {
  useDeleteEmail, useMarkEmailResponded, useGenerateEmailResponse,
  useStarEmail, useArchiveEmail, useMarkEmailRead, useEmailThread,
  useCategorizeEmail, useGenerateEmailSummary,
} from '../../hooks/useGodMode';
import { CommentsPanel } from '../shared/CommentsPanel';

type Tab = 'content' | 'analysis' | 'entities' | 'contacts';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';

const directionIcon: Record<string, typeof ArrowUpRight> = {
  inbound: ArrowDownLeft, outbound: ArrowUpRight, internal: ArrowLeftRight,
};

const sentimentConfig: Record<string, { color: string; emoji: string }> = {
  positive: { color: 'bg-green-500/20 text-green-400', emoji: '😊' },
  neutral: { color: 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]', emoji: '😐' },
  negative: { color: 'bg-red-500/20 text-red-400', emoji: '😟' },
  urgent: { color: 'bg-red-500/20 text-red-400', emoji: '🔥' },
};

interface Props {
  email: Record<string, unknown>;
  onBack: () => void;
  onReply?: (email: Record<string, unknown>) => void;
  onForward?: (email: Record<string, unknown>) => void;
}

export default function EmailDetail({ email, onBack, onReply, onForward }: Props) {
  const [tab, setTab] = useState<Tab>('content');
  const [draftResponse, setDraftResponse] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteEmail = useDeleteEmail();
  const markResponded = useMarkEmailResponded();
  const generateResponse = useGenerateEmailResponse();
  const starEmail = useStarEmail();
  const archiveEmail = useArchiveEmail();
  const markRead = useMarkEmailRead();
  const categorizeEmail = useCategorizeEmail();
  const summarizeEmail = useGenerateEmailSummary();

  const threadId = email.thread_id ? String(email.thread_id) : null;
  const threadQuery = useEmailThread(showThread ? threadId : null);
  const threadEmails = (threadQuery.data as Record<string, unknown>)?.emails as Array<Record<string, unknown>> | undefined;

  // Reset state on email change
  useEffect(() => {
    setTab('content');
    setDraftResponse(null);
    setShowThread(false);
    setConfirmDelete(false);
  }, [email.id]);

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
      onSuccess: () => { toast.success('Email deleted'); onBack(); },
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
    <div className="p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Emails
      </button>

      <div className={CARD}>
        {/* Header */}
        <div className="p-5 rounded-t-xl" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.15), rgba(37,99,235,0.04))' }}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(37,99,235,0.15)' }}>
              {DirIcon ? <DirIcon className="w-6 h-6 text-blue-400" /> : <FileText className="w-6 h-6 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-[var(--gm-text-primary)] leading-tight">{subject}</h2>
              <div className="mt-1.5 space-y-0.5 text-xs text-[var(--gm-text-tertiary)]">
                <div className="flex gap-2"><span className="text-[var(--gm-text-tertiary)] w-8">From</span><span><strong className="text-[var(--gm-text-primary)]">{from}</strong>{fromEmail && ` <${fromEmail}>`}</span></div>
                {to && <div className="flex gap-2"><span className="text-[var(--gm-text-tertiary)] w-8">To</span><span>{to}</span></div>}
                {cc && <div className="flex gap-2"><span className="text-[var(--gm-text-tertiary)] w-8">CC</span><span>{cc}</span></div>}
                {date && <div className="flex gap-2"><span className="text-[var(--gm-text-tertiary)] w-8">Date</span><span>{date}</span></div>}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {intent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium capitalize">{intent.replace(/_/g, ' ')}</span>}
                {sentiment && <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', sentCfg.color)}>{sentCfg.emoji} {sentiment}</span>}
                {requiresResponse && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Needs Response</span>}
                {direction && DirIcon && <span className="text-[10px] px-2 py-0.5 rounded-full text-[var(--gm-text-tertiary)] capitalize flex items-center gap-1 bg-[var(--gm-bg-tertiary)]"><DirIcon className="w-3 h-3" /> {direction}</span>}
                {attachments.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full text-[var(--gm-text-tertiary)] flex items-center gap-1 bg-[var(--gm-bg-tertiary)]"><Paperclip className="w-3 h-3" /> {attachments.length}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => starEmail.mutate({ id: String(email.id), starred: !isStarred })} className="p-2 rounded-lg hover:bg-[var(--gm-surface-hover)] transition-colors" title={isStarred ? 'Unstar' : 'Star'}>
                <Star className={cn('w-4 h-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--gm-text-tertiary)] hover:text-yellow-400')} />
              </button>
              <button onClick={() => markRead.mutate({ id: String(email.id), read: !isRead })} className="p-2 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors" title={isRead ? 'Mark unread' : 'Mark read'}>
                {isRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => archiveEmail.mutate(String(email.id), { onSuccess: () => { toast.success('Archived'); onBack(); } })} className="p-2 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors" title="Archive">
                <Archive className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 border-b border-[var(--gm-border-primary)]">
          {tabs.filter(t => !t.hidden).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                  tab === t.key ? 'border-[var(--gm-accent-primary)] text-[var(--gm-accent-primary)]' : 'border-transparent text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]')}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
                {t.count !== undefined && t.count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">{t.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-4">
          {tab === 'content' && (
            <>
              {aiSummary && (
                <div className="bg-blue-600/5 border-l-[3px] border-[var(--gm-accent-primary)] rounded-r-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--gm-accent-primary)] font-semibold mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Summary</div>
                  <p className="text-sm text-[var(--gm-text-primary)] leading-relaxed">{aiSummary}</p>
                </div>
              )}

              <div className="bg-[var(--gm-bg-tertiary)] rounded-xl p-5">
                <pre className="text-sm text-[var(--gm-text-primary)] whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
              </div>

              {attachments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-2 border border-[var(--gm-border-primary)]">
                        <Paperclip className="w-4 h-4 text-[var(--gm-accent-primary)]" />
                        <span className="text-xs text-[var(--gm-text-primary)]">{String(att.filename || att.name || `Attachment ${i + 1}`)}</span>
                        {att.size && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{formatBytes(Number(att.size))}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {threadId && (
                <div className="border-t border-[var(--gm-border-primary)] pt-4">
                  <button onClick={() => setShowThread(!showThread)} className="text-xs text-[var(--gm-accent-primary)] hover:underline font-medium">
                    {showThread ? 'Hide thread' : 'Show thread'}
                  </button>
                  {showThread && threadQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-accent-primary)] mt-2" />}
                  {showThread && threadEmails && threadEmails.length > 0 && (
                    <div className="space-y-2 mt-3 ml-4 border-l-2 border-blue-600/20 pl-4">
                      {threadEmails.filter(te => String(te.id) !== String(email.id)).map((te, i) => (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-[var(--gm-text-primary)]">{String(te.from || te.from_name || te.sender || '—')}</span>
                            {te.date && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{new Date(String(te.date)).toLocaleString()}</span>}
                          </div>
                          <p className="text-xs text-[var(--gm-text-tertiary)] line-clamp-3">{String(te.body || te.body_text || te.ai_summary || '')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-[var(--gm-border-primary)] pt-4 flex flex-wrap gap-2">
                {onReply && <button onClick={() => onReply(email)} className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-xs font-medium hover:bg-[var(--gm-interactive-primary-hover)] flex items-center gap-1.5 transition-colors"><Reply className="w-3.5 h-3.5" /> Reply</button>}
                {onForward && <button onClick={() => onForward(email)} className={BTN_SECONDARY}><Forward className="w-3.5 h-3.5" /> Forward</button>}
                {requiresResponse && <button onClick={() => markResponded.mutate(String(email.id), { onSuccess: () => toast.success('Marked as responded') })} disabled={markResponded.isPending} className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Mark Responded</button>}
                <button onClick={handleGenerateResponse} disabled={generateResponse.isPending} className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-[var(--gm-accent-primary)] text-xs font-medium hover:bg-blue-600/20 flex items-center gap-1.5 transition-colors">
                  {generateResponse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate AI Response
                </button>
                <button onClick={() => categorizeEmail.mutate(String(email.id), { onSuccess: (r) => toast.success(`Categorized: ${r?.category ?? 'done'}`) })} disabled={categorizeEmail.isPending} className={BTN_SECONDARY}>
                  {categorizeEmail.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} AI Categorize
                </button>
                <button onClick={() => summarizeEmail.mutate(String(email.id), { onSuccess: () => toast.success('Summary generated') })} disabled={summarizeEmail.isPending} className={BTN_SECONDARY}>
                  {summarizeEmail.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} AI Summarize
                </button>
              </div>

              {draftResponse && (
                <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">Draft Response</h4>
                  <pre className="text-sm text-[var(--gm-text-primary)] whitespace-pre-wrap font-sans leading-relaxed">{draftResponse}</pre>
                </div>
              )}
            </>
          )}

          {tab === 'analysis' && (
            <div className="space-y-5">
              {facts.length > 0 && <AnalysisSection title="Facts" icon={Lightbulb} color="text-[var(--gm-accent-primary)]" count={facts.length}>{facts.map((f, i) => <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3"><p className="text-xs text-[var(--gm-text-primary)]">{String(f.content)}</p><div className="flex gap-2 mt-1.5">{f.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] capitalize">{String(f.category)}</span>}{f.confidence && <span className="text-[10px] text-[var(--gm-text-tertiary)] capitalize">{String(f.confidence)} confidence</span>}</div></div>)}</AnalysisSection>}
              {actionItems.length > 0 && <AnalysisSection title="Action Items" icon={CheckCircle} color="text-green-500" count={actionItems.length}>{actionItems.map((a, i) => <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3"><p className="text-xs text-[var(--gm-text-primary)] flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#x2610;</span> {String(a.task)}</p><div className="flex gap-2 mt-1.5 flex-wrap">{a.owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">Owner: {String(a.owner)}</span>}{a.deadline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">Due: {String(a.deadline)}</span>}{a.priority && <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize', a.priority === 'critical' || a.priority === 'high' ? 'bg-red-500/10 text-red-500' : a.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]')}>{String(a.priority)}</span>}</div></div>)}</AnalysisSection>}
              {decisions.length > 0 && <AnalysisSection title="Decisions" icon={Lightbulb} color="text-[var(--gm-accent-primary)]" count={decisions.length}>{decisions.map((d, i) => <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3"><p className="text-xs text-[var(--gm-text-primary)]">{String(d.content)}</p><div className="flex gap-2 mt-1.5">{d.owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">By: {String(d.owner)}</span>}{d.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-[var(--gm-accent-primary)] capitalize">{String(d.status)}</span>}</div></div>)}</AnalysisSection>}
              {risks.length > 0 && <AnalysisSection title="Risks" icon={AlertTriangle} color="text-red-500" count={risks.length}>{risks.map((r, i) => <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3"><p className="text-xs text-[var(--gm-text-primary)]">{String(r.content)}</p><div className="flex gap-2 mt-1.5">{r.impact && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Impact: {String(r.impact)}</span>}{r.likelihood && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">Likelihood: {String(r.likelihood)}</span>}</div>{r.mitigation && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1.5 italic">Mitigation: {String(r.mitigation)}</p>}</div>)}</AnalysisSection>}
              {questions.length > 0 && <AnalysisSection title="Questions" icon={HelpCircle} color="text-yellow-500" count={questions.length}>{questions.map((q, i) => <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3"><p className="text-xs text-[var(--gm-text-primary)] flex items-start gap-1.5"><HelpCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" /> {String(q.content)}</p>{q.assignee && <span className="text-[10px] text-[var(--gm-text-tertiary)] ml-5">Assigned to: {String(q.assignee)}</span>}</div>)}</AnalysisSection>}
            </div>
          )}

          {tab === 'entities' && (
            <div className="space-y-5">
              {technologies.length > 0 && <AnalysisSection title="Technologies" icon={Cpu} color="text-[var(--gm-accent-primary)]" count={technologies.length}><div className="flex flex-wrap gap-2">{technologies.map((t, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 text-[var(--gm-accent-primary)] font-medium">{String(t.name)}{t.category && <span className="text-[10px] text-blue-500 ml-1.5 capitalize">({String(t.category)})</span>}</span>)}</div></AnalysisSection>}
              {keyTopics.length > 0 && <AnalysisSection title="Key Topics" icon={FileText} color="text-[var(--gm-text-primary)]" count={keyTopics.length}><div className="flex flex-wrap gap-2">{keyTopics.map((t, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-primary)] border border-[var(--gm-border-primary)]">{t}</span>)}</div></AnalysisSection>}
              {relationships.length > 0 && <AnalysisSection title="Relationships" icon={Link2} color="text-[var(--gm-accent-primary)]" count={relationships.length}>{relationships.map((r, i) => <div key={i} className="flex items-center gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-3"><span className="text-xs font-medium text-[var(--gm-text-primary)]">{String(r.from)}</span><span className="text-[10px] px-2 py-0.5 rounded bg-blue-600/10 text-[var(--gm-accent-primary)]">{String(r.type || '').replace(/_/g, ' ')}</span><span className="text-xs font-medium text-[var(--gm-text-primary)]">{String(r.to)}</span></div>)}</AnalysisSection>}
            </div>
          )}

          {tab === 'contacts' && (
            <div className="space-y-3">
              {people.map((p, i) => {
                const name = String(p.name || 'Unknown');
                const avatarSrc = resolveAvatarUrl(p as any);
                return (
                  <div key={i} className="flex items-center gap-3 bg-[var(--gm-surface-hover)] rounded-xl p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-sm font-bold text-[var(--gm-accent-primary)] shrink-0 overflow-hidden">
                      {isValidAvatarUrl(avatarSrc) ? <img src={avatarSrc} alt={name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : null}
                      <span className={isValidAvatarUrl(avatarSrc) ? 'hidden' : ''}>{getInitials(name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--gm-text-primary)]">{name}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {p.role && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{String(p.role)}</span>}
                        {p.organization && <span className="text-[10px] text-[var(--gm-text-tertiary)]">at {String(p.organization)}</span>}
                      </div>
                      {p.email && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5">{String(p.email)}</p>}
                      {p.phone && <p className="text-[10px] text-[var(--gm-text-tertiary)]">{String(p.phone)}</p>}
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

        {/* Danger Zone */}
        <div className="px-5 py-4 border-t border-[var(--gm-border-primary)]">
          <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
            <p className="text-xs font-semibold text-red-500 mb-1">Danger Zone</p>
            <p className="text-xs text-[var(--gm-text-tertiary)] mb-3">Deleting this email will permanently remove all associated data.</p>
            {!confirmDelete ? (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete Email
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button className={BTN_DANGER} disabled={deleteEmail.isPending} onClick={handleDelete}>
                  {deleteEmail.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Confirm Delete
                </button>
                <button className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisSection({ title, icon: Icon, color, count, children }: {
  title: string; icon: typeof FileText; color: string; count: number; children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className={cn('text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2', color)}>
        <Icon className="w-4 h-4" /> {title}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] ml-auto">{count}</span>
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
