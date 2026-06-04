const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./ghost-DVg28pLu.js","./ghostConfig-DTcIVsJK.js"])))=>i.map(i=>d[i]);
import{r as n,j as e,_ as T}from"./index-CSF1GnQX.js";import{c as E,B as M,C as z}from"./ChatPopover-f5LfOhCP.js";/**
 * @license lucide-react v0.555.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],L=E("loader-circle",G);/**
 * @license lucide-react v0.555.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P=[["path",{d:"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8",key:"1p45f6"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}]],C=E("rotate-cw",P);/**
 * @license lucide-react v0.555.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],W=E("x",_);function B({message:i,icon:a,onComplete:d}){const[p,h]=n.useState(""),[w,g]=n.useState(!1),[u,m]=n.useState(!1),[s,r]=n.useState(!1);return n.useEffect(()=>{console.log("Message updated:",i)},[i]),n.useEffect(()=>{if(!i){h(""),g(!1),m(!1),r(!1);return}h(i),g(!0),d?.()},[i,d]),i?e.jsxs("div",{style:{maxWidth:"240px",padding:"12px 16px",background:"linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 100%)",color:"#1a1a1a",fontFamily:"'Inter', sans-serif",fontSize:"15px",fontWeight:"500",borderRadius:"18px",boxShadow:"0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",border:"1.5px solid rgba(255,255,255,0.5)",whiteSpace:"pre-wrap",wordBreak:"break-word",textAlign:"left",pointerEvents:"none",position:"relative",animation:"fadeInScale 0.3s ease-out"},children:[e.jsxs("div",{style:{minHeight:"20px",display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{style:{flex:1},children:p}),w&&a&&!s&&e.jsx("img",{src:a,alt:"app icon",onLoad:()=>m(!0),onError:()=>{console.warn("Failed to load icon:",a),r(!0)},style:{width:"24px",height:"24px",borderRadius:"4px",animation:"slowIconFadeIn 0.8s ease-out",flexShrink:0,opacity:u?1:.5}})]}),e.jsx("style",{children:`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slowIconFadeIn {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-15deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        /* Typing cursor blink effect */
        @keyframes blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `})]}):null}function D({nsfw:i=!1,onClose:a}){const[d,p]=n.useState(null),[h,w]=n.useState(!0),[g,u]=n.useState(null),m=async()=>{w(!0),u(null);try{const r=await(await fetch("https://meme-api.com/gimme")).json();console.log("Fetched meme data:",r),r&&r.title&&r.url?p({title:r.title,image:r.url}):u("Failed to fetch meme data")}catch(s){console.error("Error fetching meme:",s),u(`Error: ${s instanceof Error?s.message:"Unknown error"}`)}finally{w(!1)}};return n.useEffect(()=>{m()},[i]),e.jsxs("div",{style:{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%, -50%)",zIndex:1e3,pointerEvents:"auto"},onMouseEnter:()=>{window.electronAPI?.setClickThrough(!1)},onMouseLeave:()=>{window.electronAPI?.setClickThrough(!0)},children:[e.jsx("div",{onClick:()=>{window.electronAPI?.setClickThrough(!0),a()},style:{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0, 0, 0, 0.7)",zIndex:999,pointerEvents:"auto"}}),e.jsxs("div",{style:{position:"relative",zIndex:1001,backgroundColor:"#1e293b",borderRadius:"16px",padding:"24px",maxWidth:"600px",width:"90vw",boxShadow:"0 20px 60px rgba(0, 0, 0, 0.3)",border:"1px solid rgba(255, 255, 255, 0.1)",animation:"slideIn 0.3s ease-out",pointerEvents:"auto"},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"},children:[e.jsx("h2",{style:{color:"#f1f5f9",fontSize:"18px",fontWeight:"600",margin:0},children:i?"🔞 NSFW Meme":"😂 Random Meme"}),e.jsx("button",{onClick:()=>{window.electronAPI?.setClickThrough(!0),a()},style:{background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",padding:"4px",display:"flex",alignItems:"center",justifyContent:"center",transition:"color 0.2s"},onMouseEnter:s=>s.currentTarget.style.color="#f1f5f9",onMouseLeave:s=>s.currentTarget.style.color="#94a3b8",children:e.jsx(W,{size:24})})]}),e.jsx("div",{style:{minHeight:"300px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"16px",pointerEvents:"auto"},children:h?e.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px"},children:[e.jsx(L,{size:32,style:{color:"#a855f7",animation:"spin 1s linear infinite"}}),e.jsx("p",{style:{color:"#94a3b8"},children:"Loading meme..."})]}):g?e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{color:"#ef4444",marginBottom:"12px"},children:g}),e.jsxs(M,{onClick:m,style:{background:"linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",color:"white"},children:[e.jsx(C,{size:16,style:{marginRight:"8px"}}),"Retry"]})]}):d?e.jsxs(e.Fragment,{children:[e.jsx("img",{src:d.image,alt:d.title,style:{maxWidth:"100%",maxHeight:"400px",borderRadius:"8px",objectFit:"contain",animation:"fadeIn 0.3s ease-out"}}),e.jsx("p",{style:{color:"#cbd5e1",fontSize:"14px",textAlign:"center",margin:"0",fontStyle:"italic"},children:d.title})]}):null}),e.jsxs("div",{style:{display:"flex",gap:"12px",marginTop:"20px",justifyContent:"space-between",pointerEvents:"auto"},children:[e.jsxs(M,{onClick:m,disabled:h,style:{background:"linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",color:"white",flex:1},children:[e.jsx(C,{size:16,style:{marginRight:"8px"}}),"Next Meme"]}),e.jsx(M,{onClick:()=>{window.electronAPI?.setClickThrough(!0),a()},style:{background:"rgba(255, 255, 255, 0.1)",color:"#f1f5f9",border:"1px solid rgba(255, 255, 255, 0.2)"},children:"Close"})]})]}),e.jsx("style",{children:`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `})]})}function $(){const[i,a]=n.useState(""),[d,p]=n.useState(null),[h,w]=n.useState({x:0,y:0}),[g,u]=n.useState(""),[m,s]=n.useState(!1),[r,S]=n.useState(!1),v=n.useRef(null),I=n.useRef(null),f=n.useRef(null),y=n.useRef(null);n.useEffect(()=>{const o=(t,l,b=5e3)=>{if(f.current&&(clearInterval(f.current),f.current=null),y.current&&(clearTimeout(y.current),y.current=null),a(t),u(""),l)try{const c=window.electronAPI?.pathToFileURL?.(l);p(c||l)}catch(c){console.warn("Failed to convert icon path:",c),p(l)}else p(null);if(t){let c=0;f.current=window.setInterval(()=>{c<t.length?(u(t.slice(0,c+1)),c++):(f.current&&(clearInterval(f.current),f.current=null),b>0&&(y.current=window.setTimeout(()=>{a(""),u(""),p(null),y.current=null},b)))},30)}};return window.setGhostMessage=o,console.log("Window.setGhostMessage initialized with typing effect"),()=>{delete window.setGhostMessage,f.current&&clearInterval(f.current),y.current&&clearTimeout(y.current)}},[]);const R=async o=>{console.log("/open",o);try{const t=await window.electronAPI?.launchApp?.(o);return t&&t.message?(window.setGhostMessage?.(t.message,t.icon,5e3),t):(window.setGhostMessage?.("Launching...",null,2e3),null)}catch(t){throw console.warn("Failed to run /open",t),window.setGhostMessage?.("No App Found...",null,3e3),t}},A=o=>{console.log("/meme",o);const t=o?.toLowerCase().includes("--nsfw");S(t),s(!0)},F=async o=>{console.log("/ask",o);try{window.setGhostMessage?.("Thinking...",null,0);const t=await window.electronAPI?.askGhost?.(o);return t&&window.setGhostMessage?.(t,null,1e4),t}catch(t){throw console.warn("Failed to run /ask",t),t}};return n.useEffect(()=>{T(()=>import("./ghost-DVg28pLu.js"),__vite__mapDeps([0,1]),import.meta.url).catch(t=>console.error("Failed to load legacy ghost module:",t));const o=()=>{const t=document.getElementById("ghost-drag-area");if(t){const l=t.getBoundingClientRect(),b=I.current?.offsetWidth||240,c=I.current?.offsetHeight||80,x=16;let j=l.right+20,k=l.top-80;j+b+x>window.innerWidth&&(j=l.left-b-20),j<x&&(j=Math.max(x,Math.min(l.left,window.innerWidth-b-x))),k<x&&(k=l.bottom+20),k+c+x>window.innerHeight&&(k=Math.max(x,window.innerHeight-c-x)),w({x:j,y:k})}v.current=requestAnimationFrame(o)};return v.current=requestAnimationFrame(o),()=>{v.current&&cancelAnimationFrame(v.current)}},[]),e.jsxs("div",{style:{width:"100%",height:"100%",margin:0,position:"relative"},children:[e.jsx("div",{style:{position:"absolute",top:12,left:12,padding:8,pointerEvents:"auto",zIndex:10,background:"transparent"},children:e.jsx(z,{onOpenCommand:o=>void R(o),onMemeCommand:A,onAskCommand:o=>void F(o)})}),e.jsx("div",{id:"ghost-drag-area",style:{position:"fixed",width:100,height:100,background:"transparent",border:"none",borderRadius:"50%",pointerEvents:"auto",cursor:"grab",zIndex:5,opacity:1}}),g&&e.jsx("div",{ref:I,style:{position:"fixed",left:`${h.x}px`,top:`${h.y}px`,zIndex:8,pointerEvents:"none"},children:e.jsx(B,{message:g,icon:d,onComplete:()=>{}})}),m&&e.jsx(D,{nsfw:r,onClose:()=>s(!1)}),e.jsx("canvas",{id:"ghost-canvas",style:{display:"block",width:"100%",height:"100%",pointerEvents:"none"}})]})}export{$ as default};
