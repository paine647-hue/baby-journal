// Pass-through fetch handler: required for Chrome install, and no caching so deploys are never stale.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));

self.addEventListener('push',e=>{
  let d={};
  try{d=e.data?e.data.json():{}}catch(err){}
  e.waitUntil(self.registration.showNotification(d.title||'Baby Journal',{
    body:d.body||'',
    icon:'/icons/icon-192.png',
    badge:'/icons/icon-192.png',
    tag:d.tag,
    data:{url:'/'}
  }));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list)if('focus' in c)return c.focus();
    return self.clients.openWindow(e.notification.data.url||'/');
  }));
});
