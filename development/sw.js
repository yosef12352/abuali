const CACHE='abu-ali-chat-royal-v8';
const ASSETS=['./index.html','./account.html','./friends.html','./profile.html','./group-call.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('abu-ali-chat-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const asset=ASSETS.find(a=>url.pathname.endsWith(a.slice(2)));
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok&&asset){const cache=await caches.open(CACHE);await cache.put(asset,response.clone());}
    return response;
   }catch{
    const cached=await caches.match(asset||request,{ignoreSearch:true});
    return cached||Response.error();
   }
  })());
  return;
 }
 if(!asset)return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request,{cache:'no-store'});
   if(response.ok){const cache=await caches.open(CACHE);await cache.put(asset,response.clone());}
   return response;
  }catch{return (await caches.match(asset))||Response.error();}
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const rawId=event.notification.data?.conversationId;
 const id=typeof rawId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)?rawId:null;
 event.waitUntil((async()=>{
  const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=pages.find(client=>{const url=new URL(client.url);return url.origin===self.location.origin&&(url.pathname.endsWith('/index.html')||url.pathname.endsWith('/'))});
  if(existing){await existing.focus();if(id)existing.postMessage({type:'OPEN_CHAT_FROM_NOTIFICATION',conversationId:id});return}
  await self.clients.openWindow(id?'./index.html?openChat='+encodeURIComponent(id):'./index.html');
 })());
});

self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?.json()||{}}catch{payload={}}
 const title='أبو علي شات';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const conversationId=typeof payload.conversationId==='string'&&uuid.test(payload.conversationId)?payload.conversationId:null;
 const options={
  body:typeof payload.body==='string'?payload.body.slice(0,160):'وصلتك رسالة جديدة',
  icon:'./icon.svg',badge:'./icon.svg',
  tag:conversationId?'abu-ali-chat-'+conversationId:'abu-ali-chat-message',
  renotify:false,
  data:{conversationId},
  actions:[{action:'open',title:'فتح المحادثة'}]
 };
 event.waitUntil(self.registration.showNotification(title,options));
});
