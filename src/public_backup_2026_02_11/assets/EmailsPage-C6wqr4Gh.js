const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/EmailComposer-K6OuUU6Q.js","assets/main-v_cFye9p.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/main-Cr-TCRi2.css"])))=>i.map(i=>d[i]);
import{f as w,c as k,o as m,_ as E,e as b,t as g,s as _}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function f(e,i){const n=document.querySelector(".email-preview-overlay");n&&n.remove();const t=e.extracted_entities,c=t&&(t.key_points?.length||t.action_items?.length||t.entities?.length),l=document.createElement("div");l.className="email-preview-modal",l.innerHTML=`
    <style>
      .email-preview-modal {
        display: flex;
        flex-direction: column;
        height: 80vh;
        max-height: 800px;
        width: 900px;
        max-width: 95vw;
      }
      .email-preview-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
      }
      .email-preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
        flex-shrink: 0;
      }
      .email-preview-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
        line-height: 1.3;
      }
      .email-preview-meta {
        font-size: 13px;
        color: var(--text-secondary);
      }
      .email-preview-meta-row {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
      }
      .email-preview-meta-label {
        color: var(--text-tertiary);
        min-width: 40px;
      }
      .email-preview-badges {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .email-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }
      .email-badge.intent {
        background: rgba(var(--primary-rgb), 0.1);
        color: var(--primary);
      }
      .email-badge.sentiment-positive {
        background: rgba(46, 160, 67, 0.1);
        color: #2ea043;
      }
      .email-badge.sentiment-negative {
        background: rgba(248, 81, 73, 0.1);
        color: #f85149;
      }
      .email-badge.sentiment-neutral {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
      }
      .email-badge.response-needed {
        background: rgba(248, 81, 73, 0.1);
        color: #f85149;
      }
      .email-preview-tabs {
        display: flex;
        gap: 4px;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .email-preview-tab {
        padding: 12px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.15s ease;
      }
      .email-preview-tab:hover {
        color: var(--text-primary);
      }
      .email-preview-tab.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .email-preview-tab-badge {
        background: var(--bg-tertiary);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        margin-left: 6px;
      }
      .email-preview-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .email-preview-section {
        display: none;
      }
      .email-preview-section.active {
        display: block;
      }
      .email-content-body {
        background: var(--bg-secondary);
        padding: 20px;
        border-radius: 12px;
        line-height: 1.7;
      }
      .extraction-card {
        padding: 12px 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .extraction-type {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .extraction-content {
        color: var(--text-primary);
      }
      .extraction-meta {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 4px;
      }
      .section-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 12px;
        text-transform: uppercase;
      }
      .empty-section {
        text-align: center;
        padding: 40px;
        color: var(--text-tertiary);
      }
      .ai-summary-box {
        padding: 16px;
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
        border-left: 3px solid var(--primary);
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .ai-summary-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      .key-points-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .key-points-list li {
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        gap: 8px;
      }
      .key-points-list li:last-child {
        border-bottom: none;
      }
      .key-points-list li::before {
        content: "•";
        color: var(--primary);
      }
      .contact-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .contact-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .contact-info {
        flex: 1;
      }
      .contact-name {
        font-weight: 600;
      }
      .contact-details {
        font-size: 12px;
        color: var(--text-secondary);
      }
    </style>
    
    <div class="email-preview-header">
      <div class="email-preview-icon">📧</div>
      <div class="email-preview-header-fill">
        <h2 class="email-preview-title">${s(e.subject||"No Subject")}</h2>
        <div class="email-preview-meta">
          <div class="email-preview-meta-row">
            <span class="email-preview-meta-label">From:</span>
            <span><strong>${s(e.from?.name||"")}</strong> &lt;${s(e.from?.email||"")}&gt;</span>
          </div>
          <div class="email-preview-meta-row">
            <span class="email-preview-meta-label">To:</span>
            <span>${(e.to||[]).map(a=>s(a.name||a.email)).join(", ")}</span>
          </div>
          <div class="email-preview-meta-row">
            <span class="email-preview-meta-label">Date:</span>
            <span>${w(e.date)}</span>
          </div>
        </div>
        <div class="email-preview-badges">
          ${t?.intent?`<span class="email-badge intent">📋 ${s(t.intent)}</span>`:""}
          ${t?.sentiment?`<span class="email-badge sentiment-${t.sentiment}">${S(t.sentiment)} ${s(t.sentiment)}</span>`:""}
          ${e.requires_response?'<span class="email-badge response-needed">⚠️ Response Needed</span>':""}
        </div>
      </div>
      <button class="btn btn-sm email-preview-close-btn">×</button>
    </div>
    
    <div class="email-preview-tabs">
      <button class="email-preview-tab active" data-tab="content">Content</button>
      <button class="email-preview-tab ${c?"":"hidden"}" data-tab="analysis">
        Analysis
      </button>
      <button class="email-preview-tab ${t?.entities?.length?"":"hidden"}" data-tab="entities">
        Entities
        <span class="email-preview-tab-badge">${t?.entities?.length||0}</span>
      </button>
      <button class="email-preview-tab ${t?.contacts?.length?"":"hidden"}" data-tab="contacts">
        Contacts
        <span class="email-preview-tab-badge">${t?.contacts?.length||0}</span>
      </button>
    </div>
    
    <div class="email-preview-body">
      <div class="email-preview-section active" data-section="content">
        ${t?.summary||e.ai_summary?`
          <div class="ai-summary-box">
            <div class="ai-summary-label">🤖 AI Summary</div>
            <div>${s(t?.summary||e.ai_summary||"")}</div>
          </div>
        `:""}
        <div class="email-content-body">
          ${e.body_html||s(e.body||"").replace(/\n/g,"<br>")}
        </div>
      </div>
      
      <div class="email-preview-section" data-section="analysis">
        ${t?.key_points?.length?`
          <div class="section-title">Key Points</div>
          <ul class="key-points-list">
            ${t.key_points.map(a=>`<li>${s(a)}</li>`).join("")}
          </ul>
        `:""}
        
        ${t?.action_items?.length?`
          <div class="section-title section-title-mt">Action Items</div>
          ${t.action_items.map(a=>`
            <div class="extraction-card">
              <div class="extraction-content">☐ ${s(a.task)}</div>
              ${a.owner?`<div class="extraction-meta">Owner: ${s(a.owner)}</div>`:""}
            </div>
          `).join("")}
        `:""}
        
        ${t?.questions?.length?`
          <div class="section-title section-title-mt">Questions</div>
          ${t.questions.map(a=>`
            <div class="extraction-card">
              <div class="extraction-content">❓ ${s(a)}</div>
            </div>
          `).join("")}
        `:""}
        
        ${!t?.key_points?.length&&!t?.action_items?.length&&!t?.questions?.length?`
          <div class="empty-section">No analysis available</div>
        `:""}
      </div>
      
      <div class="email-preview-section" data-section="entities">
        ${t?.entities?.length?t.entities.map(a=>`
          <div class="extraction-card">
            <div class="extraction-type">${s(a.type)}</div>
            <div class="extraction-content">${s(a.name)}</div>
            ${a.confidence?`<div class="extraction-meta">Confidence: ${Math.round(a.confidence*100)}%</div>`:""}
          </div>
        `).join(""):'<div class="empty-section">No entities extracted</div>'}
      </div>
      
      <div class="email-preview-section" data-section="contacts">
        ${t?.contacts?.length?t.contacts.map(a=>`
          <div class="contact-card">
            <div class="contact-avatar">${C(a.name)}</div>
            <div class="contact-info">
              <div class="contact-name">${s(a.name)}</div>
              <div class="contact-details">
                ${a.title?s(a.title)+(a.organization?" at ":""):""}
                ${a.organization?s(a.organization):""}
                ${a.email?`<br>${s(a.email)}`:""}
              </div>
            </div>
          </div>
        `).join(""):'<div class="empty-section">No contacts extracted</div>'}
      </div>
    </div>
  `,l.querySelectorAll(".email-preview-tab").forEach(a=>{a.addEventListener("click",()=>{const u=a.dataset.tab;l.querySelectorAll(".email-preview-tab").forEach(p=>p.classList.remove("active")),a.classList.add("active"),l.querySelectorAll(".email-preview-section").forEach(p=>p.classList.remove("active")),l.querySelector(`[data-section="${u}"]`)?.classList.add("active")})}),l.querySelector(".close-btn")?.addEventListener("click",()=>{o.remove()});const o=document.createElement("div");o.className="modal-overlay overlay-preview email-preview-overlay";const r=document.createElement("div");r.className="modal-preview-box",r.appendChild(l),o.appendChild(r),o.addEventListener("click",a=>{a.target===o&&o.remove()});const d=a=>{a.key==="Escape"&&(o.remove(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),document.body.appendChild(o)}function S(e){switch(e?.toLowerCase()){case"positive":return"😊";case"negative":return"😟";default:return"😐"}}function C(e){return e.split(" ").map(i=>i[0]).slice(0,2).join("").toUpperCase()}function s(e){const i=document.createElement("div");return i.textContent=e,i.innerHTML}let y="all",h=!1;function z(e={}){const i=k("div",{className:"emails-panel"});i.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Emails</h2>
        <span class="panel-count" id="emails-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="direction-filter" class="filter-select">
          <option value="all">All</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="internal">Internal</option>
        </select>
        <label class="checkbox-label">
          <input type="checkbox" id="needs-response-filter"> Needs Response
        </label>
        <button class="btn btn-primary btn-sm" id="add-email-btn">+ Add Email</button>
      </div>
    </div>
    <div class="panel-content" id="emails-content">
      <div class="loading">Loading emails...</div>
    </div>
  `;const n=i.querySelector("#direction-filter");m(n,"change",()=>{y=n.value,v(i,e)});const t=i.querySelector("#needs-response-filter");m(t,"change",()=>{h=t.checked,v(i,e)});const c=i.querySelector("#add-email-btn");return c&&m(c,"click",async()=>{const{createEmailComposer:l,showEmailComposer:o}=await E(async()=>{const{createEmailComposer:r,showEmailComposer:d}=await import("./EmailComposer-K6OuUU6Q.js");return{createEmailComposer:r,showEmailComposer:d}},__vite__mapDeps([0,1,2,3]));o({onSave:()=>v(i,e)})}),v(i,e),i}async function v(e,i){const n=e.querySelector("#emails-content");n.innerHTML='<div class="loading">Loading...</div>';try{let t;h?t=await b.getNeedingResponse():t=(await b.getAll({direction:y==="all"?void 0:y})).emails,L(n,t,i),R(e,t.length)}catch{n.innerHTML='<div class="error">Failed to load emails</div>'}}function L(e,i,n){if(i.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No emails found</p>
      </div>
    `;return}e.innerHTML=`
    <div class="emails-list">
      ${i.map(t=>q(t)).join("")}
    </div>
  `,e.querySelectorAll(".email-card").forEach(t=>{m(t,"click",async o=>{if(o.target.closest(".email-actions"))return;const r=t.getAttribute("data-id"),d=i.find(a=>String(a.id)===r);if(d){try{const a=await b.getById(r);f(a)}catch{f(d)}n.onEmailClick&&n.onEmailClick(d)}});const c=t.querySelector(".mark-responded-btn");c&&m(c,"click",async o=>{o.stopPropagation();const r=t.getAttribute("data-id");if(r)try{await b.markResponded(r),g.success("Marked as responded"),v(e.closest(".emails-panel"),n)}catch{g.error("Failed to update email")}});const l=t.querySelector(".generate-response-btn");l&&m(l,"click",async o=>{o.stopPropagation();const r=t.getAttribute("data-id");if(!r)return;const d=l;d.disabled=!0,d.textContent="Generating...";try{const u=(await b.generateResponse(r))[0]?.response||"";g.success("Response generated");const p=i.find($=>String($.id)===r);p&&(p.draft_response=u,_({mode:"view",email:p}))}catch{g.error("Failed to generate response")}finally{d.disabled=!1,d.textContent="AI Response"}})})}function q(e){const i=e.direction==="inbound"?"📥":e.direction==="outbound"?"📤":"🔄",n=e.requires_response&&!e.response_sent;return`
    <div class="email-card ${n?"needs-response":""}" data-id="${e.id}">
      <div class="email-direction">${i}</div>
      <div class="email-info">
        <div class="email-header">
          <span class="email-from">${x(e.from_name||e.from_email||e.from||"")}</span>
          <span class="email-date">${w(e.created_at||e.date||new Date().toISOString())}</span>
        </div>
        <div class="email-subject">${x(e.subject||"(No subject)")}</div>
        <div class="email-preview">${x(A(e.body_text||""))}</div>
      </div>
      <div class="email-badges">
        ${n?'<span class="needs-response-badge">Needs Response</span>':""}
        ${e.response_drafted?'<span class="draft-badge">Draft Ready</span>':""}
        ${e.response_sent?'<span class="responded-badge">Responded</span>':""}
        ${e.ai_summary?'<span class="ai-badge">AI Analyzed</span>':""}
      </div>
      <div class="email-actions">
        ${n?`
          <button class="btn btn-sm generate-response-btn">AI Response</button>
          <button class="btn btn-sm mark-responded-btn">Mark Responded</button>
        `:""}
      </div>
    </div>
  `}function A(e,i=100){const n=e.replace(/\s+/g," ").trim();return n.length>i?n.slice(0,i)+"...":n}function R(e,i){const n=e.querySelector("#emails-count");n&&(n.textContent=String(i))}function x(e){const i=document.createElement("div");return i.textContent=e,i.innerHTML}export{z as createEmailsPanel};
//# sourceMappingURL=EmailsPage-C6wqr4Gh.js.map
