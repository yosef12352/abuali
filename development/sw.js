const CACHE='abu-ali-chat-royal-v1';
const ASSETS=['./index.html','./account.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('abu-ali-chat-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 const isPage=request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/account.html');
 if(isPage){event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));return}
 if(!ASSETS.some(a=>url.pathname.endsWith(a.slice(2))))return;
 event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});