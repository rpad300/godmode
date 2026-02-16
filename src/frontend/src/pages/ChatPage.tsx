import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Loader2, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatSessions, useChatMessages } from '@/hooks/useGodMode'; // Real hooks
import { apiClient } from '@/lib/api-client';
import type { ChatMessage } from '@/types/godmode';
import { suggestedQuestions } from '@/data/chat-data'; // Keep suggestions for now
import ChatSources from '@/components/chat/ChatSources';
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar';
import { useQueryClient } from '@tanstack/react-query';

interface EnrichedChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: any[];
  isStreaming?: boolean;
}

const ChatPage = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [persona, setPersona] = useState('');
  const [targetPerson, setTargetPerson] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions();

  // Fetch messages for active conversation
  const { data: serverMessages = [], isLoading: messagesLoading } = useChatMessages(activeConversation);

  // Map server messages to UI format
  const messages: EnrichedChatMessage[] = serverMessages.map((m: any) => ({
    id: m.id || String(Math.random()),
    role: m.role,
    content: m.content,
    timestamp: m.created_at || new Date().toISOString(),
    sources: m.metadata?.sources || [],
    isStreaming: false
  }));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, activeConversation]);

  // Set active conversation to most recent if none selected and sessions exist
  useEffect(() => {
    if (!activeConversation && sessions.length > 0 && !isLoading) {
      // Optional: Auto-select first? Or keep 'New Chat' state?
      // Keeping 'New Chat' state is better for UX usually, unless we want to restore context.
      // Let's leave it as null for "New Chat".
    }
  }, [sessions.length, activeConversation, isLoading]);


  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;

    setInput('');
    setIsLoading(true);

    // Optimistic user message (optional, but good for UX)
    // We can't easily mix optimistic with React Query unless we maintain a separate list or cache update.
    // For simplicity V1, we'll just wait for loading.
    // Actually, let's just invalidate queries after send.

    try {
      const response = await apiClient.post<{ ok: boolean, text: string, sessionId: string, sources?: any[] }>('/api/chat', {
        message: content,
        sessionId: activeConversation,
        context: {
          persona,
          targetPerson
        }
      });

      if (response.sessionId) {
        setActiveConversation(response.sessionId);
        // Invalidate to fetch new messages and update session list
        await queryClient.invalidateQueries({ queryKey: ['chat-messages', response.sessionId] });
        await queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      }

    } catch (error) {
      console.error("Failed to send message", error);
      // Toast error here ideally
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversation(null);
    inputRef.current?.focus();
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
  };

  const isEmpty = messages.length === 0 && !activeConversation;

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0"
          >
            <ChatHistorySidebar
              conversations={sessions.map((s: any) => ({
                id: s.id,
                title: s.title || 'New Chat',
                lastMessage: '...', // API might need to provide this, or we derive it
                timestamp: s.created_at || new Date().toISOString(),
                messageCount: s.message_count || 0
              }))}
              activeId={activeConversation}
              onSelect={handleSelectConversation}
              onNew={handleNewChat}
              persona={persona}
              onPersonaChange={setPersona}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center gap-3 px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-foreground truncate">
              {activeConversation
                ? sessions.find((c: any) => c.id === activeConversation)?.title || 'Chat'
                : 'New Chat'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              RAG Powered
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto p-6 space-y-5">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">GodMode Chat</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-8">
                  Ask questions about your documents, meetings, and knowledge base. Powered by RAG with source citations.
                </p>

                {/* Suggested Questions */}
                <div className="w-full max-w-lg">
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(q)}
                        className="text-left px-3.5 py-2.5 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-card/80 transition-all text-xs text-foreground group"
                      >
                        <span className="text-primary mr-1.5">→</span>
                        <span className="group-hover:text-primary transition-colors">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${msg.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-[70%]'
                    : 'bg-card border border-border text-foreground max-w-[85%]'
                    }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:text-sm [&_p]:text-foreground/90 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:text-sm [&_li]:text-foreground/90 [&_strong]:text-foreground [&_code]:text-accent [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-secondary [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-secondary [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-border">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                    <ChatSources sources={msg.sources} />
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-accent" />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about your documents, meetings, decisions..."
              disabled={isLoading}
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
