import{a as ne,h as m,o as d,t as o}from"./main-v_cFye9p.js";import{b as C,a as de,f as Oe}from"./billing-CSo_L-5s.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let ee=[],te=[],ge=!1,Y=!1,U=[],q=null,Ue=!1,me=!1,ce=!1,z="llm",P={},W=[],ae=[],F=[],ue=!1,N={enabled:!0,access:"admin_only"},V=!1,Q=!1,H=[],K=null,A=[],L=null,M=!1,se=!1,pe=null,ie=!1,O=!1;async function Ve(){try{const e=await m.get("/api/system/config");if(P={},e.data?.llm_pertask){P.llm=[];const n=e.data.llm_pertask;n.text&&P.llm.push({key:"text_provider",value:n.text,category:"llm"}),n.vision&&P.llm.push({key:"vision_provider",value:n.vision,category:"llm"}),n.embeddings&&P.llm.push({key:"embeddings_provider",value:n.embeddings,category:"llm"})}e.data?.processing&&(P.processing=[{key:"processing",value:e.data.processing,category:"processing"}]),e.data?.graph&&(P.graph=[{key:"graph",value:e.data.graph,category:"graph"}]),console.log("[AdminPanel] Loaded system config:",P)}catch(e){console.warn("Failed to load system config:",e),P={}}}async function Qe(){try{ce=((await m.get("/api/secrets")).data?.secrets||[]).some(u=>u.name==="GRAPH_PASSWORD"),console.log("[AdminPanel] Graph password set:",ce)}catch(e){console.warn("Failed to load secrets:",e),ce=!1}}const Je=[{id:"openai",name:"OpenAI"},{id:"anthropic",name:"Anthropic (Claude)"},{id:"google",name:"Google AI (Gemini)"},{id:"xai",name:"xAI (Grok)"},{id:"deepseek",name:"DeepSeek"},{id:"kimi",name:"Kimi (Moonshot)"},{id:"minimax",name:"MiniMax"},{id:"ollama",name:"Ollama (Local)"}];async function Xe(){const e=Je.map(n=>({id:n.id,name:n.name,enabled:!1,models:[]}));try{const u=(await m.get("/api/llm/providers")).data?.providers;Array.isArray(u)&&u.length>0?W=u.map(y=>({id:y.id,name:y.name??y.label??y.id,enabled:y.enabled??!1,models:Array.isArray(y.models)?y.models:[]})):W=e}catch(n){console.warn("Failed to load providers, using defaults:",n),W=e}}async function Ye(){try{const e=await m.get("/api/system/audit?limit=50");ae=Array.isArray(e.data?.logs)?e.data.logs:[]}catch(e){console.warn("Failed to load audit logs:",e),ae=[]}}async function ve(){try{const e=await m.get("/api/system/prompts");F=Array.isArray(e.data?.prompts)?e.data.prompts:[]}catch(e){console.warn("Failed to load system prompts:",e),F=[{id:"1",key:"document",name:"Document Extraction",description:"Extract information from PDFs and text files",category:"extraction",prompt_template:"",uses_ontology:!0},{id:"2",key:"transcript",name:"Transcript Extraction",description:"Extract information from meeting transcripts",category:"extraction",prompt_template:"",uses_ontology:!0},{id:"3",key:"vision",name:"Vision/Image Extraction",description:"Extract information from images and diagrams",category:"extraction",prompt_template:"",uses_ontology:!0},{id:"4",key:"conversation",name:"Conversation Extraction",description:"Extract information from chat conversations",category:"extraction",prompt_template:"",uses_ontology:!0},{id:"5",key:"email",name:"Email Extraction",description:"Extract information from emails",category:"extraction",prompt_template:"",uses_ontology:!0},{id:"6",key:"summary",name:"Content Summary",description:"Generate concise summaries",category:"analysis",prompt_template:"",uses_ontology:!1}]}}async function Ge(){Y=!0;try{const[e,n]=await Promise.all([m.get("/api/ontology/entities"),m.get("/api/ontology/relations")]);ee=e.data?.entityTypes??[],te=n.data?.relationTypes??[],ge=!0}catch(e){console.warn("Failed to load ontology:",e),ee=[],te=[]}finally{Y=!1}}async function Be(){me=!0;try{const[e,n]=await Promise.all([m.get("/api/graph/list"),m.get("/api/graph/status").catch(()=>({data:{}}))]);U=e.data?.graphs??[],e.data?.error&&(U=[]),q=n.data??null,Ue=!0}catch(e){console.warn("Failed to load graph overview:",e),U=[],q=null}finally{me=!1}}async function j(e,n,u){try{await m.post("/api/system/config",{key:e,value:n,category:u}),o.success("Configuration saved"),await Ve()}catch{o.error("Failed to save configuration")}}async function We(e){try{const n=await m.post(`/api/llm/test/${e}`);if(n.data.ok){const u=n.data.models?` (${n.data.models} models)`:"";o.success(`${e} connection successful${u}`)}else o.error(n.data.error?.message||"Connection failed")}catch{o.error("Connection test failed")}}function E(e,n,u=""){const y=P[e]||[];if(e==="graph"){const k=y.find(v=>v.key==="graph");if(k?.value&&typeof k.value=="object")return k.value[n]??u}return y.find(k=>k.key===n)?.value??u}function Ze(){return[{id:"llm",label:"LLM Providers",icon:"M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"},{id:"models",label:"Model Metadata",icon:"M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"},{id:"queue",label:"LLM Queue",icon:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"},{id:"graph",label:"Graph",icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"},{id:"ontology",label:"Ontology",icon:"M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"},{id:"prompts",label:"Prompts",icon:"M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"},{id:"processing",label:"Processing",icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"},{id:"team-analysis",label:"Team Analysis",icon:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"},{id:"google-drive",label:"Google Drive",icon:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"},{id:"billing",label:"Billing",icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"},{id:"audit",label:"Audit Log",icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"}].map(n=>`
    <button class="admin-nav-btn ${z===n.id?"active":""}" data-section="${n.id}">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${n.icon}"/>
      </svg>
      <span>${n.label}</span>
    </button>
  `).join("")}function He(){const e=["text","vision","embeddings"];return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>LLM Provider Configuration</h3>
        <p>Configure AI providers for different task types</p>
      </div>

      <!-- Provider Status -->
      <div class="admin-card">
        <h4>Provider Health</h4>
        <div class="provider-grid">
          ${W.map(n=>`
            <div class="provider-card ${n.enabled?"enabled":"disabled"}">
              <div class="provider-header">
                <span class="provider-name">${n.name}</span>
                <span class="provider-status ${n.status||"unknown"}">${n.status||"unknown"}</span>
              </div>
              <div class="provider-models">${n.models&&n.models.length>0?n.models.slice(0,3).join(", "):"—"}</div>
              <div class="provider-actions">
                <button class="btn btn-sm btn-secondary" data-test-provider="${n.id}">Test</button>
                <label class="toggle-switch">
                  <input type="checkbox" ${n.enabled?"checked":""} data-toggle-provider="${n.id}">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Task Configuration -->
      <div class="admin-card">
        <h4>Task-Specific AI Configuration</h4>
        <p class="text-muted">Configure which provider and model to use for each AI task. These settings apply globally to the platform and are persisted in Supabase.</p>
        
        ${e.map(n=>{const u=E("llm",n+"_provider",{provider:"",model:""}),y={text:"💬",vision:"👁️",embeddings:"🔗"},x={text:"Text / Chat",vision:"Vision / Images",embeddings:"Embeddings"},k={text:"Document analysis, chat, briefings, Q&A, extraction",vision:"Image analysis, scanned documents, diagrams, charts",embeddings:"Semantic search, similarity matching, RAG"},v=y[n]||"⚙️",w=x[n]||n,J=k[n]||"",oe=["openai","anthropic","google","deepseek","grok","kimi","minimax","ollama"],D={openai:"OpenAI",anthropic:"Anthropic (Claude)",google:"Google AI (Gemini)",deepseek:"DeepSeek",grok:"xAI (Grok)",kimi:"Kimi (Moonshot)",minimax:"MiniMax",ollama:"Ollama (Local)"};return'<div class="task-config-row admin-task-config-row" data-task-row="'+n+'"><div class="task-label admin-task-label"><span class="admin-task-label-icon">'+v+'</span><strong class="admin-task-label-strong">'+w+'</strong><span class="text-muted admin-task-desc">'+J+'</span></div><div class="task-selects admin-task-selects"><div><label class="admin-field-label">Provider</label><select class="form-select provider-select" data-task="'+n+'" data-field="provider"><option value=""'+(u.provider?"":" selected")+">-- Select Provider --</option>"+oe.map(G=>'<option value="'+G+'"'+(u.provider===G?" selected":"")+">"+D[G]+"</option>").join("")+'</select></div><div><label class="admin-field-label">Model</label><select class="form-select model-select" data-task="'+n+'" data-field="model"><option value="">-- Select Provider First --</option>'+(u.model?'<option value="'+u.model+'" selected>'+u.model+"</option>":"")+'</select><span class="model-loading hidden" data-task="'+n+'">Loading models...</span></div></div><div class="model-status admin-model-status" data-task="'+n+'"></div></div>'}).join("")}
        
        <div class="admin-llm-save-row">
          <button class="btn btn-primary" id="save-llm-config">Save LLM Configuration</button>
          <span class="text-muted admin-llm-warning">⚠️ Changes apply immediately to all AI processing</span>
        </div>
      </div>

      <!-- API Keys - LLM Providers -->
      <div class="admin-card">
        <h4>LLM API Keys</h4>
        <p class="text-muted">System-level API keys (stored encrypted in Supabase)</p>
        
        <div class="api-keys-grid" id="api-keys-container">
          <div class="form-group" data-secret-name="OPENAI_API_KEY">
            <label>OpenAI <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="openai-key" name="llm_key_openai_${Date.now()}" placeholder="sk-proj-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="openai-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="CLAUDE_API_KEY">
            <label>Anthropic (Claude) <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="anthropic-key" name="llm_key_claude_${Date.now()}" placeholder="sk-ant-api03-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="anthropic-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="GOOGLE_API_KEY">
            <label>Google AI (Gemini) <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="google-key" name="llm_key_google_${Date.now()}" placeholder="AIza..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="google-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="XAI_API_KEY">
            <label>xAI (Grok) <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="xai-key" name="llm_key_xai_${Date.now()}" placeholder="xai-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="xai-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="DEEPSEEK_API_KEY">
            <label>DeepSeek <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="deepseek-key" name="llm_key_deepseek_${Date.now()}" placeholder="sk-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="deepseek-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="KIMI_API_KEY">
            <label>Kimi (Moonshot) <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="kimi-key" name="llm_key_kimi_${Date.now()}" placeholder="sk-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="kimi-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="MINIMAX_API_KEY">
            <label>MiniMax <span class="key-status admin-key-status"></span></label>
            <div class="input-group">
              <input type="text" id="minimax-key" name="llm_key_minimax_${Date.now()}" placeholder="MINIMAX-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn btn-sm btn-ghost" data-toggle-visibility="minimax-key">Show</button>
            </div>
          </div>
        </div>
        
        <div id="api-keys-loading" class="admin-keys-loading">Loading configured keys...</div>
        <button class="btn btn-primary mt-4" id="save-api-keys">Save LLM API Keys</button>
      </div>

      <!-- Service API Keys -->
      <div class="admin-card">
        <h4>Service API Keys</h4>
        <p class="text-muted">Keys for email, notifications and other services</p>
        
        <div class="form-group" data-secret-name="RESEND_API_KEY">
          <label>Resend API Key (Email Service) <span class="key-status admin-key-status"></span></label>
          <div class="input-group">
            <input type="text" id="resend-key" name="service_key_resend_${Date.now()}" placeholder="re_..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
            <button class="btn btn-sm btn-ghost" data-toggle-visibility="resend-key">Show</button>
          </div>
        </div>
        
        <div class="form-group" data-secret-name="BRAVE_API_KEY">
          <label>Brave Search API Key (Company analysis) <span class="key-status admin-key-status"></span></label>
          <div class="input-group">
            <input type="password" id="brave-key" name="service_key_brave_${Date.now()}" placeholder="Optional – for richer company reports" class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
            <button class="btn btn-sm btn-ghost" data-toggle-visibility="brave-key">Show</button>
          </div>
          <p class="text-muted text-sm">Get key at <a href="https://api-dashboard.search.brave.com/documentation" target="_blank" rel="noopener">Brave Search API</a>. Used to enrich company analysis with web search.</p>
        </div>
        
        <button class="btn btn-primary mt-4" id="save-service-keys">Save Service Keys</button>
      </div>
    </div>
  `}function et(){const e={enabled:E("graph","enabled",!1),graphName:E("graph","graphName","godmode")};return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Graph Database Configuration</h3>
        <p>Supabase Graph for knowledge graph and GraphRAG</p>
      </div>

      <div class="admin-card">
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="graph-enabled" ${e.enabled?"checked":""}>
            <span>Enable Graph Database</span>
          </label>
        </div>

        <div class="form-group admin-form-group-box">
          <p class="admin-form-group-p">
            <strong>Provider:</strong> Supabase Graph (PostgreSQL-based)
          </p>
          <p class="admin-form-group-p-sm">
            Uses your existing Supabase connection. No additional configuration needed.
          </p>
        </div>

        <div class="form-group">
          <label>Graph Name</label>
          <input type="text" id="graph-name" value="${e.graphName}" class="form-input" placeholder="godmode">
        </div>

        <div class="btn-group mt-4">
          <button class="btn btn-primary" id="save-graph-config">Save Configuration</button>
          <button class="btn btn-secondary" id="test-graph-connection">Test Connection</button>
        </div>
      </div>

      <div class="admin-card" id="graph-overview-card">
        <h4>Graph overview</h4>
        <p class="text-muted">Current graph status. Enable and save configuration above first.</p>
        <div id="graph-overview-content">
          ${me?'<p class="text-muted">Loading...</p>':Ue?U.length===0&&!q?.enabled?'<p class="text-muted">Graph not enabled or not connected. Enable and save configuration.</p><button class="btn-secondary mt-4" id="refresh-graph-overview">Refresh</button>':`
            ${q?.enabled&&(q.stats!=null||q.graphName)?`
              <div class="graph-status-row admin-graph-status-row">
                <strong>Current graph:</strong> ${q.graphName??"—"}
                ${q.stats?.nodes!==void 0?` · Nodes: ${q.stats.nodes}`:""}
                ${q.stats?.relationships!==void 0?` · Edges: ${q.stats.relationships}`:""}
              </div>
            `:""}
            ${U.length>0?`
              <table class="admin-table admin-table-full">
                <thead><tr><th>Graph name</th><th>Project</th></tr></thead>
                <tbody>
                  ${U.map(n=>`<tr><td><code>${n.graphName}</code></td><td>${n.projectName??"—"}</td></tr>`).join("")}
                </tbody>
              </table>
            `:""}
            <div class="btn-group mt-4">
              <button class="btn btn-secondary" id="open-graph-tab">Open in Graph tab</button>
              <button class="btn btn-secondary" id="refresh-graph-overview">Refresh</button>
            </div>
          `:'<button class="btn btn-secondary" id="load-graph-overview">Load overview</button>'}
        </div>
      </div>
    </div>
  `}function tt(){return Y||!ge?`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Ontology</h3>
        <p>Entity types and relation types used by extraction and GraphRAG</p>
      </div>
      <div class="admin-card">
        <p class="text-muted">${Y?"Loading ontology...":"Click Load to fetch entity and relation types from the API."}</p>
        ${Y?"":'<button class="btn btn-primary" id="load-ontology">Load ontology</button>'}
      </div>
    </div>
    `:`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Ontology</h3>
        <p>Entity types and relation types used by extraction and GraphRAG</p>
      </div>

      <div class="admin-card">
        <h4>Entity types</h4>
        <p class="text-muted">Types of entities that can be extracted and stored in the graph.</p>
        ${ee.length===0?'<p class="text-muted">No entity types returned.</p>':`
          <ul class="ontology-list">
            ${ee.map(e=>`
              <li><code>${e.name}</code>
                ${e.sharedEntity?' <span class="badge badge-info">shared</span>':""}
                ${e.properties?.length?` · properties: ${e.properties.join(", ")}`:""}
              </li>
            `).join("")}
          </ul>
        `}
      </div>

      <div class="admin-card">
        <h4>Relation types</h4>
        <p class="text-muted">Allowed relationships between entity types.</p>
        ${te.length===0?'<p class="text-muted">No relation types returned.</p>':`
          <ul class="ontology-list">
            ${te.map(e=>`
              <li><code>${e.name}</code>
                ${e.sourceType?` (${e.sourceType} → ${e.targetType})`:""}
              </li>
            `).join("")}
          </ul>
        `}
      </div>

      <div class="btn-group mt-4">
        <button class="btn btn-secondary" id="reload-ontology">Reload ontology</button>
      </div>
    </div>
  `}function at(){const e=F.filter(v=>v.category==="extraction"),n=F.filter(v=>v.category==="analysis"),u=F.filter(v=>v.category==="template"),y=F.filter(v=>v.category==="sprint"),x=F.filter(v=>v.category==="report"),k=v=>`
    <div class="admin-card prompt-card" data-prompt-id="${v.id}">
      <div class="prompt-header">
        <div>
          <h4>${v.name}</h4>
          <p class="text-muted">${v.description}</p>
        </div>
        <div class="prompt-badges">
          ${v.uses_ontology?'<span class="badge badge-info">Ontology-Aware</span>':""}
          <span class="badge badge-secondary">${v.key}</span>
        </div>
      </div>
      <textarea class="form-textarea prompt-editor" data-prompt-key="${v.key}" rows="12" 
                placeholder="Enter prompt template...

Available placeholders:
{{CONTENT}} - The document/transcript content
{{FILENAME}} - The file/document name
{{TODAY}} - Current date
{{ONTOLOGY_SECTION}} - Ontology context (if uses_ontology=true)
{{ROLE_CONTEXT}} - User role context
{{PROJECT_CONTEXT}} - Project context">${v.prompt_template||""}</textarea>
      <div class="prompt-actions">
        <button class="btn btn-sm btn-secondary" data-view-versions="${v.key}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          Version History
        </button>
        <span class="prompt-status" id="status-${v.key}"></span>
      </div>
      <div class="version-history hidden" id="versions-${v.key}">
        <div class="version-list"></div>
      </div>
    </div>
  `;return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>AI Prompts Configuration</h3>
        <p>Customize ontology-aware prompts for AI extraction. All prompts support template variables.</p>
      </div>

      <div class="prompt-info admin-card">
        <h4>Template Variables</h4>
        <div class="variables-grid">
          <code>{{CONTENT}}</code> <span>Document/transcript content</span>
          <code>{{FILENAME}}</code> <span>File or document name</span>
          <code>{{TODAY}}</code> <span>Current date (YYYY-MM-DD)</span>
          <code>{{ONTOLOGY_SECTION}}</code> <span>Injected ontology context</span>
          <code>{{ROLE_CONTEXT}}</code> <span>User role context line</span>
          <code>{{PROJECT_CONTEXT}}</code> <span>Project context line</span>
          <code>{{CONTENT_LENGTH}}</code> <span>Content length in characters</span>
        </div>
      </div>

      <h4 class="section-subtitle">Extraction Prompts</h4>
      ${e.length>0?e.map(k).join(""):'<p class="text-muted">Run migration 031 to create default prompts</p>'}

      ${n.length>0?`
        <h4 class="section-subtitle">Analysis Prompts</h4>
        ${n.map(k).join("")}
      `:""}

      ${u.length>0?`
        <h4 class="section-subtitle">Template Sections</h4>
        ${u.map(k).join("")}
      `:""}

      ${y.length>0?`
        <h4 class="section-subtitle">Sprint / Task prompts</h4>
        <p class="text-muted">Prompts for task description from rules, user stories, and dependencies. Used when adding tasks manually and in sprint flows.</p>
        ${y.map(k).join("")}
      `:""}

      ${x.length>0?`
        <h4 class="section-subtitle">Report prompts (Relatórios)</h4>
        <p class="text-muted">Prompts for generating sprint reports as A4 document or PPT-style presentation. Placeholders: {{REPORT_DATA}}, {{STYLE_VARIANT}} (document only).</p>
        ${x.map(k).join("")}
      `:""}

      <div class="btn-group mt-4">
        <button class="btn-primary" id="save-prompts">Save All Prompts</button>
        <button class="btn-secondary" id="reload-prompts">Reload from Database</button>
      </div>
    </div>
  `}function st(){const e={chunkSize:E("processing","chunk_size",1e3),chunkOverlap:E("processing","chunk_overlap",200),maxTokens:E("processing","max_tokens",4096),temperature:E("processing","temperature",.7),autoProcess:E("processing","auto_process",!0),parallelJobs:E("processing","parallel_jobs",3)};return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Document Processing Settings</h3>
        <p>Configure how documents are processed and analyzed</p>
      </div>

      <div class="admin-card">
        <h4>Chunking Settings</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label>Chunk Size (tokens)</label>
            <input type="number" id="proc-chunk-size" value="${e.chunkSize}" class="form-input" min="100" max="8000">
          </div>
          <div class="form-group">
            <label>Chunk Overlap (tokens)</label>
            <input type="number" id="proc-chunk-overlap" value="${e.chunkOverlap}" class="form-input" min="0" max="1000">
          </div>
        </div>
      </div>

      <div class="admin-card">
        <h4>Generation Settings</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label>Max Tokens</label>
            <input type="number" id="proc-max-tokens" value="${e.maxTokens}" class="form-input" min="256" max="32000">
          </div>
          <div class="form-group">
            <label>Temperature</label>
            <input type="number" id="proc-temperature" value="${e.temperature}" class="form-input" min="0" max="2" step="0.1">
          </div>
        </div>
      </div>

      <div class="admin-card">
        <h4>Job Settings</h4>
        
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="proc-auto-process" ${e.autoProcess?"checked":""}>
            <span>Auto-process uploaded documents</span>
          </label>
        </div>
        
        <div class="form-group">
          <label>Parallel Jobs</label>
          <input type="number" id="proc-parallel-jobs" value="${e.parallelJobs}" class="form-input" min="1" max="10">
        </div>
      </div>

      <button class="btn-primary" id="save-processing">Save Processing Settings</button>
    </div>
  `}async function ze(){if(!ne.getState().currentProject?.id){N={enabled:!0,access:"admin_only"},V=!0;return}Q=!0;try{const u=await m.get("/api/team-analysis/config");N={enabled:u?.data?.config?.enabled??!0,access:u?.data?.config?.access??"admin_only"},V=!0}catch(u){console.error("[AdminPanel] Error loading team analysis settings:",u),N={enabled:!0,access:"admin_only"},V=!0}finally{Q=!1}}async function it(e,n){if(!ne.getState().currentProject?.id){o.error("No project selected");return}try{await m.put("/api/team-analysis/config",{enabled:e,access:n}),N={enabled:e,access:n},o.success("Team Analysis settings saved")}catch(x){console.error("[AdminPanel] Error saving team analysis settings:",x),o.error("Failed to save settings")}}async function Z(){ie=!0;try{const e=await m.get("/api/system/google-drive");pe={enabled:e.data.enabled??!1,rootFolderId:e.data.rootFolderId??"",hasSystemCredentials:e.data.hasSystemCredentials??!1,bootstrappedAt:e.data.bootstrappedAt??null},O=!0}catch(e){console.error("[AdminPanel] Error loading Google Drive config:",e),pe={enabled:!1,rootFolderId:"",hasSystemCredentials:!1,bootstrappedAt:null},O=!0}finally{ie=!1}}function nt(){if(ie||!O)return!ie&&!O&&Z(),`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Google Drive</h3>
        <p>Store uploads and transcripts in Google Drive</p>
      </div>
      <div class="admin-card">
        <div class="admin-empty-state"><div class="loading-spinner"></div><p>Loading...</p></div>
      </div>
    </div>`;const e=pe;return`
  <div class="admin-section">
    <div class="admin-section-header">
      <h3>Google Drive</h3>
      <p>Store uploads and transcripts in Google Drive. Configure system account and root folder, then bootstrap projects.</p>
    </div>
    <div class="admin-card">
      <h4>Integration</h4>
      <div class="form-group admin-form-group-box">
        <label class="admin-checkbox-label">
          <input type="checkbox" id="google-drive-enabled" ${e.enabled?"checked":""}>
          Enable Google Drive for uploads
        </label>
      </div>
      <div class="form-group admin-form-group-box">
        <label class="admin-field-label-block">Root Folder ID</label>
        <input type="text" id="google-drive-root-folder" class="form-input" placeholder="Google Drive folder ID" value="${(e.rootFolderId||"").replace(/"/g,"&quot;")}">
        <p class="text-muted admin-field-hint">Create a folder in Google Drive and paste its ID here. All project folders will be created under it.</p>
      </div>
      <div class="form-group admin-form-group-box">
        <label class="admin-field-label-block">System Service Account JSON</label>
        <textarea id="google-drive-service-json" class="form-input" rows="4" placeholder="${e.hasSystemCredentials?"Already configured. Paste new JSON to replace.":"Paste the full JSON key file content"}"></textarea>
        ${e.hasSystemCredentials?'<p class="text-muted">Credentials are stored. Paste new JSON only to replace.</p>':""}
      </div>
      <button type="button" class="btn-primary" id="save-google-drive">Save Google Drive config</button>
    </div>
    <div class="admin-card">
      <h4>Bootstrap projects</h4>
      <p class="text-muted admin-mb-4">Create folder structure (uploads, newtranscripts, archived, exports) for all projects under the root folder.</p>
      <button type="button" class="btn-secondary" id="bootstrap-google-drive">Bootstrap all projects</button>
      ${e.bootstrappedAt?`<p class="text-muted admin-mt-2">Last run: ${e.bootstrappedAt}</p>`:""}
    </div>
  </div>`}function ot(){const e=ne.getState(),n=e.currentProject?.id,u=e.currentProject?.name||"Unknown";return n?Q||!V?(!Q&&!V&&ze(),`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Team Analysis Settings</h3>
        <p>Configure access control for behavioral analysis features</p>
      </div>
      
      <div class="admin-card">
        <div class="admin-empty-state">
          <div class="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    </div>
    `):`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Team Analysis Settings</h3>
        <p>Configure access control for behavioral analysis features</p>
      </div>

      <!-- Current Project Info -->
      <div class="admin-card">
        <h4>Current Project</h4>
        <div class="admin-project-preview">
          <div class="admin-project-preview-icon">${u.charAt(0).toUpperCase()}</div>
          <div>
            <div class="admin-project-name">${u}</div>
            <div class="admin-project-id">ID: ${n}</div>
          </div>
        </div>
      </div>

      <!-- Feature Toggle -->
      <div class="admin-card">
        <h4>Feature Status</h4>
        <p class="text-muted admin-mb-4">Enable or disable Team Analysis for this project</p>
        
        <div class="form-group">
          <label class="toggle-label admin-toggle-label">
            <input type="checkbox" id="team-analysis-enabled" ${N.enabled?"checked":""} class="admin-checkbox">
            <div>
              <span class="admin-toggle-title">Enable Team Analysis</span>
              <p class="admin-toggle-desc">When enabled, users with access can analyze team member behavior from meeting transcripts</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Access Control -->
      <div class="admin-card">
        <h4>Access Control</h4>
        <p class="text-muted admin-mb-4">Define who can access Team Analysis features</p>
        
        <div class="form-group">
          <label class="admin-field-label-block">Access Level</label>
          <select id="team-analysis-access" class="form-input admin-select-max">
            <option value="admin_only" ${N.access==="admin_only"?"selected":""}>Admins Only - Only project owner and admins can access</option>
            <option value="all" ${N.access==="all"?"selected":""}>All Members - All project members can access</option>
          </select>
          <p class="admin-field-hint">
            <strong>Admins Only:</strong> Restricts access to sensitive behavioral analysis to project owner and administrators.<br>
            <strong>All Members:</strong> Allows all project collaborators to view and run team analysis.
          </p>
        </div>
      </div>

      <!-- Analysis Scope Info -->
      <div class="admin-card">
        <h4>How It Works</h4>
        <div class="admin-steps-grid">
          <div class="admin-step-row">
            <div class="admin-step-num">1</div>
            <div>
              <div class="admin-step-title">Contact-Based Analysis</div>
              <div class="admin-step-desc">Analysis is performed on contacts defined in the project. Contacts can have aliases to match different name variations in transcripts.</div>
            </div>
          </div>
          <div class="admin-step-row">
            <div class="admin-step-num">2</div>
            <div>
              <div class="admin-step-title">Incremental Learning</div>
              <div class="admin-step-desc">Profiles are refined iteratively as more transcripts are processed, building evidence over time.</div>
            </div>
          </div>
          <div class="admin-step-row">
            <div class="admin-step-num">3</div>
            <div>
              <div class="admin-step-title">Privacy Consideration</div>
              <div class="admin-step-desc">Behavioral analysis may contain sensitive insights. Configure access carefully.</div>
            </div>
          </div>
        </div>
      </div>

      <button class="btn-primary admin-mt-2" id="save-team-analysis">Save Team Analysis Settings</button>
    </div>
  `:`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Team Analysis Settings</h3>
        <p>Configure access control for behavioral analysis features</p>
      </div>
      
      <div class="admin-card">
        <div class="admin-empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p>Please select a project to configure Team Analysis settings.</p>
        </div>
      </div>
    </div>
    `}function rt(){return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>LLM Processing Queue</h3>
        <p>Monitor and control AI request processing - All requests are persisted in database</p>
      </div>

      <!-- Queue Status -->
      <div class="admin-card" id="queue-status-card">
        <div class="admin-card-header">
          <h4>Queue Status</h4>
          <div class="admin-card-actions">
            <span id="db-status-badge" class="badge admin-badge-sm">DB: Checking...</span>
            <button class="btn-sm" id="refresh-queue-status">↻ Refresh</button>
          </div>
        </div>
        
        <div id="queue-status-content" class="admin-placeholder">
          Loading queue status...
        </div>
      </div>

      <!-- Queue Controls -->
      <div class="admin-card">
        <h4>Queue Controls</h4>
        <p class="text-muted">Control queue processing behavior</p>
        
        <div class="admin-actions-row">
          <button class="btn-primary" id="queue-pause-btn">⏸ Pause Queue</button>
          <button class="btn-primary" id="queue-resume-btn">▶ Resume Queue</button>
          <button class="btn-secondary admin-btn-warning" id="queue-clear-btn">🗑 Clear Queue</button>
        </div>
      </div>

      <!-- Statistics -->
      <div class="admin-card">
        <h4>Queue Statistics (Today)</h4>
        <div id="queue-stats-content" class="admin-stats-grid">
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value admin-stat-primary" id="stat-pending">-</div>
            <div class="admin-stat-label">Pending</div>
          </div>
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value admin-stat-info" id="stat-processing">-</div>
            <div class="admin-stat-label">Processing</div>
          </div>
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value admin-stat-success" id="stat-success">-</div>
            <div class="admin-stat-label">Completed</div>
          </div>
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value admin-stat-error" id="stat-failed">-</div>
            <div class="admin-stat-label">Failed</div>
          </div>
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value admin-stat-warning" id="stat-retry">-</div>
            <div class="admin-stat-label">Retry Pending</div>
          </div>
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value" id="stat-avg-time">-</div>
            <div class="admin-stat-label">Avg Time (ms)</div>
          </div>
          <div class="stat-box admin-stat-box">
            <div class="admin-stat-value admin-stat-success" id="stat-cost">$-</div>
            <div class="admin-stat-label">Cost Today</div>
          </div>
        </div>
      </div>

      <!-- Queue Items -->
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>Pending Items</h4>
          <span id="pending-count" class="text-muted">0 items</span>
        </div>
        
        <div id="queue-items-content" class="admin-scroll-content admin-scroll-300">
          <div class="admin-placeholder">
            No items in queue
          </div>
        </div>
      </div>

      <!-- Failed Items (Retryable) -->
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>Failed Items</h4>
          <div class="admin-card-actions">
            <button class="btn-sm btn-primary" id="retry-all-btn">↻ Retry All</button>
            <button class="btn-sm" id="refresh-failed-btn">↻ Refresh</button>
          </div>
        </div>
        
        <div id="failed-items-content" class="admin-scroll-content admin-scroll-300">
          <div class="admin-placeholder">
            No failed items
          </div>
        </div>
      </div>

      <!-- Recent History -->
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>Recent Processing History</h4>
          <button class="btn-sm" id="refresh-queue-history">↻ Refresh</button>
        </div>
        
        <div id="queue-history-content" class="admin-scroll-content admin-scroll-400">
          <div class="admin-placeholder">
            Loading history...
          </div>
        </div>
      </div>
    </div>
  `}async function R(){console.log("[AdminPanel] loadBillingData() starting...");try{console.log("[AdminPanel] Calling billing API...");const[e,n,u,y]=await Promise.all([C.getAllProjectsBilling(),C.getGlobalPricingConfig(),C.getGlobalPricingTiers(),C.getExchangeRateConfig()]);console.log("[AdminPanel] API responses:",{projects:e,config:n,tiersData:u,exchangeRate:y}),H=e,K=n,A=u.tiers,L=y,M=!0,console.log("[AdminPanel] Loaded billing data:",{projects:e.length,config:!!n,tiers:u.tiers.length,exchangeRate:y?.currentRate})}catch(e){console.error("[AdminPanel] Error loading billing data:",e),o.error("Failed to load billing data")}finally{se=!1}}function lt(){return se&&!M?`
      <div class="admin-section">
        <div class="admin-section-header">
          <h3>Billing & Cost Control</h3>
          <p>Manage project balances, pricing, and cost limits</p>
        </div>
        <div class="admin-card admin-loading-card">
          <div class="spinner"></div>
          <p class="admin-loading-p">Loading billing data...</p>
        </div>
      </div>
    `:(A.length>0&&A.map((e,n)=>{const u=n>0?A[n-1].token_limit:0,y=de(u||0),x=e.token_limit?de(e.token_limit):"∞";return`${e.name||`Tier ${n+1}`}: ${y}-${x} tokens → +${e.markup_percent}%`}).join("<br>"),`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Billing & Cost Control</h3>
        <p>Manage project balances, pricing, and cost limits</p>
      </div>

      <!-- Exchange Rate Configuration -->
      <div class="admin-card">
        <h4 class="admin-h4-mb">Exchange Rate (USD to EUR)</h4>
        
        <div class="admin-exchange-grid">
          <div>
            <div class="form-group">
              <label class="admin-checkbox-label">
                <input type="checkbox" id="exchange-rate-auto" ${L?.auto!==!1?"checked":""}>
                <span>Automatic rate from API</span>
              </label>
              <small class="text-muted">Fetches live USD/EUR rate daily</small>
            </div>
            
            <div class="form-group ${L?.auto!==!1?"hidden":""}" id="manual-rate-group">
              <label>Manual Rate</label>
              <input type="number" id="exchange-rate-manual" class="form-input" 
                     value="${L?.manualRate??.92}" min="0.01" max="2" step="0.001">
            </div>
          </div>
          
          <div class="admin-rate-block">
            <div class="admin-rate-label">Current Rate</div>
            <div class="admin-rate-value" id="current-rate-display">
              ${L?.currentRate?.toFixed(4)??"0.9200"}
            </div>
            <div class="admin-rate-meta">
              Source: <span id="rate-source">${L?.source??"default"}</span>
              ${L?.lastUpdated?`<br>Updated: ${new Date(L.lastUpdated).toLocaleString()}`:""}
            </div>
            <button class="btn-sm btn-secondary admin-rate-refresh" id="refresh-rate-btn" ${L?.auto===!1?"disabled":""}>
              Refresh Rate
            </button>
          </div>
        </div>
        
        <div class="admin-actions-end">
          <button class="btn-primary" id="save-exchange-rate-btn">Save Exchange Rate Settings</button>
        </div>
      </div>

      <!-- Global Pricing Configuration -->
      <div class="admin-card">
        <h4 class="admin-h4-mb">Global Pricing Configuration</h4>
        
        <div class="admin-form-grid admin-form-grid-2">
          <div class="form-group">
            <label>Fixed Markup (%)</label>
            <input type="number" id="global-markup-percent" class="form-input" 
                   value="${K?.fixed_markup_percent??0}" min="0" max="500" step="0.1">
            <small class="text-muted">Applied when no tier matches</small>
          </div>
          
          <div class="form-group">
            <label>Period Type</label>
            <select id="global-period-type" class="form-input">
              <option value="monthly" ${K?.period_type==="monthly"?"selected":""}>Monthly</option>
              <option value="weekly" ${K?.period_type==="weekly"?"selected":""}>Weekly</option>
            </select>
            <small class="text-muted">Tier reset period</small>
          </div>
        </div>
        
        <div class="admin-actions-end">
          <button class="btn-primary" id="save-global-pricing-btn">Save Global Pricing</button>
        </div>
      </div>
      
      <!-- Pricing Tiers -->
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h4>Pricing Tiers (Volume Discount)</h4>
            <p class="text-muted admin-subtitle">
              Lower markup as projects consume more tokens per period
            </p>
          </div>
          <button class="btn-sm btn-primary" id="add-tier-btn">+ Add Tier</button>
        </div>
        
        <div id="pricing-tiers-list">
          ${A.length>0?A.map((e,n)=>`
            <div class="tier-row admin-tier-row" data-tier-index="${n}">
              <input type="text" class="form-input tier-name" placeholder="Tier Name" value="${e.name||`Tier ${n+1}`}">
              <input type="number" class="form-input tier-limit" placeholder="Token Limit" value="${e.token_limit||""}" min="0" ${e.token_limit===null?"disabled":""}>
              <div class="admin-tier-markup-wrap">
                <input type="number" class="form-input tier-markup" placeholder="Markup %" value="${e.markup_percent}" min="0" step="0.1">
                <span>%</span>
              </div>
              <div class="admin-tier-actions">
                <label class="admin-tier-unlimited-label">
                  <input type="checkbox" class="tier-unlimited" ${e.token_limit===null?"checked":""}>
                  Unlimited
                </label>
                <button class="btn-sm btn-danger remove-tier-btn" data-index="${n}">✕</button>
              </div>
            </div>
          `).join(""):`
            <div class="admin-placeholder">
              No tiers configured. Using fixed markup of ${K?.fixed_markup_percent??0}% for all usage.
            </div>
          `}
        </div>
        
        ${A.length>0?`
          <div class="admin-actions-end admin-mt-4">
            <button class="btn-primary" id="save-tiers-btn">Save Tiers</button>
          </div>
        `:""}
      </div>

      <!-- Projects Billing Overview -->
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h4>Projects Billing</h4>
            <p class="text-muted admin-subtitle">
              ${H.length} projects | 
              ${H.filter(e=>e.is_blocked).length} blocked | 
              ${H.filter(e=>e.unlimited_balance).length} unlimited
            </p>
          </div>
          <button class="btn-sm" id="refresh-billing-btn">↻ Refresh</button>
        </div>
        
        <div class="admin-table-wrap">
          <table class="data-table admin-data-table">
            <thead>
              <tr>
                <th class="admin-th-left">Project</th>
                <th class="admin-th-right">Balance</th>
                <th class="admin-th-center">Status</th>
                <th class="admin-th-right">Tokens (Period)</th>
                <th class="admin-th-right">Cost (Period)</th>
                <th class="admin-th-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${H.length>0?H.map(e=>`
                <tr class="admin-tr">
                  <td class="admin-td admin-td-project">
                    <div class="admin-td-project-name">${Ke(e.project_name)}</div>
                    ${e.current_tier_name?`<small class="text-muted">Tier: ${e.current_tier_name}</small>`:""}
                  </td>
                  <td class="admin-td admin-td-right">
                    ${e.unlimited_balance?'<span class="admin-unlimited">∞ Unlimited</span>':Oe(e.balance_eur)}
                  </td>
                  <td class="admin-td admin-td-center">
                    ${e.is_blocked?'<span class="badge badge-danger">Blocked</span>':e.unlimited_balance?'<span class="badge badge-success">Unlimited</span>':'<span class="badge badge-primary">Active</span>'}
                  </td>
                  <td class="admin-td admin-td-right">${de(e.tokens_this_period)}</td>
                  <td class="admin-td admin-td-right">${Oe(e.billable_cost_this_period)}</td>
                  <td class="admin-td admin-td-center">
                    <div class="admin-td-actions">
                      <button class="btn-sm add-balance-btn" data-project-id="${e.project_id}" data-project-name="${Ke(e.project_name)}" title="Add Balance">💰</button>
                      <button class="btn-sm toggle-unlimited-btn" data-project-id="${e.project_id}" data-unlimited="${e.unlimited_balance}" title="${e.unlimited_balance?"Disable Unlimited":"Enable Unlimited"}">
                        ${e.unlimited_balance?"🔓":"🔒"}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join(""):`
                <tr>
                  <td colspan="6" class="admin-placeholder">
                    No projects found
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `)}function Ke(e){const n=document.createElement("div");return n.textContent=e,n.innerHTML}function dt(){return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Configuration Audit Log</h3>
        <p>Track all configuration changes</p>
      </div>

      <div class="admin-card">
        <div class="audit-filters">
          <select id="audit-filter-table" class="form-select">
            <option value="">All Tables</option>
            <option value="system_config">System Config</option>
            <option value="project_config">Project Config</option>
            <option value="secrets">Secrets</option>
          </select>
          <button class="btn-secondary" id="refresh-audit">Refresh</button>
        </div>

        <div class="audit-log-list">
          ${ae.length===0?`
            <div class="empty-state">
              <p>No audit logs found</p>
            </div>
          `:ae.map(e=>`
            <div class="audit-log-item">
              <div class="audit-log-header">
                <span class="audit-operation ${e.operation.toLowerCase()}">${e.operation}</span>
                <span class="audit-table">${e.table_name}</span>
                <span class="audit-time">${new Date(e.changed_at).toLocaleString()}</span>
              </div>
              <div class="audit-log-details">
                <span class="audit-user">${e.changed_by_email||"System"}</span>
                ${e.new_values?`<pre class="audit-values">${JSON.stringify(e.new_values,null,2)}</pre>`:""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `}function ct(){return`
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>LLM Model Metadata</h3>
        <p>Manage model information, pricing, and capabilities from database</p>
      </div>
      
      <!-- Sync Controls -->
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>Sync Model Metadata</h4>
          <button class="btn btn-primary" id="sync-all-metadata-btn">
            ↻ Sync All Providers
          </button>
        </div>
        <p class="admin-desc admin-mb-4">
          Fetch the latest model list from each configured provider API and update the database with current models and capabilities.
          Pricing information is updated from known sources.
        </p>
        
        <div id="metadata-sync-status" class="admin-mb-4">
          <div class="admin-placeholder">
            Loading sync status...
          </div>
        </div>
        
        <div id="metadata-sync-result" class="hidden"></div>
      </div>
      
      <!-- Provider Status -->
      <div class="admin-card">
        <h4 class="admin-h4-mb">Provider Model Count</h4>
        <div id="provider-model-counts">
          <div class="admin-placeholder">
            Loading...
          </div>
        </div>
      </div>
      
      <!-- Model Browser -->
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>Browse Models</h4>
          <div class="admin-card-actions">
            <select id="browse-provider-select" class="form-select admin-select-min">
              <option value="">Select Provider</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="grok">Grok (xAI)</option>
              <option value="deepseek">DeepSeek</option>
            </select>
            <button class="btn btn-secondary" id="browse-models-btn">Load Models</button>
          </div>
        </div>
        
        <div id="models-browser-content">
          <div class="admin-empty-state">
            Select a provider to browse available models
          </div>
        </div>
      </div>
    </div>
  `}function mt(){switch(z){case"llm":return He();case"models":return ct();case"graph":return et();case"ontology":return tt();case"queue":return rt();case"prompts":return at();case"processing":return st();case"team-analysis":return ot();case"google-drive":return nt();case"billing":return lt();case"audit":return dt();default:return He()}}function ut(e){e.querySelectorAll(".admin-nav-btn").forEach(a=>{d(a,"click",async()=>{const s=a.getAttribute("data-section")||"llm";z=s,s==="team-analysis"?(V=!1,Q=!1,g(e),await ze(),g(e)):s==="google-drive"?(O=!1,g(e),await Z(),g(e)):(s==="billing"&&!M&&!se&&(se=!0,g(e),await R()),g(e))})}),e.querySelectorAll("[data-toggle-visibility]").forEach(a=>{d(a,"click",()=>{const s=a.getAttribute("data-toggle-visibility");if(s){const t=e.querySelector(`#${s}`);t&&(t.type=t.type==="password"?"text":"password",a.textContent=t.type==="password"?"Show":"Hide")}})}),e.querySelectorAll("[data-test-provider]").forEach(a=>{d(a,"click",async()=>{const s=a.getAttribute("data-test-provider");s&&(a.textContent="Testing...",await We(s),a.textContent="Test")})});const n={};async function u(a,s){const t=e.querySelector(`select.model-select[data-task="${s}"]`),i=e.querySelector(`.model-loading[data-task="${s}"]`),l=e.querySelector(`.model-status[data-task="${s}"]`);if(!t||!a){t&&(t.innerHTML='<option value="">-- Select Provider First --</option>');return}i&&i.classList.remove("hidden"),t.disabled=!0;try{if(!n[a]){const c=await m.get(`/api/llm/models?provider=${a}`);n[a]={textModels:(c.data.textModels||[]).map(f=>f.id||f.name||"").filter(Boolean),visionModels:(c.data.visionModels||[]).map(f=>f.id||f.name||"").filter(Boolean),embeddingModels:(c.data.embeddingModels||[]).map(f=>f.id||f.name||"").filter(Boolean)}}let r=[];s==="text"?r=n[a].textModels:s==="vision"?r=n[a].visionModels:s==="embeddings"&&(r=n[a].embeddingModels);const p=t.value;t.innerHTML='<option value="">-- Select Model --</option>'+r.map(c=>`<option value="${c}"${c===p?" selected":""}>${c}</option>`).join(""),l&&(l.textContent=r.length>0?`${r.length} model(s) available`:"No models found for this task type. Check provider configuration.",l.classList.remove("admin-status-success","admin-status-warning","admin-status-error"),l.classList.add(r.length>0?"admin-status-success":"admin-status-warning"))}catch(r){console.error(`Failed to load models for ${a}:`,r),t.innerHTML='<option value="">Error loading models</option>',l&&(l.textContent="Failed to load models. Check API key configuration.",l.classList.remove("admin-status-success","admin-status-warning"),l.classList.add("admin-status-error"))}finally{i&&i.classList.add("hidden"),t.disabled=!1}}e.querySelectorAll("select.provider-select").forEach(a=>{d(a,"change",async()=>{const i=a.getAttribute("data-task"),l=a.value;i&&await u(l,i)});const s=a.getAttribute("data-task"),t=a.value;s&&t&&u(t,s)});const y=e.querySelector("#save-llm-config");y&&d(y,"click",async()=>{const a={};e.querySelectorAll("select[data-task]").forEach(s=>{const t=s.getAttribute("data-task"),i=s.getAttribute("data-field");a[t]||(a[t]={provider:"",model:""}),a[t][i]=s.value});try{for(const[s,t]of Object.entries(a))t.provider&&await j(`${s}_provider`,t,"llm");o.success("LLM configuration saved to Supabase")}catch{o.error("Failed to save LLM configuration")}});async function x(){const a=e.querySelector("#api-keys-loading");try{const s=await m.get("/api/secrets");if(s.data?.success&&s.data.secrets)for(const t of s.data.secrets){const i=e.querySelector(`[data-secret-name="${t.name}"]`);if(i){const l=i.querySelector(".key-status"),r=i.querySelector("input");l&&t.masked_value&&(l.textContent="✓ Configured",l.classList.add("admin-status-success"),r&&(r.placeholder=t.masked_value))}}}catch(s){console.warn("Failed to load API keys status:",s)}finally{a&&a.classList.add("hidden")}}x();const k=e.querySelector("#save-api-keys");k&&d(k,"click",async()=>{const a=[{id:"openai-key",name:"OPENAI_API_KEY"},{id:"anthropic-key",name:"CLAUDE_API_KEY"},{id:"google-key",name:"GOOGLE_API_KEY"},{id:"xai-key",name:"XAI_API_KEY"},{id:"deepseek-key",name:"DEEPSEEK_API_KEY"},{id:"kimi-key",name:"KIMI_API_KEY"},{id:"minimax-key",name:"MINIMAX_API_KEY"}];try{let s=0;for(const t of a){const i=e.querySelector(`#${t.id}`)?.value;i&&i.trim()&&(await m.post("/api/secrets",{name:t.name,value:i.trim(),scope:"system"}),s++)}s>0?o.success(`${s} API key(s) saved securely`):o.info("No API keys to save")}catch{o.error("Failed to save API keys")}});const v=e.querySelector("#save-service-keys");v&&d(v,"click",async()=>{const a=e.querySelector("#resend-key")?.value,s=e.querySelector("#brave-key")?.value;try{let t=0;a&&a.trim()&&(await m.post("/api/secrets",{name:"RESEND_API_KEY",value:a.trim(),scope:"system"}),t++),s&&s.trim()&&(await m.post("/api/secrets",{name:"BRAVE_API_KEY",value:s.trim(),scope:"system"}),t++),t>0?o.success("Service API key(s) saved securely"):o.info("No service keys to save")}catch(t){const i=t?.message;o.error(i&&typeof i=="string"?i:"Failed to save service keys")}});async function w(){const a=e.querySelector("#queue-status-content"),s=e.querySelector("#queue-items-content"),t=e.querySelector("#pending-count"),i=e.querySelector("#db-status-badge");try{const r=(await m.get("/api/llm/queue/status")).data;if(i&&(r.database?(i.className="badge badge-success",i.textContent="DB: Connected"):(i.className="badge badge-warning",i.textContent="DB: Memory Only")),a){const b=r.isPaused?"var(--warning)":r.isProcessing?"var(--success)":"var(--text-tertiary)",_=r.isPaused?"⏸ PAUSED":r.isProcessing?"🔄 PROCESSING":"✓ IDLE";a.innerHTML=`
          <div class="admin-queue-status-grid">
            <div class="admin-queue-stat">
              <div class="admin-queue-stat-value" style="--queue-stat-color: ${b}">${_}</div>
              <div class="admin-queue-stat-label">Queue Status</div>
            </div>
            <div class="admin-queue-stat">
              <div class="admin-queue-stat-value">${r.queueLength}</div>
              <div class="admin-queue-stat-label">Items in Queue</div>
            </div>
            <div class="admin-queue-stat">
              <div class="admin-queue-stat-value admin-queue-stat-primary">${r.isProcessing?"1":"0"}</div>
              <div class="admin-queue-stat-label">Processing Now</div>
            </div>
          </div>
          ${r.currentRequest?`
            <div class="admin-queue-current-box">
              <strong>Currently Processing:</strong> ${r.currentRequest.context||"Unknown"} 
              <span class="admin-queue-current-meta">(Priority: ${r.currentRequest.priority})</span>
              <span class="admin-queue-current-meta admin-queue-current-time">Started: ${new Date(r.currentRequest.startedAt).toLocaleTimeString()}</span>
            </div>
          `:""}
        `}if(s&&t){const b=r.pendingItems?.length||0;t.textContent=`${b} items`,b>0?s.innerHTML=`
            <table class="admin-queue-table admin-queue-table-sm">
              <thead>
                <tr>
                  <th class="admin-queue-th">Context</th>
                  <th class="admin-queue-th">Priority</th>
                  <th class="admin-queue-th">Queued</th>
                  <th class="admin-queue-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${r.pendingItems.map(_=>`
                  <tr>
                    <td class="admin-queue-td">${_.context||"Unknown"}</td>
                    <td class="admin-queue-td"><span class="badge badge-${_.priority}">${_.priority}</span></td>
                    <td class="admin-queue-td">${new Date(_.queuedAt).toLocaleTimeString()}</td>
                    <td class="admin-queue-td"><button class="btn-sm btn-danger" data-cancel-item="${_.id}">Cancel</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `:s.innerHTML='<div class="admin-placeholder">No items in queue</div>'}const p=r.database,c=e.querySelector("#stat-pending"),f=e.querySelector("#stat-processing"),T=e.querySelector("#stat-success"),$=e.querySelector("#stat-failed"),I=e.querySelector("#stat-retry"),h=e.querySelector("#stat-avg-time"),S=e.querySelector("#stat-cost");c&&(c.textContent=String(p?.pendingCount||r.queueLength||0)),f&&(f.textContent=String(p?.processingCount||(r.isProcessing?1:0))),T&&(T.textContent=String(p?.completedToday||r.stats?.successful||0)),$&&($.textContent=String(p?.failedToday||r.stats?.failed||0)),I&&(I.textContent=String(p?.retryPendingCount||0)),h&&(h.textContent=String(Math.round(p?.avgProcessingTimeMs||r.stats?.avgProcessingTime||0))),S&&(S.textContent=`$${(p?.totalCostTodayUsd||0).toFixed(4)}`)}catch(l){console.error("Failed to load queue status:",l),a&&(a.innerHTML='<div class="admin-error-msg">Failed to load queue status</div>')}}async function J(){const a=e.querySelector("#queue-history-content");try{const t=(await m.get("/api/llm/queue/history?limit=50")).data?.history||[];a&&(t.length>0?a.innerHTML=`
            <table class="admin-queue-table">
              <thead>
                <tr>
                  <th class="admin-queue-th">Context</th>
                  <th class="admin-queue-th">Provider/Model</th>
                  <th class="admin-queue-th">Status</th>
                  <th class="admin-queue-th">Tokens</th>
                  <th class="admin-queue-th">Time</th>
                  <th class="admin-queue-th">Completed</th>
                  <th class="admin-queue-th">Details</th>
                </tr>
              </thead>
              <tbody>
                ${t.map(i=>`
                  <tr>
                    <td class="admin-queue-td admin-queue-td-ellipsis" title="${i.context||""}">${i.context||"Unknown"}</td>
                    <td class="admin-queue-td admin-queue-td-sm">${i.provider||"-"}/${i.model||"-"}</td>
                    <td class="admin-queue-td">
                      <span class="admin-queue-status-dot admin-queue-status-${i.status==="completed"?"ok":"err"}">${i.status==="completed"?"✓":"✗"}</span>
                      ${i.error?`<span class="admin-queue-error-hint" title="${i.error}">Error</span>`:""}
                    </td>
                    <td class="admin-queue-td admin-queue-td-sm">${i.inputTokens||"-"}/${i.outputTokens||"-"}</td>
                    <td class="admin-queue-td">${i.processingTime||"-"}ms</td>
                    <td class="admin-queue-td admin-queue-td-sm">${i.completedAt?new Date(i.completedAt).toLocaleString():"-"}</td>
                    <td class="admin-queue-td"><button class="btn-sm" data-view-request="${i.id}">View</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `:a.innerHTML='<div class="admin-placeholder">No processing history yet</div>')}catch(s){console.error("Failed to load queue history:",s),a&&(a.innerHTML='<div class="admin-error-msg">Failed to load history</div>')}}async function oe(a){try{const s=await m.get(`/api/llm/queue/${a}`);if(!s.data.success||!s.data.request){o.error("Request not found");return}const t=s.data.request,i=b=>b?b.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):"",l=b=>{const _=JSON.stringify(b,null,2);return i(_).replace(/"([^"]+)":/g,'<span class="hl-json-key">"$1"</span>:').replace(/: "([^"]*)"/g,': <span class="hl-json-string">"$1"</span>').replace(/: (\d+)/g,': <span class="hl-json-num">$1</span>').replace(/: (true|false|null)/g,': <span class="hl-json-bool">$1</span>')},r=b=>b?i(b).replace(/\\n/g,`
`).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/^(#{1,3})\s*(.+)$/gm,'<span class="hl-prompt-heading">$2</span>').replace(/^[-•]\s*(.+)$/gm,"  • $1").replace(/---+/g,'<hr class="hl-prompt-hr">'):'<span class="hl-prompt-empty">(No content)</span>',c=(b=>({completed:{color:"var(--success)",icon:"✓",bg:"rgba(34, 197, 94, 0.1)"},failed:{color:"var(--error)",icon:"✗",bg:"rgba(239, 68, 68, 0.1)"},processing:{color:"var(--warning)",icon:"⟳",bg:"rgba(234, 179, 8, 0.1)"},pending:{color:"var(--text-secondary)",icon:"○",bg:"var(--bg-tertiary)"},retry_pending:{color:"var(--warning)",icon:"↻",bg:"rgba(234, 179, 8, 0.1)"},cancelled:{color:"var(--text-tertiary)",icon:"⊘",bg:"var(--bg-tertiary)"}})[b]||{color:"var(--text-primary)",icon:"?",bg:"var(--bg-secondary)"})(t.status),f=t.input_data||{},T=f.messages,$=f.prompt||T?.[0]?.content||"",I=document.getElementById("llm-request-details-modal");I&&I.remove();const h=document.createElement("div");h.id="llm-request-details-modal",h.className="modal open",h.className="modal open admin-llm-modal-overlay",h.innerHTML=`
        <div class="modal-content admin-llm-modal-content">
          <div class="modal-header">
            <div class="admin-llm-modal-header-inner">
              <span class="admin-llm-modal-icon" style="--status-bg: ${c.bg}; --status-color: ${c.color}">${c.icon}</span>
              <div>
                <h3 class="admin-llm-modal-title">LLM Request Details</h3>
                <span class="admin-llm-modal-id">ID: ${t.id}</span>
              </div>
            </div>
            <button class="modal-close">&times;</button>
          </div>
          
          <div class="modal-body admin-llm-modal-body">
            <div class="admin-llm-status-bar">
              <div class="admin-llm-status-item">
                <div class="admin-llm-status-label">Context</div>
                <div class="admin-llm-status-value admin-llm-status-accent">${t.context||"Unknown"}</div>
              </div>
              <div class="admin-llm-status-item">
                <div class="admin-llm-status-label">Provider</div>
                <div class="admin-llm-status-value">${t.provider||"-"}</div>
              </div>
              <div class="admin-llm-status-item">
                <div class="admin-llm-status-label">Model</div>
                <div class="admin-llm-status-value admin-llm-status-mono">${t.model||"-"}</div>
              </div>
              <div class="admin-llm-status-item">
                <div class="admin-llm-status-label">Status</div>
                <div class="admin-llm-status-badge" style="--status-bg: ${c.bg}; --status-color: ${c.color}">${c.icon} ${t.status}</div>
              </div>
            </div>
            
            <div class="admin-llm-metrics-grid">
              <div class="admin-llm-metric-box">
                <div class="admin-llm-metric-value">${t.input_tokens?.toLocaleString()||"-"}</div>
                <div class="admin-llm-metric-label">Input Tokens</div>
              </div>
              <div class="admin-llm-metric-box">
                <div class="admin-llm-metric-value">${t.output_tokens?.toLocaleString()||"-"}</div>
                <div class="admin-llm-metric-label">Output Tokens</div>
              </div>
              <div class="admin-llm-metric-box">
                <div class="admin-llm-metric-value">${t.processing_time_ms?`${(t.processing_time_ms/1e3).toFixed(1)}s`:"-"}</div>
                <div class="admin-llm-metric-label">Duration</div>
              </div>
              <div class="admin-llm-metric-box">
                <div class="admin-llm-metric-value admin-llm-metric-cost${t.estimated_cost_usd?" admin-llm-metric-has-cost":""}">$${t.estimated_cost_usd?.toFixed(4)||"-"}</div>
                <div class="admin-llm-metric-label">Est. Cost</div>
              </div>
            </div>
            
            <div class="admin-llm-timeline">
              <div><strong class="admin-llm-timeline-label">Queued:</strong> ${t.queued_at?new Date(t.queued_at).toLocaleString():"-"}</div>
              <div><strong class="admin-llm-timeline-label">Started:</strong> ${t.started_at?new Date(t.started_at).toLocaleString():"-"}</div>
              <div><strong class="admin-llm-timeline-label">Completed:</strong> ${t.completed_at?new Date(t.completed_at).toLocaleString():"-"}</div>
            </div>
            
            ${t.last_error?`
              <div class="admin-llm-error-box">
                <div class="admin-llm-error-header">
                  <span class="admin-llm-error-icon">⚠</span>
                  <strong>Error</strong>
                  <span class="admin-llm-error-attempt">(Attempt ${t.attempt_count}/${t.max_attempts})</span>
                </div>
                <div class="admin-llm-error-body">${i(t.last_error)}</div>
              </div>
            `:""}
            
            <!-- Prompt / Input -->
            <div class="admin-llm-section">
              <div class="admin-llm-section-header">
                <h4 class="admin-llm-section-title"><span class="admin-llm-section-emoji">📝</span> Prompt / Input</h4>
                <button class="btn btn-sm btn-secondary" id="copy-input-btn">Copy</button>
              </div>
              <div class="admin-llm-code-block" id="input-display">${r($)}</div>
            </div>
            
            <!-- Output -->
            <div class="admin-llm-section">
              <div class="admin-llm-section-header">
                <h4 class="admin-llm-section-title"><span class="admin-llm-section-emoji">🤖</span> Response</h4>
                <button class="btn btn-sm btn-secondary" id="copy-output-btn">Copy</button>
              </div>
              <div class="admin-llm-code-block admin-llm-code-block-tall" id="output-display">${r(t.output_text)}</div>
            </div>
            
            <!-- Raw Data Toggle -->
            <details class="admin-llm-details">
              <summary class="admin-llm-details-summary">
                <span class="admin-llm-details-summary-inner">📋 Raw Data (JSON)</span>
              </summary>
              <div class="admin-llm-details-content">
                <div class="admin-llm-json-block">
                  <div class="admin-llm-json-header">
                    <span class="admin-llm-json-label">Input Data</span>
                    <button class="btn btn-xs btn-secondary" id="copy-input-json-btn">Copy JSON</button>
                  </div>
                  <pre class="admin-llm-pre">${l(t.input_data)}</pre>
                </div>
                ${t.output_data?`
                  <div class="admin-llm-json-block">
                    <div class="admin-llm-json-header">
                      <span class="admin-llm-json-label">Output Data</span>
                      <button class="btn btn-xs btn-secondary" id="copy-output-json-btn">Copy JSON</button>
                    </div>
                    <pre class="admin-llm-pre">${l(t.output_data)}</pre>
                  </div>
                `:""}
              </div>
            </details>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close-btn">Close</button>
          </div>
        </div>
      `,document.body.appendChild(h),h.querySelector(".modal-close")?.addEventListener("click",()=>h.remove()),h.querySelector(".modal-close-btn")?.addEventListener("click",()=>h.remove()),h.addEventListener("click",b=>{b.target===h&&h.remove()});const S=b=>{b.key==="Escape"&&(h.remove(),document.removeEventListener("keydown",S))};document.addEventListener("keydown",S),h.querySelector("#copy-input-btn")?.addEventListener("click",()=>{const b=$||JSON.stringify(t.input_data,null,2);navigator.clipboard.writeText(b),o.success("Input copied to clipboard")}),h.querySelector("#copy-output-btn")?.addEventListener("click",()=>{navigator.clipboard.writeText(t.output_text||""),o.success("Response copied to clipboard")}),h.querySelector("#copy-input-json-btn")?.addEventListener("click",()=>{navigator.clipboard.writeText(JSON.stringify(t.input_data,null,2)),o.success("Input JSON copied to clipboard")}),h.querySelector("#copy-output-json-btn")?.addEventListener("click",()=>{navigator.clipboard.writeText(JSON.stringify(t.output_data,null,2)),o.success("Output JSON copied to clipboard")})}catch(s){console.error("Failed to load request details:",s),o.error("Failed to load request details")}}async function D(){const a=e.querySelector("#failed-items-content");try{const t=(await m.get("/api/llm/queue/retryable?limit=20")).data?.items||[];a&&(t.length>0?a.innerHTML=`
            <table class="admin-queue-table">
              <thead>
                <tr>
                  <th class="admin-queue-th">Context</th>
                  <th class="admin-queue-th">Provider</th>
                  <th class="admin-queue-th">Attempts</th>
                  <th class="admin-queue-th">Error</th>
                  <th class="admin-queue-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${t.map(i=>`
                  <tr>
                    <td class="admin-queue-td">${i.context||"Unknown"}</td>
                    <td class="admin-queue-td admin-queue-td-sm">${i.provider||"-"}</td>
                    <td class="admin-queue-td">${i.attemptCount}/${i.maxAttempts}</td>
                    <td class="admin-queue-td admin-queue-td-ellipsis admin-queue-td-error" title="${i.error||""}">${i.error||"-"}</td>
                    <td class="admin-queue-td">
                      <button class="btn-sm btn-primary" data-retry-item="${i.id}" ${i.canRetry?"":"disabled"}>↻ Retry</button>
                      <button class="btn-sm admin-ml-1" data-retry-reset-item="${i.id}">Reset & Retry</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `:a.innerHTML='<div class="admin-placeholder">No failed items</div>')}catch(s){console.error("Failed to load failed items:",s),a&&(a.innerHTML='<div class="admin-error-msg">Failed to load failed items</div>')}}const G=e.querySelector("#refresh-queue-status");G&&d(G,"click",w);const ye=e.querySelector("#refresh-queue-history");ye&&d(ye,"click",J);const he=e.querySelector("#refresh-failed-btn");he&&d(he,"click",D);const be=e.querySelector("#retry-all-btn");be&&d(be,"click",async()=>{try{const s=((await m.get("/api/llm/queue/retryable?limit=50")).data?.items||[]).filter(i=>i.canRetry);let t=0;for(const i of s)try{await m.post(`/api/llm/queue/${i.id}/retry`,{resetAttempts:!1}),t++}catch{}o.success(`Queued ${t} items for retry`),w(),D()}catch{o.error("Failed to retry items")}});const fe=e.querySelector("#queue-pause-btn");fe&&d(fe,"click",async()=>{try{await m.post("/api/llm/queue/pause"),o.success("Queue paused"),w()}catch{o.error("Failed to pause queue")}});const ke=e.querySelector("#queue-resume-btn");ke&&d(ke,"click",async()=>{try{await m.post("/api/llm/queue/resume"),o.success("Queue resumed"),w()}catch{o.error("Failed to resume queue")}});const Se=e.querySelector("#queue-clear-btn");Se&&d(Se,"click",async()=>{if(confirm("Are you sure you want to clear all pending items from the queue?"))try{await m.post("/api/llm/queue/clear"),o.success("Queue cleared"),w()}catch{o.error("Failed to clear queue")}}),e.addEventListener("click",async a=>{const s=a.target,t=s.closest("[data-view-request]");if(t){a.preventDefault(),a.stopPropagation();const p=t.getAttribute("data-view-request");p&&oe(p);return}const i=s.closest("[data-cancel-item]");if(i){const p=i.getAttribute("data-cancel-item");if(p){try{await m.delete(`/api/llm/queue/${p}`),o.success("Item cancelled"),w()}catch{o.error("Failed to cancel item")}return}}const l=s.closest("[data-retry-item]");if(l){const p=l.getAttribute("data-retry-item");if(p){try{await m.post(`/api/llm/queue/${p}/retry`,{resetAttempts:!1}),o.success("Item queued for retry"),w(),D()}catch{o.error("Failed to retry item")}return}}const r=s.closest("[data-retry-reset-item]");if(r){const p=r.getAttribute("data-retry-reset-item");if(p){try{await m.post(`/api/llm/queue/${p}/retry`,{resetAttempts:!0}),o.success("Item queued for retry (attempts reset)"),w(),D()}catch{o.error("Failed to retry item")}return}}});async function $e(){const a=e.querySelector("#metadata-sync-status"),s=e.querySelector("#provider-model-counts");try{const i=(await m.get("/api/llm/metadata/status")).data?.providers||[];if(a&&(i.length>0?a.innerHTML=`
            <table class="admin-queue-table admin-queue-table-sm">
              <thead>
                <tr>
                  <th class="admin-queue-th">Provider</th>
                  <th class="admin-queue-th">Text</th>
                  <th class="admin-queue-th">Vision</th>
                  <th class="admin-queue-th">Embeddings</th>
                  <th class="admin-queue-th">Total</th>
                  <th class="admin-queue-th">Last Synced</th>
                </tr>
              </thead>
              <tbody>
                ${i.map(l=>`
                  <tr>
                    <td class="admin-queue-td admin-queue-td-bold admin-queue-td-cap">${l.provider}</td>
                    <td class="admin-queue-td">${l.text_models||0}</td>
                    <td class="admin-queue-td">${l.vision_models||0}</td>
                    <td class="admin-queue-td">${l.embedding_models||0}</td>
                    <td class="admin-queue-td admin-queue-td-bold">${l.active_models||0}</td>
                    <td class="admin-queue-td admin-queue-td-sm admin-queue-td-muted">${l.last_synced?new Date(l.last_synced).toLocaleString():"Never"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `:a.innerHTML='<div class="admin-placeholder">No metadata found. Click "Sync All Providers" to fetch model data.</div>'),s&&i.length>0){const l=i.reduce((r,p)=>r+(p.active_models||0),0);s.innerHTML=`
          <div class="admin-provider-counts-grid">
            ${i.map(r=>`
              <div class="admin-provider-count-card">
                <div class="admin-provider-count-value">${r.active_models||0}</div>
                <div class="admin-provider-count-label">${r.provider}</div>
              </div>
            `).join("")}
            <div class="admin-provider-count-total">
              <div class="admin-provider-count-value">${l}</div>
              <div class="admin-provider-count-label">Total Models</div>
            </div>
          </div>
        `}}catch(t){console.error("Failed to load metadata status:",t),a&&(a.innerHTML='<div class="admin-error-msg">Failed to load metadata status</div>')}}const B=e.querySelector("#sync-all-metadata-btn");B&&d(B,"click",async()=>{const a=e.querySelector("#metadata-sync-result");B.disabled=!0,B.textContent="Syncing...";try{const s=await m.post("/api/llm/metadata/sync",{});if(a){a.classList.remove("hidden");const t=s.data?.providers||{},i=Object.entries(t);a.innerHTML=`
            <div class="admin-sync-result-box">
              <div class="admin-sync-result-title">Sync Results</div>
              <div class="admin-sync-result-chips">
                ${i.map(([l,r])=>`
                  <div class="admin-sync-chip admin-sync-chip-${r.status}">
                    <span class="admin-sync-chip-provider">${l}</span>
                    ${r.status==="success"?`<span class="admin-sync-chip-ok"> ✓ ${r.synced} models</span>`:""}
                    ${r.status==="skipped"?`<span class="admin-sync-chip-skip"> - ${r.reason}</span>`:""}
                    ${r.status==="error"?`<span class="admin-sync-chip-err"> ✗ ${r.error}</span>`:""}
                  </div>
                `).join("")}
              </div>
              <div class="admin-sync-result-total">
                Total: ${s.data?.totalModels||0} models synced
              </div>
            </div>
          `}o.success(`Synced ${s.data?.totalModels||0} models`),$e()}catch{o.error("Failed to sync metadata"),a&&(a.classList.remove("hidden"),a.innerHTML='<div class="admin-error-msg">Sync failed. Check console for details.</div>')}finally{B.disabled=!1,B.textContent="↻ Sync All Providers"}});const xe=e.querySelector("#browse-models-btn");xe&&d(xe,"click",async()=>{const a=e.querySelector("#browse-provider-select"),s=e.querySelector("#models-browser-content"),t=a?.value;if(!t){o.info("Please select a provider");return}s&&(s.innerHTML='<div class="admin-placeholder">Loading models...</div>');try{const i=await m.get(`/api/llm/metadata/${t}`),{textModels:l=[],visionModels:r=[],embeddingModels:p=[]}=i.data||{};s&&(l.length===0&&p.length===0?s.innerHTML='<div class="admin-empty-state">No models found for this provider. Try syncing first.</div>':s.innerHTML=`
              <div class="admin-models-browser-grid">
                ${l.length>0?`
                  <div>
                    <h5 class="admin-models-section-title">Text Models (${l.length})</h5>
                    <div class="admin-models-cards">
                      ${l.map(c=>`
                        <div class="admin-model-card">
                          <div class="admin-model-card-name">${c.display_name||c.model_id}</div>
                          <div class="admin-model-card-id">${c.model_id}</div>
                          <div class="admin-model-card-meta">
                            <span title="Context Window">📏 ${c.context_tokens?(c.context_tokens/1e3).toFixed(0)+"K":"-"}</span>
                            <span title="Input Price">💰 $${c.price_input?.toFixed(2)||"-"}/1M</span>
                            <span title="Output Price">💵 $${c.price_output?.toFixed(2)||"-"}/1M</span>
                          </div>
                        </div>
                      `).join("")}
                    </div>
                  </div>
                `:""}
                ${p.length>0?`
                  <div>
                    <h5 class="admin-models-section-title">Embedding Models (${p.length})</h5>
                    <div class="admin-models-chips">
                      ${p.map(c=>`
                        <div class="admin-model-chip">${c.display_name||c.model_id}</div>
                      `).join("")}
                    </div>
                  </div>
                `:""}
              </div>
            `)}catch{s&&(s.innerHTML='<div class="admin-error-msg">Failed to load models</div>')}}),z==="models"&&$e(),z==="queue"&&(w(),J(),D());const we=e.querySelector("#save-graph-config");we&&d(we,"click",async()=>{const a={enabled:e.querySelector("#graph-enabled")?.checked??!0,provider:"supabase",graphName:e.querySelector("#graph-name")?.value||"godmode"};try{await j("graph",a,"graph"),o.success("Graph configuration saved!"),console.log("[AdminPanel] Saved graph config:",a)}catch(s){console.error("[AdminPanel] Error saving graph config:",s),o.error("Failed to save graph configuration")}});const X=e.querySelector("#test-graph-connection");X&&d(X,"click",async()=>{X.textContent="Testing...";try{const a={provider:"supabase",graphName:e.querySelector("#graph-name")?.value||"godmode"};console.log("[AdminPanel] Testing Supabase graph connection");const s=await m.post("/api/graph/test",a);s.data.success||s.data.ok?o.success("Supabase graph connection successful!"):o.error(s.data.message||s.data.error||"Connection failed")}catch(a){console.error("[AdminPanel] Graph test error:",a),o.error("Graph connection test failed")}X.textContent="Test Connection"});const qe=e.querySelector("#load-graph-overview");qe&&d(qe,"click",async()=>{await Be(),g(e)});const Ae=e.querySelector("#refresh-graph-overview");Ae&&d(Ae,"click",async()=>{await Be(),g(e),o.info("Graph overview refreshed")});const _e=e.querySelector("#open-graph-tab");_e&&d(_e,"click",()=>{document.querySelector('.nav-item[data-tab="graph"]')?.dispatchEvent(new MouseEvent("click",{bubbles:!0}))});const Pe=e.querySelector("#load-ontology");Pe&&d(Pe,"click",async()=>{await Ge(),g(e)});const Ce=e.querySelector("#reload-ontology");Ce&&d(Ce,"click",async()=>{ge=!1,await Ge(),g(e),o.info("Ontology reloaded")});const Le=e.querySelector("#save-prompts");Le&&d(Le,"click",async()=>{const a=e.querySelectorAll("[data-prompt-key]");let s=0;for(const t of a){const i=t.getAttribute("data-prompt-key"),l=t.value;if(l&&l.trim())try{await m.put(`/api/system/prompts/${i}`,{prompt_template:l.trim()}),s++;const r=e.querySelector(`#status-${i}`);r&&(r.textContent="✓ Saved",r.className="prompt-status saved")}catch(r){console.warn(`Failed to save prompt ${i}:`,r);const p=e.querySelector(`#status-${i}`);p&&(p.textContent="✗ Error",p.className="prompt-status error")}}s>0?o.success(`${s} prompt(s) saved successfully`):o.info("No prompts to save")});const Me=e.querySelector("#reload-prompts");Me&&d(Me,"click",async()=>{await ve(),g(e),o.info("Prompts reloaded from database")}),e.querySelectorAll("[data-view-versions]").forEach(a=>{d(a,"click",async()=>{const s=a.getAttribute("data-view-versions"),t=e.querySelector(`#versions-${s}`),i=t?.querySelector(".version-list");if(!(!t||!i)){if(!t.classList.contains("hidden")){t.classList.add("hidden");return}i.innerHTML='<p class="text-muted">Loading versions...</p>',t.classList.remove("hidden");try{const l=await m.get(`/api/system/prompts/${s}/versions`),r=l.data?.versions||[],p=l.data?.current_version||1;if(r.length===0){i.innerHTML=`
            <p class="text-muted">No previous versions. Current version: ${p}</p>
            <p class="text-sm text-muted">Versions are saved automatically when you edit a prompt.</p>
          `;return}i.innerHTML=`
          <p class="text-sm"><strong>Current version:</strong> ${p}</p>
          <div class="version-items">
            ${r.map(c=>`
              <div class="version-item">
                <div class="version-info">
                  <span class="version-number">v${c.version}</span>
                  <span class="version-date">${new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div class="version-actions">
                  <button class="btn-sm" data-preview-version="${s}:${c.version}">Preview</button>
                  <button class="btn-sm btn-primary" data-restore-version="${s}:${c.version}">Restore</button>
                </div>
              </div>
            `).join("")}
          </div>
        `,i.querySelectorAll("[data-restore-version]").forEach(c=>{d(c,"click",async()=>{const[f,T]=c.getAttribute("data-restore-version").split(":"),$=parseInt(T,10);if(confirm(`Restore prompt "${f}" to version ${$}? The current version will be saved in history.`))try{await m.post(`/api/system/prompts/${f}/restore`,{version:$}),o.success(`Restored to version ${$}`),await ve(),g(e)}catch{o.error("Failed to restore version")}})}),i.querySelectorAll("[data-preview-version]").forEach(c=>{d(c,"click",async()=>{const[f,T]=c.getAttribute("data-preview-version").split(":"),$=parseInt(T,10);try{const h=(await m.get(`/api/system/prompts/${f}/versions/${$}`)).data?.version?.prompt_template||"",S=document.createElement("div");S.className="modal-overlay",S.innerHTML=`
                <div class="modal-content admin-prompt-preview-modal">
                  <div class="modal-header">
                    <h3>Version ${$} Preview</h3>
                    <button class="modal-close">&times;</button>
                  </div>
                  <div class="modal-body">
                    <pre class="admin-prompt-preview-pre">${h.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
                  </div>
                </div>
              `,document.body.appendChild(S),S.querySelector(".modal-close")?.addEventListener("click",()=>{S.remove()}),S.addEventListener("click",b=>{b.target===S&&S.remove()})}catch{o.error("Failed to load version preview")}})})}catch{i.innerHTML='<p class="text-error">Failed to load version history</p>'}}})});const Ee=e.querySelector("#save-processing");Ee&&d(Ee,"click",async()=>{await j("chunk_size",parseInt(e.querySelector("#proc-chunk-size")?.value||"1000"),"processing"),await j("chunk_overlap",parseInt(e.querySelector("#proc-chunk-overlap")?.value||"200"),"processing"),await j("max_tokens",parseInt(e.querySelector("#proc-max-tokens")?.value||"4096"),"processing"),await j("temperature",parseFloat(e.querySelector("#proc-temperature")?.value||"0.7"),"processing"),await j("auto_process",e.querySelector("#proc-auto-process")?.checked,"processing"),await j("parallel_jobs",parseInt(e.querySelector("#proc-parallel-jobs")?.value||"3"),"processing")});const Te=e.querySelector("#save-team-analysis");Te&&d(Te,"click",async()=>{const a=e.querySelector("#team-analysis-enabled")?.checked??!0,s=e.querySelector("#team-analysis-access")?.value||"admin_only";await it(a,s),g(e)}),d(e,"click",async a=>{const s=a.target.closest?.("[id]");if(s?.id){if(s.id==="save-google-drive"){a.preventDefault();const t=e.querySelector("#google-drive-enabled")?.checked??!1,i=e.querySelector("#google-drive-root-folder")?.value?.trim()??"",l=e.querySelector("#google-drive-service-json")?.value?.trim()??"";try{await m.post("/api/system/google-drive",{enabled:t,rootFolderId:i,serviceAccountJson:l||void 0}),o.success("Google Drive config saved"),O=!1,await Z(),g(e)}catch(r){o.error(r&&typeof r=="object"&&"message"in r?String(r.message):"Failed to save")}}else if(s.id==="bootstrap-google-drive"){a.preventDefault();const t=e.querySelector("#bootstrap-google-drive");t&&(t.disabled=!0,t.textContent="Running...");try{const i=await m.post("/api/system/google-drive/bootstrap-all");o.success(i.data?.message??`Bootstrap complete: ${i.data?.projectsCount??0} projects`),O=!1,await Z(),g(e)}catch(i){o.error(i&&typeof i=="object"&&"message"in i?String(i.message):"Bootstrap failed")}finally{t&&(t.disabled=!1,t.textContent="Bootstrap all projects")}}}});const re=e.querySelector("#exchange-rate-auto");re&&d(re,"change",()=>{const a=re.checked,s=e.querySelector("#manual-rate-group"),t=e.querySelector("#refresh-rate-btn");s&&s.classList.toggle("hidden",!!a),t&&(t.disabled=!a)});const le=e.querySelector("#refresh-rate-btn");le&&d(le,"click",async()=>{const a=le;a.disabled=!0,a.textContent="Refreshing...";try{const s=await C.refreshExchangeRate();if(s.success&&s.rate){const t=e.querySelector("#current-rate-display"),i=e.querySelector("#rate-source");t&&(t.textContent=s.rate.toFixed(4)),i&&(i.textContent=s.source||"api"),o.success(`Rate updated: ${s.rate.toFixed(4)}`)}else o.error(s.error||"Failed to refresh rate")}catch{o.error("Failed to refresh rate")}finally{a.disabled=!1,a.textContent="Refresh Rate"}});const Ie=e.querySelector("#save-exchange-rate-btn");Ie&&d(Ie,"click",async()=>{const a=e.querySelector("#exchange-rate-auto")?.checked??!0,s=parseFloat(e.querySelector("#exchange-rate-manual")?.value||"0.92"),t=await C.setExchangeRateMode(a,s);t.success?(o.success("Exchange rate settings saved"),M=!1,await R(),g(e)):o.error(t.error||"Failed to save")});const je=e.querySelector("#save-global-pricing-btn");je&&d(je,"click",async()=>{const a=parseFloat(e.querySelector("#global-markup-percent")?.value||"0"),s=e.querySelector("#global-period-type")?.value||"monthly",t=await C.setGlobalPricingConfig({fixed_markup_percent:a,period_type:s});t.success?(o.success("Global pricing saved"),M=!1,await R(),g(e)):o.error(t.error||"Failed to save")});const De=e.querySelector("#add-tier-btn");De&&d(De,"click",()=>{A.push({id:"",pricing_config_id:K?.id||"",token_limit:1e5,markup_percent:20,name:`Tier ${A.length+1}`,tier_order:A.length}),g(e)}),e.querySelectorAll(".remove-tier-btn").forEach(a=>{d(a,"click",()=>{const s=parseInt(a.getAttribute("data-index")||"0",10);A.splice(s,1),g(e)})}),e.querySelectorAll(".tier-unlimited").forEach(a=>{d(a,"change",()=>{const t=a.closest(".tier-row")?.querySelector(".tier-limit");t&&(t.disabled=a.checked,a.checked&&(t.value=""))})});const Re=e.querySelector("#save-tiers-btn");Re&&d(Re,"click",async()=>{const a=[];e.querySelectorAll(".tier-row").forEach(t=>{const i=t.querySelector(".tier-name")?.value||"",l=t.querySelector(".tier-limit")?.value,r=parseFloat(t.querySelector(".tier-markup")?.value||"0"),p=t.querySelector(".tier-unlimited")?.checked;a.push({token_limit:p?null:l?parseInt(l,10):null,markup_percent:r,name:i||void 0})});const s=await C.setGlobalPricingTiers(a);s.success?(o.success("Pricing tiers saved"),M=!1,await R(),g(e)):o.error(s.error||"Failed to save tiers")});const Fe=e.querySelector("#refresh-billing-btn");Fe&&d(Fe,"click",async()=>{M=!1,await R(),g(e),o.info("Billing data refreshed")}),e.querySelectorAll(".add-balance-btn").forEach(a=>{d(a,"click",async()=>{const s=a.getAttribute("data-project-id"),t=a.getAttribute("data-project-name");if(!s)return;const i=prompt(`Enter amount in EUR to add to "${t}":`);if(!i||isNaN(parseFloat(i)))return;const l=await C.creditProjectBalance(s,parseFloat(i));l.success?(o.success(`Added €${parseFloat(i).toFixed(2)} to ${t}. New balance: €${l.new_balance?.toFixed(2)}`),M=!1,await R(),g(e)):o.error(l.error||"Failed to add balance")})}),e.querySelectorAll(".toggle-unlimited-btn").forEach(a=>{d(a,"click",async()=>{const s=a.getAttribute("data-project-id"),t=a.getAttribute("data-unlimited")==="true";if(!s||!confirm(`Are you sure you want to ${t?"disable unlimited mode":"enable unlimited mode"} for this project?`))return;const l=await C.setProjectUnlimited(s,!t);l.success?(o.success(`Unlimited mode ${t?"disabled":"enabled"}`),M=!1,await R(),g(e)):o.error(l.error||"Failed to update")})});const Ne=e.querySelector("#refresh-audit");Ne&&d(Ne,"click",async()=>{await Ye(),g(e)})}function g(e){e.innerHTML=`
    <div class="admin-panel">
      <div class="admin-header">
        <div class="admin-header-content">
          <div class="admin-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div class="admin-title">
            <h2>Platform Administration</h2>
            <p>System configuration for superadmins</p>
          </div>
        </div>
      </div>

      <div class="admin-body">
        <nav class="admin-nav">
          ${Ze()}
        </nav>

        <main class="admin-content">
          ${ue?'<div class="loading-spinner">Loading...</div>':mt()}
        </main>
      </div>
    </div>
  `,ut(e)}async function yt(e){if(ne.getState().currentUser?.role!=="superadmin"){e.innerHTML=`
      <div class="admin-panel">
        <div class="admin-header">
          <h2>Access Denied</h2>
          <p>You need superadmin privileges to access this section.</p>
        </div>
      </div>
    `;return}ue=!0,g(e),await Promise.all([Ve(),Xe(),Ye(),ve(),Qe()]),ue=!1,g(e)}export{yt as initAdminPanel};
//# sourceMappingURL=AdminPage-DvsUAI95.js.map
