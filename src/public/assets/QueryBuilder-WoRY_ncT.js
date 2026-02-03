import{c as M,o as n,g as p,t as y}from"./index-B9P9I_3p.js";function U(e={}){const t={query:e.initialQuery||`// Enter your Cypher query here
MATCH (n) RETURN n LIMIT 10`,results:null,history:[],templates:[],isLoading:!1,activeTab:"editor",resultsView:"table"},r=M("div",{className:"query-builder"});return r.innerHTML=`
    <div class="query-builder-layout">
      <div class="query-sidebar">
        <div class="sidebar-tabs">
          <button class="sidebar-tab active" data-tab="templates">Templates</button>
          <button class="sidebar-tab" data-tab="history">History</button>
        </div>
        <div class="sidebar-content" id="query-sidebar-content">
          <div class="loading-state">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
      
      <div class="query-main">
        <div class="query-editor-area">
          <div class="editor-toolbar">
            <div class="editor-toolbar-left">
              <span class="editor-label">Cypher Query</span>
            </div>
            <div class="editor-toolbar-right">
              <button class="editor-btn" id="btn-format" title="Format Query">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="21" y1="10" x2="3" y2="10"/>
                  <line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="14" x2="3" y2="14"/>
                  <line x1="21" y1="18" x2="3" y2="18"/>
                </svg>
              </button>
              <button class="editor-btn" id="btn-clear" title="Clear">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              <button class="editor-btn" id="btn-ai-generate" title="Generate with AI">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                AI Generate
              </button>
            </div>
          </div>
          <div class="editor-container">
            <textarea
              id="cypher-editor"
              class="cypher-editor"
              spellcheck="false"
              placeholder="MATCH (n) RETURN n LIMIT 10"
            >${o(t.query)}</textarea>
            <div class="editor-line-numbers" id="line-numbers"></div>
          </div>
          <div class="editor-actions">
            <button class="btn btn-primary" id="btn-execute">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Execute
            </button>
            <button class="btn btn-secondary" id="btn-explain">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Explain
            </button>
            <button class="btn btn-secondary" id="btn-save">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save
            </button>
          </div>
        </div>
        
        <div class="query-results-area">
          <div class="results-header">
            <div class="results-tabs">
              <button class="results-tab active" data-view="table">Table</button>
              <button class="results-tab" data-view="json">JSON</button>
            </div>
            <div class="results-info" id="results-info">
              <!-- Results count and timing -->
            </div>
          </div>
          <div class="results-content" id="results-content">
            <div class="results-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <p>Execute a query to see results</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- AI Generate Modal -->
    <div class="modal-overlay hidden" id="ai-modal">
      <div class="modal ai-generate-modal">
        <div class="modal-header">
          <h3>Generate Query with AI</h3>
          <button class="modal-close" id="ai-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <label class="form-label">Describe what you want to query in natural language:</label>
          <textarea
            id="ai-prompt"
            class="form-textarea"
            placeholder="e.g., Find all people who work in the Engineering department and are connected to at least 3 projects"
            rows="3"
          ></textarea>
          <div class="ai-examples">
            <p class="examples-label">Examples:</p>
            <button class="example-chip" data-prompt="Show all people and their roles">People and roles</button>
            <button class="example-chip" data-prompt="Find the top 10 most connected nodes">Most connected</button>
            <button class="example-chip" data-prompt="Show decisions made in the last month">Recent decisions</button>
            <button class="example-chip" data-prompt="Find all risks with high severity">High-risk items</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="ai-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="ai-modal-generate">Generate Query</button>
        </div>
      </div>
    </div>
  `,A(r,t,e),r}async function A(e,t,r){const s=e.querySelector("#cypher-editor"),a=e.querySelector("#query-sidebar-content");v(e,s),n(s,"input",()=>{t.query=s.value,v(e,s)}),n(s,"scroll",()=>{const l=e.querySelector("#line-numbers");l&&(l.scrollTop=s.scrollTop)});const i=e.querySelectorAll(".sidebar-tab");i.forEach(l=>{n(l,"click",()=>{const d=l.getAttribute("data-tab");i.forEach(f=>f.classList.remove("active")),l.classList.add("active"),t.activeTab=d==="templates"?"templates":"history",C(a,t,s)})});const c=e.querySelectorAll(".results-tab");c.forEach(l=>{n(l,"click",()=>{const d=l.getAttribute("data-view");c.forEach(f=>f.classList.remove("active")),l.classList.add("active"),t.resultsView=d,t.results&&g(e,t)})});const u=e.querySelector("#btn-format");u&&n(u,"click",()=>{s.value=O(s.value),t.query=s.value,v(e,s)});const h=e.querySelector("#btn-clear");h&&n(h,"click",()=>{s.value="",t.query="",v(e,s)});const x=e.querySelector("#btn-ai-generate");x&&n(x,"click",()=>_(e));const q=e.querySelector("#btn-execute");q&&n(q,"click",()=>k(e,t,r));const w=e.querySelector("#btn-explain");w&&n(w,"click",()=>Q(e,t));const E=e.querySelector("#btn-save");E&&n(E,"click",()=>D(e,t));const b=e.querySelector("#ai-modal"),T=e.querySelector("#ai-modal-close"),S=e.querySelector("#ai-modal-cancel"),L=e.querySelector("#ai-modal-generate"),m=e.querySelector("#ai-prompt");T&&n(T,"click",()=>b?.classList.add("hidden")),S&&n(S,"click",()=>b?.classList.add("hidden")),L&&n(L,"click",async()=>{const l=m?.value.trim();l&&(await j(e,t,s,l),b?.classList.add("hidden"))}),e.querySelectorAll(".example-chip").forEach(l=>{n(l,"click",()=>{const d=l.getAttribute("data-prompt");d&&m&&(m.value=d)})}),await $(t),C(a,t,s),n(s,"keydown",l=>{const d=l;(d.ctrlKey||d.metaKey)&&d.key==="Enter"&&(d.preventDefault(),k(e,t,r))})}async function $(e){try{const[t,r]=await Promise.all([p.getQueryTemplates(),p.getQueryHistory({limit:20})]);e.templates=t,e.history=r}catch(t){console.error("[QueryBuilder] Failed to load sidebar data:",t)}}function C(e,t,r){t.activeTab==="templates"?H(e,t,r):I(e,t,r)}function H(e,t,r){if(t.templates.length===0){e.innerHTML=`
      <div class="empty-state-small">
        <p>No query templates available</p>
      </div>
    `;return}const s={};t.templates.forEach(a=>{const i=a.category||"General";s[i]||(s[i]=[]),s[i].push(a)}),e.innerHTML=Object.entries(s).map(([a,i])=>`
    <div class="template-category">
      <h4 class="category-title">${o(a)}</h4>
      ${i.map(c=>`
        <div class="template-item" data-cypher="${o(c.cypher)}" title="${o(c.description)}">
          <div class="template-name">${o(c.name)}</div>
          <div class="template-description">${o(c.description)}</div>
        </div>
      `).join("")}
    </div>
  `).join(""),e.querySelectorAll(".template-item").forEach(a=>{n(a,"click",()=>{const i=a.getAttribute("data-cypher");i&&(r.value=i,t.query=i,v(e.closest(".query-builder"),r))})})}function I(e,t,r){if(t.history.length===0){e.innerHTML=`
      <div class="empty-state-small">
        <p>No query history yet</p>
      </div>
    `;return}e.innerHTML=`
    <div class="history-list">
      ${t.history.map(s=>`
        <div class="history-item" data-query="${o(s.query_text)}">
          <div class="history-header">
            <span class="history-type">${s.query_type}</span>
            ${s.is_favorite?'<span class="history-favorite">★</span>':""}
            <span class="history-time">${G(s.created_at)}</span>
          </div>
          <div class="history-query">${o(s.query_text.substring(0,100))}${s.query_text.length>100?"...":""}</div>
          ${s.result_count!==void 0?`<div class="history-results">${s.result_count} results</div>`:""}
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".history-item").forEach(s=>{n(s,"click",()=>{const a=s.getAttribute("data-query");a&&(r.value=a,t.query=a,v(e.closest(".query-builder"),r))})})}async function k(e,t,r){const s=t.query.trim();if(!s||t.isLoading)return;t.isLoading=!0;const a=e.querySelector("#btn-execute"),i=e.querySelector("#results-info");a&&a.classList.add("loading"),i&&(i.innerHTML='<span class="loading-text">Executing...</span>');const c=Date.now();try{const u=await p.executeCypher(s),h=Date.now()-c;t.results=u,t.results.executionTimeMs=h,i&&(u.ok?i.innerHTML=`
          <span class="results-count">${u.results.length} row${u.results.length!==1?"s":""}</span>
          <span class="results-time">${h}ms</span>
        `:i.innerHTML='<span class="results-error">Error</span>'),g(e,t),await p.saveQueryHistory({query_type:"cypher",query_text:s,result_count:u.results.length,execution_time_ms:h,is_favorite:!1}),r.onExecute?.(s,u)}catch(u){t.results={ok:!1,results:[],error:u instanceof Error?u.message:"Query failed"},g(e,t),y.error("Query failed")}t.isLoading=!1,a&&a.classList.remove("loading")}function g(e,t){const r=e.querySelector("#results-content");if(!(!r||!t.results)){if(!t.results.ok){r.innerHTML=`
      <div class="results-error-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>${o(t.results.error||"Query failed")}</p>
      </div>
    `;return}if(t.results.results.length===0){r.innerHTML=`
      <div class="results-empty">
        <p>Query returned no results</p>
      </div>
    `;return}t.resultsView==="table"?N(r,t.results):R(r,t.results)}}function N(e,t){const r=t.columns||Object.keys(t.results[0]||{});e.innerHTML=`
    <div class="results-table-wrapper">
      <table class="results-table">
        <thead>
          <tr>
            <th class="row-num">#</th>
            ${r.map(s=>`<th>${o(s)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${t.results.map((s,a)=>`
            <tr>
              <td class="row-num">${a+1}</td>
              ${r.map(i=>`<td>${B(s[i])}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function R(e,t){e.innerHTML=`
    <div class="results-json-wrapper">
      <pre class="results-json">${o(JSON.stringify(t.results,null,2))}</pre>
    </div>
  `}async function Q(e,t){const r=t.query.trim();if(r){y.info("Generating explanation...");try{const s=await p.query(`Explain this Cypher query: ${r}`);y.success(s.answer.substring(0,200))}catch{y.error("Failed to explain query")}}}async function D(e,t){const r=t.query.trim();if(!r)return;const s=prompt("Enter a name for this query:");if(s)try{await p.saveQueryHistory({query_type:"cypher",query_text:r,query_name:s,is_favorite:!0}),y.success("Query saved");const a=await p.getQueryHistory({limit:20});t.history=a}catch{y.error("Failed to save query")}}function _(e){const t=e.querySelector("#ai-modal");if(t){t.classList.remove("hidden");const r=t.querySelector("textarea");r&&r.focus()}}async function j(e,t,r,s){y.info("Generating query...");try{let i=(await p.query(`Generate a Cypher query for: ${s}. Return only the Cypher code, no explanation.`)).answer;const c=i.match(/```(?:cypher)?\s*([\s\S]*?)```/);c&&(i=c[1].trim()),r.value=i,t.query=i,v(e,r),y.success("Query generated")}catch{y.error("Failed to generate query")}}function v(e,t){const r=e.querySelector("#line-numbers");if(!r)return;const s=t.value.split(`
`).length;r.innerHTML=Array.from({length:s},(a,i)=>`<div>${i+1}</div>`).join("")}function O(e){const t=["MATCH","WHERE","RETURN","WITH","ORDER BY","LIMIT","SKIP","CREATE","DELETE","SET","REMOVE","MERGE","CALL","YIELD","UNWIND","UNION","OPTIONAL MATCH","DETACH DELETE","AS","AND","OR","NOT","IN","CONTAINS","STARTS WITH","ENDS WITH","IS NULL","IS NOT NULL","DESC","ASC"];let r=e;return t.forEach(a=>{const i=new RegExp(`\\b${a}\\b`,"gi");r=r.replace(i,a)}),["MATCH","OPTIONAL MATCH","WHERE","WITH","RETURN","ORDER BY","LIMIT","CREATE","DELETE","SET","MERGE","CALL","UNION"].forEach(a=>{const i=new RegExp(`\\b(${a})\\b`,"g");r=r.replace(i,`
$1`)}),r.trim()}function B(e){if(e==null)return'<span class="null-value">null</span>';if(typeof e=="object"){if(Array.isArray(e))return`<span class="array-value">[${e.length} items]</span>`;const t=e;return t.name||t.label?o(String(t.name||t.label)):'<span class="object-value">{...}</span>'}return typeof e=="boolean"?`<span class="boolean-value">${e}</span>`:typeof e=="number"?`<span class="number-value">${e}</span>`:o(String(e))}function G(e){const t=new Date(e),s=new Date().getTime()-t.getTime();return s<6e4?"just now":s<36e5?`${Math.floor(s/6e4)}m ago`:s<864e5?`${Math.floor(s/36e5)}h ago`:t.toLocaleDateString()}function o(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}export{U as createQueryBuilder};
//# sourceMappingURL=QueryBuilder-WoRY_ncT.js.map
