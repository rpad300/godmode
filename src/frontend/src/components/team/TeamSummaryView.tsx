import { motion } from 'framer-motion';
import { BarChart3, Users, Link2, Swords, Crown, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import { TeamSummaryData } from '@/data/team-detailed-data';

const fade = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const SectionTitle = ({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="w-4 h-4 text-primary" />
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {count !== undefined && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{count}</span>}
  </div>
);

const strengthColor = (s: number) => s >= 70 ? 'text-emerald-500' : s >= 50 ? 'text-amber-500' : 'text-muted-foreground';
const strengthLabel = (s: number) => s >= 70 ? 'Strong' : s >= 50 ? 'Moderate' : 'Weak';
const riskBadge = (r: string) => {
  const c = r === 'high' ? 'bg-destructive/10 text-destructive' : r === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c}`}>{r} risk</span>;
};
const severityBadge = (s: string) => {
  const c = s === 'high' ? 'bg-destructive/10 text-destructive' : s === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c}`}>{s}</span>;
};
const typeIcon = (t: string) => {
  if (t === 'direct') return '→';
  if (t === 'indirect') return '⟲';
  if (t === 'technical') return '⚙';
  return '♟';
};

interface Props {
  data: TeamSummaryData;
}

const TeamSummaryView = ({ data }: Props) => {
  return (
    <div className="space-y-4">
      {/* Cohesion Header */}
      <motion.div {...fade(0)} className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{data.cohesionScore}</span>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold">Team Cohesion Score</p>
              <p className="text-sm text-amber-500 font-medium">{data.cohesionLabel}</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{data.influenceScoreboard.length} Team Members</span>
            <span>📊 Analysis Date {new Date().toLocaleDateString('pt-PT')}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Executive Summary</p>
          <p className="text-xs text-foreground/90 leading-relaxed">{data.executiveSummary}</p>
        </div>
      </motion.div>

      {/* Influence Scoreboard */}
      <motion.div {...fade(1)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={BarChart3} title="Influence Scoreboard" count={data.influenceScoreboard.length} />
        <div className="space-y-2">
          {data.influenceScoreboard.map((m, i) => (
            <div key={m.member} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{m.member}</p>
                  <span className="text-[10px] text-muted-foreground">{m.role}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{m.style}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Influence</p>
                  <p className="text-sm font-bold text-foreground">{m.score}</p>
                </div>
                {riskBadge(m.risk)}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Communication Flow */}
      <motion.div {...fade(2)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Link2} title="Communication Flow" />
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1">🚧 Bottlenecks</p>
            {data.communicationFlow.bottlenecks.map(b => (
              <p key={b} className="text-xs text-foreground/90 mb-1">{b}</p>
            ))}
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1">🔗 Information Brokers</p>
            {data.communicationFlow.informationBrokers.map(b => (
              <p key={b} className="text-xs text-foreground/90 mb-1">{b}</p>
            ))}
            <p className="text-[10px] text-muted-foreground mt-1">Key connectors who bridge information across the team</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1">⭐ Central Nodes</p>
            {data.communicationFlow.centralNodes.map(n => (
              <p key={n} className="text-xs text-foreground/90 mb-1">{n}</p>
            ))}
            <p className="text-[10px] text-muted-foreground mt-1">Most connected team members</p>
          </div>
        </div>
      </motion.div>

      {/* Influence Map */}
      <motion.div {...fade(3)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Link2} title="Influence Map" count={data.influenceConnections.length} />
        <div className="space-y-2.5">
          {data.influenceConnections.map((c, i) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs font-semibold text-foreground">{c.from}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">{c.to}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{typeIcon(c.type)} {c.type}</span>
                <span className={`text-xs font-bold ${strengthColor(c.strength)}`}>{c.strength}%</span>
                <span className={`text-[10px] ${strengthColor(c.strength)}`}>{strengthLabel(c.strength)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{c.evidence}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Alliances */}
      <motion.div {...fade(4)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Users} title="Alliances" count={data.alliances.length} />
        <div className="space-y-3">
          {data.alliances.map((a, i) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {a.members.map((m, j) => (
                  <span key={m}>
                    {j > 0 && <span className="text-muted-foreground mx-1">&</span>}
                    <span className="text-xs font-semibold text-foreground">{m}</span>
                  </span>
                ))}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.type === 'natural' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                  {a.type === 'natural' ? '🌱' : '♟'} {a.type}
                </span>
                <span className={`text-xs font-bold ${strengthColor(a.strength)}`}>{a.strength}%</span>
                <span className={`text-[10px] ${strengthColor(a.strength)}`}>{strengthLabel(a.strength)} bond</span>
              </div>
              <div className="mb-1.5">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Shared Values</p>
                <div className="flex flex-wrap gap-1">
                  {a.sharedValues.map(v => (
                    <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{v}</span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{a.evidence}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tensions */}
      <motion.div {...fade(5)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Swords} title="Tensions" count={data.tensions.length} />
        <div className="space-y-3">
          {data.tensions.map((t, i) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-foreground">{t.members[0]}</span>
                <span className="text-muted-foreground text-xs">↔</span>
                <span className="text-xs font-semibold text-foreground">{t.members[1]}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {t.type === 'resource' ? '📊' : t.type === 'political' ? '♟' : '💬'} {t.type}
                </span>
                {severityBadge(t.severity)}
              </div>
              <div className="mb-1.5">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Triggers</p>
                <ul className="space-y-0.5">
                  {t.triggers.map(tr => (
                    <li key={tr} className="text-[10px] text-foreground/80 flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />{tr}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] text-muted-foreground">{t.evidence}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Power Centers */}
      <motion.div {...fade(6)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Crown} title="Power Centers" count={data.powerCenters.length} />
        <div className="space-y-2.5">
          {data.powerCenters.map((pc, i) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{pc.member}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {pc.type === 'technical' ? '⚙' : pc.type === 'social' ? '🤝' : pc.type === 'informal' ? '💬' : '🏛'} {pc.type}
                  </span>
                </div>
                <span className="text-xs font-bold text-primary">{pc.reach}% <span className="text-[10px] text-muted-foreground font-normal">reach</span></span>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Power Sources</p>
                <ul className="space-y-0.5">
                  {pc.sources.map(s => (
                    <li key={s} className="text-[10px] text-foreground/80 flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Risk Factors */}
      <motion.div {...fade(7)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={AlertTriangle} title="Risk Factors" count={data.riskFactors.length} />
        <div className="space-y-2">
          {data.riskFactors.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/90">
              <span className="w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
              <p className="leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div {...fade(8)} className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Lightbulb} title="Recommendations" count={data.recommendations.length} />
        <div className="space-y-2">
          {data.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-primary/5">
              <span className="text-xs font-bold text-primary shrink-0">Action {i + 1}</span>
              <p className="text-xs text-foreground/90 leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default TeamSummaryView;
