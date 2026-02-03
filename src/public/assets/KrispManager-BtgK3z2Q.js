const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ProjectAssignmentModal-BbDHvKU7.js","assets/main-DWLLl9lh.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-Cf3xxxdT.css"])))=>i.map(i=>d[i]);
import{d as f,c as v,e as x,i as y,o,j as h,k as w,l as M,m as $,t as r,n as m,p as k,r as T,_ as A,s as q}from"./main-DWLLl9lh.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const u="krisp-manager-modal";let s={activeTab:"transcripts",transcripts:[],quarantine:[],mappings:[],loading:!1},c=null;async function N(){s={activeTab:"transcripts",transcripts:[],quarantine:[],mappings:[],loading:!1,selectedTranscript:null};const t=document.querySelector(`[data-modal-id="${u}"]`);t&&t.remove();const a=v("div",{className:"krisp-manager"});c=a,a.innerHTML=`
    <style>
      .krisp-manager {
        min-height: 500px;
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
    </style>
    
    <div class="krisp-tabs">
      <button class="krisp-tab active" data-tab="transcripts">
        Transcripts
        <span class="badge" id="transcripts-count">0</span>
      </button>
      <button class="krisp-tab" data-tab="quarantine">
        Quarantine
        <span class="badge warning" id="quarantine-count">0</span>
      </button>
      <button class="krisp-tab" data-tab="mappings">
        Mappings
        <span class="badge" id="mappings-count">0</span>
      </button>
    </div>
    
    <div class="krisp-content" id="krisp-content">
      <div class="krisp-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;const e=x({id:u,title:"Krisp Transcripts",content:a,size:"xl"});document.body.appendChild(e),y(u),j(a),await p("transcripts")}function j(t){const a=t.querySelectorAll(".krisp-tab");a.forEach(e=>{o(e,"click",async()=>{const i=e.getAttribute("data-tab");i!==s.activeTab&&(a.forEach(n=>n.classList.remove("active")),e.classList.add("active"),s.activeTab=i,await p(i))})})}async function p(t){if(!c)return;const a=c.querySelector("#krisp-content");if(a){a.innerHTML='<div class="krisp-loading"><div class="loading-spinner"></div></div>',s.loading=!0;try{switch(t){case"transcripts":await _(a);break;case"quarantine":await L(a);break;case"mappings":await S(a);break}}catch(e){console.error("[KrispManager] Error loading tab:",e),a.innerHTML='<div class="krisp-empty"><p>Failed to load. Please try again.</p></div>'}finally{s.loading=!1}}}async function _(t){const a=await M({limit:50});if(s.transcripts=a,g("transcripts-count",a.length),a.length===0){t.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Configure your Krisp webhook in Profile &gt; Integrations</p>
      </div>
    `;return}t.innerHTML=`<div class="krisp-list">${a.map(e=>z(e)).join("")}</div>`,C(t)}async function L(t){const a=await w();if(s.quarantine=a,g("quarantine-count",a.length),a.length===0){t.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No transcripts in quarantine</p>
        <p style="font-size: 12px; margin-top: 8px;">All speakers are identified correctly</p>
      </div>
    `;return}t.innerHTML=`<div class="krisp-list">${a.map(e=>E(e)).join("")}</div>`,P(t)}async function S(t){const a=await h();if(s.mappings=a,g("mappings-count",a.length),a.length===0){t.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        <p>No speaker mappings</p>
        <p style="font-size: 12px; margin-top: 8px;">Mappings are created when you manually link speakers to contacts</p>
      </div>
    `;return}t.innerHTML=`<div class="krisp-list">${a.map(e=>H(e)).join("")}</div>`,D(t)}function z(t){const{label:a,color:e}=m(t.status),i=k(t.duration_minutes),n=t.meeting_date?new Date(t.meeting_date).toLocaleDateString():"-",d=t.speakers?.length||0;return`
    <div class="krisp-item" data-id="${t.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(t.display_title||t.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${n}</span>
          <span>${i}</span>
          <span>${d} speakers</span>
          ${t.projects?.name?`<span>${l(t.projects.name)}</span>`:""}
        </div>
      </div>
      <span class="krisp-item-status status-${t.status}">${a}</span>
    </div>
  `}function E(t){const{label:a}=m(t.status),e=k(t.duration_minutes),i=t.meeting_date?new Date(t.meeting_date).toLocaleDateString():"-";return`
    <div class="krisp-item" data-id="${t.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(t.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${i}</span>
          <span>${e}</span>
          <span style="color: #f59e0b;">${t.status_reason||a}</span>
        </div>
      </div>
      <div class="krisp-item-actions">
        <button class="retry-btn" data-id="${t.id}" title="Retry processing">Retry</button>
        <button class="assign-btn primary" data-id="${t.id}" title="Assign to project">Assign</button>
        <button class="skip-btn" data-id="${t.id}" title="Discard">Skip</button>
      </div>
    </div>
  `}function H(t){return`
    <div class="mapping-item" data-id="${t.id}">
      <div class="mapping-info">
        <span class="mapping-speaker">${l(t.speaker_name)}</span>
        <span class="mapping-arrow">→</span>
        <span class="mapping-contact">${l(t.contacts?.name||"Unknown")}</span>
        ${t.is_global?'<span class="mapping-badge">Global</span>':""}
      </div>
      <button class="delete-mapping-btn" data-id="${t.id}" title="Remove mapping">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  `}function C(t){t.querySelectorAll(".krisp-item").forEach(a=>{o(a,"click",()=>{const e=a.getAttribute("data-id"),i=s.transcripts.find(n=>n.id===e);i&&R(i)})})}function P(t){t.querySelectorAll(".retry-btn").forEach(a=>{o(a,"click",async e=>{e.stopPropagation();const i=a.getAttribute("data-id");if(!i)return;a.textContent="...",await T(i)?(r.success("Retry queued"),await p("quarantine")):(r.error("Retry failed"),a.textContent="Retry")})}),t.querySelectorAll(".assign-btn").forEach(a=>{o(a,"click",async e=>{e.stopPropagation();const i=a.getAttribute("data-id"),n=s.quarantine.find(d=>d.id===i);if(n){const{showProjectAssignmentModal:d}=await A(async()=>{const{showProjectAssignmentModal:b}=await import("./ProjectAssignmentModal-BbDHvKU7.js");return{showProjectAssignmentModal:b}},__vite__mapDeps([0,1,2,3]));d({transcript:n,onAssign:async()=>{await p("quarantine")}})}})}),t.querySelectorAll(".skip-btn").forEach(a=>{o(a,"click",async e=>{e.stopPropagation();const i=a.getAttribute("data-id");if(!i||!confirm("Are you sure you want to skip this transcript?"))return;await q(i,"Manually skipped")?(r.success("Transcript skipped"),await p("quarantine")):r.error("Failed to skip")})})}function D(t){t.querySelectorAll(".delete-mapping-btn").forEach(a=>{o(a,"click",async e=>{e.stopPropagation();const i=a.getAttribute("data-id");if(!i||!confirm("Are you sure you want to delete this mapping?"))return;await $(i)?(r.success("Mapping deleted"),await p("mappings")):r.error("Failed to delete")})})}function R(t){const a=[`Title: ${t.display_title||t.krisp_title}`,`Status: ${t.status}`,`Speakers: ${t.speakers?.join(", ")||"None"}`,`Project: ${t.projects?.name||"Not assigned"}`].join(`
`);alert(a)}function g(t,a){if(!c)return;const e=c.querySelector(`#${t}`);e&&(e.textContent=String(a))}function l(t){const a=document.createElement("div");return a.textContent=t,a.innerHTML}function K(){f(u)}export{K as closeKrispManager,N as showKrispManager};
//# sourceMappingURL=KrispManager-BtgK3z2Q.js.map
