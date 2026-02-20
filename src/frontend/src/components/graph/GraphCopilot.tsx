import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Sparkles, Loader2, Code, ChevronDown, ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { useGraphRAGQuery } from '../../hooks/useGodMode';
import { cn } from '../../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
  sources?: Array<Record<string, unknown>>;
  reasoning?: string[];
  timestamp: string;
}

const SUGGESTIONS = [
  'Who are the key people in this project?',
  'What are the main risks identified?',
  'Show me connections between teams and documents',
  'What decisions have been made recently?',
  'Find all action items and their owners',
  'What are the open questions?',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GraphCopilot({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [expandedCypher, setExpandedCypher] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = useGraphRAGQuery();

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback((text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);

    query.mutate({ query: msg }, {
      onSuccess: (data) => {
        const d = data as Record<string, unknown>;
        const assistantMsg: Message = {
          role: 'assistant',
          content: String(d.answer || d.response || 'No answer generated.'),
          cypher: d.cypherUsed ? String(d.cypherUsed) : undefined,
          sources: d.sources as Array<Record<string, unknown>> | undefined,
          reasoning: d.reasoning as string[] | undefined,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      },
      onError: () => {
        setMessages(prev => [...prev, {
          role: 'assistant', content: 'Failed to query the knowledge graph. Please try again.',
          timestamp: new Date().toLocaleTimeString(),
        }]);
      },
    });
  }, [input, query]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-gm-surface-primary border border-gm-border-primary rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600/10 to-transparent border-b border-gm-border-primary shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-gm-interactive-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gm-text-primary">Graph Copilot</h3>
            <p className="text-[10px] text-gm-text-tertiary">Ask anything about your knowledge graph</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gm-surface-secondary text-gm-text-tertiary hover:text-gm-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-xs text-gm-text-tertiary mb-4">Ask me about your knowledge graph</p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => handleSend(s)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-[10px] text-gm-text-primary hover:bg-gm-surface-hover hover:border-blue-600/30 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-xl px-3 py-2',
              msg.role === 'user'
                ? 'bg-gm-interactive-primary text-gm-text-on-brand'
                : 'bg-gm-surface-secondary border border-gm-border-primary')}>
              <p className={cn('text-xs leading-relaxed whitespace-pre-wrap',
                msg.role === 'user' ? '' : 'text-gm-text-primary')}>
                {msg.content}
              </p>

              {msg.reasoning && msg.reasoning.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)]">
                  <p className="text-[9px] text-gm-text-tertiary font-semibold uppercase mb-1">Reasoning</p>
                  {msg.reasoning.map((r, j) => (
                    <p key={j} className="text-[10px] text-gm-text-tertiary flex items-start gap-1">
                      <span className="text-gm-interactive-primary">{j + 1}.</span> {r}
                    </p>
                  ))}
                </div>
              )}

              {msg.cypher && (
                <div className="mt-2">
                  <button onClick={() => setExpandedCypher(expandedCypher === i ? null : i)}
                    className="text-[9px] text-gm-interactive-primary hover:underline flex items-center gap-1">
                    <Code className="w-3 h-3" /> {expandedCypher === i ? 'Hide' : 'Show'} Cypher
                  </button>
                  {expandedCypher === i && (
                    <pre className="mt-1 p-2 rounded bg-gm-surface-secondary text-[9px] text-gm-text-primary font-mono overflow-x-auto">{msg.cypher}</pre>
                  )}
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)]">
                  <p className="text-[9px] text-gm-text-tertiary font-semibold uppercase mb-1">Sources ({msg.sources.length})</p>
                  {msg.sources.slice(0, 3).map((s, j) => (
                    <p key={j} className="text-[10px] text-gm-text-tertiary truncate">{String(s.name || s.title || s.label || JSON.stringify(s).substring(0, 60))}</p>
                  ))}
                </div>
              )}

              <p className={cn('text-[9px] mt-1', msg.role === 'user' ? 'text-white/50' : 'text-gray-500')}>{msg.timestamp}</p>
            </div>
          </div>
        ))}

        {query.isPending && (
          <div className="flex justify-start">
            <div className="bg-gm-surface-secondary border border-gm-border-primary rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gm-interactive-primary" />
              <span className="text-xs text-gm-text-tertiary">Querying knowledge graph...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-gm-border-primary bg-gm-surface-secondary">
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about the knowledge graph..."
            className="flex-1 bg-gm-surface-primary border border-gm-border-primary rounded-lg px-3 py-2 text-xs text-gm-text-primary placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
          <button onClick={() => handleSend()} disabled={query.isPending || !input.trim()}
            className="w-8 h-8 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand flex items-center justify-center hover:bg-gm-interactive-primary-hover disabled:opacity-50 transition-colors">
            {query.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
