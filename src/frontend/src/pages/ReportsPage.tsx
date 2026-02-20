import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileBarChart, RefreshCw, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, TrendingUp, Download, Calendar, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWeeklyReport, useGenerateWeeklyReport } from '@/hooks/useGodMode';
import { ErrorState } from '@/components/shared/ErrorState';
import { sanitizeHtml } from '@/lib/sanitize';

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof TrendingUp }) {
  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      </div>
      <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value}</p>
    </div>
  );
}

const ReportsPage = () => {
  const [week, setWeek] = useState<string>('');
  const reportQuery = useWeeklyReport(week || undefined);
  const { data, isLoading, refetch } = reportQuery;
  const generateMut = useGenerateWeeklyReport();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const report = data?.report;

  const handleGenerate = async (regenerate = false) => {
    try {
      await generateMut.mutateAsync({ week: week || undefined, regenerate });
      toast.success(regenerate ? 'Report regenerated' : 'Report generated');
      refetch();
    } catch {
      toast.error('Failed to generate report');
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${report.period || 'current'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-[hsl(var(--primary))]" /> Weekly Reports
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            AI-generated weekly status reports with highlights, risks, and KPIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="week"
              value={week}
              onChange={e => setWeek(e.target.value)}
              className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-sm text-[hsl(var(--foreground))]"
            />
          </div>
          <button
            onClick={() => handleGenerate(false)}
            disabled={generateMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </button>
          {report && (
            <>
              <button
                onClick={() => handleGenerate(true)}
                disabled={generateMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </>
          )}
        </div>
      </div>

      {reportQuery.error ? (
        <ErrorState message="Failed to load report." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : !report ? (
        <div className="text-center py-20 space-y-4">
          <FileBarChart className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] opacity-40" />
          <p className="text-[hsl(var(--muted-foreground))]">No report for this period yet.</p>
          <button
            onClick={() => handleGenerate(false)}
            disabled={generateMut.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Weekly Report
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Period & Metadata */}
          <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
            <span>Period: <strong className="text-[hsl(var(--foreground))]">{report.period}</strong></span>
            {report.generated_at && (
              <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
            )}
          </div>

          {/* Summary */}
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-3">Summary</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-line leading-relaxed">
              {report.summary || 'No summary available.'}
            </p>
          </div>

          {/* KPIs */}
          {report.kpis && Object.keys(report.kpis).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3 uppercase tracking-wider">Key Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(report.kpis).map(([key, val]) => (
                  <StatCard key={key} label={key.replace(/_/g, ' ')} value={String(val)} icon={TrendingUp} />
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {report.highlights && report.highlights.length > 0 && (
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" /> Highlights
              </h2>
              <ul className="space-y-2">
                {report.highlights.map((h: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className="text-green-500 mt-0.5">•</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {report.risks && report.risks.length > 0 && (
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Risks & Concerns
              </h2>
              <ul className="space-y-2">
                {report.risks.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className="text-amber-500 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dynamic Sections */}
          {report.sections && Object.keys(report.sections).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider">Detailed Sections</h2>
              {Object.entries(report.sections).map(([key, content]) => {
                const expanded = expandedSections[key] ?? false;
                return (
                  <div key={key} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(key)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-[hsl(var(--secondary))] transition-colors"
                    >
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{key.replace(/_/g, ' ')}</span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
                    </button>
                    {expanded && (
                      <div className="px-5 pb-4 text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-line leading-relaxed border-t border-[hsl(var(--border))]">
                        {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* HTML render */}
          {report.html && (
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-3">Formatted Report</h2>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(report.html) }}
              />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReportsPage;
