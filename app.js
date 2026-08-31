import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs';
import {NativeBridge} from '/native-bridge.js';

const $ = id => document.getElementById(id);
const FIREBASE_VERSION = '12.18.0';
const GUEST_FAVORITES_KEY = 'jofams.v2.favorites';
const GUEST_HISTORY_KEY = 'jofams.v2.history';
const GUEST_SETTINGS_KEY = 'jofams.v4.settings';

const state = {
  map:null,user:null,destination:null,route:null,userMarker:null,destMarker:null,watchId:null,
  navigating:false,sound:true,autoCharacter:true,priority:'RECOMMEND',avoid:null,currentCharacter:'daim',
  lastSpeech:'',lastRerouteAt:0,offRouteCount:0,currentRouteIndex:0,nextGuide:null,nextGuideDistance:0,
  lastGuideSpeechKey:'',deviceHeading:null,smoothedHeading:null,devicePitch:null,arStream:null,arMode:'off',xrSession:null,xrGl:null,
  arHeadingOffset:0,arFrame:0,tripStartedAt:null,tripStartPosition:null,nativeLane:null,safety:null,imageDirection:null,roadEvents:[],nativeMultiRoute:null,
  routeOptions:[],selectedRouteIndex:0,pendingAlternative:null,alternativeTimer:null,lastAlternativeCheck:0,
  lastGpsAt:0,lastRealGps:null,positionSource:'gps',nativeTunnel:false,tunnel:{active:false,timer:null,distanceOnRoute:0,lastTick:0,lastSpeed:0},
  parking:[],parkingProvider:'',parkingLoadedFor:'',destinationCorrection:null,lastSafetySpeechKey:'',sim:{active:false,timer:null,index:0,speedKmh:45},haptic:true,
  firebase:{configured:false,ready:false,auth:null,db:null,user:null,mods:null},
  favorites:[],history:[],activeAccountTab:'favorites',demoMode:null
};

const characters = {
  daim:{name:'다임',role:'정확한 안내',img:'/assets/daim.png',msg:'복잡한 구간도 차근차근 정확하게 안내할게요.'},
  sunsik:{name:'순식',role:'즐거운 동행',img:'/assets/sunsik.png',msg:'막히는 길도 너무 답답해하지 마세요. 제가 같이 갈게요!'},
  hunmin:{name:'훈민',role:'신속한 판단',img:'/assets/hunmin.png',msg:'상황 변화 감지. 가장 빠르게 다음 경로를 정리합니다.'}
};

function setUiStage(stage){
  document.body.classList.remove('ui-home','ui-route','ui-account');
  if(stage==='home')document.body.classList.add('ui-home');
  else if(stage==='route')document.body.classList.add('ui-route');
  else if(stage==='account')document.body.classList.add('ui-account');
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===(stage==='account'?'my':stage==='route'?'route':stage==='drive'?'drive':'home')));
}
function syncCharacterButtons(){
  document.querySelectorAll('[data-character]').forEach(b=>b.classList.toggle('active',b.dataset.character===state.currentCharacter));
  document.querySelectorAll('[data-character-mode]').forEach(b=>b.classList.toggle('active',state.autoCharacter?b.dataset.characterMode==='auto':b.dataset.characterMode===state.currentCharacter));
}

const LEFT_TYPES = new Set([1,5,8,11,24,25,26,27,28,36,37,38,39,40,43,46,48,76,77,78,79,80,82]);
const RIGHT_TYPES = new Set([2,6,9,12,18,19,20,21,22,30,31,32,33,34,42,44,47,49,70,71,72,73,74,83]);
const STRAIGHT_TYPES = new Set([0,10,14,15,29,41,45,81]);
const ROUNDABOUT_TYPES = new Set([...Array.from({length:12},(_,i)=>30+i),...Array.from({length:12},(_,i)=>70+i)]);

function rasterStyle(){
  return {version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]};
}

function initMap(){
  state.map = new maplibregl.Map({container:'map',style:rasterStyle(),center:[127.0587,37.5094],zoom:14.2,attributionControl:true});
  state.map.dragRotate.disable();
  state.map.touchZoomRotate.disableRotation();
  state.map.on('load',()=>{if(!initDemoMode())locate(false)});
}

function demoRoute(offset=0,duration=1860,distance=18600,label='추천'){
  const base=[[127.0558,37.5057],[127.0568+offset,37.5068],[127.0572+offset,37.5080],[127.0580+offset,37.5092],[127.0588+offset,37.5102],[127.0593+offset,37.5113],[127.0601,37.5122]];
  return prepareRoute({provider:'demo',distance,duration,geometry:base,guides:[
    {type:0,guidance:'봉은사역 방향으로 직진',roadName:'영동대로',routeIndex:1,x:base[1][0],y:base[1][1]},
    {type:1,guidance:'300m 앞 삼성로 사거리에서 좌회전',roadName:'삼성로',routeIndex:3,x:base[3][0],y:base[3][1]},
    {type:2,guidance:'코엑스 방면으로 우회전',roadName:'테헤란로',routeIndex:5,x:base[5][0],y:base[5][1]},
    {type:101,guidance:'목적지에 도착합니다',roadName:'스타필드 코엑스몰',routeIndex:6,x:base[6][0],y:base[6][1]}
  ],roadSegments:[{startIndex:0,endIndex:2,name:'영동대로',trafficState:4},{startIndex:3,endIndex:4,name:'삼성로',trafficState:3},{startIndex:5,endIndex:6,name:'테헤란로',trafficState:2}],demoLabel:label});
}
function initDemoMode(){
  const mode=new URLSearchParams(location.search).get('demo');if(!mode)return false;state.demoMode=mode;
  const start={coords:{longitude:127.0558,latitude:37.5057,accuracy:4,speed:0,heading:15},timestamp:Date.now()};applyPosition(start,false,'sim');
  if(mode==='home'){setUiStage('home');toast('UI 데모 모드 · 목적지 검색 화면');return true}
  state.destination={id:'demo_coex',lng:127.0601,lat:37.5122,name:'스타필드 코엑스몰',address:'서울 강남구 영동대로 513'};$('destinationInput').value=state.destination.name;
  const el=document.createElement('div');el.className='dest-marker';state.destMarker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([state.destination.lng,state.destination.lat]).addTo(state.map);
  state.routeOptions=[demoRoute(0,1920,18600,'추천'),demoRoute(-.0008,1680,16200,'빠른길'),demoRoute(.0010,2460,21400,'무료도로')];state.selectedRouteIndex=0;state.route=state.routeOptions[0];drawRoutes();showRouteSummary(state.route);renderAlternativeRoutes();
  state.parkingProvider='demo';state.parking=[{id:'p1',name:'코엑스 주차장',address:'서울 강남구 영동대로 513',lat:37.5119,lng:127.0598,distance:180},{id:'p2',name:'현대백화점 무역센터점 주차장',address:'서울 강남구 테헤란로 517',lat:37.5087,lng:127.0592,distance:430},{id:'p3',name:'아셈타워 주차장',address:'서울 강남구 영동대로 517',lat:37.5129,lng:127.0584,distance:520}];renderParking();
  if(mode==='drive')setTimeout(()=>{startNavigation();startSimulation()},250);else if(mode==='my')setTimeout(()=>openAccount(),200);else setUiStage('route');
  toast(`UI 데모 모드 · ${mode}`);return true;
}

function toast(msg,duration=2300){const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,duration)}
function km(m){if(!Number.isFinite(m))return '--';return m<1000?`${Math.max(0,Math.round(m))}m`:`${(m/1000).toFixed(m<10000?1:0)}km`}
function durationText(sec){if(!Number.isFinite(sec))return '--';const m=Math.max(1,Math.round(sec/60));return m<60?`${m}분`:`${Math.floor(m/60)}시간 ${m%60}분`}
function eta(sec){if(!Number.isFinite(sec))return '--:--';const d=new Date(Date.now()+sec*1000);return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function normalizeAngle(a){let x=(a+180)%360;if(x<0)x+=360;return x-180}
function haversine(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180;const a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function bearingTo(lat1,lon1,lat2,lon2){const p=Math.PI/180;const y=Math.sin((lon2-lon1)*p)*Math.cos(lat2*p);const x=Math.cos(lat1*p)*Math.sin(lat2*p)-Math.sin(lat1*p)*Math.cos(lat2*p)*Math.cos((lon2-lon1)*p);return (Math.atan2(y,x)/p+360)%360}

function setCharacter(key,message,speakIt=false){
  const c=characters[key]||characters.daim;
  state.currentCharacter=key;
  $('characterAvatar').src=c.img;$('characterAvatar').alt=`${c.name} 캐릭터`;
  $('arCharacter').src=c.img;$('arCharacter').alt=`${c.name} 캐릭터`;
  $('characterName').textContent=c.name;$('characterRole').textContent=c.role;$('characterMessage').textContent=message||c.msg;
  $('arCharacterMsg').textContent=message||c.msg;
  syncCharacterButtons();
  if(speakIt)speak(message||c.msg);
}
function speak(text){
  if(!state.sound||!('speechSynthesis' in window)||!text||text===state.lastSpeech)return;
  state.lastSpeech=text;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=1.02;window.speechSynthesis.speak(u);
}

async function locate(fly=true){
  if(!navigator.geolocation){toast('이 기기는 위치 기능을 지원하지 않습니다.');return}
  navigator.geolocation.getCurrentPosition(p=>applyPosition(p,fly),e=>toast(`위치 권한을 확인해 주세요 (${e.code})`),{enableHighAccuracy:true,timeout:12000,maximumAge:2500});
}
function applyPosition(p,fly=false,source='gps'){
  const pos={lng:Number(p.coords.longitude),lat:Number(p.coords.latitude),accuracy:Number(p.coords.accuracy),speed:p.coords.speed==null?null:Number(p.coords.speed),heading:p.coords.heading==null?null:Number(p.coords.heading),timestamp:p.timestamp||Date.now()};
  if(!Number.isFinite(pos.lng)||!Number.isFinite(pos.lat))return;state.user=pos;state.positionSource=source;
  if(source==='gps'&&!state.sim.active){state.lastGpsAt=Date.now();state.lastRealGps={...pos};if(state.tunnel.active&&(pos.accuracy||999)<45&&!state.nativeTunnel)stopTunnelDR('GPS 복구');}
  if(!state.userMarker){const el=document.createElement('div');el.className='user-marker';state.userMarker=new maplibregl.Marker({element:el}).setLngLat([pos.lng,pos.lat]).addTo(state.map)}else state.userMarker.setLngLat([pos.lng,pos.lat]);
  if(fly)state.map.easeTo({center:[pos.lng,pos.lat],zoom:16,duration:700});
  if(state.navigating)updateNavigation(pos);
}

async function searchPlaces(query){
  if(!query.trim())return;
  const box=$('searchResults');box.hidden=false;box.innerHTML='<button class="result-item">검색 중...</button>';
  try{
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',query.trim());
    if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const r=await fetch(u);if(!r.ok)throw new Error('검색 실패');const data=await r.json();box.innerHTML='';
    if(!data.items?.length){box.innerHTML='<button class="result-item">검색 결과가 없습니다.</button>';return}
    data.items.slice(0,8).forEach(item=>{const b=document.createElement('button');b.className='result-item';b.innerHTML=`<b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.address||item.category||'')}</small>`;b.onclick=()=>selectDestination(item);box.appendChild(b)});
  }catch(e){box.innerHTML='<button class="result-item">검색 서버에 연결하지 못했습니다.</button>';toast(e.message)}
}

async function selectDestination(item){
  state.destinationCorrection=null;state.parkingLoadedFor='';state.parking=[];
  state.destination={id:item.id||null,lng:Number(item.lng),lat:Number(item.lat),name:item.name,address:item.address||''};
  $('destinationInput').value=item.name;$('searchResults').hidden=true;
  if(state.destMarker)state.destMarker.remove();const el=document.createElement('div');el.className='dest-marker';state.destMarker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([state.destination.lng,state.destination.lat]).addTo(state.map);
  if(!state.user){await new Promise(res=>navigator.geolocation.getCurrentPosition(p=>{applyPosition(p,false);res()},()=>res(),{enableHighAccuracy:true,timeout:8000}))}
  if(!state.user){toast('현재 위치를 확인한 뒤 다시 시도해 주세요.');return}
  await requestRoute();
}

async function requestRoute({reroute=false,silent=false}={}){
  if(!state.user||!state.destination)return;
  if(reroute)setCharacter('hunmin','경로 이탈 감지. 새 경로를 계산합니다.',true);
  try{
    const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:state.user,destination:state.destination,priority:state.priority,avoid:state.avoid,alternatives:true,destinationCorrection:state.destinationCorrection})});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`경로 계산 실패 (${r.status})`);
    const rawOptions=[data,...(data.alternatives||[])].map(x=>{const y={...x};delete y.alternatives;return y});
    state.routeOptions=rawOptions.map(prepareRoute);state.selectedRouteIndex=0;state.route=state.routeOptions[0];state.currentRouteIndex=0;state.nextGuide=null;state.nativeLane=null;state.imageDirection=null;state.lastGuideSpeechKey='';
    drawRoutes();showRouteSummary(state.route);renderAlternativeRoutes();if(!reroute)loadParkingNearDestination();
    if(reroute){state.lastRerouteAt=Date.now();setCharacter('hunmin','재탐색 완료. 새 경로로 바로 안내합니다.',true)}
    else if(!silent&&state.routeOptions.length>1)toast(`${state.routeOptions.length}개 경로를 비교했습니다.`);
  }catch(e){if(!silent){toast(e.message,3200);setCharacter('daim','경로를 계산하지 못했어요. 네트워크와 API 설정을 확인해 주세요.')}}
}

function prepareRoute(route){
  const coords=route.geometry||[];const cumulative=new Array(coords.length).fill(0);
  for(let i=1;i<coords.length;i++)cumulative[i]=cumulative[i-1]+haversine(coords[i-1][1],coords[i-1][0],coords[i][1],coords[i][0]);
  route.cumulative=cumulative;route.geometryDistance=cumulative.at(-1)||route.distance||0;
  route.guides=(route.guides||[]).map((g,i)=>({...g,id:g.id??i,routeIndex:clamp(Number(g.routeIndex)||0,0,Math.max(0,coords.length-1))})).sort((a,b)=>a.routeIndex-b.routeIndex);
  return route;
}

function drawRoutes({fit=true}={}){
  const coords=state.route?.geometry||[];if(!coords.length)return;
  const altFeatures=state.routeOptions.filter((_,i)=>i!==state.selectedRouteIndex).map((r,i)=>({type:'Feature',properties:{i},geometry:{type:'LineString',coordinates:r.geometry||[]}}));
  const altGeo={type:'FeatureCollection',features:altFeatures};const geo={type:'Feature',geometry:{type:'LineString',coordinates:coords}};
  if(state.map.getSource('alternatives'))state.map.getSource('alternatives').setData(altGeo);else{state.map.addSource('alternatives',{type:'geojson',data:altGeo});state.map.addLayer({id:'alternatives',type:'line',source:'alternatives',paint:{'line-color':'#8da2bd','line-width':5,'line-opacity':.42}})}
  if(state.map.getSource('route'))state.map.getSource('route').setData(geo);else{state.map.addSource('route',{type:'geojson',data:geo});state.map.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':11,'line-opacity':.9}});state.map.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':'#2468e8','line-width':6}})}
  if(fit){const b=state.routeOptions.flatMap(r=>r.geometry||[]).reduce((x,c)=>x.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));state.map.fitBounds(b,{padding:{top:205,bottom:235,left:45,right:45},duration:900})}
}
function selectRouteOption(index,{fit=true,announce=false}={}){
  const r=state.routeOptions[index];if(!r)return;state.selectedRouteIndex=index;state.route=r;state.currentRouteIndex=state.user?nearestPointInfo(state.user,r.geometry).i:0;state.nextGuide=null;state.lastGuideSpeechKey='';drawRoutes({fit});showRouteSummary(r);renderAlternativeRoutes();if(state.navigating)updateNavigation(state.user);if(announce)setCharacter('hunmin',`${durationText(r.duration)} 예상 경로로 전환했습니다.`,true);
}

function showRouteSummary(data){
  $('summaryEta').textContent=eta(data.duration);$('summaryDuration').textContent=durationText(data.duration);$('summaryDistance').textContent=km(data.distance);
  $('routeProvider').textContent=(data.provider||'route').toUpperCase();$('guideCount').textContent=`안내정보 ${data.guides?.length||0}개`;
  if($('routeDestinationLabel'))$('routeDestinationLabel').textContent=`${state.destination?.name||'목적지'} · 실시간 교통과 비용을 비교했어요.`;
  $('idleActions').classList.add('hidden');$('routeSummary').classList.remove('hidden');
  if(!state.navigating)setUiStage('route');
  setCharacter('daim',`${state.destination.name}까지 ${durationText(data.duration)}, ${km(data.distance)}예요. 경로를 확인해 주세요.`);updateFavoriteButton();
}


function renderAlternativeRoutes(){
  const panel=$('alternativePanel'),list=$('alternativeList');if(!panel||!list)return;list.innerHTML='';
  if(state.routeOptions.length<2){panel.classList.add('hidden');return}panel.classList.remove('hidden');
  const base=state.routeOptions[0]?.duration||0;
  state.routeOptions.forEach((r,i)=>{const b=document.createElement('button');b.className='alternative-card'+(i===state.selectedRouteIndex?' active':'');const diff=Math.round(((r.duration||0)-base)/60);const diffText=i===0?'추천 경로':diff===0?'비슷한 시간':diff>0?`${diff}분 더 소요`:`${Math.abs(diff)}분 단축`;b.innerHTML=`<b>${i===0?'추천':`대안 ${i}`}</b><small>${durationText(r.duration)} · ${km(r.distance)}</small><em>${escapeHtml(diffText)}</em>`;b.onclick=()=>selectRouteOption(i,{fit:true});list.appendChild(b)});
}
function candidateRoutesFromPayload(data){const raw=[data,...(data?.alternatives||[])].filter(Boolean);return raw.map(x=>{const y={...x};delete y.alternatives;return prepareRoute(y)})}
async function fetchAlternativeSnapshot(){
  if(!state.navigating||!state.user||!state.destination||state.sim.active)return null;state.lastAlternativeCheck=Date.now();
  try{const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:state.user,destination:state.destination,priority:state.priority,avoid:state.avoid,alternatives:true,destinationCorrection:state.destinationCorrection})});if(!r.ok)return null;return candidateRoutesFromPayload(await r.json())}catch{return null}
}
async function checkAlternativeRoutes(){
  const candidates=await fetchAlternativeSnapshot();if(!candidates?.length||!state.route)return;
  const current=Math.max(1,state.route.liveRemainDuration||state.route.duration||1);const best=candidates.reduce((a,b)=>(b.duration||Infinity)<(a.duration||Infinity)?b:a,candidates[0]);const saving=current-(best.duration||current);
  if(saving>=90&&saving/current>=.08){state.pendingAlternative=best;$('fasterRouteTitle').textContent=`${Math.max(2,Math.round(saving/60))}분 빠른 경로 발견`;$('fasterRouteDetail').textContent=`${km(best.distance)} · ${durationText(best.duration)} 예상`;$('fasterRouteBanner').classList.remove('hidden');setCharacter('hunmin',`더 빠른 경로를 찾았습니다. 약 ${Math.max(2,Math.round(saving/60))}분 줄일 수 있어요.`,true)}
}
function startAlternativeMonitor(){stopAlternativeMonitor();state.alternativeTimer=setInterval(()=>checkAlternativeRoutes(),120000);setTimeout(()=>{if(state.navigating)checkAlternativeRoutes()},30000)}
function stopAlternativeMonitor(){if(state.alternativeTimer)clearInterval(state.alternativeTimer);state.alternativeTimer=null}
function acceptPendingAlternative(){
  const r=state.pendingAlternative;
  if(r){$('fasterRouteBanner').classList.add('hidden');state.routeOptions=[r];state.selectedRouteIndex=0;state.route=r;state.pendingAlternative=null;state.currentRouteIndex=nearestPointInfo(state.user,r.geometry).i;drawRoutes({fit:false});renderAlternativeRoutes();updateNavigation(state.user);setCharacter('hunmin','더 빠른 경로로 즉시 전환했습니다.',true);logTelemetry('alternative_accept');return}
  if(state.nativeMultiRoute){NativeBridge.acceptAlternative(state.nativeMultiRoute);$('fasterRouteBanner').classList.add('hidden');setCharacter('hunmin','네이티브 내비게이션에 대안 경로 전환을 요청했습니다.',true);logTelemetry('native_alternative_accept')}
}
function renderNativeAlternativeNotice(){const p=state.nativeMultiRoute;if(!p)return;const gap=Number(p.timeGap);if(!Number.isFinite(gap)||gap>=-30)return;$('fasterRouteTitle').textContent=`네이티브 대안 경로 · ${Math.max(1,Math.round(Math.abs(gap)/60))}분 단축`;$('fasterRouteDetail').textContent='Kakao Navi SDK 분기 정보 · 앱 화면에서 전환 가능';$('fasterRouteBanner').classList.remove('hidden')}

async function loadParkingNearDestination(){
  if(!state.destination)return;const key=`${state.destination.lat.toFixed(5)},${state.destination.lng.toFixed(5)}`;if(state.parkingLoadedFor===key&&state.parking.length){renderParking();return}state.parkingLoadedFor=key;
  try{const u=new URL('/api/parking',location.origin);u.searchParams.set('lng',state.destination.lng);u.searchParams.set('lat',state.destination.lat);u.searchParams.set('radius','1800');const r=await fetch(u);if(!r.ok)throw new Error();const d=await r.json();state.parking=(d.items||[]).slice(0,6);state.parkingProvider=d.provider||'';renderParking()}catch{state.parking=[];renderParking()}
}
function renderParking(){const panel=$('parkingPanel'),list=$('parkingList');if(!panel||!list)return;list.innerHTML='';if(!state.parking.length){panel.classList.add('hidden');return}panel.classList.remove('hidden');$('parkingProvider').textContent=state.parkingProvider==='kakao'?'Kakao Local · 거리순':'검색 결과';state.parking.slice(0,4).forEach(p=>{const b=document.createElement('button');b.className='parking-card';b.innerHTML=`<b>${escapeHtml(p.name||'주차장')}</b><small>${escapeHtml(p.address||'')}</small><span>${km(Number(p.distance)||haversine(state.destination.lat,state.destination.lng,p.lat,p.lng))} · <i class="park-go">여기로 안내</i></span>`;b.onclick=()=>selectParkingDestination(p);list.appendChild(b)})}
async function selectParkingDestination(p){const original=state.destination?.name||'목적지';state.destination={id:p.id||null,lng:Number(p.lng),lat:Number(p.lat),name:p.name||`${original} 주차장`,address:p.address||''};state.destinationCorrection='parking';$('destinationInput').value=state.destination.name;if(state.destMarker)state.destMarker.setLngLat([state.destination.lng,state.destination.lat]);toast('주차장 진입점 기준으로 경로를 다시 계산합니다.');await requestRoute()}

function startNavigation(){
  if(!state.route)return;state.navigating=true;state.tripStartedAt=Date.now();state.tripStartPosition=state.user?{...state.user}:null;
  setUiStage('drive');document.body.classList.add('driving');$('searchPanel').classList.add('hidden');$('routeSummary').classList.add('hidden');$('navActions').classList.remove('hidden');$('guidanceCard').classList.remove('hidden');$('lanePanel').classList.remove('hidden');$('driveHud').classList.remove('hidden');
  if(state.watchId!==null)navigator.geolocation.clearWatch(state.watchId);
  if(!state.demoMode)state.watchId=navigator.geolocation.watchPosition(p=>{if(!state.sim.active)applyPosition(p,false)},e=>console.warn('watchPosition',e),{enableHighAccuracy:true,maximumAge:700,timeout:12000});
  setCharacter('daim','안내를 시작합니다. 화면보다 도로를 먼저 확인해 주세요.',true);NativeBridge.requestLane();NativeBridge.requestSafety();NativeBridge.requestImageDirection();NativeBridge.requestRoadEvents();NativeBridge.requestAlternatives();NativeBridge.setNavigationState({active:true,destination:state.destination});startAlternativeMonitor();updateNavigation(state.user);logTelemetry('start');
}

async function stopNavigation({arrived=false}={}){
  if(!state.navigating)return;
  const finishedAt=Date.now();state.navigating=false;document.body.classList.remove('driving');setUiStage('route');stopAR();stopSimulation();stopAlternativeMonitor();stopTunnelDR();NativeBridge.setNavigationState({active:false});
  if(state.watchId!==null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null}
  $('searchPanel').classList.remove('hidden');$('guidanceCard').classList.add('hidden');$('lanePanel').classList.add('hidden');$('intersectionPanel').classList.add('hidden');$('driveHud').classList.add('hidden');$('navActions').classList.add('hidden');$('fasterRouteBanner').classList.add('hidden');$('routeSummary').classList.remove('hidden');
  setCharacter('daim',arrived?'목적지에 도착했어요. 오늘도 좋은 여정이었습니다!':'안내를 종료했어요. 필요하면 다시 시작할 수 있어요.',arrived);
  await saveTripRecord({arrived,finishedAt});logTelemetry(arrived?'arrive':'stop');
}

function clearRoute(){
  if(state.navigating)stopNavigation();state.route=null;state.destination=null;state.currentRouteIndex=0;state.nextGuide=null;
  if(state.destMarker){state.destMarker.remove();state.destMarker=null}
  for(const id of ['route','route-shadow','alternatives'])if(state.map.getLayer(id))state.map.removeLayer(id);for(const id of ['route','alternatives'])if(state.map.getSource(id))state.map.removeSource(id);
  state.routeOptions=[];state.parking=[];state.parkingLoadedFor='';state.destinationCorrection=null;$('destinationInput').value='';$('routeSummary').classList.add('hidden');$('alternativePanel').classList.add('hidden');$('parkingPanel').classList.add('hidden');$('idleActions').classList.remove('hidden');$('navActions').classList.add('hidden');setUiStage('home');
}

function nearestPointInfo(pos,coords){
  if(!pos||!coords?.length)return {i:0,d:Infinity};const stride=Math.max(1,Math.floor(coords.length/1800));let best={i:0,d:Infinity};
  for(let i=0;i<coords.length;i+=stride){const d=haversine(pos.lat,pos.lng,coords[i][1],coords[i][0]);if(d<best.d)best={i,d}}
  const start=Math.max(0,best.i-stride*3),end=Math.min(coords.length-1,best.i+stride*3);for(let i=start;i<=end;i++){const d=haversine(pos.lat,pos.lng,coords[i][1],coords[i][0]);if(d<best.d)best={i,d}}return best;
}

function nextGuideInfo(routeIndex){
  const guides=state.route?.guides||[];
  let g=guides.find(x=>x.type!==100&&x.routeIndex>=routeIndex+1);if(!g)g=guides.at(-1)||null;if(!g)return {guide:null,distance:Infinity};
  const cum=state.route.cumulative||[];const distance=Math.max(0,(cum[g.routeIndex]??0)-(cum[routeIndex]??0));return {guide:g,distance};
}
function currentRoad(routeIndex){return (state.route?.roadSegments||[]).find(s=>routeIndex>=s.startIndex&&routeIndex<=s.endIndex)||null}
function trafficText(code){return ({0:'교통상태 정보 없음',1:'정체 구간',2:'지체 구간',3:'서행 구간',4:'원활',6:'사고·통행불가 정보'})[code]||'교통정보 확인 중'}

function updateNavigation(pos){
  if(!pos||!state.route?.geometry?.length)return;
  const near=nearestPointInfo(pos,state.route.geometry);state.currentRouteIndex=near.i;
  if(near.d>48)state.offRouteCount++;else state.offRouteCount=0;
  if(state.offRouteCount>=3&&Date.now()-state.lastRerouteAt>12000){state.offRouteCount=0;requestRoute({reroute:true});return}
  const totalGeom=Math.max(1,state.route.geometryDistance||state.route.distance);const remainGeom=Math.max(0,totalGeom-(state.route.cumulative[near.i]||0));const scale=(state.route.distance||totalGeom)/totalGeom;const remainDistance=remainGeom*scale;const remainDuration=(state.route.duration||0)*(remainDistance/Math.max(1,state.route.distance||totalGeom));
  state.route.liveRemainDistance=remainDistance;state.route.liveRemainDuration=remainDuration;
  const destDist=haversine(pos.lat,pos.lng,state.destination.lat,state.destination.lng);
  if(destDist<32){$('maneuverDistance').textContent='도착';$('maneuverText').textContent=state.destination.name;$('maneuverIcon').textContent='✓';stopNavigation({arrived:true});return}
  const road=currentRoad(near.i);maybeManageTunnel(pos,road);const ng=nextGuideInfo(near.i);state.nextGuide=ng.guide;state.nextGuideDistance=ng.distance;renderGuidance(pos,ng.guide,ng.distance,remainDistance,remainDuration,road);
  renderIntersectionGuide(ng.guide,ng.distance);renderSafetyState(pos,road);autoCharacter(pos,ng.guide,ng.distance,road);maybeSpeakGuide(ng.guide,ng.distance);
  const heading=Number.isFinite(pos.heading)?pos.heading:(state.deviceHeading??state.map.getBearing());state.map.easeTo({center:[pos.lng,pos.lat],zoom:17.2,bearing:heading||0,pitch:42,duration:550});updateAROverlay();
}

function renderGuidance(pos,guide,distance,remainDistance,remainDuration,road){
  const type=guide?.type??0;const text=guide?.guidance||guide?.name||'경로를 따라 직진';const roadName=guide?.roadName||road?.name||'주행 경로';
  $('maneuverIcon').textContent=maneuverIcon(type);$('maneuverDistance').textContent=distance<60?'곧':`${km(distance)} 후`;$('maneuverText').textContent=text;$('roadCaption').textContent=roadName;
  $('etaText').textContent=eta(remainDuration);$('remainText').textContent=km(remainDistance);$('summaryEta').textContent=eta(remainDuration);$('summaryDuration').textContent=durationText(remainDuration);$('summaryDistance').textContent=km(remainDistance);
  const speedKmh=Number.isFinite(pos.speed)?Math.max(0,Math.round(pos.speed*3.6)):0;$('hudSpeed').textContent=speedKmh;$('hudRoad').textContent=roadName;$('hudTraffic').textContent=trafficText(road?.trafficState);$('hudEta').textContent=eta(remainDuration);$('hudRemain').textContent=`${km(remainDistance)} · ${durationText(remainDuration)}`;
  if($('arSpeedMirror'))$('arSpeedMirror').textContent=speedKmh;if($('arTripMirror'))$('arTripMirror').textContent=`${eta(remainDuration)} · ${km(remainDistance)} · ${durationText(remainDuration)}`;
  renderLaneHint(type);
}

function maneuverIcon(type){
  if(type===101)return '✓';if(type===3)return '⤴';if(ROUNDABOUT_TYPES.has(type))return '⟳';if(LEFT_TYPES.has(type))return '↰';if(RIGHT_TYPES.has(type))return '↱';if([7,42].includes(type))return '⇱';if([10,45].includes(type))return '⇧';return '↑';
}
function laneTurnIcons(turnType){
  const icons=[];if(turnType&1)icons.push('⤴');if(turnType&2)icons.push('↰');if(turnType&4)icons.push('↖');if(turnType&8)icons.push('↑');if(turnType&16)icons.push('↗');if(turnType&32)icons.push('↱');return icons.length?icons.join('·'):'↑';
}
function guideLineColor(code){return ({0:'분홍 유도선',1:'연녹색 유도선',2:'녹색 유도선',3:'하늘색 유도선'})[code]||'유도선 정보 없음'}
function renderLaneHint(type){
  const box=$('lanes');box.innerHTML='';const packet=state.nativeLane;const nativeLanes=packet?.lanes;
  if(Array.isArray(nativeLanes)&&nativeLanes.length){
    nativeLanes.slice(0,10).forEach((lane,i)=>{const el=document.createElement('span');el.className='lane native';el.textContent=laneTurnIcons(Number(lane.turnType)||0);if(Number(lane.suggest)===1||Number(lane.highlightType)>0)el.classList.add('active');if(Number(lane.busType)>0)el.classList.add('bus');if(Number(lane.pocketType)>0)el.classList.add('pocket');el.title=`${i+1}차로`;box.appendChild(el)});
    $('laneHint').textContent=`실제 ${nativeLanes.length}개 차로 · Kakao Navi SDK`;$('laneSourceBadge').textContent='NATIVE';$('laneSourceBadge').classList.add('native');
    const colored=nativeLanes.find(x=>Number(x.colorType)>=0&&Number(x.colorType)<=3);$('laneGuideLine').textContent=colored?guideLineColor(Number(colored.colorType)):'유도선 정보 없음';return;
  }
  const count=4;const active=LEFT_TYPES.has(type)?[0,1]:RIGHT_TYPES.has(type)?[2,3]:type===3?[0]:[1,2];
  for(let i=0;i<count;i++){const el=document.createElement('span');el.className='lane';el.textContent='↑';if(active.includes(i))el.classList.add('active');if(LEFT_TYPES.has(type)&&i===0)el.textContent='↰';if(RIGHT_TYPES.has(type)&&i===3)el.textContent='↱';if(type===3&&i===0)el.textContent='⤴';box.appendChild(el)}
  const label=LEFT_TYPES.has(type)?'좌측 차로를 미리 이용':RIGHT_TYPES.has(type)?'우측 차로를 미리 이용':type===3?'유턴 가능 차로 확인':ROUNDABOUT_TYPES.has(type)?'회전교차로 진출 방향 확인':'직진 차로 유지';
  $('laneHint').textContent=`${label} · 웹 추정`;$('laneSourceBadge').textContent='WEB';$('laneSourceBadge').classList.remove('native');$('laneGuideLine').textContent='네이티브 SDK 연결 시 실제 유도선 표시';
}


function renderIntersectionGuide(guide,distance){
  const panel=$('intersectionPanel');if(!panel)return;const packet=state.imageDirection;const nativeImg=packet?.imageDataUrl||packet?.dataUrl||packet?.image;const complex=guide&&(ROUNDABOUT_TYPES.has(guide.type)||LEFT_TYPES.has(guide.type)||RIGHT_TYPES.has(guide.type)||[7,10,14,15,42,45].includes(guide.type));
  const packetDistance=Number(packet?.distance);const nearNative=packet&&(!Number.isFinite(packetDistance)||packetDistance<900);const showNative=nearNative&&typeof nativeImg==='string'&&nativeImg.startsWith('data:image/');const showFallback=complex&&distance<360;
  if(!showNative&&!showFallback){panel.classList.add('hidden');return}panel.classList.remove('hidden');
  if(showNative){$('intersectionImage').src=nativeImg;$('intersectionImage').classList.remove('hidden');$('intersectionFallback').classList.add('hidden');$('intersectionSource').textContent='KAKAO SDK';$('intersectionSource').classList.add('native')}
  else{$('intersectionImage').classList.add('hidden');$('intersectionFallback').classList.remove('hidden');$('intersectionArrow').textContent=maneuverIcon(guide?.type??0);$('intersectionText').textContent=`${distance<60?'곧':km(distance)+' 후'} ${guide?.guidance||'교차로 방향을 확인하세요.'}`;$('intersectionSource').textContent='WEB';$('intersectionSource').classList.remove('native')}
}
function numericSafetyLimit(x){for(const v of [x?.speedLimit,x?.speed_limit,x?.limitSpeed,x?.limit_speed]){const n=Number(v);if(Number.isFinite(n)&&n>0)return n}return 0}
function eventMessage(e){if(!e)return '';const code=Number(e.code);const type=Number(e.type);const kind=code===0?'사고':code===1?'공사':code===2?'행사':code===3?'통제':'도로 유고';return e.message||e.title||e.desc||`${kind}${type===1?' · 전면 통제':type===2?' · 부분 통제':''}`}
function renderSafetyState(pos,road){
  const native=state.safety||{};const routeSafety=(road?.safeties||[])[0]||{};const speedLimit=numericSafetyLimit(native)||numericSafetyLimit(routeSafety)||Number(road?.speedLimit)||0;const speed=Number.isFinite(pos?.speed)?Math.max(0,pos.speed*3.6):0;
  const lim=$('hudSpeedLimit');lim.textContent=speedLimit?`제한 ${Math.round(speedLimit)}`:'제한 --';lim.classList.toggle('hidden',!speedLimit);const over=speedLimit>0&&speed>speedLimit+4;$('hudSpeed').closest('.hud-speed')?.classList.toggle('overspeed',over);
  const nativeMsg=native.message||native.name||'';const events=(state.roadEvents?.length?state.roadEvents:(road?.roadEvents||state.route?.roadEvents||[]));const event=events.find(x=>!x.passed)||events[0];const msg=nativeMsg||eventMessage(event);const el=$('hudSafety');el.textContent=msg||'안전정보';el.classList.toggle('hidden',!msg);
  if(over){const key=`over:${Math.round(speedLimit)}`;if(state.lastSafetySpeechKey!==key){state.lastSafetySpeechKey=key;speak(`제한속도 ${Math.round(speedLimit)}킬로미터 구간입니다. 속도를 줄여 주세요.`);if(navigator.vibrate)navigator.vibrate([120,60,120])}}
  else if(state.lastSafetySpeechKey?.startsWith('over:'))state.lastSafetySpeechKey='';if(msg&&(native.urgent||Number(event?.type)>0))setCharacter('hunmin',msg,false)
}
function maybeManageTunnel(pos,road){const name=road?.name||'';const routeTunnel=/터널|tunnel/i.test(name);const moving=Number(pos?.speed)>2.5||Number(state.lastRealGps?.speed)>2.5;if((state.nativeTunnel||(routeTunnel&&moving))&&!state.tunnel.active)startTunnelDR(state.nativeTunnel?'native':name||'route');if(state.tunnel.active&&!state.nativeTunnel&&!routeTunnel&&(Date.now()-state.lastGpsAt)<2200)stopTunnelDR('route-exit')}
function startTunnelDR(reason='tunnel'){if(state.tunnel.active||!state.route?.geometry?.length)return;state.tunnel.active=true;state.tunnel.distanceOnRoute=state.route.cumulative?.[state.currentRouteIndex]||0;state.tunnel.lastTick=performance.now();state.tunnel.lastSpeed=Math.max(4,Number(state.lastRealGps?.speed)||Number(state.user?.speed)||8);$('hudTunnel').classList.remove('hidden');$('hudTunnel').textContent='TUNNEL · DR';state.tunnel.timer=setInterval(tunnelDeadReckoningTick,500);console.info('Tunnel DR start',reason)}
function stopTunnelDR(reason=''){if(state.tunnel.timer)clearInterval(state.tunnel.timer);state.tunnel.timer=null;state.tunnel.active=false;$('hudTunnel')?.classList.add('hidden');if(reason)console.info('Tunnel DR stop',reason)}
function indexAtDistance(cum,target,start=0){let lo=Math.max(0,start),hi=Math.max(lo,cum.length-1);while(lo<hi){const mid=Math.floor((lo+hi)/2);if((cum[mid]||0)<target)lo=mid+1;else hi=mid}return lo}
function tunnelDeadReckoningTick(){if(!state.navigating||!state.tunnel.active||state.sim.active)return;if(!state.nativeTunnel&&Date.now()-state.lastGpsAt<1800)return;const now=performance.now(),dt=Math.min(1.5,Math.max(.1,(now-state.tunnel.lastTick)/1000));state.tunnel.lastTick=now;const road=currentRoad(state.currentRouteIndex);const fallback=(Number(road?.trafficSpeed)>0?Number(road.trafficSpeed)/3.6:state.tunnel.lastSpeed);const speed=clamp(Number(state.lastRealGps?.speed)||fallback||8,3,32);state.tunnel.lastSpeed=speed;state.tunnel.distanceOnRoute+=speed*dt;const idx=indexAtDistance(state.route.cumulative,state.tunnel.distanceOnRoute,state.currentRouteIndex),coords=state.route.geometry;if(idx<=state.currentRouteIndex||!coords[idx])return;const prev=coords[Math.max(0,idx-1)],cur=coords[idx],heading=bearingTo(prev[1],prev[0],cur[1],cur[0]);applyPosition({coords:{longitude:cur[0],latitude:cur[1],accuracy:25,speed,heading},timestamp:Date.now()},false,'dr')}
function applyNativeLocation(packet){if(!packet)return;state.nativeTunnel=Boolean(packet.tunnel);const lng=Number(packet.lng??packet.longitude),lat=Number(packet.lat??packet.latitude);if(Number.isFinite(lng)&&Number.isFinite(lat)){applyPosition({coords:{longitude:lng,latitude:lat,accuracy:Number(packet.accuracy)||5,speed:Number(packet.speedMps??packet.speed)||null,heading:Number(packet.heading)||null},timestamp:Date.now()},false,'native')}if(state.nativeTunnel)startTunnelDR('native-location')}

function autoCharacter(pos,guide,distance,road){
  if(!state.autoCharacter)return;
  if(state.offRouteCount>0){setCharacter('hunmin','경로를 벗어났는지 빠르게 확인하고 있어요.');return}
  if(road?.trafficState===1||road?.trafficState===2){setCharacter('sunsik','앞 구간이 조금 막혀요. 급하게 차선을 바꾸기보다 여유 있게 가요.');return}
  if(guide&&distance<550&&(LEFT_TYPES.has(guide.type)||RIGHT_TYPES.has(guide.type)||ROUNDABOUT_TYPES.has(guide.type))){setCharacter('daim',`${km(distance)} 앞 ${guide.guidance||'분기'}예요. 미리 방향을 확인해 주세요.`);return}
  if(Number.isFinite(pos.speed)&&pos.speed<2&&state.route.liveRemainDuration>600){setCharacter('sunsik','잠깐 정체 중이네요. 안전거리를 두고 천천히 가요.');return}
  setCharacter('daim','현재 경로를 그대로 따라가 주세요. 다음 안내를 미리 확인하고 있어요.');
}

function maybeSpeakGuide(guide,distance){
  if(!guide)return;const thresholds=distance<=80?80:distance<=280?280:distance<=700?700:null;if(!thresholds)return;
  const key=`${guide.id}:${thresholds}`;if(key===state.lastGuideSpeechKey)return;state.lastGuideSpeechKey=key;
  const prefix=thresholds===80?'곧':`${Math.round(distance/10)*10}미터 앞`;
  if(state.haptic&&thresholds===80&&navigator.vibrate)navigator.vibrate([80,45,80]);if(guide.type===101)speak('잠시 후 목적지에 도착합니다.');else speak(`${prefix} ${guide.guidance||'안내 지점입니다'}.`);
}

async function quickSearch(q){$('destinationInput').value=q;await searchPlaces(q)}
async function logTelemetry(event){try{await fetch('/api/trip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,destination:state.destination?.name,distance:state.route?.distance,duration:state.route?.duration,character:state.currentCharacter,provider:state.route?.provider,guideType:state.nextGuide?.type})})}catch{}}

/* AR v3: native bridge -> WebXR DOM overlay -> camera/corridor fallback */
async function requestOrientationPermission(){
  try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const r=await DeviceOrientationEvent.requestPermission();return r==='granted'}return true}catch{return false}
}
function circularLerp(a,b,t=.18){if(!Number.isFinite(a))return b;return (a+normalizeAngle(b-a)*t+360)%360}
function onDeviceOrientation(e){
  let h=null;if(Number.isFinite(e.webkitCompassHeading))h=e.webkitCompassHeading;else if(Number.isFinite(e.alpha))h=(360-e.alpha)%360;
  if(Number.isFinite(h)){state.deviceHeading=h;state.smoothedHeading=circularLerp(state.smoothedHeading,h)}
  if(Number.isFinite(e.beta))state.devicePitch=e.beta;updateAROverlay();
}
async function detectWebXR(){try{return Boolean(navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar'))}catch{return false}}
function routePayload(){return {destination:state.destination,guide:state.nextGuide,route:(state.route?.geometry||[]).slice(state.currentRouteIndex,state.currentRouteIndex+160)}}
async function startWebXR(){
  if(!await detectWebXR())return false;
  try{
    const canvas=document.createElement('canvas');canvas.className='xr-canvas';$('arView').prepend(canvas);const gl=canvas.getContext('webgl',{alpha:true,xrCompatible:true});
    const session=await navigator.xr.requestSession('immersive-ar',{optionalFeatures:['local-floor','dom-overlay'],domOverlay:{root:$('arView')}});await gl.makeXRCompatible();session.updateRenderState({baseLayer:new XRWebGLLayer(session,gl, {alpha:true})});
    state.xrSession=session;state.xrGl=gl;state.arMode='webxr';$('arVideo').classList.add('hidden');$('arModeBadge').textContent='WEBXR · ARCORE';
    const loop=(t,frame)=>{if(!state.xrSession)return;const layer=session.renderState.baseLayer;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);state.arFrame=session.requestAnimationFrame(loop)};state.arFrame=session.requestAnimationFrame(loop);
    session.addEventListener('end',()=>{state.xrSession=null;state.xrGl=null;canvas.remove();});return true;
  }catch(e){console.warn('WebXR fallback',e);return false}
}
async function startCameraAR(){
  state.arStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});$('arVideo').srcObject=state.arStream;$('arVideo').classList.remove('hidden');state.arMode='camera';$('arModeBadge').textContent='AR CORRIDOR';
}
async function startAR(){
  if(!state.navigating){toast('주행 안내를 시작한 뒤 AR 모드를 사용할 수 있습니다.');return}
  const orientationOk=await requestOrientationPermission();if(orientationOk)window.addEventListener('deviceorientation',onDeviceOrientation,true);$('arView').classList.remove('hidden');resizeARCanvas();
  if(NativeBridge.hasNativeAR()){state.arMode='native';$('arView').classList.add('native-host');$('arModeBadge').textContent='NATIVE AR';NativeBridge.startAR(routePayload());updateAROverlay();return}
  if(await startWebXR()){updateAROverlay();return}
  try{await startCameraAR();updateAROverlay()}catch(e){$('arView').classList.add('hidden');toast('카메라 권한을 허용해야 AR 안내를 사용할 수 있습니다.',3200);window.removeEventListener('deviceorientation',onDeviceOrientation,true)}
}
async function stopAR(){
  $('arView').classList.add('hidden');$('arView').classList.remove('native-host');NativeBridge.stopAR();if(state.xrSession){try{await state.xrSession.end()}catch{}state.xrSession=null}if(state.arStream){state.arStream.getTracks().forEach(t=>t.stop());state.arStream=null}$('arVideo').srcObject=null;window.removeEventListener('deviceorientation',onDeviceOrientation,true);state.arMode='off';clearARCanvas();
}
function resizeARCanvas(){const c=$('arCanvas');if(!c)return;const dpr=Math.min(2,devicePixelRatio||1);c.width=Math.round(innerWidth*dpr);c.height=Math.round(innerHeight*dpr);c.style.width=`${innerWidth}px`;c.style.height=`${innerHeight}px`;c.getContext('2d').setTransform(dpr,0,0,dpr,0,0)}
function clearARCanvas(){const c=$('arCanvas');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height)}
function arHeading(){const raw=Number.isFinite(state.smoothedHeading)?state.smoothedHeading:(Number.isFinite(state.user?.heading)?state.user.heading:0);return (raw+state.arHeadingOffset+360)%360}
function arConfidence(){let v=25;if(state.arMode==='native')v=95;else if(state.arMode==='webxr')v=86;else{if(Number.isFinite(state.smoothedHeading))v+=25;if((state.user?.accuracy||999)<20)v+=25;if((state.user?.accuracy||999)<8)v+=15}return clamp(Math.round(v),0,99)}
function drawRouteCorridor(){
  const c=$('arCanvas');if(!c||!state.user||!state.route?.geometry?.length||state.arMode==='native')return;const ctx=c.getContext('2d'),w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);const heading=arHeading();const pts=[];let lastDist=0;
  for(let i=state.currentRouteIndex+1;i<Math.min(state.route.geometry.length,state.currentRouteIndex+220);i+=3){const p=state.route.geometry[i],d=haversine(state.user.lat,state.user.lng,p[1],p[0]);if(d<5||d>320||d<lastDist-12)continue;lastDist=d;const diff=normalizeAngle(bearingTo(state.user.lat,state.user.lng,p[1],p[0])-heading);if(Math.abs(diff)>75)continue;const x=w/2+(diff/75)*(w*.48);const depth=clamp(d/320,0,1);const horizon=h*(.48+clamp(((state.devicePitch??75)-75)/120,-.08,.08));const y=horizon+(1-depth)*h*.39;pts.push([x,y,d]);if(pts.length>18)break}
  if(pts.length<2)return;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=34;ctx.stroke();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle='rgba(105,240,197,.88)';ctx.lineWidth=16;ctx.stroke();
  for(let i=2;i<pts.length;i+=4){const [x,y]=pts[i];ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='white';ctx.fill()}
}
function calibrateAR(){const gps=state.user?.heading;if(Number.isFinite(gps)&&Number.isFinite(state.smoothedHeading)){state.arHeadingOffset=normalizeAngle(gps-state.smoothedHeading);savePreferences();toast('현재 주행 방향을 기준으로 AR을 보정했습니다.')}else{state.arHeadingOffset=0;toast('GPS 진행방향이 확보되면 더 정확하게 보정할 수 있습니다.')}}
function updateAROverlay(){
  if(!$('arView')||$('arView').classList.contains('hidden')||!state.user||!state.nextGuide)return;const g=state.nextGuide;$('arArrow').textContent=maneuverIcon(g.type);$('arDistance').textContent=state.nextGuideDistance<60?'곧':km(state.nextGuideDistance);$('arText').textContent=g.guidance||g.name||'다음 방향';
  const target=bearingTo(state.user.lat,state.user.lng,g.y,g.x),heading=arHeading();if(Number.isFinite(heading)){const diff=normalizeAngle(target-heading),offset=clamp(diff/70,-1,1)*Math.min(innerWidth*.3,145);$('arDirection').style.transform=`translateX(calc(-50% + ${offset}px))`;}
  $('arConfidenceValue').textContent=`${arConfidence()}%`;drawRouteCorridor();
}
window.addEventListener('resize',()=>{resizeARCanvas();updateAROverlay()});

/* Native navigation packets */
window.addEventListener('jofams:lane',e=>{state.nativeLane=e.detail||null;if(state.navigating)renderLaneHint(state.nextGuide?.type??0)});
window.addEventListener('jofams:safety',e=>{state.safety=e.detail||null;if(state.navigating)renderSafetyState(state.user,currentRoad(state.currentRouteIndex));});
window.addEventListener('jofams:imageDirection',e=>{state.imageDirection=e.detail||null;if(state.navigating)renderIntersectionGuide(state.nextGuide,state.nextGuideDistance)});
window.addEventListener('jofams:roadEvents',e=>{state.roadEvents=Array.isArray(e.detail)?e.detail:(e.detail?.events||[]);if(state.navigating)renderSafetyState(state.user,currentRoad(state.currentRouteIndex))});
window.addEventListener('jofams:alternativeRoute',e=>{state.nativeMultiRoute=e.detail||null;renderNativeAlternativeNotice()});
window.addEventListener('jofams:tunnel',e=>{state.nativeTunnel=Boolean(e.detail?.active);if(state.nativeTunnel)startTunnelDR('native');else if(state.tunnel.active&&(Date.now()-state.lastGpsAt)<3000)stopTunnelDR('native-exit')});
window.addEventListener('jofams:location',e=>applyNativeLocation(e.detail));
window.addEventListener('jofams:arstatus',e=>{if(e.detail?.mode)$('arModeBadge').textContent=String(e.detail.mode).toUpperCase()});

/* Route simulator - useful for desktop/QA without driving */
function startSimulation(){
  if(!state.route?.geometry?.length||!state.navigating)return;stopSimulation();state.sim.active=true;state.sim.index=Math.max(0,state.currentRouteIndex);$('simBtn').textContent='가상주행 중';toast('가상주행을 시작합니다. 실제 GPS 대신 경로를 따라 이동합니다.');
  state.sim.timer=setInterval(()=>{if(!state.sim.active||!state.navigating)return;const coords=state.route.geometry;if(state.sim.index>=coords.length-2){stopSimulation();return}const step=Math.max(1,Math.round(coords.length/420));const prev=coords[state.sim.index];state.sim.index=Math.min(coords.length-1,state.sim.index+step);const cur=coords[state.sim.index];const heading=bearingTo(prev[1],prev[0],cur[1],cur[0]);applyPosition({coords:{longitude:cur[0],latitude:cur[1],accuracy:4,speed:state.sim.speedKmh/3.6,heading},timestamp:Date.now()},false,'sim')},650)
}
function stopSimulation(){if(state.sim.timer)clearInterval(state.sim.timer);state.sim.timer=null;state.sim.active=false;if($('simBtn'))$('simBtn').textContent='가상주행'}
function toggleSimulation(){state.sim.active?stopSimulation():startSimulation()}

/* Favorites + Firebase */
function localPreferences(){try{return JSON.parse(localStorage.getItem(GUEST_SETTINGS_KEY)||'{}')}catch{return {}}}
function applyPreferences(p={}){if(typeof p.sound==='boolean')state.sound=p.sound;if(typeof p.autoCharacter==='boolean')state.autoCharacter=p.autoCharacter;if(p.character&&characters[p.character])state.currentCharacter=p.character;if(Number.isFinite(Number(p.arHeadingOffset)))state.arHeadingOffset=Number(p.arHeadingOffset);$('soundBtn').textContent=state.sound?'🔊':'🔇';$('characterModeBtn').textContent=state.autoCharacter?'AUTO':'FIX';setCharacter(state.currentCharacter);syncCharacterButtons()}
async function savePreferences(){const p={sound:state.sound,autoCharacter:state.autoCharacter,character:state.currentCharacter,arHeadingOffset:state.arHeadingOffset,updatedAt:Date.now()};localStorage.setItem(GUEST_SETTINGS_KEY,JSON.stringify(p));if(state.firebase.user){const {fsMod}=state.firebase.mods;await fsMod.setDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'),{...p,updatedAt:fsMod.serverTimestamp()},{merge:true}).catch(()=>{})}}
async function loadPreferences(){let p=localPreferences();if(state.firebase.user){try{const {fsMod}=state.firebase.mods,snap=await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'));if(snap.exists())p={...p,...snap.data()}}catch{}}applyPreferences(p)}

function firebaseConfig(){return window.__APP_CONFIG__?.firebase||{}}
function isFirebaseConfigured(){const c=firebaseConfig();return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId)}
async function initFirebase(){
  state.firebase.configured=isFirebaseConfigured();if(!state.firebase.configured){$('firebaseHint').textContent='Firebase가 아직 설정되지 않아 이 기기의 로컬 저장소에 저장합니다.';loadGuestData();renderAccount();return}
  try{
    const [appMod,authMod,fsMod]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);
    const app=appMod.initializeApp(firebaseConfig());const auth=authMod.getAuth(app);await authMod.setPersistence(auth,authMod.browserLocalPersistence);const db=fsMod.getFirestore(app);
    state.firebase={configured:true,ready:true,auth,db,user:null,mods:{authMod,fsMod}};$('firebaseHint').textContent='Firebase 연결됨 · 로그인하면 Firestore에 동기화됩니다.';
    authMod.onAuthStateChanged(auth,async user=>{state.firebase.user=user||null;if(user)await loadCloudData();else loadGuestData();await loadPreferences();renderAccount();updateFavoriteButton()});
    await authMod.getRedirectResult(auth).catch(()=>null);
  }catch(e){console.warn('Firebase init failed',e);state.firebase.ready=false;loadGuestData();$('firebaseHint').textContent='Firebase 초기화 실패 · 게스트 로컬 저장소로 계속합니다.';renderAccount()}
}
async function loginGoogle(){
  if(!state.firebase.ready){toast('config.js에 Firebase 웹 앱 설정을 먼저 입력해 주세요.',3200);return}
  const {authMod}=state.firebase.mods;const provider=new authMod.GoogleAuthProvider();
  try{await authMod.signInWithPopup(state.firebase.auth,provider)}catch(e){if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e.code)){await authMod.signInWithRedirect(state.firebase.auth,provider)}else toast(`로그인 실패: ${e.code||e.message}`,3200)}
}
async function logout(){if(state.firebase.ready)await state.firebase.mods.authMod.signOut(state.firebase.auth)}
function favoriteId(d){return `p_${Number(d.lat).toFixed(5).replace('.','_')}_${Number(d.lng).toFixed(5).replace('.','_')}`}
function loadGuestData(){
  try{state.favorites=JSON.parse(localStorage.getItem(GUEST_FAVORITES_KEY)||'[]');state.history=JSON.parse(localStorage.getItem(GUEST_HISTORY_KEY)||'[]')}catch{state.favorites=[];state.history=[]}renderAccountLists();
}
async function loadCloudData(){
  const u=state.firebase.user;if(!u)return;const {fsMod}=state.firebase.mods;try{
    const favSnap=await fsMod.getDocs(fsMod.collection(state.firebase.db,'users',u.uid,'favorites'));state.favorites=favSnap.docs.map(d=>({id:d.id,...d.data()}));
    const q=fsMod.query(fsMod.collection(state.firebase.db,'users',u.uid,'trips'),fsMod.orderBy('createdAt','desc'),fsMod.limit(30));const h=await fsMod.getDocs(q);state.history=h.docs.map(d=>({id:d.id,...d.data()}));renderAccountLists();
  }catch(e){console.warn(e);toast('Firestore 데이터를 읽지 못했습니다. 보안 규칙을 확인해 주세요.',3000)}
}
async function toggleFavorite(){
  if(!state.destination)return;const id=favoriteId(state.destination);const exists=state.favorites.some(x=>x.id===id);
  if(state.firebase.user){const {fsMod}=state.firebase.mods;const ref=fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'favorites',id);if(exists)await fsMod.deleteDoc(ref);else await fsMod.setDoc(ref,{name:state.destination.name,address:state.destination.address,lng:state.destination.lng,lat:state.destination.lat,createdAt:fsMod.serverTimestamp()});await loadCloudData()}
  else{if(exists)state.favorites=state.favorites.filter(x=>x.id!==id);else state.favorites.unshift({id,name:state.destination.name,address:state.destination.address,lng:state.destination.lng,lat:state.destination.lat,createdAt:Date.now()});localStorage.setItem(GUEST_FAVORITES_KEY,JSON.stringify(state.favorites));renderAccountLists()}
  updateFavoriteButton();toast(exists?'즐겨찾기에서 삭제했습니다.':'즐겨찾기에 저장했습니다.');
}
function updateFavoriteButton(){if(!state.destination)return;const exists=state.favorites.some(x=>x.id===favoriteId(state.destination));$('favoriteBtn').classList.toggle('active',exists);$('favoriteBtn').textContent=exists?'★ 저장됨':'☆ 즐겨찾기'}
async function saveTripRecord({arrived,finishedAt}){
  if(!state.tripStartedAt||!state.destination||!state.route)return;const record={destination:state.destination.name,address:state.destination.address||'',lng:state.destination.lng,lat:state.destination.lat,distance:Math.round(state.route.distance||0),duration:Math.round((finishedAt-state.tripStartedAt)/1000),plannedDuration:Math.round(state.route.duration||0),provider:state.route.provider||'',arrived:Boolean(arrived)};
  if(state.firebase.user){const {fsMod}=state.firebase.mods;await fsMod.addDoc(fsMod.collection(state.firebase.db,'users',state.firebase.user.uid,'trips'),{...record,createdAt:fsMod.serverTimestamp()}).catch(console.warn);await loadCloudData()}
  else{state.history.unshift({...record,id:`local_${finishedAt}`,createdAt:finishedAt});state.history=state.history.slice(0,30);localStorage.setItem(GUEST_HISTORY_KEY,JSON.stringify(state.history));renderAccountLists()}
  state.tripStartedAt=null;
}
function renderAccount(){
  const u=state.firebase.user;$('signedOutBox').classList.toggle('hidden',Boolean(u));$('signedInBox').classList.toggle('hidden',!u);$('accountBtn').classList.toggle('signed',Boolean(u));
  if(u){$('accountStatus').textContent='Firebase 동기화 중';$('userName').textContent=u.displayName||'사용자';$('userEmail').textContent=u.email||'';$('userPhoto').src=u.photoURL||'/assets/daim.png';$('accountBtn').textContent='✓'}else{$('accountStatus').textContent=state.firebase.configured?'로그인 전 · 게스트 저장':'게스트 모드 · 로컬 저장';$('accountBtn').textContent='👤'}renderAccountLists();
}
function itemDate(v){if(!v)return '';if(typeof v.toDate==='function')return v.toDate().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});const d=new Date(typeof v==='number'?v:v.seconds? v.seconds*1000:Date.now());return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function renderAccountLists(){
  const fav=$('favoritesList'),hist=$('historyList');fav.innerHTML='';hist.innerHTML='';
  if(!state.favorites.length)fav.innerHTML='<div class="list-empty">아직 저장한 목적지가 없습니다.</div>';else state.favorites.forEach(f=>fav.appendChild(accountItem(f.name,f.address||'저장한 장소','안내',()=>{closeAccount();selectDestination(f)})));
  if(!state.history.length)hist.innerHTML='<div class="list-empty">아직 주행 기록이 없습니다.</div>';else state.history.forEach(h=>hist.appendChild(accountItem(h.destination,`${itemDate(h.createdAt)} · ${km(h.distance)} · ${durationText(h.duration)}`,h.arrived?'도착':'종료')));
}
function accountItem(title,sub,action,onClick){const row=document.createElement('div');row.className='account-item';const copy=document.createElement('div');copy.className='item-copy';const b=document.createElement('b');b.textContent=title||'장소';const s=document.createElement('small');s.textContent=sub||'';copy.append(b,s);const btn=document.createElement('button');btn.textContent=action||'보기';if(onClick)btn.onclick=onClick;else btn.disabled=true;row.append(copy,btn);return row}
function openAccount(){setUiStage('account');$('accountModal').classList.remove('hidden');renderAccount()}
function closeAccount(){$('accountModal').classList.add('hidden');setUiStage(state.navigating?'drive':state.route?'route':'home')}

function bindUI(){
  $('searchBtn').onclick=()=>searchPlaces($('destinationInput').value);$('destinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value)});$('locateBtn').onclick=()=>locate(true);$('recenterBtn').onclick=()=>locate(true);$('zoomInBtn').onclick=()=>state.map.zoomIn();$('zoomOutBtn').onclick=()=>state.map.zoomOut();
  $('startNavBtn').onclick=startNavigation;$('stopNavBtn').onclick=()=>stopNavigation();$('cancelRouteBtn').onclick=clearRoute;$('overviewBtn').onclick=()=>state.route&&drawRoutes({fit:true});$('altBtn').onclick=()=>{renderAlternativeRoutes();$('fasterRouteBanner').classList.add('hidden');if(state.navigating)checkAlternativeRoutes();toast(state.routeOptions.length>1?'대안 경로를 확인하고 최신 경로도 조회합니다.':'최신 대안 경로를 조회합니다.')};$('simBtn').onclick=toggleSimulation;$('arBtn').onclick=startAR;$('closeArBtn').onclick=stopAR;$('arCalibrateBtn').onclick=calibrateAR;$('favoriteBtn').onclick=toggleFavorite;
  document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.priority=b.dataset.priority||'RECOMMEND';state.avoid=b.dataset.avoid||null;if(state.destination)requestRoute()});
  document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quickSearch(b.dataset.quick));
  document.querySelectorAll('[data-suggest]').forEach(b=>b.onclick=()=>{const q=b.dataset.suggest||'';$('destinationInput').value=q;searchPlaces(q)});
  document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>{state.autoCharacter=false;setCharacter(b.dataset.character);$('characterModeBtn').textContent='FIX';savePreferences();toast(`${characters[b.dataset.character]?.name||'가이드'} 고정 안내로 변경했습니다.`)});
  document.querySelectorAll('[data-character-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.characterMode;if(mode==='auto'){state.autoCharacter=true;$('characterModeBtn').textContent='AUTO';toast('상황별 캐릭터 자동 전환을 사용합니다.')}else{state.autoCharacter=false;setCharacter(mode);$('characterModeBtn').textContent='FIX';toast(`${characters[mode]?.name||'가이드'} 고정 안내로 변경했습니다.`)}syncCharacterButtons();savePreferences()});
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.nav;if(nav==='my'){openAccount();return}if(nav==='home'){setUiStage('home');return}if(nav==='route'){if(state.route)setUiStage('route');else{setUiStage('home');$('destinationInput').focus();toast('목적지를 먼저 검색해 주세요.')}return}if(nav==='drive'){if(state.navigating){setUiStage('drive');return}if(state.route){toast('안내 시작을 눌러 실시간 주행을 시작해 주세요.');setUiStage('route')}else toast('먼저 목적지를 선택해 주세요.')}});
  $('soundBtn').onclick=()=>{state.sound=!state.sound;$('soundBtn').textContent=state.sound?'🔊':'🔇';savePreferences();toast(state.sound?'음성 안내 켜짐':'음성 안내 꺼짐')};
  $('acceptFasterRouteBtn').onclick=acceptPendingAlternative;$('dismissFasterRouteBtn').onclick=()=>{$('fasterRouteBanner').classList.add('hidden');state.pendingAlternative=null;state.nativeMultiRoute=null};
  $('characterModeBtn').onclick=()=>{state.autoCharacter=!state.autoCharacter;$('characterModeBtn').textContent=state.autoCharacter?'AUTO':'FIX';syncCharacterButtons();savePreferences();toast(state.autoCharacter?'상황별 캐릭터 자동 전환':'현재 캐릭터 고정')};
  $('accountBtn').onclick=openAccount;$('closeAccountBtn').onclick=closeAccount;$('accountModal').addEventListener('click',e=>{if(e.target===$('accountModal'))closeAccount()});$('googleLoginBtn').onclick=loginGoogle;$('logoutBtn').onclick=logout;
  document.querySelectorAll('.account-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.account-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.activeAccountTab=b.dataset.tab;$('favoritesList').classList.toggle('hidden',state.activeAccountTab!=='favorites');$('historyList').classList.toggle('hidden',state.activeAccountTab!=='history')});
  syncCharacterButtons();setUiStage('home');
}

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
bindUI();applyPreferences(localPreferences());initMap();initFirebase();
