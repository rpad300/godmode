/**
 * Purpose:
 *   User-facing settings page with three sections: General (appearance and language),
 *   Profile & Role (project role selection and timezone), and Data & Privacy
 *   (analytics, error reporting, AI data improvement toggles).
 *
 * Responsibilities:
 *   - General: theme (light/dark/system) and language (en/pt/es/fr/de) selection with localStorage persistence
 *   - Profile & Role: display active project, select project role from available roles, select timezone
 *   - Data & Privacy: toggle analytics, error reporting, and AI data improvement preferences
 *
 * Key dependencies:
 *   - useUser: current user profile and update mutation
 *   - useProject (ProjectContext): current project info and ID
 *   - apiClient: fetches project roles and timezone list, updates member role
 *   - Switch (shadcn): toggle component for privacy settings
 *
 * Side effects:
 *   - localStorage: persists theme, language, and privacy preferences
 *   - DOM: toggles 'dark' class for theme switching
 *   - Network: fetches roles and timezones, updates user profile and project member role
 *
 * Notes:
 *   - This page differs from SettingsPage.tsx: UserSettingsPage is user-centric (personal
 *     preferences), while SettingsPage is project/admin-centric (API keys, webhooks, data).
 *   - An info banner directs users to the Admin section for LLM and graph configuration.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Shield, Globe, Languages, Building2, Info, Check, UserCog, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useUser } from '../hooks/useUser';
import { useProject } from '../contexts/ProjectContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
const LABEL = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1.5';

type UserSettingsSection = 'general' | 'privacy' | 'profile';

const sections: { id: UserSettingsSection; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Sparkles },
  { id: 'profile', label: 'Profile & Role', icon: UserCog },
  { id: 'privacy', label: 'Data & Privacy', icon: Shield },
];

const UserSettingsPage = () => {
  const [activeSection, setActiveSection] = useState<UserSettingsSection>('general');

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">Settings</h1>

      <div className="flex gap-6">
        {/* Side Nav */}
        <div className="w-48 flex-shrink-0 space-y-0.5 hidden md:block">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                activeSection === s.id ? 'bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)] font-medium' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]'
              )}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeSection === 'general' && <GeneralSection />}
          {activeSection === 'profile' && <ProfileRoleSection />}
          {activeSection === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </div>
  );
};

// ==================== GENERAL ====================

function GeneralSection() {
  const [theme, setTheme] = useState(() => localStorage.getItem('godmode-theme') || 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('godmode-language') || 'en');
  const [dirty, setDirty] = useState(false);

  const handleThemeChange = (val: string) => { setTheme(val); setDirty(true); };
  const handleLanguageChange = (val: string) => { setLanguage(val); setDirty(true); };

  const handleSave = () => {
    localStorage.setItem('godmode-theme', theme);
    localStorage.setItem('godmode-language', language);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'light') document.documentElement.classList.remove('dark');
    toast.success('Settings saved');
    setDirty(false);
  };

  const handleCancel = () => {
    setTheme(localStorage.getItem('godmode-theme') || 'dark');
    setLanguage(localStorage.getItem('godmode-language') || 'en');
    setDirty(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={cn(SECTION_TITLE, 'flex items-center gap-2')}>
          <Sparkles className="w-4 h-4" /> Appearance
        </h3>

        <div>
          <label className={LABEL}>Theme</label>
          <select
            value={theme}
            onChange={e => handleThemeChange(e.target.value)}
            className={cn(INPUT, 'h-9')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Choose your preferred color scheme</p>
        </div>

        <div>
          <label className={LABEL}>Language</label>
          <select
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            className={cn(INPUT, 'h-9')}
          >
            <option value="en">English</option>
            <option value="pt">Português</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
          <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Interface language preference</p>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--gm-accent-primary)]/30 bg-[var(--gm-interactive-primary)]/10">
          <Info className="w-4 h-4 text-[var(--gm-accent-primary)] flex-shrink-0" />
          <p className="text-xs text-[var(--gm-text-tertiary)]">
            For <span className="text-[var(--gm-accent-primary)] font-medium">LLM configuration</span>, <span className="text-[var(--gm-accent-primary)] font-medium">Graph</span>, and other platform settings, use the <span className="text-[var(--gm-accent-primary)] font-medium">Admin</span> section in the sidebar menu.
          </p>
        </div>
      </div>

      <div className={cn(CARD, 'p-4 flex justify-end gap-2')}>
        <button onClick={handleCancel} className={BTN_SECONDARY}>Cancel</button>
        <button onClick={handleSave} disabled={!dirty} className={BTN_PRIMARY}>
          <Check className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </motion.div>
  );
}

// ==================== PROFILE & ROLE ====================

function ProfileRoleSection() {
  const { user, updateProfile } = useUser();
  const { currentProject, currentProjectId } = useProject();

  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableTimezones, setAvailableTimezones] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize state from props
    if (user?.timezone) setSelectedTimezone(user.timezone);
    if (currentProject?.role) setSelectedRole(currentProject.role);

    // Fetch Roles
    const fetchRoles = async () => {
      try {
        const res = await apiClient.get<any>('/api/role-templates');
        if (res.roles) setAvailableRoles(res.roles);
      } catch (e) {
        console.error("Failed to fetch roles", e);
      }
    };

    // Fetch Timezones
    const fetchTimezones = async () => {
      try {
        const res = await apiClient.get<any>('/api/timezones');
        if (res.timezones) setAvailableTimezones(res.timezones);
      } catch (e) {
        console.error("Failed to fetch timezones", e);
      }
    };

    fetchRoles();
    fetchTimezones();
  }, [user, currentProject, currentProjectId]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save Timezone
      if (selectedTimezone !== user?.timezone) {
        await updateProfile.mutateAsync({ timezone: selectedTimezone });
      }

      // Save Role (Update project member)
      if (currentProjectId && selectedRole !== currentProject?.role) {
        // We need to update the member record.
        // Endpoint: PUT /api/projects/:id/members/:userId
        await apiClient.put(`/api/projects/${currentProjectId}/members/${user?.id}`, {
          role: selectedRole
        });
        toast.success("Role updated for this project");
        // Ideally trigger a reload of project context or member data here
      } else if (selectedTimezone !== user?.timezone) {
        toast.success("Profile updated");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={cn(SECTION_TITLE, 'flex items-center gap-2')}>
          <UserCog className="w-4 h-4" /> Role & Context
        </h3>

        {/* Current Project Info */}
        <div className="p-3 rounded-lg bg-[var(--gm-bg-tertiary)]/50 border border-[var(--gm-border-primary)]">
          <p className={LABEL}>Active Project</p>
          <p className="text-sm font-medium text-[var(--gm-text-primary)]">{currentProject?.name || 'No Active Project'}</p>
        </div>

        {/* Role Selector */}
        <div>
          <label className={LABEL}>Project Role</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-[var(--gm-text-tertiary)]" />
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              disabled={!currentProjectId || currentProjectId === 'default'}
              className={cn(INPUT, 'h-9 pl-9 disabled:opacity-50')}
            >
              <option value="">Select a role...</option>
              {availableRoles.filter((r: any) => r.name || r.display_name).map((r: any) => (
                <option key={r.id || r.name} value={r.display_name || r.name}>{r.display_name || r.name}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Your role in the current project (defines permissions)</p>
        </div>

        {/* Timezone Selector */}
        <div>
          <label className={LABEL}>Timezone</label>
          <div className="relative">
            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-[var(--gm-text-tertiary)]" />
            <select
              value={selectedTimezone}
              onChange={e => setSelectedTimezone(e.target.value)}
              className={cn(INPUT, 'h-9 pl-9')}
            >
              <option value="">Select timezone...</option>
              {availableTimezones.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Used for scheduling and notifications</p>
        </div>
      </div>

      <div className={cn(CARD, 'p-4 flex justify-end gap-2')}>
        <button className={BTN_SECONDARY}>Cancel</button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={BTN_PRIMARY}
        >
          {isLoading ? 'Saving...' : <><Check className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>
    </motion.div>
  );
}

// ==================== DATA & PRIVACY ====================

function PrivacySection() {
  const [analytics, setAnalytics] = useState(true);
  const [errorReporting, setErrorReporting] = useState(true);
  const [aiData, setAiData] = useState(false);
  const [dirty, setDirty] = useState(false);

  const toggles = [
    { label: 'Analytics', desc: 'Help improve GodMode with anonymous usage data', value: analytics, set: (v: boolean) => { setAnalytics(v); setDirty(true); } },
    { label: 'Error Reporting', desc: 'Automatically report errors to help fix bugs', value: errorReporting, set: (v: boolean) => { setErrorReporting(v); setDirty(true); } },
    { label: 'AI Data Improvement', desc: 'Allow anonymized data to improve AI responses', value: aiData, set: (v: boolean) => { setAiData(v); setDirty(true); } },
  ];

  const handleSave = () => {
    localStorage.setItem('godmode-privacy', JSON.stringify({ analytics, errorReporting, aiData }));
    toast.success('Privacy settings saved');
    setDirty(false);
  };

  const handleCancel = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('godmode-privacy') || '{}');
      setAnalytics(saved.analytics ?? true);
      setErrorReporting(saved.errorReporting ?? true);
      setAiData(saved.aiData ?? false);
    } catch { /* ignore */ }
    setDirty(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className={cn(CARD, 'p-5')}>
        <h3 className={cn(SECTION_TITLE, 'flex items-center gap-2 mb-4')}>
          <Shield className="w-4 h-4" /> Privacy Settings
        </h3>

        <div className="space-y-1">
          {toggles.map(t => (
            <div key={t.label} className="flex items-center justify-between py-3 border-b border-[var(--gm-border-primary)] last:border-0">
              <div>
                <p className="text-sm font-medium text-[var(--gm-text-primary)]">{t.label}</p>
                <p className="text-xs text-[var(--gm-text-tertiary)]">{t.desc}</p>
              </div>
              <Switch checked={t.value} onCheckedChange={t.set} />
            </div>
          ))}
        </div>
      </div>

      <div className={cn(CARD, 'p-4 flex justify-end gap-2')}>
        <button onClick={handleCancel} className={BTN_SECONDARY}>Cancel</button>
        <button onClick={handleSave} disabled={!dirty} className={BTN_PRIMARY}>
          <Check className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </motion.div>
  );
}

export default UserSettingsPage;
