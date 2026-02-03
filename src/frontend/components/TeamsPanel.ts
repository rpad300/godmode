/**
 * Teams Panel Component
 * Team list with members management
 */

import { createElement, on } from '../utils/dom';
import { teamsService, Team } from '../services/contacts';
import { showTeamModal } from './modals/TeamModal';
import { toast } from '../services/toast';

export interface TeamsPanelProps {
  onTeamClick?: (team: Team) => void;
}

/**
 * Create teams panel
 */
export function createTeamsPanel(props: TeamsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'teams-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Teams</h2>
        <span class="panel-count" id="teams-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary btn-sm" id="add-team-btn">+ Add Team</button>
      </div>
    </div>
    <div class="panel-content" id="teams-content">
      <div class="loading">Loading teams...</div>
    </div>
  `;

  // Bind events
  const addBtn = panel.querySelector('#add-team-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showTeamModal({
        mode: 'create',
        onSave: () => loadTeams(panel, props),
      });
    });
  }

  // Initial load
  loadTeams(panel, props);

  return panel;
}

/**
 * Load teams
 */
async function loadTeams(panel: HTMLElement, props: TeamsPanelProps): Promise<void> {
  const content = panel.querySelector('#teams-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const teams = await teamsService.getAll();
    renderTeams(content, teams, props);
    updateCount(panel, teams.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load teams</div>';
  }
}

/**
 * Render teams
 */
function renderTeams(container: HTMLElement, teams: Team[], props: TeamsPanelProps): void {
  if (teams.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No teams yet</p>
        <button class="btn btn-primary" id="empty-add-btn">Create Team</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showTeamModal({ mode: 'create' });
      });
    }
    return;
  }

  container.innerHTML = `
    <div class="teams-grid">
      ${teams.map(team => createTeamCard(team)).join('')}
    </div>
  `;

  // Bind click events
  container.querySelectorAll('.team-card').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const team = teams.find(t => String(t.id) === id);
      if (team) {
        if (props.onTeamClick) {
          props.onTeamClick(team);
        } else {
          showTeamModal({
            mode: 'edit',
            team,
            onSave: () => loadTeams(card.closest('.teams-panel') as HTMLElement, props),
          });
        }
      }
    });
  });
}

/**
 * Create team card HTML
 */
function createTeamCard(team: Team): string {
  const memberCount = team.memberCount || 0;
  const leadMember = team.memberDetails?.find(m => m.isLead);

  return `
    <div class="team-card" data-id="${team.id}">
      <div class="team-header">
        <div class="team-color" style="background: ${team.color || '#6366f1'}"></div>
        <div class="team-name">${escapeHtml(team.name)}</div>
        ${team.team_type ? `<span class="team-type">${team.team_type}</span>` : ''}
      </div>
      ${team.description ? `<div class="team-description">${escapeHtml(team.description)}</div>` : ''}
      <div class="team-stats">
        <span class="member-count">${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
        ${leadMember ? `<span class="team-lead">Lead: ${escapeHtml(leadMember.name)}</span>` : ''}
      </div>
      ${team.memberDetails && team.memberDetails.length > 0 ? `
        <div class="team-members-preview">
          ${team.memberDetails.slice(0, 5).map(member => `
            <div class="member-avatar" title="${escapeHtml(member.name)}">
              ${getInitials(member.name)}
            </div>
          `).join('')}
          ${team.memberDetails.length > 5 ? `<div class="more-members">+${team.memberDetails.length - 5}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#teams-count');
  if (countEl) countEl.textContent = String(count);
}

/**
 * Get initials
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createTeamsPanel;
