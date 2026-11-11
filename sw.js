const VERSION='asa-pocket-shell-0.6.38';
const FILES=['./','./index.html','./style.css?v=47','./app.js?v=45','./resolver.js','./resolver.js?v=39','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
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










						66 container
							67 text const VERSION = 'asa-pocket-shell-0.6.37' ;
						68 container
							69 text const FILES = [ './' , './index.html' , './style.css?v=46' , './app.js?v=44' , './resolver.js' , './resolver.js?v=39' , './manifest.webmanifest' , './icon.svg' , './icon-180.png' , './icon-192.png' , './icon-512.png' ] ;
						70 container
							71 text self . addEventListener ( 'install' , event => {
						72 container
							73 text event . waitUntil ( caches . open ( VERSION ) . then ( cache => cache . addAll ( FILES ) ) ) ;
						74 container
							75 text self . skipWaiting ( ) ;
						76 container
							77 text } ) ;
						78 container
							79 text self . addEventListener ( 'activate' , event => {
						80 container
							81 text event . waitUntil ( caches . keys ( ) . then ( keys => Promise . all ( keys . filter ( key => key . startsWith ( 'asa-pocket-shell-' ) && key !== VERSION ) . map ( key => caches . delete ( key ) ) ) ) . then ( ( ) => self . clients . claim ( ) ) ) ;
						82 container
							83 text } ) ;
						84 container
							85 text self . addEventListener ( 'fetch' , event => {
						86 container
							87 text const url = new URL ( event . request . url ) ;
						88 container
							89 text if ( event . request . method !== 'GET' || url . origin !== self . location . origin ) return ;
						90 container
							91 text if ( event . request . mode === 'navigate' ) {
						92 container
							93 text const root = new URL ( './' , self . registration . scope ) ;
						94 container
							95 text if ( url . pathname !== root . pathname && url . pathname !== root . pathname + 'index.html' ) return ;
						96 container
							97 text event . respondWith ( fetch ( event . request ) . catch ( async ( ) => {
						98 container
							99 text const cache = await caches . open ( VERSION ) ;
						100 container
							101 text return ( await cache . match ( root . href ) ) || Response . error ( ) ;
						102 container
							103 text } ) ) ; return ;
						104 container
							105 text }
						106 container
							107 text const allowed = new Set ( FILES . map ( file => new URL ( file , self . registration . scope ) . href ) ) ;
						108 container
							109 text if ( ! allowed . has ( url . href ) ) return ;
						110 container
							111 text event . respondWith ( caches . open ( VERSION ) . then ( async cache => ( await cache . match ( event . request ) ) || fetch ( event . request ) ) ) ;
						112 container
							113 text } ) ;
				114 container focus-trap-help-panel
					115 text Use 
					116 text Control + Shift + m
					117 text  to toggle the 
					118 text tab
					119 text  key moving focus. Alternatively, use 
					120 text esc
					121 text  then 
					122 text tab
					123 text  to move to the next interactive element on the page.

The focused UI element is 65 text entry area (settable) Editing sw.js file contents Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page., Value: const VERSION='asa-pocket-shell-0.6.37';
const FILES=['./','./index.html','./style.css?v=46','./app.js?v=44','./resolver.js','./resolver.js?v=39','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
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









