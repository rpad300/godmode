// Minimal stubs for components that reference mock data.
// These provide template data for roles and an empty contacts list.

export interface ProjectRole {
  id: string;
  name: string;
  description: string;
  active: boolean;
  category?: string;
}

export const mockProjectRoles: ProjectRole[] = [
  { id: '1', name: 'Project Manager', description: 'Oversees project execution and delivery', active: true },
  { id: '2', name: 'Tech Lead', description: 'Technical leadership and architecture decisions', active: true },
  { id: '3', name: 'Product Owner', description: 'Defines product vision and priorities', active: true },
  { id: '4', name: 'Designer', description: 'UI/UX design and prototyping', active: false },
  { id: '5', name: 'QA Lead', description: 'Quality assurance and testing strategy', active: false },
  { id: '6', name: 'DevOps', description: 'Infrastructure and deployment automation', active: false },
];

export const mockContacts: Array<{ id: string; name: string; email?: string; role?: string }> = [];
