import{f as T,a as h,h as m,t as v,b as M}from"./main-CABUEUPe.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let x=!1,f=null;function Q(i){const{document:t}=i,e=document.createElement("div");e.className="document-preview-modal",e.innerHTML=`
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
      <div class="preview-icon">${U(t.filename||"")}</div>
      <div class="preview-title-section">
        <h3 class="preview-title">${d(t.filename||t.originalName||"Untitled")}</h3>
        <div class="preview-meta">
          <span>${T(t.size||0)}</span>
          <span>${h(t.created_at)}</span>
          <span class="status-badge status-${t.status}">${t.status}</span>
        </div>
      </div>
      <div class="preview-actions">
        <button class="btn btn-favorite ${x?"active":""}" id="favorite-btn" title="Favorite">
          ${x?"★":"☆"}
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
        <div class="summary-card" id="summary-card" style="${t.summary?"":"display:none"}">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              AI Summary
            </h4>
            <p id="doc-summary">${t.summary?d(t.summary):""}</p>
          </div>
        
        <div class="entities-grid" id="entities-grid">
          <div class="entity-card" data-entity="facts">
            <div class="entity-icon facts">📋</div>
            <div class="entity-info">
              <h5 class="entity-count">${t.facts_count||0}</h5>
              <span>Facts</span>
            </div>
          </div>
          <div class="entity-card" data-entity="decisions">
            <div class="entity-icon decisions">✓</div>
            <div class="entity-info">
              <h5 class="entity-count">${t.decisions_count||0}</h5>
              <span>Decisions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="risks">
            <div class="entity-icon risks">⚠️</div>
            <div class="entity-info">
              <h5 class="entity-count">${t.risks_count||0}</h5>
              <span>Risks</span>
            </div>
          </div>
          <div class="entity-card" data-entity="actions">
            <div class="entity-icon actions">📌</div>
            <div class="entity-info">
              <h5 class="entity-count">${t.actions_count||0}</h5>
              <span>Actions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="questions">
            <div class="entity-icon questions">❓</div>
            <div class="entity-info">
              <h5 class="entity-count">${t.questions_count||0}</h5>
              <span>Questions</span>
            </div>
          </div>
        </div>
        
        ${t.tags?.length?`
          <div class="tags-section">
            ${t.tags.map(c=>`<span class="doc-tag">#${d(c)}</span>`).join("")}
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
  `,e.querySelectorAll(".preview-tab").forEach(c=>{c.addEventListener("click",()=>{const r=c.getAttribute("data-tab");L(e,r)})}),e.querySelector("#favorite-btn")?.addEventListener("click",()=>R(e,t)),e.querySelector("#share-btn")?.addEventListener("click",()=>L(e,"share")),e.querySelector("#download-btn")?.addEventListener("click",()=>F(t)),e.querySelector("#reprocess-btn")?.addEventListener("click",()=>D(t,i.onUpdate)),e.querySelector("#upload-version-btn")?.addEventListener("click",()=>I(t,e,i.onUpdate)),e.querySelector("#generate-link-btn")?.addEventListener("click",()=>B(e,t)),e.querySelector("#copy-link-btn")?.addEventListener("click",()=>V(e)),q(e,t.id),E(e,t.id),k(e,t.id),_(e,t.id),z(e,t.id),H(e,t.id),j(t.id).then(c=>{x=c,C(e)});const s=document.createElement("div");s.className="modal-overlay document-preview-overlay",s.style.cssText=`
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
  `;const o=document.createElement("div");o.className="modal-container",o.style.cssText=`
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-height: 90vh;
    overflow: hidden;
    animation: slideUp 0.3s ease-out;
  `;const n=document.createElement("button");n.innerHTML="×",n.style.cssText=`
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
  `,n.onclick=()=>w(s,i.onClose),e.style.position="relative",e.appendChild(n),o.appendChild(e),s.appendChild(o),s.addEventListener("click",c=>{c.target===s&&w(s,i.onClose)});const a=c=>{c.key==="Escape"&&(w(s,i.onClose),document.removeEventListener("keydown",a))};document.addEventListener("keydown",a),document.body.appendChild(s)}function w(i,t){f&&(clearInterval(f),f=null),i.style.animation="fadeOut 0.2s ease-out",setTimeout(()=>{i.remove(),t?.()},200)}function L(i,t){i.querySelectorAll(".preview-tab").forEach(e=>{e.classList.toggle("active",e.getAttribute("data-tab")===t)}),i.querySelectorAll(".preview-section").forEach(e=>{e.classList.toggle("active",e.getAttribute("data-section")===t)})}async function q(i,t){const e=i.querySelector("#content-preview");try{const s=await m.get(`/api/documents/${t}`),n=(s.data.document||s.data)?.content;if(n){const a=n.length>5e3;e.innerHTML=`<pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${d(n.substring(0,5e3))}${a?`

... (truncated)`:""}</pre>`}else e.innerHTML='<div class="content-empty">No content extracted</div>'}catch(s){console.error("[Preview] Failed to load content:",s),e.innerHTML='<div class="content-empty">Failed to load content</div>'}}async function E(i,t){const e=i.querySelector("#entities-full-list"),s=i.querySelector("#entities-tab"),o=i.querySelector("#entities-count");try{const a=(await m.get(`/api/documents/${t}/extraction`)).data.extraction;if(!a){e.innerHTML='<div class="empty-section">No extraction data available</div>';return}const c=a.entities||[],r=a.facts||[],l=a.decisions||[],u=a.action_items||[],y=a.questions||[],g=a.risks||[],S=c.length+r.length+l.length+u.length+y.length+g.length;if(S===0){e.innerHTML='<div class="empty-section">No entities extracted</div>';return}s&&(s.style.display=""),o&&(o.textContent=String(S));let b=`<style>
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
    </style>`;c.length>0&&(b+=`<div class="entity-section">
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
      </div>`),r.length>0&&(b+=`<div class="entity-section">
        <div class="entity-section-title">
          📋 Facts
          <span class="entity-section-count">${r.length}</span>
        </div>
        ${r.map(p=>`
          <div class="entity-item">
            ${p.category?`<div class="entity-item-type">${d(p.category)}</div>`:""}
            <div class="entity-item-content">${d(p.content)}</div>
            ${p.confidence?`<div class="entity-item-meta">Confidence: ${Math.round(p.confidence*100)}%</div>`:""}
          </div>
        `).join("")}
      </div>`),l.length>0&&(b+=`<div class="entity-section">
        <div class="entity-section-title">
          ✓ Decisions
          <span class="entity-section-count">${l.length}</span>
        </div>
        ${l.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
          </div>
        `).join("")}
      </div>`),u.length>0&&(b+=`<div class="entity-section">
        <div class="entity-section-title">
          📌 Action Items
          <span class="entity-section-count">${u.length}</span>
        </div>
        ${u.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">☐ ${d(p.task)}</div>
            ${p.owner?`<div class="entity-item-meta">Owner: ${d(p.owner)}</div>`:""}
            ${p.status?`<div class="entity-item-meta">Status: ${d(p.status)}</div>`:""}
          </div>
        `).join("")}
      </div>`),y.length>0&&(b+=`<div class="entity-section">
        <div class="entity-section-title">
          ❓ Questions
          <span class="entity-section-count">${y.length}</span>
        </div>
        ${y.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
          </div>
        `).join("")}
      </div>`),g.length>0&&(b+=`<div class="entity-section">
        <div class="entity-section-title">
          ⚠️ Risks
          <span class="entity-section-count">${g.length}</span>
        </div>
        ${g.map(p=>`
          <div class="entity-item">
            <div class="entity-item-content">${d(p.content)}</div>
            ${p.severity?`<div class="entity-item-meta">Severity: ${d(p.severity)}</div>`:""}
          </div>
        `).join("")}
      </div>`),e.innerHTML=b}catch{e.innerHTML='<div class="empty-section">Failed to load entities</div>'}}async function k(i,t){const e=i.querySelector("#analysis-list");try{const o=(await m.get(`/api/documents/${t}/analysis`)).data.analyses||[];if(i.querySelector("#analysis-count").textContent=String(o.length),o.length===0){e.innerHTML=`
        <div class="empty-section">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>No AI analyses yet</p>
          <button class="btn btn-primary btn-sm" id="run-analysis-btn">Run Analysis</button>
        </div>
      `;const n=e.querySelector("#run-analysis-btn");n&&n.addEventListener("click",async()=>{const a=n,c=a.textContent;a.disabled=!0,a.textContent="Analyzing...";try{const r=await m.post(`/api/documents/${t}/reprocess`,{});r.data.success?(v.success("Analysis started"),setTimeout(()=>k(i,t),3e3)):(v.error(r.data.error||"Failed to start analysis"),a.disabled=!1,a.textContent=c)}catch(r){v.error(r.message||"Failed to run analysis"),a.disabled=!1,a.textContent=c}});return}e.innerHTML=o.map((n,a)=>`
      <div class="analysis-item" data-id="${n.id}">
        <div class="analysis-version">v${o.length-a}</div>
        <div class="analysis-info">
          <div class="analysis-title">${$(n.analysis_type)}</div>
          <div class="analysis-meta">
            <span>${n.provider}/${n.model}</span>
            <span>${n.entities_extracted||0} entities</span>
            <span>${(n.input_tokens||0)+(n.output_tokens||0)} tokens</span>
            ${n.cost?`<span>$${n.cost.toFixed(4)}</span>`:""}
          </div>
          <div class="analysis-timestamp" style="font-size: 12px; color: var(--text-tertiary, #666); margin-top: 4px;">
            ${M(n.created_at)} (${h(n.created_at)})
          </div>
        </div>
        <div class="analysis-actions">
          <button class="btn btn-sm view-analysis-btn">View</button>
          <button class="btn btn-sm compare-analysis-btn">Compare</button>
        </div>
      </div>
    `).join(""),e.querySelectorAll(".view-analysis-btn").forEach((n,a)=>{n.addEventListener("click",()=>{const c=o[a];A(i,c)})}),e.querySelectorAll(".compare-analysis-btn").forEach((n,a)=>{n.addEventListener("click",()=>{if(o.length<2){v.info("Need at least 2 analyses to compare");return}v.info("Compare feature coming soon")})})}catch{e.innerHTML='<div class="empty-section">No analysis history available</div>'}}async function A(i,t){let e=t.result;if(!e&&t.document_id)try{const r=await m.get(`/api/documents/${t.document_id}`);e=r.data.document?.extraction_result||r.data.extraction_result,console.log("[Analysis] Loaded extraction_result from document:",!!e)}catch(r){console.warn("[Analysis] Could not load extraction_result:",r)}const s=document.createElement("div");s.className="analysis-detail-overlay",s.style.cssText=`
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
  `;const o=e?JSON.stringify(e,null,2):"No detailed result available";let n="";if(e){const r=e;r.summary?n=r.summary:r.meeting?.title&&(n=`Meeting: ${r.meeting.title}`)}const a=document.createElement("div");a.className="analysis-detail-content",a.style.cssText=`
    background: var(--bg-primary, #1a1a2e);
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `,a.innerHTML=`
    <div style="padding: 20px; border-bottom: 1px solid var(--border-color, #333); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 style="margin: 0; color: var(--text-primary, #fff);">${$(t.analysis_type)} Analysis</h3>
        <p style="margin: 4px 0 0; color: var(--text-secondary, #888); font-size: 13px;">
          ${t.provider}/${t.model} • ${t.entities_extracted||0} entities • ${h(t.created_at)}
        </p>
      </div>
      <button class="close-analysis-btn" style="background: none; border: none; color: var(--text-secondary, #888); cursor: pointer; font-size: 24px;">&times;</button>
    </div>
    ${n?`
      <div style="padding: 16px 20px; background: var(--bg-secondary, #252542); border-bottom: 1px solid var(--border-color, #333);">
        <strong style="color: var(--text-primary, #fff);">Summary:</strong>
        <p style="margin: 8px 0 0; color: var(--text-secondary, #ccc);">${d(n)}</p>
      </div>
    `:""}
    <div style="padding: 20px; overflow-y: auto; flex: 1;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${t.entities_extracted||0}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Entities</div>
        </div>
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${t.input_tokens||0}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Input Tokens</div>
        </div>
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${t.output_tokens||0}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Output Tokens</div>
        </div>
        <div style="background: var(--bg-secondary, #252542); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-color, #6366f1);">${t.latency_ms?`${(t.latency_ms/1e3).toFixed(1)}s`:"-"}</div>
          <div style="font-size: 12px; color: var(--text-secondary, #888);">Latency</div>
        </div>
      </div>
      <details style="margin-top: 16px;">
        <summary style="cursor: pointer; color: var(--text-primary, #fff); font-weight: 500; padding: 8px 0;">Raw Result JSON</summary>
        <pre style="background: var(--bg-tertiary, #1e1e3f); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; color: var(--text-secondary, #ccc); max-height: 400px; overflow-y: auto;">${d(o)}</pre>
      </details>
    </div>
  `,s.appendChild(a),document.body.appendChild(s),a.querySelector(".close-analysis-btn")?.addEventListener("click",()=>s.remove()),s.addEventListener("click",r=>{r.target===s&&s.remove()})}async function _(i,t){const e=i.querySelector("#versions-list");try{const o=(await m.get(`/api/documents/${t}/versions`)).data.versions||[];if(i.querySelector("#versions-count").textContent=String(o.length||1),o.length===0){e.innerHTML=`
        <div class="version-item current">
          <div class="version-badge">v1</div>
          <div class="version-info">
            <div class="version-title">Current Version <span class="current-tag">Current</span></div>
            <div class="version-notes">Initial upload</div>
          </div>
        </div>
      `;return}e.innerHTML=o.map(n=>`
      <div class="version-item ${n.is_current?"current":""}" data-id="${n.id}">
        <div class="version-badge">v${n.version_number}</div>
        <div class="version-info">
          <div class="version-title">
            ${d(n.filename)}
            ${n.is_current?'<span class="current-tag">Current</span>':""}
          </div>
          ${n.change_notes?`<div class="version-notes">"${d(n.change_notes)}"</div>`:""}
          <div class="version-meta">
            ${T(n.file_size)} • ${h(n.created_at)}
          </div>
          ${n.ai_change_summary?`
            <div class="version-ai-summary">
              <strong>AI:</strong> ${d(n.ai_change_summary)}
            </div>
          `:""}
        </div>
        <div class="version-actions" style="display: flex; gap: 8px;">
          <button class="btn btn-sm view-version-btn">View</button>
          ${n.is_current?"":'<button class="btn btn-sm restore-version-btn">Restore</button>'}
          ${n.version_number>1?'<button class="btn btn-sm diff-version-btn">Diff</button>':""}
        </div>
      </div>
    `).join("")}catch{e.innerHTML='<div class="empty-section">Version history not available</div>'}}async function z(i,t){const e=i.querySelector("#activity-timeline");try{const o=(await m.get(`/api/documents/${t}/activity`)).data.activities||[];if(o.length===0){e.innerHTML='<div class="empty-section">No activity recorded</div>';return}e.innerHTML=o.map(n=>`
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-avatar">
            ${n.user_avatar?`<img src="${n.user_avatar}" alt="">`:G(n.user_name||"System")}
          </div>
          <div class="activity-text">
            <strong>${d(n.user_name||"System")}</strong> ${O(n.action)}
          </div>
          <div class="activity-time">${h(n.created_at)}</div>
        </div>
      </div>
    `).join("")}catch{e.innerHTML='<div class="empty-section">Activity not available</div>'}}async function H(i,t){const e=i.querySelector("#notes-container"),s=i.querySelector("#notes-tab");try{const n=(await m.get(`/api/documents/${t}/extraction`)).data.extraction;if(!(n?.notes_rendered_text||(n?.notes?.key_points?.length||0)>0)){s&&(s.style.display="none");return}s&&(s.style.display="");const c=n?.notes_rendered_text||"",r=n?.notes;if(c)e.innerHTML=`
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
          ${N(c)}
          <div class="notes-actions">
            <button class="btn btn-secondary btn-sm" id="copy-notes-btn">
              📋 Copy Notes
            </button>
          </div>
        </div>
      `,i.querySelector("#copy-notes-btn")?.addEventListener("click",()=>{navigator.clipboard.writeText(c),v.success("Notes copied to clipboard")});else if(r){const l=r.key_points?.map(y=>`• ${y.text}`).join(`
`)||"",u=r.outline?.map(y=>`**${y.topic}**
${y.bullets?.map(g=>`  • ${g.text}`).join(`
`)||""}`).join(`

`)||"";e.innerHTML=`
        <div class="notes-structured">
          ${l?`<div class="notes-section"><h4>Key Points</h4><pre style="white-space: pre-wrap;">${d(l)}</pre></div>`:""}
          ${u?`<div class="notes-section"><h4>Outline</h4><pre style="white-space: pre-wrap;">${d(u)}</pre></div>`:""}
        </div>
      `}}catch{e.innerHTML='<div class="empty-section">Meeting notes not available</div>',s&&(s.style.display="none")}}function d(i){const t=document.createElement("div");return t.textContent=i,t.innerHTML}function N(i){const t=i.split(`
`);let e="",s="",o="",n=!1,a=!1;const c=()=>{s&&o&&(e+=`
        <div class="notes-topic">
          <div class="notes-topic-title">${d(s)}</div>
          ${o}
        </div>
      `),s="",o=""};for(const r of t){const l=r.trim();if(l){if(!n&&l.startsWith("📝")){e+=`<div class="notes-header">${d(l)}</div>`,n=!0;continue}if(!a&&l.startsWith("🕞")){e+=`<div class="notes-meta">${d(l)}</div>`,a=!0;continue}if(l.startsWith("-")){const u=l.substring(1).trim();o+=`<div class="notes-bullet">${d(u)}</div>`;continue}c(),s=l}}return c(),e.includes("notes-topic")?e:`<pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6;">${d(i)}</pre>`}async function j(i){try{return(await m.get(`/api/documents/${i}/favorite`)).data.is_favorite||!1}catch{return!1}}function C(i){const t=i.querySelector("#favorite-btn");t&&(t.classList.toggle("active",x),t.innerHTML=x?"★":"☆")}async function R(i,t){try{await m.post(`/api/documents/${t.id}/favorite`),x=!x,C(i),v.success(x?"Added to favorites":"Removed from favorites")}catch{v.error("Failed to update favorite")}}function F(i){window.open(`/api/documents/${i.id}/download`,"_blank")}async function P(i,t){try{const s=(await m.get(`/api/documents/${t}`)).data,o=["facts","decisions","risks","actions","questions"];for(const l of o){const u=i.querySelector(`[data-entity="${l}"]`);if(u){const y=u.querySelector(".entity-count");if(y){const g=s[`${l}_count`]||0;y.textContent=String(g),u.classList.add("updated"),setTimeout(()=>u.classList.remove("updated"),1500)}}}const n=i.querySelector("#summary-card"),a=i.querySelector("#doc-summary");n&&a&&(s.summary?(n.style.display="",a.textContent=s.summary):n.style.display="none");const c=i.querySelector("#content-preview");if(c&&s.content){const l=s.content.length>5e3;c.innerHTML=d(s.content.substring(0,5e3))+(l?`

... (truncated)`:"")}const r=i.querySelector(".status-chip");r&&(r.className=`status-chip ${s.status}`,r.textContent=$(s.status)),k(i,t),z(i,t),console.log("[Modal] Refreshed content for document:",t)}catch(e){console.error("[Modal] Failed to refresh content:",e)}}async function D(i,t){const e=document.querySelector("#reprocess-btn"),s=document.querySelector(".document-preview-modal"),o=e?.innerHTML||"";try{e&&(e.disabled=!0,e.innerHTML='<span class="spinner"></span> Checking...');const a=(await m.get(`/api/documents/${i.id}/reprocess/check`)).data;if(!a.has_content){v.error("No content available for reprocessing");return}let c=!0;if(a.hash_match||a.total_entities>0){const y=a.hash_match?`Content has not changed since last processing.
`:"",g=a.total_entities>0?`There are ${a.total_entities} extracted entities that will be replaced.
`:"";c=confirm(`${y}${g}
Are you sure you want to reprocess?

This will:
- Remove all existing entities from this document
- Create new entities with AI analysis
- Use AI tokens`)}if(!c){v.info("Reprocessing cancelled");return}e&&(e.innerHTML='<span class="spinner"></span> Processing...'),v.info("Reprocessing started..."),await m.post(`/api/documents/${i.id}/reprocess`,{force:!0});let r=0;const l=60,u=async()=>{r++;try{const g=(await m.get(`/api/documents/${i.id}`)).data.status;return g==="processed"?(v.success("Document reprocessed successfully!"),s&&await P(s,i.id),t?.(),!0):g==="failed"?(v.error("Reprocessing failed"),!0):r>=l?(v.warning("Reprocessing still in progress. Check back later."),!0):(e&&(e.innerHTML=`<span class="spinner"></span> Processing... (${r}s)`),!1)}catch{return r>=l}};f=setInterval(async()=>{await u()&&(f&&(clearInterval(f),f=null),e&&(e.disabled=!1,e.innerHTML=o))},2e3)}catch(n){console.error("[Reprocess] Error:",n),v.error("Failed to reprocess document")}finally{e&&(e.disabled=!1,e.innerHTML=o)}}async function I(i,t,e){const s=document.createElement("input");s.type="file",s.accept=".pdf,.doc,.docx,.txt,.md",s.onchange=async()=>{const o=s.files?.[0];if(!o)return;const n=prompt("Change notes (optional):"),a=new FormData;a.append("file",o),n&&a.append("change_notes",n);try{v.info("Uploading new version..."),await fetch(`/api/documents/${i.id}/versions`,{method:"POST",body:a,credentials:"include"}),v.success("New version uploaded"),_(t,i.id),e?.()}catch{v.error("Failed to upload new version")}},s.click()}async function B(i,t){const e=i.querySelector("#share-expires").value,s=i.querySelector("#share-max-views").value,o=i.querySelector("#share-password").value,n=i.querySelector("#share-permissions").value;try{const a=await m.post(`/api/documents/${t.id}/share`,{expires:e,max_views:s?parseInt(s):null,password:o||null,permissions:[n==="download"?"view":n,...n==="download"?["download"]:[]]}),c=i.querySelector("#share-link-input");c.value=a.data.url,i.querySelector("#generate-link-btn").style.display="none",i.querySelector("#copy-link-btn").style.display="block",v.success("Share link generated")}catch{v.error("Failed to generate share link")}}function V(i){const t=i.querySelector("#share-link-input");navigator.clipboard.writeText(t.value),v.success("Link copied to clipboard")}function U(i){switch(i.split(".").pop()?.toLowerCase()){case"pdf":return"📄";case"doc":case"docx":return"📝";case"xls":case"xlsx":return"📊";case"ppt":case"pptx":return"📽️";case"txt":case"md":return"📃";case"jpg":case"jpeg":case"png":case"gif":return"🖼️";default:return"📁"}}function O(i){return{created:"uploaded this document",viewed:"viewed this document",downloaded:"downloaded this document",updated:"updated this document",version_uploaded:"uploaded a new version",analyzed:"ran AI analysis",reprocessed:"reprocessed this document",shared:"shared this document",unshared:"removed share link",deleted:"deleted this document",restored:"restored this document",tagged:"added tags",favorited:"added to favorites",unfavorited:"removed from favorites",commented:"commented on this document"}[i]||i}function G(i){return i.split(" ").map(t=>t[0]).join("").substring(0,2).toUpperCase()}function $(i){return i.charAt(0).toUpperCase()+i.slice(1)}export{Q as showDocumentPreviewModal};
//# sourceMappingURL=DocumentPreviewModal-DRvGLx1o.js.map
