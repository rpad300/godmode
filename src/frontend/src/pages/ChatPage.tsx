/**
 * Purpose:
 *   Multi-mode conversational interface with session management, RAG-powered
 *   knowledge search, SOT chat, daily briefing, and contact-context support.
 *
 * Key features ported from the original GODMODE CSS chat:
 *   - Sessions sidebar: list, create, switch conversations (persisted server-side)
 *   - Contact context ("Como quem?"): chat in the perspective of a contact
 *   - Quick prompt chips for common queries
 *   - RAG metadata badges: confidence, query type, RAG method, sources count
 *   - Contact pills on sources with avatar placeholders
 *   - Collapsible detailed sources with relevance scores
 *   - Auto-resize textarea input
 *   - Three chat modes: RAG Chat, SOT Chat, Briefing
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Trash2, Info, MessageCircle, Shield, FileBarChart,
  RotateCw, Loader2, Plus, ChevronRight, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useSendChatMessage, useSotChat, useBriefing,
  useChatSessions, useCreateChatSession, useUpdateChatSession, useChatMessages,
  useContacts,
  type ChatSource, type ChatRAGInfo, type ChatResponse, type ChatSession,
} from '../hooks/useGodMode';
import { cn } from '../lib/utils';
import { ContactSelect } from '../components/ui/ContactSelect';
import type { Contact } from '../types/godmode';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';

type ChatMode = 'rag' | 'sot' | 'briefing';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: ChatSource[];
  contextQuality?: string;
  confidence?: string;
  queryType?: string;
  rag?: ChatRAGInfo;
}

const QUICK_PROMPTS = [
  'Summarize key risks',
  'List open questions',
  'What actions are overdue?',
  'Who are the key contacts?',
];

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── RAG Badge ────────────────────────────────────────────────────────────────

function RagBadges({ msg }: { msg: LocalMessage }) {
  if (msg.role !== 'assistant') return null;
  const badges: Array<{ label: string; cls: string; title: string }> = [];

  if (msg.confidence) {
    const cls = msg.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-400'
      : msg.confidence === 'medium' ? 'bg-amber-500/15 text-amber-400'
        : 'bg-red-500/15 text-red-400';
    badges.push({ label: msg.confidence, cls, title: 'Confidence' });
  }
  if (msg.queryType) {
    badges.push({ label: msg.queryType, cls: 'bg-indigo-500/15 text-indigo-400', title: 'Query type' });
  }
  if (msg.rag) {
    const method = msg.rag.usedHyDE ? 'HyDE+RRF'
      : msg.rag.graphResults > 0 ? 'Graph+Vector' : 'Hybrid';
    badges.push({ label: method, cls: 'bg-purple-500/15 text-purple-400', title: `RAG: ${msg.rag.method ?? method}` });
    const total = msg.rag.fusedResults || (msg.rag.vectorResults + msg.rag.graphResults);
    if (total > 0) {
      badges.push({ label: `${total} sources`, cls: 'bg-sky-500/15 text-sky-400', title: 'Sources found' });
    }
  }

  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
      {badges.map((b, i) => (
        <span key={i} title={b.title} className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full', b.cls)}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

// ── Contact Pill ─────────────────────────────────────────────────────────────

function ContactPills({ sources }: { sources: ChatSource[] }) {
  const contactSources = sources.filter(s => s.contactName);
  if (contactSources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {contactSources.map((s, i) => (
        <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs">
          <div className="w-6 h-6 rounded-full bg-purple-500/30 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            {(s.contactName || '?')[0]}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-purple-300 block truncate">{s.contactName}</span>
            {s.contactRole && <span className="text-[10px] text-purple-400/70">{s.contactRole}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Collapsible Sources ──────────────────────────────────────────────────────

function CollapsibleSources({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
  const nonContact = sources.filter(s => !s.contactName);
  if (nonContact.length === 0) return null;
  const top5 = nonContact.slice(0, 5);
  return (
    <div className="mt-2 text-xs">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
        <ChevronRight className={cn('w-3 h-3 transition-transform', open && 'rotate-90')} />
        {sources.length} sources used
      </button>
      {open && (
        <div className="mt-1.5 p-2 rounded-lg bg-[var(--gm-bg-tertiary)] space-y-1">
          {top5.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] capitalize text-[10px] font-medium">{s.type || 'unknown'}</span>
              <span className="text-[var(--gm-accent-primary)] font-semibold text-[10px] min-w-[30px]">
                {Math.round((s.rrfScore ?? s.score ?? 0) * 100)}%
              </span>
              {s.sourceCount && s.sourceCount > 1 && (
                <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-400 font-semibold">x{s.sourceCount}</span>
              )}
              {s.source && <span className="ml-auto text-[var(--gm-text-tertiary)] text-[9px] truncate max-w-[120px]">{s.source}</span>}
            </div>
          ))}
          {nonContact.length > 5 && <div className="text-[var(--gm-text-tertiary)] text-[10px] text-center pt-1 border-t border-[var(--gm-border-primary)]">+{nonContact.length - 5} more</div>}
        </div>
      )}
    </div>
  );
}

// ── Sessions Sidebar ─────────────────────────────────────────────────────────

function SessionsSidebar({
  sessions, currentId, onSelect, onCreate, contacts, onContextChange,
}: {
  sessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: (contextContactId?: string | null) => void;
  contacts: Contact[];
  onContextChange: (contactId: string | null) => void;
}) {
  const [newCtx, setNewCtx] = useState('');
  const currentSession = sessions.find(s => s.id === currentId);

  return (
    <div className="w-60 min-w-[200px] border-r border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)] flex flex-col overflow-hidden shrink-0">
      <button
        onClick={() => onCreate(newCtx || null)}
        className={cn(BTN_PRIMARY, 'm-2 px-3 py-2 text-sm')}
      >
        <Plus className="w-4 h-4" /> New Conversation
      </button>

      {/* Context selector for new chat */}
      {contacts.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          <span className="text-[10px] text-[var(--gm-text-tertiary)]">As who?</span>
          <ContactSelect
            contacts={contacts}
            value={newCtx || null}
            onChange={id => setNewCtx(id ?? '')}
            placeholder="No context"
            compact
          />
        </div>
      )}

      {/* Active session context */}
      {currentSession && contacts.length > 0 && (
        <div className="px-3 pb-2 pt-1 border-t border-[var(--gm-border-primary)] space-y-1">
          <span className="text-[10px] text-[var(--gm-text-tertiary)]">Session context</span>
          <ContactSelect
            contacts={contacts}
            value={currentSession.context_contact_id ?? null}
            onChange={onContextChange}
            placeholder="No context"
            compact
          />
        </div>
      )}

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'w-full text-left flex flex-col gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors',
              s.id === currentId
                ? 'bg-[var(--gm-interactive-primary)]/15 text-[var(--gm-accent-primary)] font-medium'
                : 'text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] hover:text-[var(--gm-text-primary)]'
            )}
          >
            <span className="truncate">{(s.title || 'Untitled').length > 40 ? (s.title || 'Untitled').substring(0, 37) + '...' : (s.title || 'Untitled')}</span>
            <span className="text-[10px] opacity-60">{formatRelativeTime(s.updated_at)}</span>
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-[var(--gm-text-tertiary)] text-center py-4">No conversations yet</p>
        )}
      </div>
    </div>
  );
}

// ── Main ChatPage ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [mode, setMode] = useState<ChatMode>('rag');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [refreshBriefing, setRefreshBriefing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendRagMessage = useSendChatMessage();
  const sendSotMessage = useSotChat();
  const briefing = useBriefing(refreshBriefing);
  const { data: sessionsData, refetch: refetchSessions } = useChatSessions();
  const createSession = useCreateChatSession();
  const updateSession = useUpdateChatSession();
  const { data: contactsData } = useContacts();
  const { data: serverMessages } = useChatMessages(currentSessionId);

  const sessions = (sessionsData as { sessions?: ChatSession[] })?.sessions ?? [];
  const contacts = useMemo(() => {
    if (!contactsData) return [];
    const raw = (contactsData as { contacts?: Contact[] })?.contacts ?? (contactsData as Contact[]);
    return Array.isArray(raw) ? raw : [];
  }, [contactsData]);

  const isPending = sendRagMessage.isPending || sendSotMessage.isPending;

  // When switching session, load messages from server
  useEffect(() => {
    if (!serverMessages) return;
    const msgs = (serverMessages as { messages?: Array<Record<string, unknown>> })?.messages ?? [];
    setLocalMessages(msgs.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      timestamp: m.created_at as string,
      sources: m.sources as ChatSource[] | undefined,
      confidence: (m.metadata as Record<string, unknown>)?.confidence as string | undefined,
      queryType: (m.metadata as Record<string, unknown>)?.queryType as string | undefined,
      rag: (m.metadata as Record<string, unknown>)?.rag as ChatRAGInfo | undefined,
      contextQuality: (m.metadata as Record<string, unknown>)?.contextQuality as string | undefined,
    })));
  }, [serverMessages]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [localMessages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Select a session
  const handleSelectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  // Create new session
  const handleCreateSession = useCallback((contextContactId?: string | null) => {
    createSession.mutate({ title: 'New conversation', contextContactId: contextContactId ?? null }, {
      onSuccess: (data: unknown) => {
        const session = (data as { session?: ChatSession })?.session;
        if (session) {
          setCurrentSessionId(session.id);
          setLocalMessages([]);
          refetchSessions();
        }
      },
    });
  }, [createSession, refetchSessions]);

  // Update session context
  const handleContextChange = useCallback((contactId: string | null) => {
    if (!currentSessionId) return;
    updateSession.mutate({ sessionId: currentSessionId, contextContactId: contactId }, {
      onSuccess: () => { toast.success('Context updated'); refetchSessions(); },
      onError: () => toast.error('Failed to update context'),
    });
  }, [currentSessionId, updateSession, refetchSessions]);

  // Send message
  const handleSend = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isPending) return;

    const userMsg: LocalMessage = {
      id: `msg-${Date.now()}-user`, role: 'user', content: msg, timestamp: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }

    const history = localMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    const mutationFn = mode === 'sot' ? sendSotMessage : sendRagMessage;

    const payload: Record<string, unknown> = { message: msg, history };
    if (mode === 'rag' && currentSessionId) payload.sessionId = currentSessionId;

    mutationFn.mutate(payload as Parameters<typeof mutationFn.mutate>[0], {
      onSuccess: (data: unknown) => {
        const d = data as ChatResponse;
        const assistantMsg: LocalMessage = {
          id: `msg-${Date.now()}-assistant`, role: 'assistant',
          content: d.response, timestamp: new Date().toISOString(),
          sources: d.sources, contextQuality: d.contextQuality,
          confidence: d.confidence, queryType: d.queryType, rag: d.rag,
        };
        setLocalMessages(prev => [...prev, assistantMsg]);

        // Auto-create session if backend created one
        if (d.sessionId && !currentSessionId) {
          setCurrentSessionId(d.sessionId);
          refetchSessions();
        }
      },
      onError: (error: Error) => {
        setLocalMessages(prev => [...prev, {
          id: `msg-${Date.now()}-error`, role: 'system' as const,
          content: `Error: ${error.message}`, timestamp: new Date().toISOString(),
        }]);
      },
    });
  }, [input, localMessages, isPending, mode, sendRagMessage, sendSotMessage, currentSessionId, refetchSessions]);

  // Clear
  const handleClear = useCallback(() => {
    setLocalMessages([]);
    setCurrentSessionId(null);
  }, []);

  const modes = [
    { key: 'rag' as ChatMode, label: 'RAG Chat', icon: MessageCircle, desc: 'Query all project knowledge' },
    { key: 'sot' as ChatMode, label: 'SOT Chat', icon: Shield, desc: 'Source of Truth focused' },
    { key: 'briefing' as ChatMode, label: 'Briefing', icon: FileBarChart, desc: 'Daily project briefing' },
  ];

  // ── Briefing view ──────────────────────────────────────────────────────────
  if (mode === 'briefing') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">Daily Briefing</h1>
          <button
            onClick={() => { setRefreshBriefing(true); briefing.refetch().then(() => setRefreshBriefing(false)); }}
            disabled={briefing.isFetching}
            className={cn(BTN_PRIMARY, 'flex items-center gap-1.5')}
          >
            {briefing.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
        <ModeSwitcher modes={modes} current={mode} onChange={setMode} />
        {briefing.isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-[var(--gm-accent-primary)]" /></div>
        ) : briefing.error ? (
          <div className={cn(CARD, 'p-6 text-center text-[var(--gm-text-tertiary)]')}>Failed to load briefing.</div>
        ) : (
          <div className={cn(CARD, 'p-6')}>
            {briefing.data?.generated_at && (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] mb-4">Generated: {new Date(briefing.data.generated_at).toLocaleString()}</p>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--gm-text-primary)] whitespace-pre-wrap">
              {(briefing.data as Record<string, unknown>)?.briefing as string || briefing.data?.content || 'No briefing available.'}
            </div>
            {(briefing.data as Record<string, unknown>)?.analysis && (
              <div className="mt-6 pt-4 border-t border-[var(--gm-border-primary)]">
                <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] mb-2">Analysis</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--gm-text-tertiary)] whitespace-pre-wrap">
                  {(briefing.data as Record<string, unknown>).analysis as string}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Chat view (RAG or SOT) ─────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sessions sidebar (only in RAG mode) */}
      {mode === 'rag' && (
        <SessionsSidebar
          sessions={sessions}
          currentId={currentSessionId}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
          contacts={contacts}
          onContextChange={handleContextChange}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--gm-border-primary)] shrink-0">
          <h1 className="text-lg font-bold text-[var(--gm-text-primary)]">Chat</h1>
          <div className="flex gap-2">
            {localMessages.length > 0 && (
              <button onClick={handleClear} className={cn(BTN_SECONDARY, 'flex items-center gap-1.5')}>
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Mode switcher */}
        <div className="px-6 pt-3">
          <ModeSwitcher modes={modes} current={mode} onChange={setMode} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {localMessages.length === 0 && (
            <div className="text-center text-[var(--gm-text-tertiary)] py-12 space-y-4">
              <p>{mode === 'sot' ? 'Ask about facts, decisions, risks, and actions.' : 'Ask a question about your project knowledge base.'}</p>
              {/* Quick prompts */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSend(p)}
                    className="px-3 py-1.5 text-xs rounded-full border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] text-[var(--gm-text-tertiary)] hover:border-[var(--gm-accent-primary)] hover:text-[var(--gm-accent-primary)] transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {localMessages.map(msg => (
            <div key={msg.id}>
              <div className={cn(
                'max-w-[80%] rounded-xl p-3 text-sm',
                msg.role === 'user' ? 'ml-auto bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)]' :
                  msg.role === 'system' ? 'mx-auto bg-[var(--color-danger-500)]/10 text-[var(--color-danger-500)]' :
                    'bg-[var(--gm-bg-tertiary)]'
              )}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] opacity-50">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '—'}</span>
                  {msg.contextQuality && msg.role === 'assistant' && (
                    <span className={cn(
                      'text-[9px] px-2 py-0.5 rounded-full font-medium ml-2',
                      msg.contextQuality === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
                        msg.contextQuality === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]'
                    )}>
                      {msg.contextQuality} confidence
                    </span>
                  )}
                </div>
                <RagBadges msg={msg} />
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="max-w-[80%]">
                  <ContactPills sources={msg.sources} />
                  <CollapsibleSources sources={msg.sources} />
                </div>
              )}
            </div>
          ))}

          {isPending && (
            <div className="max-w-[80%] rounded-xl p-3 text-sm bg-[var(--gm-bg-tertiary)] flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--gm-text-tertiary)]" />
              <span className="text-[var(--gm-text-tertiary)]">Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts inline (when there are already messages) */}
        {localMessages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 pb-2">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="px-2.5 py-1 text-[10px] rounded-full border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] text-[var(--gm-text-tertiary)] hover:border-[var(--gm-accent-primary)] hover:text-[var(--gm-accent-primary)] transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 px-6 py-3 border-t border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)] shrink-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={mode === 'sot' ? 'Ask about facts, decisions, risks...' : 'Ask a question...'}
            rows={1}
            className={cn(INPUT, 'flex-1 min-h-[44px] max-h-[120px] resize-none py-2.5')}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isPending}
            className={cn(BTN_PRIMARY, 'h-11 px-4 text-sm self-end')}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mode Switcher ────────────────────────────────────────────────────────────

function ModeSwitcher({ modes, current, onChange }: {
  modes: Array<{ key: ChatMode; label: string; icon: typeof MessageCircle }>;
  current: ChatMode;
  onChange: (m: ChatMode) => void;
}) {
  return (
    <div className="flex gap-1 bg-[var(--gm-bg-tertiary)] rounded-xl p-1 max-w-md mb-3">
      {modes.map(m => {
        const Icon = m.icon;
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              current === m.key ? 'bg-[var(--gm-surface-primary)] text-[var(--gm-text-primary)] shadow-sm' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]'
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {m.label}
          </button>
        );
      })}
    </div>
  );
}
