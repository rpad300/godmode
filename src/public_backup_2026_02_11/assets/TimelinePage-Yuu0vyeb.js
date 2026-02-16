import{c as $,o as u,I as C,J as k,f as q,p as A}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const T={document:{label:"Documents",icon:"📄",color:"#1abc9c"},transcript:{label:"Transcripts",icon:"🎙️",color:"#8b5cf6"},email:{label:"Emails",icon:"📧",color:"#6366f1"},conversation:{label:"Conversations",icon:"💬",color:"#ec4899"},chat_session:{label:"Chat Sessions",icon:"🤖",color:"#0ea5e9"},fact:{label:"Facts",icon:"📌",color:"#3b82f6"},question:{label:"Questions",icon:"❓",color:"#f59e0b"},question_answered:{label:"Answered",icon:"✅",color:"#10b981"},decision:{label:"Decisions",icon:"📋",color:"#3498db"},risk:{label:"Risks",icon:"⚠️",color:"#f39c12"},action:{label:"Actions",icon:"📌",color:"#9b59b6"},action_completed:{label:"Completed",icon:"✅",color:"#2ecc71"},deadline:{label:"Deadlines",icon:"📅",color:"#9b59b6"}},x=[{label:"Last 7 days",days:7},{label:"Last 14 days",days:14},{label:"Last 30 days",days:30},{label:"Last 90 days",days:90},{label:"All time",days:365}];let g=30,f="comfortable",d=[],y="",p=[],v=-1;function z(t={}){const n=$("div",{className:"timeline-panel sot-panel"});return n.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Timeline</h2>
        <span class="panel-count" id="timeline-count">0</span>
      </div>
      <div class="panel-actions">
        <div class="timeline-search-wrapper">
          <input type="text" id="timeline-search" class="timeline-search" placeholder="Search events..." />
        </div>
        <select id="timeline-period" class="filter-select">
          ${x.map(e=>`<option value="${e.days}" ${e.days===g?"selected":""}>${e.label}</option>`).join("")}
        </select>
        <div class="density-toggle" title="View density">
          <button class="density-btn ${f==="compact"?"active":""}" data-density="compact" title="Compact">━</button>
          <button class="density-btn ${f==="comfortable"?"active":""}" data-density="comfortable" title="Comfortable">≡</button>
          <button class="density-btn ${f==="spacious"?"active":""}" data-density="spacious" title="Spacious">☰</button>
        </div>
        <div class="timeline-actions-menu">
          <button class="btn btn-secondary btn-sm timeline-export-btn" title="Export">📥</button>
        </div>
      </div>
    </div>
    <div class="timeline-filters" id="timeline-type-filters">
      <button class="filter-chip active" data-type="">All</button>
    </div>
    <div class="timeline-content" id="timeline-content">
      ${E()}
    </div>
    <div class="timeline-footer hidden" id="timeline-footer">
      <button class="btn btn-secondary btn-sm" id="timeline-load-more">Load more</button>
    </div>
  `,j(n,t),S(n,t),n}function j(t,n){const e=t.querySelector("#timeline-period");u(e,"change",()=>{g=parseInt(e.value),S(t,n)});const s=t.querySelectorAll(".density-btn");s.forEach(o=>{u(o,"click",()=>{s.forEach(a=>a.classList.remove("active")),o.classList.add("active"),f=o.getAttribute("data-density"),F(t)})});const c=t.querySelector("#timeline-search");let l;u(c,"input",()=>{clearTimeout(l),l=setTimeout(()=>{y=c.value.toLowerCase(),b(t,n)},200)});const i=t.querySelector(".timeline-export-btn");i&&u(i,"click",()=>N(t)),u(t,"keydown",o=>{t.querySelector("#timeline-content")&&(o.key==="j"||o.key==="ArrowDown"?(o.preventDefault(),w(t,1)):o.key==="k"||o.key==="ArrowUp"?(o.preventDefault(),w(t,-1)):o.key==="Enter"?(o.preventDefault(),B(t)):o.key==="/"?(o.preventDefault(),c.focus()):o.key==="Escape"&&(c.blur(),v=-1,L(t)))}),t.setAttribute("tabindex","0")}async function S(t,n){const e=t.querySelector("#timeline-content");e.innerHTML=E();try{const s=new Date,c=new Date;c.setDate(c.getDate()-g),p=(await C({startDate:c.toISOString().split("T")[0],endDate:s.toISOString().split("T")[0],limit:500})).events||[],D(t,p),b(t,n),R(t,p.length)}catch(s){console.error("Failed to load timeline:",s),e.innerHTML=M()}}function b(t,n){let e=[...p];d.length>0&&(e=e.filter(i=>d.includes(i.type))),y&&(e=e.filter(i=>{const o=(i.title||"").toLowerCase(),a=(i.content||i.description||"").toLowerCase(),r=(i.owner||i.user||i.actor||"").toLowerCase();return o.includes(y)||a.includes(y)||r.includes(y)}));const s=t.querySelector("#timeline-content");if(e.length===0){s.innerHTML=I();return}const c=V(e),l=new Date().toISOString().split("T")[0];s.innerHTML=`
    <div class="timeline-list density-${f}">
      ${Object.entries(c).map(([i,o])=>`
        <div class="timeline-day" data-date="${i}">
          <div class="timeline-date-header sticky">
            <span class="date-label">${_(i)}</span>
            <span class="event-count">${o.length} event${o.length===1?"":"s"}</span>
          </div>
          ${i===l?'<div class="today-marker"><span>Today</span></div>':""}
          <div class="timeline-day-events">
            ${o.map((a,r)=>O(a,r)).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `,H(t,e,n),v=-1}function O(t,n){const e=T[t.type]||{label:t.type,icon:"📎",color:"#888"},s=t.icon||e.icon,c=t.color||e.color,l=t.owner||t.user||t.actor,i=l?J(l):"",o=t.status?`<span class="status-badge status-${t.status}">${t.status}</span>`:"",a=t.date?P(t.date):"",r=t.date?q(t.date):"",m=t.date?A(t.date):"";return`
    <div class="timeline-event" data-id="${t.id}" data-index="${n}" tabindex="0">
      <div class="event-avatar" style="--event-color: ${c}">
        ${i||s}
      </div>
      <div class="event-body">
        <div class="event-header">
          <span class="event-type-badge" style="--event-color: ${c}">
            <span class="type-icon">${s}</span>
            ${e.label}
          </span>
          ${o}
          <span class="event-time" title="${m}">${r}</span>
        </div>
        <div class="event-title">${h(t.title)}</div>
        ${t.content||t.description?`<div class="event-content">${h(Y(t.content||t.description||"",150))}</div>`:""}
        ${l?`<div class="event-owner"><span class="owner-name">by ${h(l)}</span></div>`:""}
      </div>
      <div class="event-meta">
        <span class="meta-time">${a}</span>
      </div>
    </div>
  `}function E(){return`
    <div class="timeline-skeletons">
      ${Array(8).fill(0).map(()=>`
        <div class="skeleton-event">
          <div class="skeleton-avatar shimmer"></div>
          <div class="skeleton-body">
            <div class="skeleton-line short shimmer"></div>
            <div class="skeleton-line long shimmer"></div>
            <div class="skeleton-line medium shimmer"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `}function I(){return`
    <div class="timeline-empty">
      <div class="empty-illustration">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="var(--bg-card)" stroke="var(--border)" stroke-width="2"/>
          <path d="M60 30V60L80 75" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="60" cy="60" r="6" fill="var(--accent)"/>
        </svg>
      </div>
      <h3>No events found</h3>
      <p>Try adjusting your filters or date range</p>
      <div class="empty-actions">
        <button class="btn btn-primary btn-sm" id="empty-clear-filters">Clear Filters</button>
      </div>
    </div>
  `}function M(){return`
    <div class="timeline-error">
      <div class="error-icon">⚠️</div>
      <h3>Failed to load timeline</h3>
      <p>Please try again later</p>
      <button class="btn btn-primary btn-sm" id="timeline-retry">Retry</button>
    </div>
  `}function D(t,n){const e={};n.forEach(i=>{e[i.type]=(e[i.type]||0)+1});const s=t.querySelector("#timeline-type-filters"),c=Object.keys(e).filter(i=>e[i]>0);s.innerHTML=`
    <button class="filter-chip ${d.length===0?"active":""}" data-type="">All (${n.length})</button>
    ${c.map(i=>{const o=T[i]||{label:i,icon:"📎",color:"#888"};return`
        <button class="filter-chip ${d.includes(i)?"active":""}" data-type="${i}" style="--chip-color: ${o.color}">
          ${o.icon} ${o.label} (${e[i]})
        </button>
      `}).join("")}
  `;const l=s.querySelectorAll(".filter-chip");l.forEach(i=>{u(i,"click",()=>{const o=i.getAttribute("data-type")||"";if(!o)d=[],l.forEach(a=>a.classList.remove("active")),i.classList.add("active");else{const a=s.querySelector('[data-type=""]');a?.classList.remove("active"),d.includes(o)?(d=d.filter(r=>r!==o),i.classList.remove("active")):(d.push(o),i.classList.add("active")),d.length===0&&a?.classList.add("active")}b(t,{})})})}function H(t,n,e){t.querySelectorAll(".timeline-event").forEach(i=>{u(i,"click",()=>{const o=i.getAttribute("data-id"),a=n.find(r=>String(r.id)===o);a&&e.onEventClick&&e.onEventClick(a)})});const c=t.querySelector("#empty-clear-filters");c&&u(c,"click",()=>{d=[],y="";const i=t.querySelector("#timeline-search");i&&(i.value=""),D(t,p),b(t,e)});const l=t.querySelector("#timeline-retry");l&&u(l,"click",()=>S(t,e))}function w(t,n,e){const s=t.querySelectorAll(".timeline-event");if(s.length===0)return;L(t),v=Math.max(0,Math.min(s.length-1,v+n));const c=s[v];c&&(c.classList.add("focused"),c.scrollIntoView({behavior:"smooth",block:"nearest"}),c.focus())}function B(t,n){const e=t.querySelectorAll(".timeline-event");v>=0&&v<e.length&&e[v].click()}function L(t){t.querySelectorAll(".timeline-event.focused").forEach(n=>n.classList.remove("focused"))}function F(t){const n=t.querySelector(".timeline-list");n&&(n.className=`timeline-list density-${f}`)}function R(t,n){const e=t.querySelector("#timeline-count");e&&(e.textContent=String(n))}function N(t){const n=t.querySelector(".export-menu");if(n){n.remove();return}const e=$("div",{className:"export-menu dropdown-menu"});e.innerHTML=`
    <button class="dropdown-item" data-format="csv">📊 Export CSV</button>
    <button class="dropdown-item" data-format="json">📦 Export JSON</button>
  `;const s=t.querySelector(".timeline-export-btn");s&&s.appendChild(e),e.querySelectorAll(".dropdown-item").forEach(c=>{u(c,"click",()=>{const l=c.getAttribute("data-format");U(l||"csv"),e.remove()})}),setTimeout(()=>{const c=l=>{e.contains(l.target)||(e.remove(),document.removeEventListener("click",c))};document.addEventListener("click",c)},0)}function U(t){const n=p.map(a=>({date:a.date,type:a.type,title:a.title,content:a.content||a.description,owner:a.owner||a.user||a.actor,status:a.status}));let e,s,c;if(t==="csv"){const a=["Date","Type","Title","Content","Owner","Status"],r=n.map(m=>[m.date,m.type,`"${(m.title||"").replace(/"/g,'""')}"`,`"${(m.content||"").replace(/"/g,'""')}"`,`"${(m.owner||"").replace(/"/g,'""')}"`,m.status||""].join(","));e=[a.join(","),...r].join(`
`),s=`timeline-${new Date().toISOString().split("T")[0]}.csv`,c="text/csv"}else e=JSON.stringify(n,null,2),s=`timeline-${new Date().toISOString().split("T")[0]}.json`,c="application/json";const l=new Blob([e],{type:c}),i=URL.createObjectURL(l),o=document.createElement("a");o.href=i,o.download=s,o.click(),URL.revokeObjectURL(i)}function V(t){const n={};return t.forEach(e=>{const s=e.date?e.date.split("T")[0]:"unknown";n[s]||(n[s]=[]),n[s].push(e)}),Object.fromEntries(Object.entries(n).sort(([e],[s])=>s.localeCompare(e)))}function _(t){const n=new Date(t+"T00:00:00"),e=new Date,s=new Date(e);s.setDate(s.getDate()-1);const c=new Date(e);c.setDate(e.getDate()-e.getDay());const l=e.toISOString().split("T")[0],i=s.toISOString().split("T")[0];return t===l?"Today":t===i?"Yesterday":n>=c?"This week - "+k(n,{weekday:"long"}):k(n,{weekday:"short",month:"short",day:"numeric"})}function P(t){return new Date(t).toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit"})}function J(t){return t.split(/\s+/).map(n=>n.charAt(0).toUpperCase()).slice(0,2).join("")}function Y(t,n){return t.length<=n?t:t.slice(0,n-3)+"..."}function h(t){const n=document.createElement("div");return n.textContent=t,n.innerHTML}export{z as createTimelinePanel};
//# sourceMappingURL=TimelinePage-Yuu0vyeb.js.map
