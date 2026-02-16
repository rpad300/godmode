import{c as $,_ as L,t as b,H as N,o as x,m as T}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const S={Person:"#6366f1",Organization:"#8b5cf6",Project:"#10b981",Meeting:"#f59e0b",Document:"#3b82f6",Fact:"#22c55e",Decision:"#06b6d4",Risk:"#ef4444",Task:"#14b8a6",Question:"#f97316",Technology:"#eab308",Client:"#ec4899",Team:"#84cc16",Regulation:"#a3a3a3",Answer:"#22d3ee",Email:"#60a5fa",Conversation:"#c084fc",Action:"#4ade80",Briefing:"#fbbf24"};let w=new Map,k=new Map;function U(e={}){const n=$("div",{className:"graph-canvas-container"});return n.innerHTML=`
    <div class="graph-canvas-wrapper" style="--graph-height: ${e.height||500}px;">
      <div class="graph-canvas-loading">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading graph data...</p>
      </div>
      <falkordb-canvas id="graph-canvas"></falkordb-canvas>
      <div class="graph-avatar-overlay" id="avatar-overlay"></div>
    </div>
    <div class="graph-canvas-controls">
      <button class="btn btn-sm" id="gc-zoom-in" title="Zoom In">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="gc-zoom-out" title="Zoom Out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="gc-fit" title="Fit to View">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="gc-refresh" title="Refresh Data">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>
    <div class="graph-canvas-legend">
      <h5>Legend</h5>
      <div id="gc-legend">
        <!-- Legend items will be added dynamically -->
      </div>
    </div>
  `,setTimeout(()=>C(n,e),100),n}async function C(e,n){try{await L(()=>import("./index-ByUbc6I1.js"),[])}catch(o){console.error("[GraphCanvas] Failed to load @falkordb/canvas:",o),b.error("Failed to load graph visualization library");return}const i=e.querySelector("#graph-canvas"),p=e.querySelector(".graph-canvas-loading"),d=e.querySelector("#gc-legend"),f=e.querySelector("#avatar-overlay");if(!i){console.error("[GraphCanvas] Canvas element not found");return}const t=e.querySelector(".graph-canvas-wrapper"),a=t.clientWidth||800,r=t.clientHeight||500,u=document.documentElement.getAttribute("data-theme")==="dark",h=u?"#1a1a2e":"#ffffff",s=u?"#e5e7eb":"#1f2937";i.setWidth(a),i.setHeight(r),i.setBackgroundColor(h),i.setForegroundColor(s),i.setIsLoading(!0),i.setConfig({onNodeClick:(o,l)=>{const g=w.get(String(o.id));g&&(z(g,l.clientX,l.clientY,f),n.onNodeClick&&n.onNodeClick(g))},onNodeHover:(o,l)=>{if(o&&l?.clientX!==void 0&&l?.clientY!==void 0){const g=w.get(String(o.id));g&&z(g,l.clientX,l.clientY,f)}else o||_(f)},onNodeRightClick:(o,l)=>{l.preventDefault();const g=w.get(String(o.id));g&&n.onNodeRightClick&&n.onNodeRightClick(g)},onLinkClick:o=>{const l=k.get(String(o.id));l&&n.onLinkClick&&n.onLinkClick(l)},onEngineStop:()=>{}});try{const o=await N.getVisualizationData({limit:500});if(o.nodes.length===0){p.innerHTML=`
        <div class="graph-canvas-no-data">
          <p class="loading-text">No graph data available</p>
          <button class="btn btn-primary btn-sm" id="gc-sync">Sync Data</button>
        </div>
      `,i.setIsLoading(!1);const g=p.querySelector("#gc-sync");g&&x(g,"click",async()=>{b.info("Syncing data..."),await T("/api/graph/sync",{method:"POST"}),b.success("Sync complete. Reloading..."),C(e,n)});return}const l=D(o.nodes,o.edges);E(d,o.nodes),i.setData(l),i.setIsLoading(!1),p.classList.add("gm-none"),M(f,o.nodes,i),setTimeout(()=>i.zoomToFit(1.2),1e3),console.log(`[GraphCanvas] Loaded ${o.nodes.length} nodes and ${o.edges.length} edges`),n.onDataLoaded?.({nodeCount:o.nodes.length,edgeCount:o.edges.length})}catch(o){console.error("[GraphCanvas] Error loading data:",o),p.innerHTML='<p class="graph-canvas-error">Failed to load graph data</p>',i.setIsLoading(!1)}const c=e.querySelector("#gc-zoom-in"),v=e.querySelector("#gc-zoom-out"),m=e.querySelector("#gc-fit"),y=e.querySelector("#gc-refresh");c&&x(c,"click",()=>{const o=i.getZoom?.()||1;i.zoom?.(o*1.2)}),v&&x(v,"click",()=>{const o=i.getZoom?.()||1;i.zoom?.(o/1.2)}),m&&x(m,"click",()=>{i.zoomToFit?.(1.2)}),y&&x(y,"click",async()=>{b.info("Refreshing graph..."),p.classList.remove("gm-none"),i.setIsLoading(!0),await C(e,n),b.success("Graph refreshed")})}function D(e,n){w.clear(),k.clear();const i=new Set,d=e.filter(a=>i.has(a.id)?!1:(i.add(a.id),!0)).map(a=>{w.set(a.id,a);const r=a.properties||{},u=a.name||r.name||r.title||(r.content?String(r.content).substring(0,30):null)||a.label||a.id;let h=String(u);const s=a.type||a.label||"Unknown";if(s==="Contact"||s==="Person"){const v=r.role||a.role,m=r.organization||a.organization;v?h=`${u}
(${v})`:m&&(h=`${u}
(${m})`)}if((s==="Decision"||s==="Risk")&&h.length>40&&(h=h.substring(0,37)+"..."),s==="Fact"){const v=r.content||r.text;v&&(h=String(v).substring(0,35)+(String(v).length>35?"...":""))}let c=6;return s==="Contact"||s==="Person"?c=10:s==="Team"?c=9:s==="Meeting"?c=8:(s==="Decision"||s==="Risk")&&(c=7),{id:a.id,labels:[s],color:S[s]||"#6b7280",visible:!0,size:c,caption:"name",data:{name:h,type:s,originalName:String(u),role:r.role||a.role,organization:r.organization||a.organization,email:r.email||a.email,avatarUrl:r.avatarUrl||r.avatar_url||a.avatarUrl,...r}}}),f=new Set,t=[];for(const a of n){const r=a.id||`${a.source}-${a.target}-${a.type}`;f.has(r)||(f.add(r),i.has(a.source)&&i.has(a.target)&&(k.set(r,a),t.push({id:r,relationship:a.type||a.label||"RELATED",color:"#9ca3af",source:a.source,target:a.target,visible:!0,data:{}})))}return{nodes:d,links:t}}function E(e,n){const i=new Set;n.forEach(p=>i.add(p.type||"Unknown")),e.innerHTML=Array.from(i).sort().map(p=>`
    <span class="graph-legend-item">
      <span class="graph-legend-dot" style="--legend-color: ${S[p]||"#6b7280"}"></span>
      ${p}
    </span>
  `).join("")}function M(e,n,i){if(!e)return;e.innerHTML="";const p=document.createElement("style");p.textContent=`
    .graph-node-tooltip {
      position: fixed;
      background: var(--bg-primary, #ffffff);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 10000;
      pointer-events: none;
      min-width: 220px;
      max-width: 300px;
      opacity: 0;
      transform: translateY(5px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .graph-node-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .graph-node-tooltip .tooltip-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .graph-node-tooltip .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--border-color, #e5e7eb);
      flex-shrink: 0;
    }
    .graph-node-tooltip .avatar-placeholder {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 18px;
      flex-shrink: 0;
    }
    .graph-node-tooltip .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .graph-node-tooltip .name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary, #1f2937);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .graph-node-tooltip .role {
      font-size: 12px;
      color: var(--text-muted, #6b7280);
    }
    .graph-node-tooltip .org {
      font-size: 11px;
      color: var(--text-tertiary, #9ca3af);
    }
    .graph-node-tooltip .email {
      font-size: 11px;
      color: var(--primary, #6366f1);
      margin-top: 4px;
    }
    .graph-node-tooltip .node-type {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-secondary, #f3f4f6);
      color: var(--text-muted, #6b7280);
      text-transform: uppercase;
    }
  `,e.appendChild(p);const d=document.createElement("div");d.className="graph-node-tooltip",d.id="graph-tooltip",e.appendChild(d),window.__graphNodeData=n.reduce((f,t)=>(f[t.id]={id:t.id,name:t.name||t.properties?.name||t.properties?.title||(t.properties?.content?String(t.properties.content).substring(0,50):void 0),type:t.type||t.label,avatarUrl:t.avatarUrl||t.properties?.avatar_url||t.properties?.avatarUrl,role:t.role||t.properties?.role,organization:t.organization||t.properties?.organization,email:t.email||t.properties?.email,content:t.properties?.content,status:t.properties?.status,severity:t.properties?.severity},f),{})}function z(e,n,i,p){const d=p?.querySelector("#graph-tooltip");if(!d)return;const t=window.__graphNodeData?.[e.id]||{name:e.name||e.properties?.name,type:e.type||e.label,avatarUrl:e.avatarUrl||e.properties?.avatar_url,role:e.role||e.properties?.role,organization:e.organization||e.properties?.organization,email:e.email||e.properties?.email},a=t.type||"Unknown",r=a==="Contact"||a==="Person",u=(t.name||"?").split(" ").map(g=>g[0]).join("").substring(0,2).toUpperCase();let h="";r&&(t.avatarUrl?h=`<img class="avatar" src="${t.avatarUrl}" alt="${t.name}" onerror="this.outerHTML='<div class=\\'avatar-placeholder\\'>${u}</div>'"/>`:h=`<div class="avatar-placeholder">${u}</div>`);let s="";r?s=`
      ${h}
      <div class="info">
        <span class="name">${t.name||"Unknown"}</span>
        ${t.role?`<span class="role">${t.role}</span>`:""}
        ${t.organization?`<span class="org">${t.organization}</span>`:""}
        ${t.email?`<span class="email">${t.email}</span>`:""}
      </div>
    `:s=`
      <div class="info">
        <span class="name">${t.name||t.content?.substring(0,100)||t.id}</span>
        ${t.status?`<span class="role">Status: ${t.status}</span>`:""}
        ${t.severity?`<span class="role">Severity: ${t.severity}</span>`:""}
      </div>
    `,d.innerHTML=`
    <span class="node-type">${a}</span>
    <div class="tooltip-content">
      ${s}
    </div>
  `;const c=15,v=window.innerWidth,m=window.innerHeight;d.style.left="-9999px",d.classList.add("visible");const y=d.getBoundingClientRect();let o=n+c,l=i-y.height/2;o+y.width>v-c&&(o=n-y.width-c),l<c&&(l=c),l+y.height>m-c&&(l=m-y.height-c),d.style.left=`${o}px`,d.style.top=`${l}px`}function _(e){const n=e?.querySelector("#graph-tooltip");n&&n.classList.remove("visible")}export{U as createGraphCanvas};
//# sourceMappingURL=GraphCanvas-DnG4DQXQ.js.map
