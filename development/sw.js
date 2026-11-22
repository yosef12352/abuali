const CACHE='abu-ali-chat-royal-v4';
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
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const id=event.notification.data?.conversationId;
 event.waitUntil((async()=>{
  const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=pages.find(client=>new URL(client.url).origin===self.location.origin);
  if(existing){await existing.focus();if(id)existing.postMessage({type:'OPEN_CHAT_FROM_NOTIFICATION',conversationId:id});return}
  await self.clients.openWindow(id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)?'./index.html?openChat='+encodeURIComponent(id):'./index.html');
 })());
});

self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?.json()||{}}catch{payload={}}
 const title='أبو علي شات';
 const options={
  body:typeof payload.body==='string'?payload.body.slice(0,160):'وصلتك رسالة جديدة',
  icon:'./icon.svg',badge:'./icon.svg',
  tag:typeof payload.tag==='string'?payload.tag.slice(0,120):'abu-ali-chat-message',
  data:{conversationId:typeof payload.conversationId==='string'?payload.conversationId:null}
 };
 event.waitUntil(self.registration.showNotification(title,options));
});
