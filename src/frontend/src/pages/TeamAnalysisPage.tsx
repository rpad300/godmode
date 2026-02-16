<<<<<<< HEAD
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTeamAnalysisProfiles, useTeamAnalysisOverview, useTeamAnalysisGraph } from '@/hooks/useGodMode';
import { Users, Network, RefreshCw, Zap, TrendingUp, MessageSquare, Filter, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MemberProfileDetail from '@/components/team/MemberProfileDetail';
import TeamSummaryView from '@/components/team/TeamSummaryView';
import { apiClient } from '@/lib/api-client';

type SubTab = 'profiles' | 'dynamics' | 'network';
type ViewMode = 'list' | 'member-detail';

const sentimentLabel = (s: number) => s > 0.6 ? 'Positive' : s > 0.3 ? 'Neutral' : 'Cautious';
const sentimentColor = (s: number) => s > 0.6 ? 'text-emerald-500' : s > 0.3 ? 'text-amber-500' : 'text-destructive';

const TeamAnalysisPage = () => {
  const [subtab, setSubtab] = useState<SubTab>('profiles');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: teamMembers = [], isLoading: profilesLoading } = useTeamAnalysisProfiles();
  const { data: teamOverview, isLoading: overviewLoading } = useTeamAnalysisOverview();
  const { data: graphData, isLoading: graphLoading } = useTeamAnalysisGraph();

  const teamTrendData = teamOverview?.trends || [];
  const teamSummary = teamOverview?.summary || null;

  const roles = useMemo(() => ['all', ...new Set(teamMembers.map((m: any) => m.role).filter(Boolean))], [teamMembers]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m: any) => {
      const sentiment = m.sentiment || 0.5;
      if (filterRole !== 'all' && m.role !== filterRole) return false;
      if (filterSentiment === 'positive' && sentiment <= 0.6) return false;
      if (filterSentiment === 'neutral' && (sentiment <= 0.3 || sentiment > 0.6)) return false;
      if (filterSentiment === 'cautious' && sentiment > 0.3) return false;
      return true;
    });
  }, [filterRole, filterSentiment, teamMembers]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await apiClient.post('/api/team-analysis/team/analyze', { forceReanalysis: true });
      // In a real app we'd invalidate queries here
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMemberClick = (member: any) => {
    setSelectedMember(member);
    setViewMode('member-detail');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedMember(null);
  };

  // Use member data itself if details not separated in API
  const selectedProfile = selectedMember;

  const networkNodes = graphData?.nodes?.map((n: any) => ({
    ...n,
    x: n.x || Math.random() * 400 + 50, // Fallback layout if API doesn't provide coords
    y: n.y || Math.random() * 300 + 50,
    r: n.r || 20
  })) || [];

  const networkEdges = graphData?.edges || [];

  const getNodePos = (name: string) => networkNodes.find((n: any) => n.name === name || n.id === name);

  if (profilesLoading || overviewLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  // If viewing member detail, show that instead
  if (viewMode === 'member-detail' && selectedMember && selectedProfile) {
    return (
      <div className="p-6">
        <MemberProfileDetail member={selectedMember} profile={selectedProfile} onBack={handleBackToList} />
=======
import { useTeamAnalysis } from '../hooks/useGodMode';
import { Users } from 'lucide-react';

export default function TeamAnalysisPage() {
  const { data, isLoading, error } = useTeamAnalysis();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading team analysis...</div>
>>>>>>> origin/claude/migrate-to-react-uJJbl
      </div>
    );
  }

<<<<<<< HEAD
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Team Analysis</h1>
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} /> {isAnalyzing ? 'Analyzing...' : 'Refresh'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" /> Analyze Team
          </button>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit flex-wrap">
        {([
          { id: 'profiles' as SubTab, label: 'Profiles', icon: Users },
          { id: 'dynamics' as SubTab, label: 'Team Dynamics', icon: TrendingUp },
          { id: 'network' as SubTab, label: 'Network Graph', icon: Network },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubtab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subtab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Profiles */}
      {subtab === 'profiles' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r} value={r}>{r === 'all' ? 'All Roles' : r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSentiment} onValueChange={setFilterSentiment}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Filter sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiment</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="cautious">Cautious</SelectItem>
              </SelectContent>
            </Select>
            {(filterRole !== 'all' || filterSentiment !== 'all') && (
              <button onClick={() => { setFilterRole('all'); setFilterSentiment('all'); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear filters
              </button>
            )}
          </div>

          <div className="space-y-3">
            {filteredMembers.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => handleMemberClick(member)}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <span className="text-sm font-bold text-primary">{member.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">{member.name}</h3>
                      <span className="text-xs text-muted-foreground">{member.role}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{member.personality}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <MessageSquare className="w-3 h-3 inline mr-1" />{member.communicationStyle}
                    </p>
                    <div className="flex gap-4 mt-3">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Strengths</p>
                        <div className="flex gap-1 flex-wrap">
                          {member.strengths.map((s) => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Challenges</p>
                        <div className="flex gap-1 flex-wrap">
                          {member.challenges.map((c) => (
                            <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-6 mt-3">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Sentiment: </span>
                        <span className={sentimentColor(member.sentiment)}>{sentimentLabel(member.sentiment)}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Participation: </span>
                        <span className="text-foreground font-medium">{member.participationRate}%</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Meetings: </span>
                        <span className="text-foreground">{member.meetingsAttended}</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${member.participationRate}%` }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No team members match the current filters.</p>
            )}
          </div>
        </>
      )}




      {/* Dynamics */}
      {subtab === 'dynamics' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-base font-semibold text-foreground mb-3">Communication Patterns</h3>
              <div className="space-y-3">
                {[
                  { label: 'Avg. response time', value: '2.3 hours', color: '' },
                  { label: 'Cross-team interactions', value: '34/week', color: '' },
                  { label: 'Decision bottleneck', value: 'CTO (73% of decisions)', color: 'text-destructive' },
                  { label: 'Knowledge sharing sessions', value: '3/week ↑', color: 'text-emerald-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={`text-sm font-medium ${item.color || 'text-foreground'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-base font-semibold text-foreground mb-3">Team Health</h3>
              <div className="space-y-3">
                {[
                  { metric: 'Overall Sentiment', value: 72, color: 'bg-emerald-500' },
                  { metric: 'Collaboration Score', value: 85, color: 'bg-primary' },
                  { metric: 'Workload Balance', value: 58, color: 'bg-amber-500' },
                  { metric: 'Knowledge Distribution', value: 45, color: 'bg-destructive' },
                ].map((m) => (
                  <div key={m.metric}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{m.metric}</span>
                      <span className="font-medium text-foreground">{m.value}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Trend Chart */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-4">Health Trends (6 Weeks)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={teamTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sentiment" stroke="hsl(142 76% 46%)" strokeWidth={2} name="Sentiment" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="collaboration" stroke="hsl(var(--primary))" strokeWidth={2} name="Collaboration" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="workload" stroke="hsl(45 93% 47%)" strokeWidth={2} name="Workload" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="knowledge" stroke="hsl(0 84% 60%)" strokeWidth={2} name="Knowledge" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Recommendations */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-3">Recommendations</h3>
            <div className="space-y-2">
              {[
                { text: 'Redistribute decision-making authority — CTO handles 73% of decisions', type: 'warning' },
                { text: 'Increase participation of Carlos Mendes — only 60% participation rate', type: 'info' },
                { text: 'Knowledge sharing sessions are improving — up from 1/week to 3/week', type: 'success' },
                { text: 'Schedule 1:1s between Pedro Santos and Ana Rodrigues to improve DevOps-Dev collaboration', type: 'info' },
              ].map((rec, i) => (
                <div key={i} className={`text-sm px-3 py-2 rounded-lg ${rec.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                  rec.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-primary/10 text-primary'
                  }`}>
                  {rec.text}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Team Summary (Cohesion, Influence, Alliances, Tensions, etc.) */}
          <TeamSummaryView data={teamSummary} />
        </div>
      )}

      {/* Network */}
      {subtab === 'network' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Team Interaction Network</h3>
          <p className="text-xs text-muted-foreground mb-4">Hover over nodes to highlight connections. Click to view member details.</p>
          <div className="relative h-[420px] flex items-center justify-center">
            <svg viewBox="0 0 500 400" className="w-full h-full max-w-lg">
              {/* Edges */}
              {networkEdges.map((edge, i) => {
                const from = getNodePos(edge.from);
                const to = getNodePos(edge.to);
                if (!from || !to) return null;
                const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
                const isReportsTo = edge.type === 'reports_to';
                return (
                  <line
                    key={i}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={isHighlighted
                      ? (isReportsTo ? 'hsl(200 100% 55%)' : 'hsl(142 76% 46%)')
                      : (isReportsTo ? 'hsl(200 100% 55% / 0.2)' : 'hsl(142 76% 46% / 0.2)')
                    }
                    strokeWidth={isHighlighted ? 3 : 1.5}
                    strokeDasharray={isReportsTo ? undefined : '6 3'}
                    className="transition-all duration-200"
                  />
                );
              })}
              {/* Nodes */}
              {networkNodes.map((node) => {
                const isHovered = hoveredNode === node.name;
                const isConnected = hoveredNode && networkEdges.some(e =>
                  (e.from === hoveredNode && e.to === node.name) || (e.to === hoveredNode && e.from === node.name)
                );
                const isFaded = hoveredNode && !isHovered && !isConnected;
                return (
                  <g
                    key={node.name}
                    onMouseEnter={() => setHoveredNode(node.name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => {
                      const member = teamMembers.find((m: any) => m.name === node.name || m.id === node.name);
                      if (member) handleMemberClick(member);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={node.x} cy={node.y} r={isHovered ? node.r + 4 : node.r}
                      fill={isHovered ? 'hsl(200 100% 55% / 0.3)' : 'hsl(200 100% 55% / 0.1)'}
                      stroke={isFaded ? 'hsl(200 100% 55% / 0.2)' : 'hsl(200 100% 55%)'}
                      strokeWidth={isHovered ? 3 : 2}
                      opacity={isFaded ? 0.3 : 1}
                      className="transition-all duration-200"
                    />
                    <text
                      x={node.x} y={node.y - 4}
                      textAnchor="middle"
                      fill={isFaded ? 'hsl(var(--foreground) / 0.3)' : 'hsl(var(--foreground))'}
                      fontSize={isHovered ? 13 : 11}
                      fontWeight="600"
                      className="transition-all duration-200 pointer-events-none"
                    >
                      {node.short}
                    </text>
                    <text
                      x={node.x} y={node.y + 10}
                      textAnchor="middle"
                      fill={isFaded ? 'hsl(var(--muted-foreground) / 0.3)' : 'hsl(var(--muted-foreground))'}
                      fontSize="9"
                      className="transition-all duration-200 pointer-events-none"
                    >
                      {node.role}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex gap-6 justify-center text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-primary rounded" /> Reports to</span>
            <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '2px dashed' }} /> Works with</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TeamAnalysisPage;
=======
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
>>>>>>> origin/claude/migrate-to-react-uJJbl
