import{c as T,t as h,h as C}from"./main-DZFGTOOo.js";import{teamAnalysisStore as f}from"./teamAnalysis-b6DZM1KK.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let b=null;function ue(){const t=T("div",{className:"team-analysis-panel"});return t.innerHTML=`
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
                <p style="margin-top: 16px; color: var(--text-secondary);">Loading team analysis...</p>
            </div>
        </div>
    `,setTimeout(()=>{A(t)},0),t}async function A(t){f.subscribe(e=>{E(t,e)}),await f.loadAll(),j()}function j(t){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.addEventListener("click",n=>{const i=n.target.dataset.subtab;i&&P(i)})}),document.getElementById("team-analysis-refresh-btn")?.addEventListener("click",async()=>{await f.loadAll(),h.success("Data refreshed")}),document.getElementById("team-analysis-analyze-btn")?.addEventListener("click",async()=>{f.getState().currentSubtab==="profiles"?await I():(h.info("Analyzing team dynamics..."),await f.analyzeTeam(!0),h.success("Team analysis complete"))})}async function I(){const t=document.createElement("div");t.className="modal-overlay",t.innerHTML=`
        <div class="modal" style="max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>Analyze Team Members</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    Select team members to analyze. Members with existing profiles can be re-analyzed.
                </p>
                <div id="contacts-list-loading" style="text-align: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 16px; color: var(--text-secondary);">Loading contacts...</p>
                </div>
                <div id="contacts-list" style="display: none;"></div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-primary" id="modal-analyze-selected-btn" disabled>Analyze Selected (0)</button>
            </div>
        </div>
    `,document.body.appendChild(t);const e=()=>t.remove();t.querySelector(".modal-close")?.addEventListener("click",e),t.querySelector("#modal-cancel-btn")?.addEventListener("click",e),t.addEventListener("click",n=>{n.target===t&&e()});try{const n=await C.get("/api/contacts"),i=n.data?.contacts||n.data?.people||[],s=f.getState(),o=new Set(s.profiles.map(l=>l.contact_id||l.person_id)),a=t.querySelector("#contacts-list-loading"),r=t.querySelector("#contacts-list");if(a&&(a.style.display="none"),r&&(r.style.display="block"),i.length===0){r.innerHTML=`
                <div style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    <p>No contacts found. Add contacts to the project first.</p>
                </div>
            `;return}i.sort((l,p)=>{const d=o.has(l.id),g=o.has(p.id);return d!==g?d?1:-1:(l.name||"").localeCompare(p.name||"")}),r.innerHTML=`
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: var(--text-secondary);">
                    ${i.length} contacts • ${o.size} analyzed
                </span>
                <button class="btn btn-sm btn-secondary" id="select-unanalyzed-btn" style="font-size: 12px; padding: 4px 10px;">
                    Select Unanalyzed
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${i.map(l=>{const p=o.has(l.id),d=(l.name||"U").split(" ").map(g=>g[0]).join("").substring(0,2).toUpperCase();return`
                        <label class="contact-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-secondary); border-radius: 10px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent;" data-contact-id="${l.id}">
                            <input type="checkbox" class="contact-checkbox" data-id="${l.id}" data-name="${l.name||"Unknown"}" style="width: 18px; height: 18px; accent-color: var(--primary-color);">
                            ${l.avatar_url||l.photo_url?`<img src="${l.avatar_url||l.photo_url}" alt="${l.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`:`<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">${d}</div>`}
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: var(--text-primary);">${l.name||"Unknown"}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">${l.role||l.organization||"No role"}</div>
                            </div>
                            ${p?'<span style="font-size: 11px; padding: 4px 8px; background: var(--success-bg, rgba(39, 174, 96, 0.1)); color: var(--success, #27ae60); border-radius: 12px;">Analyzed</span>':'<span style="font-size: 11px; padding: 4px 8px; background: var(--warning-bg, rgba(243, 156, 18, 0.1)); color: var(--warning, #f39c12); border-radius: 12px;">Not analyzed</span>'}
                        </label>
                    `}).join("")}
            </div>
        `;const c=new Set,v=()=>{const l=t.querySelector("#modal-analyze-selected-btn");l&&(l.disabled=c.size===0,l.textContent=`Analyze Selected (${c.size})`)};r.querySelectorAll(".contact-checkbox").forEach(l=>{l.addEventListener("change",p=>{const d=p.target,g=d.dataset.id,m=d.closest(".contact-item");g&&(d.checked?(c.add(g),m&&(m.style.borderColor="var(--primary-color)")):(c.delete(g),m&&(m.style.borderColor="transparent")),v())})}),t.querySelector("#select-unanalyzed-btn")?.addEventListener("click",()=>{r.querySelectorAll(".contact-checkbox").forEach(l=>{const p=l,d=p.dataset.id,g=p.closest(".contact-item");d&&!o.has(d)&&(p.checked=!0,c.add(d),g&&(g.style.borderColor="var(--primary-color)"))}),v()}),t.querySelector("#modal-analyze-selected-btn")?.addEventListener("click",async()=>{if(c.size===0)return;const l=t.querySelector("#modal-analyze-selected-btn"),p=l.textContent;l.disabled=!0,l.textContent="Analyzing...";let d=0,g=0;for(const m of c){const k=r.querySelector(`.contact-checkbox[data-id="${m}"]`),w=k?.dataset.name||"Contact";try{l.textContent=`Analyzing ${w}...`,await f.analyzeProfile(m,{forceReanalysis:!0}),d++;const y=k?.closest(".contact-item")?.querySelector("span:last-child");y&&(y.style.background="var(--success-bg, rgba(39, 174, 96, 0.1))",y.style.color="var(--success, #27ae60)",y.textContent="Analyzed")}catch($){console.error(`Failed to analyze ${w}:`,$),g++}}await f.loadProfiles(),d>0&&h.success(`Successfully analyzed ${d} team member${d>1?"s":""}`),g>0&&h.error(`Failed to analyze ${g} contact${g>1?"s":""}`),e()})}catch{const i=t.querySelector("#contacts-list-loading");i&&(i.innerHTML=`
                <p style="color: var(--error);">Failed to load contacts. Please try again.</p>
            `)}}async function P(t){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.classList.toggle("active",e.getAttribute("data-subtab")===t)}),t==="graph"&&(console.log("[TeamAnalysis] Loading graph data before switching tab..."),await f.loadGraphData()),f.setSubtab(t)}function E(t,e){const n=t.querySelector("#team-analysis-content");if(!n)return;if(e.loading){n.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="margin-top: 16px; color: var(--text-secondary);">Loading team analysis...</p>
            </div>
        `;return}if(e.analyzing){n.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="margin-top: 16px; color: var(--text-secondary);">Analyzing... This may take a moment.</p>
            </div>
        `;return}const i=e.currentSubtab||"profiles";switch(console.log("[TeamAnalysis] renderContent - currentSubtab:",i),i){case"profiles":B(n,e);break;case"team":O(n,e);break;case"graph":se(n,e);break}}function B(t,e){const{profiles:n,selectedProfile:i}=e;if(i){q(t,i);return}if(n.length===0){t.innerHTML=`
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
                <div id="people-list-container" style="margin-top: 20px; width: 100%; max-width: 500px;">
                    <p style="color: var(--text-tertiary); font-size: 13px;">Loading people...</p>
                </div>
            </div>
        `,ve(t);return}t.innerHTML=`
        <div class="profiles-grid">
            ${n.map(s=>U(s)).join("")}
        </div>
    `,t.querySelectorAll(".profile-card").forEach(s=>{s.addEventListener("click",()=>{const o=s.dataset.personId;o&&f.loadProfile(o)})}),t.querySelectorAll(".analyze-btn").forEach(s=>{s.addEventListener("click",async o=>{o.stopPropagation();const a=s.dataset.personId;a&&(h.info("Analyzing profile..."),await f.analyzeProfile(a,{forceReanalysis:!0}),h.success("Profile analysis complete"))})})}function U(t){const e=t.contact||{},n=e.name||"Unknown",i=n.split(" ").map(c=>c[0]).join("").substring(0,2).toUpperCase(),s=e.role||e.organization||"No role",o=t.confidence_level||"low",a=e.avatar_url||e.photo_url,r=t.contact_id||t.person_id;return`
        <div class="profile-card" data-person-id="${r}">
            <div class="profile-header">
                ${a?`<img class="profile-avatar" src="${a}" alt="${n}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />`:`<div class="profile-avatar">${i}</div>`}
                <div class="profile-info">
                    <h3>${n}</h3>
                    <div class="role">${s}</div>
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
            <button class="btn btn-secondary analyze-btn" data-person-id="${r}" style="width: 100%; margin-top: 12px;">
                Re-analyze
            </button>
        </div>
    `}function q(t,e){const i=(e.contact||{}).name||"Unknown",s=e.profile_data||{};t.innerHTML=`
        <div class="profile-detail">
            <div class="profile-detail-header">
                <div class="profile-detail-back" id="back-to-profiles">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to Profiles
                </div>
                <h2>${i}</h2>
            </div>

            <div class="profile-sections">
                ${N(s)}
                ${H(s)}
                ${D(s)}
                ${W(s)}
                ${R(s)}
                ${V(s)}
                ${G(s)}
                ${F(s)}
            </div>
        </div>
    `,t.querySelector("#back-to-profiles")?.addEventListener("click",()=>{f.setSelectedProfile(null)})}function N(t){const e=t.communication_identity;return e?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Communication Identity
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
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
            ${e.avoids?.length?`<div style="margin-top: 8px;"><strong>Avoids:</strong> ${e.avoids.join(", ")}</div>`:""}
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">
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
                ${e.map(n=>`
                    <div class="evidence-item">
                        <strong>${n.situation}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">${n.observed_behavior}</p>
                        ${n.quote?`<div class="evidence-quote">"${n.quote}"</div>`:""}
                        ${n.timestamp?`<div class="evidence-timestamp">${n.timestamp}</div>`:""}
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
                ${e.map(n=>`
                    <div class="evidence-item">
                        <strong>${n.objective}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">${n.tactic}</p>
                        ${n.example?`<div class="evidence-quote">${n.example}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function R(t){const e=t.vulnerabilities;if(!e)return"";const n=[];return e.defense_triggers?.length&&n.push(`
            <div style="margin-bottom: 16px;">
                <strong style="color: #e74c3c;">Defense Triggers</strong>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    ${e.defense_triggers.map(i=>`<li>${i.trigger}</li>`).join("")}
                </ul>
            </div>
        `),e.blind_spots?.length&&n.push(`
            <div style="margin-bottom: 16px;">
                <strong style="color: #f39c12;">Blind Spots</strong>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    ${e.blind_spots.map(i=>`<li>${i.description}</li>`).join("")}
                </ul>
            </div>
        `),n.length===0?"":`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Vulnerabilities & Friction Points
            </h4>
            ${n.join("")}
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
                <div style="margin-bottom: 12px;">
                    <strong>Ideal Format</strong>
                    <div style="margin-top: 4px; color: var(--text-secondary);">
                        ${e.ideal_format.channel?`Channel: ${e.ideal_format.channel}`:""}
                        ${e.ideal_format.structure?` | Structure: ${e.ideal_format.structure}`:""}
                        ${e.ideal_format.timing?` | Timing: ${e.ideal_format.timing}`:""}
                    </div>
                </div>
            `:""}
            ${e.framing_that_works?.length?`
                <div style="margin-bottom: 12px;">
                    <strong style="color: #27ae60;">What Works</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${e.framing_that_works.map(n=>`<li>${n}</li>`).join("")}
                    </ul>
                </div>
            `:""}
            ${e.what_to_avoid?.length?`
                <div>
                    <strong style="color: #e74c3c;">What to Avoid</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${e.what_to_avoid.map(n=>`<li>${n}</li>`).join("")}
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
                ${e.map(n=>`
                    <div class="evidence-item">
                        <strong>${n.signal}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">Indicates: ${n.indicates}</p>
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
                ${e.map(n=>`
                    <div class="evidence-item">
                        <strong>${n.factor}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">${n.assessment}</p>
                        ${n.strategic_implication?`<p style="margin: 8px 0 0; font-size: 12px; color: var(--primary-color);">→ ${n.strategic_implication}</p>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function Y(t){return t?.length?`
        <div class="evidence-list">
            ${t.map(e=>`
                <div class="evidence-item">
                    ${e.quote?`<div class="evidence-quote">"${e.quote}"</div>`:""}
                    ${e.observation?`<p style="margin: 0; color: var(--text-secondary);">${e.observation}</p>`:""}
                    ${e.timestamp?`<div class="evidence-timestamp">${e.timestamp}</div>`:""}
                </div>
            `).join("")}
        </div>
    `:""}function K(t){const e={};return t.forEach((n,i)=>{const s=n.contact||{},o=s.name||"Unknown",a=o.split(" ").map(v=>v[0]).join("").substring(0,2).toUpperCase(),r={name:o,initials:a,role:s.role||s.organization||"",avatarUrl:s.avatar_url||s.photo_url};e[`person_${i+1}`]=r,e[`person ${i+1}`]=r,e[`Person_${i+1}`]=r,e[`Person ${i+1}`]=r,e[o.toLowerCase()]=r;const c=o.split(" ")[0];c&&(e[c.toLowerCase()]=r)}),n=>{if(!n)return{name:"Unknown",initials:"?",role:""};const i=n.toLowerCase().trim();return e[i]||{name:n.replace(/_/g," "),initials:n.substring(0,2).toUpperCase(),role:""}}}function u(t,e){const n=e(t);return`
        <div class="person-chip">
            ${n.avatarUrl?`<img class="person-chip-avatar" src="${n.avatarUrl}" alt="${n.name}" />`:`<div class="person-chip-avatar person-chip-initials">${n.initials}</div>`}
            <span class="person-chip-name">${n.name}</span>
        </div>
    `}function O(t,e){const{teamAnalysis:n,profiles:i}=e;if(console.log("[TeamAnalysis] renderTeamDynamics called, teamAnalysis:",n),!n){console.log("[TeamAnalysis] No teamAnalysis data, showing empty state"),t.innerHTML=`
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
        `;return}const s=K(i||[]);console.log("[TeamAnalysis] Rendering team dynamics with data:",{cohesion:n.cohesion_score,tension:n.tension_level,teamSize:n.team_size,influenceMapLength:n.influence_map?.length});const o=`tension-${n.tension_level||"low"}`,a=n.cohesion_score>=70?"#27ae60":n.cohesion_score>=40?"#f39c12":"#e74c3c",r=n.analysis_data||{},c=r.analysis_date||n.last_analysis_at,v=r.recommendations||[],l=r.risk_factors||[],p=r.communication_flow||{},d=r.dominant_communication_pattern||"";t.innerHTML=`
        <div class="team-dynamics-header">
            <div class="cohesion-card">
                <div class="cohesion-score-circle" style="--score-color: ${a}">
                    <span class="score-value">${n.cohesion_score||0}</span>
                    <span class="score-label">Cohesion</span>
                </div>
                <div class="cohesion-details">
                    <h3>Team Cohesion Score</h3>
                    <span class="tension-badge ${o}">
                        ${n.tension_level||"unknown"} tension
                    </span>
                </div>
            </div>
            <div class="team-size-card">
                <div class="team-size-value">${n.team_size||0}</div>
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
                <p class="summary-text">${x(d,s)}</p>
            </div>
        `:""}

        ${J(i||[])}

        ${Q(p,s)}

        <div class="team-dynamics-grid">
            ${ee(n.influence_map||[],s)}
            ${te(n.alliances||[],s)}
            ${ne(n.tensions||[],s)}
            ${ie(r.power_centers||[],s)}
        </div>

        ${X(l)}
        ${Z(v,s)}
    `}function J(t,e){if(!t?.length)return"";const n=[...t].filter(o=>o.influence_score!==void 0).sort((o,a)=>(a.influence_score||0)-(o.influence_score||0));if(n.length===0)return"";const i=Math.max(...n.map(o=>o.influence_score||0),100),s=["🥇","🥈","🥉"];return`
        <div class="influence-scoreboard-section">
            <div class="scoreboard-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3>Influence Scoreboard</h3>
                <span class="section-badge" style="background: rgba(251, 191, 36, 0.15); color: #f59e0b;">
                    ${n.length} members ranked
                </span>
            </div>
            <div class="scoreboard-list">
                ${n.map((o,a)=>{const r=o.contact||{},c=r.name||o.person_name||"Unknown",v=r.role||r.organization||"",l=r.avatar_url||r.photo_url,p=c.split(" ").map(M=>M[0]).join("").substring(0,2).toUpperCase(),d=o.influence_score||0,g=d/i*100,m=a+1,k=s[a]||"",w=a<3,$=o.risk_tolerance||o.risk_level||"medium",y={low:"#10b981",medium:"#f59e0b",high:"#ef4444"},L=y[$]||y.medium,z=(o.communication_style||o.profile_data?.communication_identity?.dominant_style||"").split(";")[0]?.substring(0,50)||"";return`
                        <div class="scoreboard-item ${w?"top-three":""}">
                            <div class="rank-badge ${w?"rank-"+m:""}">
                                ${k||m}
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
                                        <div class="meter-fill" style="width: ${g}%;"></div>
                                    </div>
                                    <div class="meter-value">${d}</div>
                                </div>
                                <div class="risk-indicator" style="--risk-color: ${L};">
                                    <span class="risk-dot"></span>
                                    <span class="risk-text">${$} risk</span>
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
                            ${t.bottlenecks.map(n=>`<li>${x(n,e)}</li>`).join("")}
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
                            ${t.information_brokers.map(n=>u(n,e)).join("")}
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
                            ${t.central_nodes.map(n=>u(n,e)).join("")}
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
                            ${t.isolated_members.map(n=>u(n,e)).join("")}
                        </div>
                        <p class="flow-hint">Members with fewer connections - may need inclusion</p>
                    </div>
                `:""}
            </div>
        </div>
    `}function x(t,e){return t.replace(/Person_(\d+)/g,n=>e(n).name||n)}function X(t){return t?.length?`
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
                ${t.map((e,n)=>`
                    <div class="risk-item">
                        <span class="risk-number">${n+1}</span>
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
                ${t.map((n,i)=>`
                    <div class="recommendation-item">
                        <div class="rec-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                            </svg>
                        </div>
                        <div class="rec-content">
                            <span class="rec-number">Action ${i+1}</span>
                            <p>${x(n,e)}</p>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function ee(t,e){if(!t.length)return"";const n={direct:{color:"#3b82f6",bg:"#eff6ff",icon:"→",desc:"Direct influence through communication and decisions"},technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Influence through technical expertise and knowledge"},political:{color:"#f59e0b",bg:"#fffbeb",icon:"♟",desc:"Influence through organizational dynamics and alliances"},social:{color:"#10b981",bg:"#ecfdf5",icon:"🤝",desc:"Influence through relationships and social capital"},resource:{color:"#ef4444",bg:"#fef2f2",icon:"📊",desc:"Influence through control of resources"}};return`
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
                ${t.slice(0,10).map(i=>{const s=Math.round((i.strength||.5)*100),o=s>=70?"Strong":s>=40?"Moderate":"Weak",a=(i.influence_type||"direct").toLowerCase(),r=n[a]||n.direct,c=i.evidence&&i.evidence.length>10;return`
                        <div class="dynamics-item influence-item expandable-item" data-item-id="${`inf-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="influence-main-row">
                                <div class="influence-flow">
                                    ${u(i.from_person,e)}
                                    <div class="influence-arrow">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                            <polyline points="12 5 19 12 12 19"/>
                                        </svg>
                                    </div>
                                    ${u(i.to_person,e)}
                                </div>
                                <div class="influence-meta">
                                    <span class="type-badge" style="background: ${r.bg}; color: ${r.color};" title="${r.desc}">
                                        <span class="type-icon">${r.icon}</span>
                                        ${a}
                                    </span>
                                </div>
                                <div class="influence-strength-container">
                                    <div class="strength-value">${s}%</div>
                                    <div class="strength-bar-mini">
                                        <div class="strength-fill-mini" style="width: ${s}%; background: ${r.color};"></div>
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
                                        <strong>Evidence:</strong> ${x(i.evidence,e)}
                                    </div>
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function te(t,e){if(!t.length)return"";const n={natural:{color:"#10b981",bg:"#ecfdf5",icon:"🌱",desc:"Organic alliance based on shared values and goals"},circumstantial:{color:"#6366f1",bg:"#eef2ff",icon:"🔗",desc:"Alliance formed due to shared circumstances or challenges"},strategic:{color:"#f59e0b",bg:"#fffbeb",icon:"♟",desc:"Deliberate alliance for mutual benefit"},historical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"📜",desc:"Long-standing alliance based on history"}};return`
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
                ${t.map(i=>{let s=i.members||[];typeof s=="string"&&(s=s.split(/[\s,]+/).filter(d=>d.trim()));const o=Math.round((i.strength||.5)*100),a=o>=70?"Strong bond":o>=40?"Moderate bond":"Weak bond",r=(i.alliance_type||"natural").toLowerCase(),c=n[r]||n.natural,v=i.evidence&&i.evidence.length>10,l=i.shared_values&&i.shared_values.length>0;return`
                        <div class="dynamics-item alliance-item expandable-item" data-item-id="${`all-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="alliance-main-row">
                                <div class="alliance-members">
                                    ${s.map(d=>u(d,e)).join('<span class="alliance-connector">&</span>')}
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
                                    <div class="strength-label">${a}</div>
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
                                            <ul>${i.shared_values.map(d=>`<li>${d}</li>`).join("")}</ul>
                                        </div>
                                    `:""}
                                    ${v?`
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${x(i.evidence,e)}
                                        </div>
                                    `:""}
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function ne(t,e){if(!t.length)return"";const n={technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Disagreements about technical approaches or solutions"},resource:{color:"#f59e0b",bg:"#fffbeb",icon:"📊",desc:"Competition for resources, time, or attention"},political:{color:"#ef4444",bg:"#fef2f2",icon:"♟",desc:"Power dynamics and organizational influence conflicts"},communication:{color:"#3b82f6",bg:"#eff6ff",icon:"💬",desc:"Misunderstandings or communication style clashes"},values:{color:"#10b981",bg:"#ecfdf5",icon:"⚖",desc:"Differences in core values or priorities"}},i={high:{color:"#dc2626",bg:"#fef2f2"},medium:{color:"#f59e0b",bg:"#fffbeb"},low:{color:"#10b981",bg:"#ecfdf5"}};return`
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
                ${t.map(s=>{let o=s.between||[];typeof o=="string"&&(o=o.split(/[\s,]+/).filter(m=>m.trim()));const a=(s.level||"low").toLowerCase(),r=`tension-level-${a}`,c=i[a]||i.low,v=(s.tension_type||"communication").toLowerCase(),l=n[v]||n.communication,p=s.evidence&&s.evidence.length>10,d=s.triggers&&s.triggers.length>0,g=`ten-${Math.random().toString(36).substr(2,9)}`;return`
                        <div class="dynamics-item tension-item expandable-item ${r}" data-item-id="${g}">
                            <div class="tension-main-row">
                                <div class="tension-parties">
                                    ${o.slice(0,2).map(m=>u(m,e)).join('<span class="tension-vs">↔</span>')}
                                </div>
                                <div class="tension-meta">
                                    <span class="type-badge" style="background: ${l.bg}; color: ${l.color};" title="${l.desc}">
                                        <span class="type-icon">${l.icon}</span>
                                        ${v}
                                    </span>
                                </div>
                                <span class="tension-badge" style="background: ${c.bg}; color: ${c.color};">${a}</span>
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
                                            <ul>${s.triggers.map(m=>`<li>${m}</li>`).join("")}</ul>
                                        </div>
                                    `:""}
                                    ${p?`
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${x(s.evidence,e)}
                                        </div>
                                    `:""}
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function ie(t,e){if(!t.length)return"";const n={technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Power through technical expertise and knowledge"},formal:{color:"#3b82f6",bg:"#eff6ff",icon:"👔",desc:"Power through official role and authority"},informal:{color:"#f59e0b",bg:"#fffbeb",icon:"💬",desc:"Power through relationships and influence"},social:{color:"#10b981",bg:"#ecfdf5",icon:"🤝",desc:"Power through social connections and trust"},resource:{color:"#ef4444",bg:"#fef2f2",icon:"📊",desc:"Power through control of resources"}};return`
        <div class="dynamics-card power-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <h3>Power Centers</h3>
                <span class="dynamics-count">${t.length} key players</span>
            </div>
            <div class="dynamics-list">
                ${t.map(i=>{const s=Math.round(i.influence_reach||50),o=(i.power_type||"informal").toLowerCase(),a=n[o]||n.informal,r=i.dependencies&&i.dependencies.length>0;return`
                        <div class="dynamics-item power-item expandable-item" data-item-id="${`pow-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="power-main-row">
                                <div class="power-person">
                                    ${u(i.person,e)}
                                </div>
                                <div class="power-details">
                                    <span class="type-badge" style="background: ${a.bg}; color: ${a.color};" title="${a.desc}">
                                        <span class="type-icon">${a.icon}</span>
                                        ${o}
                                    </span>
                                </div>
                                <div class="power-reach-container">
                                    <div class="strength-value power-value">${s}%</div>
                                    <div class="strength-bar-mini power-bar">
                                        <div class="strength-fill-mini" style="width: ${s}%; background: ${a.color};"></div>
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
                                        <ul>${i.dependencies.map(v=>`<li>${v}</li>`).join("")}</ul>
                                    </div>
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function se(t,e){const{graphData:n,profiles:i}=e;if(console.log("[TeamAnalysis] renderNetworkGraph called, graphData:",n),!n||!n.nodes||!n.nodes.length){console.log("[TeamAnalysis] No graph data, showing empty state"),t.innerHTML=`
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
        `;return}const s={};(i||[]).forEach(o=>{const a=o.contact_id||o.person_id;a&&(s[a]=o)}),console.log("[TeamAnalysis] Rendering network graph with",n.nodes.length,"nodes and",n.edges?.length||0,"edges"),t.innerHTML=`
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
    `,setTimeout(()=>{le(n,s)},100)}function S(t){return t.split(" ").map(e=>e[0]).join("").substring(0,2).toUpperCase()}function _(t){const e=["#9b59b6","#3498db","#e74c3c","#27ae60","#f39c12","#1abc9c","#e67e22","#34495e"];let n=0;for(let i=0;i<t.length;i++)n=t.charCodeAt(i)+((n<<5)-n);return e[Math.abs(n)%e.length]}function ae(t,e,n,i){const s=S(t),o=_(t),a=80;if(e)return e;const r=`
        <svg xmlns="http://www.w3.org/2000/svg" width="${a}" height="${a}" viewBox="0 0 ${a} ${a}">
            <defs>
                <linearGradient id="grad-${s}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${o};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${oe(o,-30)};stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="${a/2}" cy="${a/2}" r="${a/2-2}" fill="url(#grad-${s})" stroke="white" stroke-width="3"/>
            <text x="${a/2}" y="${a/2+8}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${s}</text>
        </svg>
    `;return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(r)}function oe(t,e){const n=r=>Math.min(255,Math.max(0,r)),i=t.replace("#",""),s=n(parseInt(i.substring(0,2),16)+e),o=n(parseInt(i.substring(2,4),16)+e),a=n(parseInt(i.substring(4,6),16)+e);return`#${s.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}${a.toString(16).padStart(2,"0")}`}function re(t){switch(t){case"influences":return{color:"#3498db",dashes:!1,width:2};case"aligned_with":return{color:"#27ae60",dashes:!1,width:3};case"tension_with":return{color:"#e74c3c",dashes:[5,5],width:2};default:return{color:"#95a5a6",dashes:!1,width:1}}}function le(t,e){console.log("[TeamAnalysis] initializeNetwork called with",t.nodes?.length,"nodes,",t.edges?.length,"edges");const n=document.getElementById("team-network-graph");if(!n){console.error("[TeamAnalysis] Network container not found!");return}if(b&&(console.log("[TeamAnalysis] Destroying existing network instance"),b.destroy(),b=null),typeof vis>"u"){console.error("[TeamAnalysis] vis.js library not loaded!"),n.innerHTML=`
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
                Network visualization library not loaded
            </div>
        `;return}console.log("[TeamAnalysis] vis.js is available, creating network...");const i=new vis.DataSet(t.nodes.map(a=>{const r=e[a.id]||{},c=r.contact||{},v=a.label||c.name||"Unknown",l=c.avatar_url||c.photo_url,p=c.role||a.properties?.role||"",d=r.influence_score||a.properties?.influenceScore||50,g=30+d/10;return{id:a.id,label:v,shape:l?"circularImage":"image",image:ae(v,l),size:g,borderWidth:3,borderWidthSelected:5,color:{border:_(v),highlight:{border:"#f39c12"},hover:{border:"#f39c12"}},font:{size:14,color:"var(--color-text)",face:"Arial",strokeWidth:3,strokeColor:"var(--color-surface)"},_profile:r,_role:p,_influenceScore:d}})),s=new vis.DataSet(t.edges.map(a=>{const r=re(a.label||a.relationship_type);return{from:a.from,to:a.to,label:"",width:r.width,dashes:r.dashes,color:{color:r.color,highlight:r.color,hover:r.color,opacity:.8},arrows:a.label==="influences"?{to:{enabled:!0,scaleFactor:.8}}:void 0,smooth:{type:"curvedCW",roundness:.2},title:ce(a.label)}})),o={nodes:{shapeProperties:{useBorderWithImage:!0,interpolation:!1},shadow:{enabled:!0,color:"rgba(0,0,0,0.2)",size:10,x:3,y:3}},edges:{font:{size:11,align:"middle",color:"var(--text-secondary)"},smooth:{type:"curvedCW",roundness:.2},hoverWidth:2,selectionWidth:3},physics:{enabled:!0,stabilization:{enabled:!0,iterations:200},barnesHut:{gravitationalConstant:-3e3,springLength:200,springConstant:.04,damping:.3}},interaction:{hover:!0,tooltipDelay:100,navigationButtons:!0,keyboard:!0,zoomView:!0},layout:{improvedLayout:!0}};b=new vis.Network(n,{nodes:i,edges:s},o),b.on("click",a=>{if(a.nodes.length>0){const r=a.nodes[0],c=i.get(r);de(c,e[r])}else pe()}),b.on("hoverNode",()=>{n.style.cursor="pointer"}),b.on("blurNode",()=>{n.style.cursor="default"})}function ce(t){return{influences:"→ Influences",aligned_with:"🤝 Alliance",tension_with:"⚡ Tension"}[t]||t}function de(t,e){const n=document.getElementById("network-info-panel");if(!n)return;const i=e?.contact||{},s=t.label||"Unknown",o=i.role||t._role||"",a=i.organization||"",r=e?.influence_score||t._influenceScore||0,c=e?.communication_style||"Unknown",v=e?.dominant_motivation||"Unknown",l=S(s),p=i.avatar_url||i.photo_url;n.innerHTML=`
        <div class="node-detail-card">
            <div class="node-detail-header">
                ${p?`<img class="node-avatar" src="${p}" alt="${s}" />`:`<div class="node-avatar node-initials" style="background: ${_(s)}">${l}</div>`}
                <div class="node-info">
                    <h3>${s}</h3>
                    ${o?`<p class="node-role">${o}</p>`:""}
                    ${a?`<p class="node-org">${a}</p>`:""}
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
    `)}async function ve(t){const e=t.querySelector("#people-list-container");if(e)try{const n=await C.get("/api/contacts"),i=n.data?.contacts||n.data?.people||[];if(i.length===0){e.innerHTML=`
                <p style="color: var(--text-tertiary); font-size: 13px;">
                    No people found. Process some transcripts first to extract participants.
                </p>
            `;return}e.innerHTML=`
            <div style="text-align: left;">
                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
                    Select a person to analyze (${i.length} available):
                </p>
                <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                    ${i.slice(0,20).map(s=>`
                        <button class="btn btn-secondary analyze-person-btn" 
                                data-person-id="${s.id}" 
                                data-person-name="${s.name||"Unknown"}"
                                style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                            <span style="font-weight: 500;">${s.name||"Unknown"}</span>
                            <span style="font-size: 12px; color: var(--text-tertiary);">${s.role||s.organization||""}</span>
                        </button>
                    `).join("")}
                </div>
                ${i.length>20?`<p style="color: var(--text-tertiary); font-size: 12px; margin-top: 8px;">Showing first 20 of ${i.length} people</p>`:""}
            </div>
        `,e.querySelectorAll(".analyze-person-btn").forEach(s=>{s.addEventListener("click",async()=>{const o=s.dataset.personId,a=s.dataset.personName;if(o){h.info(`Analyzing ${a}...`),s.disabled=!0,s.innerHTML="<span>Analyzing...</span>";try{await f.analyzeProfile(o,{forceReanalysis:!0}),h.success(`Profile created for ${a}`),await f.loadProfiles()}catch(r){h.error(`Failed to analyze: ${r.message||"Unknown error"}`),s.disabled=!1,s.innerHTML=`<span style="font-weight: 500;">${a}</span>`}}})})}catch{e.innerHTML=`
            <p style="color: var(--error); font-size: 13px;">
                Failed to load people. Please try again.
            </p>
        `}}export{ue as createTeamAnalysis};
//# sourceMappingURL=TeamAnalysis-BKtZPBFt.js.map
