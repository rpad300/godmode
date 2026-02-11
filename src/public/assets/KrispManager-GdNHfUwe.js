const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ProjectAssignmentModal-CP8hIbfT.js","assets/main-BEBbDhZA.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-Ba17mlSV.css"])))=>i.map(i=>d[i]);
import{q as D,d as P,r as F,u as N,o as p,v as R,w as z,x as V,y as K,z as U,A as O,t as m,B as M,C as T,D as Q,_ as G,E as J,F as C,G as W,H as X,I as L}from"./main-BEBbDhZA.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const x="krisp-manager-modal";let i={activeTab:"transcripts",transcripts:[],quarantine:[],mappings:[],loading:!1,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:""},projects:[],selectedProjectId:""},b=null;async function ge(e="transcripts"){i={activeTab:e,transcripts:[],quarantine:[],mappings:[],loading:!1,selectedTranscript:null,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:"",domain:""},projects:[],selectedProjectId:""};const t=document.querySelector(`[data-modal-id="${x}"]`);t&&t.remove();const s=P("div",{className:"krisp-manager"});b=s,s.innerHTML=`
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
      .krisp-item.needs-project {
        border: 1px solid rgba(225, 29, 72, 0.2);
        background: rgba(225, 29, 72, 0.02);
      }
      .krisp-item-assign {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .krisp-item-assign select {
        padding: 6px 10px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        font-size: 12px;
        background: white;
        min-width: 150px;
        cursor: pointer;
      }
      .krisp-item-assign select:focus {
        outline: none;
        border-color: var(--primary, #e11d48);
      }
      .krisp-item-assign button {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 6px;
        border: none;
        background: var(--primary, #e11d48);
        color: white;
        cursor: pointer;
        white-space: nowrap;
      }
      .krisp-item-assign button:disabled {
        background: #cbd5e1;
        cursor: not-allowed;
      }
      .krisp-item-assign button:not(:disabled):hover {
        background: #be123c;
      }
      .project-tag {
        padding: 2px 6px;
        background: rgba(225, 29, 72, 0.1);
        color: var(--primary, #e11d48);
        border-radius: 4px;
        font-size: 11px;
      }
      [data-theme="dark"] .krisp-item-assign select {
        background: rgba(30,41,59,0.8);
        color: white;
        border-color: rgba(255,255,255,0.1);
      }
      [data-theme="dark"] .krisp-item.needs-project {
        background: rgba(225, 29, 72, 0.05);
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
      .import-project-selector {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .import-project-selector label {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-primary, #1e293b);
        white-space: nowrap;
      }
      .import-project-selector select {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        background: white;
        font-size: 14px;
        cursor: pointer;
      }
      .import-project-selector select:focus {
        outline: none;
        border-color: var(--primary, #e11d48);
      }
      [data-theme="dark"] .import-project-selector {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .import-project-selector select {
        background: rgba(30,41,59,0.8);
        color: white;
        border-color: rgba(255,255,255,0.1);
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
      .import-meeting-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      .summary-btn {
        padding: 6px 12px;
        font-size: 11px;
        border-radius: 6px;
        border: 1px solid var(--border-color, #e2e8f0);
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      .summary-btn:hover {
        background: var(--bg-secondary, #f8fafc);
        border-color: var(--primary, #e11d48);
      }
      .summary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .summary-btn svg {
        width: 14px;
        height: 14px;
      }
      .summary-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .summary-modal {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .summary-modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .summary-modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .summary-modal-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        color: var(--text-secondary, #64748b);
        padding: 4px;
      }
      .summary-modal-body {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(80vh - 60px);
      }
      .summary-section {
        margin-bottom: 20px;
      }
      .summary-section:last-child {
        margin-bottom: 0;
      }
      .summary-section h4 {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-secondary, #64748b);
        margin: 0 0 8px 0;
        letter-spacing: 0.5px;
      }
      .summary-section p {
        margin: 0;
        color: var(--text-primary, #1e293b);
        line-height: 1.6;
      }
      .summary-section ul {
        margin: 0;
        padding-left: 20px;
        color: var(--text-primary, #1e293b);
      }
      .summary-section li {
        margin-bottom: 6px;
        line-height: 1.4;
      }
      .summary-loading {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary, #64748b);
      }
      [data-theme="dark"] .summary-btn {
        background: rgba(30,41,59,0.8);
        border-color: rgba(255,255,255,0.1);
        color: white;
      }
      [data-theme="dark"] .summary-modal {
        background: var(--bg-primary, #0f172a);
        color: white;
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
        <svg class="krisp-tab-svg-ml" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
      </button>
    </div>
    
    <div class="krisp-content" id="krisp-content">
      <div class="krisp-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;const r=F({id:x,title:"Krisp Transcripts",content:s,size:"xl"});document.body.appendChild(r),N(x),Y(s),await f("transcripts")}function Y(e){const t=e.querySelectorAll(".krisp-tab");t.forEach(s=>{p(s,"click",async()=>{const r=s.getAttribute("data-tab");r!==i.activeTab&&(t.forEach(n=>n.classList.remove("active")),s.classList.add("active"),i.activeTab=r,await f(r))})})}async function f(e){if(!b)return;const t=b.querySelector("#krisp-content");if(t){t.innerHTML='<div class="krisp-loading"><div class="loading-spinner"></div></div>',i.loading=!0;try{switch(e){case"transcripts":await w(t);break;case"quarantine":await Z(t);break;case"mappings":await ee(t);break;case"import":await S(t);break}}catch(s){console.error("[KrispManager] Error loading tab:",s),t.innerHTML='<div class="krisp-empty"><p>Failed to load. Please try again.</p></div>'}finally{i.loading=!1}}}async function w(e){const[t,s]=await Promise.all([U({limit:50}),z()]);if(i.transcripts=t,i.projects=s,A("transcripts-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p class="krisp-hint">Configure your Krisp webhook in Profile &gt; Integrations</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(r=>te(r)).join("")}</div>`,ae(e)}async function Z(e){const t=await K();if(i.quarantine=t,A("quarantine-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No transcripts in quarantine</p>
        <p class="krisp-hint">All speakers are identified correctly</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(s=>se(s)).join("")}</div>`,ie(e)}async function ee(e){const t=await V();if(i.mappings=t,A("mappings-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        <p>No speaker mappings</p>
        <p class="krisp-hint">Mappings are created when you manually link speakers to contacts</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(s=>re(s)).join("")}</div>`,oe(e)}function te(e){const{label:t}=M(e.status),s=T(e.duration_minutes),r=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-",n=e.speakers?.length||0,a=e.status==="pending"&&!e.matched_project_id,o=i.projects.map(d=>`<option value="${d.id}">${l(d.name)}</option>`).join("");return`
    <div class="krisp-item ${a?"needs-project":""}" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${l(e.display_title||e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${r}</span>
          <span>${s}</span>
          <span>${n} speakers</span>
          ${e.projects?.name?`<span class="project-tag">${l(e.projects.name)}</span>`:""}
        </div>
      </div>
      ${a?`
        <div class="krisp-item-assign">
          <select class="assign-project-select" data-transcript-id="${e.id}">
            <option value="">Select project...</option>
            ${o}
          </select>
          <button class="assign-project-btn" data-transcript-id="${e.id}" disabled>
            Assign
          </button>
        </div>
      `:e.status==="matched"?`
        <div class="krisp-item-actions">
          <span class="krisp-item-status status-${e.status}">${t}</span>
          <button class="process-btn primary" data-id="${e.id}" title="Process and create document">
            Process
          </button>
        </div>
      `:`
        <span class="krisp-item-status status-${e.status}">${t}</span>
      `}
    </div>
  `}function se(e){const{label:t}=M(e.status),s=T(e.duration_minutes),r=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-";return`
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
          <span>${s}</span>
          <span class="krisp-status-reason">${e.status_reason||t}</span>
        </div>
      </div>
      <div class="krisp-item-actions">
        <button class="retry-btn" data-id="${e.id}" title="Retry processing">Retry</button>
        <button class="assign-btn primary" data-id="${e.id}" title="Assign to project">Assign</button>
        <button class="skip-btn" data-id="${e.id}" title="Discard">Skip</button>
      </div>
    </div>
  `}function re(e){return`
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
  `}function ae(e){e.querySelectorAll(".krisp-item").forEach(t=>{p(t,"click",s=>{if(s.target.closest(".krisp-item-assign"))return;const n=t.getAttribute("data-id"),a=i.transcripts.find(o=>o.id===n);a&&ne(a)})}),e.querySelectorAll(".assign-project-select").forEach(t=>{p(t,"change",()=>{const s=t.getAttribute("data-transcript-id"),r=e.querySelector(`.assign-project-btn[data-transcript-id="${s}"]`);r&&(r.disabled=!t.value)}),p(t,"click",s=>s.stopPropagation())}),e.querySelectorAll(".assign-project-btn").forEach(t=>{p(t,"click",async s=>{s.stopPropagation();const r=t.getAttribute("data-transcript-id");if(!r)return;const a=e.querySelector(`.assign-project-select[data-transcript-id="${r}"]`)?.value;if(!a)return;if(t.disabled=!0,t.textContent="Assigning...",await C(r,a)){const d=i.projects.find(c=>c.id===a);m.success(`Assigned to ${d?.name||"project"}`),await w(e)}else m.error("Failed to assign project"),t.disabled=!1,t.textContent="Assign"})}),e.querySelectorAll(".process-btn").forEach(t=>{p(t,"click",async s=>{s.stopPropagation();const r=t.getAttribute("data-id");if(!r)return;t.textContent="Processing...",t.disabled=!0,await W(r)?(m.success("Transcript processed - document created"),await w(e)):(m.error("Processing failed"),t.textContent="Process",t.disabled=!1)})})}function ie(e){e.querySelectorAll(".retry-btn").forEach(t=>{p(t,"click",async s=>{s.stopPropagation();const r=t.getAttribute("data-id");if(!r)return;t.textContent="...",await Q(r)?(m.success("Retry queued"),await f("quarantine")):(m.error("Retry failed"),t.textContent="Retry")})}),e.querySelectorAll(".assign-btn").forEach(t=>{p(t,"click",async s=>{s.stopPropagation();const r=t.getAttribute("data-id"),n=i.quarantine.find(a=>a.id===r);if(n){const{showProjectAssignmentModal:a}=await G(async()=>{const{showProjectAssignmentModal:o}=await import("./ProjectAssignmentModal-CP8hIbfT.js");return{showProjectAssignmentModal:o}},__vite__mapDeps([0,1,2,3]));a({transcript:n,onAssign:async()=>{await f("quarantine")}})}})}),e.querySelectorAll(".skip-btn").forEach(t=>{p(t,"click",async s=>{s.stopPropagation();const r=t.getAttribute("data-id");if(!r||!confirm("Are you sure you want to skip this transcript?"))return;await J(r,"Manually skipped")?(m.success("Transcript skipped"),await f("quarantine")):m.error("Failed to skip")})})}function oe(e){e.querySelectorAll(".delete-mapping-btn").forEach(t=>{p(t,"click",async s=>{s.stopPropagation();const r=t.getAttribute("data-id");if(!r||!confirm("Are you sure you want to delete this mapping?"))return;await O(r)?(m.success("Mapping deleted"),await f("mappings")):m.error("Failed to delete")})})}function ne(e){const t=e.status==="pending"&&!e.matched_project_id,{label:s}=M(e.status),r=e.meeting_date?new Date(e.meeting_date).toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-",n=i.projects.map(c=>`<option value="${c.id}">${l(c.name)}</option>`).join(""),a=document.createElement("div");a.className="summary-modal-overlay",a.innerHTML=`
    <div class="summary-modal krisp-summary-modal-box">
      <div class="summary-modal-header">
        <h3>${l(e.display_title||e.krisp_title||"Meeting Details")}</h3>
        <button class="summary-modal-close">&times;</button>
      </div>
      <div class="summary-modal-body">
        <div class="krisp-summary-detail-row">
          <div>
            <div class="krisp-summary-detail-label">Status</div>
            <span class="krisp-item-status status-${e.status} gm-inline-block">${s}</span>
          </div>
          <div>
            <div class="krisp-summary-detail-label">Date</div>
            <div class="krisp-summary-detail-value">${r}</div>
          </div>
          <div>
            <div class="krisp-summary-detail-label">Speakers</div>
            <div class="krisp-summary-speakers-wrap">
              ${(e.speakers||[]).map(c=>`<span class="krisp-summary-speaker-chip">${l(c)}</span>`).join("")}
              ${!e.speakers||e.speakers.length===0?'<span class="krisp-summary-no-speakers">No speakers</span>':""}
            </div>
          </div>
          <div>
            <div class="krisp-summary-detail-label">Project</div>
            ${e.projects?.name?`<span class="project-tag">${l(e.projects.name)}</span>`:'<span class="krisp-summary-no-speakers">Not assigned</span>'}
          </div>
          ${t?`
            <div class="krisp-summary-assign-wrap">
              <div class="krisp-summary-assign-label">Assign to Project</div>
              <div class="krisp-summary-assign-row">
                <select id="detail-project-select" class="krisp-summary-assign-select">
                  <option value="">Select project...</option>
                  ${n}
                </select>
                <button type="button" id="detail-assign-btn" class="krisp-summary-assign-btn" disabled>Assign</button>
              </div>
            </div>
          `:""}
        </div>
      </div>
    </div>
  `,document.body.appendChild(a),a.querySelector(".summary-modal-close")?.addEventListener("click",()=>a.remove()),a.addEventListener("click",c=>{c.target===a&&a.remove()});const d=c=>{c.key==="Escape"&&(a.remove(),document.removeEventListener("keydown",d))};if(document.addEventListener("keydown",d),t){const c=a.querySelector("#detail-project-select"),g=a.querySelector("#detail-assign-btn");c?.addEventListener("change",()=>{g.disabled=!c.value}),g?.addEventListener("click",async()=>{const y=c.value;if(!y)return;if(g.disabled=!0,g.textContent="Assigning...",await C(e.id,y)){const k=i.projects.find(v=>v.id===y);if(m.success(`Assigned to ${k?.name||"project"}`),a.remove(),b){const v=b.querySelector("#krisp-content");v&&await w(v)}}else m.error("Failed to assign project"),g.disabled=!1,g.textContent="Assign"})}}function A(e,t){if(!b)return;const s=b.querySelector(`#${e}`);s&&(s.textContent=String(t))}async function S(e){const[t,s]=await Promise.all([R({limit:100,showImported:!0,startDate:i.importFilters.after||void 0,endDate:i.importFilters.before||void 0,search:i.importFilters.search||void 0}),z()]);i.projects=s;const r=t?.stats||{total_available:0,total_imported:0,total_pending:0,last_sync:null},n=r.last_sync?new Date(r.last_sync).toLocaleString():"Never",a=i.projects.map(o=>`<option value="${o.id}" ${i.selectedProjectId===o.id?"selected":""}>${l(o.name)}</option>`).join("");e.innerHTML=`
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
        <span class="stat-value">${r.total_available}</span>
        <span class="stat-label">Available</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${r.total_imported}</span>
        <span class="stat-label">Imported</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${r.total_pending}</span>
        <span class="stat-label">Pending</span>
      </div>
      <div class="stat-item">
        <span class="stat-value krisp-stat-value-sm">${n}</span>
        <span class="stat-label">Last Sync</span>
      </div>
    </div>
    
    <div class="import-project-selector">
      <label for="import-project">Import to Project:</label>
      <select id="import-project">
        <option value="">-- Select a project --</option>
        ${a}
      </select>
    </div>
    
    <div class="import-filters">
      <label>
        From Date
        <input type="date" id="import-after" value="${i.importFilters.after}" />
      </label>
      <label>
        To Date
        <input type="date" id="import-before" value="${i.importFilters.before}" />
      </label>
      <div class="search-row">
        <label class="krisp-import-label-flex">
          Search
          <input type="text" id="import-search" placeholder="Search by title..." value="${i.importFilters.search}" />
        </label>
        <button class="search-btn" id="import-filter-btn">
          Filter
        </button>
      </div>
    </div>
    
    <div id="import-results">
      ${de(t?.meetings||[])}
    </div>
  `,t?.meetings&&(i.mcpMeetings=t.meetings.map(o=>({meeting_id:o.krisp_meeting_id,name:o.meeting_name,date:o.meeting_date,speakers:o.speakers,attendees:o.attendees,meeting_notes:{key_points:Array.isArray(o.key_points)?o.key_points:[],action_items:Array.isArray(o.action_items)?o.action_items.map(String):[]}})),i.importedIds=new Set(t.meetings.filter(o=>o.is_imported).map(o=>o.krisp_meeting_id))),le(e)}function de(e){return e.length===0?`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No meetings synced yet</p>
        <p class="krisp-hint">
          Ask Cursor to sync: <em>"sincroniza as meetings do Krisp de [data] a [data]"</em>
        </p>
      </div>
    `:`
    <div class="import-header">
      <label>
        <input type="checkbox" id="select-all" />
        Select All (${e.filter(s=>!s.is_imported).length} available)
      </label>
      <span class="count">Showing ${e.length} meetings</span>
    </div>
    
    <div class="krisp-list">
      ${e.map(s=>ce(s)).join("")}
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
  `}function $(e){if(!e)return[];if(Array.isArray(e))return e;if(typeof e=="string")try{const t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}return[]}function ce(e){const t=e.is_imported,s=i.selectedMeetings.has(e.krisp_meeting_id),r=$(e.speakers),n=$(e.attendees),a=r.length>0?r.join(", "):n.length>0?n.join(", "):"No participants",o=e.meeting_date?new Date(e.meeting_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"",d=$(e.key_points),c=e.summary||d.length>0;return`
    <div class="import-meeting ${s?"selected":""} ${t?"imported":""}" data-id="${e.krisp_meeting_id}">
      <input type="checkbox" ${s?"checked":""} ${t?"disabled":""} />
      <div class="import-meeting-content">
        <div class="import-meeting-title">
          ${l(e.meeting_name||"Untitled Meeting")}
          ${t?'<span class="imported-badge">Imported</span>':""}
        </div>
        <div class="import-meeting-meta">
          ${o} · ${l(a.substring(0,100))}${a.length>100?"...":""}
        </div>
        ${e.summary?`<div class="import-meeting-summary">${l(e.summary.substring(0,150))}${e.summary.length>150?"...":""}</div>`:""}
      </div>
      <div class="import-meeting-actions">
        <button class="summary-btn" data-meeting-id="${e.krisp_meeting_id}" title="${c?"View/Refresh Summary":"Generate AI Summary"}">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          ${c?"Summary":"AI Summary"}
        </button>
      </div>
    </div>
  `}function le(e){const t=e.querySelector("#import-filter-btn");t&&p(t,"click",async()=>{const n=e.querySelector("#import-after"),a=e.querySelector("#import-before"),o=e.querySelector("#import-search");i.importFilters={after:n?.value||"",before:a?.value||"",domain:"",search:o?.value||""},await S(e)});const s=e.querySelector("#import-project");s&&p(s,"change",()=>{i.selectedProjectId=s.value});const r=e.querySelector("#import-search");r&&p(r,"keydown",n=>{n.key==="Enter"&&t?.dispatchEvent(new Event("click"))}),pe(e)}function pe(e){const t=e.querySelector("#select-all");t&&p(t,"change",()=>{t.checked?i.mcpMeetings.forEach(n=>{i.importedIds.has(n.meeting_id)||i.selectedMeetings.add(n.meeting_id)}):i.selectedMeetings.clear(),j(e)}),e.querySelectorAll(".summary-btn").forEach(r=>{p(r,"click",async n=>{n.stopPropagation();const a=r.getAttribute("data-meeting-id");if(!a)return;const o=i.mcpMeetings.find(d=>d.meeting_id===a);o&&await E(a,o.name||"Meeting Summary")})}),e.querySelectorAll(".import-meeting").forEach(r=>{p(r,"click",a=>{const o=a.target;if(o.tagName==="INPUT"||o.closest(".summary-btn"))return;const d=r.getAttribute("data-id");!d||i.importedIds.has(d)||(i.selectedMeetings.has(d)?i.selectedMeetings.delete(d):i.selectedMeetings.add(d),j(e))});const n=r.querySelector('input[type="checkbox"]');n&&p(n,"change",()=>{const a=r.getAttribute("data-id");!a||i.importedIds.has(a)||(n.checked?i.selectedMeetings.add(a):i.selectedMeetings.delete(a),j(e))})});const s=e.querySelector("#import-selected-btn");s&&p(s,"click",async()=>{if(i.selectedMeetings.size===0)return;if(!i.selectedProjectId){m.warning("Please select a project to import meetings into");return}s.setAttribute("disabled","true"),s.innerHTML='<span class="loading-spinner krisp-loading-spinner-sm"></span> Importing...';const r=Array.from(i.selectedMeetings),n=await X(r,i.selectedProjectId);if(n){if(n.imported>0){const a=i.projects.find(o=>o.id===i.selectedProjectId);m.success(`Imported ${n.imported} meeting${n.imported!==1?"s":""} to ${a?.name||"project"}`)}n.errors.length>0&&m.warning(`${n.errors.length} failed to import`),i.selectedMeetings.clear(),await S(e)}else m.error("Import failed"),s.removeAttribute("disabled"),s.innerHTML="Import Selected"})}function j(e){const t=i.selectedMeetings.size,s=e.querySelector("#selected-count");s&&(s.textContent=`${t} selected`);const r=e.querySelector("#import-selected-btn");r&&(t>0?(r.removeAttribute("disabled"),r.innerHTML=`
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import ${t} Meeting${t!==1?"s":""}
      `):(r.setAttribute("disabled","true"),r.innerHTML=`
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import Selected
      `)),e.querySelectorAll(".import-meeting").forEach(n=>{const a=n.getAttribute("data-id"),o=n.querySelector('input[type="checkbox"]');if(a&&o&&!i.importedIds.has(a)){const d=i.selectedMeetings.has(a);o.checked=d,n.classList.toggle("selected",d)}})}async function E(e,t){const s=P("div",{className:"summary-modal-overlay"});s.innerHTML=`
    <div class="summary-modal">
      <div class="summary-modal-header">
        <h3>${l(t)}</h3>
        <button class="summary-modal-close">&times;</button>
      </div>
      <div class="summary-modal-body">
        <div class="summary-loading">
          <div class="loading-spinner"></div>
          <p class="krisp-summary-loading-p">Generating AI summary...</p>
        </div>
      </div>
    </div>
  `,document.body.appendChild(s);const r=()=>{s.remove()};p(s.querySelector(".summary-modal-close"),"click",r),p(s,"click",a=>{a.target===s&&r()});const n=a=>{a.key==="Escape"&&(r(),document.removeEventListener("keydown",n))};document.addEventListener("keydown",n);try{const a=await L(e),o=s.querySelector(".summary-modal-body");if(!o)return;if(a?.success&&a.summary){const{key_points:d,action_items:c,excerpt:g,speakers:y,attendees:_,meeting_date:k,mentioned_people:v}=a.summary,H=[...y||[],..._||[]],h=[...new Set(H)],I=(v||[]).filter(u=>!h.some(B=>B.toLowerCase()===u.toLowerCase()));o.innerHTML=`
        ${k?`
          <div class="summary-section krisp-summary-section-border">
            <div class="krisp-summary-date-row">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              ${new Date(k).toLocaleDateString("pt-PT",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}
            </div>
          </div>
        `:""}
        
        ${h.length>0?`
          <div class="summary-section">
            <h4>Participants</h4>
            <div class="krisp-summary-participants-wrap">
              ${h.map(u=>`
                <span class="krisp-summary-participant-chip">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${l(u)}
                </span>
              `).join("")}
            </div>
          </div>
        `:""}
        
        ${I.length>0?`
          <div class="summary-section">
            <h4>Also Mentioned</h4>
            <p class="krisp-summary-mentioned-p">People referenced in the discussion:</p>
            <div class="krisp-summary-participants-wrap">
              ${I.map(u=>`
                <span class="krisp-summary-mentioned-chip">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${l(u)}
                </span>
              `).join("")}
            </div>
          </div>
        `:""}
        
        ${g?`
          <div class="summary-section">
            <h4>Summary</h4>
            <p>${l(g)}</p>
          </div>
        `:""}
        
        ${d&&d.length>0?`
          <div class="summary-section">
            <h4>Key Points</h4>
            <ul>
              ${d.map(u=>`<li>${l(u)}</li>`).join("")}
            </ul>
          </div>
        `:""}
        
        ${c&&c.length>0?`
          <div class="summary-section">
            <h4>Action Items</h4>
            <ul>
              ${c.map(u=>`<li>${l(u)}</li>`).join("")}
            </ul>
          </div>
        `:""}
        
        ${!g&&(!d||d.length===0)&&(!c||c.length===0)&&h.length===0?`
          <div class="summary-section">
            <p class="krisp-summary-no-data">No summary data available for this meeting. The meeting may not have enough content to generate a summary.</p>
          </div>
        `:""}
        
        <div class="krisp-summary-footer">
          <button class="summary-btn refresh-summary-btn" data-meeting-id="${e}">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh Summary
          </button>
        </div>
      `;const q=o.querySelector(".refresh-summary-btn");q&&p(q,"click",async()=>{o.innerHTML=`
            <div class="summary-loading">
              <div class="loading-spinner"></div>
              <p class="krisp-summary-loading-p">Regenerating AI summary...</p>
            </div>
          `;const u=await L(e);u?.success&&u.summary?(r(),await E(e,t)):o.innerHTML=`
              <div class="summary-section">
                <p class="krisp-summary-error">Failed to regenerate summary. Please try again.</p>
              </div>
            `})}else o.innerHTML=`
        <div class="summary-section">
          <p class="krisp-summary-error">${l(a?.error||"Failed to generate summary. Please try again.")}</p>
        </div>
      `}catch{const o=s.querySelector(".summary-modal-body");o&&(o.innerHTML=`
        <div class="summary-section">
          <p class="krisp-summary-error">An error occurred while generating the summary.</p>
        </div>
      `)}}function l(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function be(){D(x)}export{be as closeKrispManager,ge as showKrispManager};
//# sourceMappingURL=KrispManager-GdNHfUwe.js.map
