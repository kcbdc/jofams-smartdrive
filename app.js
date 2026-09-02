const $ = id => document.getElementById(id);
const CONFIG = window.__APP_CONFIG__ || {};
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
  savedPlaces:{home:null,work:null},favorites:[],placeKind:null,origin:null,originMode:'current',
  arStream:null,arFrame:0,arRunning:false,permissionCameraGranted:false,permissionLocationGranted:false,
  tripHistory:[],safetyEvents:[],safetyMarkers:[],lastSafetySpoken:new Set(),activeSafetyId:null,safetyRequestSeq:0,lastTrafficStatus:'',lastTrafficSpokenAt:0,overspeedActive:false,lastOverspeedSpokenAt:0,map3D:false,mapControlsVisible:false,liveRouteTimer:0,lastLiveRouteAt:0,lastVmsKey:'',destinationCycleTimer:0,destinationHideTimer:0,lastDestinationShownAt:0,deadReckoningTimer:0,lastRealGpsAt:0,lastGpsTickAt:0,lastRealSpeedMps:0,lastRealHeading:0,gpsEstimated:false,lastDeadReckoningNoticeAt:0,officialCameraRows:null,officialCameraPromise:null,
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
    car:`<svg viewBox="0 0 24 24" ${common}><path d="M5 17h14l-1-6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2zM7 17v2M17 17v2M8 14h.1M16 14h.1"/><path d="M7 9l2-4h6l2 4"/></svg>`,
    location:`<svg viewBox="0 0 24 24" ${common}><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>`,
    camera:`<svg viewBox="0 0 24 24" ${common}><path d="M4 7h4l1.5-2h5L16 7h4v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`
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


const CAMERA_DATASET_URL='/data/unmanned_traffic_cameras.json';

async function loadOfficialCameraRows(){
  if(Array.isArray(state.officialCameraRows))return state.officialCameraRows;
  if(state.officialCameraPromise)return state.officialCameraPromise;
  state.officialCameraPromise=fetch(CAMERA_DATASET_URL,{cache:'force-cache'}).then(r=>{
    if(!r.ok)throw new Error(`camera dataset HTTP ${r.status}`);
    return r.json();
  }).then(d=>{
    const rows=Array.isArray(d)?d:Array.isArray(d?.records)?d.records:Array.isArray(d?.response?.body?.items)?d.response.body.items:[];
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
  if(/신호/.test(s)||s==='2')return 'signal_camera';
  if(/속도|과속/.test(s)||s==='1')return 'speed_camera';
  return 'traffic_camera';
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
  const bounds=expandBounds(geometryBounds(geometry),1400); const out=[];
  for(const row of rows){
    const lat=Number(pickField(row,['위도','latitude','lat'])),lng=Number(pickField(row,['경도','longitude','lng','lon']));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!inBounds(lat,lng,bounds))continue;
    const idx=nearestIndex(lng,lat,geometry),p=geometry[idx]; if(!p)continue;
    const d=hav(lat,lng,p[1],p[0]); if(d>320)continue;
    const type=officialCameraType(pickField(row,['단속구분','regltSe','규제구분']));
    const maxspeed=Number(pickField(row,['제한속도','lmttVe','speedLimit']))||0;
    const protectedArea=String(pickField(row,['보호구역구분','protectedArea'])).trim();
    const roadName=String(pickField(row,['도로노선명','도로명','roadName'])).trim();
    const name=String(pickField(row,['설치장소','itlpc','소재지도로명주소','소재지지번주소', '도로노선명'])).trim()||'무인교통단속카메라';
    const base={
      id:`local-camera:${pickField(row,['무인교통단속카메라관리번호','mnlssRegltCameraManageNo'])||`${lat}:${lng}`}`,
      type,lat,lng,routeIndex:idx,name,maxspeed,
      authority:String(pickField(row,['관리기관명','institutionNm'])).trim(),
      protectedArea,roadName,source:'전국무인교통단속카메라표준데이터(로컬 파일)'
    };
    out.push(base);
    if(/어린이|스쿨|school/i.test(protectedArea)){
      out.push({...base,id:`${base.id}:school`,type:'school_zone',name:`${name} 어린이보호구역`,maxspeed:maxspeed||30});
    }
  }
  return mergeSafetyEvents(out,geometry);
}
function applyRouteSpeedLimitHints(route,events=[]){
  const segs=route?.roadSegments||[];
  const limitEvents=events.filter(e=>Number(e?.maxspeed)>0&&['speed_camera','signal_camera','signal_speed_camera','traffic_camera','speed_limit','school_zone'].includes(e.type));
  if(!segs.length||!limitEvents.length)return;
  for(const seg of segs){
    if(Number(seg?.speedLimit)>0)continue;
    const start=Number(seg.startIndex)||0,end=Number(seg.endIndex)||start,mid=(start+end)/2;
    let best=null,bestScore=Infinity;
    for(const e of limitEvents){
      const ri=Number(e.routeIndex); if(!Number.isFinite(ri))continue;
      const score=Math.abs(ri-mid);
      if(score<bestScore&&score<=90){best=e;bestScore=score}
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
    state.map.once('styledata',()=>{state.mapReady=true;enforce2DMap();refreshMapLayout({fitRoute:Boolean(state.route)});if(state.route)drawRoute(state.route,{fit:true});setTimeout(()=>{if(!mapHasRenderedTiles())useMapFallback()},2600)});
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
      if(state.pendingRouteDraw){const p=state.pendingRouteDraw;state.pendingRouteDraw=null;drawRoute(p.route,p.options)}
      permissionStatus('geolocation').then(s=>{if(s==='granted')locate(false)});
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
function refreshMapLayout({fitRoute=false}={}){
  if(!state.map)return;
  const run=()=>{try{state.map.resize();if(state.route?.geometry?.length){drawRoute(state.route,{fit:fitRoute})}else if(state.user){state.map.jumpTo({center:[state.user.lng,state.user.lat]})}}catch(e){console.warn('map resize failed',e)}};
  requestAnimationFrame(run);setTimeout(run,80);setTimeout(run,280);
}
function makeCarMarker(){const el=document.createElement('div');el.className='character-car-marker rear-version';el.innerHTML=`<img src="${characterDefs[state.character].rear||characterDefs[state.character].marker}" alt="${characterDefs[state.character].name} 자동차 후면">`;return new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'viewport'});}
function updateCarMarkerImage(){const img=state.userMarker?.getElement()?.querySelector('img');if(img)img.src=characterDefs[state.character].rear||characterDefs[state.character].marker}
function makeDestMarker(){const el=document.createElement('div');el.className='destination-pin';return new maplibregl.Marker({element:el,anchor:'bottom'})}
function ensureUserMarker(){if(!state.user||!state.map)return;if(!state.userMarker)state.userMarker=makeCarMarker().setLngLat([state.user.lng,state.user.lat]).addTo(state.map);else state.userMarker.setLngLat([state.user.lng,state.user.lat])}
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
  if(!navigator.geolocation){toast('위치 기능을 지원하지 않습니다.');return null}
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>{applyGps(p,fly);resolve(state.user)},()=>{toast('현재 위치 권한을 확인해 주세요.');resolve(null)},{enableHighAccuracy:true,timeout:7000,maximumAge:0}))
}
function applyGps(pos,fly=false){
  const c=pos.coords||pos,stateObj={lng:Number(c.longitude??c.lng),lat:Number(c.latitude??c.lat),speed:Number(c.speed),heading:Number(c.heading),accuracy:Number(c.accuracy)||0,estimated:false};
  if(!pointValid(stateObj))return;
  const now=Date.now();
  if(Number.isFinite(stateObj.speed)&&stateObj.speed>=0)state.lastRealSpeedMps=stateObj.speed;
  if(Number.isFinite(stateObj.heading))state.lastRealHeading=stateObj.heading;
  state.lastRealGpsAt=now;state.lastGpsTickAt=now;state.gpsEstimated=false;
  if(!Number.isFinite(stateObj.speed))stateObj.speed=state.lastRealSpeedMps||0;
  if(!Number.isFinite(stateObj.heading))stateObj.heading=state.lastRealHeading;
  state.user=stateObj;ensureUserMarker();
  if(fly)state.map.easeTo({center:[stateObj.lng,stateObj.lat],zoom:16,duration:500});
  if(state.route&&$('driveView')&&!$('driveView').classList.contains('hidden'))updateDriving();
}
function pointAtRouteDistance(target){
  const g=state.route?.geometry||[],cum=state.routeCumulative||[];if(!g.length||!cum.length)return null;
  const total=cum.at(-1)||0,t=Math.max(0,Math.min(total,target));let lo=0,hi=cum.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<t)lo=mid+1;else hi=mid}
  const i=Math.max(1,lo),a=cum[i-1],b=cum[i],r=b>a?(t-a)/(b-a):0,p0=g[i-1],p1=g[i];
  return{lng:p0[0]+(p1[0]-p0[0])*r,lat:p0[1]+(p1[1]-p0[1])*r,index:i,heading:bearing(p0[1],p0[0],p1[1],p1[0])};
}
function deadReckoningTick(){
  if(!state.tripStartedAt||!state.route?.geometry?.length||!state.routeCumulative.length||!state.user)return;
  const now=Date.now(),sinceReal=now-(state.lastRealGpsAt||0);if(sinceReal<2500||sinceReal>120000)return;
  const speed=Math.max(0,Number(state.lastRealSpeedMps)||0);if(speed<1.2)return;
  const dt=Math.min(2,(now-(state.lastGpsTickAt||now))/1000);state.lastGpsTickAt=now;if(dt<=0)return;
  const idx=Math.max(0,state.currentRouteIndex||nearestIndex(state.user.lng,state.user.lat,state.route.geometry));
  const currentDist=state.routeCumulative[idx]||0,target=currentDist+speed*dt,p=pointAtRouteDistance(target);if(!p)return;
  state.user={...state.user,lng:p.lng,lat:p.lat,speed,heading:p.heading,accuracy:Math.max(35,Number(state.user.accuracy)||0),estimated:true};state.gpsEstimated=true;ensureUserMarker();updateDriving();
  if(now-state.lastDeadReckoningNoticeAt>30000){state.lastDeadReckoningNoticeAt=now;toast('GPS 신호 약함 · 차량 속도로 터널 위치를 추정 중입니다.',2200)}
}
function startDeadReckoning(){clearInterval(state.deadReckoningTimer);state.deadReckoningTimer=setInterval(deadReckoningTick,1000)}
function stopDeadReckoning(){clearInterval(state.deadReckoningTimer);state.deadReckoningTimer=0;state.gpsEstimated=false}
function startWatch(){if(state.watchId!=null)return;state.watchId=navigator.geolocation.watchPosition(p=>applyGps(p,false),()=>{}, {enableHighAccuracy:true,maximumAge:0,timeout:7000});startDeadReckoning()}
function stopWatch(){if(state.watchId!=null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null}stopDeadReckoning()}

/* ---------- SEARCH / SAVED PLACES ---------- */
function isNearbySearchQuery(q=''){const n=String(q).replace(/\s+/g,'').replace(/내주변|주변|근처|가까운/g,'');return /^(주유소|충전소|전기차충전소|마트|대형마트|슈퍼|슈퍼마켓|편의점|주차장|공영주차장)$/.test(n)}
async function searchPlaces(q,target='searchResults'){
  const box=$(target);if(!q?.trim())return;box.classList.remove('hidden');box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';
  if(isNearbySearchQuery(q)&&!state.user)await locate(false);
  try{const u=new URL('/api/search',location.origin);u.searchParams.set('q',q.trim());if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}const r=await fetch(u);if(!r.ok)throw new Error('검색 오류');const d=await r.json();const items=d.items||[];box.innerHTML='';if(!items.length){box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>';return}items.slice(0,8).forEach(x=>{const b=document.createElement('button');b.className='search-result';b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}${Number.isFinite(Number(x.distance))?` · ${km(Number(x.distance))}`:''}</small>`;b.onclick=()=>target==='placeSearchResults'?saveRegisteredPlace(x):chooseDestination(x);box.appendChild(b)})}catch(e){box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}
async function chooseDestination(item){
  state.destination=normalizedPlace(item);
  setDestinationMarker();
  $('searchResults').classList.add('hidden');
  $('routeDestinationName').textContent=state.destination.name;
  $('routeAddressDest').textContent=state.destination.name;
  setView('route');
  refreshMapLayout();
  $('routeCards').innerHTML='<div class="auto-start-hint">출발 위치 확인 중...</div>';
  // 화면 전환을 먼저 완료해 탭 반응이 즉시 보이게 한 뒤, GPS/경로 계산은 비동기로 처리한다.
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(!state.user)await locate(false);
  if(!state.user){$('routeCards').innerHTML='<div class="auto-start-hint">위치 권한을 허용하면 경로를 계산합니다.</div>';showPermissionGate();return}
  if(!state.origin||state.originMode==='current'){state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current'}
  updateOriginUI();
  loadRouteOptions();
}
function openPlaceModal(kind){state.placeKind=kind;$('placeModalTitle').textContent=kind==='home'?'집 등록':'회사 등록';$('placeSearchInput').value='';$('placeSearchResults').innerHTML='';$('placeModal').classList.remove('hidden');setTimeout(()=>$('placeSearchInput').focus(),100)}
async function saveRegisteredPlace(x){const p=normalizedPlace(x);state.savedPlaces[state.placeKind]=p;saveLocalSettings();await saveCloudPrefs();updateSavedLabels();$('placeModal').classList.add('hidden');toast(`${state.placeKind==='home'?'집':'회사'}을 저장했습니다.`)}
function updateSavedLabels(){$('homeLabel').textContent=state.savedPlaces.home?.name||'등록';$('workLabel').textContent=state.savedPlaces.work?.name||'등록';$('favoriteLabel').textContent=`${state.favorites.length}곳`;$('myFavoriteCount').textContent=`${state.favorites.length}곳 저장`}

/* ---------- ROUTES ---------- */
async function routeRequest(priority='RECOMMEND',avoid=null){
  const o=state.originMode==='current'?(state.user||state.origin):(state.origin||state.user);const body={origin:{lng:o.lng,lat:o.lat,heading:state.originMode==='current'?state.user?.heading:null},destination:{lng:state.destination.lng,lat:state.destination.lat},priority,alternatives:false};if(avoid)body.avoid=avoid;
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
  const box=$('routeCards');box.innerHTML='';state.routeOptions.forEach((r,i)=>{const c=characterDefs[r._character],b=document.createElement('button');b.className=`route-card ${i===state.selectedRoute?'selected':''}`;const fare=r.fare?.toll||0;b.innerHTML=`<div class="route-meta"><span class="route-tag ${r._class}">${r._label}</span><strong>${mins(r.duration)}</strong><small>${km(r.distance)} · ${fare?`${fare.toLocaleString()}원`:'통행료 0원'}</small><em>예상 도착 ${eta(r.duration)}</em></div><img src="${c.car}" alt="${c.name} 자동차">`;b.onclick=()=>{selectRoute(i,true);renderRouteCards();scheduleAutoStart()};box.appendChild(b)})
}
function selectRoute(index,fit=true){state.selectedRoute=index;state.route=state.routeOptions[index];syncCharacterUI();drawRoute(state.route,{fit});state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0;updateRoutePlanEta();loadSafetyEvents(state.route)}
function scheduleAutoStart(){cancelAutoStart();state.autoStartSeconds=3;updateAutoHint();state.autoStartTimer=setInterval(()=>{state.autoStartSeconds--;if(state.autoStartSeconds<=0){cancelAutoStart();startNavigation()}else updateAutoHint()},1000)}
function cancelAutoStart(){if(state.autoStartTimer){clearInterval(state.autoStartTimer);state.autoStartTimer=null}}
function updateAutoHint(){$('autoStartHint').textContent=state.autoStartSeconds>0?`${state.autoStartSeconds}초 후 자동으로 안내를 시작합니다.`:''}


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
  if(state.arRunning)return;
  if(!state.route||!state.destination){toast('먼저 길안내를 시작해 주세요.');return}
  if(!navigator.mediaDevices?.getUserMedia){toast('이 기기에서는 AR 카메라를 지원하지 않습니다.');return}
  try{
    state.arStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    $('arVideo').srcObject=state.arStream;state.arRunning=true;$('arView').classList.remove('hidden');$('bottomNav').classList.add('hidden');$('driveMenu').classList.add('hidden');
    $('arCharacterCar').src=characterDefs[state.character].marker;updateAROverlay();drawARScene();
  }catch(e){console.warn(e);toast('카메라 권한을 허용해 주세요.',3000)}
}
function stopAR(){
  if(state.arFrame)cancelAnimationFrame(state.arFrame);state.arFrame=0;state.arRunning=false;$('arView')?.classList.add('hidden');
  if(state.arStream){state.arStream.getTracks().forEach(t=>t.stop());state.arStream=null}
  if(!$('driveView')?.classList.contains('hidden'))$('bottomNav')?.classList.add('hidden');
}
function updateAROverlay(){
  if(!state.route||!state.user)return;const idx=state.currentRouteIndex||0,total=state.routeCumulative.at(-1)||state.route.distance||1,done=state.routeCumulative[idx]||0,remain=Math.max(0,total-done),ratio=Math.max(0,Math.min(1,remain/total)),remainSec=(state.route.duration||0)*ratio;
  const guides=(state.route.guides||[]).filter(x=>Number(x.routeIndex)>idx+1),g=guides[0];
  if(g){const d=distanceAlong(idx,g.routeIndex);$('arTurnIcon').innerHTML=turnSvg(g.type);$('arTurnDistance').textContent=km(d);$('arCenterDistance').textContent=km(d);$('arTurnRoad').textContent=g.name||g.guidance||'다음 안내'}
  else{$('arTurnIcon').innerHTML=turnSvg(0);$('arTurnDistance').textContent=km(remain);$('arCenterDistance').textContent=km(remain);$('arTurnRoad').textContent='목적지까지 직진'}
  $('arSpeed').textContent=Math.max(0,Math.round((state.user.speed||0)*3.6));$('arEta').textContent=eta(remainSec);$('arRemain').textContent=km(remain);$('arCharacterCar').src=characterDefs[state.character].rear||characterDefs[state.character].marker;
  const marker=$('arCharacterMarker');if(marker){const near=g?Math.max(0,Math.min(1,1-distanceAlong(idx,g.routeIndex)/650)):0;marker.classList.add('rear-facing');marker.style.setProperty('--ar-car-x','0px');marker.style.setProperty('--ar-car-y',`${-near*26}px`)}
}
function drawARScene(){
  if(!state.arRunning)return;
  const canvas=$('arCanvas'),rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(dpr,dpr);
  const W=rect.width,H=rect.height;
  // MVP 7.5: AR 화살표는 완전히 제거하고, 샘플처럼 반짝이는 파란 주행 리본이 전방으로 길게 뻗어가도록 구성한다.
  // 소실점은 화면 52% 부근으로 내려 기존보다 더 낮고 안정적인 시야각을 만든다.
  const horizon=H*.52,bottom=H*.985;
  const idx=state.currentRouteIndex||0,guides=(state.route?.guides||[]).filter(x=>Number(x.routeIndex)>idx+1),next=guides[0];
  let turnBias=0;if(next){const d=distanceAlong(idx,next.routeIndex);if(d<700){if([1,5].includes(Number(next.type)))turnBias=-1;if([2,6].includes(Number(next.type)))turnBias=1}}
  const centerX=t=>W/2+turnBias*Math.pow(1-t,1.85)*W*.18;
  const base=new Path2D(),topHalf=Math.max(6,W*.016),bottomHalf=W*.185;
  base.moveTo(centerX(0)-topHalf,horizon);
  base.lineTo(centerX(0)+topHalf,horizon);
  base.lineTo(centerX(1)+bottomHalf,bottom);
  base.lineTo(centerX(1)-bottomHalf,bottom);
  base.closePath();
  const baseGrad=ctx.createLinearGradient(0,horizon,0,bottom);
  baseGrad.addColorStop(0,'rgba(82,220,255,.10)');
  baseGrad.addColorStop(.35,'rgba(54,193,255,.22)');
  baseGrad.addColorStop(.74,'rgba(36,151,255,.32)');
  baseGrad.addColorStop(1,'rgba(22,112,255,.42)');
  ctx.save();ctx.shadowColor='rgba(26,173,255,.28)';ctx.shadowBlur=28;ctx.fillStyle=baseGrad;ctx.fill(base);ctx.restore();

  const core=new Path2D(),topCore=Math.max(4,W*.008),bottomCore=W*.092;
  core.moveTo(centerX(0)-topCore,horizon);
  core.lineTo(centerX(0)+topCore,horizon);
  core.lineTo(centerX(1)+bottomCore,bottom);
  core.lineTo(centerX(1)-bottomCore,bottom);
  core.closePath();
  const coreGrad=ctx.createLinearGradient(0,horizon,0,bottom);
  coreGrad.addColorStop(0,'rgba(180,245,255,.24)');
  coreGrad.addColorStop(.4,'rgba(108,226,255,.28)');
  coreGrad.addColorStop(.82,'rgba(56,186,255,.32)');
  coreGrad.addColorStop(1,'rgba(34,146,255,.38)');
  ctx.fillStyle=coreGrad;ctx.fill(core);

  const shine=new Path2D(),shineTop=Math.max(2,W*.0036),shineBottom=W*.025;
  shine.moveTo(centerX(0)-shineTop,horizon);
  shine.lineTo(centerX(0)+shineTop,horizon);
  shine.lineTo(centerX(1)+shineBottom,bottom);
  shine.lineTo(centerX(1)-shineBottom,bottom);
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
    const x0=centerX(t0),x1=centerX(t1);
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

/* ---------- DRIVE ---------- */
function saveTripHistory(){try{localStorage.setItem(TRIP_HISTORY,JSON.stringify(state.tripHistory.slice(0,50)))}catch{}}
function addTripHistory(entry){state.tripHistory=[entry,...state.tripHistory].slice(0,50);saveTripHistory();updateTripHistorySummary()}
function updateTripHistorySummary(){if($('tripHistorySummary'))$('tripHistorySummary').textContent=state.tripHistory.length?`최근 ${state.tripHistory.length}건 저장`:'주행 기록이 없습니다.'}
function openInfoModal(title,html){$('infoModalTitle').textContent=title;$('infoModalBody').innerHTML=html;$('infoModal').classList.remove('hidden');applyIcons($('infoModalBody'))}
function closeInfoModal(){$('infoModal').classList.add('hidden')}
function openTripHistory(){const items=state.tripHistory||[];const html=items.length?`<div class="history-list">${items.map(x=>`<article><b>${escapeHtml(x.destination||'목적지')}</b><small>${escapeHtml(x.date||'')} · ${km(Number(x.distance)||0)} · ${mins(Number(x.duration)||0)}</small><em>${escapeHtml(characterDefs[x.character]?.name||'')}</em></article>`).join('')}</div>`:'<div class="empty-info">저장된 주행 기록이 없습니다.</div>';openInfoModal('주행기록',html)}
function openAppInfo(){openInfoModal('앱정보','<div class="info-card"><h3>조팸스 내비</h3><p><b>버전</b> MVP 7.5</p><p>2D 컬러 지도, 실시간 교통상태, AR 안내, 단속카메라·스쿨존·사고·공사 안내와 다임·순식·훈민 캐릭터 음성 안내를 제공합니다.</p></div>')}
function openPrivacy(){openInfoModal('개인정보처리방침','<div class="info-card privacy-copy"><h3>개인정보 처리 안내</h3><p>길안내를 위해 사용자가 허용한 경우 현재 위치 정보를 이용합니다. AR 안내는 카메라 영상을 기기 화면에 표시하며, 본 앱 소스에서는 카메라 영상을 서버에 저장하지 않습니다.</p><p>Google 로그인 사용 시 계정의 기본 프로필 정보와 사용자가 저장한 설정·즐겨찾기를 Firebase에 동기화할 수 있습니다. 권한은 브라우저 또는 앱 설정에서 언제든 변경할 수 있습니다.</p><p>실제 상용 배포 전에는 운영주체, 처리 목적, 보유기간, 제3자 제공·처리위탁, 이용자 권리 및 문의처를 반영한 공식 개인정보처리방침으로 교체해야 합니다.</p></div>')}
async function logTrip(event){try{await fetch('/api/trip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,destination:state.destination?.name||null,distance:state.route?.distance||null,duration:state.tripStartedAt?Math.round((Date.now()-state.tripStartedAt)/1000):null,character:state.character,provider:state.route?.provider||null,guideType:null})})}catch{}}
const NOTICE_ITEMS=[
  {date:'2026.09.01',title:'MVP 7.5 AR 리본·단속카메라 로컬데이터 개선',body:'AR 지도 리본 시야각 조정, 로컬 무인단속카메라 데이터 적용, 제한속도 표시 보강, 터널 추정주행과 120초 경로 갱신을 유지합니다.'},
  {date:'2026.09.01',title:'안전운전 정보 안내',body:'단속카메라, 스쿨존, 사고·공사 및 교통정보는 실제 도로 표지와 교통법규를 우선하여 이용해 주세요.'}
];
function openNotices(){openInfoModal('공지사항',`<div class="notice-list">${NOTICE_ITEMS.map(x=>`<article><time>${escapeHtml(x.date)}</time><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.body)}</p></article>`).join('')}</div>`)}
function applyNightMode(){const h=new Date().getHours(),night=h>=19||h<6;document.body.classList.toggle('night-map',night);return night}
async function tryLandscapeFullscreen(){
  const landscape=matchMedia('(orientation: landscape)').matches;
  document.body.classList.toggle('landscape-drive',landscape&&(!$('driveView')?.classList.contains('hidden')||state.arRunning));
  if(!landscape||($('driveView')?.classList.contains('hidden')&&!state.arRunning))return;
  try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'})}catch{}
  setTimeout(()=>state.map?.resize(),120);
}
function applyDriveMapMode(){
  if(!state.map)return;const pitch=state.map3D?55:0;
  try{setBuildingExtrusions(state.map3D);state.map.jumpTo({pitch});const btn=$('map3dBtn');if(btn){btn.classList.toggle('active',state.map3D);btn.textContent=state.map3D?'2D':'3D';btn.setAttribute('aria-label',state.map3D?'2D 지도 보기':'3D 지도 보기')}state.map.resize()}catch(e){console.warn('map mode change failed',e)}
}
function toggleMapControls(force){const el=$('driveMapControls');if(!el)return;state.mapControlsVisible=typeof force==='boolean'?force:!state.mapControlsVisible;el.classList.toggle('hidden',!state.mapControlsVisible);if(state.mapControlsVisible){clearTimeout(toggleMapControls.t);toggleMapControls.t=setTimeout(()=>toggleMapControls(false),5000)}}
function updateLaneGuide(){ /* MVP 7.2: 차로 안내 레이어 제거 */ }
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
async function liveRouteRefresh(){
  if(!state.tripStartedAt||!state.user||!state.destination||Date.now()-state.lastLiveRouteAt<115000)return;
  state.lastLiveRouteAt=Date.now();
  try{
    const r=await routeRequest('RECOMMEND');if(!r?.geometry?.length)return;const old=state.route;if(!old)return;
    mergeFreshTraffic(old,r);drawRoute(old,{fit:false});renderTrafficRouteRail(state.currentRouteIndex);updateTrafficStatus((old.roadSegments||[]).find(x=>state.currentRouteIndex>=x.startIndex&&state.currentRouteIndex<=x.endIndex));
    const improvement=Number(old.duration)-Number(r.duration);
    if(improvement>=120){state.route={...r,_label:'실시간 경로',_character:state.character};state.routeCumulative=buildCumulative(state.route);drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);updateDriving(true);toast('실시간 교통을 반영해 2분 이상 빠른 경로로 변경했습니다.');speak('실시간 교통을 반영해 2분 이상 빠른 경로로 변경했습니다.')}
  }catch(e){console.warn('live route refresh failed',e)}
}
function startLiveRouteRefresh(){clearInterval(state.liveRouteTimer);state.liveRouteTimer=setInterval(liveRouteRefresh,120000)}
function stopLiveRouteRefresh(){clearInterval(state.liveRouteTimer);state.liveRouteTimer=0}

function setView(view){
  $('homeView').classList.toggle('hidden',view!=='home');$('routeView').classList.toggle('hidden',view!=='route');$('driveView').classList.toggle('hidden',view!=='drive');
  $('bottomNav').classList.toggle('hidden',view==='drive'||state.arRunning);
  document.querySelectorAll('[data-bottom-nav]').forEach(b=>b.classList.toggle('active',b.dataset.bottomNav===view||(view==='drive'&&b.dataset.bottomNav==='realtime')));
  if(state.map){if(view==='home'){state.map3D=false;enforce2DMap();state.map.easeTo({pitch:0,bearing:0})}else if(view==='drive')applyDriveMapMode()}
  applyNightMode();if(view==='drive')setTimeout(tryLandscapeFullscreen,80)
  refreshMapLayout({fitRoute:view==='route'&&Boolean(state.route)});
}
function startNavigation(){if(!state.route||!state.destination)return;cancelAutoStart();state.tripStartedAt=Date.now();startDestinationCycle();logTrip('start');setView('drive');startWatch();ensureUserMarker();updateCarMarkerImage();state.routeCumulative=buildCumulative(state.route);drawRoute(state.route,{fit:false});updateDriving(true);startLiveRouteRefresh();applyNightMode();setTimeout(tryLandscapeFullscreen,100);speak(`${characterDefs[state.character].name}이 안내를 시작합니다.`)}
function stopNavigation(){if(state.tripStartedAt){logTrip('finish');addTripHistory({destination:state.destination?.name||'목적지',date:new Date().toLocaleString('ko-KR'),distance:state.route?.distance||0,duration:Math.round((Date.now()-state.tripStartedAt)/1000),character:state.character})}state.tripStartedAt=0;stopDestinationCycle();stopLiveRouteRefresh();stopAR();stopWatch();cancelAutoStart();$('driveMenu').classList.add('hidden');clearRouteLayer();clearSafetyMarkers();hideSafetyAlert();state.safetyEvents=[];state.route=null;state.routeOptions=[];if(state.destMarker){state.destMarker.remove();state.destMarker=null}if(state.originMarker){state.originMarker.remove();state.originMarker=null}state.destination=null;state.origin=null;state.originMode='current';updateOverspeed(0,0);setView('home');toast('안내를 종료했습니다.')}
function updateDriving(force=false){
  if(!state.user||!state.route?.geometry?.length)return;const g=state.route.geometry,idx=nearestIndex(state.user.lng,state.user.lat,g);state.currentRouteIndex=idx;ensureUserMarker();
  const nextPoint=g[Math.min(g.length-1,idx+3)],heading=Number.isFinite(state.user.heading)?state.user.heading:(nextPoint?bearing(state.user.lat,state.user.lng,nextPoint[1],nextPoint[0]):0);
  state.map.easeTo({center:[state.user.lng,state.user.lat],zoom:17.2,pitch:state.map3D?55:0,bearing:heading,duration:force?0:650,padding:{top:120,bottom:170,left:0,right:0}});
  updateProgressUI(idx);if(state.arRunning)updateAROverlay();checkOffRoute(idx);
}
function hideDestinationBottom(){clearTimeout(state.destinationHideTimer);$('driveBottomDestination')?.classList.add('hidden');$('driveBottomNormal')?.classList.remove('hidden')}
function showDestinationBottom(duration=10000){if(!state.tripStartedAt||!state.destination)return;clearTimeout(state.destinationHideTimer);$('driveBottomNormal')?.classList.add('hidden');$('driveBottomDestination')?.classList.remove('hidden');state.lastDestinationShownAt=Date.now();state.destinationHideTimer=setTimeout(hideDestinationBottom,duration)}
function startDestinationCycle(){clearInterval(state.destinationCycleTimer);clearTimeout(state.destinationHideTimer);hideDestinationBottom();state.destinationCycleTimer=setInterval(()=>showDestinationBottom(10000),180000)}
function stopDestinationCycle(){clearInterval(state.destinationCycleTimer);clearTimeout(state.destinationHideTimer);state.destinationCycleTimer=0;state.destinationHideTimer=0;hideDestinationBottom()}
function effectiveSpeedLimit(idx,seg){
  const direct=Number(seg?.speedLimit)||0;if(direct>0)return direct;
  const roadLimits=(state.route?.roadSegments||[]).filter(s=>Number(s?.speedLimit)>0);
  let segBest=0,segDist=Infinity;
  for(const s of roadLimits){const start=Number(s.startIndex)||0,end=Number(s.endIndex)||start;if(idx>=start&&idx<=end)return Number(s.speedLimit)||0;const mid=(start+end)/2;const d=Math.abs(mid-idx);if(d<segDist&&d<=70){segBest=Number(s.speedLimit)||0;segDist=d}}
  const events=(state.safetyEvents||[]).filter(e=>Number(e.maxspeed)>0&&['speed_camera','signal_camera','signal_speed_camera','traffic_camera','speed_limit','school_zone'].includes(e.type));
  let best=null,bestScore=Infinity;
  for(const e of events){const ri=Number(e.routeIndex);if(!Number.isFinite(ri))continue;const routeDelta=Math.abs(ri-idx);if(routeDelta>140)continue;const along=e.routeIndex>=idx?distanceAlong(idx,ri):distanceAlong(ri,idx);const score=along+(e.routeIndex<idx?55:0);if(score<bestScore&&along<=1200){best=e;bestScore=score}}
  return Number(best?.maxspeed)||segBest||0;
}
function updateProgressUI(idx){
  const total=state.routeCumulative.at(-1)||state.route.distance||1,done=state.routeCumulative[idx]||0,remain=Math.max(0,total-done),ratio=Math.max(0,Math.min(1,remain/total)),remainSec=(state.route.duration||0)*ratio;
  $('remainingDistance').textContent=km(remain);$('remainingTime').textContent=mins(remainSec);$('arrivalTime').textContent=`도착 ${eta(remainSec)}`;if($('driveDestinationName'))$('driveDestinationName').textContent=state.destination?.name||'목적지';if($('driveDestinationEta'))$('driveDestinationEta').textContent=`예상 도착 ${eta(remainSec)}`;
  const seg=(state.route.roadSegments||[]).find(s=>idx>=s.startIndex&&idx<=s.endIndex);$('currentRoadLabel').textContent=seg?.name||'일반도로';
  const limit=effectiveSpeedLimit(idx,seg),speed=Math.max(0,Math.round((state.user.speed||0)*3.6));$('currentSpeed').textContent=speed;$('speedPanel').classList.remove('hidden');$('speedLimit').textContent=limit||'--';
  updateOverspeed(speed,limit);updateTrafficStatus(seg);renderTrafficRouteRail(idx);
  const guides=(state.route.guides||[]).filter(x=>Number(x.routeIndex)>idx+1);const first=guides[0],second=guides[1];
  if(first){const d=distanceAlong(idx,first.routeIndex);$('maneuverIcon').innerHTML=turnSvg(first.type);$('maneuverDistance').textContent=km(d);$('maneuverRoad').textContent=first.name||first.guidance||'교차로';maybeSpeakGuide(first,d)}else{$('maneuverIcon').innerHTML=turnSvg(0);$('maneuverDistance').textContent=km(remain);$('maneuverRoad').textContent='목적지까지 직진'}
  if(second){$('nextManeuver').classList.remove('hidden');$('nextManeuverIcon').innerHTML=turnSvg(second.type);$('nextManeuverDistance').textContent=km(distanceAlong(idx,second.routeIndex));$('nextManeuverText').textContent=second.guidance||'다음 안내'}else $('nextManeuver').classList.add('hidden');
  updateSafetyUI(idx);updateVms(idx);
  if(remain<28){speak('목적지에 도착했습니다.');setTimeout(stopNavigation,1400)}
}
function distanceAlong(a,b){const ca=state.routeCumulative[Math.max(0,a)]||0,cb=state.routeCumulative[Math.min(state.routeCumulative.length-1,b)]||ca;return Math.max(0,cb-ca)}
function maybeSpeakGuide(g,d){const key=`${g.id||g.routeIndex}:${d<80?'near':'far'}`;if(key===state.lastGuideSpoken)return;if(d<320){state.lastGuideSpoken=key;speak(`${Math.max(30,Math.round(d/10)*10)}미터 앞 ${g.guidance||g.name||'방향 안내'}입니다.`)}}
function updateTrafficStatus(seg){
  const el=$('trafficStatus');if(!el)return;
  const info=trafficClassFromValues(seg?.trafficSpeed,seg?.trafficState),sp=Math.round(Number(seg?.trafficSpeed)||0);
  el.className=`traffic-status traffic-${info.key}`;$('trafficStatusLabel').textContent=info.label;
  const detail=info.key==='smooth'?'차량 흐름이 원활합니다.':info.key==='slow'?'교통량 증가로 평소보다 속도가 낮습니다.':info.key==='delayed'?'가다 서기를 반복할 수 있는 혼잡 구간입니다.':info.key==='severe'?'차량 흐름이 매우 느린 정체 구간입니다.':'현재 도로 소통정보를 불러오고 있습니다.';
  $('trafficStatusDetail').textContent=sp>0?`${detail} · 평균 ${sp}km/h`:detail;
  if(info.key!=='unknown'&&info.key!==state.lastTrafficStatus){
    const now=Date.now();if(now-state.lastTrafficSpokenAt>25000&&['delayed','severe'].includes(info.key)){speak(info.key==='severe'?'전방 교통이 매우 혼잡합니다. 안전거리를 유지하세요.':'전방 교통이 지체되고 있습니다. 여유 있게 운전하세요.');state.lastTrafficSpokenAt=now}
    state.lastTrafficStatus=info.key;
  }
}

async function reroute(){if(!state.user||!state.destination)return;state.lastRerouteAt=Date.now();toast('경로를 다시 탐색합니다.');speak('경로를 다시 탐색합니다.');try{const r=await routeRequest('RECOMMEND');state.route={...r,_label:'재탐색',_character:state.character};state.routeCumulative=buildCumulative(state.route);drawRoute(state.route,{fit:false});loadSafetyEvents(state.route);updateDriving(true)}catch{toast('재탐색에 실패했습니다.') }}
function checkOffRoute(idx){if(Date.now()-state.lastRerouteAt<15000)return;const p=state.route.geometry[idx];if(!p)return;const d=hav(state.user.lat,state.user.lng,p[1],p[0]);if(d>70)reroute()}

/* ---------- SAFETY GUIDANCE ---------- */
function sampleRoutePoints(geometry,max=28){
  const g=geometry||[];if(!g.length)return[];if(g.length<=max)return g.map(p=>({lng:p[0],lat:p[1]}));
  return Array.from({length:max},(_,i)=>{const p=g[Math.round(i*(g.length-1)/(max-1))];return{lng:p[0],lat:p[1]}})
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
async function loadSafetyEvents(route){
  const seq=++state.safetyRequestSeq;state.safetyEvents=[];state.lastSafetySpoken=new Set();hideSafetyAlert();clearSafetyMarkers();if(!route?.geometry?.length)return;
  const primary=normalizeRouteSafety(route);
  const official=await loadStaticCameraEvents(route).catch(e=>{console.warn('static camera merge failed',e);return []});
  let supplemental=[];
  try{
    const r=await fetch('/api/safety',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points:sampleRoutePoints(route.geometry)})});
    const d=await r.json().catch(()=>({events:[]}));if(seq!==state.safetyRequestSeq)return;
    supplemental=Array.isArray(d?.events)?d.events:[];
  }catch(e){if(seq!==state.safetyRequestSeq)return;console.warn('supplemental safety fetch failed',e)}
  const merged=mergeSafetyEvents([...primary,...official,...supplemental],route.geometry);
  state.safetyEvents=merged;
  applyRouteSpeedLimitHints(route,merged);
  renderSafetyMarkers();if(state.currentRouteIndex>=0)updateSafetyUI(state.currentRouteIndex)
}
function mergeSafetyEvents(events,geometry){
  const seen=new Set(),out=[];for(const e of events){let lng=Number(e.lng),lat=Number(e.lat),idx=Number(e.routeIndex);if((!Number.isFinite(lng)||!Number.isFinite(lat))&&Number.isFinite(idx)){const rp=geometry[Math.max(0,Math.min(geometry.length-1,idx))];if(rp){lng=rp[0];lat=rp[1]}}if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;if(!Number.isFinite(idx))idx=nearestIndex(lng,lat,geometry);const p=geometry[idx];if(!p||hav(lat,lng,p[1],p[0])>320)continue;const k=`${e.type}:${Math.round(lat*10000)}:${Math.round(lng*10000)}`;if(seen.has(k))continue;seen.add(k);out.push({...e,lng,lat,routeIndex:idx})}return out.sort((a,b)=>a.routeIndex-b.routeIndex)
}
function clearSafetyMarkers(){for(const m of state.safetyMarkers||[])try{m.remove()}catch{}state.safetyMarkers=[]}
function renderSafetyMarkers(){
  if(!state.map||!maplibregl?.Marker)return;clearSafetyMarkers();for(const e of state.safetyEvents){if(['speed_limit','tunnel'].includes(e.type))continue;const meta=e.type.startsWith('school')?['school','S','스쿨존/학교 주변']:e.type==='accident'?['incident','!','교통사고']:e.type==='construction'?['construction','공','도로 공사']:e.type==='mobile_camera'?['mobile','M','이동식 단속카메라']:['camera','C','단속 카메라'];const el=document.createElement('div');el.className=`safety-map-marker ${meta[0]}`;el.textContent=meta[1];el.title=meta[2];try{state.safetyMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([e.lng,e.lat]).addTo(state.map))}catch{}}
}
function safetyLabel(e){
  if(e.type==='accident')return{kind:'incident',icon:'사고',title:'전방 사고 정보',text:e.name||'사고 구간입니다. 차간거리를 확보하고 주의하세요'};
  if(e.type==='construction')return{kind:'construction',icon:'공사',title:'전방 공사 구간',text:e.name||'차로 변경 및 작업 차량에 주의하세요'};
  if(e.type==='mobile_camera')return{kind:'mobile',icon:'이동',title:'이동식 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 속도를 확인하세요`:'제한속도를 확인하세요'};
  if(e.type==='signal_speed_camera')return{kind:'camera',icon:'신호',title:'신호·과속 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 신호와 속도를 확인하세요`:'신호와 속도를 확인하세요'};
  if(e.type==='signal_camera')return{kind:'camera',icon:'신호',title:'신호위반 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h · 신호를 준수하세요`:'신호를 준수하세요'};
  if(e.type==='traffic_camera')return{kind:'camera',icon:'단속',title:'무인교통단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h`:'교통법규를 준수하세요'};
  if(e.type==='speed_limit')return{kind:'camera',icon:'속도',title:'제한속도 안내',text:e.maxspeed?`현재 구간 제한속도 ${e.maxspeed}km/h`:'제한속도를 확인하세요'};
  if(e.type==='speed_camera')return{kind:'camera',icon:'단속',title:'속도위반 단속 카메라',text:e.maxspeed?`제한속도 ${e.maxspeed}km/h`:'제한속도를 확인하세요'};
  return{kind:'school',icon:'30',title:'스쿨존 주의',text:'어린이 보호구역 주변입니다. 서행하세요'}
}
function hideSafetyAlert(){const el=$('safetyAlert');if(el)el.classList.add('hidden');state.activeSafetyId=null}
function updateSafetyUI(idx){
  if(!state.routeCumulative.length||!state.safetyEvents.length){hideSafetyAlert();return}
  const priority={accident:0,school_zone:1,school_nearby:1,construction:2,mobile_camera:3,signal_speed_camera:4,signal_camera:4,speed_camera:5,traffic_camera:5,speed_limit:9,tunnel:9};
  const candidates=state.safetyEvents.filter(e=>!['speed_limit','tunnel'].includes(e.type)).map(e=>({...e,d:distanceAlong(idx,e.routeIndex)})).filter(e=>e.routeIndex>=idx-2&&e.d>=0&&e.d<=800).sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9)||a.d-b.d);
  const e=candidates[0];if(!e){hideSafetyAlert();return}const info=safetyLabel(e),el=$('safetyAlert');el.className=`safety-alert ${info.kind}`;$('safetyAlertIcon').textContent=info.icon;$('safetyAlertTitle').textContent=info.title;$('safetyAlertText').textContent=info.text;$('safetyAlertDistance').textContent=km(e.d);state.activeSafetyId=e.id;
  const stage=e.d<=180?'near':e.d<=600?'far':'';if(stage){const key=`${e.id}:${stage}`;if(!state.lastSafetySpoken.has(key)){state.lastSafetySpoken.add(key);const meters=Math.max(100,Math.round(e.d/100)*100);if(e.type.startsWith('school'))speak(stage==='near'?'전방 어린이 보호구역입니다. 속도를 줄이고 주변을 확인하세요.':'전방에 스쿨존이 있습니다. 안전 운전하세요.');else if(e.type==='accident')speak(`${meters}미터 앞 사고 구간이 있습니다. 속도를 줄이고 안전거리를 확보하세요.`);else if(e.type==='construction')speak(`${meters}미터 앞 도로 공사 구간이 있습니다. 차로와 작업 차량에 주의하세요.`);else if(e.type==='mobile_camera')speak(`${meters}미터 앞 이동식 단속 카메라가 있습니다.`);else if(e.type==='signal_speed_camera')speak(`${meters}미터 앞 신호와 과속 단속 카메라가 있습니다.`);else if(e.type==='signal_camera')speak(`${meters}미터 앞 신호위반 단속 카메라가 있습니다.`);else if(e.type==='traffic_camera')speak(`${meters}미터 앞 무인교통단속 카메라가 있습니다.`);else if(e.type==='speed_limit'){}else speak(`${meters}미터 앞 속도위반 단속 카메라가 있습니다.`)}}
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
function updateOverspeed(speed,limit){
  const el=$('overspeedFlash');if(!el)return;
  const active=Number(limit)>0&&Number(speed)>=Number(limit)+3;
  state.overspeedActive=active;el.classList.toggle('active',active);el.setAttribute('aria-hidden',String(!active));
  if(active){$('overspeedMessage').textContent=`현재 ${speed}km/h · 제한 ${limit}km/h`;const now=Date.now();if(now-state.lastOverspeedSpokenAt>9000){state.lastOverspeedSpokenAt=now;speak(`과속 주의. 현재 속도 ${speed}킬로미터. 제한속도 ${limit}킬로미터입니다.`)}}
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
  $('routeInfoModal').classList.remove('hidden');
}
function openDriveSearch(){
  if(!state.tripStartedAt)return toast('주행 안내 중에 사용할 수 있습니다.');
  $('driveSearchInput').value='';$('driveSearchResults').innerHTML='';$('driveSearchModal').classList.remove('hidden');setTimeout(()=>$('driveSearchInput').focus(),80)
}
function closeDriveSearch(){ $('driveSearchModal').classList.add('hidden') }
async function searchDriveDestinations(q){
  const box=$('driveSearchResults');if(!q?.trim())return;box.innerHTML='<button class="search-result"><b>검색 중...</b></button>';
  try{
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',q.trim());if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const r=await fetch(u);if(!r.ok)throw new Error('검색 오류');const d=await r.json(),items=d.items||[];box.innerHTML='';
    if(!items.length){box.innerHTML='<button class="search-result"><b>검색 결과가 없습니다.</b></button>';return}
    items.slice(0,8).forEach(x=>{const b=document.createElement('button');b.className='search-result';b.innerHTML=`<b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.address||x.category||'')}${Number.isFinite(Number(x.distance))?` · ${km(Number(x.distance))}`:''}</small>`;b.onclick=()=>changeDestinationWhileDriving(x);box.appendChild(b)})
  }catch(e){box.innerHTML='<button class="search-result"><b>검색 서버 연결을 확인해 주세요.</b></button>'}
}
async function changeDestinationWhileDriving(item){
  if(!state.user)return toast('현재 위치를 확인할 수 없습니다.');
  closeDriveSearch();state.destination=normalizedPlace(item);setDestinationMarker();toast(`${state.destination.name}(으)로 목적지를 변경합니다.`);speak('목적지를 변경했습니다. 새로운 경로를 탐색합니다.');
  state.origin={...state.user,name:'내 위치',address:'현재 GPS 위치'};state.originMode='current';state.lastRerouteAt=Date.now();
  try{const r=await routeRequest('RECOMMEND');state.route={...r,_label:'재탐색',_character:state.character};state.routeOptions=[state.route];state.routeCumulative=buildCumulative(state.route);state.currentRouteIndex=0;drawRoute(state.route,{fit:false});await loadSafetyEvents(state.route);renderTrafficRouteRail(0);updateDriving(true)}catch(e){toast('새 목적지 경로를 가져오지 못했습니다.',3000)}
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

function speak(text){
  if(!state.sound||!text||!('speechSynthesis' in window)) return;
  const c=characterDefs[state.character];
  const u=new SpeechSynthesisUtterance(text);
  u.lang='ko-KR';
  u.volume=state.voiceVolume;

  if(state.character==='sunsik'){
    u.voice=pickMaleKoreanVoice('sunsik');
    u.rate=.82;
    u.pitch=.58;
  }else if(state.character==='hunmin'){
    u.voice=pickMaleKoreanVoice('hunmin');
    u.rate=1.08;
    u.pitch=.92;
  }else{
    u.voice=pickDaimVoice();
    u.rate=c.rate;
    u.pitch=c.pitch;
  }

  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function loadLocal(){try{const p=JSON.parse(localStorage.getItem(SETTINGS)||'{}');if(p.character&&characterDefs[p.character])state.character=p.character;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Number(p.voiceVolume);state.savedPlaces.home=p.home||null;state.savedPlaces.work=p.work||null;state.favorites=JSON.parse(localStorage.getItem(FAVS)||'[]');state.tripHistory=JSON.parse(localStorage.getItem(TRIP_HISTORY)||'[]')}catch{}syncCharacterUI();updateSavedLabels();updateVolumeUI()}
function saveLocalSettings(){localStorage.setItem(SETTINGS,JSON.stringify({character:state.character,voiceVolume:state.voiceVolume,home:state.savedPlaces.home,work:state.savedPlaces.work}))}
function favoriteId(p){return `${Number(p.lat).toFixed(5)}_${Number(p.lng).toFixed(5)}`}
async function toggleFavorite(){if(!state.destination)return;const id=favoriteId(state.destination),i=state.favorites.findIndex(x=>x.id===id);if(i>=0)state.favorites.splice(i,1);else state.favorites.unshift({...state.destination,id});localStorage.setItem(FAVS,JSON.stringify(state.favorites));updateSavedLabels();await saveCloudFavorites();toast(i>=0?'즐겨찾기에서 삭제했습니다.':'즐겨찾기에 저장했습니다.')}
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
  const gate=$('permissionGate');if(!gate)return;
  const loc=await permissionStatus('geolocation'),cam=await permissionStatus('camera');
  state.permissionLocationGranted=loc==='granted';state.permissionCameraGranted=cam==='granted';permissionButtonState('location',state.permissionLocationGranted);permissionButtonState('camera',state.permissionCameraGranted);
  if(state.permissionLocationGranted&&state.permissionCameraGranted){gate.classList.add('hidden');return}
  gate.classList.remove('hidden');
}
function closePermissionGate(){$('permissionGate')?.classList.add('hidden')}

/* ---------- FIREBASE ---------- */
function firebaseConfig(){return CONFIG.firebase||{}}
function firebaseConfigured(){const c=firebaseConfig();return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId)}
async function initFirebase(){
  state.firebase.configured=firebaseConfigured();if(!state.firebase.configured)return;
  try{const [appMod,authMod,fsMod]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')]);const app=appMod.initializeApp(firebaseConfig()),auth=authMod.getAuth(app),db=fsMod.getFirestore(app);await authMod.setPersistence(auth,authMod.browserLocalPersistence);state.firebase={...state.firebase,ready:true,auth,db,mods:{authMod,fsMod}};authMod.onAuthStateChanged(auth,user=>{state.firebase.user=user||null;renderProfile();if(user){loadCloudPrefs();loadCloudFavorites()}})}catch(e){console.warn('Firebase init failed',e)}
}
async function loginGoogle(){if(!state.firebase.ready){toast('Firebase 설정을 확인해 주세요.');return}const {authMod}=state.firebase.mods,provider=new authMod.GoogleAuthProvider(),btn=$('googleLoginBtn');btn.disabled=true;btn.textContent='로그인 중';try{const isWebView=/JofamsSmartDrive\/6|; wv\)/i.test(navigator.userAgent);if(isWebView){await authMod.signInWithRedirect(state.firebase.auth,provider);return}const result=await Promise.race([authMod.signInWithPopup(state.firebase.auth,provider),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),10000))]);state.firebase.user=result.user;renderProfile();toast('로그인되었습니다.')}catch(e){if(e.code==='auth/popup-blocked'||e.message==='timeout'){toast('로그인 창을 다시 열어 주세요.');}else toast('Google 로그인에 실패했습니다.')}finally{btn.disabled=false;btn.textContent='Google 로그인'}}
async function logout(){if(!state.firebase.ready)return;await state.firebase.mods.authMod.signOut(state.firebase.auth);state.firebase.user=null;renderProfile()}
function renderProfile(){
  const u=state.firebase.user,wrap=$('profilePhoto')?.closest('.profile-photo');
  $('googleLoginBtn').classList.toggle('hidden',!!u);$('logoutBtn').classList.toggle('hidden',!u);
  if(u){$('profileName').textContent=u.displayName||'사용자';$('profileEmail').textContent=u.email||'';$('profilePhoto').src=u.photoURL||characterDefs[state.character].avatar;wrap?.classList.toggle('google-photo',Boolean(u.photoURL))}
  else{$('profileName').textContent='조팸스 드라이버';$('profileEmail').textContent='Google 로그인으로 동기화할 수 있어요.';$('profilePhoto').src=characterDefs[state.character].avatar;wrap?.classList.remove('google-photo')}
}
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
function openMy(){$('myModal').classList.remove('hidden');renderProfile();syncCharacterUI();updateVolumeUI();updateTripHistorySummary()}
function closeMy(){$('myModal').classList.add('hidden')}
function toggleSettingPanel(buttonId,panelId){const btn=$(buttonId),panel=$(panelId),open=panel.classList.contains('hidden');panel.classList.toggle('hidden',!open);btn.setAttribute('aria-expanded',String(open));if(open)setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50)}
async function shareArrival(){if(!state.destination)return;const text=`${state.destination.name}으로 이동 중입니다. 예상 도착 ${$('arrivalTime').textContent.replace('도착 ','')}`;try{if(navigator.share)await navigator.share({title:'조팸스 내비',text});else await navigator.clipboard.writeText(text),toast('도착 정보를 복사했습니다.')}catch{}}
function bindUI(){
  $('allowLocationBtn').onclick=requestLocationPermission;$('allowCameraBtn').onclick=requestCameraPermission;$('permissionContinueBtn').onclick=closePermissionGate;
  applyIcons();$('searchBtn').onclick=()=>searchPlaces($('destinationInput').value);$('destinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value)});document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>searchPlaces(b.dataset.query));
  document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>setCharacter(b.dataset.character));$('homeShortcut').onclick=()=>state.savedPlaces.home?chooseDestination(state.savedPlaces.home):openPlaceModal('home');$('workShortcut').onclick=()=>state.savedPlaces.work?chooseDestination(state.savedPlaces.work):openPlaceModal('work');$('favoriteShortcut').onclick=openMy;
  document.querySelectorAll('[data-my-character]').forEach(b=>b.onclick=()=>{setCharacter(b.dataset.myCharacter);syncCharacterUI();toast(`${characterDefs[state.character].name} 가이드로 변경했습니다.`)});
  document.querySelectorAll('[data-voice-character]').forEach(b=>b.onclick=()=>{setCharacter(b.dataset.voiceCharacter);syncCharacterUI();speak(`${characterDefs[state.character].name} 음성 안내입니다.`)});
  $('voiceGuideSettingBtn').onclick=()=>toggleSettingPanel('voiceGuideSettingBtn','voiceGuidePanel');$('characterSettingBtn').onclick=()=>toggleSettingPanel('characterSettingBtn','characterSettingPanel');$('voicePreviewBtn').onclick=()=>speak(`${characterDefs[state.character].name}이 길안내를 시작합니다. 안전운전하세요.`);
  $('menuBtn').onclick=openMy;$('myBtn').onclick=openMy;$('routeBackBtn').onclick=()=>{cancelAutoStart();setView('home')};$('routeFavoriteBtn').onclick=toggleFavorite;$('startBtn').onclick=startNavigation;$('routeOriginBtn').onclick=openOriginModal;
  $('driveMenuBtn').onclick=openDriveMenu;$('driveRefreshBtn').onclick=reroute;$('map3dBtn').onclick=e=>{e.stopPropagation();state.map3D=!state.map3D;applyDriveMapMode();toggleMapControls(true)};$('mapZoomInBtn').onclick=e=>{e.stopPropagation();state.map?.zoomIn({duration:180});toggleMapControls(true)};$('mapZoomOutBtn').onclick=e=>{e.stopPropagation();state.map?.zoomOut({duration:180});toggleMapControls(true)};$('driveView').addEventListener('click',e=>{if(e.target.closest('button,input,.maneuver-stack,.drive-bottom-card,.safety-alert,.traffic-status,.vms-banner'))return;toggleMapControls()});$('driveVoiceBtn').onclick=startVoiceCommand;$('arOpenBtn').onclick=startAR;$('driveArBtn').onclick=startAR;$('routeInfoBtn').onclick=openRouteInfo;$('driveSearchBtn').onclick=openDriveSearch;$('routeInfoClose').onclick=closeRouteInfo;$('routeInfoModal').addEventListener('click',e=>{if(e.target===$('routeInfoModal'))closeRouteInfo()});$('driveSearchClose').onclick=closeDriveSearch;$('driveSearchSubmit').onclick=()=>searchDriveDestinations($('driveSearchInput').value);$('driveSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchDriveDestinations(e.target.value)});$('driveSearchModal').addEventListener('click',e=>{if(e.target===$('driveSearchModal'))closeDriveSearch()});document.querySelector('.bottom-modal-backdrop').onclick=closeDriveMenu;$('otherRouteBtn').onclick=()=>{closeDriveMenu();stopWatch();setView('route');loadRouteOptions()};$('driveSettingBtn').onclick=()=>{closeDriveMenu();openMy()};$('shareBtn').onclick=shareArrival;$('endNavBtn').onclick=stopNavigation;
  $('guideVolume').oninput=e=>changeVolume(e.target.value);$('myGuideVolume').oninput=e=>changeVolume(e.target.value);$('myCloseBtn').onclick=closeMy;$('myModal').addEventListener('click',e=>{if(e.target===$('myModal'))closeMy()});$('googleLoginBtn').onclick=loginGoogle;$('logoutBtn').onclick=logout;$('myFavoritesBtn').onclick=()=>toast(state.favorites.length?`즐겨찾기 ${state.favorites.length}곳이 저장되어 있습니다.`:'저장된 즐겨찾기가 없습니다.');$('tripHistoryBtn').onclick=openTripHistory;$('noticeBtn').onclick=openNotices;$('appInfoBtn').onclick=openAppInfo;$('privacyBtn').onclick=openPrivacy;$('infoModalClose').onclick=closeInfoModal;$('infoModal').addEventListener('click',e=>{if(e.target===$('infoModal'))closeInfoModal()});
  $('originModalClose').onclick=closeOriginModal;$('useCurrentOriginBtn').onclick=useCurrentOrigin;$('originSearchBtn').onclick=()=>searchOrigins($('originSearchInput').value);$('originSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchOrigins(e.target.value)});$('originModal').addEventListener('click',e=>{if(e.target===$('originModal'))closeOriginModal()});$('arCloseBtn').onclick=stopAR;document.querySelectorAll('[data-bottom-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.bottomNav;if(nav==='home'){cancelAutoStart();setView('home')}else if(nav==='route'){if(state.destination){setView('route');refreshMapLayout({fitRoute:true})}else{setView('home');$('destinationInput').focus();toast('목적지를 검색해 주세요.')}}else if(nav==='realtime'){if(state.route&&state.destination){if(state.tripStartedAt)setView('drive');else startNavigation()}else toast('먼저 길찾기를 완료해 주세요.')}else if(nav==='my')openMy()});$('placeModalClose').onclick=()=>$('placeModal').classList.add('hidden');$('placeSearchBtn').onclick=()=>searchPlaces($('placeSearchInput').value,'placeSearchResults');$('placeSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value,'placeSearchResults')});$('placeModal').addEventListener('click',e=>{if(e.target===$('placeModal'))$('placeModal').classList.add('hidden')});
}

window.addEventListener('orientationchange',()=>setTimeout(tryLandscapeFullscreen,180));window.addEventListener('resize',()=>{applyNightMode();if(state.map)setTimeout(()=>state.map.resize(),80)});document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyNightMode();if(state.tripStartedAt)liveRouteRefresh()}});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
applyIcons();loadLocal();bindUI();applyNightMode();initMap();initFirebase();renderProfile();updateOriginUI();updateTripHistorySummary();setView('home');if('speechSynthesis'in window){speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices()}setTimeout(showPermissionGate,180);
