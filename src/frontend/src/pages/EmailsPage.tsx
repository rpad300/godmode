import { useState } from 'react';
import {
  Mail, Loader2, Trash2, Search, ArrowLeft, Sparkles,
  CheckCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmails, useDeleteEmail, useMarkEmailResponded, useGenerateEmailResponse,
} from '../hooks/useGodMode';
import { cn } from '../lib/utils';

export default function EmailsPage() {
  const [filter, setFilter] = useState<'' | 'needs_response'>('');
  const emails = useEmails({ requires_response: filter === 'needs_response' ? true : undefined });
  const deleteEmail = useDeleteEmail();
  const markResponded = useMarkEmailResponded();
  const generateResponse = useGenerateEmailResponse();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draftResponse, setDraftResponse] = useState<string | null>(null);

  const emailList = (emails.data ?? []) as Array<Record<string, unknown>>;

  const filtered = search
    ? emailList.filter(e =>
        JSON.stringify(e).toLowerCase().includes(search.toLowerCase())
      )
    : emailList;

  const selectedEmail = emailList.find(e => e.id === selectedId);

  const handleDelete = (id: string) => {
    deleteEmail.mutate(id, {
      onSuccess: () => {
        toast.success('Email deleted');
        if (selectedId === id) setSelectedId(null);
      },
    });
  };

  const handleMarkResponded = (id: string) => {
    markResponded.mutate(id, {
      onSuccess: () => toast.success('Marked as responded'),
    });
  };

  const handleGenerateResponse = (id: string) => {
    setDraftResponse(null);
    generateResponse.mutate(id, {
      onSuccess: (data) => {
        setDraftResponse(data.response || 'No response generated.');
        toast.success('AI response generated');
      },
      onError: () => toast.error('Failed to generate response'),
    });
  };

  // Detail view
  if (selectedEmail) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => { setSelectedId(null); setDraftResponse(null); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to emails
        </button>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{String(selectedEmail.subject || 'No subject')}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">From: {String(selectedEmail.from || selectedEmail.sender || '—')}</span>
                {selectedEmail.to && <span className="text-xs text-muted-foreground">To: {String(selectedEmail.to)}</span>}
              </div>
              {selectedEmail.date && (
                <span className="text-[10px] text-muted-foreground">{new Date(String(selectedEmail.date)).toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedEmail.requires_response && (
                <button
                  onClick={() => handleMarkResponded(String(selectedEmail.id))}
                  disabled={markResponded.isPending}
                  className="px-2.5 py-1 rounded-lg bg-success/10 text-success text-[10px] font-medium hover:bg-success/20 flex items-center gap-1"
                >
                  <CheckCircle className="w-3 h-3" /> Mark Responded
                </button>
              )}
              <button
                onClick={() => handleDelete(String(selectedEmail.id))}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            {selectedEmail.requires_response && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Needs Response
              </span>
            )}
            {selectedEmail.direction && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                {String(selectedEmail.direction)}
              </span>
            )}
            {selectedEmail.sentiment && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                {String(selectedEmail.sentiment)}
              </span>
            )}
          </div>

          {/* Body */}
          {selectedEmail.body && (
            <div className="border-t border-border pt-4">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap">
                {String(selectedEmail.body)}
              </div>
            </div>
          )}

          {/* AI summary */}
          {selectedEmail.ai_summary && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <h4 className="text-xs font-medium text-primary flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> AI Summary
              </h4>
              <p className="text-xs text-foreground">{String(selectedEmail.ai_summary)}</p>
            </div>
          )}

          {/* Generate AI response */}
          <div className="border-t border-border pt-4 space-y-3">
            <button
              onClick={() => handleGenerateResponse(String(selectedEmail.id))}
              disabled={generateResponse.isPending}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
            >
              {generateResponse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate AI Response
            </button>
            {draftResponse && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Draft Response</h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">{draftResponse}</p>
              </div>
            )}
          </div>

          {/* Recipients */}
          {selectedEmail.recipients && Array.isArray(selectedEmail.recipients) && (selectedEmail.recipients as any[]).length > 0 && (
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Recipients</h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedEmail.recipients as Array<Record<string, unknown>>).map((r, j) => (
                  <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {String(r.name || r.email || `Recipient #${j + 1}`)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Emails</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} email{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emails..."
            className="w-full pl-9 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setFilter(filter === 'needs_response' ? '' : 'needs_response')}
          className={cn(
            'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5',
            filter === 'needs_response'
              ? 'bg-warning/10 border-warning/30 text-warning'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          )}
        >
          <Clock className="w-3.5 h-3.5" /> Needs Response
        </button>
      </div>

      {emails.isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          {emailList.length === 0 ? 'No emails imported yet.' : 'No emails match your filters.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((email) => (
            <div
              key={String(email.id)}
              className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => setSelectedId(String(email.id))}
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {String(email.subject || 'No subject')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground truncate">{String(email.from || email.sender || '')}</span>
                    {email.date && <span className="text-[10px] text-muted-foreground">{new Date(String(email.date)).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {email.requires_response && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Needs Response
                    </span>
                  )}
                  {email.direction && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                      {String(email.direction)}
                    </span>
                  )}
                </div>
              </div>
              {email.ai_summary && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-8 truncate">{String(email.ai_summary)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
