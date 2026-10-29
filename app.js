const $ = id => document.getElementById(id);
const CONFIG = window.__APP_CONFIG__ || {};
// Admin authorization must be verified by /api/admin-access, never by a client-side email allowlist.
const SETTINGS='jofams-navi.settings.v75';
const FAVS='jofams-navi.favorites.v75';
const RECENTS='jofams-navi.recents.v75';
const TRIP_HISTORY='jofams-navi.trip-history.v75';
const PERMISSION_PREFS='jofams-navi.permission-prefs.v1';
const INSTALLATION_ID='jofams-navi.installation-id.v1';
let maplibregl = null;
const characterDefs = {
  daim:{name:'다임',car:'/assets/daim_car.png',marker:'/assets/daim_car_marker.png',rear:'/assets/daim_car_rear.png',avatar:'/assets/daim.png',rate:.96,pitch:1.08,voiceLabel:'다임 보이스'},
  sunsik:{name:'순식',car:'/assets/sunsik_car.png',marker:'/assets/sunsik_car_marker.png',rear:'/assets/sunsik_car_rear.png',avatar:'/assets/sunsik.png',rate:.80,pitch:.50,voiceLabel:'순식 · 저음 중년 남성 보이스'},
  hunmin:{name:'훈민',car:'/assets/hunmin_car.png',marker:'/assets/hunmin_car_marker.png',rear:'/assets/hunmin_car_rear.png',avatar:'/assets/hunmin.png',rate:1.12,pitch:.88,voiceLabel:'훈민 · 밝은 청년 남성 보이스'}
};
/* Preload the current drive character before WebView/map transitions. */
const dangolloPreloadedCharacters=new Map();
function preloadDangolloDriveCharacters(){
  for(const def of Object.values(characterDefs)){
    for(const src of [def.rear,def.marker]){
      if(!src||dangolloPreloadedCharacters.has(src))continue;
      const img=new Image();img.decoding='sync';img.fetchPriority='high';img.src=src;
      dangolloPreloadedCharacters.set(src,img);
    }
  }
}
preloadDangolloDriveCharacters();
const state = {
  map:null,mapReady:false,pendingRouteDraw:null,mapFallbackTried:false,mapWatchdog:0,user:null, destination:null, routeOptions:[], route:null, selectedRoute:0,
  userMarker:null,destMarker:null,originMarker:null,watchId:null,character:'daim',voiceVolume:.8,sound:true,radioVolume:.6,radioPlaying:false,radioIndex:0,radioDucked:false,radioDuckTimer:0,activeGuideSnapshot:null,
  autoStartTimer:null,autoStartSeconds:0,routeCumulative:[],currentRouteIndex:0,lastRerouteAt:0,lastGuideSpoken:'',tripStartedAt:0,
  savedPlaces:{home:null,work:null},favorites:[],recentDestinations:[],placeKind:null,placeCandidate:null,origin:null,originMode:'current',placeDbReady:false,waypoints:[],pendingDriveSearchPlace:null,savedWaypointCourses:[],fuelProduct:(()=>{try{const c=localStorage.getItem('jofams_fuel_product_v1');return ['B027','D047','B034','K015'].includes(c)?c:'B027'}catch{return'B027'}})(),fuelData:null,fuelFetchedAt:0,fuelLoading:false,destinationSearchSort:'accuracy',lastDestinationQuery:'',routeMode:'car',carRouteOptions:[],walkingRoute:null,routeModeDurations:{car:null,walk:null},homeFacilityCategory:'주유소',homeFacilityItems:[],
  arStream:null,arFrame:0,arRunning:false,permissionCameraGranted:false,permissionLocationGranted:false,permissionPrefs:{location:true,camera:true},
  tripHistory:[],safetyEvents:[],safetyMarkers:[],lastSafetySpoken:new Set(),activeSafetyId:null,safetyRequestSeq:0,lastTrafficStatus:'',lastTrafficSpokenAt:0,overspeedActive:false,lastOverspeedSpokenAt:0,map3D:false,mapSatellite:false,mapControlsVisible:false,liveRouteTimer:0,lastLiveRouteAt:0,lastVmsKey:'',destinationCycleTimer:0,destinationHideTimer:0,lastDestinationShownAt:0,deadReckoningTimer:0,lastRealGpsAt:0,lastGpsTickAt:0,lastRealSpeedMps:0,lastRealHeading:0,gpsEstimated:false,lastDeadReckoningNoticeAt:0,officialCameraRows:null,officialCameraPromise:null,sectionSpeedState:null,tunnelRouteLock:{active:false,startIndex:-1,endIndex:-1,routeDistance:null,lastAt:0},homeSheetCollapsed:false,homeSheetDrag:null,mapPlaceCandidate:null,localVoucherMarkers:[],localVoucherData:null,localVoucherRetryCount:0,localVoucherLastErrorAt:0,localVoucherLoadTimer:0,localVoucherRegionCode:'',localVoucherLoadedAt:0,localVoucherLoadedCenter:null,localVoucherFocus:null,onnuriMarkers:[],onnuriData:null,onnuriLoadedAt:0,onnuriLoadedCenter:null,onnuriLoadTimer:0,homeCameraMarkers:[],homeCameraLoadTimer:0,
  futureOrigin:null,futureDestination:null,futureDateMode:'today',futureAmPm:'AM',offRouteHits:0,routePreference:'recommend',cameraAlerts:{speed:true,signal:true},userSettingsLoaded:false,inquiries:[],adminNotices:[],adminContent:null,adminVerified:false,adminVerifiedEmail:'',loginPending:false,loginStartedAt:0,deadReckoningDistance:null,deadReckoningLastAt:0,arCameraMode:false,lastSpeedSample:null,simulationActive:false,simulationSpeed:1,simulationDistance:null,simulationLastAt:0,simulationRaf:0,
  compassHeading:null,compassAt:0,compassReady:false,activeLaneGuideKey:'',nativeLocationAt:0,nativeLocationActive:false,imu:{at:0,yawRateDegS:0,accelMagnitude:0,headingDeg:null},mapMatch:{index:0,routeDistance:0,score:Infinity,confidence:0,at:0},offRouteHeadingHits:0,gpsFix:{lat:null,lng:null,headingDeg:null,speedMps:0,at:0,fixCount:0,mapSnapped:false},
  whereToTab:'local',wakeLock:null,savedPlaceGroups:[],savedPlaceGroupMap:{},activeSavedGroup:'all',
  drivePoiMarkers:[],drivePoiTab:'local',drivePoiData:{fuel:[],local:[],onnuri:[]},drivePoiFetchedAt:0,drivePoiFetchedRouteM:0,drivePoiFetchToken:0,drivePoiLoading:false,lastDrivePoiRenderAt:0,
  navigationStartAnchor:null,navigationStartReleased:false,navigationStartAt:0,navigationMoveConfirmHits:0,
  firebase:{configured:false,ready:false,user:null,auth:null,db:null,mods:null}
};


window.addEventListener('error',e=>console.error('[JOFAMS runtime]',e.error||e.message));
window.addEventListener('unhandledrejection',e=>console.error('[JOFAMS promise]',e.reason));
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
    'volume-x':`<svg viewBox="0 0 24 24" ${common}><path d="M4 14h4l5 4V6l-5 4H4z"/><path d="m17 10 5 5m0-5-5 5"/></svg>`,
    car:`<svg viewBox="0 0 24 24" ${common}><path d="M5 17h14l-1-6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2zM7 17v2M17 17v2M8 14h.1M16 14h.1"/><path d="M7 9l2-4h6l2 4"/></svg>`,
    walk:`<svg viewBox="0 0 24 24" ${common}><circle cx="13" cy="4.5" r="2"/><path d="m11 8-2.2 4 3.2 2 2 6M11 8l4 2 2.5 3M9 12l-3 6M14 10l-2 4"/></svg>`,
    location:`<svg viewBox="0 0 24 24" ${common}><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>`,
    camera:`<svg viewBox="0 0 24 24" ${common}><path d="M4 7h4l1.5-2h5L16 7h4v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
    list:`<svg viewBox="0 0 24 24" ${common}><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".7" fill="currentColor"/><circle cx="4" cy="12" r=".7" fill="currentColor"/><circle cx="4" cy="18" r=".7" fill="currentColor"/></svg>`,
    clock:`<svg viewBox="0 0 24 24" ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`,
    megaphone:`<svg viewBox="0 0 24 24" ${common}><path d="M4 11v4h4l8 4V7l-8 4z"/><path d="M8 15l1.5 5h3"/></svg>`,
    document:`<svg viewBox="0 0 24 24" ${common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>`,
    sliders:`<svg viewBox="0 0 24 24" ${common}><path d="M4 6h5M13 6h7M4 12h9M17 12h3M4 18h3M11 18h9"/><circle cx="11" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg>`,
    headset:`<svg viewBox="0 0 24 24" ${common}><path d="M4 13a8 8 0 0 1 16 0v5h-4v-6h4M4 12h4v6H4z"/><path d="M16 20h-4"/></svg>`,
    edit:`<svg viewBox="0 0 24 24" ${common}><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>`,
    inbox:`<svg viewBox="0 0 24 24" ${common}><path d="M4 5h16v14H4z"/><path d="M4 14h5l2 2h2l2-2h5"/></svg>`,
    play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
  };
  return map[name]||'';
}
function applyIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon))}
function turnSvg(type,color='#fff'){
  const s=`fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;
  if(type===1||type===5) return `<svg viewBox="0 0 24 24" ${s}><path d="M20 18V11a5 5 0 0 0-5-5H6"/><path d="m10 2-4 4 4 4"/></svg>`;
  if(type===2||type===6) return `<svg viewBox="0 0 24 24" ${s}><path d="M4 18V11a5 5 0 0 1 5-5h9"/><path d="m14 2 4 4-4 4"/></svg>`;
  if(type===3) return `<svg viewBox="0 0 24 24" ${s}><path d="M17 20V10a5 5 0 1 0-10 0v4"/><path d="m3 10 4 4 4-4"/></svg>`;
  if((type>=30&&type<=41)||(type>=70&&type<=81)) return `<svg viewBox="0 0 24 24" ${s}><path d="M6 9a7 7 0 1 1 2 8"/><path d="m5 5 1 4 4-1"/></svg>`;
  return `<svg viewBox="0 0 24 24" ${s}><path d="M12 21V4"/><path d="m7 9 5-5 5 5"/></svg>`;
}

/* ---------- HELPERS ---------- */
function toast(msg,ms=2200){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),ms)}
function km(m){if(!Number.isFinite(m))return '--';return m<1000?`${Math.round(m)}m`:`${(m/1000).toFixed(m<10000?1:0)}km`}
function mins(sec){const n=Number(sec);if(!Number.isFinite(n)||n<=0)return '계산 중';return `${Math.max(1,Math.round(n/60))}분`}
function eta(sec){const d=new Date(Date.now()+(sec||0)*1000);return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}
/* 7.6.11.0 하단 카드 '도착 예정' 표기: 오전 11:04 */
function etaKo(sec){const d=new Date(Date.now()+(sec||0)*1000),h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0');return{ap:h<12?'오전':'오후',hm:`${h%12||12}:${m}`}}
function setArrivalTime(sec,valid=true){const el=$('arrivalTime');if(!el)return;if(!valid){el.innerHTML='<b>--:--</b>';return}const t=etaKo(sec);el.innerHTML=`<i>${t.ap}</i> <b>${t.hm}</b>`}
function hav(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function bearing(a,b,c,d){const p=Math.PI/180,y=Math.sin((d-b)*p)*Math.cos(c*p),x=Math.cos(a*p)*Math.sin(c*p)-Math.sin(a*p)*Math.cos(c*p)*Math.cos((d-b)*p);return (Math.atan2(y,x)/p+360)%360}
function pointValid(p){return p&&Number.isFinite(Number(p.lng))&&Number.isFinite(Number(p.lat))}
/* Number(null)===0 이라 routeDistance/routeIndex 가 null 일 때 '경로 시작점(0m)'으로 오인되던 문제 방지용. */
function finiteOrNull(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function nearestIndex(lng,lat,geometry){let bi=0,bd=Infinity;const stride=Math.max(1,Math.floor((geometry?.length||0)/1200));for(let i=0;i<(geometry?.length||0);i+=stride){const p=geometry[i],d=(p[0]-lng)**2+(p[1]-lat)**2;if(d<bd){bd=d;bi=i}}return bi}
function buildCumulative(route){const g=route?.geometry||[],arr=new Array(g.length).fill(0);for(let i=1;i<g.length;i++)arr[i]=arr[i-1]+hav(g[i-1][1],g[i-1][0],g[i][1],g[i][0]);return arr}
/* 가장 최근에 수신한 원시 위치(캐릭터 표시용 state.user는 출발 전 흔들림 방지로 갱신이 지연될 수 있다). */
function currentOriginPoint(){
  const u=pointValid(state.user)?state.user:null,r=state.lastRawFix;
  const rawFresh=r&&pointValid(r)&&Date.now()-Number(r.at||0)<=30000&&Number.isFinite(Number(r.accuracy))&&Number(r.accuracy)>0&&Number(r.accuracy)<=60;
  if(rawFresh&&(!u||Number(r.at)>=Number(state.lastGpsTickAt||0)-50))return{...(u||{}),lat:Number(r.lat),lng:Number(r.lng),accuracy:r.accuracy,heading:u?.heading};
  return u;
}
async function refreshCurrentLocation({maxAgeMs=30000,timeoutMs=2200}={}){
  // 7.6.21: 네이티브/브라우저 위치 요청을 동시에 보내 가장 먼저 도착한 값을 쓴다(기존: 순차 대기로 최대 6초+).
  // 최근 30초 이내·정확도 60m 이하 원시 GPS가 있으면 새로운 위치 요청 없이 바로 사용한다.
  const freshEnough=()=>{const r=state.lastRawFix;return r&&pointValid(r)&&Date.now()-Number(r.at||0)<=maxAgeMs&&Number.isFinite(Number(r.accuracy))&&Number(r.accuracy)>0&&Number(r.accuracy)<=60};
  if(freshEnough())return currentOriginPoint();
  const t0=Date.now(),tasks=[];
  if(nativeBridgeAvailable()){
    nativePost('requestLocation',{highAccuracy:true});
    tasks.push(new Promise((res,rej)=>{const iv=setInterval(()=>{
      if(Number(state.lastRawFix?.at||0)>=t0){clearInterval(iv);res(true)}
      else if(Date.now()-t0>=timeoutMs){clearInterval(iv);rej(new Error('native timeout'))}
    },60)}));
  }
  if(navigator.geolocation){
    tasks.push(new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(
      p=>{try{applyGps(p,false)}catch{}res(true)},
      ()=>rej(new Error('browser geolocation failed')),
      {enableHighAccuracy:true,timeout:timeoutMs,maximumAge:10000}
    )));
  }
  if(tasks.length){try{await Promise.any(tasks)}catch{}}
  return currentOriginPoint();
}
function normalizedPlace(x){return x?{id:x.id||'',name:x.name||'목적지',address:x.address||'',lng:Number(x.lng),lat:Number(x.lat)}:null}


/* ---------- NATIVE HIGH-PRECISION LOCATION / IMU BRIDGE ---------- */
function nativeBridgeAvailable(){return Boolean(window.JofamsNavigationBridge&&typeof window.JofamsNavigationBridge.postMessage==='function')}
function nativePost(type,payload={}){try{if(nativeBridgeAvailable())window.JofamsNavigationBridge.postMessage(JSON.stringify({type,payload,ts:Date.now()}))}catch(e){console.warn('native bridge post failed',e)}}
function parseNativePacket(packet){try{return typeof packet==='string'?JSON.parse(packet):packet||{}}catch{return {}}}
window.JofamsNative=window.JofamsNative||{};
// app.js is an ES module; Android's evaluateJavascript cannot access its lexical state.
window.JofamsWebNavigation={
  getState:()=>state,
  stop:()=>stopNavigation(),
  applyRoute(route){
    state.route=route;state.routeCumulative=buildCumulative(route);
    state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};
    // 이전 경로 기준 진행거리/정지 앵커를 버리고 새 경로에서 첫 유효 GPS 위치로 즉시 맞춘다.
    state.routeLockedDistance=undefined;state.stationaryGpsAnchor=null;state.lockBehindHits=0;state.lockAheadHits=0;state.resyncPending=true;
    state.safetyEvents=[];resetSectionSpeedState();
    drawRoute(route,{fit:false});
    loadSafetyEvents(route).catch(e=>console.warn('native reroute safety refresh failed',e));
  }
};
window.JofamsNative.onLocationUpdate=packet=>{
  const p=parseNativePacket(packet),lat=Number(p.lat??p.latitude),lng=Number(p.lng??p.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  state.nativeLocationAt=Date.now();state.nativeLocationActive=true;
  applyGps({native:true,estimated:Boolean(p.estimated),rawLatitude:p.rawLat,rawLongitude:p.rawLng,routeIndex:p.routeIndex,routeDistance:p.routeDistance,timestamp:Number(p.timestamp)||Date.now(),coords:{latitude:lat,longitude:lng,accuracy:Number(p.accuracy)||8,speed:p.speedMps??p.speed,heading:p.headingDeg??p.bearing,speedAccuracy:p.speedAccuracy,headingAccuracy:p.bearingAccuracy}},false);
};
window.JofamsNative.onMotionUpdate=packet=>{
  const p=parseNativePacket(packet);try{pushMotionSample(Number(p.accelMagnitude),Date.now())}catch{}state.imu={at:Date.now(),yawRateDegS:Number(p.yawRateDegS)||0,accelMagnitude:Number(p.accelMagnitude)||0,headingDeg:Number.isFinite(Number(p.headingDeg))?Number(p.headingDeg):state.imu.headingDeg};
  if(Number.isFinite(state.imu.headingDeg)){state.compassHeading=state.imu.headingDeg;state.compassAt=Date.now()}
};
window.JofamsNative.onTunnelState=packet=>{const p=parseNativePacket(packet);if(p.active===true)state.lastRealGpsAt=Math.min(state.lastRealGpsAt||Date.now(),Date.now()-2600)};

async function acquireNavigationWakeLock(){
  if(!state.tripStartedAt||document.hidden)return;
  try{
    if('wakeLock' in navigator){
      if(state.wakeLock&&!state.wakeLock.released)return;
      state.wakeLock=await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener?.('release',()=>{state.wakeLock=null});
    }
  }catch(e){console.warn('screen wake lock unavailable',e)}
}
async function releaseNavigationWakeLock(){
  try{
    if(state.wakeLock){
      const lock=state.wakeLock;
      state.wakeLock=null;
      await lock.release?.();
    }
  }catch(e){console.warn('screen wake lock release failed',e)}
}

function setNativeNavigationActive(active){nativePost('navigationState',{active:Boolean(active),highAccuracy:true,locationIntervalMs:500,imu:true})}

/* ---------- GPS FUSION (GNSS + heading/DR complementary filter + map-snap) ----------
   브라우저 환경에서는 raw GNSS 칩/멀티위성 제어가 불가능하므로, Geolocation API가
   내려주는 lat/lng/heading/accuracy/speed 값을 대상으로 다음을 적용한다:
   1) 순간 텔레포트(비정상 점프) 탐지 및 감쇠
   2) 정확도(accuracy) 가중 예측-보정(예측 위치 ← 직전 속도/헤딩으로 dead-reckon,
      보정 위치 ← predicted와 raw를 accuracy 기반 가중 평균) — 경량 상보필터(complementary filter)
   3) 헤딩 원형(순환) 평활화 + 저속시 나침반(DeviceOrientation) 폴백
   4) 활성 경로가 있을 때 perpendicular 거리 기반 맵매칭 스냅(snap-to-road)
*/
function circularLerp(fromDeg,toDeg,t){
  if(!Number.isFinite(fromDeg))return toDeg;
  if(!Number.isFinite(toDeg))return fromDeg;
  let diff=((toDeg-fromDeg+540)%360)-180;
  return (fromDeg+diff*Math.max(0,Math.min(1,t))+360)%360;
}
function projectForward(lat,lng,headingDeg,speedMps,dt){
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(headingDeg)||!(speedMps>0)||!(dt>0))return{lat,lng};
  const R=6371000,dist=speedMps*dt,rad=headingDeg*Math.PI/180;
  const dLat=(dist*Math.cos(rad)/R)*(180/Math.PI);
  const dLng=(dist*Math.sin(rad)/(R*Math.cos(lat*Math.PI/180)))*(180/Math.PI);
  return{lat:lat+dLat,lng:lng+dLng};
}
function projectPointToSegment(lng,lat,p0,p1){
  const kx=Math.max(.2,Math.cos(lat*Math.PI/180));
  const x0=p0[0]*kx,y0=p0[1],x1=p1[0]*kx,y1=p1[1],x=lng*kx,y=lat;
  const dx=x1-x0,dy=y1-y0,len2=dx*dx+dy*dy;
  let t=len2>0?((x-x0)*dx+(y-y0)*dy)/len2:0;t=Math.max(0,Math.min(1,t));
  return{lng:(x0+dx*t)/kx,lat:y0+dy*t};
}
function nearestPointOnRoute(lng,lat,geometry){
  if(!geometry||geometry.length<2)return null;
  /* 7.6.11.3: nearestIndex 는 긴 경로에서 stride 간격으로만 샘플링하므로, 그 stride 만큼 넓은 범위의 구간을 정밀 검사한다.
     (기존 ±2 구간만 보면 실제로 가장 가까운 구간을 놓쳐 카메라 위치·거리가 어긋났다) */
  const stride=Math.max(1,Math.floor(geometry.length/1200));
  const bi=nearestIndex(lng,lat,geometry),lo=Math.max(1,bi-stride-2),hi=Math.min(geometry.length-1,bi+stride+2);
  let best=null,bestD=Infinity;
  for(let i=lo;i<=hi;i++){
    const p0=geometry[i-1],p1=geometry[i],proj=projectPointToSegmentDetailed(lng,lat,p0,p1),d=hav(lat,lng,proj.lat,proj.lng);
    if(d<bestD){bestD=d;best={lng:proj.lng,lat:proj.lat,t:proj.t,heading:bearing(p0[1],p0[0],p1[1],p1[0]),distance:d,index:i}}
  }
  return best;
}
/* 7.6.11.3: 경로 누적거리 캐시 + 점 → 경로 상 정확한 진행거리(routeDistance, m) 계산 */
let _routeCumCache={g:null,cum:null};
function cumForGeometry(geometry){
  if(geometry===state.route?.geometry&&state.routeCumulative&&state.routeCumulative.length===geometry.length)return state.routeCumulative;
  if(_routeCumCache.g!==geometry)_routeCumCache={g:geometry,cum:buildCumulative({geometry})};
  return _routeCumCache.cum;
}
function routeDistanceFromMatch(m,geometry){
  if(!m||!Number.isFinite(Number(m.index)))return NaN;
  const cum=cumForGeometry(geometry),i=Math.max(1,Math.min(cum.length-1,Number(m.index)));
  const a=cum[i-1]||0,b=cum[i]||a,t=Number.isFinite(Number(m.t))?Math.max(0,Math.min(1,Number(m.t))):1;
  return a+(b-a)*t;
}
function routePosOfPoint(lng,lat,geometry,heading=null,maxDistance=250){
  if(!geometry||geometry.length<2)return null;
  const h=heading==null?NaN:Number(heading);
  const m=Number.isFinite(h)?directionAwareNearestPointOnRoute(lng,lat,h,10,geometry,maxDistance):nearestPointOnRoute(lng,lat,geometry);
  if(!m||!Number.isFinite(Number(m.index)))return null;
  const i=Math.max(1,Math.min(geometry.length-1,Number(m.index)));
  const proj=projectPointToSegmentDetailed(lng,lat,geometry[i-1],geometry[i]);
  const routeDistance=routeDistanceFromMatch({index:i,t:proj.t},geometry);
  return{...m,index:i,lng:proj.lng,lat:proj.lat,t:proj.t,routeDistance};
}
/* 지금까지 정의되지 않은 채 호출되던 함수(구간단속 노드/카메라 경로 매칭)를 정의한다. */
function cameraRouteMatch(lng,lat,route,heading=null){return routePosOfPoint(lng,lat,route?.geometry||[],heading,250)}
function currentRouteDistanceAt(idx){
  const ud=Number(state.user?.routeDistance);if(Number.isFinite(ud)&&ud>=0)return ud;
  const cum=state.routeCumulative||[];return Number(cum[Math.max(0,Math.min(cum.length-1,idx))])||0;
}
/* 이벤트(카메라 등)까지 남은 거리(m). routeDistance 가 있으면 정밀값, 없으면 기존 정점 기준. 지나갔으면 -1 */
function eventAheadMeters(idx,e){
  const ed=Number(e?.routeDistance);
  if(!Number.isFinite(ed))return distanceAlong(idx,Number(e?.routeIndex));
  const ahead=ed-currentRouteDistanceAt(idx);
  return ahead>=0?ahead:(ahead>-3?0:-1);
}

function angleDiff(a,b){if(!Number.isFinite(a)||!Number.isFinite(b))return 0;return Math.abs(((a-b+540)%360)-180)}
function directionAwareNearestPointOnRoute(lng,lat,heading,speed,geometry,maxDistance=45){
  if(!geometry||geometry.length<2)return null;
  const coarse=nearestIndex(lng,lat,geometry);
  const candidates=[];
  const span=Math.max(45,Math.floor(geometry.length/1200)+3),lo=Math.max(1,coarse-span),hi=Math.min(geometry.length-1,coarse+span);
  for(let i=lo;i<=hi;i++){
    const p0=geometry[i-1],p1=geometry[i];
    const proj=projectPointToSegmentDetailed(lng,lat,p0,p1);
    const d=hav(lat,lng,proj.lat,proj.lng);
    if(d>maxDistance)continue;
    const h=bearing(p0[1],p0[0],p1[1],p1[0]);
    const diff=Number.isFinite(Number(heading))&&Number(speed)>2.2?angleDiff(Number(heading),h):0;
    // 주행 중에는 같은 위치의 반대방향 차선을 후보에서 강하게 배제한다.
    const directionPenalty=Number(speed)>2.2?(diff>=135?120:diff>=100?55:diff>=70?18:diff>=45?9:diff/12):0;
    candidates.push({
      lng:proj.lng,lat:proj.lat,index:i,heading:h,distance:d,
      headingDiff:diff,score:d+directionPenalty
    });
  }
  if(!candidates.length)return nearestPointOnRoute(lng,lat,geometry);
  candidates.sort((a,b)=>a.score-b.score||a.distance-b.distance);
  return candidates[0];
}
function routeDistanceAtSegment(i,t=.5){const cum=state.routeCumulative||[];if(!cum.length)return 0;const a=cum[Math.max(0,i-1)]||0,b=cum[Math.min(cum.length-1,i)]||a;return a+(b-a)*Math.max(0,Math.min(1,t))}
function projectPointToSegmentDetailed(lng,lat,p0,p1){
  const kx=Math.max(.2,Math.cos(lat*Math.PI/180)),x0=p0[0]*kx,y0=p0[1],x1=p1[0]*kx,y1=p1[1],x=lng*kx,y=lat,dx=x1-x0,dy=y1-y0,len2=dx*dx+dy*dy;
  let t=len2>0?((x-x0)*dx+(y-y0)*dy)/len2:0;t=Math.max(0,Math.min(1,t));return{lng:(x0+dx*t)/kx,lat:y0+dy*t,t};
}
function roadSegmentAtIndex(idx){return (state.route?.roadSegments||[]).find(x=>idx>=Number(x.startIndex)&&idx<=Number(x.endIndex))||null}
/* Incremental HMM-like map matcher: distance + heading + expected progress + backward penalty.
   It intentionally keeps raw GPS separately, so route deviation can still be detected. */
function probabilisticRouteMatch(raw,now=Date.now()){
  const g=state.route?.geometry||[];if(g.length<2)return null;
  const prev=state.mapMatch||{},coarse=nearestIndex(raw.lng,raw.lat,g),prior=Number.isFinite(prev.index)?prev.index:coarse;
  const candidates=new Set();
  for(const center of [coarse,prior])for(let i=Math.max(1,center-90);i<=Math.min(g.length-1,center+130);i+=2)candidates.add(i);
  for(let i=Math.max(1,coarse-8);i<=Math.min(g.length-1,coarse+8);i++)candidates.add(i);
  const dt=prev.at?Math.min(5,Math.max(.1,(now-prev.at)/1000)):1,expected=(Number(prev.routeDistance)||0)+Math.max(0,Number(raw.speed)||0)*dt;
  const sigma=Math.max(6,Math.min(35,Number(raw.accuracy)||18)),heading=finiteOrNull(raw.heading),moving=Number(raw.speed)>2.2&&heading!==null;
  let best=null,bestScore=Infinity;
  for(const i of candidates){
    const p0=g[i-1],p1=g[i],proj=projectPointToSegmentDetailed(raw.lng,raw.lat,p0,p1),d=hav(raw.lat,raw.lng,proj.lat,proj.lng),segHeading=bearing(p0[1],p0[0],p1[1],p1[0]),rd=routeDistanceAtSegment(i,proj.t);
    const headingDelta=moving?angleDiff(heading,segHeading):0;
    const emission=d/sigma,headPenalty=moving?headingDelta/48:0,progressPenalty=prev.at?Math.min(5,Math.abs(rd-expected)/Math.max(28,Math.max(0,Number(raw.speed)||0)*dt*4)):0;
    const backwards=prev.at&&rd<(Number(prev.routeDistance)||0)-Math.max(18,(Number(raw.speed)||0)*dt*1.8)?2.6:0;
    const indexJump=prev.at?Math.min(2.5,Math.abs(i-prior)/90):0,seg=roadSegmentAtIndex(i),linkId=seg?.linkId||null,linkPenalty=prev.linkId&&linkId&&prev.linkId!==linkId&&Math.abs(i-prior)>18?.55:0;
    // 차량이 실제 헤딩과 100° 이상 반대인 경로는 위치가 가까워도 우선 매칭하지 않는다.
    const wrongWayPenalty=moving?(headingDelta>=145?14:headingDelta>=115?8:headingDelta>=90?3.5:0):0;
    const score=emission+headPenalty*.9+progressPenalty*.9+backwards+indexJump*.35+linkPenalty+wrongWayPenalty;
    if(score<bestScore){bestScore=score;best={lng:proj.lng,lat:proj.lat,index:i,heading:segHeading,distance:d,routeDistance:rd,linkId,score}}
  }
  if(!best)return null;
  best.confidence=Math.max(0,Math.min(1,1-best.score/5.2));
  state.mapMatch={index:best.index,routeDistance:best.routeDistance,linkId:best.linkId||null,score:best.score,confidence:best.confidence,at:now};
  return best;
}

/* 정확도(accuracy, m)를 신뢰가중치(0~1)로 변환: 정확도가 좋을수록(값이 작을수록) 1에 가깝다. */
function accuracyWeight(accuracy){const a=Number.isFinite(accuracy)&&accuracy>0?accuracy:35;return Math.max(.12,Math.min(.9,1-a/60))}
function initCompassFallback(){
  if(state.compassReady)return;state.compassReady=true;
  const handler=e=>{
    let h=null;
    if(typeof e.webkitCompassHeading==='number'&&Number.isFinite(e.webkitCompassHeading))h=e.webkitCompassHeading;
    else if(e.absolute&&Number.isFinite(e.alpha))h=(360-e.alpha)%360;
    if(Number.isFinite(h)){state.compassHeading=h;state.compassAt=Date.now()}
  };
  try{
    if('ondeviceorientationabsolute' in window)window.addEventListener('deviceorientationabsolute',handler);
    else if('ondeviceorientation' in window)window.addEventListener('deviceorientation',handler);
  }catch{}
}
/* iOS 13+는 사용자 제스처(버튼 탭) 컨텍스트 안에서만 권한 요청이 가능하다. startNavigation() 클릭 안에서 호출한다. */
async function requestCompassPermission(){
  try{
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted')return;
    }
  }catch{}
  initCompassFallback();
}
/* raw GNSS 픽스를 받아 예측-보정 상보필터 + 텔레포트 감쇠 + 맵스냅을 적용한 최종 좌표를 반환한다. */

/* v7.6.26.5: 원시 위치/이동 방향으로 독립 검증한다. 경로에 붙인 가공 좌표로 검증하지 않는다. */
function assessRealDriveDirection(lat,lng,heading,speed,accuracy,now=Date.now()){
  if(!state.tripStartedAt||state.simulationActive||!state.route?.geometry?.length)return 'unknown';
  const h=finiteOrNull(heading),v=finiteOrNull(speed),a=finiteOrNull(accuracy);
  if(!Number.isFinite(h)||!Number.isFinite(v)||v<3||!Number.isFinite(a)||a>35)return 'unknown';
  // 방향 패널티로 정방향 차선을 억지 선택하지 않도록, 물리적으로 가장 가까운 경로 조각을 먼저 검사한다.
  const match=routePosOfPoint(Number(lng),Number(lat),state.route.geometry,null,60);
  if(!match||match.distance>Math.max(25,a*1.5))return 'unknown';
  const opposite=angleDiff(h,match.heading)>=125;
  if(opposite){state.wrongDirectionHits=(state.wrongDirectionHits||0)+1;state.correctDirectionHits=0;}
  else{state.correctDirectionHits=(state.correctDirectionHits||0)+1;state.wrongDirectionHits=0;}
  if(state.wrongDirectionHits>=2)state.wrongDirectionActive=true;
  if(state.correctDirectionHits>=3)state.wrongDirectionActive=false;
  return state.wrongDirectionActive?'opposite':opposite?'suspect':'correct';
}
function showDirectionUncertain(){
  if(!state.tripStartedAt||state.simulationActive)return;
  const key=state.wrongDirectionActive?'reverse':'unverified';
  if(state.directionToastKey!==key||Date.now()-(state.directionToastAt||0)>14000){
    state.directionToastKey=key;state.directionToastAt=Date.now();
    toast(state.wrongDirectionActive?'현재 이동 방향이 안내 경로와 다릅니다. 안전한 곳에서 경로를 확인하세요.':'현재 GPS 위치·방향을 확인 중입니다. 회전 안내를 잠시 보류합니다.',3700);
  }
}
function clearUncertainGuidance(){
  state.drivePositionUncertain=true;
  state.userMarker?.getElement?.()?.classList.add('dangollo-gps-unverified');
  if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0;}
  state.driveMarkerTargetDistance=state.driveMarkerRenderedDistance;
  showDirectionUncertain();
}
function lockDisplayPositionToRoute(rawLike,now=Date.now(),opts={}){
  if(!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative?.length)return null;
  const raw={
    lng:Number(rawLike?.lng),lat:Number(rawLike?.lat),
    heading:finiteOrNull(rawLike?.heading),speed:finiteOrNull(rawLike?.speed),
    accuracy:Number(rawLike?.accuracy)||20
  };
  if(!pointValid(raw))return null;
  const previousMatch={...state.mapMatch};
  const match=probabilisticRouteMatch(raw,now);
  if(!match)return null;
  if(state.wrongDirectionActive){state.mapMatch=previousMatch;return null;}
  // 멀리 떨어진 도로 조각(교차/평행 구간)에 순간적으로 붙는 오류 방지
  if(match.distance>Math.max(35,Math.min(70,raw.accuracy*1.8))){state.mapMatch=previousMatch;return null;}
  const headingMismatch=Number(raw.speed)>2.8&&finiteOrNull(raw.heading)!==null
    ?angleDiff(Number(raw.heading),Number(match.heading))
    :0;
  // 평행한 반대 차선처럼 GPS 거리는 가까워도 실제 주행방향이 반대라면
  // 기존 경로에 캐릭터를 억지로 붙이지 않는다.
  if(Number(raw.speed)>2.8&&finiteOrNull(raw.heading)!==null&&headingMismatch>=105){state.mapMatch=previousMatch;return null;}

  // 기차가 레일을 따라가듯 화면 캐릭터 진행거리는 역행하지 않도록 한다.
  // 단, 아래 '재동기화(snap)' 조건에서는 실제 수신 위치로 즉시 맞춘다(따라잡기 애니메이션 없음).
  const previous=Number(state.routeLockedDistance);
  const tolerance=Math.max(10,Math.min(28,(raw.accuracy||20)*.8));
  let distance=Number(match.routeDistance);if(!Number.isFinite(distance))distance=0;
  let snap=false;
  const trustable=match.distance<=Math.max(30,raw.accuracy*1.5)&&match.confidence>=.3;
  if(opts.resync&&match.distance<=Math.max(45,raw.accuracy*2)&&match.confidence>=.2){
    // 터널 복귀/수신 공백 후 첫 유효 GPS: 밀린 구간을 몰아서 채우지 않고 수신된 그 자리에서 바로 시작한다.
    if(Number.isFinite(previous)&&Math.abs(distance-previous)>Math.max(90,(Math.max(0,raw.speed)||0)*8+45)&&!opts.allowLargeResync){state.mapMatch=previousMatch;return null;}
    snap=true;state.lockBehindHits=0;state.lockAheadHits=0;
  }else if(Number.isFinite(previous)){
    const dt=Math.max(.25,Math.min(2.5,(now-(state.routeLockedAt||now-500))/1000));
    const maxAdvance=Math.max(22,(Math.max(0,raw.speed)||0)*dt*2.8+14);
    if(distance<previous-tolerance){
      // 뒤쪽 위치가 연속으로 일관되게 확인되면(앞쪽 잠금이 오매칭이었던 경우) 복구한다. 그렇지 않으면 역행 금지.
      state.lockBehindHits=trustable?(Number(state.lockBehindHits)||0)+1:0;
      if(state.lockBehindHits>=3){snap=true;state.lockBehindHits=0}
      else distance=previous;
      state.lockAheadHits=0;
    }else{
      state.lockBehindHits=0;
      if(distance<previous)distance=previous;
      if(distance>previous+maxAdvance){
        // GPS 순간 점프로 한 틱에 지나치게 앞서가지 않도록 제한하되, 연속 3회 같은 앞쪽 위치가
        // 확인되면(실제로 그만큼 이동한 것) 계속 뒤처져 '몰아서 따라잡지' 않고 바로 맞춘다.
        state.lockAheadHits=trustable?(Number(state.lockAheadHits)||0)+1:0;
        if(state.lockAheadHits>=3){snap=true;state.lockAheadHits=0}
        else {state.mapMatch=previousMatch;return null;}
      }else state.lockAheadHits=0;
    }
  }
  const p=pointAtRouteDistance(distance);
  if(!p)return null;
  state.routeLockedDistance=distance;
  state.routeLockedAt=now;
  return {...p,confidence:match.confidence,rawDistance:match.distance,snap};
}

function fuseGpsFix(raw,now){
  const fix=state.gpsFix;
  if(!Number.isFinite(fix.at)||fix.at<=0||!Number.isFinite(fix.lat)||!Number.isFinite(fix.lng)){
    fix.lat=raw.lat;fix.lng=raw.lng;fix.headingDeg=Number.isFinite(raw.heading)?raw.heading:null;fix.speedMps=raw.speed||0;fix.at=now;fix.fixCount=1;
    const first=state.route?.geometry?.length?probabilisticRouteMatch(raw,now):null;
    if(first&&first.distance<Math.max(16,Math.min(45,(raw.accuracy||15)*1.4)))return{lat:first.lat,lng:first.lng,heading:first.heading,mapSnapped:true,routeIndex:first.index,routeDistance:first.routeDistance,matchConfidence:first.confidence};
    return{lat:raw.lat,lng:raw.lng,heading:fix.headingDeg,mapSnapped:false,routeIndex:null,routeDistance:null,matchConfidence:0};
  }
  const dt=Math.min(5,Math.max(0,(now-fix.at)/1000)),predicted=projectForward(fix.lat,fix.lng,fix.headingDeg,fix.speedMps,dt),jump=hav(predicted.lat,predicted.lng,raw.lat,raw.lng),plausible=Math.max((raw.accuracy||20)*3,fix.speedMps*dt*4,35),isTeleport=jump>plausible&&(raw.accuracy||99)>18;
  let posWeight=accuracyWeight(raw.accuracy);if(isTeleport)posWeight*=.25;
  const fusedLat=predicted.lat+(raw.lat-predicted.lat)*posWeight,fusedLng=predicted.lng+(raw.lng-predicted.lng)*posWeight;
  let fusedHeading=fix.headingDeg;
  if(Number.isFinite(raw.heading)&&raw.speed>=1.2)fusedHeading=circularLerp(fix.headingDeg,raw.heading,Math.max(.35,Math.min(.88,raw.speed/8)));
  else if(Number.isFinite(state.imu?.headingDeg)&&now-state.imu.at<1500)fusedHeading=circularLerp(fix.headingDeg,state.imu.headingDeg,.28);
  else if(Number.isFinite(state.compassHeading)&&now-state.compassAt<3000&&raw.speed<1.2)fusedHeading=circularLerp(fix.headingDeg,state.compassHeading,.2);
  fix.lat=fusedLat;fix.lng=fusedLng;fix.headingDeg=fusedHeading;fix.speedMps=raw.speed||0;fix.at=now;fix.fixCount++;
  let outLat=fusedLat,outLng=fusedLng,mapSnapped=false,routeIndex=null,routeDistance=null,matchConfidence=0;
  if(state.route?.geometry?.length){
    const match=probabilisticRouteMatch({lng:fusedLng,lat:fusedLat,heading:fusedHeading,speed:raw.speed,accuracy:raw.accuracy},now);
    if(match){
      const threshold=Math.max(16,Math.min(52,(raw.accuracy||18)*1.55));routeIndex=match.index;routeDistance=match.routeDistance;matchConfidence=match.confidence;
      if(match.distance<threshold&&match.confidence>.18){
        const snapWeight=Math.max(.55,Math.min(.96,.58+match.confidence*.38));outLat=fusedLat+(match.lat-fusedLat)*snapWeight;outLng=fusedLng+(match.lng-fusedLng)*snapWeight;mapSnapped=true;fusedHeading=circularLerp(fusedHeading,match.heading,Math.min(.72,.25+match.confidence*.5));
      }
    }
  }
  fix.mapSnapped=mapSnapped;return{lat:outLat,lng:outLng,heading:fusedHeading,mapSnapped,routeIndex,routeDistance,matchConfidence};
}


const CAMERA_DATASET_URLS=['/data/sejong_daejeon_expressway_cameras.json','/data/daejeon_sejong_corridor_cameras.json','/data/unmanned_traffic_cameras_part1.json','/data/unmanned_traffic_cameras_part2.json'];
// 세종→대전 고속화도로 안내에 반드시 필요한 우선순위 파일. 이 파일이 한 번이라도
// 로드 실패하면 다음 호출에서도 재시도한다(전국 대용량 파일 실패는 재시도하지 않아도 무방).
const CAMERA_DATASET_CRITICAL=new Set(['/data/sejong_daejeon_expressway_cameras.json','/data/daejeon_sejong_corridor_cameras.json']);

/* 7.6.13.2: 전국 카메라 데이터를 Cloudflare D1(+Worker API)에서 실시간으로 받아오기 위한 설정.
   backend/DEPLOY.md 대로 Worker를 배포한 뒤 아래 값을 그 주소로 바꾸면, 매일 자동 갱신되는
   최신 경찰청 데이터를 경로 주변 범위(bbox)만 가볍게 받아 쓰게 된다. 비워두면(기본값) 기존
   정적 JSON 4개 번들만 사용한다(하위 호환). Worker 응답이 실패하면 자동으로 정적 JSON으로
   폴백하므로 배포 전/장애 시에도 안내가 끊기지 않는다. */
/* 7.6.13.3: Cloudflare D1/Worker API 경로는 쓰지 않는다. 카메라 원천은 경찰청 표준데이터(data.go.kr)
   정적 JSON 4개 번들 그대로. 아래 loadOfficialCameraRows()가 그 파일들을 직접 불러온다. */
async function loadOfficialCameraRows(){
  // 7.6.9: 예전에는 4개 파일 중 하나라도 일시적 네트워크 오류로 실패하면 빈 배열([])로
  // state.officialCameraRows에 영구 캐시돼, 앱을 새로고침하기 전까지는 세종↔대전 구간단속
  // 안내가 계속 빠지는 문제가 있었다("정확했었는데 갑자기 안내가 떨어짐"의 원인).
  // 이제는 파일 단위로 성공한 것만 캐시하고, 실패한 핵심 파일(우선순위 구간 데이터)은
  // 다음 경로 계산 때 자동으로 다시 시도한다.
  state.officialCameraByUrl=state.officialCameraByUrl||{};
  const need=CAMERA_DATASET_URLS.filter(url=>!Array.isArray(state.officialCameraByUrl[url]));
  if(need.length){
    if(!state.officialCameraFetchPromise||state.officialCameraFetchUrls!==need.join('|')){
      state.officialCameraFetchUrls=need.join('|');
      state.officialCameraFetchPromise=Promise.all(need.map(async url=>{
        try{
          // 배포 직후 신규 카메라 JSON이 갱신되도록 no-cache 사용.
          const r=await fetch(url,{cache:'no-cache'});
          if(!r.ok)throw new Error(`HTTP ${r.status}`);
          const d=await r.json();
          const rows=Array.isArray(d)?d:Array.isArray(d?.records)?d.records:Array.isArray(d?.response?.body?.items)?d.response.body.items:[];
          state.officialCameraByUrl[url]=/sejong_daejeon_expressway_cameras\.json$/i.test(url)?rows.map(x=>({...x,__priorityExpressway:true})):rows;
        }catch(e){
          // 핵심 파일은 캐시하지 않아 다음 호출에서 재시도되게 하고, 나머지는 빈 배열로 처리해
          // 하나의 파일 오류가 전체 안내를 막지 않게 한다.
          console.warn('camera dataset partial load failed',url,e);
          if(!CAMERA_DATASET_CRITICAL.has(url))state.officialCameraByUrl[url]=[];
        }
      }));
    }
    await state.officialCameraFetchPromise;
    state.officialCameraFetchPromise=null;
  }
  return CAMERA_DATASET_URLS.flatMap(url=>state.officialCameraByUrl[url]||[]);
}
function pickField(obj,keys=[]){for(const k of keys){const v=obj?.[k];if(v!=null&&String(v).trim()!=='')return v}return ''}
function officialCameraType(raw=''){
  const s=String(raw||'').trim();
  if(/신호.*과속|과속.*신호|신호.*속도|속도.*신호/.test(s)||s==='3'||s==='4')return 'signal_speed_camera';
  if(/신호/.test(s)||s==='2'||s==='02')return 'signal_camera';
  // 표준데이터 단속구분 코드 '99'(기타)는 실제로는 대부분 구간(평균속도) 단속에 쓰인다.
  // 짝이 되는 시점/종점 행이 없거나 위치구분 값이 비어 있는 개별 행이라도
  // 일반 속도위반 카메라로 잘못 안내되지 않도록 구간단속으로 분류한다.
  if(s==='99'||/구간/.test(s))return 'section_speed_camera';
  if(/속도|과속/.test(s)||s==='1'||s==='01')return 'speed_camera';
  return 'traffic_camera';
}
function officialSectionPosition(row){
  // 대전경찰 공개 목록에서 확인되는 세종→대전 구즉세종로 6.7km 구간단속 시·종점 보정.
  // 원천 표준데이터 일부 행은 '단속구간위치구분'이 비어 있어 자동 짝짓기가 실패하므로 관리번호를 우선 사용한다.
  const manageNo=String(pickField(row,['무인교통단속카메라관리번호','mnlssRegltCameraManageNo'])||'').trim().toUpperCase();
  if(manageNo==='K0117')return 'start'; // 세종→대전: 둔곡터널 전
  if(manageNo==='K0118')return 'end';   // 세종→대전: 시알들네거리 합류지점(경찰청 공개 종점)
  if(manageNo==='K0119')return 'start'; // 대전→세종: 지수체육공원 뒤
  if(manageNo==='K0120')return 'end';   // 대전→세종: 둔곡교차로
  const raw=String(pickField(row,['단속구간위치구분','sectionPosition','sectionPos'])||'').trim();
  if(/^(0?1|시점|시작)$/i.test(raw))return 'start';
  if(/^(0?2|종점|종료|끝)$/i.test(raw))return 'end';
  // 단속구간위치구분이 비어 있는 구간단속(99/구간) 행은 설치장소 문구로
  // 시점/종점을 보조 추정한다. 예: "둔곡터널 전(→대전)" → 시점.
  // 일반 속도/신호 단속카메라(터널 입구·출구 등)까지 구간으로 오분류하지
  // 않도록, 단속구분이 구간단속으로 확인된 행에만 적용한다.
  const regltRaw=String(pickField(row,['단속구분','regltSe','규제구분'])||'').trim();
  if(regltRaw==='99'||/구간/.test(regltRaw)){
    const place=String(pickField(row,['설치장소','itlpc'])||'');
    if(/(입구|진입\s*전|시점|전\s*\(→|전\)$)/.test(place))return 'start';
    if(/(출구|진출\s*후|종점|지난\s*후|통과\s*후|후\s*\(→|후\)$)/.test(place))return 'end';
  }
  return '';
}
function officialBusLaneCamera(row){
  const text=[
    pickField(row,['설치장소','itlpc']),
    pickField(row,['소재지도로명주소','소재지지번주소']),
    pickField(row,['도로노선명','도로명']),
    pickField(row,['단속구분','regltSe'])
  ].filter(Boolean).join(' ');
  // 버스전용주차장/터미널 출입구는 제외하고, 실제 버스전용차로·버스차로 문구가 있는 위치만 사용한다.
  return /버스\s*전용\s*차로|버스\s*차로|전용차로.*버스|버스.*전용차로/i.test(text)
    && !/버스\s*전용\s*주차|버스\s*전용\s*출입구/i.test(text);
}

/* 7.6.11.6 카메라 진행방향 판정: 데이터에 각도/방향 문구가 있으면 현재 경로 진행방향과 교차검증한다. */
function cameraDirectionHintRaw(row){
  // '도로노선방향'의 1/2/3은 상·하행/양방향 코드이지 각도(deg)가 아니다.
  // 이전에는 이를 1°/2°/3°로 오인해 실제 진행방향 카메라를 반대방향으로 판정하는 문제가 있었다.
  const explicitRaw=String(pickField(row,['단속방향','설치방향','촬영방향','카메라방향','방향','direction','cameraDirection'])||'').trim();
  const roadDirCode=String(pickField(row,['도로노선방향'])||'').trim();
  const raw=explicitRaw||roadDirCode;
  const place=String(pickField(row,['설치장소','itlpc','소재지도로명주소','소재지지번주소'])||'').trim();
  const all=`${explicitRaw} ${place}`.trim();
  const num=Number(String(explicitRaw).replace(/[^0-9.\-]/g,''));
  const numericHeading=explicitRaw&&Number.isFinite(num)&&num>=0&&num<=360?num:null;
  let heading=numericHeading;
  // 숫자(0~360도) 원본 값은 정밀한 방위각이지만, 8방위 단어(북/동/남서 등)에서 유도한 값은
  // 45도 간격으로만 구분되는 대략값이다. 이후 방위각 필터에서 정밀/대략값의 허용오차를
  // 다르게 적용하기 위해 두 경우를 구분해둔다(정밀값은 좁게, 대략값은 도로 곡률을 감안해 넓게).
  let precise=heading!=null;
  if(heading==null){
    const dirs=[['북동',45],['동북',45],['남동',135],['동남',135],['남서',225],['서남',225],['북서',315],['서북',315],['북',0],['동',90],['남',180],['서',270]];
    /* 7.6.11.9 수정: 템플릿 리터럴 안의 \s / \( 는 이스케이프가 사라져 'Invalid regular expression' 예외가 발생했고,
       그 결과 loadStaticCameraEvents 전체가 실패해 모든 공식 단속카메라가 사라졌다. 문자열 연결 + 이중 백슬래시로 교체. */
    for(const [k,h] of dirs){if(new RegExp('(?:^|\\s|\\()'+k+'(?:향|쪽|방향|\\s|$)').test(all)){heading=h;break}}
    precise=false;
  }
  const target=(all.match(/(?:→|->|방향\s*[:：]?\s*)([가-힣]{2,8})/)||[])[1]||'';
  return {raw:all,heading,precise,target,reliable:Boolean(explicitRaw&&(Number.isFinite(heading)||target))};
}
/* 7.6.11.9 방향 판정 도우미는 어떤 입력에서도 예외를 던지지 않는다(예외 → 공식 카메라 전체 소실 방지). */
function cameraDirectionHint(row){
  try{return cameraDirectionHintRaw(row)}catch(e){console.warn('[JOFAMS camera] direction hint failed',e);return{raw:'',heading:null,precise:false,target:'',reliable:false}}
}
function routeHeadingAtIndex(geometry,idx){
  if(!geometry?.length)return NaN;
  const i=Math.max(1,Math.min(geometry.length-1,Math.round(Number(idx)||1)));
  const a=geometry[i-1],b=geometry[i];if(!a||!b)return NaN;
  return bearing(a[1],a[0],b[1],b[0]);
}
function cameraDirectionCompatible(row,route,match){
  try{return cameraDirectionCompatibleRaw(row,route,match)}catch(e){console.warn('[JOFAMS camera] direction check failed',e);return true}
}
/* 반대편 차선/교차 도로 카메라를 걸러내기 위한 방위각 허용오차.
   숫자로 명시된 방위각(precise)은 오차가 거의 없으므로 좁게(약 ±35도) 적용하고,
   8방위 단어(북/동/남서 등)에서 유도한 대략값은 45도 단위로만 구분되는 데다
   도로 곡률까지 겹치면 실제로는 같은 방향인데도 40~60도 가까이 벌어질 수 있어
   조금 더 넉넉하게(±60도) 적용한다. 어느 쪽이든 150도를 넘어가면(사실상 반대 차선)
   정밀도와 무관하게 항상 제외한다. */
function cameraHeadingToleranceDeg(precise){return precise?35:60}
function cameraDirectionCompatibleRaw(row,route,match){
  if(!route?.geometry?.length||!match)return true;
  const hint=cameraDirectionHint(row),rh=Number(match.heading??routeHeadingAtIndex(route.geometry,match.index));
  if(hint.reliable&&Number.isFinite(hint.heading)&&Number.isFinite(rh)){
    const diff=angleDiff(hint.heading,rh);
    if(diff>150)return false; // 반대편 차선으로 사실상 확정되는 각도차: 정밀도와 무관하게 제외
    if(diff>cameraHeadingToleranceDeg(hint.precise))return false;
  }
  if(hint.reliable&&hint.target){
    const dest=[state.destination?.name,state.destination?.address].filter(Boolean).join(' ');
    // 명시된 "대전 방향/세종 방향"과 목적지 지역이 명확히 충돌하면 반대편 장비로 판단한다.
    if(dest&&/(대전|세종)/.test(hint.target)&&/(대전|세종)/.test(dest)&&!dest.includes(hint.target))return false;
  }
  return true;
}
function cameraEventDirectionCompatible(e,geometry){
  try{return cameraEventDirectionCompatibleRaw(e,geometry)}catch(err){return true}
}
function cameraEventDirectionCompatibleRaw(e,geometry){
  if(!geometry?.length)return true;
  // 7.6.11.8: 원천에서 "명시적 촬영방향"이 확인된 카메라에만 2차 방향 필터를 적용한다.
  // API heading/route heading을 카메라 방향으로 오인하면 모든 카메라가 제거될 수 있다.
  if(e?.cameraDirectionReliable!==true)return true;
  const idx=Number(e?.routeIndex);if(!Number.isFinite(idx))return true;
  const rh=routeHeadingAtIndex(geometry,idx);
  const eh=Number(e?.cameraHeading);
  if(Number.isFinite(eh)&&Number.isFinite(rh)){
    const diff=angleDiff(eh,rh);
    if(diff>150)return false;
    if(diff>cameraHeadingToleranceDeg(e?.cameraHeadingPrecise===true))return false;
  }
  return true;
}
function statedSectionLengthMeters(row){
  const raw=String(pickField(row,['과속단속구간길이','sectionLength'])||'').replace(/,/g,'').trim();
  const n=Number(raw);if(!(n>0))return 0;
  // 표준데이터는 km 단위 값(예: 4, 7)이 다수다. 50 이하는 km로, 그보다 큰 값은 m로 보조 해석한다.
  return n<=50?n*1000:n;
}
function buildSectionSpeedEvents(nodes,route){
  const cum=buildCumulative(route),g=route?.geometry||[];
  if(!cum.length||!g.length)return[];
  /* 7.6.11.4 시점/종점은 정점이 아니라 경로 선 위 정확한 진행거리·좌표를 사용한다. */
  const dOf=(n)=>Number.isFinite(Number(n.routeDistance))?Number(n.routeDistance):(cum[n.routeIndex]||0);
  const ptOf=(n)=>Number.isFinite(Number(n.snapLng))&&Number.isFinite(Number(n.snapLat))?[Number(n.snapLng),Number(n.snapLat)]:g[n.routeIndex];
  const starts=[],ends=[];
  const dedup=new Set();
  for(const n of nodes){
    const key=`${n.sectionPosition}:${Math.round(n.lat*100000)}:${Math.round(n.lng*100000)}:${n.maxspeed}`;
    if(dedup.has(key))continue;dedup.add(key);
    (n.sectionPosition==='start'?starts:ends).push(n);
  }
  starts.sort((a,b)=>a.routeIndex-b.routeIndex);ends.sort((a,b)=>a.routeIndex-b.routeIndex);
  const used=new Set(),usedStarts=new Set(),events=[];
  for(const st of starts){
    let best=null,bestScore=Infinity;
    const stRoad=normalizeRoadName(st.roadName||''),stDist=dOf(st);
    for(const en of ends){
      if(used.has(en.id)||dOf(en)<=stDist)continue;
      if(Number(en.maxspeed)!==Number(st.maxspeed))continue;
      const gap=dOf(en)-stDist;if(gap<250||gap>30000)continue;
      const enRoad=normalizeRoadName(en.roadName||''),sameRoad=Boolean(stRoad&&enRoad&&(stRoad===enRoad||stRoad.includes(enRoad)||enRoad.includes(stRoad)));
      const stated=Number(st.sectionLengthMeters)||Number(en.sectionLengthMeters)||0;
      const lenPenalty=stated?Math.abs(gap-stated)/Math.max(600,stated):0;
      if(stated&&lenPenalty>1.15&&!sameRoad)continue;
      if(!stated&&!sameRoad&&gap>12000)continue;
      const score=gap/30000+(sameRoad?-1:0)+lenPenalty*2;
      if(score<bestScore){best=en;bestScore=score}
    }
    if(!best)continue;
    used.add(best.id);usedStarts.add(st.id);
    const startPoint=ptOf(st),endPoint=ptOf(best),sectionLength=dOf(best)-dOf(st);
    events.push({
      id:`section-speed:${st.id}:${best.id}`,type:'section_speed_camera',
      lat:startPoint[1],lng:startPoint[0],routeIndex:st.routeIndex,routeDistance:dOf(st),endRouteDistance:dOf(best),snapLng:startPoint[0],snapLat:startPoint[1],
      endLat:endPoint[1],endLng:endPoint[0],endRouteIndex:best.routeIndex,
      maxspeed:Number(st.maxspeed)||Number(best.maxspeed)||0,
      roadName:st.roadName||best.roadName||'',name:st.name||best.name||'구간단속',
      sectionLength,sectionPosition:'start',source:st.source||best.source||'전국무인교통단속카메라표준데이터(구간 시점·종점)'
    });
    events.push({
      id:`section-speed-end:${st.id}:${best.id}`,type:'section_speed_end',
      lat:endPoint[1],lng:endPoint[0],routeIndex:best.routeIndex,routeDistance:dOf(best),snapLng:endPoint[0],snapLat:endPoint[1],
      maxspeed:Number(st.maxspeed)||Number(best.maxspeed)||0,
      roadName:best.roadName||st.roadName||'',name:best.name||st.name||'구간단속 종료',
      sectionPosition:'end',source:best.source||st.source||'전국무인교통단속카메라표준데이터(구간 종점)'
    });
  }
  // 공식 데이터의 시점/종점 표기가 실제 주행방향과 뒤집힌 경우를 보정한다.
  // 예: 앞쪽 카메라가 '종점', 뒤쪽 카메라가 '시점'으로 등록된 경우,
  // 경로상 먼저 만나는 지점을 시작점, 나중 지점을 종료점으로 재구성한다.
  for(const st of starts){
    if(usedStarts.has(st.id))continue;
    let best=null,bestScore=Infinity;
    const stRoad=normalizeRoadName(st.roadName||'');
    for(const en of ends){
      if(used.has(en.id)||dOf(en)>=dOf(st))continue;
      if(Number(en.maxspeed)!==Number(st.maxspeed))continue;
      const gap=dOf(st)-dOf(en);
      if(gap<250||gap>30000)continue;
      const enRoad=normalizeRoadName(en.roadName||'');
      const sameRoad=Boolean(stRoad&&enRoad&&(stRoad===enRoad||stRoad.includes(enRoad)||enRoad.includes(stRoad)));
      const stated=Number(st.sectionLengthMeters)||Number(en.sectionLengthMeters)||0;
      const lenPenalty=stated?Math.abs(gap-stated)/Math.max(600,stated):0;
      if(stated&&lenPenalty>1.25&&!sameRoad)continue;
      if(!stated&&!sameRoad&&gap>12000)continue;
      const score=gap/30000+(sameRoad?-1:0)+lenPenalty*2;
      if(score<bestScore){best=en;bestScore=score}
    }
    if(!best)continue;
    used.add(best.id);usedStarts.add(st.id);
    const startPoint=ptOf(best),endPoint=ptOf(st);
    const sectionLength=dOf(st)-dOf(best);
    events.push({
      id:`section-speed:direction-fixed:${best.id}:${st.id}`,type:'section_speed_camera',
      lat:startPoint[1],lng:startPoint[0],routeIndex:best.routeIndex,routeDistance:dOf(best),endRouteDistance:dOf(st),snapLng:startPoint[0],snapLat:startPoint[1],
      endLat:endPoint[1],endLng:endPoint[0],endRouteIndex:st.routeIndex,
      maxspeed:Number(st.maxspeed)||Number(best.maxspeed)||0,
      roadName:best.roadName||st.roadName||'',name:best.name||st.name||'구간단속',
      sectionLength,sectionPosition:'start',source:best.source||st.source||'전국무인교통단속카메라표준데이터(주행방향 시·종점 자동보정)'
    });
    events.push({
      id:`section-speed-end:direction-fixed:${best.id}:${st.id}`,type:'section_speed_end',
      lat:endPoint[1],lng:endPoint[0],routeIndex:st.routeIndex,routeDistance:dOf(st),snapLng:endPoint[0],snapLat:endPoint[1],
      maxspeed:Number(st.maxspeed)||Number(best.maxspeed)||0,
      roadName:st.roadName||best.roadName||'',name:st.name||best.name||'구간단속 종료',
      sectionPosition:'end',source:st.source||best.source||'전국무인교통단속카메라표준데이터(주행방향 종점 자동보정)'
    });
  }

  // 시점·종점 짝이 확인되지 않은 구간단속 레코드는 오안내 방지를 위해 안내하지 않는다.
  return events;
}
function buildKnownGujikSectionEvents(nodes,route){
  const g=route?.geometry||[],cum=buildCumulative(route);if(!g.length||!cum.length)return {events:[],remaining:nodes||[]};
  const dOf=(n)=>Number.isFinite(Number(n.routeDistance))?Number(n.routeDistance):(cum[n.routeIndex]||0);
  const ptOf=(n)=>Number.isFinite(Number(n.snapLng))&&Number.isFinite(Number(n.snapLat))?[Number(n.snapLng),Number(n.snapLat)]:g[n.routeIndex];
  const known=new Map((nodes||[]).map(n=>[String(n.manageNo||'').toUpperCase(),n]));
  const pairs=[['K0117','K0118','세종→대전'],['K0119','K0120','대전→세종']];
  const used=new Set(),events=[];
  for(const [startNo,endNo,label] of pairs){
    const st=known.get(startNo),en=known.get(endNo);if(!st||!en)continue;
    // 현재 경로에서 시점이 종점보다 먼저 나타나는 방향의 쌍만 활성화한다.
    // 반대편 차로의 구간단속 쌍이 같은 도로에 가까이 있어도 교차 매칭하지 않는다.
    if(!(dOf(st)<dOf(en)))continue;
    const startPoint=ptOf(st),endPoint=ptOf(en);if(!startPoint||!endPoint)continue;
    const sectionLength=Math.max(0,dOf(en)-dOf(st));
    if(sectionLength<250||sectionLength>30000)continue;
    events.push({
      id:`section-speed:known:${startNo}:${endNo}`,type:'section_speed_camera',
      lat:startPoint[1],lng:startPoint[0],routeIndex:st.routeIndex,routeDistance:dOf(st),endRouteDistance:dOf(en),snapLng:startPoint[0],snapLat:startPoint[1],endLat:endPoint[1],endLng:endPoint[0],endRouteIndex:en.routeIndex,
      maxspeed:Number(st.maxspeed)||Number(en.maxspeed)||80,roadName:st.roadName||en.roadName||'구즉세종로',name:`${label} 구간단속`,
      sectionLength,sectionPosition:'start',source:'대전경찰청 공개 무인교통단속장비 현황(확정 시·종점)'
    });
    events.push({
      id:`section-speed-end:known:${startNo}:${endNo}`,type:'section_speed_end',
      lat:endPoint[1],lng:endPoint[0],routeIndex:en.routeIndex,routeDistance:dOf(en),snapLng:endPoint[0],snapLat:endPoint[1],maxspeed:Number(st.maxspeed)||Number(en.maxspeed)||80,
      roadName:en.roadName||st.roadName||'구즉세종로',name:`${label} 구간단속 종료`,sectionPosition:'end',
      source:'대전경찰청 공개 무인교통단속장비 현황(확정 종점)'
    });
    used.add(startNo);used.add(endNo);
  }
  return {events,remaining:(nodes||[]).filter(n=>!used.has(String(n.manageNo||'').toUpperCase()))};
}
function geometryBounds(geometry=[]){
  let minLng=Infinity,maxLng=-Infinity,minLat=Infinity,maxLat=-Infinity;
  for(const p of geometry){const lng=Number(p?.[0]),lat=Number(p?.[1]);if(!Number.isFinite(lng)||!Number.isFinite(lat))continue; if(lng<minLng)minLng=lng;if(lng>maxLng)maxLng=lng;if(lat<minLat)minLat=lat;if(lat>maxLat)maxLat=lat}
  if(!Number.isFinite(minLng)||!Number.isFinite(minLat))return null;
  return {minLng,maxLng,minLat,maxLat};
}
function expandBounds(bounds,meters=1200){
  if(!bounds)return null;const midLat=(bounds.minLat+bounds.maxLat)/2,latPad=meters/111320,lonPad=meters/(111320*Math.max(.2,Math.cos(midLat*Math.PI/180)));
  return {minLng:bounds.minLng-lonPad,maxLng:bounds.maxLng+lonPad,minLat:bounds.minLat-latPad,maxLat:bounds.maxLat+latPad};
}
function inBounds(lat,lng,b){return b&&lng>=b.minLng&&lng<=b.maxLng&&lat>=b.minLat&&lat<=b.maxLat}
async function loadStaticCameraEvents(route){
  const geometry=route?.geometry||[]; if(!geometry.length)return [];
  const bounds=expandBounds(geometryBounds(geometry),1400);
  // 7.6.13.2: D1/Worker API가 설정돼 있으면 경로 주변 범위만 가볍게 우선 조회하고,
  // 실패하거나 아직 미설정이면 기존 정적 JSON 번들로 폴백한다(안내 공백 방지).
  const rows=await loadOfficialCameraRows();
  const out=[],sectionNodes=[];
  if(!rows.length)return [];
  for(const row of rows){
    try{
    const lat=Number(pickField(row,['위도','latitude','lat'])),lng=Number(pickField(row,['경도','longitude','lng','lon']));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!inBounds(lat,lng,bounds))continue;
    const dirHint=cameraDirectionHint(row);
    const routeMatch=(dirHint.reliable&&Number.isFinite(dirHint.heading))
      ?cameraRouteMatch(lng,lat,route,dirHint.heading)
      :nearestPointOnRoute(lng,lat,geometry);
    if(!routeMatch||!Number.isFinite(Number(routeMatch.index)))continue;
    const idx=Math.max(0,Math.min(geometry.length-1,Number(routeMatch.index)));
    const p=geometry[idx]; if(!p)continue;
    const d=Number(routeMatch.distance);
    // 구간단속(시작/종점) 카메라는 아래에서 별도의 시종점 짝짓기·거리·도로명 검증
    // (buildKnownGujikSectionEvents/buildSectionSpeedEvents)을 거치므로, 일반 지점 카메라용
    // 방위각 필터를 여기서 추가로 적용하지 않는다. 두 필터가 겹치면 시작/종점 중 한쪽만
    // 미세한 각도차로 탈락해 짝이 깨지고, 그 결과 "구간단속이 시작됐다가 중간에 사라지는"
    // 문제가 생겼다(실시간 경로 재계산마다 판정이 갈릴 수 있어 간헐적으로 재현됨).
    const sectionPositionEarly=officialSectionPosition(row);
    if(!sectionPositionEarly&&!cameraDirectionCompatible(row,route,routeMatch))continue;
    const dataDate=String(pickField(row,['데이터기준일자','dataReferenceDate'])||'');
    const authorityRaw=String(pickField(row,['관리기관명','institutionNm'])||'');
    const currentPolice=/경찰청/.test(authorityRaw)&&/^202[5-9]-/.test(dataDate);
    /* 7.6.11.4 카메라 좌표는 경로 선에서 50m(고속화도로 우선보정 120m) 안일 때만 채택한다. 기존 180~450m 허용은 옆길·반대편·평행도로 카메라까지 경로 위로 끌어와 한꺼번에 여러 대가 보이게 했다. */
    // 반대편 차선/램프 장비를 끌어오지 않도록 허용 반경을 축소한다.
    // 우선 고속화도로 데이터도 좌표 오차를 감안하되 55m를 넘기지 않는다.
    // 추가 정밀도 개선: 출처가 최신(2025년 이후 경찰청 공식) 확인된 일반 지점 카메라는
    // 좌표 신뢰도가 가장 높으므로 더 좁은 반경(45m/고속화도로 85m)으로 매칭해 정밀도를
    // 높인다. 다만 구간단속 시·종점 행은 관리번호 기반 별도 짝짓기 로직이 있고, 터널
    // 입구 등 도로 곡률이 큰 구간에 설치되는 경우가 많아 기존 허용치를 그대로 유지한다
    // (여기서 더 좁히면 짝의 한쪽만 탈락해 구간단속이 중간에 끊기는 문제가 재발할 수 있음).
    const cameraTolerance=sectionPositionEarly
      ?(row.__priorityExpressway?105:70)
      :(row.__priorityExpressway?(currentPolice?85:105):(currentPolice?45:70));
    if(!Number.isFinite(d)||d>cameraTolerance)continue;
    const maxspeed=Number(pickField(row,['제한속도','lmttVe','speedLimit']))||0;
    const protectedArea=String(pickField(row,['보호구역구분','protectedArea'])).trim();
    const roadName=String(pickField(row,['도로노선명','도로명','roadName'])).trim();
    const name=String(pickField(row,['설치장소','itlpc','소재지도로명주소','소재지지번주소','도로노선명'])).trim()||'무인교통단속카메라';
    const manageNo=pickField(row,['무인교통단속카메라관리번호','mnlssRegltCameraManageNo'])||`${lat}:${lng}`;
    const sectionPosition=sectionPositionEarly;

    if(sectionPosition&&maxspeed>0){
      sectionNodes.push({
        id:`local-section-node:${manageNo}`,manageNo:String(manageNo).toUpperCase(),sectionPosition,lat,lng,routeIndex:idx,name,maxspeed,roadName,routeDistance:routeDistanceFromMatch(routeMatch,geometry),snapLng:routeMatch.lng,snapLat:routeMatch.lat,
        sectionLengthMeters:statedSectionLengthMeters(row),source:'전국무인교통단속카메라표준데이터'
      });
      continue;
    }

    let type=officialBusLaneCamera(row)?'bus_lane_camera':officialCameraType(pickField(row,['단속구분','regltSe','규제구분']));
    if(row.__priorityExpressway&&type==='section_speed_camera'&&!sectionPosition)type='traffic_camera';
    const base={
      id:`local-camera:${manageNo}`,type,lat,lng,originalLat:lat,originalLng:lng,routeIndex:idx,name,maxspeed,
      routeDistance:routeDistanceFromMatch(routeMatch,geometry),snapLng:routeMatch.lng,snapLat:routeMatch.lat,routeMatchDistance:d,
      /* 7.6.13.2: 경찰청 원본 좌표 ↔ 경로 스냅 지점 거리(d)가 40m를 넘으면 "저정밀" 매칭으로 표시한다.
         원본 위경도 오차가 크면 스냅된 routeDistance 자체가 실제 카메라 위치보다 앞/뒤로 밀려
         안내가 일찍 시작되거나 일찍 끝나는 현상의 직접 원인이 된다. 근본 해결은 정확한 좌표를
         받아오는 것(D1 파이프라인 + 실주행 확인 좌표 보정)이지만, 그 전까지는 저정밀 매칭에
         한해 안내 타이밍에 여유(버퍼)를 더 준다(computeSafetyCandidates 참고). */
      lowPrecision:Number.isFinite(d)&&d>40,
      routeHeading:Number(routeMatch.heading??routeHeadingAtIndex(geometry,idx)),cameraDirection:dirHint.raw||'',cameraHeading:Number.isFinite(dirHint.heading)?dirHint.heading:null,cameraHeadingPrecise:Boolean(dirHint.precise),cameraDirectionReliable:Boolean(dirHint.reliable),
      authority:String(pickField(row,['관리기관명','institutionNm'])).trim(),dataDate,currentOfficial:currentPolice,
      protectedArea,roadName,priorityExpressway:Boolean(row.__priorityExpressway),source:row.__priorityExpressway?'전국무인교통단속카메라표준데이터(세종→대전 고속화도로 우선보정)':'전국무인교통단속카메라표준데이터(로컬 파일)'
    };
    out.push(base);
    if(/어린이|스쿨|school/i.test(protectedArea)){
      out.push({...base,id:`${base.id}:school`,type:'school_zone',name:`${name} 어린이보호구역`,maxspeed:maxspeed||30});
    }
    }catch(rowErr){console.warn('[JOFAMS camera] row skipped',rowErr)} // 한 행의 오류가 전체 카메라를 없애지 않도록 격리
  }
  const known=buildKnownGujikSectionEvents(sectionNodes,route);
  out.push(...known.events,...buildSectionSpeedEvents(known.remaining,route));
  return mergeSafetyEvents(out,geometry);
}
function normalizeRoadName(v=''){return String(v||'').replace(/\s+/g,'').replace(/(대로|로|길|거리)$/,'').toLowerCase()}
/* 7.6.13.3: 설치장소 문구를 비교 가능한 핵심 지명으로 정규화한다.
   "상서삼거리", "상서 삼거리(→대전)", "상서삼거리 합류지점" 을 모두 같은 지점으로 인식시키기 위함. */
function normalizeSiteName(v=''){
  return String(v||'')
    .replace(/\([^)]*\)/g,'')            // 괄호 안 부가설명(방향 화살표 등) 제거
    .replace(/[→←↔·,.\-]/g,' ')
    .replace(/(교차로|사거리|삼거리|네거리|합류지점|진입로|진출로|시점|종점|앞|후|전|부근|주변|인근)/g,'')
    .replace(/\s+/g,'')
    .toLowerCase();
}
/* 7.6.13.3: 구간단속 종점 근처가 아니어도, 오래된 지자체(2022년 이전) 개별 카메라 레코드가
   현행 경찰청(2025년 이후) 레코드와 "같은 설치장소 문구 + 같은 도로 + 같은 제한속도"를 가리키면
   물리적으로 같은 카메라로 보고 하나만 남긴다. (예: 구즉세종로 남행 구간단속 종점을 지나
   대전 방향으로 더 내려간 '상서삼거리'에 2022년 대전광역시 레코드 G3122와 2026년 경찰청
   레코드 K0335가 약 170m 간격으로 중복 표시되던 사례 — 종점에서 900m 가까이 떨어져 있어
   기존 구간단속 종점 반경 규칙으로는 걸러지지 않았다.) */
function suppressStaleNamedDuplicateCameras(events=[]){
  const list=[...(events||[])];
  const byName=new Map();
  for(const e of list){
    if(!PHYSICAL_SPEED_FAMILY.has(e.type)||!e.name)continue;
    const key=normalizeSiteName(e.name);
    if(!key||key.length<2)continue;
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push(e);
  }
  const drop=new Set();
  for(const group of byName.values()){
    if(group.length<2)continue;
    const current=group.filter(e=>e.currentOfficial),stale=group.filter(e=>!e.currentOfficial);
    if(!current.length||!stale.length)continue;
    for(const s of stale){
      for(const c of current){
        const sameRoad=!s.roadName||!c.roadName||normalizeRoadName(s.roadName)===normalizeRoadName(c.roadName);
        const sameLimit=!Number(s.maxspeed)||!Number(c.maxspeed)||Number(s.maxspeed)===Number(c.maxspeed);
        const dist=(Number.isFinite(Number(s.lat))&&Number.isFinite(Number(c.lat)))?hav(Number(s.lat),Number(s.lng),Number(c.lat),Number(c.lng)):Infinity;
        // 이름이 이미 같은 지점을 가리키므로 물리 거리 허용범위를 넓게(300m) 둔다.
        if(sameRoad&&sameLimit&&dist<=300){drop.add(s.id);break}
      }
    }
  }
  return drop.size?list.filter(e=>!drop.has(e.id)):list;
}
function applyRouteSpeedLimitHints(route,events=[]){
  const segs=route?.roadSegments||[],cum=buildCumulative(route);
  const limitEvents=events.filter(e=>Number(e?.maxspeed)>0&&e.type==='speed_limit');
  if(!segs.length||!limitEvents.length)return;
  for(const seg of segs){
    if(Number(seg?.speedLimit)>0)continue;
    const start=Math.max(0,Number(seg.startIndex)||0),end=Math.max(start,Number(seg.endIndex)||start),mid=(start+end)/2;
    const segName=normalizeRoadName(seg.name);let best=null,bestScore=Infinity;
    for(const e of limitEvents){
      const ri=Number(e.routeIndex);if(!Number.isFinite(ri))continue;
      const eventRoad=normalizeRoadName(e.roadName||e.name||'');
      const sameRoad=Boolean(segName&&eventRoad&&(eventRoad.includes(segName)||segName.includes(eventRoad)));
      const inside=ri>=start&&ri<=end;
      const midMeters=cum.length?Math.abs((cum[Math.min(cum.length-1,Math.round(ri))]||0)-(cum[Math.min(cum.length-1,Math.round(mid))]||0)):Math.abs(ri-mid)*8;
      if(!inside&&!sameRoad)continue;if(midMeters>700)continue;
      const score=midMeters+(inside?0:120)+(sameRoad?0:180)+(e.type==='speed_limit'?-100:0);
      if(score<bestScore){best=e;bestScore=score}
    }
    if(best)seg.speedLimit=Number(best.maxspeed)||0;
  }
}

/* ---------- MAP ---------- */
async function loadMapLibre(){
  if(maplibregl)return maplibregl;
  const sources=[
    'https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl.mjs'
  ];
  let lastError=null;
  for(const src of sources){
    try{maplibregl=await import(src);return maplibregl}catch(e){lastError=e;console.warn('MapLibre module load failed',src,e)}
  }
  throw lastError||new Error('MapLibre module unavailable');
}
const COLOR_MAP_STYLE='https://tiles.openfreemap.org/styles/liberty';
function rasterStyle(provider='osm'){
  const tiles=provider==='osm'
    ? ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']
    : ['https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'];
  return {version:8,sources:{base:{type:'raster',tiles,tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',type:'raster',source:'base',minzoom:0,maxzoom:20}]};
}
// 7.6.1.9: 위성 지도 보기. GPS 정확도 자체를 높이는 것은 브라우저 환경에서 불가능하지만(멀티위성/RTK 제어 불가),
// 실제 항공/위성 사진 위에 현재 위치 마커를 겹쳐 보여주면 사용자가 눈으로 실제 도로/건물과 위치를
// 대조해 오차를 직접 확인·보정하는 데 도움이 된다. 별도 API 키가 필요 없는 Esri 위성 타일을 사용한다.
function satelliteStyle(){
  return {version:8,sources:{
    satBase:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Esri, Maxar, Earthstar Geographics'},
    satLabels:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19}
  },layers:[
    {id:'satBase',type:'raster',source:'satBase',minzoom:0,maxzoom:20},
    {id:'satLabels',type:'raster',source:'satLabels',minzoom:0,maxzoom:20,paint:{'raster-opacity':.85}}
  ]};
}
function currentBaseMapStyle(){
  if(state.mapSatellite)return satelliteStyle();
  return state.mapFallbackTried?rasterStyle(state.mapFallbackTried):COLOR_MAP_STYLE;
}
// setStyle()은 지도 위 레이어/소스(경로선 등)를 모두 초기화하므로, 스타일 전환 후 다시 그려준다.
// (사용자 위치/목적지 마커 등 maplibregl.Marker는 별도 DOM 오버레이라 스타일 전환에 영향받지 않는다.)

function restoreMapOverlaysAfterStyleChange(){
  if(!state.map)return;
  const restore=()=>{
    try{
      if(!state.map?.isStyleLoaded?.())return false;
      state.mapReady=true;
      enforce2DMap();

      // setStyle()로 사라진 GeoJSON source/layer를 반드시 다시 생성한다.
      if(state.route?.geometry?.length){
        state.pendingRouteDraw=null;
        drawRoute(state.route,{fit:false});
      }

      // DOM Marker 계열도 현재 상태를 기준으로 즉시 다시 표시한다.
      if(state.route?.geometry?.length&&state.safetyEvents?.length)renderSafetyMarkers();
      ensureRouteCameraStackOrder();

      // 온누리/지역상품권은 위성/일반 지도 여부와 관계없이 다시 렌더링한다.
      if(!state.tripStartedAt&&!$('homeView')?.classList.contains('hidden')){
        if(state.onnuriData)renderOnnuriMarkers(state.onnuriData);
        if(state.localVoucherData)renderLocalVoucherMarkers(state.localVoucherData);
        scheduleOnnuriRefresh(true);
        scheduleLocalVoucherRefresh();
        scheduleHomeCameraRefresh();
      }
      return true;
    }catch(e){
      console.warn('map overlay restore failed',e);
      return false;
    }
  };

  // style.load 직후 1회 + 일부 WebView에서 style load 이벤트가 빠지는 경우를 위한 재확인.
  if(restore())return;
  let tries=0;
  const retry=()=>{
    tries++;
    if(restore()||tries>=12)return;
    setTimeout(retry,100);
  };
  setTimeout(retry,60);
}

function toggleMapSatellite(){
  if(!state.map)return;
  state.mapSatellite=!state.mapSatellite;
  try{
    // setStyle 직전에 현재 경로를 보존해 style 전환 중 pending 상태로 유실되지 않게 한다.
    if(state.route?.geometry?.length){
      state.pendingRouteDraw={route:state.route,options:{fit:false}};
    }
    state.map.setStyle(currentBaseMapStyle());

    let restored=false;
    const onStyleLoaded=()=>{
      if(restored)return;
      restored=true;
      state.pendingRouteDraw=null;
      restoreMapOverlaysAfterStyleChange();
    };
    state.map.once('style.load',onStyleLoaded);

    // 일부 Android WebView/MapLibre 조합에서 style.load 타이밍이 불안정한 경우 보조 복구.
    setTimeout(()=>{
      if(!restored&&state.map?.isStyleLoaded?.()){
        restored=true;
        state.pendingRouteDraw=null;
        restoreMapOverlaysAfterStyleChange();
      }
    },500);
  }catch(e){console.warn('satellite toggle failed',e)}
  const btn=$('mapSatelliteBtn');
  if(btn){
    btn.classList.toggle('active',state.mapSatellite);
    btn.setAttribute('aria-pressed',String(state.mapSatellite));
    btn.textContent=state.mapSatellite?'일반':'위성';
  }
}
function mapHasRenderedTiles(){
  try{return Boolean(state.map?.getCanvas()?.width&&state.map?.getCanvas()?.height&&state.map?.isStyleLoaded()&&(typeof state.map.areTilesLoaded!=='function'||state.map.areTilesLoaded()))}catch{return false}
}
function useMapFallback(){
  if(!state.map)return;
  const next=state.mapFallbackTried===false?'osm':state.mapFallbackTried==='osm'?'hot':null;
  if(!next)return;
  state.mapFallbackTried=next;
  try{
    state.map.setStyle(rasterStyle(next));
    state.map.once('style.load',()=>{state.mapReady=true;enforce2DMap();refreshMapLayout({fitRoute:Boolean(state.route)});restoreMapOverlaysAfterStyleChange();setTimeout(()=>{if(!mapHasRenderedTiles())useMapFallback()},2600)});
  }catch(e){console.warn('map fallback failed',e)}
}
function setBuildingExtrusions(visible){
  if(!state.map)return;
  try{const layers=state.map.getStyle()?.layers||[];layers.filter(l=>l.type==='fill-extrusion').forEach(l=>{try{state.map.setLayoutProperty(l.id,'visibility',visible?'visible':'none')}catch{}})}catch{}
}
// 2D/3D는 건물 입체 레이어의 차이이며, 주행 중 2D 지도도 전방을 볼 수 있도록 기울인다.
// 홈·경로 탐색은 종전처럼 위에서 내려다보는 평면 지도를 유지한다.
const DRIVE_2D_PITCH=48;
const DRIVE_3D_PITCH=55;
const DRIVE_2D_ZOOM=16.85;
const DRIVE_3D_ZOOM=17.2;
function driveMapPitch(){return state.map3D?DRIVE_3D_PITCH:DRIVE_2D_PITCH}
function driveMapZoom(){return state.map3D?DRIVE_3D_ZOOM:DRIVE_2D_ZOOM}
function enforce2DMap(){
  if(!state.map||state.map3D)return;
  try{
    const driving=Boolean(document.getElementById('driveView')&&!document.getElementById('driveView').classList.contains('hidden'));
    state.map.jumpTo({pitch:driving?DRIVE_2D_PITCH:0});
    setBuildingExtrusions(false);
  }catch(e){console.warn('2D map enforcement failed',e)}
}

async function initMap(){
  try{
    await loadMapLibre();
    if(!maplibregl?.Map)throw new Error('MapLibre library unavailable');
    state.map=new maplibregl.Map({container:'map',style:COLOR_MAP_STYLE,center:[127.3847,36.3784],zoom:14,pitch:0,maxPitch:60,bearing:0,pitchWithRotate:true,dragRotate:true,touchPitch:true,attributionControl:true,fadeDuration:0,refreshExpiredTiles:false});
    state.map.on('load',()=>{
      state.mapReady=true;enforce2DMap();state.map.resize();
      state.map.on('click',e=>{if(state.tripStartedAt)toggleMapControls(true);else handleHomeMapClick(e)});
      state.map.on('touchend',()=>{if(state.tripStartedAt)toggleMapControls(true)});
      state.map.on('rotate',updateDriveCompass);
      state.map.on('dragstart',e=>{if(e?.originalEvent)markMapManualExplore(true)});
      state.map.on('zoomstart',e=>{if(e?.originalEvent)markMapManualExplore(true)});
      state.map.on('rotatestart',e=>{if(e?.originalEvent)markMapManualExplore(true)});
      state.map.on('drag',e=>{if(e?.originalEvent)noteMapManualInput()});
      state.map.on('zoom',e=>{if(e?.originalEvent)noteMapManualInput()});
      state.map.on('rotate',e=>{if(e?.originalEvent)noteMapManualInput()});
      state.map.on('dragend',e=>{if(e?.originalEvent)endMapManualExplore()});
      state.map.on('zoomend',e=>{if(e?.originalEvent)endMapManualExplore()});
      state.map.on('rotateend',e=>{if(e?.originalEvent)endMapManualExplore()});
      state.map.on('zoomend',()=>{
        if(state.onnuriData)renderOnnuriMarkers(state.onnuriData);
        if(state.localVoucherData)renderLocalVoucherMarkers(state.localVoucherData);
        if(!state.tripStartedAt&&!$('homeView')?.classList.contains('hidden')){
          scheduleLocalVoucherRefresh(true);
          scheduleOnnuriRefresh(true);
        }
        if(state.route?.geometry?.length&&state.safetyEvents?.length)renderSafetyMarkers();
        ensureDestinationMarker();
      });
      state.map.on('moveend',()=>{
        // 홈에서 지도를 옮긴 새 화면 범위를 기준으로 두 상품권 가맹점을 빠르게 재조회한다.
        if(!state.tripStartedAt&&!$('homeView')?.classList.contains('hidden')){
          scheduleLocalVoucherRefresh(true);
          scheduleOnnuriRefresh(true);
        }
        scheduleHomeCameraRefresh();ensureDestinationMarker();
      });
      state.map.on('style.load',()=>{if(state.mapReady)restoreMapOverlaysAfterStyleChange();setTimeout(ensureDestinationMarker,0)});
      if(state.pendingRouteDraw){const p=state.pendingRouteDraw;state.pendingRouteDraw=null;drawRoute(p.route,p.options)}
      permissionStatus('geolocation').then(async status=>{
        try{
          const u=await locate(status==='granted');
          if(u&&pointValid(u)&&state.map){state.map.easeTo({center:[u.lng,u.lat],zoom:15.5,duration:450});if(!state.fuelData&&!state.fuelLoading)loadFuelPrices(state.fuelProduct).catch(()=>{});}
        }catch(e){console.warn('initial current location failed',e)}
        setTimeout(()=>{scheduleLocalVoucherRefresh();scheduleOnnuriRefresh();scheduleHomeCameraRefresh()},250);
      });
      setTimeout(()=>{scheduleLocalVoucherRefresh();scheduleOnnuriRefresh();scheduleHomeCameraRefresh()},900);
      clearTimeout(state.mapWatchdog);
      state.mapWatchdog=setTimeout(()=>{if(!mapHasRenderedTiles())useMapFallback()},2200);
    });
    let sourceErrors=0;
    state.map.on('error',e=>{
      console.warn('MapLibre error',e?.error||e);
      sourceErrors++;
      if(sourceErrors>=3&&!state.mapFallbackTried)useMapFallback();
    });
  }catch(e){console.error('Map init failed',e);toast('지도를 초기화하지 못했습니다. 페이지를 새로고침해 주세요.',3500)}
}

function visibleNamedMapFeature(point){
  if(!state.map||!point)return null;
  try{
    const pad=10,features=state.map.queryRenderedFeatures([[point.x-pad,point.y-pad],[point.x+pad,point.y+pad]])||[];
    const named=features.find(f=>{
      const p=f?.properties||{},name=p.name_ko||p['name:ko']||p.name||p.ref;
      if(!name)return false;
      const layer=String(f?.layer?.id||'').toLowerCase();
      return /poi|place|label|shop|amenity|building|road|transit|station/.test(layer);
    })||features.find(f=>{
      const p=f?.properties||{};return Boolean(p.name_ko||p['name:ko']||p.name);
    });
    if(!named)return null;
    const p=named.properties||{};
    return {name:String(p.name_ko||p['name:ko']||p.name||p.ref||'이 위치').trim()};
  }catch{return null}
}
async function resolveMapClickedPlace(e){
  const lng=Number(e?.lngLat?.lng),lat=Number(e?.lngLat?.lat);
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return null;
  const feature=visibleNamedMapFeature(e.point);
  if(feature?.name){
    try{
      const u=new URL('/api/search',location.origin);u.searchParams.set('q',feature.name);u.searchParams.set('lng',lng);u.searchParams.set('lat',lat);u.searchParams.set('sort','center');
      const r=await fetch(u);if(r.ok){const d=await r.json(),best=(d.items||[])[0];if(best&&pointValid(best))return normalizedPlace(best)}
    }catch{}
  }
  try{
    const u=new URL('/api/place-click',location.origin);u.searchParams.set('lng',lng);u.searchParams.set('lat',lat);
    const r=await fetch(u);if(r.ok){const d=await r.json();if(d?.item&&pointValid(d.item))return normalizedPlace(d.item)}
  }catch{}
  return {name:feature?.name||'지도에서 선택한 위치',address:'지도 좌표',lng,lat};
}
function showMapPlacePrompt(place){
  if(!state.whereMapPreviewActive){if($('mapPlacePromptCancel'))$('mapPlacePromptCancel').textContent='취소';if($('mapPlacePromptGo'))$('mapPlacePromptGo').textContent='확인 · 길안내'}
  state.mapPlaceCandidate=place;
  if($('mapPlacePromptTitle'))$('mapPlacePromptTitle').textContent=place?.name||'이 위치';
  const voucher=place?.voucher;
  const onnuri=place?.onnuri;
  if($('mapPlacePromptText')){
    if(voucher){
      const uses=voucherUseFlags(voucher);
      const unavailable=['카드','모바일','지류'].filter(x=>!uses.includes(x));
      $('mapPlacePromptText').textContent=`사용 가능: ${uses.length?uses.join(' · '):'정보 없음'}${unavailable.length?` · 미지원: ${unavailable.join(' · ')}`:''}`;
    }else if(onnuri){
      const uses=onnuriUseFlags(onnuri);
      const approx=onnuri.approximate||onnuri.precision==='market-zone'||onnuri.precision==='admin-zone';
      const parts=[`온누리상품권 ${uses.length?uses.join(' · '):'사용수단 확인'}`];
      if(onnuri.market)parts.push(onnuri.market);
      parts.push(approx?'시장·상점가 대표 위치':'가맹점 위치 확인');
      $('mapPlacePromptText').textContent=parts.join(' · ');
    }else $('mapPlacePromptText').textContent=`${place?.name||'이 위치'}로 안내해 드릴까요?`;
  }
  $('mapPlacePrompt')?.classList.remove('hidden');
}
function closeMapPlacePrompt(){state.mapPlaceCandidate=null;$('mapPlacePrompt')?.classList.add('hidden')}
async function handleHomeMapClick(e){
  if($('homeView')?.classList.contains('hidden'))return;
  if(!state.homeSheetCollapsed)return;
  const place=await resolveMapClickedPlace(e);if(place)showMapPlacePrompt(place);
}
async function startMapPlaceNavigation(){
  const p=state.mapPlaceCandidate;if(!p)return;
  const fromWhere=Boolean(state.whereMapPreviewActive);
  closeMapPlacePrompt();
  clearWhereMapPreview();state.whereMapPreviewReturn=false;
  setHomeSheetCollapsed(false);
  // Only this explicit confirmation may initiate destination selection.
  await chooseDestination(p,{autoGuide:!fromWhere});
  if(fromWhere)cancelAutoStart(); // where-to map preview never auto-starts guidance
}



function clearHomeCameraMarkers(){
  for(const m of state.homeCameraMarkers||[])try{m.remove()}catch{}
  state.homeCameraMarkers=[];
}

function cctvMarkerSvg(){
  return `<svg viewBox="0 0 28 28" aria-hidden="true">
    <path d="M6.2 8.3h11.1c1.1 0 2 .9 2 2v4.6c0 1.1-.9 2-2 2H6.2c-1.1 0-2-.9-2-2v-4.6c0-1.1.9-2 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <circle cx="14.7" cy="12.6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M19.4 11.1 24 8.9v7.4l-4.6-2.2M9.2 17.1l-1.4 4.1M16.6 17.1l1.3 4.1M5.7 21.2h13.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
// 상습정체 구간(chronic_congestion) 아이콘: 실제 도로교통법 주의표지판인
// "상습정체구간" 표지판(적색 역삼각형 테두리 + 백색 얇은 테 + 황색 바탕 + 정면에서 본
// 차량 3대 실루엣)을 그대로 SVG 벡터로 옮겨 사용한다. 기존에는 currentColor 선화로 그린
// 추상적인 "제동등 켜진 차량" 아이콘이었으나, 실제 표지판과 형태가 달라 사용자가 표지판을
// 보고도 앱 안에서 같은 의미인지 알아보기 어려웠다. 지도 위 마커와 길안내 좌측 하단 안전
// 배지(safety-alert, kind=stat) 양쪽에서 이 함수를 공통으로 사용한다.
// 상습정체 구간(chronic_congestion) 아이콘: 빨간 원 안에 흰색 테두리(outline)만으로 그린
// 단순 자동차 픽토그램. 이전에는 실제 도로표지판(적/황 삼각형 + 차량 3대 실루엣)을 그대로
// 옮겼으나, 요청에 따라 다른 안전 마커들과 통일감 있는 "원형 배지 + 흰색 라인 아이콘"
// 스타일로 다시 단순화했다. 지도 위 마커와 길안내 좌측 하단 안전 배지(safety-alert,
// kind=stat) 양쪽에서 이 함수를 공통으로 사용한다.
function safetyCctvSvg(){
  // 지도 단속카메라와 동일한 CCTV 형상을 사용하되 안전안내 레이어에서는 빨간색으로 통일한다.
  return `<svg viewBox="0 0 28 28" aria-hidden="true" class="safety-cctv-svg">
    <path d="M6.2 8.3h11.1c1.1 0 2 .9 2 2v4.6c0 1.1-.9 2-2 2H6.2c-1.1 0-2-.9-2-2v-4.6c0-1.1.9-2 2-2Z" fill="none" stroke="#cf2634" stroke-width="1.8"/>
    <circle cx="14.7" cy="12.6" r="2.6" fill="none" stroke="#cf2634" stroke-width="1.8"/>
    <path d="M19.4 11.1 24 8.9v7.4l-4.6-2.2M9.2 17.1l-1.4 4.1M16.6 17.1l1.3 4.1M5.7 21.2h13.1" fill="none" stroke="#cf2634" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function congestionMarkerSvg(){
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="#e2001a"/>
    <rect x="18" y="52" width="64" height="20" rx="9" fill="none" stroke="#fff" stroke-width="5"/>
    <rect x="33" y="36" width="34" height="20" rx="8" fill="none" stroke="#fff" stroke-width="5"/>
    <circle cx="33" cy="72" r="8" fill="none" stroke="#fff" stroke-width="5"/>
    <circle cx="67" cy="72" r="8" fill="none" stroke="#fff" stroke-width="5"/>
  </svg>`;
}
function homeCameraLabel(row){
  const raw=String(pickField(row,['단속구분','regltSe','규제구분'])||'').trim();
  const maxspeed=Number(pickField(row,['제한속도','lmttVe','speedLimit']))||0;
  const section=officialSectionPosition(row);
  let title=section==='start'?'구간단속 시작':section==='end'?'구간단속 종료':
    officialBusLaneCamera(row)?'버스전용차로 단속':
    officialCameraType(raw)==='signal_camera'?'신호위반 단속':
    officialCameraType(raw)==='signal_speed_camera'?'신호·과속 단속':
    officialCameraType(raw)==='speed_camera'?'과속 단속':'무인교통단속';
  return {title,maxspeed};
}
async function renderHomeCameraMarkers(){
  clearHomeCameraMarkers();
  return;
}
function scheduleHomeCameraRefresh(){
  clearTimeout(state.homeCameraLoadTimer);
  clearHomeCameraMarkers();
}

function clearLocalVoucherMarkers(){
  for(const m of state.localVoucherMarkers||[])try{m.remove()}catch{}
  state.localVoucherMarkers=[];
}
function voucherUseFlags(item){
  const flags=[];
  if(item.card===true)flags.push('카드');
  if(item.mobile===true)flags.push('모바일');
  if(item.paper===true)flags.push('지류');
  return flags;
}
function voucherShopSvg(){
  return `<svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M6 12.2 8.1 6h15.8l2.1 6.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M5.2 12.2h21.6v3.1c0 1.7-1.4 3.1-3.1 3.1-1.3 0-2.4-.8-2.9-1.9-.5 1.1-1.6 1.9-2.9 1.9s-2.4-.8-2.9-1.9c-.5 1.1-1.6 1.9-2.9 1.9s-2.4-.8-2.9-1.9c-.5 1.1-1.6 1.9-2.9 1.9-1.7 0-3.1-1.4-3.1-3.1v-3.1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M8.3 18.1V27h15.4v-8.9M12 27v-5.8h5.2V27M20 21.2h2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function onnuriShopSvg(){
  return `<svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M6 12.2 8.1 6h15.8l2.1 6.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M5.2 12.2h21.6v3.1c0 1.7-1.4 3.1-3.1 3.1-1.3 0-2.4-.8-2.9-1.9-.5 1.1-1.6 1.9-2.9 1.9s-2.4-.8-2.9-1.9c-.5 1.1-1.6 1.9-2.9 1.9s-2.4-.8-2.9-1.9c-.5 1.1-1.6 1.9-2.9 1.9-1.7 0-3.1-1.4-3.1-3.1v-3.1Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M8.3 18.1V27h15.4v-8.9M12 27v-5.8h5.2V27M20 21.2h2.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24.2" cy="7.8" r="3.2" fill="currentColor"/>
  </svg>`;
}
function onnuriUseFlags(item){
  const flags=[];
  if(item?.paper===true)flags.push('지류');
  if(item?.digital===true)flags.push('디지털');
  return flags;
}
function onnuriRegionLabel(item){
  return [item?.city,item?.district,item?.town].filter(Boolean).join(' ');
}
function clearOnnuriMarkers(){
  for(const m of state.onnuriMarkers||[])try{m.remove()}catch{}
  state.onnuriMarkers=[];
}
function openOnnuriStoreInfo(item){
  const approx=item?.approximate||item?.precision==='market-zone'||item?.precision==='admin-zone';
  const baseAddress=item.matchedAddress||item.address||'';
  showMapPlacePrompt({
    name:item.name||'온누리상품권 가맹점',
    address:approx
      ? `${item.market||baseAddress||'시장·상점가 구역'} · 개별 점포 위치를 찾지 못해 대표 구역으로 표시`
      : `${baseAddress||item.market||''}${item.market?` · ${item.market}`:''}`,
    lng:Number(item.lng),lat:Number(item.lat),
    onnuri:item
  });
}
function clusterMapItemsByPixel(items,cell=64){
  if(!state.map?.project||!state.map?.unproject)return items.map(it=>({lng:Number(it.lng),lat:Number(it.lat),count:1,items:[it]}));
  const buckets=new Map();
  for(const it of items){
    let p;try{p=state.map.project([Number(it.lng),Number(it.lat)])}catch{continue}
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const key=`${Math.floor(p.x/cell)}:${Math.floor(p.y/cell)}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push({item:it,x:p.x,y:p.y});
  }
  const out=[];
  for(const list of buckets.values()){
    let sx=0,sy=0;for(const x of list){sx+=x.x;sy+=x.y}
    let center=null;try{center=state.map.unproject([sx/list.length,sy/list.length])}catch{}
    const first=list[0].item;
    out.push({lng:center?.lng??Number(first.lng),lat:center?.lat??Number(first.lat),count:list.length,items:list.map(x=>x.item)});
  }
  return out;
}
/* ===== 7.6.12.0 온누리 마커: 겹침 해소(화면 좌표 기준 재배치) + 지점 목록 =====
   - 같은 건물/가까운 점포는 개수 배지 마커 또는 겹치지 않게 바깥으로 펼친 개별 마커(+원래 위치 표시선)로 보여준다.
   - 시장·상점가 대표 구역 마커도 서로 겹치면 위치를 옮기고, 자리가 없으면 라벨을 접어(compact) 모두 눌러볼 수 있게 한다.
   - 구역 마커를 누르면 그 구역의 가맹점 전체 목록을 보여준다. */
function onnuriFocusKeyOf(item){
  const approx=item?.approximate||item?.precision==='market-zone'||item?.precision==='admin-zone';
  return approx?`zone:${item?.market||item?.matchedAddress||'온누리상품권 구역'}`:`shop:${voucherBuildingKey(item)}`;
}
function addOnnuriMarker(el,lng,lat,anchor,priority,focusKey='',items=[]){
  const rec={el,lng,lat,anchor,priority:Number(priority)||0,marker:null,key:focusKey,items};
  el.style.zIndex='6';
  const f=state.onnuriFocus;
  if(focusKey&&f&&f.key===focusKey&&Date.now()-Number(f.at||0)<90000){el.classList.add('onnuri-focus');el.style.zIndex='9';rec.priority=1e9}
  try{rec.marker=new maplibregl.Marker({element:el,anchor}).setLngLat([lng,lat]).addTo(state.map);state.onnuriMarkers.push(rec.marker)}catch{return null}
  return rec;
}
function onnuriShopGroups(items){
  const grouped=new Map();
  for(const item of items||[]){
    if(!Number.isFinite(Number(item.lng))||!Number.isFinite(Number(item.lat)))continue;
    const key=voucherBuildingKey(item);
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(item);
  }
  return [...grouped.values()].map(list=>({lng:Number(list[0].lng),lat:Number(list[0].lat),items:list}));
}
/* 화면에서 서로 겹치는 점포 그룹을 묶는다. 6곳 이하 묶음은 개별 마커로(겹침은 배치 단계에서 해소), 초과하면 개수 배지로 표시. */
function clusterOnnuriGroupsByOverlap(groups,thresholdPx=34,maxIndividual=6){
  if(!state.map?.project)return{singles:groups,clusters:[]};
  const pts=[];
  for(const g of groups){try{const p=state.map.project([g.lng,g.lat]);if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))pts.push({g,x:p.x,y:p.y})}catch{}}
  const parent=pts.map((_,i)=>i),grid=new Map();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
  pts.forEach((p,i)=>{
    const cx=Math.floor(p.x/thresholdPx),cy=Math.floor(p.y/thresholdPx);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const l=grid.get(`${cx+dx}:${cy+dy}`);if(!l)continue;
      for(const j of l){const ddx=pts[j].x-p.x,ddy=pts[j].y-p.y;if(ddx*ddx+ddy*ddy<=thresholdPx*thresholdPx){const a=find(i),b=find(j);if(a!==b)parent[a]=b}}
    }
    const k=`${cx}:${cy}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);
  });
  const comps=new Map();
  pts.forEach((p,i)=>{const r=find(i);if(!comps.has(r))comps.set(r,[]);comps.get(r).push(p)});
  const singles=[],clusters=[];
  for(const list of comps.values()){
    if(list.length<=maxIndividual){for(const p of list)singles.push(p.g);continue}
    let sx=0,sy=0,count=0,items=[];
    for(const p of list){sx+=p.x;sy+=p.y;count+=p.g.items.length;items=items.concat(p.g.items)}
    let c=null;try{c=state.map.unproject([sx/list.length,sy/list.length])}catch{}
    clusters.push({lng:c?.lng??list[0].g.lng,lat:c?.lat??list[0].g.lat,count,items});
  }
  return{singles,clusters};
}
function renderOnnuriShopMarkers(items){
  const recs=[];
  for(const g of (Array.isArray(items)&&items[0]&&items[0].items?items:onnuriShopGroups(items))){
    const list=g.items,item=list[0];
    const el=document.createElement('button');
    el.type='button';el.className='onnuri-shop-marker';
    el.title=list.length>1?`온누리상품권 가맹점 ${list.length}곳`:item.name||'온누리상품권 가맹점';
    el.innerHTML=`${onnuriShopSvg()}<span class="onnuri-shop-badge">${list.length>1?(list.length>99?'99+':list.length):'온'}</span>`;
    el.onclick=e=>{e.stopPropagation();list.length>1?openOnnuriBuildingList(list):openOnnuriStoreInfo(item)};
    const r=addOnnuriMarker(el,Number(item.lng),Number(item.lat),'bottom',list.length,`shop:${voucherBuildingKey(item)}`,list);
    if(r)recs.push(r);
  }
  return recs;
}
function renderOnnuriClusterMarkers(clusters){
  const recs=[];
  for(const c of clusters||[]){
    const el=document.createElement('button');
    el.type='button';
    const size=c.count>=25?'large':c.count>=8?'medium':'small';
    el.className=`onnuri-cluster-marker ${size}`;
    el.title=`온누리상품권 가맹점 ${c.count}곳`;
    el.innerHTML=`<strong>${c.count>99?'99+':c.count}</strong>`;
    el.onclick=e=>{
      e.stopPropagation();
      const lngs=c.items.map(x=>Number(x.lng)).filter(Number.isFinite),lats=c.items.map(x=>Number(x.lat)).filter(Number.isFinite);
      if(!lngs.length||!lats.length)return;
      const spanM=voucherGeoMeters(Math.min(...lats),Math.min(...lngs),Math.max(...lats),Math.max(...lngs));
      let zoom=0;try{zoom=Number(state.map.getZoom())||0}catch{}
      // 더 확대해도 분리되지 않는 경우(같은 지점이거나 이미 최대 확대)에는 가맹점 전체 목록을 보여준다.
      if(spanM<25||zoom>=17.2){openOnnuriBuildingList(sortOnnuriByDistance(c.items),{title:`온누리 가맹점 ${c.items.length}곳`,kicker:'이 주변 온누리상품권 가맹점'});return}
      try{
        if(lngs.length===1)state.map.easeTo({center:[lngs[0],lats[0]],zoom:Math.max(zoom,17.3),duration:420});
        else state.map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:70,maxZoom:17.6,duration:420});
      }catch{}
    };
    const r=addOnnuriMarker(el,c.lng,c.lat,'center',c.count,'',c.items);
    if(r)recs.push(r);
  }
  return recs;
}
function sortOnnuriByDistance(items){
  const list=(items||[]).filter(Boolean);
  if(!pointValid(state.user))return list;
  return list.map(x=>({x,d:voucherGeoMeters(state.user.lat,state.user.lng,Number(x.lat),Number(x.lng))})).sort((a,b)=>(Number.isFinite(a.d)?a.d:1e12)-(Number.isFinite(b.d)?b.d:1e12)).map(o=>o.x);
}
/* ---- 화면 좌표 기준 마커 겹침 해소 ---- */
function resolveMarkerLayout(items,view,{pad=4,maxRadius=150,step=22}={}){
  const out=new Map(),placed=[];
  const hit=(a,b)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
  const inside=(r)=>{const cx=r.x+r.w/2,cy=r.y+r.h/2;return cx>=0&&cy>=0&&cx<=view.w&&cy<=view.h};
  const overlapArea=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const cands=[[0,0]];
  for(let rad=step;rad<=maxRadius;rad+=step){
    const n=Math.max(8,Math.round(2*Math.PI*rad/(step*1.2)));
    for(let k=0;k<n;k++){const ang=-Math.PI/2+k/n*2*Math.PI;cands.push([Math.round(Math.cos(ang)*rad),Math.round(Math.sin(ang)*rad)])}
  }
  const order=[...items].sort((a,b)=>(b.priority||0)-(a.priority||0)||a.id-b.id);
  for(const it of order){
    const full={x:it.x,y:it.y,w:it.w,h:it.h};
    const compact=it.canCompact&&it.cw>0&&it.ch>0?{x:it.x+it.w/2-it.cw/2,y:it.y+it.h-it.ch,w:it.cw,h:it.ch}:null;
    let done=false;
    for(const [mode,base] of [['full',full],...(compact?[['compact',compact]]:[])]){
      for(const [dx,dy] of cands){
        const r={x:base.x+dx,y:base.y+dy,w:base.w,h:base.h};
        if(!inside(r)||placed.some(p=>hit(r,p)))continue;
        placed.push(r);out.set(it.id,{dx,dy,compact:mode==='compact',rect:r,failed:false,ax:it.x+it.w/2,ay:it.anchorCenter?it.y+it.h/2:it.y+it.h});done=true;break;
      }
      if(done)break;
    }
    if(!done){ // 빈자리가 없으면 겹침이 가장 적은 위치
      let best=null;
      for(const [dx,dy] of cands){const r={x:full.x+dx,y:full.y+dy,w:full.w,h:full.h};if(!inside(r))continue;const a=placed.reduce((sum,p)=>sum+overlapArea(r,p),0);if(!best||a<best.a)best={a,dx,dy,r}}
      const b=best||{dx:0,dy:0,r:full};
      placed.push(b.r);out.set(it.id,{dx:b.dx,dy:b.dy,compact:false,rect:b.r,failed:true,ax:it.x+it.w/2,ay:it.anchorCenter?it.y+it.h/2:it.y+it.h});
    }
  }
  return out;
}
function addOnnuriLeader(lng,lat,len,angDeg){
  try{
    const root=document.createElement('div');root.className='onnuri-leader';root.style.zIndex='3';
    root.innerHTML=`<i class="onnuri-leader-line" style="width:${Math.round(len)}px;transform:rotate(${angDeg.toFixed(1)}deg)"></i><i class="onnuri-leader-dot"></i>`;
    state.onnuriMarkers.push(new maplibregl.Marker({element:root,anchor:'center'}).setLngLat([lng,lat]).addTo(state.map));
  }catch{}
}
function declutterOnnuriMarkers(recs,depth=0){
  if(!state.map||!recs?.length)return;
  let cont;try{const c=state.map.getContainer();cont={width:c.clientWidth||c.getBoundingClientRect().width,height:c.clientHeight||c.getBoundingClientRect().height}}catch{return}
  if(!(cont.width>0&&cont.height>0))return;
  for(const r of recs){try{r.marker.setOffset([0,0])}catch{}r.el.classList.remove('compact')}
  const items=[];
  recs.forEach((r,i)=>{
    // 위치는 지도 투영값(+앵커 규칙)으로 계산하고 요소 크기만 DOM 에서 읽는다(마커 transform 반영 시점에 의존하지 않음).
    const w=r.el.offsetWidth,h=r.el.offsetHeight;if(!(w>0&&h>0))return;
    let p;try{p=state.map.project([r.lng,r.lat])}catch{return}
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    const pin=r.el.querySelector?.('.onnuri-zone-pin');
    items.push({id:i,x:p.x-w/2,y:r.anchor==='center'?p.y-h/2:p.y-h,w,h,priority:r.priority,anchorCenter:r.anchor==='center',canCompact:Boolean(pin),cw:pin?pin.offsetWidth:0,ch:pin?pin.offsetHeight:0});
  });
  const layout=resolveMarkerLayout(items,{w:cont.width,h:cont.height});
  // 접어서도 자리를 찾지 못한 마커(아주 밀집)는 하나의 개수 배지로 묶는다: 누르면 확대하거나 전체 목록을 보여준다.
  const failed=items.filter(it=>layout.get(it.id)?.failed).map(it=>recs[it.id]);
  if(failed.length>=2&&depth<2){
    let sx=0,sy=0,all=[];
    for(const r of failed){
      sx+=r.lng;sy+=r.lat;all=all.concat(r.items||[]);
      try{r.marker.remove()}catch{}
      state.onnuriMarkers=(state.onnuriMarkers||[]).filter(m=>m!==r.marker);
    }
    const bubble=renderOnnuriClusterMarkers([{lng:sx/failed.length,lat:sy/failed.length,count:Math.max(all.length,failed.length),items:all}]);
    return declutterOnnuriMarkers([...recs.filter(r=>!failed.includes(r)),...bubble],depth+1);
  }
  for(const it of items){
    const L=layout.get(it.id),r=recs[it.id];if(!L||!r)continue;
    if(L.compact)r.el.classList.add('compact');
    if(L.dx||L.dy){
      try{r.marker.setOffset([L.dx,L.dy])}catch{}
      // 원래 위치에서 옮겨졌다면, 진짜 위치와 마커를 잇는 가는 선과 점을 함께 표시
      const cx=L.rect.x+L.rect.w/2,cy=L.rect.y+L.rect.h/2,dx=cx-L.ax,dy=cy-L.ay,len=Math.hypot(dx,dy);
      if(len>12)addOnnuriLeader(r.lng,r.lat,len,Math.atan2(dy,dx)*180/Math.PI);
    }
  }
}
function whereDistanceLabel(m){
  if(!Number.isFinite(m))return '';
  return m<1000?`${Math.max(1,Math.round(m))}m`:`${(m/1000).toFixed(m<10000?1:0)}km`;
}
function merchantDistanceSorted(items){
  if(!pointValid(state.user))return [];
  return (items||[])
    .filter(x=>Number.isFinite(Number(x.lng))&&Number.isFinite(Number(x.lat)))
    .map(x=>({...x,_distance:voucherGeoMeters(state.user.lat,state.user.lng,Number(x.lat),Number(x.lng))}))
    .sort((a,b)=>a._distance-b._distance);
}
let wherePageLimit=10;
function currentWhereItems(){
  const source=state.whereToTab==='onnuri'?state.onnuriData:state.localVoucherData;
  return merchantDistanceSorted(source?.items||[]).slice(0,100);
}
/* v7.6.27.27 — reusable honest category art and public search links.
   Category art is an illustration, NEVER presented as a photo of the actual merchant.
   Search links expose no private location and never assert review/social counts. */
function discoverMerchantCategory(item){
  const t=[item.name,item.category,item.categoryName,item.industry,item.businessType,item.type,item.upjong,item.market].filter(Boolean).join(' ').toLowerCase();
  if(/학원|교습소|입시|어학원|보습|음악학원|미술학원|태권도장|피아노학원/.test(t))return 'academy';
  if(/약국|약사|pharmacy/.test(t))return 'pharmacy';
  if(/병원|의원|한의원|치과|소아과|내과|정형외과|이비인후과|클리닉|hospital/.test(t))return 'hospital';
  if(/세탁|크리닝|클리닝|빨래방|laundry/.test(t))return 'laundry';
  if(/카페|커피|다방|에스프레소|coffee|cafe|티룸/.test(t))return 'cafe';
  if(/빵|제과|베이커리|디저트|케이크|도넛|떡집|마카롱|아이스크림/.test(t))return 'bakery';
  if(/식당|음식|국밥|한식|중식|일식|분식|김밥|고기|갈비|곱창|치킨|피자|버거|국수|횟집|레스토랑|쌀국수|초밥|탕|찌개|칼국수|족발|보쌈|백반/.test(t))return 'meal';
  if(/정육|축산물|식육|고깃간|푸줏간|미트샵|meat shop|butcher/.test(t))return 'butcher';
  if(/꽃집|꽃가게|화원|플라워|꽃배달|생화|flower|플로리스트/.test(t))return 'flower';
  if(/서점|책방|도서판매|북스토어|bookstore|도서점/.test(t))return 'bookstore';
  if(/문구|문방구|학용품|사무용품|팬시|stationery/.test(t))return 'stationery';
  if(/마트|슈퍼|시장|상회|청과|식료품|과일|반찬|식자재|잡화|할인점|편의점|supermarket|grocery/.test(t))return 'market';
  return 'local';
}
function discoverMerchantImage(item, override){
  const category=override||discoverMerchantCategory(item);
  return '/assets/merchant-'+( ['cafe','bakery','meal','flower','books','market','academy','pharmacy','hospital','laundry','butcher','bookstore','stationery','beauty','optician','fuel_repair'].includes(category)?category:'local')+'.svg';
}
function discoverMerchantSearchUrl(item,service){
  const name=String(item?.name||item?.market||'').trim().slice(0,64);
  const addr=String(item?.address||item?.matchedAddress||'').trim();
  const locality=addr.split(/\s+/).slice(0,2).join(' ');
  const q=[name,locality].filter(Boolean).join(' ');
  // Instagram's website keyword search can render an empty page in mobile browsers.
  // Search indexed public Instagram pages instead. This is a discovery link,
  // not an Instagram API, popularity score, or verification of a merchant's account.
  if(service==='instagram')return 'https://www.google.com/search?q='+encodeURIComponent('site:instagram.com '+q);
  return 'https://search.naver.com/search.naver?where=view&query='+encodeURIComponent(q+' 방문 후기');
}
function discoverMerchantLinks(item,cssClass='discover-links'){
  const link=(type,display,label)=>`<a href="${escapeHtml(discoverMerchantSearchUrl(item,type))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.name||'가맹점')} ${label} (새 창)">${display}</a>`;
  const instagram='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>인스타그램</span>';
  const review='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.9 7.9 0 0 1-8 8 8.8 8.8 0 0 1-3-.5L4 20l1-4.4A8 8 0 1 1 20 11.5Z"/><path d="M8.5 11.5h7M8.5 14.5h4"/></svg><span>후기 검색</span>';
  return `<span class="${cssClass}">${link('instagram',instagram,'인스타그램 게시물 검색')}${link('review',review,'방문후기 검색')}</span>`;
}
function renderWhereToList(){
  const box=$('whereToList');if(!box)return;
  document.querySelectorAll('[data-where-tab]').forEach(b=>b.classList.toggle('active',b.dataset.whereTab===state.whereToTab));
  const allItems=currentWhereItems();
  const items=allItems.slice(0,wherePageLimit);
  if(!items.length){
    box.innerHTML=`<div class="where-to-empty">${state.whereToTab==='onnuri'?'온누리상품권':'지역사랑상품권'} 가맹점을 불러오는 중이거나 주변 검색결과가 없습니다.</div>`;
    return;
  }

  box.innerHTML=items.map((x,i)=>{
    if(state.whereToTab==='onnuri'){
      const approx=x.approximate||x.precision==='market-zone'||x.precision==='admin-zone';
      const loc=approx
        ? `${x.market||x.matchedAddress||'시장·상점가 대표 위치'}`
        : `${x.matchedAddress||x.address||x.market||'위치 확인됨'}`;
      const region=onnuriRegionLabel(x);
      const use=onnuriUseFlags(x).join(' · ');
      const tag=approx
        ? (Number(x.fallbackCount)>1?`대표 구역 위치 · 원천 ${Number(x.fallbackCount).toLocaleString()}곳`:'시장·상점가 대표 위치')
        : (x.source==='semas-onnuri-2026-csv8'?'주소보강 8차 · 가맹점 위치':(x.precision==='exact-address-geocode'?'상세주소 위치 확인':'가맹점 위치 확인'));
      return `<div role="button" tabindex="0" class="where-to-item where-to-item-onnuri ${approx?'where-to-zone-item':''}" data-where-index="${i}">
        <span class="where-to-visual"><img src="${discoverMerchantImage(x)}" alt="${escapeHtml(discoverMerchantCategory(x))} 업종 일러스트" loading="lazy"><span class="where-to-rank">${i+1}</span></span>
        <span class="where-to-info">
          <b>${escapeHtml(x.name||'온누리상품권 가맹점')}</b>
          <small>${escapeHtml(loc)}</small>
          <em>온누리상품권 · ${escapeHtml(x.market||'상점가 미상')} · ${tag}</em>
          <span class="where-to-meta-pills">${region?`<i>${escapeHtml(region)}</i>`:''}${use?`<i>${escapeHtml(use)}</i>`:'<i>사용수단 확인</i>'}<i class="where-to-mapbtn" role="button" tabindex="0" data-where-map="${i}">지도에서 보기</i></span>${discoverMerchantLinks(x)}
        </span>
        <strong>${whereDistanceLabel(x._distance)}</strong>
      </div>`;
    }
    const use=voucherUseFlags(x).join(' · ');
    return `<div role="button" tabindex="0" class="where-to-item" data-where-index="${i}">
      <span class="where-to-visual"><img src="${discoverMerchantImage(x)}" alt="${escapeHtml(discoverMerchantCategory(x))} 업종 일러스트" loading="lazy"><span class="where-to-rank">${i+1}</span></span>
      <span class="where-to-info">
        <b>${escapeHtml(x.name||'가맹점')}</b>
        <small>${escapeHtml(x.address||'주소 정보 없음')}</small>
        <em>${escapeHtml(use||'지역사랑상품권')}</em>
        <span class="where-to-meta-pills"><i class="where-to-mapbtn" role="button" tabindex="0" data-where-map="${i}">지도에서 보기</i></span>${discoverMerchantLinks(x)}
      </span>
      <strong>${whereDistanceLabel(x._distance)}</strong>
    </div>`;
  }).join('');
  if(allItems.length>items.length){const more=document.createElement('button');more.type='button';more.className='merchant-more-button';more.textContent=`더보기 · ${items.length}/${allItems.length}곳`;more.onclick=()=>{wherePageLimit+=10;renderWhereToList()};box.append(more)}

  // SNS/review links do not trigger the enclosing destination choice.
  box.querySelectorAll('.discover-links a').forEach(a=>a.onclick=e=>e.stopPropagation());
  // 목록의 가맹점을 지도에서 바로 확인: 해당 위치로 이동하고 마커를 강조한다.
  box.querySelectorAll('[data-where-map]').forEach(btn=>{
    const go=e=>{e.preventDefault();e.stopPropagation();const p=currentWhereItems()[Number(btn.dataset.whereMap)];if(!p)return;state.whereToTab==='onnuri'?focusOnnuriItem(p):focusVoucherItem(p)};
    btn.onclick=go;btn.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')go(e)};
  });
  box.querySelectorAll('[data-where-index]').forEach(btn=>{btn.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===btn){e.preventDefault();btn.click()}};btn.onclick=async(e)=>{if(e.target.closest('a,[data-where-map]'))return;
    const p=currentWhereItems()[Number(btn.dataset.whereIndex)];
    if(!p)return;
    closeWhereTo();
    if(state.whereToTab==='onnuri'){
      const approx=p.approximate||p.precision==='market-zone'||p.precision==='admin-zone';
      await chooseDestination({
        name:p.name||'온누리상품권 가맹점',
        address:approx
          ? `${p.market||p.matchedAddress||'시장·상점가 대표 위치'} · 개별 점포 위치 미확인`
          : (p.matchedAddress||p.address||p.market||''),
        lng:Number(p.lng),lat:Number(p.lat),
        onnuri:p
      });
      if(approx)toast('개별 가맹점 좌표를 찾지 못해 시장·상점가 대표 위치로 안내합니다.',3000);
    }else{
      await chooseDestination({name:p.name||'가맹점',address:p.address||'',lng:Number(p.lng),lat:Number(p.lat)});
    }
  };});
}
/* v7.6.27.41: '지도에서 보기' means preview ONLY.  Never select a
   destination, calculate a route or start guidance without an explicit tap. */
function previewWhereMerchantOnMap(item,type){
  const lng=Number(item?.lng??item?.lon??item?.longitude??item?.x);
  const lat=Number(item?.lat??item?.latitude??item?.y);
  if(!pointValid({lng,lat})||!state.map){toast('가맹점의 지도 위치를 확인할 수 없습니다.',2200);return}
  cancelAutoStart(); // previous search countdown must never start this preview
  state.whereMapPreviewActive=true;
  state.whereMapPreviewReturn=true;
  closeWhereTo();
  setView('home');
  setHomeSheetCollapsed(true);
  closeMapPlacePrompt();
  const approx=type==='onnuri'&&(item.approximate||item.precision==='market-zone'||item.precision==='admin-zone');
  const place={
    name:item.name||(type==='onnuri'?'온누리상품권 가맹점':'지역사랑상품권 가맹점'),
    address:approx?(item.market||item.matchedAddress||'시장·상점가 대표 위치'):(item.matchedAddress||item.address||item.market||''),
    lng,lat,
    ...(type==='onnuri'?{onnuri:item}:{voucher:item})
  };
  try{state.whereMapPreviewMarker?.remove()}catch{}
  try{
    const el=document.createElement('div');el.className='where-map-preview-pin';
    el.setAttribute('aria-label','선택한 가맹점 위치');
    el.innerHTML='<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M20 2C10 2 3 10 3 20c0 13 17 29 17 29s17-16 17-29C37 10 30 2 20 2Z" fill="#13865c" stroke="white" stroke-width="3"/><circle cx="20" cy="20" r="7" fill="white"/></svg>';
    state.whereMapPreviewMarker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([lng,lat]).addTo(state.map);
  }catch(e){console.warn('[where-to] preview marker',e)}
  // Show the decision card immediately, not after another asynchronous marker query.
  showMapPlacePrompt(place);
  if($('mapPlacePromptCancel'))$('mapPlacePromptCancel').textContent='목록으로';
  if($('mapPlacePromptGo'))$('mapPlacePromptGo').textContent='길안내 선택';
  try{state.map.easeTo({center:[lng,lat],zoom:Math.max(Number(state.map.getZoom())||0,16.7),pitch:0,bearing:0,duration:450})}catch{}
}
function focusOnnuriItem(item){previewWhereMerchantOnMap(item,'onnuri')}
function focusVoucherItem(item){previewWhereMerchantOnMap(item,'local')}
function clearWhereMapPreview(){
  try{state.whereMapPreviewMarker?.remove()}catch{}
  state.whereMapPreviewMarker=null;
  state.whereMapPreviewActive=false;
}
function cancelMapPlacePreview(){
  const returnToList=Boolean(state.whereMapPreviewReturn);
  state.whereMapPreviewReturn=false;
  closeMapPlacePrompt();clearWhereMapPreview();
  if(returnToList)openWhereTo();
}
async function refreshWhereTo(){
  const label=$('whereToLocationLabel');
  // Paint the last known merchant lists immediately; do not wait for GPS or the slower Onnuri API.
  if(!state.localVoucherData){const cached=readVoucherStaleCache();if(cached?.items?.length)state.localVoucherData=cached}
  if(!state.onnuriData){const cached=readOnnuriStaleCache();if(cached?.items?.length)state.onnuriData=cached}
  renderWhereToList();
  if(label)label.textContent=pointValid(state.user)?'현재 위치 기준 · 가까운 순':'위치 확인 중';
  try{
    if(!pointValid(state.user))await locate(false).catch(()=>null);
    if(!pointValid(state.user)){if(label)label.textContent='위치 확인이 필요합니다';return}
    if(label)label.textContent='현재 위치 기준 · 가까운 순';
    renderWhereToList();
    if(state.map){try{state.map.jumpTo({center:[Number(state.user.lng),Number(state.user.lat)],zoom:15.7})}catch{}}
    // A slow endpoint cannot delay painting the other merchant list.
    void Promise.resolve().then(()=>loadLocalVoucherMap({force:false})).then(()=>renderWhereToList()).catch(e=>console.warn('[where-to] local',e));
    void Promise.resolve().then(()=>loadOnnuriMap({force:false})).then(()=>renderWhereToList()).catch(e=>console.warn('[where-to] onnuri',e));
  }catch(e){console.warn('[where-to] refresh',e);renderWhereToList()}
}

function closeBottomPanels(except=''){
  if(except!=='where')$('whereToModal')?.classList.add('hidden');
  if(except!=='saved')$('savedPlacesModal')?.classList.add('hidden');
  if(except!=='my')$('myModal')?.classList.add('hidden');
}

function openWhereTo(){
  closeBottomPanels('where');
  state.whereToTab=state.whereToTab||'local';
  $('whereToModal')?.classList.remove('hidden');
  renderWhereToList();
  refreshWhereTo();
}
function closeWhereTo(){$('whereToModal')?.classList.add('hidden')}


function openOnnuriZoneInfo(zone){
  showMapPlacePrompt({
    name:zone.name||zone.market||'온누리상품권 시장·상점가',
    address:`${zone.regionLabel||'소속 시장·상점가 구역'} · 가맹점 ${Number(zone.count||zone.merchantCount||0)}곳 · 정확한 개별 점포 위치는 제공되지 않습니다.`,
    lng:Number(zone.lng),lat:Number(zone.lat),
    onnuriZone:zone
  });
}
function openOnnuriZoneList(zone){
  const items=sortOnnuriByDistance(zone?.items||[]).slice(0,300);
  if(!items.length){openOnnuriZoneInfo(zone);return}
  openOnnuriBuildingList(items,{title:`${zone.name||zone.market||'시장·상점가'} · 가맹점 ${Number(zone.count||items.length)}곳`,kicker:'시장·상점가 대표 위치 기준 · 개별 점포 위치 미확인'});
}
function renderOnnuriZoneMarkers(zones){
  const recs=[];
  for(const zone of zones||[]){
    const lng=Number(zone.lng),lat=Number(zone.lat);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    const el=document.createElement('button');
    el.type='button';
    el.className='onnuri-zone-marker';
    el.title=`${zone.name||zone.market||'온누리상품권 구역'} · ${Number(zone.count||zone.merchantCount||0)}곳`;
    el.innerHTML=`<span class="onnuri-zone-pin">${onnuriShopSvg()}</span><span class="onnuri-zone-label"><b>${escapeHtml(zone.name||zone.market||'시장·상점가')}</b><small>${Number(zone.count||zone.merchantCount||0)}곳</small></span>`;
    el.onclick=e=>{e.stopPropagation();openOnnuriZoneList(zone)};
    const r=addOnnuriMarker(el,lng,lat,'bottom',Math.max(1,Number(zone.count)||1),`zone:${zone.market||zone.name||''}`,zone.items||[]);
    if(r)recs.push(r);
  }
  return recs;
}

function renderOnnuriMarkers(data){
  clearOnnuriMarkers();
  if(!state.map||!maplibregl?.Marker||state.tripStartedAt||$('homeView')?.classList.contains('hidden'))return;
  let bounds=null;
  try{bounds=state.map.getBounds?.()||null}catch{}
  const items=(data?.items||[]).filter(x=>{
    const lng=Number(x.lng),lat=Number(x.lat);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))return false;
    // 이전 지역 캐시가 남아 있어도 현재 홈 지도 화면 밖의 온누리 마커는 절대 표시하지 않는다.
    if(bounds?.contains){try{return bounds.contains([lng,lat])}catch{return true}}
    return true;
  }).slice(0,2200);
  if(!items.length)return;

  const precise=items.filter(x=>!x.approximate && x.precision!=='market-zone' && x.precision!=='admin-zone');
  const fallback=items.filter(x=>x.approximate || x.precision==='market-zone' || x.precision==='admin-zone');
  const recs=[];

  // 정확히 찾은 점포는 개별 가맹점 마커로 표시. 화면에서 겹치는 점포는 묶거나 펼쳐서 모두 볼 수 있게 한다.
  if(precise.length){
    if(mapVisibleWidthMeters()<1600){
      const {singles,clusters}=clusterOnnuriGroupsByOverlap(onnuriShopGroups(precise));
      recs.push(...renderOnnuriShopMarkers(singles),...renderOnnuriClusterMarkers(clusters));
    }else recs.push(...renderOnnuriClusterMarkers(clusterMapItemsByPixel(precise,64)));
  }

  // 좌표를 못 찾은 점포는 시장/상점가 대표 구역 단위로 표시(누르면 그 구역 가맹점 전체 목록)
  if(fallback.length){
    const groups=new Map();
    for(const x of fallback){
      const key=x.market||x.matchedAddress||'온누리상품권 구역';
      if(!groups.has(key))groups.set(key,{name:key,market:key,count:0,lng:Number(x.lng),lat:Number(x.lat),regionLabel:x.matchedAddress||'',locationPrecision:x.precision,items:[]});
      const g=groups.get(key);g.count++;g.items.push(x);
    }
    recs.push(...renderOnnuriZoneMarkers([...groups.values()]));
  }
  try{declutterOnnuriMarkers(recs)}catch(e){console.warn('onnuri declutter failed',e)}
}
function readOnnuriStaleCache(){
  try{
    const raw=localStorage.getItem('jofams_onnuri_map_cache_v5');
    if(!raw)return null;
    const d=JSON.parse(raw);
    if(!d?.payload||Date.now()-Number(d.savedAt||0)>2*60*60*1000)return null;
    return d.payload;
  }catch{return null}
}
function writeOnnuriStaleCache(payload){
  try{
    if(payload?.items?.length)localStorage.setItem('jofams_onnuri_map_cache_v5',JSON.stringify({savedAt:Date.now(),payload}));
  }catch{}
}

async function loadOnnuriMap({force=false}={}){
  if(!state.map||state.tripStartedAt||$('homeView')?.classList.contains('hidden'))return;
  const zoom=Number(state.map.getZoom?.()||0);
  if(zoom<7.5){clearOnnuriMarkers();return}
  const center=state.map.getCenter?.();if(!center)return;

  // 메모리 데이터가 있으면 네트워크 응답을 기다리지 않고 즉시 표시.
  if(state.onnuriData?.items?.length)renderOnnuriMarkers(state.onnuriData);
  else{
    const cached=readOnnuriStaleCache();
    if(cached?.items?.length){
      state.onnuriData=cached;
      renderOnnuriMarkers(cached);
    }
  }

  const moved=(()=>{
    if(!state.onnuriLoadedCenter)return true;
    const d=voucherGeoMeters(state.onnuriLoadedCenter.lat,state.onnuriLoadedCenter.lng,center.lat,center.lng);
    const r=voucherVisibleRadiusMeters();
    return d>=Math.max(260,Number.isFinite(r)?r*.16:700);
  })();
  if(!force&&!moved&&state.onnuriData?.items?.length&&Date.now()-Number(state.onnuriLoadedAt||0)<18000)return;

  try{
    const b=state.map.getBounds?.(),u=new URL('/api/onnuri-voucher',location.origin);
    u.searchParams.set('lng',center.lng);u.searchParams.set('lat',center.lat);
    if(b){
      u.searchParams.set('west',b.getWest());u.searchParams.set('south',b.getSouth());
      u.searchParams.set('east',b.getEast());u.searchParams.set('north',b.getNorth());
    }
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
    let r;
    try{r=await fetch(u,{headers:{accept:'application/json'},signal:ctrl.signal,cache:'no-store'})}
    finally{clearTimeout(timer)}

    if(!r.ok){
      const err=await r.json().catch(()=>({}));
      console.warn('onnuri API unavailable',r.status,err?.code||'',err?.detail||err?.error||'');
      // 기존/캐시 마커는 지우지 않는다.
      if(state.onnuriData?.items?.length)renderOnnuriMarkers(state.onnuriData);
      return;
    }

    const d=await r.json();
    if(d?.items?.length){
      state.onnuriData=d;
      if(!$('whereToModal')?.classList.contains('hidden'))renderWhereToList();
      state.onnuriLoadedAt=Date.now();
      state.onnuriLoadedCenter={lat:center.lat,lng:center.lng};
      writeOnnuriStaleCache(d);
      renderOnnuriMarkers(d);
      if(Number(d?.d1ViewportRows)>0){
        console.info('[JOFAMS onnuri D1]',{viewport:Number(d.d1ViewportRows)||0,rendered:Number(d.d1RenderedRows)||0,region:d.region});
      }
      state.onnuriZeroRetryAt=0;
      return;
    }

    console.warn('onnuri mapped rows 0',d?.region,d?.fetchMeta,d?.fetchedRows,d?.localRows,d?.mappedRows);

    // 0건 응답이 와도 기존 정상 데이터/캐시를 지우지 않고 한 번 강제 재조회.
    const cached=state.onnuriData?.items?.length?state.onnuriData:readOnnuriStaleCache();
    if(cached?.items?.length){
      state.onnuriData=cached;
      renderOnnuriMarkers(cached);
    }
    if(!force&&(!state.onnuriZeroRetryAt||Date.now()-Number(state.onnuriZeroRetryAt||0)>60000)){
      state.onnuriZeroRetryAt=Date.now();
      setTimeout(()=>loadOnnuriMap({force:true}),900);
    }
  }catch(e){
    console.warn('onnuri map load failed',e);
    // 네트워크/timeout에서도 화면의 기존 온누리 마커를 유지.
    const cached=state.onnuriData?.items?.length?state.onnuriData:readOnnuriStaleCache();
    if(cached?.items?.length){
      state.onnuriData=cached;
      renderOnnuriMarkers(cached);
    }
  }
}
function scheduleOnnuriRefresh(force=false){
  clearTimeout(state.onnuriLoadTimer);
  state.onnuriLoadTimer=setTimeout(()=>loadOnnuriMap({force:Boolean(force)}),force?120:180);
}
function voucherGeoMeters(aLat,aLng,bLat,bLng){
  const r=6371000,toRad=Math.PI/180,dLat=(bLat-aLat)*toRad,dLng=(bLng-aLng)*toRad;
  const aa=Math.sin(dLat/2)**2+Math.cos(aLat*toRad)*Math.cos(bLat*toRad)*Math.sin(dLng/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(aa)));
}
function voucherVisibleRadiusMeters(){
  try{
    const b=state.map?.getBounds?.(),ctr=state.map?.getCenter?.();
    if(!b||!ctr)return Infinity;
    return voucherGeoMeters(ctr.lat,ctr.lng,ctr.lat,b.getEast());
  }catch{return Infinity}
}

function mapVisibleWidthMeters(){
  const r=voucherVisibleRadiusMeters();
  return Number.isFinite(r)?r*2:Infinity;
}
function voucherBuildingKey(item){
  return `${Number(item.lat).toFixed(6)}:${Number(item.lng).toFixed(6)}`;
}
function closeVoucherBuildingModal(){$('voucherBuildingModal')?.classList.add('hidden')}
function openVoucherStoreInfo(item){
  closeVoucherBuildingModal();
  showMapPlacePrompt({name:item.name||'지역사랑상품권 가맹점',address:item.address||'',lng:Number(item.lng),lat:Number(item.lat),voucher:item});
}
function openVoucherBuildingList(items){
  const list=(items||[]).filter(Boolean);
  if(!list.length)return;
  if(list.length===1){openVoucherStoreInfo(list[0]);return}
  $('voucherBuildingModal')?.classList.remove('onnuri-mode');
  if($('voucherBuildingKicker'))$('voucherBuildingKicker').textContent='같은 건물 지역사랑상품권 가맹점';
  if($('voucherBuildingTitle'))$('voucherBuildingTitle').textContent=`가맹점 ${list.length}곳`;
  const box=$('voucherBuildingList');
  if(box){
    box.innerHTML=list.map((item,i)=>{
      const uses=voucherUseFlags(item);
      return `<button type="button" data-voucher-building-item="${i}">
        <span class="voucher-list-shop">${voucherShopSvg()}</span>
        <span class="voucher-list-copy"><b>${escapeHtml(item.name||'가맹점')}</b><small>${escapeHtml(item.address||'주소 정보 없음')}</small><em>${escapeHtml(uses.join(' · ')||'지역사랑상품권')}</em></span>
        <span class="voucher-list-arrow">›</span>
      </button>`;
    }).join('');
    box.querySelectorAll('[data-voucher-building-item]').forEach(btn=>{
      btn.onclick=e=>{e.stopPropagation();openVoucherStoreInfo(list[Number(btn.dataset.voucherBuildingItem)])};
    });
  }
  $('voucherBuildingModal')?.classList.remove('hidden');
}
function openOnnuriBuildingList(items,opts={}){
  const list=(items||[]).filter(Boolean);
  if(!list.length)return;
  if(list.length===1){openOnnuriStoreInfo(list[0]);return}
  $('voucherBuildingModal')?.classList.add('onnuri-mode');
  if($('voucherBuildingKicker'))$('voucherBuildingKicker').textContent=opts.kicker||'같은 위치 온누리상품권 가맹점';
  if($('voucherBuildingTitle'))$('voucherBuildingTitle').textContent=opts.title||`온누리 가맹점 ${list.length}곳`;
  const box=$('voucherBuildingList');
  if(box){
    box.innerHTML=list.map((item,i)=>{
      const uses=onnuriUseFlags(item);
      const address=item.matchedAddress||item.address||item.market||'주소 정보 없음';
      return `<button type="button" data-onnuri-building-item="${i}">
        <span class="voucher-list-shop onnuri-list-shop">${onnuriShopSvg()}</span>
        <span class="voucher-list-copy"><b>${escapeHtml(item.name||'온누리상품권 가맹점')}</b><small>${escapeHtml(address)}</small><em>${escapeHtml([item.market,...uses].filter(Boolean).join(' · ')||'온누리상품권')}</em></span>
        <span class="voucher-list-arrow">›</span>
      </button>`;
    }).join('');
    box.querySelectorAll('[data-onnuri-building-item]').forEach(btn=>{
      btn.onclick=e=>{e.stopPropagation();openOnnuriStoreInfo(list[Number(btn.dataset.onnuriBuildingItem)])};
    });
  }
  $('voucherBuildingModal')?.classList.remove('hidden');
}

/* ===== 7.6.13.0 지역사랑상품권 마커: 온누리와 동일한 방식의 겹침 해소 =====
   - 같은 건물 가맹점은 개수 배지로 묶는다.
   - 화면에서 서로 겹치는 가맹점(건물이 달라도)은 6곳 이하면 펼쳐서 개별 표시, 7곳 이상이면 개수 배지로 묶는다.
   - 그래도 자리가 없는 마커는 가까운 빈자리로 옮기고, 원래 위치와 가는 선·점으로 잇는다(declutterVoucherMarkers). */
function voucherFocusKeyOf(item){
  return `shop:${voucherBuildingKey(item)}`;
}
function addVoucherMarker(el,lng,lat,anchor,priority,focusKey='',items=[]){
  const rec={el,lng,lat,anchor,priority:Number(priority)||0,marker:null,key:focusKey,items};
  el.style.zIndex='6';
  const f=state.localVoucherFocus;
  if(focusKey&&f&&f.key===focusKey&&Date.now()-Number(f.at||0)<90000){el.classList.add('voucher-focus');el.style.zIndex='9';rec.priority=1e9}
  try{rec.marker=new maplibregl.Marker({element:el,anchor}).setLngLat([lng,lat]).addTo(state.map);state.localVoucherMarkers.push(rec.marker)}catch{return null}
  return rec;
}
function voucherShopGroups(items){
  const grouped=new Map();
  for(const item of items||[]){
    if(!Number.isFinite(Number(item.lng))||!Number.isFinite(Number(item.lat)))continue;
    const key=voucherBuildingKey(item);
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(item);
  }
  return [...grouped.values()].map(list=>({lng:Number(list[0].lng),lat:Number(list[0].lat),items:list}));
}
/* 화면에서 서로 겹치는 가맹점 그룹을 묶는다(온누리 clusterOnnuriGroupsByOverlap과 동일한 방식).
   6곳 이하 묶음은 개별 마커로(겹침은 배치 단계에서 해소), 초과하면 개수 배지로 표시. */
function clusterVoucherGroupsByOverlap(groups,thresholdPx=34,maxIndividual=6){
  if(!state.map?.project)return{singles:groups,clusters:[]};
  const pts=[];
  for(const g of groups){try{const p=state.map.project([g.lng,g.lat]);if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))pts.push({g,x:p.x,y:p.y})}catch{}}
  const parent=pts.map((_,i)=>i),grid=new Map();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
  pts.forEach((p,i)=>{
    const cx=Math.floor(p.x/thresholdPx),cy=Math.floor(p.y/thresholdPx);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const l=grid.get(`${cx+dx}:${cy+dy}`);if(!l)continue;
      for(const j of l){const ddx=pts[j].x-p.x,ddy=pts[j].y-p.y;if(ddx*ddx+ddy*ddy<=thresholdPx*thresholdPx){const a=find(i),b=find(j);if(a!==b)parent[a]=b}}
    }
    const k=`${cx}:${cy}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);
  });
  const comps=new Map();
  pts.forEach((p,i)=>{const r=find(i);if(!comps.has(r))comps.set(r,[]);comps.get(r).push(p)});
  const singles=[],clusters=[];
  for(const list of comps.values()){
    if(list.length<=maxIndividual){for(const p of list)singles.push(p.g);continue}
    let sx=0,sy=0,count=0,items=[];
    for(const p of list){sx+=p.x;sy+=p.y;count+=p.g.items.length;items=items.concat(p.g.items)}
    let c=null;try{c=state.map.unproject([sx/list.length,sy/list.length])}catch{}
    clusters.push({lng:c?.lng??list[0].g.lng,lat:c?.lat??list[0].g.lat,count,items});
  }
  return{singles,clusters};
}
function sortVoucherByDistance(items){
  const list=(items||[]).filter(Boolean);
  if(!pointValid(state.user))return list;
  return list.map(x=>({x,d:voucherGeoMeters(state.user.lat,state.user.lng,Number(x.lat),Number(x.lng))})).sort((a,b)=>(Number.isFinite(a.d)?a.d:1e12)-(Number.isFinite(b.d)?b.d:1e12)).map(o=>o.x);
}
function addVoucherLeader(lng,lat,len,angDeg){
  try{
    const root=document.createElement('div');root.className='voucher-leader';root.style.zIndex='3';
    root.innerHTML=`<i class="voucher-leader-line" style="width:${Math.round(len)}px;transform:rotate(${angDeg.toFixed(1)}deg)"></i><i class="voucher-leader-dot"></i>`;
    state.localVoucherMarkers.push(new maplibregl.Marker({element:root,anchor:'center'}).setLngLat([lng,lat]).addTo(state.map));
  }catch{}
}
function declutterVoucherMarkers(recs,depth=0){
  if(!state.map||!recs?.length)return;
  let cont;try{const c=state.map.getContainer();cont={width:c.clientWidth||c.getBoundingClientRect().width,height:c.clientHeight||c.getBoundingClientRect().height}}catch{return}
  if(!(cont.width>0&&cont.height>0))return;
  for(const r of recs){try{r.marker.setOffset([0,0])}catch{}}
  const items=[];
  recs.forEach((r,i)=>{
    // 위치는 지도 투영값(+앵커 규칙)으로 계산하고 요소 크기만 DOM 에서 읽는다(마커 transform 반영 시점에 의존하지 않음).
    const w=r.el.offsetWidth,h=r.el.offsetHeight;if(!(w>0&&h>0))return;
    let p;try{p=state.map.project([r.lng,r.lat])}catch{return}
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    items.push({id:i,x:p.x-w/2,y:r.anchor==='center'?p.y-h/2:p.y-h,w,h,priority:r.priority,anchorCenter:r.anchor==='center',canCompact:false,cw:0,ch:0});
  });
  const layout=resolveMarkerLayout(items,{w:cont.width,h:cont.height});
  // 접어서도 자리를 찾지 못한 마커(아주 밀집)는 하나의 개수 배지로 묶는다: 누르면 확대하거나 전체 목록을 보여준다.
  const failed=items.filter(it=>layout.get(it.id)?.failed).map(it=>recs[it.id]);
  if(failed.length>=2&&depth<2){
    let sx=0,sy=0,all=[];
    for(const r of failed){
      sx+=r.lng;sy+=r.lat;all=all.concat(r.items||[]);
      try{r.marker.remove()}catch{}
      state.localVoucherMarkers=(state.localVoucherMarkers||[]).filter(m=>m!==r.marker);
    }
    const bubble=renderVoucherClusterMarkers([{lng:sx/failed.length,lat:sy/failed.length,count:Math.max(all.length,failed.length),items:all}]);
    return declutterVoucherMarkers([...recs.filter(r=>!failed.includes(r)),...bubble],depth+1);
  }
  for(const it of items){
    const L=layout.get(it.id),r=recs[it.id];if(!L||!r)continue;
    if(L.dx||L.dy){
      try{r.marker.setOffset([L.dx,L.dy])}catch{}
      // 원래 위치에서 옮겨졌다면, 진짜 위치와 마커를 잇는 가는 선과 점을 함께 표시
      const cx=L.rect.x+L.rect.w/2,cy=L.rect.y+L.rect.h/2,dx=cx-L.ax,dy=cy-L.ay,len=Math.hypot(dx,dy);
      if(len>12)addVoucherLeader(r.lng,r.lat,len,Math.atan2(dy,dx)*180/Math.PI);
    }
  }
}
function renderVoucherShopMarkers(items){
  const recs=[];
  for(const g of (Array.isArray(items)&&items[0]&&items[0].items?items:voucherShopGroups(items))){
    const list=g.items,item=list[0];
    const el=document.createElement('button');
    el.type='button';el.className='voucher-shop-marker';
    el.title=list.length>1?`지역사랑상품권 가맹점 ${list.length}곳`:item.name||'지역사랑상품권 가맹점';
    el.innerHTML=`${voucherShopSvg()}<span>${list.length>1?(list.length>99?'99+':list.length):''}</span>`;
    el.onclick=e=>{e.stopPropagation();list.length>1?openVoucherBuildingList(list):openVoucherStoreInfo(item)};
    const r=addVoucherMarker(el,Number(item.lng),Number(item.lat),'bottom',list.length,voucherFocusKeyOf(item),list);
    if(r)recs.push(r);
  }
  return recs;
}

// 완전 동일 좌표 반복이 아니어도, 좁은 경도/위도 밴드에 다수 지점이 몰리면서 반대축으로 넓게(약 30km+)
// 퍼져있으면 지도에서는 하나의 직선처럼 보인다. 서버 필터를 통과한 데이터에 대한 2차 안전장치로 프론트에서도 확인한다.
// 7.6.1.9: 기존에는 "전체 로드된 가맹점 수 대비 5% 이상"이라는 비율 조건이 함께 걸려 있어서,
// 화면에 보이는 가맹점 전체 수가 많을 때(예: 1200개 근접) 실제로는 뚜렷한 일직선(12~20곳 수준)이어도
// 비율 조건을 통과하지 못해 걸러지지 않는 문제가 있었다. 일직선 여부는 전체 데이터 규모와 무관한
// 순수 기하학적 패턴이므로, 비율 조건을 제거하고 절대 개수(MIN_COUNT)만으로 판단한다.
// 또한 고정 격자 하나만 쓰면 경계선에 걸친 점들이 서로 다른 bin으로 갈라져 밴드를 놓칠 수 있어,
// 원래 격자와 반 칸(BIN/2) 밀린 격자를 모두 스캔해 겹쳐본다.
function detectVoucherLineBands(rows){
  const bad=new Set();
  const BIN=0.02,MIN_COUNT=6,MIN_SPAN=.3;
  if(rows.length<MIN_COUNT)return bad;
  const scan=(getKey,getSpanValue)=>{
    for(const offset of [0,BIN/2]){
      const bins=new Map();
      for(const x of rows){
        const k=Math.round((getKey(x)+offset)/BIN);
        if(!bins.has(k))bins.set(k,[]);
        bins.get(k).push(x);
      }
      for(const list of bins.values()){
        if(list.length<MIN_COUNT)continue;
        const values=list.map(getSpanValue);
        if(Math.max(...values)-Math.min(...values)>=MIN_SPAN)
          for(const x of list)bad.add(x);
      }
    }
  };
  scan(x=>Number(x.lng),x=>Number(x.lat));
  scan(x=>Number(x.lat),x=>Number(x.lng));
  return bad;
}
function sanitizeVoucherCoordinates(items){
  const rows=(items||[]).filter(x=>Number.isFinite(Number(x.lng))&&Number.isFinite(Number(x.lat)));
  if(rows.length<5)return rows;
  const latBins=new Map(),lngBins=new Map();
  const add=(map,key)=>map.set(key,(map.get(key)||0)+1);
  for(const x of rows){
    add(latBins,Number(x.lat).toFixed(5));
    add(lngBins,Number(x.lng).toFixed(5));
  }
  const suspiciousLat=new Set([...latBins].filter(([,n])=>n>=5&&n/rows.length>=.18).map(([k])=>k));
  const suspiciousLng=new Set([...lngBins].filter(([,n])=>n>=5&&n/rows.length>=.18).map(([k])=>k));
  const lineBad=detectVoucherLineBands(rows);
  if(!suspiciousLat.size&&!suspiciousLng.size&&!lineBad.size)return rows;
  return rows.filter(x=>{
    // 주소 기반으로 교정된 좌표는 유지하고, 원본 API에서 대량 일렬 반복/준-직선 패턴인 좌표만 제외한다.
    if(x.coordinateSource==='kakao-address'||x.coordinateSource==='kakao-keyword')return true;
    const sameLat=suspiciousLat.has(Number(x.lat).toFixed(5));
    const sameLng=suspiciousLng.has(Number(x.lng).toFixed(5));
    return !sameLat&&!sameLng&&!lineBad.has(x);
  });
}
// 화면 픽셀 격자 기준으로 가맹점을 묶는다. 지리 좌표(m) 기준이 아니라 화면 픽셀 기준으로 묶으므로
// 확대/축소와 무관하게 항상 "화면상 겹치지 않을 만큼" 자연스럽게 뭉쳐진다. 클러스터 중심은
// 포함된 가맹점들의 픽셀 좌표 평균을 다시 지도 좌표로 역변환해 구한다.
function clusterVoucherItemsByPixel(items){
  if(!state.map?.project||!state.map?.unproject)return items.map(it=>({lng:Number(it.lng),lat:Number(it.lat),count:1,items:[it]}));
  const CELL=64;
  const buckets=new Map();
  for(const it of items){
    let p;try{p=state.map.project([Number(it.lng),Number(it.lat)])}catch{continue}
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const key=`${Math.floor(p.x/CELL)}:${Math.floor(p.y/CELL)}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push({item:it,x:p.x,y:p.y});
  }
  const out=[];
  for(const list of buckets.values()){
    let sx=0,sy=0;for(const x of list){sx+=x.x;sy+=x.y}
    const cx=sx/list.length,cy=sy/list.length;
    let center;try{center=state.map.unproject([cx,cy])}catch{center=null}
    const first=list[0].item;
    out.push({
      lng:center?center.lng:Number(first.lng),
      lat:center?center.lat:Number(first.lat),
      count:list.length,
      items:list.map(x=>x.item)
    });
  }
  return out;
}
function renderVoucherClusterMarkers(clusters){
  const recs=[];
  for(const c of clusters||[]){
    const el=document.createElement('button');
    el.type='button';
    const size=c.count>=25?'large':c.count>=8?'medium':'small';
    el.className=`voucher-cluster-marker ${size}`;
    el.title=`가맹점 ${c.count}곳`;
    el.innerHTML=`<strong>${c.count>99?'99+':c.count}</strong>`;
    el.onclick=e=>{
      e.stopPropagation();
      try{
        const lngs=c.items.map(x=>Number(x.lng)).filter(Number.isFinite);
        const lats=c.items.map(x=>Number(x.lat)).filter(Number.isFinite);
        if(!lngs.length||!lats.length)return;
        const spanM=voucherGeoMeters(Math.min(...lats),Math.min(...lngs),Math.max(...lats),Math.max(...lngs));
        let zoom=0;try{zoom=Number(state.map.getZoom())||0}catch{}
        // 더 확대해도 분리되지 않는 경우(같은 지점이거나 이미 최대 확대)에는 가맹점 전체 목록을 보여준다.
        if(spanM<25||zoom>=17.2){openVoucherBuildingList(sortVoucherByDistance(c.items).slice(0,300));return}
        if(lngs.length===1)state.map.easeTo({center:[lngs[0],lats[0]],zoom:Math.max(zoom,16.5),duration:420});
        else state.map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:70,maxZoom:16.5,duration:420});
      }catch{}
    };
    const r=addVoucherMarker(el,c.lng,c.lat,'center',c.count,'',c.items);
    if(r)recs.push(r);
  }
  return recs;
}
function renderLocalVoucherMarkers(data){
  clearLocalVoucherMarkers();
  if(!state.map||!maplibregl?.Marker||state.tripStartedAt||$('homeView')?.classList.contains('hidden'))return;
  const items=sanitizeVoucherCoordinates(data?.items||[])
    .filter(x=>Number.isFinite(Number(x.lng))&&Number.isFinite(Number(x.lat)))
    .slice(0,1200);
  if(!items.length)return;

  // 7.6.2.0: 화면이 넓게(1km 이상) 보일 때는 지점들이 화면에 겹쳐 보이거나(과거 버그로는 한 줄로
  // 늘어서 보이는 문제까지) 발생했다. 이제는 구역별로 묶어 큰/중간/작은 숫자 배지의 클러스터로
  // 표시하고, 화면 폭이 1km 미만으로 확대되었을 때만 개별 가맹점 SVG 아이콘을 표시한다.
  // 7.6.13.0: 화면 폭이 좁아 개별 핀을 보여줄 때도, 온누리와 동일하게 화면 좌표 기준으로 겹침을
  // 해소한다(가까운 빈자리로 이동 + 원위치 표시선, 자리가 없으면 개수 배지).
  const visibleWidthMeters=voucherVisibleRadiusMeters()*2;
  const zoomedInEnoughForIndividualPins=Number.isFinite(visibleWidthMeters)&&visibleWidthMeters<1600;

  let recs;
  if(zoomedInEnoughForIndividualPins){
    const {singles,clusters}=clusterVoucherGroupsByOverlap(voucherShopGroups(items));
    recs=[...renderVoucherShopMarkers(singles),...renderVoucherClusterMarkers(clusters)];
  }else{
    recs=renderVoucherClusterMarkers(clusterVoucherItemsByPixel(items));
  }
  try{declutterVoucherMarkers(recs)}catch(e){console.warn('voucher declutter failed',e)}
}
// 지역명 + 할인율을 지도 위 배지에 표시한다. 값이 없을 때는 상태에 맞는 안내 문구로 대체하고,
// 지역 자체를 확인할 수 없을 때만 배지를 숨긴다.
function formatVoucherDiscountRate(n){
  if(!Number.isFinite(n))return '';
  const rounded=Math.round(n*10)/10;
  return (Number.isInteger(rounded)?String(rounded):rounded.toFixed(1));
}
function updateLocalVoucherBadge(data){
  const badge=$('localVoucherBadge');
  if(badge)badge.classList.add('hidden');
}
function readVoucherStaleCache(){
  try{
    const raw=localStorage.getItem('jofams_local_voucher_cache_v9');
    if(!raw)return null;
    const d=JSON.parse(raw);
    if(!d?.payload||Date.now()-Number(d.savedAt||0)>6*60*60*1000)return null;
    return d.payload;
  }catch{return null}
}
function writeVoucherStaleCache(payload){
  try{localStorage.setItem('jofams_local_voucher_cache_v9',JSON.stringify({savedAt:Date.now(),payload}))}catch{}
}
function scheduleVoucherReconnect(){
  clearTimeout(state.localVoucherReconnectTimer);
  const n=Math.min(5,Number(state.localVoucherRetryCount||0)+1);
  state.localVoucherRetryCount=n;
  const wait=Math.min(30000,1500*(2**(n-1)));
  state.localVoucherReconnectTimer=setTimeout(()=>{
    if(navigator.onLine===false){scheduleVoucherReconnect();return}
    loadLocalVoucherMap({force:true});
  },wait);
}
async function loadLocalVoucherMap({force=false}={}){
  if(!state.map||$('homeView')?.classList.contains('hidden'))return;
  const zoom=Number(state.map.getZoom?.()||0);
  if(zoom<7.5){
    clearLocalVoucherMarkers();
    $('localVoucherBadge')?.classList.add('hidden');
    return;
  }

  const center=state.map.getCenter?.();if(!center)return;

  // 최근 성공 데이터가 있으면 네트워크 재호출 전에도 바로 유지 표시
  if(state.localVoucherData){
    renderLocalVoucherMarkers(state.localVoucherData);
    updateLocalVoucherBadge(state.localVoucherData);
  }else{
    const cached=readVoucherStaleCache();
    if(cached){
      state.localVoucherData=cached;
      renderLocalVoucherMarkers(cached);
      updateLocalVoucherBadge(cached);
    }
  }

  // 7.6.1.9: 기존에는 "마지막 로드 후 45초 이내"이면 지도를 동/서/남/북으로 얼마나 멀리 이동했든
  // 무조건 새 요청 없이 이전 좌표 기준 데이터를 그대로 재사용했다. 그 결과 사용자가 지도를 옆으로
  // 움직이면 새로 보이는 지역의 가맹점이 한동안 표시되지 않는 문제가 있었다. 지도 중심이 현재 화면
  // 반경 대비 유의미하게 이동했다면(대략 화면 폭의 1/3 이상) 45초 제한과 무관하게 즉시 다시 불러온다.
  const movedFarEnough=(()=>{
    const last=state.localVoucherLoadedCenter;
    if(!last)return true;
    const dist=voucherGeoMeters(last.lat,last.lng,center.lat,center.lng);
    const radius=voucherVisibleRadiusMeters();
    const threshold=Number.isFinite(radius)&&radius>0?Math.max(260,radius*0.16):700;
    return dist>=threshold;
  })();

  if(!force&&!movedFarEnough&&Date.now()-Number(state.localVoucherLoadedAt||0)<18000&&state.localVoucherData)return;

  try{
    const b=state.map.getBounds?.();
    const u=new URL('/api/local-voucher',location.origin);
    u.searchParams.set('lng',center.lng);u.searchParams.set('lat',center.lat);
    if(!movedFarEnough&&state.localVoucherRegionCode)u.searchParams.set('regionCode',state.localVoucherRegionCode);
    if(b){
      u.searchParams.set('west',b.getWest());u.searchParams.set('south',b.getSouth());
      u.searchParams.set('east',b.getEast());u.searchParams.set('north',b.getNorth());
    }

    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),12000);
    let r;
    try{
      r=await fetch(u,{headers:{accept:'application/json'},signal:ctrl.signal,cache:'no-store'});
    }finally{clearTimeout(timer)}

    if(!r.ok){
      const err=await r.json().catch(()=>({}));
      console.warn('local voucher API failed',r.status,err?.error||'');
      state.localVoucherLastErrorAt=Date.now();

      // 일시 실패 시 기존 성공 데이터를 절대 지우지 않는다.
      if(!state.localVoucherData){
        if($('localVoucherRegion'))$('localVoucherRegion').textContent='가맹점 연결 재시도 중';
        if($('localVoucherDiscount')){
          const detail=String(err?.detail||'');
          $('localVoucherDiscount').textContent=r.status===503?'공공데이터 API 키 확인':
            /SERVICE_KEY|인증키|등록되지 않은/i.test(detail)?'인증키 형식 확인':'연결 복구 중';
        }
        $('localVoucherBadge')?.classList.remove('hidden');
      }
      scheduleVoucherReconnect();
      return;
    }

    const d=await r.json();
    state.localVoucherLoadedAt=Date.now();
    state.localVoucherLoadedCenter={lat:center.lat,lng:center.lng};
    state.localVoucherRegionCode=d.regionCode||'';
    state.localVoucherData=d;
    if(!$('whereToModal')?.classList.contains('hidden'))renderWhereToList();
    state.localVoucherRetryCount=0;
    clearTimeout(state.localVoucherReconnectTimer);
    writeVoucherStaleCache(d);

    renderLocalVoucherMarkers(d);
    updateLocalVoucherBadge(d);
  }catch(e){
    console.warn('local voucher map load failed',e);
    state.localVoucherLastErrorAt=Date.now();
    // 기존 마커/할인율 유지 + 자동 재연결
    scheduleVoucherReconnect();
  }
}
function scheduleLocalVoucherRefresh(force=false){
  clearTimeout(state.localVoucherLoadTimer);
  state.localVoucherLoadTimer=setTimeout(()=>loadLocalVoucherMap({force:Boolean(force)}),force?120:220);
}

function refreshMapLayout({fitRoute=false}={}){
  if(!state.map)return;
  const run=()=>{try{state.map.resize();if(state.route?.geometry?.length){drawRoute(state.route,{fit:fitRoute})}else if(state.user){state.map.jumpTo({center:[state.user.lng,state.user.lat]})}}catch(e){console.warn('map resize failed',e)}};
  requestAnimationFrame(run);setTimeout(run,80);setTimeout(run,280);
}


function alignDriveCharacterWithSpeedLimit(){
  if(!state.tripStartedAt||!state.map||!state.userMarker)return;
  const el=state.userMarker.getElement?.();if(!el)return;
  try{
    const canvas=state.map.getCanvas?.(),cr=canvas?.getBoundingClientRect?.();
    const ll=state.userMarker.getLngLat?.(),p=ll?state.map.project([ll.lng,ll.lat]):null;
    if(!cr||!Number.isFinite(p?.y))return;
    // 캐릭터 중심은 화면 하단~정중앙 범위만 허용. 중간보다 위로 올라가지 않는다.
    const minY=cr.height*.52;
    // 7.6.11.4 가로 화면에서는 캐릭터 위치를 driveCameraPadding 이 하단 메뉴 경계선 위로 직접 맞추므로 보정하지 않는다.
    const corrective=(window.innerWidth||0)>(window.innerHeight||0)?0:Math.max(0,minY-p.y);
    el.style.setProperty('--drive-car-offset-y',`${Math.round(corrective)}px`);
    el.style.opacity='1';el.style.visibility='visible';el.style.display='block';
  }catch(e){console.warn('drive character alignment failed',e)}
}
function ensureDriveCharacterAfterViewportChange(){
  if(!state.tripStartedAt||!state.map||!state.user)return;
  try{
    state.map.resize();
    if(state.carMarker){try{state.carMarker.remove()}catch{}state.carMarker=null}
    ensureUserMarker();
    const el=state.userMarker?.getElement?.();
    if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block'}
    alignDriveCharacterWithSpeedLimit();
    updateDriving(true);
    snapDriveCameraNow();setTimeout(snapDriveCameraNow,250);
  }catch(e){console.warn('drive marker viewport recovery failed',e)}
}

// 7.6.1.9: 도보 안내에서는 자동차를 탄 캐릭터 대신, 걸어다니는 일반 캐릭터(아바타)를 사용한다.
// characterDefs에는 도보용 별도 이미지가 없으므로, 캐릭터 아바타(avatar) 이미지를 그대로 사용한다.
function isWalkingGuide(){return state.routeMode==='walk'}
function characterGuideImage(kind){
  const c=characterDefs[state.character];
  if(isWalkingGuide())return c.avatar;
  if(kind==='marker')return c.marker;
  return c.rear||c.marker;
}
function makeCarMarker(){
  const el=document.createElement('div');el.className='character-car-marker rear-version';
  el.classList.toggle('walking-character-marker',isWalkingGuide());
  const img=document.createElement('img');
  img.alt=characterDefs[state.character].name;img.decoding='sync';img.loading='eager';
  img.style.opacity='1';img.style.visibility='visible';
  img.src=characterGuideImage('rear');el.appendChild(img);
  el.style.opacity='1';el.style.visibility='visible';el.style.display='block';
  return new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'viewport'});
}
function updateCarMarkerImage(){
  const el=state.userMarker?.getElement();if(!el)return;
  el.classList.toggle('walking-character-marker',isWalkingGuide());
  const img=el.querySelector('img');if(img){const src=characterGuideImage('rear');if(!img.getAttribute('src')?.endsWith(src))img.src=src;}
}
function makeEndpointMarker(kind='end',label='목적지'){
  const el=document.createElement('div');
  el.className=`dangollo-endpoint-pin dangollo-${kind}-pin`;
  const color=kind==='start'?'#159B63':'#2077ED';
  el.innerHTML=`<svg class="dangollo-endpoint-svg" viewBox="0 0 92 104" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="5" width="74" height="35" rx="17.5" fill="${color}" stroke="#ffffff" stroke-width="3"/><text x="46" y="28" fill="#ffffff" font-size="18" text-anchor="middle" font-weight="800" font-family="sans-serif">${label}</text><path d="M46 40v58" stroke="${color}" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="97" r="6" fill="#ffffff" stroke="${color}" stroke-width="4"/></svg>`;
  const marker=new maplibregl.Marker({element:el,anchor:'bottom'});
  marker.getElement().classList.add('dangollo-route-endpoint-marker');
  return marker;
}
function makeDestMarker(){
  return makeEndpointMarker('end','목적지');
}
function updateUserMarkerMotion(){
  if(state.tripStartedAt&&!state.simulationActive&&!state.navigationStartReleased){
    state.userMarker?.getElement?.()?.classList.remove('jofams-car-moving');
    if(Number.isFinite(Number(state.driveMarkerRenderedDistance)))state.driveMarkerTargetDistance=Number(state.driveMarkerRenderedDistance);
    return;
  }
  const moving=Boolean(state.tripStartedAt)&&Math.max(0,Number(state.user?.speed)||0)>.35;
  const el=state.userMarker?.getElement();if(el)el.classList.toggle('jofams-car-moving',moving);
  if(state.tripStartedAt)setTimeout(alignDriveCharacterWithSpeedLimit,0);
  const ar=$('driveArCharacter');if(ar)ar.classList.toggle('moving',moving&&state.arCameraMode);const arMarker=$('arCharacterMarker');if(arMarker)arMarker.classList.toggle('moving',moving&&state.arRunning);
  const img=$('driveArCharacterImg');if(img)img.src=characterGuideImage('rear');
}
/* 단골로: 목표 GPS는 계단식으로 갱신되지만, 표시 좌표는 매 프레임 경로 위에서 이동한다. */
function scheduleSmoothDriveMarker(){
  if(state.tripStartedAt&&!state.simulationActive&&!state.navigationStartReleased)return;
  if(state.driveMarkerRaf||!state.tripStartedAt)return;
  const frame=ts=>{
    state.driveMarkerRaf=0;
    if(!state.tripStartedAt||!state.userMarker||!state.route?.geometry?.length)return;
    const previous=Number(state.driveMarkerFrameAt)||ts;
    const dt=Math.max(0,Math.min(.065,(ts-previous)/1000));
    state.driveMarkerFrameAt=ts;
    const rendered=Number.isFinite(Number(state.driveMarkerRenderedDistance))?Number(state.driveMarkerRenderedDistance):0;
    const total=Number(state.routeCumulative?.at(-1))||Infinity;
    const target=Number.isFinite(Number(state.driveMarkerTargetDistance))?Number(state.driveMarkerTargetDistance):rendered;
    const speed=Math.max(0,Number(state.user?.speed)||0);
    const stationary=!state.simulationActive&&(state.stationaryActive||!state.navigationStartReleased||speed<=.2);
    let next=rendered;
    if(state.simulationActive){
      // 모의주행 위치는 모의주행 루프에서 확정한다. 여기서는 움직임을 덮어쓰지 않는다.
      next=Math.max(rendered,Math.min(total,target));
    }else if(!stationary&&dt>0){
      const age=Math.max(0,(Date.now()-Number(state.driveMarkerTargetAt||0))/1000);
      // 미확인 미래 위치로 캐릭터가 앞서가지 않도록 예측 주행 금지.
      const predicted=state.drivePositionUncertain?rendered:target;
      const gap=Math.max(0,predicted-rendered);
      // 초당 GPS 보정 목표로 끌려가는 급가속/급정지를 완화한다.
      const travelSpeed=Math.min(speed*1.16+1.0,Math.max(speed*.70,gap*1.8));
      next=Math.min(total,rendered+Math.min(gap,travelSpeed*dt));
    }
    if(next>=rendered){
      const pos=pointAtRouteDistance(next);
      if(pos){state.driveMarkerRenderedDistance=next;state.userMarker.setLngLat([pos.lng,pos.lat]);}
    }
    // 주행 중에는 다음 GPS 프레임까지 계속 갱신한다. 정차 시에는 프레임을 중단해 전진 드리프트 방지.
    if(state.simulationActive||(!stationary&&!state.drivePositionUncertain&&speed>.2&&target>next+.2))state.driveMarkerRaf=requestAnimationFrame(frame);
  };
  state.driveMarkerFrameAt=0;
  state.driveMarkerRaf=requestAnimationFrame(frame);
}
function ensureUserMarker(){
  if(!state.user||!state.map||!pointValid(state.user))return;
  // v7.6.27.39: 출발 대기 미리보기는 웹/네이티브 GPS 지터에 따라 이동해서는 안 된다.
  if(state.departurePreview&&!state.tripStartedAt&&state.route?.geometry?.length){
    const first=state.route.geometry[0];
    if(first&&Number.isFinite(Number(first[0]))&&Number.isFinite(Number(first[1]))){
      if(!state.userMarker)state.userMarker=makeCarMarker().setLngLat([Number(first[0]),Number(first[1])]).addTo(state.map);
      else state.userMarker.setLngLat([Number(first[0]),Number(first[1])]);
      const el=state.userMarker.getElement?.();
      if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block';el.classList.remove('jofams-car-moving')}
      return;
    }
  }
  // 7.6.27.34: departure latch is authoritative for BOTH browser and native GPS.
  // Capture a single start position; never move on GPS jitter, stale native route distance or redraw.
  if(state.tripStartedAt&&!state.simulationActive&&!state.navigationStartReleased){
    if(!Number.isFinite(state.departureVisualDistance)){
      const rd=finiteOrNull(state.driveMarkerRenderedDistance);
      const origin=state.navigationStartAnchor;
      const projected=origin&&state.route?.geometry?.length?routePosOfPoint(Number(origin.lng),Number(origin.lat),state.route.geometry,null,100):null;
      state.departureVisualDistance=rd!==null?rd:(finiteOrNull(projected?.routeDistance)??0);
    }
    const fixed=pointAtRouteDistance(state.departureVisualDistance);
    state.driveMarkerRenderedDistance=state.departureVisualDistance;
    state.driveMarkerTargetDistance=state.departureVisualDistance;
    if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0}
    if(state.userMarker){
      if(fixed)state.userMarker.setLngLat([fixed.lng,fixed.lat]);
      state.userMarker.getElement?.()?.classList.remove('jofams-car-moving');
    }
  }else if(state.departureVisualDistance!==undefined){state.departureVisualDistance=undefined;}

  // GPS/맵매칭이 순간적으로 불안정해도(터널, 산간 등 신호 약한 구간) 캐릭터 마커
  // DOM이 지도에서 떨어져 나가면 다시 붙인다. 경로선은 별도 레이어라 영향받지 않지만
  // 마커만 사라져 보이는 현상은 대부분 이 detach 상태에서 발생한다.
  if(state.userMarker){
    const el=state.userMarker.getElement?.();
    if(!el||!el.isConnected){
      try{state.userMarker.remove()}catch{}
      state.userMarker=null;
    }
  }
  if(!state.userMarker){
    const initial=state.tripStartedAt&&state.route?.geometry?.length?pointAtRouteDistance(Number(state.driveMarkerRenderedDistance)||0):null;
    state.userMarker=makeCarMarker().setLngLat(initial?[initial.lng,initial.lat]:[state.user.lng,state.user.lat]).addTo(state.map);
    {const rd0=finiteOrNull(state.user.routeDistance);if(rd0!=null&&!state.tripStartedAt)state.driveMarkerRenderedDistance=rd0;}
  }
  if(state.tripStartedAt&&!state.simulationActive&&!state.navigationStartReleased){
    const fixed=pointAtRouteDistance(Number(state.departureVisualDistance)||0);
    if(fixed)state.userMarker.setLngLat([fixed.lng,fixed.lat]);
    state.userMarker.getElement?.()?.classList.remove('jofams-car-moving');
    return;
  }
  if(state.tripStartedAt&&state.drivePositionUncertain&&!state.simulationActive){
    // Do not hide the marker or poison the next valid GNSS fix. Keep last confirmed route point.
    if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0;}
    const last=pointAtRouteDistance(Number(state.driveMarkerRenderedDistance)||Number(state.user?.routeDistance)||0);
    if(last)state.userMarker.setLngLat([last.lng,last.lat]);
    const markerEl=state.userMarker.getElement?.();if(markerEl){markerEl.style.opacity='1';markerEl.style.visibility='visible';markerEl.style.display='block'}
    updateUserMarkerMotion();return;
  }
  if(state.tripStartedAt&&state.route?.geometry?.length&&finiteOrNull(state.user.routeDistance)!=null&&state.navigationStartReleased){
    const incomingRouteDistance=finiteOrNull(state.user?.routeDistance);
  const realSpeed=Math.max(0,Number(state.user?.speed)||0);
  if(state.tripStartedAt&&!state.simulationActive&&(state.stationaryActive||realSpeed<=0.05)&&Number.isFinite(Number(state.driveMarkerRenderedDistance))){
    // 정지 중에는 GPS/맵매칭 오차가 앞쪽 점을 잡더라도 캐릭터 목표거리를 갱신하지 않는다.
    state.driveMarkerTargetDistance=Number(state.driveMarkerRenderedDistance);
  }else if(Number.isFinite(incomingRouteDistance)){
    if(state.driveMarkerTargetDistance!==incomingRouteDistance)state.driveMarkerTargetAt=Date.now();
    state.driveMarkerTargetDistance=Math.max(Number(state.driveMarkerRenderedDistance)||0,Number(state.driveMarkerTargetDistance)||0,incomingRouteDistance);
  }
    if(!Number.isFinite(Number(state.driveMarkerRenderedDistance)))state.driveMarkerRenderedDistance=incomingRouteDistance;
    scheduleSmoothDriveMarker();
  }else if(state.tripStartedAt&&state.route?.geometry?.length){
    const start=pointAtRouteDistance(Math.max(0,Number(state.driveMarkerRenderedDistance)||0));
    if(start)state.userMarker.setLngLat([start.lng,start.lat]);
  }else state.userMarker.setLngLat([state.user.lng,state.user.lat]);
  updateUserMarkerMotion();
}
function ensureDestinationMarker(){
  if(state.route?.geometry?.length){renderRouteEndpointLayers();return;}

  const routeVisible=!$('routeView')?.classList.contains('hidden');
  const driveVisible=!$('driveView')?.classList.contains('hidden');
  if(!state.map||!state.destination||!state.route?.geometry?.length||(!routeVisible&&!driveVisible)){
    if(state.destMarker){try{state.destMarker.remove()}catch{}state.destMarker=null;}
    updateDestinationEdgeIndicator();
    return;
  }
  const end=state.route?.geometry?.at(-1);
  const lng=Array.isArray(end)?Number(end[0]):Number(state.destination.lng);
  const lat=Array.isArray(end)?Number(end[1]):Number(state.destination.lat);
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return;
  try{
    if(!state.destMarker)state.destMarker=makeDestMarker().setLngLat([lng,lat]).addTo(state.map);
    else state.destMarker.setLngLat([lng,lat]);
    state.destMarker.getElement()?.classList.add('dangollo-route-endpoint-marker');
    const el=state.destMarker.getElement();
    if(el){
      el.style.removeProperty('display');el.style.removeProperty('visibility');el.style.removeProperty('opacity');
      el.classList.add('dangollo-arrival-visible');
      el.setAttribute('aria-label','목적지');
    }
    ensureDestinationEdgeIndicator();
  }catch(e){console.warn('arrival marker update failed',e)}
}
/* 7.6.22.6: no screen-edge arrival marker; actual destination is a map-coordinate marker only. */
function updateDestinationEdgeIndicator(){
  const edge=document.getElementById('dangolloDestinationEdge');
  if(edge)edge.remove();
}
function ensureDestinationEdgeIndicator(){updateDestinationEdgeIndicator()}
function setDestinationMarker(){
  if(!state.destination){
    const edge=document.getElementById('dangolloDestinationEdge');if(edge)edge.hidden=true;
    if(state.destMarker){try{state.destMarker.remove()}catch{}state.destMarker=null}
    return;
  }
  ensureDestinationMarker();
}
function updateOriginMarker(){
  if(state.route?.geometry?.length){renderRouteEndpointLayers();return;}

  const routeVisible=!$('routeView')?.classList.contains('hidden');
  const driveVisible=!$('driveView')?.classList.contains('hidden');
  const start=state.route?.geometry?.[0];
  const lng=Array.isArray(start)?Number(start[0]):NaN;
  const lat=Array.isArray(start)?Number(start[1]):NaN;
  if(!state.map||!state.route?.geometry?.length||(!routeVisible&&!driveVisible)||!Number.isFinite(lng)||!Number.isFinite(lat)){
    if(state.originMarker){try{state.originMarker.remove()}catch{}state.originMarker=null}
    return;
  }
  try{
    const el=state.originMarker?.getElement?.();
    if(!state.originMarker||!el?.isConnected){
      if(state.originMarker)try{state.originMarker.remove()}catch{}
      state.originMarker=makeEndpointMarker('start','출발지').setLngLat([lng,lat]).addTo(state.map);
    }else state.originMarker.setLngLat([lng,lat]);
    state.originMarker.getElement()?.classList.add('dangollo-route-endpoint-marker');
  }catch(e){console.warn('start marker update failed',e)}
}

function trafficClassFromValues(speed,stateCode){
  const st=Number(stateCode)||0,sp=Number(speed)||0;
  // 카카오 공식 traffic_state: 4 원활 / 3 서행 / 2 지체 / 1 정체 / 6 사고·통행불가.
  // "극심"은 카카오 독립 상태코드가 아니다. 정체(1) + 제공된 평균속도 <=5km/h인 경우에만 보조 분류한다.
  // 0은 미상(추정 표기 금지); 6만 실제 통제/통행불가로 표기한다.
  if(st===6)return{key:'blocked',label:'통제',color:'#222b3a',detail:'사고 등으로 통행할 수 없는 구간입니다.'};
  if(st===4)return{key:'smooth',label:'원활',color:'#16a36a',detail:'차량 간격이 충분하고 흐름이 원활합니다.'};
  if(st===3)return{key:'slow',label:'서행',color:'#f0c02d',detail:'제한속도보다 낮게 이동하는 서행 구간입니다.'};
  if(st===2)return{key:'delayed',label:'지체',color:'#ef8434',detail:'차량이 늘어나 이동속도가 감소한 구간입니다.'};
  if(st===1){
    if(sp>0&&sp<=5)return{key:'extreme',label:'극심',color:'#93213a',detail:'정체 구간의 평균속도가 5km/h 이하입니다(속도 기반 세분류).'};
    return{key:'severe',label:'정체',color:'#d82f3c',detail:'차량 흐름이 매우 느린 정체 구간입니다.'};
  }
  return{key:'unknown',label:'미상',color:'#9aa6b5',detail:'현재 구간에 제공되는 교통 상태 정보가 없습니다.'};
}
function buildTrafficGeoJson(route){
  const g=route?.geometry||[],features=[];
  for(const seg of (route?.roadSegments||[])){
    const info=trafficClassFromValues(seg.trafficSpeed,seg.trafficState);
    const a=Math.max(0,Number(seg.startIndex)||0),b=Math.min(g.length-1,Number(seg.endIndex)||a);if(b<=a)continue;
    const coords=g.slice(a,b+1);if(coords.length<2)continue;features.push({type:'Feature',properties:{status:info.key,color:info.color},geometry:{type:'LineString',coordinates:coords}});
  }
  return{type:'FeatureCollection',features};
}
/* v7.6.24.6 — MapLibre image icons anchored at real route endpoint geometry.
   Separate images for colors, no legacy DOM/CSS marker styling involved. */
function ensureDangolloEndpointImages(){
  if(!state.map)return false;
  for(const [id,color,label] of [['dangollo-start-pin-image','#08753c','출발'],['dangollo-end-pin-image','#086bc8','도착']]){
    if(state.map.hasImage(id))continue;
    const scale=3,w=96,h=105;
    const canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;
    const ctx=canvas.getContext('2d');if(!ctx)return false;
    ctx.scale(scale,scale);ctx.lineJoin='round';ctx.lineCap='round';
    // Dedicated readable text plaque ABOVE the map pin. Do not depend on map glyphs/CSS.
    ctx.fillStyle='rgba(255,255,255,.98)';ctx.strokeStyle=color;ctx.lineWidth=2.2;
    ctx.beginPath();ctx.roundRect(20,2,56,27,12);ctx.fill();ctx.stroke();
    ctx.fillStyle=color;ctx.font='900 17px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,48,16.5);
    ctx.translate(23,29);
    // Pin tip exactly coincides with icon bottom and route endpoint coordinate.
    ctx.beginPath();ctx.moveTo(25,76);ctx.bezierCurveTo(20,69,4,52,4,30);ctx.bezierCurveTo(4,3,46,3,46,30);
    ctx.bezierCurveTo(46,52,30,69,25,76);ctx.closePath();
    ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4.5;ctx.stroke();
    ctx.beginPath();ctx.arc(25,30,8.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4.5;ctx.stroke();
    state.map.addImage(id,ctx.getImageData(0,0,canvas.width,canvas.height),{pixelRatio:scale});
  }
  return true;
}
function renderRouteEndpointLayers(route=state.route){
  if(!state.map?.isStyleLoaded?.())return;
  const g=route?.geometry||[];
  const visible=!$('routeView')?.classList.contains('hidden')||!$('driveView')?.classList.contains('hidden');
  const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]));
  const source='dangollo-route-endpoints';
  const features=visible&&g.length>=2&&valid(g[0])&&valid(g[g.length-1])?[
    {type:'Feature',properties:{kind:'start',icon:'dangollo-start-pin-image'},geometry:{type:'Point',coordinates:[Number(g[0][0]),Number(g[0][1])] }},
    {type:'Feature',properties:{kind:'end',icon:'dangollo-end-pin-image'},geometry:{type:'Point',coordinates:[Number(g[g.length-1][0]),Number(g[g.length-1][1])] }}
  ]:[];
  const geo={type:'FeatureCollection',features};
  try{
    if(state.map.getSource(source))state.map.getSource(source).setData(geo);
    else state.map.addSource(source,{type:'geojson',data:geo});
    if(ensureDangolloEndpointImages()){
      if(!state.map.getLayer('dangollo-endpoint-pin-icon'))state.map.addLayer({id:'dangollo-endpoint-pin-icon',type:'symbol',source,
        layout:{'icon-image':['get','icon'],'icon-anchor':'bottom','icon-allow-overlap':true,'icon-ignore-placement':true,
        'icon-size':1,'symbol-placement':'point'}});
      // Avoid map glyph/font loading dependencies: icons render even when text glyph server fails.
      if(state.map.getLayer('dangollo-endpoint-pin-label'))state.map.removeLayer('dangollo-endpoint-pin-label');
      state.map.moveLayer('dangollo-endpoint-pin-icon');
      if(state.map.getLayer(ROUTE_CAMERA_LAYER))ensureRouteCameraStackOrder();
    }
    // No duplicate DOM markers: keep one source of truth (route GeoJSON endpoints).
    for(const key of ['originMarker','destMarker']){try{state[key]?.remove()}catch{}state[key]=null}
  }catch(e){console.warn('[endpoints] render failed',e)}
}
function routeFitPadding(){
  const w=Math.max(320,window.innerWidth||360),h=Math.max(240,window.innerHeight||640);
  const rv=document.getElementById('routeView');
  const shown=rv&&!rv.classList.contains('hidden');
  const rect=selector=>{const el=shown?rv.querySelector(selector):null;if(!el)return null;const r=el.getBoundingClientRect();return r.width&&r.height?r:null};
  const header=rect('.route-header'),sheet=rect('.route-sheet');
  if(w>h){const left=Math.max(header?.right||0,sheet?.right||0);return {top:88,bottom:Math.max(26,Math.round(h*.1)),left:Math.min(Math.round(left)+22,Math.round(w*.57)),right:32};}
  const top=Math.min(Math.max(90,Math.round((header?.bottom||0)+78)),Math.round(h*.28));
  const bottom=Math.min(Math.max(100,Math.round(h-(sheet?.top??(h-260))+24)),Math.round(h*.56));
  return {top,bottom,left:36,right:36};
}
function fitSelectedRoute(route){
  const geo=route?.geometry;if(!state.map||!Array.isArray(geo)||geo.length<2)return;
  const bounds=new maplibregl.LngLatBounds();geo.forEach(point=>bounds.extend(point));
  try{state.map.fitBounds(bounds,{padding:routeFitPadding(),duration:650,maxZoom:17.2})}
  catch(e){console.warn('route bounds fit fallback',e);state.map.fitBounds(bounds,{padding:36,duration:650,maxZoom:17.2})}
}
function drawRoute(route=state.route,{fit=true}={}){
  if(!route?.geometry?.length||!state.map)return;
  if(!state.mapReady||!state.map.isStyleLoaded()){state.pendingRouteDraw={route,options:{fit}};return}
  const data={type:'Feature',geometry:{type:'LineString',coordinates:route.geometry},properties:{}};
  if(state.map.getSource('route'))state.map.getSource('route').setData(data);else{
    state.map.addSource('route',{type:'geojson',data});
    state.map.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':11,'line-opacity':.96}});
    state.map.addLayer({id:'route-main',type:'line',source:'route',paint:{'line-color':'#1677ff','line-width':7.5,'line-opacity':1}});
    // 진행방향 화살표를 경로선 위에 직접 배치한다. 줌에 따라 반복 간격을 조절해 복잡도를 낮춘다.
    state.map.addLayer({
      id:'route-direction-arrows',type:'symbol',source:'route',
      layout:{
        'symbol-placement':'line',
        'symbol-spacing':72,
        'text-field':'➤',
        'text-size':['interpolate',['linear'],['zoom'],12,15,15,18,18,21],
        'text-keep-upright':false,
        'text-rotation-alignment':'map',
        'text-pitch-alignment':'map',
        'text-allow-overlap':true,
        'text-ignore-placement':true
      },
      paint:{
        'text-color':'#ffffff',
        'text-halo-color':'#1677ff',
        'text-halo-width':2.8,
        'text-halo-blur':.2,
        'text-opacity':1
      }
    });
  }
  const traffic=buildTrafficGeoJson(route);
  if(state.map.getSource('route-traffic'))state.map.getSource('route-traffic').setData(traffic);else{
    state.map.addSource('route-traffic',{type:'geojson',data:traffic});
    state.map.addLayer({id:'route-traffic',type:'line',source:'route-traffic',paint:{'line-color':['get','color'],'line-width':5.2,'line-opacity':.96}});
  }
  // 교통상태 색상 경로선을 그린 뒤 방향 화살표를 최상단으로 올려
  // 화살표가 경로선 밑에 묻히지 않도록 한다.
  try{
    if(state.map.getLayer('route-direction-arrows'))state.map.moveLayer('route-direction-arrows');
  }catch(e){console.warn('route arrow layer order failed',e)}
  renderRouteEndpointLayers(route);
  // 레이어를 다시 추가/갱신한 뒤에도 도로 < 방향 화살표 < 카메라 < 끝점 심볼 순서를 보장.
  ensureRouteCameraStackOrder();
  if(fit)fitSelectedRoute(route);
}
function clearRouteLayer(){['dangollo-endpoint-pin-label','dangollo-endpoint-pin-icon','dangollo-endpoint-label','dangollo-endpoint-core','dangollo-endpoint-halo','route-direction-arrows','route-traffic','route-main','route-shadow'].forEach(id=>{if(state.map?.getLayer(id))state.map.removeLayer(id)});['dangollo-route-endpoints','route-traffic','route'].forEach(id=>{if(state.map?.getSource(id))state.map.removeSource(id)})}

/* ---------- LOCATION ---------- */
let dangolloLocationPending=null;
async function locate(fly=true){
  const recent=currentOriginPoint();
  if(pointValid(recent)&&Date.now()-Number(state.lastRawFix?.at||state.lastRealGpsAt||state.nativeLocationAt||0)<30000)return recent;
  if(state.permissionPrefs?.location===false){toast('MY에서 위치정보 조회 동의를 켜 주세요.');return null;}
  if(dangolloLocationPending)return dangolloLocationPending;
  dangolloLocationPending=(async()=>{
    // Native location and browser location run concurrently, not in sequence.
    const locationTask=refreshCurrentLocation({maxAgeMs:30000,timeoutMs:6500}).catch(()=>null);
    const fast=await locationTask;
    if(pointValid(fast)){
      if(fly&&state.map)state.map.easeTo({center:[fast.lng,fast.lat],zoom:16,duration:350});
      return fast;
    }
    if(!navigator.geolocation)return pointValid(currentOriginPoint())?currentOriginPoint():null;
    // Only one short follow-up, with a recently cached browser fix allowed.
    return await new Promise(resolve=>{
      navigator.geolocation.getCurrentPosition(
        pos=>{try{applyGps(pos,fly)}catch(e){console.warn('GPS apply failed',e)}resolve(currentOriginPoint())},
        err=>{console.warn('location unavailable',err?.code,err?.message);resolve(pointValid(currentOriginPoint())?currentOriginPoint():null)},
        {enableHighAccuracy:false,timeout:9000,maximumAge:30000}
      );
    });
  })().finally(()=>{dangolloLocationPending=null});
  return dangolloLocationPending;
}
/* ---------- 정지/출발 판정 (히스테리시스) ----------
   예전에는 GPS speed<=0.05 한 값만으로 정지/출발을 판정해서, 신호대기 중 speed 가 0.06~0.3 처럼 살짝만
   흔들려도 '출발'로 오인되어 캐릭터가 앞으로 기어갔다. 정지 진입은 STOP_ENTER_SPEED 이하,
   출발 해제는 STOP_EXIT_SPEED 이상(또는 앵커에서 충분히 이동)일 때만 한다. */
const STOP_ENTER_SPEED=0.5,STOP_EXIT_SPEED=1.0;
function stationaryAnchorDistance(){
  const a=finiteOrNull(state.driveMarkerRenderedDistance);if(a!=null)return a;
  const b=finiteOrNull(state.routeLockedDistance);if(b!=null)return b;
  return finiteOrNull(state.user?.routeDistance);
}
/* ---------- 휴대폰 가속도 센서(IMU) 기반 출발/정지 판단 ----------
   GPS만으로는 주차장·지하·고층 건물 사이에서 위치가 수십 m 흔들리거나 속도값이 튀어 '출발하지 않았는데
   출발한 것'으로 오인된다. 휴대폰 가속도(중력 제외)로 실제 차량 움직임(출발 가속·주행 진동)을 교차 확인한다.
   - 웹 DeviceMotion(안드로이드/iOS) 또는 네이티브 onMotionUpdate 값을 같은 창(10초)에 모은다.
   - 임계값(MOTION_*)은 일반 승용차 기준 초기값이며 차종/거치 방식에 따라 조정이 필요할 수 있다. */
const MOTION_WINDOW_MS=10000;
const MOTION_LAUNCH_PEAK=0.6,MOTION_LAUNCH_MIN_SAMPLES=4,MOTION_ACTIVE_RMS=0.18,MOTION_STILL_RMS=0.05,MOTION_STILL_PEAK=0.3;
state.motion=state.motion||{ready:false,at:0,samples:[],gx:null,gy:null,gz:null};
function pushMotionSample(mag,t=Date.now()){
  const m=state.motion;if(!Number.isFinite(mag))return;
  const last=m.samples[m.samples.length-1];if(last&&t-last.t<40)return;
  m.samples.push({t,mag});m.at=t;
  while(m.samples.length&&t-m.samples[0].t>MOTION_WINDOW_MS)m.samples.shift();
}
function onDeviceMotion(e){
  const t=Date.now(),m=state.motion;let ax,ay,az;
  const a=e.acceleration;
  if(a&&a.x!=null&&a.y!=null&&a.z!=null){ax=a.x;ay=a.y;az=a.z}
  else{
    const g=e.accelerationIncludingGravity;if(!g||g.x==null||g.y==null||g.z==null)return;
    // 중력 제외 값이 없는 기기: 저역통과로 중력을 추정해 빼 고역통과 가속도를 얻는다.
    if(m.gx==null){m.gx=g.x;m.gy=g.y;m.gz=g.z}
    m.gx=m.gx*.9+g.x*.1;m.gy=m.gy*.9+g.y*.1;m.gz=m.gz*.9+g.z*.1;
    ax=g.x-m.gx;ay=g.y-m.gy;az=g.z-m.gz;
  }
  pushMotionSample(Math.hypot(ax,ay,az),t);
}
function initMotionSensor(){
  if(state.motion.ready)return;state.motion.ready=true;
  try{window.addEventListener('devicemotion',onDeviceMotion,{passive:true})}catch(e){console.warn('devicemotion unavailable',e)}
}
async function requestMotionPermission(){
  initMotionSensor();
  try{if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function')await DeviceMotionEvent.requestPermission()}catch{}
}
function motionEvidence(now=Date.now()){
  const m=state.motion;
  if(!m||m.samples.length<8||now-m.at>2500)return{available:false,active:false,still:false,rms4:0,peak8:0};
  const win8=m.samples.filter(x=>now-x.t<=8000),win4=m.samples.filter(x=>now-x.t<=4000);
  const rms=arr=>arr.length?Math.sqrt(arr.reduce((acc,x)=>acc+x.mag*x.mag,0)/arr.length):0;
  const peak8=win8.reduce((p,x)=>Math.max(p,x.mag),0),peak4=win4.reduce((p,x)=>Math.max(p,x.mag),0),rms4=rms(win4),rms8=rms(win8);
  const launch=win8.filter(x=>x.mag>=MOTION_LAUNCH_PEAK).length>=MOTION_LAUNCH_MIN_SAMPLES;
  const cover=win4.length?now-win4[0].t:0;
  return{available:true,active:launch||rms8>=MOTION_ACTIVE_RMS,still:cover>=3000&&rms4<MOTION_STILL_RMS&&peak4<MOTION_STILL_PEAK,rms4,peak8};
}
/* 출발 판정: 안내를 시작한 뒤 실제로 출발하기 전까지 캐릭터는 절대 움직이지 않는다.
   GPS 이동 증거(속도 지속 또는 위치 이동 지속)에 휴대폰 가속도 증거가 함께 있어야 출발로 본다.
   - 가속도 센서가 '완전 정지'를 가리키면 GPS 위치 튐/속도 노이즈만으로는 절대 출발하지 않는다.
   - 가속도 센서를 쓸 수 없으면(미지원/권한 거부) GPS 증거를 더 길게 요구한다. */
try{initMotionSensor()}catch{}
function evaluateStartupStationary(rawLat,rawLng,reportedSpeed,accuracy=0){
  if(!(state.tripStartedAt&&!state.simulationActive&&!state.navigationStartReleased&&state.navigationStartAnchor))return false;
  const now=Date.now(),acc=Number(accuracy)||0;
  const anc=state.navigationStartAnchor;
  // 안내 시작 후 첫 수신: 시작 기준점이 오래된 위치였다면 첫 실측 위치로 기준점을 바로잡는다(이동으로 보지 않는다).
  if(!state.navigationStartFixed){
    state.navigationStartFixed=true;
    if(acc<=0||acc<=40){
      const d0=hav(Number(anc.lat),Number(anc.lng),rawLat,rawLng);
      if(Number.isFinite(d0)&&d0>12){
        state.navigationStartAnchor={...anc,lat:rawLat,lng:rawLng};
        if(state.stationaryGpsAnchor){state.stationaryGpsAnchor.lat=rawLat;state.stationaryGpsAnchor.lng=rawLng}
      }
    }
    state.stationaryActive=true;return true;
  }
  const a=state.navigationStartAnchor;
  const moved=hav(Number(a.lat),Number(a.lng),rawLat,rawLng),radius=Math.max(30,acc*1.8);
  const speedKnown=Number.isFinite(reportedSpeed);
  // 속도 증거: 2m/s(7km/h)↑가 지속되는지. 위치 증거: 기준점에서 radius↑ 벗어난 상태가 지속되는지.
  if(speedKnown&&reportedSpeed>=2.0){if(!state.departSpeedSince)state.departSpeedSince=now}
  else if(speedKnown&&reportedSpeed<1.0)state.departSpeedSince=0;
  if(moved>=radius){if(!state.departMoveSince)state.departMoveSince=now}
  else if(moved<radius*.7)state.departMoveSince=0;
  const speedMs=state.departSpeedSince?now-state.departSpeedSince:0,moveMs=state.departMoveSince?now-state.departMoveSince:0;
  const speedEvidence=speedMs>=1500,moveEvidence=moveMs>=2500;
  const gpsMove=speedEvidence||(moveEvidence&&speedMs>0)||(!speedKnown&&moveMs>=4000);
  const imu=motionEvidence(now);
  let release=false;
  if(gpsMove){
    if(!imu.available)release=true;                                                   // 센서 없음: GPS 증거(지속)만으로
    else if(imu.active)release=true;                                                  // 출발 가속/주행 진동 확인
    else if(!imu.still&&(speedMs>=5000||(speedEvidence&&Number(reportedSpeed)>=6&&speedMs>=2500)))release=true; // 센서가 애매해도 GPS가 충분히 강하면
    // 안전장치: 이미 달리는 중에 안내를 시작했거나 일정 속도로 부드럽게 순항하면 가속도가 거의 0이라 '정지'로 읽힐 수 있다.
    // 8m/s(29km/h)↑가 4초 이상 지속되고 기준점에서 60m↑ 이동했으면(주차 중 GPS 튐으로는 만들어지지 않음) 센서와 무관하게 출발로 본다.
    if(!release&&speedMs>=4000&&Number(reportedSpeed)>=8&&moved>=60)release=true;
  }
  state.departureDebug={moved:Math.round(moved),speedMs,moveMs,imu:imu.available?{active:imu.active,still:imu.still,rms4:+imu.rms4.toFixed(3)}:null,release};
  if(release){
    state.navigationStartReleased=true;state.navigationMoveConfirmHits=0;state.stationaryActive=false;state.stationaryGpsAnchor=null;
    state.departSpeedSince=0;state.departMoveSince=0;
    return false;
  }
  state.stationaryActive=true;return true;
}
function resolveStationaryLatch(rawLat,rawLng,speed,accuracy,now){
  if(!state.tripStartedAt||state.simulationActive)return false;
  const known=Number.isFinite(speed);
  const limit=Math.max(10,Math.min(25,(Number(accuracy)||0)*.8));
  const newAnchor=()=>({t:now,lat:rawLat,lng:rawLng,routeDistance:stationaryAnchorDistance()});
  let anchor=state.stationaryGpsAnchor;
  const anchorOk=Boolean(anchor&&Number.isFinite(Number(anchor.lat))&&Number.isFinite(Number(anchor.lng)));
  if(state.stationaryActive&&anchorOk){
    const drift=hav(Number(anchor.lat),Number(anchor.lng),rawLat,rawLng);
    if((known&&speed>=STOP_EXIT_SPEED)||(Number.isFinite(drift)&&drift>limit)){
      state.stationaryGpsAnchor=null;state.stationaryActive=false;return false;
    }
    return true;
  }
  if(state.stationaryActive&&!anchorOk&&!known){
    // 속도를 모르는데 정지 래치만 켜져 있고 앵커가 없으면 영원히 못 풀리므로 지금 위치를 앵커로 잡는다(이후 이동하면 풀림).
    state.stationaryGpsAnchor=newAnchor();return true;
  }
  if(!known)return false;
  if(speed>STOP_ENTER_SPEED){
    state.stationaryGpsAnchor=null;state.stationaryActive=false;return false;
  }
  if(!anchorOk)anchor=state.stationaryGpsAnchor=newAnchor();
  const drift=hav(Number(anchor.lat),Number(anchor.lng),rawLat,rawLng);
  if(Number.isFinite(drift)&&drift>limit){state.stationaryGpsAnchor=newAnchor();state.stationaryActive=false;return false}
  // 직전까지 달리던 차량은 속도 0 한 번으로 곧바로 정지 처리하지 않고 1.5초 확인 후 고정한다(1~2초씩 멈췄다 가는 현상 방지).
  const wasMoving=Number(state.user?.speed)>0.8&&!state.stationaryActive;
  if(wasMoving&&now-Number(anchor.t||0)<1500&&anchor.t)return false;
  state.stationaryActive=true;
  return true;
}
function applyGps(pos,fly=false){
  if(state.simulationActive)return;
  if(state.permissionPrefs?.location===false)return;
  const native=Boolean(pos?.native),now=Date.now();
  if(native){
    const c=pos.coords||pos,t=Number(pos.timestamp)||now;
    if(t<=Number(state.lastNativeSampleAt||0))return;
    const lat=Number(c.latitude??c.lat),lng=Number(c.longitude??c.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const prevRealAtN=Number(state.lastRealGpsAt)||0,prevWasEstimatedN=Boolean(state.gpsEstimated||state.user?.estimated);
    state.lastNativeSampleAt=t;state.nativeLocationAt=now;state.nativeLocationActive=true;
    const estimated=Boolean(pos.estimated);
    if(!estimated)state.lastRawFix={lat:pos.rawLatitude==null?lat:Number(pos.rawLatitude),lng:pos.rawLongitude==null?lng:Number(pos.rawLongitude),accuracy:Number(c.accuracy)||0,at:now};
    const rawLatN=pos.rawLatitude==null?lat:Number(pos.rawLatitude),rawLngN=pos.rawLongitude==null?lng:Number(pos.rawLongitude);
    // speed=null/undefined 는 '정지(0)'가 아니라 '알 수 없음'이다. 0으로 읽으면 주행 중 캐릭터가 멈춰 버린다.
    const speedKnownN=c.speed!=null&&c.speed!==''&&Number.isFinite(Number(c.speed));
    let nSpeed=speedKnownN?Number(c.speed):NaN;
    const prevN=state.lastNativeSpeedSample;
    if(!speedKnownN&&prevN&&t>prevN.t){
      const dtN=(t-prevN.t)/1000,distN=hav(prevN.lat,prevN.lng,lat,lng),jitN=Math.max(1.5,Math.min(6,((prevN.accuracy||0)+(Number(c.accuracy)||0))*.18));
      if(dtN>=.25&&dtN<=5&&Number.isFinite(distN))nSpeed=distN>=jitN?Math.min(70,distN/dtN):0;
    }
    state.lastNativeSpeedSample={lat,lng,t,accuracy:Number(c.accuracy)||0};
    if(!Number.isFinite(nSpeed))nSpeed=Number(state.lastRealSpeedMps)||0;
    // 안내 시작 정지 래치 해제와 정지/출발 판정을 네이티브 위치에도 동일하게 적용한다.
    // (이전에는 네이티브 경로에서 navigationStartReleased 가 영원히 false 라서 캐릭터가 출발 지점에 고정되는 문제가 있었다.)
    let forceN=false;
    if(!estimated){
      if(evaluateStartupStationary(rawLatN,rawLngN,speedKnownN?Number(c.speed):nSpeed,Number(c.accuracy)||0))forceN=true;
      else forceN=resolveStationaryLatch(rawLatN,rawLngN,nSpeed,Number(c.accuracy)||0,now);
    }else{state.stationaryGpsAnchor=null;state.stationaryActive=false}
    if(forceN)nSpeed=0;
    let nLat=lat,nLng=lng,nRouteDistance=finiteOrNull(pos.routeDistance),nRouteIndex=finiteOrNull(pos.routeIndex);
    if(state.tripStartedAt&&!estimated&&!state.simulationActive&&state.route?.geometry?.length){
      assessRealDriveDirection(rawLatN,rawLngN,c.heading, nSpeed,Number(c.accuracy)||0,now);
      const physical=routePosOfPoint(rawLngN,rawLatN,state.route.geometry,null,90);
      const rawDistanceValid=Boolean(physical&&physical.distance<=Math.max(35,Math.min(65,(Number(c.accuracy)||15)*1.7)));
      const physicalDistance=rawDistanceValid?finiteOrNull(physical.routeDistance):null;
      // 네이티브 엔진이 몇 km 앞의 경로 거리를 보냈더라도 실제 GNSS 투영값과 불일치하면 쓰지 않는다.
      const nativeProjectionMismatch=nRouteDistance!=null&&physicalDistance!=null&&Math.abs(nRouteDistance-physicalDistance)>Math.max(55,Math.min(110,(Number(c.accuracy)||15)*2.5));
      const impossibleForward=nRouteDistance!=null&&Number.isFinite(Number(state.routeLockedDistance))&&nRouteDistance-Number(state.routeLockedDistance)>Math.max(90,nSpeed*Math.max(1,(now-(state.lastGpsTickAt||now))/1000)*3+35);
      if(state.wrongDirectionActive||!rawDistanceValid||nativeProjectionMismatch||impossibleForward){
        state.user={lat:rawLatN,lng:rawLngN,rawLat:rawLatN,rawLng:rawLngN,speed:nSpeed,heading:c.heading,accuracy:Number(c.accuracy)||0,routeDistance:null,mapSnapped:false,estimated:false,native:true};
        clearUncertainGuidance();updateGpsEstimateUi();return;
      }
      state.drivePositionUncertain=false;
      state.userMarker?.getElement?.()?.classList.remove('dangollo-gps-unverified');
    }
    if(forceN&&state.route?.geometry?.length){
      let fd=finiteOrNull(state.stationaryGpsAnchor?.routeDistance);
      if(fd==null)fd=finiteOrNull(state.driveMarkerRenderedDistance);
      if(fd==null)fd=nRouteDistance;
      const fp=fd!=null?pointAtRouteDistance(fd):null;
      if(fp){nLat=fp.lat;nLng=fp.lng;nRouteDistance=fp.distance;nRouteIndex=fp.index;if(state.stationaryGpsAnchor)state.stationaryGpsAnchor.routeDistance=fp.distance}
    }
    state.user={lat:nLat,lng:nLng,rawLat:rawLatN,rawLng:rawLngN,
      speed:nSpeed,heading:c.heading==null?null:Number(c.heading),accuracy:Number(c.accuracy)||0,
      routeIndex:nRouteIndex,routeDistance:nRouteDistance,mapSnapped:nRouteDistance!=null,estimated,native:true};
    state.gpsEstimated=estimated;state.lastGpsTickAt=now;
    if(!estimated){
      state.lastRealGpsAt=now;state.lastRealSpeedMps=state.user.speed;
      state.speedEmaMps=forceN?0:(Number.isFinite(state.speedEmaMps)?state.speedEmaMps*.65+nSpeed*.35:nSpeed);
    }
    if(nRouteDistance!=null){
      state.deadReckoningDistance=nRouteDistance;
      if(Number.isFinite(Number(state.routeLockedDistance))||forceN)state.routeLockedDistance=nRouteDistance;
      // 터널 복귀/수신 공백(3.5초↑) 뒤 첫 유효 위치는 수신된 자리로 바로 옮긴다. 밀린 구간을 몰아서 채우지 않는다.
      if(state.tripStartedAt&&state.navigationStartReleased&&!estimated&&((prevWasEstimatedN)||(prevRealAtN&&now-prevRealAtN>3500))){
        state.driveMarkerRenderedDistance=nRouteDistance;state.driveMarkerTargetDistance=nRouteDistance;state.driveMarkerTargetAt=now;
        try{state.userMarker?.setLngLat([nLng,nLat])}catch{}
      }
    }
    updateGpsEstimateUi();ensureUserMarker();
    if(fly&&state.map)state.map.easeTo({center:[lng,lat],zoom:16,duration:500});
    if(!window.__JOFAMS_NATIVE_DRIVE_ACTIVE__&&state.route&&$('driveView')&&!$('driveView').classList.contains('hidden'))updateDriving();
    return;
  }
  const wasEstimated=Boolean(state.gpsEstimated||state.user?.estimated);
  const prevRealAt=Number(state.lastRealGpsAt)||0;
  if(!native&&state.nativeLocationAt&&now-state.nativeLocationAt<2200)return;

  const c=pos.coords||pos;
  // Android WebView는 속도를 모를 때 speed=null을 준다. Number(null)은 0이라 "정지"로 오인되어
  // 주행 중 캐릭터가 멈추는 원인이었다. null/undefined/NaN은 '알 수 없음'(NaN)으로 취급한다.
  const speedKnown=c.speed!=null&&c.speed!==''&&Number.isFinite(Number(c.speed));
  const stateObj={
    lng:Number(c.longitude??c.lng),lat:Number(c.latitude??c.lat),
    speed:speedKnown?Number(c.speed):NaN,heading:Number(c.heading),accuracy:Number(c.accuracy)||0,
    estimated:false,native
  };
  if(!pointValid(stateObj))return;
  /* 7.6.11.3 터널 출구 직후 정확도가 나쁜(70m↑) 첫 GPS 는 최대 8회까지 무시하고 추정 위치로 계속 안내한다.
     (부정확한 좌표로 경로 이탈·재탐색이 되는 것을 방지) */
  if(wasEstimated&&state.tripStartedAt&&!state.simulationActive){
    if((Number(stateObj.accuracy)||0)>70){state.postTunnelBadFixes=(Number(state.postTunnelBadFixes)||0)+1;if(state.postTunnelBadFixes<=8)return}
    else state.postTunnelBadFixes=0;
  }else state.postTunnelBadFixes=0;

  const rawLat=stateObj.lat,rawLng=stateObj.lng,sampleTime=Number(pos?.timestamp)||now;
  state.lastRawFix={lat:rawLat,lng:rawLng,accuracy:stateObj.accuracy,at:now};
  /* 7.6.11.3 운행(경로 안내) 시작 전에는 GPS 흔들림만으로 차량 캐릭터가 스물스물 움직이지 않게 고정한다.
     마지막으로 받아들인 위치에서 max(25m, 정확도×1.6) 이내이고, 실제 이동 속도(1.8m/s↑)가 2회 연속 확인되지 않으면 갱신하지 않는다. */
  if(!state.tripStartedAt&&!state.simulationActive){
    const anc=state.preTripAnchor,spdNow=Number(c.speed),accNow=Number(c.accuracy)||0;
    if(anc&&pointValid(anc)&&pointValid(state.user)){
      const moved=hav(anc.lat,anc.lng,rawLat,rawLng),radius=Math.max(25,Math.min(80,accNow*1.6));
      state.preTripMoveHits=(Number.isFinite(spdNow)&&spdNow>=1.8)?(Number(state.preTripMoveHits)||0)+1:0;
      // 가속도 센서가 '완전 정지'를 가리키면(속도 5m/s 미만) GPS 위치가 튀어도 출발 전 캐릭터를 움직이지 않는다.
      const imuP=motionEvidence(),stillVeto=imuP.available&&imuP.still&&!(Number.isFinite(spdNow)&&spdNow>=5);
      if((moved<radius&&state.preTripMoveHits<2)||stillVeto){
        if(fly&&state.map)state.map.easeTo({center:[state.user.lng,state.user.lat],zoom:16,duration:500});
        return;
      }
    }
    state.preTripAnchor={lat:rawLat,lng:rawLng};state.preTripMoveHits=0;
  }
  const reportedSpeed=speedKnown?Number(c.speed):NaN;
  // GPS 좌표 변화로 계산한 파생 속도(속도값이 없거나 부정확할 때 보조로 사용)
  let derivedSpeed=NaN;
  const prevSpeedSample=state.lastSpeedSample;
  if(prevSpeedSample&&sampleTime>prevSpeedSample.t){
    const dtS=(sampleTime-prevSpeedSample.t)/1000;
    const distS=hav(prevSpeedSample.lat,prevSpeedSample.lng,stateObj.lat,stateObj.lng);
    if(dtS>=.25&&dtS<=5&&Number.isFinite(distS)){
      const jitter=Math.max(1.5,Math.min(6,((prevSpeedSample.accuracy||0)+(stateObj.accuracy||0))*.18));
      derivedSpeed=distS>=jitter?Math.min(70,distS/dtS):(distS<1.5?0:NaN);
    }
  }
  // 안내 시작 직후 실제 차량이 움직이지 않았는데 GPS 흔들림만으로 캐릭터가 앞서가는 현상을 방지한다.
  const startupStationary=evaluateStartupStationary(rawLat,rawLng,Number.isFinite(reportedSpeed)?reportedSpeed:derivedSpeed,stateObj.accuracy);
  if(startupStationary)stateObj.speed=0;
  // 신호가 약해지는 순간에는 GPS 정확도가 함께 급격히 나빠지는 경우가 대부분이다(위성 가림).
  // 이름 기반 터널 인식에만 의존하지 않도록 정확도가 뚜렷하게 나쁠 때(60m↑)도 같은 신호저하 상황으로 본다.
  // 단, '직전까지 달리다가 갑자기 0'이 된 경우(또는 이미 추정 중인 경우)만 신호 상실로 본다.
  // 감속하며 천천히 0이 된 것은 실제 정지(신호대기)이므로 추정 주행을 시작하지 않는다.
  // (예전에는 터널/저정확도 구간의 실제 정지도 추정 주행 → 멈추지 않고 계속 전진하는 원인이었다.)
  const accuracyDegraded=Number.isFinite(stateObj.accuracy)&&stateObj.accuracy>=60;
  const priorShownSpeed=wasEstimated?0:Math.max(0,Number(state.user?.speed)||0);
  const abruptZero=wasEstimated||priorShownSpeed>=4.5;
  const tunnelZeroGps=Boolean(
    state.tripStartedAt &&
    Number.isFinite(reportedSpeed) && reportedSpeed<=0.05 && abruptZero &&
    (state.tunnelRouteLock?.active||tunnelBoundsAtIndex(state.currentRouteIndex)||accuracyDegraded)
  );
  let forceStationary=false;
  if(startupStationary){
    forceStationary=true;
  }else if(tunnelZeroGps){
    state.stationaryGpsAnchor=null;
    state.stationaryActive=false;
  }else{
    const speedForStop=Number.isFinite(reportedSpeed)?reportedSpeed:derivedSpeed;
    forceStationary=resolveStationaryLatch(rawLat,rawLng,speedForStop,stateObj.accuracy,now);
  }
  if(forceStationary)stateObj.speed=0;
  else{
    if(Number.isFinite(derivedSpeed)&&(!Number.isFinite(stateObj.speed)||(stateObj.speed<.7&&derivedSpeed>=.7)))stateObj.speed=derivedSpeed;
    else if(Number.isFinite(derivedSpeed)&&Number.isFinite(stateObj.speed)&&stateObj.speed>=.7)stateObj.speed=stateObj.speed*.78+derivedSpeed*.22;
  }
  if(tunnelZeroGps){
    stateObj.speed=Math.max(
      2.5,
      Number(state.tunnelEntrySpeedMps)||0,
      Number(state.lastRealSpeedMps)||0,
      Number(state.user?.speed)||0
    );
  }

  state.lastSpeedSample={lat:stateObj.lat,lng:stateObj.lng,t:sampleTime,accuracy:stateObj.accuracy};
  if(state.tripStartedAt&&now-sampleTime>4500)return;

  if(forceStationary)state.lastRealSpeedMps=0;
  else if(Number.isFinite(stateObj.speed)&&stateObj.speed>=0)state.lastRealSpeedMps=stateObj.speed;
  /* 7.6.11.3 터널 진입 직전 순간속도 대신 최근 속도의 지수평균을 추정 주행의 기준 속도로 쓴다. */
  if(forceStationary)state.speedEmaMps=0;
  else if(!tunnelZeroGps&&Number.isFinite(stateObj.speed)&&stateObj.speed>=0)state.speedEmaMps=Number.isFinite(state.speedEmaMps)?state.speedEmaMps*.65+stateObj.speed*.35:stateObj.speed;
  if(Number.isFinite(stateObj.heading))state.lastRealHeading=stateObj.heading;
  if(!tunnelZeroGps)state.lastRealGpsAt=now;
  state.lastGpsTickAt=now;state.deadReckoningLastAt=now;state.gpsEstimated=Boolean(tunnelZeroGps);
  updateGpsEstimateUi();
  if(wasEstimated&&!state.gpsEstimated&&state.tunnelDrSpoken){state.tunnelDrSpoken=false;speakNavOnce(`tunnel-exit:${Math.floor(now/1000)}`,'터널을 벗어났습니다. 위치를 다시 확인했습니다.',0)}
  if(!Number.isFinite(stateObj.speed))stateObj.speed=state.lastRealSpeedMps||0;
  if(!Number.isFinite(stateObj.heading))stateObj.heading=state.lastRealHeading;

  // 원시 GPS는 반드시 보존: 실제 이탈 판정/도착 판정에 사용.
  stateObj.rawLat=rawLat;stateObj.rawLng=rawLng;

  let snapInfo=null;
  if(state.tripStartedAt&&state.route?.geometry?.length){
    assessRealDriveDirection(rawLat,rawLng,stateObj.heading,stateObj.speed,stateObj.accuracy,now);
    if(state.wrongDirectionActive){
      stateObj.lat=rawLat;stateObj.lng=rawLng;stateObj.mapSnapped=false;
      stateObj.routeDistance=null;stateObj.routeIndex=null;
      state.user=stateObj;clearUncertainGuidance();updateGpsEstimateUi();
      return;
    }
    // 주행 화면 위치는 항상 현재 경로에 강제 스냅.
    // 터널 복귀/수신 공백(3.5초↑) 뒤 첫 유효 GPS 는 수신된 그 자리에서 바로 시작한다.
    // (예전에는 DR 위치 + 소폭으로 제한한 뒤 밀린 구간을 빠르게 몰아서 채웠다.)
    const waitingToDepart=Boolean(state.tripStartedAt&&!state.navigationStartReleased&&!state.simulationActive);
    const needResync=Boolean(!tunnelZeroGps&&!waitingToDepart&&(wasEstimated||state.resyncPending||(prevRealAt&&now-prevRealAt>3500)));
    const locked=lockDisplayPositionToRoute(stateObj,now,{resync:needResync});
    if(locked){
      state.resyncPending=false;
      state.drivePositionUncertain=false;
      state.userMarker?.getElement?.()?.classList.remove('dangollo-gps-unverified');
      if(locked.snap)snapInfo=locked;
      if(forceStationary&&locked.snap&&state.stationaryGpsAnchor)state.stationaryGpsAnchor.routeDistance=locked.distance;
      if(forceStationary&&!locked.snap){
        let fixedDistance=Number(state.stationaryGpsAnchor?.routeDistance);
        if(!Number.isFinite(fixedDistance))fixedDistance=Number(state.driveMarkerRenderedDistance);
        if(!Number.isFinite(fixedDistance))fixedDistance=Number(state.routeLockedDistance);
        if(!Number.isFinite(fixedDistance))fixedDistance=Number(locked.distance);
        const fixed=pointAtRouteDistance(fixedDistance);
        if(fixed){
          locked.lng=fixed.lng;locked.lat=fixed.lat;locked.heading=fixed.heading;
          locked.index=fixed.index;locked.distance=fixed.distance;
          if(state.stationaryGpsAnchor)state.stationaryGpsAnchor.routeDistance=fixed.distance;
          state.routeLockedDistance=fixed.distance;
          state.routeLockedAt=now;
        }
      }
      stateObj.lng=locked.lng;stateObj.lat=locked.lat;stateObj.heading=locked.heading;
      stateObj.mapSnapped=true;stateObj.routeIndex=locked.index;stateObj.routeDistance=locked.distance;
      stateObj.matchConfidence=Number(locked.confidence)||0;
    }else{
      stateObj.lng=rawLng;stateObj.lat=rawLat;stateObj.mapSnapped=false;
      stateObj.routeIndex=null;stateObj.routeDistance=null;stateObj.matchConfidence=0;
      state.user=stateObj;clearUncertainGuidance();updateGpsEstimateUi();
      return;
      const fused=fuseGpsFix({lat:rawLat,lng:rawLng,heading:stateObj.heading,speed:stateObj.speed,accuracy:stateObj.accuracy},now);
      stateObj.lng=fused.lng;stateObj.lat=fused.lat;
      if(Number.isFinite(fused.heading))stateObj.heading=fused.heading;
      stateObj.mapSnapped=Boolean(fused.mapSnapped);
      stateObj.routeIndex=Number.isFinite(fused.routeIndex)?fused.routeIndex:null;
      let fusedRd=Number.isFinite(fused.routeDistance)?fused.routeDistance:null;
      const prevLocked=Number(state.routeLockedDistance);
      if(fusedRd!=null&&Number.isFinite(prevLocked)){
        // 경로 잠금이 실패한 틱에도 캐릭터 진행거리가 뒤로 가거나 한 번에 튀지 않게 같은 규칙으로 제한한다.
        const dtF=Math.max(.25,Math.min(2.5,(now-(state.routeLockedAt||now-500))/1000));
        fusedRd=Math.max(prevLocked,Math.min(fusedRd,prevLocked+Math.max(22,(Number(stateObj.speed)||0)*dtF*2.8+14)));
        state.routeLockedDistance=fusedRd;state.routeLockedAt=now;
      }
      stateObj.routeDistance=fusedRd;
      stateObj.matchConfidence=Number(fused.matchConfidence)||0;
    }
  }else{
    const fused=fuseGpsFix({lat:rawLat,lng:rawLng,heading:stateObj.heading,speed:stateObj.speed,accuracy:stateObj.accuracy},now);
    stateObj.lng=fused.lng;stateObj.lat=fused.lat;
    if(Number.isFinite(fused.heading))stateObj.heading=fused.heading;
    stateObj.mapSnapped=Boolean(fused.mapSnapped);
    stateObj.routeIndex=Number.isFinite(fused.routeIndex)?fused.routeIndex:null;
    stateObj.routeDistance=Number.isFinite(fused.routeDistance)?fused.routeDistance:null;
    stateObj.matchConfidence=Number(fused.matchConfidence)||0;
  }

  if(forceStationary){
    stateObj.speed=0;
    stateObj.estimated=false;
  }
  state.user=stateObj;
  if(snapInfo&&Number.isFinite(stateObj.routeDistance)){
    // 수신된 그 자리에서 바로 출발: 보간(따라잡기) 없이 렌더링/목표 거리를 함께 맞춘다.
    state.driveMarkerRenderedDistance=stateObj.routeDistance;
    state.driveMarkerTargetDistance=stateObj.routeDistance;
    state.driveMarkerTargetAt=now;
    try{state.userMarker?.setLngLat([stateObj.lng,stateObj.lat])}catch{}
  }
  if(Number.isFinite(stateObj.routeDistance))state.deadReckoningDistance=stateObj.routeDistance;
  else if(state.route?.geometry?.length&&state.routeCumulative?.length){
    const idx=nearestIndex(stateObj.lng,stateObj.lat,state.route.geometry);
    state.deadReckoningDistance=Number(state.routeCumulative[idx])||0;
  }else state.deadReckoningDistance=null;

  ensureUserMarker();
  if(fly)state.map.easeTo({center:[stateObj.lng,stateObj.lat],zoom:16,duration:500});
  if(state.route&&$('driveView')&&!$('driveView').classList.contains('hidden'))updateDriving();
}
function pointAtRouteDistance(target){
  const g=state.route?.geometry||[],cum=state.routeCumulative||[];if(!g.length||!cum.length)return null;
  const total=cum.at(-1)||0,t=Math.max(0,Math.min(total,target));let lo=0,hi=cum.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<t)lo=mid+1;else hi=mid}
  const i=Math.max(1,lo),a=cum[i-1],b=cum[i],r=b>a?(t-a)/(b-a):0,p0=g[i-1],p1=g[i];
  return{lng:p0[0]+(p1[0]-p0[0])*r,lat:p0[1]+(p1[1]-p0[1])*r,index:i,heading:bearing(p0[1],p0[0],p1[1],p1[0]),distance:t};
}

function tunnelBoundsAtIndex(idx){
  const segs=state.route?.roadSegments||[];
  let hit=segs.find(seg=>idx>=Number(seg.startIndex)&&idx<=Number(seg.endIndex)&&/터널|tunnel/i.test(String(seg.name||'')));
  if(!hit)return null;
  let start=Number(hit.startIndex)||idx,end=Number(hit.endIndex)||idx;
  // 같은 터널명/연속 터널 세그먼트가 잘게 나뉜 경우 하나의 구간으로 합친다.
  const name=normalizeRoadName(hit.name||'');
  for(const seg of segs){
    const segName=normalizeRoadName(seg.name||'');
    if(!/터널|tunnel/i.test(String(seg.name||'')))continue;
    const near=Number(seg.startIndex)<=end+4&&Number(seg.endIndex)>=start-4;
    const same=!name||!segName||segName===name||segName.includes(name)||name.includes(segName);
    if(near&&same){start=Math.min(start,Number(seg.startIndex)||start);end=Math.max(end,Number(seg.endIndex)||end)}
  }
  return{startIndex:start,endIndex:end,name:hit.name||'터널'};
}
function updateTunnelRouteLock(idx){
  const now=Date.now(),bounds=tunnelBoundsAtIndex(idx),lock=state.tunnelRouteLock;
  if(bounds){
    if(!lock.active||lock.startIndex!==bounds.startIndex||lock.endIndex!==bounds.endIndex){
      lock.active=true;lock.startIndex=bounds.startIndex;lock.endIndex=bounds.endIndex;
      lock.routeDistance=Number(state.user?.routeDistance);
      if(!Number.isFinite(lock.routeDistance))lock.routeDistance=state.routeCumulative[idx]||0;
      lock.lastAt=now;
    }
    return lock;
  }
  if(lock.active&&idx>lock.endIndex+2){
    lock.active=false;lock.startIndex=-1;lock.endIndex=-1;lock.routeDistance=null;lock.lastAt=0;
  }
  return lock.active?lock:null;
}
function forceTunnelPointOnRoute(speedMps,now=Date.now(),hintDistance=null){
  const lock=state.tunnelRouteLock;if(!lock?.active)return null;
  const lastAt=lock.lastAt||now,dt=Math.max(0,Math.min(2.5,(now-lastAt)/1000)),cum=state.routeCumulative||[];
  const minD=Number(lock.routeDistance)||Number(cum[lock.startIndex])||0,maxD=Number(cum[lock.endIndex])||minD;
  let target=minD+Math.max(0,Number(speedMps)||0)*dt;
  if(Number.isFinite(hintDistance)){
    // 실제 GNSS가 터널 안에서 흔들려도 진행방향은 전진만 허용하고 한 틱에 과도하게 점프하지 않는다.
    const maxJump=Math.max(18,Math.max(0,Number(speedMps)||0)*Math.max(.5,dt)*2.2);
    target=Math.max(target,Math.min(Math.max(minD,hintDistance),minD+maxJump));
  }
  target=Math.max(minD,Math.min(maxD,target));
  const p=pointAtRouteDistance(target);if(!p)return null;
  lock.routeDistance=target;lock.lastAt=now;
  return p;
}
function simulatedTunnelSpeedMps(idx,baseSpeed){
  const seg=(state.route?.roadSegments||[]).find(s=>idx>=Number(s.startIndex)&&idx<=Number(s.endIndex));
  const trafficKmh=Number(seg?.trafficSpeed);
  const trafficMps=Number.isFinite(trafficKmh)&&trafficKmh>0?trafficKmh/3.6:null;
  const entry=Math.max(0,Number(state.tunnelEntrySpeedMps)||Number(baseSpeed)||0);
  if(Number.isFinite(trafficMps)){
    // 터널 진입 직전 실차속도 65% + 같은 도로 ITS 교통흐름 35%
    return Math.max(0,Math.min(55,entry*.65+trafficMps*.35));
  }
  return entry;
}

function deadReckoningTick(){
  // 네이티브가 위치(실측/추정)를 계속 보내는 동안에는 네이티브가 담당하고, 2.5초 넘게 침묵하면
  // (터널·네이티브 추정 실패) 웹 추정 주행이 이어받는다. 예전에는 앱에서 무조건 return 해서 터널에서 멈췄다.
  if(nativeBridgeAvailable()&&!state.simulationActive&&Date.now()-Number(state.nativeLocationAt||0)<2500)return;
  if(!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative.length||!state.user)return;
  const now=Date.now(),sinceReal=now-(state.lastRealGpsAt||0);
  if(!state.simulationActive&&!state.navigationStartReleased){
    state.deadReckoningLastAt=now;
    state.user.speed=0;
    state.lastRealSpeedMps=0;
    updateUserMarkerMotion();
    return;
  }
  // 실제 정지 상태에서는 마지막 주행속도를 재사용한 추정주행을 절대 시작하지 않는다.
  // 주의: 이 조건은 반드시 이 함수가 스스로 덮어쓰지 않는 값(speedEmaMps/lastRealSpeedMps)으로
  // 판단해야 한다. 예전에는 state.user.speed를 검사했는데, 이 값은 바로 아래에서 이 함수가
  // 매번 0으로 다시 써버리는 값이라 한 번이라도 0으로 찍히면(터널 진입 직전 위성 신호가
  // 약해지며 GPS 속도가 순간적으로 0에 가깝게 튀는 경우가 흔함) 다음 틱에도 계속 0으로만
  // 보여 "터널에 들어가면 캐릭터가 멈춰버리는" 현상이 발생했다.
  const priorMovingSpeed=Math.max(0,Number(state.speedEmaMps)||Number(state.lastRealSpeedMps)||0);
  if(state.stationaryActive||priorMovingSpeed<=0.05){
    state.deadReckoningLastAt=now;
    state.lastRealSpeedMps=0;
    state.user.speed=0;
    updateUserMarkerMotion();
    return;
  }
  /* 7.6.11.3 알려진 터널 안에서는 3분 제한 대신 최대 25분까지 추정 주행을 유지한다(장거리 터널 대응). */
  const inKnownTunnel=Boolean(state.tunnelRouteLock?.active||tunnelBoundsAtIndex(state.currentRouteIndex));
  if(sinceReal<2500||sinceReal>(inKnownTunnel?1500000:180000))return;

  const startingEstimate=!state.gpsEstimated;
  if(!state.gpsEstimated){
    state.tunnelEntrySpeedMps=Math.max(0,Number(state.speedEmaMps)||Number(state.lastRealSpeedMps)||Number(state.user.speed)||0);
    state.tunnelEntryAt=now;
  }
  let speed=simulatedTunnelSpeedMps(state.currentRouteIndex,Number(state.speedEmaMps)||Number(state.lastRealSpeedMps)||Number(state.user.speed)||0);
  try{ // 터널 안 추정 속도는 해당 도로 제한속도를 넘지 않게 한다.
    const lim=Number(effectiveSpeedLimit(state.currentRouteIndex,roadSegmentAtIndex(state.currentRouteIndex)));
    if(Number.isFinite(lim)&&lim>0)speed=Math.min(speed,lim/3.6*1.03);
  }catch{}
  const imuFresh=state.imu&&now-state.imu.at<1200;
  if(imuFresh&&Number.isFinite(Number(state.imu.longitudinalAccelMps2))){
    const measured=Math.max(-2.5,Math.min(2.5,Number(state.imu.longitudinalAccelMps2)));
    speed=Math.max(0,Math.min(55,speed+measured*.5));
  } // 가속도 크기(진동)를 직진 가속도로 오인하지 않는다.

  if(speed<.35){state.deadReckoningLastAt=now;state.user.speed=0;updateUserMarkerMotion();return}

  const last=state.deadReckoningLastAt||state.lastGpsTickAt||now;
  const dt=Math.min(1.0,Math.max(.15,(now-last)/1000));
  state.deadReckoningLastAt=now;state.lastGpsTickAt=now;

  if(!Number.isFinite(state.deadReckoningDistance)){
    const idx=Math.max(0,nearestIndex(state.user.lng,state.user.lat,state.route.geometry));
    state.deadReckoningDistance=Number(state.routeCumulative[idx])||0;
  }
  updateTunnelRouteLock(state.currentRouteIndex);
  if(startingEstimate){
    // 추정 주행은 화면에 '이미 그려진' 캐릭터 위치에서 이어서 시작한다. 마지막 GPS 지점에서 시작하면
    // (마커는 수신 간격 보간으로 최대 1.6초분 앞서 있으므로) 시작 순간 캐릭터가 뒤로 되돌아간다.
    const shown=finiteOrNull(state.driveMarkerRenderedDistance);
    if(shown!=null){
      if(!Number.isFinite(state.deadReckoningDistance)||shown>state.deadReckoningDistance)state.deadReckoningDistance=shown;
      if(state.tunnelRouteLock?.active&&shown>(Number(state.tunnelRouteLock.routeDistance)||0))state.tunnelRouteLock.routeDistance=shown;
    }
  }
  state.deadReckoningDistance=Math.min(state.routeCumulative.at(-1)||Infinity,state.deadReckoningDistance+speed*dt);

  let p=state.tunnelRouteLock?.active?forceTunnelPointOnRoute(speed,now,state.deadReckoningDistance):pointAtRouteDistance(state.deadReckoningDistance);
  if(!p)return;
  if(!state.tunnelRouteLock?.active&&imuFresh&&Math.abs(Number(state.imu.yawRateDegS)||0)>4){
    p.heading=circularLerp(p.heading,(Number(state.user.heading)||p.heading)+(Number(state.imu.yawRateDegS)||0)*dt,.10);
  }

  state.currentRouteIndex=p.index;
  state.user={...state.user,lng:p.lng,lat:p.lat,speed,heading:p.heading,routeIndex:p.index,routeDistance:p.distance,accuracy:Math.max(45,Number(state.user.accuracy)||0),estimated:true};
  state.gpsEstimated=true;
  updateGpsEstimateUi();
  if(state.tunnelRouteLock?.active&&!state.tunnelDrSpoken){state.tunnelDrSpoken=true;speakNavOnce(`tunnel-dr:${state.tunnelRouteLock.startIndex}`,'터널 안입니다. 위성 신호가 약해 예상 위치로 안내합니다.',30000)}

  // DR 진행거리를 실제 경로 잠금 기준에도 즉시 반영하여, 터널 탈출 후 '밀린 거리 따라잡기'를 없앤다.
  state.routeLockedDistance=p.distance;
  state.routeLockedAt=now;
  state.mapMatch={...(state.mapMatch||{}),index:p.index,routeDistance:p.distance,at:now};
  state.gpsFix.lat=p.lat;state.gpsFix.lng=p.lng;state.gpsFix.headingDeg=p.heading;state.gpsFix.speedMps=speed;state.gpsFix.at=now;

  ensureUserMarker();
  updateDriving(false);
  if(now-state.lastDeadReckoningNoticeAt>30000){
    state.lastDeadReckoningNoticeAt=now;
    toast('GPS 신호 없음 · 터널 진입 속도와 교통흐름으로 주행 위치를 추정합니다.',2200);
  }
}
function updateGpsEstimateUi(){
  const dv=$('driveView');if(!dv)return;
  const v=state.gpsEstimated?(state.tunnelRouteLock?.active?'tunnel':'est'):'';
  if(v){if(dv.dataset.gps!==v)dv.dataset.gps=v}else if(dv.dataset.gps)delete dv.dataset.gps;
}
/* 7.6.11.3 전방 터널 사전 안내: 터널 시작 650m 이내에서 한 번(터널별) 알려준다. */
function announceTunnelAhead(idx){
  if(!state.tripStartedAt||state.tunnelRouteLock?.active||tunnelBoundsAtIndex(idx))return;
  const segs=state.route?.roadSegments||[],cum=state.routeCumulative||[],now=currentRouteDistanceAt(idx);
  for(const seg of segs){
    if(!/터널|tunnel/i.test(String(seg.name||'')))continue;
    const s=Number(seg.startIndex);if(!Number.isFinite(s)||s<idx)continue;
    const d=(Number(cum[s])||0)-now;
    if(d<0||d>650)return;
    const b=tunnelBoundsAtIndex(s);
    speakNavOnce(`tunnel-ahead:${b?.startIndex??s}`,'전방 터널입니다. 터널 안에서 위성 신호가 끊겨도 예상 위치로 계속 안내합니다.',20000);
    return;
  }
}
function startDeadReckoning(){clearInterval(state.deadReckoningTimer);state.deadReckoningLastAt=Date.now();state.deadReckoningTimer=setInterval(deadReckoningTick,500)}
function stopDeadReckoning(){clearInterval(state.deadReckoningTimer);state.deadReckoningTimer=0;state.gpsEstimated=false;updateGpsEstimateUi();state.deadReckoningDistance=null;state.deadReckoningLastAt=0}
let dangolloGpsHealthTimer=0;
let dangolloWatchFallback=false;
function recoverDangolloLocationWatch(){
  if(state.simulationActive||!state.tripStartedAt||state.permissionPrefs?.location===false)return;
  const age=Date.now()-Number(state.lastRealGpsAt||state.lastRawFix?.at||0);
  // Weak GNSS does not remove the vehicle. Keep last verified route position, clearly marked as uncertain.
  if(age>4500){
    ensureUserMarker();
    const el=state.userMarker?.getElement?.();
    if(el){el.style.visibility='visible';el.style.display='block';el.style.opacity='1';el.classList.add('dangollo-gps-unverified')}
  }
  if(dangolloWatchFallback && age>8000){
    // Retry high accuracy periodically: low-accuracy fallback must not remain permanent.
    if(state.watchId!=null){try{navigator.geolocation.clearWatch(state.watchId)}catch{}state.watchId=null}
    dangolloWatchFallback=false;
    startWatch();
  }
  ensureActiveRouteOverlay();
}
function ensureActiveRouteOverlay(){
  if(!state.tripStartedAt||!state.route?.geometry?.length||!state.map||state.simulationActive)return;
  const now=Date.now();if(now-Number(state.driveRouteHealthAt||0)<1800)return;
  state.driveRouteHealthAt=now;
  try{
    if(!state.map.isStyleLoaded?.()){state.pendingRouteDraw={route:state.route,options:{fit:false}};return}
    if(!state.map.getSource('route')||!state.map.getLayer('route-main')||!state.map.getLayer('route-shadow'))drawRoute(state.route,{fit:false});
    else for(const id of ['route-shadow','route-main','route-traffic','route-direction-arrows']){
      if(state.map.getLayer(id)&&state.map.getLayoutProperty(id,'visibility')==='none')state.map.setLayoutProperty(id,'visibility','visible');
    }
  }catch(e){console.warn('[GPS] route overlay recovery',e)}
}
function startWatch(){
  if(state.permissionPrefs?.location===false)return;
  if(nativeBridgeAvailable())setNativeNavigationActive(true);
  if(state.watchId!=null)return;
  if(!dangolloGpsHealthTimer)dangolloGpsHealthTimer=setInterval(recoverDangolloLocationWatch,2200);
  if(!navigator.geolocation){console.warn('[GPS] geolocation API unavailable');return;}
  const watchError=(err)=>{
    console.warn('[GPS] watchPosition failed',err?.code,err?.message);
    if(err?.code===3 && state.watchId!=null){
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId=null;
      dangolloWatchFallback=true;
      // Use a less restrictive fix when high-accuracy GPS times out indoors.
      state.watchId=navigator.geolocation.watchPosition(p=>applyGps(p,false),
        e=>console.warn('[GPS] fallback watch failed',e?.code,e?.message),
        {enableHighAccuracy:false,maximumAge:30000,timeout:20000});
    }
  };
  dangolloWatchFallback=false;
  state.watchId=navigator.geolocation.watchPosition(p=>applyGps(p,false),watchError,
    {enableHighAccuracy:true,maximumAge:10000,timeout:15000});
  startDeadReckoning();
}
function stopWatch(){clearInterval(dangolloGpsHealthTimer);dangolloGpsHealthTimer=0;dangolloWatchFallback=false;if(nativeBridgeAvailable())setNativeNavigationActive(false);if(state.watchId!=null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null}state.nativeLocationActive=false;stopDeadReckoning()}


/* ---------- LIVE FUEL PRICE / OPINET ---------- */
const FUEL_PRODUCT_NAMES={B027:'휘발유',D047:'경유',B034:'고급휘발유',K015:'LPG'};
// Each product/location keeps its own last good list. Never display petrol prices in a diesel/LPG tab.
const fuelProductCache=new Map();
function fuelCacheKey(product,origin){
  if(!pointValid(origin))return null;
  return `${product}:${Math.round(Number(origin.lat)*1000)}:${Math.round(Number(origin.lng)*1000)}`;
}
function usableFuelCache(product,origin,maxAge=15*60*1000){
  const entry=fuelProductCache.get(fuelCacheKey(product,origin));
  return entry&&Date.now()-entry.at<maxAge?entry.data:null;
}

function fuelWon(v){const n=Number(v);return Number.isFinite(n)&&n>0?`${Math.round(n).toLocaleString('ko-KR')}원`:'가격없음'}
function fuelBrandName(code){
  return ({SKE:'SK',GSC:'GS칼텍스',HDO:'HD현대오일뱅크',SOL:'S-OIL',RTE:'알뜰',RTX:'고속도로알뜰',NHO:'농협알뜰',ETC:'자가상표',E1G:'E1',SKG:'SK가스'})[code]||code||'';
}
function fuelFreshEnough(){
  // A recently fetched price list belongs to its original search location.
  // Navigating to another district must invalidate it without a hard reload.
  const here=currentOriginPoint(),anchor=state.fuelFetchedOrigin;
  if(pointValid(here)&&pointValid(anchor)){
    const latDelta=(Number(here.lat)-Number(anchor.lat))*111200;
    const lngDelta=(Number(here.lng)-Number(anchor.lng))*111200*Math.cos(Number(here.lat)*Math.PI/180);
    if(Math.hypot(latDelta,lngDelta)>1300)return false;
  }
  if(!(state.fuelData&&Date.now()-Number(state.fuelFetchedAt||0)<5*60*1000))return false;
  // 주행 중에는 조회 시점보다 3km 이상 진행했으면 앞쪽 구간 주유소를 다시 조회한다.
  if(state.tripStartedAt&&state.route?.geometry?.length){
    const moved=currentRouteDistanceAt(state.currentRouteIndex||0)-Number(state.fuelFetchedRouteM||0);
    if(!(moved<3000))return false;
  }
  return true;
}
/* 주행 중 유가 칩/목록은 '앞으로 달릴 경로 위(양옆 120m 이내)'에 있는 주유소만 대상으로 한다. */
function scopeFuelToRoute(stations){
  const g=state.route?.geometry;
  if(!state.tripStartedAt||!g?.length)return stations||[];
  const liveMatch=pointValid(state.user)?routePosOfPoint(Number(state.user.lng),Number(state.user.lat),g,null,200):null;
  const cur=Number.isFinite(Number(liveMatch?.routeDistance))?Number(liveMatch.routeDistance):currentRouteDistanceAt(state.currentRouteIndex||0),out=[];
  for(const x of stations||[]){
    const lng=Number(x.lng??x.lon??x.x),lat=Number(x.lat??x.y);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    const m=routePosOfPoint(lng,lat,g,null,200);
    if(!m||Number(m.distance)>420)continue;
    const ahead=Number(m.routeDistance)-cur;
    if(ahead<0||ahead>25000)continue;
    out.push({...x,__aheadM:ahead});
  }
  return out.sort((a,b)=>Number(a.price)-Number(b.price));
}
function refreshFuelWhileDriving(){
  const now=Date.now();if(now-Number(state.lastFuelGuardAt||0)<30000)return;
  state.lastFuelGuardAt=now;
  if(!state.tripStartedAt||state.fuelLoading||!state.route?.geometry?.length)return;
  loadFuelPrices(state.fuelProduct).catch(()=>{});
}
/* ---- 오피넷 호출 최소화: 일일 호출 한도 보호 ----
   성공한 결과는 유종·위치별로 localStorage 에 저장해 계속 재사용한다.
   재조회 조건은 딱 두 가지: (1) 저장 당시 위치에서 5km 이상 벗어남, (2) 저장 후 24시간 경과.
   탭 전환·화면 전환·주행 중 갱신·새로고침 모두 같은 캐시를 쓰며, 실패 시에는 짧은 쿨다운을 둔다. */
const FUEL_CACHE_KEY='jofams_fuel_cache_v2',FUEL_CACHE_TTL_MS=24*60*60*1000,FUEL_CACHE_RADIUS_M=5000;
const FUEL_ERROR_COOLDOWN_MS=60*1000,FUEL_EMPTY_COOLDOWN_MS=10*60*1000;
const fuelInflight=new Map(),fuelFailAt=new Map();
function fuelDistM(a,b){
  const la=Number(a.lat),lo=Number(a.lng),lb=Number(b.lat),ln=Number(b.lng);
  return Math.hypot((la-lb)*111200,(lo-ln)*111200*Math.cos(la*Math.PI/180));
}
function fuelCacheLoad(){
  try{const raw=JSON.parse(localStorage.getItem(FUEL_CACHE_KEY)||'null');return Array.isArray(raw?.entries)?raw.entries:[]}catch{return[]}
}
function fuelCacheFind(product,pt,{allowStale=false}={}){
  if(!pointValid(pt))return null;
  const now=Date.now();let best=null,bestD=Infinity;
  for(const e of fuelCacheLoad()){
    if(e?.product!==product||!pointValid(e.origin)||!e.data?.stations?.length)continue;
    if(!allowStale&&now-Number(e.at||0)>=FUEL_CACHE_TTL_MS)continue;
    const d=fuelDistM(pt,e.origin);
    if(d<=FUEL_CACHE_RADIUS_M&&d<bestD){best=e;bestD=d}
  }
  return best;
}
function fuelCacheSave(product,pt,data){
  try{
    const now=Date.now();
    const keep=fuelCacheLoad().filter(e=>e&&pointValid(e.origin)&&now-Number(e.at||0)<FUEL_CACHE_TTL_MS&&!(e.product===product&&fuelDistM(pt,e.origin)<1000));
    keep.push({product,origin:{lat:Number(pt.lat),lng:Number(pt.lng)},at:now,data});
    localStorage.setItem(FUEL_CACHE_KEY,JSON.stringify({entries:keep.slice(-24)}));
  }catch{}
}
async function fuelFetchOnce(product,pt,cnt){
  const u=new URL('/api/fuel',location.origin);
  // 원본과 동일하게 실제 좌표를 그대로 전송(격자 보정은 조회 실패 의심으로 제거).
  u.searchParams.set('lat',Number(pt.lat).toFixed(7));u.searchParams.set('lng',Number(pt.lng).toFixed(7));
  u.searchParams.set('prodcd',product);u.searchParams.set('cnt',String(cnt));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),14000);
  let res;try{res=await fetch(u,{headers:{accept:'application/json'},cache:'no-store',signal:controller.signal})}finally{clearTimeout(timeout)}
  const dd=await res.json().catch(()=>({}));
  if(!res.ok||dd?.error){const err=new Error(dd?.error||`오피넷 연동 서버 /api/fuel 응답 오류 (HTTP ${res.status})`);err.code=dd?.code||String(res.status);err.trace=dd?.trace;throw err}
  if(!Array.isArray(dd?.stations))throw new Error('오피넷 API 응답에 주유소 목록(stations)이 없습니다.');
  if(!dd.stations.length){const err=new Error('주변 5km 안에 해당 유종의 판매가격 정보가 없습니다.');err.code='FUEL_EMPTY';throw err}
  dd.product=product;
  return dd;
}
/* 유일한 오피넷 진입점: 유효 캐시가 있으면 네트워크 호출 없이 반환한다. */
async function fuelGetCached(product,pt,{cnt=8,manual=false}={}){
  const hit=fuelCacheFind(product,pt);
  if(hit)return{data:hit.data,cached:true,at:hit.at,origin:hit.origin};
  const flightKey=`${product}:${Number(pt.lat).toFixed(2)}:${Number(pt.lng).toFixed(2)}`;
  if(fuelInflight.has(flightKey))return fuelInflight.get(flightKey);
  const failKey=product,fail=fuelFailAt.get(failKey);
  if(fail&&!manual&&Date.now()-fail.at<fail.wait){const err=new Error(fail.message);err.code=fail.code;err.trace=fail.trace;err.cooldown=true;throw err}
  const p=(async()=>{
    try{
      const data=await fuelFetchOnce(product,pt,cnt);
      fuelFailAt.delete(failKey);
      const origin={lat:Number(pt.lat),lng:Number(pt.lng)},at=Date.now();
      fuelCacheSave(product,origin,data);
      return{data,cached:false,at,origin};
    }catch(e){
      fuelFailAt.set(failKey,{at:Date.now(),wait:e?.code==='OPINET_KEY_QUOTA_SUSPECT'?30*60*1000:e?.code==='FUEL_EMPTY'?FUEL_EMPTY_COOLDOWN_MS:FUEL_ERROR_COOLDOWN_MS,message:e?.message||'유가 조회 실패',code:e?.code||'',trace:e?.trace});
      throw e;
    }finally{fuelInflight.delete(flightKey)}
  })();
  fuelInflight.set(flightKey,p);
  return p;
}
async function loadFuelPrices(product=state.fuelProduct,{force=false,modal=false,manual=false}={}){
  // force 는 더 이상 캐시를 우회하지 않는다(호출 한도 보호). 사용자가 직접 누른 새로고침/다시 시도만 manual 로 쿨다운을 건너뛴다.
  state.fuelProduct=FUEL_PRODUCT_NAMES[product]?product:'B027';
  const requestedProduct=state.fuelProduct;
  try{localStorage.setItem('jofams_fuel_product_v1',requestedProduct)}catch{}
  syncFuelTabs();
  let fuelOrigin=currentOriginPoint();
  if(!pointValid(fuelOrigin)){
    // 위치를 모르는 경우에도 마지막 정상 결과(해당 유종)가 있으면 그대로 보여준다.
    const last=fuelCacheLoad().filter(e=>e?.product===requestedProduct).sort((x,y)=>Number(y.at)-Number(x.at))[0];
    if(last?.data){state.fuelData=last.data;renderFuelData(last.data)}
    else renderFuelLoading();
    fuelOrigin=await refreshCurrentLocation({maxAgeMs:60000,timeoutMs:2600}).catch(()=>null);
    if(!pointValid(fuelOrigin))fuelOrigin=currentOriginPoint();
  }
  if(requestedProduct!==state.fuelProduct)return;
  if(!pointValid(fuelOrigin)){
    if(!state.fuelRetryScheduled){state.fuelRetryScheduled=true;setTimeout(()=>{state.fuelRetryScheduled=false;if(pointValid(currentOriginPoint()))loadFuelPrices(state.fuelProduct).catch(console.warn)},3500)}
    if(!state.fuelData||state.fuelData.product!==requestedProduct)renderFuelLocationError();
    return;
  }
  // 1) 유효 캐시(5km 이내 & 24시간 이내)면 네트워크 호출 없이 표시
  const hit=fuelCacheFind(requestedProduct,fuelOrigin);
  if(hit){
    state.fuelData=hit.data;state.fuelFetchedAt=Number(hit.at);state.fuelFetchedOrigin=hit.origin;
    renderFuelData(hit.data);return;
  }
  // 2) 캐시 없음 → 조회(동시 중복 요청은 하나로 합쳐짐)
  if(state.fuelData?.product!==requestedProduct)renderFuelLoading();
  state.fuelLoading=true;
  try{
    const r=await fuelGetCached(requestedProduct,{lat:fuelOrigin.lat,lng:fuelOrigin.lng},{cnt:(state.tripStartedAt&&state.route?.geometry?.length)?15:8,manual});
    if(requestedProduct!==state.fuelProduct)return; // 그 사이 다른 탭으로 이동: 결과는 캐시에 저장됐으므로 낭비 없음
    state.fuelData=r.data;state.fuelFetchedAt=Number(r.at);state.fuelFetchedOrigin=r.origin;
    try{localStorage.setItem('jofams_fuel_last_success_v1',JSON.stringify({savedAt:Date.now(),payload:r.data}))}catch{}
    renderFuelData(r.data);
  }catch(e){
    if(requestedProduct!==state.fuelProduct)return;
    // 실패해도 같은 유종의 이전 정상 결과(5km 이내, 만료 포함)가 있으면 그것을 사용
    const stale=fuelCacheFind(requestedProduct,fuelOrigin,{allowStale:true});
    if(stale){
      state.fuelData=stale.data;state.fuelFetchedAt=Number(stale.at);state.fuelFetchedOrigin=stale.origin;
      renderFuelData(stale.data);
      if(!e?.cooldown)toast('유가 갱신이 지연되어 마지막 정상 정보를 표시합니다.',2200);
    }else if(state.fuelData?.product===requestedProduct&&state.fuelData?.stations?.length){
      renderFuelData(state.fuelData);
    }else if((()=>{try{const raw=JSON.parse(localStorage.getItem('jofams_fuel_last_success_v1')||'null');return raw?.payload?.product===requestedProduct&&raw.payload.stations?.length?raw.payload:null}catch{return null}})()){
      const legacy=JSON.parse(localStorage.getItem('jofams_fuel_last_success_v1')).payload;
      state.fuelData=legacy;renderFuelData(legacy);
      toast('오피넷 조회가 지연되어 마지막으로 저장된 가격을 표시합니다.',2600);
    }else renderFuelError(e?.message||'유가 정보를 불러오지 못했습니다.',e?.code||'',e?.trace);
  }finally{state.fuelLoading=false}
}
function syncFuelTabs(){
  document.querySelectorAll('[data-fuel-product],[data-fuel-modal-product]').forEach(b=>{
    const code=b.dataset.fuelProduct||b.dataset.fuelModalProduct;
    b.classList.toggle('active',code===state.fuelProduct);
  });
}
function fuelStationRows(data){
  const items=(data?.stations||[]).filter(x=>Number(x.price)>0);
  if(!items.length)return '<div class="fuel-empty">표시할 주유소 가격정보가 없습니다.</div>';
  const min=Math.min(...items.map(x=>Number(x.price)));
  return items.map((x,i)=>`<button type="button" class="fuel-station-row" data-fuel-station-index="${i}" aria-label="${escapeHtml(x.name||'주유소')} 길안내">
    <span class="fuel-rank ${i===0?'best':''}">${i===0?'최저':i+1}</span>
    <div class="fuel-station-copy"><b>${escapeHtml(x.name||'주유소')}</b><small>${escapeHtml(fuelBrandName(x.brand))}${x.address?` · ${escapeHtml(x.address)}`:''}</small></div>
    <div class="fuel-station-price"><b>${fuelWon(x.price)}</b><small>${Number(x.price)===min?'최저가':'L당'}</small></div>
  </button>`).join('');
}
// 주유소 목록 클릭 시 해당 주유소로 길안내(경로 계산 화면)를 시작한다.
function bindFuelStationRowClicks(container,items){
  if(!container)return;
  container.querySelectorAll('[data-fuel-station-index]').forEach(btn=>{
    btn.onclick=()=>{
      const item=(items||[])[Number(btn.dataset.fuelStationIndex)];
      if(!item){toast('주유소 정보를 확인할 수 없습니다.',2000);return}
      if(!pointValid(item)){toast('이 주유소의 위치 정보를 찾을 수 없습니다.',2200);return}
      closeFuelModal();
      chooseDestination(item);
    };
  });
}
function renderFuelData(data){
  if(state.tripStartedAt&&state.route?.geometry?.length)data={...data,stations:scopeFuelToRoute(data?.stations)};
  const area=data?.areaName||'현재 지역';
  const items=(data?.stations||[]).filter(x=>Number(x.price)>0);
  const min=items.length?Math.min(...items.map(x=>Number(x.price))):0;
  const avg=Number(data?.averagePrice)||0;
  if($('fuelAreaLabel'))$('fuelAreaLabel').textContent=area;
  if($('fuelModalArea'))$('fuelModalArea').textContent=`${area} · ${FUEL_PRODUCT_NAMES[state.fuelProduct]||''}`;
  if($('fuelPriceSummary'))$('fuelPriceSummary').innerHTML=`<span>${escapeHtml(area)} ${escapeHtml(FUEL_PRODUCT_NAMES[state.fuelProduct]||'')}</span><b>${min?`최저 ${fuelWon(min)}`:'가격정보 없음'}${avg?` <small>평균 ${fuelWon(avg)}</small>`:''}</b>`;
  const rows=fuelStationRows(data);
  const best=items.filter(pointValid).sort((a,b)=>Number(a.price)-Number(b.price))[0];
  const bestBtn=best?`<button type="button" class="fuel-best-nav" data-fuel-best>⛽ 최저가 길안내 · ${escapeHtml(best.name||'주유소')} ${fuelWon(best.price)}</button>`:'';
  for(const id of ['fuelStationList','fuelModalList']){
    const el=$(id);if(!el)continue;
    el.innerHTML=bestBtn+rows;bindFuelStationRowClicks(el,items);
    el.querySelector('[data-fuel-best]')?.addEventListener('click',()=>{closeFuelModal();chooseDestination(best)});
  }
  const chip=$('driveFuelChip');
  if(chip)chip.classList.add('hidden');
  try{if(state.tripStartedAt)updateDrivePoiUI()}catch{}
}
function renderFuelLoading(){
  const msg='<div class="fuel-empty">오피넷 실시간 유가를 불러오는 중...</div>';
  if($('fuelStationList'))$('fuelStationList').innerHTML=msg;
  if($('fuelModalList'))$('fuelModalList').innerHTML=msg;
}
function renderFuelLocationError(){
  const msg='<div class="fuel-empty fuel-error">현재 위치를 확인할 수 없습니다.<br><small>휴대폰 위치 권한과 GPS를 확인해 주세요. 오피넷 인증키 오류가 아닙니다.</small></div>';
  if($('fuelStationList'))$('fuelStationList').innerHTML=msg;
  if($('fuelModalList'))$('fuelModalList').innerHTML=msg;
}
function renderFuelError(message,code='',trace=null){
  // 7.6.26: 오류 종류별로 정확한 원인을 안내한다(기존에는 "데이터 없음"도 "네트워크 지연"으로 표시됐다).
  const safe=escapeHtml(message||'유가 정보를 불러오지 못했습니다.');
  const detailByCode={
    OPINET_KEY_MISSING:'서버에 오피넷 인증키(OPINET_CERT_KEY)가 등록되지 않았습니다.',
    OPINET_KEY_QUOTA_SUSPECT:'위치·유종 문제가 아닙니다. 오피넷이 이 인증키에 모든 요청을 빈 값으로 응답 중입니다. 일일 호출 한도 초과(다음 날 자동 복구), 키 사용 승인/IP 제한, 키 만료를 오피넷 마이페이지에서 확인하세요.',
    OPINET_KEY_REJECTED:'오피넷이 인증키를 거부했습니다. 키와 사용 승인 상태를 확인해 주세요.',
    OPINET_BLOCKED:'서버에서 오피넷 접속이 차단되었습니다. 잠시 후 다시 시도해 주세요.',
    FUEL_EMPTY:'해당 유종의 판매가격이 확인되지 않습니다. 잠시 후 재조회해 주세요.',
    OPINET_PRODUCT_UNAVAILABLE:'해당 유종의 주변 판매가격을 확인하지 못했습니다. 다른 유종은 정상 조회될 수 있습니다.',
    INVALID_COORDINATES:'현재 위치를 아직 확인하지 못했습니다. 위치 권한과 GPS를 확인해 주세요.'
  };
  const detail=`<small>${detailByCode[code]||'오피넷 또는 네트워크 연결이 일시적으로 지연되고 있습니다.'}${code?` (코드: ${escapeHtml(String(code))})`:''}</small>`;
  const tr=Array.isArray(trace)&&trace.length?`<br><small>진단: ${escapeHtml(trace.map(t=>[t.step,t.status?'HTTP '+t.status:'',t.rows!=null?t.rows+'건':'',t.error||''].filter(Boolean).join(' ')).join(' / '))}</small>`:'';
  const retry='<button type="button" class="fuel-retry-btn" data-fuel-retry>다시 시도</button>';
  const msg=`<div class="fuel-empty fuel-error">${safe}<br>${detail}${tr}<br>${retry}</div>`;
  for(const id of ['fuelStationList','fuelModalList']){
    const el=$(id);if(!el)continue;el.innerHTML=msg;
    el.querySelector('[data-fuel-retry]')?.addEventListener('click',()=>loadFuelPrices(state.fuelProduct,{manual:true}).catch(()=>{}));
  }
}
function openFuelModal(){
  $('fuelModal').classList.remove('hidden');syncFuelTabs();
  if(state.fuelData?.product===state.fuelProduct)renderFuelData(state.fuelData);else loadFuelPrices(state.fuelProduct,{force:false,modal:true});
}
function closeFuelModal(){$('fuelModal').classList.add('hidden')}

/* ---------- SEARCH / SAVED PLACES ---------- */
function isNearbySearchQuery(q=''){const n=String(q).replace(/\s+/g,'').replace(/내주변|주변|근처|가까운/g,'');return /^(주유소|충전소|전기차충전소|ev충전소|마트|대형마트|슈퍼|슈퍼마켓|편의점|주차장|공영주차장|공용주차장|소방서|119안전센터|안전센터|경찰서|파출소|지구대|공용화장실|공중화장실|화장실|공공기관|관공서)$/.test(n)}
function destinationSearchAnchor(sortMode){
  if(sortMode==='center'){
    // 지도중심 검색은 GPS가 아니라 화면 중앙 좌표만 사용한다.
    if(state.map){
      try{
        const center=state.map.getCenter();
        const lng=Number(center?.lng),lat=Number(center?.lat);
        if(Number.isFinite(lng)&&Number.isFinite(lat))return{lng,lat};
      }catch{}
    }
    return null;
  }
  return pointValid(state.user)?{lng:Number(state.user.lng),lat:Number(state.user.lat)}:null;
}
function renderDestinationSearchToolbar(box){
  if(!box)return;
  const bar=document.createElement('div');
  bar.className='destination-search-toolbar';
  bar.innerHTML=`<span>검색결과</span><div>
    <button type="button" data-dest-sort="center" class="${state.destinationSearchSort==='center'?'active':''}">지도중심</button>
    <button type="button" data-dest-sort="accuracy" class="${state.destinationSearchSort==='accuracy'?'active':''}">정확도순</button>
  </div>`;
  box.appendChild(bar);
  bar.querySelectorAll('[data-dest-sort]').forEach(b=>b.onclick=async e=>{
    e.preventDefault();e.stopPropagation();
    const mode=b.dataset.destSort;
    state.destinationSearchSort=mode;
    let anchorOverride=null;
    if(mode==='center'&&state.map){
      try{
        const c=state.map.getCenter(),lng=Number(c?.lng),lat=Number(c?.lat);
        if(Number.isFinite(lng)&&Number.isFinite(lat))anchorOverride={lng,lat};
      }catch{}
    }
    searchPlaces(
      state.lastDestinationQuery||$('destinationInput')?.value||'',
      'searchResults',
      {sortOverride:mode,anchorOverride}
    );
  });
}
function isLifestyleFacilityQuery(q=''){
  const n=String(q||'').trim().replace(/\s+/g,'');
  return /^(주유소|마트|대형마트|슈퍼|슈퍼마켓|편의점|주차장|공영주차장|공용주차장|충전소|전기차충전소|EV충전소)$/i.test(n);
}
async function loadHomeFacility(category=state.homeFacilityCategory){
  state.homeFacilityCategory=category||'주유소';
  document.querySelectorAll('[data-home-facility]').forEach(b=>b.classList.toggle('active',b.dataset.homeFacility===state.homeFacilityCategory));
  const box=$('homeFacilityList');if(!box)return;
  if(!state.user)await locate(false);
  if(!state.user){box.innerHTML='<div class="facility-empty">GPS 위치를 확인할 수 없습니다.</div>';return}
  box.innerHTML='<div class="facility-empty">가까운 장소를 찾고 있습니다...</div>';
  try{
    const u=new URL('/api/search',location.origin);
    u.searchParams.set('q',state.homeFacilityCategory);
    u.searchParams.set('sort','center');
    u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat);
    const rr=await fetch(u);if(!rr.ok)throw new Error();
    const d=await rr.json();state.homeFacilityItems=(d.items||[]).slice(0,8);
    if(!state.homeFacilityItems.length){box.innerHTML='<div class="facility-empty">주변 검색 결과가 없습니다.</div>';return}
    box.innerHTML='';
    state.homeFacilityItems.forEach(x=>{
      const b=document.createElement('button');b.type='button';b.className='home-facility-item';
      const dist=Number(x.distance);
      b.innerHTML=`<div><b>${escapeHtml(x.name||state.homeFacilityCategory)}</b><small>${escapeHtml(x.address||x.category||'')}</small></div><strong>${Number.isFinite(dist)?km(dist):''}</strong>`;
      b.onclick=()=>chooseDestination(x);box.appendChild(b);
    });
  }catch{box.innerHTML='<div class="facility-empty">주변 시설 검색에 실패했습니다.</div>'}
}
async function searchPlaces(q,target='searchResults',options={}){
  const box=$(target);if(!q?.trim())return;
  const isDestination=target==='searchResults';
  if(isDestination)state.lastDestinationQuery=q.trim();
  let requestedMapCenter=pointValid(options?.anchorOverride)?{lng:Number(options.anchorOverride.lng),lat:Number(options.anchorOverride.lat)}:null;
  const requestedSort=String(options?.sortOverride||state.destinationSearchSort||'accuracy');
  if(isDestination&&requestedSort==='center'&&!requestedMapCenter&&state.map){
    try{
      const c=state.map.getCenter();
      const lng=Number(c?.lng),lat=Number(c?.lat);
      if(Number.isFinite(lng)&&Number.isFinite(lat))requestedMapCenter={lng,lat};
    }catch{}
  }
  box.classList.remove('hidden');
  box.innerHTML='';
  if(isDestination)renderDestinationSearchToolbar(box);
  const loading=document.createElement('button');loading.className='search-result';loading.innerHTML='<b>검색 중...</b>';box.appendChild(loading);

  if(!state.user)await locate(false);
  try{
    const u=new URL('/api/search',location.origin);
    u.searchParams.set('q',q.trim());
    const lifestyle=isDestination&&isLifestyleFacilityQuery(q);
    const effectiveSort=isDestination?(lifestyle?'center':requestedSort):'accuracy';
    if(isDestination)u.searchParams.set('sort',effectiveSort);
    const anchor=isDestination
      ?(effectiveSort==='center'?(requestedMapCenter||destinationSearchAnchor('center')):destinationSearchAnchor('accuracy'))
      :(pointValid(state.user)?state.user:null);
    if(anchor){u.searchParams.set('lng',Number(anchor.lng).toFixed(7));u.searchParams.set('lat',Number(anchor.lat).toFixed(7))}
    const r=await fetch(u);if(!r.ok)throw new Error('검색 오류');
    const d=await r.json();const items=d.items||[];
    box.innerHTML='';if(isDestination)renderDestinationSearchToolbar(box);
    if(!items.length){const empty=document.createElement('button');empty.className='search-result';empty.innerHTML='<b>검색 결과가 없습니다.</b>';box.appendChild(empty);return}
    items.slice(0,8).forEach(x=>{
      const b=document.createElement('button');b.className='search-result';
      const dist=Number(x.distance);
      b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}${Number.isFinite(dist)&&dist>=0?` · ${km(dist)}`:''}</small>`;
      b.onclick=()=>target==='placeSearchResults'?selectPlaceCandidate(x):chooseDestination(x);
      box.appendChild(b);
    })
  }catch(e){
    box.innerHTML='';if(isDestination)renderDestinationSearchToolbar(box);
    const err=document.createElement('button');err.className='search-result';err.innerHTML='<b>검색 서버 연결을 확인해 주세요.</b>';box.appendChild(err);
  }
}
async function chooseDestination(item,{autoGuide=true}={}){
  state.waypoints=[];
  renderRouteWaypoints();
  state.destination=normalizedPlace(item);
  if(!pointValid(state.destination)){
    toast('선택한 장소 위치를 확인할 수 없습니다.',2200);
    return;
  }

  // 즐겨찾기/최근/홈·회사 등으로 '새 목적지'를 고르면 출발지는 항상 현재 위치다.
  // (이전 경로에서 출발지/도착지 바꾸기·출발지 지정이 남아 있으면 그 위치에서 출발하던 문제)
  // 경로 화면에서 사용자가 직접 지정한 출발지를 두고 목적지만 바꾸는 경우에만 유지한다.
  if(!arguments[1]?.keepOrigin&&$('routeView')?.classList.contains('hidden')){state.origin=null;state.originMode='current';state.routeOriginUsed=null}
  state.routeMode='car';
  state.carRouteOptions=[];
  state.walkingRoute=null;
  state.routeModeDurations={car:null,walk:null};
  renderRouteModeSwitch();

  saveRecentDestination(state.destination).catch(e=>console.warn('recent destination save failed',e));
  setDestinationMarker();
  $('searchResults')?.classList.add('hidden');
  if($('routeDestinationName'))$('routeDestinationName').textContent=state.destination.name||'목적지';
  if($('routeAddressDest'))$('routeAddressDest').textContent=state.destination.name||'목적지';
  updateFavoriteButtonState();

  // 안정본과 동일하게 먼저 화면 전환. 클릭 즉시 반응이 보인다.
  setView('route');
  refreshMapLayout();
  if($('routeCards'))$('routeCards').innerHTML=''; if($('routePlanEta'))$('routePlanEta').textContent='';
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  if(!state.user)await locate(false);
  if(!state.user){
    if($('routeCards'))$('routeCards').innerHTML='';
    showPermissionGate();
    return;
  }
  // 저장돼 있던/오래된 위치가 아니라 지금 위치로 출발하도록 최신 위치를 다시 받는다.
  if(state.originMode==='current'&&!pointValid(currentOriginPoint()))await refreshCurrentLocation({timeoutMs:1600}).catch(()=>{});

  if(!state.origin||state.originMode==='current'){
    state.origin={...(currentOriginPoint()||state.user),name:'내 위치',address:'현재 GPS 위치'};
    state.originMode='current';
  }
  updateOriginUI();

  await loadRouteOptions();
  // 7.6.1.9: 목적지를 고르자마자 바로 주행을 시작하지 않는다. loadRouteOptions()가 경로를 표시하면서
  // 이미 scheduleAutoStart()로 10초 카운트다운을 시작하므로, 여기서 바로 startNavigation()을 호출해
  // 카운트다운을 건너뛰지 않는다. 사용자는 10초 안에 "안내 시작"을 눌러 즉시 시작하거나 취소할 수 있다.
  void autoGuide;
}
function resumeNavigationWithSelectedRoute(){
  if(!state.route||!state.destination)return false;
  cancelAutoStart();
  // 기존 주행 세션은 유지하되 선택한 새 경로 기준으로 위치/안내 상태만 재초기화한다.
  state.routeCumulative=buildCumulative(state.route);
  state.currentRouteIndex=0;
  if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0;}
  state.driveMarkerFrameAt=0;
  invalidateDrivePoiRoute();
  state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};
  state.routeLockedDistance=0;
  state.routeLockedAt=Date.now();
  state.offRouteHits=0;
  state.offRouteHeadingHits=0;
  state.offRouteSince=0;
  state.arrivalCandidateSince=0;
  state.navigationStartAt=Date.now();
  // 이전 경로 기준 진행거리(state.user.routeDistance)를 새 경로에 그대로 쓰면 캐릭터가 엉뚱한 위치로 가므로 새 경로에서 다시 계산한다.
  {let d0=0;if(pointValid(state.user)){const i0=nearestIndex(state.user.lng,state.user.lat,state.route.geometry);d0=Number(state.routeCumulative[i0])||0}
   state.routeLockedDistance=d0;state.driveMarkerRenderedDistance=d0;state.driveMarkerTargetDistance=d0;state.stationaryGpsAnchor=null;state.lockBehindHits=0;state.lockAheadHits=0;
   if(state.user){state.user={...state.user,routeDistance:d0}}}
  state.navigationStartAnchor=pointValid(state.user)?{lat:Number(state.user.lat),lng:Number(state.user.lng),routeDistance:state.routeLockedDistance}:null;
  state.navigationStartReleased=false;state.navigationMoveConfirmHits=0;state.navigationStartFixed=false;state.departSpeedSince=0;state.departMoveSince=0;
  state.stationaryActive=true;
  state.stationaryGpsAnchor=state.navigationStartAnchor?{...state.navigationStartAnchor}:null;
  state.lastRealSpeedMps=0;
  state.gpsFix={lat:null,lng:null,headingDeg:null,speedMps:0,at:0,fixCount:0,mapSnapped:false};
  setView('drive');
  $('driveView')?.classList.toggle('walking-mode',state.routeMode==='walk');
  initializeDriveSummary();
  drawRoute(state.route,{fit:false});
  if(state.routeMode==='car'){
    loadSafetyEvents(state.route).catch(()=>{});
    startLiveRouteRefresh();
  }else{
    state.safetyEvents=[];
    clearSafetyMarkers();
    hideSafetyAlert();
    stopLiveRouteRefresh();
  }
  startWatch();
  ensureUserMarker();
  updateCarMarkerImage();
  updateDriving(true);
  snapDriveCameraNow();setTimeout(snapDriveCameraNow,200);
  toast('선택한 경로로 안내를 계속합니다.',1600);
  return true;
}

async function startRouteGuidanceNow(){
  // 주행 중 '다른 경로'를 선택해 경로 화면으로 돌아온 경우에도 버튼이 반드시 동작해야 한다.
  if(state.tripStartedAt){
    if(state.route&&state.destination){
      resumeNavigationWithSelectedRoute();
    }else{
      toast('선택한 경로를 확인할 수 없습니다.',1800);
    }
    return;
  }

  if(state.route&&state.destination){
    cancelAutoStart();
    startNavigation();
    return;
  }
  if(!state.destination){
    toast('목적지를 먼저 선택해 주세요.',2000);
    return;
  }

  const btn=$('startBtn');
  if(btn){btn.disabled=true;btn.textContent='경로 계산 중...'}
  try{
    if(!state.user)await locate(false);
    if(!state.user){showPermissionGate();return}
    if(state.originMode==='current')await refreshCurrentLocation().catch(()=>{});
    if(!state.origin||state.originMode==='current'){
      state.origin={...(currentOriginPoint()||state.user),name:'내 위치',address:'현재 GPS 위치'};
      state.originMode='current';
    }
    updateOriginUI();
    await loadRouteOptions();
    if(state.route&&state.destination){cancelAutoStart();startNavigation()}
  }catch(e){
    console.warn('guide start failed',e);
    toast('길안내를 시작하지 못했습니다.',2200);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=state.routeMode==='walk'?'도보 안내 시작':'안내 시작'}
  }
}
function placeKindLabel(kind){return kind==='home'?'집':'회사'}
function renderPlaceManageState(){
  const kind=state.placeKind,current=state.savedPlaces[kind],candidate=state.placeCandidate,label=placeKindLabel(kind);
  if($('placeModalTitle'))$('placeModalTitle').textContent=`${label} 위치 관리`;
  if($('placeSavedStatus'))$('placeSavedStatus').classList.toggle('empty',!current);
  if($('placeSavedName'))$('placeSavedName').textContent=current?.name||'등록된 장소 없음';
  if($('placeSavedAddress'))$('placeSavedAddress').textContent=current?.address||'장소를 검색하거나 현재 위치를 선택하세요.';
  if($('placeCandidateCard'))$('placeCandidateCard').classList.toggle('hidden',!candidate);
  if(candidate){$('placeCandidateName').textContent=candidate.name||label;$('placeCandidateAddress').textContent=candidate.address||'좌표 위치'}
  const save=$('placeSaveBtn'),del=$('placeDeleteBtn');
  if(save){save.disabled=!candidate;save.textContent=current?'변경':'등록'}
  if(del)del.classList.toggle('hidden',!current);
}
function showPlaceFeedback(message,kind='success'){
  const el=$('placeActionFeedback');if(!el)return;el.textContent=message;el.className=`place-action-feedback ${kind}`;clearTimeout(showPlaceFeedback.t);showPlaceFeedback.t=setTimeout(()=>el.classList.add('hidden'),3200)
}
function openPlaceModal(kind){
  state.placeKind=kind;state.placeCandidate=null;$('placeSearchInput').value='';$('placeSearchResults').innerHTML='';$('placeCandidateCard')?.classList.add('hidden');$('placeActionFeedback')?.classList.add('hidden');renderPlaceManageState();$('placeModal').classList.remove('hidden');setTimeout(()=>$('placeSearchInput').focus(),100)
}
function selectPlaceCandidate(x){
  const p=normalizedPlace(x);if(!pointValid(p))return toast('장소 좌표를 확인할 수 없습니다.');state.placeCandidate=p;renderPlaceManageState();showPlaceFeedback(`${p.name} 선택됨 · 등록/변경 버튼을 눌러 확정하세요.`,'selected');toast(`${p.name}을 선택했습니다.`,1800)
}
async function saveCurrentLocationAsPlace(){
  if(!['home','work'].includes(state.placeKind))return;if(!state.user)await locate(false);if(!state.user)return toast('현재 위치를 확인할 수 없습니다.');const label=placeKindLabel(state.placeKind);selectPlaceCandidate({id:`current-${state.placeKind}`,name:`${label} (현재 위치)`,address:'현재 GPS 위치',lng:state.user.lng,lat:state.user.lat})
}
async function confirmRegisteredPlace(){
  const kind=state.placeKind,p=state.placeCandidate;if(!['home','work'].includes(kind)||!pointValid(p))return showPlaceFeedback('먼저 저장할 장소를 선택해 주세요.','error');
  const wasRegistered=Boolean(state.savedPlaces[kind]);
  state.savedPlaces[kind]={...p};state.placeCandidate=null;saveLocalSettings();updateSavedLabels();renderPlaceManageState();
  const action=wasRegistered?'변경':'등록',msg=`${placeKindLabel(kind)} 위치가 ${action}되었습니다.`;
  showPlaceFeedback(msg,'success');showPlaceConfirmPopup(msg);toast(msg,2200);
  const btn=$('placeSaveBtn');if(btn){btn.disabled=true;btn.textContent=`${action} 완료`;setTimeout(()=>{btn.disabled=false;renderPlaceManageState()},650)}
  // 화면 반응을 DB보다 먼저 처리하고 서버 동기화는 비동기로 수행한다.
  Promise.allSettled([savePlaceToDb(kind,state.savedPlaces[kind]),state.firebase.user?saveCloudPrefs():Promise.resolve()]).then(results=>{
    const failed=results.some(r=>r.status==='rejected');if(failed)toast(`${placeKindLabel(kind)} 위치는 기기에 저장되었습니다. 서버 동기화를 다시 시도합니다.`,2800)
  });
}
async function deleteRegisteredPlace(){
  const kind=state.placeKind;if(!['home','work'].includes(kind)||!state.savedPlaces[kind])return;
  state.savedPlaces[kind]=null;state.placeCandidate=null;saveLocalSettings();updateSavedLabels();renderPlaceManageState();
  const msg=`${placeKindLabel(kind)} 위치가 삭제되었습니다.`;showPlaceFeedback(msg,'deleted');showPlaceConfirmPopup(msg);toast(msg,2200);
  Promise.allSettled([deletePlaceFromDb(kind),state.firebase.user?saveCloudPrefs():Promise.resolve()]).then(results=>{if(results.some(r=>r.status==='rejected'))toast('기기에서는 삭제되었습니다. 서버 삭제를 다시 시도합니다.',2600)});
}
async function saveRegisteredPlace(x){selectPlaceCandidate(x);return confirmRegisteredPlace()}
function updateSavedLabels(){$('homeLabel').textContent=state.savedPlaces.home?.name||'등록';$('workLabel').textContent=state.savedPlaces.work?.name||'등록';$('favoriteLabel').textContent=`${state.favorites.length}곳`;$('myFavoriteCount').textContent=`${state.favorites.length}곳 저장`}

function installationId(){
  try{
    let id=localStorage.getItem(INSTALLATION_ID);
    if(!id){id=(crypto?.randomUUID?.()||`dev-${Date.now()}-${Math.random().toString(36).slice(2,12)}`);localStorage.setItem(INSTALLATION_ID,id)}
    return id;
  }catch{return `memory-${location.hostname}`}
}
function placeOwnerKey(){return state.firebase.user?.uid?`firebase:${state.firebase.user.uid}`:`device:${installationId()}`}
async function dbPlaceRequest(method,kind=null,place=null){
  const u=new URL('/api/places',location.origin);u.searchParams.set('owner',placeOwnerKey());if(kind)u.searchParams.set('kind',kind);
  const opt={method,headers:{'content-type':'application/json'}};
  if(place)opt.body=JSON.stringify({owner:placeOwnerKey(),kind,place});
  const r=await fetch(u,opt);const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`places DB HTTP ${r.status}`);return d
}
async function savePlaceToDb(kind,place){
  const d=await dbPlaceRequest('POST',kind,place);state.placeDbReady=Boolean(d.stored);return d
}
async function deletePlaceFromDb(kind){
  const d=await dbPlaceRequest('DELETE',kind);state.placeDbReady=Boolean(d.deleted||d.ok);return d
}
async function loadDbSavedPlaces(){
  try{
    const d=await dbPlaceRequest('GET');const items=d.items||{};state.placeDbReady=true;let count=0;
    for(const kind of ['home','work']){if(items[kind]&&pointValid(items[kind])){state.savedPlaces[kind]=items[kind];count++}}
    saveLocalSettings();updateSavedLabels();if(state.placeKind)renderPlaceManageState();return {ok:true,count}
  }catch(e){console.warn('saved places DB load failed',e);state.placeDbReady=false;return {ok:false,count:0}}
}
function showPlaceConfirmPopup(message){
  const pop=$('placeConfirmPopup');if(!pop){toast(message,2800);return}
  $('placeConfirmMessage').textContent=message;pop.classList.remove('hidden');clearTimeout(showPlaceConfirmPopup.t);showPlaceConfirmPopup.t=setTimeout(()=>pop.classList.add('hidden'),2400)
}


/* ---------- USER NAVIGATION SETTINGS ---------- */
function routePreferenceSpec(pref=state.routePreference){
  return pref==='fast'?{key:'fast',label:'빠른길',priority:'TIME',avoid:null}:pref==='free'?{key:'free',label:'무료도로',priority:'RECOMMEND',avoid:'toll'}:{key:'recommend',label:'추천',priority:'RECOMMEND',avoid:null};
}
function cameraAlertAllowed(type){
  if(['speed_camera','section_speed_camera','section_speed_end','mobile_camera','traffic_camera'].includes(type))return state.cameraAlerts.speed!==false;
  if(type==='signal_speed_camera')return state.cameraAlerts.speed!==false||state.cameraAlerts.signal!==false;
  if(type==='signal_camera')return state.cameraAlerts.signal!==false;
  return true;
}
function settingsOwnerKey(){return placeOwnerKey()}
async function firebaseIdToken(){
  try{return state.firebase.user?await state.firebase.user.getIdToken():''}catch{return ''}
}
async function userSettingsRequest(method='GET',payload=null){
  const token=await firebaseIdToken();
  const opt={method,headers:{'content-type':'application/json'}};
  if(token)opt.headers.authorization=`Bearer ${token}`;
  if(payload)opt.body=JSON.stringify({...payload,owner:settingsOwnerKey()});
  const u=new URL('/api/user-settings',location.origin);u.searchParams.set('owner',settingsOwnerKey());
  const r=await fetch(u,opt),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`settings HTTP ${r.status}`);return d;
}
function applyUserSettings(data={}){
  const route=String(data.routePreference||data.route_preference||'');if(['recommend','fast','free'].includes(route))state.routePreference=route;
  if(data.speedCameraAlert!=null||data.speed_camera_alert!=null)state.cameraAlerts.speed=Boolean(data.speedCameraAlert??data.speed_camera_alert);
  if(data.signalCameraAlert!=null||data.signal_camera_alert!=null)state.cameraAlerts.signal=Boolean(data.signalCameraAlert??data.signal_camera_alert);
  state.userSettingsLoaded=true;renderUserSettingsUI();
}
function renderUserSettingsUI(){
  document.querySelectorAll('[data-route-pref]').forEach(b=>b.classList.toggle('active',b.dataset.routePref===state.routePreference));
  const sp=$('speedCameraAlertToggle'),sg=$('signalCameraAlertToggle');if(sp)sp.checked=state.cameraAlerts.speed!==false;if(sg)sg.checked=state.cameraAlerts.signal!==false;
  const rp=$('routePreferenceSummary');if(rp)rp.textContent=`현재: ${routePreferenceSpec().label}`;
  const cp=$('cameraAlertSummary');if(cp)cp.textContent=`과속 ${state.cameraAlerts.speed?'ON':'OFF'} · 신호위반 ${state.cameraAlerts.signal?'ON':'OFF'}`;
}
async function loadUserSettings(){
  try{const d=await userSettingsRequest('GET');if(d.settings)applyUserSettings(d.settings);return true}catch(e){console.warn('user settings load failed',e);renderUserSettingsUI();return false}
}
function saveUserSettingsOptimistic(){
  renderUserSettingsUI();
  const payload={routePreference:state.routePreference,speedCameraAlert:state.cameraAlerts.speed!==false,signalCameraAlert:state.cameraAlerts.signal!==false};
  try{localStorage.setItem(`${SETTINGS}.navprefs.${settingsOwnerKey()}`,JSON.stringify(payload))}catch{}
  userSettingsRequest('POST',payload).catch(e=>console.warn('user settings DB sync failed',e));
}
function loadLocalUserSettings(){
  try{const d=JSON.parse(localStorage.getItem(`${SETTINGS}.navprefs.${settingsOwnerKey()}`)||'null');if(d)applyUserSettings(d)}catch{}
}
function chooseRoutePreference(pref){if(!['recommend','fast','free'].includes(pref))return;state.routePreference=pref;saveUserSettingsOptimistic();showPlaceConfirmPopup(`경로 우선순위가 ${routePreferenceSpec(pref).label}(으)로 설정되었습니다.`)}
function updateCameraAlertSetting(kind,value){if(!['speed','signal'].includes(kind))return;state.cameraAlerts[kind]=Boolean(value);saveUserSettingsOptimistic();showPlaceConfirmPopup(`${kind==='speed'?'과속':'신호위반'} 카메라 알림이 ${value?'켜졌습니다.':'꺼졌습니다.'}`)}

/* ---------- ROUTES ---------- */
async function routeRequest(priority='RECOMMEND',avoid=null,waypointsOverride=null,mode=state.routeMode,originOverride=null,signal=null){
  const o=pointValid(originOverride)?originOverride:(state.originMode==='current'?(currentOriginPoint()||state.user||state.origin):(state.origin||state.user)),wps=Array.isArray(waypointsOverride)?waypointsOverride:state.waypoints;
  if(!pointValid(o))throw new Error('출발 위치를 확인하지 못했습니다. 휴대폰 위치 서비스와 브라우저 위치 권한을 확인하고 다시 시도해 주세요.');
  if(!pointValid(originOverride))state.routeOriginUsed={lat:Number(o.lat),lng:Number(o.lng)};
  const originHeading=Number.isFinite(Number(originOverride?.heading))
    ?Number(originOverride.heading)
    :(mode==='car'&&state.originMode==='current'&&Number.isFinite(Number(state.user?.heading))?Number(state.user.heading):null);
  const body={origin:{lng:o.lng,lat:o.lat,heading:originHeading},destination:{lng:state.destination.lng,lat:state.destination.lat},waypoints:(wps||[]).filter(pointValid).map(x=>({lng:x.lng,lat:x.lat,name:x.name||'경유지'})),priority,alternatives:false,mode:mode==='walk'?'walk':'car'};
  if(avoid&&mode==='car')body.avoid=avoid;
  const rr=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),...(signal?{signal}:{})});
  if(!rr.ok)throw new Error(mode==='walk'?'도보 경로 조회 실패':'경로 조회 실패');return rr.json();
}
function renderRouteModeSwitch(){
  const car=$('routeModeCar'),walk=$('routeModeWalk');if(!car||!walk)return;
  car.classList.toggle('active',state.routeMode==='car');walk.classList.toggle('active',state.routeMode==='walk');
  car.setAttribute('aria-selected',String(state.routeMode==='car'));walk.setAttribute('aria-selected',String(state.routeMode==='walk'));
  if($('routeModeCarTime'))$('routeModeCarTime').textContent=Number.isFinite(Number(state.routeModeDurations.car))?mins(state.routeModeDurations.car):'--분';
  if($('routeModeWalkTime'))$('routeModeWalkTime').textContent=Number.isFinite(Number(state.routeModeDurations.walk))?mins(state.routeModeDurations.walk):'--분';
  if($('startBtn'))$('startBtn').textContent=state.routeMode==='walk'?'도보 안내 시작':'안내 시작';
}
async function selectTravelMode(mode){
  mode=mode==='walk'?'walk':'car';if(routeOptionsAbortController)routeOptionsAbortController.abort();cancelAutoStart();state.routeMode=mode;renderRouteModeSwitch();
  if(mode==='walk'){
    if(!state.walkingRoute){
      $('routeCards').innerHTML=''; if($('routePlanEta'))$('routePlanEta').textContent='';
      try{const wr=await routeRequest('RECOMMEND',null,null,'walk');if(!wr?.geometry?.length)throw new Error('도보 경로가 없습니다.');state.walkingRoute={...wr,_label:'도보 추천',_character:state.character,_class:'walk'};state.routeModeDurations.walk=wr.duration}
      catch(e){toast(e.message||'도보 경로를 가져오지 못했습니다.',2800);state.routeMode='car';renderRouteModeSwitch();return}
    }
    state.routeOptions=[state.walkingRoute];state.selectedRoute=0;
  }else{
    if(!state.carRouteOptions.length){await loadRouteOptions();return}
    state.routeOptions=state.carRouteOptions;const pref=state.routePreference;const p=state.routeOptions.findIndex(x=>(pref==='fast'&&x._class==='fast')||(pref==='free'&&x._class==='free')||(pref==='recommend'&&!x._class));state.selectedRoute=p>=0?p:0;
  }
  selectRoute(state.selectedRoute,true);renderRouteCards();renderRouteModeSwitch();scheduleAutoStart();
}
let routeOptionsRequestToken=0;
let routeOptionsAbortController=null;
async function loadRouteOptions(){
  if(routeOptionsAbortController)routeOptionsAbortController.abort();
  const controller=new AbortController();routeOptionsAbortController=controller;
  const token=++routeOptionsRequestToken;
  state.routeCalculating=true;
  if(state.originMode==='current'&&!state.tripStartedAt){
    let origin=currentOriginPoint();
    if(!pointValid(origin))origin=await refreshCurrentLocation({maxAgeMs:30000,timeoutMs:5500}).catch(()=>null);
    if(!pointValid(origin))origin=await locate(false).catch(()=>null);
    if(token!==routeOptionsRequestToken)return;
    if(!pointValid(origin)){
      state.routeCalculating=false;
      $('routeCards').innerHTML='<div class="auto-start-hint">현재 위치를 확인하지 못했습니다. 위치 권한을 확인하고 다시 시도해 주세요.</div>';
      $('routePlanEta').textContent='위치 수신 실패 · 위치 서비스 확인 후 재시도';
      renderPlanningPoiSuggestions();
      return;
    }
  }
  if(token!==routeOptionsRequestToken)return;
  startPlanningAi();
  cancelAutoStart();
  $('routeCards').innerHTML='';
  if($('routePlanEta'))$('routePlanEta').textContent='';
  renderRouteModeSwitch();
  const originalMode=state.routeMode;
  const destinationKey=`${state.destination?.lat}:${state.destination?.lng}`;
  const specs=[
    {label:'추천',character:'daim',kind:'',priority:'RECOMMEND',avoid:null},
    {label:'빠른길',character:'sunsik',kind:'fast',priority:'TIME',avoid:null},
    {label:'무료도로',character:'hunmin',kind:'free',priority:'RECOMMEND',avoid:'toll'}
  ];
  state.carRouteOptions=[];
  const valid=()=>!controller.signal.aborted&&token===routeOptionsRequestToken&&`${state.destination?.lat}:${state.destination?.lng}`===destinationKey;
  let firstReady=false,finished=0;
  const publish=(spec,rr)=>{
    if(!valid()||!rr?.geometry?.length)return;
    const route={...rr,_label:spec.label,_character:spec.character,_class:spec.kind};
    const previousClass=state.route?._class;
    const optionsByKind=new Map(state.carRouteOptions.map(x=>[x._class,x]));
    optionsByKind.set(spec.kind,route);
    state.carRouteOptions=specs.map(x=>optionsByKind.get(x.kind)).filter(Boolean);
    state.routeModeDurations.car=state.carRouteOptions.reduce((m,x)=>Math.min(m,Number(x.duration)||Infinity),Infinity);
    if(!Number.isFinite(state.routeModeDurations.car))state.routeModeDurations.car=null;
    if(state.routeMode==='walk'){renderRouteModeSwitch();return}
    state.routeOptions=state.carRouteOptions;
    const chosenIndex=state.routeOptions.findIndex(x=>x._class===previousClass);
    if(!firstReady){
      firstReady=true;
      state.routeCalculating=false;
      const preferred=state.routeOptions.findIndex(x=>x._class===(state.routePreference==='fast'?'fast':state.routePreference==='free'?'free':''));
      selectRoute(preferred>=0?preferred:0,false);
      renderPlanningPoiSuggestions();
      scheduleAutoStart();
    }else if(!state.tripStartedAt&&chosenIndex>=0){
      state.selectedRoute=chosenIndex;
      if(state.route!==state.routeOptions[chosenIndex]){
        state.route=state.routeOptions[chosenIndex];
        state.routeCumulative=buildCumulative(state.route);
        drawRoute(state.route,{fit:false});
        updateRoutePlanEta();
      }
    }else{
      state.selectedRoute=Math.max(0,state.routeOptions.findIndex(x=>x===state.route));
    }
    renderRouteCards();renderRouteModeSwitch();
  };
  const jobs=specs.map(spec=>routeRequest(spec.priority,spec.avoid,null,'car',null,controller.signal)
    .then(rr=>publish(spec,rr))
    .catch(err=>{if(err?.name!=='AbortError')console.warn(`${spec.label} 경로 요청 실패`,err)})
    .finally(()=>{finished++;if(valid()&&finished===specs.length&&!firstReady){state.routeCalculating=false;$('routeCards').innerHTML='<div class="auto-start-hint">경로를 가져오지 못했습니다. 다시 시도해 주세요.</div>';}}));
  // 도보 경로는 자동차 3종의 렌더링과 완전히 독립적으로 처리한다.
  const walkJob=routeRequest('RECOMMEND',null,null,'walk',null,controller.signal).then(rr=>{
    if(!valid()||!rr?.geometry?.length)return;
    state.walkingRoute={...rr,_label:'도보 추천',_character:state.character,_class:'walk'};
    state.routeModeDurations.walk=rr.duration;
    renderRouteModeSwitch();
    if(state.routeMode==='walk'){
      state.routeCalculating=false;state.routeOptions=[state.walkingRoute];
      selectRoute(0,false);renderRouteCards();scheduleAutoStart();
    }
  }).catch(err=>{if(err?.name!=='AbortError')console.warn('도보 경로 요청 실패',err)});
  // 백그라운드 경로 응답을 각각 즉시 반영. Promise.allSettled가 모든 결과를 기다리던 병목 제거.
  await Promise.race([...jobs,walkJob]);
}

/* ---------- 7.6.21 경로 계산 중 AI 경유 추천 ----------
   경로 계산(최대 수 초)이 끝나기를 기다리지 않고, 출발지→(경유지)→목적지 사이 구간을 따라
   지역사랑·온누리 가맹점과 주유소를 먼저 조회/분석해 "가는 길에 들르기 좋은 곳"을 보여준다.
   경로가 확정되면 실제 경로 기준으로 같은 점수식을 다시 적용해 목록을 갱신한다.
   점수·거리·가격·우회시간은 모두 코드가 계산하고, 문장은 그 숫자로 만든 템플릿이다(수치를 임의 생성하지 않음). */
let _planningAiToken=0;
function planningCorridorLine(){
  const a=pointValid(state.origin)?state.origin:currentOriginPoint(),b=state.destination;
  if(!pointValid(a)||!pointValid(b))return null;
  const pts=[a,...(state.waypoints||[]).filter(pointValid),b];
  return pts.map(x=>[Number(x.lng),Number(x.lat)]);
}
function planningLineLength(line){let t=0;for(let i=1;i<line.length;i++)t+=hav(line[i-1][1],line[i-1][0],line[i][1],line[i][0]);return t}
function planningPointAt(line,meters){
  let rest=meters;
  for(let i=1;i<line.length;i++){
    const seg=hav(line[i-1][1],line[i-1][0],line[i][1],line[i][0]);
    if(rest<=seg||i===line.length-1){const f=seg>0?Math.max(0,Math.min(1,rest/seg)):0;return{lng:line[i-1][0]+(line[i][0]-line[i-1][0])*f,lat:line[i-1][1]+(line[i][1]-line[i-1][1])*f}}
    rest-=seg;
  }
  return null;
}
function planningProbes(line){
  const total=planningLineLength(line);
  if(!(total>=1800))return [];
  const n=Math.max(1,Math.min(4,Math.round(total/7000)));
  const out=[];for(let i=1;i<=n;i++){const pt=planningPointAt(line,total*i/(n+1));if(pt)out.push(pt)}
  return out;
}
async function planningFetchJson(path,params,timeoutMs=6500){
  const u=new URL(path,location.origin);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{const r=await fetch(u,{headers:{accept:'application/json'},signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
  finally{clearTimeout(timer)}
}
function startPlanningAi(){
  const token=++_planningAiToken;
  state.planningAi={token,loading:false,local:[],onnuri:[],fuel:[]};
  const line=state.tripStartedAt||state.routeMode==='walk'?null:planningCorridorLine();
  if(!line){renderPlanningPoiSuggestions();return}
  const probes=planningProbes(line);
  if(!probes.length){renderPlanningPoiSuggestions();return}
  state.planningAi.loading=true;renderPlanningPoiSuggestions();
  const merchant=(path)=>Promise.all(probes.map(pt=>planningFetchJson(path,{lat:pt.lat,lng:pt.lng,...drivePoiRegionBox(pt,2.0)}).then(j=>Array.isArray(j.items)?j.items:[]).catch(()=>[])));
  const fuel=Promise.all(probes.slice(0,3).map(pt=>fuelGetCached(state.fuelProduct||'B027',{lat:pt.lat,lng:pt.lng},{cnt:8}).then(r=>Array.isArray(r.data?.stations)?r.data.stations:[]).catch(()=>[])));
  Promise.all([merchant('/api/local-voucher'),merchant('/api/onnuri-voucher'),fuel]).then(([l,o,f])=>{
    if(token!==_planningAiToken||!state.planningAi)return;
    state.planningAi.local=mergeDrivePoiMerchantRows(l.flat());
    state.planningAi.onnuri=mergeDrivePoiMerchantRows(o.flat());
    state.planningAi.fuel=mergeDrivePoiMerchantRows(f.flat());
    state.planningAi.loading=false;renderPlanningPoiSuggestions();
  }).catch(()=>{if(token===_planningAiToken&&state.planningAi){state.planningAi.loading=false;renderPlanningPoiSuggestions()}});
}
/* 점수식(0~100). 우회거리(경로에서 떨어진 거리)·진행 위치·결제수단/가격을 합산한다. */
function planningScoreRows(line,total,{prelim=false}={}){
  const maxOff=prelim?1100:600,pa=state.planningAi||{};
  const wps=(state.waypoints||[]).filter(pointValid);
  const taken=(x)=>wps.some(w=>hav(Number(w.lat),Number(w.lng),Number(x.lat),Number(x.lng))<90);
  const edge=Math.min(700,total*.12);
  const place=(item,kind,label)=>{
    const lat=Number(item.lat),lng=Number(item.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||taken(item))return null;
    const hit=routePosOfPoint(lng,lat,line,null,maxOff*3);
    if(!hit||!(Number(hit.distance)<=maxOff))return null;
    const ahead=Number(hit.routeDistance);if(!(ahead>=edge&&ahead<=total-edge))return null;
    return{...item,kind,label,offset:Number(hit.distance),ahead,progress:ahead/total};
  };
  const pool=(cached,fresh)=>mergeDrivePoiMerchantRows([...(fresh||[]),...(cached||[]).slice(0,1500)]);
  const out=[];
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const posScore=pr=>pr>=.2&&pr<=.8?1:pr<.2?clamp01(pr/.2):clamp01((1-pr)/.2);
  for(const [kind,label,items] of [['local','지역사랑',pool(state.localVoucherData?.items,pa.local)],['onnuri','온누리',pool(state.onnuriData?.items,pa.onnuri)]]){
    for(const it of items){const r=place(it,kind,label);if(!r)continue;
      r.score=Math.round(100*(.55*(1-clamp01(r.offset/maxOff))+.25*posScore(r.progress)+.20));out.push(r)}
  }
  const stations=pool((state.fuelData?.stations||[]),pa.fuel).filter(x=>Number(x.price)>0);
  const placed=stations.map(x=>place(x,'fuel','주유소')).filter(Boolean);
  if(placed.length){
    const prices=placed.map(x=>Number(x.price)).sort((x,y)=>x-y),median=prices[Math.floor(prices.length/2)];
    for(const r of placed){
      r.saving=Math.max(0,Math.round(median-Number(r.price)));
      r.score=Math.round(100*(.35*(1-clamp01(r.offset/maxOff))+.45*clamp01(r.saving/120)+.20*posScore(r.progress)));out.push(r);
    }
  }
  // 종류별 1위를 먼저 담고(다양성), 남는 자리는 점수 순으로 채운다.
  const sorted=out.sort((x,y)=>y.score-x.score||x.offset-y.offset),picked=[];
  for(const k of ['local','onnuri','fuel']){const t=sorted.find(x=>x.kind===k);if(t)picked.push(t)}
  for(const x of sorted){if(picked.length>=3)break;if(!picked.includes(x))picked.push(x)}
  return picked.sort((x,y)=>y.score-x.score).slice(0,3);
}
function planningReason(x,prelim){
  const off=Math.max(10,Math.round(x.offset/10)*10),min=Math.max(1,Math.round(x.offset*2/8/60));
  const tail=`경로에서 약 ${off}m · 우회 약 ${min}분 예상${prelim?'':''}`;
  if(x.kind==='fuel')return `${x.saving>0?`주변보다 L당 약 ${x.saving}원 저렴 · `:'후보 중 가격 우수 · '}${fuelWon(x.price)} · ${tail}`;
  return `${x.label}상품권 사용 가능 · ${tail}`;
}
function renderPlanningPoiSuggestions(){
  const root=$('planningPoiSuggestions');if(!root)return;
  if(state.tripStartedAt||state.routeMode==='walk'){root.classList.add('hidden');return}
  const pa=state.planningAi,calc=Boolean(state.routeCalculating);
  const useRoute=!calc&&state.route?.geometry?.length;
  const line=useRoute?state.route.geometry:planningCorridorLine();
  let rows=[];
  if(line&&line.length>=2){
    const total=useRoute?(Number(state.routeCumulative?.at(-1))||planningLineLength(line)):planningLineLength(line);
    if(total>=1800)rows=planningScoreRows(line,total,{prelim:!useRoute});
  }
  const loading=Boolean(pa?.loading);
  if(!rows.length&&!loading){root.classList.add('hidden');root.classList.remove('loading');return}
  root.classList.remove('hidden');root.classList.toggle('loading',loading||calc);
  const sub=calc?'경로 계산과 동시에 분석 중 · 경로 확정 후 다시 정렬됩니다':'우회거리·가격·결제수단 기준 · 정확한 경유시간은 재탐색 후 확인';
  const head=`<header><b><i class="ai-badge">AI 추천</i> 가는 길에 들르기 좋은 곳</b><small>${sub}</small></header>`;
  if(!rows.length){root.innerHTML=head+'<div class="planning-poi-skeleton"><i></i><i></i><i></i></div>';return}
  root.innerHTML=head+rows.map((x,i)=>`<button type="button" class="planning-poi-entry ${x.kind}" data-planning-poi="${i}"><div class="pp-top"><strong>${escapeHtml(x.name||x.market||x.label)}</strong><em>적합도 ${x.score}</em></div><small>${escapeHtml(planningReason(x,!useRoute))}</small><span>경유지로 추가 →</span></button>`).join('');
  root.querySelectorAll('[data-planning-poi]').forEach(b=>b.onclick=()=>{
    const x=rows[Number(b.dataset.planningPoi)];if(!x)return;
    const pt=normalizedPlace({name:x.name||x.market||x.label,address:x.address||x.matchedAddress||'',lat:x.lat,lng:x.lng});
    if(!pointValid(pt))return;
    state.waypoints=[...(state.waypoints||[]),pt].slice(0,5);
    toast(`${pt.name}을(를) 경유지로 추가하고 경로를 다시 계산합니다.`,1600);
    loadRouteOptions();
  });
}
function renderRouteCards(){
  const box=$('routeCards');box.innerHTML='';
  state.routeOptions.forEach((rr,i)=>{
    const b=document.createElement('button');b.className=`route-card ${i===state.selectedRoute?'selected':''}`;
    if(state.routeMode==='walk')b.innerHTML=`<div class="route-meta"><span class="route-tag walk">도보 추천</span><strong>${mins(rr.duration)}</strong><small>${km(rr.distance)} · 보행 경로</small><em>예상 도착 ${eta(rr.duration)}</em></div><span class="route-walk-art">${icon('walk')}</span>`;
    else{const ch=characterDefs[rr._character],fare=rr.fare?.toll||0;b.innerHTML=`<div class="route-meta"><span class="route-tag ${rr._class}">${rr._label}</span><strong>${mins(rr.duration)}</strong><small>${km(rr.distance)} · ${fare?`${fare.toLocaleString()}원`:'통행료 0원'}</small><em>예상 도착 ${eta(rr.duration)}</em></div><img src="${ch.car}" alt="${ch.name} 자동차">`}
    b.onclick=()=>{selectRoute(i,true);renderRouteCards();const start=$('startBtn');if(start){start.disabled=false;start.textContent=state.routeMode==='walk'?'도보 안내 시작':'안내 시작'}scheduleAutoStart()};box.appendChild(b)
  })
}
function selectRoute(index,fit=true){
  const chosen=state.routeOptions?.[index];
  if(!chosen?.geometry?.length){toast('경로 정보가 준비되지 않았습니다.',1500);return}
  state.selectedRoute=index;state.route=chosen;
  if(state.routeMode==='car')state.routePreference=chosen._class==='fast'?'fast':chosen._class==='free'?'free':'recommend';
  syncCharacterUI();drawRoute(state.route,{fit});state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0;updateRoutePlanEta();
  if(state.routeMode==='car')loadSafetyEvents(state.route);else{state.safetyEvents=[];clearSafetyMarkers();hideSafetyAlert()}
}
function scheduleAutoStart(){cancelAutoStart();if(state.voiceRecommendationPending)return;state.autoStartSeconds=15;updateAutoHint();state.autoStartTimer=setInterval(()=>{state.autoStartSeconds--;if(state.autoStartSeconds<=0){cancelAutoStart();if(state.tripStartedAt)resumeNavigationWithSelectedRoute();else Promise.resolve(startNavigation()).catch(err=>{console.warn('auto start failed',err);toast('안내 시작을 다시 눌러 주세요.',2200)})}else updateAutoHint()},1000)}
function cancelAutoStart(){if(state.autoStartTimer){clearInterval(state.autoStartTimer);state.autoStartTimer=null}}
function updateAutoHint(){$('autoStartHint').textContent=state.autoStartSeconds>0?`${state.autoStartSeconds}초 후 ${state.routeMode==='walk'?'도보 ':''}안내를 시작합니다.`:''}


function loadSavedWaypointCourses(){
  try{state.savedWaypointCourses=JSON.parse(localStorage.getItem('jofams_waypoint_courses_v1')||'[]')||[]}catch{state.savedWaypointCourses=[]}
}
function persistSavedWaypointCourses(){
  try{const rows=(state.savedWaypointCourses||[]).slice(0,20);localStorage.setItem('jofams_waypoint_courses_v1',JSON.stringify(rows));state.savedWaypointCourses=rows;return true}catch(e){console.warn('waypoint course save failed',e);toast('경유지 코스를 저장하지 못했습니다.');return false}
}
function saveCurrentWaypointCourse(){
  const points=(state.waypoints||[]).filter(pointValid);
  if(!points.length||!pointValid(state.destination))return false;
  // 현재 위치 출발은 좌표를 저장하지 않는다(저장 당시 위치에서 출발하는 문제). 지정 출발지만 저장한다.
  const origin=state.originMode==='current'?null:(pointValid(state.origin)?{...state.origin}:null);
  const key=[origin||'current',...points,state.destination].map(p=>p==='current'?'current':`${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`).join('|');
  const routeText=[...points.map(p=>p.name||'경유지'),state.destination.name||'목적지'].join(' → ');
  const item={id:'wc_'+Date.now(),key,name:routeText,origin:origin?{...origin}:null,destination:{...state.destination},waypoints:points.map(p=>({...p})),savedAt:Date.now()};
  state.savedWaypointCourses=[item,...(state.savedWaypointCourses||[]).filter(x=>x.key!==key)].slice(0,20);
  if(persistSavedWaypointCourses()){renderSavedWaypointCourses();toast('경유지 코스를 저장했습니다.',1400);return true}
  return false;
}
function deleteSavedWaypointCourse(id){
  state.savedWaypointCourses=(state.savedWaypointCourses||[]).filter(x=>x.id!==id);if(persistSavedWaypointCourses()){renderSavedWaypointCourses();toast('저장 코스를 삭제했습니다.',1200)}
}
async function useSavedWaypointCourse(id){
  const item=(state.savedWaypointCourses||[]).find(x=>x.id===id);if(!item)return;
  state.destination=normalizedPlace(item.destination);
  state.waypoints=(item.waypoints||[]).map(normalizedPlace).filter(pointValid);
  const savedWasCurrent=!pointValid(item.origin)||item.origin?.name==='내 위치'||item.origin?.address==='현재 GPS 위치';
  if(savedWasCurrent){
    // 예전에 저장된 코스에 '내 위치' 좌표가 들어 있어도 쓰지 않고 지금 위치에서 출발한다.
    state.originMode='current';state.origin=null;
    await refreshCurrentLocation().catch(()=>{});
    const cp=currentOriginPoint();if(cp)state.origin={...cp,name:'내 위치',address:'현재 GPS 위치'};
  }else{
    state.origin=normalizedPlace(item.origin);state.originMode='custom';
  }
  updateOriginUI();renderRouteWaypoints();
  $('routeAddressDest').textContent=state.destination.name||'목적지';
  setView('route');await loadRouteOptions();
}
function renderSavedWaypointCourses(){
  const items=(state.savedWaypointCourses||[]).filter(x=>x&&x.id&&x.destination);
  const renderInto=(box,compact=false)=>{
    if(!box)return;
    if(!items.length){box.innerHTML=compact?'<div class="recent-empty">저장된 경유지 코스가 없습니다.</div>':'';return}
    box.innerHTML=`${compact?'':`<div class="saved-course-title"><b>경유지 코스 저장함</b><small>${items.length}개</small></div>`}${items.map(x=>{
      const waypoints=(x.waypoints||[]).filter(pointValid);
      const routeText=[...(waypoints.map(p=>p.name||'경유지')),x.destination?.name||'목적지'].join(' → ');
      return `<div class="saved-course-row"><button type="button" data-course-use="${escapeHtml(x.id)}"><span data-icon="routes"></span><span><b>${escapeHtml(x.name||routeText||'저장 코스')}</b><small>${waypoints.length}개 경유 · ${escapeHtml(routeText)}</small></span></button><button type="button" class="saved-course-delete" data-course-delete="${escapeHtml(x.id)}" aria-label="저장 코스 삭제">삭제</button></div>`
    }).join('')}`;
    applyIcons(box);
    box.querySelectorAll('[data-course-use]').forEach(b=>b.onclick=()=>useSavedWaypointCourse(b.dataset.courseUse));
    box.querySelectorAll('[data-course-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteSavedWaypointCourse(b.dataset.courseDelete)});
  };
  const routeBox=$('savedWaypointCourses'),homeBox=$('homeSavedWaypointCourses'),homeBlock=$('homeSavedWaypointCoursesBlock');
  if(routeBox){routeBox.classList.toggle('hidden',!items.length);renderInto(routeBox,false)}
  if(homeBlock)homeBlock.classList.toggle('hidden',!items.length);
  renderInto(homeBox,true);
}
function renderRouteWaypoints(){
  const box=$('routeSelectedWaypoints');if(!box)return;
  const items=(state.waypoints||[]).filter(pointValid);
  box.classList.toggle('hidden',!items.length);
  box.innerHTML=items.map((x,i)=>`<div class="selected-waypoint"><span class="point via"></span><small>경유 ${i+1}</small><b>${escapeHtml(x.name||'경유지')}</b><button type="button" data-route-waypoint-remove="${i}" aria-label="경유지 삭제">−</button></div>`).join('');
  box.querySelectorAll('[data-route-waypoint-remove]').forEach(btn=>btn.onclick=async()=>{cancelAutoStart();state.waypoints.splice(Number(btn.dataset.routeWaypointRemove),1);renderRouteWaypoints();await loadRouteOptions()});
}
function openWaypointSearch(){
  cancelAutoStart();
  $('waypointSearchInput').value='';$('waypointSearchResults').innerHTML='';$('waypointSearchModal').classList.remove('hidden');
  setTimeout(()=>$('waypointSearchInput').focus(),80);
}
function closeWaypointSearch(resume=true){
  $('waypointSearchModal').classList.add('hidden');
  if(resume&&state.route&&!state.tripStartedAt)scheduleAutoStart();
}
async function searchWaypointPlaces(q){
  const box=$('waypointSearchResults');if(!q?.trim())return;
  box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';if(!state.user)await locate(false);
  try{
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',q.trim());if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const res=await fetch(u);if(!res.ok)throw new Error();const d=await res.json(),items=d.items||[];box.innerHTML='';
    if(!items.length){box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>';return}
    items.slice(0,8).forEach(x=>{const b=document.createElement('button');b.className='search-result';b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}</small>`;b.onclick=async()=>{const p=normalizedPlace(x);if(!pointValid(p))return;state.waypoints=[...(state.waypoints||[]),p].slice(0,5);closeWaypointSearch(false);renderRouteWaypoints();toast(`${p.name}을 경유지로 추가했습니다.`);await loadRouteOptions()};box.appendChild(b)})
  }catch{box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}



async function swapRouteEndpoints(){
  cancelAutoStart();
  const oldDestination=pointValid(state.destination)?{...state.destination}:null;
  const oldOrigin=state.originMode==='current'
    ?(pointValid(state.user)?{...state.user,name:'내 위치',address:'현재 GPS 위치'}:null)
    :(pointValid(state.origin)?{...state.origin}:null);
  if(!oldDestination||!oldOrigin){toast('출발지와 목적지를 먼저 확인해 주세요.');return}
  state.origin={...oldDestination};
  state.originMode='custom';
  state.destination={...oldOrigin};
  if(Array.isArray(state.waypoints)&&state.waypoints.length)state.waypoints=[...state.waypoints].reverse();
  updateOriginUI();
  if($('routeAddressDest'))$('routeAddressDest').textContent=state.destination.name||state.destination.address||'목적지';
  if($('routeDestinationName'))$('routeDestinationName').textContent=state.destination.name||'목적지';
  renderRouteWaypoints();
  toast('출발지와 목적지를 바꿨습니다.');
  await loadRouteOptions();
}

function updateOriginUI(){
  const label=state.originMode==='current'?'내 위치':(state.origin?.name||state.origin?.address||'출발지');
  if($('routeAddressOrigin'))$('routeAddressOrigin').textContent=label;updateOriginMarker();
}
function updateRoutePlanEta(){
  if(!$('routePlanEta'))return;
  if(!state.route){$('routePlanEta').textContent='';return}
  const originLabel=state.originMode==='current'?'내 위치':(state.origin?.name||'선택한 출발지');
  $('routePlanEta').textContent=`${originLabel} 출발 · 예상 도착 ${eta(state.route.duration)} · ${mins(state.route.duration)}`;
}
function openOriginModal(){$('originModal').classList.remove('hidden');$('originSearchInput').value='';$('originSearchResults').innerHTML='';setTimeout(()=>$('originSearchInput').focus(),80)}
function closeOriginModal(){$('originModal').classList.add('hidden')}
async function useCurrentOrigin(){if(!state.user)await locate(false);if(!state.user){toast('현재 위치를 확인할 수 없습니다.');return}state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current';updateOriginUI();closeOriginModal();await loadRouteOptions()}
async function searchOrigins(q){
  const box=$('originSearchResults');if(!q?.trim())return;box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';
  try{const u=new URL('/api/search',location.origin);u.searchParams.set('q',q.trim());if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}const r=await fetch(u);if(!r.ok)throw new Error();const d=await r.json();box.innerHTML='';(d.items||[]).slice(0,8).forEach(x=>{const b=document.createElement('button');b.className='search-result';b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||'')}</small>`;b.onclick=async()=>{state.origin=normalizedPlace(x);state.originMode='custom';updateOriginUI();closeOriginModal();await loadRouteOptions()};box.appendChild(b)});if(!box.children.length)box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>'}catch{box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}

async function startAR(){
  if(state.permissionPrefs?.camera===false){toast('MY에서 카메라 조회 동의를 켜 주세요.');return}
  if(state.arRunning)return;
  if(!state.route||!state.destination){toast('먼저 길안내를 시작해 주세요.');return}
  if(!navigator.mediaDevices?.getUserMedia){toast('이 기기에서는 AR 카메라를 지원하지 않습니다.');return}
  // 사용자 제스처(AR 버튼 탭) 컨텍스트를 벗어나기(getUserMedia await) 전에 먼저 전체화면을 요청해야 브라우저가 확실히 허용한다.
  if(matchMedia('(orientation: landscape)').matches)enterAppFullscreen();
  try{
    state.arStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    $('arVideo').srcObject=state.arStream;state.arRunning=true;$('arView').classList.remove('hidden');$('bottomNav').classList.add('hidden');$('driveMenu').classList.add('hidden');
    $('arCharacterCar').src=characterGuideImage('marker');updateAROverlay();drawARScene();
    tryLandscapeFullscreen();
  }catch(e){console.warn(e);toast('카메라 권한을 허용해 주세요.',3000)}
}
function stopAR(){
  if(state.arFrame)cancelAnimationFrame(state.arFrame);state.arFrame=0;state.arRunning=false;$('arView')?.classList.add('hidden');
  if(state.arStream){state.arStream.getTracks().forEach(t=>t.stop());state.arStream=null}
  if(!$('driveView')?.classList.contains('hidden'))$('bottomNav')?.classList.add('hidden');
  setTimeout(tryLandscapeFullscreen,60); // AR 종료 후에도 여전히 주행 중이면 주행 전체화면 유지, 아니면 전체화면 해제
}
function updateAROverlay(){
  if(!state.route||!state.user)return;const idx=state.currentRouteIndex||0,total=state.routeCumulative.at(-1)||state.route.distance||1,done=state.routeCumulative[idx]||0,remain=Math.max(0,total-done),ratio=Math.max(0,Math.min(1,remain/total)),remainSec=(state.route.duration||0)*ratio;
  const guides=(state.route.guides||[]).filter(x=>Number(x.routeIndex)>idx+1),g=guides[0];
  if(g){const d=Math.max(10,distanceAlong(idx,g.routeIndex));$('arTurnIcon').innerHTML=turnSvg(g.type);$('arTurnDistance').textContent=km(d);$('arCenterDistance').textContent=km(d);$('arTurnRoad').textContent=g.name||g.guidance||'다음 안내'}
  else{$('arTurnIcon').innerHTML=turnSvg(0);$('arTurnDistance').textContent=km(remain);$('arCenterDistance').textContent=km(remain);$('arTurnRoad').textContent='목적지까지 직진'}
  $('arSpeed').textContent=Math.max(0,Math.round((state.user.speed||0)*3.6));$('arEta').textContent=eta(remainSec);$('arRemain').textContent=km(remain);$('arCharacterCar').src=characterGuideImage('rear');updateUserMarkerMotion();
  const marker=$('arCharacterMarker');if(marker){const near=g?Math.max(0,Math.min(1,1-distanceAlong(idx,g.routeIndex)/650)):0;marker.classList.toggle('rear-facing',!isWalkingGuide());marker.classList.toggle('walking-character-marker',isWalkingGuide());marker.style.setProperty('--ar-car-x','0px');marker.style.setProperty('--ar-car-y','-3vh')}
}
function drawARScene(){
  if(!state.arRunning)return;
  const canvas=$('arCanvas'),rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(dpr,dpr);
  const W=rect.width,H=rect.height;
  // MVP 7.5: AR 화살표는 완전히 제거하고, 샘플처럼 반짝이는 파란 주행 리본이 전방으로 길게 뻗어가도록 구성한다.
  // 소실점은 화면 52% 부근으로 내려 기존보다 더 낮고 안정적인 시야각을 만든다.
  const horizon=H*.685,bottom=H*.985;
  const idx=state.currentRouteIndex||0;
  // MVP 7.5 AR 정렬 보정: 회전 안내와 무관하게 유도 리본 중심축은 항상 화면 정중앙을 유지한다.
  // 유도 구역 전체 폭은 화면 폭의 1/3을 넘지 않도록 제한한다.
  const centerX=()=>W/2;
  const maxHalfWidth=W/6; // 전체 폭 최대 W/3
  const base=new Path2D(),topHalf=Math.max(6,W*.014),bottomHalf=Math.min(W*.145,maxHalfWidth);
  base.moveTo(centerX()-topHalf,horizon);
  base.lineTo(centerX()+topHalf,horizon);
  base.lineTo(centerX()+bottomHalf,bottom);
  base.lineTo(centerX()-bottomHalf,bottom);
  base.closePath();
  const baseGrad=ctx.createLinearGradient(0,horizon,0,bottom);
  baseGrad.addColorStop(0,'rgba(82,220,255,.10)');
  baseGrad.addColorStop(.35,'rgba(54,193,255,.22)');
  baseGrad.addColorStop(.74,'rgba(36,151,255,.32)');
  baseGrad.addColorStop(1,'rgba(22,112,255,.42)');
  ctx.save();ctx.shadowColor='rgba(26,173,255,.28)';ctx.shadowBlur=28;ctx.fillStyle=baseGrad;ctx.fill(base);ctx.restore();

  const core=new Path2D(),topCore=Math.max(4,W*.007),bottomCore=Math.min(W*.072,maxHalfWidth*.52);
  core.moveTo(centerX()-topCore,horizon);
  core.lineTo(centerX()+topCore,horizon);
  core.lineTo(centerX()+bottomCore,bottom);
  core.lineTo(centerX()-bottomCore,bottom);
  core.closePath();
  const coreGrad=ctx.createLinearGradient(0,horizon,0,bottom);
  coreGrad.addColorStop(0,'rgba(180,245,255,.24)');
  coreGrad.addColorStop(.4,'rgba(108,226,255,.28)');
  coreGrad.addColorStop(.82,'rgba(56,186,255,.32)');
  coreGrad.addColorStop(1,'rgba(34,146,255,.38)');
  ctx.fillStyle=coreGrad;ctx.fill(core);

  const shine=new Path2D(),shineTop=Math.max(2,W*.0032),shineBottom=Math.min(W*.020,maxHalfWidth*.18);
  shine.moveTo(centerX()-shineTop,horizon);
  shine.lineTo(centerX()+shineTop,horizon);
  shine.lineTo(centerX()+shineBottom,bottom);
  shine.lineTo(centerX()-shineBottom,bottom);
  shine.closePath();
  const shineGrad=ctx.createLinearGradient(0,horizon,0,bottom);
  shineGrad.addColorStop(0,'rgba(255,255,255,.36)');
  shineGrad.addColorStop(.42,'rgba(209,248,255,.22)');
  shineGrad.addColorStop(1,'rgba(255,255,255,.08)');
  ctx.fillStyle=shineGrad;ctx.fill(shine);

  const blocks=14;
  for(let i=0;i<blocks;i++){
    const t0=i/blocks,t1=Math.min(1,t0+.78/blocks);
    const y0=horizon+(bottom-horizon)*Math.pow(t0,.88),y1=horizon+(bottom-horizon)*Math.pow(t1,.88);
    const x0=centerX(),x1=centerX();
    const w0=Math.max(6,topHalf+(bottomHalf-topHalf)*t0),w1=Math.max(8,topHalf+(bottomHalf-topHalf)*t1);
    const p=new Path2D();
    p.moveTo(x0-w0*.92,y0);p.lineTo(x0+w0*.92,y0);p.lineTo(x1+w1*.86,y1);p.lineTo(x1-w1*.86,y1);p.closePath();
    const alpha=.02+.055*Math.pow(t1,1.15);
    const g=ctx.createLinearGradient(0,y0,0,y1);
    g.addColorStop(0,`rgba(255,255,255,${alpha*.55})`);
    g.addColorStop(1,`rgba(113,236,255,${alpha})`);
    ctx.fillStyle=g;ctx.fill(p);
  }

  ctx.restore();state.arFrame=requestAnimationFrame(drawARScene)
}
function toLocalDateInput(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function setFutureDefaultTime(){
  const d=new Date(Date.now()+30*60*1000),rounded=Math.ceil(d.getMinutes()/10)*10;
  if(rounded>=60){d.setHours(d.getHours()+1);d.setMinutes(0)}else d.setMinutes(rounded);
  const h=d.getHours(),ampm=h>=12?'PM':'AM',h12=h%12||12;state.futureAmPm=ampm;
  if($('futureHour'))$('futureHour').value=String(h12);if($('futureMinute'))$('futureMinute').value=String(Math.floor(d.getMinutes()/10)*10);
  document.querySelectorAll('[data-future-ampm]').forEach(b=>b.classList.toggle('active',b.dataset.futureAmpm===ampm));
  if($('futureDateInput')){$('futureDateInput').min=toLocalDateInput(new Date());$('futureDateInput').value=toLocalDateInput(d)}
}

/* ---------- 7.5.7.6 RESTORED COMMON HELPERS ---------- */
function saveTripHistory(){try{localStorage.setItem(TRIP_HISTORY,JSON.stringify((state.tripHistory||[]).slice(0,50)))}catch(e){console.warn('trip history save failed',e)}}
function addTripHistory(entry){state.tripHistory=[entry,...(state.tripHistory||[])].slice(0,50);saveTripHistory();updateTripHistorySummary()}
function updateTripHistorySummary(){const el=$('tripHistorySummary');if(el)el.textContent=(state.tripHistory||[]).length?`최근 ${state.tripHistory.length}건 저장`:'주행 기록이 없습니다.'}
function openInfoModal(title,html){const titleEl=$('infoModalTitle'),bodyEl=$('infoModalBody'),modal=$('infoModal');if(!modal)return;if(titleEl)titleEl.textContent=title||'';if(bodyEl){bodyEl.innerHTML=html||'';try{applyIcons(bodyEl)}catch(e){console.warn('modal icon render failed',e)}}modal.classList.remove('hidden')}
function closeInfoModal(){const modal=$('infoModal');if(modal)modal.classList.add('hidden')}

function openFutureDeparture(){
  closeMy();
  state.futureOrigin=state.user?{...state.user,name:'내 위치',address:'현재 GPS 위치'}:null;
  state.futureDestination=state.destination?normalizedPlace(state.destination):null;
  $('futureOriginInput').value=state.futureOrigin?.name||'';
  $('futureDestinationInput').value=state.futureDestination?.name||'';
  $('futureOriginResults').classList.add('hidden');$('futureDestinationResults').classList.add('hidden');
  $('futurePredictionResult').classList.add('hidden');$('futurePredictionResult').innerHTML='';
  state.futureDateMode='today';document.querySelectorAll('[data-future-date]').forEach(b=>b.classList.toggle('active',b.dataset.futureDate==='today'));$('futureDateInput').classList.add('hidden');
  setFutureDefaultTime();
  $('futureDepartureModal').classList.remove('hidden');
  const sheet=$('futureDepartureModal')?.querySelector('.future-departure-sheet');
  if(sheet){
    sheet.scrollTop=0;
    requestAnimationFrame(()=>{sheet.scrollTop=0;});
  }
  if(!state.user)locate(false).then(u=>{if(u&&!state.futureOrigin){state.futureOrigin={...u,name:'내 위치',address:'현재 GPS 위치'};$('futureOriginInput').value='내 위치'}});
}
function closeFutureDeparture(){$('futureDepartureModal').classList.add('hidden')}
async function searchFuturePlace(kind){
  const input=$(kind==='origin'?'futureOriginInput':'futureDestinationInput'),box=$(kind==='origin'?'futureOriginResults':'futureDestinationResults'),q=input.value.trim();
  if(!q)return;
  if(kind==='origin'&&/^(내 ?위치|현재 ?위치)$/.test(q)){if(!state.user)await locate(false);if(state.user){state.futureOrigin={...state.user,name:'내 위치',address:'현재 GPS 위치'};input.value='내 위치';box.classList.add('hidden')}return}
  box.classList.remove('hidden');box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';
  try{
    if(!state.user)await locate(false);
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',q);if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const r=await fetch(u);if(!r.ok)throw new Error('검색 오류');const d=await r.json(),items=d.items||[];box.innerHTML='';
    if(!items.length){box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>';return}
    items.slice(0,7).forEach(x=>{const b=document.createElement('button');b.className='search-result';const dist=Number(x.distance);b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}${Number.isFinite(dist)&&dist>0?` · ${km(dist)}`:''}</small>`;b.onclick=()=>{const p=normalizedPlace(x);if(kind==='origin')state.futureOrigin=p;else state.futureDestination=p;input.value=p.name;box.classList.add('hidden');$('futurePredictionResult').classList.add('hidden')};box.appendChild(b)})
  }catch(e){box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}
function futureDepartureDate(){
  const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(state.futureDateMode==='tomorrow')d.setDate(d.getDate()+1);
  else if(state.futureDateMode==='custom'){
    const v=$('futureDateInput').value;if(!v)return null;const [y,m,day]=v.split('-').map(Number);d.setFullYear(y,m-1,day);
  }
  let h=Number($('futureHour').value)||12;const min=Number($('futureMinute').value)||0;if(state.futureAmPm==='AM'){if(h===12)h=0}else if(h!==12)h+=12;
  d.setHours(h,min,0,0);return d;
}
function trafficForecastFactor(date){
  const day=date.getDay(),h=date.getHours()+date.getMinutes()/60,weekday=day>=1&&day<=5;
  let factor=1,level='보통';
  if(weekday&&h>=7&&h<9.5){factor=1.28;level='출근 혼잡'}
  else if(weekday&&h>=17&&h<20){factor=1.34;level='퇴근 혼잡'}
  else if(weekday&&h>=11.5&&h<14){factor=1.08;level='점심시간 교통 증가'}
  else if(!weekday&&h>=11&&h<18){factor=1.14;level='주말 이동 증가'}
  else if(h>=22||h<6){factor=.92;level='원활 예상'}
  else if(weekday){factor=1.04;level='평시'}
  return {factor,level};
}
async function futureRouteEstimate(origin,destination){
  const body={origin:{lng:origin.lng,lat:origin.lat},destination:{lng:destination.lng,lat:destination.lat},priority:'RECOMMEND',alternatives:false};
  const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('경로 계산 실패');return r.json();
}
async function predictFutureDeparture(){
  if(!state.futureOrigin||!pointValid(state.futureOrigin))return toast('출발지를 검색해 선택해 주세요.');
  if(!state.futureDestination||!pointValid(state.futureDestination))return toast('도착지를 검색해 선택해 주세요.');
  const depart=futureDepartureDate();if(!depart)return toast('출발 날짜를 선택해 주세요.');
  if(depart.getTime()<Date.now()-60000)return toast('현재보다 이후 시간을 선택해 주세요.');
  const result=$('futurePredictionResult');result.className='future-prediction-result loading';result.textContent='경로와 시간대 교통 패턴을 분석하고 있습니다...';
  try{
    const route=await futureRouteEstimate(state.futureOrigin,state.futureDestination);if(!route?.duration)throw new Error('경로 시간이 없습니다.');
    const forecast=trafficForecastFactor(depart),base=Number(route.duration),pred=Math.max(60,Math.round(base*forecast.factor)),arrival=new Date(depart.getTime()+pred*1000);
    const delta=Math.round((pred-base)/60),confidence=Math.max(65,Math.min(90,Math.round(84-Math.abs(forecast.factor-1)*35)));
    const departText=depart.toLocaleString('ko-KR',{month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:true});
    const arrivalText=arrival.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:true});
    result.className='future-prediction-result';result.innerHTML=`<div class="prediction-head"><div><span>AI 예상 소요시간</span><strong>${mins(pred)}</strong></div><span>예측 신뢰도 ${confidence}%</span></div><div class="prediction-route"><b>${escapeHtml(state.futureOrigin.name||'출발지')} → ${escapeHtml(state.futureDestination.name||'도착지')}</b><br>${escapeHtml(departText)} 출발</div><div class="prediction-grid"><div><small>예상 도착</small><b>${escapeHtml(arrivalText)}</b></div><div><small>예상 교통</small><b>${escapeHtml(forecast.level)}</b></div><div><small>현재 기준 경로</small><b>${mins(base)}</b></div><div><small>시간대 영향</small><b>${delta>0?`약 ${delta}분 증가`:delta<0?`약 ${Math.abs(delta)}분 단축`:'변화 적음'}</b></div></div><small class="prediction-note">※ 현재 경로 소요시간에 요일·출퇴근·주말 시간대 패턴을 반영한 예측치입니다. 실제 사고·공사·기상·행사 등에 따라 달라질 수 있습니다.</small>`;
  }catch(e){result.className='future-prediction-result';result.innerHTML='<b>예측에 실패했습니다.</b><small class="prediction-note">출발지·도착지 또는 네트워크 상태를 확인해 주세요.</small>'}
}
function bindFutureDepartureUI(){
  try{$('futureDepartureBtn').onclick=openFutureDeparture;$('futureDepartureClose').onclick=closeFutureDeparture;$('futureDepartureModal').addEventListener('click',e=>{if(e.target===$('futureDepartureModal'))closeFutureDeparture()});}catch(e){console.warn('future UI binding partial failure',e)}
  try{$('futureOriginSearch').onclick=()=>searchFuturePlace('origin');$('futureDestinationSearch').onclick=()=>searchFuturePlace('destination');}catch(e){console.warn('future UI binding partial failure',e)}
  try{$('futureOriginInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchFuturePlace('origin')});$('futureDestinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchFuturePlace('destination')});}catch(e){console.warn('future UI binding partial failure',e)}
  try{$('futureOriginInput').addEventListener('input',()=>{if($('futureOriginInput').value!==state.futureOrigin?.name)state.futureOrigin=null});$('futureDestinationInput').addEventListener('input',()=>{if($('futureDestinationInput').value!==state.futureDestination?.name)state.futureDestination=null});}catch(e){console.warn('future UI binding partial failure',e)}
  try{document.querySelectorAll('[data-future-date]').forEach(b=>b.onclick=()=>{state.futureDateMode=b.dataset.futureDate;document.querySelectorAll('[data-future-date]').forEach(x=>x.classList.toggle('active',x===b));$('futureDateInput').classList.toggle('hidden',state.futureDateMode!=='custom');if(state.futureDateMode==='custom'&&!$('futureDateInput').value)$('futureDateInput').value=toLocalDateInput(new Date(Date.now()+2*86400000));$('futurePredictionResult').classList.add('hidden')});}catch(e){console.warn('future UI binding partial failure',e)}
  try{document.querySelectorAll('[data-future-ampm]').forEach(b=>b.onclick=()=>{state.futureAmPm=b.dataset.futureAmpm;document.querySelectorAll('[data-future-ampm]').forEach(x=>x.classList.toggle('active',x===b));$('futurePredictionResult').classList.add('hidden')});}catch(e){console.warn('future UI binding partial failure',e)}
  try{$('futureHour').onchange=$('futureMinute').onchange=$('futureDateInput').onchange=()=>$('futurePredictionResult').classList.add('hidden');$('futurePredictBtn').onclick=predictFutureDeparture;}catch(e){console.warn('future UI binding partial failure',e)}
}

function openTripHistory(){
  const items=state.tripHistory||[];
  const html=items.length?`<div class="history-toolbar"><span>총 ${items.length}건</span><button type="button" id="clearTripHistoryBtn" class="danger-text-btn">전체 삭제</button></div><div class="history-list">${items.map((x,i)=>`<article><div class="history-copy"><b>${escapeHtml(x.destination||'목적지')}</b><small>${escapeHtml(x.date||'')} · ${km(Number(x.distance)||0)} · ${mins(Number(x.duration)||0)}</small></div><div class="history-actions"><em>${escapeHtml(characterDefs[x.character]?.name||'')}</em><button type="button" class="history-delete-btn" data-trip-delete="${i}" aria-label="주행기록 삭제">삭제</button></div></article>`).join('')}</div>`:'<div class="empty-info">저장된 주행 기록이 없습니다.</div>';
  openInfoModal('주행기록',html);
  const box=$('infoModalBody');
  box?.querySelectorAll('[data-trip-delete]').forEach(btn=>btn.onclick=()=>deleteTripHistoryAt(Number(btn.dataset.tripDelete)));
  const clear=$('clearTripHistoryBtn');if(clear)clear.onclick=clearTripHistory;
}
function deleteTripHistoryAt(index){if(!Number.isInteger(index)||index<0||index>=state.tripHistory.length)return;state.tripHistory.splice(index,1);saveTripHistory();updateTripHistorySummary();openTripHistory();toast('주행기록을 삭제했습니다.')}
function clearTripHistory(){if(!(state.tripHistory||[]).length)return;if(!confirm('저장된 주행기록을 모두 삭제할까요?'))return;state.tripHistory=[];saveTripHistory();updateTripHistorySummary();openTripHistory();toast('주행기록을 모두 삭제했습니다.')}

function openAppInfo(){openInfoModal('앱정보','<div class="info-card"><h3>단골로 내비</h3><p><b>버전</b> 7.5.7.7</p><p>2D 컬러 지도, 실시간 교통상태, AR 안내, 단속카메라·스쿨존·사고·공사 안내, 다른시간 출발 AI 소요시간 예측과 다임·순식·훈민 캐릭터 음성 안내를 제공합니다.</p></div>')}
async function openPrivacy(){const c=await loadPublicContent();openInfoModal('개인정보처리방침',`<div class="info-card privacy-copy">${escapeHtml(c.privacy||'개인정보처리방침이 준비 중입니다.').replace(/\n/g,'<br>')}</div>`)}
async function logTrip(event){try{await fetch('/api/trip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,destination:state.destination?.name||null,distance:state.route?.distance||null,duration:state.tripStartedAt?Math.round((Date.now()-state.tripStartedAt)/1000):null,character:state.character,provider:state.route?.provider||null,guideType:null})})}catch{}}
const NOTICE_ITEMS=[
  {date:'2026.09.01',title:'MVP 7.5 AR 리본·단속카메라 로컬데이터 개선',body:'AR 지도 리본 시야각 조정, 로컬 무인단속카메라 데이터 적용, 제한속도 표시 보강, 터널 추정주행과 120초 경로 갱신을 유지합니다.'},
  {date:'2026.09.01',title:'안전운전 정보 안내',body:'단속카메라, 스쿨존, 사고·공사 및 교통정보는 실제 도로 표지와 교통법규를 우선하여 이용해 주세요.'}
];
async function openNotices(){try{const d=await fetch('/api/content?type=notices').then(r=>r.json());const items=Array.isArray(d.items)&&d.items.length?d.items:NOTICE_ITEMS;openInfoModal('공지사항',`<div class="notice-list">${items.map(x=>`<article><time>${escapeHtml(x.date||x.createdAt||'')}</time><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.body).replace(/\n/g,'<br>')}</p></article>`).join('')}</div>`)}catch{openInfoModal('공지사항',`<div class="notice-list">${NOTICE_ITEMS.map(x=>`<article><time>${escapeHtml(x.date)}</time><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.body)}</p></article>`).join('')}</div>`)}}
function applyNightMode(){const h=new Date().getHours(),night=h>=19||h<6;document.body.classList.toggle('night-map',night);return night}
/* 7.6.1.9: 가로 회전 시 실제 브라우저 전체화면(Fullscreen API)까지 적용한다.
   - 기존에는 Chrome/WebView의 "전체화면 종료 방법" 안내 팝업을 피하려고 CSS 레이아웃 확장만 사용했지만,
     그 결과 브라우저 주소창/탭 UI가 그대로 남아 사용자가 "화면만 돌아가고 전체화면이 되지 않는다"고
     느끼는 문제가 있었다.
   - requestFullscreen()은 브라우저 정책상 실제 사용자 제스처(탭) 컨텍스트 안에서 호출해야 확실히
     허용되므로, 안내 시작 버튼(startNavigation)과 AR 시작 버튼(startAR) 클릭 시점에 함께 요청한다.
   - orientationchange 시점에도 한 번 더 시도하되(일부 브라우저는 회전 자체도 허용), 실패해도 조용히
     무시하고 기존 CSS 레이아웃 확장은 항상 적용해 최소한의 전체화면형 레이아웃은 보장한다.
   - iOS Safari(아이폰)는 <html> 전체화면 API를 지원하지 않으므로 CSS 확장만 적용된다. */
function fullscreenSupported(){
  const el=document.documentElement;
  return Boolean(el.requestFullscreen||el.webkitRequestFullscreen||el.msRequestFullscreen);
}
function isDocumentFullscreen(){
  return Boolean(document.fullscreenElement||document.webkitFullscreenElement||document.msFullscreenElement);
}
async function enterAppFullscreen(){
  if(isDocumentFullscreen())return;
  const el=document.documentElement;
  try{
    if(el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});
    else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
    else if(el.msRequestFullscreen)el.msRequestFullscreen();
  }catch(e){
    // 사용자 제스처 컨텍스트 밖(예: orientationchange)에서는 브라우저가 거부할 수 있다. 무시하고 CSS 레이아웃으로 대체.
    console.warn('fullscreen request failed',e?.message||e);
  }
}
function exitAppFullscreen(){
  if(!isDocumentFullscreen())return;
  try{
    if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    else if(document.msExitFullscreen)document.msExitFullscreen();
  }catch{}
}
async function tryLandscapeFullscreen(){
  const landscape=matchMedia('(orientation: landscape)').matches;
  const inDriveOrAR=!$('driveView')?.classList.contains('hidden')||state.arRunning;
  // 홈/경로/주행 어떤 화면이든 가로로 회전하면 전체화면처럼 전환한다.
  document.body.classList.toggle('landscape-full',landscape);
  // 주행/AR 화면은 기존처럼 전용 레이아웃(계기판 배치 등)까지 추가로 적용한다.
  document.body.classList.toggle('landscape-drive',landscape&&inDriveOrAR);
  if(landscape)await enterAppFullscreen();
  else exitAppFullscreen();
  setTimeout(()=>state.map?.resize(),120);
}
// 시스템 뒤로가기/제스처 등으로 브라우저가 전체화면을 강제 종료했을 때도 레이아웃 상태를 맞춰준다.
document.addEventListener('fullscreenchange',()=>{setTimeout(()=>state.map?.resize(),100)});
document.addEventListener('webkitfullscreenchange',()=>{setTimeout(()=>state.map?.resize(),100)});

document.addEventListener('pointerdown',e=>{
  if(!matchMedia('(orientation: landscape)').matches||isDocumentFullscreen())return;
  if(!$('driveView')?.classList.contains('hidden') && e.target.closest('#driveView button')){enterAppFullscreen();}
},{passive:true});
function updateDriveCompass(){
  const btn=$('mapCompassBtn');if(!btn)return;
  let bearing=0;
  try{bearing=Number(state.map?.getBearing?.())||0}catch{}
  const needle=btn.querySelector('.map-compass-needle');
  if(needle)needle.style.transform=`rotate(${-bearing}deg)`;
  btn.classList.toggle('rotated',Math.abs(bearing)>2);
}
function resetDriveCompass(e){
  e?.stopPropagation?.();
  try{state.map?.easeTo({bearing:0,duration:280});setTimeout(updateDriveCompass,300)}catch{}
  toggleMapControls(true);
}

function applyDriveMapMode(){
  if(!state.map)return;const pitch=driveMapPitch();
  try{setBuildingExtrusions(state.map3D);state.map.jumpTo({pitch,zoom:driveMapZoom()});const btn=$('map3dBtn');if(btn){btn.classList.toggle('active',state.map3D);btn.textContent=state.map3D?'2D':'3D';btn.setAttribute('aria-label',state.map3D?'2D 지도 보기':'3D 지도 보기')}state.map.resize()}catch(e){console.warn('map mode change failed',e)}
}
function toggleMapControls(force){const el=$('driveMapControls');if(!el)return;state.mapControlsVisible=typeof force==='boolean'?force:!state.mapControlsVisible;el.classList.toggle('hidden',!state.mapControlsVisible);if(state.mapControlsVisible){updateDriveCompass();clearTimeout(toggleMapControls.t);toggleMapControls.t=setTimeout(()=>toggleMapControls(false),5000)}}

function laneDirectionInfo(turnType,guidance=''){
  const text=String(guidance||'');
  const t=Number(turnType)||0;
  const left=/좌|왼쪽|left/i.test(text)||[1,2,4,6,7,11,12,14,16].includes(t);
  const right=/우|오른쪽|right/i.test(text)||[3,5,8,9,10,13,15,17].includes(t);
  if(left&&!right)return {side:'left',icon:'↖',label:'왼쪽 차로'};
  if(right&&!left)return {side:'right',icon:'↗',label:'오른쪽 차로'};
  return {side:'straight',icon:'↑',label:'직진 차로'};
}
function normalizeGuideLanes(g){
  let raw=g?.lanes;
  if(raw==null)return [];
  if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{return []}}
  if(raw&&typeof raw==='object'&&!Array.isArray(raw))raw=raw.lanes||raw.laneInfos||raw.items||raw.data||[];
  if(!Array.isArray(raw))return [];
  return raw.map((x,i)=>{
    if(typeof x==='number')return {index:i+1,recommended:Number(x)>0,direction:Number(x)};
    if(typeof x==='string')return {index:i+1,recommended:/추천|권장|진입|suggest|highlight/i.test(x),text:x};
    if(!x||typeof x!=='object')return {index:i+1,recommended:false};
    const idx=Number(x.index??x.laneIndex??x.no??x.laneNo);
    const suggested=Boolean(
      x.recommended===true||x.suggest===true||Number(x.suggest)>0||
      Number(x.highlightType)>0||Number(x.highlight_type)>0||
      /추천|권장|진입|recommended|suggest/i.test(String(x.status||x.typeLabel||x.label||''))
    );
    return {index:Number.isFinite(idx)?idx+((idx===0)?1:0):i+1,recommended:suggested,direction:x.turnType??x.turn_type??x.direction??null,text:x.name||x.label||''};
  });
}
function laneAssistModel(idx){
  const guides=(state.route?.guides||[]).filter(g=>Number(g.routeIndex)>idx+1),g=guides[0];if(!g)return null;
  const d=distanceAlong(idx,g.routeIndex);if(d>1000||d<18)return null;
  const laneRows=normalizeGuideLanes(g),dir=laneDirectionInfo(g.type,g.guidance||g.name),confusing=/분기|갈림|진입|출구|램프|교차|고가|지하|IC|JC|junction|fork|merge|exit/i.test(`${g.guidance||''} ${g.name||''}`);
  if(!laneRows.length&&!confusing&&d>650)return null;
  const rec=laneRows.filter(x=>x.recommended),nums=rec.map(x=>x.index).filter(Number.isFinite).sort((a,b)=>a-b);
  const verified=nums.length>0,range=verified?(nums.length===1?`${nums[0]}차로`:`${nums[0]}~${nums.at(-1)}차로`):dir.label;
  return {guide:g,d,lanes:laneRows,dir,range,source:verified?'route-lane':'direction-only',verified};
}
function updateLaneGuide(idx){
  const el=$('laneAssistLayer');if(!el)return;
  // 모의주행 종료 후 출발 대기 지도에는 차로 안내를 표시하지 않는다.
  if(state.departurePreview&&!state.tripStartedAt&&!state.simulationActive){
    el.classList.add('hidden');
    $('driveView')?.classList.remove('dangollo-in-junction');
    state.activeLaneGuideKey='';
    return;
  }
  const model=laneAssistModel(idx);
  if(!model){el.classList.add('hidden');$('driveView')?.classList.remove('dangollo-in-junction');state.activeLaneGuideKey='';return}
  const key=`${model.guide.id||model.guide.routeIndex}:${model.range}`;
  $('laneAssistDistance').textContent=model.d>=950?'1km 전':`${Math.max(50,Math.round(model.d/50)*50)}m 전`;
  $('laneAssistTitle').textContent=model.range||model.dir.label;
  $('laneAssistRoad').textContent=model.guide.name||model.guide.roadName||model.guide.guidance||'다음 갈림길';
  const icon=el.querySelector('.lane-assist-icon');if(icon)icon.textContent=model.dir.icon;
  el.classList.remove('hidden');
  el.classList.toggle('dangollo-junction-split',Boolean(model.d<=650&&model.d>=25));
  const dv=$('driveView');if(dv)dv.classList.toggle('dangollo-in-junction',Boolean(model.d<=650&&model.d>=25));
  if(key!==state.activeLaneGuideKey&&model.d<=1000){
    state.activeLaneGuideKey=key;
    const upcoming=(state.route?.guides||[]).find(x=>Number(x.routeIndex)>Number(state.currentRouteIndex));
    const upcomingD=upcoming?guideDisplayDistance(Number(state.currentRouteIndex),upcoming,Infinity):Infinity;
    // 주요 회전 음성과 겹쳐 다른 거리값이 들리지 않도록, 임박한 회전안내가 없을 때만 차로 음성을 재생한다.
    if(!Number.isFinite(upcomingD)||upcomingD>1100){
      const laneMeters=guideUiDistanceMeters(model.d);
      speak(`${laneMeters}미터 앞 ${model.range||model.dir.label}를 이용하세요.`);
    }
  }
}

function extractVms(idx){
  const events=(state.route?.roadEvents||[]).map(x=>({...x,routeIndex:Number(x.routeIndex)||0})).filter(x=>x.routeIndex>=idx&&x.routeIndex<=idx+900);
  for(const e of events){const raw=JSON.stringify(e),txt=String(e.message||e.text||e.description||e.name||e.guidance||'').trim();if(/vms|전광|variable.?message|교통정보판/i.test(raw)&&txt)return {key:`${e.routeIndex}:${txt}`,text:txt}}
  return null;
}
function updateVms(idx){const el=$('vmsBanner'),v=extractVms(idx);if(!el)return;if(!v){el.classList.add('hidden');return} $('vmsText').textContent=v.text;el.classList.remove('hidden');if(v.key!==state.lastVmsKey){state.lastVmsKey=v.key;speak(`전방 전광판 안내입니다. ${v.text}`)}}
function mergeFreshTraffic(current,fresh){
  if(!current?.roadSegments?.length||!fresh?.roadSegments?.length)return;
  const used=new Set(),freshSegs=fresh.roadSegments;
  for(const seg of current.roadSegments){
    const name=String(seg.name||'').trim();const frac=((Number(seg.startIndex)||0)+(Number(seg.endIndex)||0))/2/Math.max(1,(current.geometry?.length||1)-1);
    let best=-1,bestScore=Infinity;
    for(let i=0;i<freshSegs.length;i++){if(used.has(i))continue;const f=freshSegs[i],fn=String(f.name||'').trim();if(name&&fn&&name!==fn)continue;const ff=((Number(f.startIndex)||0)+(Number(f.endIndex)||0))/2/Math.max(1,(fresh.geometry?.length||1)-1),score=Math.abs(frac-ff)+(name===fn?0:.35);if(score<bestScore){best=i;bestScore=score}}
    if(best>=0&&bestScore<.42){used.add(best);const f=freshSegs[best];seg.trafficSpeed=Number(f.trafficSpeed)||0;seg.trafficState=Number(f.trafficState)||0;if(!seg.speedLimit&&f.speedLimit)seg.speedLimit=f.speedLimit}
  }
}
function remainingWaypointsForReroute(){
  const g=state.route?.geometry||[],idx=state.currentRouteIndex||0;if(!g.length)return (state.waypoints||[]).filter(pointValid);
  return (state.waypoints||[]).filter(pointValid).filter(w=>nearestIndex(w.lng,w.lat,g)>idx+8);
}
async function liveRouteRefresh(){
  if(state.routeMode==='walk'||!state.tripStartedAt||!state.user||!state.destination||state.gpsEstimated||Date.now()-state.lastLiveRouteAt<65000)return;state.lastLiveRouteAt=Date.now();
  try{
    const spec=routePreferenceSpec(),r=await routeRequest(spec.priority,spec.avoid,remainingWaypointsForReroute());if(!r?.geometry?.length||!state.route)return;
    const old=state.route,total=state.routeCumulative.at(-1)||old.distance||1,done=state.routeCumulative[state.currentRouteIndex]||0,remainingRatio=Math.max(0,Math.min(1,(total-done)/total)),oldRemain=Number(old.duration||0)*remainingRatio,newEta=Number(r.duration||0);
    mergeFreshTraffic(old,r);drawRoute(old,{fit:false});renderTrafficRouteRail(state.currentRouteIndex);updateTrafficStatus((old.roadSegments||[]).find(x=>state.currentRouteIndex>=x.startIndex&&state.currentRouteIndex<=x.endIndex));
    const improvement=oldRemain-newEta,relative=oldRemain>0?improvement/oldRemain:0;
    if(improvement>=120||relative>=.10&&improvement>=60){state.route={...r,_label:'실시간 경로',_character:state.character};state.routeCumulative=buildCumulative(state.route);invalidateDrivePoiRoute();state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);updateDriving(true);toast('실시간 교통을 반영해 더 빠른 경로로 변경했습니다.')}
  }catch(e){console.warn('live route refresh failed',e)}
}
function startLiveRouteRefresh(){clearInterval(state.liveRouteTimer);state.lastLiveRouteAt=0;setTimeout(liveRouteRefresh,12000);state.liveRouteTimer=setInterval(liveRouteRefresh,75000)}
function stopLiveRouteRefresh(){clearInterval(state.liveRouteTimer);state.liveRouteTimer=0}

function markMapManualExplore(active=true){
  if(!state.tripStartedAt)return;
  if(state.simulationActive)return;
  const now=Date.now();
  state.userMapInteracting=Boolean(active);
  state.lastUserMapInteractionAt=now;
}
function noteMapManualInput(){
  if(!state.tripStartedAt)return;
  if(state.simulationActive)return;
  state.lastUserMapInteractionAt=Date.now();
}
function endMapManualExplore(){
  if(!state.tripStartedAt)return;
  if(state.simulationActive)return;
  state.userMapInteracting=false;
  state.lastUserMapInteractionAt=Date.now();
}
function canAutoRecenterMap(){
  if(!state.tripStartedAt)return true;
  // 모의주행 중에는 사용자가 지도를 건드려도 항상 캐릭터 추종을 유지한다.
  if(state.simulationActive)return true;
  if(state.userMapInteracting)return false;
  const last=Number(state.lastUserMapInteractionAt||0);
  return !last||Date.now()-last>=10000;
}
function maybeRestoreDriveMap(){
  if(!canAutoRecenterMap())return false;
  state.userMapInteracting=false;
  return true;
}

/* 7.6.27.25 · 현재 위치 날씨(별도 API, 오피넷/AI 호출과 분리) */
const dangolloWeatherState={lastAt:0,lat:null,lng:null,pending:false,requestId:0};
function dangolloWeatherSymbol(kind,day){
  const cloud='<path d="M10 26h17c4 0 6-2.6 6-5.7 0-3.4-2.9-6-6.1-6-1.1-4-4.4-6.6-8.2-6.6-4.4 0-7.7 3.3-8.3 7.1C6.4 15 4 17.5 4 20.6 4 23.9 6.4 26 10 26Z" fill="#FFFFFF" stroke="#91BBCC" stroke-width="1.8"/>';
  const sun='<circle cx="14" cy="14" r="7" fill="#FFD66D" stroke="#EEAB49" stroke-width="1.6"/><path d="M14 2v3m0 18v3M2 14h3m18 0h3M5.5 5.5l2.3 2.3m12.4 12.4 2.3 2.3m0-17-2.3 2.3M7.8 20.2l-2.3 2.3" stroke="#EFAB49" stroke-width="2" stroke-linecap="round"/>';
  const moon='<path d="M23 3a11 11 0 1 0 10 17.8A11.7 11.7 0 0 1 23 3Z" fill="#B6B9F0" stroke="#888CC9" stroke-width="1.5"/>';
  const rain='<path d="m12 29-2 4m11-4-2 4m10-4-2 4" stroke="#5C9BE7" stroke-width="2.5" stroke-linecap="round"/>';
  const snow='<path d="M12 29v5m-2.5-2.5h5M23 29v5m-2.5-2.5h5" stroke="#71B6DC" stroke-width="2" stroke-linecap="round"/>';
  const storm='<path d="m21 25-5 7h5l-3 4 11-10h-6l3-4" fill="#F5C353" stroke="#E5A233" stroke-width="1"/>';
  const shapes={clear:day?sun:moon,partly:(day?sun:moon)+cloud,cloud:cloud,rain:cloud+rain,snow:cloud+snow,storm:cloud+storm,fog:cloud+'<path d="M6 30h23M10 34h18" stroke="#A9BDC4" stroke-width="2" stroke-linecap="round"/>'};
  return '<svg viewBox="0 0 38 38" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+(shapes[kind]||cloud)+'</svg>';
}
function updateDangolloWeatherBadge(info){
  const badge=document.getElementById('homeWeatherBadge'),icon=document.getElementById('homeWeatherIcon'),temp=document.getElementById('homeWeatherTemp'),label=document.getElementById('homeWeatherLabel');
  if(!badge||!icon||!temp||!label)return;
  if(!info){badge.classList.add('is-error');badge.classList.remove('is-loading');temp.textContent='--°';label.textContent='날씨 확인 불가';badge.title='현재 위치의 날씨를 확인하지 못했습니다';return}
  badge.classList.remove('is-error','is-loading');icon.innerHTML=dangolloWeatherSymbol(info.kind,info.isDay);temp.textContent=Math.round(info.temperature)+'°';label.textContent=info.label||'현재 날씨';badge.title='현재 위치 기준 '+(info.label||'날씨')+' '+Math.round(info.temperature)+'°C · 자료: Open-Meteo';
}
async function refreshDangolloHomeWeather(force=false){
  if(document.getElementById('homeView')?.classList.contains('hidden'))return;
  const p=pointValid(state.user)?state.user:pointValid(state.lastRawFix)?state.lastRawFix:null;
  if(!p){if(!dangolloWeatherState.pending)document.getElementById('homeWeatherLabel')?.replaceChildren(document.createTextNode('위치 확인 중'));return;}
  const lat=Number(p.lat),lng=Number(p.lng),cache=dangolloWeatherState;
  if(cache.pending)return;
  if(!force&&Date.now()-cache.lastAt<600000&&cache.lat!=null&&hav(cache.lat,cache.lng,lat,lng)<3000)return;
  cache.pending=true;const req=++cache.requestId;
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6500);
    let response;
    try{response=await fetch('/api/weather?lat='+encodeURIComponent(lat.toFixed(4))+'&lng='+encodeURIComponent(lng.toFixed(4)),{signal:controller.signal,headers:{Accept:'application/json'}})}finally{clearTimeout(timer)}
    if(!response.ok)throw new Error('weather '+response.status);
    const data=await response.json();if(!Number.isFinite(Number(data?.temperature)))throw new Error('weather unavailable');
    if(req!==cache.requestId)return;
    cache.lastAt=Date.now();cache.lat=lat;cache.lng=lng;updateDangolloWeatherBadge(data);
  }catch(e){console.warn('home weather temporarily unavailable',e?.message||e);if(!cache.lastAt)updateDangolloWeatherBadge(null)}finally{cache.pending=false}
}

function setView(view){
  if(view!=='drive'){state.departurePreview=false;$('driveView')?.classList.remove('departure-waiting')}
  $('homeView').classList.toggle('hidden',view!=='home');$('routeView').classList.toggle('hidden',view!=='route');$('driveView').classList.toggle('hidden',view!=='drive');
  setTimeout(tryLandscapeFullscreen,60); // 화면 전환/최초 진입 시에도 현재 가로/세로 상태에 맞게 전체화면 여부를 갱신
  $('bottomNav').classList.toggle('hidden',view!=='home'||state.arRunning);
  if(view==='home'){
    setTimeout(()=>refreshDangolloHomeWeather(),220);
    $('homeView')?.classList.remove('ui-hidden');
    // 생활편의시설은 최초 진입 시에도 현재 위치를 자동으로 확인해 기본 탭(주유소) 목록을 바로 보여준다.
    // loadHomeFacility 내부에서 위치가 없으면 locate(false)로 자동 확인하므로 위치 확보 여부와 무관하게 항상 호출한다.
    if(!state.homeFacilityItems.length||Date.now()-(state.homeFacilityRefreshAt||0)>120000){state.homeFacilityRefreshAt=Date.now();setTimeout(()=>loadHomeFacility(state.homeFacilityCategory),450)}
    const header=document.querySelector('#homeView .home-header');if(header){header.style.removeProperty('display');header.style.removeProperty('visibility');header.style.removeProperty('opacity')}
  }
  document.querySelectorAll('[data-bottom-nav]').forEach(b=>b.classList.toggle('active',b.dataset.bottomNav===view));
  if(state.map){if(view==='home'){state.map3D=false;enforce2DMap();state.map.easeTo({pitch:0,bearing:0})}else if(view==='drive')applyDriveMapMode()}
  applyNightMode();if(view==='home'){
    loadSavedWaypointCourses();renderSavedWaypointCourses();
    setTimeout(()=>loadFuelPrices(state.fuelProduct,{force:false}),180);
    setTimeout(async()=>{
      try{
        if(!state.tripStartedAt){
          const u=await locate(false);
          if(u&&pointValid(u))refreshDangolloHomeWeather();
          if(u&&pointValid(u)&&state.map&&!state.homeSheetCollapsed)state.map.easeTo({center:[u.lng,u.lat],zoom:15.5,duration:380});
        }
      }catch{}
      scheduleLocalVoucherRefresh();scheduleOnnuriRefresh();scheduleHomeCameraRefresh();
      clearSafetyMarkers();
    },320);
  }else{
    $('localVoucherBadge')?.classList.add('hidden');clearLocalVoucherMarkers();clearOnnuriMarkers();clearHomeCameraMarkers();clearSafetyMarkers();
  }
  if(view==='route')renderSavedWaypointCourses();
  if(view==='route'||view==='drive')setDestinationMarker();
  if(view==='drive'){setTimeout(tryLandscapeFullscreen,80);setTimeout(()=>loadFuelPrices(state.fuelProduct,{force:false}),500)}
  refreshMapLayout({fitRoute:view==='route'&&Boolean(state.route)});
  if(view==='route'||view==='drive')setTimeout(()=>{updateOriginMarker();ensureDestinationMarker();},120);
  requestAnimationFrame(updateDestinationEdgeIndicator);
}
function initializeDriveSummary(){
  if(!state.route)return;
  state.routeCumulative=buildCumulative(state.route);
  const total=state.routeCumulative.at(-1)||Number(state.route.distance)||0;
  const duration=Number(state.route.duration)||0;
  if($('remainingDistance'))$('remainingDistance').textContent=total>0?km(total):'--km';
  if($('remainingTime'))$('remainingTime').textContent=duration>0?mins(duration):'--분';
  setArrivalTime(duration,duration>0);
  if($('speedPanel'))$('speedPanel').classList.remove('hidden');
  if($('currentSpeed'))$('currentSpeed').textContent='0';
  const seg=(state.route.roadSegments||[])[0];
  const limit=Number(seg?.speedLimit)||0;
  renderSpeedOrSignBadge(limit,[]);
}
async function refreshOriginThenStart(){
  if(state.startingFresh)return;state.startingFresh=true;cancelAutoStart();
  try{
    toast('현재 위치를 확인하는 중...',1200);
    await refreshCurrentLocation({maxAgeMs:30000,timeoutMs:2200});
    const u=currentOriginPoint(),ro=state.routeOriginUsed;
    if(u&&(!ro||hav(ro.lat,ro.lng,u.lat,u.lng)>80)){
      state.origin={...u,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current';updateOriginUI();
      await loadRouteOptions();
    }
  }catch(e){console.warn('origin refresh before start failed',e)}
  finally{state.startingFresh=false}
  startNavigation({fresh:true});
}
function startNavigation(opts={}){
  state.departurePreview=false; $('driveView')?.classList.remove('departure-waiting');
  // 출발 지점이 오래된 위치(즐겨찾기 선택 당시 등)였다면 지금 위치로 경로를 다시 계산한 뒤 시작한다.
  if(!opts?.fresh&&!state.tripStartedAt&&state.originMode==='current'&&state.route&&state.destination){
    const ro=state.routeOriginUsed,u=currentOriginPoint();
    const raw=state.lastRawFix;const stale=!u||!pointValid(raw)||Date.now()-Number(raw.at||0)>30000||!(Number(raw.accuracy)>0&&Number(raw.accuracy)<=60);
    const far=ro&&u&&hav(ro.lat,ro.lng,u.lat,u.lng)>80;
    if(stale||far){
      // 전체화면/센서 권한은 사용자 제스처 안에서만 요청할 수 있으므로 비동기 작업 전에 먼저 요청한다.
      try{if(matchMedia('(orientation: landscape)').matches)enterAppFullscreen();requestCompassPermission();requestMotionPermission()}catch{}
      refreshOriginThenStart();return;
    }
  }
  try{requestMotionPermission()}catch{}
  $('localVoucherBadge')?.classList.add('hidden');clearLocalVoucherMarkers();clearOnnuriMarkers();clearHomeCameraMarkers();
  // 경로선택/현재위치 화면에서 쓰던 보조 위치 마커는 주행 화면에 남기지 않는다.
  try{if(state.originMarker){state.originMarker.remove();state.originMarker=null}}catch{state.originMarker=null}
  // 시작 전 현재 위치 보조 마커만 숨기고, 경로 종단의 파란 도착 마크는 유지한다.
  document.querySelectorAll('.maplibregl-user-location-dot,.maplibregl-user-location-accuracy-circle,.maplibregl-user-location-dot-stale,.origin-pin').forEach(el=>{try{el.style.display='none'}catch{}});
  if((state.waypoints||[]).filter(pointValid).length)saveCurrentWaypointCourse();if(!state.route||!state.destination)return;cancelAutoStart();state.preTripAnchor=null;state.tripStartedAt=Date.now();
  state.navigationStartAt=state.tripStartedAt;invalidateDrivePoiRoute();
  // 경로 API가 실제 시작점을 약간 옮겨도 현재 GPS에 투영한 출발 지점에서 출발한다.
  const startMatch=pointValid(state.user)?routePosOfPoint(Number(state.user.lng),Number(state.user.lat),state.route.geometry||[],null,120):null;
  const startM=0; // 출발 프레임은 반드시 경로의 첫 번째 좌표에서 시작
  state.driveMarkerRenderedDistance=startM;state.driveMarkerTargetDistance=startM;state.driveMarkerTargetAt=Date.now();state.driveMarkerFrameAt=0;
  if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0}
  if(state.route?.geometry?.length){
    const start=pointAtRouteDistance(startM);
    if(start){
      // 재사용 마커는 이전 GPS 위치가 한 프레임 비칠 수 있어 경로 시작점에 먼저 동기화한다.
      if(state.userMarker)state.userMarker.setLngLat([start.lng,start.lat]);
      else if(state.map)state.userMarker=makeCarMarker().setLngLat([start.lng,start.lat]).addTo(state.map);
    }
  }
  state.navigationStartAnchor=pointValid(state.user)?{lat:Number(state.user.lat),lng:Number(state.user.lng),routeDistance:Number(state.user.routeDistance)}:null;
  state.navigationStartReleased=false;state.navigationMoveConfirmHits=0;state.navigationStartFixed=false;state.departSpeedSince=0;state.departMoveSince=0;
  state.stationaryActive=true;
  state.stationaryGpsAnchor=state.navigationStartAnchor?{...state.navigationStartAnchor}:null;
  state.lastRealSpeedMps=0;
  acquireNavigationWakeLock();startDestinationCycle();logTrip('start');setView('drive');$('driveView')?.classList.toggle('walking-mode',state.routeMode==='walk');
  state.gpsFix={lat:null,lng:null,headingDeg:null,speedMps:0,at:0,fixCount:0,mapSnapped:false};state.mapMatch={index:Number(startMatch?.index)||0,routeDistance:startM,score:Infinity,confidence:0,at:0};state.routeLockedDistance=startM;state.routeLockedAt=Date.now();state.offRouteHits=0;state.offRouteHeadingHits=0;state.offRouteSince=0;state.arrivalCandidateSince=0; // 새 주행마다 상보필터 상태 초기화
  requestCompassPermission(); // 사용자 제스처(시작 버튼) 컨텍스트 안에서 iOS 나침반 권한 요청, 안드로이드/데스크톱은 즉시 리스너 등록
  if(matchMedia('(orientation: landscape)').matches)enterAppFullscreen(); // 일부 브라우저는 전체화면 API를 지원하지 않아 CSS 확장으로 대체한다.
  initializeDriveSummary();
  // Render an already loaded character at the departure point before requesting a new GPS frame.
  preloadDangolloDriveCharacters();
  // 상태 전환과 GPS watch 전에 출발점을 먼저 그려 초기 순간이동을 막는다.
  ensureUserMarker();updateCarMarkerImage();
  const departure=pointAtRouteDistance(0);
  if(departure&&state.userMarker)state.userMarker.setLngLat([departure.lng,departure.lat]);
  const openingMarker=state.userMarker?.getElement?.();
  if(openingMarker){openingMarker.style.display='block';openingMarker.style.visibility='visible';openingMarker.style.opacity='1';}
  startWatch();drawRoute(state.route,{fit:false});updateOriginMarker();ensureDestinationMarker();updateDriving(true);
  snapDriveCameraNow();setTimeout(snapDriveCameraNow,160);setTimeout(snapDriveCameraNow,650);
  // 길안내 진입 시 라디오는 60% 기준으로 초기화한다.
  // MP3 원본별 음량 편차는 Web Audio 자동 음량 평준화(AGC + compressor)로 보정한다.
  {
    setRadioVolume(.6,true);
    const rp=radioPlayer();
    if(rp){
      if(!rp.getAttribute('src'))rp.src='/assets/radio/radio_1.mp3';
      rp.muted=false;
      rp.volume=state.radioDucked?state.radioVolume*.25:state.radioVolume;
      ensureRadioLoudnessNormalizer().catch(e=>console.warn('radio normalizer init failed',e));
      const playPromise=rp.play();
      if(playPromise?.then)playPromise.then(()=>{
        state.radioPlaying=true;updateRadioUI();
      }).catch(async e=>{
        console.warn('drive radio autoplay blocked',e);
        const ok=await radioLoadIndex(state.radioIndex,true);
        state.radioPlaying=Boolean(ok);updateRadioUI();
      });
      else{state.radioPlaying=true;updateRadioUI()}
    }
  }
  if(state.routeMode==='car'){
    // 최초 안내 시작 시 현재 선택 경로 기준으로 단속카메라 데이터를 반드시 다시 로드한다.
    // 경로선택 화면에서 비동기 로딩이 끝나지 않았거나 취소되더라도 여기서 보장한다.
    loadSafetyEvents(state.route).catch(e=>console.warn('navigation camera load failed',e));
    startLiveRouteRefresh();
  }else{
    state.safetyEvents=[];clearSafetyMarkers();hideSafetyAlert();stopLiveRouteRefresh();
  }
  applyNightMode();setTimeout(tryLandscapeFullscreen,100);}
function stopNavigation(){
  stopRouteSimulation({resumeGps:false});if($('laneAssistLayer'))$('laneAssistLayer').classList.add('hidden');try{closeDrivePoiPanel();clearDrivePoiMarkers();$('drivePoiStack')?.classList.add('hidden')}catch{}
  // 종료 중 비동기 라디오 로딩/다음 곡 재시작도 차단한다.
  stopNavigationRadioImmediately();
  const finishedDestination=state.destination?{...state.destination}:null;
  // 안내 종료는 어떤 부가기능 오류가 발생해도 반드시 홈 화면까지 복귀해야 한다.
  try{if(state.tripStartedAt)logTrip('finish')}catch(e){console.warn('finish log failed',e)}
  try{if(state.tripStartedAt)addTripHistory({destination:state.destination?.name||'목적지',date:new Date().toLocaleString('ko-KR'),distance:state.route?.distance||0,duration:Math.round((Date.now()-state.tripStartedAt)/1000),character:state.character})}catch(e){console.warn('trip history finish failed',e)}
  state.wrongDirectionActive=false;state.wrongDirectionHits=0;state.correctDirectionHits=0;state.drivePositionUncertain=false;
  state.tripStartedAt=0;state.preTripAnchor=null;state.preTripMoveHits=0;
  state.navigationStartAnchor=null;state.navigationStartReleased=false;state.navigationStartAt=0;
  state.stationaryActive=false;state.stationaryGpsAnchor=null;
  releaseNavigationWakeLock();
  for(const fn of [stopDestinationCycle,stopLiveRouteRefresh,stopAR,stopWatch,cancelAutoStart,clearRouteLayer,clearSafetyMarkers,hideSafetyAlert]){try{fn?.()}catch(e){console.warn('navigation cleanup failed',e)}}
  try{$('driveMenu')?.classList.add('hidden')}catch{}
  state.safetyEvents=[];resetSectionSpeedState();state.sectionSpeedResumeBlocked=false;state.tunnelRouteLock={active:false,startIndex:-1,endIndex:-1,routeDistance:null,lastAt:0};state.route=null;state.routeOptions=[];state.waypoints=[];renderRouteWaypoints();
  try{if(state.destMarker){state.destMarker.remove();state.destMarker=null}}catch{state.destMarker=null}
  try{if(state.originMarker){state.originMarker.remove();state.originMarker=null}}catch{state.originMarker=null}
  const edge=document.getElementById('dangolloDestinationEdge');if(edge)edge.hidden=true;
  state.destination=null;state.origin=null;state.originMode='current';state.routeMode='car';state.carRouteOptions=[];state.walkingRoute=null;state.routeModeDurations={car:null,walk:null};$('driveView')?.classList.remove('walking-mode');
  try{updateOverspeed(0,0)}catch{}
  try{setView('home')}catch(e){console.error('home restore failed',e);$('homeView')?.classList.remove('hidden');$('driveView')?.classList.add('hidden')}
  toast('안내를 종료했습니다.');
  if(finishedDestination&&!isFavoritePlace(finishedDestination))setTimeout(()=>{try{openPostDriveFavoritePrompt(finishedDestination)}catch(e){console.warn('favorite prompt failed',e)}},350)
}

function driveCameraPadding(){
  const h=Math.max(320,window.innerHeight||720),landscape=(window.innerWidth||0)>(window.innerHeight||0);
  if(landscape){
    /* 7.6.11.4 가로 화면: 캐릭터(지도 위 현재 위치)가 하단 메뉴에 가려지지 않도록,
       캐릭터 아래 끝이 하단 메뉴 카드의 위쪽 경계선 바로 위에 오게 지도 중심을 맞춘다.
       마커는 중심 기준(anchor:center)이며 높이 76px 이므로 중심 = 카드 상단 - 38px - 17px(여유). */
    try{
      const card=document.querySelector('#driveView .drive-bottom-card'),canvas=state.map?.getCanvas?.();
      if(card&&canvas){
        const r=card.getBoundingClientRect(),cr=canvas.getBoundingClientRect(),H=cr.height||h;
        if(r.height>0&&H>0){
          const targetY=Math.max(H*.30,Math.min(H*.92,r.top-cr.top-55));
          // 패딩 박스의 중심이 targetY 가 되도록: center = top + (H-top-bottom)/2
          if(targetY>=H/2)return{top:Math.round(2*targetY-H),bottom:0,left:0,right:0};
          return{top:0,bottom:Math.round(H-2*targetY),left:0,right:0};
        }
      }
    }catch{}
    return{top:Math.round(h*.60),bottom:36,left:0,right:0};
  }
  // 큰 top padding으로 현재 위치가 화면 하단 65~76%에 오도록 유지한다.
  return{top:Math.round(h*.48),bottom:76,left:0,right:0};
}
function updateDriving(force=false){
  if(state.departurePreview&&!state.tripStartedAt)return;
  if(window.__JOFAMS_NATIVE_DRIVE_ACTIVE__&&!state.simulationActive)return;
  refreshVslSpeedLimit();
  if(!state.user||!state.route?.geometry?.length)return;
  const g=state.route.geometry;
  let idx=finiteOrNull(state.user.routeIndex);
  if(!Number.isFinite(idx)){
    const match=probabilisticRouteMatch({lng:state.user.lng,lat:state.user.lat,heading:state.user.heading,speed:state.user.speed,accuracy:state.user.accuracy},Date.now());
    idx=match?.index??nearestIndex(state.user.lng,state.user.lat,g);
  }
  idx=Math.max(0,Math.min(g.length-1,Math.round(idx)));
  state.currentRouteIndex=idx;
  updateTunnelRouteLock(idx);
  announceTunnelAhead(idx);
  updateSafetyMarkerVisibility();
  ensureUserMarker();

  const nextPoint=g[Math.min(g.length-1,idx+3)];
  const heading=Number.isFinite(state.user.heading)?state.user.heading:(nextPoint?bearing(state.user.lat,state.user.lng,nextPoint[1],nextPoint[0]):0);

  // 사용자가 지도 조작 중이면 카메라 자동 이동을 완전히 중지한다.
  // 마지막 사용자 입력 후 10초 동안 조작이 없을 때만 현재 위치로 복귀한다.
  if(!state.simulationActive&&maybeRestoreDriveMap()){
    const now=Date.now();
    if(force||now-Number(state.lastDriveCameraAt||0)>=280){
      state.lastDriveCameraAt=now;
      // 카메라 중심은 '화면에 그려지는 캐릭터' 위치를 따른다. 위치(state.user)와 렌더링 위치가
      // 어긋나는 순간(보간 지연·정지 고정·추정 주행)에도 캐릭터가 화면 밖으로 벗어나지 않는다.
      const camPt=Number.isFinite(Number(state.driveMarkerRenderedDistance))?pointAtRouteDistance(Number(state.driveMarkerRenderedDistance)):null;
      const camCenter=camPt?[camPt.lng,camPt.lat]:[state.user.lng,state.user.lat];
      state.map.easeTo({
        center:camCenter,
        zoom:driveMapZoom(),
        pitch:driveMapPitch(),
        bearing:driveCameraBearing(),
        duration:force?0:270,
        padding:driveCameraPadding()
      });
    }
  }
  if(!state.simulationActive&&(state.drivePositionUncertain||state.wrongDirectionActive)){
    clearUncertainGuidance();
    checkOffRoute(idx);
    return;
  }
  updateProgressUI(idx,force);
  if(state.arRunning)updateAROverlay();
  checkOffRoute(idx);
  keepDriveCharacterVisible();
  ensureSafetyMarkersPresent();
  refreshFuelWhileDriving();
}
/* 캐릭터가 화면(패딩 반영 중심)에서 크게 벗어나면 즉시 되돌린다. 지도 조작 중에는 건드리지 않는다. */
/* 주행 카메라 방향: 가로/세로 모두 '진행 방향이 화면 위쪽'(heading-up)이 되게 한다.
   GPS heading은 저속·정차 중 튀므로 캐릭터 앞쪽 경로(35m)의 방향을 기준으로 하고, 급커브에서만 부드럽게 따라간다. */
function driveCameraBearing(){
  let h=NaN;
  const cur=Number(state.driveMarkerRenderedDistance);
  if(Number.isFinite(cur)&&state.route?.geometry?.length&&state.routeCumulative?.length&&state.user?.mapSnapped!==false){
    const a=pointAtRouteDistance(cur),b=pointAtRouteDistance(cur+35);
    if(a&&b&&hav(a.lat,a.lng,b.lat,b.lng)>3)h=bearing(a.lat,a.lng,b.lat,b.lng);
  }
  if(!Number.isFinite(h)&&Number.isFinite(Number(state.user?.heading))&&(Number(state.user?.speed)||0)>1.5)h=Number(state.user.heading);
  const prev=state.driveCameraBearingLast;
  if(!Number.isFinite(h))h=Number.isFinite(prev)?prev:(Number(state.user?.heading)||0);
  if(Number.isFinite(prev)){const d=((h-prev+540)%360)-180;h=(prev+d*.55+360)%360}
  state.driveCameraBearingLast=h;return h;
}
/* 안내 시작/방향 전환 직후 지도가 옆으로 훑으며(오른쪽→왼쪽) 이동하지 않도록 카메라를 즉시 진행방향 위쪽 기준으로 맞춘다. */
function snapDriveCameraNow(){
  try{
    if(!state.map||!state.tripStartedAt||!pointValid(state.user)||state.userMapInteracting)return;
    state.map.resize();
    const camPt=Number.isFinite(Number(state.driveMarkerRenderedDistance))?pointAtRouteDistance(Number(state.driveMarkerRenderedDistance)):null;
    state.map.jumpTo({center:camPt?[camPt.lng,camPt.lat]:[state.user.lng,state.user.lat],zoom:driveMapZoom(),pitch:driveMapPitch(),bearing:driveCameraBearing(),padding:driveCameraPadding()});
    updateDriveCompass();
  }catch(e){console.warn('drive camera snap failed',e)}
}
function keepDriveCharacterVisible(){
  try{
    if(!state.map||!state.userMarker||!state.tripStartedAt||state.simulationActive)return;
    if(!canAutoRecenterMap())return;
    const now=Date.now();if(now-Number(state.lastVisibleGuardAt||0)<400)return;
    const ll=state.userMarker.getLngLat?.();if(!ll)return;
    const canvas=state.map.getCanvas?.();if(!canvas)return;
    const w=canvas.clientWidth||window.innerWidth||360,h=canvas.clientHeight||window.innerHeight||640;
    const c=state.map.project(state.map.getCenter()),p=state.map.project([ll.lng,ll.lat]);
    const dev=Math.hypot(p.x-c.x,p.y-c.y);
    // 방향 감시: 화면 회전·리사이즈·fitBounds 등으로 지도가 북쪽 기준으로 되돌아가면 진행방향 위쪽으로 복원한다.
    const tb=state.driveCameraBearingLast,mb=Number(state.map.getBearing());
    const bearingOff=Number.isFinite(tb)&&Number.isFinite(mb)&&Math.abs(((mb-tb+540)%360)-180)>20&&!state.map.isMoving?.();
    if(dev>Math.max(70,Math.min(w,h)*.28)||bearingOff){
      state.lastVisibleGuardAt=now;
      state.map.easeTo({center:[ll.lng,ll.lat],bearing:Number.isFinite(tb)?tb:mb,duration:bearingOff?320:220,essential:true,padding:driveCameraPadding()});
    }
  }catch(e){console.warn('visibility guard failed',e)}
}
/* 경로 위 카메라 핀이 어떤 이유로든 사라졌으면(경로 재계산·DOM 유실) 다시 그린다. */
function ensureSafetyMarkersPresent(){
  try{
    const now=Date.now();if(now-Number(state.lastMarkerGuardAt||0)<2500)return;
    state.lastMarkerGuardAt=now;
    if(!state.tripStartedAt||!state.map||!state.route?.geometry?.length)return;
    const hasCam=(state.safetyEvents||[]).some(e=>['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','section_speed_end'].includes(e.type));
    if(!hasCam)return;
    const ms=state.safetyMarkers||[];
    const lost=!ms.length||ms.some(m=>{const el=m.getElement?.();return !el||!el.isConnected});
    if(lost)renderSafetyMarkers();
  }catch(e){console.warn('marker guard failed',e)}
}
function hideDestinationBottom(){clearTimeout(state.destinationHideTimer);$('driveBottomDestination')?.classList.add('hidden');$('driveBottomNormal')?.classList.remove('hidden')}
function showDestinationBottom(duration=10000){if(!state.tripStartedAt||!state.destination)return;clearTimeout(state.destinationHideTimer);$('driveBottomNormal')?.classList.add('hidden');$('driveBottomDestination')?.classList.remove('hidden');state.lastDestinationShownAt=Date.now();state.destinationHideTimer=setTimeout(hideDestinationBottom,duration)}
function startDestinationCycle(){clearInterval(state.destinationCycleTimer);clearTimeout(state.destinationHideTimer);hideDestinationBottom();state.destinationCycleTimer=setInterval(()=>showDestinationBottom(10000),180000)}
function stopDestinationCycle(){clearInterval(state.destinationCycleTimer);clearTimeout(state.destinationHideTimer);state.destinationCycleTimer=0;state.destinationHideTimer=0;hideDestinationBottom()}

function normalizeSpeedLimitValue(v){
  const n=Math.round(Number(v)||0);
  return [20,30,40,50,60,70,80,90,100,110,120].includes(n)?n:0;
}
function stableSpeedLimit(candidate,idx,source='route'){
  const n=normalizeSpeedLimitValue(candidate);
  if(!n)return Number(state.stableSpeedLimit)||0;
  const now=Date.now();
  const current=Number(state.stableSpeedLimit)||0;
  if(!current){
    state.stableSpeedLimit=n;state.stableSpeedLimitSince=now;state.stableSpeedLimitIndex=idx;state.stableSpeedLimitSource=source;
    return n;
  }
  if(current===n){
    state.speedLimitCandidate=0;state.speedLimitCandidateCount=0;state.stableSpeedLimitIndex=idx;
    return current;
  }
  if(state.speedLimitCandidate!==n){state.speedLimitCandidate=n;state.speedLimitCandidateCount=1}
  else state.speedLimitCandidateCount=(state.speedLimitCandidateCount||0)+1;

  // 세그먼트 경계를 넘었거나 3회 연속 동일 값일 때만 제한속도 변경.
  const moved=Math.abs(Number(idx)-Number(state.stableSpeedLimitIndex||idx));
  if(state.speedLimitCandidateCount>=3||moved>=8){
    state.stableSpeedLimit=n;state.stableSpeedLimitSince=now;state.stableSpeedLimitIndex=idx;state.stableSpeedLimitSource=source;
    state.speedLimitCandidate=0;state.speedLimitCandidateCount=0;
  }
  return Number(state.stableSpeedLimit)||n;
}
async function loadItsTraffic(route){
  if(!route?.geometry?.length)return;
  try{
    const g=route.geometry;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of g){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])}
    const u=new URL('/api/its-traffic',location.origin);
    u.searchParams.set('minX',(minX-.01).toFixed(6));u.searchParams.set('maxX',(maxX+.01).toFixed(6));
    u.searchParams.set('minY',(minY-.01).toFixed(6));u.searchParams.set('maxY',(maxY+.01).toFixed(6));
    const r=await fetch(u,{cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();
    const items=Array.isArray(d.items)?d.items:[];
    if(!items.length)return;

    // ITS trafficInfo는 '통행속도' 데이터이며 법정 제한속도가 아니다.
    // 도로명 일치 시 교통속도만 보완한다.
    for(const seg of (route.roadSegments||[])){
      const rn=normalizeRoadName(seg.name||'');if(!rn)continue;
      const matches=items.filter(x=>{
        const n=normalizeRoadName(x.roadName||'');
        return n&&(n===rn||n.includes(rn)||rn.includes(n));
      });
      if(matches.length){
        const vals=matches.map(x=>Number(x.speed)).filter(v=>v>0&&v<180);
        if(vals.length)seg.trafficSpeed=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
      }
    }
    state.itsTrafficLoadedAt=Date.now();
  }catch(e){console.warn('ITS traffic merge failed',e)}
}


async function refreshVslSpeedLimit(){
  if(!state.tripStartedAt||state.routeMode!=='car'||!Number.isFinite(state.user?.lat)||!Number.isFinite(state.user?.lng))return;
  const now=Date.now();
  if(state.vslLoading||now-Number(state.vslLoadedAt||0)<4000)return;
  state.vslLoadedAt=now;state.vslLoading=true;
  try{
    const r=await fetch(`/api/its-vsl?lat=${encodeURIComponent(state.user.lat)}&lng=${encodeURIComponent(state.user.lng)}`,{cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();let best=null,bestScore=Infinity,bestGeo=Infinity;
    const rawLat=Number.isFinite(Number(state.user?.rawLat))?Number(state.user.rawLat):Number(state.user.lat);
    const rawLng=Number.isFinite(Number(state.user?.rawLng))?Number(state.user.rawLng):Number(state.user.lng);
    const seg=(state.route?.roadSegments||[]).find(s=>state.currentRouteIndex>=Number(s.startIndex)&&state.currentRouteIndex<=Number(s.endIndex));
    const currentRoad=normalizeRoadName(seg?.name||'');
    for(const x of d.items||[]){
      if(!Number.isFinite(Number(x.speedLimit))||Number(x.speedLimit)<=0)continue;
      const snap=nearestPointOnRoute(Number(x.lng),Number(x.lat),state.route?.geometry||[]);
      const routeGap=Number(snap?.distance);
      if(!Number.isFinite(routeGap)||routeGap>70)continue;
      const geo=hav(rawLat,rawLng,Number(x.lat),Number(x.lng));
      const candidateRoad=normalizeRoadName(x.roadName||'');
      const sameRoad=Boolean(currentRoad&&candidateRoad&&(currentRoad===candidateRoad||currentRoad.includes(candidateRoad)||candidateRoad.includes(currentRoad)));
      if(currentRoad&&candidateRoad&&!sameRoad)continue;
      const score=routeGap+Math.min(180,geo*.08)-(sameRoad?55:0);
      if(score<bestScore){best=x;bestScore=score;bestGeo=geo}
    }
    if(best&&bestGeo<=900){
      state.vslSpeedLimit=Number(best.speedLimit);
      state.vslSpeedLimitAt=Date.now();
      state.vslRoadSectionId=best.roadSectionId||'';
      state.vslRoadName=best.roadName||'';
    }else if(Date.now()-Number(state.vslSpeedLimitAt||0)>30000){
      state.vslSpeedLimit=null;state.vslRoadSectionId='';state.vslRoadName='';
    }
  }catch(e){console.warn('VSL refresh failed',e)}
  finally{state.vslLoading=false}
}
function effectiveSpeedLimit(idx,seg){
  if(Number.isFinite(Number(state.vslSpeedLimit))&&Date.now()-Number(state.vslSpeedLimitAt||0)<30000)return Number(state.vslSpeedLimit);
  // 1순위: 라우팅 공급자가 현재 도로 세그먼트에 직접 제공한 법정/도로 제한속도
  const direct=normalizeSpeedLimitValue(seg?.speedLimit);
  if(direct>0)return stableSpeedLimit(direct,idx,'route-road-detail');

  const start=Math.max(0,Number(seg?.startIndex)||idx);
  const end=Math.max(start,Number(seg?.endIndex)||idx);
  const segName=normalizeRoadName(seg?.name||'');

  // 2순위: OSM maxspeed 또는 VSL처럼 명시적으로 speed_limit 타입인 데이터
  let best=null,bestScore=Infinity;
  for(const e of (state.safetyEvents||[])){
    if(e.type!=='speed_limit'||!normalizeSpeedLimitValue(e.maxspeed))continue;
    const ri=Number(e.routeIndex);if(!Number.isFinite(ri))continue;
    const inside=ri>=start&&ri<=end;if(!inside&&Math.abs(ri-idx)>6)continue;
    const eRoad=normalizeRoadName(e.roadName||e.name||'');
    if(segName&&eRoad&&!(eRoad.includes(segName)||segName.includes(eRoad)))continue;
    const score=Math.abs(ri-idx)+(inside?0:20)+(segName&&eRoad?0:8);
    if(score<bestScore){best=e;bestScore=score}
  }
  if(best)return stableSpeedLimit(best.maxspeed,idx,best.source||'explicit-speed-limit');

  // 3순위: 도로명이 일치하고 현재 경로에 매우 근접한 고정 단속카메라의 설정속도.
  if(segName&&state.user){
    let camBest=null,camDist=Infinity;
    for(const e of (state.safetyEvents||[])){
      if(!['speed_camera','signal_speed_camera','traffic_camera'].includes(e.type)||!normalizeSpeedLimitValue(e.maxspeed))continue;
      const eRoad=normalizeRoadName(e.roadName||e.name||'');
      if(!eRoad||!(eRoad.includes(segName)||segName.includes(eRoad)))continue;
      const ri=Number(e.routeIndex);if(Number.isFinite(ri)&&Math.abs(ri-idx)>8)continue;
      const d=hav(state.user.lat,state.user.lng,Number(e.lat),Number(e.lng));if(d>120)continue;
      if(d<camDist){camBest=e;camDist=d}
    }
    if(camBest)return stableSpeedLimit(camBest.maxspeed,idx,'matched-camera');
  }

  // 출처가 불명확한 전방 카메라값을 현재 도로 제한속도로 승격하지 않는다.
  return Number(state.stableSpeedLimit)||0;
}

function sectionSpeedEventAtIndex(idx){
  /* 7.6.11.4 정확한 시점/종점 진행거리(routeDistance/endRouteDistance)로 판정 → 종료 카메라 지점을 지나는 즉시 구간단속 안내 종료 */
  const cur=currentRouteDistanceAt(idx);
  return (state.safetyEvents||[]).find(e=>{
    if(e.type!=='section_speed_camera'||!Number.isFinite(Number(e.routeIndex))||!Number.isFinite(Number(e.endRouteIndex)))return false;
    const sd=Number(e.routeDistance),ed=Number(e.endRouteDistance);
    if(Number.isFinite(sd)&&Number.isFinite(ed))return cur>=sd-2&&cur<=ed;
    return idx>=Number(e.routeIndex)&&idx<=Number(e.endRouteIndex);
  })||null;
}
/* 구간단속 평균속도가 제한속도를 넘으면 화면 전체를 빨갛게 깜빡여 경고한다(HTML/CSS 수정 없이 동작). */
function setSectionOverspeedFlash(on){
  let el=document.getElementById('sectionAvgOverspeedFlash');
  if(!el){
    if(!on)return;
    if(!document.getElementById('sectionAvgOverspeedFlashStyle')){
      const st=document.createElement('style');st.id='sectionAvgOverspeedFlashStyle';
      st.textContent='#sectionAvgOverspeedFlash{position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:rgba(255,0,0,.38);opacity:0;display:none}'+
        '#sectionAvgOverspeedFlash.on{display:block;animation:sectionAvgFlash .7s ease-in-out infinite}'+
        '@keyframes sectionAvgFlash{0%,100%{opacity:0}50%{opacity:1}}'+
        '.safety-map-marker.next-camera{transform-origin:center;filter:drop-shadow(0 0 6px rgba(255,60,60,.9));z-index:70!important}';
      document.head.appendChild(st);
    }
    el=document.createElement('div');el.id='sectionAvgOverspeedFlash';el.setAttribute('aria-hidden','true');document.body.appendChild(el);
  }
  el.classList.toggle('on',Boolean(on));
}
function resetSectionSpeedState(){
  setSectionOverspeedFlash(false);
  state.sectionSpeedState=null;
  const panel=$('sectionSpeedPanel');
  if(panel){panel.classList.add('hidden');panel.classList.remove('over','nearing-end');delete panel.dataset.sectionState;}
  const drive=$('driveView');
  if(drive){drive.classList.remove('has-section-speed');if(drive.dataset.pop==='section')drive.dataset.pop='none';}
}
function updateSectionAverageSpeed(idx){
  // 모의주행 종료 후 가상의 구간단속 상태가 실주행 HUD에 되살아나는 것을 방지한다.
  // 신뢰 가능한 실제 GPS 이동(출발 잠금 해제)이 확인돼야만 안내를 다시 허용한다.
  if(!state.tripStartedAt || (!state.simulationActive && state.sectionSpeedResumeBlocked)){
    if(!state.simulationActive && state.sectionSpeedResumeBlocked &&
       state.navigationStartReleased && !state.gpsEstimated && !state.drivePositionUncertain &&
       Number(state.user?.speed)>0.8){
      state.sectionSpeedResumeBlocked=false;
    }else{resetSectionSpeedState();return;}
  }
  /* 구간단속은 시작하면 종점까지 같은 상태로 안내한다. 경로가 재계산돼 거리 기준이 바뀌거나,
     이벤트 id가 바뀌거나, GPS/터널로 잠시 매칭이 끊겨도 중간에 끝내거나 평균속도를 초기화하지 않는다.
     평균속도는 경로 기준이 아닌 '누적 주행거리(오도미터)'로 계산해 경로가 바뀌어도 이어진다. */
  const e=sectionSpeedEventAtIndex(idx),panel=$('sectionSpeedPanel');
  const now=Date.now(),cum=state.routeCumulative||[],routeNow=Number(state.user?.routeDistance);
  const currentDistance=Number.isFinite(routeNow)?routeNow:(cum[idx]||0);
  let st=state.sectionSpeedState;
  // 오도미터 갱신: 같은 경로에서의 전진량만 더한다(후진/점프 제외).
  if(st){
    if(st.routeRef!==state.route){st.routeRef=state.route;st.routeLast=currentDistance}
    else{
      const delta=currentDistance-Number(st.routeLast||currentDistance);
      const cap=Math.max(80,(Number(state.user?.speed)||0)*Math.max(2,(now-Number(st.lastAt||now))/1000)*2+40);
      if(delta>0&&delta<=cap)st.lastDistance=Number(st.lastDistance||0)+delta;
      st.routeLast=currentDistance;
    }
    st.lastAt=now;
  }
  if(!e){
    if(st){
      // 종점을 실제로 지났을 때만 종료한다(누적 주행거리 기준 15m 여유). 매칭 실패만으로는 종료하지 않는다.
      const passedEnd=Number.isFinite(st.endDistance)&&st.lastDistance>=st.endDistance+15;
      const hardStale=now-(st.lastMatchAt||now)>30*60*1000;
      if(passedEnd||hardStale){resetSectionSpeedState();return}
      renderSectionSpeedPanel(st,panel,now);
      return;
    }
    resetSectionSpeedState();return;
  }
  const startDistance=Number.isFinite(Number(e.routeDistance))?Number(e.routeDistance):(cum[Number(e.routeIndex)]||0),endDistance=Number.isFinite(Number(e.endRouteDistance))?Number(e.endRouteDistance):(cum[Number(e.endRouteIndex)]||startDistance);
  const remainRoute=Math.max(0,endDistance-currentDistance);
  // 같은 구간인지: id가 같거나, 진행 중인 구간의 남은 거리와 새 이벤트의 남은 거리가 비슷하면 같은 구간(id만 바뀐 것).
  const sameSection=Boolean(st)&&(st.id===e.id||(Number(st.endDistance)-Number(st.lastDistance)>30&&Math.abs((Number(st.endDistance)-Number(st.lastDistance))-remainRoute)<=450));
  if(!sameSection){
    const totalLength=Math.max(1,endDistance-startDistance);
    const progressed=Math.max(0,currentDistance-startDistance);
    const progressRatio=Math.min(1,progressed/totalLength);
    state.sectionSpeedState=st={
      id:e.id,maxspeed:Number(e.maxspeed)||0,
      enteredAt:now,enteredDistance:0,lastDistance:0,endDistance:remainRoute,
      routeRef:state.route,routeLast:currentDistance,lastAt:now,lastMatchAt:now,lastAverageSpokenAt:0,lateEntry:progressRatio>.25
    };
    // 구간 중후반에서 상태가 새로 만들어진 경우 종점 직전에 '구간단속 시작'을 잘못 말하지 않는다.
    if(progressRatio<=.25&&progressed<=900&&remainRoute>=500){
      speakNavOnce(`section:${e.id}` ,`구간단속 시작 구간입니다.${e.maxspeed?` 제한속도 ${e.maxspeed}킬로미터입니다.`:''}`,12000);
    }
  }else{
    st.id=e.id;
    // 종점은 최신 경로 기준 남은 거리로 재동기화한다(누적 주행거리 좌표계 유지).
    st.endDistance=Number(st.lastDistance)+remainRoute;
  }
  st.lastMatchAt=now;st.maxspeed=Number(e.maxspeed)||st.maxspeed||0;
  renderSectionSpeedPanel(st,panel,now);
}
/* updateSectionAverageSpeed의 렌더링(패널 표시/음성 안내) 부분을 분리했다.
   실시간 이벤트 매칭에 실패한 틱에서도(위 폴백 분기) e 없이 st만으로 계속 표시할 수 있게 하기 위함. */
function renderSectionSpeedPanel(st,panel,now){
  const elapsed=Math.max(1,(now-st.enteredAt)/1000),travelled=Math.max(0,st.lastDistance-st.enteredDistance);
  const avg=Math.max(0,Math.min(250,travelled/elapsed*3.6)),remain=Math.max(0,Number(st.endDistance)-st.lastDistance);
  const maxspeed=Number(st.maxspeed)||0;
  if(panel)panel.classList.remove('hidden');
  $('driveView')?.classList.add('has-section-speed');
  if($('sectionAverageSpeed'))$('sectionAverageSpeed').innerHTML=`${Math.round(avg)} <i>km/h</i>`;
  if($('sectionLimitSpeed'))$('sectionLimitSpeed').textContent=maxspeed?`${Math.round(maxspeed)} km/h`:'-- km/h';
  if($('sectionRemainDistance'))$('sectionRemainDistance').innerHTML=km(remain).replace(/(\d)(km|m)$/,'$1 <i>$2</i>');
  panel?.classList.toggle('over',maxspeed>0&&avg>maxspeed);
  setSectionOverspeedFlash(maxspeed>0&&avg>maxspeed);
  panel?.classList.toggle('nearing-end',remain<=1500);
  if(panel)panel.dataset.sectionState=(maxspeed>0&&avg>maxspeed)?'over':(remain<=1500?'ending':'normal');

  // 구간 진입 후 30초가 지나면 평균속도를 음성으로도 안내하고 이후 60초마다 갱신한다.
  if(elapsed>=10 && (!st.lastAverageSpokenAt||now-st.lastAverageSpokenAt>=20000)){
    st.lastAverageSpokenAt=now;
    const over=maxspeed>0&&avg>maxspeed;
    // 키가 분 단위였던 탓에 20초 주기로 말하려 해도 1분에 한 번만 안내되던 문제 → 20초 단위 키.
    speakNavOnce(
      `sectionavg:${st.id}:${Math.floor(elapsed/20)}`,
      `현재 구간 평균속도는 ${Math.round(avg)}킬로미터입니다.${over?' 제한속도를 초과했습니다. 감속하세요.':''}`,
      15000
    );
  }
}


function isGenericInstitutionDestination(dest){
  const t=`${dest?.name||''} ${dest?.address||''} ${dest?.category||''}`;
  const specific=/(후문|동문|서문|북문|남문|주차장|별관|본관|관사|연구동|사업소|센터동|사무동|제\d+.*건물|정문)/;
  const institution=/(공사|공단|청|시청|도청|군청|구청|대학교|대학|병원|연구원|박물관|기관|학교|법원|검찰청|경찰서|소방서|아파트|단지|공원|캠퍼스|공장|리조트|터미널)/;
  return institution.test(t)&&!specific.test(t);
}
function arrivalRadiusMeters(dest){return isGenericInstitutionDestination(dest)?120:50}
/* 7.6.11.5 경로 끝의 '도로명 없는 구내 진입 구간' 길이(m). 이 구간의 시작점이 정문/초입이다. */
function internalTailMeters(){
  const segs=state.route?.roadSegments||[],cum=state.routeCumulative||[],total=Number(cum.at(-1))||0;
  if(!segs.length||!total)return 0;
  let start=null;
  for(let i=segs.length-1;i>=0;i--){
    const sg=segs[i],nm=String(sg?.name||'').trim();
    if(nm&&!/구내|단지내|내부|주차장|진입로|캠퍼스/.test(nm))break;
    start=Number(sg.startIndex);
  }
  if(!Number.isFinite(start))return 0;
  const len=total-(Number(cum[start])||0);
  return len>=30&&len<=700?len:0;
}
function institutionArrivalLeadMeters(dest){
  if(!isGenericInstitutionDestination(dest))return 0;
  const t=`${dest?.name||''} ${dest?.address||''}`;
  // 대형 사업장·청사·단지 POI는 지도상의 중심점이 부지 안쪽에 잡히는 경우가 많다.
  // 내부 건물까지 안내하지 않고 정문·진입로 초입에서 안내를 종료한다.
  const base=/한국조폐공사|조폐공사/.test(t)?380:260;
  const tail=internalTailMeters();
  return tail>0?Math.max(tail+25,120):base;
}

function checkArrival(routeRemain){
  if(!state.tripStartedAt||!state.destination||!state.route?.geometry?.length)return false;
  const rawLat=Number.isFinite(state.user?.rawLat)?state.user.rawLat:Number(state.user?.lat);
  const rawLng=Number.isFinite(state.user?.rawLng)?state.user.rawLng:Number(state.user?.lng);
  if(!Number.isFinite(rawLat)||!Number.isFinite(rawLng))return false;

  // POI 중심점이 아니라 라우팅이 실제로 끝나는 도로 접근점(route end)을 우선 사용.
  const end=state.route.geometry.at(-1);
  const rawToRouteEnd=end?hav(rawLat,rawLng,end[1],end[0]):Infinity;
  const rawToPoi=hav(rawLat,rawLng,Number(state.destination.lat),Number(state.destination.lng));
  const speed=Math.max(0,Number(state.user?.speed)||0);

  // 본사/공장처럼 POI 중심이 건물 안쪽인 경우 정문·진입도로 endpoint 도착으로 종료.
  // 한국조폐공사처럼 부지가 넓은 공사·공단·청사 등은 정문 근처(더 넓은 반경)에서 종료하고,
  // 그 외 목적지는 목적지 주변(약 ±10m 여유를 둔 좁은 반경)에 오면 종료한다.
  const radius=arrivalRadiusMeters(state.destination);
  const lead=institutionArrivalLeadMeters(state.destination);
  const remain=Number(routeRemain);
  // 기관·공사·공단 등 대형 부지는 라우팅 endpoint가 부지 내부 건물까지 이어질 수 있다.
  // 이 경우 정문/진입도로에 해당하는 마지막 110~180m 구간에 들어오면 도착으로 판정한다.
  // 일반 목적지는 기존처럼 실제 endpoint/POI 근접을 기준으로 유지한다.
  const institutionGateReached=lead>0&&Number.isFinite(remain)&&remain<=lead&&rawToRouteEnd<=lead+90;
  const reached=institutionGateReached||(rawToRouteEnd<=radius)||(remain<=30&&rawToRouteEnd<=radius+25)||(rawToPoi<=Math.min(radius,35)&&remain<=100);
  if(!reached){state.arrivalCandidateSince=0;return false}

  // 정문/초입(institutionGateReached)에 들어서면 즉시 종료한다(대기·저속 조건 없음, 100km/h 초과만 오판 방지로 제외).
  if(institutionGateReached){if(!state.simulationActive&&speed>28)return false}
  else{
    if(!state.arrivalCandidateSince)state.arrivalCandidateSince=Date.now();
    // 실주행은 1초 연속 + 저/중속 확인. 모의주행은 경로상 도착권 진입 자체가 확정적이므로 즉시 종료한다.
    if(!state.simulationActive&&(Date.now()-state.arrivalCandidateSince<1000||speed>12))return false;
  }
  state.arrivalCandidateSince=0;
  speakNavOnce(`arrival:${state.destination.id||state.destination.name}`,'목적지에 도착했습니다.',0);
  if(state.simulationActive){
    if(state.simulationRaf)cancelAnimationFrame(state.simulationRaf);
    stopRouteSimulation({resumeGps:true});
    toast('모의주행 완료 · 실제 현재 위치로 복귀했습니다.',1800);
  }else setTimeout(stopNavigation,900);
  return true;
}


function fitManeuverDistanceText(){
  const el=$('maneuverDistance');
  const box=el?.closest('.maneuver-main');
  if(!el||!box)return;
  const len=String(el.textContent||'').replace(/\s+/g,'').length;
  box.classList.toggle('long-distance',len>=6);
  box.classList.toggle('very-long-distance',len>=8);
}

function updateProgressUI(idx,force=false){
  if(!state.simulationActive&&(state.drivePositionUncertain||state.wrongDirectionActive))return;
  const total=state.routeCumulative.at(-1)||state.route.distance||1;
  const locked=Number(state.user?.routeDistance);
  const done=Number.isFinite(locked)?Math.max(0,Math.min(total,locked)):(state.routeCumulative[idx]||0);
  const remain=Math.max(0,total-done);
  const ratio=Math.max(0,Math.min(1,remain/total));
  const remainSec=(state.route.duration||0)*ratio;

  $('remainingDistance').textContent=km(remain);
  $('remainingTime').textContent=mins(remainSec);
  setArrivalTime(remainSec,true);
  if($('driveDestinationName'))$('driveDestinationName').textContent=state.destination?.name||'목적지';
  if($('driveDestinationEta'))$('driveDestinationEta').textContent=`예상 도착 ${eta(remainSec)}`;

  const seg=(state.route.roadSegments||[]).find(s=>idx>=s.startIndex&&idx<=s.endIndex);
  $('currentRoadLabel').textContent=seg?.name||'일반도로';
  const limit=effectiveSpeedLimit(idx,seg);
  const speed=Math.max(0,Math.round((state.user.speed||0)*3.6));
  $('currentSpeed').textContent=speed;$('speedPanel').classList.remove('hidden');

  const safetyCandidates=computeSafetyCandidates(idx);
  renderSpeedOrSignBadge(limit,safetyCandidates);
  updateOverspeed(speed,limit);updateTrafficStatus(seg);renderTrafficRouteRail(idx);

  const guides=(state.route.guides||[])
    .filter(x=>Number(x.routeIndex)>idx)
    .filter(x=>distanceAlong(idx,Number(x.routeIndex))>=3);
  let first=guides[0],second=guides[1];
  if(first){
    const d=guideDisplayDistance(idx,first,remain);
    const distanceText=guideUiDistanceText(d);
    const guideText=guidePanelText(first);
    state.activeGuideSnapshot={routeIndex:Number(first.routeIndex),distanceText,guideText,type:first.type};
    $('maneuverIcon').innerHTML=turnSvg(first.type);
    $('maneuverDistance').textContent=distanceText;
    $('maneuverRoad').textContent=guideText;
    if($('maneuverSub'))$('maneuverSub').textContent=guideSubText(first,guideText);
    maybeSpeakGuide(first,d);
  }else{
    state.activeGuideSnapshot=null;
    $('maneuverIcon').innerHTML=turnSvg(0);
    $('maneuverDistance').textContent=remain<10?'곧 도착':km(remain);
    $('maneuverRoad').textContent='목적지까지 직진';
    if($('maneuverSub'))$('maneuverSub').textContent='';
  }

  if(second){
    const d2=Math.max(8,guideDisplayDistance(idx,second,remain));
    $('nextManeuver').classList.remove('hidden');
    $('nextManeuverIcon').innerHTML=turnSvg(second.type);
    $('nextManeuverDistance').textContent=km(d2);
    $('nextManeuverText').textContent=guidePanelText(second);
  }else $('nextManeuver').classList.add('hidden');

  updateSafetyUI(idx,safetyCandidates);updateSectionAverageSpeed(idx);updateLaneGuide(idx);updateVms(idx);updateDrivePoiUI(force);
  if(!$('drivePoiPanel')?.classList.contains('hidden'))layoutDrivePoiPanel();
  checkArrival(remain);
  fitManeuverDistanceText();
}
/* 좌측 하단 원형 배지: 제한속도 정보가 있으면 기존처럼 제한속도를 표시하고,
   없으면 원을 아예 숨긴 뒤 전방에서 가장 임박한 도로표지판(주의/보호구역/대형차 제한 등)이 있을 때만
   그 배지를 대신 보여준다. 어느 쪽도 없으면 원/배지를 모두 숨기고, 현재속도(km/h)만 계속 표시한다. */
function routeNumberFromRoadName(name=''){
  const m=String(name||'').match(/(?:국도|지방도|고속도로)?\s*(\d{1,4})\s*(?:번|호선)?/);
  return m?m[1]:'';
}

function renderSpeedOrSignBadge(limit,candidates){
  const circle=$('speedLimit')?.closest('.speed-limit'),badge=$('roadSignBadge');
  const cameraTypes=new Set(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','section_speed_end','bus_lane_camera','mobile_camera']);
  const camera=(candidates||[]).find(e=>cameraTypes.has(e?.type)&&Number(e.d)>=0&&Number(e.d)<=600);
  // 좌측 원형 제한속도는 '현재 주행 도로'의 제한속도만 표시한다.
  // 전방 카메라의 단속속도는 safetyAlert에서 별도 표기하여 현재 제한속도와 혼동하지 않는다.
  const syncedLimit=Number(limit);
  const hasLimit=Number(syncedLimit)>0;

  if(circle)circle.style.setProperty('display',hasLimit?'grid':'none','important');
  if($('speedLimit'))$('speedLimit').textContent=hasLimit?String(Math.round(Number(syncedLimit))):'--';

  // 좌측에는 제한속도만 표시. CCTV 아이콘은 중간 안전안내 레이어와 지도에서만 표시.
  if(badge){
    const sign=(!camera&&!hasLimit)?(candidates||[]).find(e=>e&&e.type!=='speed_limit'&&e.type!=='tunnel'):null;
    if(sign){
      const info=safetyLabel(sign);
      badge.className=`road-sign-badge ${info.kind}`;
      badge.innerHTML=`<b>${escapeHtml(info.icon)}</b><small>${escapeHtml(km(Math.max(10,Number(sign.d)||10)))}</small>`;
      badge.style.setProperty('display','grid','important');
    }else{
      badge.style.setProperty('display','none','important');
      badge.className='road-sign-badge hidden';
      badge.innerHTML='';
    }
  }
}
function distanceAlong(a,b){const ca=state.routeCumulative[Math.max(0,a)]||0,cb=state.routeCumulative[Math.min(state.routeCumulative.length-1,b)]||ca;return Math.max(0,cb-ca)}

const VOICE_SAFETY_TYPES=new Set([
  'speed_camera','signal_speed_camera','signal_camera',
  'bus_lane_camera','mobile_camera','section_speed_camera','section_speed_end',
  'school_zone','school_nearby','fog_zone','snow_ice_zone','heavy_rain_zone'
]);
function guideVoiceCategory(g){
  const text=`${g?.guidance||''} ${g?.name||''} ${g?.roadName||''}`.toLowerCase();
  const type=Number(g?.type);
  if(type===1||/좌회전/.test(text))return 'left';
  if(type===2||/우회전/.test(text))return 'right';
  if(/톨|요금소|toll/.test(text))return 'toll';
  if(/\bic\b|나들목|인터체인지/.test(text))return 'ic';
  if(/갈림|분기|방향|진입|출구|램프|junction|fork/.test(text)||[5,6,7,8,9,10,11,12,14,15].includes(type))return 'fork';
  return '';
}
function speakNavOnce(key,text,minGapMs=9000){
  const now=Date.now();
  state.navVoiceLastAt=state.navVoiceLastAt||0;
  state.navVoiceKeys=state.navVoiceKeys||new Set();
  if(state.navVoiceKeys.has(key)||now-state.navVoiceLastAt<minGapMs)return;
  state.navVoiceKeys.add(key);state.navVoiceLastAt=now;
  speak(text);
}
function guideDisplayDistance(idx,guide,remain){
  const at=finiteOrNull(state.user?.routeDistance);
  const gi=Number(guide?.routeIndex);
  const gd=Number(state.routeCumulative?.[Math.max(0,Math.min((state.routeCumulative?.length||1)-1,Math.round(gi)))]);
  const d=at!=null&&Number.isFinite(gd)?Math.max(0,gd-at):distanceAlong(idx,gi);
  if(d>=8)return d;
  // 동일/중복 routeIndex 때문에 0m가 나오는 경우 전체 남은거리 또는 다음 실제 geometry 거리 사용
  if(Number(remain)>8)return Math.min(Number(remain),Math.max(15,Number(guide?.distance)||Number(remain)));
  return Math.max(0,Number(remain)||0);
}
function guideUiDistanceMeters(d){
  const n=Math.max(10,Number(d)||10);
  if(n<100)return Math.max(10,Math.round(n/10)*10);
  if(n<1000)return Math.max(100,Math.round(n/10)*10);
  return Math.max(1000,Math.round(n/50)*50);
}
function guideUiDistanceText(d){const meters=guideUiDistanceMeters(d);return meters<1000?`${meters}m`:km(meters)}


function guidePanelText(g){
  const raw=String(g?.guidance||g?.name||g?.roadName||'').trim();
  if(raw)return raw;
  const cat=guideVoiceCategory(g);
  if(cat==='left')return '좌회전';
  if(cat==='right')return '우회전';
  if(cat==='toll')return '톨게이트';
  if(cat==='ic')return 'IC 진입';
  if(cat==='fork')return '갈림길 방향 확인';
  return '경로 안내';
}
/* 7.6.11.0 상단 턴 카드 3번째 줄: 경유 도로명 + 회전 방향 (실제 경로 데이터만 사용) */
function guideSubText(g,main=''){
  const cat=guideVoiceCategory(g);
  const word={left:'좌회전',right:'우회전',toll:'톨게이트 진입',ic:'IC 진입',fork:'갈림길 방향 확인'}[cat]||'';
  const via=[g?.name,g?.roadName].map(v=>String(v||'').trim()).filter((v,i,a)=>v&&v!==main&&a.indexOf(v)===i);
  const route=via.length?`${via.join(' · ')} 방면`:'';
  if(!word)return route;
  if(String(main).includes(word))return route;
  return route?`${route}으로 ${word}`:word;
}
function guideSpokenDistance(display=''){
  const s=String(display||'');
  if(/km$/i.test(s))return s.replace(/km$/i,'킬로미터');
  if(/m$/i.test(s))return s.replace(/m$/i,'미터');
  return s;
}

function maybeSpeakGuide(g,d){
  if(!state.simulationActive&&(state.drivePositionUncertain||state.wrongDirectionActive))return;
  const cat=guideVoiceCategory(g);
  if(!cat)return;
  const speedKmh=Math.max(0,(Number(state.user?.speed)||0)*3.6);
  const trigger=(cat==='ic'||cat==='fork'||cat==='toll')?(speedKmh>=70?450:300):(speedKmh>=60?260:190);
  if(d>trigger||d<8)return;
  const snap=state.activeGuideSnapshot;
  const displayDistance=snap?.routeIndex===Number(g?.routeIndex)?snap.distanceText:guideUiDistanceText(d);
  const displayText=snap?.routeIndex===Number(g?.routeIndex)?snap.guideText:guidePanelText(g);
  // 음성은 좌측(상단) 안내표지판에 보이는 거리와 안내문구를 그대로 읽는다.
  const text=`${guideSpokenDistance(displayDistance)} 앞 ${displayText}`;
  if(text)speakNavOnce(`guide:${g.id||g.routeIndex}:${cat}`,text,10000);
}
function updateTrafficStatus(seg){
  const el=$('trafficStatus');if(!el)return;
  const info=trafficClassFromValues(seg?.trafficSpeed,seg?.trafficState),sp=Math.round(Number(seg?.trafficSpeed)||0);
  el.className=`traffic-status traffic-${info.key}`;$('trafficStatusLabel').textContent=info.label;
  const spd=$('speedPanel');if(spd)spd.dataset.traffic=info.key;
  const detail=info.detail;
  $('trafficStatusDetail').textContent=sp>0?`${detail} · 평균 ${sp}km/h`:detail;
  if($('trafficFlowState'))$('trafficFlowState').textContent=info.label;
  if(info.key!=='unknown'&&info.key!==state.lastTrafficStatus){state.lastTrafficStatus=info.key;}
}

async function recenterAndCheckFastRoute(){
  if(state.simulationActive)stopRouteSimulation({resumeGps:true});
  if(!state.tripStartedAt){recenterDriveMap();return}
  const fresh=state.lastRawFix;
  if(fresh&&pointValid(fresh)&&Date.now()-Number(fresh.at||0)<30000){
    state.user={...(state.user||{}),lat:fresh.lat,lng:fresh.lng,rawLat:fresh.lat,rawLng:fresh.lng};
    ensureUserMarker();
  }
  recenterDriveMap();
  if(state.routeMode==='walk'||!state.destination||!state.route?.geometry?.length)return;
  if(Date.now()-Number(state.lastRealGpsAt||0)>30000){toast('GPS 위치 확인 후 빠른 경로를 재검토합니다.',2200);startWatch();return}
  // Traffic-aware route check; keep current route unless a verifiably faster route is returned.
  state.lastLiveRouteAt=0;
  await liveRouteRefresh();
}
function recenterDriveMap(){
  if(!state.user)return toast('현재 위치를 확인할 수 없습니다.');
  const g=state.route?.geometry||[],idx=state.currentRouteIndex||0,next=g[Math.min(g.length-1,idx+3)];
  const heading=Number.isFinite(state.user.heading)?state.user.heading:(next?bearing(state.user.lat,state.user.lng,next[1],next[0]):0);
  state.map?.easeTo({center:[state.user.lng,state.user.lat],zoom:driveMapZoom(),pitch:driveMapPitch(),bearing:heading,duration:350,padding:driveCameraPadding()});
  toast('현재 위치로 지도를 맞췄습니다.',1200);
}
async function reroute(originOverride=null){
  if(!state.user||!state.destination||state.rerouteBusy)return;
  state.rerouteBusy=true;
  state.lastRerouteAt=Date.now();
  try{
    const spec=routePreferenceSpec();
    const rawOrigin=pointValid(originOverride)?originOverride:{
      lng:Number.isFinite(state.user?.rawLng)?Number(state.user.rawLng):Number(state.user.lng),
      lat:Number.isFinite(state.user?.rawLat)?Number(state.user.rawLat):Number(state.user.lat),
      heading:Number(state.user?.heading)
    };
    const r=await routeRequest(spec.priority,state.routeMode==='walk'?null:spec.avoid,remainingWaypointsForReroute(),state.routeMode,rawOrigin);
    state.route={...r,_label:state.routeMode==='walk'?'도보 재탐색':`재탐색 · ${spec.label}`,_character:state.character};
    state.routeCumulative=buildCumulative(state.route);

    // 새 경로 시작점을 실제 현재 위치에 맞춰 즉시 초기화하여 캐릭터가 경로 밖/과거 경로에서 움직이지 않도록 한다.
    const initialMatch=directionAwareNearestPointOnRoute(
      rawOrigin.lng,rawOrigin.lat,Number(rawOrigin.heading),Math.max(3,Number(state.user?.speed)||0),
      state.route.geometry,60
    );
    const initialIndex=Math.max(0,Number(initialMatch?.index)||0);
    const initialDistance=Number(state.routeCumulative[initialIndex]||0);
    state.mapMatch={index:initialIndex,routeDistance:initialDistance,score:0,confidence:1,at:Date.now()};
    state.routeLockedDistance=initialDistance;state.routeLockedAt=Date.now();
    state.stationaryGpsAnchor=null;state.lockBehindHits=0;state.lockAheadHits=0;state.resyncPending=false;
    const rp=pointAtRouteDistance(initialDistance);
    if(rp){
      state.user={...state.user,lng:rp.lng,lat:rp.lat,routeIndex:rp.index,routeDistance:rp.distance,mapSnapped:true};
      state.driveMarkerTargetDistance=rp.distance;
      state.driveMarkerRenderedDistance=rp.distance;
    }

    drawRoute(state.route,{fit:false});
    await loadSafetyEvents(state.route);
    ensureUserMarker();
    updateDriving(true);
  }catch(e){
    console.warn('reroute failed',e);
  }finally{
    state.rerouteBusy=false;
  }
}
function checkOffRoute(idx){
  if(state.tunnelRouteLock?.active||state.gpsEstimated||state.user?.estimated||state.rerouteBusy||Date.now()-state.lastRerouteAt<1500){
    state.offRouteHits=0;state.offRouteSince=0;state.wrongWayHits=0;return;
  }
  const rawLat=Number.isFinite(state.user?.rawLat)?state.user.rawLat:Number(state.user?.lat);
  const rawLng=Number.isFinite(state.user?.rawLng)?state.user.rawLng:Number(state.user?.lng);
  const accuracy=Math.max(0,Number(state.user?.accuracy)||0);
  const speed=Math.max(0,Number(state.user?.speed)||0);
  const heading=Number(state.user?.heading);
  if(!Number.isFinite(rawLat)||!Number.isFinite(rawLng)||accuracy>30){
    state.offRouteHits=0;state.offRouteSince=0;state.wrongWayHits=0;return;
  }

  const rawMatch=directionAwareNearestPointOnRoute(rawLng,rawLat,heading,speed,state.route.geometry,50);
  const d=Number(rawMatch?.distance);
  const hd=Number.isFinite(heading)&&Number.isFinite(Number(rawMatch?.heading))
    ?angleDiff(heading,Number(rawMatch.heading))
    :0;

  // 오차 범위 바깥에 벗어난 경우 2회 GPS 확인 후 즉시 재탐색, 심한 이탈은 1회.
  const outside=Math.max(18,accuracy*1.6);
  if(Number.isFinite(d)&&d>outside&&speed>1){
    state.offRouteHits=(state.offRouteHits||0)+1;
    if(d>Math.max(65,accuracy*3)||state.offRouteHits>=2){
      state.offRouteHits=0;state.offRouteSince=0;state.wrongWayHits=0;
      reroute({lng:rawLng,lat:rawLat,heading});return;
    }
  }else state.offRouteHits=0;

  // 반대 차선/반대 방향 진입은 거리만으로는 이탈로 잡히지 않는 경우가 많다.
  // 6km/h 이상 주행 중 110° 이상 방향 불일치가 확인되면 빠르게 새 방향으로 경로를 교체한다.
  if(speed>=1.7&&hd>=110&&accuracy<=25){
    state.wrongWayHits=(state.wrongWayHits||0)+1;
    const strong=hd>=145&&accuracy<=18&&speed>=3;
    if(strong||state.wrongWayHits>=2){
      state.wrongWayHits=0;
      const projected=projectForward(rawLat,rawLng,heading,Math.max(speed,4),1.5);
      // 동일 도로의 양방향 차선이 매우 가까운 곳에서도 올바른 진행방향을 선택하도록
      // 현재점과 헤딩을 함께 넘기고, 약 1.5초 앞 위치도 출발점 보조로 사용한다.
      reroute({
        lng:Number.isFinite(projected?.lng)?projected.lng:rawLng,
        lat:Number.isFinite(projected?.lat)?projected.lat:rawLat,
        heading
      });
      return;
    }
  }else{
    state.wrongWayHits=0;
  }

  state.offRouteHits=0;state.offRouteSince=0;
}
function sampleRoutePoints(geometry,max=28){
  const g=geometry||[];if(!g.length)return[];if(g.length<=max)return g.map(p=>({lng:p[0],lat:p[1]}));
  return Array.from({length:max},(_,i)=>{const p=g[Math.round(i*(g.length-1)/(max-1))];return{lng:p[0],lat:p[1]}})
}
function buildTrafficSafetySamples(route,max=20){
  const g=route?.geometry||[],rows=(route?.roadSegments||[]).filter(x=>Number(x?.trafficState)>0||Number(x?.trafficSpeed)>0);if(!g.length||!rows.length)return[];
  const stride=Math.max(1,Math.ceil(rows.length/max)),out=[];
  for(let i=0;i<rows.length;i+=stride){const x=rows[i],a=Math.max(0,Number(x.startIndex)||0),b=Math.min(g.length-1,Number(x.endIndex)||a),p=g[Math.round((a+b)/2)];if(!p)continue;out.push({lng:p[0],lat:p[1],roadName:x.name||'',trafficState:Number(x.trafficState)||0,trafficSpeed:Number(x.trafficSpeed)||0})}
  return out.slice(0,max);
}
function eventPoint(x,route){
  let lng=Number(x?.lng??x?.lon??x?.x??x?.longitude),lat=Number(x?.lat??x?.y??x?.latitude);
  let routeIndex=Number(x?.routeIndex);
  if((!Number.isFinite(lng)||!Number.isFinite(lat))&&Number.isFinite(routeIndex)){const p=route?.geometry?.[Math.max(0,Math.min(route.geometry.length-1,routeIndex))];if(p){lng=Number(p[0]);lat=Number(p[1])}}
  return{lng,lat,routeIndex:Number.isFinite(routeIndex)?routeIndex:null};
}
function normalizeRouteSafety(route){
  const out=[];for(const x of (route?.safeties||[])){
    const p=eventPoint(x,route);if(!Number.isFinite(p.lng)||!Number.isFinite(p.lat))continue;
    const raw=`${x.type??''} ${x.category??''} ${x.name??''} ${x.description??''} ${x.enforcement??''}`.toLowerCase();let type='';
    if(/school|어린이|스쿨/.test(raw))type='school_zone';else if(/mobile|이동식/.test(raw)&&/camera|단속|speed/.test(raw))type='mobile_camera';else if(/signal|신호/.test(raw))type='signal_camera';else if(/camera|speed|단속|과속/.test(raw))type='speed_camera';if(!type)continue;
    out.push({id:`kakao:safety:${x.id??out.length}`,type,lng:p.lng,lat:p.lat,routeIndex:p.routeIndex,name:x.name||'',maxspeed:Number(x.speed_limit??x.speedLimit)||0,source:'Kakao road detail'});
  }
  for(const x of (route?.roadEvents||[])){
    const p=eventPoint(x,route);if(!Number.isFinite(p.lng)||!Number.isFinite(p.lat))continue;
    const raw=`${x.type??''} ${x.category??''} ${x.name??''} ${x.description??''} ${x.event_type??''} ${x.eventType??''}`.toLowerCase();let type='';
    if(/accident|collision|crash|사고/.test(raw))type='accident';else if(/construction|roadwork|work zone|공사/.test(raw))type='construction';else if(/mobile|이동식/.test(raw)&&/camera|단속|speed/.test(raw))type='mobile_camera';if(!type)continue;
    out.push({id:`kakao:event:${x.id??out.length}`,type,lng:p.lng,lat:p.lat,routeIndex:p.routeIndex,name:x.name||x.description||'',source:'Kakao road event'});
  }
  for(const seg of (route?.roadSegments||[])){if(Number(seg.trafficState)===6){const ri=Math.max(0,Number(seg.startIndex)||0),p=route.geometry?.[ri];if(p)out.push({id:`traffic-accident:${ri}`,type:'accident',lng:p[0],lat:p[1],routeIndex:ri,name:seg.name?`${seg.name} 사고/통행주의`:'사고 또는 통행 제한 구간',source:'Kakao traffic_state 6'})}}
  return out
}

function pointToRouteSegmentMeters(cam,a,b){
  const p={lat:Number(cam.lat),lng:Number(cam.lng)};
  const aa={lat:Number(a[1]),lng:Number(a[0])},bb={lat:Number(b[1]),lng:Number(b[0])};
  const lat0=p.lat*Math.PI/180,sx=111320*Math.cos(lat0),sy=110540;
  const px=p.lng*sx,py=p.lat*sy,ax=aa.lng*sx,ay=aa.lat*sy,bx=bb.lng*sx,by=bb.lat*sy;
  const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,vv=vx*vx+vy*vy,t=vv?Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv)):0;
  return Math.hypot(px-(ax+t*vx),py-(ay+t*vy));
}
function cameraMatchesRouteRoad(cam,geometry,index=null,maxMeters=38){
  if(!cam||!Array.isArray(geometry)||geometry.length<2)return false;
  let s=0,e=geometry.length-2;
  if(Number.isFinite(Number(index))){s=Math.max(0,Number(index)-12);e=Math.min(geometry.length-2,Number(index)+240)}
  let best=Infinity;
  for(let i=s;i<=e;i++){const d=pointToRouteSegmentMeters(cam,geometry[i],geometry[i+1]);if(d<best)best=d;if(best<=16)break}
  return best<=maxMeters;
}

async function loadSafetyEvents(route){
  const seq=++state.safetyRequestSeq;state.safetyEvents=[];state.lastSafetySpoken=new Set();hideSafetyAlert();clearSafetyMarkers();if(!route?.geometry?.length)return;
  const primary=normalizeRouteSafety(route);
  const official=await loadStaticCameraEvents(route).catch(e=>{console.warn('static camera merge failed',e);return []});
  // 보조 API 응답을 기다리는 동안(수 초) 카메라가 하나도 없어 '누락'되던 구간을 없애기 위해
  // 경로 기반/공식 카메라를 먼저 반영하고, 보조 이벤트가 오면 병합본으로 교체한다.
  if(seq===state.safetyRequestSeq&&state.route===route){
    try{
      const early=enforceCameraMinSpacing(mergeSafetyEvents([...primary,...official],route.geometry));
      if(early.length){state.safetyEvents=early;renderSafetyMarkers();if(state.currentRouteIndex>=0)updateSafetyUI(state.currentRouteIndex)}
    }catch(e){console.warn('early camera apply failed',e)}
  }
  let supplemental=[];
  try{
    const r=await fetch('/api/safety',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points:sampleRoutePoints(route.geometry),trafficSamples:buildTrafficSafetySamples(route)})});
    const d=await r.json().catch(()=>({events:[]}));if(seq!==state.safetyRequestSeq||state.route!==route)return;
    supplemental=Array.isArray(d?.events)?d.events:[];
    const regionalSectionNodes=[];
    const regionalOthers=[];
    for(const e of supplemental){
      if(e?.type==='section_speed_camera'&&(e.sectionPosition==='start'||e.sectionPosition==='end')){
        const m=cameraRouteMatch(Number(e.lng),Number(e.lat),route,Number.isFinite(Number(e.heading))?Number(e.heading):null);
        if(m&&Number(m.distance)<=60){
          regionalSectionNodes.push({...e,routeIndex:Number(m.index),routeDistance:Number(m.routeDistance),snapLng:m.lng,snapLat:m.lat,routeHeading:Number(m.heading),matchDistance:Number(m.distance),sectionLengthMeters:Number(e.sectionLengthMeters)||0});
        }
      }else if(e?.type!=='section_speed_camera')regionalOthers.push(e);
    }
    supplemental=[...regionalOthers,...buildSectionSpeedEvents(regionalSectionNodes,route)];
  }catch(e){if(seq!==state.safetyRequestSeq||state.route!==route)return;console.warn('supplemental safety fetch failed',e)}
  if(seq!==state.safetyRequestSeq||state.route!==route)return;
  let merged=mergeSafetyEvents([...primary,...official,...supplemental],route.geometry);
  // 후처리 단계에서 예외가 나도 병합된 카메라는 그대로 유지한다.
  for(const step of [
    m=>suppressPostSectionDuplicateCameras(m),
    m=>suppressStaleNamedDuplicateCameras(m),
    m=>mergeSafetyEvents(m,route.geometry),
    m=>suppressPostSectionDuplicateCameras(m),
    m=>suppressStaleNamedDuplicateCameras(m),
    m=>enforceCameraMinSpacing(m)
  ]){try{const r=step(merged);if(Array.isArray(r))merged=r}catch(e){console.warn('[JOFAMS camera] post-merge step failed',e)}}
  const mergedCameraCount=merged.filter(e=>String(e.type||'').includes('camera')||e.type==='section_speed_end').length;
  if(mergedCameraCount===0&&official.length){
    console.warn('[JOFAMS camera] merged camera count is zero; restoring official route cameras directly');
    const nonCamera=merged.filter(e=>!(String(e.type||'').includes('camera')||e.type==='section_speed_end'));
    const officialCameras=official.filter(e=>String(e.type||'').includes('camera')||e.type==='section_speed_end');
    merged=[...nonCamera,...officialCameras].sort((a,b)=>(Number(a.routeIndex)||0)-(Number(b.routeIndex)||0));
  }
  state.safetyEvents=merged;
  loadItsTraffic(route).then(()=>{if(state.tripStartedAt)updateDriving(true)}).catch(()=>{});
  applyRouteSpeedLimitHints(route,merged);
  renderSafetyMarkers();
  // Android WebView/MapLibre에서 경로 직후 DOM marker 배치가 유실되는 경우 재렌더링.
  setTimeout(()=>{
    if(seq===state.safetyRequestSeq&&state.route===route&&state.route?.geometry?.length&&state.safetyEvents?.length)renderSafetyMarkers();
  },350);
  setTimeout(()=>{
    if(seq===state.safetyRequestSeq&&state.route===route&&state.route?.geometry?.length&&state.safetyEvents?.length)renderSafetyMarkers();
  },1200);
  if(state.currentRouteIndex>=0)updateSafetyUI(state.currentRouteIndex)
}
/* 7.6.11.4 같은 지점(경로 기준 45m 이내)의 과속/신호/교통 단속 레코드는 물리적으로 카메라 1대로 병합한다.
   (출처 다중·양방향·다차로 레코드가 한꺼번에 서너 개씩 나타나던 문제) 신호+과속이 함께 있으면 신호·과속 겸용으로 표기. */
const PHYSICAL_SPEED_FAMILY=new Set(['speed_camera','signal_speed_camera','signal_camera','traffic_camera']);
function clusterPhysicalCameras(events,rank=()=>0){
  const rest=[],cams=[];
  for(const e of events){if(PHYSICAL_SPEED_FAMILY.has(e.type)&&Number.isFinite(Number(e.routeDistance)))cams.push(e);else rest.push(e)}
  cams.sort((a,b)=>a.routeDistance-b.routeDistance);
  const groups=[];
  for(const e of cams){
    const g=groups[groups.length-1];
    if(!g){groups.push([e]);continue}
    const ref=g[0],routeGap=Math.abs(Number(e.routeDistance)-Number(ref.routeDistance));
    const physicalGap=Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lng))&&Number.isFinite(Number(ref.lat))&&Number.isFinite(Number(ref.lng))
      ?hav(Number(e.lat),Number(e.lng),Number(ref.lat),Number(ref.lng)):Infinity;
    // 같은 물리 단속지점이 여러 기관/방향/출처로 중복된 경우 하나로 병합한다.
    // 회덕IC처럼 10~수십m 간격으로 3개 핀이 연속 표시되는 현상을 차단한다.
    if(routeGap<=60||physicalGap<=60)g.push(e);else groups.push([e]);
  }
  const out=[...rest];
  for(const g of groups){
    if(g.length===1){out.push(g[0]);continue}
    // 경로 선에서 가장 가까운(좌표가 정확한) 레코드를 대표로, 동률이면 출처 우선순위.
    g.sort((a,b)=>((Number(a.routeMatchDistance)||0)+rank(a)*6)-((Number(b.routeMatchDistance)||0)+rank(b)*6));
    const best={...g[0]};
    const hasSignal=g.some(x=>x.type==='signal_camera'||x.type==='signal_speed_camera'),hasSpeed=g.some(x=>x.type==='speed_camera'||x.type==='signal_speed_camera'||x.type==='traffic_camera');
    if(hasSignal&&hasSpeed)best.type='signal_speed_camera';
    if(!(Number(best.maxspeed)>0)){const m=g.find(x=>Number(x.maxspeed)>0);if(m)best.maxspeed=m.maxspeed}
    out.push(best);
  }
  return out;
}
function suppressPostSectionDuplicateCameras(events=[]){
  const sorted=[...(events||[])].sort((a,b)=>(Number(a.routeDistance)||0)-(Number(b.routeDistance)||0));
  const sectionEnds=sorted.filter(e=>e.type==='section_speed_end'&&Number.isFinite(Number(e.routeDistance)));
  if(!sectionEnds.length)return sorted;
  return sorted.filter(e=>{
    if(!PHYSICAL_SPEED_FAMILY.has(e.type)||!Number.isFinite(Number(e.routeDistance)))return true;
    const rd=Number(e.routeDistance);
    for(const end of sectionEnds){
      const gap=rd-Number(end.routeDistance);
      // 구간단속 종점 직후 220m 안에서 같은 제한속도(주로 80km/h)로 연달아 잡히는 일반카메라는
      // 종점 장비의 중복/차로별 레코드로 취급해 한 번만 보이게 한다.
      if(gap>=-20&&gap<=CAMERA_MIN_SPACING_M){
        const sameLimit=!Number(end.maxspeed)||!Number(e.maxspeed)||Number(end.maxspeed)===Number(e.maxspeed);
        const sameRoad=!end.roadName||!e.roadName||normalizeRoadName(end.roadName)===normalizeRoadName(e.roadName);
        if(sameLimit&&(sameRoad||gap<=120))return false;
      }
      /* 7.6.13.1: 구간단속 종점 직전 250m 이내에도, 같은 지점을 가리키는 구버전/타기관(비경찰청) 중복
         레코드가 별도 관리번호의 개별 카메라로 남아있는 사례가 있었다(예: 세종→대전 종점 '시알들네거리
         합류지점'이 경찰청 최신 데이터의 종점과 대전광역시 2022년 구버전 데이터에 각각 등록되어 종점
         통과 직전 카메라 2개가 겹쳐 보임). currentOfficial(2025년 이후 경찰청 데이터)인 개별 카메라는
         실제로 별도 지점일 수 있으므로 건드리지 않고, 구버전/타기관 레코드에 한해서만 접는다. */
      if(!e.currentOfficial&&gap<-20&&gap>=-60){
        const sameLimit=!Number(end.maxspeed)||!Number(e.maxspeed)||Number(end.maxspeed)===Number(e.maxspeed);
        const sameRoad=!end.roadName||!e.roadName||normalizeRoadName(end.roadName)===normalizeRoadName(e.roadName);
        if(sameLimit&&sameRoad)return false;
      }
    }
    return true;
  });
}
function addUserConfirmedHoedeokCamera(events=[],route){
  // 사용자 실주행 확인: 회덕IC S-OIL(갑천도시고속도로 1084) 통과 후 대전방향 80km/h 과속카메라.
  // 최신 공공 원천/보조 API가 누락해도 선택 경로 위에 1회만 표시하도록 보정한다.
  const g=route?.geometry||[];if(g.length<2)return events;
  const seed={lat:36.39145,lng:127.41314}; // 회덕IC주유소 바로 남측 도로축 기준점
  // 7.6.11.9: nearestPointOnRoute 는 routeDistance 를 반환하지 않아 이 보정이 항상 조용히 무시되었다 → routePosOfPoint 사용
  const m=routePosOfPoint(seed.lng,seed.lat,g,null,150);if(!m||Number(m.distance)>120)return events;
  const rh=Number(m.heading??routeHeadingAtIndex(g,m.index));
  // 세종→대전(대체로 남행)일 때만 추가한다. 반대편 대전→세종에는 표시하지 않는다.
  if(Number.isFinite(rh)&&!(rh>=105&&rh<=255))return events;
  const rd=Number(m.routeDistance);
  if(!Number.isFinite(rd))return events;
  const nearby=(events||[]).some(e=>PHYSICAL_SPEED_FAMILY.has(e.type)&&Number.isFinite(Number(e.routeDistance))&&Math.abs(Number(e.routeDistance)-rd)<=180);
  if(nearby)return events;
  return [...events,{
    id:'user-confirmed:hoedeok-ic-southbound-80',type:'speed_camera',lat:Number(m.lat),lng:Number(m.lng),routeIndex:Number(m.index),routeDistance:rd,
    snapLng:Number(m.lng),snapLat:Number(m.lat),routeMatchDistance:Number(m.distance)||0,routeHeading:rh,maxspeed:80,
    roadName:'갑천도시고속도로',name:'회덕IC주유소 지난 후 과속단속카메라',source:'사용자 실주행 확인 위치 보정',userConfirmed:true
  }];
}
function mergeSafetyEvents(events,geometry){
  const priority=e=>{
    const s=String(e?.source||'');
    if(/sejong|daejeon/i.test(s))return 0;
    if(/national-unmanned/i.test(s))return 1;
    if(/전국무인교통단속|bundled|official/i.test(s))return 2;
    if(/Kakao/i.test(s))return 3;
    if(/OpenStreetMap/i.test(s))return 6;
    return 4;
  };
  const sorted=[...(events||[])].sort((a,b)=>priority(a)-priority(b));
  const seen=new Set(),out=[];
  for(const e of sorted){
    let lng=Number(e.lng),lat=Number(e.lat),idx=Number(e.routeIndex);
    if((!Number.isFinite(lng)||!Number.isFinite(lat))&&Number.isFinite(idx)){
      const rp=geometry[Math.max(0,Math.min(geometry.length-1,idx))];if(rp){lng=rp[0];lat=rp[1]}
    }
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    let rm=null;
    const isCamera=String(e.type||'').includes('camera')||e.type==='section_speed_end';
    if(isCamera){
      // 명시적 카메라 진행방향이 경로 진행방향과 반대면 제외한다.
      if(!cameraEventDirectionCompatible(e,geometry))continue;
      // loadStaticCameraEvents/buildSectionSpeedEvents에서 이미 routeIndex가 확정된 항목은
      // 두 번째 거리 필터를 적용하지 않는다. 이중 필터 때문에 실제 카메라가 전부 사라질 수 있었다.
      if(Number.isFinite(idx)&&geometry[Math.max(0,Math.min(geometry.length-1,idx))]){
        const rp=geometry[Math.max(0,Math.min(geometry.length-1,idx))];
        rm={index:idx,distance:Number(e.routeMatchDistance)||0,heading:null,lng:rp[0],lat:rp[1]};
      }else{
        rm=cameraRouteMatch(lng,lat,state.route,Number.isFinite(Number(e.heading))?Number(e.heading):null);
        if(!rm||Number(rm.distance)>60)continue;
        idx=Number(rm.index);
      }
    }else if(!Number.isFinite(idx))idx=nearestIndex(lng,lat,geometry);
    /* 7.6.11.3: 카메라는 경로 선 위의 정확한 투영 위치(routeDistance)와 스냅 좌표를 함께 보관한다. */
    let routeDistance=Number(e.routeDistance),snapLng=Number(e.snapLng),snapLat=Number(e.snapLat);
    if(isCamera&&!Number.isFinite(routeDistance)){
      const pm=routePosOfPoint(lng,lat,geometry,Number.isFinite(Number(e.heading))?Number(e.heading):null,250);
      if(pm&&(!Number.isFinite(idx)||Math.abs(pm.index-idx)<=8)){routeDistance=pm.routeDistance;snapLng=pm.lng;snapLat=pm.lat;if(!Number.isFinite(idx))idx=pm.index}
    }
    if(!Number.isFinite(routeDistance)&&Number.isFinite(idx)){const cm=cumForGeometry(geometry);routeDistance=Number(cm[Math.max(0,Math.min(cm.length-1,idx))])}
    const coordKey=`${Math.round(lat*100000)}:${Math.round(lng*100000)}`;
    const family=(e.type==='section_speed_camera'||e.type==='section_speed_end')?'section':String(e.type||'').replace('signal_speed_camera','speed_camera');
    const k=`${family}:${coordKey}`;
    if(seen.has(k))continue;seen.add(k);
    out.push({...e,lng,lat,routeIndex:idx,routeMatchDistance:Number(rm?.distance)||0,...(Number.isFinite(routeDistance)?{routeDistance}:{}),...(Number.isFinite(snapLng)&&Number.isFinite(snapLat)?{snapLng,snapLat}:{})});
  }
  return clusterPhysicalCameras(out,priority).sort((a,b)=>(Number.isFinite(a.routeDistance)&&Number.isFinite(b.routeDistance))?a.routeDistance-b.routeDistance:a.routeIndex-b.routeIndex)
}
/* 경로 기준 50m 이내에 단속카메라가 연달아 나오지 않게 한다(지도 핀·안내 카드·음성 공통).
   구간단속 시작/종료 노드는 구간 안내의 기준점이라 지우지 않고, 그 50m 안의 일반 카메라를 접는다.
   우선순위: 신호·과속 > 일반 과속/신호/교통 > 이동식 > 버스전용. */
const CAMERA_MIN_SPACING_M=50;
function enforceCameraMinSpacing(events=[],minGap=CAMERA_MIN_SPACING_M){
  const isCam=e=>String(e?.type||'').includes('camera')||e?.type==='section_speed_end';
  const isSection=e=>e?.type==='section_speed_camera'||e?.type==='section_speed_end';
  const rank=e=>({signal_speed_camera:0,speed_camera:1,signal_camera:1,traffic_camera:2,mobile_camera:3,bus_lane_camera:4})[e?.type]??5;
  const cams=[],rest=[];
  for(const e of events||[]){if(isCam(e)&&Number.isFinite(Number(e.routeDistance)))cams.push(e);else rest.push(e)}
  cams.sort((a,b)=>Number(a.routeDistance)-Number(b.routeDistance));
  const out=[];
  for(const e of cams){
    const prev=out[out.length-1];
    if(!prev||Math.abs(Number(e.routeDistance)-Number(prev.routeDistance))>=minGap){out.push(e);continue}
    if(isSection(prev)&&isSection(e)){out.push(e);continue}        // 시작/종료 노드끼리는 유지
    if(isSection(prev))continue;                                    // 구간 노드 우선
    if(isSection(e)){out[out.length-1]=e;continue}
    if(rank(e)<rank(prev)){out[out.length-1]={...e,maxspeed:Number(e.maxspeed)||Number(prev.maxspeed)||e.maxspeed}}
    else if(!(Number(prev.maxspeed)>0)&&Number(e.maxspeed)>0)prev.maxspeed=e.maxspeed;
  }
  return [...rest,...out].sort((a,b)=>(Number.isFinite(Number(a.routeDistance))&&Number.isFinite(Number(b.routeDistance)))?Number(a.routeDistance)-Number(b.routeDistance):(Number(a.routeIndex)||0)-(Number(b.routeIndex)||0));
}
/* 7.6.11.5 이미 지나친 카메라 핀은 숨긴다. */
/* v7.6.27.0: 카메라는 DOM Marker가 아닌 지도 GeoJSON 심볼이다.
   경로상 실좌표가 지도 타일과 동일한 행렬로 투영되므로 줌/팬/회전 시 고정된다. */
const ROUTE_CAMERA_SOURCE='dangollo-route-camera-fixed-source';
const ROUTE_CAMERA_LAYER='dangollo-route-camera-fixed-symbol';
const ROUTE_CAMERA_PREFIX='dangollo-route-camera-icon-';
let fixedRouteCameraFeatures=[];
let fixedRouteCameraMap=null;
function routeCameraGeojson(features=[]){return {type:'FeatureCollection',features};}
let fixedCameraVisibleSignature='';
let fixedCameraVisibleSource=null;
function updateSafetyMarkerVisibility(){
  const source=state.map?.getSource?.(ROUTE_CAMERA_SOURCE);
  if(!source)return;
  const current=finiteOrNull(state.user?.routeDistance);
  // A fixed set of route cameras; movement does not recreate the MapLibre source every GPS tick.
  // A small backward buffer avoids symbol removal/reappearance caused by map-matching jitter.
  const visible=(!state.tripStartedAt||state.routeMode!=='car'||$('driveView')?.classList.contains('hidden')||state.wrongDirectionActive)?[]:
    fixedRouteCameraFeatures.filter(f=>current===null||(Number(f.properties.routeM)>=current-85&&Number(f.properties.routeM)<=current+3200));
  const signature=visible.map(f=>String(f.properties.icon)+':'+String(Math.round(Number(f.properties.routeM)))).join('|');
  if(source===fixedCameraVisibleSource&&signature===fixedCameraVisibleSignature)return;
  try{
    source.setData(routeCameraGeojson(visible));
    fixedCameraVisibleSource=source;fixedCameraVisibleSignature=signature;
  }catch(e){console.warn('fixed camera source update failed',e)}
}

function clearSafetyMarkers(){
  // 이전 버전 HTML 마커도 제거해 겹침을 근본적으로 차단한다.
  for(const m of state.safetyMarkers||[])try{m.remove()}catch{}
  state.safetyMarkers=[];fixedRouteCameraFeatures=[];fixedCameraVisibleSignature='';fixedCameraVisibleSource=null;
  try{state.map?.getSource?.(ROUTE_CAMERA_SOURCE)?.setData(routeCameraGeojson())}catch{}
}
function cameraIconImageData(speed){
  const canvas=document.createElement('canvas');canvas.width=92;canvas.height=92;
  const c=canvas.getContext('2d');if(!c)return null;
  c.clearRect(0,0,92,92);
  c.shadowColor='rgba(11,24,37,.28)';c.shadowBlur=7;c.shadowOffsetY=3;
  c.fillStyle='#ffffff';c.strokeStyle='#d53145';c.lineWidth=5;
  c.beginPath();c.roundRect(8,8,69,69,17);c.fill();c.shadowColor='transparent';c.stroke();
  // 직접 그린 카메라 픽토그램: 외부 SVG/CSS·이모지 폰트 의존성 없음.
  c.fillStyle='#152b43';c.beginPath();c.roundRect(22,30,42,26,5);c.fill();
  c.beginPath();c.moveTo(28,30);c.lineTo(35,22);c.lineTo(47,22);c.lineTo(53,30);c.closePath();c.fill();
  c.fillStyle='#ffffff';c.beginPath();c.arc(43,43,9,0,Math.PI*2);c.fill();
  c.fillStyle='#152b43';c.beginPath();c.arc(43,43,5,0,Math.PI*2);c.fill();
  if(speed>0){
    c.fillStyle='#ffffff';c.strokeStyle='#d53145';c.lineWidth=4;
    c.beginPath();c.arc(71,69,17,0,Math.PI*2);c.fill();c.stroke();
    c.font='bold 17px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#b31e30';
    c.fillText(String(speed),71,70);
  }
  return c.getImageData(0,0,92,92);
}
/* v7.6.27.2: 도로/경로선 → 방향 화살표 → 카메라 → 차량 캐릭터 순서를 유지한다.
   MapLibre symbol layer는 DOM z-index가 아닌 style.layers 순서로 그려진다.
   끝점(symbol)이 있을 땐 바로 그 아래, 없으면 최상위 WebGL 레이어에 둔다.
   차량은 DOM MapLibre Marker이므로 WebGL 캔버스보다 항상 위에 남는다. */
function ensureRouteCameraStackOrder(){
  const map=state.map;
  if(!map?.getLayer?.(ROUTE_CAMERA_LAYER))return;
  try{
    // MapLibre draws later style layers above earlier ones. Restore all four levels,
    // including after setStyle(), endpoint refresh, route traffic redraw.
    const order=['route-shadow','route-main','route-traffic','route-direction-arrows',ROUTE_CAMERA_LAYER,'dangollo-endpoint-pin-icon'];
    for(const id of order)if(map.getLayer(id))map.moveLayer(id);
    // Character DOM marker is above WebGL canvas; never alter its transform/z-index.
  }catch(e){console.warn('route camera stack order failed',e)}
}

function ensureFixedCameraLayer(features){
  const map=state.map;if(!map?.isStyleLoaded?.())return false;
  try{
    if(!map.getSource(ROUTE_CAMERA_SOURCE))map.addSource(ROUTE_CAMERA_SOURCE,{type:'geojson',data:routeCameraGeojson()});
    for(const f of features){
      const name=f.properties.icon;
      if(!map.hasImage(name)){
        const img=cameraIconImageData(Number(f.properties.speed)||0);
        if(img)map.addImage(name,img,{pixelRatio:2});
      }
    }
    if(!map.getLayer(ROUTE_CAMERA_LAYER))map.addLayer({
      id:ROUTE_CAMERA_LAYER,type:'symbol',source:ROUTE_CAMERA_SOURCE,
      layout:{'icon-image':['get','icon'],'icon-size':0.95832,'icon-anchor':'center',
        'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'viewport',
        'icon-pitch-alignment':'viewport'},
      paint:{'icon-opacity':1}
    });
    ensureRouteCameraStackOrder();
    fixedRouteCameraMap=map;
    return true;
  }catch(e){console.warn('fixed camera map layer failed',e);return false}
}

function cameraClusterItemsByPixel(items){
  return clusterMapItemsByPixel(items,62);
}
function renderCameraClusterMarkers(items){
  const clusters=cameraClusterItemsByPixel(items);
  for(const c of clusters){
    // 단독 1개는 클러스터가 아니라 기존 CCTV 아이콘을 그대로 표시
    if(c.count===1){
      const e=c.items[0],limit=Number(e.maxspeed)||0,el=document.createElement('div');
      el.className=`safety-map-marker speed-limit-marker camera-${e.type}${e.type==='mobile_camera'?' mobile':''}`;
      el.title=e.type==='signal_speed_camera'?'신호·과속 단속':e.type==='signal_camera'?'신호 단속':e.type==='speed_camera'?'과속 단속':'단속 안내';
      el.innerHTML=limit>0
        ?`<span class="speed-limit-ring"><small>제한</small><strong>${Math.round(limit)}</strong></span>`
        :`<span class="speed-limit-ring no-limit"><small>단속</small><strong>!</strong></span>`;
      try{
        const marker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([e.lng,e.lat]).addTo(state.map);
        const markerEl=marker.getElement?.();
        if(markerEl){
          markerEl.style.zIndex='40';
          markerEl.style.visibility='visible';
          markerEl.style.opacity='1';
          markerEl.style.pointerEvents='none';
        }
        state.safetyMarkers.push(marker);
      }catch{}
      continue;
    }
    const el=document.createElement('button');
    el.type='button';
    const size=c.count>=20?'large':c.count>=7?'medium':'small';
    el.className=`camera-cluster-marker ${size}`;
    el.title=`단속카메라 ${c.count}개`;
    el.innerHTML=`<strong>${c.count>99?'99+':c.count}</strong>`;
    el.onclick=e=>{
      e.stopPropagation();
      const lngs=c.items.map(x=>Number(x.lng)).filter(Number.isFinite),lats=c.items.map(x=>Number(x.lat)).filter(Number.isFinite);
      if(!lngs.length||!lats.length)return;
      try{state.map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:70,maxZoom:17,duration:420})}catch{}
    };
    try{state.safetyMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([c.lng,c.lat]).addTo(state.map))}catch{}
  }
}

function cameraDisplayPriority(e){
  return ({signal_speed_camera:0,section_speed_camera:1,section_speed_end:1,speed_camera:2,signal_camera:3,traffic_camera:4,mobile_camera:5,bus_lane_camera:6})[e?.type]??9;
}
/* v7.6.27.0 - 지도 카메라 표시의 단일 진실원: 현재 선택 경로의 실제 좌표.
   CSS로 떨어진 핀을 숨기는 대신 원본 좌표→경로 투영을 매번 재검증한다.
   신뢰할 수 없는 카메라는 아예 마커를 생성하지 않는다. */
function strictCameraProjection(lng,lat,geometry,maxOffset=24){
  if(!Number.isFinite(lng)||!Number.isFinite(lat)||!Array.isArray(geometry)||geometry.length<2)return null;
  const cum=cumForGeometry(geometry);let best=null,bestOffset=Infinity;
  // 정점 간 선분 전체를 검사한다. 오래된 routeIndex, 임의 snapLng, 다른 경로 누적거리 재사용 금지.
  const latSpan=maxOffset/110540+0.00005;
  const lngSpan=maxOffset/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)))+0.00005;
  for(let i=1;i<geometry.length;i++){
    const a=geometry[i-1],b=geometry[i];
    if(Math.abs(lat-Math.min(a[1],b[1]))>latSpan&&lat<Math.min(a[1],b[1]))continue;
    if(lat>Math.max(a[1],b[1])+latSpan||lat<Math.min(a[1],b[1])-latSpan)continue;
    if(lng>Math.max(a[0],b[0])+lngSpan||lng<Math.min(a[0],b[0])-lngSpan)continue;
    const proj=projectPointToSegmentDetailed(lng,lat,a,b);
    const offset=hav(lat,lng,proj.lat,proj.lng);
    if(offset<bestOffset){
      bestOffset=offset;
      const t=Math.max(0,Math.min(1,Number(proj.t)||0));
      best={lng:proj.lng,lat:proj.lat,index:i,distance:offset,
        heading:bearing(a[1],a[0],b[1],b[0]),
        routeDistance:Number(cum[i-1]||0)+t*(Number(cum[i]||0)-Number(cum[i-1]||0))};
    }
  }
  return best&&bestOffset<=maxOffset?best:null;
}
function routeSnappedCameraItems(items){
  const geometry=state.route?.geometry||[];
  if(geometry.length<2)return [];
  const filtered=[];
  for(const e of items||[]){
    // 원본 좌표가 없으면 검증 불가. 이미 스냅된 좌표를 검증에 재사용하면 옆길 카메라가 살아남는다.
    const rawLng=Number(e.originalLng??e.rawLng??e.lng);
    const rawLat=Number(e.originalLat??e.rawLat??e.lat);
    const section=e.type==='section_speed_camera'||e.type==='section_speed_end';
    const hit=strictCameraProjection(rawLng,rawLat,geometry,section?30:24);
    if(!hit)continue;
    if(e.cameraDirectionReliable===true){
      const h=Number(e.cameraHeading);
      if(Number.isFinite(h)&&angleDiff(h,hit.heading)>cameraHeadingToleranceDeg(e.cameraHeadingPrecise===true))continue;
    }
    filtered.push({...e,lng:hit.lng,lat:hit.lat,routeIndex:hit.index,
      routeDistance:hit.routeDistance,__routeM:hit.routeDistance,__rawOffset:hit.distance});
  }
  filtered.sort((a,b)=>a.__routeM-b.__routeM||cameraDisplayPriority(a)-cameraDisplayPriority(b));
  const unique=[];
  for(const e of filtered){
    const prior=unique.at(-1);
    if(prior&&Math.abs(e.__routeM-prior.__routeM)<45){
      if(cameraDisplayPriority(e)<cameraDisplayPriority(prior))unique[unique.length-1]=e;
    }else unique.push(e);
  }
  return unique;
}

function renderSafetyMarkers(){
  if(!state.map||!maplibregl?.Marker)return;
  clearSafetyMarkers();
  if(!state.tripStartedAt||state.routeMode!=='car'||$('driveView')?.classList.contains('hidden')||state.wrongDirectionActive)return;
  const skip=['speed_limit','tunnel','curve_left','curve_right','double_curve','chronic_congestion'];
  /* 7.6.11.5 지도에는 안내 팝업이 뜨는 신호·속도·구간단속 카메라만 표시한다(이동식/버스전용차로 및 카메라 외 안전 마커 제거). */
  const cameraTypes=new Set(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','section_speed_end']);
  const cameraItems=[];

  // Source cameras with raw coordinates are matched to the currently selected route only.
  for(const e of state.safetyEvents||[]){
    if(skip.includes(e.type)||!cameraTypes.has(e.type))continue;
    if(state.wrongDirectionActive&&!state.simulationActive)continue;
    cameraItems.push(e);
  }

  // 카메라는 실제 원본 좌표가 도로 가장자리여도 경로 선 정중앙으로 스냅하고,
  // 같은 진행 위치(약 32m)에 여러 레코드가 있어도 CCTV SVG 하나만 표시한다.
  const allMatchedCameraItems=routeSnappedCameraItems(cameraItems);
  const driveM=finiteOrNull(state.user?.routeDistance);
  // 주행 시에는 지나친 지점과 지나치게 멀리 앞선 카메라까지 한꺼번에 그리지 않는다.
  const routeCameraItems=driveM===null?allMatchedCameraItems:
    allMatchedCameraItems.filter(e=>e.__routeM>=driveM-35&&e.__routeM<=driveM+3000);
  if(state.route?.geometry?.length){
    console.info('[JOFAMS camera]',{
      safetyEvents:(state.safetyEvents||[]).length,
      cameraCandidates:cameraItems.length,
      routeCameraMarkers:routeCameraItems.length
    });
  }

  // HTML Marker를 생성하지 않는다. 지도 경로선에 정확히 붙는 MapLibre 심볼만 사용.
  const features=allMatchedCameraItems.map((e,i)=>{
    const speed=Number(e.maxspeed);
    // 심볼의 숫자 배지 이미지 재활용. 숫자·속도 오인 방지를 위해 유효한 상식적 범위만 사용.
    const displayedSpeed=Number.isFinite(speed)&&speed>=20&&speed<=130?Math.round(speed):0;
    return {type:'Feature',id:i,geometry:{type:'Point',coordinates:[Number(e.lng),Number(e.lat)]},
      properties:{routeM:Number(e.__routeM),speed:displayedSpeed,icon:ROUTE_CAMERA_PREFIX+displayedSpeed,
        cameraType:String(e.type||'')}};
  });
  fixedRouteCameraFeatures=features;
  fixedCameraVisibleSignature='';
  if(ensureFixedCameraLayer(features))updateSafetyMarkerVisibility();


}
/* ---------- 도로표지판 분류 (법정 도로안전표지 체계 반영) ----------
   1) 주의표지판(경고): 굽은도로/이중굽음/횡단보도/철길건널목 등 위험요소
   2) 규제표지판: 진입금지/추월금지/화물차 통행금지 등 통행 제약
   3) 지시표지판: 회전교차로/자동차전용도로 등 통행방법 지시
   4) 보호구역표지판: 스쿨존/실버존/장애인보호구역
   5) 대형차 제한표지판: 높이/중량/폭 제한
   6) 단속·인프라 안내(기존 카메라/사고/공사)
   각 항목의 kind는 safety-alert / safety-map-marker CSS 색상 테마 키로 사용된다. */
function safetyLabel(e){
  // 1) 주의표지판
  if(e.type==='curve_left')return{kind:'warn',icon:'커브',title:'좌로 굽은 도로',text:'전방 도로가 왼쪽으로 굽어 있습니다. 감속하세요'};
  if(e.type==='curve_right')return{kind:'warn',icon:'커브',title:'우로 굽은 도로',text:'전방 도로가 오른쪽으로 굽어 있습니다. 감속하세요'};
  if(e.type==='double_curve')return{kind:'warn',icon:'S자',title:'이중 굽은 도로',text:'연속 커브 구간입니다. 중앙선 침범에 주의하세요'};
  if(e.type==='crosswalk')return{kind:'warn',icon:'횡단',title:'전방 횡단보도',text:'횡단보도가 있습니다. 보행자를 주의하세요'};
  if(e.type==='railway_crossing')return{kind:'warn',icon:'건널목',title:'전방 철길 건널목',text:'철길 건널목입니다. 일시정지 후 통과하세요'};
  // 2) 규제표지판
  if(e.type==='no_entry')return{kind:'reg',icon:'금지',title:'진입금지 구간',text:'차량 진입이 금지된 구간입니다'};
  if(e.type==='no_overtaking')return{kind:'reg',icon:'추월',title:'추월금지 구간',text:'앞지르기가 금지된 구간입니다'};
  if(e.type==='truck_prohibited')return{kind:'reg',icon:'화물',title:'화물차 통행금지',text:'화물자동차 통행이 금지된 구간입니다'};
  // 3) 지시표지판
  if(e.type==='roundabout')return{kind:'ins',icon:'회전',title:'전방 회전교차로',text:'진입 전 서행하고 방향지시등을 사용하세요'};
  if(e.type==='motorway')return{kind:'ins',icon:'전용',title:'자동차전용도로',text:'자동차전용도로 구간입니다'};
  // 4) 보호구역표지판
  if(e.type==='school_zone'||e.type==='school_nearby')return{kind:'school',icon:'S',title:e.type==='school_zone'?'어린이 보호구역':'학교 주변 구간',text:'속도를 줄이고 주변을 살피세요'};
  if(e.type==='silver_zone')return{kind:'silver',icon:'실버',title:'노인 보호구역',text:'속도를 줄이고 주의하세요'};
  if(e.type==='disabled_zone')return{kind:'silver',icon:'보호',title:'교통약자 보호구역',text:'서행하세요'};
  // 5) 대형차 제한표지판
  if(e.type==='height_limit')return{kind:'truck',icon:'높이',title:'높이제한 구간',text:e.limitValue?`통과높이 ${e.limitValue}m 제한 구간입니다`:'통과높이 제한 구간입니다'};
  if(e.type==='weight_limit')return{kind:'truck',icon:'중량',title:'중량제한 구간',text:e.limitValue?`총중량 ${e.limitValue}톤 제한 구간입니다`:'중량 제한 구간입니다'};
  if(e.type==='width_limit')return{kind:'truck',icon:'폭',title:'폭 제한 구간',text:e.limitValue?`통과폭 ${e.limitValue}m 제한 구간입니다`:'폭 제한 구간입니다'};
  // 6) 기상·통계 기반 안전 안내
  if(e.type==='fog_zone')return{kind:'weather',icon:'안개',title:'전방 안개 구간',text:e.visibility?`가시거리 약 ${Math.max(100,Math.round(e.visibility/100)*100)}m · 감속하고 차간거리를 늘리세요`:'시야 확보가 어려운 구간입니다. 감속하세요'};
  if(e.type==='heavy_rain_zone')return{kind:'weather',icon:'강우',title:'강한 비 주의',text:e.precipitation?`시간 강수량 약 ${Number(e.precipitation).toFixed(1)}mm · 미끄럼에 주의하세요`:'노면이 미끄러울 수 있습니다. 감속하세요'};
  if(e.type==='snow_ice_zone')return{kind:'weather',icon:'결빙',title:'눈·결빙 주의',text:'노면 결빙 가능성이 있습니다. 급가속·급제동을 피하세요'};
  if(e.type==='chronic_congestion')return{kind:'stat',icon:'정체',title:'상습정체 구간',text:(()=>{const nm=String(e.name||'전방 도로').replace(/\s*구간$/,'');return e.sampleCount?`${nm} 구간은 평소보다 혼잡합니다.\n누적 교통표본 ${e.sampleCount}회 기준`:`${nm} 구간은 평소보다 혼잡합니다.`})()};
  if(e.type==='accident_hotspot')return{kind:'stat',icon:'사고',title:'사고다발지역',text:e.accidentCount?`${e.name||'전방 구간'} · 통계 사고 ${e.accidentCount}건`:(e.name||'교통사고가 반복 발생한 통계 구간입니다')};
  // 7) 단속·인프라 안내
  if(e.type==='section_speed_camera')return{kind:'camera',icon:'시',title:'구간단속 시작',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 구간 평균속도를 확인하세요`:'구간 평균속도를 확인하세요'};
  if(e.type==='section_speed_end')return{kind:'camera',icon:'종',title:'구간단속 종료',text:'구간단속 종료지점입니다'};
  if(e.type==='bus_lane_camera')return{kind:'camera',icon:'버스',title:'버스전용차로 단속',text:'전방 버스전용차로 단속 위치입니다. 통행 가능 차량 여부를 확인하세요'};
  // 7) 단속·인프라 안내(기존)
  if(e.type==='accident')return{kind:'incident',icon:'사고',title:'전방 사고 정보',text:e.name||'사고 구간입니다. 차간거리를 확보하고 주의하세요'};
  if(e.type==='construction')return{kind:'construction',icon:'공사',title:'전방 공사 구간',text:e.name||'차로 변경 및 작업 차량에 주의하세요'};
  if(e.type==='mobile_camera')return{kind:'mobile',icon:'이동',title:'이동식 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 속도를 확인하세요`:'제한속도를 확인하세요'};
  if(e.type==='signal_speed_camera')return{kind:'camera',icon:'신호',title:'신호·과속 단속카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 신호와 속도를 확인하세요`:'신호와 속도를 확인하세요'};
  if(e.type==='signal_camera')return{kind:'camera',icon:'신호',title:'신호위반 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 신호를 준수하세요`:'신호를 준수하세요'};
  if(e.type==='traffic_camera')return{kind:'camera',icon:'단속',title:'무인교통단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h`:'교통법규를 준수하세요'};
  if(e.type==='speed_limit')return{kind:'camera',icon:'속도',title:'제한속도 안내',text:e.maxspeed?`현재 구간 제한속도 ${e.maxspeed}km/h`:'제한속도를 확인하세요'};
  if(e.type==='speed_camera')return{kind:'camera',icon:'단속',title:'속도위반 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h`:'제한속도를 확인하세요'};
  return{kind:'camera',icon:'안내',title:'도로 안내',text:'전방 도로 정보를 확인하세요'}
}
/* 진행 방향 기준 전방 약 280m 구간의 헤딩 변화량을 분석해 굽은도로/이중굽은도로를 판정한다.
   OSM 등 외부 표지판 데이터 없이도 이미 보유한 경로 geometry만으로 계산 가능한 지시성 경고표지판이다. */
function detectCurveAhead(idx){
  const g=state.route?.geometry,cum=state.routeCumulative;if(!g||g.length<6||!cum?.length)return null;
  const startDist=cum[idx]||0,lookaheadM=280;
  let i=Math.max(1,idx),totalTurn=0,turns=0,lastSign=0,firstIdx=-1;
  while(i<g.length-1&&(cum[i]-startDist)<lookaheadM){
    const b0=bearing(g[i-1][1],g[i-1][0],g[i][1],g[i][0]),b1=bearing(g[i][1],g[i][0],g[i+1][1],g[i+1][0]);
    const diff=((b1-b0+540)%360)-180;
    if(Math.abs(diff)>3){
      if(firstIdx<0)firstIdx=i;
      const sign=diff>0?1:-1;if(lastSign&&sign!==lastSign)turns++;lastSign=sign;totalTurn+=diff;
    }
    i++;
  }
  if(firstIdx<0||Math.abs(totalTurn)<22)return null;
  const type=turns>=1?'double_curve':(totalTurn>0?'curve_right':'curve_left');
  return{type,routeIndex:firstIdx};
}
function hideSafetyAlert(){const el=$('safetyAlert');if(el)el.classList.add('hidden');$('driveView')?.classList.remove('has-safety');state.activeSafetyId=null}
/* 실데이터(state.safetyEvents) + 경로 geometry 기반 합성 커브 이벤트를 합쳐 우선순위 정렬된 후보 목록을 만든다.
   safety-alert 배너와 좌측 표지판 배지가 동일한 후보 목록을 공유한다. */
const SAFETY_PRIORITY={accident:0,accident_hotspot:1,fog_zone:1,heavy_rain_zone:1,snow_ice_zone:1,school_zone:1,school_nearby:1,silver_zone:1,disabled_zone:1,double_curve:1,
  chronic_congestion:2,construction:2,curve_left:2,curve_right:2,railway_crossing:2,height_limit:2,weight_limit:2,width_limit:2,no_entry:2,
  crosswalk:3,no_overtaking:3,truck_prohibited:3,roundabout:3,section_speed_end:3,section_speed_camera:4,bus_lane_camera:4,mobile_camera:4,signal_speed_camera:5,signal_camera:5,
  speed_camera:6,traffic_camera:6,motorway:8,speed_limit:9,tunnel:9};
/* 단속카메라 안내 시작 거리: 속도에 따라 가변 산출한다.
   기존(7.6.11.4)에는 v*13(약 13초 전)을 130~420m로 단순히 잘라 썼는데, 이 상한(420m)은
   저속 구간 기준으로 정한 값이라 고속도로(100km/h+)에서는 실제 반응·제동거리보다도
   훨씬 짧게 끊겨 안내가 늦게 느껴지는 문제가 있었다.
   아래는 두 값 중 큰 쪽을 사용한다:
   1) speedBandTargetM: 실제 도로에서 통용되는 속도 구간별 사전 안내거리 가이드라인을
      구간 사이 선형보간으로 매끄럽게 표현한 값(30~50km/h 200~300m, 60~80km/h 500m,
      100km/h 1,000m, 130km/h 이상 2,000m 상한).
   2) physicalFloorM: 운전자 반응거리(반응시간 1.8초) + 제동거리(평균 감속도 약 4.2m/s²
      가정) + 인지 여유거리(80m)로 계산한 물리적 최소 안전거리. 저속에서 구간표가
      과도하게 짧게 보간되는 경우를 대비한 하한선이다. */
const CAMERA_ALERT_FAMILY=new Set(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','mobile_camera','bus_lane_camera','section_speed_camera']);
const CAMERA_ALERT_SPEED_BANDS_KMH=[{kmh:0,m:130},{kmh:30,m:200},{kmh:50,m:300},{kmh:60,m:500},{kmh:80,m:500},{kmh:100,m:1000},{kmh:130,m:2000}];
function cameraAlertWindowM(){
  const v=Math.max(0,Number(state.user?.speed)||0),kmh=v*3.6;
  let speedBandTargetM=CAMERA_ALERT_SPEED_BANDS_KMH[CAMERA_ALERT_SPEED_BANDS_KMH.length-1].m;
  for(let i=1;i<CAMERA_ALERT_SPEED_BANDS_KMH.length;i++){
    const a=CAMERA_ALERT_SPEED_BANDS_KMH[i-1],b=CAMERA_ALERT_SPEED_BANDS_KMH[i];
    if(kmh<=b.kmh){const t=b.kmh>a.kmh?(kmh-a.kmh)/(b.kmh-a.kmh):0;speedBandTargetM=a.m+(b.m-a.m)*Math.max(0,Math.min(1,t));break}
  }
  const physicalFloorM=v*1.8+(v*v)/(2*4.2)+80;
  return Math.max(130,Math.round(Math.max(speedBandTargetM,physicalFloorM)));
}
function computeSafetyCandidates(idx){
  if(!state.routeCumulative.length)return[];
  /* 7.6.11.1 굽은 도로 / 이중 굽은 도로, 7.6.11.2 상습정체 안내는 표시하지 않는다.
     7.6.11.3 구간단속 종료는 팝업 없이 음성/패널 종료로만 처리한다(announceSectionEnd). */
  const NO_CARD_TYPES=['speed_limit','tunnel','curve_left','curve_right','double_curve','chronic_congestion','section_speed_end'];
  const win=cameraAlertWindowM(),geometry=state.route?.geometry||[];
  const pool=[...(state.safetyEvents||[])];
  return pool.filter(e=>!NO_CARD_TYPES.includes(e.type)&&cameraAlertAllowed(e.type)).map(e=>({...e,d:eventAheadMeters(idx,e)})).filter(e=>{
    // 7.6.13.2: 저정밀 매칭(원본 좌표 오차 40m 초과)은 뒤쪽(통과 직후)으로도 살짝 여유를 둬,
    // 실제 카메라 위치가 매칭 지점보다 조금 더 앞에 있었을 경우 안내가 너무 일찍 사라지는 것을 완화한다.
    const tailGrace=e.lowPrecision?Math.min(60,Number(e.routeMatchDistance)||0):0;
    if(!(e.routeIndex>=idx-2&&e.d>=-tailGrace&&e.d<=800))return false;
    if(CAMERA_ALERT_FAMILY.has(e.type)){
      // 현재 선택 경로 진행방향과 반대인 카메라는 카드/음성에서도 완전히 제외한다.
      if(!cameraEventDirectionCompatible(e,geometry))return false;
      // 카메라 존재 안내는 현재 속도와 무관하게 제공. 과속 경고는 updateOverspeed가 별도로 담당한다.
      // 저정밀 매칭은 실제 위치가 매칭 지점보다 앞일 수 있어 시작 창을 조금 더 일찍 연다.
      const winForE=win+(e.lowPrecision?Math.min(80,Number(e.routeMatchDistance)||0)*.5:0);
      if(e.d>winForE)return false;
      if(e.type!=='mobile_camera'&&e.type!=='bus_lane_camera'){
        // 로딩 단계에서 경로 매칭(허용 반경 내 투영)을 통과한 카메라는 그대로 안내한다. 지도 핀과 안내 카드 기준이 달라
        // '핀은 보이는데 안내가 없는' 카메라가 생기지 않게 한다.
        if(Number.isFinite(Number(e.routeDistance))&&Number.isFinite(Number(e.routeMatchDistance)))return true;
        return cameraMatchesRouteRoad(e,geometry,idx,e.priorityExpressway?105:70);
      }
    }
    return true;
  }).sort((a,b)=>{
    // 카메라 계열은 같은 순위로 두고 가까운 것부터. (기존에는 먼 구간단속 시작이 바로 앞 카메라를 가렸다)
    const pa=CAMERA_ALERT_FAMILY.has(a.type)?4:(SAFETY_PRIORITY[a.type]??9),pb=CAMERA_ALERT_FAMILY.has(b.type)?4:(SAFETY_PRIORITY[b.type]??9);
    return pa-pb||a.d-b.d;
  });
}
/* 구간단속 종료 지점 음성 안내(팝업 없음): 구간단속 중일 때 종료 지점 직전에 한 번. */
function announceSectionEnd(idx){
  if(!state.sectionSpeedState)return;
  const win=Math.min(300,cameraAlertWindowM());let best=null;
  for(const e of (state.safetyEvents||[])){
    if(e.type!=='section_speed_end')continue;
    const d=eventAheadMeters(idx,e);if(d<20||d>win)continue;
    if(!best||d<best.d)best={...e,d};
  }
  if(!best)return;
  const ss=state.sectionSpeedState;let avgText='';
  if(Number(ss.enteredAt)>0){const elapsed=Math.max(1,(Date.now()-Number(ss.enteredAt))/1000),travelled=Math.max(0,(Number(ss.lastDistance)||0)-(Number(ss.enteredDistance)||0)),avg=Math.max(0,Math.min(250,travelled/elapsed*3.6));avgText=` 현재 구간 평균속도는 ${Math.round(avg)}킬로미터입니다.`}
  const meters=best.d<100?Math.max(20,Math.round(best.d/10)*10):Math.max(100,Math.round(best.d/50)*50);
  speakNavOnce(`safety:${best.id}:${best.type}`,`${meters}미터 앞 구간단속 종료지점입니다.${avgText}`,11000);
}
function safetyGuidanceLimit(idx,e){
  // 단속카메라 안내에서는 해당 카메라 공공데이터의 설정속도를 최우선 사용.
  const eventLimit=normalizeSpeedLimitValue(e?.maxspeed);
  if(eventLimit>0)return eventLimit;
  const freshVsl=Number.isFinite(Number(state.vslSpeedLimit))&&Date.now()-Number(state.vslSpeedLimitAt||0)<30000?Number(state.vslSpeedLimit):0;
  if(freshVsl>0)return freshVsl;
  const seg=(state.route?.roadSegments||[]).find(s=>idx>=s.startIndex&&idx<=s.endIndex);
  return effectiveSpeedLimit(idx,seg);
}

function updateSafetyUI(idx,candidates){
  // safetyEvents에 들어온 카메라는 이미 경로/방향 매칭을 통과한 결과다.
  // 여기서 38m로 재필터링하면 왕복 분리도로의 실제 카메라가 음성안내에서 다시 사라진다.
  announceSectionEnd(idx);
  candidates=(candidates||computeSafetyCandidates(idx));
  const e=candidates[0];
  if(!e){hideSafetyAlert();state.activeSafetyEvent=null;return}
  // 7.6.13.2: 저정밀 매칭(computeSafetyCandidates의 tailGrace)으로 살짝 음수인 d까지 통과한
  // 후보를 여기서 다시 0 미만이라고 잘라버리면 방금 넓혀준 여유가 무의미해진다.
  const tailGrace=e.lowPrecision?Math.min(60,Number(e.routeMatchDistance)||0):0;
  if(Number(e.routeIndex)<idx-1||Number(e.d)<-tailGrace){hideSafetyAlert();state.activeSafetyEvent=null;return}

  const info=safetyLabel(e),el=$('safetyAlert');
  const typeClass=String(e.type||'unknown').replace(/[^a-z0-9_-]/gi,'-');
  el.className=`safety-alert ${info.kind} type-${typeClass}`;
  el.dataset.safetyType=String(e.type||'');
  $('driveView')?.classList.add('has-safety');
  const iconEl=$('safetyAlertIcon');
  if(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','section_speed_end','mobile_camera','bus_lane_camera'].includes(e.type)){
    iconEl.innerHTML=safetyCctvSvg();iconEl.classList.add('sign-icon');
  }else if(e.type==='chronic_congestion'){
    iconEl.innerHTML=congestionMarkerSvg();iconEl.classList.add('sign-icon');
  }else{
    iconEl.textContent=info.icon;iconEl.classList.remove('sign-icon');
  }
  const guideLimit=safetyGuidanceLimit(idx,e);
  el.dataset.speedLimit=guideLimit>0?String(Math.round(guideLimit)):'';
  $('safetyAlertTitle').textContent=info.title;
  const speedCamTypes=['speed_camera','signal_speed_camera','signal_camera','traffic_camera','mobile_camera','section_speed_camera'];
  $('safetyAlertText').textContent=guideLimit>0&&speedCamTypes.includes(e.type)?`제한속도 ${Math.round(guideLimit)}km/h`:(guideLimit>0&&String(e.type).includes('camera')?`${info.text} · 제한속도 ${Math.round(guideLimit)}km/h`:info.text);
  $('safetyAlertDistance').textContent=km(Math.max(10,Number(e.d)||10));
  state.activeSafetyId=e.id;state.activeSafetyEvent={...e,guideLimit};
  /* 7.6.11.3 구간단속 종료 팝업은 별도로 띄우지 않는다(구간단속 패널이 끝나면 그대로 종료). 음성 안내는 아래에서 계속 처리한다. */
  if(e.type==='section_speed_end'){const _sa=$('safetyAlert');if(_sa)_sa.classList.add('hidden');$('driveView')?.classList.remove('has-safety')}

  // 지나친 즉시 UI에서 제거되도록 active event는 전방 이벤트만 유지한다.
  const voiceMax=CAMERA_ALERT_FAMILY.has(e.type)?cameraAlertWindowM():420;
  if(!VOICE_SAFETY_TYPES.has(e.type)||e.d>voiceMax||e.d<(CAMERA_ALERT_FAMILY.has(e.type)?20:5))return;
  const meters=e.d<100?Math.max(20,Math.round(e.d/10)*10):Math.max(100,Math.round(e.d/50)*50);
  let text='';
  if(e.type==='school_zone'||e.type==='school_nearby')text=`${meters}미터 앞 어린이 보호구역입니다.`;
  else if(e.type==='signal_speed_camera'||e.type==='signal_camera')text=`${meters}미터 앞 신호·속도 단속카메라입니다.${guideLimit?` 제한속도 ${Math.round(guideLimit)}킬로미터입니다.`:''}`;
  else if(e.type==='speed_camera'||e.type==='traffic_camera')text=`${meters}미터 앞 속도 단속카메라입니다.${guideLimit?` 제한속도 ${Math.round(guideLimit)}킬로미터입니다.`:''}`;
  else if(e.type==='bus_lane_camera')text=`${meters}미터 앞 버스전용차로 단속카메라입니다.`;
  else if(e.type==='mobile_camera')text=`${meters}미터 앞 이동식 카메라 단속구역입니다.`;
  else if(e.type==='section_speed_camera')text=`${meters}미터 앞 구간단속 시작지점입니다.${guideLimit?` 제한속도 ${Math.round(guideLimit)}킬로미터입니다.`:''}`;
  else if(e.type==='section_speed_end'){
    const ss=state.sectionSpeedState;let avgText='';
    if(ss&&Number(ss.enteredAt)>0){const elapsed=Math.max(1,(Date.now()-Number(ss.enteredAt))/1000),travelled=Math.max(0,(Number(ss.lastDistance)||0)-(Number(ss.enteredDistance)||0)),avg=Math.max(0,Math.min(250,travelled/elapsed*3.6));avgText=` 현재 구간 평균속도는 ${Math.round(avg)}킬로미터입니다.`}
    text=`${meters}미터 앞 구간단속 종료지점입니다.${avgText}`;
  }
  else if(e.type==='fog_zone')text=`${meters}미터 앞 안개 주의구간입니다.`;
  else if(e.type==='snow_ice_zone')text=`${meters}미터 앞 눈 또는 결빙 주의구간입니다.`;
  else if(e.type==='heavy_rain_zone')text=`${meters}미터 앞 강우 주의구간입니다.`;
  if(text)speakNavOnce(`safety:${e.id}:${e.type}`,text,11000);
}

/* ---------- DRIVE SIDE INFORMATION / OVERSPEED ---------- */
function trafficCssKey(seg){return trafficClassFromValues(seg?.trafficSpeed,seg?.trafficState).key||'unknown'}
function renderTrafficRouteRail(idx=state.currentRouteIndex){
  const box=$('trafficRouteSegments');if(!box)return;
  const road=state.route?.roadSegments||[];
  const future=road.filter(s=>Number(s.endIndex)>=idx).slice(0,24);
  if(!future.length){box.innerHTML='<i class="unknown"></i>';return}
  const total=future.reduce((n,s)=>n+Math.max(1,(Number(s.endIndex)||0)-Math.max(idx,Number(s.startIndex)||0)),0)||1;
  box.innerHTML=future.map(s=>{const w=Math.max(1,(Number(s.endIndex)||0)-Math.max(idx,Number(s.startIndex)||0));const key=trafficCssKey(s);return `<i class="${key}" style="flex:${Math.max(.25,w/total*10)}" title="${escapeHtml(trafficClassFromValues(s.trafficSpeed,s.trafficState).label)}"></i>`}).join('');
}
function upcomingSpeedCamera(idx=state.currentRouteIndex){
  const cameraTypes=new Set(['speed_camera','signal_speed_camera','traffic_camera']);let best=null;
  for(const e of (state.safetyEvents||[])){
    if(!cameraTypes.has(e.type))continue;const ri=Number(e.routeIndex);if(!Number.isFinite(ri)||ri<idx)continue;
    const d=eventAheadMeters(idx,e);if(d<0||d>Math.max(200,cameraAlertWindowM()))continue;if(!best||d<best.d)best={...e,d};
  }
  return best;
}
function updateOverspeed(speed,limit){
  const el=$('overspeedFlash');if(!el)return;
  const cam=upcomingSpeedCamera(),cameraLimit=Number(cam?.maxspeed)||Number(limit)||0;
  const active=state.cameraAlerts.speed!==false&&Boolean(cam)&&cameraLimit>0&&Number(speed)>=cameraLimit+3;
  state.overspeedActive=active;el.classList.toggle('active',active);el.setAttribute('aria-hidden',String(!active));
  if(active){$('overspeedMessage').textContent=`전방 ${km(cam.d)} · 현재 ${speed}km/h · 제한 ${cameraLimit}km/h`;const now=Date.now();if(now-state.lastOverspeedSpokenAt>9000){state.lastOverspeedSpokenAt=now;speak(`과속 주의. ${Math.max(100,Math.round(cam.d/100)*100)}미터 앞 속도위반 단속 카메라가 있습니다. 현재 속도 ${speed}킬로미터, 제한속도 ${cameraLimit}킬로미터입니다.`)}}
}

function updateSimulationControls(){
  const speed=Number(state.simulationSpeed)||1;
  document.querySelectorAll('[data-simulation-speed]').forEach(b=>{
    b.classList.toggle('active',Number(b.dataset.simulationSpeed)===speed);
  });
  const status=$('simulationStatus'),start=$('simulationStartBtn');
  if(status){
    status.textContent=state.simulationActive?`${speed}× 주행 중`:'대기';
    status.classList.toggle('running',Boolean(state.simulationActive));
  }
  if(start){
    start.textContent=state.simulationActive?'모의주행 종료':'모의주행 시작';
    start.classList.toggle('stop',Boolean(state.simulationActive));
  }
}
function setSimulationSpeed(mult){
  const n=[1,2,4,8,10].includes(Number(mult))?Number(mult):1;
  state.simulationSpeed=n;
  state.simulationLastAt=performance.now();
  updateSimulationControls();
}
function stopRouteSimulation({resumeGps=true}={}){
  stopDangolloSimulationClock();
  // 1) 모의주행 프레임을 가장 먼저 즉시 중단
  if(state.simulationRaf)cancelAnimationFrame(state.simulationRaf);
  if(state.simulationFallbackTimer){clearTimeout(state.simulationFallbackTimer);state.simulationFallbackTimer=0}
  state.simulationRaf=0;
  const wasActive=Boolean(state.simulationActive);
  state.simulationActive=false;
  window.__DANGOLLO_SIMULATION_ACTIVE__=false;
  state.simulationLastAt=0;
  state.simulationDistance=null;

  // v7.6.27.37: 가상주행 종료는 실주행 복귀가 아닌 '목적지 검색 후 안내 시작 전' 상태로 리셋한다.
  // 안내 세션 / 경고 / 타이머를 종료하되 목적지·선택 경로는 유지한다.
  if(wasActive){
    cancelAutoStart();stopLiveRouteRefresh();stopWatch();stopDeadReckoning();
    state.tripStartedAt=0;
    state.navigationStartReleased=false;state.navigationStartAt=0;
    state.navigationStartAnchor=null;state.stationaryActive=false;
    state.sectionSpeedResumeBlocked=false;
    state.safetyEvents=[];state.activeSafetyId=null;
    resetSectionSpeedState();hideSafetyAlert();clearSafetyMarkers();
    $('laneAssistLayer')?.classList.add('hidden');
    $('safetyAlert')?.classList.add('hidden');
    const flash=$('overspeedFlash');if(flash){flash.classList.remove('active');flash.classList.add('hidden');flash.setAttribute('aria-hidden','true')}
    document.getElementById('sectionAvgOverspeedFlash')?.classList.remove('on');
    $('driveView')?.removeAttribute('data-pop');
    $('driveView')?.classList.remove('has-section-speed');
    try{stopNavigationRadioImmediately()}catch{}
    try{releaseNavigationWakeLock()}catch{}
    // 마지막 모의 좌표 대신 최신 실제 위치를 사용한다.
    const real=state.lastRawFix;
    if(real&&pointValid(real)&&Date.now()-Number(real.at||0)<90000){
      state.user={...(state.preSimulationUser||state.user||{}),lat:Number(real.lat),lng:Number(real.lng),speed:0,simulation:false};
    }else if(state.preSimulationUser){state.user={...state.preSimulationUser,speed:0,simulation:false}}
    if(state.route?.geometry?.length){
      state.routeCumulative=buildCumulative(state.route);
      state.routeOptions=state.carRouteOptions?.length?state.carRouteOptions:[state.route];
      state.selectedRoute=Math.max(0,state.routeOptions.indexOf(state.route));
    }
    state.preSimulationUser=null;
    state.preSimulationRouteDistance=null;
    state.preSimulationRouteLockedDistance=null;
    state.preSimulationStationaryActive=false;
    state.preSimulationStationaryGpsAnchor=null;
    updateSimulationControls();
    // v7.6.27.39: 사용자가 지정한 경로를 다시 고르지 않는다.
    // 지도 위 주행 전 미리보기는 유지하되 실제 길안내 세션은 종료한다.
    state.departurePreview=true;
    state.departureVisualDistance=0;
    state.currentRouteIndex=0;
    state.routeLockedDistance=0;
    state.driveMarkerRenderedDistance=0;
    state.driveMarkerTargetDistance=0;
    state.user={...(state.user||{}),speed:0,routeDistance:0,routeIndex:0,simulation:false};
    state.gpsEstimated=false;
    if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0}
    const firstCoord=state.route?.geometry?.[0];
    if(firstCoord&&Number.isFinite(Number(firstCoord[0]))&&Number.isFinite(Number(firstCoord[1]))){
      state.user.lng=Number(firstCoord[0]);state.user.lat=Number(firstCoord[1]);
      const secondCoord=state.route.geometry[Math.min(4,state.route.geometry.length-1)];
      if(secondCoord)state.user.heading=bearing(state.user.lat,state.user.lng,Number(secondCoord[1]),Number(secondCoord[0]));
    }
    // 실제 길안내가 아니라 사용자 참고 화면과 동일한 driveView 출발대기 화면.
    setView('drive');
    $('driveView')?.classList.add('departure-waiting');
    if(state.route?.geometry?.length){
      drawRoute(state.route,{fit:false});
      ensureUserMarker();updateCarMarkerImage();
      if(firstCoord)state.userMarker?.setLngLat([Number(firstCoord[0]),Number(firstCoord[1])]);
      const el=state.userMarker?.getElement?.();
      if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block';el.classList.remove('jofams-car-moving')}
    }
    initializeDriveSummary();
    // 출발 전에도 첫 회전과 다음 회전 안내는 참조 화면처럼 미리 표시한다.
    const guides=(state.route?.guides||[]).filter(g=>Number(g.routeIndex)>=0);
    const firstGuide=guides[0],nextGuide=guides[1];
    if(firstGuide){
      const d=guideDisplayDistance(0,firstGuide,state.route?.distance||0);
      $('maneuverIcon').innerHTML=turnSvg(firstGuide.type);
      $('maneuverDistance').textContent=guideUiDistanceText(d);
      $('maneuverRoad').textContent=guidePanelText(firstGuide);
      if($('maneuverSub'))$('maneuverSub').textContent=guideSubText(firstGuide,guidePanelText(firstGuide));
    }else{
      $('maneuverIcon').innerHTML=turnSvg(0);
      $('maneuverDistance').textContent=km(state.route?.distance||0);
      $('maneuverRoad').textContent='목적지 방향';
      if($('maneuverSub'))$('maneuverSub').textContent='';
    }
    if(nextGuide){
      $('nextManeuver')?.classList.remove('hidden');
      $('nextManeuverIcon').innerHTML=turnSvg(nextGuide.type);
      $('nextManeuverDistance').textContent=km(guideDisplayDistance(0,nextGuide,state.route?.distance||0));
      $('nextManeuverText').textContent=guidePanelText(nextGuide);
    }else $('nextManeuver')?.classList.add('hidden');
    if($('currentSpeed'))$('currentSpeed').textContent='0';
    const destName=state.destination?.name||'목적지';
    if($('driveDestinationName'))$('driveDestinationName').textContent=destName;
    // 모의주행의 안전 경보·잔상은 출발대기 화면에서 모두 제거.
    resetSectionSpeedState();hideSafetyAlert();clearSafetyMarkers();
    $('laneAssistLayer')?.classList.add('hidden');
    $('driveView')?.classList.remove('dangollo-in-junction');
    state.activeLaneGuideKey='';
    $('overspeedFlash')?.classList.remove('active');
    $('driveView')?.classList.remove('has-safety','has-section-speed');
    if(state.map&&firstCoord){
      state.userMapInteracting=false;state.lastUserMapInteractionAt=0;
      state.map.stop();
      state.map.jumpTo({center:[Number(firstCoord[0]),Number(firstCoord[1])],zoom:driveMapZoom(),pitch:driveMapPitch(),bearing:Number(state.user.heading)||0,padding:driveCameraPadding()});
    }
    toast('모의주행 종료 · 출발 직전 지도 화면으로 복귀했습니다.',1800);
    return;
  }

  // 모의주행 상태에서 생성된 구간단속 카드/과속 붉은 오버레이를 즉시 완전 해제.
  // updateDriving()이 오래된 모의주행 위치로 다시 렌더링하지 않도록 잠금.
  if(wasActive){
    state.sectionSpeedResumeBlocked=true;
    resetSectionSpeedState();
    $('safetyAlert')?.classList.add('hidden');
    const flash=$('overspeedFlash');if(flash){flash.classList.remove('active');flash.classList.add('hidden');}
    const avgFlash=document.getElementById('sectionAvgOverspeedFlash');if(avgFlash)avgFlash.classList.remove('on');
    state.activeSafetyId=null;
  }

  // 2) GPS 응답을 기다리지 않고 모의주행 직전 실제 위치로 즉시 되돌린다.
  if(wasActive&&state.tripStartedAt){
    const real=state.lastRawFix;
    const realUsable=real&&pointValid(real)&&Date.now()-Number(real.at||0)<90000;
    state.user={...(state.preSimulationUser||state.user||{}),
      ...(realUsable?{lat:Number(real.lat),lng:Number(real.lng),rawLat:Number(real.lat),rawLng:Number(real.lng),accuracy:Number(real.accuracy)}:{})};
    state.user.speed=Math.max(0,Number(state.user.speed)||0);

    // Match latest actual GNSS coordinates to the active route, not to a simulated waypoint.
    const rp=realUsable?directionAwareNearestPointOnRoute(state.user.lng,state.user.lat,Number(state.user.heading),0,state.route?.geometry||[],120):null;
    const matched=rp&&Number.isFinite(Number(rp.index))?Number(state.routeCumulative?.[rp.index]):NaN;
    const restoreDistance=Number.isFinite(matched)?matched:Number(state.preSimulationRouteDistance);
    if(Number.isFinite(restoreDistance)){
      state.user.routeDistance=restoreDistance;
      const p=pointAtRouteDistance(restoreDistance);
      if(p){
        if(!realUsable){state.user.lng=p.lng;state.user.lat=p.lat;}
        state.user.routeIndex=p.index;
        if(!Number.isFinite(Number(state.user.heading)))state.user.heading=p.heading;
      }
      state.driveMarkerRenderedDistance=restoreDistance;
      state.driveMarkerTargetDistance=restoreDistance;
      state.routeLockedDistance=restoreDistance;
      state.deadReckoningDistance=restoreDistance;
    }

    // 모의주행 종료 직후에는 이전 speed/맵매칭 잔여값을 재사용하지 않는다.
    // 실제 GPS에서 이동이 다시 확인될 때까지 캐릭터를 복귀 지점에 완전히 고정한다.
    state.user.speed=0;
    state.user.simulation=false;
    state.lastRealSpeedMps=0;
    state.lastSpeedSample=null;
    state.gpsEstimated=false;
    state.deadReckoningLastAt=Date.now();
    state.stationaryActive=true;
    state.navigationStartAt=Date.now();
    state.navigationStartReleased=false;
    state.navigationStartAnchor={
      lat:Number(state.user.lat),
      lng:Number(state.user.lng),
      routeDistance:Number.isFinite(restoreDistance)?restoreDistance:Number(state.user.routeDistance)
    };
    state.stationaryGpsAnchor={...state.navigationStartAnchor};
    state.gpsFix={lat:null,lng:null,headingDeg:null,speedMps:0,at:0,fixCount:0,mapSnapped:false};

    ensureUserMarker();
    const el=state.userMarker?.getElement?.();
    if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block'}

    if(state.map){
      state.lastUserMapInteractionAt=0;
      state.userMapInteracting=false;
      // 애니메이션 없이 즉시 실제 위치 복귀
      state.map.jumpTo({
        center:[state.user.lng,state.user.lat],
        zoom:driveMapZoom(),
        pitch:driveMapPitch(),
        bearing:Number(state.user.heading)||0,
        padding:driveCameraPadding()
      });
    }
    updateDriving(false);
    ensureActiveRouteOverlay();
  }

  updateSimulationControls();

  // 3) 이후 GPS watch를 복구하여 실제 최신 위치만 갱신
  if(wasActive&&resumeGps&&state.tripStartedAt){
    startWatch();
    locate(false).then(u=>{
      if(!u||!state.tripStartedAt||state.simulationActive)return;
      // 첫 실 GPS 한 번만으로는 모의주행 후 정지 latch를 해제하지 않는다.
      // applyGps()의 실제 이동 확인 조건을 통과한 경우에만 navigationStartReleased가 true가 된다.
      if(!state.navigationStartReleased){
        state.user.speed=0;
        state.stationaryActive=true;
      }
      ensureUserMarker();
      const el=state.userMarker?.getElement?.();
      if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block'}
      updateDriving(false);
    }).catch(()=>{});
    toast('모의주행 종료 · 현재 위치로 즉시 복귀했습니다.',1500);
  }

  state.preSimulationUser=null;
  state.preSimulationRouteDistance=null;
  state.preSimulationRouteLockedDistance=null;
  state.preSimulationStationaryActive=false;
  state.preSimulationStationaryGpsAnchor=null;
}
// Keep the drawn route in sync with the simulated car, including after a map-style reload.
// Never replace a valid route with a guessed straight line.
function ensureSimulationRouteVisible(){
  if(!state.simulationActive||!state.map||!state.route?.geometry?.length)return;
  const now=Date.now();
  if(now-Number(state.simulationRouteCheckAt||0)<1200)return;
  state.simulationRouteCheckAt=now;
  try{
    if(!state.map.isStyleLoaded()){
      state.pendingRouteDraw={route:state.route,options:{fit:false}};
      return;
    }
    const source=state.map.getSource('route');
    if(!source||!state.map.getLayer('route-main')||!state.map.getLayer('route-shadow')){
      drawRoute(state.route,{fit:false});
      return;
    }
    // If another style update hid route layers, restore visibility without resetting camera.
    for(const id of ['route-main','route-shadow','route-direction-arrows']){
      if(state.map.getLayer(id)&&state.map.getLayoutProperty(id,'visibility')==='none')
        state.map.setLayoutProperty(id,'visibility','visible');
    }
  }catch(error){console.warn('[Dangollo] simulated route visibility:',error)}
}
function simulationTick(ts){
  state.simulationRaf=0;
  if(state.simulationFallbackTimer){clearTimeout(state.simulationFallbackTimer);state.simulationFallbackTimer=0}
  if(!state.simulationActive||!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative?.length)return;
  const total=Number(state.routeCumulative.at(-1))||0;
  const duration=Math.max(1,Number(state.route.duration)||1);
  if(!total)return stopRouteSimulation();

  const last=Number.isFinite(state.simulationLastAt)?state.simulationLastAt:ts;
  const dt=Math.max(.05,Math.min(.30,(ts-last)/1000));
  state.simulationLastAt=ts;

  const mult=Number(state.simulationSpeed)||1;
  const baseMps=Math.max(2,total/duration);
  let dist=Number(state.simulationDistance);
  if(!Number.isFinite(dist))dist=Number(state.user?.routeDistance)||0;
  dist=Math.min(total,dist+baseMps*mult*dt);

  ensureSimulationRouteVisible();
  const p=pointAtRouteDistance(dist);
  if(p){
    state.simulationDistance=dist;
    state.currentRouteIndex=p.index;
    state.routeLockedDistance=dist;
    state.routeLockedAt=Date.now();
    state.gpsEstimated=false;
    state.user={
      ...(state.user||{}),
      lng:p.lng,lat:p.lat,rawLng:p.lng,rawLat:p.lat,
      routeIndex:p.index,routeDistance:dist,
      heading:p.heading,
      speed:baseMps*mult,
      accuracy:1,
      estimated:false,
      simulation:true
    };
    // In simulated travel the route sample itself is authoritative.
    // Avoid a second delayed interpolator chasing the sample and appearing motionless.
    if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0}
    state.driveMarkerRenderedDistance=dist;
    state.driveMarkerTargetDistance=dist;
    state.driveMarkerTargetAt=Date.now();
    ensureUserMarker();
    state.userMarker?.setLngLat([p.lng,p.lat]);
    // Refresh the map even when guidance updating is disabled by the native host flag.
    updateDriving(false);
    state.userMarker?.setLngLat([p.lng,p.lat]);
  // 모의주행은 항상 캐릭터 중심으로 화면을 추종한다.
  if(state.map&&state.simulationActive){
    state.userMapInteracting=false;
    state.lastUserMapInteractionAt=0;
    const now=performance.now();
    if(!state.lastSimulationCameraAt||now-state.lastSimulationCameraAt>=120){
      state.lastSimulationCameraAt=now;
      state.map.easeTo({
        center:[state.user.lng,state.user.lat],
        zoom:driveMapZoom(),
        pitch:driveMapPitch(),
        bearing:Number(state.user.heading)||0,
        duration:140,
        padding:driveCameraPadding()
      });
    }
  }
  }

  if(dist>=total-1){
    toast('모의주행이 목적지에 도착했습니다.',1600);
    stopRouteSimulation({resumeGps:true});
    return;
  }
  // The 50ms simulation clock schedules the next frame.
}
function stopDangolloSimulationClock(){
  if(state.simulationInterval){clearInterval(state.simulationInterval);state.simulationInterval=0}
  if(state.simulationRaf){cancelAnimationFrame(state.simulationRaf);state.simulationRaf=0}
  if(state.simulationFallbackTimer){clearTimeout(state.simulationFallbackTimer);state.simulationFallbackTimer=0}
}
function scheduleDangolloSimulationFrame(){
  // Keep one clock only. WebView RAF may be throttled while its map is animating.
  if(!state.simulationActive||state.simulationInterval)return;
  state.simulationLastAt=performance.now();
  state.simulationInterval=setInterval(()=>{
    if(!state.simulationActive){stopDangolloSimulationClock();return}
    try{simulationTick(performance.now())}
    catch(error){console.error('[Dangollo simulation tick]',error);stopRouteSimulation({resumeGps:true});toast('모의주행 중 오류가 발생했습니다. 경로를 확인해 주세요.',3000)}
  },50);
  simulationTick(performance.now());
}

function startRouteSimulation(){
  state.departurePreview=false; $('driveView')?.classList.remove('departure-waiting');
  if(!state.tripStartedAt||!state.route?.geometry?.length)return toast('길안내가 시작된 뒤 모의주행을 사용할 수 있습니다.');
  if(state.routeMode!=='car')return toast('모의주행은 자동차 경로에서 사용할 수 있습니다.');
  if(state.simulationActive){stopRouteSimulation({resumeGps:true});return}
  if(!state.routeCumulative?.length || Number(state.routeCumulative.at(-1))<=0){
    state.routeCumulative=buildCumulative(state.route);
  }
  if(!(Number(state.routeCumulative?.at(-1))>0))return toast('경로 거리 정보가 없어 모의주행을 시작할 수 없습니다.',3000);
  stopDangolloSimulationClock();

  // 종료 즉시 되돌아올 실제 위치를 모의주행 전에 보존한다.
  state.preSimulationUser=state.user?{...state.user}:null;
  state.preSimulationRouteDistance=Number.isFinite(Number(state.driveMarkerRenderedDistance))
    ?Number(state.driveMarkerRenderedDistance)
    :Number(state.user?.routeDistance);
  state.preSimulationRouteLockedDistance=Number(state.routeLockedDistance);
  state.preSimulationStationaryActive=Boolean(state.stationaryActive);
  state.preSimulationStationaryGpsAnchor=state.stationaryGpsAnchor?{...state.stationaryGpsAnchor}:null;

  stopWatch();
  stopDeadReckoning();
  state.sectionSpeedResumeBlocked=false;
  resetSectionSpeedState();
  state.simulationActive=true;
  state.simulationRouteCheckAt=0;
  drawRoute(state.route,{fit:false});
  window.__DANGOLLO_SIMULATION_ACTIVE__=true;
  state.offRouteHits=0;
  state.offRouteHeadingHits=0;
  state.arrivalCandidateSince=0;
  state.userMapInteracting=false;
  state.lastUserMapInteractionAt=0;
  state.lastSimulationCameraAt=0;
  if(state.userMarker){
    const el=state.userMarker.getElement?.();
    if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block'}
  }
  state.simulationSpeed=Number(state.simulationSpeed)||1;
  let current=Number(state.user?.routeDistance);
  const total=Number(state.routeCumulative?.at(-1))||0;
  if(!Number.isFinite(current)||current>=total-5)current=0;
  state.simulationDistance=Math.max(0,current);
  state.simulationLastAt=performance.now();
  state.navigationStartReleased=true;
  state.stationaryActive=false;
  state.lastSimulationCameraAt=0;
  if(state.driveMarkerRaf){cancelAnimationFrame(state.driveMarkerRaf);state.driveMarkerRaf=0}
  updateSimulationControls();
  closeRouteInfo();
  toast(`모의주행 ${state.simulationSpeed}×를 시작합니다.`,1500);
  scheduleDangolloSimulationFrame();
}

function closeRouteInfo(){ $('routeInfoModal')?.classList.add('hidden') }
function openRouteInfo(){
  if(!state.route||!state.destination)return toast('안내 중인 경로가 없습니다.');
  const idx=state.currentRouteIndex||0,total=state.routeCumulative.at(-1)||state.route.distance||0,done=state.routeCumulative[idx]||0,remain=Math.max(0,total-done),ratio=total?remain/total:1,remainSec=(state.route.duration||0)*ratio;
  $('routeInfoDestination').textContent=state.destination.name||'목적지';$('routeInfoEta').textContent=`도착 ${eta(remainSec)}`;$('routeInfoRemain').textContent=`${km(remain)} · ${mins(remainSec)}`;
  const seen=new Set(),points=[];
  for(const g of (state.route.guides||[])){
    const ri=Number(g.routeIndex);if(!Number.isFinite(ri)||ri<=idx+1)continue;
    const name=String(g.name||g.roadName||g.guidance||'').trim();if(!name||seen.has(name))continue;seen.add(name);points.push({name,d:distanceAlong(idx,ri),type:g.type});if(points.length>=7)break;
  }
  if(points.length<4){for(const r of (state.route.roadSegments||[])){const ri=Math.max(idx,Number(r.startIndex)||0);const name=String(r.name||'').trim();if(ri<=idx||!name||seen.has(name))continue;seen.add(name);points.push({name,d:distanceAlong(idx,ri),type:0});if(points.length>=7)break}}
  const list=$('routeWaypointList');list.innerHTML=points.length?points.map((x,i)=>`<div class="route-waypoint"><span class="dot"></span><div><b>${escapeHtml(x.name)}</b><small>${i===0?'다음 주요 통과지점':'주요 통과지점'}</small></div><em>${km(x.d)}</em></div>`).join(''):'<div class="empty-info">표시할 주요 통과지점 정보가 없습니다.</div>';
  updateSimulationControls();
  $('routeInfoModal').classList.remove('hidden');
}
function openDriveSearch(){
  if(!state.tripStartedAt)return toast('주행 안내 중에 사용할 수 있습니다.');
  $('driveSearchInput').value='';$('driveSearchResults').innerHTML='';$('driveSearchModal').classList.remove('hidden');setTimeout(()=>$('driveSearchInput').focus(),80)
}
function closeDriveSearch(){ $('driveSearchModal').classList.add('hidden') }
async function searchDriveDestinations(q){
  const box=$('driveSearchResults');if(!q?.trim())return;box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';if(!state.user)await locate(false);
  try{
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',q.trim());if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const r=await fetch(u);if(!r.ok)throw new Error('검색 오류');const d=await r.json(),items=d.items||[];box.innerHTML='';
    if(!items.length){box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>';return}
    items.slice(0,8).forEach(x=>{const b=document.createElement('button');b.className='search-result';b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}${x.distance!==null&&x.distance!==undefined&&x.distance!==''&&Number.isFinite(Number(x.distance))?` · ${km(Number(x.distance))}`:''}</small>`;b.onclick=()=>openDrivePlaceChoice(x);box.appendChild(b)})
  }catch(e){box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}

function openDrivePlaceChoice(item){
  const p=normalizedPlace(item);if(!pointValid(p))return;
  state.pendingDriveSearchPlace=p;
  closeDriveSearch();
  $('drivePlaceChoiceName').textContent=p.name||'선택한 장소';
  const modal=$('drivePlaceChoiceModal');
  modal.classList.remove('hidden');
  modal.style.zIndex='10080';
}
function closeDrivePlaceChoice(){state.pendingDriveSearchPlace=null;$('drivePlaceChoiceModal').classList.add('hidden')}
async function applyDrivePlaceChoice(mode){
  const p=state.pendingDriveSearchPlace;if(!p)return closeDrivePlaceChoice();
  state.pendingDriveSearchPlace=null;$('drivePlaceChoiceModal').classList.add('hidden');
  if(mode==='waypoint'){
    state.waypoints=[...(state.waypoints||[]),p].slice(0,5);closeDriveSearch();toast(`${p.name}을 경유지로 추가합니다.`);speak('경유지를 추가했습니다. 새로운 경로를 탐색합니다.');
    state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current';state.lastRerouteAt=Date.now();
    try{const spec=routePreferenceSpec(),nr=await routeRequest(spec.priority,spec.avoid);state.route={...nr,_label:`경유지 추가 · ${spec.label}`,_character:state.character};state.routeOptions=[state.route];state.routeCumulative=buildCumulative(state.route);invalidateDrivePoiRoute();state.currentRouteIndex=0;drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);renderTrafficRouteRail(0);updateDriving(true)}catch(e){toast('경유지 경로를 가져오지 못했습니다.',3000)}
  }else{
    state.waypoints=[];await changeDestinationWhileDriving(p);
  }
}

async function changeDestinationWhileDriving(item){
  if(!state.user)return toast('현재 위치를 확인할 수 없습니다.');
  closeDriveSearch();state.destination=normalizedPlace(item);setDestinationMarker();toast(`${state.destination.name}(으)로 목적지를 변경합니다.`);
  state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current';state.lastRerouteAt=Date.now();
  try{const spec=routePreferenceSpec(),r=await routeRequest(spec.priority,spec.avoid);state.route={...r,_label:`재탐색 · ${spec.label}`,_character:state.character};state.routeOptions=[state.route];state.routeCumulative=buildCumulative(state.route);invalidateDrivePoiRoute();state.currentRouteIndex=0;drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);renderTrafficRouteRail(0);updateDriving(true)}catch(e){toast('새 목적지 경로를 가져오지 못했습니다.',3000)}
}

/* ---------- DRIVE ROUTE POI / RECOMMENDATION ---------- */
function clearDrivePoiMarkers(){for(const m of state.drivePoiMarkers||[])try{m.remove()}catch{}state.drivePoiMarkers=[]}
function drivePoiTabSpec(tab='fuel'){
  return ({
    fuel:{label:'주유소',summary:'최저가',empty:'경로상 주유소 정보가 없습니다.',theme:'fuel'},
    local:{label:'지역사랑',summary:'가맹점',empty:'경로상 지역사랑상품권 가맹점이 없습니다.',theme:'local'},
    onnuri:{label:'온누리',summary:'가맹점',empty:'경로상 온누리상품권 가맹점이 없습니다.',theme:'onnuri'}
  })[tab]||{label:'추천',summary:'추천',empty:'표시할 정보가 없습니다.',theme:'fuel'};
}
function drivePoiIconSvg(tab='fuel'){
  const common='viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  if(tab==='fuel')return `<svg ${common}><path d="M4 21V5.2A2.2 2.2 0 0 1 6.2 3h8.1A2.2 2.2 0 0 1 16.5 5.2V21"/><rect x="6.8" y="6.2" width="6.9" height="5.3" rx=".6"/><path d="M3 21h15M16.5 7.5l2.2 2.2V17a2 2 0 0 0 4 0v-4.6l-1.9-1.9"/></svg>`;
  if(tab==='onnuri')return `<svg ${common}><path d="M3.5 10 5 4.8h14l1.5 5.2M3.5 10h17v2.5a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4.5-1.5V10Z"/><path d="M5.5 15.2V21h13v-5.8M9.2 21v-4h5.6v4"/><path d="M16.3 5.2l1.2 1.2 2.2-2.2" stroke-width="1.65"/></svg>`;
  return `<svg ${common}><rect x="3.5" y="4.5" width="17" height="15.5" rx="3"/><path d="M3.5 9.2h17M7 13.3h5.6M7 16.6h3.4"/><circle cx="16.2" cy="14.8" r="2.2"/><path d="M16.2 13.5v2.7M14.9 14.8h2.6" stroke-width="1.6"/></svg>`;
}

function drivePoiDistanceLabel(m,item=null){const exact=Number(item?.__roadM);if(item?.__roadConfirmed&&Number.isFinite(exact))return km(exact);const v=Number(m);return Number.isFinite(v)?`경로상 약 ${km(v)}`:'거리 확인 필요'}
function drivePoiItemTitle(tab,item){
  if(tab==='fuel')return fuelWon(item?.price);
  return item?.name||item?.market||'가맹점';
}
function drivePoiItemSubtitle(tab,item){
  if(tab==='fuel')return `${item?.brandName||''} ${String(item?.name||'주유소').trim()}`.trim();
  if(tab==='onnuri')return [item?.market||'', item?.matchedAddress||item?.address||''].filter(Boolean).join(' · ');
  return item?.address||'주소 정보 없음';
}
function routeScopedMerchants(items,{maxOffset=180,minAhead=80,maxAhead=16000,includeApprox=true}={}){
  const g=state.route?.geometry;if(!state.tripStartedAt||!g?.length)return [];
  const liveMatch=pointValid(state.user)?routePosOfPoint(Number(state.user.lng),Number(state.user.lat),g,null,200):null;
  const cur=Number.isFinite(Number(liveMatch?.routeDistance))?Number(liveMatch.routeDistance):currentRouteDistanceAt(state.currentRouteIndex||0),out=[];
  const seen=new Set();
  for(const item of items||[]){
    const lng=Number(item?.lng??item?.lon??item?.longitude??item?.x),lat=Number(item?.lat??item?.latitude??item?.y);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    if(includeApprox===false&&(item?.approximate||item?.precision==='market-zone'||item?.precision==='admin-zone'))continue;
    const m=routePosOfPoint(lng,lat,g,null,maxOffset+40);
    if(!m||Number(m.distance)>maxOffset)continue;
    const ahead=Number(m.routeDistance)-cur;
    if(ahead<minAhead||ahead>maxAhead)continue;
    const key=`${Math.round(lat*10000)}:${Math.round(lng*10000)}:${item?.name||item?.market||''}`;
    if(seen.has(key))continue;seen.add(key);
    out.push({...item,__aheadM:ahead,__routeDistance:Number(m.routeDistance),__offsetM:Number(m.distance),__snapLng:Number(m.lng),__snapLat:Number(m.lat)});
  }
  out.sort((a,b)=>Number(a.__aheadM)-Number(b.__aheadM));
  return out;
}
function buildDrivePoiData(){
  const fuel=scopeFuelToRoute(state.fuelData?.stations||[]).slice(0,12).map(x=>({...x,brandName:fuelBrandName(x?.pollDivCo||x?.brand||x?.brandCode||'')}));
  const local=routeScopedMerchants([...(state.drivePoiMerchants?.local||[]),...(state.localVoucherData?.items||[])],{maxOffset:420,minAhead:0,maxAhead:25000,includeApprox:true}).slice(0,12);
  const onnuri=routeScopedMerchants([...(state.drivePoiMerchants?.onnuri||[]),...(state.onnuriData?.items||[])],{maxOffset:500,minAhead:0,maxAhead:25000,includeApprox:true}).slice(0,12);
  state.drivePoiData={fuel,local,onnuri};
  return state.drivePoiData;
}
function renderDrivePoiStack(){
  const root=$('drivePoiStack');if(!root)return;
  const driving=Boolean(state.tripStartedAt&&state.route?.geometry?.length&&$('driveView')&&!$('driveView').classList.contains('hidden')&&state.routeMode==='car');
  if(!driving){root.classList.add('hidden');return}
  const data=state.drivePoiData||buildDrivePoiData();
  const tabs=['local','onnuri','fuel'];
  let visible=0;
  for(const tab of tabs){
    const el=$(`drivePoi${tab[0].toUpperCase()+tab.slice(1)}Card`);if(!el)continue;
    const first=(data[tab]||[])[0];
    if(!first){el.classList.add('hidden');continue}
    visible++;
    el.classList.remove('hidden');
    const spec=drivePoiTabSpec(tab);
    const headline=tab==='fuel'?fuelWon(first.price):drivePoiItemTitle(tab,first);
    const sub=tab==='fuel'?drivePoiItemSubtitle(tab,first):drivePoiItemSubtitle(tab,first);
    el.className=`drive-poi-card ${spec.theme}`;
    el.innerHTML=`<span class="poi-icon">${drivePoiIconSvg(tab)}</span><span class="poi-copy"><small>${spec.label} · ${drivePoiDistanceLabel(first.__aheadM,first)}</small><b>${escapeHtml(headline)}</b><em>${escapeHtml(sub)}</em></span>`;
  }
  const junctionActive=!$('laneAssistLayer')?.classList.contains('hidden');
  const safetyActive=!$('safetyAlert')?.classList.contains('hidden')||!$('sectionSpeedPanel')?.classList.contains('hidden');
  // 주행 중에는 카드 3개가 지도를 가리지 않게 항상 접어 둔다. 추천 버튼/지도 핀으로만 진입.
  root.classList.add('hidden');
}
function drivePoiEntryButtonHtml(tab,item,index){
  const spec=drivePoiTabSpec(tab);
  const title=tab==='fuel'?`${fuelWon(item?.price)} · ${escapeHtml(String(item?.name||'주유소'))}`:escapeHtml(item?.name||item?.market||'가맹점');
  const meta=[];
  if(tab==='fuel'){if(item?.brandName)meta.push(escapeHtml(item.brandName));if(item?.distance)meta.push(escapeHtml(km(Number(item.distance))));}
  else if(tab==='onnuri'){const use=onnuriUseFlags(item).join(' · ');if(use)meta.push(escapeHtml(use));if(item?.market)meta.push(escapeHtml(item.market));}
  else {const use=voucherUseFlags(item).join(' · ');if(use)meta.push(escapeHtml(use));}
  return `<button type="button" class="drive-poi-entry ${spec.theme}" data-drive-poi-item="${tab}:${index}">
    <span class="entry-left"><i class="entry-icon">${drivePoiIconSvg(tab)}</i><span class="entry-copy"><small>${spec.label} · ${escapeHtml(drivePoiDistanceLabel(item.__aheadM,item))}</small><b>${title}</b><em>${escapeHtml(drivePoiItemSubtitle(tab,item))}</em></span></span>
    <span class="entry-right"><strong>${escapeHtml(drivePoiDistanceLabel(item.__aheadM,item))}</strong>${meta.length?`<small>${meta.join(' · ')}</small>`:''}</span>
  </button>`;
}
/* Cloudflare Workers AI: opt-in explanation only; route calculation and merchant ranking remain deterministic. */
let driveAiInFlight=false;
function initDriveAiRecommendation(){
  const model=$('driveAiModel'),button=$('driveAiExplainBtn');
  if(!model||!button)return;
  try{const saved=localStorage.getItem('dangollo.workerAiModel');if(['llama','gemma'].includes(saved))model.value=saved}catch{}
  model.addEventListener('change',()=>{try{localStorage.setItem('dangollo.workerAiModel',model.value)}catch{}});
  document.querySelectorAll('[data-drive-poi-tab]').forEach(tab=>tab.addEventListener('click',()=>{const result=$('driveAiResult');if(result){result.hidden=true;result.textContent=''}}));
  button.addEventListener('click',runDriveAiExplanation);
}
async function runDriveAiExplanation(){
  if(driveAiInFlight)return;
  const output=$('driveAiResult'),button=$('driveAiExplainBtn');if(!output||!button)return;
  const category=state.drivePoiTab||'local';
  const candidates=(state.drivePoiData?.[category]||[]).slice(0,6).map(x=>({
    name:String(x.name||x.market||'가맹점').slice(0,72),
    category:category==='fuel'?'주유소':category==='onnuri'?'온누리':'지역사랑',
    distanceLabel:String(drivePoiDistanceLabel(x.__aheadM,x)).slice(0,48),
    priceLabel:category==='fuel'?String(fuelWon(x.price)):'',
    description:String(drivePoiItemSubtitle(category,x)).slice(0,120)
  }));
  output.hidden=false;output.textContent='';
  if(!candidates.length){output.textContent='추천 후보를 먼저 조회해 주세요.';return}
  driveAiInFlight=true;button.disabled=true;button.textContent='AI 설명 생성 중';
  try{
    const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),18000);
    let res,body;
    try{
      res=await fetch('/api/ai-recommend',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:$('driveAiModel')?.value||'llama',category,destination:String(state.destination?.name||'').slice(0,100),candidates}),signal:ctrl.signal});
      body=await res.json();
    }finally{clearTimeout(timeout)}
    if(!res.ok||!body?.ok)throw new Error(body?.message||'Cloudflare AI 연결을 확인해 주세요.');
    output.textContent=String(body.answer||''); // no untrusted HTML rendering
  }catch(err){output.textContent=err?.name==='AbortError'?'AI 응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.':String(err.message||'AI 추천 설명을 불러오지 못했습니다.');}
  finally{driveAiInFlight=false;button.disabled=false;button.textContent='AI 추천 설명'}
}
function renderDrivePoiPanel(){
  const panel=$('drivePoiPanel'),body=$('drivePoiPanelBody');if(!panel||!body||panel.classList.contains('hidden'))return;
  document.querySelectorAll('[data-drive-poi-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.drivePoiTab===state.drivePoiTab));
  const items=(state.drivePoiData?.[state.drivePoiTab]||[]);
  if(!items.length){body.innerHTML=`<div class="drive-poi-empty">${state.drivePoiLoading?'경로 주변 가맹점을 찾고 있습니다…':escapeHtml(drivePoiTabSpec(state.drivePoiTab).empty)}</div>`;return}
  body.innerHTML=items.map((item,i)=>drivePoiEntryButtonHtml(state.drivePoiTab,item,i)).join('');
  body.querySelectorAll('[data-drive-poi-item]').forEach(btn=>btn.onclick=()=>{
    const [tab,idx]=String(btn.dataset.drivePoiItem||'').split(':');
    const item=(state.drivePoiData?.[tab]||[])[Number(idx)];
    if(!item)return;
    const place=tab==='fuel'
      ?normalizedPlace({name:item.name||'주유소',address:item.addr||item.address||'',lng:Number(item.lng),lat:Number(item.lat)})
      :normalizedPlace({name:item.name||item.market||'가맹점',address:item.matchedAddress||item.address||item.market||'',lng:Number(item.lng),lat:Number(item.lat)});
    openDrivePlaceChoice(place);
  });
}
/* Screen-space placement: reserve maneuver, lane and bottom HUD before showing suggestions. */
function layoutDrivePoiPanel(){
  const panel=$('drivePoiPanel'),sheet=panel?.querySelector('.drive-poi-panel-sheet'),drive=$('driveView');
  if(!panel||!sheet||!drive||panel.classList.contains('hidden'))return;
  const root=drive.getBoundingClientRect();
  const width=root.width,height=root.height;
  if(width<100||height<150)return;
  const landscape=width>height*1.16;
  const safe=12;
  const rects=id=>{
    const el=$(id);if(!el||el.classList.contains('hidden'))return null;
    const st=getComputedStyle(el);if(st.display==='none'||st.visibility==='hidden')return null;
    const r=el.getBoundingClientRect();return r.width>0&&r.height>0?r:null;
  };
  const bottom=rects('driveBottomNormal')||rects('driveBottomDestination');
  const bottomCard=rects('driveMenuBtn')?.closest('.drive-bottom-card')?.getBoundingClientRect()||drive.querySelector('.drive-bottom-card')?.getBoundingClientRect();
  const bottomY=Math.min(height-safe,(bottomCard?.top??(root.bottom-115))-root.top-safe);
  const fixed=['maneuverDistance','nextManeuver','laneAssistLayer','safetyAlert','sectionSpeedPanel','vmsBanner'];
  let top=safe+68;
  for(const id of fixed){const r=rects(id);if(r)top=Math.max(top,r.bottom-root.top+safe)}
  // In landscape, the left guidance area is reserved horizontally, rather than stacking vertically.
  if(landscape){
    const left=rects('maneuverDistance')?.closest('.maneuver-stack')?.getBoundingClientRect()||drive.querySelector('.maneuver-stack')?.getBoundingClientRect();
    let leftBound=Math.max(width*.48,(left?.right??root.left)-root.left+12);
    leftBound=Math.min(width-205,leftBound);
    sheet.style.left=`${Math.round(leftBound)}px`;
    sheet.style.right='auto';
    sheet.style.width=`${Math.max(210,Math.min(420,width-leftBound-52))}px`;
    sheet.style.top=`${Math.round(Math.max(12,Math.min(top,Math.max(12,bottomY-175))))}px`;
    sheet.style.maxHeight=`${Math.max(120,Math.round(bottomY-parseFloat(sheet.style.top)-8))}px`;
  }else{
    // Place under the visible navigation/branch HUD and keep a scrollable window above the ETA bar.
    const usableTop=Math.min(Math.max(top,150),bottomY-110);
    sheet.style.left='8px';sheet.style.right='8px';sheet.style.width='auto';
    sheet.style.top=`${Math.max(12,Math.round(usableTop))}px`;
    sheet.style.maxHeight=`${Math.max(100,Math.round(bottomY-usableTop))}px`;
  }
}
const drivePoiRoadDistanceCache=new Map();
let drivePoiRoadJob=0;
async function calculateDrivePoiRoadDistances(tab){
  if(!['local','onnuri'].includes(tab)||!pointValid(state.user))return;
  const token=++drivePoiRoadJob;
  const candidates=(state.drivePoiData?.[tab]||[]).slice(0,8).filter(pointValid);
  const origin={lat:Number(state.user.lat),lng:Number(state.user.lng)};
  for(let i=0;i<candidates.length;i+=2){
    if(token!==drivePoiRoadJob||!state.tripStartedAt||state.drivePoiTab!==tab)return;
    await Promise.all(candidates.slice(i,i+2).map(async item=>{
      const key=`${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${Number(item.lat).toFixed(5)}:${Number(item.lng).toFixed(5)}`;
      let d=drivePoiRoadDistanceCache.get(key);
      if(d===undefined){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
        try{
          const res=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,
            body:JSON.stringify({origin,destination:{lat:Number(item.lat),lng:Number(item.lng)},priority:'RECOMMEND',alternatives:false,mode:'car'})});
          if(!res.ok)throw Error('route HTTP '+res.status);
          const json=await res.json();
          d=Number(json?.distance??json?.route?.distance);
          if(!Number.isFinite(d)||d<=0)throw Error('missing road distance');
          drivePoiRoadDistanceCache.set(key,d);
        }catch{d=null}finally{clearTimeout(timer)}
      }
      if(token!==drivePoiRoadJob)return;
      if(Number.isFinite(d)&&d>0){item.__roadM=d;item.__roadConfirmed=true;}
    }));
    if(token===drivePoiRoadJob)renderDrivePoiPanel();
  }
}
function openDrivePoiPanel(tab=state.drivePoiTab||'local'){
  state.drivePoiTab=tab;$('drivePoiPanel')?.classList.remove('hidden');
  buildDrivePoiData();renderDrivePoiPanel();layoutDrivePoiPanel();requestAnimationFrame(layoutDrivePoiPanel);
  ensureDrivePoiData();
  calculateDrivePoiRoadDistances(state.drivePoiTab).catch(e=>console.warn('POI road distance',e));
}
function closeDrivePoiPanel(){drivePoiRoadJob++;$('drivePoiPanel')?.classList.add('hidden')}
window.addEventListener('resize',()=>{if(!$('drivePoiPanel')?.classList.contains('hidden'))layoutDrivePoiPanel()},{passive:true});
window.addEventListener('orientationchange',()=>{requestAnimationFrame(layoutDrivePoiPanel)},{passive:true});
/* 경로를 따라 고정 거리의 표본점들을 조회. 화면 경계만 이용할 경우 지도 뒤쪽이나 다음 도시의 가맹점을 놓친다. */
function drivePoiProbePoints(){
  const cur=currentRouteDistanceAt(state.currentRouteIndex||0);
  const end=Number(state.routeCumulative?.at(-1))||cur;
  const probes=[];
  for(const offset of [400,1800,4000,7000,11000,16000,23000]){
    const pt=pointAtRouteDistance(Math.min(end,cur+offset));
    if(pt&&Number.isFinite(Number(pt.lat))&&Number.isFinite(Number(pt.lng)))probes.push(pt);
  }
  return probes.filter((x,i,a)=>a.findIndex(y=>hav(Number(x.lat),Number(x.lng),Number(y.lat),Number(y.lng))<950)===i).slice(0,7);
}
function drivePoiRegionBox(pt,radiusKm=2.8){
  const lat=Number(pt.lat),lng=Number(pt.lng);
  const dy=radiusKm/111.2,dx=radiusKm/Math.max(30,111.2*Math.cos(lat*Math.PI/180));
  return {west:lng-dx,east:lng+dx,south:lat-dy,north:lat+dy};
}
function mergeDrivePoiMerchantRows(rows){
  const seen=new Set(),out=[];
  for(const row of rows){
    const lat=Number(row?.lat),lng=Number(row?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
    const key=String(row?.id||row?.poi_id||`${row?.name||row?.market||''}|${row?.address||row?.matchedAddress||''}|${lat.toFixed(5)}|${lng.toFixed(5)}`);
    if(seen.has(key))continue;
    seen.add(key);out.push(row);
  }
  return out;
}
async function fetchDrivePoiBatch(type,probes,token){
  const endpoint=type==='local'?'/api/local-voucher':'/api/onnuri-voucher';
  const results=await Promise.allSettled(probes.map(async pt=>{
    const u=new URL(endpoint,location.origin),box=drivePoiRegionBox(pt);
    u.searchParams.set('lat',pt.lat);u.searchParams.set('lng',pt.lng);
    for(const [k,v] of Object.entries(box))u.searchParams.set(k,v);
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),11500);
    try{
      const res=await fetch(u,{headers:{accept:'application/json'},cache:'no-store',signal:ctrl.signal});
      if(!res.ok)throw Error(`${type} HTTP ${res.status}`);
      const json=await res.json();return Array.isArray(json.items)?json.items:[];
    }finally{clearTimeout(timeout)}
  }));
  if(token!==state.drivePoiFetchToken||!state.tripStartedAt)return null;
  const fulfilled=results.filter(x=>x.status==='fulfilled');
  if(!fulfilled.length)return null; // 전부 실패한 경우 이전 정상 데이터를 유지한다.
  return mergeDrivePoiMerchantRows(fulfilled.flatMap(x=>x.value)).slice(0,5000);
}
function invalidateDrivePoiRoute(){
  state.drivePoiFetchToken=(state.drivePoiFetchToken||0)+1;
  state.drivePoiFetchedAt=0;state.drivePoiFetchedRouteM=0;
  state.drivePoiData={fuel:[],local:[],onnuri:[]};state.drivePoiMerchants={local:[],onnuri:[]};state.drivePoiLoading=false;
  clearDrivePoiMarkers();
}
function ensureDrivePoiData(){
  if(!state.tripStartedAt||!state.route?.geometry?.length||!pointValid(state.user)||state.drivePoiLoading)return;
  const now=Date.now(),cur=currentRouteDistanceAt(state.currentRouteIndex||0);
  if(now-Number(state.drivePoiFetchedAt||0)<60000&&Math.abs(cur-Number(state.drivePoiFetchedRouteM||0))<2200)return;
  const probes=drivePoiProbePoints();if(!probes.length)return;
  state.drivePoiFetchedAt=now;state.drivePoiFetchedRouteM=cur;state.drivePoiLoading=true;
  const token=++state.drivePoiFetchToken;
  if(!state.fuelLoading)loadFuelPrices(state.fuelProduct).catch(()=>{});
  Promise.allSettled([
    fetchDrivePoiBatch('local',probes,token),
    fetchDrivePoiBatch('onnuri',probes,token)
  ]).then(results=>{
    if(token!==state.drivePoiFetchToken||!state.tripStartedAt)return;
    const local=results[0].status==='fulfilled'?results[0].value:null;
    const onnuri=results[1].status==='fulfilled'?results[1].value:null;
    // 빈 정상 응답도 반영하여 이전 도시의 유령 가맹점이 남지 않도록 한다.
    if(local!==null)state.drivePoiMerchants.local=local;
    if(onnuri!==null)state.drivePoiMerchants.onnuri=onnuri;
    buildDrivePoiData();renderDrivePoiStack();renderDrivePoiPanel();renderDrivePoiMarkers();
  }).finally(()=>{if(token===state.drivePoiFetchToken)state.drivePoiLoading=false});
}

function drivePoiMarkerHtml(tab,item){
  const brand=tab==='local'?'지역사랑상품권':'온누리상품권';
  const name=String(item?.name||item?.market||'가맹점');
  // Match the existing home-map merchant SVGs: a compact store silhouette, not letter badges.
  // Merchant names remain accessible through aria-label and the recommendation panel.
  const shopIcon=tab==='local'?voucherShopSvg():onnuriShopSvg();
  return `<button type="button" class="drive-route-food-marker dangollo-drive-merchant-marker ${tab}" data-drive-poi-marker="${tab}" aria-label="${escapeHtml(brand+' '+name)}" title="${escapeHtml(brand+' · '+name)}"><span class="food-symbol" aria-hidden="true">${shopIcon}</span></button>`;
}
function renderDrivePoiMarkers(){
  clearDrivePoiMarkers();
  if(!state.map||!state.tripStartedAt||!state.route?.geometry?.length||state.routeMode!=='car')return;
  const data=state.drivePoiData||buildDrivePoiData();
  const candidates=[];
  const seen=new Set();
  for(const tab of ['local','onnuri']){
    for(const item of data[tab]||[]){
      const category=classifyVoiceMerchant(item);
      // Display all verified storefront POIs, not only food/cafes.
      if(!item?.name&&!item?.market)continue;
      // Market/administrative area geocoding is not a storefront location.
      if(item?.approximate||['market-zone','admin-zone'].includes(item?.precision))continue;
      const lng=Number(item.lng),lat=Number(item.lat);
      if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
      const key=`${Math.round(lat*1e5)}:${Math.round(lng*1e5)}`;
      if(seen.has(key))continue;
      seen.add(key);
      candidates.push({tab,item,lng,lat,ahead:Number(item.__aheadM)||0});
    }
  }
  candidates.sort((a,b)=>a.ahead-b.ahead);
  for(const {tab,item,lng,lat} of candidates.slice(0,12)){
    const wrap=document.createElement('div');
    wrap.innerHTML=drivePoiMarkerHtml(tab,item);
    const el=wrap.firstElementChild;
    el.onclick=e=>{e.stopPropagation();openDrivePoiPanel(tab)};
    try{const marker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([lng,lat]).addTo(state.map);marker.getElement().classList.add('dangollo-drive-merchant-marker');state.drivePoiMarkers.push(marker)}
    catch(error){console.warn('[Dangollo] merchant marker:',error)}
  }
}
function updateDrivePoiUI(force=false){
  const driving=Boolean(state.tripStartedAt&&state.route?.geometry?.length&&$('driveView')&&!$('driveView').classList.contains('hidden')&&state.routeMode==='car');
  if(!driving){$('drivePoiStack')?.classList.add('hidden');closeDrivePoiPanel();clearDrivePoiMarkers();return}
  const now=Date.now();
  if(!force&&now-Number(state.lastDrivePoiRenderAt||0)<1200)return;
  state.lastDrivePoiRenderAt=now;
  if(!state.localVoucherData){const cached=readVoucherStaleCache();if(cached?.items?.length)state.localVoucherData=cached}
  if(!state.onnuriData){const cached=readOnnuriStaleCache();if(cached?.items?.length)state.onnuriData=cached}
  buildDrivePoiData();
  renderDrivePoiStack();
  renderDrivePoiPanel();
  if(force||now-Number(state.lastDrivePoiMarkerAt||0)>2500){state.lastDrivePoiMarkerAt=now;renderDrivePoiMarkers()}
  ensureDrivePoiData();
}

/* ---------- SPEECH ---------- */
function koreanVoices(){
  if(!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter(v=>
    (v.lang||'').toLowerCase().startsWith('ko') ||
    /korean|한국|ko-kr/i.test(`${v.lang||''} ${v.name||''} ${v.voiceURI||''}`)
  );
}

// Web Speech API does not expose a standardized gender field, so Korean
// voices whose names imply a male voice are preferred. This follows the
// device/browser voice list and falls back to the first Korean voice.
function pickMaleKoreanVoice(preferredCharacter='sunsik'){
  const voices=koreanVoices();
  if(!voices.length) return null;
  const maleRegex=/male|man|남성|남자|injoon|in-joon|인준|jinho|jin-ho|진호|hyunsu|hyun-su|현수|minho|min-ho|민호|joon|jun|준|youngho|seongho|donghyun/i;
  const femaleRegex=/female|woman|여성|여자|sunhi|sun-hi|yuna|yoona|sora|seoyeon|seo-yeon|유나|서연/i;
  const maleVoices=voices.filter(v=>maleRegex.test(`${v.name||''} ${v.voiceURI||''}`) && !femaleRegex.test(`${v.name||''} ${v.voiceURI||''}`));
  if(!maleVoices.length) return voices.find(v=>!femaleRegex.test(`${v.name||''} ${v.voiceURI||''}`)) || voices[0] || null;

  // Keep the two male guides distinguishable when multiple voices exist.
  if(preferredCharacter==='hunmin' && maleVoices.length>1){
    const bright=/minho|min-ho|민호|joon|jun|준|young|youth|bright|청년|젊|밝/i;
    return maleVoices.find(v=>bright.test(`${v.name||''} ${v.voiceURI||''}`)) || maleVoices[1];
  }
  if(preferredCharacter==='sunsik'){
    const mature=/injoon|in-joon|인준|jinho|jin-ho|진호|hyunsu|hyun-su|현수|deep|bass|baritone|mature|middle|저음|중년/i;
    return maleVoices.find(v=>mature.test(`${v.name||''} ${v.voiceURI||''}`)) || maleVoices[0];
  }
  return maleVoices[0];
}

function pickDaimVoice(){
  const voices=koreanVoices();
  if(!voices.length) return null;
  const female=/female|woman|여성|여자|sunhi|sun-hi|yuna|yoona|sora|seoyeon|seo-yeon|유나|서연/i;
  return voices.find(v=>female.test(`${v.name||''} ${v.voiceURI||''}`)) || voices[0] || null;
}


const RADIO_VOLUME_KEY='jofams.radioVolume';
const NAV_VOLUME_KEY='jofams.navVolume';
const RADIO_INDEX_KEY='jofams.radioIndex';
const RADIO_LEVEL_VERSION_KEY='jofams.radioLevelVersion';
const RADIO_LEVEL_VERSION='60-normalized-v1';
let radioAudioCtx=null,radioMediaSource=null,radioPreAnalyser=null,radioAutoGain=null,radioLimiter=null,radioAgcTimer=0;

function radioPlayer(){return $('radioPlayer')}
async function ensureRadioLoudnessNormalizer(){
  const el=radioPlayer();
  if(!el)return false;
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return false;
    if(!radioAudioCtx){
      radioAudioCtx=new AudioCtx();
      radioMediaSource=radioAudioCtx.createMediaElementSource(el);
      radioPreAnalyser=radioAudioCtx.createAnalyser();
      radioPreAnalyser.fftSize=2048;
      radioPreAnalyser.smoothingTimeConstant=.72;
      radioAutoGain=radioAudioCtx.createGain();
      radioAutoGain.gain.value=1;
      radioLimiter=radioAudioCtx.createDynamicsCompressor();
      // 서로 다른 MP3의 체감 음량 차이를 줄이고 갑작스러운 피크는 제한한다.
      radioLimiter.threshold.value=-12;
      radioLimiter.knee.value=18;
      radioLimiter.ratio.value=12;
      radioLimiter.attack.value=.003;
      radioLimiter.release.value=.22;
      radioMediaSource.connect(radioPreAnalyser);
      radioPreAnalyser.connect(radioAutoGain);
      radioAutoGain.connect(radioLimiter);
      radioLimiter.connect(radioAudioCtx.destination);
    }
    if(radioAudioCtx.state==='suspended')await radioAudioCtx.resume();
    if(!radioAgcTimer){
      const buf=new Float32Array(radioPreAnalyser.fftSize);
      radioAgcTimer=setInterval(()=>{
        if(!radioPreAnalyser||!radioAutoGain||!el||el.paused)return;
        try{
          radioPreAnalyser.getFloatTimeDomainData(buf);
          let sum=0;
          for(let i=0;i<buf.length;i++)sum+=buf[i]*buf[i];
          const rms=Math.sqrt(sum/buf.length);
          if(!Number.isFinite(rms)||rms<.001)return;
          // 디지털 음원은 물리적 60 dB SPL을 직접 보장할 수 없으므로
          // 약 -18 dBFS RMS를 목표로 자동 보정하고 마스터 재생레벨은 60%로 둔다.
          const targetRms=Math.pow(10,-18/20);
          const desired=Math.max(.35,Math.min(3.5,targetRms/rms));
          const now=radioAudioCtx.currentTime;
          radioAutoGain.gain.cancelScheduledValues(now);
          radioAutoGain.gain.setTargetAtTime(desired,now,.35);
        }catch{}
      },250);
    }
    return true;
  }catch(e){
    console.warn('radio loudness normalizer unavailable',e);
    return false;
  }
}
function setRadioVolume(v,persist=true){
  state.radioVolume=Math.max(0,Math.min(1,Number(v)));
  if(persist)try{localStorage.setItem(RADIO_VOLUME_KEY,String(state.radioVolume))}catch{}
  const el=radioPlayer();
  if(el)el.volume=state.radioDucked?state.radioVolume*.25:state.radioVolume;
  if($('radioVolume'))$('radioVolume').value=Math.round(state.radioVolume*100);
  if($('radioVolumeValue'))$('radioVolumeValue').textContent=`${Math.round(state.radioVolume*100)}%`;
}
function setNavVolume(v,persist=true){
  state.voiceVolume=Math.max(0,Math.min(1,Number(v)));
  if(persist)try{localStorage.setItem(NAV_VOLUME_KEY,String(state.voiceVolume))}catch{}
  updateVolumeUI();
  const hint=$('navVolumeZeroHint');if(hint)hint.classList.toggle('hidden',state.voiceVolume>0);
}
function setRadioDucked(ducked){
  state.radioDucked=Boolean(ducked);
  const el=radioPlayer();if(!el)return;
  const target=state.radioDucked?state.radioVolume*.25:state.radioVolume;
  const start=Number(el.volume)||0,steps=6;let n=0;
  clearInterval(state.radioDuckTimer);
  state.radioDuckTimer=setInterval(()=>{
    n++;el.volume=Math.max(0,Math.min(1,start+(target-start)*(n/steps)));
    if(n>=steps){clearInterval(state.radioDuckTimer);state.radioDuckTimer=0}
  },50);
}
function scheduleRadioUnduck(text=''){
  clearTimeout(state.radioUnduckTimeout);
  const ms=Math.max(1200,Math.min(9000,700+String(text).length*95));
  state.radioUnduckTimeout=setTimeout(()=>setRadioDucked(false),ms);
}
async function loadRadioSchedule(){
  try{
    const r=await fetch('/assets/radio/schedule.json',{cache:'no-cache'});
    const d=await r.json();
    state.radioSchedule=Array.isArray(d.items)?d.items:[];
  }catch(e){console.warn('radio schedule load failed',e);state.radioSchedule=[]}
  return state.radioSchedule;
}

function radioToggleMarkup(isOn){
  return `<svg class="dangollo-quick-svg drive-radio-svg ${isOn?'is-on':'is-off'}" data-quick-icon="radio" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#ffffff" stroke-width="3.1" stroke-linecap="round" aria-hidden="true">
    <circle cx="16" cy="16" r="2.6" fill="#ffffff" stroke="none"/>
    <path class="dangollo-radio-wave inner-left" d="M11.5 11.6a6.2 6.2 0 0 0 0 8.8"/>
    <path class="dangollo-radio-wave inner-right" d="M20.5 11.6a6.2 6.2 0 0 1 0 8.8"/>
    <path class="dangollo-radio-wave outer-left" d="M8 8a11.3 11.3 0 0 0 0 16"/>
    <path class="dangollo-radio-wave outer-right" d="M24 8a11.3 11.3 0 0 1 0 16"/>
  </svg>`;
}

function stopNavigationRadioImmediately(){
  state.radioStopEpoch=(Number(state.radioStopEpoch)||0)+1;
  state.radioPlaying=false;
  state.radioDucked=false;
  try{
    const el=radioPlayer();
    if(el){el.pause();el.autoplay=false;el.currentTime=0;}
  }catch(e){console.warn('radio immediate stop failed',e)}
  try{updateRadioUI()}catch{}
}
function updateRadioUI(){
  const btn=$('driveRadioBtn');if(!btn)return;
  const player=radioPlayer();
  const on=Boolean(player&&!player.paused&&!player.ended);
  state.radioPlaying=on;
  btn.classList.toggle('on',on);
  btn.classList.toggle('off',!on);
  btn.setAttribute('aria-label',on?'라디오 정지':'라디오 재생');
  btn.setAttribute('aria-pressed',String(on));
  const icon=btn.querySelector('.drive-radio-icon');
  if(icon)icon.innerHTML=radioToggleMarkup(on);
}
async function radioLoadIndex(index,autoplay=false){
  const stopEpoch=Number(state.radioStopEpoch)||0;
  const el=radioPlayer();if(!el){console.warn('radio player element missing');return false}
  if(!state.radioSchedule?.length)await loadRadioSchedule();
  if(stopEpoch!==(Number(state.radioStopEpoch)||0))return false;
  // schedule.json 로딩이 늦어도 기본 음원으로 즉시 재생 가능하게 한다.
  if(!state.radioSchedule?.length){
    state.radioSchedule=[{id:'radio-1',name:'가상 라디오',src:'/assets/radio/radio_1.mp3'}];
  }
  state.radioIndex=((Number(index)||0)%state.radioSchedule.length+state.radioSchedule.length)%state.radioSchedule.length;
  try{localStorage.setItem(RADIO_INDEX_KEY,String(state.radioIndex))}catch{}
  const item=state.radioSchedule[state.radioIndex];
  const wanted=new URL(item.src,location.href).href;
  if(el.src!==wanted)el.src=item.src;
  el.volume=state.radioDucked?state.radioVolume*.25:state.radioVolume;
  el.load?.();
  updateRadioUI();
  if(autoplay){
    try{
      await ensureRadioLoudnessNormalizer();
      if(stopEpoch!==(Number(state.radioStopEpoch)||0))return false;
      await el.play();
      if(stopEpoch!==(Number(state.radioStopEpoch)||0)){el.pause();return false}
      state.radioPlaying=true;updateRadioUI();return true;
    }catch(e){
      console.warn('radio autoplay blocked',e);state.radioPlaying=false;updateRadioUI();return false;
    }
  }
  return true;
}
async function toggleRadio(){
  const el=radioPlayer();
  if(!el){toast('라디오 재생기를 불러오지 못했습니다.');return}
  try{
    if(el.paused){
      if(!el.getAttribute('src'))el.src='/assets/radio/radio_1.mp3';
      el.volume=state.radioDucked?state.radioVolume*.25:state.radioVolume;
      await ensureRadioLoudnessNormalizer();
      await el.play();
      state.radioPlaying=true;
    }else{
      el.pause();
      state.radioPlaying=false;
    }
  }catch(e){
    console.warn('radio toggle failed',e);
    state.radioPlaying=false;
    toast('라디오 재생에 실패했습니다.');
  }
  updateRadioUI();
}
async function nextRadio(){await radioLoadIndex(state.radioIndex+1,true)}
async function initVirtualRadio(){
  const player=radioPlayer();
  if(player&&!player.getAttribute('src'))player.src='/assets/radio/radio_1.mp3';
  const levelVersion=localStorage.getItem(RADIO_LEVEL_VERSION_KEY);
  if(levelVersion!==RADIO_LEVEL_VERSION){state.radioVolume=.6;try{localStorage.setItem(RADIO_VOLUME_KEY,'0.6');localStorage.setItem(RADIO_LEVEL_VERSION_KEY,RADIO_LEVEL_VERSION)}catch{}}
  else{const rv=Number(localStorage.getItem(RADIO_VOLUME_KEY));if(Number.isFinite(rv))state.radioVolume=Math.max(0,Math.min(1,rv));}
  const nv=Number(localStorage.getItem(NAV_VOLUME_KEY));if(Number.isFinite(nv))state.voiceVolume=Math.max(0,Math.min(1,nv));
  const ri=Number(localStorage.getItem(RADIO_INDEX_KEY));if(Number.isFinite(ri))state.radioIndex=Math.max(0,ri);
  await loadRadioSchedule();
  await radioLoadIndex(state.radioIndex,false);
  setRadioVolume(state.radioVolume,false);setNavVolume(state.voiceVolume,false);updateRadioUI();
  const el=radioPlayer();if(el){
    el.onended=()=>{if(state.tripStartedAt&&state.radioPlaying)radioLoadIndex(state.radioIndex+1,true)};
    el.onplay=()=>{state.radioPlaying=true;updateRadioUI()};
    el.onpause=()=>{state.radioPlaying=false;updateRadioUI()};
  }
}
window.addEventListener('jofams-native-audio-duck',e=>setRadioDucked(Boolean(e?.detail?.ducked)));

function speak(text,retry=0){
  if(!state.sound||!text||Number(state.voiceVolume)<=0)return;
  const c=characterDefs[state.character];
  const rate=state.character==='sunsik'?.82:state.character==='hunmin'?1.08:c.rate;
  const pitch=state.character==='sunsik'?.58:state.character==='hunmin'?.92:c.pitch;
  try{
    if(window.JofamsTtsBridge){
      if(window.JofamsTtsBridge.isReady?.()){
        setRadioDucked(true);
        window.JofamsTtsBridge.speak(String(text),state.character,rate,pitch,state.voiceVolume);
        scheduleRadioUnduck(text); // native duck 이벤트 미지원 WebView용 fallback
        return;
      }
      if(retry<8){setTimeout(()=>speak(text,retry+1),300);return}
    }
  }catch(e){console.warn('native TTS failed; falling back',e)}
  if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return;
  const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.volume=state.voiceVolume;u.rate=rate;u.pitch=pitch;
  if(state.character==='sunsik')u.voice=pickMaleKoreanVoice('sunsik');else if(state.character==='hunmin')u.voice=pickMaleKoreanVoice('hunmin');else u.voice=pickDaimVoice();
  u.onstart=()=>setRadioDucked(true);u.onend=()=>setRadioDucked(false);u.onerror=()=>setRadioDucked(false);
  speechSynthesis.cancel();speechSynthesis.speak(u);
}

function ownerSuffix(){return state.firebase.user?.uid||'guest'}
function settingsKey(){return state.firebase.user?`${SETTINGS}.${state.firebase.user.uid}`:SETTINGS}

const SAVED_GROUPS_LEGACY='jofams-navi.saved-groups.v1';

function savedGroupsStorageKey(){
  return state.firebase.user?.uid
    ?`${SAVED_GROUPS_LEGACY}.${state.firebase.user.uid}`
    :SAVED_GROUPS_LEGACY;
}
function normalizeSavedGroupsPayload(d){
  const groups=Array.isArray(d?.groups)
    ?d.groups.filter(x=>x&&x.id&&x.name).map(x=>({id:String(x.id),name:String(x.name)}))
    :[];
  const map=d?.map&&typeof d.map==='object'?{...d.map}:{};
  return {groups,map};
}
function loadSavedPlaceGroups(){
  const uid=state.firebase.user?.uid||'';
  const key=savedGroupsStorageKey();
  let d=normalizeSavedGroupsPayload(readJson(key,null));

  // 로그인한 사용자는 오직 본인 UID 저장소를 사용한다.
  // 단, 해당 UID 저장소가 비어 있는 최초 1회에는 비로그인 legacy 그룹을 가져와 사용자별 저장소로 이관한다.
  if(uid && !d.groups.length){
    const legacy=normalizeSavedGroupsPayload(readJson(SAVED_GROUPS_LEGACY,null));
    if(legacy.groups.length){
      d=legacy;
      try{
        localStorage.setItem(key,JSON.stringify(d));
      }catch(e){
        console.warn('saved groups uid migration failed',e);
      }
    }
  }

  state.savedPlaceGroups=d.groups;
  state.savedPlaceGroupMap=d.map;

  if(!state.savedPlaceGroups.length){
    state.savedPlaceGroups=[{id:'favorites',name:'즐겨찾기'}];
  }
  if(!state.savedPlaceGroups.some(g=>g.id==='favorites')){
    state.savedPlaceGroups.unshift({id:'favorites',name:'즐겨찾기'});
  }

  if(!state.activeSavedGroup||(
    state.activeSavedGroup!=='all' &&
    !state.savedPlaceGroups.some(g=>g.id===state.activeSavedGroup)
  )){
    state.activeSavedGroup='all';
  }
}
function persistSavedPlaceGroups(){
  const payload=JSON.stringify({
    groups:state.savedPlaceGroups,
    map:state.savedPlaceGroupMap
  });
  try{
    localStorage.setItem(savedGroupsStorageKey(),payload);
  }catch(e){
    console.warn('saved groups persist failed',e);
  }
  // 로그인 중에는 UID별 Firestore에도 저장하여 같은 ID의 다른 기기에서도 동일 그룹을 사용한다.
  if(state.firebase.user)saveCloudSavedPlaceGroups().catch(e=>console.warn('saved groups cloud save failed',e));
}
async function saveCloudSavedPlaceGroups(){
  if(!state.firebase.user||!state.firebase.mods?.fsMod||!state.firebase.db)return false;
  const {fsMod}=state.firebase.mods;
  const ref=fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','savedPlaceGroups');
  await fsMod.setDoc(ref,{
    groups:state.savedPlaceGroups,
    map:state.savedPlaceGroupMap,
    updatedAt:fsMod.serverTimestamp()
  },{merge:true});
  return true;
}
async function loadCloudSavedPlaceGroups(){
  if(!state.firebase.user||!state.firebase.mods?.fsMod||!state.firebase.db)return false;
  try{
    const {fsMod}=state.firebase.mods;
    const ref=fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','savedPlaceGroups');
    const snap=await fsMod.getDoc(ref);
    if(snap.exists()){
      const d=normalizeSavedGroupsPayload(snap.data());
      if(d.groups.length){
        state.savedPlaceGroups=d.groups;
        state.savedPlaceGroupMap=d.map;
        if(!state.savedPlaceGroups.some(g=>g.id==='favorites')){
          state.savedPlaceGroups.unshift({id:'favorites',name:'즐겨찾기'});
        }
        localStorage.setItem(savedGroupsStorageKey(),JSON.stringify({groups:state.savedPlaceGroups,map:state.savedPlaceGroupMap}));
        if(!state.activeSavedGroup||(
          state.activeSavedGroup!=='all'&&!state.savedPlaceGroups.some(g=>g.id===state.activeSavedGroup)
        ))state.activeSavedGroup='all';
        return true;
      }
    }
    // 서버에 아직 그룹 데이터가 없으면 현재 UID 로컬 그룹을 최초 1회 업로드한다.
    await saveCloudSavedPlaceGroups();
    return true;
  }catch(e){
    console.warn('saved groups cloud load failed',e);
    return false;
  }
}
function savedGroupName(id){
  return state.savedPlaceGroups.find(g=>g.id===id)?.name||'즐겨찾기';
}
function favoriteGroupId(p){
  return state.savedPlaceGroupMap[p.id||favoriteId(p)]||'favorites';
}
function renderSavedGroups(){
  const tabs=$('savedGroupTabs'),box=$('savedPlacesList');if(!tabs||!box)return;
  const counts={all:state.favorites.length};
  for(const p of state.favorites){const gid=favoriteGroupId(p);counts[gid]=(counts[gid]||0)+1}
  tabs.innerHTML=[
    `<button type="button" data-saved-group="all" class="${state.activeSavedGroup==='all'?'active':''}">전체 <small>${counts.all||0}</small></button>`,
    ...state.savedPlaceGroups.map(g=>`<button type="button" data-saved-group="${escapeHtml(g.id)}" class="${state.activeSavedGroup===g.id?'active':''}">${escapeHtml(g.name)} <small>${counts[g.id]||0}</small></button>`)
  ].join('');
  tabs.querySelectorAll('[data-saved-group]').forEach(b=>b.onclick=()=>{state.activeSavedGroup=b.dataset.savedGroup;renderSavedGroups()});

  const items=state.favorites.filter(p=>state.activeSavedGroup==='all'||favoriteGroupId(p)===state.activeSavedGroup);
  if(!items.length){
    box.innerHTML='<div class="saved-places-empty">이 그룹에 저장된 장소가 없습니다.</div>';
    return;
  }
  box.innerHTML=items.map((p,i)=>{
    const id=p.id||favoriteId(p),gid=favoriteGroupId(p);
    return `<article class="saved-place-card">
      <div class="saved-place-main"><span data-icon="star"></span><div><b>${escapeHtml(p.name||'저장 장소')}</b><small>${escapeHtml(p.address||'')}</small></div></div>
      <div class="saved-place-controls">
        <select data-saved-place-group="${escapeHtml(id)}" aria-label="저장 그룹">
          ${state.savedPlaceGroups.map(g=>`<option value="${escapeHtml(g.id)}" ${g.id===gid?'selected':''}>${escapeHtml(g.name)}</option>`).join('')}
        </select>
        <button type="button" data-saved-go="${escapeHtml(id)}">길찾기</button>
        <button type="button" class="danger" data-saved-remove="${escapeHtml(id)}">삭제</button>
      </div>
    </article>`;
  }).join('');
  applyIcons(box);
  box.querySelectorAll('[data-saved-place-group]').forEach(sel=>sel.onchange=()=>{
    state.savedPlaceGroupMap[sel.dataset.savedPlaceGroup]=sel.value;
    persistSavedPlaceGroups();renderSavedGroups();toast('저장 그룹을 변경했습니다.',1200);
  });
  box.querySelectorAll('[data-saved-go]').forEach(btn=>btn.onclick=async()=>{
    const p=state.favorites.find(x=>(x.id||favoriteId(x))===btn.dataset.savedGo);if(!p)return;
    closeSavedPlaces();await chooseDestination(p);
  });
  box.querySelectorAll('[data-saved-remove]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.savedRemove,p=state.favorites.find(x=>(x.id||favoriteId(x))===id);if(!p)return;
    await removeFavoritePlace(p,{message:false});delete state.savedPlaceGroupMap[id];persistSavedPlaceGroups();renderSavedGroups();toast('저장 장소를 삭제했습니다.',1400);
  });
}
function addSavedGroup(){
  const input=$('savedGroupNameInput');const name=String(input?.value||'').trim();
  if(!name)return toast('그룹 이름을 입력해 주세요.');
  if(state.savedPlaceGroups.some(g=>g.name===name))return toast('같은 이름의 그룹이 있습니다.');
  const id=`g_${Date.now().toString(36)}`;
  state.savedPlaceGroups.push({id,name});
  state.activeSavedGroup=id;
  persistSavedPlaceGroups();
  if(input)input.value='';
  renderSavedGroups();
}
function openSavedPlaces(){
  closeBottomPanels('saved');
  loadSavedPlaceGroups();
  $('savedPlacesModal')?.classList.remove('hidden');
  renderSavedGroups();
}
function closeSavedPlaces(){$('savedPlacesModal')?.classList.add('hidden')}

function favoritesStorageKey(){return state.firebase.user?`${FAVS}.${state.firebase.user.uid}`:FAVS}
function recentsStorageKey(){return state.firebase.user?`${RECENTS}.${state.firebase.user.uid}`:RECENTS}
function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}}
function loadLocal(){
  const p=readJson(SETTINGS,{});if(p.character&&characterDefs[p.character])state.character=p.character;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Number(p.voiceVolume);state.savedPlaces.home=p.home||null;state.savedPlaces.work=p.work||null;
  state.favorites=readJson(FAVS,[]);state.recentDestinations=readJson(RECENTS,[]);state.tripHistory=readJson(TRIP_HISTORY,[]);loadSavedPlaceGroups();
  syncCharacterUI();updateSavedLabels();updateVolumeUI();renderRecentDestinations();
}
function loadUserScopedLocal(){
  const p=readJson(settingsKey(),{});if(p.character&&characterDefs[p.character])state.character=p.character;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Number(p.voiceVolume);
  state.savedPlaces.home=p.home||null;state.savedPlaces.work=p.work||null;
  state.favorites=readJson(favoritesStorageKey(),[]);state.recentDestinations=readJson(recentsStorageKey(),[]);
  loadSavedPlaceGroups();
  syncCharacterUI();updateSavedLabels();updateVolumeUI();renderRecentDestinations();
}
function saveLocalSettings(){const payload=JSON.stringify({character:state.character,voiceVolume:state.voiceVolume,home:state.savedPlaces.home,work:state.savedPlaces.work});try{localStorage.setItem(settingsKey(),payload);if(!state.firebase.user)localStorage.setItem(SETTINGS,payload)}catch(e){console.warn('local settings save failed',e)}}
function saveLocalFavorites(){try{localStorage.setItem(favoritesStorageKey(),JSON.stringify(state.favorites));if(!state.firebase.user)localStorage.setItem(FAVS,JSON.stringify(state.favorites))}catch(e){console.warn('favorite local save failed',e)}}
function saveLocalRecents(){try{localStorage.setItem(recentsStorageKey(),JSON.stringify(state.recentDestinations));if(!state.firebase.user)localStorage.setItem(RECENTS,JSON.stringify(state.recentDestinations))}catch(e){console.warn('recent local save failed',e)}}
function favoriteId(p){return `${Number(p.lat).toFixed(5)}_${Number(p.lng).toFixed(5)}`}
async function dbFavoriteRequest(method,place=null,favoriteIdValue=''){
  const u=new URL('/api/favorites',location.origin);u.searchParams.set('owner',placeOwnerKey());if(favoriteIdValue)u.searchParams.set('favoriteId',favoriteIdValue);
  const opt={method,headers:{'content-type':'application/json'}};if(place)opt.body=JSON.stringify({owner:placeOwnerKey(),favoriteId:favoriteId(place),place});
  const r=await fetch(u,opt);const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`favorites DB HTTP ${r.status}`);return d
}
async function saveFavoriteToDb(place){return dbFavoriteRequest('POST',place)}
async function deleteFavoriteFromDb(id){return dbFavoriteRequest('DELETE',null,id)}
async function loadDbFavorites(){
  try{const d=await dbFavoriteRequest('GET');if(Array.isArray(d.items)){state.favorites=d.items.map(x=>({id:x.id,placeId:x.placeId||'',name:x.name,address:x.address||'',lng:Number(x.lng),lat:Number(x.lat)})).filter(pointValid);saveLocalFavorites();updateSavedLabels();updateFavoriteButtonState();return {ok:true,count:state.favorites.length}}}catch(e){console.warn('favorites DB load failed',e)}return {ok:false,count:0}
}
function isFavoritePlace(place=state.destination){if(!pointValid(place))return false;const id=favoriteId(place);return state.favorites.some(x=>(x.id||favoriteId(x))===id)}
function updateFavoriteButtonState(){const btn=$('routeFavoriteBtn');if(!btn)return;const active=isFavoritePlace();btn.classList.toggle('active',active);const span=btn.querySelector('[data-icon]');if(span){span.dataset.icon=active?'star':'star-outline';span.innerHTML=icon(active?'star':'star-outline')}btn.setAttribute('aria-label',active?'즐겨찾기 해제':'즐겨찾기 등록')}
async function addFavoritePlace(place,{message=true}={}){
  if(!pointValid(place))return false;const id=favoriteId(place);if(isFavoritePlace(place)){if(message)toast('이미 즐겨찾기에 등록된 장소입니다.');return true}
  const item={...normalizedPlace(place),id};state.favorites=[item,...state.favorites].slice(0,100);saveLocalFavorites();updateSavedLabels();updateFavoriteButtonState();
  if(message){showPlaceConfirmPopup('즐겨찾기 장소로 등록되었습니다.');toast('즐겨찾기 장소로 등록되었습니다.',2200)}
  Promise.allSettled([saveFavoriteToDb(item),state.firebase.user?saveCloudFavorites():Promise.resolve()]).then(results=>{if(results.some(r=>r.status==='rejected'))toast('즐겨찾기는 기기에 저장되었습니다. 서버 동기화를 다시 시도합니다.',2600)});
  return true
}
async function removeFavoritePlace(place,{message=true}={}){
  if(!pointValid(place))return false;const id=favoriteId(place),before=state.favorites.length;state.favorites=state.favorites.filter(x=>(x.id||favoriteId(x))!==id);if(state.favorites.length===before)return false;
  saveLocalFavorites();updateSavedLabels();updateFavoriteButtonState();if(message){showPlaceConfirmPopup('즐겨찾기 장소가 해제되었습니다.');toast('즐겨찾기 장소가 해제되었습니다.',2200)}
  Promise.allSettled([deleteFavoriteFromDb(id),state.firebase.user?saveCloudFavorites():Promise.resolve()]).then(results=>{if(results.some(r=>r.status==='rejected'))toast('기기에서는 해제되었습니다. 서버 동기화를 다시 시도합니다.',2600)});
  return true
}
async function toggleFavorite(){if(!state.destination)return;if(isFavoritePlace(state.destination))await removeFavoritePlace(state.destination);else await addFavoritePlace(state.destination)}
function renderFavoritesList(){
  const box=$('infoModalBody');if(!box)return;
  if(!state.favorites.length){box.innerHTML='<div class="empty-info">저장된 즐겨찾기가 없습니다.</div>';return}
  box.innerHTML=`<div class="favorite-list">${state.favorites.map((x,i)=>`<article class="favorite-list-item" data-favorite-index="${i}"><div><b>${escapeHtml(x.name||'즐겨찾기')}</b><small>${escapeHtml(x.address||'')}</small></div><div class="favorite-item-actions"><button type="button" data-favorite-go="${i}">길찾기</button><button type="button" data-favorite-delete="${i}" class="danger">삭제</button></div></article>`).join('')}</div>`;
  box.querySelectorAll('[data-favorite-go]').forEach(btn=>btn.onclick=()=>navigateFavorite(Number(btn.dataset.favoriteGo)));
  box.querySelectorAll('[data-favorite-delete]').forEach(btn=>btn.onclick=()=>removeFavoriteAt(Number(btn.dataset.favoriteDelete)));
}
function openFavoritesList(){openInfoModal('즐겨찾기','');renderFavoritesList()}
async function navigateFavorite(index){const p=state.favorites[index];if(!p)return;closeInfoModal();closeMy();await chooseDestination(p)}
async function removeFavoriteAt(index){
  const p=state.favorites[index];if(!p)return;const id=p.id||favoriteId(p);state.favorites.splice(index,1);saveLocalFavorites();updateSavedLabels();renderFavoritesList();
  try{await deleteFavoriteFromDb(id)}catch(e){console.warn('favorite DB delete failed',e)}await saveCloudFavorites();toast('즐겨찾기 장소가 해제되었습니다.');
}

function recentId(p){return favoriteId(p)}
async function dbRecentRequest(method,place=null){
  const u=new URL('/api/recents',location.origin);u.searchParams.set('owner',placeOwnerKey());
  if(method==='DELETE'&&place)u.searchParams.set('recentId',recentId(place));
  const opt={method,headers:{'content-type':'application/json'}};if(place&&method!=='DELETE')opt.body=JSON.stringify({owner:placeOwnerKey(),recentId:recentId(place),place});
  const r=await fetch(u,opt);const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`recents DB HTTP ${r.status}`);return d
}
async function saveRecentDestination(place){
  if(!pointValid(place))return;const id=recentId(place),item={...place,id,lastUsedAt:new Date().toISOString()};state.recentDestinations=[item,...state.recentDestinations.filter(x=>(x.id||recentId(x))!==id)].slice(0,20);saveLocalRecents();renderRecentDestinations();
  try{await dbRecentRequest('POST',item)}catch(e){console.warn('recent DB save failed',e)}
}
async function loadDbRecents(){
  try{const d=await dbRecentRequest('GET');if(Array.isArray(d.items)){state.recentDestinations=d.items.map(x=>({id:x.id,name:x.name,address:x.address||'',lng:Number(x.lng),lat:Number(x.lat),lastUsedAt:x.lastUsedAt||''})).filter(pointValid);saveLocalRecents();renderRecentDestinations();return {ok:true,count:state.recentDestinations.length}}}catch(e){console.warn('recent DB load failed',e)}return {ok:false,count:0}
}
function renderRecentDestinations(){
  const box=$('recentDestinationList');if(!box)return;
  const items=(state.recentDestinations||[]).slice(0,6);if(!items.length){box.innerHTML='<div class="recent-empty">최근 목적지가 없습니다.</div>';return}
  box.innerHTML=items.map((x,i)=>`<div class="recent-row main-recent-row"><button class="recent-item" data-recent-index="${i}"><span class="recent-dot ${i?'blue':''}"></span><span><b>${escapeHtml(x.name||'목적지')}</b><small>${escapeHtml(x.address||'')}</small></span><i data-icon="chevron"></i></button></div>`).join('');applyIcons(box);box.querySelectorAll('[data-recent-index]').forEach(b=>b.onclick=()=>chooseDestination(items[Number(b.dataset.recentIndex)]));
}
async function deleteRecentDestinationAt(index,items=state.recentDestinations){
  const p=items?.[index];if(!p)return;const id=p.id||recentId(p);state.recentDestinations=(state.recentDestinations||[]).filter(x=>(x.id||recentId(x))!==id);saveLocalRecents();renderRecentDestinations();
  try{await dbRecentRequest('DELETE',p)}catch(e){console.warn('recent DB delete failed',e);toast('기기에서는 삭제했습니다. 서버 삭제는 다시 시도해주세요.',2600);return}
  toast('최근 목적지를 삭제했습니다.');
}
async function clearRecentDestinations(){
  if(!(state.recentDestinations||[]).length)return;if(!confirm('최근 목적지를 모두 삭제할까요?'))return;state.recentDestinations=[];saveLocalRecents();renderRecentDestinations();
  try{await dbRecentRequest('DELETE')}catch(e){console.warn('recent DB clear failed',e);toast('기기에서는 전체 삭제했습니다. 서버 삭제는 다시 시도해주세요.',2600);return}
  openRecentDestinationAll();toast('최근 목적지를 모두 삭제했습니다.');
}
async function persistCurrentUserDataIfDbEmpty(placeResult,favResult,recentResult){
  if(placeResult?.ok&&placeResult.count===0){for(const kind of ['home','work'])if(pointValid(state.savedPlaces[kind]))await savePlaceToDb(kind,state.savedPlaces[kind]).catch(()=>{})}
  if(favResult?.ok&&favResult.count===0){for(const p of state.favorites.slice(0,50))await saveFavoriteToDb(p).catch(()=>{})}
  if(recentResult?.ok&&recentResult.count===0){for(const p of state.recentDestinations.slice(0,20))await dbRecentRequest('POST',p).catch(()=>{})}
}
async function hydrateAuthenticatedUser(){
  loadUserScopedLocal();
  loadSavedPlaceGroups();
  loadLocalUserSettings();
  await Promise.all([loadCloudPrefs(),loadCloudFavorites(),loadCloudSavedPlaceGroups(),loadUserSettings()]);
  const [places,favs,recents]=await Promise.all([loadDbSavedPlaces(),loadDbFavorites(),loadDbRecents()]);
  await persistCurrentUserDataIfDbEmpty(places,favs,recents);
  updateSavedLabels();renderRecentDestinations();updateFavoriteButtonState();
  if(!$('savedPlacesModal')?.classList.contains('hidden'))renderSavedGroups();
}

function syncCharacterUI(){
  document.querySelectorAll('[data-character]').forEach(b=>b.classList.toggle('active',b.dataset.character===state.character));
  document.querySelectorAll('[data-my-character]').forEach(b=>b.classList.toggle('active',b.dataset.myCharacter===state.character));
  document.querySelectorAll('[data-voice-character]').forEach(b=>b.classList.toggle('active',b.dataset.voiceCharacter===state.character));
  updateCarMarkerImage();
  if($('myCharacterLabel'))$('myCharacterLabel').textContent=characterDefs[state.character].name;
  if($('voiceCharacterLabel'))$('voiceCharacterLabel').textContent=characterDefs[state.character].voiceLabel;
  if(!state.firebase.user)renderProfile();
}
function setCharacter(key){if(!characterDefs[key])return;state.character=key;syncCharacterUI();saveLocalSettings();saveCloudPrefs();speak(`${characterDefs[key].name} 가이드로 변경했습니다.`)}
function updateVolumeUI(){const pct=Math.round(state.voiceVolume*100);$('guideVolume').value=pct;$('myGuideVolume').value=pct;$('volumeValue').textContent=`${pct}%`;$('myVolumeValue').textContent=`${pct}%`}
function changeVolume(v){setNavVolume(Number(v)/100,true);saveLocalSettings();saveCloudPrefs()}

/* ---------- FIRST-RUN PERMISSIONS ---------- */
async function permissionStatus(name){
  try{if(!navigator.permissions?.query)return 'prompt';return (await navigator.permissions.query({name})).state}catch{return 'prompt'}
}
function loadPermissionPrefs(){
  const p=readJson(PERMISSION_PREFS,{location:true,camera:true});
  state.permissionPrefs={location:p?.location!==false,camera:p?.camera!==false};
  updatePermissionSettingsUI();
}
function savePermissionPrefs(){try{localStorage.setItem(PERMISSION_PREFS,JSON.stringify(state.permissionPrefs))}catch{}}
function updatePermissionSettingsUI(){
  const lt=$('locationConsentToggle'),ct=$('cameraConsentToggle');
  if(lt)lt.checked=state.permissionPrefs.location!==false;if(ct)ct.checked=state.permissionPrefs.camera!==false;
  const ls=$('locationConsentState'),cs=$('cameraConsentState');
  if(ls)ls.textContent=state.permissionPrefs.location===false?'미동의 · 위치 기능 사용 안 함':(state.permissionLocationGranted?'동의 · 시스템 권한 허용':'동의 · 시스템 권한 확인 필요');
  if(cs)cs.textContent=state.permissionPrefs.camera===false?'미동의 · AR 카메라 사용 안 함':(state.permissionCameraGranted?'동의 · 시스템 권한 허용':'동의 · 시스템 권한 확인 필요');
}
async function refreshPermissionState(){
  let loc=false,cam=false;
  try{if(window.JofamsPermissionBridge?.isNativePermissionBridgeAvailable?.()){loc=Boolean(window.JofamsPermissionBridge.hasLocationPermission());cam=Boolean(window.JofamsPermissionBridge.hasCameraPermission())}else{const [l,c]=await Promise.all([permissionStatus('geolocation'),permissionStatus('camera')]);loc=l==='granted';cam=c==='granted'}}catch{}
  state.permissionLocationGranted=loc;state.permissionCameraGranted=cam;updatePermissionSettingsUI();return {loc,cam};
}
async function setPermissionPreference(kind,enabled){
  state.permissionPrefs[kind]=Boolean(enabled);savePermissionPrefs();updatePermissionSettingsUI();
  if(!enabled){if(kind==='location'){stopWatch();toast('위치정보 조회를 사용하지 않습니다.')}else{if(state.arRunning)stopAR();toast('카메라 조회를 사용하지 않습니다.')}return}
  try{if(window.JofamsPermissionBridge?.isNativePermissionBridgeAvailable?.()){if(kind==='location')window.JofamsPermissionBridge.requestLocationPermission();else window.JofamsPermissionBridge.requestCameraPermission();setTimeout(refreshPermissionState,900)}else{if(kind==='location')await requestLocationPermission();else await requestCameraPermission()}}catch(e){console.warn('permission preference request failed',e)}
}
function permissionButtonState(kind,granted){
  const btn=$(kind==='location'?'allowLocationBtn':'allowCameraBtn'),txt=$(kind==='location'?'locationPermissionState':'cameraPermissionState');
  if(!btn||!txt)return;btn.classList.toggle('granted',granted);txt.textContent=granted?(kind==='location'?'위치 권한이 허용되었습니다.':'카메라 권한이 허용되었습니다.'):(kind==='location'?'현재 위치를 길찾기에 사용합니다.':'AR 길안내에 사용합니다.');
}
async function requestLocationPermission(){
  const btn=$('allowLocationBtn');if(btn)btn.disabled=true;
  try{
    const ok=await locate(false);state.permissionLocationGranted=Boolean(ok);permissionButtonState('location',state.permissionLocationGranted);
  }finally{if(btn)btn.disabled=false}
}
async function requestCameraPermission(){
  const btn=$('allowCameraBtn');if(btn)btn.disabled=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('카메라 미지원');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    stream.getTracks().forEach(t=>t.stop());state.permissionCameraGranted=true;permissionButtonState('camera',true);
  }catch(e){state.permissionCameraGranted=false;permissionButtonState('camera',false);toast('카메라 권한을 허용해 주세요.',2500)}finally{if(btn)btn.disabled=false}
}
async function showPermissionGate(){
  await refreshPermissionState();
  $('permissionGate')?.classList.add('hidden');
}
function closePermissionGate(){$('permissionGate')?.classList.add('hidden')}

/* ---------- FIREBASE ---------- */
function firebaseConfig(){return CONFIG.firebase||{}}
function firebaseConfigured(){const c=firebaseConfig();return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId)}
async function initFirebase(){
  state.firebase.configured=firebaseConfigured();if(!state.firebase.configured)return;
  try{
    const [appMod,authMod,fsMod]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')]);
    const app=appMod.initializeApp(firebaseConfig()),auth=authMod.getAuth(app),db=fsMod.getFirestore(app);await authMod.setPersistence(auth,authMod.browserLocalPersistence);state.firebase={...state.firebase,ready:true,auth,db,mods:{authMod,fsMod}};
    installNativeGoogleAuthHandlers();
    authMod.onAuthStateChanged(auth,async user=>{state.firebase.user=user||null;state.adminVerified=false;state.adminVerifiedEmail='';state.savedPlaceGroups=[];state.savedPlaceGroupMap={};state.activeSavedGroup='all';resetLoginButton();renderProfile();if(user){state.loginPending=false;await verifyAdminAccess();await hydrateAuthenticatedUser()}else{loadLocal();loadLocalUserSettings();await Promise.all([loadDbSavedPlaces(),loadDbFavorites(),loadDbRecents(),loadUserSettings()]);updateFavoriteButtonState()}})
  }catch(e){console.warn('Firebase init failed',e);resetLoginButton()}
}
function resetLoginButton(){const btn=$('googleLoginBtn');if(!btn)return;btn.disabled=false;btn.textContent='Google 로그인'}
function setLoginPending(){state.loginPending=true;state.loginStartedAt=Date.now();const btn=$('googleLoginBtn');if(btn){btn.disabled=true;btn.textContent='로그인 중'}}
function nativeAuthAvailable(){try{return Boolean(window.JofamsAuthBridge&&typeof window.JofamsAuthBridge.signInGoogle==='function')}catch{return false}}
function installNativeGoogleAuthHandlers(){
  if(window.__JOFAMS_NATIVE_AUTH_HANDLERS__)return;window.__JOFAMS_NATIVE_AUTH_HANDLERS__=true;
  window.addEventListener('jofams-native-google-token',async e=>{
    try{
      if(!state.firebase.ready)throw new Error('Firebase가 준비되지 않았습니다.');
      const idToken=e?.detail?.idToken;if(!idToken)throw new Error('Google ID Token이 없습니다.');
      const {authMod}=state.firebase.mods,credential=authMod.GoogleAuthProvider.credential(idToken);
      const result=await authMod.signInWithCredential(state.firebase.auth,credential);state.firebase.user=result.user;state.loginPending=false;renderProfile();await verifyAdminAccess();await hydrateAuthenticatedUser();toast('로그인되었습니다.');
    }catch(err){console.warn('native google credential failed',err);toast('Google 로그인 처리에 실패했습니다.',3000)}finally{resetLoginButton()}
  });
  window.addEventListener('jofams-native-google-error',e=>{state.loginPending=false;resetLoginButton();toast(e?.detail?.message||'Google 로그인에 실패했습니다.',3500)});
  window.addEventListener('jofams-app-resumed',()=>{if(state.loginPending&&Date.now()-state.loginStartedAt>1500)setTimeout(()=>{if(!state.firebase.user&&state.loginPending){state.loginPending=false;resetLoginButton();toast('로그인이 완료되지 않았습니다. 다시 시도해 주세요.',2600)}},1800)});
  window.addEventListener('pageshow',()=>{if(!state.loginPending)resetLoginButton()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!state.loginPending)resetLoginButton()});
}
async function loginGoogle(){
  if(!state.firebase.ready){toast('Firebase 설정을 확인해 주세요.');return}
  setLoginPending();
  try{
    if(nativeAuthAvailable()){window.JofamsAuthBridge.signInGoogle();return}
    const {authMod}=state.firebase.mods,provider=new authMod.GoogleAuthProvider();
    const result=await Promise.race([authMod.signInWithPopup(state.firebase.auth,provider),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),12000))]);
    state.firebase.user=result.user;state.loginPending=false;renderProfile();await verifyAdminAccess();await hydrateAuthenticatedUser();toast('로그인되었습니다.');
  }catch(e){state.loginPending=false;if(e.code==='auth/popup-blocked'||e.message==='timeout')toast('로그인 창을 다시 열어 주세요.');else toast('Google 로그인에 실패했습니다.');resetLoginButton()}
}
async function logout(){
  if(!state.firebase.ready){state.firebase.user=null;renderProfile();return}
  try{await state.firebase.mods.authMod.signOut(state.firebase.auth)}catch(e){console.warn('Firebase logout failed',e)}
  state.firebase.user=null;state.adminVerified=false;state.adminVerifiedEmail='';state.savedPlaceGroups=[];state.savedPlaceGroupMap={};state.activeSavedGroup='all';loadSavedPlaceGroups();state.loginPending=false;resetLoginButton();renderProfile();
}
function renderProfile(){
  const u=state.firebase.user,wrap=$('profilePhoto')?.closest('.profile-photo');
  const loginBtn=$('googleLoginBtn'),logoutBtn=$('logoutBtn'),name=$('profileName'),email=$('profileEmail'),photo=$('profilePhoto');
  if(loginBtn)loginBtn.classList.toggle('hidden',!!u);
  if(logoutBtn)logoutBtn.classList.toggle('hidden',!u);
  if(u){
    if(name)name.textContent=u.displayName||'사용자';
    if(email)email.textContent=u.email||'';
    if(photo)photo.src=u.photoURL||characterDefs[state.character].avatar;
    wrap?.classList.toggle('google-photo',Boolean(u.photoURL));
  }else{
    if(name)name.textContent='단골로 드라이버';
    if(email)email.textContent='Google 로그인으로 동기화할 수 있어요.';
    if(photo)photo.src=characterDefs[state.character].avatar;
    wrap?.classList.remove('google-photo');
  }
  updateAdminUI();
}

async function saveCloudPrefs(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods;await fsMod.setDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'),{character:state.character,voiceVolume:state.voiceVolume,home:state.savedPlaces.home,work:state.savedPlaces.work,updatedAt:fsMod.serverTimestamp()},{merge:true})}catch{}}
async function loadCloudPrefs(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods,s=await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'));if(s.exists()){const p=s.data();if(p.character&&characterDefs[p.character])state.character=p.character;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Number(p.voiceVolume);state.savedPlaces.home=p.home||state.savedPlaces.home;state.savedPlaces.work=p.work||state.savedPlaces.work;syncCharacterUI();updateVolumeUI();updateSavedLabels();saveLocalSettings()}}catch{}}
async function saveCloudFavorites(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods,ref=fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','favorites');await fsMod.setDoc(ref,{items:state.favorites,updatedAt:fsMod.serverTimestamp()},{merge:true})}catch{}}
async function loadCloudFavorites(){if(!state.firebase.user)return;try{const {fsMod}=state.firebase.mods,s=await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','favorites'));if(s.exists()&&Array.isArray(s.data().items)){state.favorites=s.data().items;saveLocalFavorites();updateSavedLabels();updateFavoriteButtonState()}}catch{}}


let postDriveFavoritePlace=null;
function openPostDriveFavoritePrompt(place){postDriveFavoritePlace=place;const modal=$('postDriveFavoriteModal');if(!modal)return;$('postDriveFavoriteName').textContent=place.name||'목적지';modal.classList.remove('hidden')}
function closePostDriveFavoritePrompt(){postDriveFavoritePlace=null;$('postDriveFavoriteModal')?.classList.add('hidden')}
async function confirmPostDriveFavorite(){const place=postDriveFavoritePlace;if(!place)return closePostDriveFavoritePrompt();await addFavoritePlace(place,{message:true});closePostDriveFavoritePrompt()}

/* ---------- UI EVENTS ---------- */

function normalizeVoiceDestination(text){
  return String(text||'').trim()
    .replace(/^(목적지|목적지를)\s*/,'')
    .replace(/(으로|로)?\s*(가줘|가자|안내해줘|안내해|길안내해줘|길 안내해줘|변경해줘|변경해)$/,'')
    .trim();
}
/* 단골로 음성 경유 추천: 실제 상품권 가맹점 데이터만 사용, 사용자 경유지 확인 후 안내 시작. */
function voiceMealIntent(raw){
  const q=String(raw||'').replace(/\s+/g,' ');
  const hour=new Date().getHours();
  const period=/아침|모닝|브런치/.test(q)?'morning':/점심|런치/.test(q)?'lunch':/저녁|디너|퇴근/.test(q)?'dinner':hour<11?'morning':hour<16?'lunch':'dinner';
  const kind=/디저트|케이크|빵|베이커리/.test(q)?'dessert':/커피|카페|모닝커피/.test(q)?'cafe':/맛집|식사|밥|음식|식당|점심|저녁/.test(q)?'meal':period==='morning'?'cafe':'meal';
  return{period,kind,label:kind==='dessert'?'디저트 카페':kind==='cafe'?'커피·카페':period==='morning'?'아침 식사':period==='lunch'?'점심 맛집':'저녁 맛집'};
}
function voiceRecommendationRequested(text){return /추천|들러|들르|경유|맛집|카페|커피|디저트|식사|모닝|점심|저녁/.test(text)&&/안내|길|추천|들러|들르|경유|맛집|카페|커피|디저트|식사/.test(text)}
function voiceQueryDestination(text){
  let m=text.match(/(.+?)(?:까지|으로|로)\s*(?:가는\s*길|가면서|갈\s*때|가기\s*전)/);
  if(!m)m=text.match(/(.+?)\s*가는\s*길/);
  return m?m[1].replace(/^(?:나|내 위치|현재 위치|여기서)\s*/,'').trim():'';
}
function classifyVoiceMerchant(item){
  const t=[item?.name,item?.market,item?.category,item?.categoryName,item?.businessType,item?.industry,item?.type,item?.address].filter(Boolean).join(' ').toLowerCase();
  if(/카페|커피|coffee|cafe|커피숍|다방|스타벅스|투썸|이디야|빽다방|메가커피|컴포즈/.test(t))return'cafe';
  if(/디저트|베이커리|제과|제빵|빵집|케이크|도넛|파리바게|뚜레쥬르|아이스크림/.test(t))return'dessert';
  if(/음식|식당|한식|중식|일식|양식|분식|레스토랑|국밥|김밥|백반|식사|고기|칼국수|국수|찌개|순대|치킨|피자|돈까스|맛집/.test(t))return'meal';
  return'unknown';
}
function voiceRecommendedRows(intent){
  const line=state.route?.geometry||planningCorridorLine();if(!line||line.length<2)return[];
  const total=Number(state.routeCumulative?.at(-1))||planningLineLength(line);
  const pa=state.planningAi||{};const rows=[],seen=new Set();
  for(const [kind,data] of [['local',[...(pa.local||[]),...(state.localVoucherData?.items||[])]],['onnuri',[...(pa.onnuri||[]),...(state.onnuriData?.items||[])]]]){
    for(const item of data){
      const lat=Number(item?.lat),lng=Number(item?.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      const category=classifyVoiceMerchant(item);
      if(category==='unknown')continue; // 업종을 알 수 없으면 맛집으로 단정하지 않음
      const match=intent.kind===category?3:(intent.kind==='dessert'&&category==='cafe'||intent.kind==='cafe'&&category==='dessert'?1.7:0);
      if(!match)continue;
      const hit=routePosOfPoint(lng,lat,line,null,1200);if(!hit||Number(hit.distance)>850)continue;
      const ahead=Number(hit.routeDistance);if(!(ahead>120&&ahead<total-100))continue;
      const key=[lat.toFixed(4),lng.toFixed(4),item?.name].join(':');if(seen.has(key))continue;seen.add(key);
      const score=match*100-Math.min(80,Number(hit.distance)/15)-Math.abs(ahead/total-.5)*25;
      rows.push({...item,kind,category,offset:Number(hit.distance),ahead,score});
    }
  }
  return rows.sort((x,y)=>y.score-x.score||x.offset-y.offset).slice(0,6);
}
function closeVoiceRecommend(){document.getElementById('voiceRecommendSheet')?.remove();state.voiceRecommendationPending=false;}
function showVoiceRecommendations(intent,rows){
  document.getElementById('voiceRecommendSheet')?.remove();
  const root=document.createElement('section');root.id='voiceRecommendSheet';root.className='dangollo-voice-recommend';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','음성 경유지 추천');
  const heading=`<div class="dvr-head"><span class="dvr-icon" aria-hidden="true">✦</span><div><b>${escapeHtml(intent.label)} 추천</b><small>경로상 실제 지역사랑·온누리 가맹점 · 들를 곳을 선택하세요</small></div><button type="button" data-vr-close aria-label="닫기">×</button></div>`;
  const items=rows.map((r,i)=>`<button type="button" class="dvr-row" data-vr-choice="${i}"><span class="dvr-tag ${r.kind}">${r.kind==='local'?'지역사랑':'온누리'}</span><span><b>${escapeHtml(r.name||r.market||'가맹점')}</b><small>${escapeHtml(r.address||r.matchedAddress||'주소 미제공')} · 경로에서 약 ${Math.round(r.offset)}m</small></span><span class="dvr-arrow">›</span></button>`).join('');
  root.innerHTML=`<div class="dvr-backdrop" data-vr-close></div><div class="dvr-sheet">${heading}<div class="dvr-body">${items||'<div class="dvr-empty">요청하신 업종과 일치하는 가맹점이 현재 조회되지 않습니다.<br>다른 업종을 말씀하시거나 경유 없이 시작해 주세요.</div>'}</div><button type="button" class="dvr-direct" data-vr-direct>경유 없이 길안내 시작</button><small class="dvr-foot">영업시간·실제 결제 가능 여부 및 진입 경로는 방문 전 확인이 필요합니다.</small></div>`;
  document.body.appendChild(root);
  root.querySelectorAll('[data-vr-close]').forEach(x=>x.onclick=()=>{closeVoiceRecommend();cancelAutoStart()});
  root.querySelector('[data-vr-direct]').onclick=()=>{closeVoiceRecommend();if(state.tripStartedAt){toast('기존 길안내를 유지합니다.');return}if(state.route?.geometry?.length)startNavigation();else toast('경로를 먼저 선택해 주세요.')};
  root.querySelectorAll('[data-vr-choice]').forEach(b=>b.onclick=async()=>{
    const item=rows[Number(b.dataset.vrChoice)];if(!item)return;
    const pt=normalizedPlace({name:item.name||item.market||'가맹점',address:item.address||item.matchedAddress||'',lat:item.lat,lng:item.lng});
    if(!pointValid(pt))return toast('해당 가맹점 위치를 확인할 수 없습니다.');
    closeVoiceRecommend();cancelAutoStart();
    state.waypoints=[...(state.waypoints||[]),pt].slice(0,5);renderRouteWaypoints();
    toast(`${pt.name} 경유 경로를 계산합니다.`,1800);
    if(state.tripStartedAt){
      try{const spec=routePreferenceSpec(),nr=await routeRequest(spec.priority,spec.avoid);state.route={...nr,_label:`가맹점 경유 · ${spec.label}`,_character:state.character};state.routeOptions=[state.route];state.routeCumulative=buildCumulative(state.route);invalidateDrivePoiRoute();drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);updateDriving(true);toast('가맹점 경유 경로로 변경했습니다.')}catch(e){toast('경유 경로 조회에 실패했습니다.');}
    }else{
      await loadRouteOptions();cancelAutoStart();if(state.route?.geometry?.length)startNavigation();
    }
  });
}
async function runVoiceMerchantRecommendation(text){
  if(state.voiceRecommendationPending)return toast('추천 장소를 선택해 주세요.');
  state.voiceRecommendationPending=true;cancelAutoStart();closeDriveMenu();
  try{
    const query=voiceQueryDestination(text);
    if(query&&state.tripStartedAt){
      throw new Error('운행 중 목적지를 변경하려면 먼저 목적지를 음성으로 지정한 뒤, 가맹점 추천을 요청해 주세요.');
    }
    if(query&&!state.tripStartedAt){
      const url=new URL('/api/search',location.origin);url.searchParams.set('q',query);if(state.user){url.searchParams.set('lat',state.user.lat);url.searchParams.set('lng',state.user.lng)}
      const r=await fetch(url);if(!r.ok)throw new Error('장소 검색 실패');const d=await r.json();const item=(d.items||[])[0];if(!item)throw new Error('말씀하신 목적지를 찾지 못했습니다.');
      await chooseDestination(item,{autoGuide:false});cancelAutoStart();
    }
    if(!state.destination||!state.route?.geometry?.length){throw new Error('먼저 목적지를 설정한 뒤 음성 추천을 요청해 주세요.')}
    toast('가는 길의 상품권 가맹점을 분석하고 있습니다…',2100);
    if(!state.tripStartedAt){
      startPlanningAi();const start=Date.now();
      while(state.planningAi?.loading&&Date.now()-start<5500)await new Promise(r=>setTimeout(r,180));
    }else{
      await Promise.allSettled([fetchDrivePoiBatch('local',drivePoiProbePoints(),state.drivePoiFetchToken),fetchDrivePoiBatch('onnuri',drivePoiProbePoints(),state.drivePoiFetchToken)]).then(([l,o])=>{
        state.planningAi={local:l.status==='fulfilled'?(l.value||[]):[],onnuri:o.status==='fulfilled'?(o.value||[]):[]};
      });
    }
    cancelAutoStart();showVoiceRecommendations(voiceMealIntent(text),voiceRecommendedRows(voiceMealIntent(text)));
  }catch(e){state.voiceRecommendationPending=false;cancelAutoStart();toast(e.message||'음성 추천을 준비하지 못했습니다.',3500)}
}
/* Workers AI optional assistance: voice intent extraction and grounded route comparison.
   Never delegate route calculations, camera guidance or route switching to a model. */
function selectedAiModel(){const value=$('routeAiModel')?.value||$('driveAiModel')?.value;return ['llama','gemma'].includes(value)?value:'llama'}
// v7.6.27.31: Keep both models usable under variable Cloudflare inference latency.
// Selected model is tried first; when it fails, try the other model once and report which responded.
async function callWorkerAiAssist(task,payload,timeoutMs=9000){
  const requested=selectedAiModel(),models=[requested,requested==='llama'?'gemma':'llama'];
  let failure;
  for(let i=0;i<models.length;i++){
    const controller=new AbortController();
    const budget=i===0?Math.max(timeoutMs,task==='trip_plan'?12500:14000):9500;
    const timer=setTimeout(()=>controller.abort(),budget);
    try{
      const res=await fetch('/api/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task,model:models[i],...payload}),signal:controller.signal});
      const body=await res.json();
      if(!res.ok||!body?.ok)throw Error(body?.message||'AI 처리 실패');
      if(i>0){body.fallbackFrom=requested;console.info('[AI] fallback model',requested,'=>',models[i])}
      return body;
    }catch(e){failure=e;console.warn('[AI] model request failed',models[i],e?.name||e?.message)}
    finally{clearTimeout(timer)}
  }
  throw failure||new Error('AI 연결 실패');
}
function routeCompareRows(){
  return(state.carRouteOptions||[]).filter(r=>r?.geometry?.length).map(r=>({
    kind:r._class==='fast'?'fast':r._class==='free'?'free':'recommend',
    label:r._label||'경로',durationMinutes:Math.round((Number(r.duration)||0)/60),
    distanceKm:Math.round((Number(r.distance)||0)/100)/10,
    tollWon:Math.max(0,Math.round(Number(r.fare?.toll)||0))
  }));
}
let routeAiComparePending=false;
async function explainRoutesWithAi(){
  const output=$('routeAiCompareResult'),button=$('routeAiCompareBtn');if(!output||!button||routeAiComparePending)return;
  const rows=routeCompareRows();output.hidden=false;
  if(rows.length<2){output.textContent='비교할 경로가 2개 이상 준비되면 사용할 수 있습니다.';return}
  routeAiComparePending=true;button.disabled=true;output.textContent='AI가 표시된 경로 정보를 비교하고 있습니다…';
  try{
    const r=await callWorkerAiAssist('route_compare',{destination:String(state.destination?.name||'').slice(0,80),routes:rows},14000);
    const facts=rows.map(x=>`${x.label}: ${x.durationMinutes}분 · ${x.distanceKm}km · 통행료 ${x.tollWon.toLocaleString()}원`).join(' / ');
    output.textContent=`[경로 API 기준] ${facts}\n\n[AI 설명 · 참고용] ${String(r.answer||'설명 없음').slice(0,600)}\n※ 실제 소요시간과 요금은 달라질 수 있습니다.`;
  }
  catch(e){const shortest=[...rows].sort((a,b)=>a.durationMinutes-b.durationMinutes)[0];const free=[...rows].sort((a,b)=>a.tollWon-b.tollWon||a.durationMinutes-b.durationMinutes)[0];output.textContent=`AI 연결 없이 비교한 결과: 빠른 경로는 ${shortest.label} (${shortest.durationMinutes}분), 통행료가 적은 경로는 ${free.label} (${free.tollWon.toLocaleString()}원)입니다. 화면의 경로를 직접 선택해 주세요.`}
  finally{routeAiComparePending=false;button.disabled=false}
}
function initRouteAiCompare(){
  const button=$('routeAiCompareBtn'),select=$('routeAiModel');if(!button||!select)return;
  const drive=$('driveAiModel');select.value=selectedAiModel();
  select.addEventListener('change',()=>{if(drive)drive.value=select.value;try{localStorage.setItem('dangollo.workerAiModel',select.value)}catch{}});
  if(drive)drive.addEventListener('change',()=>{select.value=drive.value});
  try{const saved=localStorage.getItem('dangollo.workerAiModel');if(['llama','gemma'].includes(saved))select.value=saved}catch{}
  button.addEventListener('click',explainRoutesWithAi);
}
async function parseVoiceIntentWithAi(text){
  try{return(await callWorkerAiAssist('voice_parse',{text:text.slice(0,240)},12500)).intent||null}catch{return null}
}
function confirmDestinationChange(name){
  // Non-blocking in-app confirmation. No automatic route switch while driving.
  return new Promise(resolve=>{
    const backdrop=document.createElement('div');backdrop.className='dangollo-ai-confirm-overlay';
    backdrop.setAttribute('role','presentation');
    const card=document.createElement('section');card.className='dangollo-ai-confirm-card';
    card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','목적지 변경 확인');
    const title=document.createElement('strong');title.textContent='목적지를 변경할까요?';
    const detail=document.createElement('p');detail.textContent='새 목적지: '+String(name).slice(0,80)+' — 안전한 곳에서 확인해 주세요.';
    const buttons=document.createElement('div');buttons.className='dangollo-ai-confirm-actions';
    const cancel=document.createElement('button');cancel.textContent='취소';
    const accept=document.createElement('button');accept.textContent='변경 확인';
    const finish=ok=>{document.removeEventListener('keydown',onKey);backdrop.remove();resolve(ok)};
    const onKey=e=>{if(e.key==='Escape')finish(false)};
    cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);
    backdrop.onclick=e=>{if(e.target===backdrop)finish(false)};
    buttons.append(cancel,accept);card.append(title,detail,buttons);backdrop.append(card);document.body.append(backdrop);
    document.addEventListener('keydown',onKey);cancel.focus();
  });
}

/* v7.6.27.20: Single-field AI route & merchant planning; Opinet is untouched. */
let aiTripBusy=false,homeAiVoicePending=false,aiQuickStartTimer=null;
const AI_LAST_CONDITION_KEY='dangollo.ai.lastConditions.v1',AI_LAST_COMMAND_KEY='dangollo.ai.lastCommand.v1',AI_QUICK_START_KEY='dangollo.ai.quickStart.v1';
const aiTripEl=id=>document.getElementById(id);
const aiTripBtn=(text,fn,primary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=primary?'ai-trip-primary':'ai-trip-secondary';b.onclick=fn;return b};
const aiTripSafeText=x=>String(x||'').slice(0,100);
function aiTripDialog(title,description){
  aiTripEl('aiTripOverlay')?.remove();
  const root=document.createElement('div');root.id='aiTripOverlay';root.className='ai-trip-overlay';
  const card=document.createElement('section');card.className='ai-trip-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','AI 경로상 혜택 검색');
  const heading=document.createElement('h3');heading.textContent=title;
  const desc=document.createElement('p');desc.textContent=description;
  const body=document.createElement('div');body.className='ai-trip-body';const foot=document.createElement('div');foot.className='ai-trip-actions';
  const close=()=>{aiTripCancelQuick();root.remove()};const exit=aiTripBtn('닫기',close);foot.append(exit);card.append(heading,desc,body,foot);root.append(card);
  root.onclick=e=>{if(e.target===root)close()};document.body.append(root);
  return{root,card,heading,desc,body,foot,close};
}
function aiTripRules(text){
  const q=String(text||'');const m=q.match(/(\d{1,2})\s*분(?:\s*(?:이내|미만|이상))?\s*우회|우회.{0,8}?(\d{1,2})\s*분|(\d{1,2})\s*분\s*이내/);
  const category=/주유소/.test(q)?'gas_station':/카페|커피/.test(q)?'cafe':/디저트|케이크|빵집/.test(q)?'dessert':/식당|식사|밥|맛집|음식/.test(q)?'meal':'any';
  return{intent:'plan_stops',category,payment:/온누리/.test(q)?'onnuri':/지역사랑|지역화폐/.test(q)?'local':'any',max_detour_min:Math.max(1,Math.min(15,Number(m?.[1]||m?.[2]||m?.[3]||5))),destination:voiceQueryDestination(q)||'',confidence:.5};
}
async function aiTripParse(text){try{const r=await callWorkerAiAssist('trip_plan',{text:String(text).slice(0,280)},12500);if(r?.plan?.intent==='plan_stops'&&r.plan.confidence>=.5)return r.plan}catch(e){console.warn('AI trip_plan fallback',e?.message||e)}return aiTripRules(text)}
function aiTripIsQuery(q){return /온누리|지역사랑|지역화폐|우회|가는\s*길에|경유|들렀다|들러|상품권/.test(String(q||''))}
function aiTripConditionText(plan){return `${plan.payment==='onnuri'?'온누리':plan.payment==='local'?'지역사랑':'상품권'} · ${plan.category==='meal'?'식당':plan.category==='cafe'?'카페':plan.category==='dessert'?'디저트':plan.category==='gas_station'?'주유소':'전체 업종'} · 우회 최대 ${plan.max_detour_min}분`}
function aiTripSaveCondition(plan){try{localStorage.setItem(AI_LAST_CONDITION_KEY,JSON.stringify({payment:plan.payment,category:plan.category,max_detour_min:plan.max_detour_min}));aiTripRefreshRecent()}catch{}}
function aiTripRememberCommand(text){
  const command=String(text||'').trim().slice(0,280);
  if(!command)return;
  try{localStorage.setItem(AI_LAST_COMMAND_KEY,command);aiTripRefreshRecent()}catch(e){console.warn('AI recent command save failed',e)}
}
function aiTripRefreshRecent(){
  const b=$('homeAiRecentBtn');if(!b)return;
  let command='';try{command=String(localStorage.getItem(AI_LAST_COMMAND_KEY)||'').trim()}catch{}
  b.hidden=!command;
  b.textContent=command?`최근 지시 · ${command}`:'';
  b.title=command;
}
function aiTripClearHomeQuery(submitted){
  const input=$('destinationInput');
  // Never erase a new command typed while an older asynchronous request finishes.
  if(input&&input.value.trim()===String(submitted||'').trim())input.value='';
}
function aiTripQuickEnabled(){try{return localStorage.getItem(AI_QUICK_START_KEY)!=='off'}catch{return true}}
function aiTripCancelQuick(){if(aiQuickStartTimer){clearInterval(aiQuickStartTimer);aiQuickStartTimer=null}}
function aiTripQuickCountdown(ui){
  aiTripCancelQuick();if(!aiTripQuickEnabled()){ui.desc.textContent='경유 경로가 준비됐습니다. 안내 시작 버튼을 눌러 주세요.';return}
  let left=5;ui.desc.textContent=`${left}초 후 안내 시작`;const cancel=aiTripBtn('자동 시작 취소',()=>{aiTripCancelQuick();ui.desc.textContent='자동 시작을 취소했습니다. 경로를 확인한 뒤 안내 시작을 눌러 주세요.'});ui.foot.prepend(cancel);
  aiQuickStartTimer=setInterval(()=>{if(!ui.root.isConnected||state.tripStartedAt){aiTripCancelQuick();return}left--;ui.desc.textContent=`${left}초 후 안내 시작`;if(left<=0){aiTripCancelQuick();ui.close();Promise.resolve(startNavigation()).catch(e=>console.warn('AI start navigation failed',e))}},1000);
}
function aiTripCategoryMatch(item,category){if(category==='any')return true;if(category==='gas_station')return Number(item?.price)>0;return (['academy','pharmacy','hospital','laundry'].includes(category)?discoverMerchantCategory(item):classifyVoiceMerchant(item))===(category==='restaurant'?'meal':category)}
function aiTripMerchantPool(plan){
  const pa=state.planningAi||{},local=mergeDrivePoiMerchantRows([...(pa.local||[]),...(state.localVoucherData?.items||[])]),onnuri=mergeDrivePoiMerchantRows([...(pa.onnuri||[]),...(state.onnuriData?.items||[])]);
  const groups=plan.payment==='onnuri'?[['onnuri',onnuri]]:plan.payment==='local'?[['local',local]]:[['onnuri',onnuri],['local',local]];
  const line=state.route?.geometry||[];if(line.length<2)return[];const found=new Set(),rows=[];
  for(const [payment,items] of groups)for(const item of items){const lat=Number(item.lat),lng=Number(item.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||!aiTripCategoryMatch(item,plan.category))continue;const key=payment+':'+lat.toFixed(5)+':'+lng.toFixed(5);if(found.has(key))continue;const hit=routePosOfPoint(lng,lat,line,null,1200);if(!hit||Number(hit.distance)>900)continue;found.add(key);rows.push({...item,payment,offset:Number(hit.distance),ahead:Number(hit.routeDistance)})}
  return rows.sort((x,y)=>x.offset-y.offset).slice(0,12);
}
async function aiTripEnsureRoute(){if(state.route?.geometry?.length&&state.destination)return true;if(!pointValid(state.destination))return false;if(!state.user)await locate(false);if(!state.user)return false;await loadRouteOptions();return Boolean(state.route?.geometry?.length)}
async function aiTripVerifyCandidates(plan,progress=()=>{}){
  progress('경로와 출발 위치를 확인하고 있습니다…');
  if(!await aiTripEnsureRoute())throw Error('현재 위치와 목적지 경로를 확인할 수 없습니다.');
  if(plan.category==='gas_station')throw Error('상품권 주유소 결제 여부를 검증할 데이터가 없어 확정할 수 없습니다.');
  const payment=plan.payment==='onnuri'?'onnuri':plan.payment==='local'?'local':'both';
  // Reuse already fetched merchant data when possible; never trigger the unrelated Opinet API.
  let current=aiTripMerchantPool(plan);
  if(!current.length&&!state.tripStartedAt){
    progress('경로 주변 가맹점을 조회하고 있습니다…');
    const pts=planningProbes(state.route.geometry).slice(0,3);
    const request=async(path)=>{
      const pages=await Promise.all(pts.map(pt=>planningFetchJson(path,{lat:pt.lat,lng:pt.lng,...drivePoiRegionBox(pt,2.0)},4500)
        .then(j=>Array.isArray(j.items)?j.items:[]).catch(()=>[])));
      return mergeDrivePoiMerchantRows(pages.flat());
    };
    if(payment==='onnuri'){
      state.planningAi={...(state.planningAi||{}),onnuri:await request('/api/onnuri-voucher')};
    }else if(payment==='local'){
      state.planningAi={...(state.planningAi||{}),local:await request('/api/local-voucher')};
    }else{
      const [onnuri,local]=await Promise.all([request('/api/onnuri-voucher'),request('/api/local-voucher')]);
      state.planningAi={...(state.planningAi||{}),onnuri,local};
    }
    current=aiTripMerchantPool(plan);
  }
  const base=Number(state.route?.duration);if(!(base>0))throw Error('기본 경로 소요시간이 없습니다.');
  const candidates=current.slice(0,6),spec=routePreferenceSpec();
  if(!candidates.length)return[];
  progress(`${candidates.length}개 후보의 실제 우회시간을 동시에 비교하고 있습니다…`);
  // Two small concurrent batches: avoid six serial 6-second waits without flooding route provider.
  const check=async(item)=>{
    const pt=normalizedPlace({name:item.name||item.market||'가맹점',address:item.address||'',lat:item.lat,lng:item.lng});
    if(!pointValid(pt))return null;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4800);
    try{
      const rr=await routeRequest(spec.priority,spec.avoid,[...(state.waypoints||[]),pt],state.routeMode,null,controller.signal);
      if(!rr?.geometry?.length)return null;
      const extra=(Number(rr.duration)-base)/60;
      return Number.isFinite(extra)&&extra<=plan.max_detour_min&&extra>=-3?{item,pt,route:rr,extra:Math.max(0,extra)}:null;
    }catch(e){console.warn('AI trip candidate validation unavailable',String(e?.message||e));return null}
    finally{clearTimeout(timer)}
  };
  const verified=[];
  for(let i=0;i<candidates.length;i+=3){
    const batch=await Promise.all(candidates.slice(i,i+3).map(check));
    verified.push(...batch.filter(Boolean));
    if(verified.length>=3)break;
  }
  return verified.sort((a,b)=>a.extra-b.extra||a.item.offset-b.item.offset).slice(0,3);
}
async function aiTripSearchPlaces(q){const u=new URL('/api/search',location.origin);u.searchParams.set('q',q);if(pointValid(state.user)){u.searchParams.set('lat',state.user.lat);u.searchParams.set('lng',state.user.lng)}const r=await fetch(u);if(!r.ok)throw Error('SEARCH');const d=await r.json();return(Array.isArray(d.items)?d.items:[]).filter(pointValid).slice(0,6)}
function aiTripDestinationExact(items,q){const n=x=>String(x||'').replace(/\s/g,'').toLowerCase();const exact=items.filter(x=>n(x.name)===n(q));return exact.length===1?exact[0]:items.length===1?items[0]:null}
async function aiTripResolveDestination(ui,plan,query){
  ui.heading.textContent='목적지 확인';ui.desc.textContent='목적지를 확인한 뒤 같은 화면에서 가맹점 후보를 보여드립니다.';ui.body.textContent='';
  const target=document.createElement('div');target.className='ai-trip-dest';ui.body.append(target);
  const chosen=pointValid(state.destination)?state.destination:null;
  const drawChosen=place=>{target.textContent='';const line=document.createElement('div');line.textContent=`목적지: ${place.name||'선택된 장소'}`;const change=aiTripBtn('변경',()=>showSearch(query||place.name||''));target.append(line,change)};
  const showSearch=async q=>{target.textContent='';const input=document.createElement('input');input.placeholder='목적지는 어디인가요?';input.value=q||'';const list=document.createElement('div');list.className='ai-trip-dest-chips';const btn=aiTripBtn('검색',()=>lookup(input.value.trim()),true);target.append(input,btn,list);input.onkeydown=e=>{if(e.key==='Enter')lookup(input.value.trim())};
    async function lookup(term){if(!term)return;list.textContent='검색 중…';try{const found=await aiTripSearchPlaces(term);list.textContent='';if(!found.length){list.textContent='검색 결과가 없습니다.';return}const auto=aiTripDestinationExact(found,term);if(auto){await apply(auto);return}for(const item of found.slice(0,3))list.append(aiTripBtn(item.name||'장소',()=>apply(item)));}catch{list.textContent='검색에 실패했습니다. 다시 시도해 주세요.'}}
    if(q)await lookup(q);else input.focus();};
  const apply=async item=>{if(!pointValid(item))return;aiTripCancelQuick();ui.desc.textContent='목적지 경로를 계산하는 중입니다…';await chooseDestination(item,{autoGuide:false});cancelAutoStart();drawChosen(state.destination);await aiTripShowCandidates(plan,ui)};
  if(chosen&&(!query||String(chosen.name||'').replace(/\s/g,'').toLowerCase()===String(query).replace(/\s/g,'').toLowerCase())){drawChosen(chosen);await aiTripShowCandidates(plan,ui);return}
  await showSearch(query||'');
}
async function aiTripShowCandidates(plan,ui){
  if(!ui.root.isConnected)return;ui.heading.textContent='경로상 혜택 추천';ui.desc.textContent='실제 가맹점과 우회시간을 확인하고 있습니다.';
  const destination=ui.body.querySelector('.ai-trip-dest');ui.body.textContent='';if(destination)ui.body.append(destination);
  const data=document.createElement('div');data.className='ai-trip-candidates';data.textContent=aiTripConditionText(plan);ui.body.append(data);
  const toggle=document.createElement('label');toggle.className='ai-trip-toggle';const check=document.createElement('input');check.type='checkbox';check.checked=aiTripQuickEnabled();check.onchange=()=>{try{localStorage.setItem(AI_QUICK_START_KEY,check.checked?'on':'off')}catch{}};toggle.append(check,document.createTextNode(' 후보 선택 후 5초 자동 안내 시작'));data.append(toggle);
  try{const items=await aiTripVerifyCandidates(plan,message=>{if(ui.root.isConnected)ui.desc.textContent=message});if(!ui.root.isConnected)return;data.querySelectorAll('.ai-trip-choice,.ai-trip-empty').forEach(n=>n.remove());ui.desc.textContent='경유할 가맹점을 선택하세요. 선택 전에는 경로를 변경하지 않습니다.';
    if(!items.length){const empty=document.createElement('p');empty.className='ai-trip-empty';empty.textContent='실제 데이터와 경로 API로 확인한 조건 일치 후보가 없습니다.';data.append(empty);return}
    for(const x of items){const btn=document.createElement('button');btn.className='ai-trip-choice';const name=document.createElement('strong');name.textContent=x.pt.name;const desc=document.createElement('small');desc.textContent=`${x.item.payment==='onnuri'?'온누리':'지역사랑'} · 추가 우회 약 ${Math.round(x.extra*10)/10}분 · 경로에서 약 ${Math.round(x.item.offset)}m`;btn.append(name,desc);btn.onclick=async()=>{
        if(state.tripStartedAt){ui.desc.textContent='주행 중에는 안전한 장소에 정차한 후 경유지를 선택해 주세요.';return}
        aiTripCancelQuick();ui.desc.textContent='경유지 경로를 재계산하고 있습니다…';btn.disabled=true;try{cancelAutoStart();state.waypoints=[...(state.waypoints||[]),x.pt].slice(0,5);renderRouteWaypoints();await loadRouteOptions();cancelAutoStart();ui.heading.textContent=`${x.pt.name} 경유 확정`;ui.body.textContent='';const detail=document.createElement('p');detail.textContent='경유 경로를 다시 계산했습니다. 실제 안내를 확인하고 시작하세요.';ui.body.append(detail);aiTripQuickCountdown(ui)}catch(e){ui.desc.textContent='경로 계산에 실패했습니다. 다시 시도해 주세요.';btn.disabled=false}
      };data.append(btn)}
    const foot=document.createElement('p');foot.className='ai-trip-sub';foot.textContent='가맹점의 실제 결제 가능 여부와 영업시간은 방문 전 확인하세요.';data.append(foot);
  }catch(e){if(ui.root.isConnected)ui.desc.textContent=String(e?.message||'검색 오류')}
}
async function startAiTripSearch(text){
  if(aiTripBusy)return toast('AI 검색이 진행 중입니다.');aiTripBusy=true;aiTripCancelQuick();
  const ui=aiTripDialog('AI 조건 해석 중','조건을 분석하고 목적지를 확인하고 있습니다…');
  try{const plan=await aiTripParse(text);if(!ui.root.isConnected)return;if(!plan||plan.intent!=='plan_stops'){ui.desc.textContent='조건을 이해하지 못했습니다. 문장을 다시 입력해 주세요.';return}aiTripSaveCondition(plan);await aiTripResolveDestination(ui,plan,aiTripSafeText(plan.destination||''))}
  catch(e){console.warn('AI condition search failed',e);if(ui.root.isConnected)ui.desc.textContent='검색을 완료하지 못했습니다. 다시 시도해 주세요.'}finally{aiTripBusy=false}
}
async function aiTripSearchFromHome(options={}){
  const input=$('destinationInput');const q=input?.value?.trim()||'';
  if(!q)return;
  if(/인스타(?:그램)?|핫플|SNS/i.test(q)){
    if(!options.fromExample)aiTripRememberCommand(q);
    try{hotspotOpen(q)}finally{aiTripClearHomeQuery(q)}
    return;
  }
  if(aiTripIsQuery(q)&&!options.fromExample)aiTripRememberCommand(q);
  try{return await (aiTripIsQuery(q)?startAiTripSearch(q):searchPlaces(q))}
  finally{aiTripClearHomeQuery(q)}
}
function aiTripApplyRecent(){
  let command='';try{command=String(localStorage.getItem(AI_LAST_COMMAND_KEY)||'').trim()}catch{}
  if(!command)return;
  const input=$('destinationInput');if(input)input.value=command;
  return aiTripSearchFromHome();
}
// One shared voice session for home and driving. UI feedback is driven by the
// recognizer lifecycle; no microphone audio is recorded or retained here.
let dangolloVoiceSession=null, dangolloVoiceSerial=0;
function dangolloVoiceVisual(stage,message=''){
  const panel=$('dangolloVoiceStatus');
  if(panel){
    panel.classList.toggle('hidden',stage==='idle');
    panel.dataset.phase=stage;
    const title=$('dangolloVoiceStatusTitle');
    if(title)title.textContent=stage==='listening'?'듣고 있어요':stage==='processing'?'명령 처리 중':'음성 입력 종료';
    const desc=$('dangolloVoiceStatusDesc');
    if(desc)desc.textContent=message||(stage==='listening'?'말씀해 주세요 · 5초간 말씀이 없으면 종료합니다':stage==='processing'?'말씀하신 내용을 확인하고 있어요':'');
  }
  for(const id of ['homeAiMicBtn','arOpenBtn','driveArBtn','driveVoiceBtn']){
    const button=$(id);if(!button)continue;
    button.classList.toggle('dangollo-mic-listening',stage==='listening');
    button.classList.toggle('dangollo-mic-processing',stage==='processing');
    button.setAttribute('aria-pressed',String(stage==='listening'));
    button.setAttribute('aria-busy',String(stage==='processing'));
  }
}
function dangolloVoiceClearTimers(session){
  if(!session)return;
  clearTimeout(session.silenceTimer);
  clearTimeout(session.resultTimer);
  session.silenceTimer=null;session.resultTimer=null;
}
function dangolloVoiceFinish(session){
  if(!session||dangolloVoiceSession!==session)return;
  dangolloVoiceClearTimers(session);
  dangolloVoiceSession=null;homeAiVoicePending=false;
  dangolloVoiceVisual('idle');
}
function dangolloVoiceAbort(session,reason){
  if(!session||dangolloVoiceSession!==session)return;
  dangolloVoiceClearTimers(session);
  session.finished=true;
  try{session.rec?.abort()}catch{}
  if(session.native){try{window.JofamsVoiceBridge?.stopRecognition?.()}catch{}}
  dangolloVoiceFinish(session);
  if(reason)toast(reason,2000);
}
function dangolloVoiceSilenceTimeout(session){
  if(!session||dangolloVoiceSession!==session||session.finished||session.received||session.speechStarted)return;
  session.silenceTimer=setTimeout(()=>{
    if(dangolloVoiceSession===session&&!session.received&&!session.speechStarted)
      dangolloVoiceAbort(session,'5초 동안 음성이 없어 마이크를 종료했습니다.');
  },5000);
}
function dangolloVoiceReceive(session,text){
  if(!session||dangolloVoiceSession!==session||session.finished||session.received)return;
  text=String(text||'').trim();
  if(!text){dangolloVoiceAbort(session,'음성을 인식하지 못했습니다. 다시 시도해 주세요.');return}
  session.received=true;session.finished=true;
  dangolloVoiceClearTimers(session);
  homeAiVoicePending=false;
  dangolloVoiceVisual('processing','“'+text.slice(0,55)+'” 분석 중…');
  try{session.rec?.stop()}catch{}
  let action;
  try{
    if(session.mode==='home'){
      if($('destinationInput'))$('destinationInput').value=text;
      action=aiTripSearchFromHome();
    }else action=handleVoiceCommandText(text);
  }catch(e){console.warn('Voice command failed',e);dangolloVoiceFinish(session);return}
  Promise.resolve(action).catch(e=>console.warn('Voice command rejected',e))
    .finally(()=>dangolloVoiceFinish(session));
}
function dangolloVoiceBegin(mode){
  // Tapping either mic again cancels the active session, including native sessions.
  if(dangolloVoiceSession){dangolloVoiceAbort(dangolloVoiceSession);return}
  const session={id:++dangolloVoiceSerial,mode,finished:false,received:false,speechStarted:false,native:false,rec:null,silenceTimer:null,resultTimer:null};
  dangolloVoiceSession=session;homeAiVoicePending=mode==='home';
  dangolloVoiceVisual('listening');
  const bridge=window.JofamsVoiceBridge;
  if(bridge?.isNativeVoiceAvailable?.()){
    try{
      session.native=true;
      const started=bridge.startRecognition();
      // Native bridge has only final-result events; without speech lifecycle
      // events, five seconds is the maximum wait for any recognition result.
      dangolloVoiceSilenceTimeout(session);
      return started;
    }catch(e){console.warn('Native voice bridge failed',e);session.native=false}
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){dangolloVoiceAbort(session,'이 기기에서는 음성 입력을 지원하지 않습니다.');return}
  const rec=new SR();session.rec=rec;rec.lang='ko-KR';rec.interimResults=true;rec.maxAlternatives=1;
  rec.onstart=()=>{if(dangolloVoiceSession===session)dangolloVoiceSilenceTimeout(session)};
  rec.onspeechstart=()=>{if(dangolloVoiceSession!==session)return;session.speechStarted=true;clearTimeout(session.silenceTimer);dangolloVoiceVisual('listening','음성을 듣고 있습니다…')};
  rec.onspeechend=()=>{
    if(dangolloVoiceSession!==session||session.received)return;
    dangolloVoiceVisual('processing','음성 인식 결과를 확인하고 있습니다…');
    session.resultTimer=setTimeout(()=>dangolloVoiceAbort(session,'음성 인식 시간이 초과됐습니다.'),5000);
  };
  rec.onresult=e=>{
    const results=Array.from(e.results||[]);
    const final=results.filter(r=>r.isFinal).map(r=>r?.[0]?.transcript||'').join(' ').trim();
    if(final){dangolloVoiceReceive(session,final);return}
    const partial=results.map(r=>r?.[0]?.transcript||'').join(' ').trim();
    if(partial){session.speechStarted=true;clearTimeout(session.silenceTimer);dangolloVoiceVisual('listening','“'+partial.slice(0,55)+'” 듣고 있어요…')}
  };
  rec.onerror=e=>{if(dangolloVoiceSession===session)dangolloVoiceAbort(session,e?.error==='not-allowed'?'마이크 권한을 허용해 주세요.':'음성 인식이 종료됐습니다. 다시 시도해 주세요.')};
  rec.onend=()=>{if(dangolloVoiceSession===session&&!session.received)dangolloVoiceAbort(session)};
  try{rec.start();dangolloVoiceSilenceTimeout(session)}catch{dangolloVoiceAbort(session,'마이크를 시작하지 못했습니다.')}
}
function homeAiVoiceSearch(){return dangolloVoiceBegin('home')}


async function handleVoiceCommandText(raw){
  const text=String(raw||'').trim();if(!text)return toast('명령을 다시 말씀해 주세요.');
  if(text.includes('재탐색'))return reroute();
  if(text.includes('안내 종료')||text.includes('길 안내 종료'))return stopNavigation();
  if(text.includes('다임'))return setCharacter('daim');
  if(text.includes('순식'))return setCharacter('sunsik');
  if(text.includes('훈민'))return setCharacter('hunmin');
  if(/경로\s*(비교|차이|설명)|추천길.*빠른길|무료도로.*비교/.test(text)){
    if(state.carRouteOptions?.length<2)return toast('비교할 경로가 2개 이상 준비되어야 합니다.');
    if(!$('routeAiCompareResult'))return toast('경로 화면에서 AI 비교 기능을 이용해 주세요.');
    setView('route');return explainRoutesWithAi();
  }
  if(voiceRecommendationRequested(text)||/가는\s*길에|상품권|온누리|지역사랑|우회|경유/.test(text)){
    return startAiTripSearch(text);
  }
  const q=normalizeVoiceDestination(text);if(!q)return toast('목적지를 다시 말씀해 주세요.');
  toast(`“${q}” 목적지를 찾고 있습니다...`,2200);
  try{
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',q);if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const r=await fetch(u);if(!r.ok)throw new Error();const d=await r.json(),item=(d.items||[])[0];
    if(!item)return toast(`“${q}” 검색 결과가 없습니다.`,2800);
    if(state.tripStartedAt){toast(`${item.name}(으)로 목적지를 변경합니다.`,2200);await changeDestinationWhileDriving(item)}
    else await chooseDestination(item);
  }catch(e){console.warn('voice destination search failed',e);toast('음성 목적지 검색에 실패했습니다.',2800)}
}
function startVoiceCommand(){return dangolloVoiceBegin('drive')}
window.addEventListener('jofams-native-voice-result',e=>{
  const session=dangolloVoiceSession;
  // Ignore late replies after cancellation/timeout instead of applying stale commands.
  if(!session||!session.native)return;
  dangolloVoiceReceive(session,String(e.detail?.text||e.detail||''));
});
window.addEventListener('jofams-native-voice-error',e=>{
  const session=dangolloVoiceSession;
  if(session?.native)dangolloVoiceAbort(session,'음성 인식을 완료하지 못했습니다.');
});


function normalizedEmail(v){return String(v||'').trim().toLowerCase()}
function localAdminEmail(){
  const u=state.firebase.user;
  return normalizedEmail(u?.email||u?.providerData?.find?.(p=>p?.email)?.email||'');
}
function isAdminUser(){
  return state.adminVerified===true;
}
async function authFetch(url,opt={}){
  const token=await firebaseIdToken();
  if(!token)throw new Error('LOGIN_REQUIRED');
  const headers={...(opt.headers||{}),'authorization':`Bearer ${token}`};if(CONFIG?.firebase?.apiKey)headers['x-firebase-api-key']=CONFIG.firebase.apiKey;
  return fetch(url,{...opt,headers});
}
async function verifyAdminAccess(){
  if(!state.firebase.user){
    state.adminVerified=false;
    state.adminVerifiedEmail='';
    updateAdminUI();
    return false;
  }
  try{
    const r=await authFetch('/api/admin-access',{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    state.adminVerified=Boolean(r.ok&&d?.isAdmin);
    state.adminVerifiedEmail=normalizedEmail(d?.email||'');
    updateAdminUI();
    return state.adminVerified;
  }catch(e){
    state.adminVerified=false;
    state.adminVerifiedEmail='';
    updateAdminUI();
    return false;
  }
}
async function loadPublicContent(){try{const r=await fetch('/api/content?type=content'),d=await r.json();return d.content||{}}catch{return {appInfo:'MVP 7.5.4',privacy:'개인정보처리방침이 준비 중입니다.'}}}

// ===== KOMSCO 유튜브 숏폼 (홈/MY 노출) =====
// 주행 화면(안내 진행 중)에는 절대 노출하지 않는다. 홈 화면과 MY 페이지, 즉 정차/대기 상태에서만 사용한다.
function komscoShortThumb(item){return item.thumbnailUrl||`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
function komscoShortDurationLabel(sec){if(!sec)return'';const m=Math.floor(sec/60),s=sec%60;return`${m}:${String(s).padStart(2,'0')}`}
function komscoShortCardHtml(item){
  return `<button type="button" class="komsco-short-card" data-komsco-video="${escapeHtml(item.videoId)}" data-komsco-title="${escapeHtml(item.title)}">
    <span class="komsco-short-thumb-wrap"><img src="${escapeHtml(komscoShortThumb(item))}" alt="" loading="lazy"><i data-icon="play"></i>${item.durationSec?`<small>${komscoShortDurationLabel(item.durationSec)}</small>`:''}</span>
    <b>${escapeHtml(item.title)}</b>
  </button>`;
}
async function loadHomeShorts(){
  try{
    const r=await fetch('/api/komsco-shorts'),d=await r.json();
    const items=Array.isArray(d.items)?d.items:[];
    const block=$('komscoShortsHomeBlock'),scroll=$('komscoShortsScroll'),myBtn=$('komscoShortsMyBtn');
    if(!d.ok||!d.enabled||!items.length){block?.classList.add('hidden');myBtn?.classList.add('hidden');return}
    state.komscoShorts=items;
    if(scroll){scroll.innerHTML=items.map(komscoShortCardHtml).join('');applyIcons(scroll);scroll.querySelectorAll('[data-komsco-video]').forEach(btn=>btn.onclick=()=>openKomscoShort(btn.dataset.komscoVideo,btn.dataset.komscoTitle))}
    block?.classList.remove('hidden');
    myBtn?.classList.remove('hidden');
  }catch(e){console.warn('komsco shorts load failed',e);$('komscoShortsHomeBlock')?.classList.add('hidden');$('komscoShortsMyBtn')?.classList.add('hidden')}
}
function komscoPostCommand(func,args=''){
  const player=$('komscoShortPlayer');
  try{player?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch(e){/* noop */}
}
function updateKomscoMuteBtn(){
  const btn=$('komscoShortMuteBtn');if(!btn)return;
  btn.innerHTML=icon(state.komscoShortMuted?'volume-x':'volume');
  btn.setAttribute('aria-label',state.komscoShortMuted?'음소거 해제':'음소거');
}
function toggleKomscoMute(){
  state.komscoShortMuted=!state.komscoShortMuted;
  komscoPostCommand(state.komscoShortMuted?'mute':'unMute');
  updateKomscoMuteBtn();
}
function openKomscoShort(videoId,title,{fromList=false}={}){
  if(!videoId)return;
  state.komscoShortReturnToList=Boolean(fromList||!$('komscoShortsListModal')?.classList.contains('hidden'));
  if(state.komscoShortReturnToList)$('komscoShortsListModal')?.classList.add('hidden');
  const player=$('komscoShortPlayer');
  // 7.6.9.2: 브라우저(특히 모바일 Safari/Chrome)는 iframe에 muted 상태가 아니면
  // 자동재생을 차단한다. mute=1로 시작해 확실히 자동재생시키고, 사용자가 음소거
  // 버튼으로 직접 소리를 켤 수 있게 한다. enablejsapi=1은 postMessage 음소거 토글에 필요.
  state.komscoShortMuted=true;
  if(player)player.src=`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1`;
  updateKomscoMuteBtn();
  if($('komscoShortTitle'))$('komscoShortTitle').textContent=title||'KOMSCO 소식';
  if($('komscoShortOpenYoutube'))$('komscoShortOpenYoutube').href=`https://www.youtube.com/watch?v=${videoId}`;
  $('komscoShortModal')?.classList.remove('hidden');
}
function closeKomscoShort(){
  $('komscoShortModal')?.classList.add('hidden');
  const player=$('komscoShortPlayer');if(player)player.src='';
  if(state.komscoShortReturnToList){
    state.komscoShortReturnToList=false;
    $('komscoShortsListModal')?.classList.remove('hidden');
  }
}
async function openKomscoShortsList(){
  $('komscoShortsListModal')?.classList.remove('hidden');
  const body=$('komscoShortsListBody');
  if(body)body.innerHTML='<div class="inquiry-empty">불러오는 중...</div>';
  try{
    const r=await fetch('/api/komsco-shorts?scope=full'),d=await r.json();
    const items=Array.isArray(d.items)?d.items:[];
    if(!items.length){if(body)body.innerHTML='<div class="inquiry-empty">표시할 영상이 없습니다.</div>';return}
    if(body){body.innerHTML=`<div class="komsco-shorts-grid">${items.map(komscoShortCardHtml).join('')}</div>`;applyIcons(body);body.querySelectorAll('[data-komsco-video]').forEach(btn=>btn.onclick=()=>openKomscoShort(btn.dataset.komscoVideo,btn.dataset.komscoTitle,{fromList:true}))}
  }catch{if(body)body.innerHTML='<div class="inquiry-empty">영상을 불러오지 못했습니다.</div>'}
}
function closeKomscoShortsList(){$('komscoShortsListModal')?.classList.add('hidden')}

// ---- 관리자: KOMSCO 숏폼 노출 관리 ----
async function komscoShortsAdminRequest(action,method='GET',body=null){
  const u=new URL('/api/komsco-shorts',location.origin);if(action)u.searchParams.set('action',action);
  const opt={method,headers:{'content-type':'application/json'}};if(body)opt.body=JSON.stringify(body);
  const r=await authFetch(u,opt),d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);
  return d;
}
async function loadAdminShorts(){
  try{
    const d=await komscoShortsAdminRequest('admin-list');
    const s=d.settings||{enabled:true,limit:6,sort:'latest'};
    if($('adminShortsEnabled'))$('adminShortsEnabled').checked=s.enabled!==false;
    if($('adminShortsLimit'))$('adminShortsLimit').value=s.limit||6;
    if($('adminShortsSort'))$('adminShortsSort').value=s.sort||'latest';
    const items=Array.isArray(d.items)?d.items:[];
    const box=$('adminShortsList');
    if(box)box.innerHTML=items.length?items.map(x=>`<article><div><b>${escapeHtml(x.title)}</b><small>${escapeHtml((x.publishedAt||'').slice(0,10))} · 조회수 ${Number(x.viewCount||0).toLocaleString()}</small></div><button data-komsco-toggle="${escapeHtml(x.videoId)}" data-excluded="${x.excluded?1:0}">${x.excluded?'노출 재개':'제외'}</button></article>`).join(''):'<div class="inquiry-empty">캐시된 영상이 없습니다. 새로고침을 눌러 주세요.</div>';
    box?.querySelectorAll('[data-komsco-toggle]').forEach(b=>b.onclick=()=>toggleKomscoShortExclude(b.dataset.komscoToggle,b.dataset.excluded==='1'));
  }catch{toast('KOMSCO 숏폼 목록을 불러오지 못했습니다.')}
}
async function saveAdminShortsSettings(){
  const btn=$('adminShortsSaveBtn');if(btn)btn.disabled=true;
  try{
    await komscoShortsAdminRequest('settings','PUT',{
      enabled:$('adminShortsEnabled')?.checked!==false,
      limit:Number($('adminShortsLimit')?.value)||6,
      sort:$('adminShortsSort')?.value||'latest',
    });
    showPlaceConfirmPopup('KOMSCO 숏폼 노출 설정이 저장되었습니다.');
  }catch{toast('설정 저장에 실패했습니다.')}finally{if(btn)btn.disabled=false}
}
async function refreshAdminShortsNow(){
  const btn=$('adminShortsRefreshBtn'),status=$('adminShortsStatus');
  if(btn)btn.disabled=true;if(status)status.textContent='유튜브에서 최신 영상을 가져오는 중...';
  try{
    const d=await komscoShortsAdminRequest('refresh','POST',{});
    if(status)status.textContent=`완료: Shorts ${d.refreshed||0}건 갱신됨`;
    loadAdminShorts();
  }catch(e){if(status)status.textContent=`실패: ${e.message||'오류가 발생했습니다.'}`}
  finally{if(btn)btn.disabled=false}
}
async function toggleKomscoShortExclude(videoId,currentlyExcluded){
  try{
    await komscoShortsAdminRequest(currentlyExcluded?'include':'exclude','POST',{videoId});
    loadAdminShorts();
  }catch{toast('처리에 실패했습니다.')}
}
function updateAdminUI(){
  const btn=$('adminModeBtn');
  if(!btn)return;
  const loggedIn=Boolean(state.firebase.user);
  btn.classList.toggle('hidden',!loggedIn);
  btn.dataset.adminVerified=isAdminUser()?'1':'0';
  const small=btn.querySelector('small');
  if(small)small.textContent=isAdminUser()
    ?'공지·콘텐츠·1:1 문의·온누리 주소 관리'
    :'관리자 권한 확인 후 진입';
}
async function openAdminMode(){
  if(!isAdminUser())await verifyAdminAccess();
  if(!isAdminUser())return toast(`관리자 계정만 이용할 수 있습니다.${localAdminEmail()?` (현재: ${localAdminEmail()})`:''}`);
  $('adminAccountLabel').textContent=state.adminVerifiedEmail||localAdminEmail()||'인증 필요';
  $('adminModal').classList.remove('hidden');
  switchAdminTab('notices');
}
function closeAdminMode(){$('adminModal')?.classList.add('hidden')}
function switchAdminTab(tab){document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));['notices','content','inquiries','onnuri','shorts'].forEach(k=>$(`admin${k[0].toUpperCase()+k.slice(1)}Panel`)?.classList.toggle('hidden',k!==tab));if(tab==='notices')loadAdminNotices();if(tab==='content')loadAdminContent();if(tab==='inquiries')loadAdminInquiries();if(tab==='onnuri')loadOnnuriBatchStatus();if(tab==='shorts')loadAdminShorts()}
async function adminContentRequest(type,method='GET',body=null){const u=new URL('/api/content',location.origin);u.searchParams.set('type',type);const opt={method,headers:{'content-type':'application/json'}};if(body)opt.body=JSON.stringify(body);const r=method==='GET'?await fetch(u):await authFetch(u,opt);const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);return d}
async function loadAdminNotices(){try{const d=await adminContentRequest('notices');state.adminNotices=d.items||[];const box=$('adminNoticeList');box.innerHTML=state.adminNotices.length?state.adminNotices.map(x=>`<article><div><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.createdAt||'')}</small></div><button data-admin-notice-delete="${x.id}">삭제</button><p>${escapeHtml(x.body).replace(/\n/g,'<br>')}</p></article>`).join(''):'<div class="inquiry-empty">등록된 공지가 없습니다.</div>';box.querySelectorAll('[data-admin-notice-delete]').forEach(b=>b.onclick=()=>deleteAdminNotice(b.dataset.adminNoticeDelete))}catch{toast('공지 목록을 불러오지 못했습니다.')}}
async function saveAdminNotice(){const title=$('adminNoticeTitle').value.trim(),body=$('adminNoticeBody').value.trim();if(title.length<2||body.length<2)return toast('공지 제목과 내용을 입력해 주세요.');const btn=$('adminNoticeSaveBtn');btn.disabled=true;try{await adminContentRequest('notices','POST',{title,body});$('adminNoticeTitle').value='';$('adminNoticeBody').value='';showPlaceConfirmPopup('공지사항이 등록되었습니다.');loadAdminNotices()}catch{toast('공지 등록에 실패했습니다.')}finally{btn.disabled=false}}
async function deleteAdminNotice(id){if(!confirm('이 공지를 삭제할까요?'))return;try{await adminContentRequest('notices','DELETE',{id});showPlaceConfirmPopup('공지사항이 삭제되었습니다.');loadAdminNotices()}catch{toast('공지 삭제에 실패했습니다.')}}
async function loadAdminContent(){try{const d=await adminContentRequest('content');const c=d.content||{};$('adminAppInfoText').value=c.appInfo||'';$('adminPrivacyText').value=c.privacy||''}catch{toast('콘텐츠를 불러오지 못했습니다.')}}
async function saveAdminContent(){const btn=$('adminContentSaveBtn');btn.disabled=true;try{await adminContentRequest('content','PUT',{appInfo:$('adminAppInfoText').value,privacy:$('adminPrivacyText').value});showPlaceConfirmPopup('앱정보와 개인정보처리방침이 수정되었습니다.')}catch{toast('수정 내용 저장에 실패했습니다.')}finally{btn.disabled=false}}

let onnuriBatchRunning=false;
let onnuriBatchGrandDone=0;
let onnuriBatchGrandTotal=0;
let onnuriBatchProgressState={
  exact:{cursor:0,total:0},
  market:{cursor:0,total:0},
  unresolved:{cursor:0,total:0}
};
// 7.6.8: 전국 8차 보강(CSV8) 지역별 좌표화 진행 상태. key는 manifest의 지역코드(daejeon, sejong 등).
let onnuriCsv8Regions={};
let onnuriCsv8ActiveKey='';

async function loadOnnuriBatchStatus(){
  const status=$('onnuriBatchStatus');if(status)status.textContent='D1 캐시 상태를 확인하는 중입니다.';
  try{
    const r=await authFetch('/api/onnuri-geocode-batch');
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'status failed');
    $('onnuriBatchTotal').textContent=Number(d.total||0).toLocaleString();
    $('onnuriBatchExact').textContent=Number(d.exactTotal||0).toLocaleString();
    $('onnuriBatchMarket').textContent=Number(d.marketFallbackTotal||0).toLocaleString();
    $('onnuriBatchUnresolved').textContent=Number(d.unresolvedTotal||0).toLocaleString();
    $('onnuriBatchCached').textContent=Number(d.cached||0).toLocaleString();
    onnuriBatchGrandTotal=Number(d.total||0);
    if(d.progress){
      onnuriBatchProgressState={
        exact:{cursor:Number(d.progress.exact?.cursor||0),total:Number(d.progress.exact?.total||d.exactTotal||0)},
        market:{cursor:Number(d.progress.market?.cursor||0),total:Number(d.progress.market?.total||d.marketFallbackTotal||0)},
        unresolved:{cursor:Number(d.progress.unresolved?.cursor||0),total:Number(d.progress.unresolved?.total||d.unresolvedTotal||0)}
      };
      onnuriBatchGrandDone=Number(d.progress.done||0);
    }else{
      onnuriBatchGrandDone=Math.min(Number(d.cached||0),onnuriBatchGrandTotal);
    }
    if(!onnuriBatchRunning)updateOnnuriBatchProgress(onnuriBatchGrandDone,onnuriBatchGrandTotal);
    if(status){
      const pct=onnuriBatchGrandTotal?Math.min(100,Math.round(onnuriBatchGrandDone/onnuriBatchGrandTotal*100)):0;
      const exactCachedN=Number(d.exactCached||0),exactTotalN=Number(d.exactTotal||0);
      const kakaoWarn=d.kakaoConfigured===false?' ⚠️ KAKAO_REST_API_KEY가 설정되지 않아, 아직 캐시되지 않은 가맹점은 실시간 좌표 변환도 불가능해 지도에 표시되지 않습니다.':'';
      status.textContent=`저장된 진행률 ${pct}% · ${onnuriBatchGrandDone.toLocaleString()} / ${onnuriBatchGrandTotal.toLocaleString()} · D1 캐시 ${Number(d.cached||0).toLocaleString()}건 · 정확주소(exact) 캐시완료 ${exactCachedN.toLocaleString()}/${exactTotalN.toLocaleString()}건${kakaoWarn}`;
    }
    if(d.csv8?.regions){
      onnuriCsv8Regions=d.csv8.regions;
      renderOnnuriCsv8List();
    }
  }catch(e){
    if(status)status.textContent=`상태 확인 실패: ${e?.message||'서버 설정을 확인해 주세요.'}`;
    const box=$('onnuriCsv8List');
    if(box)box.textContent='지역 목록을 불러오지 못했습니다.';
  }
}
function renderOnnuriCsv8List(){
  const box=$('onnuriCsv8List');if(!box)return;
  const keys=Object.keys(onnuriCsv8Regions);
  if(!keys.length){box.textContent='지역 데이터가 없습니다.';return}
  // 대전·세종을 목록 맨 위로 올려 우선 처리하기 쉽게 한다.
  keys.sort((a,b)=>{
    const pa=(a==='daejeon'||a==='sejong')?0:1,pb=(b==='daejeon'||b==='sejong')?0:1;
    return pa-pb||a.localeCompare(b);
  });
  box.innerHTML=keys.map(key=>{
    const r=onnuriCsv8Regions[key];
    const total=Number(r.total||0),cursor=Math.min(total,Number(r.cursor||0));
    const pct=total?Math.min(100,Math.round(cursor/total*100)):0;
    const done=cursor>=total&&total>0;
    const running=onnuriBatchRunning&&onnuriCsv8ActiveKey===key;
    const label=running?'중지':(done?'완료':'실행');
    return `<div class="onnuri-csv8-row${done?' done':''}${running?' running':''}">
      <div><b>${escapeHtml(r.name||key)}</b><small>${cursor.toLocaleString()} / ${total.toLocaleString()}건</small></div>
      <span class="onnuri-csv8-pct">${pct}%</span>
      <button type="button" data-onnuri-csv8-region="${key}" ${onnuriBatchRunning&&!running?'disabled':''}>${label}</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-onnuri-csv8-region]').forEach(b=>b.onclick=()=>toggleOnnuriCsv8Region(b.dataset.onnuriCsv8Region));
}
function toggleOnnuriCsv8Region(key){
  if(onnuriBatchRunning&&onnuriCsv8ActiveKey===key){stopOnnuriBatch();return}
  if(onnuriBatchRunning)return; // 다른 배치가 이미 실행 중
  runOnnuriCsv8Region(key);
}
async function runOnnuriCsv8Region(key){
  const r=onnuriCsv8Regions[key];if(!r)return;
  onnuriBatchRunning=true;
  onnuriCsv8ActiveKey=key;
  if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').disabled=true;
  if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').disabled=true;
  renderOnnuriCsv8List();
  const status=$('onnuriBatchStatus');
  try{
    await runOnnuriStage(`csv8:${key}`,`${r.name||key} 좌표화`,Number(r.total||0),Number(r.cursor||0));
    if(status)status.textContent=onnuriBatchRunning?`${r.name||key} 좌표화가 완료되었습니다.`:'배치를 중지했습니다.';
  }catch(e){
    if(status)status.textContent=`배치 중단: ${e?.message||'서버 오류'}`;
  }finally{
    onnuriBatchRunning=false;
    onnuriCsv8ActiveKey='';
    if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').disabled=false;
    if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').disabled=true;
    loadOnnuriBatchStatus();
  }
}
function updateOnnuriBatchProgress(done,total){
  const pct=total?Math.min(100,Math.round(done/total*100)):0;
  if($('onnuriBatchProgress'))$('onnuriBatchProgress').textContent=`${pct}%`;
  if($('onnuriBatchBar'))$('onnuriBatchBar').style.width=`${pct}%`;
}
async function runOnnuriStage(stage,label,total,startCursor=0){
  let cursor=Math.max(0,Math.min(total,Number(startCursor)||0));
  if(cursor>=total)return;
  while(onnuriBatchRunning && cursor<total){
    if($('onnuriBatchStatus'))$('onnuriBatchStatus').textContent=`${label} ${cursor.toLocaleString()} / ${total.toLocaleString()} 처리 중…`;
    const r=await authFetch('/api/onnuri-geocode-batch',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({stage,cursor,limit:20})
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'batch failed');
    const serverCursor=Math.max(cursor,Number(d.nextCursor||cursor));
    const advanced=serverCursor-cursor;
    cursor=serverCursor;
    if(onnuriBatchProgressState[stage])onnuriBatchProgressState[stage].cursor=cursor;
    onnuriBatchGrandDone=
      Number(onnuriBatchProgressState.exact?.cursor||0)+
      Number(onnuriBatchProgressState.market?.cursor||0)+
      Number(onnuriBatchProgressState.unresolved?.cursor||0);
    updateOnnuriBatchProgress(onnuriBatchGrandDone,onnuriBatchGrandTotal);
    if($('onnuriBatchStatus'))$('onnuriBatchStatus').textContent=`${label} ${cursor.toLocaleString()} / ${total.toLocaleString()} · 성공 ${d.success||0} · 캐시 ${d.cachedHits||0} · 실패 ${d.failed||0}`;
    if(d.done)break;
    await new Promise(resolve=>setTimeout(resolve,450));
  }
}
async function startOnnuriBatch(){
  if(onnuriBatchRunning)return;
  onnuriBatchRunning=true;
  $('onnuriBatchStartBtn').disabled=true;
  $('onnuriBatchStopBtn').disabled=false;
  const status=$('onnuriBatchStatus');
  try{
    const rs=await authFetch('/api/onnuri-geocode-batch'),sd=await rs.json();
    if(!rs.ok)throw new Error(sd.error||'status failed');
    onnuriBatchGrandTotal=Number(sd.total||0);
    const p=sd.progress||{};
    onnuriBatchProgressState={
      exact:{cursor:Number(p.exact?.cursor||0),total:Number(sd.exactTotal||0)},
      market:{cursor:Number(p.market?.cursor||0),total:Number(sd.marketFallbackTotal||0)},
      unresolved:{cursor:Number(p.unresolved?.cursor||0),total:Number(sd.unresolvedTotal||0)}
    };
    onnuriBatchGrandDone=
      onnuriBatchProgressState.exact.cursor+
      onnuriBatchProgressState.market.cursor+
      onnuriBatchProgressState.unresolved.cursor;
    updateOnnuriBatchProgress(onnuriBatchGrandDone,onnuriBatchGrandTotal);

    if(status&&onnuriBatchGrandDone>0){
      const pct=onnuriBatchGrandTotal?Math.min(100,Math.round(onnuriBatchGrandDone/onnuriBatchGrandTotal*100)):0;
      status.textContent=`이전 진행률 ${pct}%에서 이어서 시작합니다.`;
    }

    await runOnnuriStage('exact','실주소',Number(sd.exactTotal||0),onnuriBatchProgressState.exact.cursor);
    if(onnuriBatchRunning)await runOnnuriStage('market','상점가 대표주소',Number(sd.marketFallbackTotal||0),onnuriBatchProgressState.market.cursor);
    if(onnuriBatchRunning)await runOnnuriStage('unresolved','미확인 가맹점',Number(sd.unresolvedTotal||0),onnuriBatchProgressState.unresolved.cursor);

    if(onnuriBatchRunning && status)status.textContent='온누리 주소 좌표화 배치가 완료되었습니다. D1 캐시를 갱신합니다.';
  }catch(e){
    if(status)status.textContent=`배치 중단: ${e?.message||'서버 오류'}`;
  }finally{
    onnuriBatchRunning=false;
    if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').disabled=false;
    if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').disabled=true;
    loadOnnuriBatchStatus();
  }
}
function stopOnnuriBatch(){
  onnuriBatchRunning=false;
  if($('onnuriBatchStatus'))$('onnuriBatchStatus').textContent='배치를 중지했습니다. 현재 진행 위치도 D1에 저장되어 다음 실행 시 이 지점부터 이어집니다.';
  if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').disabled=false;
  if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').disabled=true;
}
async function resetOnnuriLegacyProgress(){
  // 과거 bootstrap 오류로 실제 처리 없이 100%로 잘못 표시된 exact/market/unresolved
  // 진행률을 0으로 되돌린다. (D1 캐시 자체를 지우지는 않으므로, 이미 좌표가 저장된
  // 가맹점은 재실행 시 그대로 건너뛰고 실제로 비어 있는 것만 다시 채워진다.)
  if(onnuriBatchRunning){alert('배치가 실행 중일 때는 초기화할 수 없습니다. 먼저 중지해 주세요.');return}
  if(!confirm('정확주소/대표주소/미확인 3단계의 저장된 진행률을 모두 0으로 초기화합니다. (실제로는 처리되지 않았는데 100%로 잘못 표시된 경우를 바로잡기 위한 기능입니다.) 계속할까요?'))return;
  const status=$('onnuriBatchStatus');
  try{
    for(const stage of ['exact','market','unresolved']){
      const r=await authFetch('/api/onnuri-geocode-batch',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({stage,reset:true})
      });
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||`초기화 실패(${stage})`);
    }
    if(status)status.textContent='진행률을 초기화했습니다. "주소 자동 채우기 시작"을 다시 눌러주세요.';
  }catch(e){
    if(status)status.textContent=`초기화 실패: ${e?.message||'서버 오류'}`;
  }finally{
    loadOnnuriBatchStatus();
  }
}


async function loadAdminInquiries(){try{const r=await authFetch('/api/inquiries?admin=1'),d=await r.json();if(!r.ok)throw new Error();const box=$('adminInquiryList'),items=d.items||[];box.innerHTML=items.length?items.map(x=>`<button data-admin-inquiry="${x.id}" class="inquiry-row"><span><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.email||'')} · ${escapeHtml(x.createdAt||'')}</small></span><em class="${x.status==='answered'?'answered':''}">${inquiryStatusLabel(x.status)}</em></button>`).join(''):'<div class="inquiry-empty">접수된 문의가 없습니다.</div>';box.querySelectorAll('[data-admin-inquiry]').forEach(b=>b.onclick=()=>openAdminInquiry(b.dataset.adminInquiry))}catch{toast('문의 목록을 불러오지 못했습니다.')}}
async function openAdminInquiry(id){try{const r=await authFetch(`/api/inquiries?id=${encodeURIComponent(id)}&admin=1`),d=await r.json();if(!r.ok)throw new Error();const x=d.item,box=$('adminInquiryDetail');box.innerHTML=`<button id="adminInquiryBack" class="inquiry-back">← 문의 목록</button><h3>${escapeHtml(x.title)}</h3><div class="inquiry-meta"><span>${escapeHtml(x.email||'')}</span><b>${inquiryStatusLabel(x.status)}</b></div><section><b>문의 내용</b><p>${escapeHtml(x.body).replace(/\n/g,'<br>')}</p></section><label><b>답변</b><textarea id="adminInquiryAnswer" rows="7" maxlength="5000">${escapeHtml(x.answer||'')}</textarea></label><button id="adminInquiryAnswerBtn" class="primary-btn">답변 저장</button>`;$('adminInquiryList').classList.add('hidden');box.classList.remove('hidden');$('adminInquiryBack').onclick=()=>{box.classList.add('hidden');$('adminInquiryList').classList.remove('hidden');loadAdminInquiries()};$('adminInquiryAnswerBtn').onclick=()=>saveAdminInquiryAnswer(id)}catch{toast('문의 내용을 열 수 없습니다.')}}
async function saveAdminInquiryAnswer(id){const answer=$('adminInquiryAnswer').value.trim();if(answer.length<2)return toast('답변 내용을 입력해 주세요.');try{const r=await authFetch('/api/inquiries',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id,answer})});if(!r.ok)throw new Error();showPlaceConfirmPopup('1:1 문의 답변이 등록되었습니다.');openAdminInquiry(id)}catch{toast('답변 저장에 실패했습니다.')}}

/* ---------- 1:1 INQUIRY ---------- */
async function inquiryRequest(method='GET',body=null,id=null){
  if(!state.firebase.user)throw new Error('LOGIN_REQUIRED');
  const token=await firebaseIdToken();if(!token)throw new Error('LOGIN_REQUIRED');
  const u=new URL('/api/inquiries',location.origin);if(id)u.searchParams.set('id',String(id));
  const opt={method,headers:{'content-type':'application/json','authorization':`Bearer ${token}`}};if(body)opt.body=JSON.stringify(body);
  const r=await fetch(u,opt),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`inquiry HTTP ${r.status}`);return d;
}
function inquiryStatusLabel(v){return v==='answered'?'답변완료':'접수완료'}
function renderInquiryList(items=[]){
  const box=$('inquiryList');if(!box)return;state.inquiries=items;
  if(!items.length){box.innerHTML='<div class="inquiry-empty">작성한 문의가 없습니다.</div>';return}
  box.innerHTML=items.map(x=>`<button class="inquiry-row" data-inquiry-id="${escapeHtml(x.id)}"><span><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.createdAt||'')}</small></span><em class="${x.status==='answered'?'answered':''}">${inquiryStatusLabel(x.status)}</em></button>`).join('');
  box.querySelectorAll('[data-inquiry-id]').forEach(b=>b.onclick=()=>openInquiryDetail(b.dataset.inquiryId));
}
async function loadMyInquiries(){try{const d=await inquiryRequest('GET');renderInquiryList(d.items||[])}catch(e){if(e.message==='LOGIN_REQUIRED')return;toast('문의 목록을 불러오지 못했습니다.',2200)}}
function openInquiryModal(){
  if(!state.firebase.user){closeHamburgerMenu();openMy();toast('1:1 문의는 Google 로그인 후 이용할 수 있습니다.',3000);return}
  $('inquiryModal')?.classList.remove('hidden');$('inquiryCompose')?.classList.add('hidden');$('inquiryDetail')?.classList.add('hidden');$('inquiryListWrap')?.classList.remove('hidden');loadMyInquiries();
}
function closeInquiryModal(){$('inquiryModal')?.classList.add('hidden')}
function startInquiryCompose(){$('inquiryTitle').value='';$('inquiryBody').value='';$('inquiryListWrap').classList.add('hidden');$('inquiryDetail').classList.add('hidden');$('inquiryCompose').classList.remove('hidden');setTimeout(()=>$('inquiryTitle')?.focus(),80)}
function backInquiryList(){$('inquiryCompose').classList.add('hidden');$('inquiryDetail').classList.add('hidden');$('inquiryListWrap').classList.remove('hidden');loadMyInquiries()}
async function submitInquiry(){
  const title=$('inquiryTitle').value.trim(),body=$('inquiryBody').value.trim();if(title.length<2)return toast('문의 제목을 입력해 주세요.');if(body.length<5)return toast('문의 내용을 5자 이상 입력해 주세요.');
  const btn=$('inquirySubmitBtn');btn.disabled=true;btn.textContent='등록 중...';
  try{await inquiryRequest('POST',{title,body});showPlaceConfirmPopup('1:1 문의가 등록되었습니다.');backInquiryList()}catch(e){toast(e.message==='LOGIN_REQUIRED'?'로그인이 필요합니다.':'문의 등록에 실패했습니다.',2800)}finally{btn.disabled=false;btn.textContent='문의 등록'}
}
async function openInquiryDetail(id){
  try{const d=await inquiryRequest('GET',null,id),x=d.item;if(!x)return;const box=$('inquiryDetail');box.innerHTML=`<button id="inquiryDetailBack" class="inquiry-back">← 목록</button><h3>${escapeHtml(x.title)}</h3><div class="inquiry-meta"><span>${escapeHtml(x.createdAt||'')}</span><b>${inquiryStatusLabel(x.status)}</b></div><section><b>문의 내용</b><p>${escapeHtml(x.body).replace(/\n/g,'<br>')}</p></section>${x.answer?`<section class="answer"><b>답변</b><p>${escapeHtml(x.answer).replace(/\n/g,'<br>')}</p></section>`:''}`;$('inquiryListWrap').classList.add('hidden');$('inquiryCompose').classList.add('hidden');box.classList.remove('hidden');$('inquiryDetailBack').onclick=backInquiryList;
  }catch{toast('문의 내용을 열 수 없습니다.',2200)}
}


function setHomeSheetCollapsed(collapsed){
  state.homeSheetCollapsed=Boolean(collapsed);
  const sheet=$('homeSheet'),btn=$('homeSheetToggle'),home=$('homeView');
  sheet?.classList.toggle('collapsed',state.homeSheetCollapsed);
  home?.classList.toggle('map-expanded',state.homeSheetCollapsed);
  sheet?.style.removeProperty('--home-sheet-drag-y');
  if(btn){
    btn.setAttribute('aria-expanded',String(!state.homeSheetCollapsed));
    btn.setAttribute('aria-label',state.homeSheetCollapsed?'홈 메뉴 올리기':'홈 메뉴 내리기');
    const span=btn.querySelector('span');if(span)span.textContent='−';
  }
  if(state.map)setTimeout(()=>{try{state.map.resize();scheduleLocalVoucherRefresh();scheduleHomeCameraRefresh()}catch{}},180);
}
function toggleHomeSheet(){setHomeSheetCollapsed(!state.homeSheetCollapsed)}

function openHamburgerMenu(){
  const modal=$('hamburgerMenuModal'),sheet=modal?.querySelector('.hamburger-sheet');
  modal?.classList.remove('hidden');
  if(sheet){
    sheet.style.overflowY='scroll';
    sheet.style.webkitOverflowScrolling='touch';
    requestAnimationFrame(()=>{try{sheet.scrollTop=0}catch{}});
  }
}
function closeHamburgerMenu(){$('hamburgerMenuModal')?.classList.add('hidden')}
function openDestinationManager(){
  closeHamburgerMenu();openInfoModal('집·회사 위치 관리',`<div class="menu-choice-grid"><button id="manageHomeFromMenu"><b>집 위치 관리</b><small>${escapeHtml(state.savedPlaces.home?.name||'등록된 집 없음')}</small></button><button id="manageWorkFromMenu"><b>회사 위치 관리</b><small>${escapeHtml(state.savedPlaces.work?.name||'등록된 회사 없음')}</small></button></div>`);
  $('manageHomeFromMenu').onclick=()=>{closeInfoModal();openPlaceModal('home')};$('manageWorkFromMenu').onclick=()=>{closeInfoModal();openPlaceModal('work')};
}
function openRecentDestinationAll(){closeHamburgerMenu();const items=state.recentDestinations||[];const html=items.length?`<div class="recent-all-toolbar"><span>총 ${items.length}건</span><button type="button" id="clearRecentDestinationsBtn" class="danger-text-btn">전체 삭제</button></div><div class="favorite-list">${items.map((x,i)=>`<article class="favorite-list-item"><div><b>${escapeHtml(x.name||'목적지')}</b><small>${escapeHtml(x.address||'')}</small></div><div class="favorite-item-actions"><button data-recent-go="${i}">길찾기</button><button data-recent-delete-all="${i}" class="danger">삭제</button></div></article>`).join('')}</div>`:'<div class="empty-info">최근 목적지가 없습니다.</div>';openInfoModal('최근 목적지 전체보기',html);document.querySelectorAll('[data-recent-go]').forEach(b=>b.onclick=()=>{const p=items[Number(b.dataset.recentGo)];closeInfoModal();if(p)chooseDestination(p)});document.querySelectorAll('[data-recent-delete-all]').forEach(b=>b.onclick=async()=>{await deleteRecentDestinationAt(Number(b.dataset.recentDeleteAll),items);openRecentDestinationAll()});const clear=$('clearRecentDestinationsBtn');if(clear)clear.onclick=clearRecentDestinations}
function openTrafficDetail(){closeHamburgerMenu();const seg=(state.route?.roadSegments||[]).find(s=>state.currentRouteIndex>=Number(s.startIndex||0)&&state.currentRouteIndex<=Number(s.endIndex||0));const info=trafficClassFromValues(seg?.trafficSpeed,seg?.trafficState);openInfoModal('실시간 교통정보 상세',`<div class="info-card"><h3>${escapeHtml(info.label)}</h3><p>${seg?.name?`현재 구간: <b>${escapeHtml(seg.name)}</b>`:'주행 중 경로를 선택하면 현재 구간 교통상태가 표시됩니다.'}</p><p>${Number(seg?.trafficSpeed)>0?`평균 통행속도 약 <b>${Math.round(Number(seg.trafficSpeed))}km/h</b>`:'현재 제공되는 평균속도 정보가 없습니다.'}</p></div>`)}
function openRoutePrioritySettings(){closeHamburgerMenu();renderUserSettingsUI();$('routePriorityModal')?.classList.remove('hidden')}
function openCameraAlertSettings(){closeHamburgerMenu();renderUserSettingsUI();$('cameraAlertModal')?.classList.remove('hidden')}
function openSupportTerms(){closeHamburgerMenu();openInquiryModal()}
function openWaypointSaved(){
  closeHamburgerMenu();
  loadSavedWaypointCourses();
  const items=(state.savedWaypointCourses||[]).filter(x=>x&&x.id&&x.destination);
  const html=items.length
    ?`<div class="saved-waypoint-modal-list">${items.map(x=>{
      const waypoints=(x.waypoints||[]).filter(pointValid);
      const routeText=[...(waypoints.map(p=>p.name||'경유지')),x.destination?.name||'목적지'].join(' → ');
      return `<div class="saved-course-row saved-course-modal-row">
        <button type="button" data-menu-course-use="${escapeHtml(x.id)}">
          <span data-icon="routes"></span>
          <span><b>${escapeHtml(x.name||routeText||'저장 코스')}</b><small>${waypoints.length}개 경유 · ${escapeHtml(routeText)}</small></span>
        </button>
        <button type="button" class="saved-course-delete" data-menu-course-delete="${escapeHtml(x.id)}">삭제</button>
      </div>`
    }).join('')}</div>`
    :'<div class="empty-info">저장된 경유지 코스가 없습니다.</div>';
  openInfoModal('경유지 코스 저장함',html);
  const box=$('infoModalBody');
  box?.querySelectorAll('[data-menu-course-use]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.menuCourseUse;closeInfoModal();await useSavedWaypointCourse(id);
  });
  box?.querySelectorAll('[data-menu-course-delete]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();deleteSavedWaypointCourse(b.dataset.menuCourseDelete);openWaypointSaved();
  });
}
async function openAppPrivacy(){const c=await loadPublicContent();openInfoModal('앱정보 / 개인정보처리방침',`<div class="info-card privacy-copy"><h3>단골로 내비</h3><p>${escapeHtml(c.appInfo||'앱정보가 준비 중입니다.').replace(/\n/g,'<br>')}</p><hr><p>${escapeHtml(c.privacy||'개인정보처리방침이 준비 중입니다.').replace(/\n/g,'<br>')}</p></div>`)}
// v7.6.27.37 — 다른경로: 목적지 유지, 실제 현위치 출발 3가지 경로를 비교한다.
let dangolloAlternateToken=0;
const DANGOLLO_ALTERNATE_SPECS=[
  {kind:'recommend',label:'추천',priority:'RECOMMEND',avoid:null},
  {kind:'fast',label:'빠른길',priority:'TIME',avoid:null},
  {kind:'free',label:'무료도로',priority:'RECOMMEND',avoid:'toll'}
];
function closeDriveAlternateRoutes(){
  dangolloAlternateToken++;
  $('driveAlternateModal')?.classList.add('hidden');
}
async function openDriveAlternateRoutes(){
  if(!state.destination||!state.route)return toast('목적지와 경로를 먼저 설정해 주세요.');
  if(state.simulationActive)return toast('모의주행을 종료한 후 경로를 변경해 주세요.');
  const modal=$('driveAlternateModal'),list=$('driveAlternateChoices'),status=$('driveAlternateStatus');
  if(!modal||!list||!status)return;
  const token=++dangolloAlternateToken;
  modal.classList.remove('hidden');
  const real=state.lastRawFix;
  const usable=real&&pointValid(real)&&Date.now()-Number(real.at||0)<30000;
  const origin=usable?{lat:Number(real.lat),lng:Number(real.lng),heading:Number(state.user?.heading)||null}:currentOriginPoint();
  if(!pointValid(origin)){
    status.textContent='현재 GPS 위치를 확인하지 못했습니다. 위치 수신 후 다시 시도해 주세요.';
    list.innerHTML='';return;
  }
  status.textContent='추천·빠른길·무료도로를 동시에 조회하고 있습니다.';
  list.innerHTML='';
  const results=new Map();
  const destinationKey=`${state.destination.lat}:${state.destination.lng}`;
  function render(){
    if(token!==dangolloAlternateToken)return;
    list.innerHTML='';
    for(const spec of DANGOLLO_ALTERNATE_SPECS){
      const result=results.get(spec.kind);
      const btn=document.createElement('button');btn.type='button';btn.className='dangollo-alt-choice';
      const left=document.createElement('span');left.className='dangollo-alt-choice-label';left.textContent=spec.label;
      const right=document.createElement('span');right.className='dangollo-alt-choice-detail';
      if(result?.geometry?.length){
        const fare=Number(result.fare?.toll)||0;
        right.textContent=`${mins(result.duration)} · ${km(result.distance)} · ${fare?fare.toLocaleString()+'원':'통행료 0원'}`;
        btn.onclick=()=>{
          if(token!==dangolloAlternateToken||!state.tripStartedAt||!state.destination||`${state.destination.lat}:${state.destination.lng}`!==destinationKey)return;
          // 타 경로 선택이 승인된 경우에만 주행 경로 교체.
          state.route={...result,_label:spec.label,_class:spec.kind==='recommend'?'':spec.kind,_character:state.character};
          state.routePreference=spec.kind;
          state.routeOptions=[state.route];
          state.selectedRoute=0;
          state.routeOriginUsed={lat:origin.lat,lng:origin.lng};
          closeDriveAlternateRoutes();
          resumeNavigationWithSelectedRoute();
        };
      }else{
        right.textContent=result===false?'조회 실패':'조회 중…';btn.disabled=true;
      }
      btn.append(left,right);list.append(btn);
    }
  }
  render();
  await Promise.allSettled(DANGOLLO_ALTERNATE_SPECS.map(async spec=>{
    try{
      const rr=await routeRequest(spec.priority,spec.avoid,null,'car',origin);
      if(token!==dangolloAlternateToken)return;
      results.set(spec.kind,rr?.geometry?.length?rr:false);
    }catch(err){console.warn('[다른경로]',spec.label,err);results.set(spec.kind,false)}
    if(token!==dangolloAlternateToken)return;
    render();
    const count=[...results.values()].filter(x=>x?.geometry?.length).length;
    status.textContent=count?`${count}개 경로가 준비되었습니다. 원하는 경로를 선택하세요.`:'경로 계산 중입니다.';
  }));
  if(token===dangolloAlternateToken&&!([...results.values()].some(x=>x?.geometry?.length)))status.textContent='경로를 조회하지 못했습니다. 네트워크·위치 상태를 확인하고 다시 시도해 주세요.';
}
function openDriveMenu(){$('driveMenu').classList.remove('hidden')}
function closeDriveMenu(){$('driveMenu').classList.add('hidden')}
function openMy(){closeBottomPanels('my');$('myModal').classList.remove('hidden');renderProfile();syncCharacterUI();updateVolumeUI();updateTripHistorySummary()}
function closeMy(){$('myModal').classList.add('hidden')}
function toggleSettingPanel(buttonId,panelId){const btn=$(buttonId),panel=$(panelId),open=panel.classList.contains('hidden');panel.classList.toggle('hidden',!open);btn.setAttribute('aria-expanded',String(open));if(open)setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50)}
async function shareArrival(){if(!state.destination)return;const text=`'${state.destination.name}' 이동 중입니다. 예상 도착 ${$('arrivalTime').textContent.replace('도착 ','')}`;try{if(navigator.share)await navigator.share({title:'단골로 내비',text});else await navigator.clipboard.writeText(text),toast('도착 정보를 복사했습니다.')}catch{}}

let criticalUiBound=false;
function bindCriticalUI(){
  if(criticalUiBound)return;criticalUiBound=true;
  // 안내 종료는 다른 UI 바인딩 오류와 무관하게 항상 동작하도록 캡처 단계에서 독립 처리한다.
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#endNavBtn');if(!btn)return;
    e.preventDefault();e.stopPropagation();stopNavigation();
  },true);
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#driveMenuBtn');if(!btn)return;
    if(typeof btn.onclick==='function')return; // 일반 버튼 바인딩이 있으면 캡처 예비 처리 중지
    if(!$('driveMenu')?.classList.contains('hidden'))return;
    try{openDriveMenu()}catch(err){console.warn('drive menu open failed',err)}
  },true);

  // 안내 시작 버튼은 다른 bindUI 섹션의 오류와 무관하게 캡처 단계에서 항상 처리한다.
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#startBtn');if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(btn.disabled)return;
    Promise.resolve(startRouteGuidanceNow()).catch(err=>{
      console.warn('critical start button failed',err);
      toast('안내 시작을 다시 눌러 주세요.',1800);
    });
  },true);
}


let homeCriticalBound=false;
function bindHomeCriticalUI(){
  if(homeCriticalBound)return;
  homeCriticalBound=true;
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#homeShortcut,#workShortcut,#favoriteShortcut,#homeManageBtn,#workManageBtn,[data-recent-index],.home-facility-item,#searchBtn');
    if(!btn)return;
    try{
      if(btn.id==='homeShortcut'){
        e.preventDefault();e.stopPropagation();
        state.savedPlaces.home?chooseDestination(state.savedPlaces.home,{autoGuide:true}):openPlaceModal('home');
      }else if(btn.id==='workShortcut'){
        e.preventDefault();e.stopPropagation();
        state.savedPlaces.work?chooseDestination(state.savedPlaces.work,{autoGuide:true}):openPlaceModal('work');
      }else if(btn.id==='favoriteShortcut'){
        e.preventDefault();e.stopPropagation();openFavoritesList();
      }else if(btn.id==='homeManageBtn'){
        e.preventDefault();e.stopPropagation();openPlaceModal('home');
      }else if(btn.id==='workManageBtn'){
        e.preventDefault();e.stopPropagation();openPlaceModal('work');
      }else if(btn.id==='searchBtn'){
        e.preventDefault();e.stopPropagation();aiTripSearchFromHome();
      }
    }catch(err){console.warn('home critical click failed',err)}
  },true);
}
function bindUI(){
  try{bindFutureDepartureUI();}catch(e){console.warn('UI bind section 1 failed',e)}
  try{$('allowLocationBtn').onclick=requestLocationPermission;$('allowCameraBtn').onclick=requestCameraPermission;$('permissionContinueBtn').onclick=closePermissionGate;}catch(e){console.warn('UI bind section 2 failed',e)}
  try{if($('homeSheetToggle'))$('homeSheetToggle').onclick=toggleHomeSheet;if($('mapPlacePromptCancel'))$('mapPlacePromptCancel').onclick=cancelMapPlacePreview;if($('mapPlacePromptGo'))$('mapPlacePromptGo').onclick=startMapPlaceNavigation;if($('voucherBuildingClose'))$('voucherBuildingClose').onclick=closeVoucherBuildingModal;window.addEventListener('online',()=>{state.localVoucherRetryCount=0;loadLocalVoucherMap({force:true})});if($('voucherBuildingModal'))$('voucherBuildingModal').addEventListener('click',e=>{if(e.target===$('voucherBuildingModal'))closeVoucherBuildingModal()});applyIcons();if($('homeAiMicBtn'))$('homeAiMicBtn').onclick=homeAiVoiceSearch;if($('homeAiExampleBtn'))$('homeAiExampleBtn').onclick=()=>{if($('destinationInput'))$('destinationInput').value='세종시청 가는 길에 온누리 식당 5분 이내';return aiTripSearchFromHome({fromExample:true})};$('searchBtn').onclick=aiTripSearchFromHome;if($('homeAiRecentBtn'))$('homeAiRecentBtn').onclick=aiTripApplyRecent;aiTripRefreshRecent();$('destinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')aiTripSearchFromHome()});document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>searchPlaces(b.dataset.query));}catch(e){console.warn('UI bind section 3 failed',e)}
  try{document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>setCharacter(b.dataset.character));$('homeShortcut').onclick=()=>state.savedPlaces.home?chooseDestination(state.savedPlaces.home):openPlaceModal('home');$('workShortcut').onclick=()=>state.savedPlaces.work?chooseDestination(state.savedPlaces.work):openPlaceModal('work');$('homeManageBtn').onclick=()=>openPlaceModal('home');$('workManageBtn').onclick=()=>openPlaceModal('work');$('favoriteShortcut').onclick=openFavoritesList;}catch(e){console.warn('UI bind section 4 failed',e)}
  try{document.querySelectorAll('[data-my-character]').forEach(b=>b.onclick=()=>{setCharacter(b.dataset.myCharacter);syncCharacterUI();toast(`${characterDefs[state.character].name} 가이드로 변경했습니다.`)});}catch(e){console.warn('UI bind section 5 failed',e)}
  try{document.querySelectorAll('[data-voice-character]').forEach(b=>b.onclick=()=>{setCharacter(b.dataset.voiceCharacter);syncCharacterUI();speak(`${characterDefs[state.character].name} 음성 안내입니다.`)});}catch(e){console.warn('UI bind section 6 failed',e)}
  try{$('voiceGuideSettingBtn').onclick=()=>{const opening=$('voiceGuidePanel').classList.contains('hidden');$('voiceGuidePanel').classList.toggle('hidden',!opening);$('characterSettingPanel').classList.toggle('hidden',!opening);$('voiceGuideSettingBtn').setAttribute('aria-expanded',String(opening))};$('voicePreviewBtn').onclick=()=>speak(`${characterDefs[state.character].name}이 길안내를 시작합니다. 안전운전하세요.`);}catch(e){console.warn('UI bind section 7 failed',e)}
  try{document.querySelectorAll('[data-route-mode]').forEach(b=>b.onclick=()=>selectTravelMode(b.dataset.routeMode));document.querySelectorAll('[data-home-facility]').forEach(b=>b.onclick=()=>loadHomeFacility(b.dataset.homeFacility));}catch(e){console.warn('route mode/facility bind failed',e)}
  try{$('menuBtn').onclick=openHamburgerMenu;$('myBtn').onclick=openMy;$('routeBackBtn').onclick=()=>{cancelAutoStart();setView('home')};$('routeFavoriteBtn').onclick=toggleFavorite;$('startBtn').onclick=startRouteGuidanceNow;if($('routeFutureDepartureBtn'))$('routeFutureDepartureBtn').onclick=()=>{cancelAutoStart();openFutureDeparture()};if($('postDriveFavoriteAddBtn'))$('postDriveFavoriteAddBtn').onclick=confirmPostDriveFavorite;if($('postDriveFavoriteSkipBtn'))$('postDriveFavoriteSkipBtn').onclick=closePostDriveFavoritePrompt;if($('postDriveFavoriteModal'))$('postDriveFavoriteModal').addEventListener('click',e=>{if(e.target===$('postDriveFavoriteModal'))closePostDriveFavoritePrompt()});if($('routeOriginBtn'))$('routeOriginBtn').onclick=openOriginModal;else $('routeAddressOrigin')?.addEventListener('click',openOriginModal);}catch(e){console.warn('UI bind section 8 failed',e)}
  
  try{
    document.addEventListener('click',e=>{
      const btn=e.target.closest?.('#routeSwapEndpointsBtn,#routeAddWaypointBtn');
      if(!btn)return;
      e.preventDefault();e.stopPropagation();
      if(btn.id==='routeSwapEndpointsBtn')swapRouteEndpoints();
      if(btn.id==='routeAddWaypointBtn')openWaypointSearch();
    },true);
  }catch(e){console.warn('route endpoint action bind failed',e)}

  try{
    if($('fuelRefreshBtn'))$('fuelRefreshBtn').onclick=()=>loadFuelPrices(state.fuelProduct,{manual:true});
    document.querySelectorAll('[data-fuel-product]').forEach(b=>b.onclick=()=>loadFuelPrices(b.dataset.fuelProduct));
    document.querySelectorAll('[data-fuel-modal-product]').forEach(b=>b.onclick=()=>loadFuelPrices(b.dataset.fuelModalProduct,{modal:true}));
    if($('driveFuelChip'))$('driveFuelChip').onclick=openFuelModal;
    if($('driveRecommendBtn'))$('driveRecommendBtn').onclick=()=>openDrivePoiPanel(state.drivePoiTab||'local');
    if($('drivePoiPanelClose'))$('drivePoiPanelClose').onclick=closeDrivePoiPanel;
    if($('drivePoiPanel'))$('drivePoiPanel').addEventListener('click',e=>{if(e.target===$('drivePoiPanel'))closeDrivePoiPanel()});
    document.querySelectorAll('[data-drive-poi-tab]').forEach(btn=>btn.onclick=()=>{state.drivePoiTab=btn.dataset.drivePoiTab;renderDrivePoiPanel();calculateDrivePoiRoadDistances(state.drivePoiTab).catch(()=>{})});
    document.querySelectorAll('[data-drive-poi-card]').forEach(btn=>btn.onclick=()=>openDrivePoiPanel(btn.dataset.drivePoiCard));
    if($('fuelModalClose'))$('fuelModalClose').onclick=closeFuelModal;
    if($('fuelModal'))$('fuelModal').addEventListener('click',e=>{if(e.target===$('fuelModal'))closeFuelModal()});
  }catch(e){console.warn('fuel UI bind failed',e)}
  try{$('driveMenuBtn').onclick=openDriveMenu;$('driveRefreshBtn').onclick=recenterAndCheckFastRoute;$('mapCompassBtn').onclick=resetDriveCompass;$('map3dBtn').onclick=e=>{e.stopPropagation();state.map3D=!state.map3D;applyDriveMapMode();toggleMapControls(true)};$('mapSatelliteBtn').onclick=e=>{e.stopPropagation();toggleMapSatellite();toggleMapControls(true)};$('mapZoomInBtn').onclick=e=>{e.stopPropagation();state.map?.zoomIn({duration:180});toggleMapControls(true)};$('mapZoomOutBtn').onclick=e=>{e.stopPropagation();state.map?.zoomOut({duration:180});toggleMapControls(true)};$('driveView').addEventListener('click',e=>{if(e.target.closest('button,input,.maneuver-stack,.drive-bottom-card,.safety-alert,.traffic-status,.vms-banner,.lane-assist-layer'))return;toggleMapControls(true)});if($('driveVoiceBtn'))$('driveVoiceBtn').onclick=startVoiceCommand;if($('driveRadioBtn'))$('driveRadioBtn').onclick=toggleRadio;if($('arOpenBtn'))$('arOpenBtn').onclick=startVoiceCommand;if($('driveArBtn'))$('driveArBtn').onclick=()=>{closeDriveMenu();startVoiceCommand()};$('routeInfoBtn').onclick=openRouteInfo;/* simulation controls are bound once by bindDangolloSimulationControls() */$('driveSearchBtn').onclick=openDriveSearch;$('routeInfoClose').onclick=closeRouteInfo;$('routeInfoModal').addEventListener('click',e=>{if(e.target===$('routeInfoModal'))closeRouteInfo()});$('driveSearchClose').onclick=closeDriveSearch;$('driveSearchSubmit').onclick=()=>searchDriveDestinations($('driveSearchInput').value);$('driveSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchDriveDestinations(e.target.value)});$('driveSearchModal').addEventListener('click',e=>{if(e.target===$('driveSearchModal'))closeDriveSearch()});document.querySelector('.bottom-modal-backdrop').onclick=closeDriveMenu;$('otherRouteBtn').onclick=()=>{closeDriveMenu();openDriveAlternateRoutes()};$('driveAlternateClose')?.addEventListener('click',closeDriveAlternateRoutes);$('driveAlternateModal')?.addEventListener('click',e=>{if(e.target===$('driveAlternateModal'))closeDriveAlternateRoutes()});$('driveSettingBtn').onclick=()=>{closeDriveMenu();openMy()};$('shareBtn').onclick=shareArrival;$('endNavBtn').onclick=stopNavigation;}catch(e){console.warn('UI bind section 9 failed',e)}
  try{$('guideVolume').oninput=e=>changeVolume(e.target.value);if($('radioVolume'))$('radioVolume').oninput=e=>setRadioVolume(Number(e.target.value)/100,true);$('myGuideVolume').oninput=e=>changeVolume(e.target.value);$('myCloseBtn').onclick=closeMy;$('myModal').addEventListener('click',e=>{if(e.target===$('myModal'))closeMy()});$('googleLoginBtn').onclick=loginGoogle;$('logoutBtn').onclick=logout;$('myFavoritesBtn').onclick=openFavoritesList;$('tripHistoryBtn').onclick=openTripHistory;$('noticeBtn').onclick=openNotices;if($('appPrivacyBtn'))$('appPrivacyBtn').onclick=openAppPrivacy;if($('permissionSettingBtn'))$('permissionSettingBtn').onclick=()=>toggleSettingPanel('permissionSettingBtn','permissionSettingPanel');if($('locationConsentToggle'))$('locationConsentToggle').onchange=e=>setPermissionPreference('location',e.target.checked);if($('cameraConsentToggle'))$('cameraConsentToggle').onchange=e=>setPermissionPreference('camera',e.target.checked);$('infoModalClose').onclick=closeInfoModal;$('infoModal').addEventListener('click',e=>{if(e.target===$('infoModal'))closeInfoModal()});}catch(e){console.warn('UI bind section 10 failed',e)}
  try{if($('hamburgerCloseBtn'))$('hamburgerCloseBtn').onclick=closeHamburgerMenu;if($('hamburgerMenuModal'))$('hamburgerMenuModal').addEventListener('click',e=>{if(e.target===$('hamburgerMenuModal'))closeHamburgerMenu()});}catch(e){console.warn('UI bind section 11 failed',e)}
  try{if($('hambPlaceManageBtn'))$('hambPlaceManageBtn').onclick=openDestinationManager;if($('hambRecentBtn'))$('hambRecentBtn').onclick=openRecentDestinationAll;if($('hambWaypointBtn'))$('hambWaypointBtn').onclick=openWaypointSaved;if($('hambTrafficBtn'))$('hambTrafficBtn').onclick=openTrafficDetail;if($('hambRoutePriorityBtn'))$('hambRoutePriorityBtn').onclick=openRoutePrioritySettings;if($('hambCameraSettingsBtn'))$('hambCameraSettingsBtn').onclick=openCameraAlertSettings;if($('hambSupportBtn'))$('hambSupportBtn').onclick=openSupportTerms;}catch(e){console.warn('UI bind section 12 failed',e)}
  try{if($('routePriorityClose'))$('routePriorityClose').onclick=()=>$('routePriorityModal').classList.add('hidden');document.querySelectorAll('[data-route-pref]').forEach(b=>b.onclick=()=>chooseRoutePreference(b.dataset.routePref));}catch(e){console.warn('UI bind section 13 failed',e)}
  try{if($('cameraAlertClose'))$('cameraAlertClose').onclick=()=>$('cameraAlertModal').classList.add('hidden');if($('speedCameraAlertToggle'))$('speedCameraAlertToggle').onchange=e=>updateCameraAlertSetting('speed',e.target.checked);if($('signalCameraAlertToggle'))$('signalCameraAlertToggle').onchange=e=>updateCameraAlertSetting('signal',e.target.checked);}catch(e){console.warn('UI bind section 14 failed',e)}
  try{if($('inquiryCloseBtn'))$('inquiryCloseBtn').onclick=closeInquiryModal;if($('newInquiryBtn'))$('newInquiryBtn').onclick=startInquiryCompose;if($('inquiryComposeBack'))$('inquiryComposeBack').onclick=backInquiryList;if($('inquirySubmitBtn'))$('inquirySubmitBtn').onclick=submitInquiry;}catch(e){console.warn('UI bind section 15 failed',e)}
  try{if($('adminModeBtn'))$('adminModeBtn').onclick=openAdminMode;if($('adminCloseBtn'))$('adminCloseBtn').onclick=closeAdminMode;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>switchAdminTab(b.dataset.adminTab));if($('adminNoticeSaveBtn'))$('adminNoticeSaveBtn').onclick=saveAdminNotice;if($('adminContentSaveBtn'))$('adminContentSaveBtn').onclick=saveAdminContent;if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').onclick=startOnnuriBatch;if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').onclick=stopOnnuriBatch;if($('onnuriBatchResetBtn'))$('onnuriBatchResetBtn').onclick=resetOnnuriLegacyProgress;if($('adminShortsSaveBtn'))$('adminShortsSaveBtn').onclick=saveAdminShortsSettings;if($('adminShortsRefreshBtn'))$('adminShortsRefreshBtn').onclick=refreshAdminShortsNow;}catch(e){console.warn('UI bind section 16 failed',e)}
  try{if($('komscoShortsMyBtn'))$('komscoShortsMyBtn').onclick=openKomscoShortsList;if($('komscoShortsListClose'))$('komscoShortsListClose').onclick=closeKomscoShortsList;if($('komscoShortsListModal'))$('komscoShortsListModal').addEventListener('click',e=>{if(e.target===$('komscoShortsListModal'))closeKomscoShortsList()});if($('komscoShortClose'))$('komscoShortClose').onclick=closeKomscoShort;if($('komscoShortMuteBtn'))$('komscoShortMuteBtn').onclick=toggleKomscoMute;if($('komscoShortModal'))$('komscoShortModal').addEventListener('click',e=>{if(e.target===$('komscoShortModal'))closeKomscoShort()});}catch(e){console.warn('UI bind section 17 failed',e)}
  try{if($('waypointSearchClose'))$('waypointSearchClose').onclick=()=>closeWaypointSearch(true);if($('waypointSearchSubmit'))$('waypointSearchSubmit').onclick=()=>searchWaypointPlaces($('waypointSearchInput').value);if($('waypointSearchInput'))$('waypointSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchWaypointPlaces(e.target.value)});if($('waypointSearchModal'))$('waypointSearchModal').addEventListener('click',e=>{if(e.target===$('waypointSearchModal'))closeWaypointSearch(true)});if($('drivePlaceChoiceClose'))$('drivePlaceChoiceClose').onclick=closeDrivePlaceChoice;if($('drivePlaceAsWaypoint'))$('drivePlaceAsWaypoint').onclick=()=>applyDrivePlaceChoice('waypoint');if($('drivePlaceAsDestination'))$('drivePlaceAsDestination').onclick=()=>applyDrivePlaceChoice('destination');if($('drivePlaceChoiceModal'))$('drivePlaceChoiceModal').addEventListener('click',e=>{if(e.target===$('drivePlaceChoiceModal'))closeDrivePlaceChoice()});}catch(e){console.warn('UI bind section waypoint/permission failed',e)}
  try{$('originModalClose').onclick=closeOriginModal;$('useCurrentOriginBtn').onclick=useCurrentOrigin;$('originSearchBtn').onclick=()=>searchOrigins($('originSearchInput').value);$('originSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchOrigins(e.target.value)});$('originModal').addEventListener('click',e=>{if(e.target===$('originModal'))closeOriginModal()});$('arCloseBtn').onclick=stopAR;document.querySelectorAll('[data-bottom-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.bottomNav;closeBottomPanels(nav);if(nav==='home'){cancelAutoStart();setView('home')}else if(nav==='where'){setView('home');openWhereTo()}else if(nav==='saved'){setView('home');openSavedPlaces()}else if(nav==='my')openMy()});$('placeModalClose').onclick=()=>$('placeModal').classList.add('hidden');if($('useCurrentPlaceBtn'))$('useCurrentPlaceBtn').onclick=saveCurrentLocationAsPlace;if($('placeSaveBtn'))$('placeSaveBtn').onclick=confirmRegisteredPlace;if($('whereToClose'))$('whereToClose').onclick=closeWhereTo;
if($('whereToRefresh'))$('whereToRefresh').onclick=refreshWhereTo;
if($('whereToHotspotBtn'))$('whereToHotspotBtn').onclick=()=>{closeWhereTo();hotspotOpen()};
if($('whereToModal'))$('whereToModal').addEventListener('click',e=>{if(e.target===$('whereToModal'))closeWhereTo()});
document.querySelectorAll('[data-where-tab]').forEach(b=>b.onclick=()=>{wherePageLimit=10;state.whereToTab=b.dataset.whereTab;renderWhereToList();refreshWhereTo()});
if($('savedPlacesClose'))$('savedPlacesClose').onclick=closeSavedPlaces;
if($('savedPlacesModal'))$('savedPlacesModal').addEventListener('click',e=>{if(e.target===$('savedPlacesModal'))closeSavedPlaces()});
if($('savedGroupAddBtn'))$('savedGroupAddBtn').onclick=addSavedGroup;
if($('savedGroupNameInput'))$('savedGroupNameInput').addEventListener('keydown',e=>{if(e.key==='Enter')addSavedGroup()});
if($('placeDeleteBtn'))$('placeDeleteBtn').onclick=deleteRegisteredPlace;$('placeSearchBtn').onclick=()=>searchPlaces($('placeSearchInput').value,'placeSearchResults');$('placeSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value,'placeSearchResults')});$('placeModal').addEventListener('click',e=>{if(e.target===$('placeModal'))$('placeModal').classList.add('hidden')});}catch(e){console.warn('UI bind section 17 failed',e)}
}

window.addEventListener('orientationchange',()=>setTimeout(()=>{tryLandscapeFullscreen();ensureDriveCharacterAfterViewportChange()},220));window.addEventListener('resize',()=>{applyNightMode();if(state.map)setTimeout(()=>{state.map.resize();ensureDriveCharacterAfterViewportChange()},100)});document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyNightMode();if(state.tripStartedAt){acquireNavigationWakeLock();liveRouteRefresh()}}});
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{
  try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}catch(e){console.warn('service worker cleanup failed',e)}
  try{if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('jofams-navi-')).map(k=>caches.delete(k)))}}catch(e){console.warn('cache cleanup failed',e)}
});
function dangolloAfterFirstPaint(fn,delay=1000){
  const schedule=()=>{if('requestIdleCallback' in window)requestIdleCallback(()=>void fn(),{timeout:delay+1800});else setTimeout(()=>void fn(),delay)};
  requestAnimationFrame(()=>requestAnimationFrame(schedule));
}
let dangolloBootstrapped=false;
function bootstrapApp(){
  if(dangolloBootstrapped)return;
  dangolloBootstrapped=true;
  try{applyIcons()}catch(e){console.warn('applyIcons failed',e)}
  try{initRouteAiCompare()}catch(e){console.warn('AI route compare init failed',e)}
  try{initDriveAiRecommendation()}catch(e){console.warn('Workers AI UI init failed',e)}
  try{loadLocal();loadPermissionPrefs()}catch(e){console.warn('loadLocal failed',e)}
  try{bindCriticalUI()}catch(e){console.warn('critical UI bind failed',e)}
  try{bindHomeCriticalUI()}catch(e){console.warn('home critical UI bind failed',e)}
  try{bindUI()}catch(e){console.error('UI binding failed',e);toast('화면 초기화 오류가 복구되었습니다. 새로고침해 주세요.',3500)}
  try{applyNightMode()}catch(e){console.warn('night mode failed',e)}
  Promise.resolve().then(()=>initMap()).catch(e=>console.warn('map init failed',e));
  if(!firebaseConfigured()){
    try{loadLocalUserSettings()}catch{}
    Promise.allSettled([loadDbSavedPlaces(),loadDbFavorites(),loadDbRecents(),loadUserSettings()]);
  }
  // Defer non-critical account and media startup until the first screen is interactive.
  dangolloAfterFirstPaint(()=>initFirebase().catch(e=>console.warn('firebase init failed',e)),950);
  try{loadSavedWaypointCourses();renderProfile();updateOriginUI();renderRouteWaypoints();renderSavedWaypointCourses();updateTripHistorySummary();setView('home')}catch(e){console.error('initial render failed',e)}
  dangolloAfterFirstPaint(()=>loadHomeShorts().catch(e=>console.warn('komsco shorts init failed',e)),1600);
  try{
    $('driveRadioBtn')&&($('driveRadioBtn').onclick=toggleRadio);
    $('radioVolume')&&($('radioVolume').oninput=e=>setRadioVolume(Number(e.target.value)/100,true));
    $('guideVolume')&&($('guideVolume').oninput=e=>changeVolume(e.target.value));
    dangolloAfterFirstPaint(()=>initVirtualRadio().catch(e=>console.warn('virtual radio init failed',e)),2200);
  }catch(e){console.warn('radio UI bind failed',e)}
  if('speechSynthesis'in window){try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices()}catch{}}
  setTimeout(()=>refreshPermissionState().catch(()=>{}),180);
  // Startup fuel request; cached result is displayed first if the GPS is still warming up.
  // Fuel remains available, but initial requests should not compete with the map's critical render.
  dangolloAfterFirstPaint(()=>loadFuelPrices(state.fuelProduct,{force:false}).catch(e=>console.warn('initial fuel failed',e)),950);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrapApp,{once:true});else bootstrapApp();

// build 7.6.7.3: Daejeon-Sejong corridor public camera dataset + always-visible route camera icons

// build 7.6.7.4: critical camera render filters 55m/45m fixed to 120m; partial dataset failures isolated

// build 7.6.7.5: startNavigation camera reload + remove duplicate camera filters + direct official fallback

// build 7.6.8.0: virtual radio integration, camera voice filter fix, precise speed source priority, guide sign/voice sync

// build 7.6.8.1: compact radio toggle in mic position + stronger stationary start lock

// build 7.6.8.2: radio SVG-only UI, AR/radio click binding repair, Sejong->Daejeon verified expressway camera priority supplement

// build 7.6.8.3: restore hidden audio player + radio volume UI + direct navigation-start autoplay

// build 7.6.8.4: radio ON/OFF swaps both color and SVG icon for unmistakable state

// build 7.6.8.5: confirmed Sejong→Daejeon section-camera pairing, wider corridor camera snap, radio OFF blue icon, Sodam/Mannyeon Onnuri refresh
// build 7.6.8.6: OFF radio button now uses selected image asset, Onnuri visibility/UI upgraded, home map safety markers hidden unless guiding
// build 7.6.8.7: OFF radio button switched back to SVG and aligned to the same icon size/position as ON
// build 7.6.8.8: OFF radio icon now replaces the whole circular button art, and home-map voucher/onnuri refresh/visibility are more aggressive while panning
// build 7.6.8.9: official Daejeon camera matching strengthened; Gujeuk-Sejong section endpoints direction-locked; late section-start voice at the end fixed

// build 7.6.9.0: Gapcheon riverside cameras priority match + institution front-gate arrival finish

// build 7.6.9.1: navigation entry resets virtual radio to 80% and immediately requests autoplay

// build 7.6.9.2: Onnuri CSV8 regional address dataset integration + local-voucher-style store details/grouped pins

// build 7.6.9.3: radio default 60% + runtime loudness normalization (AGC/limiter) for uneven MP3 source levels

// build 7.6.9.4: drive HUD spacing refinement, dedicated safety states, section-speed declutter and mobile readability tuning

// build 7.6.9.5: D1 Onnuri viewport is authoritative on the home map; stale off-screen markers are filtered and cache TTL reduced.

/* 7.6.11.2 주행 팝업 우선순위: 동시에 여러 개가 뜨지 않고 하나만 표시한다.
   1순위 구간단속(구간단속 패널 / 구간단속 시작·종료 안내) → 2순위 과속주의 → 3순위 신호·과속단속카메라 등 안전 안내 → 4순위 기본 도로 운행사항(차로 안내)
   결과는 #driveView[data-pop] 로 표시하고, 숨김 처리는 styles.css 가 담당한다. */
function arbitrateDrivePopups(){
  const dv=document.getElementById('driveView');if(!dv)return;
  const $$=(id)=>document.getElementById(id);
  const shown=(id)=>{const e=$$(id);return !!e&&!e.classList.contains('hidden')};
  const panel=shown('sectionSpeedPanel');
  const sa=$$('safetyAlert'),saShown=shown('safetyAlert');
  const saSection=saShown&&/^section_speed/.test(String(sa?.dataset?.safetyType||''));
  const over=!!$$('overspeedFlash')?.classList.contains('active');
  const lane=shown('laneAssistLayer');
  let pop='none';
  if(panel)pop='section';
  else if(saSection)pop='safety';
  else if(over)pop='overspeed';
  else if(saShown)pop='safety';
  else if(lane)pop='lane';
  if(dv.dataset.pop!==pop)dv.dataset.pop=pop;
}
(function initDrivePopupArbiter(){
  const ids=['sectionSpeedPanel','safetyAlert','laneAssistLayer','overspeedFlash'];
  const mo=new MutationObserver(arbitrateDrivePopups);
  ids.forEach(id=>{const e=document.getElementById(id);if(e)mo.observe(e,{attributes:true,attributeFilter:['class','data-safety-type']})});
  arbitrateDrivePopups();
})();

// build 7.6.11.6: hide stale current-position markers during drive; strict route-direction camera filtering; dedupe nearby physical camera rows; route-line camera projection.

// build 7.6.11.7: hide drive destination pin, suppress post-section duplicate cameras, fix direction-code parsing, Hoedeok 80 fallback, simulation front-gate arrival.
// build 7.6.11.8: remove destination red pin globally; restore route cameras after over-filter regression; soften direction matching; thinner landscape HUD.
// build 7.6.11.9: fix invalid RegExp (template-literal escapes) in cameraDirectionHint that threw inside loadStaticCameraEvents and removed every official route camera; isolate per-row / post-merge errors; alert criteria aligned with map pins; Hoedeok fallback camera now actually added.
// build 7.6.12.0: onnuri map markers no longer overlap (screen-space layout with leader lines, count bubbles, compact zone pins), zone marker opens full shop list, where-to list rows get a 'show on map' focus button.
// build 7.6.13.3: dropped unused Cloudflare D1/Worker fetch path (kept open-data static bundles only); added general name-based stale-duplicate camera suppression (fixes 구즉세종로 남행 구간단속 종료 후 상서삼거리 중복 카메라, and similar patterns anywhere on the map, not just near section ends).
// Independent bindings: do not let unrelated settings controls disable simulation actions.
let dangolloSimulationControlsBound=false;
function bindDangolloSimulationControls(){
  if(dangolloSimulationControlsBound)return;
  dangolloSimulationControlsBound=true;
  const btn=$('simulationStartBtn');
  if(btn)btn.onclick=()=>{try{startRouteSimulation()}catch(err){console.error('[Dangollo simulation]',err);toast('모의주행을 시작하지 못했습니다. 경로를 다시 확인해 주세요.',2500)}};
  document.querySelectorAll('[data-simulation-speed]').forEach(b=>b.onclick=()=>setSimulationSpeed(b.dataset.simulationSpeed));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindDangolloSimulationControls,{once:true});
else bindDangolloSimulationControls();

// build 7.6.14.0: drive UI TMAP-style recommendation rail + route-aligned fuel/local/onnuri panel; map camera pins simplified to speed-limit markers.

// build 7.6.15.0: corridor probe queries, real POI marker coordinates, stale-response protection, safety-priority compact cards.

// Dangollo 7.6.16.0: origin lock, monotonic marker, heading-up camera, conservative rerouting, split guide, DR IMU safety.

// Dangollo v7.6.18: resume simulator smoothly when the app returns to foreground.
document.addEventListener('visibilitychange',()=>{
  if(!state.simulationActive)return;
  state.simulationLastAt=performance.now();
  scheduleDangolloSimulationFrame();
});



/* 7.6.23.2: 우측 5종 바로가기 고정 표시. 교통흐름 레일은 최우측, 버튼은 그 왼쪽에 배치. */
function initDangolloDrivingQuickActions(){
  const drive=document.getElementById('driveView');
  if(!drive||drive.dataset.quickActionsBound==='true')return;
  drive.dataset.quickActionsBound='true';
  const quickIds=['driveRadioBtn','arOpenBtn','driveRecommendBtn','routeInfoBtn','driveSearchBtn'];
  const buttons=quickIds.map(id=>document.getElementById(id)).filter(Boolean);
  function setOpen(open){
    drive.classList.toggle('dangollo-quick-actions-open',Boolean(open));
    for(const button of buttons){button.tabIndex=open?0:-1;button.setAttribute('aria-hidden',String(!open));}
  }
  const isDriveVisible=()=>!drive.classList.contains('hidden');
  setOpen(true);
  const observer=new MutationObserver(()=>{setOpen(isDriveVisible());});
  observer.observe(drive,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDangolloDrivingQuickActions,{once:true});
else initDangolloDrivingQuickActions();

// 7.6.27.25: 날씨는 홈 화면 표시 중에만 주기적으로 갱신
setInterval(()=>{if(!document.hidden)refreshDangolloHomeWeather()},60000);


/* v7.6.27.26 — 길 위의 핫플: verified voucher locations + legitimate Instagram search link. */
let hotspotRequestSeq=0;
const hotspotLiveCache=new Map(); // short-lived by-location API response cache (no persistent location storage)
const hotspotInflight=new Map(); // share the first fetch across category changes

const hotspotText=x=>String(x||'').trim().slice(0,160);
function hotspotInstagramUrl(item){return discoverMerchantSearchUrl(item,'instagram')}
function hotspotCategoryMatch(item,category){
  const t=discoverMerchantCategory(item);
  const text=[item.name,item.category,item.categoryName,item.industry,item.businessType,item.type,item.upjong].filter(Boolean).join(' ').toLowerCase();
  if(category==='meal')return t==='meal'||classifyVoiceMerchant(item)==='meal';
  if(category==='cafe_bakery')return ['cafe','bakery'].includes(t)||classifyVoiceMerchant(item)==='dessert';
  if(category==='meat_fruit')return t==='butcher'||/청과|과일|과채|야채|채소|정육|식육|축산/.test(text);
  if(category==='academy')return t==='academy';
  if(category==='hospital_pharmacy')return ['hospital','pharmacy'].includes(t);
  if(category==='beauty')return /미용|헤어|네일|피부관리|뷰티|이발|바버|에스테틱|화장품/.test(text);
  if(category==='optician')return /안경|렌즈|안경원|안경점|optical/.test(text);
  if(category==='laundry')return t==='laundry';
  if(category==='flower_stationery_books')return ['flower','stationery','bookstore'].includes(t);
  if(category==='fuel_repair')return /주유소|충전소|정비소|카센터|자동차정비|타이어|세차/.test(text);
  return false;
}
const hotspotCategoryLabel={meal:'동네 맛집',cafe_bakery:'카페·빵집',meat_fruit:'정육·청과',academy:'학원',hospital_pharmacy:'병원·약국',beauty:'뷰티',optician:'안경점',laundry:'세탁소',flower_stationery_books:'꽃집·문구·서점',fuel_repair:'주유소·정비소'};
let hotspotPageLimit=10;

function hotspotRenderRow(host,item,opts={}){
  const row=document.createElement('article');row.className='hotspot-result';
  const visual=document.createElement('div');visual.className='hotspot-photo';const image=document.createElement('img');image.src=discoverMerchantImage(item);image.loading='lazy';image.alt='업종별 대표 일러스트 (해당 가맹점 실사진 아님)';visual.append(image);
  const title=document.createElement('strong');title.textContent=hotspotText(item.name||item.market||'가맹점');
  const meta=document.createElement('small');const distance=opts.distance!=null?` · 약 ${(opts.distance/1000).toFixed(1)}km`:'';
  meta.textContent=`${item.payment==='onnuri'?'온누리':'지역사랑'} 가맹점${distance}${opts.extra!=null?` · 추가 우회 약 ${opts.extra.toFixed(1)}분`:''}`;
  const address=document.createElement('small');address.textContent=hotspotText(item.address||item.matchedAddress||item.market||'주소 상세 확인 필요');
  const actions=document.createElement('div');actions.className='hotspot-actions';
  const insta=document.createElement('a');insta.href=hotspotInstagramUrl(item);insta.target='_blank';insta.rel='noopener noreferrer';insta.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>인스타그램</span>'; insta.title='공개된 인스타그램 게시물 검색결과 보기 (Google 검색 · SNS 인기도 미검증)';
  const review=document.createElement('a');review.href=discoverMerchantSearchUrl(item,'review');review.target='_blank';review.rel='noopener noreferrer';review.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.9 7.9 0 0 1-8 8 8.8 8.8 0 0 1-3-.5L4 20l1-4.4A8 8 0 1 1 20 11.5Z"/><path d="M8.5 11.5h7M8.5 14.5h4"/></svg><span>방문후기</span>'; review.title='외부 방문 후기 검색 (평점·인기도 미검증)';
  const go=document.createElement('button');go.type='button';go.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>'+ (opts.verified?'경유지 추가':'목적지 선택')+'</span>';
  go.onclick=async()=>{
    if(state.tripStartedAt){host.status.textContent='안전한 곳에 정차한 후 장소를 선택해 주세요.';return}
    const pt=normalizedPlace({name:item.name||item.market||'가맹점',address:item.address||'',lat:item.lat,lng:item.lng});
    if(!pointValid(pt)){host.status.textContent='정확한 위치가 없어 길안내에 추가할 수 없습니다.';return}
    go.disabled=true;
    try{
      if(opts.verified){
        host.status.textContent='선택한 맛집을 경유하는 길을 계산하고 있습니다…';
        cancelAutoStart();state.waypoints=[...(state.waypoints||[]),pt].slice(0,5);renderRouteWaypoints();
        await loadRouteOptions();cancelAutoStart();host.status.textContent='경유 경로가 계산되었습니다. 안내 시작을 선택해 주세요.';
        const start=document.createElement('button');start.textContent='안내 시작';start.className='hotspot-guide-start';start.onclick=()=>{host.root.remove();startNavigation()};
        host.results.replaceChildren(start);
      }else{
        host.status.textContent='목적지를 계산하고 있습니다…';
        await chooseDestination(pt,{autoGuide:false});host.root.remove();
      }
    }catch(e){host.status.textContent='경로 계산에 실패했습니다. 다시 시도해 주세요.';go.disabled=false;console.warn('[hotspot] route failed',e)}
  };
  actions.append(insta,review,go);row.append(visual,title,meta,address,actions);return row;
}
function hotspotOpen(query=""){
  // DOM event listeners pass a MouseEvent, not a search query. Never call .match on an Event.
  query=typeof query==='string'?query:'';
  document.getElementById('hotspotOverlay')?.remove();++hotspotRequestSeq;
  const root=document.createElement('div');root.id='hotspotOverlay';root.className='hotspot-overlay';
  const sheet=document.createElement('section');sheet.className='hotspot-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','길 위의 핫플');
  sheet.innerHTML='<div class="hotspot-title"><div><small>단골로 · 지역 소비 발견</small><h2>🍜 길 위의 핫플</h2></div><button type="button" class="hotspot-close" aria-label="닫기">×</button></div><p class="hotspot-intro">맛집부터 생활편의시설까지 10개 업종의 실제 상품권 가맹점을 찾아보세요. SNS 게시물은 외부에서 검색합니다.</p><div class="hotspot-filters"><label>종류<select id="hotspotCategory"><option value="meal">동네 맛집</option><option value="cafe_bakery">카페·빵집</option><option value="meat_fruit">정육·청과</option><option value="academy">학원</option><option value="hospital_pharmacy">병원·약국</option><option value="beauty">뷰티</option><option value="optician">안경점</option><option value="laundry">세탁소</option><option value="flower_stationery_books">꽃집·문구·서점</option><option value="fuel_repair">주유소·정비소</option></select></label><label>결제 혜택<select id="hotspotPayment"><option value="both">전체</option><option value="onnuri">온누리</option><option value="local">지역사랑</option></select></label><label>최대 우회<select id="hotspotDetour"><option value="5">5분</option><option value="10">10분</option><option value="3">3분</option></select></label></div><p id="hotspotStatus" class="hotspot-status" role="status" aria-live="polite">주변 가맹점을 확인하고 있습니다…</p><div id="hotspotResults" class="hotspot-results"></div><p class="hotspot-disclaimer">이미지는 업종별 대표 일러스트이며 가맹점 실사진이 아닙니다. SNS·후기는 외부 검색으로 연결되며 인기 순위·평점은 검증하지 않습니다. 결제 가능 여부와 영업시간은 방문 전 확인하세요.</p>';
  root.append(sheet);document.body.append(root);const close=()=>{hotspotRequestSeq++;root.remove()};sheet.querySelector('.hotspot-close').onclick=close;root.onclick=e=>{if(e.target===root)close()};
  const host={root,status:sheet.querySelector('#hotspotStatus'),results:sheet.querySelector('#hotspotResults'),rows:[],pageLimit:10,renderVersion:0};
  if(query){
    const category=/주유소|정비소|카센터|타이어/i.test(query)?'fuel_repair':/안경|렌즈/i.test(query)?'optician':/뷰티|미용|네일|헤어/i.test(query)?'beauty':/정육|축산|식육|청과|과일/i.test(query)?'meat_fruit':/꽃집|꽃가게|화원|플라워|문구|문방구|서점|책방/i.test(query)?'flower_stationery_books':/학원|교습소|입시/i.test(query)?'academy':/약국|약사|병원|의원|진료/i.test(query)?'hospital_pharmacy':/세탁|크리닝/i.test(query)?'laundry':/카페|커피|디저트|베이커리|빵집|제과점/i.test(query)?'cafe_bakery':'meal';
    sheet.querySelector('#hotspotCategory').value=category;
    if(/온누리/.test(query))sheet.querySelector('#hotspotPayment').value='onnuri';
    else if(/지역사랑|지역화폐/.test(query))sheet.querySelector('#hotspotPayment').value='local';
    const time=query.match(/(3|5|10)\s*분/);if(time)sheet.querySelector('#hotspotDetour').value=time[1];
  }
  for(const el of sheet.querySelectorAll('select'))el.onchange=()=>{host.pageLimit=10;void hotspotFind(host).catch(e=>{console.error('[hotspot] filter query',e);if(host.root.isConnected)host.status.textContent='조회 중 오류가 발생했습니다. 다시 시도해 주세요.'})};
  void hotspotFind(host).catch(e=>{console.error('[hotspot] initial query',e);if(host.root.isConnected)host.status.textContent='조회 중 오류가 발생했습니다. 필터를 바꾸거나 다시 시도해 주세요.'});
}
/* 7.6.27.29: Home / 어디갈까 share one initial merchant-data pipeline.
   Paint existing region-matching data immediately; then refresh asynchronously.
   Every request is sequence-checked, and loading always settles visibly. */
function hotspotGetSources(payment){
  const groups=payment==='onnuri'?['onnuri']:payment==='local'?['local']:['onnuri','local'];
  const found=[];
  for(const kind of groups){
    const stateData=kind==='onnuri'?state.onnuriData:state.localVoucherData;
    const cached=kind==='onnuri'?readOnnuriStaleCache():readVoucherStaleCache();
    const planning=kind==='onnuri'?state.planningAi?.onnuri:state.planningAi?.local;
    // Cache is only a fallback. Filter by actual current-location radius below;
    // never imply an old cache is current or freshly validated.
    for(const [source,items] of [['memory',stateData?.items],['cache',cached?.items],['planning',planning]]){
      if(!Array.isArray(items))continue;
      for(const item of items)found.push({...item,payment:kind,_hotspotSource:source});
    }
  }
  return found;
}
function hotspotPositioned(rows,origin){
  const seen=new Set();
  return rows.filter(x=>pointValid(x)&&!x.approximate&&x.precision!=='market-zone'&&x.precision!=='admin-zone')
    .map(x=>({...x,_meters:voucherGeoMeters(origin.lat,origin.lng,Number(x.lat),Number(x.lng))}))
    .filter(x=>Number.isFinite(x._meters)&&x._meters<=7500)
    .filter(x=>{const key=[x.payment,String(x.name||x.market||'').trim(),Number(x.lat).toFixed(5),Number(x.lng).toFixed(5)].join('|');if(seen.has(key))return false;seen.add(key);return true})
    .sort((a,b)=>a._meters-b._meters);
}
function hotspotSetRows(host,rows,context={}){
  if(!host.root.isConnected)return;
  host.rows=rows;
  host.results.replaceChildren();
  const take=Math.min(host.pageLimit,rows.length);
  for(let i=0;i<take;i++){
    const x=rows[i];host.results.append(hotspotRenderRow(host,x.item||x,x.opts||{}));
  }
  if(rows.length>take){
    const more=document.createElement('button');more.type='button';more.className='merchant-more-button';
    more.textContent=`더보기 · ${take}/${rows.length}곳`;
    more.onclick=()=>{host.pageLimit+=10;hotspotSetRows(host,host.rows)};
    host.results.append(more);
  }
}
function hotspotPaintCandidates(host,positioned,category,context={}){
  if(!host.root.isConnected)return false;
  let rows=positioned.filter(x=>hotspotCategoryMatch(x,category)).slice(0,100);
  if(rows.length){
    host.status.textContent=`현 위치 주변 ${hotspotCategoryLabel[category]||'가맹점'} ${rows.length}곳 · 직선거리 기준${context.preview?' · 정보 갱신 중…':''}${context.routeMessage?' · 우회시간 미검증':''}`;
    hotspotSetRows(host,rows.map(x=>({item:x,opts:{distance:x._meters,category}})));
    return true;
  }
  if(positioned.length){
    rows=positioned.slice(0,100);
    host.status.textContent=`${hotspotCategoryLabel[category]||'선택 업종'}의 확인된 가맹점이 없습니다. 다른 업종 ${rows.length}곳을 참고용으로 표시합니다.${context.preview?' 갱신 중…':''}`;
    hotspotSetRows(host,rows.map(x=>({item:x,opts:{distance:x._meters}})));
    return true;
  }
  host.status.textContent=context.preview?'현재 위치의 가맹점 정보를 확인하고 있습니다…':'위치가 확인된 주변 가맹점이 없습니다.';
  hotspotSetRows(host,[]);
  return false;
}

async function hotspotFind(host){
  const seq=++hotspotRequestSeq,valid=()=>seq===hotspotRequestSeq&&host.root.isConnected;
  const sel=id=>host.root.querySelector(id)?.value;
  const category=sel('#hotspotCategory')||'meal',payment=sel('#hotspotPayment')||'both',max_detour_min=Number(sel('#hotspotDetour'))||5;
  host.pageLimit=10;host.results.replaceChildren();host.status.textContent='현 위치 주변 가맹점을 확인하고 있습니다…';
  try{
    let origin=currentOriginPoint();
    if(!pointValid(origin))origin=await refreshCurrentLocation({maxAgeMs:30000,timeoutMs:1700}).catch(()=>null);
    if(!valid())return;
    if(!pointValid(origin)){host.status.textContent='현 위치를 확인하지 못했습니다. 위치 권한을 확인한 뒤 다시 열어 주세요.';return}
    const memory=hotspotPositioned(hotspotGetSources(payment,origin),origin);
    const previewShown=hotspotPaintCandidates(host,memory,category,{preview:true});
    const kinds=payment==='onnuri'?['onnuri']:payment==='local'?['local']:['onnuri','local'];
    const request=async kind=>{
      const path=kind==='onnuri'?'/api/onnuri-voucher':'/api/local-voucher';
      const key=kind+'|'+origin.lat.toFixed(2)+'|'+origin.lng.toFixed(2);
      const cached=hotspotLiveCache.get(key);
      if(cached&&Date.now()-cached.at<120000)return {kind,ok:true,items:cached.items};
      if(hotspotInflight.has(key))return hotspotInflight.get(key);
      const task=(async()=>{
        try{
          const d=await planningFetchJson(path,{lat:origin.lat,lng:origin.lng,...drivePoiRegionBox(origin,2)},5800);
          const items=Array.isArray(d?.items)?d.items:[];
          hotspotLiveCache.set(key,{at:Date.now(),items});
          if(hotspotLiveCache.size>16)hotspotLiveCache.delete(hotspotLiveCache.keys().next().value);
          return {kind,ok:true,items};
        }catch(e){console.warn('[hotspot] voucher fetch failed',kind,String(e?.message||e));return {kind,ok:false,items:cached?.items||[]}}
        finally{hotspotInflight.delete(key)}
      })();
      hotspotInflight.set(key,task);
      return task;
    };
    // Update in parallel, but use cache immediately instead of blocking on the slowest endpoint.
    const liveResults=[];
    const responses=await Promise.all(kinds.map(async kind=>{
      const result=await request(kind);
      liveResults.push(result);
      if(valid()&&result.items.length){
        const staged=hotspotPositioned([
          ...liveResults.flatMap(x=>x.items.map(item=>({...item,payment:x.kind,_hotspotSource:'live'}))),
          ...hotspotGetSources(payment)
        ],origin);
        hotspotPaintCandidates(host,staged,category,{preview:liveResults.length<kinds.length});
      }
      return result;
    }));if(!valid())return;
    const available=responses.flatMap(x=>x.items.map(item=>({...item,payment:x.kind,_hotspotSource:'live'})));
    const positioned=hotspotPositioned([...available,...hotspotGetSources(payment,origin)],origin);
    // Avoid claiming that an empty successful server response means a transport error.
    const hasRoute=Boolean(state.destination&&state.route?.geometry?.length>1);
    if(hasRoute){
      host.status.textContent='경로상 가맹점의 실제 우회시간을 확인하고 있습니다…';
      try{
        const rows=await aiTripVerifyCandidates({category,payment,max_detour_min},msg=>{if(valid())host.status.textContent=msg});
        if(!valid())return;
        if(rows.length){host.status.textContent=`실제 우회시간으로 확인한 ${rows.length}곳 · ${max_detour_min}분 이내`;hotspotSetRows(host,rows.map(x=>({item:{...x.item,name:x.pt.name},opts:{verified:true,extra:x.extra,category}})));return;}
      }catch(e){console.warn('[hotspot] detour validation skipped',e)}
    }
    if(!valid())return;
    const shown=hotspotPaintCandidates(host,positioned,category,{routeMessage:hasRoute});
    if(!shown&&!responses.some(x=>x.ok))host.status.textContent='가맹점 서버 연결에 실패했습니다. 잠시 후 다시 선택해 주세요.';
    else if(!shown&&previewShown)hotspotPaintCandidates(host,memory,category,{routeMessage:hasRoute});
  }catch(e){console.warn('[hotspot] query failed',e);if(valid())host.status.textContent=host.results.childElementCount?'일부 가맹점 정보만 표시했습니다.':'가맹점 조회 중 오류가 발생했습니다. 다시 시도해 주세요.'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{$('hotspotOpenBtn')?.addEventListener('click',()=>hotspotOpen())});
else $('hotspotOpenBtn')?.addEventListener('click',()=>hotspotOpen());
