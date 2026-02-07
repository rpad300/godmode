const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ProjectAssignmentModal-C-ZP7zys.js","assets/main-DZFGTOOo.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-BXb4IGK8.css"])))=>i.map(i=>d[i]);
import{d as D,c as L,e as F,i as N,o as l,j as R,k as P,l as V,m as K,n as U,p as O,t as m,q as M,r as T,s as Q,_ as G,u as J,v as C,w as W,x as X,y as I}from"./main-DZFGTOOo.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const k="krisp-manager-modal";let s={activeTab:"transcripts",transcripts:[],quarantine:[],mappings:[],loading:!1,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:""},projects:[],selectedProjectId:""},b=null;async function ue(e="transcripts"){s={activeTab:e,transcripts:[],quarantine:[],mappings:[],loading:!1,selectedTranscript:null,mcpMeetings:[],importedIds:new Set,selectedMeetings:new Set,importFilters:{search:"",after:"",before:"",domain:""}};const t=document.querySelector(`[data-modal-id="${k}"]`);t&&t.remove();const r=L("div",{className:"krisp-manager"});b=r,r.innerHTML=`
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
  `;const i=F({id:k,title:"Krisp Transcripts",content:r,size:"xl"});document.body.appendChild(i),N(k),Y(r),await f("transcripts")}function Y(e){const t=e.querySelectorAll(".krisp-tab");t.forEach(r=>{l(r,"click",async()=>{const i=r.getAttribute("data-tab");i!==s.activeTab&&(t.forEach(n=>n.classList.remove("active")),r.classList.add("active"),s.activeTab=i,await f(i))})})}async function f(e){if(!b)return;const t=b.querySelector("#krisp-content");if(t){t.innerHTML='<div class="krisp-loading"><div class="loading-spinner"></div></div>',s.loading=!0;try{switch(e){case"transcripts":await w(t);break;case"quarantine":await Z(t);break;case"mappings":await ee(t);break;case"import":await A(t);break}}catch(r){console.error("[KrispManager] Error loading tab:",r),t.innerHTML='<div class="krisp-empty"><p>Failed to load. Please try again.</p></div>'}finally{s.loading=!1}}}async function w(e){const[t,r]=await Promise.all([U({limit:50}),P()]);if(s.transcripts=t,s.projects=r,S("transcripts-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Configure your Krisp webhook in Profile &gt; Integrations</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(i=>te(i)).join("")}</div>`,ae(e)}async function Z(e){const t=await K();if(s.quarantine=t,S("quarantine-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No transcripts in quarantine</p>
        <p style="font-size: 12px; margin-top: 8px;">All speakers are identified correctly</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(r=>re(r)).join("")}</div>`,se(e)}async function ee(e){const t=await V();if(s.mappings=t,S("mappings-count",t.length),t.length===0){e.innerHTML=`
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        <p>No speaker mappings</p>
        <p style="font-size: 12px; margin-top: 8px;">Mappings are created when you manually link speakers to contacts</p>
      </div>
    `;return}e.innerHTML=`<div class="krisp-list">${t.map(r=>ie(r)).join("")}</div>`,oe(e)}function te(e){const{label:t}=M(e.status),r=T(e.duration_minutes),i=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-",n=e.speakers?.length||0,a=e.status==="pending"&&!e.matched_project_id,o=s.projects.map(d=>`<option value="${d.id}">${p(d.name)}</option>`).join("");return`
    <div class="krisp-item ${a?"needs-project":""}" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${p(e.display_title||e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${i}</span>
          <span>${r}</span>
          <span>${n} speakers</span>
          ${e.projects?.name?`<span class="project-tag">${p(e.projects.name)}</span>`:""}
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
  `}function re(e){const{label:t}=M(e.status),r=T(e.duration_minutes),i=e.meeting_date?new Date(e.meeting_date).toLocaleDateString():"-";return`
    <div class="krisp-item" data-id="${e.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${p(e.krisp_title||"Untitled Meeting")}</div>
        <div class="krisp-item-meta">
          <span>${i}</span>
          <span>${r}</span>
          <span style="color: #f59e0b;">${e.status_reason||t}</span>
        </div>
      </div>
      <div class="krisp-item-actions">
        <button class="retry-btn" data-id="${e.id}" title="Retry processing">Retry</button>
        <button class="assign-btn primary" data-id="${e.id}" title="Assign to project">Assign</button>
        <button class="skip-btn" data-id="${e.id}" title="Discard">Skip</button>
      </div>
    </div>
  `}function ie(e){return`
    <div class="mapping-item" data-id="${e.id}">
      <div class="mapping-info">
        <span class="mapping-speaker">${p(e.speaker_name)}</span>
        <span class="mapping-arrow">→</span>
        <span class="mapping-contact">${p(e.contacts?.name||"Unknown")}</span>
        ${e.is_global?'<span class="mapping-badge">Global</span>':""}
      </div>
      <button class="delete-mapping-btn" data-id="${e.id}" title="Remove mapping">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  `}function ae(e){e.querySelectorAll(".krisp-item").forEach(t=>{l(t,"click",r=>{if(r.target.closest(".krisp-item-assign"))return;const n=t.getAttribute("data-id"),a=s.transcripts.find(o=>o.id===n);a&&ne(a)})}),e.querySelectorAll(".assign-project-select").forEach(t=>{l(t,"change",()=>{const r=t.getAttribute("data-transcript-id"),i=e.querySelector(`.assign-project-btn[data-transcript-id="${r}"]`);i&&(i.disabled=!t.value)}),l(t,"click",r=>r.stopPropagation())}),e.querySelectorAll(".assign-project-btn").forEach(t=>{l(t,"click",async r=>{r.stopPropagation();const i=t.getAttribute("data-transcript-id");if(!i)return;const a=e.querySelector(`.assign-project-select[data-transcript-id="${i}"]`)?.value;if(!a)return;if(t.disabled=!0,t.textContent="Assigning...",await C(i,a)){const d=s.projects.find(c=>c.id===a);m.success(`Assigned to ${d?.name||"project"}`),await w(e)}else m.error("Failed to assign project"),t.disabled=!1,t.textContent="Assign"})}),e.querySelectorAll(".process-btn").forEach(t=>{l(t,"click",async r=>{r.stopPropagation();const i=t.getAttribute("data-id");if(!i)return;t.textContent="Processing...",t.disabled=!0,await W(i)?(m.success("Transcript processed - document created"),await w(e)):(m.error("Processing failed"),t.textContent="Process",t.disabled=!1)})})}function se(e){e.querySelectorAll(".retry-btn").forEach(t=>{l(t,"click",async r=>{r.stopPropagation();const i=t.getAttribute("data-id");if(!i)return;t.textContent="...",await Q(i)?(m.success("Retry queued"),await f("quarantine")):(m.error("Retry failed"),t.textContent="Retry")})}),e.querySelectorAll(".assign-btn").forEach(t=>{l(t,"click",async r=>{r.stopPropagation();const i=t.getAttribute("data-id"),n=s.quarantine.find(a=>a.id===i);if(n){const{showProjectAssignmentModal:a}=await G(async()=>{const{showProjectAssignmentModal:o}=await import("./ProjectAssignmentModal-C-ZP7zys.js");return{showProjectAssignmentModal:o}},__vite__mapDeps([0,1,2,3]));a({transcript:n,onAssign:async()=>{await f("quarantine")}})}})}),e.querySelectorAll(".skip-btn").forEach(t=>{l(t,"click",async r=>{r.stopPropagation();const i=t.getAttribute("data-id");if(!i||!confirm("Are you sure you want to skip this transcript?"))return;await J(i,"Manually skipped")?(m.success("Transcript skipped"),await f("quarantine")):m.error("Failed to skip")})})}function oe(e){e.querySelectorAll(".delete-mapping-btn").forEach(t=>{l(t,"click",async r=>{r.stopPropagation();const i=t.getAttribute("data-id");if(!i||!confirm("Are you sure you want to delete this mapping?"))return;await O(i)?(m.success("Mapping deleted"),await f("mappings")):m.error("Failed to delete")})})}function ne(e){const t=e.status==="pending"&&!e.matched_project_id,{label:r}=M(e.status),i=e.meeting_date?new Date(e.meeting_date).toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-",n=s.projects.map(c=>`<option value="${c.id}">${p(c.name)}</option>`).join(""),a=document.createElement("div");a.className="summary-modal-overlay",a.innerHTML=`
    <div class="summary-modal" style="max-width: 500px;">
      <div class="summary-modal-header">
        <h3>${p(e.display_title||e.krisp_title||"Meeting Details")}</h3>
        <button class="summary-modal-close">&times;</button>
      </div>
      <div class="summary-modal-body">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Status</div>
            <span class="krisp-item-status status-${e.status}" style="display: inline-block;">${r}</span>
          </div>
          
          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Date</div>
            <div style="font-weight: 500;">${i}</div>
          </div>
          
          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Speakers</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${(e.speakers||[]).map(c=>`<span style="padding: 4px 8px; background: var(--bg-secondary); border-radius: 4px; font-size: 13px;">${p(c)}</span>`).join("")}
              ${!e.speakers||e.speakers.length===0?'<span style="color: var(--text-secondary);">No speakers</span>':""}
            </div>
          </div>
          
          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Project</div>
            ${e.projects?.name?`<span class="project-tag">${p(e.projects.name)}</span>`:'<span style="color: var(--text-secondary);">Not assigned</span>'}
          </div>
          
          ${t?`
            <div style="padding-top: 16px; border-top: 1px solid var(--border-color);">
              <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Assign to Project</div>
              <div style="display: flex; gap: 8px;">
                <select id="detail-project-select" style="flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px;">
                  <option value="">Select project...</option>
                  ${n}
                </select>
                <button id="detail-assign-btn" disabled style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                  Assign
                </button>
              </div>
            </div>
          `:""}
        </div>
      </div>
    </div>
  `,document.body.appendChild(a),a.querySelector(".summary-modal-close")?.addEventListener("click",()=>a.remove()),a.addEventListener("click",c=>{c.target===a&&a.remove()});const d=c=>{c.key==="Escape"&&(a.remove(),document.removeEventListener("keydown",d))};if(document.addEventListener("keydown",d),t){const c=a.querySelector("#detail-project-select"),u=a.querySelector("#detail-assign-btn");c?.addEventListener("change",()=>{u.disabled=!c.value}),u?.addEventListener("click",async()=>{const y=c.value;if(!y)return;if(u.disabled=!0,u.textContent="Assigning...",await C(e.id,y)){const x=s.projects.find(v=>v.id===y);if(m.success(`Assigned to ${x?.name||"project"}`),a.remove(),b){const v=b.querySelector("#krisp-content");v&&await w(v)}}else m.error("Failed to assign project"),u.disabled=!1,u.textContent="Assign"})}}function S(e,t){if(!b)return;const r=b.querySelector(`#${e}`);r&&(r.textContent=String(t))}async function A(e){const[t,r]=await Promise.all([R({limit:100,showImported:!0,startDate:s.importFilters.after||void 0,endDate:s.importFilters.before||void 0,search:s.importFilters.search||void 0}),P()]);s.projects=r;const i=t?.stats||{total_available:0,total_imported:0,total_pending:0,last_sync:null},n=i.last_sync?new Date(i.last_sync).toLocaleString():"Never",a=s.projects.map(o=>`<option value="${o.id}" ${s.selectedProjectId===o.id?"selected":""}>${p(o.name)}</option>`).join("");e.innerHTML=`
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
        <span class="stat-value" style="font-size: 12px;">${n}</span>
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
      ${de(t?.meetings||[])}
    </div>
  `,t?.meetings&&(s.mcpMeetings=t.meetings.map(o=>({meeting_id:o.krisp_meeting_id,name:o.meeting_name,date:o.meeting_date,speakers:o.speakers,attendees:o.attendees,meeting_notes:{key_points:o.key_points,action_items:o.action_items}})),s.importedIds=new Set(t.meetings.filter(o=>o.is_imported).map(o=>o.krisp_meeting_id))),pe(e)}function de(e){return e.length===0?`
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
        Select All (${e.filter(r=>!r.is_imported).length} available)
      </label>
      <span class="count">Showing ${e.length} meetings</span>
    </div>
    
    <div class="krisp-list">
      ${e.map(r=>ce(r)).join("")}
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
  `}function $(e){if(!e)return[];if(Array.isArray(e))return e;if(typeof e=="string")try{const t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}return[]}function ce(e){const t=e.is_imported,r=s.selectedMeetings.has(e.krisp_meeting_id),i=$(e.speakers),n=$(e.attendees),a=i.length>0?i.join(", "):n.length>0?n.join(", "):"No participants",o=e.meeting_date?new Date(e.meeting_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"",d=$(e.key_points),c=e.summary||d.length>0;return`
    <div class="import-meeting ${r?"selected":""} ${t?"imported":""}" data-id="${e.krisp_meeting_id}">
      <input type="checkbox" ${r?"checked":""} ${t?"disabled":""} />
      <div class="import-meeting-content">
        <div class="import-meeting-title">
          ${p(e.meeting_name||"Untitled Meeting")}
          ${t?'<span class="imported-badge">Imported</span>':""}
        </div>
        <div class="import-meeting-meta">
          ${o} · ${p(a.substring(0,100))}${a.length>100?"...":""}
        </div>
        ${e.summary?`<div class="import-meeting-summary">${p(e.summary.substring(0,150))}${e.summary.length>150?"...":""}</div>`:""}
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
  `}function pe(e){const t=e.querySelector("#import-filter-btn");t&&l(t,"click",async()=>{const n=e.querySelector("#import-after"),a=e.querySelector("#import-before"),o=e.querySelector("#import-search");s.importFilters={after:n?.value||"",before:a?.value||"",domain:"",search:o?.value||""},await A(e)});const r=e.querySelector("#import-project");r&&l(r,"change",()=>{s.selectedProjectId=r.value});const i=e.querySelector("#import-search");i&&l(i,"keydown",n=>{n.key==="Enter"&&t?.dispatchEvent(new Event("click"))}),le(e)}function le(e){const t=e.querySelector("#select-all");t&&l(t,"change",()=>{t.checked?s.mcpMeetings.forEach(n=>{s.importedIds.has(n.meeting_id)||s.selectedMeetings.add(n.meeting_id)}):s.selectedMeetings.clear(),j(e)}),e.querySelectorAll(".summary-btn").forEach(i=>{l(i,"click",async n=>{n.stopPropagation();const a=i.getAttribute("data-meeting-id");if(!a)return;const o=s.mcpMeetings.find(d=>d.meeting_id===a);o&&await E(a,o.name||"Meeting Summary")})}),e.querySelectorAll(".import-meeting").forEach(i=>{l(i,"click",a=>{const o=a.target;if(o.tagName==="INPUT"||o.closest(".summary-btn"))return;const d=i.getAttribute("data-id");!d||s.importedIds.has(d)||(s.selectedMeetings.has(d)?s.selectedMeetings.delete(d):s.selectedMeetings.add(d),j(e))});const n=i.querySelector('input[type="checkbox"]');n&&l(n,"change",()=>{const a=i.getAttribute("data-id");!a||s.importedIds.has(a)||(n.checked?s.selectedMeetings.add(a):s.selectedMeetings.delete(a),j(e))})});const r=e.querySelector("#import-selected-btn");r&&l(r,"click",async()=>{if(s.selectedMeetings.size===0)return;if(!s.selectedProjectId){m.warning("Please select a project to import meetings into");return}r.setAttribute("disabled","true"),r.innerHTML='<span class="loading-spinner" style="width: 16px; height: 16px;"></span> Importing...';const i=Array.from(s.selectedMeetings),n=await X(i,s.selectedProjectId);if(n){if(n.imported>0){const a=s.projects.find(o=>o.id===s.selectedProjectId);m.success(`Imported ${n.imported} meeting${n.imported!==1?"s":""} to ${a?.name||"project"}`)}n.errors.length>0&&m.warning(`${n.errors.length} failed to import`),s.selectedMeetings.clear(),await A(e)}else m.error("Import failed"),r.removeAttribute("disabled"),r.innerHTML="Import Selected"})}function j(e){const t=s.selectedMeetings.size,r=e.querySelector("#selected-count");r&&(r.textContent=`${t} selected`);const i=e.querySelector("#import-selected-btn");i&&(t>0?(i.removeAttribute("disabled"),i.innerHTML=`
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import ${t} Meeting${t!==1?"s":""}
      `):(i.setAttribute("disabled","true"),i.innerHTML=`
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import Selected
      `)),e.querySelectorAll(".import-meeting").forEach(n=>{const a=n.getAttribute("data-id"),o=n.querySelector('input[type="checkbox"]');if(a&&o&&!s.importedIds.has(a)){const d=s.selectedMeetings.has(a);o.checked=d,n.classList.toggle("selected",d)}})}async function E(e,t){const r=L("div",{className:"summary-modal-overlay"});r.innerHTML=`
    <div class="summary-modal">
      <div class="summary-modal-header">
        <h3>${p(t)}</h3>
        <button class="summary-modal-close">&times;</button>
      </div>
      <div class="summary-modal-body">
        <div class="summary-loading">
          <div class="loading-spinner"></div>
          <p style="margin-top: 12px;">Generating AI summary...</p>
        </div>
      </div>
    </div>
  `,document.body.appendChild(r);const i=()=>{r.remove()};l(r.querySelector(".summary-modal-close"),"click",i),l(r,"click",a=>{a.target===r&&i()});const n=a=>{a.key==="Escape"&&(i(),document.removeEventListener("keydown",n))};document.addEventListener("keydown",n);try{const a=await I(e),o=r.querySelector(".summary-modal-body");if(!o)return;if(a?.success&&a.summary){const{key_points:d,action_items:c,excerpt:u,speakers:y,attendees:_,meeting_date:x,mentioned_people:v}=a.summary,H=[...y||[],..._||[]],h=[...new Set(H)],z=(v||[]).filter(g=>!h.some(B=>B.toLowerCase()===g.toLowerCase()));o.innerHTML=`
        ${x?`
          <div class="summary-section" style="padding-bottom: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color, #e2e8f0);">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary, #64748b); font-size: 13px;">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              ${new Date(x).toLocaleDateString("pt-PT",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}
            </div>
          </div>
        `:""}
        
        ${h.length>0?`
          <div class="summary-section">
            <h4>Participants</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${h.map(g=>`
                <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--bg-secondary, #f1f5f9); border-radius: 16px; font-size: 13px;">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${p(g)}
                </span>
              `).join("")}
            </div>
          </div>
        `:""}
        
        ${z.length>0?`
          <div class="summary-section">
            <h4>Also Mentioned</h4>
            <p style="font-size: 12px; color: var(--text-secondary, #64748b); margin-bottom: 8px;">People referenced in the discussion:</p>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${z.map(g=>`
                <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(59, 130, 246, 0.1); border: 1px dashed rgba(59, 130, 246, 0.3); border-radius: 16px; font-size: 13px; color: #3b82f6;">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${p(g)}
                </span>
              `).join("")}
            </div>
          </div>
        `:""}
        
        ${u?`
          <div class="summary-section">
            <h4>Summary</h4>
            <p>${p(u)}</p>
          </div>
        `:""}
        
        ${d&&d.length>0?`
          <div class="summary-section">
            <h4>Key Points</h4>
            <ul>
              ${d.map(g=>`<li>${p(g)}</li>`).join("")}
            </ul>
          </div>
        `:""}
        
        ${c&&c.length>0?`
          <div class="summary-section">
            <h4>Action Items</h4>
            <ul>
              ${c.map(g=>`<li>${p(g)}</li>`).join("")}
            </ul>
          </div>
        `:""}
        
        ${!u&&(!d||d.length===0)&&(!c||c.length===0)&&h.length===0?`
          <div class="summary-section">
            <p style="color: var(--text-secondary);">No summary data available for this meeting. The meeting may not have enough content to generate a summary.</p>
          </div>
        `:""}
        
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color, #e2e8f0); text-align: right;">
          <button class="summary-btn refresh-summary-btn" data-meeting-id="${e}">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh Summary
          </button>
        </div>
      `;const q=o.querySelector(".refresh-summary-btn");q&&l(q,"click",async()=>{o.innerHTML=`
            <div class="summary-loading">
              <div class="loading-spinner"></div>
              <p style="margin-top: 12px;">Regenerating AI summary...</p>
            </div>
          `;const g=await I(e);g?.success&&g.summary?(i(),await E(e,t)):o.innerHTML=`
              <div class="summary-section">
                <p style="color: var(--error, #dc2626);">Failed to regenerate summary. Please try again.</p>
              </div>
            `})}else o.innerHTML=`
        <div class="summary-section">
          <p style="color: var(--error, #dc2626);">${p(a?.error||"Failed to generate summary. Please try again.")}</p>
        </div>
      `}catch{const o=r.querySelector(".summary-modal-body");o&&(o.innerHTML=`
        <div class="summary-section">
          <p style="color: var(--error, #dc2626);">An error occurred while generating the summary.</p>
        </div>
      `)}}function p(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function be(){D(k)}export{be as closeKrispManager,ue as showKrispManager};
//# sourceMappingURL=KrispManager-Ch5caStR.js.map
