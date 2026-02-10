import{c as E,n as M,o as m,t as u}from"./main-DsXjfhBM.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function w(){return window.vis}const k={Person:"#6366f1",Project:"#22c55e",Document:"#8b5cf6",Decision:"#06b6d4",Risk:"#ef4444",Question:"#f59e0b",Fact:"#84cc16",Meeting:"#ec4899",Task:"#3b82f6",Technology:"#f97316",Organization:"#a855f7",Client:"#14b8a6",Email:"#e879f9",Conversation:"#9333ea",Answer:"#10b981",Briefing:"#eab308"};function j(e={}){const{height:t=600}=e,n=E("div",{className:"graph-visualization-container"});return n.innerHTML=`
    <div class="viz-toolbar">
      <div class="viz-toolbar-left">
        <button class="viz-btn" id="viz-zoom-in" title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="viz-btn" id="viz-zoom-out" title="Zoom Out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="viz-btn" id="viz-fit" title="Fit to View">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
        <div class="viz-divider"></div>
        <button class="viz-btn" id="viz-physics" title="Toggle Physics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2"/>
            <path d="M12 21v2"/>
            <path d="M4.22 4.22l1.42 1.42"/>
            <path d="M18.36 18.36l1.42 1.42"/>
            <path d="M1 12h2"/>
            <path d="M21 12h2"/>
            <path d="M4.22 19.78l1.42-1.42"/>
            <path d="M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>
      <div class="viz-toolbar-center">
        <span class="viz-status" id="viz-status">Loading...</span>
      </div>
      <div class="viz-toolbar-right">
        <button class="viz-btn" id="viz-screenshot" title="Screenshot">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <button class="viz-btn" id="viz-minimap-toggle" title="Toggle Minimap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <rect x="7" y="7" width="3" height="3"/>
            <rect x="14" y="7" width="3" height="3"/>
            <rect x="7" y="14" width="3" height="3"/>
            <rect x="14" y="14" width="3" height="3"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="viz-canvas-wrapper">
      <div class="viz-canvas" id="viz-canvas" style="--graph-height: ${t}px;">
        <div class="viz-loading">
          <div class="loading-spinner"></div>
          <p>Loading graph data...</p>
        </div>
      </div>
      
      <div class="viz-minimap hidden" id="viz-minimap">
        <div class="minimap-viewport" id="minimap-viewport"></div>
      </div>
      
      <div class="viz-legend" id="viz-legend">
        <!-- Legend will be rendered here -->
      </div>
    </div>
    
    <div class="viz-hover-card hidden" id="viz-hover-card">
      <!-- Hover card content -->
    </div>
    
    <div class="viz-context-menu hidden" id="viz-context-menu">
      <button class="context-menu-item" data-action="expand">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Expand Connections
      </button>
      <button class="context-menu-item" data-action="focus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        Focus on Node
      </button>
      <button class="context-menu-item" data-action="hide">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        Hide Node
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="bookmark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Bookmark
      </button>
      <button class="context-menu-item" data-action="annotate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Add Note
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="ai-explain">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        AI Explain
      </button>
    </div>
  `,C(n,e),n}async function C(e,t){const n=e.querySelector("#viz-canvas"),s=e.querySelector("#viz-status");if(w()||await q(),!w()){n.innerHTML=`
      <div class="viz-error">
        <p>Graph visualization library not available</p>
        <p class="text-muted">Please ensure vis-network is loaded</p>
      </div>
    `;return}try{s.textContent="Loading nodes...";const a=await M.getVisualizationData({limit:500});if(a.nodes.length===0){n.innerHTML=`
        <div class="viz-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4">
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
          <h3>No graph data</h3>
          <p>Process some documents to populate the knowledge graph, or sync existing data.</p>
          <button class="btn btn-primary" id="btn-sync-empty">Sync Data</button>
        </div>
      `;const c=n.querySelector("#btn-sync-empty");c&&m(c,"click",async()=>{u.info("Syncing data..."),await fetchWithProject("/api/graph/sync",{method:"POST"}),u.success("Sync complete. Reloading..."),C(e,t)});return}s.textContent="Rendering graph...",n.innerHTML="";const o=T(n,a.nodes,a.edges,t);N(e,o),I(e,a.nodes),s.textContent=`${a.nodes.length} nodes • ${a.edges.length} edges`}catch(a){console.error("[GraphVisualization] Error:",a),n.innerHTML=`
      <div class="viz-error">
        <p>Failed to load graph data</p>
        <button class="btn btn-sm" onclick="location.reload()">Retry</button>
      </div>
    `}}async function q(){return new Promise(e=>{if(w()){e();return}const t=document.createElement("script");t.src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js",t.onload=()=>e(),t.onerror=()=>e(),document.head.appendChild(t)})}function T(e,t,n,s){const a=new Set,c=t.filter(i=>a.has(i.id)?(console.warn("[GraphVisualization] Skipping duplicate node:",i.id),!1):(a.add(i.id),!0)).map(i=>{const r=i.properties||{},h=i.avatarUrl||i.photoUrl||r.avatar_url||r.photo_url||r.avatarUrl||r.photoUrl,p=i.type==="Person",b=k[i.type]||"#6b7280",L=p?i.name||r.name||i.label||i.id:i.name||i.label||r.title||r.content?.toString().substring(0,30)||i.id,x=String(L);return $(x),{id:i.id,label:x.length>25?x.substring(0,22)+"...":x,title:P(i),color:{background:b,border:b,highlight:{background:z(b,20),border:z(b,-20)},hover:{background:z(b,10),border:z(b,-10)}},shape:p&&h?"circularImage":"dot",image:p&&h?h:void 0,size:A(i),font:{size:12,color:U(),face:"Inter, -apple-system, system-ui, sans-serif"},borderWidth:2,borderWidthSelected:4,_data:i}}),l=new Set,d=n.filter(i=>{const r=i.id||`${i.source}-${i.target}-${i.type}`;return l.has(r)?!1:(l.add(r),!0)}).map(i=>({id:i.id,from:i.source,to:i.target,label:i.label,title:`${i.type}`,color:{color:"rgba(156, 163, 175, 0.6)",highlight:"rgba(99, 102, 241, 0.8)",hover:"rgba(99, 102, 241, 0.6)"},arrows:{to:{enabled:!0,scaleFactor:.5}},font:{size:10,color:"rgba(156, 163, 175, 0.8)",strokeWidth:0,align:"middle"},smooth:{type:"continuous",roundness:.5},width:1,selectionWidth:2,_data:i})),y={nodes:{borderWidth:2,shadow:{enabled:!0,color:"rgba(0,0,0,0.1)",size:5,x:2,y:2}},edges:{width:1,shadow:!1},physics:{enabled:!0,stabilization:{enabled:!0,iterations:100,updateInterval:25},barnesHut:{gravitationalConstant:-3e3,centralGravity:.3,springLength:120,springConstant:.04,damping:.09}},interaction:{hover:!0,tooltipDelay:200,hideEdgesOnDrag:!0,hideEdgesOnZoom:!0,multiselect:!0,navigationButtons:!1,keyboard:{enabled:!0,bindToWindow:!1}},layout:{improvedLayout:!0,hierarchical:!1}},f=w(),g=new f.Network(e,{nodes:new f.DataSet(c),edges:new f.DataSet(d)},y);return g.on("click",i=>{if(i.nodes.length>0){const h=i.nodes[0],p=t.find(b=>b.id===h);p&&s.onNodeClick&&s.onNodeClick(p)}const r=e.closest(".graph-visualization-container")?.querySelector("#viz-context-menu");r&&r.classList.add("hidden")}),g.on("doubleClick",i=>{if(i.nodes.length>0){const r=i.nodes[0],h=t.find(p=>p.id===r);h&&s.onNodeDoubleClick&&s.onNodeDoubleClick(h)}}),g.on("oncontext",i=>{i.event.preventDefault(),i.nodes.length>0&&B(e,i.pointer.DOM.x,i.pointer.DOM.y,i.nodes[0],t)}),g.on("hoverNode",i=>{const r=t.find(h=>h.id===i.node);r&&D(e,r)}),g.on("blurNode",()=>{H(e)}),g.on("stabilizationProgress",i=>{const r=e.closest(".graph-visualization-container")?.querySelector("#viz-status");if(r){const h=Math.round(i.iterations/i.total*100);r.textContent=`Stabilizing... ${h}%`}}),g.on("stabilizationIterationsDone",()=>{const i=e.closest(".graph-visualization-container")?.querySelector("#viz-status");i&&(i.textContent=`${t.length} nodes • ${n.length} edges`)}),g}function N(e,t){const n=e.querySelector("#viz-zoom-in"),s=e.querySelector("#viz-zoom-out"),a=e.querySelector("#viz-fit"),o=e.querySelector("#viz-physics"),c=e.querySelector("#viz-screenshot"),l=e.querySelector("#viz-minimap-toggle");let v=!0;n&&m(n,"click",()=>{const d=t.getScale();t.moveTo({scale:d*1.3,animation:!0})}),s&&m(s,"click",()=>{const d=t.getScale();t.moveTo({scale:d/1.3,animation:!0})}),a&&m(a,"click",()=>{t.fit({animation:!0})}),o&&m(o,"click",()=>{v=!v,o.classList.toggle("active",v),u.info(v?"Physics enabled":"Physics disabled")}),c&&m(c,"click",()=>{const d=e.querySelector("canvas");if(d){const y=document.createElement("a");y.download=`graph-${Date.now()}.png`,y.href=d.toDataURL("image/png"),y.click(),u.success("Screenshot saved")}}),l&&m(l,"click",()=>{const d=e.querySelector("#viz-minimap");d&&(d.classList.toggle("hidden"),l.classList.toggle("active"))})}function B(e,t,n,s,a){const o=e.closest(".graph-visualization-container")?.querySelector("#viz-context-menu");if(!o)return;o.style.left=`${t}px`,o.style.top=`${n}px`,o.classList.remove("hidden"),o.setAttribute("data-node-id",s),o.querySelectorAll(".context-menu-item").forEach(l=>{const v=l.cloneNode(!0);l.parentNode?.replaceChild(v,l),m(v,"click",()=>{const d=v.getAttribute("data-action"),y=a.find(f=>f.id===s);_(d||"",y),o.classList.add("hidden")})}),setTimeout(()=>{const l=v=>{o.contains(v.target)||(o.classList.add("hidden"),document.removeEventListener("click",l))};document.addEventListener("click",l)},100)}async function _(e,t,n){if(t)switch(e){case"expand":u.info(`Expanding connections for ${t.label||t.name}`);break;case"focus":u.info(`Focusing on ${t.label||t.name}`);break;case"hide":u.info(`Hiding ${t.label||t.name}`);break;case"bookmark":await M.addBookmark({node_id:t.id,node_type:t.type,node_label:t.label||t.name||t.id,node_avatar_url:t.avatarUrl||t.photoUrl,sort_order:0}),u.success("Bookmark added");break;case"annotate":const s=prompt("Add a note for this node:");s&&(await M.createAnnotation({target_type:"node",target_id:t.id,target_label:t.label||t.name,content:s,annotation_type:"note",is_shared:!1,is_resolved:!1}),u.success("Note added"));break;case"ai-explain":u.info("Generating AI explanation...");break}}function D(e,t){const n=e.closest(".graph-visualization-container")?.querySelector("#viz-hover-card");if(!n)return;const s=t.avatarUrl||t.photoUrl||t.properties?.avatar_url||t.properties?.photo_url,a=t.role||t.properties?.role,o=t.organization||t.properties?.organization;n.innerHTML=`
    <div class="hover-card-content">
      ${s?`<img class="hover-avatar" src="${s}" alt="" onerror="this.classList.add('gm-none')">`:`<div class="hover-avatar hover-avatar-placeholder" style="--type-color: ${k[t.type]||"#6b7280"}">${$(t.label||t.name||"?")}</div>`}
      <div class="hover-info">
        <div class="hover-name">${S(t.label||t.name||t.id)}</div>
        <div class="hover-type" style="--type-color: ${k[t.type]||"#6b7280"}">${t.type}</div>
        ${a?`<div class="hover-role">${S(String(a))}</div>`:""}
        ${o?`<div class="hover-org">@ ${S(String(o))}</div>`:""}
      </div>
      ${t.connections?`<div class="hover-stat">${t.connections} connections</div>`:""}
    </div>
  `,n.classList.remove("hidden")}function H(e){const t=e.closest(".graph-visualization-container")?.querySelector("#viz-hover-card");t&&t.classList.add("hidden")}function I(e,t){const n=e.querySelector("#viz-legend");if(!n)return;const s={};t.forEach(o=>{s[o.type]=(s[o.type]||0)+1});const a=Object.entries(s).sort((o,c)=>c[1]-o[1]).slice(0,8);n.innerHTML=`
    <div class="legend-title">Entity Types</div>
    <div class="legend-items">
      ${a.map(([o,c])=>`
        <div class="legend-item">
          <span class="legend-color" style="--legend-color: ${k[o]||"#6b7280"}"></span>
          <span class="legend-label">${o}</span>
          <span class="legend-count">${c}</span>
        </div>
      `).join("")}
    </div>
  `}function P(e){const t=e.properties||{},n=e.name||t.name||e.label||e.id,s=e.role||t.role,a=e.organization||t.organization,o=t.content?String(t.content).substring(0,100):null,c=[];return c.push(String(n)),c.push(`[${e.type}]`),s&&c.push(String(s)),a&&c.push(`@ ${a}`),o&&e.type!=="Person"&&c.push(`"${o}..."`),c.join(`
`)}function A(e){const t=e.connections||1;return Math.min(15+t*2,40)}function $(e){return e.split(" ").map(t=>t.charAt(0)).join("").substring(0,2).toUpperCase()}function z(e,t){const n=e.replace("#",""),s=Math.max(0,Math.min(255,parseInt(n.substring(0,2),16)+t)),a=Math.max(0,Math.min(255,parseInt(n.substring(2,4),16)+t)),o=Math.max(0,Math.min(255,parseInt(n.substring(4,6),16)+t));return`#${s.toString(16).padStart(2,"0")}${a.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}`}function U(){return document.documentElement.getAttribute("data-theme")==="dark"?"#e5e7eb":"#374151"}function S(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}export{j as createGraphVisualization};
//# sourceMappingURL=GraphVisualization-CYQEdwqv.js.map
