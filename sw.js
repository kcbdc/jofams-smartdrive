self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys()){if(k.startsWith('jofams-navi-'))await caches.delete(k)}await self.registration.unregister();const clients=await self.clients.matchAll({type:'window'});for(const c of clients)c.navigate(c.url)})()));
