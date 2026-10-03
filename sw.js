const VERSION='asa-pocket-shell-0.6.21';
const FILES=['./','./index.html','./style.css?v=30','./app.js?v=30','./resolver.js','./resolver.js?v=30','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(FILES)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('asa-pocket-shell-')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  const root=new URL('./',self.registration.scope);
  if(url.pathname!==root.pathname&&url.pathname!==root.pathname+'index.html')return;
  event.respondWith(fetch(event.request).catch(async()=>{
   const cache=await caches.open(VERSION);
   return (await cache.match(root.href))||Response.error();
  }));return;
 }
 const allowed=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
 if(!allowed.has(url.href))return;
 event.respondWith(caches.open(VERSION).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});




