import{c as x,e as k,i as j,o as m,d as g,u as w,t as l,v as S,z as M,h as $}from"./main-BO04R03Y.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const p="project-assignment-modal";let d=null,f=[];async function q(s){d=s;const{transcript:a}=s,i=document.querySelector(`[data-modal-id="${p}"]`);i&&i.remove();const t=x("div",{className:"project-assignment"});t.innerHTML=`
    <style>
      .project-assignment {
        padding: 16px 0;
      }
      .assignment-info {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
      }
      .assignment-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text-primary, #1e293b);
      }
      .assignment-reason {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f59e0b;
        font-size: 14px;
        margin-bottom: 12px;
      }
      .assignment-reason svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }
      .speakers-list {
        font-size: 13px;
        color: var(--text-secondary, #64748b);
      }
      .speakers-list strong {
        color: var(--text-primary, #1e293b);
      }
      .candidates-section {
        margin-bottom: 24px;
      }
      .candidates-section h4 {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 12px;
        color: var(--text-secondary, #64748b);
      }
      .candidate-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .candidate-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 2px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .candidate-item:hover {
        border-color: var(--primary-light, #fda4af);
        background: var(--bg-secondary, #f8fafc);
      }
      .candidate-item.selected {
        border-color: var(--primary, #e11d48);
        background: #fef2f2;
      }
      .candidate-radio {
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-color, #e2e8f0);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .candidate-item.selected .candidate-radio {
        border-color: var(--primary, #e11d48);
      }
      .candidate-item.selected .candidate-radio::after {
        content: '';
        width: 10px;
        height: 10px;
        background: var(--primary, #e11d48);
        border-radius: 50%;
      }
      .candidate-info {
        flex: 1;
      }
      .candidate-name {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
      }
      .candidate-code {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
      }
      .candidate-confidence {
        font-size: 13px;
        padding: 4px 10px;
        background: var(--bg-tertiary, #f1f5f9);
        border-radius: 12px;
        color: var(--text-secondary, #64748b);
      }
      .project-select-section {
        margin-bottom: 24px;
      }
      .project-select-section h4 {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 12px;
        color: var(--text-secondary, #64748b);
      }
      .project-select {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        font-size: 14px;
        background: white;
      }
      .action-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color, #e2e8f0);
      }
      .btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      .btn-secondary {
        background: var(--bg-secondary, #f1f5f9);
        color: var(--text-primary, #1e293b);
      }
      .btn-secondary:hover {
        background: var(--bg-tertiary, #e2e8f0);
      }
      .btn-primary {
        background: var(--primary, #e11d48);
        color: white;
      }
      .btn-primary:hover {
        opacity: 0.9;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #dc2626;
      }
      .btn-danger:hover {
        background: #fef2f2;
      }
      [data-theme="dark"] .assignment-info {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .candidate-item.selected {
        background: rgba(225,29,72,0.1);
      }
      [data-theme="dark"] .project-select {
        background: rgba(30,41,59,0.8);
        color: white;
      }
      
      /* Meeting Summary Styles */
      .meeting-summary {
        margin-bottom: 24px;
        padding: 16px;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 12px;
        border: 1px solid #bae6fd;
      }
      [data-theme="dark"] .meeting-summary {
        background: linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(56,189,248,0.05) 100%);
        border-color: rgba(56,189,248,0.2);
      }
      .summary-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-weight: 600;
        color: #0369a1;
      }
      [data-theme="dark"] .summary-header {
        color: #38bdf8;
      }
      .summary-header svg {
        width: 18px;
        height: 18px;
      }
      .summary-topic {
        font-size: 15px;
        color: var(--text-primary, #1e293b);
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .summary-section {
        margin-bottom: 12px;
      }
      .summary-section:last-child {
        margin-bottom: 0;
      }
      .summary-section-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: #0369a1;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }
      [data-theme="dark"] .summary-section-title {
        color: #7dd3fc;
      }
      .summary-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .summary-list li {
        position: relative;
        padding-left: 16px;
        font-size: 13px;
        color: var(--text-secondary, #475569);
        margin-bottom: 4px;
        line-height: 1.4;
      }
      .summary-list li::before {
        content: '•';
        position: absolute;
        left: 0;
        color: #0ea5e9;
      }
      .summary-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--text-secondary, #64748b);
        font-size: 14px;
      }
      .summary-loading .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e2e8f0;
        border-top-color: #0ea5e9;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .refresh-summary-btn {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: #0369a1;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .refresh-summary-btn:hover {
        background: rgba(3, 105, 161, 0.1);
      }
      [data-theme="dark"] .refresh-summary-btn {
        color: #38bdf8;
      }
      [data-theme="dark"] .refresh-summary-btn:hover {
        background: rgba(56, 189, 248, 0.1);
      }
      .summary-source {
        font-size: 11px;
        color: var(--text-tertiary, #94a3b8);
        text-align: right;
        margin-top: 8px;
      }
    </style>
    
    <!-- Meeting Summary Section -->
    <div class="meeting-summary" id="meeting-summary">
      <div class="summary-loading">
        <div class="spinner"></div>
        <span>Generating meeting summary...</span>
      </div>
    </div>
    
    <div class="assignment-info">
      <div class="assignment-title">${n(a.krisp_title||"Untitled Meeting")}</div>
      ${a.status_reason?`
        <div class="assignment-reason">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          ${n(a.status_reason)}
        </div>
      `:""}
      <div class="speakers-list">
        <strong>Speakers:</strong> ${a.speakers?.join(", ")||"None identified"}
      </div>
    </div>
    
    <div id="assignment-content">
      <div class="loading-spinner"></div>
    </div>
    
    <div class="action-buttons">
      <button type="button" class="btn btn-danger" id="skip-btn">Skip Transcript</button>
      <div style="flex: 1;"></div>
      <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button type="button" class="btn btn-primary" id="assign-btn" disabled>Assign to Project</button>
    </div>
  `;const e=k({id:p,title:"Assign to Project",content:t,size:"md"});document.body.appendChild(e),j(p),z(t),v(t,a),await A(t,a)}function z(s){const a=s.querySelector("#cancel-btn");a&&m(a,"click",()=>{g(p),d?.onClose?.()});const i=s.querySelector("#skip-btn");i&&m(i,"click",async()=>{if(!d?.transcript||!confirm("Are you sure you want to skip this transcript? It will not be processed."))return;await w(d.transcript.id,"Manually skipped")?(l.success("Transcript skipped"),g(p),d?.onAssign?.()):l.error("Failed to skip transcript")});const t=s.querySelector("#assign-btn");t&&m(t,"click",async()=>{s.querySelector(".candidate-item.selected, .project-select");let e=null;const o=s.querySelector(".candidate-item.selected");if(o)e=o.getAttribute("data-project-id");else{const r=s.querySelector(".project-select");r?.value&&(e=r.value)}if(!e||!d?.transcript){l.error("Please select a project");return}t.disabled=!0,t.textContent="Assigning...",await S(d.transcript.id,e)?(l.success("Transcript assigned to project"),g(p),d?.onAssign?.()):(l.error("Failed to assign project"),t.disabled=!1,t.textContent="Assign to Project")})}async function A(s,a){const i=s.querySelector("#assignment-content");if(i)try{f=(await $.get("/api/projects")).data.projects||[];const e=a.project_candidates||[];let o="";e.length>0&&(o+=`
        <div class="candidates-section">
          <h4>Suggested Projects (based on speakers)</h4>
          <div class="candidate-list">
            ${e.map(r=>`
              <div class="candidate-item" data-project-id="${r.projectId}">
                <div class="candidate-radio"></div>
                <div class="candidate-info">
                  <div class="candidate-name">${n(r.projectName||"Unknown")}</div>
                  <div class="candidate-code">${n(r.projectNumber||"")}</div>
                </div>
                <div class="candidate-confidence">${Math.round(r.percentage*100)}% match</div>
              </div>
            `).join("")}
          </div>
        </div>
      `),o+=`
      <div class="project-select-section">
        <h4>${e.length>0?"Or select another project":"Select a project"}</h4>
        <select class="project-select">
          <option value="">Choose a project...</option>
          ${f.map(r=>`
            <option value="${r.id}">${r.project_number?`${r.project_number} - `:""}${n(r.name)}</option>
          `).join("")}
        </select>
      </div>
    `,i.innerHTML=o,i.querySelectorAll(".candidate-item").forEach(r=>{m(r,"click",()=>{i.querySelectorAll(".candidate-item").forEach(h=>h.classList.remove("selected")),r.classList.add("selected");const u=i.querySelector(".project-select");u&&(u.value="");const b=s.querySelector("#assign-btn");b&&(b.disabled=!1)})});const c=i.querySelector(".project-select");c&&m(c,"change",()=>{i.querySelectorAll(".candidate-item").forEach(u=>u.classList.remove("selected"));const r=s.querySelector("#assign-btn");r&&(r.disabled=!c.value)})}catch(t){console.error("[ProjectAssignmentModal] Error loading projects:",t),i.innerHTML='<p style="color: #dc2626;">Failed to load projects. Please try again.</p>'}}async function v(s,a,i=!1){const t=s.querySelector("#meeting-summary");if(t){i&&(t.innerHTML=`
      <div class="summary-loading">
        <div class="spinner"></div>
        <span>Regenerating summary...</span>
      </div>
    `);try{const e=await M(a.id,{forceRegenerate:i});if(!e){t.innerHTML=`
        <div class="summary-header">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Meeting Summary
          <button class="refresh-summary-btn" title="Regenerate summary">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
        <p style="color: var(--text-secondary); font-size: 13px;">Unable to generate summary.</p>
      `,y(s,a);return}let o=`
      <div class="summary-header">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span style="flex: 1;">Meeting Summary</span>
        <button class="refresh-summary-btn" title="Regenerate summary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
    `;e.topic?o+=`<div class="summary-topic">${n(e.topic)}</div>`:e.notes&&(o+=`<div class="summary-topic">${n(e.notes)}</div>`),e.keyPoints&&e.keyPoints.length>0&&(o+=`
        <div class="summary-section">
          <div class="summary-section-title">Key Points</div>
          <ul class="summary-list">
            ${e.keyPoints.slice(0,5).map(r=>`<li>${n(String(r))}</li>`).join("")}
          </ul>
        </div>
      `),e.actionItems&&e.actionItems.length>0&&(o+=`
        <div class="summary-section">
          <div class="summary-section-title">Action Items</div>
          <ul class="summary-list">
            ${e.actionItems.slice(0,5).map(r=>`<li>${n(String(r))}</li>`).join("")}
          </ul>
        </div>
      `),e.decisions&&e.decisions.length>0&&(o+=`
        <div class="summary-section">
          <div class="summary-section-title">Decisions</div>
          <ul class="summary-list">
            ${e.decisions.slice(0,3).map(r=>`<li>${n(String(r))}</li>`).join("")}
          </ul>
        </div>
      `),e.nextSteps&&(o+=`
        <div class="summary-section">
          <div class="summary-section-title">Next Steps</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">${n(e.nextSteps)}</p>
        </div>
      `);const c={krisp_metadata:"From Krisp",ai_generated:"AI Generated",excerpt_fallback:"Excerpt",no_content:""};e.source&&c[e.source]&&(o+=`<div class="summary-source">${c[e.source]}</div>`),t.innerHTML=o,y(s,a)}catch(e){console.error("[ProjectAssignmentModal] Summary error:",e),t.innerHTML=`
      <div class="summary-header">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span style="flex: 1;">Meeting Summary</span>
        <button class="refresh-summary-btn" title="Regenerate summary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
      <p style="color: var(--text-secondary); font-size: 13px;">Could not load summary.</p>
    `,y(s,a)}}}function y(s,a){const i=s.querySelector(".refresh-summary-btn");i&&m(i,"click",async t=>{t.preventDefault(),t.stopPropagation(),await v(s,a,!0),l.success("Summary regenerated")})}function n(s){const a=document.createElement("div");return a.textContent=s,a.innerHTML}export{q as showProjectAssignmentModal};
//# sourceMappingURL=ProjectAssignmentModal-BFkXe-kE.js.map
