import { useState, useMemo } from 'react';
import {
  Mail, Loader2, Search, Clock, Star, Plus,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Sparkles, BarChart3, Eye, EyeOff, Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmails, useEmailStats, useStarEmail, useMarkEmailRead,
} from '../hooks/useGodMode';
import { EmailsSkeleton } from '../components/shared/PageSkeleton';
import { cn } from '../lib/utils';
import EmailDetail from '../components/emails/EmailDetail';
import EmailComposeModal from '../components/emails/EmailComposeModal';
import { ErrorState } from '../components/shared/ErrorState';

const sentimentColor: Record<string, string> = {
  positive: 'bg-gm-status-success-bg text-gm-status-success',
  neutral: 'bg-gm-surface-secondary text-gm-text-tertiary',
  negative: 'bg-gm-status-danger-bg text-gm-status-danger',
  urgent: 'bg-gm-status-danger-bg text-gm-status-danger',
};

const directionIcon: Record<string, typeof ArrowUpRight> = {
  inbound: ArrowDownLeft,
  outbound: ArrowUpRight,
  internal: ArrowLeftRight,
};

type ComposeMode = { open: boolean; mode: 'compose' | 'reply' | 'forward'; replyTo: Record<string, unknown> | null };

export default function EmailsPage() {
  const [filter, setFilter] = useState<'' | 'needs_response' | 'starred' | 'unread'>('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Record<string, unknown> | null>(null);
  const [compose, setCompose] = useState<ComposeMode>({ open: false, mode: 'compose', replyTo: null });

  const emails = useEmails({ requires_response: filter === 'needs_response' ? true : undefined });
  const emailStats = useEmailStats();
  const starEmail = useStarEmail();
  const markRead = useMarkEmailRead();

  const emailList = useMemo(() => {
    const raw = (emails.data ?? []) as Array<Record<string, unknown>>;
    if (Array.isArray(raw)) return raw;
    const obj = raw as Record<string, unknown>;
    return (obj.emails ?? []) as Array<Record<string, unknown>>;
  }, [emails.data]);

  const filtered = useMemo(() => {
    return emailList.filter(e => {
      if (search && !JSON.stringify(e).toLowerCase().includes(search.toLowerCase())) return false;
      if (directionFilter && String(e.direction || '') !== directionFilter) return false;
      if (filter === 'starred' && !e.is_starred) return false;
      if (filter === 'unread' && e.is_read) return false;
      return true;
    });
  }, [emailList, search, directionFilter, filter]);

  const stats = emailStats.data as Record<string, unknown> | undefined;

  // Detail view (replaces list)
  if (selectedEmail) {
    return (
      <>
        <EmailDetail
          email={selectedEmail}
          onBack={() => setSelectedEmail(null)}
          onReply={(email) => { setSelectedEmail(null); setCompose({ open: true, mode: 'reply', replyTo: email }); }}
          onForward={(email) => { setSelectedEmail(null); setCompose({ open: true, mode: 'forward', replyTo: email }); }}
        />
        <EmailComposeModal open={compose.open} onClose={() => setCompose({ open: false, mode: 'compose', replyTo: null })} mode={compose.mode} replyTo={compose.replyTo} />
      </>
    );
  }

  const handleStar = (e: React.MouseEvent, id: string, currentlyStarred: boolean) => {
    e.stopPropagation();
    starEmail.mutate({ id, starred: !currentlyStarred });
  };

  const handleSelectEmail = (email: Record<string, unknown>) => {
    setSelectedEmail(email);
    if (!email.is_read) markRead.mutate({ id: String(email.id), read: true });
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, color: 'text-gm-text-primary', icon: Mail },
    { label: 'Unread', value: stats?.unread ?? 0, color: 'text-gm-interactive-primary', icon: Eye },
    { label: 'Starred', value: stats?.starred ?? 0, color: 'text-yellow-500', icon: Star },
    { label: 'Needs Response', value: stats?.needing_response ?? 0, color: 'text-gm-status-warning', icon: Clock },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gm-text-primary">Emails</h1>
          <p className="text-xs text-gm-text-tertiary mt-0.5">{filtered.length} email{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setCompose({ open: true, mode: 'compose', replyTo: null })}
          className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-sm font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Add Email
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-600/20 transition-colors cursor-pointer"
                role="button" tabIndex={0}
                onClick={() => {
                  if (s.label === 'Unread') setFilter(filter === 'unread' ? '' : 'unread');
                  else if (s.label === 'Starred') setFilter(filter === 'starred' ? '' : 'starred');
                  else if (s.label === 'Needs Response') setFilter(filter === 'needs_response' ? '' : 'needs_response');
                  else setFilter('');
                }}>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center',
                  s.label === 'Total' ? 'bg-gm-surface-secondary' :
                  s.label === 'Unread' ? 'bg-blue-600/10' :
                  s.label === 'Starred' ? 'bg-yellow-500/10' : 'bg-yellow-500/10')}>
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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails..."
            aria-label="Search emails"
            className="w-full pl-9 pr-3 py-2 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
        </div>

        {[
          { key: 'needs_response', label: 'Needs Response', icon: Clock, activeColor: 'bg-gm-status-warning-bg border-yellow-500/30 text-gm-status-warning' },
          { key: 'starred', label: 'Starred', icon: Star, activeColor: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' },
          { key: 'unread', label: 'Unread', icon: Eye, activeColor: 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' },
        ].map(f => {
          const FIcon = f.icon;
          const isActive = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(isActive ? '' : f.key as typeof filter)}
              aria-pressed={isActive}
              className={cn('px-2.5 py-2 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5',
                isActive ? f.activeColor : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
              <FIcon className="w-3.5 h-3.5" /> {f.label}
            </button>
          );
        })}

        <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)}
          aria-label="Filter by direction"
          className="bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="internal">Internal</option>
        </select>
      </div>

      {/* Email List */}
      {emails.error ? (
        <ErrorState message="Failed to load emails." onRetry={() => emails.refetch()} />
      ) : emails.isLoading ? (
        <EmailsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-8 text-center text-gm-text-tertiary">
          <Mail className="h-12 w-12 mx-auto mb-4 text-gray-500" />
          {emailList.length === 0 ? "No emails imported yet. Click 'Add Email' to get started." : 'No emails match your filters.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((email) => {
            const isStarred = !!email.is_starred;
            const isRead = !!email.is_read;
            const hasDraft = !!email.response_drafted || !!email.draft_response;
            const isResponded = !!email.response_sent;
            const hasAi = !!email.ai_summary;
            const DirIcon = directionIcon[String(email.direction || '')] || null;
            const subject = String(email.subject || 'No subject');
            const from = String(email.from || email.from_name || email.sender || '');
            const date = email.date ? new Date(String(email.date)).toLocaleDateString() : '';
            const preview = String(email.ai_summary || email.body_text || email.body || '').substring(0, 120);

            return (
              <div key={String(email.id)}
                className={cn(
                  'bg-gm-surface-primary border border-gm-border-primary rounded-xl p-3.5 hover:border-blue-600/30 transition-all cursor-pointer group',
                  !isRead && 'border-l-[3px] border-l-gm-interactive-primary',
                )}
                onClick={() => handleSelectEmail(email)}>
                <div className="flex items-center gap-3">
                  {/* Star */}
                  <button onClick={(e) => handleStar(e, String(email.id), isStarred)} className="flex-shrink-0">
                    <Star className={cn('w-4 h-4 transition-colors', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600 hover:text-yellow-400')} />
                  </button>

                  {/* Direction icon */}
                  {DirIcon ? (
                    <DirIcon className={cn('w-5 h-5 flex-shrink-0', isRead ? 'text-gm-text-tertiary' : 'text-gm-interactive-primary')} />
                  ) : (
                    <Mail className={cn('w-5 h-5 flex-shrink-0', isRead ? 'text-gm-text-tertiary' : 'text-gm-interactive-primary')} />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm truncate transition-colors group-hover:text-gm-interactive-primary',
                        isRead ? 'text-gm-text-primary' : 'text-gm-text-primary font-semibold')}>
                        {subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gm-text-tertiary truncate max-w-[200px]">{from}</span>
                      {date && <span className="text-[10px] text-gm-text-tertiary">{date}</span>}
                    </div>
                    {preview && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{preview}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {email.requires_response && !isResponded && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Needs Response
                      </span>
                    )}
                    {isResponded && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-success-bg text-gm-status-success font-medium">Responded</span>
                    )}
                    {hasDraft && !isResponded && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-gm-interactive-primary font-medium">Draft</span>
                    )}
                    {email.sentiment && (
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', sentimentColor[String(email.sentiment)] || sentimentColor.neutral)}>
                        {String(email.sentiment)}
                      </span>
                    )}
                    {email.ai_category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-gm-interactive-primary font-medium capitalize">
                        {String(email.ai_category)}
                      </span>
                    )}
                    {hasAi && (
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose Modal */}
      <EmailComposeModal
        open={compose.open}
        onClose={() => setCompose({ open: false, mode: 'compose', replyTo: null })}
        mode={compose.mode}
        replyTo={compose.replyTo}
      />
    </div>
  );
}
