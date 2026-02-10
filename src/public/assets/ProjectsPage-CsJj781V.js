import{p as h,s as f,i as g}from"./main-DsXjfhBM.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function k(d,s={}){d.innerHTML="";const t=document.createElement("div");t.className="projects-page-list";const e=document.createElement("div");e.className="projects-page-form-container hidden",e.setAttribute("aria-hidden","true");function m(){e.classList.add("hidden"),e.setAttribute("aria-hidden","true"),e.innerHTML="",t.classList.remove("hidden"),t.removeAttribute("aria-hidden"),a()}function r(i,c){t.classList.add("hidden"),t.setAttribute("aria-hidden","true"),e.classList.remove("hidden"),e.setAttribute("aria-hidden","false"),f({mode:i,project:c,inlineContainer:e,onCancel:m,onSave:()=>{a(),m(),window.dispatchEvent(new CustomEvent("godmode:projects-changed"))},onDelete:()=>{a(),m(),window.dispatchEvent(new CustomEvent("godmode:projects-changed"))}})}function a(){h.getAll().then(i=>{const c=g.getState().currentProjectId;t.innerHTML=`
        <div class="tab-header" style="margin-bottom: 1.5rem;">
          <h1>Projects</h1>
          <div class="tab-actions">
            <button type="button" class="btn btn-primary" id="projects-new-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Project
            </button>
            ${s.onBack?'<button type="button" class="btn btn-secondary" id="projects-back-btn">Back to Dashboard</button>':""}
          </div>
        </div>
        <div class="projects-list" role="list">
          ${i.length===0?'<div class="gm-empty-state gm-p-6"><p class="gm-empty-state-desc">No projects yet. Create one to get started.</p></div>':i.map(n=>`
            <div class="project-list-item card" data-project-id="${n.id}" role="listitem">
              <div class="project-list-item-main">
                <div class="project-list-item-info">
                  <h3 class="project-list-item-name">${w(n.name)}${n.isDefault?' <span class="project-badge-default">default</span>':""}</h3>
                  <p class="project-list-item-meta">${n.id}</p>
                </div>
                <div class="project-list-item-actions">
                  ${c===n.id?'<span class="project-current-badge">Current</span>':""}
                  <button type="button" class="btn btn-secondary btn-sm project-edit-btn" data-project-id="${n.id}" aria-label="Edit project">Edit</button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;const o=t.querySelector("#projects-new-btn");o&&o.addEventListener("click",()=>r("create"));const p=t.querySelector("#projects-back-btn");p&&s.onBack&&p.addEventListener("click",s.onBack),t.querySelectorAll(".project-edit-btn").forEach(n=>{n.addEventListener("click",()=>{const v=n.dataset.projectId,u=i.find(j=>j.id===v);u&&r("edit",{id:u.id,name:u.name})})})})}d.appendChild(t),d.appendChild(e);const b=window,l=b.__godmodeProjectsOpen;if(l){if(delete b.__godmodeProjectsOpen,l==="create"){r("create");return}if(l.startsWith("edit:")){const i=l.slice(5);h.getAll().then(c=>{const o=c.find(p=>p.id===i);o?r("edit",{id:o.id,name:o.name}):a()});return}}a()}function w(d){const s=document.createElement("div");return s.textContent=d,s.innerHTML}export{k as initProjectsPage};
//# sourceMappingURL=ProjectsPage-CsJj781V.js.map
