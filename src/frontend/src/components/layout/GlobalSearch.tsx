import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Loader2, FileText, Users, Mail, MessageSquare,
  Building2, Calendar, AlertTriangle, HelpCircle, Zap, Target,
  CheckCircle2, ChevronRight,
} from 'lucide-react';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGodMode';

const typeIcons: Record<string, typeof FileText> = {
  fact: CheckCircle2,
  question: HelpCircle,
  risk: AlertTriangle,
  action: Target,
  decision: Zap,
  contact: Users,
  email: Mail,
  conversation: MessageSquare,
  document: FileText,
  company: Building2,
  event: Calendar,
};

const typeColors: Record<string, string> = {
  fact: 'text-green-400',
  question: 'text-blue-400',
  risk: 'text-amber-400',
  action: 'text-purple-400',
  decision: 'text-cyan-400',
  contact: 'text-pink-400',
  email: 'text-indigo-400',
  conversation: 'text-orange-400',
  document: 'text-emerald-400',
  company: 'text-rose-400',
  event: 'text-yellow-400',
};

const typeRoutes: Record<string, string> = {
  fact: '/sot',
  question: '/sot',
  risk: '/sot',
  action: '/sot',
  decision: '/sot',
  contact: '/contacts',
  email: '/emails',
  conversation: '/conversations',
  document: '/files',
  company: '/profile?tab=companies',
  event: '/timeline',
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useGlobalSearch(query, open);
  const results = data?.results ?? [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIdx(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results.length]);

  const handleSelect = useCallback((result: SearchResult) => {
    const route = typeRoutes[result.type] || '/dashboard';
    navigate(route);
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/30 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline text-[10px] bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded font-mono">
          Ctrl+K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[61] w-full max-w-xl"
            >
              <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl overflow-hidden">
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
                  <Search className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search everything..."
                    className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
                  />
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--primary))]" />}
                  <button onClick={() => setOpen(false)} className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {query.length < 2 ? (
                    <div className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                      Type at least 2 characters to search across all entities
                    </div>
                  ) : results.length === 0 && !isLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                      No results found for "{query}"
                    </div>
                  ) : (
                    <div className="py-1">
                      {results.map((r, i) => {
                        const Icon = typeIcons[r.type] || FileText;
                        const color = typeColors[r.type] || 'text-[hsl(var(--muted-foreground))]';
                        return (
                          <button
                            key={r.id}
                            onClick={() => handleSelect(r)}
                            onMouseEnter={() => setSelectedIdx(i)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              selectedIdx === i ? 'bg-[hsl(var(--primary))]/10' : 'hover:bg-[hsl(var(--secondary))]'
                            }`}
                          >
                            <div className={`flex-shrink-0 ${color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{r.title}</p>
                              {r.snippet && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{r.snippet}</p>
                              )}
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] flex-shrink-0 capitalize">
                              {r.type}
                            </span>
                            {selectedIdx === i && (
                              <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--primary))] flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border))] text-[10px] text-[hsl(var(--muted-foreground))]">
                  <div className="flex items-center gap-3">
                    <span><kbd className="bg-[hsl(var(--secondary))] px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
                    <span><kbd className="bg-[hsl(var(--secondary))] px-1 py-0.5 rounded font-mono">↵</kbd> select</span>
                    <span><kbd className="bg-[hsl(var(--secondary))] px-1 py-0.5 rounded font-mono">esc</kbd> close</span>
                  </div>
                  {data?.total != null && data.total > 0 && (
                    <span>{data.total} result{data.total !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
