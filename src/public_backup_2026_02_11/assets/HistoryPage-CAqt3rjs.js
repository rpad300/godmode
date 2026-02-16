import{m as g,t as f,c as b,o as c,h as T,f as $}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let p=[],d=1,u=!0,y=!1,n={action:"",entityType:"",dateFrom:"",dateTo:""};function H(t={}){const e=b("div",{className:"history-panel"});return e.innerHTML=`
    <div class="history-filters">
      <select id="history-action-filter" class="filter-select">
        <option value="">All Actions</option>
        <option value="create">Created</option>
        <option value="update">Updated</option>
        <option value="delete">Deleted</option>
        <option value="restore">Restored</option>
        <option value="process">Processed</option>
        <option value="upload">Uploaded</option>
      </select>
      <select id="history-entity-filter" class="filter-select">
        <option value="">All Types</option>
        <option value="document">Documents</option>
        <option value="fact">Facts</option>
        <option value="question">Questions</option>
        <option value="risk">Risks</option>
        <option value="action">Actions</option>
        <option value="decision">Decisions</option>
        <option value="contact">Contacts</option>
        <option value="email">Emails</option>
      </select>
      <input type="date" id="history-date-from" class="filter-date" placeholder="From">
      <input type="date" id="history-date-to" class="filter-date" placeholder="To">
      <button class="btn btn-sm" id="history-clear-filters">Clear</button>
    </div>
    <div class="history-content" id="history-content">
      <div class="loading">Loading history...</div>
    </div>
  `,S(e,t),h(e,t),e}function S(t,e){const i=t.querySelector("#history-action-filter"),a=t.querySelector("#history-entity-filter"),o=t.querySelector("#history-date-from"),s=t.querySelector("#history-date-to"),r=t.querySelector("#history-clear-filters"),l=()=>{n={action:i.value,entityType:a.value,dateFrom:o.value,dateTo:s.value},p=[],d=1,u=!0,h(t,e)};c(i,"change",l),c(a,"change",l),c(o,"change",l),c(s,"change",l),c(r,"click",()=>{i.value="",a.value="",o.value="",s.value="",l()})}async function h(t,e){if(y)return;const i=t.querySelector("#history-content");d===1&&(i.innerHTML='<div class="loading">Loading history...</div>'),y=!0;try{const a=new URLSearchParams({page:String(d),limit:"30"});n.action&&a.set("action",n.action),n.entityType&&a.set("entityType",n.entityType),n.dateFrom&&a.set("dateFrom",n.dateFrom),n.dateTo&&a.set("dateTo",n.dateTo);const o=await T.get(`/api/history?${a}`);p=d===1?o.data.entries:[...p,...o.data.entries],u=o.data.hasMore,d++,w(i,e)}catch{d===1&&(i.innerHTML='<div class="error">Failed to load history</div>')}finally{y=!1}}function w(t,e){if(p.length===0){t.innerHTML=`
      <div class="empty-state">
        <span class="empty-icon">📜</span>
        <p>No history entries found</p>
        <span class="empty-hint">Processing and editing activity will appear here</span>
      </div>
    `;return}const i=D(p);t.innerHTML=`
    <div class="history-timeline">
      ${Object.entries(i).map(([o,s])=>`
        <div class="history-date-group">
          <div class="history-date-header">${o}</div>
          <div class="history-items">
            ${s.map(r=>F(r,e)).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    ${u?`
      <div class="history-load-more">
        <button class="btn btn-secondary" id="load-more-history">Load More</button>
      </div>
    `:`
      <div class="history-end">
        <span>End of history</span>
      </div>
    `}
  `;const a=t.querySelector("#load-more-history");a&&c(a,"click",async()=>{const o=t.closest(".history-panel");await h(o,e)}),t.querySelectorAll('[data-action="expand"]').forEach(o=>{c(o,"click",()=>{const s=o.closest(".history-entry")?.querySelector(".history-changes");s&&(s.classList.toggle("expanded"),o.textContent=s.classList.contains("expanded")?"Hide details":"Show details")})}),e.onRestore&&t.querySelectorAll('[data-action="restore"]').forEach(o=>{c(o,"click",()=>{const s=o.getAttribute("data-entry-id"),r=p.find(l=>l.id===s);r&&e.onRestore&&e.onRestore(r)})})}function F(t,e){const i={create:"➕",update:"✏️",delete:"🗑️",restore:"↩️",process:"⚙️",upload:"📤"},a={create:"success",update:"info",delete:"danger",restore:"warning",process:"info",upload:"success"},o=t.changes&&Object.keys(t.changes).length>0;return`
    <div class="history-entry ${a[t.action]||"info"}" data-entry-id="${t.id}">
      <div class="history-icon">${i[t.action]||"📝"}</div>
      <div class="history-content">
        <div class="history-summary">
          <strong>${v(t.actor.name)}</strong>
          ${L(t.action)}
          <span class="entity-type">${t.entityType}</span>
          ${t.entityName?`"${v(t.entityName)}"`:""}
        </div>
        <div class="history-time">${$(t.timestamp)}</div>
        
        ${o?`
          <div class="history-changes">
            ${Object.entries(t.changes).slice(0,5).map(([s,r])=>`
              <div class="change-item">
                <span class="change-field">${R(s)}:</span>
                <span class="change-old">${m(r.old)}</span>
                <span class="change-arrow">→</span>
                <span class="change-new">${m(r.new)}</span>
              </div>
            `).join("")}
            ${Object.keys(t.changes).length>5?`<div class="change-more">+${Object.keys(t.changes).length-5} more changes</div>`:""}
          </div>
          <button class="btn-link" data-action="expand">Show details</button>
        `:""}
        
        ${t.action==="delete"&&e.onRestore?`
          <button class="btn btn-sm btn-secondary" data-action="restore" data-entry-id="${t.id}">
            Restore
          </button>
        `:""}
      </div>
    </div>
  `}function L(t){return{create:"created",update:"updated",delete:"deleted",restore:"restored",process:"processed",upload:"uploaded"}[t]||t}function D(t){const e={},i=new Date().toDateString(),a=new Date(Date.now()-864e5).toDateString();return t.forEach(o=>{const s=new Date(o.timestamp);let r;s.toDateString()===i?r="Today":s.toDateString()===a?r="Yesterday":r=s.toLocaleDateString(void 0,{weekday:"long",month:"long",day:"numeric"}),e[r]||(e[r]=[]),e[r].push(o)}),e}function R(t){return t.replace(/_/g," ").replace(/([A-Z])/g," $1").replace(/^./,e=>e.toUpperCase())}function m(t){if(t==null)return"(empty)";if(typeof t=="boolean")return t?"Yes":"No";if(typeof t=="object"){const i=JSON.stringify(t);return i.length>50?i.substring(0,47)+"...":i}const e=String(t);return e.length>50?e.substring(0,47)+"...":e}function v(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}async function x(t="json"){try{const e=new URLSearchParams({format:t,limit:"1000"});n.action&&e.set("action",n.action),n.entityType&&e.set("entityType",n.entityType),n.dateFrom&&e.set("dateFrom",n.dateFrom),n.dateTo&&e.set("dateTo",n.dateTo);const a=await(await g(`/api/history/export?${e}`)).blob(),o=URL.createObjectURL(a),s=document.createElement("a");s.href=o,s.download=`history-export.${t}`,document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(o),f.success("History exported successfully")}catch{f.error("Failed to export history")}}export{H as createHistoryPanel,x as exportHistory};
//# sourceMappingURL=HistoryPage-CAqt3rjs.js.map
