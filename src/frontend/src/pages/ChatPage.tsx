import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSendMessage } from '../hooks/useGodMode';
import { cn } from '../lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: unknown[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendMessage = useSendMessage();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    sendMessage.mutate(text, {
      onSuccess: (data) => {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          sources: data.sources,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      },
      onError: (error) => {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `Error: ${error.message}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      },
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-bold mb-4">Chat</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 rounded-lg border bg-[hsl(var(--card))] p-4">
        {messages.length === 0 && (
          <div className="text-center text-[hsl(var(--muted-foreground))] py-12">
            Ask a question about your project knowledge base.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[80%] rounded-lg p-3 text-sm',
              msg.role === 'user'
                ? 'ml-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'bg-[hsl(var(--muted))]'
            )}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
            <div
              className={cn(
                'text-[10px] mt-1 opacity-60',
                msg.role === 'user' ? 'text-right' : ''
              )}
            >
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
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
