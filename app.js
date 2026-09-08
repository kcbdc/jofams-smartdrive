const $ = id => document.getElementById(id);
const CONFIG = window.__APP_CONFIG__ || {};
const ADMIN_EMAIL='churchoffire@gmail.com';
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
const state = {
  map:null,mapReady:false,pendingRouteDraw:null,mapFallbackTried:false,mapWatchdog:0,user:null, destination:null, routeOptions:[], route:null, selectedRoute:0,
  userMarker:null,destMarker:null,originMarker:null,watchId:null,character:'daim',voiceVolume:.8,sound:true,
  autoStartTimer:null,autoStartSeconds:0,routeCumulative:[],currentRouteIndex:0,lastRerouteAt:0,lastGuideSpoken:'',tripStartedAt:0,
  savedPlaces:{home:null,work:null},favorites:[],recentDestinations:[],placeKind:null,placeCandidate:null,origin:null,originMode:'current',placeDbReady:false,waypoints:[],pendingDriveSearchPlace:null,savedWaypointCourses:[],fuelProduct:'B027',fuelData:null,fuelFetchedAt:0,fuelLoading:false,destinationSearchSort:'accuracy',lastDestinationQuery:'',routeMode:'car',carRouteOptions:[],walkingRoute:null,routeModeDurations:{car:null,walk:null},homeFacilityCategory:'주유소',homeFacilityItems:[],
  arStream:null,arFrame:0,arRunning:false,permissionCameraGranted:false,permissionLocationGranted:false,permissionPrefs:{location:true,camera:true},
  tripHistory:[],safetyEvents:[],safetyMarkers:[],lastSafetySpoken:new Set(),activeSafetyId:null,safetyRequestSeq:0,lastTrafficStatus:'',lastTrafficSpokenAt:0,overspeedActive:false,lastOverspeedSpokenAt:0,map3D:false,mapSatellite:false,mapControlsVisible:false,liveRouteTimer:0,lastLiveRouteAt:0,lastVmsKey:'',destinationCycleTimer:0,destinationHideTimer:0,lastDestinationShownAt:0,deadReckoningTimer:0,lastRealGpsAt:0,lastGpsTickAt:0,lastRealSpeedMps:0,lastRealHeading:0,gpsEstimated:false,lastDeadReckoningNoticeAt:0,officialCameraRows:null,officialCameraPromise:null,sectionSpeedState:null,tunnelRouteLock:{active:false,startIndex:-1,endIndex:-1,routeDistance:null,lastAt:0},homeSheetCollapsed:false,homeSheetDrag:null,mapPlaceCandidate:null,localVoucherMarkers:[],localVoucherData:null,localVoucherRetryCount:0,localVoucherLastErrorAt:0,localVoucherLoadTimer:0,localVoucherRegionCode:'',localVoucherLoadedAt:0,localVoucherLoadedCenter:null,onnuriMarkers:[],onnuriData:null,onnuriLoadedAt:0,onnuriLoadedCenter:null,onnuriLoadTimer:0,homeCameraMarkers:[],homeCameraLoadTimer:0,
  futureOrigin:null,futureDestination:null,futureDateMode:'today',futureAmPm:'AM',offRouteHits:0,routePreference:'recommend',cameraAlerts:{speed:true,signal:true},userSettingsLoaded:false,inquiries:[],adminNotices:[],adminContent:null,adminVerified:false,adminVerifiedEmail:'',loginPending:false,loginStartedAt:0,deadReckoningDistance:null,deadReckoningLastAt:0,arCameraMode:false,lastSpeedSample:null,simulationActive:false,simulationSpeed:1,simulationDistance:null,simulationLastAt:0,simulationRaf:0,
  compassHeading:null,compassAt:0,compassReady:false,activeLaneGuideKey:'',nativeLocationAt:0,nativeLocationActive:false,imu:{at:0,yawRateDegS:0,accelMagnitude:0,headingDeg:null},mapMatch:{index:0,routeDistance:0,score:Infinity,confidence:0,at:0},offRouteHeadingHits:0,gpsFix:{lat:null,lng:null,headingDeg:null,speedMps:0,at:0,fixCount:0,mapSnapped:false},
  whereToTab:'local',wakeLock:null,savedPlaceGroups:[],savedPlaceGroupMap:{},activeSavedGroup:'all',firebase:{configured:false,ready:false,user:null,auth:null,db:null,mods:null}
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
    inbox:`<svg viewBox="0 0 24 24" ${common}><path d="M4 5h16v14H4z"/><path d="M4 14h5l2 2h2l2-2h5"/></svg>`
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
function mins(sec){return `${Math.max(1,Math.round((sec||0)/60))}분`}
function eta(sec){const d=new Date(Date.now()+(sec||0)*1000);return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}
function hav(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function bearing(a,b,c,d){const p=Math.PI/180,y=Math.sin((d-b)*p)*Math.cos(c*p),x=Math.cos(a*p)*Math.sin(c*p)-Math.sin(a*p)*Math.cos(c*p)*Math.cos((d-b)*p);return (Math.atan2(y,x)/p+360)%360}
function pointValid(p){return p&&Number.isFinite(Number(p.lng))&&Number.isFinite(Number(p.lat))}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function nearestIndex(lng,lat,geometry){let bi=0,bd=Infinity;const stride=Math.max(1,Math.floor((geometry?.length||0)/1200));for(let i=0;i<(geometry?.length||0);i+=stride){const p=geometry[i],d=(p[0]-lng)**2+(p[1]-lat)**2;if(d<bd){bd=d;bi=i}}return bi}
function buildCumulative(route){const g=route?.geometry||[],arr=new Array(g.length).fill(0);for(let i=1;i<g.length;i++)arr[i]=arr[i-1]+hav(g[i-1][1],g[i-1][0],g[i][1],g[i][0]);return arr}
function normalizedPlace(x){return x?{id:x.id||'',name:x.name||'목적지',address:x.address||'',lng:Number(x.lng),lat:Number(x.lat)}:null}


/* ---------- NATIVE HIGH-PRECISION LOCATION / IMU BRIDGE ---------- */
function nativeBridgeAvailable(){return Boolean(window.JofamsNavigationBridge&&typeof window.JofamsNavigationBridge.postMessage==='function')}
function nativePost(type,payload={}){try{if(nativeBridgeAvailable())window.JofamsNavigationBridge.postMessage(JSON.stringify({type,payload,ts:Date.now()}))}catch(e){console.warn('native bridge post failed',e)}}
function parseNativePacket(packet){try{return typeof packet==='string'?JSON.parse(packet):packet||{}}catch{return {}}}
window.JofamsNative=window.JofamsNative||{};
window.JofamsNative.onLocationUpdate=packet=>{
  const p=parseNativePacket(packet),lat=Number(p.lat??p.latitude),lng=Number(p.lng??p.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  state.nativeLocationAt=Date.now();state.nativeLocationActive=true;
  applyGps({native:true,timestamp:Number(p.timestamp)||Date.now(),coords:{latitude:lat,longitude:lng,accuracy:Number(p.accuracy)||8,speed:Number(p.speedMps??p.speed),heading:Number(p.headingDeg??p.bearing),speedAccuracy:Number(p.speedAccuracy),headingAccuracy:Number(p.bearingAccuracy)}},false);
};
window.JofamsNative.onMotionUpdate=packet=>{
  const p=parseNativePacket(packet);state.imu={at:Date.now(),yawRateDegS:Number(p.yawRateDegS)||0,accelMagnitude:Number(p.accelMagnitude)||0,headingDeg:Number.isFinite(Number(p.headingDeg))?Number(p.headingDeg):state.imu.headingDeg};
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
  const bi=nearestIndex(lng,lat,geometry),lo=Math.max(1,bi-2),hi=Math.min(geometry.length-1,bi+2);
  let best=null,bestD=Infinity;
  for(let i=lo;i<=hi;i++){
    const p0=geometry[i-1],p1=geometry[i],proj=projectPointToSegment(lng,lat,p0,p1),d=hav(lat,lng,proj.lat,proj.lng);
    if(d<bestD){bestD=d;best={lng:proj.lng,lat:proj.lat,heading:bearing(p0[1],p0[0],p1[1],p1[0]),distance:d,index:i}}
  }
  return best;
}

function angleDiff(a,b){if(!Number.isFinite(a)||!Number.isFinite(b))return 0;return Math.abs(((a-b+540)%360)-180)}
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
  const sigma=Math.max(6,Math.min(35,Number(raw.accuracy)||18)),heading=Number(raw.heading),moving=Number(raw.speed)>2.2;
  let best=null,bestScore=Infinity;
  for(const i of candidates){
    const p0=g[i-1],p1=g[i],proj=projectPointToSegmentDetailed(raw.lng,raw.lat,p0,p1),d=hav(raw.lat,raw.lng,proj.lat,proj.lng),segHeading=bearing(p0[1],p0[0],p1[1],p1[0]),rd=routeDistanceAtSegment(i,proj.t);
    const emission=d/sigma,headPenalty=moving?angleDiff(heading,segHeading)/48:0,progressPenalty=prev.at?Math.min(5,Math.abs(rd-expected)/Math.max(28,Math.max(0,Number(raw.speed)||0)*dt*4)):0;
    const backwards=prev.at&&rd<(Number(prev.routeDistance)||0)-Math.max(18,(Number(raw.speed)||0)*dt*1.8)?2.6:0;
    const indexJump=prev.at?Math.min(2.5,Math.abs(i-prior)/90):0,seg=roadSegmentAtIndex(i),linkId=seg?.linkId||null,linkPenalty=prev.linkId&&linkId&&prev.linkId!==linkId&&Math.abs(i-prior)>18?.55:0;
    const score=emission+headPenalty*.75+progressPenalty*.9+backwards+indexJump*.35+linkPenalty;
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

function lockDisplayPositionToRoute(rawLike,now=Date.now()){
  if(!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative?.length)return null;
  const raw={
    lng:Number(rawLike?.lng),lat:Number(rawLike?.lat),
    heading:Number(rawLike?.heading),speed:Number(rawLike?.speed),
    accuracy:Number(rawLike?.accuracy)||20
  };
  if(!pointValid(raw))return null;
  const match=probabilisticRouteMatch(raw,now);
  if(!match)return null;

  // 기차가 레일을 따라가듯 화면 캐릭터 진행거리는 역행하지 않도록 한다.
  const previous=Number(state.routeLockedDistance);
  const tolerance=Math.max(10,Math.min(28,(raw.accuracy||20)*.8));
  let distance=Number(match.routeDistance)||0;
  if(Number.isFinite(previous)){
    if(distance<previous-tolerance)distance=previous;
    // GPS 순간 점프로 한 틱에 지나치게 앞서가지 않도록 제한
    const dt=Math.max(.25,Math.min(2.5,(now-(state.routeLockedAt||now-500))/1000));
    const maxAdvance=Math.max(22,(Math.max(0,raw.speed)||0)*dt*2.8+14);
    distance=Math.min(distance,previous+maxAdvance);
  }
  const p=pointAtRouteDistance(distance);
  if(!p)return null;
  state.routeLockedDistance=distance;
  state.routeLockedAt=now;
  return {...p,confidence:match.confidence,rawDistance:match.distance};
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


const CAMERA_DATASET_URLS=['/data/unmanned_traffic_cameras_part1.json','/data/unmanned_traffic_cameras_part2.json'];

async function loadOfficialCameraRows(){
  if(Array.isArray(state.officialCameraRows))return state.officialCameraRows;
  if(state.officialCameraPromise)return state.officialCameraPromise;
  state.officialCameraPromise=Promise.all(CAMERA_DATASET_URLS.map(async url=>{
    const r=await fetch(url,{cache:'force-cache'});
    if(!r.ok)throw new Error(`camera dataset HTTP ${r.status}: ${url}`);
    const d=await r.json();
    return Array.isArray(d)?d:Array.isArray(d?.records)?d.records:Array.isArray(d?.response?.body?.items)?d.response.body.items:[];
  })).then(parts=>{
    const rows=parts.flat();
    state.officialCameraRows=rows;
    return rows;
  }).catch(e=>{
    console.warn('official camera dataset load failed',e);
    state.officialCameraRows=[];
    return [];
  });
  return state.officialCameraPromise;
}
function pickField(obj,keys=[]){for(const k of keys){const v=obj?.[k];if(v!=null&&String(v).trim()!=='')return v}return ''}
function officialCameraType(raw=''){
  const s=String(raw||'').trim();
  if(/신호.*과속|과속.*신호|신호.*속도|속도.*신호/.test(s)||s==='3'||s==='4')return 'signal_speed_camera';
  if(/신호/.test(s)||s==='2'||s==='02')return 'signal_camera';
  if(/속도|과속/.test(s)||s==='1'||s==='01')return 'speed_camera';
  return 'traffic_camera';
}
function officialSectionPosition(row){
  const raw=String(pickField(row,['단속구간위치구분','sectionPosition','sectionPos'])||'').trim();
  if(/^(0?1|시점|시작)$/i.test(raw))return 'start';
  if(/^(0?2|종점|종료|끝)$/i.test(raw))return 'end';
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
function statedSectionLengthMeters(row){
  const raw=String(pickField(row,['과속단속구간길이','sectionLength'])||'').replace(/,/g,'').trim();
  const n=Number(raw);if(!(n>0))return 0;
  // 표준데이터는 km 단위 값(예: 4, 7)이 다수다. 50 이하는 km로, 그보다 큰 값은 m로 보조 해석한다.
  return n<=50?n*1000:n;
}
function buildSectionSpeedEvents(nodes,route){
  const cum=buildCumulative(route),g=route?.geometry||[];
  if(!cum.length||!g.length)return[];
  const starts=[],ends=[];
  const dedup=new Set();
  for(const n of nodes){
    const key=`${n.sectionPosition}:${Math.round(n.lat*100000)}:${Math.round(n.lng*100000)}:${n.maxspeed}`;
    if(dedup.has(key))continue;dedup.add(key);
    (n.sectionPosition==='start'?starts:ends).push(n);
  }
  starts.sort((a,b)=>a.routeIndex-b.routeIndex);ends.sort((a,b)=>a.routeIndex-b.routeIndex);
  const used=new Set(),events=[];
  for(const st of starts){
    let best=null,bestScore=Infinity;
    const stRoad=normalizeRoadName(st.roadName||''),stDist=cum[st.routeIndex]||0;
    for(const en of ends){
      if(used.has(en.id)||en.routeIndex<=st.routeIndex)continue;
      if(Number(en.maxspeed)!==Number(st.maxspeed))continue;
      const gap=(cum[en.routeIndex]||0)-stDist;if(gap<250||gap>30000)continue;
      const enRoad=normalizeRoadName(en.roadName||''),sameRoad=Boolean(stRoad&&enRoad&&(stRoad===enRoad||stRoad.includes(enRoad)||enRoad.includes(stRoad)));
      const stated=Number(st.sectionLengthMeters)||Number(en.sectionLengthMeters)||0;
      const lenPenalty=stated?Math.abs(gap-stated)/Math.max(600,stated):0;
      if(stated&&lenPenalty>1.15&&!sameRoad)continue;
      if(!stated&&!sameRoad&&gap>12000)continue;
      const score=gap/30000+(sameRoad?-1:0)+lenPenalty*2;
      if(score<bestScore){best=en;bestScore=score}
    }
    if(!best)continue;
    used.add(best.id);
    const startPoint=g[st.routeIndex],endPoint=g[best.routeIndex],sectionLength=(cum[best.routeIndex]||0)-(cum[st.routeIndex]||0);
    events.push({
      id:`section-speed:${st.id}:${best.id}`,type:'section_speed_camera',
      lat:startPoint[1],lng:startPoint[0],routeIndex:st.routeIndex,
      endLat:endPoint[1],endLng:endPoint[0],endRouteIndex:best.routeIndex,
      maxspeed:Number(st.maxspeed)||Number(best.maxspeed)||0,
      roadName:st.roadName||best.roadName||'',name:st.name||best.name||'구간단속',
      sectionLength,source:'전국무인교통단속카메라표준데이터(구간 시점·종점)'
    });
  }
  return events;
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
  const rows=await loadOfficialCameraRows();
  const geometry=route?.geometry||[]; if(!rows.length||!geometry.length)return [];
  const bounds=expandBounds(geometryBounds(geometry),1400),out=[],sectionNodes=[];
  for(const row of rows){
    const lat=Number(pickField(row,['위도','latitude','lat'])),lng=Number(pickField(row,['경도','longitude','lng','lon']));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!inBounds(lat,lng,bounds))continue;
    const idx=nearestIndex(lng,lat,geometry),p=geometry[idx]; if(!p)continue;
    const d=hav(lat,lng,p[1],p[0]); if(d>320)continue;
    const maxspeed=Number(pickField(row,['제한속도','lmttVe','speedLimit']))||0;
    const protectedArea=String(pickField(row,['보호구역구분','protectedArea'])).trim();
    const roadName=String(pickField(row,['도로노선명','도로명','roadName'])).trim();
    const name=String(pickField(row,['설치장소','itlpc','소재지도로명주소','소재지지번주소','도로노선명'])).trim()||'무인교통단속카메라';
    const manageNo=pickField(row,['무인교통단속카메라관리번호','mnlssRegltCameraManageNo'])||`${lat}:${lng}`;
    const sectionPosition=officialSectionPosition(row);

    if(sectionPosition&&maxspeed>0){
      sectionNodes.push({
        id:`local-section-node:${manageNo}`,sectionPosition,lat,lng,routeIndex:idx,name,maxspeed,roadName,
        sectionLengthMeters:statedSectionLengthMeters(row),source:'전국무인교통단속카메라표준데이터'
      });
      continue;
    }

    const type=officialBusLaneCamera(row)?'bus_lane_camera':officialCameraType(pickField(row,['단속구분','regltSe','규제구분']));
    const base={
      id:`local-camera:${manageNo}`,type,lat,lng,routeIndex:idx,name,maxspeed,
      authority:String(pickField(row,['관리기관명','institutionNm'])).trim(),
      protectedArea,roadName,source:'전국무인교통단속카메라표준데이터(로컬 파일)'
    };
    out.push(base);
    if(/어린이|스쿨|school/i.test(protectedArea)){
      out.push({...base,id:`${base.id}:school`,type:'school_zone',name:`${name} 어린이보호구역`,maxspeed:maxspeed||30});
    }
  }
  out.push(...buildSectionSpeedEvents(sectionNodes,route));
  return mergeSafetyEvents(out,geometry);
}
function normalizeRoadName(v=''){return String(v||'').replace(/\s+/g,'').replace(/(대로|로|길|거리)$/,'').toLowerCase()}
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
      if(state.tripStartedAt&&state.safetyEvents?.length)renderSafetyMarkers();

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
function enforce2DMap(){
  if(!state.map||state.map3D)return;
  try{state.map.jumpTo({pitch:0});setBuildingExtrusions(false)}catch(e){console.warn('2D map enforcement failed',e)}
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
      state.map.on('zoomend',()=>{if(state.onnuriData)renderOnnuriMarkers(state.onnuriData);if(state.localVoucherData)renderLocalVoucherMarkers(state.localVoucherData);if(state.tripStartedAt&&state.safetyEvents?.length)renderSafetyMarkers()});
      state.map.on('moveend',()=>{scheduleLocalVoucherRefresh();scheduleOnnuriRefresh();scheduleHomeCameraRefresh()});
      state.map.on('style.load',()=>{if(state.mapReady)restoreMapOverlaysAfterStyleChange()});
      if(state.pendingRouteDraw){const p=state.pendingRouteDraw;state.pendingRouteDraw=null;drawRoute(p.route,p.options)}
      permissionStatus('geolocation').then(async status=>{
        try{
          const u=await locate(status==='granted');
          if(u&&pointValid(u)&&state.map)state.map.easeTo({center:[u.lng,u.lat],zoom:15.5,duration:450});
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
  state.mapPlaceCandidate=place;
  if($('mapPlacePromptTitle'))$('mapPlacePromptTitle').textContent=place?.name||'이 위치';
  const voucher=place?.voucher;
  if($('mapPlacePromptText')){
    if(voucher){
      const uses=voucherUseFlags(voucher);
      const unavailable=['카드','모바일','지류'].filter(x=>!uses.includes(x));
      $('mapPlacePromptText').textContent=`사용 가능: ${uses.length?uses.join(' · '):'정보 없음'}${unavailable.length?` · 미지원: ${unavailable.join(' · ')}`:''}`;
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
  closeMapPlacePrompt();setHomeSheetCollapsed(false);await chooseDestination(p,{autoGuide:true});
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
function renderOnnuriShopMarkers(items){
  for(const item of items||[]){
    if(!Number.isFinite(Number(item.lng))||!Number.isFinite(Number(item.lat)))continue;
    const el=document.createElement('button');
    el.type='button';el.className='onnuri-shop-marker';
    el.title=item.name||'온누리상품권 가맹점';
    el.innerHTML=onnuriShopSvg();
    el.onclick=e=>{e.stopPropagation();openOnnuriStoreInfo(item)};
    try{state.onnuriMarkers.push(new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([Number(item.lng),Number(item.lat)]).addTo(state.map))}catch{}
  }
}
function renderOnnuriClusterMarkers(clusters){
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
      try{
        if(lngs.length===1)state.map.easeTo({center:[lngs[0],lats[0]],zoom:Math.max(state.map.getZoom(),16.5),duration:420});
        else state.map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:70,maxZoom:16.5,duration:420});
      }catch{}
    };
    try{state.onnuriMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([c.lng,c.lat]).addTo(state.map))}catch{}
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
function currentWhereItems(){
  const source=state.whereToTab==='onnuri'?state.onnuriData:state.localVoucherData;
  return merchantDistanceSorted(source?.items||[]).slice(0,100);
}
function renderWhereToList(){
  const box=$('whereToList');if(!box)return;
  document.querySelectorAll('[data-where-tab]').forEach(b=>b.classList.toggle('active',b.dataset.whereTab===state.whereToTab));
  const items=currentWhereItems();
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
      const tag=approx
        ? (Number(x.fallbackCount)>1?`대표 구역 위치 · 원천 ${Number(x.fallbackCount).toLocaleString()}곳`:'대표 구역 위치')
        : (x.precision==='exact-address-geocode'?'상세주소 위치 확인':'가맹점 위치 확인');
      return `<button type="button" class="where-to-item ${approx?'where-to-zone-item':''}" data-where-index="${i}">
        <span class="where-to-rank">${i+1}</span>
        <span class="where-to-info">
          <b>${escapeHtml(x.name||'온누리상품권 가맹점')}</b>
          <small>${escapeHtml(loc)}</small>
          <em>온누리상품권 · ${escapeHtml(x.market||'상점가 미상')} · ${tag}</em>
        </span>
        <strong>${whereDistanceLabel(x._distance)}</strong>
      </button>`;
    }
    const use=voucherUseFlags(x).join(' · ');
    return `<button type="button" class="where-to-item" data-where-index="${i}">
      <span class="where-to-rank">${i+1}</span>
      <span class="where-to-info"><b>${escapeHtml(x.name||'가맹점')}</b><small>${escapeHtml(x.address||'주소 정보 없음')}</small><em>${escapeHtml(use||'지역사랑상품권')}</em></span>
      <strong>${whereDistanceLabel(x._distance)}</strong>
    </button>`;
  }).join('');

  box.querySelectorAll('[data-where-index]').forEach(btn=>btn.onclick=async()=>{
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
  });
}
async function refreshWhereTo(){
  const label=$('whereToLocationLabel');
  if(label)label.textContent='현재 위치 확인 중';
  try{
    if(!pointValid(state.user)){
      const u=await locate(false);
      if(!u)return;
    }
    if(label)label.textContent='현재 위치 기준 · 가까운 순';
    if(state.map&&pointValid(state.user)){
      try{state.map.jumpTo({center:[state.user.lng,state.user.lat],zoom:15.7})}catch{}
    }
    renderWhereToList();
    await Promise.allSettled([loadLocalVoucherMap({force:true}),loadOnnuriMap({force:true})]);
    renderWhereToList();
  }catch(e){
    console.warn('where-to refresh failed',e);
    renderWhereToList();
  }
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
function renderOnnuriZoneMarkers(zones){
  for(const zone of zones||[]){
    const lng=Number(zone.lng),lat=Number(zone.lat);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    const el=document.createElement('button');
    el.type='button';
    el.className='onnuri-zone-marker';
    el.title=`${zone.name||zone.market||'온누리상품권 구역'} · ${Number(zone.count||zone.merchantCount||0)}곳`;
    el.innerHTML=`<span class="onnuri-zone-pin">${onnuriShopSvg()}</span><span class="onnuri-zone-label"><b>${escapeHtml(zone.name||zone.market||'시장·상점가')}</b><small>${Number(zone.count||zone.merchantCount||0)}곳</small></span>`;
    el.onclick=e=>{e.stopPropagation();openOnnuriZoneInfo(zone)};
    try{
      state.onnuriMarkers.push(
        new maplibregl.Marker({element:el,anchor:'bottom'})
          .setLngLat([lng,lat]).addTo(state.map)
      );
    }catch{}
  }
}

function renderOnnuriMarkers(data){
  clearOnnuriMarkers();
  if(!state.map||!maplibregl?.Marker||state.tripStartedAt||$('homeView')?.classList.contains('hidden'))return;
  const items=(data?.items||[]).filter(x=>Number.isFinite(Number(x.lng))&&Number.isFinite(Number(x.lat))).slice(0,1500);
  if(!items.length)return;

  const precise=items.filter(x=>!x.approximate && x.precision!=='market-zone' && x.precision!=='admin-zone');
  const fallback=items.filter(x=>x.approximate || x.precision==='market-zone' || x.precision==='admin-zone');

  // 정확히 찾은 점포는 기존 개별 가맹점 마커로 표시
  if(precise.length){
    if(mapVisibleWidthMeters()<1200)renderOnnuriShopMarkers(precise);
    else renderOnnuriClusterMarkers(clusterMapItemsByPixel(precise,68));
  }

  // 좌표를 못 찾은 점포는 시장/상점가 대표 구역 단위로만 표시
  if(fallback.length){
    const groups=new Map();
    for(const x of fallback){
      const key=x.market||x.matchedAddress||'온누리상품권 구역';
      if(!groups.has(key))groups.set(key,{name:key,market:key,count:0,lng:Number(x.lng),lat:Number(x.lat),regionLabel:x.matchedAddress||'',locationPrecision:x.precision});
      groups.get(key).count++;
    }
    renderOnnuriZoneMarkers([...groups.values()]);
  }
}
function readOnnuriStaleCache(){
  try{
    const raw=localStorage.getItem('jofams_onnuri_map_cache_v2');
    if(!raw)return null;
    const d=JSON.parse(raw);
    if(!d?.payload||Date.now()-Number(d.savedAt||0)>24*60*60*1000)return null;
    return d.payload;
  }catch{return null}
}
function writeOnnuriStaleCache(payload){
  try{
    if(payload?.items?.length)localStorage.setItem('jofams_onnuri_map_cache_v2',JSON.stringify({savedAt:Date.now(),payload}));
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
    return d>=Math.max(600,Number.isFinite(r)?r*.35:1200);
  })();
  if(!force&&!moved&&state.onnuriData?.items?.length&&Date.now()-Number(state.onnuriLoadedAt||0)<90000)return;

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
  state.onnuriLoadTimer=setTimeout(()=>loadOnnuriMap({force:Boolean(force)}),320);
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
function renderVoucherShopMarkers(items){
  for(const item of (items||[])){
    const lng=Number(item.lng),lat=Number(item.lat);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    const el=document.createElement('button');
    el.type='button';
    el.className='voucher-shop-marker';
    el.title=item.name||'지역사랑상품권 가맹점';
    el.innerHTML=voucherShopSvg();
    el.onclick=e=>{e.stopPropagation();openVoucherStoreInfo(item)};
    try{
      state.localVoucherMarkers.push(
        new maplibregl.Marker({element:el,anchor:'bottom'})
          .setLngLat([lng,lat]).addTo(state.map)
      );
    }catch{}
  }
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
  for(const c of clusters){
    const el=document.createElement('button');
    el.type='button';
    const size=c.count>=25?'large':c.count>=8?'medium':'small';
    el.className=`voucher-cluster-marker ${size}`;
    el.title=`가맹점 ${c.count}곳 · 확대하면 개별 매장이 표시됩니다`;
    el.innerHTML=`<strong>${c.count>99?'99+':c.count}</strong>`;
    el.onclick=e=>{
      e.stopPropagation();
      try{
        const lngs=c.items.map(x=>Number(x.lng)).filter(Number.isFinite);
        const lats=c.items.map(x=>Number(x.lat)).filter(Number.isFinite);
        if(!lngs.length||!lats.length)return;
        if(lngs.length===1){state.map.easeTo({center:[lngs[0],lats[0]],zoom:Math.max(state.map.getZoom(),16.5),duration:420});return}
        state.map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:70,maxZoom:16.5,duration:420});
      }catch{}
    };
    try{
      state.localVoucherMarkers.push(
        new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat([c.lng,c.lat]).addTo(state.map)
      );
    }catch{}
  }
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
  const visibleWidthMeters=voucherVisibleRadiusMeters()*2;
  const zoomedInEnoughForIndividualPins=Number.isFinite(visibleWidthMeters)&&visibleWidthMeters<1000;

  if(zoomedInEnoughForIndividualPins){
    renderVoucherShopMarkers(items);
  }else{
    renderVoucherClusterMarkers(clusterVoucherItemsByPixel(items));
  }
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
    const threshold=Number.isFinite(radius)&&radius>0?Math.max(800,radius*0.35):1500;
    return dist>=threshold;
  })();

  if(!force&&!movedFarEnough&&Date.now()-Number(state.localVoucherLoadedAt||0)<45000&&state.localVoucherData)return;

  try{
    const b=state.map.getBounds?.();
    const u=new URL('/api/local-voucher',location.origin);
    u.searchParams.set('lng',center.lng);u.searchParams.set('lat',center.lat);
    if(state.localVoucherRegionCode)u.searchParams.set('regionCode',state.localVoucherRegionCode);
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
function scheduleLocalVoucherRefresh(){
  clearTimeout(state.localVoucherLoadTimer);
  state.localVoucherLoadTimer=setTimeout(()=>loadLocalVoucherMap(),450);
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
    const corrective=Math.max(0,minY-p.y);
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
function makeCarMarker(){const el=document.createElement('div');el.className='character-car-marker rear-version';el.classList.toggle('walking-character-marker',isWalkingGuide());el.innerHTML=`<img src="${characterGuideImage('rear')}" alt="${characterDefs[state.character].name}">`;return new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'viewport'});}
function updateCarMarkerImage(){
  const el=state.userMarker?.getElement();if(!el)return;
  el.classList.toggle('walking-character-marker',isWalkingGuide());
  const img=el.querySelector('img');if(img)img.src=characterGuideImage('rear');
}
function makeDestMarker(){const el=document.createElement('div');el.className='destination-pin';return new maplibregl.Marker({element:el,anchor:'bottom'})}
function updateUserMarkerMotion(){
  const moving=Boolean(state.tripStartedAt)&&Math.max(0,Number(state.user?.speed)||0)>.35;
  const el=state.userMarker?.getElement();if(el)el.classList.toggle('jofams-car-moving',moving);
  if(state.tripStartedAt)setTimeout(alignDriveCharacterWithSpeedLimit,0);
  const ar=$('driveArCharacter');if(ar)ar.classList.toggle('moving',moving&&state.arCameraMode);const arMarker=$('arCharacterMarker');if(arMarker)arMarker.classList.toggle('moving',moving&&state.arRunning);
  const img=$('driveArCharacterImg');if(img)img.src=characterGuideImage('rear');
}
function scheduleSmoothDriveMarker(){
  if(state.driveMarkerRaf)return;
  const frame=(ts)=>{
    state.driveMarkerRaf=0;
    if(!state.tripStartedAt||!state.userMarker||!state.route?.geometry?.length)return;
    const currentSpeed=Math.max(0,Number(state.user?.speed)||0);
    const target=Number(state.driveMarkerTargetDistance);
    if(!Number.isFinite(target))return;
    let rendered=Number(state.driveMarkerRenderedDistance);
    if(!Number.isFinite(rendered))rendered=target;
    if(!state.simulationActive&&(state.stationaryActive||currentSpeed<=0.05)){
      // 실제 속도가 0이면 목표 거리로 끌어가지 않고 현재 렌더링 위치에 완전히 고정한다.
      if(!Number.isFinite(rendered))rendered=Number(state.routeLockedDistance)||target;
      state.driveMarkerRenderedDistance=rendered;
      state.driveMarkerTargetDistance=rendered;
      const stopped=pointAtRouteDistance(rendered);
      if(stopped)state.userMarker.setLngLat([stopped.lng,stopped.lat]);
      return;
    }
    const last=Number(state.driveMarkerFrameAt)||ts;
    const dt=Math.max(.008,Math.min(.08,(ts-last)/1000));
    state.driveMarkerFrameAt=ts;

    // Exponential easing along route distance; never interpolate straight across a curve.
    const tau=state.gpsEstimated?.34:.22;
    const alpha=1-Math.exp(-dt/tau);
    let next=rendered+(target-rendered)*alpha;
    // Forward movement is monotonic; avoid one-frame teleport after GPS recovery.
    const speed=Math.max(1.5,Number(state.user?.speed)||0);
    const maxStep=Math.max(.45,speed*dt*1.65+1.2);
    next=Math.min(next,rendered+maxStep);
    if(target<rendered)next=Math.max(target,rendered-Math.max(.25,maxStep*.25));

    const p=pointAtRouteDistance(next);
    if(p){
      state.driveMarkerRenderedDistance=next;
      state.userMarker.setLngLat([p.lng,p.lat]);
    }
    if(Math.abs(target-next)>.12){
      state.driveMarkerRaf=requestAnimationFrame(frame);
    }else{
      state.driveMarkerRenderedDistance=target;
      const q=pointAtRouteDistance(target);if(q)state.userMarker.setLngLat([q.lng,q.lat]);
    }
  };
  state.driveMarkerRaf=requestAnimationFrame(frame);
}
function ensureUserMarker(){
  if(!state.user||!state.map)return;
  if(!state.userMarker){
    state.userMarker=makeCarMarker().setLngLat([state.user.lng,state.user.lat]).addTo(state.map);
    state.driveMarkerRenderedDistance=Number(state.user.routeDistance);
  }
  if(state.tripStartedAt&&state.route?.geometry?.length&&Number.isFinite(Number(state.user.routeDistance))){
    const incomingRouteDistance=Number(state.user?.routeDistance);
  const realSpeed=Math.max(0,Number(state.user?.speed)||0);
  if(state.tripStartedAt&&!state.simulationActive&&(state.stationaryActive||realSpeed<=0.05)&&Number.isFinite(Number(state.driveMarkerRenderedDistance))){
    // 정지 중에는 GPS/맵매칭 오차가 앞쪽 점을 잡더라도 캐릭터 목표거리를 갱신하지 않는다.
    state.driveMarkerTargetDistance=Number(state.driveMarkerRenderedDistance);
  }else if(Number.isFinite(incomingRouteDistance)){
    state.driveMarkerTargetDistance=incomingRouteDistance;
  }
    if(!Number.isFinite(Number(state.driveMarkerRenderedDistance)))state.driveMarkerRenderedDistance=Number(state.user.routeDistance);
    scheduleSmoothDriveMarker();
  }else state.userMarker.setLngLat([state.user.lng,state.user.lat]);
  updateUserMarkerMotion();
}
function setDestinationMarker(){if(state.destMarker)state.destMarker.remove();if(state.destination&&state.map)state.destMarker=makeDestMarker().setLngLat([state.destination.lng,state.destination.lat]).addTo(state.map)}
function updateOriginMarker(){if(state.originMarker){state.originMarker.remove();state.originMarker=null}if(state.originMode!=='custom'||!state.origin||!state.map)return;const el=document.createElement('div');el.className='origin-pin';state.originMarker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([state.origin.lng,state.origin.lat]).addTo(state.map)}
function trafficClassFromValues(speed,stateCode){
  const st=Number(stateCode)||0,sp=Number(speed)||0;
  // Kakao Mobility 공식 traffic_state: 1=정체(heavy), 2=지체(delayed), 3=서행(slow), 4=원활(smooth), 6=사고/통행불가.
  // 공급자 상태값이 있으면 이를 우선하고, 상태값 0(정보 없음)일 때만 속도 기준으로 보조 판단한다.
  if(st===4)return{key:'smooth',label:'원활',color:'#16a36a'};
  if(st===3)return{key:'slow',label:'서행',color:'#f0a400'};
  if(st===2)return{key:'delayed',label:'지체 · 혼잡',color:'#ef6c35'};
  if(st===1||st===6)return{key:'severe',label:st===6?'사고 · 통행주의':'정체 · 극심한 정체',color:'#d82f3c'};
  if(sp>0){if(sp>=40)return{key:'smooth',label:'원활',color:'#16a36a'};if(sp>=20)return{key:'slow',label:'서행',color:'#f0a400'};return{key:'severe',label:'정체 · 극심한 정체',color:'#d82f3c'}}
  return{key:'unknown',label:'교통정보 확인 중',color:'#9aa6b5'};
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
function drawRoute(route=state.route,{fit=true}={}){
  if(!route?.geometry?.length||!state.map)return;
  if(!state.mapReady||!state.map.isStyleLoaded()){state.pendingRouteDraw={route,options:{fit}};return}
  const data={type:'Feature',geometry:{type:'LineString',coordinates:route.geometry},properties:{}};
  if(state.map.getSource('route'))state.map.getSource('route').setData(data);else{
    state.map.addSource('route',{type:'geojson',data});
    state.map.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':10,'line-opacity':.95}});
    state.map.addLayer({id:'route-main',type:'line',source:'route',paint:{'line-color':'#1c72f2','line-width':7,'line-opacity':1}});
  }
  const traffic=buildTrafficGeoJson(route);
  if(state.map.getSource('route-traffic'))state.map.getSource('route-traffic').setData(traffic);else{
    state.map.addSource('route-traffic',{type:'geojson',data:traffic});
    state.map.addLayer({id:'route-traffic',type:'line',source:'route-traffic',paint:{'line-color':['get','color'],'line-width':5.2,'line-opacity':.96}});
  }
  if(fit){const b=new maplibregl.LngLatBounds();route.geometry.forEach(p=>b.extend(p));state.map.fitBounds(b,{padding:{top:100,bottom:310,left:36,right:36},duration:650})}
}
function clearRouteLayer(){['route-traffic','route-main','route-shadow'].forEach(id=>{if(state.map?.getLayer(id))state.map.removeLayer(id)});['route-traffic','route'].forEach(id=>{if(state.map?.getSource(id))state.map.removeSource(id)})}

/* ---------- LOCATION ---------- */
async function locate(fly=true){
  if(state.permissionPrefs?.location===false){
    toast('MY에서 위치정보 조회 동의를 켜 주세요.');
    return null;
  }

  // Android WebView에서는 브라우저 geolocation보다 네이티브 Fused Location을 먼저 요청한다.
  if(nativeBridgeAvailable()){
    nativePost('requestLocation',{highAccuracy:true});
    const started=Date.now();
    while(Date.now()-started<2200){
      if(pointValid(state.user)&&Date.now()-Number(state.nativeLocationAt||0)<5000){
        if(fly&&state.map)state.map.easeTo({center:[state.user.lng,state.user.lat],zoom:16,duration:350});
        return state.user;
      }
      await new Promise(r=>setTimeout(r,100));
    }
  }

  if(!navigator.geolocation){
    toast('위치 기능을 지원하지 않습니다.');
    return pointValid(state.user)?state.user:null;
  }

  return new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(
      p=>{applyGps(p,fly);resolve(state.user)},
      err=>{
        console.warn('browser geolocation failed',err?.code,err?.message);
        if(pointValid(state.user)){resolve(state.user);return}
        toast('현재 위치를 확인할 수 없습니다. 휴대폰 위치 권한과 GPS를 확인해 주세요.');
        resolve(null);
      },
      {enableHighAccuracy:true,timeout:6500,maximumAge:5000}
    );
  });
}
function applyGps(pos,fly=false){
  if(state.simulationActive)return;
  if(state.permissionPrefs?.location===false)return;
  const native=Boolean(pos?.native),now=Date.now();
  const wasEstimated=Boolean(state.gpsEstimated||state.user?.estimated);
  if(!native&&state.nativeLocationAt&&now-state.nativeLocationAt<2200)return;

  const c=pos.coords||pos,stateObj={
    lng:Number(c.longitude??c.lng),lat:Number(c.latitude??c.lat),
    speed:Number(c.speed),heading:Number(c.heading),accuracy:Number(c.accuracy)||0,
    estimated:false,native
  };
  if(!pointValid(stateObj))return;

  const rawLat=stateObj.lat,rawLng=stateObj.lng,sampleTime=Number(pos?.timestamp)||now;
  const reportedSpeed=Number(c.speed);
  let forceStationary=false;

  // 실제 GPS 속도가 0이고 최초 정지 GPS 기준 ±10m 안이면 캐릭터/경로 진행을 완전히 고정한다.
  // 이 구간에서는 GPS 위치 흔들림으로 계산한 파생속도도 사용하지 않는다.
  if(state.tripStartedAt&&!state.simulationActive&&Number.isFinite(reportedSpeed)&&reportedSpeed<=0.05){
    if(!state.stationaryGpsAnchor){
      state.stationaryGpsAnchor={
        lat:rawLat,lng:rawLng,
        routeDistance:Number.isFinite(Number(state.driveMarkerRenderedDistance))
          ?Number(state.driveMarkerRenderedDistance)
          :(Number.isFinite(Number(state.routeLockedDistance))
            ?Number(state.routeLockedDistance)
            :Number(state.user?.routeDistance))
      };
    }
    const stationaryDrift=hav(state.stationaryGpsAnchor.lat,state.stationaryGpsAnchor.lng,rawLat,rawLng);
    if(Number.isFinite(stationaryDrift)&&stationaryDrift<=10){
      forceStationary=true;
      state.stationaryActive=true;
      stateObj.speed=0;
    }else{
      state.stationaryGpsAnchor=null;
      state.stationaryActive=false;
    }
  }else if(Number.isFinite(reportedSpeed)&&reportedSpeed>0.05){
    state.stationaryGpsAnchor=null;
    state.stationaryActive=false;
  }
  const prevSpeedSample=state.lastSpeedSample;
  if(prevSpeedSample&&sampleTime>prevSpeedSample.t){
    const dt=(sampleTime-prevSpeedSample.t)/1000;
    const dist=hav(prevSpeedSample.lat,prevSpeedSample.lng,stateObj.lat,stateObj.lng);
    if(dt>=.25&&dt<=5&&Number.isFinite(dist)){
      const jitter=Math.max(1.5,Math.min(6,((prevSpeedSample.accuracy||0)+(stateObj.accuracy||0))*.18));
      const derived=dist>=jitter?Math.min(70,dist/dt):(dist<1.5?0:NaN);
      if(!forceStationary){
        if(Number.isFinite(derived)&&(!Number.isFinite(stateObj.speed)||(stateObj.speed<.7&&derived>=.7)))stateObj.speed=derived;
        else if(Number.isFinite(derived)&&Number.isFinite(stateObj.speed)&&stateObj.speed>=.7)stateObj.speed=stateObj.speed*.78+derived*.22;
      }else stateObj.speed=0;
    }
  }
  state.lastSpeedSample={lat:stateObj.lat,lng:stateObj.lng,t:sampleTime,accuracy:stateObj.accuracy};
  if(state.tripStartedAt&&now-sampleTime>4500)return;

  if(forceStationary)state.lastRealSpeedMps=0;
  else if(Number.isFinite(stateObj.speed)&&stateObj.speed>=0)state.lastRealSpeedMps=stateObj.speed;
  if(Number.isFinite(stateObj.heading))state.lastRealHeading=stateObj.heading;
  state.lastRealGpsAt=now;state.lastGpsTickAt=now;state.deadReckoningLastAt=now;state.gpsEstimated=false;
  if(!Number.isFinite(stateObj.speed))stateObj.speed=state.lastRealSpeedMps||0;
  if(!Number.isFinite(stateObj.heading))stateObj.heading=state.lastRealHeading;

  // 원시 GPS는 반드시 보존: 실제 이탈 판정/도착 판정에 사용.
  stateObj.rawLat=rawLat;stateObj.rawLng=rawLng;

  if(state.tripStartedAt&&state.route?.geometry?.length){
    // 주행 화면 위치는 항상 현재 경로에 강제 스냅.
    const locked=lockDisplayPositionToRoute(stateObj,now);
    if(locked&&wasEstimated){
      // 터널 출구 첫 GPS가 DR 위치보다 앞서더라도 한 프레임에 따라잡지 않는다.
      const simulated=Number(state.deadReckoningDistance);
      if(Number.isFinite(simulated)&&locked.distance>simulated+12){
        const cap=simulated+Math.max(5,(Number(stateObj.speed)||0)*1.2);
        const q=pointAtRouteDistance(Math.min(locked.distance,cap));
        if(q){locked.lng=q.lng;locked.lat=q.lat;locked.heading=q.heading;locked.index=q.index;locked.distance=q.distance}
      }
    }
    if(locked){
      if(forceStationary){
        let fixedDistance=Number(state.stationaryGpsAnchor?.routeDistance);
        if(!Number.isFinite(fixedDistance))fixedDistance=Number(state.driveMarkerRenderedDistance);
        if(!Number.isFinite(fixedDistance))fixedDistance=Number(state.routeLockedDistance);
        if(!Number.isFinite(fixedDistance))fixedDistance=Number(locked.distance);
        const fixed=pointAtRouteDistance(fixedDistance);
        if(fixed){
          locked.lng=fixed.lng;locked.lat=fixed.lat;locked.heading=fixed.heading;
          locked.index=fixed.index;locked.distance=fixed.distance;
          state.stationaryGpsAnchor.routeDistance=fixed.distance;
          state.routeLockedDistance=fixed.distance;
          state.routeLockedAt=now;
        }
      }
      stateObj.lng=locked.lng;stateObj.lat=locked.lat;stateObj.heading=locked.heading;
      stateObj.mapSnapped=true;stateObj.routeIndex=locked.index;stateObj.routeDistance=locked.distance;
      stateObj.matchConfidence=Number(locked.confidence)||0;
    }else{
      const fused=fuseGpsFix({lat:rawLat,lng:rawLng,heading:stateObj.heading,speed:stateObj.speed,accuracy:stateObj.accuracy},now);
      stateObj.lng=fused.lng;stateObj.lat=fused.lat;
      if(Number.isFinite(fused.heading))stateObj.heading=fused.heading;
      stateObj.mapSnapped=Boolean(fused.mapSnapped);
      stateObj.routeIndex=Number.isFinite(fused.routeIndex)?fused.routeIndex:null;
      stateObj.routeDistance=Number.isFinite(fused.routeDistance)?fused.routeDistance:null;
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
  if(!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative.length||!state.user)return;
  const now=Date.now(),sinceReal=now-(state.lastRealGpsAt||0);
  // 실제 정지 상태에서는 마지막 주행속도를 재사용한 추정주행을 절대 시작하지 않는다.
  if(state.stationaryActive||Math.max(0,Number(state.user?.speed)||0)<=0.05){
    state.deadReckoningLastAt=now;
    state.lastRealSpeedMps=0;
    state.user.speed=0;
    updateUserMarkerMotion();
    return;
  }
  if(sinceReal<2500||sinceReal>180000)return;

  if(!state.gpsEstimated){
    state.tunnelEntrySpeedMps=Math.max(0,Number(state.lastRealSpeedMps)||Number(state.user.speed)||0);
    state.tunnelEntryAt=now;
  }
  let speed=simulatedTunnelSpeedMps(state.currentRouteIndex,Number(state.lastRealSpeedMps)||Number(state.user.speed)||0);
  const imuFresh=state.imu&&now-state.imu.at<1200;
  if(imuFresh&&Number(state.imu.accelMagnitude)>1.8)speed=Math.max(0,Math.min(55,speed+Math.min(.8,Number(state.imu.accelMagnitude)*.035)));
  if(speed<.35){state.deadReckoningLastAt=now;state.user.speed=0;updateUserMarkerMotion();return}

  const last=state.deadReckoningLastAt||state.lastGpsTickAt||now;
  const dt=Math.min(1.0,Math.max(.15,(now-last)/1000));
  state.deadReckoningLastAt=now;state.lastGpsTickAt=now;

  if(!Number.isFinite(state.deadReckoningDistance)){
    const idx=Math.max(0,nearestIndex(state.user.lng,state.user.lat,state.route.geometry));
    state.deadReckoningDistance=Number(state.routeCumulative[idx])||0;
  }
  updateTunnelRouteLock(state.currentRouteIndex);
  state.deadReckoningDistance=Math.min(state.routeCumulative.at(-1)||Infinity,state.deadReckoningDistance+speed*dt);

  let p=state.tunnelRouteLock?.active?forceTunnelPointOnRoute(speed,now,state.deadReckoningDistance):pointAtRouteDistance(state.deadReckoningDistance);
  if(!p)return;
  if(!state.tunnelRouteLock?.active&&imuFresh&&Math.abs(Number(state.imu.yawRateDegS)||0)>4){
    p.heading=circularLerp(p.heading,(Number(state.user.heading)||p.heading)+(Number(state.imu.yawRateDegS)||0)*dt,.10);
  }

  state.currentRouteIndex=p.index;
  state.user={...state.user,lng:p.lng,lat:p.lat,speed,heading:p.heading,routeIndex:p.index,routeDistance:p.distance,accuracy:Math.max(45,Number(state.user.accuracy)||0),estimated:true};
  state.gpsEstimated=true;

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
function startDeadReckoning(){clearInterval(state.deadReckoningTimer);state.deadReckoningLastAt=Date.now();state.deadReckoningTimer=setInterval(deadReckoningTick,500)}
function stopDeadReckoning(){clearInterval(state.deadReckoningTimer);state.deadReckoningTimer=0;state.gpsEstimated=false;state.deadReckoningDistance=null;state.deadReckoningLastAt=0}
function startWatch(){if(state.permissionPrefs?.location===false)return;if(nativeBridgeAvailable())setNativeNavigationActive(true);if(state.watchId!=null)return;state.watchId=navigator.geolocation.watchPosition(p=>applyGps(p,false),()=>{}, {enableHighAccuracy:true,maximumAge:0,timeout:7000});startDeadReckoning()}
function stopWatch(){if(nativeBridgeAvailable())setNativeNavigationActive(false);if(state.watchId!=null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null}state.nativeLocationActive=false;stopDeadReckoning()}


/* ---------- LIVE FUEL PRICE / OPINET ---------- */
const FUEL_PRODUCT_NAMES={B027:'휘발유',D047:'경유',B034:'고급휘발유',K015:'LPG'};
function fuelWon(v){const n=Number(v);return Number.isFinite(n)&&n>0?`${Math.round(n).toLocaleString('ko-KR')}원`:'가격없음'}
function fuelBrandName(code){
  return ({SKE:'SK',GSC:'GS칼텍스',HDO:'HD현대오일뱅크',SOL:'S-OIL',RTE:'알뜰',RTX:'고속도로알뜰',NHO:'농협알뜰',ETC:'자가상표',E1G:'E1',SKG:'SK가스'})[code]||code||'';
}
function fuelFreshEnough(){return state.fuelData&&Date.now()-Number(state.fuelFetchedAt||0)<5*60*1000}
async function loadFuelPrices(product=state.fuelProduct,{force=false,modal=false}={}){
  state.fuelProduct=product||'B027';
  syncFuelTabs();
  if(!state.user)await locate(false);
  if(!state.user){
    renderFuelLocationError();
    return;
  }
  if(!force&&fuelFreshEnough()&&state.fuelData?.product===state.fuelProduct){
    renderFuelData(state.fuelData);return;
  }
  if(state.fuelLoading)return;
  state.fuelLoading=true;
  renderFuelLoading();
  try{
    const u=new URL('/api/fuel',location.origin);
    u.searchParams.set('lat',state.user.lat);u.searchParams.set('lng',state.user.lng);
    u.searchParams.set('prodcd',state.fuelProduct);u.searchParams.set('cnt','8');
    const res=await fetch(u,{headers:{accept:'application/json'}});
    const d=await res.json().catch(()=>({}));
    if(!res.ok){
      const err=new Error(d?.error||`유가 조회 실패 (${res.status})`);
      err.code=d?.code||'';
      throw err;
    }
    state.fuelData=d;state.fuelFetchedAt=Date.now();
    try{localStorage.setItem('jofams_fuel_last_success_v1',JSON.stringify({savedAt:Date.now(),payload:d}))}catch{}
    renderFuelData(d);
  }catch(e){
    // 일시적인 서버/외부 API 오류라면 마지막 정상 유가를 우선 표시한다.
    let cached=null;
    try{
      const raw=JSON.parse(localStorage.getItem('jofams_fuel_last_success_v1')||'null');
      if(raw?.payload&&Date.now()-Number(raw.savedAt||0)<6*60*60*1000)cached=raw.payload;
    }catch{}
    if(cached){
      state.fuelData=cached;state.fuelFetchedAt=Number(Date.now()-5*60*1000);
      renderFuelData(cached);
      toast('실시간 유가 연결이 지연되어 최근 정상 유가를 표시합니다.',2400);
    }else{
      renderFuelError(e?.message||'유가 정보를 불러오지 못했습니다.',e?.code||'');
    }
  }
  finally{state.fuelLoading=false}
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
  const area=data?.areaName||'현재 지역';
  const items=(data?.stations||[]).filter(x=>Number(x.price)>0);
  const min=items.length?Math.min(...items.map(x=>Number(x.price))):0;
  const avg=Number(data?.averagePrice)||0;
  if($('fuelAreaLabel'))$('fuelAreaLabel').textContent=area;
  if($('fuelModalArea'))$('fuelModalArea').textContent=`${area} · ${FUEL_PRODUCT_NAMES[state.fuelProduct]||''}`;
  if($('fuelPriceSummary'))$('fuelPriceSummary').innerHTML=`<span>${escapeHtml(area)} ${escapeHtml(FUEL_PRODUCT_NAMES[state.fuelProduct]||'')}</span><b>${min?`최저 ${fuelWon(min)}`:'가격정보 없음'}${avg?` <small>평균 ${fuelWon(avg)}</small>`:''}</b>`;
  const rows=fuelStationRows(data);
  if($('fuelStationList')){$('fuelStationList').innerHTML=rows;bindFuelStationRowClicks($('fuelStationList'),items)}
  if($('fuelModalList')){$('fuelModalList').innerHTML=rows;bindFuelStationRowClicks($('fuelModalList'),items)}
  const chip=$('driveFuelChip');
  if(chip&&state.tripStartedAt&&items.length){
    $('driveFuelPrice').textContent=fuelWon(items[0].price);
    $('driveFuelName').textContent=items[0].name||'주유소';
    chip.classList.remove('hidden');
  }
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
function renderFuelError(message,code=''){
  const safe=escapeHtml(message||'유가 정보를 불러오지 못했습니다.');
  const keyProblem=code==='OPINET_KEY_MISSING'||code==='OPINET_KEY_REJECTED';
  const detail=keyProblem
    ?'<small>오피넷 서버 인증키 연결 상태를 확인해 주세요.</small>'
    :'<small>오피넷 또는 네트워크 연결이 일시적으로 지연되고 있습니다.</small>';
  const msg=`<div class="fuel-empty fuel-error">${safe}<br>${detail}</div>`;
  if($('fuelStationList'))$('fuelStationList').innerHTML=msg;
  if($('fuelModalList'))$('fuelModalList').innerHTML=msg;
}
function openFuelModal(){
  $('fuelModal').classList.remove('hidden');syncFuelTabs();
  if(state.fuelData)renderFuelData(state.fuelData);else loadFuelPrices(state.fuelProduct,{force:false,modal:true});
}
function closeFuelModal(){$('fuelModal').classList.add('hidden')}

/* ---------- SEARCH / SAVED PLACES ---------- */
function isNearbySearchQuery(q=''){const n=String(q).replace(/\s+/g,'').replace(/내주변|주변|근처|가까운/g,'');return /^(주유소|충전소|전기차충전소|ev충전소|마트|대형마트|슈퍼|슈퍼마켓|편의점|주차장|공영주차장|공용주차장|소방서|119안전센터|안전센터|경찰서|파출소|지구대|공용화장실|공중화장실|화장실|공공기관|관공서)$/.test(n)}
function destinationSearchAnchor(sortMode){
  if(sortMode==='center'){
    // 지도중심 선택 시 직전에 새로고침한 현재위치를 최우선 기준으로 사용한다.
    if(pointValid(state.user))return {lng:Number(state.user.lng),lat:Number(state.user.lat)};
    if(state.map){
      try{
        const center=state.map.getCenter();
        if(Number.isFinite(Number(center?.lng))&&Number.isFinite(Number(center?.lat)))return {lng:Number(center.lng),lat:Number(center.lat)};
      }catch{}
    }
  }
  // 정확도순은 좌표를 보내지 않는다. 검색어 일치도 기반 정렬이 거리값의 영향을 받지 않도록 분리한다.
  return null;
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

    if(mode==='center'){
      try{
        await locate(true);
        if(pointValid(state.user)&&state.map){
          state.map.setCenter({lng:Number(state.user.lng),lat:Number(state.user.lat)});
          setTimeout(()=>state.map?.resize(),60);
        }
      }catch(err){
        console.warn('현재위치 새로고침 실패',err);
      }
    }

    searchPlaces(state.lastDestinationQuery||$('destinationInput')?.value||'', 'searchResults');
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
async function searchPlaces(q,target='searchResults'){
  const box=$(target);if(!q?.trim())return;
  const isDestination=target==='searchResults';
  if(isDestination)state.lastDestinationQuery=q.trim();
  box.classList.remove('hidden');
  box.innerHTML='';
  if(isDestination)renderDestinationSearchToolbar(box);
  const loading=document.createElement('button');loading.className='search-result';loading.innerHTML='<b>검색 중...</b>';box.appendChild(loading);

  if(!state.user)await locate(false);
  try{
    const u=new URL('/api/search',location.origin);
    u.searchParams.set('q',q.trim());
    const lifestyle=isDestination&&isLifestyleFacilityQuery(q)&&pointValid(state.user);
    if(isDestination)u.searchParams.set('sort',lifestyle?'center':(state.destinationSearchSort||'accuracy'));
    const anchor=isDestination?destinationSearchAnchor(lifestyle?'center':state.destinationSearchSort):(pointValid(state.user)?state.user:null);
    if(anchor){u.searchParams.set('lng',anchor.lng);u.searchParams.set('lat',anchor.lat)}
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
  if($('routeCards'))$('routeCards').innerHTML='<div class="auto-start-hint">출발 위치 확인 중...</div>';
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  if(!state.user)await locate(false);
  if(!state.user){
    if($('routeCards'))$('routeCards').innerHTML='<div class="auto-start-hint">위치 권한을 허용하면 경로를 계산합니다.</div>';
    showPermissionGate();
    return;
  }

  if(!state.origin||state.originMode==='current'){
    state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};
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
  state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};
  state.routeLockedDistance=0;
  state.routeLockedAt=Date.now();
  state.offRouteHits=0;
  state.offRouteHeadingHits=0;
  state.offRouteSince=0;
  state.arrivalCandidateSince=0;
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
    if(!state.origin||state.originMode==='current'){
      state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};
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
  if(['speed_camera','section_speed_camera','mobile_camera','traffic_camera'].includes(type))return state.cameraAlerts.speed!==false;
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
async function routeRequest(priority='RECOMMEND',avoid=null,waypointsOverride=null,mode=state.routeMode){
  const o=state.originMode==='current'?(state.user||state.origin):(state.origin||state.user),wps=Array.isArray(waypointsOverride)?waypointsOverride:state.waypoints;
  const body={origin:{lng:o.lng,lat:o.lat,heading:mode==='car'&&state.originMode==='current'?state.user?.heading:null},destination:{lng:state.destination.lng,lat:state.destination.lat},waypoints:(wps||[]).filter(pointValid).map(x=>({lng:x.lng,lat:x.lat,name:x.name||'경유지'})),priority,alternatives:false,mode:mode==='walk'?'walk':'car'};
  if(avoid&&mode==='car')body.avoid=avoid;
  const rr=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
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
  mode=mode==='walk'?'walk':'car';cancelAutoStart();state.routeMode=mode;renderRouteModeSwitch();
  if(mode==='walk'){
    if(!state.walkingRoute){
      $('routeCards').innerHTML='<div class="auto-start-hint">도보 경로를 계산하고 있습니다...</div>';
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
async function loadRouteOptions(){
  cancelAutoStart();$('routeCards').innerHTML='<div class="auto-start-hint">자동차·도보 경로를 계산하고 있습니다...</div>';renderRouteModeSwitch();
  try{
    const results=await Promise.allSettled([routeRequest('RECOMMEND',null,null,'car'),routeRequest('TIME',null,null,'car'),routeRequest('RECOMMEND','toll',null,'car'),routeRequest('RECOMMEND',null,null,'walk')]);
    const specs=[['추천','daim',''],['빠른길','sunsik','fast'],['무료도로','hunmin','free']];state.carRouteOptions=[];
    results.slice(0,3).forEach((x,i)=>{if(x.status==='fulfilled'&&x.value?.geometry?.length)state.carRouteOptions.push({...x.value,_label:specs[i][0],_character:specs[i][1],_class:specs[i][2]})});
    if(results[3]?.status==='fulfilled'&&results[3].value?.geometry?.length){state.walkingRoute={...results[3].value,_label:'도보 추천',_character:state.character,_class:'walk'};state.routeModeDurations.walk=results[3].value.duration}
    const best=state.carRouteOptions.reduce((a,x)=>!a||Number(x.duration)<Number(a.duration)?x:a,null);state.routeModeDurations.car=best?.duration??null;renderRouteModeSwitch();
    if(state.routeMode==='walk'){
      if(!state.walkingRoute)throw new Error('도보 경로를 가져오지 못했습니다.');state.routeOptions=[state.walkingRoute];state.selectedRoute=0;
    }else{
      if(!state.carRouteOptions.length)throw new Error('자동차 경로가 없습니다.');state.routeOptions=state.carRouteOptions;const pref=state.routePreference;const p=state.routeOptions.findIndex(x=>(pref==='fast'&&x._class==='fast')||(pref==='free'&&x._class==='free')||(pref==='recommend'&&!x._class));state.selectedRoute=p>=0?p:0;
    }
    selectRoute(state.selectedRoute,false);renderRouteCards();renderRouteModeSwitch();scheduleAutoStart();
  }catch(e){$('routeCards').innerHTML='<div class="auto-start-hint">경로를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';toast(e.message,3000)}
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
  state.selectedRoute=index;state.route=state.routeOptions[index];syncCharacterUI();drawRoute(state.route,{fit});state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0;updateRoutePlanEta();
  if(state.routeMode==='car')loadSafetyEvents(state.route);else{state.safetyEvents=[];clearSafetyMarkers();hideSafetyAlert()}
}
function scheduleAutoStart(){cancelAutoStart();state.autoStartSeconds=10;updateAutoHint();state.autoStartTimer=setInterval(()=>{state.autoStartSeconds--;if(state.autoStartSeconds<=0){cancelAutoStart();if(state.tripStartedAt)resumeNavigationWithSelectedRoute();else startNavigation()}else updateAutoHint()},1000)}
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
  const origin=state.originMode==='current'
    ?(pointValid(state.user)?{...state.user,name:'내 위치',address:'현재 GPS 위치'}:null)
    :(pointValid(state.origin)?{...state.origin}:null);
  const key=[origin,...points,state.destination].filter(Boolean).map(p=>`${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`).join('|');
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
  if(pointValid(item.origin)){
    state.origin=normalizedPlace(item.origin);
    state.originMode=item.origin?.name==='내 위치'?'current':'custom';
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
  if(!state.route){$('routePlanEta').textContent='출발지를 선택하면 예상 도착시간을 안내합니다.';return}
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
  if(g){const d=distanceAlong(idx,g.routeIndex);$('arTurnIcon').innerHTML=turnSvg(g.type);$('arTurnDistance').textContent=km(d);$('arCenterDistance').textContent=km(d);$('arTurnRoad').textContent=g.name||g.guidance||'다음 안내'}
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

function openAppInfo(){openInfoModal('앱정보','<div class="info-card"><h3>조팸스 내비</h3><p><b>버전</b> 7.5.7.7</p><p>2D 컬러 지도, 실시간 교통상태, AR 안내, 단속카메라·스쿨존·사고·공사 안내, 다른시간 출발 AI 소요시간 예측과 다임·순식·훈민 캐릭터 음성 안내를 제공합니다.</p></div>')}
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
  if(landscape&&inDriveOrAR)await enterAppFullscreen();
  else if(!landscape||!inDriveOrAR)exitAppFullscreen();
  setTimeout(()=>state.map?.resize(),120);
}
// 시스템 뒤로가기/제스처 등으로 브라우저가 전체화면을 강제 종료했을 때도 레이아웃 상태를 맞춰준다.
document.addEventListener('fullscreenchange',()=>{if(!isDocumentFullscreen())setTimeout(tryLandscapeFullscreen,60)});
document.addEventListener('webkitfullscreenchange',()=>{if(!isDocumentFullscreen())setTimeout(tryLandscapeFullscreen,60)});

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
  if(!state.map)return;const pitch=state.map3D?55:0;
  try{setBuildingExtrusions(state.map3D);state.map.jumpTo({pitch});const btn=$('map3dBtn');if(btn){btn.classList.toggle('active',state.map3D);btn.textContent=state.map3D?'2D':'3D';btn.setAttribute('aria-label',state.map3D?'2D 지도 보기':'3D 지도 보기')}state.map.resize()}catch(e){console.warn('map mode change failed',e)}
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
  const model=laneAssistModel(idx);
  if(!model){el.classList.add('hidden');state.activeLaneGuideKey='';return}
  const key=`${model.guide.id||model.guide.routeIndex}:${model.range}`;
  $('laneAssistDistance').textContent=model.d>=950?'1km 전':`${Math.max(50,Math.round(model.d/50)*50)}m 전`;
  $('laneAssistTitle').textContent=model.range||model.dir.label;
  $('laneAssistRoad').textContent=model.guide.name||model.guide.roadName||model.guide.guidance||'다음 갈림길';
  const icon=el.querySelector('.lane-assist-icon');if(icon)icon.textContent=model.dir.icon;
  el.classList.remove('hidden');
  if(key!==state.activeLaneGuideKey&&model.d<=1000){
    state.activeLaneGuideKey=key;
    speak(`${Math.max(100,Math.round(model.d/100)*100)}미터 앞 ${model.range||model.dir.label}를 이용하세요.`);
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
    if(improvement>=120||relative>=.10&&improvement>=60){state.route={...r,_label:'실시간 경로',_character:state.character};state.routeCumulative=buildCumulative(state.route);state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);updateDriving(true);toast('실시간 교통을 반영해 더 빠른 경로로 변경했습니다.')}
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
function setView(view){
  $('homeView').classList.toggle('hidden',view!=='home');$('routeView').classList.toggle('hidden',view!=='route');$('driveView').classList.toggle('hidden',view!=='drive');
  setTimeout(tryLandscapeFullscreen,60); // 화면 전환/최초 진입 시에도 현재 가로/세로 상태에 맞게 전체화면 여부를 갱신
  $('bottomNav').classList.toggle('hidden',view==='drive'||state.arRunning);
  if(view==='home'){
    $('homeView')?.classList.remove('ui-hidden');
    // 생활편의시설은 최초 진입 시에도 현재 위치를 자동으로 확인해 기본 탭(주유소) 목록을 바로 보여준다.
    // loadHomeFacility 내부에서 위치가 없으면 locate(false)로 자동 확인하므로 위치 확보 여부와 무관하게 항상 호출한다.
    if(!state.homeFacilityItems.length||pointValid(state.user))setTimeout(()=>loadHomeFacility(state.homeFacilityCategory),120);
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
          if(u&&pointValid(u)&&state.map&&!state.homeSheetCollapsed)state.map.easeTo({center:[u.lng,u.lat],zoom:15.5,duration:380});
        }
      }catch{}
      scheduleLocalVoucherRefresh();scheduleOnnuriRefresh();scheduleHomeCameraRefresh();
    },320);
  }else{
    $('localVoucherBadge')?.classList.add('hidden');clearLocalVoucherMarkers();clearOnnuriMarkers();clearHomeCameraMarkers();
  }
  if(view==='route')renderSavedWaypointCourses();
  if(view==='drive'){setTimeout(tryLandscapeFullscreen,80);setTimeout(()=>loadFuelPrices(state.fuelProduct,{force:false}),500)}
  refreshMapLayout({fitRoute:view==='route'&&Boolean(state.route)});
}
function initializeDriveSummary(){
  if(!state.route)return;
  state.routeCumulative=buildCumulative(state.route);
  const total=state.routeCumulative.at(-1)||Number(state.route.distance)||0;
  const duration=Number(state.route.duration)||0;
  if($('remainingDistance'))$('remainingDistance').textContent=total>0?km(total):'--km';
  if($('remainingTime'))$('remainingTime').textContent=duration>0?mins(duration):'--분';
  if($('arrivalTime'))$('arrivalTime').textContent=duration>0?`도착 ${eta(duration)}`:'도착 --:--';
  if($('speedPanel'))$('speedPanel').classList.remove('hidden');
  if($('currentSpeed'))$('currentSpeed').textContent='0';
  const seg=(state.route.roadSegments||[])[0];
  const limit=Number(seg?.speedLimit)||0;
  renderSpeedOrSignBadge(limit,[]);
}
function startNavigation(){
  $('localVoucherBadge')?.classList.add('hidden');clearLocalVoucherMarkers();clearOnnuriMarkers();clearHomeCameraMarkers();
  if((state.waypoints||[]).filter(pointValid).length)saveCurrentWaypointCourse();if(!state.route||!state.destination)return;cancelAutoStart();state.tripStartedAt=Date.now();acquireNavigationWakeLock();startDestinationCycle();logTrip('start');setView('drive');$('driveView')?.classList.toggle('walking-mode',state.routeMode==='walk');
  state.gpsFix={lat:null,lng:null,headingDeg:null,speedMps:0,at:0,fixCount:0,mapSnapped:false};state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};state.routeLockedDistance=0;state.routeLockedAt=Date.now();state.offRouteHits=0;state.offRouteHeadingHits=0;state.offRouteSince=0;state.arrivalCandidateSince=0; // 새 주행마다 상보필터 상태 초기화
  requestCompassPermission(); // 사용자 제스처(시작 버튼) 컨텍스트 안에서 iOS 나침반 권한 요청, 안드로이드/데스크톱은 즉시 리스너 등록
  if(matchMedia('(orientation: landscape)').matches)enterAppFullscreen(); // 사용자 제스처(시작 버튼) 컨텍스트 안에서 바로 요청해야 브라우저가 확실히 허용한다.
  initializeDriveSummary();startWatch();ensureUserMarker();updateCarMarkerImage();drawRoute(state.route,{fit:false});updateDriving(true);if(state.routeMode==='car')startLiveRouteRefresh();else stopLiveRouteRefresh();applyNightMode();setTimeout(tryLandscapeFullscreen,100);}
function stopNavigation(){
  stopRouteSimulation({resumeGps:false});if($('laneAssistLayer'))$('laneAssistLayer').classList.add('hidden');
  const finishedDestination=state.destination?{...state.destination}:null;
  // 안내 종료는 어떤 부가기능 오류가 발생해도 반드시 홈 화면까지 복귀해야 한다.
  try{if(state.tripStartedAt)logTrip('finish')}catch(e){console.warn('finish log failed',e)}
  try{if(state.tripStartedAt)addTripHistory({destination:state.destination?.name||'목적지',date:new Date().toLocaleString('ko-KR'),distance:state.route?.distance||0,duration:Math.round((Date.now()-state.tripStartedAt)/1000),character:state.character})}catch(e){console.warn('trip history finish failed',e)}
  state.tripStartedAt=0;releaseNavigationWakeLock();
  for(const fn of [stopDestinationCycle,stopLiveRouteRefresh,stopAR,stopWatch,cancelAutoStart,clearRouteLayer,clearSafetyMarkers,hideSafetyAlert]){try{fn?.()}catch(e){console.warn('navigation cleanup failed',e)}}
  try{$('driveMenu')?.classList.add('hidden')}catch{}
  state.safetyEvents=[];resetSectionSpeedState();state.tunnelRouteLock={active:false,startIndex:-1,endIndex:-1,routeDistance:null,lastAt:0};state.route=null;state.routeOptions=[];state.waypoints=[];renderRouteWaypoints();
  try{if(state.destMarker){state.destMarker.remove();state.destMarker=null}}catch{state.destMarker=null}
  try{if(state.originMarker){state.originMarker.remove();state.originMarker=null}}catch{state.originMarker=null}
  state.destination=null;state.origin=null;state.originMode='current';state.routeMode='car';state.carRouteOptions=[];state.walkingRoute=null;state.routeModeDurations={car:null,walk:null};$('driveView')?.classList.remove('walking-mode');
  try{updateOverspeed(0,0)}catch{}
  try{setView('home')}catch(e){console.error('home restore failed',e);$('homeView')?.classList.remove('hidden');$('driveView')?.classList.add('hidden')}
  toast('안내를 종료했습니다.');
  if(finishedDestination&&!isFavoritePlace(finishedDestination))setTimeout(()=>{try{openPostDriveFavoritePrompt(finishedDestination)}catch(e){console.warn('favorite prompt failed',e)}},350)
}

function driveCameraPadding(){
  const h=Math.max(320,window.innerHeight||720),landscape=(window.innerWidth||0)>(window.innerHeight||0);
  // 큰 top padding으로 현재 위치가 화면 하단 65~76%에 오도록 유지한다.
  return landscape?{top:Math.round(h*.60),bottom:36,left:0,right:0}:{top:Math.round(h*.48),bottom:76,left:0,right:0};
}
function updateDriving(force=false){
  refreshVslSpeedLimit();
  if(!state.user||!state.route?.geometry?.length)return;
  const g=state.route.geometry;
  let idx=Number(state.user.routeIndex);
  if(!Number.isFinite(idx)){
    const match=probabilisticRouteMatch({lng:state.user.lng,lat:state.user.lat,heading:state.user.heading,speed:state.user.speed,accuracy:state.user.accuracy},Date.now());
    idx=match?.index??nearestIndex(state.user.lng,state.user.lat,g);
  }
  idx=Math.max(0,Math.min(g.length-1,Math.round(idx)));
  state.currentRouteIndex=idx;
  updateTunnelRouteLock(idx);
  ensureUserMarker();

  const nextPoint=g[Math.min(g.length-1,idx+3)];
  const heading=Number.isFinite(state.user.heading)?state.user.heading:(nextPoint?bearing(state.user.lat,state.user.lng,nextPoint[1],nextPoint[0]):0);

  // 사용자가 지도 조작 중이면 카메라 자동 이동을 완전히 중지한다.
  // 마지막 사용자 입력 후 10초 동안 조작이 없을 때만 현재 위치로 복귀한다.
  if(maybeRestoreDriveMap()){
    const now=Date.now();
    if(force||now-Number(state.lastDriveCameraAt||0)>=280){
      state.lastDriveCameraAt=now;
      state.map.easeTo({
        center:[state.user.lng,state.user.lat],
        zoom:17.2,
        pitch:state.map3D?55:0,
        bearing:heading,
        duration:force?220:420,
        padding:driveCameraPadding()
      });
    }
  }
  updateProgressUI(idx);
  if(state.arRunning)updateAROverlay();
  checkOffRoute(idx);
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
  if(state.vslLoading||now-Number(state.vslLoadedAt||0)<8000)return;
  state.vslLoadedAt=now;state.vslLoading=true;
  try{
    const r=await fetch(`/api/its-vsl?lat=${encodeURIComponent(state.user.lat)}&lng=${encodeURIComponent(state.user.lng)}`,{cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();let best=null,bestRouteGap=Infinity,bestGeo=Infinity;
    for(const x of d.items||[]){
      if(!Number.isFinite(Number(x.speedLimit))||Number(x.speedLimit)<=0)continue;
      const snap=nearestPointOnRoute(Number(x.lng),Number(x.lat),state.route?.geometry||[]);
      const routeGap=Number(snap?.distance);
      if(!Number.isFinite(routeGap)||routeGap>45)continue;
      const geo=hav(state.user.lat,state.user.lng,Number(x.lat),Number(x.lng));
      if(routeGap<bestRouteGap||(routeGap===bestRouteGap&&geo<bestGeo)){best=x;bestRouteGap=routeGap;bestGeo=geo}
    }
    if(best&&bestGeo<=1200){
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
  return (state.safetyEvents||[]).find(e=>e.type==='section_speed_camera'&&Number.isFinite(Number(e.routeIndex))&&Number.isFinite(Number(e.endRouteIndex))&&idx>=Number(e.routeIndex)&&idx<=Number(e.endRouteIndex))||null;
}
function resetSectionSpeedState(){
  state.sectionSpeedState=null;
  $('sectionSpeedPanel')?.classList.add('hidden');
}
function updateSectionAverageSpeed(idx){
  const e=sectionSpeedEventAtIndex(idx),panel=$('sectionSpeedPanel');
  if(!e){resetSectionSpeedState();return}
  const now=Date.now(),cum=state.routeCumulative||[],routeNow=Number(state.user?.routeDistance);
  const currentDistance=Number.isFinite(routeNow)?routeNow:(cum[idx]||0),startDistance=cum[Number(e.routeIndex)]||0,endDistance=cum[Number(e.endRouteIndex)]||startDistance;
  if(!state.sectionSpeedState||state.sectionSpeedState.id!==e.id){
    state.sectionSpeedState={id:e.id,enteredAt:now,enteredDistance:Math.max(startDistance,currentDistance),lastDistance:currentDistance,lastAt:now};
    speakNavOnce(`section:${e.id}` ,`구간단속 구간입니다.${e.maxspeed?` 제한속도 ${e.maxspeed}킬로미터입니다.`:''}`,12000);
  }
  const st=state.sectionSpeedState;
  // 맵매칭 노이즈로 후진하지 않도록 누적 진행거리는 단조 증가로 유지한다.
  st.lastDistance=Math.max(Number(st.lastDistance)||0,currentDistance);st.lastAt=now;
  const elapsed=Math.max(1,(now-st.enteredAt)/1000),travelled=Math.max(0,st.lastDistance-st.enteredDistance);
  const avg=Math.max(0,Math.min(250,travelled/elapsed*3.6)),remain=Math.max(0,endDistance-st.lastDistance);
  if(panel)panel.classList.remove('hidden');
  if($('sectionAverageSpeed'))$('sectionAverageSpeed').textContent=`${Math.round(avg)} km/h`;
  if($('sectionLimitSpeed'))$('sectionLimitSpeed').textContent=e.maxspeed?`${Math.round(e.maxspeed)} km/h`:'-- km/h';
  if($('sectionRemainDistance'))$('sectionRemainDistance').textContent=`${km(remain)} 남음`;
  panel?.classList.toggle('over',Number(e.maxspeed)>0&&avg>Number(e.maxspeed));
}


function isGenericInstitutionDestination(dest){
  const t=`${dest?.name||''} ${dest?.address||''} ${dest?.category||''}`;
  const specific=/(후문|동문|서문|북문|남문|주차장|별관|본관|관사|연구동|사업소|센터동|사무동|제\d+.*건물|정문)/;
  const institution=/(공사|공단|청|시청|도청|군청|구청|대학교|대학|병원|연구원|박물관|기관|학교|법원|검찰청|경찰서|소방서)/;
  return institution.test(t)&&!specific.test(t);
}
function arrivalRadiusMeters(dest){return isGenericInstitutionDestination(dest)?90:45}

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
  const reached=(rawToRouteEnd<=45)||(Number(routeRemain)<=30&&rawToRouteEnd<=70)||(rawToPoi<=35);
  if(!reached){state.arrivalCandidateSince=0;return false}

  if(!state.arrivalCandidateSince)state.arrivalCandidateSince=Date.now();
  // 1초 이상 연속 도착권 + 저/중속으로 통과하면 도착 확정. 고속도로 평행도로 오판 방지.
  if(Date.now()-state.arrivalCandidateSince<1000||speed>12)return false;
  state.arrivalCandidateSince=0;
  speakNavOnce(`arrival:${state.destination.id||state.destination.name}`,'목적지에 도착했습니다.',0);
  setTimeout(stopNavigation,900);
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

function updateProgressUI(idx){
  const total=state.routeCumulative.at(-1)||state.route.distance||1;
  const locked=Number(state.user?.routeDistance);
  const done=Number.isFinite(locked)?Math.max(0,Math.min(total,locked)):(state.routeCumulative[idx]||0);
  const remain=Math.max(0,total-done);
  const ratio=Math.max(0,Math.min(1,remain/total));
  const remainSec=(state.route.duration||0)*ratio;

  $('remainingDistance').textContent=km(remain);
  $('remainingTime').textContent=mins(remainSec);
  $('arrivalTime').textContent=`도착 ${eta(remainSec)}`;
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

  const guides=(state.route.guides||[]).filter(x=>Number(x.routeIndex)>idx+1);
  let first=guides[0],second=guides[1];
  // routeIndex는 앞인데 누적거리가 사실상 0인 중복 guide는 건너뜀.
  while(first&&distanceAlong(idx,first.routeIndex)<5&&guides.length>1){
    guides.shift();first=guides[0];second=guides[1];
  }
  if(first){
    const d=guideDisplayDistance(idx,first,remain);
    $('maneuverIcon').innerHTML=turnSvg(first.type);
    $('maneuverDistance').textContent=km(d);
    $('maneuverRoad').textContent=first.name||first.guidance||'교차로';
    maybeSpeakGuide(first,d);
  }else{
    $('maneuverIcon').innerHTML=turnSvg(0);
    $('maneuverDistance').textContent=km(remain);
    $('maneuverRoad').textContent='목적지까지 직진';
  }

  if(second){
    const d2=Math.max(8,guideDisplayDistance(idx,second,remain));
    $('nextManeuver').classList.remove('hidden');
    $('nextManeuverIcon').innerHTML=turnSvg(second.type);
    $('nextManeuverDistance').textContent=km(d2);
    $('nextManeuverText').textContent=second.guidance||'다음 안내';
  }else $('nextManeuver').classList.add('hidden');

  updateSafetyUI(idx,safetyCandidates);updateSectionAverageSpeed(idx);updateLaneGuide(idx);updateVms(idx);
  checkArrival(remain);
  fitManeuverDistanceText();
}
/* 좌측 하단 원형 배지: 제한속도 정보가 있으면 기존처럼 제한속도를 표시하고,
   없으면 원을 아예 숨긴 뒤 전방에서 가장 임박한 도로표지판(주의/보호구역/대형차 제한 등)이 있을 때만
   그 배지를 대신 보여준다. 어느 쪽도 없으면 원/배지를 모두 숨기고, 현재속도(km/h)만 계속 표시한다. */
function renderSpeedOrSignBadge(limit,candidates){
  const circle=$('speedLimit')?.closest('.speed-limit'),badge=$('roadSignBadge');
  const cameraTypes=new Set(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','bus_lane_camera','mobile_camera']);
  const camera=(candidates||[]).find(e=>cameraTypes.has(e?.type)&&Number(e.d)>=0&&Number(e.d)<=600);
  const syncedLimit=camera?safetyGuidanceLimit(state.currentRouteIndex,camera):Number(limit);
  const hasLimit=Number(syncedLimit)>0;

  if(circle)circle.style.setProperty('display',hasLimit?'grid':'none','important');
  if($('speedLimit'))$('speedLimit').textContent=hasLimit?String(Math.round(Number(syncedLimit))):'--';

  // 좌측에는 제한속도만 표시. CCTV 아이콘은 중간 안전안내 레이어와 지도에서만 표시.
  if(badge){
    const sign=(!camera&&!hasLimit)?(candidates||[]).find(e=>e&&e.type!=='speed_limit'&&e.type!=='tunnel'):null;
    if(sign){
      const info=safetyLabel(sign);
      badge.className=`road-sign-badge ${info.kind}`;
      badge.innerHTML=`<b>${escapeHtml(info.icon)}</b><small>${escapeHtml(km(Math.max(0,Number(sign.d)||0)))}</small>`;
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
  'bus_lane_camera','mobile_camera','section_speed_camera',
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
  const d=distanceAlong(idx,Number(guide?.routeIndex));
  if(d>=8)return d;
  // 동일/중복 routeIndex 때문에 0m가 나오는 경우 전체 남은거리 또는 다음 실제 geometry 거리 사용
  if(Number(remain)>8)return Math.min(Number(remain),Math.max(15,Number(guide?.distance)||Number(remain)));
  return Math.max(0,Number(remain)||0);
}

function maybeSpeakGuide(g,d){
  const cat=guideVoiceCategory(g);
  if(!cat)return;
  // 기존 320m/80m 2단계 안내를 한 번으로 축소. 일반 도로는 약 170~230m, 고속/IC는 조금 더 앞에서 안내.
  const speedKmh=Math.max(0,(Number(state.user?.speed)||0)*3.6);
  const trigger=(cat==='ic'||cat==='fork'||cat==='toll')?(speedKmh>=70?450:300):(speedKmh>=60?260:190);
  if(d>trigger||d<8)return;
  const meters=d<100?Math.max(20,Math.round(d/10)*10):Math.max(100,Math.round(d/50)*50);
  let text='';
  if(cat==='left')text=`${meters}미터 앞 좌회전입니다.`;
  else if(cat==='right')text=`${meters}미터 앞 우회전입니다.`;
  else if(cat==='toll')text=`${meters}미터 앞 톨게이트입니다.`;
  else if(cat==='ic')text=`${meters}미터 앞 IC 안내입니다. ${g.guidance||g.name||''}`;
  else if(cat==='fork')text=`${meters}미터 앞 ${g.guidance||g.name||'갈림길에서 방향을 확인하세요.'}`;
  if(text)speakNavOnce(`guide:${g.id||g.routeIndex}:${cat}`,text,10000);
}
function updateTrafficStatus(seg){
  const el=$('trafficStatus');if(!el)return;
  const info=trafficClassFromValues(seg?.trafficSpeed,seg?.trafficState),sp=Math.round(Number(seg?.trafficSpeed)||0);
  el.className=`traffic-status traffic-${info.key}`;$('trafficStatusLabel').textContent=info.label;
  const detail=info.key==='smooth'?'차량 흐름이 원활합니다.':info.key==='slow'?'교통량 증가로 평소보다 속도가 낮습니다.':info.key==='delayed'?'가다 서기를 반복할 수 있는 혼잡 구간입니다.':info.key==='severe'?'차량 흐름이 매우 느린 정체 구간입니다.':'현재 도로 소통정보를 불러오고 있습니다.';
  $('trafficStatusDetail').textContent=sp>0?`${detail} · 평균 ${sp}km/h`:detail;
  if(info.key!=='unknown'&&info.key!==state.lastTrafficStatus){state.lastTrafficStatus=info.key;}
}

function recenterDriveMap(){
  if(!state.user)return toast('현재 위치를 확인할 수 없습니다.');
  const g=state.route?.geometry||[],idx=state.currentRouteIndex||0,next=g[Math.min(g.length-1,idx+3)];
  const heading=Number.isFinite(state.user.heading)?state.user.heading:(next?bearing(state.user.lat,state.user.lng,next[1],next[0]):0);
  state.map?.easeTo({center:[state.user.lng,state.user.lat],zoom:17.2,pitch:state.map3D?55:0,bearing:heading,duration:350,padding:driveCameraPadding()});
  toast('현재 위치로 지도를 맞췄습니다.',1200);
}
async function reroute(){
  if(!state.user||!state.destination||state.rerouteBusy)return;
  state.rerouteBusy=true;
  state.lastRerouteAt=Date.now();
  try{
    const spec=routePreferenceSpec();
    const r=await routeRequest(spec.priority,state.routeMode==='walk'?null:spec.avoid,remainingWaypointsForReroute(),state.routeMode);
    state.route={...r,_label:state.routeMode==='walk'?'도보 재탐색':`재탐색 · ${spec.label}`,_character:state.character};
    state.routeCumulative=buildCumulative(state.route);
    state.mapMatch={index:0,routeDistance:0,score:Infinity,confidence:0,at:0};
    state.routeLockedDistance=0;state.routeLockedAt=Date.now();
    drawRoute(state.route,{fit:false});
    await loadSafetyEvents(state.route);
    updateDriving(true);
    // 재탐색 자체는 화면에서만 조용히 처리. 음성 멘트는 하지 않는다.
  }catch(e){
    console.warn('reroute failed',e);
  }finally{
    state.rerouteBusy=false;
  }
}
function checkOffRoute(idx){
  if(state.tunnelRouteLock?.active||state.gpsEstimated||state.user?.estimated||Date.now()-state.lastRerouteAt<12000){
    state.offRouteHits=0;state.offRouteSince=0;return;
  }
  const rawLat=Number.isFinite(state.user?.rawLat)?state.user.rawLat:Number(state.user?.lat);
  const rawLng=Number.isFinite(state.user?.rawLng)?state.user.rawLng:Number(state.user?.lng);
  const accuracy=Math.max(0,Number(state.user?.accuracy)||0);
  if(!Number.isFinite(rawLat)||!Number.isFinite(rawLng)||accuracy>25){
    state.offRouteHits=0;state.offRouteSince=0;return;
  }
  const rawMatch=nearestPointOnRoute(rawLng,rawLat,state.route.geometry);
  const d=Number(rawMatch?.distance);
  const off=Number.isFinite(d)&&d>10;
  if(off){
    state.offRouteHits=(state.offRouteHits||0)+1;
    if(!state.offRouteSince)state.offRouteSince=Date.now();
  }else{
    state.offRouteHits=0;state.offRouteSince=0;
  }
  // ±10m를 넘은 고품질 GPS가 3회 연속 확인될 때만 재탐색.
  if(state.offRouteSince&&Date.now()-state.offRouteSince>=1200&&state.offRouteHits>=3){
    state.offRouteHits=0;state.offRouteSince=0;reroute();
  }
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
  let supplemental=[];
  try{
    const r=await fetch('/api/safety',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points:sampleRoutePoints(route.geometry),trafficSamples:buildTrafficSafetySamples(route)})});
    const d=await r.json().catch(()=>({events:[]}));if(seq!==state.safetyRequestSeq)return;
    supplemental=Array.isArray(d?.events)?d.events:[];
  }catch(e){if(seq!==state.safetyRequestSeq)return;console.warn('supplemental safety fetch failed',e)}
  const merged=mergeSafetyEvents([...primary,...official,...supplemental],route.geometry);
  state.safetyEvents=merged;
  loadItsTraffic(route).then(()=>{if(state.tripStartedAt)updateDriving(true)}).catch(()=>{});
  applyRouteSpeedLimitHints(route,merged);
  renderSafetyMarkers();if(state.currentRouteIndex>=0)updateSafetyUI(state.currentRouteIndex)
}
function mergeSafetyEvents(events,geometry){
  const seen=new Set(),out=[];for(const e of events){let lng=Number(e.lng),lat=Number(e.lat),idx=Number(e.routeIndex);if((!Number.isFinite(lng)||!Number.isFinite(lat))&&Number.isFinite(idx)){const rp=geometry[Math.max(0,Math.min(geometry.length-1,idx))];if(rp){lng=rp[0];lat=rp[1]}}if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;if(!Number.isFinite(idx))idx=nearestIndex(lng,lat,geometry);const p=geometry[idx];if(!p||hav(lat,lng,p[1],p[0])>(String(e.type||'').includes('camera')?55:320))continue;const k=`${e.type}:${Math.round(lat*10000)}:${Math.round(lng*10000)}`;if(seen.has(k))continue;seen.add(k);out.push({...e,lng,lat,routeIndex:idx})}return out.sort((a,b)=>a.routeIndex-b.routeIndex)
}
function clearSafetyMarkers(){for(const m of state.safetyMarkers||[])try{m.remove()}catch{}state.safetyMarkers=[]}

function cameraClusterItemsByPixel(items){
  return clusterMapItemsByPixel(items,62);
}
function renderCameraClusterMarkers(items){
  const clusters=cameraClusterItemsByPixel(items);
  for(const c of clusters){
    // 단독 1개는 클러스터가 아니라 기존 CCTV 아이콘을 그대로 표시
    if(c.count===1){
      const e=c.items[0],limit=Number(e.maxspeed)||0,el=document.createElement('div');
      el.className=`safety-map-marker camera camera-pin${e.type==='mobile_camera'?' mobile':''}`;
      el.title=e.type==='signal_speed_camera'?'신호·과속 단속카메라':e.type==='signal_camera'?'신호 단속카메라':e.type==='speed_camera'?'과속 단속카메라':'단속 카메라';
      el.innerHTML=`<span class="camera-pin-icon">${cctvMarkerSvg()}</span>${limit>0?`<small class="camera-pin-speed">${Math.round(limit)}</small>`:''}`;
      try{state.safetyMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([e.lng,e.lat]).addTo(state.map))}catch{}
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
  return ({signal_speed_camera:0,section_speed_camera:1,speed_camera:2,signal_camera:3,traffic_camera:4,mobile_camera:5,bus_lane_camera:6})[e?.type]??9;
}
function routeSnappedCameraItems(items){
  const g=state.route?.geometry||[],cum=state.routeCumulative||[];
  if(g.length<2)return items||[];
  const projected=[];
  for(const e of items||[]){
    const match=nearestPointOnRoute(Number(e.lng),Number(e.lat),g);
    if(!match||!Number.isFinite(match.index)||Number(match.distance)>45)continue;
    const idx=Math.max(0,Math.min(g.length-1,Number(match.index)));
    const p=g[idx];
    projected.push({...e,lng:p[0],lat:p[1],routeIndex:idx,__routeM:Number(cum[idx])||0,__srcDist:Number(match.distance)||0});
  }
  projected.sort((a,b)=>a.__routeM-b.__routeM||cameraDisplayPriority(a)-cameraDisplayPriority(b));
  const out=[];
  for(const e of projected){
    const prev=out[out.length-1];
    if(prev&&Math.abs(e.__routeM-prev.__routeM)<=32){
      if(cameraDisplayPriority(e)<cameraDisplayPriority(prev)){
        out[out.length-1]={...e,maxspeed:Number(e.maxspeed)||Number(prev.maxspeed)||null};
      }else if(!Number(prev.maxspeed)&&Number(e.maxspeed))prev.maxspeed=e.maxspeed;
      continue;
    }
    out.push(e);
  }
  return out;
}

function renderSafetyMarkers(){
  if(!state.map||!maplibregl?.Marker)return;clearSafetyMarkers();
  const skip=['speed_limit','tunnel','curve_left','curve_right','double_curve'];
  const cameraTypes=new Set(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','bus_lane_camera','mobile_camera']);
  const cameraItems=[];
  const otherItems=[];

  for(const e of state.safetyEvents||[]){
    if(skip.includes(e.type))continue;
    if(cameraTypes.has(e.type)){
      // 지도 표시용: 현재 위치 주변만 보지 않고 선택된 전체 경로 geometry 위에 있는
      // 신호/과속/구간/기타 단속카메라를 모두 CCTV SVG로 표시한다.
      // 실제 음성 경고는 updateSafetyUI의 현재 주행구간 필터를 계속 사용한다.
      if(!state.tripStartedAt||cameraMatchesRouteRoad(e,state.route?.geometry||[],null,45))cameraItems.push(e)
    }else otherItems.push(e);
  }

  // 카메라는 실제 원본 좌표가 도로 가장자리여도 경로 선 정중앙으로 스냅하고,
  // 같은 진행 위치(약 32m)에 여러 레코드가 있어도 CCTV SVG 하나만 표시한다.
  const routeCameraItems=state.tripStartedAt?routeSnappedCameraItems(cameraItems):cameraItems;

  // 화면 가시폭이 1km 이상이면 CCTV는 숫자 클러스터로 묶는다.
  if(mapVisibleWidthMeters()>=1000)renderCameraClusterMarkers(routeCameraItems);
  else{
    for(const e of routeCameraItems){
      const el=document.createElement('div'),limit=Number(e.maxspeed)||0;
      el.className=`safety-map-marker camera camera-pin${e.type==='mobile_camera'?' mobile':''}`;
      el.title=e.type==='signal_speed_camera'?'신호·과속 단속카메라':e.type==='signal_camera'?'신호 단속카메라':e.type==='speed_camera'?'과속 단속카메라':e.type==='section_speed_camera'?'구간단속':e.type==='bus_lane_camera'?'버스전용차로 단속':e.type==='mobile_camera'?'이동식 단속카메라':'단속 카메라';
      el.innerHTML=`<span class="camera-pin-icon">${cctvMarkerSvg()}</span>${limit>0?`<small class="camera-pin-speed">${Math.round(limit)}</small>`:''}`;
      try{state.safetyMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([e.lng,e.lat]).addTo(state.map))}catch{}
    }
  }

  for(const e of otherItems){
    const meta=e.type.startsWith('school')?['school','S','스쿨존/학교 주변']
      :e.type==='silver_zone'?['silver','실','노인 보호구역']
      :e.type==='disabled_zone'?['silver','보','장애인 보호구역']
      :e.type==='accident'?['incident','!','교통사고']
      :e.type==='construction'?['construction','공','도로 공사']
      :e.type==='fog_zone'?['weather','안','안개 구간']
      :e.type==='heavy_rain_zone'?['weather','비','강우 주의']
      :e.type==='snow_ice_zone'?['weather','눈','눈·결빙 주의']
      :e.type==='chronic_congestion'?['stat','정','상습정체 구간']
      :e.type==='accident_hotspot'?['stat','다','사고다발지역']
      :e.type==='crosswalk'?['warn','횡','횡단보도']
      :e.type==='railway_crossing'?['warn','건','철길 건널목']
      :e.type==='height_limit'?['truck','H','높이제한']
      :e.type==='weight_limit'?['truck','W','중량제한']
      :e.type==='width_limit'?['truck','폭','폭제한']
      :['warn','!','안전운전'];
    const el=document.createElement('div');
    el.className=`safety-map-marker ${meta[0]}${e.type==='chronic_congestion'?' sign-badge':''}`;
    el.title=meta[2];
    if(e.type==='chronic_congestion')el.innerHTML=congestionMarkerSvg();else el.textContent=meta[1];
    try{state.safetyMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([e.lng,e.lat]).addTo(state.map))}catch{}
  }
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
  if(e.type==='chronic_congestion')return{kind:'stat',icon:'정체',title:'상습정체 구간',text:e.sampleCount?`${e.name||'전방 도로'} · 누적 교통표본 ${e.sampleCount}회 기준 혼잡 빈도가 높은 구간입니다`:(e.name||'혼잡 빈도가 높은 구간입니다')};
  if(e.type==='accident_hotspot')return{kind:'stat',icon:'사고',title:'사고다발지역',text:e.accidentCount?`${e.name||'전방 구간'} · 통계 사고 ${e.accidentCount}건`:(e.name||'교통사고가 반복 발생한 통계 구간입니다')};
  // 7) 단속·인프라 안내
  if(e.type==='section_speed_camera')return{kind:'camera',icon:'구간',title:'구간단속 시작',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 구간 평균속도를 확인하세요`:'구간 평균속도를 확인하세요'};
  if(e.type==='bus_lane_camera')return{kind:'camera',icon:'버스',title:'버스전용차로 단속',text:'전방 버스전용차로 단속 위치입니다. 통행 가능 차량 여부를 확인하세요'};
  // 7) 단속·인프라 안내(기존)
  if(e.type==='accident')return{kind:'incident',icon:'사고',title:'전방 사고 정보',text:e.name||'사고 구간입니다. 차간거리를 확보하고 주의하세요'};
  if(e.type==='construction')return{kind:'construction',icon:'공사',title:'전방 공사 구간',text:e.name||'차로 변경 및 작업 차량에 주의하세요'};
  if(e.type==='mobile_camera')return{kind:'mobile',icon:'이동',title:'이동식 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 속도를 확인하세요`:'제한속도를 확인하세요'};
  if(e.type==='signal_speed_camera')return{kind:'camera',icon:'신호',title:'신호·과속 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 신호와 속도를 확인하세요`:'신호와 속도를 확인하세요'};
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
function hideSafetyAlert(){const el=$('safetyAlert');if(el)el.classList.add('hidden');state.activeSafetyId=null}
/* 실데이터(state.safetyEvents) + 경로 geometry 기반 합성 커브 이벤트를 합쳐 우선순위 정렬된 후보 목록을 만든다.
   safety-alert 배너와 좌측 표지판 배지가 동일한 후보 목록을 공유한다. */
const SAFETY_PRIORITY={accident:0,accident_hotspot:1,fog_zone:1,heavy_rain_zone:1,snow_ice_zone:1,school_zone:1,school_nearby:1,silver_zone:1,disabled_zone:1,double_curve:1,
  chronic_congestion:2,construction:2,curve_left:2,curve_right:2,railway_crossing:2,height_limit:2,weight_limit:2,width_limit:2,no_entry:2,
  crosswalk:3,no_overtaking:3,truck_prohibited:3,roundabout:3,section_speed_camera:4,bus_lane_camera:4,mobile_camera:4,signal_speed_camera:5,signal_camera:5,
  speed_camera:6,traffic_camera:6,motorway:8,speed_limit:9,tunnel:9};
function computeSafetyCandidates(idx){
  if(!state.routeCumulative.length)return[];
  const speedNow=Math.max(0,Math.round((state.user?.speed||0)*3.6));
  const synthetic=[];
  const curve=detectCurveAhead(idx);
  if(curve)synthetic.push({id:`curve:${curve.type}:${curve.routeIndex}`,type:curve.type,routeIndex:curve.routeIndex});
  const pool=[...(state.safetyEvents||[]),...synthetic];
  return pool.filter(e=>!['speed_limit','tunnel'].includes(e.type)&&cameraAlertAllowed(e.type)).map(e=>({...e,d:distanceAlong(idx,e.routeIndex)})).filter(e=>{
    if(!(e.routeIndex>=idx-2&&e.d>=0&&e.d<=800))return false;
    if(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera'].includes(e.type)){
      // 카메라 존재 안내는 현재 속도와 무관하게 제공. 과속 경고는 updateOverspeed가 별도로 담당한다.
      return e.d<=600&&cameraMatchesRouteRoad(e,state.route?.geometry||[],idx,38);
    }
    return true;
  }).sort((a,b)=>(SAFETY_PRIORITY[a.type]??9)-(SAFETY_PRIORITY[b.type]??9)||a.d-b.d);
}
function safetyGuidanceLimit(idx,e){
  const freshVsl=Number.isFinite(Number(state.vslSpeedLimit))&&Date.now()-Number(state.vslSpeedLimitAt||0)<30000?Number(state.vslSpeedLimit):0;
  if(freshVsl>0)return freshVsl;
  const eventLimit=normalizeSpeedLimitValue(e?.maxspeed);
  if(eventLimit>0)return eventLimit;
  const seg=(state.route?.roadSegments||[]).find(s=>idx>=s.startIndex&&idx<=s.endIndex);
  return effectiveSpeedLimit(idx,seg);
}

function updateSafetyUI(idx,candidates){
  candidates=(candidates||computeSafetyCandidates(idx)).filter(e=>{
    const isCam=['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','bus_lane_camera','mobile_camera'].includes(e.type);
    return !isCam||cameraMatchesRouteRoad(e,state.route?.geometry||[],state.currentRouteIndex,38);
  });
  const e=candidates[0];
  if(!e){hideSafetyAlert();state.activeSafetyEvent=null;return}
  if(Number(e.routeIndex)<idx-1||Number(e.d)<0){hideSafetyAlert();state.activeSafetyEvent=null;return}

  const info=safetyLabel(e),el=$('safetyAlert');
  el.className=`safety-alert ${info.kind}`;
  const iconEl=$('safetyAlertIcon');
  if(['speed_camera','signal_speed_camera','signal_camera','traffic_camera','section_speed_camera','mobile_camera','bus_lane_camera'].includes(e.type)){
    iconEl.innerHTML=safetyCctvSvg();iconEl.classList.add('sign-icon');
  }else if(e.type==='chronic_congestion'){
    iconEl.innerHTML=congestionMarkerSvg();iconEl.classList.add('sign-icon');
  }else{
    iconEl.textContent=info.icon;iconEl.classList.remove('sign-icon');
  }
  const guideLimit=safetyGuidanceLimit(idx,e);
  $('safetyAlertTitle').textContent=info.title;
  $('safetyAlertText').textContent=guideLimit>0&&String(e.type).includes('camera')?`${info.text} · 제한속도 ${Math.round(guideLimit)}km/h`:info.text;
  $('safetyAlertDistance').textContent=km(Math.max(0,e.d));
  state.activeSafetyId=e.id;state.activeSafetyEvent={...e,guideLimit};

  // 지나친 즉시 UI에서 제거되도록 active event는 전방 이벤트만 유지한다.
  if(!VOICE_SAFETY_TYPES.has(e.type)||e.d>420||e.d<5)return;
  const meters=e.d<100?Math.max(20,Math.round(e.d/10)*10):Math.max(100,Math.round(e.d/50)*50);
  let text='';
  if(e.type==='school_zone'||e.type==='school_nearby')text=`${meters}미터 앞 어린이 보호구역입니다.`;
  else if(e.type==='signal_speed_camera'||e.type==='signal_camera')text=`${meters}미터 앞 신호·속도 단속카메라입니다.${guideLimit?` 제한속도 ${Math.round(guideLimit)}킬로미터입니다.`:''}`;
  else if(e.type==='speed_camera'||e.type==='traffic_camera')text=`${meters}미터 앞 속도 단속카메라입니다.${guideLimit?` 제한속도 ${Math.round(guideLimit)}킬로미터입니다.`:''}`;
  else if(e.type==='bus_lane_camera')text=`${meters}미터 앞 버스전용차로 단속카메라입니다.`;
  else if(e.type==='mobile_camera')text=`${meters}미터 앞 이동식 카메라 단속구역입니다.`;
  else if(e.type==='section_speed_camera')text=`${meters}미터 앞 구간단속 구간입니다.${guideLimit?` 제한속도 ${Math.round(guideLimit)}킬로미터입니다.`:''}`;
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
    const d=distanceAlong(idx,ri);if(d<0||d>600)continue;if(!best||d<best.d)best={...e,d};
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
  // 1) 모의주행 프레임을 가장 먼저 즉시 중단
  if(state.simulationRaf)cancelAnimationFrame(state.simulationRaf);
  state.simulationRaf=0;
  const wasActive=Boolean(state.simulationActive);
  state.simulationActive=false;
  state.simulationLastAt=0;
  state.simulationDistance=null;

  // 2) GPS 응답을 기다리지 않고 모의주행 직전 실제 위치로 즉시 되돌린다.
  if(wasActive&&state.preSimulationUser&&state.tripStartedAt){
    state.user={...state.preSimulationUser};
    state.user.speed=Math.max(0,Number(state.user.speed)||0);

    const restoreDistance=Number(state.preSimulationRouteDistance);
    if(Number.isFinite(restoreDistance)){
      state.user.routeDistance=restoreDistance;
      const p=pointAtRouteDistance(restoreDistance);
      if(p){
        state.user.lng=p.lng;state.user.lat=p.lat;
        state.user.routeIndex=p.index;
        if(!Number.isFinite(Number(state.user.heading)))state.user.heading=p.heading;
      }
      state.driveMarkerRenderedDistance=restoreDistance;
      state.driveMarkerTargetDistance=restoreDistance;
      state.routeLockedDistance=Number.isFinite(Number(state.preSimulationRouteLockedDistance))
        ?Number(state.preSimulationRouteLockedDistance):restoreDistance;
      state.deadReckoningDistance=restoreDistance;
    }

    state.stationaryActive=Boolean(state.preSimulationStationaryActive)||state.user.speed<=0.05;
    state.stationaryGpsAnchor=state.preSimulationStationaryGpsAnchor
      ?{...state.preSimulationStationaryGpsAnchor}:null;

    ensureUserMarker();
    const el=state.userMarker?.getElement?.();
    if(el){el.style.opacity='1';el.style.visibility='visible';el.style.display='block'}

    if(state.map){
      state.lastUserMapInteractionAt=0;
      state.userMapInteracting=false;
      // 애니메이션 없이 즉시 실제 위치 복귀
      state.map.jumpTo({
        center:[state.user.lng,state.user.lat],
        zoom:17.2,
        pitch:state.map3D?55:0,
        bearing:Number(state.user.heading)||0,
        padding:driveCameraPadding()
      });
    }
    updateDriving(false);
  }

  updateSimulationControls();

  // 3) 이후 GPS watch를 복구하여 실제 최신 위치만 갱신
  if(wasActive&&resumeGps&&state.tripStartedAt){
    startWatch();
    locate(false).then(u=>{
      if(!u||!state.tripStartedAt||state.simulationActive)return;
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
function simulationTick(ts){
  state.simulationRaf=0;
  if(!state.simulationActive||!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative?.length)return;
  const total=Number(state.routeCumulative.at(-1))||0;
  const duration=Math.max(1,Number(state.route.duration)||1);
  if(!total)return stopRouteSimulation();

  const last=Number(state.simulationLastAt)||ts;
  const dt=Math.max(0,Math.min(.15,(ts-last)/1000));
  state.simulationLastAt=ts;

  const mult=Number(state.simulationSpeed)||1;
  const baseMps=Math.max(2,total/duration);
  let dist=Number(state.simulationDistance);
  if(!Number.isFinite(dist))dist=Number(state.user?.routeDistance)||0;
  dist=Math.min(total,dist+baseMps*mult*dt);

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
    ensureUserMarker();
    updateDriving(false);
  // 모의주행은 항상 캐릭터 중심으로 화면을 추종한다.
  if(state.map&&state.simulationActive){
    state.userMapInteracting=false;
    state.lastUserMapInteractionAt=0;
    const now=performance.now();
    if(!state.lastSimulationCameraAt||now-state.lastSimulationCameraAt>=120){
      state.lastSimulationCameraAt=now;
      state.map.easeTo({
        center:[state.user.lng,state.user.lat],
        zoom:17.2,
        pitch:state.map3D?55:0,
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
  state.simulationRaf=requestAnimationFrame(simulationTick);
}
function startRouteSimulation(){
  if(!state.tripStartedAt||!state.route?.geometry?.length)return toast('길안내가 시작된 뒤 모의주행을 사용할 수 있습니다.');
  if(state.routeMode!=='car')return toast('모의주행은 자동차 경로에서 사용할 수 있습니다.');
  if(state.simulationActive){stopRouteSimulation({resumeGps:true});return}

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
  state.simulationActive=true;
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
  updateSimulationControls();
  closeRouteInfo();
  toast(`모의주행 ${state.simulationSpeed}×를 시작합니다.`,1500);
  state.simulationRaf=requestAnimationFrame(simulationTick);
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
    try{const spec=routePreferenceSpec(),nr=await routeRequest(spec.priority,spec.avoid);state.route={...nr,_label:`경유지 추가 · ${spec.label}`,_character:state.character};state.routeOptions=[state.route];state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0;drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);renderTrafficRouteRail(0);updateDriving(true)}catch(e){toast('경유지 경로를 가져오지 못했습니다.',3000)}
  }else{
    state.waypoints=[];await changeDestinationWhileDriving(p);
  }
}
async function changeDestinationWhileDriving(item){
  if(!state.user)return toast('현재 위치를 확인할 수 없습니다.');
  closeDriveSearch();state.destination=normalizedPlace(item);setDestinationMarker();toast(`${state.destination.name}(으)로 목적지를 변경합니다.`);
  state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current';state.lastRerouteAt=Date.now();
  try{const spec=routePreferenceSpec(),r=await routeRequest(spec.priority,spec.avoid);state.route={...r,_label:`재탐색 · ${spec.label}`,_character:state.character};state.routeOptions=[state.route];state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0;drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);renderTrafficRouteRail(0);updateDriving(true)}catch(e){toast('새 목적지 경로를 가져오지 못했습니다.',3000)}
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

function speak(text,retry=0){
  if(!state.sound||!text)return;
  const c=characterDefs[state.character];
  const rate=state.character==='sunsik'?.82:state.character==='hunmin'?1.08:c.rate;
  const pitch=state.character==='sunsik'?.58:state.character==='hunmin'?.92:c.pitch;
  try{if(window.JofamsTtsBridge){if(window.JofamsTtsBridge.isReady?.()){window.JofamsTtsBridge.speak(String(text),state.character,rate,pitch,state.voiceVolume);return}if(retry<8){setTimeout(()=>speak(text,retry+1),300);return}}}catch(e){console.warn('native TTS failed; falling back',e)}
  if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return;
  const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.volume=state.voiceVolume;u.rate=rate;u.pitch=pitch;
  if(state.character==='sunsik')u.voice=pickMaleKoreanVoice('sunsik');else if(state.character==='hunmin')u.voice=pickMaleKoreanVoice('hunmin');else u.voice=pickDaimVoice();
  speechSynthesis.cancel();speechSynthesis.speak(u);
}

function ownerSuffix(){return state.firebase.user?.uid||'guest'}
function settingsKey(){return state.firebase.user?`${SETTINGS}.${state.firebase.user.uid}`:SETTINGS}

function savedGroupsStorageKey(){
  return state.firebase.user?`jofams-navi.saved-groups.v1.${state.firebase.user.uid}`:'jofams-navi.saved-groups.v1';
}
function loadSavedPlaceGroups(){
  const d=readJson(savedGroupsStorageKey(),null);
  state.savedPlaceGroups=Array.isArray(d?.groups)?d.groups.filter(x=>x&&x.id&&x.name):[];
  state.savedPlaceGroupMap=d?.map&&typeof d.map==='object'?d.map:{};
  if(!state.savedPlaceGroups.length)state.savedPlaceGroups=[{id:'favorites',name:'즐겨찾기'}];
  if(!state.activeSavedGroup)state.activeSavedGroup='all';
}
function persistSavedPlaceGroups(){
  try{localStorage.setItem(savedGroupsStorageKey(),JSON.stringify({groups:state.savedPlaceGroups,map:state.savedPlaceGroupMap}))}catch(e){console.warn('saved groups persist failed',e)}
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
  loadUserScopedLocal();loadLocalUserSettings();
  await Promise.all([loadCloudPrefs(),loadCloudFavorites(),loadUserSettings()]);
  const [places,favs,recents]=await Promise.all([loadDbSavedPlaces(),loadDbFavorites(),loadDbRecents()]);
  await persistCurrentUserDataIfDbEmpty(places,favs,recents);
  updateSavedLabels();renderRecentDestinations();updateFavoriteButtonState();
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
function changeVolume(v){state.voiceVolume=Math.max(0,Math.min(1,Number(v)/100));updateVolumeUI();saveLocalSettings();saveCloudPrefs()}

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
    authMod.onAuthStateChanged(auth,async user=>{state.firebase.user=user||null;state.adminVerified=false;state.adminVerifiedEmail='';resetLoginButton();renderProfile();if(user){state.loginPending=false;await verifyAdminAccess();await hydrateAuthenticatedUser()}else{loadLocal();loadLocalUserSettings();await Promise.all([loadDbSavedPlaces(),loadDbFavorites(),loadDbRecents(),loadUserSettings()]);updateFavoriteButtonState()}})
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
  state.firebase.user=null;state.adminVerified=false;state.adminVerifiedEmail='';state.loginPending=false;resetLoginButton();renderProfile();
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
    if(name)name.textContent='조팸스 드라이버';
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
async function handleVoiceCommandText(raw){
  const text=String(raw||'').trim();if(!text)return toast('목적지를 다시 말씀해 주세요.');
  if(text.includes('재탐색'))return reroute();
  if(text.includes('안내 종료')||text.includes('길 안내 종료'))return stopNavigation();
  if(text.includes('다임'))return setCharacter('daim');
  if(text.includes('순식'))return setCharacter('sunsik');
  if(text.includes('훈민'))return setCharacter('hunmin');
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
function startVoiceCommand(){
  if(window.JofamsVoiceBridge?.isNativeVoiceAvailable?.()){
    toast('목적지를 말씀해 주세요.');
    try{return window.JofamsVoiceBridge.startRecognition()}catch(e){console.warn('native voice bridge failed',e)}
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('이 기기에서는 음성 명령을 지원하지 않습니다.');return}
  const rec=new SR();rec.lang='ko-KR';rec.interimResults=false;rec.maxAlternatives=1;
  toast('목적지를 말씀해 주세요...');
  rec.onresult=e=>handleVoiceCommandText((e.results?.[0]?.[0]?.transcript||'').trim());
  rec.onerror=()=>toast('음성 인식을 다시 시도해 주세요.');
  try{rec.start()}catch{toast('음성 인식을 시작하지 못했습니다.')}
}
window.addEventListener('jofams-native-voice-result',e=>handleVoiceCommandText(e.detail?.text||e.detail||''));


function normalizedEmail(v){return String(v||'').trim().toLowerCase()}
function localAdminEmail(){
  const u=state.firebase.user;
  return normalizedEmail(u?.email||u?.providerData?.find?.(p=>p?.email)?.email||'');
}
function isAdminUser(){
  return localAdminEmail()===normalizedEmail(ADMIN_EMAIL) || state.adminVerified===true;
}
async function authFetch(url,opt={}){
  const token=await firebaseIdToken();
  if(!token)throw new Error('LOGIN_REQUIRED');
  const headers={...(opt.headers||{}),'authorization':`Bearer ${token}`};
  return fetch(url,{...opt,headers});
}
async function verifyAdminAccess(){
  if(!state.firebase.user){
    state.adminVerified=false;
    state.adminVerifiedEmail='';
    updateAdminUI();
    return false;
  }
  if(localAdminEmail()===normalizedEmail(ADMIN_EMAIL)){
    state.adminVerified=true;
    state.adminVerifiedEmail=localAdminEmail();
    updateAdminUI();
    return true;
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
function updateAdminUI(){const btn=$('adminModeBtn');if(btn)btn.classList.toggle('hidden',!isAdminUser())}
async function openAdminMode(){
  if(!isAdminUser())await verifyAdminAccess();
  if(!isAdminUser())return toast(`관리자 계정만 이용할 수 있습니다.${localAdminEmail()?` (현재: ${localAdminEmail()})`:''}`);
  $('adminAccountLabel').textContent=state.adminVerifiedEmail||localAdminEmail()||ADMIN_EMAIL;
  $('adminModal').classList.remove('hidden');
  switchAdminTab('notices');
}
function closeAdminMode(){$('adminModal')?.classList.add('hidden')}
function switchAdminTab(tab){document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));['notices','content','inquiries','onnuri'].forEach(k=>$(`admin${k[0].toUpperCase()+k.slice(1)}Panel`)?.classList.toggle('hidden',k!==tab));if(tab==='notices')loadAdminNotices();if(tab==='content')loadAdminContent();if(tab==='inquiries')loadAdminInquiries();if(tab==='onnuri')loadOnnuriBatchStatus()}
async function adminContentRequest(type,method='GET',body=null){const u=new URL('/api/content',location.origin);u.searchParams.set('type',type);const opt={method,headers:{'content-type':'application/json'}};if(body)opt.body=JSON.stringify(body);const r=method==='GET'?await fetch(u):await authFetch(u,opt);const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);return d}
async function loadAdminNotices(){try{const d=await adminContentRequest('notices');state.adminNotices=d.items||[];const box=$('adminNoticeList');box.innerHTML=state.adminNotices.length?state.adminNotices.map(x=>`<article><div><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.createdAt||'')}</small></div><button data-admin-notice-delete="${x.id}">삭제</button><p>${escapeHtml(x.body).replace(/\n/g,'<br>')}</p></article>`).join(''):'<div class="inquiry-empty">등록된 공지가 없습니다.</div>';box.querySelectorAll('[data-admin-notice-delete]').forEach(b=>b.onclick=()=>deleteAdminNotice(b.dataset.adminNoticeDelete))}catch{toast('공지 목록을 불러오지 못했습니다.')}}
async function saveAdminNotice(){const title=$('adminNoticeTitle').value.trim(),body=$('adminNoticeBody').value.trim();if(title.length<2||body.length<2)return toast('공지 제목과 내용을 입력해 주세요.');const btn=$('adminNoticeSaveBtn');btn.disabled=true;try{await adminContentRequest('notices','POST',{title,body});$('adminNoticeTitle').value='';$('adminNoticeBody').value='';showPlaceConfirmPopup('공지사항이 등록되었습니다.');loadAdminNotices()}catch{toast('공지 등록에 실패했습니다.')}finally{btn.disabled=false}}
async function deleteAdminNotice(id){if(!confirm('이 공지를 삭제할까요?'))return;try{await adminContentRequest('notices','DELETE',{id});showPlaceConfirmPopup('공지사항이 삭제되었습니다.');loadAdminNotices()}catch{toast('공지 삭제에 실패했습니다.')}}
async function loadAdminContent(){try{const d=await adminContentRequest('content');const c=d.content||{};$('adminAppInfoText').value=c.appInfo||'';$('adminPrivacyText').value=c.privacy||''}catch{toast('콘텐츠를 불러오지 못했습니다.')}}
async function saveAdminContent(){const btn=$('adminContentSaveBtn');btn.disabled=true;try{await adminContentRequest('content','PUT',{appInfo:$('adminAppInfoText').value,privacy:$('adminPrivacyText').value});showPlaceConfirmPopup('앱정보와 개인정보처리방침이 수정되었습니다.')}catch{toast('수정 내용 저장에 실패했습니다.')}finally{btn.disabled=false}}

let onnuriBatchRunning=false;
let onnuriBatchCursor=0;
let onnuriBatchGrandDone=0;
let onnuriBatchGrandTotal=0;

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
    if(!onnuriBatchRunning)updateOnnuriBatchProgress(Math.min(Number(d.cached||0),onnuriBatchGrandTotal),onnuriBatchGrandTotal);
    if(status)status.textContent=`D1 캐시 ${Number(d.cached||0).toLocaleString()}건 · 개별 점포 좌표 ${Number(d.precise||0).toLocaleString()}건`;
  }catch(e){
    if(status)status.textContent=`상태 확인 실패: ${e?.message||'서버 설정을 확인해 주세요.'}`;
  }
}
function updateOnnuriBatchProgress(done,total){
  const pct=total?Math.min(100,Math.round(done/total*100)):0;
  if($('onnuriBatchProgress'))$('onnuriBatchProgress').textContent=`${pct}%`;
  if($('onnuriBatchBar'))$('onnuriBatchBar').style.width=`${pct}%`;
}
async function runOnnuriStage(stage,label,total){
  let cursor=0;
  while(onnuriBatchRunning && cursor<total){
    if($('onnuriBatchStatus'))$('onnuriBatchStatus').textContent=`${label} ${cursor.toLocaleString()} / ${total.toLocaleString()} 처리 중…`;
    const r=await authFetch('/api/onnuri-geocode-batch',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({stage,cursor,limit:20})
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'batch failed');
    const advanced=Number(d.nextCursor||cursor)-cursor;
    cursor=Number(d.nextCursor||cursor);
    onnuriBatchGrandDone+=Math.max(0,advanced);
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
    onnuriBatchGrandDone=0;
    updateOnnuriBatchProgress(0,onnuriBatchGrandTotal);

    await runOnnuriStage('exact','실주소',Number(sd.exactTotal||0));
    if(onnuriBatchRunning)await runOnnuriStage('market','상점가 대표주소',Number(sd.marketFallbackTotal||0));
    if(onnuriBatchRunning)await runOnnuriStage('unresolved','미확인 가맹점',Number(sd.unresolvedTotal||0));

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
  if($('onnuriBatchStatus'))$('onnuriBatchStatus').textContent='사용자가 배치를 중지했습니다. 이미 저장된 D1 좌표는 유지됩니다.';
  if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').disabled=false;
  if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').disabled=true;
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
async function openAppPrivacy(){const c=await loadPublicContent();openInfoModal('앱정보 / 개인정보처리방침',`<div class="info-card privacy-copy"><h3>조팸스 내비</h3><p>${escapeHtml(c.appInfo||'앱정보가 준비 중입니다.').replace(/\n/g,'<br>')}</p><hr><p>${escapeHtml(c.privacy||'개인정보처리방침이 준비 중입니다.').replace(/\n/g,'<br>')}</p></div>`)}
function openDriveMenu(){$('driveMenu').classList.remove('hidden')}
function closeDriveMenu(){$('driveMenu').classList.add('hidden')}
function openMy(){closeBottomPanels('my');$('myModal').classList.remove('hidden');renderProfile();syncCharacterUI();updateVolumeUI();updateTripHistorySummary()}
function closeMy(){$('myModal').classList.add('hidden')}
function toggleSettingPanel(buttonId,panelId){const btn=$(buttonId),panel=$(panelId),open=panel.classList.contains('hidden');panel.classList.toggle('hidden',!open);btn.setAttribute('aria-expanded',String(open));if(open)setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50)}
async function shareArrival(){if(!state.destination)return;const text=`'${state.destination.name}' 이동 중입니다. 예상 도착 ${$('arrivalTime').textContent.replace('도착 ','')}`;try{if(navigator.share)await navigator.share({title:'조팸스 내비',text});else await navigator.clipboard.writeText(text),toast('도착 정보를 복사했습니다.')}catch{}}

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
        e.preventDefault();e.stopPropagation();searchPlaces($('destinationInput')?.value||'');
      }
    }catch(err){console.warn('home critical click failed',err)}
  },true);
}
function bindUI(){
  try{bindFutureDepartureUI();}catch(e){console.warn('UI bind section 1 failed',e)}
  try{$('allowLocationBtn').onclick=requestLocationPermission;$('allowCameraBtn').onclick=requestCameraPermission;$('permissionContinueBtn').onclick=closePermissionGate;}catch(e){console.warn('UI bind section 2 failed',e)}
  try{if($('homeSheetToggle'))$('homeSheetToggle').onclick=toggleHomeSheet;if($('mapPlacePromptCancel'))$('mapPlacePromptCancel').onclick=closeMapPlacePrompt;if($('mapPlacePromptGo'))$('mapPlacePromptGo').onclick=startMapPlaceNavigation;if($('voucherBuildingClose'))$('voucherBuildingClose').onclick=closeVoucherBuildingModal;window.addEventListener('online',()=>{state.localVoucherRetryCount=0;loadLocalVoucherMap({force:true})});if($('voucherBuildingModal'))$('voucherBuildingModal').addEventListener('click',e=>{if(e.target===$('voucherBuildingModal'))closeVoucherBuildingModal()});applyIcons();$('searchBtn').onclick=()=>searchPlaces($('destinationInput').value);$('destinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value)});document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>searchPlaces(b.dataset.query));}catch(e){console.warn('UI bind section 3 failed',e)}
  try{document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>setCharacter(b.dataset.character));$('homeShortcut').onclick=()=>state.savedPlaces.home?chooseDestination(state.savedPlaces.home):openPlaceModal('home');$('workShortcut').onclick=()=>state.savedPlaces.work?chooseDestination(state.savedPlaces.work):openPlaceModal('work');$('homeManageBtn').onclick=()=>openPlaceModal('home');$('workManageBtn').onclick=()=>openPlaceModal('work');$('favoriteShortcut').onclick=openFavoritesList;}catch(e){console.warn('UI bind section 4 failed',e)}
  try{document.querySelectorAll('[data-my-character]').forEach(b=>b.onclick=()=>{setCharacter(b.dataset.myCharacter);syncCharacterUI();toast(`${characterDefs[state.character].name} 가이드로 변경했습니다.`)});}catch(e){console.warn('UI bind section 5 failed',e)}
  try{document.querySelectorAll('[data-voice-character]').forEach(b=>b.onclick=()=>{setCharacter(b.dataset.voiceCharacter);syncCharacterUI();speak(`${characterDefs[state.character].name} 음성 안내입니다.`)});}catch(e){console.warn('UI bind section 6 failed',e)}
  try{$('voiceGuideSettingBtn').onclick=()=>{const opening=$('voiceGuidePanel').classList.contains('hidden');$('voiceGuidePanel').classList.toggle('hidden',!opening);$('characterSettingPanel').classList.toggle('hidden',!opening);$('voiceGuideSettingBtn').setAttribute('aria-expanded',String(opening))};$('voicePreviewBtn').onclick=()=>speak(`${characterDefs[state.character].name}이 길안내를 시작합니다. 안전운전하세요.`);}catch(e){console.warn('UI bind section 7 failed',e)}
  try{document.querySelectorAll('[data-route-mode]').forEach(b=>b.onclick=()=>selectTravelMode(b.dataset.routeMode));document.querySelectorAll('[data-home-facility]').forEach(b=>b.onclick=()=>loadHomeFacility(b.dataset.homeFacility));}catch(e){console.warn('route mode/facility bind failed',e)}
  try{$('menuBtn').onclick=openHamburgerMenu;$('myBtn').onclick=openMy;$('routeBackBtn').onclick=()=>{cancelAutoStart();setView('home')};$('routeFavoriteBtn').onclick=toggleFavorite;$('startBtn').onclick=startRouteGuidanceNow;if($('routeFutureDepartureBtn'))$('routeFutureDepartureBtn').onclick=()=>{cancelAutoStart();openFutureDeparture()};if($('postDriveFavoriteAddBtn'))$('postDriveFavoriteAddBtn').onclick=confirmPostDriveFavorite;if($('postDriveFavoriteSkipBtn'))$('postDriveFavoriteSkipBtn').onclick=closePostDriveFavoritePrompt;if($('postDriveFavoriteModal'))$('postDriveFavoriteModal').addEventListener('click',e=>{if(e.target===$('postDriveFavoriteModal'))closePostDriveFavoritePrompt()});$('routeOriginBtn').onclick=openOriginModal;}catch(e){console.warn('UI bind section 8 failed',e)}
  
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
    if($('fuelRefreshBtn'))$('fuelRefreshBtn').onclick=()=>loadFuelPrices(state.fuelProduct,{force:true});
    document.querySelectorAll('[data-fuel-product]').forEach(b=>b.onclick=()=>loadFuelPrices(b.dataset.fuelProduct,{force:true}));
    document.querySelectorAll('[data-fuel-modal-product]').forEach(b=>b.onclick=()=>loadFuelPrices(b.dataset.fuelModalProduct,{force:true,modal:true}));
    if($('driveFuelChip'))$('driveFuelChip').onclick=openFuelModal;
    if($('fuelModalClose'))$('fuelModalClose').onclick=closeFuelModal;
    if($('fuelModal'))$('fuelModal').addEventListener('click',e=>{if(e.target===$('fuelModal'))closeFuelModal()});
  }catch(e){console.warn('fuel UI bind failed',e)}
  try{$('driveMenuBtn').onclick=openDriveMenu;$('driveRefreshBtn').onclick=recenterDriveMap;$('mapCompassBtn').onclick=resetDriveCompass;$('map3dBtn').onclick=e=>{e.stopPropagation();state.map3D=!state.map3D;applyDriveMapMode();toggleMapControls(true)};$('mapSatelliteBtn').onclick=e=>{e.stopPropagation();toggleMapSatellite();toggleMapControls(true)};$('mapZoomInBtn').onclick=e=>{e.stopPropagation();state.map?.zoomIn({duration:180});toggleMapControls(true)};$('mapZoomOutBtn').onclick=e=>{e.stopPropagation();state.map?.zoomOut({duration:180});toggleMapControls(true)};$('driveView').addEventListener('click',e=>{if(e.target.closest('button,input,.maneuver-stack,.drive-bottom-card,.safety-alert,.traffic-status,.vms-banner,.lane-assist-layer'))return;toggleMapControls(true)});$('driveVoiceBtn').onclick=startVoiceCommand;$('arOpenBtn').onclick=startAR;$('driveArBtn').onclick=startAR;$('routeInfoBtn').onclick=openRouteInfo;if($('simulationStartBtn'))$('simulationStartBtn').onclick=startRouteSimulation;document.querySelectorAll('[data-simulation-speed]').forEach(b=>b.onclick=()=>setSimulationSpeed(b.dataset.simulationSpeed));$('driveSearchBtn').onclick=openDriveSearch;$('routeInfoClose').onclick=closeRouteInfo;$('routeInfoModal').addEventListener('click',e=>{if(e.target===$('routeInfoModal'))closeRouteInfo()});$('driveSearchClose').onclick=closeDriveSearch;$('driveSearchSubmit').onclick=()=>searchDriveDestinations($('driveSearchInput').value);$('driveSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchDriveDestinations(e.target.value)});$('driveSearchModal').addEventListener('click',e=>{if(e.target===$('driveSearchModal'))closeDriveSearch()});document.querySelector('.bottom-modal-backdrop').onclick=closeDriveMenu;$('otherRouteBtn').onclick=()=>{stopRouteSimulation({resumeGps:false});closeDriveMenu();stopWatch();setView('route');loadRouteOptions()};$('driveSettingBtn').onclick=()=>{closeDriveMenu();openMy()};$('shareBtn').onclick=shareArrival;$('endNavBtn').onclick=stopNavigation;}catch(e){console.warn('UI bind section 9 failed',e)}
  try{$('guideVolume').oninput=e=>changeVolume(e.target.value);$('myGuideVolume').oninput=e=>changeVolume(e.target.value);$('myCloseBtn').onclick=closeMy;$('myModal').addEventListener('click',e=>{if(e.target===$('myModal'))closeMy()});$('googleLoginBtn').onclick=loginGoogle;$('logoutBtn').onclick=logout;$('myFavoritesBtn').onclick=openFavoritesList;$('tripHistoryBtn').onclick=openTripHistory;$('noticeBtn').onclick=openNotices;if($('appPrivacyBtn'))$('appPrivacyBtn').onclick=openAppPrivacy;if($('permissionSettingBtn'))$('permissionSettingBtn').onclick=()=>toggleSettingPanel('permissionSettingBtn','permissionSettingPanel');if($('locationConsentToggle'))$('locationConsentToggle').onchange=e=>setPermissionPreference('location',e.target.checked);if($('cameraConsentToggle'))$('cameraConsentToggle').onchange=e=>setPermissionPreference('camera',e.target.checked);$('infoModalClose').onclick=closeInfoModal;$('infoModal').addEventListener('click',e=>{if(e.target===$('infoModal'))closeInfoModal()});}catch(e){console.warn('UI bind section 10 failed',e)}
  try{if($('hamburgerCloseBtn'))$('hamburgerCloseBtn').onclick=closeHamburgerMenu;if($('hamburgerMenuModal'))$('hamburgerMenuModal').addEventListener('click',e=>{if(e.target===$('hamburgerMenuModal'))closeHamburgerMenu()});}catch(e){console.warn('UI bind section 11 failed',e)}
  try{if($('hambPlaceManageBtn'))$('hambPlaceManageBtn').onclick=openDestinationManager;if($('hambRecentBtn'))$('hambRecentBtn').onclick=openRecentDestinationAll;if($('hambWaypointBtn'))$('hambWaypointBtn').onclick=openWaypointSaved;if($('hambTrafficBtn'))$('hambTrafficBtn').onclick=openTrafficDetail;if($('hambRoutePriorityBtn'))$('hambRoutePriorityBtn').onclick=openRoutePrioritySettings;if($('hambCameraSettingsBtn'))$('hambCameraSettingsBtn').onclick=openCameraAlertSettings;if($('hambSupportBtn'))$('hambSupportBtn').onclick=openSupportTerms;}catch(e){console.warn('UI bind section 12 failed',e)}
  try{if($('routePriorityClose'))$('routePriorityClose').onclick=()=>$('routePriorityModal').classList.add('hidden');document.querySelectorAll('[data-route-pref]').forEach(b=>b.onclick=()=>chooseRoutePreference(b.dataset.routePref));}catch(e){console.warn('UI bind section 13 failed',e)}
  try{if($('cameraAlertClose'))$('cameraAlertClose').onclick=()=>$('cameraAlertModal').classList.add('hidden');if($('speedCameraAlertToggle'))$('speedCameraAlertToggle').onchange=e=>updateCameraAlertSetting('speed',e.target.checked);if($('signalCameraAlertToggle'))$('signalCameraAlertToggle').onchange=e=>updateCameraAlertSetting('signal',e.target.checked);}catch(e){console.warn('UI bind section 14 failed',e)}
  try{if($('inquiryCloseBtn'))$('inquiryCloseBtn').onclick=closeInquiryModal;if($('newInquiryBtn'))$('newInquiryBtn').onclick=startInquiryCompose;if($('inquiryComposeBack'))$('inquiryComposeBack').onclick=backInquiryList;if($('inquirySubmitBtn'))$('inquirySubmitBtn').onclick=submitInquiry;}catch(e){console.warn('UI bind section 15 failed',e)}
  try{if($('adminModeBtn'))$('adminModeBtn').onclick=openAdminMode;if($('adminCloseBtn'))$('adminCloseBtn').onclick=closeAdminMode;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>switchAdminTab(b.dataset.adminTab));if($('adminNoticeSaveBtn'))$('adminNoticeSaveBtn').onclick=saveAdminNotice;if($('adminContentSaveBtn'))$('adminContentSaveBtn').onclick=saveAdminContent;if($('onnuriBatchStartBtn'))$('onnuriBatchStartBtn').onclick=startOnnuriBatch;if($('onnuriBatchStopBtn'))$('onnuriBatchStopBtn').onclick=stopOnnuriBatch;}catch(e){console.warn('UI bind section 16 failed',e)}
  try{if($('waypointSearchClose'))$('waypointSearchClose').onclick=()=>closeWaypointSearch(true);if($('waypointSearchSubmit'))$('waypointSearchSubmit').onclick=()=>searchWaypointPlaces($('waypointSearchInput').value);if($('waypointSearchInput'))$('waypointSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchWaypointPlaces(e.target.value)});if($('waypointSearchModal'))$('waypointSearchModal').addEventListener('click',e=>{if(e.target===$('waypointSearchModal'))closeWaypointSearch(true)});if($('drivePlaceChoiceClose'))$('drivePlaceChoiceClose').onclick=closeDrivePlaceChoice;if($('drivePlaceAsWaypoint'))$('drivePlaceAsWaypoint').onclick=()=>applyDrivePlaceChoice('waypoint');if($('drivePlaceAsDestination'))$('drivePlaceAsDestination').onclick=()=>applyDrivePlaceChoice('destination');if($('drivePlaceChoiceModal'))$('drivePlaceChoiceModal').addEventListener('click',e=>{if(e.target===$('drivePlaceChoiceModal'))closeDrivePlaceChoice()});}catch(e){console.warn('UI bind section waypoint/permission failed',e)}
  try{$('originModalClose').onclick=closeOriginModal;$('useCurrentOriginBtn').onclick=useCurrentOrigin;$('originSearchBtn').onclick=()=>searchOrigins($('originSearchInput').value);$('originSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchOrigins(e.target.value)});$('originModal').addEventListener('click',e=>{if(e.target===$('originModal'))closeOriginModal()});$('arCloseBtn').onclick=stopAR;document.querySelectorAll('[data-bottom-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.bottomNav;closeBottomPanels(nav);if(nav==='home'){cancelAutoStart();setView('home')}else if(nav==='where'){setView('home');openWhereTo()}else if(nav==='saved'){setView('home');openSavedPlaces()}else if(nav==='my')openMy()});$('placeModalClose').onclick=()=>$('placeModal').classList.add('hidden');if($('useCurrentPlaceBtn'))$('useCurrentPlaceBtn').onclick=saveCurrentLocationAsPlace;if($('placeSaveBtn'))$('placeSaveBtn').onclick=confirmRegisteredPlace;if($('whereToClose'))$('whereToClose').onclick=closeWhereTo;
if($('whereToRefresh'))$('whereToRefresh').onclick=refreshWhereTo;
if($('whereToModal'))$('whereToModal').addEventListener('click',e=>{if(e.target===$('whereToModal'))closeWhereTo()});
document.querySelectorAll('[data-where-tab]').forEach(b=>b.onclick=()=>{state.whereToTab=b.dataset.whereTab;renderWhereToList();refreshWhereTo()});
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
function bootstrapApp(){
  try{applyIcons()}catch(e){console.warn('applyIcons failed',e)}
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
  Promise.resolve().then(()=>initFirebase()).catch(e=>console.warn('firebase init failed',e));
  try{loadSavedWaypointCourses();renderProfile();updateOriginUI();renderRouteWaypoints();renderSavedWaypointCourses();updateTripHistorySummary();setView('home')}catch(e){console.error('initial render failed',e)}
  if('speechSynthesis'in window){try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices()}catch{}}
  setTimeout(()=>refreshPermissionState().catch(()=>{}),180);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrapApp,{once:true});else bootstrapApp();
