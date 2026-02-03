import{c as $,_ as L,t as x,g as N,o as b}from"./index-K2FceEuD.js";const S={Person:"#6366f1",Organization:"#8b5cf6",Project:"#10b981",Meeting:"#f59e0b",Document:"#3b82f6",Fact:"#22c55e",Decision:"#06b6d4",Risk:"#ef4444",Task:"#14b8a6",Question:"#f97316",Technology:"#eab308",Client:"#ec4899",Team:"#84cc16",Regulation:"#a3a3a3",Answer:"#22d3ee",Email:"#60a5fa",Conversation:"#c084fc",Action:"#4ade80",Briefing:"#fbbf24"};let w=new Map,k=new Map;function H(e={}){const n=$("div",{className:"graph-canvas-container"});return n.innerHTML=`
    <div class="graph-canvas-wrapper" style="position: relative; width: 100%; height: ${e.height||500}px;">
      <div class="graph-canvas-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div class="loading-spinner"></div>
        <p style="color: var(--text-muted); font-size: 14px;">Loading graph data...</p>
      </div>
      <falkordb-canvas id="graph-canvas" style="width: 100%; height: 100%;"></falkordb-canvas>
      <div class="graph-avatar-overlay" id="avatar-overlay"></div>
    </div>
    <div class="graph-canvas-controls" style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
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
    <div class="graph-canvas-legend" style="margin-top: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
      <h5 style="margin: 0 0 8px 0; font-size: 12px; color: var(--text-muted);">Legend</h5>
      <div id="gc-legend" style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px;">
        <!-- Legend items will be added dynamically -->
      </div>
    </div>
  `,setTimeout(()=>C(n,e),100),n}async function C(e,n){try{await L(()=>import("./index-BbbQFNXm.js"),[])}catch(i){console.error("[GraphCanvas] Failed to load @falkordb/canvas:",i),x.error("Failed to load graph visualization library");return}const o=e.querySelector("#graph-canvas"),p=e.querySelector(".graph-canvas-loading"),d=e.querySelector("#gc-legend"),h=e.querySelector("#avatar-overlay");if(!o){console.error("[GraphCanvas] Canvas element not found");return}const t=e.querySelector(".graph-canvas-wrapper"),a=t.clientWidth||800,r=t.clientHeight||500,u=document.documentElement.getAttribute("data-theme")==="dark",f=u?"#1a1a2e":"#ffffff",s=u?"#e5e7eb":"#1f2937";o.setWidth(a),o.setHeight(r),o.setBackgroundColor(f),o.setForegroundColor(s),o.setIsLoading(!0),o.setConfig({onNodeClick:(i,l)=>{const g=w.get(String(i.id));g&&(z(g,l.clientX,l.clientY,h),n.onNodeClick&&n.onNodeClick(g))},onNodeHover:(i,l)=>{if(i&&l?.clientX!==void 0&&l?.clientY!==void 0){const g=w.get(String(i.id));g&&z(g,l.clientX,l.clientY,h)}else i||_(h)},onNodeRightClick:(i,l)=>{l.preventDefault();const g=w.get(String(i.id));g&&n.onNodeRightClick&&n.onNodeRightClick(g)},onLinkClick:i=>{const l=k.get(String(i.id));l&&n.onLinkClick&&n.onLinkClick(l)},onEngineStop:()=>{}});try{const i=await N.getVisualizationData({limit:500});if(i.nodes.length===0){p.innerHTML=`
        <div style="text-align: center;">
          <p style="color: var(--text-muted);">No graph data available</p>
          <button class="btn btn-primary btn-sm" id="gc-sync">Sync Data</button>
        </div>
      `,o.setIsLoading(!1);const g=p.querySelector("#gc-sync");g&&b(g,"click",async()=>{x.info("Syncing data..."),await fetch("/api/graph/sync",{method:"POST"}),x.success("Sync complete. Reloading..."),C(e,n)});return}const l=T(i.nodes,i.edges);D(d,i.nodes),o.setData(l),o.setIsLoading(!1),p.style.display="none",M(h,i.nodes,o),setTimeout(()=>o.zoomToFit(1.2),1e3),console.log(`[GraphCanvas] Loaded ${i.nodes.length} nodes and ${i.edges.length} edges`),n.onDataLoaded?.({nodeCount:i.nodes.length,edgeCount:i.edges.length})}catch(i){console.error("[GraphCanvas] Error loading data:",i),p.innerHTML='<p style="color: var(--error);">Failed to load graph data</p>',o.setIsLoading(!1)}const c=e.querySelector("#gc-zoom-in"),v=e.querySelector("#gc-zoom-out"),m=e.querySelector("#gc-fit"),y=e.querySelector("#gc-refresh");c&&b(c,"click",()=>{const i=o.getZoom?.()||1;o.zoom?.(i*1.2)}),v&&b(v,"click",()=>{const i=o.getZoom?.()||1;o.zoom?.(i/1.2)}),m&&b(m,"click",()=>{o.zoomToFit?.(1.2)}),y&&b(y,"click",async()=>{x.info("Refreshing graph..."),p.style.display="flex",o.setIsLoading(!0),await C(e,n),x.success("Graph refreshed")})}function T(e,n){w.clear(),k.clear();const o=new Set,d=e.filter(a=>o.has(a.id)?!1:(o.add(a.id),!0)).map(a=>{w.set(a.id,a);const r=a.properties||{},u=a.name||r.name||r.title||(r.content?String(r.content).substring(0,30):null)||a.label||a.id;let f=String(u);const s=a.type||a.label||"Unknown";if(s==="Contact"||s==="Person"){const v=r.role||a.role,m=r.organization||a.organization;v?f=`${u}
(${v})`:m&&(f=`${u}
(${m})`)}if((s==="Decision"||s==="Risk")&&f.length>40&&(f=f.substring(0,37)+"..."),s==="Fact"){const v=r.content||r.text;v&&(f=String(v).substring(0,35)+(String(v).length>35?"...":""))}let c=6;return s==="Contact"||s==="Person"?c=10:s==="Team"?c=9:s==="Meeting"?c=8:(s==="Decision"||s==="Risk")&&(c=7),{id:a.id,labels:[s],color:S[s]||"#6b7280",visible:!0,size:c,caption:"name",data:{name:f,type:s,originalName:String(u),role:r.role||a.role,organization:r.organization||a.organization,email:r.email||a.email,avatarUrl:r.avatarUrl||r.avatar_url||a.avatarUrl,...r}}}),h=new Set,t=[];for(const a of n){const r=a.id||`${a.source}-${a.target}-${a.type}`;h.has(r)||(h.add(r),o.has(a.source)&&o.has(a.target)&&(k.set(r,a),t.push({id:r,relationship:a.type||a.label||"RELATED",color:"#9ca3af",source:a.source,target:a.target,visible:!0,data:{}})))}return{nodes:d,links:t}}function D(e,n){const o=new Set;n.forEach(p=>o.add(p.type||"Unknown")),e.innerHTML=Array.from(o).sort().map(p=>`
    <span style="display: inline-flex; align-items: center; gap: 4px;">
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${S[p]||"#6b7280"}"></span>
      ${p}
    </span>
  `).join("")}function M(e,n,o){if(!e)return;e.innerHTML="",e.style.cssText=`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  `;const p=document.createElement("style");p.textContent=`
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
  `,e.appendChild(p);const d=document.createElement("div");d.className="graph-node-tooltip",d.id="graph-tooltip",e.appendChild(d),window.__graphNodeData=n.reduce((h,t)=>(h[t.id]={id:t.id,name:t.name||t.properties?.name||t.properties?.title||t.properties?.content?.substring(0,50),type:t.type||t.label,avatarUrl:t.avatarUrl||t.properties?.avatar_url||t.properties?.avatarUrl,role:t.role||t.properties?.role,organization:t.organization||t.properties?.organization,email:t.email||t.properties?.email,content:t.properties?.content,status:t.properties?.status,severity:t.properties?.severity},h),{})}function z(e,n,o,p){const d=p?.querySelector("#graph-tooltip");if(!d)return;const t=window.__graphNodeData?.[e.id]||{name:e.name||e.properties?.name,type:e.type||e.label,avatarUrl:e.avatarUrl||e.properties?.avatar_url,role:e.role||e.properties?.role,organization:e.organization||e.properties?.organization,email:e.email||e.properties?.email},a=t.type||"Unknown",r=a==="Contact"||a==="Person",u=(t.name||"?").split(" ").map(g=>g[0]).join("").substring(0,2).toUpperCase();let f="";r&&(t.avatarUrl?f=`<img class="avatar" src="${t.avatarUrl}" alt="${t.name}" onerror="this.outerHTML='<div class=\\'avatar-placeholder\\'>${u}</div>'"/>`:f=`<div class="avatar-placeholder">${u}</div>`);let s="";r?s=`
      ${f}
      <div class="info">
        <span class="name">${t.name||"Unknown"}</span>
        ${t.role?`<span class="role">${t.role}</span>`:""}
        ${t.organization?`<span class="org">${t.organization}</span>`:""}
        ${t.email?`<span class="email">${t.email}</span>`:""}
      </div>
    `:s=`
      <div class="info" style="width: 100%;">
        <span class="name">${t.name||t.content?.substring(0,100)||t.id}</span>
        ${t.status?`<span class="role">Status: ${t.status}</span>`:""}
        ${t.severity?`<span class="role">Severity: ${t.severity}</span>`:""}
      </div>
    `,d.innerHTML=`
    <span class="node-type">${a}</span>
    <div class="tooltip-content">
      ${s}
    </div>
  `;const c=15,v=window.innerWidth,m=window.innerHeight;d.style.left="-9999px",d.classList.add("visible");const y=d.getBoundingClientRect();let i=n+c,l=o-y.height/2;i+y.width>v-c&&(i=n-y.width-c),l<c&&(l=c),l+y.height>m-c&&(l=m-y.height-c),d.style.left=`${i}px`,d.style.top=`${l}px`}function _(e){const n=e?.querySelector("#graph-tooltip");n&&n.classList.remove("visible")}export{H as createGraphCanvas};
//# sourceMappingURL=GraphCanvas-D8w1lHmC.js.map
