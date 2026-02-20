import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Filter, Database, RefreshCw, Loader2,
  FileText, Mail, MessageCircle, Users, HelpCircle,
  AlertTriangle, CheckCircle, Zap, X,
  ChevronRight, BarChart3, Clock, Star,
} from 'lucide-react';
import {
  useSearchFulltext,
  useSearchSuggest,
  useSearchStats,
  useSearchIndex,
  useGlobalSearch,
  type SearchResult,
} from '../hooks/useGodMode';
import { ErrorState } from '../components/shared/ErrorState';
import { cn } from '../lib/utils';

const TYPE_CONFIG: Record<string, { color: string; icon: typeof FileText; label: string }> = {
  documents:     { color: '#06b6d4', icon: FileText,        label: 'Document' },
  emails:        { color: '#f97316', icon: Mail,             label: 'Email' },
  conversations: { color: '#8b5cf6', icon: MessageCircle,    label: 'Conversation' },
  contacts:      { color: '#ec4899', icon: Users,            label: 'Contact' },
  facts:         { color: '#f59e0b', icon: Star,             label: 'Fact' },
  decisions:     { color: '#a855f7', icon: CheckCircle,      label: 'Decision' },
  risks:         { color: '#ef4444', icon: AlertTriangle,    label: 'Risk' },
  actions:       { color: '#22c55e', icon: Zap,              label: 'Action' },
  questions:     { color: '#3b82f6', icon: HelpCircle,       label: 'Question' },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG);

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: suggestions, isFetching: suggestLoading } = useSearchSuggest(debouncedQuery);
  const { data: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useSearchStats();
  const searchMut = useSearchFulltext();
  const indexMut = useSearchIndex();

  const results: SearchResult[] = useMemo(() => {
    const raw = searchMut.data as { results?: SearchResult[] } | undefined;
    return raw?.results ?? [];
  }, [searchMut.data]);

  const totalResults = useMemo(() => {
    const raw = searchMut.data as { total?: number } | undefined;
    return raw?.total ?? results.length;
  }, [searchMut.data, results.length]);

  const executeSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    searchMut.mutate({
      query: searchQuery.trim(),
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      limit: 50,
    });
  }, [searchQuery, selectedTypes, searchMut]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') executeSearch();
    if (e.key === 'Escape') setShowSuggestions(false);
  }, [executeSearch]);

  const toggleType = useCallback((type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const applySuggestion = useCallback((text: string) => {
    setSearchQuery(text);
    setShowSuggestions(false);
    searchMut.mutate({
      query: text,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      limit: 50,
    });
  }, [selectedTypes, searchMut]);

  const suggestionItems: string[] = useMemo(() => {
    const raw = suggestions as { suggestions?: string[] } | undefined;
    return raw?.suggestions ?? [];
  }, [suggestions]);

  const stats = useMemo(() => statsData as Record<string, unknown> | undefined, [statsData]);

  const handleRebuildIndex = useCallback(() => {
    indexMut.mutate(undefined, { onSuccess: () => refetchStats() });
  }, [indexMut, refetchStats]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Search Header */}
      <div className="shrink-0 border-b border-gm-border-primary bg-gm-surface-primary sticky top-0 z-20">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-base font-bold text-gm-text-primary">Search</h1>
            <span className="text-[10px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full">
              Full-text
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gm-text-tertiary" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (debouncedQuery.length >= 2) setShowSuggestions(true); }}
                placeholder="Search across all project data..."
                aria-label="Search across all project data"
                className="w-full pl-10 pr-10 py-2.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-sm text-gm-text-primary placeholder:text-gm-text-tertiary focus:outline-none focus:ring-2 focus:ring-gm-border-focus transition-colors"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gm-surface-hover">
                  <X className="w-3.5 h-3.5 text-gm-text-tertiary" />
                </button>
              )}

              {/* Suggestions Dropdown */}
              {showSuggestions && debouncedQuery.length >= 2 && (suggestionItems.length > 0 || suggestLoading) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gm-surface-primary border border-gm-border-primary rounded-lg shadow-lg z-30 overflow-hidden">
                  {suggestLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gm-text-tertiary" />
                      <span className="text-xs text-gm-text-tertiary">Loading suggestions...</span>
                    </div>
                  ) : (
                    suggestionItems.map((s, i) => (
                      <button key={i} onClick={() => applySuggestion(s)}
                        className="w-full text-left px-3 py-2 text-xs text-gm-text-primary hover:bg-gm-surface-secondary transition-colors flex items-center gap-2">
                        <Search className="w-3 h-3 text-gm-text-tertiary shrink-0" />
                        <span className="truncate">{s}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button onClick={executeSearch} disabled={!searchQuery.trim() || searchMut.isPending}
              className="px-4 py-2.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 disabled:opacity-50 transition-colors">
              {searchMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </button>

            <button onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={cn('px-3 py-2.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors',
                showFilters
                  ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary'
                  : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
              <Filter className="w-3.5 h-3.5" />
              Filters
              {selectedTypes.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-gm-interactive-primary text-gm-text-on-brand text-[9px] leading-none">
                  {selectedTypes.length}
                </span>
              )}
            </button>

            <button onClick={() => setShowStats(!showStats)}
              aria-expanded={showStats}
              className={cn('px-3 py-2.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors',
                showStats
                  ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary'
                  : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
              <Database className="w-3.5 h-3.5" />
              Index
            </button>
          </div>
        </div>

        {/* Filters Row */}
        {showFilters && (
          <div className="flex items-center gap-1.5 px-5 py-2.5 border-t border-gm-border-primary bg-[var(--gm-surface-hover)] flex-wrap">
            <span className="text-[10px] text-gm-text-tertiary font-medium mr-1">Types:</span>
            {ALL_TYPES.map(type => {
              const cfg = TYPE_CONFIG[type];
              const active = selectedTypes.length === 0 || selectedTypes.includes(type);
              return (
                <button key={type} onClick={() => toggleType(type)}
                  aria-pressed={active}
                  className={cn('px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors border flex items-center gap-1',
                    active
                      ? 'border-current/20 text-gm-text-primary'
                      : 'border-gm-border-primary text-gray-500 line-through')}
                  style={{
                    backgroundColor: active ? `${cfg.color}15` : undefined,
                    color: active ? cfg.color : undefined,
                  }}>
                  <cfg.icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              );
            })}
            {selectedTypes.length > 0 && (
              <button onClick={() => setSelectedTypes([])}
                className="px-2 py-1 rounded-md text-[10px] font-medium text-gm-text-tertiary hover:text-gm-text-primary transition-colors">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Results Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading State */}
          {searchMut.isPending && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary mx-auto mb-3" />
                <p className="text-xs text-gm-text-tertiary">Searching...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {searchMut.isError && (
            <div className="px-5 py-8">
              <ErrorState
                message="Search failed. Please try again."
                onRetry={executeSearch}
              />
            </div>
          )}

          {/* Results */}
          {searchMut.isSuccess && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gm-text-tertiary">
                  <span className="font-medium text-gm-text-primary">{totalResults}</span> result{totalResults !== 1 ? 's' : ''} for{' '}
                  <span className="font-medium text-gm-text-primary">"{searchQuery}"</span>
                </p>
              </div>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="h-12 w-12 text-gray-600 mb-4" />
                  <p className="text-sm text-gm-text-tertiary mb-1">No results found</p>
                  <p className="text-xs text-gray-400">Try different keywords or remove some filters</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map(result => {
                    const typeCfg = TYPE_CONFIG[result.type] ?? TYPE_CONFIG.documents;
                    const Icon = typeCfg?.icon ?? FileText;
                    const color = typeCfg?.color ?? '#64748b';
                    const label = typeCfg?.label ?? result.type;
                    const source = result.metadata?.source as string | undefined;
                    const timestamp = result.metadata?.timestamp as string | undefined;

                    return (
                      <div key={result.id}
                        className="group p-4 rounded-lg border border-gm-border-primary bg-gm-surface-primary hover:bg-gm-surface-secondary transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${color}15` }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${color}15`, color }}>
                                {label}
                              </span>
                              {result.score != null && (
                                <span className="text-[10px] text-gm-text-tertiary flex items-center gap-0.5">
                                  <BarChart3 className="w-3 h-3" />
                                  {(result.score * 100).toFixed(0)}%
                                </span>
                              )}
                              {timestamp && (
                                <span className="text-[10px] text-gm-text-tertiary flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" />
                                  {new Date(timestamp).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-medium text-gm-text-primary truncate group-hover:text-gm-interactive-primary transition-colors">
                              {result.title}
                            </h3>
                            {result.snippet && (
                              <p className="text-xs text-gm-text-tertiary mt-1 line-clamp-2 leading-relaxed">
                                {result.snippet}
                              </p>
                            )}
                            {source && (
                              <p className="text-[10px] text-gray-400 mt-1.5 truncate">
                                Source: {source}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty / Idle State */}
          {searchMut.isIdle && (
            <div className="flex flex-col items-center justify-center h-full text-center px-5">
              <Search className="h-16 w-16 text-gray-600 mb-5" />
              <p className="text-sm font-medium text-gm-text-secondary mb-1">Search your project</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Search across documents, emails, conversations, contacts, and all extracted insights
              </p>
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        {showStats && (
          <div className="hidden md:block w-72 shrink-0 border-l border-gm-border-primary bg-gm-surface-primary overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gm-text-primary flex items-center gap-1.5">
                  <Database className="w-4 h-4" /> Search Index
                </h3>
                <button onClick={() => setShowStats(false)}
                  aria-label="Close index panel"
                  className="p-1 rounded hover:bg-gm-surface-secondary">
                  <X className="w-3.5 h-3.5 text-gm-text-tertiary" />
                </button>
              </div>

              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary" />
                </div>
              ) : statsError ? (
                <ErrorState message="Failed to load index stats." onRetry={() => refetchStats()} />
              ) : stats ? (
                <div className="space-y-3">
                  {Object.entries(stats).filter(([k]) => k !== 'ok').map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-gm-border-primary last:border-0">
                      <span className="text-[10px] text-gm-text-tertiary capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-medium text-gm-text-primary">
                        {typeof value === 'number' ? value.toLocaleString() : String(value ?? '-')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gm-text-tertiary text-center py-4">No stats available</p>
              )}

              <button onClick={handleRebuildIndex} disabled={indexMut.isPending}
                className="w-full px-3 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors">
                {indexMut.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding...</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild Index</>
                }
              </button>
              {indexMut.isSuccess && (
                <p className="text-[10px] text-gm-status-success text-center">Index rebuilt successfully</p>
              )}
              {indexMut.isError && (
                <p className="text-[10px] text-gm-status-danger text-center">Rebuild failed. Try again.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
