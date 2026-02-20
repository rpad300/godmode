import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, CheckCheck, Trash2, Loader2, Info, AlertTriangle,
  MessageSquare, FileText, Zap, Clock,
} from 'lucide-react';
import {
  useNotifications,
  useNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  type Notification,
} from '@/hooks/useGodMode';

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
  message: MessageSquare,
  document: FileText,
  ai: Zap,
};

const typeColors: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  message: 'text-[hsl(var(--primary))]',
  document: 'text-green-400',
  ai: 'text-purple-400',
};

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

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useNotifications(100);
  const { data: countData } = useNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notifications = data?.notifications ?? [];
  const unreadCount = countData?.count ?? 0;
  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  const handleMarkRead = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
  };

  const handleDelete = (id: string) => {
    deleteNotif.mutate(id);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-14 right-4 z-50 w-96 max-h-[calc(100vh-5rem)] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[hsl(var(--primary))]" />
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
                    title="Mark all as read"
                  >
                    {markAllRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="flex px-4 pt-2 gap-1">
              {(['all', 'unread'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-[hsl(var(--muted-foreground))] text-sm">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </div>
              ) : (
                filtered.map(n => {
                  const Icon = typeIcons[n.type] || Info;
                  const color = typeColors[n.type] || 'text-[hsl(var(--muted-foreground))]';
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                        n.read
                          ? 'hover:bg-[hsl(var(--secondary))]'
                          : 'bg-[hsl(var(--primary))]/5 hover:bg-[hsl(var(--primary))]/10'
                      }`}
                      onClick={() => handleMarkRead(n)}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {n.title && (
                          <p className={`text-xs font-medium ${n.read ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
                            {n.title}
                          </p>
                        )}
                        <p className={`text-xs ${n.read ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'} line-clamp-2`}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                          <Clock className="w-3 h-3" />
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!n.read && (
                          <button
                            onClick={e => { e.stopPropagation(); markRead.mutate(n.id); }}
                            className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                          className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
