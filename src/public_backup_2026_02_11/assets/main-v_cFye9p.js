const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/KrispManager-Bb372_YM.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/Dashboard-D0L7-zA-.js","assets/ChatPage-CNk0fPqu.js","assets/EmailsPage-C6wqr4Gh.js","assets/ContactsPage-Bcz2ods0.js","assets/TeamsPage-BWparXHF.js","assets/RolesPage--fJeoR4I.js","assets/DocumentsPage-0jCpkTn7.js","assets/DocumentPreviewModal-DEXaSRWs.js","assets/OrgChartPage-CHL2JSo3.js","assets/CostsPage-D9rKbbMY.js","assets/billing-CSo_L-5s.js","assets/HistoryPage-CAqt3rjs.js","assets/EmailComposer-K6OuUU6Q.js","assets/ConversationComposer-D6geblYj.js","assets/TranscriptComposer-8ImAPOGY.js","assets/ProjectsPage-SVccA0Z8.js","assets/SettingsPage-DCLxZyCm.js","assets/AdminPage-DvsUAI95.js","assets/GraphExplorer-D4NfJ4W_.js","assets/TimelinePage-Yuu0vyeb.js","assets/TeamAnalysisPage-CTmup7Rb.js"])))=>i.map(i=>d[i]);
import"./modulepreload-polyfill-B5Qt9EMX.js";const Yp="modulepreload",Xp=function(e){return"/"+e},fc={},ve=function(t,n,s){let i=Promise.resolve();if(n&&n.length>0){let c=function(l){return Promise.all(l.map(d=>Promise.resolve(d).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),r=o?.nonce||o?.getAttribute("nonce");i=c(n.map(l=>{if(l=Xp(l),l in fc)return;fc[l]=!0;const d=l.endsWith(".css"),m=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${m}`))return;const f=document.createElement("link");if(f.rel=d?"stylesheet":Yp,d||(f.as="script"),f.crossOrigin="",f.href=l,r&&f.setAttribute("nonce",r),document.head.appendChild(f),d)return new Promise((g,v)=>{f.addEventListener("load",g),f.addEventListener("error",()=>v(new Error(`Unable to preload CSS for ${l}`)))})}))}function a(o){const r=new Event("vite:preloadError",{cancelable:!0});if(r.payload=o,window.dispatchEvent(r),!r.defaultPrevented)throw o}return i.then(o=>{for(const r of o||[])r.status==="rejected"&&a(r.reason);return t().catch(a)})};class em{mode;listeners=new Set;mediaQuery;constructor(){this.mode=this.getSavedTheme(),this.mediaQuery=window.matchMedia("(prefers-color-scheme: light)"),this.apply(),this.watchSystemChanges()}getSavedTheme(){const t=localStorage.getItem("theme");return t==="light"||t==="dark"||t==="system"?t:"system"}getSystemTheme(){return this.mediaQuery.matches?"light":"dark"}watchSystemChanges(){this.mediaQuery.addEventListener("change",()=>{this.mode==="system"&&this.apply()})}getEffective(){return this.mode==="system"?this.getSystemTheme():this.mode}getMode(){return this.mode}apply(){const t=this.getEffective();document.documentElement.setAttribute("data-theme",t),this.listeners.forEach(n=>n(t))}set(t){this.mode=t,localStorage.setItem("theme",t),this.apply()}cycle(){const t=["light","dark","system"],s=(t.indexOf(this.mode)+1)%t.length;return this.set(t[s]),this.mode}toggle(){const n=this.getEffective()==="dark"?"light":"dark";return this.set(n),n}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}getIcon(){switch(this.mode){case"light":return"☀️";case"dark":return"🌙";case"system":return"💻"}}getLabel(){switch(this.mode){case"light":return"Light";case"dark":return"Dark";case"system":return"System"}}}const Ke=new em,tm={success:'<svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',error:'<svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',warning:'<svg class="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',info:'<svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'};let Ks=null;const nm=5;function sm(){return Ks||(Ks=document.createElement("div"),Ks.className="toast-container",document.body.appendChild(Ks)),Ks}const h={show(e,t="info",n={}){const s=sm(),i=n.duration||4e3;if(s.children.length>=nm){const c=s.firstElementChild;c&&(c.classList.add("toast-leaving"),setTimeout(()=>c.remove(),200))}const a=document.createElement("div");a.className=`toast-sota ${t}`,a.innerHTML=`
      <div class="toast-icon">${tm[t]}</div>
      <div class="toast-content">
        ${n.title?`<div class="toast-title">${n.title}</div>`:""}
        <p class="toast-message">${e}</p>
      </div>
      <button class="toast-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;const o=a.querySelector(".toast-close"),r=()=>{a.classList.add("toast-leaving"),setTimeout(()=>{a.parentElement&&a.remove()},200)};o?.addEventListener("click",r),i>0&&setTimeout(r,i),s.appendChild(a)},success(e,t){this.show(e,"success",t)},error(e,t){this.show(e,"error",t)},warning(e,t){this.show(e,"warning",t)},info(e,t){this.show(e,"info",t)}};let Ql=null;function im(e){Ql=e}const vt={baseUrl:"",defaultHeaders:{"Content-Type":"application/json"},showErrorToasts:!0,timeout:3e4,retryCount:2,retryDelay:1e3},oo=[],om=[];function am(e){return oo.push(e),()=>{const t=oo.indexOf(e);t>-1&&oo.splice(t,1)}}async function pn(e,t={},n=0){const s=`${vt.baseUrl}${e}`;let i={...t,headers:{...vt.defaultHeaders,...t.headers}};for(const l of oo)i=await l(i);const o=i.timeout??vt.timeout;delete i.timeout;const r=new AbortController,c=setTimeout(()=>r.abort(),o);try{const l=await fetch(s,{...i,signal:r.signal,credentials:"include"});clearTimeout(c);const d=(l.headers.get("content-type")||"").toLowerCase(),m=await l.text();let f;if(d.includes("application/json")&&m)try{f=JSON.parse(m)}catch{const v="Invalid server response (not JSON). You may be seeing an error page or wrong endpoint.";throw vt.showErrorToasts&&h.error(v),new Js(v,l.status||0)}else f=m;if(!l.ok){switch(l.status){case 401:vt.onUnauthorized&&vt.onUnauthorized();break;case 403:vt.onForbidden&&vt.onForbidden();break;case 429:if(n<3){const y=parseInt(l.headers.get("Retry-After")||"5",10);return await ta(y*1e3),pn(e,t,n+1)}break;case 503:case 504:if(n<vt.retryCount)return await ta(vt.retryDelay*Math.pow(2,n)),pn(e,t,n+1);break}const v=rm(f,l.statusText);throw vt.showErrorToasts&&h.error(v),new Js(v,l.status,f)}let g={data:f,ok:!0,status:l.status,statusText:l.statusText};for(const v of om)g=await v(g);return g}catch(l){if(clearTimeout(c),l instanceof Js)throw l;if(l instanceof DOMException&&l.name==="AbortError"){const g="Request timed out";throw vt.showErrorToasts&&h.error(g),new Js(g,0)}if(n<vt.retryCount)return await ta(vt.retryDelay*Math.pow(2,n)),pn(e,t,n+1);const d=l instanceof Error?l.message:"Network error",f=d.includes("JSON")||d.includes("Unexpected token")?"Invalid server response. Check that the server is running and the URL is correct.":d;throw vt.showErrorToasts&&h.error(`Connection error: ${f}`),new Js(f,0)}}function rm(e,t){if(typeof e=="object"&&e!==null){const n=e;return String(n.error||n.message||n.detail||t)}return t||"Request failed"}function ta(e){return new Promise(t=>setTimeout(t,e))}class Js extends Error{status;details;constructor(t,n,s){super(t),this.name="ApiError",this.status=n,this.details=s}}const p={get:(e,t)=>pn(e,{...t,method:"GET"}),post:(e,t,n)=>pn(e,{...n,method:"POST",body:t?JSON.stringify(t):void 0}),put:(e,t,n)=>pn(e,{...n,method:"PUT",body:t?JSON.stringify(t):void 0}),patch:(e,t,n)=>pn(e,{...n,method:"PATCH",body:t?JSON.stringify(t):void 0}),delete:(e,t)=>pn(e,{...t,method:"DELETE"})};function Kl(e){Object.assign(vt,e)}function cm(){const e=Ql?.()??null;return e?{"X-Project-Id":e}:{}}async function kt(e,t){const n=new Headers(t?.headers);return Object.entries(cm()).forEach(([s,i])=>n.set(s,i)),fetch(e,{...t,headers:n,credentials:"include"})}function lm(e,t){try{const n=localStorage.getItem(e);return n===null?t:JSON.parse(n)}catch{return t}}function dm(e,t){try{localStorage.setItem(e,JSON.stringify(t))}catch{}}function um(e){try{localStorage.removeItem(e)}catch{}}function pm(){try{localStorage.clear()}catch{}}function mm(e){try{return localStorage.getItem(e)!==null}catch{return!1}}function gm(){try{return Object.keys(localStorage)}catch{return[]}}const Vt={get:lm,set:dm,remove:um,clear:pm,has:mm,keys:gm};class fm{shortcuts=new Map;enabled=!0;isMac=typeof navigator<"u"&&/Mac|iPod|iPhone|iPad/.test(navigator.platform);constructor(){this.handleKeydown=this.handleKeydown.bind(this),document.addEventListener("keydown",this.handleKeydown)}parseShortcut(t,n,s=""){const i=t.toLowerCase().split("+"),a=i.pop()||t;return{key:a,ctrl:i.includes("ctrl")||i.includes("mod")&&!this.isMac,shift:i.includes("shift"),alt:i.includes("alt"),meta:i.includes("meta")||i.includes("mod")&&this.isMac,description:s,handler:()=>{const r=new KeyboardEvent("keydown",{key:a});n(r)}}}getShortcutKey(t){const n=[];return t.ctrl&&n.push("ctrl"),t.shift&&n.push("shift"),t.alt&&n.push("alt"),t.meta&&n.push("meta"),t.key&&n.push(t.key.toLowerCase()),n.join("+")}handleKeydown(t){if(!this.enabled)return;const n=t.target;if((n.tagName==="INPUT"||n.tagName==="TEXTAREA"||n.isContentEditable)&&t.key!=="Escape")return;const s=this.getShortcutKey({key:t.key,ctrl:t.ctrlKey,shift:t.shiftKey,alt:t.altKey,meta:t.metaKey}),i=this.shortcuts.get(s);i&&(t.preventDefault(),i.handler())}register(t,n,s){let i;if(typeof t=="string"){if(!n)throw new Error("Handler is required when using string shortcut format");i=this.parseShortcut(t,n,s||"")}else i=t;const a=this.getShortcutKey(i);return this.shortcuts.set(a,i),()=>this.shortcuts.delete(a)}unregister(t){const n=this.getShortcutKey(t);this.shortcuts.delete(n)}setEnabled(t){this.enabled=t}getAll(){return Array.from(this.shortcuts.values())}showHelp(){const t=this.getAll();console.log("Keyboard Shortcuts:"),t.forEach(n=>{const s=[];n.ctrl&&s.push("Ctrl"),n.shift&&s.push("Shift"),n.alt&&s.push("Alt"),n.meta&&s.push("Cmd"),s.push(n.key.toUpperCase()),console.log(`  ${s.join("+")} - ${n.description}`)})}destroy(){document.removeEventListener("keydown",this.handleKeydown),this.shortcuts.clear()}}const Ut=new fm;class hm{undoStack=[];redoStack=[];maxSize=50;listeners=new Set;push(t){this.undoStack.push({...t,timestamp:Date.now()}),this.redoStack=[],this.undoStack.length>this.maxSize&&this.undoStack.shift(),this.notify()}async undo(){const t=this.undoStack.pop();if(!t)return!1;try{return await t.undo(),this.redoStack.push(t),this.notify(),!0}catch(n){return console.error("Undo failed:",n),this.undoStack.push(t),!1}}async redo(){const t=this.redoStack.pop();if(!t||!t.redo)return!1;try{return await t.redo(),this.undoStack.push(t),this.notify(),!0}catch(n){return console.error("Redo failed:",n),this.redoStack.push(t),!1}}canUndo(){return this.undoStack.length>0}canRedo(){return this.redoStack.length>0}getUndoDescription(){return this.undoStack[this.undoStack.length-1]?.description??null}getRedoDescription(){return this.redoStack[this.redoStack.length-1]?.description??null}clear(){this.undoStack=[],this.redoStack=[],this.notify()}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}notify(){this.listeners.forEach(t=>t())}getState(){return{undoCount:this.undoStack.length,redoCount:this.redoStack.length}}}const tn=new hm,Jl={currentProjectId:Vt.get("currentProjectId",null),currentProject:Vt.get("currentProject",null),currentUser:null,authConfigured:!1,config:{},isLoading:!1,error:null,isOnline:navigator.onLine,version:"1.0.0"};let Ge={...Jl};const Ma=new Set;function jn(){Ma.forEach(e=>e(Ge))}function vm(){return Ge}function bm(e){return Ma.add(e),()=>Ma.delete(e)}function ym(e){Ge={...Ge,currentProjectId:e},e?Vt.set("currentProjectId",e):(Vt.remove("currentProjectId"),Vt.remove("currentProject"),Ge={...Ge,currentProject:null}),jn()}function wm(e){Ge={...Ge,currentProject:e,currentProjectId:e?.id||null},e?(Vt.set("currentProject",e),Vt.set("currentProjectId",e.id)):(Vt.remove("currentProject"),Vt.remove("currentProjectId")),jn()}function km(e){Ge={...Ge,currentUser:e},jn()}function xm(e){Ge={...Ge,authConfigured:e},jn()}function $m(e){Ge={...Ge,config:{...Ge.config,...e}},jn()}function Sm(e){Ge={...Ge,isLoading:e},jn()}function _m(e){Ge={...Ge,error:e},jn()}function qa(e){Ge={...Ge,isOnline:e},jn()}function Cm(){Ge={...Jl},jn()}function Lm(){window.addEventListener("online",()=>qa(!0)),window.addEventListener("offline",()=>qa(!1))}const z={getState:vm,subscribe:bm,setCurrentProject:wm,setCurrentProjectId:ym,setCurrentUser:km,setAuthConfigured:xm,setConfig:$m,setLoading:Sm,setError:_m,setOnline:qa,reset:Cm,init:Lm};let ao=!1,Ys=null;async function Yl(){try{const e=await p.get("/api/auth/status"),t=e.data.configured;return z.setAuthConfigured(t),e.data}catch{return z.setAuthConfigured(!1),{configured:!1}}}async function Xl(){try{const e=await p.get("/api/auth/me");if(e.data.authenticated&&e.data.user){const t=e.data.user,n=jo(t);return z.setCurrentUser(n),n}return z.setCurrentUser(null),null}catch{return z.setCurrentUser(null),null}}async function Tm(){return Ys||(Ys=(async()=>{try{if(!(await Yl()).configured)return ao=!0,!1;const t=await Xl();return ao=!0,t?!0:(z.setCurrentUser(null),console.log("🔐 Supabase configured but no valid session - login required"),!1)}catch{return z.setCurrentUser(null),ao=!0,!1}finally{Ys=null}})(),Ys)}async function Am(e){const t=await p.post("/api/auth/login",e);if(!t.data.success)throw new Error("Login failed");const n=jo(t.data.user);return z.setCurrentUser(n),n}async function Em(e){if(e.password.length<12)throw new Error("Password must be at least 12 characters");if(e.username&&e.username.length<3)throw new Error("Username must be at least 3 characters");if(e.username&&!/^[a-zA-Z0-9_]+$/.test(e.username))throw new Error("Username can only contain letters, numbers, and underscores");const t=await p.post("/api/auth/register",e);if(!t.data.success)throw new Error("Registration failed");const n=jo(t.data.user);return t.data.needsEmailVerification||z.setCurrentUser(n),{user:n,needsEmailVerification:t.data.needsEmailVerification}}async function Mm(){try{await p.post("/api/auth/logout")}catch{}z.setCurrentUser(null),z.setCurrentProject(null)}async function qm(e){await p.post("/api/auth/forgot-password",{email:e})}async function jm(e,t){if(e.length<12)throw new Error("Password must be at least 12 characters");if(!(await p.post("/api/auth/reset-password",{password:e,access_token:t})).data.success)throw new Error("Password reset failed")}async function Dm(){try{return(await p.post("/api/auth/refresh")).data.success}catch{return!1}}async function Pm(e){return(await p.post("/api/auth/otp/request",{email:e})).data}async function zm(e,t){const n=await p.post("/api/auth/otp/verify",{email:e,code:t});if(!n.data.success){const i=new Error(n.data.error||"Verification failed");throw i.attemptsRemaining=n.data.attemptsRemaining,i.needsEmailVerification=n.data.needsEmailVerification,i.fallbackToPassword=n.data.fallbackToPassword,i}if(n.data.redirectTo)throw window.location.href=n.data.redirectTo,new Error("Redirecting...");if(!n.data.user)throw new Error("Login completed but no user data received");const s=jo(n.data.user);return z.setCurrentUser(s),s}async function Im(){try{return(await p.get("/api/auth/otp/config")).data}catch{return{codeLength:6,expirationMinutes:10,resendCooldownSeconds:60}}}async function Hm(e,t){const n=await p.post("/api/auth/confirm-email",{email:e,code:t});if(!n.data.success)throw new Error(n.data.error||"Confirmation failed")}async function Rm(e){const t=await p.post("/api/auth/resend-confirmation",{email:e});if(!t.data.success){const n=new Error(t.data.error||"Failed to resend confirmation");throw n.retryAfter=t.data.retryAfter,n}return{expiresInMinutes:t.data.expiresInMinutes}}function jo(e){const t=e.profile,n=e.user_metadata||{};return{id:e.id,email:e.email,name:t?.display_name||n.display_name||n.username||e.email.split("@")[0],avatar:t?.avatar_url,role:t?.role==="superadmin"?"superadmin":t?.role==="admin"?"admin":"member"}}function Bm(){return z.getState().currentUser!==null}function Om(){return ao}function Nm(){return z.getState().currentUser}function Um(e){const t=()=>e();return window.addEventListener("godmode:auth-required",t),()=>window.removeEventListener("godmode:auth-required",t)}function Fm(){window.dispatchEvent(new CustomEvent("godmode:auth-required"))}const Pt={checkStatus:Yl,checkSession:Xl,init:Tm,login:Am,register:Em,logout:Mm,forgotPassword:qm,resetPassword:jm,refreshSession:Dm,isAuthenticated:Bm,isInitialized:Om,getCurrentUser:Nm,onAuthRequired:Um,triggerAuthRequired:Fm,requestLoginCode:Pm,verifyLoginCode:zm,getOTPConfig:Im,confirmEmail:Hm,resendConfirmation:Rm},ed={questions:[],risks:[],actions:[],decisions:[],facts:[],contacts:[],chatHistory:[],projects:[],lastUpdated:{}};let Ae={...ed};const ja=new Set;function on(){ja.forEach(e=>e(Ae))}function Vm(){return Ae}function Zm(e){return ja.add(e),()=>ja.delete(e)}function Gm(e){Ae={...Ae,questions:e,lastUpdated:{...Ae.lastUpdated,questions:Date.now()}},on()}function Wm(e){Ae={...Ae,risks:e,lastUpdated:{...Ae.lastUpdated,risks:Date.now()}},on()}function Qm(e){Ae={...Ae,actions:e,lastUpdated:{...Ae.lastUpdated,actions:Date.now()}},on()}function Km(e){Ae={...Ae,decisions:e,lastUpdated:{...Ae.lastUpdated,decisions:Date.now()}},on()}function Jm(e){Ae={...Ae,facts:e,lastUpdated:{...Ae.lastUpdated,facts:Date.now()}},on()}function Ym(e){Ae={...Ae,contacts:e,lastUpdated:{...Ae.lastUpdated,contacts:Date.now()}},on()}function Xm(e){Ae={...Ae,chatHistory:e},on()}function eg(e){Ae={...Ae,chatHistory:[...Ae.chatHistory,e]},on()}function tg(e){Ae={...Ae,projects:e,lastUpdated:{...Ae.lastUpdated,projects:Date.now()}},on()}function ng(){Ae={...Ae,chatHistory:[]},on()}function sg(){Ae={...ed},on()}const ce={getState:Vm,subscribe:Zm,setQuestions:Gm,setRisks:Wm,setActions:Qm,setDecisions:Km,setFacts:Jm,setContacts:Ym,setChatHistory:Xm,addChatMessage:eg,setProjects:tg,clearChatHistory:ng,reset:sg};async function gs(){try{const t=(await p.get("/api/projects")).data.projects||[];return ce.setProjects(t),t}catch{return[]}}async function td(){try{const t=(await p.get("/api/projects/current")).data.project;return t?(z.setCurrentProject(t),t):null}catch{return null}}async function ig(e){const n={id:(await p.post("/api/projects",e)).data.id,name:e.name,description:e.description};return await gs(),n}async function og(e,t){await p.put(`/api/projects/${e}`,t);const n=z.getState().currentProject;n?.id===e&&z.setCurrentProject({...n,...t}),await gs()}async function ag(e){await p.delete(`/api/projects/${e}`),z.getState().currentProjectId===e&&z.setCurrentProject(null),await gs()}async function nd(e){try{z.setCurrentProjectId(e),await p.put(`/api/projects/${e}/activate`);let t=null;for(let n=0;n<5;n++){const i=(await p.get("/api/projects/current")).data.project;if(i&&i.id===e){t=i;break}await new Promise(a=>setTimeout(a,500))}if(t)return z.setCurrentProject(t),t;{const n=ce.getState().projects.find(s=>s.id===e);if(n){const s={id:n.id,name:n.name};return z.setCurrentProject(s),s}return console.warn(`[Projects] Activation timed out or inconsistent state for ${e}`),null}}catch(t){console.error("[Projects] Activation failed",t);const n=z.getState().currentProject;return z.setCurrentProject(n),null}}async function rg(e){await p.post(`/api/projects/${e}/set-default`),await gs()}async function cg(e){try{return(await p.get(`/api/projects/${e}/stats`)).data.stats||{}}catch{return{}}}async function lg(e){const t=await kt(`/api/projects/${e}/export`);if(!t.ok)throw new Error("Failed to export project");return t.blob()}async function dg(e){const t=new FormData;t.append("file",e);const n=await kt("/api/projects/import",{method:"POST",body:t});if(!n.ok){const i=await n.json().catch(()=>({error:"Import failed"}));throw new Error(i.error||"Import failed")}const s=await n.json();return await gs(),s.project}async function ug(){if(await gs(),!await td()){const t=ce.getState().projects;if(t.length>0){const n=t.find(s=>s.isDefault)||t[0];await nd(n.id)}}}const Vn={getAll:gs,getCurrent:td,create:ig,update:og,delete:ag,activate:nd,setDefault:rg,getStats:cg,export:lg,import:dg,init:ug};async function Do(){try{const t=(await p.get("/api/companies")).data?.companies;return Array.isArray(t)?t:[]}catch{return[]}}async function ki(e){try{return(await p.get(`/api/companies/${e}`)).data?.company??null}catch{return null}}async function sd(e){return(await p.post("/api/companies",e)).data.company}async function id(e,t){return(await p.put(`/api/companies/${e}`,t)).data.company}async function od(e){await p.delete(`/api/companies/${e}`)}async function uo(e){return(await p.post(`/api/companies/${e}/analyze`,{},{timeout:3e5})).data.company}async function xi(e,t){return(await p.get(`/api/companies/${e}/templates/${t}`)).data?.html??""}async function ad(e,t,n){await p.put(`/api/companies/${e}/templates/${t}`,{html:n})}async function rd(e,t){const n=await p.post(`/api/companies/${e}/templates/generate`,{type:t},{timeout:3e5});return{html:n.data.html,company:n.data.company}}async function cd(){try{return(await p.get("/api/dashboard")).data}catch{return null}}async function pg(){try{return(await p.get("/api/stats")).data}catch{return null}}async function mg(e=7){try{return(await p.get(`/api/trends?days=${e}`)).data}catch{return null}}async function ld(){try{return(await p.get("/api/sot/health")).data}catch{return null}}async function dd(){try{return(await p.get("/api/sot/insights")).data.insights||[]}catch{return[]}}async function ud(){try{return(await p.get("/api/sot/alerts")).data.alerts||[]}catch{return[]}}async function gg(){const[e,t,n,s]=await Promise.all([cd(),ld(),dd(),ud()]);return{dashboard:e,health:t,insights:n,alerts:s}}const fg={getDashboard:cd,getStats:pg,getTrends:mg,getHealth:ld,getInsights:dd,getAlerts:ud,loadAll:gg};async function hg(e){try{const t=new URLSearchParams;e?.status&&t.set("status",e.status),e?.priority&&t.set("priority",e.priority);const n=t.toString(),s=n?`/api/questions?${n}`:"/api/questions";return(await p.get(s)).data.questions||[]}catch{return[]}}async function vg(e){try{return(await p.get(`/api/questions/${e}`)).data.question||null}catch{return null}}async function bg(e){return(await p.post("/api/questions",e)).data}async function yg(e,t){return(await p.put(`/api/questions/${e}`,t)).data.question}async function wg(e,t){await p.delete(`/api/questions/${e}`,{body:JSON.stringify({reason:t})})}async function kg(e,t){return(await p.post(`/api/questions/${e}/answer`,t)).data}async function xg(){try{return(await p.get("/api/questions/by-person")).data.questionsByPerson||{}}catch{return{}}}async function $g(){try{return(await p.get("/api/questions/by-team")).data.questionsByTeam||{}}catch{return{}}}async function Sg(e){const t=new URLSearchParams;return e.content&&t.set("content",e.content),e.id&&t.set("id",String(e.id)),e.useAI===!1&&t.set("ai","false"),e.refresh&&t.set("refresh","true"),(await p.get(`/api/questions/suggest-assignee?${t.toString()}`,{signal:AbortSignal.timeout(9e4)})).data}async function _g(e,t){return(await p.post(`/api/questions/${e}/reopen`,{reason:t})).data.question}async function Cg(e,t,n){return(await p.post(`/api/questions/${e}/dismiss`,{reason:t,details:n})).data.question}async function Lg(e,t,n){return(await p.post(`/api/questions/${e}/defer`,{until:typeof t=="string"?t:t.toISOString(),reason:n})).data.question}async function Tg(e,t,n){return(await p.post(`/api/questions/${e}/feedback`,{wasUseful:t,feedback:n})).data.question}function Ag(e){const t=new Date,n=new Date(t.getTime()-10080*60*1e3);return{total:e.length,pending:e.filter(s=>s.status==="pending").length,assigned:e.filter(s=>s.status==="assigned").length,resolved:e.filter(s=>s.status==="resolved").length,critical:e.filter(s=>s.priority==="critical"&&s.status!=="resolved").length,overdue:e.filter(s=>s.status==="resolved"?!1:new Date(s.created_at)<n).length}}const Ve={getAll:hg,get:vg,create:bg,update:yg,delete:wg,answer:kg,getByPerson:xg,getByTeam:$g,suggestAssignee:Sg,reopen:_g,getStats:Ag,dismissQuestion:Cg,deferQuestion:Lg,submitAnswerFeedback:Tg};async function Eg(e){try{const t=e?`/api/risks?status=${e}`:"/api/risks";return(await p.get(t)).data.risks||[]}catch{return[]}}async function Mg(e){try{return(await p.get(`/api/risks/${e}`)).data.risk??null}catch{return null}}async function qg(){try{return(await p.get("/api/risks/deleted")).data.risks||[]}catch{return[]}}async function jg(e){return(await p.post(`/api/risks/${e}/restore`,{})).data.risk}async function Dg(e){try{return(await p.get(`/api/risks/${e}/events`)).data.events||[]}catch{return[]}}async function Pg(){try{return(await p.get("/api/risks/by-category")).data.risksByCategory||{}}catch{return{}}}async function zg(e){const t=await p.post("/api/risks",e);return t.data.risk||{...e,id:t.data.id,status:"open",created_at:new Date().toISOString()}}async function Ig(e,t){return(await p.put(`/api/risks/${e}`,t)).data.risk}async function Hg(e){await p.delete(`/api/risks/${e}`)}function Rg(e,t){const n={low:1,medium:2,high:3,critical:4},s={low:1,medium:2,high:3};return(n[e]||2)*(s[t]||2)}async function Bg(e){const t=await p.post("/api/risks/suggest",{content:e.content?.trim()||"",impact:e.impact||"medium",likelihood:e.likelihood??e.probability??"medium"});if(t.data.error)throw new Error(t.data.error);const n=Array.isArray(t.data.suggested_owners)?t.data.suggested_owners:[];return{suggested_owner:t.data.suggested_owner??n[0]?.name??"",suggested_mitigation:t.data.suggested_mitigation??"",suggested_owners:n}}function Og(e){const t={};return e.filter(n=>n.status!=="mitigated"&&n.status!=="closed").forEach(n=>{const s=(n.impact||"").toString().toLowerCase(),i=(n.likelihood||"").toString().toLowerCase(),a=`${s}-${i}`;t[a]||(t[a]=[]),t[a].push(n)}),t}const Mt={getAll:Eg,get:Mg,getByCategory:Pg,getDeleted:qg,restore:jg,getEvents:Dg,suggest:Bg,create:zg,update:Ig,delete:Hg,calculateScore:Rg,getMatrixData:Og};function Bs(e){return{...e,content:e.content??e.task,assignee:e.assignee??e.owner,due_date:e.due_date??e.deadline,definition_of_done:Array.isArray(e.definition_of_done)?e.definition_of_done:[],acceptance_criteria:Array.isArray(e.acceptance_criteria)?e.acceptance_criteria:[],depends_on:Array.isArray(e.depends_on)?e.depends_on:[],sprint_id:e.sprint_id,sprint_name:e.sprint_name??e.sprints?.name??e.sprint?.name}}async function pd(e,t,n){try{const s=new URLSearchParams;e&&s.set("status",e),t&&s.set("sprint_id",t),n&&s.set("decision_id",n);const i=s.toString(),a=i?`/api/actions?${i}`:"/api/actions";return((await p.get(a)).data.actions||[]).map(Bs)}catch{return[]}}async function Ng(e){try{const t=await p.get(`/api/actions/${e}`);return t.data.action?Bs(t.data.action):null}catch{return null}}async function Ug(e){const t={content:e.content,task:e.content,assignee:e.assignee,owner:e.assignee,due_date:e.due_date,deadline:e.due_date,status:e.status,priority:e.priority,parent_story_ref:e.parent_story_ref,parent_story_id:e.parent_story_id,size_estimate:e.size_estimate,description:e.description,definition_of_done:e.definition_of_done,acceptance_criteria:e.acceptance_criteria,depends_on:e.depends_on,generation_source:e.generation_source,source_document_id:e.source_document_id,source_email_id:e.source_email_id,source_type:e.source_type,requested_by:e.requested_by,requested_by_contact_id:e.requested_by_contact_id,supporting_document_ids:e.supporting_document_ids,sprint_id:e.sprint_id,task_points:e.task_points,decision_id:e.decision_id??null},n=await p.post("/api/actions",t),s=n.data.action||{...t,id:n.data.id,created_at:new Date().toISOString()};return Bs(s)}async function Fg(e,t){const n={task:t.content??t.task,owner:t.assignee??t.owner,deadline:t.due_date??t.deadline,parent_story_ref:t.parent_story_ref,parent_story_id:t.parent_story_id,size_estimate:t.size_estimate,description:t.description,definition_of_done:t.definition_of_done,acceptance_criteria:t.acceptance_criteria,depends_on:t.depends_on,sprint_id:t.sprint_id,task_points:t.task_points,status:t.status,priority:t.priority,decision_id:t.decision_id!==void 0?t.decision_id:void 0};t.refined_with_ai===!0&&(n.refined_with_ai=!0),t.restore_snapshot!=null&&(n.restore_snapshot=t.restore_snapshot);const i=(await p.put(`/api/actions/${e}`,n)).data.action;return i?Bs(i):{}}async function Vg(e){await p.delete(`/api/actions/${e}`)}async function Zg(){try{return((await p.get("/api/actions/deleted")).data.actions||[]).map(Bs)}catch{return[]}}async function Gg(e){const t=await p.post(`/api/actions/${e}/restore`,{});return Bs(t.data.action||{})}async function Wg(e){try{const t=await p.post("/api/actions/suggest",{content:(e.content||"").trim()});return{suggested_assignees:Array.isArray(t.data.suggested_assignees)?t.data.suggested_assignees:[]}}catch{return{suggested_assignees:[]}}}async function Qg(e){const t=await p.post("/api/actions/suggest-task",{user_input:(e.user_input||"").trim(),parent_story_ref:e.parent_story_ref||""});return{task:t.data.task||"",description:t.data.description||"",size_estimate:t.data.size_estimate||"1 day",definition_of_done:Array.isArray(t.data.definition_of_done)?t.data.definition_of_done:[],acceptance_criteria:Array.isArray(t.data.acceptance_criteria)?t.data.acceptance_criteria:[]}}async function Kg(e){try{return(await p.get(`/api/actions/${e}/events`)).data.events||[]}catch{return[]}}function md(e){return!e.due_date||e.status==="completed"||e.status==="cancelled"?!1:new Date(e.due_date)<new Date}function Jg(e){return{total:e.length,pending:e.filter(t=>t.status==="pending").length,inProgress:e.filter(t=>t.status==="in_progress").length,completed:e.filter(t=>t.status==="completed").length,overdue:e.filter(t=>md(t)).length}}async function Yg(){try{const e=await p.get("/api/actions/report");return{by_status:e.data?.by_status||{},by_assignee:e.data?.by_assignee||{},by_sprint:e.data?.by_sprint||{}}}catch{return{by_status:{},by_assignee:{},by_sprint:{}}}}async function Xg(e){try{return(await p.get(`/api/actions/${e}/similar`)).data?.similar||[]}catch{return[]}}async function ef(e){try{const t=e?`/api/user-stories?status=${e}`:"/api/user-stories";return(await p.get(t)).data.user_stories||[]}catch{return[]}}async function tf(e){const t=await p.post("/api/user-stories",e);return t.data.user_story||{id:t.data.id,...e}}async function nf(e){try{return(await p.get(`/api/user-stories/${e}`)).data?.user_story??null}catch{return null}}async function sf(e,t){return(await p.put(`/api/user-stories/${e}`,t)).data.user_story}const Le={getAll:pd,get:Ng,create:Ug,update:Fg,delete:Vg,getDeletedActions:Zg,restoreAction:Gg,getEvents:Kg,suggest:Wg,suggestTaskFromDescription:Qg,getUserStories:ef,getUserStory:nf,addUserStory:tf,updateUserStory:sf,isOverdue:md,getStats:Jg,getReport:Yg,getSimilar:Xg};async function of(e){try{const t=e?`/api/decisions?status=${e}`:"/api/decisions";return(await p.get(t)).data.decisions||[]}catch{return[]}}async function af(e){try{return(await p.get(`/api/decisions/${e}`)).data.decision}catch{return null}}async function rf(){try{return(await p.get("/api/decisions/deleted")).data.decisions||[]}catch{return[]}}async function cf(e){return(await p.post(`/api/decisions/${e}/restore`,{})).data.decision}async function lf(e){try{return(await p.get(`/api/decisions/${e}/events`)).data.events||[]}catch{return[]}}async function df(e,t=10){try{const n=new URLSearchParams;t!==10&&n.set("limit",String(t));const s=n.toString(),i=s?`/api/decisions/${e}/similar?${s}`:`/api/decisions/${e}/similar`;return(await p.get(i)).data.similar||[]}catch{return[]}}async function uf(){return(await p.post("/api/decision-check/run",{})).data}async function pf(){try{return(await p.get("/api/conflicts/decisions")).data.conflicts||[]}catch{return[]}}async function mf(e,t){return(await p.post("/api/decisions/suggest",{content:e.trim(),rationale:t?.trim()||""})).data}async function gf(e,t){return(await p.post("/api/decisions/suggest-owner",{content:e.trim(),rationale:t?.trim()||""})).data}async function ff(e){const t=await p.post("/api/decisions",e);return t.data.decision||{...e,id:t.data.id,status:e.status||"proposed",created_at:new Date().toISOString()}}async function wr(e,t){return(await p.put(`/api/decisions/${e}`,t)).data.decision}async function hf(e){await p.delete(`/api/decisions/${e}`)}async function vf(e,t){return wr(e,{status:"approved",approved_by:t,decided_at:new Date().toISOString()})}async function bf(e,t){return wr(e,{status:"rejected",rationale:t,decided_at:new Date().toISOString()})}const Re={getAll:of,get:af,create:ff,update:wr,delete:hf,approve:vf,reject:bf,getDeletedDecisions:rf,restore:cf,getEvents:lf,getSimilarDecisions:df,runDecisionCheck:uf,detectConflicts:pf,suggest:mf,suggestOwner:gf};let Mi=[];async function yf(e){const t=await p.post("/api/chat",{message:e.message,context:e.context,history:e.history||Mi.slice(-10).map(i=>({role:i.role,content:i.content})),semantic:e.semantic??!0,deepReasoning:e.deepReasoning??!1}),n={id:`msg-${Date.now()}-user`,role:"user",content:e.message,timestamp:new Date().toISOString()},s={id:`msg-${Date.now()}-assistant`,role:"assistant",content:t.data.response,timestamp:new Date().toISOString(),sources:t.data.sources,contextQuality:t.data.contextQuality};return Mi.push(n,s),t.data}async function wf(e){return(await p.post("/api/ask",e)).data}async function kf(e){return(await p.post("/api/sot/chat",e)).data}async function xf(e=!1){const t=e?"/api/briefing?refresh=true":"/api/briefing";return(await p.get(t)).data}async function $f(e=30){return(await p.get(`/api/briefing/history?limit=${e}`)).data.history||[]}async function Sf(){const e=await p.get("/api/reports/weekly");return typeof e.data=="string"?e.data:""}async function _f(){return(await p.post("/api/sot/executive-summary")).data.summary||""}function Cf(){return[...Mi]}function Lf(){Mi=[]}function Tf(e){Mi.push(e)}const kr={send:yf,ask:wf,sotChat:kf,getBriefing:xf,getBriefingHistory:$f,getWeeklyReport:Sf,generateExecutiveSummary:_f,getHistory:Cf,clearHistory:Lf,addToHistory:Tf};async function Af(e){try{const t=new URLSearchParams;e?.organization&&t.set("organization",e.organization),e?.tag&&t.set("tag",e.tag),e?.search&&t.set("search",e.search);const n=t.toString(),s=n?`/api/contacts?${n}`:"/api/contacts",i=await p.get(s),o=(i.data.contacts||[]).map(r=>({...r,photoUrl:r.photo_url||r.avatar_url||r.photoUrl||r.avatarUrl,avatarUrl:r.avatar_url||r.photo_url||r.avatarUrl||r.photoUrl,isFavorite:r.is_favorite??r.isFavorite??!1,company:r.organization||r.company}));return{contacts:o,total:i.data.total||o.length}}catch(t){return console.error("[ContactsService] Failed to get contacts:",t),{contacts:[],total:0}}}async function gd(e){try{return(await p.get(`/api/contacts/${e}`)).data.contact}catch{return null}}async function Ef(e){const t=await p.post("/api/contacts",e);return{...e,id:t.data.id,created_at:new Date().toISOString()}}async function Mf(e,t){await p.put(`/api/contacts/${e}`,t)}async function qf(e){await p.delete(`/api/contacts/${e}`)}async function jf(){return(await p.get("/api/contacts/stats")).data}async function Df(e){try{const t=await p.get(`/api/contacts/find-by-name?name=${encodeURIComponent(e)}`);return t.data.found?t.data.contact:null}catch{return null}}async function Pf(){return(await p.get("/api/contacts/duplicates")).data}async function hc(e){return(await p.post("/api/contacts/merge",{contactIds:e})).data.mergedId}async function zf(e){return(await p.post(`/api/contacts/${e}/enrich`)).data.suggestions}async function If(e="json"){try{const t=await kt(`/api/contacts/export?format=${e}`);if(!t.ok)throw new Error("Export failed");const n=await t.blob(),s=URL.createObjectURL(n),i=document.createElement("a");i.href=s,i.download=`contacts-export.${e}`,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(s)}catch(t){throw console.error("Export failed:",t),t}}async function Hf(e){try{return(await p.get(`/api/contacts/${e}/associations`)).data.contact}catch{return gd(e)}}async function Rf(e,t,n){await p.post(`/api/contacts/${e}/projects`,{projectId:t,...n})}async function Bf(e,t){await p.delete(`/api/contacts/${e}/projects/${t}`)}async function Of(e){try{return(await p.get(`/api/contacts/${e}/projects`)).data.projects||[]}catch{return[]}}async function Nf(){try{return(await p.get("/api/teams")).data.teams||[]}catch{return[]}}async function Uf(e){try{return(await p.get(`/api/teams/${e}`)).data}catch{return null}}async function Ff(e){const t=await p.post("/api/teams",e);return{...e,id:t.data.id,created_at:new Date().toISOString()}}async function Vf(e,t){await p.put(`/api/teams/${e}`,t)}async function Zf(e){await p.delete(`/api/teams/${e}`)}async function Gf(e,t,n,s=!1){await p.post(`/api/teams/${e}/members`,{contactId:t,role:n,isLead:s})}async function Wf(e,t){await p.delete(`/api/teams/${e}/members/${t}`)}const Je={getAll:Af,get:gd,create:Ef,update:Mf,delete:qf,getStats:jf,findByName:Df,getDuplicates:Pf,merge:hc,mergeContacts:hc,enrich:zf,export:If,getWithAssociations:Hf,addToProject:Rf,removeFromProject:Bf,getProjects:Of},Qf={getAll:Nf,get:Uf,create:Ff,update:Vf,delete:Zf,addMember:Gf,removeMember:Wf};async function Kf(e,t){const n=new FormData;e.forEach(i=>{n.append("files",i)});const s=new XMLHttpRequest;return new Promise((i,a)=>{s.upload.addEventListener("progress",o=>{o.lengthComputable&&t&&t(Math.round(o.loaded/o.total*100))}),s.addEventListener("load",()=>{if(s.status>=200&&s.status<300)try{i(JSON.parse(s.responseText))}catch{a(new Error("Invalid response"))}else a(new Error(`Upload failed: ${s.statusText}`))}),s.addEventListener("error",()=>{a(new Error("Upload failed"))}),s.open("POST","/api/upload"),s.send(n)})}async function Jf(e){const t=new FormData;t.append("file",e);const n=await kt("/api/upload-extract",{method:"POST",body:t});if(!n.ok)throw new Error("Upload failed");return n.json()}async function Yf(){return(await p.get("/api/processing-status")).data}async function Xf(e){try{const t=typeof e=="string"?{status:e}:e||{},n=new URLSearchParams;t.status&&t.status!=="all"&&n.set("status",t.status),t.type&&t.type!=="all"&&n.set("type",t.type),t.search&&n.set("search",t.search),t.sort&&n.set("sort",t.sort),t.order&&n.set("order",t.order),t.limit&&n.set("limit",String(t.limit)),t.offset&&n.set("offset",String(t.offset));const s=n.toString(),i=s?`/api/documents?${s}`:"/api/documents",a=await p.get(i);return{documents:a.data.documents||[],total:a.data.total||0,limit:a.data.limit,offset:a.data.offset,hasMore:a.data.hasMore,statuses:a.data.statuses||{processed:0,pending:0,failed:0,deleted:0}}}catch{return{documents:[],total:0,statuses:{processed:0,pending:0,failed:0,deleted:0}}}}async function eh(e){try{return(await p.get(`/api/documents/${e}`)).data.document}catch{return null}}async function th(e,t){const n=t?.softDelete?"?soft=true":"";await p.delete(`/api/documents/${e}${n}`)}async function nh(e){await p.post(`/api/documents/${e}/restore`),h.success("Document restored")}async function sh(e){await p.post(`/api/documents/${e}/reprocess`),h.info("Document queued for reprocessing")}async function ih(e){return(await p.get(`/api/documents/${e}/summary`)).data.summary||""}async function oh(e){try{const t=e?`/api/knowledge?category=${e}`:"/api/knowledge";return(await p.get(t)).data.items||[]}catch{return[]}}async function ah(e,t){const n=await p.post("/api/knowledge",{content:e,category:t});return n.data.item||{id:n.data.id,content:e,category:t,created_at:new Date().toISOString()}}async function rh(e,t=10){return(await p.get(`/api/knowledge/search?q=${encodeURIComponent(e)}&limit=${t}`)).data.results||[]}async function ch(){try{return(await p.get("/api/conversations")).data.conversations||[]}catch{return[]}}async function vc(e){try{return(await p.get(`/api/conversations/${e}`)).data.conversation}catch{return null}}async function lh(e){return(await p.post("/api/conversations/parse",{text:e})).data}async function dh(e,t){return(await p.post("/api/conversations",{text:e,...t})).data.conversation}async function uh(e){await p.delete(`/api/conversations/${e}`)}async function ph(e){await p.post(`/api/conversations/${e}/reembed`)}async function mh(e){return(await p.post("/api/documents/bulk/delete",{ids:e})).data}async function gh(e){return(await p.post("/api/documents/bulk/reprocess",{ids:e})).data}async function fd(e,t="original"){const n=await kt("/api/documents/bulk/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:e,format:t})});if(!n.ok)throw new Error("Failed to export documents");return n.blob()}async function fh(e,t="original"){const n=await fd(e,t),s=URL.createObjectURL(n),i=document.createElement("a");i.href=s,i.download=`documents_export_${Date.now()}.zip`,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(s)}const Os={upload:Kf,uploadWithExtraction:Jf,getProcessingStatus:Yf,getAll:Xf,get:eh,delete:th,restore:nh,reprocess:sh,getSummary:ih,bulkDelete:mh,bulkReprocess:gh,bulkExport:fd,downloadBulkExport:fh};async function hh(){try{return(await p.get("/api/knowledge/status")).data.status}catch{return{total:0,embedded:0,pending:0,models:[]}}}async function vh(){return(await p.get("/api/knowledge/export?format=markdown")).data.markdown||""}async function bh(){return(await p.get("/api/knowledge/export?format=json")).data.items||[]}async function yh(){return(await p.post("/api/knowledge/regenerate")).data}async function wh(e){return(await p.post("/api/knowledge/synthesize",{topic:e})).data}const kh={getAll:oh,add:ah,search:rh,getStatus:hh,exportMarkdown:vh,exportJson:bh,regenerate:yh,synthesize:wh},pC={getAll:ch,get:vc,getById:vc,parsePreview:lh,import:dh,delete:uh,reembed:ph};async function xh(e){try{const t=new URLSearchParams;e?.folder&&t.set("folder",e.folder),e?.label&&t.set("label",e.label),e?.unread&&t.set("unread","true"),e?.starred&&t.set("starred","true"),e?.search&&t.set("search",e.search),e?.limit&&t.set("limit",String(e.limit)),e?.offset&&t.set("offset",String(e.offset));const n=t.toString(),s=n?`/api/emails?${n}`:"/api/emails";return(await p.get(s)).data}catch{return{emails:[],total:0}}}async function hd(e){try{return(await p.get(`/api/emails/${e}`)).data.email}catch{return null}}async function $h(e){try{return(await p.get(`/api/emails/thread/${e}`)).data.thread}catch{return null}}async function Sh(e){await p.put(`/api/emails/${e}/read`)}async function _h(e){await p.put(`/api/emails/${e}/unread`)}async function Ch(e){await p.put(`/api/emails/${e}/star`)}async function Lh(e){await p.put(`/api/emails/${e}/unstar`)}async function Th(e){await p.put(`/api/emails/${e}/archive`)}async function Ah(e){await p.delete(`/api/emails/${e}`)}async function Eh(e){return(await p.post("/api/emails/send",e)).data}async function Mh(e){return(await p.post("/api/emails/draft",e)).data}async function vd(e,t){return(await p.post(`/api/emails/${e}/ai-response`,{tone:t})).data.suggestions||[]}async function qh(e){return(await p.post(`/api/emails/${e}/summarize`)).data.summary||""}async function jh(e){return(await p.post(`/api/emails/${e}/categorize`)).data}async function Dh(){return(await p.get("/api/emails/stats")).data}async function Ph(){return(await p.post("/api/emails/sync")).data}async function zh(e){return hd(e)}async function Ih(){try{return(await p.get("/api/emails?requires_response=true&response_sent=false")).data.emails||[]}catch{return[]}}async function Hh(e){await p.put(`/api/emails/${e}/responded`)}async function Rh(e,t){return vd(e,t)}const Bh={getAll:xh,get:hd,getById:zh,getThread:$h,markAsRead:Sh,markAsUnread:_h,star:Ch,unstar:Lh,archive:Th,delete:Ah,send:Eh,saveDraft:Mh,generateAIResponse:vd,generateResponse:Rh,generateSummary:qh,categorize:jh,getStats:Dh,sync:Ph,getNeedingResponse:Ih,markResponded:Hh};async function Oh(e){try{const t=new URLSearchParams;e?.types?.length&&t.set("types",e.types.join(",")),e?.limit&&t.set("limit",String(e.limit)),e?.communityId!==void 0&&t.set("communityId",String(e.communityId));const n=await p.get(`/api/graph/nodes?${t.toString()}`),s=await p.get(`/api/graph/relationships?${t.toString()}`),i=n.data.nodes||n.data.results?.map(r=>{const c=r;return{id:String(c.id||c.nodeId||""),label:String(c.name||c.label||c.title||c.content?.substring(0,50)||""),name:String(c.name||""),type:String(c.type||c.label||"Unknown"),avatarUrl:c.avatarUrl||c.avatar_url||c.photoUrl||c.photo_url,role:c.role,organization:c.organization,properties:c}})||[],o=(s.data.relationships||s.data.results||[]).map(r=>{const c=r;return{id:String(c.id||`${c.from||c.source}-${c.to||c.target}-${c.type}`),source:String(c.from||c.source||""),target:String(c.to||c.target||""),label:String(c.type||c.label||""),type:String(c.type||"")}});return{nodes:i,edges:o}}catch(t){return console.error("[GraphService] getVisualizationData error:",t),{nodes:[],edges:[]}}}async function Nh(){try{const e=await p.get("/api/graph/status");return e.data.stats?{...e.data.stats,graphName:e.data.graphName,connected:e.data.connected}:{nodeCount:e.data.nodes||0,edgeCount:e.data.relationships||0,graphName:e.data.graphName,connected:e.data.connected}}catch{return{nodeCount:0,edgeCount:0,connected:!1}}}async function Uh(e){try{const t=new URLSearchParams;e?.type&&t.set("type",e.type),e?.depth&&t.set("depth",String(e.depth)),e?.limit&&t.set("limit",String(e.limit));const n=t.toString(),s=n?`/api/graph?${n}`:"/api/graph";return(await p.get(s)).data}catch{return{nodes:[],edges:[]}}}async function Fh(e,t=2){try{return(await p.get(`/api/graph/entity/${e}?depth=${t}`)).data}catch{return{nodes:[],edges:[]}}}async function Vh(e){try{return(await p.get(`/api/graph/related/${e}`)).data.related||[]}catch{return[]}}async function bd(){try{return(await p.get("/api/ontology/schema")).data.schema||null}catch{return null}}async function Zh(){try{return(await p.get("/api/ontology/entities")).data.entityTypes||[]}catch{return[]}}async function Gh(){try{return(await p.get("/api/ontology/relations")).data.relationTypes||[]}catch{return[]}}async function Wh(){try{return(await p.get("/api/ontology/suggestions")).data.suggestions||[]}catch{return[]}}async function Qh(e){try{return(await p.post(`/api/ontology/suggestions/${e}/approve`,{})).data.ok}catch{return!1}}async function Kh(e){try{return(await p.post(`/api/ontology/suggestions/${e}/reject`,{})).data.ok}catch{return!1}}async function Jh(){try{return(await p.get("/api/ontology/stats")).data.stats||null}catch{return null}}async function Yh(){try{return(await p.get("/api/ontology/sync/status")).data.status||null}catch{return null}}async function Xh(){try{return(await p.post("/api/ontology/sync/force",{})).data}catch(e){return{ok:!1,error:String(e)}}}async function ev(){try{const e=await p.post("/api/ontology/analyze",{});return e.data.ok?e.data:null}catch{return null}}async function tv(e=.85){try{const t=await p.post("/api/ontology/suggestions/auto-approve",{threshold:e});return{approved:t.data.approved||0,skipped:t.data.skipped||0}}catch{return{approved:0,skipped:0}}}async function nv(e={}){try{const t=new URLSearchParams;return e.targetType&&t.append("targetType",e.targetType),e.targetName&&t.append("targetName",e.targetName),e.limit&&t.append("limit",String(e.limit)),(await p.get(`/api/ontology/changes?${t.toString()}`)).data.changes||[]}catch{return[]}}async function sv(){try{return(await p.post("/api/ontology/migrate",{})).data}catch(e){return{success:!1,error:String(e)}}}async function iv(){try{const e=await p.get("/api/ontology/worker/status");return e.data.ok?{status:e.data.status,stats:e.data.stats}:null}catch{return null}}async function ov(e,t={}){try{const n=await p.post("/api/ontology/worker/trigger",{type:e,config:t});return n.data.ok?n.data:null}catch{return null}}async function av(e={}){try{const t=new URLSearchParams;return e.type&&t.append("type",e.type),e.status&&t.append("status",e.status),e.limit&&t.append("limit",String(e.limit)),(await p.get(`/api/ontology/worker/log?${t.toString()}`)).data.log||[]}catch{return[]}}async function rv(){try{return(await p.get("/api/ontology/jobs")).data.jobs||[]}catch{return[]}}async function cv(e,t){try{const n=await p.post(`/api/ontology/jobs/${e}/toggle`,{enabled:t});return n.data.ok?n.data.job:null}catch{return null}}async function lv(){try{return(await p.get("/api/ontology/extract-from-graph")).data}catch{return{ok:!1,error:"Failed to extract ontology"}}}async function dv(){try{const e=await p.get("/api/ontology/validate-compliance");return e.data.ok?e.data:null}catch{return null}}async function uv(){try{const e=await p.get("/api/ontology/diff");return e.data.ok?{diff:e.data.diff,extractedOntology:e.data.extractedOntology}:null}catch{return null}}async function pv(){try{return(await p.get("/api/ontology/unused-types")).data.unused||{entities:[],relations:[]}}catch{return{entities:[],relations:[]}}}async function mv(e){try{return(await p.post("/api/ontology/merge",e)).data}catch{return{ok:!1}}}async function gv(e){try{return(await p.post("/api/ontology/cleanup",e)).data}catch{return{ok:!1}}}async function fv(){try{const e=await p.get("/api/graph/falkordb-browser");return e.data.ok?e.data:null}catch{return null}}async function hv(){try{return(await p.get("/api/graph/list-all")).data}catch{return{ok:!1,graphs:[]}}}async function vv(e=!1){try{return(await p.post("/api/graph/sync-projects",{dryRun:e})).data}catch{return{ok:!1,error:"Request failed",graphs:[],validGraphs:[],orphanGraphs:[],deleted:[],dryRun:e}}}async function bv(e){try{return(await p.delete(`/api/graph/delete/${encodeURIComponent(e)}`)).data}catch{return{ok:!1,error:"Request failed"}}}async function yv(){try{return(await p.get("/api/graphrag/communities")).data.communities||[]}catch{return[]}}async function wv(){try{return(await p.get("/api/graphrag/centrality")).data.centrality||{topNodes:[]}}catch{return{topNodes:[]}}}async function kv(){try{return(await p.get("/api/graphrag/bridges")).data.bridges||[]}catch{return[]}}async function xv(){try{return(await p.get("/api/graph/insights")).data.insights||[]}catch{return[]}}async function $v(e,t){try{return(await p.post("/api/graphrag/query",{query:e,noCache:t?.noCache})).data}catch{return{ok:!1,answer:"Failed to process query",sources:[],queryType:"hybrid",latencyMs:0}}}function Sv(e,t,n,s){const i=new AbortController;return kt("/api/graphrag/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e}),signal:i.signal}).then(async a=>{if(!a.ok)throw new Error("Stream request failed");const o=a.body?.getReader();if(!o)throw new Error("No reader available");const r=new TextDecoder;let c="";for(;;){const{done:l,value:d}=await o.read();if(l)break;const f=r.decode(d,{stream:!0}).split(`
`);for(const g of f)if(g.startsWith("data: ")){const v=g.slice(6);if(v==="[DONE]"){n({ok:!0,answer:c,sources:[],queryType:"hybrid",latencyMs:0});return}try{const y=JSON.parse(v);y.content&&(c+=y.content,t(y.content))}catch{c+=v,t(v)}}}}).catch(a=>{a.name!=="AbortError"&&s(a)}),()=>i.abort()}async function _v(e){try{return(await p.post("/api/graphrag/multihop",{query:e})).data}catch{return{answer:"Failed to process multi-hop query",reasoningChain:[],confidence:0}}}async function Cv(e,t){try{return(await p.post("/api/graphrag/explain",{nodeId1:e,nodeId2:t})).data}catch{return{explanation:"Unable to explain connection",paths:[],facts:[]}}}async function Lv(e){try{return(await p.post("/api/graphrag/summarize",{nodeIds:e})).data}catch{return{summary:"Unable to generate summary",insights:[],suggestedActions:[]}}}async function Tv(e){try{return(await p.post("/api/graphrag/filter",{filterText:e})).data}catch{return{filters:{},explanation:"Unable to parse filter"}}}async function Av(e){try{return(await p.post("/api/graphrag/suggest-related",{nodeId:e})).data.suggestions||[]}catch{return[]}}async function Ev(e){try{return(await p.post("/api/graph/query",{cypher:e})).data}catch(t){return{ok:!1,results:[],error:t instanceof Error?t.message:"Query failed"}}}async function Mv(){try{const e=await bd();return e?.queryPatterns?Object.entries(e.queryPatterns).map(([t,n])=>({id:t,name:t.replace(/_/g," ").replace(/\b\w/g,s=>s.toUpperCase()),description:n.description,cypher:n.cypher,category:"ontology"})):[]}catch{return[]}}async function qv(){try{return(await p.get("/api/graph/projects")).data.graphs||[]}catch{return[]}}async function jv(e){try{return(await p.get(`/api/graph/cross-project/${e}`)).data.entities||[]}catch{return[]}}async function Dv(e){try{return(await p.post("/api/graph/queries",e)).data.query||null}catch{return null}}async function Pv(e){try{const t=new URLSearchParams;return e?.limit&&t.set("limit",String(e.limit)),e?.favoritesOnly&&t.set("favorites","true"),(await p.get(`/api/graph/queries?${t.toString()}`)).data.queries||[]}catch{return[]}}async function zv(e){try{return(await p.patch(`/api/graph/queries/${e}/favorite`,{})).data.ok}catch{return!1}}async function Iv(e){try{return(await p.delete(`/api/graph/queries/${e}`)).data.ok}catch{return!1}}async function Hv(e){try{return(await p.post("/api/graph/views",e)).data.view||null}catch{return null}}async function Rv(){try{return(await p.get("/api/graph/views")).data.views||[]}catch{return[]}}async function Bv(e,t){try{return(await p.patch(`/api/graph/views/${e}`,t)).data.ok}catch{return!1}}async function Ov(e){try{return(await p.delete(`/api/graph/views/${e}`)).data.ok}catch{return!1}}async function Nv(e){try{return(await p.post("/api/graph/bookmarks",e)).data.bookmark||null}catch{return null}}async function Uv(){try{return(await p.get("/api/graph/bookmarks")).data.bookmarks||[]}catch{return[]}}async function Fv(e,t){try{return(await p.patch(`/api/graph/bookmarks/${e}`,t)).data.ok}catch{return!1}}async function Vv(e){try{return(await p.delete(`/api/graph/bookmarks/${e}`)).data.ok}catch{return!1}}async function Zv(e){try{return(await p.post("/api/graph/annotations",e)).data.annotation||null}catch{return null}}async function Gv(e){try{const t=new URLSearchParams;return e?.targetType&&t.set("targetType",e.targetType),e?.targetId&&t.set("targetId",e.targetId),e?.includeShared&&t.set("includeShared","true"),(await p.get(`/api/graph/annotations?${t.toString()}`)).data.annotations||[]}catch{return[]}}async function Wv(e,t){try{return(await p.patch(`/api/graph/annotations/${e}`,t)).data.ok}catch{return!1}}async function Qv(e){try{return(await p.delete(`/api/graph/annotations/${e}`)).data.ok}catch{return!1}}async function Kv(e){try{return(await p.post("/api/graph/chat",e)).data.message||null}catch{return null}}async function Jv(){try{return(await p.get("/api/graph/chat/sessions")).data.sessions||[]}catch{return[]}}async function Yv(e){try{return(await p.get(`/api/graph/chat/session/${e}`)).data.messages||[]}catch{return[]}}async function Xv(e){try{return(await p.patch(`/api/graph/chat/${e}/pin`,{})).data.ok}catch{return!1}}async function eb(e){try{return(await p.post("/api/graph/snapshots",e)).data.snapshot||null}catch{return null}}async function tb(){try{return(await p.get("/api/graph/snapshots")).data.snapshots||[]}catch{return[]}}async function nb(e){try{return(await p.get(`/api/graph/snapshots/${e}`)).data.snapshot||null}catch{return null}}async function sb(e,t){try{return(await p.get(`/api/graph/snapshots/compare?id1=${e}&id2=${t}`)).data}catch{return{diff:{nodesAdded:[],nodesRemoved:[],edgesAdded:[],edgesRemoved:[],statsComparison:{nodeCountDiff:0,edgeCountDiff:0}}}}}async function ib(e){try{return(await p.delete(`/api/graph/snapshots/${e}`)).data.ok}catch{return!1}}async function bc(e){try{const t=new URLSearchParams;e?.startDate&&t.set("startDate",e.startDate),e?.endDate&&t.set("endDate",e.endDate),e?.types?.length&&t.set("types",e.types.join(",")),e?.limit&&t.set("limit",String(e.limit));const n=t.toString(),s=n?`/api/timeline?${n}`:"/api/timeline",i=await p.get(s),o=(i.data.events||[]).map(r=>({id:String(r.id??""),date:String(r.date??""),title:String(r.title??""),description:r.content!=null?String(r.content):void 0,content:r.content!=null?String(r.content):void 0,type:r.type??"document",entity_id:r.entity_id!=null?String(r.entity_id):void 0,entity_type:r.entity_type!=null?String(r.entity_type):void 0,metadata:r.metadata??void 0,user:r.owner!=null?String(r.owner):r.user,actor:r.owner!=null?String(r.owner):r.actor,owner:r.owner!=null?String(r.owner):void 0,icon:r.icon,color:r.color,status:r.status}));return{events:o,totalEvents:i.data.totalEvents??o.length,startDate:i.data.startDate??"",endDate:i.data.endDate??""}}catch{return{events:[],startDate:"",endDate:"",totalEvents:0}}}async function ob(e,t){try{return(await p.get(`/api/timeline/${e}/${t}`)).data.events||[]}catch{return[]}}async function ab(e){try{const t=new URLSearchParams;e?.startDate&&t.set("startDate",e.startDate),e?.endDate&&t.set("endDate",e.endDate),e?.provider&&t.set("provider",e.provider),e?.model&&t.set("model",e.model);const n=t.toString(),s=n?`/api/costs?${n}`:"/api/costs";return(await p.get(s)).data.costs||[]}catch{return[]}}async function rb(e){try{const t=e?`/api/costs/summary?period=${e}`:"/api/costs/summary",s=(await p.get(t)).data;if(!s)return{total:0,byProvider:{},byModel:{},byOperation:{},period:{start:"",end:""},dailyBreakdown:[]};const a=(s.dailyBreakdown??s.daily_breakdown??[]).map(o=>({date:o.date,cost:typeof o.cost=="number"?o.cost:parseFloat(String(o.cost))||0,calls:o.calls??o.requests??0}));return{total:typeof s.total=="number"?s.total:parseFloat(String(s.total))||0,byProvider:s.byProvider??s.by_provider??{},byModel:s.byModel??s.by_model??{},byOperation:s.byOperation??s.by_operation??{},byContext:s.byContext??s.by_context,period:s.period??{start:"",end:""},dailyBreakdown:a,totalInputTokens:s.totalInputTokens??s.total_input_tokens,totalOutputTokens:s.totalOutputTokens??s.total_output_tokens,previousPeriodCost:s.previousPeriodCost??s.previous_period_cost,percentChange:s.percentChange??s.percent_change,budgetLimit:s.budgetLimit??s.budget_limit,budgetUsedPercent:s.budgetUsedPercent??s.budget_used_percent,budgetAlertTriggered:s.budgetAlertTriggered??s.budget_alert_triggered}}catch{return{total:0,byProvider:{},byModel:{},byOperation:{},period:{start:"",end:""},dailyBreakdown:[]}}}async function cb(e=20){try{return(await p.get(`/api/costs/recent?limit=${e}`)).data?.requests??[]}catch{return[]}}async function lb(){try{return(await p.get("/api/costs/pricing")).data?.pricing??[]}catch{return[]}}async function db(e){try{const n=(await p.get(`/api/costs/budget?period=${e}`)).data?.budget;if(!n)return null;const s=n.limitUsd??n.limit_usd,i=n.alertThresholdPercent??n.alert_threshold_percent;return s==null||!Number.isFinite(Number(s))?null:{period:n.period??e,limitUsd:Number(s),alertThresholdPercent:i!=null?Math.min(100,Math.max(0,Number(i))):80,notifiedAt:n.notifiedAt??n.notified_at}}catch{return null}}async function ub(e,t,n){await p.post("/api/costs/budget",{period:e,limitUsd:t,alertThresholdPercent:n})}async function pb(){try{return(await p.get("/api/llm/config")).data}catch{return{provider:"unknown",model:"unknown",available:[]}}}const xr={getVisualizationData:Oh,getStats:Nh,getGraph:Uh,getEntityGraph:Fh,getRelated:Vh,getOntologySchema:bd,getOntologyEntities:Zh,getOntologyRelations:Gh,getOntologySuggestions:Wh,approveOntologySuggestion:Qh,rejectOntologySuggestion:Kh,getOntologyTypeStats:Jh,getOntologySyncStatus:Yh,forceOntologySync:Xh,runLLMAnalysis:ev,autoApproveHighConfidence:tv,getOntologyChanges:nv,migrateOntologyToSupabase:sv,getBackgroundWorkerStatus:iv,triggerBackgroundAnalysis:ov,getBackgroundWorkerLog:av,getOntologyJobs:rv,toggleOntologyJob:cv,extractOntologyFromGraph:lv,validateOntologyCompliance:dv,getOntologyDiff:uv,findUnusedOntologyTypes:pv,mergeOntology:mv,cleanupOntology:gv,getFalkorDBBrowserInfo:fv,listAllFalkorDBGraphs:hv,syncFalkorDBGraphs:vv,deleteFalkorDBGraph:bv,getCommunities:yv,getCentrality:wv,getBridges:kv,getInsights:xv,query:$v,stream:Sv,multiHop:_v,explainConnection:Cv,summarizeSelection:Lv,naturalLanguageFilter:Tv,suggestRelated:Av,executeCypher:Ev,getQueryTemplates:Mv,getProjectGraphs:qv,getCrossProjectEntities:jv,saveQueryHistory:Dv,getQueryHistory:Pv,toggleQueryFavorite:zv,deleteQueryHistory:Iv,saveView:Hv,getSavedViews:Rv,updateView:Bv,deleteView:Ov,addBookmark:Nv,getBookmarks:Uv,updateBookmark:Fv,removeBookmark:Vv,createAnnotation:Zv,getAnnotations:Gv,updateAnnotation:Wv,deleteAnnotation:Qv,saveChatMessage:Kv,getChatSessions:Jv,getChatHistory:Yv,toggleChatPin:Xv,createSnapshot:eb,getSnapshots:tb,getSnapshot:nb,compareSnapshots:sb,deleteSnapshot:ib},yd={getAll:bc,getTimeline:bc,getForEntity:ob},mb={getAll:ab,getSummary:rb,getRecentRequests:cb,getPricing:lb,getBudget:db,setBudget:ub,getLLMConfig:pb};async function gb(e){try{const t=new URLSearchParams;e?.unread&&t.set("unread","true"),e?.type&&t.set("type",e.type),e?.limit&&t.set("limit",String(e.limit));const n=t.toString(),s=n?`/api/notifications?${n}`:"/api/notifications";return(await p.get(s)).data.notifications||[]}catch{return[]}}async function fb(){try{return(await p.get("/api/notifications/count")).data.count||0}catch{return 0}}async function yc(e){await p.post(`/api/notifications/${e}/read`)}async function wc(){await p.post("/api/notifications/read-all")}async function hb(e){await p.delete(`/api/notifications/${e}`)}async function vb(e,t){try{return(await p.get(`/api/comments/${e}/${t}`)).data.comments||[]}catch{return[]}}async function wd(e,t,n,s){const i=await p.post(`/api/comments/${e}/${t}`,{content:n,parentId:s});return i.data.comment||{id:i.data.id,entity_type:e,entity_id:t,content:n,author:"You",created_at:new Date().toISOString(),is_edited:!1}}async function bb(e,t){await p.put(`/api/comments/${e}`,{content:t})}async function yb(e){await p.delete(`/api/comments/${e}`)}async function wb(e,t){await p.post(`/api/comments/${e}/react`,{emoji:t})}async function kb(e,t){await p.delete(`/api/comments/${e}/react/${t}`)}async function xb(e,t,n,s){return wd(e,t,n,s)}async function $b(e){await p.put(`/api/comments/${e}/resolve`)}async function Sb(e){try{const t=e?`/api/projects/${e}/members`:"/api/project/members";return(await p.get(t)).data.members||[]}catch{return[]}}async function _b(e,t,n){const s=n?`/api/projects/${n}/members`:"/api/project/members";return(await p.post(s,{email:e,role:t})).data}async function Cb(e,t,n){const s=n?`/api/projects/${n}/members/${e}`:`/api/project/members/${e}`;await p.put(s,{role:t})}async function Lb(e,t){const n=t?`/api/projects/${t}/members/${e}`:`/api/project/members/${e}`;await p.delete(n)}const qs={getAll:gb,getUnreadCount:fb,markAsRead:yc,markRead:yc,markAllAsRead:wc,markAllRead:wc,delete:hb},Ls={getAll:vb,add:wd,create:xb,update:bb,delete:yb,addReaction:wb,removeReaction:kb,resolve:$b};async function Tb(e){try{const t=e?`/api/projects/${e}/invites`:"/api/project/invites";return(await p.get(t)).data.invites||[]}catch{return[]}}const qi={getAll:Sb,invite:_b,updateRole:Cb,remove:Lb,getInvites:Tb};async function Ab(){try{return(await p.get("/api/settings")).data}catch{return{}}}async function Eb(e){await p.put("/api/settings",e)}async function Mb(e){try{const t=e?`/api/projects/${e}/settings`:"/api/project/settings";return(await p.get(t)).data.settings}catch{return null}}async function qb(e,t){const n=t?`/api/projects/${t}/settings`:"/api/project/settings";await p.put(n,e)}async function jb(){try{return(await p.get("/api/api-keys")).data.keys||[]}catch{return[]}}async function Db(e,t){return(await p.post("/api/api-keys",{name:e,permissions:t})).data}async function Pb(e){await p.delete(`/api/api-keys/${e}`)}async function zb(){try{return(await p.get("/api/webhooks")).data.webhooks||[]}catch{return[]}}async function Ib(e){const t=await p.post("/api/webhooks",e);return t.data.webhook||{...e,id:t.data.id,is_active:!0,failure_count:0,created_at:new Date().toISOString()}}async function Hb(e,t){await p.put(`/api/webhooks/${e}`,t)}async function Rb(e){await p.delete(`/api/webhooks/${e}`)}async function Bb(e){return(await p.post(`/api/webhooks/${e}/test`)).data}async function Ob(e){try{const t=new URLSearchParams;e?.action&&t.set("action",e.action),e?.entity_type&&t.set("entity_type",e.entity_type),e?.user_id&&t.set("user_id",e.user_id),e?.startDate&&t.set("startDate",e.startDate),e?.endDate&&t.set("endDate",e.endDate),e?.limit&&t.set("limit",String(e.limit)),e?.offset&&t.set("offset",String(e.offset));const n=t.toString(),s=n?`/api/audit?${n}`:"/api/audit";return(await p.get(s)).data}catch{return{logs:[],total:0}}}async function Nb(e,t){const n=new URLSearchParams;n.set("format",e),t?.startDate&&n.set("startDate",t.startDate),t?.endDate&&n.set("endDate",t.endDate);const s=await kt(`/api/audit/export?${n.toString()}`);if(!s.ok)throw new Error("Export failed");return s.blob()}const Ub={get:Ab,update:Eb},Fb={get:Mb,update:qb},Vb={getAll:jb,create:Db,revoke:Pb},Zb={getAll:zb,create:Ib,update:Hb,delete:Rb,test:Bb},Gb={getAll:Ob,export:Nb};async function Wb(){try{return(await p.get("/api/profile")).data.profile}catch{return null}}async function Qb(e){const t=await p.put("/api/profile",e),n=z.getState().currentUser;return n&&z.setCurrentUser({...n,name:e.display_name||n.name,avatar:e.avatar_url||n.avatar}),t.data.profile}async function Kb(e){const t=new FormData;t.append("avatar",e);const n=await kt("/api/profile/avatar",{method:"POST",body:t});if(!n.ok)throw new Error("Avatar upload failed");const s=await n.json(),i=z.getState().currentUser;return i&&z.setCurrentUser({...i,avatar:s.avatar_url}),s.avatar_url}async function Jb(){await p.delete("/api/profile/avatar");const e=z.getState().currentUser;e&&z.setCurrentUser({...e,avatar:void 0})}async function Yb(e){if(e.new_password.length<12)throw new Error("New password must be at least 12 characters");await p.post("/api/profile/change-password",e)}async function Xb(e){await p.post("/api/profile/delete",{password:e}),z.setCurrentUser(null),z.setCurrentProject(null)}async function ey(e=50){try{return(await p.get(`/api/profile/activity?limit=${e}`)).data.activities||[]}catch{return[]}}async function ty(){try{return(await p.get("/api/profile/sessions")).data.sessions||[]}catch{return[]}}async function ny(e){await p.delete(`/api/profile/sessions/${e}`)}async function sy(){await p.post("/api/profile/sessions/revoke-all")}const Cn={get:Wb,update:Qb,uploadAvatar:Kb,removeAvatar:Jb,changePassword:Yb,deleteAccount:Xb,getActivity:ey,getSessions:ty,revokeSession:ny,revokeAllSessions:sy};async function Hi(e){try{const t=new URLSearchParams;e?.limit&&t.set("limit",String(e.limit)),e?.offset&&t.set("offset",String(e.offset)),e?.search&&t.set("search",e.search),e?.category&&t.set("category",e.category),e?.verified!==void 0&&t.set("verified",String(e.verified));const n=t.toString(),s=n?`/api/facts?${n}`:"/api/facts",i=await p.get(s);return{facts:i.data.facts||[],total:i.data.total||i.data.facts?.length||0}}catch{return{facts:[],total:0}}}async function kd(e){try{return(await p.get(`/api/facts/${e}`)).data.fact}catch{return null}}async function xd(e){const t=await p.post("/api/facts",e);return t.data.fact||{...e,id:t.data.id,created_at:new Date().toISOString()}}async function $r(e,t){return(await p.put(`/api/facts/${e}`,t)).data.fact}async function Da(e){await p.delete(`/api/facts/${e}`)}async function $d(){try{return(await p.get("/api/facts/deleted")).data.facts||[]}catch{return[]}}async function Sd(e){return(await p.post(`/api/facts/${e}/restore`,{})).data.fact}async function Pa(e){return $r(e,{verified:!0})}async function _d(){return(await p.post("/api/fact-check/run",{})).data}async function Cd(){try{return(await p.get("/api/conflicts")).data.conflicts||[]}catch{return[]}}async function Ld(){try{const{facts:e}=await Hi({limit:1e3}),t={};return e.forEach(n=>{const s=n.category||"Uncategorized";t[s]||(t[s]=[]),t[s].push(n)}),t}catch{return{}}}async function Td(){try{const{facts:e}=await Hi({limit:1e3}),t={};return e.forEach(n=>{const s=n.source_file||n.source||"Unknown source";t[s]||(t[s]=[]),t[s].push(n)}),t}catch{return{}}}async function Ad(e){try{const t=new URLSearchParams({document_id:e});return(await p.get(`/api/facts?${t}`)).data.facts||[]}catch{return[]}}async function Ed(e){try{return(await p.get(`/api/facts/${e}/events`)).data.events||[]}catch{return[]}}async function Md(e,t=10){try{const n=new URLSearchParams;t!==10&&n.set("limit",String(t));const s=n.toString(),i=s?`/api/facts/${e}/similar?${s}`:`/api/facts/${e}/similar`;return(await p.get(i)).data.similar||[]}catch{return[]}}async function qd(e,t=20){const{facts:n}=await Hi({search:e,limit:t});return n}function jd(e){const t={total:e.length,verified:e.filter(n=>n.verified).length,unverified:e.filter(n=>!n.verified).length,byCategory:{}};return e.forEach(n=>{const s=n.category||"Uncategorized";t.byCategory[s]=(t.byCategory[s]||0)+1}),t}const Ye={getAll:Hi,get:kd,create:xd,update:$r,delete:Da,deleteFact:Da,verify:Pa,verifyFact:Pa,detectConflicts:Cd,getByCategory:Ld,getBySource:Td,getByDocument:Ad,getEvents:Ed,getSimilarFacts:Md,search:qd,getStats:jd,getDeletedFacts:$d,restoreFact:Sd,runFactCheck:_d},iy=Object.freeze(Object.defineProperty({__proto__:null,createFact:xd,deleteFact:Da,detectConflicts:Cd,factsService:Ye,getDeletedFacts:$d,getFact:kd,getFactEvents:Ed,getFactStats:jd,getFacts:Hi,getFactsByCategory:Ld,getFactsByDocument:Ad,getFactsBySource:Td,getSimilarFacts:Md,restoreFact:Sd,runFactCheck:_d,searchFacts:qd,updateFact:$r,verifyFact:Pa},Symbol.toStringTag,{value:"Module"}));async function kc(){try{return(await p.get("/api/krisp/webhook")).data.webhook}catch{return null}}async function oy(){try{return(await p.post("/api/krisp/webhook/regenerate")).data.webhook}catch{return null}}async function ay(e){try{return await p.put("/api/krisp/webhook/toggle",{is_active:e}),!0}catch{return!1}}async function ry(e={}){const t=new URLSearchParams;e.status&&(Array.isArray(e.status)?t.append("status",e.status.join(",")):t.append("status",e.status)),e.projectId&&t.append("project_id",e.projectId),e.limit&&t.append("limit",String(e.limit)),e.offset&&t.append("offset",String(e.offset));const n=`/api/krisp/transcripts${t.toString()?`?${t}`:""}`;return(await p.get(n)).data.transcripts}async function cy(){try{return(await p.get("/api/krisp/transcripts/summary")).data.summary}catch{return null}}async function mC(e,t){try{return await p.post(`/api/krisp/transcripts/${e}/assign`,{project_id:t}),!0}catch{return!1}}async function gC(e,t){try{return await p.post(`/api/krisp/transcripts/${e}/skip`,{reason:t}),!0}catch{return!1}}async function fC(e){try{return await p.post(`/api/krisp/transcripts/${e}/retry`),!0}catch{return!1}}async function hC(e){try{return await p.post(`/api/krisp/transcripts/${e}/process`),!0}catch{return!1}}async function vC(){try{return(await p.get("/api/krisp/mappings")).data.mappings}catch{return[]}}async function bC(e){try{return await p.delete(`/api/krisp/mappings/${e}`),!0}catch{return!1}}async function yC(e,t={}){try{return(await p.post(`/api/krisp/transcripts/${e}/summary`,{forceRegenerate:t.forceRegenerate||!1})).data.summary}catch{return null}}async function wC(){return ry({status:["quarantine","ambiguous"]})}async function kC(e={}){try{const t=new URLSearchParams;e.limit&&t.set("limit",String(e.limit)),e.offset&&t.set("offset",String(e.offset)),e.showImported===!1&&t.set("showImported","false"),e.startDate&&t.set("startDate",e.startDate),e.endDate&&t.set("endDate",e.endDate),e.search&&t.set("search",e.search);const n=`/api/krisp/available${t.toString()?"?"+t.toString():""}`;return(await p.get(n)).data}catch{return null}}async function xC(e,t){try{return(await p.post("/api/krisp/available/import",{meetingIds:e,projectId:t})).data}catch{return null}}async function $C(e){try{return(await p.post("/api/krisp/available/summary",{meetingId:e})).data}catch{return null}}function SC(e){return{pending:{label:"Pending",color:"blue"},quarantine:{label:"Quarantine",color:"yellow"},ambiguous:{label:"Ambiguous",color:"orange"},matched:{label:"Matched",color:"cyan"},processed:{label:"Processed",color:"green"},failed:{label:"Failed",color:"red"},skipped:{label:"Skipped",color:"gray"}}[e]||{label:e,color:"gray"}}function _C(e){if(!e)return"-";const t=Math.floor(e/60),n=e%60;return t>0?`${t}h ${n}m`:`${n}m`}const{entries:Dd,setPrototypeOf:xc,isFrozen:ly,getPrototypeOf:dy,getOwnPropertyDescriptor:uy}=Object;let{freeze:Lt,seal:Wt,create:za}=Object,{apply:Ia,construct:Ha}=typeof Reflect<"u"&&Reflect;Lt||(Lt=function(t){return t});Wt||(Wt=function(t){return t});Ia||(Ia=function(t,n){for(var s=arguments.length,i=new Array(s>2?s-2:0),a=2;a<s;a++)i[a-2]=arguments[a];return t.apply(n,i)});Ha||(Ha=function(t){for(var n=arguments.length,s=new Array(n>1?n-1:0),i=1;i<n;i++)s[i-1]=arguments[i];return new t(...s)});const Oi=Tt(Array.prototype.forEach),py=Tt(Array.prototype.lastIndexOf),$c=Tt(Array.prototype.pop),Xs=Tt(Array.prototype.push),my=Tt(Array.prototype.splice),ro=Tt(String.prototype.toLowerCase),na=Tt(String.prototype.toString),sa=Tt(String.prototype.match),ei=Tt(String.prototype.replace),gy=Tt(String.prototype.indexOf),fy=Tt(String.prototype.trim),en=Tt(Object.prototype.hasOwnProperty),_t=Tt(RegExp.prototype.test),ti=hy(TypeError);function Tt(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var n=arguments.length,s=new Array(n>1?n-1:0),i=1;i<n;i++)s[i-1]=arguments[i];return Ia(e,t,s)}}function hy(e){return function(){for(var t=arguments.length,n=new Array(t),s=0;s<t;s++)n[s]=arguments[s];return Ha(e,n)}}function ke(e,t){let n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:ro;xc&&xc(e,null);let s=t.length;for(;s--;){let i=t[s];if(typeof i=="string"){const a=n(i);a!==i&&(ly(t)||(t[s]=a),i=a)}e[i]=!0}return e}function vy(e){for(let t=0;t<e.length;t++)en(e,t)||(e[t]=null);return e}function dn(e){const t=za(null);for(const[n,s]of Dd(e))en(e,n)&&(Array.isArray(s)?t[n]=vy(s):s&&typeof s=="object"&&s.constructor===Object?t[n]=dn(s):t[n]=s);return t}function ni(e,t){for(;e!==null;){const s=uy(e,t);if(s){if(s.get)return Tt(s.get);if(typeof s.value=="function")return Tt(s.value)}e=dy(e)}function n(){return null}return n}const Sc=Lt(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),ia=Lt(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),oa=Lt(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),by=Lt(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),aa=Lt(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),yy=Lt(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),_c=Lt(["#text"]),Cc=Lt(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns","slot"]),ra=Lt(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),Lc=Lt(["accent","accentunder","align","bevelled","close","columnsalign","columnlines","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lspace","lquote","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),Ni=Lt(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),wy=Wt(/\{\{[\w\W]*|[\w\W]*\}\}/gm),ky=Wt(/<%[\w\W]*|[\w\W]*%>/gm),xy=Wt(/\$\{[\w\W]*/gm),$y=Wt(/^data-[\-\w.\u00B7-\uFFFF]+$/),Sy=Wt(/^aria-[\-\w]+$/),Pd=Wt(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),_y=Wt(/^(?:\w+script|data):/i),Cy=Wt(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),zd=Wt(/^html$/i),Ly=Wt(/^[a-z][.\w]*(-[.\w]+)+$/i);var Tc=Object.freeze({__proto__:null,ARIA_ATTR:Sy,ATTR_WHITESPACE:Cy,CUSTOM_ELEMENT:Ly,DATA_ATTR:$y,DOCTYPE_NAME:zd,ERB_EXPR:ky,IS_ALLOWED_URI:Pd,IS_SCRIPT_OR_DATA:_y,MUSTACHE_EXPR:wy,TMPLIT_EXPR:xy});const si={element:1,text:3,progressingInstruction:7,comment:8,document:9},Ty=function(){return typeof window>"u"?null:window},Ay=function(t,n){if(typeof t!="object"||typeof t.createPolicy!="function")return null;let s=null;const i="data-tt-policy-suffix";n&&n.hasAttribute(i)&&(s=n.getAttribute(i));const a="dompurify"+(s?"#"+s:"");try{return t.createPolicy(a,{createHTML(o){return o},createScriptURL(o){return o}})}catch{return console.warn("TrustedTypes policy "+a+" could not be created."),null}},Ac=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}};function Id(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:Ty();const t=pe=>Id(pe);if(t.version="3.3.1",t.removed=[],!e||!e.document||e.document.nodeType!==si.document||!e.Element)return t.isSupported=!1,t;let{document:n}=e;const s=n,i=s.currentScript,{DocumentFragment:a,HTMLTemplateElement:o,Node:r,Element:c,NodeFilter:l,NamedNodeMap:d=e.NamedNodeMap||e.MozNamedAttrMap,HTMLFormElement:m,DOMParser:f,trustedTypes:g}=e,v=c.prototype,y=ni(v,"cloneNode"),S=ni(v,"remove"),w=ni(v,"nextSibling"),k=ni(v,"childNodes"),x=ni(v,"parentNode");if(typeof o=="function"){const pe=n.createElement("template");pe.content&&pe.content.ownerDocument&&(n=pe.content.ownerDocument)}let b,C="";const{implementation:T,createNodeIterator:A,createDocumentFragment:M,getElementsByTagName:Q}=n,{importNode:q}=s;let V=Ac();t.isSupported=typeof Dd=="function"&&typeof x=="function"&&T&&T.createHTMLDocument!==void 0;const{MUSTACHE_EXPR:I,ERB_EXPR:H,TMPLIT_EXPR:W,DATA_ATTR:ee,ARIA_ATTR:te,IS_SCRIPT_OR_DATA:ue,ATTR_WHITESPACE:Pe,CUSTOM_ELEMENT:ze}=Tc;let{IS_ALLOWED_URI:st}=Tc,we=null;const oe=ke({},[...Sc,...ia,...oa,...aa,..._c]);let Y=null;const le=ke({},[...Cc,...ra,...Lc,...Ni]);let G=Object.seal(za(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),ge=null,ye=null;const _e=Object.seal(za(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let j=!0,Z=!0,R=!1,D=!0,K=!1,ie=!0,xe=!1,Ce=!1,$e=!1,it=!1,xt=!1,Jt=!1,rn=!0,$t=!1;const At="user-content-";let F=!0,O=!1,P={},L=null;const B=ke({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","style","svg","template","thead","title","video","xmp"]);let J=null;const ne=ke({},["audio","video","img","source","image","track"]);let he=null;const De=ke({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),St="http://www.w3.org/1998/Math/MathML",Qe="http://www.w3.org/2000/svg",ot="http://www.w3.org/1999/xhtml";let Dn=ot,Ws=!1,es=null;const Bi=ke({},[St,Qe,ot],na);let ts=ke({},["mi","mo","mn","ms","mtext"]),It=ke({},["annotation-xml"]);const Jo=ke({},["title","style","font","a","script"]);let Qs=null;const Gp=["application/xhtml+xml","text/html"],Wp="text/html";let et=null,bs=null;const Qp=n.createElement("form"),sc=function($){return $ instanceof RegExp||$ instanceof Function},Yo=function(){let $=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(!(bs&&bs===$)){if((!$||typeof $!="object")&&($={}),$=dn($),Qs=Gp.indexOf($.PARSER_MEDIA_TYPE)===-1?Wp:$.PARSER_MEDIA_TYPE,et=Qs==="application/xhtml+xml"?na:ro,we=en($,"ALLOWED_TAGS")?ke({},$.ALLOWED_TAGS,et):oe,Y=en($,"ALLOWED_ATTR")?ke({},$.ALLOWED_ATTR,et):le,es=en($,"ALLOWED_NAMESPACES")?ke({},$.ALLOWED_NAMESPACES,na):Bi,he=en($,"ADD_URI_SAFE_ATTR")?ke(dn(De),$.ADD_URI_SAFE_ATTR,et):De,J=en($,"ADD_DATA_URI_TAGS")?ke(dn(ne),$.ADD_DATA_URI_TAGS,et):ne,L=en($,"FORBID_CONTENTS")?ke({},$.FORBID_CONTENTS,et):B,ge=en($,"FORBID_TAGS")?ke({},$.FORBID_TAGS,et):dn({}),ye=en($,"FORBID_ATTR")?ke({},$.FORBID_ATTR,et):dn({}),P=en($,"USE_PROFILES")?$.USE_PROFILES:!1,j=$.ALLOW_ARIA_ATTR!==!1,Z=$.ALLOW_DATA_ATTR!==!1,R=$.ALLOW_UNKNOWN_PROTOCOLS||!1,D=$.ALLOW_SELF_CLOSE_IN_ATTR!==!1,K=$.SAFE_FOR_TEMPLATES||!1,ie=$.SAFE_FOR_XML!==!1,xe=$.WHOLE_DOCUMENT||!1,it=$.RETURN_DOM||!1,xt=$.RETURN_DOM_FRAGMENT||!1,Jt=$.RETURN_TRUSTED_TYPE||!1,$e=$.FORCE_BODY||!1,rn=$.SANITIZE_DOM!==!1,$t=$.SANITIZE_NAMED_PROPS||!1,F=$.KEEP_CONTENT!==!1,O=$.IN_PLACE||!1,st=$.ALLOWED_URI_REGEXP||Pd,Dn=$.NAMESPACE||ot,ts=$.MATHML_TEXT_INTEGRATION_POINTS||ts,It=$.HTML_INTEGRATION_POINTS||It,G=$.CUSTOM_ELEMENT_HANDLING||{},$.CUSTOM_ELEMENT_HANDLING&&sc($.CUSTOM_ELEMENT_HANDLING.tagNameCheck)&&(G.tagNameCheck=$.CUSTOM_ELEMENT_HANDLING.tagNameCheck),$.CUSTOM_ELEMENT_HANDLING&&sc($.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)&&(G.attributeNameCheck=$.CUSTOM_ELEMENT_HANDLING.attributeNameCheck),$.CUSTOM_ELEMENT_HANDLING&&typeof $.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements=="boolean"&&(G.allowCustomizedBuiltInElements=$.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements),K&&(Z=!1),xt&&(it=!0),P&&(we=ke({},_c),Y=[],P.html===!0&&(ke(we,Sc),ke(Y,Cc)),P.svg===!0&&(ke(we,ia),ke(Y,ra),ke(Y,Ni)),P.svgFilters===!0&&(ke(we,oa),ke(Y,ra),ke(Y,Ni)),P.mathMl===!0&&(ke(we,aa),ke(Y,Lc),ke(Y,Ni))),$.ADD_TAGS&&(typeof $.ADD_TAGS=="function"?_e.tagCheck=$.ADD_TAGS:(we===oe&&(we=dn(we)),ke(we,$.ADD_TAGS,et))),$.ADD_ATTR&&(typeof $.ADD_ATTR=="function"?_e.attributeCheck=$.ADD_ATTR:(Y===le&&(Y=dn(Y)),ke(Y,$.ADD_ATTR,et))),$.ADD_URI_SAFE_ATTR&&ke(he,$.ADD_URI_SAFE_ATTR,et),$.FORBID_CONTENTS&&(L===B&&(L=dn(L)),ke(L,$.FORBID_CONTENTS,et)),$.ADD_FORBID_CONTENTS&&(L===B&&(L=dn(L)),ke(L,$.ADD_FORBID_CONTENTS,et)),F&&(we["#text"]=!0),xe&&ke(we,["html","head","body"]),we.table&&(ke(we,["tbody"]),delete ge.tbody),$.TRUSTED_TYPES_POLICY){if(typeof $.TRUSTED_TYPES_POLICY.createHTML!="function")throw ti('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof $.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw ti('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');b=$.TRUSTED_TYPES_POLICY,C=b.createHTML("")}else b===void 0&&(b=Ay(g,i)),b!==null&&typeof C=="string"&&(C=b.createHTML(""));Lt&&Lt($),bs=$}},ic=ke({},[...ia,...oa,...by]),oc=ke({},[...aa,...yy]),Kp=function($){let N=x($);(!N||!N.tagName)&&(N={namespaceURI:Dn,tagName:"template"});const ae=ro($.tagName),Oe=ro(N.tagName);return es[$.namespaceURI]?$.namespaceURI===Qe?N.namespaceURI===ot?ae==="svg":N.namespaceURI===St?ae==="svg"&&(Oe==="annotation-xml"||ts[Oe]):!!ic[ae]:$.namespaceURI===St?N.namespaceURI===ot?ae==="math":N.namespaceURI===Qe?ae==="math"&&It[Oe]:!!oc[ae]:$.namespaceURI===ot?N.namespaceURI===Qe&&!It[Oe]||N.namespaceURI===St&&!ts[Oe]?!1:!oc[ae]&&(Jo[ae]||!ic[ae]):!!(Qs==="application/xhtml+xml"&&es[$.namespaceURI]):!1},cn=function($){Xs(t.removed,{element:$});try{x($).removeChild($)}catch{S($)}},ns=function($,N){try{Xs(t.removed,{attribute:N.getAttributeNode($),from:N})}catch{Xs(t.removed,{attribute:null,from:N})}if(N.removeAttribute($),$==="is")if(it||xt)try{cn(N)}catch{}else try{N.setAttribute($,"")}catch{}},ac=function($){let N=null,ae=null;if($e)$="<remove></remove>"+$;else{const Xe=sa($,/^[\r\n\t ]+/);ae=Xe&&Xe[0]}Qs==="application/xhtml+xml"&&Dn===ot&&($='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+$+"</body></html>");const Oe=b?b.createHTML($):$;if(Dn===ot)try{N=new f().parseFromString(Oe,Qs)}catch{}if(!N||!N.documentElement){N=T.createDocument(Dn,"template",null);try{N.documentElement.innerHTML=Ws?C:Oe}catch{}}const gt=N.body||N.documentElement;return $&&ae&&gt.insertBefore(n.createTextNode(ae),gt.childNodes[0]||null),Dn===ot?Q.call(N,xe?"html":"body")[0]:xe?N.documentElement:gt},rc=function($){return A.call($.ownerDocument||$,$,l.SHOW_ELEMENT|l.SHOW_COMMENT|l.SHOW_TEXT|l.SHOW_PROCESSING_INSTRUCTION|l.SHOW_CDATA_SECTION,null)},Xo=function($){return $ instanceof m&&(typeof $.nodeName!="string"||typeof $.textContent!="string"||typeof $.removeChild!="function"||!($.attributes instanceof d)||typeof $.removeAttribute!="function"||typeof $.setAttribute!="function"||typeof $.namespaceURI!="string"||typeof $.insertBefore!="function"||typeof $.hasChildNodes!="function")},cc=function($){return typeof r=="function"&&$ instanceof r};function kn(pe,$,N){Oi(pe,ae=>{ae.call(t,$,N,bs)})}const lc=function($){let N=null;if(kn(V.beforeSanitizeElements,$,null),Xo($))return cn($),!0;const ae=et($.nodeName);if(kn(V.uponSanitizeElement,$,{tagName:ae,allowedTags:we}),ie&&$.hasChildNodes()&&!cc($.firstElementChild)&&_t(/<[/\w!]/g,$.innerHTML)&&_t(/<[/\w!]/g,$.textContent)||$.nodeType===si.progressingInstruction||ie&&$.nodeType===si.comment&&_t(/<[/\w]/g,$.data))return cn($),!0;if(!(_e.tagCheck instanceof Function&&_e.tagCheck(ae))&&(!we[ae]||ge[ae])){if(!ge[ae]&&uc(ae)&&(G.tagNameCheck instanceof RegExp&&_t(G.tagNameCheck,ae)||G.tagNameCheck instanceof Function&&G.tagNameCheck(ae)))return!1;if(F&&!L[ae]){const Oe=x($)||$.parentNode,gt=k($)||$.childNodes;if(gt&&Oe){const Xe=gt.length;for(let Et=Xe-1;Et>=0;--Et){const xn=y(gt[Et],!0);xn.__removalCount=($.__removalCount||0)+1,Oe.insertBefore(xn,w($))}}}return cn($),!0}return $ instanceof c&&!Kp($)||(ae==="noscript"||ae==="noembed"||ae==="noframes")&&_t(/<\/no(script|embed|frames)/i,$.innerHTML)?(cn($),!0):(K&&$.nodeType===si.text&&(N=$.textContent,Oi([I,H,W],Oe=>{N=ei(N,Oe," ")}),$.textContent!==N&&(Xs(t.removed,{element:$.cloneNode()}),$.textContent=N)),kn(V.afterSanitizeElements,$,null),!1)},dc=function($,N,ae){if(rn&&(N==="id"||N==="name")&&(ae in n||ae in Qp))return!1;if(!(Z&&!ye[N]&&_t(ee,N))){if(!(j&&_t(te,N))){if(!(_e.attributeCheck instanceof Function&&_e.attributeCheck(N,$))){if(!Y[N]||ye[N]){if(!(uc($)&&(G.tagNameCheck instanceof RegExp&&_t(G.tagNameCheck,$)||G.tagNameCheck instanceof Function&&G.tagNameCheck($))&&(G.attributeNameCheck instanceof RegExp&&_t(G.attributeNameCheck,N)||G.attributeNameCheck instanceof Function&&G.attributeNameCheck(N,$))||N==="is"&&G.allowCustomizedBuiltInElements&&(G.tagNameCheck instanceof RegExp&&_t(G.tagNameCheck,ae)||G.tagNameCheck instanceof Function&&G.tagNameCheck(ae))))return!1}else if(!he[N]){if(!_t(st,ei(ae,Pe,""))){if(!((N==="src"||N==="xlink:href"||N==="href")&&$!=="script"&&gy(ae,"data:")===0&&J[$])){if(!(R&&!_t(ue,ei(ae,Pe,"")))){if(ae)return!1}}}}}}}return!0},uc=function($){return $!=="annotation-xml"&&sa($,ze)},pc=function($){kn(V.beforeSanitizeAttributes,$,null);const{attributes:N}=$;if(!N||Xo($))return;const ae={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:Y,forceKeepAttr:void 0};let Oe=N.length;for(;Oe--;){const gt=N[Oe],{name:Xe,namespaceURI:Et,value:xn}=gt,ys=et(Xe),ea=xn;let ct=Xe==="value"?ea:fy(ea);if(ae.attrName=ys,ae.attrValue=ct,ae.keepAttr=!0,ae.forceKeepAttr=void 0,kn(V.uponSanitizeAttribute,$,ae),ct=ae.attrValue,$t&&(ys==="id"||ys==="name")&&(ns(Xe,$),ct=At+ct),ie&&_t(/((--!?|])>)|<\/(style|title|textarea)/i,ct)){ns(Xe,$);continue}if(ys==="attributename"&&sa(ct,"href")){ns(Xe,$);continue}if(ae.forceKeepAttr)continue;if(!ae.keepAttr){ns(Xe,$);continue}if(!D&&_t(/\/>/i,ct)){ns(Xe,$);continue}K&&Oi([I,H,W],gc=>{ct=ei(ct,gc," ")});const mc=et($.nodeName);if(!dc(mc,ys,ct)){ns(Xe,$);continue}if(b&&typeof g=="object"&&typeof g.getAttributeType=="function"&&!Et)switch(g.getAttributeType(mc,ys)){case"TrustedHTML":{ct=b.createHTML(ct);break}case"TrustedScriptURL":{ct=b.createScriptURL(ct);break}}if(ct!==ea)try{Et?$.setAttributeNS(Et,Xe,ct):$.setAttribute(Xe,ct),Xo($)?cn($):$c(t.removed)}catch{ns(Xe,$)}}kn(V.afterSanitizeAttributes,$,null)},Jp=function pe($){let N=null;const ae=rc($);for(kn(V.beforeSanitizeShadowDOM,$,null);N=ae.nextNode();)kn(V.uponSanitizeShadowNode,N,null),lc(N),pc(N),N.content instanceof a&&pe(N.content);kn(V.afterSanitizeShadowDOM,$,null)};return t.sanitize=function(pe){let $=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},N=null,ae=null,Oe=null,gt=null;if(Ws=!pe,Ws&&(pe="<!-->"),typeof pe!="string"&&!cc(pe))if(typeof pe.toString=="function"){if(pe=pe.toString(),typeof pe!="string")throw ti("dirty is not a string, aborting")}else throw ti("toString is not a function");if(!t.isSupported)return pe;if(Ce||Yo($),t.removed=[],typeof pe=="string"&&(O=!1),O){if(pe.nodeName){const xn=et(pe.nodeName);if(!we[xn]||ge[xn])throw ti("root node is forbidden and cannot be sanitized in-place")}}else if(pe instanceof r)N=ac("<!---->"),ae=N.ownerDocument.importNode(pe,!0),ae.nodeType===si.element&&ae.nodeName==="BODY"||ae.nodeName==="HTML"?N=ae:N.appendChild(ae);else{if(!it&&!K&&!xe&&pe.indexOf("<")===-1)return b&&Jt?b.createHTML(pe):pe;if(N=ac(pe),!N)return it?null:Jt?C:""}N&&$e&&cn(N.firstChild);const Xe=rc(O?pe:N);for(;Oe=Xe.nextNode();)lc(Oe),pc(Oe),Oe.content instanceof a&&Jp(Oe.content);if(O)return pe;if(it){if(xt)for(gt=M.call(N.ownerDocument);N.firstChild;)gt.appendChild(N.firstChild);else gt=N;return(Y.shadowroot||Y.shadowrootmode)&&(gt=q.call(s,gt,!0)),gt}let Et=xe?N.outerHTML:N.innerHTML;return xe&&we["!doctype"]&&N.ownerDocument&&N.ownerDocument.doctype&&N.ownerDocument.doctype.name&&_t(zd,N.ownerDocument.doctype.name)&&(Et="<!DOCTYPE "+N.ownerDocument.doctype.name+`>
`+Et),K&&Oi([I,H,W],xn=>{Et=ei(Et,xn," ")}),b&&Jt?b.createHTML(Et):Et},t.setConfig=function(){let pe=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};Yo(pe),Ce=!0},t.clearConfig=function(){bs=null,Ce=!1},t.isValidAttribute=function(pe,$,N){bs||Yo({});const ae=et(pe),Oe=et($);return dc(ae,Oe,N)},t.addHook=function(pe,$){typeof $=="function"&&Xs(V[pe],$)},t.removeHook=function(pe,$){if($!==void 0){const N=py(V[pe],$);return N===-1?void 0:my(V[pe],N,1)[0]}return $c(V[pe])},t.removeHooks=function(pe){V[pe]=[]},t.removeAllHooks=function(){V=Ac()},t}Id();function _(e,t,n){const s=document.createElement(e);return t&&Object.entries(t).forEach(([i,a])=>{i==="className"?s.className=a:i==="style"?typeof a=="object"?Object.assign(s.style,a):typeof a=="string"&&(s.style.cssText=a):i.startsWith("data")?s.setAttribute(i.replace(/([A-Z])/g,"-$1").toLowerCase(),String(a)):s[i]=a}),n&&n.forEach(i=>{typeof i=="string"?s.appendChild(document.createTextNode(i)):s.appendChild(i)}),s}function u(e,t,n,s){return e.addEventListener(t,n,s),()=>e.removeEventListener(t,n,s)}function cs(e,...t){e.classList.add(...t)}function ds(e,...t){e.classList.remove(...t)}function Sr(e){const t=_("button",{className:"btn btn-ghost theme-toggle",title:`Theme: ${Ke.getLabel()} (Ctrl+Shift+T)`});function n(){t.innerHTML=s(),t.title=`Theme: ${Ke.getLabel()} (Ctrl+Shift+T)`,t.setAttribute("data-theme-mode",Ke.getMode())}function s(){switch(Ke.getMode()){case"light":return`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>`;case"dark":return`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>`;case"system":return`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>`}}return u(t,"click",()=>{Ke.cycle(),n(),h.info(`Theme: ${Ke.getLabel()}`)}),Ke.onChange(()=>{n()}),n(),e&&e.appendChild(t),t}function Ey(e){const t=document.querySelector(e);return t?Sr(t):(console.warn(`ThemeToggle: Container not found: ${e}`),null)}const Hd={currentTab:"dashboard",currentDevTab:"info",sotCurrentView:"questions",selectedPerson:null,sidebarOpen:!0,modalOpen:null,searchQuery:"",filterActive:!1};let Be={...Hd};const Ra=new Set;function an(){Ra.forEach(e=>e(Be))}function My(){return Be}function qy(e){return Ra.add(e),()=>Ra.delete(e)}function jy(e){Be={...Be,currentTab:e},an()}function Dy(e){Be={...Be,currentDevTab:e},an()}function Py(e){Be={...Be,sotCurrentView:e},an()}function zy(e){Be={...Be,selectedPerson:e},an()}function Iy(){Be={...Be,sidebarOpen:!Be.sidebarOpen},an()}function Hy(e){Be={...Be,sidebarOpen:e},an()}function Ry(e){Be={...Be,modalOpen:e},an()}function By(){Be={...Be,modalOpen:null},an()}function Oy(e){Be={...Be,searchQuery:e},an()}function Ny(){Be={...Be,filterActive:!Be.filterActive},an()}function Uy(){Be={...Hd},an()}const He={getState:My,subscribe:qy,setTab:jy,setDevTab:Dy,setSotView:Py,setSelectedPerson:zy,toggleSidebar:Iy,setSidebarOpen:Hy,openModal:Ry,closeModal:By,setSearchQuery:Oy,toggleFilter:Ny,reset:Uy};function Rd(e={}){const t=_("header",{className:"app-header"}),n=_("div",{className:"header-logo"});n.innerHTML=`
    <span class="logo-icon">⚡</span>
    <h1>GodMode</h1>
  `;const s=_("div",{className:"header-actions"}),i=Fy(e.onProjectChange);s.appendChild(i);const a=Sr();s.appendChild(a);const o=Vy(e);s.appendChild(o);const r=_("button",{className:"mobile-menu-btn",innerHTML:"☰"});return u(r,"click",()=>{He.toggleSidebar()}),t.appendChild(r),t.appendChild(n),t.appendChild(s),t}function Fy(e){const t=_("div",{className:"project-selector"}),n=_("button",{className:"project-btn"}),s=_("div",{className:"project-dropdown"});function i(){const r=z.getState().currentProjectId||"Select Project";n.innerHTML=`
      <span class="project-name">${r}</span>
      <span class="dropdown-arrow">▼</span>
    `}let a=!1;return u(n,"click",o=>{o.stopPropagation(),a=!a,s.classList.toggle("show",a)}),u(document,"click",()=>{a=!1,s.classList.remove("show")}),z.subscribe(()=>{i()}),i(),t.appendChild(n),t.appendChild(s),t}function Vy(e){const t=_("div",{className:"user-menu"}),n=_("button",{className:"user-menu-btn"}),s=_("div",{className:"user-dropdown"});function i(){const l=z.getState().currentUser,d=l?.name?l.name.split(" ").map(m=>m[0]).join("").toUpperCase().slice(0,2):l?.email?.[0]?.toUpperCase()||"?";n.innerHTML=`
      <div class="user-avatar">${d}</div>
      <span class="user-name">${l?.name||l?.email||"Guest"}</span>
    `}function a(){const l=z.getState().currentUser;s.innerHTML=`
      <div class="user-dropdown-header">
        <strong>${l?.name||"Guest"}</strong>
        <span class="text-muted">${l?.email||""}</span>
        ${l?.role?`<span class="role-badge ${l.role}">${l.role}</span>`:""}
      </div>
      <div class="user-dropdown-items">
        <button data-action="settings">
          <span>⚙️</span> Settings
        </button>
        <button data-action="shortcuts">
          <span>⌨️</span> Shortcuts
        </button>
        <button data-action="logout" class="text-error">
          <span>🚪</span> Logout
        </button>
      </div>
    `;const d=s.querySelector('[data-action="settings"]'),m=s.querySelector('[data-action="shortcuts"]'),f=s.querySelector('[data-action="logout"]');d&&u(d,"click",()=>{e.onSettings?.(),r()}),m&&u(m,"click",()=>{He.openModal("shortcuts"),r()}),f&&u(f,"click",()=>{e.onLogout?.(),r()})}let o=!1;function r(){o=!1,s.classList.remove("show")}return u(n,"click",c=>{c.stopPropagation(),o=!o,s.classList.toggle("show",o),o&&a()}),u(document,"click",r),z.subscribe(i),i(),t.appendChild(n),t.appendChild(s),t}function Zy(e,t={}){const n=document.querySelector(e);if(!n)return console.warn(`Header: Container not found: ${e}`),null;const s=Rd(t);return n.appendChild(s),s}const Ec=[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"chat",label:"Chat",icon:"💬"},{id:"sot",label:"Source of Truth",icon:"📋"},{id:"timeline",label:"Timeline",icon:"📅"},{id:"org",label:"Org Chart",icon:"👥"},{id:"files",label:"Files",icon:"📁"},{id:"emails",label:"Emails",icon:"📧"},{id:"contacts",label:"Contacts",icon:"📇"},{id:"roles",label:"Roles",icon:"🔐"},{id:"graph",label:"Graph DB",icon:"🕸️"},{id:"costs",label:"Costs",icon:"💰"},{id:"history",label:"History",icon:"🕐"}],Gy={id:"admin",label:"Admin",icon:"⚙️"};function Wy(){return z.getState().currentUser?.role==="superadmin"?[...Ec,Gy]:Ec}function Qy(e,t){const n=_("button",{className:"sidebar-tab"});return n.setAttribute("data-tab",e.id),n.innerHTML=`
    <span class="tab-icon">${e.icon}</span>
    <span class="tab-label">${e.label}</span>
    ${e.badge?`<span class="tab-badge">${e.badge}</span>`:""}
  `,u(n,"click",()=>{He.setTab(e.id),t.onTabChange?.(e.id),window.innerWidth<768&&He.setSidebarOpen(!1)}),n}function Mc(e,t){const n=t.tabs||Wy(),s=He.getState().currentTab;e.innerHTML="",n.forEach(i=>{const a=Qy(i,t);i.id===s&&cs(a,"active"),e.appendChild(a)})}function Bd(e={}){const t=_("aside",{className:"sidebar"}),n=_("button",{className:"sidebar-close-btn",innerHTML:"✕"});u(n,"click",()=>{He.setSidebarOpen(!1)}),t.appendChild(n);const s=_("nav",{className:"sidebar-nav"});Mc(s,e),t.appendChild(s),z.subscribe(()=>{Mc(s,e)}),He.subscribe(o=>{s.querySelectorAll(".sidebar-tab").forEach(c=>{c.getAttribute("data-tab")===o.currentTab?cs(c,"active"):ds(c,"active")}),o.sidebarOpen?cs(t,"mobile-open"):ds(t,"mobile-open")});const i=He.getState(),a=s.querySelector(`[data-tab="${i.currentTab}"]`);return a&&cs(a,"active"),t}function Ky(e,t){const n=document.querySelector(`.sidebar-tab[data-tab="${e}"]`);if(!n)return;let s=n.querySelector(".tab-badge");if(t===null||t===0){s?.remove();return}s||(s=_("span",{className:"tab-badge"}),n.appendChild(s)),s.textContent=t>99?"99+":String(t)}function Jy(e,t={}){const n=document.querySelector(e);if(!n)return console.warn(`Sidebar: Container not found: ${e}`),null;const s=Bd(t);return n.appendChild(s),s}let ca=null;function Od(e={}){if(ca)return ca;const t=e.position||"bottom-right",n=_("div",{className:`toast-container toast-${t}`});return document.body.appendChild(n),ca=n,n}function Nd(e,t="info",n=3e3){const s=_("div",{className:`toast toast-${t} fade-in`}),i={success:"✓",error:"✕",warning:"⚠",info:"ℹ"};return s.innerHTML=`
    <span class="toast-icon">${i[t]}</span>
    <span class="toast-message">${e}</span>
  `,u(s,"click",()=>{qc(s)}),n>0&&setTimeout(()=>{qc(s)},n),s}function qc(e){e.classList.add("toast-dismiss"),setTimeout(()=>{e.remove()},300)}function Yy(e,t="info",n=3e3){const s=Od(),i=Nd(e,t,n);return s.appendChild(i),i}const Qt=new Map;function Me(e){const{id:t,title:n,content:s,size:i="md",closable:a=!0,onClose:o,onOpen:r,footer:c}=e,l=_("div",{className:`modal modal-${i}`});l.setAttribute("data-modal-id",t);const d=_("div",{className:"modal-content"}),m=_("div",{className:"modal-header"});if(m.innerHTML=`<h3>${n}</h3>`,a){const v=_("button",{className:"modal-close",innerHTML:"×"});u(v,"click",()=>U(t)),m.appendChild(v)}const f=_("div",{className:"modal-body"});typeof s=="string"?f.innerHTML=s:s&&f.appendChild(s);const g=c||_("div",{className:"modal-footer"});return d.appendChild(m),d.appendChild(f),c!==null&&d.appendChild(g),l.appendChild(d),a&&u(l,"click",v=>{v.target===l&&U(t)}),Qt.set(t,l),l}function qe(e){const t=Qt.get(e)||document.querySelector(`[data-modal-id="${e}"]`);if(!t){console.warn(`Modal not found: ${e}`);return}cs(t,"open"),document.body.classList.add("modal-open"),He.openModal(e),setTimeout(()=>{t.querySelector("input, textarea, select, button")?.focus()},100)}function U(e){const t=Qt.get(e)||document.querySelector(`[data-modal-id="${e}"]`);t&&(ds(t,"open"),document.body.classList.remove("modal-open"),He.closeModal())}function Ud(){Qt.forEach((e,t)=>U(t))}function Fd(e){return Qt.get(e)?.classList.contains("open")||!1}function Vd(e,t){const n=Qt.get(e);if(!n)return;const s=n.querySelector(".modal-body");s&&(typeof t=="string"?s.innerHTML=t:(s.innerHTML="",s.appendChild(t)))}function Zd(e,t){const n=Qt.get(e);if(!n)return;const s=n.querySelector(".modal-header h3");s&&(s.textContent=t)}function Zn(e,t={}){return new Promise(n=>{const{title:s="Confirm",confirmText:i="Confirm",cancelText:a="Cancel",confirmClass:o="btn-primary"}=t,r=`confirm-${Date.now()}`,c=_("div",{className:"modal-footer"}),l=_("button",{className:"btn btn-secondary",textContent:a}),d=_("button",{className:`btn ${o}`,textContent:i});u(l,"click",()=>{U(r),m.remove(),Qt.delete(r),n(!1)}),u(d,"click",()=>{U(r),m.remove(),Qt.delete(r),n(!0)}),c.appendChild(l),c.appendChild(d);const m=Me({id:r,title:s,content:`<p>${e}</p>`,size:"sm",closable:!0,onClose:()=>n(!1),footer:c});document.body.appendChild(m),qe(r)})}function Gd(e,t="Alert"){return new Promise(n=>{const s=`alert-${Date.now()}`,i=_("div",{className:"modal-footer"}),a=_("button",{className:"btn btn-primary",textContent:"OK"});u(a,"click",()=>{U(s),o.remove(),Qt.delete(s),n()}),i.appendChild(a);const o=Me({id:s,title:t,content:`<p>${e}</p>`,size:"sm",closable:!0,onClose:()=>n(),footer:i});document.body.appendChild(o),qe(s)})}function Xy(e,t={}){return new Promise(n=>{const s=`prompt-${Date.now()}`,{title:i="Input",placeholder:a="",defaultValue:o=""}=t,r=_("div",{className:"prompt-content"});r.innerHTML=`
      <p>${e}</p>
      <input type="text" class="prompt-input gm-w-full gm-p-2 gm-mt-2" placeholder="${a}" value="${o}">
    `;const c=_("div",{className:"modal-footer"}),l=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),d=_("button",{className:"btn btn-primary",textContent:"OK"});u(l,"click",()=>{U(s),m.remove(),Qt.delete(s),n(null)}),u(d,"click",()=>{const g=m.querySelector(".prompt-input")?.value||"";U(s),m.remove(),Qt.delete(s),n(g)}),c.appendChild(l),c.appendChild(d);const m=Me({id:s,title:i,content:r,size:"sm",closable:!0,onClose:()=>n(null),footer:c});document.body.appendChild(m),qe(s),setTimeout(()=>{m.querySelector(".prompt-input")?.focus()},100)})}Ut.register({key:"Escape",description:"Close modal",handler:()=>{const e=He.getState();e.modalOpen&&U(e.modalOpen)}});const vn=Object.freeze(Object.defineProperty({__proto__:null,alert:Gd,closeAllModals:Ud,closeModal:U,confirm:Zn,createModal:Me,isModalOpen:Fd,openModal:qe,prompt:Xy,updateModalContent:Vd,updateModalTitle:Zd},Symbol.toStringTag,{value:"Module"})),ii="member-permissions-modal",e0=[{id:"view",name:"View",icon:"👁️",color:"#3b82f6",permissions:[{id:"view:dashboard",name:"Dashboard",desc:"View project dashboard and stats"},{id:"view:chat",name:"AI Chat",desc:"Use the AI assistant"},{id:"view:sot",name:"Source of Truth",desc:"View decisions, risks, actions, questions"},{id:"view:contacts",name:"Contacts",desc:"View project contacts"},{id:"view:documents",name:"Documents",desc:"View uploaded documents"},{id:"view:emails",name:"Emails",desc:"View email history"},{id:"view:team",name:"Team",desc:"View team members"}]},{id:"comment",name:"Comment",icon:"💬",color:"#8b5cf6",permissions:[{id:"comment:sot",name:"Comment on Items",desc:"Add comments to decisions, risks, etc."},{id:"comment:documents",name:"Comment on Docs",desc:"Add comments to documents"}]},{id:"edit",name:"Edit",icon:"✏️",color:"#10b981",permissions:[{id:"edit:questions",name:"Questions",desc:"Create and edit questions"},{id:"edit:risks",name:"Risks",desc:"Create and edit risks"},{id:"edit:actions",name:"Actions",desc:"Create and edit actions"},{id:"edit:decisions",name:"Decisions",desc:"Create and edit decisions"},{id:"edit:contacts",name:"Contacts",desc:"Create and edit contacts"},{id:"edit:documents",name:"Documents",desc:"Upload and edit documents"}]},{id:"manage",name:"Manage",icon:"⚙️",color:"#f59e0b",permissions:[{id:"manage:team",name:"Team",desc:"Invite and remove team members"},{id:"manage:roles",name:"Roles",desc:"Create and assign roles"},{id:"manage:settings",name:"Settings",desc:"Change project settings"},{id:"manage:integrations",name:"Integrations",desc:"Configure integrations"}]},{id:"delete",name:"Delete",icon:"🗑️",color:"#ef4444",permissions:[{id:"delete:data",name:"Delete Data",desc:"Permanently delete items"},{id:"export:data",name:"Export Data",desc:"Export project data"}]}],jc={viewer:["view:dashboard","view:chat","view:sot","view:contacts","view:documents","view:emails","view:team"],editor:["view:dashboard","view:chat","view:sot","view:contacts","view:documents","view:emails","view:team","comment:sot","comment:documents","edit:questions","edit:risks","edit:actions","edit:decisions","edit:contacts","edit:documents"],admin:["view:dashboard","view:chat","view:sot","view:contacts","view:documents","view:emails","view:team","comment:sot","comment:documents","edit:questions","edit:risks","edit:actions","edit:decisions","edit:contacts","edit:documents","manage:team","manage:roles","manage:settings","manage:integrations","delete:data","export:data"],owner:["view:dashboard","view:chat","view:sot","view:contacts","view:documents","view:emails","view:team","comment:sot","comment:documents","edit:questions","edit:risks","edit:actions","edit:decisions","edit:contacts","edit:documents","manage:team","manage:roles","manage:settings","manage:integrations","delete:data","export:data"]};function Wd(e){const{projectId:t,userId:n,userName:s,userEmail:i,avatarUrl:a,currentRole:o,onSave:r}=e;let c=new Set(e.currentPermissions||jc[o]||[]);const l=document.querySelector(`[data-modal-id="${ii}"]`);l&&l.remove();const d=document.createElement("div");d.className="member-permissions-content",d.innerHTML=`
    <style>
      .member-permissions-content {
        padding: 0;
      }
      
      .member-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        background: linear-gradient(135deg, rgba(225,29,72,0.08) 0%, rgba(225,29,72,0.03) 100%);
        border-bottom: 1px solid var(--border-color);
      }
      
      .member-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 20px;
        overflow: hidden;
      }
      
      .member-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .member-info h4 {
        margin: 0 0 4px;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .member-info p {
        margin: 0;
        font-size: 13px;
        color: var(--text-secondary);
      }
      
      .role-selector {
        margin-left: auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      
      .role-selector label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .role-selector select {
        padding: 8px 32px 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        background: var(--bg-primary);
        color: var(--text-primary);
        cursor: pointer;
      }
      
      .permissions-body {
        padding: 24px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .permission-category {
        margin-bottom: 20px;
      }
      
      .permission-category:last-child {
        margin-bottom: 0;
      }
      
      .category-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
      }
      
      .category-icon {
        font-size: 16px;
      }
      
      .category-name {
        font-weight: 600;
        color: var(--text-primary);
        flex: 1;
      }
      
      .category-toggle {
        font-size: 11px;
        padding: 4px 10px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.15s;
      }
      
      .category-toggle:hover {
        background: var(--bg-secondary);
        border-color: #e11d48;
        color: #e11d48;
      }
      
      .permission-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
      }
      
      .permission-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        background: var(--bg-secondary);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
        border: 1px solid transparent;
      }
      
      .permission-item:hover {
        background: var(--bg-tertiary);
      }
      
      .permission-item.selected {
        background: linear-gradient(135deg, rgba(225,29,72,0.1) 0%, rgba(225,29,72,0.05) 100%);
        border-color: rgba(225,29,72,0.3);
      }
      
      .permission-item input {
        margin-top: 2px;
        accent-color: #e11d48;
        width: 16px;
        height: 16px;
      }
      
      .permission-info {
        flex: 1;
        min-width: 0;
      }
      
      .permission-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .permission-desc {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      
      .modal-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      
      .btn {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      
      .btn-secondary {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      
      .btn-secondary:hover {
        background: var(--bg-tertiary);
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
    </style>
    
    <div class="member-header">
      <div class="member-avatar">
        ${a?`<img src="${a}" alt="">`:n0(s||i)}
      </div>
      <div class="member-info">
        <h4>${Dc(s||i)}</h4>
        <p>${Dc(i)}</p>
      </div>
      <div class="role-selector">
        <label>Base Role</label>
        <select id="base-role">
          <option value="viewer" ${o==="viewer"?"selected":""}>Viewer</option>
          <option value="editor" ${o==="editor"?"selected":""}>Editor</option>
          <option value="admin" ${o==="admin"?"selected":""}>Admin</option>
          <option value="owner" ${o==="owner"?"selected":""}>Owner</option>
        </select>
      </div>
    </div>
    
    <div class="permissions-body">
      ${e0.map(f=>`
        <div class="permission-category" data-category="${f.id}">
          <div class="category-header">
            <span class="category-icon">${f.icon}</span>
            <span class="category-name">${f.name}</span>
            <button type="button" class="category-toggle" data-action="toggle">Toggle All</button>
          </div>
          <div class="permission-grid">
            ${f.permissions.map(g=>`
              <label class="permission-item${c.has(g.id)?" selected":""}">
                <input type="checkbox" name="permission" value="${g.id}" ${c.has(g.id)?"checked":""}>
                <div class="permission-info">
                  <div class="permission-name">${g.name}</div>
                  <div class="permission-desc">${g.desc}</div>
                </div>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" id="btn-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="btn-save">Save Permissions</button>
    </div>
  `,setTimeout(()=>{const f=d.querySelector("#base-role");f&&u(f,"change",()=>{const y=f.value,S=jc[y]||[];c=new Set(S),t0(d,c)}),d.querySelectorAll('input[name="permission"]').forEach(y=>{u(y,"change",()=>{const S=y.value;y.checked?c.add(S):c.delete(S),Ba(d)})}),d.querySelectorAll(".category-toggle").forEach(y=>{u(y,"click",()=>{const S=y.closest(".permission-category");if(!S)return;const w=S.querySelectorAll('input[name="permission"]'),k=Array.from(w).every(x=>x.checked);w.forEach(x=>{const b=x;b.checked=!k,k?c.delete(b.value):c.add(b.value)}),Ba(d)})});const g=d.querySelector("#btn-cancel");g&&u(g,"click",()=>U(ii));const v=d.querySelector("#btn-save");v&&u(v,"click",async()=>{const y=f?.value||o,S=Array.from(c);v.disabled=!0,v.textContent="Saving...";try{await p.put(`/api/projects/${t}/members/${n}/permissions`,{role:y,permissions:S}),h.success("Permissions updated"),U(ii),r?.()}catch{h.error("Failed to update permissions"),v.disabled=!1,v.textContent="Save Permissions"}})},0);const m=Me({id:ii,title:"Member Permissions",content:d,size:"lg"});document.body.appendChild(m),qe(ii)}function t0(e,t){e.querySelectorAll('input[name="permission"]').forEach(n=>{const s=n;s.checked=t.has(s.value)}),Ba(e)}function Ba(e){e.querySelectorAll(".permission-item").forEach(t=>{const n=t.querySelector('input[name="permission"]');t.classList.toggle("selected",n?.checked||!1)})}function n0(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function Dc(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function E(e,t,n){function s(r,c){if(r._zod||Object.defineProperty(r,"_zod",{value:{def:c,constr:o,traits:new Set},enumerable:!1}),r._zod.traits.has(e))return;r._zod.traits.add(e),t(r,c);const l=o.prototype,d=Object.keys(l);for(let m=0;m<d.length;m++){const f=d[m];f in r||(r[f]=l[f].bind(r))}}const i=n?.Parent??Object;class a extends i{}Object.defineProperty(a,"name",{value:e});function o(r){var c;const l=n?.Parent?new a:this;s(l,r),(c=l._zod).deferred??(c.deferred=[]);for(const d of l._zod.deferred)d();return l}return Object.defineProperty(o,"init",{value:s}),Object.defineProperty(o,Symbol.hasInstance,{value:r=>n?.Parent&&r instanceof n.Parent?!0:r?._zod?.traits?.has(e)}),Object.defineProperty(o,"name",{value:e}),o}class Ts extends Error{constructor(){super("Encountered Promise during synchronous parse. Use .parseAsync() instead.")}}class Qd extends Error{constructor(t){super(`Encountered unidirectional transform during encode: ${t}`),this.name="ZodEncodeError"}}const Kd={};function us(e){return Kd}function Jd(e){const t=Object.values(e).filter(s=>typeof s=="number");return Object.entries(e).filter(([s,i])=>t.indexOf(+s)===-1).map(([s,i])=>i)}function Oa(e,t){return typeof t=="bigint"?t.toString():t}function _r(e){return{get value(){{const t=e();return Object.defineProperty(this,"value",{value:t}),t}}}}function Cr(e){return e==null}function Lr(e){const t=e.startsWith("^")?1:0,n=e.endsWith("$")?e.length-1:e.length;return e.slice(t,n)}const Pc=Symbol("evaluating");function je(e,t,n){let s;Object.defineProperty(e,t,{get(){if(s!==Pc)return s===void 0&&(s=Pc,s=n()),s},set(i){Object.defineProperty(e,t,{value:i})},configurable:!0})}function fs(e,t,n){Object.defineProperty(e,t,{value:n,writable:!0,enumerable:!0,configurable:!0})}function Qn(...e){const t={};for(const n of e){const s=Object.getOwnPropertyDescriptors(n);Object.assign(t,s)}return Object.defineProperties({},t)}function zc(e){return JSON.stringify(e)}function s0(e){return e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}const Yd="captureStackTrace"in Error?Error.captureStackTrace:(...e)=>{};function po(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}const i0=_r(()=>{if(typeof navigator<"u"&&navigator?.userAgent?.includes("Cloudflare"))return!1;try{const e=Function;return new e(""),!0}catch{return!1}});function ji(e){if(po(e)===!1)return!1;const t=e.constructor;if(t===void 0||typeof t!="function")return!0;const n=t.prototype;return!(po(n)===!1||Object.prototype.hasOwnProperty.call(n,"isPrototypeOf")===!1)}function Xd(e){return ji(e)?{...e}:Array.isArray(e)?[...e]:e}const o0=new Set(["string","number","symbol"]);function Po(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function Kn(e,t,n){const s=new e._zod.constr(t??e._zod.def);return(!t||n?.parent)&&(s._zod.parent=e),s}function be(e){const t=e;if(!t)return{};if(typeof t=="string")return{error:()=>t};if(t?.message!==void 0){if(t?.error!==void 0)throw new Error("Cannot specify both `message` and `error` params");t.error=t.message}return delete t.message,typeof t.error=="string"?{...t,error:()=>t.error}:t}function a0(e){return Object.keys(e).filter(t=>e[t]._zod.optin==="optional"&&e[t]._zod.optout==="optional")}function r0(e,t){const n=e._zod.def,s=n.checks;if(s&&s.length>0)throw new Error(".pick() cannot be used on object schemas containing refinements");const a=Qn(e._zod.def,{get shape(){const o={};for(const r in t){if(!(r in n.shape))throw new Error(`Unrecognized key: "${r}"`);t[r]&&(o[r]=n.shape[r])}return fs(this,"shape",o),o},checks:[]});return Kn(e,a)}function c0(e,t){const n=e._zod.def,s=n.checks;if(s&&s.length>0)throw new Error(".omit() cannot be used on object schemas containing refinements");const a=Qn(e._zod.def,{get shape(){const o={...e._zod.def.shape};for(const r in t){if(!(r in n.shape))throw new Error(`Unrecognized key: "${r}"`);t[r]&&delete o[r]}return fs(this,"shape",o),o},checks:[]});return Kn(e,a)}function l0(e,t){if(!ji(t))throw new Error("Invalid input to extend: expected a plain object");const n=e._zod.def.checks;if(n&&n.length>0){const a=e._zod.def.shape;for(const o in t)if(Object.getOwnPropertyDescriptor(a,o)!==void 0)throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.")}const i=Qn(e._zod.def,{get shape(){const a={...e._zod.def.shape,...t};return fs(this,"shape",a),a}});return Kn(e,i)}function d0(e,t){if(!ji(t))throw new Error("Invalid input to safeExtend: expected a plain object");const n=Qn(e._zod.def,{get shape(){const s={...e._zod.def.shape,...t};return fs(this,"shape",s),s}});return Kn(e,n)}function u0(e,t){const n=Qn(e._zod.def,{get shape(){const s={...e._zod.def.shape,...t._zod.def.shape};return fs(this,"shape",s),s},get catchall(){return t._zod.def.catchall},checks:[]});return Kn(e,n)}function p0(e,t,n){const i=t._zod.def.checks;if(i&&i.length>0)throw new Error(".partial() cannot be used on object schemas containing refinements");const o=Qn(t._zod.def,{get shape(){const r=t._zod.def.shape,c={...r};if(n)for(const l in n){if(!(l in r))throw new Error(`Unrecognized key: "${l}"`);n[l]&&(c[l]=e?new e({type:"optional",innerType:r[l]}):r[l])}else for(const l in r)c[l]=e?new e({type:"optional",innerType:r[l]}):r[l];return fs(this,"shape",c),c},checks:[]});return Kn(t,o)}function m0(e,t,n){const s=Qn(t._zod.def,{get shape(){const i=t._zod.def.shape,a={...i};if(n)for(const o in n){if(!(o in a))throw new Error(`Unrecognized key: "${o}"`);n[o]&&(a[o]=new e({type:"nonoptional",innerType:i[o]}))}else for(const o in i)a[o]=new e({type:"nonoptional",innerType:i[o]});return fs(this,"shape",a),a}});return Kn(t,s)}function $s(e,t=0){if(e.aborted===!0)return!0;for(let n=t;n<e.issues.length;n++)if(e.issues[n]?.continue!==!0)return!0;return!1}function eu(e,t){return t.map(n=>{var s;return(s=n).path??(s.path=[]),n.path.unshift(e),n})}function Ui(e){return typeof e=="string"?e:e?.message}function ps(e,t,n){const s={...e,path:e.path??[]};if(!e.message){const i=Ui(e.inst?._zod.def?.error?.(e))??Ui(t?.error?.(e))??Ui(n.customError?.(e))??Ui(n.localeError?.(e))??"Invalid input";s.message=i}return delete s.inst,delete s.continue,t?.reportInput||delete s.input,s}function Tr(e){return Array.isArray(e)?"array":typeof e=="string"?"string":"unknown"}function Di(...e){const[t,n,s]=e;return typeof t=="string"?{message:t,code:"custom",input:n,inst:s}:{...t}}const tu=(e,t)=>{e.name="$ZodError",Object.defineProperty(e,"_zod",{value:e._zod,enumerable:!1}),Object.defineProperty(e,"issues",{value:t,enumerable:!1}),e.message=JSON.stringify(t,Oa,2),Object.defineProperty(e,"toString",{value:()=>e.message,enumerable:!1})},nu=E("$ZodError",tu),su=E("$ZodError",tu,{Parent:Error});function g0(e,t=n=>n.message){const n={},s=[];for(const i of e.issues)i.path.length>0?(n[i.path[0]]=n[i.path[0]]||[],n[i.path[0]].push(t(i))):s.push(t(i));return{formErrors:s,fieldErrors:n}}function f0(e,t=n=>n.message){const n={_errors:[]},s=i=>{for(const a of i.issues)if(a.code==="invalid_union"&&a.errors.length)a.errors.map(o=>s({issues:o}));else if(a.code==="invalid_key")s({issues:a.issues});else if(a.code==="invalid_element")s({issues:a.issues});else if(a.path.length===0)n._errors.push(t(a));else{let o=n,r=0;for(;r<a.path.length;){const c=a.path[r];r===a.path.length-1?(o[c]=o[c]||{_errors:[]},o[c]._errors.push(t(a))):o[c]=o[c]||{_errors:[]},o=o[c],r++}}};return s(e),n}const Ar=e=>(t,n,s,i)=>{const a=s?Object.assign(s,{async:!1}):{async:!1},o=t._zod.run({value:n,issues:[]},a);if(o instanceof Promise)throw new Ts;if(o.issues.length){const r=new(i?.Err??e)(o.issues.map(c=>ps(c,a,us())));throw Yd(r,i?.callee),r}return o.value},Er=e=>async(t,n,s,i)=>{const a=s?Object.assign(s,{async:!0}):{async:!0};let o=t._zod.run({value:n,issues:[]},a);if(o instanceof Promise&&(o=await o),o.issues.length){const r=new(i?.Err??e)(o.issues.map(c=>ps(c,a,us())));throw Yd(r,i?.callee),r}return o.value},zo=e=>(t,n,s)=>{const i=s?{...s,async:!1}:{async:!1},a=t._zod.run({value:n,issues:[]},i);if(a instanceof Promise)throw new Ts;return a.issues.length?{success:!1,error:new(e??nu)(a.issues.map(o=>ps(o,i,us())))}:{success:!0,data:a.value}},h0=zo(su),Io=e=>async(t,n,s)=>{const i=s?Object.assign(s,{async:!0}):{async:!0};let a=t._zod.run({value:n,issues:[]},i);return a instanceof Promise&&(a=await a),a.issues.length?{success:!1,error:new e(a.issues.map(o=>ps(o,i,us())))}:{success:!0,data:a.value}},v0=Io(su),b0=e=>(t,n,s)=>{const i=s?Object.assign(s,{direction:"backward"}):{direction:"backward"};return Ar(e)(t,n,i)},y0=e=>(t,n,s)=>Ar(e)(t,n,s),w0=e=>async(t,n,s)=>{const i=s?Object.assign(s,{direction:"backward"}):{direction:"backward"};return Er(e)(t,n,i)},k0=e=>async(t,n,s)=>Er(e)(t,n,s),x0=e=>(t,n,s)=>{const i=s?Object.assign(s,{direction:"backward"}):{direction:"backward"};return zo(e)(t,n,i)},$0=e=>(t,n,s)=>zo(e)(t,n,s),S0=e=>async(t,n,s)=>{const i=s?Object.assign(s,{direction:"backward"}):{direction:"backward"};return Io(e)(t,n,i)},_0=e=>async(t,n,s)=>Io(e)(t,n,s),C0=/^[cC][^\s-]{8,}$/,L0=/^[0-9a-z]+$/,T0=/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/,A0=/^[0-9a-vA-V]{20}$/,E0=/^[A-Za-z0-9]{27}$/,M0=/^[a-zA-Z0-9_-]{21}$/,q0=/^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/,j0=/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,Ic=e=>e?new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`):/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/,D0=/^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/,P0="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";function z0(){return new RegExp(P0,"u")}const I0=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,H0=/^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/,R0=/^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/,B0=/^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,O0=/^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/,iu=/^[A-Za-z0-9_-]*$/,N0=/^\+[1-9]\d{6,14}$/,ou="(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))",U0=new RegExp(`^${ou}$`);function au(e){const t="(?:[01]\\d|2[0-3]):[0-5]\\d";return typeof e.precision=="number"?e.precision===-1?`${t}`:e.precision===0?`${t}:[0-5]\\d`:`${t}:[0-5]\\d\\.\\d{${e.precision}}`:`${t}(?::[0-5]\\d(?:\\.\\d+)?)?`}function F0(e){return new RegExp(`^${au(e)}$`)}function V0(e){const t=au({precision:e.precision}),n=["Z"];e.local&&n.push(""),e.offset&&n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");const s=`${t}(?:${n.join("|")})`;return new RegExp(`^${ou}T(?:${s})$`)}const Z0=e=>{const t=e?`[\\s\\S]{${e?.minimum??0},${e?.maximum??""}}`:"[\\s\\S]*";return new RegExp(`^${t}$`)},G0=/^[^A-Z]*$/,W0=/^[^a-z]*$/,bn=E("$ZodCheck",(e,t)=>{var n;e._zod??(e._zod={}),e._zod.def=t,(n=e._zod).onattach??(n.onattach=[])}),Q0=E("$ZodCheckMaxLength",(e,t)=>{var n;bn.init(e,t),(n=e._zod.def).when??(n.when=s=>{const i=s.value;return!Cr(i)&&i.length!==void 0}),e._zod.onattach.push(s=>{const i=s._zod.bag.maximum??Number.POSITIVE_INFINITY;t.maximum<i&&(s._zod.bag.maximum=t.maximum)}),e._zod.check=s=>{const i=s.value;if(i.length<=t.maximum)return;const o=Tr(i);s.issues.push({origin:o,code:"too_big",maximum:t.maximum,inclusive:!0,input:i,inst:e,continue:!t.abort})}}),K0=E("$ZodCheckMinLength",(e,t)=>{var n;bn.init(e,t),(n=e._zod.def).when??(n.when=s=>{const i=s.value;return!Cr(i)&&i.length!==void 0}),e._zod.onattach.push(s=>{const i=s._zod.bag.minimum??Number.NEGATIVE_INFINITY;t.minimum>i&&(s._zod.bag.minimum=t.minimum)}),e._zod.check=s=>{const i=s.value;if(i.length>=t.minimum)return;const o=Tr(i);s.issues.push({origin:o,code:"too_small",minimum:t.minimum,inclusive:!0,input:i,inst:e,continue:!t.abort})}}),J0=E("$ZodCheckLengthEquals",(e,t)=>{var n;bn.init(e,t),(n=e._zod.def).when??(n.when=s=>{const i=s.value;return!Cr(i)&&i.length!==void 0}),e._zod.onattach.push(s=>{const i=s._zod.bag;i.minimum=t.length,i.maximum=t.length,i.length=t.length}),e._zod.check=s=>{const i=s.value,a=i.length;if(a===t.length)return;const o=Tr(i),r=a>t.length;s.issues.push({origin:o,...r?{code:"too_big",maximum:t.length}:{code:"too_small",minimum:t.length},inclusive:!0,exact:!0,input:s.value,inst:e,continue:!t.abort})}}),Ho=E("$ZodCheckStringFormat",(e,t)=>{var n,s;bn.init(e,t),e._zod.onattach.push(i=>{const a=i._zod.bag;a.format=t.format,t.pattern&&(a.patterns??(a.patterns=new Set),a.patterns.add(t.pattern))}),t.pattern?(n=e._zod).check??(n.check=i=>{t.pattern.lastIndex=0,!t.pattern.test(i.value)&&i.issues.push({origin:"string",code:"invalid_format",format:t.format,input:i.value,...t.pattern?{pattern:t.pattern.toString()}:{},inst:e,continue:!t.abort})}):(s=e._zod).check??(s.check=()=>{})}),Y0=E("$ZodCheckRegex",(e,t)=>{Ho.init(e,t),e._zod.check=n=>{t.pattern.lastIndex=0,!t.pattern.test(n.value)&&n.issues.push({origin:"string",code:"invalid_format",format:"regex",input:n.value,pattern:t.pattern.toString(),inst:e,continue:!t.abort})}}),X0=E("$ZodCheckLowerCase",(e,t)=>{t.pattern??(t.pattern=G0),Ho.init(e,t)}),ew=E("$ZodCheckUpperCase",(e,t)=>{t.pattern??(t.pattern=W0),Ho.init(e,t)}),tw=E("$ZodCheckIncludes",(e,t)=>{bn.init(e,t);const n=Po(t.includes),s=new RegExp(typeof t.position=="number"?`^.{${t.position}}${n}`:n);t.pattern=s,e._zod.onattach.push(i=>{const a=i._zod.bag;a.patterns??(a.patterns=new Set),a.patterns.add(s)}),e._zod.check=i=>{i.value.includes(t.includes,t.position)||i.issues.push({origin:"string",code:"invalid_format",format:"includes",includes:t.includes,input:i.value,inst:e,continue:!t.abort})}}),nw=E("$ZodCheckStartsWith",(e,t)=>{bn.init(e,t);const n=new RegExp(`^${Po(t.prefix)}.*`);t.pattern??(t.pattern=n),e._zod.onattach.push(s=>{const i=s._zod.bag;i.patterns??(i.patterns=new Set),i.patterns.add(n)}),e._zod.check=s=>{s.value.startsWith(t.prefix)||s.issues.push({origin:"string",code:"invalid_format",format:"starts_with",prefix:t.prefix,input:s.value,inst:e,continue:!t.abort})}}),sw=E("$ZodCheckEndsWith",(e,t)=>{bn.init(e,t);const n=new RegExp(`.*${Po(t.suffix)}$`);t.pattern??(t.pattern=n),e._zod.onattach.push(s=>{const i=s._zod.bag;i.patterns??(i.patterns=new Set),i.patterns.add(n)}),e._zod.check=s=>{s.value.endsWith(t.suffix)||s.issues.push({origin:"string",code:"invalid_format",format:"ends_with",suffix:t.suffix,input:s.value,inst:e,continue:!t.abort})}}),iw=E("$ZodCheckOverwrite",(e,t)=>{bn.init(e,t),e._zod.check=n=>{n.value=t.tx(n.value)}});class ow{constructor(t=[]){this.content=[],this.indent=0,this&&(this.args=t)}indented(t){this.indent+=1,t(this),this.indent-=1}write(t){if(typeof t=="function"){t(this,{execution:"sync"}),t(this,{execution:"async"});return}const s=t.split(`
`).filter(o=>o),i=Math.min(...s.map(o=>o.length-o.trimStart().length)),a=s.map(o=>o.slice(i)).map(o=>" ".repeat(this.indent*2)+o);for(const o of a)this.content.push(o)}compile(){const t=Function,n=this?.args,i=[...(this?.content??[""]).map(a=>`  ${a}`)];return new t(...n,i.join(`
`))}}const aw={major:4,minor:3,patch:6},tt=E("$ZodType",(e,t)=>{var n;e??(e={}),e._zod.def=t,e._zod.bag=e._zod.bag||{},e._zod.version=aw;const s=[...e._zod.def.checks??[]];e._zod.traits.has("$ZodCheck")&&s.unshift(e);for(const i of s)for(const a of i._zod.onattach)a(e);if(s.length===0)(n=e._zod).deferred??(n.deferred=[]),e._zod.deferred?.push(()=>{e._zod.run=e._zod.parse});else{const i=(o,r,c)=>{let l=$s(o),d;for(const m of r){if(m._zod.def.when){if(!m._zod.def.when(o))continue}else if(l)continue;const f=o.issues.length,g=m._zod.check(o);if(g instanceof Promise&&c?.async===!1)throw new Ts;if(d||g instanceof Promise)d=(d??Promise.resolve()).then(async()=>{await g,o.issues.length!==f&&(l||(l=$s(o,f)))});else{if(o.issues.length===f)continue;l||(l=$s(o,f))}}return d?d.then(()=>o):o},a=(o,r,c)=>{if($s(o))return o.aborted=!0,o;const l=i(r,s,c);if(l instanceof Promise){if(c.async===!1)throw new Ts;return l.then(d=>e._zod.parse(d,c))}return e._zod.parse(l,c)};e._zod.run=(o,r)=>{if(r.skipChecks)return e._zod.parse(o,r);if(r.direction==="backward"){const l=e._zod.parse({value:o.value,issues:[]},{...r,skipChecks:!0});return l instanceof Promise?l.then(d=>a(d,o,r)):a(l,o,r)}const c=e._zod.parse(o,r);if(c instanceof Promise){if(r.async===!1)throw new Ts;return c.then(l=>i(l,s,r))}return i(c,s,r)}}je(e,"~standard",()=>({validate:i=>{try{const a=h0(e,i);return a.success?{value:a.data}:{issues:a.error?.issues}}catch{return v0(e,i).then(o=>o.success?{value:o.data}:{issues:o.error?.issues})}},vendor:"zod",version:1}))}),Mr=E("$ZodString",(e,t)=>{tt.init(e,t),e._zod.pattern=[...e?._zod.bag?.patterns??[]].pop()??Z0(e._zod.bag),e._zod.parse=(n,s)=>{if(t.coerce)try{n.value=String(n.value)}catch{}return typeof n.value=="string"||n.issues.push({expected:"string",code:"invalid_type",input:n.value,inst:e}),n}}),Ue=E("$ZodStringFormat",(e,t)=>{Ho.init(e,t),Mr.init(e,t)}),rw=E("$ZodGUID",(e,t)=>{t.pattern??(t.pattern=j0),Ue.init(e,t)}),cw=E("$ZodUUID",(e,t)=>{if(t.version){const s={v1:1,v2:2,v3:3,v4:4,v5:5,v6:6,v7:7,v8:8}[t.version];if(s===void 0)throw new Error(`Invalid UUID version: "${t.version}"`);t.pattern??(t.pattern=Ic(s))}else t.pattern??(t.pattern=Ic());Ue.init(e,t)}),lw=E("$ZodEmail",(e,t)=>{t.pattern??(t.pattern=D0),Ue.init(e,t)}),dw=E("$ZodURL",(e,t)=>{Ue.init(e,t),e._zod.check=n=>{try{const s=n.value.trim(),i=new URL(s);t.hostname&&(t.hostname.lastIndex=0,t.hostname.test(i.hostname)||n.issues.push({code:"invalid_format",format:"url",note:"Invalid hostname",pattern:t.hostname.source,input:n.value,inst:e,continue:!t.abort})),t.protocol&&(t.protocol.lastIndex=0,t.protocol.test(i.protocol.endsWith(":")?i.protocol.slice(0,-1):i.protocol)||n.issues.push({code:"invalid_format",format:"url",note:"Invalid protocol",pattern:t.protocol.source,input:n.value,inst:e,continue:!t.abort})),t.normalize?n.value=i.href:n.value=s;return}catch{n.issues.push({code:"invalid_format",format:"url",input:n.value,inst:e,continue:!t.abort})}}}),uw=E("$ZodEmoji",(e,t)=>{t.pattern??(t.pattern=z0()),Ue.init(e,t)}),pw=E("$ZodNanoID",(e,t)=>{t.pattern??(t.pattern=M0),Ue.init(e,t)}),mw=E("$ZodCUID",(e,t)=>{t.pattern??(t.pattern=C0),Ue.init(e,t)}),gw=E("$ZodCUID2",(e,t)=>{t.pattern??(t.pattern=L0),Ue.init(e,t)}),fw=E("$ZodULID",(e,t)=>{t.pattern??(t.pattern=T0),Ue.init(e,t)}),hw=E("$ZodXID",(e,t)=>{t.pattern??(t.pattern=A0),Ue.init(e,t)}),vw=E("$ZodKSUID",(e,t)=>{t.pattern??(t.pattern=E0),Ue.init(e,t)}),bw=E("$ZodISODateTime",(e,t)=>{t.pattern??(t.pattern=V0(t)),Ue.init(e,t)}),yw=E("$ZodISODate",(e,t)=>{t.pattern??(t.pattern=U0),Ue.init(e,t)}),ww=E("$ZodISOTime",(e,t)=>{t.pattern??(t.pattern=F0(t)),Ue.init(e,t)}),kw=E("$ZodISODuration",(e,t)=>{t.pattern??(t.pattern=q0),Ue.init(e,t)}),xw=E("$ZodIPv4",(e,t)=>{t.pattern??(t.pattern=I0),Ue.init(e,t),e._zod.bag.format="ipv4"}),$w=E("$ZodIPv6",(e,t)=>{t.pattern??(t.pattern=H0),Ue.init(e,t),e._zod.bag.format="ipv6",e._zod.check=n=>{try{new URL(`http://[${n.value}]`)}catch{n.issues.push({code:"invalid_format",format:"ipv6",input:n.value,inst:e,continue:!t.abort})}}}),Sw=E("$ZodCIDRv4",(e,t)=>{t.pattern??(t.pattern=R0),Ue.init(e,t)}),_w=E("$ZodCIDRv6",(e,t)=>{t.pattern??(t.pattern=B0),Ue.init(e,t),e._zod.check=n=>{const s=n.value.split("/");try{if(s.length!==2)throw new Error;const[i,a]=s;if(!a)throw new Error;const o=Number(a);if(`${o}`!==a)throw new Error;if(o<0||o>128)throw new Error;new URL(`http://[${i}]`)}catch{n.issues.push({code:"invalid_format",format:"cidrv6",input:n.value,inst:e,continue:!t.abort})}}});function ru(e){if(e==="")return!0;if(e.length%4!==0)return!1;try{return atob(e),!0}catch{return!1}}const Cw=E("$ZodBase64",(e,t)=>{t.pattern??(t.pattern=O0),Ue.init(e,t),e._zod.bag.contentEncoding="base64",e._zod.check=n=>{ru(n.value)||n.issues.push({code:"invalid_format",format:"base64",input:n.value,inst:e,continue:!t.abort})}});function Lw(e){if(!iu.test(e))return!1;const t=e.replace(/[-_]/g,s=>s==="-"?"+":"/"),n=t.padEnd(Math.ceil(t.length/4)*4,"=");return ru(n)}const Tw=E("$ZodBase64URL",(e,t)=>{t.pattern??(t.pattern=iu),Ue.init(e,t),e._zod.bag.contentEncoding="base64url",e._zod.check=n=>{Lw(n.value)||n.issues.push({code:"invalid_format",format:"base64url",input:n.value,inst:e,continue:!t.abort})}}),Aw=E("$ZodE164",(e,t)=>{t.pattern??(t.pattern=N0),Ue.init(e,t)});function Ew(e,t=null){try{const n=e.split(".");if(n.length!==3)return!1;const[s]=n;if(!s)return!1;const i=JSON.parse(atob(s));return!("typ"in i&&i?.typ!=="JWT"||!i.alg||t&&(!("alg"in i)||i.alg!==t))}catch{return!1}}const Mw=E("$ZodJWT",(e,t)=>{Ue.init(e,t),e._zod.check=n=>{Ew(n.value,t.alg)||n.issues.push({code:"invalid_format",format:"jwt",input:n.value,inst:e,continue:!t.abort})}}),qw=E("$ZodUnknown",(e,t)=>{tt.init(e,t),e._zod.parse=n=>n}),jw=E("$ZodNever",(e,t)=>{tt.init(e,t),e._zod.parse=(n,s)=>(n.issues.push({expected:"never",code:"invalid_type",input:n.value,inst:e}),n)});function Hc(e,t,n){e.issues.length&&t.issues.push(...eu(n,e.issues)),t.value[n]=e.value}const Dw=E("$ZodArray",(e,t)=>{tt.init(e,t),e._zod.parse=(n,s)=>{const i=n.value;if(!Array.isArray(i))return n.issues.push({expected:"array",code:"invalid_type",input:i,inst:e}),n;n.value=Array(i.length);const a=[];for(let o=0;o<i.length;o++){const r=i[o],c=t.element._zod.run({value:r,issues:[]},s);c instanceof Promise?a.push(c.then(l=>Hc(l,n,o))):Hc(c,n,o)}return a.length?Promise.all(a).then(()=>n):n}});function mo(e,t,n,s,i){if(e.issues.length){if(i&&!(n in s))return;t.issues.push(...eu(n,e.issues))}e.value===void 0?n in s&&(t.value[n]=void 0):t.value[n]=e.value}function cu(e){const t=Object.keys(e.shape);for(const s of t)if(!e.shape?.[s]?._zod?.traits?.has("$ZodType"))throw new Error(`Invalid element at key "${s}": expected a Zod schema`);const n=a0(e.shape);return{...e,keys:t,keySet:new Set(t),numKeys:t.length,optionalKeys:new Set(n)}}function lu(e,t,n,s,i,a){const o=[],r=i.keySet,c=i.catchall._zod,l=c.def.type,d=c.optout==="optional";for(const m in t){if(r.has(m))continue;if(l==="never"){o.push(m);continue}const f=c.run({value:t[m],issues:[]},s);f instanceof Promise?e.push(f.then(g=>mo(g,n,m,t,d))):mo(f,n,m,t,d)}return o.length&&n.issues.push({code:"unrecognized_keys",keys:o,input:t,inst:a}),e.length?Promise.all(e).then(()=>n):n}const Pw=E("$ZodObject",(e,t)=>{if(tt.init(e,t),!Object.getOwnPropertyDescriptor(t,"shape")?.get){const r=t.shape;Object.defineProperty(t,"shape",{get:()=>{const c={...r};return Object.defineProperty(t,"shape",{value:c}),c}})}const s=_r(()=>cu(t));je(e._zod,"propValues",()=>{const r=t.shape,c={};for(const l in r){const d=r[l]._zod;if(d.values){c[l]??(c[l]=new Set);for(const m of d.values)c[l].add(m)}}return c});const i=po,a=t.catchall;let o;e._zod.parse=(r,c)=>{o??(o=s.value);const l=r.value;if(!i(l))return r.issues.push({expected:"object",code:"invalid_type",input:l,inst:e}),r;r.value={};const d=[],m=o.shape;for(const f of o.keys){const g=m[f],v=g._zod.optout==="optional",y=g._zod.run({value:l[f],issues:[]},c);y instanceof Promise?d.push(y.then(S=>mo(S,r,f,l,v))):mo(y,r,f,l,v)}return a?lu(d,l,r,c,s.value,e):d.length?Promise.all(d).then(()=>r):r}}),zw=E("$ZodObjectJIT",(e,t)=>{Pw.init(e,t);const n=e._zod.parse,s=_r(()=>cu(t)),i=f=>{const g=new ow(["shape","payload","ctx"]),v=s.value,y=x=>{const b=zc(x);return`shape[${b}]._zod.run({ value: input[${b}], issues: [] }, ctx)`};g.write("const input = payload.value;");const S=Object.create(null);let w=0;for(const x of v.keys)S[x]=`key_${w++}`;g.write("const newResult = {};");for(const x of v.keys){const b=S[x],C=zc(x),A=f[x]?._zod?.optout==="optional";g.write(`const ${b} = ${y(x)};`),A?g.write(`
        if (${b}.issues.length) {
          if (${C} in input) {
            payload.issues = payload.issues.concat(${b}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${C}, ...iss.path] : [${C}]
            })));
          }
        }
        
        if (${b}.value === undefined) {
          if (${C} in input) {
            newResult[${C}] = undefined;
          }
        } else {
          newResult[${C}] = ${b}.value;
        }
        
      `):g.write(`
        if (${b}.issues.length) {
          payload.issues = payload.issues.concat(${b}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${C}, ...iss.path] : [${C}]
          })));
        }
        
        if (${b}.value === undefined) {
          if (${C} in input) {
            newResult[${C}] = undefined;
          }
        } else {
          newResult[${C}] = ${b}.value;
        }
        
      `)}g.write("payload.value = newResult;"),g.write("return payload;");const k=g.compile();return(x,b)=>k(f,x,b)};let a;const o=po,r=!Kd.jitless,l=r&&i0.value,d=t.catchall;let m;e._zod.parse=(f,g)=>{m??(m=s.value);const v=f.value;return o(v)?r&&l&&g?.async===!1&&g.jitless!==!0?(a||(a=i(t.shape)),f=a(f,g),d?lu([],v,f,g,m,e):f):n(f,g):(f.issues.push({expected:"object",code:"invalid_type",input:v,inst:e}),f)}});function Rc(e,t,n,s){for(const a of e)if(a.issues.length===0)return t.value=a.value,t;const i=e.filter(a=>!$s(a));return i.length===1?(t.value=i[0].value,i[0]):(t.issues.push({code:"invalid_union",input:t.value,inst:n,errors:e.map(a=>a.issues.map(o=>ps(o,s,us())))}),t)}const Iw=E("$ZodUnion",(e,t)=>{tt.init(e,t),je(e._zod,"optin",()=>t.options.some(i=>i._zod.optin==="optional")?"optional":void 0),je(e._zod,"optout",()=>t.options.some(i=>i._zod.optout==="optional")?"optional":void 0),je(e._zod,"values",()=>{if(t.options.every(i=>i._zod.values))return new Set(t.options.flatMap(i=>Array.from(i._zod.values)))}),je(e._zod,"pattern",()=>{if(t.options.every(i=>i._zod.pattern)){const i=t.options.map(a=>a._zod.pattern);return new RegExp(`^(${i.map(a=>Lr(a.source)).join("|")})$`)}});const n=t.options.length===1,s=t.options[0]._zod.run;e._zod.parse=(i,a)=>{if(n)return s(i,a);let o=!1;const r=[];for(const c of t.options){const l=c._zod.run({value:i.value,issues:[]},a);if(l instanceof Promise)r.push(l),o=!0;else{if(l.issues.length===0)return l;r.push(l)}}return o?Promise.all(r).then(c=>Rc(c,i,e,a)):Rc(r,i,e,a)}}),Hw=E("$ZodIntersection",(e,t)=>{tt.init(e,t),e._zod.parse=(n,s)=>{const i=n.value,a=t.left._zod.run({value:i,issues:[]},s),o=t.right._zod.run({value:i,issues:[]},s);return a instanceof Promise||o instanceof Promise?Promise.all([a,o]).then(([c,l])=>Bc(n,c,l)):Bc(n,a,o)}});function Na(e,t){if(e===t)return{valid:!0,data:e};if(e instanceof Date&&t instanceof Date&&+e==+t)return{valid:!0,data:e};if(ji(e)&&ji(t)){const n=Object.keys(t),s=Object.keys(e).filter(a=>n.indexOf(a)!==-1),i={...e,...t};for(const a of s){const o=Na(e[a],t[a]);if(!o.valid)return{valid:!1,mergeErrorPath:[a,...o.mergeErrorPath]};i[a]=o.data}return{valid:!0,data:i}}if(Array.isArray(e)&&Array.isArray(t)){if(e.length!==t.length)return{valid:!1,mergeErrorPath:[]};const n=[];for(let s=0;s<e.length;s++){const i=e[s],a=t[s],o=Na(i,a);if(!o.valid)return{valid:!1,mergeErrorPath:[s,...o.mergeErrorPath]};n.push(o.data)}return{valid:!0,data:n}}return{valid:!1,mergeErrorPath:[]}}function Bc(e,t,n){const s=new Map;let i;for(const r of t.issues)if(r.code==="unrecognized_keys"){i??(i=r);for(const c of r.keys)s.has(c)||s.set(c,{}),s.get(c).l=!0}else e.issues.push(r);for(const r of n.issues)if(r.code==="unrecognized_keys")for(const c of r.keys)s.has(c)||s.set(c,{}),s.get(c).r=!0;else e.issues.push(r);const a=[...s].filter(([,r])=>r.l&&r.r).map(([r])=>r);if(a.length&&i&&e.issues.push({...i,keys:a}),$s(e))return e;const o=Na(t.value,n.value);if(!o.valid)throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(o.mergeErrorPath)}`);return e.value=o.data,e}const Rw=E("$ZodEnum",(e,t)=>{tt.init(e,t);const n=Jd(t.entries),s=new Set(n);e._zod.values=s,e._zod.pattern=new RegExp(`^(${n.filter(i=>o0.has(typeof i)).map(i=>typeof i=="string"?Po(i):i.toString()).join("|")})$`),e._zod.parse=(i,a)=>{const o=i.value;return s.has(o)||i.issues.push({code:"invalid_value",values:n,input:o,inst:e}),i}}),Bw=E("$ZodTransform",(e,t)=>{tt.init(e,t),e._zod.parse=(n,s)=>{if(s.direction==="backward")throw new Qd(e.constructor.name);const i=t.transform(n.value,n);if(s.async)return(i instanceof Promise?i:Promise.resolve(i)).then(o=>(n.value=o,n));if(i instanceof Promise)throw new Ts;return n.value=i,n}});function Oc(e,t){return e.issues.length&&t===void 0?{issues:[],value:void 0}:e}const du=E("$ZodOptional",(e,t)=>{tt.init(e,t),e._zod.optin="optional",e._zod.optout="optional",je(e._zod,"values",()=>t.innerType._zod.values?new Set([...t.innerType._zod.values,void 0]):void 0),je(e._zod,"pattern",()=>{const n=t.innerType._zod.pattern;return n?new RegExp(`^(${Lr(n.source)})?$`):void 0}),e._zod.parse=(n,s)=>{if(t.innerType._zod.optin==="optional"){const i=t.innerType._zod.run(n,s);return i instanceof Promise?i.then(a=>Oc(a,n.value)):Oc(i,n.value)}return n.value===void 0?n:t.innerType._zod.run(n,s)}}),Ow=E("$ZodExactOptional",(e,t)=>{du.init(e,t),je(e._zod,"values",()=>t.innerType._zod.values),je(e._zod,"pattern",()=>t.innerType._zod.pattern),e._zod.parse=(n,s)=>t.innerType._zod.run(n,s)}),Nw=E("$ZodNullable",(e,t)=>{tt.init(e,t),je(e._zod,"optin",()=>t.innerType._zod.optin),je(e._zod,"optout",()=>t.innerType._zod.optout),je(e._zod,"pattern",()=>{const n=t.innerType._zod.pattern;return n?new RegExp(`^(${Lr(n.source)}|null)$`):void 0}),je(e._zod,"values",()=>t.innerType._zod.values?new Set([...t.innerType._zod.values,null]):void 0),e._zod.parse=(n,s)=>n.value===null?n:t.innerType._zod.run(n,s)}),Uw=E("$ZodDefault",(e,t)=>{tt.init(e,t),e._zod.optin="optional",je(e._zod,"values",()=>t.innerType._zod.values),e._zod.parse=(n,s)=>{if(s.direction==="backward")return t.innerType._zod.run(n,s);if(n.value===void 0)return n.value=t.defaultValue,n;const i=t.innerType._zod.run(n,s);return i instanceof Promise?i.then(a=>Nc(a,t)):Nc(i,t)}});function Nc(e,t){return e.value===void 0&&(e.value=t.defaultValue),e}const Fw=E("$ZodPrefault",(e,t)=>{tt.init(e,t),e._zod.optin="optional",je(e._zod,"values",()=>t.innerType._zod.values),e._zod.parse=(n,s)=>(s.direction==="backward"||n.value===void 0&&(n.value=t.defaultValue),t.innerType._zod.run(n,s))}),Vw=E("$ZodNonOptional",(e,t)=>{tt.init(e,t),je(e._zod,"values",()=>{const n=t.innerType._zod.values;return n?new Set([...n].filter(s=>s!==void 0)):void 0}),e._zod.parse=(n,s)=>{const i=t.innerType._zod.run(n,s);return i instanceof Promise?i.then(a=>Uc(a,e)):Uc(i,e)}});function Uc(e,t){return!e.issues.length&&e.value===void 0&&e.issues.push({code:"invalid_type",expected:"nonoptional",input:e.value,inst:t}),e}const Zw=E("$ZodCatch",(e,t)=>{tt.init(e,t),je(e._zod,"optin",()=>t.innerType._zod.optin),je(e._zod,"optout",()=>t.innerType._zod.optout),je(e._zod,"values",()=>t.innerType._zod.values),e._zod.parse=(n,s)=>{if(s.direction==="backward")return t.innerType._zod.run(n,s);const i=t.innerType._zod.run(n,s);return i instanceof Promise?i.then(a=>(n.value=a.value,a.issues.length&&(n.value=t.catchValue({...n,error:{issues:a.issues.map(o=>ps(o,s,us()))},input:n.value}),n.issues=[]),n)):(n.value=i.value,i.issues.length&&(n.value=t.catchValue({...n,error:{issues:i.issues.map(a=>ps(a,s,us()))},input:n.value}),n.issues=[]),n)}}),Gw=E("$ZodPipe",(e,t)=>{tt.init(e,t),je(e._zod,"values",()=>t.in._zod.values),je(e._zod,"optin",()=>t.in._zod.optin),je(e._zod,"optout",()=>t.out._zod.optout),je(e._zod,"propValues",()=>t.in._zod.propValues),e._zod.parse=(n,s)=>{if(s.direction==="backward"){const a=t.out._zod.run(n,s);return a instanceof Promise?a.then(o=>Fi(o,t.in,s)):Fi(a,t.in,s)}const i=t.in._zod.run(n,s);return i instanceof Promise?i.then(a=>Fi(a,t.out,s)):Fi(i,t.out,s)}});function Fi(e,t,n){return e.issues.length?(e.aborted=!0,e):t._zod.run({value:e.value,issues:e.issues},n)}const Ww=E("$ZodReadonly",(e,t)=>{tt.init(e,t),je(e._zod,"propValues",()=>t.innerType._zod.propValues),je(e._zod,"values",()=>t.innerType._zod.values),je(e._zod,"optin",()=>t.innerType?._zod?.optin),je(e._zod,"optout",()=>t.innerType?._zod?.optout),e._zod.parse=(n,s)=>{if(s.direction==="backward")return t.innerType._zod.run(n,s);const i=t.innerType._zod.run(n,s);return i instanceof Promise?i.then(Fc):Fc(i)}});function Fc(e){return e.value=Object.freeze(e.value),e}const Qw=E("$ZodCustom",(e,t)=>{bn.init(e,t),tt.init(e,t),e._zod.parse=(n,s)=>n,e._zod.check=n=>{const s=n.value,i=t.fn(s);if(i instanceof Promise)return i.then(a=>Vc(a,n,s,e));Vc(i,n,s,e)}});function Vc(e,t,n,s){if(!e){const i={code:"custom",input:n,inst:s,path:[...s._zod.def.path??[]],continue:!s._zod.def.abort};s._zod.def.params&&(i.params=s._zod.def.params),t.issues.push(Di(i))}}var Zc;class Kw{constructor(){this._map=new WeakMap,this._idmap=new Map}add(t,...n){const s=n[0];return this._map.set(t,s),s&&typeof s=="object"&&"id"in s&&this._idmap.set(s.id,t),this}clear(){return this._map=new WeakMap,this._idmap=new Map,this}remove(t){const n=this._map.get(t);return n&&typeof n=="object"&&"id"in n&&this._idmap.delete(n.id),this._map.delete(t),this}get(t){const n=t._zod.parent;if(n){const s={...this.get(n)??{}};delete s.id;const i={...s,...this._map.get(t)};return Object.keys(i).length?i:void 0}return this._map.get(t)}has(t){return this._map.has(t)}}function Jw(){return new Kw}(Zc=globalThis).__zod_globalRegistry??(Zc.__zod_globalRegistry=Jw());const pi=globalThis.__zod_globalRegistry;function Yw(e,t){return new e({type:"string",...be(t)})}function Xw(e,t){return new e({type:"string",format:"email",check:"string_format",abort:!1,...be(t)})}function Gc(e,t){return new e({type:"string",format:"guid",check:"string_format",abort:!1,...be(t)})}function ek(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,...be(t)})}function tk(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,version:"v4",...be(t)})}function nk(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,version:"v6",...be(t)})}function sk(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,version:"v7",...be(t)})}function ik(e,t){return new e({type:"string",format:"url",check:"string_format",abort:!1,...be(t)})}function ok(e,t){return new e({type:"string",format:"emoji",check:"string_format",abort:!1,...be(t)})}function ak(e,t){return new e({type:"string",format:"nanoid",check:"string_format",abort:!1,...be(t)})}function rk(e,t){return new e({type:"string",format:"cuid",check:"string_format",abort:!1,...be(t)})}function ck(e,t){return new e({type:"string",format:"cuid2",check:"string_format",abort:!1,...be(t)})}function lk(e,t){return new e({type:"string",format:"ulid",check:"string_format",abort:!1,...be(t)})}function dk(e,t){return new e({type:"string",format:"xid",check:"string_format",abort:!1,...be(t)})}function uk(e,t){return new e({type:"string",format:"ksuid",check:"string_format",abort:!1,...be(t)})}function pk(e,t){return new e({type:"string",format:"ipv4",check:"string_format",abort:!1,...be(t)})}function mk(e,t){return new e({type:"string",format:"ipv6",check:"string_format",abort:!1,...be(t)})}function gk(e,t){return new e({type:"string",format:"cidrv4",check:"string_format",abort:!1,...be(t)})}function fk(e,t){return new e({type:"string",format:"cidrv6",check:"string_format",abort:!1,...be(t)})}function hk(e,t){return new e({type:"string",format:"base64",check:"string_format",abort:!1,...be(t)})}function vk(e,t){return new e({type:"string",format:"base64url",check:"string_format",abort:!1,...be(t)})}function bk(e,t){return new e({type:"string",format:"e164",check:"string_format",abort:!1,...be(t)})}function yk(e,t){return new e({type:"string",format:"jwt",check:"string_format",abort:!1,...be(t)})}function wk(e,t){return new e({type:"string",format:"datetime",check:"string_format",offset:!1,local:!1,precision:null,...be(t)})}function kk(e,t){return new e({type:"string",format:"date",check:"string_format",...be(t)})}function xk(e,t){return new e({type:"string",format:"time",check:"string_format",precision:null,...be(t)})}function $k(e,t){return new e({type:"string",format:"duration",check:"string_format",...be(t)})}function Sk(e){return new e({type:"unknown"})}function _k(e,t){return new e({type:"never",...be(t)})}function uu(e,t){return new Q0({check:"max_length",...be(t),maximum:e})}function go(e,t){return new K0({check:"min_length",...be(t),minimum:e})}function pu(e,t){return new J0({check:"length_equals",...be(t),length:e})}function Ck(e,t){return new Y0({check:"string_format",format:"regex",...be(t),pattern:e})}function Lk(e){return new X0({check:"string_format",format:"lowercase",...be(e)})}function Tk(e){return new ew({check:"string_format",format:"uppercase",...be(e)})}function Ak(e,t){return new tw({check:"string_format",format:"includes",...be(t),includes:e})}function Ek(e,t){return new nw({check:"string_format",format:"starts_with",...be(t),prefix:e})}function Mk(e,t){return new sw({check:"string_format",format:"ends_with",...be(t),suffix:e})}function Ns(e){return new iw({check:"overwrite",tx:e})}function qk(e){return Ns(t=>t.normalize(e))}function jk(){return Ns(e=>e.trim())}function Dk(){return Ns(e=>e.toLowerCase())}function Pk(){return Ns(e=>e.toUpperCase())}function zk(){return Ns(e=>s0(e))}function Ik(e,t,n){return new e({type:"array",element:t,...be(n)})}function Hk(e,t,n){return new e({type:"custom",check:"custom",fn:t,...be(n)})}function Rk(e){const t=Bk(n=>(n.addIssue=s=>{if(typeof s=="string")n.issues.push(Di(s,n.value,t._zod.def));else{const i=s;i.fatal&&(i.continue=!1),i.code??(i.code="custom"),i.input??(i.input=n.value),i.inst??(i.inst=t),i.continue??(i.continue=!t._zod.def.abort),n.issues.push(Di(i))}},e(n.value,n)));return t}function Bk(e,t){const n=new bn({check:"custom",...be(t)});return n._zod.check=e,n}function mu(e){let t=e?.target??"draft-2020-12";return t==="draft-4"&&(t="draft-04"),t==="draft-7"&&(t="draft-07"),{processors:e.processors??{},metadataRegistry:e?.metadata??pi,target:t,unrepresentable:e?.unrepresentable??"throw",override:e?.override??(()=>{}),io:e?.io??"output",counter:0,seen:new Map,cycles:e?.cycles??"ref",reused:e?.reused??"inline",external:e?.external??void 0}}function mt(e,t,n={path:[],schemaPath:[]}){var s;const i=e._zod.def,a=t.seen.get(e);if(a)return a.count++,n.schemaPath.includes(e)&&(a.cycle=n.path),a.schema;const o={schema:{},count:1,cycle:void 0,path:n.path};t.seen.set(e,o);const r=e._zod.toJSONSchema?.();if(r)o.schema=r;else{const d={...n,schemaPath:[...n.schemaPath,e],path:n.path};if(e._zod.processJSONSchema)e._zod.processJSONSchema(t,o.schema,d);else{const f=o.schema,g=t.processors[i.type];if(!g)throw new Error(`[toJSONSchema]: Non-representable type encountered: ${i.type}`);g(e,t,f,d)}const m=e._zod.parent;m&&(o.ref||(o.ref=m),mt(m,t,d),t.seen.get(m).isParent=!0)}const c=t.metadataRegistry.get(e);return c&&Object.assign(o.schema,c),t.io==="input"&&Ct(e)&&(delete o.schema.examples,delete o.schema.default),t.io==="input"&&o.schema._prefault&&((s=o.schema).default??(s.default=o.schema._prefault)),delete o.schema._prefault,t.seen.get(e).schema}function gu(e,t){const n=e.seen.get(t);if(!n)throw new Error("Unprocessed schema. This is a bug in Zod.");const s=new Map;for(const o of e.seen.entries()){const r=e.metadataRegistry.get(o[0])?.id;if(r){const c=s.get(r);if(c&&c!==o[0])throw new Error(`Duplicate schema id "${r}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);s.set(r,o[0])}}const i=o=>{const r=e.target==="draft-2020-12"?"$defs":"definitions";if(e.external){const m=e.external.registry.get(o[0])?.id,f=e.external.uri??(v=>v);if(m)return{ref:f(m)};const g=o[1].defId??o[1].schema.id??`schema${e.counter++}`;return o[1].defId=g,{defId:g,ref:`${f("__shared")}#/${r}/${g}`}}if(o[1]===n)return{ref:"#"};const l=`#/${r}/`,d=o[1].schema.id??`__schema${e.counter++}`;return{defId:d,ref:l+d}},a=o=>{if(o[1].schema.$ref)return;const r=o[1],{ref:c,defId:l}=i(o);r.def={...r.schema},l&&(r.defId=l);const d=r.schema;for(const m in d)delete d[m];d.$ref=c};if(e.cycles==="throw")for(const o of e.seen.entries()){const r=o[1];if(r.cycle)throw new Error(`Cycle detected: #/${r.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`)}for(const o of e.seen.entries()){const r=o[1];if(t===o[0]){a(o);continue}if(e.external){const l=e.external.registry.get(o[0])?.id;if(t!==o[0]&&l){a(o);continue}}if(e.metadataRegistry.get(o[0])?.id){a(o);continue}if(r.cycle){a(o);continue}if(r.count>1&&e.reused==="ref"){a(o);continue}}}function fu(e,t){const n=e.seen.get(t);if(!n)throw new Error("Unprocessed schema. This is a bug in Zod.");const s=o=>{const r=e.seen.get(o);if(r.ref===null)return;const c=r.def??r.schema,l={...c},d=r.ref;if(r.ref=null,d){s(d);const f=e.seen.get(d),g=f.schema;if(g.$ref&&(e.target==="draft-07"||e.target==="draft-04"||e.target==="openapi-3.0")?(c.allOf=c.allOf??[],c.allOf.push(g)):Object.assign(c,g),Object.assign(c,l),o._zod.parent===d)for(const y in c)y==="$ref"||y==="allOf"||y in l||delete c[y];if(g.$ref&&f.def)for(const y in c)y==="$ref"||y==="allOf"||y in f.def&&JSON.stringify(c[y])===JSON.stringify(f.def[y])&&delete c[y]}const m=o._zod.parent;if(m&&m!==d){s(m);const f=e.seen.get(m);if(f?.schema.$ref&&(c.$ref=f.schema.$ref,f.def))for(const g in c)g==="$ref"||g==="allOf"||g in f.def&&JSON.stringify(c[g])===JSON.stringify(f.def[g])&&delete c[g]}e.override({zodSchema:o,jsonSchema:c,path:r.path??[]})};for(const o of[...e.seen.entries()].reverse())s(o[0]);const i={};if(e.target==="draft-2020-12"?i.$schema="https://json-schema.org/draft/2020-12/schema":e.target==="draft-07"?i.$schema="http://json-schema.org/draft-07/schema#":e.target==="draft-04"?i.$schema="http://json-schema.org/draft-04/schema#":e.target,e.external?.uri){const o=e.external.registry.get(t)?.id;if(!o)throw new Error("Schema is missing an `id` property");i.$id=e.external.uri(o)}Object.assign(i,n.def??n.schema);const a=e.external?.defs??{};for(const o of e.seen.entries()){const r=o[1];r.def&&r.defId&&(a[r.defId]=r.def)}e.external||Object.keys(a).length>0&&(e.target==="draft-2020-12"?i.$defs=a:i.definitions=a);try{const o=JSON.parse(JSON.stringify(i));return Object.defineProperty(o,"~standard",{value:{...t["~standard"],jsonSchema:{input:fo(t,"input",e.processors),output:fo(t,"output",e.processors)}},enumerable:!1,writable:!1}),o}catch{throw new Error("Error converting schema to JSON.")}}function Ct(e,t){const n=t??{seen:new Set};if(n.seen.has(e))return!1;n.seen.add(e);const s=e._zod.def;if(s.type==="transform")return!0;if(s.type==="array")return Ct(s.element,n);if(s.type==="set")return Ct(s.valueType,n);if(s.type==="lazy")return Ct(s.getter(),n);if(s.type==="promise"||s.type==="optional"||s.type==="nonoptional"||s.type==="nullable"||s.type==="readonly"||s.type==="default"||s.type==="prefault")return Ct(s.innerType,n);if(s.type==="intersection")return Ct(s.left,n)||Ct(s.right,n);if(s.type==="record"||s.type==="map")return Ct(s.keyType,n)||Ct(s.valueType,n);if(s.type==="pipe")return Ct(s.in,n)||Ct(s.out,n);if(s.type==="object"){for(const i in s.shape)if(Ct(s.shape[i],n))return!0;return!1}if(s.type==="union"){for(const i of s.options)if(Ct(i,n))return!0;return!1}if(s.type==="tuple"){for(const i of s.items)if(Ct(i,n))return!0;return!!(s.rest&&Ct(s.rest,n))}return!1}const Ok=(e,t={})=>n=>{const s=mu({...n,processors:t});return mt(e,s),gu(s,e),fu(s,e)},fo=(e,t,n={})=>s=>{const{libraryOptions:i,target:a}=s??{},o=mu({...i??{},target:a,io:t,processors:n});return mt(e,o),gu(o,e),fu(o,e)},Nk={guid:"uuid",url:"uri",datetime:"date-time",json_string:"json-string",regex:""},Uk=(e,t,n,s)=>{const i=n;i.type="string";const{minimum:a,maximum:o,format:r,patterns:c,contentEncoding:l}=e._zod.bag;if(typeof a=="number"&&(i.minLength=a),typeof o=="number"&&(i.maxLength=o),r&&(i.format=Nk[r]??r,i.format===""&&delete i.format,r==="time"&&delete i.format),l&&(i.contentEncoding=l),c&&c.size>0){const d=[...c];d.length===1?i.pattern=d[0].source:d.length>1&&(i.allOf=[...d.map(m=>({...t.target==="draft-07"||t.target==="draft-04"||t.target==="openapi-3.0"?{type:"string"}:{},pattern:m.source}))])}},Fk=(e,t,n,s)=>{n.not={}},Vk=(e,t,n,s)=>{},Zk=(e,t,n,s)=>{const i=e._zod.def,a=Jd(i.entries);a.every(o=>typeof o=="number")&&(n.type="number"),a.every(o=>typeof o=="string")&&(n.type="string"),n.enum=a},Gk=(e,t,n,s)=>{if(t.unrepresentable==="throw")throw new Error("Custom types cannot be represented in JSON Schema")},Wk=(e,t,n,s)=>{if(t.unrepresentable==="throw")throw new Error("Transforms cannot be represented in JSON Schema")},Qk=(e,t,n,s)=>{const i=n,a=e._zod.def,{minimum:o,maximum:r}=e._zod.bag;typeof o=="number"&&(i.minItems=o),typeof r=="number"&&(i.maxItems=r),i.type="array",i.items=mt(a.element,t,{...s,path:[...s.path,"items"]})},Kk=(e,t,n,s)=>{const i=n,a=e._zod.def;i.type="object",i.properties={};const o=a.shape;for(const l in o)i.properties[l]=mt(o[l],t,{...s,path:[...s.path,"properties",l]});const r=new Set(Object.keys(o)),c=new Set([...r].filter(l=>{const d=a.shape[l]._zod;return t.io==="input"?d.optin===void 0:d.optout===void 0}));c.size>0&&(i.required=Array.from(c)),a.catchall?._zod.def.type==="never"?i.additionalProperties=!1:a.catchall?a.catchall&&(i.additionalProperties=mt(a.catchall,t,{...s,path:[...s.path,"additionalProperties"]})):t.io==="output"&&(i.additionalProperties=!1)},Jk=(e,t,n,s)=>{const i=e._zod.def,a=i.inclusive===!1,o=i.options.map((r,c)=>mt(r,t,{...s,path:[...s.path,a?"oneOf":"anyOf",c]}));a?n.oneOf=o:n.anyOf=o},Yk=(e,t,n,s)=>{const i=e._zod.def,a=mt(i.left,t,{...s,path:[...s.path,"allOf",0]}),o=mt(i.right,t,{...s,path:[...s.path,"allOf",1]}),r=l=>"allOf"in l&&Object.keys(l).length===1,c=[...r(a)?a.allOf:[a],...r(o)?o.allOf:[o]];n.allOf=c},Xk=(e,t,n,s)=>{const i=e._zod.def,a=mt(i.innerType,t,s),o=t.seen.get(e);t.target==="openapi-3.0"?(o.ref=i.innerType,n.nullable=!0):n.anyOf=[a,{type:"null"}]},e1=(e,t,n,s)=>{const i=e._zod.def;mt(i.innerType,t,s);const a=t.seen.get(e);a.ref=i.innerType},t1=(e,t,n,s)=>{const i=e._zod.def;mt(i.innerType,t,s);const a=t.seen.get(e);a.ref=i.innerType,n.default=JSON.parse(JSON.stringify(i.defaultValue))},n1=(e,t,n,s)=>{const i=e._zod.def;mt(i.innerType,t,s);const a=t.seen.get(e);a.ref=i.innerType,t.io==="input"&&(n._prefault=JSON.parse(JSON.stringify(i.defaultValue)))},s1=(e,t,n,s)=>{const i=e._zod.def;mt(i.innerType,t,s);const a=t.seen.get(e);a.ref=i.innerType;let o;try{o=i.catchValue(void 0)}catch{throw new Error("Dynamic catch values are not supported in JSON Schema")}n.default=o},i1=(e,t,n,s)=>{const i=e._zod.def,a=t.io==="input"?i.in._zod.def.type==="transform"?i.out:i.in:i.out;mt(a,t,s);const o=t.seen.get(e);o.ref=a},o1=(e,t,n,s)=>{const i=e._zod.def;mt(i.innerType,t,s);const a=t.seen.get(e);a.ref=i.innerType,n.readOnly=!0},hu=(e,t,n,s)=>{const i=e._zod.def;mt(i.innerType,t,s);const a=t.seen.get(e);a.ref=i.innerType},a1=E("ZodISODateTime",(e,t)=>{bw.init(e,t),Ze.init(e,t)});function r1(e){return wk(a1,e)}const c1=E("ZodISODate",(e,t)=>{yw.init(e,t),Ze.init(e,t)});function l1(e){return kk(c1,e)}const d1=E("ZodISOTime",(e,t)=>{ww.init(e,t),Ze.init(e,t)});function u1(e){return xk(d1,e)}const p1=E("ZodISODuration",(e,t)=>{kw.init(e,t),Ze.init(e,t)});function m1(e){return $k(p1,e)}const g1=(e,t)=>{nu.init(e,t),e.name="ZodError",Object.defineProperties(e,{format:{value:n=>f0(e,n)},flatten:{value:n=>g0(e,n)},addIssue:{value:n=>{e.issues.push(n),e.message=JSON.stringify(e.issues,Oa,2)}},addIssues:{value:n=>{e.issues.push(...n),e.message=JSON.stringify(e.issues,Oa,2)}},isEmpty:{get(){return e.issues.length===0}}})},Kt=E("ZodError",g1,{Parent:Error}),f1=Ar(Kt),h1=Er(Kt),v1=zo(Kt),b1=Io(Kt),y1=b0(Kt),w1=y0(Kt),k1=w0(Kt),x1=k0(Kt),$1=x0(Kt),S1=$0(Kt),_1=S0(Kt),C1=_0(Kt),nt=E("ZodType",(e,t)=>(tt.init(e,t),Object.assign(e["~standard"],{jsonSchema:{input:fo(e,"input"),output:fo(e,"output")}}),e.toJSONSchema=Ok(e,{}),e.def=t,e.type=t.type,Object.defineProperty(e,"_def",{value:t}),e.check=(...n)=>e.clone(Qn(t,{checks:[...t.checks??[],...n.map(s=>typeof s=="function"?{_zod:{check:s,def:{check:"custom"},onattach:[]}}:s)]}),{parent:!0}),e.with=e.check,e.clone=(n,s)=>Kn(e,n,s),e.brand=()=>e,e.register=((n,s)=>(n.add(e,s),e)),e.parse=(n,s)=>f1(e,n,s,{callee:e.parse}),e.safeParse=(n,s)=>v1(e,n,s),e.parseAsync=async(n,s)=>h1(e,n,s,{callee:e.parseAsync}),e.safeParseAsync=async(n,s)=>b1(e,n,s),e.spa=e.safeParseAsync,e.encode=(n,s)=>y1(e,n,s),e.decode=(n,s)=>w1(e,n,s),e.encodeAsync=async(n,s)=>k1(e,n,s),e.decodeAsync=async(n,s)=>x1(e,n,s),e.safeEncode=(n,s)=>$1(e,n,s),e.safeDecode=(n,s)=>S1(e,n,s),e.safeEncodeAsync=async(n,s)=>_1(e,n,s),e.safeDecodeAsync=async(n,s)=>C1(e,n,s),e.refine=(n,s)=>e.check(b2(n,s)),e.superRefine=n=>e.check(y2(n)),e.overwrite=n=>e.check(Ns(n)),e.optional=()=>Kc(e),e.exactOptional=()=>o2(e),e.nullable=()=>Jc(e),e.nullish=()=>Kc(Jc(e)),e.nonoptional=n=>u2(e,n),e.array=()=>Q1(e),e.or=n=>Y1([e,n]),e.and=n=>e2(e,n),e.transform=n=>Yc(e,s2(n)),e.default=n=>c2(e,n),e.prefault=n=>d2(e,n),e.catch=n=>m2(e,n),e.pipe=n=>Yc(e,n),e.readonly=()=>h2(e),e.describe=n=>{const s=e.clone();return pi.add(s,{description:n}),s},Object.defineProperty(e,"description",{get(){return pi.get(e)?.description},configurable:!0}),e.meta=(...n)=>{if(n.length===0)return pi.get(e);const s=e.clone();return pi.add(s,n[0]),s},e.isOptional=()=>e.safeParse(void 0).success,e.isNullable=()=>e.safeParse(null).success,e.apply=n=>n(e),e)),vu=E("_ZodString",(e,t)=>{Mr.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(s,i,a)=>Uk(e,s,i);const n=e._zod.bag;e.format=n.format??null,e.minLength=n.minimum??null,e.maxLength=n.maximum??null,e.regex=(...s)=>e.check(Ck(...s)),e.includes=(...s)=>e.check(Ak(...s)),e.startsWith=(...s)=>e.check(Ek(...s)),e.endsWith=(...s)=>e.check(Mk(...s)),e.min=(...s)=>e.check(go(...s)),e.max=(...s)=>e.check(uu(...s)),e.length=(...s)=>e.check(pu(...s)),e.nonempty=(...s)=>e.check(go(1,...s)),e.lowercase=s=>e.check(Lk(s)),e.uppercase=s=>e.check(Tk(s)),e.trim=()=>e.check(jk()),e.normalize=(...s)=>e.check(qk(...s)),e.toLowerCase=()=>e.check(Dk()),e.toUpperCase=()=>e.check(Pk()),e.slugify=()=>e.check(zk())}),L1=E("ZodString",(e,t)=>{Mr.init(e,t),vu.init(e,t),e.email=n=>e.check(Xw(T1,n)),e.url=n=>e.check(ik(A1,n)),e.jwt=n=>e.check(yk(F1,n)),e.emoji=n=>e.check(ok(E1,n)),e.guid=n=>e.check(Gc(Wc,n)),e.uuid=n=>e.check(ek(Vi,n)),e.uuidv4=n=>e.check(tk(Vi,n)),e.uuidv6=n=>e.check(nk(Vi,n)),e.uuidv7=n=>e.check(sk(Vi,n)),e.nanoid=n=>e.check(ak(M1,n)),e.guid=n=>e.check(Gc(Wc,n)),e.cuid=n=>e.check(rk(q1,n)),e.cuid2=n=>e.check(ck(j1,n)),e.ulid=n=>e.check(lk(D1,n)),e.base64=n=>e.check(hk(O1,n)),e.base64url=n=>e.check(vk(N1,n)),e.xid=n=>e.check(dk(P1,n)),e.ksuid=n=>e.check(uk(z1,n)),e.ipv4=n=>e.check(pk(I1,n)),e.ipv6=n=>e.check(mk(H1,n)),e.cidrv4=n=>e.check(gk(R1,n)),e.cidrv6=n=>e.check(fk(B1,n)),e.e164=n=>e.check(bk(U1,n)),e.datetime=n=>e.check(r1(n)),e.date=n=>e.check(l1(n)),e.time=n=>e.check(u1(n)),e.duration=n=>e.check(m1(n))});function Ss(e){return Yw(L1,e)}const Ze=E("ZodStringFormat",(e,t)=>{Ue.init(e,t),vu.init(e,t)}),T1=E("ZodEmail",(e,t)=>{lw.init(e,t),Ze.init(e,t)}),Wc=E("ZodGUID",(e,t)=>{rw.init(e,t),Ze.init(e,t)}),Vi=E("ZodUUID",(e,t)=>{cw.init(e,t),Ze.init(e,t)}),A1=E("ZodURL",(e,t)=>{dw.init(e,t),Ze.init(e,t)}),E1=E("ZodEmoji",(e,t)=>{uw.init(e,t),Ze.init(e,t)}),M1=E("ZodNanoID",(e,t)=>{pw.init(e,t),Ze.init(e,t)}),q1=E("ZodCUID",(e,t)=>{mw.init(e,t),Ze.init(e,t)}),j1=E("ZodCUID2",(e,t)=>{gw.init(e,t),Ze.init(e,t)}),D1=E("ZodULID",(e,t)=>{fw.init(e,t),Ze.init(e,t)}),P1=E("ZodXID",(e,t)=>{hw.init(e,t),Ze.init(e,t)}),z1=E("ZodKSUID",(e,t)=>{vw.init(e,t),Ze.init(e,t)}),I1=E("ZodIPv4",(e,t)=>{xw.init(e,t),Ze.init(e,t)}),H1=E("ZodIPv6",(e,t)=>{$w.init(e,t),Ze.init(e,t)}),R1=E("ZodCIDRv4",(e,t)=>{Sw.init(e,t),Ze.init(e,t)}),B1=E("ZodCIDRv6",(e,t)=>{_w.init(e,t),Ze.init(e,t)}),O1=E("ZodBase64",(e,t)=>{Cw.init(e,t),Ze.init(e,t)}),N1=E("ZodBase64URL",(e,t)=>{Tw.init(e,t),Ze.init(e,t)}),U1=E("ZodE164",(e,t)=>{Aw.init(e,t),Ze.init(e,t)}),F1=E("ZodJWT",(e,t)=>{Mw.init(e,t),Ze.init(e,t)}),V1=E("ZodUnknown",(e,t)=>{qw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Vk()});function Qc(){return Sk(V1)}const Z1=E("ZodNever",(e,t)=>{jw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Fk(e,n,s)});function G1(e){return _k(Z1,e)}const W1=E("ZodArray",(e,t)=>{Dw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Qk(e,n,s,i),e.element=t.element,e.min=(n,s)=>e.check(go(n,s)),e.nonempty=n=>e.check(go(1,n)),e.max=(n,s)=>e.check(uu(n,s)),e.length=(n,s)=>e.check(pu(n,s)),e.unwrap=()=>e.element});function Q1(e,t){return Ik(W1,e,t)}const K1=E("ZodObject",(e,t)=>{zw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Kk(e,n,s,i),je(e,"shape",()=>t.shape),e.keyof=()=>t2(Object.keys(e._zod.def.shape)),e.catchall=n=>e.clone({...e._zod.def,catchall:n}),e.passthrough=()=>e.clone({...e._zod.def,catchall:Qc()}),e.loose=()=>e.clone({...e._zod.def,catchall:Qc()}),e.strict=()=>e.clone({...e._zod.def,catchall:G1()}),e.strip=()=>e.clone({...e._zod.def,catchall:void 0}),e.extend=n=>l0(e,n),e.safeExtend=n=>d0(e,n),e.merge=n=>u0(e,n),e.pick=n=>r0(e,n),e.omit=n=>c0(e,n),e.partial=(...n)=>p0(yu,e,n[0]),e.required=(...n)=>m0(wu,e,n[0])});function bu(e,t){const n={type:"object",shape:e??{},...be(t)};return new K1(n)}const J1=E("ZodUnion",(e,t)=>{Iw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Jk(e,n,s,i),e.options=t.options});function Y1(e,t){return new J1({type:"union",options:e,...be(t)})}const X1=E("ZodIntersection",(e,t)=>{Hw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Yk(e,n,s,i)});function e2(e,t){return new X1({type:"intersection",left:e,right:t})}const Ua=E("ZodEnum",(e,t)=>{Rw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(s,i,a)=>Zk(e,s,i),e.enum=t.entries,e.options=Object.values(t.entries);const n=new Set(Object.keys(t.entries));e.extract=(s,i)=>{const a={};for(const o of s)if(n.has(o))a[o]=t.entries[o];else throw new Error(`Key ${o} not found in enum`);return new Ua({...t,checks:[],...be(i),entries:a})},e.exclude=(s,i)=>{const a={...t.entries};for(const o of s)if(n.has(o))delete a[o];else throw new Error(`Key ${o} not found in enum`);return new Ua({...t,checks:[],...be(i),entries:a})}});function t2(e,t){const n=Array.isArray(e)?Object.fromEntries(e.map(s=>[s,s])):e;return new Ua({type:"enum",entries:n,...be(t)})}const n2=E("ZodTransform",(e,t)=>{Bw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Wk(e,n),e._zod.parse=(n,s)=>{if(s.direction==="backward")throw new Qd(e.constructor.name);n.addIssue=a=>{if(typeof a=="string")n.issues.push(Di(a,n.value,t));else{const o=a;o.fatal&&(o.continue=!1),o.code??(o.code="custom"),o.input??(o.input=n.value),o.inst??(o.inst=e),n.issues.push(Di(o))}};const i=t.transform(n.value,n);return i instanceof Promise?i.then(a=>(n.value=a,n)):(n.value=i,n)}});function s2(e){return new n2({type:"transform",transform:e})}const yu=E("ZodOptional",(e,t)=>{du.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>hu(e,n,s,i),e.unwrap=()=>e._zod.def.innerType});function Kc(e){return new yu({type:"optional",innerType:e})}const i2=E("ZodExactOptional",(e,t)=>{Ow.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>hu(e,n,s,i),e.unwrap=()=>e._zod.def.innerType});function o2(e){return new i2({type:"optional",innerType:e})}const a2=E("ZodNullable",(e,t)=>{Nw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Xk(e,n,s,i),e.unwrap=()=>e._zod.def.innerType});function Jc(e){return new a2({type:"nullable",innerType:e})}const r2=E("ZodDefault",(e,t)=>{Uw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>t1(e,n,s,i),e.unwrap=()=>e._zod.def.innerType,e.removeDefault=e.unwrap});function c2(e,t){return new r2({type:"default",innerType:e,get defaultValue(){return typeof t=="function"?t():Xd(t)}})}const l2=E("ZodPrefault",(e,t)=>{Fw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>n1(e,n,s,i),e.unwrap=()=>e._zod.def.innerType});function d2(e,t){return new l2({type:"prefault",innerType:e,get defaultValue(){return typeof t=="function"?t():Xd(t)}})}const wu=E("ZodNonOptional",(e,t)=>{Vw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>e1(e,n,s,i),e.unwrap=()=>e._zod.def.innerType});function u2(e,t){return new wu({type:"nonoptional",innerType:e,...be(t)})}const p2=E("ZodCatch",(e,t)=>{Zw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>s1(e,n,s,i),e.unwrap=()=>e._zod.def.innerType,e.removeCatch=e.unwrap});function m2(e,t){return new p2({type:"catch",innerType:e,catchValue:typeof t=="function"?t:()=>t})}const g2=E("ZodPipe",(e,t)=>{Gw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>i1(e,n,s,i),e.in=t.in,e.out=t.out});function Yc(e,t){return new g2({type:"pipe",in:e,out:t})}const f2=E("ZodReadonly",(e,t)=>{Ww.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>o1(e,n,s,i),e.unwrap=()=>e._zod.def.innerType});function h2(e){return new f2({type:"readonly",innerType:e})}const v2=E("ZodCustom",(e,t)=>{Qw.init(e,t),nt.init(e,t),e._zod.processJSONSchema=(n,s,i)=>Gk(e,n)});function b2(e,t={}){return Hk(v2,e,t)}function y2(e){return Rk(e)}const ku=bu({name:Ss().min(3,"Project name must be at least 3 characters").max(50,"Project name must be less than 50 characters").regex(/^[a-zA-Z0-9_\-\s]+$/,"Project name can only contain letters, numbers, spaces, underscores, and hyphens"),description:Ss().optional(),owner_id:Ss().optional(),company_id:Ss().optional()});bu({userRole:Ss().optional(),userRolePrompt:Ss().optional()});const Fa="project-modal";let dt={mode:"create"},wt=null,$i=null,rt=[],An=[],Va=null,Za=[];function Pi(e){dt=e,wt=e.project||null,$i=e.inlineContainer?e.onCancel??(()=>{}):null;const t=w2(e.mode);if(e.inlineContainer){e.inlineContainer.innerHTML="",e.inlineContainer.appendChild(t),e.mode==="edit"&&e.project?.id?Xc(t,e.project.id):el(t);return}const n=Me({id:Fa,title:"",size:"lg",content:t}),s=n.querySelector(".modal-content");s&&s.classList.add("project-modal-content-bare");const i=n.querySelector(".modal-header");i&&i.classList.add("hidden"),document.body.appendChild(n),qe(Fa),e.mode==="edit"&&e.project?.id?Xc(t,e.project.id):el(t)}function As(){$i?($i(),$i=null):U(Fa)}function w2(e){const t=_("div",{className:"project-modal-sota"});return t.innerHTML=`
    <style>
      .project-modal-sota {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .project-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.8),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        overflow: hidden;
      }
      
      [data-theme="dark"] .project-card {
        background: linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%);
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }
      
      .project-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 32px;
        position: relative;
        overflow: hidden;
      }
      
      .project-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      
      .project-header-content {
        display: flex;
        align-items: center;
        gap: 20px;
        position: relative;
        z-index: 1;
      }
      
      .project-icon-large {
        width: 72px;
        height: 72px;
        border-radius: 18px;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid rgba(255,255,255,0.3);
        flex-shrink: 0;
      }
      
      .project-icon-large svg {
        width: 36px;
        height: 36px;
        color: white;
      }
      
      .project-title-info h2 {
        margin: 0 0 4px 0;
        font-size: 24px;
        font-weight: 700;
        color: white;
      }
      
      .project-title-info p {
        margin: 0;
        color: rgba(255,255,255,0.8);
        font-size: 14px;
      }
      
      .project-close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 10;
      }
      
      .project-close-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: rotate(90deg);
      }
      
      .project-close-btn svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      
      .project-tabs-nav {
        display: flex;
        gap: 0;
        padding: 0 24px;
        background: rgba(0,0,0,0.02);
        border-bottom: 1px solid rgba(0,0,0,0.06);
        overflow-x: auto;
      }
      
      [data-theme="dark"] .project-tabs-nav {
        background: rgba(255,255,255,0.02);
        border-bottom-color: rgba(255,255,255,0.06);
      }
      
      .project-tab-btn {
        padding: 16px 20px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .project-tab-btn:hover {
        color: #1e293b;
      }
      
      [data-theme="dark"] .project-tab-btn:hover {
        color: #e2e8f0;
      }
      
      .project-tab-btn.active {
        color: #e11d48;
      }
      
      .project-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20px;
        right: 20px;
        height: 2px;
        background: #e11d48;
        border-radius: 2px 2px 0 0;
      }
      
      .project-tab-icon {
        width: 18px;
        height: 18px;
      }
      
      .project-body {
        padding: 32px;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .project-section {
        display: none;
      }
      
      .project-section.active {
        display: block;
      }
      
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
      
      .form-grid .full-width {
        grid-column: 1 / -1;
      }
      
      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .form-field label {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      [data-theme="dark"] .form-field label {
        color: #94a3b8;
      }
      
      .form-field input,
      .form-field select,
      .form-field textarea {
        padding: 12px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        font-size: 14px;
        background: #f8fafc;
        color: #1e293b;
        transition: all 0.2s;
        outline: none;
      }
      
      [data-theme="dark"] .form-field input,
      [data-theme="dark"] .form-field select,
      [data-theme="dark"] .form-field textarea {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .form-field input:focus,
      .form-field select:focus,
      .form-field textarea:focus {
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }
      
      .form-field input:disabled {
        background: #f1f5f9;
        color: #94a3b8;
        cursor: not-allowed;
      }
      
      .form-field textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .form-hint {
        font-size: 12px;
        color: #94a3b8;
      }
      
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid rgba(0,0,0,0.06);
      }
      
      [data-theme="dark"] .form-actions {
        border-top-color: rgba(255,255,255,0.06);
      }
      
      .btn-sota {
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      
      .btn-sota.primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-sota.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
      
      .btn-sota.primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      
      .btn-sota.secondary {
        background: #f1f5f9;
        color: #475569;
      }
      
      [data-theme="dark"] .btn-sota.secondary {
        background: rgba(255,255,255,0.1);
        color: #e2e8f0;
      }
      
      .btn-sota.secondary:hover {
        background: #e2e8f0;
      }
      
      .btn-sota.danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      .btn-sota.danger:hover {
        background: #fef2f2;
        border-color: #dc2626;
      }
      
      .btn-sota.small {
        padding: 8px 16px;
        font-size: 13px;
      }
      
      /* Section Headers */
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      
      .section-header h3 {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      [data-theme="dark"] .section-header h3 {
        color: #f1f5f9;
      }
      
      .section-header h3 svg {
        width: 20px;
        height: 20px;
        color: #e11d48;
      }
      
      /* Members List */
      .members-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .member-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: #f8fafc;
        border-radius: 12px;
        border: 1px solid transparent;
        transition: all 0.2s;
      }
      
      [data-theme="dark"] .member-card {
        background: rgba(255,255,255,0.03);
      }
      
      .member-card:hover {
        border-color: #e2e8f0;
      }
      
      .member-card.owner {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
      }
      
      .member-info {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      
      .member-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
      }
      
      .member-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .member-details h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      
      [data-theme="dark"] .member-details h4 {
        color: #f1f5f9;
      }
      
      .member-details p {
        margin: 0;
        font-size: 12px;
        color: #64748b;
      }
      
      .member-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .role-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .role-badge.owner {
        background: #e11d48;
        color: white;
      }
      
      .role-badge.admin {
        background: #8b5cf6;
        color: white;
      }
      
      .role-badge.write {
        background: #0ea5e9;
        color: white;
      }
      
      .role-badge.read {
        background: #64748b;
        color: white;
      }
      
      .role-select {
        padding: 6px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 13px;
        background: white;
        cursor: pointer;
      }
      
      [data-theme="dark"] .role-select {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      /* Role Templates List */
      .roles-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      
      .role-card {
        padding: 20px;
        background: #f8fafc;
        border-radius: 16px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      [data-theme="dark"] .role-card {
        background: rgba(255,255,255,0.03);
      }
      
      .role-card:hover {
        border-color: #e2e8f0;
        transform: translateY(-2px);
      }
      
      .role-card.active {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
      }
      
      .role-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .role-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .role-icon svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      
      .role-card h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      
      [data-theme="dark"] .role-card h4 {
        color: #f1f5f9;
      }
      
      .role-card p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.5;
      }
      
      .role-card .toggle-active {
        margin-top: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #64748b;
      }
      
      /* Config Section */
      .config-group {
        margin-bottom: 32px;
      }
      
      .config-group h4 {
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      [data-theme="dark"] .config-group h4 {
        color: #f1f5f9;
      }
      
      .config-group h4 svg {
        width: 16px;
        height: 16px;
        color: #e11d48;
      }
      
      .api-key-field {
        display: flex;
        gap: 12px;
      }
      
      .api-key-field input {
        flex: 1;
      }
      
      .api-key-field .btn-sota {
        flex-shrink: 0;
      }
      
      /* Danger Zone */
      .danger-zone {
        background: linear-gradient(135deg, #fef2f2 0%, #fff 100%);
        border: 1px solid #fecaca;
        border-radius: 16px;
        padding: 24px;
        margin-top: 32px;
      }
      
      [data-theme="dark"] .danger-zone {
        background: linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(220,38,38,0.05) 100%);
        border-color: rgba(220,38,38,0.3);
      }
      
      .danger-zone h3 {
        color: #dc2626 !important;
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .danger-zone h3 svg {
        width: 18px;
        height: 18px;
      }
      
      .danger-zone p {
        color: #991b1b;
        font-size: 14px;
        margin: 0 0 16px 0;
      }
      
      [data-theme="dark"] .danger-zone p {
        color: #fca5a5;
      }
      
      /* Empty State */
      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: #94a3b8;
      }
      
      .empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .empty-state p {
        margin: 0 0 16px 0;
      }
      
      /* Loading */
      .loading-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 48px;
      }
      
      .loading-spinner::after {
        content: '';
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #e11d48;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Responsive */
      @media (max-width: 640px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
        
        .roles-grid {
          grid-template-columns: 1fr;
        }
        
        .project-tabs-nav {
          padding: 0 16px;
        }
        
        .project-tab-btn {
          padding: 14px 16px;
        }
      }
    </style>
    
    <div class="project-card">
      <div class="loading-spinner"></div>
    </div>
  `,t}async function Xc(e,t){const n=e.querySelector(".project-card");if(n)try{const[s,i,a,o,r]=await Promise.all([p.get(`/api/projects/${t}`).catch(()=>null),p.get(`/api/projects/${t}/members`).catch(()=>({data:{members:[]}})),p.get("/api/role-templates").catch(()=>({data:{roles:[]}})),p.get(`/api/projects/${t}/config`).catch(()=>({data:{config:null}})),p.get("/api/contacts").catch(()=>({data:{contacts:[]}}))]);s?.data?.project&&(wt=s.data.project),rt=i?.data?.members||[],An=a?.data?.roles||[],Va=o?.data?.config||null;const c=r?.data;Za=Array.isArray(c)?c:c?.contacts||[],tl(n)}catch{tl(n)}}function el(e){const t=e.querySelector(".project-card");t&&(t.innerHTML=`
    <!-- Header -->
    <div class="project-header">
      <button class="project-close-btn" id="close-project-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="project-header-content">
        <div class="project-icon-large">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div class="project-title-info">
          <h2>New Project</h2>
          <p>Create a new project to organize your work</p>
        </div>
      </div>
    </div>
    
    <!-- Form -->
    <div class="project-body">
      <form id="project-form">
        <div class="form-grid">
          <div class="form-field full-width">
            <label>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              Project Name *
            </label>
            <input type="text" name="name" required placeholder="Enter project name">
          </div>
          
          <div class="form-field full-width">
            <label>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
              </svg>
              Description
            </label>
            <textarea name="description" placeholder="Brief description of the project"></textarea>
          </div>
          <div class="form-field full-width">
            <label>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              Company *
            </label>
            <select name="company_id" id="project-company-id">
              <option value="">Loading...</option>
            </select>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-sota secondary" id="cancel-btn">Cancel</button>
          <button type="submit" class="btn-sota primary">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Project
          </button>
        </div>
      </form>
    </div>
  `,k2(t))}function tl(e){const t=wt||dt.project;if(!t)return;const n=t.settings||{};e.innerHTML=`
    <!-- Header -->
    <div class="project-header">
      <button class="project-close-btn" id="close-project-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="project-header-content">
        <div class="project-icon-large">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div class="project-title-info">
          <h2>${Te(t.name)}</h2>
          <p>${t.description?Te(t.description):"No description"}</p>
        </div>
      </div>
    </div>
    
    <!-- Tabs Navigation -->
    <nav class="project-tabs-nav">
      <button class="project-tab-btn active" data-tab="general">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        General
      </button>
      <button class="project-tab-btn" data-tab="members">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        Members
        <span class="badge">${rt.length}</span>
      </button>
      <button class="project-tab-btn" data-tab="roles">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
        Roles
      </button>
      <button class="project-tab-btn" data-tab="config">
        <svg class="project-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
        </svg>
        Config
      </button>
    </nav>
    
    <!-- Tab Content -->
    <div class="project-body">
      <!-- General Tab -->
      <div class="project-section active" id="section-general">
        <form id="project-form">
          <div class="form-grid">
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
                Project Name *
              </label>
              <input type="text" name="name" required value="${Te(t.name)}" placeholder="Enter project name">
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
                Description
              </label>
              <textarea name="description" placeholder="Brief description of the project">${Te(t.description||"")}</textarea>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Your Role
              </label>
              <input type="text" name="userRole" value="${Te(n.userRole||"")}" placeholder="e.g., Project Manager, Tech Lead">
              <span class="form-hint">Your role in this project (used for AI context)</span>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                Role Prompt
              </label>
              <input type="text" name="userRolePrompt" value="${Te(n.userRolePrompt||"")}" placeholder="e.g., I manage the project timeline">
              <span class="form-hint">Brief description of your responsibilities</span>
            </div>

            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                Company
              </label>
              <select name="company_id" id="project-company-id">
                <option value="">Loading...</option>
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-sota primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Save Changes
            </button>
          </div>
        </form>
        
        <!-- Danger Zone -->
        <div class="danger-zone">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Danger Zone
          </h3>
          <p>Deleting a project will permanently remove all associated data including questions, decisions, risks, and contacts.</p>
          <button type="button" class="btn-sota danger" id="delete-project-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete Project
          </button>
        </div>
      </div>
      
      <!-- Members Tab -->
      <div class="project-section" id="section-members">
        <div class="section-header">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            Team Members
          </h3>
          <button class="btn-sota primary small" id="invite-member-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Invite
          </button>
        </div>
        
        <div class="members-list" id="members-list">
          ${js()}
        </div>
      </div>
      
      <!-- Roles Tab -->
      <div class="project-section" id="section-roles">
        <div class="section-header">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            Available Roles
          </h3>
          <button class="btn-sota primary small" id="add-role-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Role
          </button>
        </div>
        <p class="section-intro">
          Select which roles are available for team members in this project.
        </p>
        
        <div class="roles-grid" id="roles-grid">
          ${xu()}
        </div>
      </div>
      
      <!-- Config Tab -->
      <div class="project-section" id="section-config">
        <div class="section-header">
          <h3>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
            Project Configuration
          </h3>
        </div>
        <p class="section-intro-24">
          Override system defaults with project-specific API keys. Leave empty to use system defaults.
        </p>
        
        <form id="config-form">
          <!-- LLM Per-Task Configuration -->
          <div class="config-group">
            <h4>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
              </svg>
              LLM Model Selection
            </h4>
            <p class="section-intro-sm">
              Override system defaults for each task type. Uncheck to use platform defaults.
            </p>
            
            <!-- Text -->
            <div class="llm-task-override">
              <div class="task-header-inline">
                <label class="checkbox-inline">
                  <input type="checkbox" name="use_system_text" ${Nt("llm_pertask.useSystemDefaults.text")!=="false"?"checked":""}>
                  <span class="task-icon">📝</span> Text / Chat
                </label>
                <span class="system-hint">(Use system default)</span>
              </div>
              <div class="task-override-fields ${Nt("llm_pertask.useSystemDefaults.text")!=="false"?"disabled":""}">
                <select name="text_provider" class="form-control" disabled>
                  <option value="">Loading...</option>
                </select>
                <select name="text_model" class="form-control" disabled>
                  <option value="">Select provider first</option>
                </select>
              </div>
            </div>
            
            <!-- Vision -->
            <div class="llm-task-override">
              <div class="task-header-inline">
                <label class="checkbox-inline">
                  <input type="checkbox" name="use_system_vision" ${Nt("llm_pertask.useSystemDefaults.vision")!=="false"?"checked":""}>
                  <span class="task-icon">👁️</span> Vision
                </label>
                <span class="system-hint">(Use system default)</span>
              </div>
              <div class="task-override-fields ${Nt("llm_pertask.useSystemDefaults.vision")!=="false"?"disabled":""}">
                <select name="vision_provider" class="form-control" disabled>
                  <option value="">Loading...</option>
                </select>
                <select name="vision_model" class="form-control" disabled>
                  <option value="">Select provider first</option>
                </select>
              </div>
            </div>
            
            <!-- Embeddings -->
            <div class="llm-task-override">
              <div class="task-header-inline">
                <label class="checkbox-inline">
                  <input type="checkbox" name="use_system_embeddings" ${Nt("llm_pertask.useSystemDefaults.embeddings")!=="false"?"checked":""}>
                  <span class="task-icon">🔗</span> Embeddings
                </label>
                <span class="system-hint">(Use system default)</span>
              </div>
              <div class="task-override-fields ${Nt("llm_pertask.useSystemDefaults.embeddings")!=="false"?"disabled":""}">
                <select name="embeddings_provider" class="form-control" disabled>
                  <option value="">Loading...</option>
                </select>
                <select name="embeddings_model" class="form-control" disabled>
                  <option value="">Select provider first</option>
                </select>
              </div>
            </div>
          </div>

          <div class="config-group">
            <h4>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              LLM API Keys
            </h4>
            <p class="section-intro-sm">
              Override system API keys for this project. Leave empty to use system defaults.
            </p>
            
            <div class="form-grid">
              <div class="form-field">
                <label>OpenAI API Key</label>
                <input type="password" name="openai_key" placeholder="sk-..." value="${Te(Nt("llm_config.openai_key"))}">
              </div>
              
              <div class="form-field">
                <label>Anthropic API Key</label>
                <input type="password" name="anthropic_key" placeholder="sk-ant-..." value="${Te(Nt("llm_config.anthropic_key"))}">
              </div>
              
              <div class="form-field">
                <label>Google AI API Key</label>
                <input type="password" name="google_key" placeholder="AI..." value="${Te(Nt("llm_config.google_key"))}">
              </div>
              
              <div class="form-field">
                <label>xAI (Grok) API Key</label>
                <input type="password" name="grok_key" placeholder="xai-..." value="${Te(Nt("llm_config.grok_key"))}">
              </div>
            </div>
          </div>
          
          <div class="config-group">
            <h4>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
              </svg>
              Ollama Configuration
            </h4>
            
            <div class="form-grid">
              <div class="form-field">
                <label>Ollama URL</label>
                <input type="url" name="ollama_url" placeholder="http://localhost:11434" value="${Te(Nt("ollama_config.url"))}">
              </div>
              
              <div class="form-field">
                <label>Default Model</label>
                <input type="text" name="ollama_model" placeholder="llama2, mistral, etc." value="${Te(Nt("ollama_config.model"))}">
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-sota primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  `,x2(e)}function js(){return rt.length===0?`
      <div class="empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <p>No team members yet</p>
        <button class="btn-sota primary small" id="invite-first-btn">Invite Member</button>
      </div>
    `:rt.map(e=>{const t=L2(e.display_name||e.email||"U"),n=e.role==="owner";return`
      <div class="member-card ${n?"owner":""}" data-user-id="${e.user_id}">
        <div class="member-info">
          <div class="member-avatar">
            ${e.avatar_url?`<img src="${e.avatar_url}" alt="${Te(e.display_name||"")}">`:t}
          </div>
          <div class="member-details">
            <h4>${Te(e.display_name||e.email||"Unknown")}</h4>
            <p>
              ${Te(e.email||"")}
              ${e.user_role?` • <strong>${Te(e.user_role)}</strong>`:' • <em class="member-role-muted">No role defined</em>'}
              ${e.linked_contact?` • <span class="member-link" title="Linked to contact: ${Te(e.linked_contact.name)}">🔗 ${Te(e.linked_contact.name)}</span>`:""}
            </p>
          </div>
        </div>
        <div class="member-actions">
          <button class="btn-sota secondary small edit-user-role-btn" data-user-id="${e.user_id}" title="Edit project role">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn-sota secondary small permissions-btn" data-user-id="${e.user_id}" title="Edit permissions">
            🔐
          </button>
          ${n?'<span class="role-badge owner">Owner</span>':`
              <select class="role-select member-role-select" data-user-id="${e.user_id}" title="Access level">
                <option value="admin" ${e.role==="admin"?"selected":""}>Admin</option>
                <option value="write" ${e.role==="write"?"selected":""}>Write</option>
                <option value="read" ${e.role==="read"?"selected":""}>Read</option>
              </select>
              <button class="btn-sota danger small remove-member-btn" data-user-id="${e.user_id}" title="Remove member">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            `}
        </div>
      </div>
    `}).join("")}function xu(){return An.length===0?`
      <div class="empty-state gm-grid-col-all">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
        <p>No role templates available</p>
      </div>
    `:An.map(e=>`
    <div class="role-card ${e.is_active?"active":""}" data-role-id="${e.id}">
      <div class="role-card-header">
        <div class="role-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <h4>${Te(e.display_name)}</h4>
      </div>
      <p>${Te(e.description||"No description")}</p>
      <div class="toggle-active">
        <input type="checkbox" id="role-${e.id}" ${e.is_active?"checked":""}>
        <label for="role-${e.id}">Active in this project</label>
      </div>
    </div>
  `).join("")}function Nt(e){if(!Va)return"";const t=e.split(".");let n=Va;for(const s of t)if(n&&typeof n=="object"&&s in n)n=n[s];else return"";return typeof n=="string"?n:""}function k2(e){const t=e.querySelector("#close-project-btn");t&&u(t,"click",()=>As());const n=e.querySelector("#cancel-btn");n&&u(n,"click",()=>As());const s=e.querySelector("#project-company-id");s&&Do().then(a=>{s.innerHTML='<option value="">Use default company</option>'+a.map(o=>`<option value="${o.id}">${Te(o.name)}</option>`).join("")}).catch(()=>{s.innerHTML='<option value="">Use default company</option>'});const i=e.querySelector("#project-form");i&&u(i,"submit",async a=>{a.preventDefault();const o=new FormData(i),r=o.get("company_id")?.trim()||void 0,c={name:o.get("name").trim(),description:o.get("description").trim()||void 0};r&&(c.company_id=r);const l=ku.safeParse(c);if(!l.success){h.error(l.error.issues[0].message);return}const d=i.querySelector('button[type="submit"]');d.disabled=!0,d.innerHTML='<span class="loading-spinner gm-size-4"></span> Creating...';try{const m=await p.post("/api/projects",c);c.id=m.data.id,h.success("Project created"),z.setCurrentProject({id:c.id,name:c.name,description:c.description}),dt.onSave?.(c),As(),$u()}catch{h.error("Failed to create project")}finally{d.disabled=!1,d.innerHTML=`
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Project
        `}})}function x2(e){const t=e.querySelector("#close-project-btn");t&&u(t,"click",()=>As());const n=e.querySelectorAll(".project-tab-btn");n.forEach(d=>{u(d,"click",()=>{n.forEach(f=>f.classList.remove("active")),d.classList.add("active");const m=d.getAttribute("data-tab");e.querySelectorAll(".project-section").forEach(f=>{f.classList.toggle("active",f.id===`section-${m}`)})})});const s=e.querySelector("#project-company-id");if(s){const d=wt||dt.project,m=d?.company_id??d?.company?.id;Do().then(f=>{s.innerHTML='<option value="">—</option>'+f.map(g=>`<option value="${g.id}" ${g.id===m?"selected":""}>${Te(g.name)}</option>`).join("")}).catch(()=>{s.innerHTML='<option value="">—</option>'})}const i=e.querySelector("#project-form");i&&u(i,"submit",async d=>{d.preventDefault();const m=new FormData(i),f=m.get("company_id")?.trim()||void 0,g={name:m.get("name").trim(),description:m.get("description").trim()||void 0,settings:{userRole:m.get("userRole").trim()||void 0,userRolePrompt:m.get("userRolePrompt").trim()||void 0}};f&&(g.company_id=f);const v=ku.safeParse(g);if(!v.success){h.error(v.error.issues[0].message);return}try{await p.put(`/api/projects/${wt?.id||dt.project?.id}`,g),h.success("Project updated"),dt.onSave?.({...wt,...g}),$i&&As();const y=e.querySelector(".project-title-info h2"),S=e.querySelector(".project-title-info p");y&&(y.textContent=String(g.name)),S&&(S.textContent=String(g.description||"No description"))}catch{h.error("Failed to update project")}});const a=e.querySelector("#delete-project-btn");a&&u(a,"click",async()=>{const d=wt||dt.project;if(!d?.id)return;if(await Zn(`Are you sure you want to delete "${d.name}"? This action cannot be undone.`,{title:"Delete Project",confirmText:"Delete",confirmClass:"btn-danger"}))try{await p.delete(`/api/projects/${d.id}`),h.success("Project deleted"),dt.onDelete?.(d.id),As(),z.getState().currentProjectId===d.id&&z.setCurrentProject(null),$u()}catch{h.error("Failed to delete project")}});const o=e.querySelector("#invite-member-btn"),r=e.querySelector("#invite-first-btn");[o,r].forEach(d=>{d&&u(d,"click",()=>{_2()})});const c=e.querySelector("#add-role-btn");c&&u(c,"click",()=>{$2(e)}),e.querySelectorAll(".member-role-select").forEach(d=>{u(d,"change",async()=>{const m=d.getAttribute("data-user-id"),f=d.value,g=wt?.id||dt.project?.id;if(!(!m||!g))try{await p.put(`/api/projects/${g}/members/${m}`,{role:f}),h.success("Member role updated")}catch{h.error("Failed to update role")}})}),e.querySelectorAll(".remove-member-btn").forEach(d=>{u(d,"click",async()=>{const m=d.getAttribute("data-user-id"),f=wt?.id||dt.project?.id;if(!m||!f)return;if(await Zn("Remove this member from the project?",{title:"Remove Member",confirmText:"Remove",confirmClass:"btn-danger"}))try{await p.delete(`/api/projects/${f}/members/${m}`),h.success("Member removed"),rt=rt.filter(y=>y.user_id!==m);const v=e.querySelector("#members-list");v&&(v.innerHTML=js(),Ds(e))}catch{h.error("Failed to remove member")}})});const l=e.querySelector("#config-form");l&&u(l,"submit",async d=>{d.preventDefault();const m=new FormData(l),f={llm_config:{openai_key:m.get("openai_key")||void 0,anthropic_key:m.get("anthropic_key")||void 0,google_key:m.get("google_key")||void 0,grok_key:m.get("grok_key")||void 0},ollama_config:{url:m.get("ollama_url")||void 0,model:m.get("ollama_model")||void 0}},g=wt?.id||dt.project?.id;if(g)try{await p.put(`/api/projects/${g}/config`,f),h.success("Configuration saved")}catch{h.error("Failed to save configuration")}}),Ds(e)}function Ds(e){e.querySelectorAll(".edit-user-role-btn").forEach(t=>{u(t,"click",()=>{const n=t.getAttribute("data-user-id");if(!n)return;const s=rt.find(i=>i.user_id===n);s&&S2(e,s)})}),e.querySelectorAll(".permissions-btn").forEach(t=>{u(t,"click",()=>{const n=t.getAttribute("data-user-id");if(!n)return;const s=rt.find(a=>a.user_id===n),i=wt?.id||dt.project?.id;!s||!i||Wd({projectId:i,userId:s.user_id,userName:s.display_name||"",userEmail:s.email||"",avatarUrl:s.avatar_url,currentRole:s.role,currentPermissions:s.permissions,onSave:async()=>{try{rt=(await p.get(`/api/projects/${i}/members`)).data.members||[];const o=e.querySelector("#members-list");o&&(o.innerHTML=js(),Ds(e))}catch{}}})})}),e.querySelectorAll(".member-role-select").forEach(t=>{u(t,"change",async()=>{const n=t.getAttribute("data-user-id"),s=t.value,i=wt?.id||dt.project?.id;if(!(!n||!i))try{await p.put(`/api/projects/${i}/members/${n}`,{role:s}),h.success("Access level updated")}catch{h.error("Failed to update access level")}})}),e.querySelectorAll(".remove-member-btn").forEach(t=>{u(t,"click",async()=>{const n=t.getAttribute("data-user-id"),s=wt?.id||dt.project?.id;if(!n||!s)return;if(await Zn("Remove this member from the project?",{title:"Remove Member",confirmText:"Remove",confirmClass:"btn-danger"}))try{await p.delete(`/api/projects/${s}/members/${n}`),h.success("Member removed"),rt=rt.filter(o=>o.user_id!==n);const a=e.querySelector("#members-list");a&&(a.innerHTML=js(),Ds(e))}catch{h.error("Failed to remove member")}})})}function $2(e){const t=e.querySelector(".add-role-dialog");t&&t.remove();const n=wt?.id||dt.project?.id;if(!n)return;const s=_("div",{className:"add-role-dialog"});s.innerHTML=`
    <style>
      .add-role-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        backdrop-filter: blur(4px);
      }
      
      .add-role-card {
        background: white;
        border-radius: 20px;
        width: 100%;
        max-width: 500px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        overflow: hidden;
      }
      
      [data-theme="dark"] .add-role-card {
        background: #1e293b;
      }
      
      .add-role-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 20px 24px;
        color: white;
      }
      
      .add-role-header h4 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
      }
      
      .add-role-body {
        padding: 24px;
      }
      
      .add-role-field {
        margin-bottom: 20px;
      }
      
      .add-role-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 8px;
      }
      
      .add-role-field input,
      .add-role-field textarea,
      .add-role-field select {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        box-sizing: border-box;
        background: #f8fafc;
      }
      
      [data-theme="dark"] .add-role-field input,
      [data-theme="dark"] .add-role-field textarea,
      [data-theme="dark"] .add-role-field select {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .add-role-field input:focus,
      .add-role-field textarea:focus,
      .add-role-field select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
      }
      
      .add-role-field textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .add-role-ai-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
        transition: all 0.2s;
      }
      
      .add-role-ai-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139,92,246,0.3);
      }
      
      .add-role-ai-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .add-role-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      
      [data-theme="dark"] .add-role-actions {
        border-color: rgba(255,255,255,0.1);
      }
    </style>
    
    <div class="add-role-card">
      <div class="add-role-header">
        <h4>Add New Role</h4>
      </div>
      <div class="add-role-body">
        <form id="add-role-form">
          <div class="add-role-field">
            <label>Role Name *</label>
            <input type="text" id="new-role-name" required placeholder="e.g., Senior Developer, Tech Lead">
          </div>
          
          <div class="add-role-field">
            <label>Category</label>
            <select id="new-role-category">
              <option value="project">📋 Project</option>
              <option value="technical">💻 Technical</option>
              <option value="management">👔 Management</option>
              <option value="stakeholder">🤝 Stakeholder</option>
              <option value="custom">✨ Custom</option>
            </select>
          </div>
          
          <div class="add-role-field">
            <label>Description</label>
            <input type="text" id="new-role-description" placeholder="Brief description of this role">
          </div>
          
          <div class="add-role-field">
            <label>Role Context (for AI)</label>
            <textarea id="new-role-context" placeholder="Describe this role's responsibilities, priorities, and how the AI should adapt responses..."></textarea>
            <button type="button" class="add-role-ai-btn" id="enhance-role-btn">
              ⚡ Enhance with AI
            </button>
          </div>
          
          <div class="add-role-actions">
            <button type="button" class="btn-sota secondary" id="cancel-add-role">Cancel</button>
            <button type="submit" class="btn-sota primary">Create Role</button>
          </div>
        </form>
      </div>
    </div>
  `,e.appendChild(s);const i=()=>s.remove(),a=s.querySelector("#cancel-add-role");a&&u(a,"click",i),u(s,"click",c=>{c.target===s&&i()});const o=s.querySelector("#enhance-role-btn");o&&u(o,"click",async()=>{const c=s.querySelector("#new-role-name"),l=s.querySelector("#new-role-context"),d=s.querySelector("#new-role-description"),m=c.value.trim();if(!m){h.error("Please enter a role name first");return}o.disabled=!0,o.textContent="⏳ Enhancing...";try{const f=await p.post("/api/roles/generate",{title:m,currentContext:l.value});f.data.prompt&&(l.value=f.data.prompt),f.data.description&&!d.value&&(d.value=f.data.description),h.success("Role context enhanced")}catch{h.error("Failed to enhance with AI")}finally{o.disabled=!1,o.textContent="⚡ Enhance with AI"}});const r=s.querySelector("#add-role-form");r&&u(r,"submit",async c=>{c.preventDefault();const l=s.querySelector("#new-role-name").value.trim(),d=s.querySelector("#new-role-category").value,m=s.querySelector("#new-role-description").value.trim(),f=s.querySelector("#new-role-context").value.trim();if(!l){h.error("Role name is required");return}try{await p.post("/api/role-templates",{name:l.toLowerCase().replace(/\s+/g,"_"),display_name:l,description:m,role_context:f,category:d,color:"#e11d48",is_template:!0}),h.success("Role created"),i(),await C2(n);const g=e.querySelector("#roles-grid");g&&(g.innerHTML=xu())}catch{h.error("Failed to create role")}}),setTimeout(()=>{const c=s.querySelector("#new-role-name");c&&c.focus()},100)}function S2(e,t){const n=e.querySelector(".user-role-edit-dialog");n&&n.remove();const s=wt?.id||dt.project?.id;if(!s)return;const i=_("div",{className:"user-role-edit-dialog"});i.innerHTML=`
    <style>
      .user-role-edit-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        padding: 24px;
        z-index: 10001;
        width: 400px;
        max-width: 90vw;
      }
      
      [data-theme="dark"] .user-role-edit-dialog {
        background: #1e293b;
      }
      
      .user-role-edit-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      [data-theme="dark"] .user-role-edit-dialog h3 {
        color: #f1f5f9;
      }
      
      .user-role-edit-dialog h3 svg {
        width: 20px;
        height: 20px;
        color: #e11d48;
      }
      
      .user-role-edit-dialog .form-field {
        margin-bottom: 16px;
      }
      
      .user-role-edit-dialog .form-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        margin-bottom: 6px;
      }
      
      [data-theme="dark"] .user-role-edit-dialog .form-field label {
        color: #94a3b8;
      }
      
      .user-role-edit-dialog .form-field input,
      .user-role-edit-dialog .form-field textarea,
      .user-role-edit-dialog .form-field select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        background: #f8fafc;
        color: #1e293b;
        box-sizing: border-box;
      }
      
      [data-theme="dark"] .user-role-edit-dialog .form-field input,
      [data-theme="dark"] .user-role-edit-dialog .form-field textarea,
      [data-theme="dark"] .user-role-edit-dialog .form-field select {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .user-role-edit-dialog .form-field input:focus,
      .user-role-edit-dialog .form-field textarea:focus,
      .user-role-edit-dialog .form-field select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }
      
      .user-role-edit-dialog .form-field textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .user-role-edit-dialog .form-hint {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 4px;
      }
      
      .user-role-edit-dialog .linked-contact-info {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
        border: 1px solid rgba(225,29,72,0.2);
        border-radius: 10px;
        margin-top: 8px;
      }
      
      .user-role-edit-dialog .linked-contact-info svg {
        width: 16px;
        height: 16px;
        color: #e11d48;
        flex-shrink: 0;
      }
      
      .user-role-edit-dialog .linked-contact-info span {
        font-size: 13px;
        color: #1e293b;
      }
      
      [data-theme="dark"] .user-role-edit-dialog .linked-contact-info span {
        color: #f1f5f9;
      }
      
      .user-role-edit-dialog .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      
      .user-role-edit-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 10000;
      }
    </style>
    
    <h3>
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
      Edit Project Role
    </h3>
    <p class="section-intro-last">
      Define <strong>${Te(t.display_name||t.email||"this member")}</strong>'s role in the project
    </p>
    
    <div class="form-field">
      <label>Role Title</label>
      <select id="edit-user-role">
        <option value="">-- Select a role --</option>
        ${An.filter(g=>g.is_active).map(g=>`
          <option value="${Te(g.display_name||g.name)}" 
                  data-prompt="${Te(g.prompt_template||"")}"
                  ${t.user_role===g.display_name||t.user_role===g.name?"selected":""}>
            ${Te(g.display_name||g.name)}
          </option>
        `).join("")}
        <option value="__custom__" ${t.user_role&&!An.some(g=>g.display_name===t.user_role||g.name===t.user_role)?"selected":""}>Custom role...</option>
      </select>
      <div class="form-hint">Select a predefined role or choose "Custom role" for a custom title</div>
      <input type="text" id="edit-user-role-custom" 
             value="${t.user_role&&!An.some(g=>g.display_name===t.user_role||g.name===t.user_role)?Te(t.user_role):""}" 
             placeholder="Enter custom role title"
             class="gm-mt-2 ${t.user_role&&!An.some(g=>g.display_name===t.user_role||g.name===t.user_role)?"":"hidden"}">
    </div>
    
    <div class="form-field">
      <label>Role Description</label>
      <textarea id="edit-user-role-prompt" placeholder="e.g., I manage the technical architecture and lead the development team">${Te(t.user_role_prompt||"")}</textarea>
      <div class="form-hint">Brief description of responsibilities (used for AI context)</div>
    </div>
    
    <div class="form-field">
      <label>
        <svg class="gm-inline-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        Link to Contact
      </label>
      <select id="edit-linked-contact">
        <option value="">-- No linked contact --</option>
        ${Za.map(g=>`
          <option value="${g.id}" ${t.linked_contact_id===g.id?"selected":""}>
            ${Te(g.name)}${g.organization?` (${Te(g.organization)})`:""}${g.email?` - ${Te(g.email)}`:""}
          </option>
        `).join("")}
      </select>
      <div class="form-hint">Associate this team member with a project contact</div>
      ${t.linked_contact?`
        <div class="linked-contact-info">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          <span>Currently linked to: <strong>${Te(t.linked_contact.name)}</strong></span>
        </div>
      `:""}
    </div>
    
    <div class="dialog-actions">
      <button class="btn-sota secondary" id="cancel-role-edit">Cancel</button>
      <button class="btn-sota primary" id="save-role-edit">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Save Role
      </button>
    </div>
  `;const a=_("div",{className:"user-role-edit-overlay"});document.body.appendChild(a),document.body.appendChild(i);const o=i.querySelector("#edit-user-role"),r=i.querySelector("#edit-user-role-custom"),c=i.querySelector("#edit-user-role-prompt");setTimeout(()=>o?.focus(),100),u(o,"change",()=>{const g=o.options[o.selectedIndex],v=o.value==="__custom__";r.classList.toggle("hidden",!v),v&&r.focus(),!v&&g.dataset.prompt&&(c.value=g.dataset.prompt)});const l=i.querySelector("#cancel-role-edit"),d=()=>{a.remove(),i.remove()};u(l,"click",d),u(a,"click",d);const m=i.querySelector("#save-role-edit");u(m,"click",async()=>{const g=o.value,v=g==="__custom__"?r.value.trim():g,y=i.querySelector("#edit-user-role-prompt").value.trim(),S=i.querySelector("#edit-linked-contact").value||null;try{await p.put(`/api/projects/${s}/members/${t.user_id}`,{user_role:v,user_role_prompt:y,linked_contact_id:S});const w=rt.findIndex(x=>x.user_id===t.user_id);if(w!==-1)if(rt[w].user_role=v,rt[w].user_role_prompt=y,rt[w].linked_contact_id=S||void 0,S){const x=Za.find(b=>b.id===S);x&&(rt[w].linked_contact={id:x.id,name:x.name,email:x.email,organization:x.organization,role:x.role})}else rt[w].linked_contact=void 0;const k=e.querySelector("#members-list");k&&(k.innerHTML=js(),Ds(e)),h.success("Project role updated"),d()}catch{h.error("Failed to update role")}});const f=g=>{g.key==="Escape"&&(d(),document.removeEventListener("keydown",f))};document.addEventListener("keydown",f)}async function _2(){const{showInviteModal:e}=await ve(async()=>{const{showInviteModal:n}=await Promise.resolve().then(()=>zS);return{showInviteModal:n}},void 0),t=wt?.id||dt.project?.id;t&&e({projectId:t,onInvite:async()=>{try{rt=(await p.get(`/api/projects/${t}/members`)).data.members||[];const s=document.querySelector("#members-list");s&&(s.innerHTML=js(),Ds(s.closest(".project-card")))}catch{}}})}async function $u(){try{const e=await p.get("/api/projects");ce.setProjects(e.data)}catch{}}async function C2(e){try{An=(await p.get("/api/role-templates")).data.roles||[]}catch{An=[]}}function L2(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function Te(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const CC=Object.freeze(Object.defineProperty({__proto__:null,showProjectModal:Pi},Symbol.toStringTag,{value:"Module"}));function T2(e={}){const t=e.containerId?document.getElementById(e.containerId):document.getElementById("project-selector-container");if(!t)return;t.innerHTML=`
    <div class="project-selector-wrapper">
      <select id="project-selector" class="project-selector">
        <option value="">Select Project...</option>
      </select>
      <button id="new-project-btn" class="btn-icon" title="Create new project">+</button>
      <button id="edit-project-btn" class="btn-icon hidden" title="Edit project">✏️</button>
    </div>
  `;const n=t.querySelector("#project-selector"),s=t.querySelector("#new-project-btn"),i=t.querySelector("#edit-project-btn");Zi(n),u(n,"change",async()=>{const a=n.value;a?(await Su(a,e.onProjectChange),i.classList.remove("hidden")):i.classList.add("hidden")}),u(s,"click",()=>{Pi({mode:"create",onSave:async a=>{await Zi(n),a.id&&(n.value=a.id,i.classList.remove("hidden"),e.onProjectChange?.(a.id))}})}),u(i,"click",()=>{const a=z.getState().currentProject;a&&Pi({mode:"edit",project:a,onSave:async()=>{await Zi(n)},onDelete:async()=>{await Zi(n),i.classList.add("hidden")}})}),ce.subscribe(a=>{ho(n,a.projects)}),z.subscribe(a=>{a.currentProjectId&&n.value!==a.currentProjectId&&(n.value=a.currentProjectId,i.classList.remove("hidden"))})}async function Zi(e){const t=await Vn.getAll();ho(e,t);const n=z.getState().currentProjectId;n&&(e.value=n)}function ho(e,t){const n=e.value;e.innerHTML='<option value="">Select Project...</option>',t.forEach(s=>{const i=document.createElement("option");i.value=s.id,i.textContent=s.name+(s.isDefault?" (default)":""),e.appendChild(i)}),n&&t.some(s=>s.id===n)&&(e.value=n)}async function Su(e,t){try{const n=await Vn.activate(e);n&&(h.success(`Switched to: ${n.name}`),t?.(e))}catch{h.error("Failed to switch project")}}function A2(e={}){const t=_("div",{className:"project-selector-wrapper"}),n=_("select",{className:"project-selector",id:"project-selector"}),s=_("option",{textContent:"Select Project..."});s.value="",n.appendChild(s);const i=_("button",{className:"btn-icon",textContent:"+",title:"Create new project"});return t.appendChild(n),t.appendChild(i),Vn.getAll().then(a=>{ho(n,a);const o=z.getState().currentProjectId;o&&(n.value=o)}),u(n,"change",async()=>{const a=n.value;a&&await Su(a,e.onProjectChange)}),u(i,"click",()=>{Pi({mode:"create",onSave:async a=>{const o=await Vn.getAll();ho(n,o),a.id&&(n.value=a.id,e.onProjectChange?.(a.id))}})}),t}function _u(e,t="en-US"){return new Intl.NumberFormat(t).format(e)}function Si(e,t){return(typeof e=="string"?new Date(e):e).toLocaleDateString(void 0,t)}function hs(e){return(typeof e=="string"?new Date(e):e).toLocaleString()}function Ee(e){const t=typeof e=="string"?new Date(e):e,n=new Date,s=n.getTime()-t.getTime(),i=Math.floor(s/1e3),a=Math.floor(i/60),o=Math.floor(a/60),r=Math.floor(o/24);if(s<0){const m=Math.ceil(Math.abs(s)/864e5);return m===0?"today":m===1?"tomorrow":m<7?`in ${m} days`:Si(t,{month:"short",day:"numeric"})}if(i<60)return"just now";if(a<60)return`${a} min${a===1?"":"s"} ago`;if(o<24)return`${o} hour${o===1?"":"s"} ago`;const c=new Date(n);if(c.setDate(c.getDate()-1),E2(t,c))return"yesterday";const l=M2(n);if(t>=l)return"this week";const d=new Date(l);return d.setDate(d.getDate()-7),t>=d?"last week":r<30?`${r} days ago`:t.getFullYear()===n.getFullYear()?Si(t,{month:"short",day:"numeric"}):Si(t,{year:"numeric",month:"short",day:"numeric"})}function E2(e,t){return e.getFullYear()===t.getFullYear()&&e.getMonth()===t.getMonth()&&e.getDate()===t.getDate()}function M2(e){const t=new Date(e),n=t.getDay();return t.setDate(t.getDate()-n),t.setHours(0,0,0,0),t}function Ro(e){if(e===0)return"0 B";const t=["B","KB","MB","GB","TB"],n=Math.floor(Math.log(e)/Math.log(1024));return`${(e/Math.pow(1024,n)).toFixed(n>0?1:0)} ${t[n]}`}function LC(e,t="USD",n="en-US"){return new Intl.NumberFormat(n,{style:"currency",currency:t}).format(e)}const Zt="question-modal";let mi=[];function Ri(e){const{mode:t,question:n,onSave:s,onDismiss:i}=e;mi=[];const a=document.querySelector(`[data-modal-id="${Zt}"]`);a&&a.remove();const o=_("div",{className:"question-modal-content"});t==="create"?D2(o):t==="edit"&&n?P2(o,n):n&&z2(o,n,t==="answer");const r=_("div",{className:"modal-footer"});j2(r,t,n,o,e);const c=Me({id:Zt,title:q2(t),content:o,size:"lg",footer:r});document.body.appendChild(c),qe(Zt)}function q2(e){switch(e){case"create":return"New Question";case"edit":return"Edit Question";case"answer":return"Answer Question";default:return"Question Details"}}function j2(e,t,n,s,i){const{onSave:a,onDismiss:o,onDelete:r}=i;if(t==="create"){const c=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),l=_("button",{className:"btn btn-primary",textContent:"Create Question"});u(c,"click",()=>U(Zt)),u(l,"click",()=>H2(s,a)),e.appendChild(c),e.appendChild(l)}else if(t==="edit"&&n){const c=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),l=_("button",{className:"btn btn-primary",textContent:"Save Changes"});u(c,"click",()=>U(Zt)),u(l,"click",()=>R2(s,n,a)),e.appendChild(c),e.appendChild(l)}else if(n){const c=n.status;if(c!=="resolved"&&c!=="dismissed"){const d=_("button",{className:"btn btn-secondary",textContent:"Dismiss"});if(u(d,"click",()=>O2(n.id,o)),e.appendChild(d),t==="answer"){const m=_("button",{className:"btn btn-primary",textContent:"Save Answer"});u(m,"click",()=>B2(s,n,a)),e.appendChild(m)}else{const m=_("button",{className:"btn btn-primary",textContent:"Answer"});u(m,"click",()=>{U(Zt),Ri({...i,mode:"answer"})}),e.appendChild(m)}}else if(c==="resolved"){const d=_("button",{className:"btn btn-warning",textContent:"Reopen"});u(d,"click",()=>N2(n,a)),e.appendChild(d)}const l=_("button",{className:"btn btn-secondary",textContent:"Close"});u(l,"click",()=>U(Zt)),e.appendChild(l)}}function D2(e){e.innerHTML=`
    <form id="question-form" class="question-form">
      <div class="form-group">
        <label for="question-content">Question <span class="required">*</span></label>
        <textarea id="question-content" rows="3" required minlength="5"
                  placeholder="What needs to be clarified? (min 5 characters)"></textarea>
        <div id="duplicate-warning" class="form-warning hidden"></div>
      </div>
      
      <div class="form-group">
        <label for="question-context">Context</label>
        <textarea id="question-context" rows="2"
                  placeholder="Why is this question important?"></textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="question-priority">Priority</label>
          <select id="question-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="question-assignee">Assign To</label>
          <input type="text" id="question-assignee" placeholder="Person name">
          <button type="button" id="suggest-assignee-btn" class="btn btn-sm btn-secondary">
            AI Suggest
          </button>
        </div>
      </div>
      
      <div id="suggestions-container" class="suggestions-container hidden"></div>
    </form>
  `;const t=e.querySelector("#suggest-assignee-btn");t&&u(t,"click",()=>I2(e))}function P2(e,t){e.innerHTML=`
    <form id="question-form" class="question-form">
      <div class="form-group">
        <label for="question-content">Question <span class="required">*</span></label>
        <textarea id="question-content" rows="3" required minlength="5">${qt(t.content)}</textarea>
      </div>
      
      <div class="form-group">
        <label for="question-context">Context</label>
        <textarea id="question-context" rows="2">${qt(t.context||"")}</textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="question-priority">Priority</label>
          <select id="question-priority">
            <option value="low" ${t.priority==="low"?"selected":""}>Low</option>
            <option value="medium" ${t.priority==="medium"?"selected":""}>Medium</option>
            <option value="high" ${t.priority==="high"?"selected":""}>High</option>
            <option value="critical" ${t.priority==="critical"?"selected":""}>Critical</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="question-status">Status</label>
          <select id="question-status">
            <option value="pending" ${t.status==="pending"?"selected":""}>Pending</option>
            <option value="assigned" ${t.status==="assigned"?"selected":""}>Assigned</option>
            <option value="resolved" ${t.status==="resolved"?"selected":""}>Resolved</option>
            <option value="dismissed" ${t.status==="dismissed"?"selected":""}>Dismissed</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label for="question-assignee">Assigned To</label>
        <input type="text" id="question-assignee" value="${qt(t.assigned_to||"")}">
      </div>
      
      <div class="form-group">
        <label for="question-category">Category</label>
        <input type="text" id="question-category" value="${qt(t.category||"")}">
      </div>
    </form>
  `}function z2(e,t,n){e.innerHTML=`
    <div class="question-view">
      <div class="question-meta">
        <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        <span class="status-badge status-${t.status}">${t.status}</span>
        <span class="question-date">${Ee(t.created_at)}</span>
        ${t.assigned_to?`<span class="question-assignee">→ ${qt(t.assigned_to)}</span>`:""}
      </div>
      
      <div class="question-content-large">
        ${qt(t.content)}
      </div>
      
      ${t.context?`<div class="question-context"><strong>Context:</strong> ${qt(t.context)}</div>`:""}
      ${t.category?`<div class="question-category"><strong>Category:</strong> ${qt(t.category)}</div>`:""}
      ${t.source_file?`<div class="question-source"><strong>Source:</strong> ${qt(t.source_file)}</div>`:""}
      
      ${t.answer?`
        <div class="question-answer-section">
          <h4>Answer ${t.answer_source?`<span class="answer-source">(${t.answer_source})</span>`:""}</h4>
          <div class="answer-text">${qt(t.answer)}</div>
          ${t.resolved_at?`<div class="answer-date">Resolved ${Ee(t.resolved_at)}</div>`:""}
        </div>
      `:""}
      
      ${n&&t.status!=="resolved"?`
        <div class="answer-form">
          <div class="form-group">
            <label for="question-answer">Your Answer <span class="required">*</span></label>
            <textarea id="question-answer" rows="4" required minlength="3"
                      placeholder="Provide an answer (min 3 characters)..."></textarea>
          </div>
          <div class="form-group">
            <label for="answer-source">Source</label>
            <select id="answer-source">
              <option value="manual" selected>Manual</option>
              <option value="document">From Document</option>
              <option value="ai">AI Assisted</option>
            </select>
          </div>
          <div class="form-group">
            <label for="followup-questions">Follow-up Questions (one per line)</label>
            <textarea id="followup-questions" rows="2"
                      placeholder="Add any follow-up questions..."></textarea>
          </div>
        </div>
      `:""}
      
      ${t.reopened_reason?`
        <div class="reopen-reason">
          <strong>Reopen Reason:</strong> ${qt(t.reopened_reason)}
        </div>
      `:""}
    </div>
  `}async function I2(e){const n=e.querySelector("#question-content")?.value.trim();if(!n||n.length<5){h.warning("Please enter at least 5 characters for the question");return}const s=e.querySelector("#suggestions-container"),i=e.querySelector("#suggest-assignee-btn");i.disabled=!0,i.textContent="Loading...",s.classList.remove("hidden"),s.innerHTML='<div class="loading">Getting AI suggestions...</div>';try{const a=await Ve.suggestAssignee({content:n,useAI:!0});mi=a.suggestions,mi.length===0?s.innerHTML='<div class="no-suggestions">No suggestions available</div>':(s.innerHTML=`
        <h4>AI Suggestions ${a.cached?'<span class="cached">(cached)</span>':""}</h4>
        <div class="suggestions-list">
          ${mi.map((o,r)=>`
            <div class="suggestion-item" data-index="${r}">
              <div class="suggestion-person">${qt(o.person)}</div>
              <div class="suggestion-score">${o.score}%</div>
              <div class="suggestion-reason">${qt(o.reason)}</div>
              ${o.role?`<div class="suggestion-role">${qt(o.role)}</div>`:""}
            </div>
          `).join("")}
        </div>
      `,s.querySelectorAll(".suggestion-item").forEach(o=>{u(o,"click",()=>{const r=parseInt(o.getAttribute("data-index")||"0",10),c=mi[r];if(c){const l=e.querySelector("#question-assignee");l&&(l.value=c.person),s.classList.add("hidden"),h.success(`Selected: ${c.person}`)}})}))}catch{s.innerHTML='<div class="error">Failed to get suggestions</div>'}finally{i.disabled=!1,i.textContent="AI Suggest"}}async function H2(e,t){const n=e.querySelector("#question-form");if(!n.checkValidity()){n.reportValidity();return}const s=a=>e.querySelector(`#${a}`)?.value.trim()||"",i={content:s("question-content"),priority:s("question-priority"),assigned_to:s("question-assignee")||void 0,context:s("question-context")||void 0};try{const a=await Ve.create(i);if(a.duplicate){const r=e.querySelector("#duplicate-warning");r&&(r.classList.remove("hidden"),r.innerHTML=`⚠️ Similar question exists (${a.similarity}% match). <a href="#" id="view-duplicate">View existing</a>`);return}h.success("Question created");const o={id:a.id||Date.now(),content:i.content,priority:i.priority||"medium",status:i.assigned_to?"assigned":"pending",assigned_to:i.assigned_to,context:i.context,created_at:new Date().toISOString()};t?.(o),U(Zt)}catch{}}async function R2(e,t,n){const s=i=>e.querySelector(`#${i}`)?.value.trim()||"";try{const i=await Ve.update(t.id,{content:s("question-content"),context:s("question-context")||void 0,priority:s("question-priority"),status:s("question-status"),assigned_to:s("question-assignee")||void 0,category:s("question-category")||void 0});h.success("Question updated"),n?.(i),U(Zt)}catch{}}async function B2(e,t,n){const s=e.querySelector("#question-answer"),i=e.querySelector("#answer-source"),a=e.querySelector("#followup-questions"),o=s?.value.trim(),r=i?.value||"manual",c=a?.value.trim();if(!o||o.length<3){h.warning("Please provide an answer (at least 3 characters)");return}try{const l=await Ve.answer(t.id,{answer:o,source:r,followupQuestions:c});h.success(l.message),n?.(l.question),U(Zt)}catch{}}async function O2(e,t){const{confirm:n}=await ve(async()=>{const{confirm:i}=await Promise.resolve().then(()=>vn);return{confirm:i}},void 0);if(await n("Are you sure you want to dismiss this question?",{title:"Dismiss Question",confirmText:"Dismiss"}))try{await Ve.delete(e,"dismissed"),h.success("Question dismissed"),t?.(e),U(Zt)}catch{}}async function N2(e,t){const{prompt:n}=await ve(async()=>{const{prompt:i}=await Promise.resolve().then(()=>vn);return{prompt:i}},void 0),s=await n("Why are you reopening this question?",{title:"Reopen Question",placeholder:"Enter reason..."});if(s)try{const i=await Ve.reopen(e.id,s);h.success("Question reopened"),t?.(i),U(Zt)}catch{}}function qt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}class Cu{props;question;contacts=[];container;constructor(t){this.props=t,this.question=t.question,this.container=_("div",{className:"question-detail-view"})}render(){const{question:t}=this;return this.container.innerHTML=`
      <div class="question-detail-header">
        <div class="breadcrumb">
          <a href="#" class="breadcrumb-link" id="back-to-list">Questions</a>
          <span class="breadcrumb-separator">›</span>
          <span class="breadcrumb-current">Question #${String(t.id).substring(0,8)}</span>
        </div>
        <div class="header-actions">
          ${t.sla_breached?'<span class="sla-badge breached">SLA Breached</span>':""}
          <button class="btn btn-icon" id="close-detail" title="Close">×</button>
        </div>
      </div>

      <div class="question-detail-content">
        <!-- Main Question Card -->
        <section class="detail-section question-main">
          <div class="question-badges">
            <span class="priority-badge priority-${t.priority}">${t.priority}</span>
            <span class="status-badge status-${t.status}">${t.status}</span>
            ${t.requester_role?`
              <div class="requester-badge-full" title="Question from the perspective of this role">
                <div class="requester-avatar-sm">${this.getInitials(t.requester_name||t.requester_role)}</div>
                <div class="requester-text">
                  ${t.requester_name?`<span class="requester-name-sm">${this.escapeHtml(t.requester_name)}</span>`:""}
                  <span class="requester-role-sm">${this.escapeHtml(t.requester_role)}</span>
                </div>
              </div>
            `:""}
            <span class="question-date">Created ${Ee(t.created_at)}</span>
          </div>
          <h2 class="question-text">${this.escapeHtml(t.content)}</h2>
          ${t.context?`<p class="question-context">${this.escapeHtml(t.context)}</p>`:""}
          ${this.renderEntities(t)}
        </section>

        <!-- Two-column layout -->
        <div class="detail-columns">
          <div class="detail-column-left">
            <!-- Assignment Section - SOTA Design -->
            <section class="detail-section" id="assignment-section">
              <div class="section-header-sota">
                <h3>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Assignment
                  <span class="section-subtitle">Who should answer this question?</span>
                </h3>
                <button type="button" class="btn-ai-suggest" id="ai-suggest-btn">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  AI Suggest
                </button>
              </div>
              
              <!-- Current Assignment Display -->
              <div id="current-assignment" class="current-assignment-card">
                ${this.renderAssignmentState()}
              </div>
              
              <!-- Contact Picker (hidden by default) -->
              <div id="contact-picker" class="contact-picker-sota hidden">
                <div class="picker-search">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input type="text" id="contact-search" placeholder="Search contacts..." autocomplete="off">
                </div>
                <div id="contact-list" class="contact-list-grid">
                  <div class="loading">Loading contacts...</div>
                </div>
              </div>
              
              <!-- Hidden select for form submission -->
              <select id="assignee-select" class="form-select hidden">
                <option value="">Select contact...</option>
              </select>
              
              <!-- AI Suggestions Panel -->
              <div id="suggestions-panel" class="suggestions-panel-sota hidden"></div>
            </section>

            <!-- Potential Answers Section -->
            <section class="detail-section" id="answers-section">
              <div class="section-header">
                <h3>Potential Answers</h3>
                <button class="btn btn-secondary btn-sm" id="check-answers-btn">
                  Check Knowledge Base
                </button>
              </div>
              <div id="potential-answers" class="potential-answers">
                <p class="empty-state">Click "Check Knowledge Base" to find potential answers</p>
              </div>
            </section>

            <!-- Answer Form Section -->
            <section class="detail-section" id="answer-section">
              <h3>${t.answer?"Current Answer":"Your Answer"}</h3>
              ${t.answer?this.renderExistingAnswer(t):""}
              <div class="answer-form ${t.status==="resolved"?"hidden":""}">
                <div class="form-group">
                  <textarea id="answer-input" rows="4" 
                    placeholder="Type your answer here...">${t.answer||""}</textarea>
                </div>
                <div class="form-row answer-form-row">
                  <div class="form-group source-group">
                    <label>Source</label>
                    <div class="source-options">
                      <label class="source-option ${t.answer_source==="manual"||!t.answer_source?"active":""}">
                        <input type="radio" name="answer-source" value="manual" ${t.answer_source==="manual"||!t.answer_source?"checked":""}>
                        <span class="source-icon">✏️</span>
                        <span class="source-label">Manual</span>
                      </label>
                      <label class="source-option ${t.answer_source==="document"?"active":""}">
                        <input type="radio" name="answer-source" value="document" ${t.answer_source==="document"?"checked":""}>
                        <span class="source-icon">📄</span>
                        <span class="source-label">Document</span>
                      </label>
                      <label class="source-option ${t.answer_source==="ai"?"active":""}">
                        <input type="radio" name="answer-source" value="ai" ${t.answer_source==="ai"?"checked":""}>
                        <span class="source-icon">🤖</span>
                        <span class="source-label">AI</span>
                      </label>
                    </div>
                  </div>
                  <div class="form-group answered-by-group">
                    <label>Answered By</label>
                    <div class="answered-by-picker">
                      <div id="answered-by-display" class="answered-by-display">
                        ${t.answered_by_contact_id||t.answered_by_name?`
                          <div class="answered-by-card" id="current-answerer">
                            <div class="answerer-avatar" id="answerer-avatar">${this.getInitials(t.answered_by_name||"")}</div>
                            <span class="answerer-name">${this.escapeHtml(t.answered_by_name||"Contact")}</span>
                            <button type="button" class="btn-clear-answerer" id="clear-answerer">×</button>
                          </div>
                        `:`
                          <button type="button" class="btn-select-answerer" id="show-answerer-picker">
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                            Select who answered...
                          </button>
                        `}
                      </div>
                      <!-- Hidden select for form -->
                      <select id="answered-by-contact" class="form-select hidden">
                        <option value="">Select who answered...</option>
                      </select>
                      <!-- Contact picker dropdown -->
                      <div id="answerer-picker-dropdown" class="answerer-picker-dropdown hidden">
                        <div class="picker-search-sm">
                          <input type="text" id="answerer-search" placeholder="Search contacts...">
                        </div>
                        <div id="answerer-list" class="answerer-list"></div>
                        <div class="answerer-other">
                          <input type="text" id="answerer-other-name" placeholder="Or type a name...">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="form-group">
                  <label>Follow-up Questions (one per line)</label>
                  <textarea id="followup-input" rows="2" 
                    placeholder="Add any follow-up questions..."></textarea>
                </div>
                <div class="form-actions">
                  <button class="btn btn-primary" id="save-answer-btn">
                    ${t.answer?"Update Answer":"Save Answer"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div class="detail-column-right">
            <!-- Follow-up Chain Section -->
            <section class="detail-section" id="chain-section">
              <h3>Follow-up Chain</h3>
              <div id="chain-content" class="chain-content">
                <div class="skeleton-card">
                  <div class="skeleton-text w-75"></div>
                  <div class="skeleton-text w-25"></div>
                </div>
              </div>
            </section>

            <!-- Similar Questions Section -->
            <section class="detail-section" id="similar-section">
              <h3>Similar Questions</h3>
              <div id="similar-content" class="similar-content">
                 <div class="skeleton-card">
                  <div class="skeleton-text w-100"></div>
                  <div class="skeleton-row">
                    <div class="skeleton-text w-25"></div>
                    <div class="skeleton-text w-25"></div>
                  </div>
                </div>
                <div class="skeleton-card" style="margin-top: 8px;">
                  <div class="skeleton-text w-100"></div>
                  <div class="skeleton-row">
                    <div class="skeleton-text w-25"></div>
                    <div class="skeleton-text w-25"></div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Timeline Section -->
            <section class="detail-section" id="timeline-section">
              <h3>Timeline</h3>
              <div id="timeline-content" class="timeline-content">
                <div class="skeleton-card">
                    <div class="skeleton-row">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-text w-50" style="margin-bottom:0"></div>
                    </div>
                    <div class="skeleton-text w-75" style="margin-top: 8px;"></div>
                </div>
                 <div class="skeleton-card" style="margin-top: 12px;">
                    <div class="skeleton-row">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-text w-50" style="margin-bottom:0"></div>
                    </div>
                    <div class="skeleton-text w-75" style="margin-top: 8px;"></div>
                </div>
              </div>
            </section>
          </div>
        </div>

      </div>

      <!-- Actions Bar - Outside scrollable content for proper click handling -->
      <div class="detail-actions">
        ${t.status==="resolved"||t.status==="dismissed"?`
          <button class="btn btn-warning" id="reopen-btn">Reopen</button>
        `:""}
        ${t.status==="deferred"?`
          <button class="btn btn-info" id="undefer-btn">Resume Now</button>
        `:`
          <button class="btn btn-secondary" id="defer-btn">Defer</button>
        `}
        ${t.was_useful===void 0&&t.answer?`
          <div class="feedback-buttons">
            <span class="feedback-label">Was this helpful?</span>
            <button class="btn btn-sm btn-success" id="feedback-yes">Yes</button>
            <button class="btn btn-sm btn-secondary" id="feedback-no">No</button>
          </div>
        `:""}
        <button class="btn btn-secondary" id="edit-btn">Edit</button>
        <div class="dropdown dismiss-dropdown">
          <button class="btn btn-danger" id="dismiss-btn">Dismiss ▼</button>
          <div class="dropdown-menu" id="dismiss-menu">
            <a href="#" data-reason="duplicate">Duplicate</a>
            <a href="#" data-reason="not_relevant">Not Relevant</a>
            <a href="#" data-reason="out_of_scope">Out of Scope</a>
            <a href="#" data-reason="answered_elsewhere">Answered Elsewhere</a>
            <a href="#" data-reason="no_longer_needed">No Longer Needed</a>
            <a href="#" data-reason="other">Other...</a>
          </div>
        </div>
      </div>
    `,this.bindEvents(),this.loadContacts(),this.loadChain(t.id),this.loadSimilar(t.id),this.loadTimeline(t.id),this.container}renderAssignmentState(){const{question:t}=this;return t.assigned_to?`
        <div class="assigned-contact-display">
          <div class="contact-avatar-lg" id="assigned-avatar">
            ${this.getInitials(t.assigned_to)}
          </div>
          <div class="contact-details">
            <div class="contact-name-lg">${this.escapeHtml(t.assigned_to)}</div>
            <div class="contact-role-sm" id="assigned-role">Loading...</div>
          </div>
          <button class="btn-change-assignment" id="change-assignee-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
            Change
          </button>
        </div>
      `:`
      <div class="no-assignment">
        <div class="no-assignment-icon">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </div>
        <span>No one assigned to answer</span>
        <p class="no-assignment-hint">Use AI Suggest to find the best person</p>
        <button class="btn-assign-now" id="show-picker-btn">Choose Manually</button>
      </div>
    `}renderEntities(t){const n=t.extracted_entities||[],s=t.extracted_topics||[];return n.length===0&&s.length===0?"":`<div class="question-entities">${[...n.map(a=>`<span class="entity-tag entity-${a.type}">@${a.name}</span>`),...s.map(a=>`<span class="entity-tag entity-topic">#${a.name}</span>`)].join("")}</div>`}renderExistingAnswer(t){return t.answer?`
      <div class="existing-answer">
        <div class="answer-text">${this.escapeHtml(t.answer)}</div>
        <div class="answer-meta">
          <span class="answer-source-badge">${t.answer_source||"manual"}</span>
          ${t.answered_by_name?`<span class="answered-by">by ${this.escapeHtml(t.answered_by_name)}</span>`:""}
          ${t.answered_at?`<span class="answered-date">${Ee(t.answered_at)}</span>`:""}
        </div>
        ${t.answer_provenance?this.renderProvenance(t.answer_provenance):""}
      </div>
    `:""}renderProvenance(t){return!t.sources||t.sources.length===0?"":`
      <div class="answer-provenance">
        <div class="provenance-label">Sources:</div>
        ${t.sources.map(s=>`
      <div class="provenance-source">
        <span class="source-type">${s.type}</span>
        <span class="source-content">${this.escapeHtml(s.content.substring(0,100))}...</span>
        <span class="source-confidence">${Math.round(s.confidence*100)}%</span>
      </div>
    `).join("")}
      </div>
    `}bindEvents(){const{onClose:t,onUpdate:n}=this.props,s=this.container,i=s.querySelector("#close-detail");i&&u(i,"click",t);const a=s.querySelector("#back-to-list");a&&u(a,"click",C=>{C.preventDefault(),t()});const o=s.querySelector("#ai-suggest-btn");o&&u(o,"click",()=>this.loadAISuggestions());const r=s.querySelector("#check-answers-btn");r&&u(r,"click",()=>this.checkPotentialAnswers());const c=s.querySelector("#save-answer-btn");c&&u(c,"click",()=>this.saveAnswer());const l=s.querySelector("#reopen-btn");l&&u(l,"click",()=>this.reopenQuestion());const d=s.querySelector("#dismiss-btn"),m=s.querySelector("#dismiss-menu");if(d&&m){u(d,"click",A=>{A.stopPropagation(),m.classList.toggle("show")}),m.querySelectorAll("a[data-reason]").forEach(A=>{u(A,"click",async M=>{M.preventDefault(),M.stopPropagation();const Q=A.getAttribute("data-reason");m.classList.remove("show");let q;Q==="other"&&(q=prompt("Please provide a reason for dismissing this question:")||void 0,!q)||await this.dismissQuestionWithReason(Q,q)})});const T=A=>{if(!A.target.closest(".dismiss-dropdown")&&this.container.contains(m))try{m.classList.remove("show")}catch{}};document.addEventListener("click",T)}const f=s.querySelector("#defer-btn");f&&u(f,"click",()=>this.showDeferDialog());const g=s.querySelector("#undefer-btn");g&&u(g,"click",()=>this.reopenQuestion());const v=s.querySelector("#feedback-yes"),y=s.querySelector("#feedback-no");v&&u(v,"click",()=>this.submitFeedback(!0)),y&&u(y,"click",()=>{const C=prompt("How can we improve this answer?");this.submitFeedback(!1,C||void 0)});const S=s.querySelector("#edit-btn");S&&u(S,"click",()=>{const C=s.querySelector(".answer-form");C&&(C.classList.remove("hidden"),C.querySelector("#answer-input")?.focus())}),s.querySelectorAll('input[name="answer-source"]').forEach(C=>{u(C,"change",T=>{T.target.value;const A=s.querySelector(".answer-form");A&&(A.querySelectorAll(".source-option").forEach(M=>M.classList.remove("active")),T.target.closest(".source-option")?.classList.add("active"))})});const k=s.querySelector("#show-answerer-picker"),x=s.querySelector("#clear-answerer"),b=s.querySelector("#answerer-picker-dropdown");if(k&&b){u(k,"click",A=>{A.stopPropagation(),b.classList.toggle("hidden");const M=b.querySelector("#answerer-search");M&&M.focus();const Q=b.querySelector("#answerer-list");Q&&!Q.hasChildNodes()&&(Q.innerHTML=this.contacts.map(q=>`
             <div class="picker-item" data-id="${q.id}" data-name="${this.escapeHtml(q.name)}">
               <div class="picker-avatar">${this.getInitials(q.name)}</div>
               <div class="picker-name">${this.escapeHtml(q.name)}</div>
             </div>
           `).join(""),Q.querySelectorAll(".picker-item").forEach(q=>{u(q,"click",()=>{const V=q.getAttribute("data-id"),I=q.getAttribute("data-name");this.setAnsweredBy(V||void 0,I||void 0),b.classList.add("hidden")})}))});const C=b.querySelector("#answerer-search");C&&u(C,"input",A=>{const M=A.target.value.toLowerCase(),Q=b.querySelector("#answerer-list");Q&&Q.querySelectorAll(".picker-item").forEach(q=>{const V=q.getAttribute("data-name")?.toLowerCase()||"";q.style.display=V.includes(M)?"flex":"none"})});const T=b.querySelector("#answerer-other-name");T&&u(T,"keydown",A=>{if(A.key==="Enter"){A.preventDefault();const M=A.target.value.trim();M&&(this.setAnsweredBy(void 0,M),b.classList.add("hidden"))}}),document.addEventListener("click",A=>{b&&!b.classList.contains("hidden")&&!A.target.closest(".answered-by-picker")&&b.classList.add("hidden")})}x&&u(x,"click",()=>{this.setAnsweredBy(void 0,void 0)})}setAnsweredBy(t,n){const s=this.container.querySelector("#answered-by-display"),i=this.container.querySelector("#answered-by-contact");if(i&&(i.value=t||"",i.setAttribute("data-name",n||"")),s)if(t||n){s.innerHTML=`
          <div class="answered-by-card" id="current-answerer">
            <div class="answerer-avatar" id="answerer-avatar">${this.getInitials(n||"")}</div>
            <span class="answerer-name">${this.escapeHtml(n||"Contact")}</span>
            <button type="button" class="btn-clear-answerer" id="clear-answerer">×</button>
          </div>
        `;const a=s.querySelector("#clear-answerer");a&&u(a,"click",()=>this.setAnsweredBy(void 0,void 0))}else{s.innerHTML=`
          <button type="button" class="btn-select-answerer" id="show-answerer-picker">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            Select who answered...
          </button>
        `;const a=s.querySelector("#show-answerer-picker"),o=this.container.querySelector("#answerer-picker-dropdown");a&&o&&u(a,"click",r=>{r.stopPropagation(),o.classList.toggle("hidden");const c=o.querySelector("#answerer-search");c&&c.focus()})}}async submitFeedback(t,n){try{await Ve.submitAnswerFeedback(this.question.id,t,n),h.success("Feedback submitted");const s=this.container.querySelector(".feedback-buttons");s&&(s.innerHTML='<span class="feedback-submitted">Thank you for your feedback!</span>')}catch{h.error("Failed to submit feedback")}}async loadContacts(){try{const t=await Je.getAll();this.contacts=t?.contacts||[],this.renderAssignmentState()}catch(t){console.error("Error loading contacts",t)}}getInitials(t){if(!t)return"?";const n=t.trim().split(/\s+/);return n.length===1?n[0].substring(0,2).toUpperCase():(n[0][0]+n[n.length-1][0]).toUpperCase()}escapeHtml(t){return t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}async loadChain(t){const n=this.container.querySelector("#chain-content");if(n)try{const s=await p.get(`/api/questions/${t}/chain`);if(!this.container.isConnected)return;const{parent:i,children:a}=s.data;if(!i&&a.length===0){n.innerHTML='<p class="empty-state">No follow-up chain</p>';return}let o="";i&&(o+=`
          <div class="chain-item chain-parent" data-id="${i.id}">
            <span class="chain-arrow">←</span>
            <span class="chain-label">Parent:</span>
            <span class="chain-content">${this.escapeHtml(i.content.substring(0,50))}...</span>
            <span class="status-badge status-${i.status}">${i.status}</span>
          </div>
        `),o+='<div class="chain-item chain-current">This question</div>';for(const r of a)o+=`
          <div class="chain-item chain-child" data-id="${r.id}">
            <span class="chain-arrow">→</span>
            <span class="chain-content">${this.escapeHtml(r.content.substring(0,50))}...</span>
            <span class="status-badge status-${r.status}">${r.status}</span>
          </div>
        `;n.innerHTML=o,n.querySelectorAll(".chain-item[data-id]").forEach(r=>{u(r,"click",()=>{const c=r.getAttribute("data-id");c&&this.props.onNavigateToQuestion&&this.props.onNavigateToQuestion(c)})})}catch{n.innerHTML='<p class="error">Failed to load chain</p>'}}async loadSimilar(t){const n=this.container.querySelector("#similar-content");if(n)try{const s=await p.get(`/api/questions/${t}/similar?limit=5`);if(!this.container.isConnected)return;const{similar:i}=s.data;if(!i||i.length===0){n.innerHTML='<p class="empty-state">No similar questions found</p>';return}const a=i.map(o=>`
        <div class="similar-item" data-id="${o.id}">
          <div class="similar-content">${this.escapeHtml(o.content.substring(0,60))}...</div>
          <div class="similar-meta">
            <span class="status-badge status-${o.status}">${o.status}</span>
            <span class="similarity-score">${Math.round(o.similarityScore*100)}%</span>
          </div>
        </div>
      `).join("");n.innerHTML=a,n.querySelectorAll(".similar-item").forEach(o=>{u(o,"click",()=>{const r=o.getAttribute("data-id");r&&this.props.onNavigateToQuestion&&this.props.onNavigateToQuestion(r)})})}catch{n.innerHTML='<p class="error">Failed to load similar questions</p>'}}async loadTimeline(t){const n=this.container.querySelector("#timeline-content");if(n)try{const s=await p.get(`/api/questions/${t}/timeline`);if(!this.container.isConnected)return;const{events:i}=s.data;if(!i||i.length===0){n.innerHTML='<p class="empty-state">No events recorded</p>';return}const a=i.map(o=>{const r=this.getEventIcon(o.event_type),c=this.getEventDescription(o);return`
          <div class="timeline-item">
            <div class="timeline-icon">${r}</div>
            <div class="timeline-content">
              <div class="timeline-title">${c}</div>
              <div class="timeline-date">${hs(o.created_at)}</div>
            </div>
          </div>
        `}).join("");n.innerHTML=`<div class="timeline-list">${a}</div>`}catch{n.innerHTML='<p class="error">Failed to load timeline</p>'}}getEventIcon(t){return{created:"📝",assigned:"👤",answered:"✅",priority_changed:"🔺",status_changed:"🔄",reopened:"🔓",dismissed:"❌",sla_breached:"⏰",entity_extracted:"🏷️",similar_linked:"🔗"}[t]||"•"}getEventDescription(t){const n=t.event_data||{};switch(t.event_type){case"created":return`Created${t.actor_name?` by ${t.actor_name}`:""}`;case"assigned":return`Assigned to ${n.to||"someone"}${t.actor_name?` by ${t.actor_name}`:""}`;case"answered":return`Answered${t.actor_name?` by ${t.actor_name}`:""} (${n.source||"manual"})`;case"priority_changed":return`Priority changed: ${n.from} → ${n.to}`;case"status_changed":return`Status changed: ${n.from} → ${n.to}`;case"reopened":return`Reopened${t.actor_name?` by ${t.actor_name}`:""}`;case"dismissed":return`Dismissed${t.actor_name?` by ${t.actor_name}`:""}`;case"sla_breached":return"SLA breached";case"entity_extracted":return`Entities extracted: ${n.entities?.length||0}`;default:return t.event_type}}async loadAISuggestions(){const t=this.container.querySelector("#suggestions-panel"),n=this.container.querySelector("#ai-suggest-btn");if(!(!t||!this.question)){n.disabled=!0,n.innerHTML=`
      <svg class="spin" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Analyzing...
    `,t.classList.remove("hidden"),t.innerHTML=`
      <div class="suggestions-loading">
        <div class="ai-thinking-animation">
          <span></span><span></span><span></span>
        </div>
        <div class="loading-text">AI is analyzing question context and team expertise...</div>
      </div>
    `;try{const s=await Ve.suggestAssignee({id:this.question.id,useAI:!0});if(!this.container.isConnected)return;if(s.suggestions.length===0){t.innerHTML=`
          <div class="no-suggestions">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="no-suggestions-text">No matching experts found</div>
            <button class="btn-show-all-contacts" id="show-all-btn">Browse all contacts</button>
          </div>
        `;const i=t.querySelector("#show-all-btn");i&&u(i,"click",()=>{t.classList.add("hidden");const a=this.container.querySelector("#contact-picker");a&&a.classList.remove("hidden")})}else{t.innerHTML=`
          <div class="suggestions-header-sota">
            <div class="ai-badge">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              AI Recommended
            </div>
            ${s.cached?'<span class="cached-tag">Cached</span>':'<span class="fresh-tag">Fresh</span>'}
          </div>
          <div class="suggestions-list-sota">
            ${s.suggestions.map((a,o)=>{const r=this.contacts.find(m=>(m.name||"").trim().toLowerCase()===(a.person||"").trim().toLowerCase())||this.contacts.find(m=>(m.aliases||[]).some(f=>String(f).trim().toLowerCase()===(a.person||"").trim().toLowerCase())),c=r?.photoUrl||r?.avatarUrl||r?.photo_url||r?.avatar_url,l=r?.role??a.role??"",d=this.getScoreColor(a.score);return`
                <div class="suggestion-card-sota" data-index="${o}">
                  <div class="suggestion-rank">#${o+1}</div>
                  <div class="suggestion-avatar-sota">
                    ${c?`<img src="${c}" alt="${this.escapeHtml(a.person)}" onerror="this.parentElement.innerHTML='${this.getInitials(a.person)}'">`:this.getInitials(a.person)}
                  </div>
                  <div class="suggestion-info-sota">
                    <div class="suggestion-name-sota">${this.escapeHtml(a.person)}</div>
                    ${l?`<div class="suggestion-role-sota">${this.escapeHtml(l)}</div>`:""}
                    <div class="suggestion-reason-sota">${this.escapeHtml(a.reason)}</div>
                  </div>
                  <div class="suggestion-score-sota" style="--score-color: ${d}">
                    <div class="score-ring">
                      <svg viewBox="0 0 36 36">
                        <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                        <path class="score-fill" stroke-dasharray="${a.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      </svg>
                      <div class="score-value">${a.score}%</div>
                    </div>
                    <div class="score-label">Match</div>
                  </div>
                  <button class="btn-select-suggestion">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Assign
                  </button>
                </div>
              `}).join("")}
          </div>
          <div class="suggestions-footer">
            <button class="btn-link" id="hide-suggestions-btn">Close suggestions</button>
          </div>
        `,t.querySelectorAll(".suggestion-card-sota").forEach(a=>{const o=a.querySelector(".btn-select-suggestion");o&&u(o,"click",async r=>{r.stopPropagation();const c=parseInt(a.getAttribute("data-index")||"0"),l=s.suggestions[c];if(l&&this.question){const d=this.container.querySelector("#assignee-select"),m=this.contacts.find(y=>y.name===l.person),f=this.question.assigned_to,g=this.question.status;this.question.assigned_to=l.person,this.question.status="assigned",m&&d&&(d.value=m.id);const v=this.container.querySelector("#current-assignment");v&&(v.innerHTML=this.renderAssignmentState()),this.bindPickerButtons(),t.classList.add("hidden");try{await Ve.update(this.question.id,{assigned_to:l.person,status:"assigned"}),h.success(`Assigned to ${l.person}`)}catch(y){if(console.error("[QuestionDetail] Failed to save AI suggestion assignment:",y),this.question.assigned_to=f,this.question.status=g,d&&f){const S=this.contacts.find(w=>w.name===f);S&&(d.value=S.id)}v&&(v.innerHTML=this.renderAssignmentState()),this.bindPickerButtons(),h.error("Failed to save assignment. Reverted changes.")}}})});const i=t.querySelector("#hide-suggestions-btn");i&&u(i,"click",()=>{t.classList.add("hidden")})}}catch(s){const a=(r=>r.message==="Request timed out"||r.status===0)(s);t.innerHTML=`
        <div class="suggestions-error">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>${a?"This took longer than expected.":"Failed to get AI suggestions."}</div>
          ${a?'<p class="suggestions-error-hint">You can try again (suggestions may be ready) or choose someone manually.</p>':""}
          <button class="btn-retry" id="retry-suggestions-btn">Try Again</button>
        </div>
      `;const o=t.querySelector("#retry-suggestions-btn");o&&u(o,"click",()=>this.loadAISuggestions())}finally{n&&(n.disabled=!1,n.innerHTML=`
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          AI Suggest
        `)}}}getScoreColor(t){return t>=75?"#10b981":t>=50?"#f59e0b":"#6b7280"}bindPickerButtons(){const t=this.container,n=t.querySelector("#show-picker-btn"),s=t.querySelector("#change-assignee-btn"),i=t.querySelector("#contact-picker");n&&i&&u(n,"click",()=>{i.classList.toggle("hidden");const a=i.querySelector("#contact-search");a&&a.focus()}),s&&i&&u(s,"click",()=>{i.classList.toggle("hidden");const a=i.querySelector("#contact-search");a&&a.focus()})}async checkPotentialAnswers(){const t=this.container.querySelector("#potential-answers");if(t){t.innerHTML='<div class="loading">Searching knowledge base...</div>';try{const n=`${this.question.content} ${this.question.context||""}`.trim().substring(0,100),s=await ve(()=>Promise.resolve().then(()=>iy),void 0).then(o=>o.factsService.getAll());if(!this.container.isConnected)return;const a=(s.facts||[]).filter(o=>o.content.toLowerCase().includes(this.question.content.toLowerCase())||this.question.content.toLowerCase().includes(o.content.toLowerCase())).slice(0,3);if(a.length===0){t.innerHTML='<p class="empty-state">No direct matches found in knowledge base.</p>';return}t.innerHTML=a.map(o=>`
         <div class="potential-answer-card">
           <div class="answer-content">${this.escapeHtml(o.content)}</div>
           <div class="answer-meta">
             <span class="badg badge-fact">Fact</span>
             <span class="confidence">Confidence: ${Math.round((o.confidence||.8)*100)}%</span>
             <button class="btn-use-answer" data-content="${this.escapeHtml(o.content)}">Use this</button>
           </div>
         </div>
       `).join(""),t.querySelectorAll(".btn-use-answer").forEach(o=>{u(o,"click",()=>{const r=o.getAttribute("data-content"),c=this.container.querySelector("#answer-input");c&&r&&(c.value=r,c.focus())})})}catch{t.innerHTML='<p class="error">Failed to check answers</p>'}}}async saveAnswer(){const n=this.container.querySelector("#answer-input")?.value.trim();if(!n){h.error("Please enter an answer");return}const s=this.container.querySelector("#save-answer-btn");s&&(s.disabled=!0,s.textContent="Saving...");const a=this.container.querySelector('input[name="answer-source"]:checked')?.value||"manual",o=this.container.querySelector("#answered-by-contact"),r=o?.value,c=o?.getAttribute("data-name"),d=this.container.querySelector("#followup-input")?.value.trim(),m={...this.question};this.question.answer=n,this.render();try{const f=await Ve.answer(this.question.id,{answer:n,source:a,answeredByContactId:r||void 0,answeredByName:c||void 0,followupQuestions:d});if(!this.container.isConnected)return;if(f.success)h.success("Answer saved successfully"),this.question=f.question,this.props.onUpdate&&this.props.onUpdate(f.question),this.render();else throw new Error(f.message||"Failed to save answer")}catch(f){console.error("Save answer error:",f),h.error("Error saving answer. restoring..."),this.question=m,this.render(),setTimeout(()=>{const g=this.container.querySelector("#answer-input");g&&(g.value=n)},0)}}async reopenQuestion(){if(confirm("Are you sure you want to reopen this question?"))try{const t=await Ve.reopen(this.question.id,"Manually reopened");if(!this.container.isConnected)return;h.success("Question reopened"),this.question=t,this.props.onUpdate&&this.props.onUpdate(t),this.render()}catch{h.error("Failed to reopen question")}}async dismissQuestionWithReason(t,n){try{const s=await Ve.dismissQuestion(this.question.id,t,n);if(!this.container.isConnected)return;h.success("Question dismissed"),this.question=s,this.props.onUpdate&&this.props.onUpdate(s),this.props.onClose()}catch{h.error("Failed to dismiss")}}async showDeferDialog(){const t=prompt("Defer until (YYYY-MM-DD):",new Date(Date.now()+864e5).toISOString().split("T")[0]);if(!t)return;const n=prompt("Reason for deferring (optional):")||void 0;try{const s=await Ve.deferQuestion(this.question.id,t,n);if(!this.container.isConnected)return;h.success("Question deferred"),this.question=s,this.props.onUpdate&&this.props.onUpdate(s),this.props.onClose()}catch{h.error("Failed to defer question")}}}function qr(e){return new Cu(e).render()}const U2=Object.freeze(Object.defineProperty({__proto__:null,QuestionDetailView:Cu,createQuestionDetailView:qr},Symbol.toStringTag,{value:"Module"}));let as="all",gi="status";function Lu(e={}){const t=_("div",{className:"sot-panel questions-panel"});t.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Questions</h2>
        <span class="panel-count" id="questions-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="questions-filter" class="filter-select">
          <option value="all">All Active</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="critical">Critical Priority</option>
          <option value="overdue">Overdue (SLA)</option>
          <option value="resolved">✓ Resolved</option>
          <option value="dismissed">✗ Dismissed</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="status">By Status</button>
          <button class="view-tab" data-view="person">By Person</button>
          <button class="view-tab" data-view="team">By Team</button>
        </div>
        <button class="btn btn-secondary btn-sm" id="generate-team-btn" title="Generate questions for team based on roles">⚡ Generate</button>
        <button class="btn btn-primary btn-sm" id="add-question-btn">+ Add</button>
      </div>
    </div>
    <div class="panel-content" id="questions-content">
      <div class="loading">Loading questions...</div>
    </div>
  `;const n=t.querySelector("#questions-filter");u(n,"change",()=>{as=n.value,Nn(t,e)});const s=t.querySelectorAll(".view-tab");s.forEach(o=>{u(o,"click",()=>{s.forEach(r=>r.classList.remove("active")),o.classList.add("active"),gi=o.getAttribute("data-view"),Nn(t,e)})});const i=t.querySelector("#add-question-btn");i&&u(i,"click",()=>{Ri({mode:"create",onSave:()=>Nn(t,e)})});const a=t.querySelector("#generate-team-btn");return a&&u(a,"click",()=>Z2(t,e)),Nn(t,e),ce.subscribe(()=>{Mu(t)}),t}async function Nn(e,t){const n=e.querySelector("#questions-content");n.innerHTML='<div class="loading">Loading...</div>';try{let s=[];if(gi==="status")as==="overdue"?(s=await Ve.getAll(),s=s.filter(i=>i.sla_breached===!0||i.status!=="resolved"&&i.status!=="dismissed"&&F2(i))):as==="critical"?(s=await Ve.getAll(),s=s.filter(i=>i.priority==="critical"&&i.status!=="resolved"&&i.status!=="dismissed")):as==="all"?(s=await Ve.getAll(),s=s.filter(i=>i.status!=="dismissed"&&i.status!=="resolved"&&i.status!=="closed")):as==="dismissed"?(s=await Ve.getAll(),s=s.filter(i=>i.status==="dismissed")):as==="resolved"?(s=await Ve.getAll(),s=s.filter(i=>i.status==="resolved"||i.status==="answered")):(s=await Ve.getAll(),s=s.filter(i=>i.status===as)),V2(n,s,t);else if(gi==="person"){const i=await Ve.getByPerson();nl(n,i,t)}else if(gi==="team"){const i=await Ve.getByTeam();nl(n,i,t)}gi==="status"&&ce.setQuestions(s),Mu(e)}catch{n.innerHTML='<div class="error">Failed to load questions</div>'}}function F2(e){if(!e.created_at)return!1;const t=e.sla_hours||168,n=new Date(e.created_at),s=new Date(n.getTime()+t*60*60*1e3);return new Date>s}function V2(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No questions found</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Question</button>
      </div>
    `;const s=e.querySelector("#empty-add-btn");s&&u(s,"click",()=>{Ri({mode:"create"})});return}e.innerHTML=t.map(s=>Tu(s)).join(""),Au(e,t,n)}function nl(e,t,n){const s=Object.entries(t);if(s.length===0){e.innerHTML='<div class="empty-state"><p>No questions found</p></div>';return}e.innerHTML=s.map(([a,o])=>`
    <div class="question-group">
      <div class="group-header">
        <h3>${mn(a)}</h3>
        <span class="group-count">${o.length}</span>
      </div>
      <div class="group-items">
        ${o.map(r=>Tu(r)).join("")}
      </div>
    </div>
  `).join("");const i=s.flatMap(([,a])=>a);Au(e,i,n)}function Tu(e){const t=`priority-${e.priority}`,n=`status-${e.status}`,s=e.sla_breached,i=e.answer_source==="auto-detected",a=!!e.answer,o=!!e.requester_role,r=f=>{if(!f)return"?";const g=f.trim().split(/\s+/);return g.length===1?g[0].substring(0,2).toUpperCase():(g[0][0]+g[g.length-1][0]).toUpperCase()};let c=`<div class="question-card-sota${s?" sla-breached":""}${a?" has-answer":""}" data-id="${e.id}">`;c+=`<div class="card-priority-bar ${t}"></div>`,c+='<div class="card-body">',c+='<div class="card-top-row">',c+='<div class="card-badges">',c+=`<span class="priority-pill ${t}">${e.priority}</span>`,c+=`<span class="status-pill ${n}">${e.status}</span>`,s&&(c+='<span class="sla-pill">SLA</span>'),i&&(c+='<span class="auto-pill">Answer Found</span>'),e.follow_up_to&&(c+='<span class="followup-pill">Follow-up</span>'),c+="</div>",c+=`<span class="card-timestamp">${Ee(e.created_at)}</span>`,c+="</div>",c+=`<div class="card-question-text">${mn(e.content)}</div>`,c+='<div class="card-bottom-row">';const l=ce.getState().contacts||[],d=(f,g)=>{const v=g?l.find(y=>y.id===g):l.find(y=>y.name===f);return v?.photoUrl||v?.avatarUrl||v?.photo_url||v?.avatar_url||null},m=(f,g,v)=>g?`<div class="${v}"><img src="${g}" alt="${mn(f)}" onerror="this.parentElement.innerHTML='${r(f)}'"></div>`:`<div class="${v}">${r(f)}</div>`;if(c+='<div class="card-requester">',o){const f=e.requester_name||"",g=e.requester_role||"",v=e.requester_contact_id,y=d(f,v);c+='<div class="requester-chip">',c+=m(f||g,y,"requester-avatar"),c+='<div class="requester-info">',f&&(c+=`<span class="requester-name">${mn(f)}</span>`),c+=`<span class="requester-role">${mn(g)}</span>`,c+="</div>",c+="</div>"}if(c+="</div>",c+='<div class="card-assignment">',e.assigned_to){const f=d(e.assigned_to);c+='<div class="assignee-chip">',c+=m(e.assigned_to,f,"assignee-avatar"),c+='<div class="assignee-info">',c+=`<span class="assignee-name">${mn(e.assigned_to)}</span>`,a&&(c+='<span class="answered-badge">Answered</span>'),c+="</div>",c+="</div>"}else c+='<div class="unassigned-chip">',c+="<span>Unassigned</span>",c+="</div>";return c+="</div>",c+="</div>",c+="</div>",c+="</div>",c}function Au(e,t,n){e.querySelectorAll(".question-card-sota").forEach(s=>{u(s,"click",()=>{const i=s.getAttribute("data-id"),a=t.find(o=>String(o.id)===i);a&&(n.onQuestionClick?n.onQuestionClick(a):n.useDetailView&&n.containerElement?Eu(a,n):Ri({mode:"view",question:a,onSave:()=>Nn(e.closest(".questions-panel"),n)}))})})}function Eu(e,t){const n=t.containerElement;if(!n)return;const s=n.innerHTML,i=qr({question:e,onClose:()=>{n.innerHTML=s;const a=n.querySelector(".questions-panel");a&&Nn(a,t)},onUpdate:a=>{if(a.status==="dismissed"||a.status==="resolved"||a.status==="closed"){n.innerHTML=s;const o=n.querySelector(".questions-panel");o&&Nn(o,t),h.info("Question updated - returning to list")}},onNavigateToQuestion:async a=>{try{const r=(await Ve.getAll()).find(c=>String(c.id)===a);r&&Eu(r,t)}catch{h.error("Failed to load question")}}});n.innerHTML="",n.appendChild(i)}async function Z2(e,t){const n=document.createElement("div");n.className="modal open",n.id="generate-ai-modal",n.innerHTML=`
    <div class="modal-backdrop"></div>
    <div class="modal-container modal-sota modal-sota-relative">
      <!-- Header -->
      <div class="sota-header header-primary">
        <div class="header-row">
          <div class="header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/>
            </svg>
          </div>
          <div class="header-text">
            <h2>AI Question Generator</h2>
            <p>Generate contextual questions for your project team</p>
          </div>
        </div>
        <button class="header-close" id="close-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="sota-tabs">
        <button class="sota-tab active" data-source="team">
          <span class="tab-icon">👥</span>
          <span>Team Members</span>
        </button>
        <button class="sota-tab" data-source="contacts">
          <span class="tab-icon">📇</span>
          <span>Project Contacts</span>
        </button>
      </div>

      <!-- Body -->
      <div class="sota-body">
        <!-- Section: Roles -->
        <div class="sota-section">
          <div class="section-title">
            <span class="title-icon">🎭</span>
            <span>Select a Role</span>
          </div>
          <div id="roles-grid" class="sota-grid">
            <div class="sota-loading">
              <div class="spinner-ring"></div>
              <p>Loading roles...</p>
            </div>
          </div>
        </div>

        <!-- Section: Configuration (hidden until role selected) -->
        <div class="sota-section hidden" id="config-section">
          <div id="selected-badge"></div>
          
          <div class="config-row">
            <label>Questions to generate</label>
            <div class="config-buttons">
              <button class="config-btn active" data-count="auto" title="AI determines optimal count">✨ Auto</button>
              <button class="config-btn" data-count="3">3</button>
              <button class="config-btn" data-count="5">5</button>
              <button class="config-btn" data-count="8">8</button>
            </div>
          </div>

          <label class="toggle-row">
            <input type="checkbox" id="use-context" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span>Use project context (facts, documents)</span>
          </label>
          
          <label class="toggle-row">
            <input type="checkbox" id="skip-dupes" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span>Skip duplicate questions</span>
          </label>

          <button class="sota-btn-primary sota-btn-mt" id="btn-generate">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Generate Questions
          </button>
        </div>
      </div>

      <!-- Overlay for generation -->
      <div class="sota-overlay hidden" id="gen-overlay">
        <div id="gen-content">
          <div class="overlay-spinner"></div>
          <h4 class="overlay-title">Generating questions...</h4>
          <p class="overlay-subtitle">AI is analyzing your project context</p>
        </div>
      </div>
    </div>
  `,document.body.appendChild(n);let s="team",i=null,a=[],o="auto";const r=n.querySelector("#roles-grid"),c=n.querySelector("#config-section"),l=n.querySelector("#selected-badge"),d=n.querySelector("#gen-overlay"),m=n.querySelector("#gen-content"),f=w=>w?w.split(" ").map(k=>k[0]).join("").substring(0,2).toUpperCase():"?",g=w=>{const k=w.toLowerCase();return k.includes("analyst")||k.includes("data")?"📊":k.includes("manager")||k.includes("lead")?"👔":k.includes("developer")||k.includes("engineer")?"💻":k.includes("design")||k.includes("ux")?"🎨":k.includes("product")||k.includes("owner")?"📦":k.includes("qa")||k.includes("test")?"🧪":k.includes("support")||k.includes("success")?"🤝":k.includes("sales")||k.includes("commercial")?"💰":k.includes("marketing")?"📣":k.includes("security")?"🔒":k.includes("devops")||k.includes("infra")?"🚀":k.includes("legal")?"⚖️":"👤"},v=async w=>{r.innerHTML='<div class="sota-loading"><div class="spinner-ring"></div><p>Loading roles...</p></div>',c.classList.add("hidden"),i=null;try{let k=[];if(w==="team")k=(await p.get("/api/questions/team-roles")).data.roles||[];else{const b=(await p.get("/api/contacts")).data.contacts||[],C={};for(const T of b)T.role&&(C[T.role]||(C[T.role]={role:T.role,members:[]}),C[T.role].members.push({id:T.id,name:T.name,photoUrl:T.photo_url,email:T.email}));k=Object.values(C)}if(a=k,k.length===0){r.innerHTML=`
          <div class="sota-empty sota-empty-full">
            <div class="empty-icon">${w==="team"?"👥":"📇"}</div>
            <h4>No ${w==="team"?"Team Members":"Contacts"} with Roles</h4>
            <p>${w==="team"?"Add team members with roles in Project Settings":"Add contacts with roles to this project"}</p>
          </div>
        `;return}r.innerHTML=k.map((x,b)=>`
        <div class="sota-card" data-idx="${b}">
          <div class="card-icon">${g(x.role)}</div>
          <div class="card-title">${mn(x.role)}</div>
          <div class="card-avatars">
            ${x.members.slice(0,3).map(C=>`
              <div class="mini-avatar" title="${mn(C.name)}">
                ${C.photoUrl?`<img src="${C.photoUrl}" alt="" class="mini-avatar-img" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')">`:""}
                <span class="avatar-fallback${C.photoUrl?" hidden":""}">${f(C.name)}</span>
              </div>
            `).join("")}
            ${x.members.length>3?`<div class="mini-avatar more">+${x.members.length-3}</div>`:""}
          </div>
          <div class="card-subtitle">${x.members.map(C=>C.name).slice(0,2).join(", ")}${x.members.length>2?"...":""}</div>
          <div class="card-badge">${x.members.length}</div>
        </div>
      `).join(""),r.querySelectorAll(".sota-card").forEach(x=>{x.addEventListener("click",()=>{r.querySelectorAll(".sota-card").forEach(C=>C.classList.remove("selected")),x.classList.add("selected");const b=parseInt(x.getAttribute("data-idx")||"0",10);i=a[b],y()})})}catch{r.innerHTML=`
        <div class="sota-empty sota-empty-full">
          <div class="empty-icon">⚠️</div>
          <h4>Failed to Load</h4>
          <p>Could not fetch roles. Please try again.</p>
          <button class="sota-btn-primary sota-btn-retry" id="retry-load">Retry</button>
        </div>
      `,n.querySelector("#retry-load")?.addEventListener("click",()=>v(w))}},y=()=>{i&&(c.classList.remove("hidden"),l.innerHTML=`
      <div class="selected-badge">
        <span class="badge-icon">${g(i.role)}</span>
        <div class="badge-info">
          <strong>${mn(i.role)}</strong>
          <span>${i.members.map(w=>w.name).join(", ")}</span>
        </div>
        <button class="badge-clear" id="clear-selection">×</button>
      </div>
    `,n.querySelector("#clear-selection")?.addEventListener("click",()=>{i=null,c.classList.add("hidden"),r.querySelectorAll(".sota-card").forEach(w=>w.classList.remove("selected"))}))},S=async()=>{if(i){d.classList.remove("hidden");try{const w=await p.post("/api/questions/generate-ai",{role:i.role,memberIds:i.members.map(x=>x.id),count:o,includeContext:n.querySelector("#use-context")?.checked??!0,skipDuplicates:n.querySelector("#skip-dupes")?.checked??!0}),k=w.data.questions||[];m.innerHTML=`
        <div class="sota-success">
          <div class="success-icon">✓</div>
          <h4>${w.data.generated} Questions Generated</h4>
          <p>${w.data.skipped>0?`${w.data.skipped} duplicates skipped`:"All questions created successfully"}</p>
        </div>
        <div class="results-list">
          ${k.slice(0,5).map(x=>`
            <div class="result-row">
              <span class="result-badge ${x.priority}">${x.priority}</span>
              <span class="result-text">${mn(x.content.length>70?x.content.substring(0,70)+"...":x.content)}</span>
            </div>
          `).join("")}
          ${k.length>5?`<p class="sota-more-hint">+ ${k.length-5} more questions</p>`:""}
        </div>
        <p class="sota-questions-footer">
          📋 Questions from <strong>${i?.role}</strong> perspective<br>
          <span class="sota-questions-footer-muted">Use AI Suggest on each question to find who should answer</span>
        </p>
        <button class="sota-btn-primary" id="btn-done">Done</button>
      `,n.querySelector("#btn-done")?.addEventListener("click",()=>{n.remove(),Nn(e,t)})}catch{m.innerHTML=`
        <div class="sota-error">
          <div class="error-icon">✗</div>
          <h4>Generation Failed</h4>
          <p>Something went wrong. Please try again.</p>
          <button class="sota-btn-primary sota-btn-retry sota-btn-retry-mt" id="retry-gen">Retry</button>
        </div>
      `,n.querySelector("#retry-gen")?.addEventListener("click",S)}}};n.querySelector("#close-modal")?.addEventListener("click",()=>n.remove()),n.querySelector(".modal-backdrop")?.addEventListener("click",()=>n.remove()),n.querySelectorAll(".sota-tab").forEach(w=>{w.addEventListener("click",()=>{n.querySelectorAll(".sota-tab").forEach(k=>k.classList.remove("active")),w.classList.add("active"),s=w.getAttribute("data-source")||"team",v(s)})}),n.querySelectorAll(".config-btn").forEach(w=>{w.addEventListener("click",()=>{n.querySelectorAll(".config-btn").forEach(x=>x.classList.remove("active")),w.classList.add("active");const k=w.getAttribute("data-count")||"auto";o=k==="auto"?"auto":parseInt(k,10)})}),n.querySelector("#btn-generate")?.addEventListener("click",S),v("team")}function Mu(e){const t=e.querySelector("#questions-count");if(t){const n=ce.getState().questions;t.textContent=String(n.length)}}function mn(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const Pn="risk-modal";function Us(e){const{mode:t,risk:n,onSave:s,onDelete:i}=e,a=t==="edit"&&n?.id,o=t==="view",r=document.querySelector(`[data-modal-id="${Pn}"]`);r&&r.remove();const c=_("div",{className:"risk-modal-content"}),l=n?.description??n?.content??"",d=n?.probability??n?.likelihood??"medium",m=n?.createdAt??n?.created_at??"";if(o&&n)c.innerHTML=`
      <div class="risk-view">
        <div class="risk-meta">
          <span class="impact-badge impact-${n.impact}">${n.impact} impact</span>
          <span class="probability-badge">${d} probability</span>
          <span class="status-badge ${n.status}">${n.status}</span>
        </div>
        
        <div class="risk-description-large">
          ${la(l)}
        </div>
        
        ${n.mitigation?`
          <div class="risk-mitigation-section">
            <h4>Mitigation Strategy</h4>
            <p>${la(n.mitigation)}</p>
          </div>
        `:""}
        
        <div class="risk-date">Created ${Ee(m)}</div>
      </div>
    `;else{const v=n?.owner??"";c.innerHTML=`
      <form id="risk-form" class="risk-form">
        <div class="form-group gm-flex gm-flex-center gm-gap-3 gm-flex-wrap">
          <label for="risk-description" class="gm-mb-0">Risk Description *</label>
          <button type="button" class="btn btn-secondary btn-sm" id="risk-ai-suggest-btn" title="Suggest owner and mitigation from description">✨ AI suggest</button>
        </div>
        <div class="form-group">
          <textarea id="risk-description" rows="3" required 
                    placeholder="Describe the risk...">${l}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="risk-impact">Impact</label>
            <select id="risk-impact">
              <option value="low" ${n?.impact==="low"?"selected":""}>Low</option>
              <option value="medium" ${n?.impact==="medium"||!n?"selected":""}>Medium</option>
              <option value="high" ${n?.impact==="high"?"selected":""}>High</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="risk-probability">Probability</label>
            <select id="risk-probability">
              <option value="low" ${d==="low"?"selected":""}>Low</option>
              <option value="medium" ${d==="medium"?"selected":""}>Medium</option>
              <option value="high" ${d==="high"?"selected":""}>High</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="risk-status">Status</label>
          <select id="risk-status">
            <option value="open" ${n?.status==="open"||!n?"selected":""}>Open</option>
            <option value="mitigating" ${n?.status==="mitigating"?"selected":""}>Mitigating</option>
            <option value="mitigated" ${n?.status==="mitigated"?"selected":""}>Mitigated</option>
            <option value="accepted" ${n?.status==="accepted"?"selected":""}>Accepted</option>
            <option value="closed" ${n?.status==="closed"?"selected":""}>Closed</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="risk-owner">Owner</label>
          <input type="text" id="risk-owner" class="form-input" placeholder="Who owns this risk?" value="${la(v)}">
        </div>
        
        <div class="form-group">
          <label for="risk-mitigation">Mitigation Strategy</label>
          <textarea id="risk-mitigation" rows="3" 
                    placeholder="How will this risk be mitigated?">${n?.mitigation||""}</textarea>
        </div>
      </form>
    `;const y=c.querySelector("#risk-ai-suggest-btn");y&&u(y,"click",async()=>{const S=c.querySelector("#risk-description"),w=c.querySelector("#risk-impact"),k=c.querySelector("#risk-probability"),x=S?.value?.trim()||"";if(!x){h.error("Enter a risk description first");return}y.disabled=!0,y.textContent="…";try{const b=await Mt.suggest({content:x,impact:w?.value||"medium",likelihood:k?.value||"medium"}),C=c.querySelector("#risk-owner"),T=c.querySelector("#risk-mitigation");C&&b.suggested_owner&&(C.value=b.suggested_owner),T&&b.suggested_mitigation&&(T.value=b.suggested_mitigation),h.success("Owner and mitigation suggested")}catch(b){h.error(b.message||"AI suggest failed")}finally{y.disabled=!1,y.textContent="✨ AI suggest"}})}const f=_("div",{className:"modal-footer"});if(o){const v=_("button",{className:"btn btn-primary",textContent:"Edit"}),y=_("button",{className:"btn btn-secondary",textContent:"Close"});u(y,"click",()=>U(Pn)),u(v,"click",()=>{U(Pn),Us({...e,mode:"edit"})}),f.appendChild(y),f.appendChild(v)}else{const v=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),y=_("button",{className:"btn btn-primary",textContent:a?"Save Changes":"Create Risk"});if(u(v,"click",()=>U(Pn)),u(y,"click",async()=>{const S=c.querySelector("#risk-form");if(!S.checkValidity()){S.reportValidity();return}const w=C=>c.querySelector(`#${C}`)?.value.trim()||"",k=w("risk-description"),x=w("risk-owner")||void 0,b={id:n?.id||`risk-${Date.now()}`,description:k,content:k,impact:w("risk-impact"),probability:w("risk-probability"),likelihood:w("risk-probability"),status:w("risk-status"),mitigation:w("risk-mitigation")||void 0,owner:x,createdAt:n?.createdAt??n?.created_at??new Date().toISOString()};y.disabled=!0,y.textContent="Saving...";try{if(a)await p.put(`/api/risks/${n.id}`,{content:b.content??b.description,impact:b.impact,likelihood:b.likelihood??b.probability,mitigation:b.mitigation,status:b.status,owner:b.owner}),h.success("Risk updated");else{const C=await p.post("/api/risks",{content:b.content??b.description,impact:b.impact,likelihood:b.likelihood??b.probability,mitigation:b.mitigation,status:b.status,owner:b.owner}),T=C.data.risk;T?b.id=T.id:b.id=C.data.id,h.success("Risk created")}s?.({...b,description:b.description??b.content,content:b.content??b.description}),U(Pn)}catch{}finally{y.disabled=!1,y.textContent=a?"Save Changes":"Create Risk"}}),a){const S=_("button",{className:"btn btn-danger",textContent:"Delete"});u(S,"click",async()=>{const{confirm:w}=await ve(async()=>{const{confirm:x}=await Promise.resolve().then(()=>vn);return{confirm:x}},void 0);if(await w("Are you sure you want to delete this risk?",{title:"Delete Risk",confirmText:"Delete",confirmClass:"btn-danger"}))try{await p.delete(`/api/risks/${n.id}`),h.success("Risk deleted"),i?.(String(n.id)),U(Pn)}catch{}}),f.appendChild(y),f.appendChild(v),f.appendChild(S)}else f.appendChild(y),f.appendChild(v)}const g=Me({id:Pn,title:o?"Risk Details":a?"Edit Risk":"New Risk",content:c,size:"md",footer:f});document.body.appendChild(g),qe(Pn)}function la(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Se(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function sl(e){if(!e)return"—";try{return hs(e)}catch{return e}}function il(e){return e>=70?"var(--success, #4ecdc4)":e>=50?"var(--warning, #ffe66d)":"var(--text-muted, #6a6a8a)"}function ln(e){return e.trim().split(/\s+/).map(t=>t[0]).join("").toUpperCase().substring(0,2)}function G2(e){return{created:"📝",updated:"✏️",deleted:"🗑️",restored:"↩️"}[e]||"•"}function W2(e){const t=e.event_data||{},n=e.actor_name?` by ${e.actor_name}`:"";switch(e.event_type){case"created":return`Created${n}`;case"updated":{const s=t.changes||[];if(s.length===0)return`Updated${n}`;if(s.length===1){const i=s[0],a=String(i.to).trim()?i.to:"—",o=String(i.from).trim()?i.from:"—";return`${i.field} changed: ${o} → ${a}${n}`}return`${s.map(i=>`${i.field}: ${i.from||"—"} → ${i.to||"—"}`).join("; ")}${n}`}case"deleted":return`Deleted${t.reason?` (${t.reason})`:""}${n}`;case"restored":return`Restored${n}`;default:return e.event_type}}function jr(e){const{risk:t,onClose:n,onUpdate:s}=e,i=_("div",{className:"risk-detail-view question-detail-view"});i.innerHTML=`
    <div class="question-detail-header risk-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Risks</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Risk #${String(t.id).substring(0,8)}</span>
      </div>
      <div class="header-actions">
        <span class="status-badge status-${(t.status||"open").toLowerCase()}">${Se(String(t.status))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content risk-detail-content">
      <div id="risk-view-content">
      <section class="detail-section risk-main">
        <div class="question-badges risk-badges">
          ${t.impact?`<span class="priority-pill impact-${t.impact}">${Se(t.impact)} impact</span>`:""}
          ${t.likelihood?`<span class="priority-pill likelihood-${t.likelihood}">${Se(t.likelihood)} likelihood</span>`:""}
          ${t.generation_source?`<span class="status-pill">${Se(t.generation_source)}</span>`:""}
          <span class="question-date risk-date">Created ${Ee(t.created_at)}</span>
        </div>
        <h2 class="question-text risk-content-text">${Se(t.content)}</h2>
      </section>

      <div class="detail-columns">
        <div class="detail-column-left">
          <!-- Assignment (Owner) Section - SOTA (aligned with Questions) -->
          <section class="detail-section" id="risk-assignment-section">
            <div class="section-header-sota">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Assignment
                <span class="section-subtitle">Who should own this risk?</span>
              </h3>
              <button type="button" class="btn-ai-suggest" id="risk-ai-suggest-btn" title="Suggest owner and mitigation from risk content">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Suggest
              </button>
            </div>

            <!-- Current Assignment (Owner) Display -->
            <div id="risk-current-assignment" class="current-assignment-card">
              ${t.owner?`
                <div class="assigned-contact-display">
                  <div class="contact-avatar-lg" id="risk-assigned-avatar">${ln(t.owner)}</div>
                  <div class="contact-details">
                    <div class="contact-name-lg">${Se(t.owner)}</div>
                    <div class="contact-role-sm" id="risk-assigned-role">—</div>
                  </div>
                  <button class="btn-change-assignment" id="risk-change-owner-btn" type="button">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    Change
                  </button>
                </div>
              `:`
                <div class="no-assignment">
                  <div class="no-assignment-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                  </div>
                  <span>No one assigned</span>
                  <p class="no-assignment-hint">Use AI Suggest or choose manually</p>
                  <button class="btn-assign-now" id="risk-show-picker-btn" type="button">Choose Manually</button>
                </div>
              `}
            </div>

            <!-- Contact Picker (hidden by default) -->
            <div id="risk-contact-picker" class="contact-picker-sota hidden">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="risk-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="risk-contact-list" class="contact-list-grid">Loading...</div>
            </div>

            <!-- AI Suggestions Panel -->
            <div id="risk-suggestions-panel" class="suggestions-panel-sota risk-suggestions-panel hidden"></div>

            <!-- Mitigation (below assignment) -->
            <div class="risk-mitigation-block">
              <strong>Mitigation</strong>
              <p id="risk-detail-mitigation" class="risk-mitigation">${t.mitigation?Se(t.mitigation):'<span class="text-muted">No mitigation recorded</span>'}</p>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-header">
              <h3>Source</h3>
            </div>
            ${t.source_file?`<p class="source-file">${Se(t.source_file)}</p>`:""}
            ${t.source_document_id?`
              <p class="source-doc">
                <a href="#" class="doc-link" data-document-id="${Se(String(t.source_document_id))}">View source document</a>
              </p>
            `:""}
            ${!t.source_file&&!t.source_document_id?'<p class="text-muted">No source recorded</p>':""}
          </section>
        </div>

        <div class="detail-column-right">
          <section class="detail-section metadata-section">
            <h3>Metadata</h3>
            <dl class="metadata-list">
              <dt>Created</dt>
              <dd>${sl(t.created_at)}</dd>
              ${t.updated_at?`<dt>Updated</dt><dd>${sl(t.updated_at)}</dd>`:""}
            </dl>
          </section>

          <section class="detail-section" id="risk-timeline-section">
            <h3>Timeline</h3>
            <div id="timeline-content" class="timeline-content">
              <span class="text-muted">Loading…</span>
            </div>
          </section>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-secondary" id="edit-risk-btn">Edit</button>
        <button type="button" class="btn btn-danger" id="delete-risk-btn">Delete</button>
      </div>
      </div>

      <div id="risk-edit-form" class="risk-detail-edit-form hidden">
        <form id="risk-inline-form" class="risk-form">
          <div class="form-group">
            <div class="gm-flex gm-flex-center gm-justify-between gm-flex-wrap gm-gap-2 gm-mb-2">
              <label for="risk-edit-content" class="gm-mb-0">Risk description *</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="risk-edit-ai-suggest-btn" title="Suggest owner and mitigation from description">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="risk-edit-content" rows="3" required placeholder="Describe the risk...">${Se(t.content||"")}</textarea>
          </div>
          <div id="risk-edit-suggestions-panel" class="suggestions-panel-sota risk-suggestions-panel hidden gm-mb-4"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="risk-edit-impact">Impact</label>
              <select id="risk-edit-impact">
                <option value="low" ${t.impact==="low"?"selected":""}>Low</option>
                <option value="medium" ${t.impact==="medium"||!t.impact?"selected":""}>Medium</option>
                <option value="high" ${t.impact==="high"?"selected":""}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="risk-edit-likelihood">Likelihood</label>
              <select id="risk-edit-likelihood">
                <option value="low" ${t.likelihood==="low"?"selected":""}>Low</option>
                <option value="medium" ${t.likelihood==="medium"||!t.likelihood?"selected":""}>Medium</option>
                <option value="high" ${t.likelihood==="high"?"selected":""}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="risk-edit-status">Status</label>
              <select id="risk-edit-status">
                <option value="open" ${t.status==="open"||!t.status?"selected":""}>Open</option>
                <option value="mitigating" ${t.status==="mitigating"?"selected":""}>Mitigating</option>
                <option value="mitigated" ${t.status==="mitigated"?"selected":""}>Mitigated</option>
                <option value="accepted" ${t.status==="accepted"?"selected":""}>Accepted</option>
                <option value="closed" ${t.status==="closed"?"selected":""}>Closed</option>
              </select>
            </div>
          </div>
          <div class="form-group risk-owner-picker-wrap">
            <label>Owner</label>
            <input type="hidden" id="risk-edit-owner" value="${Se(t.owner||"")}">
            <div class="risk-owner-picker-trigger" id="risk-owner-picker-trigger" title="Click to select from project contacts">
              <span class="risk-owner-picker-value" id="risk-owner-picker-value">${t.owner?Se(t.owner):'<span class="text-muted">Select owner...</span>'}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div id="risk-owner-picker-dropdown" class="risk-owner-picker-dropdown hidden">
              <div class="risk-owner-picker-search">
                <input type="text" id="risk-owner-picker-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="risk-owner-picker-list" class="risk-owner-picker-list">Loading...</div>
            </div>
          </div>
          <div class="form-group">
            <label for="risk-edit-mitigation">Mitigation strategy</label>
            <textarea id="risk-edit-mitigation" rows="3" placeholder="How will this risk be mitigated?">${Se(t.mitigation||"")}</textarea>
          </div>
        </form>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="risk-save-btn">Save</button>
          <button type="button" class="btn btn-secondary" id="risk-cancel-edit-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="risk-delete-in-edit-btn">Delete</button>
        </div>
      </div>
    </div>
  `;const a=i.querySelector("#back-to-list");a&&u(a,"click",oe=>{oe.preventDefault(),n()});const o=i.querySelector("#close-detail");o&&u(o,"click",n);const r=i.querySelector("#risk-view-content"),c=i.querySelector("#risk-edit-form"),l=i.querySelector("#edit-risk-btn");l&&r&&c&&u(l,"click",()=>{r.classList.add("hidden"),c.classList.remove("hidden")});const d=i.querySelector("#risk-cancel-edit-btn");d&&r&&c&&u(d,"click",()=>{c.classList.add("hidden"),r.classList.remove("hidden")});const m=i.querySelector("#risk-save-btn");m&&c&&s&&u(m,"click",async()=>{const oe=i.querySelector("#risk-inline-form");if(!oe?.checkValidity()){oe.reportValidity();return}const Y=i.querySelector("#risk-edit-content"),le=i.querySelector("#risk-edit-impact"),G=i.querySelector("#risk-edit-likelihood"),ge=i.querySelector("#risk-edit-status"),ye=i.querySelector("#risk-edit-owner"),_e=i.querySelector("#risk-edit-mitigation"),j=Y?.value?.trim()||"";if(!j){h.error("Risk description is required");return}m.disabled=!0,m.textContent="Saving...";try{const Z=await Mt.update(t.id,{content:j,impact:le?.value||"medium",likelihood:G?.value||"medium",status:ge?.value||"open",owner:ye?.value?.trim()||void 0,mitigation:_e?.value?.trim()||void 0});h.success("Risk updated"),s(Z)}catch{h.error("Failed to save")}finally{m.disabled=!1,m.textContent="Save"}});const f=i.querySelector("#risk-delete-in-edit-btn");f&&u(f,"click",async()=>{if(confirm("Are you sure you want to delete this risk?"))try{await Mt.delete(t.id),h.success("Risk deleted"),n()}catch{h.error("Failed to delete")}});const g=i.querySelector("#risk-owner-picker-trigger"),v=i.querySelector("#risk-owner-picker-dropdown"),y=i.querySelector("#risk-owner-picker-value"),S=i.querySelector("#risk-edit-owner"),w=i.querySelector("#risk-owner-picker-list"),k=i.querySelector("#risk-owner-picker-search");if(g&&v&&w&&S){let oe=[];const Y=(le="")=>{const G=le?oe.filter(ge=>(ge.name||"").toLowerCase().includes(le.toLowerCase())||(ge.role||"").toLowerCase().includes(le.toLowerCase())):oe;if(oe.length===0){w.innerHTML='<div class="empty-state">Loading contacts...</div>';return}if(G.length===0){w.innerHTML='<div class="empty-state">No contacts match</div>';return}w.innerHTML=G.map(ge=>{const ye=ge.photoUrl||ge.avatarUrl;return`
            <div class="risk-owner-card-picker ${(S?.value||"").trim()===(ge.name||"").trim()?"selected":""}" data-contact-name="${Se(ge.name||"")}">
              <div class="risk-owner-card-avatar">${ye?`<img src="${Se(ye)}" alt="" onerror="this.parentElement.innerHTML='${ln(ge.name||"")}'">`:ln(ge.name||"")}</div>
              <div class="risk-owner-card-info">
                <div class="risk-owner-card-name">${Se(ge.name||"")}</div>
                ${ge.role?`<div class="risk-owner-card-role">${Se(ge.role)}</div>`:""}
              </div>
            </div>
          `}).join(""),w.querySelectorAll(".risk-owner-card-picker").forEach(ge=>{u(ge,"click",()=>{const ye=ge.getAttribute("data-contact-name")||"";S.value=ye,y&&(y.innerHTML=ye?Se(ye):'<span class="text-muted">Select owner...</span>'),v.classList.add("hidden")})})};u(g,"click",async le=>{le.stopPropagation();const G=!v.classList.contains("hidden");if(v.classList.toggle("hidden",G),!G&&oe.length===0){w.innerHTML='<div class="empty-state">Loading...</div>';try{oe=(await Je.getAll())?.contacts||[],Y(k?.value||"")}catch{w.innerHTML='<div class="empty-state">Failed to load contacts</div>'}}else G||Y(k?.value||"")}),k&&k.addEventListener("input",()=>Y(k.value)),document.addEventListener("click",le=>{!le.target.closest(".risk-owner-picker-wrap")&&!v?.classList.contains("hidden")&&v.classList.add("hidden")})}const x=i.querySelector("#risk-edit-ai-suggest-btn"),b=i.querySelector("#risk-edit-suggestions-panel");x&&b&&u(x,"click",async()=>{const Y=i.querySelector("#risk-edit-content")?.value?.trim()||"";if(!Y){h.error("Enter a risk description first");return}const le=x;le.disabled=!0,le.innerHTML='<span class="spin">⋯</span> Analyzing...',b.classList.remove("hidden"),b.innerHTML='<div class="suggestions-loading"><div class="loading-text">AI is suggesting owners and mitigation...</div></div>';try{const[G,ge]=await Promise.all([Mt.suggest({content:Y,impact:i.querySelector("#risk-edit-impact")?.value||"medium",likelihood:i.querySelector("#risk-edit-likelihood")?.value||"medium"}),Je.getAll()]),ye=ge?.contacts||[],_e=G.suggested_owners?.length?G.suggested_owners:G.suggested_owner?[{name:G.suggested_owner,reason:"",score:0}]:[],j=G.suggested_mitigation||"";if(_e.length===0&&!j)b.innerHTML='<div class="no-suggestions"><div class="no-suggestions-text">No suggestions</div><button type="button" class="btn-link" id="risk-edit-hide-suggest-btn">Close</button></div>';else{b.innerHTML=`
            <div class="suggestions-header-sota"><div class="ai-badge">✨ AI Recommended</div></div>
            ${_e.length>0?`<div class="suggestions-list-sota">${_e.map((D,K)=>{const ie=ye.find(xt=>(xt.name||"").trim().toLowerCase()===(D.name||"").trim().toLowerCase()),xe=ie?.photoUrl||ie?.avatarUrl||ie?.photo_url||ie?.avatar_url,Ce=ie?.role??D.reason??"",$e=D.score??0,it=il($e);return`<div class="suggestion-card-sota risk-owner-card" data-owner-name="${Se(D.name||"")}">
                <div class="suggestion-rank">#${K+1}</div>
                <div class="suggestion-avatar-sota">${xe?`<img src="${Se(xe)}" alt="" onerror="this.parentElement.innerHTML='${ln(D.name)}'">`:ln(D.name)}</div>
                <div class="suggestion-info-sota"><div class="suggestion-name-sota">${Se(D.name||"")}</div>${Ce?`<div class="suggestion-reason-sota">${Se(Ce)}</div>`:""}</div>
                ${$e>0?`<div class="suggestion-score-sota" style="--score-color: ${it}"><div class="score-value">${$e}%</div></div>`:""}
                <button type="button" class="btn-select-suggestion">Assign</button>
              </div>`}).join("")}</div>`:""}
            ${j?`<div class="risk-suggestion-card risk-mitigation-suggestion"><strong>Suggested mitigation</strong><p class="risk-suggestion-mitigation">${Se(j)}</p><button type="button" class="btn btn-secondary btn-sm" id="risk-edit-apply-mitigation-btn">Apply mitigation</button></div>`:""}
            <div class="suggestions-footer"><button type="button" class="btn-link" id="risk-edit-hide-suggest-btn">Close suggestions</button></div>
          `,b.querySelectorAll(".risk-owner-card .btn-select-suggestion").forEach(D=>{const ie=D.closest(".risk-owner-card")?.getAttribute("data-owner-name")||"";ie&&u(D,"click",()=>{S&&(S.value=ie),y&&(y.innerHTML=Se(ie)),b.classList.add("hidden"),h.success(`Owner set to ${ie}`)})});const R=b.querySelector("#risk-edit-apply-mitigation-btn");R&&j&&u(R,"click",()=>{const D=i.querySelector("#risk-edit-mitigation");D&&(D.value=j),h.success("Mitigation applied")})}const Z=b.querySelector("#risk-edit-hide-suggest-btn");Z&&u(Z,"click",()=>{b.classList.add("hidden")})}catch{b.innerHTML='<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="risk-edit-hide-suggest-btn">Close</button></div>';const G=b.querySelector("#risk-edit-hide-suggest-btn");G&&u(G,"click",()=>{b.classList.add("hidden")})}finally{le.disabled=!1,le.innerHTML='<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> AI suggest'}});const C=i.querySelector("#delete-risk-btn");C&&u(C,"click",async()=>{if(confirm("Are you sure you want to delete this risk?"))try{await Mt.delete(t.id),h.success("Risk deleted"),n()}catch{h.error("Failed to delete risk")}});let T="";const A=i.querySelector("#risk-ai-suggest-btn"),M=i.querySelector("#risk-suggestions-panel");A&&M&&u(A,"click",async()=>{const oe=A;oe.disabled=!0,oe.innerHTML=`
        <svg class="spin" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Analyzing...
      `,M.classList.remove("hidden"),M.innerHTML=`
        <div class="suggestions-loading">
          <div class="ai-thinking-animation"><span></span><span></span><span></span></div>
          <div class="loading-text">AI is suggesting owners and mitigation...</div>
        </div>
      `;try{const[Y,le]=await Promise.all([Mt.suggest({content:t.content||"",impact:t.impact||"medium",likelihood:t.likelihood||"medium"}),Je.getAll()]),G=le?.contacts||[];T=Y.suggested_mitigation||"";const ge=Y.suggested_owners?.length?Y.suggested_owners:Y.suggested_owner?[{name:Y.suggested_owner,reason:"",score:0}]:[];if(ge.length===0&&!T)M.innerHTML=`
            <div class="no-suggestions">
              <div class="no-suggestions-text">No owner or mitigation suggestions</div>
              <button type="button" class="btn-link" id="risk-hide-suggestions-btn">Close</button>
            </div>
          `;else{M.innerHTML=`
            <div class="suggestions-header-sota">
              <div class="ai-badge">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                AI Recommended
              </div>
            </div>
            ${ge.length>0?`
            <div class="suggestions-list-sota">
              ${ge.map((j,Z)=>{const R=j.score??0,D=il(R),K=G.find(Ce=>(Ce.name||"").trim().toLowerCase()===(j.name||"").trim().toLowerCase()),ie=K?.photoUrl||K?.avatarUrl||K?.photo_url||K?.avatar_url,xe=K?.role??j.reason??"";return`
                  <div class="suggestion-card-sota risk-owner-card" data-index="${Z}">
                    <div class="suggestion-rank">#${Z+1}</div>
                    <div class="suggestion-avatar-sota">${ie?`<img src="${Se(ie)}" alt="${Se(j.name)}" onerror="this.parentElement.innerHTML='${ln(j.name)}'">`:ln(j.name)}</div>
                    <div class="suggestion-info-sota">
                      <div class="suggestion-name-sota">${Se(j.name)}</div>
                      ${xe?`<div class="suggestion-reason-sota">${Se(xe)}</div>`:""}
                    </div>
                    ${R>0?`
                    <div class="suggestion-score-sota" style="--score-color: ${D}">
                      <div class="score-ring">
                        <svg viewBox="0 0 36 36">
                          <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                          <path class="score-fill" stroke-dasharray="${R}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                        </svg>
                        <div class="score-value">${R}%</div>
                      </div>
                      <div class="score-label">Match</div>
                    </div>
                    `:""}
                    <button type="button" class="btn-select-suggestion">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Assign
                    </button>
                  </div>
                `}).join("")}
            </div>
            `:""}
            ${T?`
            <div class="risk-suggestion-card risk-mitigation-suggestion">
              <strong>Suggested mitigation</strong>
              <p class="risk-suggestion-mitigation">${Se(T)}</p>
              <button type="button" class="btn btn-secondary btn-sm" id="risk-apply-mitigation-btn">Apply mitigation</button>
            </div>
            `:""}
            <div class="suggestions-footer">
              <button type="button" class="btn-link" id="risk-hide-suggestions-btn">Close suggestions</button>
            </div>
          `,M.querySelectorAll(".risk-owner-card").forEach(j=>{const Z=j.querySelector(".btn-select-suggestion");if(!Z)return;const R=parseInt(j.getAttribute("data-index")||"0"),D=ge[R];!D||!s||u(Z,"click",async K=>{K.stopPropagation();try{const ie=await Mt.update(t.id,{owner:D.name});M.classList.add("hidden"),s(ie),h.success(`Assigned to ${D.name}`)}catch{h.error("Failed to save")}})});const _e=M.querySelector("#risk-apply-mitigation-btn");_e&&T&&s&&u(_e,"click",async()=>{try{const j=await Mt.update(t.id,{mitigation:T}),Z=i.querySelector("#risk-detail-mitigation");Z&&(Z.innerHTML=Se(T)),s(j),h.success("Mitigation updated")}catch{h.error("Failed to save")}})}const ye=M.querySelector("#risk-hide-suggestions-btn");ye&&u(ye,"click",()=>{M.classList.add("hidden")})}catch{M.innerHTML=`
          <div class="suggestions-error">
            <div>Failed to get AI suggestions</div>
            <button type="button" class="btn-retry" id="risk-retry-suggest-btn">Try again</button>
          </div>
        `;const Y=M.querySelector("#risk-retry-suggest-btn");Y&&u(Y,"click",()=>A.click())}finally{oe.disabled=!1,oe.innerHTML=`
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          AI suggest
        `}});const Q=i.querySelector(".doc-link");Q&&t.source_document_id&&u(Q,"click",oe=>{oe.preventDefault(),window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:{tab:"files",documentId:t.source_document_id}}))});const q=i.querySelector("#timeline-content");q&&Mt.getEvents(t.id).then(oe=>{if(oe.length===0){q.innerHTML='<p class="empty-state">No events recorded</p>';return}const Y=oe.map(le=>{const G=G2(le.event_type),ge=W2(le);return`
          <div class="timeline-item risk-event-${Se(le.event_type)}">
            <div class="timeline-icon">${G}</div>
            <div class="timeline-content">
              <div class="timeline-title">${Se(ge)}</div>
              <div class="timeline-date">${hs(le.created_at)}</div>
            </div>
          </div>`}).join("");q.innerHTML=`<div class="timeline-list">${Y}</div>`}).catch(()=>{q.innerHTML='<p class="error">Failed to load timeline</p>'});let V=[];const I=t.owner||"",H=i.querySelector("#risk-contact-picker"),W=i.querySelector("#risk-contact-list"),ee=i.querySelector("#risk-contact-search"),te=(oe="")=>{if(!W)return;const Y=oe?V.filter(le=>(le.name||"").toLowerCase().includes(oe.toLowerCase())||(le.role||"").toLowerCase().includes(oe.toLowerCase())||(le.organization||"").toLowerCase().includes(oe.toLowerCase())):V;if(V.length===0){W.innerHTML='<div class="empty-state">Loading contacts...</div>';return}if(Y.length===0){W.innerHTML='<div class="empty-state">No contacts match</div>';return}W.innerHTML=Y.map(le=>{const G=we(le);return`
          <div class="contact-card-picker ${(I||"").trim()===(le.name||"").trim()?"selected":""}" data-contact-name="${Se(le.name||"")}">
            <div class="contact-avatar-picker">${G?`<img src="${Se(G)}" alt="" onerror="this.parentElement.innerHTML='${ln(le.name||"")}'">`:ln(le.name||"")}</div>
            <div class="contact-info-picker">
              <div class="contact-name-picker">${Se(le.name||"")}</div>
              ${le.role?`<div class="contact-role-picker">${Se(le.role)}</div>`:""}
            </div>
          </div>`}).join(""),W.querySelectorAll(".contact-card-picker").forEach(le=>{u(le,"click",async()=>{const G=le.getAttribute("data-contact-name")||"";if(G)try{const ge=await Mt.update(t.id,{owner:G});h.success(`Owner set to ${G}`),H&&H.classList.add("hidden"),s?.(ge)}catch{h.error("Failed to save")}})})},ue=()=>{if(!H)return;const oe=H.classList.contains("hidden");H.classList.toggle("hidden",oe),oe&&V.length===0?Je.getAll().then(Y=>{V=Y?.contacts||[],te(ee?.value||"")}).catch(()=>{W&&(W.innerHTML='<div class="empty-state">Failed to load contacts</div>')}):oe&&te(ee?.value||""),ee&&ee.focus()},Pe=i.querySelector("#risk-change-owner-btn"),ze=i.querySelector("#risk-show-picker-btn");Pe&&H&&u(Pe,"click",ue),ze&&H&&u(ze,"click",ue),ee&&ee.addEventListener("input",()=>te(ee.value));function st(oe){if(!oe||!V.length)return;const Y=oe.trim().toLowerCase();if(!Y)return;const le=V.find(ye=>(ye.name||"").trim().toLowerCase()===Y);if(le)return le;const G=V.find(ye=>(ye.name||"").trim().toLowerCase().includes(Y)||Y.includes((ye.name||"").trim().toLowerCase()));if(G)return G;const ge=V.find(ye=>(ye.aliases||[]).some(_e=>String(_e).trim().toLowerCase()===Y));return ge||V.find(ye=>(ye.aliases||[]).some(_e=>{const j=String(_e).trim().toLowerCase();return j.includes(Y)||Y.includes(j)}))}function we(oe){if(!oe)return null;const Y=oe;return Y.photoUrl||Y.avatarUrl||Y.photo_url||Y.avatar_url||null}return Je.getAll().then(oe=>{V=oe?.contacts||[];const Y=st(I),le=i.querySelector("#risk-assigned-role");le&&(le.textContent=Y?.role??"—");const G=i.querySelector("#risk-assigned-avatar");if(G&&I){const ge=we(Y);if(ge){G.innerHTML="";const ye=document.createElement("img");ye.src=ge,ye.alt="",ye.onerror=()=>{G.textContent=ln(I)},G.appendChild(ye)}}}).catch(()=>{}),i}const Q2=Object.freeze(Object.defineProperty({__proto__:null,createRiskDetailView:jr},Symbol.toStringTag,{value:"Module"}));function qu(e,t,n){return{risk:n,onClose:()=>{e.innerHTML="",e.appendChild(vo(t))},onUpdate:s=>{e.innerHTML="",s?e.appendChild(jr(qu(e,t,s))):e.appendChild(vo(t))}}}let fi="all",Bo="",ju="status",ks=!1,Ga=[];function vo(e={}){const t=_("div",{className:"sot-panel risks-panel"});t.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Risks</h2>
        <span class="panel-count" id="risks-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="risks-filter" class="filter-select">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="mitigating">Mitigating</option>
          <option value="mitigated">Mitigated</option>
          <option value="high">High Impact</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="status">By Status</button>
          <button class="view-tab" data-view="source">By Source</button>
        </div>
        <input type="search" id="risks-search" class="search-input" placeholder="Search risks..." title="Search">
        <button class="btn btn-secondary btn-sm" id="toggle-matrix-btn">Show Matrix</button>
        <button class="btn btn-primary btn-sm" id="add-risk-btn">+ Add</button>
      </div>
    </div>
    <div id="risk-matrix-container" class="risk-matrix-container hidden"></div>
    <div class="panel-content" id="risks-content">
      <div class="loading">Loading risks...</div>
    </div>
    <div id="removed-risks-container" class="removed-risks-container hidden"></div>
  `;const n=t.querySelector("#risks-filter");u(n,"change",()=>{fi=n.value,Ln(t,e)});const s=t.querySelectorAll(".view-tab");s.forEach(c=>{u(c,"click",()=>{s.forEach(l=>l.classList.remove("active")),c.classList.add("active"),ju=c.getAttribute("data-view"),Ln(t,e)})});const i=t.querySelector("#risks-search");let a;u(i,"input",()=>{clearTimeout(a),a=window.setTimeout(()=>{Bo=i.value.trim(),Ln(t,e)},300)});const o=t.querySelector("#toggle-matrix-btn");u(o,"click",()=>{ks=!ks,o.textContent=ks?"Hide Matrix":"Show Matrix";const c=t.querySelector("#risk-matrix-container");if(c.classList.toggle("hidden",!ks),ks){const l=Ga.length>0?Ga:ce.getState().risks||[];Pu(c,Array.isArray(l)?l:[])}});const r=t.querySelector("#add-risk-btn");return r&&u(r,"click",()=>{Us({mode:"create",onSave:()=>{Ln(t,e),Wa(t,e)}})}),Ln(t,e),Wa(t,e),t}async function Wa(e,t){const n=e.querySelector("#removed-risks-container");if(n)try{const s=await Mt.getDeleted();if(s.length===0){n.classList.add("hidden"),n.innerHTML="";return}n.classList.remove("hidden"),n.innerHTML=`
      <div class="removed-risks-section">
        <div class="removed-risks-header section-header-sota">
          <h3>Removed risks</h3>
          <span class="panel-count removed-count">${s.length}</span>
        </div>
        <p class="removed-risks-hint">Restore to bring the risk back; it will be synced to the graph.</p>
        <div class="removed-risks-list">
          ${s.map(i=>`
            <div class="removed-risk-item" data-risk-id="${i.id}">
              <div class="removed-risk-content">${Rt(Qa(i.content??"",100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join("")}
        </div>
      </div>
    `,n.querySelectorAll(".conflict-resolve-restore").forEach(i=>{u(i,"click",async()=>{const a=i.closest(".removed-risk-item")?.getAttribute("data-risk-id");if(a)try{await Mt.restore(a),h.success("Risk restored"),Ln(e,t),Wa(e,t)}catch{h.error("Failed to restore risk")}})})}catch{n.classList.add("hidden"),n.innerHTML=""}}function Qa(e,t){return e.length<=t?e:e.substring(0,t)+"…"}function K2(e,t){if(!t)return e;const n=t.toLowerCase();return e.filter(s=>(s.content||"").toLowerCase().includes(n)||(s.mitigation||"").toLowerCase().includes(n)||(s.owner||"").toLowerCase().includes(n)||(s.source_file||"").toLowerCase().includes(n))}async function Ln(e,t){const n=e.querySelector("#risks-content");n.innerHTML='<div class="loading">Loading...</div>';try{const s=fi==="all"||fi==="high"?void 0:fi;let i=await Mt.getAll(s);if(fi==="high"&&(i=i.filter(a=>a.impact==="high"||a.impact==="critical")),i=K2(i,Bo),ju==="source"?Y2(n,i,t):J2(n,i,t),Ga=i,ce.setRisks(i),tx(e,i.length),ks){const a=e.querySelector("#risk-matrix-container");Pu(a,i)}}catch{n.innerHTML='<div class="error">Failed to load risks</div>'}}function J2(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>${Bo?"No risks match your search":"No risks found"}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Risk</button>
      </div>
    `;const o=e.querySelector("#empty-add-btn");o&&u(o,"click",()=>{Us({mode:"create",onSave:()=>Ln(e.closest(".risks-panel"),n)})});return}const s=ce.getState().contacts||[],i={};t.forEach(o=>{const r=(o.status||"open").toLowerCase();i[r]||(i[r]=[]),i[r].push(o)});const a=Object.keys(i);a.length>1?e.innerHTML=a.map(o=>`
      <div class="question-group">
        <div class="group-header">
          <h3>${Rt(o)}</h3>
          <span class="group-count">${i[o].length}</span>
        </div>
        <div class="group-items">
          ${i[o].map(r=>Ka(r,s)).join("")}
        </div>
      </div>
    `).join(""):e.innerHTML=t.map(o=>Ka(o,s)).join(""),Du(e,t,n)}function Y2(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>${Bo?"No risks match your search":"No risks found"}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Risk</button>
      </div>
    `;const a=e.querySelector("#empty-add-btn");a&&u(a,"click",()=>{Us({mode:"create",onSave:()=>Ln(e.closest(".risks-panel"),n)})});return}const s=ce.getState().contacts||[],i={};t.forEach(a=>{const o=a.source_file||"Unknown source";i[o]||(i[o]=[]),i[o].push(a)}),e.innerHTML=Object.entries(i).map(([a,o])=>`
    <div class="question-group">
      <div class="group-header">
        <h3>${Rt(a)}</h3>
        <span class="group-count">${o.length}</span>
      </div>
      <div class="group-items">
        ${o.map(r=>Ka(r,s)).join("")}
      </div>
    </div>
  `).join(""),Du(e,t,n)}const ol={critical:"#dc2626",high:"#ea580c",medium:"#ca8a04",low:"#16a34a"};function X2(e,t){if(!t||!e.length)return;const n=t.trim().toLowerCase();if(!n)return;const s=e.find(o=>(o.name||"").trim().toLowerCase()===n);if(s)return s;const i=e.find(o=>(o.name||"").trim().toLowerCase().includes(n)||n.includes((o.name||"").trim().toLowerCase()));return i||e.find(o=>(o.aliases||[]).some(r=>String(r).trim().toLowerCase()===n))||e.find(o=>(o.aliases||[]).some(r=>{const c=String(r).trim().toLowerCase();return c.includes(n)||n.includes(c)}))}function ex(e){return e&&(e.photoUrl||e.avatarUrl||e.photo_url||e.avatar_url)||null}function al(e){if(!e)return"?";const t=e.trim().split(/\s+/);return t.length===1?t[0].substring(0,2).toUpperCase():(t[0][0]+t[t.length-1][0]).toUpperCase()}function Ka(e,t){const n=(e.impact||"medium").toLowerCase(),s=ol[n]??ol.medium,i=e.content||"",a=e.source_file||"",o=e.owner||"",r=o?X2(t,o):void 0,c=ex(r),l=o?`
        <div class="assignee-chip">
          <div class="assignee-avatar">${c?`<img src="${Rt(c)}" alt="${Rt(o)}" onerror="this.parentElement.innerHTML='${al(o)}'">`:al(o)}</div>
          <div class="assignee-info">
            <span class="assignee-name">${Rt(o)}</span>
            ${r?.role?`<span class="assignee-role">${Rt(r.role)}</span>`:""}
          </div>
        </div>
      `:'<span class="card-owner-placeholder text-muted">No owner</span>',d=a?`<span class="card-source-chip">${Rt(Qa(a,40))}</span>`:'<span class="card-source-chip text-muted">No source</span>';return`
    <div class="risk-card-sota question-card-sota" data-id="${e.id}" style="--risk-impact-bar: ${s}">
      <div class="card-priority-bar risk-impact-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="priority-pill impact-${n}">${Rt(e.impact||"medium")}</span>
            <span class="status-pill">L: ${Rt(e.likelihood||"medium")}</span>
            <span class="status-pill status-${(e.status||"open").toLowerCase()}">${Rt(e.status||"open")}</span>
          </div>
          <span class="card-timestamp">${Ee(e.created_at)}</span>
        </div>
        <div class="card-question-text">${Rt(i)}</div>
        ${e.mitigation?`<div class="card-mitigation text-muted">${Rt(Qa(e.mitigation,120))}</div>`:""}
        <div class="card-bottom-row">
          <div class="card-requester">
            ${d}
            ${l}
          </div>
          <div class="card-assignment">
            <button type="button" class="btn-link risk-view-link">View</button>
          </div>
        </div>
      </div>
    </div>
  `}function Du(e,t,n){e.querySelectorAll(".risk-card-sota").forEach(s=>{u(s,"click",i=>{if(i.target.closest(".card-actions"))return;const a=s.getAttribute("data-id"),o=t.find(r=>String(r.id)===a);if(o)if(n.useDetailView&&n.containerElement){const r=n.containerElement;r.innerHTML="",r.appendChild(jr(qu(r,n,o)))}else n.onRiskClick?n.onRiskClick(o):Us({mode:"edit",risk:{...o},onSave:()=>Ln(e.closest(".risks-panel"),n)})})})}function Pu(e,t){const n=t.filter(m=>m.status!=="mitigated"&&m.status!=="closed"),s=(m,f)=>{const g=["low","medium","high","critical"].indexOf((m||"").toString().toLowerCase()||"low"),v=["low","medium","high"].indexOf((f||"").toString().toLowerCase()||"low"),y=g+v;return y>=4?"critical":y>=3?"high":y>=2?"medium":"low"},i={critical:0,high:0,medium:0,low:0};n.forEach(m=>{const f=s(m.impact,m.likelihood);i[f]++});const a=n.length,o=t.length-n.length,r=m=>a>0?Math.round(m/a*100):0;let c="",l=0;const d={critical:"#ef4444",high:"#f97316",medium:"#eab308",low:"#22c55e"};["critical","high","medium","low"].forEach(m=>{const g=r(i[m])/100*360;g>0&&(c+=`${d[m]} ${l}deg ${l+g}deg, `,l+=g)}),c?c=c.slice(0,-2):c="var(--color-border) 0deg 360deg",e.innerHTML=`
    <div class="risk-summary">
      <div class="risk-summary-header">
        <h4>Risk Overview</h4>
        <span class="risk-total">${a} active</span>
      </div>
      <div class="risk-summary-content">
        <div class="risk-donut-container">
          <div class="risk-donut" style="background: conic-gradient(${c})">
            <div class="risk-donut-center">
              <span class="donut-value">${a}</span>
              <span class="donut-label">Risks</span>
            </div>
          </div>
        </div>
        <div class="risk-bars">
          <div class="risk-bar-item critical">
            <span class="bar-icon">🔴</span>
            <span class="bar-label">Critical</span>
            <div class="bar-track"><div class="bar-fill" style="--bar-width: ${r(i.critical)}"></div></div>
            <span class="bar-count">${i.critical}</span>
          </div>
          <div class="risk-bar-item high">
            <span class="bar-icon">🟠</span>
            <span class="bar-label">High</span>
            <div class="bar-track"><div class="bar-fill" style="--bar-width: ${r(i.high)}"></div></div>
            <span class="bar-count">${i.high}</span>
          </div>
          <div class="risk-bar-item medium">
            <span class="bar-icon">🟡</span>
            <span class="bar-label">Medium</span>
            <div class="bar-track"><div class="bar-fill" style="--bar-width: ${r(i.medium)}"></div></div>
            <span class="bar-count">${i.medium}</span>
          </div>
          <div class="risk-bar-item low">
            <span class="bar-icon">🟢</span>
            <span class="bar-label">Low</span>
            <div class="bar-track"><div class="bar-fill" style="--bar-width: ${r(i.low)}"></div></div>
            <span class="bar-count">${i.low}</span>
          </div>
        </div>
      </div>
      ${o>0?`<div class="risk-mitigated"><span class="mitigated-icon">✓</span><span>${o} risk${o>1?"s":""} mitigated</span></div>`:""}
    </div>
  `}function tx(e,t){const n=e.querySelector("#risks-count");n&&(n.textContent=String(t))}function Rt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}async function Oo(){try{return(await p.get("/api/sprints")).data.sprints||[]}catch{return[]}}async function nx(e){try{return(await p.get(`/api/sprints/${e}`)).data.sprint||null}catch{return null}}async function sx(e){return(await p.post("/api/sprints",e)).data.sprint}async function ix(e,t){return(await p.post(`/api/sprints/${e}/generate`,t||{})).data}async function ox(e,t){return(await p.post(`/api/sprints/${e}/apply`,t)).data}async function ax(e){try{return(await p.get(`/api/sprints/${e}/report`)).data??null}catch{return null}}async function rx(e){return(await p.post(`/api/sprints/${e}/report/analyze`,{})).data}async function cx(e){return(await p.post(`/api/sprints/${e}/report/business`,{})).data}async function lx(e,t){return(await p.post(`/api/sprints/${e}/report/document`,{include_analysis:t?.include_analysis??!1,include_business:t?.include_business??!1,style:t?.style??""})).data}async function dx(e,t){return(await p.post(`/api/sprints/${e}/report/presentation`,{include_analysis:t?.include_analysis??!1,include_business:t?.include_business??!1})).data}const Yt="action-modal";function da(e){return e?.content??e?.task??""}function rl(e){return e?.due_date??e?.dueDate??""}function ux(e){return e?.created_at??e?.createdAt??""}function px(e){return e?.parent_story_ref??""}function cl(e){return e?.size_estimate??""}function ua(e){return e?.description??""}function ll(e){return e?.definition_of_done?e.definition_of_done.map(t=>typeof t=="string"?t:t.text):[]}function dl(e){return Array.isArray(e?.acceptance_criteria)?e.acceptance_criteria:[]}function Ps(e){const{mode:t,action:n,onSave:s,onDelete:i}=e,a=t==="edit"&&n?.id,o=t==="view",r=document.querySelector(`[data-modal-id="${Yt}"]`);r&&r.remove();const c=_("div",{className:"action-modal-content"});if(o&&n){const m=rl(n),f=m&&new Date(m)<new Date&&n.status!=="completed",g=px(n),v=cl(n),y=ua(n),S=ll(n),w=dl(n);c.innerHTML=`
      <div class="action-view">
        <div class="action-meta">
          <span class="priority-badge priority-${n.priority||"medium"}">${n.priority||"medium"}</span>
          <span class="status-badge ${n.status}">${n.status.replace("_"," ")}</span>
          ${f?'<span class="status-badge overdue">Overdue</span>':""}
        </div>
        
        <div class="action-task-large ${n.status==="completed"?"completed":""}">
          ${Ne(da(n))}
        </div>
        
        <div class="action-details">
          ${n.assignee?`<div class="detail-item"><strong>Assignee:</strong> ${Ne(n.assignee)}</div>`:""}
          ${m?`<div class="detail-item"><strong>Due Date:</strong> ${m}</div>`:""}
          ${v?`<div class="detail-item"><strong>Effort:</strong> ${Ne(v)}</div>`:""}
          ${g?`<div class="detail-item"><strong>Parent Story:</strong> ${Ne(g)}</div>`:""}
          ${n.generation_source?`<div class="detail-item"><strong>Source:</strong> ${Ne(n.generation_source)}</div>`:""}
          ${n.sprint_id||n.sprint_name?`<div class="detail-item"><strong>Sprint:</strong> ${Ne(n.sprint_name||n.sprint_id||"")}</div>`:""}
          ${n.task_points!=null?`<div class="detail-item"><strong>Task points:</strong> ${n.task_points}</div>`:""}
          ${n.requested_by||n.requested_by_contact_id?`<div class="detail-item" id="action-view-requester-wrap"><strong>Requested by:</strong> <span id="action-view-requester-card">${Ne(n.requested_by||"")}</span></div>`:""}
          <div class="detail-item"><strong>Created:</strong> ${Ee(ux(n))}</div>
        </div>
        ${y?`<div class="action-description"><strong>Description</strong><p>${Ne(y)}</p></div>`:""}
        ${S.length?`<div class="action-dod"><strong>Definition of Done</strong><ul>${S.map(k=>`<li>${Ne(k)}</li>`).join("")}</ul></div>`:""}
        ${w.length?`<div class="action-ac"><strong>Acceptance Criteria</strong><ul>${w.map(k=>`<li>${Ne(k)}</li>`).join("")}</ul></div>`:""}
      </div>
    `}else{const m=ll(n).join(`
`),f=dl(n).join(`
`);c.innerHTML=`
      <form id="action-form" class="action-form">
        <div class="form-group action-generate-block">
          <label>Generate from description (AI, uses Sprint Board rules)</label>
          <textarea id="action-description-draft" rows="2" placeholder="e.g. Add JWT validation to the API">${a&&n?Ne([da(n),ua(n)].filter(Boolean).join(`

`)):""}</textarea>
          <div class="action-generate-buttons mt-1">
            <button type="button" class="btn btn-secondary btn-sm" id="action-generate-btn">Generate from description</button>
            ${a&&n?'<button type="button" class="btn btn-outline-secondary btn-sm" id="action-regenerate-ai-btn">Regenerate with AI</button>':""}
          </div>
        </div>
        <div class="form-group">
          <label for="action-task">Task (title) *</label>
          <textarea id="action-task" rows="2" required 
                    placeholder="Concrete action e.g. Implementar validação JWT no backend">${Ne(da(n))}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="action-parent-story-id">Parent User Story</label>
            <div class="form-row-inline">
              <select id="action-parent-story-id">
                <option value="">— None —</option>
              </select>
              <button type="button" class="btn btn-secondary btn-sm" id="action-new-story-btn">New story</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" id="action-edit-story-btn" title="Edit selected story (title, story points)">Edit story</button>
            </div>
          </div>
          <div class="form-group">
            <label for="action-size">Size (estimate)</label>
            <input type="text" id="action-size" 
                   value="${Ne(cl(n))}" 
                   placeholder="e.g. 1 day, 8h (max 8h)">
          </div>
        </div>
        <div class="form-group">
          <label for="action-sprint-id">Sprint</label>
          <select id="action-sprint-id">
            <option value="">— None —</option>
          </select>
        </div>
        <div class="form-group">
          <label for="action-task-points">Task points (optional)</label>
          <input type="number" id="action-task-points" min="0" step="1" 
                 value="${n?.task_points!=null?String(n.task_points):""}" 
                 placeholder="e.g. 2">
        </div>
        <div class="form-group">
          <label for="action-depends-on">Depends on (other tasks)</label>
          <select id="action-depends-on" multiple class="form-select-multi">
            <option value="" disabled>Loading...</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="action-description">Description (technical)</label>
          <textarea id="action-description" rows="3" 
                    placeholder="Implementation notes">${Ne(ua(n))}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="action-priority">Priority</label>
            <select id="action-priority">
              <option value="low" ${n?.priority==="low"?"selected":""}>Low</option>
              <option value="medium" ${n?.priority==="medium"||!n?"selected":""}>Medium</option>
              <option value="high" ${n?.priority==="high"?"selected":""}>High</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="action-status">Status</label>
            <select id="action-status">
              <option value="pending" ${n?.status==="pending"||!n?"selected":""}>Pending</option>
              <option value="in_progress" ${n?.status==="in_progress"?"selected":""}>Active (In Progress)</option>
              <option value="completed" ${n?.status==="completed"?"selected":""}>Completed</option>
              <option value="cancelled" ${n?.status==="cancelled"?"selected":""}>Cancelled</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="action-assignee">Assignee</label>
            <input type="text" id="action-assignee" 
                   value="${Ne(n?.assignee??n?.owner??"")}" 
                   placeholder="Who is responsible?">
          </div>
          
          <div class="form-group">
            <label for="action-due">Due Date</label>
            <input type="date" id="action-due" 
                   value="${rl(n)}">
          </div>
        </div>
        
        <div class="form-group action-requester-picker-wrap">
          <label>Requested by (optional)</label>
          <input type="hidden" id="action-requested-by-contact-id" value="${Ne(n?.requested_by_contact_id??"")}">
          <input type="hidden" id="action-requested-by" value="${Ne(n?.requested_by??"")}">
          <div class="action-assignee-picker-trigger" id="action-modal-requester-trigger" title="Select who requested this task">
            <span class="action-assignee-picker-value" id="action-modal-requester-value">${n?.requested_by?Ne(n.requested_by):'<span class="text-muted">Select requester...</span>'}</span>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
          <div id="action-modal-requester-dropdown" class="action-assignee-picker-dropdown hidden">
            <div class="action-assignee-picker-search">
              <input type="text" id="action-modal-requester-search" placeholder="Search contacts..." autocomplete="off">
            </div>
            <div id="action-modal-requester-list" class="action-assignee-picker-list">Loading...</div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="action-dod">Definition of Done (one per line)</label>
          <textarea id="action-dod" rows="3" 
                    placeholder="e.g. Código testado localmente&#10;PR criado e revisto">${Ne(m)}</textarea>
        </div>
        
        <div class="form-group">
          <label for="action-ac">Acceptance Criteria (one per line)</label>
          <textarea id="action-ac" rows="3" 
                    placeholder="e.g. Middleware rejeita tokens inválidos com 401&#10;Testes unitários passam">${Ne(f)}</textarea>
        </div>
      </form>
    `}const l=_("div",{className:"modal-footer"});if(o&&n){const m=_("button",{className:"btn btn-primary",textContent:"Edit"}),f=_("button",{className:"btn btn-secondary",textContent:"Close"});if(n.status!=="completed"){const g=_("button",{className:"btn btn-success",textContent:"Mark Complete"});u(g,"click",async()=>{try{const v=await Le.update(n.id,{status:"completed"});h.success("Action completed"),s?.(v),U(Yt)}catch{}}),l.appendChild(g)}u(f,"click",()=>U(Yt)),u(m,"click",()=>{U(Yt),Ps({...e,mode:"edit"})}),l.appendChild(f),l.appendChild(m)}else{const m=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),f=_("button",{className:"btn btn-primary",textContent:a?"Save Changes":"Create Action"});if(u(m,"click",()=>U(Yt)),u(f,"click",async()=>{const g=c.querySelector("#action-form");if(!g.checkValidity()){g.reportValidity();return}const v=M=>c.querySelector(`#${M}`)?.value.trim()||"",y=M=>v(M).split(/\n/).map(Q=>Q.trim()).filter(Boolean),S=v("action-task"),w=c.querySelector("#action-parent-story-id"),k=c.querySelector("#action-depends-on"),x=w?.value?.trim()||void 0,b=k?Array.from(k.selectedOptions).map(M=>M.value).filter(Boolean):[],T=c.querySelector("#action-sprint-id")?.value?.trim()||void 0,A={content:S,status:v("action-status"),priority:v("action-priority"),assignee:v("action-assignee")||void 0,due_date:v("action-due")||void 0,parent_story_id:x,size_estimate:v("action-size")||void 0,description:v("action-description")||void 0,definition_of_done:y("action-dod"),acceptance_criteria:y("action-ac"),depends_on:b.length?b:void 0,requested_by:v("action-requested-by")||void 0,requested_by_contact_id:v("action-requested-by-contact-id")||void 0,sprint_id:T,task_points:(()=>{const M=v("action-task-points");if(M===""||M==null)return;const Q=Number(M);return Number.isFinite(Q)&&Q>=0?Q:void 0})()};f.disabled=!0,f.textContent="Saving...";try{if(a){const M=await Le.update(n.id,A);h.success("Action updated"),s?.(M)}else{const M=await Le.create(A);h.success("Action created"),s?.(M)}U(Yt)}catch{}finally{f.disabled=!1,f.textContent=a?"Save Changes":"Create Action"}}),a){const g=_("button",{className:"btn btn-danger",textContent:"Delete"});u(g,"click",async()=>{const{confirm:v}=await ve(async()=>{const{confirm:S}=await Promise.resolve().then(()=>vn);return{confirm:S}},void 0);if(await v("Are you sure you want to delete this action?",{title:"Delete Action",confirmText:"Delete",confirmClass:"btn-danger"}))try{await Le.delete(n.id),h.success("Action deleted"),i?.(String(n.id)),U(Yt)}catch{}}),l.appendChild(g)}l.appendChild(m),l.appendChild(f)}const d=Me({id:Yt,title:o?"Action Details":a?"Edit Action":"New Action",content:c,size:"md",footer:l});if(document.body.appendChild(d),qe(Yt),o&&n&&(n.requested_by||n.requested_by_contact_id)){const m=c.querySelector("#action-view-requester-card");m&&(async()=>{try{const g=(await Je.getAll())?.contacts||[],v=n.requested_by_contact_id,y=v?g.find(b=>b.id&&String(b.id)===String(v)):g.find(b=>(b.name||"").trim().toLowerCase()===n.requested_by?.trim().toLowerCase()||(b.name||"").toLowerCase().includes(n.requested_by?.toLowerCase()||"")),S=y?.name??n.requested_by??"",w=y?.role??"",k=y?.photoUrl||y?.avatarUrl||null,x=S?S.trim().split(/\s+/).map(b=>b[0]).join("").toUpperCase().substring(0,2):"?";y&&(m.innerHTML=`
              <div class="action-view-requester-card-inner assignee-chip">
                <div class="assignee-avatar">${k?`<img src="${Ne(k)}" alt="${Ne(S)}" onerror="this.parentElement.innerHTML='${x}'">`:x}</div>
                <div class="action-assignee-card-info">
                  <div class="action-assignee-card-name">${Ne(S)}</div>
                  ${w?`<div class="action-assignee-card-role">${Ne(w)}</div>`:""}
                </div>
              </div>
            `)}catch{}})()}if(!o&&c){(async()=>{const A=await Le.getUserStories(),M=c.querySelector("#action-parent-story-id");M&&(M.innerHTML='<option value="">— None —</option>',A.forEach(H=>{const W=document.createElement("option");W.value=H.id,W.textContent=H.story_points!=null?`${H.title} (${H.story_points} pt)`:H.title,n?.parent_story_id&&String(H.id)===String(n.parent_story_id)&&(W.selected=!0),M.appendChild(W)}));const Q=await Oo(),q=c.querySelector("#action-sprint-id");q&&(q.innerHTML='<option value="">— None —</option>',Q.forEach(H=>{const W=document.createElement("option");W.value=H.id,W.textContent=H.name,n?.sprint_id&&String(H.id)===String(n.sprint_id)&&(W.selected=!0),q.appendChild(W)}));const V=await Le.getAll(),I=c.querySelector("#action-depends-on");if(I){I.innerHTML="";const H=n?.id?String(n.id):"";V.filter(W=>String(W.id)!==H).forEach(W=>{const ee=document.createElement("option");ee.value=String(W.id),ee.textContent=(W.content||W.task||"").substring(0,60)+((W.content||W.task||"").length>60?"...":""),Array.isArray(n?.depends_on)&&n.depends_on.includes(String(W.id))&&(ee.selected=!0),I.appendChild(ee)})}})();const m=c.querySelector("#action-new-story-btn");m&&u(m,"click",async()=>{const A=window.prompt("User story title");if(!A?.trim())return;const M=window.prompt("Story points (optional, number). Leave empty to skip.");let Q;if(M!=null&&M.trim()!==""){const q=Number(M.trim());Number.isFinite(q)&&q>=0&&(Q=q)}try{const q=await Le.addUserStory({title:A.trim(),story_points:Q}),V=c.querySelector("#action-parent-story-id");if(V){const I=document.createElement("option");I.value=q.id,I.textContent=q.story_points!=null?`${q.title} (${q.story_points} pt)`:q.title,I.selected=!0,V.appendChild(I)}h.success("User story created")}catch(q){h.error(q.message||"Failed to create story")}});const f=c.querySelector("#action-edit-story-btn");f&&u(f,"click",async()=>{const A=c.querySelector("#action-parent-story-id"),M=A?.value?.trim();if(!M){h.error("Select a user story first");return}try{const Q=await Le.getUserStory(M);if(!Q){h.error("Story not found");return}const q=window.prompt("User story title",Q.title);if(q==null)return;const V=q.trim();if(!V){h.error("Title is required");return}const I=window.prompt("Story points (optional, number). Leave empty to clear.",Q.story_points!=null?String(Q.story_points):"");let H;if(I!=null)if(I.trim()==="")H=null;else{const W=Number(I.trim());Number.isFinite(W)&&W>=0&&(H=W)}if(await Le.updateUserStory(M,{title:V,...H!==void 0?{story_points:H}:{}}),A){const W=A.selectedOptions?.[0];W&&(W.textContent=H!=null?`${V} (${H} pt)`:V)}h.success("User story updated")}catch(Q){h.error(Q.message||"Failed to update story")}});const g=async(A,M)=>{const q=c.querySelector("#action-description-draft")?.value?.trim()||"";if(!q){h.error("Enter a short description first");return}A.textContent="Generating...",A.disabled=!0;try{const I=c.querySelector("#action-parent-story-id")?.selectedOptions?.[0]?.textContent||"",H=await Le.suggestTaskFromDescription({user_input:q,parent_story_ref:I||void 0});c.querySelector("#action-task").value=H.task,c.querySelector("#action-description").value=H.description,c.querySelector("#action-size").value=H.size_estimate,c.querySelector("#action-dod").value=H.definition_of_done.join(`
`),c.querySelector("#action-ac").value=H.acceptance_criteria.join(`
`),h.success(A.id==="action-regenerate-ai-btn"?"Task regenerated with AI":"Task generated from description")}catch(V){h.error(V.message||"Failed to generate")}finally{A.disabled=!1,A.textContent=M}},v=c.querySelector("#action-generate-btn");v&&u(v,"click",()=>g(v,"Generate from description"));const y=c.querySelector("#action-regenerate-ai-btn");y&&u(y,"click",()=>g(y,"Regenerate with AI"));const S=c.querySelector("#action-modal-requester-trigger"),w=c.querySelector("#action-modal-requester-dropdown"),k=c.querySelector("#action-modal-requester-value"),x=c.querySelector("#action-modal-requester-list"),b=c.querySelector("#action-modal-requester-search"),C=c.querySelector("#action-requested-by-contact-id"),T=c.querySelector("#action-requested-by");if(S&&w&&x&&C&&T){let A=[];const M=ee=>{const te=document.createElement("div");return te.textContent=ee,te.innerHTML},Q=(ee="")=>{const te=ee?A.filter(ue=>(ue.name||"").toLowerCase().includes(ee.toLowerCase())||(ue.role||"").toLowerCase().includes(ee.toLowerCase())):A;if(A.length===0){x.innerHTML='<div class="empty-state">Loading...</div>';return}x.innerHTML='<div class="action-assignee-card-picker" data-contact-id="" data-contact-name=""><div class="action-assignee-card-info"><div class="action-assignee-card-name text-muted">No requester</div></div></div>'+te.map(ue=>`
            <div class="action-assignee-card-picker" data-contact-id="${M(ue.id)}" data-contact-name="${M(ue.name||"")}">
              <div class="action-assignee-card-info">
                <div class="action-assignee-card-name">${M(ue.name||"")}</div>
                ${ue.role?`<div class="action-assignee-card-role">${M(ue.role)}</div>`:""}
              </div>
            </div>
          `).join(""),x.querySelectorAll(".action-assignee-card-picker").forEach(ue=>{u(ue,"click",()=>{const Pe=ue.getAttribute("data-contact-id")||"",ze=ue.getAttribute("data-contact-name")||"";C.value=Pe,T.value=ze,k&&(k.innerHTML=ze?M(ze):'<span class="text-muted">Select requester...</span>'),w.classList.add("hidden")})})};u(S,"click",async ee=>{ee.stopPropagation();const te=!w.classList.contains("hidden");if(w.classList.toggle("hidden",te),!te&&A.length===0){x.innerHTML='<div class="empty-state">Loading...</div>';try{A=((await Je.getAll())?.contacts||[]).map(Pe=>({id:Pe.id,name:Pe.name||"",role:Pe.role})),Q(b?.value||"")}catch{x.innerHTML='<div class="empty-state">Failed to load contacts</div>'}}else te||Q(b?.value||"")}),b&&b.addEventListener("input",()=>Q(b.value));const q=()=>{w&&!w.classList.contains("hidden")&&w.classList.add("hidden")};let V=!1;const I=()=>{V||(V=!0,document.removeEventListener("click",H),document.removeEventListener("keydown",W))},H=ee=>{if(!document.querySelector(`[data-modal-id="${Yt}"]`)?.classList.contains("open")){I();return}ee.target.closest(".action-requester-picker-wrap")||q()},W=ee=>{if(!document.querySelector(`[data-modal-id="${Yt}"]`)?.classList.contains("open")){I();return}ee.key==="Escape"&&q()};document.addEventListener("click",H),document.addEventListener("keydown",W)}}}function Ne(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const oi="create-sprint-modal";function Gi(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function mx(e={}){const{onSuccess:t}=e,n=document.querySelector(`[data-modal-id="${oi}"]`);n&&n.remove();const s=_("div",{className:"create-sprint-modal-content"});s.innerHTML=`
    <form id="create-sprint-form" class="create-sprint-form">
      <div class="form-group">
        <label for="sprint-name">Sprint name *</label>
        <input type="text" id="sprint-name" required placeholder="e.g. Sprint 12">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sprint-start">Start date *</label>
          <input type="date" id="sprint-start" required>
        </div>
        <div class="form-group">
          <label for="sprint-end">End date *</label>
          <input type="date" id="sprint-end" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sprint-analysis-start">Analysis period start</label>
          <input type="date" id="sprint-analysis-start" title="From when to consider emails/transcripts">
        </div>
        <div class="form-group">
          <label for="sprint-analysis-end">Analysis period end</label>
          <input type="date" id="sprint-analysis-end" title="Until when to consider emails/transcripts">
        </div>
      </div>
      <div class="form-group">
        <label for="sprint-context">Sprint context / goals</label>
        <textarea id="sprint-context" rows="3" placeholder="What is the focus of this sprint? Goals, priorities..."></textarea>
      </div>
    </form>
    <div id="create-sprint-step2" class="create-sprint-preview hidden">
      <p class="create-sprint-preview-intro">Review proposed tasks and existing actions to link. Then click Apply.</p>
      <div class="form-group">
        <label>New tasks to create</label>
        <div id="create-sprint-new-tasks-list" class="create-sprint-tasks-list"></div>
      </div>
      <div class="form-group">
        <label>Existing actions to add to this sprint</label>
        <div id="create-sprint-existing-list" class="create-sprint-existing-list"></div>
      </div>
    </div>
  `;const i=_("div",{className:"modal-footer"});i.innerHTML=`
    <button type="button" class="btn btn-secondary" id="create-sprint-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-primary" id="create-sprint-generate-btn">Create Sprint & Generate Tasks</button>
    <button type="button" class="btn btn-primary hidden" id="create-sprint-apply-btn">Apply</button>
  `;const a=Me({id:oi,title:"Create Sprint",content:s,size:"lg",closable:!0,footer:i,onClose:()=>{}});document.body.appendChild(a),qe(oi);let o=null,r=[],c=[];const l=new Map,d=S=>s.querySelector(`#${S}`)?.value?.trim()||"",m=s.querySelector("#create-sprint-form"),f=s.querySelector("#create-sprint-step2"),g=s.querySelector("#create-sprint-generate-btn"),v=s.querySelector("#create-sprint-apply-btn"),y=s.querySelector("#create-sprint-cancel-btn");u(y,"click",()=>U(oi)),u(g,"click",async()=>{if(!m.checkValidity()){m.reportValidity();return}const S=d("sprint-name"),w=d("sprint-start"),k=d("sprint-end");if(new Date(k)<new Date(w)){h.error("End date must be after start date");return}g.disabled=!0,g.textContent="Creating...";try{o=await sx({name:S,start_date:w,end_date:k,context:d("sprint-context")||void 0,analysis_start_date:d("sprint-analysis-start")||void 0,analysis_end_date:d("sprint-analysis-end")||void 0}),g.textContent="Generating tasks...";const x=await ix(o.id,{analysis_start_date:d("sprint-analysis-start")||void 0,analysis_end_date:d("sprint-analysis-end")||void 0});r=x.proposed_new_tasks||[],c=x.existing_action_ids||[];const b=x.existing_details||[];m.classList.add("hidden"),f.classList.remove("hidden"),g.classList.add("hidden"),v.classList.remove("hidden");const C=s.querySelector("#create-sprint-new-tasks-list");C.innerHTML=r.length?r.map((A,M)=>`
          <div class="create-sprint-task-item" data-index="${M}">
            <div class="create-sprint-task-title">${Gi((A.task||"").slice(0,120))}${(A.task||"").length>120?"…":""}</div>
            ${A.size_estimate?`<span class="create-sprint-task-size">${Gi(A.size_estimate)}</span>`:""}
          </div>
        `).join(""):'<p class="text-muted">No new tasks suggested.</p>';const T=s.querySelector("#create-sprint-existing-list");l.clear(),b.length?(T.innerHTML=b.map(A=>{const M=c.includes(A.id);return`
            <label class="create-sprint-existing-item">
              <input type="checkbox" data-action-id="${A.id}" ${M?"checked":""}>
              <span>${Gi((A.task||"").slice(0,80))}${(A.task||"").length>80?"…":""}</span>
              <span class="create-sprint-existing-status">${Gi(A.status||"")}</span>
            </label>
          `}).join(""),T.querySelectorAll("input[type=checkbox]").forEach(A=>{l.set(A.dataset.actionId,A)})):T.innerHTML='<p class="text-muted">No existing actions suggested.</p>',h.success("Sprint created. Review and click Apply to add tasks.")}catch(x){h.error(x.message||"Failed")}finally{g.disabled=!1,g.textContent="Create Sprint & Generate Tasks"}}),u(v,"click",async()=>{if(!o)return;const S=Array.from(l.entries()).filter(([,w])=>w.checked).map(([w])=>w);v.disabled=!0,v.textContent="Applying...";try{await ox(o.id,{new_tasks:r,existing_action_ids:S}),h.success("Sprint applied. New tasks created and existing actions linked."),U(oi),t?.(o)}catch(w){h.error(w.message||"Apply failed")}finally{v.disabled=!1,v.textContent="Apply"}})}const gx={pending:"var(--color-neutral-400)",in_progress:"var(--color-info-500)",completed:"var(--color-success-500)",cancelled:"var(--color-neutral-500)",overdue:"var(--color-danger-500)"};function fx(e){return e.replace(/_/g," ").replace(/\b\w/g,t=>t.toUpperCase())}function zu(e){const{byStatus:t,byAssignee:n={},height:s=220,showAssignee:i=!0}=e,a=_("div",{className:"breakdown-chart-container"});a.style.height=`${s}px`;const o=Object.entries(t).filter(([,d])=>d>0),r=Object.entries(n).filter(([,d])=>d>0);if(o.length===0&&r.length===0)return a.innerHTML='<div class="empty-chart">No data for breakdown</div>',a;const c=`breakdown-chart-${Date.now()}`;a.innerHTML=`
    <div class="breakdown-chart-wrapper">
      <div class="breakdown-chart-section">
        <div class="breakdown-chart-title">By status</div>
        <canvas id="${c}-status" width="280" height="${Math.min(180,s-40)}"></canvas>
      </div>
      ${i&&r.length>0?`
      <div class="breakdown-chart-section">
        <div class="breakdown-chart-title">By assignee</div>
        <canvas id="${c}-assignee" width="280" height="${Math.min(180,s-40)}"></canvas>
      </div>
      `:""}
    </div>
  `;const l=a.querySelector(`#${c}-status`);if(l&&o.length>0){const d=o.map(([g])=>fx(g)),m=o.map(([,g])=>g),f=o.map(([g])=>g);ul(l,d,m,(g,v)=>gx[f[v]]||"#6366f1")}if(i&&r.length>0){const d=a.querySelector(`#${c}-assignee`);if(d){const m=["var(--color-info-500)","var(--color-success-500)","var(--color-warning-500)","var(--color-danger-500)","var(--color-accent-500)"];ul(d,r.map(([f])=>f||"(unassigned)"),r.map(([,f])=>f),(f,g)=>m[g%m.length])}}return a}function ul(e,t,n,s){if(typeof window.Chart>"u"){hx(e.parentElement,t,n,(o,r)=>s(o,r));return}const i=window.Chart,a=t.map((o,r)=>s(o,r));new i(e,{type:"bar",data:{labels:t,datasets:[{label:"Count",data:n,backgroundColor:a,borderColor:a.map(o=>o),borderWidth:1}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{y:{beginAtZero:!0,ticks:{stepSize:1}}}}})}function hx(e,t,n,s){const i=Math.max(...n,1),a=t.map((r,c)=>{const l=n[c],d=l/i*100,m=s(r,c);return`<div class="breakdown-fallback-bar"><span class="bar-label">${vx(r)}</span><div class="bar-track"><div class="bar-fill" style="width:${d}%;background:${m}"></div></div><span class="bar-value">${l}</span></div>`}).join(""),o=document.createElement("div");o.className="breakdown-fallback",o.innerHTML=a,e.appendChild(o)}function vx(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const Wi="sprint-report-modal";function lt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function bx(e){const{sprintId:t,sprintName:n="Sprint"}=e,s=document.querySelector(`[data-modal-id="${Wi}"]`);s&&s.remove();const i=_("div",{className:"sprint-report-modal-content"});i.innerHTML=`
    <div class="sprint-report-loading">Loading report...</div>
    <div id="sprint-report-body" class="sprint-report-body hidden">
      <div class="sprint-report-export-section">
        <h4>Export as</h4>
        <div class="sprint-report-format-row">
          <label class="sprint-report-format-option">
            <input type="radio" name="sprint-report-format" value="document" checked> Document (A4)
          </label>
          <label class="sprint-report-format-option">
            <input type="radio" name="sprint-report-format" value="presentation"> Presentation (PPT)
          </label>
        </div>
        <div id="sprint-report-document-options" class="sprint-report-format-options">
          <label class="sprint-report-style-row">
            <span>Style:</span>
            <select id="sprint-report-document-style">
              <option value="">Default</option>
              <option value="sprint_report_style_corporate_classic">Corporativo clássico</option>
              <option value="sprint_report_style_modern_minimal">Moderno minimalista</option>
              <option value="sprint_report_style_startup_tech">Startup / Tech</option>
              <option value="sprint_report_style_consultancy">Consultoria / Enterprise</option>
            </select>
          </label>
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-include-analysis"> Include AI analysis</label>
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-include-business"> Include business report</label>
        </div>
        <div id="sprint-report-presentation-options" class="sprint-report-format-options hidden">
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-ppt-include-analysis"> Include AI analysis</label>
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-ppt-include-business"> Include business report</label>
        </div>
        <div class="sprint-report-generate-row">
          <button type="button" class="btn btn-primary" id="sprint-report-generate-doc-btn">Generate document (A4)</button>
          <button type="button" class="btn btn-primary hidden" id="sprint-report-generate-ppt-btn">Generate presentation (PPT)</button>
          <label class="sprint-report-check sprint-report-pdf-option"><input type="checkbox" id="sprint-report-open-for-pdf"> Open for PDF (print dialog)</label>
        </div>
        <div id="sprint-report-generate-status" class="sprint-report-generate-status hidden"></div>
      </div>
      <div class="sprint-report-summary" id="sprint-report-summary"></div>
      <div class="sprint-report-chart" id="sprint-report-chart"></div>
      <div class="sprint-report-actions-list" id="sprint-report-actions"></div>
      <div class="sprint-report-ai-section">
        <h4>AI analysis</h4>
        <div id="sprint-report-ai-placeholder" class="sprint-report-ai-placeholder">Click "Analyze with AI" to generate.</div>
        <div id="sprint-report-ai-content" class="sprint-report-ai-content hidden"></div>
      </div>
      <div class="sprint-report-business-section">
        <h4>Business report</h4>
        <div id="sprint-report-business-placeholder" class="sprint-report-business-placeholder">Click "Business report" to generate.</div>
        <div id="sprint-report-business-content" class="sprint-report-business-content hidden"></div>
      </div>
    </div>
    <div id="sprint-report-error" class="sprint-report-error hidden"></div>
  `;const a=_("div",{className:"modal-footer"});a.innerHTML=`
    <button type="button" class="btn btn-outline-secondary" id="sprint-report-export-pdf-btn">Export report as PDF</button>
    <button type="button" class="btn btn-secondary" id="sprint-report-analyze-btn">Analyze with AI</button>
    <button type="button" class="btn btn-outline-primary" id="sprint-report-business-btn">Business report</button>
    <button type="button" class="btn btn-primary" id="sprint-report-close-btn">Close</button>
  `;const o=Me({id:Wi,title:`Sprint report: ${lt(n)}`,content:i,size:"xl",closable:!0,footer:a,onClose:()=>{}});document.body.appendChild(o),qe(Wi);let r=null;async function c(){const w=i.querySelector(".sprint-report-loading"),k=i.querySelector("#sprint-report-body"),x=i.querySelector("#sprint-report-error");if(!(!w||!k||!x))try{const b=await ax(t);if(!b){x.textContent="Failed to load report",x.classList.remove("hidden"),w.classList.add("hidden");return}r=b,w.classList.add("hidden"),x.classList.add("hidden"),k.classList.remove("hidden");const C=i.querySelector("#sprint-report-summary");if(C){const M=b.total_tasks?Math.round(b.completed_tasks/b.total_tasks*100):0,Q=b.total_task_points>0?` · ${b.completed_task_points}/${b.total_task_points} points`:"";C.innerHTML=`
          <p><strong>${b.completed_tasks}</strong> / <strong>${b.total_tasks}</strong> tasks completed (${M}%)${Q}</p>
          <p class="sprint-report-dates">${b.sprint.start_date} – ${b.sprint.end_date}</p>
          ${b.sprint.context?`<p class="sprint-report-context">${lt(b.sprint.context)}</p>`:""}
        `}const T=i.querySelector("#sprint-report-chart");T&&(T.innerHTML="",T.appendChild(zu({byStatus:b.breakdown.by_status,byAssignee:b.breakdown.by_assignee,height:200,showAssignee:!0})));const A=i.querySelector("#sprint-report-actions");A&&b.actions.length>0?A.innerHTML=`
          <h4>Tasks (${b.actions.length})</h4>
          <ul class="sprint-report-task-list">
            ${b.actions.map(M=>`<li class="sprint-report-task-item" data-status="${lt((M.status||"pending").toLowerCase())}">
                    <span class="task-status-dot"></span>
                    ${lt(M.task||M.content||"—")}
                    ${M.task_points!=null?`<span class="task-points">${M.task_points} pt</span>`:""}
                  </li>`).join("")}
          </ul>
        `:A&&(A.innerHTML='<p class="sprint-report-no-tasks">No tasks in this sprint.</p>')}catch(b){w.classList.add("hidden"),k.classList.add("hidden"),x.textContent=b instanceof Error?b.message:"Failed to load report",x.classList.remove("hidden")}}u(a.querySelector("#sprint-report-close-btn"),"click",()=>U(Wi));function l(){if(!r){h.error("Report not loaded yet");return}const w=r.sprint,k=i.querySelector("#sprint-report-ai-content"),x=i.querySelector("#sprint-report-business-content"),b=k&&!k.classList.contains("hidden")?k.innerHTML:"",C=x&&!x.classList.contains("hidden")?x.innerHTML:"",T=r.breakdown.by_status||{},A=r.breakdown.by_assignee||{},M=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sprint Report – ${lt(w.name)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #333; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.15rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
  p, ul { margin: 0.5rem 0; }
  ul { padding-left: 1.5rem; }
  .meta { color: #666; font-size: 0.9rem; }
  .section { margin-top: 1rem; }
  @media print { body { margin: 1rem; } }
</style></head><body>
  <h1>${lt(w.name)}</h1>
  <p class="meta">${lt(w.start_date)} – ${lt(w.end_date)}</p>
  ${w.context?`<p>${lt(w.context)}</p>`:""}
  <div class="section">
    <h2>Summary</h2>
    <p><strong>${r.completed_tasks}</strong> / <strong>${r.total_tasks}</strong> tasks completed${r.total_task_points>0?` · ${r.completed_task_points}/${r.total_task_points} points`:""}.</p>
  </div>
  <div class="section">
    <h2>By status</h2>
    <ul>${Object.entries(T).map(([I,H])=>`<li>${lt(I)}: ${H}</li>`).join("")}</ul>
  </div>
  <div class="section">
    <h2>By assignee</h2>
    <ul>${Object.entries(A).map(([I,H])=>`<li>${lt(I)}: ${H}</li>`).join("")}</ul>
  </div>
  <div class="section">
    <h2>Tasks</h2>
    <ul>${r.actions.slice(0,100).map(I=>`<li>${lt(I.status||"pending")}: ${lt((I.task||I.content||"—").substring(0,200))}${I.task_points!=null?` (${I.task_points} pt)`:""}</li>`).join("")}</ul>
    ${r.actions.length>100?`<p class="meta">… and ${r.actions.length-100} more tasks</p>`:""}
  </div>
  ${b?`<div class="section"><h2>AI analysis</h2><div>${b}</div></div>`:""}
  ${C?`<div class="section"><h2>Business report</h2><div>${C}</div></div>`:""}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`,Q=new Blob([M],{type:"text/html;charset=utf-8"}),q=URL.createObjectURL(Q),V=window.open(q,"_blank","noopener");V?V.addEventListener("load",()=>URL.revokeObjectURL(q),{once:!0}):(h.error("Allow pop-ups to export PDF"),URL.revokeObjectURL(q))}const d=a.querySelector("#sprint-report-export-pdf-btn");d&&u(d,"click",()=>l());const m=i.querySelector("#sprint-report-document-options"),f=i.querySelector("#sprint-report-presentation-options"),g=i.querySelector("#sprint-report-generate-doc-btn"),v=i.querySelector("#sprint-report-generate-ppt-btn");i.querySelectorAll('input[name="sprint-report-format"]').forEach(w=>{u(w,"change",()=>{const k=i.querySelector('input[name="sprint-report-format"]:checked')?.value==="document";m&&m.classList.toggle("hidden",!k),f&&f.classList.toggle("hidden",k),g&&g.classList.toggle("hidden",!k),v&&v.classList.toggle("hidden",k)})});function y(w,k=!1){let x=w;if(k){const T="<script>window.onload=function(){window.print();}<\/script>";x.includes("</body>")?x=x.replace("</body>",T+"</body>"):x.includes("</html>")?x=x.replace("</html>",T+"</html>"):x=x+T}const b=new Blob([x],{type:"text/html;charset=utf-8"}),C=URL.createObjectURL(b);window.open(C,"_blank","noopener"),URL.revokeObjectURL(C)}const S=i.querySelector("#sprint-report-generate-status");g&&u(g,"click",async()=>{if(S){g.disabled=!0,S.classList.remove("hidden"),S.textContent="Generating document…";try{const w=i.querySelector("#sprint-report-document-style")?.value||"",k=i.querySelector("#sprint-report-include-analysis")?.checked??!1,x=i.querySelector("#sprint-report-include-business")?.checked??!1,b=await lx(t,{include_analysis:k,include_business:x,style:w||void 0}),C=i.querySelector("#sprint-report-open-for-pdf")?.checked??!1;S.textContent=C?"Done. Opening for PDF…":"Done. Opening in new tab…",y(b.html,C)}catch(w){h.error(w instanceof Error?w.message:"Failed to generate document"),S.textContent=""}finally{g.disabled=!1}}}),v&&u(v,"click",async()=>{if(S){v.disabled=!0,S.classList.remove("hidden"),S.textContent="Generating presentation…";try{const w=i.querySelector("#sprint-report-ppt-include-analysis")?.checked??!1,k=i.querySelector("#sprint-report-ppt-include-business")?.checked??!1,x=await dx(t,{include_analysis:w,include_business:k}),b=i.querySelector("#sprint-report-open-for-pdf")?.checked??!1;S.textContent=b?"Done. Opening for PDF…":"Done. Opening in new tab…",y(x.html,b)}catch(w){h.error(w instanceof Error?w.message:"Failed to generate presentation"),S.textContent=""}finally{v.disabled=!1}}}),u(a.querySelector("#sprint-report-analyze-btn"),"click",async()=>{const w=a.querySelector("#sprint-report-analyze-btn"),k=i.querySelector("#sprint-report-ai-placeholder"),x=i.querySelector("#sprint-report-ai-content");if(!(!w||!k||!x)){w.disabled=!0,k.textContent="Analyzing...";try{const b=await rx(t);k.classList.add("hidden"),x.classList.remove("hidden"),x.innerHTML=b.ai_analysis?`<div class="sprint-report-ai-text">${lt(b.ai_analysis).replace(/\n/g,"<br>")}</div>`:`<div class="sprint-report-ai-text">${lt(b.error||"No analysis available.")}</div>`}catch(b){h.error(b instanceof Error?b.message:"Analysis failed"),k.textContent='Click "Analyze with AI" to generate.'}finally{w.disabled=!1}}}),u(a.querySelector("#sprint-report-business-btn"),"click",async()=>{const w=a.querySelector("#sprint-report-business-btn"),k=i.querySelector("#sprint-report-business-placeholder"),x=i.querySelector("#sprint-report-business-content");if(!(!w||!k||!x)){w.disabled=!0,k.textContent="Generating...";try{const b=await cx(t);k.classList.add("hidden"),x.classList.remove("hidden"),x.innerHTML=b.business_report?`<div class="sprint-report-business-text">${lt(b.business_report).replace(/\n/g,"<br>")}</div>`:`<div class="sprint-report-business-text">${lt(b.error||"No business report available.")}</div>`}catch(b){h.error(b instanceof Error?b.message:"Business report failed"),k.textContent='Click "Business report" to generate.'}finally{w.disabled=!1}}}),c()}function Iu(e){const t=_("div",{className:"comments-thread"});t.innerHTML=`
    <div class="comments-header">
      <h4>Comments</h4>
      <span class="comments-count" id="comments-count">0</span>
    </div>
    <div class="comments-list" id="comments-list">
      <div class="loading">Loading comments...</div>
    </div>
    <div class="comment-form">
      <textarea id="comment-input" placeholder="Add a comment..." rows="2"></textarea>
      <div class="comment-form-actions">
        <button class="btn btn-primary btn-sm" id="submit-comment-btn" disabled>Comment</button>
      </div>
    </div>
  `;const n=t.querySelector("#comment-input"),s=t.querySelector("#submit-comment-btn");return u(n,"input",()=>{s.disabled=!n.value.trim()}),u(s,"click",()=>pl(t,e,n)),u(n,"keydown",i=>{i.key==="Enter"&&(i.ctrlKey||i.metaKey)&&(i.preventDefault(),n.value.trim()&&pl(t,e,n))}),_i(t,e),t}async function _i(e,t){const n=e.querySelector("#comments-list");n.innerHTML='<div class="loading">Loading...</div>';try{const s=await Ls.getAll(t.targetType,t.targetId);yx(n,s,e,t),xx(e,s.length)}catch{n.innerHTML='<div class="error">Failed to load comments</div>'}}function yx(e,t,n,s){if(t.length===0){e.innerHTML='<div class="empty">No comments yet</div>';return}const i=t.filter(r=>!r.parent_id),a=t.filter(r=>r.parent_id),o={};a.forEach(r=>{o[r.parent_id]||(o[r.parent_id]=[]),o[r.parent_id].push(r)}),e.innerHTML=i.map(r=>wx(r,o[r.id]||[])).join(""),kx(e,t,n,s)}function wx(e,t,n,s){const i=z.getState().currentUser,a=i?.id===e.user_id;return`
    <div class="comment ${e.resolved?"resolved":""}" data-id="${e.id}">
      <div class="comment-avatar">${ml(e.user_name||"U")}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${Qi(e.user_name||"Unknown")}</span>
          <span class="comment-time">${Ee(e.created_at)}</span>
          ${e.resolved?'<span class="resolved-badge">Resolved</span>':""}
        </div>
        <div class="comment-content">${Qi(e.content)}</div>
        <div class="comment-actions">
          <button class="btn-link reply-btn">Reply</button>
          ${e.resolved?"":'<button class="btn-link resolve-btn">Resolve</button>'}
          ${a?'<button class="btn-link delete-btn">Delete</button>':""}
        </div>
        <div class="reply-form hidden">
          <textarea class="reply-input" placeholder="Reply..." rows="2"></textarea>
          <div class="reply-actions">
            <button class="btn btn-sm cancel-reply-btn">Cancel</button>
            <button class="btn btn-primary btn-sm submit-reply-btn">Reply</button>
          </div>
        </div>
      </div>
    </div>
    ${t.length>0?`
      <div class="comment-replies">
        ${t.map(o=>`
          <div class="comment reply" data-id="${o.id}">
            <div class="comment-avatar small">${ml(o.user_name||"U")}</div>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-author">${Qi(o.user_name||"Unknown")}</span>
                <span class="comment-time">${Ee(o.created_at)}</span>
              </div>
              <div class="comment-content">${Qi(o.content)}</div>
              ${i?.id===o.user_id?`
                <div class="comment-actions">
                  <button class="btn-link delete-btn">Delete</button>
                </div>
              `:""}
            </div>
          </div>
        `).join("")}
      </div>
    `:""}
  `}function kx(e,t,n,s){e.querySelectorAll(".reply-btn").forEach(i=>{u(i,"click",()=>{const o=i.closest(".comment")?.querySelector(".reply-form");o&&(o.classList.toggle("hidden"),o.querySelector(".reply-input")?.focus())})}),e.querySelectorAll(".cancel-reply-btn").forEach(i=>{u(i,"click",()=>{const a=i.closest(".reply-form");a&&(a.classList.add("hidden"),a.querySelector(".reply-input").value="")})}),e.querySelectorAll(".submit-reply-btn").forEach(i=>{u(i,"click",async()=>{const a=i.closest(".comment"),o=a?.getAttribute("data-id"),r=a?.querySelector(".reply-input");if(!(!o||!r?.value.trim()))try{await Ls.create(s.targetType,s.targetId,r.value.trim(),o),h.success("Reply added"),_i(n,s)}catch{h.error("Failed to add reply")}})}),e.querySelectorAll(".resolve-btn").forEach(i=>{u(i,"click",async()=>{const o=i.closest(".comment")?.getAttribute("data-id");if(o)try{await Ls.resolve(o),h.success("Comment resolved"),_i(n,s)}catch{h.error("Failed to resolve comment")}})}),e.querySelectorAll(".delete-btn").forEach(i=>{u(i,"click",async()=>{const o=i.closest(".comment")?.getAttribute("data-id");if(!(!o||!confirm("Delete this comment?")))try{await Ls.delete(o),h.success("Comment deleted"),_i(n,s)}catch{h.error("Failed to delete comment")}})})}async function pl(e,t,n){const s=n.value.trim();if(!s)return;const i=e.querySelector("#submit-comment-btn");i.disabled=!0;try{const a=await Ls.create(t.targetType,t.targetId,s);n.value="",h.success("Comment added"),_i(e,t),t.onCommentAdded?.(a)}catch{h.error("Failed to add comment"),i.disabled=!1}}function xx(e,t){const n=e.querySelector("#comments-count");n&&(n.textContent=String(t))}function ml(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function Qi(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const $x=()=>z.getState(),gl=()=>$x().currentProject;function at(e){return e.trim().split(/\s+/).map(t=>t[0]).join("").toUpperCase().substring(0,2)}function X(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function pa(e){if(!e)return"—";try{return hs(e)}catch{return e}}function Ki(e){return e.content??e.task??""}function Sx(e){return{created:"📝",updated:"✏️",deleted:"🗑️",restored:"↩️",refined_with_ai:"✨",rollback:"↩️"}[e]||"•"}function _x(e){const t=e.event_data||{},n=e.actor_name?` by ${e.actor_name}`:"";switch(e.event_type){case"created":return`Created${n}`;case"refined_with_ai":return`Refined with AI${n}`;case"rollback":return`Restored previous version${n}`;case"updated":{const s=t.changes||[];if(s.length===0)return`Updated${n}`;const i=["Description","Task","DoD","Acceptance criteria"];if(s.some(o=>i.includes(o.field))&&s.length>=2)return`Fields updated${n}`;if(s.length===1){const o=s[0],r=String(o.to).trim()?o.to:"—",c=String(o.from).trim()?o.from:"—";return`${o.field} changed: ${c} → ${r}${n}`}return`${s.map(o=>`${o.field}: ${o.from||"—"} → ${o.to||"—"}`).join("; ")}${n}`}case"deleted":return`Deleted${t.reason?` (${t.reason})`:""}${n}`;case"restored":return`Restored${n}`;default:return e.event_type}}function Hu(e){return!Array.isArray(e)||e.length===0?[]:e.map(t=>typeof t=="string"?{text:t,done:!1}:{text:(t.text??"").toString(),done:!!t.done})}function fl(e,t){const n=Hu(e.definition_of_done||[]),s=(e.acceptance_criteria||[]).map(l=>typeof l=="string"?l:String(l)),i=[];(e.parent_story_ref||e.parent_story_id)&&i.push(`<dt>Parent</dt><dd>${X(String(e.parent_story_ref||e.parent_story_id))}</dd>`),e.size_estimate&&i.push(`<dt>Size</dt><dd>${X(e.size_estimate)}</dd>`);const a=i.length?`<dl class="action-description-dl">${i.join("")}</dl>`:"",o=e.description?`<div class="action-description-text"><strong>Description</strong><p>${X(e.description).replace(/\n/g,"<br>")}</p></div>`:"",r=n.length?`<div class="action-dod"><strong>Definition of Done</strong><ul class="action-checklist action-dod-list">${n.map((l,d)=>`<li class="dod-item ${l.done?"dod-done":""}" data-dod-index="${d}"><button type="button" class="dod-item-toggle" data-dod-index="${d}" aria-label="${l.done?"Mark undone":"Mark done"}">${l.done?"✔":"☐"}</button><span class="dod-item-text">${X(l.text)}</span></li>`).join("")}</ul></div>`:"",c=s.length?`<div class="action-ac"><strong>Acceptance criteria</strong><ul class="action-checklist">${s.map(l=>`<li>${X(l)}</li>`).join("")}</ul></div>`:"";return`${a}${o}${r}${c}`}function bo(e){const{action:t,onClose:n,onUpdate:s,onDecisionClick:i}=e;let a=t;const o=_("div",{className:"action-detail-view question-detail-view"}),r=Ki(t),c=t.due_date??t.deadline??"",l=t.assignee??t.owner??"",d=gl()?.name??null;o.innerHTML=`
    <div class="question-detail-header action-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Actions</a>
        <span class="breadcrumb-separator">›</span>
        ${d?`<span class="breadcrumb-project" title="Project">${X(d)}</span><span class="breadcrumb-separator">›</span>`:""}
        <span class="breadcrumb-current">Action #${String(t.id).substring(0,8)}</span>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="action-refine-ai-btn" title="Refine task description, DoD and acceptance criteria with AI">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Refine with AI
        </button>
        <span class="status-badge status-${(t.status||"pending").toLowerCase()}">${X(String(t.status).replace("_"," "))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content action-detail-content">
      <div id="action-view-content">
        <section class="detail-section action-main">
          <div class="question-badges action-badges">
            ${d?`<span class="project-badge" title="Project">${X(d)}</span>`:""}
            ${t.priority?`<span class="priority-pill priority-${t.priority}">${X(t.priority)}</span>`:""}
            <span class="question-date action-date">Created ${Ee(t.created_at)}</span>
          </div>
          <h2 class="question-text action-task-text">${X(r)}</h2>
        </section>

        <section class="detail-section action-description-structured" id="action-description-section">
          <h3 class="section-header-sota">Description</h3>
          <div class="action-description-body">${fl(t)}</div>
        </section>

        <div class="detail-columns">
          <div class="detail-column-left">
            <!-- Assignment Section - SOTA (aligned with Questions) -->
            <section class="detail-section" id="action-assignment-section">
              <div class="section-header-sota">
                <h3>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Assignment
                  <span class="section-subtitle">Who should do this?</span>
                </h3>
                <button type="button" class="btn-ai-suggest" id="action-ai-suggest-btn" title="Suggest who should do this task (assignee) from task content">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  AI Suggest
                </button>
              </div>

              <!-- Current Assignment Display -->
              <div id="action-current-assignment" class="current-assignment-card">
                ${l?`
                  <div class="assigned-contact-display">
                    <div class="contact-avatar-lg" id="action-assigned-avatar">${at(l)}</div>
                    <div class="contact-details">
                      <div class="contact-name-lg">${X(l)}</div>
                      <div class="contact-role-sm" id="action-assigned-role">—</div>
                    </div>
                    <button class="btn-change-assignment" id="action-change-assignee-btn" type="button">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      Change
                    </button>
                  </div>
                `:`
                  <div class="no-assignment">
                    <div class="no-assignment-icon">
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                    </div>
                    <span>No one assigned</span>
                    <p class="no-assignment-hint">Use AI Suggest or choose manually</p>
                    <button class="btn-assign-now" id="action-show-picker-btn" type="button">Choose Manually</button>
                  </div>
                `}
              </div>

              <!-- Contact Picker (hidden by default) -->
              <div id="action-contact-picker" class="contact-picker-sota hidden">
                <div class="picker-search">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input type="text" id="action-contact-search" placeholder="Search contacts..." autocomplete="off">
                </div>
                <div id="action-contact-list" class="contact-list-grid">Loading...</div>
              </div>

              <!-- AI Suggestions Panel -->
              <div id="action-suggestions-panel" class="suggestions-panel-sota action-suggestions-panel hidden gm-mb-3"></div>

              <!-- Due date, Sprint (Status is only in header badge) -->
              <dl class="metadata-list action-meta-inline">
                <dt>Due date</dt>
                <dd>${c?pa(c):"—"}</dd>
                ${t.sprint_id||t.sprint_name?`
                <dt>Sprint</dt>
                <dd>${X(t.sprint_name||String(t.sprint_id))}</dd>
                `:""}
              </dl>
            </section>

            <section class="detail-section" id="action-decision-section">
              <div class="section-header"><h3>Implementing decision</h3></div>
              <div id="action-decision-display" class="action-decision-display">
                ${t.decision_id?'<p class="text-muted">Loading…</p>':'<p class="text-muted">No decision linked</p>'}
              </div>
              <div class="action-decision-actions">
                <button type="button" class="btn btn-sm btn-outline-secondary" id="action-link-decision-btn">${t.decision_id?"Change":"Link decision"}</button>
                <button type="button" class="btn btn-sm btn-link ${t.decision_id?"":"hidden"}" id="action-unlink-decision-btn">Unlink</button>
              </div>
              <div id="action-decision-picker" class="action-decision-picker hidden">
                <div class="picker-search"><input type="text" id="action-decision-search" placeholder="Search decisions..." autocomplete="off"></div>
                <div id="action-decision-list" class="action-decision-list">Loading…</div>
              </div>
            </section>

            <section class="detail-section" id="action-source-section">
              <div class="section-header"><h3>Source</h3></div>
              <div class="source-content">
              ${[t.source_file?`<p class="source-file"><strong>File:</strong> ${X(t.source_file)}</p>`:"",t.source_document_id?`<p class="source-doc"><a href="#" class="doc-link" data-document-id="${X(String(t.source_document_id))}">View source document</a></p>`:"",t.source_type?`<p class="source-type"><strong>Origin:</strong> ${X(t.source_type)}</p>`:"",t.generation_source?`<p class="source-meta"><strong>Generation:</strong> <span class="status-pill">${X(t.generation_source)}</span></p>`:"",t.requested_by?`<div id="action-requester-display" class="requester-display"><p><strong>Requested by:</strong> ${X(t.requested_by)}</p></div>`:""].filter(Boolean).join("")||'<p class="text-muted">No source recorded</p>'}
              </div>
            </section>
          </div>

          <div class="detail-column-right">
            <section class="detail-section metadata-section">
              <h3>Metadata</h3>
              <dl class="metadata-list">
                <dt>Created</dt>
                <dd>${pa(t.created_at)}</dd>
                ${t.updated_at?`<dt>Updated</dt><dd>${pa(t.updated_at)}</dd>`:""}
              </dl>
            </section>

            <section class="detail-section" id="action-timeline-section">
              <h3>Timeline</h3>
              <div id="timeline-content" class="timeline-content">
                <span class="text-muted">Loading…</span>
              </div>
            </section>

            <section class="detail-section" id="action-comments-section">
              <div id="action-comments-mount"></div>
            </section>

            <section class="detail-section" id="action-similar-section">
              <h3 class="section-header-sota">Similar actions</h3>
              <div id="action-similar-mount" class="action-similar-list">
                <div class="skeleton-card">
                  <div class="skeleton-text w-100"></div>
                  <div class="skeleton-row">
                    <div class="skeleton-text w-25"></div>
                    <div class="skeleton-text w-25"></div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="detail-actions">
          <button type="button" class="btn btn-secondary" id="edit-action-btn">Edit</button>
          <button type="button" class="btn btn-danger" id="delete-action-btn">Delete</button>
        </div>
      </div>

      <div id="action-edit-form" class="action-detail-edit-form hidden">
        <form id="action-inline-form" class="action-form">
          <div class="form-group">
            <div class="gm-flex gm-flex-center gm-justify-between gm-flex-wrap gm-gap-2 gm-mb-2">
              <label for="action-edit-task" class="gm-mb-0">Task *</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="action-edit-ai-suggest-btn" title="Suggest assignee from task content">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="action-edit-task" rows="3" required placeholder="What needs to be done?">${X(r)}</textarea>
          </div>
          <div id="action-edit-suggestions-panel" class="suggestions-panel-sota action-suggestions-panel hidden gm-mb-4"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="action-edit-status">Status</label>
              <select id="action-edit-status">
                <option value="pending" ${t.status==="pending"?"selected":""}>Pending</option>
                <option value="in_progress" ${t.status==="in_progress"?"selected":""}>In Progress</option>
                <option value="completed" ${t.status==="completed"?"selected":""}>Completed</option>
                <option value="cancelled" ${t.status==="cancelled"?"selected":""}>Cancelled</option>
              </select>
            </div>
            <div class="form-group">
              <label for="action-edit-priority">Priority</label>
              <select id="action-edit-priority">
                <option value="low" ${t.priority==="low"?"selected":""}>Low</option>
                <option value="medium" ${t.priority==="medium"||!t.priority?"selected":""}>Medium</option>
                <option value="high" ${t.priority==="high"?"selected":""}>High</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group action-assignee-picker-wrap">
              <label>Assignee</label>
              <input type="hidden" id="action-edit-assignee" value="${X(l)}">
              <div class="action-assignee-picker-trigger" id="action-assignee-picker-trigger" title="Click to select from project contacts">
                <span class="action-assignee-picker-value" id="action-assignee-picker-value">${l?X(l):'<span class="text-muted">Select assignee...</span>'}</span>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div id="action-assignee-picker-dropdown" class="action-assignee-picker-dropdown hidden">
                <div class="action-assignee-picker-search">
                  <input type="text" id="action-assignee-picker-search" placeholder="Search contacts..." autocomplete="off">
                </div>
                <div id="action-assignee-picker-list" class="action-assignee-picker-list">Loading...</div>
              </div>
            </div>
            <div class="form-group">
              <label for="action-edit-due">Due date</label>
              <input type="date" id="action-edit-due" value="${c?c.split("T")[0]:""}">
            </div>
          </div>
          <div class="form-group action-requester-picker-wrap">
            <label>Requested by</label>
            <input type="hidden" id="action-edit-requester-contact-id" value="${X(t.requested_by_contact_id||"")}">
            <input type="hidden" id="action-edit-requester-name" value="${X(t.requested_by||"")}">
            <div class="action-assignee-picker-trigger" id="action-requester-picker-trigger" title="Click to select who requested this task">
              <span class="action-assignee-picker-value" id="action-requester-picker-value">${t.requested_by?X(t.requested_by):'<span class="text-muted">Select requester...</span>'}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div id="action-requester-picker-dropdown" class="action-assignee-picker-dropdown hidden">
              <div class="action-assignee-picker-search">
                <input type="text" id="action-requester-picker-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="action-requester-picker-list" class="action-assignee-picker-list">Loading...</div>
            </div>
          </div>
        </form>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="action-save-btn">Save</button>
          <button type="button" class="btn btn-secondary" id="action-cancel-edit-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="action-delete-in-edit-btn">Delete</button>
        </div>
      </div>
    </div>
  `;const m=o.querySelector("#back-to-list");m&&u(m,"click",F=>{F.preventDefault(),n()});const f=o.querySelector("#close-detail");f&&u(f,"click",n);const g=o.querySelector("#action-refine-ai-btn");g&&u(g,"click",async()=>{const F=Ki(t),O=t.description??"",P=[F,O].filter(Boolean).join(`

`);if(!P.trim()){h.error("Task has no content to refine");return}g.disabled=!0,g.textContent="Refining...";try{const L=await Le.suggestTaskFromDescription({user_input:P,parent_story_ref:t.parent_story_ref||void 0});if(!o.isConnected)return;const B=await Le.update(t.id,{content:L.task,description:L.description,definition_of_done:L.definition_of_done,acceptance_criteria:L.acceptance_criteria,size_estimate:L.size_estimate,refined_with_ai:!0});if(!o.isConnected)return;h.success("Task refined with AI"),a=B,S(),s?.(B)}catch(L){h.error(L.message||"Failed to refine")}finally{g.disabled=!1,g.innerHTML=`
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Refine with AI
        `}});function v(){const F=o.querySelector("#action-description-section .action-description-body");F&&F.querySelectorAll(".dod-item-toggle").forEach(O=>{u(O,"click",async()=>{const P=parseInt(O.getAttribute("data-dod-index")??"-1",10);if(P<0)return;const L=Hu(a.definition_of_done||[]);if(P>=L.length)return;const B=O.closest(".dod-item"),J=L[P].done;L[P].done=!L[P].done;const ne=L.map(he=>({text:he.text,done:he.done}));B&&B.classList.toggle("dod-done",L[P].done),O.textContent=L[P].done?"✔":"☐",O.setAttribute("aria-label",L[P].done?"Mark undone":"Mark done");try{const he=await Le.update(a.id,{definition_of_done:ne});if(!o.isConnected)return;a=he,h.success(L[P].done?"Marked done":"Marked undone")}catch(he){L[P].done=J,B&&B.classList.toggle("dod-done",J),O.textContent=J?"✔":"☐",O.setAttribute("aria-label",J?"Mark undone":"Mark done"),h.error(he.message||"Failed to update")}})})}function y(F){F&&Le.getEvents(a.id).then(O=>{if(!o.isConnected)return;if(O.length===0){F.innerHTML='<p class="empty-state">No events recorded</p>',v();return}const P=O.map(L=>{const B=Sx(L.event_type),J=_x(L),he=(L.event_data||{}).snapshot,De=L.event_type==="refined_with_ai"&&he&&typeof he=="object",St=De?` data-snapshot="${X(JSON.stringify(he))}"`:"",Qe=De?`<button type="button" class="btn btn-sm btn-outline-secondary action-restore-btn"${St} title="Restore this version">Restore</button>`:"";return`
          <div class="timeline-item action-event-${X(L.event_type)}">
            <div class="timeline-icon">${B}</div>
            <div class="timeline-content">
              <div class="timeline-title-row">
                <span class="timeline-title">${X(J)}</span>
                ${Qe}
              </div>
              <div class="timeline-date">${hs(L.created_at)}</div>
            </div>
          </div>`}).join("");F.innerHTML=`<div class="timeline-list">${P}</div>`,F.querySelectorAll(".action-restore-btn").forEach(L=>{u(L,"click",async()=>{const B=L.getAttribute("data-snapshot");if(!B)return;const J=L;J.disabled=!0;const ne=J.textContent||"Restore";J.textContent="Restoring…";try{const he=JSON.parse(B),De=await Le.update(a.id,{restore_snapshot:he});if(!o.isConnected)return;h.success("Previous version restored"),a=De,S(),s?.(De)}catch(he){h.error(he.message||"Failed to restore"),J.disabled=!1,J.textContent=ne}})}),v()}).catch(()=>{F.innerHTML='<p class="error">Failed to load timeline</p>'})}function S(){const F=o.querySelector(".action-task-text");F&&(F.textContent=Ki(a));const O=o.querySelector("#action-description-section .action-description-body");O&&(O.innerHTML=fl(a,a.assignee??a.owner??""),v());const P=o.querySelector("#timeline-content");P&&(P.innerHTML=`
      <div class="skeleton-card">
          <div class="skeleton-row">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-text w-50" style="margin-bottom:0"></div>
          </div>
          <div class="skeleton-text w-75" style="margin-top: 8px;"></div>
      </div>
    `),y(P)}function w(){const F=o.querySelector("#action-decision-display"),O=o.querySelector("#action-link-decision-btn"),P=o.querySelector("#action-unlink-decision-btn"),L=a.decision_id;F&&(L?(F.innerHTML='<div class="skeleton-text w-75"></div>',Re.get(L).then(B=>{if(!o.isConnected||!F)return;const J=(B?.summary||B?.content||"").toString().trim().substring(0,80)+((B?.content||"").toString().length>80?"…":"");F.innerHTML=`<p><a href="#" class="decision-link" data-decision-id="${X(String(L))}">${X(J||`Decision #${String(L).substring(0,8)}`)}</a></p>`,F.querySelector(".decision-link")&&u(F.querySelector(".decision-link"),"click",ne=>{ne.preventDefault(),L&&i?.(L)})}).catch(()=>{F.innerHTML=`<p><a href="#" class="decision-link" data-decision-id="${X(String(L))}">Decision #${String(L).substring(0,8)}</a></p>`}),O&&(O.textContent="Change"),P&&P.classList.remove("hidden")):(F.innerHTML='<p class="text-muted">No decision linked</p>',O&&(O.textContent="Link decision"),P&&P.classList.add("hidden")))}const k=o.querySelector("#action-view-content"),x=o.querySelector("#action-edit-form"),b=o.querySelector("#action-comments-mount");if(b){const F=gl()?.id,O=Iu({targetType:"action",targetId:String(t.id),projectId:F||void 0});b.appendChild(O)}const C=o.querySelector("#action-similar-mount");C&&(async()=>{try{const F=await Le.getSimilar(t.id);if(!o.isConnected)return;if(F.length===0){C.innerHTML='<span class="text-muted">No similar actions found. Rebuild RAG embeddings to enable.</span>';return}C.innerHTML=F.map(O=>`
          <div class="action-similar-card" data-action-id="${X(String(O.id))}" role="button" tabindex="0">
            <span class="action-similar-status status-pill status-${(O.status||"pending").toLowerCase()}">${X(String(O.status||"pending").replace("_"," "))}</span>
            <span class="action-similar-task">${X((O.content||O.task||"").toString().trim().substring(0,80))}${(O.content||O.task||"").toString().length>80?"…":""}</span>
          </div>
        `).join(""),C.querySelectorAll(".action-similar-card").forEach(O=>{u(O,"click",()=>{const P=O.getAttribute("data-action-id"),L=F.find(B=>String(B.id)===P);L&&s?.(L)})})}catch{C.innerHTML='<span class="text-muted">Could not load similar actions.</span>'}})(),(()=>{w();const F=o.querySelector("#action-link-decision-btn"),O=o.querySelector("#action-unlink-decision-btn"),P=o.querySelector("#action-decision-picker"),L=o.querySelector("#action-decision-list"),B=o.querySelector("#action-decision-search"),J=(ne,he="")=>{if(!L)return;const De=he.trim().toLowerCase(),St=De?ne.filter(Qe=>(Qe.content||"").toLowerCase().includes(De)||(Qe.summary||"").toLowerCase().includes(De)):ne;if(St.length===0){L.innerHTML='<div class="empty-state">No decisions match</div>';return}L.innerHTML=St.map(Qe=>{const ot=(Qe.summary||Qe.content||"").toString().trim().substring(0,60)+((Qe.content||"").toString().length>60?"…":"");return`<div class="action-decision-item" data-decision-id="${X(String(Qe.id))}" role="button" tabindex="0">${X(ot)}</div>`}).join(""),L.querySelectorAll(".action-decision-item").forEach(Qe=>{u(Qe,"click",async()=>{const ot=Qe.getAttribute("data-decision-id");if(!ot)return;const Dn={...a},Ws=Qe.textContent||`Decision #${ot}`;a.decision_id=ot;const es=o.querySelector("#action-decision-display"),Bi=o.querySelector("#action-link-decision-btn"),ts=o.querySelector("#action-unlink-decision-btn");if(es){es.innerHTML=`<p><a href="#" class="decision-link" data-decision-id="${X(ot)}">${X(Ws)}</a></p>`;const It=es.querySelector(".decision-link");It&&u(It,"click",Jo=>{Jo.preventDefault(),i?.(ot)})}Bi&&(Bi.textContent="Change"),ts&&ts.classList.remove("hidden"),P&&P.classList.add("hidden");try{const It=await Le.update(a.id,{decision_id:ot});if(!o.isConnected)return;a=It,s?.(It),w(),h.success("Decision linked")}catch(It){console.error("Failed to link decision",It),a=Dn,w(),h.error(It.message||"Failed to link decision")}})})};F&&u(F,"click",async()=>{if(!P||!L)return;const ne=!P.classList.contains("hidden");if(P.classList.toggle("hidden",ne),!ne){L.innerHTML="Loading…";try{const he=await Re.getAll();J(he,B?.value||"")}catch{L.innerHTML='<div class="empty-state">Failed to load decisions</div>'}}}),O&&u(O,"click",async()=>{try{const ne=await Le.update(a.id,{decision_id:null});if(!o.isConnected)return;a=ne,s?.(ne),w(),h.success("Decision unlinked")}catch(ne){h.error(ne.message||"Failed to unlink")}}),B&&L&&B.addEventListener("input",()=>{Re.getAll().then(ne=>J(ne,B.value))}),document.addEventListener("click",ne=>{P&&!ne.target.closest("#action-decision-section")&&!P.classList.contains("hidden")&&P.classList.add("hidden")})})();const T=o.querySelector("#edit-action-btn");T&&u(T,"click",()=>{k.classList.add("hidden"),x.classList.remove("hidden")});const A=o.querySelector("#action-cancel-edit-btn");A&&u(A,"click",()=>{x.classList.add("hidden"),k.classList.remove("hidden")});const M=o.querySelector("#action-assignee-picker-trigger"),Q=o.querySelector("#action-assignee-picker-dropdown"),q=o.querySelector("#action-assignee-picker-value"),V=o.querySelector("#action-edit-assignee"),I=o.querySelector("#action-assignee-picker-list"),H=o.querySelector("#action-assignee-picker-search");if(M&&Q&&I&&V){let F=[];const O=(P="")=>{const L=P?F.filter(B=>(B.name||"").toLowerCase().includes(P.toLowerCase())||(B.role||"").toLowerCase().includes(P.toLowerCase())):F;if(F.length===0){I.innerHTML='<div class="empty-state">Loading contacts...</div>';return}if(L.length===0){I.innerHTML='<div class="empty-state">No contacts match</div>';return}I.innerHTML=L.map(B=>{const J=B.photoUrl||B.avatarUrl;return`
            <div class="action-assignee-card-picker ${(V?.value||"").trim()===(B.name||"").trim()?"selected":""}" data-contact-name="${X(B.name||"")}">
              <div class="action-assignee-card-avatar">${J?`<img src="${X(J)}" alt="" onerror="this.parentElement.innerHTML='${at(B.name||"")}'">`:at(B.name||"")}</div>
              <div class="action-assignee-card-info">
                <div class="action-assignee-card-name">${X(B.name||"")}</div>
                ${B.role?`<div class="action-assignee-card-role">${X(B.role)}</div>`:""}
              </div>
            </div>
          `}).join(""),I.querySelectorAll(".action-assignee-card-picker").forEach(B=>{u(B,"click",()=>{const J=B.getAttribute("data-contact-name")||"";V.value=J,q&&(q.innerHTML=J?X(J):'<span class="text-muted">Select assignee...</span>'),Q.classList.add("hidden")})})};u(M,"click",async P=>{P.stopPropagation();const L=!Q.classList.contains("hidden");if(Q.classList.toggle("hidden",L),!L&&F.length===0){I.innerHTML='<div class="empty-state">Loading...</div>';try{const B=await Je.getAll();if(!o.isConnected)return;F=B?.contacts||[],O(H?.value||"")}catch{I.innerHTML='<div class="empty-state">Failed to load contacts</div>'}}else L||O(H?.value||"")}),H&&H.addEventListener("input",()=>O(H.value)),document.addEventListener("click",P=>{!P.target.closest(".action-assignee-picker-wrap")&&!Q?.classList.contains("hidden")&&Q.classList.add("hidden")})}const W=o.querySelector("#action-requester-picker-trigger"),ee=o.querySelector("#action-requester-picker-dropdown"),te=o.querySelector("#action-requester-picker-value"),ue=o.querySelector("#action-edit-requester-contact-id"),Pe=o.querySelector("#action-edit-requester-name"),ze=o.querySelector("#action-requester-picker-list"),st=o.querySelector("#action-requester-picker-search");if(W&&ee&&ze&&ue&&Pe){let F=[];const O=(P="")=>{const L=P?F.filter(B=>(B.name||"").toLowerCase().includes(P.toLowerCase())||(B.role||"").toLowerCase().includes(P.toLowerCase())):F;if(F.length===0){ze.innerHTML='<div class="empty-state">Loading contacts...</div>';return}ze.innerHTML='<div class="action-assignee-card-picker" data-contact-id="" data-contact-name=""><div class="action-assignee-card-info"><div class="action-assignee-card-name text-muted">No requester</div></div></div>'+L.map(B=>{const J=B.photoUrl||B.avatarUrl;return`
            <div class="action-assignee-card-picker" data-contact-id="${X(B.id)}" data-contact-name="${X(B.name||"")}">
              <div class="action-assignee-card-avatar">${J?`<img src="${X(J)}" alt="" onerror="this.parentElement.innerHTML='${at(B.name||"")}'">`:at(B.name||"")}</div>
              <div class="action-assignee-card-info">
                <div class="action-assignee-card-name">${X(B.name||"")}</div>
                ${B.role?`<div class="action-assignee-card-role">${X(B.role)}</div>`:""}
              </div>
            </div>
          `}).join(""),ze.querySelectorAll(".action-assignee-card-picker").forEach(B=>{u(B,"click",()=>{const J=B.getAttribute("data-contact-id")||"",ne=B.getAttribute("data-contact-name")||"";ue.value=J,Pe.value=ne,te&&(te.innerHTML=ne?X(ne):'<span class="text-muted">Select requester...</span>'),ee.classList.add("hidden")})})};u(W,"click",async P=>{P.stopPropagation();const L=!ee.classList.contains("hidden");if(ee.classList.toggle("hidden",L),!L&&F.length===0){ze.innerHTML='<div class="empty-state">Loading...</div>';try{const B=await Je.getAll();if(!o.isConnected)return;F=B?.contacts||[],O(st?.value||"")}catch{ze.innerHTML='<div class="empty-state">Failed to load contacts</div>'}}else L||O(st?.value||"")}),st&&st.addEventListener("input",()=>O(st.value)),document.addEventListener("click",P=>{!P.target.closest(".action-requester-picker-wrap")&&!ee?.classList.contains("hidden")&&ee.classList.add("hidden")})}const we=o.querySelector("#action-edit-ai-suggest-btn"),oe=o.querySelector("#action-edit-suggestions-panel"),Y=o.querySelector("#action-edit-assignee"),le=o.querySelector("#action-assignee-picker-value");we&&oe&&u(we,"click",async()=>{const O=o.querySelector("#action-edit-task")?.value?.trim()||"";if(!O){h.warning("Enter task content first");return}const P=we;P.disabled=!0,P.innerHTML='<span class="spin">⋯</span> Analyzing...',oe.classList.remove("hidden"),oe.innerHTML='<div class="suggestions-loading"><div class="loading-text">AI is suggesting assignees...</div></div>';try{if(K.length===0){const J=await Je.getAll();if(!o.isConnected)return;K=J?.contacts||[]}const{suggested_assignees:L}=await Le.suggest({content:O});if(!o.isConnected)return;L?.length?(oe.innerHTML=`
            <div class="suggestions-header-sota"><div class="ai-badge">✨ AI Recommended</div></div>
            <div class="suggestions-list-sota">
              ${L.map(J=>{const ne=$t(J.name),he=$e(ne),De=ne?.role??J.reason??"";return`
                <div class="action-suggestion-card suggestion-card-sota">
                  <div class="suggestion-card-left">
                    <div class="suggestion-avatar-sota">${he?`<img src="${X(he)}" alt="" onerror="this.parentElement.innerHTML='${at(J.name)}'">`:at(J.name)}</div>
                    <div class="suggestion-score-ring" style="--score-color: ${(J.score??0)>=70?"var(--success)":(J.score??0)>=50?"var(--warning)":"var(--text-muted)"}">${J.score??0}</div>
                    <div>
                      <div class="suggestion-name">${X(J.name)}</div>
                      ${De?`<div class="suggestion-reason">${X(De)}</div>`:""}
                    </div>
                  </div>
                  <button type="button" class="btn-select-suggestion" data-assignee-name="${X(J.name)}">Assign</button>
                </div>
              `}).join("")}
            </div>
            <div class="suggestions-footer"><button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close suggestions</button></div>
          `,oe.querySelectorAll(".btn-select-suggestion").forEach(J=>{const ne=J.getAttribute("data-assignee-name")||"";ne&&u(J,"click",()=>{Y&&(Y.value=ne),le&&(le.innerHTML=X(ne)),oe.classList.add("hidden"),h.success(`Assignee set to ${ne}`)})})):oe.innerHTML='<div class="no-suggestions"><div class="no-suggestions-text">No suggestions</div><button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close</button></div>';const B=oe.querySelector("#action-edit-hide-suggest-btn");B&&u(B,"click",()=>{oe.classList.add("hidden")})}catch{oe.innerHTML='<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close</button></div>';const L=oe.querySelector("#action-edit-hide-suggest-btn");L&&u(L,"click",()=>{oe.classList.add("hidden")})}finally{P.disabled=!1,P.innerHTML='<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> AI suggest'}});const G=o.querySelector("#action-save-btn");G&&u(G,"click",async()=>{const F=o.querySelector("#action-edit-task"),O=o.querySelector("#action-edit-status"),P=o.querySelector("#action-edit-priority"),L=o.querySelector("#action-edit-assignee"),B=o.querySelector("#action-edit-due"),J=o.querySelector("#action-edit-requester-contact-id"),ne=o.querySelector("#action-edit-requester-name");if(!F?.value.trim()){h.warning("Task is required");return}try{const he=await Le.update(t.id,{content:F.value.trim(),status:O?.value,priority:P?.value,assignee:L?.value.trim()||void 0,due_date:B?.value||void 0,requested_by_contact_id:J?.value?.trim()||void 0,requested_by:ne?.value?.trim()||void 0});if(!o.isConnected)return;h.success("Action updated"),s?.(he)}catch{h.error("Failed to update action")}});const ge=o.querySelector("#delete-action-btn"),ye=o.querySelector("#action-delete-in-edit-btn"),_e=async()=>{const{confirm:F}=await ve(async()=>{const{confirm:P}=await Promise.resolve().then(()=>vn);return{confirm:P}},void 0);if(await F("Are you sure you want to delete this action?",{title:"Delete Action",confirmText:"Delete",confirmClass:"btn-danger"}))try{if(await Le.delete(t.id),!o.isConnected)return;h.success("Action deleted"),n()}catch{h.error("Failed to delete action")}};ge&&u(ge,"click",_e),ye&&u(ye,"click",_e);const j=o.querySelector(".doc-link[data-document-id]");j&&u(j,"click",F=>{F.preventDefault();const O=j.getAttribute("data-document-id");O&&window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:{tab:"files",documentId:O}}))});const Z=o.querySelector("#action-ai-suggest-btn"),R=o.querySelector("#action-suggestions-panel");Z&&R&&u(Z,"click",async()=>{Z.disabled=!0,R.classList.remove("hidden"),R.innerHTML='<div class="suggestions-loading">Loading suggestions...</div>';try{const F=Ki(t);if(K.length===0){const L=await Je.getAll();if(!o.isConnected)return;K=L?.contacts||[]}const{suggested_assignees:O}=await Le.suggest({content:F});if(!o.isConnected)return;O?.length?(R.innerHTML=`
            <div class="suggestions-header-sota">
              <div class="ai-badge">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Recommended
              </div>
            </div>
            <div class="suggestions-list-sota">
              ${O.map((L,B)=>{const J=$t(L.name),ne=$e(J),he=J?.role??L.reason??"";return`
                <div class="suggestion-card-sota" data-index="${B}">
                  <div class="suggestion-rank">#${B+1}</div>
                  <div class="suggestion-avatar-sota">${ne?`<img src="${X(ne)}" alt="" onerror="this.parentElement.innerHTML='${at(L.name)}'">`:at(L.name)}</div>
                  <div class="suggestion-info-sota">
                    <div class="suggestion-name-sota">${X(L.name)}</div>
                    ${he?`<div class="suggestion-reason-sota">${X(he)}</div>`:""}
                  </div>
                  <div class="suggestion-score-sota" style="--score-color: ${(L.score??0)>=70?"var(--success)":(L.score??0)>=50?"var(--warning)":"var(--text-muted)"}">
                    <div class="score-ring">
                      <svg viewBox="0 0 36 36">
                        <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                        <path class="score-fill" stroke-dasharray="${L.score??0}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      </svg>
                      <div class="score-value">${L.score??0}%</div>
                    </div>
                    <div class="score-label">Match</div>
                  </div>
                  <button type="button" class="btn-select-suggestion" data-assignee-name="${X(L.name)}">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Assign
                  </button>
                </div>
              `}).join("")}
            </div>
            <div class="suggestions-footer"><button type="button" class="btn-link" id="action-hide-suggest-btn">Close suggestions</button></div>
          `,R.querySelectorAll(".btn-select-suggestion").forEach(L=>{u(L,"click",async()=>{const B=L.getAttribute("data-assignee-name")||"";if(B)try{const J=await Le.update(t.id,{assignee:B});if(!o.isConnected)return;h.success(`Assigned to ${B}`),s?.(J),R.classList.add("hidden")}catch{h.error("Failed to assign")}})})):R.innerHTML='<div class="no-suggestions">No suggestions. <button type="button" class="btn-link" id="action-hide-suggest-btn">Close suggestions</button></div>';const P=R.querySelector("#action-hide-suggest-btn");P&&u(P,"click",()=>{R.classList.add("hidden")})}catch{R.innerHTML='<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="action-hide-suggest-btn">Close</button></div>';const F=R.querySelector("#action-hide-suggest-btn");F&&u(F,"click",()=>{R.classList.add("hidden")})}finally{Z.disabled=!1}});const D=o.querySelector("#timeline-content");D&&y(D),v();let K=[];const ie=o.querySelector("#action-contact-picker"),xe=o.querySelector("#action-contact-list"),Ce=o.querySelector("#action-contact-search");function $e(F){if(!F)return null;const O=F;return O.photoUrl||O.avatarUrl||O.photo_url||O.avatar_url||null}const it=(F="")=>{if(!xe)return;const O=F?K.filter(P=>(P.name||"").toLowerCase().includes(F.toLowerCase())||(P.role||"").toLowerCase().includes(F.toLowerCase())||(P.organization||"").toLowerCase().includes(F.toLowerCase())):K;if(K.length===0){xe.innerHTML='<div class="empty-state">Loading contacts...</div>';return}if(O.length===0){xe.innerHTML='<div class="empty-state">No contacts match</div>';return}xe.innerHTML=O.map(P=>{const L=$e(P);return`
          <div class="contact-card-picker ${(l||"").trim()===(P.name||"").trim()?"selected":""}" data-contact-name="${X(P.name||"")}">
            <div class="contact-avatar-picker">${L?`<img src="${X(L)}" alt="" onerror="this.parentElement.innerHTML='${at(P.name||"")}'">`:at(P.name||"")}</div>
            <div class="contact-info-picker">
              <div class="contact-name-picker">${X(P.name||"")}</div>
              ${P.role?`<div class="contact-role-picker">${X(P.role)}</div>`:""}
            </div>
          </div>`}).join(""),xe.querySelectorAll(".contact-card-picker").forEach(P=>{u(P,"click",async()=>{const L=P.getAttribute("data-contact-name")||"";if(!L)return;const B=a.assignee,J={...a};a.assignee=L;const ne=$t(L);o.querySelector("#action-assigned-role"),o.querySelector("#action-assigned-avatar"),o.querySelector(".contact-name-lg"),o.querySelector("#action-current-assignment .assigned-contact-display");const he=o.querySelector("#action-current-assignment");if(he){const De=$e(ne);he.innerHTML=`
                  <div class="assigned-contact-display">
                    <div class="contact-avatar-lg" id="action-assigned-avatar">${De?`<img src="${X(De)}" alt="" onerror="this.parentElement.innerHTML='${at(L)}'">`:at(L)}</div>
                    <div class="contact-details">
                      <div class="contact-name-lg">${X(L)}</div>
                      <div class="contact-role-sm" id="action-assigned-role">${X(ne?.role||"—")}</div>
                    </div>
                    <button class="btn-change-assignment" id="action-change-assignee-btn" type="button">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      Change
                    </button>
                  </div>
            `;const St=he.querySelector("#action-change-assignee-btn");St&&u(St,"click",xt)}ie&&ie.classList.add("hidden");try{const De=await Le.update(t.id,{assignee:L});if(!o.isConnected)return;h.success(`Assigned to ${L}`),a=De,s?.(De)}catch{if(console.error("Failed to save assignment"),h.error("Failed to save assignment. Reverting..."),a=J,he)if(B){const De=$t(B),St=$e(De);he.innerHTML=`
                      <div class="assigned-contact-display">
                        <div class="contact-avatar-lg" id="action-assigned-avatar">${St?`<img src="${X(St)}" alt="" onerror="this.parentElement.innerHTML='${at(B)}'">`:at(B)}</div>
                        <div class="contact-details">
                          <div class="contact-name-lg">${X(B)}</div>
                          <div class="contact-role-sm" id="action-assigned-role">${X(De?.role||"—")}</div>
                        </div>
                        <button class="btn-change-assignment" id="action-change-assignee-btn" type="button">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          Change
                        </button>
                      </div>
                   `;const Qe=he.querySelector("#action-change-assignee-btn");Qe&&u(Qe,"click",xt)}else{he.innerHTML=`
                      <div class="no-assignment">
                        <div class="no-assignment-icon">
                          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                        </div>
                        <span>No one assigned</span>
                        <p class="no-assignment-hint">Use AI Suggest or choose manually</p>
                        <button class="btn-assign-now" id="action-show-picker-btn" type="button">Choose Manually</button>
                      </div>
                   `;const De=he.querySelector("#action-show-picker-btn");De&&u(De,"click",xt)}}})})},xt=()=>{ie&&(ie.classList.toggle("hidden"),!ie.classList.contains("hidden")&&K.length===0?Je.getAll().then(F=>{o.isConnected&&(K=F?.contacts||[],it(Ce?.value||""))}).catch(()=>{xe&&(xe.innerHTML='<div class="empty-state">Failed to load contacts</div>')}):ie.classList.contains("hidden")||it(Ce?.value||""),Ce&&Ce.focus())},Jt=o.querySelector("#action-change-assignee-btn"),rn=o.querySelector("#action-show-picker-btn");Jt&&ie&&u(Jt,"click",xt),rn&&ie&&u(rn,"click",xt),Ce&&Ce.addEventListener("input",()=>it(Ce.value));function $t(F){if(!F||!K.length)return;const O=F.trim().toLowerCase();if(!O)return;const P=K.find(J=>(J.name||"").trim().toLowerCase()===O);if(P)return P;const L=K.find(J=>(J.name||"").trim().toLowerCase().includes(O)||O.includes((J.name||"").trim().toLowerCase()));if(L)return L;const B=K.find(J=>(J.aliases||[]).some(ne=>String(ne).trim().toLowerCase()===O));return B||K.find(J=>(J.aliases||[]).some(ne=>{const he=String(ne).trim().toLowerCase();return he.includes(O)||O.includes(he)}))}function At(F,O){if(!F.length)return;if(O.requested_by_contact_id){const ne=F.find(he=>String(he.id)===String(O.requested_by_contact_id));if(ne)return ne}const P=(O.requested_by||"").trim();if(!P)return;const L=P.toLowerCase(),B=F.find(ne=>(ne.name||"").trim().toLowerCase()===L);return B||F.find(ne=>(ne.name||"").trim().toLowerCase().includes(L)||L.includes((ne.name||"").trim().toLowerCase()))}return Je.getAll().then(F=>{if(!o.isConnected)return;K=F?.contacts||[];const O=$t(l),P=o.querySelector("#action-assigned-role");P&&(P.textContent=O?.role??"—");const L=o.querySelector("#action-assigned-avatar");if(L&&l){const J=$e(O);if(J){L.innerHTML="";const ne=document.createElement("img");ne.src=J,ne.alt="",ne.onerror=()=>{L.textContent=at(l)},L.appendChild(ne)}}const B=o.querySelector("#action-requester-display");if(B&&(t.requested_by||t.requested_by_contact_id)){const J=At(K,t);if(J){const ne=$e(J),he=J.name||t.requested_by||"—";B.innerHTML=`
          <p class="requested-by-label">Requested by</p>
          <div class="assigned-contact-display requester-contact-card">
            <div class="contact-avatar-lg">${ne?`<img src="${X(ne)}" alt="" onerror="this.parentElement.textContent='${at(he)}'">`:at(he)}</div>
            <div class="contact-details">
              <div class="contact-name-lg">${X(he)}</div>
              ${J.role?`<div class="contact-role-sm">${X(J.role)}</div>`:""}
            </div>
          </div>
        `}}}).catch(()=>{}),o}const Cx=Object.freeze(Object.defineProperty({__proto__:null,createActionDetailView:bo},Symbol.toStringTag,{value:"Module"}));function Ja(e,t,n){return{action:n,onClose:()=>{e.innerHTML="",e.appendChild(yo(t))},onUpdate:s=>{e.innerHTML="",s?e.appendChild(bo(Ja(e,t,s))):e.appendChild(yo(t))}}}let hi="all",zs="",Ci="by_sprint";function yo(e={}){const t=_("div",{className:"sot-panel actions-panel"});t.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Actions</h2>
        <span class="panel-count" id="actions-count">0</span>
      </div>
      <div class="panel-actions">
        <div class="view-mode-tabs" role="tablist">
          <button type="button" class="view-mode-tab" data-view="list" title="Flat list">List</button>
          <button type="button" class="view-mode-tab active" data-view="by_sprint" title="Group by sprint">Sprints</button>
          <button type="button" class="view-mode-tab" data-view="by_story" title="Group by user story">Stories</button>
        </div>
        <select id="actions-sprint-filter" class="filter-select" title="Sprint (List view)">
          <option value="">All sprints</option>
        </select>
        <select id="actions-filter" class="filter-select">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <button class="btn btn-outline-primary btn-sm" id="create-sprint-btn" title="Create sprint and generate tasks from emails/transcripts">Sprint</button>
        <button class="btn btn-primary btn-sm" id="add-action-btn">+ Add</button>
      </div>
    </div>
    <div id="actions-report-strip" class="actions-report-strip hidden"></div>
    <div id="actions-sprint-detail" class="actions-sprint-detail hidden"></div>
    <div class="panel-content" id="actions-content">
      <div class="loading">Loading actions...</div>
    </div>
    <div id="removed-actions-container" class="removed-actions-container hidden"></div>
  `,(async()=>{const a=t.querySelector("#actions-sprint-filter");if(a)try{(await Oo()).forEach(r=>{const c=document.createElement("option");c.value=r.id,c.textContent=r.name,r.id===zs&&(c.selected=!0),a.appendChild(c)}),u(a,"change",()=>{zs=a.value||"",Hn(t,e)})}catch{}})(),t.querySelectorAll(".view-mode-tab").forEach(a=>{u(a,"click",()=>{const o=a.getAttribute("data-view");!o||o===Ci||(Ci=o,t.querySelectorAll(".view-mode-tab").forEach(r=>r.classList.remove("active")),a.classList.add("active"),Hn(t,e))})});const n=t.querySelector("#actions-filter");u(n,"change",()=>{hi=n.value,Hn(t,e)});const s=t.querySelector("#create-sprint-btn");s&&u(s,"click",()=>{mx({onSuccess:()=>Hn(t,e)})});const i=t.querySelector("#add-action-btn");return i&&u(i,"click",()=>{Ps({mode:"create",onSave:()=>Hn(t,e)})}),Hn(t,e),Dr(t,e),Bu(t),t}async function Ru(e){const t=e.querySelector("#actions-sprint-detail");if(t){if(!zs){t.classList.add("hidden"),t.innerHTML="";return}try{const n=await nx(zs);if(!n){t.classList.add("hidden"),t.innerHTML="";return}t.classList.remove("hidden");const s=n.start_date?new Date(n.start_date).toLocaleDateString():"—",i=n.end_date?new Date(n.end_date).toLocaleDateString():"—";t.innerHTML=`
      <div class="sprint-detail-header">
        <div class="sprint-detail-title">${bt(n.name)}</div>
        <div class="sprint-detail-meta">${s} – ${i}</div>
        ${n.context?`<div class="sprint-detail-context">${bt(n.context)}</div>`:""}
        <button type="button" class="btn btn-outline-primary btn-sm sprint-report-btn" id="sprint-report-open-btn" data-sprint-id="${bt(n.id)}" data-sprint-name="${bt(n.name)}">Sprint report</button>
      </div>
    `;const a=t.querySelector("#sprint-report-open-btn");a&&u(a,"click",()=>{const o=a.getAttribute("data-sprint-id"),r=a.getAttribute("data-sprint-name")||void 0;o&&bx({sprintId:o,sprintName:r||void 0,onClose:()=>{}})})}catch{t.classList.add("hidden"),t.innerHTML=""}}}async function Bu(e){const t=e.querySelector("#actions-report-strip");if(t)try{const n=await Le.getReport(),s=n.by_status||{},i=n.by_sprint||{},a=[];["pending","in_progress","completed","cancelled"].forEach(r=>{const c=s[r]??0;c>0&&a.push(`${r.replace("_"," ")}: ${c}`)});const o=Object.entries(i).filter(([r])=>r!=="(no sprint)").map(([,r])=>`${r.name}: ${r.count}`);if(o.length>0&&a.push(`Sprints: ${o.join(" · ")}`),a.length===0){t.classList.add("hidden"),t.innerHTML="";return}t.classList.remove("hidden"),t.innerHTML=`<span class="actions-report-label">By status:</span> ${a.join(" · ")}`}catch{t.classList.add("hidden"),t.innerHTML=""}}async function Dr(e,t){const n=e.querySelector("#removed-actions-container");if(n)try{const s=await Le.getDeletedActions();if(s.length===0){n.classList.add("hidden"),n.innerHTML="";return}n.classList.remove("hidden");const i=(a,o)=>a.length>o?a.slice(0,o)+"…":a;n.innerHTML=`
      <div class="removed-actions-section">
        <div class="removed-actions-header section-header-sota">
          <h3>Removed actions</h3>
          <span class="panel-count removed-count">${s.length}</span>
        </div>
        <p class="removed-actions-hint">Restore to undo; action will be synced back to the graph.</p>
        <div class="removed-actions-list">
          ${s.map(a=>`
            <div class="removed-action-item" data-action-id="${a.id}">
              <div class="removed-action-content">${bt(i(a.task||a.content||"",100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join("")}
        </div>
      </div>
    `,n.querySelectorAll(".conflict-resolve-restore").forEach(a=>{const r=a.closest(".removed-action-item")?.getAttribute("data-action-id");r&&u(a,"click",async()=>{try{await Le.restoreAction(r),h.success("Action restored"),await Hn(e,t),Dr(e,t)}catch{h.error("Failed to restore action")}})})}catch{n.classList.add("hidden"),n.innerHTML=""}}async function Hn(e,t){const n=e.querySelector("#actions-content");n.innerHTML='<div class="loading">Loading...</div>';try{const s=hi==="all"||hi==="overdue"?void 0:hi,i=Ci==="list"&&zs||void 0;let a=await Le.getAll(s,i);hi==="overdue"&&(a=a.filter(o=>Le.isOverdue(o))),ce.setActions(a),Ci==="by_sprint"?await Lx(n,a,e,t):Ci==="by_story"?await Tx(n,a,e,t):qx(n,a,t),jx(e,a.length),Dr(e,t),Bu(e),Ru(e)}catch{n.innerHTML='<div class="error">Failed to load actions</div>'}}async function Lx(e,t,n,s){const i=await Oo(),a=new Map,o=[];for(const l of t){const d=l.sprint_id;d?(a.has(d)||a.set(d,[]),a.get(d).push(l)):o.push(l)}const r=i.filter(l=>a.has(l.id));e.innerHTML="";for(const l of r){const d=a.get(l.id)||[],m=wo(`${l.name} (${d.length})`,d,n,s,()=>{zs=l.id,Ru(n)});e.appendChild(m)}const c=wo("Tasks without sprint",o,n,s);e.appendChild(c)}async function Tx(e,t,n,s){const i=await Le.getUserStories(),a=new Map,o=[];for(const c of t){const l=c.parent_story_id;l?(a.has(l)||a.set(l,[]),a.get(l).push(c)):o.push(c)}e.innerHTML="";for(const c of i){const l=a.get(c.id)||[];if(l.length===0&&!a.has(c.id))continue;const d=c.story_points!=null?`${c.title} (${c.story_points} pt)`:c.title,m=wo(`${d} — ${l.length} tasks`,l,n,s);e.appendChild(m)}const r=wo("Tasks without story",o,n,s);e.appendChild(r)}function wo(e,t,n,s,i){const a=_("div",{className:"actions-group"}),o=_("div",{className:"actions-group-header"});o.innerHTML=`<h3 class="actions-group-title">${bt(e)}</h3><span class="actions-group-count">${t.length}</span>`,i&&(o.style.cursor="pointer"),i&&u(o,"click",i),a.appendChild(o);const r=_("div",{className:"actions-group-list"});return a.appendChild(r),t.length===0?r.innerHTML='<p class="actions-group-empty">No tasks</p>':Ou(r,t,s),a}function Ax(e,t){if(!(!t||!e.length))return e.find(n=>n.id&&String(n.id)===String(t))}function hl(e,t){if(!t||!e.length)return;const n=t.trim().toLowerCase();if(!n)return;const s=e.find(o=>(o.name||"").trim().toLowerCase()===n);if(s)return s;const i=e.find(o=>(o.name||"").trim().toLowerCase().includes(n)||n.includes((o.name||"").trim().toLowerCase()));return i||e.find(o=>(o.aliases||[]).some(r=>String(r).trim().toLowerCase()===n))||e.find(o=>(o.aliases||[]).some(r=>{const c=String(r).trim().toLowerCase();return c.includes(n)||n.includes(c)}))}function vl(e){return e&&(e.photoUrl||e.avatarUrl||e.photo_url||e.avatar_url)||null}function Ji(e){if(!e)return"?";const t=e.trim().split(/\s+/);return t.length===1?t[0].substring(0,2).toUpperCase():(t[0][0]+t[t.length-1][0]).toUpperCase()}function Ou(e,t,n){if(t.length===0)return;const s=e.closest&&e.closest(".actions-panel"),i=ce.getState().contacts||[],a={high:"#ea580c",medium:"#ca8a04",low:"#16a34a"};e.innerHTML=t.map(o=>Ex(o,i,a)).join(""),Mx(e,t,n,s||void 0)}function Ex(e,t,n){const s=Le.isOverdue(e),i=(e.priority||"medium").toLowerCase(),a=n[i]??n.medium,o=(e.content??e.task??"").trim(),r=e.assignee??e.owner??"",c=r?hl(t,r):void 0,l=vl(c),d=r?`
    <div class="assignee-chip">
      <div class="assignee-avatar">${l?`<img src="${bt(l)}" alt="${bt(r)}" onerror="this.parentElement.innerHTML='${Ji(r)}'">`:Ji(r)}</div>
      <div class="assignee-info">
        <span class="assignee-name">${bt(r)}</span>
        ${c?.role?`<span class="assignee-role">${bt(c.role)}</span>`:""}
      </div>
    </div>
  `:"",m=e.requested_by??"",f=e.requested_by_contact_id??"",g=f?Ax(t,f):m?hl(t,m):void 0,v=g?.name??m,y=vl(g),S=v||f?`
    <div class="requester-chip card-source-chip">
      <span class="requester-label">Requested by</span>
      <div class="assignee-chip requester-chip-inner">
        <div class="assignee-avatar">${y?`<img src="${bt(y)}" alt="${bt(v||"")}" onerror="this.parentElement.innerHTML='${Ji(v||"?")}'">`:Ji(v||"?")}</div>
        <span class="assignee-name">${bt(v||"Unknown")}</span>
      </div>
    </div>
  `:"",w=e.due_date?`<span class="card-source-chip">Due: ${Si(e.due_date)}</span>`:'<span class="card-source-chip text-muted">No due date</span>';return`
    <div class="action-card-sota question-card-sota ${s?"overdue":""}" data-id="${e.id}" style="--action-priority-bar: ${a}">
      <div class="card-priority-bar action-priority-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="status-pill status-${(e.status||"pending").toLowerCase()}">${bt(String(e.status).replace("_"," "))}</span>
            ${e.priority?`<span class="priority-pill priority-${e.priority}">${bt(e.priority)}</span>`:""}
            ${s?'<span class="status-pill overdue">OVERDUE</span>':""}
          </div>
          <span class="card-timestamp">${Ee(e.created_at)}</span>
        </div>
        <div class="card-question-text">${bt(o)}</div>
        <div class="card-bottom-row">
          <div class="card-requester">
            ${d}
            ${S}
            ${w}
          </div>
          <div class="card-assignment">
            <button type="button" class="btn-link action-view-link">View</button>
          </div>
        </div>
      </div>
    </div>
  `}function Mx(e,t,n,s){const i=()=>s?Hn(s,n):void 0;e.querySelectorAll(".action-card-sota").forEach(a=>{u(a,"click",r=>{if(r.target.closest(".card-assignment"))return;const c=a.getAttribute("data-id"),l=t.find(d=>String(d.id)===c);if(l)if(n.useDetailView&&n.containerElement){const d=n.containerElement;d.innerHTML="",d.appendChild(bo(Ja(d,n,l)))}else n.onActionClick?n.onActionClick(l):Ps({mode:"edit",action:l,onSave:i})});const o=a.querySelector(".action-view-link");o&&u(o,"click",r=>{r.stopPropagation();const c=a.getAttribute("data-id"),l=t.find(d=>String(d.id)===c);if(l)if(n.useDetailView&&n.containerElement){const d=n.containerElement;d.innerHTML="",d.appendChild(bo(Ja(d,n,l)))}else n.onActionClick?n.onActionClick(l):Ps({mode:"edit",action:l,onSave:i})})})}function qx(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No actions found</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Action</button>
      </div>
    `;const s=e.querySelector("#empty-add-btn");s&&u(s,"click",()=>{Ps({mode:"create"})});return}Ou(e,t,n)}function jx(e,t){const n=e.querySelector("#actions-count");n&&(n.textContent=String(t))}function bt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Yi(e){if(!e)return"?";const t=e.trim().split(/\s+/);return t.length===1?t[0].substring(0,2).toUpperCase():(t[0][0]+t[t.length-1][0]).toUpperCase()}function bl(e){if(!e)return null;const t=e;return t.photoUrl||t.avatarUrl||t.photo_url||t.avatar_url||null}const Sn="decision-modal";function Fs(e){const{mode:t,decision:n,onSave:s,onDelete:i}=e,a=t==="edit"&&n?.id,o=t==="view",r=document.querySelector(`[data-modal-id="${Sn}"]`);r&&r.remove();const c=_("div",{className:"decision-modal-content"});if(o&&n){const m=n.content??n.decision,f=n.impact,g=n.summary;c.innerHTML=`
      <div class="decision-view">
        <div class="decision-meta">
          <span class="status-badge ${n.status}">${n.status}</span>
          ${f?`<span class="impact-badge impact-${f}">${ft(f)} impact</span>`:""}
          <span class="decision-date">${Ee(n.madeAt)}</span>
        </div>
        
        <div class="decision-text-large">
          ${ft(m)}
        </div>
        
        ${g?`
          <div class="decision-section decision-summary">
            <h4>Summary</h4>
            <p>${ft(g)}</p>
          </div>
        `:""}
        
        ${n.rationale?`
          <div class="decision-section">
            <h4>Rationale</h4>
            <p>${ft(n.rationale)}</p>
          </div>
        `:""}
        
        ${n.madeBy?`
          <div class="decision-made-by">
            <strong>Decision made by:</strong> ${ft(n.madeBy)}
          </div>
        `:""}
      </div>
    `}else{let m=function(q){if(!q||!b.length)return;const V=q.trim().toLowerCase();if(!V)return;const I=b.find(W=>(W.name||"").trim().toLowerCase()===V);return I||b.find(W=>(W.aliases||[]).some(ee=>String(ee).trim().toLowerCase()===V))},f=function(q){if(!C||!T)return;if(T.value=q,q){const H=m(q),W=bl(H);C.innerHTML=`
          <div class="assigned-contact-display">
            <div class="contact-avatar-lg">${W?`<img src="${ft(W)}" alt="" onerror="this.parentElement.innerHTML='${Yi(q)}'">`:Yi(q)}</div>
            <div class="contact-details">
              <div class="contact-name-lg">${ft(q)}</div>
              ${H?.role?`<div class="contact-role-sm">${ft(H.role)}</div>`:""}
            </div>
            <button type="button" class="btn-change-assignment" id="decision-modal-change-owner-btn">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Change
            </button>
          </div>`}else C.innerHTML=`
          <div class="no-assignment">
            <span>No owner</span>
            <button type="button" class="btn-assign-now" id="decision-modal-choose-owner-btn">Choose</button>
          </div>`;const V=C.querySelector("#decision-modal-change-owner-btn"),I=C.querySelector("#decision-modal-choose-owner-btn");V&&u(V,"click",g),I&&u(I,"click",g)},g=function(){if(!A)return;const q=A.classList.contains("hidden");A.classList.toggle("hidden",!q),q&&b.length===0?Je.getAll().then(V=>{b=V?.contacts||[],v(Q?.value||"")}).catch(()=>{M&&(M.innerHTML='<div class="empty-state">Failed to load contacts</div>')}):q&&v(Q?.value||""),Q&&Q.focus()},v=function(q){if(!M)return;const V=q?b.filter(H=>(H.name||"").toLowerCase().includes(q.toLowerCase())||(H.role||"").toLowerCase().includes(q.toLowerCase())):b;if(b.length===0){M.innerHTML='<div class="empty-state">Loading...</div>';return}if(V.length===0){M.innerHTML='<div class="empty-state">No contacts match</div>';return}const I=(T?.value||"").trim();M.innerHTML=V.map(H=>{const W=bl(H);return`
            <div class="contact-card-picker ${I===(H.name||"").trim()?"selected":""}" data-contact-name="${ft(H.name||"")}">
              <div class="contact-avatar-picker">${W?`<img src="${ft(W)}" alt="" onerror="this.parentElement.innerHTML='${Yi(H.name||"")}'">`:Yi(H.name||"")}</div>
              <div class="contact-info-picker">
                <div class="contact-name-picker">${ft(H.name||"")}</div>
                ${H.role?`<div class="contact-role-picker">${ft(H.role)}</div>`:""}
              </div>
            </div>`}).join(""),M.querySelectorAll(".contact-card-picker").forEach(H=>{u(H,"click",()=>{const W=H.getAttribute("data-contact-name")||"";W&&(f(W),A&&A.classList.add("hidden"))})})};const y=n?.content??n?.decision??"",S=n?.impact??"",w=n?.summary??"";c.innerHTML=`
      <form id="decision-form" class="decision-form">
        <div class="form-group">
          <label for="decision-text">Decision *</label>
          <textarea id="decision-text" rows="3" required 
                    placeholder="What was decided?">${ft(y)}</textarea>
        </div>
        
        <div class="form-group">
          <label for="decision-rationale">Rationale</label>
          <div class="form-group-with-action">
            <textarea id="decision-rationale" rows="2" 
                      placeholder="Why was this decision made?">${ft(n?.rationale||"")}</textarea>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="decision-impact">Impact</label>
            <select id="decision-impact">
              <option value="">—</option>
              <option value="low" ${S==="low"?"selected":""}>Low</option>
              <option value="medium" ${S==="medium"||!S?"selected":""}>Medium</option>
              <option value="high" ${S==="high"?"selected":""}>High</option>
            </select>
          </div>
          <div class="form-group">
            <label for="decision-summary">Summary (one line)</label>
            <input type="text" id="decision-summary" 
                   value="${ft(w)}" 
                   placeholder="One-line summary for lists/reports">
          </div>
        </div>
        
        <div class="form-row form-row-actions">
          <button type="button" class="btn-ai-suggest btn-sm" id="decision-ai-suggest-btn" title="Suggest rationale, impact and summary from decision text">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            AI suggest
          </button>
          <span class="form-hint" id="decision-suggest-hint"></span>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="decision-status">Status</label>
            <select id="decision-status">
              <option value="proposed" ${n?.status==="proposed"||!n?"selected":""}>Proposed</option>
              <option value="approved" ${n?.status==="approved"?"selected":""}>Approved</option>
              <option value="rejected" ${n?.status==="rejected"?"selected":""}>Rejected</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Made By</label>
            <input type="hidden" id="decision-by" value="${ft(n?.madeBy||"")}">
            <div id="decision-made-by-display" class="current-assignment-card decision-modal-owner-card"></div>
            <div id="decision-modal-contact-picker" class="contact-picker-sota contact-picker-mt hidden">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="decision-modal-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="decision-modal-contact-list" class="contact-list-grid">Loading...</div>
            </div>
          </div>
        </div>
      </form>
    `;const k=c.querySelector("#decision-ai-suggest-btn"),x=c.querySelector("#decision-suggest-hint");k&&u(k,"click",async()=>{const q=I=>c.querySelector(`#${I}`)?.value?.trim()||"",V=q("decision-text");if(!V){h.warning("Enter decision text first");return}k.disabled=!0,x&&(x.textContent="Asking AI…");try{const I=await Re.suggest(V,q("decision-rationale"));c.querySelector("#decision-rationale").value=I.rationale||"",c.querySelector("#decision-impact").value=I.impact||"medium",c.querySelector("#decision-summary").value=I.summary||"",x&&(x.textContent=I.impact_summary?`Impact: ${I.impact_summary}`:"Done")}catch{x&&(x.textContent=""),h.error("AI suggest failed")}finally{k.disabled=!1}});let b=[];const C=c.querySelector("#decision-made-by-display"),T=c.querySelector("#decision-by"),A=c.querySelector("#decision-modal-contact-picker"),M=c.querySelector("#decision-modal-contact-list"),Q=c.querySelector("#decision-modal-contact-search");Je.getAll().then(q=>{b=q?.contacts||[],f(n?.madeBy||"")}).catch(()=>{f(n?.madeBy||"")}),Q&&Q.addEventListener("input",()=>v(Q.value))}const l=_("div",{className:"modal-footer"});if(o&&n){if(n.status==="proposed"){const g=_("button",{className:"btn btn-success",textContent:"Approve"}),v=_("button",{className:"btn btn-danger",textContent:"Reject"});u(g,"click",()=>yl(String(n.id),"approved")),u(v,"click",()=>yl(String(n.id),"rejected")),l.appendChild(v),l.appendChild(g)}const m=_("button",{className:"btn btn-primary",textContent:"Edit"}),f=_("button",{className:"btn btn-secondary",textContent:"Close"});u(f,"click",()=>U(Sn)),u(m,"click",()=>{U(Sn),Fs({...e,mode:"edit"})}),l.appendChild(f),l.appendChild(m)}else{const m=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),f=_("button",{className:"btn btn-primary",textContent:a?"Save Changes":"Create Decision"});if(u(m,"click",()=>U(Sn)),u(f,"click",async()=>{const g=c.querySelector("#decision-form");if(!g.checkValidity()){g.reportValidity();return}const v=w=>c.querySelector(`#${w}`)?.value.trim()||"",y={id:n?.id||`dec-${Date.now()}`,decision:v("decision-text"),rationale:v("decision-rationale")||void 0,status:v("decision-status"),madeBy:v("decision-by")||void 0,madeAt:n?.madeAt||new Date().toISOString(),impact:v("decision-impact")||void 0,summary:v("decision-summary")||void 0};f.disabled=!0,f.textContent="Saving...";const S={content:y.decision,decision:y.decision,rationale:y.rationale,status:y.status,made_by:y.madeBy,impact:y.impact,summary:y.summary};try{if(a)await p.put(`/api/decisions/${n.id}`,S),h.success("Decision updated");else{const w=await p.post("/api/decisions",S);y.id=w.data.id,h.success("Decision recorded")}s?.(y),U(Sn)}catch{}finally{f.disabled=!1,f.textContent=a?"Save Changes":"Create Decision"}}),a){const g=_("button",{className:"btn btn-danger",textContent:"Delete"});u(g,"click",async()=>{const{confirm:v}=await ve(async()=>{const{confirm:S}=await Promise.resolve().then(()=>vn);return{confirm:S}},void 0);if(await v("Are you sure you want to delete this decision?",{title:"Delete Decision",confirmText:"Delete",confirmClass:"btn-danger"}))try{await p.delete(`/api/decisions/${n.id}`),h.success("Decision deleted"),i?.(String(n.id)),U(Sn)}catch{}}),l.appendChild(g)}l.appendChild(m),l.appendChild(f)}const d=Me({id:Sn,title:o?"Decision Details":a?"Edit Decision":"Record Decision",content:c,size:"md",footer:l});document.body.appendChild(d),qe(Sn)}async function yl(e,t,n){try{await p.patch(`/api/decisions/${e}`,{status:t}),h.success(`Decision ${t}`),U(Sn)}catch{}}function ft(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function ht(e){return e.trim().split(/\s+/).map(t=>t[0]).join("").toUpperCase().substring(0,2)}function me(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function ma(e){if(!e)return"—";try{return hs(e)}catch{return e}}function Pr(e){const{decision:t,onClose:n,onUpdate:s,onDecisionClick:i,onActionClick:a}=e,o=_("div",{className:"decision-detail-view question-detail-view"});o.innerHTML=`
    <div class="question-detail-header decision-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Decisions</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Decision #${String(t.id).substring(0,8)}</span>
      </div>
      <div class="header-actions">
        <span class="status-badge status-${(t.status||"active").toLowerCase()}">${me(String(t.status))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content decision-detail-content">
      <div id="decision-view-content">
      <section class="detail-section decision-main">
        <div class="question-badges decision-badges">
          ${t.impact?`<span class="priority-pill impact-${t.impact}">${me(t.impact)} impact</span>`:""}
          ${t.generation_source?`<span class="status-pill">${me(t.generation_source)}</span>`:""}
          <span class="question-date decision-date">Created ${Ee(t.created_at)}</span>
        </div>
        <h2 class="question-text decision-content-text" id="decision-view-content-text">${me(t.content)}</h2>
      </section>

      <div class="detail-columns">
        <div class="detail-column-left">
          <section class="detail-section">
            <div class="section-header-sota">
              <h3>Rationale / Context</h3>
              <span class="section-subtitle">Why was this decision made?</span>
              <button type="button" class="btn-ai-suggest" id="decision-rationale-ai-suggest-btn" title="Suggest rationale, impact and summary from decision text">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Suggest
              </button>
            </div>
            <div id="decision-view-rationale">${t.rationale||t.context?`<p class="decision-rationale">${me(t.rationale||t.context||"")}</p>`:'<p class="text-muted">No rationale recorded</p>'}</div>
            <div id="decision-suggestions-panel" class="suggestions-panel-sota decision-suggestions-panel hidden gm-mt-2"></div>
          </section>

          <section class="detail-section" id="decision-owner-section">
            <div class="section-header-sota">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Owner / Made by
                <span class="section-subtitle">Who made this decision?</span>
              </h3>
              <button type="button" class="btn-ai-suggest" id="decision-owner-ai-suggest-btn" title="Suggest owner from decision content">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Suggest
              </button>
            </div>

            <div id="decision-current-owner" class="current-assignment-card">
              ${t.made_by||t.owner?`
                <div class="assigned-contact-display">
                  <div class="contact-avatar-lg" id="decision-owner-avatar">${ht(t.made_by||t.owner||"")}</div>
                  <div class="contact-details">
                    <div class="contact-name-lg">${me(t.made_by||t.owner||"")}</div>
                    <div class="contact-role-sm" id="decision-owner-role">—</div>
                  </div>
                  <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    Change
                  </button>
                </div>
              `:`
                <div class="no-assignment">
                  <div class="no-assignment-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                  </div>
                  <span>No owner</span>
                  <p class="no-assignment-hint">Choose from contacts</p>
                  <button class="btn-assign-now" id="decision-show-owner-picker-btn" type="button">Choose</button>
                </div>
              `}
            </div>

            <div id="decision-contact-picker" class="contact-picker-sota hidden">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="decision-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="decision-contact-list" class="contact-list-grid">Loading...</div>
            </div>

            <div id="decision-owner-suggestions-panel" class="suggestions-panel-sota decision-owner-suggestions-panel hidden gm-mt-2"></div>

            ${t.approved_by?`<p class="text-muted gm-mt-2">Approved by: ${me(t.approved_by)}</p>`:""}
            ${t.decided_at?`<p class="text-muted">Decided: ${ma(t.decided_at)}</p>`:""}
          </section>

          <section class="detail-section">
            <div class="section-header">
              <h3>Source</h3>
            </div>
            ${t.source_file?`<p class="source-file">${me(t.source_file)}</p>`:""}
            ${t.source_document_id?`
              <p class="source-doc">
                <a href="#" class="doc-link" data-document-id="${me(String(t.source_document_id))}">View source document</a>
              </p>
            `:""}
            ${!t.source_file&&!t.source_document_id?'<p class="text-muted">No source recorded</p>':""}
          </section>
        </div>

        <div class="detail-column-right">
          <section class="detail-section metadata-section">
            <div class="section-header">
              <h3>Metadata</h3>
            </div>
            <dl class="metadata-list">
              <dt>Created</dt>
              <dd>${ma(t.created_at)}</dd>
              ${t.updated_at?`<dt>Updated</dt><dd>${ma(t.updated_at)}</dd>`:""}
            </dl>
          </section>

          <section class="detail-section" id="decision-implementing-tasks-section">
            <div class="section-header">
              <h3>Implementing tasks</h3>
            </div>
            <div id="decision-implementing-tasks-list" class="decision-implementing-tasks-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>

          <section class="detail-section decision-timeline-section">
            <div class="section-header">
              <h3>Timeline</h3>
            </div>
            <div id="decision-timeline-list" class="decision-timeline-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>

          <section class="detail-section decision-similar-section">
            <div class="section-header">
              <h3>Similar decisions</h3>
            </div>
            <div id="decision-similar-list" class="decision-similar-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-secondary" id="edit-decision-btn">Edit</button>
        <button type="button" class="btn btn-danger" id="delete-decision-btn">Delete</button>
      </div>
      </div>

      <div id="decision-edit-form" class="decision-detail-edit-form hidden">
        <form id="decision-inline-form" class="decision-form">
          <div class="form-group">
            <label for="decision-edit-content">Decision *</label>
            <textarea id="decision-edit-content" rows="3" required placeholder="What was decided?">${me(t.content||"")}</textarea>
          </div>
          <div class="form-group">
            <div class="gm-flex gm-flex-center gm-justify-between gm-flex-wrap gm-gap-2 gm-mb-2">
              <label for="decision-edit-rationale" class="gm-mb-0">Rationale</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="decision-edit-ai-suggest-btn" title="Suggest rationale, impact and summary from decision text">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="decision-edit-rationale" rows="2" placeholder="Why was this decision made?">${me(t.rationale||t.context||"")}</textarea>
          </div>
          <div id="decision-edit-suggestions-panel" class="suggestions-panel-sota hidden gm-mb-3"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="decision-edit-impact">Impact</label>
              <select id="decision-edit-impact">
                <option value="low" ${t.impact==="low"?"selected":""}>Low</option>
                <option value="medium" ${t.impact==="medium"||!t.impact?"selected":""}>Medium</option>
                <option value="high" ${t.impact==="high"?"selected":""}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="decision-edit-summary">Summary (one line)</label>
              <input type="text" id="decision-edit-summary" value="${me(t.summary||"")}" placeholder="One-line summary for lists/reports">
            </div>
            <div class="form-group">
              <label for="decision-edit-status">Status</label>
              <select id="decision-edit-status">
                <option value="proposed" ${t.status==="proposed"||!t.status?"selected":""}>Proposed</option>
                <option value="approved" ${t.status==="approved"?"selected":""}>Approved</option>
                <option value="rejected" ${t.status==="rejected"?"selected":""}>Rejected</option>
                <option value="deferred" ${t.status==="deferred"?"selected":""}>Deferred</option>
                <option value="active" ${t.status==="active"?"selected":""}>Active</option>
                <option value="superseded" ${t.status==="superseded"?"selected":""}>Superseded</option>
                <option value="revoked" ${t.status==="revoked"?"selected":""}>Revoked</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Made by</label>
            <input type="hidden" id="decision-edit-made-by" value="${me(t.made_by||t.owner||"")}">
            <div id="decision-edit-owner-display" class="current-assignment-card decision-edit-owner-card"></div>
            <div id="decision-edit-contact-picker" class="contact-picker-sota hidden gm-mt-2">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="decision-edit-contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="decision-edit-contact-list" class="contact-list-grid">Loading...</div>
            </div>
          </div>
        </form>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="decision-save-btn">Save</button>
          <button type="button" class="btn btn-secondary" id="decision-cancel-edit-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="decision-delete-in-edit-btn">Delete</button>
        </div>
      </div>
    </div>
  `;const r=o.querySelector("#back-to-list");r&&u(r,"click",j=>{j.preventDefault(),n()});const c=o.querySelector("#close-detail");c&&u(c,"click",n);const l=o.querySelector("#decision-view-content"),d=o.querySelector("#decision-edit-form"),m=o.querySelector("#edit-decision-btn");m&&l&&d&&u(m,"click",()=>{l.classList.add("hidden"),d.classList.remove("hidden"),ue(k)});const f=o.querySelector("#decision-cancel-edit-btn");f&&l&&d&&u(f,"click",()=>{d.classList.add("hidden"),l.classList.remove("hidden")});const g=o.querySelector("#decision-save-btn");g&&d&&s&&u(g,"click",async()=>{const j=o.querySelector("#decision-inline-form");if(!j?.checkValidity()){j.reportValidity();return}const Z=o.querySelector("#decision-edit-content"),R=o.querySelector("#decision-edit-rationale"),D=o.querySelector("#decision-edit-impact"),K=o.querySelector("#decision-edit-summary"),ie=o.querySelector("#decision-edit-status"),xe=o.querySelector("#decision-edit-made-by"),Ce=Z?.value?.trim()||"";if(!Ce){h.error("Decision text is required");return}g.disabled=!0,g.textContent="Saving...";try{const $e=await Re.update(t.id,{content:Ce,rationale:R?.value?.trim()||void 0,impact:D?.value||void 0,summary:K?.value?.trim()||void 0,status:ie?.value||"active",made_by:xe?.value?.trim()||void 0});h.success("Decision updated");const it=o.querySelector("#decision-view-content-text");it&&(it.textContent=$e.content||Ce);const xt=o.querySelector("#decision-view-rationale");xt&&(xt.innerHTML=$e.rationale||$e.context?`<p class="decision-rationale">${me($e.rationale||$e.context||"")}</p>`:'<p class="text-muted">No rationale recorded</p>');const Jt=o.querySelector(".decision-detail-header .status-badge");Jt&&(Jt.textContent=String($e.status||"active"),Jt.className=`status-badge status-${($e.status||"active").toLowerCase()}`);const rn=o.querySelector(".decision-badges");if(rn){const At=$e.impact?`<span class="priority-pill impact-${$e.impact}">${me($e.impact||"")} impact</span>`:"",F=rn.innerHTML;if(At&&!F.includes("impact-"))rn.insertAdjacentHTML("afterbegin",At+" ");else if(At){const O=rn.querySelector(".priority-pill.impact-");O&&(O.outerHTML=At)}}k=$e.made_by||$e.owner||"";const $t=o.querySelector("#decision-current-owner");if($t&&k){const At=A(k),F=T(At);$t.innerHTML=`
            <div class="assigned-contact-display">
              <div class="contact-avatar-lg" id="decision-owner-avatar">${F?`<img src="${me(F)}" alt="" onerror="this.parentElement.innerHTML='${ht(k)}'">`:ht(k)}</div>
              <div class="contact-details">
                <div class="contact-name-lg">${me(k)}</div>
                <div class="contact-role-sm" id="decision-owner-role">${me(At?.role??"—")}</div>
              </div>
              <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                Change
              </button>
            </div>`;const O=$t.querySelector("#decision-change-owner-btn");O&&u(O,"click",Q)}else if($t&&!k){$t.innerHTML=`
            <div class="no-assignment">
              <div class="no-assignment-icon">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              </div>
              <span>No owner</span>
              <p class="no-assignment-hint">Choose from contacts</p>
              <button class="btn-assign-now" id="decision-show-owner-picker-btn" type="button">Choose</button>
            </div>`;const At=$t.querySelector("#decision-show-owner-picker-btn");At&&u(At,"click",Q)}s($e),d.classList.add("hidden"),l.classList.remove("hidden")}catch{h.error("Failed to save decision")}finally{g.disabled=!1,g.textContent="Save"}});const v=o.querySelector("#decision-delete-in-edit-btn");v&&u(v,"click",async()=>{if(confirm("Are you sure you want to delete this decision?"))try{await Re.delete(t.id),h.success("Decision deleted"),n()}catch{h.error("Failed to delete decision")}});const y=o.querySelector("#delete-decision-btn");y&&u(y,"click",async()=>{if(confirm("Are you sure you want to delete this decision?"))try{await Re.delete(t.id),h.success("Decision deleted"),n()}catch{h.error("Failed to delete decision")}});const S=o.querySelector(".doc-link");S&&t.source_document_id&&u(S,"click",j=>{j.preventDefault(),window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:{tab:"files",documentId:t.source_document_id}}))});let w=[],k=t.made_by||t.owner||"";const x=o.querySelector("#decision-contact-picker"),b=o.querySelector("#decision-contact-list"),C=o.querySelector("#decision-contact-search");function T(j){if(!j)return null;const Z=j;return Z.photoUrl||Z.avatarUrl||Z.photo_url||Z.avatar_url||null}function A(j){if(!j||!w.length)return;const Z=j.trim().toLowerCase();if(!Z)return;const R=w.find(ie=>(ie.name||"").trim().toLowerCase()===Z);if(R)return R;const D=w.find(ie=>(ie.name||"").trim().toLowerCase().includes(Z)||Z.includes((ie.name||"").trim().toLowerCase()));return D||w.find(ie=>(ie.aliases||[]).some(xe=>String(xe).trim().toLowerCase()===Z))||w.find(ie=>(ie.aliases||[]).some(xe=>{const Ce=String(xe).trim().toLowerCase();return Ce.includes(Z)||Z.includes(Ce)}))}const M=(j="")=>{if(!b)return;const Z=j?w.filter(R=>(R.name||"").toLowerCase().includes(j.toLowerCase())||(R.role||"").toLowerCase().includes(j.toLowerCase())||(R.organization||"").toLowerCase().includes(j.toLowerCase())):w;if(w.length===0){b.innerHTML='<div class="empty-state">Loading contacts...</div>';return}if(Z.length===0){b.innerHTML='<div class="empty-state">No contacts match</div>';return}b.innerHTML=Z.map(R=>{const D=T(R);return`
          <div class="contact-card-picker ${(k||"").trim()===(R.name||"").trim()?"selected":""}" data-contact-name="${me(R.name||"")}">
            <div class="contact-avatar-picker">${D?`<img src="${me(D)}" alt="" onerror="this.parentElement.innerHTML='${ht(R.name||"")}'">`:ht(R.name||"")}</div>
            <div class="contact-info-picker">
              <div class="contact-name-picker">${me(R.name||"")}</div>
              ${R.role?`<div class="contact-role-picker">${me(R.role)}</div>`:""}
            </div>
          </div>`}).join(""),b.querySelectorAll(".contact-card-picker").forEach(R=>{u(R,"click",async()=>{const D=R.getAttribute("data-contact-name")||"";if(D)try{const K=await Re.update(t.id,{made_by:D});k=D,h.success(`Owner set to ${D}`),x&&x.classList.add("hidden"),s&&s({...t,made_by:D,...K});const ie=o.querySelector("#decision-current-owner");if(ie){const xe=A(D),Ce=T(xe);ie.innerHTML=`
              <div class="assigned-contact-display">
                <div class="contact-avatar-lg" id="decision-owner-avatar">${Ce?`<img src="${me(Ce)}" alt="" onerror="this.parentElement.innerHTML='${ht(D)}'">`:ht(D)}</div>
                <div class="contact-details">
                  <div class="contact-name-lg">${me(D)}</div>
                  <div class="contact-role-sm" id="decision-owner-role">${me(xe?.role??"—")}</div>
                </div>
                <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  Change
                </button>
              </div>`;const $e=ie.querySelector("#decision-change-owner-btn");$e&&u($e,"click",Q)}}catch{h.error("Failed to save owner")}})})},Q=()=>{x&&(x.classList.toggle("hidden"),!x.classList.contains("hidden")&&w.length===0?Je.getAll().then(j=>{w=j?.contacts||[],M(C?.value||"")}).catch(()=>{b&&(b.innerHTML='<div class="empty-state">Failed to load contacts</div>')}):x.classList.contains("hidden")||M(C?.value||""),C&&C.focus())},q=o.querySelector("#decision-change-owner-btn"),V=o.querySelector("#decision-show-owner-picker-btn");q&&x&&u(q,"click",Q),V&&x&&u(V,"click",Q),C&&C.addEventListener("input",()=>M(C.value)),Je.getAll().then(j=>{w=j?.contacts||[];const Z=A(k),R=o.querySelector("#decision-owner-role");R&&(R.textContent=Z?.role??"—");const D=o.querySelector("#decision-owner-avatar");if(D&&k){const K=T(Z);if(K){D.innerHTML="";const ie=document.createElement("img");ie.src=K,ie.alt="",ie.onerror=()=>{D.textContent=ht(k)},D.appendChild(ie)}}}).catch(()=>{});const I=o.querySelector("#decision-edit-owner-display"),H=o.querySelector("#decision-edit-made-by"),W=o.querySelector("#decision-edit-contact-picker"),ee=o.querySelector("#decision-edit-contact-list"),te=o.querySelector("#decision-edit-contact-search");function ue(j){if(!I||!H)return;if(H.value=j,j){const D=A(j),K=T(D);I.innerHTML=`
        <div class="assigned-contact-display">
          <div class="contact-avatar-lg">${K?`<img src="${me(K)}" alt="" onerror="this.parentElement.innerHTML='${ht(j)}'">`:ht(j)}</div>
          <div class="contact-details">
            <div class="contact-name-lg">${me(j)}</div>
            ${D?.role?`<div class="contact-role-sm">${me(D.role)}</div>`:""}
          </div>
          <button type="button" class="btn-change-assignment" id="decision-edit-change-owner-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            Change
          </button>
        </div>`}else I.innerHTML=`
        <div class="no-assignment">
          <span>No owner</span>
          <button type="button" class="btn-assign-now" id="decision-edit-choose-owner-btn">Choose</button>
        </div>`;const Z=I.querySelector("#decision-edit-change-owner-btn"),R=I.querySelector("#decision-edit-choose-owner-btn");Z&&u(Z,"click",ze),R&&u(R,"click",ze)}function Pe(j=""){if(!ee)return;const Z=j?w.filter(D=>(D.name||"").toLowerCase().includes(j.toLowerCase())||(D.role||"").toLowerCase().includes(j.toLowerCase())):w;if(w.length===0){ee.innerHTML='<div class="empty-state">Loading contacts...</div>';return}if(Z.length===0){ee.innerHTML='<div class="empty-state">No contacts match</div>';return}const R=(H?.value||"").trim();ee.innerHTML=Z.map(D=>{const K=T(D);return`
          <div class="contact-card-picker ${R===(D.name||"").trim()?"selected":""}" data-contact-name="${me(D.name||"")}">
            <div class="contact-avatar-picker">${K?`<img src="${me(K)}" alt="" onerror="this.parentElement.innerHTML='${ht(D.name||"")}'">`:ht(D.name||"")}</div>
            <div class="contact-info-picker">
              <div class="contact-name-picker">${me(D.name||"")}</div>
              ${D.role?`<div class="contact-role-picker">${me(D.role)}</div>`:""}
            </div>
          </div>`}).join(""),ee.querySelectorAll(".contact-card-picker").forEach(D=>{u(D,"click",()=>{const K=D.getAttribute("data-contact-name")||"";K&&(ue(K),W&&W.classList.add("hidden"))})})}function ze(){W&&(W.classList.toggle("hidden"),W.classList.contains("hidden")||(w.length===0?Je.getAll().then(j=>{w=j?.contacts||[],Pe(te?.value||"")}).catch(()=>{ee&&(ee.innerHTML='<div class="empty-state">Failed to load contacts</div>')}):Pe(te?.value||"")),te&&te.focus())}te&&te.addEventListener("input",()=>Pe(te.value)),ue(t.made_by||t.owner||"");const st=o.querySelector("#decision-owner-ai-suggest-btn"),we=o.querySelector("#decision-owner-suggestions-panel");st&&we&&u(st,"click",async()=>{st.disabled=!0,we.classList.remove("hidden"),we.innerHTML='<div class="loading">Asking AI…</div>';try{w.length===0&&(w=(await Je.getAll())?.contacts||[]);const{suggested_owners:j}=await Re.suggestOwner(t.content||"",t.rationale||t.context||"");j?.length?(we.innerHTML=`
            <div class="suggestions-header-sota">
              <div class="ai-badge">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Recommended
              </div>
            </div>
            <div class="suggestions-list-sota">
              ${j.map((R,D)=>{const K=A(R.name),ie=T(K),xe=K?.role??R.reason??"",Ce=R.score??0,$e=Ce>=70?"var(--success)":Ce>=50?"var(--warning)":"var(--text-muted)";return`
                <div class="suggestion-card-sota decision-owner-card" data-owner-name="${me(R.name)}">
                  <div class="suggestion-rank">#${D+1}</div>
                  <div class="suggestion-avatar-sota">${ie?`<img src="${me(ie)}" alt="" onerror="this.parentElement.innerHTML='${ht(R.name)}'">`:ht(R.name)}</div>
                  <div class="suggestion-info-sota">
                    <div class="suggestion-name-sota">${me(R.name)}</div>
                    ${xe?`<div class="suggestion-reason-sota">${me(xe)}</div>`:""}
                  </div>
                  ${Ce>0?`<div class="suggestion-score-sota" style="--score-color: ${$e}"><div class="score-value">${Ce}%</div><div class="score-label">Match</div></div>`:""}
                  <button type="button" class="btn-select-suggestion">Assign</button>
                </div>`}).join("")}
            </div>
            <div class="suggestions-footer"><button type="button" class="btn-link" id="decision-owner-hide-suggest-btn">Close</button></div>
          `,we.querySelectorAll(".decision-owner-card .btn-select-suggestion").forEach(R=>{const K=R.closest(".decision-owner-card")?.getAttribute("data-owner-name")||"";K&&u(R,"click",async()=>{try{const ie=await Re.update(t.id,{made_by:K});k=K,h.success(`Owner set to ${K}`),we.classList.add("hidden");const xe=o.querySelector("#decision-current-owner");if(xe){const Ce=A(K),$e=T(Ce);xe.innerHTML=`
                    <div class="assigned-contact-display">
                      <div class="contact-avatar-lg" id="decision-owner-avatar">${$e?`<img src="${me($e)}" alt="" onerror="this.parentElement.innerHTML='${ht(K)}'">`:ht(K)}</div>
                      <div class="contact-details">
                        <div class="contact-name-lg">${me(K)}</div>
                        <div class="contact-role-sm" id="decision-owner-role">${me(Ce?.role??"—")}</div>
                      </div>
                      <button class="btn-change-assignment" id="decision-change-owner-btn" type="button">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        Change
                      </button>
                    </div>`;const it=xe.querySelector("#decision-change-owner-btn");it&&u(it,"click",Q)}s&&s(ie)}catch{h.error("Failed to save owner")}})})):we.innerHTML='<div class="no-suggestions">No owner suggestions. <button type="button" class="btn-link" id="decision-owner-hide-suggest-btn">Close</button></div>';const Z=we.querySelector("#decision-owner-hide-suggest-btn");Z&&u(Z,"click",()=>{we.classList.add("hidden")})}catch{we.innerHTML='<div class="error">AI suggest failed. <button type="button" class="btn-link" id="decision-owner-hide-suggest-btn">Close</button></div>';const j=we.querySelector("#decision-owner-hide-suggest-btn");j&&u(j,"click",()=>{we.classList.add("hidden")}),h.error("AI suggest failed")}finally{st.disabled=!1}});const oe=o.querySelector("#decision-rationale-ai-suggest-btn"),Y=o.querySelector("#decision-suggestions-panel");oe&&Y&&u(oe,"click",async()=>{oe.disabled=!0,Y.classList.remove("hidden"),Y.innerHTML='<div class="loading">Asking AI…</div>';try{const j=await Re.suggest(t.content||"",t.rationale||t.context||"");Y.innerHTML=`
          <div class="suggestion-card">
            <p><strong>Rationale:</strong> ${me((j.rationale||"").substring(0,300))}${(j.rationale||"").length>300?"…":""}</p>
            <p><strong>Impact:</strong> ${me(j.impact||"")} ${j.impact_summary?`– ${me(j.impact_summary)}`:""}</p>
            <p><strong>Summary:</strong> ${me(j.summary||"")}</p>
            <button type="button" class="btn btn-primary btn-sm" id="decision-apply-suggestion-btn">Apply</button>
          </div>`;const Z=Y.querySelector("#decision-apply-suggestion-btn");Z&&u(Z,"click",async()=>{try{const R=await Re.update(t.id,{rationale:j.rationale,impact:j.impact,summary:j.summary});h.success("Suggestion applied");const D=o.querySelector("#decision-view-rationale");D&&(D.innerHTML=R.rationale||R.context?`<p class="decision-rationale">${me(R.rationale||R.context||"")}</p>`:'<p class="text-muted">No rationale recorded</p>');const K=o.querySelector(".decision-badges");if(K&&R.impact){const ie=K.querySelector(".priority-pill.impact-low, .priority-pill.impact-medium, .priority-pill.impact-high");ie?ie.outerHTML=`<span class="priority-pill impact-${R.impact}">${me(R.impact||"")} impact</span>`:K.insertAdjacentHTML("afterbegin",`<span class="priority-pill impact-${R.impact}">${me(R.impact||"")} impact</span> `)}s&&s(R),Y.classList.add("hidden")}catch{h.error("Failed to apply")}})}catch{Y.innerHTML='<div class="error">AI suggest failed</div>',h.error("AI suggest failed")}finally{oe.disabled=!1}});const le=o.querySelector("#decision-edit-ai-suggest-btn"),G=o.querySelector("#decision-edit-suggestions-panel");le&&u(le,"click",async()=>{const j=o.querySelector("#decision-edit-content"),Z=o.querySelector("#decision-edit-rationale"),R=o.querySelector("#decision-edit-impact"),D=o.querySelector("#decision-edit-summary"),K=j?.value?.trim()||"";if(!K){h.warning("Enter decision text first");return}le.disabled=!0,G&&(G.classList.remove("hidden"),G.innerHTML='<span class="text-muted">Asking AI…</span>');try{const ie=await Re.suggest(K,Z?.value?.trim()||"");Z&&(Z.value=ie.rationale||""),R&&(R.value=ie.impact||"medium"),D&&(D.value=ie.summary||""),G&&(G.classList.add("hidden"),G.innerHTML=""),h.success("Suggestion applied")}catch{G&&(G.innerHTML='<span class="error">AI suggest failed</span>'),h.error("AI suggest failed")}finally{le.disabled=!1}});const ge=o.querySelector("#decision-timeline-list");ge&&Re.getEvents(t.id).then(j=>{const Z={created:"Created",updated:"Updated",conflict_detected:"Conflict detected",deleted:"Deleted",restored:"Restored"},R=D=>D.actor_name||(D.event_data?.trigger==="decision_check_flow"?"System":null);if(j.length===0){ge.innerHTML='<span class="text-muted">No events yet</span>';return}ge.innerHTML=j.map(D=>{const K=R(D);return`<div class="decision-timeline-item decision-event-${me(D.event_type)}">
            <span class="decision-event-type">${me(Z[D.event_type]||D.event_type)}</span>
            ${K?`<span class="decision-event-actor">${me(K)}</span>`:""}
            <span class="decision-event-date">${Ee(D.created_at)}</span>
          </div>`}).join("")}).catch(()=>{ge.innerHTML='<span class="text-muted">Could not load timeline</span>'});const ye=o.querySelector("#decision-similar-list");ye&&Re.getSimilarDecisions(t.id,10).then(j=>{if(j.length===0){ye.innerHTML='<span class="text-muted">No similar decisions</span>';return}ye.innerHTML=j.map(Z=>`
          <div class="decision-similar-item" data-decision-id="${Z.decision.id}" role="${i?"button":"none"}">
            <span class="decision-similar-score">${Math.round(Z.similarityScore*100)}%</span>
            <span class="decision-similar-content">${me((Z.decision.content||"").substring(0,80))}${(Z.decision.content||"").length>80?"…":""}</span>
          </div>
        `).join(""),i&&ye.querySelectorAll(".decision-similar-item").forEach(Z=>{u(Z,"click",()=>{const R=j.find(D=>String(D.decision.id)===Z.getAttribute("data-decision-id"));R&&i(R.decision)})})}).catch(()=>{ye.innerHTML='<span class="text-muted">Could not load similar decisions</span>'});const _e=o.querySelector("#decision-implementing-tasks-list");return _e&&Le.getAll(void 0,void 0,String(t.id)).then(j=>{if(j.length===0){_e.innerHTML='<span class="text-muted">No tasks linked to this decision</span>';return}_e.innerHTML=j.map(Z=>{const R=(Z.content||Z.task||"").toString().trim().substring(0,60)+((Z.content||Z.task||"").toString().length>60?"…":""),D=(Z.status||"pending").toLowerCase();return`<div class="decision-implementing-task-item" data-action-id="${me(String(Z.id))}" role="${a?"button":"none"}">
            <span class="status-pill status-${D}">${me(String(Z.status||"pending").replace("_"," "))}</span>
            <span class="decision-implementing-task-title">${me(R)}</span>
          </div>`}).join(""),a&&_e.querySelectorAll(".decision-implementing-task-item").forEach(Z=>{u(Z,"click",()=>{const R=Z.getAttribute("data-action-id"),D=j.find(K=>String(K.id)===R);D&&a(D)})})}).catch(()=>{_e.innerHTML='<span class="text-muted">Could not load tasks</span>'}),o}const Dx=Object.freeze(Object.defineProperty({__proto__:null,createDecisionDetailView:Pr},Symbol.toStringTag,{value:"Module"}));function Nu(e,t,n){return{decision:n,onClose:()=>{e.innerHTML="",e.appendChild(ko(t))},onUpdate:()=>{e.innerHTML="",e.appendChild(ko(t))},onDecisionClick:s=>{e.innerHTML="",e.appendChild(Pr(Nu(e,t,s)))}}}let Ya="all",No="",Uu="status";function ko(e={}){const t=_("div",{className:"sot-panel decisions-panel"});t.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Decisions</h2>
        <span class="panel-count" id="decisions-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="decisions-filter" class="filter-select">
          <option value="all">All</option>
          <option value="proposed">Proposed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="deferred">Deferred</option>
          <option value="active">Active</option>
          <option value="superseded">Superseded</option>
          <option value="revoked">Revoked</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="status">By Status</button>
          <button class="view-tab" data-view="source">By Source</button>
        </div>
        <input type="search" id="decisions-search" class="search-input" placeholder="Search decisions..." title="Search">
        <button class="btn btn-secondary btn-sm" id="check-conflicts-btn" title="Check for conflicting decisions">Check Conflicts</button>
        <button class="btn btn-primary btn-sm" id="add-decision-btn">+ Add</button>
      </div>
    </div>
    <div id="conflicts-container" class="conflicts-container hidden"></div>
    <div class="panel-content" id="decisions-content">
      <div class="loading">Loading decisions...</div>
    </div>
    <div id="removed-decisions-container" class="removed-decisions-container hidden"></div>
  `;const n=t.querySelector("#decisions-filter");u(n,"change",()=>{Ya=n.value,Ft(t,e)});const s=t.querySelectorAll(".view-tab");s.forEach(c=>{u(c,"click",()=>{s.forEach(l=>l.classList.remove("active")),c.classList.add("active"),Uu=c.getAttribute("data-view"),Ft(t,e)})});const i=t.querySelector("#decisions-search");let a;u(i,"input",()=>{clearTimeout(a),a=window.setTimeout(()=>{No=i.value.trim(),Ft(t,e)},300)});const o=t.querySelector("#check-conflicts-btn");o&&u(o,"click",async()=>{const c=t.querySelector("#conflicts-container");await Fu(c,t,e)});const r=t.querySelector("#add-decision-btn");return r&&u(r,"click",()=>{Fs({mode:"create",onSave:()=>{Ft(t,e),xo(t,e)}})}),Ft(t,e),xo(t,e),t}async function Fu(e,t,n){e.classList.remove("hidden"),e.innerHTML='<div class="loading">Checking for conflicts...</div>';try{const i=(await Re.runDecisionCheck()).conflicts||[];if(i.length===0){e.innerHTML=`
        <div class="no-conflicts">
          <span class="success-icon">✓</span>
          <p>No conflicts detected</p>
        </div>
      `;return}e.innerHTML=i.map(a=>Px(a,t,n)).join(""),zx(e,t,n)}catch{e.innerHTML='<div class="error">Failed to check conflicts</div>'}}function Px(e,t,n){const s=e.decision1,i=e.decision2,a=(e.description||e.reason||"Conflict").substring(0,200);return`
    <div class="conflict-card-sota" data-decision-id1="${s.id}" data-decision-id2="${i.id}">
      <div class="conflict-card-priority-bar conflict-card-priority-bar-warning"></div>
      <div class="conflict-card-body">
        <div class="conflict-card-header">
          <span class="conflict-type-badge">Conflict</span>
          <p class="conflict-description">${yt(a)}</p>
        </div>
        <div class="conflict-pair">
          <div class="conflict-item">
            <div class="conflict-item-content">${yt((s.content||"").substring(0,120))}${(s.content||"").length>120?"…":""}</div>
            <button type="button" class="btn btn-sm conflict-keep-btn" data-keep-id="${s.id}" data-discard-id="${i.id}">Keep this</button>
          </div>
          <div class="conflict-vs">vs</div>
          <div class="conflict-item">
            <div class="conflict-item-content">${yt((i.content||"").substring(0,120))}${(i.content||"").length>120?"…":""}</div>
            <button type="button" class="btn btn-sm conflict-keep-btn" data-keep-id="${i.id}" data-discard-id="${s.id}">Keep this</button>
          </div>
        </div>
      </div>
    </div>
  `}function zx(e,t,n){e.querySelectorAll(".conflict-keep-btn").forEach(s=>{u(s,"click",async i=>{i.stopPropagation();const a=s.getAttribute("data-keep-id"),o=s.getAttribute("data-discard-id");if(!(!a||!o))try{await Re.delete(o),await Re.runDecisionCheck(),await Re.update(a,{status:"approved"}),h.success("Conflict resolved"),Ft(t,n),await Fu(e,t,n),xo(t,n)}catch{h.error("Failed to resolve conflict")}})})}async function xo(e,t){const n=e.querySelector("#removed-decisions-container");if(n)try{const s=await Re.getDeletedDecisions();if(s.length===0){n.classList.add("hidden"),n.innerHTML="";return}n.classList.remove("hidden"),n.innerHTML=`
      <div class="removed-decisions-section">
        <div class="removed-decisions-header section-header-sota">
          <h3>Removed decisions</h3>
          <span class="panel-count removed-count">${s.length}</span>
        </div>
        <p class="removed-decisions-hint">Restore to undo a conflict resolution; decision will be synced back to the graph.</p>
        <div class="removed-decisions-list">
          ${s.map(i=>`
            <div class="removed-decision-item" data-decision-id="${i.id}">
              <div class="removed-decision-content">${yt(Ix(i.content??"",100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join("")}
        </div>
      </div>
    `,n.querySelectorAll(".conflict-resolve-restore").forEach(i=>{u(i,"click",async()=>{const a=i.closest(".removed-decision-item")?.getAttribute("data-decision-id");if(a)try{await Re.restore(a),h.success("Decision restored"),Ft(e,t),xo(e,t)}catch{h.error("Failed to restore decision")}})})}catch{n.classList.add("hidden"),n.innerHTML=""}}function Ix(e,t){return e.length<=t?e:e.substring(0,t)+"…"}function Hx(e,t){if(!t)return e;const n=t.toLowerCase();return e.filter(s=>(s.content||"").toLowerCase().includes(n)||(s.rationale||"").toLowerCase().includes(n)||(s.made_by||"").toLowerCase().includes(n)||(s.source_file||"").toLowerCase().includes(n))}async function Ft(e,t){const n=e.querySelector("#decisions-content");n.innerHTML='<div class="loading">Loading...</div>';try{const s=Ya==="all"?void 0:Ya,i=await Re.getAll(s),a=Hx(i,No);Uu==="source"?Bx(n,a,t):Rx(n,a,t),ce.setDecisions(i),Ux(e,a.length)}catch{n.innerHTML='<div class="error">Failed to load decisions</div>'}}function Rx(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>${No?"No decisions match your search":"No decisions found"}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Decision</button>
      </div>
    `;const o=e.querySelector("#empty-add-btn");o&&u(o,"click",()=>{Fs({mode:"create",onSave:()=>Ft(e.closest(".decisions-panel"),n)})});return}const s=ce.getState().contacts||[],i={};t.forEach(o=>{const r=(o.status||"active").toLowerCase();i[r]||(i[r]=[]),i[r].push(o)});const a=Object.keys(i);a.length>1?e.innerHTML=a.map(o=>`
      <div class="question-group">
        <div class="group-header">
          <h3>${yt(o)}</h3>
          <span class="group-count">${i[o].length}</span>
        </div>
        <div class="group-items">
          ${i[o].map(r=>Xa(r,s)).join("")}
        </div>
      </div>
    `).join(""):e.innerHTML=t.map(o=>Xa(o,s)).join(""),Vu(e,t,n)}function Bx(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>${No?"No decisions match your search":"No decisions found"}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Decision</button>
      </div>
    `;const a=e.querySelector("#empty-add-btn");a&&u(a,"click",()=>{Fs({mode:"create",onSave:()=>Ft(e.closest(".decisions-panel"),n)})});return}const s=ce.getState().contacts||[],i={};t.forEach(a=>{const o=a.source_file||a.source||"Unknown source";i[o]||(i[o]=[]),i[o].push(a)}),e.innerHTML=Object.entries(i).map(([a,o])=>`
    <div class="question-group">
      <div class="group-header">
        <h3>${yt(a)}</h3>
        <span class="group-count">${o.length}</span>
      </div>
      <div class="group-items">
        ${o.map(r=>Xa(r,s)).join("")}
      </div>
    </div>
  `).join(""),Vu(e,t,n)}function Vu(e,t,n){e.querySelectorAll(".decision-card-sota").forEach(s=>{u(s,"click",r=>{if(r.target.closest(".card-actions"))return;const c=s.getAttribute("data-id"),l=t.find(d=>String(d.id)===c);if(l)if(n.useDetailView&&n.containerElement){const d=n.containerElement;d.innerHTML="",d.appendChild(Pr(Nu(d,n,l)))}else n.onDecisionClick?n.onDecisionClick(l):Fs({mode:"edit",decision:{...l,decision:l.content,madeBy:l.made_by,madeAt:l.created_at},onSave:()=>Ft(e.closest(".decisions-panel"),n)})});const i=s.querySelector(".approve-btn"),a=s.querySelector(".reject-btn"),o=s.getAttribute("data-id");i&&o&&u(i,"click",async r=>{r.stopPropagation();try{await Re.approve(o,"Current User"),Ft(e.closest(".decisions-panel"),n)}catch{}}),a&&o&&u(a,"click",async r=>{r.stopPropagation();try{await Re.reject(o),Ft(e.closest(".decisions-panel"),n)}catch{}})})}const wl={proposed:"#f59e0b",approved:"#10b981",rejected:"#ef4444",deferred:"#6b7280",active:"#3b82f6",superseded:"#8b5cf6",revoked:"#6b7280"};function Ox(e,t){if(!t||!e.length)return;const n=t.trim().toLowerCase();if(!n)return;const s=e.find(o=>(o.name||"").trim().toLowerCase()===n);if(s)return s;const i=e.find(o=>(o.name||"").trim().toLowerCase().includes(n)||n.includes((o.name||"").trim().toLowerCase()));return i||e.find(o=>(o.aliases||[]).some(r=>String(r).trim().toLowerCase()===n))||e.find(o=>(o.aliases||[]).some(r=>{const c=String(r).trim().toLowerCase();return c.includes(n)||n.includes(c)}))}function Nx(e){return e&&(e.photoUrl||e.avatarUrl||e.photo_url||e.avatar_url)||null}function kl(e){if(!e)return"?";const t=e.trim().split(/\s+/);return t.length===1?t[0].substring(0,2).toUpperCase():(t[0][0]+t[t.length-1][0]).toUpperCase()}function Xa(e,t){const n=(e.status||"active").toLowerCase(),s=n.replace(/\s+/g,"-"),i=wl[n]??wl.active,a=e.content||"",o=e.source_file||e.source||"",r=e.made_by||e.owner||"",c=r?Ox(t,r):void 0,l=Nx(c),d=r?`
        <div class="assignee-chip">
          <div class="assignee-avatar">${l?`<img src="${yt(l)}" alt="${yt(r)}" onerror="this.parentElement.innerHTML='${kl(r)}'">`:kl(r)}</div>
          <div class="assignee-info">
            <span class="assignee-name">${yt(r)}</span>
            ${c?.role?`<span class="assignee-role">${yt(c.role)}</span>`:""}
          </div>
        </div>
      `:'<span class="card-owner-placeholder text-muted">No owner</span>',m=o?`<span class="card-source-chip">${yt(o.substring(0,40))}${o.length>40?"…":""}</span>`:'<span class="card-source-chip text-muted">No source</span>';return`
    <div class="decision-card-sota question-card-sota" data-id="${e.id}" style="--decision-status-bar: ${i}">
      <div class="card-priority-bar decision-status-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="priority-pill status-${s}">${yt(String(e.status))}</span>
            ${e.impact?`<span class="status-pill">${yt(e.impact)} impact</span>`:""}
          </div>
          <span class="card-timestamp">${Ee(e.decided_at||e.created_at)}</span>
        </div>
        <div class="card-question-text">${yt(a)}</div>
        ${e.summary?`<div class="card-summary text-muted">${yt(e.summary)}</div>`:""}
        ${e.rationale?`<div class="card-rationale text-muted">${yt((e.rationale||"").substring(0,100))}${(e.rationale||"").length>100?"…":""}</div>`:""}
        <div class="card-bottom-row">
          <div class="card-requester">
            ${m}
            ${d}
          </div>
          <div class="card-assignment">
            ${e.status==="proposed"||e.status==="active"?'<span class="card-actions"><button type="button" class="btn btn-sm btn-success approve-btn">Approve</button><button type="button" class="btn btn-sm btn-danger reject-btn">Reject</button></span>':'<button type="button" class="btn-link decision-view-link">View</button>'}
          </div>
        </div>
      </div>
    </div>
  `}function Ux(e,t){const n=e.querySelector("#decisions-count");n&&(n.textContent=String(t))}function yt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function $n(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function ga(e){if(!e)return"—";try{return hs(e)}catch{return e}}function Uo(e){const{fact:t,onClose:n,onUpdate:s,onFactClick:i}=e,a=_("div",{className:"fact-detail-view question-detail-view"});a.innerHTML=`
    <div class="question-detail-header fact-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Facts</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Fact #${String(t.id).substring(0,8)}</span>
      </div>
      <div class="header-actions">
        ${t.verified?'<span class="verified-badge detail sla-badge">✓ Verified</span>':""}
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content fact-detail-content">
      <section class="detail-section question-main fact-main">
        <div class="question-badges fact-badges">
          ${t.category?`<span class="priority-pill category-${(t.category||"general").toLowerCase().replace(/\s+/g,"-")}">${$n(t.category)}</span>`:""}
          ${t.confidence!=null?`<span class="status-pill status-pending">${Math.round((t.confidence??0)*100)}%</span>`:""}
          ${t.verified?'<span class="auto-pill">✓ Verified</span>':""}
          <span class="question-date fact-date">Created ${Ee(t.created_at)}</span>
        </div>
        <h2 class="question-text fact-content-text">${$n(t.content)}</h2>
      </section>

      <div class="detail-columns">
        <div class="detail-column-left">
          <section class="detail-section">
            <div class="section-header">
              <h3>Source</h3>
            </div>
            ${t.source_file?`<p class="source-file">${$n(t.source_file)}</p>`:""}
            ${t.source?`<p class="source-ref">${$n(t.source)}</p>`:""}
            ${t.source_document_id?`
              <p class="source-doc">
                <a href="#" class="doc-link" data-document-id="${$n(String(t.source_document_id))}">View source document</a>
              </p>
            `:""}
            ${!t.source&&!t.source_file&&!t.source_document_id?'<p class="text-muted">No source recorded</p>':""}
          </section>

          <section class="detail-section verification-section">
            <div class="section-header">
              <h3>Verification</h3>
            </div>
            ${t.verified?`
              <div class="verified-info">
                <span class="verified-badge auto-pill">✓ Verified</span>
                ${t.verified_at?`<span class="text-muted">on ${ga(t.verified_at)}</span>`:""}
              </div>
            `:`
              <div class="unverified-info">
                <p class="text-muted">This fact has not been verified.</p>
                <button type="button" class="btn btn-success btn-sm" id="verify-fact-btn">Verify</button>
              </div>
            `}
          </section>
        </div>

        <div class="detail-column-right">
          <section class="detail-section metadata-section">
            <div class="section-header">
              <h3>Metadata</h3>
            </div>
            <dl class="metadata-list">
              <dt>Created</dt>
              <dd>${ga(t.created_at)}</dd>
              ${t.updated_at?`<dt>Updated</dt><dd>${ga(t.updated_at)}</dd>`:""}
            </dl>
          </section>

          <section class="detail-section fact-timeline-section">
            <div class="section-header">
              <h3>Timeline</h3>
            </div>
            <div id="fact-timeline-list" class="fact-timeline-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>

          <section class="detail-section fact-similar-section">
            <div class="section-header">
              <h3>Similar facts</h3>
            </div>
            <div id="fact-similar-list" class="fact-similar-list">
              <span class="text-muted">Loading…</span>
            </div>
          </section>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-secondary" id="edit-fact-btn">Edit</button>
        ${t.verified?"":'<button type="button" class="btn btn-success" id="verify-btn">Verify</button>'}
        <button type="button" class="btn btn-danger" id="delete-fact-btn">Delete</button>
      </div>
    </div>
  `;const o=a.querySelector("#back-to-list");o&&u(o,"click",y=>{y.preventDefault(),n()});const r=a.querySelector("#close-detail");r&&u(r,"click",n);const c=a.querySelector("#verify-fact-btn");c&&u(c,"click",async()=>{try{const y=await Ye.verify(t.id);h.success("Fact verified"),s&&s(y),n()}catch{h.error("Failed to verify fact")}});const l=a.querySelector("#verify-btn");l&&u(l,"click",async()=>{try{const y=await Ye.verify(t.id);h.success("Fact verified"),s&&s(y),n()}catch{h.error("Failed to verify fact")}});const d=a.querySelector("#edit-fact-btn");d&&u(d,"click",()=>{ve(async()=>{const{showFactModal:y}=await Promise.resolve().then(()=>Go);return{showFactModal:y}},void 0).then(({showFactModal:y})=>{y({mode:"edit",fact:t,onSave:S=>{s&&s(S),n()}})})});const m=a.querySelector("#delete-fact-btn");m&&u(m,"click",async()=>{if(confirm("Are you sure you want to delete this fact?"))try{await Ye.delete(t.id),h.success("Fact deleted"),n()}catch{h.error("Failed to delete fact")}});const f=a.querySelector(".doc-link");f&&t.source_document_id&&u(f,"click",y=>{y.preventDefault(),window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:{tab:"files",documentId:t.source_document_id}}))});const g=a.querySelector("#fact-timeline-list");g&&Ye.getEvents(t.id).then(y=>{const S={created:"Created",verified:"Verified",updated:"Updated",conflict_detected:"Conflict detected",deleted:"Deleted",restored:"Restored"},w=k=>k.actor_name||(k.event_data?.trigger==="fact_check_flow"?"System":null);if(y.length===0){g.innerHTML='<span class="text-muted">No events yet</span>';return}g.innerHTML=y.map(k=>{const x=w(k);return`<div class="fact-timeline-item fact-event-${$n(k.event_type)}">
              <span class="fact-event-type">${$n(S[k.event_type]||k.event_type)}</span>
              ${x?`<span class="fact-event-actor">${$n(x)}</span>`:""}
              <span class="fact-event-date">${Ee(k.created_at)}</span>
            </div>`}).join("")}).catch(()=>{g.innerHTML='<span class="text-muted">Could not load timeline</span>'});const v=a.querySelector("#fact-similar-list");return v&&Ye.getSimilarFacts(t.id,10).then(y=>{if(y.length===0){v.innerHTML='<span class="text-muted">No similar facts</span>';return}v.innerHTML=y.map(S=>`
            <div class="fact-similar-item" data-fact-id="${S.fact.id}" role="${i?"button":"none"}">
              <span class="fact-similar-score">${Math.round(S.similarityScore*100)}%</span>
              <span class="fact-similar-content">${$n((S.fact.content||"").substring(0,80))}${(S.fact.content||"").length>80?"…":""}</span>
            </div>
          `).join(""),i&&v.querySelectorAll(".fact-similar-item").forEach(S=>{u(S,"click",()=>{const w=y.find(k=>String(k.fact.id)===S.getAttribute("data-fact-id"));w&&i(w.fact)})})}).catch(()=>{v.innerHTML='<span class="text-muted">Could not load similar facts</span>'}),a}const Fx=Object.freeze(Object.defineProperty({__proto__:null,createFactDetailView:Uo},Symbol.toStringTag,{value:"Module"})),Vx=["technical","process","policy","people","timeline","general"];function Zu(e,t,n){return{fact:n,onClose:()=>{e.innerHTML="",e.appendChild(Is(t))},onUpdate:()=>{e.innerHTML="",e.appendChild(Is(t))},onFactClick:s=>{e.innerHTML="",e.appendChild(Uo(Zu(e,t,s)))}}}let Fo="",vi="all",Gu="category";function Is(e={}){const t=_("div",{className:"sot-panel facts-panel"});t.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Facts</h2>
        <span class="panel-count" id="facts-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="facts-filter" class="filter-select">
          <option value="all">All</option>
          <option value="verified">✓ Verified</option>
          <option value="unverified">Unverified</option>
          <option value="technical">Technical</option>
          <option value="process">Process</option>
          <option value="policy">Policy</option>
          <option value="people">People</option>
          <option value="timeline">Timeline</option>
          <option value="general">General</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="category">By Category</button>
          <button class="view-tab" data-view="source">By Source</button>
        </div>
        <input type="search" id="facts-search" class="search-input" placeholder="Search facts..." title="Search">
        <button class="btn btn-secondary btn-sm" id="check-conflicts-btn" title="Check for conflicting facts">Check Conflicts</button>
        <button class="btn btn-primary btn-sm" id="add-fact-btn">+ Add</button>
      </div>
    </div>
    <div id="conflicts-container" class="conflicts-container hidden"></div>
    <div class="panel-content" id="facts-content">
      <div class="loading">Loading facts...</div>
    </div>
    <div id="removed-facts-container" class="removed-facts-container hidden"></div>
  `;const n=t.querySelector("#facts-filter");n&&u(n,"change",()=>{vi=n.value,En(t,e)});const s=t.querySelectorAll(".view-tab");s.forEach(c=>{u(c,"click",()=>{s.forEach(l=>l.classList.remove("active")),c.classList.add("active"),Gu=c.getAttribute("data-view"),En(t,e)})});const i=t.querySelector("#facts-search");let a;u(i,"input",()=>{clearTimeout(a),a=window.setTimeout(()=>{Fo=i.value,En(t,e)},300)});const o=t.querySelector("#check-conflicts-btn");o&&u(o,"click",async()=>{const c=t.querySelector("#conflicts-container");await Ir(c,t,e)});const r=t.querySelector("#add-fact-btn");return r&&u(r,"click",()=>{Hr(t,e)}),En(t,e),t}async function En(e,t){const n=e.querySelector("#facts-content");n.innerHTML='<div class="loading">Loading...</div>';try{const s=Vx.includes(vi)?vi:void 0,{facts:i,total:a}=await Ye.getAll({search:Fo||void 0,limit:500,category:s}),o=vi==="verified"?i.filter(r=>r.verified):vi==="unverified"?i.filter(r=>!r.verified):i;Gu==="source"?Gx(n,o,t):Zx(n,o,t),Qx(e,o.length)}catch{n.innerHTML='<div class="error">Failed to load facts</div>'}await zr(e,t)}async function zr(e,t){const n=e.querySelector("#removed-facts-container");if(n)try{const s=await Ye.getDeletedFacts();if(s.length===0){n.classList.add("hidden"),n.innerHTML="";return}n.classList.remove("hidden"),n.innerHTML=`
      <div class="removed-facts-section">
        <div class="removed-facts-header section-header-sota">
          <h3>Removed facts</h3>
          <span class="panel-count removed-count">${s.length}</span>
        </div>
        <p class="removed-facts-hint">Restore to undo a conflict resolution; fact will be synced back to the graph.</p>
        <div class="removed-facts-list">
          ${s.map(i=>`
            <div class="removed-fact-item" data-fact-id="${i.id}">
              <div class="removed-fact-content">${fn($o(i.content??"",100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join("")}
        </div>
      </div>
    `,n.querySelectorAll(".conflict-resolve-restore").forEach(i=>{const o=i.closest(".removed-fact-item")?.getAttribute("data-fact-id");o&&u(i,"click",async()=>{try{await Ye.restoreFact(o),h.success("Fact restored"),await En(e,t),zr(e,t);const r=e.querySelector("#conflicts-container");r&&!r.classList.contains("hidden")&&await Ir(r,e,t)}catch{h.error("Failed to restore fact")}})})}catch{n.classList.add("hidden"),n.innerHTML=""}}function Zx(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>${Fo?"No facts match your search":"No facts found"}</p>
        <button class="btn btn-primary" id="empty-add-fact-btn">Add Fact</button>
      </div>
    `;const a=e.querySelector("#empty-add-fact-btn");a&&u(a,"click",()=>{const o=e.closest(".facts-panel");o&&Hr(o,n)});return}const s={};t.forEach(a=>{const o=a.category||"Uncategorized";s[o]||(s[o]=[]),s[o].push(a)}),Object.keys(s).length>1?e.innerHTML=Object.entries(s).map(([a,o])=>`
      <div class="question-group">
        <div class="group-header">
          <h3>${fn(a)}</h3>
          <span class="group-count">${o.length}</span>
        </div>
        <div class="group-items">
          ${o.map(r=>er(r)).join("")}
        </div>
      </div>
    `).join(""):e.innerHTML=t.map(a=>er(a)).join(""),e.querySelectorAll(".fact-card-sota").forEach(a=>{u(a,"click",()=>{const r=a.getAttribute("data-id"),c=t.find(l=>String(l.id)===r);if(c)if(n.useDetailView&&n.containerElement){const l=n.containerElement;l.innerHTML="",l.appendChild(Uo(Zu(l,n,c)))}else n.onFactClick?n.onFactClick(c):ve(async()=>{const{showFactModal:l}=await Promise.resolve().then(()=>Go);return{showFactModal:l}},void 0).then(({showFactModal:l})=>{l({mode:"view",fact:c})})});const o=a.querySelector(".fact-verify-btn");o&&u(o,"click",async r=>{r.stopPropagation();const c=a.getAttribute("data-id");if(c)try{await Ye.verify(c),h.success("Fact verified"),En(e.closest(".facts-panel"),n)}catch{}})})}function Gx(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>${Fo?"No facts match your search":"No facts found"}</p>
        <button class="btn btn-primary" id="empty-add-fact-btn">Add Fact</button>
      </div>
    `;const i=e.querySelector("#empty-add-fact-btn");i&&u(i,"click",()=>{const a=e.closest(".facts-panel");a&&Hr(a,n)});return}const s={};t.forEach(i=>{const a=i.source_file||i.source||"Unknown source";s[a]||(s[a]=[]),s[a].push(i)}),e.innerHTML=Object.entries(s).map(([i,a])=>`
    <div class="question-group">
      <div class="group-header">
        <h3>${fn(i)}</h3>
        <span class="group-count">${a.length}</span>
      </div>
      <div class="group-items">
        ${a.map(o=>er(o)).join("")}
      </div>
    </div>
  `).join(""),e.querySelectorAll(".fact-card-sota").forEach(i=>{u(i,"click",()=>{const o=i.getAttribute("data-id"),r=t.find(c=>String(c.id)===o);if(r)if(n.useDetailView&&n.containerElement){const c=n.containerElement,l=Uo({fact:r,onClose:()=>{c.innerHTML="";const d=Is(n);c.appendChild(d)},onUpdate:()=>{c.innerHTML="";const d=Is(n);c.appendChild(d)}});c.innerHTML="",c.appendChild(l)}else n.onFactClick?n.onFactClick(r):ve(async()=>{const{showFactModal:c}=await Promise.resolve().then(()=>Go);return{showFactModal:c}},void 0).then(({showFactModal:c})=>{c({mode:"view",fact:r})})});const a=i.querySelector(".fact-verify-btn");a&&u(a,"click",async o=>{o.stopPropagation();const r=i.getAttribute("data-id");if(r)try{await Ye.verify(r),h.success("Fact verified"),En(e.closest(".facts-panel"),n)}catch{}})})}const xl={technical:"#3b82f6",process:"#8b5cf6",policy:"#ec4899",people:"#10b981",timeline:"#f59e0b",general:"#6b7280"};function er(e){const t=(e.category||"general").toLowerCase(),n=t.replace(/\s+/g,"-"),s=xl[t]||xl.general,i=e.confidence!=null?Math.round(e.confidence*100):null;return`
    <div class="fact-card-sota question-card-sota ${e.verified?"has-answer":""}" data-id="${e.id}" style="--fact-category-bar: ${s}">
      <div class="card-priority-bar fact-category-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="priority-pill fact-category-pill category-${n}">${fn(e.category||"general")}</span>
            ${i!=null?`<span class="status-pill status-pending">${i}%</span>`:""}
            ${e.verified?'<span class="auto-pill">✓ Verified</span>':""}
          </div>
          <span class="card-timestamp">${Ee(e.created_at)}</span>
        </div>
        <div class="card-question-text">${fn(e.content)}</div>
        <div class="card-bottom-row">
          <div class="card-requester">
            ${e.source_file||e.source?`<span class="card-source-chip">${fn((e.source_file||e.source||"").substring(0,40))}${(e.source_file||e.source||"").length>40?"…":""}</span>`:'<span class="card-source-chip text-muted">No source</span>'}
          </div>
          <div class="card-assignment">
            ${e.verified?'<span class="answered-badge">Verified</span>':'<button type="button" class="btn-link fact-verify-btn">Verify</button>'}
          </div>
        </div>
      </div>
    </div>
  `}async function Ir(e,t,n){e.classList.remove("hidden"),e.innerHTML='<div class="loading">Checking for conflicts...</div>';try{const s=await Ye.detectConflicts();s.length===0?(e.innerHTML=`
        <div class="no-conflicts">
          <span class="success-icon">✓</span>
          <p>No conflicts detected</p>
        </div>
      `,setTimeout(()=>{e.classList.add("hidden")},3e3)):Wu(e,s,t,n)}catch{e.innerHTML='<div class="error">Failed to check conflicts</div>'}}function Wu(e,t,n,s){e.innerHTML=`
    <div class="conflicts-section">
      <div class="conflicts-header section-header-sota">
        <h3>Conflicts Detected</h3>
        <span class="conflicts-count panel-count">${t.length}</span>
        <button type="button" class="btn-icon close-conflicts" title="Close">×</button>
      </div>
      <div class="conflicts-list question-group">
        ${t.map((a,o)=>Wx(a,o)).join("")}
      </div>
    </div>
  `;const i=e.querySelector(".close-conflicts");i&&u(i,"click",()=>{e.classList.add("hidden")}),t.forEach((a,o)=>{const r=e.querySelector(`[data-conflict-index="${o}"]`);if(!r)return;const c=r.querySelector(".conflict-resolve-keep-left"),l=r.querySelector(".conflict-resolve-keep-right");c&&u(c,"click",d=>{d.stopPropagation(),$l(a,"left",n,s,e)}),l&&u(l,"click",d=>{d.stopPropagation(),$l(a,"right",n,s,e)})})}async function $l(e,t,n,s,i){const a=t==="left"?e.fact2:e.fact1,o=t==="left"?e.fact1:e.fact2;if(a?.id)try{await Ye.deleteFact(a.id),h.success(`Removed conflicting fact; kept: "${$o(o?.content??"",50)}"`),await En(n,s);try{await Ye.runFactCheck()}catch{}if(o?.id)try{await Ye.verifyFact(o.id)}catch{}await Ir(i,n,s);const r=await Ye.detectConflicts();r.length===0?(i.classList.add("hidden"),i.innerHTML=""):Wu(i,r,n,s),zr(n,s)}catch{h.error("Failed to resolve conflict")}}function Wx(e,t){const n=(e.conflictType||"contradiction").toLowerCase(),s=e.description||e.reason||"Conflict detected";return`
    <div class="conflict-card-sota" data-conflict-index="${t}">
      <div class="conflict-type-bar ${n==="contradiction"?"conflict-bar-contradiction":n==="inconsistency"?"conflict-bar-inconsistency":"conflict-bar-process"}"></div>
      <div class="conflict-card-body">
        <div class="conflict-card-top">
          <span class="conflict-type-pill conflict-type-${n}">${fn(n)}</span>
          ${e.confidence!=null?`<span class="conflict-confidence-pill">${Math.round(e.confidence*100)}%</span>`:""}
        </div>
        <div class="conflict-facts-row">
          <div class="conflict-fact-cell">
            <div class="conflict-fact-snippet">${fn($o(e.fact1?.content??"",120))}</div>
            <button type="button" class="btn btn-sm conflict-resolve-keep-left">Keep this</button>
          </div>
          <span class="conflict-vs">vs</span>
          <div class="conflict-fact-cell">
            <div class="conflict-fact-snippet">${fn($o(e.fact2?.content??"",120))}</div>
            <button type="button" class="btn btn-sm conflict-resolve-keep-right">Keep this</button>
          </div>
        </div>
        <div class="conflict-description-row">
          <div class="conflict-description">${fn(s)}</div>
        </div>
      </div>
    </div>
  `}function $o(e,t){return e.length<=t?e:e.slice(0,t).trim()+"…"}async function Hr(e,t){const{showFactModal:n}=await ve(async()=>{const{showFactModal:s}=await Promise.resolve().then(()=>Go);return{showFactModal:s}},void 0);n({mode:"create",onSave:()=>En(e,t)})}function Qx(e,t){const n=e.querySelector("#facts-count");n&&(n.textContent=String(t))}function fn(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Qu(e){const t=_("div",{className:`stats-card ${e.onClick?"clickable":""} ${e.color?`color-${e.color}`:""}`});t.setAttribute("data-stat-id",e.id);const n=e.trend?`
    <div class="stat-trend ${e.trend.direction} ${e.trend.sentiment}">
      <span class="trend-arrow">${Kx(e.trend.direction)}</span>
      <span class="trend-value">${e.trend.value}%</span>
    </div>
  `:"";return t.innerHTML=`
    ${e.icon?`<div class="stat-icon">${e.icon}</div>`:""}
    <div class="stat-value">${typeof e.value=="number"?_u(e.value):e.value}</div>
    <div class="stat-label">${e.label}</div>
    ${e.subValue?`<div class="stat-sub">${e.subValue}</div>`:""}
    ${n}
  `,e.onClick&&u(t,"click",e.onClick),t}function Kx(e){switch(e){case"up":return"↑";case"down":return"↓";case"stable":return"→"}}function Jx(e,t,n){const s=e.querySelector(".stat-value"),i=e.querySelector(".stat-sub");s&&(s.textContent=typeof t=="number"?_u(t):t),i&&n!==void 0&&(i.textContent=n)}function Yx(e){const t=_("div",{className:"stats-grid"});return e.forEach(n=>{const s=Qu(n);t.appendChild(s)}),t}function Xx(e){const{health:t,showFactors:n=!0,size:s="md"}=e,i=t.status.toLowerCase().replace(/\s+/g,"-"),a=_("div",{className:`health-indicator ${i} size-${s}`});return a.innerHTML=`
    <div class="health-gauge">
      <svg class="gauge-svg" viewBox="0 0 100 50">
        <path class="gauge-bg" d="M 10 50 A 40 40 0 0 1 90 50" />
        <path class="gauge-fill" d="M 10 50 A 40 40 0 0 1 90 50" 
              style="stroke-dasharray: ${t.score/100*126} 126; stroke: ${t.color};" />
      </svg>
      <div class="gauge-center">
        <span class="score-value">${t.score}</span>
        <span class="score-label">Health</span>
      </div>
    </div>
    <div class="health-status" style="--health-status-color: ${t.color}">${t.status}</div>
    ${n&&t.factors.length>0?`
      <div class="health-factors">
        ${t.factors.slice(0,4).map(o=>`
          <div class="factor ${o.type}">
            <span class="factor-icon">${o.type==="positive"?"✓":"!"}</span>
            <span class="factor-text">${o.factor}</span>
          </div>
        `).join("")}
      </div>
    `:""}
  `,a}function e$(e,t,n){const s=_("div",{className:"health-badge"});return s.innerHTML=`
    <span class="badge-score" style="--badge-bg: ${n}">${e}</span>
    <span class="badge-status">${t}</span>
  `,s}function t$(e){return e>=80||e>=60?"var(--color-success-500)":e>=40?"var(--color-warning-500)":e>=20?"var(--color-warning-600)":"var(--color-danger-500)"}function n$(e){return e>=80?"Healthy":e>=60?"Good":e>=40?"Needs Attention":e>=20?"At Risk":"Critical"}const So={facts:{line:"var(--color-info-500)",fill:"color-mix(in srgb, var(--color-info-500), transparent 90%)"},questions:{line:"var(--color-warning-500)",fill:"color-mix(in srgb, var(--color-warning-500), transparent 90%)"},risks:{line:"var(--color-danger-500)",fill:"color-mix(in srgb, var(--color-danger-500), transparent 90%)"},actions:{line:"var(--color-success-500)",fill:"color-mix(in srgb, var(--color-success-500), transparent 90%)"},decisions:{line:"var(--color-accent-500)",fill:"color-mix(in srgb, var(--color-accent-500), transparent 90%)"}};function s$(e){const{data:t,metrics:n=["facts","questions","risks"],height:s=200}=e,i=_("div",{className:"trend-chart-container"});if(i.style.height=`${s}px`,t.length===0)return i.innerHTML='<div class="empty-chart">No trend data available</div>',i;const a=_("canvas",{id:`trend-chart-${Date.now()}`});return i.appendChild(a),i$(a,t,n),i}function i$(e,t,n){if(typeof window.Chart>"u"){console.warn("Chart.js not loaded, using fallback"),o$(e.parentElement,t,n);return}const s=window.Chart,i=t.map(o=>Ku(o.date)),a=n.map(o=>({label:tr(o),data:t.map(r=>r[o]||0),borderColor:So[o]?.line||"#6366f1",backgroundColor:So[o]?.fill||"rgba(99, 102, 241, 0.1)",fill:!0,tension:.3}));new s(e,{type:"line",data:{labels:i,datasets:a},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{position:"bottom"}},scales:{y:{beginAtZero:!0}}}})}function o$(e,t,n){const s=Math.max(...t.flatMap(i=>n.map(a=>i[a]||0)));e.innerHTML=`
    <div class="fallback-chart">
      <div class="chart-legend">
        ${n.map(i=>`
          <span class="legend-item">
            <span class="legend-color" style="--legend-color: ${So[i]?.line||"#6366f1"}"></span>
            ${tr(i)}
          </span>
        `).join("")}
      </div>
      <div class="chart-bars">
        ${t.slice(-7).map(i=>`
          <div class="bar-group">
            ${n.map(a=>{const o=i[a]||0;return`<div class="bar" style="--bar-height: ${s>0?o/s*100:0}; --bar-color: ${So[a]?.line||"#6366f1"}" title="${tr(a)}: ${o}"></div>`}).join("")}
            <div class="bar-label">${Ku(i.date)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `}function Ku(e){return new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"})}function tr(e){return e.charAt(0).toUpperCase()+e.slice(1)}const a$=["critical","high","medium","low"],Sl=["high","medium","low"],r$={"critical-high":"var(--color-danger-700)","critical-medium":"var(--color-danger-600)","critical-low":"var(--color-danger-500)","high-high":"var(--color-danger-500)","high-medium":"var(--color-warning-600)","high-low":"var(--color-warning-500)","medium-high":"var(--color-warning-600)","medium-medium":"var(--color-warning-500)","medium-low":"var(--color-warning-100)","low-high":"var(--color-warning-500)","low-medium":"var(--color-success-500)","low-low":"var(--color-success-600)"};function c$(e){const{risks:t,onCellClick:n,size:s="md"}=e,i=_("div",{className:`risk-matrix size-${s}`}),a=l$(t);return i.innerHTML=`
    <div class="matrix-container">
      <div class="matrix-y-label">Impact</div>
      <div class="matrix-grid">
        <div class="matrix-header">
          <div class="matrix-corner"></div>
          ${Sl.map(o=>`<div class="matrix-col-header">${nr(o)}</div>`).join("")}
        </div>
        ${a$.map(o=>`
          <div class="matrix-row">
            <div class="matrix-row-header">${nr(o)}</div>
            ${Sl.map(r=>{const c=`${o}-${r}`,l=a[c]||[],d=r$[c]||"#e5e7eb",m=l.length;return`
                <div class="matrix-cell ${m>0?"has-risks":""}" 
                     data-impact="${o}" 
                     data-likelihood="${r}"
                     style="background-color: ${m>0?d:"var(--color-surface-hover)"}">
                  ${m>0?`<span class="cell-count">${m}</span>`:""}
                </div>
              `}).join("")}
          </div>
        `).join("")}
      </div>
      <div class="matrix-x-label">Likelihood</div>
    </div>
    <div class="matrix-legend">
      <span class="legend-item"><span class="legend-color risk-legend-low"></span> Low</span>
      <span class="legend-item"><span class="legend-color risk-legend-medium"></span> Medium</span>
      <span class="legend-item"><span class="legend-color risk-legend-high"></span> High</span>
      <span class="legend-item"><span class="legend-color risk-legend-critical"></span> Critical</span>
    </div>
  `,n&&i.querySelectorAll(".matrix-cell.has-risks").forEach(o=>{u(o,"click",()=>{const r=o.getAttribute("data-impact")||"",c=o.getAttribute("data-likelihood")||"",l=`${r}-${c}`,d=a[l]||[];n(d,r,c)})}),i}function l$(e){const t={};return e.filter(n=>n.status!=="mitigated"&&n.status!=="closed").forEach(n=>{const s=`${n.impact}-${n.likelihood}`;t[s]||(t[s]=[]),t[s].push(n)}),t}function nr(e){return e.charAt(0).toUpperCase()+e.slice(1)}function d$(e){const t=_("div",{className:"risk-summary"}),n={critical:e.filter(s=>s.impact==="critical"&&s.status==="open").length,high:e.filter(s=>s.impact==="high"&&s.status==="open").length,medium:e.filter(s=>s.impact==="medium"&&s.status==="open").length,low:e.filter(s=>s.impact==="low"&&s.status==="open").length};return t.innerHTML=`
    <div class="summary-bars">
      ${Object.entries(n).map(([s,i])=>`
        <div class="summary-bar">
          <span class="bar-label">${nr(s)}</span>
          <div class="bar-track">
            <div class="bar-fill impact-${s}" style="--bar-width: ${Math.min(i*20,100)}"></div>
          </div>
          <span class="bar-count">${i}</span>
        </div>
      `).join("")}
    </div>
  `,t}let hn=[];function u$(e={}){const{allowedTypes:t,maxFileSize:n=50*1024*1024,multiple:s=!0}=e,i=_("div",{className:"file-uploader"});i.innerHTML=`
    <div class="dropzone" id="dropzone">
      <div class="dropzone-content">
        <div class="dropzone-icon">📤</div>
        <div class="dropzone-text">
          <p>Drag & drop files here</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
        <input type="file" id="file-input" ${s?"multiple":""} 
               ${t?`accept="${t.join(",")}"`:""} hidden>
      </div>
    </div>
    <div class="file-queue hidden" id="file-queue"></div>
    <div class="upload-actions hidden" id="upload-actions">
      <button class="btn btn-secondary" id="clear-queue-btn">Clear</button>
      <button class="btn btn-primary" id="upload-btn">Upload Files</button>
    </div>
    <div class="processing-status hidden" id="processing-status"></div>
  `;const a=i.querySelector("#dropzone"),o=i.querySelector("#file-input"),r=i.querySelector("#file-queue"),c=i.querySelector("#upload-actions"),l=i.querySelector("#processing-status");u(a,"click",()=>o.click()),u(o,"change",()=>{o.files&&(_l(Array.from(o.files),n),Tn(r,c)),o.value=""}),u(a,"dragover",f=>{f.preventDefault(),a.classList.add("dragover")}),u(a,"dragleave",()=>{a.classList.remove("dragover")}),u(a,"drop",f=>{f.preventDefault(),a.classList.remove("dragover");const g=Array.from(f.dataTransfer?.files||[]);g.length>0&&(_l(g,n),Tn(r,c))});const d=i.querySelector("#clear-queue-btn");d&&u(d,"click",()=>{hn=[],Tn(r,c)});const m=i.querySelector("#upload-btn");return m&&u(m,"click",async()=>{await p$(r,c,l,e)}),m$(l),i}function _l(e,t){e.forEach(n=>{if(n.size>t){h.warning(`${n.name} is too large (max ${Ro(t)})`);return}hn.some(s=>s.file.name===n.name&&s.file.size===n.size)||hn.push({file:n,id:`file-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,progress:0,status:"pending"})})}function Tn(e,t){if(hn.length===0){e.classList.add("hidden"),t.classList.add("hidden");return}e.classList.remove("hidden"),t.classList.remove("hidden"),e.innerHTML=hn.map(n=>`
    <div class="queued-file ${n.status}" data-id="${n.id}">
      <div class="file-info">
        <span class="file-icon">${g$(n.file.type)}</span>
        <span class="file-name">${sr(n.file.name)}</span>
        <span class="file-size">${Ro(n.file.size)}</span>
      </div>
      <div class="file-status">
        ${n.status==="uploading"?`
          <div class="progress-bar">
            <div class="progress-fill" style="--progress: ${n.progress}"></div>
          </div>
          <span class="progress-text">${n.progress}%</span>
        `:n.status==="complete"?`
          <span class="status-icon success">✓</span>
        `:n.status==="error"?`
          <span class="status-icon error">✕</span>
          <span class="error-text">${sr(n.error||"Error")}</span>
        `:`
          <button class="btn-icon remove-file" data-id="${n.id}">×</button>
        `}
      </div>
    </div>
  `).join(""),e.querySelectorAll(".remove-file").forEach(n=>{u(n,"click",s=>{s.stopPropagation();const i=n.getAttribute("data-id");hn=hn.filter(a=>a.id!==i),Tn(e,t)})})}async function p$(e,t,n,s){const i=hn.filter(o=>o.status==="pending");if(i.length===0)return;const a=t.querySelector("#upload-btn");a&&(a.disabled=!0);try{i.forEach(r=>{r.status="uploading",r.progress=0}),Tn(e,t);const o=await Os.upload(i.map(r=>r.file),r=>{i.forEach(c=>{c.progress=r}),Tn(e,t)});i.forEach(r=>{r.status="complete",r.progress=100}),Tn(e,t),h.success(`Uploaded ${o.files.length} file(s)`),s.onUploadComplete?.(o),setTimeout(()=>{hn=hn.filter(r=>r.status!=="complete"),Tn(e,t)},2e3),o.processingStarted&&(s.onProcessingStart?.(),Ju(n))}catch(o){i.forEach(r=>{r.status="error",r.error=o instanceof Error?o.message:"Upload failed"}),Tn(e,t)}finally{a&&(a.disabled=!1)}}async function m$(e){try{const t=await Os.getProcessingStatus();(t.isProcessing||t.queueLength>0)&&(Yu(e,t),Ju(e))}catch{}}let zn=null;function Ju(e){zn||(zn=window.setInterval(async()=>{try{const t=await Os.getProcessingStatus();Yu(e,t),!t.isProcessing&&t.queueLength===0&&(zn&&(clearInterval(zn),zn=null),setTimeout(()=>e.classList.add("hidden"),3e3))}catch{zn&&(clearInterval(zn),zn=null)}},2e3))}function Yu(e,t){e.classList.remove("hidden"),e.innerHTML=`
    <div class="processing-header">
      <span class="processing-icon">${t.isProcessing?"⏳":"✓"}</span>
      <span class="processing-title">${t.isProcessing?"Processing...":"Complete"}</span>
    </div>
    <div class="processing-stats">
      <span>Completed: ${t.completedCount}</span>
      <span>Pending: ${t.queueLength}</span>
      ${t.errorCount>0?`<span class="error">Errors: ${t.errorCount}</span>`:""}
    </div>
    ${t.processingFile?`<div class="current-file">Current: ${sr(t.processingFile)}</div>`:""}
    ${t.isProcessing?`
      <div class="processing-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="--progress: ${t.completedCount/(t.completedCount+t.queueLength+1)*100}"></div>
        </div>
      </div>
    `:""}
  `}function g$(e){return e.startsWith("image/")?"🖼️":e.startsWith("video/")?"🎬":e.startsWith("audio/")?"🎵":e==="application/pdf"?"📄":e.includes("spreadsheet")||e.includes("excel")?"📊":e.includes("document")||e.includes("word")?"📝":e.includes("presentation")||e.includes("powerpoint")?"📽️":e.includes("text")?"📃":"📁"}function sr(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const _o={Person:"#6366f1",Document:"#22c55e",Question:"#f59e0b",Risk:"#ef4444",Action:"#8b5cf6",Decision:"#06b6d4",Fact:"#84cc16",Email:"#ec4899",default:"#9ca3af"};function f$(e={}){const{height:t=500}=e,n=_("div",{className:"knowledge-graph"});return n.innerHTML=`
    <div class="graph-toolbar">
      <div class="graph-filters">
        <label class="filter-item">
          <input type="checkbox" checked data-type="Person"> People
        </label>
        <label class="filter-item">
          <input type="checkbox" checked data-type="Document"> Documents
        </label>
        <label class="filter-item">
          <input type="checkbox" checked data-type="Question"> Questions
        </label>
        <label class="filter-item">
          <input type="checkbox" checked data-type="Risk"> Risks
        </label>
      </div>
      <div class="graph-actions">
        <input type="search" id="graph-search" class="search-input" placeholder="Search nodes...">
        <button class="btn btn-sm" id="graph-refresh">Refresh</button>
        <button class="btn btn-sm" id="graph-fit">Fit</button>
      </div>
    </div>
    <div class="graph-container" id="graph-container" style="--graph-height: ${t}px;">
      <div class="graph-loading">Loading graph...</div>
    </div>
    <div class="graph-stats" id="graph-stats"></div>
    <div class="node-details hidden" id="node-details"></div>
  `,Rr(n,e),n}async function Rr(e,t){const n=e.querySelector("#graph-container"),s=e.querySelector("#graph-stats");if(!window.vis){n.innerHTML=`
      <div class="graph-fallback">
        <p>Graph visualization requires vis-network library</p>
        <p class="text-muted">Add vis-network to enable interactive graph</p>
      </div>
    `,await Cl(s);return}try{const{nodes:i,edges:a}=await xr.getVisualizationData();if(i.length===0){n.innerHTML=`
        <div class="graph-empty">
          <p>No graph data available</p>
          <p class="text-muted">Process some documents to populate the knowledge graph</p>
        </div>
      `;return}const o=h$(n,i,a,t);b$(e,o,i,t),await Cl(s)}catch{n.innerHTML=`
      <div class="graph-error">
        <p>Failed to load graph</p>
        <button class="btn btn-sm" id="retry-graph">Retry</button>
      </div>
    `;const a=n.querySelector("#retry-graph");a&&u(a,"click",()=>Rr(e,t))}}function h$(e,t,n,s){e.innerHTML="";const i=t.map(c=>({id:c.id,label:c.label||c.name||c.id,color:_o[c.type]||_o.default,title:`${c.type}: ${c.label||c.name||c.id}`,shape:"dot",size:v$(c)})),a=n.map(c=>({from:c.source,to:c.target,label:c.type,arrows:"to",color:{color:"#9ca3af",opacity:.6}})),o={nodes:{borderWidth:2,shadow:!0,font:{size:12,color:getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim()||"#333"}},edges:{width:1,shadow:!1,smooth:{type:"continuous"},font:{size:10,color:"#9ca3af"}},physics:{stabilization:{iterations:100},barnesHut:{gravitationalConstant:-5e3,springLength:150}},interaction:{hover:!0,tooltipDelay:200}},r=new window.vis.Network(e,{nodes:new window.vis.DataSet(i),edges:new window.vis.DataSet(a)},o);return r.on("click",c=>{if(c.nodes&&c.nodes.length>0){const l=c.nodes[0],d=t.find(m=>m.id===l);d&&s.onNodeClick&&s.onNodeClick(d),y$(e,d)}}),r}function v$(e){const t=e.connections||1;return Math.min(10+t*2,30)}function b$(e,t,n,s){const i=e.querySelector("#graph-search");u(i,"input",()=>{const r=i.value.toLowerCase(),c=n.find(l=>(l.label||l.name||l.id).toLowerCase().includes(r));c&&t.focus(c.id,{scale:1.5})});const a=e.querySelector("#graph-refresh");a&&u(a,"click",()=>{Rr(e,s)});const o=e.querySelector("#graph-fit");o&&u(o,"click",()=>{t.fit()}),e.querySelectorAll(".filter-item input").forEach(r=>{u(r,"change",()=>{h.info("Filtering not yet implemented")})})}function y$(e,t){const n=e.querySelector("#node-details");if(!t){n.classList.add("hidden");return}n.classList.remove("hidden"),n.innerHTML=`
    <div class="details-header">
      <span class="node-type" style="--type-color: ${_o[t.type]||_o.default}">${t.type}</span>
      <span class="node-label">${fa(t.label||t.name||t.id)}</span>
      <button class="btn-icon close-details">×</button>
    </div>
    ${t.properties?`
      <div class="details-properties">
        ${Object.entries(t.properties).map(([i,a])=>`
          <div class="property">
            <span class="property-key">${fa(i)}:</span>
            <span class="property-value">${fa(String(a))}</span>
          </div>
        `).join("")}
      </div>
    `:""}
  `;const s=n.querySelector(".close-details");s&&u(s,"click",()=>{n.classList.add("hidden")})}async function Cl(e){try{const t=await xr.getStats();w$(e,t)}catch{e.innerHTML=""}}function w$(e,t){e.innerHTML=`
    <div class="stat-item">
      <span class="stat-value">${t.nodeCount}</span>
      <span class="stat-label">Nodes</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${t.edgeCount}</span>
      <span class="stat-label">Edges</span>
    </div>
    ${t.nodeTypes?Object.entries(t.nodeTypes).map(([n,s])=>`
      <div class="stat-item type-${n.toLowerCase()}">
        <span class="stat-value">${s}</span>
        <span class="stat-label">${n}</span>
      </div>
    `).join(""):""}
  `}function fa(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function k$(e={}){const{days:t=30}=e,n=_("div",{className:"timeline-container"});n.innerHTML=`
    <div class="timeline-header">
      <h3>Timeline</h3>
      <select id="timeline-days" class="filter-select">
        <option value="7" ${t===7?"selected":""}>Last 7 days</option>
        <option value="14" ${t===14?"selected":""}>Last 14 days</option>
        <option value="30" ${t===30?"selected":""}>Last 30 days</option>
        <option value="90" ${t===90?"selected":""}>Last 90 days</option>
      </select>
    </div>
    <div class="timeline-filters">
      <button class="filter-btn active" data-type="all">All</button>
      <button class="filter-btn" data-type="document">Documents</button>
      <button class="filter-btn" data-type="question">Questions</button>
      <button class="filter-btn" data-type="decision">Decisions</button>
      <button class="filter-btn" data-type="risk">Risks</button>
    </div>
    <div class="timeline-content" id="timeline-content">
      <div class="loading">Loading timeline...</div>
    </div>
  `;const s=n.querySelector("#timeline-days");u(s,"change",()=>{Ll(n,parseInt(s.value),e)});const i=n.querySelectorAll(".filter-btn");return i.forEach(a=>{u(a,"click",()=>{i.forEach(o=>o.classList.remove("active")),a.classList.add("active"),S$(n,a.getAttribute("data-type")||"all")})}),Ll(n,t,e),n}async function Ll(e,t,n){const s=e.querySelector("#timeline-content");s.innerHTML='<div class="loading">Loading...</div>';try{const i=await yd.getAll({limit:t*10});x$(s,i.events||[],n)}catch{s.innerHTML='<div class="error">Failed to load timeline</div>'}}function x$(e,t,n){if(t.length===0){e.innerHTML='<div class="empty-state">No events in this period</div>';return}const s=$$(t);e.innerHTML=`
    <div class="timeline">
      ${Object.entries(s).map(([i,a])=>`
        <div class="timeline-day">
          <div class="timeline-date">${Si(i)}</div>
          ${a.map(o=>`
            <div class="timeline-event" data-type="${o.type}" data-id="${o.id}">
              <div class="event-marker ${o.type}"></div>
              <div class="event-content">
                <div class="event-header">
                  <span class="event-type">${o.type}</span>
                  <span class="event-time">${_$(o.date)}</span>
                </div>
                <div class="event-title">${ha(o.title)}</div>
                ${o.description?`<div class="event-description">${ha(o.description)}</div>`:""}
                ${o.user?`<div class="event-user">by ${ha(o.user)}</div>`:""}
              </div>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".timeline-event").forEach(i=>{u(i,"click",()=>{const a=i.getAttribute("data-id"),o=t.find(r=>String(r.id)===a);o&&n.onEventClick&&n.onEventClick(o)})})}function $$(e){const t={};return e.forEach(n=>{const s=n.date.split("T")[0];t[s]||(t[s]=[]),t[s].push(n)}),Object.fromEntries(Object.entries(t).sort(([n],[s])=>s.localeCompare(n)))}function S$(e,t){e.querySelectorAll(".timeline-event").forEach(s=>{t==="all"||s.getAttribute("data-type")===t?s.classList.remove("hidden"):s.classList.add("hidden")}),e.querySelectorAll(".timeline-day").forEach(s=>{const i=s.querySelectorAll(".timeline-event:not(.hidden)");s.classList.toggle("hidden",i.length===0)})}function _$(e){return new Date(e).toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit"})}function ha(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}let Br=!1,zi="",nn=0,Rn=[];const C$={question:"❓",risk:"⚠️",action:"✓",decision:"⚖️",contact:"👤",document:"📄",email:"📧",fact:"💡"};function Xu(e={}){let t=document.getElementById("global-search-modal");t||(t=L$(e),document.body.appendChild(t)),Ut.register("mod+k",n=>{n.preventDefault(),ir()}),Ut.register("/",n=>{document.activeElement?.tagName!=="INPUT"&&document.activeElement?.tagName!=="TEXTAREA"&&(n.preventDefault(),ir())})}function L$(e){const t=_("div",{id:"global-search-modal",className:"global-search-modal hidden"});t.innerHTML=`
    <div class="search-backdrop"></div>
    <div class="search-dialog">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="global-search-input" class="search-input" 
               placeholder="Search questions, risks, contacts..." autocomplete="off">
        <kbd class="search-shortcut">ESC</kbd>
      </div>
      <div class="search-results" id="search-results">
        <div class="search-hint">
          <p>Start typing to search...</p>
          <div class="search-tips">
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
        </div>
      </div>
      <div class="search-footer">
        <span>Type to search</span>
        <span>Press <kbd>?</kbd> for more shortcuts</span>
      </div>
    </div>
  `;const n=t.querySelector(".search-backdrop"),s=t.querySelector("#global-search-input"),i=t.querySelector("#search-results");return u(n,"click",Vs),u(s,"input",()=>{zi=s.value,nn=0,A$(i,e)}),u(s,"keydown",a=>{T$(a,i,e)}),t}function ir(){Br?Vs():ep()}function ep(){const e=document.getElementById("global-search-modal");if(!e)return;Br=!0,e.classList.remove("hidden");const t=e.querySelector("#global-search-input");t.value="",t.focus(),zi="",Rn=[],nn=0;const n=e.querySelector("#search-results");n.innerHTML=`
    <div class="search-hint">
      <p>Start typing to search...</p>
      <div class="search-tips">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>ESC</kbd> Close</span>
      </div>
    </div>
  `,document.addEventListener("keydown",tp)}function Vs(){const e=document.getElementById("global-search-modal");e&&(Br=!1,e.classList.add("hidden"),document.removeEventListener("keydown",tp))}function tp(e){e.key==="Escape"&&Vs()}function T$(e,t,n){switch(e.key){case"ArrowDown":e.preventDefault(),nn=Math.min(nn+1,Rn.length-1),or(t);break;case"ArrowUp":e.preventDefault(),nn=Math.max(nn-1,0),or(t);break;case"Enter":e.preventDefault();const s=Rn[nn];s&&np(s,n);break;case"Escape":Vs();break}}function or(e){e.querySelectorAll(".search-result").forEach((n,s)=>{n.classList.toggle("selected",s===nn),s===nn&&n.scrollIntoView({block:"nearest"})})}let Tl;function A$(e,t){clearTimeout(Tl),Tl=window.setTimeout(()=>{E$(e,t)},200)}async function E$(e,t){if(!zi.trim()){e.innerHTML=`
      <div class="search-hint">
        <p>Start typing to search...</p>
        <div class="search-tips">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    `,Rn=[];return}e.innerHTML='<div class="search-loading">Searching...</div>';try{Rn=(await p.get(`/api/search?q=${encodeURIComponent(zi)}&limit=10`)).data.results||[],Al(e,Rn,t)}catch{Rn=M$(),Al(e,Rn,t)}}function M$(e){return[]}function Al(e,t,n){if(t.length===0){e.innerHTML=`
      <div class="search-empty">
        <p>No results found for "${va(zi)}"</p>
      </div>
    `;return}const s=j$(t);e.innerHTML=Object.entries(s).map(([i,a])=>`
    <div class="search-group">
      <div class="group-label">${D$(i)}s</div>
      ${a.map((o,r)=>`
        <div class="search-result ${r===nn?"selected":""}" data-index="${t.indexOf(o)}">
          <span class="result-icon">${C$[o.type]||"📋"}</span>
          <div class="result-content">
            <div class="result-title">${va(o.title)}</div>
            ${o.subtitle?`<div class="result-subtitle">${va(o.subtitle)}</div>`:""}
          </div>
          <span class="result-type">${o.type}</span>
        </div>
      `).join("")}
    </div>
  `).join(""),e.querySelectorAll(".search-result").forEach(i=>{u(i,"click",()=>{const a=parseInt(i.getAttribute("data-index")||"0"),o=t[a];o&&np(o,n)}),u(i,"mouseenter",()=>{nn=parseInt(i.getAttribute("data-index")||"0"),or(e)})})}function np(e,t){Vs(),t.onResultClick?t.onResultClick(e):q$(e)}function q$(e){window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:{type:e.type,id:e.id}}))}function j$(e){const t={};return e.forEach(n=>{t[n.type]||(t[n.type]=[]),t[n.type].push(n)}),t}function D$(e){return e.charAt(0).toUpperCase()+e.slice(1)}function va(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}let Bt=new Set;function P$(e){const t=_("div",{className:"bulk-actions-bar hidden"});t.innerHTML=`
    <div class="bulk-info">
      <span class="bulk-count">0</span> selected
    </div>
    <div class="bulk-buttons">
      ${z$(e.type)}
      <button class="btn btn-sm btn-secondary" id="bulk-clear">Clear</button>
    </div>
  `;const n=t.querySelector("#bulk-clear");return n&&u(n,"click",()=>{Or(),Vo(t)}),I$(t,e),t}function z$(e){const t=`
    <button class="btn btn-sm btn-danger" id="bulk-delete">Delete</button>
  `;switch(e){case"questions":return`
        <button class="btn btn-sm" id="bulk-status" data-status="resolved">Mark Resolved</button>
        <button class="btn btn-sm" id="bulk-assign">Assign To...</button>
        ${t}
      `;case"actions":return`
        <button class="btn btn-sm" id="bulk-status" data-status="completed">Mark Complete</button>
        <button class="btn btn-sm" id="bulk-assign">Assign To...</button>
        ${t}
      `;case"risks":return`
        <button class="btn btn-sm" id="bulk-status" data-status="mitigated">Mark Mitigated</button>
        ${t}
      `;case"decisions":return`
        <button class="btn btn-sm" id="bulk-status" data-status="approved">Approve</button>
        <button class="btn btn-sm" id="bulk-status" data-status="rejected">Reject</button>
        ${t}
      `;default:return t}}function I$(e,t){const n=e.querySelector("#bulk-delete");n&&u(n,"click",async()=>{confirm(`Delete ${Bt.size} items?`)&&await ba({type:t.type,ids:Array.from(Bt),action:"delete"},t)}),e.querySelectorAll('[id^="bulk-status"]').forEach(a=>{u(a,"click",async()=>{const o=a.getAttribute("data-status");o&&await ba({type:t.type,ids:Array.from(Bt),action:"status",data:{status:o}},t)})});const i=e.querySelector("#bulk-assign");i&&u(i,"click",()=>{const a=prompt("Assign to:");a&&ba({type:t.type,ids:Array.from(Bt),action:"assign",data:{assignee:a}},t)})}async function ba(e,t){try{let n="",s={type:e.type,ids:e.ids};switch(e.action){case"delete":n="/api/bulk/delete";break;case"status":n="/api/bulk/status",s={...s,status:e.data?.status};break;case"assign":n="/api/bulk/assign",s={...s,assignee:e.data?.assignee};break}const i=await p.post(n,s);i.data.actionId&&tn.push({type:`bulk-${e.action}`,description:`${e.action} ${e.ids.length} items`,undo:async()=>{await p.post(`/api/undo/${i.data.actionId}`),t.onComplete?.()}}),h.success(`Updated ${i.data.affected||e.ids.length} items`),Or(),t.onComplete?.()}catch{h.error("Bulk operation failed")}}function sp(e,t){Bt.has(e)?Bt.delete(e):Bt.add(e),Vo(t)}function H$(e,t){Bt.add(e),Vo(t)}function R$(e,t){Bt.delete(e),Vo(t)}function Or(){Bt.clear(),document.querySelectorAll(".bulk-checkbox:checked").forEach(e=>{e.checked=!1})}function B$(){return Array.from(Bt)}function ar(e){return Bt.has(e)}function Vo(e){const t=Bt.size;e.classList.toggle("hidden",t===0);const n=e.querySelector(".bulk-count");n&&(n.textContent=String(t))}function O$(e,t){const n=_("input",{type:"checkbox",className:"bulk-checkbox"});return n.setAttribute("data-id",e),n.checked=ar(e),u(n,"change",s=>{s.stopPropagation(),sp(e,t),n.checked=ar(e)}),n}function N$(e={}){const t=_("div",{className:"sync-status"});t.innerHTML=`
    <div class="sync-indicator" id="sync-indicator">
      <span class="sync-icon">⟳</span>
      <span class="sync-text">Checking...</span>
    </div>
    ${e.showDetails?`
      <div class="sync-details hidden" id="sync-details">
        <div class="sync-info"></div>
        <div class="dead-letters"></div>
      </div>
    `:""}
  `;const n=t.querySelector("#sync-indicator");return e.showDetails&&u(n,"click",()=>{const s=t.querySelector("#sync-details"),i=s.classList.contains("hidden");s.classList.toggle("hidden"),i&&ip(t)}),El(t),setInterval(()=>El(t),3e4),t}async function El(e){try{const t=await p.get("/api/sync/status");Ml(e,t.data)}catch{Ml(e,{connected:!1,lastSync:null,pendingCount:0,errorCount:0})}}function Ml(e,t){const n=e.querySelector(".sync-icon"),s=e.querySelector(".sync-text"),i=e.querySelector(".sync-indicator");t.connected?t.pendingCount>0?(n.textContent="⟳",s.textContent=`Syncing (${t.pendingCount})`,i.classList.remove("synced","error"),i.classList.add("syncing")):t.errorCount>0?(n.textContent="!",s.textContent=`${t.errorCount} errors`,i.classList.remove("synced","syncing"),i.classList.add("error")):(n.textContent="✓",s.textContent=t.lastSync?Ee(t.lastSync):"Synced",i.classList.remove("syncing","error"),i.classList.add("synced")):(n.textContent="⚠",s.textContent="Disconnected",i.classList.remove("synced","syncing"),i.classList.add("error"))}async function ip(e){const t=e.querySelector(".sync-info"),n=e.querySelector(".dead-letters");t.innerHTML='<div class="loading">Loading...</div>';try{const i=(await p.get("/api/sync/status")).data;t.innerHTML=`
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value ${i.connected?"success":"error"}">
            ${i.connected?"Connected":"Disconnected"}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Last Sync</span>
          <span class="info-value">${i.lastSync?Ee(i.lastSync):"Never"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Pending</span>
          <span class="info-value">${i.pendingCount}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Errors</span>
          <span class="info-value ${i.errorCount>0?"error":""}">${i.errorCount}</span>
        </div>
      </div>
    `;const o=(await p.get("/api/sync/dead-letters")).data.deadLetters||[];o.length>0?(n.innerHTML=`
        <h4>Failed Operations</h4>
        <div class="dead-letters-list">
          ${o.map(r=>`
            <div class="dead-letter" data-id="${r.id}">
              <div class="dl-header">
                <span class="dl-type">${r.type}</span>
                <span class="dl-time">${Ee(r.failedAt)}</span>
              </div>
              <div class="dl-error">${F$(r.error)}</div>
              <div class="dl-actions">
                <button class="btn btn-sm retry-btn" data-id="${r.id}">Retry</button>
                <span class="dl-retries">${r.retryCount} attempts</span>
              </div>
            </div>
          `).join("")}
        </div>
      `,n.querySelectorAll(".retry-btn").forEach(r=>{u(r,"click",async()=>{const c=r.getAttribute("data-id");if(c)try{await p.post(`/api/sync/retry/${c}`),h.success("Retry scheduled"),ip(e)}catch{h.error("Retry failed")}})})):n.innerHTML=""}catch{t.innerHTML='<div class="error">Failed to load details</div>'}}function U$(){const e=_("div",{className:"sync-indicator-mini"});return e.innerHTML='<span class="sync-dot"></span>',ql(e),setInterval(()=>ql(e),3e4),e}async function ql(e){try{const t=await p.get("/api/sync/status"),n=e.querySelector(".sync-dot");t.data.connected?t.data.errorCount>0?(n.className="sync-dot warning",e.title=`${t.data.errorCount} sync errors`):(n.className="sync-dot success",e.title="Synced"):(n.className="sync-dot error",e.title="Disconnected")}catch{const t=e.querySelector(".sync-dot");t.className="sync-dot error",e.title="Connection error"}}function F$(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}class V${dialog=null;input=null;list=null;items=[];selectedIndex=0;visibleItems=[];constructor(){this.createDialog(),this.registerShortcut(),this.registerDefaultCommands()}createDialog(){this.dialog=_("dialog",{className:"command-palette-dialog"});const t=_("div",{className:"cmd-header"}),n=_("div",{className:"cmd-search-icon",innerHTML:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'});this.input=_("input",{type:"text",className:"cmd-input",placeholder:"Type a command or search..."}),t.appendChild(n),t.appendChild(this.input),this.list=_("div",{className:"cmd-list"});const s=_("div",{className:"cmd-footer"});s.innerHTML=`
      <span><span class="cmd-shortcut">↑↓</span> to navigate</span>
      <span><span class="cmd-shortcut">↵</span> to select</span>
      <span><span class="cmd-shortcut">esc</span> to close</span>
    `,this.dialog.appendChild(t),this.dialog.appendChild(this.list),this.dialog.appendChild(s),document.body.appendChild(this.dialog),this.input.addEventListener("input",()=>this.filterItems()),this.input.addEventListener("keydown",i=>this.handleKeydown(i)),this.dialog.addEventListener("click",i=>{i.target===this.dialog&&this.close()}),this.dialog.addEventListener("close",()=>this.close())}registerShortcut(){Ut.register({key:"k",ctrl:!0,description:"Open Command Palette",handler:()=>{this.open()}}),window.addEventListener("keydown",t=>{(t.ctrlKey||t.metaKey)&&t.key==="k"&&(t.preventDefault(),this.open())})}registerDefaultCommands(){this.items=[{id:"nav-dashboard",title:"Go to Dashboard",section:"Navigation",icon:"🏠",action:()=>this.navigate("dashboard"),keywords:["home","main"]},{id:"nav-projects",title:"Go to Projects",section:"Navigation",icon:"📁",action:()=>this.navigate("projects"),keywords:["list","manage"]},{id:"nav-chat",title:"Go to Chat",section:"Navigation",icon:"💬",action:()=>this.navigate("chat"),keywords:["ai","copilot","assistant"]},{id:"nav-sot",title:"Go to Source of Truth",section:"Navigation",icon:"🧠",action:()=>this.navigate("sot"),keywords:["facts","risks","decisions"]},{id:"nav-settings",title:"Go to Settings",section:"Navigation",icon:"⚙️",action:()=>this.navigate("settings"),keywords:["config","preferences"]},{id:"act-new-project",title:"Create New Project",section:"Actions",icon:"➕",action:()=>{window.__godmodeProjectsOpen="create",this.navigate("projects")},keywords:["add","start"]},{id:"act-theme",title:"Toggle Theme",section:"Actions",icon:"🌓",action:()=>Ke.cycle(),keywords:["dark","light","mode"]},{id:"act-logout",title:"Sign Out",section:"Account",icon:"🚪",action:()=>document.getElementById("logout-btn")?.click(),keywords:["log out","exit"]}]}open(){this.dialog&&!this.dialog.open&&(this.dialog.showModal(),this.input?.focus(),this.input.value="",this.filterItems())}close(){this.dialog&&this.dialog.open&&this.dialog.close()}navigate(t){const n=document.querySelector(`.nav-item[data-tab="${t}"]`);n&&n.click(),this.close()}filterItems(){const t=this.input?.value.toLowerCase().trim()||"";t?this.visibleItems=this.items.filter(n=>n.title.toLowerCase().includes(t)||n.section.toLowerCase().includes(t)||n.keywords?.some(s=>s.includes(t))):this.visibleItems=this.items,this.renderList()}renderList(){if(!this.list)return;if(this.list.innerHTML="",this.selectedIndex=0,this.visibleItems.length===0){this.list.innerHTML='<div style="padding:1rem;text-align:center;color:var(--color-text-muted)">No commands found</div>';return}let t="";this.visibleItems.forEach((n,s)=>{if(n.section!==t){const c=_("div",{className:"cmd-section-title"},[n.section]);this.list.appendChild(c),t=n.section}const i=_("div",{className:`cmd-item ${s===0?"selected":""}`,"data-index":s}),a=_("div",{className:"cmd-item-icon"},[n.icon||"🔹"]),o=_("div",{className:"cmd-item-content"}),r=_("div",{className:"cmd-item-title"},[n.title]);o.appendChild(r),n.description&&o.appendChild(_("div",{className:"cmd-item-desc"},[n.description])),i.appendChild(a),i.appendChild(o),i.addEventListener("click",()=>{n.action(),this.close()}),i.addEventListener("mouseenter",()=>{this.selectedIndex=s,this.updateSelection()}),this.list.appendChild(i)})}updateSelection(){if(!this.list)return;this.list.querySelectorAll(".cmd-item").forEach((n,s)=>{s===this.selectedIndex?(n.classList.add("selected"),n.scrollIntoView({block:"nearest"})):n.classList.remove("selected")})}handleKeydown(t){if(t.key==="ArrowDown")t.preventDefault(),this.selectedIndex=Math.min(this.selectedIndex+1,this.visibleItems.length-1),this.updateSelection();else if(t.key==="ArrowUp")t.preventDefault(),this.selectedIndex=Math.max(this.selectedIndex-1,0),this.updateSelection();else if(t.key==="Enter"){t.preventDefault();const n=this.visibleItems[this.selectedIndex];n&&(n.action(),this.close())}else t.key==="Escape"&&this.close()}}let ya=null;function op(){return ya||(ya=new V$),ya}const fe={title:"Companies",newCompany:"+ New company",noCompanies:"No companies yet. Create one to use in projects.",edit:"Edit",analyze:"Analyze",reAnalyze:"Re-analyze",viewDetail:"View",detail:"Company detail",analyzedOn:"Analyzed",notAnalyzed:"Not analyzed",delete:"Delete",backToList:"Companies",name:"Name *",description:"Description",logoUrl:"Logo URL",website:"Website",linkedIn:"LinkedIn",save:"Save",create:"Create",cancel:"Cancel",invalidUrl:"Please enter a valid URL",updateFailed:"Update failed",createFailed:"Create failed",loadFailed:"Failed to load company",analysisComplete:"Analysis complete",analysisFailed:"Analysis failed",deleteConfirm:"Delete this company? Projects using it must be reassigned first.",companyDeleted:"Company deleted",templates:"Templates (A4 / PPT)",templateA4:"A4 document",templatePPT:"Presentation",generateWithAI:"Generate base with AI",loadCurrent:"Load current",saveTemplate:"Save template",templateLoaded:"Template loaded",templateSaved:"Template saved",templateGenerated:"Template generated",templateLoadFailed:"Failed to load template",templateSaveFailed:"Failed to save template",templateGenerateFailed:"Generation failed"};function se(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function wa(e){if(!e||!e.trim())return!0;try{const t=new URL(e.trim());return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}function Xi(e){return`
    <div class="companies-breadcrumbs">
      ${e.map((t,n)=>n===e.length-1?`<span class="companies-breadcrumb-active">${se(t.label)}</span>`:`
          <span class="breadcrumb-link companies-breadcrumb-link">${se(t.label)}</span>
          <span class="companies-breadcrumb-separator">/</span>
        `).join("")}
    </div>
  `}function Z$(e){e.innerHTML="";const t=_("div",{className:"companies-panel-content"});e.appendChild(t);function n(d){const m=t.querySelector("#companies-list");if(!m)return;const f=t.querySelector(".breadcrumbs-slot");f&&(f.innerHTML=Xi([{label:"Settings"},{label:"Companies"}]));const g=Array.isArray(d)?d:[];try{if(g.length===0){m.innerHTML=`<p class="companies-empty-state">${se(fe.noCompanies)}</p>`;return}const v=y=>y.brand_assets?.analyzed_at;m.innerHTML=g.map(y=>{const S=!!v(y),w=S?fe.reAnalyze:fe.analyze,k=S?`<span class="companies-analyzed-badge" title="${se(v(y)||"")}">${se(fe.analyzedOn)}</span>`:`<span class="companies-not-analyzed-badge">${se(fe.notAnalyzed)}</span>`;return`
      <div class="companies-row" data-id="${y.id}">
        <div class="companies-logo-wrapper">
          ${y.logo_url?`<img src="${se(y.logo_url)}" alt="" class="companies-logo">`:'<span class="companies-logo-placeholder">🏢</span>'}
          <div>
            <div class="companies-name-group">
                <strong class="companies-name">${se(y.name)}</strong>
                ${k}
            </div>
            ${y.brand_assets?.primary_color&&y.brand_assets?.secondary_color?`<div class="companies-colors"><div class="companies-color-pill" style="background: ${se(y.brand_assets.primary_color)};"></div><div class="companies-color-pill" style="background: ${se(y.brand_assets.secondary_color)};"></div></div>`:""}
            ${y.website_url?`<a href="${se(y.website_url)}" target="_blank" class="companies-website-link">${se(y.website_url.replace(/^https?:\/\//,""))}</a>`:""}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm btn-secondary companies-detail-btn" data-id="${y.id}" title="View analysis">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> 
            <span class="desktop-only">${se(fe.viewDetail)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-secondary companies-edit-btn" data-id="${y.id}" title="${se(fe.edit)}">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
             <span class="desktop-only">${se(fe.edit)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-secondary companies-templates-list-btn" data-id="${y.id}" title="${se(fe.templates)}">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
             <span class="desktop-only">${se(fe.templates)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-secondary companies-analyze-btn" data-id="${y.id}" title="Analyze with AI">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
             <span class="desktop-only">${se(w)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger companies-delete-btn" data-id="${y.id}">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    `}).join("")}catch{m.innerHTML=`<p class="text-error">${se(fe.loadFailed)}</p>`}}function s(){const d=t.querySelector("#companies-list");d&&(d.innerHTML='<div style="padding: 40px; text-align: center; color: var(--text-secondary);"><div class="spinner"></div> Loading companies...</div>'),Do().then(m=>n(Array.isArray(m)?m:[])).catch(()=>{const m=t.querySelector("#companies-list");m&&(m.innerHTML=`<p class="text-error">${se(fe.loadFailed)}</p>`)})}function i(){t.innerHTML=`
      <div class="breadcrumbs-slot"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h2 style="font-size: 1.5rem; margin: 0; font-weight: 600;">Companies</h2>
             <p style="margin: 4px 0 0 0; color: var(--text-secondary);">Manage company profiles and assets</p>
          </div>
          <button type="button" class="btn btn-primary" id="companies-new-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="margin-right: 6px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            ${se(fe.newCompany)}
          </button>
      </div>
      <div id="companies-list" style="max-width: 800px;">Loading...</div>
    `,l(),s()}function a(d){const m=!!d,f=m?`Edit ${d.name}`:"New Company",g=[{label:"Settings"},{label:"Companies",onClick:i},{label:m?"Edit":"New"}];t.innerHTML=`
      <div class="settings-breadcrumbs-container"></div>
      
      <div style="max-width: 600px;">
          <h2 style="font-size: 1.5rem; margin: 0 0 24px 0; font-weight: 600;">${se(f)}</h2>
          
          <form id="company-form" class="company-form">
            <div class="form-group">
              <label>${se(fe.name)}</label>
              <input type="text" name="name" required value="${d?se(d.name):""}" class="form-input">
            </div>
            
            <div class="form-group">
              <label>${se(fe.description)}</label>
              <textarea name="description" rows="3" class="form-textarea">${d?.description?se(d.description):""}</textarea>
            </div>
            
            <div class="form-group">
              <label>${se(fe.logoUrl)}</label>
              <input type="url" name="logo_url" value="${d?.logo_url?se(d.logo_url):""}" class="form-input" placeholder="https://...">
            </div>
            
            <div class="form-row">
                <div class="form-group">
                  <label>${se(fe.website)}</label>
                  <input type="url" name="website_url" value="${d?.website_url?se(d.website_url):""}" class="form-input" placeholder="https://...">
                </div>
                <div class="form-group">
                  <label>${se(fe.linkedIn)}</label>
                  <input type="url" name="linkedin_url" value="${d?.linkedin_url?se(d.linkedin_url):""}" class="form-input" placeholder="https://linkedin.com/...">
                </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" style="min-width: 100px;">${se(m?fe.save:fe.create)}</button>
              <button type="button" class="btn btn-secondary" id="company-form-cancel">${se(fe.cancel)}</button>
            </div>
            
            ${m&&d?`
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
              <h3 style="font-size: 1rem; margin-bottom: 12px;">Documents</h3>
              <button type="button" class="btn btn-outline-secondary" id="companies-templates-btn" style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                ${se(fe.templates)}
              </button>
            </div>
            `:""}
          </form>
      </div>
    `;const v=t.querySelector(".settings-breadcrumbs-container");v&&(v.innerHTML=Xi(g));const y=v?.querySelector(".breadcrumb-link");if(y&&u(y,"click",i),u(t.querySelector("#company-form"),"submit",async S=>{S.preventDefault();const w=t.querySelector("#company-form"),k=new FormData(w),x=k.get("logo_url")?.trim()||void 0,b=k.get("website_url")?.trim()||void 0,C=k.get("linkedin_url")?.trim()||void 0;if(x&&!wa(x)){h.error(fe.invalidUrl+" (Logo)");return}if(b&&!wa(b)){h.error(fe.invalidUrl+" (Website)");return}if(C&&!wa(C)){h.error(fe.invalidUrl+" (LinkedIn)");return}const T={name:k.get("name").trim(),description:k.get("description")?.trim()||void 0,logo_url:x,website_url:b,linkedin_url:C};try{m&&d?(await id(d.id,T),h.success("Company updated")):(await sd(T),h.success("Company created")),i()}catch{h.error(m?fe.updateFailed:fe.createFailed)}}),u(t.querySelector("#company-form-cancel"),"click",i),m&&d){const S=t.querySelector("#companies-templates-btn");S&&u(S,"click",()=>o(d))}}function o(d){let m="a4",f="code";const g=[{label:"Settings"},{label:"Companies",onClick:i},{label:"Edit "+d.name,onClick:()=>a(d)},{label:"Templates"}];t.innerHTML=`
      <div class="settings-breadcrumbs-container"></div>
      
      <div class="template-editor-layout">
          <h2 class="companies-title">${se(d.name)} – ${se(fe.templates)}</h2>
          <p class="companies-subtitle">Manage the document templates for this company.</p>

          <div class="template-toolbar">
              <div class="template-toolbar-group">
                <button type="button" class="btn btn-sm template-type-btn active" data-type="a4">${se(fe.templateA4)}</button>
                <button type="button" class="btn btn-sm template-type-btn" data-type="ppt">${se(fe.templatePPT)}</button>
              </div>
              <div class="template-toolbar-group">
                <button type="button" class="btn btn-sm btn-secondary" id="template-load-btn">${se(fe.loadCurrent)}</button>
                <button type="button" class="btn btn-sm btn-primary" id="template-generate-btn">${se(fe.generateWithAI)}</button>
                <button type="button" class="btn btn-sm btn-primary" id="template-save-btn">${se(fe.saveTemplate)}</button>
              </div>
          </div>
          
          <div class="template-workspace">
            <!-- Left Column: Editor & Controls -->
            <div class="template-sidebar">
                <!-- Tabs -->
                <div class="template-tabs">
                    <button type="button" class="template-tab-btn active" data-tab="code">Code</button>
                    <button type="button" class="template-tab-btn" data-tab="theme">Theme</button>
                </div>

                <!-- Code Tab -->
                <div id="editor-tab-code" class="flex-1 flex-col">
                    <textarea id="template-html-editor" class="template-code-area" placeholder="HTML template..."></textarea>
                </div>

                <!-- Theme Tab -->
                <div id="editor-tab-theme" class="template-theme-list hidden">
                    <p class="text-secondary mb-4 text-sm">Detected styles from <code>:root</code> variables. Change colors to update the template.</p>
                    <div id="theme-variables-list" class="flex flex-col gap-3"></div>
                </div>
            </div>

            <!-- Right Column: Preview -->
            <div class="template-preview-pane">
                <div class="template-preview-label">Preview</div>
                <div class="template-preview-container">
                    <iframe id="template-preview-frame" class="template-preview-frame" sandbox="allow-same-origin allow-scripts"></iframe>
                </div>
            </div>
          </div>
      </div>
      <style>
        /* Template Type Buttons */
        .template-type-btn {
            background: var(--bg-surface);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        }
        .template-type-btn:hover {
            background: var(--bg-hover);
        }
        .template-type-btn.active {
            background: var(--primary);
            color: #ffffff !important;
            border-color: var(--primary);
        }
      </style>
    `;const v=t.querySelector(".settings-breadcrumbs-container");if(v){v.innerHTML=Xi(g);const te=v.querySelectorAll(".breadcrumb-link");te[0]&&u(te[0],"click",i),te[1]&&u(te[1],"click",()=>a(d))}const y=t.querySelector("#template-html-editor"),S=t.querySelector("#template-load-btn"),w=t.querySelector("#template-generate-btn"),k=t.querySelector("#template-save-btn"),x=t.querySelector("#template-preview-frame"),b=t.querySelector("#theme-variables-list"),C=t.querySelector('.template-tab-btn[data-tab="code"]'),T=t.querySelector('.template-tab-btn[data-tab="theme"]'),A=t.querySelector("#editor-tab-code"),M=t.querySelector("#editor-tab-theme");function Q(te){if(!te)return"";let ue=te;ue=ue.replace(/\{\{COMPANY_NAME\}\}/g,se(d.name)),ue=ue.replace(/\{\{COMPANY_DESCRIPTION\}\}/g,se(d.description||"")),ue=ue.replace(/\{\{WEBSITE_URL\}\}/g,se(d.website_url||""));const Pe=d.brand_assets?.primary_color||"#000000",ze=d.brand_assets?.secondary_color||"#666666";ue=ue.replace(/\{\{PRIMARY_COLOR\}\}/g,Pe),ue=ue.replace(/\{\{SECONDARY_COLOR\}\}/g,ze),d.logo_url?ue=ue.replace(/\{\{LOGO_URL\}\}/gi,d.logo_url):ue=ue.replace(/\{\{LOGO_URL\}\}/gi,"https://placehold.co/200x80/EEE/31343C?text=LOGO");const st=`
            <h2>1. Ficha de Identidade</h2>
                <p><strong>Nome: </strong> ${se(d.name)}</p>
                    <p><strong>Setor: </strong> Consultoria Tecnológica</p>
                        <p><strong>Descrição: </strong> ${se(d.description||"Empresa líder em inovação...")}</p>

                            <h2>2. Visão Geral</h2>
                                <p>A ${se(d.name)} demonstra um forte posicionamento no mercado...</p>

                                    <h2>3. Análise SWOT</h2>
                                        <ul>
                                        <li><strong>Forças: </strong> Tecnologia proprietária, Equipa experiente</li>
                                            <li><strong>Fraquezas: </strong> Baixa presença internacional</li>
                                                </ul>
                                                    `;return ue=ue.replace(/\{\{REPORT_DATA\}\}/g,st),ue}function q(){const te=x.contentDocument;if(!te)return;const ue=y.value||"",Pe=Q(ue);te.open(),te.write(Pe),te.close()}let V;y.addEventListener("input",()=>{clearTimeout(V),V=setTimeout(()=>{q(),f==="theme"&&H()},300)});function I(te){f=te,te==="code"?(C.classList.add("active"),T.classList.remove("active"),A.style.display="flex",M.style.display="none"):(C.classList.remove("active"),T.classList.add("active"),A.style.display="none",M.style.display="flex",H())}u(C,"click",()=>I("code")),u(T,"click",()=>I("theme"));function H(){const te=y.value||"",ue=te.match(/<style[^>]*>([\s\S]*?)<\/style>/i),ze=(ue?ue[1]:te).match(/:root\s*\{([\s\S]*?)\}/i);if(!ze){b.innerHTML='<p style="color: var(--text-secondary);">No <code>:root</code> CSS variables found. Ensure your template has a <code>&lt;style&gt;:root { ... }&lt;/style&gt;</code> block.</p>';return}const we=ze[1].replace(/\/\*[\s\S]*?\*\//g,""),oe=/--([a-zA-Z0-9-]+):\s*([^;\}]+)/g;let Y;const le=[];for(;(Y=oe.exec(we))!==null;)le.push({name:Y[1],value:Y[2].trim()});b.innerHTML="",le.forEach(G=>{const ge=/^#[0-9A-Fa-f]{3,8}$|^rgb|^hsl/.test(G.value),ye=document.createElement("div");ye.style.cssText="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--bg-hover); border-radius: 6px;",ye.innerHTML=`
                                                <div style="font-weight: 500; font-size: 0.9em; color: var(--text-primary);">${se(G.name)}</div>
                                                    <div style="display: flex; align-items: center; gap: 8px;">
                                                        ${ge?`<input type="color" data-var="${G.name}" value="${G.value.startsWith("#")?G.value.substring(0,7):"#000000"}" style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px; cursor: pointer;">`:""}
        <input type="text" data-var="${G.name}" value="${se(G.value)}" style="width: 100px; padding: 4px 8px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-primary); background: var(--bg-surface);">
            </div>
                `,b.appendChild(ye);const _e=ye.querySelectorAll("input");_e.forEach(j=>{j.addEventListener("input",Z=>{const R=Z.target.value,D=_e.length>1?j.type==="color"?_e[1]:_e[0]:null;D&&(D.value=R),W(G.name,R)})})})}function W(te,ue){let Pe=y.value;const ze=new RegExp(`(--${te}: \\s *)([^;]+) (;)`);ze.test(Pe)&&(y.value=Pe.replace(ze,`$1${ue} $3`),q())}function ee(te){m=te,t.querySelectorAll(".template-type-btn").forEach(ue=>ue.classList.toggle("active",ue.getAttribute("data-type")===te)),te==="ppt"?(x.style.width="297mm",x.style.minHeight="210mm"):(x.style.width="210mm",x.style.minHeight="297mm"),xi(d.id,m).then(ue=>{y.value=ue,q(),f==="theme"&&H()}).catch(()=>{y.value="",q()})}t.querySelectorAll(".template-type-btn").forEach(te=>{u(te,"click",()=>ee(te.getAttribute("data-type")||"a4"))}),u(S,"click",async()=>{S.disabled=!0;try{const te=await xi(d.id,m);y.value=te,q(),f==="theme"&&H(),h.success(fe.templateLoaded)}catch{h.error(fe.templateLoadFailed)}finally{S.disabled=!1}}),u(w,"click",async()=>{w.disabled=!0,w.textContent="...";try{const{html:te}=await rd(d.id,m);y.value=te,q(),f==="theme"&&H(),h.success(fe.templateGenerated)}catch{h.error(fe.templateGenerateFailed)}finally{w.disabled=!1,w.textContent=fe.generateWithAI}}),u(k,"click",async()=>{k.disabled=!0;try{await ad(d.id,m,y.value),h.success(fe.templateSaved)}catch{h.error(fe.templateSaveFailed)}finally{k.disabled=!1}}),xi(d.id,m).then(te=>{y.value=te,q()}).catch(()=>{})}const r={ficha_identidade:"1. Ficha de Identidade",visao_geral:"2. Visão Geral e Posicionamento",produtos_servicos:"3. Produtos e Serviços",publico_alvo:"4. Público-Alvo e Clientes",equipa_lideranca:"5. Equipa e Liderança",presenca_digital:"6. Presença Digital e Marketing",analise_competitiva:"7. Análise Competitiva",indicadores_crescimento:"8. Indicadores de Crescimento",swot:"9. Análise SWOT",conclusoes:"10. Conclusões e Insights"};function c(d){const m=d.brand_assets,f=m?.analysis_report||{},g=Object.keys(f).length>0,v="ficha_identidade",y=Object.keys(r).filter(I=>I!==v),S=[v,...y];let w=v;const k=[{label:"Settings"},{label:"Companies",onClick:i},{label:d.name}],x=d.logo_url?`<img src="${se(d.logo_url)}" alt="" class="companies-detail-logo" style="width: 56px; height: 56px; object-fit: contain; background: white; padding: 4px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05);" onerror="this.style.display='none'">`:'<span class="companies-detail-logo-placeholder" style="width: 56px; height: 56px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--border-color) 100%); border-radius: 8px; font-size: 24px; color: var(--text-secondary);">🏢</span>',b=m?.primary_color||"—",C=m?.secondary_color||"—",T=b!=="—"||C!=="—"?`
            <div style="display: flex; gap: 6px; align-items: center; justify-content: center; padding: 4px 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;" title="Brand Colors">
                ${b!=="—"?`<span style="width: 14px; height: 14px; border-radius: 3px; background: ${se(b)}; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></span>`:""}
            ${C!=="—"?`<span style="width: 14px; height: 14px; border-radius: 3px; background: ${se(C)}; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></span>`:""}
        </div>
            `:"";t.innerHTML=`
            <div class="settings-breadcrumbs-container"></div>

            <div class="companies-list-container">

                <!-- Header -->
                <div class="detail-header-card">
                    ${x}
                    <div class="flex-1">
                        <div class="flex-item-center gap-sm mb-1">
                            <h3 class="companies-title" style="font-size: 1.4rem;">${se(d.name)}</h3>
                            ${T}
                        </div>
                        <div class="flex-item-center gap-md">
                            ${d.website_url?`<a href="${se(d.website_url)}" target="_blank" class="companies-website-link flex-item-center gap-xs"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> ${se(d.website_url.replace(/^https?:\/\//,""))}</a>`:""}
                            ${d.linkedin_url?`<a href="${se(d.linkedin_url)}" target="_blank" class="companies-website-link flex-item-center gap-xs" style="color: #0077b5;"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg> LinkedIn</a>`:""}
                        </div>
                    </div>

                    <div class="companies-actions">
                        <button type="button" class="btn btn-sm btn-primary" id="companies-detail-reanalyze-btn" data-id="${se(d.id)}">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right: 6px;"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            ${se(fe.reAnalyze)}
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" id="companies-detail-edit-btn" data-id="${se(d.id)}">
                            ${se(fe.edit)}
                        </button>
                    </div>
                </div>

                <!-- Content Grid -->
                <div class="companies-detail-grid">
                    
                    <!-- Sidebar -->
                    <div class="detail-sidebar">
                        <div class="detail-sidebar-header">Report Sections</div>
                        
                        ${g?S.map(I=>{const W=(r[I]||I).replace(/^\d+\.\s*/,"");return`
                            <div class="detail-sidebar-item ${I===w?"active":""}" data-key="${I}" role="button">
                                <span>${se(W)}</span>
                                ${I===w?'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>':""}
                            </div>
                            `}).join(""):'<div class="companies-empty-state-sm">No report data available.</div>'}
                    </div>

                    <!-- Main Content Area -->
                    <div class="detail-content-area custom-scrollbar" id="detail-content-main">
                        <!-- Content injected via JS -->
                    </div>
                </div>
            </div>
        `;const A=t.querySelector(".settings-breadcrumbs-container");if(A){A.innerHTML=Xi(k);const I=A.querySelectorAll(".breadcrumb-link");I[0]&&u(I[0],"click",i)}u(t.querySelector("#companies-detail-edit-btn"),"click",()=>a(d));const M=t.querySelector("#companies-detail-reanalyze-btn");u(M,"click",async()=>{M.disabled=!0,M.innerHTML='<span class="spinner-sm"></span> Analyzing...';try{const I=await uo(d.id);h.success(fe.analysisComplete),c(I)}catch{h.error(fe.analysisFailed),M.innerHTML=fe.reAnalyze,M.disabled=!1}});const Q=t.querySelector("#detail-content-main"),q=t.querySelectorAll(".detail-sidebar-item");function V(){if(!g){Q.innerHTML=`< div style = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); text-align: center;" >
            <div style="font-size: 32px; margin-bottom: 16px;" >📊</div>
                < p > No analysis data available yet.</p>
                    < p style = "font-size: 0.9rem;" > Click < strong > Re - analyze < /strong> to generate a comprehensive report.</p >
                        </div>`;return}const H=(r[w]||w).replace(/^\d+\.\s*/,""),W=f[w]||"No content for this section.",ee=se(W).replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");Q.innerHTML=`
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 24px 0; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">${se(H)}</h2>
                <div class="content-prose">
                    <p>${ee}</p>
                </div>
            `}q.forEach(I=>{u(I,"click",()=>{const H=I.getAttribute("data-key");H&&H!==w&&(w=H,q.forEach(W=>{if(W.getAttribute("data-key")===w){if(W.classList.add("active"),!W.querySelector("svg")){const ee=W.querySelector("span");ee&&ee.insertAdjacentHTML("afterend",'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>')}}else{W.classList.remove("active");const ee=W.querySelector("svg");ee&&ee.remove()}}),V())})}),V()}function l(){u(t,"click",async d=>{const m=d.target;if(m.closest("#companies-new-btn")){a();return}const f=m.closest(".companies-edit-btn"),g=m.closest(".companies-templates-list-btn"),v=m.closest(".companies-analyze-btn"),y=m.closest(".companies-detail-btn"),S=m.closest(".companies-delete-btn"),w=(f||g||v||y||S)?.getAttribute("data-id");if(w){if(y){try{const k=await ki(w);k&&c(k)}catch{h.error(fe.loadFailed)}return}if(g){try{const k=await ki(w);k&&o(k)}catch{h.error(fe.loadFailed)}return}if(f){try{const k=await ki(w);k&&a(k)}catch{h.error(fe.loadFailed)}return}if(v){const k=v;k.disabled=!0;const x=k.textContent;k.innerHTML='<span class="spinner-sm"></span>';try{await uo(w),h.success(fe.analysisComplete),s()}catch{h.error(fe.analysisFailed),k.innerHTML=x||"",k.disabled=!1}return}if(S){if(!confirm(fe.deleteConfirm))return;try{await od(w),h.success(fe.companyDeleted),s()}catch{}}}})}i()}const jl="settings-modal";function G$(e,t,n,s){const i=s?.pageMode??!1,a=i?"":`<button class="settings-close" id="close-settings-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>`;return`
    <style>
      .settings-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
      }
      
      .settings-modal-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        width: 100%;
        max-width: 520px;
      }

      .settings-modal-container.full-page {
        max-width: none;
        width: 100%;
        margin: 0;
        padding: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .settings-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.8);
        overflow: hidden;
      }
      
      [data-theme="dark"] .settings-card {
        background: linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%);
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1);
      }

      /* =========================================
       * DASHBOARD PAGE MODE STYLES
       * No Modal, Clean Dashboard Layout
       * ========================================= */
      .settings-page-card {
        box-shadow: none !important;
        background: transparent !important;
        backdrop-filter: none !important;
        border-radius: 0 !important;
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        grid-template-rows: auto auto;
        grid-template-areas:
          "tabs body"
          "tabs footer";
        gap: 0 24px;
        align-items: start;
        padding-top: 24px; /* Space from top (title in main layout) */
      }

      /* Hide Header in Page Mode (handled by main layout) */
      .settings-page-card .settings-header {
        display: none !important;
      }

      /* TABS CARD (Left Sidebar) */
      .settings-page-card .settings-tabs {
        grid-area: tabs;
        flex-direction: column;
        background: var(--bg-surface, #ffffff);
        border: 1px solid var(--border-color, rgba(0,0,0,0.1));
        border-radius: 12px;
        padding: 12px;
        margin: 0;
        gap: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        height: fit-content;
        position: sticky;
        top: 24px;
      }

      [data-theme="dark"] .settings-page-card .settings-tabs {
        background: var(--bg-surface, #1e293b);
        border-color: rgba(255,255,255,0.1);
      }

      .settings-page-card .settings-tab {
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 0.9rem;
        font-weight: 500;
        justify-content: flex-start;
        width: 100%;
        color: var(--text-secondary);
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }

      .settings-page-card .settings-tab:hover {
        background: var(--bg-secondary, #f1f5f9);
        color: var(--text-primary);
      }

      .settings-page-card .settings-tab.active {
        background: var(--bg-secondary, #f1f5f9);
        color: var(--accent, #e11d48);
        border-color: rgba(225, 29, 72, 0.1);
      }

      [data-theme="dark"] .settings-page-card .settings-tab.active {
        background: rgba(255,255,255,0.05);
        color: #fb7185;
        border-color: rgba(251, 113, 133, 0.2);
      }

      /* CONTENT CARD (Right Main Area) */
      .settings-page-card .settings-body {
        grid-area: body;
        background: var(--bg-surface, #ffffff);
        border: 1px solid var(--border-color, rgba(0,0,0,0.1));
        border-bottom: none; /* Merged with footer */
        border-radius: 12px 12px 0 0;
        padding: 32px;
        max-height: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      [data-theme="dark"] .settings-page-card .settings-body {
        background: var(--bg-surface, #1e293b);
        border-color: rgba(255,255,255,0.1);
      }

      /* FOOTER (Merged with Body) */
      .settings-page-card .settings-footer {
        grid-area: footer;
        margin-top: 0;
        background: var(--bg-surface, #ffffff);
        border: 1px solid var(--border-color, rgba(0,0,0,0.1));
        border-top: 1px solid var(--border-color, rgba(0,0,0,0.05));
        border-radius: 0 0 12px 12px;
        padding: 24px 32px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      [data-theme="dark"] .settings-page-card .settings-footer {
        background: var(--bg-surface, #1e293b);
        border-color: rgba(255,255,255,0.1);
        border-top-color: rgba(255,255,255,0.05);
      }
      
      /* Responsive */
      @media (max-width: 900px) {
        .settings-page-card {
           grid-template-columns: 1fr;
           grid-template-rows: auto auto auto;
           grid-template-areas:
             "tabs"
             "body"
             "footer";
           gap: 16px;
        }
        .settings-page-card .settings-tabs {
          flex-direction: row;
          padding: 8px;
          margin-bottom: 0;
          overflow-x: auto;
          position: static;
        }
        .settings-page-card .settings-tab {
          white-space: nowrap;
          width: auto;
        }
        .settings-page-card .settings-body {
          border-radius: 12px 12px 0 0;
          padding: 24px;
        }
        .settings-page-card .settings-footer {
          border-radius: 0 0 12px 12px;
          padding: 16px 24px;
        }
      }
      .settings-page-card .settings-header {
        grid-area: header;
        border-radius: 0;
        margin-bottom: 0;
        background: transparent;
        box-shadow: none;
        border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.05));
        padding: 0 0 16px 0; /* Remove horizontal padding to align with content */
        margin: 0 24px; /* Add margin to align with body content if needed, or remove if full bleed */
      }

      [data-theme="dark"] .settings-page-card .settings-header {
        border-bottom-color: rgba(255,255,255,0.05);
      }

      .settings-page-card .settings-header::before {
        display: none;
      }

      .settings-page-card .settings-header-content {
        flex-direction: row-reverse;
        justify-content: flex-end;
      }

      .settings-page-card .settings-icon {
        display: none; 
      }

      .settings-page-card .settings-title h2 {
        color: var(--text-primary);
        font-size: 1.5rem;
        text-shadow: none;
      }

      .settings-page-card .settings-title p {
        color: var(--text-secondary);
      }

      .settings-page-card .settings-back {
        position: relative;
        top: auto;
        right: auto;
        background: transparent !important;
        color: var(--text-secondary);
        padding: 8px 12px;
        border-radius: 8px;
        margin-right: 16px; 
        border: 1px solid var(--border-color, rgba(0,0,0,0.1));
      }
      
      .settings-page-card .settings-back:hover {
        background: var(--bg-secondary) !important;
        color: var(--text-primary);
      }

      .settings-page-card .settings-back svg {
        stroke: currentColor;
        width: 16px;
        height: 16px;
        margin-right: 6px;
      }

      .settings-page-card .settings-tabs {
        grid-area: tabs;
        flex-direction: column;
        background: transparent;
        border-bottom: none;
        border-right: 1px solid var(--border-color, rgba(0,0,0,0.05));
        padding: 0 24px 0 0;
        margin: 0;
        gap: 8px;
      }

      [data-theme="dark"] .settings-page-card .settings-tabs {
        border-right-color: rgba(255,255,255,0.05);
      }

      .settings-page-card .settings-tab {
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 0.95rem;
        justify-content: flex-start;
        width: 100%;
        color: var(--text-secondary);
        transition: all 0.2s ease;
      }

      .settings-page-card .settings-tab:hover {
        background: var(--bg-secondary);
        transform: translateX(4px);
      }

      .settings-page-card .settings-tab.active {
        background: var(--bg-surface, white);
        color: var(--accent, #e11d48);
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        border: 1px solid var(--border-color, rgba(0,0,0,0.05));
      }

      [data-theme="dark"] .settings-page-card .settings-tab.active {
        background: rgba(255,255,255,0.05);
        color: #fb7185;
        border-color: rgba(255,255,255,0.1);
      }

      .settings-page-card .settings-body {
        grid-area: body;
        border-left: 1px solid transparent; 
        padding: 0 0 0 32px;
        max-height: none;
      }

      .settings-page-card .settings-footer {
        grid-area: footer;
        margin-top: 32px;
        border-top: 1px solid var(--border-color, rgba(0,0,0,0.05));
        background: transparent;
        padding: 24px 0;
      }

      [data-theme="dark"] .settings-page-card .settings-footer {
        border-top-color: rgba(255,255,255,0.05);
        background: transparent;
      }
      
      @media (max-width: 900px) {
        .settings-page-card {
           grid-template-columns: 1fr;
           grid-template-rows: auto auto 1fr auto;
           grid-template-areas:
             "header"
             "tabs"
             "body"
             "footer";
        }
        .settings-page-card .settings-tabs {
          flex-direction: row;
          border-right: none;
          border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.05));
          padding: 0 0 16px 0;
          margin-bottom: 24px;
          overflow-x: auto;
          gap: 12px;
        }
        .settings-page-card .settings-tab {
          width: auto;
          white-space: nowrap;
          justify-content: center;
        }
        .settings-page-card .settings-body {
          padding: 0;
          border-left: none;
        }
      }
      
      .settings-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 24px 28px;
        position: relative;
        overflow: hidden;
      }
      
      .settings-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      
      .settings-header-content {
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
        z-index: 1;
      }
      
      .settings-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255,255,255,0.3);
      }
      
      .settings-icon svg {
        width: 28px;
        height: 28px;
        stroke: white;
        fill: none;
      }
      
      .settings-title {
        flex: 1;
      }
      
      .settings-title h2 {
        color: white;
        font-size: 1.4rem;
        font-weight: 600;
        margin: 0;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      
      .settings-title p {
        color: rgba(255,255,255,0.85);
        font-size: 0.85rem;
        margin: 4px 0 0;
      }
      
      .settings-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        z-index: 2;
      }
      
      .settings-close:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .settings-close svg {
        width: 18px;
        height: 18px;
        stroke: white;
      }
      
      .settings-tabs {
        display: flex;
        gap: 8px;
        padding: 16px 24px;
        background: var(--bg-secondary, #f8fafc);
        border-bottom: 1px solid var(--border-color, #e2e8f0);
      }
      
      [data-theme="dark"] .settings-tabs {
        background: rgba(30,41,59,0.5);
        border-bottom-color: rgba(255,255,255,0.1);
      }
      
      .settings-tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: var(--text-secondary, #64748b);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        border-radius: 10px;
        transition: all 0.2s;
      }
      
      .settings-tab:hover {
        background: var(--bg-hover, rgba(0,0,0,0.05));
        color: var(--text-primary, #1e293b);
      }
      
      .settings-tab.active {
        background: white;
        color: #e11d48;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }
      
      [data-theme="dark"] .settings-tab.active {
        background: rgba(225,29,72,0.15);
        color: #fb7185;
      }
      
      .settings-tab svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        fill: none;
      }
      
      .settings-body {
        padding: 24px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .settings-section {
        display: none;
      }
      
      .settings-section.active {
        display: block;
      }
      
      .settings-section h3 {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .settings-section h3 svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
      }
      
      .form-group {
        margin-bottom: 20px;
      }
      
      .form-group:last-child {
        margin-bottom: 0;
      }
      
      .form-group label {
        display: block;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        margin-bottom: 8px;
      }
      
      .form-group p.hint {
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
        margin: 6px 0 0;
      }
      
      .form-select {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 10px;
        background: var(--bg-primary, white);
        color: var(--text-primary, #1e293b);
        font-size: 0.9rem;
        transition: border-color 0.2s, box-shadow 0.2s;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2.5 4.5L6 8l3.5-3.5'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        cursor: pointer;
      }
      
      .form-select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
      }
      
      [data-theme="dark"] .form-select {
        background-color: rgba(30,41,59,0.8);
        border-color: rgba(255,255,255,0.1);
      }
      
      .toggle-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 10px;
        margin-bottom: 12px;
      }
      
      [data-theme="dark"] .toggle-group {
        background: rgba(30,41,59,0.5);
      }
      
      .toggle-group:last-child {
        margin-bottom: 0;
      }
      
      .toggle-info {
        flex: 1;
      }
      
      .toggle-info strong {
        display: block;
        font-size: 0.9rem;
        color: var(--text-primary, #1e293b);
        margin-bottom: 2px;
      }
      
      .toggle-info span {
        font-size: 0.8rem;
        color: var(--text-secondary, #64748b);
      }
      
      .toggle-switch {
        position: relative;
        width: 48px;
        height: 26px;
        flex-shrink: 0;
      }
      
      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .toggle-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: var(--bg-tertiary, #cbd5e1);
        border-radius: 26px;
        transition: 0.3s;
      }
      
      .toggle-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.3s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .toggle-switch input:checked + .toggle-slider {
        background: #e11d48;
      }
      
      .toggle-switch input:checked + .toggle-slider::before {
        transform: translateX(22px);
      }
      
      .settings-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 24px;
        background: var(--bg-secondary, #f8fafc);
        border-top: 1px solid var(--border-color, #e2e8f0);
      }
      
      [data-theme="dark"] .settings-footer {
        background: rgba(30,41,59,0.5);
        border-top-color: rgba(255,255,255,0.1);
      }
      
      .btn-cancel {
        padding: 10px 20px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 10px;
        background: var(--bg-primary, white);
        color: var(--text-primary, #1e293b);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .btn-cancel:hover {
        background: var(--bg-hover, #f1f5f9);
      }
      
      .btn-save {
        padding: 10px 24px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .btn-save:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }
      
      .btn-save svg {
        width: 18px;
        height: 18px;
        stroke: white;
      }
      
      .admin-notice {
        background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.1) 100%);
        border: 1px solid rgba(59,130,246,0.3);
        border-radius: 10px;
        padding: 14px 16px;
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .admin-notice svg {
        width: 20px;
        height: 20px;
        stroke: #3b82f6;
        flex-shrink: 0;
      }
      
      .admin-notice p {
        font-size: 0.85rem;
        color: var(--text-secondary, #64748b);
        margin: 0;
      }
      
      .admin-notice strong {
        color: #3b82f6;
      }
      .settings-back {
        position: static;
        display: inline-flex;
        align-items: center;
        padding: 8px 14px;
        font-size: 0.9rem;
        font-weight: 500;
        color: rgba(255,255,255,0.95);
      }
      .settings-back:hover {
        background: rgba(255,255,255,0.15);
      }
      .settings-page-card .settings-body {
        max-height: none;
      }
    </style>
    
    <div class="settings-modal-container ${i?"full-page":""}">
    <div class="settings-card ${i?"settings-page-card":""}">
      <!-- Header -->
      <div class="settings-header">
        <div class="settings-header-content">
          ${i?a:""}
          <div class="settings-title">
            <h2>Settings</h2>
            <p>Your personal preferences</p>
          </div>
           ${i?"":`<div class="settings-icon">
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </div>`}
        </div>
        ${i?"":a}
      </div>
      
      <!-- Tabs -->
      <div class="settings-tabs">
        <button class="settings-tab ${n==="general"?"active":""}" data-tab="general">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          General
        </button>
        <button class="settings-tab ${n==="data"?"active":""}" data-tab="data">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Data & Privacy
        </button>
        <button class="settings-tab ${n==="companies"?"active":""}" data-tab="companies">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <path d="M3 21h18M5 21V7l8-4 8 4v14M8 21v-9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v9"/>
          </svg>
          Companies
        </button>
      </div>
      
      <!-- Body -->
      <div class="settings-body">
        <!-- General Section -->
        <div class="settings-section ${n==="general"?"active":""}" id="section-general">
          <h3>
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
            </svg>
            Appearance
          </h3>
          
          <div class="form-group">
            <label>Theme</label>
            <select class="form-select" id="setting-theme">
              <option value="system" ${t==="system"?"selected":""}>System (Auto)</option>
              <option value="light" ${t==="light"?"selected":""}>Light</option>
              <option value="dark" ${t==="dark"?"selected":""}>Dark</option>
            </select>
            <p class="hint">Choose your preferred color scheme</p>
          </div>
          
          <div class="form-group">
            <label>Language</label>
            <select class="form-select" id="setting-language">
              <option value="en" ${e.config.language==="en"?"selected":""}>English</option>
              <option value="pt" ${e.config.language==="pt"?"selected":""}>Portugues</option>
              <option value="es" ${e.config.language==="es"?"selected":""}>Espanol</option>
            </select>
            <p class="hint">Interface language preference</p>
          </div>
          
          <h3 style="margin-top: 20px;">
            <svg viewBox="0 0 24 24" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            Companies
          </h3>
          <p class="hint" style="margin-bottom: 10px;">Manage company profiles for branding and document templates.</p>
          <button type="button" class="btn-save" id="settings-manage-companies-btn" style="margin-top: 0;">
            <svg viewBox="0 0 24 24" stroke-width="2" style="width: 18px; height: 18px;"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            Manage companies
          </button>
          
          ${e.currentUser?.role==="superadmin"?`
            <div class="admin-notice">
              <svg viewBox="0 0 24 24" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <p>For <strong>LLM configuration</strong>, <strong>Graph</strong>, and other platform settings, use the <strong>Admin</strong> section in the sidebar menu.</p>
            </div>
          `:""}
        </div>
        
        <!-- Data & Privacy Section -->
        <div class="settings-section ${n==="data"?"active":""}" id="section-data">
          <h3>
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Privacy Settings
          </h3>
          
          <div class="toggle-group">
            <div class="toggle-info">
              <strong>Analytics</strong>
              <span>Help improve GodMode with anonymous usage data</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-analytics" ${e.config.analyticsEnabled!==!1?"checked":""}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="toggle-group">
            <div class="toggle-info">
              <strong>Error Reporting</strong>
              <span>Automatically report errors to help fix bugs</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-error-reporting" ${e.config.errorReportingEnabled!==!1?"checked":""}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="toggle-group">
            <div class="toggle-info">
              <strong>AI Data Improvement</strong>
              <span>Allow anonymized data to improve AI responses</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-ai-improvement" ${e.config.aiImprovementEnabled===!0?"checked":""}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Companies Section -->
        <div class="settings-section ${n==="companies"?"active":""}" id="section-companies">
          <!-- CompaniesPanel content will be mounted here -->
        </div>
      </div>
      
      <!-- Footer -->
      <div class="settings-footer">
        <button class="btn-cancel" id="cancel-settings-btn">Cancel</button>
        <button class="btn-save" id="save-settings-btn">
          <svg viewBox="0 0 24 24" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Save Settings
        </button>
      </div>
    </div>
    </div>
  `}function W$(e={}){const t=document.querySelector(`[data-modal-id="${jl}"]`);t&&t.remove();const n=z.getState(),s=Ke.getMode(),i=e.initialTab||"general",a=_("div",{className:"settings-modal-overlay"});a.setAttribute("data-modal-id",jl);const o=_("div",{className:"settings-modal-container"});o.innerHTML=G$(n,s,i,{pageMode:!1}),a.appendChild(o),document.body.appendChild(a);const r=()=>a.remove();Q$(a,{...e,onClose:r,onSaveSuccess:r})}function Q$(e,t){const{onClose:n,onSaveSuccess:s,onSave:i}=t,a=e.querySelector("#section-companies");a&&Z$(a);const o=e.querySelector("#close-settings-btn"),r=e.querySelector("#cancel-settings-btn"),c=e.classList.contains("settings-modal-overlay"),l=()=>{n?n():c&&e.remove()};o&&u(o,"click",l),r&&u(r,"click",l),c&&u(e,"click",v=>{v.target===e&&l()});const d=e.querySelector("#settings-manage-companies-btn");d&&u(d,"click",()=>{const v=e.querySelector('.settings-tab[data-tab="companies"]');v&&v.click()});const m=e.querySelectorAll(".settings-tab");m.forEach(v=>{u(v,"click",()=>{const y=v.getAttribute("data-tab");m.forEach(w=>w.classList.remove("active")),v.classList.add("active"),e.querySelectorAll(".settings-section").forEach(w=>{w.classList.remove("active")});const S=e.querySelector(`#section-${y}`);S&&S.classList.add("active")})});const f=e.querySelector("#setting-theme");f&&u(f,"change",()=>{Ke.set(f.value)});const g=e.querySelector("#save-settings-btn");g&&u(g,"click",()=>{const v={theme:e.querySelector("#setting-theme")?.value,language:e.querySelector("#setting-language")?.value,analyticsEnabled:e.querySelector("#setting-analytics")?.checked,errorReportingEnabled:e.querySelector("#setting-error-reporting")?.checked,aiImprovementEnabled:e.querySelector("#setting-ai-improvement")?.checked};z.setConfig({...z.getState().config,...v}),t.onSave?.(v),h.success("Settings saved"),t.onSaveSuccess?.()})}const Fn="processing-modal";let Gt=[],Nr;function K$(e={}){const{title:t="Processing",steps:n=[],onCancel:s,allowCancel:i=!0}=e;Gt=n,Nr=s;const a=document.querySelector(`[data-modal-id="${Fn}"]`);a&&a.remove();const o=_("div",{className:"processing-content"});Zo(o);const r=i?Y$():null,c=Me({id:Fn,title:t,content:o,size:"md",closable:!1,footer:r});document.body.appendChild(c),qe(Fn)}function Zo(e){e.innerHTML=`
    <div class="processing-steps">
      ${Gt.map(t=>J$(t)).join("")}
    </div>
    <div class="processing-overall">
      <div class="progress-bar">
        <div class="progress-fill" style="--progress: ${Dl()}"></div>
      </div>
      <div class="progress-text">${Dl()}% complete</div>
    </div>
  `}function J$(e){const t={pending:"⏳",running:"🔄",completed:"✅",error:"❌"}[e.status];return`
    <div class="processing-step ${e.status}" data-step-id="${e.id}">
      <span class="step-icon">${t}</span>
      <div class="step-content">
        <div class="step-label">${e.label}</div>
        ${e.message?`<div class="step-message">${e.message}</div>`:""}
        ${e.status==="running"&&e.progress!==void 0?`
          <div class="step-progress">
            <div class="progress-bar small">
              <div class="progress-fill" style="--progress: ${e.progress}"></div>
            </div>
          </div>
        `:""}
      </div>
    </div>
  `}function Dl(){if(Gt.length===0)return 0;const e=Gt.filter(s=>s.status==="completed").length,t=Gt.find(s=>s.status==="running"),n=t?.progress||0;return Math.round((e+(t?n/100:0))/Gt.length*100)}function Y$(){const e=_("div",{className:"modal-footer"}),t=_("button",{className:"btn btn-secondary",textContent:"Cancel"});return u(t,"click",()=>{Nr?.(),ap()}),e.appendChild(t),e}function X$(e,t){const n=Gt.findIndex(i=>i.id===e);if(n===-1)return;Gt[n]={...Gt[n],...t};const s=document.querySelector(`[data-modal-id="${Fn}"]`);if(s){const i=s.querySelector(".processing-content");i&&Zo(i)}}function eS(e){Gt.push(e);const t=document.querySelector(`[data-modal-id="${Fn}"]`);if(t){const n=t.querySelector(".processing-content");n&&Zo(n)}}function tS(e){Gt=e;const t=document.querySelector(`[data-modal-id="${Fn}"]`);if(t){const n=t.querySelector(".processing-content");n&&Zo(n)}}function ap(){U(Fn),Gt=[],Nr=void 0}function nS(){return document.querySelector(`[data-modal-id="${Fn}"]`)?.classList.contains("open")||!1}const Dt="auth-modal";let yn="login",Gn={},qn="",sn=0,_n=null;function Ur(e={}){yn=e.initialMode||"login",Gn=e;const t=document.querySelector(`[data-modal-id="${Dt}"]`);t&&t.remove();const n=_("div",{className:"auth-content"});Yn(n);const s=Me({id:Dt,title:Jn(),content:n,size:"sm",closable:!e.required,onClose:e.onClose,footer:null});document.body.appendChild(s),qe(Dt),setTimeout(()=>{const i=n.querySelector("input");i&&i.focus()},100)}function Jn(){switch(yn){case"login":return"Sign In";case"register":return"Create Account";case"forgot":return"Reset Password";case"reset":return"Set New Password";case"otp-request":return"Sign In with Code";case"otp-verify":return"Enter Code";case"email-confirm":return"Confirm Email"}}function Yn(e){switch(_n&&(clearInterval(_n),_n=null),yn){case"login":sS(e);break;case"register":iS(e);break;case"forgot":oS(e);break;case"reset":aS(e);break;case"otp-request":rS(e);break;case"otp-verify":cS(e);break;case"email-confirm":lS(e);break}}function sS(e){e.innerHTML=`
    <form id="login-form" class="auth-form">
      <div class="form-group">
        <label for="login-email">Email</label>
        <input type="email" id="login-email" required autocomplete="email" placeholder="your@email.com">
      </div>
      <div class="form-group">
        <label for="login-password">Password</label>
        <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••••••">
      </div>
      <div class="form-error hidden" id="login-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Sign In</span>
          <span class="btn-loading hidden">Signing in...</span>
        </button>
      </div>
      <div class="auth-divider">
        <span>or</span>
      </div>
      <div class="form-group">
        <button type="button" class="btn btn-secondary btn-block" data-action="otp-request">
          Sign in with email code
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="forgot">Forgot password?</button>
        <span class="separator">|</span>
        <button type="button" class="btn-link" data-action="register">Create account</button>
      </div>
    </form>
  `;const t=e.querySelector("#login-form");u(t,"submit",async n=>{n.preventDefault(),await gS(t)}),Zs(e)}function iS(e){e.innerHTML=`
    <form id="register-form" class="auth-form">
      <div class="form-group">
        <label for="register-email">Email <span class="required">*</span></label>
        <input type="email" id="register-email" required autocomplete="email" placeholder="your@email.com">
      </div>
      <div class="form-group">
        <label for="register-username">Username</label>
        <input type="text" id="register-username" autocomplete="username" placeholder="username (optional)" 
               pattern="^[a-zA-Z0-9_]+$" minlength="3">
        <small class="form-hint">Letters, numbers, and underscores only. Min 3 characters.</small>
      </div>
      <div class="form-group">
        <label for="register-display-name">Display Name</label>
        <input type="text" id="register-display-name" autocomplete="name" placeholder="Your Name (optional)">
      </div>
      <div class="form-group">
        <label for="register-password">Password <span class="required">*</span></label>
        <input type="password" id="register-password" required autocomplete="new-password" 
               minlength="12" placeholder="Min. 12 characters">
        <div class="password-strength" id="password-strength"></div>
      </div>
      <div class="form-group">
        <label for="register-confirm">Confirm Password <span class="required">*</span></label>
        <input type="password" id="register-confirm" required autocomplete="new-password" placeholder="••••••••••••">
      </div>
      <div class="form-error hidden" id="register-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Create Account</span>
          <span class="btn-loading hidden">Creating account...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Already have an account? Sign in</button>
      </div>
    </form>
  `;const t=e.querySelector("#register-form"),n=t.querySelector("#register-password");u(n,"input",()=>{lp(n.value)}),u(t,"submit",async s=>{s.preventDefault(),await fS(t)}),Zs(e)}function oS(e){e.innerHTML=`
    <form id="forgot-form" class="auth-form">
      <p class="form-description">
        Enter your email address and we'll send you a link to reset your password.
      </p>
      <div class="form-group">
        <label for="forgot-email">Email</label>
        <input type="email" id="forgot-email" required autocomplete="email" placeholder="your@email.com">
      </div>
      <div class="form-error hidden" id="forgot-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Send Reset Link</span>
          <span class="btn-loading hidden">Sending...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Back to sign in</button>
      </div>
    </form>
  `;const t=e.querySelector("#forgot-form");u(t,"submit",async n=>{n.preventDefault(),await hS(t)}),Zs(e)}function aS(e){e.innerHTML=`
    <form id="reset-form" class="auth-form">
      <p class="form-description">
        Enter your new password below.
      </p>
      <div class="form-group">
        <label for="reset-password">New Password</label>
        <input type="password" id="reset-password" required autocomplete="new-password" 
               minlength="12" placeholder="Min. 12 characters">
        <div class="password-strength" id="reset-password-strength"></div>
      </div>
      <div class="form-group">
        <label for="reset-confirm">Confirm Password</label>
        <input type="password" id="reset-confirm" required autocomplete="new-password" placeholder="••••••••••••">
      </div>
      <div class="form-error hidden" id="reset-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Reset Password</span>
          <span class="btn-loading hidden">Resetting...</span>
        </button>
      </div>
    </form>
  `;const t=e.querySelector("#reset-form"),n=t.querySelector("#reset-password");u(n,"input",()=>{lp(n.value,"reset-password-strength")}),u(t,"submit",async s=>{s.preventDefault(),await vS(t)})}function rS(e){e.innerHTML=`
    <form id="otp-request-form" class="auth-form">
      <p class="form-description">
        Enter your email address and we'll send you a one-time code to sign in.
      </p>
      <div class="form-group">
        <label for="otp-email">Email</label>
        <input type="email" id="otp-email" required autocomplete="email" placeholder="your@email.com" value="${qn}">
      </div>
      <div class="form-error hidden" id="otp-request-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Send Code</span>
          <span class="btn-loading hidden">Sending...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Sign in with password</button>
        <span class="separator">|</span>
        <button type="button" class="btn-link" data-action="register">Create account</button>
      </div>
    </form>
  `;const t=e.querySelector("#otp-request-form");u(t,"submit",async n=>{n.preventDefault(),await dS(t,e)}),Zs(e)}function cS(e){const t=qn?qn.replace(/(.{2})(.*)(@.*)/,"$1***$3"):"your email";e.innerHTML=`
    <form id="otp-verify-form" class="auth-form">
      <p class="form-description">
        Enter the 6-digit code sent to <strong>${t}</strong>
      </p>
      <div class="form-group otp-input-group">
        <div class="otp-inputs">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" autocomplete="one-time-code" data-index="0">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="1">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="2">
          <span class="otp-separator">-</span>
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="3">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="4">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="5">
        </div>
        <input type="hidden" id="otp-code" name="code">
      </div>
      <div class="form-error hidden" id="otp-verify-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block" id="otp-verify-btn" disabled>
          <span class="btn-text">Verify Code</span>
          <span class="btn-loading hidden">Verifying...</span>
        </button>
      </div>
      <div class="otp-resend">
        <button type="button" class="btn-link" id="resend-code-btn" ${sn>0?"disabled":""}>
          ${sn>0?`Resend code in ${sn}s`:"Resend code"}
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="otp-request">Use different email</button>
        <span class="separator">|</span>
        <button type="button" class="btn-link" data-action="login">Sign in with password</button>
      </div>
    </form>
  `;const n=e.querySelector("#otp-verify-form"),s=e.querySelectorAll(".otp-digit"),i=e.querySelector("#otp-code"),a=e.querySelector("#otp-verify-btn"),o=e.querySelector("#resend-code-btn");rp(s,i,a),sn>0&&cp(o),u(o,"click",async()=>{await pS(e)}),u(n,"submit",async r=>{r.preventDefault(),await uS(n)}),Zs(e),setTimeout(()=>s[0]?.focus(),100)}function lS(e){const t=Gn.email||qn||"";e.innerHTML=`
    <form id="email-confirm-form" class="auth-form">
      <div class="confirm-icon">✉️</div>
      <p class="form-description">
        Enter the confirmation code sent to <strong>${t||"your email"}</strong>
      </p>
      <div class="form-group otp-input-group">
        <div class="otp-inputs">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="0">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="1">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="2">
          <span class="otp-separator">-</span>
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="3">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="4">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="5">
        </div>
        <input type="hidden" id="confirm-code" name="code">
      </div>
      <div class="form-error hidden" id="email-confirm-error"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block" id="confirm-btn" disabled>
          <span class="btn-text">Confirm Email</span>
          <span class="btn-loading hidden">Confirming...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Back to sign in</button>
      </div>
    </form>
  `;const n=e.querySelector("#email-confirm-form"),s=e.querySelectorAll(".otp-digit"),i=e.querySelector("#confirm-code"),a=e.querySelector("#confirm-btn");rp(s,i,a),u(n,"submit",async o=>{o.preventDefault(),await mS(n,e,t)}),Zs(e),setTimeout(()=>s[0]?.focus(),100)}function rp(e,t,n){const s=()=>{const i=Array.from(e).map(a=>a.value).join("");t.value=i,n.disabled=i.length!==6||!/^\d{6}$/.test(i)};e.forEach((i,a)=>{u(i,"input",o=>{const r=o.target.value;if(!/^\d*$/.test(r)){i.value=r.replace(/\D/g,"");return}if(r.length>1){const c=r.split("");e.forEach((d,m)=>{d.value=c[m]||""});const l=Math.min(c.length,5);e[l]?.focus(),s();return}r&&a<e.length-1&&e[a+1].focus(),s()}),u(i,"keydown",o=>{const r=o.key;r==="Backspace"&&!i.value&&a>0&&(e[a-1].focus(),e[a-1].value="",s()),r==="ArrowLeft"&&a>0&&e[a-1].focus(),r==="ArrowRight"&&a<e.length-1&&e[a+1].focus()}),u(i,"paste",o=>{o.preventDefault();const c=(o.clipboardData?.getData("text")||"").replace(/\D/g,"").slice(0,6);if(c){c.split("").forEach((d,m)=>{e[m]&&(e[m].value=d)});const l=Math.min(c.length,5);e[l]?.focus(),s()}}),u(i,"focus",()=>i.select())})}function cp(e){_n&&clearInterval(_n);const t=()=>{sn>0?(e.disabled=!0,e.textContent=`Resend code in ${sn}s`,sn--):(e.disabled=!1,e.textContent="Resend code",_n&&(clearInterval(_n),_n=null))};t(),_n=setInterval(t,1e3)}async function dS(e,t){const n=e.querySelector("#otp-email").value.trim(),s=e.querySelector("#otp-request-error");zt(e,!0),vs(s);try{const i=await Pt.requestLoginCode(n);qn=n,sn=60,h.success(i.message||"Code sent! Check your email."),yn="otp-verify";const a=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);a&&(a.textContent=Jn()),Yn(t)}catch(i){const o=i.message||"Failed to send code";Ot(s,o)}finally{zt(e,!1)}}async function uS(e,t){const n=e.querySelector("#otp-code").value,s=e.querySelector("#otp-verify-error");if(!n||n.length!==6){Ot(s,"Please enter the 6-digit code");return}zt(e,!0),vs(s);try{const i=await Pt.verifyLoginCode(qn,n);h.success("Signed in successfully"),Gn.onSuccess?.(i),U(Dt),window.dispatchEvent(new CustomEvent("godmode:auth-success"))}catch(i){const a=i;let o=a.message||"Verification failed";a.attemptsRemaining!==void 0&&a.attemptsRemaining>0&&(o+=` (${a.attemptsRemaining} attempts remaining)`),a.needsEmailVerification&&(o="Please confirm your email address first."),a.fallbackToPassword&&(o="Please sign in with your password instead."),Ot(s,o);const r=e.querySelectorAll(".otp-digit");r.forEach(c=>c.value=""),r[0]?.focus()}finally{zt(e,!1)}}async function pS(e){if(sn>0)return;const t=e.querySelector("#resend-code-btn");t.disabled=!0,t.textContent="Sending...";try{await Pt.requestLoginCode(qn),h.success("New code sent!"),sn=60,cp(t)}catch(n){const s=n;h.error(s.message||"Failed to resend code"),t.disabled=!1,t.textContent="Resend code"}}async function mS(e,t,n){const s=e.querySelector("#confirm-code").value,i=e.querySelector("#email-confirm-error");if(!s||s.length!==6){Ot(i,"Please enter the 6-digit code");return}zt(e,!0),vs(i);try{await Pt.confirmEmail(n,s),h.success("Email confirmed! You can now sign in."),yn="login";const a=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);a&&(a.textContent=Jn()),Yn(t)}catch(a){Ot(i,a.message||"Confirmation failed");const r=e.querySelectorAll(".otp-digit");r.forEach(c=>c.value=""),r[0]?.focus()}finally{zt(e,!1)}}function Zs(e){e.querySelectorAll("[data-action]").forEach(n=>{u(n,"click",()=>{yn=n.getAttribute("data-action");const i=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);i&&(i.textContent=Jn()),Yn(e)})})}async function gS(e){const t=e.querySelector("#login-email").value.trim(),n=e.querySelector("#login-password").value,s=e.querySelector("#login-error");zt(e,!0),vs(s);try{const i=await Pt.login({email:t,password:n});h.success("Signed in successfully"),Gn.onSuccess?.(i),U(Dt),window.dispatchEvent(new CustomEvent("godmode:auth-success"))}catch(i){const a=i,o=a.response?.data;if(o?.needsEmailVerification){qn=o.email||t,Gn.email=qn,sn=60,h.info("Please verify your email to continue."),yn="email-confirm";const c=e.parentElement,l=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);l&&(l.textContent=Jn()),Yn(c);return}const r=a.message||"Login failed";Ot(s,r)}finally{zt(e,!1)}}async function fS(e){const t=e.querySelector("#register-email").value.trim(),n=e.querySelector("#register-username").value.trim(),s=e.querySelector("#register-display-name").value.trim(),i=e.querySelector("#register-password").value,a=e.querySelector("#register-confirm").value,o=e.querySelector("#register-error");if(i!==a){Ot(o,"Passwords do not match");return}if(i.length<12){Ot(o,"Password must be at least 12 characters");return}zt(e,!0),vs(o);try{const r=await Pt.register({email:t,password:i,username:n||void 0,display_name:s||void 0});if(r.needsEmailVerification){h.success("Account created! Please check your email to verify."),yn="login";const c=e.parentElement,l=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);l&&(l.textContent=Jn()),Yn(c)}else h.success("Account created successfully"),Gn.onSuccess?.(r.user),U(Dt),window.dispatchEvent(new CustomEvent("godmode:auth-success"))}catch(r){const c=r instanceof Error?r.message:"Registration failed";Ot(o,c)}finally{zt(e,!1)}}async function hS(e){const t=e.querySelector("#forgot-email").value.trim(),n=e.querySelector("#forgot-error");zt(e,!0),vs(n);try{await Pt.forgotPassword(t),h.success("If an account exists with this email, you will receive a reset link."),yn="login";const s=e.parentElement,i=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);i&&(i.textContent=Jn()),Yn(s)}catch{h.success("If an account exists with this email, you will receive a reset link.")}finally{zt(e,!1)}}async function vS(e){const t=e.querySelector("#reset-password").value,n=e.querySelector("#reset-confirm").value,s=e.querySelector("#reset-error");if(t!==n){Ot(s,"Passwords do not match");return}if(t.length<12){Ot(s,"Password must be at least 12 characters");return}if(!Gn.resetToken){Ot(s,"Invalid reset token. Please request a new reset link.");return}zt(e,!0),vs(s);try{await Pt.resetPassword(t,Gn.resetToken),h.success("Password reset successfully. You can now sign in."),yn="login";const i=e.parentElement,a=document.querySelector(`[data-modal-id="${Dt}"] .modal-header h3`);a&&(a.textContent=Jn()),Yn(i)}catch(i){const a=i instanceof Error?i.message:"Password reset failed";Ot(s,a)}finally{zt(e,!1)}}function zt(e,t){const n=e.querySelector('button[type="submit"]'),s=e.querySelectorAll("input"),i=n.querySelector(".btn-text"),a=n.querySelector(".btn-loading");n.disabled=t,s.forEach(o=>o.disabled=t),i&&a&&(i.classList.toggle("hidden",!!t),a.classList.toggle("hidden",!t))}function Ot(e,t){e.textContent=t,e.classList.remove("hidden")}function vs(e){e.classList.add("hidden"),e.textContent=""}function lp(e,t="password-strength"){const n=document.getElementById(t);if(!n)return;const s=bS(e);n.className=`password-strength strength-${s.level}`,n.innerHTML=`
    <div class="strength-bar">
      <div class="strength-fill" style="--strength-width: ${s.score}%"></div>
    </div>
    <span class="strength-label">${s.label}</span>
  `}function bS(e){let t=0;return e.length>=12&&(t+=25),e.length>=16&&(t+=15),/[a-z]/.test(e)&&(t+=15),/[A-Z]/.test(e)&&(t+=15),/[0-9]/.test(e)&&(t+=15),/[^a-zA-Z0-9]/.test(e)&&(t+=15),t<30?{level:"weak",score:t,label:"Weak"}:t<60?{level:"fair",score:t,label:"Fair"}:t<80?{level:"good",score:t,label:"Good"}:{level:"strong",score:Math.min(t,100),label:"Strong"}}function yS(){U(Dt)}const Pl="companies-modal",de={title:"Companies",close:"Close",newCompany:"+ New company",noCompanies:"No companies yet. Create one to use in projects.",edit:"Edit",analyze:"Analyze",reAnalyze:"Re-analyze",viewDetail:"View",detail:"Company detail",analyzedOn:"Analyzed",notAnalyzed:"Not analyzed",delete:"Delete",backToList:"← Back to list",name:"Name *",description:"Description",logoUrl:"Logo URL",website:"Website",linkedIn:"LinkedIn",save:"Save",create:"Create",cancel:"Cancel",invalidUrl:"Please enter a valid URL",updateFailed:"Update failed",createFailed:"Create failed",loadFailed:"Failed to load company",analysisComplete:"Analysis complete",analysisFailed:"Analysis failed",deleteConfirm:"Delete this company? Projects using it must be reassigned first.",companyDeleted:"Company deleted",templates:"Templates (A4 / PPT)",templateA4:"A4 document",templatePPT:"Presentation",generateWithAI:"Generate base with AI",loadCurrent:"Load current",saveTemplate:"Save template",templateLoaded:"Template loaded",templateSaved:"Template saved",templateGenerated:"Template generated",templateLoadFailed:"Failed to load template",templateSaveFailed:"Failed to save template",templateGenerateFailed:"Generation failed"};function re(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function ka(e){if(!e||!e.trim())return!0;try{const t=new URL(e.trim());return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}function wS(){const e=document.querySelector(`[data-modal-id="${Pl}"]`);e&&e.remove();const t=_("div",{className:"modal-overlay"});t.setAttribute("data-modal-id",Pl);const n=_("div",{className:"modal-container",style:"max-width: 640px;"});n.innerHTML=`
    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #e2e8f0);">
      <h2 style="margin: 0; font-size: 1.25rem;">${re(de.title)}</h2>
      <button type="button" class="btn-icon" id="companies-close-btn" title="${re(de.close)}">✕</button>
    </div>
    <div class="modal-body" style="padding: 20px; max-height: 60vh; overflow-y: auto;">
      <button type="button" class="btn btn-primary" id="companies-new-btn" style="margin-bottom: 16px;">${re(de.newCompany)}</button>
      <div id="companies-list">Loading...</div>
    </div>
  `,t.appendChild(n),document.body.appendChild(t);function s(){t.remove()}function i(g){const v=t.querySelector("#companies-list");if(!v)return;const y=Array.isArray(g)?g:[];try{if(y.length===0){v.innerHTML=`<p style="color: var(--text-secondary);">${re(de.noCompanies)}</p>`;return}const S=w=>w.brand_assets?.analyzed_at;v.innerHTML=y.map(w=>{const k=!!S(w),x=k?de.reAnalyze:de.analyze,b=k?`<span class="companies-analyzed-badge" title="${re(S(w)||"")}" style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">${re(de.analyzedOn)}</span>`:`<span class="companies-not-analyzed-badge" style="font-size: 11px; color: var(--text-muted, #94a3b8); margin-left: 6px;">${re(de.notAnalyzed)}</span>`;return`
      <div class="companies-row" data-id="${w.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${w.logo_url?`<img src="${re(w.logo_url)}" alt="" style="width: 36px; height: 36px; object-fit: contain; border-radius: 6px;">`:'<span style="width: 36px; height: 36px; background: var(--bg-secondary); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px;">🏢</span>'}
          <div>
            <strong>${re(w.name)}</strong>${b}
            ${w.brand_assets?.primary_color&&w.brand_assets?.secondary_color?`<span style="display: inline-flex; gap: 4px; margin-left: 8px;"><i style="width: 12px; height: 12px; border-radius: 2px; background: ${re(w.brand_assets.primary_color)};"></i><i style="width: 12px; height: 12px; border-radius: 2px; background: ${re(w.brand_assets.secondary_color)};"></i></span>`:""}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm btn-secondary companies-detail-btn" data-id="${w.id}" title="View analysis">${re(de.viewDetail)}</button>
          <button type="button" class="btn btn-sm btn-secondary companies-edit-btn" data-id="${w.id}">${re(de.edit)}</button>
          <button type="button" class="btn btn-sm btn-secondary companies-analyze-btn" data-id="${w.id}" title="Analyze with AI">${re(x)}</button>
          <button type="button" class="btn btn-sm btn-outline-danger companies-delete-btn" data-id="${w.id}">${re(de.delete)}</button>
        </div>
      </div>
    `}).join("")}catch{v.innerHTML=`<p class="text-error">${re(de.loadFailed)}</p>`}}function a(){const g=t.querySelector("#companies-list");g&&(g.innerHTML="Loading..."),Do().then(v=>i(Array.isArray(v)?v:[])).catch(()=>{try{const v=t.querySelector("#companies-list");v&&(v.innerHTML=`<p class="text-error">${re(de.loadFailed)}</p>`)}catch{}})}const o=`
    <button type="button" class="btn btn-primary" id="companies-new-btn" style="margin-bottom: 16px;">${re(de.newCompany)}</button>
    <div id="companies-list">Loading...</div>
  `;function r(){const g=t.querySelector(".modal-body");g&&(g.innerHTML=o,a(),f())}function c(g){const v=t.querySelector(".modal-body");if(!v)return;const y=!!g;if(v.innerHTML=`
      <div style="margin-bottom: 16px;">
        <button type="button" class="btn btn-secondary btn-sm" id="companies-back-btn">${re(de.backToList)}</button>
      </div>
      <form id="company-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label>${re(de.name)}</label>
          <input type="text" name="name" required value="${g?re(g.name):""}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
        </div>
        <div>
          <label>${re(de.description)}</label>
          <textarea name="description" rows="2" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">${g?.description?re(g.description):""}</textarea>
        </div>
        <div>
          <label>${re(de.logoUrl)}</label>
          <input type="url" name="logo_url" value="${g?.logo_url?re(g.logo_url):""}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);" placeholder="https://...">
        </div>
        <div>
          <label>${re(de.website)}</label>
          <input type="url" name="website_url" value="${g?.website_url?re(g.website_url):""}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);" placeholder="https://...">
        </div>
        <div>
          <label>${re(de.linkedIn)}</label>
          <input type="url" name="linkedin_url" value="${g?.linkedin_url?re(g.linkedin_url):""}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);" placeholder="https://linkedin.com/...">
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="submit" class="btn btn-primary">${re(y?de.save:de.create)}</button>
          <button type="button" class="btn btn-secondary" id="company-form-cancel">${re(de.cancel)}</button>
        </div>
        ${y&&g?`
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
          <button type="button" class="btn btn-secondary btn-sm" id="companies-templates-btn">${re(de.templates)}</button>
        </div>
        `:""}
      </form>
    `,u(v.querySelector("#companies-back-btn"),"click",r),u(v.querySelector("#company-form"),"submit",async S=>{S.preventDefault();const w=v.querySelector("#company-form"),k=new FormData(w),x=k.get("logo_url")?.trim()||void 0,b=k.get("website_url")?.trim()||void 0,C=k.get("linkedin_url")?.trim()||void 0;if(x&&!ka(x)){h.error(de.invalidUrl+" (Logo)");return}if(b&&!ka(b)){h.error(de.invalidUrl+" (Website)");return}if(C&&!ka(C)){h.error(de.invalidUrl+" (LinkedIn)");return}const T={name:k.get("name").trim(),description:k.get("description")?.trim()||void 0,logo_url:x,website_url:b,linkedin_url:C};try{y&&g?(await id(g.id,T),h.success("Company updated")):(await sd(T),h.success("Company created")),r()}catch{h.error(y?de.updateFailed:de.createFailed)}}),u(v.querySelector("#company-form-cancel"),"click",r),y&&g){const S=v.querySelector("#companies-templates-btn");S&&u(S,"click",()=>l(g))}}function l(g){const v=t.querySelector(".modal-body");if(!v)return;let y="a4";v.innerHTML=`
      <div style="margin-bottom: 16px;">
        <button type="button" class="btn btn-secondary btn-sm" id="templates-back-btn">${re(de.backToList)}</button>
      </div>
      <h3 style="margin: 0 0 12px 0; font-size: 1rem;">${re(g.name)} – ${re(de.templates)}</h3>
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button type="button" class="btn btn-sm btn-secondary template-type-btn active" data-type="a4">${re(de.templateA4)}</button>
        <button type="button" class="btn btn-sm btn-secondary template-type-btn" data-type="ppt">${re(de.templatePPT)}</button>
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <button type="button" class="btn btn-sm btn-secondary" id="template-load-btn">${re(de.loadCurrent)}</button>
        <button type="button" class="btn btn-sm btn-primary" id="template-generate-btn">${re(de.generateWithAI)}</button>
        <button type="button" class="btn btn-sm btn-primary" id="template-save-btn">${re(de.saveTemplate)}</button>
      </div>
      <textarea id="template-html-editor" rows="14" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-family: monospace; font-size: 12px;" placeholder="HTML template..."></textarea>
    `;const S=v.querySelector("#template-html-editor"),w=v.querySelector("#template-load-btn"),k=v.querySelector("#template-generate-btn"),x=v.querySelector("#template-save-btn");function b(C){y=C,v.querySelectorAll(".template-type-btn").forEach(T=>T.classList.toggle("active",T.getAttribute("data-type")===C))}u(v.querySelector("#templates-back-btn"),"click",()=>c(g)),v.querySelectorAll(".template-type-btn").forEach(C=>{u(C,"click",()=>b(C.getAttribute("data-type")||"a4"))}),u(w,"click",async()=>{w.disabled=!0;try{const C=await xi(g.id,y);S.value=C,h.success(de.templateLoaded)}catch{h.error(de.templateLoadFailed)}finally{w.disabled=!1}}),u(k,"click",async()=>{k.disabled=!0,k.textContent="...";try{const{html:C}=await rd(g.id,y);S.value=C,h.success(de.templateGenerated)}catch{h.error(de.templateGenerateFailed)}finally{k.disabled=!1,k.textContent=de.generateWithAI}}),u(x,"click",async()=>{x.disabled=!0;try{await ad(g.id,y,S.value),h.success(de.templateSaved)}catch{h.error(de.templateSaveFailed)}finally{x.disabled=!1}}),xi(g.id,y).then(C=>{S.value=C}).catch(()=>{})}const d={ficha_identidade:"1. Ficha de Identidade",visao_geral:"2. Visão Geral e Posicionamento",produtos_servicos:"3. Produtos e Serviços",publico_alvo:"4. Público-Alvo e Clientes",equipa_lideranca:"5. Equipa e Liderança",presenca_digital:"6. Presença Digital e Marketing",analise_competitiva:"7. Análise Competitiva",indicadores_crescimento:"8. Indicadores de Crescimento",swot:"9. Análise SWOT",conclusoes:"10. Conclusões e Insights"};function m(g){const v=t.querySelector(".modal-body");if(!v)return;const y=g.brand_assets,S=y?.analyzed_at?new Date(y.analyzed_at).toLocaleString():"—",w=(y?.ai_context||"").trim()||"—",k=y?.primary_color||"—",x=y?.secondary_color||"—",b=y?.analysis_report||{},C=Object.keys(b).length>0,T=Object.keys(d),A=C?T.map(q=>{const V=d[q],I=(b[q]||"").trim()||"—";return`<div class="companies-report-section"><strong>${re(V)}</strong><div class="companies-report-text">${re(I)}</div></div>`}).join(""):`<div><strong>AI context</strong><div class="companies-report-text">${re(w)}</div></div>
        <div><strong>Primary color</strong> <span style="display: inline-flex; align-items: center; gap: 6px;">${k!=="—"?`<span style="width: 20px; height: 20px; border-radius: 4px; background: ${re(k)};"></span><code>${re(k)}</code>`:"—"}</span></div>
        <div><strong>Secondary color</strong> <span style="display: inline-flex; align-items: center; gap: 6px;">${x!=="—"?`<span style="width: 20px; height: 20px; border-radius: 4px; background: ${re(x)};"></span><code>${re(x)}</code>`:"—"}</span></div>`,M=g.logo_url?`<img src="${re(g.logo_url)}" alt="" class="companies-detail-logo" onerror="this.style.display='none'">`:'<span class="companies-detail-logo-placeholder">🏢</span>';v.innerHTML=`
      <div style="margin-bottom: 16px;">
        <button type="button" class="btn btn-secondary btn-sm" id="companies-detail-back-btn">${re(de.backToList)}</button>
      </div>
      <div class="companies-detail-header" style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        ${M}
        <div>
          <h3 style="margin: 0 0 4px 0; font-size: 1.25rem;">${re(g.name)}</h3>
          <div style="font-size: 12px; color: var(--text-secondary);">${re(de.analyzedOn)} ${re(S)}</div>
        </div>
      </div>
      <div class="companies-detail-report" style="display: flex; flex-direction: column; gap: 14px; max-height: 55vh; overflow-y: auto;">
        ${A}
      </div>
      ${C?`<div style="margin-top: 8px;"><strong>Primary color</strong> ${k!=="—"?`<span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${re(k)};"></span><code>${re(k)}</code></span>`:"—"} &nbsp; <strong>Secondary</strong> ${x!=="—"?`<span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${re(x)};"></span><code>${re(x)}</code></span>`:"—"}</div>`:""}
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button type="button" class="btn btn-primary" id="companies-detail-reanalyze-btn" data-id="${re(g.id)}">${re(de.reAnalyze)}</button>
        <button type="button" class="btn btn-secondary" id="companies-detail-edit-btn" data-id="${re(g.id)}">${re(de.edit)}</button>
      </div>
    `,u(v.querySelector("#companies-detail-back-btn"),"click",r),u(v.querySelector("#companies-detail-edit-btn"),"click",()=>c(g));const Q=v.querySelector("#companies-detail-reanalyze-btn");u(Q,"click",async()=>{Q.disabled=!0,Q.textContent="...";try{const q=await uo(g.id);h.success(de.analysisComplete),m(q)}catch{h.error(de.analysisFailed)}finally{Q.disabled=!1,Q.textContent=de.reAnalyze}})}function f(){u(t.querySelector("#companies-close-btn"),"click",s),u(t,"click",g=>{g.target===t&&s()}),u(n,"click",g=>g.stopPropagation()),u(n,"click",async g=>{const v=g.target;if(v.closest("#companies-new-btn")){c();return}const y=v.closest(".companies-edit-btn"),S=v.closest(".companies-analyze-btn"),w=v.closest(".companies-detail-btn"),k=v.closest(".companies-delete-btn"),x=(y||S||w||k)?.getAttribute("data-id");if(x){if(w){try{const b=await ki(x);b&&m(b)}catch{h.error(de.loadFailed)}return}if(y){try{const b=await ki(x);b&&c(b)}catch{h.error(de.loadFailed)}return}if(S){const b=S;b.disabled=!0;const C=b.textContent;b.textContent="...";try{await uo(x),h.success(de.analysisComplete),a()}catch{h.error(de.analysisFailed)}finally{b.disabled=!1,b.textContent=C||de.analyze}return}if(k){if(!confirm(de.deleteConfirm))return;try{await od(x),h.success(de.companyDeleted),a()}catch{}}}})}a(),f()}const Bn="contact-modal";let dp=null,Co=[],Es=[],rr=[],Ii=[],Hs=[];function Fr(e){const{mode:t,contact:n}=e;dp=n||null;const s=document.querySelector(`[data-modal-id="${Bn}"]`);s&&s.remove();const i=kS(t,n),a=Me({id:Bn,title:"",content:i,size:"lg"}),o=a.querySelector(".modal-content");o&&o.classList.add("modal-content-transparent");const r=a.querySelector(".modal-header");r&&r.classList.add("hidden"),document.body.appendChild(a),qe(Bn),t==="edit"&&n?.id?xS(i,n.id):($S(i),_S(i),SS(i)),LS(i,e)}function kS(e,t){const n=_("div",{className:"contact-modal-sota"}),s=e==="edit",i=t?Li(t.name):"?",a=!!(t?.photoUrl||t?.avatarUrl),o=t?.photoUrl||t?.avatarUrl;return n.innerHTML=`
    <style>
      .contact-modal-sota {
        background: var(--bg-primary);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3);
      }

      /* Header */
      .contact-modal-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%);
        padding: 32px 32px 24px;
        position: relative;
      }

      .contact-modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: all 0.2s;
      }

      .contact-modal-close:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
      }

      .contact-modal-close svg {
        width: 20px;
        height: 20px;
      }

      .contact-header-content {
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .contact-avatar-large {
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 700;
        color: white;
        border: 4px solid rgba(255,255,255,0.3);
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .contact-avatar-large:hover {
        border-color: rgba(255,255,255,0.5);
      }

      .contact-avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .contact-avatar-large .avatar-upload-hint {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .contact-avatar-large:hover .avatar-upload-hint {
        opacity: 1;
      }

      .contact-avatar-large .avatar-upload-hint svg {
        width: 28px;
        height: 28px;
        color: white;
      }

      .contact-header-info {
        flex: 1;
        color: white;
      }

      .contact-header-info h2 {
        margin: 0 0 4px 0;
        font-size: 26px;
        font-weight: 700;
      }

      .contact-header-info p {
        margin: 0;
        font-size: 15px;
        opacity: 0.85;
      }

      .contact-header-actions {
        display: flex;
        gap: 10px;
      }

      .header-action-btn {
        padding: 10px 16px;
        border-radius: 10px;
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.2);
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .header-action-btn:hover {
        background: rgba(255,255,255,0.25);
      }

      .header-action-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Tabs */
      .contact-tabs {
        display: flex;
        border-bottom: 1px solid var(--border-color);
        padding: 0 32px;
        background: var(--bg-secondary);
      }

      .contact-tab-btn {
        padding: 14px 20px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
        transition: color 0.2s;
      }

      .contact-tab-btn:hover {
        color: var(--text-primary);
      }

      .contact-tab-btn.active {
        color: #e11d48;
      }

      .contact-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #e11d48, #f59e0b);
        border-radius: 3px 3px 0 0;
      }

      .contact-tab-btn svg {
        width: 16px;
        height: 16px;
      }

      .contact-tab-btn .tab-count {
        background: rgba(225,29,72,0.1);
        color: #e11d48;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
      }

      /* Tab Content */
      .contact-tab-content {
        padding: 28px 32px;
        min-height: 400px;
        max-height: 500px;
        overflow-y: auto;
      }

      .contact-section {
        display: none;
      }

      .contact-section.active {
        display: block;
      }

      /* Form Styles */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .form-grid.full {
        grid-template-columns: 1fr;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-field.full-width {
        grid-column: 1 / -1;
      }

      .form-field label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .form-field label svg {
        width: 14px;
        height: 14px;
        color: #e11d48;
      }

      .form-field input,
      .form-field textarea,
      .form-field select {
        padding: 12px 14px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.2s;
      }

      .form-field input:focus,
      .form-field textarea:focus,
      .form-field select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
      }

      .form-field textarea {
        resize: vertical;
        min-height: 100px;
      }

      .form-hint {
        font-size: 12px;
        color: var(--text-tertiary);
      }

      /* Projects Section */
      .projects-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .project-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        transition: all 0.2s;
      }

      .project-item:hover {
        border-color: rgba(225,29,72,0.3);
      }

      .project-checkbox {
        width: 20px;
        height: 20px;
        accent-color: #e11d48;
      }

      .project-item label {
        flex: 1;
        font-size: 14px;
        color: var(--text-primary);
        cursor: pointer;
      }

      .project-item .primary-badge {
        padding: 3px 8px;
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: white;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
      }

      /* Relations Section */
      .relations-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .relation-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        transition: all 0.2s;
      }

      .relation-card:hover {
        border-color: rgba(225,29,72,0.3);
        transform: translateX(4px);
      }

      .relation-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: white;
        overflow: hidden;
      }

      .relation-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .relation-info {
        flex: 1;
      }

      .relation-info h4 {
        margin: 0 0 2px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .relation-info p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
      }

      .relation-type {
        padding: 4px 10px;
        background: rgba(99,102,241,0.1);
        color: #6366f1;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      .add-relation-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px;
        background: var(--bg-secondary);
        border: 2px dashed var(--border-color);
        border-radius: 12px;
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .add-relation-btn:hover {
        border-color: #e11d48;
        color: #e11d48;
      }

      .add-relation-btn svg {
        width: 18px;
        height: 18px;
      }

      /* Activity Section */
      .activity-timeline {
        position: relative;
        padding-left: 28px;
      }

      .activity-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border-color);
      }

      .activity-item {
        position: relative;
        padding-bottom: 20px;
      }

      .activity-item::before {
        content: '';
        position: absolute;
        left: -24px;
        top: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #e11d48;
        border: 2px solid var(--bg-primary);
      }

      .activity-item.email::before { background: #3b82f6; }
      .activity-item.meeting::before { background: #10b981; }
      .activity-item.note::before { background: #f59e0b; }

      .activity-time {
        font-size: 11px;
        color: var(--text-tertiary);
        margin-bottom: 4px;
      }

      .activity-content {
        font-size: 14px;
        color: var(--text-primary);
        line-height: 1.5;
      }

      .activity-empty {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
      }

      .activity-empty svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
        margin-bottom: 12px;
      }

      /* Footer */
      .contact-modal-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 32px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }

      .footer-left {
        display: flex;
        gap: 10px;
      }

      .footer-right {
        display: flex;
        gap: 10px;
      }

      .btn-sota {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }

      .btn-sota.primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }

      .btn-sota.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(225,29,72,0.4);
      }

      .btn-sota.secondary {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }

      .btn-sota.secondary:hover {
        background: var(--bg-tertiary);
        border-color: #e11d48;
      }

      .btn-sota.danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #dc2626;
      }

      .btn-sota.danger:hover {
        background: #dc2626;
        color: white;
      }

      .btn-sota svg {
        width: 16px;
        height: 16px;
      }

      .btn-sota:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Loading */
      .loading-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--text-secondary);
      }

      .loading-spinner::after {
        content: '';
        width: 24px;
        height: 24px;
        border: 3px solid var(--border-color);
        border-top-color: #e11d48;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-left: 12px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>

    <!-- Header -->
    <div class="contact-modal-header">
      <button class="contact-modal-close" id="close-contact-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div class="contact-header-content">
        <div class="contact-avatar-large" id="contact-avatar-upload">
          ${a?`<img src="${o}" alt="">`:`<span>${i}</span>`}
          <div class="avatar-upload-hint">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        </div>

        <div class="contact-header-info">
          <h2 id="header-contact-name">${s?Fe(t?.name||""):"New Contact"}</h2>
          <p id="header-contact-org">${s&&t?.organization?Fe(t.organization):"Add organization"}</p>
        </div>

        ${s?`
          <div class="contact-header-actions">
            <button class="header-action-btn" id="enrich-ai-btn" title="Enrich with AI">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Enrich with AI
            </button>
          </div>
        `:""}
      </div>
    </div>

    <!-- Tabs -->
    <div class="contact-tabs">
      <button class="contact-tab-btn active" data-tab="info">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        Info
      </button>
      <button class="contact-tab-btn" data-tab="projects">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        Projects
        <span class="tab-count" id="projects-count">0</span>
      </button>
      <button class="contact-tab-btn" data-tab="relations">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        Relations
        <span class="tab-count" id="relations-count">0</span>
      </button>
      <button class="contact-tab-btn" data-tab="activity">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Activity
      </button>
    </div>

    <!-- Tab Content -->
    <div class="contact-tab-content">
      <!-- Info Section -->
      <div class="contact-section active" id="section-info">
        <form id="contact-form">
          <div class="form-grid">
            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Name *
              </label>
              <input type="text" id="contact-name" required value="${Fe(t?.name||"")}" placeholder="Full name">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Role
              </label>
              <select id="contact-role">
                <option value="">-- Select role --</option>
                <option value="__custom__">Custom role...</option>
              </select>
              <input type="text" id="contact-role-custom" class="contact-role-custom hidden" placeholder="Enter custom role" value="${t?.role&&!Hs.some(r=>r.display_name===t.role)?Fe(t.role):""}">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Email
              </label>
              <input type="email" id="contact-email" value="${Fe(t?.email||"")}" placeholder="email@example.com">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                Phone
              </label>
              <input type="tel" id="contact-phone" value="${Fe(t?.phone||"")}" placeholder="+1 234 567 890">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                Organization
              </label>
              <input type="text" id="contact-organization" value="${Fe(t?.organization||t?.company||"")}" placeholder="Company name">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                LinkedIn
              </label>
              <input type="url" id="contact-linkedin" value="${Fe(t?.linkedin||"")}" placeholder="https://linkedin.com/in/...">
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Avatar URL
              </label>
              <input type="url" id="contact-avatar-url" value="${Fe(t?.photoUrl||t?.avatarUrl||t?.photo_url||t?.avatar_url||"")}" placeholder="https://example.com/photo.jpg">
              <div class="form-hint">Enter a URL to set the contact's profile picture</div>
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                Department
              </label>
              <input type="text" id="contact-department" value="${Fe(t?.department||"")}" placeholder="Engineering, Sales, etc.">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Location
              </label>
              <input type="text" id="contact-location" value="${Fe(t?.location||"")}" placeholder="City, Country">
            </div>

            <div class="form-field">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Timezone
              </label>
              <select id="contact-timezone" data-current="${Fe(t?.timezone||"")}">
                <option value="">Select timezone...</option>
              </select>
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Aliases
              </label>
              <input type="text" id="contact-aliases" value="${t?.aliases?.join(", ")||""}" placeholder="Alternative names (comma separated)">
              <div class="form-hint">Names used to identify this person in documents (e.g., "Luuc" for "Luuk")</div>
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Notes
              </label>
              <textarea id="contact-notes" placeholder="Additional notes about this contact...">${Fe(t?.notes||"")}</textarea>
            </div>

            <div class="form-field full-width">
              <label>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                Tags
              </label>
              <input type="text" id="contact-tags" value="${t?.tags?.join(", ")||""}" placeholder="client, vip, technical (comma separated)">
              <div class="form-hint">Separate tags with commas</div>
            </div>
          </div>
        </form>
      </div>

      <!-- Projects Section -->
      <div class="contact-section" id="section-projects">
        <div class="projects-list" id="projects-list">
          <div class="loading-spinner">Loading projects</div>
        </div>
      </div>

      <!-- Relations Section -->
      <div class="contact-section" id="section-relations">
        <div class="relations-list" id="relations-list">
          <div class="loading-spinner">Loading relations</div>
        </div>
        <button class="add-relation-btn" id="add-relation-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Relationship
        </button>
      </div>

      <!-- Activity Section -->
      <div class="contact-section" id="section-activity">
        <div class="activity-timeline" id="activity-timeline">
          <div class="loading-spinner">Loading activity</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="contact-modal-footer">
      <div class="footer-left">
        ${s?`
          <button class="btn-sota danger" id="delete-contact-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
        `:""}
      </div>
      <div class="footer-right">
        <button class="btn-sota secondary" id="cancel-contact-btn">Cancel</button>
        <button class="btn-sota primary" id="save-contact-btn">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          ${s?"Save Changes":"Create Contact"}
        </button>
      </div>
    </div>
  `,n}async function xS(e,t){try{const[n,s,i,a,o,r]=await Promise.all([p.get(`/api/contacts/${t}/projects`).catch(()=>({data:{projects:[]}})),p.get(`/api/contacts/${t}/relationships`).catch(()=>({data:{relationships:[]}})),p.get(`/api/contacts/${t}/activity`).catch(()=>({data:{activities:[]}})),p.get("/api/role-templates").catch(()=>({data:{roles:[]}})),p.get("/api/projects").catch(()=>({data:{projects:[]}})),p.get("/api/timezones").catch(()=>({data:{timezones:[]}}))]);Co=n.data?.projects||[],Es=s.data?.relationships||[],rr=i.data?.activities||[],Hs=a.data?.roles||[],Ii=o.data?.projects||[];const c=r.data?.timezones||[];up(e,c),pp(e),mp(e),gp(e),CS(e),fp(e)}catch(n){console.error("Failed to load contact data:",n)}}async function $S(e){try{Hs=(await p.get("/api/role-templates")).data?.roles||[],pp(e)}catch{Hs=[]}}async function SS(e){try{const n=(await p.get("/api/timezones")).data?.timezones||[];up(e,n)}catch{}}async function _S(e){try{Ii=(await p.get("/api/projects")).data?.projects||[],mp(e)}catch{Ii=[]}}function up(e,t){const n=e.querySelector("#contact-timezone");if(!n)return;const s=n.dataset.current||"",i={};for(const o of t){const r=o.code.includes("/")?o.code.split("/")[0]:"Other";i[r]||(i[r]=[]),i[r].push(o)}const a=Object.keys(i).sort();n.innerHTML=`
    <option value="">Select timezone...</option>
    ${a.map(o=>`
      <optgroup label="${o}">
        ${i[o].map(r=>`
          <option value="${Fe(r.code)}" ${s===r.code?"selected":""}>
            ${Fe(r.name||r.code)} (${r.utc_offset})
          </option>
        `).join("")}
      </optgroup>
    `).join("")}
  `}function pp(e){const t=e.querySelector("#contact-role"),n=e.querySelector("#contact-role-custom");if(!t)return;const s=dp?.role,i=s&&!Hs.some(a=>a.display_name===s||a.name===s);t.innerHTML=`
    <option value="">-- Select role --</option>
    ${Hs.filter(a=>a.is_active).map(a=>`
      <option value="${Fe(a.display_name||a.name)}" ${s===a.display_name||s===a.name?"selected":""}>
        ${Fe(a.display_name||a.name)}
      </option>
    `).join("")}
    <option value="__custom__" ${i?"selected":""}>Custom role...</option>
  `,i&&n&&(n.classList.remove("hidden"),n.value=s),u(t,"change",()=>{const a=t.value==="__custom__";n.classList.toggle("hidden",!a),a&&n.focus()})}function mp(e){const t=e.querySelector("#projects-list");if(!t)return;if(Ii.length===0){t.innerHTML='<p class="contact-no-projects-hint">No projects available</p>';return}const n=new Set(Co.map(s=>s.id));t.innerHTML=Ii.map(s=>`
    <div class="project-item">
      <input type="checkbox" class="project-checkbox" name="contact-project" value="${s.id}" 
             ${n.has(s.id)?"checked":""}>
      <label>${Fe(s.name)}</label>
      ${Co.find(i=>i.id===s.id)?.is_primary?'<span class="primary-badge">Primary</span>':""}
    </div>
  `).join(""),e.querySelector("#projects-count").textContent=String(n.size)}function gp(e){const t=e.querySelector("#relations-list");if(t){if(Es.length===0){t.innerHTML=`
      <div class="activity-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <p>No relationships yet</p>
      </div>
    `;return}t.innerHTML=Es.map(n=>{const s=n.to_contact,i=s?Li(s.name):"?";return`
      <div class="relation-card" data-id="${n.id}">
        <div class="relation-avatar">
          ${s?.avatar_url?`<img src="${s.avatar_url}" alt="">`:i}
        </div>
        <div class="relation-info">
          <h4>${Fe(s?.name||"Unknown")}</h4>
          <p>${Fe(s?.organization||s?.role||"")}</p>
        </div>
        <span class="relation-type">${AS(n.relationship_type)}</span>
      </div>
    `}).join(""),e.querySelector("#relations-count").textContent=String(Es.length)}}function CS(e){const t=e.querySelector("#activity-timeline");if(t){if(rr.length===0){t.innerHTML=`
      <div class="activity-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No activity recorded yet</p>
      </div>
    `;return}t.innerHTML=rr.map(n=>`
    <div class="activity-item ${n.activity_type}">
      <div class="activity-time">${ES(n.occurred_at)}</div>
      <div class="activity-content">${Fe(n.description)}</div>
    </div>
  `).join("")}}function fp(e){const t=e.querySelector("#projects-count"),n=e.querySelector("#relations-count");t&&(t.textContent=String(Co.length)),n&&(n.textContent=String(Es.length))}function LS(e,t){const{mode:n,contact:s,onSave:i,onDelete:a}=t,o=n==="edit",r=e.querySelector("#close-contact-btn");r&&u(r,"click",()=>U(Bn));const c=e.querySelector("#cancel-contact-btn");c&&u(c,"click",()=>U(Bn));const l=e.querySelectorAll(".contact-tab-btn");l.forEach(b=>{u(b,"click",()=>{l.forEach(T=>T.classList.remove("active")),b.classList.add("active");const C=b.getAttribute("data-tab");e.querySelectorAll(".contact-section").forEach(T=>{T.classList.toggle("active",T.id===`section-${C}`)})})});const d=e.querySelector("#save-contact-btn");d&&u(d,"click",async()=>{const b=e.querySelector("#contact-form");if(!b.checkValidity()){b.reportValidity();return}const C=ee=>e.querySelector(`#${ee}`)?.value.trim()||"",T=e.querySelector("#contact-role"),A=e.querySelector("#contact-role-custom"),M=T.value==="__custom__"?A.value.trim():T.value,Q=C("contact-tags"),q=Q?Q.split(",").map(ee=>ee.trim()).filter(Boolean):[],V=C("contact-aliases"),I=V?V.split(",").map(ee=>ee.trim()).filter(Boolean):[],H={id:s?.id||`contact-${Date.now()}`,name:C("contact-name"),email:C("contact-email")||void 0,phone:C("contact-phone")||void 0,organization:C("contact-organization")||void 0,company:C("contact-organization")||void 0,role:M||void 0,department:C("contact-department")||void 0,linkedin:C("contact-linkedin")||void 0,location:C("contact-location")||void 0,timezone:C("contact-timezone")||void 0,photoUrl:C("contact-avatar-url")||void 0,avatarUrl:C("contact-avatar-url")||void 0,aliases:I.length>0?I:void 0,notes:C("contact-notes")||void 0,tags:q.length>0?q:void 0},W=[];e.querySelectorAll('input[name="contact-project"]:checked').forEach(ee=>{W.push(ee.value)}),d.disabled=!0,d.textContent="Saving...";try{let ee=s?.id;if(o)await p.put(`/api/contacts/${s.id}`,H),h.success("Contact updated");else{const te=await p.post("/api/contacts",H);H.id=te.data.id,ee=te.data.id,h.success("Contact created")}if(ee&&W.length>=0)try{await p.post(`/api/contacts/${ee}/projects/sync`,{projectIds:W})}catch(te){console.warn("Failed to sync project associations:",te)}i?.(H),U(Bn)}catch{h.error("Failed to save contact")}finally{d.disabled=!1,d.innerHTML=`
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          ${o?"Save Changes":"Create Contact"}
        `}});const m=e.querySelector("#delete-contact-btn");m&&o&&u(m,"click",async()=>{if(await Zn(`Are you sure you want to delete "${s.name}"?`,{title:"Delete Contact",confirmText:"Delete",confirmClass:"btn-danger"}))try{await p.delete(`/api/contacts/${s.id}`),h.success("Contact deleted"),a?.(s.id),U(Bn)}catch{h.error("Failed to delete contact")}});const f=e.querySelector("#enrich-ai-btn");f&&o&&u(f,"click",async()=>{h.info("AI enrichment is processing...");try{await p.post(`/api/contacts/${s.id}/enrich`),h.success("Contact enriched! Refreshing..."),U(Bn);const b=await p.get(`/api/contacts/${s.id}`);Fr({...t,contact:b.data.contact})}catch{h.error("AI enrichment failed")}});const g=e.querySelector("#add-relation-btn");g&&s?.id&&u(g,"click",()=>{TS(e,s.id)});const v=e.querySelector("#contact-name"),y=e.querySelector("#contact-organization"),S=e.querySelector("#header-contact-name"),w=e.querySelector("#header-contact-org");v&&S&&u(v,"input",()=>{S.textContent=v.value||"New Contact";const b=e.querySelector(".contact-avatar-large");if(b&&!b.querySelector("img")){const C=b.querySelector("span");C&&(C.textContent=Li(v.value||"?"))}}),y&&w&&u(y,"input",()=>{w.textContent=y.value||"Add organization"});const k=e.querySelector("#contact-avatar-url"),x=e.querySelector(".contact-avatar-large");k&&x&&u(k,"input",()=>{const b=k.value.trim();if(b){const C=new Image;C.onload=()=>{x.innerHTML=`
            <img src="${b}" alt="">
            <div class="avatar-upload-hint">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
          `},C.onerror=()=>{const T=e.querySelector("#contact-name")?.value||"?";x.innerHTML=`
            <span>${Li(T)}</span>
            <div class="avatar-upload-hint">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
          `},C.src=b}else{const C=e.querySelector("#contact-name")?.value||"?";x.innerHTML=`
          <span>${Li(C)}</span>
          <div class="avatar-upload-hint">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        `}})}async function TS(e,t,n){let s=[];try{s=((await p.get("/api/contacts")).data?.contacts||[]).filter(m=>m.id!==t)}catch{h.error("Failed to load contacts");return}if(s.length===0){h.info("No other contacts available to create a relationship");return}const i=_("div",{className:"relation-dialog-overlay"});i.innerHTML=`
    <style>
      .relation-dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .relation-dialog {
        background: var(--bg-primary);
        border-radius: 16px;
        padding: 24px;
        width: 400px;
        max-width: 90vw;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        animation: slideUp 0.2s ease;
      }
      
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .relation-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .relation-dialog h3 svg {
        width: 22px;
        height: 22px;
        color: #e11d48;
      }
      
      .relation-dialog-field {
        margin-bottom: 16px;
      }
      
      .relation-dialog-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }
      
      .relation-dialog-field select {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 14px;
      }
      
      .relation-dialog-field select:focus {
        outline: none;
        border-color: #e11d48;
      }
      
      .relation-dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 24px;
      }
      
      .relation-dialog-actions button {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .relation-dialog-actions .cancel-btn {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
      }
      
      .relation-dialog-actions .cancel-btn:hover {
        background: var(--bg-tertiary);
      }
      
      .relation-dialog-actions .save-btn {
        background: linear-gradient(135deg, #e11d48, #be123c);
        border: none;
        color: white;
      }
      
      .relation-dialog-actions .save-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225,29,72,0.3);
      }
      
      .relation-dialog-actions .save-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
    </style>
    
    <div class="relation-dialog">
      <h3>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        Add Relationship
      </h3>
      
      <div class="relation-dialog-field">
        <label>Related Contact</label>
        <select id="rel-contact-select">
          <option value="">-- Select contact --</option>
          ${s.map(d=>`
            <option value="${d.id}">${Fe(d.name)}${d.organization?` (${Fe(d.organization)})`:""}</option>
          `).join("")}
        </select>
      </div>
      
      <div class="relation-dialog-field">
        <label>Relationship Type</label>
        <select id="rel-type-select">
          <option value="">-- Select type --</option>
          <option value="reports_to">Reports to</option>
          <option value="manages">Manages</option>
          <option value="works_with">Works with</option>
          <option value="knows">Knows</option>
          <option value="referred_by">Referred by</option>
        </select>
      </div>
      
      <div class="relation-dialog-actions">
        <button class="cancel-btn" id="rel-cancel-btn">Cancel</button>
        <button class="save-btn" id="rel-save-btn">Add Relationship</button>
      </div>
    </div>
  `,document.body.appendChild(i);const a=i.querySelector("#rel-cancel-btn"),o=i.querySelector("#rel-save-btn"),r=i.querySelector("#rel-contact-select"),c=i.querySelector("#rel-type-select"),l=()=>i.remove();u(a,"click",l),u(i,"click",d=>{d.target===i&&l()}),u(o,"click",async()=>{const d=r.value,m=c.value;if(!d||!m){h.error("Please select both a contact and relationship type");return}o.disabled=!0,o.textContent="Saving...";try{await p.post(`/api/contacts/${t}/relationships`,{toContactId:d,type:m}),h.success("Relationship added"),l(),Es=(await p.get(`/api/contacts/${t}/relationships`)).data?.relationships||[],gp(e),fp(e)}catch(f){const g=f instanceof Error?f.message:"Failed to add relationship";h.error(g),o.disabled=!1,o.textContent="Add Relationship"}})}function Li(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)||"?"}function Fe(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function AS(e){return{reports_to:"Reports to",manages:"Manages",works_with:"Works with",knows:"Knows",referred_by:"Referred by"}[e]||e.replace(/_/g," ")}function ES(e){const t=new Date(e),s=new Date().getTime()-t.getTime(),i=Math.floor(s/(1e3*60*60*24));return i===0?"Today":i===1?"Yesterday":i<7?`${i} days ago`:t.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}const ai="team-modal";let xs=[];async function MS(e){const{projectId:t,onInvite:n,onRemove:s,onRoleChange:i}=e,a=document.querySelector(`[data-modal-id="${ai}"]`);a&&a.remove();const o=_("div",{className:"team-modal-content"});o.innerHTML='<div class="loading">Loading team members...</div>';const r=_("div",{className:"modal-footer"}),c=_("button",{className:"btn btn-primary",textContent:"Invite Member"}),l=_("button",{className:"btn btn-secondary",textContent:"Close"});u(l,"click",()=>U(ai)),u(c,"click",()=>{U(ai),n?.()}),r.appendChild(l),r.appendChild(c);const d=Me({id:ai,title:"Team Members",content:o,size:"lg",footer:r});document.body.appendChild(d),qe(ai);try{xs=(await p.get(`/api/projects/${t}/members`)).data,hp(o,e)}catch{o.innerHTML='<div class="error">Failed to load team members</div>'}}function hp(e,t){if(xs.length===0){e.innerHTML=`
      <div class="empty-state">
        <p>No team members yet</p>
        <p class="text-muted">Invite members to collaborate on this project</p>
      </div>
    `;return}e.innerHTML=`
    <div class="team-list">
      ${xs.map(n=>qS(n)).join("")}
    </div>
  `,e.querySelectorAll(".member-card").forEach(n=>{const s=n.getAttribute("data-member-id");if(!s)return;const i=xs.find(r=>r.id===s);if(!i)return;const a=n.querySelector(".role-select");a&&u(a,"change",async()=>{const r=a.value;try{await p.patch(`/api/projects/${t.projectId}/members/${s}`,{role:r}),i.role=r,h.success("Role updated"),t.onRoleChange?.(s,r)}catch{a.value=i.role}});const o=n.querySelector(".btn-remove");o&&u(o,"click",async()=>{const{confirm:r}=await ve(async()=>{const{confirm:l}=await Promise.resolve().then(()=>vn);return{confirm:l}},void 0);if(await r(`Remove ${i.name} from this project?`,{title:"Remove Member",confirmText:"Remove",confirmClass:"btn-danger"}))try{await p.delete(`/api/projects/${t.projectId}/members/${s}`),xs=xs.filter(l=>l.id!==s),hp(e,t),h.success("Member removed"),t.onRemove?.(s)}catch{}})})}function qS(e){const t=e.name.split(" ").map(s=>s[0]).join("").toUpperCase().slice(0,2),n=e.role==="superadmin";return`
    <div class="member-card" data-member-id="${e.id}">
      <div class="member-avatar">
        ${e.avatarUrl?`<img src="${e.avatarUrl}" alt="${xa(e.name)}">`:t}
      </div>
      <div class="member-info">
        <div class="member-name">${xa(e.name)}</div>
        <div class="member-email">${xa(e.email)}</div>
      </div>
      <div class="member-role">
        ${n?'<span class="role-badge superadmin">Owner</span>':`<select class="role-select form-control">
              <option value="admin" ${e.role==="admin"?"selected":""}>Admin</option>
              <option value="member" ${e.role==="member"?"selected":""}>Member</option>
            </select>`}
      </div>
      <div class="member-actions">
        ${n?"":'<button class="btn btn-sm btn-danger btn-remove" title="Remove member">✕</button>'}
      </div>
    </div>
  `}function xa(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const ss="invite-modal";let cr=[];function Vr(e){const{projectId:t,onInviteSent:n}=e,s=document.querySelector(`[data-modal-id="${ss}"]`);s&&s.remove();const i=_("div",{className:"invite-modal-content"});i.innerHTML=`
    <style>
      .invite-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
      }
      
      .invite-tab-btn {
        flex: 1;
        padding: 12px 16px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #64748b);
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      }
      
      .invite-tab-btn:hover {
        color: var(--text-primary, #1e293b);
      }
      
      .invite-tab-btn.active {
        color: #e11d48;
      }
      
      .invite-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: #e11d48;
      }
      
      .invite-tab-content {
        display: none;
      }
      
      .invite-tab-content.active {
        display: block;
      }
      
      .contacts-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      
      .contact-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
      }
      
      .contact-option:last-child {
        border-bottom: none;
      }
      
      .contact-option:hover {
        background: var(--bg-secondary, #f8fafc);
      }
      
      .contact-option.selected {
        background: linear-gradient(135deg, rgba(225,29,72,0.08) 0%, rgba(225,29,72,0.04) 100%);
      }
      
      .contact-option input[type="radio"] {
        display: none;
      }
      
      .contact-option .radio-circle {
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-color, #cbd5e1);
        border-radius: 50%;
        flex-shrink: 0;
        position: relative;
        transition: all 0.2s;
      }
      
      .contact-option.selected .radio-circle {
        border-color: #e11d48;
      }
      
      .contact-option.selected .radio-circle::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 8px;
        height: 8px;
        background: #e11d48;
        border-radius: 50%;
      }
      
      .contact-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 600;
        flex-shrink: 0;
        overflow: hidden;
      }
      
      .contact-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .contact-info {
        flex: 1;
        min-width: 0;
      }
      
      .contact-name {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        margin-bottom: 2px;
      }
      
      .contact-email {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .no-contacts-msg {
        padding: 24px;
        text-align: center;
        color: var(--text-secondary, #64748b);
      }
      
      .email-status {
        margin-top: 8px;
        padding: 8px 12px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        font-size: 12px;
        color: #166534;
        display: none;
      }
      
      .email-status.show {
        display: block;
      }
      
      .email-status.error {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }
    </style>
    
    <!-- Tabs -->
    <div class="invite-tabs">
      <button type="button" class="invite-tab-btn active" data-tab="new">
        New Email
      </button>
      <button type="button" class="invite-tab-btn" data-tab="contacts">
        Existing Contacts
      </button>
    </div>
    
    <!-- Tab: New Email -->
    <div class="invite-tab-content active" id="tab-new">
      <form id="invite-form" class="invite-form">
        <div class="form-group">
          <label for="invite-email">Email Address *</label>
          <input type="email" id="invite-email" required 
                 placeholder="colleague@example.com">
          <div class="form-hint">They will receive an email invitation to join this project</div>
        </div>
        
        <div class="form-group">
          <label for="invite-role">Access Level</label>
          <select id="invite-role">
            <option value="read">Viewer - Can view data only</option>
            <option value="write" selected>Member - Can view and edit data</option>
            <option value="admin">Admin - Can manage team and settings</option>
          </select>
          <div class="form-hint invite-form-hint">You can assign a project role after they join.</div>
        </div>
        
        <div class="form-group">
          <label for="invite-message">Personal Message (optional)</label>
          <textarea id="invite-message" rows="2" 
                    placeholder="Add a personal note to the invitation..."></textarea>
        </div>
        
        <div class="email-status" id="email-status"></div>
      </form>
    </div>
    
    <!-- Tab: Existing Contacts -->
    <div class="invite-tab-content" id="tab-contacts">
      <div id="contacts-list" class="contacts-list">
        <div class="no-contacts-msg">Loading contacts...</div>
      </div>
      
      <div class="form-group">
        <label for="invite-role-contact">Access Level</label>
        <select id="invite-role-contact">
          <option value="read">Viewer - Can view data only</option>
          <option value="write" selected>Member - Can view and edit data</option>
          <option value="admin">Admin - Can manage team and settings</option>
        </select>
      </div>
      
      <div class="add-options">
        <button type="button" id="btn-add-direct" class="btn btn-primary invite-btn-flex">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="invite-btn-icon">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Add to Team
        </button>
        <button type="button" id="btn-send-invite" class="btn btn-secondary invite-btn-flex">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="invite-btn-icon">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Send Invitation
        </button>
      </div>
      <div class="form-hint invite-form-hint-sm">
        <strong>Add to Team:</strong> Adds contact as team member directly (no email sent)<br>
        <strong>Send Invitation:</strong> Sends an email invitation to join
      </div>
      
      <div class="email-status" id="email-status-contact"></div>
    </div>
    
    <div class="invite-link-section">
      <h4 class="invite-link-title">Or share invite link</h4>
      <div class="input-group invite-input-group">
        <input type="text" id="invite-link" readonly 
               value="Generating link..." class="form-control invite-link-input">
        <button type="button" id="btn-copy-link" class="btn btn-secondary">Copy</button>
      </div>
    </div>
  `;let a="new",o=null;const r=_("div",{className:"modal-footer"}),c=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),l=_("button",{className:"btn btn-primary",textContent:"Send Invitation"});u(c,"click",()=>U(ss)),u(l,"click",async()=>{if(a!=="new")return;const f=i.querySelector("#invite-form");if(!f.checkValidity()){f.reportValidity();return}const g=i.querySelector("#invite-email").value.trim(),v=i.querySelector("#invite-role").value,y=i.querySelector("#invite-message").value.trim();l.disabled=!0,l.textContent="Sending...";const S=i.querySelector("#email-status");try{(await p.post(`/api/projects/${t}/invites`,{email:g,role:v,message:y||void 0})).data.email_sent?(S.textContent=`✓ Invitation email sent to ${g}`,S.classList.remove("error"),S.classList.add("show")):(S.textContent="Invitation created, but email could not be sent. Share the link manually.",S.classList.add("error","show")),h.success(`Invitation sent to ${g}`),n?.(g),setTimeout(()=>U(ss),1500)}catch{S.textContent="Failed to create invitation",S.classList.add("error","show")}finally{l.disabled=!1,l.textContent="Send Invitation"}}),r.appendChild(c),r.appendChild(l),setTimeout(()=>{const f=i.querySelector("#btn-add-direct"),g=i.querySelector("#btn-send-invite"),v=i.querySelector("#email-status-contact");f&&u(f,"click",async()=>{if(!o){h.error("Please select a contact");return}const y=i.querySelector("#invite-role-contact").value;f.disabled=!0,f.innerHTML='<span class="spinner"></span> Adding...';try{await p.post(`/api/projects/${t}/members/add-contact`,{contact_id:o.id,role:y}),v.textContent=`✓ ${o.name} added to team`,v.classList.remove("error"),v.classList.add("show"),h.success(`${o.name} added to team`),n?.(o.email||o.name),setTimeout(()=>U(ss),1e3)}catch(S){const w=S?.response?.data?.error||"Failed to add member";v.textContent=w,v.classList.add("error","show"),h.error(w)}finally{f.disabled=!1,f.innerHTML=`
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="invite-btn-icon">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Add to Team
          `}}),g&&u(g,"click",async()=>{if(!o||!o.email){h.error("Please select a contact with an email address");return}const y=i.querySelector("#invite-role-contact").value;g.disabled=!0,g.innerHTML='<span class="spinner"></span> Sending...';try{(await p.post(`/api/projects/${t}/invites`,{email:o.email,role:y})).data.email_sent?(v.textContent=`✓ Invitation email sent to ${o.email}`,v.classList.remove("error"),v.classList.add("show")):(v.textContent="Invitation created, but email could not be sent.",v.classList.add("error","show")),h.success(`Invitation sent to ${o.name}`),n?.(o.email),setTimeout(()=>U(ss),1500)}catch{v.textContent="Failed to send invitation",v.classList.add("error","show")}finally{g.disabled=!1,g.innerHTML=`
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="invite-btn-icon">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Send Invitation
          `}})},0);const d=Me({id:ss,title:"Invite Team Member",content:i,size:"md",footer:r});document.body.appendChild(d),qe(ss),jS(i,t);const m=i.querySelectorAll(".invite-tab-btn");m.forEach(f=>{u(f,"click",()=>{const g=f.getAttribute("data-tab")||"new";a=g,m.forEach(v=>v.classList.remove("active")),f.classList.add("active"),i.querySelectorAll(".invite-tab-content").forEach(v=>{v.classList.toggle("active",v.id===`tab-${g}`)})})}),PS(i,t,f=>{o=f}),setTimeout(()=>{const f=i.querySelector("#btn-copy-link");f&&u(f,"click",()=>{const g=i.querySelector("#invite-link");navigator.clipboard.writeText(g.value).then(()=>{h.success("Link copied to clipboard")}).catch(()=>{g.select(),document.execCommand("copy"),h.success("Link copied")})})},0)}async function jS(e,t){const n=e.querySelector("#invite-link");try{const s=await p.get(`/api/projects/${t}/invites/link`);n.value=s.data.link||s.data.invite_url||"Link not available"}catch{try{const s=await p.post(`/api/projects/${t}/invites`,{email:"",role:"member",generate_link_only:!0});s.data.invite_url?n.value=s.data.invite_url:n.value="Use email invitation instead"}catch{n.value="Use email invitation instead"}}}async function DS(e){try{cr=(await p.get(`/api/projects/${e}/members`)).data.members||[]}catch(t){console.warn("[InviteModal] Failed to load project members:",t),cr=[]}}async function PS(e,t,n){const s=e.querySelector("#contacts-list");if(s)try{await DS(t);const a=(await p.get("/api/contacts")).data.contacts||[],o=new Set(cr.filter(l=>l.linked_contact_id).map(l=>l.linked_contact_id)),r=a.filter(l=>!o.has(l.id));if(r.length===0){s.innerHTML=`
        <div class="no-contacts-msg">
          ${o.size>0?"All contacts are already team members.":"No contacts found."}
          <br>
          <small class="invite-no-contacts-hint">Add contacts in the Contacts panel.</small>
        </div>
      `;return}s.innerHTML=r.map(l=>{const d=l.name.split(" ").map(v=>v[0]).join("").substring(0,2).toUpperCase(),m=l.avatar_url||l.photo_url,f=!!l.email,g=[l.email,l.organization].filter(Boolean).join(" • ")||l.role||"No email";return`
        <label class="contact-option" data-id="${l.id}" data-has-email="${f}">
          <input type="radio" name="contact-select" value="${l.id}">
          <span class="radio-circle"></span>
          <div class="contact-avatar">
            ${m?`<img src="${m}" alt="${$a(l.name)}">`:d}
          </div>
          <div class="contact-info">
            <div class="contact-name">${$a(l.name)}</div>
            <div class="contact-email">${$a(g)}${f?"":' <span class="contact-no-email">(no email)</span>'}</div>
          </div>
        </label>
      `}).join("");const c=s.querySelectorAll(".contact-option");c.forEach(l=>{u(l,"click",()=>{c.forEach(f=>f.classList.remove("selected")),l.classList.add("selected");const d=l.getAttribute("data-id"),m=r.find(f=>f.id===d)||null;n(m)})})}catch{s.innerHTML=`
      <div class="no-contacts-msg">
        Failed to load contacts
      </div>
    `}}function $a(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const zS=Object.freeze(Object.defineProperty({__proto__:null,showInviteModal:Vr},Symbol.toStringTag,{value:"Module"})),In="role-modal",IS=["view:dashboard","view:chat","view:sot","view:contacts","edit:questions","edit:risks","edit:actions","edit:decisions","edit:contacts","manage:team","manage:settings","manage:roles","delete:data","export:data"];function vp(e){const{mode:t,role:n,availablePermissions:s=IS,onSave:i,onDelete:a}=e,o=t==="edit"&&n?.id,r=t==="view",c=document.querySelector(`[data-modal-id="${In}"]`);c&&c.remove();const l=_("div",{className:"role-modal-content"});if(r&&n)l.innerHTML=`
      <div class="role-view">
        <div class="role-header-info">
          <div class="role-color-badge" style="--role-color: ${n.color||"#e94560"}"></div>
          <div>
            <h3>${Il(n.name)}</h3>
            ${n.description?`<p class="text-muted">${Il(n.description)}</p>`:""}
          </div>
        </div>
        
        <div class="role-permissions">
          <h4>Permissions (${n.permissions.length})</h4>
          <div class="permissions-list">
            ${n.permissions.map(f=>`
              <span class="permission-tag">${zl(f)}</span>
            `).join("")}
          </div>
        </div>
        
        ${n.isDefault?'<p class="text-muted"><em>This is a system role and cannot be modified.</em></p>':""}
      </div>
    `;else{const f=n?.permissions||[];l.innerHTML=`
      <form id="role-form" class="role-form">
        <div class="form-row">
          <div class="form-group role-form-flex-1">
            <label for="role-name">Role Name *</label>
            <input type="text" id="role-name" required 
                   value="${n?.name||""}" 
                   placeholder="e.g., Project Manager">
          </div>
          <div class="form-group role-form-w-80">
            <label for="role-color">Color</label>
            <input type="color" id="role-color" 
                   value="${n?.color||"#e94560"}">
          </div>
        </div>
        
        <div class="form-group">
          <label for="role-description">Description</label>
          <textarea id="role-description" rows="2" 
                    placeholder="Brief description of this role...">${n?.description||""}</textarea>
        </div>
        
        <div class="form-group">
          <label>Permissions</label>
          <div class="permissions-grid">
            ${s.map(g=>`
              <label class="permission-checkbox">
                <input type="checkbox" name="permissions" value="${g}" 
                       ${f.includes(g)?"checked":""}>
                <span>${zl(g)}</span>
              </label>
            `).join("")}
          </div>
        </div>
        
        <div class="form-group">
          <button type="button" class="btn btn-sm btn-secondary" data-action="select-all">Select All</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="select-none">Select None</button>
        </div>
      </form>
    `,setTimeout(()=>{const g=l.querySelector('[data-action="select-all"]'),v=l.querySelector('[data-action="select-none"]');g&&u(g,"click",()=>{l.querySelectorAll('[name="permissions"]').forEach(y=>{y.checked=!0})}),v&&u(v,"click",()=>{l.querySelectorAll('[name="permissions"]').forEach(y=>{y.checked=!1})})},0)}const d=_("div",{className:"modal-footer"});if(r){const f=_("button",{className:"btn btn-primary",textContent:"Edit"}),g=_("button",{className:"btn btn-secondary",textContent:"Close"});u(g,"click",()=>U(In)),n?.isDefault||(u(f,"click",()=>{U(In),vp({...e,mode:"edit"})}),d.appendChild(f)),d.appendChild(g)}else{const f=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),g=_("button",{className:"btn btn-primary",textContent:o?"Save Changes":"Create Role"});if(u(f,"click",()=>U(In)),u(g,"click",async()=>{const v=l.querySelector("#role-form");if(!v.checkValidity()){v.reportValidity();return}const y=l.querySelector("#role-name").value.trim(),S=l.querySelector("#role-description").value.trim(),w=l.querySelector("#role-color").value,k=[];l.querySelectorAll('[name="permissions"]:checked').forEach(b=>{k.push(b.value)});const x={id:n?.id||`role-${Date.now()}`,name:y,description:S||void 0,color:w,permissions:k};g.disabled=!0,g.textContent="Saving...";try{if(o)await p.put(`/api/roles/${n.id}`,x),h.success("Role updated");else{const b=await p.post("/api/roles",x);x.id=b.data.id,h.success("Role created")}i?.(x),U(In)}catch{}finally{g.disabled=!1,g.textContent=o?"Save Changes":"Create Role"}}),o&&!n?.isDefault){const v=_("button",{className:"btn btn-danger",textContent:"Delete"});u(v,"click",async()=>{const{confirm:y}=await ve(async()=>{const{confirm:w}=await Promise.resolve().then(()=>vn);return{confirm:w}},void 0);if(await y(`Are you sure you want to delete the "${n.name}" role?`,{title:"Delete Role",confirmText:"Delete",confirmClass:"btn-danger"}))try{await p.delete(`/api/roles/${n.id}`),h.success("Role deleted"),a?.(n.id),U(In)}catch{}}),d.appendChild(v)}d.appendChild(f),d.appendChild(g)}const m=Me({id:In,title:r?"Role Details":o?"Edit Role":"New Role",content:l,size:"md",footer:d});document.body.appendChild(m),qe(In)}function zl(e){return e.replace(":",": ").split(/[_:]/).map(t=>t.charAt(0).toUpperCase()+t.slice(1)).join(" ")}function Il(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const ri="export-modal";function HS(e={}){const{defaultFormat:t="json",defaultScope:n="all"}=e,s=document.querySelector(`[data-modal-id="${ri}"]`);s&&s.remove();const i=_("div",{className:"export-modal-content"});i.innerHTML=`
    <div class="export-options">
      <div class="form-group">
        <label>What to Export</label>
        <div class="scope-options">
          <label class="radio-card ${n==="all"?"selected":""}">
            <input type="radio" name="export-scope" value="all" ${n==="all"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">📦</span>
              <span class="label">Everything</span>
            </div>
          </label>
          <label class="radio-card ${n==="questions"?"selected":""}">
            <input type="radio" name="export-scope" value="questions" ${n==="questions"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">❓</span>
              <span class="label">Questions</span>
            </div>
          </label>
          <label class="radio-card ${n==="risks"?"selected":""}">
            <input type="radio" name="export-scope" value="risks" ${n==="risks"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">⚠️</span>
              <span class="label">Risks</span>
            </div>
          </label>
          <label class="radio-card ${n==="actions"?"selected":""}">
            <input type="radio" name="export-scope" value="actions" ${n==="actions"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">✅</span>
              <span class="label">Actions</span>
            </div>
          </label>
          <label class="radio-card ${n==="decisions"?"selected":""}">
            <input type="radio" name="export-scope" value="decisions" ${n==="decisions"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">🎯</span>
              <span class="label">Decisions</span>
            </div>
          </label>
          <label class="radio-card ${n==="contacts"?"selected":""}">
            <input type="radio" name="export-scope" value="contacts" ${n==="contacts"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">👥</span>
              <span class="label">Contacts</span>
            </div>
          </label>
        </div>
      </div>
      
      <div class="form-group">
        <label>Format</label>
        <div class="format-options">
          <label class="radio-card ${t==="json"?"selected":""}">
            <input type="radio" name="export-format" value="json" ${t==="json"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">{ }</span>
              <span class="label">JSON</span>
              <span class="hint">Full data backup</span>
            </div>
          </label>
          <label class="radio-card ${t==="csv"?"selected":""}">
            <input type="radio" name="export-format" value="csv" ${t==="csv"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">📊</span>
              <span class="label">CSV</span>
              <span class="hint">Spreadsheet</span>
            </div>
          </label>
          <label class="radio-card ${t==="markdown"?"selected":""}">
            <input type="radio" name="export-format" value="markdown" ${t==="markdown"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">📝</span>
              <span class="label">Markdown</span>
              <span class="hint">Documentation</span>
            </div>
          </label>
          <label class="radio-card ${t==="pdf"?"selected":""}">
            <input type="radio" name="export-format" value="pdf" ${t==="pdf"?"checked":""}>
            <div class="radio-card-content">
              <span class="icon">📄</span>
              <span class="label">PDF</span>
              <span class="hint">Report</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  `,i.querySelectorAll(".radio-card input").forEach(l=>{u(l,"change",()=>{const d=l.name;i.querySelectorAll(`[name="${d}"]`).forEach(m=>{const f=m.closest(".radio-card");f&&(m.checked?cs(f,"selected"):ds(f,"selected"))})})});const a=_("div",{className:"modal-footer"}),o=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),r=_("button",{className:"btn btn-primary",textContent:"Export"});u(o,"click",()=>U(ri)),u(r,"click",async()=>{const l=i.querySelector('[name="export-format"]:checked')?.value,d=i.querySelector('[name="export-scope"]:checked')?.value;r.disabled=!0,r.textContent="Exporting...";try{await RS(l,d),e.onExport?.(l,d),U(ri)}catch{}finally{r.disabled=!1,r.textContent="Export"}}),a.appendChild(o),a.appendChild(r);const c=Me({id:ri,title:"Export Data",content:i,size:"md",footer:a});document.body.appendChild(c),qe(ri)}async function RS(e,t){const n=z.getState().currentProjectId;if(!n){h.error("No project selected");return}try{const s=await p.get(`/api/projects/${n}/export`,{headers:{Accept:BS(e)}}),i=NS(s.data,e),a=URL.createObjectURL(i),o=document.createElement("a");o.href=a,o.download=`godmode-${t}-${new Date().toISOString().split("T")[0]}.${OS(e)}`,o.click(),URL.revokeObjectURL(a),h.success("Export completed")}catch{throw h.error("Export failed"),new Error("Export failed")}}function BS(e){switch(e){case"json":return"application/json";case"csv":return"text/csv";case"markdown":return"text/markdown";case"pdf":return"application/pdf"}}function OS(e){switch(e){case"json":return"json";case"csv":return"csv";case"markdown":return"md";case"pdf":return"pdf"}}function NS(e,t){let n,s;switch(t){case"json":n=JSON.stringify(e,null,2),s="application/json";break;case"csv":n=typeof e=="string"?e:JSON.stringify(e),s="text/csv";break;case"markdown":n=typeof e=="string"?e:JSON.stringify(e,null,2),s="text/markdown";break;case"pdf":n=typeof e=="string"?e:"",s="application/pdf";break}return new Blob([n],{type:s})}const ci="file-upload-modal";let Ht=[],li=!1,Sa=[],_a=[],_s="",Cs="";function Zr(e={}){const{accept:t="*/*",multiple:n=!0,maxSize:s=50*1024*1024,onUpload:i,onComplete:a}=e;Ht=[],li=!1,_s="",Cs="";const o=document.querySelector(`[data-modal-id="${ci}"]`);o&&o.remove();const r=_("div",{className:"file-upload-modal-content"});function c(){const k=Sa.map(b=>`<option value="${b.id}" ${b.id===_s?"selected":""}>${Lo(b.name)}</option>`).join(""),x=_a.map(b=>`<option value="${b.id}" ${b.id===Cs?"selected":""}>${Lo((b.content||b.task||String(b.id)).slice(0,60))}${(b.content||b.task||"").length>60?"…":""}</option>`).join("");r.innerHTML=`
      <div class="drop-zone" id="drop-zone">
        <div class="drop-zone-icon">📁</div>
        <div class="drop-zone-text">
          <strong>Drop files here</strong> or click to browse
        </div>
        <div class="drop-zone-hint">
          ${n?"You can upload multiple files":"Single file only"}
          ${s?` • Max ${Ro(s)}`:""}
        </div>
        <input type="file" id="file-input" ${t!=="*/*"?`accept="${t}"`:""} ${n?"multiple":""} hidden>
      </div>

      <div class="upload-association" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color, #e2e8f0);">
        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Associate with (optional)</label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 140px;">
            <select id="upload-sprint-select" class="form-select" style="width: 100%;">
              <option value="">No sprint</option>
              ${k}
            </select>
            <span class="form-hint" style="font-size: 0.75rem; color: var(--text-tertiary);">Sprint</span>
          </div>
          <div style="flex: 1; min-width: 180px;">
            <select id="upload-action-select" class="form-select" style="width: 100%;">
              <option value="">No task</option>
              ${x}
            </select>
            <span class="form-hint" style="font-size: 0.75rem; color: var(--text-tertiary);">Task</span>
          </div>
        </div>
      </div>
      
      ${Ht.length>0?`
        <div class="upload-list">
          <h4>Files (${Ht.length})</h4>
          ${Ht.map(b=>US(b)).join("")}
        </div>
      `:""}
    `,l(),d(),g()}function l(){const k=r.querySelector("#drop-zone"),x=r.querySelector("#file-input");!k||!x||(u(k,"click",()=>x.click()),u(x,"change",()=>{x.files&&(Hl(Array.from(x.files),s),c())}),u(k,"dragover",b=>{b.preventDefault(),cs(k,"drag-over")}),u(k,"dragleave",()=>{ds(k,"drag-over")}),u(k,"drop",b=>{b.preventDefault(),ds(k,"drag-over");const C=b.dataTransfer;C?.files&&(Hl(Array.from(C.files),s),c())}))}function d(){r.querySelectorAll('[data-action="remove"]').forEach(k=>{u(k,"click",()=>{const x=k.getAttribute("data-file-id");x&&(Ht=Ht.filter(b=>b.id!==x),c())})})}async function m(){try{Sa=await Oo()}catch{Sa=[]}}async function f(k){try{_a=await pd(void 0,k||void 0)}catch{_a=[]}}function g(){const k=r.querySelector("#upload-sprint-select"),x=r.querySelector("#upload-action-select");k&&u(k,"change",async()=>{_s=k.value||"",Cs="",await f(_s),c()}),x&&u(x,"change",()=>{Cs=x.value||""})}c(),m().then(()=>c());const v=_("div",{className:"modal-footer"}),y=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),S=_("button",{className:"btn btn-primary",textContent:"Upload"});u(y,"click",()=>{if(li){h.warning("Upload in progress");return}U(ci)}),u(S,"click",async()=>{if(Ht.length===0){h.warning("No files selected");return}if(!li){li=!0,S.disabled=!0,S.textContent="Uploading...";try{if(i){const k=Ht.map(x=>x.file);await i(k),Ht.forEach(x=>{x.status="completed",x.progress=100})}else await FS(Ht,c);h.success("Upload complete"),a?.(Ht),U(ci)}catch{h.error("Upload failed")}finally{li=!1,S.disabled=!1,S.textContent="Upload",c()}}}),v.appendChild(y),v.appendChild(S);const w=Me({id:ci,title:"Upload Files",content:r,size:"md",footer:v});document.body.appendChild(w),qe(ci)}function Hl(e,t){e.forEach(n=>{if(n.size>t){h.error(`${n.name} exceeds max size`);return}Ht.some(s=>s.file.name===n.name&&s.file.size===n.size)||Ht.push({id:`file-${Date.now()}-${Math.random().toString(36).slice(2)}`,file:n,progress:0,status:"pending"})})}function US(e){const t=VS(e.file.type);return`
    <div class="upload-item ${e.status}" data-file-id="${e.id}">
      <span class="file-icon">${t}</span>
      <div class="file-info">
        <div class="file-name">${Lo(e.file.name)}</div>
        <div class="file-size">${Ro(e.file.size)}</div>
        ${e.status==="uploading"?`
          <div class="progress-bar">
            <div class="progress-fill" style="--progress: ${e.progress}"></div>
          </div>
        `:""}
        ${e.error?`<div class="file-error">${Lo(e.error)}</div>`:""}
      </div>
      <div class="file-status">
        ${e.status==="completed"?"✓":""}
        ${e.status==="error"?"✕":""}
        ${e.status==="pending"?`
          <button class="btn-sm btn-danger" data-action="remove" data-file-id="${e.id}">×</button>
        `:""}
      </div>
    </div>
  `}async function FS(e,t){for(const n of e){n.status="uploading",t();try{const s=new FormData;s.append("file",n.file),_s&&s.append("sprintId",_s),Cs&&s.append("actionId",Cs);const i=new XMLHttpRequest;await new Promise((a,o)=>{i.upload.addEventListener("progress",r=>{r.lengthComputable&&(n.progress=Math.round(r.loaded/r.total*100),t())}),i.addEventListener("load",()=>{i.status>=200&&i.status<300?(n.status="completed",n.progress=100,a()):(n.status="error",n.error="Upload failed",o(new Error("Upload failed")))}),i.addEventListener("error",()=>{n.status="error",n.error="Network error",o(new Error("Network error"))}),i.open("POST","/api/upload"),i.send(s)})}catch{n.status="error"}t()}}function VS(e){return e.startsWith("image/")?"🖼️":e.startsWith("video/")?"🎥":e.startsWith("audio/")?"🎵":e.includes("pdf")?"📄":e.includes("word")||e.includes("document")?"📝":e.includes("sheet")||e.includes("excel")?"📊":e.includes("presentation")||e.includes("powerpoint")?"📽️":e.includes("zip")||e.includes("archive")?"📦":e.includes("text")?"📃":"📁"}function Lo(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const TC=Object.freeze(Object.defineProperty({__proto__:null,showFileUploadModal:Zr},Symbol.toStringTag,{value:"Module"})),eo="developer-modal";function Gr(){const e=document.querySelector(`[data-modal-id="${eo}"]`);e&&e.remove();const t=_("div",{className:"developer-modal-content"});let n="info";function s(){t.innerHTML=`
      <div class="dev-tabs">
        <button class="dev-tab ${n==="info"?"active":""}" data-tab="info">Info</button>
        <button class="dev-tab ${n==="logs"?"active":""}" data-tab="logs">Logs</button>
        <button class="dev-tab ${n==="cache"?"active":""}" data-tab="cache">Cache</button>
        <button class="dev-tab ${n==="api"?"active":""}" data-tab="api">API Test</button>
      </div>
      <div class="dev-content">
        ${ZS(n)}
      </div>
    `,t.querySelectorAll(".dev-tab").forEach(r=>{u(r,"click",()=>{n=r.getAttribute("data-tab"),s()})}),JS(t)}s();const i=_("div",{className:"modal-footer"}),a=_("button",{className:"btn btn-secondary",textContent:"Close"});u(a,"click",()=>U(eo)),i.appendChild(a);const o=Me({id:eo,title:"Developer Tools",content:t,size:"lg",footer:i});document.body.appendChild(o),qe(eo)}function ZS(e){switch(e){case"info":return GS();case"logs":return WS();case"cache":return QS();case"api":return KS()}}function GS(){const e=z.getState(),t=ce.getState(),n=He.getState();return`
    <div class="dev-section">
      <h4>Application State</h4>
      <pre class="code-block">${JSON.stringify({projectId:e.currentProjectId,user:e.currentUser?.email,authConfigured:e.authConfigured},null,2)}</pre>
    </div>
    
    <div class="dev-section">
      <h4>Data Counts</h4>
      <table class="dev-table">
        <tr><td>Questions</td><td>${t.questions.length}</td></tr>
        <tr><td>Risks</td><td>${t.risks.length}</td></tr>
        <tr><td>Actions</td><td>${t.actions.length}</td></tr>
        <tr><td>Decisions</td><td>${t.decisions.length}</td></tr>
        <tr><td>Contacts</td><td>${t.contacts.length}</td></tr>
        <tr><td>Chat Messages</td><td>${t.chatHistory.length}</td></tr>
      </table>
    </div>
    
    <div class="dev-section">
      <h4>UI State</h4>
      <pre class="code-block">${JSON.stringify({currentTab:n.currentTab,sotView:n.sotCurrentView,sidebarOpen:n.sidebarOpen,modalOpen:n.modalOpen},null,2)}</pre>
    </div>
    
    <div class="dev-section">
      <h4>Environment</h4>
      <table class="dev-table">
        <tr><td>User Agent</td><td>${navigator.userAgent.slice(0,50)}...</td></tr>
        <tr><td>Screen</td><td>${window.innerWidth}x${window.innerHeight}</td></tr>
        <tr><td>Theme</td><td>${document.documentElement.getAttribute("data-theme")}</td></tr>
      </table>
    </div>
  `}function WS(){return`
    <div class="dev-section">
      <h4>Console Logs</h4>
      <p class="text-muted">Open browser DevTools (F12) to view console logs.</p>
      <div class="dev-actions">
        <button class="btn btn-secondary btn-sm" data-action="clear-console">Clear Console</button>
        <button class="btn btn-secondary btn-sm" data-action="log-state">Log State</button>
      </div>
    </div>
    
    <div class="dev-section">
      <h4>Performance</h4>
      <table class="dev-table">
        <tr><td>Page Load</td><td>${Math.round(performance.now())}ms</td></tr>
        <tr><td>Memory</td><td>${XS()}</td></tr>
      </table>
    </div>
  `}function QS(){const e=Object.keys(localStorage),t=e.reduce((n,s)=>n+(localStorage.getItem(s)?.length||0),0);return`
    <div class="dev-section">
      <h4>LocalStorage</h4>
      <p>Items: ${e.length} | Size: ${lr(t*2)}</p>
      <div class="dev-actions">
        <button class="btn btn-danger btn-sm" data-action="clear-storage">Clear All Storage</button>
        <button class="btn btn-secondary btn-sm" data-action="export-storage">Export Storage</button>
      </div>
      <div class="storage-list">
        ${e.map(n=>`
          <div class="storage-item">
            <span class="storage-key">${n}</span>
            <span class="storage-size">${lr((localStorage.getItem(n)?.length||0)*2)}</span>
            <button class="btn-sm btn-danger" data-action="delete-key" data-key="${n}">×</button>
          </div>
        `).join("")}
      </div>
    </div>
  `}function KS(){return`
    <div class="dev-section">
      <h4>API Test</h4>
      <div class="form-group">
        <label>Endpoint</label>
        <div class="input-group">
          <select id="api-method" class="form-control api-method-select">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input type="text" id="api-endpoint" class="form-control" value="/api/health" placeholder="/api/...">
        </div>
      </div>
      <div class="form-group">
        <label>Body (JSON)</label>
        <textarea id="api-body" class="form-control" rows="3" placeholder='{"key": "value"}'></textarea>
      </div>
      <button class="btn btn-primary" data-action="test-api">Send Request</button>
    </div>
    
    <div class="dev-section">
      <h4>Response</h4>
      <pre id="api-response" class="code-block">No request sent yet</pre>
    </div>
  `}function JS(e){e.querySelectorAll("[data-action]").forEach(t=>{const n=t.getAttribute("data-action");u(t,"click",async()=>{switch(n){case"clear-console":console.clear(),h.success("Console cleared");break;case"log-state":console.group("Application State"),console.log("App:",z.getState()),console.log("Data:",ce.getState()),console.log("UI:",He.getState()),console.groupEnd(),h.success("State logged to console");break;case"clear-storage":localStorage.clear(),h.success("Storage cleared"),location.reload();break;case"export-storage":const s={...localStorage},i=new Blob([JSON.stringify(s,null,2)],{type:"application/json"}),a=URL.createObjectURL(i),o=document.createElement("a");o.href=a,o.download="localstorage-backup.json",o.click(),h.success("Storage exported");break;case"delete-key":const r=t.getAttribute("data-key");r&&(localStorage.removeItem(r),h.success(`Removed: ${r}`),Gr());break;case"test-api":await YS(e);break}})})}async function YS(e){const t=e.querySelector("#api-method").value,n=e.querySelector("#api-endpoint").value,s=e.querySelector("#api-body").value,i=e.querySelector("#api-response");i.textContent="Loading...";try{const a={method:t};s&&t!=="GET"&&(a.body=s,a.headers={"Content-Type":"application/json"});const o=performance.now(),r=await kt(n,a),c=Math.round(performance.now()-o),l=await r.json().catch(()=>r.text());i.textContent=`Status: ${r.status} (${c}ms)

${JSON.stringify(l,null,2)}`}catch(a){i.textContent=`Error: ${a instanceof Error?a.message:"Unknown error"}`}}function XS(){const e=performance;return e.memory?lr(e.memory.usedJSHeapSize):"N/A"}function lr(e){if(e===0)return"0 B";const t=1024,n=["B","KB","MB","GB"],s=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/Math.pow(t,s)).toFixed(1))+" "+n[s]}const to="shortcuts-modal",e_=[{title:"General",shortcuts:[{keys:["Ctrl","Z"],description:"Undo last action"},{keys:["Ctrl","Shift","Z"],description:"Redo"},{keys:["Ctrl","S"],description:"Save current item"},{keys:["Esc"],description:"Close modal / Cancel"},{keys:["?"],description:"Show this help"}]},{title:"Navigation",shortcuts:[{keys:["Ctrl","1"],description:"Go to Dashboard"},{keys:["Ctrl","2"],description:"Go to Chat"},{keys:["Ctrl","3"],description:"Go to Source of Truth"},{keys:["Ctrl","4"],description:"Go to Timeline"},{keys:["Ctrl","5"],description:"Go to Contacts"}]},{title:"Actions",shortcuts:[{keys:["Ctrl","K"],description:"Quick search"},{keys:["Ctrl","N"],description:"New item"},{keys:["Ctrl","E"],description:"Export data"},{keys:["Ctrl","Shift","T"],description:"Toggle theme"}]},{title:"Chat",shortcuts:[{keys:["Enter"],description:"Send message"},{keys:["Shift","Enter"],description:"New line"},{keys:["↑"],description:"Previous message"}]}];function bp(){const e=document.querySelector(`[data-modal-id="${to}"]`);e&&e.remove();const t=_("div",{className:"shortcuts-modal-content"}),n=Ut.getAll();t.innerHTML=`
    <div class="shortcuts-grid">
      ${e_.map(o=>`
        <div class="shortcut-group">
          <h4>${o.title}</h4>
          <div class="shortcut-list">
            ${o.shortcuts.map(r=>`
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  ${r.keys.map(c=>`<kbd>${c}</kbd>`).join(" + ")}
                </div>
                <div class="shortcut-desc">${r.description}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    
    ${n.length>0?`
      <div class="shortcuts-custom">
        <h4>Active Shortcuts</h4>
        <div class="shortcut-list">
          ${n.map(o=>{const r=[];return o.ctrl&&r.push("Ctrl"),o.shift&&r.push("Shift"),o.alt&&r.push("Alt"),o.meta&&r.push("Cmd"),r.push(o.key.toUpperCase()),`
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  ${r.map(c=>`<kbd>${c}</kbd>`).join(" + ")}
                </div>
                <div class="shortcut-desc">${o.description}</div>
              </div>
            `}).join("")}
        </div>
      </div>
    `:""}
    
    <div class="shortcuts-tip">
      <p class="text-muted">
        💡 Tip: Most shortcuts use Ctrl on Windows/Linux or Cmd on Mac.
      </p>
    </div>
  `;const s=_("div",{className:"modal-footer"}),i=_("button",{className:"btn btn-primary",textContent:"Got it"});u(i,"click",()=>U(to)),s.appendChild(i);const a=Me({id:to,title:"Keyboard Shortcuts",content:t,size:"lg",footer:s});document.body.appendChild(a),qe(to)}const di="notifications-modal";let is=[],ws="all";async function t_(e={}){ws="all";const t=document.querySelector(`[data-modal-id="${di}"]`);t&&t.remove();const n=_("div",{className:"notifications-modal-content"});n.innerHTML='<div class="loading">Loading notifications...</div>';const s=_("div",{className:"modal-footer"}),i=_("button",{className:"btn btn-secondary",textContent:"Mark All Read"}),a=_("button",{className:"btn btn-primary",textContent:"Close"});u(i,"click",async()=>{try{await p.post("/api/notifications/mark-all-read"),is.forEach(c=>c.read=!0),r(),h.success("All marked as read"),e.onMarkAllRead?.()}catch{}}),u(a,"click",()=>U(di)),s.appendChild(i),s.appendChild(a);const o=Me({id:di,title:"Notifications",content:n,size:"md",footer:s});document.body.appendChild(o),qe(di);try{is=(await p.get("/api/notifications")).data,r()}catch{n.innerHTML='<div class="error">Failed to load notifications</div>'}function r(){const c=ws==="unread"?is.filter(d=>!d.read):is,l=is.filter(d=>!d.read).length;n.innerHTML=`
      <div class="notifications-header">
        <div class="filter-tabs">
          <button class="filter-tab ${ws==="all"?"active":""}" data-filter="all">
            All (${is.length})
          </button>
          <button class="filter-tab ${ws==="unread"?"active":""}" data-filter="unread">
            Unread (${l})
          </button>
        </div>
      </div>
      
      ${c.length===0?`
        <div class="empty-state">
          <span class="empty-icon">🔔</span>
          <p>${ws==="unread"?"No unread notifications":"No notifications yet"}</p>
        </div>
      `:`
        <div class="notifications-list">
          ${c.map(d=>n_(d)).join("")}
        </div>
      `}
    `,n.querySelectorAll(".filter-tab").forEach(d=>{u(d,"click",()=>{ws=d.getAttribute("data-filter"),r()})}),n.querySelectorAll(".notification-item").forEach(d=>{const m=d.getAttribute("data-notification-id"),f=is.find(g=>g.id===m);f&&u(d,"click",async()=>{if(!f.read)try{await p.patch(`/api/notifications/${m}/read`),f.read=!0,ds(d,"unread")}catch{}e.onNotificationClick?.(f),f.link&&U(di)})})}}function n_(e){const t=s_(e.type);return`
    <div class="notification-item ${e.read?"":"unread"}" 
         data-notification-id="${e.id}">
      <div class="notification-icon ${e.type}">${t}</div>
      <div class="notification-content">
        <div class="notification-title">${Ca(e.title)}</div>
        <div class="notification-message">${Ca(e.message)}</div>
        <div class="notification-meta">
          ${e.actor?`<span class="notification-actor">${Ca(e.actor.name)}</span> • `:""}
          <span class="notification-time">${Ee(e.createdAt)}</span>
        </div>
      </div>
      ${e.read?"":'<div class="notification-dot"></div>'}
    </div>
  `}function s_(e){switch(e){case"info":return"ℹ️";case"success":return"✅";case"warning":return"⚠️";case"error":return"❌";case"mention":return"💬";case"update":return"🔄";default:return"🔔"}}function Ca(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const os="email-modal";function yp(e){const{mode:t,email:n,onSend:s}=e,i=document.querySelector(`[data-modal-id="${os}"]`);i&&i.remove();const a=_("div",{className:"email-modal-content"});if(t==="view"&&n)a.innerHTML=`
      <div class="email-view">
        <div class="email-header">
          <div class="email-subject">${Xt(n.subject)}</div>
          <div class="email-meta">
            <div class="email-from">
              <strong>${Xt(n.from.name)}</strong>
              <span class="text-muted">&lt;${Xt(n.from.email)}&gt;</span>
            </div>
            <div class="email-to">
              To: ${n.to.map(c=>Xt(c.name||c.email)).join(", ")}
            </div>
            ${n.cc?.length?`
              <div class="email-cc">
                Cc: ${n.cc.map(c=>Xt(c.name||c.email)).join(", ")}
              </div>
            `:""}
            <div class="email-date">${Ee(n.date)}</div>
          </div>
        </div>
        
        <div class="email-body">
          ${n.bodyHtml||Xt(n.body).replace(/\n/g,"<br>")}
        </div>
        
        ${n.attachments?.length?`
          <div class="email-attachments">
            <h4>Attachments (${n.attachments.length})</h4>
            <div class="attachments-list">
              ${n.attachments.map(c=>`
                <div class="attachment-item">
                  <span class="attachment-icon">📎</span>
                  <span class="attachment-name">${Xt(c.name)}</span>
                  <span class="attachment-size">${i_(c.size)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `:""}
        
        ${n.thread?.length?`
          <div class="email-thread">
            <h4>Thread (${n.thread.length} messages)</h4>
            ${n.thread.map(c=>`
              <div class="thread-message">
                <div class="thread-header">
                  <strong>${Xt(c.from.name)}</strong>
                  <span>${Ee(c.date)}</span>
                </div>
                <div class="thread-preview">${Xt(c.body.slice(0,100))}...</div>
              </div>
            `).join("")}
          </div>
        `:""}
      </div>
    `;else{const c=t==="reply"&&n,l=c?n.from.email:"",d=c?`Re: ${n.subject}`:"";a.innerHTML=`
      <form id="email-form" class="email-form">
        <div class="form-group">
          <label for="email-to">To *</label>
          <input type="text" id="email-to" required 
                 value="${l}" 
                 placeholder="recipient@example.com">
        </div>
        
        <div class="form-group">
          <label for="email-cc">Cc</label>
          <input type="text" id="email-cc" 
                 placeholder="cc@example.com">
        </div>
        
        <div class="form-group">
          <label for="email-subject">Subject *</label>
          <input type="text" id="email-subject" required 
                 value="${Xt(d)}" 
                 placeholder="Email subject">
        </div>
        
        <div class="form-group">
          <label for="email-body">Message *</label>
          <textarea id="email-body" rows="10" required 
                    placeholder="Write your message...">${c?`

---
On ${n.date}, ${n.from.name} wrote:
${n.body}`:""}</textarea>
        </div>
        
        <div class="form-group">
          <label>Attachments</label>
          <div class="attachment-dropzone" id="attachment-zone">
            <span>Drop files here or click to attach</span>
            <input type="file" id="attachment-input" multiple hidden>
          </div>
          <div id="attachments-preview"></div>
        </div>
      </form>
    `,setTimeout(()=>{const m=a.querySelector("#attachment-zone"),f=a.querySelector("#attachment-input");m&&f&&(u(m,"click",()=>f.click()),u(f,"change",()=>{if(f.files){const g=a.querySelector("#attachments-preview");g.innerHTML=Array.from(f.files).map(v=>`<div class="attachment-item">${Xt(v.name)}</div>`).join("")}}))},0)}const o=_("div",{className:"modal-footer"});if(t==="view"){const c=_("button",{className:"btn btn-primary",textContent:"Reply"}),l=_("button",{className:"btn btn-secondary",textContent:"Forward"}),d=_("button",{className:"btn btn-secondary",textContent:"Close"});u(c,"click",()=>{U(os),yp({...e,mode:"reply"})}),u(l,"click",()=>{h.info("Forward not implemented")}),u(d,"click",()=>U(os)),o.appendChild(d),o.appendChild(l),o.appendChild(c)}else{const c=_("button",{className:"btn btn-secondary",textContent:"Cancel"}),l=_("button",{className:"btn btn-primary",textContent:"Send"});u(c,"click",()=>U(os)),u(l,"click",async()=>{const d=a.querySelector("#email-form");if(!d.checkValidity()){d.reportValidity();return}const m=a.querySelector("#email-to").value,f=a.querySelector("#email-cc").value,g=a.querySelector("#email-subject").value,v=a.querySelector("#email-body").value,y={to:m.split(",").map(S=>({name:"",email:S.trim()})),cc:f?f.split(",").map(S=>({name:"",email:S.trim()})):void 0,subject:g,body:v};l.disabled=!0,l.textContent="Sending...";try{s?await s(y):await p.post("/api/emails/send",y),h.success("Email sent"),U(os)}catch{}finally{l.disabled=!1,l.textContent="Send"}}),o.appendChild(c),o.appendChild(l)}const r=Me({id:os,title:t==="view"?"Email":t==="reply"?"Reply":"Compose Email",content:a,size:"lg",footer:o});document.body.appendChild(r),qe(os)}function i_(e){if(e===0)return"0 B";const t=1024,n=["B","KB","MB"],s=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/Math.pow(t,s)).toFixed(1))+" "+n[s]}function Xt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const ut={charts:new Map,networks:new Map,activeChart:null},dr=new Set;function Gs(){dr.forEach(e=>e())}function o_(e,t,n,s){ut.charts.set(e,{id:e,chart:t,container:n,type:s}),Gs()}function a_(e){return ut.charts.get(e)?.chart??null}function r_(e){const t=ut.charts.get(e);t?.chart&&t.chart.destroy(),ut.charts.delete(e),Gs()}function c_(e,t){const n=ut.charts.get(e);n?.chart&&(n.chart.data=t,n.chart.update())}function l_(e,t,n){ut.networks.set(e,{id:e,network:t,container:n}),Gs()}function d_(e){return ut.networks.get(e)?.network??null}function u_(e){const t=ut.networks.get(e);t?.network&&typeof t.network.destroy=="function"&&t.network.destroy(),ut.networks.delete(e),Gs()}function p_(e){ut.activeChart=e,Gs()}function m_(){return Array.from(ut.charts.keys())}function g_(){return Array.from(ut.networks.keys())}function f_(){ut.charts.forEach(e=>{e.chart&&e.chart.destroy()}),ut.networks.forEach(e=>{e.network&&typeof e.network.destroy=="function"&&e.network.destroy()}),ut.charts.clear(),ut.networks.clear(),ut.activeChart=null,Gs()}function h_(e){return dr.add(e),()=>dr.delete(e)}const Xn={registerChart:o_,getChart:a_,destroyChart:r_,updateChartData:c_,registerNetwork:l_,getNetwork:d_,destroyNetwork:u_,setActiveChart:p_,getChartIds:m_,getNetworkIds:g_,destroyAll:f_,subscribe:h_},no="graph-modal";function v_(e){const{title:t="Graph View",nodes:n,edges:s,onNodeClick:i,onEdgeClick:a}=e,o=document.querySelector(`[data-modal-id="${no}"]`);o&&o.remove();const r=_("div",{className:"graph-modal-content"});r.innerHTML=`
    <div class="graph-toolbar">
      <div class="graph-info">
        <span>Nodes: ${n.length}</span>
        <span>Edges: ${s.length}</span>
      </div>
      <div class="graph-controls">
        <button class="btn btn-sm btn-secondary" data-action="zoom-in" title="Zoom In">+</button>
        <button class="btn btn-sm btn-secondary" data-action="zoom-out" title="Zoom Out">−</button>
        <button class="btn btn-sm btn-secondary" data-action="fit" title="Fit to View">⊡</button>
        <button class="btn btn-sm btn-secondary" data-action="fullscreen" title="Fullscreen">⛶</button>
      </div>
    </div>
    <div id="graph-container" class="graph-container">
      <div class="graph-placeholder">
        <p>Loading graph visualization...</p>
        <p class="text-muted">Requires vis-network library</p>
      </div>
    </div>
    <div class="graph-legend">
      ${w_(n).map(f=>`
        <span class="legend-item">
          <span class="legend-color" style="--legend-color: ${wp(f)}"></span>
          ${f}
        </span>
      `).join("")}
    </div>
  `;const c=_("div",{className:"modal-footer"}),l=_("button",{className:"btn btn-secondary",textContent:"Export Image"}),d=_("button",{className:"btn btn-primary",textContent:"Close"});u(l,"click",()=>{const f=r.querySelector("canvas");if(f){const g=document.createElement("a");g.download="graph.png",g.href=f.toDataURL(),g.click()}else h.warning("Graph not rendered")}),u(d,"click",()=>{Xn.destroyNetwork("modal-graph"),U(no)}),c.appendChild(l),c.appendChild(d);const m=Me({id:no,title:t,content:r,size:"xl",footer:c});document.body.appendChild(m),qe(no),setTimeout(()=>{b_(r,n,s,i,a),y_(r)},100)}function b_(e,t,n,s,i){const a=e.querySelector("#graph-container");if(typeof window.vis>"u"){a.innerHTML=`
      <div class="graph-fallback">
        <h4>Graph Data</h4>
        <div class="graph-data">
          <strong>Nodes (${t.length}):</strong>
          <ul>${t.slice(0,10).map(m=>`<li>${m.label} (${m.type||"default"})</li>`).join("")}</ul>
          ${t.length>10?`<p class="text-muted">...and ${t.length-10} more</p>`:""}
        </div>
        <div class="graph-data">
          <strong>Edges (${n.length}):</strong>
          <ul>${n.slice(0,10).map(m=>`<li>${m.from} → ${m.to}${m.label?` (${m.label})`:""}</li>`).join("")}</ul>
          ${n.length>10?`<p class="text-muted">...and ${n.length-10} more</p>`:""}
        </div>
        <p class="text-muted"><em>vis-network library not loaded</em></p>
      </div>
    `;return}const o=window.vis,r=new o.DataSet(t.map(m=>({id:m.id,label:m.label,color:m.color||wp(m.type),size:m.size||20}))),c=new o.DataSet(n.map(m=>({id:m.id,from:m.from,to:m.to,label:m.label,color:m.color}))),l={nodes:{shape:"dot",font:{color:"#eaeaea",size:12},borderWidth:2},edges:{arrows:"to",color:{color:"#2a2a4a",highlight:"#e94560"},font:{color:"#a0a0a0",size:10}},physics:{enabled:!0,stabilization:{iterations:100}},interaction:{hover:!0,tooltipDelay:200}};a.innerHTML="";const d=new o.Network(a,{nodes:r,edges:c},l);Xn.registerNetwork("modal-graph",d,"#graph-container"),s&&d.on("click",m=>{if(m.nodes.length>0){const f=t.find(g=>g.id===m.nodes[0]);f&&s(f)}}),i&&d.on("click",m=>{if(m.edges.length>0){const f=n.find(g=>g.id===m.edges[0]);f&&i(f)}})}function y_(e){const t=Xn.getNetwork("modal-graph");t&&e.querySelectorAll("[data-action]").forEach(n=>{u(n,"click",()=>{switch(n.getAttribute("data-action")){case"zoom-in":t.moveTo?.({scale:1.2});break;case"zoom-out":t.moveTo?.({scale:.8});break;case"fit":t.fit?.();break;case"fullscreen":const i=e.querySelector(".graph-container");i&&i.requestFullscreen?.();break}})})}function w_(e){const t=new Set(e.map(n=>n.type||"default"));return Array.from(t)}function wp(e){const t={person:"#4ecdc4",organization:"#e94560",document:"#ffe66d",event:"#ff6b6b",location:"#45b7d1",default:"#a0a0a0"};return t[e||"default"]||t.default}const so="history-modal";let Ms=[],ur=1,To=!0,La=!1;async function k_(e={}){const{entityType:t,entityId:n,title:s="History",onRestore:i}=e;Ms=[],ur=1,To=!0;const a=document.querySelector(`[data-modal-id="${so}"]`);a&&a.remove();const o=_("div",{className:"history-modal-content"});o.innerHTML='<div class="loading">Loading history...</div>';const r=_("div",{className:"modal-footer"}),c=_("button",{className:"btn btn-primary",textContent:"Close"});u(c,"click",()=>U(so)),r.appendChild(c);const l=Me({id:so,title:s,content:o,size:"lg",footer:r});document.body.appendChild(l),qe(so),await kp(o,t,n,i)}async function kp(e,t,n,s){if(!(La||!To)){La=!0;try{const i=new URLSearchParams({page:String(ur),limit:"20"});t&&i.set("entityType",t),n&&i.set("entityId",n);const a=await p.get(`/api/history?${i}`);Ms=[...Ms,...a.data.entries],To=a.data.hasMore,ur++,x_(e,s)}catch{e.innerHTML='<div class="error">Failed to load history</div>'}finally{La=!1}}}function x_(e,t){if(Ms.length===0){e.innerHTML=`
      <div class="empty-state">
        <span class="empty-icon">📜</span>
        <p>No history entries</p>
      </div>
    `;return}const n=S_(Ms);e.innerHTML=`
    <div class="history-timeline">
      ${Object.entries(n).map(([i,a])=>`
        <div class="history-date-group">
          <div class="history-date">${i}</div>
          ${a.map(o=>$_(o)).join("")}
        </div>
      `).join("")}
    </div>
    ${To?`
      <div class="history-load-more">
        <button class="btn btn-secondary" data-action="load-more">Load More</button>
      </div>
    `:""}
  `;const s=e.querySelector('[data-action="load-more"]');s&&u(s,"click",async()=>{await kp(e,void 0,void 0,t)}),t&&e.querySelectorAll('[data-action="restore"]').forEach(i=>{u(i,"click",async()=>{const a=i.getAttribute("data-entry-id"),o=Ms.find(r=>r.id===a);if(o){const{confirm:r}=await ve(async()=>{const{confirm:l}=await Promise.resolve().then(()=>vn);return{confirm:l}},void 0);await r("Are you sure you want to restore this version?",{title:"Restore",confirmText:"Restore"})&&t(o)}})}),e.querySelectorAll('[data-action="expand"]').forEach(i=>{u(i,"click",()=>{const a=i.closest(".history-entry")?.querySelector(".history-changes");a&&(a.classList.toggle("expanded"),i.textContent=a.classList.contains("expanded")?"Hide details":"Show details")})})}function $_(e){const t={create:"➕",update:"✏️",delete:"🗑️",restore:"↩️"},n={create:"success",update:"info",delete:"danger",restore:"warning"},s=e.changes&&Object.keys(e.changes).length>0;return`
    <div class="history-entry ${n[e.action]}" data-entry-id="${e.id}">
      <div class="history-icon">${t[e.action]}</div>
      <div class="history-content">
        <div class="history-summary">
          <strong>${e.actor.name}</strong>
          ${e.action}d
          <span class="entity-type">${e.entityType}</span>
          ${e.entityName?`"${__(e.entityName)}"`:""}
        </div>
        <div class="history-time">${Ee(e.timestamp)}</div>
        
        ${s?`
          <div class="history-changes">
            ${Object.entries(e.changes).map(([i,a])=>`
              <div class="change-item">
                <span class="change-field">${i}:</span>
                <span class="change-old">${Rl(a.old)}</span>
                <span class="change-arrow">→</span>
                <span class="change-new">${Rl(a.new)}</span>
              </div>
            `).join("")}
          </div>
          <button class="btn-link" data-action="expand">Show details</button>
        `:""}
        
        ${e.action==="delete"?`
          <button class="btn btn-sm btn-secondary" data-action="restore" data-entry-id="${e.id}">
            Restore
          </button>
        `:""}
      </div>
    </div>
  `}function S_(e){const t={};return e.forEach(n=>{const s=new Date(n.timestamp).toLocaleDateString();t[s]||(t[s]=[]),t[s].push(n)}),t}function Rl(e){return e==null?"(empty)":typeof e=="object"?JSON.stringify(e):String(e)}function __(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const Ta="comment-modal";let ls=[];async function C_(e){const{entityType:t,entityId:n,entityName:s,onCommentAdded:i}=e;ls=[];const a=document.querySelector(`[data-modal-id="${Ta}"]`);a&&a.remove();const o=_("div",{className:"comment-modal-content"});o.innerHTML='<div class="loading">Loading comments...</div>';const r=_("div",{className:"modal-footer comment-footer"});r.innerHTML=`
    <div class="comment-input-wrapper">
      <textarea id="comment-input" placeholder="Write a comment..." rows="2"></textarea>
      <button id="submit-comment" class="btn btn-primary">Post</button>
    </div>
  `;const c=Me({id:Ta,title:s?`Comments on "${s}"`:"Comments",content:o,size:"md",footer:r});document.body.appendChild(c),qe(Ta);const l=r.querySelector("#submit-comment"),d=r.querySelector("#comment-input");u(l,"click",async()=>{const m=d.value.trim();if(!m){h.warning("Please write a comment");return}l.disabled=!0,l.textContent="Posting...";try{const f=await p.post(`/api/${t}/${n}/comments`,{content:m});ls.unshift(f.data),d.value="",Ti(o,e),i?.(f.data),h.success("Comment added")}catch{}finally{l.disabled=!1,l.textContent="Post"}}),u(d,"keydown",m=>{m.key==="Enter"&&m.ctrlKey&&l.click()});try{ls=(await p.get(`/api/${t}/${n}/comments`)).data,Ti(o,e)}catch{o.innerHTML='<div class="error">Failed to load comments</div>'}}function Ti(e,t){if(ls.length===0){e.innerHTML=`
      <div class="empty-state">
        <span class="empty-icon">💬</span>
        <p>No comments yet</p>
        <p class="text-muted">Be the first to comment!</p>
      </div>
    `;return}e.innerHTML=`
    <div class="comments-list">
      ${ls.map(n=>xp(n,t)).join("")}
    </div>
  `,L_(e,t)}function xp(e,t,n=0){const i=z.getState().currentUser?.id===e.author.id,a=e.author.name.split(" ").map(o=>o[0]).join("").toUpperCase().slice(0,2);return`
    <div class="comment ${n>0?"reply":""}" data-comment-id="${e.id}" style="--reply-offset: ${n*20}px">
      <div class="comment-avatar">
        ${e.author.avatar?`<img src="${e.author.avatar}" alt="${co(e.author.name)}">`:a}
      </div>
      <div class="comment-body">
        <div class="comment-header">
          <strong class="comment-author">${co(e.author.name)}</strong>
          <span class="comment-time">${Ee(e.createdAt)}</span>
          ${e.edited?'<span class="comment-edited">(edited)</span>':""}
        </div>
        <div class="comment-content">${co(e.content)}</div>
        <div class="comment-actions">
          <button class="btn-link" data-action="reply" data-comment-id="${e.id}">Reply</button>
          ${i?`
            <button class="btn-link" data-action="edit" data-comment-id="${e.id}">Edit</button>
            <button class="btn-link text-danger" data-action="delete" data-comment-id="${e.id}">Delete</button>
          `:""}
        </div>
      </div>
    </div>
    ${e.replies?.map(o=>xp(o,t,n+1)).join("")||""}
  `}function L_(e,t){e.querySelectorAll("[data-action]").forEach(n=>{const s=n.getAttribute("data-action"),i=n.getAttribute("data-comment-id");u(n,"click",async()=>{const a=$p(ls,i);if(a)switch(s){case"reply":const o=n.closest(".comment")?.querySelector(".comment-body");if(o&&!o.querySelector(".reply-input")){const d=_("div",{className:"reply-input"});d.innerHTML=`
              <textarea placeholder="Write a reply..." rows="2"></textarea>
              <div class="reply-actions">
                <button class="btn btn-sm btn-secondary cancel-reply">Cancel</button>
                <button class="btn btn-sm btn-primary submit-reply">Reply</button>
              </div>
            `,o.appendChild(d);const m=d.querySelector(".cancel-reply"),f=d.querySelector(".submit-reply"),g=d.querySelector("textarea");u(m,"click",()=>d.remove()),u(f,"click",async()=>{const v=g.value.trim();if(v)try{const y=await p.post(`/api/${t.entityType}/${t.entityId}/comments/${i}/replies`,{content:v});a.replies||(a.replies=[]),a.replies.push(y.data),Ti(e,t)}catch{}}),g.focus()}break;case"edit":const r=n.closest(".comment")?.querySelector(".comment-content");if(r){const d=a.content;r.innerHTML=`
              <textarea class="edit-textarea">${co(d)}</textarea>
              <div class="edit-actions">
                <button class="btn btn-sm btn-secondary cancel-edit">Cancel</button>
                <button class="btn btn-sm btn-primary save-edit">Save</button>
              </div>
            `;const m=r.querySelector("textarea"),f=r.querySelector(".cancel-edit"),g=r.querySelector(".save-edit");u(f,"click",()=>{r.textContent=d}),u(g,"click",async()=>{const v=m.value.trim();if(v)try{await p.patch(`/api/${t.entityType}/${t.entityId}/comments/${i}`,{content:v}),a.content=v,a.edited=!0,Ti(e,t)}catch{}}),m.focus()}break;case"delete":const{confirm:c}=await ve(async()=>{const{confirm:d}=await Promise.resolve().then(()=>vn);return{confirm:d}},void 0);if(await c("Delete this comment?",{title:"Delete Comment",confirmText:"Delete",confirmClass:"btn-danger"}))try{await p.delete(`/api/${t.entityType}/${t.entityId}/comments/${i}`),Sp(ls,i),Ti(e,t),h.success("Comment deleted")}catch{}break}})})}function $p(e,t){for(const n of e){if(n.id===t)return n;if(n.replies){const s=$p(n.replies,t);if(s)return s}}}function Sp(e,t){const n=e.findIndex(s=>s.id===t);if(n!==-1)return e.splice(n,1),!0;for(const s of e)if(s.replies&&Sp(s.replies,t))return!0;return!1}function co(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const ms="profile-modal";let pr={},un=null,bi=null;function _p(e={}){pr=e;const t=Cp(),n=Me({id:ms,title:"",size:"lg",content:t,onClose:e.onClose});n.classList.add("profile-modal-overlay");const s=n.querySelector(".modal-content");s&&s.classList.add("profile-modal-content");const i=n.querySelector(".modal-header");i&&i.classList.add("hidden"),document.body.appendChild(n),qe(ms),Lp(t)}function Cp(){const e=_("div",{className:"profile-modal-sota"});return e.innerHTML=`
    <style>
      .profile-modal-sota {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .profile-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.8),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        overflow: hidden;
      }
      
      [data-theme="dark"] .profile-card {
        background: linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%);
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }
      
      .profile-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 32px;
        position: relative;
        overflow: hidden;
      }
      
      .profile-header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      
      .profile-header-content {
        display: flex;
        align-items: center;
        gap: 24px;
        position: relative;
        z-index: 1;
      }
      
      .profile-avatar-large {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: 600;
        color: white;
        border: 4px solid rgba(255,255,255,0.3);
        overflow: hidden;
        flex-shrink: 0;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .profile-avatar-large:hover {
        border-color: rgba(255,255,255,0.5);
        transform: scale(1.05);
      }
      
      .profile-avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .avatar-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
        border-radius: 50%;
      }
      
      .profile-avatar-large:hover .avatar-overlay {
        opacity: 1;
      }
      
      .avatar-overlay svg {
        width: 28px;
        height: 28px;
        color: white;
      }
      
      .profile-user-info h2 {
        margin: 0 0 4px 0;
        font-size: 28px;
        font-weight: 700;
        color: white;
      }
      
      .profile-user-info .email {
        color: rgba(255,255,255,0.8);
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .profile-user-info .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255,255,255,0.2);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: white;
      }
      
      .profile-close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 10;
      }
      
      .profile-close-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: rotate(90deg);
      }
      
      .profile-close-btn svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      
      .profile-tabs-nav {
        display: flex;
        gap: 0;
        padding: 0 24px;
        background: rgba(0,0,0,0.02);
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      
      [data-theme="dark"] .profile-tabs-nav {
        background: rgba(255,255,255,0.02);
        border-bottom-color: rgba(255,255,255,0.06);
      }
      
      .profile-tab-btn {
        padding: 16px 24px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      }
      
      .profile-tab-btn:hover {
        color: #1e293b;
      }
      
      [data-theme="dark"] .profile-tab-btn:hover {
        color: #e2e8f0;
      }
      
      .profile-tab-btn.active {
        color: #e11d48;
      }
      
      .profile-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 24px;
        right: 24px;
        height: 2px;
        background: #e11d48;
        border-radius: 2px 2px 0 0;
      }
      
      .profile-tab-icon {
        width: 18px;
        height: 18px;
        margin-right: 8px;
        vertical-align: middle;
      }
      
      .profile-body {
        padding: 32px;
      }
      
      .profile-section {
        display: none;
      }
      
      .profile-section.active {
        display: block;
      }
      
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
      
      .form-grid .full-width {
        grid-column: 1 / -1;
      }
      
      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .form-field label {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      [data-theme="dark"] .form-field label {
        color: #94a3b8;
      }
      
      .form-field input,
      .form-field select,
      .form-field textarea {
        padding: 12px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        font-size: 14px;
        background: #f8fafc;
        color: #1e293b;
        transition: all 0.2s;
        outline: none;
      }
      
      [data-theme="dark"] .form-field input,
      [data-theme="dark"] .form-field select,
      [data-theme="dark"] .form-field textarea {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.1);
        color: #f1f5f9;
      }
      
      .form-field input:focus,
      .form-field select:focus,
      .form-field textarea:focus {
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }
      
      .form-field input:disabled {
        background: #f1f5f9;
        color: #94a3b8;
        cursor: not-allowed;
      }
      
      [data-theme="dark"] .form-field input:disabled {
        background: rgba(255,255,255,0.02);
        color: #64748b;
      }
      
      .form-field textarea {
        resize: vertical;
        min-height: 100px;
      }
      
      .form-hint {
        font-size: 12px;
        color: #94a3b8;
      }
      
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid rgba(0,0,0,0.06);
      }
      
      [data-theme="dark"] .form-actions {
        border-top-color: rgba(255,255,255,0.06);
      }
      
      .btn-sota {
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      
      .btn-sota.primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-sota.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
      
      .btn-sota.secondary {
        background: #f1f5f9;
        color: #475569;
      }
      
      [data-theme="dark"] .btn-sota.secondary {
        background: rgba(255,255,255,0.1);
        color: #e2e8f0;
      }
      
      .btn-sota.secondary:hover {
        background: #e2e8f0;
      }
      
      [data-theme="dark"] .btn-sota.secondary:hover {
        background: rgba(255,255,255,0.15);
      }
      
      .btn-sota.danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      .btn-sota.danger:hover {
        background: #fef2f2;
        border-color: #dc2626;
      }
      
      /* Security Section */
      .security-section {
        margin-bottom: 32px;
      }
      
      .security-section h3 {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      [data-theme="dark"] .security-section h3 {
        color: #f1f5f9;
      }
      
      .danger-zone {
        background: linear-gradient(135deg, #fef2f2 0%, #fff 100%);
        border: 1px solid #fecaca;
        border-radius: 16px;
        padding: 24px;
      }
      
      [data-theme="dark"] .danger-zone {
        background: linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(220,38,38,0.05) 100%);
        border-color: rgba(220,38,38,0.3);
      }
      
      .danger-zone h3 {
        color: #dc2626 !important;
      }
      
      .danger-zone p {
        color: #991b1b;
        font-size: 14px;
        margin: 0 0 16px 0;
      }
      
      [data-theme="dark"] .danger-zone p {
        color: #fca5a5;
      }
      
      /* Sessions */
      .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .session-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: #f8fafc;
        border-radius: 12px;
        border: 1px solid transparent;
      }
      
      [data-theme="dark"] .session-card {
        background: rgba(255,255,255,0.03);
      }
      
      .session-card.current {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
      }
      
      .session-info {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .session-icon {
        width: 44px;
        height: 44px;
        background: #e2e8f0;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      [data-theme="dark"] .session-icon {
        background: rgba(255,255,255,0.1);
      }
      
      .session-icon svg {
        width: 22px;
        height: 22px;
        color: #64748b;
      }
      
      .session-details h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      
      [data-theme="dark"] .session-details h4 {
        color: #f1f5f9;
      }
      
      .session-details p {
        margin: 0;
        font-size: 12px;
        color: #64748b;
      }
      
      .session-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
        background: #e11d48;
        color: white;
      }
      
      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: #94a3b8;
      }
      
      .empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .loading-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 48px;
      }
      
      .loading-spinner::after {
        content: '';
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #e11d48;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
    
    <div class="profile-card">
      <div class="loading-spinner"></div>
    </div>
  `,e}async function Lp(e,t){const n=e.querySelector(".profile-card");if(n)try{const[s,i]=await Promise.all([Cn.get(),E_()]);if(s)un=s,Aa(n,un,i,t);else{const a=z.getState().currentUser;a?(un={id:a.id,email:a.email,display_name:a.name||a.email?.split("@")[0]||"User",avatar_url:a.avatar,created_at:new Date().toISOString()},Aa(n,un,i,t)):n.innerHTML='<div class="empty-state">Please log in to view your profile</div>'}}catch{const s=z.getState().currentUser;s?(un={id:s.id,email:s.email,display_name:s.name||"User",avatar_url:s.avatar,created_at:new Date().toISOString()},Aa(n,un,void 0,t)):n.innerHTML='<div class="empty-state">Failed to load profile</div>'}}function Aa(e,t,n,s){A_(t.display_name||t.email);const a=z.getState().currentUser?.role||t.role||"user";e.innerHTML=`
    <!-- Header -->
    <div class="profile-header">
      <button class="profile-close-btn" id="close-profile-btn">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="profile-header-content">
        <label class="profile-avatar-large" for="avatar-input-hidden" id="profile-avatar-display">
          <img src="${t.avatar_url||Ai(t.display_name||t.email)}" alt="Avatar" onerror="this.src='${Ai(t.display_name||t.email)}'">
          <div class="avatar-overlay">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <input type="file" id="avatar-input-hidden" accept="image/*" hidden>
        </label>
        
        <div class="profile-user-info">
          <h2>${jt(t.display_name||t.username||"User")}</h2>
          <div class="email">
            ${jt(t.email)}
            <span class="role-badge">
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                ${a==="superadmin"?'<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>':'<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>'}
              </svg>
              ${a==="superadmin"?"Super Admin":"User"}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tabs Navigation -->
    <nav class="profile-tabs-nav">
      <button class="profile-tab-btn active" data-tab="general">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        General
      </button>
      <button class="profile-tab-btn" data-tab="security">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        Security
      </button>
      <button class="profile-tab-btn" data-tab="sessions">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        Sessions
      </button>
      <button class="profile-tab-btn" data-tab="integrations">
        <svg class="profile-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        Integrations
      </button>
    </nav>
    
    <!-- Tab Content -->
    <div class="profile-body">
      <!-- General Tab -->
      <div class="profile-section active" id="section-general">
        <form id="profile-form">
          <div class="form-grid">
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Email
              </label>
              <input type="email" value="${jt(t.email)}" disabled>
              <span class="form-hint">Email cannot be changed</span>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                </svg>
                Username
              </label>
              <input type="text" name="username" value="${jt(t.username||"")}" placeholder="Enter username">
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Display Name
              </label>
              <input type="text" name="display_name" value="${jt(t.display_name||"")}" placeholder="Your display name">
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
                Bio
              </label>
              <textarea name="bio" placeholder="Tell us a bit about yourself">${jt(t.bio||"")}</textarea>
            </div>
            
            <div class="form-field full-width">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Avatar URL
              </label>
              <input type="url" name="avatar_url" id="avatar-url-input" value="${jt(t.avatar_url||"")}" placeholder="https://example.com/avatar.jpg">
              <span class="form-hint">Enter an image URL or upload using the avatar above. Leave empty for auto-generated avatar.</span>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Timezone
              </label>
              <select name="timezone">
                ${M_(t.timezone,n)}
              </select>
            </div>
            
            <div class="form-field">
              <label>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                </svg>
                Language
              </label>
              <select name="locale">
                <option value="en" ${t.locale==="en"?"selected":""}>English</option>
                <option value="pt" ${t.locale==="pt"?"selected":""}>Português</option>
                <option value="es" ${t.locale==="es"?"selected":""}>Español</option>
                <option value="fr" ${t.locale==="fr"?"selected":""}>Français</option>
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-sota primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Save Changes
            </button>
          </div>
        </form>
      </div>
      
      <!-- Security Tab -->
      <div class="profile-section" id="section-security">
        <div class="security-section">
          <h3>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
            Change Password
          </h3>
          
          <form id="password-form">
            <div class="form-grid">
              <div class="form-field full-width">
                <label>Current Password</label>
                <input type="password" name="current_password" required>
              </div>
              
              <div class="form-field">
                <label>New Password</label>
                <input type="password" name="new_password" minlength="12" required>
                <span class="form-hint">Minimum 12 characters</span>
              </div>
              
              <div class="form-field">
                <label>Confirm Password</label>
                <input type="password" name="confirm_password" required>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-sota primary">Update Password</button>
            </div>
          </form>
        </div>
        
        <div class="danger-zone">
          <h3>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Danger Zone
          </h3>
          <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button type="button" class="btn-sota danger" id="delete-account-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete Account
          </button>
        </div>
      </div>
      
      <!-- Sessions Tab -->
      <div class="profile-section" id="section-sessions">
        <div id="sessions-list" class="sessions-list">
          <div class="loading-spinner"></div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-sota secondary" id="revoke-all-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign out all other sessions
          </button>
        </div>
      </div>
      
      <!-- Integrations Tab -->
      <div class="profile-section" id="section-integrations">
        <div class="security-section">
          <h3>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
            Krisp AI Meeting Assistant
          </h3>
          <p class="form-hint form-hint-mb">
            Connect your Krisp account to automatically import meeting transcriptions into GodMode.
          </p>
          
          <div id="krisp-integration-content">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    </div>
  `,T_(e,s)}function T_(e,t){const n=e.querySelector("#close-profile-btn");n&&u(n,"click",()=>{t?.onBack?t.onBack():(U(ms),pr.onClose?.())});const s=e.querySelectorAll(".profile-tab-btn");s.forEach(m=>{u(m,"click",()=>{s.forEach(g=>g.classList.remove("active")),m.classList.add("active");const f=m.getAttribute("data-tab");e.querySelectorAll(".profile-section").forEach(g=>{g.classList.toggle("active",g.id===`section-${f}`)}),f==="sessions"&&mr(),f==="integrations"&&yi(e)})});const i=e.querySelector("#avatar-input-hidden");i&&u(i,"change",async()=>{const m=i.files?.[0];if(m)try{const f=await Cn.uploadAvatar(m),g=e.querySelector(".profile-avatar-large");if(g){const v=g.querySelector("img");v?v.src=f:g.innerHTML=`
                <img src="${f}" alt="Avatar">
                <div class="avatar-overlay">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <input type="file" id="avatar-input-hidden" accept="image/*" hidden>
              `}h.success("Avatar updated")}catch{h.error("Failed to upload avatar")}});const a=e.querySelector("#avatar-url-input"),o=e.querySelector("#profile-avatar-display img");a&&o&&u(a,"input",()=>{const m=a.value.trim();m?o.src=m:un&&(o.src=Ai(un.display_name||un.email))});const r=e.querySelector("#profile-form");r&&u(r,"submit",async m=>{m.preventDefault();const f=new FormData(r),g=f.get("avatar_url")?.trim(),v=f.get("display_name")||void 0,y={username:f.get("username")||void 0,display_name:v,bio:f.get("bio")||void 0,timezone:f.get("timezone")||void 0,locale:f.get("locale")||void 0,avatar_url:g||(v?Ai(v):void 0)};try{const S=await Cn.update(y);un=S,h.success("Profile updated"),pr.onUpdate?.(S),o&&(o.src=S.avatar_url||Ai(S.display_name||S.email))}catch{h.error("Failed to update profile")}});const c=e.querySelector("#password-form");c&&u(c,"submit",async m=>{m.preventDefault();const f=new FormData(c),g=f.get("current_password"),v=f.get("new_password"),y=f.get("confirm_password");if(v!==y){h.error("Passwords do not match");return}try{await Cn.changePassword({current_password:g,new_password:v}),h.success("Password changed"),c.reset()}catch(S){h.error(S instanceof Error?S.message:"Failed to change password")}});const l=e.querySelector("#delete-account-btn");l&&u(l,"click",async()=>{const m=prompt("Enter your password to confirm account deletion:");if(m&&confirm("Are you sure? This action cannot be undone."))try{await Cn.deleteAccount(m),U(ms),h.success("Account deleted"),window.location.reload()}catch{h.error("Failed to delete account")}});const d=e.querySelector("#revoke-all-btn");d&&u(d,"click",async()=>{if(confirm("Sign out from all other devices?"))try{await Cn.revokeAllSessions(),h.success("All other sessions signed out"),mr()}catch{h.error("Failed to revoke sessions")}})}async function mr(){const e=document.querySelector("#sessions-list");if(e)try{const t=await Cn.getSessions();if(!t||t.length===0){e.innerHTML=`
        <div class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <p>No active sessions found</p>
        </div>
      `;return}e.innerHTML=t.map(n=>`
      <div class="session-card ${n.is_current?"current":""}">
        <div class="session-info">
          <div class="session-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              ${n.device?.toLowerCase().includes("mobile")?'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>':'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'}
            </svg>
          </div>
          <div class="session-details">
            <h4>${jt(n.device||"Unknown device")}</h4>
            <p>${n.location?`${jt(n.location)} • `:""}${jt(n.ip_address||"Unknown IP")} • Last active: ${q_(n.last_active)}</p>
          </div>
        </div>
        ${n.is_current?'<span class="session-badge">Current</span>':`<button class="btn-sota secondary revoke-session-btn" data-id="${n.id}">Revoke</button>`}
      </div>
    `).join(""),e.querySelectorAll(".revoke-session-btn").forEach(n=>{u(n,"click",async()=>{const s=n.getAttribute("data-id");if(s)try{await Cn.revokeSession(s),h.success("Session revoked"),mr()}catch{h.error("Failed to revoke session")}})})}catch{e.innerHTML=`
      <div class="empty-state">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>Session management requires authentication</p>
      </div>
    `}}function A_(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function Ai(e){return`https://ui-avatars.com/api/?name=${encodeURIComponent(e||"User")}&background=e11d48&color=fff&size=200&font-size=0.4&bold=true`}async function E_(){if(bi)return bi;try{return bi=(await p.get("/api/timezones")).data.timezones,bi}catch{return[{code:"UTC",name:"Coordinated Universal Time",utc_offset:"+00:00"},{code:"Europe/Lisbon",name:"Lisbon, Portugal",utc_offset:"+00:00"},{code:"Europe/London",name:"London, United Kingdom",utc_offset:"+00:00"}]}}function M_(e,t){const s=(t||bi||[{code:"UTC",name:"Coordinated Universal Time",utc_offset:"+00:00"}]).reduce((r,c)=>{const l=c.region||"Other";return r[l]||(r[l]=[]),r[l].push(c),r},{}),i=["Europe","Americas","Asia","Oceania","Africa","Atlantic","UTC","Other"],a=Object.keys(s).sort((r,c)=>{const l=i.indexOf(r),d=i.indexOf(c);return(l===-1?999:l)-(d===-1?999:d)});let o="";for(const r of a){o+=`<optgroup label="${r}">`;for(const c of s[r]){const l=`${c.name} (${c.utc_offset})`;o+=`<option value="${c.code}" ${e===c.code?"selected":""}>${l}</option>`}o+="</optgroup>"}return o}function q_(e){const t=new Date(e),s=new Date().getTime()-t.getTime();return s<6e4?"Just now":s<36e5?`${Math.floor(s/6e4)} min ago`:s<864e5?`${Math.floor(s/36e5)} hours ago`:s<6048e5?`${Math.floor(s/864e5)} days ago`:t.toLocaleDateString()}function jt(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}async function yi(e){const t=e.querySelector("#krisp-integration-content");if(!t)return;const s=z.getState().currentUser?.role==="superadmin";try{const i=await kc(),a=await cy();if(!i){t.innerHTML=`
        <div class="krisp-not-configured">
          <p>Krisp integration is not configured yet.</p>
          <button type="button" class="btn-sota primary" id="enable-krisp-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Enable Krisp Integration
          </button>
        </div>
      `;const f=t.querySelector("#enable-krisp-btn");f&&u(f,"click",async()=>{try{await kc(),yi(e),h.success("Krisp integration enabled")}catch{h.error("Failed to enable Krisp integration")}});return}t.innerHTML=`
      <div class="krisp-config">
        ${s?`
        <div class="krisp-mcp-banner">
          <div class="mcp-icon">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="mcp-info">
            <strong>MCP Direct Access</strong>
            <span>As a Super Admin, you can import meetings directly via MCP without webhook configuration.</span>
          </div>
          <button type="button" class="btn-sota primary" id="mcp-import-btn">
            Import via MCP
          </button>
        </div>
        `:""}
        
        <div class="krisp-status">
          <span class="status-indicator ${i.is_active?"active":"inactive"}"></span>
          <span>${i.is_active?"Active":"Inactive"}</span>
          <button type="button" class="btn-sota small ${i.is_active?"secondary":"primary"}" id="toggle-krisp-btn">
            ${i.is_active?"Disable":"Enable"}
          </button>
        </div>

        <div class="form-field">
          <label>Webhook URL</label>
          <div class="input-with-copy">
            <input type="text" value="${jt(i.webhook_url)}" readonly>
            <button type="button" class="btn-copy" data-copy="${jt(i.webhook_url)}" title="Copy URL">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="form-field">
          <label>Authorization Token</label>
          <div class="input-with-copy">
            <input type="password" value="${jt(i.webhook_secret)}" readonly id="krisp-secret-input">
            <button type="button" class="btn-toggle-visibility" id="toggle-secret-btn" title="Show/Hide">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            <button type="button" class="btn-copy" data-copy="${jt(i.webhook_secret)}" title="Copy Token">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
          <span class="form-hint">Use this token in the Authorization header when configuring Krisp webhook.</span>
        </div>

        <div class="krisp-stats">
          <div class="stat">
            <span class="stat-value">${a?.total_count||0}</span>
            <span class="stat-label">Total Transcripts</span>
          </div>
          <div class="stat">
            <span class="stat-value">${a?.processed_count||0}</span>
            <span class="stat-label">Processed</span>
          </div>
          <div class="stat ${(a?.quarantine_count||0)+(a?.ambiguous_count||0)>0?"warning":""}">
            <span class="stat-value">${(a?.quarantine_count||0)+(a?.ambiguous_count||0)}</span>
            <span class="stat-label">Need Attention</span>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-sota secondary" id="regenerate-krisp-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Regenerate Credentials
          </button>
          <a href="#" class="btn-sota primary" id="view-transcripts-btn">
            View Transcripts
          </a>
        </div>
      </div>
      
      <style>
        .krisp-config { padding: 16px 0; }
        .krisp-status { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
        .status-indicator.active { background: #22c55e; }
        .status-indicator.inactive { background: #94a3b8; }
        .input-with-copy { display: flex; gap: 8px; }
        .input-with-copy input { flex: 1; }
        .btn-copy, .btn-toggle-visibility { padding: 8px; background: var(--bg-secondary, #f1f5f9); border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; cursor: pointer; }
        .btn-copy:hover, .btn-toggle-visibility:hover { background: var(--bg-tertiary, #e2e8f0); }
        .krisp-stats { display: flex; gap: 16px; margin: 24px 0; padding: 16px; background: var(--bg-secondary, #f8fafc); border-radius: 12px; }
        .stat { flex: 1; text-align: center; }
        .stat-value { display: block; font-size: 24px; font-weight: 600; color: var(--text-primary, #1e293b); }
        .stat-label { font-size: 12px; color: var(--text-secondary, #64748b); }
        .stat.warning .stat-value { color: #f59e0b; }
        .btn-sota.small { padding: 4px 12px; font-size: 12px; }
        .krisp-not-configured { text-align: center; padding: 32px; }
        .krisp-not-configured p { margin-bottom: 16px; color: var(--text-secondary, #64748b); }
        .krisp-mcp-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
          border: 1px solid #93c5fd;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .mcp-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mcp-icon svg { color: white; }
        .mcp-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .mcp-info strong {
          font-size: 14px;
          color: #1e40af;
        }
        .mcp-info span {
          font-size: 12px;
          color: #3b82f6;
        }
        .krisp-mcp-banner .btn-sota {
          flex-shrink: 0;
        }
        [data-theme="dark"] .krisp-mcp-banner {
          background: linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(29,78,216,0.1) 100%);
          border-color: rgba(59,130,246,0.3);
        }
        [data-theme="dark"] .mcp-info strong { color: #93c5fd; }
        [data-theme="dark"] .mcp-info span { color: #60a5fa; }
        [data-theme="dark"] .krisp-stats { background: rgba(30,41,59,0.5); }
        [data-theme="dark"] .btn-copy, [data-theme="dark"] .btn-toggle-visibility { background: rgba(30,41,59,0.8); border-color: rgba(255,255,255,0.1); }
      </style>
    `,t.querySelectorAll(".btn-copy").forEach(f=>{u(f,"click",()=>{const g=f.getAttribute("data-copy")||"";navigator.clipboard.writeText(g),h.success("Copied to clipboard")})});const o=t.querySelector("#toggle-secret-btn"),r=t.querySelector("#krisp-secret-input");o&&r&&u(o,"click",()=>{r.type=r.type==="password"?"text":"password"});const c=t.querySelector("#mcp-import-btn");c&&u(c,"click",async()=>{U(ms);const{showKrispManager:f}=await ve(async()=>{const{showKrispManager:g}=await import("./KrispManager-Bb372_YM.js");return{showKrispManager:g}},__vite__mapDeps([0,1]));f("import")});const l=t.querySelector("#toggle-krisp-btn");l&&u(l,"click",async()=>{const f=!i.is_active;await ay(f)?(h.success(f?"Krisp integration enabled":"Krisp integration disabled"),yi(e)):h.error("Failed to update integration")});const d=t.querySelector("#regenerate-krisp-btn");d&&u(d,"click",async()=>{if(!confirm("Are you sure? You will need to update the webhook URL in Krisp."))return;await oy()?(h.success("Credentials regenerated"),yi(e)):h.error("Failed to regenerate credentials")});const m=t.querySelector("#view-transcripts-btn");m&&u(m,"click",async f=>{f.preventDefault(),U(ms);const{showKrispManager:g}=await ve(async()=>{const{showKrispManager:v}=await import("./KrispManager-Bb372_YM.js");return{showKrispManager:v}},__vite__mapDeps([0,1]));g()})}catch(i){console.error("[ProfileModal] Krisp integration error:",i),t.innerHTML=`
      <div class="error-message">
        <p>Failed to load Krisp integration. Please try again.</p>
        <button type="button" class="btn-sota secondary" id="retry-krisp-btn">Retry</button>
      </div>
    `;const a=t.querySelector("#retry-krisp-btn");a&&u(a,"click",()=>yi(e))}}function Tp(){U(ms)}function j_(e,t={}){e.innerHTML="";const n=Cp();e.appendChild(n),Lp(n,{onBack:t.onBack})}const D_=Object.freeze(Object.defineProperty({__proto__:null,closeProfileModal:Tp,initProfilePage:j_,showProfileModal:_p},Symbol.toStringTag,{value:"Module"})),On="fact-modal";function Wr(e){const t=e.mode==="create"?"Add Fact":e.mode==="edit"?"Edit Fact":"View Fact",n=Me({id:On,title:t,size:"md",content:P_(e),onClose:e.onClose});document.body.appendChild(n),qe(On)}function P_(e){const t=_("div",{className:"fact-modal-content"}),n=e.fact,s=e.mode==="view";return t.innerHTML=`
    <form id="fact-form" class="fact-form">
      <div class="form-group">
        <label for="content">Fact Content *</label>
        <textarea id="content" name="content" rows="4" required 
                  ${s?"disabled":""}
                  placeholder="Enter the fact...">${ui(n?.content||"")}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="source">Source</label>
          <input type="text" id="source" name="source" 
                 ${s?"disabled":""}
                 value="${ui(n?.source||"")}"
                 placeholder="Document, conversation, etc.">
        </div>
        <div class="form-group">
          <label for="category">Category</label>
          <input type="text" id="category" name="category" 
                 ${s?"disabled":""}
                 value="${ui(n?.category||"")}"
                 placeholder="Technical, Business, etc.">
        </div>
      </div>

      ${n?.verified?`
        <div class="verified-info">
          <span class="verified-badge">✓ Verified</span>
          ${n.verified_by?`<span>by ${ui(n.verified_by)}</span>`:""}
          ${n.verified_at?`<span>on ${Ea(n.verified_at)}</span>`:""}
        </div>
      `:""}

      ${n?.source_file?`
        <div class="source-file">
          <span class="label">Source File:</span>
          <span class="value">${ui(n.source_file)}</span>
        </div>
      `:""}

      ${n?`
        <div class="metadata">
          <span>Created: ${Ea(n.created_at)}</span>
          ${n.updated_at?`<span>Updated: ${Ea(n.updated_at)}</span>`:""}
        </div>
      `:""}

      <div class="form-actions">
        ${e.mode==="view"?`
          <button type="button" class="btn btn-secondary" id="edit-btn">Edit</button>
          ${n?.verified?"":'<button type="button" class="btn btn-success" id="verify-btn">Verify</button>'}
          <button type="button" class="btn btn-danger" id="delete-btn">Delete</button>
        `:`
          <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary">
            ${e.mode==="create"?"Add Fact":"Save Changes"}
          </button>
        `}
      </div>
    </form>
  `,z_(t,e),t}function z_(e,t){const n=e.querySelector("#fact-form");n&&u(n,"submit",async r=>{r.preventDefault();const c=new FormData(n),l={content:c.get("content"),source:c.get("source")||void 0,category:c.get("category")||void 0};if(!l.content.trim()){h.error("Fact content is required");return}try{let d;t.mode==="create"?(d=await Ye.create(l),h.success("Fact added")):(d=await Ye.update(t.fact.id,l),h.success("Fact updated")),U(On),t.onSave?.(d)}catch{h.error("Failed to save fact")}});const s=e.querySelector("#cancel-btn");s&&u(s,"click",()=>{U(On)});const i=e.querySelector("#edit-btn");i&&u(i,"click",()=>{U(On),Wr({...t,mode:"edit"})});const a=e.querySelector("#verify-btn");a&&t.fact&&u(a,"click",async()=>{try{const r=await Ye.verify(t.fact.id);h.success("Fact verified"),U(On),t.onSave?.(r)}catch{h.error("Failed to verify fact")}});const o=e.querySelector("#delete-btn");o&&t.fact&&u(o,"click",async()=>{if(confirm("Are you sure you want to delete this fact?"))try{await Ye.delete(t.fact.id),h.success("Fact deleted"),U(On),t.onDelete?.(t.fact.id)}catch{h.error("Failed to delete fact")}})}function Ea(e){return new Date(e).toLocaleDateString()}function ui(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Ap(){U(On)}const Go=Object.freeze(Object.defineProperty({__proto__:null,closeFactModal:Ap,showFactModal:Wr},Symbol.toStringTag,{value:"Module"}));let gr=null,io=!1;function Ep(e={}){const t=_("div",{className:"briefing-panel"});t.innerHTML=`
    <div class="briefing-header">
      <h2>Daily Briefing</h2>
      <div class="briefing-actions">
        <button class="btn btn-sm" id="toggle-history-btn">History</button>
        <button class="btn btn-sm btn-primary" id="refresh-briefing-btn">Refresh</button>
      </div>
    </div>
    <div class="briefing-content" id="briefing-content">
      <div class="loading">Generating briefing...</div>
    </div>
    <div class="briefing-history hidden" id="briefing-history"></div>
  `;const n=t.querySelector("#refresh-briefing-btn");n&&u(n,"click",()=>Bl(t,!0,e));const s=t.querySelector("#toggle-history-btn");return s&&u(s,"click",()=>{io=!io;const i=t.querySelector("#briefing-history");i.classList.toggle("hidden",!io),io&&I_(i)}),Bl(t,!1,e),t}async function Bl(e,t,n){const s=e.querySelector("#briefing-content");s.innerHTML='<div class="loading">Generating briefing...</div>';try{const i=await kr.getBriefing(t);gr=i,Mp(s,i,n)}catch{s.innerHTML='<div class="error">Failed to generate briefing</div>'}}function Mp(e,t,n){e.innerHTML=`
    <div class="briefing-meta">
      <span class="briefing-date">${Qr(t.generated_at)}</span>
      ${t.cached?'<span class="cached-badge">Cached</span>':""}
    </div>

    <div class="briefing-text">
      ${fr(t.briefing)}
    </div>

    ${t.analysis?`
      <div class="briefing-analysis">
        <h4>Analysis</h4>
        <div class="analysis-content">${fr(t.analysis)}</div>
      </div>
    `:""}

  `}async function I_(e){e.innerHTML='<div class="loading">Loading history...</div>';try{const t=await kr.getBriefingHistory(10);if(!t||t.length===0){e.innerHTML='<p class="empty">No previous briefings</p>';return}e.innerHTML=`
      <h4>Previous Briefings</h4>
      <div class="history-list">
        ${t.map(n=>`
          <div class="history-item" data-id="${n.id}">
            <div class="history-date">${Qr(n.generated_at)}</div>
            <div class="history-preview">${R_(n.briefing.substring(0,150))}...</div>
          </div>
        `).join("")}
      </div>
    `,e.querySelectorAll(".history-item").forEach(n=>{u(n,"click",()=>{const s=n.getAttribute("data-id"),i=t.find(a=>a.id===s);i&&H_(e.closest(".briefing-panel"),i)})})}catch{e.innerHTML='<div class="error">Failed to load history</div>'}}function H_(e,t){const n=e.querySelector("#briefing-content");n.innerHTML=`
    <div class="history-detail">
      <button class="btn btn-sm back-btn" id="back-to-current">← Back to current</button>
      <div class="briefing-meta">
        <span class="briefing-date">${Qr(t.generated_at)}</span>
        <span class="history-badge">Historical</span>
      </div>
      <div class="briefing-text">${fr(t.briefing)}</div>
    </div>
  `;const s=n.querySelector("#back-to-current");s&&gr&&u(s,"click",()=>{Mp(n,gr)})}function fr(e){return e.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^### (.*$)/gm,"<h5>$1</h5>").replace(/^## (.*$)/gm,"<h4>$1</h4>").replace(/^# (.*$)/gm,"<h3>$1</h3>").replace(/^- (.*$)/gm,"<li>$1</li>").replace(/(<li>.*<\/li>)/gs,"<ul>$1</ul>").replace(/\n\n/g,"</p><p>").replace(/^(.+)$/gm,"<p>$1</p>").replace(/<p><\/p>/g,"").replace(/<p>(<[hul])/g,"$1").replace(/(<\/[hul][^>]*>)<\/p>/g,"$1")}function Qr(e){return new Date(e).toLocaleDateString(void 0,{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}function R_(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const AC=Object.freeze(Object.defineProperty({__proto__:null,createBriefingPanel:Ep},Symbol.toStringTag,{value:"Module"}));let wi=!1,rs=0;function qp(e={}){const t=_("div",{className:"notifications-dropdown"});t.innerHTML=`
    <button class="notifications-trigger" id="notifications-trigger">
      <span class="bell-icon">🔔</span>
      <span class="notification-badge hidden" id="notification-badge">0</span>
    </button>
    <div class="notifications-panel hidden" id="notifications-panel">
      <div class="notifications-header">
        <h3>Notifications</h3>
        <button class="btn-link" id="mark-all-read">Mark all read</button>
      </div>
      <div class="notifications-list" id="notifications-list">
        <div class="loading">Loading...</div>
      </div>
    </div>
  `;const n=t.querySelector("#notifications-trigger");n&&u(n,"click",i=>{i.stopPropagation(),B_(t,e)});const s=t.querySelector("#mark-all-read");return s&&u(s,"click",async()=>{try{await qs.markAllRead(),h.success("All notifications marked as read"),Dp(t,e),Ao(t,0)}catch{h.error("Failed to mark notifications as read")}}),document.addEventListener("click",()=>{jp(t)}),Ol(t),setInterval(()=>Ol(t),6e4),t}function B_(e,t){wi=!wi;const n=e.querySelector("#notifications-panel");n&&(n.classList.toggle("hidden",!wi),wi&&Dp(e,t))}function jp(e){wi=!1;const t=e.querySelector("#notifications-panel");t&&t.classList.add("hidden")}async function Ol(e){try{const t=await qs.getUnreadCount();rs=t,Ao(e,t)}catch{}}function Ao(e,t){const n=e.querySelector("#notification-badge");n&&(n.textContent=t>99?"99+":String(t),n.classList.toggle("hidden",t===0))}async function Dp(e,t){const n=e.querySelector("#notifications-list");n.innerHTML='<div class="loading">Loading...</div>';try{const s=await qs.getAll({limit:20});O_(n,s,e,t)}catch{n.innerHTML='<div class="error">Failed to load</div>'}}function O_(e,t,n,s){if(t.length===0){e.innerHTML='<div class="empty">No notifications</div>';return}e.innerHTML=t.map(i=>`
    <div class="notification-item ${i.read?"":"unread"}" data-id="${i.id}">
      <div class="notification-icon">${N_(i.type)}</div>
      <div class="notification-content">
        <div class="notification-title">${Nl(i.title)}</div>
        ${i.message?`<div class="notification-message">${Nl(i.message)}</div>`:""}
        <div class="notification-time">${Ee(i.created_at)}</div>
      </div>
      <button class="btn-icon dismiss-btn" title="Dismiss">×</button>
    </div>
  `).join(""),e.querySelectorAll(".notification-item").forEach(i=>{u(i,"click",async o=>{if(o.target.closest(".dismiss-btn"))return;const r=i.getAttribute("data-id"),c=t.find(l=>l.id===r);c&&(c.read||(await qs.markRead(r),i.classList.remove("unread"),rs=Math.max(0,rs-1),Ao(n,rs)),jp(n),s.onNotificationClick?.(c))});const a=i.querySelector(".dismiss-btn");a&&u(a,"click",async o=>{o.stopPropagation();const r=i.getAttribute("data-id");if(r)try{if(await qs.delete(r),i.remove(),!i.classList.contains("unread"))return;rs=Math.max(0,rs-1),Ao(n,rs)}catch{}})})}function N_(e){switch(e){case"question":return"❓";case"risk":return"⚠️";case"action":return"✅";case"decision":return"⚖️";case"mention":return"@";case"comment":return"💬";case"assignment":return"👤";default:return"📣"}}function Nl(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function Pp(e,t={}){const n=qp(t);return e.appendChild(n),n}function U_(e={}){const t=_("div",{className:"members-panel"});t.innerHTML=`
    <div class="panel-header">
      <div class="panel-title">
        <h2>Team Members</h2>
        <span class="panel-count" id="members-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary btn-sm" id="invite-member-btn">+ Invite</button>
      </div>
    </div>
    <div class="panel-content" id="members-content">
      <div class="loading">Loading members...</div>
    </div>
    <div class="pending-invites" id="pending-invites"></div>
  `;const n=t.querySelector("#invite-member-btn");n&&u(n,"click",()=>{const i=e.projectId||z.getState().currentProject?.id;if(!i){h.error("No project selected");return}Vr({projectId:i})});const s=e.projectId||z.getState().currentProject?.id;return s&&(lo(t,s,e),V_(t,s)),t}async function lo(e,t,n){const s=e.querySelector("#members-content");s.innerHTML='<div class="loading">Loading...</div>';try{const i=await qi.getAll(t);F_(s,i,t,n),Z_(e,i.length)}catch{s.innerHTML='<div class="error">Failed to load members</div>'}}function F_(e,t,n,s){if(t.length===0){e.innerHTML='<div class="empty">No team members</div>';return}const i=z.getState().currentUser;e.innerHTML=`
    <div class="members-list">
      ${t.map(a=>`
        <div class="member-card" data-id="${a.user_id}">
          <div class="member-avatar">
            ${a.avatar_url?`<img src="${a.avatar_url}" alt="">`:`<span>${G_(a.name||a.email)}</span>`}
          </div>
          <div class="member-info">
            <div class="member-name">${hr(a.name||a.email)}</div>
            <div class="member-email">${hr(a.email)}</div>
          </div>
          <div class="member-role">
            <select class="role-select" data-user-id="${a.user_id}" ${a.user_id===i?.id?"disabled":""}>
              <option value="viewer" ${a.role==="viewer"?"selected":""}>Viewer</option>
              <option value="editor" ${a.role==="editor"?"selected":""}>Editor</option>
              <option value="admin" ${a.role==="admin"?"selected":""}>Admin</option>
              <option value="owner" ${a.role==="owner"?"selected":""}>Owner</option>
            </select>
          </div>
          <button class="btn-icon permissions-btn permissions-btn-icon" data-user-id="${a.user_id}" title="Permissions">🔐</button>
          ${a.user_id!==i?.id?`
            <button class="btn-icon remove-member-btn" data-user-id="${a.user_id}" title="Remove">×</button>
          `:""}
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".role-select").forEach(a=>{u(a,"change",async()=>{const o=a.getAttribute("data-user-id"),r=a.value;if(o)try{await qi.updateRole(o,r,n),h.success("Role updated")}catch{h.error("Failed to update role"),lo(e.closest(".members-panel"),n,s)}})}),e.querySelectorAll(".remove-member-btn").forEach(a=>{u(a,"click",async()=>{const o=a.getAttribute("data-user-id");if(!(!o||!confirm("Remove this member from the project?")))try{await qi.remove(n,o),h.success("Member removed"),lo(e.closest(".members-panel"),n,s)}catch{h.error("Failed to remove member")}})}),e.querySelectorAll(".permissions-btn").forEach(a=>{u(a,"click",()=>{const o=a.getAttribute("data-user-id"),r=t.find(c=>c.user_id===o);r&&Wd({projectId:n,userId:r.user_id,userName:r.name||"",userEmail:r.email,avatarUrl:r.avatar_url,currentRole:r.role,currentPermissions:r.permissions,onSave:()=>{lo(e.closest(".members-panel"),n,s)}})})}),e.querySelectorAll(".member-card").forEach(a=>{u(a,"click",o=>{if(o.target.closest(".role-select, .remove-member-btn"))return;const r=a.getAttribute("data-id"),c=t.find(l=>l.user_id===r);c&&s.onMemberClick&&s.onMemberClick(c)})})}async function V_(e,t){const n=e.querySelector("#pending-invites");try{const s=await qi.getInvites(t);if(s.length===0){n.innerHTML="";return}n.innerHTML=`
      <div class="invites-section">
        <h4>Pending Invites</h4>
        <div class="invites-list">
          ${s.map(i=>`
            <div class="invite-card" data-id="${i.id}">
              <div class="invite-info">
                <span class="invite-email">${hr(i.email)}</span>
                <span class="invite-role">${i.role}</span>
                <span class="invite-time">Sent ${Ee(i.invited_at||i.created_at||new Date().toISOString())}</span>
              </div>
              <button class="btn btn-sm cancel-invite-btn" data-id="${i.id}">Cancel</button>
            </div>
          `).join("")}
        </div>
      </div>
    `,n.querySelectorAll(".cancel-invite-btn").forEach(i=>{u(i,"click",async()=>{if(i.getAttribute("data-id"))try{h.info("Invite cancellation not implemented")}catch{h.error("Failed to cancel invite")}})})}catch{}}function Z_(e,t){const n=e.querySelector("#members-count");n&&(n.textContent=String(t))}function G_(e){return e.split(" ").map(t=>t[0]).join("").toUpperCase().slice(0,2)}function hr(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const W_=Object.freeze(Object.defineProperty({__proto__:null,addProcessingStep:eS,alert:Gd,clearSelection:Or,closeAllModals:Ud,closeAuthModal:yS,closeFactModal:Ap,closeModal:U,closeProcessingModal:ap,closeProfileModal:Tp,closeSearch:Vs,confirm:Zn,createActionsPanel:yo,createBreakdownChart:zu,createBriefingPanel:Ep,createBulkActionsBar:P$,createBulkCheckbox:O$,createCommentsThread:Iu,createDecisionsPanel:ko,createFactsPanel:Is,createFileUploader:u$,createHeader:Rd,createHealthBadge:e$,createHealthIndicator:Xx,createKnowledgeGraph:f$,createMembersPanel:U_,createModal:Me,createNotificationsDropdown:qp,createProjectSelector:A2,createQuestionDetailView:qr,createQuestionsPanel:Lu,createRiskMatrix:c$,createRiskSummary:d$,createRisksPanel:vo,createSidebar:Bd,createStatsCard:Qu,createStatsGrid:Yx,createSyncIndicator:U$,createSyncStatus:N$,createThemeToggle:Sr,createTimeline:k$,createToastElement:Nd,createTrendChart:s$,deselectItem:R$,getHealthColor:t$,getHealthStatus:n$,getSelectedIds:B$,getToastContainer:Od,initCommandPalette:op,initGlobalSearch:Xu,initNotificationsDropdown:Pp,initProjectSelector:T2,isModalOpen:Fd,isProcessingModalOpen:nS,isSelected:ar,mountHeader:Zy,mountSidebar:Jy,mountThemeToggle:Ey,openModal:qe,openSearch:ep,selectItem:H$,setProcessingSteps:tS,showActionModal:Ps,showAuthModal:Ur,showCommentModal:C_,showCompaniesModal:wS,showContactModal:Fr,showDecisionModal:Fs,showDeveloperModal:Gr,showEmailModal:yp,showExportModal:HS,showFactModal:Wr,showFileUploadModal:Zr,showGraphModal:v_,showHistoryModal:k_,showInviteModal:Vr,showNotificationsModal:t_,showProcessingModal:K$,showProfileModal:_p,showProjectModal:Pi,showQuestionModal:Ri,showRiskModal:Us,showRoleModal:vp,showSettingsModal:W$,showShortcutsModal:bp,showTeamModal:MS,showToastInContainer:Yy,toggleSearch:ir,toggleSelection:sp,updateModalContent:Vd,updateModalTitle:Zd,updateProcessingStep:X$,updateStatsCard:Jx,updateTabBadge:Ky},Symbol.toStringTag,{value:"Module"}));class Eo{static isInitialized=!1;static init(){this.isInitialized||(window.addEventListener("error",this.handleError),window.addEventListener("unhandledrejection",this.handleRejection),this.isInitialized=!0,console.log("[ErrorBoundary] Initialized global error handling."))}static handleError(t){console.error("[ErrorBoundary] Uncaught Exception:",t.error),Eo.showErrorUI("An unexpected error occurred.",t.error?.message)}static handleRejection(t){console.error("[ErrorBoundary] Unhandled Promise Rejection:",t.reason);const n=t.reason?.message||(typeof t.reason=="string"?t.reason:"Unknown failure");Eo.showErrorUI("Async operation failed.",n)}static showErrorUI(t,n){const s=`${t} ${n?`(${n})`:""}`;h.error(s)}}const zp={profiles:[],selectedProfile:null,teamAnalysis:null,relationships:[],graphData:null,loading:!1,analyzing:!1,error:null,currentSubtab:"profiles"};let We={...zp};const vr=new Set;function wn(){vr.forEach(e=>e(We))}function Ip(){return We}function Hp(e){return vr.add(e),()=>vr.delete(e)}function Wn(e){We={...We,loading:e},wn()}function Rs(e){We={...We,analyzing:e},wn()}function pt(e){We={...We,error:e},wn()}function Wo(e){We={...We,profiles:e},wn()}function Qo(e){We={...We,selectedProfile:e},wn()}function Ko(e){We={...We,teamAnalysis:e},wn()}function Kr(e){We={...We,relationships:e},wn()}function Jr(e){We={...We,graphData:e},wn()}function Rp(e){We={...We,currentSubtab:e},wn()}async function Yr(){Wn(!0),pt(null);try{const t=await(await kt("/api/team-analysis/profiles")).json();t.ok?Wo(t.profiles||[]):pt(t.error||"Failed to load profiles")}catch(e){pt(e.message||"Failed to load profiles")}finally{Wn(!1)}}async function Bp(e){Wn(!0),pt(null);try{const n=await(await kt(`/api/team-analysis/profiles/${e}`)).json();return n.ok&&n.profile?(Qo(n.profile),n.profile):(pt(n.error||"Profile not found"),null)}catch(t){return pt(t.message||"Failed to load profile"),null}finally{Wn(!1)}}async function Op(e,t={}){Rs(!0),pt(null);try{const s=await(await kt(`/api/team-analysis/profiles/${e}/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)})).json();if(s.ok&&s.profile){const i=We.profiles.map(a=>a.person_id===e?s.profile:a);return i.find(a=>a.person_id===e)||i.push(s.profile),Wo(i),Qo(s.profile),s.profile}else return pt(s.error||"Failed to analyze profile"),null}catch(n){return pt(n.message||"Failed to analyze profile"),null}finally{Rs(!1)}}async function Xr(){Wn(!0),pt(null);try{console.log("[TeamAnalysisStore] Loading team analysis...");const t=await(await kt("/api/team-analysis/team")).json();console.log("[TeamAnalysisStore] Team analysis response:",t),t.ok?(console.log("[TeamAnalysisStore] Setting team analysis:",t.analysis),Ko(t.analysis)):(console.error("[TeamAnalysisStore] Error:",t.error),pt(t.error||"Failed to load team analysis"))}catch(e){console.error("[TeamAnalysisStore] Exception:",e),pt(e.message||"Failed to load team analysis")}finally{Wn(!1)}}async function Np(e=!1){Rs(!0),pt(null);try{const n=await(await kt("/api/team-analysis/team/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({forceReanalysis:e})})).json();return n.ok&&n.analysis?(Ko(n.analysis),n.analysis):(pt(n.error||"Failed to analyze team"),null)}catch(t){return pt(t.message||"Failed to analyze team"),null}finally{Rs(!1)}}async function ec(){try{const t=await(await kt("/api/team-analysis/relationships")).json();t.ok&&Kr(t.relationships||[])}catch(e){console.error("Failed to load relationships:",e)}}async function tc(){try{console.log("[TeamAnalysisStore] Loading graph data...");const t=await(await kt("/api/team-analysis/graph")).json();console.log("[TeamAnalysisStore] Graph data response:",t),t.ok&&(console.log("[TeamAnalysisStore] Setting graph data:",t.nodes?.length,"nodes,",t.edges?.length,"edges"),Jr({nodes:t.nodes||[],edges:t.edges||[]}))}catch(e){console.error("[TeamAnalysisStore] Failed to load graph data:",e)}}async function Up(){await Promise.all([Yr(),Xr(),ec(),tc()])}function Fp(){We={...zp},wn()}const Vp={getState:Ip,subscribe:Hp,setLoading:Wn,setAnalyzing:Rs,setError:pt,setProfiles:Wo,setSelectedProfile:Qo,setTeamAnalysis:Ko,setRelationships:Kr,setGraphData:Jr,setSubtab:Rp,loadProfiles:Yr,loadProfile:Bp,analyzeProfile:Op,loadTeamAnalysis:Xr,analyzeTeam:Np,loadRelationships:ec,loadGraphData:tc,loadAll:Up,reset:Fp},Q_=Object.freeze(Object.defineProperty({__proto__:null,analyzeProfile:Op,analyzeTeam:Np,getState:Ip,loadAll:Up,loadGraphData:tc,loadProfile:Bp,loadProfiles:Yr,loadRelationships:ec,loadTeamAnalysis:Xr,reset:Fp,setAnalyzing:Rs,setError:pt,setGraphData:Jr,setLoading:Wn,setProfiles:Wo,setRelationships:Kr,setSelectedProfile:Qo,setSubtab:Rp,setTeamAnalysis:Ko,subscribe:Hp,teamAnalysisStore:Vp},Symbol.toStringTag,{value:"Module"}));Object.defineProperty(window,"currentProject",{get:()=>z.getState().currentProject,set:e=>z.setCurrentProject(e),configurable:!0});Object.defineProperty(window,"currentProjectId",{get:()=>z.getState().currentProjectId,set:e=>z.setCurrentProjectId(e),configurable:!0});Object.defineProperty(window,"currentUser",{get:()=>z.getState().currentUser,set:e=>z.setCurrentUser(e),configurable:!0});Object.defineProperty(window,"authConfigured",{get:()=>z.getState().authConfigured,set:e=>z.setAuthConfigured(e),configurable:!0});Object.defineProperty(window,"currentTab",{get:()=>He.getState().currentTab,set:e=>He.setTab(e),configurable:!0});Object.defineProperty(window,"questions",{get:()=>ce.getState().questions,set:e=>ce.setQuestions(e),configurable:!0});Object.defineProperty(window,"risks",{get:()=>ce.getState().risks,set:e=>ce.setRisks(e),configurable:!0});Object.defineProperty(window,"actions",{get:()=>ce.getState().actions,set:e=>ce.setActions(e),configurable:!0});Object.defineProperty(window,"decisions",{get:()=>ce.getState().decisions,set:e=>ce.setDecisions(e),configurable:!0});Object.defineProperty(window,"contacts",{get:()=>ce.getState().contacts,set:e=>ce.setContacts(e),configurable:!0});Object.defineProperty(window,"chatHistory",{get:()=>ce.getState().chatHistory,set:e=>ce.setChatHistory(e),configurable:!0});window.api=async function(t,n="GET",s){try{let i;switch(n.toUpperCase()){case"GET":i=await p.get(t);break;case"POST":i=await p.post(t,s);break;case"PUT":i=await p.put(t,s);break;case"PATCH":i=await p.patch(t,s);break;case"DELETE":i=await p.delete(t);break;default:i=await pn(t,{method:n,body:s?JSON.stringify(s):void 0})}return i.data}catch(i){throw console.error("API Error:",i),i}};window.showToast=function(t,n="info"){h[n](t)};window.setTheme=function(t){Ke.set(t)};window.toggleTheme=function(){Ke.toggle()};window.getStorageItem=function(t,n=null){return Vt.get(t,n)};window.setStorageItem=function(t,n){Vt.set(t,n)};window.switchTab=function(t){He.setTab(t)};window.refreshData=async function(){const t=z.getState().currentProjectId;if(t)try{const[n,s,i,a,o]=await Promise.all([p.get(`/api/projects/${t}/questions`),p.get(`/api/projects/${t}/risks`),p.get(`/api/projects/${t}/actions`),p.get(`/api/projects/${t}/decisions`),p.get(`/api/projects/${t}/contacts`)]);ce.setQuestions(n.data),ce.setRisks(s.data),ce.setActions(i.data),ce.setDecisions(a.data),ce.setContacts(o.data)}catch(n){console.error("Failed to refresh data:",n)}};window.registerChart=function(e,t,n,s="bar"){Xn.registerChart(e,t,n,s)};window.destroyChart=function(e){Xn.destroyChart(e)};window.getChart=function(e){return Xn.getChart(e)};window.registerShortcut=function(e,t,n={}){Ut.register({key:e,ctrl:n.ctrl,shift:n.shift,alt:n.alt,handler:t,description:n.description||"Custom shortcut"})};window.pushUndoAction=function(e,t,n){tn.push({id:`undo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,description:e,undo:t,redo:n})};window.undoLastAction=function(){return tn.undo()};window.redoLastAction=function(){return tn.redo()};function K_(){console.log("[GodMode] Legacy bridge initialized"),z.init()}function J_(e){if(!document.startViewTransition){e();return}document.startViewTransition(async()=>{await e()}).finished.then(()=>{document.documentElement.classList.remove("vt-slide","vt-slide-back")})}Eo.init();window.godmode={theme:Ke,toast:h,shortcuts:Ut,undo:tn,storage:Vt,http:p,api:pn,configureApi:Kl,auth:Pt,projects:Vn,dashboard:fg,questions:Ve,risks:Mt,actions:Le,decisions:Re,chat:kr,contacts:Je,teams:Qf,documents:Os,knowledge:kh,emails:Bh,graph:xr,timeline:yd,costs:mb,notifications:qs,comments:Ls,members:qi,profile:Cn,userSettings:Ub,projectSettings:Fb,apiKeys:Vb,webhooks:Zb,audit:Gb,facts:Ye,appStore:z,uiStore:He,dataStore:ce,chartsStore:Xn,version:"2.0.0"};im(()=>z.getState().currentProjectId);am(e=>{const t=z.getState().currentProjectId;return t&&e.headers&&(e.headers["X-Project-Id"]=t),e});function Y_(){Ut.register({key:"z",ctrl:!0,description:"Undo last action",handler:async()=>{tn.canUndo()&&(await tn.undo(),h.info("Undo: "+(tn.getRedoDescription()||"Action undone")))}}),Ut.register({key:"z",ctrl:!0,shift:!0,description:"Redo last action",handler:async()=>{tn.canRedo()&&(await tn.redo(),h.info("Redo: "+(tn.getUndoDescription()||"Action redone")))}}),Ut.register({key:"t",ctrl:!0,shift:!0,description:"Cycle theme (light/dark/system)",handler:()=>{Ke.cycle(),h.info(`Theme: ${Ke.getLabel()}`)}}),Ut.register({key:"?",description:"Show keyboard shortcuts",handler:()=>{Ut.showHelp()}})}function X_(){Kl({onUnauthorized:()=>{z.setCurrentUser(null),h.error("Session expired. Please log in again."),window.dispatchEvent(new CustomEvent("godmode:auth-required"))},onForbidden:()=>{h.error("You do not have permission to perform this action.")}})}function eC(){const e=document.getElementById("theme-toggle");e&&(e.addEventListener("click",()=>{Ke.cycle(),Vl(),h.info(`Theme: ${Ke.getLabel()}`)}),Vl()),op();const t=document.getElementById("user-avatar"),n=document.getElementById("user-dropdown");t&&n&&(t.addEventListener("click",C=>{C.stopPropagation(),n.classList.toggle("hidden")}),document.addEventListener("click",()=>{n.classList.add("hidden")}));const s=document.getElementById("login-btn");s&&s.addEventListener("click",()=>{Ur({onSuccess:()=>{Ei(),Mn()}})});const i=document.getElementById("logout-btn");i&&i.addEventListener("click",async()=>{await Pt.logout(),Mo(),ce.setProjects([]),z.setCurrentProject(null),z.setCurrentProjectId(null),Ei(),aC(),z.getState().authConfigured?(h.info("Signed out successfully"),window.location.href="/"):h.info("Signed out")});const a=document.getElementById("settings-btn");a&&a.addEventListener("click",()=>{Ie("settings")});const o=document.getElementById("shortcuts-btn");o&&o.addEventListener("click",()=>{bp()});const r=document.getElementById("dev-tools-btn");r&&r.addEventListener("click",()=>{Gr()});const c=document.getElementById("profile-btn");c&&c.addEventListener("click",()=>{n?.classList.add("hidden"),Ie("profile")});const l=document.getElementById("notifications-container");l&&Pp(l,{onNotificationClick:C=>{console.log("Notification clicked:",C),C.entity_type&&C.entity_id&&window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:{type:C.entity_type,id:C.entity_id}}))}}),document.querySelectorAll(".nav-item[data-tab]").forEach(C=>{C.addEventListener("click",()=>{const T=C.getAttribute("data-tab");T&&Ie(T)})});const m=document.querySelectorAll(".sot-tab");m.forEach(C=>{C.addEventListener("click",()=>{const T=C.getAttribute("data-view");T&&(m.forEach(A=>A.classList.remove("active")),C.classList.add("active"),He.setSotView(T),Un(T))})});const f=document.getElementById("menu-toggle"),g=document.getElementById("app-sidebar");f&&g&&f.addEventListener("click",()=>{g.classList.toggle("open")});const v=document.getElementById("new-contact-btn");v&&v.addEventListener("click",()=>{Fr({mode:"create"})}),document.querySelectorAll("#new-upload-btn, #upload-files-btn").forEach(C=>{C.addEventListener("click",()=>{Zr()})}),lC();const S=document.getElementById("project-selector"),w=document.getElementById("new-project-btn"),k=document.getElementById("edit-project-btn");S&&(S.addEventListener("change",async()=>{const C=S.value;console.log("🔄 Project selector changed, value:",C),C?(await oC(C),k&&k.classList.remove("hidden")):(console.log("📭 Clearing project - starting..."),k&&k.classList.add("hidden"),z.setCurrentProject(null),z.setCurrentProjectId(null),console.log("📭 Store cleared"),Mo(),console.log("📭 Data store cleared"),console.log("📭 Calling showNoProjectState..."),Zp(),console.log("📭 showNoProjectState called"),Ie("dashboard"),Un(He.getState().sotCurrentView),p.post("/api/projects/deactivate").catch(()=>{}),console.log("📭 Project deselected - ALL DONE"))}),nc()),w&&w.addEventListener("click",()=>{window.__godmodeProjectsOpen="create",Ie("projects")}),k&&k.addEventListener("click",()=>{const C=z.getState().currentProject;C&&(window.__godmodeProjectsOpen="edit:"+C.id,Ie("projects"))});const x=document.querySelectorAll("#contacts-subtabs .subtab");x.forEach(C=>{C.addEventListener("click",()=>{x.forEach(A=>A.classList.remove("active")),C.classList.add("active");const T=C.getAttribute("data-subtab");document.querySelectorAll('[id^="contacts-subtab-"]').forEach(A=>{A.classList.toggle("hidden",A.id!==`contacts-subtab-${T}`)})})});const b=document.getElementById("refresh-dashboard-btn");b&&b.addEventListener("click",()=>{Ul(),h.info("Dashboard refreshed")}),Ul(),tC()}function Zp(){console.log("📭 showNoProjectState() called");const e=document.getElementById("dashboard-container");if(console.log("📭 dashboardContainer:",e?"FOUND":"NOT FOUND"),!e)return;console.log("📭 Setting innerHTML NOW..."),e.innerHTML=`
    <div class="dashboard gm-p-5">
      <div class="no-project-state gm-empty-state">
        <svg class="gm-empty-state-icon" width="96" height="96" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <h2 class="gm-empty-state-title">No Project Selected</h2>
        <p class="gm-empty-state-desc">
          Select a project from the dropdown above, or create a new one to get started with your data management.
        </p>
        <button id="create-project-empty-cta" class="btn btn-primary gm-empty-state-cta">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create New Project
        </button>
      </div>
    </div>
  `,console.log("📭 innerHTML SET! Container visible:",e.offsetParent!==null),console.log("📭 Container display:",window.getComputedStyle(e).display);const t=document.getElementById("create-project-empty-cta");t&&t.addEventListener("click",()=>{window.__godmodeProjectsOpen="create",Ie("projects")})}async function br(){const e=document.getElementById("dashboard-container");if(!e)return;const t=z.getState().currentProject,n=z.getState().currentProjectId;if(!t&&!n){Zp();return}e.innerHTML='<div class="gm-loading-placeholder">Loading dashboard...</div>';try{const{createDashboard:s}=await ve(async()=>{const{createDashboard:a}=await import("./Dashboard-D0L7-zA-.js");return{createDashboard:a}},__vite__mapDeps([2,1]));e.innerHTML="";const i=s({onStatClick:a=>{console.log("Stat clicked:",a),a==="questions"?Ie("sot"):a==="facts"?(Ie("sot"),He.setSotView("facts"),document.querySelectorAll(".sot-tab").forEach(o=>{o.classList.toggle("active",o.getAttribute("data-view")==="facts")}),Un("facts")):a==="risks"?(Ie("sot"),He.setSotView("risks"),document.querySelectorAll(".sot-tab").forEach(o=>{o.classList.toggle("active",o.getAttribute("data-view")==="risks")}),Un("risks")):a==="actions"?(Ie("sot"),He.setSotView("actions"),document.querySelectorAll(".sot-tab").forEach(o=>{o.classList.toggle("active",o.getAttribute("data-view")==="actions")}),Un("actions")):a==="decisions"?(Ie("sot"),He.setSotView("decisions"),document.querySelectorAll(".sot-tab").forEach(o=>{o.classList.toggle("active",o.getAttribute("data-view")==="decisions")}),Un("decisions")):a==="contacts"&&Ie("contacts")}});e.appendChild(i)}catch(s){console.error("Failed to load Dashboard:",s),e.innerHTML='<div class="gm-error-placeholder">Failed to load dashboard</div>'}}function Ul(){br();const e=document.getElementById("chat-panel-container");e&&e.children.length===0&&ve(async()=>{const{createChat:l}=await import("./ChatPage-CNk0fPqu.js");return{createChat:l}},__vite__mapDeps([3,1])).then(({createChat:l})=>{const d=l({showSources:!0,showSessions:!0});e.appendChild(d)}).catch(l=>{console.error("[Chat] Failed to load Chat:",l),e.innerHTML='<div class="gm-loading-placeholder gm-text-secondary">Failed to load chat</div>'});const t=document.getElementById("emails-panel-container");t&&t.children.length===0&&ve(async()=>{const{createEmailsPanel:l}=await import("./EmailsPage-C6wqr4Gh.js");return{createEmailsPanel:l}},__vite__mapDeps([4,1])).then(({createEmailsPanel:l})=>{const d=l();t.appendChild(d)});const n=document.getElementById("contacts-panel-container");n&&n.querySelectorAll(".contacts-panel-sota").length===0&&ve(async()=>{const{createContactsPanel:l}=await import("./ContactsPage-Bcz2ods0.js");return{createContactsPanel:l}},__vite__mapDeps([5,1])).then(({createContactsPanel:l})=>{n.innerHTML="";const d=l();n.appendChild(d)});const s=document.getElementById("teams-panel-container");s&&s.children.length===0&&ve(async()=>{const{createTeamsPanel:l}=await import("./TeamsPage-BWparXHF.js");return{createTeamsPanel:l}},__vite__mapDeps([6,1])).then(({createTeamsPanel:l})=>{const d=l();s.appendChild(d)});const i=document.getElementById("roles-panel-container");i&&i.children.length===0&&ve(async()=>{const{renderRolesPanel:l}=await import("./RolesPage--fJeoR4I.js");return{renderRolesPanel:l}},__vite__mapDeps([7,1])).then(({renderRolesPanel:l})=>{l(i)});const a=document.getElementById("files-panel-container");a&&a.querySelectorAll(".documents-panel-minimal").length===0&&(a.innerHTML="",ve(async()=>{const{default:l}=await import("./DocumentsPage-0jCpkTn7.js");return{default:l}},__vite__mapDeps([8,1])).then(({default:l})=>{const d=l({onDocumentClick:async m=>{const{showDocumentPreviewModal:f}=await ve(async()=>{const{showDocumentPreviewModal:g}=await import("./DocumentPreviewModal-DEXaSRWs.js");return{showDocumentPreviewModal:g}},__vite__mapDeps([9,1]));f({document:m})}});a.appendChild(d)}).catch(l=>{console.error("[FilesPanel] Failed to load DocumentsPanel:",l),a.innerHTML='<div class="gm-loading-placeholder gm-text-secondary">Failed to load files panel</div>'}));const o=document.getElementById("org-chart-container");o&&o.children.length===0&&ve(async()=>{const{createOrgChart:l}=await import("./OrgChartPage-CHL2JSo3.js");return{createOrgChart:l}},__vite__mapDeps([10,1])).then(({createOrgChart:l})=>{const d=l();o.appendChild(d)});const r=document.getElementById("costs-container");r&&r.children.length===0&&ve(async()=>{const{createCostsDashboard:l}=await import("./CostsPage-D9rKbbMY.js");return{createCostsDashboard:l}},__vite__mapDeps([11,12,1])).then(({createCostsDashboard:l})=>{const d=l();r.appendChild(d)});const c=document.getElementById("history-container");c&&c.children.length===0&&ve(async()=>{const{createHistoryPanel:l,exportHistory:d}=await import("./HistoryPage-CAqt3rjs.js");return{createHistoryPanel:l,exportHistory:d}},__vite__mapDeps([13,1])).then(({createHistoryPanel:l,exportHistory:d})=>{const m=l({onRestore:g=>{h.info(`Restoring ${g.entityType} "${g.entityName||g.entityId}"`)}});c.appendChild(m);const f=document.getElementById("export-history-btn");f&&f.addEventListener("click",()=>d("json"))})}function tC(){const e=document.querySelectorAll(".dropzone-card[data-type]");console.log("[DropZones] Found",e.length,"dropzones"),e.forEach(t=>{const n=t.getAttribute("data-type");console.log("[DropZones] Adding click handler for:",n),t.addEventListener("click",async s=>{console.log("[DropZones] Click on:",n),s.preventDefault(),s.stopPropagation();try{switch(n){case"emails":console.log("[DropZones] Opening EmailComposer...");const{showEmailComposer:i}=await ve(async()=>{const{showEmailComposer:c}=await import("./EmailComposer-K6OuUU6Q.js");return{showEmailComposer:c}},__vite__mapDeps([14,1]));i({onSave:()=>{h.success("Email imported")}});return;case"conversations":console.log("[DropZones] Opening ConversationComposer...");const{showConversationComposer:a}=await ve(async()=>{const{showConversationComposer:c}=await import("./ConversationComposer-D6geblYj.js");return{showConversationComposer:c}},__vite__mapDeps([15,1]));a({onImport:()=>{h.success("Conversation imported")}});return;case"transcripts":console.log("[DropZones] Opening TranscriptComposer...");const{showTranscriptComposer:o}=await ve(async()=>{const{showTranscriptComposer:c}=await import("./TranscriptComposer-8ImAPOGY.js");return{showTranscriptComposer:c}},__vite__mapDeps([16,1]));o({onImport:()=>{h.success("Transcript imported")}});return;default:console.log("[DropZones] Opening file picker for documents...");const r=document.createElement("input");r.type="file",r.multiple=!0,r.accept=".pdf,.doc,.docx,.txt,.md,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.json",r.onchange=()=>{r.files&&r.files.length>0&&Fl(Array.from(r.files),"documents")},r.click();return}}catch(i){console.error("[DropZones] Error:",i),h.error("Failed to open import dialog")}}),t.addEventListener("dragover",s=>{s.preventDefault(),t.classList.add("drag-over")}),t.addEventListener("dragleave",()=>{t.classList.remove("drag-over")}),t.addEventListener("drop",s=>{s.preventDefault(),t.classList.remove("drag-over");const i=s.dataTransfer;i?.files&&i.files.length>0&&Fl(Array.from(i.files),n||"documents")})})}async function Fl(e,t){cC(e);const n=e.map(s=>s.name).join(", ");h.info(`Added ${e.length} ${t} to queue: ${n.substring(0,50)}${n.length>50?"...":""}`)}function Vl(){const e=document.getElementById("theme-toggle");e&&(e.textContent=Ke.getIcon(),e.title=`Theme: ${Ke.getLabel()}`)}const nC=["dashboard","chat","sot","timeline","contacts","team-analysis","files","graph","emails","costs","history","roles","profile","settings","admin","org","projects"];function Zl(){const t=window.location.pathname.match(/^\/app\/([^/]+)/);return t&&nC.includes(t[1])?t[1]:"dashboard"}function sC(e,t=!1){const n=e==="dashboard"?"/app":`/app/${e}`;window.location.pathname!==n&&(t?window.history.replaceState({tab:e},"",n):window.history.pushState({tab:e},"",n))}function iC(){window.addEventListener("popstate",t=>{const n=t.state?.tab||Zl();Ie(n,!1)});const e=Zl();e!=="dashboard"&&setTimeout(()=>Ie(e,!0),0)}function Ie(e,t=!0){J_(()=>{document.querySelectorAll(".nav-item[data-tab]").forEach(s=>{s.classList.toggle("active",s.getAttribute("data-tab")===e)}),document.querySelectorAll(".tab-content").forEach(s=>{s.classList.toggle("active",s.id===`tab-${e}`),s.classList.toggle("hidden",s.id!==`tab-${e}`)});const n=document.getElementById("app-sidebar");if(n&&n.classList.remove("open"),t&&sC(e),He.setTab(e),e==="profile"){const s=document.getElementById("profile-page-container");s&&ve(async()=>{const{initProfilePage:i}=await Promise.resolve().then(()=>D_);return{initProfilePage:i}},void 0).then(({initProfilePage:i})=>{i(s,{onBack:()=>Ie("dashboard")})})}if(e==="projects"){const s=document.getElementById("projects-page-container");s&&ve(async()=>{const{initProjectsPage:i}=await import("./ProjectsPage-SVccA0Z8.js");return{initProjectsPage:i}},__vite__mapDeps([17,1])).then(({initProjectsPage:i})=>{i(s,{onBack:()=>Ie("dashboard")})})}if(e==="settings"){const s=document.getElementById("settings-page-container");s&&ve(async()=>{const{initSettingsPage:i}=await import("./SettingsPage-DCLxZyCm.js");return{initSettingsPage:i}},__vite__mapDeps([18,1])).then(({initSettingsPage:i})=>{i(s,{onBack:()=>Ie("dashboard")})})}if(e==="admin"){const s=document.getElementById("tab-admin");s&&ve(async()=>{const{initAdminPanel:i}=await import("./AdminPage-DvsUAI95.js");return{initAdminPanel:i}},__vite__mapDeps([19,12,1])).then(({initAdminPanel:i})=>{i(s)})}if(e==="graph"){const s=document.getElementById("graph-container"),i=s?.querySelector(".graph-explorer");s&&!i&&(console.log("[Graph] Loading GraphExplorer..."),ve(async()=>{const{createGraphExplorer:a}=await import("./GraphExplorer-D4NfJ4W_.js");return{createGraphExplorer:a}},__vite__mapDeps([20,1])).then(({createGraphExplorer:a})=>{s.innerHTML="";const o=a({onNodeSelect:r=>{console.log("Graph node selected:",r)},onQueryExecute:r=>{console.log("Query executed:",r)}});s.appendChild(o),console.log("[Graph] GraphExplorer loaded successfully")}).catch(a=>{console.error("[Graph] Failed to load GraphExplorer:",a),s.innerHTML='<div class="gm-loading-placeholder gm-text-center">Failed to load Graph Explorer</div>'}))}if(e==="timeline"){const s=document.getElementById("timeline-content"),i=s?.querySelector(".timeline-panel");s&&!i&&(console.log("[Timeline] Loading TimelinePanel..."),ve(async()=>{const{createTimelinePanel:a}=await import("./TimelinePage-Yuu0vyeb.js");return{createTimelinePanel:a}},__vite__mapDeps([21,1])).then(({createTimelinePanel:a})=>{s.innerHTML="";const o=a({onEventClick:r=>{if(console.log("Timeline event clicked:",r),r.entity_type&&r.entity_id){const c=r.entity_type;c==="question"?c==="question"?ve(()=>Promise.resolve().then(()=>U2),void 0).then(async({createQuestionDetailView:l})=>{const d=document.getElementById("timeline-content");if(d&&r.entity_id)try{const m=await window.godmode.questions.get(r.entity_id);if(!m)throw new Error("Question not found");d.innerHTML="";const f=l({question:m,onClose:()=>Ie("timeline")});d.appendChild(f)}catch(m){console.error("Failed to load question details:",m),h.error("Failed to load question details")}}):c==="decision"?ve(()=>Promise.resolve().then(()=>Dx),void 0).then(async({createDecisionDetailView:l})=>{const d=document.getElementById("timeline-content");if(d&&r.entity_id)try{const m=await window.godmode.decisions.get(r.entity_id);if(!m)throw new Error("Decision not found");d.innerHTML="";const f=l({decision:m,onClose:()=>Ie("timeline")});d.appendChild(f)}catch(m){console.error("Failed to load decision details:",m),h.error("Failed to load decision details")}}):c==="fact"?ve(()=>Promise.resolve().then(()=>Fx),void 0).then(async({createFactDetailView:l})=>{const d=document.getElementById("timeline-content");if(d&&r.entity_id)try{const m=await window.godmode.facts.get(r.entity_id);if(!m)throw new Error("Fact not found");d.innerHTML="";const f=l({fact:m,onClose:()=>Ie("timeline")});d.appendChild(f)}catch(m){console.error("Failed to load fact details:",m),h.error("Failed to load fact details")}}):c==="risk"?ve(()=>Promise.resolve().then(()=>Q2),void 0).then(async({createRiskDetailView:l})=>{const d=document.getElementById("timeline-content");if(d&&r.entity_id)try{const m=await window.godmode.risks.get(r.entity_id);if(!m)throw new Error("Risk not found");d.innerHTML="";const f=l({risk:m,onClose:()=>Ie("timeline")});d.appendChild(f)}catch(m){console.error("Failed to load risk details:",m),h.error("Failed to load risk details")}}):c==="action"&&ve(()=>Promise.resolve().then(()=>Cx),void 0).then(async({createActionDetailView:l})=>{const d=document.getElementById("timeline-content");if(d&&r.entity_id)try{const m=await window.godmode.actions.get(r.entity_id);if(!m)throw new Error("Action not found");d.innerHTML="";const f=l({action:m,onClose:()=>Ie("timeline")});d.appendChild(f)}catch(m){console.error("Failed to load action details:",m),h.error("Failed to load action details")}}):h.info(`Event: ${r.title}`)}}});s.appendChild(o),console.log("[Timeline] TimelinePanel loaded successfully")}).catch(a=>{console.error("[Timeline] Failed to load TimelinePanel:",a),s.innerHTML='<div class="gm-loading-placeholder gm-text-center">Failed to load Timeline</div>'}))}if(e==="team-analysis"){const s=document.getElementById("team-analysis-container"),i=s?.querySelector(".team-analysis-panel");s&&!i?(console.log("[TeamAnalysis] Loading TeamAnalysis component..."),ve(async()=>{const{createTeamAnalysis:a}=await import("./TeamAnalysisPage-CTmup7Rb.js");return{createTeamAnalysis:a}},__vite__mapDeps([22,1])).then(({createTeamAnalysis:a})=>{s.innerHTML="";const o=a();s.appendChild(o),console.log("[TeamAnalysis] TeamAnalysis loaded successfully"),Gl()}).catch(a=>{console.error("[TeamAnalysis] Failed to load TeamAnalysis:",a),s.innerHTML='<div class="gm-loading-placeholder gm-text-center">Failed to load Team Analysis</div>'})):Gl()}})}function Gl(){ve(async()=>{const{teamAnalysisStore:e}=await Promise.resolve().then(()=>Q_);return{teamAnalysisStore:e}},void 0).then(({teamAnalysisStore:e})=>{document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(t=>{const n=t.cloneNode(!0);t.parentNode?.replaceChild(n,t),n.addEventListener("click",s=>{const i=s.target.dataset.subtab;i&&(console.log("[TeamAnalysis] Switching to subtab:",i),document.querySelectorAll("#team-analysis-subtabs .subtab").forEach(a=>{a.classList.toggle("active",a.getAttribute("data-subtab")===i)}),e.setSubtab(i))})})})}async function nc(){const e=document.getElementById("project-selector");if(e)try{const t=await Vn.getAll();e.innerHTML='<option value="">Select Project...</option>',t.forEach(i=>{const a=document.createElement("option");a.value=i.id,a.textContent=i.name+(i.isDefault?" (default)":""),e.appendChild(a)});const n=z.getState().currentProjectId,s=document.getElementById("edit-project-btn");if(n)e.value=n,s&&s.classList.remove("hidden");else if(t.length>0){const i=t.find(a=>a.isDefault)||t[0];e.value=i.id,z.setCurrentProject(i),z.setCurrentProjectId(i.id),s&&s.classList.remove("hidden")}else s&&s.classList.add("hidden")}catch(t){console.warn("Projects not available:",t)}}function Mo(){ce.setQuestions([]),ce.setRisks([]),ce.setActions([]),ce.setDecisions([]),ce.setFacts([]),ce.setContacts([]),ce.clearChatHistory(),Vp.reset(),Xn.destroyAll();try{localStorage.removeItem("copilot_session")}catch{}if(typeof window<"u"&&(window.location.hash||window.location.search)){const e=window.location.pathname||"/app";window.history.replaceState(null,"",e)}}async function oC(e){try{Mo();const t=await Vn.activate(e);t&&(h.success(`Switched to: ${t.name}`),await Mn())}catch{h.error("Failed to load project")}}async function Mn(){try{await nc();let e=z.getState().currentProject,t=z.getState().currentProjectId;if(!e&&!t){const r=document.getElementById("project-selector");if(r?.value)try{const c=await Vn.activate(r.value);c&&(z.setCurrentProject(c),z.setCurrentProjectId(c.id),e=c,t=c.id)}catch{}}if(!e&&!t){console.log("📭 No project selected - showing empty state"),Ie("dashboard"),Mo(),await br(),Un(He.getState().sotCurrentView);return}const[n,s,i,a,o]=await Promise.all([p.get("/api/questions").catch(()=>({data:{questions:[]}})),p.get("/api/risks").catch(()=>({data:{risks:[]}})),p.get("/api/actions").catch(()=>({data:{actions:[]}})),p.get("/api/decisions").catch(()=>({data:{decisions:[]}})),p.get("/api/contacts").catch(()=>({data:{contacts:[]}}))]);ce.setQuestions(n.data.questions||[]),ce.setRisks(s.data.risks||[]),ce.setActions(i.data.actions||[]),ce.setDecisions(a.data.decisions||[]),ce.setContacts(o.data.contacts||[]),await br(),Un(He.getState().sotCurrentView)}catch{console.error("Failed to refresh data")}}function aC(){const e=document.getElementById("dashboard-stats"),t=document.getElementById("dashboard-content");if(!e)return;const n=z.getState().currentProject,s=z.getState().currentProjectId;if(!n&&!s){e.innerHTML=`
      <div class="no-project-message gm-grid-col-all gm-empty-state gm-p-6">
        <svg class="gm-empty-state-icon" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <h3 class="gm-empty-state-title gm-text-lg">No Project Selected</h3>
        <p class="gm-empty-state-desc">
          Select an existing project from the dropdown above or create a new one to start managing your data.
        </p>
        <button id="create-project-cta" class="btn btn-primary gm-empty-state-cta">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create New Project
        </button>
      </div>
    `,t&&t.classList.add("gm-none");const o=document.getElementById("create-project-cta");o&&o.addEventListener("click",()=>{window.__godmodeProjectsOpen="create",Ie("projects")});return}t&&t.classList.remove("gm-none");const i=ce.getState(),a=i.questions.filter(o=>o.status!=="dismissed"&&o.status!=="resolved"&&o.status!=="answered");e.innerHTML=`
    <div class="stat-card">
      <div class="stat-value">${a.length}</div>
      <div class="stat-label">Questions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${i.risks.length}</div>
      <div class="stat-label">Risks</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${i.actions.length}</div>
      <div class="stat-label">Actions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${i.decisions.length}</div>
      <div class="stat-label">Decisions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${i.contacts.length}</div>
      <div class="stat-label">Contacts</div>
    </div>
  `}function Un(e){const t=document.getElementById("sot-content");if(t)switch(ce.getState(),e){case"questions":t.innerHTML="";const n=Lu({useDetailView:!0,containerElement:t});t.appendChild(n);return;case"facts":t.innerHTML="";const s=Is({useDetailView:!0,containerElement:t});t.appendChild(s);return;case"decisions":t.innerHTML="";const i=ko({useDetailView:!0,containerElement:t});t.appendChild(i);return;case"risks":t.innerHTML="";const a=vo({useDetailView:!0,containerElement:t});t.appendChild(a);return;case"actions":t.innerHTML="";const o=yo({useDetailView:!0,containerElement:t});t.appendChild(o);return;default:t.innerHTML='<p class="text-muted">Select a view</p>';return}}function yr(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}const gn=[];function qo(){const e=document.getElementById("pending-count"),t=document.getElementById("pending-files-list");e&&(e.textContent=`${gn.length} file${gn.length!==1?"s":""}`),t&&(gn.length===0?t.innerHTML='<div class="empty-hint">No files pending</div>':(t.innerHTML=gn.map((n,s)=>`
        <div class="pending-file-item" data-index="${s}">
          <div class="pending-file-info">
            <div class="pending-file-name" title="${yr(n.name)}">${yr(n.name)}</div>
            <div class="pending-file-size">${rC(n.size)}</div>
          </div>
          <button class="pending-file-remove" data-index="${s}" title="Remove">×</button>
        </div>
      `).join(""),t.querySelectorAll(".pending-file-remove").forEach(n=>{n.addEventListener("click",s=>{s.stopPropagation();const i=parseInt(n.dataset.index||"0");gn.splice(i,1),qo()})})))}function rC(e){return e<1024?e+" B":e<1024*1024?(e/1024).toFixed(1)+" KB":(e/(1024*1024)).toFixed(1)+" MB"}function cC(e){Array.from(e).forEach(t=>{gn.some(n=>n.name===t.name&&n.size===t.size)||gn.push(t)}),qo()}function lC(){const e=document.getElementById("process-files-btn");e&&e.addEventListener("click",async()=>{if(gn.length===0){h.warning("No files to process. Add files first.");return}e.setAttribute("disabled","true"),e.innerHTML='<span class="btn-icon">⏳</span> Processing...';try{const c=await Os.upload(gn);c.success&&(h.success(`Processed ${c.files.length} files successfully`),gn.length=0,qo(),Mn())}catch(c){h.error("Failed to process files"),console.error("Process error:",c)}finally{e.removeAttribute("disabled"),e.innerHTML='<span class="btn-icon">⚡</span> Process Files'}});const t=document.getElementById("export-knowledge-btn");t&&t.addEventListener("click",async()=>{try{const c=ce.getState(),l={facts:c.facts||[],decisions:c.decisions||[],exportedAt:new Date().toISOString()},d=new Blob([JSON.stringify(l,null,2)],{type:"application/json"}),m=URL.createObjectURL(d),f=document.createElement("a");f.href=m,f.download="godmode-knowledge-export.json",f.click(),URL.revokeObjectURL(m),h.success("Knowledge exported")}catch{h.error("Export failed")}});const n=document.getElementById("export-knowledge-clipboard");n&&n.addEventListener("click",async()=>{try{const c=ce.getState(),l={facts:c.facts||[],decisions:c.decisions||[]};await navigator.clipboard.writeText(JSON.stringify(l,null,2)),h.success("Copied to clipboard")}catch{h.error("Copy failed")}});const s=document.getElementById("export-questions-btn");s&&s.addEventListener("click",async()=>{try{const l=ce.getState().questions||[],d=new Blob([JSON.stringify(l,null,2)],{type:"application/json"}),m=URL.createObjectURL(d),f=document.createElement("a");f.href=m,f.download="godmode-questions-export.json",f.click(),URL.revokeObjectURL(m),h.success("Questions exported")}catch{h.error("Export failed")}});const i=document.getElementById("export-questions-clipboard");i&&i.addEventListener("click",async()=>{try{const l=ce.getState().questions||[];await navigator.clipboard.writeText(JSON.stringify(l,null,2)),h.success("Copied to clipboard")}catch{h.error("Copy failed")}});const a=document.getElementById("copy-overdue-btn");a&&a.addEventListener("click",async()=>{try{const c=ce.getState(),l=new Date,d=(c.actions||[]).filter(g=>{if(g.status==="completed")return!1;const v=g.dueDate;return v?new Date(v)<l:!1}),m=(c.questions||[]).filter(g=>{if(g.status==="resolved")return!1;const v=g.created_at||g.createdAt;if(!v)return!1;const y=new Date(v),S=new Date(l.getTime()-10080*60*1e3);return y<S}),f={actions:d,questions:m,exportedAt:l.toISOString()};await navigator.clipboard.writeText(JSON.stringify(f,null,2)),h.success(`Copied ${d.length} actions and ${m.length} questions`)}catch{h.error("Copy failed")}});const o=document.getElementById("clean-orphan-btn");o&&o.addEventListener("click",async()=>{if(await Zn("This will remove orphaned data entries that are not linked to any documents. Continue?",{title:"Clean Orphan Data",confirmText:"Clean",confirmClass:"btn-warning"}))try{const l=await p.post("/api/cleanup/orphans");h.success("Orphan data cleaned"),Mn()}catch{h.error("Cleanup failed")}});const r=document.getElementById("reset-data-btn");r&&r.addEventListener("click",async()=>{if(await Zn("This will clear all knowledge data (facts, decisions, questions, risks, actions, documents, etc.) for the current project. Team, contacts, and cost data will be kept. Continue?",{title:"Reset Project Data",confirmText:"Reset Knowledge Data",confirmClass:"btn-danger"}))try{await p.post("/api/reset"),h.success("Project data reset; team, contacts and cost preserved."),Mn()}catch{h.error("Reset failed")}}),qo()}async function Wl(){if(console.log("🚀 GodMode Frontend initializing..."),K_(),console.log("🔗 Legacy bridge initialized"),X_(),console.log("📡 API client configured"),await dC(),console.log("🔐 Auth initialized"),console.log(`📎 Theme: ${Ke.getMode()} (effective: ${Ke.getEffective()})`),Y_(),console.log("⌨️ Keyboard shortcuts registered"),Xu({onResultClick:t=>{console.log("Search result clicked:",t),window.dispatchEvent(new CustomEvent("godmode:navigate",{detail:t}))}}),console.log("🔍 Global search initialized"),window.addEventListener("godmode:projects-changed",()=>{nc()}),window.addEventListener("godmode:navigate",async t=>{const n=t.detail;if(!n||n.tab!=="files"||!n.documentId)return;Ie("files"),await new Promise(i=>setTimeout(i,400));const s=await Os.get(n.documentId);if(s){const{showDocumentPreviewModal:i}=await ve(async()=>{const{showDocumentPreviewModal:a}=await import("./DocumentPreviewModal-DEXaSRWs.js");return{showDocumentPreviewModal:a}},__vite__mapDeps([9,1]));i({document:s})}}),eC(),console.log("🎨 UI initialized"),iC(),console.log("🔀 Client-side routing initialized"),Pt.isAuthenticated())Mn(),console.log("📊 Data loading started");else if(z.getState().authConfigured){console.log("🔐 Authentication required - redirecting to landing page"),window.location.href="/";return}else console.log("📊 Guest mode - loading data"),Mn();const e=document.getElementById("app-loading");e&&(e.classList.add("fade-out"),setTimeout(()=>e.classList.add("hidden"),300)),console.log("✅ GodMode Frontend ready"),console.log(`📦 Version: ${window.godmode.version}`),console.log("💡 Press ? for keyboard shortcuts")}async function dC(){await Pt.init(),Ei(),Pt.onAuthRequired(()=>{Ur({required:!0,onSuccess:()=>{Ei(),Mn(),h.success("Session restored! Refreshing data...")}})}),window.addEventListener("godmode:auth-success",()=>{Ei(),Mn()})}function Ei(){const e=Pt.getCurrentUser(),t=document.getElementById("user-avatar"),n=document.getElementById("user-dropdown"),s=document.getElementById("login-btn"),i=document.getElementById("auth-blocker-overlay");i&&e&&i.remove();const a=document.getElementById("nav-admin-btn");if(e){if(t){const o=e.name||e.email.split("@")[0]||"User",r=(e.name?.[0]||e.email[0]).toUpperCase(),c=`https://ui-avatars.com/api/?name=${encodeURIComponent(o)}&background=e11d48&color=fff&size=80&font-size=0.4&bold=true`,l=e.avatar||c;t.innerHTML=`<img src="${l}" alt="${yr(r)}" class="gm-avatar-img" onerror="this.classList.add('gm-none');this.parentElement.textContent=this.alt">`,t.title=e.name||e.email,t.classList.remove("hidden")}if(s&&s.classList.add("hidden"),n){const o=n.querySelector(".user-name"),r=n.querySelector(".user-email");o&&(o.textContent=e.name||"User"),r&&(r.textContent=e.email)}a&&(e.role==="superadmin"?(a.classList.remove("hidden"),console.log("🔑 Admin nav enabled for superadmin:",e.email)):a.classList.add("hidden"))}else t&&t.classList.add("hidden"),s&&s.classList.remove("hidden"),a&&a.classList.add("hidden")}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Wl):Wl();Object.assign(window.godmode,{components:W_});export{CC as $,pd as A,pC as B,Vn as C,Pi as D,Ke as E,G$ as F,Q$ as G,xr as H,bc as I,Si as J,Vp as K,kC as L,gs as M,vC as N,wC as O,ry as P,bC as Q,SC as R,_C as S,fC as T,gC as U,mC as V,hC as W,xC as X,$C as Y,yC as Z,ve as _,z as a,TC as a0,AC as a1,ce as b,_ as c,fg as d,Bh as e,Ee as f,Fr as g,p as h,Je as i,MS as j,Qf as k,Os as l,kt as m,Ro as n,u as o,hs as p,mb as q,Mt as r,yp as s,h as t,Me as u,U as v,qe as w,LC as x,_u as y,Oo as z};
//# sourceMappingURL=main-v_cFye9p.js.map
