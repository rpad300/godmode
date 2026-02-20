import { useState } from 'react';
import {
  Zap, Brain, BarChart3, Sparkles, Trash2, Tag, Search,
  RefreshCw, Loader2, AlertTriangle, Activity, Database, Cpu,
  Download, ThumbsUp, ThumbsDown, GitMerge, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { ErrorState } from '../components/shared/ErrorState';
import {
  useOptimizationsAnalytics,
  useOptimizationsInsights,
  useOptimizationsSummary,
  useOptimizationsDigest,
  useOptimizationsHealth,
  useOptimizationsHealthSummary,
  useOptimizationsSuggestions,
  useOptimizationsUsage,
  useOptimizationsCacheStats,
  useOptimizationsDedup,
  useOptimizationsTag,
  useOptimizationsNER,
  useOptimizationsContextOptimize,
  useOptimizationsCacheClear,
  useOptimizationsFeedbackStats,
  useOptimizationsResolveDuplicates,
  useOptimizationsFeedback,
} from '../hooks/useGodMode';

type Tab = 'overview' | 'tools' | 'insights' | 'digest';

const TAB_LIST: { key: Tab; label: string; icon: typeof Zap }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'tools', label: 'AI Tools', icon: Brain },
  { key: 'insights', label: 'Insights', icon: Sparkles },
  { key: 'digest', label: 'Digest', icon: Zap },
];

function DataCard({ title, icon: Icon, data, isLoading, isError, refetch }: {
  title: string;
  icon: typeof Zap;
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch?: () => void;
}) {
  if (isLoading) {
    return (
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
        <ErrorState message={`Failed to load ${title.toLowerCase()}.`} onRetry={refetch} />
      </div>
    );
  }

  const entries = data && typeof data === 'object' && !Array.isArray(data)
    ? Object.entries(data as Record<string, unknown>).filter(([, v]) => v != null)
    : [];

  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gm-interactive-primary" />
        <h3 className="text-xs font-semibold text-gm-text-primary">{title}</h3>
      </div>
      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="text-gm-text-tertiary capitalize shrink-0">{key.replace(/[_-]/g, ' ')}</span>
              <span className="text-gm-text-primary text-right break-all">
                {typeof val === 'object' ? JSON.stringify(val, null, 0) : String(val)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gm-text-tertiary">No data available</p>
      )}
    </div>
  );
}

function ArrayCard({ title, icon: Icon, data, isLoading, isError, refetch }: {
  title: string;
  icon: typeof Zap;
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch?: () => void;
}) {
  if (isLoading) {
    return (
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
        <ErrorState message={`Failed to load ${title.toLowerCase()}.`} onRetry={refetch} />
      </div>
    );
  }

  const items = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [];

  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gm-interactive-primary" />
        <h3 className="text-xs font-semibold text-gm-text-primary">{title}</h3>
        <span className="text-[10px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full ml-auto">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="bg-gm-surface-secondary rounded-lg p-3 border border-[var(--gm-border-primary)]">
              {typeof item === 'object' && item !== null ? (
                <div className="space-y-1.5">
                  {Object.entries(item as Record<string, unknown>).filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} className="text-[11px]">
                      <span className="text-gm-text-tertiary capitalize">{k.replace(/[_-]/g, ' ')}: </span>
                      <span className="text-gm-text-primary">
                        {typeof v === 'object' ? JSON.stringify(v, null, 0) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gm-text-primary">{String(item)}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gm-text-tertiary">No items available</p>
      )}
    </div>
  );
}

function OverviewTab() {
  const healthSummary = useOptimizationsHealthSummary();
  const usage = useOptimizationsUsage();
  const cache = useOptimizationsCacheStats();
  const analytics = useOptimizationsAnalytics();
  const health = useOptimizationsHealth();
  const feedback = useOptimizationsFeedbackStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <DataCard title="Health Summary" icon={Activity} data={healthSummary.data} isLoading={healthSummary.isLoading} isError={healthSummary.isError} refetch={healthSummary.refetch} />
      <DataCard title="Health Metrics" icon={Cpu} data={health.data} isLoading={health.isLoading} isError={health.isError} refetch={health.refetch} />
      <DataCard title="Usage Stats" icon={BarChart3} data={usage.data} isLoading={usage.isLoading} isError={usage.isError} refetch={usage.refetch} />
      <DataCard title="Cache Stats" icon={Database} data={cache.data} isLoading={cache.isLoading} isError={cache.isError} refetch={cache.refetch} />
      <DataCard title="Analytics" icon={BarChart3} data={analytics.data} isLoading={analytics.isLoading} isError={analytics.isError} refetch={analytics.refetch} />
      <DataCard title="Feedback Stats" icon={Sparkles} data={feedback.data} isLoading={feedback.isLoading} isError={feedback.isError} refetch={feedback.refetch} />
    </div>
  );
}

function ToolsTab() {
  const dedup = useOptimizationsDedup();
  const resolveDuplicates = useOptimizationsResolveDuplicates();
  const autoTag = useOptimizationsTag();
  const ner = useOptimizationsNER();
  const contextOpt = useOptimizationsContextOptimize();
  const cacheClear = useOptimizationsCacheClear();

  const [nerText, setNerText] = useState('');
  const [nerResult, setNerResult] = useState<unknown>(null);
  const [ctxQuery, setCtxQuery] = useState('');
  const [ctxResult, setCtxResult] = useState<unknown>(null);
  const [dedupResult, setDedupResult] = useState<unknown>(null);

  const handleDedup = () => {
    dedup.mutate(undefined, {
      onSuccess: (data) => {
        toast.success('Deduplication scan completed');
        setDedupResult(data);
      },
      onError: () => toast.error('Deduplication failed'),
    });
  };

  const handleResolveDuplicates = () => {
    const result = dedupResult as Record<string, unknown> | null;
    const ids = (result?.duplicate_ids ?? result?.ids ?? []) as string[];
    if (ids.length === 0) {
      toast.info('Run dedup scan first to find duplicates');
      return;
    }
    resolveDuplicates.mutate({ ids }, {
      onSuccess: () => { toast.success('Duplicates resolved'); setDedupResult(null); },
      onError: () => toast.error('Failed to resolve duplicates'),
    });
  };

  const handleAutoTag = () => {
    autoTag.mutate({}, {
      onSuccess: () => toast.success('Auto-tagging completed'),
      onError: () => toast.error('Auto-tagging failed'),
    });
  };

  const handleNER = () => {
    if (!nerText.trim()) return;
    ner.mutate({ text: nerText }, {
      onSuccess: (data) => { setNerResult(data); toast.success('NER analysis complete'); },
      onError: () => toast.error('NER analysis failed'),
    });
  };

  const handleContextOptimize = () => {
    if (!ctxQuery.trim()) return;
    contextOpt.mutate({ query: ctxQuery }, {
      onSuccess: (data) => { setCtxResult(data); toast.success('Context optimized'); },
      onError: () => toast.error('Context optimization failed'),
    });
  };

  const handleCacheClear = () => {
    cacheClear.mutate(undefined, {
      onSuccess: () => toast.success('Cache cleared'),
      onError: () => toast.error('Failed to clear cache'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-gm-interactive-primary" />
            <h3 className="text-xs font-semibold text-gm-text-primary">Deduplication</h3>
          </div>
          <p className="text-[11px] text-gm-text-tertiary">Scan and merge duplicate entities across the knowledge base.</p>
          <div className="flex gap-2">
            <button onClick={handleDedup} disabled={dedup.isPending}
              className="flex-1 px-3 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
              {dedup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Scan
            </button>
            <button onClick={handleResolveDuplicates} disabled={resolveDuplicates.isPending || !dedupResult}
              className="flex-1 px-3 py-2 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover border border-gm-border-primary disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
              {resolveDuplicates.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
              Resolve
            </button>
          </div>
          {dedupResult && (
            <div className="bg-gm-surface-secondary rounded-lg p-2 border border-[var(--gm-border-primary)]">
            <ResultDisplay data={dedupResult} />
            </div>
          )}
        </div>

        <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gm-interactive-primary" />
            <h3 className="text-xs font-semibold text-gm-text-primary">Auto-Tag</h3>
          </div>
          <p className="text-[11px] text-gm-text-tertiary">Automatically classify and tag all entities using AI.</p>
          <button onClick={handleAutoTag} disabled={autoTag.isPending}
            className="w-full px-3 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
            {autoTag.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
            Run Auto-Tag
          </button>
        </div>

        <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-gm-status-danger" />
            <h3 className="text-xs font-semibold text-gm-text-primary">Clear Cache</h3>
          </div>
          <p className="text-[11px] text-gm-text-tertiary">Purge all optimization caches. Data will be re-computed on next request.</p>
          <button onClick={handleCacheClear} disabled={cacheClear.isPending}
            className="w-full px-3 py-2 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover border border-gm-border-primary disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
            {cacheClear.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear Cache
          </button>
        </div>
      </div>

      {/* NER Tool */}
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gm-interactive-primary" />
          <h3 className="text-xs font-semibold text-gm-text-primary">Named Entity Recognition</h3>
        </div>
        <p className="text-[11px] text-gm-text-tertiary">Extract named entities (people, orgs, locations, etc.) from text.</p>
        <div className="flex gap-2">
          <input
            value={nerText} onChange={e => setNerText(e.target.value)}
            placeholder="Paste text to analyze..."
            className="flex-1 px-3 py-2 bg-gm-surface-primary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary placeholder:text-gm-text-tertiary focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
          />
          <button onClick={handleNER} disabled={ner.isPending || !nerText.trim()}
            className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors shrink-0">
            {ner.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Analyze
          </button>
        </div>
        {nerResult && (
          <div className="bg-gm-surface-secondary rounded-lg p-3 border border-[var(--gm-border-primary)]">
            <ResultDisplay data={nerResult} />
          </div>
        )}
      </div>

      {/* Context Optimize Tool */}
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-gm-interactive-primary" />
          <h3 className="text-xs font-semibold text-gm-text-primary">Context Optimization</h3>
        </div>
        <p className="text-[11px] text-gm-text-tertiary">Optimize RAG context retrieval for a given query.</p>
        <div className="flex gap-2">
          <input
            value={ctxQuery} onChange={e => setCtxQuery(e.target.value)}
            placeholder="Enter query to optimize context for..."
            className="flex-1 px-3 py-2 bg-gm-surface-primary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary placeholder:text-gm-text-tertiary focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
          />
          <button onClick={handleContextOptimize} disabled={contextOpt.isPending || !ctxQuery.trim()}
            className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors shrink-0">
            {contextOpt.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            Optimize
          </button>
        </div>
        {ctxResult && (
          <div className="bg-gm-surface-secondary rounded-lg p-3 border border-[var(--gm-border-primary)]">
            <ResultDisplay data={ctxResult} />
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsTab() {
  const insights = useOptimizationsInsights();
  const suggestions = useOptimizationsSuggestions();
  const feedback = useOptimizationsFeedback();
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = () => {
    if (!feedbackText.trim() || !feedbackRating) return;
    feedback.mutate({ message: feedbackText, rating: feedbackRating, category: 'general' }, {
      onSuccess: () => { toast.success('Feedback submitted'); setFeedbackText(''); setFeedbackRating(null); },
      onError: () => toast.error('Failed to submit feedback'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ArrayCard title="Insights" icon={Sparkles} data={insights.data} isLoading={insights.isLoading} isError={insights.isError} refetch={insights.refetch} />
        <ArrayCard title="Suggestions" icon={AlertTriangle} data={suggestions.data} isLoading={suggestions.isLoading} isError={suggestions.isError} refetch={suggestions.refetch} />
      </div>

      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gm-interactive-primary" />
          <h3 className="text-xs font-semibold text-gm-text-primary">Submit Feedback</h3>
        </div>
        <p className="text-[11px] text-gm-text-tertiary">Help improve optimization suggestions by providing feedback.</p>
        <div className="flex gap-2">
          <button onClick={() => setFeedbackRating(feedbackRating === 'positive' ? null : 'positive')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border',
              feedbackRating === 'positive' ? 'bg-green-500/10 border-green-500/30 text-gm-status-success' : 'border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
            <ThumbsUp className="w-3.5 h-3.5" /> Helpful
          </button>
          <button onClick={() => setFeedbackRating(feedbackRating === 'negative' ? null : 'negative')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border',
              feedbackRating === 'negative' ? 'bg-red-500/10 border-red-500/30 text-gm-status-danger' : 'border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
            <ThumbsDown className="w-3.5 h-3.5" /> Not Helpful
          </button>
        </div>
        <div className="flex gap-2">
          <input value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
            placeholder="Describe your experience or suggestion..."
            className="flex-1 px-3 py-2 bg-gm-surface-primary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary placeholder:text-gm-text-tertiary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
          <button onClick={handleFeedback} disabled={feedback.isPending || !feedbackText.trim() || !feedbackRating}
            className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors shrink-0">
            {feedback.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function DigestTab() {
  const digest = useOptimizationsDigest();
  const summary = useOptimizationsSummary();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-gm-interactive-primary" />
          <h3 className="text-xs font-semibold text-gm-text-primary">Periodic Digest</h3>
        </div>
        {digest.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary" />
          </div>
        ) : digest.isError ? (
          <ErrorState message="Failed to load digest." onRetry={digest.refetch} />
        ) : (
          <ResultDisplay data={digest.data} />
        )}
      </div>

      <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-gm-interactive-primary" />
          <h3 className="text-xs font-semibold text-gm-text-primary">AI Project Summary</h3>
        </div>
        {summary.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary" />
          </div>
        ) : summary.isError ? (
          <ErrorState message="Failed to load summary." onRetry={summary.refetch} />
        ) : (
          <ResultDisplay data={summary.data} />
        )}
      </div>
    </div>
  );
}

function ResultDisplay({ data }: { data: unknown }) {
  if (data == null) return <p className="text-[11px] text-gm-text-tertiary">No data</p>;

  if (typeof data === 'string') {
    return <p className="text-[11px] text-gm-text-primary whitespace-pre-wrap">{data}</p>;
  }

  if (Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-2 border border-[var(--gm-border-primary)]">
            <ResultDisplay data={item} />
          </div>
        ))}
        {data.length === 0 && <p className="text-[11px] text-gm-text-tertiary">Empty list</p>}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>).filter(([, v]) => v != null);
    return (
      <div className="space-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="text-[11px]">
            <span className="text-gm-text-tertiary capitalize font-medium">{key.replace(/[_-]/g, ' ')}: </span>
            {typeof val === 'object' ? (
              <div className="ml-3 mt-1"><ResultDisplay data={val} /></div>
            ) : (
              <span className="text-gm-text-primary">{String(val)}</span>
            )}
          </div>
        ))}
        {entries.length === 0 && <p className="text-[11px] text-gm-text-tertiary">Empty object</p>}
      </div>
    );
  }

  return <p className="text-[11px] text-gm-text-primary">{String(data)}</p>;
}

export default function OptimizationsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showExport, setShowExport] = useState(false);

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/optimizations/export/${format}`, '_blank');
    setShowExport(false);
    toast.success(`Exporting as ${format.toUpperCase()}`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-gm-interactive-primary" />
          <h1 className="text-base font-bold text-gm-text-primary">Optimizations</h1>
          <span className="text-[10px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full">
            AI-Powered
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Export */}
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)}
              className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-secondary text-[10px] font-medium hover:bg-gm-surface-hover border border-gm-border-primary flex items-center gap-1.5 transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
            {showExport && (
              <div className="absolute right-0 mt-1 bg-gm-surface-primary border border-gm-border-primary rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
                <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-1.5 text-[10px] text-gm-text-primary hover:bg-gm-surface-hover">JSON</button>
                <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-1.5 text-[10px] text-gm-text-primary hover:bg-gm-surface-hover">CSV</button>
              </div>
            )}
          </div>

          {/* Tab Bar */}
          <div className="flex bg-gm-surface-secondary rounded-lg border border-gm-border-primary overflow-hidden">
            {TAB_LIST.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-medium flex items-center gap-1 transition-colors',
                    tab === t.key
                      ? 'bg-gm-interactive-primary text-gm-text-on-brand'
                      : 'text-gm-text-tertiary hover:text-gm-text-primary',
                  )}>
                  <Icon className="w-3 h-3" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab />}
      {tab === 'tools' && <ToolsTab />}
      {tab === 'insights' && <InsightsTab />}
      {tab === 'digest' && <DigestTab />}
    </div>
  );
}
