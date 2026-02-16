import{c as f,o as v,t as r,H as l}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function S(t={}){const i={stats:null,communities:[],centrality:{topNodes:[]},bridges:[],insights:[],isLoading:!0},n=f("div",{className:"graph-analytics"});return n.innerHTML=`
    <div class="analytics-grid">
      <!-- Stats Cards Row -->
      <div class="stats-cards" id="stats-cards">
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-nodes">-</div>
            <div class="stat-label">Total Nodes</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-edges">-</div>
            <div class="stat-label">Total Edges</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-communities">-</div>
            <div class="stat-label">Communities</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-people">-</div>
            <div class="stat-label">People</div>
          </div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="analytics-main">
        <!-- Left Column -->
        <div class="analytics-column">
          <!-- Entity Types Distribution -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                Entity Distribution
              </h3>
            </div>
            <div class="card-content" id="entity-distribution">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>

          <!-- Communities -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                Communities
              </h3>
              <button class="card-action" id="btn-detect-communities">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 2v6h-6"/>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                </svg>
                Detect
              </button>
            </div>
            <div class="card-content" id="communities-list">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>
        </div>

        <!-- Center Column -->
        <div class="analytics-column">
          <!-- Key People -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Key People (by Centrality)
              </h3>
            </div>
            <div class="card-content" id="key-people">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>

          <!-- Bridge Nodes -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                Bridge Nodes
              </h3>
            </div>
            <div class="card-content" id="bridge-nodes">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="analytics-column">
          <!-- AI Insights -->
          <div class="analytics-card analytics-card-full">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                AI Insights
              </h3>
              <button class="card-action" id="btn-generate-insights">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Generate
              </button>
            </div>
            <div class="card-content" id="ai-insights">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,b(n,i,t),n}async function b(t,i,n){const e=t.querySelector("#btn-detect-communities");e&&v(e,"click",async()=>{r.info("Detecting communities...");const s=await l.getCommunities();i.communities=s,m(t,i),r.success(`Found ${s.length} communities`)});const a=t.querySelector("#btn-generate-insights");a&&v(a,"click",async()=>{r.info("Generating AI insights...");const s=await l.getInsights();i.insights=s,u(t,i),r.success(`Generated ${s.length} insights`)}),await w(t,i,n)}async function w(t,i,n){try{const[e,a,s,c,d]=await Promise.all([l.getStats(),l.getCommunities(),l.getCentrality(),l.getBridges(),l.getInsights()]);i.stats=e,i.communities=a,i.centrality=s,i.bridges=c,i.insights=d,i.isLoading=!1,C(t,i),$(t,i),m(t,i,n),x(t,i,n),k(t,i,n),u(t,i)}catch(e){console.error("[GraphAnalytics] Failed to load:",e),i.isLoading=!1}}function C(t,i){const n=i.stats;if(!n)return;const e=t.querySelector("#stat-nodes"),a=t.querySelector("#stat-edges"),s=t.querySelector("#stat-communities"),c=t.querySelector("#stat-people");if(e&&(e.textContent=h(n.nodeCount)),a&&(a.textContent=h(n.edgeCount)),s&&(s.textContent=h(i.communities.length)),c){const d=n.nodeTypes?.Person||n.nodeTypes?.person||0;c.textContent=h(d)}}function $(t,i){const n=t.querySelector("#entity-distribution");if(!n||!i.stats?.nodeTypes){n&&(n.innerHTML='<div class="empty-state-small">No data available</div>');return}const e=Object.entries(i.stats.nodeTypes).sort((c,d)=>d[1]-c[1]).slice(0,10),a=e.reduce((c,[,d])=>c+d,0),s=Math.max(...e.map(([,c])=>c));n.innerHTML=`
    <div class="distribution-chart">
      ${e.map(([c,d])=>{const p=a>0?(d/a*100).toFixed(1):0,y=s>0?d/s*100:0;return`
          <div class="distribution-row">
            <div class="distribution-label">
              <span class="type-dot" style="--type-color: ${g(c)}"></span>
              <span class="type-name">${o(c)}</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="--bar-width: ${y}%; --bar-color: ${g(c)}"></div>
            </div>
            <div class="distribution-value">${d} (${p}%)</div>
          </div>
        `}).join("")}
    </div>
  `}function m(t,i,n){const e=t.querySelector("#communities-list");if(!e)return;if(i.communities.length===0){e.innerHTML=`
      <div class="empty-state-small">
        <p>No communities detected</p>
        <p class="text-muted">Click "Detect" to find communities</p>
      </div>
    `;return}const a=["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];e.innerHTML=`
    <div class="communities-grid">
      ${i.communities.slice(0,6).map((s,c)=>`
        <div class="community-card" data-id="${s.id}">
          <div class="community-header">
            <div class="community-color" style="--community-color: ${a[c%a.length]}"></div>
            <span class="community-name">${s.hub?.name||`Community ${c+1}`}</span>
          </div>
          <div class="community-stats">
            <span class="community-size">${s.size} members</span>
          </div>
          ${s.members.slice(0,3).map(d=>`
            <div class="community-member">
              <span class="member-type" style="--member-type-color: ${g(d.type)}">${d.type}</span>
              <span class="member-name">${o(d.name)}</span>
            </div>
          `).join("")}
          ${s.members.length>3?`<div class="community-more">+${s.members.length-3} more</div>`:""}
        </div>
      `).join("")}
    </div>
    ${i.communities.length>6?`<div class="show-more">+${i.communities.length-6} more communities</div>`:""}
  `,e.querySelectorAll(".community-card").forEach(s=>{v(s,"click",()=>{const c=s.getAttribute("data-id");c&&r.info(`Filtering by community ${c}`)})})}function x(t,i,n){const e=t.querySelector("#key-people");if(!e)return;if(!i.centrality.topNodes||i.centrality.topNodes.length===0){e.innerHTML='<div class="empty-state-small">No centrality data available</div>';return}const a=Math.max(...i.centrality.topNodes.map(s=>s.connections));e.innerHTML=`
    <div class="key-people-list">
      ${i.centrality.topNodes.slice(0,10).map((s,c)=>`
        <div class="key-person" data-id="${s.id}">
          <div class="person-rank">${c+1}</div>
          <div class="person-avatar">
            ${s.avatarUrl?`<img src="${s.avatarUrl}" alt="" onerror="this.classList.add('gm-none')">`:`<div class="avatar-placeholder">${M(s.name)}</div>`}
          </div>
          <div class="person-info">
            <div class="person-name">${o(s.name)}</div>
            <div class="person-type">${s.type}</div>
          </div>
          <div class="person-metrics">
            <div class="connections-bar-container">
              <div class="connections-bar" style="--bar-width: ${s.connections/a*100}%"></div>
            </div>
            <span class="connections-count">${s.connections}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".key-person").forEach(s=>{v(s,"click",()=>{const c=s.getAttribute("data-id");c&&n.onNodeSelect?.(c)})})}function k(t,i,n){const e=t.querySelector("#bridge-nodes");if(e){if(i.bridges.length===0){e.innerHTML='<div class="empty-state-small">No bridge nodes detected</div>';return}e.innerHTML=`
    <div class="bridge-nodes-list">
      ${i.bridges.slice(0,8).map(a=>`
        <div class="bridge-node" data-id="${a.id}">
          <div class="bridge-info">
            <span class="bridge-name">${o(a.name)}</span>
            <span class="bridge-connections">Connects ${a.connects} groups</span>
          </div>
          ${a.org1&&a.org2?`
            <div class="bridge-path">
              <span class="org">${o(a.org1)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span class="org">${o(a.org2)}</span>
            </div>
          `:""}
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".bridge-node").forEach(a=>{v(a,"click",()=>{const s=a.getAttribute("data-id");s&&n.onNodeSelect?.(s)})})}}function u(t,i){const n=t.querySelector("#ai-insights");if(n){if(i.insights.length===0){n.innerHTML=`
      <div class="empty-state-small">
        <p>No insights available</p>
        <p class="text-muted">Click "Generate" to create AI insights</p>
      </div>
    `;return}n.innerHTML=`
    <div class="insights-list">
      ${i.insights.map(e=>`
        <div class="insight-card insight-${e.importance}">
          <div class="insight-header">
            <span class="insight-type">${e.type}</span>
            <span class="insight-importance">${e.importance}</span>
          </div>
          <h4 class="insight-title">${o(e.title)}</h4>
          <p class="insight-description">${o(e.description)}</p>
        </div>
      `).join("")}
    </div>
  `}}function g(t){return{Person:"#6366f1",Project:"#22c55e",Document:"#8b5cf6",Decision:"#06b6d4",Risk:"#ef4444",Question:"#f59e0b",Fact:"#84cc16",Meeting:"#ec4899",Task:"#3b82f6",Technology:"#f97316",Organization:"#a855f7",Client:"#14b8a6"}[t]||"#6b7280"}function M(t){return t.split(" ").map(i=>i.charAt(0)).join("").substring(0,2).toUpperCase()}function h(t){return t>=1e6?(t/1e6).toFixed(1)+"M":t>=1e3?(t/1e3).toFixed(1)+"K":String(t)}function o(t){const i=document.createElement("div");return i.textContent=t,i.innerHTML}export{S as createGraphAnalytics};
//# sourceMappingURL=GraphAnalytics-Bpc2r4Rr.js.map
