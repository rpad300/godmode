import{c as v,o as i,B as m,t as p}from"./main-v_cFye9p.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let l="paste";function C(e={}){const o=document.getElementById("conversation-composer-overlay");o&&o.remove();const r=v("div",{id:"conversation-composer-overlay",className:"composer-overlay"}),t=x(e);r.appendChild(t),document.body.appendChild(r),i(r,"click",a=>{a.target===r&&(c(),e.onClose?.())}),requestAnimationFrame(()=>r.classList.add("visible"))}function c(){const e=document.getElementById("conversation-composer-overlay");e&&(e.classList.remove("visible"),setTimeout(()=>e.remove(),200))}function x(e){const o=v("div",{className:"composer-modal"});return o.innerHTML=`
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
      
      .format-row {
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .format-row label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .format-row select {
        flex: 1;
        max-width: 200px;
        padding: 10px 14px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 13px;
      }
      
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
        background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, white));
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
      
      .preview-area {
        margin-top: 20px;
        padding: 16px;
        background: var(--bg-tertiary);
        border-radius: 12px;
        display: none;
      }
      .preview-area.visible { display: block; }
      .preview-area h4 {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .preview-stats {
        display: flex;
        gap: 24px;
        font-size: 14px;
      }
      .preview-stats span { color: var(--text-secondary); }
      .preview-stats strong { color: var(--text-primary); }
      
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
      .composer-footer .btn-outline {
        background: transparent;
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      .composer-footer .btn-outline:hover { background: var(--bg-tertiary); }
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
      <h2>Import Conversation</h2>
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
      ${b()}
    </div>
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-outline" id="preview-btn" disabled>Preview</button>
      <button class="btn btn-primary" id="import-btn" disabled>Import</button>
    </div>
  `,o.querySelectorAll(".composer-tab").forEach(r=>{i(r,"click",()=>{o.querySelectorAll(".composer-tab").forEach(t=>t.classList.remove("active")),r.classList.add("active"),l=r.getAttribute("data-mode"),y(o)})}),i(o.querySelector("#close-btn"),"click",()=>{c(),e.onClose?.()}),i(o.querySelector("#cancel-btn"),"click",()=>{c(),e.onClose?.()}),i(o.querySelector("#preview-btn"),"click",()=>w(o)),i(o.querySelector("#import-btn"),"click",()=>k(o,e)),u(o),o}function y(e){const o=e.querySelector("#composer-body");o.innerHTML=l==="paste"?b():g(),l==="paste"?u(e):h(e)}function b(){return`
    <div class="paste-section">
      <label>Paste conversation or transcript:</label>
      <textarea id="conversation-input" placeholder="Paste your conversation here...

Supported formats:
• WhatsApp, Slack, Teams, Discord chats
• Meeting transcripts (Zoom, Google Meet)
• Email threads
• Any text with speaker names

Example:
[10:30] John: Hello everyone
[10:31] Jane: Hi John!
[10:32] John: Let's discuss the project..."></textarea>
      <p class="paste-hint">Include timestamps and speaker names for better parsing.</p>
      <div class="format-row">
        <label>Format:</label>
        <select id="format-select">
          <option value="">Auto-detect</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="slack">Slack</option>
          <option value="teams">Microsoft Teams</option>
          <option value="discord">Discord</option>
          <option value="zoom">Zoom Transcript</option>
          <option value="generic">Generic Chat</option>
        </select>
      </div>
    </div>
    <div class="preview-area" id="preview-area"></div>
  `}function u(e){const o=e.querySelector("#conversation-input"),r=e.querySelector("#preview-btn"),t=e.querySelector("#import-btn");o&&i(o,"input",()=>{const a=o.value.trim().length>10;r.disabled=!a,t.disabled=!a})}function g(){return`
    <div class="upload-section">
      <div class="dropzone" id="file-dropzone">
        <div class="dropzone-icon">💬</div>
        <p class="dropzone-title">Drop chat file here</p>
        <p class="dropzone-hint">or click to browse • .txt, .json</p>
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
    <div class="preview-area" id="preview-area"></div>
  `}function h(e){const o=e.querySelector("#file-dropzone"),r=e.querySelector("#file-input"),t=e.querySelector("#selected-file"),a=e.querySelector("#preview-btn"),s=e.querySelector("#import-btn");i(o,"click",()=>r.click()),i(o,"dragover",n=>{n.preventDefault(),o.classList.add("dragover")}),i(o,"dragleave",()=>o.classList.remove("dragover")),i(o,"drop",n=>{n.preventDefault(),o.classList.remove("dragover"),n.dataTransfer?.files[0]&&d(n.dataTransfer.files[0],e)}),i(r,"change",()=>{r.files?.[0]&&d(r.files[0],e)}),i(e.querySelector("#file-remove"),"click",()=>{t.classList.remove("visible"),e._fileContent=null,a.disabled=!0,s.disabled=!0})}function d(e,o){const r=o.querySelector("#selected-file"),t=o.querySelector("#preview-btn"),a=o.querySelector("#import-btn");o.querySelector("#file-name").textContent=e.name,o.querySelector("#file-size").textContent=z(e.size),r.classList.add("visible");const s=new FileReader;s.onload=()=>{o._fileContent=s.result,t.disabled=!1,a.disabled=!1},s.readAsText(e)}function f(e){return l==="paste"?e.querySelector("#conversation-input")?.value||"":e._fileContent||""}async function w(e){const o=e.querySelector("#preview-btn"),r=e.querySelector("#preview-area"),t=f(e);if(t){o.disabled=!0,o.textContent="Parsing...";try{const a=await m.parsePreview(t);r.classList.add("visible"),r.innerHTML=`
      <h4>Preview</h4>
      <div class="preview-stats">
        <span>Messages: <strong>${a.message_count||0}</strong></span>
        <span>Participants: <strong>${a.participants?.length||0}</strong></span>
        <span>Format: <strong>${a.format||"Unknown"}</strong></span>
      </div>
    `}catch{p.error("Failed to parse conversation")}finally{o.disabled=!1,o.textContent="Preview"}}}async function k(e,o){const r=e.querySelector("#import-btn"),t=f(e),a=e.querySelector("#format-select");if(t){r.disabled=!0,r.textContent="Importing...";try{const s=await m.import(t,{formatHint:a?.value});p.success("Conversation imported"),o.onImport?.(s),c()}catch{p.error("Failed to import conversation")}finally{r.disabled=!1,r.textContent="Import"}}}function z(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`}export{c as closeConversationComposer,C as default,C as showConversationComposer};
//# sourceMappingURL=ConversationComposer-D6geblYj.js.map
