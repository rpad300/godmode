import{c as S,o as y,a as j,q as M,m as A,u as U,v as N,t as O,w as q,x as p,y as x}from"./main-v_cFye9p.js";import{b as H,f as _,a as E}from"./billing-CSo_L-5s.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let d=null;const L="costs-budget-modal";function et(e={}){const{period:t="month"}=e,a=S("div",{className:"costs-dashboard"});a.innerHTML=`
    <div class="costs-header">
      <div class="costs-header-title">
        <h3>LLM Costs</h3>
        <span class="costs-period-range" id="costs-period-range" aria-live="polite"></span>
      </div>
      <div class="costs-header-actions">
        <select id="costs-period" class="filter-select" aria-label="Time period">
          <option value="day" ${t==="day"?"selected":""}>Today</option>
          <option value="week" ${t==="week"?"selected":""}>This Week</option>
          <option value="month" ${t==="month"?"selected":""}>This Month</option>
          <option value="all" ${t==="all"?"selected":""}>All Time</option>
        </select>
        <button type="button" class="btn btn-secondary btn-sm" id="costs-export-btn" title="Export CSV or JSON">Export</button>
        <button type="button" class="btn btn-secondary btn-sm" id="costs-pricing-btn" title="View pricing table">Pricing</button>
        <button type="button" class="btn btn-secondary btn-sm" id="costs-budget-btn" title="Set budget and alert">Budget</button>
      </div>
    </div>
    <div class="costs-content" id="costs-content">
      <div class="loading">Loading costs...</div>
    </div>
    <div id="costs-pricing-panel" class="costs-pricing-panel hidden" aria-hidden="true"></div>
  `;const i=a.querySelector("#costs-period");y(i,"change",()=>{P(a,i.value)});const o=a.querySelector("#costs-export-btn");o&&y(o,"click",()=>J(i.value));const n=a.querySelector("#costs-pricing-btn"),r=a.querySelector("#costs-pricing-panel");n&&r&&y(n,"click",()=>V(r)),y(a,"click",v=>{v.target.id==="costs-pricing-close"&&(r?.classList.add("hidden"),r?.setAttribute("aria-hidden","true"))});const l=a.querySelector("#costs-budget-btn");return l&&y(l,"click",()=>W(a,i)),P(a,t),a}async function P(e,t){const a=e.querySelector("#costs-content");a.innerHTML='<div class="loading">Loading...</div>';try{const o=j.getState().currentProject?.id,[n,r,l]=await Promise.all([M.getSummary(t),M.getRecentRequests(20),o?H.getProjectBillingSummary(o):Promise.resolve(null)]);d=l,R(a,n,r);const v=e.querySelector("#costs-period-range");v&&(v.textContent=K(n.period??{start:"",end:""}))}catch{a.innerHTML='<div class="error">Failed to load costs</div>'}}function R(e,t,a=[]){const i=t.dailyBreakdown??[],o=t.byProvider??{},n=t.byModel??{},r=i.reduce((s,c)=>s+(c.calls??0),0),l=r>0?t.total/r:0,v=Object.entries(o).map(([s,c])=>({provider:s,cost:c})).sort((s,c)=>c.cost-s.cost),$=Object.entries(n).map(([s,c])=>({model:s,cost:c})).sort((s,c)=>c.cost-s.cost),m=new Map;for(const[s,c]of Object.entries(t.byOperation||{})){const B=s&&String(s).trim()?String(s).trim():"other";m.set(B,(m.get(B)??0)+c)}const w=Array.from(m.entries()).map(([s,c])=>({operation:s,cost:c})).sort((s,c)=>c.cost-s.cost),u=Object.entries(t.byContext||{}).map(([s,c])=>({context:s==="unknown"||!s?.trim()?"Other":s,cost:c})).sort((s,c)=>c.cost-s.cost),b=t.totalInputTokens??0,k=t.totalOutputTokens??0,f=(t.total??0)===0&&i.length===0&&Object.keys(o).length===0&&Object.keys(n).length===0,h=t.previousPeriodCost!=null&&t.percentChange!=null?`<div class="card-sub period-change ${t.percentChange>=0?"up":"down"}">vs previous period: ${t.percentChange>=0?"+":""}${t.percentChange.toFixed(1)}%</div>`:"",C=t.budgetLimit!=null&&t.budgetUsedPercent!=null?`
    <div class="costs-budget-bar ${t.budgetAlertTriggered?"alert":""}">
      <div class="costs-budget-bar-fill" style="--budget-width: ${Math.min(100,t.budgetUsedPercent)}%"></div>
      <span class="costs-budget-label">${p(t.total)} / ${p(t.budgetLimit)} (${t.budgetUsedPercent}%)</span>
      ${t.budgetAlertTriggered?'<span class="costs-budget-alert">Alert threshold reached</span>':""}
    </div>`:f?"":'<div class="costs-budget-bar costs-budget-bar-empty"><span class="costs-budget-label">No budget set</span><span class="costs-budget-set-hint">Use the Budget button above to set a limit.</span></div>',T=f?'<div class="costs-empty-state">No cost data for this period. LLM usage from Chat, document processing, and other features will appear here.</div>':"";let D="";if(d){const s=d.unlimited_balance?'<span class="costs-unlimited">∞ Unlimited</span>':_(d.balance_eur),c=d.unlimited_balance?'<span class="badge badge-success costs-badge-sm">Unlimited</span>':d.balance_eur<=0?'<span class="badge badge-danger costs-badge-sm">Blocked</span>':d.balance_percent_used>=80?'<span class="badge badge-warning costs-badge-sm">Low Balance</span>':'<span class="badge badge-primary costs-badge-sm">Active</span>';D=`
      <div class="billing-summary-banner">
        <div class="billing-summary-row">
          <div>
            <div class="billing-summary-label">Project Balance</div>
            <div class="billing-summary-value">${s}</div>
          </div>
          <div>
            <div class="billing-summary-label">Status</div>
            <div>${c}</div>
          </div>
          ${d.current_tier_name?`
          <div>
            <div class="billing-summary-label">Current Tier</div>
            <div class="billing-summary-tier">${d.current_tier_name} (+${d.current_markup_percent}%)</div>
          </div>
          `:""}
        </div>
        <div class="billing-summary-meta">
          <div>
            <strong>${E(d.tokens_this_period)}</strong> tokens this period
          </div>
          <div>
            <strong>${_(d.billable_cost_this_period)}</strong> billed (${d.period_key})
          </div>
        </div>
      </div>
    `}e.innerHTML=`
    ${D}
    <div class="costs-dashboard-row">
      <div class="costs-stats-grid stats-grid">
        <div class="costs-stat-card stat-card" data-stat-id="cost-total">
          <div class="stat-value">${p(t.total)}</div>
          <div class="stat-label">Total Cost</div>
          ${h}
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-calls">
          <div class="stat-value">${x(r)}</div>
          <div class="stat-label">API Calls</div>
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-avg">
          <div class="stat-value">${p(l)}</div>
          <div class="stat-label">Avg per Call</div>
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-input">
          <div class="stat-value">${x(b)}</div>
          <div class="stat-label">Input Tokens</div>
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-output">
          <div class="stat-value">${x(k)}</div>
          <div class="stat-label">Output Tokens</div>
        </div>
      </div>
    </div>
    ${C}
    ${T}

    <div class="costs-chart-section chart-container">
      <h4 class="costs-chart-title">Daily Costs</h4>
      <div class="costs-chart-inner">
        ${G(i,t.period??{})}
      </div>
    </div>

    <div class="costs-breakdown">
      <div class="breakdown-section">
        <h4>By Provider</h4>
        <div class="breakdown-list">
          ${v.length>0?v.map(s=>`
            <div class="breakdown-item">
              <span class="item-name">${g(s.provider)}</span>
              <span class="item-value">${p(s.cost)}</span>
            </div>
          `).join(""):'<div class="empty">No data</div>'}
        </div>
      </div>

      <div class="breakdown-section">
        <h4>By Model</h4>
        <div class="breakdown-list">
          ${$.length>0?$.map(s=>`
            <div class="breakdown-item">
              <span class="item-name">${g(s.model)}</span>
              <span class="item-value">${p(s.cost)}</span>
            </div>
          `).join(""):'<div class="empty">No data</div>'}
        </div>
      </div>

      <div class="breakdown-section">
        <h4>By Operation</h4>
        <div class="breakdown-list">
          ${w.length>0?w.map(s=>`
            <div class="breakdown-item">
              <span class="item-name">${g(s.operation)}</span>
              <span class="item-value">${p(s.cost)}</span>
            </div>
          `).join(""):'<div class="empty">No data</div>'}
        </div>
      </div>

      ${u.length>0?`
      <div class="breakdown-section">
        <h4>By Context</h4>
        <div class="breakdown-list">
          ${u.map(s=>`
            <div class="breakdown-item">
              <span class="item-name">${g(s.context)}</span>
              <span class="item-value">${p(s.cost)}</span>
            </div>
          `).join("")}
        </div>
      </div>
      `:""}
    </div>

    <div class="costs-recent-section">
      <h4>Recent Requests <span class="costs-recent-caption">(last 20, all time)</span></h4>
      ${F(a)}
    </div>
  `}function F(e){return e.length?`
    <div class="costs-recent-table-wrap">
      <table class="costs-recent-table" aria-label="Recent LLM requests">
        <thead>
          <tr>
            <th>Time</th>
            <th>Provider / Model</th>
            <th>Operation</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          ${e.slice(0,20).map(t=>`
            <tr>
              <td>${I(t.timestamp)}</td>
              <td>${g(t.provider)} / ${g(t.model)}</td>
              <td>${g(t.request_type||t.operation||"—")}</td>
              <td>${t.input_tokens??0}+${t.output_tokens??0}</td>
              <td>${t.cost!=null?p(t.cost):"—"}</td>
              <td>${t.latency_ms!=null?`${t.latency_ms}ms`:"—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `:'<div class="empty-recent">No recent requests</div>'}function I(e){const t=new Date(e),i=new Date().getTime()-t.getTime();return i<6e4?"Just now":i<36e5?`${Math.floor(i/6e4)}m ago`:i<864e5?`${Math.floor(i/36e5)}h ago`:t.toLocaleDateString(void 0,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}async function J(e){const t=window.confirm(`Download as JSON?

Cancel = CSV, OK = JSON`)?"json":"csv",a=t==="json"?"json":"csv",i=`/api/costs/export?period=${e}&format=${t}`;try{const o=await A(i);if(!o.ok)throw new Error(o.statusText);const n=await o.blob(),r=`llm-costs-${e}-${new Date().toISOString().split("T")[0]}.${a}`,l=document.createElement("a");l.href=URL.createObjectURL(n),l.download=r,l.click(),URL.revokeObjectURL(l.href)}catch(o){console.error("Export failed:",o),alert("Export failed. Try again.")}}async function V(e){if(e.classList.contains("hidden")&&!e.innerHTML.trim()){e.innerHTML='<div class="loading">Loading pricing...</div>',e.classList.remove("hidden"),e.setAttribute("aria-hidden","false");try{const a=await M.getPricing();e.innerHTML=Y(a)}catch{e.innerHTML='<div class="error">Failed to load pricing</div>'}}else e.classList.toggle("hidden"),e.setAttribute("aria-hidden",String(e.classList.contains("hidden")))}async function W(e,t){const a=t.value,i=a==="week"?"week":"month",o=document.querySelector(`[data-modal-id="${L}"]`);o&&o.remove();let n=100,r=80;try{const b=await M.getBudget(i);b?.limitUsd!=null&&b.limitUsd>0&&(n=b.limitUsd),b?.alertThresholdPercent!=null&&(r=Math.min(100,Math.max(0,b.alertThresholdPercent)))}catch{}const l=S("div",{className:"costs-budget-modal-body"});l.innerHTML=`
    <p class="costs-budget-modal-desc">Set a ${i}ly spending limit and get an alert when usage reaches a percentage of that limit.</p>
    <div class="form-group">
      <label for="costs-budget-limit">Budget limit (USD)</label>
      <input type="number" id="costs-budget-limit" class="form-input" min="1" max="999999" step="0.01" value="${n}" placeholder="e.g. 100" aria-label="Budget limit in USD">
      <span class="form-hint">Min 1 USD</span>
    </div>
    <div class="form-group">
      <label for="costs-budget-threshold">Alert when usage reaches (%)</label>
      <input type="number" id="costs-budget-threshold" class="form-input" min="0" max="100" value="${r}" placeholder="e.g. 80" aria-label="Alert threshold percentage">
      <span class="form-hint">0–100%</span>
    </div>
    <p class="costs-budget-modal-hint" role="status">You will be notified when LLM costs reach this percentage of your budget.</p>
  `;const v=S("div",{className:"modal-footer"}),$=S("button",{className:"btn btn-secondary",textContent:"Cancel"}),m=S("button",{className:"btn btn-primary",textContent:"Save budget"}),w=U({id:L,title:`Set ${i==="week"?"weekly":"monthly"} budget`,content:l,size:"md",closable:!0,footer:v});w.classList.add("costs-budget-modal");const u=l.querySelector(".costs-budget-modal-hint");y($,"click",()=>N(L)),y(m,"click",async()=>{const b=l.querySelector("#costs-budget-limit"),k=l.querySelector("#costs-budget-threshold"),f=b?parseFloat(b.value):NaN,h=k!=null?parseInt(k.value,10):NaN,C=Number.isFinite(h)?Math.min(100,Math.max(0,h)):80;if(u.textContent="You will be notified when LLM costs reach this percentage of your budget.",!Number.isFinite(f)||f<1){u.textContent="Enter a valid budget (min 1 USD).",u.classList.add("costs-budget-modal-hint-error"),b?.focus();return}if(!Number.isFinite(h)||h<0||h>100){u.textContent="Alert threshold must be between 0 and 100%.",u.classList.add("costs-budget-modal-hint-error"),k?.focus();return}u.classList.remove("costs-budget-modal-hint-error"),m.setAttribute("disabled","true"),m.textContent="Saving…";try{await M.setBudget(i,f,C),N(L),P(e,t.value),O.success("Budget saved")}catch(T){console.error("Set budget failed:",T),u.textContent="Failed to save. Please try again.",u.classList.add("costs-budget-modal-hint-error"),O.error("Failed to save budget")}finally{m.removeAttribute("disabled"),m.textContent="Save budget"}}),v.append($,m),document.body.appendChild(w),q(L)}function Y(e){return e.length?`
    <div class="costs-pricing-header">
      <h4>Model pricing (USD per 1M tokens)</h4>
      <button type="button" class="btn btn-sm" id="costs-pricing-close" aria-label="Close">×</button>
    </div>
    <div class="costs-pricing-table-wrap">
      <table class="costs-pricing-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Input</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
          ${e.map(t=>`
            <tr>
              <td>${g(t.model)}</td>
              <td>$${t.inputPer1M.toFixed(2)}</td>
              <td>$${t.outputPer1M.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `:'<div class="empty">No pricing data</div>'}function z(e){const a=[],i=new Date;for(let o=13;o>=0;o--){const n=new Date(i);n.setDate(n.getDate()-o),a.push({date:n.toISOString().split("T")[0],cost:0,calls:0})}return a}function G(e,t){const a=e.length>0?e:z(),i=Math.max(1e-9,...a.map(n=>n.cost)),o=e.length===0;return`
    <div class="daily-chart">
      <div class="chart-bars">
        ${a.map(n=>{const r=i>0?Math.max(2,n.cost/i*100):2;return`
            <div class="bar-column" title="${n.date}: ${p(n.cost)} (${n.calls} calls)">
              <div class="bar ${o&&n.cost===0?"bar-placeholder":""}" style="--bar-height: ${r}%"></div>
              <div class="bar-label">${Q(n.date)}</div>
            </div>
          `}).join("")}
      </div>
      ${o?'<p class="chart-placeholder-hint">No cost data for this period. Usage will appear here as you use LLM features.</p>':""}
    </div>
  `}function K(e){if(!e.start||!e.end)return"All time";const t=new Date(e.start),a=new Date(e.end),i=o=>o.toLocaleDateString(void 0,{month:"short",day:"numeric"});return`${i(t)} - ${i(a)}`}function Q(e){return new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"})}function g(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}export{et as createCostsDashboard};
//# sourceMappingURL=CostsPage-D9rKbbMY.js.map
