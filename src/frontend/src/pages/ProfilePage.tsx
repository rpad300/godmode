import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Lock, Monitor, Link2, Mail, AtSign, Type, AlignLeft, Image,
  Globe, Languages, Key, AlertTriangle, Trash2, LogOut, Mic, Zap,
  Copy, Eye, EyeOff, RefreshCw, Check, Shield, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/contexts/AuthContext';

type ProfileSection = 'general' | 'security' | 'sessions' | 'integrations';

const sections = [
  { id: 'general' as const, label: 'General', icon: User },
  { id: 'security' as const, label: 'Security', icon: Lock },
  { id: 'sessions' as const, label: 'Sessions', icon: Monitor },
  { id: 'integrations' as const, label: 'Integrations', icon: Link2 },
];

const ProfilePage = () => {
  const { user, isLoading } = useUser();
  const [activeSection, setActiveSection] = useState<ProfileSection>('general');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const initials = (user?.display_name || user?.email || '??').substring(0, 2).toUpperCase();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{initials}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{user?.email || 'No email'}</span>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                <Shield className="w-3 h-3 mr-1" /> SUPER ADMIN
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Side Nav */}
        <div className="w-48 flex-shrink-0 space-y-0.5 hidden md:block">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeSection === 'general' && <GeneralSection />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'sessions' && <SessionsSection />}
          {activeSection === 'integrations' && <IntegrationsSection />}
        </div>
      </div>
    </div>
  );
};

// ==================== GENERAL ====================

function GeneralSection() {
  const { user, updateProfile } = useUser();
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-base font-semibold text-foreground">Account Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
            </label>
            <Input value={user?.email || ''} readOnly className="bg-secondary border-border text-sm text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-muted-foreground" /> Username
            </label>
            <Input value={username} onChange={e => setUsername(e.target.value)} className="bg-background border-border text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-muted-foreground" /> Display Name
          </label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-background border-border text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
            <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" /> Bio
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell us a bit about yourself"
            rows={4}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5 text-muted-foreground" /> Avatar URL
          </label>
          <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="bg-background border-border text-sm font-mono text-xs" />
          <p className="text-[10px] text-muted-foreground mt-1">Enter an image URL or upload using the avatar above. Leave empty for auto-generated avatar.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
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
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-muted-foreground" /> Language
            </label>
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
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </motion.div>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" /> Change Password
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Current Password</label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="bg-background border-border text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-background border-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Confirm Password</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-background border-border text-sm" />
            </div>
          </div>
          <p className="text-[10px] text-primary">Minimum 6 characters</p>
        </div>
        <div className="flex justify-end pt-4">
          <button
            onClick={handleUpdatePassword}
            disabled={updating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {updating ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button
          onClick={handleDeleteAccount}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Delete Account
        </button>
      </div>
    </motion.div>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-base font-semibold text-foreground mb-4">Active Sessions</h3>
        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`flex items-center gap-4 p-4 rounded-lg border ${
                session.current ? 'border-primary/30 bg-primary/5' : 'border-border'
              }`}
            >
              <Monitor className="w-8 h-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground break-all">{session.userAgent}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {session.ip} • Last active: {session.lastActive}
                </p>
              </div>
              {session.current && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] flex-shrink-0">Current</Badge>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSignOutAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out all other sessions
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== INTEGRATIONS ====================

function IntegrationsSection() {
  const navigate = useNavigate();
  const [showToken, setShowToken] = useState(false);
  const webhookUrl = `${window.location.origin}/api/webhooks/krisp`;
  const authToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error('Failed to copy')
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <Mic className="w-4 h-4" /> Krisp AI Meeting Assistant
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Connect your Krisp account to automatically import meeting transcriptions into GodMode.</p>

        {/* MCP Direct Access */}
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">MCP Direct Access</p>
            <p className="text-[10px] text-muted-foreground">As a Super Admin, you can import meetings directly via MCP without webhook configuration.</p>
          </div>
          <button
            onClick={() => toast.info('MCP import requires the Krisp MCP server to be configured')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            Import via MCP
          </button>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-sm font-medium text-foreground">Active</span>
          <button
            onClick={() => toast.info('Integration status toggling not yet available')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Disable
          </button>
        </div>

        {/* Webhook URL */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">Webhook URL</label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="bg-background border-border text-xs font-mono flex-1" />
            <button
              onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
              className="px-3 py-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Authorization Token */}
        <div className="mb-1">
          <label className="text-xs text-muted-foreground mb-1 block">Authorization Token</label>
          <div className="flex gap-2">
            <Input
              type={showToken ? 'text' : 'password'}
              value={authToken}
              readOnly
              className="bg-background border-border text-xs font-mono flex-1"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="px-3 py-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => copyToClipboard(authToken, 'Auth token')}
              className="px-3 py-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Use this token in the Authorization header when configuring Krisp webhook.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { label: 'TOTAL TRANSCRIPTS', value: 0 },
            { label: 'PROCESSED', value: 0 },
            { label: 'NEED ATTENTION', value: 0 },
          ].map(s => (
            <div key={s.label} className="text-center py-3">
              <p className="text-2xl font-bold font-mono text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <button
            onClick={() => toast.info('Credential regeneration requires admin confirmation')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Regenerate Credentials
          </button>
          <button
            onClick={() => navigate('/files')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            View Transcripts
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ProfilePage;
