const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ProjectAssignmentModal-B32M4sHl.js","assets/main-CABUEUPe.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-CM94QBLC.css"])))=>i.map(i=>d[i]);
import{d as h,c as y,e as w,i as M,o,j as $,k as _,l as S,m as A,n as I,t as p,p as k,q as x,r as q,_ as T,s as j,u as z}from"./main-CABUEUPe.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const u="krisp-manager-modal";let s={activeTab:"transcripts",transcripts:[],quarantine:[],mappings:[],loading:!1,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:""}},g=null;async function W(e="transcripts"){s={activeTab:e,transcripts:[],quarantine:[],mappings:[],loading:!1,selectedTranscript:null,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:"",domain:""}};const t=document.querySelector(`[data-modal-id="${u}"]`);t&&t.remove();const i=y("div",{className:"krisp-manager"});g=i,i.innerHTML=`
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
      .import-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        padding: 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
      }
      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
      }
      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--primary, #e11d48);
      }
      .stat-label {
        font-size: 11px;
        color: var(--text-secondary, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .import-meeting-summary {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        margin-top: 4px;
        line-height: 1.4;
      }
      [data-theme="dark"] .import-stats {
        background: rgba(255,255,255,0.03);
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
  `;const a=w({id:u,title:"Krisp Transcripts",content:i,size:"xl"});document.body.appendChild(a),M(u),L(i),await c("transcripts")}function L(e){const t=e.querySelectorAll(".krisp-tab");t.forEach(i=>{o(i,"click",async()=>{const a=i.getAttribute("data-tab");a!==s.activeTab&&(t.forEach(r=>r.classList.remove("active")),i.classList.add("active"),s.activeTab=a,await c(a))})})}async function c(e){if(!g)return;const t=g.querySelector("#krisp-content");if(t){t.innerHTML='<div class="krisp-loading"><div class="loading-spinner"></div></div>',s.loading=!0;try{switch(e){case"transcripts":await C(t);break;case"quarantine":await E(t);break;case"mappings":await H(t);break;case"import":await v(t);break}}catch(i){console.error("[KrispManager] Error loading tab:",i),t.innerHTML='<div class="krisp-empty"><p>Failed to load. Please try again.</p></div>'}finally{s.loading=!1}}}async function C(e){const t=await A({limit:50});if(s.transcripts=t,f("transcripts-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Configure your Krisp webhook in Profile &gt; Integrations</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>D(i)).join("")}</div>`,P(e)}async function E(e){const t=await S();if(s.quarantine=t,f("quarantine-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No transcripts in quarantine</p>
        <p style="font-size: 12px; margin-top: 8px;">All speakers are identified correctly</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>B(i)).join("")}</div>`,N(e)}async function H(e){const t=await _();if(s.mappings=t,f("mappings-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        <p>No speaker mappings</p>
        <p style="font-size: 12px; margin-top: 8px;">Mappings are created when you manually link speakers to contacts</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>F(i)).join("")}</div>`,K(e)}function D(e){const{label:t,color:i}=k(e.status),a=x(e.duration_minutes),r=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-",n=e.speakers?.length||0;return`
    <div class="krisp-item" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(e.display_title||e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${r}</span>
          <span>${a}</span>
          <span>${n} speakers</span>
          ${e.projects?.name?`<span>${l(e.projects.name)}</span>`:""}
        </div>
      </div>
      <span class="krisp-item-status status-${e.status}">${t}</span>
    </div>
  `}function B(e){const{label:t}=k(e.status),i=x(e.duration_minutes),a=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-";return`
    <div class="krisp-item" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${a}</span>
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
  `}function F(e){return`
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
  `}function P(e){e.querySelectorAll(".krisp-item").forEach(t=>{o(t,"click",()=>{const i=t.getAttribute("data-id"),a=s.transcripts.find(r=>r.id===i);a&&R(a)})})}function N(e){e.querySelectorAll(".retry-btn").forEach(t=>{o(t,"click",async i=>{i.stopPropagation();const a=t.getAttribute("data-id");if(!a)return;t.textContent="...",await q(a)?(p.success("Retry queued"),await c("quarantine")):(p.error("Retry failed"),t.textContent="Retry")})}),e.querySelectorAll(".assign-btn").forEach(t=>{o(t,"click",async i=>{i.stopPropagation();const a=t.getAttribute("data-id"),r=s.quarantine.find(n=>n.id===a);if(r){const{showProjectAssignmentModal:n}=await T(async()=>{const{showProjectAssignmentModal:m}=await import("./ProjectAssignmentModal-B32M4sHl.js");return{showProjectAssignmentModal:m}},__vite__mapDeps([0,1,2,3]));n({transcript:r,onAssign:async()=>{await c("quarantine")}})}})}),e.querySelectorAll(".skip-btn").forEach(t=>{o(t,"click",async i=>{i.stopPropagation();const a=t.getAttribute("data-id");if(!a||!confirm("Are you sure you want to skip this transcript?"))return;await j(a,"Manually skipped")?(p.success("Transcript skipped"),await c("quarantine")):p.error("Failed to skip")})})}function K(e){e.querySelectorAll(".delete-mapping-btn").forEach(t=>{o(t,"click",async i=>{i.stopPropagation();const a=t.getAttribute("data-id");if(!a||!confirm("Are you sure you want to delete this mapping?"))return;await I(a)?(p.success("Mapping deleted"),await c("mappings")):p.error("Failed to delete")})})}function R(e){const t=[`Title: ${e.display_title||e.krisp_title}`,`Status: ${e.status}`,`Speakers: ${e.speakers?.join(", ")||"None"}`,`Project: ${e.projects?.name||"Not assigned"}`].join(`
`);alert(t)}function f(e,t){if(!g)return;const i=g.querySelector(`#${e}`);i&&(i.textContent=String(t))}async function v(e){const t=await $({limit:100,showImported:!0,startDate:s.importFilters.after||void 0,endDate:s.importFilters.before||void 0,search:s.importFilters.search||void 0}),i=t?.stats||{total_available:0,total_imported:0,total_pending:0,last_sync:null},a=i.last_sync?new Date(i.last_sync).toLocaleString():"Never";e.innerHTML=`
    <div class="import-note">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <strong>Import from Krisp</strong><br>
        Meetings synced from Krisp are shown below. To sync new meetings, ask Cursor: 
        <em>"sincroniza as meetings do Krisp"</em>
      </div>
    </div>
    
    <div class="import-stats">
      <div class="stat-item">
        <span class="stat-value">${i.total_available}</span>
        <span class="stat-label">Available</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${i.total_imported}</span>
        <span class="stat-label">Imported</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${i.total_pending}</span>
        <span class="stat-label">Pending</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" style="font-size: 12px;">${a}</span>
        <span class="stat-label">Last Sync</span>
      </div>
    </div>
    
    <div class="import-filters">
      <label>
        From Date
        <input type="date" id="import-after" value="${s.importFilters.after}" />
      </label>
      <label>
        To Date
        <input type="date" id="import-before" value="${s.importFilters.before}" />
      </label>
      <div class="search-row">
        <label style="flex: 1;">
          Search
          <input type="text" id="import-search" placeholder="Search by title..." value="${s.importFilters.search}" />
        </label>
        <button class="search-btn" id="import-filter-btn">
          Filter
        </button>
      </div>
    </div>
    
    <div id="import-results">
      ${U(t?.meetings||[])}
    </div>
  `,t?.meetings&&(s.mcpMeetings=t.meetings.map(r=>({meeting_id:r.krisp_meeting_id,name:r.meeting_name,date:r.meeting_date,speakers:r.speakers,attendees:r.attendees,meeting_notes:{key_points:r.key_points,action_items:r.action_items}})),s.importedIds=new Set(t.meetings.filter(r=>r.is_imported).map(r=>r.krisp_meeting_id))),Q(e)}function U(e){return e.length===0?`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No meetings synced yet</p>
        <p style="font-size: 12px; margin-top: 8px;">
          Ask Cursor to sync: <em>"sincroniza as meetings do Krisp de [data] a [data]"</em>
        </p>
      </div>
    `:`
    <div class="import-header">
      <label>
        <input type="checkbox" id="select-all" />
        Select All (${e.filter(i=>!i.is_imported).length} available)
      </label>
      <span class="count">Showing ${e.length} meetings</span>
    </div>
    
    <div class="krisp-list">
      ${e.map(i=>V(i)).join("")}
    </div>
    
    <div class="import-footer">
      <span class="selected-count" id="selected-count">0 selected</span>
      <button class="import-btn" id="import-selected-btn" disabled>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import Selected
      </button>
    </div>
  `}function V(e){const t=e.is_imported,i=s.selectedMeetings.has(e.krisp_meeting_id),a=e.speakers?.join(", ")||e.attendees?.join(", ")||"No participants",r=e.meeting_date?new Date(e.meeting_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";return`
    <div class="import-meeting ${i?"selected":""} ${t?"imported":""}" data-id="${e.krisp_meeting_id}">
      <input type="checkbox" ${i?"checked":""} ${t?"disabled":""} />
      <div class="import-meeting-content">
        <div class="import-meeting-title">
          ${l(e.meeting_name||"Untitled Meeting")}
          ${t?'<span class="imported-badge">Imported</span>':""}
        </div>
        <div class="import-meeting-meta">
          ${r} · ${l(a.substring(0,100))}${a.length>100?"...":""}
        </div>
        ${e.summary?`<div class="import-meeting-summary">${l(e.summary.substring(0,150))}${e.summary.length>150?"...":""}</div>`:""}
      </div>
    </div>
  `}function Q(e){const t=e.querySelector("#import-filter-btn");t&&o(t,"click",async()=>{const a=e.querySelector("#import-after"),r=e.querySelector("#import-before"),n=e.querySelector("#import-search");s.importFilters={after:a?.value||"",before:r?.value||"",domain:"",search:n?.value||""},await v(e)});const i=e.querySelector("#import-search");i&&o(i,"keydown",a=>{a.key==="Enter"&&t?.dispatchEvent(new Event("click"))}),O(e)}function O(e){const t=e.querySelector("#select-all");t&&o(t,"change",()=>{t.checked?s.mcpMeetings.forEach(r=>{s.importedIds.has(r.meeting_id)||s.selectedMeetings.add(r.meeting_id)}):s.selectedMeetings.clear(),b(e)}),e.querySelectorAll(".import-meeting").forEach(a=>{o(a,"click",n=>{if(n.target.tagName==="INPUT")return;const d=a.getAttribute("data-id");!d||s.importedIds.has(d)||(s.selectedMeetings.has(d)?s.selectedMeetings.delete(d):s.selectedMeetings.add(d),b(e))});const r=a.querySelector('input[type="checkbox"]');r&&o(r,"change",()=>{const n=a.getAttribute("data-id");!n||s.importedIds.has(n)||(r.checked?s.selectedMeetings.add(n):s.selectedMeetings.delete(n),b(e))})});const i=e.querySelector("#import-selected-btn");i&&o(i,"click",async()=>{if(s.selectedMeetings.size===0)return;i.setAttribute("disabled","true"),i.innerHTML='<span class="loading-spinner" style="width: 16px; height: 16px;"></span> Importing...';const a=Array.from(s.selectedMeetings),r=await z(a);r?(r.imported>0&&p.success(`Imported ${r.imported} meeting${r.imported!==1?"s":""}`),r.errors.length>0&&p.warning(`${r.errors.length} failed to import`),s.selectedMeetings.clear(),await v(e)):(p.error("Import failed"),i.removeAttribute("disabled"),i.innerHTML="Import Selected")})}function b(e){const t=s.selectedMeetings.size,i=e.querySelector("#selected-count");i&&(i.textContent=`${t} selected`);const a=e.querySelector("#import-selected-btn");a&&(t>0?(a.removeAttribute("disabled"),a.innerHTML=`
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import ${t} Meeting${t!==1?"s":""}
      `):(a.setAttribute("disabled","true"),a.innerHTML=`
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import Selected
      `)),e.querySelectorAll(".import-meeting").forEach(r=>{const n=r.getAttribute("data-id"),m=r.querySelector('input[type="checkbox"]');if(n&&m&&!s.importedIds.has(n)){const d=s.selectedMeetings.has(n);m.checked=d,r.classList.toggle("selected",d)}})}function l(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function X(){h(u)}export{X as closeKrispManager,W as showKrispManager};
//# sourceMappingURL=KrispManager-B_7JqOME.js.map
