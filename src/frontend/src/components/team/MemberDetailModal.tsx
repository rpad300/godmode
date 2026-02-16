import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useState } from 'react';
import { User, Brain, MessageSquare, TrendingUp, BarChart3, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TeamMember } from '@/data/mock-data';
import { generateSentimentHistory, generateParticipationHistory } from '@/data/team-analysis-data';

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const sentimentLabel = (s: number) => s > 0.6 ? 'Positive' : s > 0.3 ? 'Neutral' : 'Cautious';

interface MemberDetailModalProps {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
}

const MemberDetailModal = ({ member, open, onClose }: MemberDetailModalProps) => {
  const [tab, setTab] = useState('overview');

  if (!member) return null;

  const sentimentHistory = generateSentimentHistory(member);
  const participationHistory = generateParticipationHistory(member);

  const radarData = [
    { subject: 'Participation', value: member.participationRate },
    { subject: 'Sentiment', value: member.sentiment * 100 },
    { subject: 'Meetings', value: Math.min(100, (member.meetingsAttended / 35) * 100) },
    { subject: 'Strengths', value: member.strengths.length * 33 },
    { subject: 'Collaboration', value: 50 + member.participationRate * 0.4 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{getInitials(member.name)}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{member.name}</h2>
              <p className="text-sm text-muted-foreground">{member.role}</p>
              <div className="flex gap-2 mt-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{member.personality}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  member.sentiment > 0.6 ? 'bg-emerald-500/10 text-emerald-500' : member.sentiment > 0.3 ? 'bg-amber-500/10 text-amber-500' : 'bg-destructive/10 text-destructive'
                }`}>{sentimentLabel(member.sentiment)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
              {[
                { id: 'overview', label: 'Overview', icon: User },
                { id: 'trends', label: 'Trends', icon: TrendingUp },
                { id: 'radar', label: 'Profile Radar', icon: Target },
              ].map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent px-4 py-2.5 text-sm gap-1.5"
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-4 pb-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{member.participationRate}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-1">Participation</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{member.meetingsAttended}</p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-1">Meetings</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{Math.round(member.sentiment * 100)}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-1">Sentiment</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                <span><strong className="text-foreground">Communication:</strong> {member.communicationStyle}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.strengths.map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Challenges</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.challenges.map(c => (
                      <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Trends */}
            <TabsContent value="trends" className="mt-4 pb-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Sentiment Evolution</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={sentimentHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} name="Sentiment %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Participation Rate</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={participationHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="hsl(142 76% 46%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(142 76% 46%)' }} name="Participation %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* Radar */}
            <TabsContent value="radar" className="mt-4 pb-6">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={member.name} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MemberDetailModal;
