import{c as T,q as u,t as h,h as S}from"./main-DsXjfhBM.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let b=null;function he(){const t=T("div",{className:"team-analysis-panel"});return t.innerHTML=`
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
    `,setTimeout(()=>{A(t)},0),t}async function A(t){u.subscribe(e=>{j(t,e)}),await u.loadAll(),I()}function I(t){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.addEventListener("click",s=>{const a=s.target.dataset.subtab;a&&E(a)})}),document.getElementById("team-analysis-refresh-btn")?.addEventListener("click",async()=>{await u.loadAll(),h.success("Data refreshed")}),document.getElementById("team-analysis-analyze-btn")?.addEventListener("click",async()=>{u.getState().currentSubtab==="profiles"?await P():(h.info("Analyzing team dynamics..."),await u.analyzeTeam(!0),h.success("Team analysis complete"))})}async function P(){const t=document.createElement("div");t.className="modal-overlay",t.innerHTML=`
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
    `,document.body.appendChild(t);const e=()=>t.remove();t.querySelector(".modal-close")?.addEventListener("click",e),t.querySelector("#modal-cancel-btn")?.addEventListener("click",e),t.addEventListener("click",s=>{s.target===t&&e()});try{const s=await S.get("/api/contacts"),a=s.data?.contacts||s.data?.people||[],n=u.getState(),o=new Set(n.profiles.map(l=>l.contact_id||l.person_id)),i=t.querySelector("#contacts-list-loading"),r=t.querySelector("#contacts-list");if(i&&i.classList.add("hidden"),r&&r.classList.remove("hidden"),a.length===0){r.innerHTML=`
                <div class="team-analysis-contacts-empty">
                    <p>No contacts found. Add contacts to the project first.</p>
                </div>
            `;return}a.sort((l,p)=>{const d=o.has(l.id),m=o.has(p.id);return d!==m?d?1:-1:(l.name||"").localeCompare(p.name||"")}),r.innerHTML=`
            <div class="team-analysis-contacts-bar">
                <span class="team-analysis-contacts-bar-text">
                    ${a.length} contacts • ${o.size} analyzed
                </span>
                <button type="button" class="btn btn-sm btn-secondary team-analysis-select-unanalyzed-btn" id="select-unanalyzed-btn">
                    Select Unanalyzed
                </button>
            </div>
            <div class="team-analysis-contacts-list">
                ${a.map(l=>{const p=o.has(l.id),d=(l.name||"U").split(" ").map(m=>m[0]).join("").substring(0,2).toUpperCase();return`
                        <label class="contact-item team-analysis-contact-item" data-contact-id="${l.id}">
                            <input type="checkbox" class="contact-checkbox team-analysis-contact-checkbox" data-id="${l.id}" data-name="${l.name||"Unknown"}">
                            ${l.avatar_url||l.photo_url?`<img src="${l.avatar_url||l.photo_url}" alt="${l.name}" class="team-analysis-contact-avatar">`:`<div class="team-analysis-contact-avatar-initials">${d}</div>`}
                            <div class="team-analysis-contact-info">
                                <div class="team-analysis-contact-name">${l.name||"Unknown"}</div>
                                <div class="team-analysis-contact-role">${l.role||l.organization||"No role"}</div>
                            </div>
                            <span class="team-analysis-contact-badge ${p?"team-analysis-contact-badge-analyzed":"team-analysis-contact-badge-not-analyzed"}">${p?"Analyzed":"Not analyzed"}</span>
                        </label>
                    `}).join("")}
            </div>
        `;const c=new Set,v=()=>{const l=t.querySelector("#modal-analyze-selected-btn");l&&(l.disabled=c.size===0,l.textContent=`Analyze Selected (${c.size})`)};r.querySelectorAll(".contact-checkbox").forEach(l=>{l.addEventListener("change",p=>{const d=p.target,m=d.dataset.id,g=d.closest(".contact-item");m&&(d.checked?(c.add(m),g&&g.classList.add("selected")):(c.delete(m),g&&g.classList.remove("selected")),v())})}),t.querySelector("#select-unanalyzed-btn")?.addEventListener("click",()=>{r.querySelectorAll(".contact-checkbox").forEach(l=>{const p=l,d=p.dataset.id,m=p.closest(".contact-item");d&&!o.has(d)&&(p.checked=!0,c.add(d),m&&m.classList.add("selected"))}),v()}),t.querySelector("#modal-analyze-selected-btn")?.addEventListener("click",async()=>{if(c.size===0)return;const l=t.querySelector("#modal-analyze-selected-btn"),p=l.textContent;l.disabled=!0,l.textContent="Analyzing...";let d=0,m=0;for(const g of c){const k=r.querySelector(`.contact-checkbox[data-id="${g}"]`),$=k?.dataset.name||"Contact";try{l.textContent=`Analyzing ${$}...`,await u.analyzeProfile(g,{forceReanalysis:!0}),d++;const y=k?.closest(".contact-item")?.querySelector(".team-analysis-contact-badge");y&&(y.classList.remove("team-analysis-contact-badge-not-analyzed"),y.classList.add("team-analysis-contact-badge-analyzed"),y.textContent="Analyzed")}catch(w){console.error(`Failed to analyze ${$}:`,w),m++}}await u.loadProfiles(),d>0&&h.success(`Successfully analyzed ${d} team member${d>1?"s":""}`),m>0&&h.error(`Failed to analyze ${m} contact${m>1?"s":""}`),e()})}catch{const a=t.querySelector("#contacts-list-loading");a&&(a.innerHTML=`
                <p class="team-analysis-error-text">Failed to load contacts. Please try again.</p>
            `)}}async function E(t){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.classList.toggle("active",e.getAttribute("data-subtab")===t)}),t==="graph"&&(console.log("[TeamAnalysis] Loading graph data before switching tab..."),await u.loadGraphData()),u.setSubtab(t)}function j(t,e){const s=t.querySelector("#team-analysis-content");if(!s)return;if(e.loading){s.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Loading team analysis...</p>
            </div>
        `;return}if(e.analyzing){s.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Analyzing... This may take a moment.</p>
            </div>
        `;return}const a=e.currentSubtab||"profiles";switch(console.log("[TeamAnalysis] renderContent - currentSubtab:",a),a){case"profiles":B(s,e);break;case"team":O(s,e);break;case"graph":ne(s,e);break}}function B(t,e){const{profiles:s,selectedProfile:a}=e;if(a){U(t,a);return}if(s.length===0){t.innerHTML=`
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
        `,ve(t);return}t.innerHTML=`
        <div class="profiles-grid">
            ${s.map(n=>q(n)).join("")}
        </div>
    `,t.querySelectorAll(".profile-card").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.personId;o&&u.loadProfile(o)})}),t.querySelectorAll(".analyze-btn").forEach(n=>{n.addEventListener("click",async o=>{o.stopPropagation();const i=n.dataset.personId;i&&(h.info("Analyzing profile..."),await u.analyzeProfile(i,{forceReanalysis:!0}),h.success("Profile analysis complete"))})})}function q(t){const e=t.contact||{},s=e.name||"Unknown",a=s.split(" ").map(c=>c[0]).join("").substring(0,2).toUpperCase(),n=e.role||e.organization||"No role",o=t.confidence_level||"low",i=e.avatar_url||e.photo_url,r=t.contact_id||t.person_id;return`
        <div class="profile-card" data-person-id="${r}">
            <div class="profile-header">
                ${i?`<img class="profile-avatar" src="${i}" alt="${s}" />`:`<div class="profile-avatar">${a}</div>`}
                <div class="profile-info">
                    <h3>${s}</h3>
                    <div class="role">${n}</div>
                    <div class="profile-badges">
                        <span class="badge badge-confidence ${o}">${o.replace("_"," ")}</span>
                    </div>
                </div>
            </div>
            <div class="profile-metrics">
                <div class="metric">
                    <div class="metric-value">${t.influence_score||0}</div>
                    <div class="metric-label">Influence</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${t.transcript_count||0}</div>
                    <div class="metric-label">Transcripts</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${t.risk_tolerance||"-"}</div>
                    <div class="metric-label">Risk</div>
                </div>
            </div>
            ${t.communication_style?`
                <div class="profile-style">
                    <div class="profile-style-label">Communication Style</div>
                    <div class="profile-style-value">${t.communication_style}</div>
                </div>
            `:""}
            <button type="button" class="btn btn-secondary analyze-btn team-analysis-analyze-btn-full" data-person-id="${r}">
                Re-analyze
            </button>
        </div>
    `}function U(t,e){const a=(e.contact||{}).name||"Unknown",n=e.profile_data||{};t.innerHTML=`
        <div class="profile-detail">
            <div class="profile-detail-header">
                <div class="profile-detail-back" id="back-to-profiles">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to Profiles
                </div>
                <h2>${a}</h2>
            </div>

            <div class="profile-sections">
                ${N(n)}
                ${H(n)}
                ${D(n)}
                ${W(n)}
                ${R(n)}
                ${V(n)}
                ${G(n)}
                ${F(n)}
            </div>
        </div>
    `,t.querySelector("#back-to-profiles")?.addEventListener("click",()=>{u.setSelectedProfile(null)})}function N(t){const e=t.communication_identity;return e?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Communication Identity
            </h4>
            <div class="team-analysis-comm-grid">
                ${e.dominant_style?`<div><strong>Style:</strong> ${e.dominant_style}</div>`:""}
                ${e.intervention_rhythm?`<div><strong>Rhythm:</strong> ${e.intervention_rhythm}</div>`:""}
                ${e.textual_body_language?`<div><strong>Textual Cues:</strong> ${e.textual_body_language}</div>`:""}
            </div>
            ${Y(e.evidence)}
        </div>
    `:""}function H(t){const e=t.motivations_and_priorities;return e?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Motivations & Priorities
            </h4>
            ${e.values_most?.length?`<div><strong>Values most:</strong> ${e.values_most.join(", ")}</div>`:""}
            ${e.avoids?.length?`<div class="team-analysis-mot-avoids"><strong>Avoids:</strong> ${e.avoids.join(", ")}</div>`:""}
            <div class="team-analysis-mot-confidence">
                Confidence: ${e.confidence||"Not specified"}
            </div>
        </div>
    `:""}function D(t){const e=t.behavior_under_pressure;return e?.length?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Behavior Under Pressure
            </h4>
            <div class="evidence-list">
                ${e.map(s=>`
                    <div class="evidence-item">
                        <strong>${s.situation}</strong>
                        <p class="team-analysis-evidence-p">${s.observed_behavior}</p>
                        ${s.quote?`<div class="evidence-quote">"${s.quote}"</div>`:""}
                        ${s.timestamp?`<div class="evidence-timestamp">${s.timestamp}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function W(t){const e=t.influence_tactics;return e?.length?`
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
                ${e.map(s=>`
                    <div class="evidence-item">
                        <strong>${s.objective}</strong>
                        <p class="team-analysis-evidence-p">${s.tactic}</p>
                        ${s.example?`<div class="evidence-quote">${s.example}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function R(t){const e=t.vulnerabilities;if(!e)return"";const s=[];return e.defense_triggers?.length&&s.push(`
            <div class="team-analysis-vuln-block">
                <strong class="team-analysis-vuln-title-defense">Defense Triggers</strong>
                <ul class="team-analysis-vuln-ul">
                    ${e.defense_triggers.map(a=>`<li>${a.trigger}</li>`).join("")}
                </ul>
            </div>
        `),e.blind_spots?.length&&s.push(`
            <div class="team-analysis-vuln-block">
                <strong class="team-analysis-vuln-title-blind">Blind Spots</strong>
                <ul class="team-analysis-vuln-ul">
                    ${e.blind_spots.map(a=>`<li>${a.description}</li>`).join("")}
                </ul>
            </div>
        `),s.length===0?"":`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Vulnerabilities & Friction Points
            </h4>
            ${s.join("")}
        </div>
    `}function V(t){const e=t.interaction_strategy;return e?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Recommended Interaction Strategy
            </h4>
            ${e.ideal_format?`
                <div class="team-analysis-strat-block">
                    <strong>Ideal Format</strong>
                    <div class="team-analysis-strat-meta">
                        ${e.ideal_format.channel?`Channel: ${e.ideal_format.channel}`:""}
                        ${e.ideal_format.structure?` | Structure: ${e.ideal_format.structure}`:""}
                        ${e.ideal_format.timing?` | Timing: ${e.ideal_format.timing}`:""}
                    </div>
                </div>
            `:""}
            ${e.framing_that_works?.length?`
                <div class="team-analysis-strat-block">
                    <strong class="team-analysis-strat-title-works">What Works</strong>
                    <ul class="team-analysis-vuln-ul">
                        ${e.framing_that_works.map(s=>`<li>${s}</li>`).join("")}
                    </ul>
                </div>
            `:""}
            ${e.what_to_avoid?.length?`
                <div class="team-analysis-strat-block">
                    <strong class="team-analysis-strat-title-avoid">What to Avoid</strong>
                    <ul class="team-analysis-vuln-ul">
                        ${e.what_to_avoid.map(s=>`<li>${s}</li>`).join("")}
                    </ul>
                </div>
            `:""}
        </div>
    `:""}function G(t){const e=t.early_warning_signs;return e?.length?`
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
                ${e.map(s=>`
                    <div class="evidence-item">
                        <strong>${s.signal}</strong>
                        <p class="team-analysis-warning-p">Indicates: ${s.indicates}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function F(t){const e=t.power_analysis;return e?.length?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Power & Dependency Analysis
            </h4>
            <div class="evidence-list">
                ${e.map(s=>`
                    <div class="evidence-item">
                        <strong>${s.factor}</strong>
<p class="team-analysis-warning-p">${s.assessment}</p>
                    ${s.strategic_implication?`<p class="team-analysis-strategic-p">→ ${s.strategic_implication}</p>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function Y(t){return t?.length?`
        <div class="evidence-list">
            ${t.map(e=>`
                <div class="evidence-item">
                    ${e.quote?`<div class="evidence-quote">"${e.quote}"</div>`:""}
                    ${e.observation?`<p class="team-analysis-observation-p">${e.observation}</p>`:""}
                    ${e.timestamp?`<div class="evidence-timestamp">${e.timestamp}</div>`:""}
                </div>
            `).join("")}
        </div>
    `:""}function K(t){const e={};return t.forEach((s,a)=>{const n=s.contact||{},o=n.name||"Unknown",i=o.split(" ").map(v=>v[0]).join("").substring(0,2).toUpperCase(),r={name:o,initials:i,role:n.role||n.organization||"",avatarUrl:n.avatar_url||n.photo_url};e[`person_${a+1}`]=r,e[`person ${a+1}`]=r,e[`Person_${a+1}`]=r,e[`Person ${a+1}`]=r,e[o.toLowerCase()]=r;const c=o.split(" ")[0];c&&(e[c.toLowerCase()]=r)}),s=>{if(!s)return{name:"Unknown",initials:"?",role:""};const a=s.toLowerCase().trim();return e[a]||{name:s.replace(/_/g," "),initials:s.substring(0,2).toUpperCase(),role:""}}}function f(t,e){const s=e(t);return`
        <div class="person-chip">
            ${s.avatarUrl?`<img class="person-chip-avatar" src="${s.avatarUrl}" alt="${s.name}" />`:`<div class="person-chip-avatar person-chip-initials">${s.initials}</div>`}
            <span class="person-chip-name">${s.name}</span>
        </div>
    `}function O(t,e){const{teamAnalysis:s,profiles:a}=e;if(console.log("[TeamAnalysis] renderTeamDynamics called, teamAnalysis:",s),!s){console.log("[TeamAnalysis] No teamAnalysis data, showing empty state"),t.innerHTML=`
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
        `;return}const n=K(a||[]);console.log("[TeamAnalysis] Rendering team dynamics with data:",{cohesion:s.cohesion_score,tension:s.tension_level,teamSize:s.team_size,influenceMapLength:s.influence_map?.length});const o=`tension-${s.tension_level||"low"}`,i=s.cohesion_score>=70?"#27ae60":s.cohesion_score>=40?"#f39c12":"#e74c3c",r=s.analysis_data||{},c=r.analysis_date||s.last_analysis_at,v=r.recommendations||[],l=r.risk_factors||[],p=r.communication_flow||{},d=r.dominant_communication_pattern||"";t.innerHTML=`
        <div class="team-dynamics-header">
            <div class="cohesion-card">
                <div class="cohesion-score-circle" style="--score-color: ${i}">
                    <span class="score-value">${s.cohesion_score||0}</span>
                    <span class="score-label">Cohesion</span>
                </div>
                <div class="cohesion-details">
                    <h3>Team Cohesion Score</h3>
                    <span class="tension-badge ${o}">
                        ${s.tension_level||"unknown"} tension
                    </span>
                </div>
            </div>
            <div class="team-size-card">
                <div class="team-size-value">${s.team_size||0}</div>
                <div class="team-size-label">Team Members</div>
            </div>
            <div class="analysis-meta-card">
                <div class="meta-icon">📊</div>
                <div class="meta-details">
                    <span class="meta-label">Analysis Date</span>
                    <span class="meta-value">${c?new Date(c).toLocaleDateString():"N/A"}</span>
                </div>
            </div>
        </div>

        ${d?`
            <div class="executive-summary-section">
                <div class="summary-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <h3>Executive Summary</h3>
                </div>
                <p class="summary-text">${x(d,n)}</p>
            </div>
        `:""}

        ${J(a||[])}

        ${Q(p,n)}

        <div class="team-dynamics-grid">
            ${ee(s.influence_map||[],n)}
            ${te(s.alliances||[],n)}
            ${se(s.tensions||[],n)}
            ${ae(r.power_centers||[],n)}
        </div>

        ${X(l)}
        ${Z(v,n)}
    `}function J(t,e){if(!t?.length)return"";const s=[...t].filter(o=>o.influence_score!==void 0).sort((o,i)=>(i.influence_score||0)-(o.influence_score||0));if(s.length===0)return"";const a=Math.max(...s.map(o=>o.influence_score||0),100),n=["🥇","🥈","🥉"];return`
        <div class="influence-scoreboard-section">
            <div class="scoreboard-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3>Influence Scoreboard</h3>
                <span class="section-badge team-analysis-section-badge-amber">
                    ${s.length} members ranked
                </span>
            </div>
            <div class="scoreboard-list">
                ${s.map((o,i)=>{const r=o.contact||{},c=r.name||o.person_name||"Unknown",v=r.role||r.organization||"",l=r.avatar_url||r.photo_url,p=c.split(" ").map(M=>M[0]).join("").substring(0,2).toUpperCase(),d=o.influence_score||0,m=d/a*100,g=i+1,k=n[i]||"",$=i<3,w=o.risk_tolerance||o.risk_level||"medium",y={low:"#10b981",medium:"#f59e0b",high:"#ef4444"},L=y[w]||y.medium,z=(o.communication_style||o.profile_data?.communication_identity?.dominant_style||"").split(";")[0]?.substring(0,50)||"";return`
                        <div class="scoreboard-item ${$?"top-three":""}">
                            <div class="rank-badge ${$?"rank-"+g:""}">
                                ${k||g}
                            </div>
                            <div class="scoreboard-avatar">
                                ${l?`<img src="${l}" alt="${c}">`:`<span class="avatar-initials">${p}</span>`}
                            </div>
                            <div class="scoreboard-info">
                                <div class="scoreboard-name">${c}</div>
                                <div class="scoreboard-role">${v}</div>
                                ${z?`<div class="scoreboard-style">${z}</div>`:""}
                            </div>
                            <div class="scoreboard-metrics">
                                <div class="influence-meter">
                                    <div class="meter-label">Influence</div>
                                    <div class="meter-bar">
                                        <div class="meter-fill" style="width: ${m}%;"></div>
                                    </div>
                                    <div class="meter-value">${d}</div>
                                </div>
                                <div class="risk-indicator" style="--risk-color: ${L};">
                                    <span class="risk-dot"></span>
                                    <span class="risk-text">${w} risk</span>
                                </div>
                            </div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function Q(t,e){return!t||!t.bottlenecks?.length&&!t.information_brokers?.length?"":`
        <div class="communication-flow-section">
            <div class="flow-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <h3>Communication Flow</h3>
            </div>
            <div class="flow-cards">
                ${t.bottlenecks?.length?`
                    <div class="flow-card bottleneck-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🚧</span>
                            <h4>Bottlenecks</h4>
                        </div>
                        <ul class="flow-list">
                            ${t.bottlenecks.map(s=>`<li>${x(s,e)}</li>`).join("")}
                        </ul>
                    </div>
                `:""}
                ${t.information_brokers?.length?`
                    <div class="flow-card broker-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🔗</span>
                            <h4>Information Brokers</h4>
                        </div>
                        <div class="broker-chips">
                            ${t.information_brokers.map(s=>f(s,e)).join("")}
                        </div>
                        <p class="flow-hint">Key connectors who bridge information across the team</p>
                    </div>
                `:""}
                ${t.central_nodes?.length?`
                    <div class="flow-card central-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">⭐</span>
                            <h4>Central Nodes</h4>
                        </div>
                        <div class="broker-chips">
                            ${t.central_nodes.map(s=>f(s,e)).join("")}
                        </div>
                        <p class="flow-hint">Most connected team members</p>
                    </div>
                `:""}
                ${t.isolated_members?.length?`
                    <div class="flow-card isolated-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🏝️</span>
                            <h4>Isolated Members</h4>
                        </div>
                        <div class="broker-chips">
                            ${t.isolated_members.map(s=>f(s,e)).join("")}
                        </div>
                        <p class="flow-hint">Members with fewer connections - may need inclusion</p>
                    </div>
                `:""}
            </div>
        </div>
    `}function x(t,e){return t.replace(/Person_(\d+)/g,s=>e(s).name||s)}function X(t){return t?.length?`
        <div class="risk-factors-section">
            <div class="section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Risk Factors</h3>
                <span class="section-badge risk-badge">${t.length} identified</span>
            </div>
            <div class="risk-list">
                ${t.map((e,s)=>`
                    <div class="risk-item">
                        <span class="risk-number">${s+1}</span>
                        <p>${e}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function Z(t,e){return t?.length?`
        <div class="recommendations-section">
            <div class="section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <h3>Recommendations</h3>
                <span class="section-badge rec-badge">${t.length} actions</span>
            </div>
            <div class="recommendations-list">
                ${t.map((s,a)=>`
                    <div class="recommendation-item">
                        <div class="rec-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                            </svg>
                        </div>
                        <div class="rec-content">
                            <span class="rec-number">Action ${a+1}</span>
                            <p>${x(s,e)}</p>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function ee(t,e){if(!t.length)return"";const s={direct:{color:"#3b82f6",bg:"#eff6ff",icon:"→",desc:"Direct influence through communication and decisions"},technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Influence through technical expertise and knowledge"},political:{color:"#f59e0b",bg:"#fffbeb",icon:"♟",desc:"Influence through organizational dynamics and alliances"},social:{color:"#10b981",bg:"#ecfdf5",icon:"🤝",desc:"Influence through relationships and social capital"},resource:{color:"#ef4444",bg:"#fef2f2",icon:"📊",desc:"Influence through control of resources"}};return`
        <div class="dynamics-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>Influence Map</h3>
                <span class="dynamics-count">${t.length} connections</span>
            </div>
            <div class="dynamics-list">
                ${t.slice(0,10).map(a=>{const n=Math.round((a.strength||.5)*100),o=n>=70?"Strong":n>=40?"Moderate":"Weak",i=(a.influence_type||"direct").toLowerCase(),r=s[i]||s.direct,c=a.evidence&&a.evidence.length>10;return`
                        <div class="dynamics-item influence-item expandable-item" data-item-id="${`inf-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="influence-main-row">
                                <div class="influence-flow">
                                    ${f(a.from_person,e)}
                                    <div class="influence-arrow">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                            <polyline points="12 5 19 12 12 19"/>
                                        </svg>
                                    </div>
                                    ${f(a.to_person,e)}
                                </div>
                                <div class="influence-meta">
                                    <span class="type-badge" style="background: ${r.bg}; color: ${r.color};" title="${r.desc}">
                                        <span class="type-icon">${r.icon}</span>
                                        ${i}
                                    </span>
                                </div>
                                <div class="influence-strength-container">
                                    <div class="strength-value">${n}%</div>
                                    <div class="strength-bar-mini">
                                        <div class="strength-fill-mini" style="width: ${n}%; background: ${r.color};"></div>
                                    </div>
                                    <div class="strength-label">${o}</div>
                                </div>
                                ${c?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${c?`
                                <div class="item-details">
                                    <div class="evidence-text">
                                        <strong>Evidence:</strong> ${x(a.evidence,e)}
                                    </div>
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function te(t,e){if(!t.length)return"";const s={natural:{color:"#10b981",bg:"#ecfdf5",icon:"🌱",desc:"Organic alliance based on shared values and goals"},circumstantial:{color:"#6366f1",bg:"#eef2ff",icon:"🔗",desc:"Alliance formed due to shared circumstances or challenges"},strategic:{color:"#f59e0b",bg:"#fffbeb",icon:"♟",desc:"Deliberate alliance for mutual benefit"},historical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"📜",desc:"Long-standing alliance based on history"}};return`
        <div class="dynamics-card alliance-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Alliances</h3>
                <span class="dynamics-count">${t.length} groups</span>
            </div>
            <div class="dynamics-list">
                ${t.map(a=>{let n=a.members||[];typeof n=="string"&&(n=n.split(/[\s,]+/).filter(d=>d.trim()));const o=Math.round((a.strength||.5)*100),i=o>=70?"Strong bond":o>=40?"Moderate bond":"Weak bond",r=(a.alliance_type||"natural").toLowerCase(),c=s[r]||s.natural,v=a.evidence&&a.evidence.length>10,l=a.shared_values&&a.shared_values.length>0;return`
                        <div class="dynamics-item alliance-item expandable-item" data-item-id="${`all-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="alliance-main-row">
                                <div class="alliance-members">
                                    ${n.map(d=>f(d,e)).join('<span class="alliance-connector">&</span>')}
                                </div>
                                <div class="alliance-meta">
                                    <span class="type-badge" style="background: ${c.bg}; color: ${c.color};" title="${c.desc}">
                                        <span class="type-icon">${c.icon}</span>
                                        ${r}
                                    </span>
                                </div>
                                <div class="alliance-strength-container">
                                    <div class="strength-value alliance-value">${o}%</div>
                                    <div class="strength-bar-mini alliance-bar">
                                        <div class="strength-fill-mini" style="width: ${o}%; background: ${c.color};"></div>
                                    </div>
                                    <div class="strength-label">${i}</div>
                                </div>
                                ${v||l?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${v||l?`
                                <div class="item-details">
                                    ${l?`
                                        <div class="shared-values">
                                            <strong>Shared Values:</strong>
                                            <ul>${a.shared_values.map(d=>`<li>${d}</li>`).join("")}</ul>
                                        </div>
                                    `:""}
                                    ${v?`
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${x(a.evidence,e)}
                                        </div>
                                    `:""}
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function se(t,e){if(!t.length)return"";const s={technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Disagreements about technical approaches or solutions"},resource:{color:"#f59e0b",bg:"#fffbeb",icon:"📊",desc:"Competition for resources, time, or attention"},political:{color:"#ef4444",bg:"#fef2f2",icon:"♟",desc:"Power dynamics and organizational influence conflicts"},communication:{color:"#3b82f6",bg:"#eff6ff",icon:"💬",desc:"Misunderstandings or communication style clashes"},values:{color:"#10b981",bg:"#ecfdf5",icon:"⚖",desc:"Differences in core values or priorities"}},a={high:{color:"#dc2626",bg:"#fef2f2"},medium:{color:"#f59e0b",bg:"#fffbeb"},low:{color:"#10b981",bg:"#ecfdf5"}};return`
        <div class="dynamics-card tension-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Tensions</h3>
                <span class="dynamics-count">${t.length} identified</span>
            </div>
            <div class="dynamics-list">
                ${t.map(n=>{let o=n.between||[];typeof o=="string"&&(o=o.split(/[\s,]+/).filter(g=>g.trim()));const i=(n.level||"low").toLowerCase(),r=`tension-level-${i}`,c=a[i]||a.low,v=(n.tension_type||"communication").toLowerCase(),l=s[v]||s.communication,p=n.evidence&&n.evidence.length>10,d=n.triggers&&n.triggers.length>0,m=`ten-${Math.random().toString(36).substr(2,9)}`;return`
                        <div class="dynamics-item tension-item expandable-item ${r}" data-item-id="${m}">
                            <div class="tension-main-row">
                                <div class="tension-parties">
                                    ${o.slice(0,2).map(g=>f(g,e)).join('<span class="tension-vs">↔</span>')}
                                </div>
                                <div class="tension-meta">
                                    <span class="type-badge" style="background: ${l.bg}; color: ${l.color};" title="${l.desc}">
                                        <span class="type-icon">${l.icon}</span>
                                        ${v}
                                    </span>
                                </div>
                                <span class="tension-badge" style="background: ${c.bg}; color: ${c.color};">${i}</span>
                                ${p||d?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${p||d?`
                                <div class="item-details">
                                    ${d?`
                                        <div class="triggers-list">
                                            <strong>Triggers:</strong>
                                            <ul>${n.triggers.map(g=>`<li>${g}</li>`).join("")}</ul>
                                        </div>
                                    `:""}
                                    ${p?`
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${x(n.evidence,e)}
                                        </div>
                                    `:""}
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function ae(t,e){if(!t.length)return"";const s={technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Power through technical expertise and knowledge"},formal:{color:"#3b82f6",bg:"#eff6ff",icon:"👔",desc:"Power through official role and authority"},informal:{color:"#f59e0b",bg:"#fffbeb",icon:"💬",desc:"Power through relationships and influence"},social:{color:"#10b981",bg:"#ecfdf5",icon:"🤝",desc:"Power through social connections and trust"},resource:{color:"#ef4444",bg:"#fef2f2",icon:"📊",desc:"Power through control of resources"}};return`
        <div class="dynamics-card power-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <h3>Power Centers</h3>
                <span class="dynamics-count">${t.length} key players</span>
            </div>
            <div class="dynamics-list">
                ${t.map(a=>{const n=Math.round(a.influence_reach||50),o=(a.power_type||"informal").toLowerCase(),i=s[o]||s.informal,r=a.dependencies&&a.dependencies.length>0;return`
                        <div class="dynamics-item power-item expandable-item" data-item-id="${`pow-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="power-main-row">
                                <div class="power-person">
                                    ${f(a.person,e)}
                                </div>
                                <div class="power-details">
                                    <span class="type-badge" style="background: ${i.bg}; color: ${i.color};" title="${i.desc}">
                                        <span class="type-icon">${i.icon}</span>
                                        ${o}
                                    </span>
                                </div>
                                <div class="power-reach-container">
                                    <div class="strength-value power-value">${n}%</div>
                                    <div class="strength-bar-mini power-bar">
                                        <div class="strength-fill-mini" style="width: ${n}%; background: ${i.color};"></div>
                                    </div>
                                    <div class="strength-label">reach</div>
                                </div>
                                ${r?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${r?`
                                <div class="item-details">
                                    <div class="dependencies-list">
                                        <strong>Power Sources:</strong>
                                        <ul>${a.dependencies.map(v=>`<li>${v}</li>`).join("")}</ul>
                                    </div>
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function ne(t,e){const{graphData:s,profiles:a}=e;if(console.log("[TeamAnalysis] renderNetworkGraph called, graphData:",s),!s||!s.nodes||!s.nodes.length){console.log("[TeamAnalysis] No graph data, showing empty state"),t.innerHTML=`
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
        `;return}const n={};(a||[]).forEach(o=>{const i=o.contact_id||o.person_id;i&&(n[i]=o)}),console.log("[TeamAnalysis] Rendering network graph with",s.nodes.length,"nodes and",s.edges?.length||0,"edges"),t.innerHTML=`
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
    `,setTimeout(()=>{le(s,n)},100)}function C(t){return t.split(" ").map(e=>e[0]).join("").substring(0,2).toUpperCase()}function _(t){const e=["#9b59b6","#3498db","#e74c3c","#27ae60","#f39c12","#1abc9c","#e67e22","#34495e"];let s=0;for(let a=0;a<t.length;a++)s=t.charCodeAt(a)+((s<<5)-s);return e[Math.abs(s)%e.length]}function ie(t,e,s,a){const n=C(t),o=_(t),i=80;if(e)return e;const r=`
        <svg xmlns="http://www.w3.org/2000/svg" width="${i}" height="${i}" viewBox="0 0 ${i} ${i}">
            <defs>
                <linearGradient id="grad-${n}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${o};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${oe(o,-30)};stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="${i/2}" cy="${i/2}" r="${i/2-2}" fill="url(#grad-${n})" stroke="white" stroke-width="3"/>
            <text x="${i/2}" y="${i/2+8}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${n}</text>
        </svg>
    `;return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(r)}function oe(t,e){const s=r=>Math.min(255,Math.max(0,r)),a=t.replace("#",""),n=s(parseInt(a.substring(0,2),16)+e),o=s(parseInt(a.substring(2,4),16)+e),i=s(parseInt(a.substring(4,6),16)+e);return`#${n.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}${i.toString(16).padStart(2,"0")}`}function re(t){switch(t){case"influences":return{color:"#3498db",dashes:!1,width:2};case"aligned_with":return{color:"#27ae60",dashes:!1,width:3};case"tension_with":return{color:"#e74c3c",dashes:[5,5],width:2};default:return{color:"#95a5a6",dashes:!1,width:1}}}function le(t,e){console.log("[TeamAnalysis] initializeNetwork called with",t.nodes?.length,"nodes,",t.edges?.length,"edges");const s=document.getElementById("team-network-graph");if(!s){console.error("[TeamAnalysis] Network container not found!");return}if(b&&(console.log("[TeamAnalysis] Destroying existing network instance"),b.destroy(),b=null),typeof vis>"u"){console.error("[TeamAnalysis] vis.js library not loaded!"),s.innerHTML=`
            <div class="team-analysis-empty-center">
                Network visualization library not loaded
            </div>
        `;return}console.log("[TeamAnalysis] vis.js is available, creating network...");const a=new vis.DataSet(t.nodes.map(i=>{const r=e[i.id]||{},c=r.contact||{},v=i.label||c.name||"Unknown",l=c.avatar_url||c.photo_url,p=c.role||i.properties?.role||"",d=r.influence_score||i.properties?.influenceScore||50,m=30+d/10;return{id:i.id,label:v,shape:l?"circularImage":"image",image:ie(v,l),size:m,borderWidth:3,borderWidthSelected:5,color:{border:_(v),highlight:{border:"#f39c12"},hover:{border:"#f39c12"}},font:{size:14,color:"var(--color-text)",face:"Arial",strokeWidth:3,strokeColor:"var(--color-surface)"},_profile:r,_role:p,_influenceScore:d}})),n=new vis.DataSet(t.edges.map(i=>{const r=re(i.label||i.relationship_type);return{from:i.from,to:i.to,label:"",width:r.width,dashes:r.dashes,color:{color:r.color,highlight:r.color,hover:r.color,opacity:.8},arrows:i.label==="influences"?{to:{enabled:!0,scaleFactor:.8}}:void 0,smooth:{type:"curvedCW",roundness:.2},title:ce(i.label)}})),o={nodes:{shapeProperties:{useBorderWithImage:!0,interpolation:!1},shadow:{enabled:!0,color:"rgba(0,0,0,0.2)",size:10,x:3,y:3}},edges:{font:{size:11,align:"middle",color:"var(--text-secondary)"},smooth:{type:"curvedCW",roundness:.2},hoverWidth:2,selectionWidth:3},physics:{enabled:!0,stabilization:{enabled:!0,iterations:200},barnesHut:{gravitationalConstant:-3e3,springLength:200,springConstant:.04,damping:.3}},interaction:{hover:!0,tooltipDelay:100,navigationButtons:!0,keyboard:!0,zoomView:!0},layout:{improvedLayout:!0}};b=new vis.Network(s,{nodes:a,edges:n},o),b.on("click",i=>{if(i.nodes.length>0){const r=i.nodes[0],c=a.get(r);de(c,e[r])}else pe()}),b.on("hoverNode",()=>{s.classList.add("gm-cursor-pointer"),s.classList.remove("gm-cursor-default")}),b.on("blurNode",()=>{s.classList.remove("gm-cursor-pointer"),s.classList.add("gm-cursor-default")})}function ce(t){return{influences:"→ Influences",aligned_with:"🤝 Alliance",tension_with:"⚡ Tension"}[t]||t}function de(t,e){const s=document.getElementById("network-info-panel");if(!s)return;const a=e?.contact||{},n=t.label||"Unknown",o=a.role||t._role||"",i=a.organization||"",r=e?.influence_score||t._influenceScore||0,c=e?.communication_style||"Unknown",v=e?.dominant_motivation||"Unknown",l=C(n),p=a.avatar_url||a.photo_url;s.innerHTML=`
        <div class="node-detail-card">
            <div class="node-detail-header">
                ${p?`<img class="node-avatar" src="${p}" alt="${n}" />`:`<div class="node-avatar node-initials" style="background: ${_(n)}">${l}</div>`}
                <div class="node-info">
                    <h3>${n}</h3>
                    ${o?`<p class="node-role">${o}</p>`:""}
                    ${i?`<p class="node-org">${i}</p>`:""}
                </div>
            </div>
            <div class="node-metrics">
                <div class="node-metric">
                    <span class="metric-label">Influence</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${r}%; background: #9b59b6;"></div>
                    </div>
                    <span class="metric-value">${r}%</span>
                </div>
            </div>
            <div class="node-traits">
                <div class="trait-item">
                    <span class="trait-label">Communication</span>
                    <span class="trait-value">${c}</span>
                </div>
                <div class="trait-item">
                    <span class="trait-label">Motivation</span>
                    <span class="trait-value">${v}</span>
                </div>
            </div>
        </div>
    `}function pe(){const t=document.getElementById("network-info-panel");t&&(t.innerHTML=`
        <div class="info-panel-placeholder">
            <p>Click on a person to see details</p>
        </div>
    `)}async function ve(t){const e=t.querySelector("#people-list-container");if(e)try{const s=await S.get("/api/contacts"),a=s.data?.contacts||s.data?.people||[];if(a.length===0){e.innerHTML=`
                <p class="team-analysis-people-loading">
                    No people found. Process some transcripts first to extract participants.
                </p>
            `;return}e.innerHTML=`
            <div class="gm-text-left">
                <p class="team-analysis-intro-p">
                    Select a person to analyze (${a.length} available):
                </p>
                <div class="team-analysis-people-list">
                    ${a.slice(0,20).map(n=>`
                        <button type="button" class="btn btn-secondary analyze-person-btn team-analysis-person-row"
                                data-person-id="${n.id}"
                                data-person-name="${n.name||"Unknown"}">
                            <span class="team-analysis-person-name">${n.name||"Unknown"}</span>
                            <span class="team-analysis-person-role">${n.role||n.organization||""}</span>
                        </button>
                    `).join("")}
                </div>
                ${a.length>20?`<p class="team-analysis-people-truncate">Showing first 20 of ${a.length} people</p>`:""}
            </div>
        `,e.querySelectorAll(".analyze-person-btn").forEach(n=>{n.addEventListener("click",async()=>{const o=n.dataset.personId,i=n.dataset.personName;if(o){h.info(`Analyzing ${i}...`),n.disabled=!0,n.innerHTML="<span>Analyzing...</span>";try{await u.analyzeProfile(o,{forceReanalysis:!0}),h.success(`Profile created for ${i}`),await u.loadProfiles()}catch(r){h.error(`Failed to analyze: ${r.message||"Unknown error"}`),n.disabled=!1,n.innerHTML=`<span class="team-analysis-btn-person-name">${i}</span>`}}})})}catch{e.innerHTML=`
            <p class="team-analysis-graph-error">
                Failed to load people. Please try again.
            </p>
        `}}export{he as createTeamAnalysis};
//# sourceMappingURL=TeamAnalysis-BkSldxXj.js.map
