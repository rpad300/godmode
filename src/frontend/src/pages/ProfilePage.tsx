/**
 * Purpose:
 *   User profile management page with four sections: General (account info, preferences),
 *   Security (password change, account deletion), Sessions (active login sessions),
 *   and Integrations (Krisp AI webhook configuration).
 *
 * Responsibilities:
 *   - General: edit username, display name, bio, avatar URL, timezone, language; save via API
 *   - Security: change password with validation, "danger zone" account deletion prompt
 *   - Sessions: display current browser session (hardcoded single session); sign-out-all action
 *   - Integrations: Krisp webhook URL + auth token display, copy-to-clipboard, MCP import button,
 *     transcript stats, credential regeneration prompt
 *
 * Key dependencies:
 *   - useUser: profile data and updateProfile mutation
 *   - useAuth (AuthContext): resetPassword, logout
 *   - framer-motion: section transition animations
 *
 * Side effects:
 *   - Network: profile updates, password reset, logout
 *   - Clipboard: copies webhook URL and auth token
 *
 * Notes:
 *   - Sessions section currently only shows the current browser session (navigator.userAgent);
 *     multi-session tracking is not yet implemented.
 *   - The auth token in IntegrationsSection is hardcoded as a placeholder.
 *   - Account deletion is not implemented; it shows a toast directing the user to an admin.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Lock, Monitor, Link2, Mail, AtSign, Type, AlignLeft, Image,
  Globe, Languages, Key, AlertTriangle, Trash2, LogOut, Mic,
  Check, Loader2, ChevronRight, Building2, Plus, Eye, Edit2,
  Zap, ArrowLeft, RefreshCw, Code2, Palette, Sparkles, Info,
  UserCog, Clock, Shield,
  ExternalLink, CheckCircle2, XCircle, Download, Calendar,
  ChevronDown, ChevronUp, FileText, ListChecks, Lightbulb, Headphones
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { cn, getInitials, isValidAvatarUrl } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useKrispOAuthStatus,
  useKrispOAuthAuthorize,
  useKrispOAuthDisconnect,
  useKrispOAuthMeetings,
  useKrispOAuthImportMeetings,
  useKrispMeetingPreview,
  type KrispMeeting,
  type KrispImportOptions,
  useProjects,
} from '@/hooks/useGodMode';

// ── Style tokens (aligned with AdminPage) ────────────────────────────────────

type ProfileSection = 'general' | 'security' | 'sessions' | 'integrations' | 'companies' | 'settings';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
const LABEL = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1.5';

const NAV_ITEMS = [
  { id: 'general' as const, label: 'General', icon: User },
  { id: 'security' as const, label: 'Security', icon: Lock },
  { id: 'sessions' as const, label: 'Sessions', icon: Monitor },
  { id: 'settings' as const, label: 'User Settings', icon: Sparkles },
  { id: 'companies' as const, label: 'Companies', icon: Building2 },
  { id: 'integrations' as const, label: 'Integrations', icon: Link2 },
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

const ProfilePage = () => {
  const { user, isLoading } = useUser();
  const [activeSection, setActiveSection] = useState<ProfileSection>('general');

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--gm-accent-primary)]" /></div>;
  }

  const initials = getInitials(user?.display_name || user?.email || '');

  return (
    <div className="flex h-full">
      {/* Side Nav */}
      <div className="w-48 shrink-0 border-r border-[var(--gm-border-primary)] bg-[var(--gm-bg-primary)] overflow-y-auto">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--gm-border-primary)]">
          {isValidAvatarUrl(user?.avatar_url) ? (
            <img src={user!.avatar_url!} alt={user?.display_name || ''} className="w-7 h-7 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[var(--gm-interactive-primary)]/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[var(--gm-accent-primary)]">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <span className="text-sm font-bold text-[var(--gm-accent-primary)]">Profile</span>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] truncate">{user?.email}</p>
          </div>
        </div>
        <nav className="py-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={cn('w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors',
                  active ? 'text-[var(--gm-accent-primary)] bg-[var(--gm-surface-hover)] font-semibold' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]')}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === 'general' && <GeneralSection />}
        {activeSection === 'security' && <SecuritySection />}
        {activeSection === 'sessions' && <SessionsSection />}
        {activeSection === 'settings' && <UserSettingsSection />}
        {activeSection === 'companies' && <CompaniesSection />}
        {activeSection === 'integrations' && <IntegrationsSection />}
      </div>
    </div>
  );
};

// ==================== GENERAL ====================

function GeneralSection() {
  const { user, updateProfile, uploadAvatar, deleteAvatar } = useUser();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [timezone, setTimezone] = useState('Europe/Lisbon');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setDisplayName(user.display_name || '');
      setAvatarUrl(user.avatar_url || '');
      setTimezone(user.timezone || 'Europe/Lisbon');
    }
  }, [user]);

  const handleSave = async () => {
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      toast.error('Username must be 3-30 characters, alphanumeric and underscores only');
      return;
    }
    if (displayName && displayName.trim().length < 2) {
      toast.error('Display name must be at least 2 characters');
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        username,
        display_name: displayName,
        avatar_url: avatarUrl || undefined,
        timezone,
      });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="General" subtitle="Manage your account information and preferences" />

      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={SECTION_TITLE}>Account Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}><Mail className="w-3 h-3" /> Email</label>
            <input value={user?.email || ''} readOnly className={cn(INPUT, 'opacity-60 cursor-not-allowed')} />
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className={LABEL}><AtSign className="w-3 h-3" /> Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div>
          <label className={LABEL}><Type className="w-3 h-3" /> Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={INPUT} />
        </div>

        <div>
          <label className={LABEL}><AlignLeft className="w-3 h-3" /> Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us a bit about yourself" rows={3}
            className={cn(INPUT, 'resize-y')} />
        </div>

        <div>
          <label className={LABEL}><Image className="w-3 h-3" /> Avatar</label>
          <div className="mt-2">
            <AvatarUpload
              currentUrl={avatarUrl}
              name={displayName || username || user?.email || ''}
              onUpload={async (file) => {
                const url = await uploadAvatar.mutateAsync(file);
                setAvatarUrl(url);
                toast.success('Avatar uploaded');
                return url;
              }}
              onUrlChange={(url) => {
                setAvatarUrl(url);
                toast.info('URL set — click Save to apply');
              }}
              onRemove={async () => {
                await deleteAvatar.mutateAsync();
                setAvatarUrl('');
                toast.success('Avatar removed');
              }}
              size="lg"
            />
          </div>
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}><Globe className="w-3 h-3" /> Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className={INPUT}>
              <option value="Europe/Lisbon">Lisbon, Portugal (+00:00)</option>
              <option value="Europe/London">London, UK (+00:00)</option>
              <option value="Europe/Paris">Paris, France (+01:00)</option>
              <option value="Europe/Berlin">Berlin, Germany (+01:00)</option>
              <option value="America/New_York">New York, USA (-05:00)</option>
              <option value="America/Los_Angeles">Los Angeles, USA (-08:00)</option>
              <option value="Asia/Tokyo">Tokyo, Japan (+09:00)</option>
              <option value="Australia/Sydney">Sydney, Australia (+11:00)</option>
            </select>
          </div>
          <div>
            <label className={LABEL}><Languages className="w-3 h-3" /> Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} className={INPUT}>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SECURITY ====================

function SecuritySection() {
  const { resetPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setUpdating(true);
    try {
      await resetPassword(newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAccount = () => {
    toast.error('Account deletion requires contacting an administrator');
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Security" subtitle="Manage your password and account security" />

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Change Password</h3>
        <div>
          <label className={LABEL}><Key className="w-3 h-3" /> Current Password</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={INPUT} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={INPUT} />
          </div>
        </div>
        <p className="text-[10px] text-[var(--gm-accent-primary)]">Minimum 6 characters</p>
        <div className="flex justify-end pt-2">
          <button onClick={handleUpdatePassword} disabled={updating} className={BTN_PRIMARY}>
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            {updating ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 p-5">
        <h3 className="text-xs font-bold text-[var(--color-danger-500)] mb-1 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
        </h3>
        <p className="text-[10px] text-[var(--gm-text-tertiary)] mb-3">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button onClick={handleDeleteAccount} className={BTN_DANGER}>
          <Trash2 className="w-3.5 h-3.5" /> Delete Account
        </button>
      </div>
    </div>
  );
}

// ==================== SESSIONS ====================

function SessionsSection() {
  const { logout } = useAuth();

  const sessions = [
    {
      id: '1',
      userAgent: navigator.userAgent,
      ip: '::1',
      lastActive: 'Just now',
      current: true,
    },
  ];

  const handleSignOutAll = async () => {
    try {
      await logout();
      toast.success('All other sessions signed out');
    } catch {
      toast.error('Failed to sign out other sessions');
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Sessions" subtitle="Active login sessions for your account" />

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Active Sessions</h3>
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id}
              className={cn('flex items-center gap-4 p-4 rounded-lg border',
                session.current
                  ? 'border-[var(--gm-accent-primary)]/30 bg-[var(--gm-accent-primary)]/5'
                  : 'border-[var(--gm-border-primary)]')}>
              <Monitor className="w-7 h-7 text-[var(--gm-text-tertiary)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--gm-text-primary)] break-all">{session.userAgent}</p>
                <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">
                  {session.ip} &bull; Last active: {session.lastActive}
                </p>
              </div>
              {session.current && (
                <span className="text-[10px] font-bold text-[var(--gm-accent-primary)] bg-[var(--gm-accent-primary)]/10 px-2 py-0.5 rounded-full flex-shrink-0">Current</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSignOutAll} className={BTN_SECONDARY}>
            <LogOut className="w-3.5 h-3.5" /> Sign out all other sessions
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MEETING PREVIEW (sub-component for hooks) ====================

function MeetingPreview({ meeting: m }: { meeting: KrispMeeting }) {
  const { data: preview, isLoading } = useKrispMeetingPreview(m.meeting_id);
  const [activeTab, setActiveTab] = useState<'transcript' | 'outline' | 'keypoints' | 'actions' | 'audio'>('outline');

  const tabs = [
    { id: 'transcript' as const, label: 'Transcript', icon: FileText, available: true },
    { id: 'outline' as const, label: 'Outline', icon: AlignLeft, available: m.detailed_summary.length > 0 },
    { id: 'keypoints' as const, label: 'Key Points', icon: Lightbulb, available: m.key_points.length > 0 },
    { id: 'actions' as const, label: 'Actions', icon: ListChecks, available: m.action_items.length > 0 },
    { id: 'audio' as const, label: 'Audio', icon: Headphones, available: true },
  ];

  return (
    <div className="border-t border-[var(--gm-border-primary)]/50 mx-4 mb-2">
      <div className="flex gap-0.5 pt-2 pb-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon, available }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors',
              activeTab === id
                ? 'bg-[var(--gm-accent-primary)]/10 text-[var(--gm-accent-primary)]'
                : available
                  ? 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]'
                  : 'text-[var(--gm-text-tertiary)]/40 cursor-default')}>
            <Icon className="w-3 h-3" />
            {label}
            {id === 'actions' && m.action_items.length > 0 && <span className="ml-0.5 text-[9px] opacity-60">({m.action_items.length})</span>}
            {id === 'keypoints' && m.key_points.length > 0 && <span className="ml-0.5 text-[9px] opacity-60">({m.key_points.length})</span>}
            {id === 'outline' && m.detailed_summary.length > 0 && <span className="ml-0.5 text-[9px] opacity-60">({m.detailed_summary.length})</span>}
          </button>
        ))}
      </div>

      <div className="pb-3 pt-1">
        {activeTab === 'transcript' && (
          <div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-text-tertiary)]" />
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">Fetching transcript...</span>
              </div>
            ) : preview?.transcript ? (
              <pre className="text-[10px] text-[var(--gm-text-secondary)] whitespace-pre-wrap max-h-[200px] overflow-y-auto bg-[var(--gm-bg-tertiary)] rounded-md p-3 font-mono leading-relaxed">
                {preview.transcript}
              </pre>
            ) : (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] italic py-2">
                {preview?.error || 'No transcript content available.'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'outline' && (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {m.detailed_summary.length > 0 ? m.detailed_summary.map((s, i) => (
              <div key={i} className="text-[10px]">
                <span className="font-medium text-[var(--gm-text-primary)]">{s.title}</span>
                <p className="text-[var(--gm-text-tertiary)] mt-0.5">{s.description}</p>
              </div>
            )) : (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] italic">No outline available.</p>
            )}
          </div>
        )}

        {activeTab === 'keypoints' && (
          <ul className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {m.key_points.length > 0 ? m.key_points.map((kp, i) => (
              <li key={i} className="text-[10px] text-[var(--gm-text-tertiary)] flex gap-1.5">
                <span className="text-[var(--gm-accent-primary)] mt-0.5 flex-shrink-0">&bull;</span>
                <span>{kp.replace(/\{\{.*?\}\}/g, '').trim()}</span>
              </li>
            )) : (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] italic">No key points available.</p>
            )}
          </ul>
        )}

        {activeTab === 'actions' && (
          <ul className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {m.action_items.length > 0 ? m.action_items.map((ai, i) => (
              <li key={i} className="text-[10px] flex items-start gap-1.5">
                <span className={cn('mt-0.5 flex-shrink-0', ai.completed ? 'text-emerald-500' : 'text-[var(--gm-text-tertiary)]')}>
                  {ai.completed ? '✓' : '○'}
                </span>
                <span className="text-[var(--gm-text-primary)] flex-1">{ai.title}</span>
                {ai.assignee && (
                  <span className="text-[9px] px-1.5 py-0 rounded border border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)] flex-shrink-0">
                    {ai.assignee}
                  </span>
                )}
              </li>
            )) : (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] italic">No action items available.</p>
            )}
          </ul>
        )}

        {activeTab === 'audio' && (
          <div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-text-tertiary)]" />
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">Checking for audio...</span>
              </div>
            ) : preview?.audioUrl ? (
              <div className="space-y-2">
                <audio controls className="w-full h-8" preload="none">
                  <source src={preview.audioUrl} type="audio/mpeg" />
                </audio>
                <a href={preview.audioUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--gm-accent-primary)] hover:underline">
                  <ExternalLink className="w-3 h-3" /> Open audio file
                </a>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] italic py-2">
                No audio recording available for this meeting.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== INTEGRATIONS ====================

function IntegrationsSection() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allProjects = [] } = useProjects();
  const [showMeetings, setShowMeetings] = useState(false);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [importProjectId, setImportProjectId] = useState<string>('');
  const [importOpts, setImportOpts] = useState<KrispImportOptions>({
    transcript: true, keyPoints: true, actionItems: true, outline: true, audio: true,
  });
  const [dateAfter, setDateAfter] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateBefore, setDateBefore] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: oauthStatus, isLoading: statusLoading } = useKrispOAuthStatus();
  const authorizeMut = useKrispOAuthAuthorize();
  const disconnectMut = useKrispOAuthDisconnect();
  const importMut = useKrispOAuthImportMeetings();
  const { data: meetingsData, isLoading: meetingsLoading } = useKrispOAuthMeetings({
    limit: 50,
    after: dateAfter || undefined,
    before: dateBefore || undefined,
    enabled: showMeetings && !!oauthStatus?.connected,
  });

  useEffect(() => {
    const connected = searchParams.get('krisp_connected');
    const error = searchParams.get('krisp_error');
    if (connected === 'true') {
      toast.success('Krisp connected successfully!');
      setSearchParams({}, { replace: true });
    } else if (error) {
      toast.error(`Krisp connection failed: ${decodeURIComponent(error)}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleConnect = async () => {
    try {
      const result = await authorizeMut.mutateAsync();
      if (result.url) window.location.href = result.url;
    } catch {
      toast.error('Failed to start Krisp authorization');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Krisp? You can reconnect anytime.')) return;
    try {
      await disconnectMut.mutateAsync();
      setShowMeetings(false);
      toast.success('Krisp disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const toggleMeeting = (id: string) => {
    setSelectedMeetings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleOpt = (key: keyof KrispImportOptions) => {
    setImportOpts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImport = async () => {
    if (selectedMeetings.size === 0) return toast.error('Select at least one meeting');
    if (!importProjectId) return toast.error('Select a target project');
    if (!importOpts.transcript && !importOpts.keyPoints && !importOpts.actionItems && !importOpts.outline) {
      return toast.error('Select at least one content type to import');
    }
    const target = allProjects.find((p: any) => p.id === importProjectId);
    try {
      const result = await importMut.mutateAsync({
        meetingIds: Array.from(selectedMeetings),
        projectId: importProjectId,
        importOptions: importOpts,
      });
      if (result.succeeded > 0) {
        toast.success(`Imported ${result.succeeded} meeting(s) to ${target?.name || 'project'}`);
        setSelectedMeetings(new Set());
      }
      if (result.failed > 0) toast.error(`${result.failed} meeting(s) failed to import`);
    } catch {
      toast.error('Import failed');
    }
  };

  const connected = oauthStatus?.connected === true;
  const meetings = meetingsData?.meetings || [];

  const optionItems: { key: keyof KrispImportOptions; icon: typeof FileText; label: string }[] = [
    { key: 'transcript', icon: FileText, label: 'Transcript' },
    { key: 'keyPoints', icon: Lightbulb, label: 'Key Points' },
    { key: 'actionItems', icon: ListChecks, label: 'Action Items' },
    { key: 'outline', icon: AlignLeft, label: 'Outline' },
    { key: 'audio', icon: Headphones, label: 'Audio' },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Integrations" subtitle="Connect external services to your account" />

      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={cn(SECTION_TITLE, 'flex items-center gap-2')}>
              <Mic className="w-3.5 h-3.5" /> Krisp AI Meeting Assistant
            </h3>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">
              Connect your Krisp account via OAuth to import transcripts and recordings.
            </p>
          </div>
          {statusLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-text-tertiary)]" />
          ) : connected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--gm-text-tertiary)] border border-[var(--gm-border-primary)] px-2 py-0.5 rounded-full">
              <XCircle className="w-3 h-3" /> Not connected
            </span>
          )}
        </div>

        {!connected ? (
          <button onClick={handleConnect} disabled={authorizeMut.isPending}
            className={cn(BTN_PRIMARY, 'w-full justify-center py-2.5')}>
            {authorizeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            Connect Krisp Account
          </button>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setShowMeetings(!showMeetings)} className={cn(BTN_PRIMARY, 'flex-1 justify-center py-2')}>
                <Download className="w-3.5 h-3.5" />
                {showMeetings ? 'Hide Meetings' : 'Browse & Import Meetings'}
              </button>
              <button onClick={handleDisconnect} disabled={disconnectMut.isPending}
                className={cn(BTN_SECONDARY, 'hover:text-[var(--color-danger-500)] hover:border-[var(--color-danger-500)]/30')}>
                {disconnectMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            </div>

            {showMeetings && (
              <div className="border border-[var(--gm-border-primary)] rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-[var(--gm-bg-tertiary)] border-b border-[var(--gm-border-primary)]">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--gm-text-tertiary)] whitespace-nowrap uppercase tracking-wider font-bold">From</label>
                    <input type="date" value={dateAfter} onChange={e => setDateAfter(e.target.value)}
                      className="px-2 py-1 text-xs rounded-md border border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-primary)]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--gm-text-tertiary)] whitespace-nowrap uppercase tracking-wider font-bold">To</label>
                    <input type="date" value={dateBefore} onChange={e => setDateBefore(e.target.value)}
                      className="px-2 py-1 text-xs rounded-md border border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-primary)]" />
                  </div>
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] ml-auto">{meetings.length} meeting(s)</span>
                </div>

                {selectedMeetings.size > 0 && (
                  <div className="px-4 py-3 bg-[var(--gm-accent-primary)]/5 border-b border-[var(--gm-border-primary)] space-y-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--gm-text-primary)] font-medium whitespace-nowrap">
                        {selectedMeetings.size} selected &rarr;
                      </span>
                      <select value={importProjectId} onChange={e => setImportProjectId(e.target.value)} className={cn(INPUT, 'flex-1')}>
                        <option value="">Select target project...</option>
                        {allProjects.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button onClick={handleImport} disabled={importMut.isPending || !importProjectId} className={BTN_PRIMARY}>
                        {importMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Import
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-[var(--gm-text-tertiary)] mr-1">Include:</span>
                      {optionItems.map(({ key, icon: Icon, label }) => (
                        <button key={key} onClick={() => toggleOpt(key)}
                          className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors',
                            importOpts[key]
                              ? 'bg-[var(--gm-accent-primary)]/10 border-[var(--gm-accent-primary)]/30 text-[var(--gm-accent-primary)]'
                              : 'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>
                          <Icon className="w-3 h-3" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {meetingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--gm-text-tertiary)]" />
                    <span className="ml-2 text-xs text-[var(--gm-text-tertiary)]">Loading meetings from Krisp...</span>
                  </div>
                ) : meetings.length === 0 ? (
                  <div className="text-center py-8 text-[var(--gm-text-tertiary)] text-xs">
                    No meetings found for the selected date range.
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--gm-border-primary)]">
                    {meetings.map((m: KrispMeeting) => {
                      const isSelected = selectedMeetings.has(m.meeting_id);
                      const isExpanded = expandedMeeting === m.meeting_id;
                      const importedToTarget = importProjectId
                        ? m.importedTo.some(p => p.projectId === importProjectId)
                        : false;

                      return (
                        <div key={m.meeting_id} className={cn(isSelected && 'bg-[var(--gm-accent-primary)]/5', importedToTarget && 'opacity-60')}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleMeeting(m.meeting_id)}
                              disabled={importedToTarget} className="rounded border-[var(--gm-border-primary)] flex-shrink-0" />
                            <button onClick={() => setExpandedMeeting(isExpanded ? null : m.meeting_id)} className="flex-1 min-w-0 text-left">
                              <p className="text-xs font-medium text-[var(--gm-text-primary)] truncate">{m.name}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-[var(--gm-text-tertiary)] flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {m.date ? new Date(m.date).toLocaleDateString() : '—'}
                                </span>
                                {m.speakers.length > 0 && (
                                  <span className="text-[10px] text-[var(--gm-text-tertiary)] flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {m.speakers.slice(0, 3).join(', ')}
                                    {m.speakers.length > 3 && ` +${m.speakers.length - 3}`}
                                  </span>
                                )}
                                {m.detailed_summary.length > 0 && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{m.detailed_summary.length} topics</span>}
                                {m.key_points.length > 0 && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{m.key_points.length} key pts</span>}
                                {m.action_items.length > 0 && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{m.action_items.length} actions</span>}
                              </div>
                            </button>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {importedToTarget && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/30 px-1.5 py-0 rounded">
                                  <Check className="w-3 h-3" /> Imported
                                </span>
                              )}
                              {m.importedTo.length > 0 && !importedToTarget && (
                                <span className="text-[10px] border border-[var(--gm-border-primary)] px-1.5 py-0 rounded text-[var(--gm-text-tertiary)]">
                                  In {m.importedTo.map(p => p.projectName).join(', ')}
                                </span>
                              )}
                              <button onClick={() => setExpandedMeeting(isExpanded ? null : m.meeting_id)}
                                className="p-1 text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && <MeetingPreview meeting={m} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-3">
              <button onClick={() => navigate('/files')}
                className="flex items-center gap-2 text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] transition-colors">
                View imported transcripts <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// USER SETTINGS SECTION
// ══════════════════════════════════════════════════════════════════════════════

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[var(--gm-border-primary)] transition-colors duration-200 disabled:opacity-50"
      style={{ backgroundColor: checked ? 'var(--color-brand-500)' : 'var(--gm-bg-tertiary)' }}>
      <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}

function UserSettingsSection() {
  const { user, updateProfile } = useUser();
  const { currentProject, currentProjectId } = useProject();

  const [theme, setTheme] = useState(() => localStorage.getItem('godmode-theme') || 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('godmode-language') || 'en');

  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableTimezones, setAvailableTimezones] = useState<Array<{ code: string; name: string; utc_offset: string; abbreviation: string }>>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState('');

  const [analytics, setAnalytics] = useState(true);
  const [errorReporting, setErrorReporting] = useState(true);
  const [aiData, setAiData] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.timezone) setSelectedTimezone(user.timezone);
    if (currentProject?.role) setSelectedRole(currentProject.role);

    apiClient.get<any>('/api/role-templates')
      .then(res => { if (res.roles) setAvailableRoles(res.roles); })
      .catch(() => {});
    apiClient.get<any>('/api/timezones')
      .then(res => { if (res.timezones) setAvailableTimezones(res.timezones); })
      .catch(() => {});

    try {
      const saved = JSON.parse(localStorage.getItem('godmode-privacy') || '{}');
      if (saved.analytics !== undefined) setAnalytics(saved.analytics);
      if (saved.errorReporting !== undefined) setErrorReporting(saved.errorReporting);
      if (saved.aiData !== undefined) setAiData(saved.aiData);
    } catch { /* ignore */ }
  }, [user, currentProject, currentProjectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('godmode-theme', theme);
      localStorage.setItem('godmode-language', language);
      localStorage.setItem('godmode-privacy', JSON.stringify({ analytics, errorReporting, aiData }));
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else if (theme === 'light') document.documentElement.classList.remove('dark');

      if (selectedTimezone !== user?.timezone) {
        await updateProfile.mutateAsync({ timezone: selectedTimezone });
      }
      if (currentProjectId && selectedRole !== currentProject?.role) {
        await apiClient.put(`/api/projects/${currentProjectId}/members/${user?.id}`, { role: selectedRole });
      }
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const privacyToggles = [
    { label: 'Analytics', desc: 'Help improve GodMode with anonymous usage data', value: analytics, set: setAnalytics },
    { label: 'Error Reporting', desc: 'Automatically report errors to help fix bugs', value: errorReporting, set: setErrorReporting },
    { label: 'AI Data Improvement', desc: 'Allow anonymized data to improve AI responses', value: aiData, set: setAiData },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="User Settings" subtitle="Appearance, role, and privacy preferences" />

      {/* Appearance */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Appearance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}><Sparkles className="w-3 h-3" /> Theme</label>
            <select value={theme} onChange={e => setTheme(e.target.value)} className={INPUT}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Choose your preferred color scheme</p>
          </div>
          <div>
            <label className={LABEL}><Languages className="w-3 h-3" /> Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} className={INPUT}>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Interface language preference</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--gm-accent-primary)]/20 bg-[var(--gm-accent-primary)]/5">
          <Info className="w-4 h-4 text-[var(--gm-accent-primary)] flex-shrink-0" />
          <p className="text-[10px] text-[var(--gm-text-tertiary)]">
            For <span className="text-[var(--gm-accent-primary)] font-medium">LLM configuration</span> and <span className="text-[var(--gm-accent-primary)] font-medium">Graph</span> settings, use the <span className="text-[var(--gm-accent-primary)] font-medium">Admin</span> section.
          </p>
        </div>
      </div>

      {/* Profile & Role */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Role & Context</h3>
        <div className="p-3 rounded-lg bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)]">
          <p className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider font-bold mb-1">Active Project</p>
          <p className="text-xs font-medium text-[var(--gm-text-primary)]">{currentProject?.name || 'No Active Project'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}><Building2 className="w-3 h-3" /> Project Role</label>
            <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
              disabled={!currentProjectId || currentProjectId === 'default'} className={INPUT}>
              <option value="">Select a role...</option>
              {availableRoles.filter((r: any) => r.name || r.display_name).map((r: any) => (
                <option key={r.id || r.name} value={r.display_name || r.name}>{r.display_name || r.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Your role in the current project</p>
          </div>
          <div>
            <label className={LABEL}><Clock className="w-3 h-3" /> Timezone</label>
            <select value={selectedTimezone} onChange={e => setSelectedTimezone(e.target.value)} className={INPUT}>
              <option value="">Select timezone...</option>
              {availableTimezones.map(tz => (
                <option key={tz.code} value={tz.code}>{tz.name} ({tz.utc_offset})</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Used for scheduling and notifications</p>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className={cn(CARD, 'p-5')}>
        <h3 className={cn(SECTION_TITLE, 'mb-4')}>Data & Privacy</h3>
        <div className="space-y-1">
          {privacyToggles.map(t => (
            <div key={t.label} className="flex items-center justify-between py-3 border-b border-[var(--gm-border-primary)] last:border-0">
              <div>
                <p className="text-xs font-medium text-[var(--gm-text-primary)]">{t.label}</p>
                <p className="text-[10px] text-[var(--gm-text-tertiary)]">{t.desc}</p>
              </div>
              <Toggle checked={t.value} onChange={t.set} />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className={cn(CARD, 'p-4 flex justify-end')}>
        <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPANIES SECTION
// ══════════════════════════════════════════════════════════════════════════════

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  linkedin?: string;
  description?: string;
  status?: 'analyzed' | 'not_analyzed';
  colors?: string[];
  report?: Record<string, string>;
}

const REPORT_SECTIONS = [
  'Ficha de Identidade', 'Visão Geral e Posicionamento', 'Produtos e Serviços',
  'Público-Alvo e Clientes', 'Equipa e Liderança', 'Presença Digital e Marketing',
  'Análise Competitiva', 'Indicadores de Crescimento', 'Análise SWOT', 'Conclusões e Insights',
];

type CompanyPageView = 'list' | 'view' | 'edit' | 'templates';

function CompaniesSection() {
  const [pageView, setPageView] = useState<CompanyPageView>('list');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ companies: Company[] }>('/api/companies');
      setCompanies(data.companies || []);
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const openView = (company: Company, view: CompanyPageView) => {
    setSelectedCompany(company);
    setPageView(view);
  };

  const backToList = () => {
    setPageView('list');
    setSelectedCompany(null);
    fetchCompanies();
  };

  return (
    <div>
      {pageView === 'list' && <CompanyListView companies={companies} loading={loading} onView={c => openView(c, 'view')} onEdit={c => openView(c, 'edit')} onTemplates={c => openView(c, 'templates')} onRefresh={fetchCompanies} />}
      {pageView === 'view' && selectedCompany && <CompanyDetailView company={selectedCompany} onBack={backToList} onEdit={() => setPageView('edit')} />}
      {pageView === 'edit' && selectedCompany && <CompanyEditView company={selectedCompany} onBack={backToList} onTemplates={() => setPageView('templates')} />}
      {pageView === 'templates' && selectedCompany && <CompanyTemplatesView company={selectedCompany} onBack={() => setPageView('edit')} />}
    </div>
  );
}

// ── Companies: List ──────────────────────────────────────────────────────────

function CompanyListView({ companies, loading, onView, onEdit, onTemplates, onRefresh }: {
  companies: Company[]; loading: boolean;
  onView: (c: Company) => void; onEdit: (c: Company) => void; onTemplates: (c: Company) => void; onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Company name is required'); return; }
    setCreating(true);
    try {
      await apiClient.post('/api/companies', { name: newName.trim() });
      toast.success('Company created');
      setNewName('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleAnalyze = async (company: Company) => {
    toast.info(`Analyzing ${company.name}...`);
    try {
      await apiClient.post(`/api/companies/${company.id}/analyze`, {});
      toast.success(`${company.name} analysis started`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/api/companies/${deleteTarget.id}`);
      toast.success('Company deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name || 'this item'}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The company and all its data will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)]">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SectionHeader title="Companies" subtitle="Manage company profiles and assets" />

      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New company name..."
          className={cn(INPUT, 'max-w-xs')} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
        <button onClick={handleCreate} disabled={creating} className={BTN_PRIMARY}>
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} New company
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : companies.length === 0 ? (
        <div className={cn(CARD, 'p-10 text-center text-[var(--gm-text-tertiary)] text-sm')}>No companies yet. Create one above.</div>
      ) : (
        <div className="space-y-2">
          {companies.map(company => (
            <div key={company.id} className={cn(CARD, 'p-4 hover:border-[var(--gm-accent-primary)]/30')}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--gm-bg-tertiary)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-[var(--gm-text-primary)]">{(company.name || '???').substring(0, 3).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-[var(--gm-text-primary)]">{company.name}</h3>
                    {(company.colors || []).length > 0 && (
                      <div className="flex gap-0.5">
                        {(company.colors || []).map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    )}
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                      company.status === 'analyzed'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]')}>
                      {company.status === 'analyzed' ? 'Analyzed' : 'Not analyzed'}
                    </span>
                  </div>
                  {company.website && <p className="text-[10px] text-[var(--gm-text-tertiary)]">{company.website}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                  <button onClick={() => onView(company)} className={cn(BTN_SECONDARY, 'border-0 px-2')}>
                    <Eye className="w-3 h-3" /> View
                  </button>
                  <button onClick={() => onEdit(company)} className={cn(BTN_SECONDARY, 'border-0 px-2')}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => onTemplates(company)} className={cn(BTN_SECONDARY, 'border-0 px-2')}>
                    <FileText className="w-3 h-3" /> Templates
                  </button>
                  <button onClick={() => handleAnalyze(company)} className={cn(BTN_SECONDARY, 'border-0 px-2')}>
                    <Zap className="w-3 h-3" /> {company.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                  </button>
                  <button onClick={() => setDeleteTarget(company)}
                    className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--color-danger-500)]/10 hover:text-[var(--color-danger-500)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Companies: Detail View ───────────────────────────────────────────────────

function CompanyDetailView({ company, onBack, onEdit }: { company: Company; onBack: () => void; onEdit: () => void }) {
  const [activeSection, setActiveSection] = useState(REPORT_SECTIONS[0]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await apiClient.post(`/api/companies/${company.id}/analyze`, {});
      toast.success('Analysis started');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Companies
      </button>

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--gm-bg-tertiary)] flex items-center justify-center">
          <span className="text-sm font-bold text-[var(--gm-text-primary)]">{(company.name || '???').substring(0, 3).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{company.name}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--gm-accent-primary)] flex items-center gap-1 hover:underline"><Globe className="w-3 h-3" /> {company.website}</a>}
            {company.linkedin && <a href={company.linkedin} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--gm-accent-primary)] flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> LinkedIn</a>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleReanalyze} disabled={analyzing} className={BTN_PRIMARY}>
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-analyze
          </button>
          <button onClick={onEdit} className={BTN_SECONDARY}>
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="w-52 flex-shrink-0 space-y-0.5">
          <p className={cn(SECTION_TITLE, 'mb-2 px-1')}>Report Sections</p>
          {REPORT_SECTIONS.map(section => (
            <button key={section} onClick={() => setActiveSection(section)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-[10px] transition-colors flex items-center justify-between',
                activeSection === section
                  ? 'text-[var(--gm-accent-primary)] bg-[var(--gm-surface-hover)] font-semibold'
                  : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]')}>
              <span className="truncate">{section}</span>
              {activeSection === section && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
            </button>
          ))}
        </div>

        <div className={cn(CARD, 'flex-1 p-5')}>
          <h3 className="text-sm font-bold text-[var(--gm-text-primary)] mb-3">{activeSection}</h3>
          <div className="text-xs text-[var(--gm-text-secondary)] whitespace-pre-line leading-relaxed">
            {company.report?.[activeSection] || `Content for "${activeSection}" — run analysis to populate.`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Companies: Edit ──────────────────────────────────────────────────────────

function CompanyEditView({ company, onBack, onTemplates }: { company: Company; onBack: () => void; onTemplates: () => void }) {
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || '');
  const [logoUrl, setLogoUrl] = useState(company.logo_url || '');
  const [website, setWebsite] = useState(company.website || '');
  const [linkedin, setLinkedin] = useState(company.linkedin || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    const urlPattern = /^https?:\/\//;
    if (website.trim() && !urlPattern.test(website.trim())) {
      toast.error('Website must start with http:// or https://');
      return;
    }
    if (linkedin.trim() && !urlPattern.test(linkedin.trim())) {
      toast.error('LinkedIn URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/api/companies/${company.id}`, { name, description, logo_url: logoUrl, website, linkedin });
      toast.success('Company updated');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Companies
      </button>

      <SectionHeader title={`Edit ${company.name}`} />

      <div className={cn(CARD, 'p-5')}>
        <div className="max-w-lg space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}><AlignLeft className="w-3 h-3" /> Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={cn(INPUT, 'resize-y')} />
          </div>
          <div>
            <label className={LABEL}><Image className="w-3 h-3" /> Logo URL</label>
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className={cn(INPUT, 'font-mono text-xs')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}><Globe className="w-3 h-3" /> Website</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}><ExternalLink className="w-3 h-3" /> LinkedIn</label>
              <input value={linkedin} onChange={e => setLinkedin(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div className="border-t border-[var(--gm-border-primary)] pt-4 flex justify-center gap-2">
            <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onBack} className={BTN_SECONDARY}>Cancel</button>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[var(--gm-border-primary)]">
          <h3 className={cn(SECTION_TITLE, 'mb-3')}>Documents</h3>
          <button onClick={onTemplates} className={BTN_SECONDARY}>
            <FileText className="w-3.5 h-3.5" /> Templates (A4 / PPT)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Companies: Templates ─────────────────────────────────────────────────────

function CompanyTemplatesView({ company, onBack }: { company: Company; onBack: () => void }) {
  const [templateType, setTemplateType] = useState<'a4' | 'ppt'>('a4');
  const [codeTab, setCodeTab] = useState<'code' | 'theme'>('code');
  const [templateCode, setTemplateCode] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const data = await apiClient.get<{ template: { content: string } }>(`/api/companies/${company.id}/templates/${templateType}`);
      setTemplateCode(data.template?.content || `<!-- No ${templateType} template yet -->`);
      toast.success('Template loaded');
    } catch {
      setTemplateCode(`<!-- No ${templateType} template found -->`);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await apiClient.post<{ template: { content: string } }>(`/api/companies/${company.id}/templates/generate`, { type: templateType });
      setTemplateCode(data.template?.content || templateCode);
      toast.success('Template generated');
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/api/companies/${company.id}/templates/${templateType}`, { content: templateCode });
      toast.success('Template saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { loadTemplate(); }, [templateType]);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Edit
      </button>

      <SectionHeader title={`${company.name} — Templates`} subtitle="Manage document templates for this company" />

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['a4', 'ppt'] as const).map(t => (
            <button key={t} onClick={() => setTemplateType(t)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                templateType === t
                  ? 'bg-[var(--gm-accent-primary)]/10 text-[var(--gm-accent-primary)]'
                  : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]')}>
              {t === 'a4' ? 'A4 document' : 'Presentation'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={loadTemplate} disabled={loadingTemplate} className={BTN_SECONDARY}>
            {loadingTemplate ? 'Loading...' : 'Load current'}
          </button>
          <button onClick={handleGenerate} disabled={generating} className={BTN_PRIMARY}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {generating ? 'Generating...' : 'Generate with AI'}
          </button>
          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : 'Save template'}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="flex border-b border-[var(--gm-border-primary)] mb-2">
            {(['code', 'theme'] as const).map(tab => (
              <button key={tab} onClick={() => setCodeTab(tab)}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors',
                  codeTab === tab
                    ? 'text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]'
                    : 'text-[var(--gm-text-tertiary)] border-transparent')}>
                {tab === 'code' ? <Code2 className="w-3 h-3" /> : <Palette className="w-3 h-3" />}
                {tab === 'code' ? 'Code' : 'Theme'}
              </button>
            ))}
          </div>
          <textarea value={templateCode} onChange={e => setTemplateCode(e.target.value)}
            className={cn(INPUT, 'h-[500px] font-mono text-[10px] resize-none')} />
        </div>

        <div className="w-[300px] flex-shrink-0">
          <p className={cn(SECTION_TITLE, 'mb-2')}>Preview</p>
          <div className="bg-white border border-[var(--gm-border-primary)] rounded-lg overflow-hidden h-[500px]">
            <div className="h-1.5 bg-[var(--color-danger-500)]" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-[var(--gm-bg-tertiary)] rounded flex items-center justify-center">
                  <span className="text-[8px] font-bold text-[var(--gm-text-tertiary)]">{(company.name || '???').substring(0, 3)}</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--gm-text-primary)]">{company.name}</p>
                  <p className="text-[8px] text-[var(--gm-text-tertiary)]">{templateType === 'a4' ? 'Document' : 'Presentation'} Template</p>
                </div>
              </div>
              <div className="text-[9px] text-[var(--gm-text-tertiary)] whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
                {templateCode.substring(0, 500)}
                {templateCode.length > 500 && '...'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
