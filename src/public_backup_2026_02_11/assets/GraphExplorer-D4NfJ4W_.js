const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/GraphCanvas-DnG4DQXQ.js","assets/main-v_cFye9p.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-Cr-TCRi2.css","assets/GraphVisualization-BbXi6Az7.js","assets/OntologyViewer-DZa4q9dC.js","assets/QueryBuilder-CtnWG9e3.js","assets/GraphAnalytics-Bpc2r4Rr.js","assets/AICopilot-5NwhbbMk.js","assets/CommandPalette-5QwkFskq.js"])))=>i.map(i=>d[i]);
import{c as S,o as d,t as r,_ as u,m as M,H as p}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function V(e={}){const t={activeTab:"explorer",isLoading:!0,stats:null,selectedNode:null,isCopilotOpen:!1,isCommandPaletteOpen:!1,renderer:"falkordb",filters:{entityTypes:[],communityId:null,searchQuery:""}},a=S("div",{className:"graph-explorer"});return a.innerHTML=`
    <div class="graph-explorer-header">
      <div class="graph-header-left">
        <h1 class="graph-title">
          <svg class="graph-title-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="4" cy="6" r="2"/>
            <circle cx="20" cy="6" r="2"/>
            <circle cx="4" cy="18" r="2"/>
            <circle cx="20" cy="18" r="2"/>
            <line x1="6" y1="6" x2="9.5" y2="10"/>
            <line x1="18" y1="6" x2="14.5" y2="10"/>
            <line x1="6" y1="18" x2="9.5" y2="14"/>
            <line x1="18" y1="18" x2="14.5" y2="14"/>
          </svg>
          Knowledge Graph
        </h1>
        <div class="graph-stats-mini" id="graph-stats-mini">
          <span class="stat-loading">Loading...</span>
        </div>
      </div>
      <div class="graph-header-tabs">
        <button class="graph-tab active" data-tab="explorer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Explorer
        </button>
        <button class="graph-tab" data-tab="ontology">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Ontology
        </button>
        <button class="graph-tab" data-tab="query">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          Query
        </button>
        <button class="graph-tab" data-tab="analytics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Analytics
        </button>
      </div>
      <div class="graph-header-actions">
        <button class="graph-action-btn" id="btn-command-palette" title="Command Palette (Ctrl+K)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span class="shortcut-hint">⌘K</span>
        </button>
        <button class="graph-action-btn" id="btn-ai-copilot" title="AI Copilot">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 6v1"/>
            <path d="M12 17v1"/>
            <path d="M6 12h1"/>
            <path d="M17 12h1"/>
          </svg>
          AI Copilot
        </button>
        <button class="graph-action-btn" id="btn-sync" title="Sync to Graph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6"/>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
            <path d="M3 22v-6h6"/>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
        </button>
        <button class="graph-action-btn" id="btn-toggle-renderer" title="Switch Renderer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span id="renderer-label" class="graph-renderer-label">FalkorDB</span>
        </button>
        <button class="graph-action-btn" id="btn-fullscreen" title="Fullscreen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="graph-explorer-body">
      <!-- Left Panel: Filters -->
      <aside class="graph-sidebar graph-sidebar-left" id="graph-sidebar-left">
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
          </h3>
          <div class="filter-search">
            <input type="text" id="graph-search" class="filter-input" placeholder="Search nodes...">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Entity Types
          </h3>
          <div id="entity-type-filters" class="entity-filters">
            <div class="filter-loading">Loading types...</div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            Communities
          </h3>
          <div id="community-filters" class="community-filters">
            <div class="filter-loading">Detecting...</div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Bookmarks
          </h3>
          <div id="bookmarks-list" class="bookmarks-list">
            <div class="empty-state-small">No bookmarks yet</div>
          </div>
        </div>
      </aside>
      
      <!-- Center: Main Content Area -->
      <main class="graph-main">
        <div class="graph-content" id="graph-content">
          <!-- Tab content will be rendered here -->
          <div class="graph-loading">
            <div class="loading-spinner"></div>
            <p>Loading Knowledge Graph...</p>
          </div>
        </div>
        
        <!-- Bottom Bar: Query/Results -->
        <div class="graph-bottom-bar" id="graph-bottom-bar">
          <div class="bottom-bar-tabs">
            <button class="bottom-tab active" data-bottom-tab="quick-actions">Quick Actions</button>
            <button class="bottom-tab" data-bottom-tab="query-history">Query History</button>
            <button class="bottom-tab" data-bottom-tab="results">Results</button>
          </div>
          <div class="bottom-bar-content" id="bottom-bar-content">
            <div class="quick-actions-grid">
              <button class="quick-action-btn" data-action="find-paths">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Find Paths
              </button>
              <button class="quick-action-btn" data-action="detect-communities">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                Detect Communities
              </button>
              <button class="quick-action-btn" data-action="key-people">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Key People
              </button>
              <button class="quick-action-btn" data-action="export-graph">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
              <button class="quick-action-btn" data-action="create-snapshot">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Snapshot
              </button>
              <button class="quick-action-btn" data-action="ai-insights">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                AI Insights
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <!-- Right Panel: Node Details -->
      <aside class="graph-sidebar graph-sidebar-right" id="graph-sidebar-right">
        <div class="node-details-panel" id="node-details-panel">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p>Select a node to view details</p>
          </div>
        </div>
      </aside>
    </div>
    
    <!-- AI Copilot (floating) -->
    <div class="ai-copilot-container hidden" id="ai-copilot-container">
      <!-- Will be populated by AICopilot component -->
    </div>
    
    <!-- Command Palette (modal) -->
    <div class="command-palette-overlay hidden" id="command-palette-overlay">
      <!-- Will be populated by CommandPalette component -->
    </div>
  `,T(a,t,e),a}async function T(e,t,a){e.querySelectorAll(".graph-tab").forEach(c=>{d(c,"click",()=>{const l=c.getAttribute("data-tab");l&&x(e,t,l,a)})});const s=e.querySelectorAll(".bottom-tab");s.forEach(c=>{d(c,"click",()=>{s.forEach(l=>l.classList.remove("active")),c.classList.add("active")})});const i=e.querySelector("#btn-ai-copilot");i&&d(i,"click",()=>$(e,t));const n=e.querySelector("#btn-command-palette");n&&d(n,"click",()=>y(e,t));const h=e.querySelector("#btn-sync");h&&d(h,"click",()=>P(e));const v=e.querySelector("#btn-toggle-renderer");v&&d(v,"click",async()=>{t.renderer=t.renderer==="falkordb"?"visjs":"falkordb";const c=e.querySelector("#renderer-label");if(c&&(c.textContent=t.renderer==="falkordb"?"FalkorDB":"vis.js"),t.activeTab==="explorer"){const l=e.querySelector(".graph-tab-content");l&&(r.info(`Switching to ${t.renderer==="falkordb"?"FalkorDB Canvas":"vis.js"}...`),await C(l,t,a))}});const f=e.querySelector("#btn-fullscreen");f&&d(f,"click",()=>D(e));const b=e.querySelector("#graph-search");b&&d(b,"input",()=>{t.filters.searchQuery=b.value}),d(document,"keydown",c=>{const l=c;(l.metaKey||l.ctrlKey)&&l.key==="k"&&(l.preventDefault(),y(e,t))}),e.querySelectorAll(".quick-action-btn").forEach(c=>{d(c,"click",()=>{const l=c.getAttribute("data-action");l&&_(l)})}),await L(e,t,a)}async function L(e,t,a){try{const o=await p.getStats();t.stats=o,m(e,o);const s=await p.getOntologyEntities();B(e,s,t);const i=await p.getCommunities();E(e,i,t);const n=await p.getBookmarks();A(e,n),t.isLoading=!1,await x(e,t,"explorer",a)}catch(o){console.error("[GraphExplorer] Failed to load initial data:",o);const s=e.querySelector("#graph-content");s&&(s.innerHTML=`
        <div class="graph-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Failed to load graph</h3>
          <p>Please check your graph database connection in Settings.</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `)}}function m(e,t){const a=e.querySelector("#graph-stats-mini");if(a){const o=t.graphName?`<span class="stat-graph-name" title="${t.graphName}">${t.graphName.length>20?t.graphName.substring(0,20)+"...":t.graphName}</span><span class="stat-divider">•</span>`:"",s=t.connected===!1?'<span class="stat-disconnected" title="Not connected">⚠️</span>':"";a.innerHTML=`
      ${s}
      ${o}
      <span class="stat-item"><strong>${t.nodeCount}</strong> nodes</span>
      <span class="stat-divider">•</span>
      <span class="stat-item"><strong>${t.edgeCount}</strong> edges</span>
      ${t.communities?`<span class="stat-divider">•</span><span class="stat-item"><strong>${t.communities}</strong> communities</span>`:""}
    `}}function B(e,t,a){const o=e.querySelector("#entity-type-filters");if(o){if(t.length===0){o.innerHTML='<div class="empty-state-small">No entity types found</div>';return}o.innerHTML=t.map(s=>`
    <label class="entity-filter-item">
      <input type="checkbox" checked data-type="${s.name}">
      <span class="entity-filter-color" style="--entity-color: ${s.color||"#6366f1"}"></span>
      <span class="entity-filter-label">${s.label||s.name}</span>
    </label>
  `).join(""),o.querySelectorAll('input[type="checkbox"]').forEach(s=>{d(s,"change",()=>{const i=s.getAttribute("data-type");i&&(s.checked?a.filters.entityTypes=a.filters.entityTypes.filter(h=>h!==i):a.filters.entityTypes.push(i))})})}}function E(e,t,a){const o=e.querySelector("#community-filters");if(!o)return;if(t.length===0){o.innerHTML='<div class="empty-state-small">No communities detected</div>';return}const s=["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];o.innerHTML=`
    <label class="community-filter-item">
      <input type="radio" name="community" value="" checked>
      <span class="community-filter-label">All communities</span>
    </label>
    ${t.slice(0,8).map((i,n)=>`
      <label class="community-filter-item">
        <input type="radio" name="community" value="${i.id}">
        <span class="community-filter-color" style="--community-color: ${s[n%s.length]}"></span>
        <span class="community-filter-label">${i.hub?.name||`Community ${i.id+1}`} (${i.size})</span>
      </label>
    `).join("")}
  `,o.querySelectorAll('input[type="radio"]').forEach(i=>{d(i,"change",()=>{const n=i.value;a.filters.communityId=n?parseInt(n):null})})}function A(e,t){const a=e.querySelector("#bookmarks-list");if(a){if(t.length===0){a.innerHTML='<div class="empty-state-small">No bookmarks yet</div>';return}a.innerHTML=t.map(o=>`
    <div class="bookmark-item" data-node-id="${o.node_id}">
      ${o.node_avatar_url?`<img class="bookmark-avatar" src="${o.node_avatar_url}" alt="">`:`<div class="bookmark-avatar-placeholder">${o.node_label.charAt(0)}</div>`}
      <div class="bookmark-info">
        <span class="bookmark-label">${o.node_label}</span>
        <span class="bookmark-type">${o.node_type}</span>
      </div>
    </div>
  `).join("")}}async function x(e,t,a,o){t.activeTab=a,e.querySelectorAll(".graph-tab").forEach(n=>{n.classList.toggle("active",n.getAttribute("data-tab")===a)});const i=e.querySelector("#graph-content");if(i){i.innerHTML=`
    <div class="graph-loading">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  `;try{switch(a){case"explorer":await C(i,t,o);break;case"ontology":await q(i);break;case"query":await H(i,o);break;case"analytics":await N(i);break}}catch(n){console.error(`[GraphExplorer] Failed to load ${a} tab:`,n),i.innerHTML=`
      <div class="graph-error">
        <p>Failed to load ${a}</p>
        <button class="btn btn-sm" onclick="this.closest('.graph-content').innerHTML = ''">Retry</button>
      </div>
    `}}}async function C(e,t,a){if(e.innerHTML="",t.renderer==="falkordb"){const{createGraphCanvas:o}=await u(async()=>{const{createGraphCanvas:i}=await import("./GraphCanvas-DnG4DQXQ.js");return{createGraphCanvas:i}},__vite__mapDeps([0,1,2,3])),s=o({height:e.clientHeight||600,onNodeClick:i=>{t.selectedNode=i,a.onNodeSelect?.(i),k(e.closest(".graph-explorer"),i)},onNodeRightClick:i=>{r.info(`${i.name||i.label||i.id}`)},onDataLoaded:i=>{t.stats={...t.stats,...i};const n=e.closest(".graph-explorer");n&&m(n,t.stats)}});e.appendChild(s)}else{const{createGraphVisualization:o}=await u(async()=>{const{createGraphVisualization:i}=await import("./GraphVisualization-BbXi6Az7.js");return{createGraphVisualization:i}},__vite__mapDeps([4,1,2,3])),s=o({height:e.clientHeight||600,onNodeClick:i=>{t.selectedNode=i,a.onNodeSelect?.(i),k(e.closest(".graph-explorer"),i)},onNodeDoubleClick:i=>{r.info(`Expanding connections for ${i.label||i.name||i.id}`)}});e.appendChild(s)}}async function q(e){const{createOntologyViewer:t}=await u(async()=>{const{createOntologyViewer:o}=await import("./OntologyViewer-DZa4q9dC.js");return{createOntologyViewer:o}},__vite__mapDeps([5,1,2,3]));e.innerHTML="";const a=t({});e.appendChild(a)}async function H(e,t){const{createQueryBuilder:a}=await u(async()=>{const{createQueryBuilder:s}=await import("./QueryBuilder-CtnWG9e3.js");return{createQueryBuilder:s}},__vite__mapDeps([6,1,2,3]));e.innerHTML="";const o=a({onExecute:(s,i)=>{t.onQueryExecute?.(s)}});e.appendChild(o)}async function N(e){const{createGraphAnalytics:t}=await u(async()=>{const{createGraphAnalytics:o}=await import("./GraphAnalytics-Bpc2r4Rr.js");return{createGraphAnalytics:o}},__vite__mapDeps([7,1,2,3]));e.innerHTML="";const a=t({});e.appendChild(a)}function k(e,t){const a=e.querySelector("#node-details-panel");if(!a)return;const o=t.avatarUrl||t.photoUrl||t.properties?.avatar_url||t.properties?.photo_url,s=t.role||t.properties?.role,i=t.organization||t.properties?.organization,n=t.email||t.properties?.email;a.innerHTML=`
    <div class="node-details">
      <div class="node-details-header">
        ${o?`<img class="node-avatar-large" src="${o}" alt="" onerror="this.classList.add('gm-none')">`:`<div class="node-avatar-large node-avatar-placeholder" style="--type-color: ${w(t.type)}">${(t.label||t.name||"?").charAt(0).toUpperCase()}</div>`}
        <div class="node-header-info">
          <h3 class="node-name">${g(t.label||t.name||t.id)}</h3>
          <span class="node-type-badge" style="--type-color: ${w(t.type)}">${t.type}</span>
        </div>
        <button class="btn-icon node-bookmark-btn" title="Bookmark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
      
      ${s||i?`
        <div class="node-role-info">
          ${s?`<span class="node-role">${g(String(s))}</span>`:""}
          ${i?`<span class="node-org">@ ${g(String(i))}</span>`:""}
        </div>
      `:""}
      
      ${n?`
        <div class="node-contact-info">
          <a href="mailto:${n}" class="node-email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${g(String(n))}
          </a>
        </div>
      `:""}
      
      <div class="node-stats">
        <div class="node-stat">
          <span class="node-stat-value">${t.connections||0}</span>
          <span class="node-stat-label">Connections</span>
        </div>
        ${t.centrality?`
          <div class="node-stat">
            <span class="node-stat-value">${(t.centrality*100).toFixed(0)}%</span>
            <span class="node-stat-label">Centrality</span>
          </div>
        `:""}
        ${t.communityId!==void 0?`
          <div class="node-stat">
            <span class="node-stat-value">#${t.communityId+1}</span>
            <span class="node-stat-label">Community</span>
          </div>
        `:""}
      </div>
      
      <div class="node-actions">
        <button class="btn btn-sm btn-secondary" data-action="expand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Expand
        </button>
        <button class="btn btn-sm btn-secondary" data-action="find-paths">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Paths
        </button>
        <button class="btn btn-sm btn-secondary" data-action="ai-explain">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          AI Explain
        </button>
      </div>
      
      ${t.properties?`
        <div class="node-properties">
          <h4>Properties</h4>
          <div class="properties-list">
            ${Object.entries(t.properties).filter(([h])=>!["id","name","label","type","avatar_url","photo_url","avatarUrl","photoUrl"].includes(h)).slice(0,10).map(([h,v])=>`
                <div class="property-item">
                  <span class="property-key">${g(h)}:</span>
                  <span class="property-value">${g(String(v).substring(0,100))}</span>
                </div>
              `).join("")}
          </div>
        </div>
      `:""}
    </div>
  `}function $(e,t){t.isCopilotOpen=!t.isCopilotOpen;const a=e.querySelector("#ai-copilot-container");a&&(t.isCopilotOpen?(a.classList.remove("hidden"),a.hasChildNodes()||u(async()=>{const{createAICopilot:o}=await import("./AICopilot-5NwhbbMk.js");return{createAICopilot:o}},__vite__mapDeps([8,1,2,3])).then(({createAICopilot:o})=>{const s=o({onClose:()=>$(e,t),onHighlightNodes:i=>{console.log("Highlight nodes:",i)}});a.innerHTML="",a.appendChild(s)})):a.classList.add("hidden"))}function y(e,t){t.isCommandPaletteOpen=!t.isCommandPaletteOpen;const a=e.querySelector("#command-palette-overlay");a&&(t.isCommandPaletteOpen?(a.classList.remove("hidden"),a.hasChildNodes()||u(async()=>{const{createCommandPalette:o}=await import("./CommandPalette-5QwkFskq.js");return{createCommandPalette:o}},__vite__mapDeps([9,1,2,3])).then(({createCommandPalette:o})=>{const s=o({onClose:()=>y(e,t),onAction:i=>{_(i),y(e,t)}});a.innerHTML="",a.appendChild(s)}),setTimeout(()=>{const o=a.querySelector("input");o&&o.focus()},100)):a.classList.add("hidden"))}async function P(e){r.info("Syncing data to graph...");try{await M("/api/graph/sync",{method:"POST"}),r.success("Graph synced successfully");const t=await p.getStats();m(e,t)}catch{r.error("Failed to sync graph")}}function D(e){document.fullscreenElement?document.exitFullscreen():e.requestFullscreen()}async function _(e,t,a){switch(e){case"find-paths":r.info("Select two nodes to find paths between them");break;case"detect-communities":r.info("Detecting communities...");const o=await p.getCommunities();r.success(`Found ${o.length} communities`);break;case"key-people":r.info("Finding key people...");const s=await p.getCentrality();s.topNodes.length>0&&r.success(`Top person: ${s.topNodes[0].name} (${s.topNodes[0].connections} connections)`);break;case"export-graph":r.info("Exporting graph...");break;case"create-snapshot":r.info("Creating snapshot...");const i=await p.getVisualizationData(),n=await p.getStats();await p.createSnapshot({name:`Snapshot ${new Date().toLocaleDateString()}`,snapshot_type:"manual",snapshot_data:{nodes:i.nodes,edges:i.edges,stats:n,capturedAt:new Date().toISOString()},node_count:n.nodeCount,edge_count:n.edgeCount,is_baseline:!1}),r.success("Snapshot created");break;case"ai-insights":r.info("Generating AI insights...");const h=await p.getInsights();h.length>0?r.success(h[0].description):r.info("No insights available");break;default:console.log("Unknown action:",e)}}function w(e){return{Person:"#6366f1",Project:"#22c55e",Document:"#8b5cf6",Decision:"#06b6d4",Risk:"#ef4444",Question:"#f59e0b",Fact:"#84cc16",Meeting:"#ec4899",Task:"#3b82f6",Technology:"#f97316",Organization:"#a855f7",Client:"#14b8a6",Email:"#e879f9"}[e]||"#6b7280"}function g(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}export{V as createGraphExplorer};
//# sourceMappingURL=GraphExplorer-D4NfJ4W_.js.map
