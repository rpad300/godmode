const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/GraphCanvas-BCiftEnC.js","assets/main-BbrmTy0y.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-Cf3xxxdT.css","assets/GraphVisualization-DvEhNTJ8.js","assets/OntologyViewer-CwCTILU8.js","assets/QueryBuilder-XDsZrrbI.js","assets/GraphAnalytics-BuzjF8O1.js","assets/AICopilot-DBAwspVB.js","assets/CommandPalette-CDd0Lqqy.js"])))=>i.map(i=>d[i]);
import{c as S,o as d,t as r,_ as u,g as p}from"./main-BbrmTy0y.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function F(e={}){const t={activeTab:"explorer",isLoading:!0,stats:null,selectedNode:null,isCopilotOpen:!1,isCommandPaletteOpen:!1,renderer:"falkordb",filters:{entityTypes:[],communityId:null,searchQuery:""}},a=S("div",{className:"graph-explorer"});return a.innerHTML=`
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
          <span id="renderer-label" style="font-size: 10px; margin-left: 4px;">FalkorDB</span>
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
  `,M(a,t,e),a}async function M(e,t,a){e.querySelectorAll(".graph-tab").forEach(c=>{d(c,"click",()=>{const l=c.getAttribute("data-tab");l&&x(e,t,l,a)})});const n=e.querySelectorAll(".bottom-tab");n.forEach(c=>{d(c,"click",()=>{n.forEach(l=>l.classList.remove("active")),c.classList.add("active")})});const i=e.querySelector("#btn-ai-copilot");i&&d(i,"click",()=>$(e,t));const s=e.querySelector("#btn-command-palette");s&&d(s,"click",()=>y(e,t));const h=e.querySelector("#btn-sync");h&&d(h,"click",()=>N(e));const v=e.querySelector("#btn-toggle-renderer");v&&d(v,"click",async()=>{t.renderer=t.renderer==="falkordb"?"visjs":"falkordb";const c=e.querySelector("#renderer-label");if(c&&(c.textContent=t.renderer==="falkordb"?"FalkorDB":"vis.js"),t.activeTab==="explorer"){const l=e.querySelector(".graph-tab-content");l&&(r.info(`Switching to ${t.renderer==="falkordb"?"FalkorDB Canvas":"vis.js"}...`),await C(l,t,a))}});const f=e.querySelector("#btn-fullscreen");f&&d(f,"click",()=>P(e));const b=e.querySelector("#graph-search");b&&d(b,"input",()=>{t.filters.searchQuery=b.value}),d(document,"keydown",c=>{const l=c;(l.metaKey||l.ctrlKey)&&l.key==="k"&&(l.preventDefault(),y(e,t))}),e.querySelectorAll(".quick-action-btn").forEach(c=>{d(c,"click",()=>{const l=c.getAttribute("data-action");l&&_(l)})}),await T(e,t,a)}async function T(e,t,a){try{const o=await p.getStats();t.stats=o,m(e,o);const n=await p.getOntologyEntities();L(e,n,t);const i=await p.getCommunities();B(e,i,t);const s=await p.getBookmarks();E(e,s),t.isLoading=!1,await x(e,t,"explorer",a)}catch(o){console.error("[GraphExplorer] Failed to load initial data:",o);const n=e.querySelector("#graph-content");n&&(n.innerHTML=`
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
      `)}}function m(e,t){const a=e.querySelector("#graph-stats-mini");if(a){const o=t.graphName?`<span class="stat-graph-name" title="${t.graphName}">${t.graphName.length>20?t.graphName.substring(0,20)+"...":t.graphName}</span><span class="stat-divider">•</span>`:"",n=t.connected===!1?'<span class="stat-disconnected" title="Not connected">⚠️</span>':"";a.innerHTML=`
      ${n}
      ${o}
      <span class="stat-item"><strong>${t.nodeCount}</strong> nodes</span>
      <span class="stat-divider">•</span>
      <span class="stat-item"><strong>${t.edgeCount}</strong> edges</span>
      ${t.communities?`<span class="stat-divider">•</span><span class="stat-item"><strong>${t.communities}</strong> communities</span>`:""}
    `}}function L(e,t,a){const o=e.querySelector("#entity-type-filters");if(o){if(t.length===0){o.innerHTML='<div class="empty-state-small">No entity types found</div>';return}o.innerHTML=t.map(n=>`
    <label class="entity-filter-item">
      <input type="checkbox" checked data-type="${n.name}">
      <span class="entity-filter-color" style="background: ${n.color||"#6366f1"}"></span>
      <span class="entity-filter-label">${n.label||n.name}</span>
    </label>
  `).join(""),o.querySelectorAll('input[type="checkbox"]').forEach(n=>{d(n,"change",()=>{const i=n.getAttribute("data-type");i&&(n.checked?a.filters.entityTypes=a.filters.entityTypes.filter(h=>h!==i):a.filters.entityTypes.push(i))})})}}function B(e,t,a){const o=e.querySelector("#community-filters");if(!o)return;if(t.length===0){o.innerHTML='<div class="empty-state-small">No communities detected</div>';return}const n=["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];o.innerHTML=`
    <label class="community-filter-item">
      <input type="radio" name="community" value="" checked>
      <span class="community-filter-label">All communities</span>
    </label>
    ${t.slice(0,8).map((i,s)=>`
      <label class="community-filter-item">
        <input type="radio" name="community" value="${i.id}">
        <span class="community-filter-color" style="background: ${n[s%n.length]}"></span>
        <span class="community-filter-label">${i.hub?.name||`Community ${i.id+1}`} (${i.size})</span>
      </label>
    `).join("")}
  `,o.querySelectorAll('input[type="radio"]').forEach(i=>{d(i,"change",()=>{const s=i.value;a.filters.communityId=s?parseInt(s):null})})}function E(e,t){const a=e.querySelector("#bookmarks-list");if(a){if(t.length===0){a.innerHTML='<div class="empty-state-small">No bookmarks yet</div>';return}a.innerHTML=t.map(o=>`
    <div class="bookmark-item" data-node-id="${o.node_id}">
      ${o.node_avatar_url?`<img class="bookmark-avatar" src="${o.node_avatar_url}" alt="">`:`<div class="bookmark-avatar-placeholder">${o.node_label.charAt(0)}</div>`}
      <div class="bookmark-info">
        <span class="bookmark-label">${o.node_label}</span>
        <span class="bookmark-type">${o.node_type}</span>
      </div>
    </div>
  `).join("")}}async function x(e,t,a,o){t.activeTab=a,e.querySelectorAll(".graph-tab").forEach(s=>{s.classList.toggle("active",s.getAttribute("data-tab")===a)});const i=e.querySelector("#graph-content");if(i){i.innerHTML=`
    <div class="graph-loading">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  `;try{switch(a){case"explorer":await C(i,t,o);break;case"ontology":await A(i);break;case"query":await q(i,o);break;case"analytics":await H(i);break}}catch(s){console.error(`[GraphExplorer] Failed to load ${a} tab:`,s),i.innerHTML=`
      <div class="graph-error">
        <p>Failed to load ${a}</p>
        <button class="btn btn-sm" onclick="this.closest('.graph-content').innerHTML = ''">Retry</button>
      </div>
    `}}}async function C(e,t,a){if(e.innerHTML="",t.renderer==="falkordb"){const{createGraphCanvas:o}=await u(async()=>{const{createGraphCanvas:i}=await import("./GraphCanvas-BCiftEnC.js");return{createGraphCanvas:i}},__vite__mapDeps([0,1,2,3])),n=o({height:e.clientHeight||600,onNodeClick:i=>{t.selectedNode=i,a.onNodeSelect?.(i),k(e.closest(".graph-explorer"),i)},onNodeRightClick:i=>{r.info(`${i.name||i.label||i.id}`)},onDataLoaded:i=>{t.stats={...t.stats,...i};const s=e.closest(".graph-explorer");s&&m(s,t.stats)}});e.appendChild(n)}else{const{createGraphVisualization:o}=await u(async()=>{const{createGraphVisualization:i}=await import("./GraphVisualization-DvEhNTJ8.js");return{createGraphVisualization:i}},__vite__mapDeps([4,1,2,3])),n=o({height:e.clientHeight||600,onNodeClick:i=>{t.selectedNode=i,a.onNodeSelect?.(i),k(e.closest(".graph-explorer"),i)},onNodeDoubleClick:i=>{r.info(`Expanding connections for ${i.label||i.name||i.id}`)}});e.appendChild(n)}}async function A(e){const{createOntologyViewer:t}=await u(async()=>{const{createOntologyViewer:o}=await import("./OntologyViewer-CwCTILU8.js");return{createOntologyViewer:o}},__vite__mapDeps([5,1,2,3]));e.innerHTML="";const a=t({});e.appendChild(a)}async function q(e,t){const{createQueryBuilder:a}=await u(async()=>{const{createQueryBuilder:n}=await import("./QueryBuilder-XDsZrrbI.js");return{createQueryBuilder:n}},__vite__mapDeps([6,1,2,3]));e.innerHTML="";const o=a({onExecute:(n,i)=>{t.onQueryExecute?.(n)}});e.appendChild(o)}async function H(e){const{createGraphAnalytics:t}=await u(async()=>{const{createGraphAnalytics:o}=await import("./GraphAnalytics-BuzjF8O1.js");return{createGraphAnalytics:o}},__vite__mapDeps([7,1,2,3]));e.innerHTML="";const a=t({});e.appendChild(a)}function k(e,t){const a=e.querySelector("#node-details-panel");if(!a)return;const o=t.avatarUrl||t.photoUrl||t.properties?.avatar_url||t.properties?.photo_url,n=t.role||t.properties?.role,i=t.organization||t.properties?.organization,s=t.email||t.properties?.email;a.innerHTML=`
    <div class="node-details">
      <div class="node-details-header">
        ${o?`<img class="node-avatar-large" src="${o}" alt="" onerror="this.style.display='none'">`:`<div class="node-avatar-large node-avatar-placeholder" style="background: ${w(t.type)}">${(t.label||t.name||"?").charAt(0).toUpperCase()}</div>`}
        <div class="node-header-info">
          <h3 class="node-name">${g(t.label||t.name||t.id)}</h3>
          <span class="node-type-badge" style="background: ${w(t.type)}">${t.type}</span>
        </div>
        <button class="btn-icon node-bookmark-btn" title="Bookmark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
      
      ${n||i?`
        <div class="node-role-info">
          ${n?`<span class="node-role">${g(String(n))}</span>`:""}
          ${i?`<span class="node-org">@ ${g(String(i))}</span>`:""}
        </div>
      `:""}
      
      ${s?`
        <div class="node-contact-info">
          <a href="mailto:${s}" class="node-email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${g(String(s))}
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
  `}function $(e,t){t.isCopilotOpen=!t.isCopilotOpen;const a=e.querySelector("#ai-copilot-container");a&&(t.isCopilotOpen?(a.classList.remove("hidden"),a.hasChildNodes()||u(async()=>{const{createAICopilot:o}=await import("./AICopilot-DBAwspVB.js");return{createAICopilot:o}},__vite__mapDeps([8,1,2,3])).then(({createAICopilot:o})=>{const n=o({onClose:()=>$(e,t),onHighlightNodes:i=>{console.log("Highlight nodes:",i)}});a.innerHTML="",a.appendChild(n)})):a.classList.add("hidden"))}function y(e,t){t.isCommandPaletteOpen=!t.isCommandPaletteOpen;const a=e.querySelector("#command-palette-overlay");a&&(t.isCommandPaletteOpen?(a.classList.remove("hidden"),a.hasChildNodes()||u(async()=>{const{createCommandPalette:o}=await import("./CommandPalette-CDd0Lqqy.js");return{createCommandPalette:o}},__vite__mapDeps([9,1,2,3])).then(({createCommandPalette:o})=>{const n=o({onClose:()=>y(e,t),onAction:i=>{_(i),y(e,t)}});a.innerHTML="",a.appendChild(n)}),setTimeout(()=>{const o=a.querySelector("input");o&&o.focus()},100)):a.classList.add("hidden"))}async function N(e){r.info("Syncing data to graph...");try{await fetch("/api/graph/sync",{method:"POST"}),r.success("Graph synced successfully");const t=await p.getStats();m(e,t)}catch{r.error("Failed to sync graph")}}function P(e){document.fullscreenElement?document.exitFullscreen():e.requestFullscreen()}async function _(e,t,a){switch(e){case"find-paths":r.info("Select two nodes to find paths between them");break;case"detect-communities":r.info("Detecting communities...");const o=await p.getCommunities();r.success(`Found ${o.length} communities`);break;case"key-people":r.info("Finding key people...");const n=await p.getCentrality();n.topNodes.length>0&&r.success(`Top person: ${n.topNodes[0].name} (${n.topNodes[0].connections} connections)`);break;case"export-graph":r.info("Exporting graph...");break;case"create-snapshot":r.info("Creating snapshot...");const i=await p.getVisualizationData(),s=await p.getStats();await p.createSnapshot({name:`Snapshot ${new Date().toLocaleDateString()}`,snapshot_type:"manual",snapshot_data:{nodes:i.nodes,edges:i.edges,stats:s,capturedAt:new Date().toISOString()},node_count:s.nodeCount,edge_count:s.edgeCount,is_baseline:!1}),r.success("Snapshot created");break;case"ai-insights":r.info("Generating AI insights...");const h=await p.getInsights();h.length>0?r.success(h[0].description):r.info("No insights available");break;default:console.log("Unknown action:",e)}}function w(e){return{Person:"#6366f1",Project:"#22c55e",Document:"#8b5cf6",Decision:"#06b6d4",Risk:"#ef4444",Question:"#f59e0b",Fact:"#84cc16",Meeting:"#ec4899",Task:"#3b82f6",Technology:"#f97316",Organization:"#a855f7",Client:"#14b8a6",Email:"#e879f9"}[e]||"#6b7280"}function g(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}export{F as createGraphExplorer};
//# sourceMappingURL=GraphExplorer-gFN6PwBh.js.map
