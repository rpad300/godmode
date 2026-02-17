/**
 * Purpose:
 *   Deep behavioral profile view for a team member, presenting seven
 *   collapsible analytical sections drawn from AI-generated profile data.
 *
 * Responsibilities:
 *   - Communication Identity: verbal patterns, preferred channels, real
 *     quotes, and communication style description
 *   - Motivations and Priorities: ranked list with confidence percentages
 *   - Behavior Under Pressure: stress responses, conflict style, and
 *     observed patterns
 *   - Influence Tactics: list of tactics with effectiveness rating
 *   - Vulnerabilities and Friction Points: triggers, blind spots, and
 *     communication gaps
 *   - Recommended Interaction Strategy: approach tips, discussion topics,
 *     and early warning signals
 *   - Power and Dependency Analysis: influence sources, network position,
 *     and dependency chains
 *   - Back navigation button to return to the member list
 *
 * Key dependencies:
 *   - framer-motion: section fade-in animations
 *   - TeamMember (mock-data): member shape with sentiment, stats
 *   - DetailedMemberProfile (team-detailed-data): AI-generated profile
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Section is a local collapsible accordion component with icon,
 *     title, and defaultOpen control.
 *   - The profile data is assumed to be AI-generated; accuracy disclaimers
 *     are not shown in the UI.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquare, Brain, Shield, Target, Eye, Lightbulb, AlertTriangle, Zap, ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { TeamMember } from '@/data/mock-data';
import { DetailedMemberProfile } from '@/data/team-detailed-data';

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const sentimentLabel = (s: number) => s > 0.6 ? 'Positive' : s > 0.3 ? 'Neutral' : 'Cautious';

interface Props {
  member: TeamMember;
  profile: DetailedMemberProfile;
  onBack: () => void;
}

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </motion.div>
  );
};

const QuoteBlock = ({ text, context, timestamp }: { text: string; context?: string; timestamp: string }) => (
  <div className="bg-secondary/40 rounded-lg p-3 border-l-2 border-primary/40">
    <div className="flex items-start gap-2">
      <Quote className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
      <div className="space-y-1">
        <p className="text-xs text-foreground italic leading-relaxed">{text}</p>
        {context && <p className="text-[10px] text-muted-foreground">{context}</p>}
        <span className="text-[10px] text-primary/70 font-mono">{timestamp}</span>
      </div>
    </div>
  </div>
);

const LevelBadge = ({ level }: { level: string }) => {
  const color = level.toLowerCase().includes('high') ? 'bg-destructive/10 text-destructive'
    : level.toLowerCase().includes('medium') ? 'bg-amber-500/10 text-amber-500'
    : 'bg-emerald-500/10 text-emerald-500';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>{level}</span>;
};

const MemberProfileDetail = ({ member, profile, onBack }: Props) => {
  return (
    <div className="space-y-4">
      {/* Back button + Header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Profiles
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center">
            <span className="text-base font-bold text-primary">{getInitials(member.name)}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{member.name}</h2>
            <p className="text-sm text-muted-foreground">{member.role}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{member.personality}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                member.sentiment > 0.6 ? 'bg-emerald-500/10 text-emerald-500' : member.sentiment > 0.3 ? 'bg-amber-500/10 text-amber-500' : 'bg-destructive/10 text-destructive'
              }`}>{sentimentLabel(member.sentiment)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Communication Identity */}
      <Section title="Communication Identity" icon={MessageSquare}>
        <div className="space-y-2">
          {[
            { label: 'Style', value: profile.communication.style },
            { label: 'Rhythm', value: profile.communication.rhythm },
            { label: 'Textual Cues', value: profile.communication.textualCues },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">{item.label}</p>
              <p className="text-xs text-foreground/90 leading-relaxed">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 mt-3">
          {profile.communication.quotes.map((q, i) => (
            <QuoteBlock key={i} text={q.text} context={q.context} timestamp={q.timestamp} />
          ))}
        </div>
      </Section>

      {/* Motivations & Priorities */}
      <Section title="Motivations & Priorities" icon={Target}>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">Values most</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.motivations.values.map(v => (
                <span key={v} className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500">{v}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">Avoids</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.motivations.avoids.map(a => (
                <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500">{a}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Confidence</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              profile.motivations.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-500' :
              profile.motivations.confidence === 'medium' ? 'bg-amber-500/10 text-amber-500' :
              'bg-destructive/10 text-destructive'
            }`}>{profile.motivations.confidence}</span>
          </div>
        </div>
      </Section>

      {/* Behavior Under Pressure */}
      <Section title="Behavior Under Pressure" icon={Zap} defaultOpen={false}>
        <div className="space-y-4">
          {profile.pressureBehaviors.map((pb, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">{pb.scenario}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{pb.response}</p>
              <QuoteBlock text={pb.quote.text} timestamp={pb.quote.timestamp} />
            </div>
          ))}
        </div>
      </Section>

      {/* Influence Tactics */}
      <Section title="Influence Tactics" icon={Brain} defaultOpen={false}>
        <div className="space-y-3">
          {profile.influenceTactics.map((it, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-semibold text-foreground">{it.tactic}</p>
              <p className="text-xs text-muted-foreground">{it.description}</p>
              <div className="bg-secondary/40 rounded-lg p-2 border-l-2 border-primary/30">
                <p className="text-[11px] text-foreground/80 italic">{it.quote}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Vulnerabilities & Friction Points */}
      <Section title="Vulnerabilities & Friction Points" icon={AlertTriangle} defaultOpen={false}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">Defense Triggers</p>
            <ul className="space-y-1">
              {profile.vulnerabilities.triggers.map(t => (
                <li key={t} className="text-xs text-foreground/90 flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-destructive mt-1.5 shrink-0" />{t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">Blind Spots</p>
            <ul className="space-y-1">
              {profile.vulnerabilities.blindSpots.map(b => (
                <li key={b} className="text-xs text-foreground/90 flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />{b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Recommended Interaction Strategy */}
      <Section title="Recommended Interaction Strategy" icon={Lightbulb} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Ideal Format</p>
            <p className="text-xs text-foreground/90 leading-relaxed">{profile.interactionStrategy.idealFormat}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">What Works</p>
            <ul className="space-y-1">
              {profile.interactionStrategy.whatWorks.map(w => (
                <li key={w} className="text-xs text-emerald-500 flex items-start gap-1.5">
                  <span className="mt-1.5 shrink-0">✓</span>{w}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">What to Avoid</p>
            <ul className="space-y-1">
              {profile.interactionStrategy.whatToAvoid.map(a => (
                <li key={a} className="text-xs text-destructive flex items-start gap-1.5">
                  <span className="mt-1.5 shrink-0">✗</span>{a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5">Early Warning Signs</p>
            <div className="space-y-2">
              {profile.interactionStrategy.earlyWarnings.map((ew, i) => (
                <div key={i} className="bg-secondary/40 rounded-lg p-2.5">
                  <p className="text-xs font-medium text-foreground">{ew.sign}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Indicates: {ew.indicates}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Power & Dependency Analysis */}
      <Section title="Power & Dependency Analysis" icon={Shield} defaultOpen={false}>
        <div className="space-y-3">
          {[
            { label: 'Control of critical resources', ...profile.powerAnalysis.criticalResources },
            { label: 'Unique institutional knowledge', ...profile.powerAnalysis.institutionalKnowledge },
            { label: 'Centrality in communication network', ...profile.powerAnalysis.communicationCentrality },
            { label: 'Dependency on others to execute', ...profile.powerAnalysis.dependencyOnOthers },
            { label: 'Ability to block or accelerate', ...profile.powerAnalysis.blockAccelerate },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                  <LevelBadge level={item.level} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default MemberProfileDetail;
