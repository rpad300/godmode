import{c as r,o as d,j as c,k as v}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function T(e={}){const t=r("div",{className:"teams-panel"});t.innerHTML=`
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
  `;const a=t.querySelector("#add-team-btn");return a&&d(a,"click",()=>{c({mode:"create",onSave:()=>l(t,e)})}),l(t,e),t}async function l(e,t){const a=e.querySelector("#teams-content");a.innerHTML='<div class="loading">Loading...</div>';try{const n=await v.getAll();p(a,n,t),b(e,n.length)}catch{a.innerHTML='<div class="error">Failed to load teams</div>'}}function p(e,t,a){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No teams yet</p>
        <button class="btn btn-primary" id="empty-add-btn">Create Team</button>
      </div>
    `;const n=e.querySelector("#empty-add-btn");n&&d(n,"click",()=>{c({mode:"create"})});return}e.innerHTML=`
    <div class="teams-grid">
      ${t.map(n=>u(n)).join("")}
    </div>
  `,e.querySelectorAll(".team-card").forEach(n=>{d(n,"click",()=>{const o=n.getAttribute("data-id"),i=t.find(m=>String(m.id)===o);i&&(a.onTeamClick?a.onTeamClick(i):c({mode:"edit",team:i,onSave:()=>l(n.closest(".teams-panel"),a)}))})})}function u(e){const t=e.memberCount||0,a=e.memberDetails?.find(n=>n.isLead);return`
    <div class="team-card" data-id="${e.id}">
      <div class="team-header">
        <div class="team-color" style="--team-color: ${e.color||"#6366f1"}"></div>
        <div class="team-name">${s(e.name)}</div>
        ${e.team_type?`<span class="team-type">${e.team_type}</span>`:""}
      </div>
      ${e.description?`<div class="team-description">${s(e.description)}</div>`:""}
      <div class="team-stats">
        <span class="member-count">${t} member${t!==1?"s":""}</span>
        ${a?`<span class="team-lead">Lead: ${s(a.name)}</span>`:""}
      </div>
      ${e.memberDetails&&e.memberDetails.length>0?`
        <div class="team-members-preview">
          ${e.memberDetails.slice(0,5).map(n=>`
            <div class="member-avatar" title="${s(n.name)}">
              ${f(n.name)}
            </div>
          `).join("")}
          ${e.memberDetails.length>5?`<div class="more-members">+${e.memberDetails.length-5}</div>`:""}
        </div>
      `:""}
    </div>
  `}function b(e,t){const a=e.querySelector("#teams-count");a&&(a.textContent=String(t))}function f(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function s(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}export{T as createTeamsPanel};
//# sourceMappingURL=TeamsPage-BWparXHF.js.map
