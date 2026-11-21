const CACHE='abu-ali-chat-static-recovery-v5';
const ASSETS=['./','./index.html','./account.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;const path=new URL(request.url).pathname;if(request.mode==='navigate'||path.endsWith('/account.html')||path.endsWith('/index.html')||path==='/'){event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));return}if(!ASSETS.some(a=>path.endsWith(a.replace('./',''))))return;event.respondWith(caches.match(request).then(hit=>hit||fetch(request)))});
