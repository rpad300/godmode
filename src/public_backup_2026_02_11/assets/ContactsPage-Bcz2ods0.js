import{c as k,o as d,g as b,t as f,i as w,h as q}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let y="",h={},j=[],v=new Set;function V(e={}){const o=k("div",{className:"contacts-panel-sota"});return o.innerHTML=`
    <style>
      .contacts-panel-sota {
        padding: 24px;
        min-height: 100%;
      }

      /* Header */
      .contacts-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .contacts-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .contacts-title-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
      }

      .contacts-title-icon svg {
        width: 26px;
        height: 26px;
        color: white;
      }

      .contacts-title h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .contacts-count {
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
      }

      .contacts-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      /* Search Bar */
      .contacts-search-wrapper {
        position: relative;
        flex: 1;
        max-width: 400px;
        min-width: 200px;
      }

      .contacts-search-wrapper svg {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        color: var(--text-tertiary);
        pointer-events: none;
        transition: color 0.2s;
      }

      .contacts-search {
        width: 100%;
        padding: 12px 14px 12px 44px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.2s;
      }

      .contacts-search:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }

      .contacts-search:focus + svg {
        color: #e11d48;
      }

      /* SOTA Buttons */
      .btn-sota {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }

      .btn-sota.primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
      }

      .btn-sota.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(225, 29, 72, 0.4);
      }

      .btn-sota.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }

      .btn-sota.secondary:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
      }

      .btn-sota svg {
        width: 16px;
        height: 16px;
      }

      /* Filters */
      .contacts-filters {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }

      .filter-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-chip:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
        color: #e11d48;
      }

      .filter-chip.active {
        background: linear-gradient(135deg, rgba(225,29,72,0.1) 0%, rgba(225,29,72,0.05) 100%);
        border-color: #e11d48;
        color: #e11d48;
      }

      .filter-chip svg {
        width: 14px;
        height: 14px;
      }

      .filter-select {
        padding: 8px 32px 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 20px;
        font-size: 13px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
      }

      .filter-select:focus {
        outline: none;
        border-color: #e11d48;
      }

      /* Alerts */
      .contacts-alerts {
        margin-bottom: 20px;
      }

      .alert-sota {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.05) 100%);
        border: 1px solid rgba(245,158,11,0.3);
        border-radius: 12px;
        color: #d97706;
      }

      .alert-sota svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .alert-sota span {
        flex: 1;
        font-size: 14px;
      }

      .alert-sota .btn-sota {
        padding: 6px 12px;
        font-size: 12px;
      }

      /* Favorites Section */
      .favorites-section {
        margin-bottom: 28px;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
        color: var(--text-secondary);
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .section-header svg {
        width: 16px;
        height: 16px;
        color: #f59e0b;
      }

      .favorites-grid {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 8px;
      }

      .favorite-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%);
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .favorite-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(245,158,11,0.15);
        border-color: #f59e0b;
      }

      .favorite-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
      }

      .favorite-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .favorite-info h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .favorite-info p {
        margin: 2px 0 0 0;
        font-size: 12px;
        color: var(--text-secondary);
      }

      /* Contacts Grid */
      .contacts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }

      .contact-card-sota {
        background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 100%);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.25s ease;
        position: relative;
        overflow: hidden;
      }

      [data-theme="dark"] .contact-card-sota {
        background: linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(30,41,59,0.5) 100%);
      }

      .contact-card-sota:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        border-color: rgba(225,29,72,0.3);
      }

      .contact-card-sota::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #e11d48, #f59e0b);
        opacity: 0;
        transition: opacity 0.2s;
      }

      .contact-card-sota:hover::before {
        opacity: 1;
      }

      .contact-card-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 14px;
      }

      .contact-avatar-sota {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(225,29,72,0.25);
      }

      .contact-avatar-sota img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .contact-main-info {
        flex: 1;
        min-width: 0;
      }

      .contact-name-sota {
        margin: 0 0 4px 0;
        font-size: 17px;
        font-weight: 700;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .contact-role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: linear-gradient(135deg, rgba(225,29,72,0.1) 0%, rgba(225,29,72,0.05) 100%);
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #e11d48;
        margin-bottom: 4px;
      }

      .contact-org-sota {
        font-size: 13px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .contact-org-sota svg {
        width: 14px;
        height: 14px;
        opacity: 0.6;
      }

      .contact-details-sota {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 12px;
        border-top: 1px solid var(--border-color);
      }

      .contact-detail-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-secondary);
      }

      .contact-detail-item svg {
        width: 14px;
        height: 14px;
        color: #e11d48;
        flex-shrink: 0;
      }

      .contact-detail-item span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .contact-tags-sota {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
      }

      .contact-tag {
        padding: 3px 8px;
        background: var(--bg-tertiary);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
      }

      .contact-quick-actions {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .contact-card-sota:hover .contact-quick-actions {
        opacity: 1;
      }

      .quick-action-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .quick-action-btn:hover {
        background: #e11d48;
        border-color: #e11d48;
        color: white;
      }

      .quick-action-btn.favorite {
        color: #f59e0b;
      }

      .quick-action-btn.favorite.active {
        background: #f59e0b;
        border-color: #f59e0b;
        color: white;
      }

      .quick-action-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Selection Checkbox */
      .contact-select-checkbox {
        position: absolute;
        top: 12px;
        left: 12px;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid var(--border-color);
        background: var(--bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        z-index: 5;
        opacity: 0;
      }

      .contact-card-sota:hover .contact-select-checkbox,
      .contact-card-sota.selected .contact-select-checkbox {
        opacity: 1;
      }

      .contact-select-checkbox:hover {
        border-color: #e11d48;
      }

      .contact-select-checkbox.checked {
        background: linear-gradient(135deg, #e11d48, #be123c);
        border-color: #e11d48;
      }

      .contact-select-checkbox svg {
        width: 14px;
        height: 14px;
        color: white;
        display: none;
      }

      .contact-select-checkbox.checked svg {
        display: block;
      }

      .contact-card-sota.selected {
        border-color: #e11d48;
        box-shadow: 0 0 0 2px rgba(225,29,72,0.2);
      }

      /* Selection Bar */
      .selection-bar {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1e293b, #0f172a);
        padding: 12px 24px;
        border-radius: 50px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }

      .selection-bar-count {
        color: white;
        font-size: 14px;
        font-weight: 600;
      }

      .selection-bar-count span {
        color: #f59e0b;
      }

      .selection-bar-btn {
        padding: 10px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
        border: none;
      }

      .selection-bar-btn.merge {
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
      }

      .selection-bar-btn.merge:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(225,29,72,0.4);
      }

      .selection-bar-btn.cancel {
        background: rgba(255,255,255,0.1);
        color: white;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .selection-bar-btn.cancel:hover {
        background: rgba(255,255,255,0.2);
      }

      .selection-bar-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Empty State */
      .contacts-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        text-align: center;
      }

      .contacts-empty-state svg {
        width: 80px;
        height: 80px;
        color: #e11d48;
        opacity: 0.4;
        margin-bottom: 24px;
      }

      .contacts-empty-state h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .contacts-empty-state p {
        margin: 0 0 24px 0;
        font-size: 14px;
        color: var(--text-secondary);
      }

      /* Loading */
      .contacts-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        color: var(--text-secondary);
      }

      .contacts-loading::after {
        content: '';
        width: 24px;
        height: 24px;
        border: 3px solid var(--border-color);
        border-top-color: #e11d48;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-left: 12px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Projects indicator */
      .contact-projects-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        font-size: 12px;
        color: var(--text-tertiary);
      }

      .contact-projects-indicator svg {
        width: 14px;
        height: 14px;
      }

      .project-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e11d48;
      }
    </style>

    <!-- Header -->
    <div class="contacts-header">
      <div class="contacts-title">
        <div class="contacts-title-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <h1>Contacts</h1>
        <span class="contacts-count" id="contacts-count">0</span>
      </div>

      <div class="contacts-actions">
        <div class="contacts-search-wrapper">
          <input type="search" class="contacts-search" id="contacts-search" placeholder="Search contacts...">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <button class="btn-sota secondary" id="import-contacts-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Import
        </button>
        <button class="btn-sota secondary" id="export-contacts-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export
        </button>
        <button class="btn-sota primary" id="add-contact-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Contact
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="contacts-filters">
      <div class="filter-chip" id="filter-favorites" data-filter="favorites">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>
        Favorites
      </div>
      <select class="filter-select" id="org-filter">
        <option value="">All Organizations</option>
      </select>
      <select class="filter-select" id="tag-filter">
        <option value="">All Tags</option>
      </select>
    </div>

    <!-- Alerts -->
    <div class="contacts-alerts" id="contacts-alerts"></div>

    <!-- Favorites Section -->
    <div class="favorites-section hidden" id="favorites-section">
      <div class="section-header">
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>
        Favorites
      </div>
      <div class="favorites-grid" id="favorites-grid"></div>
    </div>

    <!-- Main Content -->
    <div id="contacts-content">
      <div class="contacts-loading">Loading contacts</div>
    </div>
  `,B(o,e),u(o,e),U(o),o}function B(e,o){const t=e.querySelector("#contacts-search");let s;d(t,"input",()=>{clearTimeout(s),s=window.setTimeout(()=>{y=t.value,u(e,o)},300)});const n=e.querySelector("#org-filter");d(n,"change",()=>{h.organization=n.value||void 0,u(e,o)});const r=e.querySelector("#tag-filter");d(r,"change",()=>{h.tag=r.value||void 0,u(e,o)});const i=e.querySelector("#filter-favorites");i&&d(i,"click",()=>{i.classList.toggle("active"),h.favorites=i.classList.contains("active"),u(e,o)});const a=e.querySelector("#add-contact-btn");a&&d(a,"click",()=>{b({mode:"create",onSave:()=>u(e,o)})});const c=e.querySelector("#export-contacts-btn");c&&d(c,"click",()=>P());const l=e.querySelector("#import-contacts-btn");l&&d(l,"click",()=>{f.info("Import functionality coming soon")})}async function u(e,o){const t=e.querySelector("#contacts-content");t.innerHTML='<div class="contacts-loading">Loading contacts</div>';try{const{contacts:s,total:n}=await w.getAll({search:y||void 0,organization:h.organization,tag:h.tag});let r=s;h.favorites&&(r=s.filter(i=>i.isFavorite)),j=s,L(t,r,o),S(e,s.filter(i=>i.isFavorite),o),N(e,n),I(e,s)}catch{t.innerHTML=`
      <div class="contacts-empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <h3>Failed to load contacts</h3>
        <p>Please try again later</p>
      </div>
    `}}function L(e,o,t){if(o.length===0){e.innerHTML=`
      <div class="contacts-empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <h3>${y?"No contacts match your search":"No contacts yet"}</h3>
        <p>${y?"Try a different search term":"Add your first contact to get started"}</p>
        <button class="btn-sota primary" id="empty-add-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Contact
        </button>
      </div>
    `;const s=e.querySelector("#empty-add-btn");s&&d(s,"click",()=>{b({mode:"create"})});return}e.innerHTML=`
    <div class="contacts-grid">
      ${o.map(s=>H(s)).join("")}
    </div>
  `,A(e,o,t)}function H(e){const o=M(e.name),t=!!(e.photoUrl||e.avatarUrl),s=e.photoUrl||e.avatarUrl,n=v.has(e.id);return`
    <div class="contact-card-sota ${n?"selected":""}" data-id="${e.id}">
      <div class="contact-select-checkbox ${n?"checked":""}" data-action="select" data-id="${e.id}">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div class="contact-quick-actions">
        <button class="quick-action-btn favorite ${e.isFavorite?"active":""}" data-action="favorite" data-id="${e.id}" title="Toggle favorite">
          <svg fill="${e.isFavorite?"currentColor":"none"}" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>
        <button class="quick-action-btn" data-action="edit" data-id="${e.id}" title="Edit contact">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>

      <div class="contact-card-header">
        <div class="contact-avatar-sota">
          ${t?`<img src="${s}" alt="${p(e.name)}">`:o}
        </div>
        <div class="contact-main-info">
          <h3 class="contact-name-sota">${p(e.name)}</h3>
          ${e.role?`<span class="contact-role-badge">${p(e.role)}</span>`:""}
          ${e.organization?`
            <div class="contact-org-sota">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              ${p(e.organization)}
            </div>
          `:""}
        </div>
      </div>

      <div class="contact-details-sota">
        ${e.email?`
          <div class="contact-detail-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span>${p(e.email)}</span>
          </div>
        `:""}
        ${e.phone?`
          <div class="contact-detail-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            <span>${p(e.phone)}</span>
          </div>
        `:""}
      </div>

      ${e.tags&&e.tags.length>0?`
        <div class="contact-tags-sota">
          ${e.tags.slice(0,4).map(r=>`<span class="contact-tag">${p(r)}</span>`).join("")}
          ${e.tags.length>4?`<span class="contact-tag">+${e.tags.length-4}</span>`:""}
        </div>
      `:""}
    </div>
  `}function A(e,o,t){const s=e.closest(".contacts-panel-sota");e.querySelectorAll(".contact-select-checkbox").forEach(n=>{d(n,"click",r=>{r.stopPropagation();const i=n.getAttribute("data-id");if(!i)return;const a=n.closest(".contact-card-sota");v.has(i)?(v.delete(i),n.classList.remove("checked"),a.classList.remove("selected")):(v.add(i),n.classList.add("checked"),a.classList.add("selected")),t&&T(s,o,t)})}),e.querySelectorAll(".contact-card-sota").forEach(n=>{d(n,"click",r=>{if(r.target.closest(".quick-action-btn")||r.target.closest(".contact-select-checkbox"))return;const i=n.getAttribute("data-id"),a=o.find(c=>String(c.id)===i);a&&(t?.onContactClick?t.onContactClick(a):b({mode:"edit",contact:a,onSave:()=>u(s,t)}))})}),e.querySelectorAll(".quick-action-btn").forEach(n=>{d(n,"click",async r=>{r.stopPropagation();const i=n.getAttribute("data-action"),a=n.getAttribute("data-id"),c=o.find(l=>String(l.id)===a);c&&(i==="favorite"?t&&await E(c,n,s,t):i==="edit"&&b({mode:"edit",contact:c,onSave:()=>u(s,t)}))})})}function T(e,o,t){const s=document.querySelector(".selection-bar");if(s&&s.remove(),v.size<2)return;const n=k("div",{className:"selection-bar"});n.innerHTML=`
    <span class="selection-bar-count"><span>${v.size}</span> contacts selected</span>
    <button class="selection-bar-btn merge" id="merge-selected-btn">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
      </svg>
      Merge Selected
    </button>
    <button class="selection-bar-btn cancel" id="cancel-selection-btn">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      Cancel
    </button>
  `,document.body.appendChild(n);const r=n.querySelector("#merge-selected-btn"),i=n.querySelector("#cancel-selection-btn");d(i,"click",()=>{$(e)}),d(r,"click",async()=>{const a=Array.from(v),c=o.filter(g=>v.has(g.id));if(await F(c)){r.disabled=!0,r.textContent="Merging...";try{await w.mergeContacts(a),f.success(`Merged ${a.length} contacts successfully`),$(e),await u(e,t)}catch(g){const m=g instanceof Error?g.message:"Failed to merge contacts";f.error(m),r.disabled=!1,r.innerHTML=`
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>
        Merge Selected
      `}}})}function F(e){return new Promise(o=>{const t=k("div",{className:"merge-confirm-overlay"});e[0],e.slice(1),t.innerHTML=`
      <style>
        .merge-confirm-overlay {
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
          z-index: 10000;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .merge-confirm-modal {
          background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          max-width: 480px;
          width: 90%;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .merge-confirm-header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .merge-confirm-header svg {
          width: 24px;
          height: 24px;
        }
        
        .merge-confirm-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .merge-confirm-body {
          padding: 24px;
        }
        
        .merge-confirm-body p {
          margin: 0 0 16px 0;
          color: #64748b;
          font-size: 14px;
        }
        
        .merge-contact-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .merge-contact-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        
        .merge-contact-item.primary {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #f59e0b;
        }
        
        .merge-contact-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 14px;
          flex-shrink: 0;
        }
        
        .merge-contact-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .merge-contact-info {
          flex: 1;
          min-width: 0;
        }
        
        .merge-contact-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
          margin-bottom: 2px;
        }
        
        .merge-contact-details {
          font-size: 12px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .merge-contact-badge {
          background: #f59e0b;
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        
        .merge-warning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: #fef3c7;
          border-radius: 10px;
          margin-top: 16px;
        }
        
        .merge-warning svg {
          width: 18px;
          height: 18px;
          color: #d97706;
          flex-shrink: 0;
          margin-top: 1px;
        }
        
        .merge-warning p {
          margin: 0;
          color: #92400e;
          font-size: 13px;
          line-height: 1.5;
        }
        
        .merge-confirm-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px;
          justify-content: flex-end;
        }
        
        .merge-confirm-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .merge-confirm-btn.cancel {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #64748b;
        }
        
        .merge-confirm-btn.cancel:hover {
          background: #e2e8f0;
        }
        
        .merge-confirm-btn.confirm {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: none;
          color: white;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
        }
        
        .merge-confirm-btn.confirm:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
        }
        
        .merge-confirm-btn svg {
          width: 16px;
          height: 16px;
        }
      </style>
      
      <div class="merge-confirm-modal">
        <div class="merge-confirm-header">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
          </svg>
          <h3>Merge Contacts</h3>
        </div>
        
        <div class="merge-confirm-body">
          <p>The following contacts will be merged into one:</p>
          
          <div class="merge-contact-list">
            ${e.map((a,c)=>{const l=a.photoUrl||a.avatarUrl||a.photo_url||a.avatar_url,g=(a.name||"?").split(" ").map(x=>x[0]).join("").substring(0,2).toUpperCase(),m=a.email||a.organization||a.company||"";return`
                <div class="merge-contact-item ${c===0?"primary":""}">
                  <div class="merge-contact-avatar">
                    ${l?`<img src="${l}" alt="${a.name}">`:g}
                  </div>
                  <div class="merge-contact-info">
                    <div class="merge-contact-name">${a.name||"Unknown"}</div>
                    <div class="merge-contact-details">${m}</div>
                  </div>
                  ${c===0?'<span class="merge-contact-badge">Primary</span>':""}
                </div>
              `}).join("")}
          </div>
          
          <div class="merge-warning">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>All information will be combined into the primary contact. Other contacts will be archived. This action cannot be undone.</p>
          </div>
        </div>
        
        <div class="merge-confirm-footer">
          <button class="merge-confirm-btn cancel" id="merge-cancel-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Cancel
          </button>
          <button class="merge-confirm-btn confirm" id="merge-confirm-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Merge Contacts
          </button>
        </div>
      </div>
    `,document.body.appendChild(t);const s=t.querySelector("#merge-cancel-btn"),n=t.querySelector("#merge-confirm-btn"),r=a=>{t.remove(),o(a)};d(s,"click",()=>r(!1)),d(n,"click",()=>r(!0)),d(t,"click",a=>{a.target===t&&r(!1)});const i=a=>{a.key==="Escape"&&(document.removeEventListener("keydown",i),r(!1))};document.addEventListener("keydown",i)})}function $(e){v.clear(),e.querySelectorAll(".contact-card-sota.selected").forEach(t=>{t.classList.remove("selected")}),e.querySelectorAll(".contact-select-checkbox.checked").forEach(t=>{t.classList.remove("checked")});const o=document.querySelector(".selection-bar");o&&o.remove()}async function E(e,o,t,s){const n=!e.isFavorite;try{await q.put(`/api/contacts/${e.id}`,{is_favorite:n}),e.isFavorite=n,o.classList.toggle("active",n);const r=o.querySelector("svg");r&&r.setAttribute("fill",n?"currentColor":"none"),S(t,j.filter(i=>i.isFavorite||i.id===e.id&&n),s),f.success(n?"Added to favorites":"Removed from favorites")}catch{f.error("Failed to update favorite")}}function S(e,o,t){const s=e.querySelector("#favorites-section"),n=e.querySelector("#favorites-grid");if(o.length===0){s.classList.add("hidden");return}s.classList.remove("hidden"),n.innerHTML=o.map(r=>{const i=M(r.name),a=!!(r.photoUrl||r.avatarUrl),c=r.photoUrl||r.avatarUrl;return`
      <div class="favorite-card" data-id="${r.id}">
        <div class="favorite-avatar">
          ${a?`<img src="${c}" alt="${p(r.name)}">`:i}
        </div>
        <div class="favorite-info">
          <h4>${p(r.name)}</h4>
          ${r.organization?`<p>${p(r.organization)}</p>`:""}
        </div>
      </div>
    `}).join(""),n.querySelectorAll(".favorite-card").forEach(r=>{d(r,"click",()=>{const i=r.getAttribute("data-id"),a=o.find(c=>String(c.id)===i);a&&b({mode:"edit",contact:a,onSave:()=>u(e,t)})})})}async function U(e){const o=e.querySelector("#contacts-alerts");try{const{duplicates:t}=await w.getDuplicates();if(t.length>0){o.innerHTML=`
        <div class="alert-sota">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span><strong>${t.length}</strong> potential duplicate contacts found</span>
          <button class="btn-sota secondary" id="review-duplicates-btn">Review Duplicates</button>
        </div>
      `;const s=o.querySelector("#review-duplicates-btn");s&&d(s,"click",()=>{Y(t,e)})}}catch{}}function Y(e,o){const t=k("div",{className:"duplicates-review-overlay"});t.innerHTML=`
    <style>
      .duplicates-review-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .duplicates-modal {
        background: var(--bg-primary);
        border-radius: 16px;
        width: 700px;
        max-width: 95vw;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.2s ease;
      }
      
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .duplicates-header {
        padding: 24px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .duplicates-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .duplicates-header h2 svg {
        width: 24px;
        height: 24px;
        color: #f59e0b;
      }
      
      .duplicates-header .close-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .duplicates-header .close-btn:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
      }
      
      .duplicates-header .close-btn svg {
        width: 18px;
        height: 18px;
        color: var(--text-secondary);
      }
      
      .duplicates-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      
      .duplicate-group {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      
      .duplicate-group:last-child {
        margin-bottom: 0;
      }
      
      .duplicate-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
      }
      
      .duplicate-group-header h4 {
        margin: 0;
        font-size: 14px;
        color: var(--text-secondary);
      }
      
      .merge-group-btn {
        padding: 8px 16px;
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      
      .merge-group-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }
      
      .merge-group-btn svg {
        width: 16px;
        height: 16px;
      }
      
      .duplicate-contacts {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .duplicate-contact-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--bg-primary);
        border-radius: 8px;
        border: 1px solid var(--border-color);
      }
      
      .duplicate-contact-row input[type="radio"] {
        width: 18px;
        height: 18px;
        accent-color: #e11d48;
      }
      
      .duplicate-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48, #be123c);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
      }
      
      .duplicate-info {
        flex: 1;
        min-width: 0;
      }
      
      .duplicate-info h5 {
        margin: 0 0 2px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .duplicate-info p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      .duplicate-aliases {
        margin-top: 4px;
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      
      .alias-tag {
        padding: 2px 6px;
        background: rgba(99,102,241,0.1);
        color: #6366f1;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
      }
      
      .duplicates-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .duplicates-footer button {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .duplicates-footer .close-review-btn {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
      }
      
      .duplicates-footer .close-review-btn:hover {
        background: var(--bg-tertiary);
      }
      
      .no-duplicates-msg {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
      }
      
      .no-duplicates-msg svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
        margin-bottom: 12px;
      }
    </style>
    
    <div class="duplicates-modal">
      <div class="duplicates-header">
        <h2>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Review Duplicate Contacts
        </h2>
        <button class="close-btn" id="close-duplicates-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="duplicates-content" id="duplicates-content">
        ${e.length===0?`
          <div class="no-duplicates-msg">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>No duplicate contacts found</p>
          </div>
        `:e.map((i,a)=>`
          <div class="duplicate-group" data-group-index="${a}">
            <div class="duplicate-group-header">
              <h4>Potential duplicates (${i.length} contacts)</h4>
              <button class="merge-group-btn" data-group-index="${a}">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
                Merge All
              </button>
            </div>
            <div class="duplicate-contacts">
              ${i.map((c,l)=>`
                <div class="duplicate-contact-row">
                  <input type="radio" name="primary-${a}" value="${c.id}" ${l===0?"checked":""}>
                  <div class="duplicate-avatar">${M(c.name)}</div>
                  <div class="duplicate-info">
                    <h5>${p(c.name)}${l===0?" (Primary)":""}</h5>
                    <p>${p(c.email||"")}${c.organization?` • ${p(c.organization)}`:""}</p>
                    ${c.aliases&&c.aliases.length>0?`
                      <div class="duplicate-aliases">
                        ${c.aliases.map(g=>`<span class="alias-tag">${p(g)}</span>`).join("")}
                      </div>
                    `:""}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
      
      <div class="duplicates-footer">
        <button class="close-review-btn" id="close-review-btn">Close</button>
      </div>
    </div>
  `,document.body.appendChild(t);const s=()=>t.remove(),n=t.querySelector("#close-duplicates-btn"),r=t.querySelector("#close-review-btn");n&&d(n,"click",s),r&&d(r,"click",s),d(t,"click",i=>{i.target===t&&s()}),t.querySelectorAll(".merge-group-btn").forEach(i=>{d(i,"click",async()=>{const a=parseInt(i.getAttribute("data-group-index")||"0"),c=e[a];if(!c||c.length<2)return;const g=t.querySelector(`input[name="primary-${a}"]:checked`)?.value||c[0].id,m=[g,...c.filter(x=>x.id!==g).map(x=>x.id)];i.disabled=!0,i.textContent="Merging...";try{await w.mergeContacts(m),f.success(`Merged ${c.length} contacts successfully`);const x=t.querySelector(`.duplicate-group[data-group-index="${a}"]`);if(x&&x.remove(),t.querySelectorAll(".duplicate-group").length===0){const z=t.querySelector("#duplicates-content");z&&(z.innerHTML=`
              <div class="no-duplicates-msg">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p>All duplicates have been merged!</p>
              </div>
            `)}await u(o)}catch(x){const C=x instanceof Error?x.message:"Failed to merge contacts";f.error(C),i.disabled=!1,i.innerHTML=`
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
          </svg>
          Merge All
        `}})})}function I(e,o){const t=e.querySelector("#org-filter"),s=[...new Set(o.map(l=>l.organization).filter(Boolean))].sort(),n=t.value;t.innerHTML=`
    <option value="">All Organizations</option>
    ${s.map(l=>`<option value="${p(l)}" ${n===l?"selected":""}>${p(l)}</option>`).join("")}
  `;const r=e.querySelector("#tag-filter"),i=o.flatMap(l=>l.tags||[]),a=[...new Set(i)].sort(),c=r.value;r.innerHTML=`
    <option value="">All Tags</option>
    ${a.map(l=>`<option value="${p(l)}" ${c===l?"selected":""}>${p(l)}</option>`).join("")}
  `}async function P(){try{await w.export("json"),f.success("Contacts exported")}catch{f.error("Failed to export contacts")}}function N(e,o){const t=e.querySelector("#contacts-count");t&&(t.textContent=String(o))}function M(e){return e.split(" ").map(o=>o[0]).join("").toUpperCase().slice(0,2)}function p(e){const o=document.createElement("div");return o.textContent=e,o.innerHTML}export{V as createContactsPanel};
//# sourceMappingURL=ContactsPage-Bcz2ods0.js.map
