import { useTeamAnalysis } from '../hooks/useGodMode';
import { Users } from 'lucide-react';

export default function TeamAnalysisPage() {
  const { data, isLoading, error } = useTeamAnalysis();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading team analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--destructive))]">Failed to load team analysis.</div>
      </div>
    );
  }

  const profiles = (data as Record<string, unknown>)?.profiles as Array<Record<string, unknown>> | undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team Analysis</h1>
      </div>

      {profiles && profiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile, i) => (
            <div key={i} className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center">
                  <Users className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div>
                  <div className="font-medium">{String(profile.name ?? 'Unknown')}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {String(profile.role ?? '')}
                  </div>
                </div>
              </div>
              {profile.summary && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {String(profile.summary)}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          No team analysis data available. Process some documents first.
        </div>
      )}
    </div>
  );
}
