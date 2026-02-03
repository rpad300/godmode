import{c as S,t as y,h as z}from"./main-BbrmTy0y.js";import{teamAnalysisStore as g}from"./teamAnalysis-b6DZM1KK.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let f=null;function le(){const n=S("div",{className:"team-analysis-panel"});return n.innerHTML=`
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
    `,setTimeout(()=>{C(n)},0),n}async function C(n){g.subscribe(e=>{M(n,e)}),await g.loadAll(),T()}function T(n){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.addEventListener("click",t=>{const a=t.target.dataset.subtab;a&&L(a)})}),document.getElementById("team-analysis-refresh-btn")?.addEventListener("click",async()=>{await g.loadAll(),y.success("Data refreshed")}),document.getElementById("team-analysis-analyze-btn")?.addEventListener("click",async()=>{g.getState().currentSubtab==="profiles"?await A():(y.info("Analyzing team dynamics..."),await g.analyzeTeam(!0),y.success("Team analysis complete"))})}async function A(){const n=document.createElement("div");n.className="modal-overlay",n.innerHTML=`
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
    `,document.body.appendChild(n);const e=()=>n.remove();n.querySelector(".modal-close")?.addEventListener("click",e),n.querySelector("#modal-cancel-btn")?.addEventListener("click",e),n.addEventListener("click",t=>{t.target===n&&e()});try{const t=await z.get("/api/contacts"),a=t.data?.contacts||t.data?.people||[],i=g.getState(),s=new Set(i.profiles.map(l=>l.contact_id||l.person_id)),o=n.querySelector("#contacts-list-loading"),r=n.querySelector("#contacts-list");if(o&&(o.style.display="none"),r&&(r.style.display="block"),a.length===0){r.innerHTML=`
                <div style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    <p>No contacts found. Add contacts to the project first.</p>
                </div>
            `;return}a.sort((l,v)=>{const d=s.has(l.id),p=s.has(v.id);return d!==p?d?1:-1:(l.name||"").localeCompare(v.name||"")}),r.innerHTML=`
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: var(--text-secondary);">
                    ${a.length} contacts • ${s.size} analyzed
                </span>
                <button class="btn btn-sm btn-secondary" id="select-unanalyzed-btn" style="font-size: 12px; padding: 4px 10px;">
                    Select Unanalyzed
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${a.map(l=>{const v=s.has(l.id),d=(l.name||"U").split(" ").map(p=>p[0]).join("").substring(0,2).toUpperCase();return`
                        <label class="contact-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-secondary); border-radius: 10px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent;" data-contact-id="${l.id}">
                            <input type="checkbox" class="contact-checkbox" data-id="${l.id}" data-name="${l.name||"Unknown"}" style="width: 18px; height: 18px; accent-color: var(--primary-color);">
                            ${l.avatar_url?`<img src="${l.avatar_url}" alt="${l.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`:`<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">${d}</div>`}
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: var(--text-primary);">${l.name||"Unknown"}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">${l.role||l.organization||"No role"}</div>
                            </div>
                            ${v?'<span style="font-size: 11px; padding: 4px 8px; background: var(--success-bg, rgba(39, 174, 96, 0.1)); color: var(--success, #27ae60); border-radius: 12px;">Analyzed</span>':'<span style="font-size: 11px; padding: 4px 8px; background: var(--warning-bg, rgba(243, 156, 18, 0.1)); color: var(--warning, #f39c12); border-radius: 12px;">Not analyzed</span>'}
                        </label>
                    `}).join("")}
            </div>
        `;const c=new Set,m=()=>{const l=n.querySelector("#modal-analyze-selected-btn");l&&(l.disabled=c.size===0,l.textContent=`Analyze Selected (${c.size})`)};r.querySelectorAll(".contact-checkbox").forEach(l=>{l.addEventListener("change",v=>{const d=v.target,p=d.dataset.id,u=d.closest(".contact-item");p&&(d.checked?(c.add(p),u&&(u.style.borderColor="var(--primary-color)")):(c.delete(p),u&&(u.style.borderColor="transparent")),m())})}),n.querySelector("#select-unanalyzed-btn")?.addEventListener("click",()=>{r.querySelectorAll(".contact-checkbox").forEach(l=>{const v=l,d=v.dataset.id,p=v.closest(".contact-item");d&&!s.has(d)&&(v.checked=!0,c.add(d),p&&(p.style.borderColor="var(--primary-color)"))}),m()}),n.querySelector("#modal-analyze-selected-btn")?.addEventListener("click",async()=>{if(c.size===0)return;const l=n.querySelector("#modal-analyze-selected-btn"),v=l.textContent;l.disabled=!0,l.textContent="Analyzing...";let d=0,p=0;for(const u of c){const w=r.querySelector(`.contact-checkbox[data-id="${u}"]`),$=w?.dataset.name||"Contact";try{l.textContent=`Analyzing ${$}...`,await g.analyzeProfile(u,{forceReanalysis:!0}),d++;const x=w?.closest(".contact-item")?.querySelector("span:last-child");x&&(x.style.background="var(--success-bg, rgba(39, 174, 96, 0.1))",x.style.color="var(--success, #27ae60)",x.textContent="Analyzed")}catch(k){console.error(`Failed to analyze ${$}:`,k),p++}}await g.loadProfiles(),d>0&&y.success(`Successfully analyzed ${d} team member${d>1?"s":""}`),p>0&&y.error(`Failed to analyze ${p} contact${p>1?"s":""}`),e()})}catch{const a=n.querySelector("#contacts-list-loading");a&&(a.innerHTML=`
                <p style="color: var(--error);">Failed to load contacts. Please try again.</p>
            `)}}async function L(n){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.classList.toggle("active",e.getAttribute("data-subtab")===n)}),n==="graph"&&(console.log("[TeamAnalysis] Loading graph data before switching tab..."),await g.loadGraphData()),g.setSubtab(n)}function M(n,e){const t=n.querySelector("#team-analysis-content");if(!t)return;if(e.loading){t.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="margin-top: 16px; color: var(--text-secondary);">Loading team analysis...</p>
            </div>
        `;return}if(e.analyzing){t.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="margin-top: 16px; color: var(--text-secondary);">Analyzing... This may take a moment.</p>
            </div>
        `;return}const a=e.currentSubtab||"profiles";switch(console.log("[TeamAnalysis] renderContent - currentSubtab:",a),a){case"profiles":j(t,e);break;case"team":F(t,e);break;case"graph":O(t,e);break}}function j(n,e){const{profiles:t,selectedProfile:a}=e;if(a){P(n,a);return}if(t.length===0){n.innerHTML=`
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
        `,ae(n);return}n.innerHTML=`
        <div class="profiles-grid">
            ${t.map(i=>E(i)).join("")}
        </div>
    `,n.querySelectorAll(".profile-card").forEach(i=>{i.addEventListener("click",()=>{const s=i.dataset.personId;s&&g.loadProfile(s)})}),n.querySelectorAll(".analyze-btn").forEach(i=>{i.addEventListener("click",async s=>{s.stopPropagation();const o=i.dataset.personId;o&&(y.info("Analyzing profile..."),await g.analyzeProfile(o,{forceReanalysis:!0}),y.success("Profile analysis complete"))})})}function E(n){const e=n.contact||{},t=e.name||"Unknown",a=t.split(" ").map(c=>c[0]).join("").substring(0,2).toUpperCase(),i=e.role||e.organization||"No role",s=n.confidence_level||"low",o=e.avatar_url,r=n.contact_id||n.person_id;return`
        <div class="profile-card" data-person-id="${r}">
            <div class="profile-header">
                ${o?`<img class="profile-avatar" src="${o}" alt="${t}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />`:`<div class="profile-avatar">${a}</div>`}
                <div class="profile-info">
                    <h3>${t}</h3>
                    <div class="role">${i}</div>
                    <div class="profile-badges">
                        <span class="badge badge-confidence ${s}">${s.replace("_"," ")}</span>
                    </div>
                </div>
            </div>
            <div class="profile-metrics">
                <div class="metric">
                    <div class="metric-value">${n.influence_score||0}</div>
                    <div class="metric-label">Influence</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${n.transcript_count||0}</div>
                    <div class="metric-label">Transcripts</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${n.risk_tolerance||"-"}</div>
                    <div class="metric-label">Risk</div>
                </div>
            </div>
            ${n.communication_style?`
                <div class="profile-style">
                    <div class="profile-style-label">Communication Style</div>
                    <div class="profile-style-value">${n.communication_style}</div>
                </div>
            `:""}
            <button class="btn btn-secondary analyze-btn" data-person-id="${r}" style="width: 100%; margin-top: 12px;">
                Re-analyze
            </button>
        </div>
    `}function P(n,e){const a=(e.contact||{}).name||"Unknown",i=e.profile_data||{};n.innerHTML=`
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
                ${I(i)}
                ${N(i)}
                ${q(i)}
                ${B(i)}
                ${U(i)}
                ${H(i)}
                ${W(i)}
                ${D(i)}
            </div>
        </div>
    `,n.querySelector("#back-to-profiles")?.addEventListener("click",()=>{g.setSelectedProfile(null)})}function I(n){const e=n.communication_identity;return e?`
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
            ${R(e.evidence)}
        </div>
    `:""}function N(n){const e=n.motivations_and_priorities;return e?`
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
    `:""}function q(n){const e=n.behavior_under_pressure;return e?.length?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Behavior Under Pressure
            </h4>
            <div class="evidence-list">
                ${e.map(t=>`
                    <div class="evidence-item">
                        <strong>${t.situation}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">${t.observed_behavior}</p>
                        ${t.quote?`<div class="evidence-quote">"${t.quote}"</div>`:""}
                        ${t.timestamp?`<div class="evidence-timestamp">${t.timestamp}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function B(n){const e=n.influence_tactics;return e?.length?`
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
                ${e.map(t=>`
                    <div class="evidence-item">
                        <strong>${t.objective}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">${t.tactic}</p>
                        ${t.example?`<div class="evidence-quote">${t.example}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function U(n){const e=n.vulnerabilities;if(!e)return"";const t=[];return e.defense_triggers?.length&&t.push(`
            <div style="margin-bottom: 16px;">
                <strong style="color: #e74c3c;">Defense Triggers</strong>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    ${e.defense_triggers.map(a=>`<li>${a.trigger}</li>`).join("")}
                </ul>
            </div>
        `),e.blind_spots?.length&&t.push(`
            <div style="margin-bottom: 16px;">
                <strong style="color: #f39c12;">Blind Spots</strong>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    ${e.blind_spots.map(a=>`<li>${a.description}</li>`).join("")}
                </ul>
            </div>
        `),t.length===0?"":`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Vulnerabilities & Friction Points
            </h4>
            ${t.join("")}
        </div>
    `}function H(n){const e=n.interaction_strategy;return e?`
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
                        ${e.framing_that_works.map(t=>`<li>${t}</li>`).join("")}
                    </ul>
                </div>
            `:""}
            ${e.what_to_avoid?.length?`
                <div>
                    <strong style="color: #e74c3c;">What to Avoid</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${e.what_to_avoid.map(t=>`<li>${t}</li>`).join("")}
                    </ul>
                </div>
            `:""}
        </div>
    `:""}function W(n){const e=n.early_warning_signs;return e?.length?`
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
                ${e.map(t=>`
                    <div class="evidence-item">
                        <strong>${t.signal}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">Indicates: ${t.indicates}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function D(n){const e=n.power_analysis;return e?.length?`
        <div class="profile-section">
            <h4>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Power & Dependency Analysis
            </h4>
            <div class="evidence-list">
                ${e.map(t=>`
                    <div class="evidence-item">
                        <strong>${t.factor}</strong>
                        <p style="margin: 8px 0 0; color: var(--text-secondary);">${t.assessment}</p>
                        ${t.strategic_implication?`<p style="margin: 8px 0 0; font-size: 12px; color: var(--primary-color);">→ ${t.strategic_implication}</p>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function R(n){return n?.length?`
        <div class="evidence-list">
            ${n.map(e=>`
                <div class="evidence-item">
                    ${e.quote?`<div class="evidence-quote">"${e.quote}"</div>`:""}
                    ${e.observation?`<p style="margin: 0; color: var(--text-secondary);">${e.observation}</p>`:""}
                    ${e.timestamp?`<div class="evidence-timestamp">${e.timestamp}</div>`:""}
                </div>
            `).join("")}
        </div>
    `:""}function V(n){const e={};return n.forEach((t,a)=>{const i=t.contact||{},s=i.name||"Unknown",o=s.split(" ").map(m=>m[0]).join("").substring(0,2).toUpperCase(),r={name:s,initials:o,role:i.role||i.organization||"",avatarUrl:i.avatar_url};e[`person_${a+1}`]=r,e[`person ${a+1}`]=r,e[`Person_${a+1}`]=r,e[`Person ${a+1}`]=r,e[s.toLowerCase()]=r;const c=s.split(" ")[0];c&&(e[c.toLowerCase()]=r)}),t=>{if(!t)return{name:"Unknown",initials:"?",role:""};const a=t.toLowerCase().trim();return e[a]||{name:t.replace(/_/g," "),initials:t.substring(0,2).toUpperCase(),role:""}}}function h(n,e){const t=e(n);return`
        <div class="person-chip">
            ${t.avatarUrl?`<img class="person-chip-avatar" src="${t.avatarUrl}" alt="${t.name}" />`:`<div class="person-chip-avatar person-chip-initials">${t.initials}</div>`}
            <span class="person-chip-name">${t.name}</span>
        </div>
    `}function F(n,e){const{teamAnalysis:t,profiles:a}=e;if(console.log("[TeamAnalysis] renderTeamDynamics called, teamAnalysis:",t),!t){console.log("[TeamAnalysis] No teamAnalysis data, showing empty state"),n.innerHTML=`
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
        `;return}const i=V(a||[]);console.log("[TeamAnalysis] Rendering team dynamics with data:",{cohesion:t.cohesion_score,tension:t.tension_level,teamSize:t.team_size,influenceMapLength:t.influence_map?.length});const s=`tension-${t.tension_level||"low"}`,o=t.cohesion_score>=70?"#27ae60":t.cohesion_score>=40?"#f39c12":"#e74c3c";n.innerHTML=`
        <div class="team-dynamics-header">
            <div class="cohesion-card">
                <div class="cohesion-score-circle" style="--score-color: ${o}">
                    <span class="score-value">${t.cohesion_score||0}</span>
                    <span class="score-label">Cohesion</span>
                </div>
                <div class="cohesion-details">
                    <h3>Team Cohesion Score</h3>
                    <span class="tension-badge ${s}">
                        ${t.tension_level||"unknown"} tension
                    </span>
                </div>
            </div>
            <div class="team-size-card">
                <div class="team-size-value">${t.team_size||0}</div>
                <div class="team-size-label">Team Members</div>
            </div>
        </div>

        <div class="team-dynamics-grid">
            ${G(t.influence_map||[],i)}
            ${Y(t.alliances||[],i)}
            ${J(t.tensions||[],i)}
            ${K(t.analysis_data?.power_centers||[],i)}
        </div>
    `}function G(n,e){return n.length?`
        <div class="dynamics-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>Influence Map</h3>
                <span class="dynamics-count">${n.length} connections</span>
            </div>
            <div class="dynamics-list">
                ${n.slice(0,8).map(t=>{const a=Math.round((t.strength||.5)*100),i=a>=70?"Strong":a>=40?"Moderate":"Weak";return`
                        <div class="dynamics-item influence-item">
                            <div class="influence-flow">
                                ${h(t.from_person,e)}
                                <div class="influence-arrow">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                        <polyline points="12 5 19 12 12 19"/>
                                    </svg>
                                </div>
                                ${h(t.to_person,e)}
                            </div>
                            <div class="influence-strength-container">
                                <div class="strength-value">${a}%</div>
                                <div class="strength-bar-mini">
                                    <div class="strength-fill-mini" style="width: ${a}%"></div>
                                </div>
                                <div class="strength-label">${i}</div>
                            </div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `:""}function Y(n,e){return n.length?`
        <div class="dynamics-card alliance-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Alliances</h3>
                <span class="dynamics-count">${n.length} groups</span>
            </div>
            <div class="dynamics-list">
                ${n.map(t=>{let a=t.members||[];typeof a=="string"&&(a=a.split(/[\s,]+/).filter(o=>o.trim()));const i=Math.round((t.strength||.5)*100),s=i>=70?"Strong bond":i>=40?"Moderate bond":"Weak bond";return`
                        <div class="dynamics-item alliance-item">
                            <div class="alliance-members">
                                ${a.map(o=>h(o,e)).join('<span class="alliance-connector">&</span>')}
                            </div>
                            <div class="alliance-strength-container">
                                <div class="strength-value alliance-value">${i}%</div>
                                <div class="strength-bar-mini alliance-bar">
                                    <div class="strength-fill-mini" style="width: ${i}%"></div>
                                </div>
                                <div class="strength-label">${s}</div>
                            </div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `:""}function J(n,e){return n.length?`
        <div class="dynamics-card tension-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Tensions</h3>
            </div>
            <div class="dynamics-list">
                ${n.map(t=>{let a=t.between||[];typeof a=="string"&&(a=a.split(/[\s,]+/).filter(s=>s.trim()));const i=`tension-level-${t.level||"low"}`;return`
                        <div class="dynamics-item tension-item ${i}">
                            <div class="tension-parties">
                                ${a.slice(0,2).map(s=>h(s,e)).join('<span class="tension-vs">↔</span>')}
                            </div>
                            <span class="tension-badge ${i}">${t.level||"low"}</span>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `:""}function K(n,e){return n.length?`
        <div class="dynamics-card power-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <h3>Power Centers</h3>
                <span class="dynamics-count">${n.length} key players</span>
            </div>
            <div class="dynamics-list">
                ${n.map(t=>{const a=Math.round(t.influence_reach||50),i=t.power_type||"influence",s=i==="technical"?"🔧":i==="formal"?"👔":i==="social"?"🤝":i==="informal"?"💬":"⚡";return`
                        <div class="dynamics-item power-item">
                            <div class="power-person">
                                ${h(t.person,e)}
                            </div>
                            <div class="power-details">
                                <span class="power-type-badge">
                                    <span class="power-icon">${s}</span>
                                    ${i}
                                </span>
                            </div>
                            <div class="power-reach-container">
                                <div class="strength-value power-value">${a}%</div>
                                <div class="strength-bar-mini power-bar">
                                    <div class="strength-fill-mini" style="width: ${a}%"></div>
                                </div>
                                <div class="strength-label">reach</div>
                            </div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `:""}function O(n,e){const{graphData:t,profiles:a}=e;if(console.log("[TeamAnalysis] renderNetworkGraph called, graphData:",t),!t||!t.nodes||!t.nodes.length){console.log("[TeamAnalysis] No graph data, showing empty state"),n.innerHTML=`
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
        `;return}const i={};(a||[]).forEach(s=>{const o=s.contact_id||s.person_id;o&&(i[o]=s)}),console.log("[TeamAnalysis] Rendering network graph with",t.nodes.length,"nodes and",t.edges?.length||0,"edges"),n.innerHTML=`
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
    `,setTimeout(()=>{ee(t,i)},100)}function _(n){return n.split(" ").map(e=>e[0]).join("").substring(0,2).toUpperCase()}function b(n){const e=["#9b59b6","#3498db","#e74c3c","#27ae60","#f39c12","#1abc9c","#e67e22","#34495e"];let t=0;for(let a=0;a<n.length;a++)t=n.charCodeAt(a)+((t<<5)-t);return e[Math.abs(t)%e.length]}function Q(n,e,t,a){const i=_(n),s=b(n),o=80;if(e)return e;const r=`
        <svg xmlns="http://www.w3.org/2000/svg" width="${o}" height="${o}" viewBox="0 0 ${o} ${o}">
            <defs>
                <linearGradient id="grad-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${s};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${X(s,-30)};stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="${o/2}" cy="${o/2}" r="${o/2-2}" fill="url(#grad-${i})" stroke="white" stroke-width="3"/>
            <text x="${o/2}" y="${o/2+8}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${i}</text>
        </svg>
    `;return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(r)}function X(n,e){const t=r=>Math.min(255,Math.max(0,r)),a=n.replace("#",""),i=t(parseInt(a.substring(0,2),16)+e),s=t(parseInt(a.substring(2,4),16)+e),o=t(parseInt(a.substring(4,6),16)+e);return`#${i.toString(16).padStart(2,"0")}${s.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}`}function Z(n){switch(n){case"influences":return{color:"#3498db",dashes:!1,width:2};case"aligned_with":return{color:"#27ae60",dashes:!1,width:3};case"tension_with":return{color:"#e74c3c",dashes:[5,5],width:2};default:return{color:"#95a5a6",dashes:!1,width:1}}}function ee(n,e){console.log("[TeamAnalysis] initializeNetwork called with",n.nodes?.length,"nodes,",n.edges?.length,"edges");const t=document.getElementById("team-network-graph");if(!t){console.error("[TeamAnalysis] Network container not found!");return}if(f&&(console.log("[TeamAnalysis] Destroying existing network instance"),f.destroy(),f=null),typeof vis>"u"){console.error("[TeamAnalysis] vis.js library not loaded!"),t.innerHTML=`
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
                Network visualization library not loaded
            </div>
        `;return}console.log("[TeamAnalysis] vis.js is available, creating network...");const a=new vis.DataSet(n.nodes.map(o=>{const r=e[o.id]||{},c=r.contact||{},m=o.label||c.name||"Unknown",l=c.avatar_url,v=c.role||o.properties?.role||"",d=r.influence_score||o.properties?.influenceScore||50,p=30+d/10;return{id:o.id,label:m,shape:l?"circularImage":"image",image:Q(m,l),size:p,borderWidth:3,borderWidthSelected:5,color:{border:b(m),highlight:{border:"#f39c12"},hover:{border:"#f39c12"}},font:{size:14,color:"var(--color-text)",face:"Arial",strokeWidth:3,strokeColor:"var(--color-surface)"},_profile:r,_role:v,_influenceScore:d}})),i=new vis.DataSet(n.edges.map(o=>{const r=Z(o.label||o.relationship_type);return{from:o.from,to:o.to,label:"",width:r.width,dashes:r.dashes,color:{color:r.color,highlight:r.color,hover:r.color,opacity:.8},arrows:o.label==="influences"?{to:{enabled:!0,scaleFactor:.8}}:void 0,smooth:{type:"curvedCW",roundness:.2},title:te(o.label)}})),s={nodes:{shapeProperties:{useBorderWithImage:!0,interpolation:!1},shadow:{enabled:!0,color:"rgba(0,0,0,0.2)",size:10,x:3,y:3}},edges:{font:{size:11,align:"middle",color:"var(--text-secondary)"},smooth:{type:"curvedCW",roundness:.2},hoverWidth:2,selectionWidth:3},physics:{enabled:!0,stabilization:{enabled:!0,iterations:200},barnesHut:{gravitationalConstant:-3e3,springLength:200,springConstant:.04,damping:.3}},interaction:{hover:!0,tooltipDelay:100,navigationButtons:!0,keyboard:!0,zoomView:!0},layout:{improvedLayout:!0}};f=new vis.Network(t,{nodes:a,edges:i},s),f.on("click",o=>{if(o.nodes.length>0){const r=o.nodes[0],c=a.get(r);ne(c,e[r])}else ie()}),f.on("hoverNode",()=>{t.style.cursor="pointer"}),f.on("blurNode",()=>{t.style.cursor="default"})}function te(n){return{influences:"→ Influences",aligned_with:"🤝 Alliance",tension_with:"⚡ Tension"}[n]||n}function ne(n,e){const t=document.getElementById("network-info-panel");if(!t)return;const a=e?.contact||{},i=n.label||"Unknown",s=a.role||n._role||"",o=a.organization||"",r=e?.influence_score||n._influenceScore||0,c=e?.communication_style||"Unknown",m=e?.dominant_motivation||"Unknown",l=_(i),v=a.avatar_url;t.innerHTML=`
        <div class="node-detail-card">
            <div class="node-detail-header">
                ${v?`<img class="node-avatar" src="${v}" alt="${i}" />`:`<div class="node-avatar node-initials" style="background: ${b(i)}">${l}</div>`}
                <div class="node-info">
                    <h3>${i}</h3>
                    ${s?`<p class="node-role">${s}</p>`:""}
                    ${o?`<p class="node-org">${o}</p>`:""}
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
                    <span class="trait-value">${m}</span>
                </div>
            </div>
        </div>
    `}function ie(){const n=document.getElementById("network-info-panel");n&&(n.innerHTML=`
        <div class="info-panel-placeholder">
            <p>Click on a person to see details</p>
        </div>
    `)}async function ae(n){const e=n.querySelector("#people-list-container");if(e)try{const t=await z.get("/api/contacts"),a=t.data?.contacts||t.data?.people||[];if(a.length===0){e.innerHTML=`
                <p style="color: var(--text-tertiary); font-size: 13px;">
                    No people found. Process some transcripts first to extract participants.
                </p>
            `;return}e.innerHTML=`
            <div style="text-align: left;">
                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
                    Select a person to analyze (${a.length} available):
                </p>
                <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                    ${a.slice(0,20).map(i=>`
                        <button class="btn btn-secondary analyze-person-btn" 
                                data-person-id="${i.id}" 
                                data-person-name="${i.name||"Unknown"}"
                                style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                            <span style="font-weight: 500;">${i.name||"Unknown"}</span>
                            <span style="font-size: 12px; color: var(--text-tertiary);">${i.role||i.organization||""}</span>
                        </button>
                    `).join("")}
                </div>
                ${a.length>20?`<p style="color: var(--text-tertiary); font-size: 12px; margin-top: 8px;">Showing first 20 of ${a.length} people</p>`:""}
            </div>
        `,e.querySelectorAll(".analyze-person-btn").forEach(i=>{i.addEventListener("click",async()=>{const s=i.dataset.personId,o=i.dataset.personName;if(s){y.info(`Analyzing ${o}...`),i.disabled=!0,i.innerHTML="<span>Analyzing...</span>";try{await g.analyzeProfile(s,{forceReanalysis:!0}),y.success(`Profile created for ${o}`),await g.loadProfiles()}catch(r){y.error(`Failed to analyze: ${r.message||"Unknown error"}`),i.disabled=!1,i.innerHTML=`<span style="font-weight: 500;">${o}</span>`}}})})}catch{e.innerHTML=`
            <p style="color: var(--error); font-size: 13px;">
                Failed to load people. Please try again.
            </p>
        `}}export{le as createTeamAnalysis};
//# sourceMappingURL=TeamAnalysis-CH2PO-EU.js.map
