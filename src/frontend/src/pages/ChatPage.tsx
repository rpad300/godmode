import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Info, MessageCircle, Shield, FileBarChart, RotateCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSendChatMessage, useSotChat, useBriefing, type ChatSource } from '../hooks/useGodMode';
import { cn } from '../lib/utils';

type ChatMode = 'rag' | 'sot' | 'briefing';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: ChatSource[];
  contextQuality?: 'high' | 'medium' | 'low' | 'none';
}

const STORAGE_KEY = 'godmode_chat_history';
function loadHistory(): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(messages: ChatMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch {}
}

export default function ChatPage() {
  const [mode, setMode] = useState<ChatMode>('rag');
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [showSources, setShowSources] = useState<string | null>(null);
  const [refreshBriefing, setRefreshBriefing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendRagMessage = useSendChatMessage();
  const sendSotMessage = useSotChat();
  const briefing = useBriefing(refreshBriefing);

  const isPending = sendRagMessage.isPending || sendSotMessage.isPending;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { saveHistory(messages); }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isPending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`, role: 'user', content: text, timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    const mutationFn = mode === 'sot' ? sendSotMessage : sendRagMessage;

    mutationFn.mutate(
      { message: text, history },
      {
        onSuccess: (data: any) => {
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-assistant`, role: 'assistant',
            content: data.response, timestamp: new Date().toISOString(),
            sources: data.sources, contextQuality: data.contextQuality,
          }]);
        },
        onError: (error: Error) => {
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-error`, role: 'assistant',
            content: `Error: ${error.message}`, timestamp: new Date().toISOString(),
          }]);
        },
      },
    );
  }, [input, messages, isPending, mode, sendRagMessage, sendSotMessage]);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const modes = [
    { key: 'rag' as ChatMode, label: 'RAG Chat', icon: MessageCircle, desc: 'Query all project knowledge' },
    { key: 'sot' as ChatMode, label: 'SOT Chat', icon: Shield, desc: 'Source of Truth focused' },
    { key: 'briefing' as ChatMode, label: 'Briefing', icon: FileBarChart, desc: 'Daily project briefing' },
  ];

  // Briefing view
  if (mode === 'briefing') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Daily Briefing</h1>
          <button
            onClick={() => { setRefreshBriefing(true); briefing.refetch().then(() => setRefreshBriefing(false)); }}
            disabled={briefing.isFetching}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
          >
            {briefing.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 max-w-md">
          {modes.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.key} onClick={() => setMode(m.key)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="w-3.5 h-3.5" /> {m.label}
              </button>
            );
          })}
        </div>

        {briefing.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : briefing.error ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
            Failed to load briefing. Try refreshing.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6">
            {briefing.data?.generated_at && (
              <p className="text-[10px] text-muted-foreground mb-4">
                Generated: {new Date(briefing.data.generated_at).toLocaleString()}
              </p>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap">
              {briefing.data?.content || 'No briefing available. Process some documents first.'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Chat view (RAG or SOT)
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Chat</h1>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button onClick={handleClearHistory} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-muted flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4 max-w-md">
        {modes.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.key} onClick={() => setMode(m.key)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-3.5 h-3.5" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 rounded-xl border border-border bg-card p-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            {mode === 'sot'
              ? 'Ask questions about your Source of Truth — facts, decisions, risks, and actions.'
              : 'Ask a question about your project knowledge base.'}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}>
            <div className={cn(
              'max-w-[80%] rounded-xl p-3 text-sm',
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-secondary'
            )}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] opacity-50">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <button onClick={() => setShowSources(showSources === msg.id ? null : msg.id)} className="text-[10px] opacity-50 hover:opacity-100 flex items-center gap-1 ml-2">
                    <Info className="h-3 w-3" /> {msg.sources.length} sources
                  </button>
                )}
              </div>
              {msg.contextQuality && msg.role === 'assistant' && (
                <span className={cn(
                  'inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-medium',
                  msg.contextQuality === 'high' ? 'bg-success/10 text-success' :
                    msg.contextQuality === 'medium' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                )}>
                  {msg.contextQuality} confidence
                </span>
              )}
            </div>
            {showSources === msg.id && msg.sources && (
              <div className="max-w-[80%] mt-1 rounded-lg bg-secondary/50 p-2 text-xs space-y-1">
                {msg.sources.map((source, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{source.type}</span>
                    <span className="truncate text-foreground">{source.title ?? source.excerpt ?? `Source #${i + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isPending && (
          <div className="max-w-[80%] rounded-xl p-3 text-sm bg-secondary flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={mode === 'sot' ? 'Ask about facts, decisions, risks...' : 'Ask a question...'}
          className="flex-1 h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isPending}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
