import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs';
import {NativeBridge} from '/native-bridge.js';

const $ = id => document.getElementById(id);
const FIREBASE_VERSION = '12.18.0';
const GUEST_FAVORITES_KEY = 'jofams.v2.favorites';
const GUEST_HISTORY_KEY = 'jofams.v2.history';
const GUEST_SETTINGS_KEY = 'jofams.v4.settings';

const state = {
  map:null,user:null,destination:null,route:null,userMarker:null,destMarker:null,watchId:null,
  navigating:false,sound:true,voiceVolume:.8,autoCharacter:true,priority:'RECOMMEND',avoid:null,currentCharacter:'daim',
  lastSpeech:'',lastRerouteAt:0,offRouteCount:0,currentRouteIndex:0,nextGuide:null,nextGuideDistance:0,
  lastGuideSpeechKey:'',deviceHeading:null,smoothedHeading:null,devicePitch:null,arStream:null,arMode:'off',xrSession:null,xrGl:null,
  arHeadingOffset:0,arFrame:0,tripStartedAt:null,tripStartPosition:null,nativeLane:null,safety:null,imageDirection:null,roadEvents:[],nativeMultiRoute:null,
  routeOptions:[],selectedRouteIndex:0,pendingAlternative:null,alternativeTimer:null,lastAlternativeCheck:0,
  lastGpsAt:0,lastRealGps:null,positionSource:'gps',nativeTunnel:false,tunnel:{active:false,timer:null,distanceOnRoute:0,lastTick:0,lastSpeed:0},
  parking:[],parkingProvider:'',parkingLoadedFor:'',destinationCorrection:null,lastSafetySpeechKey:'',hunminFreeRoute:null,sim:{active:false,timer:null,index:0,speedKmh:45},haptic:true,
  firebase:{configured:false,ready:false,auth:null,db:null,user:null,mods:null},
  favorites:[],history:[],activeAccountTab:'favorites',demoMode:null,savedPlaces:{home:null,work:null},registerKind:null,
  speechVoices:[],layerLayoutRaf:0
};

const characters = {
  daim:{name:'다임',role:'정확한 안내',img:'/assets/daim.png',msg:'복잡한 구간도 차근차근 정확하게 안내할게요.',voice:{rate:.96,pitch:1.16,label:'차분하고 또렷한 음성'}},
  sunsik:{name:'순식',role:'즐거운 동행',img:'/assets/sunsik.png',msg:'막히는 길도 너무 답답해하지 마세요. 제가 같이 갈게요!',voice:{rate:.94,pitch:.88,label:'친근하고 여유로운 음성'}},
  hunmin:{name:'훈민',role:'신속한 판단',img:'/assets/hunmin.png',msg:'상황 변화 감지. 가장 빠르게 다음 경로를 정리합니다.',voice:{rate:1.10,pitch:.72,label:'짧고 신속한 음성'}}
};

function iconSvg(name){
  switch(name){
    case 'brand-home': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.6 12 3.8l8.5 6.8"/><path d="M6.5 9.7V20h11V9.7"/><path d="M10.2 20v-5.6h3.6V20"/></svg>`;
    case 'menu': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M4 7.5h16"/><path d="M4 12h16"/><path d="M4 16.5h16"/></svg>`;
    case 'sound-on': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h4l5 4V6L8 10H4z"/><path d="M17 9.2c1.7 1.5 1.7 4.1 0 5.6"/><path d="M19.8 6.7c3 3.2 3 7.5 0 10.6"/></svg>`;
    case 'sound-off': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h4l5 4V6L8 10H4z"/><path d="M17 9l4 6"/><path d="M21 9l-4 6"/></svg>`;
    case 'account-outline': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.7"/><path d="M5 19c1.9-3 4.4-4.5 7-4.5s5.1 1.5 7 4.5"/></svg>`;
    case 'locate': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><circle cx="12" cy="12" r="4.2"/></svg>`;
    case 'search': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="5.8"/><path d="m15.2 15.2 4.3 4.3"/></svg>`;
    case 'home': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.4 12 3.9l8.5 6.5"/><path d="M6.3 9.8V20h11.4V9.8"/><path d="M10.3 20v-5.7h3.4V20"/></svg>`;
    case 'office': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V5.8L12 4l7 1.8V20"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/><path d="M10.4 20v-3.8h3.2V20"/></svg>`;
    case 'star': return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.2 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5 6.8 19.2l1-5.8-4.2-4.1 5.8-.8z"/></svg>`;
    case 'chevron-right': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 6 7-6 7"/></svg>`;
    case 'chevron-left': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-6 7 6 7"/></svg>`;
    case 'spark-pin': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/><path d="M17.3 5.5h2.4M18.5 4.3v2.4"/></svg>`;
    case 'tower': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8.5 20h7"/><path d="m9.2 7.5 2.8-3 2.8 3"/><path d="m7 13 5-5 5 5"/><path d="M6 17h12"/></svg>`;
    case 'plane': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m2.6 12.2 18.1-6.1-4.4 11.8-3.1-4.1-4.1 1.6-.9 4.2-1.9-5.5z"/></svg>`;
    case 'fuel': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V20"/><path d="M6 9.5h9"/><path d="m15.5 7 2.5 2.5V17a1.5 1.5 0 1 0 3 0v-4.5l-2.3-2.2"/></svg>`;
    case 'cafe': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h10v4.5A3.5 3.5 0 0 1 11.5 17h-3A3.5 3.5 0 0 1 5 13.5Z"/><path d="M15 10h1.8a2.2 2.2 0 1 1 0 4.4H15"/><path d="M7 20h9"/><path d="M8.5 5.2c-.8.8-.8 2 0 2.8M12 4.2c-1 1-1 2.7 0 3.8"/></svg>`;
    case 'charge': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13.5 3-5 8h4l-2 10 7-10h-4z"/></svg>`;
    case 'store': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9v11h14V9"/><path d="M4 9h16l-1.5-5h-13z"/><path d="M8 20v-6h4v6"/><path d="M15 13h2"/><path d="M6 9c0 1 .8 1.8 1.8 1.8S9.6 10 9.6 9c0 1 .8 1.8 1.8 1.8S13.2 10 13.2 9c0 1 .8 1.8 1.8 1.8S16.8 10 16.8 9c0 1 .8 1.8 1.8 1.8S20.4 10 20.4 9"/></svg>`;
    case 'route-overview': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19c2-8 10-2 12-10"/><path d="M17 7h2v2"/><circle cx="6" cy="19" r="2" fill="currentColor" stroke="none"/></svg>`;
    case 'swap': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h12"/><path d="m15 3 4 4-4 4"/><path d="M17 17H5"/><path d="m9 21-4-4 4-4"/></svg>`;
    case 'play': return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10-6.5z"/></svg>`;
    case 'stop': return `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.2"/></svg>`;
    case 'plus': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
    case 'minus': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>`;
    case 'compass': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.2-2.2 5.6-5.4 2.2 2.2-5.6z" fill="currentColor" stroke="none"/></svg>`;
    case 'flash': return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 6.5 12H11L9.8 22 17.5 11.5H13Z"/></svg>`;
    case 'close': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 6 18 18M18 6 6 18"/></svg>`;
    case 'bell': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 16.5h11L16 14V10a4 4 0 1 0-8 0v4l-1.5 2.5Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/></svg>`;
    case 'report': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`;
    case 'route-tab': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.2s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="9.2" r="3.1"/></svg>`;
    case 'drive': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17h10l1.2-5.2A2 2 0 0 0 16.3 9H7.7a2 2 0 0 0-1.9 2.8Z"/><path d="M8 17v2M16 17v2"/><circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="14" r="1" fill="currentColor" stroke="none"/></svg>`;
    case 'my-tab': return `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#D8ECFF"/><path d="M12 11.1a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" fill="#ffffff"/><path d="M5.6 18.5a7.4 7.4 0 0 1 12.8 0" fill="#ffffff"/></svg>`;
    default: return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`;
  }
}
function applyStaticIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=iconSvg(el.dataset.icon||'')})}
function directionName(type){
  if(type===101) return 'arrive';
  if(type===3) return 'u-turn';
  if(ROUNDABOUT_TYPES.has(type)) return 'roundabout';
  if([7,42].includes(type)) return 'slight-right';
  if([10,45].includes(type)) return 'merge';
  if(LEFT_TYPES.has(type)) return 'turn-left';
  if(RIGHT_TYPES.has(type)) return 'turn-right';
  return 'straight';
}
function directionSvg(name,color='currentColor'){
  const stroke = `stroke="${color}" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if(name==='arrive') return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="${color}" opacity=".16"/><path ${stroke} d="m7 12.2 3.2 3.2L17.5 8"/></svg>`;
  if(name==='roundabout') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M7 10a5.5 5.5 0 1 1 2 8.4"/><path ${stroke} d="m6 7 1.2 3.7 3.8-1.1"/><path ${stroke} d="m18 16-1.2-3.7-3.8 1.1"/></svg>`;
  if(name==='u-turn') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M15 19V9a3.5 3.5 0 1 0-7 0v2"/><path ${stroke} d="m4 9 4 4 4-4"/></svg>`;
  if(name==='turn-left') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M18.5 7H10a5 5 0 0 0-5 5v5"/><path ${stroke} d="m10 3-4 4 4 4"/></svg>`;
  if(name==='turn-right') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M5.5 7H14a5 5 0 0 1 5 5v5"/><path ${stroke} d="m14 3 4 4-4 4"/></svg>`;
  if(name==='slight-left') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M17 18V9.8c0-1.8-1.3-3.1-3.1-3.1H9.5"/><path ${stroke} d="m10.5 3.5-4 3.2 4 3.2"/></svg>`;
  if(name==='slight-right') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M7 18V9.8c0-1.8 1.3-3.1 3.1-3.1h4.4"/><path ${stroke} d="m13.5 3.5 4 3.2-4 3.2"/></svg>`;
  if(name==='merge') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M12 18V5"/><path ${stroke} d="m8.5 8 3.5-3 3.5 3"/><path ${stroke} d="M6 18c0-2.9 1.5-4.7 4-5.8"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M12 19V5"/><path ${stroke} d="m8.5 8 3.5-3 3.5 3"/></svg>`;
}
function setDirectionIcon(el,type,color='currentColor'){if(el)el.innerHTML=`<span class="svg-icon">${directionSvg(directionName(type),color)}</span>`}
function laneTurnNames(turnType){
  const names=[];
  if(turnType&1) names.push('u-turn');
  if(turnType&2) names.push('turn-left');
  if(turnType&4) names.push('slight-left');
  if(turnType&8) names.push('straight');
  if(turnType&16) names.push('slight-right');
  if(turnType&32) names.push('turn-right');
  return names.length?names:['straight'];
}
function laneIconsMarkup(names){return `<span class="lane-icon-wrap">${names.slice(0,2).map(name=>directionSvg(name,'currentColor')).join('')}</span>`}
function placeLabel(kind){return kind==='home'?'집':'회사'}
function normalizeQueryText(v=''){return String(v).toLowerCase().replace(/\s+/g,'').replace(/[()\-.,]/g,'')}
function normalizePlaceData(place){
  if(!place) return null;
  const lng=Number(place.lng), lat=Number(place.lat);
  if(!Number.isFinite(lng)||!Number.isFinite(lat)) return null;
  return {id:place.id||null,lng,lat,name:place.name||'저장한 장소',address:place.address||''};
}
function normalizeSearchResults(query, items=[]){
  const q=normalizeQueryText(query),list=[...items];
  const exactAddress=q.includes('과학로8067')||q.includes('대전광역시과학로8067')||q.includes('대전유성구과학로8067');
  const komscoSearch=q.includes('한국조폐공사');
  const hqIndex=list.findIndex(x=>(/한국조폐공사/.test(x.name||'')&&/본사/.test(x.name||''))||/과학로\s*80-67/.test(x.address||''));
  if(exactAddress){
    const base=hqIndex>=0?list[hqIndex]:(list.find(x=>/한국조폐공사/.test(x.name||''))||list[0]);
    return base?[{...base,name:'한국조폐공사 본사',address:'대전광역시 유성구 과학로 80-67'}]:[];
  }
  if(komscoSearch&&hqIndex>=0){const [hq]=list.splice(hqIndex,1);list.unshift({...hq,name:'한국조폐공사 본사',address:hq.address||'대전광역시 유성구 과학로 80-67'})}
  return list;
}
function updateHomeWorkButtons(){
  const home=state.savedPlaces.home, work=state.savedPlaces.work;
  const homeMeta=$('homeShortcutMeta'), workMeta=$('workShortcutMeta');
  const editHome=$('editHomeBtn'), editWork=$('editWorkBtn');
  if(homeMeta) homeMeta.textContent=home?(home.name||home.address||'등록됨'):'장소 등록';
  if(workMeta) workMeta.textContent=work?(work.name||work.address||'등록됨'):'장소 등록';
  if(editHome) editHome.textContent=home?'변경':'등록';
  if(editWork) editWork.textContent=work?'변경':'등록';
  const count = state.favorites.length;
  if($('favoritesShortcutMeta')) $('favoritesShortcutMeta').textContent=count?`저장 ${count}곳 관리`:'자유롭게 관리';
}
function setSoundButtonIcon(){ document.querySelectorAll('[data-menu-action="sound"] .svg-icon').forEach(slot=>{slot.innerHTML=iconSvg(state.sound?'sound-on':'sound-off')}) }
async function searchFirstPlace(query){
  const u=new URL('/api/search',location.origin);u.searchParams.set('q',query.trim());
  if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
  const r=await fetch(u);if(!r.ok) throw new Error('검색 실패'); const data=await r.json();
  return normalizeSearchResults(query,data.items||[])[0]||null;
}
async function saveSavedPlace(kind, place){ state.savedPlaces[kind]=normalizePlaceData(place); await savePreferences(); updateHomeWorkButtons(); renderAccount(); }
function openPlaceRegistration(kind){
  state.registerKind=kind;
  const label=placeLabel(kind);
  $('placeRegisterTitle').textContent=`${label} 장소 등록`;
  $('placeRegisterInput').value=state.savedPlaces[kind]?.name||'';
  $('placeRegisterResults').innerHTML='<div class="register-empty">검색 결과에서 원하는 장소를 선택하면 바로 등록됩니다.</div>';
  const current=normalizePlaceData(state.destination);
  $('placeRegisterCurrent').classList.toggle('hidden',!current);
  if(current)$('placeRegisterCurrentText').textContent=`${current.name}${current.address?` · ${current.address}`:''}`;
  $('placeRegisterModal').classList.remove('hidden');
  setTimeout(()=>$('placeRegisterInput').focus(),60);
}
function closePlaceRegistration(){state.registerKind=null;$('placeRegisterModal').classList.add('hidden')}
async function renderPlaceRegistrationSearch(){
  const query=$('placeRegisterInput').value.trim();if(!query)return;
  const box=$('placeRegisterResults');box.innerHTML='<div class="register-empty">검색 중...</div>';
  try{
    const u=new URL('/api/search',location.origin);u.searchParams.set('q',query);
    if(state.user){u.searchParams.set('lng',state.user.lng);u.searchParams.set('lat',state.user.lat)}
    const r=await fetch(u);if(!r.ok)throw new Error('검색 실패');const data=await r.json();const items=normalizeSearchResults(query,data.items||[]);box.innerHTML='';
    if(!items.length){box.innerHTML='<div class="register-empty">검색 결과가 없습니다.</div>';return}
    items.slice(0,8).forEach(item=>{const row=document.createElement('button');row.className='register-result';row.innerHTML=`<span class="register-result-icon">${iconSvg('route-tab')}</span><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.address||item.category||'')}</small></span>`;row.onclick=async()=>{if(!state.registerKind)return;await saveSavedPlace(state.registerKind,item);toast(`${placeLabel(state.registerKind)} 장소를 저장했습니다.`);closePlaceRegistration()};box.appendChild(row)});
  }catch(e){box.innerHTML='<div class="register-empty">검색 서버에 연결하지 못했습니다.</div>';toast(e.message)}
}
async function useSavedPlace(kind){const place=state.savedPlaces[kind];if(place)return selectDestination(place);openPlaceRegistration(kind)}
async function deleteFavoriteById(id){
  if(state.firebase.user){ const {fsMod}=state.firebase.mods; await fsMod.deleteDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'favorites',id)); await loadCloudData(); }
  else { state.favorites=state.favorites.filter(x=>x.id!==id); localStorage.setItem(GUEST_FAVORITES_KEY,JSON.stringify(state.favorites)); renderAccountLists(); }
  updateFavoriteButton(); updateHomeWorkButtons(); toast('즐겨찾기에서 삭제했습니다.');
}
function setAccountTab(tab='favorites'){
  state.activeAccountTab=tab;
  document.querySelectorAll('.account-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $('favoritesList').classList.toggle('hidden',tab!=='favorites');
  $('historyList').classList.toggle('hidden',tab!=='history');
}
async function syncAuthState(user){
  state.firebase.user=user||null;
  if(user) await loadCloudData(); else loadGuestData();
  await loadPreferences();
  renderAccount();
  updateFavoriteButton();
  updateHomeWorkButtons();
}

function openMenuDrawer(){$('menuDrawer')?.classList.remove('hidden')}
function closeMenuDrawer(){$('menuDrawer')?.classList.add('hidden')}
function openNoticeModal(){$('noticeModal')?.classList.remove('hidden')}
function closeNoticeModal(){$('noticeModal')?.classList.add('hidden')}
function menuRoutePreview(){if(state.route){setUiStage('route');return}const q='스타필드 코엑스몰';$('destinationInput').value=q;searchPlaces(q)}
function menuParkingPreview(){if(state.parking.length&&state.route){setUiStage('route');const panel=$('parkingPanel');panel?.scrollIntoView({behavior:'smooth',block:'nearest'});return}if(state.route){loadParkingNearDestination();setUiStage('route');return}const q='스타필드 코엑스몰';$('destinationInput').value=q;searchPlaces(q)}


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

function refreshSpeechVoices(){
  if(!('speechSynthesis' in window))return [];
  const voices=window.speechSynthesis.getVoices?.()||[];
  state.speechVoices=voices.filter(v=>/^ko([-_]|$)/i.test(v.lang||''));
  return state.speechVoices;
}
function voiceForCharacter(key){
  const voices=state.speechVoices.length?state.speechVoices:refreshSpeechVoices();
  if(!voices.length)return null;
  const sorted=[...voices].sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko'));
  const preferred=sorted.filter(v=>/google|microsoft|samsung|apple|korean|한국/i.test(v.name||''));
  const pool=preferred.length?preferred:sorted;
  const index=key==='daim'?0:key==='sunsik'?Math.min(1,pool.length-1):pool.length-1;
  return pool[Math.max(0,index)]||pool[0]||null;
}
function setCharacter(key,message,speakIt=false){
  const normalized=characters[key]?key:'daim',c=characters[normalized],changed=state.currentCharacter!==normalized;
  state.currentCharacter=normalized;
  if(changed){
    $('characterAvatar').src=c.img;$('characterAvatar').alt=`${c.name} 캐릭터`;
    $('arCharacter').src=c.img;$('arCharacter').alt=`${c.name} 캐릭터`;
    $('characterName').textContent=c.name;$('characterRole').textContent=c.role;
    syncCharacterButtons();updateVoiceProfileUI();
  }
  const copy=message||c.msg;
  if($('characterMessage').textContent!==copy)$('characterMessage').textContent=copy;
  if($('arCharacterMsg').textContent!==copy)$('arCharacterMsg').textContent=copy;
  if(speakIt)speak(copy,{characterKey:normalized});
}
function speak(text,{force=false,characterKey=state.currentCharacter}={}){
  if(!state.sound||state.voiceVolume<=0||!('speechSynthesis' in window)||!text)return;
  const speechKey=`${characterKey}:${text}`;
  if(!force&&speechKey===state.lastSpeech)return;
  state.lastSpeech=speechKey;
  window.speechSynthesis.cancel();
  const profile=(characters[characterKey]||characters.daim).voice||characters.daim.voice;
  const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=profile.rate;u.pitch=profile.pitch;u.volume=clamp(Number(state.voiceVolume)||0,0,1);
  const voice=voiceForCharacter(characterKey);if(voice)u.voice=voice;
  window.speechSynthesis.speak(u);
}
function updateVoiceProfileUI(){
  document.querySelectorAll('[data-voice-profile]').forEach(el=>el.classList.toggle('active',el.dataset.voiceProfile===state.currentCharacter));
  const c=characters[state.currentCharacter]||characters.daim;
  const status=$('voiceGuideStatus');if(status&&state.sound&&state.voiceVolume>0)status.textContent=`${c.name} · ${c.voice.label}`;
}
function updateVoiceControls(){
  const pct=Math.round((Number(state.voiceVolume)||0)*100);
  if($('voiceVolume')) $('voiceVolume').value=String(pct);
  if($('voiceVolumeValue')) $('voiceVolumeValue').textContent=`${pct}%`;
  if($('voiceGuideStatus')) $('voiceGuideStatus').textContent=state.sound&&pct>0?`${characters[state.currentCharacter]?.name||'다임'} · ${characters[state.currentCharacter]?.voice?.label||'음성 안내'}`:'음성 안내 꺼짐';
  const slot=$('voiceToggleBtn')?.querySelector('.svg-icon');if(slot)slot.innerHTML=iconSvg(state.sound&&pct>0?'sound-on':'sound-off');
  $('voiceToggleBtn')?.classList.toggle('off',!state.sound||pct===0);setSoundButtonIcon();updateVoiceProfileUI();
}
function previewCharacterVoice(key=state.currentCharacter){
  const c=characters[key]||characters.daim;
  state.lastSpeech='';
  const scripts={daim:'다임입니다. 다음 교차로와 차선을 정확하게 안내할게요.',sunsik:'순식입니다. 길이 조금 막혀도 여유 있게 함께 가요.',hunmin:'훈민입니다. 경로 변경을 감지하면 빠르게 재탐색하겠습니다.'};
  speak(scripts[key]||scripts.daim,{force:true,characterKey:key});
}
function scheduleLayerLayout(){
  cancelAnimationFrame(state.layerLayoutRaf);state.layerLayoutRaf=requestAnimationFrame(layoutActiveLayers);
}
function layoutActiveLayers(){
  if(!document.body.classList.contains('driving'))return;
  const gap=8,g=$('guidanceCard'),lane=$('lanePanel'),ix=$('intersectionPanel'),hud=$('driveHud'),fast=$('fasterRouteBanner');
  if(!g||g.classList.contains('hidden'))return;
  const gRect=g.getBoundingClientRect();
  if(lane&&!lane.classList.contains('hidden'))lane.style.top=`${Math.round(gRect.bottom+gap)}px`;
  const laneRect=lane&&!lane.classList.contains('hidden')?lane.getBoundingClientRect():gRect;
  if(ix&&!ix.classList.contains('hidden')){
    const desired=laneRect.bottom+gap, hudTop=hud&&!hud.classList.contains('hidden')?hud.getBoundingClientRect().top:innerHeight-170;
    const room=hudTop-desired-gap;
    ix.classList.toggle('layer-no-room',room<Math.max(94,ix.offsetHeight));
    if(room>=Math.max(94,ix.offsetHeight))ix.style.top=`${Math.round(desired)}px`;
  }
  if(fast&&!fast.classList.contains('hidden')&&hud&&!hud.classList.contains('hidden')){
    const hudRect=hud.getBoundingClientRect();fast.style.bottom=`${Math.max(12,Math.round(innerHeight-hudRect.top+10))}px`;
  }
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
    const items=normalizeSearchResults(query,data.items||[]);
    if(!items.length){box.innerHTML='<button class="result-item">검색 결과가 없습니다.</button>';return}
    items.slice(0,8).forEach(item=>{const b=document.createElement('button');b.className='result-item';b.innerHTML=`<b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.address||item.category||'')}</small>`;b.onclick=()=>selectDestination(item);box.appendChild(b)});
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

async function fetchHunminFreeRoute(){
  if(!state.user||!state.destination)return null;
  try{
    const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:state.user,destination:state.destination,priority:'RECOMMEND',avoid:'toll',alternatives:false,destinationCorrection:state.destinationCorrection})});
    if(!r.ok)return null;const data=await r.json();if(data.provider!=='kakao'){state.hunminFreeRoute=null;const text=$('hunminFreeRouteText');if(text)text.textContent='Kakao 길찾기 연결 시 통행료 회피 경로를 비교합니다.';return null}const route=prepareRoute({...data,intent:'toll-free',guideCharacter:'hunmin',avoid:'toll'});
    state.hunminFreeRoute=route;updateHunminFreeRouteCard();return route;
  }catch{state.hunminFreeRoute=null;updateHunminFreeRouteCard();return null}
}
function updateHunminFreeRouteCard(){
  const card=$('hunminFreeRouteCard'),text=$('hunminFreeRouteText');if(!card||!text)return;
  const r=state.hunminFreeRoute;
  card.classList.toggle('ready',Boolean(r));
  if(!r){text.textContent='통행료를 줄이는 경로를 별도로 비교합니다.';return}
  const base=state.routeOptions[0];const extra=base?Math.round(((r.duration||0)-(base.duration||0))/60):0;
  const suffix=extra>0?` · 추천 경로보다 ${extra}분 더 소요`:extra<0?` · ${Math.abs(extra)}분 단축`:' · 예상시간 비슷함';
  text.textContent=`${durationText(r.duration)} · ${km(r.distance)}${suffix}`;
}
function chooseHunminFreeRoute(){
  const r=state.hunminFreeRoute;if(!r){toast('무료도로 경로를 계산 중입니다.');fetchHunminFreeRoute();return}
  const existing=state.routeOptions.findIndex(x=>x.intent==='toll-free');
  if(existing>=0){selectRouteOption(existing,{fit:true,announce:true});return}
  state.routeOptions.push(r);selectRouteOption(state.routeOptions.length-1,{fit:true,announce:true});renderAlternativeRoutes();
  setCharacter('hunmin','통행료를 줄이는 무료도로 경로를 선택했습니다. 빠르게 안내하겠습니다.',true);
}

async function requestRoute({reroute=false,silent=false}={}){
  if(!state.user||!state.destination)return;
  if(reroute)setCharacter('hunmin','경로 이탈 감지. 새 경로를 계산합니다.',true);
  try{
    const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:state.user,destination:state.destination,priority:state.priority,avoid:state.avoid,alternatives:true,destinationCorrection:state.destinationCorrection})});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`경로 계산 실패 (${r.status})`);
    const rawOptions=[data,...(data.alternatives||[])].map(x=>{const y={...x};delete y.alternatives;return y});
    state.routeOptions=rawOptions.map((x,i)=>prepareRoute({...x,intent:i===0?'recommend':i===1?'fast':'alternative'}));state.selectedRouteIndex=0;state.route=state.routeOptions[0];state.currentRouteIndex=0;state.nextGuide=null;state.nativeLane=null;state.imageDirection=null;state.lastGuideSpeechKey='';
    drawRoutes();showRouteSummary(state.route);renderAlternativeRoutes();if(!reroute){loadParkingNearDestination();fetchHunminFreeRoute().then(r=>{if(r&&!state.routeOptions.some(x=>x.intent==='toll-free')){state.routeOptions.push(r);renderAlternativeRoutes();drawRoutes({fit:false})}})}
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
  state.routeOptions.forEach((r,i)=>{
    const b=document.createElement('button');b.className='alternative-card'+(i===state.selectedRouteIndex?' active':'');
    const diff=Math.round(((r.duration||0)-base)/60);
    const isFree=r.intent==='toll-free'||r.avoid==='toll';
    const guideKey=isFree?'hunmin':i===0?'daim':i===1?'sunsik':'daim',guide=characters[guideKey];
    const title=isFree?'무료도로':i===0?'추천':i===1?'빠른길':`대안 ${i}`;
    const diffText=isFree?'통행료 절약 우선':i===0?'가장 균형 잡힌 경로':diff===0?'추천 경로와 비슷한 시간':diff>0?`${diff}분 더 소요`:`${Math.abs(diff)}분 단축`;
    b.innerHTML=`<div class="alt-main"><div class="alt-badge ${isFree?'free':''}">${title}</div><div class="alt-metrics"><b>${durationText(r.duration)}</b><small>${km(r.distance)} · ${escapeHtml(diffText)}</small></div></div><div class="alt-guide"><img src="${guide.img}" alt="${guide.name}"><span><b>${guide.name}</b><small>${escapeHtml(isFree?'무료도로 · 빠른 판단':guide.role)}</small></span></div>`;
    b.onclick=()=>selectRouteOption(i,{fit:true,announce:true});list.appendChild(b)
  });
}
function candidateRoutesFromPayload(data){const raw=[data,...(data?.alternatives||[])].filter(Boolean);return raw.map(x=>{const y={...x};delete y.alternatives;return prepareRoute(y)})}
async function fetchAlternativeSnapshot(){
  if(!state.navigating||!state.user||!state.destination||state.sim.active)return null;state.lastAlternativeCheck=Date.now();
  try{const r=await fetch('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:state.user,destination:state.destination,priority:state.priority,avoid:state.avoid,alternatives:true,destinationCorrection:state.destinationCorrection})});if(!r.ok)return null;return candidateRoutesFromPayload(await r.json())}catch{return null}
}
async function checkAlternativeRoutes(){
  const candidates=await fetchAlternativeSnapshot();if(!candidates?.length||!state.route)return;
  const current=Math.max(1,state.route.liveRemainDuration||state.route.duration||1);const best=candidates.reduce((a,b)=>(b.duration||Infinity)<(a.duration||Infinity)?b:a,candidates[0]);const saving=current-(best.duration||current);
  if(saving>=90&&saving/current>=.08){state.pendingAlternative=best;$('fasterRouteTitle').textContent=`${Math.max(2,Math.round(saving/60))}분 빠른 경로 발견`;$('fasterRouteDetail').textContent=`${km(best.distance)} · ${durationText(best.duration)} 예상`;$('fasterRouteBanner').classList.remove('hidden');scheduleLayerLayout();setCharacter('hunmin',`더 빠른 경로를 찾았습니다. 약 ${Math.max(2,Math.round(saving/60))}분 줄일 수 있어요.`,true)}
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
function renderParking(){
  const panel=$('parkingPanel'),list=$('parkingList');if(!panel||!list)return;list.innerHTML='';
  if(!state.parking.length){panel.classList.add('hidden');return}
  panel.classList.remove('hidden');$('parkingProvider').textContent=state.parkingProvider==='kakao'?'Kakao Local · 거리순':'검색 결과';
  const badges=[['여유','green'],['보통','yellow'],['혼잡','red'],['혼잡','red']];
  state.parking.slice(0,4).forEach((p,i)=>{
    const b=document.createElement('button');b.className='parking-card';
    const dist=km(Number(p.distance)||haversine(state.destination.lat,state.destination.lng,p.lat,p.lng));
    const fee=['1,200원/30분','1,000원/30분','1,500원/30분','900원/30분'][i]||'요금 확인';
    const [badge,badgeClass]=badges[i]||['안내','blue'];
    b.innerHTML=`<div class="parking-card-head"><div><b>${escapeHtml(p.name||'주차장')}</b><small>${escapeHtml(p.address||'')}</small></div><span class="parking-badge ${badgeClass}">${badge}</span></div><div class="parking-card-foot"><span>${dist} · ${fee}</span><i class="park-go">여기로 안내</i></div>`;
    b.onclick=()=>selectParkingDestination(p);list.appendChild(b)
  })
}
async function selectParkingDestination(p){const original=state.destination?.name||'목적지';state.destination={id:p.id||null,lng:Number(p.lng),lat:Number(p.lat),name:p.name||`${original} 주차장`,address:p.address||''};state.destinationCorrection='parking';$('destinationInput').value=state.destination.name;if(state.destMarker)state.destMarker.setLngLat([state.destination.lng,state.destination.lat]);toast('주차장 진입점 기준으로 경로를 다시 계산합니다.');await requestRoute()}

function startNavigation(){
  if(!state.route)return;state.navigating=true;state.tripStartedAt=Date.now();state.tripStartPosition=state.user?{...state.user}:null;
  setUiStage('drive');document.body.classList.add('driving');$('searchPanel').classList.add('hidden');$('routeSummary').classList.add('hidden');$('navActions').classList.remove('hidden');$('guidanceCard').classList.remove('hidden');$('lanePanel').classList.remove('hidden');$('driveHud').classList.remove('hidden');
  if(state.watchId!==null)navigator.geolocation.clearWatch(state.watchId);
  if(!state.demoMode)state.watchId=navigator.geolocation.watchPosition(p=>{if(!state.sim.active)applyPosition(p,false)},e=>console.warn('watchPosition',e),{enableHighAccuracy:true,maximumAge:700,timeout:12000});
  setCharacter('daim','안내를 시작합니다. 화면보다 도로를 먼저 확인해 주세요.',true);NativeBridge.requestLane();NativeBridge.requestSafety();NativeBridge.requestImageDirection();NativeBridge.requestRoadEvents();NativeBridge.requestAlternatives();NativeBridge.setNavigationState({active:true,destination:state.destination});startAlternativeMonitor();updateNavigation(state.user);scheduleLayerLayout();logTelemetry('start');
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
  state.routeOptions=[];state.hunminFreeRoute=null;state.parking=[];state.parkingLoadedFor='';state.destinationCorrection=null;$('destinationInput').value='';$('routeSummary').classList.add('hidden');$('alternativePanel').classList.add('hidden');$('parkingPanel').classList.add('hidden');$('idleActions').classList.remove('hidden');$('navActions').classList.add('hidden');setUiStage('home');
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
  if(destDist<32){$('maneuverDistance').textContent='도착';$('maneuverText').textContent=state.destination.name;setDirectionIcon($('maneuverIcon'),101,'#ffffff');stopNavigation({arrived:true});return}
  const road=currentRoad(near.i);maybeManageTunnel(pos,road);const ng=nextGuideInfo(near.i);state.nextGuide=ng.guide;state.nextGuideDistance=ng.distance;renderGuidance(pos,ng.guide,ng.distance,remainDistance,remainDuration,road);
  renderIntersectionGuide(ng.guide,ng.distance);renderSafetyState(pos,road);autoCharacter(pos,ng.guide,ng.distance,road);maybeSpeakGuide(ng.guide,ng.distance);
  const heading=Number.isFinite(pos.heading)?pos.heading:(state.deviceHeading??state.map.getBearing());state.map.easeTo({center:[pos.lng,pos.lat],zoom:17.2,bearing:heading||0,pitch:42,duration:550});updateAROverlay();
}

function renderGuidance(pos,guide,distance,remainDistance,remainDuration,road){
  const type=guide?.type??0;const text=guide?.guidance||guide?.name||'경로를 따라 직진';const roadName=guide?.roadName||road?.name||'주행 경로';
  setDirectionIcon($('maneuverIcon'),type,'#ffffff');$('maneuverDistance').textContent=distance<60?'곧':`${km(distance)} 후`;$('maneuverText').textContent=text;$('roadCaption').textContent=roadName;
  $('etaText').textContent=eta(remainDuration);$('remainText').textContent=km(remainDistance);$('summaryEta').textContent=eta(remainDuration);$('summaryDuration').textContent=durationText(remainDuration);$('summaryDistance').textContent=km(remainDistance);
  const speedKmh=Number.isFinite(pos.speed)?Math.max(0,Math.round(pos.speed*3.6)):0;$('hudSpeed').textContent=speedKmh;$('hudRoad').textContent=roadName;$('hudTraffic').textContent=trafficText(road?.trafficState);$('hudEta').textContent=eta(remainDuration);$('hudRemain').textContent=`${km(remainDistance)} · ${durationText(remainDuration)}`;
  if($('arSpeedMirror'))$('arSpeedMirror').textContent=speedKmh;if($('arTripMirror'))$('arTripMirror').textContent=`${eta(remainDuration)} · ${km(remainDistance)} · ${durationText(remainDuration)}`;
  renderLaneHint(type);scheduleLayerLayout();
}

function guideLineColor(code){return ({0:'분홍 유도선',1:'연녹색 유도선',2:'녹색 유도선',3:'하늘색 유도선'})[code]||'유도선 정보 없음'}
function renderLaneHint(type){
  const box=$('lanes');box.innerHTML='';const packet=state.nativeLane;const nativeLanes=packet?.lanes;
  if(Array.isArray(nativeLanes)&&nativeLanes.length){
    nativeLanes.slice(0,10).forEach((lane,i)=>{const el=document.createElement('span');el.className='lane native';el.innerHTML=laneIconsMarkup(laneTurnNames(Number(lane.turnType)||0));if(Number(lane.suggest)===1||Number(lane.highlightType)>0)el.classList.add('active');if(Number(lane.busType)>0)el.classList.add('bus');if(Number(lane.pocketType)>0)el.classList.add('pocket');el.title=`${i+1}차로`;box.appendChild(el)});
    $('laneHint').textContent=`실제 ${nativeLanes.length}개 차로 · Kakao Navi SDK`;$('laneSourceBadge').textContent='NATIVE';$('laneSourceBadge').classList.add('native');
    const colored=nativeLanes.find(x=>Number(x.colorType)>=0&&Number(x.colorType)<=3);$('laneGuideLine').textContent=colored?guideLineColor(Number(colored.colorType)):'유도선 정보 없음';return;
  }
  const count=4;const active=LEFT_TYPES.has(type)?[0,1]:RIGHT_TYPES.has(type)?[2,3]:type===3?[0]:[1,2];
  for(let i=0;i<count;i++){
    const el=document.createElement('span');el.className='lane';
    const laneName=LEFT_TYPES.has(type)&&i===0?'turn-left':RIGHT_TYPES.has(type)&&i===3?'turn-right':type===3&&i===0?'u-turn':'straight';
    el.innerHTML=laneIconsMarkup([laneName]);
    if(active.includes(i))el.classList.add('active');
    box.appendChild(el)
  }
  const label=LEFT_TYPES.has(type)?'좌측 차로를 미리 이용':RIGHT_TYPES.has(type)?'우측 차로를 미리 이용':type===3?'유턴 가능 차로 확인':ROUNDABOUT_TYPES.has(type)?'회전교차로 진출 방향 확인':'직진 차로 유지';
  $('laneHint').textContent=`${label} · 웹 추정`;$('laneSourceBadge').textContent='WEB';$('laneSourceBadge').classList.remove('native');$('laneGuideLine').textContent='네이티브 SDK 연결 시 실제 유도선 표시';scheduleLayerLayout();
}


function renderIntersectionGuide(guide,distance){
  const panel=$('intersectionPanel');if(!panel)return;const packet=state.imageDirection;const nativeImg=packet?.imageDataUrl||packet?.dataUrl||packet?.image;const complex=guide&&(ROUNDABOUT_TYPES.has(guide.type)||LEFT_TYPES.has(guide.type)||RIGHT_TYPES.has(guide.type)||[7,10,14,15,42,45].includes(guide.type));
  const packetDistance=Number(packet?.distance);const nearNative=packet&&(!Number.isFinite(packetDistance)||packetDistance<900);const showNative=nearNative&&typeof nativeImg==='string'&&nativeImg.startsWith('data:image/');const showFallback=complex&&distance<360;
  if(!showNative&&!showFallback){panel.classList.add('hidden');scheduleLayerLayout();return}panel.classList.remove('hidden');
  if(showNative){$('intersectionImage').src=nativeImg;$('intersectionImage').classList.remove('hidden');$('intersectionFallback').classList.add('hidden');$('intersectionSource').textContent='KAKAO SDK';$('intersectionSource').classList.add('native')}
  else{$('intersectionImage').classList.add('hidden');$('intersectionFallback').classList.remove('hidden');setDirectionIcon($('intersectionArrow'),guide?.type??0,'#69a7ff');$('intersectionText').textContent=`${distance<60?'곧':km(distance)+' 후'} ${guide?.guidance||'교차로 방향을 확인하세요.'}`;$('intersectionSource').textContent='WEB';$('intersectionSource').classList.remove('native')}scheduleLayerLayout();
}
function numericSafetyLimit(x){for(const v of [x?.speedLimit,x?.speed_limit,x?.limitSpeed,x?.limit_speed]){const n=Number(v);if(Number.isFinite(n)&&n>0)return n}return 0}
function eventMessage(e){if(!e)return '';const code=Number(e.code);const type=Number(e.type);const kind=code===0?'사고':code===1?'공사':code===2?'행사':code===3?'통제':'도로 유고';return e.message||e.title||e.desc||`${kind}${type===1?' · 전면 통제':type===2?' · 부분 통제':''}`}
function renderSafetyState(pos,road){
  const native=state.safety||{};const routeSafety=(road?.safeties||[])[0]||{};const speedLimit=numericSafetyLimit(native)||numericSafetyLimit(routeSafety)||Number(road?.speedLimit)||0;const speed=Number.isFinite(pos?.speed)?Math.max(0,pos.speed*3.6):0;
  const lim=$('hudSpeedLimit');lim.textContent=speedLimit?`제한 ${Math.round(speedLimit)}`:'제한 --';lim.classList.toggle('hidden',!speedLimit);const over=speedLimit>0&&speed>speedLimit+4;$('hudSpeed').closest('.hud-speed')?.classList.toggle('overspeed',over);
  const nativeMsg=native.message||native.name||'';const events=(state.roadEvents?.length?state.roadEvents:(road?.roadEvents||state.route?.roadEvents||[]));const event=events.find(x=>!x.passed)||events[0];const msg=nativeMsg||eventMessage(event);const el=$('hudSafety');el.textContent=msg||'안전정보';el.classList.toggle('hidden',!msg);
  if(over){const key=`over:${Math.round(speedLimit)}`;if(state.lastSafetySpeechKey!==key){state.lastSafetySpeechKey=key;speak(`제한속도 ${Math.round(speedLimit)}킬로미터 구간입니다. 속도를 줄여 주세요.`,{characterKey:'hunmin'});if(navigator.vibrate)navigator.vibrate([120,60,120])}}
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
  if(state.haptic&&thresholds===80&&navigator.vibrate)navigator.vibrate([80,45,80]);if(guide.type===101)speak('잠시 후 목적지에 도착합니다.',{characterKey:'daim'});else speak(`${prefix} ${guide.guidance||'안내 지점입니다'}.`,{characterKey:'daim'});
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
  const c=$('arCanvas');if(!c||!state.user||!state.route?.geometry?.length||state.arMode==='native')return;
  const ctx=c.getContext('2d'),w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);const heading=arHeading();const pts=[];let lastDist=0;
  for(let i=state.currentRouteIndex+1;i<Math.min(state.route.geometry.length,state.currentRouteIndex+260);i+=3){
    const p=state.route.geometry[i],d=haversine(state.user.lat,state.user.lng,p[1],p[0]);if(d<4||d>300||d<lastDist-10)continue;lastDist=d;
    const diff=normalizeAngle(bearingTo(state.user.lat,state.user.lng,p[1],p[0])-heading);if(Math.abs(diff)>70)continue;
    const x=w/2+(diff/70)*(w*.45),depth=clamp(d/300,0,1),horizon=h*(.46+clamp(((state.devicePitch??75)-75)/125,-.07,.08)),y=horizon+(1-depth)*h*.42;
    pts.push({x,y,d,near:1-depth});if(pts.length>24)break
  }
  if(pts.length<2)return;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='source-over';
  // Perspective blue route ribbon: draw far-to-near so the lower part naturally widens.
  for(let i=pts.length-2;i>=0;i--){
    const a=pts[i],b=pts[i+1],near=(a.near+b.near)/2,width=18+near*74;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(0,116,255,${.38+near*.34})`;ctx.lineWidth=width+14;ctx.shadowColor='rgba(0,166,255,.85)';ctx.shadowBlur=18+near*20;ctx.stroke();
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(16,126,244,${.54+near*.28})`;ctx.lineWidth=width;ctx.shadowBlur=0;ctx.stroke();
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(84,195,255,${.65+near*.28})`;ctx.lineWidth=Math.max(2,width*.08);ctx.stroke();
  }
  // Repeated white chevrons like a commercial AR navigation lane.
  const step=Math.max(2,Math.floor(pts.length/7));
  for(let i=1;i<pts.length-1;i+=step){
    const p=pts[i],next=pts[Math.min(pts.length-1,i+1)],dx=next.x-p.x,dy=next.y-p.y,len=Math.hypot(dx,dy)||1,fx=dx/len,fy=dy/len,nx=-fy,ny=fx,size=10+p.near*25,half=8+p.near*19;
    const tipX=p.x+fx*size*.7,tipY=p.y+fy*size*.7,backX=p.x-fx*size*.55,backY=p.y-fy*size*.55;
    ctx.beginPath();ctx.moveTo(backX+nx*half,backY+ny*half);ctx.lineTo(tipX,tipY);ctx.lineTo(backX-nx*half,backY-ny*half);ctx.strokeStyle=`rgba(255,255,255,${.78+p.near*.2})`;ctx.lineWidth=3+p.near*6;ctx.shadowColor='rgba(0,92,190,.55)';ctx.shadowBlur=8;ctx.stroke();
  }
  ctx.restore();
}
function calibrateAR(){const gps=state.user?.heading;if(Number.isFinite(gps)&&Number.isFinite(state.smoothedHeading)){state.arHeadingOffset=normalizeAngle(gps-state.smoothedHeading);savePreferences();toast('현재 주행 방향을 기준으로 AR을 보정했습니다.')}else{state.arHeadingOffset=0;toast('GPS 진행방향이 확보되면 더 정확하게 보정할 수 있습니다.')}}
function updateAROverlay(){
  if(!$('arView')||$('arView').classList.contains('hidden')||!state.user||!state.nextGuide)return;const g=state.nextGuide;setDirectionIcon($('arArrow'),g.type,'#79b2ff');$('arDistance').textContent=state.nextGuideDistance<60?'곧':km(state.nextGuideDistance);$('arText').textContent=g.guidance||g.name||'다음 방향';
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
function updateSimButton(){const b=$('simBtn');if(!b)return;b.innerHTML=`<span class="svg-icon">${iconSvg(state.sim.active?'stop':'play')}</span><span>${state.sim.active?'가상주행 중':'가상주행'}</span>`}
function startSimulation(){
  if(!state.route?.geometry?.length||!state.navigating)return;stopSimulation();state.sim.active=true;state.sim.index=Math.max(0,state.currentRouteIndex);updateSimButton();toast('가상주행을 시작합니다. 실제 GPS 대신 경로를 따라 이동합니다.');
  state.sim.timer=setInterval(()=>{if(!state.sim.active||!state.navigating)return;const coords=state.route.geometry;if(state.sim.index>=coords.length-2){stopSimulation();return}const step=Math.max(1,Math.round(coords.length/420));const prev=coords[state.sim.index];state.sim.index=Math.min(coords.length-1,state.sim.index+step);const cur=coords[state.sim.index];const heading=bearingTo(prev[1],prev[0],cur[1],cur[0]);applyPosition({coords:{longitude:cur[0],latitude:cur[1],accuracy:4,speed:state.sim.speedKmh/3.6,heading},timestamp:Date.now()},false,'sim')},650)
}
function stopSimulation(){if(state.sim.timer)clearInterval(state.sim.timer);state.sim.timer=null;state.sim.active=false;updateSimButton()}
function toggleSimulation(){state.sim.active?stopSimulation():startSimulation()}

/* Favorites + Firebase */
function localPreferences(){try{return JSON.parse(localStorage.getItem(GUEST_SETTINGS_KEY)||'{}')}catch{return {}}}
function applyPreferences(p={}){if(typeof p.sound==='boolean')state.sound=p.sound;if(Number.isFinite(Number(p.voiceVolume)))state.voiceVolume=Math.max(0,Math.min(1,Number(p.voiceVolume)));if(typeof p.autoCharacter==='boolean')state.autoCharacter=p.autoCharacter;if(p.character&&characters[p.character])state.currentCharacter=p.character;if(Number.isFinite(Number(p.arHeadingOffset)))state.arHeadingOffset=Number(p.arHeadingOffset);state.savedPlaces.home=normalizePlaceData(p.homePlace)||null;state.savedPlaces.work=normalizePlaceData(p.workPlace)||null;setSoundButtonIcon();$('characterModeBtn').textContent=state.autoCharacter?'AUTO':'FIX';setCharacter(state.currentCharacter);syncCharacterButtons();updateHomeWorkButtons();updateVoiceControls()}
async function savePreferences(){const p={sound:state.sound,voiceVolume:state.voiceVolume,autoCharacter:state.autoCharacter,character:state.currentCharacter,arHeadingOffset:state.arHeadingOffset,homePlace:state.savedPlaces.home||null,workPlace:state.savedPlaces.work||null,updatedAt:Date.now()};localStorage.setItem(GUEST_SETTINGS_KEY,JSON.stringify(p));if(state.firebase.user){const {fsMod}=state.firebase.mods;await fsMod.setDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'),{...p,updatedAt:fsMod.serverTimestamp()},{merge:true}).catch(()=>{})}}
async function loadPreferences(){let p=localPreferences();if(state.firebase.user){try{const {fsMod}=state.firebase.mods,snap=await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'));if(snap.exists())p={...p,...snap.data()}}catch{}}applyPreferences(p)}

function firebaseConfig(){return window.__APP_CONFIG__?.firebase||{}}
function isFirebaseConfigured(){const c=firebaseConfig();return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId)}
function setIntegrationStatus(items){
  const root=$('integrationStatusList');if(!root)return;
  const rows=[['Cloudflare API',items.cloudflare],['D1',items.d1],['Firebase Auth',items.auth],['Firestore',items.firestore]];
  root.innerHTML=rows.map(([name,v])=>`<span><i class="status-dot ${v?.ok?'ok':v?.warn?'warn':'fail'}"></i><b>${name}</b><small>${escapeHtml(v?.text||'확인 불가')}</small></span>`).join('');
}
async function runIntegrationCheck(){
  const btn=$('integrationCheckBtn');if(btn){btn.disabled=true;btn.textContent='점검 중...'}
  const result={cloudflare:{ok:false,text:'응답 없음'},d1:{warn:true,text:'미확인'},auth:{warn:true,text:'미설정'},firestore:{warn:true,text:'로그인 필요'}};
  try{const r=await fetch('/api/health',{cache:'no-store'});const d=await r.json();result.cloudflare={ok:Boolean(r.ok&&d.ok),text:r.ok?'API 정상':'API 오류'};result.d1=d.integrations?.d1?{ok:true,text:'D1 연결됨'}:{warn:true,text:'D1 바인딩 없음'};}catch{result.cloudflare={ok:false,text:'API 접속 실패'}}
  if(state.firebase.configured&&state.firebase.ready){result.auth={ok:true,text:state.firebase.user?'Google 로그인 완료':'Firebase Auth 준비됨'};if(state.firebase.user){try{const {fsMod}=state.firebase.mods;await fsMod.getDoc(fsMod.doc(state.firebase.db,'users',state.firebase.user.uid,'settings','preferences'));result.firestore={ok:true,text:'읽기 권한 정상'}}catch{result.firestore={ok:false,text:'Rules 또는 권한 확인'}}}else result.firestore={warn:true,text:'로그인 후 점검 가능'};}
  setIntegrationStatus(result);if(btn){btn.disabled=false;btn.textContent='연동 상태 다시 점검'}
}

async function initFirebase(){
  state.firebase.configured=isFirebaseConfigured();
  if(!state.firebase.configured){loadGuestData();renderAccount();updateHomeWorkButtons();return}
  try{
    const [appMod,authMod,fsMod]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);
    const app=appMod.initializeApp(firebaseConfig());const auth=authMod.getAuth(app);await authMod.setPersistence(auth,authMod.browserLocalPersistence);const db=fsMod.getFirestore(app);
    state.firebase={configured:true,ready:true,auth,db,user:null,mods:{authMod,fsMod}};
    authMod.onAuthStateChanged(auth,async user=>{await syncAuthState(user)});
    await authMod.getRedirectResult(auth).catch(()=>null);
  }catch(e){console.warn('Firebase init failed',e);state.firebase.ready=false;loadGuestData();renderAccount();updateHomeWorkButtons()}
}
async function loginGoogle(){
  if(!state.firebase.ready){toast('config.js에 Firebase 웹 앱 설정을 먼저 입력해 주세요.',3200);return}
  const {authMod}=state.firebase.mods;const provider=new authMod.GoogleAuthProvider();
  const btn=$('googleLoginBtn');if(btn){btn.disabled=true;btn.textContent='로그인 중...'}
  $('accountStatus').textContent='Google 로그인 중';
  try{
    const result=await authMod.signInWithPopup(state.firebase.auth,provider);
    if(result?.user) await syncAuthState(result.user);
    toast('로그인되었습니다.');
  }catch(e){
    if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e.code)){
      await authMod.signInWithRedirect(state.firebase.auth,provider);
      return;
    }
    toast(`로그인 실패: ${e.code||e.message}`,3200)
  }finally{
    if(btn){btn.disabled=false;btn.textContent='G  Google로 로그인'}
  }
}
async function logout(){if(!state.firebase.ready)return;const btn=$('logoutBtn');if(btn)btn.disabled=true;$('accountStatus').textContent='로그아웃 중';try{await state.firebase.mods.authMod.signOut(state.firebase.auth);await syncAuthState(null);toast('로그아웃되었습니다.')}finally{if(btn)btn.disabled=false}}
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
function updateFavoriteButton(){if(!state.destination){$('favoriteBtn').classList.remove('active');$('favoriteBtn').innerHTML=`<span class="svg-icon">${iconSvg('star')}</span><span class="btn-label">즐겨찾기</span>`;return}const exists=state.favorites.some(x=>x.id===favoriteId(state.destination));$('favoriteBtn').classList.toggle('active',exists);$('favoriteBtn').innerHTML=`<span class="svg-icon">${iconSvg('star')}</span><span class="btn-label">${exists?'저장됨':'즐겨찾기'}</span>`}
async function saveTripRecord({arrived,finishedAt}){
  if(!state.tripStartedAt||!state.destination||!state.route)return;const record={destination:state.destination.name,address:state.destination.address||'',lng:state.destination.lng,lat:state.destination.lat,distance:Math.round(state.route.distance||0),duration:Math.round((finishedAt-state.tripStartedAt)/1000),plannedDuration:Math.round(state.route.duration||0),provider:state.route.provider||'',arrived:Boolean(arrived)};
  if(state.firebase.user){const {fsMod}=state.firebase.mods;await fsMod.addDoc(fsMod.collection(state.firebase.db,'users',state.firebase.user.uid,'trips'),{...record,createdAt:fsMod.serverTimestamp()}).catch(console.warn);await loadCloudData()}
  else{state.history.unshift({...record,id:`local_${finishedAt}`,createdAt:finishedAt});state.history=state.history.slice(0,30);localStorage.setItem(GUEST_HISTORY_KEY,JSON.stringify(state.history));renderAccountLists()}
  state.tripStartedAt=null;
}
function renderAccount(){
  const u=state.firebase.user;$('signedOutBox').classList.toggle('hidden',Boolean(u));$('signedInBox').classList.toggle('hidden',!u);document.querySelector('.notice-btn')?.classList.toggle('signed',Boolean(u));
  const orb=$('userPhoto').closest('.profile-orb');if(u){$('accountStatus').textContent='Google 로그인 완료';$('userName').textContent=u.displayName||'사용자';$('userEmail').textContent=u.email||'';$('userPhoto').src=u.photoURL||'/assets/daim.png';orb?.classList.toggle('has-google-photo',Boolean(u.photoURL))}else{$('accountStatus').textContent=state.firebase.configured?'로그인 전 · 게스트 저장':'게스트 모드 · 로컬 저장';$('userName').textContent='조팸스 드라이버';$('userEmail').textContent='로그인하면 주행기록이 동기화됩니다.';$('userPhoto').src='/assets/daim.png';orb?.classList.remove('has-google-photo')}renderAccountLists();
}
function itemDate(v){if(!v)return '';if(typeof v.toDate==='function')return v.toDate().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});const d=new Date(typeof v==='number'?v:v.seconds? v.seconds*1000:Date.now());return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function renderAccountLists(){
  const fav=$('favoritesList'),hist=$('historyList');fav.innerHTML='';hist.innerHTML='';
  if(!state.favorites.length)fav.innerHTML='<div class="list-empty">아직 저장한 목적지가 없습니다.</div>';else state.favorites.forEach(f=>fav.appendChild(accountItem(f.name,f.address||'저장한 장소',[{label:'안내',onClick:()=>{closeAccount();selectDestination(f)}},{label:'삭제',danger:true,onClick:()=>deleteFavoriteById(f.id)}])));
  if(!state.history.length)hist.innerHTML='<div class="list-empty">아직 주행 기록이 없습니다.</div>';else state.history.forEach(h=>hist.appendChild(accountItem(h.destination,`${itemDate(h.createdAt)} · ${km(h.distance)} · ${durationText(h.duration)}`,[{label:h.arrived?'도착':'종료',disabled:true}])));
  updateHomeWorkButtons();
}
function accountItem(title,sub,actions=[]){const row=document.createElement('div');row.className='account-item';const copy=document.createElement('div');copy.className='item-copy';const b=document.createElement('b');b.textContent=title||'장소';const s=document.createElement('small');s.textContent=sub||'';copy.append(b,s);const actionsBox=document.createElement('div');actionsBox.className='account-item-actions';(actions||[]).forEach(({label,onClick,danger=false,disabled=false})=>{const btn=document.createElement('button');btn.textContent=label||'보기';if(danger)btn.classList.add('danger');btn.disabled=Boolean(disabled);if(onClick)btn.onclick=onClick;actionsBox.appendChild(btn)});row.append(copy,actionsBox);return row}
function openAccount(tab='favorites'){setUiStage('account');$('accountModal').classList.remove('hidden');renderAccount();setAccountTab(tab)}
function closeAccount(){$('accountModal').classList.add('hidden');setUiStage(state.navigating?'drive':state.route?'route':'home')}

function bindUI(){
  applyStaticIcons();
  $('searchBtn').onclick=()=>searchPlaces($('destinationInput').value);$('destinationInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces(e.target.value)});$('locateBtn').onclick=()=>locate(true);$('recenterBtn').onclick=()=>locate(true);$('zoomInBtn').onclick=()=>state.map.zoomIn();$('zoomOutBtn').onclick=()=>state.map.zoomOut();
  $('startNavBtn').onclick=startNavigation;$('hunminFreeRouteCard').onclick=chooseHunminFreeRoute;$('stopNavBtn').onclick=()=>stopNavigation();$('cancelRouteBtn').onclick=clearRoute;$('overviewBtn').onclick=()=>state.route&&drawRoutes({fit:true});$('altBtn').onclick=()=>{renderAlternativeRoutes();$('fasterRouteBanner').classList.add('hidden');if(state.navigating)checkAlternativeRoutes();toast(state.routeOptions.length>1?'대안 경로를 확인하고 최신 경로도 조회합니다.':'최신 대안 경로를 조회합니다.')};$('simBtn').onclick=toggleSimulation;$('arBtn').onclick=startAR;$('closeArBtn').onclick=stopAR;$('arCalibrateBtn').onclick=calibrateAR;$('favoriteBtn').onclick=toggleFavorite;
  document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.priority=b.dataset.priority||'RECOMMEND';state.avoid=b.dataset.avoid||null;if(state.destination)requestRoute()});
  document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quickSearch(b.dataset.quick));
  document.querySelectorAll('[data-suggest]').forEach(b=>b.onclick=()=>{const q=b.dataset.suggest||'';$('destinationInput').value=q;searchPlaces(q)});$('recentMoreBtn').onclick=()=>toast('최근 목적지 전체보기는 다음 단계에서 확장됩니다.');
  $('homeShortcutBtn').onclick=()=>useSavedPlace('home');$('workShortcutBtn').onclick=()=>useSavedPlace('work');$('favoritesShortcutBtn').onclick=()=>openAccount('favorites');
  $('editHomeBtn').onclick=e=>{e.stopPropagation();openPlaceRegistration('home')};$('editWorkBtn').onclick=e=>{e.stopPropagation();openPlaceRegistration('work')};
  $('closePlaceRegisterBtn').onclick=closePlaceRegistration;$('placeRegisterModal').addEventListener('click',e=>{if(e.target===$('placeRegisterModal'))closePlaceRegistration()});$('placeRegisterSearchBtn').onclick=renderPlaceRegistrationSearch;$('placeRegisterInput').addEventListener('keydown',e=>{if(e.key==='Enter')renderPlaceRegistrationSearch()});$('saveCurrentPlaceBtn').onclick=async()=>{const p=normalizePlaceData(state.destination);if(!p||!state.registerKind)return;await saveSavedPlace(state.registerKind,p);toast(`${placeLabel(state.registerKind)} 장소를 저장했습니다.`);closePlaceRegistration()};
  document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>{state.autoCharacter=false;setCharacter(b.dataset.character);$('characterModeBtn').textContent='FIX';savePreferences();previewCharacterVoice(b.dataset.character);toast(`${characters[b.dataset.character]?.name||'가이드'} 음성·안내로 변경했습니다.`)});
  document.querySelectorAll('[data-character-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.characterMode;if(mode==='auto'){state.autoCharacter=true;$('characterModeBtn').textContent='AUTO';toast('상황별 캐릭터 자동 전환을 사용합니다.')}else{state.autoCharacter=false;setCharacter(mode);$('characterModeBtn').textContent='FIX';previewCharacterVoice(mode);toast(`${characters[mode]?.name||'가이드'} 음성·안내로 변경했습니다.`)}syncCharacterButtons();savePreferences()});
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.nav;if(nav==='my'){openAccount('favorites');return}if(nav==='home'){setUiStage('home');return}if(nav==='route'){if(state.route)setUiStage('route');else{setUiStage('home');$('destinationInput').focus();toast('목적지를 먼저 검색해 주세요.')}return}if(nav==='drive'){if(state.navigating){setUiStage('drive');return}if(state.route){toast('안내 시작을 눌러 실시간 주행을 시작해 주세요.');setUiStage('route')}else toast('먼저 목적지를 선택해 주세요.')}});
  $('menuBtn').onclick=openMenuDrawer;$('notifBtn').onclick=openNoticeModal;
  $('acceptFasterRouteBtn').onclick=acceptPendingAlternative;$('dismissFasterRouteBtn').onclick=()=>{$('fasterRouteBanner').classList.add('hidden');state.pendingAlternative=null;state.nativeMultiRoute=null};
  $('characterModeBtn').onclick=()=>{state.autoCharacter=!state.autoCharacter;$('characterModeBtn').textContent=state.autoCharacter?'AUTO':'FIX';syncCharacterButtons();savePreferences();toast(state.autoCharacter?'상황별 캐릭터 자동 전환':'현재 캐릭터 고정')};
  $('closeAccountBtn').onclick=closeAccount;$('accountModal').addEventListener('click',e=>{if(e.target===$('accountModal'))closeAccount()});$('googleLoginBtn').onclick=loginGoogle;$('logoutBtn').onclick=logout;
  $('closeMenuBtn').onclick=closeMenuDrawer;$('menuBackdrop').onclick=closeMenuDrawer;document.querySelectorAll('[data-menu-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.menuAction;closeMenuDrawer();if(action==='home')setUiStage('home');else if(action==='route')menuRoutePreview();else if(action==='drive'){if(state.navigating)setUiStage('drive');else if(state.route){setUiStage('route');toast('안내 시작을 누르면 주행 HUD가 표시됩니다.')}else{setUiStage('home');toast('목적지를 먼저 선택해 주세요.')}}else if(action==='parking')menuParkingPreview();else if(action==='my')openAccount('favorites');else if(action==='sound'){state.sound=!state.sound;updateVoiceControls();savePreferences();toast(state.sound?'음성 안내 켜짐':'음성 안내 꺼짐')}});
  $('closeNoticeBtn').onclick=closeNoticeModal;$('noticeModal').addEventListener('click',e=>{if(e.target===$('noticeModal'))closeNoticeModal()});
  $('voiceVolume').addEventListener('input',e=>{state.voiceVolume=Math.max(0,Math.min(1,Number(e.target.value)/100));if(state.voiceVolume===0)state.sound=false;else if(!state.sound)state.sound=true;updateVoiceControls()});$('voiceVolume').addEventListener('change',()=>savePreferences());
  $('voiceToggleBtn').onclick=()=>{state.sound=!state.sound;if(state.sound&&state.voiceVolume===0)state.voiceVolume=.5;updateVoiceControls();savePreferences();toast(state.sound?'음성 안내 켜짐':'음성 안내 꺼짐')};
  $('integrationCheckBtn').onclick=runIntegrationCheck;$('voicePreviewBtn').onclick=()=>{if(!state.sound||state.voiceVolume<=0){state.sound=true;if(state.voiceVolume<=0)state.voiceVolume=.5;updateVoiceControls();savePreferences()}previewCharacterVoice(state.currentCharacter)};
  document.querySelectorAll('[data-voice-profile]').forEach(el=>el.onclick=()=>{const key=el.dataset.voiceProfile;if(!characters[key])return;state.autoCharacter=false;setCharacter(key);$('characterModeBtn').textContent='FIX';syncCharacterButtons();savePreferences();previewCharacterVoice(key)});
  window.addEventListener('resize',scheduleLayerLayout,{passive:true});if('speechSynthesis' in window){refreshSpeechVoices();window.speechSynthesis.onvoiceschanged=refreshSpeechVoices;}
  document.querySelectorAll('.account-tab').forEach(b=>b.onclick=()=>setAccountTab(b.dataset.tab||'favorites'));
  syncCharacterButtons();updateVoiceControls();updateSimButton();setUiStage('home');updateHomeWorkButtons();setAccountTab('favorites');updateFavoriteButton();
}

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
bindUI();applyPreferences(localPreferences());initMap();initFirebase();
