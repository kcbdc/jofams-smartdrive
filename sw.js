const CACHE='jofams-navi-7-5-7-1-20260903';
const STATIC=[
  '/manifest.webmanifest',
  '/assets/daim.png','/assets/sunsik.png','/assets/hunmin.png',
  '/assets/daim_car.png','/assets/sunsik_car.png','/assets/hunmin_car.png',
  '/assets/daim_car_marker.png','/assets/sunsik_car_marker.png','/assets/hunmin_car_marker.png',
  '/assets/daim_car_rear.png','/assets/sunsik_car_rear.png','/assets/hunmin_car_rear.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.pathname.startsWith('/api/')||u.pathname==='/config.js')return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
