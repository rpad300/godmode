import { useDashboard, useStats } from '../hooks/useGodMode';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  CheckSquare,
  Gavel,
  Users,
  FileText,
} from 'lucide-react';

const statCards = [
  { key: 'questions', label: 'Questions', icon: HelpCircle, color: '#3b82f6' },
  { key: 'facts', label: 'Facts', icon: Lightbulb, color: '#10b981' },
  { key: 'risks', label: 'Risks', icon: AlertTriangle, color: '#f59e0b' },
  { key: 'actions', label: 'Actions', icon: CheckSquare, color: '#8b5cf6' },
  { key: 'decisions', label: 'Decisions', icon: Gavel, color: '#ec4899' },
  { key: 'contacts', label: 'Contacts', icon: Users, color: '#06b6d4' },
  { key: 'documents', label: 'Documents', icon: FileText, color: '#6366f1' },
];

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useDashboard();
  const { data: stats, isLoading: statsLoading } = useStats();

  if (dashLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading dashboard...</div>
      </div>
    );
  }

  const counters = dashboard?.stats ?? (stats as Record<string, unknown>) ?? {};

  const chartData = statCards.map((s) => ({
    name: s.label,
    count: (counters[s.key] as number) ?? 0,
    fill: s.color,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = (counters[card.key] as number) ?? 0;
          return (
            <div
              key={card.key}
              className="rounded-lg border bg-[hsl(var(--card))] p-4 text-center"
            >
              <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: card.color }} />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Bar Chart */}
      <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
        <h2 className="text-lg font-semibold mb-4">Knowledge Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity */}
      {dashboard?.recentActivity && dashboard.recentActivity.length > 0 && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4 mt-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <ul className="space-y-2">
            {dashboard.recentActivity.map((activity, i) => (
              <li key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <span>{activity.description}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
