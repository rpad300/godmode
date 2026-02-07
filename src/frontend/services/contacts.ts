/**
 * Contacts Service
 * Handles contact and team CRUD operations
 */

import { http } from './api';

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  company?: string;
  role?: string;
  rolePrompt?: string;
  department?: string;
  linkedin?: string;
  timezone?: string;
  location?: string;
  photoUrl?: string;
  avatarUrl?: string;
  photo_url?: string;
  avatar_url?: string;
  tags?: string[];
  notes?: string;
  aliases?: string[];
  isFavorite?: boolean;
  is_favorite?: boolean;
  relationships?: Array<{
    contactId: string;
    type: 'reports_to' | 'works_with' | 'manages' | 'collaborates';
  }>;
  activity?: Array<{
    type: 'conversation' | 'document' | 'transcript';
    id: string;
    title: string;
    date: string;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  created_at: string;
  updated_at?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  color?: string;
  team_type?: 'team' | 'department' | 'organization' | 'group';
  memberCount?: number;
  memberDetails?: Array<{
    contactId: string;
    name: string;
    role: string;
    isLead: boolean;
  }>;
  created_at: string;
}

export interface CreateContactRequest {
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  role?: string;
  department?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateContactRequest {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  role?: string;
  rolePrompt?: string;
  department?: string;
  linkedin?: string;
  timezone?: string;
  photoUrl?: string;
  tags?: string[];
  notes?: string;
  aliases?: string[];
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  color?: string;
  team_type?: 'team' | 'department' | 'organization' | 'group';
}

/**
 * Get all contacts
 */
export async function getContacts(filters?: {
  organization?: string;
  tag?: string;
  search?: string;
}): Promise<{ contacts: Contact[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (filters?.organization) params.set('organization', filters.organization);
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.search) params.set('search', filters.search);
    
    const query = params.toString();
    const url = query ? `/api/contacts?${query}` : '/api/contacts';
    
    const response = await http.get<{ contacts: Contact[]; total: number }>(url);
    const rawContacts = response.data.contacts || [];
    
    // Normalize field names (API uses snake_case, frontend uses camelCase)
    const contacts = rawContacts.map(c => ({
      ...c,
      photoUrl: c.photo_url || c.avatar_url || c.photoUrl || c.avatarUrl,
      avatarUrl: c.avatar_url || c.photo_url || c.avatarUrl || c.photoUrl,
      isFavorite: c.is_favorite ?? c.isFavorite ?? false,
      company: c.organization || c.company,
    }));
    
    return { contacts, total: response.data.total || contacts.length };
  } catch (error) {
    console.error('[ContactsService] Failed to get contacts:', error);
    return { contacts: [], total: 0 };
  }
}

/**
 * Get a single contact
 */
export async function getContact(id: string): Promise<Contact | null> {
  try {
    const response = await http.get<{ contact: Contact }>(`/api/contacts/${id}`);
    return response.data.contact;
  } catch {
    return null;
  }
}

/**
 * Create a new contact
 */
export async function createContact(data: CreateContactRequest): Promise<Contact> {
  const response = await http.post<{ id: string; ok: boolean }>('/api/contacts', data);
  return { ...data, id: response.data.id, created_at: new Date().toISOString() } as Contact;
}

/**
 * Update a contact
 */
export async function updateContact(id: string, data: UpdateContactRequest): Promise<void> {
  await http.put(`/api/contacts/${id}`, data);
}

/**
 * Delete a contact
 */
export async function deleteContact(id: string): Promise<void> {
  await http.delete(`/api/contacts/${id}`);
}

/**
 * Get contact stats
 */
export async function getContactStats(): Promise<Record<string, number>> {
  const response = await http.get<{ ok: boolean } & Record<string, number>>('/api/contacts/stats');
  return response.data;
}

/**
 * Find contact by name
 */
export async function findContactByName(name: string): Promise<Contact | null> {
  try {
    const response = await http.get<{ found: boolean; contact: Contact | null }>(`/api/contacts/find-by-name?name=${encodeURIComponent(name)}`);
    return response.data.found ? response.data.contact : null;
  } catch {
    return null;
  }
}

/**
 * Get duplicate contacts
 */
export async function getDuplicates(): Promise<{ duplicates: Contact[][]; groups: number }> {
  const response = await http.get<{ duplicates: Contact[][]; groups: number }>('/api/contacts/duplicates');
  return response.data;
}

/**
 * Merge contacts
 */
export async function mergeContacts(contactIds: string[]): Promise<string> {
  const response = await http.post<{ mergedId: string }>('/api/contacts/merge', { contactIds });
  return response.data.mergedId;
}

/**
 * Enrich contact with AI
 */
export async function enrichContact(id: string): Promise<{
  role?: string;
  department?: string;
  tags?: string[];
  additionalNotes?: string;
}> {
  const response = await http.post<{ suggestions: Record<string, unknown> }>(`/api/contacts/${id}/enrich`);
  return response.data.suggestions as {
    role?: string;
    department?: string;
    tags?: string[];
    additionalNotes?: string;
  };
}

/**
 * Export contacts in specified format
 */
export async function exportContacts(format: 'json' | 'csv' = 'json'): Promise<void> {
  try {
    const response = await fetch(`/api/contacts/export?format=${format}`);
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

/**
 * Get contact with all associations (teams, projects)
 */
export async function getContactWithAssociations(id: string): Promise<Contact & {
  projects?: Array<{ id: string; name: string; role?: string; isPrimary?: boolean }>;
} | null> {
  try {
    const response = await http.get<{ 
      contact: Contact & { 
        projects?: Array<{ id: string; name: string; role?: string; isPrimary?: boolean }> 
      } 
    }>(`/api/contacts/${id}/associations`);
    return response.data.contact;
  } catch {
    // Fallback to regular get if associations endpoint not available
    return getContact(id);
  }
}

/**
 * Add contact to a project
 */
export async function addContactToProject(contactId: string, projectId: string, options?: {
  role?: string;
  isPrimary?: boolean;
}): Promise<void> {
  await http.post(`/api/contacts/${contactId}/projects`, { projectId, ...options });
}

/**
 * Remove contact from a project
 */
export async function removeContactFromProject(contactId: string, projectId: string): Promise<void> {
  await http.delete(`/api/contacts/${contactId}/projects/${projectId}`);
}

/**
 * Get projects a contact belongs to
 */
export async function getContactProjects(contactId: string): Promise<Array<{
  id: string;
  name: string;
  role?: string;
  isPrimary?: boolean;
}>> {
  try {
    const response = await http.get<{ projects: Array<{ id: string; name: string; role?: string; isPrimary?: boolean }> }>(
      `/api/contacts/${contactId}/projects`
    );
    return response.data.projects || [];
  } catch {
    return [];
  }
}

/**
 * Get all teams
 */
export async function getTeams(): Promise<Team[]> {
  try {
    const response = await http.get<{ teams: Team[] }>('/api/teams');
    return response.data.teams || [];
  } catch {
    return [];
  }
}

/**
 * Get a single team with members
 */
export async function getTeam(id: string): Promise<{ team: Team; members: Contact[] } | null> {
  try {
    const response = await http.get<{ team: Team; members: Contact[] }>(`/api/teams/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Create a new team
 */
export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  const response = await http.post<{ id: string; ok: boolean }>('/api/teams', data);
  return { ...data, id: response.data.id, created_at: new Date().toISOString() } as Team;
}

/**
 * Update a team
 */
export async function updateTeam(id: string, data: Partial<CreateTeamRequest>): Promise<void> {
  await http.put(`/api/teams/${id}`, data);
}

/**
 * Delete a team
 */
export async function deleteTeam(id: string): Promise<void> {
  await http.delete(`/api/teams/${id}`);
}

/**
 * Add member to team
 */
export async function addTeamMember(teamId: string, contactId: string, role?: string, isLead = false): Promise<void> {
  await http.post(`/api/teams/${teamId}/members`, { contactId, role, isLead });
}

/**
 * Remove member from team
 */
export async function removeTeamMember(teamId: string, contactId: string): Promise<void> {
  await http.delete(`/api/teams/${teamId}/members/${contactId}`);
}

export const contactsService = {
  getAll: getContacts,
  get: getContact,
  create: createContact,
  update: updateContact,
  delete: deleteContact,
  getStats: getContactStats,
  findByName: findContactByName,
  getDuplicates,
  merge: mergeContacts,
  mergeContacts,
  enrich: enrichContact,
  export: exportContacts,
  getWithAssociations: getContactWithAssociations,
  addToProject: addContactToProject,
  removeFromProject: removeContactFromProject,
  getProjects: getContactProjects,
};

export const teamsService = {
  getAll: getTeams,
  get: getTeam,
  create: createTeam,
  update: updateTeam,
  delete: deleteTeam,
  addMember: addTeamMember,
  removeMember: removeTeamMember,
};
