import{c as f,o as s,h as y,t as u,z as g,A as h}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let m="paste";function j(e={}){const o=document.getElementById("email-composer-overlay");o&&o.remove();const r=f("div",{id:"email-composer-overlay",className:"composer-overlay"}),t=w(e);r.appendChild(t),document.body.appendChild(r),s(r,"click",a=>{a.target===r&&(d(),e.onClose?.())}),requestAnimationFrame(()=>r.classList.add("visible"))}function d(){const e=document.getElementById("email-composer-overlay");e&&(e.classList.remove("visible"),setTimeout(()=>e.remove(),200))}function w(e={}){const o=f("div",{className:"composer-modal"});return o.innerHTML=`
    <style>
      .composer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .composer-overlay.visible { opacity: 1; }
      .composer-overlay.visible .composer-modal {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .composer-modal {
        width: 640px;
        max-width: 95vw;
        max-height: 85vh;
        background: var(--bg-primary);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(20px) scale(0.98);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .composer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
      }
      .composer-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .composer-close {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--bg-secondary);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        transition: all 0.15s ease;
      }
      .composer-close:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      
      .composer-tabs {
        display: flex;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .composer-tab {
        padding: 14px 20px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary);
        background: none;
        border: none;
        cursor: pointer;
        position: relative;
        transition: color 0.15s ease;
      }
      .composer-tab:hover { color: var(--text-primary); }
      .composer-tab.active { color: var(--primary); }
      .composer-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--primary);
        border-radius: 2px 2px 0 0;
      }
      
      .composer-body {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
      }
      
      /* Paste Mode */
      .paste-section label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 12px;
      }
      .paste-section textarea {
        width: 100%;
        min-height: 280px;
        padding: 16px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 13px;
        line-height: 1.6;
        resize: vertical;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .paste-section textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      .paste-section textarea::placeholder { color: var(--text-tertiary); }
      .paste-hint {
        margin-top: 12px;
        font-size: 13px;
        color: var(--text-tertiary);
      }
      
      /* Upload Mode */
      .upload-section .dropzone {
        border: 2px dashed var(--border-color);
        border-radius: 16px;
        padding: 60px 40px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--bg-secondary);
      }
      .upload-section .dropzone:hover,
      .upload-section .dropzone.dragover {
        border-color: var(--primary);
        background: rgba(var(--primary-rgb), 0.03);
      }
      .dropzone-icon { font-size: 48px; margin-bottom: 16px; }
      .dropzone-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .dropzone-hint { font-size: 13px; color: var(--text-tertiary); }
      
      .selected-file {
        display: none;
        align-items: center;
        gap: 16px;
        margin-top: 20px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 12px;
        border: 1px solid var(--border-color);
      }
      .selected-file.visible { display: flex; }
      .file-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #3b82f6, #60a5fa);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }
      .file-info { flex: 1; min-width: 0; }
      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .file-size { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
      .file-remove {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        color: var(--text-tertiary);
        font-size: 18px;
        transition: all 0.15s ease;
      }
      .file-remove:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      
      /* Manual Mode */
      .manual-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .form-row {
        display: flex;
        gap: 16px;
      }
      .form-row > .form-group { flex: 1; }
      .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      .form-group label .required { color: var(--primary); }
      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 14px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      .form-group textarea {
        min-height: 120px;
        resize: vertical;
      }
      .form-group input::placeholder,
      .form-group textarea::placeholder { color: var(--text-tertiary); }
      
      .composer-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .composer-footer .btn {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
      }
      .composer-footer .btn-secondary {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      .composer-footer .btn-secondary:hover { background: var(--bg-tertiary); }
      .composer-footer .btn-primary {
        background: var(--primary);
        color: white;
      }
      .composer-footer .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .composer-footer .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    </style>
    
    <div class="composer-header">
      <h2>Add Email</h2>
      <button class="composer-close" id="close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="composer-tabs">
      <button class="composer-tab active" data-mode="paste">Paste Text</button>
      <button class="composer-tab" data-mode="upload">Upload .eml/.msg</button>
      <button class="composer-tab" data-mode="manual">Manual Entry</button>
    </div>
    
    <div class="composer-body" id="composer-body">
      ${v()}
    </div>
    
    <div class="composer-association" style="padding: 12px 24px; border-top: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
      <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">Associate with (optional)</span>
      <select id="email-sprint-select" class="form-select" style="min-width: 140px;"><option value="">No sprint</option></select>
      <select id="email-action-select" class="form-select" style="min-width: 180px;"><option value="">No task</option></select>
    </div>
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="save-btn" disabled>Add Email</button>
    </div>
  `,o.querySelectorAll(".composer-tab").forEach(r=>{s(r,"click",()=>{o.querySelectorAll(".composer-tab").forEach(t=>t.classList.remove("active")),r.classList.add("active"),m=r.getAttribute("data-mode"),S(o)})}),s(o.querySelector("#close-btn"),"click",()=>{d(),e.onClose?.()}),s(o.querySelector("#cancel-btn"),"click",()=>{d(),e.onClose?.()}),s(o.querySelector("#save-btn"),"click",()=>F(o,e)),x(o),k(o),o}async function k(e){const o=e.querySelector("#email-sprint-select"),r=e.querySelector("#email-action-select");if(!(!o||!r))try{(await g()).forEach(a=>{const i=document.createElement("option");i.value=a.id,i.textContent=a.name,o.appendChild(i)}),s(o,"change",async()=>{const a=o.value||"";if(r.innerHTML='<option value="">No task</option>',!!a)try{(await h(void 0,a)).forEach(n=>{const l=document.createElement("option");l.value=String(n.id),l.textContent=(n.content||n.task||String(n.id)).slice(0,60)+((n.content||n.task||"").length>60?"…":""),r.appendChild(l)})}catch{}})}catch{}}function S(e){const o=e.querySelector("#composer-body");switch(m){case"paste":o.innerHTML=v(),x(e);break;case"upload":o.innerHTML=z(),q(e);break;case"manual":o.innerHTML=E(),M(e);break}}function v(){return`
    <div class="paste-section">
      <label>Paste email content:</label>
      <textarea id="email-paste" placeholder="Paste the full email content here...

Include headers if available:
From: sender@example.com
To: recipient@example.com
Subject: Meeting notes
Date: Jan 31, 2026

Email body text..."></textarea>
      <p class="paste-hint">Include headers (From, To, Subject, Date) for better parsing.</p>
    </div>
  `}function x(e){const o=e.querySelector("#email-paste"),r=e.querySelector("#save-btn");o&&s(o,"input",()=>{r.disabled=o.value.trim().length<10})}function z(){return`
    <div class="upload-section">
      <div class="dropzone" id="file-dropzone">
        <div class="dropzone-icon">📧</div>
        <p class="dropzone-title">Drop email file here</p>
        <p class="dropzone-hint">or click to browse • .eml, .msg</p>
        <input type="file" id="file-input" accept=".eml,.msg" hidden>
      </div>
      <div class="selected-file" id="selected-file">
        <div class="file-icon">📧</div>
        <div class="file-info">
          <div class="file-name" id="file-name"></div>
          <div class="file-size" id="file-size"></div>
        </div>
        <button class="file-remove" id="file-remove">×</button>
      </div>
    </div>
  `}function q(e){const o=e.querySelector("#file-dropzone"),r=e.querySelector("#file-input"),t=e.querySelector("#selected-file"),a=e.querySelector("#save-btn");s(o,"click",()=>r.click()),s(o,"dragover",i=>{i.preventDefault(),o.classList.add("dragover")}),s(o,"dragleave",()=>o.classList.remove("dragover")),s(o,"drop",i=>{i.preventDefault(),o.classList.remove("dragover"),i.dataTransfer?.files[0]&&b(i.dataTransfer.files[0],e)}),s(r,"change",()=>{r.files?.[0]&&b(r.files[0],e)}),s(e.querySelector("#file-remove"),"click",()=>{t.classList.remove("visible"),e._emlFile=null,a.disabled=!0})}function b(e,o){const r=o.querySelector("#selected-file"),t=o.querySelector("#save-btn");o.querySelector("#file-name").textContent=e.name,o.querySelector("#file-size").textContent=L(e.size),r.classList.add("visible"),o._emlFile=e,t.disabled=!1}function E(){return`
    <form class="manual-form" id="manual-form">
      <div class="form-row">
        <div class="form-group">
          <label>From <span class="required">*</span></label>
          <input type="email" name="from" placeholder="sender@example.com" required>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="datetime-local" name="date">
        </div>
      </div>
      <div class="form-group">
        <label>To <span class="required">*</span></label>
        <input type="text" name="to" placeholder="recipient@example.com (comma-separated)" required>
      </div>
      <div class="form-group">
        <label>CC</label>
        <input type="text" name="cc" placeholder="cc@example.com (comma-separated)">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" name="subject" placeholder="Email subject">
      </div>
      <div class="form-group">
        <label>Body <span class="required">*</span></label>
        <textarea name="body" placeholder="Email content..." required></textarea>
      </div>
    </form>
  `}function M(e){const o=e.querySelector("#manual-form"),r=e.querySelector("#save-btn"),t=()=>{const a=o.querySelector('[name="from"]'),i=o.querySelector('[name="to"]'),n=o.querySelector('[name="body"]');r.disabled=!a.value||!i.value||!n.value};o.querySelectorAll("input, textarea").forEach(a=>{s(a,"input",t)})}async function C(e){return new Promise((o,r)=>{const t=new FileReader;t.onload=()=>{const a=t.result.split(",")[1];o(a)},t.onerror=r,t.readAsDataURL(e)})}async function F(e,o){const r=e.querySelector("#save-btn");r.disabled=!0,r.textContent="Processing...";try{let t;switch(m){case"paste":{t={emailText:e.querySelector("#email-paste").value};break}case"upload":{const l=e._emlFile;if(!l)throw new Error("No file selected");const c=await C(l);l.name.toLowerCase().endsWith(".msg")?t={msgBase64:c,filename:l.name}:t={emlBase64:c,filename:l.name};break}case"manual":{const l=e.querySelector("#manual-form"),c=new FormData(l);t={from:c.get("from"),to:c.get("to").split(",").map(p=>p.trim()),cc:c.get("cc")?c.get("cc").split(",").map(p=>p.trim()):void 0,subject:c.get("subject"),body:c.get("body"),date:c.get("date")||void 0};break}}const a=e.querySelector("#email-sprint-select")?.value||"",i=e.querySelector("#email-action-select")?.value||"";a&&(t.sprint_id=a),i&&(t.action_id=i);const n=await y.post("/api/emails",t);u.success("Email added successfully"),o.onSave?.(n),d()}catch(t){u.error("Failed to add email"),console.error("[EmailComposer] Error:",t)}finally{r.disabled=!1,r.textContent="Add Email"}}function L(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`}export{d as closeEmailComposer,w as createEmailComposer,j as default,j as showEmailComposer};
//# sourceMappingURL=EmailComposer-K6OuUU6Q.js.map
