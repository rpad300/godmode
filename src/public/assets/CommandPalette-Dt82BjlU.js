import{c as b,o as d}from"./index-B9P9I_3p.js";const u=[{id:"go-explorer",label:"Go to Explorer",category:"Navigation",icon:"🔍",shortcut:"1"},{id:"go-ontology",label:"Go to Ontology",category:"Navigation",icon:"📚",shortcut:"2"},{id:"go-query",label:"Go to Query Builder",category:"Navigation",icon:"💻",shortcut:"3"},{id:"go-analytics",label:"Go to Analytics",category:"Navigation",icon:"📊",shortcut:"4"},{id:"fit-view",label:"Fit Graph to View",category:"Graph",icon:"⬜",keywords:["zoom","fit","center"]},{id:"find-paths",label:"Find Paths Between Nodes",category:"Graph",icon:"🔗",keywords:["path","connection","route"]},{id:"detect-communities",label:"Detect Communities",category:"Graph",icon:"🎯",keywords:["cluster","group"]},{id:"export-graph",label:"Export Graph",category:"Graph",icon:"📤",keywords:["download","save","export"]},{id:"create-snapshot",label:"Create Snapshot",category:"Graph",icon:"📸",keywords:["save","backup","snapshot"]},{id:"filter-people",label:"Show Only People",category:"Filter",icon:"👥",keywords:["person","people","filter"]},{id:"filter-projects",label:"Show Only Projects",category:"Filter",icon:"📁",keywords:["project","filter"]},{id:"filter-decisions",label:"Show Only Decisions",category:"Filter",icon:"✅",keywords:["decision","filter"]},{id:"filter-risks",label:"Show Only Risks",category:"Filter",icon:"⚠️",keywords:["risk","filter"]},{id:"clear-filters",label:"Clear All Filters",category:"Filter",icon:"🔄",keywords:["reset","clear"]},{id:"ai-copilot",label:"Open AI Copilot",category:"AI",icon:"🤖",shortcut:"C"},{id:"ai-insights",label:"Generate AI Insights",category:"AI",icon:"💡",keywords:["insight","analysis"]},{id:"ai-summarize",label:"Summarize Selection",category:"AI",icon:"📝",keywords:["summary","summarize"]},{id:"ai-explain",label:"Explain Connection",category:"AI",icon:"❓",keywords:["explain","why"]},{id:"new-query",label:"New Cypher Query",category:"Query",icon:"➕",keywords:["query","cypher","new"]},{id:"query-history",label:"View Query History",category:"Query",icon:"📜",keywords:["history","past"]},{id:"query-templates",label:"Browse Query Templates",category:"Query",icon:"📋",keywords:["template","pattern"]},{id:"toggle-theme",label:"Toggle Dark/Light Mode",category:"Settings",icon:"🌙",keywords:["theme","dark","light","mode"]},{id:"toggle-labels",label:"Toggle Node Labels",category:"Settings",icon:"🏷️",keywords:["label","text"]},{id:"toggle-physics",label:"Toggle Physics Simulation",category:"Settings",icon:"⚡",keywords:["physics","animation"]}];function m(o={}){const e=b("div",{className:"command-palette"});return e.innerHTML=`
    <div class="palette-search">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="palette-input" class="palette-input" placeholder="Type a command or search..." autofocus>
      <div class="palette-shortcut">
        <kbd>Esc</kbd> to close
      </div>
    </div>
    
    <div class="palette-results" id="palette-results">
      <!-- Results will be rendered here -->
    </div>
    
    <div class="palette-footer">
      <div class="footer-hint">
        <kbd>↑↓</kbd> to navigate
        <kbd>Enter</kbd> to select
      </div>
    </div>
  `,w(e,o),e}function w(o,e){const a=o.querySelector("#palette-input"),r=o.querySelector("#palette-results");let i=0,l=[...u];p(r,l,i,e),d(a,"input",()=>{const s=a.value.toLowerCase().trim();s?l=u.filter(t=>[t.label,t.description||"",t.category,...t.keywords||[]].join(" ").toLowerCase().includes(s)||k(s,t.label.toLowerCase())):l=[...u],i=0,p(r,l,i,e)}),d(a,"keydown",s=>{const t=s;switch(t.key){case"ArrowDown":t.preventDefault(),i=Math.min(i+1,l.length-1),p(r,l,i,e);break;case"ArrowUp":t.preventDefault(),i=Math.max(i-1,0),p(r,l,i,e);break;case"Enter":t.preventDefault(),l[i]&&h(l[i],e);break;case"Escape":t.preventDefault(),e.onClose?.();break}}),d(o,"click",s=>{s.target===o&&e.onClose?.()})}function p(o,e,a,r){if(e.length===0){o.innerHTML=`
      <div class="palette-empty">
        <p>No commands found</p>
      </div>
    `;return}const i={};e.forEach(t=>{i[t.category]||(i[t.category]=[]),i[t.category].push(t)});let l=0;o.innerHTML=Object.entries(i).map(([t,c])=>`
    <div class="palette-category">
      <div class="category-label">${g(t)}</div>
      ${c.map(n=>{const y=l++;return`
          <div class="palette-item ${y===a?"selected":""}" data-id="${n.id}" data-index="${y}">
            <span class="item-icon">${n.icon}</span>
            <span class="item-label">${g(n.label)}</span>
            ${n.description?`<span class="item-description">${g(n.description)}</span>`:""}
            ${n.shortcut?`<kbd class="item-shortcut">${n.shortcut}</kbd>`:""}
          </div>
        `}).join("")}
    </div>
  `).join(""),o.querySelectorAll(".palette-item").forEach(t=>{d(t,"click",()=>{const c=t.getAttribute("data-id"),n=e.find(y=>y.id===c);n&&h(n,r)}),d(t,"mouseenter",()=>{o.querySelectorAll(".palette-item").forEach(c=>c.classList.remove("selected")),t.classList.add("selected")})});const s=o.querySelector(".palette-item.selected");s&&s.scrollIntoView({block:"nearest"})}function h(o,e){e.onAction?.(o.id),e.onClose?.()}function k(o,e){let a=0;for(let r=0;r<e.length&&a<o.length;r++)e[r]===o[a]&&a++;return a===o.length}function g(o){const e=document.createElement("div");return e.textContent=o,e.innerHTML}export{m as createCommandPalette};
//# sourceMappingURL=CommandPalette-Dt82BjlU.js.map
