<<<<<<< HEAD
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, FileText, HelpCircle, AlertTriangle, CheckSquare, GitCommit, Users, AlertCircle, TrendingUp, Shield, Zap, Calendar, Clock, ArrowUpRight, ArrowDownRight, Activity, Filter } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useDashboardData, useProjectMembers, useAllContacts } from '@/hooks/useGodMode';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { GoldenHours } from '@/components/dashboard/GoldenHours';
import type { TabId } from '@/types/godmode';

// Health score calculation
const calculateHealthScore = (stats: any) => {
  if (!stats) return 0;
  // Fallback values if API returns specific structure
  const overdueRatio = stats.totalActions > 0 ? 1 - (stats.overdueActions / stats.totalActions) : 1;
  // Approximation for risks and questions since we only have aggregates or partial lists
  const mitigatedRisksRatio = 0.5; // Placeholder
  const answeredQuestionsRatio = 0.5; // Placeholder
  return Math.round((overdueRatio * 40 + mitigatedRisksRatio * 30 + answeredQuestionsRatio * 30));
};

const cardNavMap: Record<string, TabId> = {
  'Documents': 'files',
  'Facts': 'sot',
  'Questions': 'sot',
  'Risks': 'sot',
  'Actions': 'sot',
  'Decisions': 'sot',
  'People': 'contacts',
  'Overdue': 'sot',
};

interface DashboardPageProps {
  onNavigate?: (tab: TabId) => void;
}

const timeFilters = ['Today', '7 days', '30 days', 'All time'] as const;

const chartConfig = {
  facts: { label: 'Facts', color: 'hsl(165, 80%, 45%)' },
  actions: { label: 'Actions', color: 'hsl(200, 100%, 55%)' },
  questions: { label: 'Questions', color: 'hsl(38, 92%, 55%)' },
  count: { label: 'Count', color: 'hsl(200, 100%, 55%)' },
};

const DashboardPage = ({ onNavigate }: DashboardPageProps) => {
  const [timeFilter, setTimeFilter] = useState<string>('7 days');
  const { data: dashboard, isLoading: isLoadingDashboard, refetch } = useDashboardData();
  const { data: teamMembers, isLoading: isLoadingTeam } = useProjectMembers();
  const { data: allContacts } = useAllContacts();

  const healthScore = calculateHealthScore(dashboard);

  if (isLoadingDashboard) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
=======
import { useNavigate } from 'react-router-dom';
import { useDashboard, useStats } from '../hooks/useGodMode';
import { useProject } from '../hooks/useProject';
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
  FolderOpen,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

const statCards = [
  { key: 'questions', label: 'Questions', icon: HelpCircle, color: '#3b82f6', route: '/sot' },
  { key: 'facts', label: 'Facts', icon: Lightbulb, color: '#10b981', route: '/sot' },
  { key: 'risks', label: 'Risks', icon: AlertTriangle, color: '#f59e0b', route: '/sot' },
  { key: 'actions', label: 'Actions', icon: CheckSquare, color: '#8b5cf6', route: '/sot' },
  { key: 'decisions', label: 'Decisions', icon: Gavel, color: '#ec4899', route: '/sot' },
  { key: 'contacts', label: 'Contacts', icon: Users, color: '#06b6d4', route: '/contacts' },
  { key: 'documents', label: 'Documents', icon: FileText, color: '#6366f1', route: '/files' },
];

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useDashboard();
  const { data: stats, isLoading: statsLoading } = useStats();
  const { projectId } = useProject();
  const navigate = useNavigate();

  // No project selected
  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FolderOpen className="h-16 w-16 text-[hsl(var(--muted-foreground))] mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-[hsl(var(--muted-foreground))] mb-4">
          Select a project from the header dropdown to get started.
        </p>
        <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
>>>>>>> origin/claude/migrate-to-react-uJJbl
      </div>
    );
  }

<<<<<<< HEAD
  const statCards = [
    { label: 'Documents', value: dashboard?.documents?.total || 0, icon: FileText, color: 'text-primary', trend: '+0', up: true },
    { label: 'Facts', value: dashboard?.totalFacts || 0, icon: TrendingUp, color: 'text-accent', trend: '+0', up: true },
    { label: 'Questions', value: dashboard?.totalQuestions || 0, icon: HelpCircle, color: 'text-warning', trend: '+0', up: true },
    { label: 'Risks', value: dashboard?.totalRisks || 0, icon: AlertTriangle, color: 'text-destructive', trend: '0', up: false },
    { label: 'Actions', value: dashboard?.totalActions || 0, icon: CheckSquare, color: 'text-success', trend: '+0', up: true },
    { label: 'Decisions', value: dashboard?.totalDecisions || 0, icon: GitCommit, color: 'text-info', trend: '+0', up: true },
    { label: 'People', value: dashboard?.totalPeople || 0, icon: Users, color: 'text-primary', trend: '0', up: true },
    { label: 'Overdue', value: dashboard?.overdueActions || 0, icon: AlertCircle, color: 'text-destructive', trend: '+0', up: true },
  ];

  /* Charts Data Mapping */
  const actionsByStatus = [
    { name: 'Completed', value: dashboard?.actionsByStatus?.completed || 0, fill: 'hsl(142, 70%, 45%)' },
    { name: 'In Progress', value: dashboard?.actionsByStatus?.in_progress || 0, fill: 'hsl(200, 100%, 55%)' },
    { name: 'Pending', value: dashboard?.actionsByStatus?.pending || 0, fill: 'hsl(38, 92%, 55%)' },
    { name: 'Overdue', value: dashboard?.actionsByStatus?.overdue || 0, fill: 'hsl(0, 72%, 55%)' },
  ];

  const factsByCategory = [
    { category: 'Technical', count: dashboard?.factsByCategory?.technical || 0 },
    { category: 'Process', count: dashboard?.factsByCategory?.process || 0 },
    { category: 'Policy', count: dashboard?.factsByCategory?.policy || 0 },
    { category: 'People', count: dashboard?.factsByCategory?.people || 0 },
    { category: 'Timeline', count: dashboard?.factsByCategory?.timeline || 0 },
  ];

  // Real data from API
  const weeklyActivity = dashboard?.weeklyActivity || [
    { day: 'Mon', facts: 0, actions: 0, questions: 0 },
    { day: 'Tue', facts: 0, actions: 0, questions: 0 },
    { day: 'Wed', facts: 0, actions: 0, questions: 0 },
    { day: 'Thu', facts: 0, actions: 0, questions: 0 },
    { day: 'Fri', facts: 0, actions: 0, questions: 0 },
    { day: 'Sat', facts: 0, actions: 0, questions: 0 },
    { day: 'Sun', facts: 0, actions: 0, questions: 0 },
  ];

  const activeSprint = dashboard?.activeSprint || null;
  const sprintProgress = activeSprint ? activeSprint.progress : 0;
  const sprintStories = activeSprint ? activeSprint.stories : [];

  const healthColor = healthScore >= 70 ? 'text-success' : healthScore >= 40 ? 'text-warning' : 'text-destructive';
  const healthBg = healthScore >= 70 ? 'bg-success/10' : healthScore >= 40 ? 'bg-warning/10' : 'bg-destructive/10';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Project overview · Last updated 2 min ago</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
            {timeFilters.map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${timeFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Health Score + Daily Briefing */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${healthBg} border border-border rounded-xl p-5 flex flex-col items-center justify-center`}
        >
          <div className="relative w-24 h-24 mb-3">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={healthScore >= 70 ? 'hsl(142, 70%, 45%)' : healthScore >= 40 ? 'hsl(38, 92%, 55%)' : 'hsl(0, 72%, 55%)'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${healthScore * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-foreground">Project Health</p>
          <p className="text-xs text-muted-foreground mt-1">
            {healthScore >= 70 ? 'On track' : healthScore >= 40 ? 'Needs attention' : 'Critical'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="md:col-span-2 bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Daily Briefing</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">AI Generated</span>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-1.5"><span className="w-1 h-full min-h-[20px] rounded-full bg-primary flex-shrink-0 mt-0.5" /><span className="text-muted-foreground">📋 <span className="text-foreground font-medium">Project Health: Needs Attention</span> — Despite {dashboard?.totalDecisions || 0} decisions made, there are {dashboard?.totalActions || 0} pending actions and {dashboard?.totalFacts || 0} captured facts.</span></p>
            <p className="flex items-start gap-1.5"><span className="w-1 h-full min-h-[20px] rounded-full bg-destructive flex-shrink-0 mt-0.5" /><span className="text-muted-foreground">⚠️ <span className="text-foreground font-medium">Critical Today:</span> Establish a single, prioritized action register and confirm the top {dashboard?.overdueActions || 0} overdue actions to unblock delivery.</span></p>
            <p className="flex items-start gap-1.5"><span className="w-1 h-full min-h-[20px] rounded-full bg-success flex-shrink-0 mt-0.5" /><span className="text-muted-foreground">📈 <span className="text-foreground font-medium">Trend:</span> Decision-making is outpacing documentation and follow-through.</span></p>
            <p className="flex items-start gap-1.5"><span className="w-1 h-full min-h-[20px] rounded-full bg-success flex-shrink-0 mt-0.5" /><span className="text-muted-foreground">🎯 <span className="text-foreground font-medium">Next Step:</span> Run a 30–45 minute action triage.</span></p>
          </div>

          {/* Analysis */}
          <div className="mt-4 border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📊</span>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Analysis</h3>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>The project currently shows signs of forward motion at the leadership/decision layer ({dashboard?.totalDecisions || 0} decisions made), but the operational layer is lagging ({dashboard?.totalActions || 0} pending actions) with {dashboard?.totalFacts || 0} facts captured. The absence of documented facts creates a traceability vacuum.</p>
              <p>Key concerns center on stakeholder alignment and requirements clarity. With {dashboard?.totalQuestions || 0} pending questions and {dashboard?.totalRisks || 0} open risks, there is a strong possibility that risks and unknowns are simply not being logged rather than truly absent.</p>
              <p>Strategically, focus on tightening the project's execution system and documentation discipline. Prioritize actions by delivery impact and backfill core BA artifacts to restore traceability.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onNavigate?.(cardNavMap[stat.label])}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.trend !== '0' && (
                <span className={`text-[10px] flex items-center gap-0.5 ${stat.up && stat.label !== 'Overdue' ? 'text-success' : 'text-destructive'}`}>
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.trend}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Golden Hours */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <GoldenHours contacts={teamMembers || []} allContacts={allContacts || []} />
      </motion.div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Actions by Status - Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Actions by Status</h2>
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <PieChart>
              <Pie data={actionsByStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                {actionsByStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {actionsByStatus.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                {item.name} ({item.value})
              </div>
            ))}
          </div>
        </motion.div>

        {/* Facts by Category - Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Facts by Category</h2>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={factsByCategory}>
              <XAxis dataKey="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="hsl(165, 80%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </motion.div>

        {/* Weekly Activity - Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Weekly Activity</h2>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart data={weeklyActivity}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="facts" stroke="hsl(165, 80%, 45%)" fill="hsl(165, 80%, 45%)" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="actions" stroke="hsl(200, 100%, 55%)" fill="hsl(200, 100%, 55%)" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="questions" stroke="hsl(38, 92%, 55%)" fill="hsl(38, 92%, 55%)" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </motion.div>
      </div>

      {/* Sprint Progress + Recent Actions + Risks */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Sprint Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{activeSprint?.name || 'No Active Sprint'}</h2>
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progress</span>
              <span className="font-medium text-foreground">{sprintProgress}%</span>
            </div>
            <Progress value={sprintProgress} className="h-2" />
          </div>
          <div className="space-y-2">
            {sprintStories.map((story) => (
              <div key={story.id} className="flex items-center gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${story.status === 'done' ? 'bg-success' :
                  story.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground'
                  }`} />
                <span className={`truncate ${story.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {(story.title || '').replace('As a user, I want to ', '').replace('As an admin, I want to ', '')}
                </span>
              </div>
            ))}
          </div>
          {activeSprint && (
            <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {activeSprint.startDate} → {activeSprint.endDate}
            </div>
          )}
        </motion.div>

        {/* Recent Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Recent Actions</h2>
          <div className="space-y-2.5">
            {(dashboard?.recentActions || []).map((action: any) => (
              <div key={action.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${action.status === 'completed' ? 'bg-success' :
                  action.status === 'overdue' ? 'bg-destructive' :
                    action.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground'
                  }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{action.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{action.owner} · {action.deadline}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${action.status === 'completed' ? 'bg-success/10 text-success' :
                  action.status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                    action.status === 'in_progress' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                  {(action.status || '').replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Risk Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">Risk Overview</h2>
          </div>
          <div className="space-y-2.5">
            {(dashboard?.recentRisks || []).map((risk: any) => (
              <div key={risk.id} className="p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-foreground">{risk.title}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${risk.status === 'mitigated' ? 'bg-success/10 text-success' :
                    risk.impact === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                    }`}>
                    {risk.impact}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{risk.description}</p>
                {risk.mitigation && (
                  <p className="text-[10px] text-accent mt-1">🛡️ {risk.mitigation}</p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h2>
        <div className="grid md:grid-cols-2 gap-2">
          {(dashboard?.recentHistory || []).slice(0, 6).map((entry: any) => (
            <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.status === 'success' ? 'bg-success' :
                entry.status === 'error' ? 'bg-destructive' : 'bg-warning'
                }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{entry.action}: {entry.description}</p>
                <p className="text-[10px] text-muted-foreground">{entry.timestamp} · {entry.duration} · {entry.factsFound} facts</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardPage;
=======
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
            <button
              key={card.key}
              onClick={() => navigate(card.route)}
              className="rounded-lg border bg-[hsl(var(--card))] p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
            >
              <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: card.color }} />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{card.label}</div>
            </button>
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
>>>>>>> origin/claude/migrate-to-react-uJJbl
