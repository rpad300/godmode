import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Shield, Globe, Languages, Building2, Info, Check, UserCog, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useUser } from '../hooks/useUser';
import { useProject } from '../contexts/ProjectContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="flex gap-6">
        {/* Side Nav */}
        <div className="w-48 flex-shrink-0 space-y-0.5 hidden md:block">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
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
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Appearance
        </h3>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Theme</label>
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            className="w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">Choose your preferred color scheme</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Language</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="en">English</option>
            <option value="pt">Português</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">Interface language preference</p>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <Info className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            For <span className="text-primary font-medium">LLM configuration</span>, <span className="text-primary font-medium">Graph</span>, and other platform settings, use the <span className="text-primary font-medium">Admin</span> section in the sidebar menu.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex justify-end gap-2">
        <button className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
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
      if (!currentProjectId || currentProjectId === 'default') return;
      try {
        const res = await apiClient.get<any>(`/api/projects/${currentProjectId}/roles`);
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
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <UserCog className="w-4 h-4" /> Role & Context
        </h3>

        {/* Current Project Info */}
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Project</p>
          <p className="text-sm font-medium text-foreground">{currentProject?.name || 'No Active Project'}</p>
        </div>

        {/* Role Selector */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Project Role</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              disabled={!currentProjectId || currentProjectId === 'default'}
              className="w-full h-9 pl-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Select a role...</option>
              {availableRoles.map(r => (
                <option key={r.id || r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Your role in the current project (defines permissions)</p>
        </div>

        {/* Timezone Selector */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Timezone</label>
          <div className="relative">
            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <select
              value={selectedTimezone}
              onChange={e => setSelectedTimezone(e.target.value)}
              className="w-full h-9 pl-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select timezone...</option>
              {availableTimezones.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Used for scheduling and notifications</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex justify-end gap-2">
        <button className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70"
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

  const toggles = [
    { label: 'Analytics', desc: 'Help improve GodMode with anonymous usage data', value: analytics, set: setAnalytics },
    { label: 'Error Reporting', desc: 'Automatically report errors to help fix bugs', value: errorReporting, set: setErrorReporting },
    { label: 'AI Data Improvement', desc: 'Allow anonymized data to improve AI responses', value: aiData, set: setAiData },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" /> Privacy Settings
        </h3>

        <div className="space-y-1">
          {toggles.map(t => (
            <div key={t.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <Switch checked={t.value} onCheckedChange={t.set} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex justify-end gap-2">
        <button className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Check className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </motion.div>
  );
}

export default UserSettingsPage;
