import{c as p,o as h,i as w,g as v}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function m(){return window.vis}function M(r={}){const t=p("div",{className:"org-chart"});t.innerHTML=`
    <div class="chart-toolbar">
      <button class="btn btn-sm" id="fit-chart-btn">Fit</button>
      <button class="btn btn-sm" id="refresh-chart-btn">Refresh</button>
    </div>
    <div class="chart-container" id="org-chart-container">
      <div class="loading">Loading org chart...</div>
    </div>
  `;const n=t.querySelector("#fit-chart-btn");n&&h(n,"click",()=>{t._network?.fit()});const i=t.querySelector("#refresh-chart-btn");return i&&h(i,"click",()=>g(t,r)),g(t,r),t}async function g(r,t){const n=r.querySelector("#org-chart-container");n.innerHTML='<div class="loading">Loading...</div>';try{const{contacts:i}=await w.getAll({});if(i.length===0){n.innerHTML=`
        <div class="empty-state">
          <p>No contacts to display</p>
        </div>
      `;return}const{nodes:e,edges:o}=k(i);if(!m()){y(n,i,t);return}S(n,e,o,i,t)}catch{n.innerHTML='<div class="error">Failed to load org chart</div>'}}function k(r){const t=[],n=[],i=new Map;return r.forEach(e=>{const o=e.relationships?.find(s=>s.type==="reports_to");if(o){const s=i.get(o.contactId)||0;i.set(String(e.id),s+1)}else i.set(String(e.id),0)}),r.forEach(e=>{t.push({id:String(e.id),label:e.name,title:`${e.name}${e.role?`
${e.role}`:""}${e.organization?`
${e.organization}`:""}`,level:i.get(String(e.id))||0,color:e.teams?.[0]?.color})}),r.forEach(e=>{e.relationships?.forEach(o=>{o.type==="reports_to"&&n.push({from:o.contactId,to:String(e.id),arrows:"to"})})}),{nodes:t,edges:n}}function S(r,t,n,i,e){r.innerHTML="";const o=t.map(a=>({id:a.id,label:a.label,title:a.title,level:a.level,color:{background:a.color||"#6366f1",border:a.color||"#4f46e5",highlight:{background:"#818cf8",border:"#6366f1"}},font:{color:"#ffffff"},shape:"box",margin:10})),s={layout:{hierarchical:{direction:"UD",sortMethod:"directed",levelSeparation:100,nodeSpacing:150}},nodes:{borderWidth:2,shadow:!0},edges:{color:{color:"#9ca3af",highlight:"#6366f1"},width:2,smooth:{type:"cubicBezier"}},physics:!1,interaction:{hover:!0,tooltipDelay:200}},d=m(),c=new d.Network(r,{nodes:new d.DataSet(o),edges:new d.DataSet(n)},s);r.closest(".org-chart")._network=c,c.on("click",a=>{if(a.nodes.length>0){const b=a.nodes[0],l=i.find(u=>String(u.id)===b);l&&(e.onNodeClick?e.onNodeClick(l):v({mode:"view",contact:l}))}}),c.fit()}function y(r,t,n){const i={};t.forEach(e=>{const o=e.organization||"Other";i[o]||(i[o]=[]),i[o].push(e)}),r.innerHTML=`
    <div class="fallback-org-chart">
      ${Object.entries(i).map(([e,o])=>`
        <div class="org-group">
          <h4 class="org-name">${f(e)}</h4>
          <div class="org-members">
            ${o.map(s=>`
              <div class="org-member" data-id="${s.id}">
                <div class="member-avatar">${$(s.name)}</div>
                <div class="member-info">
                  <div class="member-name">${f(s.name)}</div>
                  ${s.role?`<div class="member-role">${f(s.role)}</div>`:""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `,r.querySelectorAll(".org-member").forEach(e=>{h(e,"click",()=>{const o=e.getAttribute("data-id"),s=t.find(d=>String(d.id)===o);s&&(n.onNodeClick?n.onNodeClick(s):v({mode:"view",contact:s}))})})}function $(r){return r.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function f(r){const t=document.createElement("div");return t.textContent=r,t.innerHTML}export{M as createOrgChart};
//# sourceMappingURL=OrgChartPage-CHL2JSo3.js.map
