import{c as T,K as g,t as h,h as C}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let b=null;function he(){const s=T("div",{className:"team-analysis-panel"});return s.innerHTML=`
        <div id="team-analysis-content">
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Loading team analysis...</p>
            </div>
        </div>
    `,setTimeout(()=>{A(s)},0),s}async function A(s){g.subscribe(e=>{j(s,e)}),await g.loadAll(),I()}function I(s){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.addEventListener("click",n=>{const t=n.target.dataset.subtab;t&&E(t)})}),document.getElementById("team-analysis-refresh-btn")?.addEventListener("click",async()=>{await g.loadAll(),h.success("Data refreshed")}),document.getElementById("team-analysis-analyze-btn")?.addEventListener("click",async()=>{g.getState().currentSubtab==="profiles"?await P():(h.info("Analyzing team dynamics..."),await g.analyzeTeam(!0),h.success("Team analysis complete"))})}async function P(){const s=document.createElement("div");s.className="modal-overlay",s.innerHTML=`
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
    `,document.body.appendChild(s);const e=()=>s.remove();s.querySelector(".modal-close")?.addEventListener("click",e),s.querySelector("#modal-cancel-btn")?.addEventListener("click",e),s.addEventListener("click",n=>{n.target===s&&e()});try{const n=await C.get("/api/contacts"),t=n.data?.contacts||n.data?.people||[],a=g.getState(),o=new Set(a.profiles.map(c=>c.contact_id||c.person_id)),i=s.querySelector("#contacts-list-loading"),l=s.querySelector("#contacts-list");if(i&&i.classList.add("hidden"),l&&l.classList.remove("hidden"),t.length===0){l.innerHTML=`
                <div class="team-analysis-contacts-empty">
                    <p>No contacts found. Add contacts to the project first.</p>
                </div>
            `;return}t.sort((c,v)=>{const d=o.has(c.id),m=o.has(v.id);return d!==m?d?1:-1:(c.name||"").localeCompare(v.name||"")}),l.innerHTML=`
            <div class="team-analysis-contacts-bar">
                <span class="team-analysis-contacts-bar-text">
                    ${t.length} contacts • ${o.size} analyzed
                </span>
                <button type="button" class="btn btn-sm btn-secondary team-analysis-select-unanalyzed-btn" id="select-unanalyzed-btn">
                    Select Unanalyzed
                </button>
            </div>
            <div class="team-analysis-contacts-list">
                ${t.map(c=>{const v=o.has(c.id),d=(c.name||"U").split(" ").map(m=>m[0]).join("").substring(0,2).toUpperCase();return`
                        <label class="contact-item team-analysis-contact-item" data-contact-id="${c.id}">
                            <input type="checkbox" class="contact-checkbox team-analysis-contact-checkbox" data-id="${c.id}" data-name="${c.name||"Unknown"}">
                            ${c.avatar_url||c.photo_url?`<img src="${c.avatar_url||c.photo_url}" alt="${c.name}" class="team-analysis-contact-avatar">`:`<div class="team-analysis-contact-avatar-initials">${d}</div>`}
                            <div class="team-analysis-contact-info">
                                <div class="team-analysis-contact-name">${c.name||"Unknown"}</div>
                                <div class="team-analysis-contact-role">${c.role||c.organization||"No role"}</div>
                            </div>
                            <span class="team-analysis-contact-badge ${v?"team-analysis-contact-badge-analyzed":"team-analysis-contact-badge-not-analyzed"}">${v?"Analyzed":"Not analyzed"}</span>
                        </label>
                    `}).join("")}
            </div>
        `;const r=new Set,p=()=>{const c=s.querySelector("#modal-analyze-selected-btn");c&&(c.disabled=r.size===0,c.textContent=`Analyze Selected (${r.size})`)};l.querySelectorAll(".contact-checkbox").forEach(c=>{c.addEventListener("change",v=>{const d=v.target,m=d.dataset.id,u=d.closest(".contact-item");m&&(d.checked?(r.add(m),u&&u.classList.add("selected")):(r.delete(m),u&&u.classList.remove("selected")),p())})}),s.querySelector("#select-unanalyzed-btn")?.addEventListener("click",()=>{l.querySelectorAll(".contact-checkbox").forEach(c=>{const v=c,d=v.dataset.id,m=v.closest(".contact-item");d&&!o.has(d)&&(v.checked=!0,r.add(d),m&&m.classList.add("selected"))}),p()}),s.querySelector("#modal-analyze-selected-btn")?.addEventListener("click",async()=>{if(r.size===0)return;const c=s.querySelector("#modal-analyze-selected-btn"),v=c.textContent;c.disabled=!0,c.textContent="Analyzing...";let d=0,m=0;for(const u of r){const x=l.querySelector(`.contact-checkbox[data-id="${u}"]`),w=x?.dataset.name||"Contact";try{c.textContent=`Analyzing ${w}...`,await g.analyzeProfile(u,{forceReanalysis:!0}),d++;const y=x?.closest(".contact-item")?.querySelector(".team-analysis-contact-badge");y&&(y.classList.remove("team-analysis-contact-badge-not-analyzed"),y.classList.add("team-analysis-contact-badge-analyzed"),y.textContent="Analyzed")}catch(k){console.error(`Failed to analyze ${w}:`,k),m++}}await g.loadProfiles(),d>0&&h.success(`Successfully analyzed ${d} team member${d>1?"s":""}`),m>0&&h.error(`Failed to analyze ${m} contact${m>1?"s":""}`),e()})}catch{const t=s.querySelector("#contacts-list-loading");t&&(t.innerHTML=`
                <p class="team-analysis-error-text">Failed to load contacts. Please try again.</p>
            `)}}async function E(s){document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(e=>{e.classList.toggle("active",e.getAttribute("data-subtab")===s)}),s==="graph"&&(console.log("[TeamAnalysis] Loading graph data before switching tab..."),await g.loadGraphData()),g.setSubtab(s)}function j(s,e){const n=s.querySelector("#team-analysis-content");if(!n)return;if(e.loading){n.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Loading team analysis...</p>
            </div>
        `;return}if(e.analyzing){n.innerHTML=`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="team-analysis-loading-state-text">Analyzing... This may take a moment.</p>
            </div>
        `;return}const t=e.currentSubtab||"profiles";switch(console.log("[TeamAnalysis] renderContent - currentSubtab:",t),t){case"profiles":B(n,e);break;case"team":O(n,e);break;case"graph":ae(n,e);break}}function B(s,e){const{profiles:n,selectedProfile:t}=e;if(t){q(s,t);return}if(n.length===0){s.innerHTML=`
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
        `,pe(s);return}s.innerHTML=`
        <div class="profiles-grid">
            ${n.map(a=>U(a)).join("")}
        </div>
    `,s.querySelectorAll(".profile-card").forEach(a=>{a.addEventListener("click",()=>{const o=a.dataset.personId;o&&g.loadProfile(o)})}),s.querySelectorAll(".analyze-btn").forEach(a=>{a.addEventListener("click",async o=>{o.stopPropagation();const i=a.dataset.personId;i&&(h.info("Analyzing profile..."),await g.analyzeProfile(i,{forceReanalysis:!0}),h.success("Profile analysis complete"))})})}function U(s){const e=s.contact||{},n=e.name||"Unknown",t=n.split(" ").map(r=>r[0]).join("").substring(0,2).toUpperCase(),a=e.role||e.organization||"No role",o=s.confidence_level||"low",i=e.avatar_url||e.photo_url,l=s.contact_id||s.person_id;return`
        <div class="profile-card" data-person-id="${l}">
            <div class="profile-header">
                ${i?`<img class="profile-avatar" src="${i}" alt="${n}" />`:`<div class="profile-avatar">${t}</div>`}
                <div class="profile-info">
                    <h3>${n}</h3>
                    <div class="role">${a}</div>
                    <div class="profile-badges">
                        <span class="badge badge-confidence ${o}">${o.replace("_"," ")}</span>
                    </div>
                </div>
            </div>
            <div class="profile-metrics">
                <div class="metric">
                    <div class="metric-value">${s.influence_score||0}</div>
                    <div class="metric-label">Influence</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${s.transcript_count||0}</div>
                    <div class="metric-label">Transcripts</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${s.risk_tolerance||"-"}</div>
                    <div class="metric-label">Risk</div>
                </div>
            </div>
            ${s.communication_style?`
                <div class="profile-style">
                    <div class="profile-style-label">Communication Style</div>
                    <div class="profile-style-value">${s.communication_style}</div>
                </div>
            `:""}
            <button type="button" class="btn btn-secondary analyze-btn team-analysis-analyze-btn-full" data-person-id="${l}">
                Re-analyze
            </button>
        </div>
    `}function q(s,e){const t=(e.contact||{}).name||"Unknown",a=e.profile_data||{};s.innerHTML=`
        <div class="profile-detail">
            <div class="profile-detail-header">
                <div class="profile-detail-back" id="back-to-profiles">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to Profiles
                </div>
                <h2>${t}</h2>
            </div>

            <div class="profile-sections">
                ${H(a)}
                ${N(a)}
                ${D(a)}
                ${W(a)}
                ${R(a)}
                ${V(a)}
                ${G(a)}
                ${F(a)}
            </div>
        </div>
    `,s.querySelector("#back-to-profiles")?.addEventListener("click",()=>{g.setSelectedProfile(null)})}function H(s){const e=s.communication_identity;return e?`
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
            ${K(e.evidence)}
        </div>
    `:""}function N(s){const e=s.motivations_and_priorities;return e?`
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
    `:""}function D(s){const e=s.behavior_under_pressure;return e?.length?`
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
                        <p class="team-analysis-evidence-p">${n.observed_behavior}</p>
                        ${n.quote?`<div class="evidence-quote">"${n.quote}"</div>`:""}
                        ${n.timestamp?`<div class="evidence-timestamp">${n.timestamp}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function W(s){const e=s.influence_tactics;return e?.length?`
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
                        <p class="team-analysis-evidence-p">${n.tactic}</p>
                        ${n.example?`<div class="evidence-quote">${n.example}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function R(s){const e=s.vulnerabilities;if(!e)return"";const n=[];return e.defense_triggers?.length&&n.push(`
            <div class="team-analysis-vuln-block">
                <strong class="team-analysis-vuln-title-defense">Defense Triggers</strong>
                <ul class="team-analysis-vuln-ul">
                    ${e.defense_triggers.map(t=>`<li>${t.trigger}</li>`).join("")}
                </ul>
            </div>
        `),e.blind_spots?.length&&n.push(`
            <div class="team-analysis-vuln-block">
                <strong class="team-analysis-vuln-title-blind">Blind Spots</strong>
                <ul class="team-analysis-vuln-ul">
                    ${e.blind_spots.map(t=>`<li>${t.description}</li>`).join("")}
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
    `}function V(s){const e=s.interaction_strategy;return e?`
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
                        ${e.framing_that_works.map(n=>`<li>${n}</li>`).join("")}
                    </ul>
                </div>
            `:""}
            ${e.what_to_avoid?.length?`
                <div class="team-analysis-strat-block">
                    <strong class="team-analysis-strat-title-avoid">What to Avoid</strong>
                    <ul class="team-analysis-vuln-ul">
                        ${e.what_to_avoid.map(n=>`<li>${n}</li>`).join("")}
                    </ul>
                </div>
            `:""}
        </div>
    `:""}function G(s){const e=s.early_warning_signs;return e?.length?`
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
                        <p class="team-analysis-warning-p">Indicates: ${n.indicates}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function F(s){const e=s.power_analysis;return e?.length?`
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
<p class="team-analysis-warning-p">${n.assessment}</p>
                    ${n.strategic_implication?`<p class="team-analysis-strategic-p">→ ${n.strategic_implication}</p>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function K(s){return s?.length?`
        <div class="evidence-list">
            ${s.map(e=>`
                <div class="evidence-item">
                    ${e.quote?`<div class="evidence-quote">"${e.quote}"</div>`:""}
                    ${e.observation?`<p class="team-analysis-observation-p">${e.observation}</p>`:""}
                    ${e.timestamp?`<div class="evidence-timestamp">${e.timestamp}</div>`:""}
                </div>
            `).join("")}
        </div>
    `:""}function Y(s){const e={};return s.forEach((n,t)=>{const a=n.contact||{},o=a.name||"Unknown",i=o.split(" ").map(p=>p[0]).join("").substring(0,2).toUpperCase(),l={name:o,initials:i,role:a.role||a.organization||"",avatarUrl:a.avatar_url||a.photo_url};e[`person_${t+1}`]=l,e[`person ${t+1}`]=l,e[`Person_${t+1}`]=l,e[`Person ${t+1}`]=l,e[o.toLowerCase()]=l;const r=o.split(" ")[0];r&&(e[r.toLowerCase()]=l)}),n=>{if(!n)return{name:"Unknown",initials:"?",role:""};const t=n.toLowerCase().trim();return e[t]||{name:n.replace(/_/g," "),initials:n.substring(0,2).toUpperCase(),role:""}}}function f(s,e){const n=e(s);return`
        <div class="person-chip">
            ${n.avatarUrl?`<img class="person-chip-avatar" src="${n.avatarUrl}" alt="${n.name}" />`:`<div class="person-chip-avatar person-chip-initials">${n.initials}</div>`}
            <span class="person-chip-name">${n.name}</span>
        </div>
    `}function O(s,e){const{teamAnalysis:n,profiles:t}=e;if(console.log("[TeamAnalysis] renderTeamDynamics called, teamAnalysis:",n),!n){console.log("[TeamAnalysis] No teamAnalysis data, showing empty state"),s.innerHTML=`
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
        `;return}const a=Y(t||[]);console.log("[TeamAnalysis] Rendering team dynamics with data:",{cohesion:n.cohesion_score,tension:n.tension_level,teamSize:n.team_size,influenceMapLength:n.influence_map?.length});const o=`tension-${n.tension_level||"low"}`,i=n.cohesion_score>=70?"#27ae60":n.cohesion_score>=40?"#f39c12":"#e74c3c",l=n.analysis_data||{},r=l.analysis_date||n.last_analysis_at,p=l.recommendations||[],c=l.risk_factors||[],v=l.communication_flow||{},d=l.dominant_communication_pattern||"";s.innerHTML=`
        <div class="team-dynamics-header">
            <div class="cohesion-card">
                <div class="cohesion-score-circle" style="--score-color: ${i}">
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
                    <span class="meta-value">${r?new Date(r).toLocaleDateString():"N/A"}</span>
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
                <p class="summary-text">${$(d,a)}</p>
            </div>
        `:""}

        ${J(t||[])}

        ${Q(v,a)}

        <div class="team-dynamics-grid">
            ${ee(n.influence_map||[],a)}
            ${se(n.alliances||[],a)}
            ${ne(n.tensions||[],a)}
            ${te(l.power_centers||[],a)}
        </div>

        ${X(c)}
        ${Z(p,a)}
    `}function J(s,e){if(!s?.length)return"";const n=[...s].filter(o=>o.influence_score!==void 0).sort((o,i)=>(i.influence_score||0)-(o.influence_score||0));if(n.length===0)return"";const t=Math.max(...n.map(o=>o.influence_score||0),100),a=["🥇","🥈","🥉"];return`
        <div class="influence-scoreboard-section">
            <div class="scoreboard-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3>Influence Scoreboard</h3>
                <span class="section-badge team-analysis-section-badge-amber">
                    ${n.length} members ranked
                </span>
            </div>
            <div class="scoreboard-list">
                ${n.map((o,i)=>{const l=o.contact||{},r=l.name||o.person_name||"Unknown",p=l.role||l.organization||"",c=l.avatar_url||l.photo_url,v=r.split(" ").map(M=>M[0]).join("").substring(0,2).toUpperCase(),d=o.influence_score||0,m=d/t*100,u=i+1,x=a[i]||"",w=i<3,k=o.risk_tolerance||o.risk_level||"medium",y={low:"#10b981",medium:"#f59e0b",high:"#ef4444"},L=y[k]||y.medium,S=(o.communication_style||o.profile_data?.communication_identity?.dominant_style||"").split(";")[0]?.substring(0,50)||"";return`
                        <div class="scoreboard-item ${w?"top-three":""}">
                            <div class="rank-badge ${w?"rank-"+u:""}">
                                ${x||u}
                            </div>
                            <div class="scoreboard-avatar">
                                ${c?`<img src="${c}" alt="${r}">`:`<span class="avatar-initials">${v}</span>`}
                            </div>
                            <div class="scoreboard-info">
                                <div class="scoreboard-name">${r}</div>
                                <div class="scoreboard-role">${p}</div>
                                ${S?`<div class="scoreboard-style">${S}</div>`:""}
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
                                    <span class="risk-text">${k} risk</span>
                                </div>
                            </div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function Q(s,e){return!s||!s.bottlenecks?.length&&!s.information_brokers?.length?"":`
        <div class="communication-flow-section">
            <div class="flow-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <h3>Communication Flow</h3>
            </div>
            <div class="flow-cards">
                ${s.bottlenecks?.length?`
                    <div class="flow-card bottleneck-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🚧</span>
                            <h4>Bottlenecks</h4>
                        </div>
                        <ul class="flow-list">
                            ${s.bottlenecks.map(n=>`<li>${$(n,e)}</li>`).join("")}
                        </ul>
                    </div>
                `:""}
                ${s.information_brokers?.length?`
                    <div class="flow-card broker-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🔗</span>
                            <h4>Information Brokers</h4>
                        </div>
                        <div class="broker-chips">
                            ${s.information_brokers.map(n=>f(n,e)).join("")}
                        </div>
                        <p class="flow-hint">Key connectors who bridge information across the team</p>
                    </div>
                `:""}
                ${s.central_nodes?.length?`
                    <div class="flow-card central-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">⭐</span>
                            <h4>Central Nodes</h4>
                        </div>
                        <div class="broker-chips">
                            ${s.central_nodes.map(n=>f(n,e)).join("")}
                        </div>
                        <p class="flow-hint">Most connected team members</p>
                    </div>
                `:""}
                ${s.isolated_members?.length?`
                    <div class="flow-card isolated-card">
                        <div class="flow-card-header">
                            <span class="flow-icon">🏝️</span>
                            <h4>Isolated Members</h4>
                        </div>
                        <div class="broker-chips">
                            ${s.isolated_members.map(n=>f(n,e)).join("")}
                        </div>
                        <p class="flow-hint">Members with fewer connections - may need inclusion</p>
                    </div>
                `:""}
            </div>
        </div>
    `}function $(s,e){return s.replace(/Person_(\d+)/g,n=>e(n).name||n)}function X(s){return s?.length?`
        <div class="risk-factors-section">
            <div class="section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Risk Factors</h3>
                <span class="section-badge risk-badge">${s.length} identified</span>
            </div>
            <div class="risk-list">
                ${s.map((e,n)=>`
                    <div class="risk-item">
                        <span class="risk-number">${n+1}</span>
                        <p>${e}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function Z(s,e){return s?.length?`
        <div class="recommendations-section">
            <div class="section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <h3>Recommendations</h3>
                <span class="section-badge rec-badge">${s.length} actions</span>
            </div>
            <div class="recommendations-list">
                ${s.map((n,t)=>`
                    <div class="recommendation-item">
                        <div class="rec-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                            </svg>
                        </div>
                        <div class="rec-content">
                            <span class="rec-number">Action ${t+1}</span>
                            <p>${$(n,e)}</p>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `:""}function ee(s,e){if(!s.length)return"";const n={direct:{color:"#3b82f6",bg:"#eff6ff",icon:"→",desc:"Direct influence through communication and decisions"},technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Influence through technical expertise and knowledge"},political:{color:"#f59e0b",bg:"#fffbeb",icon:"♟",desc:"Influence through organizational dynamics and alliances"},social:{color:"#10b981",bg:"#ecfdf5",icon:"🤝",desc:"Influence through relationships and social capital"},resource:{color:"#ef4444",bg:"#fef2f2",icon:"📊",desc:"Influence through control of resources"}};return`
        <div class="dynamics-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>Influence Map</h3>
                <span class="dynamics-count">${s.length} connections</span>
            </div>
            <div class="dynamics-list">
                ${s.slice(0,10).map(t=>{const a=Math.round((t.strength||.5)*100),o=a>=70?"Strong":a>=40?"Moderate":"Weak",i=(t.influence_type||"direct").toLowerCase(),l=n[i]||n.direct,r=t.evidence&&t.evidence.length>10;return`
                        <div class="dynamics-item influence-item expandable-item" data-item-id="${`inf-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="influence-main-row">
                                <div class="influence-flow">
                                    ${f(t.from_person,e)}
                                    <div class="influence-arrow">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                            <polyline points="12 5 19 12 12 19"/>
                                        </svg>
                                    </div>
                                    ${f(t.to_person,e)}
                                </div>
                                <div class="influence-meta">
                                    <span class="type-badge" style="background: ${l.bg}; color: ${l.color};" title="${l.desc}">
                                        <span class="type-icon">${l.icon}</span>
                                        ${i}
                                    </span>
                                </div>
                                <div class="influence-strength-container">
                                    <div class="strength-value">${a}%</div>
                                    <div class="strength-bar-mini">
                                        <div class="strength-fill-mini" style="width: ${a}%; background: ${l.color};"></div>
                                    </div>
                                    <div class="strength-label">${o}</div>
                                </div>
                                ${r?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${r?`
                                <div class="item-details">
                                    <div class="evidence-text">
                                        <strong>Evidence:</strong> ${$(t.evidence,e)}
                                    </div>
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function se(s,e){if(!s.length)return"";const n={natural:{color:"#10b981",bg:"#ecfdf5",icon:"🌱",desc:"Organic alliance based on shared values and goals"},circumstantial:{color:"#6366f1",bg:"#eef2ff",icon:"🔗",desc:"Alliance formed due to shared circumstances or challenges"},strategic:{color:"#f59e0b",bg:"#fffbeb",icon:"♟",desc:"Deliberate alliance for mutual benefit"},historical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"📜",desc:"Long-standing alliance based on history"}};return`
        <div class="dynamics-card alliance-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Alliances</h3>
                <span class="dynamics-count">${s.length} groups</span>
            </div>
            <div class="dynamics-list">
                ${s.map(t=>{let a=t.members||[];typeof a=="string"&&(a=a.split(/[\s,]+/).filter(d=>d.trim()));const o=Math.round((t.strength||.5)*100),i=o>=70?"Strong bond":o>=40?"Moderate bond":"Weak bond",l=(t.alliance_type||"natural").toLowerCase(),r=n[l]||n.natural,p=t.evidence&&t.evidence.length>10,c=t.shared_values&&t.shared_values.length>0;return`
                        <div class="dynamics-item alliance-item expandable-item" data-item-id="${`all-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="alliance-main-row">
                                <div class="alliance-members">
                                    ${a.map(d=>f(d,e)).join('<span class="alliance-connector">&</span>')}
                                </div>
                                <div class="alliance-meta">
                                    <span class="type-badge" style="background: ${r.bg}; color: ${r.color};" title="${r.desc}">
                                        <span class="type-icon">${r.icon}</span>
                                        ${l}
                                    </span>
                                </div>
                                <div class="alliance-strength-container">
                                    <div class="strength-value alliance-value">${o}%</div>
                                    <div class="strength-bar-mini alliance-bar">
                                        <div class="strength-fill-mini" style="width: ${o}%; background: ${r.color};"></div>
                                    </div>
                                    <div class="strength-label">${i}</div>
                                </div>
                                ${p||c?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${p||c?`
                                <div class="item-details">
                                    ${c?`
                                        <div class="shared-values">
                                            <strong>Shared Values:</strong>
                                            <ul>${t.shared_values.map(d=>`<li>${d}</li>`).join("")}</ul>
                                        </div>
                                    `:""}
                                    ${p?`
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${$(t.evidence,e)}
                                        </div>
                                    `:""}
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function ne(s,e){if(!s.length)return"";const n={technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Disagreements about technical approaches or solutions"},resource:{color:"#f59e0b",bg:"#fffbeb",icon:"📊",desc:"Competition for resources, time, or attention"},political:{color:"#ef4444",bg:"#fef2f2",icon:"♟",desc:"Power dynamics and organizational influence conflicts"},communication:{color:"#3b82f6",bg:"#eff6ff",icon:"💬",desc:"Misunderstandings or communication style clashes"},values:{color:"#10b981",bg:"#ecfdf5",icon:"⚖",desc:"Differences in core values or priorities"}},t={high:{color:"#dc2626",bg:"#fef2f2"},medium:{color:"#f59e0b",bg:"#fffbeb"},low:{color:"#10b981",bg:"#ecfdf5"}};return`
        <div class="dynamics-card tension-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h3>Tensions</h3>
                <span class="dynamics-count">${s.length} identified</span>
            </div>
            <div class="dynamics-list">
                ${s.map(a=>{let o=a.between||[];typeof o=="string"&&(o=o.split(/[\s,]+/).filter(u=>u.trim()));const i=(a.level||"low").toLowerCase(),l=`tension-level-${i}`,r=t[i]||t.low,p=(a.tension_type||"communication").toLowerCase(),c=n[p]||n.communication,v=a.evidence&&a.evidence.length>10,d=a.triggers&&a.triggers.length>0,m=`ten-${Math.random().toString(36).substr(2,9)}`;return`
                        <div class="dynamics-item tension-item expandable-item ${l}" data-item-id="${m}">
                            <div class="tension-main-row">
                                <div class="tension-parties">
                                    ${o.slice(0,2).map(u=>f(u,e)).join('<span class="tension-vs">↔</span>')}
                                </div>
                                <div class="tension-meta">
                                    <span class="type-badge" style="background: ${c.bg}; color: ${c.color};" title="${c.desc}">
                                        <span class="type-icon">${c.icon}</span>
                                        ${p}
                                    </span>
                                </div>
                                <span class="tension-badge" style="background: ${r.bg}; color: ${r.color};">${i}</span>
                                ${v||d?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${v||d?`
                                <div class="item-details">
                                    ${d?`
                                        <div class="triggers-list">
                                            <strong>Triggers:</strong>
                                            <ul>${a.triggers.map(u=>`<li>${u}</li>`).join("")}</ul>
                                        </div>
                                    `:""}
                                    ${v?`
                                        <div class="evidence-text">
                                            <strong>Evidence:</strong> ${$(a.evidence,e)}
                                        </div>
                                    `:""}
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function te(s,e){if(!s.length)return"";const n={technical:{color:"#8b5cf6",bg:"#f5f3ff",icon:"⚙",desc:"Power through technical expertise and knowledge"},formal:{color:"#3b82f6",bg:"#eff6ff",icon:"👔",desc:"Power through official role and authority"},informal:{color:"#f59e0b",bg:"#fffbeb",icon:"💬",desc:"Power through relationships and influence"},social:{color:"#10b981",bg:"#ecfdf5",icon:"🤝",desc:"Power through social connections and trust"},resource:{color:"#ef4444",bg:"#fef2f2",icon:"📊",desc:"Power through control of resources"}};return`
        <div class="dynamics-card power-card">
            <div class="dynamics-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <h3>Power Centers</h3>
                <span class="dynamics-count">${s.length} key players</span>
            </div>
            <div class="dynamics-list">
                ${s.map(t=>{const a=Math.round(t.influence_reach||50),o=(t.power_type||"informal").toLowerCase(),i=n[o]||n.informal,l=t.dependencies&&t.dependencies.length>0;return`
                        <div class="dynamics-item power-item expandable-item" data-item-id="${`pow-${Math.random().toString(36).substr(2,9)}`}">
                            <div class="power-main-row">
                                <div class="power-person">
                                    ${f(t.person,e)}
                                </div>
                                <div class="power-details">
                                    <span class="type-badge" style="background: ${i.bg}; color: ${i.color};" title="${i.desc}">
                                        <span class="type-icon">${i.icon}</span>
                                        ${o}
                                    </span>
                                </div>
                                <div class="power-reach-container">
                                    <div class="strength-value power-value">${a}%</div>
                                    <div class="strength-bar-mini power-bar">
                                        <div class="strength-fill-mini" style="width: ${a}%; background: ${i.color};"></div>
                                    </div>
                                    <div class="strength-label">reach</div>
                                </div>
                                ${l?`<button class="expand-btn" onclick="this.closest('.expandable-item').classList.toggle('expanded')" title="Show details">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>`:""}
                            </div>
                            ${l?`
                                <div class="item-details">
                                    <div class="dependencies-list">
                                        <strong>Power Sources:</strong>
                                        <ul>${t.dependencies.map(p=>`<li>${p}</li>`).join("")}</ul>
                                    </div>
                                </div>
                            `:""}
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function ae(s,e){const{graphData:n,profiles:t}=e;if(console.log("[TeamAnalysis] renderNetworkGraph called, graphData:",n),!n||!n.nodes||!n.nodes.length){console.log("[TeamAnalysis] No graph data, showing empty state"),s.innerHTML=`
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
        `;return}const a={};(t||[]).forEach(o=>{const i=o.contact_id||o.person_id;i&&(a[i]=o)}),console.log("[TeamAnalysis] Rendering network graph with",n.nodes.length,"nodes and",n.edges?.length||0,"edges"),s.innerHTML=`
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
    `,setTimeout(()=>{ce(n,a)},100)}function z(s){return s.split(" ").map(e=>e[0]).join("").substring(0,2).toUpperCase()}function _(s){const e=["#9b59b6","#3498db","#e74c3c","#27ae60","#f39c12","#1abc9c","#e67e22","#34495e"];let n=0;for(let t=0;t<s.length;t++)n=s.charCodeAt(t)+((n<<5)-n);return e[Math.abs(n)%e.length]}function ie(s,e,n,t){const a=z(s),o=_(s),i=80;if(e)return e;const l=`
        <svg xmlns="http://www.w3.org/2000/svg" width="${i}" height="${i}" viewBox="0 0 ${i} ${i}">
            <defs>
                <linearGradient id="grad-${a}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${o};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${oe(o,-30)};stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="${i/2}" cy="${i/2}" r="${i/2-2}" fill="url(#grad-${a})" stroke="white" stroke-width="3"/>
            <text x="${i/2}" y="${i/2+8}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${a}</text>
        </svg>
    `;return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(l)}function oe(s,e){const n=l=>Math.min(255,Math.max(0,l)),t=s.replace("#",""),a=n(parseInt(t.substring(0,2),16)+e),o=n(parseInt(t.substring(2,4),16)+e),i=n(parseInt(t.substring(4,6),16)+e);return`#${a.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}${i.toString(16).padStart(2,"0")}`}function le(s){switch(s){case"influences":return{color:"#3498db",dashes:!1,width:2};case"aligned_with":return{color:"#27ae60",dashes:!1,width:3};case"tension_with":return{color:"#e74c3c",dashes:[5,5],width:2};default:return{color:"#95a5a6",dashes:!1,width:1}}}function ce(s,e){console.log("[TeamAnalysis] initializeNetwork called with",s.nodes?.length,"nodes,",s.edges?.length,"edges");const n=document.getElementById("team-network-graph");if(!n){console.error("[TeamAnalysis] Network container not found!");return}if(b&&(console.log("[TeamAnalysis] Destroying existing network instance"),b.destroy(),b=null),typeof vis>"u"){console.error("[TeamAnalysis] vis.js library not loaded!"),n.innerHTML=`
            <div class="team-analysis-empty-center">
                Network visualization library not loaded
            </div>
        `;return}console.log("[TeamAnalysis] vis.js is available, creating network...");const t=new vis.DataSet(s.nodes.map(i=>{const l=e[i.id]||{},r=l.contact||{},p=i.label||r.name||"Unknown",c=r.avatar_url||r.photo_url,v=r.role||i.properties?.role||"",d=l.influence_score||i.properties?.influenceScore||50,m=30+d/10;return{id:i.id,label:p,shape:c?"circularImage":"image",image:ie(p,c),size:m,borderWidth:3,borderWidthSelected:5,color:{border:_(p),highlight:{border:"#f39c12"},hover:{border:"#f39c12"}},font:{size:14,color:"var(--color-text)",face:"Arial",strokeWidth:3,strokeColor:"var(--color-surface)"},_profile:l,_role:v,_influenceScore:d}})),a=new vis.DataSet(s.edges.map(i=>{const l=le(i.label||i.relationship_type);return{from:i.from,to:i.to,label:"",width:l.width,dashes:l.dashes,color:{color:l.color,highlight:l.color,hover:l.color,opacity:.8},arrows:i.label==="influences"?{to:{enabled:!0,scaleFactor:.8}}:void 0,smooth:{type:"curvedCW",roundness:.2},title:re(i.label)}})),o={nodes:{shapeProperties:{useBorderWithImage:!0,interpolation:!1},shadow:{enabled:!0,color:"rgba(0,0,0,0.2)",size:10,x:3,y:3}},edges:{font:{size:11,align:"middle",color:"var(--text-secondary)"},smooth:{type:"curvedCW",roundness:.2},hoverWidth:2,selectionWidth:3},physics:{enabled:!0,stabilization:{enabled:!0,iterations:200},barnesHut:{gravitationalConstant:-3e3,springLength:200,springConstant:.04,damping:.3}},interaction:{hover:!0,tooltipDelay:100,navigationButtons:!0,keyboard:!0,zoomView:!0},layout:{improvedLayout:!0}};b=new vis.Network(n,{nodes:t,edges:a},o),b.on("click",i=>{if(i.nodes.length>0){const l=i.nodes[0],r=t.get(l);de(r,e[l])}else ve()}),b.on("hoverNode",()=>{n.classList.add("gm-cursor-pointer"),n.classList.remove("gm-cursor-default")}),b.on("blurNode",()=>{n.classList.remove("gm-cursor-pointer"),n.classList.add("gm-cursor-default")})}function re(s){return{influences:"→ Influences",aligned_with:"🤝 Alliance",tension_with:"⚡ Tension"}[s]||s}function de(s,e){const n=document.getElementById("network-info-panel");if(!n)return;const t=e?.contact||{},a=s.label||"Unknown",o=t.role||s._role||"",i=t.organization||"",l=e?.influence_score||s._influenceScore||0,r=e?.communication_style||"Unknown",p=e?.dominant_motivation||"Unknown",c=z(a),v=t.avatar_url||t.photo_url;n.innerHTML=`
        <div class="node-detail-card">
            <div class="node-detail-header">
                ${v?`<img class="node-avatar" src="${v}" alt="${a}" />`:`<div class="node-avatar node-initials" style="background: ${_(a)}">${c}</div>`}
                <div class="node-info">
                    <h3>${a}</h3>
                    ${o?`<p class="node-role">${o}</p>`:""}
                    ${i?`<p class="node-org">${i}</p>`:""}
                </div>
            </div>
            <div class="node-metrics">
                <div class="node-metric">
                    <span class="metric-label">Influence</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${l}%; background: #9b59b6;"></div>
                    </div>
                    <span class="metric-value">${l}%</span>
                </div>
            </div>
            <div class="node-traits">
                <div class="trait-item">
                    <span class="trait-label">Communication</span>
                    <span class="trait-value">${r}</span>
                </div>
                <div class="trait-item">
                    <span class="trait-label">Motivation</span>
                    <span class="trait-value">${p}</span>
                </div>
            </div>
        </div>
    `}function ve(){const s=document.getElementById("network-info-panel");s&&(s.innerHTML=`
        <div class="info-panel-placeholder">
            <p>Click on a person to see details</p>
        </div>
    `)}async function pe(s){const e=s.querySelector("#people-list-container");if(e)try{const n=await C.get("/api/contacts"),t=n.data?.contacts||n.data?.people||[];if(t.length===0){e.innerHTML=`
                <p class="team-analysis-people-loading">
                    No people found. Process some transcripts first to extract participants.
                </p>
            `;return}e.innerHTML=`
            <div class="gm-text-left">
                <p class="team-analysis-intro-p">
                    Select a person to analyze (${t.length} available):
                </p>
                <div class="team-analysis-people-list">
                    ${t.slice(0,20).map(a=>`
                        <button type="button" class="btn btn-secondary analyze-person-btn team-analysis-person-row"
                                data-person-id="${a.id}"
                                data-person-name="${a.name||"Unknown"}">
                            <span class="team-analysis-person-name">${a.name||"Unknown"}</span>
                            <span class="team-analysis-person-role">${a.role||a.organization||""}</span>
                        </button>
                    `).join("")}
                </div>
                ${t.length>20?`<p class="team-analysis-people-truncate">Showing first 20 of ${t.length} people</p>`:""}
            </div>
        `,e.querySelectorAll(".analyze-person-btn").forEach(a=>{a.addEventListener("click",async()=>{const o=a.dataset.personId,i=a.dataset.personName;if(o){h.info(`Analyzing ${i}...`),a.disabled=!0,a.innerHTML="<span>Analyzing...</span>";try{await g.analyzeProfile(o,{forceReanalysis:!0}),h.success(`Profile created for ${i}`),await g.loadProfiles()}catch(l){h.error(`Failed to analyze: ${l.message||"Unknown error"}`),a.disabled=!1,a.innerHTML=`<span class="team-analysis-btn-person-name">${i}</span>`}}})})}catch{e.innerHTML=`
            <p class="team-analysis-graph-error">
                Failed to load people. Please try again.
            </p>
        `}}export{he as createTeamAnalysis};
//# sourceMappingURL=TeamAnalysisPage-CTmup7Rb.js.map
