const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/main-v_cFye9p.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-Cr-TCRi2.css"])))=>i.map(i=>d[i]);
import{c as z,_ as E,l as $,h as S,t as l,m as q,n as A,f as F}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let x="processed",v="all",b="date",L="grid",m="",c=new Set,u=[];function I(e={}){const i=z("div",{className:"documents-panel-minimal"});return i.innerHTML=`
    <style>
      .documents-panel-minimal {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary);
        padding: 32px;
      }

      /* Header - Minimal */
      .docs-header-minimal {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 32px;
      }
      .docs-title-section {
        display: flex;
        align-items: baseline;
        gap: 16px;
      }
      .docs-title-section h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .docs-total-count {
        font-size: 16px;
        color: var(--text-tertiary);
        font-weight: 400;
      }
      .docs-header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      
      /* View Mode Toggle */
      .view-mode-toggle {
        display: flex;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 4px;
        gap: 2px;
      }
      .view-mode-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        color: var(--text-tertiary);
        transition: all 0.15s ease;
      }
      .view-mode-btn:hover {
        color: var(--text-primary);
        background: var(--bg-tertiary);
      }
      .view-mode-btn.active {
        background: var(--primary);
        color: white;
      }
      .view-mode-btn svg {
        width: 18px;
        height: 18px;
      }

      .btn-minimal {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
      }
      .btn-minimal.primary {
        background: var(--primary);
        color: white;
      }
      .btn-minimal.primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .btn-minimal.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      .btn-minimal.secondary:hover {
        background: var(--bg-tertiary);
      }
      .btn-minimal svg {
        width: 16px;
        height: 16px;
      }

      /* Search and Filters - Single Line */
      .docs-controls {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .docs-search-minimal {
        flex: 1;
        min-width: 280px;
        max-width: 400px;
        position: relative;
      }
      .docs-search-minimal input {
        width: 100%;
        padding: 12px 16px 12px 44px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.15s ease;
      }
      .docs-search-minimal input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      .docs-search-minimal input::placeholder {
        color: var(--text-tertiary);
      }
      .docs-search-minimal svg {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-tertiary);
        width: 18px;
        height: 18px;
      }

      /* Filter Chips */
      .docs-filters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .filter-chip-minimal {
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        background: var(--bg-secondary);
        color: var(--text-secondary);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .filter-chip-minimal:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      .filter-chip-minimal.active {
        background: var(--primary);
        color: white;
      }

      /* Divider with status */
      .docs-status-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 0;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 24px;
      }
      .status-chip {
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        background: transparent;
        border: none;
        color: var(--text-secondary);
      }
      .status-chip:hover {
        background: var(--bg-tertiary);
      }
      .status-chip.active {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      .status-chip.active.processed { color: #10b981; background: rgba(16, 185, 129, 0.1); }
      .status-chip.active.pending { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
      .status-chip.active.failed { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
      .status-chip.active.deleted { color: #6b7280; background: rgba(107, 114, 128, 0.1); }
      .status-chip .chip-count {
        margin-left: 6px;
        padding: 2px 6px;
        font-size: 10px;
        background: rgba(0,0,0,0.05);
        border-radius: 6px;
      }
      [data-theme="dark"] .status-chip .chip-count {
        background: rgba(255,255,255,0.1);
      }
      .status-chip.active .chip-count {
        background: rgba(0,0,0,0.1);
      }
      .docs-sort-minimal {
        margin-left: auto;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        font-size: 13px;
        color: var(--text-primary);
        cursor: pointer;
      }

      /* Documents Grid - Larger Cards */
      .docs-content-minimal {
        flex: 1;
        overflow-y: auto;
      }
      .docs-grid-minimal {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 20px;
      }
      
      /* List View Mode */
      .docs-grid-minimal.list-view {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .docs-grid-minimal.list-view .doc-card-minimal {
        flex-direction: row;
        align-items: center;
        padding: 12px 20px;
        gap: 16px;
        border-radius: 12px;
      }
      .docs-grid-minimal.list-view .doc-card-header {
        flex-shrink: 0;
        gap: 12px;
      }
      .docs-grid-minimal.list-view .doc-card-header .doc-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
        border-radius: 8px;
      }
      .docs-grid-minimal.list-view .doc-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 24px;
        min-width: 0;
      }
      .docs-grid-minimal.list-view .doc-filename {
        flex: 1;
        min-width: 0;
        margin: 0;
      }
      .docs-grid-minimal.list-view .doc-meta {
        display: flex;
        gap: 16px;
        color: var(--text-tertiary);
        font-size: 13px;
        flex-shrink: 0;
      }
      .docs-grid-minimal.list-view .doc-status-badge {
        margin: 0;
        flex-shrink: 0;
      }
      .docs-grid-minimal.list-view .doc-summary-section,
      .docs-grid-minimal.list-view .doc-entities-mini,
      .docs-grid-minimal.list-view .doc-card-hover {
        display: none;
      }

      /* Document Card - Clean Design */
      .doc-card-minimal {
        background: var(--bg-secondary);
        border-radius: 16px;
        border: 1px solid var(--border-color);
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .doc-card-minimal:hover {
        border-color: rgba(var(--primary-rgb), 0.4);
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        transform: translateY(-2px);
      }
      .doc-card-minimal.selected {
        border-color: var(--primary);
        background: rgba(var(--primary-rgb), 0.02);
      }

      /* Card Header */
      .doc-card-top {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      .doc-icon-minimal {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
      }
      .doc-icon-minimal.pdf { background: linear-gradient(135deg, #fef2f2, #fee2e2); }
      .doc-icon-minimal.doc { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
      .doc-icon-minimal.img { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
      .doc-icon-minimal.txt { background: linear-gradient(135deg, #fefce8, #fef9c3); }
      .doc-icon-minimal.default { background: linear-gradient(135deg, #f5f5f5, #e5e5e5); }
      [data-theme="dark"] .doc-icon-minimal.pdf { background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.doc { background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.img { background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.txt { background: linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.default { background: linear-gradient(135deg, rgba(107,114,128,0.15), rgba(107,114,128,0.1)); }

      .doc-info-minimal {
        flex: 1;
        min-width: 0;
      }
      .doc-filename-minimal {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .doc-meta-minimal {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-tertiary);
      }
      .doc-meta-minimal .sep {
        color: var(--border-color);
      }
      .doc-status-badge {
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        text-transform: capitalize;
      }
      .doc-status-badge.processed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
      .doc-status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      .doc-status-badge.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      .doc-status-badge.deleted { background: rgba(107, 114, 128, 0.1); color: #6b7280; }

      /* Card Summary */
      .doc-summary-minimal {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Card Footer */
      .doc-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
      }
      .doc-entities {
        display: flex;
        gap: 16px;
      }
      .doc-entity-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .doc-entity-item .icon {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      }
      .doc-entity-item.facts .icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
      .doc-entity-item.decisions .icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
      .doc-entity-item.risks .icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

      .doc-actions-minimal {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .doc-card-minimal:hover .doc-actions-minimal {
        opacity: 1;
      }
      .doc-action-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .doc-action-btn:hover {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
      }
      .doc-action-btn.favorite.active {
        color: #f59e0b;
      }
      .doc-action-btn.favorite:hover {
        background: #f59e0b;
        border-color: #f59e0b;
        color: white;
      }

      /* Selection */
      .doc-select-checkbox {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid var(--border-color);
        background: var(--bg-primary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 0.15s ease;
        font-size: 12px;
        color: white;
      }
      .doc-card-minimal:hover .doc-select-checkbox,
      .doc-card-minimal.selected .doc-select-checkbox {
        opacity: 1;
      }
      .doc-card-minimal.selected .doc-select-checkbox {
        background: var(--primary);
        border-color: var(--primary);
      }

      /* Selection Bar */
      .selection-bar-minimal {
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 24px;
        background: #1e293b;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.25);
        z-index: 100;
        animation: slideUp 0.25s ease;
      }
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      .selection-bar-minimal.hidden { display: none; }
      .selection-count-minimal {
        color: white;
        font-weight: 600;
        padding-right: 16px;
        border-right: 1px solid rgba(255,255,255,0.2);
      }
      .selection-count-minimal span { color: #60a5fa; }
      .selection-bar-minimal .btn-minimal {
        padding: 8px 16px;
        font-size: 13px;
      }
      .selection-bar-minimal .btn-minimal.secondary {
        background: rgba(255,255,255,0.1);
        color: white;
        border-color: transparent;
      }
      .selection-bar-minimal .btn-minimal.secondary:hover {
        background: rgba(255,255,255,0.2);
      }
      .selection-bar-minimal .btn-minimal.danger {
        background: #ef4444;
        color: white;
        border: none;
      }

      /* Empty State */
      .docs-empty-minimal {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 40px;
        text-align: center;
        grid-column: 1 / -1;
      }
      .docs-empty-minimal .empty-icon {
        width: 80px;
        height: 80px;
        border-radius: 24px;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        margin-bottom: 24px;
      }
      .docs-empty-minimal h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .docs-empty-minimal p {
        margin: 0 0 24px 0;
        color: var(--text-secondary);
      }

      /* Loading */
      .docs-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        grid-column: 1 / -1;
        color: var(--text-secondary);
        gap: 12px;
      }
      .docs-loading::after {
        content: '';
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Accessibility: Screen reader only content */
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      
      /* Focus styles for keyboard navigation */
      .doc-card-minimal:focus {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      .doc-card-minimal:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
    </style>
    
    <!-- Header -->
    <div class="docs-header-minimal">
      <div class="docs-title-section">
        <h1>Files</h1>
        <span class="docs-total-count"><span id="total-count">0</span> documents</span>
      </div>
      <div class="docs-header-actions">
        <!-- View Mode Toggle -->
        <div class="view-mode-toggle">
          <button class="view-mode-btn active" data-view="grid" title="Grid view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button class="view-mode-btn" data-view="list" title="List view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
        <button class="btn-minimal primary" id="upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload
        </button>
      </div>
    </div>

    <!-- Controls -->
    <div class="docs-controls" role="search">
      <div class="docs-search-minimal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input type="text" id="docs-search-input" placeholder="Search files..." 
               aria-label="Search files" autocomplete="off">
      </div>
      <div class="docs-filters" role="tablist" aria-label="Filter by document type">
        <button class="filter-chip-minimal active" data-type="all" role="tab" aria-selected="true">All</button>
        <button class="filter-chip-minimal" data-type="documents" role="tab" aria-selected="false">Documents</button>
        <button class="filter-chip-minimal" data-type="transcripts" role="tab" aria-selected="false">Transcripts</button>
        <button class="filter-chip-minimal" data-type="emails" role="tab" aria-selected="false">Emails</button>
        <button class="filter-chip-minimal" data-type="images" role="tab" aria-selected="false">Images</button>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="docs-status-bar" role="tablist" aria-label="Filter by status">
      <button class="status-chip active processed" data-status="processed" role="tab" aria-selected="true">
        Processed <span class="chip-count" id="count-processed" aria-label="count">0</span>
      </button>
      <button class="status-chip pending" data-status="pending" role="tab" aria-selected="false">
        Pending <span class="chip-count" id="count-pending" aria-label="count">0</span>
      </button>
      <button class="status-chip failed" data-status="failed" role="tab" aria-selected="false">
        Failed <span class="chip-count" id="count-failed" aria-label="count">0</span>
      </button>
      <button class="status-chip deleted" data-status="deleted" role="tab" aria-selected="false">
        Deleted <span class="chip-count" id="count-deleted" aria-label="count">0</span>
      </button>
      <label for="sort-select" class="visually-hidden">Sort order</label>
      <select class="docs-sort-minimal" id="sort-select" aria-label="Sort files">
        <option value="date">Newest first</option>
        <option value="name">Name A-Z</option>
        <option value="size">Largest first</option>
      </select>
    </div>

    <!-- Content -->
    <div class="docs-content-minimal" role="main">
      <div class="docs-grid-minimal" id="docs-grid" role="list" aria-label="Document list" tabindex="0">
        <div class="docs-loading" aria-live="polite">Loading files</div>
      </div>
    </div>

    <!-- Selection Bar -->
    <div class="selection-bar-minimal hidden" id="selection-bar" role="toolbar" aria-label="Bulk actions">
      <span class="selection-count-minimal" aria-live="polite"><span id="selected-count">0</span> selected</span>
      <button class="btn-minimal secondary" id="bulk-export-btn" aria-label="Export selected files">Export</button>
      <button class="btn-minimal secondary" id="bulk-reprocess-btn" aria-label="Reprocess selected files">Reprocess</button>
      <button class="btn-minimal danger" id="bulk-delete-btn" aria-label="Delete selected files">Delete</button>
      <button class="btn-minimal secondary" id="cancel-selection-btn" aria-label="Cancel selection">Cancel</button>
    </div>
  `,T(i,e),d(i,e),i}function T(e,i){e.querySelector("#upload-btn")?.addEventListener("click",async()=>{const{showFileUploadModal:t}=await E(async()=>{const{showFileUploadModal:a}=await import("./main-v_cFye9p.js").then(o=>o.a0);return{showFileUploadModal:a}},__vite__mapDeps([0,1,2]));t({onComplete:()=>d(e,i)})});const r=e.querySelector("#docs-search-input");let n;r?.addEventListener("input",()=>{clearTimeout(n),n=setTimeout(()=>{const t=r.value.trim();t!==m&&(m=t,(m.length>=2||m.length===0)&&d(e,i))},500)}),e.querySelector("#sort-select")?.addEventListener("change",t=>{b=t.target.value,w(e,i)}),e.querySelectorAll(".filter-chip-minimal").forEach(t=>{t.addEventListener("click",()=>{e.querySelectorAll(".filter-chip-minimal").forEach(a=>a.classList.remove("active")),t.classList.add("active"),v=t.getAttribute("data-type"),w(e,i)})}),e.querySelectorAll(".status-chip").forEach(t=>{t.addEventListener("click",()=>{e.querySelectorAll(".status-chip").forEach(a=>a.classList.remove("active")),t.classList.add("active"),x=t.getAttribute("data-status"),d(e,i)})}),e.querySelectorAll(".view-mode-btn").forEach(t=>{t.addEventListener("click",()=>{e.querySelectorAll(".view-mode-btn").forEach(o=>o.classList.remove("active")),t.classList.add("active"),L=t.getAttribute("data-view");const a=e.querySelector("#docs-grid");a&&(L==="list"?a.classList.add("list-view"):a.classList.remove("list-view"))})}),e.querySelector("#bulk-delete-btn")?.addEventListener("click",()=>M(e,i)),e.querySelector("#bulk-export-btn")?.addEventListener("click",()=>U()),e.querySelector("#bulk-reprocess-btn")?.addEventListener("click",()=>P(e,i)),e.querySelector("#cancel-selection-btn")?.addEventListener("click",()=>{c.clear(),h(e)})}async function d(e,i){const r=e.querySelector("#docs-grid");r.innerHTML='<div class="docs-loading" aria-live="polite">Loading files</div>';try{const n=await $.getAll({status:x==="all"?void 0:x,type:v==="all"?void 0:v,search:m||void 0,sort:b==="date"?"created_at":b==="name"?"filename":void 0,order:b==="date"?"desc":"asc",limit:100});u=n.documents||[],console.log("%c[DocumentsPanel] Load result:","color: green; font-weight: bold",{total:n.total,docsCount:u.length,firstDoc:u[0],currentStatus:x,currentType:v});const t=n.statuses||{};e.querySelector("#total-count").textContent=String(n.total||u.length),e.querySelector("#count-processed").textContent=String(t.processed||0),e.querySelector("#count-pending").textContent=String((t.pending||0)+(t.processing||0)),e.querySelector("#count-failed").textContent=String(t.failed||0),e.querySelector("#count-deleted").textContent=String(t.deleted||0),w(e,i)}catch(n){console.error("[DocumentsPanel] Failed to load:",n),r.innerHTML='<div class="docs-empty-minimal"><div class="empty-icon">!</div><h3>Failed to load files</h3><p>Please try again</p></div>'}}function w(e,i){let r=[...u];b==="size"&&r.sort((n,t)=>(t.size||0)-(n.size||0)),_(e,r,i)}function _(e,i,r){const n=e.querySelector("#docs-grid");if(i.length===0){n.innerHTML=`
      <div class="docs-empty-minimal">
        <div class="empty-icon">📁</div>
        <h3>No files found</h3>
        <p>Upload files to get started</p>
        <button class="btn-minimal primary" id="empty-upload-btn">Upload Files</button>
      </div>
    `,n.querySelector("#empty-upload-btn")?.addEventListener("click",async()=>{const{showFileUploadModal:t}=await E(async()=>{const{showFileUploadModal:a}=await import("./main-v_cFye9p.js").then(o=>o.a0);return{showFileUploadModal:a}},__vite__mapDeps([0,1,2]));t({onComplete:()=>d(e,r)})});return}n.innerHTML=i.map((t,a)=>j(t,a)).join(""),n.setAttribute("data-total",String(i.length)),n.querySelectorAll(".doc-card-minimal").forEach(t=>{const a=t.getAttribute("data-id"),o=i.find(s=>String(s.id)===a);t.addEventListener("click",s=>{const p=s.target;p.closest(".doc-select-checkbox")||p.closest(".doc-action-btn")||o&&r.onDocumentClick&&r.onDocumentClick(o)}),t.addEventListener("keydown",s=>{const p=s,g=Array.from(n.querySelectorAll(".doc-card-minimal")),f=g.indexOf(t);switch(p.key){case"Enter":case" ":s.preventDefault(),o&&r.onDocumentClick&&r.onDocumentClick(o);break;case"ArrowDown":case"ArrowRight":s.preventDefault(),f<g.length-1&&g[f+1].focus();break;case"ArrowUp":case"ArrowLeft":s.preventDefault(),f>0&&g[f-1].focus();break;case"s":s.preventDefault(),c.has(a)?c.delete(a):c.add(a),h(e);break;case"Delete":case"Backspace":s.preventDefault(),o&&confirm(`Delete "${o.filename}"?`)&&$.delete(a,{softDelete:!0}).then(()=>{l.success("File deleted"),d(e,r)}).catch(()=>l.error("Failed to delete"));break}}),t.querySelector(".doc-select-checkbox")?.addEventListener("click",s=>{s.stopPropagation(),c.has(a)?c.delete(a):c.add(a),h(e)}),t.querySelector(".doc-action-btn.favorite")?.addEventListener("click",async s=>{s.stopPropagation();try{await S.post(`/api/documents/${a}/favorite`),s.target.classList.toggle("active"),l.success("Updated favorites")}catch{l.error("Failed to update favorite")}})})}function j(e,i=0){const r=B(e.filename||""),n=R(e.filename||""),t=c.has(e.id),a=e.facts_count||0,o=e.decisions_count||0,s=e.risks_count||0,p=[a>0?`${a} facts`:"",o>0?`${o} decisions`:"",s>0?`${s} risks`:""].filter(Boolean).join(", ")||"No entities";return`
    <div class="doc-card-minimal ${t?"selected":""}" 
         data-id="${e.id}"
         data-index="${i}"
         role="listitem"
         tabindex="0"
         aria-label="${k(e.filename||"Untitled")}. Status: ${e.status}. ${p}">
      <div class="doc-select-checkbox" role="checkbox" aria-checked="${t}" aria-label="Select document">${t?"✓":""}</div>
      
      <div class="doc-card-top">
        <div class="doc-icon-minimal ${r}" aria-hidden="true">${n}</div>
        <div class="doc-info-minimal">
          <div class="doc-filename-minimal">${k(e.filename||"Untitled")}</div>
          <div class="doc-meta-minimal">
            <span>${A(e.file_size||e.size||0)}</span>
            <span class="sep" aria-hidden="true">•</span>
            <span>${F(e.created_at)}</span>
          </div>
        </div>
        <span class="doc-status-badge ${e.status}" aria-label="Status: ${e.status}">${e.status}</span>
      </div>
      
      ${e.summary?`<div class="doc-summary-minimal">${k(e.summary)}</div>`:""}
      
      <div class="doc-card-footer">
        <div class="doc-entities" aria-label="Extracted entities">
          ${a>0?`<span class="doc-entity-item facts"><span class="icon" aria-hidden="true">📋</span> ${a} facts</span>`:""}
          ${o>0?`<span class="doc-entity-item decisions"><span class="icon" aria-hidden="true">✓</span> ${o}</span>`:""}
          ${s>0?`<span class="doc-entity-item risks"><span class="icon" aria-hidden="true">⚠</span> ${s}</span>`:""}
          ${a===0&&o===0&&s===0?'<span class="doc-entity-item text-muted">No entities</span>':""}
        </div>
        <div class="doc-actions-minimal">
          <button class="doc-action-btn favorite ${e.is_favorite?"active":""}" 
                  title="Favorite" aria-label="${e.is_favorite?"Remove from favorites":"Add to favorites"}"
                  aria-pressed="${e.is_favorite?"true":"false"}">★</button>
        </div>
      </div>
    </div>
  `}function B(e){switch(e.split(".").pop()?.toLowerCase()){case"pdf":return"pdf";case"doc":case"docx":return"doc";case"jpg":case"jpeg":case"png":case"gif":return"img";case"txt":case"md":return"txt";default:return"default"}}function h(e){const i=c.size;e.querySelector("#selection-bar").classList.toggle("hidden",i===0),e.querySelector("#selected-count").textContent=String(i),e.querySelectorAll(".doc-card-minimal").forEach(n=>{const t=n.getAttribute("data-id"),a=c.has(t);n.classList.toggle("selected",a);const o=n.querySelector(".doc-select-checkbox");o&&(o.textContent=a?"✓":"")})}function D(e,i){const r=document.createElement("div");return r.className="bulk-loading-overlay",r.innerHTML=`
    <div class="bulk-loading-content">
      <div class="bulk-loading-spinner"></div>
      <div class="bulk-loading-message">${i}</div>
      <div class="bulk-loading-progress" id="bulk-progress"></div>
    </div>
  `,r.querySelector(".bulk-loading-content"),e.classList.add("position-relative"),e.appendChild(r),r}function C(e){e?.remove()}function y(e,i){e.querySelectorAll("#bulk-delete-btn, #bulk-export-btn, #bulk-reprocess-btn").forEach(n=>{n.disabled=i})}async function M(e,i){const r=c.size;if(!confirm(`Delete ${r} files? This action can be undone from the Deleted tab.`))return;const n=D(e,`Deleting ${r} files...`);y(e,!0);try{const t=Array.from(c),o=(await S.post("/api/documents/bulk/delete",{ids:t})).data;o.errors&&o.errors.length>0?l.warning(`Deleted ${o.deleted} files, ${o.errors.length} failed`):l.success(`Deleted ${o.deleted} files`),c.clear(),d(e,i)}catch(t){console.error("[BulkDelete] Error:",t),l.error("Failed to delete files")}finally{C(n),y(e,!1)}}async function U(){const e=c.size;l.info(`Preparing export of ${e} files...`);try{const i=Array.from(c),r=await q("/api/documents/bulk/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:i,format:"original"})});if(!r.ok)throw new Error("Export failed");const n=await r.blob(),t=window.URL.createObjectURL(n),a=document.createElement("a");a.href=t,a.download=`documents-export-${new Date().toISOString().split("T")[0]}.zip`,document.body.appendChild(a),a.click(),document.body.removeChild(a),window.URL.revokeObjectURL(t),l.success(`Exported ${e} files`)}catch(i){console.error("[BulkExport] Error:",i),l.error("Failed to export files")}}async function P(e,i){const r=c.size;if(!confirm(`Reprocess ${r} files? This will use AI tokens.`))return;const n=D(e,`Queuing ${r} files for reprocessing...`);y(e,!0);try{const t=Array.from(c),o=(await S.post("/api/documents/bulk/reprocess",{ids:t})).data;o.failed&&o.failed.length>0?l.warning(`Queued ${o.queued?.length||0} files, ${o.failed.length} failed`):l.success(`Queued ${o.queued?.length||r} files for reprocessing`),c.clear(),h(e),setTimeout(()=>d(e,i),1e3)}catch(t){console.error("[BulkReprocess] Error:",t),l.error("Failed to queue files for reprocessing")}finally{C(n),y(e,!1)}}function R(e){switch(e.split(".").pop()?.toLowerCase()){case"pdf":return"📄";case"doc":case"docx":return"📝";case"xls":case"xlsx":return"📊";case"ppt":case"pptx":return"📽️";case"txt":case"md":return"📃";case"jpg":case"jpeg":case"png":case"gif":return"🖼️";default:return"📁"}}function k(e){const i=document.createElement("div");return i.textContent=e,i.innerHTML}export{I as createDocumentsPanel,I as default};
//# sourceMappingURL=DocumentsPage-0jCpkTn7.js.map
