const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ProjectAssignmentModal-Cqm9Ud5b.js","assets/main-YNVvHMLj.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-CM94QBLC.css"])))=>i.map(i=>d[i]);
import{d as h,c as k,e as y,i as w,o as d,j as M,k as $,l as S,m as A,t as p,n as x,p as v,r as I,_,s as q,q as T,u as z}from"./main-YNVvHMLj.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const g="krisp-manager-modal";let a={activeTab:"transcripts",transcripts:[],quarantine:[],mappings:[],loading:!1,selectedTranscript:null,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:"",domain:""}},m=null;async function Y(e="transcripts"){a={activeTab:e,transcripts:[],quarantine:[],mappings:[],loading:!1,selectedTranscript:null,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:"",domain:""}};const t=document.querySelector(`[data-modal-id="${g}"]`);t&&t.remove();const i=k("div",{className:"krisp-manager"});m=i,i.innerHTML=`
    <style>
      .krisp-manager {
        min-height: 450px;
        padding-bottom: 16px;
      }
      .krisp-tabs {
        display: flex;
        gap: 4px;
        padding: 0 16px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        margin-bottom: 16px;
      }
      .krisp-tab {
        padding: 12px 20px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #64748b);
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: all 0.2s;
      }
      .krisp-tab:hover {
        color: var(--text-primary, #1e293b);
      }
      .krisp-tab.active {
        color: var(--primary, #e11d48);
        border-bottom-color: var(--primary, #e11d48);
      }
      .krisp-tab .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        margin-left: 8px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 10px;
        background: var(--bg-tertiary, #f1f5f9);
        color: var(--text-secondary, #64748b);
      }
      .krisp-tab.active .badge {
        background: var(--primary, #e11d48);
        color: white;
      }
      .krisp-tab .badge.warning {
        background: #fef3c7;
        color: #92400e;
      }
      .krisp-content {
        padding: 0 16px 16px;
      }
      .krisp-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .krisp-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .krisp-item:hover {
        background: var(--bg-tertiary, #f1f5f9);
      }
      .krisp-item-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--bg-tertiary, #f1f5f9);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .krisp-item-icon svg {
        width: 20px;
        height: 20px;
        color: var(--text-secondary, #64748b);
      }
      .krisp-item-content {
        flex: 1;
        min-width: 0;
      }
      .krisp-item-title {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .krisp-item-meta {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        display: flex;
        gap: 12px;
        margin-top: 2px;
      }
      .krisp-item-status {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
      }
      .status-pending { background: #dbeafe; color: #1e40af; }
      .status-quarantine { background: #fef3c7; color: #92400e; }
      .status-ambiguous { background: #fed7aa; color: #9a3412; }
      .status-matched { background: #cffafe; color: #0e7490; }
      .status-processed { background: #dcfce7; color: #166534; }
      .status-failed { background: #fecaca; color: #991b1b; }
      .status-skipped { background: #e2e8f0; color: #475569; }
      .krisp-item-actions {
        display: flex;
        gap: 8px;
      }
      .krisp-item-actions button {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 6px;
        border: 1px solid var(--border-color, #e2e8f0);
        background: white;
        cursor: pointer;
        transition: all 0.2s;
      }
      .krisp-item-actions button:hover {
        background: var(--bg-secondary, #f8fafc);
      }
      .krisp-item-actions button.primary {
        background: var(--primary, #e11d48);
        color: white;
        border-color: var(--primary, #e11d48);
      }
      .krisp-item-actions button.primary:hover {
        opacity: 0.9;
      }
      .krisp-empty {
        text-align: center;
        padding: 48px 16px;
        color: var(--text-secondary, #64748b);
      }
      .krisp-empty svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      .krisp-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px;
      }
      .mapping-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
      }
      .mapping-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mapping-arrow {
        color: var(--text-tertiary, #94a3b8);
      }
      .mapping-speaker {
        font-family: monospace;
        background: var(--bg-tertiary, #f1f5f9);
        padding: 4px 8px;
        border-radius: 4px;
      }
      .mapping-contact {
        font-weight: 500;
      }
      .mapping-badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #dbeafe;
        color: #1e40af;
      }
      [data-theme="dark"] .krisp-item,
      [data-theme="dark"] .mapping-item {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .krisp-item:hover {
        background: rgba(30,41,59,0.8);
      }
      [data-theme="dark"] .krisp-item-actions button {
        background: rgba(30,41,59,0.8);
        border-color: rgba(255,255,255,0.1);
      }
      
      /* Import tab styles */
      .import-filters {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .import-filters .filter-row {
        display: flex;
        gap: 12px;
        grid-column: 1 / -1;
      }
      .import-filters label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary, #64748b);
      }
      .import-filters input {
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        font-size: 14px;
        background: white;
      }
      .import-filters .search-row {
        display: flex;
        gap: 12px;
        align-items: flex-end;
        grid-column: 1 / -1;
      }
      .import-filters .search-row label {
        flex: 1;
      }
      .import-filters .search-btn {
        padding: 8px 20px;
        background: var(--primary, #e11d48);
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
      }
      .import-filters .search-btn:hover {
        opacity: 0.9;
      }
      .import-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        margin-bottom: 8px;
      }
      .import-header label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
      }
      .import-header .count {
        color: var(--text-secondary, #64748b);
        font-size: 13px;
      }
      .import-meeting {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .import-meeting:hover {
        background: var(--bg-tertiary, #f1f5f9);
      }
      .import-meeting.selected {
        background: rgba(225, 29, 72, 0.05);
        border: 1px solid rgba(225, 29, 72, 0.2);
      }
      .import-meeting.imported {
        opacity: 0.6;
      }
      .import-meeting input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      .import-meeting-content {
        flex: 1;
        min-width: 0;
      }
      .import-meeting-title {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .import-meeting-title .imported-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #dcfce7;
        color: #166534;
      }
      .import-meeting-meta {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        margin-top: 2px;
      }
      .import-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-top: 1px solid var(--border-color, #e2e8f0);
        margin-top: 16px;
      }
      .import-footer .selected-count {
        font-size: 14px;
        color: var(--text-secondary, #64748b);
      }
      .import-btn {
        padding: 10px 24px;
        background: var(--primary, #e11d48);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .import-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .import-btn:not(:disabled):hover {
        opacity: 0.9;
      }
      .import-note {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #92400e;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .import-note svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      [data-theme="dark"] .import-filters {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .import-filters input {
        background: rgba(30,41,59,0.8);
        color: white;
        border-color: rgba(255,255,255,0.1);
      }
      [data-theme="dark"] .import-meeting {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .import-meeting.selected {
        background: rgba(225,29,72,0.1);
        border-color: rgba(225,29,72,0.3);
      }
      [data-theme="dark"] .import-note {
        background: rgba(251,191,36,0.1);
        border-color: rgba(251,191,36,0.3);
        color: #fcd34d;
      }
    </style>
    
    <div class="krisp-tabs">
      <button class="krisp-tab ${e==="transcripts"?"active":""}" data-tab="transcripts">
        Transcripts
        <span class="badge" id="transcripts-count">0</span>
      </button>
      <button class="krisp-tab ${e==="quarantine"?"active":""}" data-tab="quarantine">
        Quarantine
        <span class="badge warning" id="quarantine-count">0</span>
      </button>
      <button class="krisp-tab ${e==="mappings"?"active":""}" data-tab="mappings">
        Mappings
        <span class="badge" id="mappings-count">0</span>
      </button>
      <button class="krisp-tab ${e==="import"?"active":""}" data-tab="import">
        Import
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 6px;">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
      </button>
    </div>
    
    <div class="krisp-content" id="krisp-content">
      <div class="krisp-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;const r=y({id:g,title:"Krisp Transcripts",content:i,size:"xl"});document.body.appendChild(r),w(g),j(i),await c("transcripts")}function j(e){const t=e.querySelectorAll(".krisp-tab");t.forEach(i=>{d(i,"click",async()=>{const r=i.getAttribute("data-tab");r!==a.activeTab&&(t.forEach(s=>s.classList.remove("active")),i.classList.add("active"),a.activeTab=r,await c(r))})})}async function c(e){if(!m)return;const t=m.querySelector("#krisp-content");if(t){t.innerHTML='<div class="krisp-loading"><div class="loading-spinner"></div></div>',a.loading=!0;try{switch(e){case"transcripts":await L(t);break;case"quarantine":await C(t);break;case"mappings":await E(t);break;case"import":await R(t);break}}catch(i){console.error("[KrispManager] Error loading tab:",i),t.innerHTML='<div class="krisp-empty"><p>Failed to load. Please try again.</p></div>'}finally{a.loading=!1}}}async function L(e){const t=await S({limit:50});if(a.transcripts=t,b("transcripts-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Configure your Krisp webhook in Profile &gt; Integrations</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>H(i)).join("")}</div>`,F(e)}async function C(e){const t=await $();if(a.quarantine=t,b("quarantine-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No transcripts in quarantine</p>
        <p style="font-size: 12px; margin-top: 8px;">All speakers are identified correctly</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>P(i)).join("")}</div>`,B(e)}async function E(e){const t=await M();if(a.mappings=t,b("mappings-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        <p>No speaker mappings</p>
        <p style="font-size: 12px; margin-top: 8px;">Mappings are created when you manually link speakers to contacts</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>D(i)).join("")}</div>`,K(e)}function H(e){const{label:t,color:i}=x(e.status),r=v(e.duration_minutes),s=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-",n=e.speakers?.length||0;return`
    <div class="krisp-item" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(e.display_title||e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${s}</span>
          <span>${r}</span>
          <span>${n} speakers</span>
          ${e.projects?.name?`<span>${l(e.projects.name)}</span>`:""}
        </div>
      </div>
      <span class="krisp-item-status status-${e.status}">${t}</span>
    </div>
  `}function P(e){const{label:t}=x(e.status),i=v(e.duration_minutes),r=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-";return`
    <div class="krisp-item" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${r}</span>
          <span>${i}</span>
          <span style="color: #f59e0b;">${e.status_reason||t}</span>
        </div>
      </div>
      <div class="krisp-item-actions">
        <button class="retry-btn" data-id="${e.id}" title="Retry processing">Retry</button>
        <button class="assign-btn primary" data-id="${e.id}" title="Assign to project">Assign</button>
        <button class="skip-btn" data-id="${e.id}" title="Discard">Skip</button>
      </div>
    </div>
  `}function D(e){return`
    <div class="mapping-item" data-id="${e.id}">
      <div class="mapping-info">
        <span class="mapping-speaker">${l(e.speaker_name)}</span>
        <span class="mapping-arrow">→</span>
        <span class="mapping-contact">${l(e.contacts?.name||"Unknown")}</span>
        ${e.is_global?'<span class="mapping-badge">Global</span>':""}
      </div>
      <button class="delete-mapping-btn" data-id="${e.id}" title="Remove mapping">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  `}function F(e){e.querySelectorAll(".krisp-item").forEach(t=>{d(t,"click",()=>{const i=t.getAttribute("data-id"),r=a.transcripts.find(s=>s.id===i);r&&N(r)})})}function B(e){e.querySelectorAll(".retry-btn").forEach(t=>{d(t,"click",async i=>{i.stopPropagation();const r=t.getAttribute("data-id");if(!r)return;t.textContent="...",await I(r)?(p.success("Retry queued"),await c("quarantine")):(p.error("Retry failed"),t.textContent="Retry")})}),e.querySelectorAll(".assign-btn").forEach(t=>{d(t,"click",async i=>{i.stopPropagation();const r=t.getAttribute("data-id"),s=a.quarantine.find(n=>n.id===r);if(s){const{showProjectAssignmentModal:n}=await _(async()=>{const{showProjectAssignmentModal:o}=await import("./ProjectAssignmentModal-Cqm9Ud5b.js");return{showProjectAssignmentModal:o}},__vite__mapDeps([0,1,2,3]));n({transcript:s,onAssign:async()=>{await c("quarantine")}})}})}),e.querySelectorAll(".skip-btn").forEach(t=>{d(t,"click",async i=>{i.stopPropagation();const r=t.getAttribute("data-id");if(!r||!confirm("Are you sure you want to skip this transcript?"))return;await q(r,"Manually skipped")?(p.success("Transcript skipped"),await c("quarantine")):p.error("Failed to skip")})})}function K(e){e.querySelectorAll(".delete-mapping-btn").forEach(t=>{d(t,"click",async i=>{i.stopPropagation();const r=t.getAttribute("data-id");if(!r||!confirm("Are you sure you want to delete this mapping?"))return;await A(r)?(p.success("Mapping deleted"),await c("mappings")):p.error("Failed to delete")})})}function N(e){const t=[`Title: ${e.display_title||e.krisp_title}`,`Status: ${e.status}`,`Speakers: ${e.speakers?.join(", ")||"None"}`,`Project: ${e.projects?.name||"Not assigned"}`].join(`
`);alert(t)}function b(e,t){if(!m)return;const i=m.querySelector(`#${e}`);i&&(i.textContent=String(t))}async function R(e){e.innerHTML=`
    <div class="import-note">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <strong>Import from Krisp</strong><br>
        Use the search filters below to find meetings in your Krisp account. 
        The search uses the Krisp MCP - make sure you have it connected in Cursor.
      </div>
    </div>
    
    <div class="import-filters">
      <label>
        From Date
        <input type="date" id="import-after" value="${a.importFilters.after}" />
      </label>
      <label>
        To Date
        <input type="date" id="import-before" value="${a.importFilters.before}" />
      </label>
      <label>
        Participant Domain
        <input type="text" id="import-domain" placeholder="e.g. company.com" value="${a.importFilters.domain}" />
      </label>
      <div class="search-row">
        <label style="flex: 1;">
          Search Text
          <input type="text" id="import-search" placeholder="Search by title, content, attendees..." value="${a.importFilters.search}" />
        </label>
        <button class="search-btn" id="import-search-btn">
          Search Krisp
        </button>
      </div>
    </div>
    
    <div id="import-results">
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <p>Use the filters above to search for meetings</p>
        <p style="font-size: 12px; margin-top: 8px;">Tip: Set a date range to find recent meetings</p>
      </div>
    </div>
  `,U(e)}function U(e){const t=e.querySelector("#import-search-btn");t&&d(t,"click",()=>{const r=e.querySelector("#import-after"),s=e.querySelector("#import-before"),n=e.querySelector("#import-domain"),o=e.querySelector("#import-search");a.importFilters={after:r?.value||"",before:s?.value||"",domain:n?.value||"",search:o?.value||""},O(e)});const i=e.querySelector("#import-search");i&&d(i,"keydown",r=>{r.key==="Enter"&&t?.dispatchEvent(new Event("click"))})}function O(e){const t=e.querySelector("#import-results");if(!t)return;const{after:i,before:r,domain:s,search:n}=a.importFilters,o={};i&&(o.after=i),r&&(o.before=r),s&&(o.participant_domains=[s]),n&&(o.search=n),o.limit=50,o.fields=["name","date","speakers","attendees","meeting_notes"];const f=JSON.stringify(o,null,2);t.innerHTML=`
    <div style="background: var(--bg-secondary, #f8fafc); border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px;">Search Krisp Meetings</h4>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        To search your Krisp meetings, use the Krisp MCP in Cursor. Copy the command below:
      </p>
      <div style="background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto;">
CallMcpTool({
  server: "user-Krisp",
  toolName: "search_meetings",
  arguments: ${f}
})</div>
      <p style="font-size: 12px; color: var(--text-secondary); margin-top: 12px;">
        After getting the results, paste the meeting data below to import:
      </p>
      <textarea id="import-paste-data" placeholder="Paste the search_meetings results here..." style="width: 100%; min-height: 120px; margin-top: 8px; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
      <div style="display: flex; gap: 12px; margin-top: 12px;">
        <button id="import-parse-btn" style="padding: 8px 16px; background: var(--primary, #e11d48); color: white; border: none; border-radius: 6px; cursor: pointer;">
          Parse Meetings
        </button>
      </div>
    </div>
  `,Q(e)}function Q(e){const t=e.querySelector("#import-parse-btn");t&&d(t,"click",async()=>{const i=e.querySelector("#import-paste-data");if(!i?.value.trim()){p.error("Please paste the meeting data first");return}try{const r=JSON.parse(i.value),s=V(r);if(s.length===0){p.error("No meetings found in the pasted data");return}const n=s.map(f=>f.meeting_id),o=await T(n);a.importedIds=new Set(o),a.mcpMeetings=s,a.selectedMeetings=new Set,u(e),p.success(`Found ${s.length} meetings`)}catch(r){console.error("[KrispManager] Parse error:",r),p.error("Failed to parse meeting data. Make sure it's valid JSON.")}})}function V(e){if(Array.isArray(e))return e.filter(t=>t.meeting_id);if(typeof e=="object"&&e!==null){const t=e;if(Array.isArray(t.meetings))return t.meetings.filter(i=>i.meeting_id);if(Array.isArray(t.results))return t.results.filter(i=>i.meeting_id);if(Array.isArray(t.data))return t.data.filter(i=>i.meeting_id);if(t.meeting_id)return[t]}return[]}function u(e){const t=e.querySelector("#import-results");if(!t)return;const i=a.mcpMeetings,r=a.selectedMeetings.size,s=i.filter(n=>!a.importedIds.has(n.meeting_id)).length;t.innerHTML=`
    <div class="import-header">
      <label>
        <input type="checkbox" id="select-all" ${r===s&&s>0?"checked":""} />
        Select All (${s} available)
      </label>
      <span class="count">Showing ${i.length} meetings</span>
    </div>
    
    <div class="krisp-list">
      ${i.map(n=>J(n)).join("")}
    </div>
    
    <div class="import-footer">
      <span class="selected-count">${r} selected</span>
      <button class="import-btn" id="import-selected-btn" ${r===0?"disabled":""}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import ${r} Meeting${r!==1?"s":""}
      </button>
    </div>
  `,G(e)}function J(e){const t=a.importedIds.has(e.meeting_id),i=a.selectedMeetings.has(e.meeting_id),r=e.speakers?.join(", ")||e.attendees?.join(", ")||"No participants",s=e.date?new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";return`
    <div class="import-meeting ${i?"selected":""} ${t?"imported":""}" data-id="${e.meeting_id}">
      <input type="checkbox" ${i?"checked":""} ${t?"disabled":""} />
      <div class="import-meeting-content">
        <div class="import-meeting-title">
          ${l(e.name||"Untitled Meeting")}
          ${t?'<span class="imported-badge">Imported</span>':""}
        </div>
        <div class="import-meeting-meta">
          ${s} · ${r}
        </div>
      </div>
    </div>
  `}function G(e){const t=e.querySelector("#select-all");t&&d(t,"change",()=>{t.checked?a.mcpMeetings.forEach(s=>{a.importedIds.has(s.meeting_id)||a.selectedMeetings.add(s.meeting_id)}):a.selectedMeetings.clear(),u(e)}),e.querySelectorAll(".import-meeting").forEach(r=>{d(r,"click",s=>{const n=r.getAttribute("data-id");!n||a.importedIds.has(n)||(a.selectedMeetings.has(n)?a.selectedMeetings.delete(n):a.selectedMeetings.add(n),u(e))})});const i=e.querySelector("#import-selected-btn");i&&d(i,"click",async()=>{if(a.selectedMeetings.size===0)return;i.setAttribute("disabled","true"),i.innerHTML='<span class="loading-spinner" style="width: 16px; height: 16px;"></span> Importing...';const r=a.mcpMeetings.filter(n=>a.selectedMeetings.has(n.meeting_id)),s=await z(r);s?(p.success(`Imported ${s.imported} meetings${s.skipped>0?`, ${s.skipped} skipped`:""}`),s.results.forEach(n=>{n.success&&a.importedIds.add(n.meetingId)}),a.selectedMeetings.clear(),u(e)):(p.error("Import failed"),i.removeAttribute("disabled"),i.innerHTML=`Import ${a.selectedMeetings.size} Meetings`)})}function l(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Z(){h(g)}export{Z as closeKrispManager,Y as showKrispManager};
//# sourceMappingURL=KrispManager-CDi5gf3a.js.map
