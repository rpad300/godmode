import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Save, User, Briefcase, Mail, Phone, Building2, Linkedin, MapPin, Clock, Image, StickyNote } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiClient } from '@/lib/api-client';
import type { Contact } from '@/types/godmode';

interface ContactFormProps {
  contact?: Contact | null;
  onSubmit: (data: Omit<Contact, 'id' | 'mentionCount'>) => void;
  onCancel: () => void;
  mode: 'add' | 'edit';
}

interface RoleTemplate {
  id: string;
  display_name: string;
  name: string;
}

interface Timezone {
  id: string;
  name: string;
  code: string;
}

interface Company {
  id: string;
  name: string;
}

const ContactForm = ({ contact, onSubmit, onCancel, mode }: ContactFormProps) => {
  const [form, setForm] = useState({
    name: '',
    role: '',
    organization: '',
    email: '',
    phone: '',
    linkedin: '',
    avatarUrl: '',
    department: '',
    location: '',
    timezone: '',
    notes: '',
    aliases: [] as string[],
  });
  const [newAlias, setNewAlias] = useState('');

  // Data sources
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [timezones, setTimezones] = useState<Timezone[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);



  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesData, timezonesData, companiesData] = await Promise.all([
          apiClient.get<{ roles: RoleTemplate[] }>('/api/role-templates'),
          apiClient.get<{ timezones: Timezone[] }>('/api/timezones'),
          apiClient.get<{ companies: Company[] }>('/api/contacts/metadata/companies')
        ]);

        // Handle different response structures if needed
        // Handle different response structures if needed
        const roles = rolesData.roles || [];
        const tzs = timezonesData.timezones || [];
        const comps = companiesData.companies || [];

        setRoleTemplates(roles);
        setTimezones(tzs);
        setCompanies(comps);
      } catch (err) {
        console.error('Failed to load metadata', err);
      }
    };
    fetchData();

    if (contact) {
      setForm({
        name: contact.name,
        role: contact.role,
        organization: contact.organization,
        email: contact.email || '',
        phone: contact.phone || '',
        linkedin: contact.linkedin || '',
        avatarUrl: contact.avatarUrl || contact.avatar || '',
        department: contact.department || '',
        location: contact.location || '',
        timezone: contact.timezone || '',
        notes: contact.notes || '',
        aliases: contact.aliases || [],
      });
    }
  }, [contact]);

  const handleSubmit = () => {
    if (!form.name.trim() || !form.role.trim()) return;
    onSubmit({
      name: form.name.trim(),
      role: form.role.trim(),
      organization: form.organization.trim() || 'Unknown',
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      linkedin: form.linkedin.trim() || undefined,
      avatarUrl: form.avatarUrl.trim() || undefined,
      department: form.department.trim() || undefined,
      location: form.location.trim() || undefined,
      timezone: form.timezone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      aliases: form.aliases,
    });
  };

  const update = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addAlias = () => {
    if (newAlias.trim() && !form.aliases.includes(newAlias.trim())) {
      setForm(prev => ({ ...prev, aliases: [...prev.aliases, newAlias.trim()] }));
      setNewAlias('');
    }
  };

  const removeAlias = (alias: string) => {
    setForm(prev => ({ ...prev, aliases: prev.aliases.filter(a => a !== alias) }));
  };

  const Field = ({ icon: Icon, label, id, placeholder, value, type = 'text', required = false }: {
    icon: React.ElementType; label: string; id: string; placeholder: string; value: string; type?: string; required?: boolean;
  }) => (
    <div>
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" /> {label} {required && '*'}
      </Label>
      <Input id={id} type={type} placeholder={placeholder} value={value} onChange={e => update(id, e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2 sm:col-span-1">
          <Field icon={User} label="Name" id="name" placeholder="Full name" value={form.name} required />
        </div>

        {/* Role Selection */}
        <div className="col-span-2 sm:col-span-1">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Briefcase className="w-3.5 h-3.5" /> Role *
          </Label>
          <Select
            value={form.role}
            onValueChange={(val) => update('role', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              {roleTemplates
                .filter(r => r && (r.name || r.display_name))
                .map((role) => (
                  <SelectItem
                    key={role.id || role.name}
                    value={role.display_name || role.name || "Unknown"}
                  >
                    {role.display_name || role.name || "Unknown Role"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <Field icon={Mail} label="Email" id="email" placeholder="email@example.com" value={form.email} type="email" />
        <Field icon={Phone} label="Phone" id="phone" placeholder="+351 900 000 000" value={form.phone} type="tel" />

        {/* Organization Selection */}
        <div className="col-span-2 sm:col-span-1">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Building2 className="w-3.5 h-3.5" /> Organization
          </Label>
          <Select
            value={form.organization}
            onValueChange={(val) => update('organization', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select organization..." />
            </SelectTrigger>
            <SelectContent>
              {companies
                .filter(c => c && c.name)
                .map((company) => (
                  <SelectItem
                    key={company.id || company.name}
                    value={company.name || "Unknown"}
                  >
                    {company.name || "Unknown Company"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <Field icon={Linkedin} label="LinkedIn" id="linkedin" placeholder="https://linkedin.com/in/..." value={form.linkedin} />

        {/* Aliases Section */}
        <div className="col-span-2">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <User className="w-3.5 h-3.5" /> Aliases
          </Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={newAlias}
              onChange={e => setNewAlias(e.target.value)}
              placeholder="Add alias (e.g. nickname, alternate name)"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAlias())}
            />
            <Button type="button" size="sm" onClick={addAlias} variant="secondary">Add</Button>
          </div>
          {form.aliases.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.aliases.map(alias => (
                <span key={alias} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-xs">
                  {alias}
                  <button onClick={() => removeAlias(alias)} className="hover:text-destructive">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Field icon={Image} label="Avatar URL" id="avatarUrl" placeholder="https://..." value={form.avatarUrl} />
          {!form.avatarUrl && (
            <p className="text-[10px] text-muted-foreground mt-1">Enter a URL to set the contact's profile picture</p>
          )}
        </div>
        <Field icon={Briefcase} label="Department" id="department" placeholder="Engineering, Sales, etc." value={form.department} />
        <Field icon={MapPin} label="Location" id="location" placeholder="e.g. Lisbon, Portugal" value={form.location} />

        {/* Timezone Selection */}
        <div className="col-span-2 sm:col-span-1">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Clock className="w-3.5 h-3.5" /> Timezone
          </Label>
          <Select
            value={form.timezone}
            onValueChange={(val) => update('timezone', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select timezone..." />
            </SelectTrigger>
            <SelectContent>
              {timezones
                .filter(tz => tz && tz.name)
                .map((tz) => (
                  <SelectItem
                    key={tz.id || tz.code || tz.name}
                    value={tz.code || tz.name}
                  >
                    {tz.name || "Unknown Timezone"} ({tz.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </Label>
          <Textarea id="notes" placeholder="Additional notes..." value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.role.trim()} className="flex-1 gap-1.5">
          {mode === 'add' ? <><Plus className="w-4 h-4" /> Add Contact</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </Button>
      </div>
    </div>
  );
};

export default ContactForm;
