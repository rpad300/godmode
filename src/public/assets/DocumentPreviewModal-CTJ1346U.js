import{f as F,a as _,h as b,t as g,b as B}from"./main-BO04R03Y.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let L=!1,z=null;function pe(t){const{document:e}=t,n=document.createElement("div");n.className="document-preview-modal",n.innerHTML=`
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
      <div class="preview-icon">${re(e.filename||"")}</div>
      <div class="preview-title-section">
        <h3 class="preview-title">${d(e.filename||e.originalName||"Untitled")}</h3>
        <div class="preview-meta">
          <span>${F(e.size||0)}</span>
          <span>${_(e.created_at)}</span>
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
      <button class="preview-tab" data-tab="entities" id="entities-tab" style="display:none">
        Entities
        <span class="preview-tab-badge" id="entities-count">0</span>
      </button>
      <button class="preview-tab" data-tab="analysis">
        AI Analysis
        <span class="preview-tab-badge" id="analysis-count">0</span>
      </button>
      <button class="preview-tab" data-tab="notes" id="notes-tab" style="display:none">
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
        <div class="summary-card" id="summary-card" style="${e.summary?"":"display:none"}">
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
            ${e.tags.map(r=>`<span class="doc-tag">#${d(r)}</span>`).join("")}
          </div>
        `:""}
        
        <h4 style="margin: 24px 0 12px 0; font-size: 14px;">Content Preview</h4>
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
        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
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
          <h4 style="margin: 0 0 16px 0;">Create Share Link</h4>
          <div class="share-link-container">
            <input type="text" class="share-link-input" id="share-link-input" placeholder="Generate a link to share..." readonly>
            <button class="btn btn-primary" id="generate-link-btn">Generate</button>
            <button class="btn btn-secondary" id="copy-link-btn" style="display: none;">Copy</button>
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
        <div id="active-shares" style="margin-top: 20px;"></div>
      </div>
    </div>
  `,n.querySelectorAll(".preview-tab").forEach(r=>{r.addEventListener("click",()=>{const c=r.getAttribute("data-tab");j(n,c)})}),n.querySelector("#favorite-btn")?.addEventListener("click",()=>Z(n,e)),n.querySelector("#share-btn")?.addEventListener("click",()=>j(n,"share")),n.querySelector("#download-btn")?.addEventListener("click",()=>ee(e)),n.querySelector("#reprocess-btn")?.addEventListener("click",()=>ne(e,t.onUpdate)),n.querySelector("#upload-version-btn")?.addEventListener("click",()=>ie(e,n,t.onUpdate)),n.querySelector("#generate-link-btn")?.addEventListener("click",()=>ae(n,e)),n.querySelector("#copy-link-btn")?.addEventListener("click",()=>oe(n)),D(n,e.id),M(n,e.id),q(n,e.id),N(n,e.id),P(n,e.id),Q(n,e.id),X(e.id).then(r=>{L=r,R(n)});const a=document.createElement("div");a.className="modal-overlay document-preview-overlay",a.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  `;const s=document.createElement("div");s.className="modal-container",s.style.cssText=`
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-height: 90vh;
    overflow: hidden;
    animation: slideUp 0.3s ease-out;
  `;const i=document.createElement("button");i.innerHTML="×",i.style.cssText=`
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
  `,i.onclick=()=>T(a,t.onClose),n.style.position="relative",n.appendChild(i),s.appendChild(n),a.appendChild(s),a.addEventListener("click",r=>{r.target===a&&T(a,t.onClose)});const l=r=>{r.key==="Escape"&&(T(a,t.onClose),document.removeEventListener("keydown",l))};document.addEventListener("keydown",l),document.body.appendChild(a)}function T(t,e){z&&(clearInterval(z),z=null),t.style.animation="fadeOut 0.2s ease-out",setTimeout(()=>{t.remove(),e?.()},200)}function j(t,e){t.querySelectorAll(".preview-tab").forEach(n=>{n.classList.toggle("active",n.getAttribute("data-tab")===e)}),t.querySelectorAll(".preview-section").forEach(n=>{n.classList.toggle("active",n.getAttribute("data-section")===e)})}async function D(t,e){const n=t.querySelector("#content-preview");try{const a=await b.get(`/api/documents/${e}`),i=(a.data.document||a.data)?.content;if(i){const l=i.length>5e3;n.innerHTML=`<pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${d(i.substring(0,5e3))}${l?`

... (truncated)`:""}</pre>`}else n.innerHTML='<div class="content-empty">No content extracted</div>'}catch(a){console.error("[Preview] Failed to load content:",a),n.innerHTML='<div class="content-empty">Failed to load content</div>'}}async function M(t,e){const n=t.querySelector("#entities-full-list"),a=t.querySelector("#entities-tab"),s=t.querySelector("#entities-count"),i=t.querySelector("#people-count");try{const r=(await b.get(`/api/documents/${e}/extraction`)).data.extraction;if(!r){n.innerHTML='<div class="empty-section">No extraction data available</div>';return}const c=r.entities||[],y=r.facts||[],u=r.decisions||[],x=r.action_items||[],f=r.questions||[],o=r.risks||[],m=r.participants||[],k=c.filter(p=>p.type?.toLowerCase()==="person"),w=[...m];for(const p of k)w.some($=>$.name?.toLowerCase()===p.name?.toLowerCase())||w.push({name:p.name,role:void 0,organization:void 0});i&&(i.textContent=String(w.length));const h=c.length+y.length+u.length+x.length+f.length+o.length+w.length;if(h===0){n.innerHTML='<div class="empty-section">No entities extracted</div>';return}a&&(a.style.display=""),s&&(s.textContent=String(h));let v=`<style>
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
      </div>`),y.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          📋 Facts
          <span class="entity-section-count">${y.length}</span>
        </div>
        ${y.map(p=>`
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
      </div>`),x.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          📌 Action Items
          <span class="entity-section-count">${x.length}</span>
        </div>
        ${x.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">☐ ${d(p.task)}</div>
            ${p.owner?`<div class="entity-item-meta">Owner: ${d(p.owner)}</div>`:""}
            ${p.status?`<div class="entity-item-meta">Status: ${d(p.status)}</div>`:""}
          </div>
        `).join("")}
      </div>`),f.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          ❓ Questions
          <span class="entity-section-count">${f.length}</span>
        </div>
        ${f.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
          </div>
        `).join("")}
      </div>`),o.length>0&&(v+=`<div class="entity-section">
        <div class="entity-section-title">
          ⚠️ Risks
          <span class="entity-section-count">${o.length}</span>
        </div>
        ${o.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
            ${p.severity?`<div class="entity-item-meta">Severity: ${d(p.severity)}</div>`:""}
          </div>
        `).join("")}
      </div>`),w.length>0&&(v+=`<div class="entity-section" id="people-section">
        <div class="entity-section-title">
          👥 People
          <span class="entity-section-count">${w.length}</span>
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
        ${w.map((p,$)=>`
          <div class="person-item" data-person-index="${$}" data-person-name="${d(p.name||"")}">
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
      </div>`),n.innerHTML=v,V(t,e)}catch{n.innerHTML='<div class="empty-section">Failed to load entities</div>'}}function V(t,e){const n=t.querySelector("#people-section");if(!n)return;const a=window.currentProjectId||document.body.dataset.projectId||t.closest("[data-project-id]")?.getAttribute("data-project-id")||"";n.querySelectorAll(".person-link-btn").forEach(s=>{s.addEventListener("click",async i=>{i.stopPropagation();const l=s.dataset.name||"";await O(s,l,a,t,e)})}),n.querySelectorAll(".person-create-btn").forEach(s=>{s.addEventListener("click",async i=>{i.stopPropagation();const l=s.dataset.name||"",r=s.dataset.role||"",c=s.dataset.org||"";await G(l,r,c,a,s,t,e)})})}async function O(t,e,n,a,s){document.querySelectorAll(".contact-link-dropdown").forEach(u=>u.remove());const i=document.createElement("div");i.className="contact-link-dropdown",i.innerHTML=`
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
  `;const l=t.getBoundingClientRect();i.style.position="fixed",i.style.top=`${l.bottom+4}px`,i.style.left=`${Math.max(10,l.left-100)}px`,document.body.appendChild(i);const r=i.querySelector("input");r?.focus();try{const x=(await b.get(`/api/contacts?project_id=${n}&limit=100`)).data.contacts||[],f=i.querySelector(".contact-link-list");x.length===0?f.innerHTML='<div class="contact-link-empty">No contacts found</div>':H(f,x,e,n,a,s,i),r?.addEventListener("input",()=>{const o=r.value.toLowerCase(),m=x.filter(k=>k.name?.toLowerCase().includes(o)||k.email?.toLowerCase().includes(o));H(f,m,e,n,a,s,i)})}catch(u){console.error("[People] Failed to load contacts:",u);const x=i.querySelector(".contact-link-list");x.innerHTML='<div class="contact-link-empty">Failed to load contacts</div>'}const c=u=>{!i.contains(u.target)&&u.target!==t&&(i.remove(),document.removeEventListener("click",c))};setTimeout(()=>document.addEventListener("click",c),100);const y=u=>{u.key==="Escape"&&(i.remove(),document.removeEventListener("keydown",y))};document.addEventListener("keydown",y)}function H(t,e,n,a,s,i,l){if(e.length===0){t.innerHTML='<div class="contact-link-empty">No matching contacts</div>';return}t.innerHTML=e.map(r=>{const c=(r.name||"?").split(" ").map(y=>y[0]).slice(0,2).join("").toUpperCase();return`
      <div class="contact-link-item" data-contact-id="${r.id}" data-contact-name="${d(r.name||"")}">
        <div class="contact-link-avatar">${c}</div>
        <div class="contact-link-info">
          <div class="contact-link-name">${d(r.name||"Unknown")}</div>
          ${r.email?`<div class="contact-link-email">${d(r.email)}</div>`:""}
        </div>
      </div>
    `}).join(""),t.querySelectorAll(".contact-link-item").forEach(r=>{r.addEventListener("click",async()=>{const c=r.dataset.contactId||"",y=r.dataset.contactName||"";try{await b.post("/api/contacts/link-participant",{projectId:a,participantName:n,contactId:c}),g.success(`Linked "${n}" to ${y}`),l.remove(),M(s,i)}catch(u){console.error("[People] Failed to link:",u),g.error("Failed to link contact")}})})}async function G(t,e,n,a,s,i,l){const r=s.textContent;s.textContent="Creating...",s.disabled=!0;try{const c=await b.post("/api/contacts",{project_id:a,name:t,role:e||void 0,organization:n||void 0,source:"document_extraction"});c.data.ok&&c.data.contact?(g.success(`Created contact: ${c.data.contact.name}`),M(i,l)):(g.error(c.data.error||"Failed to create contact"),s.textContent=r,s.disabled=!1)}catch(c){console.error("[People] Failed to create contact:",c),g.error("Failed to create contact"),s.textContent=r,s.disabled=!1}}async function q(t,e){const n=t.querySelector("#analysis-list");try{const s=(await b.get(`/api/documents/${e}/analysis`)).data.analyses||[];if(t.querySelector("#analysis-count").textContent=String(s.length),s.length===0){n.innerHTML=`
        <div class="empty-section">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>No AI analyses yet</p>
          <button class="btn btn-primary btn-sm" id="run-analysis-btn">Run Analysis</button>
        </div>
      `;const i=n.querySelector("#run-analysis-btn");i&&i.addEventListener("click",async()=>{const l=i,r=l.textContent;l.disabled=!0,l.textContent="Analyzing...";try{const c=await b.post(`/api/documents/${e}/reprocess`,{});c.data.success?(g.success("Analysis started"),setTimeout(()=>q(t,e),3e3)):(g.error(c.data.error||"Failed to start analysis"),l.disabled=!1,l.textContent=r)}catch(c){g.error(c.message||"Failed to run analysis"),l.disabled=!1,l.textContent=r}});return}n.innerHTML=s.map((i,l)=>`
      <div class="analysis-item" data-id="${i.id}">
        <div class="analysis-version">v${s.length-l}</div>
        <div class="analysis-info">
          <div class="analysis-title">${E(i.analysis_type)}</div>
          <div class="analysis-meta">
            <span>${i.provider}/${i.model}</span>
            <span>${i.entities_extracted||0} entities</span>
            <span>${(i.input_tokens||0)+(i.output_tokens||0)} tokens</span>
            ${i.cost?`<span>$${i.cost.toFixed(4)}</span>`:""}
          </div>
          <div class="analysis-timestamp" style="font-size: 12px; color: var(--text-tertiary, #666); margin-top: 4px;">
            ${B(i.created_at)} (${_(i.created_at)})
          </div>
        </div>
        <div class="analysis-actions">
          <button class="btn btn-sm view-analysis-btn">View</button>
          <button class="btn btn-sm compare-analysis-btn">Compare</button>
        </div>
      </div>
    `).join(""),n.querySelectorAll(".view-analysis-btn").forEach((i,l)=>{i.addEventListener("click",()=>{const r=s[l];W(t,r)})}),n.querySelectorAll(".compare-analysis-btn").forEach((i,l)=>{i.addEventListener("click",()=>{if(s.length<2){g.info("Need at least 2 analyses to compare");return}g.info("Compare feature coming soon")})})}catch{n.innerHTML='<div class="empty-section">No analysis history available</div>'}}async function W(t,e){let n=e.result;if(e.document_id)try{const o=await b.get(`/api/documents/${e.document_id}/extraction`);o.data.extraction&&(n=o.data.extraction,console.log("[Analysis] Loaded enriched extraction from /extraction endpoint"))}catch(o){if(console.warn("[Analysis] Could not load extraction:",o),!n)try{const m=await b.get(`/api/documents/${e.document_id}`);n=m.data.document?.extraction_result||m.data.extraction_result}catch{}}const a=document.createElement("div");a.className="analysis-detail-overlay",a.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;const s=n?JSON.stringify(n,null,2):"No detailed result available";let i="",l=[];if(n){const o=n;o.summary?i=o.summary:o.meeting?.title&&(i=`Meeting: ${o.meeting.title}`);const m=o.participants||[],w=(o.entities||[]).filter(v=>v.type?.toLowerCase()==="person"),h=new Set;for(const v of m)v.name&&!h.has(v.name.toLowerCase())&&(h.add(v.name.toLowerCase()),l.push({name:v.name,role:v.role,organization:v.organization,contact_id:v.contact_id,contact_name:v.contact_name,contact_email:v.contact_email,contact_avatar:v.contact_avatar,contact_role:v.contact_role}));for(const v of w)v.name&&!h.has(v.name.toLowerCase())&&(h.add(v.name.toLowerCase()),l.push({name:v.name,contact_id:v.contact_id,contact_name:v.contact_name,contact_email:v.contact_email,contact_avatar:v.contact_avatar,contact_role:v.contact_role}))}const r=l.filter(o=>o.contact_id),c=l.filter(o=>!o.contact_id),y=l.length>0?`
    <div style="margin-bottom: 20px;">
      <h4 style="color: var(--text-primary, #fff); margin: 0 0 12px 0; font-size: 14px; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">👥</span> People Detected
        <span style="font-size: 11px; background: rgba(99, 102, 241, 0.2); color: var(--accent-color, #6366f1); padding: 2px 8px; border-radius: 10px;">${l.length}</span>
        ${r.length>0?`<span style="font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 8px; border-radius: 10px;">✓ ${r.length} linked</span>`:""}
      </h4>
      
      ${r.length>0?`
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; color: var(--text-tertiary, #666); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Linked to Contacts</div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${r.map(o=>`
              <div class="person-chip linked" data-name="${d(o.name)}" data-contact-id="${d(o.contact_id||"")}" data-contact-name="${d(o.contact_name||"")}" style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 14px;
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 20px;
                cursor: pointer;
                transition: all 0.15s ease;
              ">
                ${o.contact_avatar?`
                  <img src="${d(o.contact_avatar)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                `:`
                  <div style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                  ">${(o.contact_name||o.name||"?").split(" ").map(m=>m[0]).slice(0,2).join("").toUpperCase()}</div>
                `}
                <div style="flex: 1; min-width: 0;">
                  <div style="color: var(--text-primary, #fff); font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                    ${d(o.name)}
                    <svg style="width: 14px; height: 14px; color: #10b981; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div style="color: var(--text-tertiary, #666); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    → ${d(o.contact_name||"Contact")}${o.contact_role?` • ${d(o.contact_role)}`:""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `:""}
      
      ${c.length>0?`
        <div>
          <div style="font-size: 11px; color: var(--text-tertiary, #666); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${r.length>0?"Not Yet Linked":"Click to Link or Create Contact"}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${c.map(o=>`
              <div class="person-chip unlinked" data-name="${d(o.name)}" data-role="${d(o.role||"")}" data-org="${d(o.organization||"")}" style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: var(--bg-secondary, #252542);
                border: 1px dashed var(--border-color, #444);
                border-radius: 20px;
                cursor: pointer;
                transition: all 0.15s ease;
              ">
                <div style="
                  width: 28px;
                  height: 28px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, var(--accent-color, #6366f1), #8b5cf6);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 11px;
                  font-weight: 600;
                ">${(o.name||"?").split(" ").map(m=>m[0]).slice(0,2).join("").toUpperCase()}</div>
                <div>
                  <div style="color: var(--text-primary, #fff); font-size: 13px; font-weight: 500;">${d(o.name)}</div>
                  ${o.role||o.organization?`<div style="color: var(--text-tertiary, #666); font-size: 11px;">${o.role||""}${o.role&&o.organization?" • ":""}${o.organization||""}</div>`:""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `:""}
      
      <p style="color: var(--text-tertiary, #666); font-size: 12px; margin: 12px 0 0 0;">
        💡 Click on any person to ${r.length>0?"view/change the link":"link them to a contact or create a new one"}
      </p>
    </div>
  `:"",u=document.createElement("div");u.className="analysis-detail-content",u.style.cssText=`
    background: var(--bg-primary, #1a1a2e);
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `,u.innerHTML=`
    <div style="padding: 20px; border-bottom: 1px solid var(--border-color, #333); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 style="margin: 0; color: var(--text-primary, #fff);">${E(e.analysis_type)} Analysis</h3>
        <p style="margin: 4px 0 0; color: var(--text-secondary, #888); font-size: 13px;">
          ${e.provider}/${e.model} • ${e.entities_extracted||0} entities • ${_(e.created_at)}
        </p>
      </div>
      <button class="close-analysis-btn" style="background: none; border: none; color: var(--text-secondary, #888); cursor: pointer; font-size: 24px;">&times;</button>
    </div>
    ${i?`
      <div style="padding: 16px 20px; background: var(--bg-secondary, #252542); border-bottom: 1px solid var(--border-color, #333);">
        <strong style="color: var(--text-primary, #fff);">Summary:</strong>
        <p style="margin: 8px 0 0; color: var(--text-secondary, #ccc);">${d(i)}</p>
      </div>
    `:""}
    <div style="padding: 20px; overflow-y: auto; flex: 1;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${e.entities_extracted||0}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Entities</div>
        </div>
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${e.input_tokens||0}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Input Tokens</div>
        </div>
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${e.output_tokens||0}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Output Tokens</div>
        </div>
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${e.latency_ms?`${(e.latency_ms/1e3).toFixed(1)}s`:"-"}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Latency</div>
        </div>
      </div>
      ${y}
      <details style="margin-top: 16px;">
        <summary style="cursor: pointer; color: var(--text-primary, #fff); font-weight: 500; padding: 8px 0;">Raw Result JSON</summary>
        <pre style="background: var(--bg-tertiary, #1e1e3f); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; color: var(--text-secondary, #ccc); max-height: 400px; overflow-y: auto;">${d(s)}</pre>
      </details>
    </div>
  `,a.appendChild(u),document.body.appendChild(a),u.querySelector(".close-analysis-btn")?.addEventListener("click",()=>a.remove()),a.addEventListener("click",o=>{o.target===a&&a.remove()});const f=window.currentProjectId||document.body.dataset.projectId||t.closest("[data-project-id]")?.getAttribute("data-project-id")||"";u.querySelectorAll(".person-chip").forEach(o=>{const m=o,k=m.classList.contains("linked");o.addEventListener("click",async w=>{w.stopPropagation();const h=m.dataset.name||"",v=m.dataset.role||"",p=m.dataset.org||"",$=m.dataset.contactId||"",C=m.dataset.contactName||"";await J(m,h,v,p,f,$,C)}),m.addEventListener("mouseenter",()=>{k?(m.style.background="rgba(16, 185, 129, 0.2)",m.style.borderColor="rgba(16, 185, 129, 0.5)"):(m.style.background="var(--bg-tertiary, #1e1e3f)",m.style.borderColor="var(--accent-color, #6366f1)"),m.style.transform="translateY(-1px)"}),m.addEventListener("mouseleave",()=>{k?(m.style.background="rgba(16, 185, 129, 0.1)",m.style.borderColor="rgba(16, 185, 129, 0.3)"):(m.style.background="var(--bg-secondary, #252542)",m.style.borderColor="var(--border-color, #444)"),m.style.transform="translateY(0)"})})}async function J(t,e,n,a,s,i="",l=""){document.querySelectorAll(".person-link-menu").forEach(o=>o.remove());const r=!!i,c=document.createElement("div");c.className="person-link-menu",c.innerHTML=`
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
      <h4>${r?"Change Link":"Link"} "${d(e)}"</h4>
      <p>${r?"Change the linked contact or unlink":"Select an existing contact or create a new one"}</p>
    </div>
    ${r?`
      <div class="person-link-menu-current">
        <div class="person-link-menu-current-label">Currently Linked To</div>
        <div class="person-link-menu-current-contact">
          <div class="person-link-menu-current-avatar">${(l||"?").split(" ").map(o=>o[0]).slice(0,2).join("").toUpperCase()}</div>
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
  `;const y=t.getBoundingClientRect();c.style.position="fixed",c.style.top=`${Math.min(y.bottom+8,window.innerHeight-420)}px`,c.style.left=`${Math.min(y.left,window.innerWidth-320)}px`,document.body.appendChild(c);const u=c.querySelector("input");u?.focus();try{const m=(await b.get(`/api/contacts?project_id=${s}&limit=100`)).data.contacts||[],k=c.querySelector(".person-link-menu-list"),w=h=>{if(h.length===0){k.innerHTML='<div class="person-link-menu-empty">No matching contacts</div>';return}k.innerHTML=h.map(v=>{const p=(v.name||"?").split(" ").map(S=>S[0]).slice(0,2).join("").toUpperCase(),$=v.avatar_url||v.photo_url||"",C=v.role||"";return`
          <div class="person-link-menu-item" 
               data-contact-id="${v.id}" 
               data-contact-name="${d(v.name||"")}"
               data-contact-email="${d(v.email||"")}"
               data-contact-avatar="${d($)}"
               data-contact-role="${d(C)}">
            ${$?`
              <img src="${d($)}" alt="" class="person-link-menu-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
            `:`
              <div class="person-link-menu-avatar">${p}</div>
            `}
            <div class="person-link-menu-info">
              <div class="person-link-menu-name">${d(v.name||"Unknown")}</div>
              ${C?`<div class="person-link-menu-email">${d(C)}</div>`:""}
              ${v.email?`<div class="person-link-menu-email">${d(v.email)}</div>`:""}
            </div>
          </div>
        `}).join(""),k.querySelectorAll(".person-link-menu-item").forEach(v=>{v.addEventListener("click",async()=>{const p=v.dataset.contactId||"",$=v.dataset.contactName||"",C=v.dataset.contactEmail||"",S=v.dataset.contactAvatar||"",I=v.dataset.contactRole||"";try{await b.post("/api/contacts/link-participant",{projectId:s,participantName:e,contactId:p}),g.success(`Linked "${e}" to ${$}`),c.remove(),A(t,e,p,$,C,S,I)}catch(U){console.error("[People] Failed to link:",U),g.error("Failed to link contact")}})})};w(m),u?.addEventListener("input",()=>{const h=u.value.toLowerCase(),v=m.filter(p=>p.name?.toLowerCase().includes(h)||p.email?.toLowerCase().includes(h));w(v)})}catch(o){console.error("[People] Failed to load contacts:",o);const m=c.querySelector(".person-link-menu-list");m.innerHTML='<div class="person-link-menu-empty">Failed to load contacts</div>'}c.querySelector(".cancel-btn")?.addEventListener("click",()=>c.remove()),c.querySelector(".unlink-btn")?.addEventListener("click",async()=>{try{await b.post("/api/contacts/unlink-participant",{projectId:s,participantName:e}),g.success(`Unlinked "${e}"`),c.remove(),Y(t,e,n,a)}catch(o){console.error("[People] Failed to unlink:",o),g.error("Failed to unlink contact")}}),c.querySelector(".create-btn")?.addEventListener("click",async()=>{try{const o=await b.post("/api/contacts",{project_id:s,name:e,role:n||void 0,organization:a||void 0,source:"document_extraction"});o.data.ok&&o.data.contact?(g.success(`Created contact: ${o.data.contact.name}`),c.remove(),A(t,e,o.data.contact.id,o.data.contact.name,"",o.data.contact.avatar_url||"",o.data.contact.role||n)):g.error(o.data.error||"Failed to create contact")}catch(o){console.error("[People] Failed to create contact:",o),g.error("Failed to create contact")}});const x=o=>{!c.contains(o.target)&&o.target!==t&&(c.remove(),document.removeEventListener("click",x))};setTimeout(()=>document.addEventListener("click",x),100);const f=o=>{o.key==="Escape"&&(c.remove(),document.removeEventListener("keydown",f))};document.addEventListener("keydown",f)}function Y(t,e,n,a){const s=(e||"?").split(" ").map(i=>i[0]).slice(0,2).join("").toUpperCase();t.classList.remove("linked"),t.classList.add("unlinked"),delete t.dataset.contactId,delete t.dataset.contactName,t.style.cssText=`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary, #252542);
    border: 1px dashed var(--border-color, #444);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  `,t.innerHTML=`
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-color, #6366f1), #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 11px;
      font-weight: 600;
    ">${s}</div>
    <div>
      <div style="color: var(--text-primary, #fff); font-size: 13px; font-weight: 500;">${d(e)}</div>
      ${n||a?`<div style="color: var(--text-tertiary, #666); font-size: 11px;">${n||""}${n&&a?" • ":""}${a||""}</div>`:""}
    </div>
  `}function A(t,e,n,a,s,i,l){const r=(a||e||"?").split(" ").map(c=>c[0]).slice(0,2).join("").toUpperCase();t.classList.remove("unlinked"),t.classList.add("linked"),t.dataset.contactId=n,t.dataset.contactName=a,t.style.cssText=`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  `,t.innerHTML=`
    ${i?`
      <img src="${d(i)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
    `:`
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981, #059669);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
      ">${r}</div>
    `}
    <div style="flex: 1; min-width: 0;">
      <div style="color: var(--text-primary, #fff); font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px;">
        ${d(e)}
        <svg style="width: 14px; height: 14px; color: #10b981; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div style="color: var(--text-tertiary, #666); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        → ${d(a)}${l?` • ${d(l)}`:""}
      </div>
    </div>
  `}async function N(t,e){const n=t.querySelector("#versions-list");try{const s=(await b.get(`/api/documents/${e}/versions`)).data.versions||[];if(t.querySelector("#versions-count").textContent=String(s.length||1),s.length===0){n.innerHTML=`
        <div class="version-item current">
          <div class="version-badge">v1</div>
          <div class="version-info">
            <div class="version-title">Current Version <span class="current-tag">Current</span></div>
            <div class="version-notes">Initial upload</div>
          </div>
        </div>
      `;return}n.innerHTML=s.map(i=>`
      <div class="version-item ${i.is_current?"current":""}" data-id="${i.id}">
        <div class="version-badge">v${i.version_number}</div>
        <div class="version-info">
          <div class="version-title">
            ${d(i.filename)}
            ${i.is_current?'<span class="current-tag">Current</span>':""}
          </div>
          ${i.change_notes?`<div class="version-notes">"${d(i.change_notes)}"</div>`:""}
          <div class="version-meta">
            ${F(i.file_size)} • ${_(i.created_at)}
          </div>
          ${i.ai_change_summary?`
            <div class="version-ai-summary">
              <strong>AI:</strong> ${d(i.ai_change_summary)}
            </div>
          `:""}
        </div>
        <div class="version-actions" style="display: flex; gap: 8px;">
          <button class="btn btn-sm view-version-btn">View</button>
          ${i.is_current?"":'<button class="btn btn-sm restore-version-btn">Restore</button>'}
          ${i.version_number>1?'<button class="btn btn-sm diff-version-btn">Diff</button>':""}
        </div>
      </div>
    `).join("")}catch{n.innerHTML='<div class="empty-section">Version history not available</div>'}}async function P(t,e){const n=t.querySelector("#activity-timeline");try{const s=(await b.get(`/api/documents/${e}/activity`)).data.activities||[];if(s.length===0){n.innerHTML='<div class="empty-section">No activity recorded</div>';return}n.innerHTML=s.map(i=>`
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-avatar">
            ${i.user_avatar?`<img src="${i.user_avatar}" alt="">`:ce(i.user_name||"System")}
          </div>
          <div class="activity-text">
            <strong>${d(i.user_name||"System")}</strong> ${se(i.action)}
          </div>
          <div class="activity-time">${_(i.created_at)}</div>
        </div>
      </div>
    `).join("")}catch{n.innerHTML='<div class="empty-section">Activity not available</div>'}}async function Q(t,e){const n=t.querySelector("#notes-container"),a=t.querySelector("#notes-tab");try{const i=(await b.get(`/api/documents/${e}/extraction`)).data.extraction;if(!(i?.notes_rendered_text||(i?.notes?.key_points?.length||0)>0)){a&&(a.style.display="none");return}a&&(a.style.display="");const r=i?.notes_rendered_text||"",c=i?.notes;if(r)n.innerHTML=`
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
          ${K(r)}
          <div class="notes-actions">
            <button class="btn btn-secondary btn-sm" id="copy-notes-btn">
              📋 Copy Notes
            </button>
          </div>
        </div>
      `,t.querySelector("#copy-notes-btn")?.addEventListener("click",()=>{navigator.clipboard.writeText(r),g.success("Notes copied to clipboard")});else if(c){const y=c.key_points?.map(x=>`• ${x.text}`).join(`
`)||"",u=c.outline?.map(x=>`**${x.topic}**
${x.bullets?.map(f=>`  • ${f.text}`).join(`
`)||""}`).join(`

`)||"";n.innerHTML=`
        <div class="notes-structured">
          ${y?`<div class="notes-section"><h4>Key Points</h4><pre style="white-space: pre-wrap;">${d(y)}</pre></div>`:""}
          ${u?`<div class="notes-section"><h4>Outline</h4><pre style="white-space: pre-wrap;">${d(u)}</pre></div>`:""}
        </div>
      `}}catch{n.innerHTML='<div class="empty-section">Meeting notes not available</div>',a&&(a.style.display="none")}}function d(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}function K(t){const e=t.split(`
`);let n="",a="",s="",i=!1,l=!1;const r=()=>{a&&s&&(n+=`
        <div class="notes-topic">
          <div class="notes-topic-title">${d(a)}</div>
          ${s}
        </div>
      `),a="",s=""};for(const c of e){const y=c.trim();if(y){if(!i&&y.startsWith("📝")){n+=`<div class="notes-header">${d(y)}</div>`,i=!0;continue}if(!l&&y.startsWith("🕞")){n+=`<div class="notes-meta">${d(y)}</div>`,l=!0;continue}if(y.startsWith("-")){const u=y.substring(1).trim();s+=`<div class="notes-bullet">${d(u)}</div>`;continue}r(),a=y}}return r(),n.includes("notes-topic")?n:`<pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6;">${d(t)}</pre>`}async function X(t){try{return(await b.get(`/api/documents/${t}/favorite`)).data.is_favorite||!1}catch{return!1}}function R(t){const e=t.querySelector("#favorite-btn");e&&(e.classList.toggle("active",L),e.innerHTML=L?"★":"☆")}async function Z(t,e){try{await b.post(`/api/documents/${e.id}/favorite`),L=!L,R(t),g.success(L?"Added to favorites":"Removed from favorites")}catch{g.error("Failed to update favorite")}}function ee(t){window.open(`/api/documents/${t.id}/download`,"_blank")}async function te(t,e){try{const a=(await b.get(`/api/documents/${e}`)).data,s=["facts","decisions","risks","actions","questions"];for(const y of s){const u=t.querySelector(`[data-entity="${y}"]`);if(u){const x=u.querySelector(".entity-count");if(x){const f=a[`${y}_count`]||0;x.textContent=String(f),u.classList.add("updated"),setTimeout(()=>u.classList.remove("updated"),1500)}}}const i=t.querySelector("#summary-card"),l=t.querySelector("#doc-summary");i&&l&&(a.summary?(i.style.display="",l.textContent=a.summary):i.style.display="none");const r=t.querySelector("#content-preview");if(r&&a.content){const y=a.content.length>5e3;r.innerHTML=d(a.content.substring(0,5e3))+(y?`

... (truncated)`:"")}const c=t.querySelector(".status-chip");c&&(c.className=`status-chip ${a.status}`,c.textContent=E(a.status)),q(t,e),P(t,e),console.log("[Modal] Refreshed content for document:",e)}catch(n){console.error("[Modal] Failed to refresh content:",n)}}async function ne(t,e){const n=document.querySelector("#reprocess-btn"),a=document.querySelector(".document-preview-modal"),s=n?.innerHTML||"";try{n&&(n.disabled=!0,n.innerHTML='<span class="spinner"></span> Checking...');const l=(await b.get(`/api/documents/${t.id}/reprocess/check`)).data;if(!l.has_content){g.error("No content available for reprocessing");return}let r=!0;if(l.hash_match||l.total_entities>0){const x=l.hash_match?`Content has not changed since last processing.
`:"",f=l.total_entities>0?`There are ${l.total_entities} extracted entities that will be replaced.
`:"";r=confirm(`${x}${f}
Are you sure you want to reprocess?

This will:
- Remove all existing entities from this document
- Create new entities with AI analysis
- Use AI tokens`)}if(!r){g.info("Reprocessing cancelled");return}n&&(n.innerHTML='<span class="spinner"></span> Processing...'),g.info("Reprocessing started..."),await b.post(`/api/documents/${t.id}/reprocess`,{force:!0});let c=0;const y=60,u=async()=>{c++;try{const f=(await b.get(`/api/documents/${t.id}`)).data.status;return f==="processed"?(g.success("Document reprocessed successfully!"),a&&await te(a,t.id),e?.(),!0):f==="failed"?(g.error("Reprocessing failed"),!0):c>=y?(g.warning("Reprocessing still in progress. Check back later."),!0):(n&&(n.innerHTML=`<span class="spinner"></span> Processing... (${c}s)`),!1)}catch{return c>=y}};z=setInterval(async()=>{await u()&&(z&&(clearInterval(z),z=null),n&&(n.disabled=!1,n.innerHTML=s))},2e3)}catch(i){console.error("[Reprocess] Error:",i),g.error("Failed to reprocess document")}finally{n&&(n.disabled=!1,n.innerHTML=s)}}async function ie(t,e,n){const a=document.createElement("input");a.type="file",a.accept=".pdf,.doc,.docx,.txt,.md",a.onchange=async()=>{const s=a.files?.[0];if(!s)return;const i=prompt("Change notes (optional):"),l=new FormData;l.append("file",s),i&&l.append("change_notes",i);try{g.info("Uploading new version..."),await fetch(`/api/documents/${t.id}/versions`,{method:"POST",body:l,credentials:"include"}),g.success("New version uploaded"),N(e,t.id),n?.()}catch{g.error("Failed to upload new version")}},a.click()}async function ae(t,e){const n=t.querySelector("#share-expires").value,a=t.querySelector("#share-max-views").value,s=t.querySelector("#share-password").value,i=t.querySelector("#share-permissions").value;try{const l=await b.post(`/api/documents/${e.id}/share`,{expires:n,max_views:a?parseInt(a):null,password:s||null,permissions:[i==="download"?"view":i,...i==="download"?["download"]:[]]}),r=t.querySelector("#share-link-input");r.value=l.data.url,t.querySelector("#generate-link-btn").style.display="none",t.querySelector("#copy-link-btn").style.display="block",g.success("Share link generated")}catch{g.error("Failed to generate share link")}}function oe(t){const e=t.querySelector("#share-link-input");navigator.clipboard.writeText(e.value),g.success("Link copied to clipboard")}function re(t){switch(t.split(".").pop()?.toLowerCase()){case"pdf":return"📄";case"doc":case"docx":return"📝";case"xls":case"xlsx":return"📊";case"ppt":case"pptx":return"📽️";case"txt":case"md":return"📃";case"jpg":case"jpeg":case"png":case"gif":return"🖼️";default:return"📁"}}function se(t){return{created:"uploaded this document",viewed:"viewed this document",downloaded:"downloaded this document",updated:"updated this document",version_uploaded:"uploaded a new version",analyzed:"ran AI analysis",reprocessed:"reprocessed this document",shared:"shared this document",unshared:"removed share link",deleted:"deleted this document",restored:"restored this document",tagged:"added tags",favorited:"added to favorites",unfavorited:"removed from favorites",commented:"commented on this document"}[t]||t}function ce(t){return t.split(" ").map(e=>e[0]).join("").substring(0,2).toUpperCase()}function E(t){return t.charAt(0).toUpperCase()+t.slice(1)}export{pe as showDocumentPreviewModal};
//# sourceMappingURL=DocumentPreviewModal-CTJ1346U.js.map
