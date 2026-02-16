import{c as h,o as s,m as C,z as T,A as M}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let m="paste";function j(e={}){const t=document.getElementById("transcript-composer-overlay");t&&t.remove();const r=h("div",{id:"transcript-composer-overlay",className:"composer-overlay"}),a=L(e);r.appendChild(a),document.body.appendChild(r),s(r,"click",i=>{i.target===r&&(u(),e.onClose?.())}),requestAnimationFrame(()=>{r.classList.add("visible")})}function u(){const e=document.getElementById("transcript-composer-overlay");e&&(e.classList.remove("visible"),setTimeout(()=>e.remove(),200))}function L(e){const t=h("div",{className:"composer-modal"});t.innerHTML=`
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
      .composer-overlay.visible {
        opacity: 1;
      }
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
      
      /* Header */
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
      
      /* Tabs */
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
      .composer-tab:hover {
        color: var(--text-primary);
      }
      .composer-tab.active {
        color: var(--primary);
      }
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
      
      /* Content */
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
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
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
      .paste-section textarea::placeholder {
        color: var(--text-tertiary);
      }
      .paste-hint {
        margin-top: 12px;
        font-size: 13px;
        color: var(--text-tertiary);
      }
      
      /* Source Select */
      .source-row {
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .source-row label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .source-row select {
        flex: 1;
        max-width: 200px;
        padding: 10px 14px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 13px;
        cursor: pointer;
      }
      .source-row select:focus {
        outline: none;
        border-color: var(--primary);
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
      .dropzone-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .dropzone-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .dropzone-hint {
        font-size: 13px;
        color: var(--text-tertiary);
      }
      
      /* Selected File */
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
      .selected-file.visible {
        display: flex;
      }
      .file-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, white));
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }
      .file-info {
        flex: 1;
        min-width: 0;
      }
      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .file-size {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 2px;
      }
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
      
      /* Footer */
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
      .composer-footer .btn-secondary:hover {
        background: var(--bg-tertiary);
      }
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
      <h2>Import Transcript</h2>
      <button class="composer-close" id="close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="composer-tabs">
      <button class="composer-tab active" data-mode="paste">Paste Text</button>
      <button class="composer-tab" data-mode="upload">Upload File</button>
    </div>
    
    <div class="composer-body" id="composer-body">
      ${w()}
    </div>
    
    <div class="composer-association" style="padding: 12px 24px; border-top: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
      <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">Associate with (optional)</span>
      <select id="transcript-sprint-select" class="form-select" style="min-width: 140px;"><option value="">No sprint</option></select>
      <select id="transcript-action-select" class="form-select" style="min-width: 180px;"><option value="">No task</option></select>
    </div>
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="import-btn" disabled>Process Transcript</button>
    </div>
  `,t.querySelectorAll(".composer-tab").forEach(a=>{s(a,"click",()=>{t.querySelectorAll(".composer-tab").forEach(i=>i.classList.remove("active")),a.classList.add("active"),m=a.getAttribute("data-mode"),B(t)})}),s(t.querySelector("#close-btn"),"click",()=>{u(),e.onClose?.()}),s(t.querySelector("#cancel-btn"),"click",()=>{u(),e.onClose?.()});const r=t.querySelector("#import-btn");return s(r,"click",()=>k(t,e)),S(t),E(t),t}async function E(e){const t=e.querySelector("#transcript-sprint-select"),r=e.querySelector("#transcript-action-select");if(!(!t||!r))try{(await T()).forEach(i=>{const o=document.createElement("option");o.value=i.id,o.textContent=i.name,t.appendChild(o)}),s(t,"change",async()=>{const i=t.value||"";if(r.innerHTML='<option value="">No task</option>',!!i)try{(await M(void 0,i)).forEach(n=>{const l=document.createElement("option");l.value=String(n.id),l.textContent=(n.content||n.task||String(n.id)).slice(0,60)+((n.content||n.task||"").length>60?"…":""),r.appendChild(l)})}catch{}})}catch{}}function B(e){const t=e.querySelector("#composer-body");t.innerHTML=m==="paste"?w():F(),m==="paste"?S(e):I(e)}function w(){return`
    <div class="paste-section">
      <label>Paste meeting transcript:</label>
      <textarea id="transcript-input" placeholder="Paste your meeting transcript here...

Supported formats:
• Krisp transcripts
• Otter.ai transcripts  
• Zoom meeting transcripts
• Google Meet transcripts
• Microsoft Teams transcripts

Example:
Speaker 1 (00:00:05):
Hello everyone, welcome to today's meeting.

Speaker 2 (00:00:12):
Thanks for having us. Let's get started."></textarea>
      <p class="paste-hint">Include speaker names and timestamps if available for better parsing.</p>
      <div class="source-row">
        <label>Source:</label>
        <select id="source-select">
          <option value="">Auto-detect</option>
          <option value="krisp">Krisp</option>
          <option value="otter">Otter.ai</option>
          <option value="zoom">Zoom</option>
          <option value="meet">Google Meet</option>
          <option value="teams">Microsoft Teams</option>
        </select>
      </div>
    </div>
  `}function S(e){const t=e.querySelector("#transcript-input"),r=e.querySelector("#import-btn");t&&s(t,"input",()=>{r.disabled=t.value.trim().length<20})}function F(){return`
    <div class="upload-section">
      <div class="dropzone" id="file-dropzone">
        <div class="dropzone-icon">🎙️</div>
        <p class="dropzone-title">Drop transcript file here</p>
        <p class="dropzone-hint">or click to browse • .txt, .md, .srt, .vtt</p>
        <input type="file" id="file-input" accept=".txt,.md,.srt,.vtt,.json" hidden>
      </div>
      <div class="selected-file" id="selected-file">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name" id="file-name"></div>
          <div class="file-size" id="file-size"></div>
        </div>
        <button class="file-remove" id="file-remove">×</button>
      </div>
    </div>
  `}function I(e){const t=e.querySelector("#file-dropzone"),r=e.querySelector("#file-input"),a=e.querySelector("#selected-file"),i=e.querySelector("#import-btn");s(t,"click",()=>r.click()),s(t,"dragover",o=>{o.preventDefault(),t.classList.add("dragover")}),s(t,"dragleave",()=>t.classList.remove("dragover")),s(t,"drop",o=>{o.preventDefault(),t.classList.remove("dragover");const n=o.dataTransfer?.files[0];n&&g(n,e)}),s(r,"change",()=>{r.files?.[0]&&g(r.files[0],e)}),s(e.querySelector("#file-remove"),"click",()=>{a.classList.remove("visible"),e._fileContent=null,i.disabled=!0})}function g(e,t){const r=t.querySelector("#selected-file"),a=t.querySelector("#import-btn");t.querySelector("#file-name").textContent=e.name,t.querySelector("#file-size").textContent=z(e.size),r.classList.add("visible");const i=new FileReader;i.onload=()=>{t._fileContent=i.result,a.disabled=!1},i.readAsText(e)}function A(e){return m==="paste"?e.querySelector("#transcript-input")?.value||"":e._fileContent||""}async function k(e,t){const r=e.querySelector("#import-btn"),a=e.querySelector("#cancel-btn"),i=A(e);if(!i||r.disabled)return;r.disabled=!0,a.disabled=!0;const o=e.querySelector(".composer-footer"),n=o.innerHTML;o.innerHTML=`
    <div class="transcript-status-row">
      <div class="processing-spinner"></div>
      <div class="transcript-status-fill">
        <div class="transcript-status-title" id="processing-status">Uploading transcript...</div>
        <div class="transcript-status-detail" id="processing-detail">Please wait</div>
      </div>
    </div>
  `;const l=o.querySelector("#processing-status"),b=o.querySelector("#processing-detail");try{const d=e.querySelector("#source-select"),c=new FormData,p=`transcript_${Date.now()}.txt`;c.append("file",new Blob([i],{type:"text/plain"}),p),c.append("folder","newtranscripts"),d?.value&&c.append("source",d.value);const f=e.querySelector("#transcript-sprint-select"),x=e.querySelector("#transcript-action-select");f?.value&&c.append("sprintId",f.value),x?.value&&c.append("actionId",x.value),l.textContent="Uploading transcript...",b.textContent=`${z(i.length)} • ${p}`;const v=await C("/api/upload",{method:"POST",body:c});if(!v.ok){const q=await v.json().catch(()=>({}));throw new Error(q.error||`Upload failed (${v.status})`)}const y=await v.json();l.textContent="Transcript uploaded!",b.textContent="AI processing will start automatically",o.innerHTML=`
      <div class="transcript-status-row">
        <div class="transcript-success-icon">✓</div>
        <div class="transcript-status-fill">
          <div class="transcript-success-title">Transcript imported successfully!</div>
          <div class="transcript-status-detail">AI extraction will process in the background</div>
        </div>
      </div>
      <button class="btn btn-primary transcript-done-btn" id="done-btn">Done</button>
    `,o.querySelector("#done-btn")?.addEventListener("click",()=>{t.onImport?.(y),u()}),setTimeout(()=>{t.onImport?.(y),u()},3e3)}catch(d){console.error("[TranscriptComposer] Error:",d),o.innerHTML=`
      <div class="transcript-status-row">
        <div class="transcript-error-icon">✕</div>
        <div class="transcript-status-fill">
          <div class="transcript-error-title">Import failed</div>
          <div class="transcript-status-detail">${d instanceof Error?d.message:"Unknown error"}</div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary transcript-retry-btn" id="retry-btn">Try Again</button>
    `,o.querySelector("#retry-btn")?.addEventListener("click",()=>{o.innerHTML=n;const c=o.querySelector("#import-btn"),p=o.querySelector("#cancel-btn");c&&(c.disabled=!1,c.addEventListener("click",()=>k(e,t))),p&&(p.disabled=!1,p.addEventListener("click",()=>{u(),t.onClose?.()}))})}}function z(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`}export{u as closeTranscriptComposer,j as default,j as showTranscriptComposer};
//# sourceMappingURL=TranscriptComposer-8ImAPOGY.js.map
