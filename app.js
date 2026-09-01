const $ = id => document.getElementById(id);
const CONFIG = window.__APP_CONFIG__ || {};
const characterDefs = {
  daim:{name:'다임',car:'/assets/daim_car.png',marker:'/assets/daim_car_marker.png',avatar:'/assets/daim.png',rate:.96,pitch:1.08,voiceLabel:'다임 보이스'},
  sunsik:{name:'순식',car:'/assets/sunsik_car.png',marker:'/assets/sunsik_car_marker.png',avatar:'/assets/sunsik.png',rate:1.0,pitch:.90,voiceLabel:'순식 보이스'},
  hunmin:{name:'훈민',car:'/assets/hunmin_car.png',marker:'/assets/hunmin_car_marker.png',avatar:'/assets/hunmin.png',rate:1.08,pitch:.82,voiceLabel:'훈민 보이스'}
};
const state = {
  map:null, user:null, destination:null, routeOptions:[], route:null, selectedRoute:0,
  userMarker:null,destMarker:null,watchId:null,character:'daim',voiceVolume:.8,sound:true,
  autoStartTimer:null,autoStartSeconds:0,routeCumulative:[],currentRouteIndex:0,lastRerouteAt:0,lastGuideSpoken:'',tripStartedAt:0,
  savedPlaces:{home:null,work:null},favorites:[],placeKind:null,
  firebase:{configured:false,ready:false,user:null,auth:null,db:null,mods:null}
};

/* ---------- SVG ICONS ---------- */
function icon(name){
  const common='fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const map={
    menu:`<svg viewBox="0 0 24 24" ${common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    user:`<svg viewBox="0 0 24 24" ${common}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6"/></svg>`,
    search:`<svg viewBox="0 0 24 24" ${common}><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg>`,
    'arrow-right':`<svg viewBox="0 0 24 24" ${common}><path d="M5 12h14m-5-5 5 5-5 5"/></svg>`,
    home:`<svg viewBox="0 0 24 24" ${common}><path d="m3 11 9-7 9 7"/><path d="M6 10v10h12V10M10 20v-6h4v6"/></svg>`,
    office:`<svg viewBox="0 0 24 24" ${common}><path d="M5 21V4h10v17M15 9h4v12M8 8h4M8 12h4M8 16h4"/></svg>`,
    star:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9z"/></svg>`,
    'star-outline':`<svg viewBox="0 0 24 24" ${common}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>`,
    chevron:`<svg viewBox="0 0 24 24" ${common}><path d="m9 5 7 7-7 7"/></svg>`,
    back:`<svg viewBox="0 0 24 24" ${common}><path d="m15 5-7 7 7 7"/></svg>`,
    close:`<svg viewBox="0 0 24 24" ${common}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    mic:`<svg viewBox="0 0 24 24" ${common}><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>`,
    refresh:`<svg viewBox="0 0 24 24" ${common}><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>`,
    routes:`<svg viewBox="0 0 24 24" ${common}><path d="M6 20V9a4 4 0 0 1 4-4h8"/><path d="m15 2 3 3-3 3"/><path d="M6 14h8a4 4 0 0 1 4 4v2"/></svg>`,
    settings:`<svg viewBox="0 0 24 24" ${common}><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.6a7 7 0 0 0-.8-1.8l1-1.9-2.2-2.1-1.8 1A7 7 0 0 0 11 4.5L10.5 2h-3L7 4.5a7 7 0 0 0-1.9.8l-1.8-1-2.2 2.1 1 1.9a7 7 0 0 0-.8 1.8l-2 .6v3l2 .6a7 7 0 0 0 .8 1.8l-1 1.9 2.2 2.1 1.8-1a7 7 0 0 0 1.9.8l.5 2.5h3l.5-2.5a7 7 0 0 0 1.9-.8l1.8 1 2.2-2.1-1-1.9a7 7 0 0 0 .8-1.8z" transform="scale(.8) translate(3 3)"/></svg>`,
    share:`<svg viewBox="0 0 24 24" ${common}><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8 11 7.5-4.5M8 13l7.5 4.5"/></svg>`,
    volume:`<svg viewBox="0 0 24 24" ${common}><path d="M4 14h4l5 4V6l-5 4H4zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>`,
    car:`<svg viewBox="0 0 24 24" ${common}><path d="M5 17h14l-1-6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2zM7 17v2M17 17v2M8 14h.1M16 14h.1"/><path d="M7 9l2-4h6l2 4"/></svg>`
  };
  return map[name]||'';
}
function applyIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon))}
function turnSvg(type,color='#fff'){
  const s=`fill="none" stroke="${color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"`;
  if(type===1||type===5) return `<svg viewBox="0 0 24 24" ${s}><path d="M20 18V11a5 5 0 0 0-5-5H6"/><path d="m10 2-4 4 4 4"/></svg>`;
  if(type===2||type===6) return `<svg viewBox="0 0 24 24" ${s}><path d="M4 18V11a5 5 0 0 1 5-5h9"/><path d="m14 2 4 4-4 4"/></svg>`;
  if(type===3) return `<svg viewBox="0 0 24 24" ${s}><path d="M17 20V10a5 5 0 1 0-10 0v4"/><path d="m3 10 4 4 4-4"/></svg>`;
  if((type>=30&&type<=41)||(type>=70&&type<=81)) return `<svg viewBox="0 0 24 24" ${s}><path d="M6 9a7 7 0 1 1 2 8"/><path d="m5 5 1 4 4-1"/></svg>`;
  return `<svg viewBox="0 0 24 24" ${s}><path d="M12 21V4"/><path d="m7 9 5-5 5 5"/></svg>`;
}

/* ---------- HELPERS ---------- */
function toast(msg,ms=2200){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),ms)}
function km(m){if(!Number.isFinite(m))return '--';return m<1000?`${Math.round(m)}m`:`${(m/1000).toFixed(m<10000?1:0)}km`}
function mins(sec){return `${Math.max(1,Math.round((sec||0)/60))}분`}
function eta(sec){const d=new Date(Date.now()+(sec||0)*1000);return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}
function hav(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function bearing(a,b,c,d){const p=Math.PI/180,y=Math.sin((d-b)*p)*Math.cos(c*p),x=Math.cos(a*p)*Math.sin(c*p)-Math.sin(a*p)*Math.cos(c*p)*Math.cos((d-b)*p);return (Math.atan2(y,x)/p+360)%360}
function pointValid(p){return p&&Number.isFinite(Number(p.lng))&&Number.isFinite(Number(p.lat))}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function nearestIndex(lng,lat,geometry){let bi=0,bd=Infinity;const stride=Math.max(1,Math.floor((geometry?.length||0)/1200));for(let i=0;i<(geometry?.length||0);i+=stride){const p=geometry[i],d=(p[0]-lng)**2+(p[1]-lat)**2;if(d<bd){bd=d;bi=i}}return bi}
function buildCumulative(route){const g=route?.geometry||[],arr=new Array(g.length).fill(0);for(let i=1;i<g.length;i++)arr[i]=arr[i-1]+hav(g[i-1][1],g[i-1][0],g[i][1],g[i][0]);return arr}
function normalizedPlace(x){return x?{id:x.id||'',name:x.name||'목적지',address:x.address||'',lng:Number(x.lng),lat:Number(x.lat)}:null}

/* ---------- MAP ---------- */
function rasterStyle(){return {version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]}}
function initMap(){
  state.map=new maplibregl.Map({container:'map',style:rasterStyle(),center:[127.3847,36.3784],zoom:14,attributionControl:true});
  state.map.on('load',()=>locate(false));
}
function makeCarMarker(){const el=document.createElement('div');el.className='character-car-marker';el.innerHTML=`<img src="${characterDefs[state.character].marker}" alt="${characterDefs[state.character].name} 자동차">`;return new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'viewport'});}
function updateCarMarkerImage(){const img=state.userMarker?.getElement()?.querySelector('img');if(img)img.src=characterDefs[state.character].marker}
function makeDestMarker(){const el=document.createElement('div');el.className='destination-pin';return new maplibregl.Marker({element:el,anchor:'bottom'})}
function ensureUserMarker(){if(!state.user||!state.map)return;if(!state.userMarker)state.userMarker=makeCarMarker().setLngLat([state.user.lng,state.user.lat]).addTo(state.map);else state.userMarker.setLngLat([state.user.lng,state.user.lat])}
function setDestinationMarker(){if(state.destMarker)state.destMarker.remove();if(state.destination&&state.map)state.destMarker=makeDestMarker().setLngLat([state.destination.lng,state.destination.lat]).addTo(state.map)}
function drawRoute(route=state.route,{fit=true}={}){
  if(!state.map?.isStyleLoaded()||!route?.geometry?.length)return;
  const data={type:'Feature',geometry:{type:'LineString',coordinates:route.geometry},properties:{}};
  if(state.map.getSource('route'))state.map.getSource('route').setData(data);else{
    state.map.addSource('route',{type:'geojson',data});
    state.map.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':10,'line-opacity':.95}});
    state.map.addLayer({id:'route-main',type:'line',source:'route',paint:{'line-color':'#1c72f2','line-width':7,'line-opacity':1}});
  }
  if(fit){const b=new maplibregl.LngLatBounds();route.geometry.forEach(p=>b.extend(p));state.map.fitBounds(b,{padding:{top:100,bottom:310,left:36,right:36},duration:650})}
}
function clearRouteLayer(){['route-main','route-shadow'].forEach(id=>{if(state.map?.getLayer(id))state.map.removeLayer(id)});if(state.map?.getSource('route'))state.map.removeSource('route')}

/* ---------- LOCATION ---------- */
async function locate(fly=true){
  if(!navigator.geolocation){toast('위치 기능을 지원하지 않습니다.');return null}
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>{applyGps(p,fly);resolve(state.user)},()=>{toast('현재 위치 권한을 확인해 주세요.');resolve(null)},{enableHighAccuracy:true,timeout:7000,maximumAge:3000}))
}
function applyGps(pos,fly=false){
  const c=pos.coords||pos,stateObj={lng:Number(c.longitude??c.lng),lat:Number(c.latitude??c.lat),speed:Number(c.speed)||0,heading:Number(c.heading),accuracy:Number(c.accuracy)||0};
  if(!pointValid(stateObj))return;state.user=stateObj;ensureUserMarker();
  if(fly)state.map.easeTo({center:[stateObj.lng,stateObj.lat],zoom:16,duration:500});
  if(state.route&&$('driveView')&&!$('driveView').classList.contains('hidden'))updateDriving();
}
function startWatch(){if(state.watchId!=null)return;state.watchId=navigator.geolocation.watchPosition(p=>applyGps(p,false),()=>{}, {enableHighAccuracy:true,maximumAge:1000,timeout:10000})}
function stopWatch(){if(state.watchId!=null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null}}

/* ---------- SEARCH / SAVED PLACES ---------- */
async function searchPlaces(q,target='searchResults'){
  const box=$(target);if(!q?.trim())return;box.classList.remove('hidden');box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';
  try{const u=new URL('/api/search',location.origin);u.searchParams.set('q',q.trim());if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}const r=await fetch(u);if(!r.ok)throw new Error('검색 오류');const d=await r.json();const items=d.items||[];box.innerHTML='';if(!items.length){box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>';return}items.slice(0,8).forEach(x=>{const b=document.createElement('button');b.className='search-result';b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}</small>`;b.onclick=()=>target==='placeSearchResults'?saveRegisteredPlace(x):chooseDestination(x);box.appendChild(b)})}catch(e){box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}
async function chooseDestination(item){
  if(!state.user)await locate(false);if(!state.user){toast('출발 위치를 확인할 수 없습니다.');return}
  state.destination=normalizedPlace(item);setDestinationMarker();$('searchResults').classList.add('hidden');$('routeDestinationName').textContent=state.destination.name;$('routeAddressDest').textContent=state.destination.name;setView('route');await loadRouteOptions();
}
function openPlaceModal(kind){state.placeKind=kind;$('placeModalTitle').textContent=kind==='home'?'집 등록':'회사 등록';$('placeSearchInput').value='';$('placeSearchResults').innerHTML='';$('placeModal').classList.remove('hidden');setTimeout(()=>$('placeSearchInput').focus(),100)}
async function saveRegisteredPlace(x){const p=normalizedPlace(x);state.savedPlaces[state.placeKind]=p;saveLocalSettings();await saveCloudPrefs();updateSavedLabels();$('placeModal').classList.add('hidden');toast(`${state.placeKind==='home'?'집':'회사'}을 저장했습니다.`)}
function updateSavedLabels(){$('homeLabel').textContent=state.savedPlaces.home?.name||'등록';$('workLabel').textContent=state.savedPlaces.work?.name||'등록';$('favoriteLabel').textContent=`${state.favorites.length}곳`;$('myFavoriteCount').textContent=`${state.favorites.length}곳 저장`}

/* ---------- ROUTES ---------- */
async function routeRequest(priority='RECOMMEND',avoid=null){
  const body={origin:{lng:state.user.lng,lat:state.user.lat,heading:state.user.heading},destination:{lng:state.destination.lng,lat:state.destination.lat},priority,alternatives:false};if(avoid)body.avoid=avoid;
  const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('경로 조회 실패');return r.json();
}
async function loadRouteOptions(){
  cancelAutoStart();$('routeCards').innerHTML='<div class="auto-start-hint">경로를 계산하고 있습니다...</div>';
  try{
    const results=await Promise.allSettled([routeRequest('RECOMMEND'),routeRequest('TIME'),routeRequest('RECOMMEND','toll')]);
    const specs=[['추천','daim',''],['빠른길','sunsik','fast'],['무료도로','hunmin','free']];state.routeOptions=[];
    results.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value?.geometry?.length)state.routeOptions.push({...r.value,_label:specs[i][0],_character:specs[i][1],_class:specs[i][2]})});
    if(!state.routeOptions.length)throw new Error('경로가 없습니다.');state.selectedRoute=0;selectRoute(0,false);renderRouteCards();scheduleAutoStart();
  }catch(e){$('routeCards').innerHTML='<div class="auto-start-hint">경로를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';toast(e.message,3000)}
}
function renderRouteCards(){
  const box=$('routeCards');box.innerHTML='';state.routeOptions.forEach((r,i)=>{const c=characterDefs[r._character],b=document.createElement('button');b.className=`route-card ${i===state.selectedRoute?'selected':''}`;const fare=r.fare?.toll||0;b.innerHTML=`<div class="route-meta"><span class="route-tag ${r._class}">${r._label}</span><strong>${mins(r.duration)}</strong><small>${km(r.distance)} · ${fare?`${fare.toLocaleString()}원`:'통행료 0원'}</small></div><img src="${c.car}" alt="${c.name} 자동차">`;b.onclick=()=>{selectRoute(i,true);renderRouteCards();scheduleAutoStart()};box.appendChild(b)})
}
function selectRoute(index,fit=true){state.selectedRoute=index;state.route=state.routeOptions[index];syncCharacterUI();drawRoute(state.route,{fit});state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0}
function scheduleAutoStart(){cancelAutoStart();state.autoStartSeconds=3;updateAutoHint();state.autoStartTimer=setInterval(()=>{state.autoStartSeconds--;if(state.autoStartSeconds<=0){cancelAutoStart();startNavigation()}else updateAutoHint()},1000)}
function cancelAutoStart(){if(state.autoStartTimer){clearInterval(state.autoStartTimer);state.autoStartTimer=null}}
function updateAutoHint(){$('autoStartHint').textContent=state.autoStartSeconds>0?`${state.autoStartSeconds}초 후 자동으로 안내를 시작합니다.`:''}

/* ---------- DRIVE ---------- */
async function logTrip(event){try{await fetch('/api/trip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,destination:state.destination?.name||null,distance:state.route?.distance||null,duration:state.tripStartedAt?Math.round((Date.now()-state.tripStartedAt)/1000):null,character:state.character,provider:state.route?.provider||null,guideType:null})})}catch{}}
function setView(view){$('homeView').classList.toggle('hidden',view!=='home');$('routeView').classList.toggle('hidden',view!=='route');$('driveView').classList.toggle('hidden',view!=='drive');if(view==='home'){state.map.easeTo({pitch:0,bearing:0})}}
function startNavigation(){if(!state.route||!state.destination)return;cancelAutoStart();state.tripStartedAt=Date.now();logTrip('start');setView('drive');startWatch();ensureUserMarker();updateCarMarkerImage();state.routeCumulative=buildCumulative(state.route);drawRoute(state.route,{fit:false});updateDriving(true);speak(`${characterDefs[state.character].name}이 안내를 시작합니다.`)}
function stopNavigation(){if(state.tripStartedAt)logTrip('finish');state.tripStartedAt=0;stopWatch();cancelAutoStart();$('driveMenu').classList.add('hidden');clearRouteLayer();state.route=null;state.routeOptions=[];if(state.destMarker){state.destMarker.remove();state.destMarker=null}state.destination=null;setView('home');toast('안내를 종료했습니다.')}
function updateDriving(force=false){
  if(!state.user||!state.route?.geometry?.length)return;const g=state.route.geometry,idx=nearestIndex(state.user.lng,state.user.lat,g);state.currentRouteIndex=idx;ensureUserMarker();
  const nextPoint=g[Math.min(g.length-1,idx+3)],heading=Number.isFinite(state.user.heading)?state.user.heading:(nextPoint?bearing(state.user.lat,state.user.lng,nextPoint[1],nextPoint[0]):0);
  state.map.easeTo({center:[state.user.lng,state.user.lat],zoom:17.2,pitch:48,bearing:heading,duration:force?0:650,padding:{top:120,bottom:170,left:0,right:0}});
  updateProgressUI(idx);checkOffRoute(idx);
}
function updateProgressUI(idx){
  const total=state.routeCumulative.at(-1)||state.route.distance||1,done=state.routeCumulative[idx]||0,remain=Math.max(0,total-done),ratio=Math.max(0,Math.min(1,remain/total)),remainSec=(state.route.duration||0)*ratio;
  $('remainingDistance').textContent=km(remain);$('remainingTime').textContent=mins(remainSec);$('arrivalTime').textContent=`도착 ${eta(remainSec)}`;
  const seg=(state.route.roadSegments||[]).find(s=>idx>=s.startIndex&&idx<=s.endIndex);$('currentRoadLabel').textContent=seg?.name||'일반도로';
  const limit=Number(seg?.speedLimit)||0,speed=Math.max(0,Math.round((state.user.speed||0)*3.6));$('currentSpeed').textContent=speed;if(limit){$('speedPanel').classList.remove('hidden');$('speedLimit').textContent=limit}else $('speedPanel').classList.add('hidden');
  const guides=(state.route.guides||[]).filter(x=>Number(x.routeIndex)>idx+1);const first=guides[0],second=guides[1];
  if(first){const d=distanceAlong(idx,first.routeIndex);$('maneuverIcon').innerHTML=turnSvg(first.type);$('maneuverDistance').textContent=km(d);$('maneuverRoad').textContent=first.name||first.guidance||'교차로';maybeSpeakGuide(first,d)}else{$('maneuverIcon').innerHTML=turnSvg(0);$('maneuverDistance').textContent=km(remain);$('maneuverRoad').textContent='목적지까지 직진'}
  if(second){$('nextManeuver').classList.remove('hidden');$('nextManeuverIcon').innerHTML=turnSvg(second.type);$('nextManeuverDistance').textContent=km(distanceAlong(idx,second.routeIndex));$('nextManeuverText').textContent=second.guidance||'다음 안내'}else $('nextManeuver').classList.add('hidden');
  if(remain<28){speak('목적지에 도착했습니다.');setTimeout(stopNavigation,1400)}
}
function distanceAlong(a,b){const ca=state.routeCumulative[Math.max(0,a)]||0,cb=state.routeCumulative[Math.min(state.routeCumulative.length-1,b)]||ca;return Math.max(0,cb-ca)}
function maybeSpeakGuide(g,d){const key=`${g.id||g.routeIndex}:${d<80?'near':'far'}`;if(key===state.lastGuideSpoken)return;if(d<320){state.lastGuideSpoken=key;speak(`${Math.max(30,Math.round(d/10)*10)}미터 앞 ${g.guidance||g.name||'방향 안내'}입니다.`)}}
async function reroute(){if(!state.user||!state.destination)return;state.lastRerouteAt=Date.now();toast('경로를 다시 탐색합니다.');speak('경로를 다시 탐색합니다.');try{const r=await routeRequest('RECOMMEND');state.route={...r,_label:'재탐색',_character:state.character};state.routeCumulative=buildCumulative(state.route);drawRoute(state.route,{fit:false});updateDriving(true)}catch{toast('재탐색에 실패했습니다.') }}
function checkOffRoute(idx){if(Date.now()-state.lastRerouteAt<15000)return;const p=state.route.geometry[idx];if(!p)return;const d=hav(state.user.lat,state.user.lng,p[1],p[0]);if(d>70)reroute()}

/* ---------- SPEECH ---------- */
function speak(text){if(!state.sound||!('speechSynthesis'in window)||!text)return;const c=characterDefs[state.character],u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=c.rate;u.pitch=c.pitch;u.volume=state.voiceVolume;const voices=speechSynthesis.getVoices().filter(v=>v.lang?.startsWith('ko'));if(voices.length)u.voice=voices[state.character==='sunsik'?Math.min(1,voices.length-1):state.character==='hunmin'?voices.length-1:0];speechSynthesis.cancel();speechSynthesis.speak(u)}

/* ---------- FAVORITES / SETTINGS ---------- */
const SETTINGS='jofams_mvp6_settings',FAVS='jofams_mvp6_favorites';
function loadLocal(){try{const p=JSON.parse(localStorage.getItem(SETTINGS)||'{}');if(p.character&&characterDefs[p.character])state.character=p.character;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Number(p.voiceVolume);state.savedPlaces.home=p.home||null;state.savedPlaces.work=p.work||null;state.favorites=JSON.parse(localStorage.getItem(FAVS)||'[]')}catch{}syncCharacterUI();updateSavedLabels();updateVolumeUI()}
function saveLocalSettings(){localStorage.setItem(SETTINGS,JSON.stringify({character:state.character,voiceVolume:state.voiceVolume,home:state.savedPlaces.home,work:state.savedPlaces.work}))}
function favoriteId(p){return `${Number(p.lat).toFixed(5)}_${Number(p.lng).toFixed(5)}`}
async function toggleFavorite(){if(!state.destination)return;const id=favoriteId(state.destination),i=state.favorites.findIndex(x=>x.id===id);if(i>=0)state.favorites.splice(i,1);else state.favorites.unshift({...state.destination,id});localStorage.setItem(FAVS,JSON.stringify(state.favorites));updateSavedLabels();await saveCloudFavorites();toast(i>=0?'즐겨찾기에서 삭제했습니다.':'즐겨찾기에 저장했습니다.')}
function syncCharacterUI(){document.querySelectorAll('[data-character]').forEach(b=>b.classList.toggle('active',b.dataset.character===state.character));updateCarMarkerImage();$('myCharacterLabel').textContent=characterDefs[state.character].name;$('voiceCharacterLabel').textContent=characterDefs[state.character].voiceLabel}
function setCharacter(key){if(!characterDefs[key])return;state.character=key;syncCharacterUI();saveLocalSettings();saveCloudPrefs();speak(`${characterDefs[key].name} 가이드로 변경했습니다.`)}
function updateVolumeUI(){const pct=Math.round(state.voiceVolume*100);$('guideVolume').value=pct;$('myGuideVolume').value=pct;$('volumeValue').textContent=`${pct}%`;$('myVolumeValue').textContent=`${pct}%`}
function changeVolume(v){state.voiceVolume=Math.max(0,Math.min(1,Number(v)/100));updateVolumeUI();saveLocalSettings();saveCloudPrefs()}

/* ---------- FIREBASE ---------- */
function firebaseConfig(){return CONFIG.firebase||{}}
function firebaseConfigured(){const c=firebaseConfig();return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId)}
async function initFirebase(){
  state.firebase.configured=firebaseConfigured();if(!state.firebase.configured)return;
  try{const [appMod,authMod,fsMod]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')]);const app=appMod.initializeApp(firebaseConfig()),auth=authMod.getAuth(app),db=fsMod.getFirestore(app);await authMod.setPersistence(auth,authMod.browserLocalPersistence);state.firebase={...state.firebase,ready:true,auth,db,mods:{authMod,fsMod}};authMod.onAuthStateChanged(auth,user=>{state.firebase.user=user||null;renderProfile();if(user){loadCloudPrefs();loadCloudFavorites()}})}catch(e){console.warn('Firebase init failed',e)}
}
async function loginGoogle(){if(!state.firebase.ready){toast('Firebase 설정을 확인해 주세요.');return}const {authMod}=state.firebase.mods,provider=new authMod.GoogleAuthProvider(),btn=$('googleLoginBtn');btn.disabled=true;btn.textContent='로그인 중';try{const isWebView=/JofamsSmartDrive\/6|; wv\)/i.test(navigator.userAgent);if(isWebView){await authMod.signInWithRedirect(state.firebase.auth,provider);return}const result=await Promise.race([authMod.signInWithPopup(state.firebase.auth,provider),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),10000))]);state.firebase.user=result.user;renderProfile();toast('로그인되었습니다.')}catch(e){if(e.code==='auth/popup-blocked'||e.message==='timeout'){toast('로그인 창을 다시 열어 주세요.');}else toast('Google 로그인에 실패했습니다.')}finally{btn.disabled=false;btn.textContent='Google 로그인'}}
async function logout(){if(!state.firebase.ready)return;await state.firebase.mods.authMod.signOut(state.firebase.auth);state.firebase.user=null;renderProfile()}
function renderProfile(){const u=state.firebase.user;$('googleLoginBtn').classList.toggle('hidden',!!u);$('logoutBtn').classList.toggle('hidden',!u);if(u){$('profileName').textContent=u.displayName||'사용자';$('profileEmail').textContent=u.email||'';$('profilePhoto').src=u.photoURL||characterDefs[state.character].avatar}else{$('profileName').textContent='조팸스 드라이버';$('profileEmail').textContent='Google 로그인으로 동기화할 수 있어요.';$('profilePhoto').src=characterDefs[state.character].avatar}}
async function saveCloudPrefs(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods;await fsMod.setDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'),{character:state.character,voiceVolume:state.voiceVolume,home:state.savedPlaces.home,work:state.savedPlaces.work,updatedAt:fsMod.serverTimestamp()},{merge:true})}catch{}}
async function loadCloudPrefs(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods,s=await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'));if(s.exists()){const p=s.data();if(p.character&&characterDefs[p.character])state.character=p.character;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Number(p.voiceVolume);state.savedPlaces.home=p.home||state.savedPlaces.home;state.savedPlaces.work=p.work||state.savedPlaces.work;syncCharacterUI();updateVolumeUI();updateSavedLabels();saveLocalSettings()}}catch{}}
async function saveCloudFavorites(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods,ref=fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','favorites');await fsMod.setDoc(ref,{items:state.favorites,updatedAt:fsMod.serverTimestamp()},{merge:true})}catch{}}
async function loadCloudFavorites(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods,s=await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','favorites'));if(s.exists()&&Array.isArray(s.data().items)){state.favorites=s.data().items;localStorage.setItem(FAVS,JSON.stringify(state.favorites));updateSavedLabels()}}catch{}}

/* ---------- UI EVENTS ---------- */

function startVoiceCommand(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('이 기기에서는 음성 명령을 지원하지 않습니다.');return}
  const rec=new SR();rec.lang='ko-KR';rec.interimResults=false;rec.maxAlternatives=1;
  toast('음성 명령을 듣고 있습니다...');
  rec.onresult=e=>{const text=(e.results?.[0]?.[0]?.transcript||'').trim();if(!text)return;if(text.includes('재탐색'))reroute();else if(text.includes('안내 종료')||text.includes('길 안내 종료'))stopNavigation();else if(text.includes('다임'))setCharacter('daim');else if(text.includes('순식'))setCharacter('sunsik');else if(text.includes('훈민'))setCharacter('hunmin');else toast(`음성 명령: ${text}`,2600)};
  rec.onerror=()=>toast('음성 인식을 다시 시도해 주세요.');
  try{rec.start()}catch{toast('음성 인식을 시작하지 못했습니다.')}
}

function openDriveMenu(){$('driveMenu').classList.remove('hidden')}
function closeDriveMenu(){$('driveMenu').classList.add('hidden')}
function openMy(){$('myModal').classList.remove('hidden');renderProfile();updateVolumeUI()}
function closeMy(){$('myModal').classList.add('hidden')}
async function shareArrival(){if(!state.destination)return;const text=`${state.destination.name}으로 이동 중입니다. 예상 도착 ${$('arrivalTime').textContent.replace('도착 ','')}`;try{if(navigator.share)await navigator.share({title:'조팸스 스마트 드라이브',text});else await navigator.clipboard.writeText(text),toast('도착 정보를 복사했습니다.')}catch{}}
function bindUI(){
  applyIcons();$('searchBtn').onclick=()=>searchPlaces($('destinationInput').value);$('destinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value)});document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>searchPlaces(b.dataset.query));
  document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>setCharacter(b.dataset.character));$('homeShortcut').onclick=()=>state.savedPlaces.home?chooseDestination(state.savedPlaces.home):openPlaceModal('home');$('workShortcut').onclick=()=>state.savedPlaces.work?chooseDestination(state.savedPlaces.work):openPlaceModal('work');$('favoriteShortcut').onclick=openMy;
  $('menuBtn').onclick=openMy;$('myBtn').onclick=openMy;$('routeBackBtn').onclick=()=>{cancelAutoStart();setView('home')};$('routeFavoriteBtn').onclick=toggleFavorite;$('startBtn').onclick=startNavigation;
  $('driveMenuBtn').onclick=openDriveMenu;$('driveRefreshBtn').onclick=reroute;$('driveVoiceBtn').onclick=startVoiceCommand;document.querySelector('.bottom-modal-backdrop').onclick=closeDriveMenu;$('otherRouteBtn').onclick=()=>{closeDriveMenu();stopWatch();setView('route');loadRouteOptions()};$('driveSettingBtn').onclick=()=>{closeDriveMenu();openMy()};$('shareBtn').onclick=shareArrival;$('endNavBtn').onclick=stopNavigation;
  $('guideVolume').oninput=e=>changeVolume(e.target.value);$('myGuideVolume').oninput=e=>changeVolume(e.target.value);$('myCloseBtn').onclick=closeMy;$('myModal').addEventListener('click',e=>{if(e.target===$('myModal'))closeMy()});$('googleLoginBtn').onclick=loginGoogle;$('logoutBtn').onclick=logout;
  $('placeModalClose').onclick=()=>$('placeModal').classList.add('hidden');$('placeSearchBtn').onclick=()=>searchPlaces($('placeSearchInput').value,'placeSearchResults');$('placeSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value,'placeSearchResults')});$('placeModal').addEventListener('click',e=>{if(e.target===$('placeModal'))$('placeModal').classList.add('hidden')});
}

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
applyIcons();loadLocal();bindUI();initMap();initFirebase();renderProfile();
