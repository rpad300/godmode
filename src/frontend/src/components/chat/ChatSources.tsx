/**
 * Purpose:
 *   Renders a list of source references cited by an AI chat response,
 *   displayed as compact clickable badges with type icons and relevance
 *   percentages.
 *
 * Responsibilities:
 *   - Maps source types (document, transcript, email, conversation) to
 *     corresponding Lucide icons
 *   - Displays each source as a pill with icon, truncated title, and
 *     relevance score
 *   - Shows source excerpt on hover via the title attribute
 *
 * Key dependencies:
 *   - ChatSource (chat-data): source reference shape with type, title,
 *     excerpt, and relevance
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - The buttons are not wired to any navigation; clicking a source
 *     currently does nothing. TODO: link to source detail view.
 */
import { FileText, MessageSquare, Mail, MessagesSquare } from 'lucide-react';
import type { ChatSource } from '@/data/chat-data';

const sourceTypeIcon: Record<string, typeof FileText> = {
  document: FileText,
  transcript: MessageSquare,
  email: Mail,
  conversation: MessagesSquare,
};

interface ChatSourcesProps {
  sources: ChatSource[];
}

const ChatSources = ({ sources }: ChatSourcesProps) => {
  if (!sources.length) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Sources ({sources.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const Icon = sourceTypeIcon[source.type] || FileText;
          return (
            <button
              key={source.id}
              className="group/src flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/50 hover:border-primary/30 transition-all text-left max-w-[220px]"
              title={source.excerpt}
            >
              <Icon className="w-3 h-3 text-muted-foreground group-hover/src:text-primary flex-shrink-0" />
              <span className="text-[11px] text-foreground truncate">{source.title}</span>
              <span className="text-[9px] text-muted-foreground flex-shrink-0">
                {Math.round(source.relevance * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChatSources;
