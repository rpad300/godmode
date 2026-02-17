/**
 * Purpose:
 *   Provides static seed / placeholder data for development and initial UI
 *   rendering before real project data is loaded from the server.
 *
 * Responsibilities:
 *   - Export mockProjectRoles: predefined role templates for new projects
 *   - Export mockContacts: empty placeholder (real contacts come from the API)
 *
 * Key dependencies:
 *   - None
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Only the first three roles are active by default; the rest are offered
 *     as opt-in templates during project setup.
 *   - mockContacts is intentionally empty -- kept as a typed stub so components
 *     can reference it without conditional imports.
 */

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
