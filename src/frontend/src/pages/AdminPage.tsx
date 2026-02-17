/**
 * Purpose:
 *   Admin-only page for platform oversight: system statistics, LLM provider
 *   configuration status, and audit log of data changes.
 *
 * Responsibilities:
 *   - System Stats tab: display key-value stat cards (user counts, document counts, etc.)
 *   - LLM Providers tab: list configured providers with enabled/disabled and health status badges
 *   - Audit Log tab: chronological list of data mutation events with operation, table, user, timestamp
 *
 * Key dependencies:
 *   - useAdminStats / useAdminProviders / useAdminAuditLog (useGodMode): admin-scoped API hooks
 *   - Badge component: status and variant indicators
 *
 * Side effects:
 *   - Network: fetches admin stats, provider list, and audit log entries
 *
 * Notes:
 *   - All three hooks fail gracefully with "You may not have admin access" messages,
 *     effectively serving as a soft auth guard.
 *   - Assumption: admin access is enforced server-side; no client-side role check here.
 */
import { useState } from 'react';
import { Shield, Activity, Server, FileText, Clock } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { useAdminStats, useAdminProviders, useAdminAuditLog } from '../hooks/useGodMode';

type AdminTab = 'stats' | 'providers' | 'audit';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');

  const stats = useAdminStats();
  const providers = useAdminProviders();
  const audit = useAdminAuditLog();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { key: 'stats' as AdminTab, label: 'System Stats', icon: Activity },
          { key: 'providers' as AdminTab, label: 'LLM Providers', icon: Server },
          { key: 'audit' as AdminTab, label: 'Audit Log', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* System Stats */}
      {activeTab === 'stats' && (
        <div>
          {stats.isLoading ? (
            <div className="text-[hsl(var(--muted-foreground))]">Loading stats...</div>
          ) : stats.error ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              Unable to load system stats. You may not have admin access.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(stats.data ?? {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border bg-[hsl(var(--card))] p-4">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {typeof value === 'number' ? value.toLocaleString() : String(value ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LLM Providers */}
      {activeTab === 'providers' && (
        <div>
          {providers.isLoading ? (
            <div className="text-[hsl(var(--muted-foreground))]">Loading providers...</div>
          ) : providers.error ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              Unable to load LLM providers. You may not have admin access.
            </div>
          ) : (
            <div className="space-y-3">
              {(providers.data ?? []).map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-lg border bg-[hsl(var(--card))] p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {provider.name}
                      <Badge
                        variant={provider.enabled ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {provider.status && (
                        <Badge
                          variant={
                            provider.status === 'healthy'
                              ? 'default'
                              : provider.status === 'degraded'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="text-[10px]"
                        >
                          {provider.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Models: {provider.models.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
              {(providers.data ?? []).length === 0 && (
                <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
                  No LLM providers configured.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <div>
          {audit.isLoading ? (
            <div className="text-[hsl(var(--muted-foreground))]">Loading audit log...</div>
          ) : audit.error ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              Unable to load audit log. You may not have admin access.
            </div>
          ) : (
            <div className="space-y-2">
              {(audit.data ?? []).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border bg-[hsl(var(--card))] p-3 flex items-center gap-3"
                >
                  <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <Badge variant="outline" className="text-[10px] mr-2">
                        {entry.operation}
                      </Badge>
                      {entry.table_name}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {entry.changed_by_email ?? 'System'} &middot;{' '}
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {(audit.data ?? []).length === 0 && (
                <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
                  No audit log entries.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
