import { useState } from 'react';
import {
  ArrowLeft, MessageSquare, Star, AlertTriangle, Shield, Zap,
  Target, Eye, Loader2, RotateCw, Clock, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAnalyzeProfile, useTeamProfiles } from '../../hooks/useGodMode';
import { useQueryClient } from '@tanstack/react-query';
import { CommentsPanel } from '../shared/CommentsPanel';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';

interface Props {
  profile: Record<string, unknown>;
  onBack: () => void;
}

function AvatarWithFallback({ url, name, initials }: { url: string | null; name: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt={name} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-14 h-14 rounded-full object-cover border-2 border-blue-600/30" />;
  }
  return (
    <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white border-2 border-[var(--gm-border-primary)]"
      style={{ background: `linear-gradient(135deg, ${stringToColor(name)}, ${adjustColor(stringToColor(name), -30)})` }}>
      {initials}
    </div>
  );
}

export default function ProfileDetail({ profile, onBack }: Props) {
  const analyzeProfile = useAnalyzeProfile();
  const queryClient = useQueryClient();

  const contact = (profile.contact ?? {}) as Record<string, unknown>;
  const name = String(contact.name || profile.person_name || 'Unknown');
  const role = String(contact.role || contact.organization || '');
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const avatarRaw = contact.avatar_url || contact.photo_url;
  const avatarUrl = typeof avatarRaw === 'string' && avatarRaw.length > 0 && avatarRaw !== 'undefined' && avatarRaw !== 'null' ? avatarRaw : null;
  const data = (profile.profile_data ?? {}) as Record<string, unknown>;
  const confidence = String(profile.confidence_level || 'low');
  const contactId = String(profile.contact_id || profile.person_id || '');
  const speakingTime = Number(profile.total_speaking_time_seconds || 0);
  const limitations = (profile.limitations ?? []) as string[];
  const lastAnalysis = profile.last_analysis_at ? new Date(String(profile.last_analysis_at)).toLocaleString() : '—';

  const handleReanalyze = () => {
    if (!contactId) return;
    analyzeProfile.mutate({ personId: contactId, forceReanalysis: true }, {
      onSuccess: () => {
        toast.success(`Re-analysis started for ${name}`);
        queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
      },
      onError: () => toast.error('Failed to start re-analysis'),
    });
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Team Analysis
      </button>

      <div className={CARD}>
        {/* Header */}
        <div className="p-5 rounded-t-xl" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.15), rgba(37,99,235,0.04))' }}>
          <div className="flex items-center gap-3">
            <AvatarWithFallback url={avatarUrl} name={name} initials={initials} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{name}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {role && <span className="text-xs text-[var(--gm-text-tertiary)]">{role}</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                  confidence === 'high' || confidence === 'very_high' ? 'bg-green-500/20 text-green-400' :
                  confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]'
                }`}>{confidence.replace('_', ' ')} confidence</span>
              </div>
            </div>
            <button onClick={handleReanalyze} disabled={analyzeProfile.isPending}
              className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-xs font-medium hover:bg-[var(--gm-interactive-primary-hover)] flex items-center gap-1.5 disabled:opacity-50 transition-colors">
              {analyzeProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              Re-analyze
            </button>
          </div>

          <div className="flex gap-3 mt-4 flex-wrap">
            <MetricPill label="Influence" value={String(profile.influence_score || 0)} />
            <MetricPill label="Transcripts" value={String(profile.transcript_count || 0)} />
            <MetricPill label="Risk" value={String(profile.risk_tolerance || '—')} />
            <MetricPill label="Speaking Time" value={formatTime(speakingTime)} />
            <MetricPill label="Last Analysis" value={lastAnalysis} />
          </div>
        </div>

        {/* Profile sections */}
        <div className="p-5 space-y-4">
          {profile.communication_style && (
            <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-4">
              <h4 className="text-[10px] text-[var(--gm-accent-primary)] font-semibold uppercase tracking-wider mb-1">Communication Style</h4>
              <p className="text-sm text-[var(--gm-text-primary)]">{String(profile.communication_style)}</p>
            </div>
          )}

          {profile.dominant_motivation && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
              <h4 className="text-[10px] text-green-500 font-semibold uppercase tracking-wider mb-1">Dominant Motivation</h4>
              <p className="text-sm text-[var(--gm-text-primary)]">{String(profile.dominant_motivation)}</p>
            </div>
          )}

          <CommunicationSection data={data} />
          <MotivationsSection data={data} />
          <PressureSection data={data} />
          <InfluenceTacticsSection data={data} />
          <VulnerabilitiesSection data={data} />
          <StrategySection data={data} />
          <WarningSection data={data} />
          <PowerSection data={data} />

          {limitations.length > 0 && (
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
              <SectionHeader icon={FileText} title="Limitations" />
              <ul className="space-y-1">
                {limitations.map((l, i) => <li key={i} className="text-xs text-[var(--gm-text-tertiary)] flex items-start gap-2"><span className="text-gray-500 mt-0.5">•</span> {l}</li>)}
              </ul>
            </div>
          )}

          {Object.keys(data).length === 0 && !profile.communication_style && (
            <div className="text-center py-8 text-[var(--gm-text-tertiary)]">
              <Eye className="w-10 h-10 mx-auto mb-3 text-gray-500" />
              <p className="text-sm">No detailed profile data available yet.</p>
              <p className="text-xs mt-1">Click "Re-analyze" to generate AI insights.</p>
            </div>
          )}
        </div>
      </div>

      {/* Comments */}
      {contactId && (
        <div className={CARD}>
          <CommentsPanel targetType="profile" targetId={contactId} />
        </div>
      )}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-1.5 text-center bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)]">
      <p className="text-sm font-bold text-[var(--gm-text-primary)]">{value}</p>
      <p className="text-[9px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{label}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof MessageSquare; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--gm-text-primary)] mb-3">
      <Icon className="w-4 h-4 text-[var(--gm-accent-primary)]" /> {title}
    </h4>
  );
}

function CommunicationSection({ data }: { data: Record<string, unknown> }) {
  const comm = data.communication_identity as Record<string, unknown> | undefined;
  if (!comm) return null;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={MessageSquare} title="Communication Identity" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {comm.dominant_style && <InfoBlock label="Style" value={String(comm.dominant_style)} />}
        {comm.intervention_rhythm && <InfoBlock label="Rhythm" value={String(comm.intervention_rhythm)} />}
        {comm.textual_body_language && <InfoBlock label="Textual Cues" value={String(comm.textual_body_language)} />}
      </div>
      <EvidenceList evidence={comm.evidence as Array<Record<string, unknown>> | undefined} />
    </div>
  );
}

function MotivationsSection({ data }: { data: Record<string, unknown> }) {
  const mot = data.motivations_and_priorities as Record<string, unknown> | undefined;
  if (!mot) return null;
  const values = (mot.values_most ?? []) as string[];
  const avoids = (mot.avoids ?? []) as string[];
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={Star} title="Motivations & Priorities" />
      {values.length > 0 && <div className="mb-2"><span className="text-[10px] text-[var(--gm-text-tertiary)] font-medium">Values most:</span><div className="flex flex-wrap gap-1.5 mt-1">{values.map((v, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">{v}</span>)}</div></div>}
      {avoids.length > 0 && <div className="mb-2"><span className="text-[10px] text-[var(--gm-text-tertiary)] font-medium">Avoids:</span><div className="flex flex-wrap gap-1.5 mt-1">{avoids.map((a, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">{a}</span>)}</div></div>}
      {mot.based_on && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Based on: {String(mot.based_on)}</p>}
      {mot.confidence && <p className="text-[10px] text-[var(--gm-text-tertiary)]">Confidence: {String(mot.confidence)}</p>}
      <EvidenceList evidence={mot.evidence as Array<Record<string, unknown>> | undefined} />
    </div>
  );
}

function PressureSection({ data }: { data: Record<string, unknown> }) {
  const behaviors = data.behavior_under_pressure as Array<Record<string, unknown>> | undefined;
  if (!behaviors?.length) return null;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={Clock} title="Behavior Under Pressure" />
      <div className="space-y-2">{behaviors.map((b, i) => <div key={i} className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3"><p className="text-xs font-medium text-[var(--gm-text-primary)]">{String(b.situation)}</p><p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{String(b.observed_behavior)}</p>{b.quote && <p className="text-xs italic text-[var(--gm-text-tertiary)] mt-1 border-l-2 border-blue-600/30 pl-2">"{String(b.quote)}"</p>}{b.timestamp && <p className="text-[10px] text-gray-400 mt-1">{String(b.timestamp)}</p>}</div>)}</div>
    </div>
  );
}

function InfluenceTacticsSection({ data }: { data: Record<string, unknown> }) {
  const tactics = data.influence_tactics as Array<Record<string, unknown>> | undefined;
  if (!tactics?.length) return null;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={Target} title="Influence Tactics" />
      <div className="space-y-2">{tactics.map((t, i) => <div key={i} className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3"><p className="text-xs font-medium text-[var(--gm-text-primary)]">{String(t.objective)}</p><p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{String(t.tactic)}</p>{t.example && <p className="text-xs italic text-[var(--gm-text-tertiary)] mt-1 border-l-2 border-blue-600/30 pl-2">{String(t.example)}</p>}{t.timestamp && <p className="text-[10px] text-gray-400 mt-1">{String(t.timestamp)}</p>}</div>)}</div>
    </div>
  );
}

function VulnerabilitiesSection({ data }: { data: Record<string, unknown> }) {
  const vuln = data.vulnerabilities as Record<string, unknown> | undefined;
  if (!vuln) return null;
  const triggers = (vuln.defense_triggers ?? []) as Array<Record<string, unknown>>;
  const blindSpots = (vuln.blind_spots ?? []) as Array<Record<string, unknown>>;
  const inconsistencies = (vuln.discourse_action_inconsistencies ?? []) as Array<Record<string, unknown>>;
  const riskPatterns = (vuln.risk_patterns ?? []) as Array<Record<string, unknown>>;
  if (!triggers.length && !blindSpots.length && !inconsistencies.length && !riskPatterns.length) return null;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={Shield} title="Vulnerabilities & Friction Points" />
      {inconsistencies.length > 0 && <VulnBlock label="Discourse-Action Inconsistencies" color="text-red-500" items={inconsistencies} field="description" evidenceField="evidence" />}
      {triggers.length > 0 && <VulnBlock label="Defense Triggers" color="text-red-500" items={triggers} field="trigger" evidenceField="evidence" />}
      {blindSpots.length > 0 && <VulnBlock label="Blind Spots" color="text-yellow-500" items={blindSpots} field="description" evidenceField="evidence" />}
      {riskPatterns.length > 0 && <VulnBlock label="Risk Patterns" color="text-yellow-500" items={riskPatterns} field="pattern" evidenceField="evidence" />}
    </div>
  );
}

function VulnBlock({ label, color, items, field, evidenceField }: { label: string; color: string; items: Array<Record<string, unknown>>; field: string; evidenceField: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
      <div className="space-y-1.5">{items.map((item, i) => <div key={i} className="bg-[var(--gm-bg-tertiary)] rounded-lg p-2.5"><p className="text-xs text-[var(--gm-text-primary)]">{String(item[field] || item.text || item)}</p>{item[evidenceField] && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5 italic">{String(item[evidenceField])}</p>}</div>)}</div>
    </div>
  );
}

function StrategySection({ data }: { data: Record<string, unknown> }) {
  const strat = data.interaction_strategy as Record<string, unknown> | undefined;
  if (!strat) return null;
  const works = (strat.framing_that_works ?? []) as string[];
  const avoid = (strat.what_to_avoid ?? []) as string[];
  const cooperation = (strat.cooperation_triggers ?? []) as string[];
  const format = strat.ideal_format as Record<string, unknown> | undefined;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={MessageSquare} title="Recommended Interaction Strategy" />
      {format && <div className="flex flex-wrap gap-2 mb-3">{format.channel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-[var(--gm-accent-primary)]">Channel: {String(format.channel)}</span>}{format.structure && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-[var(--gm-accent-primary)]">Structure: {String(format.structure)}</span>}{format.timing && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-[var(--gm-accent-primary)]">Timing: {String(format.timing)}</span>}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {works.length > 0 && <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3"><p className="text-[10px] text-green-500 font-semibold uppercase tracking-wider mb-1">What Works</p><ul className="space-y-0.5">{works.map((f, i) => <li key={i} className="text-xs text-[var(--gm-text-primary)]">+ {f}</li>)}</ul></div>}
        {avoid.length > 0 && <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3"><p className="text-[10px] text-red-500 font-semibold uppercase tracking-wider mb-1">What to Avoid</p><ul className="space-y-0.5">{avoid.map((a, i) => <li key={i} className="text-xs text-[var(--gm-text-primary)]">- {a}</li>)}</ul></div>}
        {cooperation.length > 0 && <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3"><p className="text-[10px] text-[var(--gm-accent-primary)] font-semibold uppercase tracking-wider mb-1">Cooperation Triggers</p><ul className="space-y-0.5">{cooperation.map((c, i) => <li key={i} className="text-xs text-[var(--gm-text-primary)]">→ {c}</li>)}</ul></div>}
      </div>
    </div>
  );
}

function WarningSection({ data }: { data: Record<string, unknown> }) {
  const warnings = data.early_warning_signs as Array<Record<string, unknown>> | undefined;
  if (!warnings?.length) return null;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={AlertTriangle} title="Early Warning Signs" />
      <div className="space-y-2">{warnings.map((w, i) => <div key={i} className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-3"><p className="text-xs font-medium text-[var(--gm-text-primary)]">{String(w.signal)}</p><p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">Indicates: {String(w.indicates)}</p>{w.comparison_evidence && <p className="text-[10px] text-gray-400 mt-1 italic">Evidence: {String(w.comparison_evidence)}</p>}</div>)}</div>
    </div>
  );
}

function PowerSection({ data }: { data: Record<string, unknown> }) {
  const power = data.power_analysis as Array<Record<string, unknown>> | undefined;
  if (!power?.length) return null;
  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4">
      <SectionHeader icon={Zap} title="Power & Dependency Analysis" />
      <div className="space-y-2">{power.map((p, i) => <div key={i} className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3"><p className="text-xs font-medium text-[var(--gm-text-primary)]">{String(p.factor)}</p><p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{String(p.assessment)}</p>{p.strategic_implication && <p className="text-xs text-[var(--gm-accent-primary)] mt-1">→ {String(p.strategic_implication)}</p>}</div>)}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--gm-bg-tertiary)] rounded-lg p-3">
      <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{label}</span>
      <p className="text-xs text-[var(--gm-text-primary)] mt-0.5">{value}</p>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence?: Array<Record<string, unknown>> }) {
  if (!evidence?.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] text-[var(--gm-text-tertiary)] font-medium uppercase tracking-wider">Evidence</p>
      {evidence.slice(0, 5).map((e, i) => (
        <div key={i} className="text-xs bg-[var(--gm-bg-tertiary)] rounded p-2">
          {e.quote && <p className="italic text-[var(--gm-text-tertiary)] border-l-2 border-blue-600/30 pl-2">"{String(e.quote)}"</p>}
          {e.observation && <p className="text-[var(--gm-text-tertiary)] mt-0.5">{String(e.observation)}</p>}
          {e.timestamp && <p className="text-[10px] text-gray-400 mt-0.5">{String(e.timestamp)}</p>}
        </div>
      ))}
    </div>
  );
}

export function stringToColor(str: string): string {
  const colors = ['#9b59b6', '#3498db', '#e74c3c', '#27ae60', '#f59e0b', '#1abc9c', '#e67e22', '#34495e'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function adjustColor(color: string, amount: number): string {
  const clamp = (n: number) => Math.min(255, Math.max(0, n));
  const hex = color.replace('#', '');
  const r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
  const g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
  const b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
