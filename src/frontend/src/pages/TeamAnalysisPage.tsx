import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Users, Loader2, Network, BarChart3, ArrowRight, TrendingUp,
  RotateCw, Play, RefreshCw, Zap, Shield, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Search, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useTeamProfiles, useTeamDynamics, useTeamRelationships,
  useRunTeamAnalysis, useAnalyzeProfile, useTeamGraph,
  useSyncTeamGraph, useContacts,
} from '../hooks/useGodMode';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/Dialog';
import ProfileDetail, { stringToColor, adjustColor } from '../components/team/ProfileDetail';
import { ErrorState } from '../components/shared/ErrorState';
import { isValidAvatarUrl, getInitials } from '../lib/utils';

function ContactAvatar({ url, name, size = 'md', className = '' }: {
  url: string | null | undefined; name: string; size?: 'sm' | 'md' | 'lg'; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);
  const dims = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-14 h-14' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-lg' : 'text-[10px]';
  const borderCls = size === 'lg' ? 'border-2 border-white/20' : '';

  if (url && !failed) {
    return (
      <img src={url} alt={name} referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dims} rounded-full object-cover flex-shrink-0 ${className}`} />
    );
  }

  return (
    <div className={`${dims} rounded-full flex items-center justify-center ${textSize} font-bold text-white flex-shrink-0 ${borderCls} ${className}`}
      style={{ background: `linear-gradient(135deg, ${stringToColor(name)}, ${adjustColor(stringToColor(name), -30)})` }}>
      {initials}
    </div>
  );
}

type Tab = 'profiles' | 'team' | 'relationships' | 'graph';

/* ═══════════════════════════════════════════════════════
   Name Resolution - Maps Person_N → real names
   ═══════════════════════════════════════════════════════ */
interface PersonInfo {
  name: string;
  initials: string;
  role: string;
  avatarUrl?: string;
}

function buildNameResolver(profiles: Array<Record<string, unknown>>): (name: string) => PersonInfo {
  const mapping: Record<string, PersonInfo> = {};

  profiles.forEach((profile, index) => {
    const contact = (profile.contact ?? {}) as Record<string, unknown>;
    const realName = String(contact.name || profile.person_name || 'Unknown');
    const avatarRaw = contact.avatar_url || contact.photo_url;
    const info: PersonInfo = {
      name: realName,
      initials: getInitials(realName),
      role: String(contact.role || contact.organization || ''),
      avatarUrl: avatarRaw ? String(avatarRaw) : undefined,
    };

    mapping[`person_${index + 1}`] = info;
    mapping[`person ${index + 1}`] = info;
    mapping[realName.toLowerCase()] = info;
    const firstName = realName.split(' ')[0];
    if (firstName) mapping[firstName.toLowerCase()] = info;

    const contactId = String(profile.contact_id || profile.person_id || '');
    if (contactId) mapping[contactId] = info;
  });

  return (name: string) => {
    if (!name) return { name: 'Unknown', initials: '?', role: '' };
    const normalized = name.toLowerCase().trim();
    return mapping[normalized] || mapping[name] || {
      name: name.replace(/_/g, ' '),
      initials: getInitials(name),
      role: '',
    };
  };
}

function replacePersonNames(text: string, resolve: (n: string) => PersonInfo): string {
  return text.replace(/Person_(\d+)/gi, (match) => resolve(match).name);
}

/* ═══════════════════════════════════════════════════════
   Person Chip - avatar + name inline element
   ═══════════════════════════════════════════════════════ */
function PersonChip({ name, resolve }: { name: string; resolve: (n: string) => PersonInfo }) {
  const info = resolve(name);
  return (
    <div className="inline-flex items-center gap-1.5 bg-gm-surface-primary border border-gm-border-primary rounded-full px-2.5 py-1">
      <ContactAvatar url={isValidAvatarUrl(info.avatarUrl) ? info.avatarUrl : null} name={info.name} size="sm" />
      <span className="text-[10px] font-medium text-gm-text-primary whitespace-nowrap">{info.name}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Type Configs for dynamics cards
   ═══════════════════════════════════════════════════════ */
const influenceTypes: Record<string, { color: string; bg: string; icon: string }> = {
  direct: { color: '#3b82f6', bg: '#eff6ff', icon: '→' },
  technical: { color: '#8b5cf6', bg: '#f5f3ff', icon: '⚙' },
  political: { color: '#f59e0b', bg: '#fffbeb', icon: '♟' },
  social: { color: '#10b981', bg: '#ecfdf5', icon: '🤝' },
  resource: { color: '#ef4444', bg: '#fef2f2', icon: '📊' },
};

const allianceTypes: Record<string, { color: string; bg: string; icon: string }> = {
  natural: { color: '#10b981', bg: '#ecfdf5', icon: '🌱' },
  circumstantial: { color: '#6366f1', bg: '#eef2ff', icon: '🔗' },
  strategic: { color: '#f59e0b', bg: '#fffbeb', icon: '♟' },
  historical: { color: '#8b5cf6', bg: '#f5f3ff', icon: '📜' },
};

const tensionTypes: Record<string, { color: string; bg: string; icon: string }> = {
  technical: { color: '#8b5cf6', bg: '#f5f3ff', icon: '⚙' },
  resource: { color: '#f59e0b', bg: '#fffbeb', icon: '📊' },
  political: { color: '#ef4444', bg: '#fef2f2', icon: '♟' },
  communication: { color: '#3b82f6', bg: '#eff6ff', icon: '💬' },
  values: { color: '#10b981', bg: '#ecfdf5', icon: '⚖' },
};

const powerTypes: Record<string, { color: string; bg: string; icon: string }> = {
  technical: { color: '#8b5cf6', bg: '#f5f3ff', icon: '⚙' },
  formal: { color: '#3b82f6', bg: '#eff6ff', icon: '👔' },
  informal: { color: '#f59e0b', bg: '#fffbeb', icon: '💬' },
  social: { color: '#10b981', bg: '#ecfdf5', icon: '🤝' },
  resource: { color: '#ef4444', bg: '#fef2f2', icon: '📊' },
};

/* ═══════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════ */
export default function TeamAnalysisPage() {
  const [tab, setTab] = useState<Tab>('profiles');
  const [selectedProfile, setSelectedProfile] = useState<Record<string, unknown> | null>(null);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);

  const profiles = useTeamProfiles();
  const dynamics = useTeamDynamics();
  const relationships = useTeamRelationships();
  const graphQuery = useTeamGraph();
  const runTeamAnalysis = useRunTeamAnalysis();
  const syncGraph = useSyncTeamGraph();

  const profileList = useMemo(() =>
    (profiles.data?.profiles ?? []) as Array<Record<string, unknown>>,
    [profiles.data]
  );

  const resolveName = useMemo(() => buildNameResolver(profileList), [profileList]);

  if (profiles.error) {
    return <div className="p-6"><ErrorState message="Failed to load team profiles." onRetry={() => profiles.refetch()} /></div>;
  }

  // Detail view (replaces list)
  if (selectedProfile) {
    return (
      <ProfileDetail
        profile={selectedProfile}
        onBack={() => setSelectedProfile(null)}
      />
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'profiles', label: 'Profiles', icon: Users },
    { key: 'team', label: 'Team Dynamics', icon: BarChart3 },
    { key: 'relationships', label: 'Relationships', icon: ArrowRight },
    { key: 'graph', label: 'Network Graph', icon: Network },
  ];

  const handleRunAnalysis = () => {
    runTeamAnalysis.mutate({ forceReanalysis: true }, {
      onSuccess: () => toast.success('Team analysis started'),
      onError: () => toast.error('Failed to start team analysis'),
    });
  };

  const handleSyncGraph = () => {
    syncGraph.mutate(undefined, {
      onSuccess: () => { toast.success('Graph synced'); graphQuery.refetch(); },
      onError: () => toast.error('Failed to sync graph'),
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gm-text-primary">Team Analysis</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAnalyzeModal(true)}
            className="px-3 py-1.5 rounded-lg bg-gm-interactive-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-interactive-secondary-hover flex items-center gap-1.5 transition-colors">
            <Users className="w-3.5 h-3.5" /> Analyze Members
          </button>
          <button onClick={handleRunAnalysis} disabled={runTeamAnalysis.isPending}
            className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 disabled:opacity-50 transition-colors">
            {runTeamAnalysis.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run Team Analysis
          </button>
          <button onClick={handleSyncGraph} disabled={syncGraph.isPending}
            className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover flex items-center gap-1.5 disabled:opacity-50 transition-colors border border-gm-border-primary">
            {syncGraph.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Graph
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gm-surface-secondary rounded-xl p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-gm-surface-primary text-gm-text-primary shadow-sm' : 'text-gm-text-tertiary hover:text-gm-text-primary'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profiles' && (
        <ProfilesTab profiles={profileList} isLoading={profiles.isLoading} onSelectProfile={setSelectedProfile} />
      )}
      {tab === 'team' && (
        <TeamDynamicsTab data={(dynamics.data as Record<string, unknown>)?.analysis ?? dynamics.data} isLoading={dynamics.isLoading} profiles={profileList} resolveName={resolveName} />
      )}
      {tab === 'relationships' && (
        <RelationshipsTab data={relationships.data} isLoading={relationships.isLoading} profiles={profileList} resolveName={resolveName} />
      )}
      {tab === 'graph' && (
        <NetworkGraphTab data={graphQuery.data} isLoading={graphQuery.isLoading} profiles={profileList} resolveName={resolveName} />
      )}

      <AnalyzeContactsModal
        open={showAnalyzeModal}
        onClose={() => setShowAnalyzeModal(false)}
        existingProfileIds={new Set(profileList.map(p => String(p.contact_id || p.person_id || '')))}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Profiles Tab
   ═══════════════════════════════════════════════════════ */
function ProfilesTab({ profiles, isLoading, onSelectProfile }: {
  profiles: Array<Record<string, unknown>>;
  isLoading: boolean;
  onSelectProfile: (p: Record<string, unknown>) => void;
}) {
  const analyzeProfile = useAnalyzeProfile();

  if (isLoading) return <Spinner />;
  if (profiles.length === 0) return (
    <EmptyState icon={Users} message="No team profiles available. Click 'Analyze Members' to generate AI behavioral profiles." />
  );

  const sorted = [...profiles].sort((a, b) => (Number(b.influence_score) || 0) - (Number(a.influence_score) || 0));

  const handleReanalyze = (e: React.MouseEvent, profile: Record<string, unknown>) => {
    e.stopPropagation();
    const contactId = String(profile.contact_id || profile.person_id || '');
    if (!contactId) return;
    const contact = (profile.contact ?? {}) as Record<string, unknown>;
    const name = String(contact.name || profile.person_name || 'Unknown');
    analyzeProfile.mutate({ personId: contactId, forceReanalysis: true }, {
      onSuccess: () => toast.success(`Re-analysis started for ${name}`),
      onError: () => toast.error('Failed to start re-analysis'),
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((profile, i) => {
        const contact = (profile.contact ?? {}) as Record<string, unknown>;
        const name = String(contact.name || profile.person_name || 'Unknown');
        const role = String(contact.role || contact.organization || '');
        const avatarUrl = isValidAvatarUrl(contact.avatar_url) ? contact.avatar_url : isValidAvatarUrl(contact.photo_url) ? contact.photo_url : null;
        const confidence = String(profile.confidence_level || 'low');
        const commStyle = String(profile.communication_style || '');
        const speakingTime = Number(profile.total_speaking_time_seconds || 0);
        const speakingMins = speakingTime ? `${Math.floor(speakingTime / 60)}m` : '';

        return (
          <div key={i} onClick={() => onSelectProfile(profile)}
            className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4 hover:border-blue-600/30 hover:-translate-y-0.5 transition-all cursor-pointer group shadow-sm hover:shadow-md">
            {/* Header with avatar */}
            <div className="flex items-start gap-3 mb-3">
              <ContactAvatar url={avatarUrl} name={name} size="lg" className="border-2 border-gm-surface-secondary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gm-text-primary truncate group-hover:text-gm-interactive-primary transition-colors">{name}</p>
                {role && <p className="text-[10px] text-gm-text-tertiary mt-0.5">{role}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                    confidence === 'high' || confidence === 'very_high' ? 'bg-gm-status-success-bg text-gm-status-success' :
                    confidence === 'medium' ? 'bg-gm-status-warning-bg text-gm-status-warning' :
                    'bg-gm-surface-secondary text-gm-text-tertiary'
                  }`}>{confidence.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-2 py-3 border-t border-[var(--gm-border-primary)]">
              <div className="text-center">
                <p className="text-base font-bold text-gm-text-primary">{String(profile.influence_score || 0)}</p>
                <p className="text-[9px] text-gm-text-tertiary uppercase tracking-wider">Influence</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gm-text-primary">{String(profile.transcript_count || 0)}</p>
                <p className="text-[9px] text-gm-text-tertiary uppercase tracking-wider">Transcripts</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gm-text-primary capitalize">{String(profile.risk_tolerance || '—')}</p>
                <p className="text-[9px] text-gm-text-tertiary uppercase tracking-wider">Risk</p>
              </div>
            </div>

            {/* Communication style */}
            {commStyle && (
              <div className="mt-2 bg-gm-surface-secondary rounded-lg p-2.5">
                <p className="text-[9px] text-gm-text-tertiary uppercase tracking-wider mb-0.5">Communication Style</p>
                <p className="text-xs text-gm-text-primary line-clamp-2">{commStyle}</p>
              </div>
            )}

            {/* Speaking time + Re-analyze button */}
            <div className="flex items-center justify-between mt-3">
              {speakingMins && <span className="text-[10px] text-gm-text-tertiary">{speakingMins} speaking time</span>}
              <button onClick={(e) => handleReanalyze(e, profile)}
                disabled={analyzeProfile.isPending}
                className="ml-auto px-2.5 py-1 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-[10px] font-medium hover:bg-gm-surface-hover flex items-center gap-1 transition-colors border border-gm-border-primary disabled:opacity-50">
                <RotateCw className="w-3 h-3" /> Re-analyze
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Team Dynamics Tab
   ═══════════════════════════════════════════════════════ */
function TeamDynamicsTab({ data, isLoading, profiles, resolveName }: {
  data: unknown;
  isLoading: boolean;
  profiles: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  if (isLoading) return <Spinner />;
  const d = data as Record<string, unknown> | null;
  if (!d) return <EmptyState icon={BarChart3} message="No team dynamics data. Click 'Run Team Analysis' to generate insights." />;

  const cohesion = Number(d.cohesion_score ?? 0);
  const tensionLevel = String(d.tension_level || 'unknown');
  const teamSize = Number(d.team_size ?? profiles.length ?? 0);
  const analysisData = (d.analysis_data ?? {}) as Record<string, unknown>;
  const dominantPattern = String(analysisData.dominant_communication_pattern || d.summary || '');
  const influenceMap = (d.influence_map ?? []) as Array<Record<string, unknown>>;
  const alliances = (d.alliances ?? []) as Array<Record<string, unknown>>;
  const tensions = (d.tensions ?? []) as Array<Record<string, unknown>>;
  const powerCenters = (analysisData.power_centers ?? []) as Array<Record<string, unknown>>;
  const riskFactors = (analysisData.risk_factors ?? []) as string[];
  const recommendations = (analysisData.recommendations ?? []) as string[];
  const commFlow = (analysisData.communication_flow ?? {}) as Record<string, unknown>;
  const dynamicsList = (d.dynamics ?? []) as Array<Record<string, unknown>>;
  const analysisDate = String(analysisData.analysis_date || d.last_analysis_at || '');

  const cohesionColor = cohesion >= 70 ? '#22c55e' : cohesion >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5 flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--gm-border-primary)" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={cohesionColor} strokeWidth="3" strokeDasharray={`${cohesion}, 100`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gm-text-primary">{cohesion}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gm-text-primary">Team Cohesion</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
              tensionLevel === 'low' ? 'bg-gm-status-success-bg text-gm-status-success' :
              tensionLevel === 'medium' ? 'bg-gm-status-warning-bg text-gm-status-warning' :
              'bg-gm-status-danger-bg text-gm-status-danger'
            }`}>{tensionLevel} tension</span>
          </div>
        </div>
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold text-gm-text-primary">{teamSize}</p>
          <p className="text-xs text-gm-text-tertiary">Team Members</p>
        </div>
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5 flex items-center gap-3 justify-center">
          <Calendar className="w-5 h-5 text-gm-text-tertiary" />
          <div>
            <p className="text-xs text-gm-text-tertiary">Analysis Date</p>
            <p className="text-sm font-semibold text-gm-text-primary">
              {analysisDate ? new Date(analysisDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary with name resolution */}
      {dominantPattern && (
        <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gm-interactive-primary uppercase tracking-wider mb-2">Executive Summary</h3>
          <p className="text-sm text-gm-text-primary leading-relaxed">{replacePersonNames(dominantPattern, resolveName)}</p>
        </div>
      )}

      {/* Influence Scoreboard */}
      {profiles.length > 0 && <InfluenceScoreboard profiles={profiles} />}

      {/* Communication Flow with person chips */}
      {(commFlow.bottlenecks || commFlow.information_brokers || commFlow.central_nodes || commFlow.isolated_members) && (
        <CommunicationFlowSection flow={commFlow} resolveName={resolveName} />
      )}

      {/* Dynamics cards with person chips and type configs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {influenceMap.length > 0 && <InfluenceMapCard items={influenceMap} resolveName={resolveName} />}
        {alliances.length > 0 && <AlliancesCard items={alliances} resolveName={resolveName} />}
        {tensions.length > 0 && <TensionsCard items={tensions} resolveName={resolveName} />}
        {powerCenters.length > 0 && <PowerCentersCard items={powerCenters} resolveName={resolveName} />}
      </div>

      {/* Dynamic scores */}
      {dynamicsList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dynamicsList.map((item, i) => (
            <div key={i} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gm-interactive-primary" />
                <span className="text-sm font-medium text-gm-text-primary">{String(item.aspect || item.name || `Dynamic #${i + 1}`)}</span>
              </div>
              <p className="text-xs text-gm-text-tertiary">{replacePersonNames(String(item.description || item.summary || ''), resolveName)}</p>
              {item.score !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gm-surface-secondary rounded-full">
                    <div className="h-1.5 bg-gm-interactive-primary rounded-full" style={{ width: `${Math.min(100, Number(item.score))}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-gm-text-tertiary">{String(item.score)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Risk Factors */}
      {riskFactors.length > 0 && (
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gm-status-danger uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Risk Factors
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-danger-bg text-gm-status-danger ml-auto">{riskFactors.length} identified</span>
          </h3>
          <div className="space-y-2">
            {riskFactors.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-gm-status-danger font-bold mt-0.5 flex-shrink-0">{i + 1}</span>
                <p className="text-xs text-gm-text-primary">{replacePersonNames(r, resolveName)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gm-status-success uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Recommendations
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-success-bg text-gm-status-success ml-auto">{recommendations.length} actions</span>
          </h3>
          <div className="space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-gm-status-success font-bold mt-0.5 flex-shrink-0">Action {i + 1}</span>
                <p className="text-xs text-gm-text-primary">{replacePersonNames(r, resolveName)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Influence Scoreboard
   ═══════════════════════════════════════════════════════ */
function InfluenceScoreboard({ profiles }: { profiles: Array<Record<string, unknown>> }) {
  const sorted = [...profiles]
    .filter(p => p.influence_score !== undefined)
    .sort((a, b) => (Number(b.influence_score) || 0) - (Number(a.influence_score) || 0));
  if (sorted.length === 0) return null;
  const maxScore = Math.max(...sorted.map(p => Number(p.influence_score) || 0), 100);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-gm-interactive-primary" /> Influence Scoreboard
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning ml-auto">{sorted.length} ranked</span>
      </h3>
      <div className="space-y-2">
        {sorted.map((profile, i) => {
          const contact = (profile.contact ?? {}) as Record<string, unknown>;
          const name = String(contact.name || profile.person_name || 'Unknown');
          const role = String(contact.role || contact.organization || '');
          const avatarUrl = isValidAvatarUrl(contact.avatar_url) ? contact.avatar_url : isValidAvatarUrl(contact.photo_url) ? contact.photo_url : null;
          const score = Number(profile.influence_score) || 0;
          const barWidth = (score / maxScore) * 100;
          const risk = String(profile.risk_tolerance || 'medium');
          const commStyle = String(profile.communication_style || '');
          const styleSnippet = commStyle.split(';')[0]?.substring(0, 50) || '';

          return (
            <div key={i} className={`flex items-center gap-3 py-1.5 ${i < 3 ? 'bg-[var(--gm-surface-hover)] rounded-lg px-2' : ''}`}>
              <span className="w-6 text-center text-sm">{medals[i] || String(i + 1)}</span>
              <ContactAvatar url={avatarUrl} name={name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gm-text-primary truncate">{name}</p>
                {role && <p className="text-[10px] text-gm-text-tertiary truncate">{role}</p>}
                {styleSnippet && <p className="text-[9px] text-gray-400 truncate italic">{styleSnippet}</p>}
              </div>
              <div className="w-32 flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-gm-surface-secondary rounded-full">
                  <div className="h-1.5 bg-gm-interactive-primary rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                </div>
                <span className="text-[10px] font-mono text-gm-text-tertiary w-6 text-right">{score}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                risk === 'low' ? 'bg-gm-status-success-bg text-gm-status-success' :
                risk === 'high' ? 'bg-gm-status-danger-bg text-gm-status-danger' :
                'bg-gm-status-warning-bg text-gm-status-warning'
              }`}>{risk}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Communication Flow with Person Chips
   ═══════════════════════════════════════════════════════ */
function CommunicationFlowSection({ flow, resolveName }: {
  flow: Record<string, unknown>;
  resolveName: (n: string) => PersonInfo;
}) {
  const bottlenecks = (flow.bottlenecks ?? []) as string[];
  const brokers = (flow.information_brokers ?? []) as string[];
  const central = (flow.central_nodes ?? []) as string[];
  const isolated = (flow.isolated_members ?? []) as string[];

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider mb-3">Communication Flow</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {bottlenecks.length > 0 && (
          <div className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span>🚧</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gm-status-danger">Bottlenecks</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bottlenecks.map((b, i) => <PersonChip key={i} name={b} resolve={resolveName} />)}
            </div>
          </div>
        )}
        {brokers.length > 0 && (
          <div className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span>🔗</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gm-interactive-primary">Info Brokers</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {brokers.map((b, i) => <PersonChip key={i} name={b} resolve={resolveName} />)}
            </div>
            <p className="text-[9px] text-gm-text-tertiary mt-2">Key connectors who bridge information across the team</p>
          </div>
        )}
        {central.length > 0 && (
          <div className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span>⭐</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gm-status-success">Central Nodes</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {central.map((c, i) => <PersonChip key={i} name={c} resolve={resolveName} />)}
            </div>
            <p className="text-[9px] text-gm-text-tertiary mt-2">Most connected team members</p>
          </div>
        )}
        {isolated.length > 0 && (
          <div className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span>🏝️</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gm-status-warning">Isolated</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isolated.map((m, i) => <PersonChip key={i} name={m} resolve={resolveName} />)}
            </div>
            <p className="text-[9px] text-gm-text-tertiary mt-2">Members with fewer connections — may need inclusion</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Influence Map Card - with person chips + type colors
   ═══════════════════════════════════════════════════════ */
function InfluenceMapCard({ items, resolveName }: {
  items: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-gm-interactive-primary" /> Influence Map
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary ml-auto">{items.length} connections</span>
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.slice(0, 10).map((inf, i) => {
          const infType = String(inf.influence_type || 'direct').toLowerCase();
          const config = influenceTypes[infType] || influenceTypes.direct;
          const strengthPct = Math.round((Number(inf.strength) || 0.5) * (Number(inf.strength) <= 1 ? 100 : 1));
          const hasEvidence = !!inf.evidence && String(inf.evidence).length > 10;

          return (
            <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <PersonChip name={String(inf.from_person || inf.from || '?')} resolve={resolveName} />
                <ArrowRight className="w-3.5 h-3.5 text-gm-text-tertiary flex-shrink-0" />
                <PersonChip name={String(inf.to_person || inf.to || '?')} resolve={resolveName} />
                <span className="text-[10px] px-1.5 py-0.5 rounded capitalize ml-auto" style={{ background: config.bg, color: config.color }}>
                  {config.icon} {infType}
                </span>
                <div className="flex items-center gap-1 w-20">
                  <div className="flex-1 h-1 rounded-full bg-gm-surface-secondary">
                    <div className="h-1 rounded-full transition-all" style={{ width: `${strengthPct}%`, background: config.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-gm-text-tertiary">{strengthPct}%</span>
                </div>
                {hasEvidence && (
                  <button onClick={() => toggle(i)} className="text-gm-text-tertiary hover:text-gm-text-primary">
                    {expanded.has(i) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {expanded.has(i) && hasEvidence && (
                <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)]">
                  <p className="text-[10px] text-gm-text-tertiary"><strong>Evidence:</strong> {replacePersonNames(String(inf.evidence), resolveName)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Alliances Card
   ═══════════════════════════════════════════════════════ */
function AlliancesCard({ items, resolveName }: {
  items: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-gm-interactive-primary" /> Alliances
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary ml-auto">{items.length} groups</span>
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.slice(0, 10).map((all, i) => {
          let members = all.members as string[] | string;
          if (typeof members === 'string') members = members.split(/[\s,]+/).filter(Boolean);
          if (!Array.isArray(members)) members = [];
          const aType = String(all.alliance_type || 'natural').toLowerCase();
          const config = allianceTypes[aType] || allianceTypes.natural;
          const strengthPct = Math.round((Number(all.strength) || 0.5) * (Number(all.strength) <= 1 ? 100 : 1));
          const hasExpand = (all.evidence && String(all.evidence).length > 10) || (Array.isArray(all.shared_values) && (all.shared_values as string[]).length > 0);

          return (
            <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(members as string[]).map((m, j) => (
                    <span key={j} className="contents">
                      {j > 0 && <span className="text-[10px] text-gm-text-tertiary">&</span>}
                      <PersonChip name={m} resolve={resolveName} />
                    </span>
                  ))}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded capitalize ml-auto" style={{ background: config.bg, color: config.color }}>
                  {config.icon} {aType}
                </span>
                <div className="flex items-center gap-1 w-20">
                  <div className="flex-1 h-1 rounded-full bg-gm-surface-secondary">
                    <div className="h-1 rounded-full transition-all" style={{ width: `${strengthPct}%`, background: config.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-gm-text-tertiary">{strengthPct}%</span>
                </div>
                {hasExpand && (
                  <button onClick={() => toggle(i)} className="text-gm-text-tertiary hover:text-gm-text-primary">
                    {expanded.has(i) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {expanded.has(i) && (
                <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)] space-y-1">
                  {Array.isArray(all.shared_values) && (all.shared_values as string[]).length > 0 && (
                    <p className="text-[10px] text-gm-text-tertiary"><strong>Shared Values:</strong> {(all.shared_values as string[]).join(', ')}</p>
                  )}
                  {all.evidence && <p className="text-[10px] text-gm-text-tertiary"><strong>Evidence:</strong> {replacePersonNames(String(all.evidence), resolveName)}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Tensions Card
   ═══════════════════════════════════════════════════════ */
function TensionsCard({ items, resolveName }: {
  items: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-gm-status-danger" /> Tensions
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-danger-bg text-gm-status-danger ml-auto">{items.length} identified</span>
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.slice(0, 10).map((t, i) => {
          let between = t.between as string[] | string;
          if (typeof between === 'string') between = between.split(/[\s,]+/).filter(Boolean);
          if (!Array.isArray(between)) between = [];
          const level = String(t.level || 'low').toLowerCase();
          const tType = String(t.tension_type || 'communication').toLowerCase();
          const config = tensionTypes[tType] || tensionTypes.communication;
          const hasExpand = (t.evidence && String(t.evidence).length > 10) || (Array.isArray(t.triggers) && (t.triggers as string[]).length > 0);

          return (
            <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(between as string[]).slice(0, 2).map((p, j) => (
                    <span key={j} className="contents">
                      {j > 0 && <span className="text-[10px] text-gm-text-tertiary">↔</span>}
                      <PersonChip name={p} resolve={resolveName} />
                    </span>
                  ))}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded capitalize ml-auto" style={{ background: config.bg, color: config.color }}>
                  {config.icon} {tType}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                  level === 'high' ? 'bg-gm-status-danger-bg text-gm-status-danger' :
                  level === 'medium' ? 'bg-gm-status-warning-bg text-gm-status-warning' :
                  'bg-gm-status-success-bg text-gm-status-success'
                }`}>{level}</span>
                {hasExpand && (
                  <button onClick={() => toggle(i)} className="text-gm-text-tertiary hover:text-gm-text-primary">
                    {expanded.has(i) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {expanded.has(i) && (
                <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)] space-y-1">
                  {Array.isArray(t.triggers) && (t.triggers as string[]).length > 0 && (
                    <p className="text-[10px] text-gm-text-tertiary"><strong>Triggers:</strong> {(t.triggers as string[]).join(', ')}</p>
                  )}
                  {t.evidence && <p className="text-[10px] text-gm-text-tertiary"><strong>Evidence:</strong> {replacePersonNames(String(t.evidence), resolveName)}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Power Centers Card
   ═══════════════════════════════════════════════════════ */
function PowerCentersCard({ items, resolveName }: {
  items: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-gm-interactive-primary" /> Power Centers
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary ml-auto">{items.length} key players</span>
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.slice(0, 10).map((pc, i) => {
          const pType = String(pc.power_type || 'informal').toLowerCase();
          const config = powerTypes[pType] || powerTypes.informal;
          const reachPct = Math.round(Number(pc.influence_reach ?? 50));
          const hasDeps = Array.isArray(pc.dependencies) && (pc.dependencies as string[]).length > 0;

          return (
            <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <PersonChip name={String(pc.person || '?')} resolve={resolveName} />
                <span className="text-[10px] px-1.5 py-0.5 rounded capitalize ml-auto" style={{ background: config.bg, color: config.color }}>
                  {config.icon} {pType}
                </span>
                <div className="flex items-center gap-1 w-20">
                  <div className="flex-1 h-1 rounded-full bg-gm-surface-secondary">
                    <div className="h-1 rounded-full transition-all" style={{ width: `${reachPct}%`, background: config.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-gm-text-tertiary">{reachPct}%</span>
                </div>
                {hasDeps && (
                  <button onClick={() => toggle(i)} className="text-gm-text-tertiary hover:text-gm-text-primary">
                    {expanded.has(i) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {expanded.has(i) && hasDeps && (
                <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)]">
                  <p className="text-[10px] text-gm-text-tertiary"><strong>Power Sources:</strong> {(pc.dependencies as string[]).join(', ')}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Relationships Tab
   ═══════════════════════════════════════════════════════ */
function RelationshipsTab({ data, isLoading, profiles, resolveName }: {
  data: unknown;
  isLoading: boolean;
  profiles: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  if (isLoading) return <Spinner />;
  const rels = ((data as Record<string, unknown>)?.relationships ?? []) as Array<Record<string, unknown>>;
  if (rels.length === 0) return <EmptyState icon={Network} message="No relationship data. Process documents to discover team relationships." />;

  const edgeColors: Record<string, string> = {
    influences: '#3b82f6',
    aligned_with: '#22c55e',
    tension_with: '#ef4444',
    collaborates: '#8b5cf6',
  };

  const resolveRelName = (rel: Record<string, unknown>, direction: 'from' | 'to'): string => {
    const contactObj = rel[`${direction}_contact`] as Record<string, unknown> | undefined;
    if (contactObj && typeof contactObj === 'object' && contactObj.name) return String(contactObj.name);
    const personObj = rel[`${direction}_person`] as Record<string, unknown> | undefined;
    if (personObj && typeof personObj === 'object' && personObj.name) return String(personObj.name);
    const directName = rel[direction] || rel[`${direction}_person`] || rel[`${direction}_contact`];
    if (directName && typeof directName === 'string') return directName;
    const contactId = rel[`${direction}_contact_id`] || rel[`${direction}_person_id`];
    if (contactId) {
      const profile = profiles.find(p => String(p.contact_id || p.person_id) === String(contactId));
      if (profile) {
        const contact = (profile.contact ?? {}) as Record<string, unknown>;
        return String(contact.name || profile.person_name || contactId);
      }
    }
    return '?';
  };

  return (
    <div className="space-y-2">
      {rels.map((rel, i) => {
        const relType = String(rel.type || rel.relationship_type || rel.label || 'related');
        const edgeColor = edgeColors[relType] || '#6b7280';
        const fromName = resolveRelName(rel, 'from');
        const toName = resolveRelName(rel, 'to');
        const evidence = rel.evidence as Array<Record<string, unknown>> | string | undefined;
        const evidenceCount = Number(rel.evidence_count || (Array.isArray(evidence) ? evidence.length : 0));

        return (
          <div key={i} className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                <PersonChip name={fromName} resolve={resolveName} />
                <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: edgeColor }} />
                <PersonChip name={toName} resolve={resolveName} />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full capitalize flex-shrink-0" style={{ background: edgeColor + '15', color: edgeColor }}>
                {relType.replace(/_/g, ' ')}
              </span>
              {rel.strength !== undefined && (
                <div className="flex items-center gap-1.5 w-24">
                  <div className="flex-1 h-1.5 bg-gm-surface-secondary rounded-full">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.round(Number(rel.strength) * (Number(rel.strength) <= 1 ? 100 : 1))}%`, background: edgeColor }} />
                  </div>
                  <span className="text-[10px] font-mono text-gm-text-tertiary">{Math.round(Number(rel.strength) * (Number(rel.strength) <= 1 ? 100 : 1))}%</span>
                </div>
              )}
              {rel.confidence && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary capitalize">{String(rel.confidence)}</span>
              )}
            </div>
            {/* Evidence and extra info */}
            {(evidenceCount > 0 || (typeof evidence === 'string' && evidence.length > 0)) && (
              <div className="mt-2 pt-2 border-t border-[var(--gm-border-primary)]">
                {typeof evidence === 'string' && evidence.length > 0 && (
                  <p className="text-[10px] text-gm-text-tertiary">{evidence}</p>
                )}
                {Array.isArray(evidence) && evidence.length > 0 && (
                  <div className="space-y-1">
                    {evidence.slice(0, 3).map((e, j) => (
                      <p key={j} className="text-[10px] text-gm-text-tertiary">
                        {e.quote && <span className="italic">"{String(e.quote)}" </span>}
                        {e.observation && <span>{String(e.observation)}</span>}
                        {e.timestamp && <span className="text-gray-400 ml-1">({String(e.timestamp)})</span>}
                      </p>
                    ))}
                    {evidence.length > 3 && <p className="text-[9px] text-gray-500">+{evidence.length - 3} more evidence items</p>}
                  </div>
                )}
                {evidenceCount > 0 && !evidence && (
                  <p className="text-[10px] text-gm-text-tertiary">{evidenceCount} evidence items</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Network Graph Tab - Force-directed with drag, hover, HiDPI
   ═══════════════════════════════════════════════════════ */
const GRAPH_EDGE_STYLES: Record<string, { color: string; dash: boolean; label: string }> = {
  influences: { color: '#3b82f6', dash: false, label: 'influences' },
  aligned_with: { color: '#22c55e', dash: false, label: 'allied' },
  tension_with: { color: '#ef4444', dash: true, label: 'tension' },
  defers_to: { color: '#8b5cf6', dash: false, label: 'defers to' },
  competes_with: { color: '#f59e0b', dash: true, label: 'competes' },
  mentors: { color: '#06b6d4', dash: false, label: 'mentors' },
  supports: { color: '#10b981', dash: false, label: 'supports' },
};

function canvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function graphNodeRadius(node: Record<string, unknown>) {
  const props = (node.properties ?? {}) as Record<string, unknown>;
  return 22 + (Number(props.influenceScore ?? node.influence_score ?? node.size ?? 50) / 12);
}

function NetworkGraphTab({ data, isLoading, profiles, resolveName }: {
  data: unknown;
  isLoading: boolean;
  profiles: Array<Record<string, unknown>>;
  resolveName: (n: string) => PersonInfo;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const graphData = data as { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> } | null;
  const nodes = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const edges = useMemo(() => graphData?.edges ?? [], [graphData]);

  const profileLookup = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {};
    profiles.forEach(p => {
      const id = String(p.contact_id || p.person_id || '');
      if (id) map[id] = p;
    });
    return map;
  }, [profiles]);

  const nodeConnections = useMemo(() => {
    const map: Record<string, Array<{ type: string; target: string; targetId: string; direction: 'out' | 'in'; strength: number }>> = {};
    edges.forEach(edge => {
      const fromId = String(edge.from ?? edge.source);
      const toId = String(edge.to ?? edge.target);
      const type = String(edge.type || edge.label || edge.relationship_type || 'related');
      const strength = Number(edge.strength ?? edge.value ?? 0.5);
      const fromNode = nodes.find(nd => String(nd.id) === fromId);
      const toNode = nodes.find(nd => String(nd.id) === toId);
      if (!map[fromId]) map[fromId] = [];
      if (!map[toId]) map[toId] = [];
      map[fromId].push({ type, target: String(toNode?.label || toNode?.name || '?'), targetId: toId, direction: 'out', strength });
      map[toId].push({ type, target: String(fromNode?.label || fromNode?.name || '?'), targetId: fromId, direction: 'in', strength });
    });
    return map;
  }, [nodes, edges]);

  const sim = useRef({
    pos: [] as Array<{ x: number; y: number; vx: number; vy: number }>,
    alpha: 1,
    drag: -1,
    dragStartX: 0,
    dragStartY: 0,
    hovered: -1,
    w: 800,
    h: 500,
    frameId: 0,
  });
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedNode ? String(selectedNode.id) : null; }, [selectedNode]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const s = sim.current;
    s.w = container.clientWidth || 800;
    s.h = 500;
    const n = nodes.length;

    s.pos = nodes.map((_, i) => ({
      x: s.w / 2 + Math.cos(2 * Math.PI * i / n) * s.w * 0.2 + (Math.random() - 0.5) * 60,
      y: s.h / 2 + Math.sin(2 * Math.PI * i / n) * s.h * 0.25 + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0,
    }));
    s.alpha = 1;

    const nodeMap = new Map<string, number>();
    nodes.forEach((nd, i) => nodeMap.set(String(nd.id), i));

    let running = true;

    function step() {
      s.alpha *= 0.992;
      if (s.alpha < 0.002) return;

      const fx = new Float64Array(n);
      const fy = new Float64Array(n);

      const repK = 5500;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = s.pos[j].x - s.pos[i].x;
          const dy = s.pos[j].y - s.pos[i].y;
          const d2 = Math.max(dx * dx + dy * dy, 100);
          const d = Math.sqrt(d2);
          const f = repK / d2;
          const fxv = (dx / d) * f, fyv = (dy / d) * f;
          fx[i] -= fxv; fy[i] -= fyv;
          fx[j] += fxv; fy[j] += fyv;
        }
      }

      const attK = 0.04;
      const ideal = Math.min(200, Math.max(120, s.w / (n + 1)));
      edges.forEach(edge => {
        const fi = nodeMap.get(String(edge.from ?? edge.source));
        const ti = nodeMap.get(String(edge.to ?? edge.target));
        if (fi === undefined || ti === undefined) return;
        const dx = s.pos[ti].x - s.pos[fi].x;
        const dy = s.pos[ti].y - s.pos[fi].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const disp = d - ideal;
        const str = Number(edge.strength ?? edge.value ?? 0.5);
        const fv = attK * disp * (0.5 + str);
        const fxv = (dx / d) * fv, fyv = (dy / d) * fv;
        fx[fi] += fxv; fy[fi] += fyv;
        fx[ti] -= fxv; fy[ti] -= fyv;
      });

      const grav = 0.012;
      const cx = s.w / 2, cy = s.h / 2;
      for (let i = 0; i < n; i++) {
        fx[i] += (cx - s.pos[i].x) * grav;
        fy[i] += (cy - s.pos[i].y) * grav;
      }

      const damp = 0.55;
      for (let i = 0; i < n; i++) {
        if (s.drag === i) { s.pos[i].vx = 0; s.pos[i].vy = 0; continue; }
        s.pos[i].vx = (s.pos[i].vx + fx[i] * s.alpha) * damp;
        s.pos[i].vy = (s.pos[i].vy + fy[i] * s.alpha) * damp;
        s.pos[i].x += s.pos[i].vx;
        s.pos[i].y += s.pos[i].vy;
        const r = graphNodeRadius(nodes[i]) + 12;
        s.pos[i].x = Math.max(r, Math.min(s.w - r, s.pos[i].x));
        s.pos[i].y = Math.max(r, Math.min(s.h - r - 16, s.pos[i].y));
      }
    }

    function draw() {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const tw = Math.round(s.w * dpr), th = Math.round(s.h * dpr);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
        canvas.style.width = `${s.w}px`;
        canvas.style.height = `${s.h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      if (s.pos.length === 0) return;

      const selId = selectedIdRef.current;
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--gm-text-primary').trim() || '#e2e8f0';
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--gm-surface-primary').trim() || '#1e293b';

      edges.forEach(edge => {
        const fi = nodeMap.get(String(edge.from ?? edge.source));
        const ti = nodeMap.get(String(edge.to ?? edge.target));
        if (fi === undefined || ti === undefined || !s.pos[fi] || !s.pos[ti]) return;

        const eType = String(edge.type || edge.label || edge.relationship_type || '');
        const st = GRAPH_EDGE_STYLES[eType] || { color: '#94a3b8', dash: false, label: eType.replace(/_/g, ' ') };
        const relSel = selId && (String(edge.from ?? edge.source) === selId || String(edge.to ?? edge.target) === selId);
        const opSuffix = selId ? (relSel ? 'dd' : '18') : '70';

        const fp = s.pos[fi], tp = s.pos[ti];
        const dx = tp.x - fp.x, dy = tp.y - fp.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const fromR = graphNodeRadius(nodes[fi]);
        const toR = graphNodeRadius(nodes[ti]);
        const lineFromX = fp.x + (dx / dist) * fromR;
        const lineFromY = fp.y + (dy / dist) * fromR;
        const lineToX = tp.x - (dx / dist) * toR;
        const lineToY = tp.y - (dy / dist) * toR;
        const strength = Number(edge.strength ?? edge.value ?? 0.5);

        ctx.save();
        ctx.beginPath();
        if (st.dash) ctx.setLineDash([6, 4]);
        ctx.moveTo(lineFromX, lineFromY);
        ctx.lineTo(lineToX, lineToY);
        ctx.strokeStyle = st.color + opSuffix;
        ctx.lineWidth = Math.max(1.5, strength * 4);
        ctx.stroke();
        if (st.dash) ctx.setLineDash([]);

        if ((eType === 'influences' || eType === 'defers_to' || eType === 'mentors') && dist > fromR + toR + 20) {
          const angle = Math.atan2(dy, dx);
          const al = 10;
          ctx.beginPath();
          ctx.moveTo(lineToX, lineToY);
          ctx.lineTo(lineToX - al * Math.cos(angle - 0.45), lineToY - al * Math.sin(angle - 0.45));
          ctx.lineTo(lineToX - al * Math.cos(angle + 0.45), lineToY - al * Math.sin(angle + 0.45));
          ctx.closePath();
          ctx.fillStyle = st.color + opSuffix;
          ctx.fill();
        }

        if (dist > 90 && (relSel || !selId)) {
          const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const labelW = ctx.measureText(st.label).width + 8;
          ctx.fillStyle = bgColor;
          ctx.globalAlpha = 0.85;
          canvasRoundRect(ctx, mx - labelW / 2, my - 7, labelW, 14, 3);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = st.color;
          ctx.fillText(st.label, mx, my);
        }
        ctx.restore();
      });

      nodes.forEach((node, i) => {
        if (!s.pos[i]) return;
        const { x, y } = s.pos[i];
        const r = graphNodeRadius(node);
        const label = String(node.label || node.name || '?');
        const color = stringToColor(label);
        const isSel = selId === String(node.id);
        const isHov = s.hovered === i;
        const isConn = !!selId && !!nodeConnections[selId]?.some(c => c.targetId === String(node.id));
        const dimmed = !!selId && !isSel && !isConn;

        ctx.save();
        if (dimmed) ctx.globalAlpha = 0.22;

        if (isSel) { ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 18; }
        else if (isHov) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
        else { ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; }

        const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
        grad.addColorStop(0, adjustColor(color, 25));
        grad.addColorStop(1, adjustColor(color, -35));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = isSel ? '#f59e0b' : isHov ? '#fff' : 'rgba(255,255,255,0.45)';
        ctx.lineWidth = isSel ? 3 : isHov ? 2.5 : 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(11, r * 0.52)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getInitials(label), x, y);

        const ly = y + r + 14;
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const lw = ctx.measureText(label).width + 10;
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = dimmed ? 0.15 : 0.75;
        canvasRoundRect(ctx, x - lw / 2, ly - 7, lw, 14, 3);
        ctx.fill();
        ctx.globalAlpha = dimmed ? 0.22 : 1;
        ctx.fillStyle = textColor;
        ctx.fillText(label, x, ly);
        ctx.restore();
      });
    }

    function loop() {
      if (!running) return;
      step();
      draw();
      s.frameId = requestAnimationFrame(loop);
    }
    s.frameId = requestAnimationFrame(loop);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(entries => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const entry of entries) {
          const newW = entry.contentRect.width;
          if (newW > 0 && Math.abs(newW - s.w) > 5) {
            const scale = newW / s.w;
            s.w = newW;
            s.pos.forEach(p => { p.x *= scale; });
            s.alpha = Math.max(s.alpha, 0.3);
          }
        }
      }, 100);
    });
    observer.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(s.frameId);
      observer.disconnect();
      clearTimeout(resizeTimer);
    };
  }, [nodes, edges, nodeConnections]);

  const findNode = useCallback((mx: number, my: number) => {
    const s2 = sim.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (!s2.pos[i]) continue;
      const r = graphNodeRadius(nodes[i]) + 3;
      const dx = mx - s2.pos[i].x, dy = my - s2.pos[i].y;
      if (dx * dx + dy * dy <= r * r) return i;
    }
    return -1;
  }, [nodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const idx = findNode(mx, my);
    if (idx >= 0) {
      const s2 = sim.current;
      s2.drag = idx;
      s2.dragStartX = mx;
      s2.dragStartY = my;
      s2.alpha = Math.max(s2.alpha, 0.08);
      canvasRef.current.style.cursor = 'grabbing';
    }
  }, [findNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const s2 = sim.current;
    if (s2.drag >= 0 && s2.pos[s2.drag]) {
      s2.pos[s2.drag].x = mx;
      s2.pos[s2.drag].y = my;
      return;
    }
    const idx = findNode(mx, my);
    if (idx !== s2.hovered) {
      s2.hovered = idx;
      canvasRef.current.style.cursor = idx >= 0 ? 'grab' : 'default';
    }
  }, [findNode]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const s2 = sim.current;
    const wasDragging = s2.drag >= 0;
    const dragIdx = s2.drag;
    s2.drag = -1;
    canvasRef.current.style.cursor = 'default';

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (wasDragging) {
      const moved = Math.sqrt((mx - s2.dragStartX) ** 2 + (my - s2.dragStartY) ** 2);
      if (moved < 6) setSelectedNode(nodes[dragIdx] || null);
      return;
    }
    const idx = findNode(mx, my);
    setSelectedNode(idx >= 0 ? nodes[idx] : null);
  }, [findNode, nodes]);

  const handleMouseLeave = useCallback(() => {
    sim.current.drag = -1;
    sim.current.hovered = -1;
  }, []);

  if (isLoading) return <Spinner />;
  if (nodes.length === 0) return <EmptyState icon={Network} message="No network data. Analyze profiles and sync graph to build the network." />;

  const selectedProfile = selectedNode ? profileLookup[String(selectedNode.id)] : null;
  const selectedConns = selectedNode ? nodeConnections[String(selectedNode.id)] ?? [] : [];

  return (
    <div className="flex gap-3">
      <div className="flex-1 bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gm-text-primary uppercase tracking-wider flex items-center gap-2">
            <Network className="w-4 h-4 text-gm-interactive-primary" /> Team Network
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary">{nodes.length} nodes, {edges.length} edges</span>
          </h3>
        </div>

        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(GRAPH_EDGE_STYLES)
            .filter(([t]) => edges.some(e => String(e.type || e.label || e.relationship_type || '') === t))
            .map(([t, st]) => (
              <div key={t} className="flex items-center gap-1.5">
                <div className={`w-5 h-0.5 rounded ${st.dash ? 'border-t-2 border-dashed' : ''}`}
                  style={st.dash ? { borderColor: st.color } : { background: st.color }} />
                <span className="text-[10px] text-gm-text-tertiary capitalize">{st.label}</span>
              </div>
            ))}
        </div>

        <div ref={containerRef} className="bg-[var(--gm-surface-hover)] rounded-lg overflow-hidden">
          <canvas ref={canvasRef} style={{ height: 500, width: '100%', display: 'block' }}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} />
        </div>
        <p className="text-[9px] text-gm-text-tertiary mt-1.5 text-center">Drag nodes to rearrange · Click a node for details</p>
      </div>

      <div className="w-72 bg-gm-surface-primary border border-gm-border-primary rounded-xl p-4 flex-shrink-0">
        {selectedNode ? (
          <NodeDetailPanel node={selectedNode} profile={selectedProfile} resolveName={resolveName} connections={selectedConns} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gm-text-tertiary">
            <Network className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-xs text-center font-medium mb-1">Select a Team Member</p>
            <p className="text-[10px] text-center text-gray-500">Click on a node to view their profile and connections.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Node Detail Panel (Graph side panel)
   ═══════════════════════════════════════════════════════ */
function NodeDetailPanel({ node, profile, resolveName, connections }: {
  node: Record<string, unknown>;
  profile: Record<string, unknown> | undefined;
  resolveName: (n: string) => PersonInfo;
  connections: Array<{ type: string; target: string; targetId: string; direction: 'out' | 'in'; strength: number }>;
}) {
  const nodeProps = (node.properties ?? {}) as Record<string, unknown>;
  const name = String(node.label || node.name || 'Unknown');
  const contact = profile ? (profile.contact ?? {}) as Record<string, unknown> : {};
  const role = String(contact.role || contact.organization || nodeProps.role || '');
  const org = String(contact.organization || nodeProps.organization || '');
  const influenceScore = Number(profile?.influence_score ?? nodeProps.influenceScore ?? node.influence_score ?? 0);
  const commStyle = String(profile?.communication_style || nodeProps.communicationStyle || '');
  const motivation = String(profile?.dominant_motivation || nodeProps.dominantMotivation || '');
  const riskTolerance = String(profile?.risk_tolerance || nodeProps.riskTolerance || '');
  const avatarUrl = isValidAvatarUrl(contact.avatar_url) ? String(contact.avatar_url) : isValidAvatarUrl(contact.photo_url) ? String(contact.photo_url) : null;

  const edgeColors: Record<string, string> = {
    influences: '#3b82f6', aligned_with: '#22c55e', tension_with: '#ef4444',
    defers_to: '#8b5cf6', competes_with: '#f59e0b', mentors: '#06b6d4', supports: '#10b981',
  };

  return (
    <div className="space-y-3 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-3">
        <ContactAvatar url={avatarUrl} name={name} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gm-text-primary truncate">{name}</p>
          {role && <p className="text-[10px] text-gm-text-tertiary">{role}</p>}
          {org && org !== role && <p className="text-[10px] text-gm-text-tertiary">{org}</p>}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-1">Influence</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gm-surface-secondary rounded-full">
            <div className="h-2 bg-gm-interactive-primary rounded-full transition-all" style={{ width: `${Math.min(100, influenceScore)}%` }} />
          </div>
          <span className="text-xs font-bold text-gm-text-primary">{influenceScore}</span>
        </div>
      </div>

      {riskTolerance && riskTolerance !== 'undefined' && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">Risk Tolerance</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
            riskTolerance === 'low' ? 'bg-gm-status-success-bg text-gm-status-success' :
            riskTolerance === 'high' ? 'bg-gm-status-danger-bg text-gm-status-danger' :
            'bg-gm-status-warning-bg text-gm-status-warning'
          }`}>{riskTolerance}</span>
        </div>
      )}

      {commStyle && (
        <div>
          <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-0.5">Communication</p>
          <p className="text-xs text-gm-text-primary leading-relaxed">{commStyle.substring(0, 120)}{commStyle.length > 120 ? '...' : ''}</p>
        </div>
      )}

      {motivation && (
        <div>
          <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-0.5">Motivation</p>
          <p className="text-xs text-gm-text-primary">{motivation}</p>
        </div>
      )}

      {connections.length > 0 && (
        <div className="pt-2 border-t border-gm-border-primary">
          <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-2">
            Connections <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gm-surface-secondary ml-1">{connections.length}</span>
          </p>
          <div className="space-y-1">
            {connections.map((conn, j) => {
              const color = edgeColors[conn.type] || '#6b7280';
              return (
                <div key={j} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[var(--gm-surface-hover)]">
                  <span className="text-[10px]" style={{ color }}>{conn.direction === 'out' ? '→' : '←'}</span>
                  <span className="text-[10px] text-gm-text-primary flex-1 truncate">{conn.target}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded capitalize" style={{ background: color + '15', color }}>
                    {conn.type.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Analyze Contacts Modal
   ═══════════════════════════════════════════════════════ */
function AnalyzeContactsModal({ open, onClose, existingProfileIds }: {
  open: boolean; onClose: () => void; existingProfileIds: Set<string>;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const contacts = useContacts();
  const analyzeProfile = useAnalyzeProfile();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });

  const contactList = useMemo(() => {
    const list = (contacts.data?.contacts ?? []) as Array<Record<string, unknown>>;
    const sorted = [...list].sort((a, b) => {
      const aAnalyzed = existingProfileIds.has(String(a.id));
      const bAnalyzed = existingProfileIds.has(String(b.id));
      if (aAnalyzed !== bAnalyzed) return aAnalyzed ? 1 : -1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    if (!search) return sorted;
    return sorted.filter(c => JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));
  }, [contacts.data, search, existingProfileIds]);

  const toggleContact = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectUnanalyzed = () => {
    const ids = contactList.filter(c => !existingProfileIds.has(String(c.id))).map(c => String(c.id));
    setSelected(new Set(ids));
  };

  const handleAnalyze = async () => {
    if (selected.size === 0) return;
    setAnalyzing(true);
    const ids = Array.from(selected);
    setProgress({ done: 0, total: ids.length, current: '' });
    let success = 0, errors = 0;

    for (const id of ids) {
      const contact = contactList.find(c => String(c.id) === id);
      const name = String(contact?.name || 'Contact');
      setProgress(p => ({ ...p, current: name }));
      try {
        await analyzeProfile.mutateAsync({ personId: id, forceReanalysis: true });
        success++;
      } catch {
        errors++;
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }

    setAnalyzing(false);
    if (success > 0) toast.success(`Analyzed ${success} member${success > 1 ? 's' : ''}`);
    if (errors > 0) toast.error(`Failed for ${errors} member${errors > 1 ? 's' : ''}`);
    setSelected(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !analyzing && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogTitle className="sr-only">Analyze Team Members</DialogTitle>
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-gm-text-primary">Analyze Team Members</h2>
          <p className="text-xs text-gm-text-tertiary mt-1">Select members to analyze with AI behavioral profiling.</p>
          <p className="text-[10px] text-gm-text-tertiary mt-0.5">
            {contactList.length} contacts &middot; {existingProfileIds.size} analyzed
          </p>
        </div>

        <div className="px-5 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
              className="w-full pl-9 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
          </div>
          <button onClick={selectUnanalyzed}
            className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs hover:bg-gm-surface-hover transition-colors border border-gm-border-primary whitespace-nowrap">
            Select Unanalyzed
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto px-5 space-y-1">
          {contacts.isLoading && <Spinner />}
          {contactList.map(contact => {
            const id = String(contact.id);
            const name = String(contact.name || 'Unknown');
            const role = String(contact.role || contact.organization || '');
            const avatarUrl = isValidAvatarUrl(contact.avatar_url) ? String(contact.avatar_url) : isValidAvatarUrl(contact.photo_url) ? String(contact.photo_url) : null;
            const hasProfile = existingProfileIds.has(id);
            const isSelected = selected.has(id);
            return (
              <label key={id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/5 border border-blue-600/20' : 'hover:bg-gm-surface-hover border border-transparent'}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleContact(id)}
                  className="w-3.5 h-3.5 rounded accent-gm-interactive-primary" />
                <ContactAvatar url={avatarUrl} name={name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gm-text-primary truncate">{name}</p>
                  {role && <p className="text-[10px] text-gm-text-tertiary">{role}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${hasProfile ? 'bg-gm-status-success-bg text-gm-status-success' : 'bg-gm-surface-secondary text-gm-text-tertiary'}`}>
                  {hasProfile ? 'Analyzed' : 'Not analyzed'}
                </span>
              </label>
            );
          })}
          {!contacts.isLoading && contactList.length === 0 && (
            <p className="text-xs text-gm-text-tertiary text-center py-4">No contacts found.</p>
          )}
        </div>

        {analyzing && (
          <div className="px-5 py-3 border-t border-gm-border-primary">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gm-text-primary">{progress.current}...</span>
              <span className="text-[10px] text-gm-text-tertiary">{progress.done}/{progress.total}</span>
            </div>
            <div className="w-full bg-gm-surface-secondary rounded-full h-1.5">
              <div className="bg-gm-interactive-primary h-1.5 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gm-border-primary flex items-center justify-between">
          <span className="text-xs text-gm-text-tertiary">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={analyzing}
              className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-xs hover:bg-gm-surface-hover transition-colors">Cancel</button>
            <button onClick={handleAnalyze} disabled={selected.size === 0 || analyzing}
              className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {analyzing ? `Analyzing ${progress.done}/${progress.total}...` : `Analyze Selected (${selected.size})`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════
   Shared UI Components
   ═══════════════════════════════════════════════════════ */
function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-8 text-center text-gm-text-tertiary">
      <Icon className="h-12 w-12 mx-auto mb-4 text-gray-500" />
      {message}
    </div>
  );
}
