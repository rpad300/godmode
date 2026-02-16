import { motion } from 'framer-motion';
import { Plus, MessageCircle, Clock } from 'lucide-react';
import type { ChatConversation } from '@/data/chat-data';
import { mockContacts } from '@/data/mock-data';

interface ChatHistorySidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  persona: string;
  onPersonaChange: (value: string) => void;
}

const formatRelativeTime = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

const ChatHistorySidebar = ({ conversations, activeId, onSelect, onNew, persona, onPersonaChange }: ChatHistorySidebarProps) => {
  const personaOptions = [
    { value: '', label: 'Sem contexto' },
    ...mockContacts.map(c => ({ value: c.name, label: `${c.name}` })),
  ];

  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova conversa
        </button>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Como quem?</label>
          <select
            value={persona}
            onChange={e => onPersonaChange(e.target.value)}
            className="mt-1 w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {personaOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-2">
          Recent Conversations
        </p>
        {conversations.map((conv) => (
          <motion.button
            key={conv.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
              activeId === conv.id
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-start gap-2">
              <MessageCircle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                activeId === conv.id ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${
                  activeId === conv.id ? 'text-primary' : 'text-foreground'
                }`}>
                  {conv.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {conv.lastMessage}
                </p>
                <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground">
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelativeTime(conv.timestamp)}
                  <span className="mx-1">·</span>
                  {conv.messageCount} msgs
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ChatHistorySidebar;
