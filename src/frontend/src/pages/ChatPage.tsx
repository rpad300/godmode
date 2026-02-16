import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Info } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useSendChatMessage, type ChatSource } from '../hooks/useGodMode';
import { cn } from '../lib/utils';

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
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch {}
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [showSources, setShowSources] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendMessage = useSendChatMessage();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Build last 10 messages as context
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    sendMessage.mutate(
      { message: text, history },
      {
        onSuccess: (data) => {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: data.response,
            timestamp: new Date().toISOString(),
            sources: data.sources,
            contextQuality: data.contextQuality,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        },
        onError: (error) => {
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        },
      }
    );
  }, [input, messages, sendMessage]);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Chat</h1>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearHistory}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 rounded-lg border bg-[hsl(var(--card))] p-4">
        {messages.length === 0 && (
          <div className="text-center text-[hsl(var(--muted-foreground))] py-12">
            Ask a question about your project knowledge base.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={cn(
                'max-w-[80%] rounded-lg p-3 text-sm',
                msg.role === 'user'
                  ? 'ml-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'bg-[hsl(var(--muted))]'
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="flex items-center justify-between mt-1">
                <div
                  className={cn(
                    'text-[10px] opacity-60',
                    msg.role === 'user' ? 'text-right flex-1' : ''
                  )}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <button
                    onClick={() =>
                      setShowSources(showSources === msg.id ? null : msg.id)
                    }
                    className="text-[10px] opacity-60 hover:opacity-100 flex items-center gap-1 ml-2"
                  >
                    <Info className="h-3 w-3" />
                    {msg.sources.length} sources
                  </button>
                )}
              </div>
              {msg.contextQuality && msg.role === 'assistant' && (
                <Badge
                  variant={
                    msg.contextQuality === 'high'
                      ? 'default'
                      : msg.contextQuality === 'medium'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="mt-1 text-[9px]"
                >
                  {msg.contextQuality} confidence
                </Badge>
              )}
            </div>
            {/* Sources panel */}
            {showSources === msg.id && msg.sources && (
              <div className="max-w-[80%] mt-1 rounded-md bg-[hsl(var(--accent))] p-2 text-xs space-y-1">
                {msg.sources.map((source, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">
                      {source.type}
                    </Badge>
                    <span className="truncate">
                      {source.title ?? source.excerpt ?? `Source #${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sendMessage.isPending && (
          <div className="max-w-[80%] rounded-lg p-3 text-sm bg-[hsl(var(--muted))]">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))] animate-pulse" />
              <span className="text-[hsl(var(--muted-foreground))]">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question..."
          className="flex-1 h-10 rounded-md border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
        <Button onClick={handleSend} disabled={!input.trim() || sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
