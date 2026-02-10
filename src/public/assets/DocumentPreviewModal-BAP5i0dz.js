import{f as N,a as S,h as x,t as y,b as B}from"./main-DsXjfhBM.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let L=!1,C=null;function pe(n){const{document:e}=n,t=document.createElement("div");t.className="document-preview-modal",t.innerHTML=`
    <style>
      .document-preview-modal {
        display: flex;
        flex-direction: column;
        height: 80vh;
        max-height: 800px;
        width: 900px;
        max-width: 95vw;
      }
      .preview-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
      }
      .preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
      }
      .preview-title-section {
        flex: 1;
        min-width: 0;
      }
      .preview-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preview-meta {
        display: flex;
        gap: 12px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .preview-meta span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .preview-actions {
        display: flex;
        gap: 8px;
      }
      .preview-actions .btn {
        padding: 8px 12px;
        font-size: 13px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .btn-favorite {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
      }
      .btn-favorite.active {
        background: rgba(255, 193, 7, 0.1);
        border-color: #ffc107;
        color: #ffc107;
      }
      .preview-tabs {
        display: flex;
        gap: 0;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .preview-tab {
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary);
        background: transparent;
        border: none;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      }
      .preview-tab:hover {
        color: var(--text-primary);
        background: rgba(var(--primary-rgb), 0.05);
      }
      .preview-tab.active {
        color: var(--primary);
      }
      .preview-tab.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--primary);
        border-radius: 2px 2px 0 0;
      }
      .preview-tab-badge {
        margin-left: 6px;
        padding: 2px 6px;
        font-size: 11px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 10px;
        color: var(--primary);
      }
      .preview-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      .preview-section {
        display: none;
      }
      .preview-section.active {
        display: block;
      }
      
      /* Content Preview */
      .content-preview {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        max-height: 500px;
        overflow-y: auto;
      }
      .content-empty, .content-loading {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary);
      }
      .content-loading::after {
        content: '';
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-left: 8px;
        vertical-align: middle;
      }
      .content-empty svg {
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: 16px;
      }
      
      /* Summary Section */
      .summary-card {
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), rgba(var(--primary-rgb), 0.02));
        border: 1px solid rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .summary-card h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .summary-card p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-secondary);
      }
      
      /* Entities Grid */
      .entities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-top: 20px;
      }
      .entity-card {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: background 0.3s ease, transform 0.2s ease;
      }
      .entity-card.updated {
        animation: pulse-highlight 1.5s ease;
      }
      @keyframes pulse-highlight {
        0% { background: rgba(var(--primary-rgb), 0.3); transform: scale(1.02); }
        50% { background: rgba(var(--primary-rgb), 0.15); }
        100% { background: var(--bg-secondary); transform: scale(1); }
      }
      .entity-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      .entity-icon.facts { background: rgba(59, 130, 246, 0.1); }
      .entity-icon.decisions { background: rgba(16, 185, 129, 0.1); }
      .entity-icon.risks { background: rgba(239, 68, 68, 0.1); }
      .entity-icon.actions { background: rgba(245, 158, 11, 0.1); }
      .entity-icon.questions { background: rgba(139, 92, 246, 0.1); }
      .entity-icon.people { background: rgba(6, 182, 212, 0.1); }
      .entity-info h5 {
        margin: 0 0 2px 0;
        font-size: 20px;
        font-weight: 600;
      }
      .entity-info span {
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      /* Analysis List */
      .analysis-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .analysis-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 10px;
        transition: all 0.2s;
      }
      .analysis-item:hover {
        background: rgba(var(--primary-rgb), 0.05);
      }
      .analysis-version {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: var(--primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
      }
      .analysis-info {
        flex: 1;
        min-width: 0;
      }
      .analysis-title {
        font-weight: 500;
        margin-bottom: 4px;
      }
      .analysis-meta {
        font-size: 12px;
        color: var(--text-secondary);
        display: flex;
        gap: 12px;
      }
      .analysis-actions {
        display: flex;
        gap: 8px;
      }
      
      /* Activity Timeline */
      .activity-timeline {
        position: relative;
        padding-left: 24px;
      }
      .activity-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border-color);
      }
      .activity-item {
        position: relative;
        padding: 12px 0 12px 20px;
      }
      .activity-item::before {
        content: '';
        position: absolute;
        left: -20px;
        top: 18px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--primary);
        border: 2px solid var(--bg-primary);
      }
      .activity-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .activity-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
      .activity-text {
        flex: 1;
      }
      .activity-text strong {
        font-weight: 500;
      }
      .activity-time {
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      /* Versions List */
      .versions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .version-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 10px;
        border: 1px solid transparent;
      }
      .version-item.current {
        border-color: var(--primary);
        background: rgba(var(--primary-rgb), 0.05);
      }
      .version-badge {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
      }
      .version-item.current .version-badge {
        background: var(--primary);
        color: white;
      }
      .version-info {
        flex: 1;
        min-width: 0;
      }
      .version-title {
        font-weight: 500;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .version-title .current-tag {
        font-size: 10px;
        padding: 2px 6px;
        background: var(--primary);
        color: white;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .version-notes {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .version-meta {
        font-size: 12px;
        color: var(--text-tertiary);
      }
      .version-ai-summary {
        margin-top: 8px;
        padding: 10px;
        background: rgba(var(--primary-rgb), 0.05);
        border-radius: 6px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .version-ai-summary strong {
        color: var(--primary);
      }
      
      /* Tags Section */
      .tags-section {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }
      .doc-tag {
        padding: 4px 10px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
        font-size: 12px;
        color: var(--primary);
      }
      
      /* Share Panel */
      .share-panel {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
      }
      .share-link-container {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .share-link-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 13px;
        background: var(--bg-primary);
      }
      .share-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .share-option {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .share-option label {
        font-size: 12px;
        color: var(--text-secondary);
      }
      .share-option input, .share-option select {
        padding: 8px 10px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 13px;
        background: var(--bg-primary);
      }
      
      /* Empty State */
      .empty-section {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary);
      }
      .empty-section svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
        margin-bottom: 12px;
      }
      
      /* Spinner for button loading state */
      .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 6px;
        vertical-align: middle;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      #reprocess-btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }
    </style>
    
    <div class="preview-header">
      <div class="preview-icon">${oe(e.filename||"")}</div>
      <div class="preview-title-section">
        <h3 class="preview-title">${d(e.filename||e.originalName||"Untitled")}</h3>
        <div class="preview-meta">
          <span>${N(e.size||0)}</span>
          <span>${S(e.created_at)}</span>
          <span class="status-badge status-${e.status}">${e.status}</span>
        </div>
      </div>
      <div class="preview-actions">
        <button class="btn btn-favorite ${L?"active":""}" id="favorite-btn" title="Favorite">
          ${L?"★":"☆"}
        </button>
        <button class="btn btn-secondary" id="share-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share
        </button>
        <button class="btn btn-secondary" id="download-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
        <button class="btn btn-primary" id="reprocess-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Reprocess
        </button>
      </div>
    </div>
    
    <div class="preview-tabs">
      <button class="preview-tab active" data-tab="preview">Preview</button>
      <button class="preview-tab hidden" data-tab="entities" id="entities-tab">
        Entities
        <span class="preview-tab-badge" id="entities-count">0</span>
      </button>
      <button class="preview-tab" data-tab="analysis">
        AI Analysis
        <span class="preview-tab-badge" id="analysis-count">0</span>
      </button>
      <button class="preview-tab hidden" data-tab="notes" id="notes-tab">
        Meeting Notes
      </button>
      <button class="preview-tab" data-tab="versions">
        Versions
        <span class="preview-tab-badge" id="versions-count">1</span>
      </button>
      <button class="preview-tab" data-tab="activity">Activity</button>
      <button class="preview-tab" data-tab="share">Share</button>
    </div>
    
    <div class="preview-content">
      <!-- Preview Tab -->
      <div class="preview-section active" data-section="preview">
        <div class="summary-card${e.summary?"":" hidden"}" id="summary-card">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              AI Summary
            </h4>
            <p id="doc-summary">${e.summary?d(e.summary):""}</p>
          </div>
        
        <div class="entities-grid" id="entities-grid">
          <div class="entity-card" data-entity="facts">
            <div class="entity-icon facts">📋</div>
            <div class="entity-info">
              <h5 class="entity-count">${e.facts_count||0}</h5>
              <span>Facts</span>
            </div>
          </div>
          <div class="entity-card" data-entity="decisions">
            <div class="entity-icon decisions">✓</div>
            <div class="entity-info">
              <h5 class="entity-count">${e.decisions_count||0}</h5>
              <span>Decisions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="risks">
            <div class="entity-icon risks">⚠️</div>
            <div class="entity-info">
              <h5 class="entity-count">${e.risks_count||0}</h5>
              <span>Risks</span>
            </div>
          </div>
          <div class="entity-card" data-entity="actions">
            <div class="entity-icon actions">📌</div>
            <div class="entity-info">
              <h5 class="entity-count">${e.actions_count||0}</h5>
              <span>Actions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="questions">
            <div class="entity-icon questions">❓</div>
            <div class="entity-info">
              <h5 class="entity-count">${e.questions_count||0}</h5>
              <span>Questions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="people">
            <div class="entity-icon people">👥</div>
            <div class="entity-info">
              <h5 class="entity-count" id="people-count">${e.people_count||0}</h5>
              <span>People</span>
            </div>
          </div>
        </div>
        
        ${e.tags?.length?`
          <div class="tags-section">
            ${e.tags.map(o=>`<span class="doc-tag">#${d(o)}</span>`).join("")}
          </div>
        `:""}
        
        <h4 class="document-preview-content-heading">Content Preview</h4>
        <div class="content-preview" id="content-preview">
          <div class="content-loading">Loading content...</div>
        </div>
      </div>
      
      <!-- Entities Tab (full extraction results) -->
      <div class="preview-section" data-section="entities">
        <div class="entities-full-list" id="entities-full-list">
          <div class="empty-section">Loading entities...</div>
        </div>
      </div>
      
      <!-- AI Analysis Tab -->
      <div class="preview-section" data-section="analysis">
        <div class="analysis-list" id="analysis-list">
          <div class="empty-section">Loading analysis history...</div>
        </div>
      </div>
      
      <!-- Versions Tab -->
      <div class="preview-section" data-section="versions">
        <div class="document-preview-actions-row">
          <button class="btn btn-primary" id="upload-version-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload New Version
          </button>
        </div>
        <div class="versions-list" id="versions-list">
          <div class="empty-section">Loading versions...</div>
        </div>
      </div>
      
      <!-- Meeting Notes Tab -->
      <div class="preview-section" data-section="notes">
        <div class="notes-container" id="notes-container">
          <div class="empty-section">No meeting notes available</div>
        </div>
      </div>
      
      <!-- Activity Tab -->
      <div class="preview-section" data-section="activity">
        <div class="activity-timeline" id="activity-timeline">
          <div class="empty-section">Loading activity...</div>
        </div>
      </div>
      
      <!-- Share Tab -->
      <div class="preview-section" data-section="share">
        <div class="share-panel">
          <h4 class="document-preview-share-heading">Create Share Link</h4>
          <div class="share-link-container">
            <input type="text" class="share-link-input" id="share-link-input" placeholder="Generate a link to share..." readonly>
            <button class="btn btn-primary" id="generate-link-btn">Generate</button>
            <button class="btn btn-secondary hidden" id="copy-link-btn">Copy</button>
          </div>
          <div class="share-options">
            <div class="share-option">
              <label>Expires</label>
              <select id="share-expires">
                <option value="1d">1 day</option>
                <option value="7d" selected>7 days</option>
                <option value="30d">30 days</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div class="share-option">
              <label>Max Views</label>
              <input type="number" id="share-max-views" placeholder="Unlimited" min="1">
            </div>
            <div class="share-option">
              <label>Password (optional)</label>
              <input type="password" id="share-password" placeholder="No password">
            </div>
            <div class="share-option">
              <label>Permissions</label>
              <select id="share-permissions">
                <option value="view">View only</option>
                <option value="download">View & Download</option>
              </select>
            </div>
          </div>
        </div>
        <div class="document-preview-active-shares" id="active-shares"></div>
      </div>
    </div>
  `,t.querySelectorAll(".preview-tab").forEach(o=>{o.addEventListener("click",()=>{const c=o.getAttribute("data-tab");H(t,c)})}),t.querySelector("#favorite-btn")?.addEventListener("click",()=>Z(t,e)),t.querySelector("#share-btn")?.addEventListener("click",()=>H(t,"share")),t.querySelector("#download-btn")?.addEventListener("click",()=>ee(e)),t.querySelector("#reprocess-btn")?.addEventListener("click",()=>ne(e,n.onUpdate)),t.querySelector("#upload-version-btn")?.addEventListener("click",()=>ie(e,t,n.onUpdate)),t.querySelector("#generate-link-btn")?.addEventListener("click",()=>ae(t,e)),t.querySelector("#copy-link-btn")?.addEventListener("click",()=>se(t)),D(t,e.id),M(t,e.id),q(t,e.id),P(t,e.id),F(t,e.id),K(t,e.id),X(e.id).then(o=>{L=o,R(t)});const a=document.createElement("div");a.className="modal-overlay document-preview-overlay";const r=document.createElement("div");r.className="modal-container document-preview-modal-container";const i=document.createElement("button");i.className="document-preview-close-btn",i.innerHTML="×",i.onclick=()=>z(a,n.onClose),t.classList.add("position-relative"),t.appendChild(i),r.appendChild(t),a.appendChild(r),a.addEventListener("click",o=>{o.target===a&&z(a,n.onClose)});const l=o=>{o.key==="Escape"&&(z(a,n.onClose),document.removeEventListener("keydown",l))};document.addEventListener("keydown",l),document.body.appendChild(a)}function z(n,e){C&&(clearInterval(C),C=null),n.style.animation="fadeOut 0.2s ease-out",setTimeout(()=>{n.remove(),e?.()},200)}function H(n,e){n.querySelectorAll(".preview-tab").forEach(t=>{t.classList.toggle("active",t.getAttribute("data-tab")===e)}),n.querySelectorAll(".preview-section").forEach(t=>{t.classList.toggle("active",t.getAttribute("data-section")===e)})}async function D(n,e){const t=n.querySelector("#content-preview");try{const a=await x.get(`/api/documents/${e}`),i=(a.data.document||a.data)?.content;if(i){const l=i.length>5e3;t.innerHTML=`<pre class="conv-notes-pre">${d(i.substring(0,5e3))}${l?`

... (truncated)`:""}</pre>`}else t.innerHTML='<div class="content-empty">No content extracted</div>'}catch(a){console.error("[Preview] Failed to load content:",a),t.innerHTML='<div class="content-empty">Failed to load content</div>'}}async function M(n,e){const t=n.querySelector("#entities-full-list"),a=n.querySelector("#entities-tab"),r=n.querySelector("#entities-count"),i=n.querySelector("#people-count");try{const o=(await x.get(`/api/documents/${e}/extraction`)).data.extraction;if(!o){t.innerHTML='<div class="empty-section">No extraction data available</div>';return}const c=o.entities||[],m=o.facts||[],u=o.decisions||[],g=o.action_items||[],h=o.questions||[],s=o.risks||[],b=o.participants||[],$=c.filter(p=>p.type?.toLowerCase()==="person"),k=[...b];for(const p of $)k.some(w=>w.name?.toLowerCase()===p.name?.toLowerCase())||k.push({name:p.name,role:void 0,organization:void 0});i&&(i.textContent=String(k.length));const f=c.length+m.length+u.length+g.length+h.length+s.length+k.length;if(f===0){t.innerHTML='<div class="empty-section">No entities extracted</div>';return}a&&a.classList.remove("hidden"),r&&(r.textContent=String(f));let v=`<style>
      .entity-section { margin-bottom: 24px; }
      .entity-section-title { 
        font-size: 14px; 
        font-weight: 600; 
        color: var(--text-secondary); 
        margin-bottom: 12px; 
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .entity-section-count {
        font-size: 11px;
        background: rgba(var(--primary-rgb), 0.1);
        padding: 2px 8px;
        border-radius: 10px;
        color: var(--primary);
      }
      .entity-item {
        padding: 12px 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .entity-item-type {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-tertiary);
        margin-bottom: 4px;
      }
      .entity-item-content {
        color: var(--text-primary);
      }
      .entity-item-meta {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 4px;
      }
    </style>`;c.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          🔗 Graph Entities
          <span class="entity-section-count">${c.length}</span>
        </div>
        ${c.map(p=>`
          <div class="entity-item">
            <div class="entity-item-type">${d(p.type)}</div>
            <div class="entity-item-content">${d(p.name)}</div>
            ${p.confidence?`<div class="entity-item-meta">Confidence: ${Math.round(p.confidence*100)}%</div>`:""}
          </div>
        `).join("")}
      </div>`),m.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          📋 Facts
          <span class="entity-section-count">${m.length}</span>
        </div>
        ${m.map(p=>`
          <div class="entity-item">
            ${p.category?`<div class="entity-item-type">${d(p.category)}</div>`:""}
            <div class="entity-item-content">${d(p.content)}</div>
            ${p.confidence?`<div class="entity-item-meta">Confidence: ${Math.round(p.confidence*100)}%</div>`:""}
          </div>
        `).join("")}
      </div>`),u.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          ✓ Decisions
          <span class="entity-section-count">${u.length}</span>
        </div>
        ${u.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
          </div>
        `).join("")}
      </div>`),g.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          📌 Action Items
          <span class="entity-section-count">${g.length}</span>
        </div>
        ${g.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">☐ ${d(p.task)}</div>
            ${p.owner?`<div class="entity-item-meta">Owner: ${d(p.owner)}</div>`:""}
            ${p.status?`<div class="entity-item-meta">Status: ${d(p.status)}</div>`:""}
          </div>
        `).join("")}
      </div>`),h.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          ❓ Questions
          <span class="entity-section-count">${h.length}</span>
        </div>
        ${h.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
          </div>
        `).join("")}
      </div>`),s.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          ⚠️ Risks
          <span class="entity-section-count">${s.length}</span>
        </div>
        ${s.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
            ${p.severity?`<div class="entity-item-meta">Severity: ${d(p.severity)}</div>`:""}
          </div>
        `).join("")}
      </div>`),k.length>0&&(v+=`<div class="entity-section" id="people-section">
        <div class="entity-section-title">
          👥 People
          <span class="entity-section-count">${k.length}</span>
        </div>
        <style>
          .person-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border-radius: 8px;
            margin-bottom: 8px;
            gap: 12px;
          }
          .person-info {
            flex: 1;
            min-width: 0;
          }
          .person-name {
            font-weight: 500;
            color: var(--text-primary);
          }
          .person-role {
            font-size: 12px;
            color: var(--text-tertiary);
            margin-top: 2px;
          }
          .person-linked {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--success);
          }
          .person-linked svg {
            width: 14px;
            height: 14px;
          }
          .person-unlinked {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .person-link-btn {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            background: var(--bg-primary);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .person-link-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
            background: rgba(var(--primary-rgb), 0.05);
          }
          .person-create-btn {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 4px;
            border: none;
            background: var(--primary);
            color: white;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .person-create-btn:hover {
            opacity: 0.9;
          }
        </style>
        ${k.map((p,w)=>`
          <div class="person-item" data-person-index="${w}" data-person-name="${d(p.name||"")}">
            <div class="person-info">
              <div class="person-name">${d(p.name||"Unknown")}</div>
              ${p.role||p.organization?`
                <div class="person-role">
                  ${p.role?d(p.role):""}${p.role&&p.organization?" at ":""}${p.organization?d(p.organization):""}
                </div>
              `:""}
            </div>
            ${p.contact_id?`
              <div class="person-linked">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Linked to ${d(p.contact_name||"contact")}
              </div>
            `:`
              <div class="person-unlinked">
                <button class="person-link-btn" data-action="link" data-name="${d(p.name||"")}">
                  Link to Contact
                </button>
                <button class="person-create-btn" data-action="create" data-name="${d(p.name||"")}" data-role="${d(p.role||"")}" data-org="${d(p.organization||"")}">
                  + Create Contact
                </button>
              </div>
            `}
          </div>
        `).join("")}
      </div>`),t.innerHTML=v,V(n,e)}catch{t.innerHTML='<div class="empty-section">Failed to load entities</div>'}}function V(n,e){const t=n.querySelector("#people-section");if(!t)return;const a=window.currentProjectId||document.body.dataset.projectId||n.closest("[data-project-id]")?.getAttribute("data-project-id")||"";t.querySelectorAll(".person-link-btn").forEach(r=>{r.addEventListener("click",async i=>{i.stopPropagation();const l=r.dataset.name||"";await O(r,l,a,n,e)})}),t.querySelectorAll(".person-create-btn").forEach(r=>{r.addEventListener("click",async i=>{i.stopPropagation();const l=r.dataset.name||"",o=r.dataset.role||"",c=r.dataset.org||"";await W(l,o,c,a,r,n,e)})})}async function O(n,e,t,a,r){document.querySelectorAll(".contact-link-dropdown").forEach(u=>u.remove());const i=document.createElement("div");i.className="contact-link-dropdown",i.innerHTML=`
    <style>
      .contact-link-dropdown {
        position: absolute;
        z-index: 10000;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 280px;
        max-height: 300px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .contact-link-search {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
      }
      .contact-link-search input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 13px;
      }
      .contact-link-search input:focus {
        outline: none;
        border-color: var(--primary);
      }
      .contact-link-list {
        overflow-y: auto;
        max-height: 220px;
        padding: 8px;
      }
      .contact-link-item {
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .contact-link-item:hover {
        background: var(--bg-secondary);
      }
      .contact-link-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        font-weight: 500;
      }
      .contact-link-info {
        flex: 1;
        min-width: 0;
      }
      .contact-link-name {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 13px;
      }
      .contact-link-email {
        font-size: 11px;
        color: var(--text-tertiary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .contact-link-empty {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary);
        font-size: 13px;
      }
      .contact-link-loading {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary);
      }
    </style>
    <div class="contact-link-search">
      <input type="text" placeholder="Search contacts..." autofocus>
    </div>
    <div class="contact-link-list">
      <div class="contact-link-loading">Loading contacts...</div>
    </div>
  `;const l=n.getBoundingClientRect();i.style.position="fixed",i.style.top=`${l.bottom+4}px`,i.style.left=`${Math.max(10,l.left-100)}px`,document.body.appendChild(i);const o=i.querySelector("input");o?.focus();try{const g=(await x.get(`/api/contacts?project_id=${t}&limit=100`)).data.contacts||[],h=i.querySelector(".contact-link-list");g.length===0?h.innerHTML='<div class="contact-link-empty">No contacts found</div>':A(h,g,e,t,a,r,i),o?.addEventListener("input",()=>{const s=o.value.toLowerCase(),b=g.filter($=>$.name?.toLowerCase().includes(s)||$.email?.toLowerCase().includes(s));A(h,b,e,t,a,r,i)})}catch(u){console.error("[People] Failed to load contacts:",u);const g=i.querySelector(".contact-link-list");g.innerHTML='<div class="contact-link-empty">Failed to load contacts</div>'}const c=u=>{!i.contains(u.target)&&u.target!==n&&(i.remove(),document.removeEventListener("click",c))};setTimeout(()=>document.addEventListener("click",c),100);const m=u=>{u.key==="Escape"&&(i.remove(),document.removeEventListener("keydown",m))};document.addEventListener("keydown",m)}function A(n,e,t,a,r,i,l){if(e.length===0){n.innerHTML='<div class="contact-link-empty">No matching contacts</div>';return}n.innerHTML=e.map(o=>{const c=(o.name||"?").split(" ").map(m=>m[0]).slice(0,2).join("").toUpperCase();return`
      <div class="contact-link-item" data-contact-id="${o.id}" data-contact-name="${d(o.name||"")}">
        <div class="contact-link-avatar">${c}</div>
        <div class="contact-link-info">
          <div class="contact-link-name">${d(o.name||"Unknown")}</div>
          ${o.email?`<div class="contact-link-email">${d(o.email)}</div>`:""}
        </div>
      </div>
    `}).join(""),n.querySelectorAll(".contact-link-item").forEach(o=>{o.addEventListener("click",async()=>{const c=o.dataset.contactId||"",m=o.dataset.contactName||"";try{await x.post("/api/contacts/link-participant",{projectId:a,participantName:t,contactId:c}),y.success(`Linked "${t}" to ${m}`),l.remove(),M(r,i)}catch(u){console.error("[People] Failed to link:",u),y.error("Failed to link contact")}})})}async function W(n,e,t,a,r,i,l){const o=r.textContent;r.textContent="Creating...",r.disabled=!0;try{const c=await x.post("/api/contacts",{project_id:a,name:n,role:e||void 0,organization:t||void 0,source:"document_extraction"});c.data.ok&&c.data.contact?(y.success(`Created contact: ${c.data.contact.name}`),M(i,l)):(y.error(c.data.error||"Failed to create contact"),r.textContent=o,r.disabled=!1)}catch(c){console.error("[People] Failed to create contact:",c),y.error("Failed to create contact"),r.textContent=o,r.disabled=!1}}async function q(n,e){const t=n.querySelector("#analysis-list");try{const r=(await x.get(`/api/documents/${e}/analysis`)).data.analyses||[];if(n.querySelector("#analysis-count").textContent=String(r.length),r.length===0){t.innerHTML=`
        <div class="empty-section">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>No AI analyses yet</p>
          <button class="btn btn-primary btn-sm" id="run-analysis-btn">Run Analysis</button>
        </div>
      `;const i=t.querySelector("#run-analysis-btn");i&&i.addEventListener("click",async()=>{const l=i,o=l.textContent;l.disabled=!0,l.textContent="Analyzing...";try{const c=await x.post(`/api/documents/${e}/reprocess`,{});c.data.success?(y.success("Analysis started"),setTimeout(()=>q(n,e),3e3)):(y.error(c.data.error||"Failed to start analysis"),l.disabled=!1,l.textContent=o)}catch(c){y.error(c.message||"Failed to run analysis"),l.disabled=!1,l.textContent=o}});return}t.innerHTML=r.map((i,l)=>`
      <div class="analysis-item" data-id="${i.id}">
        <div class="analysis-version">v${r.length-l}</div>
        <div class="analysis-info">
          <div class="analysis-title">${E(i.analysis_type)}</div>
          <div class="analysis-meta">
            <span>${i.provider}/${i.model}</span>
            <span>${i.entities_extracted||0} entities</span>
            <span>${(i.input_tokens||0)+(i.output_tokens||0)} tokens</span>
            ${i.cost?`<span>$${i.cost.toFixed(4)}</span>`:""}
          </div>
          <div class="analysis-timestamp">
            ${B(i.created_at)} (${S(i.created_at)})
          </div>
        </div>
        <div class="analysis-actions">
          <button class="btn btn-sm view-analysis-btn">View</button>
          <button class="btn btn-sm compare-analysis-btn">Compare</button>
        </div>
      </div>
    `).join(""),t.querySelectorAll(".view-analysis-btn").forEach((i,l)=>{i.addEventListener("click",()=>{const o=r[l];G(n,o)})}),t.querySelectorAll(".compare-analysis-btn").forEach((i,l)=>{i.addEventListener("click",()=>{if(r.length<2){y.info("Need at least 2 analyses to compare");return}y.info("Compare feature coming soon")})})}catch{t.innerHTML='<div class="empty-section">No analysis history available</div>'}}async function G(n,e){let t=e.result;if(e.document_id)try{const s=await x.get(`/api/documents/${e.document_id}/extraction`);s.data.extraction&&(t=s.data.extraction,console.log("[Analysis] Loaded enriched extraction from /extraction endpoint"))}catch(s){if(console.warn("[Analysis] Could not load extraction:",s),!t)try{const b=await x.get(`/api/documents/${e.document_id}`);t=b.data.document?.extraction_result||b.data.extraction_result}catch{}}const a=document.createElement("div");a.className="analysis-detail-overlay";const r=t?JSON.stringify(t,null,2):"No detailed result available";let i="",l=[];if(t){const s=t;s.summary?i=s.summary:s.meeting?.title&&(i=`Meeting: ${s.meeting.title}`);const b=s.participants||[],k=(s.entities||[]).filter(v=>v.type?.toLowerCase()==="person"),f=new Set;for(const v of b)v.name&&!f.has(v.name.toLowerCase())&&(f.add(v.name.toLowerCase()),l.push({name:v.name,role:v.role,organization:v.organization,contact_id:v.contact_id,contact_name:v.contact_name,contact_email:v.contact_email,contact_avatar:v.contact_avatar,contact_role:v.contact_role}));for(const v of k)v.name&&!f.has(v.name.toLowerCase())&&(f.add(v.name.toLowerCase()),l.push({name:v.name,contact_id:v.contact_id,contact_name:v.contact_name,contact_email:v.contact_email,contact_avatar:v.contact_avatar,contact_role:v.contact_role}))}const o=l.filter(s=>s.contact_id),c=l.filter(s=>!s.contact_id),m=l.length>0?`
    <div class="analysis-people-section">
      <h4 class="analysis-people-title">
        <span class="analysis-people-title-emoji">👥</span> People Detected
        <span class="analysis-people-badge">${l.length}</span>
        ${o.length>0?`<span class="analysis-people-badge analysis-people-badge-linked">✓ ${o.length} linked</span>`:""}
      </h4>
      
      ${o.length>0?`
        <div class="analysis-people-linked-wrap">
          <div class="analysis-people-section-label">Linked to Contacts</div>
          <div class="analysis-people-chips">
            ${o.map(s=>`
              <div class="person-chip linked entity-chip entity-chip-linked" data-name="${d(s.name)}" data-contact-id="${d(s.contact_id||"")}" data-contact-name="${d(s.contact_name||"")}">
                ${s.contact_avatar?`
                  <img class="entity-chip-avatar" src="${d(s.contact_avatar)}" alt="">
                `:`
                  <div class="entity-chip-avatar-placeholder">${(s.contact_name||s.name||"?").split(" ").map(b=>b[0]).slice(0,2).join("").toUpperCase()}</div>
                `}
                <div class="entity-chip-body">
                  <div class="entity-chip-linked-row">
                    <span class="entity-chip-name">${d(s.name)}</span>
                    <svg class="entity-chip-linked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div class="entity-chip-meta entity-chip-meta-ellipsis">
                    → ${d(s.contact_name||"Contact")}${s.contact_role?` • ${d(s.contact_role)}`:""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `:""}
      
      ${c.length>0?`
        <div>
          <div class="analysis-people-section-label">
            ${o.length>0?"Not Yet Linked":"Click to Link or Create Contact"}
          </div>
          <div class="analysis-people-chips">
            ${c.map(s=>`
              <div class="person-chip unlinked entity-chip entity-chip-unlinked" data-name="${d(s.name)}" data-role="${d(s.role||"")}" data-org="${d(s.organization||"")}">
                <div class="entity-chip-avatar-placeholder">${(s.name||"?").split(" ").map(b=>b[0]).slice(0,2).join("").toUpperCase()}</div>
                <div class="entity-chip-body">
                  <div class="entity-chip-name">${d(s.name)}</div>
                  ${s.role||s.organization?`<div class="entity-chip-meta">${s.role||""}${s.role&&s.organization?" • ":""}${s.organization||""}</div>`:""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `:""}
      
      <p class="analysis-people-hint">
        💡 Click on any person to ${o.length>0?"view/change the link":"link them to a contact or create a new one"}
      </p>
    </div>
  `:"",u=document.createElement("div");u.className="analysis-detail-content",u.innerHTML=`
    <div class="analysis-detail-header">
      <div>
        <h3 class="analysis-detail-title">${E(e.analysis_type)} Analysis</h3>
        <p class="analysis-detail-meta">
          ${e.provider}/${e.model} • ${e.entities_extracted||0} entities • ${S(e.created_at)}
        </p>
      </div>
      <button type="button" class="close-analysis-btn analysis-detail-close-btn">&times;</button>
    </div>
    ${i?`
      <div class="analysis-detail-summary-block">
        <strong class="analysis-detail-summary-label">Summary:</strong>
        <p class="analysis-detail-summary-text">${d(i)}</p>
      </div>
    `:""}
    <div class="analysis-detail-body">
      <div class="analysis-detail-stats">
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${e.entities_extracted||0}</div>
          <div class="analysis-detail-stat-label">Entities</div>
        </div>
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${e.input_tokens||0}</div>
          <div class="analysis-detail-stat-label">Input Tokens</div>
        </div>
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${e.output_tokens||0}</div>
          <div class="analysis-detail-stat-label">Output Tokens</div>
        </div>
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${e.latency_ms?`${(e.latency_ms/1e3).toFixed(1)}s`:"-"}</div>
          <div class="analysis-detail-stat-label">Latency</div>
        </div>
      </div>
      ${m}
      <details class="analysis-detail-raw-wrap">
        <summary class="analysis-detail-raw-summary">Raw Result JSON</summary>
        <pre class="analysis-detail-raw-pre">${d(r)}</pre>
      </details>
    </div>
  `,a.appendChild(u),document.body.appendChild(a),u.querySelector(".close-analysis-btn")?.addEventListener("click",()=>a.remove()),a.addEventListener("click",s=>{s.target===a&&a.remove()});const h=window.currentProjectId||document.body.dataset.projectId||n.closest("[data-project-id]")?.getAttribute("data-project-id")||"";u.querySelectorAll(".person-chip").forEach(s=>{const b=s;s.addEventListener("click",async $=>{$.stopPropagation();const k=b.dataset.name||"",f=b.dataset.role||"",v=b.dataset.org||"",p=b.dataset.contactId||"",w=b.dataset.contactName||"";await J(b,k,f,v,h,p,w)})})}async function J(n,e,t,a,r,i="",l=""){document.querySelectorAll(".person-link-menu").forEach(s=>s.remove());const o=!!i,c=document.createElement("div");c.className="person-link-menu",c.innerHTML=`
    <style>
      .person-link-menu {
        position: fixed;
        z-index: 10002;
        background: var(--bg-primary, #1a1a2e);
        border: 1px solid var(--border-color, #333);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        min-width: 320px;
        max-height: 450px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .person-link-menu-header {
        padding: 16px;
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-header h4 {
        margin: 0 0 4px 0;
        color: var(--text-primary, #fff);
        font-size: 14px;
      }
      .person-link-menu-header p {
        margin: 0;
        color: var(--text-tertiary, #666);
        font-size: 12px;
      }
      .person-link-menu-current {
        padding: 12px 16px;
        background: rgba(16, 185, 129, 0.1);
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-current-label {
        font-size: 11px;
        color: #10b981;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }
      .person-link-menu-current-contact {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--bg-secondary, #252542);
        border-radius: 8px;
      }
      .person-link-menu-current-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981, #059669);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        font-weight: 600;
      }
      .person-link-menu-current-info {
        flex: 1;
      }
      .person-link-menu-current-name {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-primary, #fff);
      }
      .person-link-menu-current-badge {
        font-size: 11px;
        color: #10b981;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .person-link-menu-unlink-btn {
        padding: 6px 12px;
        font-size: 12px;
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .person-link-menu-unlink-btn:hover {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.5);
      }
      .person-link-menu-divider {
        padding: 8px 16px;
        font-size: 11px;
        color: var(--text-tertiary, #666);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-search {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-search input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color, #333);
        border-radius: 8px;
        background: var(--bg-secondary, #252542);
        color: var(--text-primary, #fff);
        font-size: 13px;
      }
      .person-link-menu-search input:focus {
        outline: none;
        border-color: var(--accent-color, #6366f1);
      }
      .person-link-menu-list {
        overflow-y: auto;
        max-height: 180px;
        padding: 8px;
      }
      .person-link-menu-item {
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text-primary, #fff);
      }
      .person-link-menu-item:hover {
        background: var(--bg-secondary, #252542);
      }
      .person-link-menu-item.selected {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .person-link-menu-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-color, #6366f1), #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
      }
      .person-link-menu-info {
        flex: 1;
        min-width: 0;
      }
      .person-link-menu-name {
        font-weight: 500;
        font-size: 13px;
      }
      .person-link-menu-email {
        font-size: 11px;
        color: var(--text-tertiary, #666);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .person-link-menu-actions {
        padding: 12px 16px;
        border-top: 1px solid var(--border-color, #333);
        display: flex;
        gap: 8px;
      }
      .person-link-menu-btn {
        flex: 1;
        padding: 10px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .person-link-menu-btn.primary {
        background: var(--accent-color, #6366f1);
        color: white;
        border: none;
      }
      .person-link-menu-btn.primary:hover {
        opacity: 0.9;
      }
      .person-link-menu-btn.secondary {
        background: transparent;
        color: var(--text-secondary, #888);
        border: 1px solid var(--border-color, #333);
      }
      .person-link-menu-btn.secondary:hover {
        border-color: var(--text-secondary, #888);
      }
      .person-link-menu-empty {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary, #666);
        font-size: 13px;
      }
      .person-link-menu-loading {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary, #666);
      }
    </style>
    <div class="person-link-menu-header">
      <h4>${o?"Change Link":"Link"} "${d(e)}"</h4>
      <p>${o?"Change the linked contact or unlink":"Select an existing contact or create a new one"}</p>
    </div>
    ${o?`
      <div class="person-link-menu-current">
        <div class="person-link-menu-current-label">Currently Linked To</div>
        <div class="person-link-menu-current-contact">
          <div class="person-link-menu-current-avatar">${(l||"?").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase()}</div>
          <div class="person-link-menu-current-info">
            <div class="person-link-menu-current-name">${d(l)}</div>
            <div class="person-link-menu-current-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Linked
            </div>
          </div>
          <button class="person-link-menu-unlink-btn unlink-btn">Unlink</button>
        </div>
      </div>
      <div class="person-link-menu-divider">Or change to another contact</div>
    `:""}
    <div class="person-link-menu-search">
      <input type="text" placeholder="Search contacts..." autofocus>
    </div>
    <div class="person-link-menu-list">
      <div class="person-link-menu-loading">Loading contacts...</div>
    </div>
    <div class="person-link-menu-actions">
      <button class="person-link-menu-btn secondary cancel-btn">Cancel</button>
      <button class="person-link-menu-btn primary create-btn">+ Create New Contact</button>
    </div>
  `;const m=n.getBoundingClientRect();c.style.position="fixed",c.style.top=`${Math.min(m.bottom+8,window.innerHeight-420)}px`,c.style.left=`${Math.min(m.left,window.innerWidth-320)}px`,document.body.appendChild(c);const u=c.querySelector("input");u?.focus();try{const b=(await x.get(`/api/contacts?project_id=${r}&limit=100`)).data.contacts||[],$=c.querySelector(".person-link-menu-list"),k=f=>{if(f.length===0){$.innerHTML='<div class="person-link-menu-empty">No matching contacts</div>';return}$.innerHTML=f.map(v=>{const p=(v.name||"?").split(" ").map(T=>T[0]).slice(0,2).join("").toUpperCase(),w=v.avatar_url||v.photo_url||"",_=v.role||"";return`
          <div class="person-link-menu-item" 
               data-contact-id="${v.id}" 
               data-contact-name="${d(v.name||"")}"
               data-contact-email="${d(v.email||"")}"
               data-contact-avatar="${d(w)}"
               data-contact-role="${d(_)}">
            ${w?`
              <img src="${d(w)}" alt="" class="person-link-menu-avatar person-link-menu-avatar-img">
            `:`
              <div class="person-link-menu-avatar">${p}</div>
            `}
            <div class="person-link-menu-info">
              <div class="person-link-menu-name">${d(v.name||"Unknown")}</div>
              ${_?`<div class="person-link-menu-email">${d(_)}</div>`:""}
              ${v.email?`<div class="person-link-menu-email">${d(v.email)}</div>`:""}
            </div>
          </div>
        `}).join(""),$.querySelectorAll(".person-link-menu-item").forEach(v=>{v.addEventListener("click",async()=>{const p=v.dataset.contactId||"",w=v.dataset.contactName||"",_=v.dataset.contactEmail||"",T=v.dataset.contactAvatar||"",I=v.dataset.contactRole||"";try{await x.post("/api/contacts/link-participant",{projectId:r,participantName:e,contactId:p}),y.success(`Linked "${e}" to ${w}`),c.remove(),j(n,e,p,w,_,T,I)}catch(U){console.error("[People] Failed to link:",U),y.error("Failed to link contact")}})})};k(b),u?.addEventListener("input",()=>{const f=u.value.toLowerCase(),v=b.filter(p=>p.name?.toLowerCase().includes(f)||p.email?.toLowerCase().includes(f));k(v)})}catch(s){console.error("[People] Failed to load contacts:",s);const b=c.querySelector(".person-link-menu-list");b.innerHTML='<div class="person-link-menu-empty">Failed to load contacts</div>'}c.querySelector(".cancel-btn")?.addEventListener("click",()=>c.remove()),c.querySelector(".unlink-btn")?.addEventListener("click",async()=>{try{await x.post("/api/contacts/unlink-participant",{projectId:r,participantName:e}),y.success(`Unlinked "${e}"`),c.remove(),Q(n,e,t,a)}catch(s){console.error("[People] Failed to unlink:",s),y.error("Failed to unlink contact")}}),c.querySelector(".create-btn")?.addEventListener("click",async()=>{try{const s=await x.post("/api/contacts",{project_id:r,name:e,role:t||void 0,organization:a||void 0,source:"document_extraction"});s.data.ok&&s.data.contact?(y.success(`Created contact: ${s.data.contact.name}`),c.remove(),j(n,e,s.data.contact.id,s.data.contact.name,"",s.data.contact.avatar_url||"",s.data.contact.role||t)):y.error(s.data.error||"Failed to create contact")}catch(s){console.error("[People] Failed to create contact:",s),y.error("Failed to create contact")}});const g=s=>{!c.contains(s.target)&&s.target!==n&&(c.remove(),document.removeEventListener("click",g))};setTimeout(()=>document.addEventListener("click",g),100);const h=s=>{s.key==="Escape"&&(c.remove(),document.removeEventListener("keydown",h))};document.addEventListener("keydown",h)}function Q(n,e,t,a){const r=(e||"?").split(" ").map(i=>i[0]).slice(0,2).join("").toUpperCase();n.classList.remove("linked"),n.classList.add("unlinked","entity-chip","entity-chip-unlinked"),delete n.dataset.contactId,delete n.dataset.contactName,n.innerHTML=`
    <div class="entity-chip-avatar-placeholder">${r}</div>
    <div class="entity-chip-body">
      <div class="entity-chip-name">${d(e)}</div>
      ${t||a?`<div class="entity-chip-meta">${t||""}${t&&a?" • ":""}${a||""}</div>`:""}
    </div>
  `}function j(n,e,t,a,r,i,l){const o=(a||e||"?").split(" ").map(c=>c[0]).slice(0,2).join("").toUpperCase();n.classList.remove("entity-chip-unlinked"),n.classList.add("linked","entity-chip","entity-chip-linked"),n.dataset.contactId=t,n.dataset.contactName=a,n.innerHTML=`
    ${i?`
      <img class="entity-chip-avatar" src="${d(i)}" alt="">
    `:`
      <div class="entity-chip-avatar-placeholder">${o}</div>
    `}
    <div class="entity-chip-body">
      <div class="entity-chip-linked-row">
        <span class="entity-chip-name">${d(e)}</span>
        <svg class="entity-chip-linked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="entity-chip-meta entity-chip-meta-ellipsis">
        → ${d(a)}${l?` • ${d(l)}`:""}
      </div>
    </div>
  `}async function P(n,e){const t=n.querySelector("#versions-list");try{const r=(await x.get(`/api/documents/${e}/versions`)).data.versions||[];if(n.querySelector("#versions-count").textContent=String(r.length||1),r.length===0){t.innerHTML=`
        <div class="version-item current">
          <div class="version-badge">v1</div>
          <div class="version-info">
            <div class="version-title">Current Version <span class="current-tag">Current</span></div>
            <div class="version-notes">Initial upload</div>
          </div>
        </div>
      `;return}t.innerHTML=r.map(i=>`
      <div class="version-item ${i.is_current?"current":""}" data-id="${i.id}">
        <div class="version-badge">v${i.version_number}</div>
        <div class="version-info">
          <div class="version-title">
            ${d(i.filename)}
            ${i.is_current?'<span class="current-tag">Current</span>':""}
          </div>
          ${i.change_notes?`<div class="version-notes">"${d(i.change_notes)}"</div>`:""}
          <div class="version-meta">
            ${N(i.file_size)} • ${S(i.created_at)}
          </div>
          ${i.ai_change_summary?`
            <div class="version-ai-summary">
              <strong>AI:</strong> ${d(i.ai_change_summary)}
            </div>
          `:""}
        </div>
        <div class="version-actions version-actions-row">
          <button class="btn btn-sm view-version-btn">View</button>
          ${i.is_current?"":'<button class="btn btn-sm restore-version-btn">Restore</button>'}
          ${i.version_number>1?'<button class="btn btn-sm diff-version-btn">Diff</button>':""}
        </div>
      </div>
    `).join("")}catch{t.innerHTML='<div class="empty-section">Version history not available</div>'}}async function F(n,e){const t=n.querySelector("#activity-timeline");try{const r=(await x.get(`/api/documents/${e}/activity`)).data.activities||[];if(r.length===0){t.innerHTML='<div class="empty-section">No activity recorded</div>';return}t.innerHTML=r.map(i=>`
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-avatar">
            ${i.user_avatar?`<img src="${i.user_avatar}" alt="">`:ce(i.user_name||"System")}
          </div>
          <div class="activity-text">
            <strong>${d(i.user_name||"System")}</strong> ${re(i.action)}
          </div>
          <div class="activity-time">${S(i.created_at)}</div>
        </div>
      </div>
    `).join("")}catch{t.innerHTML='<div class="empty-section">Activity not available</div>'}}async function K(n,e){const t=n.querySelector("#notes-container"),a=n.querySelector("#notes-tab");try{const i=(await x.get(`/api/documents/${e}/extraction`)).data.extraction;if(!(i?.notes_rendered_text||(i?.notes?.key_points?.length||0)>0)){a&&a.classList.add("hidden");return}a&&a.classList.remove("hidden");const o=i?.notes_rendered_text||"",c=i?.notes;if(o)t.innerHTML=`
        <style>
          .notes-rendered {
            padding: 20px;
            background: var(--bg-secondary);
            border-radius: 12px;
            line-height: 1.7;
          }
          .notes-header {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .notes-meta {
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
          }
          .notes-topic {
            margin-bottom: 20px;
          }
          .notes-topic-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 10px;
            padding-left: 8px;
            border-left: 3px solid var(--primary);
          }
          .notes-bullet {
            padding: 10px 12px;
            background: var(--bg-primary);
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 14px;
            color: var(--text-primary);
            line-height: 1.6;
          }
          .notes-bullet:last-child {
            margin-bottom: 0;
          }
          .notes-actions {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
          }
        </style>
        <div class="notes-rendered">
          ${Y(o)}
          <div class="notes-actions">
            <button class="btn btn-secondary btn-sm" id="copy-notes-btn">
              📋 Copy Notes
            </button>
          </div>
        </div>
      `,n.querySelector("#copy-notes-btn")?.addEventListener("click",()=>{navigator.clipboard.writeText(o),y.success("Notes copied to clipboard")});else if(c){const m=c.key_points?.map(g=>`• ${g.text}`).join(`
`)||"",u=c.outline?.map(g=>`**${g.topic}**
${g.bullets?.map(h=>`  • ${h.text}`).join(`
`)||""}`).join(`

`)||"";t.innerHTML=`
        <div class="notes-structured">
          ${m?`<div class="notes-section"><h4>Key Points</h4><pre class="conv-notes-pre">${d(m)}</pre></div>`:""}
          ${u?`<div class="notes-section"><h4>Outline</h4><pre class="conv-notes-pre">${d(u)}</pre></div>`:""}
        </div>
      `}}catch{t.innerHTML='<div class="empty-section">Meeting notes not available</div>',a&&a.classList.add("hidden")}}function d(n){const e=document.createElement("div");return e.textContent=n,e.innerHTML}function Y(n){const e=n.split(`
`);let t="",a="",r="",i=!1,l=!1;const o=()=>{a&&r&&(t+=`
        <div class="notes-topic">
          <div class="notes-topic-title">${d(a)}</div>
          ${r}
        </div>
      `),a="",r=""};for(const c of e){const m=c.trim();if(m){if(!i&&m.startsWith("📝")){t+=`<div class="notes-header">${d(m)}</div>`,i=!0;continue}if(!l&&m.startsWith("🕞")){t+=`<div class="notes-meta">${d(m)}</div>`,l=!0;continue}if(m.startsWith("-")){const u=m.substring(1).trim();r+=`<div class="notes-bullet">${d(u)}</div>`;continue}o(),a=m}}return o(),t.includes("notes-topic")?t:`<pre class="conv-notes-pre">${d(n)}</pre>`}async function X(n){try{return(await x.get(`/api/documents/${n}/favorite`)).data.is_favorite||!1}catch{return!1}}function R(n){const e=n.querySelector("#favorite-btn");e&&(e.classList.toggle("active",L),e.innerHTML=L?"★":"☆")}async function Z(n,e){try{await x.post(`/api/documents/${e.id}/favorite`),L=!L,R(n),y.success(L?"Added to favorites":"Removed from favorites")}catch{y.error("Failed to update favorite")}}function ee(n){window.open(`/api/documents/${n.id}/download`,"_blank")}async function te(n,e){try{const a=(await x.get(`/api/documents/${e}`)).data,r=["facts","decisions","risks","actions","questions"];for(const m of r){const u=n.querySelector(`[data-entity="${m}"]`);if(u){const g=u.querySelector(".entity-count");if(g){const h=a[`${m}_count`]||0;g.textContent=String(h),u.classList.add("updated"),setTimeout(()=>u.classList.remove("updated"),1500)}}}const i=n.querySelector("#summary-card"),l=n.querySelector("#doc-summary");i&&l&&(a.summary?(i.classList.remove("hidden"),l.textContent=a.summary):i.classList.add("hidden"));const o=n.querySelector("#content-preview");if(o&&a.content){const m=a.content.length>5e3;o.innerHTML=d(a.content.substring(0,5e3))+(m?`

... (truncated)`:"")}const c=n.querySelector(".status-chip");c&&(c.className=`status-chip ${a.status}`,c.textContent=E(a.status)),q(n,e),F(n,e),console.log("[Modal] Refreshed content for document:",e)}catch(t){console.error("[Modal] Failed to refresh content:",t)}}async function ne(n,e){const t=document.querySelector("#reprocess-btn"),a=document.querySelector(".document-preview-modal"),r=t?.innerHTML||"";try{t&&(t.disabled=!0,t.innerHTML='<span class="spinner"></span> Checking...');const l=(await x.get(`/api/documents/${n.id}/reprocess/check`)).data;if(!l.has_content){y.error("No content available for reprocessing");return}let o=!0;if(l.hash_match||l.total_entities>0){const g=l.hash_match?`Content has not changed since last processing.
`:"",h=l.total_entities>0?`There are ${l.total_entities} extracted entities that will be replaced.
`:"";o=confirm(`${g}${h}
Are you sure you want to reprocess?

This will:
- Remove all existing entities from this document
- Create new entities with AI analysis
- Use AI tokens`)}if(!o){y.info("Reprocessing cancelled");return}t&&(t.innerHTML='<span class="spinner"></span> Processing...'),y.info("Reprocessing started..."),await x.post(`/api/documents/${n.id}/reprocess`,{force:!0});let c=0;const m=60,u=async()=>{c++;try{const h=(await x.get(`/api/documents/${n.id}`)).data.status;return h==="processed"?(y.success("Document reprocessed successfully!"),a&&await te(a,n.id),e?.(),!0):h==="failed"?(y.error("Reprocessing failed"),!0):c>=m?(y.warning("Reprocessing still in progress. Check back later."),!0):(t&&(t.innerHTML=`<span class="spinner"></span> Processing... (${c}s)`),!1)}catch{return c>=m}};C=setInterval(async()=>{await u()&&(C&&(clearInterval(C),C=null),t&&(t.disabled=!1,t.innerHTML=r))},2e3)}catch(i){console.error("[Reprocess] Error:",i),y.error("Failed to reprocess document")}finally{t&&(t.disabled=!1,t.innerHTML=r)}}async function ie(n,e,t){const a=document.createElement("input");a.type="file",a.accept=".pdf,.doc,.docx,.txt,.md",a.onchange=async()=>{const r=a.files?.[0];if(!r)return;const i=prompt("Change notes (optional):"),l=new FormData;l.append("file",r),i&&l.append("change_notes",i);try{y.info("Uploading new version..."),await fetchWithProject(`/api/documents/${n.id}/versions`,{method:"POST",body:l}),y.success("New version uploaded"),P(e,n.id),t?.()}catch{y.error("Failed to upload new version")}},a.click()}async function ae(n,e){const t=n.querySelector("#share-expires").value,a=n.querySelector("#share-max-views").value,r=n.querySelector("#share-password").value,i=n.querySelector("#share-permissions").value;try{const l=await x.post(`/api/documents/${e.id}/share`,{expires:t,max_views:a?parseInt(a):null,password:r||null,permissions:[i==="download"?"view":i,...i==="download"?["download"]:[]]}),o=n.querySelector("#share-link-input");o.value=l.data.url,n.querySelector("#generate-link-btn")?.classList.add("hidden"),n.querySelector("#copy-link-btn")?.classList.remove("hidden"),y.success("Share link generated")}catch{y.error("Failed to generate share link")}}function se(n){const e=n.querySelector("#share-link-input");navigator.clipboard.writeText(e.value),y.success("Link copied to clipboard")}function oe(n){switch(n.split(".").pop()?.toLowerCase()){case"pdf":return"📄";case"doc":case"docx":return"📝";case"xls":case"xlsx":return"📊";case"ppt":case"pptx":return"📽️";case"txt":case"md":return"📃";case"jpg":case"jpeg":case"png":case"gif":return"🖼️";default:return"📁"}}function re(n){return{created:"uploaded this document",viewed:"viewed this document",downloaded:"downloaded this document",updated:"updated this document",version_uploaded:"uploaded a new version",analyzed:"ran AI analysis",reprocessed:"reprocessed this document",shared:"shared this document",unshared:"removed share link",deleted:"deleted this document",restored:"restored this document",tagged:"added tags",favorited:"added to favorites",unfavorited:"removed from favorites",commented:"commented on this document"}[n]||n}function ce(n){return n.split(" ").map(e=>e[0]).join("").substring(0,2).toUpperCase()}function E(n){return n.charAt(0).toUpperCase()+n.slice(1)}export{pe as showDocumentPreviewModal};
//# sourceMappingURL=DocumentPreviewModal-BAP5i0dz.js.map
