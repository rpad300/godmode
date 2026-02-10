/**
 * Team Analysis Component
 * Behavioral profiling and team dynamics analysis
 */

import { createElement, on } from '../utils/dom';
import { teamAnalysisStore, BehavioralProfile, TeamAnalysis as TeamAnalysisData } from '../stores/teamAnalysis';
import { toast } from '../services/toast';
import { http } from '../services/api';

// Network visualization (vis.js)
declare const vis: any;

let networkInstance: any = null;

/**
 * Create Team Analysis component
 */
export function createTeamAnalysis(): HTMLElement {
    const container = createElement('div', { className: 'team-analysis-panel' });

    container.innerHTML = `
        <style>
            .team-analysis-panel {
                padding: 24px;
                min-height: 100%;
            }

            /* Profiles Grid */
            .profiles-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }

            .profile-card {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .profile-card:hover {
                border-color: var(--primary-color);
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
            }

            .profile-header {
                display: flex;
                align-items: flex-start;
                gap: 16px;
                margin-bottom: 16px;
            }

            .profile-avatar {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 20px;
                flex-shrink: 0;
            }

            .profile-info h3 {
                margin: 0 0 4px;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
            }

            .profile-info .role {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 8px;
            }

            .profile-badges {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .badge {
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }

            .badge-confidence {
                background: var(--bg-tertiary);
                color: var(--text-secondary);
            }

            .badge-confidence.high, .badge-confidence.very_high {
                background: rgba(39, 174, 96, 0.15);
                color: #27ae60;
            }

            .badge-confidence.medium {
                background: rgba(243, 156, 18, 0.15);
                color: #f39c12;
            }

            .badge-confidence.low {
                background: rgba(231, 76, 60, 0.15);
                color: #e74c3c;
            }

            .profile-metrics {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                padding-top: 16px;
                border-top: 1px solid var(--border-color);
            }

            .metric {
                text-align: center;
            }

            .metric-value {
                font-size: 20px;
                font-weight: 700;
                color: var(--text-primary);
            }

            .metric-label {
                font-size: 11px;
                color: var(--text-tertiary);
                text-transform: uppercase;
            }

            .profile-style {
                margin-top: 12px;
                padding: 12px;
                background: var(--bg-tertiary);
                border-radius: 10px;
            }

            .profile-style-label {
                font-size: 11px;
                color: var(--text-tertiary);
                text-transform: uppercase;
                margin-bottom: 4px;
            }

            .profile-style-value {
                font-size: 13px;
                color: var(--text-primary);
            }

            /* Profile Detail */
            .profile-detail {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 24px;
            }

            .profile-detail-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 24px;
            }

            .profile-detail-back {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--text-secondary);
                cursor: pointer;
                font-size: 14px;
            }

            .profile-detail-back:hover {
                color: var(--text-primary);
            }

            .profile-sections {
                display: flex;
                flex-direction: column;
                gap: 24px;
            }

            .profile-section {
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 20px;
            }

            .profile-section h4 {
                margin: 0 0 16px;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .profile-section h4 svg {
                width: 18px;
                height: 18px;
                color: var(--primary-color);
            }

            .evidence-list {
                margin-top: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .evidence-item {
                background: var(--bg-secondary);
                border-radius: 8px;
                padding: 12px;
                font-size: 13px;
            }

            .evidence-quote {
                color: var(--text-secondary);
                font-style: italic;
                border-left: 3px solid var(--primary-color);
                padding-left: 12px;
                margin-bottom: 8px;
            }

            .evidence-timestamp {
                font-size: 11px;
                color: var(--text-tertiary);
            }

            /* Team Dynamics */
            .team-dynamics {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }

            @media (max-width: 1200px) {
                .team-dynamics {
                    grid-template-columns: 1fr;
                }
            }

            .dynamics-card {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 20px;
            }

            .dynamics-card h3 {
                margin: 0 0 16px;
                font-size: 16px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .dynamics-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .dynamics-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px;
                background: var(--bg-primary);
                border-radius: 10px;
            }

            .dynamics-item-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .dynamics-item-arrow {
                color: var(--text-tertiary);
            }

            .strength-bar {
                width: 80px;
                height: 6px;
                background: var(--bg-tertiary);
                border-radius: 3px;
                overflow: hidden;
            }

            .strength-fill {
                height: 100%;
                border-radius: 3px;
                background: var(--primary-color);
            }

            /* Network Graph */
            .network-graph-container {
                height: 600px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                overflow: hidden;
            }

            .network-graph {
                width: 100%;
                height: 100%;
            }

            /* Loading & Empty States */
            .loading-state, .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px;
                text-align: center;
            }

            .loading-spinner {
                width: 48px;
                height: 48px;
                border: 4px solid var(--border-color);
                border-top-color: var(--primary-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .empty-state svg {
                width: 64px;
                height: 64px;
                color: var(--text-tertiary);
                margin-bottom: 16px;
            }

            .empty-state h3 {
                margin: 0 0 8px;
                color: var(--text-primary);
            }

            .empty-state p {
                color: var(--text-secondary);
                margin: 0;
            }

            /* Cohesion Gauge */
            .cohesion-gauge {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: var(--bg-primary);
                border-radius: 12px;
                margin-bottom: 20px;
            }

            .cohesion-score {
                font-size: 36px;
                font-weight: 700;
                color: var(--text-primary);
            }

            .cohesion-label {
                font-size: 14px;
                color: var(--text-secondary);
            }

            .tension-indicator {
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }

            .tension-low {
                background: rgba(39, 174, 96, 0.15);
                color: #27ae60;
            }

            .tension-medium {
                background: rgba(243, 156, 18, 0.15);
                color: #f39c12;
            }

            .tension-high {
                background: rgba(231, 76, 60, 0.15);
                color: #e74c3c;
            }
        </style>

        <div id="team-analysis-content">
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Loading team analysis...</p>
            </div>
        </div>
    `;

    // Initialize
    setTimeout(() => {
        initTeamAnalysis(container);
    }, 0);

    return container;
}

/**
 * Initialize team analysis
 */
async function initTeamAnalysis(container: HTMLElement): Promise<void> {
    // Subscribe to store changes
    teamAnalysisStore.subscribe(state => {
        renderContent(container, state);
    });

    // Load initial data
    await teamAnalysisStore.loadAll();

    // Setup event listeners
    setupEventListeners(container);
}

/**
 * Setup event listeners
 */
function setupEventListeners(container: HTMLElement): void {
    // Subtab switching
    document.querySelectorAll('#team-analysis-subtabs .subtab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const subtab = (e.target as HTMLElement).dataset.subtab as 'profiles' | 'team' | 'graph';
            if (subtab) {
                switchSubtab(subtab);
            }
        });
    });

    // Refresh button
    document.getElementById('team-analysis-refresh-btn')?.addEventListener('click', async () => {
        await teamAnalysisStore.loadAll();
        toast.success('Data refreshed');
    });

    // Analyze team button
    document.getElementById('team-analysis-analyze-btn')?.addEventListener('click', async () => {
        // If on profiles tab, show contact selection modal
        const state = teamAnalysisStore.getState();
        if (state.currentSubtab === 'profiles') {
            await showAnalyzeContactsModal();
        } else {
            // Team dynamics analysis for other tabs
            toast.info('Analyzing team dynamics...');
            await teamAnalysisStore.analyzeTeam(true);
            toast.success('Team analysis complete');
        }
    });
}

/**
 * Show modal to select contacts for analysis
 */
async function showAnalyzeContactsModal(): Promise<void> {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal team-analysis-modal-box">
            <div class="modal-header">
                <h2>Analyze Team Members</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body team-analysis-modal-body">
                <p class="team-analysis-modal-intro">
                    Select team members to analyze. Members with existing profiles can be re-analyzed.
                </p>
                <div id="contacts-list-loading" class="team-analysis-contacts-loading">
                    <div class="loading-spinner"></div>
                    <p class="team-analysis-loading-text">Loading contacts...</p>
                </div>
                <div id="contacts-list" class="hidden"></div>
            </div>
            <div class="modal-footer team-analysis-modal-footer">
                <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-primary" id="modal-analyze-selected-btn" disabled>Analyze Selected (0)</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Load contacts
    try {
        const response = await http.get<{ contacts?: any[]; people?: any[] }>('/api/contacts');
        const contacts = response.data?.contacts || response.data?.people || [];
        
        // Get existing profiles
        const state = teamAnalysisStore.getState();
        const existingProfileIds = new Set(state.profiles.map((p: any) => p.contact_id || p.person_id));

        const loadingEl = modal.querySelector('#contacts-list-loading') as HTMLElement;
        const listEl = modal.querySelector('#contacts-list') as HTMLElement;
        
        if (loadingEl) loadingEl.classList.add('hidden');
        if (listEl) listEl.classList.remove('hidden');

        if (contacts.length === 0) {
            listEl.innerHTML = `
                <div class="team-analysis-contacts-empty">
                    <p>No contacts found. Add contacts to the project first.</p>
                </div>
            `;
            return;
        }

        // Sort: unanalyzed first, then by name
        contacts.sort((a: any, b: any) => {
            const aAnalyzed = existingProfileIds.has(a.id);
            const bAnalyzed = existingProfileIds.has(b.id);
            if (aAnalyzed !== bAnalyzed) return aAnalyzed ? 1 : -1;
            return (a.name || '').localeCompare(b.name || '');
        });

        listEl.innerHTML = `
            <div class="team-analysis-contacts-bar">
                <span class="team-analysis-contacts-bar-text">
                    ${contacts.length} contacts • ${existingProfileIds.size} analyzed
                </span>
                <button type="button" class="btn btn-sm btn-secondary team-analysis-select-unanalyzed-btn" id="select-unanalyzed-btn">
                    Select Unanalyzed
                </button>
            </div>
            <div class="team-analysis-contacts-list">
                ${contacts.map((c: any) => {
                    const hasProfile = existingProfileIds.has(c.id);
                    const initials = (c.name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                    return `
                        <label class="contact-item team-analysis-contact-item" data-contact-id="${c.id}">
                            <input type="checkbox" class="contact-checkbox team-analysis-contact-checkbox" data-id="${c.id}" data-name="${c.name || 'Unknown'}">
                            ${(c.avatar_url || c.photo_url)
                                ? `<img src="${c.avatar_url || c.photo_url}" alt="${c.name}" class="team-analysis-contact-avatar">`
                                : `<div class="team-analysis-contact-avatar-initials">${initials}</div>`
                            }
                            <div class="team-analysis-contact-info">
                                <div class="team-analysis-contact-name">${c.name || 'Unknown'}</div>
                                <div class="team-analysis-contact-role">${c.role || c.organization || 'No role'}</div>
                            </div>
                            <span class="team-analysis-contact-badge ${hasProfile ? 'team-analysis-contact-badge-analyzed' : 'team-analysis-contact-badge-not-analyzed'}">${hasProfile ? 'Analyzed' : 'Not analyzed'}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        `;

        // Checkbox handlers
        const selectedIds = new Set<string>();
        const updateButton = () => {
            const btn = modal.querySelector('#modal-analyze-selected-btn') as HTMLButtonElement;
            if (btn) {
                btn.disabled = selectedIds.size === 0;
                btn.textContent = `Analyze Selected (${selectedIds.size})`;
            }
        };

        listEl.querySelectorAll('.contact-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const input = e.target as HTMLInputElement;
                const id = input.dataset.id;
                const label = input.closest('.contact-item') as HTMLElement;
                if (id) {
                    if (input.checked) {
                        selectedIds.add(id);
                        if (label) label.classList.add('selected');
                    } else {
                        selectedIds.delete(id);
                        if (label) label.classList.remove('selected');
                    }
                    updateButton();
                }
            });
        });

        // Select unanalyzed button
        modal.querySelector('#select-unanalyzed-btn')?.addEventListener('click', () => {
            listEl.querySelectorAll('.contact-checkbox').forEach(checkbox => {
                const input = checkbox as HTMLInputElement;
                const id = input.dataset.id;
                const label = input.closest('.contact-item') as HTMLElement;
                if (id && !existingProfileIds.has(id)) {
                    input.checked = true;
                    selectedIds.add(id);
                    if (label) label.classList.add('selected');
                }
            });
            updateButton();
        });

        // Analyze selected button
        modal.querySelector('#modal-analyze-selected-btn')?.addEventListener('click', async () => {
            if (selectedIds.size === 0) return;
            
            const btn = modal.querySelector('#modal-analyze-selected-btn') as HTMLButtonElement;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Analyzing...';

            let successCount = 0;
            let errorCount = 0;

            for (const id of selectedIds) {
                const checkbox = listEl.querySelector(`.contact-checkbox[data-id="${id}"]`) as HTMLInputElement;
                const name = checkbox?.dataset.name || 'Contact';
                
                try {
                    btn.textContent = `Analyzing ${name}...`;
                    await teamAnalysisStore.analyzeProfile(id, { forceReanalysis: true });
                    successCount++;
                    
                    // Mark as analyzed in the UI
                    const label = checkbox?.closest('.contact-item') as HTMLElement;
                    const badge = label?.querySelector('.team-analysis-contact-badge');
                    if (badge) {
                        badge.classList.remove('team-analysis-contact-badge-not-analyzed');
                        badge.classList.add('team-analysis-contact-badge-analyzed');
                        badge.textContent = 'Analyzed';
                    }
                } catch (error: any) {
                    console.error(`Failed to analyze ${name}:`, error);
                    errorCount++;
                }
            }

            // Reload profiles
            await teamAnalysisStore.loadProfiles();

            if (successCount > 0) {
                toast.success(`Successfully analyzed ${successCount} team member${successCount > 1 ? 's' : ''}`);
            }
            if (errorCount > 0) {
                toast.error(`Failed to analyze ${errorCount} contact${errorCount > 1 ? 's' : ''}`);
            }

            closeModal();
        });

    } catch (error) {
        const loadingEl = modal.querySelector('#contacts-list-loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <p class="team-analysis-error-text">Failed to load contacts. Please try again.</p>
            `;
        }
    }
}

/**
 * Switch subtab
 */
async function switchSubtab(subtab: 'profiles' | 'team' | 'graph'): Promise<void> {
    // Update subtab buttons
    document.querySelectorAll('#team-analysis-subtabs .subtab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-subtab') === subtab);
    });

    // Load graph data BEFORE switching to graph tab to ensure data is available
    if (subtab === 'graph') {
        console.log('[TeamAnalysis] Loading graph data before switching tab...');
        await teamAnalysisStore.loadGraphData();
    }

    // Now switch tab - this triggers re-render with the loaded data
    teamAnalysisStore.setSubtab(subtab);
}

/**
 * Render content based on state
 */
function renderContent(container: HTMLElement, state: any): void {
    const contentEl = container.querySelector('#team-analysis-content');
    if (!contentEl) return;

    if (state.loading) {
        contentEl.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Loading team analysis...</p>
            </div>
        `;
        return;
    }

    if (state.analyzing) {
        contentEl.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Analyzing... This may take a moment.</p>
            </div>
        `;
        return;
    }

    // Render based on current subtab from store state
    const currentSubtab = state.currentSubtab || 'profiles';
    console.log('[TeamAnalysis] renderContent - currentSubtab:', currentSubtab);
    
    switch (currentSubtab) {
        case 'profiles':
            renderProfiles(contentEl, state);
            break;
        case 'team':
            renderTeamDynamics(contentEl, state);
            break;
        case 'graph':
            renderNetworkGraph(contentEl, state);
            break;
    }
}

/**
 * Render profiles grid
 */
function renderProfiles(container: Element, state: any): void {
    const { profiles, selectedProfile } = state;

    if (selectedProfile) {
        renderProfileDetail(container, selectedProfile);
        return;
    }

    if (profiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="5" r="3"/>
                    <circle cx="5" cy="19" r="3"/>
                    <circle cx="19" cy="19" r="3"/>
                    <line x1="12" y1="8" x2="5" y2="16"/>
                    <line x1="12" y1="8" x2="19" y2="16"/>
                </svg>
                <h3>No Profiles Yet</h3>
                <p>Select a person to analyze, or process transcripts to build profiles automatically.</p>
                <div id="people-list-container" class="team-analysis-people-container">
                    <p class="team-analysis-people-loading">Loading people...</p>
                </div>
            </div>
        `;
        
        // Load people for manual analysis
        loadPeopleForAnalysis(container);
        return;
    }

    container.innerHTML = `
        <div class="profiles-grid">
            ${profiles.map((p: BehavioralProfile) => renderProfileCard(p)).join('')}
        </div>
    `;

    // Add click handlers
    container.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('click', () => {
            const personId = (card as HTMLElement).dataset.personId;
            if (personId) {
                teamAnalysisStore.loadProfile(personId);
            }
        });
    });

    // Add analyze buttons
    container.querySelectorAll('.analyze-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const personId = (btn as HTMLElement).dataset.personId;
            if (personId) {
                toast.info('Analyzing profile...');
                await teamAnalysisStore.analyzeProfile(personId, { forceReanalysis: true });
                toast.success('Profile analysis complete');
            }
        });
    });
}

/**
 * Render a single profile card
 */
function renderProfileCard(profile: BehavioralProfile): string {
    const contact = (profile as any).contact || {};
    const name = contact.name || 'Unknown';
    const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    const role = contact.role || contact.organization || 'No role';
    const confidence = profile.confidence_level || 'low';
    const avatarUrl = contact.avatar_url || contact.photo_url;
    const contactId = (profile as any).contact_id || profile.person_id;

    return `
        <div class="profile-card" data-person-id="${contactId}">
            <div class="profile-header">
                ${avatarUrl 
                    ? `<img class="profile-avatar" src="${avatarUrl}" alt="${name}" />`
                    : `<div class="profile-avatar">${initials}</div>`
                }
                <div class="profile-info">
                    <h3>${name}</h3>
                    <div class="role">${role}</div>
                    <div class="profile-badges">
                        <span class="badge badge-confidence ${confidence}">${confidence.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>
            <div class="profile-metrics">
                <div class="metric">
                    <div class="metric-value">${profile.influence_score || 0}</div>
                    <div class="metric-label">Influence</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${profile.transcript_count || 0}</div>
                    <div class="metric-label">Transcripts</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${profile.risk_tolerance || '-'}</div>
                    <div class="metric-label">Risk</div>
                </div>
            </div>
            ${profile.communication_style ? `
                <div class="profile-style">
                    <div class="profile-style-label">Communication Style</div>
                    <div class="profile-style-value">${profile.communication_style}</div>
                </div>
            ` : ''}
            <button type="button" class="btn btn-secondary analyze-btn team-analysis-analyze-btn-full" data-person-id="${contactId}">
                Re-analyze
            </button>
        </div>
    `;
}

/**
 * Render profile detail view
 */
function renderProfileDetail(container: Element, profile: BehavioralProfile): void {
    const contact = (profile as any).contact || {};
    const name = contact.name || 'Unknown';
    const data = profile.profile_data || {};

    container.innerHTML = `
        <div class="profile-detail">
            <div class="profile-detail-header">
                <div class="profile-detail-back" id="back-to-profiles">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to Profiles
                </div>
                <h2>${name}</h2>
            </div>

            <div class="profile-sections">
                ${renderCommunicationSection(data)}
                ${renderMotivationsSection(data)}
                ${renderPressureSection(data)}
                ${renderInfluenceSection(data)}
                ${renderVulnerabilitiesSection(data)}
                ${renderStrategySection(data)}
                ${renderWarningSection(data)}
                ${renderPowerSection(data)}
            </div>
        </div>
    `;

    // Back button handler
    container.querySelector('#back-to-profiles')?.addEventListener('click', () => {
        teamAnalysisStore.setSelectedProfile(null);
    });
}

/**
 * Render communication identity section
 */
function renderCommunicationSection(data: any): string {
    const comm = data.communication_identity;
    if (!comm) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Communication Identity
            </h4>
            <div class="team-analysis-comm-grid">
                ${comm.dominant_style ? `<div><strong>Style:</strong> ${comm.dominant_style}</div>` : ''}
                ${comm.intervention_rhythm ? `<div><strong>Rhythm:</strong> ${comm.intervention_rhythm}</div>` : ''}
                ${comm.textual_body_language ? `<div><strong>Textual Cues:</strong> ${comm.textual_body_language}</div>` : ''}
            </div>
            ${renderEvidenceList(comm.evidence)}
        </div>
    `;
}

/**
 * Render motivations section
 */
function renderMotivationsSection(data: any): string {
    const mot = data.motivations_and_priorities;
    if (!mot) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Motivations & Priorities
            </h4>
            ${mot.values_most?.length ? `<div><strong>Values most:</strong> ${mot.values_most.join(', ')}</div>` : ''}
            ${mot.avoids?.length ? `<div class="team-analysis-mot-avoids"><strong>Avoids:</strong> ${mot.avoids.join(', ')}</div>` : ''}
            <div class="team-analysis-mot-confidence">
                Confidence: ${mot.confidence || 'Not specified'}
            </div>
        </div>
    `;
}

/**
 * Render behavior under pressure section
 */
function renderPressureSection(data: any): string {
    const behaviors = data.behavior_under_pressure;
    if (!behaviors?.length) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Behavior Under Pressure
            </h4>
            <div class="evidence-list">
                ${behaviors.map((b: any) => `
                    <div class="evidence-item">
                        <strong>${b.situation}</strong>
                        <p class="team-analysis-evidence-p">${b.observed_behavior}</p>
                        ${b.quote ? `<div class="evidence-quote">"${b.quote}"</div>` : ''}
                        ${b.timestamp ? `<div class="evidence-timestamp">${b.timestamp}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render influence tactics section
 */
function renderInfluenceSection(data: any): string {
    const tactics = data.influence_tactics;
    if (!tactics?.length) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Influence Tactics
            </h4>
            <div class="evidence-list">
                ${tactics.map((t: any) => `
                    <div class="evidence-item">
                        <strong>${t.objective}</strong>
                        <p class="team-analysis-evidence-p">${t.tactic}</p>
                        ${t.example ? `<div class="evidence-quote">${t.example}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render vulnerabilities section
 */
function renderVulnerabilitiesSection(data: any): string {
    const vuln = data.vulnerabilities;
    if (!vuln) return '';

    const sections = [];

    if (vuln.defense_triggers?.length) {
        sections.push(`
            <div class="team-analysis-vuln-block">
                <strong class="team-analysis-vuln-title-defense">Defense Triggers</strong>
                <ul class="team-analysis-vuln-ul">
                    ${vuln.defense_triggers.map((t: any) => `<li>${t.trigger}</li>`).join('')}
                </ul>
            </div>
        `);
    }

    if (vuln.blind_spots?.length) {
        sections.push(`
            <div class="team-analysis-vuln-block">
                <strong class="team-analysis-vuln-title-blind">Blind Spots</strong>
                <ul class="team-analysis-vuln-ul">
                    ${vuln.blind_spots.map((b: any) => `<li>${b.description}</li>`).join('')}
                </ul>
            </div>
        `);
    }

    if (sections.length === 0) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Vulnerabilities & Friction Points
            </h4>
            ${sections.join('')}
        </div>
    `;
}

/**
 * Render interaction strategy section
 */
function renderStrategySection(data: any): string {
    const strat = data.interaction_strategy;
    if (!strat) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Recommended Interaction Strategy
            </h4>
            ${strat.ideal_format ? `
                <div class="team-analysis-strat-block">
                    <strong>Ideal Format</strong>
                    <div class="team-analysis-strat-meta">
                        ${strat.ideal_format.channel ? `Channel: ${strat.ideal_format.channel}` : ''}
                        ${strat.ideal_format.structure ? ` | Structure: ${strat.ideal_format.structure}` : ''}
                        ${strat.ideal_format.timing ? ` | Timing: ${strat.ideal_format.timing}` : ''}
                    </div>
                </div>
            ` : ''}
            ${strat.framing_that_works?.length ? `
                <div class="team-analysis-strat-block">
                    <strong class="team-analysis-strat-title-works">What Works</strong>
                    <ul class="team-analysis-vuln-ul">
                        ${strat.framing_that_works.map((f: string) => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${strat.what_to_avoid?.length ? `
                <div class="team-analysis-strat-block">
                    <strong class="team-analysis-strat-title-avoid">What to Avoid</strong>
                    <ul class="team-analysis-vuln-ul">
                        ${strat.what_to_avoid.map((a: string) => `<li>${a}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render early warning signs section
 */
function renderWarningSection(data: any): string {
    const warnings = data.early_warning_signs;
    if (!warnings?.length) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Early Warning Signs
            </h4>
            <div class="evidence-list">
                ${warnings.map((w: any) => `
                    <div class="evidence-item">
                        <strong>${w.signal}</strong>
                        <p class="team-analysis-warning-p">Indicates: ${w.indicates}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render power analysis section
 */
function renderPowerSection(data: any): string {
    const power = data.power_analysis;
    if (!power?.length) return '';

    return `
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Power & Dependency Analysis
            </h4>
            <div class="evidence-list">
                ${power.map((p: any) => `
                    <div class="evidence-item">
                        <strong>${p.factor}</strong>
<p class="team-analysis-warning-p">${p.assessment}</p>
                    ${p.strategic_implication ? `<p class="team-analysis-strategic-p">→ ${p.strategic_implication}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render evidence list
 */
function renderEvidenceList(evidence: any[]): string {
    if (!evidence?.length) return '';

    return `
        <div class="evidence-list">
            ${evidence.map(e => `
                <div class="evidence-item">
                    ${e.quote ? `<div class="evidence-quote">"${e.quote}"</div>` : ''}
                    ${e.observation ? `<p class="team-analysis-observation-p">${e.observation}</p>` : ''}
                    ${e.timestamp ? `<div class="evidence-timestamp">${e.timestamp}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render team dynamics view
 */
/**
 * Build a name resolver that maps Person_N to real names
 */
function buildNameResolver(profiles: any[]): (name: string) => { name: string; initials: string; role: string; avatarUrl?: string } {
    const mapping: Record<string, { name: string; initials: string; role: string; avatarUrl?: string }> = {};
    
    // Map by Person_N pattern (index-based)
    profiles.forEach((profile, index) => {
        const contact = profile.contact || {};
        const realName = contact.name || 'Unknown';
        const initials = realName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        const info = {
            name: realName,
            initials,
            role: contact.role || contact.organization || '',
            avatarUrl: contact.avatar_url || contact.photo_url
        };
        
        // Map various patterns
        mapping[`person_${index + 1}`] = info;
        mapping[`person ${index + 1}`] = info;
        mapping[`Person_${index + 1}`] = info;
        mapping[`Person ${index + 1}`] = info;
        mapping[realName.toLowerCase()] = info;
        
        // Also map by first name
        const firstName = realName.split(' ')[0];
        if (firstName) {
            mapping[firstName.toLowerCase()] = info;
        }
    });
    
    return (name: string) => {
        if (!name) return { name: 'Unknown', initials: '?', role: '' };
        const normalized = name.toLowerCase().trim();
        return mapping[normalized] || { 
            name: name.replace(/_/g, ' '), 
            initials: name.substring(0, 2).toUpperCase(), 
            role: '' 
        };
    };
}

/**
 * Render a person chip with avatar and name
 */
function renderPersonChip(personName: string, resolveName: (name: string) => any): string {
    const info = resolveName(personName);
    return `
        <div class="person-chip">
            ${info.avatarUrl 
                ? `<img class="person-chip-avatar" src="${info.avatarUrl}" alt="${info.name}" />`
                : `<div class="person-chip-avatar person-chip-initials">${info.initials}</div>`
            }
            <span class="person-chip-name">${info.name}</span>
        </div>
    `;
}

function renderTeamDynamics(container: Element, state: any): void {
    const { teamAnalysis, profiles } = state;

    console.log('[TeamAnalysis] renderTeamDynamics called, teamAnalysis:', teamAnalysis);

    if (!teamAnalysis) {
        console.log('[TeamAnalysis] No teamAnalysis data, showing empty state');
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="5" r="3"/>
                    <circle cx="5" cy="19" r="3"/>
                    <circle cx="19" cy="19" r="3"/>
                    <line x1="12" y1="8" x2="5" y2="16"/>
                    <line x1="12" y1="8" x2="19" y2="16"/>
                </svg>
                <h3>No Team Analysis Yet</h3>
                <p>Click "Analyze Team" to generate team dynamics analysis.</p>
            </div>
        `;
        return;
    }
    
    // Build name resolver from profiles
    const resolveName = buildNameResolver(profiles || []);
    
    console.log('[TeamAnalysis] Rendering team dynamics with data:', {
        cohesion: teamAnalysis.cohesion_score,
        tension: teamAnalysis.tension_level,
        teamSize: teamAnalysis.team_size,
        influenceMapLength: teamAnalysis.influence_map?.length
    });

    const tensionClass = `tension-${teamAnalysis.tension_level || 'low'}`;
    const cohesionColor = teamAnalysis.cohesion_score >= 70 ? '#27ae60' : 
                          teamAnalysis.cohesion_score >= 40 ? '#f39c12' : '#e74c3c';
    
    // Get additional analysis data
    const analysisData = teamAnalysis.analysis_data || {};
    const analysisDate = analysisData.analysis_date || teamAnalysis.last_analysis_at;
    const recommendations = analysisData.recommendations || [];
    const riskFactors = analysisData.risk_factors || [];
    const commFlow = analysisData.communication_flow || {};
    const dominantPattern = analysisData.dominant_communication_pattern || '';

    container.innerHTML = `
        <div class="team-dynamics-header">
            <div class="cohesion-card">
                <div class="cohesion-score-circle" style="--score-color: ${cohesionColor}">
                    <span class="score-value">${teamAnalysis.cohesion_score || 0}</span>
                    <span class="score-label">Cohesion</span>
                </div>
                <div class="cohesion-details">
                    <h3>Team Cohesion Score</h3>
                    <span class="tension-badge ${tensionClass}">
                        ${teamAnalysis.tension_level || 'unknown'} tension
                    </span>
                </div>
            </div>
            <div class="team-size-card">
                <div class="team-size-value">${teamAnalysis.team_size || 0}</div>
                <div class="team-size-label">Team Members</div>
            </div>
            <div class="analysis-meta-card">
                <div class="meta-icon">📊</div>
                <div class="meta-details">
                    <span class="meta-label">Analysis Date</span>
                    <span class="meta-value">${analysisDate ? new Date(analysisDate).toLocaleDateString() : 'N/A'}</span>
                </div>
            </div>
        </div>

        ${dominantPattern ? `
            <div class="executive-summary-section">
                <div class="summary-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <h3>Executive Summary</h3>
                </div>
                <p class="summary-text">${replacePersonNames(dominantPattern, resolveName)}</p>
            </div>
        ` : ''}

        ${renderInfluenceScoreboard(profiles || [], resolveName)}

        ${renderCommunicationFlow(commFlow, resolveName)}

        <div class="team-dynamics-grid">
            ${renderInfluenceMapV2(teamAnalysis.influence_map || [], resolveName)}
            ${renderAlliancesV2(teamAnalysis.alliances || [], resolveName)}
            ${renderTensionsV2(teamAnalysis.tensions || [], resolveName)}
            ${renderPowerCentersV2(analysisData.power_centers || [], resolveName)}
        </div>

        ${renderRiskFactors(riskFactors)}
        ${renderRecommendations(recommendations, resolveName)}
    `;
}

/**
 * Render influence scoreboard - ranking of team members by influence
 */
function renderInfluenceScoreboard(profiles: any[], resolveName: (name: string) => any): string {
    if (!profiles?.length) return '';

    // Sort profiles by influence score (descending)
    const sortedProfiles = [...profiles]
        .filter(p => p.influence_score !== undefined)
        .sort((a, b) => (b.influence_score || 0) - (a.influence_score || 0));

    if (sortedProfiles.length === 0) return '';

    const maxScore = Math.max(...sortedProfiles.map(p => p.influence_score || 0), 100);

    // Medal icons for top 3
    const medals = ['🥇', '🥈', '🥉'];

    return `
        <div class="influence-scoreboard-section">
            <div class="scoreboard-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3>Influence Scoreboard</h3>
                <span class="section-badge team-analysis-section-badge-amber">
                    ${sortedProfiles.length} members ranked
                </span>
            </div>
            <div class="scoreboard-list">
                ${sortedProfiles.map((profile, index) => {
                    const contact = profile.contact || {};
                    const name = contact.name || profile.person_name || 'Unknown';
                    const role = contact.role || contact.organization || '';
                    const avatarUrl = contact.avatar_url || contact.photo_url;
                    const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                    const score = profile.influence_score || 0;
                    const barWidth = (score / maxScore) * 100;
                    const rank = index + 1;
                    const medal = medals[index] || '';
                    const isTopThree = index < 3;
                    
                    // Risk indicator
                    const riskLevel = profile.risk_tolerance || profile.risk_level || 'medium';
                    const riskColors: Record<string, string> = {
                        'low': '#10b981',
                        'medium': '#f59e0b',
                        'high': '#ef4444'
                    };
                    const riskColor = riskColors[riskLevel] || riskColors['medium'];
                    
                    // Communication style snippet
                    const commStyle = profile.communication_style || profile.profile_data?.communication_identity?.dominant_style || '';
                    const styleSnippet = commStyle.split(';')[0]?.substring(0, 50) || '';

                    return `
                        <div class="scoreboard-item ${isTopThree ? 'top-three' : ''}">
                            <div class="rank-badge ${isTopThree ? 'rank-' + rank : ''}">
                                ${medal || rank}
                            </div>
                            <div class="scoreboard-avatar">
                                ${avatarUrl 
                                    ? `<img src="${avatarUrl}" alt="${name}">`
                                    : `<span class="avatar-initials">${initials}</span>`
                                }
                            </div>
                            <div class="scoreboard-info">
                                <div class="scoreboard-name">${name}</div>
                                <div class="scoreboard-role">${role}</div>
                                ${styleSnippet ? `<div class="scoreboard-style">${styleSnippet}</div>` : ''}
                            </div>
                            <div class="scoreboard-metrics">
                                <div class="influence-meter">
                                    <div class="meter-label">Influence</div>
                                    <div class="meter-bar">
                                        <div class="meter-fill" style="width: ${barWidth}%;"></div>
                                    </div>
                                    <div class="meter-value">${score}</div>
                                </div>
                                <div class="risk-indicator" style="--risk-color: ${riskColor};">
                                    <span class="risk-dot"></span>
                                    <span class="risk-text">${riskLevel} risk</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render communication flow section
 */
function renderCommunicationFlow(commFlow: any, resolveName: (name: string) => any): string {
    if (!commFlow || (!commFlow.bottlenecks?.length && !commFlow.information_brokers?.length)) {
        return '';
    }

    return `
        <div class="communication-flow-section">
            <div class="flow-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <h3>Communication Flow</h3>
            </div>
            <div class="flow-cards">
                ${commFlow.bottlenecks?.length ? `
                    <div class="flow-card bottleneck-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🚧</span>
                            <h4>Bottlenecks</h4>
                        </div>
                        <ul class="flow-list">
                            ${commFlow.bottlenecks.map((b: string) => `<li>${replacePersonNames(b, resolveName)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${commFlow.information_brokers?.length ? `
                    <div class="flow-card broker-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🔗</span>
                            <h4>Information Brokers</h4>
                        </div>
                        <div class="broker-chips">
                            ${commFlow.information_brokers.map((b: string) => renderPersonChip(b, resolveName)).join('')}
                        </div>
                        <p class="flow-hint">Key connectors who bridge information across the team</p>
                    </div>
                ` : ''}
                ${commFlow.central_nodes?.length ? `
                    <div class="flow-card central-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">⭐</span>
                            <h4>Central Nodes</h4>
                        </div>
                        <div class="broker-chips">
                            ${commFlow.central_nodes.map((n: string) => renderPersonChip(n, resolveName)).join('')}
                        </div>
                        <p class="flow-hint">Most connected team members</p>
                    </div>
                ` : ''}
                ${commFlow.isolated_members?.length ? `
                    <div class="flow-card isolated-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🏝️</span>
                            <h4>Isolated Members</h4>
                        </div>
                        <div class="broker-chips">
                            ${commFlow.isolated_members.map((m: string) => renderPersonChip(m, resolveName)).join('')}
                        </div>
                        <p class="flow-hint">Members with fewer connections - may need inclusion</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Replace Person_X names in text with real names
 */
function replacePersonNames(text: string, resolveName: (name: string) => any): string {
    return text.replace(/Person_(\d+)/g, (match) => {
        const resolved = resolveName(match);
        return resolved.name || match;
    });
}

/**
 * Render risk factors section
 */
function renderRiskFactors(riskFactors: string[]): string {
    if (!riskFactors?.length) return '';

    return `
        <div class="risk-factors-section">
            <div class="section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Risk Factors</h3>
                <span class="section-badge risk-badge">${riskFactors.length} identified</span>
            </div>
            <div class="risk-list">
                ${riskFactors.map((risk, i) => `
                    <div class="risk-item">
                        <span class="risk-number">${i + 1}</span>
                        <p>${risk}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render recommendations section
 */
function renderRecommendations(recommendations: string[], resolveName: (name: string) => any): string {
    if (!recommendations?.length) return '';

    return `
        <div class="recommendations-section">
            <div class="section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <h3>Recommendations</h3>
                <span class="section-badge rec-badge">${recommendations.length} actions</span>
            </div>
            <div class="recommendations-list">
                ${recommendations.map((rec, i) => `
                    <div class="recommendation-item">
                        <div class="rec-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                            </svg>
                        </div>
                        <div class="rec-content">
                            <span class="rec-number">Action ${i + 1}</span>
                            <p>${replacePersonNames(rec, resolveName)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render influence map V2 with person chips
 */
function renderInfluenceMapV2(influenceMap: any[], resolveName: (name: string) => any): string {
    if (!influenceMap.length) return '';

    // Type colors and icons
    const typeConfig: Record<string, { color: string; bg: string; icon: string; desc: string }> = {
        'direct': { color: '#3b82f6', bg: '#eff6ff', icon: '→', desc: 'Direct influence through communication and decisions' },
        'technical': { color: '#8b5cf6', bg: '#f5f3ff', icon: '⚙', desc: 'Influence through technical expertise and knowledge' },
        'political': { color: '#f59e0b', bg: '#fffbeb', icon: '♟', desc: 'Influence through organizational dynamics and alliances' },
        'social': { color: '#10b981', bg: '#ecfdf5', icon: '🤝', desc: 'Influence through relationships and social capital' },
        'resource': { color: '#ef4444', bg: '#fef2f2', icon: '📊', desc: 'Influence through control of resources' }
    };

    return `
        <div class="dynamics-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>Influence Map</h3>
                <span class="dynamics-count">${influenceMap.length} connections</span>
            </div>
            <div class="dynamics-list">
                ${influenceMap.slice(0, 10).map(inf => {
                    const strengthPct = Math.round((inf.strength || 0.5) * 100);
                    const strengthLabel = strengthPct >= 70 ? 'Strong' : strengthPct >= 40 ? 'Moderate' : 'Weak';
                    const infType = (inf.influence_type || 'direct').toLowerCase();
                    const config = typeConfig[infType] || typeConfig['direct'];
                    const hasEvidence = inf.evidence && inf.evidence.length > 10;
                    const itemId = `inf-${Math.random().toString(36).substr(2, 9)}`;
                    
                    return `
                        <div class="dynamics-item influence-item expandable-item" data-item-id="${itemId}">
                            <div class="influence-main-row">
                                <div class="influence-flow">
                                    ${renderPersonChip(inf.from_person, resolveName)}
                                    <div class="influence-arrow">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                            <polyline points="12 5 19 12 12 19"/>
                                        </svg>
                                    </div>
                                    ${renderPersonChip(inf.to_person, resolveName)}
                                </div>
                                <div class="influence-meta">
                                    <span class="type-badge" style="background: ${config.bg}; color: ${config.color};" title="${config.desc}">
                                        <span class="type-icon">${config.icon}</span>
                                        ${infType}
                                    </span>
                                </div>
                                <div class="influence-strength-container">
                                    <div class="strength-value">${strengthPct}%</div>
                                    <div class="strength-bar-mini">
                                        <div class="strength-fill-mini" style="width: ${strengthPct}%; background: ${config.color};"></div>
                                    </div>
                                    <div class="strength-label">${strengthLabel}</div>
                                </div>
                                ${hasEvidence ? `<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>` : ''}
                            </div>
                            ${hasEvidence ? `
                                <div class="item-details">
                                    <div class="evidence-text">
                                        <strong>Evidence:</strong> ${replacePersonNames(inf.evidence, resolveName)}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render alliances V2 with person chips
 */
function renderAlliancesV2(alliances: any[], resolveName: (name: string) => any): string {
    if (!alliances.length) return '';

    // Alliance type colors
    const typeConfig: Record<string, { color: string; bg: string; icon: string; desc: string }> = {
        'natural': { color: '#10b981', bg: '#ecfdf5', icon: '🌱', desc: 'Organic alliance based on shared values and goals' },
        'circumstantial': { color: '#6366f1', bg: '#eef2ff', icon: '🔗', desc: 'Alliance formed due to shared circumstances or challenges' },
        'strategic': { color: '#f59e0b', bg: '#fffbeb', icon: '♟', desc: 'Deliberate alliance for mutual benefit' },
        'historical': { color: '#8b5cf6', bg: '#f5f3ff', icon: '📜', desc: 'Long-standing alliance based on history' }
    };

    return `
        <div class="dynamics-card alliance-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Alliances</h3>
                <span class="dynamics-count">${alliances.length} groups</span>
            </div>
            <div class="dynamics-list">
                ${alliances.map(all => {
                    let members = all.members || [];
                    if (typeof members === 'string') {
                        members = members.split(/[\s,]+/).filter((m: string) => m.trim());
                    }
                    const strengthPct = Math.round((all.strength || 0.5) * 100);
                    const bondLabel = strengthPct >= 70 ? 'Strong bond' : strengthPct >= 40 ? 'Moderate bond' : 'Weak bond';
                    const allianceType = (all.alliance_type || 'natural').toLowerCase();
                    const config = typeConfig[allianceType] || typeConfig['natural'];
                    const hasEvidence = all.evidence && all.evidence.length > 10;
                    const hasSharedValues = all.shared_values && all.shared_values.length > 0;
                    const itemId = `all-${Math.random().toString(36).substr(2, 9)}`;
                    
                    return `
                        <div class="dynamics-item alliance-item expandable-item" data-item-id="${itemId}">
                            <div class="alliance-main-row">
                                <div class="alliance-members">
                                    ${members.map((m: string) => renderPersonChip(m, resolveName)).join('<span class="alliance-connector">&</span>')}
                                </div>
                                <div class="alliance-meta">
                                    <span class="type-badge" style="background: ${config.bg}; color: ${config.color};" title="${config.desc}">
                                        <span class="type-icon">${config.icon}</span>
                                        ${allianceType}
                                    </span>
                                </div>
                                <div class="alliance-strength-container">
                                    <div class="strength-value alliance-value">${strengthPct}%</div>
                                    <div class="strength-bar-mini alliance-bar">
                                        <div class="strength-fill-mini" style="width: ${strengthPct}%; background: ${config.color};"></div>
                                    </div>
                                    <div class="strength-label">${bondLabel}</div>
                                </div>
                                ${(hasEvidence || hasSharedValues) ? `<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>` : ''}
                            </div>
                            ${(hasEvidence || hasSharedValues) ? `
                                <div class="item-details">
                                    ${hasSharedValues ? `
                                        <div class="shared-values">
                                            <strong>Shared Values:</strong>
                                            <ul>${all.shared_values.map((v: string) => `<li>${v}</li>`).join('')}</ul>
                                        </div>
                                    ` : ''}
                                    ${hasEvidence ? `
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${replacePersonNames(all.evidence, resolveName)}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render tensions V2 with person chips
 */
function renderTensionsV2(tensions: any[], resolveName: (name: string) => any): string {
    if (!tensions.length) return '';

    // Tension type colors
    const typeConfig: Record<string, { color: string; bg: string; icon: string; desc: string }> = {
        'technical': { color: '#8b5cf6', bg: '#f5f3ff', icon: '⚙', desc: 'Disagreements about technical approaches or solutions' },
        'resource': { color: '#f59e0b', bg: '#fffbeb', icon: '📊', desc: 'Competition for resources, time, or attention' },
        'political': { color: '#ef4444', bg: '#fef2f2', icon: '♟', desc: 'Power dynamics and organizational influence conflicts' },
        'communication': { color: '#3b82f6', bg: '#eff6ff', icon: '💬', desc: 'Misunderstandings or communication style clashes' },
        'values': { color: '#10b981', bg: '#ecfdf5', icon: '⚖', desc: 'Differences in core values or priorities' }
    };

    // Level colors
    const levelColors: Record<string, { color: string; bg: string }> = {
        'high': { color: '#dc2626', bg: '#fef2f2' },
        'medium': { color: '#f59e0b', bg: '#fffbeb' },
        'low': { color: '#10b981', bg: '#ecfdf5' }
    };

    return `
        <div class="dynamics-card tension-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Tensions</h3>
                <span class="dynamics-count">${tensions.length} identified</span>
            </div>
            <div class="dynamics-list">
                ${tensions.map(t => {
                    let between = t.between || [];
                    if (typeof between === 'string') {
                        between = between.split(/[\s,]+/).filter((m: string) => m.trim());
                    }
                    const level = (t.level || 'low').toLowerCase();
                    const levelClass = `tension-level-${level}`;
                    const levelConfig = levelColors[level] || levelColors['low'];
                    const tensionType = (t.tension_type || 'communication').toLowerCase();
                    const config = typeConfig[tensionType] || typeConfig['communication'];
                    const hasEvidence = t.evidence && t.evidence.length > 10;
                    const hasTriggers = t.triggers && t.triggers.length > 0;
                    const itemId = `ten-${Math.random().toString(36).substr(2, 9)}`;
                    
                    return `
                        <div class="dynamics-item tension-item expandable-item ${levelClass}" data-item-id="${itemId}">
                            <div class="tension-main-row">
                                <div class="tension-parties">
                                    ${between.slice(0, 2).map((p: string) => renderPersonChip(p, resolveName)).join('<span class="tension-vs">↔</span>')}
                                </div>
                                <div class="tension-meta">
                                    <span class="type-badge" style="background: ${config.bg}; color: ${config.color};" title="${config.desc}">
                                        <span class="type-icon">${config.icon}</span>
                                        ${tensionType}
                                    </span>
                                </div>
                                <span class="tension-badge" style="background: ${levelConfig.bg}; color: ${levelConfig.color};">${level}</span>
                                ${(hasEvidence || hasTriggers) ? `<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>` : ''}
                            </div>
                            ${(hasEvidence || hasTriggers) ? `
                                <div class="item-details">
                                    ${hasTriggers ? `
                                        <div class="triggers-list">
                                            <strong>Triggers:</strong>
                                            <ul>${t.triggers.map((tr: string) => `<li>${tr}</li>`).join('')}</ul>
                                        </div>
                                    ` : ''}
                                    ${hasEvidence ? `
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${replacePersonNames(t.evidence, resolveName)}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render power centers V2 with person chips
 */
function renderPowerCentersV2(powerCenters: any[], resolveName: (name: string) => any): string {
    if (!powerCenters.length) return '';

    // Power type configuration
    const typeConfig: Record<string, { color: string; bg: string; icon: string; desc: string }> = {
        'technical': { color: '#8b5cf6', bg: '#f5f3ff', icon: '⚙', desc: 'Power through technical expertise and knowledge' },
        'formal': { color: '#3b82f6', bg: '#eff6ff', icon: '👔', desc: 'Power through official role and authority' },
        'informal': { color: '#f59e0b', bg: '#fffbeb', icon: '💬', desc: 'Power through relationships and influence' },
        'social': { color: '#10b981', bg: '#ecfdf5', icon: '🤝', desc: 'Power through social connections and trust' },
        'resource': { color: '#ef4444', bg: '#fef2f2', icon: '📊', desc: 'Power through control of resources' }
    };

    return `
        <div class="dynamics-card power-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <h3>Power Centers</h3>
                <span class="dynamics-count">${powerCenters.length} key players</span>
            </div>
            <div class="dynamics-list">
                ${powerCenters.map(pc => {
                    const reachPct = Math.round(pc.influence_reach || 50);
                    const powerType = (pc.power_type || 'informal').toLowerCase();
                    const config = typeConfig[powerType] || typeConfig['informal'];
                    const hasDependencies = pc.dependencies && pc.dependencies.length > 0;
                    const itemId = `pow-${Math.random().toString(36).substr(2, 9)}`;
                    
                    return `
                        <div class="dynamics-item power-item expandable-item" data-item-id="${itemId}">
                            <div class="power-main-row">
                                <div class="power-person">
                                    ${renderPersonChip(pc.person, resolveName)}
                                </div>
                                <div class="power-details">
                                    <span class="type-badge" style="background: ${config.bg}; color: ${config.color};" title="${config.desc}">
                                        <span class="type-icon">${config.icon}</span>
                                        ${powerType}
                                    </span>
                                </div>
                                <div class="power-reach-container">
                                    <div class="strength-value power-value">${reachPct}%</div>
                                    <div class="strength-bar-mini power-bar">
                                        <div class="strength-fill-mini" style="width: ${reachPct}%; background: ${config.color};"></div>
                                    </div>
                                    <div class="strength-label">reach</div>
                                </div>
                                ${hasDependencies ? `<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>` : ''}
                            </div>
                            ${hasDependencies ? `
                                <div class="item-details">
                                    <div class="dependencies-list">
                                        <strong>Power Sources:</strong>
                                        <ul>${pc.dependencies.map((d: string) => `<li>${d}</li>`).join('')}</ul>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render network graph
 */
function renderNetworkGraph(container: Element, state: any): void {
    const { graphData, profiles } = state;

    console.log('[TeamAnalysis] renderNetworkGraph called, graphData:', graphData);

    if (!graphData || !graphData.nodes || !graphData.nodes.length) {
        console.log('[TeamAnalysis] No graph data, showing empty state');
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <circle cx="19" cy="5" r="2"/>
                    <circle cx="5" cy="19" r="2"/>
                    <line x1="14.5" y1="9.5" x2="17.5" y2="6.5"/>
                    <line x1="9.5" y1="14.5" x2="6.5" y2="17.5"/>
                </svg>
                <h3>No Network Data</h3>
                <p>Analyze profiles to build the team network graph.</p>
            </div>
        `;
        return;
    }

    // Build profile lookup for enriched node data
    const profileLookup: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
        const id = p.contact_id || p.person_id;
        if (id) profileLookup[id] = p;
    });
    
    console.log('[TeamAnalysis] Rendering network graph with', graphData.nodes.length, 'nodes and', graphData.edges?.length || 0, 'edges');

    container.innerHTML = `
        <div class="network-graph-wrapper">
            <div class="network-legend">
                <div class="legend-item">
                    <span class="legend-line legend-influences"></span>
                    <span>Influences</span>
                </div>
                <div class="legend-item">
                    <span class="legend-line legend-alliance"></span>
                    <span>Alliance</span>
                </div>
                <div class="legend-item">
                    <span class="legend-line legend-tension"></span>
                    <span>Tension</span>
                </div>
            </div>
            <div class="network-graph-container">
                <div id="team-network-graph" class="network-graph"></div>
            </div>
            <div class="network-info-panel" id="network-info-panel">
                <div class="info-panel-placeholder">
                    <p>Click on a person to see details</p>
                </div>
            </div>
        </div>
    `;

    // Initialize vis.js network with enhanced styling
    setTimeout(() => {
        initializeNetwork(graphData, profileLookup);
    }, 100);
}

/**
 * Generate initials from a name
 */
function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

/**
 * Generate a color based on a string (for consistent avatar colors)
 */
function stringToColor(str: string): string {
    const colors = ['#9b59b6', '#3498db', '#e74c3c', '#27ae60', '#f39c12', '#1abc9c', '#e67e22', '#34495e'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

/**
 * Create SVG data URL for avatar node
 */
function createAvatarSvg(name: string, avatarUrl?: string, role?: string, influenceScore?: number): string {
    const initials = getInitials(name);
    const bgColor = stringToColor(name);
    const size = 80;
    
    // If there's an avatar URL, we'll use circularImage shape instead
    if (avatarUrl) {
        return avatarUrl;
    }
    
    // Create SVG with initials
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <defs>
                <linearGradient id="grad-${initials}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${adjustColor(bgColor, -30)};stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#grad-${initials})" stroke="white" stroke-width="3"/>
            <text x="${size/2}" y="${size/2 + 8}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
        </svg>
    `;
    
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Adjust color brightness
 */
function adjustColor(color: string, amount: number): string {
    const clamp = (num: number) => Math.min(255, Math.max(0, num));
    const hex = color.replace('#', '');
    const r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
    const b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get edge color based on relationship type
 */
function getEdgeStyle(edgeType: string): { color: string; dashes: boolean; width: number } {
    switch (edgeType) {
        case 'influences':
            return { color: '#3498db', dashes: false, width: 2 };
        case 'aligned_with':
            return { color: '#27ae60', dashes: false, width: 3 };
        case 'tension_with':
            return { color: '#e74c3c', dashes: [5, 5] as any, width: 2 };
        default:
            return { color: '#95a5a6', dashes: false, width: 1 };
    }
}

/**
 * Initialize vis.js network visualization with avatars
 */
function initializeNetwork(graphData: { nodes: any[]; edges: any[] }, profileLookup: Record<string, any>): void {
    console.log('[TeamAnalysis] initializeNetwork called with', graphData.nodes?.length, 'nodes,', graphData.edges?.length, 'edges');
    
    const container = document.getElementById('team-network-graph');
    if (!container) {
        console.error('[TeamAnalysis] Network container not found!');
        return;
    }

    // Destroy existing network
    if (networkInstance) {
        console.log('[TeamAnalysis] Destroying existing network instance');
        networkInstance.destroy();
        networkInstance = null;
    }

    // Check if vis.js is available
    if (typeof vis === 'undefined') {
        console.error('[TeamAnalysis] vis.js library not loaded!');
        container.innerHTML = `
            <div class="team-analysis-empty-center">
                Network visualization library not loaded
            </div>
        `;
        return;
    }
    
    console.log('[TeamAnalysis] vis.js is available, creating network...');

    // Create enhanced nodes with avatars
    const nodes = new vis.DataSet(graphData.nodes.map(n => {
        const profile = profileLookup[n.id] || {};
        const contact = profile.contact || {};
        const name = n.label || contact.name || 'Unknown';
        const avatarUrl = contact.avatar_url || contact.photo_url;
        const role = contact.role || n.properties?.role || '';
        const influenceScore = profile.influence_score || n.properties?.influenceScore || 50;
        
        // Base size on influence score
        const nodeSize = 30 + (influenceScore / 10);
        
        return {
            id: n.id,
            label: name,
            shape: avatarUrl ? 'circularImage' : 'image',
            image: createAvatarSvg(name, avatarUrl, role, influenceScore),
            size: nodeSize,
            borderWidth: 3,
            borderWidthSelected: 5,
            color: {
                border: stringToColor(name),
                highlight: {
                    border: '#f39c12'
                },
                hover: {
                    border: '#f39c12'
                }
            },
            font: {
                size: 14,
                color: 'var(--color-text)',
                face: 'Arial',
                strokeWidth: 3,
                strokeColor: 'var(--color-surface)'
            },
            // Store extra data for click handler
            _profile: profile,
            _role: role,
            _influenceScore: influenceScore
        };
    }));

    // Create styled edges
    const edges = new vis.DataSet(graphData.edges.map(e => {
        const style = getEdgeStyle(e.label || e.relationship_type);
        return {
            from: e.from,
            to: e.to,
            label: '',
            width: style.width,
            dashes: style.dashes,
            color: {
                color: style.color,
                highlight: style.color,
                hover: style.color,
                opacity: 0.8
            },
            arrows: e.label === 'influences' ? { to: { enabled: true, scaleFactor: 0.8 } } : undefined,
            smooth: {
                type: 'curvedCW',
                roundness: 0.2
            },
            title: formatEdgeLabel(e.label)
        };
    }));

    const options = {
        nodes: {
            shapeProperties: {
                useBorderWithImage: true,
                interpolation: false
            },
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 10,
                x: 3,
                y: 3
            }
        },
        edges: {
            font: {
                size: 11,
                align: 'middle',
                color: 'var(--text-secondary)'
            },
            smooth: {
                type: 'curvedCW',
                roundness: 0.2
            },
            hoverWidth: 2,
            selectionWidth: 3
        },
        physics: {
            enabled: true,
            stabilization: {
                enabled: true,
                iterations: 200
            },
            barnesHut: {
                gravitationalConstant: -3000,
                springLength: 200,
                springConstant: 0.04,
                damping: 0.3
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 100,
            navigationButtons: true,
            keyboard: true,
            zoomView: true
        },
        layout: {
            improvedLayout: true
        }
    };

    networkInstance = new vis.Network(container, { nodes, edges }, options);
    
    // Handle node click to show details
    networkInstance.on('click', (params: any) => {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = nodes.get(nodeId);
            showNodeDetails(nodeData, profileLookup[nodeId]);
        } else {
            hideNodeDetails();
        }
    });
    
    // Handle hover for cursor change
    networkInstance.on('hoverNode', () => {
        container.classList.add('gm-cursor-pointer');
        container.classList.remove('gm-cursor-default');
    });
    networkInstance.on('blurNode', () => {
        container.classList.remove('gm-cursor-pointer');
        container.classList.add('gm-cursor-default');
    });
}

/**
 * Format edge label for tooltip
 */
function formatEdgeLabel(label: string): string {
    const labels: Record<string, string> = {
        'influences': '→ Influences',
        'aligned_with': '🤝 Alliance',
        'tension_with': '⚡ Tension'
    };
    return labels[label] || label;
}

/**
 * Show node details in side panel
 */
function showNodeDetails(nodeData: any, profile: any): void {
    const panel = document.getElementById('network-info-panel');
    if (!panel) return;
    
    const contact = profile?.contact || {};
    const name = nodeData.label || 'Unknown';
    const role = contact.role || nodeData._role || '';
    const org = contact.organization || '';
    const influenceScore = profile?.influence_score || nodeData._influenceScore || 0;
    const commStyle = profile?.communication_style || 'Unknown';
    const motivation = profile?.dominant_motivation || 'Unknown';
    const initials = getInitials(name);
    const avatarUrl = contact.avatar_url || contact.photo_url;
    
    panel.innerHTML = `
        <div class="node-detail-card">
            <div class="node-detail-header">
                ${avatarUrl 
                    ? `<img class="node-avatar" src="${avatarUrl}" alt="${name}" />`
                    : `<div class="node-avatar node-initials" style="background: ${stringToColor(name)}">${initials}</div>`
                }
                <div class="node-info">
                    <h3>${name}</h3>
                    ${role ? `<p class="node-role">${role}</p>` : ''}
                    ${org ? `<p class="node-org">${org}</p>` : ''}
                </div>
            </div>
            <div class="node-metrics">
                <div class="node-metric">
                    <span class="metric-label">Influence</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${influenceScore}%; background: #9b59b6;"></div>
                    </div>
                    <span class="metric-value">${influenceScore}%</span>
                </div>
            </div>
            <div class="node-traits">
                <div class="trait-item">
                    <span class="trait-label">Communication</span>
                    <span class="trait-value">${commStyle}</span>
                </div>
                <div class="trait-item">
                    <span class="trait-label">Motivation</span>
                    <span class="trait-value">${motivation}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Hide node details panel
 */
function hideNodeDetails(): void {
    const panel = document.getElementById('network-info-panel');
    if (!panel) return;
    
    panel.innerHTML = `
        <div class="info-panel-placeholder">
            <p>Click on a person to see details</p>
        </div>
    `;
}

/**
 * Load people available for analysis (when no profiles exist yet)
 */
async function loadPeopleForAnalysis(container: Element): Promise<void> {
    const listContainer = container.querySelector('#people-list-container');
    if (!listContainer) return;

    try {
        // Fetch people from contacts/people endpoint
        const response = await http.get<{ contacts?: any[]; people?: any[] }>('/api/contacts');
        const people = response.data?.contacts || response.data?.people || [];
        
        if (people.length === 0) {
            listContainer.innerHTML = `
                <p class="team-analysis-people-loading">
                    No people found. Process some transcripts first to extract participants.
                </p>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div class="gm-text-left">
                <p class="team-analysis-intro-p">
                    Select a person to analyze (${people.length} available):
                </p>
                <div class="team-analysis-people-list">
                    ${people.slice(0, 20).map((p: any) => `
                        <button type="button" class="btn btn-secondary analyze-person-btn team-analysis-person-row"
                                data-person-id="${p.id}"
                                data-person-name="${p.name || 'Unknown'}">
                            <span class="team-analysis-person-name">${p.name || 'Unknown'}</span>
                            <span class="team-analysis-person-role">${p.role || p.organization || ''}</span>
                        </button>
                    `).join('')}
                </div>
                ${people.length > 20 ? `<p class="team-analysis-people-truncate">Showing first 20 of ${people.length} people</p>` : ''}
            </div>
        `;

        // Add click handlers
        listContainer.querySelectorAll('.analyze-person-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const personId = (btn as HTMLElement).dataset.personId;
                const personName = (btn as HTMLElement).dataset.personName;
                if (personId) {
                    toast.info(`Analyzing ${personName}...`);
                    (btn as HTMLButtonElement).disabled = true;
                    (btn as HTMLButtonElement).innerHTML = '<span>Analyzing...</span>';
                    
                    try {
                        await teamAnalysisStore.analyzeProfile(personId, { forceReanalysis: true });
                        toast.success(`Profile created for ${personName}`);
                        // Reload profiles
                        await teamAnalysisStore.loadProfiles();
                    } catch (error: any) {
                        toast.error(`Failed to analyze: ${error.message || 'Unknown error'}`);
                        (btn as HTMLButtonElement).disabled = false;
                        (btn as HTMLButtonElement).innerHTML = `<span class="team-analysis-btn-person-name">${personName}</span>`;
                    }
                }
            });
        });
    } catch (error) {
        listContainer.innerHTML = `
            <p class="team-analysis-graph-error">
                Failed to load people. Please try again.
            </p>
        `;
    }
}

// Export
export default createTeamAnalysis;
