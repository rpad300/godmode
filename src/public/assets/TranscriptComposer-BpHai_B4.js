import{c as y,o as a}from"./main-BO04R03Y.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let b="paste";function E(e={}){const r=document.getElementById("transcript-composer-overlay");r&&r.remove();const o=y("div",{id:"transcript-composer-overlay",className:"composer-overlay"}),s=S(e);o.appendChild(s),document.body.appendChild(o),a(o,"click",i=>{i.target===o&&(d(),e.onClose?.())}),requestAnimationFrame(()=>{o.classList.add("visible")})}function d(){const e=document.getElementById("transcript-composer-overlay");e&&(e.classList.remove("visible"),setTimeout(()=>e.remove(),200))}function S(e){const r=y("div",{className:"composer-modal"});r.innerHTML=`
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
      ${g()}
    </div>
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="import-btn" disabled>Process Transcript</button>
    </div>
  `,r.querySelectorAll(".composer-tab").forEach(s=>{a(s,"click",()=>{r.querySelectorAll(".composer-tab").forEach(i=>i.classList.remove("active")),s.classList.add("active"),b=s.getAttribute("data-mode"),q(r)})}),a(r.querySelector("#close-btn"),"click",()=>{d(),e.onClose?.()}),a(r.querySelector("#cancel-btn"),"click",()=>{d(),e.onClose?.()});const o=r.querySelector("#import-btn");return a(o,"click",()=>w(r,e)),h(r),r}function q(e){const r=e.querySelector("#composer-body");r.innerHTML=b==="paste"?g():C(),b==="paste"?h(e):T(e)}function g(){return`
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
  `}function h(e){const r=e.querySelector("#transcript-input"),o=e.querySelector("#import-btn");r&&a(r,"input",()=>{o.disabled=r.value.trim().length<20})}function C(){return`
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
  `}function T(e){const r=e.querySelector("#file-dropzone"),o=e.querySelector("#file-input"),s=e.querySelector("#selected-file"),i=e.querySelector("#import-btn");a(r,"click",()=>o.click()),a(r,"dragover",t=>{t.preventDefault(),r.classList.add("dragover")}),a(r,"dragleave",()=>r.classList.remove("dragover")),a(r,"drop",t=>{t.preventDefault(),r.classList.remove("dragover");const p=t.dataTransfer?.files[0];p&&x(p,e)}),a(o,"change",()=>{o.files?.[0]&&x(o.files[0],e)}),a(e.querySelector("#file-remove"),"click",()=>{s.classList.remove("visible"),e._fileContent=null,i.disabled=!0})}function x(e,r){const o=r.querySelector("#selected-file"),s=r.querySelector("#import-btn");r.querySelector("#file-name").textContent=e.name,r.querySelector("#file-size").textContent=k(e.size),o.classList.add("visible");const i=new FileReader;i.onload=()=>{r._fileContent=i.result,s.disabled=!1},i.readAsText(e)}function M(e){return b==="paste"?e.querySelector("#transcript-input")?.value||"":e._fileContent||""}async function w(e,r){const o=e.querySelector("#import-btn"),s=e.querySelector("#cancel-btn"),i=M(e);if(!i||o.disabled)return;o.disabled=!0,s.disabled=!0;const t=e.querySelector(".composer-footer"),p=t.innerHTML;t.innerHTML=`
    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
      <div class="processing-spinner" style="
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <div style="flex: 1;">
        <div style="font-weight: 500; color: var(--text-primary);" id="processing-status">Uploading transcript...</div>
        <div style="font-size: 12px; color: var(--text-tertiary);" id="processing-detail">Please wait</div>
      </div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;const u=t.querySelector("#processing-status"),v=t.querySelector("#processing-detail");try{const l=e.querySelector("#source-select"),n=new FormData,c=`transcript_${Date.now()}.txt`;n.append("file",new Blob([i],{type:"text/plain"}),c),n.append("folder","newtranscripts"),l?.value&&n.append("source",l.value),u.textContent="Uploading transcript...",v.textContent=`${k(i.length)} • ${c}`;const m=await fetch("/api/upload",{method:"POST",body:n,credentials:"include"});if(!m.ok){const z=await m.json().catch(()=>({}));throw new Error(z.error||`Upload failed (${m.status})`)}const f=await m.json();u.textContent="Transcript uploaded!",v.textContent="AI processing will start automatically",t.innerHTML=`
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <div style="
          width: 24px;
          height: 24px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
        ">✓</div>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #10b981;">Transcript imported successfully!</div>
          <div style="font-size: 12px; color: var(--text-tertiary);">AI extraction will process in the background</div>
        </div>
      </div>
      <button class="btn btn-primary" id="done-btn" style="
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        background: var(--primary);
        color: white;
      ">Done</button>
    `,t.querySelector("#done-btn")?.addEventListener("click",()=>{r.onImport?.(f),d()}),setTimeout(()=>{r.onImport?.(f),d()},3e3)}catch(l){console.error("[TranscriptComposer] Error:",l),t.innerHTML=`
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <div style="
          width: 24px;
          height: 24px;
          background: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
        ">✕</div>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #ef4444;">Import failed</div>
          <div style="font-size: 12px; color: var(--text-tertiary);">${l instanceof Error?l.message:"Unknown error"}</div>
        </div>
      </div>
      <button class="btn btn-secondary" id="retry-btn" style="
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border-color);
        background: var(--bg-primary);
        color: var(--text-primary);
      ">Try Again</button>
    `,t.querySelector("#retry-btn")?.addEventListener("click",()=>{t.innerHTML=p;const n=t.querySelector("#import-btn"),c=t.querySelector("#cancel-btn");n&&(n.disabled=!1,n.addEventListener("click",()=>w(e,r))),c&&(c.disabled=!1,c.addEventListener("click",()=>{d(),r.onClose?.()}))})}}function k(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`}export{d as closeTranscriptComposer,E as default,E as showTranscriptComposer};
//# sourceMappingURL=TranscriptComposer-BpHai_B4.js.map
