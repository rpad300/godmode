import{c as m,o as d,t as h,n as w}from"./main-DsXjfhBM.js";import"./modulepreload-polyfill-B5Qt9EMX.js";function T(o={}){const e={messages:[],isLoading:!1,sessionId:crypto.randomUUID(),isRecording:!1},i=m("div",{className:"ai-copilot"});return i.innerHTML=`
    <div class="copilot-header">
      <div class="copilot-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 6v1M12 17v1M6 12h1M17 12h1"/>
        </svg>
        <span>AI Copilot</span>
      </div>
      <div class="copilot-actions">
        <button class="copilot-btn" id="copilot-history" title="Chat History">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
        <button class="copilot-btn" id="copilot-clear" title="Clear Chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <button class="copilot-btn" id="copilot-close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="copilot-messages" id="copilot-messages">
      <div class="copilot-welcome">
        <div class="welcome-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h3>Hello! I'm your AI assistant.</h3>
        <p>Ask me anything about your knowledge graph. I can help you:</p>
        <ul class="welcome-list">
          <li>Find connections between people and projects</li>
          <li>Explain relationships and patterns</li>
          <li>Summarize information about entities</li>
          <li>Generate Cypher queries</li>
        </ul>
      </div>
    </div>
    
    <div class="copilot-suggestions" id="copilot-suggestions">
      <button class="suggestion-chip" data-query="Who are the key people in this project?">
        Key people
      </button>
      <button class="suggestion-chip" data-query="What are the main risks?">
        Main risks
      </button>
      <button class="suggestion-chip" data-query="Show recent decisions">
        Recent decisions
      </button>
      <button class="suggestion-chip" data-query="Find connections between teams">
        Team connections
      </button>
    </div>
    
    <div class="copilot-input-area">
      <div class="copilot-input-wrapper">
        <textarea
          id="copilot-input"
          class="copilot-input"
          placeholder="Ask about your knowledge graph..."
          rows="1"
        ></textarea>
        <button class="copilot-voice-btn ${f()?"":"hidden"}" id="copilot-voice" title="Voice Input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      </div>
      <button class="copilot-send-btn" id="copilot-send" title="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  `,k(i,e,o),i}function k(o,e,i){const n=o.querySelector("#copilot-messages"),t=o.querySelector("#copilot-input"),s=o.querySelector("#copilot-send"),c=o.querySelector("#copilot-voice"),p=o.querySelector("#copilot-clear"),a=o.querySelector("#copilot-close"),l=o.querySelector("#copilot-history"),r=async()=>{const g=t.value.trim();!g||e.isLoading||(t.value="",t.style.height="auto",await S(o,e,g,i))};d(s,"click",r),d(t,"keydown",g=>{const u=g;u.key==="Enter"&&!u.shiftKey&&(u.preventDefault(),r())}),d(t,"input",()=>{t.style.height="auto",t.style.height=Math.min(t.scrollHeight,120)+"px"}),c&&f()&&d(c,"click",()=>C(o,e,t)),d(p,"click",()=>{e.messages=[],e.sessionId=crypto.randomUUID(),n.innerHTML=$()}),d(a,"click",()=>i.onClose?.()),d(l,"click",()=>M()),o.querySelectorAll(".suggestion-chip").forEach(g=>{d(g,"click",()=>{const u=g.getAttribute("data-query");u&&(t.value=u,r())})}),q(e)}async function S(o,e,i,n){e.isLoading=!0;const t=o.querySelector("#copilot-messages"),s=o.querySelector("#copilot-suggestions"),c=t.querySelector(".copilot-welcome");c&&c.remove(),s.classList.add("hidden");const p={role:"user",content:i,timestamp:new Date};e.messages.push(p),y(t,p);const a=m("div",{className:"copilot-message assistant loading"});a.innerHTML=`
    <div class="message-avatar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `,t.appendChild(a),b(t);try{const l=await w.query(i);a.remove();const r={role:"assistant",content:l.answer,metadata:l,timestamp:new Date};e.messages.push(r),y(t,r,n),x(e,p),x(e,r),l.highlightedNodes?.length&&n.onHighlightNodes&&n.onHighlightNodes(l.highlightedNodes)}catch{a.remove();const r={role:"assistant",content:"Sorry, I encountered an error processing your question. Please try again.",timestamp:new Date};e.messages.push(r),y(t,r)}e.isLoading=!1,b(t)}function y(o,e,i){const n=m("div",{className:`copilot-message ${e.role}`});if(e.role==="user")n.innerHTML=`
      <div class="message-content">${v(e.content)}</div>
      <div class="message-avatar user-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    `;else{const t=e.metadata;n.innerHTML=`
      <div class="message-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-text">${B(e.content)}</div>
        
        ${t?.reasoningChain?.length?`
          <div class="reasoning-chain">
            <button class="reasoning-toggle" data-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              Reasoning Chain (${t.reasoningChain.length} steps)
            </button>
            <div class="reasoning-steps hidden">
              ${t.reasoningChain.map((s,c)=>`
                <div class="reasoning-step">
                  <div class="step-number">${c+1}</div>
                  <div class="step-content">
                    <div class="step-name">${v(s.step)}</div>
                    ${s.reasoning?`<div class="step-reasoning">${v(s.reasoning)}</div>`:""}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `:""}
        
        ${t?.cypherGenerated?`
          <div class="cypher-preview">
            <button class="cypher-toggle" data-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Generated Cypher
            </button>
            <div class="cypher-code hidden">
              <pre><code>${v(t.cypherGenerated)}</code></pre>
              <button class="cypher-run-btn" title="Execute Query">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run
              </button>
            </div>
          </div>
        `:""}
        
        ${t?.sources?.length?`
          <div class="message-sources">
            <span class="sources-label">Sources:</span>
            ${t.sources.slice(0,3).map(s=>`
              <span class="source-chip">${s.type}</span>
            `).join("")}
            ${t.sources.length>3?`<span class="source-more">+${t.sources.length-3} more</span>`:""}
          </div>
        `:""}
        
        <div class="message-meta">
          <span class="meta-type">${t?.queryType||"hybrid"}</span>
          ${t?.latencyMs?`<span class="meta-latency">${t.latencyMs}ms</span>`:""}
          ${t?.confidence?`<span class="meta-confidence">${Math.round(t.confidence*100)}% confident</span>`:""}
        </div>
      </div>
    `,setTimeout(()=>{const s=n.querySelector(".reasoning-toggle");s&&d(s,"click",()=>{const a=n.querySelector(".reasoning-steps"),l=s.getAttribute("data-expanded")==="true";s.setAttribute("data-expanded",String(!l)),a?.classList.toggle("hidden");const r=s.querySelector("svg");r&&(r.style.transform=l?"":"rotate(90deg)")});const c=n.querySelector(".cypher-toggle");c&&d(c,"click",()=>{const a=n.querySelector(".cypher-code"),l=c.getAttribute("data-expanded")==="true";c.setAttribute("data-expanded",String(!l)),a?.classList.toggle("hidden")});const p=n.querySelector(".cypher-run-btn");p&&t?.cypherGenerated&&i?.onExecuteQuery&&d(p,"click",()=>{i.onExecuteQuery(t.cypherGenerated),h.info("Executing query...")})},0)}o.appendChild(n)}function C(o,e,i){if(!f()){h.error("Voice input not supported in this browser");return}const n=o.querySelector("#copilot-voice");if(e.isRecording)e.isRecording=!1,n.classList.remove("recording");else{e.isRecording=!0,n.classList.add("recording");const t=window.SpeechRecognition||window.webkitSpeechRecognition;if(!t){h.error("Speech recognition not available"),e.isRecording=!1,n.classList.remove("recording");return}const s=new t;s.continuous=!1,s.interimResults=!0,s.lang="pt-PT",s.onresult=c=>{const p=Array.from(c.results).map(a=>a[0].transcript).join("");i.value=p,i.style.height="auto",i.style.height=Math.min(i.scrollHeight,120)+"px"},s.onend=()=>{e.isRecording=!1,n.classList.remove("recording")},s.onerror=c=>{console.error("Speech recognition error:",c.error),e.isRecording=!1,n.classList.remove("recording"),c.error!=="aborted"&&h.error("Voice recognition failed")},s.start()}}function f(){return!!(window.SpeechRecognition||window.webkitSpeechRecognition)}async function M(o){try{const e=await w.getChatSessions();if(e.length===0){h.info("No chat history found");return}h.info(`${e.length} previous sessions found`)}catch{h.error("Failed to load chat history")}}function q(o){const e=localStorage.getItem("copilot_session");if(e)try{const i=JSON.parse(e);i.sessionId&&i.messages&&(o.sessionId=i.sessionId)}catch{}}async function x(o,e){try{await w.saveChatMessage({session_id:o.sessionId,role:e.role,content:e.content,metadata:e.metadata?{queryType:e.metadata.queryType,cypherGenerated:e.metadata.cypherGenerated,sources:e.metadata.sources,reasoningChain:e.metadata.reasoningChain,highlightedNodes:e.metadata.highlightedNodes,executionTimeMs:e.metadata.latencyMs,confidence:e.metadata.confidence}:void 0,is_pinned:!1})}catch{}}function $(){return`
    <div class="copilot-welcome">
      <div class="welcome-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <h3>Hello! I'm your AI assistant.</h3>
      <p>Ask me anything about your knowledge graph.</p>
    </div>
  `}function b(o){o.scrollTop=o.scrollHeight}function B(o){return v(o).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/`(.*?)`/g,"<code>$1</code>").replace(/\n/g,"<br>")}function v(o){const e=document.createElement("div");return e.textContent=o,e.innerHTML}export{T as createAICopilot};
//# sourceMappingURL=AICopilot-Yz8O3oSG.js.map
