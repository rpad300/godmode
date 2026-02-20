import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Loader2, MoreHorizontal, Edit2, Trash2,
  CheckCircle2, Circle, Reply, ChevronDown, ChevronUp, User,
} from 'lucide-react';
import {
  useComments, useCreateComment, useUpdateComment, useDeleteComment,
  useResolveComment, type Comment,
} from '@/hooks/useGodMode';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CommentItem({
  comment,
  targetType,
  targetId,
  depth = 0,
}: {
  comment: Comment;
  targetType: string;
  targetId: string;
  depth?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplies, setShowReplies] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const updateMut = useUpdateComment();
  const deleteMut = useDeleteComment();
  const resolveMut = useResolveComment();
  const createMut = useCreateComment();

  const handleUpdate = () => {
    if (!editContent.trim()) return;
    updateMut.mutate({ id: comment.id, content: editContent.trim() }, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;
    createMut.mutate(
      { targetType, targetId, content: replyContent.trim(), parent_id: comment.id },
      { onSuccess: () => { setReplyContent(''); setReplying(false); } },
    );
  };

  const replies = comment.replies ?? [];

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-[var(--gm-border-primary)] pl-4' : ''}`}>
      <div className={`group rounded-lg p-3 transition-colors ${
        comment.resolved ? 'opacity-60' : 'hover:bg-[var(--gm-surface-hover)]'
      }`}>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-[var(--gm-interactive-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-[var(--gm-text-primary)]">
                {comment.author_name || 'User'}
              </span>
              <span className="text-[10px] text-[var(--gm-text-tertiary)]">
                {timeAgo(comment.created_at)}
              </span>
              {comment.resolved && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">
                  Resolved
                </span>
              )}
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] resize-none focus:outline-none focus:border-[var(--gm-border-focus)]"
                  rows={2}
                />
                <div className="flex gap-1">
                  <button onClick={handleUpdate} disabled={updateMut.isPending}
                    className="px-3 py-1 rounded text-xs bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] disabled:opacity-50">
                    {updateMut.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setEditContent(comment.content); }}
                    className="px-3 py-1 rounded text-xs text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--gm-text-secondary)] whitespace-pre-wrap">{comment.content}</p>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button onClick={() => { setReplying(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]">
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => { resolveMut.mutate({ id: comment.id, resolved: !comment.resolved }); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]"
                  >
                    {comment.resolved
                      ? <><Circle className="w-3.5 h-3.5" /> Unresolve</>
                      : <><CheckCircle2 className="w-3.5 h-3.5" /> Resolve</>
                    }
                  </button>
                  <button onClick={() => { deleteMut.mutate(comment.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {!editing && (
          <div className="flex items-center gap-2 mt-1.5 ml-10">
            <button
              onClick={() => setReplying(!replying)}
              className="text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-interactive-primary)] transition-colors"
            >
              Reply
            </button>
            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-0.5 text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]"
              >
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {replying && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="ml-10 mt-1 mb-2 overflow-hidden">
            <div className="flex gap-2">
              <input
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)]"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              />
              <button onClick={handleReply} disabled={createMut.isPending || !replyContent.trim()}
                className="p-1.5 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] disabled:opacity-50">
                {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showReplies && replies.map(reply => (
        <CommentItem key={reply.id} comment={reply} targetType={targetType} targetId={targetId} depth={depth + 1} />
      ))}
    </div>
  );
}

interface CommentsPanelProps {
  targetType: string;
  targetId: string;
  title?: string;
  collapsed?: boolean;
}

export function CommentsPanel({ targetType, targetId, title, collapsed: initialCollapsed }: CommentsPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? true);
  const [newComment, setNewComment] = useState('');
  const { data, isLoading } = useComments(targetType, targetId);
  const createMut = useCreateComment();

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createMut.mutate(
      { targetType, targetId, content: newComment.trim() },
      { onSuccess: () => setNewComment('') },
    );
  };

  return (
    <div className="border border-[var(--gm-border-primary)] rounded-xl bg-[var(--gm-surface-primary)] overflow-hidden" style={{ backgroundColor: 'var(--gm-surface-primary)' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--gm-surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--gm-interactive-primary)]" />
          <span className="text-sm font-medium text-[var(--gm-text-primary)]">
            {title || 'Comments'}
          </span>
          {total > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600/10 text-[var(--gm-interactive-primary)] font-medium">
              {total}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-[var(--gm-text-tertiary)]" /> : <ChevronUp className="w-4 h-4 text-[var(--gm-text-tertiary)]" />}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-[var(--gm-border-primary)]">
              <div className="px-4 py-3">
                <div className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)]"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  />
                  <button onClick={handleSubmit} disabled={createMut.isPending || !newComment.trim()}
                    className="px-3 py-2 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] disabled:opacity-50 transition-opacity">
                    {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--gm-interactive-primary)]" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[var(--gm-text-tertiary)]">
                    No comments yet. Be the first to comment.
                  </div>
                ) : (
                  <div className="px-2 pb-2 space-y-1">
                    {comments.map(c => (
                      <CommentItem key={c.id} comment={c} targetType={targetType} targetId={targetId} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CommentsPanel;
