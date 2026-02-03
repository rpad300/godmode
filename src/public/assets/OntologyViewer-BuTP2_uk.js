import{c as j,o as h,t as c,g}from"./index-B7lpKXA5.js";function Q(e={}){const s={schema:null,suggestions:[],typeStats:null,syncStatus:null,changes:[],workerStatus:null,workerStats:null,jobs:[],jobLog:[],compliance:null,falkorBrowserInfo:null,unusedTypes:null,activeTab:"entities",searchQuery:"",isLoading:!0,isAnalyzing:!1,isSyncing:!1},i=j("div",{className:"ontology-viewer"});return i.innerHTML=`
    <div class="ontology-header">
      <div class="ontology-tabs">
        <button class="ontology-tab active" data-tab="entities">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M20.4 14.5L16 10l-5.5 5.5"/>
            <path d="M14 14.5L10.5 11 7 14.5"/>
          </svg>
          Entities
        </button>
        <button class="ontology-tab" data-tab="relations">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Relations
        </button>
        <button class="ontology-tab" data-tab="graph">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="18" r="3"/>
            <line x1="9" y1="6" x2="15" y2="6"/>
            <line x1="6" y1="9" x2="6" y2="15"/>
            <line x1="18" y1="9" x2="18" y2="15"/>
            <line x1="9" y1="18" x2="15" y2="18"/>
          </svg>
          Graph
        </button>
        <button class="ontology-tab" data-tab="analytics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Analytics
        </button>
        <button class="ontology-tab" data-tab="suggestions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          AI
          <span class="badge" id="suggestions-badge" style="display: none">0</span>
        </button>
        <button class="ontology-tab" data-tab="history">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          History
        </button>
        <button class="ontology-tab" data-tab="jobs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Jobs
          <span class="badge job-status-badge" id="jobs-badge" style="display: none"></span>
        </button>
        <button class="ontology-tab" data-tab="tools">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Tools
        </button>
      </div>
      <div class="ontology-actions">
        <button class="btn btn-sm btn-ghost" id="btn-sync" title="Sync to graph">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <div class="sync-indicator" id="sync-indicator" title="Sync status">
          <span class="sync-dot"></span>
        </div>
      </div>
      <div class="ontology-search">
        <input type="text" id="ontology-search" placeholder="Search..." class="search-input">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
    </div>
    
    <div class="ontology-content" id="ontology-content">
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading ontology schema...</p>
      </div>
    </div>
    
    <div class="ontology-footer">
      <div class="ontology-stats" id="ontology-stats">
        <!-- Stats will be rendered here -->
      </div>
      <div class="ontology-source" id="ontology-source">
        <!-- Source info -->
      </div>
      <div class="ontology-version" id="ontology-version">
        <!-- Version info -->
      </div>
    </div>
  `,A(i,s,e),i}async function A(e,s,i){e.querySelectorAll(".ontology-tab").forEach(r=>{h(r,"click",()=>{const l=r.getAttribute("data-tab");l&&B(e,s,l,i)})});const n=e.querySelector("#ontology-search");n&&h(n,"input",()=>{s.searchQuery=n.value.toLowerCase(),L(e,s,i)});const o=e.querySelector("#btn-sync");o&&h(o,"click",async()=>{if(s.isSyncing)return;s.isSyncing=!0,o.classList.add("syncing"),c.info("Syncing ontology to graph...");const r=await g.forceOntologySync();s.isSyncing=!1,o.classList.remove("syncing"),r.ok?(c.success("Ontology synced to graph"),await T(e,s,i)):c.error(`Sync failed: ${r.error}`)}),await T(e,s,i)}async function T(e,s,i){try{const[t,n,o,r,l,a,p,y,v]=await Promise.all([g.getOntologySchema(),g.getOntologySuggestions(),g.getOntologyTypeStats(),g.getOntologySyncStatus(),g.getOntologyChanges({limit:20}),g.getBackgroundWorkerStatus(),g.getOntologyJobs(),g.getBackgroundWorkerLog({limit:10}),g.getFalkorDBBrowserInfo()]);s.schema=t,s.suggestions=n.filter(w=>w.status==="pending"),s.typeStats=o,s.syncStatus=r,s.changes=l,s.workerStatus=a?.status||null,s.workerStats=a?.stats||null,s.jobs=p,s.jobLog=y,s.falkorBrowserInfo=v,s.isLoading=!1;const b=e.querySelector("#suggestions-badge");b&&(s.suggestions.length>0?(b.textContent=String(s.suggestions.length),b.style.display=""):b.style.display="none"),V(e,s),O(e,s),U(e,s),L(e,s,i)}catch(t){console.error("[OntologyViewer] Failed to load:",t);const n=e.querySelector("#ontology-content");n&&(n.innerHTML=`
        <div class="error-state">
          <p>Failed to load ontology schema</p>
          <button class="btn btn-sm" onclick="location.reload()">Retry</button>
        </div>
      `)}}function O(e,s){const i=e.querySelector("#sync-indicator");if(!i)return;const t=i.querySelector(".sync-dot");if(!t)return;s.syncStatus?s.syncStatus.syncInProgress?(t.className="sync-dot syncing",i.title="Syncing..."):s.syncStatus.isListening&&s.syncStatus.graphConnected?(t.className="sync-dot connected",i.title=`Connected - Last sync: ${s.syncStatus.lastSyncAt?new Date(s.syncStatus.lastSyncAt).toLocaleTimeString():"never"}`):s.syncStatus.graphConnected?(t.className="sync-dot partial",i.title="Connected (realtime sync disabled)"):(t.className="sync-dot disconnected",i.title="Graph not connected"):(t.className="sync-dot unknown",i.title="Status unknown");const n=e.querySelector("#ontology-source");n&&s.syncStatus?.ontologySource&&(n.textContent=`Source: ${s.syncStatus.ontologySource}`)}function B(e,s,i,t){s.activeTab=i,e.querySelectorAll(".ontology-tab").forEach(o=>{o.classList.toggle("active",o.getAttribute("data-tab")===i)}),L(e,s,t)}function L(e,s,i){const t=e.querySelector("#ontology-content");if(!(!t||!s.schema))switch(s.activeTab){case"entities":M(t,s,i);break;case"relations":q(t,s,i);break;case"graph":R(t,s);break;case"analytics":I(t,s,e);break;case"suggestions":k(t,s,e);break;case"history":N(t,s);break;case"jobs":S(t,s);break;case"tools":$(t,s);break}}function M(e,s,i){if(!s.schema||!s.schema.entityTypes){e.innerHTML='<div class="empty-state"><p>No entity types defined in schema</p></div>';return}const t=Object.entries(s.schema.entityTypes).filter(([n,o])=>s.searchQuery?n.toLowerCase().includes(s.searchQuery)||(o.label||"").toLowerCase().includes(s.searchQuery)||(o.description||"").toLowerCase().includes(s.searchQuery):!0).sort((n,o)=>n[0].localeCompare(o[0]));if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No entity types found${s.searchQuery?' matching "'+u(s.searchQuery)+'"':""}</p>
      </div>
    `;return}e.innerHTML=`
    <div class="ontology-layout">
      <div class="entity-list">
        ${t.map(([n,o])=>{const r=Object.entries(o.properties||{}),l=r.length>5;return`
            <div class="entity-card" data-entity="${n}">
              <div class="entity-header">
                <div class="entity-icon-wrapper" style="background: ${o.color||"#6366f1"}">
                  <span class="entity-icon-letter">${(o.label||n).charAt(0).toUpperCase()}</span>
                </div>
                <div class="entity-info">
                  <h4 class="entity-name">${u(o.label||n)}</h4>
                  <span class="entity-key">${u(n)}</span>
                </div>
                ${o.sharedEntity?'<span class="shared-badge">Shared</span>':""}
              </div>
              ${o.description?`<p class="entity-description">${u(o.description)}</p>`:""}
              <div class="entity-properties">
                <h5>PROPERTIES (${r.length})</h5>
                <div class="properties-list" data-entity="${n}" data-expanded="false">
                  ${r.slice(0,5).map(([a,p])=>`
                    <div class="property-row">
                      <span class="property-name ${p.required?"required":""}">${u(a)}</span>
                      <span class="property-type">${p.type||"string"}</span>
                    </div>
                  `).join("")}
                  ${l?`
                    <button class="btn-expand-props" data-entity="${n}">+${r.length-5} more</button>
                    <div class="properties-hidden" style="display: none;">
                      ${r.slice(5).map(([a,p])=>`
                        <div class="property-row">
                          <span class="property-name ${p.required?"required":""}">${u(a)}</span>
                          <span class="property-type">${p.type||"string"}</span>
                        </div>
                      `).join("")}
                    </div>
                  `:""}
                </div>
              </div>
            </div>
          `}).join("")}
      </div>
      <div class="entity-detail-panel" id="entity-detail-panel">
        <div class="detail-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M20.4 14.5L16 10l-5.5 5.5"/>
          </svg>
          <p>Select an entity type to view details</p>
        </div>
      </div>
    </div>
  `,e.querySelectorAll(".entity-card").forEach(n=>{h(n,"click",o=>{if(o.target.classList.contains("btn-expand-props"))return;const r=n.getAttribute("data-entity");if(r&&s.schema?.entityTypes[r]){e.querySelectorAll(".entity-card").forEach(p=>p.classList.remove("selected")),n.classList.add("selected"),E(e,r,s.schema.entityTypes[r]);const l=e.querySelector(".entity-list"),a=e.querySelector("#entity-detail-panel");if(l&&a){const p=l.getBoundingClientRect(),v=n.getBoundingClientRect().top-p.top;a.style.marginTop=`${Math.max(0,v)}px`}i.onEntitySelect?.(s.schema.entityTypes[r])}})}),e.querySelectorAll(".btn-expand-props").forEach(n=>{h(n,"click",o=>{o.stopPropagation();const r=n.getAttribute("data-entity"),l=e.querySelector(`.properties-list[data-entity="${r}"]`),a=l?.querySelector(".properties-hidden");a&&(l?.getAttribute("data-expanded")==="true"?(a.style.display="none",n.textContent=`+${a.querySelectorAll(".property-row").length} more`,l?.setAttribute("data-expanded","false")):(a.style.display="block",n.textContent="Show less",l?.setAttribute("data-expanded","true")))})})}function E(e,s,i){const t=e.querySelector("#entity-detail-panel");if(!t)return;const n=Object.entries(i.properties||{});t.innerHTML=`
    <div class="detail-header" style="border-left: 4px solid ${i.color||"#6366f1"};">
      <h3>${u(i.label||s)}</h3>
      <span class="detail-key">${u(s)}</span>
      ${i.sharedEntity?'<span class="shared-badge">Shared across projects</span>':""}
    </div>
    ${i.description?`<p class="detail-description">${u(i.description)}</p>`:""}
    
    <div class="detail-section">
      <h4>Properties (${n.length})</h4>
      <table class="properties-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          ${n.map(([o,r])=>{const l=r;return`
              <tr>
                <td><code>${u(o)}</code></td>
                <td><span class="type-badge">${l.type||"string"}</span></td>
                <td>${l.required?'<span class="required-badge">Required</span>':'<span class="optional-badge">Optional</span>'}</td>
              </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
    
    ${i.examples&&i.examples.length>0?`
      <div class="detail-section">
        <h4>Examples</h4>
        <ul class="examples-list">
          ${i.examples.map(o=>`<li>${u(String(o))}</li>`).join("")}
        </ul>
      </div>
    `:""}
  `}function q(e,s,i){if(!s.schema||!s.schema.relationTypes){e.innerHTML='<div class="empty-state"><p>No relation types defined in schema</p></div>';return}const t=Object.entries(s.schema.relationTypes).filter(([n,o])=>s.searchQuery?n.toLowerCase().includes(s.searchQuery)||(o.label||"").toLowerCase().includes(s.searchQuery)||(o.description||"").toLowerCase().includes(s.searchQuery):!0).sort((n,o)=>n[0].localeCompare(o[0]));if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No relation types found${s.searchQuery?' matching "'+u(s.searchQuery)+'"':""}</p>
      </div>
    `;return}e.innerHTML=`
    <div class="relation-list">
      ${t.map(([n,o])=>`
        <div class="relation-card" data-relation="${n}">
          <div class="relation-header">
            <div class="relation-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </div>
            <div class="relation-info">
              <h4 class="relation-name">${u(o.label||n)}</h4>
              <span class="relation-key">${u(n)}</span>
            </div>
          </div>
          ${o.description?`<p class="relation-description">${u(o.description)}</p>`:""}
          <div class="relation-types">
            <div class="from-types">
              <span class="types-label">From:</span>
              ${(o.fromTypes||[]).map(r=>`<span class="type-chip">${u(r)}</span>`).join("")}
            </div>
            <div class="to-types">
              <span class="types-label">To:</span>
              ${(o.toTypes||[]).map(r=>`<span class="type-chip">${u(r)}</span>`).join("")}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".relation-card").forEach(n=>{h(n,"click",()=>{const o=n.getAttribute("data-relation");o&&s.schema?.relationTypes[o]&&i.onRelationSelect?.(s.schema.relationTypes[o])})})}function R(e,s,i){if(!s.schema?.entityTypes||!s.schema?.relationTypes){e.innerHTML='<div class="empty-state"><p>No schema available for graph visualization</p></div>';return}e.innerHTML=`
    <div class="ontology-graph-container" style="height: 400px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary);">
      <div id="ontology-graph-canvas" style="width: 100%; height: 100%;"></div>
    </div>
    <div class="ontology-graph-legend" style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
      <h5 style="margin: 0 0 8px 0; font-size: 12px; color: var(--text-muted);">Legend</h5>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${Object.entries(s.schema.entityTypes).map(([t,n])=>`
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px;">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: ${n.color||"#6366f1"}"></span>
            ${u(t)}
          </span>
        `).join("")}
      </div>
    </div>
  `,setTimeout(()=>{const t=e.querySelector("#ontology-graph-canvas");if(!t)return;const n=window.vis;if(!n){t.innerHTML='<p style="padding: 20px; text-align: center; color: var(--text-muted);">vis.js not loaded</p>';return}const o=[];Object.entries(s.schema.entityTypes).forEach(([y,v])=>{const b=v.color||"#6366f1";o.push({id:y,label:y,color:b,shape:"dot",font:{color:H()}})});const r=[];Object.entries(s.schema.relationTypes).forEach(([y,v])=>{const b=v,w=b.fromTypes||[],d=b.toTypes||[];w.forEach(f=>{d.forEach(m=>{s.schema.entityTypes[f]&&s.schema.entityTypes[m]&&r.push({from:f,to:m,label:y,arrows:"to",color:{color:"rgba(156, 163, 175, 0.6)"}})})})});const l={nodes:new n.DataSet(o),edges:new n.DataSet(r)},a={nodes:{size:30,borderWidth:3,font:{size:14,face:"Inter, system-ui, sans-serif",strokeWidth:3,strokeColor:"rgba(255,255,255,0.8)"},shadow:{enabled:!0,size:10,color:"rgba(0,0,0,0.2)"}},edges:{font:{size:9,align:"top",color:"rgba(100,100,100,0.7)"},smooth:{type:"curvedCW",roundness:.2},width:1.5,selectionWidth:3,hoverWidth:2},physics:{enabled:!0,solver:"barnesHut",barnesHut:{gravitationalConstant:-3e3,centralGravity:.1,springLength:250,springConstant:.02,damping:.3,avoidOverlap:1},stabilization:{enabled:!0,iterations:200,fit:!0}},interaction:{hover:!0,tooltipDelay:200,zoomView:!0,dragView:!0},layout:{improvedLayout:!0,randomSeed:42}},p=new n.Network(t,l,a);p.once("stabilizationIterationsDone",()=>{p.fit()})},100)}function H(){return document.documentElement.getAttribute("data-theme")==="dark"?"#e5e7eb":"#1f2937"}function k(e,s,i){if(s.suggestions.length===0){const t=s.typeStats?.notInOntology?.entities?.length||s.typeStats?.notInOntology?.relations?.length,n=s.typeStats?.unused?.entities?.length||s.typeStats?.unused?.relations?.length;e.innerHTML=`
      <div class="ai-suggestions-empty">
        <div class="ai-status-card">
          <div class="ai-status-icon ${t?"warning":"success"}">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${t?'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>':'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
            </svg>
          </div>
          <div class="ai-status-text">
            <h3>${t?"Schema gaps detected":"Ontology is in sync"}</h3>
            <p>${t?"Some types in your graph are not defined in the ontology schema.":"All entity and relation types in your graph are defined in the ontology."}</p>
          </div>
        </div>
        
        <div class="ai-insights-grid">
          <div class="ai-insight-card">
            <div class="insight-value">${Object.keys(s.typeStats?.entities||{}).length}</div>
            <div class="insight-label">Entity Types in Graph</div>
          </div>
          <div class="ai-insight-card">
            <div class="insight-value">${Object.keys(s.typeStats?.relations||{}).length}</div>
            <div class="insight-label">Relation Types in Graph</div>
          </div>
          <div class="ai-insight-card ${t?"warning":""}">
            <div class="insight-value">${(s.typeStats?.notInOntology?.entities?.length||0)+(s.typeStats?.notInOntology?.relations?.length||0)}</div>
            <div class="insight-label">Not in Schema</div>
          </div>
          <div class="ai-insight-card ${n?"muted":""}">
            <div class="insight-value">${(s.typeStats?.unused?.entities?.length||0)+(s.typeStats?.unused?.relations?.length||0)}</div>
            <div class="insight-label">Unused Types</div>
          </div>
        </div>
        
        <div class="ai-actions">
          <button class="btn btn-primary" id="btn-run-ai-analysis">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Run AI Analysis
          </button>
          <button class="btn btn-ghost" id="btn-check-gaps">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Check for Gaps
          </button>
        </div>
        
        ${t?`
          <div class="ai-gaps-preview">
            <h4>Detected Gaps</h4>
            <div class="gaps-list">
              ${s.typeStats?.notInOntology?.entities?.map(l=>`
                <span class="gap-chip entity">${u(l)}</span>
              `).join("")||""}
              ${s.typeStats?.notInOntology?.relations?.map(l=>`
                <span class="gap-chip relation">${u(l)}</span>
              `).join("")||""}
            </div>
            <p class="text-muted">Click "Check for Gaps" to generate suggestions for these types.</p>
          </div>
        `:""}
      </div>
    `;const o=e.querySelector("#btn-run-ai-analysis");o&&h(o,"click",async()=>{c.info("Running AI analysis..."),o.classList.add("loading"),o.disabled=!0;const l=await g.runLLMAnalysis();if(o.classList.remove("loading"),o.disabled=!1,l){c.success(`Analysis complete: ${l.suggestions?.length||0} suggestions`);const a=await g.getOntologySuggestions();s.suggestions=a.filter(p=>p.status==="pending"),k(e,s,i),x(i,s)}else c.error("Analysis failed")});const r=e.querySelector("#btn-check-gaps");r&&h(r,"click",async()=>{c.info("Checking for gaps..."),r.classList.add("loading"),r.disabled=!0;const l=await g.triggerBackgroundAnalysis("gaps");if(r.classList.remove("loading"),r.disabled=!1,l){c.success("Gap check complete");const a=await g.getOntologySuggestions();s.suggestions=a.filter(p=>p.status==="pending"),k(e,s,i),x(i,s)}else c.error("Gap check failed")});return}e.innerHTML=`
    <div class="suggestions-list">
      ${s.suggestions.map(t=>`
        <div class="suggestion-card" data-id="${t.id}">
          <div class="suggestion-header">
            <span class="suggestion-type">${t.type}</span>
            <span class="suggestion-name">${u(t.name)}</span>
          </div>
          ${t.description?`<p class="suggestion-description">${u(t.description)}</p>`:""}
          ${t.example?`<div class="suggestion-example"><strong>Example:</strong> ${u(t.example)}</div>`:""}
          ${t.source?`<div class="suggestion-source">Source: ${u(t.source)}</div>`:""}
          <div class="suggestion-actions">
            <button class="btn btn-sm btn-primary btn-approve" data-id="${t.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Approve
            </button>
            <button class="btn btn-sm btn-ghost btn-reject" data-id="${t.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".btn-approve").forEach(t=>{h(t,"click",async n=>{n.stopPropagation();const o=t.getAttribute("data-id");o&&(await g.approveOntologySuggestion(o)?(c.success("Suggestion approved"),s.suggestions=s.suggestions.filter(l=>l.id!==o),k(e,s,i),x(i,s)):c.error("Failed to approve suggestion"))})}),e.querySelectorAll(".btn-reject").forEach(t=>{h(t,"click",async n=>{n.stopPropagation();const o=t.getAttribute("data-id");o&&(await g.rejectOntologySuggestion(o)?(c.info("Suggestion rejected"),s.suggestions=s.suggestions.filter(l=>l.id!==o),k(e,s,i),x(i,s)):c.error("Failed to reject suggestion"))})})}function I(e,s,i){const t=s.typeStats,n=t?.compliance;e.innerHTML=`
    <div class="analytics-container">
      ${n?`
        <div class="compliance-overview">
          <div class="compliance-score ${n.percentage>=90?"excellent":n.percentage>=70?"good":"warning"}">
            <div class="compliance-value">${n.percentage}%</div>
            <div class="compliance-label">Ontology Compliance</div>
          </div>
          <div class="compliance-details">
            <div class="compliance-stat">
              <span class="stat-value success">${n.valid}</span>
              <span class="stat-label">Valid Nodes</span>
            </div>
            <div class="compliance-stat">
              <span class="stat-value ${n.invalid>0?"error":""}">${n.invalid}</span>
              <span class="stat-label">Invalid Nodes</span>
            </div>
            <div class="compliance-stat">
              <span class="stat-value muted">${n.unchecked}</span>
              <span class="stat-label">Unchecked</span>
            </div>
            <div class="compliance-stat">
              <span class="stat-value">${n.total}</span>
              <span class="stat-label">Total Nodes</span>
            </div>
          </div>
        </div>
      `:""}
      
      <div class="analytics-header">
        <h3>Ontology Analytics</h3>
        <div class="analytics-actions">
          <button class="btn btn-sm btn-primary" id="btn-analyze">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Run LLM Analysis
          </button>
          <button class="btn btn-sm btn-ghost" id="btn-auto-approve" title="Auto-approve high confidence suggestions">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Auto-Approve
          </button>
        </div>
      </div>
      
      ${t?`
        <div class="analytics-grid">
          <div class="analytics-card">
            <h4>Entity Type Usage</h4>
            <div class="usage-list">
              ${Object.entries(t.entities||{}).sort((l,a)=>(a[1].count||0)-(l[1].count||0)).slice(0,10).map(([l,a])=>`
                  <div class="usage-row ${a.inOntology?"":"not-in-ontology"}">
                    <span class="usage-name">${u(l)}</span>
                    <span class="usage-count">${a.count}</span>
                    ${a.inOntology?"":'<span class="warning-badge">Not in schema</span>'}
                  </div>
                `).join("")}
            </div>
          </div>
          
          <div class="analytics-card">
            <h4>Relation Type Usage</h4>
            <div class="usage-list">
              ${Object.entries(t.relations||{}).sort((l,a)=>(a[1].count||0)-(l[1].count||0)).slice(0,10).map(([l,a])=>`
                  <div class="usage-row ${a.inOntology?"":"not-in-ontology"}">
                    <span class="usage-name">${u(l)}</span>
                    <span class="usage-count">${a.count}</span>
                    ${a.inOntology?"":'<span class="warning-badge">Not in schema</span>'}
                  </div>
                `).join("")}
            </div>
          </div>
          
          ${t.unused?.entities?.length||t.unused?.relations?.length?`
            <div class="analytics-card warning">
              <h4>Unused in Schema</h4>
              <p class="text-muted">These types are defined in the schema but have no instances in the graph.</p>
              ${t.unused.entities?.length?`
                <div class="unused-section">
                  <strong>Entities:</strong>
                  <div class="unused-list">
                    ${t.unused.entities.map(l=>`<span class="unused-chip">${u(l)}</span>`).join("")}
                  </div>
                </div>
              `:""}
              ${t.unused.relations?.length?`
                <div class="unused-section">
                  <strong>Relations:</strong>
                  <div class="unused-list">
                    ${t.unused.relations.map(l=>`<span class="unused-chip">${u(l)}</span>`).join("")}
                  </div>
                </div>
              `:""}
            </div>
          `:""}
          
          ${t.notInOntology?.entities?.length||t.notInOntology?.relations?.length?`
            <div class="analytics-card error">
              <h4>Not in Schema</h4>
              <p class="text-muted">These types exist in the graph but are not defined in the schema.</p>
              ${t.notInOntology.entities?.length?`
                <div class="not-in-ontology-section">
                  <strong>Entities:</strong>
                  <div class="not-in-ontology-list">
                    ${t.notInOntology.entities.map(l=>`<span class="error-chip">${u(l)}</span>`).join("")}
                  </div>
                </div>
              `:""}
              ${t.notInOntology.relations?.length?`
                <div class="not-in-ontology-section">
                  <strong>Relations:</strong>
                  <div class="not-in-ontology-list">
                    ${t.notInOntology.relations.map(l=>`<span class="error-chip">${u(l)}</span>`).join("")}
                  </div>
                </div>
              `:""}
            </div>
          `:""}
        </div>
      `:`
        <div class="empty-state">
          <p>No analytics data available. Make sure the graph is connected.</p>
        </div>
      `}
      
      <div id="analysis-results" style="display: none;">
        <!-- LLM analysis results will be rendered here -->
      </div>
    </div>
  `;const o=e.querySelector("#btn-analyze");o&&h(o,"click",async()=>{if(s.isAnalyzing)return;s.isAnalyzing=!0,o.classList.add("loading"),o.disabled=!0,c.info("Running LLM analysis... This may take a moment.");const l=await g.runLLMAnalysis();if(s.isAnalyzing=!1,o.classList.remove("loading"),o.disabled=!1,l){c.success(`Analysis complete: ${l.suggestions?.length||0} new suggestions`);const a=e.querySelector("#analysis-results");a&&(a.style.display="block",a.innerHTML=`
            <div class="analysis-results">
              <h4>LLM Analysis Results</h4>
              <p class="analysis-summary">${u(l.summary||l.analysis?.summary||"")}</p>
              ${l.suggestions?.length?`
                <p class="text-success">${l.suggestions.length} suggestions were added. Check the AI tab to review them.</p>
              `:""}
            </div>
          `);const p=await g.getOntologySuggestions();s.suggestions=p.filter(y=>y.status==="pending"),x(i,s)}else c.error("Analysis failed. Check console for details.")});const r=e.querySelector("#btn-auto-approve");r&&h(r,"click",async()=>{if(!s.suggestions.length){c.info("No pending suggestions to approve");return}const l=await g.autoApproveHighConfidence(.85);if(l.approved>0){c.success(`Auto-approved ${l.approved} high-confidence suggestions`);const a=await g.getOntologySuggestions();s.suggestions=a.filter(p=>p.status==="pending"),x(i,s)}else c.info("No suggestions met the confidence threshold")})}function N(e,s){if(!s.changes||s.changes.length===0){e.innerHTML=`
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <h3>No change history</h3>
        <p>Changes to the ontology schema will be logged here.</p>
      </div>
    `;return}e.innerHTML=`
    <div class="history-container">
      <h3>Ontology Change History</h3>
      <div class="history-list">
        ${s.changes.map(i=>{const t=z(i.change_type),n=D(i.change_type);return`
            <div class="history-item">
              <div class="history-icon" style="color: ${n}">
                ${t}
              </div>
              <div class="history-content">
                <div class="history-header">
                  <span class="history-type" style="color: ${n}">${F(i.change_type)}</span>
                  <span class="history-target">${u(i.target_type||"")}/${u(i.target_name||"")}</span>
                </div>
                ${i.reason?`<p class="history-reason">${u(i.reason)}</p>`:""}
                <div class="history-meta">
                  <span class="history-source">${u(i.source||"manual")}</span>
                  <span class="history-date">${new Date(i.changed_at).toLocaleString()}</span>
                </div>
                ${i.diff?`
                  <details class="history-diff">
                    <summary>View changes</summary>
                    <pre>${u(JSON.stringify(i.diff,null,2))}</pre>
                  </details>
                `:""}
              </div>
            </div>
          `}).join("")}
      </div>
    </div>
  `}function z(e){return e.includes("added")?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>':e.includes("removed")?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>':e.includes("modified")?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'}function D(e){return e.includes("added")?"var(--color-success, #10b981)":e.includes("removed")?"var(--color-error, #ef4444)":e.includes("modified")?"var(--color-warning, #f59e0b)":"var(--color-info, #3b82f6)"}function F(e){return e.replace(/_/g," ").replace(/\b\w/g,s=>s.toUpperCase())}function S(e,s,i){const{workerStatus:t,workerStats:n,jobs:o,jobLog:r}=s;e.innerHTML=`
    <div class="jobs-container">
      <div class="jobs-header">
        <h3>Background Optimization Jobs</h3>
        <div class="worker-status ${t?.isRunning?"running":""}">
          <span class="status-dot ${t?.isRunning?"active":"idle"}"></span>
          <span>${t?.isRunning?"Running":"Idle"}</span>
          ${t?.hasPendingAnalysis?'<span class="pending-badge">Analysis Pending</span>':""}
        </div>
      </div>
      
      ${n?`
        <div class="worker-stats">
          <div class="stat-card">
            <span class="stat-value">${n.totalExecutions}</span>
            <span class="stat-label">Total Executions</span>
          </div>
          <div class="stat-card success">
            <span class="stat-value">${n.byStatus?.completed||0}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat-card error">
            <span class="stat-value">${n.byStatus?.failed||0}</span>
            <span class="stat-label">Failed</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${n.avgDuration?(n.avgDuration/1e3).toFixed(1)+"s":"-"}</span>
            <span class="stat-label">Avg Duration</span>
          </div>
        </div>
      `:""}
      
      <div class="jobs-section">
        <h4>Scheduled Jobs</h4>
        <div class="jobs-list">
          ${o.length>0?o.map(a=>`
            <div class="job-card ${a.enabled?"enabled":"disabled"}">
              <div class="job-info">
                <div class="job-name">${u(a.name)}</div>
                <div class="job-meta">
                  <span class="job-schedule">${u(a.schedule)}</span>
                  <span class="job-run-count">${a.runCount} runs</span>
                </div>
                ${a.lastRun?`<div class="job-last-run">Last: ${new Date(a.lastRun).toLocaleString()}</div>`:""}
                ${a.nextRun?`<div class="job-next-run">Next: ${new Date(a.nextRun).toLocaleString()}</div>`:""}
              </div>
              <div class="job-actions">
                <button class="btn btn-sm ${a.enabled?"btn-warning":"btn-success"} btn-toggle-job" data-job-id="${a.id}" data-enabled="${a.enabled}">
                  ${a.enabled?"Disable":"Enable"}
                </button>
                <button class="btn btn-sm btn-primary btn-run-job" data-job-type="${a.type.replace("ontology_","")}">
                  Run Now
                </button>
              </div>
            </div>
          `).join(""):'<p class="text-muted">No scheduled jobs found.</p>'}
        </div>
      </div>
      
      <div class="jobs-section">
        <h4>Quick Actions</h4>
        <div class="quick-actions">
          <button class="btn btn-sm btn-outline" id="btn-run-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
            </svg>
            Full Analysis
          </button>
          <button class="btn btn-sm btn-outline" id="btn-run-inference">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Run Inference
          </button>
          <button class="btn btn-sm btn-outline" id="btn-run-dedup">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Check Duplicates
          </button>
          <button class="btn btn-sm btn-outline" id="btn-run-gaps">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Check Gaps
          </button>
        </div>
      </div>
      
      <div class="jobs-section">
        <h4>Recent Executions</h4>
        <div class="execution-log">
          ${r.length>0?r.map(a=>`
            <div class="execution-item ${a.status}">
              <div class="execution-type">${G(a.type)}</div>
              <div class="execution-status">${a.status}</div>
              <div class="execution-time">${a.startedAt?new Date(a.startedAt).toLocaleString():""}</div>
              <div class="execution-duration">${a.duration?(a.duration/1e3).toFixed(1)+"s":"-"}</div>
              ${a.error?`<div class="execution-error">${u(a.error)}</div>`:""}
            </div>
          `).join(""):'<p class="text-muted">No recent executions.</p>'}
        </div>
      </div>
    </div>
  `,e.querySelectorAll(".btn-toggle-job").forEach(a=>{h(a,"click",async()=>{const p=a.getAttribute("data-job-id"),y=a.getAttribute("data-enabled")==="true";if(p){const v=await g.toggleOntologyJob(p,!y);v?(c.success(`Job ${v.enabled?"enabled":"disabled"}`),s.jobs=await g.getOntologyJobs(),S(e,s)):c.error("Failed to toggle job")}})}),e.querySelectorAll(".btn-run-job").forEach(a=>{h(a,"click",async()=>{const p=a.getAttribute("data-job-type");if(p){c.info(`Running ${p}...`);const y=await g.triggerBackgroundAnalysis(p);y&&y.status==="completed"?c.success(`${p} completed`):y?.error&&c.error(`Error: ${y.error}`),s.jobLog=await g.getBackgroundWorkerLog({limit:10}),S(e,s)}})}),[{id:"btn-run-full",type:"full"},{id:"btn-run-inference",type:"inference"},{id:"btn-run-dedup",type:"dedup"},{id:"btn-run-gaps",type:"gaps"}].forEach(({id:a,type:p})=>{const y=e.querySelector(`#${a}`);y&&h(y,"click",async()=>{c.info(`Running ${p} analysis...`),y.classList.add("loading"),y.disabled=!0;const v=await g.triggerBackgroundAnalysis(p);y.classList.remove("loading"),y.disabled=!1,v&&v.status==="completed"?c.success(`${p} analysis completed`):v?.error&&c.error(`Error: ${v.error}`);const b=await g.getBackgroundWorkerStatus();s.workerStatus=b?.status||null,s.workerStats=b?.stats||null,s.jobLog=await g.getBackgroundWorkerLog({limit:10}),S(e,s)})})}function $(e,s,i){const{compliance:t}=s;e.innerHTML=`
    <div class="tools-container">
      <div class="tools-section graph-status">
        <h4>Graph Database</h4>
        <p class="text-muted">Supabase PostgreSQL graph storage - fully managed, zero configuration.</p>
        <div class="graph-status-card">
          <div class="status-indicator active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Connected to Supabase Graph</span>
          </div>
        </div>
      </div>
      
      <div class="tools-section">
        <h4>Ontology Compliance</h4>
        <p class="text-muted">Validate that your graph data conforms to the ontology schema.</p>
        
        ${t?`
          <div class="compliance-card ${t.valid?"valid":"invalid"}">
            <div class="compliance-header">
              <div class="compliance-score-large ${t.score>=90?"excellent":t.score>=70?"good":"warning"}">
                <span class="score-value">${t.score}%</span>
                <span class="score-label">Compliance</span>
              </div>
              <div class="compliance-status">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  ${t.valid?'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>':'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                </svg>
                <span>${t.valid?"Compliant":"Issues Found"}</span>
              </div>
            </div>
            
            ${t.issues.length>0?`
              <div class="compliance-issues">
                <h5>Issues (${t.issues.length})</h5>
                <div class="issues-list">
                  ${t.issues.slice(0,10).map(d=>`
                    <div class="issue-item ${d.severity}">
                      <span class="issue-type">${d.type.replace(/_/g," ")}</span>
                      <span class="issue-message">${u(d.message)}</span>
                      ${d.count?`<span class="issue-count">${d.count}</span>`:""}
                    </div>
                  `).join("")}
                  ${t.issues.length>10?`<p class="text-muted">...and ${t.issues.length-10} more</p>`:""}
                </div>
              </div>
            `:""}
            
            <div class="compliance-actions">
              <button class="btn btn-outline btn-sm" id="btn-recheck-compliance">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Re-check Compliance
              </button>
              <button class="btn btn-ghost btn-sm" id="btn-clear-compliance">Clear</button>
            </div>
          </div>
        `:`
          <button class="btn btn-outline" id="btn-validate-compliance">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Run Compliance Check
          </button>
        `}
      </div>
      
      <div class="tools-section">
        <h4>Ontology Extraction</h4>
        <p class="text-muted">Extract ontology schema directly from your graph data.</p>
        <div class="tools-grid">
          <button class="btn btn-outline tool-btn" id="btn-extract-ontology">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Extract from Graph</span>
            <small>Auto-detect entity & relation types</small>
          </button>
          
          <button class="btn btn-outline tool-btn" id="btn-diff-ontology">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Compare with Graph</span>
            <small>See what's different</small>
          </button>
          
          <button class="btn btn-outline tool-btn" id="btn-merge-ontology">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Merge & Update</span>
            <small>Add discovered types to schema</small>
          </button>
          
          <button class="btn btn-outline tool-btn" id="btn-find-unused">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <span>Find Unused Types</span>
            <small>Types in schema but not in graph</small>
          </button>
        </div>
      </div>
      
      ${s.unusedTypes?`
        <div class="tools-section unused-types-section">
          <h4>Unused Types Found</h4>
          <p class="text-muted">These types are defined in the schema but have no instances in the graph.</p>
          
          ${s.unusedTypes.entities.length>0?`
            <div class="unused-group">
              <h5>Unused Entities (${s.unusedTypes.entities.length})</h5>
              <div class="unused-chips">
                ${s.unusedTypes.entities.map(d=>`<span class="unused-chip entity">${u(d)}</span>`).join("")}
              </div>
            </div>
          `:""}
          
          ${s.unusedTypes.relations.length>0?`
            <div class="unused-group">
              <h5>Unused Relations (${s.unusedTypes.relations.length})</h5>
              <div class="unused-chips">
                ${s.unusedTypes.relations.map(d=>`<span class="unused-chip relation">${u(d)}</span>`).join("")}
              </div>
            </div>
          `:""}
          
          <div class="unused-actions">
            <button class="btn btn-warning btn-sm" id="btn-remove-unused">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Remove All Unused Types
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-clear-unused">Clear</button>
          </div>
        </div>
      `:""}
      
      <div class="tools-section">
        <h4>Cleanup</h4>
        <p class="text-muted">Remove orphan types from the ontology schema.</p>
        <div class="cleanup-buttons">
          <button class="btn btn-ghost btn-sm" id="btn-cleanup-entities">
            Remove Entities Without Relations
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-cleanup-relations">
            Remove Relations Without Entities
          </button>
        </div>
      </div>
      
    </div>
  `;const n=e.querySelector("#btn-validate-compliance")||e.querySelector("#btn-recheck-compliance");n&&h(n,"click",async()=>{c.info("Validating compliance..."),n.classList.add("loading"),n.disabled=!0;const d=await g.validateOntologyCompliance();n.classList.remove("loading"),n.disabled=!1,d?(s.compliance=d,c.success(`Compliance: ${d.score}% - ${d.issues.length} issues found`),$(e,s)):c.error("Failed to validate compliance")});const o=e.querySelector("#btn-clear-compliance");o&&h(o,"click",()=>{s.compliance=null,$(e,s)});const r=e.querySelector("#btn-extract-ontology");r&&h(r,"click",async()=>{c.info("Extracting ontology from graph..."),r.classList.add("loading");const d=await g.extractOntologyFromGraph();if(r.classList.remove("loading"),d.ok&&d.ontology){const f=Object.keys(d.ontology.entityTypes).length,m=Object.keys(d.ontology.relationTypes).length;c.success(`Extracted: ${f} entities, ${m} relations`)}else c.error(d.error||"Failed to extract ontology")});const l=e.querySelector("#btn-diff-ontology");l&&h(l,"click",async()=>{c.info("Comparing ontology with graph..."),l.classList.add("loading");const d=await g.getOntologyDiff();if(l.classList.remove("loading"),d){const{diff:f}=d,m=f.entitiesOnlyInA.length+f.relationsOnlyInA.length,C=f.entitiesOnlyInB.length+f.relationsOnlyInB.length;m===0&&C===0?c.success("Schema and graph are in sync!"):c.info(`Diff: ${m} only in schema, ${C} only in graph`)}else c.error("Failed to compare ontology")});const a=e.querySelector("#btn-merge-ontology");a&&h(a,"click",async()=>{c.info("Merging ontology..."),a.classList.add("loading");const d=await g.mergeOntology({mergeProperties:!0,mergeEndpoints:!0,save:!0});if(a.classList.remove("loading"),d.ok){const f=d.changes?.length||0;f>0?c.success(`Merged: ${f} changes applied`):c.info("No new types to merge")}else c.error("Failed to merge ontology")});const p=e.querySelector("#btn-find-unused");p&&h(p,"click",async()=>{c.info("Finding unused types..."),p.classList.add("loading");const d=await g.findUnusedOntologyTypes();p.classList.remove("loading"),s.unusedTypes=d,d.entities.length+d.relations.length===0?c.success("All types are in use!"):c.info(`Found ${d.entities.length} unused entities, ${d.relations.length} unused relations`),$(e,s)});const y=e.querySelector("#btn-remove-unused");y&&h(y,"click",async()=>{if(!s.unusedTypes)return;c.info("Removing unused types..."),y.classList.add("loading"),y.disabled=!0;const d=await g.cleanupOntology({discardEntitiesWithoutRelations:!0,discardRelationsWithoutEntities:!0,save:!0});if(y.classList.remove("loading"),y.disabled=!1,d.ok){const f=(d.discardedEntities?.length||0)+(d.discardedRelations?.length||0);c.success(`Removed ${f} unused types`),s.unusedTypes=null,$(e,s)}else c.error("Failed to remove unused types")});const v=e.querySelector("#btn-clear-unused");v&&h(v,"click",()=>{s.unusedTypes=null,$(e,s)});const b=e.querySelector("#btn-cleanup-entities");b&&h(b,"click",async()=>{const d=await g.cleanupOntology({discardEntitiesWithoutRelations:!0,save:!0});d.ok&&c.success(`Removed ${d.discardedEntities?.length||0} orphan entities`)});const w=e.querySelector("#btn-cleanup-relations");w&&h(w,"click",async()=>{const d=await g.cleanupOntology({discardRelationsWithoutEntities:!0,save:!0});d.ok&&c.success(`Removed ${d.discardedRelations?.length||0} orphan relations`)})}function G(e){return e.replace("ontology_","").replace(/_/g," ").replace(/\b\w/g,s=>s.toUpperCase())}function V(e,s){const i=e.querySelector("#jobs-badge");i&&(s.workerStatus?.isRunning?(i.textContent="",i.className="badge job-status-badge running",i.style.display="",i.title="Job running"):s.workerStatus?.hasPendingAnalysis?(i.textContent="",i.className="badge job-status-badge pending",i.style.display="",i.title="Analysis pending"):i.style.display="none")}function U(e,s){const i=e.querySelector("#ontology-stats"),t=e.querySelector("#ontology-version");if(i&&s.schema){const n=Object.keys(s.schema.entityTypes||{}).length,o=Object.keys(s.schema.relationTypes||{}).length,r=Object.keys(s.schema.queryPatterns||{}).length;i.innerHTML=`
      <span class="stat">${n} entities</span>
      <span class="stat">${o} relations</span>
      <span class="stat">${r} patterns</span>
    `}t&&s.schema&&(t.innerHTML=`Schema v${s.schema.version}`)}function x(e,s){const i=e.querySelector("#suggestions-badge");i&&(s.suggestions.length>0?(i.textContent=String(s.suggestions.length),i.style.display=""):i.style.display="none")}function u(e){const s=document.createElement("div");return s.textContent=e,s.innerHTML}export{Q as createOntologyViewer};
//# sourceMappingURL=OntologyViewer-BuTP2_uk.js.map
